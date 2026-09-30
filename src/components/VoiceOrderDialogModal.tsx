import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { FoodItem, ScheduleDuration } from '../types';
import { SpeechService } from '../services/speechService';
import { AuthService } from '../services/authService';
import { SttMatcherService, CONFIRMATION_VOCABULARY } from '../services/sttMatcherService';
import { calculateScheduleEndDate } from '../services/autoOrderBackgroundService';
import { calculateScheduleOccurrences, calculateScheduleDatesList } from '../utils/scheduleCalculator';
import { ScheduleBill } from './ScheduleBill';
import { WeekdaySelector } from './WeekdaySelector';
import { Mic, MicOff, X, Zap, Clock, Volume2, Sparkles, CheckCircle2, XCircle, FileText, Receipt, ShieldCheck, Calendar, ArrowRight } from 'lucide-react';

interface VoiceOrderDialogModalProps {
  item: FoodItem | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 🚀 ROBUST MULTILINGUAL SPOKEN TIME PARSER (EN, TA, HI)
 */
export function parseSpokenTimeTo24Hr(text: string): { time24: string; time12Formatted: string } | null {
  if (!text) return null;
  const raw = text.toLowerCase().replace(/\./g, '').trim();
  console.log('[Time Parser Input Raw Cleaned]:', raw);

  let hours = -1;
  let minutes = 0;
  let isPM = false;

  // 1. Detect AM/PM & Time of Day in EN, TA, HI
  if (
    raw.includes('pm') ||
    raw.includes('evening') ||
    raw.includes('night') ||
    raw.includes('மாலை') ||
    raw.includes('இரவு') ||
    raw.includes('மதியம்') ||
    raw.includes('பிறகு') ||
    raw.includes('शाम') ||
    raw.includes('रात') ||
    raw.includes('दोपहर')
  ) {
    isPM = true;
  }

  if (raw.includes('half past') || raw.includes('அரை') || raw.includes('साढ़े')) minutes = 30;
  if (raw.includes('quarter past') || raw.includes('கால்') || raw.includes('सवा')) minutes = 15;
  if (raw.includes('quarter to') || raw.includes('முக்கால்')) minutes = 45;

  // 2. Tamil & Hindi Number Word Mapping
  const wordNumMap: { [key: string]: number } = {
    // Tamil
    'ஒன்று': 1, 'ஒன்னு': 1, 'இரண்டு': 2, 'ரெண்டு': 2, 'மூன்று': 3, 'மூணு': 3,
    'நான்கு': 4, 'நாளு': 4, 'ஐந்து': 5, 'அஞ்சு': 5, 'ஆறு': 6, 'ஏழு': 7,
    'எட்டு': 8, 'ஒன்பது': 9, 'பத்து': 10, 'பதினொன்று': 11, 'பனிரெண்டு': 12,
    // Hindi
    'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'छह': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10, 'ग्यारह': 11, 'बारह': 12
  };

  for (const [word, numVal] of Object.entries(wordNumMap)) {
    if (raw.includes(word)) {
      hours = numVal;
      break;
    }
  }

  // 3. Extract Digits if word not found
  if (hours === -1) {
    const numbers = raw.match(/\d+/g);
    if (numbers && numbers.length > 0) {
      hours = parseInt(numbers[0], 10);
      if (numbers.length > 1) {
        minutes = parseInt(numbers[1], 10);
      }
    }
  }

  if (hours === -1 || hours > 24) {
    console.warn('[Time Parser Failed]: Could not extract valid hour from:', raw);
    return null;
  }

  // 4. Convert 12-hour to 24-hour
  if (isPM && hours < 12) {
    hours += 12;
  } else if (!isPM && hours === 12 && (raw.includes('am') || raw.includes('காலை') || raw.includes('सुबह'))) {
    hours = 0;
  }

  const time24 = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  const displayHours = hours % 12 || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const time12Formatted = `${displayHours}:${String(minutes).padStart(2, '0')} ${ampm}`;

  console.log(`[Time Parser Success]: "${raw}" -> 24h: ${time24}, Display: ${time12Formatted}`);
  return { time24, time12Formatted };
}

export type VoiceDialogStep =
  | 'ask_type'
  | 'confirm_item'
  | 'ask_time'
  | 'ask_frequency_days'
  | 'ask_duration'
  | 'ask_custom_dates'
  | 'confirm_dates'
  | 'show_bill'
  | 'verify_pin'
  | 'confirm_schedule';

export const VoiceOrderDialogModal: React.FC<VoiceOrderDialogModalProps> = ({
  item,
  isOpen,
  onClose
}) => {
  const { placeInstantOrder, saveSchedule, language, speakText, currentUser, showToast, t } = useApp();
  const [step, setStep] = useState<VoiceDialogStep>('ask_type');
  const [scheduleTimeInput, setScheduleTimeInput] = useState('08:00');
  const [formattedSpokenTime, setFormattedSpokenTime] = useState('8:00 AM');
  const [selectedDuration, setSelectedDuration] = useState<string>('1_month');
  const [selectedDurationLabel, setSelectedDurationLabel] = useState<string>('1 Month (30 Days)');
  
  // Custom Date Range State
  const getTodayFormattedStr = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const getNextWeekFormattedStr = (): string => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const [customStartDate, setCustomStartDate] = useState<string>(getTodayFormattedStr());
  const [customEndDate, setCustomEndDate] = useState<string>(getNextWeekFormattedStr());

  const [isEveryDay, setIsEveryDay] = useState<boolean>(true);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  
  // PIN Verification State
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '']);
  const [pinError, setPinError] = useState<string | null>(null);

  const isComponentMounted = useRef<boolean>(false);

  // 🚀 REFS TO PREVENT STALE CLOSURE IN SPEECHRECOGNITION CALLBACKS
  const stepRef = useRef<VoiceDialogStep>(step);
  const scheduleTimeInputRef = useRef<string>(scheduleTimeInput);
  const selectedDurationRef = useRef<string>(selectedDuration);
  const customStartDateRef = useRef<string>(customStartDate);
  const customEndDateRef = useRef<string>(customEndDate);
  const isEveryDayRef = useRef<boolean>(isEveryDay);
  const selectedDaysRef = useRef<string[]>(selectedDays);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    scheduleTimeInputRef.current = scheduleTimeInput;
  }, [scheduleTimeInput]);

  useEffect(() => {
    selectedDurationRef.current = selectedDuration;
  }, [selectedDuration]);

  useEffect(() => {
    customStartDateRef.current = customStartDate;
  }, [customStartDate]);

  useEffect(() => {
    customEndDateRef.current = customEndDate;
  }, [customEndDate]);

  useEffect(() => {
    isEveryDayRef.current = isEveryDay;
  }, [isEveryDay]);

  useEffect(() => {
    selectedDaysRef.current = selectedDays;
  }, [selectedDays]);

  // Robust Price Extraction (guarantees valid numbers, never NaN)
  const getItemBasePrice = (fItem: FoodItem | null): number => {
    if (!fItem) return 120;
    if (typeof (fItem as any).price === 'number' && !isNaN((fItem as any).price)) return (fItem as any).price;
    if (typeof fItem.basePrice === 'number' && !isNaN(fItem.basePrice)) return fItem.basePrice;
    if (fItem.platforms && fItem.platforms.length > 0 && typeof fItem.platforms[0].price === 'number') return fItem.platforms[0].price;
    return 120;
  };

  const foodPrice = getItemBasePrice(item);
  const deliveryFee = 30;
  const taxAndFees = Math.round(foodPrice * 0.05 + 10);
  const grandTotal = foodPrice + deliveryFee + taxAndFees;

  // Native Spoken Prompt Generator
  const getSpokenPromptText = () => {
    if (!item) return '';
    const nativeName = item.nativeNames?.[language] || item.name || 'food item';
    if (language === 'ta') {
      return `${nativeName} உங்களுக்காகக் கிடைத்துள்ளது. இப்போதே ஆர்டர் செய்ய வேண்டுமா அல்லது குறிப்பிட்ட நேரத்திற்கு அட்டவணைப்படுத்த வேண்டுமா?`;
    }
    if (language === 'hi') {
      return `${nativeName} आपके पास उपलब्ध है। क्या आप अभी ऑर्डर करना चाहते हैं या बाद के लिए शेड्यूल करना चाहते हैं?`;
    }
    return `${item.name} found near you. Do you want to order now, or schedule it for later?`;
  };

  // Visual Card Prompt Generator
  const getVisualPromptText = () => {
    if (!item) return '';
    const nativeName = item.nativeNames?.[language] || item.name || 'food item';
    if (language === 'ta') {
      return `"${nativeName} இப்போதே வாலட் மூலம் ஆர்டர் செய்ய வேண்டுமா அல்லது குறிப்பிட்ட நேரத்திற்கு அட்டவணைப்படுத்த வேண்டுமா?"`;
    }
    if (language === 'hi') {
      return `"क्या आप ${nativeName} अभी ऑर्डर करना चाहते हैं या बाद के लिए शेड्यूल करना चाहते हैं?"`;
    }
    return `"Do you want to order ${item.name} instantly now using Wallet money, or schedule it for later?"`;
  };

  const startListeningSession = () => {
    if (!isOpen || !SpeechService.isSupported()) return;

    console.log(`[VoiceOrderDialogModal]: Starting SpeechService mic listening session for step: "${stepRef.current}"`);
    SpeechService.startListening({
      language,
      continuous: true,
      interimResults: true,
      onStart: () => {
        setIsListening(true);
      },
      onResult: (transcribedText, isFinal, nBestTranscripts) => {
        if (!transcribedText) return;
        setLiveTranscript(transcribedText);
        const candidates = nBestTranscripts && nBestTranscripts.length > 0 ? nBestTranscripts : [transcribedText];

        // For PIN step, voice entry is disabled per security guidelines (Keypad/Tap only)
        if (stepRef.current === 'verify_pin') {
          return;
        }

        // Only process general dialog steps on final speech results
        if (!isFinal) return;
        processSpokenReply(transcribedText, candidates);
      },
      onError: (err) => {
        console.warn(`[VoiceOrderDialogModal Mic Error]:`, err);
        setIsListening(false);
      },
      onEnd: () => {
        setIsListening(false);
        if (isComponentMounted.current && isOpen) {
          setTimeout(() => {
            if (isComponentMounted.current && isOpen) {
              startListeningSession();
            }
          }, 400);
        }
      }
    });
  };

  const speakStepPrompt = (currentStep: VoiceDialogStep, customTimeFormatted?: string) => {
    if (!item) return;

    const timeStr = customTimeFormatted || formattedSpokenTime;
    const nativeName = item.nativeNames?.[language] || item.name || 'food item';
    let promptMsg = '';

    if (currentStep === 'ask_type') {
      promptMsg = getSpokenPromptText();
    } else if (currentStep === 'confirm_item') {
      promptMsg = language === 'ta'
        ? `${nativeName} (${item.restaurant}) என்ற உணவை அட்டவணைப்படுத்த விரும்புகிறீர்களா? "ஆம்" அல்லது "இல்லை" என்று சொல்லுங்கள்.`
        : language === 'hi'
        ? `क्या आप ${item.restaurant} से ${nativeName} को शेड्यूल करना चाहते हैं? "हाँ" या "नहीं" बोलें।`
        : `Do you want to schedule ${item.name} from ${item.restaurant}? Say "Yes" or "No".`;
    } else if (currentStep === 'ask_time') {
      promptMsg = language === 'ta'
        ? `${nativeName} எந்த நேரத்திற்கு அட்டவணைப்படுத்த வேண்டும்? (எடுத்துக்காட்டாக காலை 8 மணி, மாலை 8 மணி)`
        : language === 'hi'
        ? `${nativeName} किस समय शेड्यूल करना चाहते हैं? (जैसे: सुबह 8 बजे, शाम 8 बजे)`
        : `What time would you like to schedule ${item.name}? (e.g., 8 AM, 8 PM)`;
    } else if (currentStep === 'ask_frequency_days') {
      promptMsg = t('askFrequency');
    } else if (currentStep === 'ask_duration') {
      promptMsg = t('askDuration');
    } else if (currentStep === 'ask_custom_dates') {
      promptMsg = language === 'ta'
        ? 'சுயவிருப்ப தேதி வரம்பிற்கு, ஆரம்ப தேதி மற்றும் முடிவு தேதியை தேர்வு செய்யவும்.'
        : language === 'hi'
        ? 'कस्टम तिथि सीमा के लिए, कृपया प्रारंभ तिथि और अंतिम तिथि चुनें।'
        : 'For custom date range, please set or speak the start date and end date.';
    } else if (currentStep === 'confirm_dates') {
      const count = calculateScheduleOccurrences(
        customStartDate || getTodayFormattedStr(),
        selectedDuration as ScheduleDuration,
        customEndDate,
        isEveryDay ? [] : selectedDays
      );
      promptMsg = language === 'ta'
        ? `மொத்தம் ${count} டெலிவரி தேதிகள் கணக்கிடப்பட்டுள்ளன. ${t('confirmDates')}`
        : language === 'hi'
        ? `कुल ${count} डिलीवरी की तारीखें हैं। ${t('confirmDates')}`
        : `Total ${count} delivery dates calculated. ${t('confirmDates')}`;
    } else if (currentStep === 'show_bill') {
      const count = calculateScheduleOccurrences(
        customStartDate || getTodayFormattedStr(),
        selectedDuration as ScheduleDuration,
        customEndDate,
        isEveryDay ? [] : selectedDays
      );
      const totalAmt = count * grandTotal;
      promptMsg = language === 'ta'
        ? `${nativeName} அட்டவணை கட்டணம்: ${count} டெலிவரிகள். மொத்தத் தொகை ₹${totalAmt}. பாதுகாப்பு PIN சரிபார்ப்பிற்கு தொடரலாமா? "ஆம்" என்று சொல்லுங்கள்.`
        : language === 'hi'
        ? `${nativeName} का शेड्यूल बिल: ${count} डिलीवरी। कुल राशि ₹${totalAmt}। सुरक्षा पिन सत्यापन के लिए आगे बढ़ें? "हाँ" बोलें।`
        : `Schedule bill preview for ${item.name}: ${count} deliveries. Total ₹${totalAmt}. Proceed to Security PIN verification? Say "Yes".`;
    } else if (currentStep === 'verify_pin') {
      promptMsg = language === 'ta'
        ? 'பாதுகாப்பு PIN சரிபார்க்கிறோம், உங்கள் 4-இலக்க PIN-ஐ பதிவு செய்யுங்கள்.'
        : language === 'hi'
        ? 'सुरक्षा पिन सत्यापन: कृपया अपना 4-अंकीय पिन दर्ज करें।'
        : 'Security PIN verification. Please enter your 4-digit PIN.';
    } else if (currentStep === 'confirm_schedule') {
      promptMsg = language === 'ta'
        ? `அட்டவணை விவரங்களை உறுதிசெய்து உருவாக்கவா? "ஆம்" என்று சொல்லுங்கள்.`
        : language === 'hi'
        ? `क्या शेड्यूल बनाना सुनिश्चित करें? "हाँ" बोलें।`
        : `Confirm to create schedule? Say "Yes".`;
    }

    console.log(`[VoiceOrderDialogModal Step ${currentStep}]: Speaking prompt -> "${promptMsg}"`);

    SpeechService.stopListening();
    setIsListening(false);

    const fallbackDelay = Math.max(7000, promptMsg.length * 120 + 3000);
    const listeningFallbackTimer = setTimeout(() => {
      if (isComponentMounted.current && isOpen) {
        startListeningSession();
      }
    }, fallbackDelay);

    speakText(promptMsg, () => {
      clearTimeout(listeningFallbackTimer);
      if (isComponentMounted.current && isOpen) {
        startListeningSession();
      }
    });
  };

  useEffect(() => {
    isComponentMounted.current = true;
    return () => {
      isComponentMounted.current = false;
      SpeechService.stopListening();
    };
  }, []);

  useEffect(() => {
    if (isOpen && item) {
      setStep('ask_type');
      stepRef.current = 'ask_type';
      setLiveTranscript('');
      setPinDigits(['', '', '', '']);
      setPinError(null);

      const timer = setTimeout(() => {
        speakStepPrompt('ask_type');
      }, 100);

      return () => clearTimeout(timer);
    } else {
      SpeechService.stopListening();
    }
  }, [isOpen, item?.id, language]);

  // Validate 4-digit PIN via server-side verification
  const verifyPinAndProceed = async (pinStr: string) => {
    const isPinValid = await AuthService.verifyPIN(pinStr);
    if (isPinValid) {
      setPinError(null);
      const verifiedMsg = language === 'ta'
        ? 'பாதுகாப்பு PIN வெற்றிகரமாக சரிபார்க்கப்பட்டது!'
        : language === 'hi'
        ? 'सुरक्षा पिन सफलतापूर्वक सत्यापित हो गया!'
        : 'Security PIN Verified successfully!';
      
      showToast(verifiedMsg);

      setTimeout(() => {
        finalizeAndSaveSchedule();
      }, 500);
    } else {
      const errMsg = language === 'ta'
        ? 'தவறான PIN. மீண்டும் முயற்சிக்கவும்.'
        : language === 'hi'
        ? 'गलत पिन। कृपया पुन: प्रयास करें।'
        : 'Invalid PIN. Please try again.';
      setPinError(errMsg);
      setPinDigits(['', '', '', '']);
    }
  };

  // Multilingual Intent & Step Handler
  const processSpokenReply = (text: string, candidates: string[] = [text]) => {
    const activeStep = stepRef.current;
    const raw = (text || '').toLowerCase().replace(/[\.,!\?]/g, ' ').trim();

    console.log(`[processSpokenReply]: "${raw}" for step: "${activeStep}"`);

    // STEP 0: Ask Order Type Intent Matcher
    if (activeStep === 'ask_type') {
      const orderNowWords = [
        ...CONFIRMATION_VOCABULARY.ORDER_NOW.en,
        ...CONFIRMATION_VOCABULARY.ORDER_NOW.ta,
        ...CONFIRMATION_VOCABULARY.ORDER_NOW.hi
      ];
      const scheduleWords = [
        ...CONFIRMATION_VOCABULARY.SCHEDULE.en,
        ...CONFIRMATION_VOCABULARY.SCHEDULE.ta,
        ...CONFIRMATION_VOCABULARY.SCHEDULE.hi
      ];

      const matchOrderNow = SttMatcherService.matchVocabulary(candidates, orderNowWords, language);
      const matchSchedule = SttMatcherService.matchVocabulary(candidates, scheduleWords, language);

      if (matchOrderNow.isMatched || raw.includes('now') || raw.includes('instant') || raw.includes('இப்போதே') || raw.includes('ஆர்டர்')) {
        handleInstantOrder();
        return;
      }

      if (matchSchedule.isMatched || raw.includes('schedule') || raw.includes('later') || raw.includes('அட்டவணை') || raw.includes('திட்டமிடு')) {
        setStep('confirm_item');
        stepRef.current = 'confirm_item';
        speakStepPrompt('confirm_item');
        return;
      }
    }

    // STEP 1: Confirm Item Choice -> Move to Time
    if (activeStep === 'confirm_item') {
      const matchConfirm = SttMatcherService.matchConfirmation(candidates, language);
      if (matchConfirm.isMatched) {
        if (matchConfirm.matchedValue === 'YES') {
          setStep('ask_time');
          stepRef.current = 'ask_time';
          speakStepPrompt('ask_time');
        } else if (matchConfirm.matchedValue === 'NO') {
          handleCancelSchedule();
        }
      }
    }

    // STEP 2: Delivery Time -> Move to Frequency/Days
    if (activeStep === 'ask_time') {
      const parsed = parseSpokenTimeTo24Hr(text);
      if (parsed) {
        scheduleTimeInputRef.current = parsed.time24;
        setScheduleTimeInput(parsed.time24);
        setFormattedSpokenTime(parsed.time12Formatted);

        setStep('ask_frequency_days');
        stepRef.current = 'ask_frequency_days';
        speakStepPrompt('ask_frequency_days');
        return;
      }
    }

    // STEP 3: Frequency & Days -> Move to Duration
    if (activeStep === 'ask_frequency_days') {
      const daysMatch = SttMatcherService.matchDaysChoice(candidates, language);
      if (daysMatch.isMatched) {
        setIsEveryDay(daysMatch.isEveryDay);
        isEveryDayRef.current = daysMatch.isEveryDay;
        setSelectedDays(daysMatch.selectedDays);
        selectedDaysRef.current = daysMatch.selectedDays;

        setStep('ask_duration');
        stepRef.current = 'ask_duration';
        speakStepPrompt('ask_duration');
        return;
      }
    }

    // STEP 4: Duration Choice -> Move to Confirm Dates (or Custom Dates)
    if (activeStep === 'ask_duration') {
      const durMatch = SttMatcherService.matchDurationChoice(candidates, language);
      if (durMatch.isMatched && durMatch.matchedValue) {
        const dur = durMatch.matchedValue;
        setSelectedDuration(dur);
        selectedDurationRef.current = dur;

        if (dur === 'custom') {
          setStep('ask_custom_dates');
          stepRef.current = 'ask_custom_dates';
          speakStepPrompt('ask_custom_dates');
        } else {
          setStep('confirm_dates');
          stepRef.current = 'confirm_dates';
          speakStepPrompt('confirm_dates');
        }
        return;
      }
    }

    // STEP 4.5: Custom Dates -> Move to Confirm Dates
    if (activeStep === 'ask_custom_dates') {
      const matchConfirm = SttMatcherService.matchConfirmation(candidates, language);
      if (matchConfirm.isMatched && matchConfirm.matchedValue === 'YES') {
        setStep('confirm_dates');
        stepRef.current = 'confirm_dates';
        speakStepPrompt('confirm_dates');
      }
    }

    // STEP 5: Confirm Delivery Dates -> Move to Bill
    if (activeStep === 'confirm_dates') {
      const matchConfirm = SttMatcherService.matchConfirmation(candidates, language);
      if (matchConfirm.isMatched) {
        if (matchConfirm.matchedValue === 'YES') {
          setStep('show_bill');
          stepRef.current = 'show_bill';
          speakStepPrompt('show_bill');
        } else if (matchConfirm.matchedValue === 'NO') {
          setStep('ask_duration');
          stepRef.current = 'ask_duration';
          speakStepPrompt('ask_duration');
        }
      }
    }

    // STEP 6: Show Bill Preview -> Move to PIN
    if (activeStep === 'show_bill') {
      const matchConfirm = SttMatcherService.matchConfirmation(candidates, language);
      if (matchConfirm.isMatched && matchConfirm.matchedValue === 'YES') {
        setStep('verify_pin');
        stepRef.current = 'verify_pin';
        speakStepPrompt('verify_pin');
      } else if (matchConfirm.isMatched && matchConfirm.matchedValue === 'NO') {
        setStep('ask_duration');
        stepRef.current = 'ask_duration';
        speakStepPrompt('ask_duration');
      }
    }

    // STEP 7: Security PIN Verification
    if (activeStep === 'verify_pin') {
      const fourDigits = SpeechService.extractFourDigits(text);
      if (fourDigits && fourDigits.length === 4) {
        const fullPin = fourDigits.join('');
        setPinDigits(fourDigits);
        verifyPinAndProceed(fullPin);
        return;
      }
    }

    // STEP 8: Final Schedule Confirmation
    if (activeStep === 'confirm_schedule') {
      const matchConfirm = SttMatcherService.matchConfirmation(candidates, language);
      if (matchConfirm.isMatched) {
        if (matchConfirm.matchedValue === 'YES') {
          finalizeAndSaveSchedule();
        } else if (matchConfirm.matchedValue === 'NO') {
          handleCancelSchedule();
        }
      }
    }
  };

  const finalizeAndSaveSchedule = () => {
    if (!item) return;
    console.log('[VoiceOrderDialogModal] Creating & Saving schedule after PIN + Duration + Confirmation...');
    SpeechService.stopListening();
    setIsListening(false);

    const sDate = selectedDuration === 'custom' ? customStartDate : getTodayFormattedStr();
    const eDate = selectedDuration === 'custom' ? customEndDate : calculateScheduleEndDate(sDate, selectedDuration as any);
    const frequency = isEveryDay ? 'daily' : 'custom';

    const newSchedule = {
      id: `sched-${Date.now()}`,
      slotName: `Voice Schedule: ${item.name}`,
      slotIndex: 1 as const,
      time: scheduleTimeInput,
      frequency,
      selectedDays,
      foodItemId: item.id,
      foodItemName: item.name,
      restaurant: item.restaurant,
      quantity: 1,
      strategy: 'best_value' as const,
      isEnabled: true,
      walletAutoDebit: true,
      duration: selectedDuration as any,
      startDate: sDate,
      endDate: eDate
    };

    saveSchedule(newSchedule);

    const createdMsg = language === 'ta'
      ? `${item.name} அட்டவணை வெற்றிகரமாக உருவாக்கப்பட்டது!`
      : language === 'hi'
      ? `${item.name} का शेड्यूल सफलतापूर्वक बन गया!`
      : `Schedule created successfully for ${item.name}!`;

    speakText(createdMsg);
    showToast(createdMsg);
    onClose();
  };

  const handleInstantOrder = () => {
    if (!item) return;
    SpeechService.stopListening();
    setIsListening(false);
    placeInstantOrder(item);
    onClose();
  };

  const handleCancelSchedule = () => {
    SpeechService.stopListening();
    setIsListening(false);

    const cancelMsg = language === 'ta'
      ? 'அட்டவணை அமைப்பது ரத்து செய்யப்பட்டது.'
      : language === 'hi'
      ? 'शेड्यूल रद्द कर दिया गया।'
      : 'Schedule setup cancelled.';

    speakText(cancelMsg);
    onClose();
  };

  const toggleListening = () => {
    if (isListening) {
      SpeechService.stopListening();
      setIsListening(false);
    } else {
      startListeningSession();
    }
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl border-2 border-orange-500 relative space-y-4">
        
        {/* Close Button */}
        <button
          onClick={() => {
            SpeechService.stopListening();
            setIsListening(false);
            onClose();
          }}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 z-10 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-orange-100 dark:bg-orange-950 text-orange-600 rounded-2xl shrink-0">
            <Volume2 className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-black uppercase text-orange-600 tracking-wider">
                {language === 'ta' ? 'தானியங்கி குரல் உதவி' : language === 'hi' ? 'स्वचालित वॉइस असिस्टेंट' : 'Auto Voice Active'}
              </span>
              <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-400 shadow-sm flex items-center gap-1">
                <Mic className="w-3 h-3 text-yellow-300" /> Active Listening
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-0.5 leading-snug">
              {language === 'ta' ? (item.nativeNames?.ta || item.name) : language === 'hi' ? (item.nativeNames?.hi || item.name) : item.name}
            </h2>
          </div>
        </div>

        {/* STEP 0: Ask Order Type */}
        {step === 'ask_type' && (
          <div className="space-y-4">
            <div className="bg-orange-50 dark:bg-slate-800/80 p-4 sm:p-5 rounded-2xl border border-orange-200 text-center shadow-inner">
              <p className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-relaxed">
                {getVisualPromptText()}
              </p>
            </div>

            <div className="flex flex-col items-center justify-center space-y-2">
              <button
                type="button"
                onClick={toggleListening}
                className={`p-3.5 rounded-2xl flex items-center space-x-3 font-black shadow-md border cursor-pointer transition-all ${
                  isListening
                    ? 'bg-slate-900 text-white border-emerald-500 ring-2 ring-emerald-400'
                    : 'bg-slate-800 hover:bg-slate-700 text-yellow-300 border-slate-600'
                }`}
              >
                <Mic className={`w-5 h-5 ${isListening ? 'text-emerald-400 animate-pulse' : 'text-yellow-400'}`} />
                <span className="text-xs">
                  {isListening
                    ? (language === 'ta' ? 'தானியங்கியாகக் கேட்கிறது: "இப்போதே ஆர்டர் செய்" அல்லது "அட்டவணைப்படுத்து"' : 'Listening automatically: Say "Order Now" or "Schedule"')
                    : (language === 'ta' ? 'மைக் தொடங்க தட்டவும் (Tap to Listen)' : 'Mic Paused — Tap to Start Listening')}
                </span>
              </button>

              {liveTranscript && (
                <p className="text-xs text-center text-orange-600 dark:text-orange-400 font-black">
                  Detected Voice Speech: "{liveTranscript}"
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleInstantOrder}
                className="p-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm shadow-lg flex flex-col items-center justify-center space-y-1 transform active:scale-95 cursor-pointer"
              >
                <Zap className="w-6 h-6 text-yellow-300" />
                <span>{language === 'ta' ? 'இப்போதே ஆர்டர் செய்' : language === 'hi' ? 'अभी ऑर्डर करें' : 'Order Instantly Now'}</span>
              </button>

              <button
                onClick={() => {
                  setStep('confirm_item');
                  stepRef.current = 'confirm_item';
                  speakStepPrompt('confirm_item');
                }}
                className="p-4 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black text-sm shadow-lg flex flex-col items-center justify-center space-y-1 transform active:scale-95 cursor-pointer"
              >
                <Clock className="w-6 h-6 text-white" />
                <span>{language === 'ta' ? 'நேரத்திற்கு அட்டவணைப்படுத்து' : language === 'hi' ? 'बाद के लिए शेड्यूल करें' : 'Schedule for Later'}</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 1: Confirm Item */}
        {step === 'confirm_item' && (
          <div className="space-y-4">
            <div className="bg-orange-50 dark:bg-slate-800/80 p-4 sm:p-5 rounded-2xl border border-orange-200 text-center space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-orange-600">
                {language === 'ta' ? 'படி 1: உணவு சரிபார்ப்பு' : language === 'hi' ? 'चरण 1: भोजन आइटम की पुष्टि' : 'Step 1: Item Verification'}
              </span>
              <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
                {language === 'ta'
                  ? `${item.nativeNames?.ta || item.name} (${item.restaurant}) என்ற உணவு சரியாக உள்ளதா?`
                  : language === 'hi'
                  ? `क्या ${item.restaurant} से ${item.nativeNames?.hi || item.name} सही आइटम है?`
                  : `Is ${item.name} from ${item.restaurant} the correct item to schedule?`}
              </p>
              <p className="text-xs font-bold text-orange-600 dark:text-orange-400">
                {language === 'ta' ? '📢 "ஆம் / சரி" அல்லது "இல்லை / வேண்டாம்" என்று பேசவும்!' : language === 'hi' ? '📢 "हाँ / ठीक है" या "नहीं / मना" बोलें!' : '📢 Say "Yes / Confirm" or "No / Cancel" out loud!'}
              </p>
            </div>

            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="p-3 bg-slate-900 text-white rounded-2xl flex items-center space-x-3 font-black shadow-md border border-slate-700">
                <Mic className="w-5 h-5 text-yellow-400 animate-pulse" />
                <span className="text-xs">
                  {language === 'ta' ? 'கேட்கிறது: "ஆம்" அல்லது "இல்லை" என்று சொல்லுங்கள்' : language === 'hi' ? 'सुन रहा है: "हाँ" या "नहीं" बोलें' : 'Listening: Say "Yes" or "No"'}
                </span>
              </div>
              {liveTranscript && (
                <p className="text-xs text-center text-orange-600 dark:text-orange-400 font-black">
                  Detected Voice Speech: "{liveTranscript}"
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={handleCancelSchedule}
                className="py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-sm shadow-md flex items-center justify-center space-x-2 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
                <span>{language === 'ta' ? 'இல்லை / ரத்து' : language === 'hi' ? 'नहीं / रद्द' : 'No / Cancel'}</span>
              </button>

              <button
                onClick={() => {
                  setStep('ask_time');
                  stepRef.current = 'ask_time';
                  speakStepPrompt('ask_time');
                }}
                className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm shadow-md flex items-center justify-center space-x-2 cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5 text-yellow-300" />
                <span>{language === 'ta' ? 'ஆம் / சரி' : language === 'hi' ? 'हाँ / सही' : 'Yes / Correct'}</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Ask Schedule Time */}
        {step === 'ask_time' && (
          <div className="space-y-4">
            <div className="bg-orange-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-orange-200 text-center space-y-1">
              <span className="text-xs font-black uppercase tracking-wider text-orange-600">
                {language === 'ta' ? 'படி 2: நேரத்தைத் தேர்வு செய்தல்' : language === 'hi' ? 'चरण 2: समय का चयन' : 'Step 2: Pick Delivery Time'}
              </span>
              <p className="text-base font-black text-slate-900 dark:text-white leading-relaxed">
                {language === 'ta'
                  ? `${item.nativeNames?.ta || item.name} எந்த நேரத்திற்கு அட்டவணைப்படுத்த வேண்டும்? (உதாரணம்: காலை 8 மணி, மாலை 8 மணி)`
                  : language === 'hi'
                  ? `${item.nativeNames?.hi || item.name} किस समय शेड्यूल करना चाहते हैं? (जैसे: सुबह 8 बजे, शाम 8 बजे)`
                  : `What time would you like to schedule ${item.name}? (e.g., 8 AM, 8 PM)`}
              </p>
            </div>

            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="p-3 bg-slate-900 text-white rounded-2xl flex items-center space-x-3 font-black shadow-md border border-slate-700">
                <Mic className="w-5 h-5 text-yellow-400 animate-pulse" />
                <span className="text-xs">
                  {language === 'ta' ? 'நேரத்தைச் சொல்லுங்கள் (காலை 8 மணி / மாலை 8 மணி)...' : language === 'hi' ? 'समय बोलें (जैसे सुबह 8 बजे)...' : 'Say time aloud (e.g., 8 AM)...'}
                </span>
              </div>
              {liveTranscript && (
                <p className="text-xs text-center text-orange-600 dark:text-orange-400 font-black">
                  Detected Voice Speech: "{liveTranscript}"
                </p>
              )}
            </div>

            <div className="space-y-2 pt-1">
              <label className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                {language === 'ta' ? 'அல்லது கைமுறையாக நேரம் தேர்ந்தெடுக்கவும்:' : language === 'hi' ? 'या स्वयं समय चुनें:' : 'Or Select Schedule Time Manually:'}
              </label>
              <input
                type="time"
                value={scheduleTimeInput}
                onChange={e => {
                  const val = e.target.value;
                  const parsed = parseSpokenTimeTo24Hr(val);
                  setScheduleTimeInput(val);
                  setFormattedSpokenTime(parsed ? parsed.time12Formatted : val);
                }}
                className="w-full p-3 rounded-2xl border border-slate-300 dark:border-slate-700 font-black text-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-center cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  setStep('confirm_item');
                  stepRef.current = 'confirm_item';
                  speakStepPrompt('confirm_item');
                }}
                className="py-3 px-4 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 rounded-2xl font-black text-sm cursor-pointer"
              >
                {language === 'ta' ? 'முந்தைய படி' : language === 'hi' ? 'पीछे जाएँ' : 'Back'}
              </button>
              <button
                onClick={() => {
                  setStep('ask_frequency_days');
                  stepRef.current = 'ask_frequency_days';
                  speakStepPrompt('ask_frequency_days');
                }}
                className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm shadow-md flex items-center justify-center space-x-2 cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5 text-yellow-300" />
                <span>{language === 'ta' ? 'தொடரவும்' : language === 'hi' ? 'आगे बढ़ें' : 'Proceed'}</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Ask Days / Frequency (Daily vs Weekly) */}
        {step === 'ask_frequency_days' && (
          <div className="space-y-4">
            <div className="bg-orange-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-orange-200 text-center space-y-1">
              <span className="text-xs font-black uppercase tracking-wider text-orange-600">
                {language === 'ta' ? 'படி 3: தினமும் அல்லது வாராந்திர நாட்கள்' : language === 'hi' ? 'चरण 3: प्रतिदिन या साप्ताहिक दिन' : 'Step 3: Daily vs Weekly Days'}
              </span>
              <p className="text-base font-black text-slate-900 dark:text-white leading-relaxed">
                {language === 'ta'
                  ? 'இதை தினமும் (Daily) ஆர்டர் செய்யவா, அல்லது வாராந்திர குறிப்பிட்ட நாட்களில் (Weekly) மட்டும் செய்யவா?'
                  : language === 'hi'
                  ? 'क्या इसे रोजाना (Daily) ऑर्डर करें, या हफ्ते के विशिष्ट दिनों (Weekly) में?'
                  : 'Should I order this every day (Daily), or only on specific days like Mondays and Fridays (Weekly)?'}
              </p>
            </div>

            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="p-3 bg-slate-900 text-white rounded-2xl flex items-center space-x-3 font-black shadow-md border border-slate-700">
                <Mic className="w-5 h-5 text-yellow-400 animate-pulse" />
                <span className="text-xs">
                  {language === 'ta' ? 'கேட்கிறது: "தினமும்" அல்லது குறிப்பிட்ட நாட்கள்' : language === 'hi' ? 'सुन रहा है: "प्रतिदिन" या "साप्ताहिक"' : 'Listening: Say "Daily" or "Weekly"'}
                </span>
              </div>
              {liveTranscript && (
                <p className="text-xs text-center text-orange-600 dark:text-orange-400 font-black">
                  Detected Voice Speech: "{liveTranscript}"
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => {
                  setIsEveryDay(true);
                  isEveryDayRef.current = true;
                  setSelectedDays([]);
                  selectedDaysRef.current = [];
                  setStep('ask_duration');
                  stepRef.current = 'ask_duration';
                  speakStepPrompt('ask_duration');
                }}
                className="p-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs shadow-lg flex flex-col items-center justify-center space-y-1 cursor-pointer transition-all active:scale-95"
              >
                <CheckCircle2 className="w-5 h-5 text-yellow-300" />
                <span>{language === 'ta' ? 'தினமும் (Every Day / Daily)' : language === 'hi' ? 'प्रतिदिन (Daily)' : 'Every Day (Daily)'}</span>
              </button>

              <button
                onClick={() => {
                  setIsEveryDay(false);
                  isEveryDayRef.current = false;
                  if (selectedDays.length === 0) {
                    setSelectedDays(['Mon', 'Wed', 'Fri']);
                    selectedDaysRef.current = ['Mon', 'Wed', 'Fri'];
                  }
                }}
                className={`p-4 rounded-2xl font-black text-xs shadow-lg flex flex-col items-center justify-center space-y-1 cursor-pointer transition-all active:scale-95 ${
                  !isEveryDay ? 'bg-orange-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                }`}
              >
                <Clock className="w-5 h-5" />
                <span>{language === 'ta' ? 'வாராந்திர நாட்கள் (Weekly / Custom)' : language === 'hi' ? 'साप्ताहिक दिन (Weekly / Custom)' : 'Weekly Days (Custom)'}</span>
              </button>
            </div>

            {!isEveryDay && (
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <WeekdaySelector
                  selectedDays={selectedDays}
                  onChange={(days) => {
                    setSelectedDays(days);
                    selectedDaysRef.current = days;
                  }}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  setStep('ask_time');
                  stepRef.current = 'ask_time';
                  speakStepPrompt('ask_time');
                }}
                className="py-3 px-4 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 rounded-2xl font-black text-sm cursor-pointer"
              >
                {language === 'ta' ? 'முந்தைய படி' : language === 'hi' ? 'पीछे जाएँ' : 'Back'}
              </button>
              <button
                onClick={() => {
                  if (!isEveryDay && selectedDays.length === 0) {
                    showToast(t('pickOneDay'), 'warning');
                    return;
                  }
                  setStep('ask_duration');
                  stepRef.current = 'ask_duration';
                  speakStepPrompt('ask_duration');
                }}
                className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm shadow-md flex items-center justify-center space-x-2 cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5 text-yellow-300" />
                <span>{language === 'ta' ? 'நாட்களை உறுதிசெய்து தொடரவும்' : language === 'hi' ? 'दिनों की पुष्टि करें और आगे बढ़ें' : 'Confirm Days & Continue'}</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Ask Recurrence Duration */}
        {step === 'ask_duration' && (
          <div className="space-y-4">
            <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-2xl border border-emerald-300 text-center space-y-1">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                {language === 'ta' ? 'படி 4: அட்டவணை காலம்' : language === 'hi' ? 'चरण 4: अवधि' : 'Step 4: Recurrence Duration'}
              </span>
              <p className="text-base font-black text-slate-900 dark:text-white leading-relaxed">
                {language === 'ta'
                  ? 'இந்த அட்டவணை எவ்வளவு காலத்திற்கு தொடர வேண்டும்? (1 வாரம், 1 மாதம், 3 மாதங்கள், அல்லது சுயவிருப்ப தேதி வரம்பு)'
                  : language === 'hi'
                  ? 'यह शेड्यूल कितने समय तक जारी रखना चाहते हैं? (1 हफ्ता, 1 महीना, 3 महीने, या कस्टम तिथि सीमा)'
                  : 'For how long would you like to repeat this schedule? (1 Week, 1 Month, 3 Months, or Custom Date Range)'}
              </p>
            </div>

            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="p-3 bg-slate-900 text-white rounded-2xl flex items-center space-x-3 font-black shadow-md border border-slate-700">
                <Mic className="w-5 h-5 text-yellow-400" />
                <span className="text-xs">
                  {language === 'ta'
                    ? 'காலத்தைச் சொல்லுங்கள் (1 வாரம் / 1 மாதம் / சுயவிருப்ப தேதி)...'
                    : language === 'hi'
                    ? 'अवधि बोलें (1 हफ्ता / 1 महीना / कस्टम तारीख)...'
                    : 'Speak duration aloud (e.g., 1 week, 1 month, custom range)...'}
                </span>
              </div>

              {liveTranscript && (
                <p className="text-xs text-center text-orange-600 dark:text-orange-400 font-black">
                  Detected Voice Speech: "{liveTranscript}"
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {[
                { key: '1_week', labelEn: '1 Week (7 Days)', labelTa: '1 வாரம் (7 நாட்கள்)', labelHi: '1 हफ्ता (7 दिन)' },
                { key: '1_month', labelEn: '1 Month (30 Days)', labelTa: '1 மாதம் (30 நாட்கள்)', labelHi: '1 महीना (30 दिन)' },
                { key: '3_months', labelEn: '3 Months (90 Days)', labelTa: '3 மாதங்கள் (90 நாட்கள்)', labelHi: '3 महीने (90 दिन)' },
                { key: 'custom', labelEn: '📅 Custom Date Range', labelTa: '📅 சுயவிருப்ப தேதி வரம்பு', labelHi: '📅 कस्टम तिथि सीमा' }
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => {
                    setSelectedDuration(opt.key);
                    selectedDurationRef.current = opt.key;
                    if (opt.key === 'custom') {
                      setStep('ask_custom_dates');
                      stepRef.current = 'ask_custom_dates';
                      speakStepPrompt('ask_custom_dates');
                    } else {
                      setStep('confirm_dates');
                      stepRef.current = 'confirm_dates';
                      speakStepPrompt('confirm_dates');
                    }
                  }}
                  className={`p-3.5 rounded-2xl font-black text-xs shadow transition-all cursor-pointer text-center ${
                    opt.key === 'custom'
                      ? 'bg-orange-600 hover:bg-orange-700 text-white col-span-2'
                      : 'bg-slate-100 hover:bg-emerald-600 hover:text-white dark:bg-slate-800 text-slate-900 dark:text-white'
                  }`}
                >
                  {language === 'ta' ? opt.labelTa : language === 'hi' ? opt.labelHi : opt.labelEn}
                </button>
              ))}
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  setStep('ask_frequency_days');
                  stepRef.current = 'ask_frequency_days';
                  speakStepPrompt('ask_frequency_days');
                }}
                className="w-full py-3 px-4 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 rounded-2xl font-black text-sm cursor-pointer"
              >
                {language === 'ta' ? 'முந்தைய படி' : language === 'hi' ? 'पीछे जाएँ' : 'Back'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4.5: Custom Date Range Inputs */}
        {step === 'ask_custom_dates' && (
          <div className="space-y-4">
            <div className="bg-orange-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-orange-200 text-center space-y-1">
              <span className="text-xs font-black uppercase tracking-wider text-orange-600">
                {language === 'ta' ? 'சுயவிருப்ப தேதி வரம்பு அமைத்தல்' : language === 'hi' ? 'कस्टम तिथि सीमा तय करें' : 'Custom Date Range Picker'}
              </span>
              <p className="text-base font-black text-slate-900 dark:text-white">
                {language === 'ta'
                  ? 'ஆரம்ப தேதி மற்றும் முடிவு தேதியைத் தேர்ந்தெடுக்கவும் அல்லது குரல் மூலம் கூறவும்:'
                  : language === 'hi'
                  ? 'प्रारंभ तिथि और अंतिम तिथि चुनें या आवाज़ से बोलें:'
                  : 'Select Start Date and End Date (or speak date out loud):'}
              </p>
            </div>

            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="p-3 bg-slate-900 text-white rounded-2xl flex items-center space-x-3 font-black shadow-md border border-slate-700">
                <Mic className="w-5 h-5 text-yellow-400 animate-pulse" />
                <span className="text-xs">
                  {language === 'ta' ? 'தேதியைச் சொல்லுங்கள் (எ.கா: "நாளை", "அடுத்த திங்கள்")...' : language === 'hi' ? 'तारीख बोलें (जैसे: "कल", "अगला सोमवार")...' : 'Speak date (e.g., "tomorrow", "next Monday")...'}
                </span>
              </div>
              {liveTranscript && (
                <p className="text-xs text-center text-orange-600 dark:text-orange-400 font-black">
                  Detected Voice Speech: "{liveTranscript}"
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase">
                  {language === 'ta' ? 'ஆரம்ப தேதி (Start Date):' : language === 'hi' ? 'प्रारंभ तिथि:' : 'Start Date:'}
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  min={getTodayFormattedStr()}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="w-full p-3 rounded-2xl border border-slate-300 dark:border-slate-700 font-black text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase">
                  {language === 'ta' ? 'முடிவு தேதி (End Date):' : language === 'hi' ? 'अंतिम तिथि:' : 'End Date:'}
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  min={customStartDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="w-full p-3 rounded-2xl border border-slate-300 dark:border-slate-700 font-black text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  setStep('ask_duration');
                  stepRef.current = 'ask_duration';
                  speakStepPrompt('ask_duration');
                }}
                className="py-3 px-4 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 rounded-2xl font-black text-sm cursor-pointer"
              >
                {language === 'ta' ? 'முந்தைய படி' : language === 'hi' ? 'पीछे जाएँ' : 'Back'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('confirm_dates');
                  stepRef.current = 'confirm_dates';
                  speakStepPrompt('confirm_dates');
                }}
                className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm shadow-lg flex items-center justify-center space-x-2 cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5 text-yellow-300" />
                <span>
                  {language === 'ta' ? 'தேதி வரம்பை உறுதிசெய்க' : language === 'hi' ? 'तिथि सीमा की पुष्टि करें' : 'Confirm Date Range'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Confirm Computed Delivery Dates List */}
        {step === 'confirm_dates' && (
          <div className="space-y-4">
            {(() => {
              const occurrences = calculateScheduleDatesList(
                customStartDate || getTodayFormattedStr(),
                selectedDuration as ScheduleDuration,
                customEndDate,
                isEveryDay ? [] : selectedDays
              );

              return (
                <>
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-2xl border border-emerald-300 text-center space-y-1">
                    <div className="flex items-center justify-center space-x-2 text-emerald-700 dark:text-emerald-300">
                      <Calendar className="w-5 h-5" />
                      <span className="text-xs font-black uppercase tracking-wider">
                        {language === 'ta' ? 'படி 5: டெலிவரி தேதிகள் சரிபார்ப்பு' : language === 'hi' ? 'चरण 5: डिलीवरी तिथियां सत्यापन' : 'Step 5: Delivery Dates Verification'}
                      </span>
                    </div>
                    <p className="text-base font-black text-slate-900 dark:text-white leading-snug">
                      {language === 'ta'
                        ? `மொத்தம் ${occurrences.length} டெலிவரி தேதிகள் கணக்கிடப்பட்டுள்ளன. விவரங்கள் கீழே:`
                        : language === 'hi'
                        ? `कुल ${occurrences.length} डिलीवरी की तारीखें हैं। विवरण नीचे दिए गए हैं:`
                        : `Total ${occurrences.length} delivery dates calculated. Review below:`}
                    </p>
                  </div>

                  {/* Computed Dates List Grid */}
                  <div className="max-h-40 overflow-y-auto p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="flex flex-wrap gap-2 justify-center">
                      {occurrences.map((d, i) => (
                        <span key={i} className="px-2.5 py-1 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="p-3 bg-slate-900 text-white rounded-2xl flex items-center space-x-3 font-black shadow-md border border-slate-700">
                      <Mic className="w-5 h-5 text-yellow-400 animate-pulse" />
                      <span className="text-xs">
                        {language === 'ta' ? 'கேட்கிறது: "ஆம்" அல்லது "இல்லை" என்று சொல்லுங்கள்' : language === 'hi' ? 'सुन रहा है: "हाँ" या "नहीं" बोलें' : 'Listening: Say "Yes" or "No"'}
                      </span>
                    </div>
                    {liveTranscript && (
                      <p className="text-xs text-center text-orange-600 dark:text-orange-400 font-black">
                        Detected Voice Speech: "{liveTranscript}"
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      onClick={() => {
                        setStep('ask_duration');
                        stepRef.current = 'ask_duration';
                        speakStepPrompt('ask_duration');
                      }}
                      className="py-3 px-4 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 rounded-2xl font-black text-sm cursor-pointer"
                    >
                      {language === 'ta' ? 'மாற்று (Edit)' : language === 'hi' ? 'बदलें (Edit)' : 'Edit Duration'}
                    </button>

                    <button
                      onClick={() => {
                        setStep('show_bill');
                        stepRef.current = 'show_bill';
                        speakStepPrompt('show_bill');
                      }}
                      className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm shadow-md flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-5 h-5 text-yellow-300" />
                      <span>{language === 'ta' ? 'கட்டணம் காண்க (Proceed)' : language === 'hi' ? 'बिल देखें (Proceed)' : 'Proceed to Bill'}</span>
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* STEP 6: Show Bill Breakdown */}
        {step === 'show_bill' && (
          <div className="space-y-4">
            <div className="text-center">
              <span className="text-xs font-black uppercase tracking-wider text-orange-600">
                {language === 'ta' ? 'படி 6: கட்டணப் பட்டியல்' : language === 'hi' ? 'चरण 6: बिल विवरण' : 'Step 6: Bill Breakdown'}
              </span>
            </div>

            {/* Shared Schedule Bill Component */}
            <ScheduleBill
              items={[{ foodItem: item, quantity: 1 }]}
              time={scheduleTimeInput}
              frequency={isEveryDay ? 'daily' : 'weekly'}
              duration={selectedDuration as ScheduleDuration}
              startDate={customStartDate}
              endDate={customEndDate}
            />

            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="p-3 bg-slate-900 text-white rounded-2xl flex items-center space-x-3 font-black shadow-md border border-slate-700">
                <Mic className="w-5 h-5 text-yellow-400 animate-pulse" />
                <span className="text-xs">
                  {language === 'ta' ? 'கேட்கிறது: PIN சரிபார்க்க "ஆம்" என்று சொல்லுங்கள்' : language === 'hi' ? 'सुन रहा है: PIN के लिए "हाँ" बोलें' : 'Listening: Say "Yes" to enter Security PIN'}
                </span>
              </div>
              {liveTranscript && (
                <p className="text-xs text-center text-orange-600 dark:text-orange-400 font-black">
                  Detected Voice Speech: "{liveTranscript}"
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => {
                  setStep('ask_duration');
                  stepRef.current = 'ask_duration';
                  speakStepPrompt('ask_duration');
                }}
                className="py-3 px-4 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 rounded-2xl font-black text-sm cursor-pointer"
              >
                {language === 'ta' ? 'மாற்று (Back)' : language === 'hi' ? 'बदलें (Back)' : 'Back to Edit'}
              </button>

              <button
                onClick={() => {
                  setStep('verify_pin');
                  stepRef.current = 'verify_pin';
                  speakStepPrompt('verify_pin');
                }}
                className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm shadow-md flex items-center justify-center space-x-2 cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5 text-yellow-300" />
                <span>{language === 'ta' ? 'PIN சரிபார் (Proceed)' : language === 'hi' ? 'PIN दर्ज करें (Proceed)' : 'Proceed to Security PIN'}</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 7: Security PIN Verification (AFTER Bill Breakdown) */}
        {step === 'verify_pin' && (
          <div className="space-y-4">
            <div className="bg-orange-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-orange-200 text-center space-y-1">
              <div className="flex items-center justify-center space-x-2 text-orange-600">
                <ShieldCheck className="w-5 h-5" />
                <span className="text-xs font-black uppercase tracking-wider">
                  {language === 'ta' ? 'படி 7: பாதுகாப்பு PIN சரிபார்ப்பு' : language === 'hi' ? 'चरण 7: सुरक्षा पिन सत्यापन' : 'Step 7: Security PIN Verification'}
                </span>
              </div>
              <p className="text-base font-black text-slate-900 dark:text-white leading-relaxed">
                {language === 'ta'
                  ? 'உங்கள் 4-இலக்க PIN-ஐ விசைப்பலகை மூலம் உள்ளிடவும்'
                  : language === 'hi'
                  ? 'कृपया अपना 4-अंकीय सुरक्षा PIN दर्ज करें'
                  : 'Please enter your 4-digit Security PIN to proceed'}
              </p>
            </div>

            {/* PIN Display Boxes */}
            <div className="flex justify-center items-center space-x-3 py-2">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-12 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl font-black transition-all ${
                    pinDigits[idx]
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-md'
                      : 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  {pinDigits[idx] ? '●' : ''}
                </div>
              ))}
            </div>

            {pinError && (
              <p className="text-xs text-center font-black text-rose-600 dark:text-rose-400 animate-bounce">
                {pinError}
              </p>
            )}

            {/* Onscreen Keypad */}
            <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    setPinError(null);
                    const emptyIdx = pinDigits.findIndex(d => d === '');
                    if (emptyIdx !== -1) {
                      const next = [...pinDigits];
                      next[emptyIdx] = num.toString();
                      setPinDigits(next);
                      if (emptyIdx === 3) {
                        verifyPinAndProceed(next.join(''));
                      }
                    }
                  }}
                  className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-black text-lg text-slate-900 dark:text-white rounded-2xl shadow transition-all cursor-pointer"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setPinDigits(['', '', '', '']);
                  setPinError(null);
                }}
                className="p-3 bg-rose-100 dark:bg-rose-950 text-rose-600 font-black text-xs rounded-2xl shadow cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  setPinError(null);
                  const emptyIdx = pinDigits.findIndex(d => d === '');
                  if (emptyIdx !== -1) {
                    const next = [...pinDigits];
                    next[emptyIdx] = '0';
                    setPinDigits(next);
                    if (emptyIdx === 3) {
                      verifyPinAndProceed(next.join(''));
                    }
                  }
                }}
                className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-black text-lg text-slate-900 dark:text-white rounded-2xl shadow transition-all cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => {
                  const full = pinDigits.join('');
                  if (full.length === 4) verifyPinAndProceed(full);
                }}
                className="p-3 bg-emerald-600 text-white font-black text-xs rounded-2xl shadow cursor-pointer flex items-center justify-center"
              >
                <CheckCircle2 className="w-5 h-5 text-yellow-300" />
              </button>
            </div>

            <div className="pt-2 text-center">
              <button
                onClick={() => {
                  setStep('show_bill');
                  stepRef.current = 'show_bill';
                  speakStepPrompt('show_bill');
                }}
                className="py-2.5 px-4 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 rounded-2xl font-black text-xs cursor-pointer"
              >
                {language === 'ta' ? 'கட்டணத்திற்குத் திரும்பு' : language === 'hi' ? 'बिल पर वापस जाएँ' : 'Back to Bill'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
