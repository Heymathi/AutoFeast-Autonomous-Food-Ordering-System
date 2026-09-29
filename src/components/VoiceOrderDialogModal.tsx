import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { FoodItem } from '../types';
import { SpeechService } from '../services/speechService';
import { SttMatcherService, CONFIRMATION_VOCABULARY } from '../services/sttMatcherService';
import { calculateScheduleEndDate } from '../services/autoOrderBackgroundService';
import { Mic, MicOff, X, Zap, Clock, Volume2, Sparkles, CheckCircle2, XCircle, FileText, Receipt, ShieldCheck } from 'lucide-react';

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
  | 'show_bill'
  | 'ask_time'
  | 'confirm_time'
  | 'ask_duration'
  | 'ask_frequency_days'
  | 'confirm_schedule';

export const VoiceOrderDialogModal: React.FC<VoiceOrderDialogModalProps> = ({
  item,
  isOpen,
  onClose
}) => {
  const { placeInstantOrder, saveSchedule, language, speakText, setActiveView } = useApp();
  const [step, setStep] = useState<VoiceDialogStep>('ask_type');
  const [scheduleTimeInput, setScheduleTimeInput] = useState('08:00');
  const [formattedSpokenTime, setFormattedSpokenTime] = useState('8:00 AM');
  const [selectedDuration, setSelectedDuration] = useState<string>('1_month');
  const [selectedDurationLabel, setSelectedDurationLabel] = useState<string>('1 Month (30 Days)');
  const [isEveryDay, setIsEveryDay] = useState<boolean>(true);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const isComponentMounted = useRef<boolean>(false);

  // 🚀 REFS TO PREVENT STALE CLOSURE IN SPEECHRECOGNITION CALLBACKS
  const stepRef = useRef<VoiceDialogStep>(step);
  const scheduleTimeInputRef = useRef<string>(scheduleTimeInput);
  const selectedDurationRef = useRef<string>(selectedDuration);
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
    } else if (currentStep === 'show_bill') {
      promptMsg = language === 'ta'
        ? `${nativeName} உணவுக்கான மதிப்பீட்டுக் கட்டண விவரம்: உணவு ₹${foodPrice} + டெலிவரி மற்றும் வரிகள் ₹${deliveryFee + taxAndFees}. மொத்தத் தொகை ₹${grandTotal}. நேரத்தைத் தேர்வு செய்யத் தொடரலாமா? "ஆம்" என்று சொல்லுங்கள்.`
        : language === 'hi'
        ? `${nativeName} का अनुमानित बिल: भोजन ₹${foodPrice} + डिलीवरी और टैक्स ₹${deliveryFee + taxAndFees}। कुल राशि ₹${grandTotal}। क्या समय चुनने के लिए आगे बढ़ें? "हाँ" बोलें।`
        : `Estimated bill preview for ${item.name}: Food ₹${foodPrice} + Delivery & Fees ₹${deliveryFee + taxAndFees}. Total ₹${grandTotal}. Proceed to pick schedule time? Say "Yes".`;
    } else if (currentStep === 'ask_time') {
      promptMsg = language === 'ta'
        ? `${nativeName} எந்த நேரத்திற்கு அட்டவணைப்படுத்த வேண்டும்? (எடுத்துக்காட்டாக காலை 8 மணி, மாலை 8 மணி)`
        : language === 'hi'
        ? `${nativeName} किस समय शेड्यूल करना चाहते हैं? (जैसे: सुबह 8 बजे, शाम 8 बजे)`
        : `What time would you like to schedule ${item.name}? (e.g., 8 AM, 8 PM)`;
    } else if (currentStep === 'confirm_time') {
      promptMsg = language === 'ta'
        ? `${nativeName} ${timeStr}-க்கு அட்டவணைப்படுத்தப்படவுள்ளது. "சரி" அல்லது "ஆம்" என்று சொல்லுங்கள்!`
        : language === 'hi'
        ? `क्या आप ${nativeName} को ${timeStr} पर शेड्यूल करना चाहते हैं? "हाँ" कहें!`
        : `Scheduling ${item.name} at ${timeStr}. Say "yes" or "confirm" to finalize!`;
    } else if (currentStep === 'ask_duration') {
      promptMsg = language === 'ta'
        ? 'இந்த அட்டவணை எவ்வளவு காலத்திற்கு தொடர வேண்டும்? (இன்று மட்டும், 1 வாரம், 1 மாதம், 3 மாதங்கள்)'
        : language === 'hi'
        ? 'यह शेड्यूल कितने समय तक जारी रखना चाहते हैं? (केवल आज, 1 हफ्ता, 1 महीना, 3 महीने)'
        : 'For how long would you like to repeat this schedule? (e.g. today alone, 1 week, 1 month, 3 months)';
    } else if (currentStep === 'ask_frequency_days') {
      promptMsg = language === 'ta'
        ? 'இதை தினமும் ஆர்டர் செய்யவா, அல்லது வாராந்திர குறிப்பிட்ட நாட்களில் மட்டும் செய்யவா?'
        : language === 'hi'
        ? 'क्या इसे रोजाना (Daily) ऑर्डर करें, या हफ्ते के विशिष्ट दिनों (Weekly) में?'
        : 'Should I order this every day, or only on specific days like Mondays and Fridays?';
    } else if (currentStep === 'confirm_schedule') {
      const durLabel = selectedDuration === 'today_only'
        ? (language === 'ta' ? 'இன்று மட்டும்' : language === 'hi' ? 'केवल आज' : 'Today alone')
        : selectedDuration === '1_week'
        ? (language === 'ta' ? '1 வாரம்' : language === 'hi' ? '1 हफ्ता' : '1 Week')
        : selectedDuration === '1_month'
        ? (language === 'ta' ? '1 மாதம்' : language === 'hi' ? '1 महीना' : '1 Month')
        : (language === 'ta' ? '3 மாதங்கள்' : language === 'hi' ? '3 महीने' : '3 Months');

      const freqLabel = isEveryDay
        ? (language === 'ta' ? 'தினமும்' : language === 'hi' ? 'प्रतिदिन' : 'Every Day')
        : (language === 'ta' ? 'குறிப்பிட்ட நாட்கள்' : language === 'hi' ? 'விशिष्ट दिन' : 'Specific Days');

      promptMsg = language === 'ta'
        ? `இறுதி உறுதிப்படுத்தல்: ${nativeName} ${timeStr}-க்கு, ${durLabel}, ${freqLabel} அட்டவணைப்படுத்தப்படுகிறது. மொத்தத் தொகை ₹${grandTotal}. 4-இலக்க PIN மூலம் உறுதிப்படுத்தவா? "ஆம்" என்று சொல்லுங்கள்.`
        : language === 'hi'
        ? `अंतिम पुष्टि: ${nativeName} का ${timeStr} बजे, ${durLabel}, ${freqLabel} शेड्यूल तैयार है। कुल बिल ₹${grandTotal}। क्या 4-अंकीय PIN से पुष्टि करें? "हाँ" बोलें।`
        : `Final Confirmation: Scheduling ${item.name} at ${timeStr} (${durLabel}, ${freqLabel}). Total bill ₹${grandTotal}. Proceed to confirm with 4-digit PIN? Say "Yes".`;
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

      const timer = setTimeout(() => {
        speakStepPrompt('ask_type');
      }, 100);

      return () => clearTimeout(timer);
    } else {
      SpeechService.stopListening();
    }
  }, [isOpen, item?.id, language]);

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

    // STEP 1: Confirm Item Choice
    if (activeStep === 'confirm_item') {
      const matchConfirm = SttMatcherService.matchConfirmation(candidates, language);
      if (matchConfirm.isMatched) {
        if (matchConfirm.matchedValue === 'YES') {
          setStep('show_bill');
          stepRef.current = 'show_bill';
          speakStepPrompt('show_bill');
        } else if (matchConfirm.matchedValue === 'NO') {
          handleCancelSchedule();
        }
      }
    }

    // STEP 2: Show Bill Preview & Proceed to Time
    if (activeStep === 'show_bill') {
      const matchConfirm = SttMatcherService.matchConfirmation(candidates, language);
      if (matchConfirm.isMatched && matchConfirm.matchedValue === 'YES') {
        setStep('ask_time');
        stepRef.current = 'ask_time';
        speakStepPrompt('ask_time');
      } else if (matchConfirm.isMatched && matchConfirm.matchedValue === 'NO') {
        handleCancelSchedule();
      }
    }

    // STEP 3: Spoken Time Parse
    if (activeStep === 'ask_time') {
      const parsed = parseSpokenTimeTo24Hr(text);
      if (parsed) {
        scheduleTimeInputRef.current = parsed.time24;
        setScheduleTimeInput(parsed.time24);
        setFormattedSpokenTime(parsed.time12Formatted);
        setStep('ask_duration');
        stepRef.current = 'ask_duration';
        speakStepPrompt('ask_duration');
        return;
      }
    }

    // STEP 4: Spoken Duration Parse
    if (activeStep === 'ask_duration') {
      const durMatch = SttMatcherService.matchDurationChoice(candidates, language);
      if (durMatch.isMatched && durMatch.matchedValue) {
        const dur = durMatch.matchedValue;
        const label = dur === 'today_only' ? 'Today alone (1 Day)' : dur === '1_week' ? '1 Week (7 Days)' : dur === '1_month' ? '1 Month (30 Days)' : dur === '3_months' ? '3 Months (90 Days)' : 'Indefinite';
        setSelectedDuration(dur);
        selectedDurationRef.current = dur;
        setSelectedDurationLabel(label);

        setStep('ask_frequency_days');
        stepRef.current = 'ask_frequency_days';
        speakStepPrompt('ask_frequency_days');
      }
    }

    // STEP 5: Spoken Frequency / Days Parse
    if (activeStep === 'ask_frequency_days') {
      const daysMatch = SttMatcherService.matchDaysChoice(candidates, language);
      if (daysMatch.isMatched) {
        setIsEveryDay(daysMatch.isEveryDay);
        isEveryDayRef.current = daysMatch.isEveryDay;
        setSelectedDays(daysMatch.selectedDays);
        selectedDaysRef.current = daysMatch.selectedDays;

        setStep('confirm_schedule');
        stepRef.current = 'confirm_schedule';
        speakStepPrompt('confirm_schedule');
      }
    }

    // STEP 6: Final Confirmation for Schedule
    if (activeStep === 'confirm_schedule') {
      const matchConfirm = SttMatcherService.matchConfirmation(candidates, language);
      if (matchConfirm.isMatched) {
        if (matchConfirm.matchedValue === 'YES') {
          finalizeAndTriggerPinVerification(
            scheduleTimeInputRef.current,
            selectedDurationRef.current,
            isEveryDayRef.current,
            selectedDaysRef.current
          );
        } else if (matchConfirm.matchedValue === 'NO') {
          handleCancelSchedule();
        }
      }
    }
  };

  const finalizeAndTriggerPinVerification = (
    timeToSet: string = scheduleTimeInput,
    durationToSet: string = selectedDuration,
    everyDay: boolean = isEveryDay,
    days: string[] = selectedDays
  ) => {
    if (!item) return;
    console.log('[VoiceOrderDialogModal] Finalizing schedule -> Triggering Security PIN Verification...');
    SpeechService.stopListening();
    setIsListening(false);

    const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
    const frequency = everyDay ? 'daily' : 'custom';
    const endDate = calculateScheduleEndDate(todayStr, durationToSet as any);

    const newSchedule = {
      id: `sched-${Date.now()}`,
      slotName: `Voice Schedule: ${item.name}`,
      slotIndex: 1,
      time: timeToSet,
      frequency,
      selectedDays: days,
      foodItemId: item.id,
      foodItemName: item.name,
      restaurant: item.restaurant,
      quantity: 1,
      strategy: 'best_value' as const,
      isEnabled: true,
      walletAutoDebit: true,
      duration: durationToSet,
      startDate: todayStr,
      endDate
    };

    saveSchedule(newSchedule);
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
                  setStep('show_bill');
                  stepRef.current = 'show_bill';
                  speakStepPrompt('show_bill');
                }}
                className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm shadow-md flex items-center justify-center space-x-2 cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5 text-yellow-300" />
                <span>{language === 'ta' ? 'ஆம் / சரி' : language === 'hi' ? 'हाँ / सही' : 'Yes / Correct'}</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Show Bill Preview */}
        {step === 'show_bill' && (
          <div className="space-y-4">
            <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-700 space-y-3 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center space-x-2">
                  <Receipt className="w-5 h-5 text-orange-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-orange-400">
                    {language === 'ta' ? 'படி 2: கட்டண மதிப்பீடு' : language === 'hi' ? 'चरण 2: बिल का अनुमान' : 'Step 2: Order Bill Preview'}
                  </span>
                </div>
                <span className="text-[11px] font-extrabold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
                  Per Order Debit
                </span>
              </div>

              <div className="space-y-1.5 text-xs sm:text-sm font-bold">
                <div className="flex justify-between items-center text-slate-200">
                  <span className="font-extrabold">{item.nativeNames?.[language] || item.name} (1x)</span>
                  <span className="font-black">₹{foodPrice}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Delivery Partner Fee</span>
                  <span>₹{deliveryFee}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>GST & Platform Charges</span>
                  <span>₹{taxAndFees}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-800 text-sm sm:text-base font-black text-emerald-400">
                  <span>Estimated Total</span>
                  <span className="text-emerald-400">₹{grandTotal}</span>
                </div>
              </div>

              {item.platforms && item.platforms.length > 0 && (
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-extrabold text-yellow-400">
                  <span>Best Price: {item.platforms[0].platformName}</span>
                  <span>₹{item.platforms[0].price + item.platforms[0].deliveryFee} total</span>
                </div>
              )}

              <p className="text-xs text-center text-yellow-300 font-bold pt-1">
                {language === 'ta'
                  ? '📢 கட்டணம் சரி என்றால் "ஆம்" என்று சொல்லி நேரத்தை தேர்வு செய்யவும்!'
                  : language === 'hi'
                  ? '📢 बिल स्वीकार्य है तो "हाँ" बोलकर समय चुनें!'
                  : '📢 Say "Yes" to accept bill and pick schedule time!'}
              </p>
            </div>

            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="p-3 bg-slate-900 text-white rounded-2xl flex items-center space-x-3 font-black shadow-md border border-slate-700">
                <Mic className="w-5 h-5 text-yellow-400 animate-pulse" />
                <span className="text-xs">
                  {language === 'ta' ? 'கேட்கிறது: "ஆம்" என்று சொல்லுங்கள்' : language === 'hi' ? 'सुन रहा है: "हाँ" बोलें' : 'Listening: Say "Yes" to proceed'}
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
                <span>{language === 'ta' ? 'ரத்து செய்ய' : language === 'hi' ? 'रद्द करें' : 'Cancel'}</span>
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
                <span>{language === 'ta' ? 'நேரம் தேர்வு செய்ய' : language === 'hi' ? 'समय चुनें' : 'Pick Time'}</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Ask Schedule Time */}
        {step === 'ask_time' && (
          <div className="space-y-4">
            <div className="bg-orange-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-orange-200 text-center space-y-1">
              <span className="text-xs font-black uppercase tracking-wider text-orange-600">
                {language === 'ta' ? 'படி 3: நேரத்தை தேர்வு செய்தல்' : language === 'hi' ? 'चरण 3: समय चयन' : 'Step 3: Pick Schedule Time'}
              </span>
              <p className="text-base font-black text-slate-900 dark:text-white">
                {language === 'ta'
                  ? `${item.nativeNames?.ta || item.name} எந்த நேரத்திற்கு அட்டவணைப்படுத்த வேண்டும்? (எ.கா: "காலை 8 மணி", "இரவு 8 மணி")`
                  : language === 'hi'
                  ? `${item.nativeNames?.hi || item.name} किस समय शेड्यूल करना चाहते हैं? (जैसे: "सुबह 8 बजे", "रात 8 बजे")`
                  : `What time would you like to schedule ${item.name}? (e.g., "8 AM", "8 PM")`}
              </p>
            </div>

            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="p-3 bg-slate-900 text-white rounded-2xl flex items-center space-x-3 font-black shadow-md border border-slate-700">
                <Mic className="w-5 h-5 text-yellow-400" />
                <span className="text-xs">
                  {language === 'ta'
                    ? 'நேரத்தைச் சொல்லுங்கள் (எ.கா: காலை 8 மணி)...'
                    : language === 'hi'
                    ? 'समय बोलें (जैसे: सुबह 8 बजे)...'
                    : 'Speak schedule time out loud (e.g., 8 AM)...'}
                </span>
              </div>

              {liveTranscript && (
                <p className="text-xs text-center text-orange-600 dark:text-orange-400 font-black">
                  Detected Time Speech: "{liveTranscript}"
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
                  setStep('ask_duration');
                  stepRef.current = 'ask_duration';
                  speakStepPrompt('ask_duration');
                }}
                className="w-full p-3 rounded-2xl border border-slate-300 dark:border-slate-700 font-black text-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-center cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* STEP 4: Ask Recurrence Duration */}
        {step === 'ask_duration' && (
          <div className="space-y-4">
            <div className="bg-orange-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-orange-200 text-center space-y-1">
              <span className="text-xs font-black uppercase tracking-wider text-orange-600">
                {language === 'ta' ? 'படி 4: அட்டவணை காலம் (எவ்வளவு நாட்கள்)' : language === 'hi' ? 'चरण 4: अवधि (कितने दिन)' : 'Step 4: Recurrence Duration (How Many Days)'}
              </span>
              <p className="text-base font-black text-slate-900 dark:text-white leading-relaxed">
                {language === 'ta'
                  ? 'இந்த அட்டவணை எவ்வளவு காலத்திற்கு தொடர வேண்டும்? (எ.கா: "இன்று மட்டும்", "1 வாரம்", "1 மாதம்", "3 மாதங்கள்")'
                  : language === 'hi'
                  ? 'यह शेड्यूल कितने समय तक जारी रखना चाहते हैं? (जैसे: "केवल आज", "1 हफ्ता", "1 महीना", "3 महीने")'
                  : 'For how long would you like to repeat this schedule? (e.g. "Today alone", "1 week", "1 month", "3 months")'}
              </p>
            </div>

            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="p-3 bg-slate-900 text-white rounded-2xl flex items-center space-x-3 font-black shadow-md border border-slate-700">
                <Mic className="w-5 h-5 text-yellow-400" />
                <span className="text-xs">
                  {language === 'ta'
                    ? 'காலத்தைச் சொல்லுங்கள் (1 வாரம் / 1 மாதம்)...'
                    : language === 'hi'
                    ? 'अवधि बोलें (1 हफ्ता / 1 महीना)...'
                    : 'Speak duration aloud (e.g. 1 week, 1 month)...'}
                </span>
              </div>

              {liveTranscript && (
                <p className="text-xs text-center text-orange-600 dark:text-orange-400 font-black">
                  Detected Voice Speech: "{liveTranscript}"
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {[
                { key: 'today_only', labelEn: 'Today alone', labelTa: 'இன்று மட்டும்', labelHi: 'केवल आज' },
                { key: '1_week', labelEn: '1 Week', labelTa: '1 வாரம்', labelHi: '1 हफ्ता' },
                { key: '1_month', labelEn: '1 Month', labelTa: '1 மாதம்', labelHi: '1 महीना' },
                { key: '3_months', labelEn: '3 Months', labelTa: '3 மாதங்கள்', labelHi: '3 महीने' }
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => {
                    setSelectedDuration(opt.key);
                    selectedDurationRef.current = opt.key;
                    setStep('ask_frequency_days');
                    stepRef.current = 'ask_frequency_days';
                    speakStepPrompt('ask_frequency_days');
                  }}
                  className="p-3 bg-slate-100 hover:bg-orange-500 hover:text-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl font-black text-xs shadow transition-all cursor-pointer text-center"
                >
                  {language === 'ta' ? opt.labelTa : language === 'hi' ? opt.labelHi : opt.labelEn}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 5: Ask Days / Frequency (Daily vs Weekly) */}
        {step === 'ask_frequency_days' && (
          <div className="space-y-4">
            <div className="bg-orange-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-orange-200 text-center space-y-1">
              <span className="text-xs font-black uppercase tracking-wider text-orange-600">
                {language === 'ta' ? 'படி 5: தினமும் அல்லது வாராந்திர நாட்கள்' : language === 'hi' ? 'चरण 5: प्रतिदिन या साप्ताहिक दिन' : 'Step 5: Daily vs Weekly Days'}
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
                <Mic className="w-5 h-5 text-yellow-400" />
                <span className="text-xs">
                  {language === 'ta'
                    ? 'பதிலைக் கூறவும் (தினமும் / திங்கள் மற்றும் வெள்ளி)...'
                    : language === 'hi'
                    ? 'उत्तर दें (प्रतिदिन / सोमवार और शुक्रवार)...'
                    : 'Speak choice aloud (Every day / Mondays & Fridays)...'}
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
                  setStep('confirm_schedule');
                  stepRef.current = 'confirm_schedule';
                  speakStepPrompt('confirm_schedule');
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
                  const defaultDays = ['Mon', 'Fri'];
                  setSelectedDays(defaultDays);
                  selectedDaysRef.current = defaultDays;
                  setStep('confirm_schedule');
                  stepRef.current = 'confirm_schedule';
                  speakStepPrompt('confirm_schedule');
                }}
                className="p-4 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black text-xs shadow-lg flex flex-col items-center justify-center space-y-1 cursor-pointer transition-all active:scale-95"
              >
                <Clock className="w-5 h-5 text-white" />
                <span>{language === 'ta' ? 'வாராந்திர நாட்கள் (Weekly)' : language === 'hi' ? 'साप्ताहिक दिन (Weekly)' : 'Weekly Days'}</span>
                <span className="text-[10px] opacity-90">(Mon & Fri)</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: Final Confirmation for Schedule */}
        {step === 'confirm_schedule' && (
          <div className="space-y-4">
            <div className="bg-emerald-50 dark:bg-emerald-950/40 p-5 rounded-2xl border border-emerald-300 text-center space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                {language === 'ta' ? 'இறுதி அட்டவணை உறுதிப்படுத்தல்' : language === 'hi' ? 'अंतिम शेड्यूल पुष्टि' : 'Final Schedule Summary'}
              </span>
              <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
                {language === 'ta'
                  ? `${item.nativeNames?.ta || item.name} ${formattedSpokenTime}-க்கு (${selectedDuration === 'today_only' ? 'இன்று மட்டும்' : selectedDuration === '1_week' ? '1 வாரம்' : '1 மாதம்'}, ${isEveryDay ? 'தினமும்' : 'வாராந்திர'}) அட்டவணைப்படுத்தப்படுகிறது!`
                  : language === 'hi'
                  ? `${item.nativeNames?.hi || item.name} का ${formattedSpokenTime} पर (${selectedDuration === 'today_only' ? 'केवल आज' : selectedDuration === '1_week' ? '1 हफ्ता' : '1 महीना'}, ${isEveryDay ? 'प्रतिदिन' : 'साप्ताहिक'}) शेड्यूल!`
                  : `Scheduling ${item.name} at ${formattedSpokenTime} (${selectedDuration === 'today_only' ? 'Today alone' : selectedDuration === '1_week' ? '1 Week' : '1 Month'}, ${isEveryDay ? 'Daily' : 'Weekly'})`}
              </p>
              <div className="py-1 text-base font-black text-emerald-600 dark:text-emerald-400">
                Total Bill per order: ₹{grandTotal}
              </div>
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                {language === 'ta'
                  ? '📢 "சரி / ஆம்" என்று கூறி 4-இலக்க PIN மூலம் உறுதிப்படுத்தவும்!'
                  : language === 'hi'
                  ? '📢 "हाँ / ठीक है" बोलकर 4-अंकीय PIN से पुष्टि करें!'
                  : '📢 Say "Yes / Confirm" out loud to verify with 4-digit PIN!'}
              </p>
            </div>

            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="p-3 bg-slate-900 text-white rounded-2xl flex items-center space-x-3 font-black shadow-md border border-slate-700">
                <Mic className="w-5 h-5 text-yellow-400 animate-pulse" />
                <span className="text-xs">
                  {language === 'ta'
                    ? 'தானியங்கியாகக் கேட்கிறது: "சரி" / "ஆம்" அல்லது "ரத்து"'
                    : language === 'hi'
                    ? 'स्वचालित रूप से सुन रहा है: "हाँ" या "नहीं"'
                    : 'Listening automatically: Say "Yes / Confirm" or "No / Cancel"'}
                </span>
              </div>

              {liveTranscript && (
                <p className="text-xs text-center text-emerald-600 dark:text-emerald-400 font-black">
                  Detected Voice Speech: "{liveTranscript}"
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={handleCancelSchedule}
                className="py-3.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-sm shadow-lg flex items-center justify-center space-x-2 cursor-pointer transition-all active:scale-95"
              >
                <XCircle className="w-5 h-5 text-rose-200" />
                <span>
                  {language === 'ta' ? 'வேண்டாம் / ரத்து' : language === 'hi' ? 'रद्द करें' : 'Cancel'}
                </span>
              </button>

              <button
                onClick={() => {
                  finalizeAndTriggerPinVerification(
                    scheduleTimeInputRef.current,
                    selectedDurationRef.current,
                    isEveryDayRef.current,
                    selectedDaysRef.current
                  );
                }}
                className="py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm shadow-lg flex items-center justify-center space-x-2 cursor-pointer transition-all active:scale-95"
              >
                <CheckCircle2 className="w-5 h-5 text-yellow-300" />
                <span>
                  {language === 'ta' ? 'PIN மூலம் உறுதிப்படுத்து' : language === 'hi' ? 'PIN से पुष्टि करें' : 'Confirm & Enter PIN'}
                </span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
