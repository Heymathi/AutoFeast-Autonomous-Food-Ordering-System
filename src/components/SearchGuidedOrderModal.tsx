/**
 * SearchGuidedOrderModal.tsx
 *
 * Spoken + listened guided dialog launched whenever a search query matches
 * generic or multi-variety items. Extended with the complete scheduling dialog
 * flow across English, Tamil, and Hindi.
 *
 * Flow:
 * 1. variety: Which variety?
 * 2. restaurant: Which restaurant?
 * 3. when: Order now or schedule for later?
 * 4. schedule_time: "At what time should I schedule the order?"
 * 5. schedule_duration: "For how long: 1 week, 1 month, 3 months, or a custom period?"
 * 6. schedule_custom_duration (if custom): "How many days, or until which date?"
 * 7. schedule_days_mode: "Which days: a particular day, every day of the week, or custom days?"
 * 8. schedule_weekdays (if particular): "Which days of the week?"
 * 9. schedule_bill: Show full bill (item, restaurant, deliveries, delivery fee, taxes, total) & speak summary
 * 10. schedule_pin: "Please enter your security PIN." (spoken or masked numeric keypad)
 * 11. schedule_success: Show & speak success popup matching cart/order style
 *
 * Rules:
 * - TTS starts immediately; STT starts as soon as TTS finishes.
 * - Tap and voice call the same handlers, guarded against double-firing.
 * - Cancel-intent closes immediately.
 * - NO is checked before YES everywhere.
 * - Restricted-item check delegated to existing nominee flow untouched.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { FoodItem, AutoOrderSchedule, ScheduleDuration } from '../types';
import { SpeechController } from '../services/speechController';
import { SttMatcherService } from '../services/sttMatcherService';
import { deriveMealSlot } from '../services/timeVoiceParser';
import { calculateHaversineDistance } from '../services/locationService';
import { AutoOrderBackgroundService } from '../services/autoOrderBackgroundService';
import { AuthService } from '../services/authService';
import { normalizeTime } from '../utils/scheduleCalculator';
import { parsePinSpeech } from '../services/pinVoiceParserService';
import {
  matchOptionByTokens,
  classifyOrderNowOrSchedule,
  normalizeInputText
} from '../services/guidedMatchingService';
import {
  parseTime,
  parseDuration,
  parseCustomDays,
  parseDaysMode,
  parseWeekdays,
  buildScheduleDates,
  calcScheduleBill,
  ScheduleDurationType,
  DaysModeType,
  CustomDaysResult,
  ParsedTimeResult,
  ALL_DAYS
} from '../services/scheduleVoiceParser';
import {
  Mic,
  MicOff,
  X,
  Zap,
  Clock,
  ChevronRight,
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  ArrowLeft,
  Lock,
  ShieldCheck,
  FileText,
  Delete
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

type GuidedStep =
  | 'variety'
  | 'restaurant'
  | 'when'
  | 'schedule_time'
  | 'schedule_duration'
  | 'schedule_custom_duration'
  | 'schedule_days_mode'
  | 'schedule_weekdays'
  | 'schedule_bill'
  | 'schedule_pin'
  | 'schedule_success';

export interface SearchGuidedOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Raw query string, e.g. "dosa" / "தோசை" / "डोसा" */
  query: string;
  /** Items matched by the search engine (2+ for variety step, 1 → skips to restaurant) */
  matchedItems: FoodItem[];
}

// ─── Cancel-intent detector ─────────────────────────────────────────────────

const CANCEL_WORDS = [
  'cancel', 'stop', 'close', 'exit',
  'வேண்டாம்', 'ரத்து', 'நிறுத்து', 'வேணாம்', 'vendam', 'rathu',
  'nahi', 'nahin', 'band karo', 'ruko', 'naa', 'mat', 'रद्द', 'बंद करो', 'नहीं'
];

const isCancelIntent = (text: string): boolean => {
  const t = text.toLowerCase().replace(/[,.!?;:()'"~`-]+/g, ' ').trim();
  return CANCEL_WORDS.some(w => ` ${t} `.includes(` ${w} `));
};

const isBackIntent = (text: string): boolean => {
  const t = text.toLowerCase().replace(/[,.!?;:()'"~`-]+/g, ' ').trim();
  return (
    t.includes('back') || t.includes('go back') || t.includes('previous') ||
    t.includes('பின்னால்') || t.includes('முந்தையது') || t.includes('திரும்பு') ||
    t.includes('पीछे') || t.includes('वापस')
  );
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const getTodayDateStr = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const DAY_LABELS: Record<string, { en: string; ta: string; hi: string }> = {
  Monday: { en: 'Mon', ta: 'திங்கள்', hi: 'सोम' },
  Tuesday: { en: 'Tue', ta: 'செவ்வாய்', hi: 'मंगल' },
  Wednesday: { en: 'Wed', ta: 'புதன்', hi: 'बुध' },
  Thursday: { en: 'Thu', ta: 'வியாழன்', hi: 'गुरु' },
  Friday: { en: 'Fri', ta: 'வெள்ளி', hi: 'शुक्र' },
  Saturday: { en: 'Sat', ta: 'சனி', hi: 'शनि' },
  Sunday: { en: 'Sun', ta: 'ஞாயிறு', hi: 'रवि' }
};

const deriveSlotIndex = (hours: number): 1 | 2 | 3 | 4 => {
  if (hours < 11) return 1;
  if (hours < 16) return 2;
  if (hours < 19) return 3;
  return 4;
};

const getUniqueRestaurants = (
  items: FoodItem[],
  userLat: number,
  userLng: number
): string[] => {
  const seen = new Set<string>();
  const withDist: { name: string; dist: number }[] = [];
  for (const item of items) {
    const r = item.restaurant || '';
    if (r && !seen.has(r)) {
      seen.add(r);
      const dist = calculateHaversineDistance(
        userLat, userLng,
        item.restaurantLat || 13.0827,
        item.restaurantLng || 80.2707
      );
      withDist.push({ name: r, dist });
    }
  }
  withDist.sort((a, b) => a.dist - b.dist);
  return withDist.map(x => x.name);
};

const namesToSpeak = (names: string[], max = 3): string =>
  names.slice(0, max).join(', ');

// ─── Component ──────────────────────────────────────────────────────────────

const MIC_OWNER = 'guided_order_dialog';

export const SearchGuidedOrderModal: React.FC<SearchGuidedOrderModalProps> = ({
  isOpen,
  onClose,
  query,
  matchedItems
}) => {
  const {
    language,
    speakText,
    t,
    userLocation,
    placeInstantOrder,
    saveSchedule,
    checkIsItemRestrictedByNominee,
    isItemApprovedByNominee,
    handleNomineeRestrictedInterception,
    showToast
  } = useApp();

  // ── State ────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<GuidedStep>('variety');
  const [selectedItem, setSelectedItem] = useState<FoodItem | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [silenceCount, setSilenceCount] = useState(0);
  const [speechError, setSpeechError] = useState<string | null>(null);

  // Scheduling flow state
  const [schedTime, setSchedTime] = useState('08:00');
  const [schedTimeDisplay, setSchedTimeDisplay] = useState('8:00 AM');
  const [schedDuration, setSchedDuration] = useState<ScheduleDurationType>('1_week');
  const [customDaysCount, setCustomDaysCount] = useState<number>(10);
  const [customUntilDate, setCustomUntilDate] = useState<string>('');
  const [customUntilDateDisplay, setCustomUntilDateDisplay] = useState<string>('');
  const [schedDaysMode, setSchedDaysMode] = useState<DaysModeType>('all_days');
  const [schedDays, setSchedDays] = useState<string[]>(['Monday', 'Thursday']);

  // PIN verification state
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '']);
  const [isPinVerifying, setIsPinVerifying] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinLockSeconds, setPinLockSeconds] = useState<number>(0);
  const [successPopupMsg, setSuccessPopupMsg] = useState<string | null>(null);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const handledRef = useRef(false);
  const stepRef = useRef<GuidedStep>('variety');
  const isSpeakingRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOpenRef = useRef(false);

  useEffect(() => { stepRef.current = step; }, [step]);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  const varieties = matchedItems;

  // Lockout countdown timer
  useEffect(() => {
    if (pinLockSeconds <= 0) return;
    const interval = setInterval(() => {
      setPinLockSeconds(prev => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [pinLockSeconds]);

  // Derived delivery dates & bill calculation
  const deliveryDates = buildScheduleDates({
    time: schedTime,
    duration: schedDuration,
    customDaysCount: schedDuration === 'custom' && customDaysCount > 0 ? customDaysCount : undefined,
    customUntilDate: schedDuration === 'custom' && customUntilDate ? customUntilDate : undefined,
    selectedDays: schedDaysMode === 'all_days' ? undefined : schedDays
  });

  const bill = calcScheduleBill({
    basePrice: selectedItem?.basePrice || 100,
    deliveryCount: deliveryDates.length,
    quantity: 1,
    restaurantCount: 1
  });

  // ── Helper: speak then start listening ───────────────────────────────────
  const speakAndListen = useCallback((text: string, onAfterSpeak?: () => void) => {
    if (!isOpenRef.current) return;
    isSpeakingRef.current = true;
    SpeechController.releaseMic(MIC_OWNER);
    setIsListening(false);

    speakText(text, () => {
      isSpeakingRef.current = false;
      if (onAfterSpeak) onAfterSpeak();
      if (!isOpenRef.current) return;
      startListening();
    }, language);
  }, [language, speakText]);

  // ── Start/Restart listening ───────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!isOpenRef.current || isSpeakingRef.current) return;
    SpeechController.requestMic({
      owner: MIC_OWNER,
      language,
      continuous: false,
      interimResults: true,
      maxAlternatives: 5,
      onStart: () => {
        setIsListening(true);
        setSpeechError(null);
      },
      onResult: (transcript, isFinal, nBest) => {
        if (!transcript || !isOpenRef.current) return;
        setLiveText(transcript);
        if (!isFinal) return;
        setIsListening(false);
        clearSilenceTimer();
        handleVoiceResult(nBest && nBest.length > 0 ? nBest : [transcript]);
      },
      onError: (errCode) => {
        setIsListening(false);
        const err = String(errCode || '').toLowerCase();
        if (err === 'no-speech' && isOpenRef.current) {
          handleSilence();
        } else if (err === 'not-allowed' || err === 'audio-capture') {
          setSpeechError(language === 'ta' ? 'மைக் அனுமதி தேவை. திரையில் தட்டவும்.' : language === 'hi' ? 'माइक्रोफ़ोन अनुमति आवश्यक है। स्क्रीन पर टैप करें।' : 'Microphone permission required. Please tap on screen.');
        } else if (err === 'network') {
          setSpeechError(language === 'ta' ? 'குரல் சேவைக்கு இணைய இணைப்பு தேவை.' : language === 'hi' ? 'आवाज़ सेवा के लिए इंटरनेट आवश्यक है।' : 'Voice service requires internet connection.');
        } else if (err === 'language-not-supported') {
          setSpeechError(language === 'ta' ? 'இந்த மொழிக்கான குரல் சேவை உலாவியில் இல்லை.' : language === 'hi' ? 'यह भाषा इस ब्राउज़र में समर्थित नहीं है।' : 'Language not supported by browser voice.');
        }
      },
      onEnd: () => {
        setIsListening(false);
        if (isOpenRef.current && !isSpeakingRef.current && !successPopupMsg) {
          setTimeout(() => {
            if (isOpenRef.current && !isSpeakingRef.current && !successPopupMsg) startListening();
          }, 400);
        }
      }
    });
  }, [language, successPopupMsg]);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const handleSilence = useCallback(() => {
    setSilenceCount(prev => {
      if (prev === 0) {
        const rePrompt = t('guided.silenceRePrompt');
        speakText(rePrompt, () => { if (isOpenRef.current) startListening(); }, language);
        return 1;
      }
      setIsListening(false);
      return 2;
    });
  }, [language, speakText, t]);

  const handleCancel = useCallback(() => {
    if (handledRef.current) return;
    handledRef.current = true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    SpeechController.releaseMic(MIC_OWNER);
    const msg = t('guided.cancelledOkay');
    speakText(msg, undefined, language);
    showToast(msg);
    onClose();
  }, [language, onClose, showToast, speakText, t]);

  // ── Step navigation helper ────────────────────────────────────────────────

  const handleGoBack = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    SpeechController.releaseMic(MIC_OWNER);
    handledRef.current = false;
    setSilenceCount(0);
    setLiveText('');
    setSpeechError(null);

    const curr = stepRef.current;
    if (curr === 'schedule_time') setStep('when');
    else if (curr === 'schedule_duration') setStep('schedule_time');
    else if (curr === 'schedule_custom_duration') setStep('schedule_duration');
    else if (curr === 'schedule_days_mode') {
      setStep(schedDuration === 'custom' ? 'schedule_custom_duration' : 'schedule_duration');
    }
    else if (curr === 'schedule_weekdays') setStep('schedule_days_mode');
    else if (curr === 'schedule_bill') {
      setStep(schedDaysMode === 'all_days' ? 'schedule_days_mode' : 'schedule_weekdays');
    }
    else if (curr === 'schedule_pin') setStep('schedule_bill');
    else if (curr === 'restaurant') setStep('variety');
    else if (curr === 'when') setStep('restaurant');
  }, [schedDaysMode, schedDuration]);

  // ── Handlers (Shared between Voice and Tap) ───────────────────────────────

  const handleVarietyChosen = useCallback((item: FoodItem) => {
    if (handledRef.current) return;
    handledRef.current = true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    SpeechController.releaseMic(MIC_OWNER);
    setSelectedItem(item);
    handledRef.current = false;
    setSilenceCount(0);
    setLiveText('');
    setSpeechError(null);
    setStep('restaurant');
  }, []);

  const handleRestaurantChosen = useCallback((restaurant: string) => {
    if (handledRef.current) return;
    handledRef.current = true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    SpeechController.releaseMic(MIC_OWNER);
    setSelectedRestaurant(restaurant);
    handledRef.current = false;
    setSilenceCount(0);
    setLiveText('');
    setSpeechError(null);
    setStep('when');
  }, []);

  const handleOrderNow = useCallback((item: FoodItem) => {
    if (handledRef.current) return;
    handledRef.current = true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    SpeechController.releaseMic(MIC_OWNER);
    onClose();
    const isRestricted = checkIsItemRestrictedByNominee(item.id, item.name);
    if (isRestricted) {
      handleNomineeRestrictedInterception(item, 'instant');
    } else {
      placeInstantOrder(item);
    }
  }, [checkIsItemRestrictedByNominee, handleNomineeRestrictedInterception, onClose, placeInstantOrder]);

  const handleStartSchedule = useCallback(() => {
    if (handledRef.current) return;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    SpeechController.releaseMic(MIC_OWNER);
    setSilenceCount(0);
    setLiveText('');
    setSpeechError(null);
    handledRef.current = false;
    setStep('schedule_time');
  }, []);

  // 1. Time Set
  const handleScheduleTimeSet = useCallback((parsed: ParsedTimeResult) => {
    if (handledRef.current) return;
    handledRef.current = true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    SpeechController.releaseMic(MIC_OWNER);
    setSchedTime(parsed.time24);
    setSchedTimeDisplay(parsed.displayTime);
    handledRef.current = false;
    setSilenceCount(0);
    setLiveText('');
    setSpeechError(null);
    setStep('schedule_duration');
  }, []);

  // 2. Duration Set
  const handleScheduleDurationSet = useCallback((dur: ScheduleDurationType) => {
    if (handledRef.current) return;
    handledRef.current = true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    SpeechController.releaseMic(MIC_OWNER);
    setSchedDuration(dur);
    handledRef.current = false;
    setSilenceCount(0);
    setLiveText('');
    setSpeechError(null);

    if (dur === 'custom') {
      setStep('schedule_custom_duration');
    } else {
      setStep('schedule_days_mode');
    }
  }, []);

  // 3. Custom Duration Set
  const handleCustomDurationSet = useCallback((res: CustomDaysResult) => {
    if (handledRef.current) return;
    if (res.isOutOfRange || (res.type === 'days' && (res.count! < 1 || res.count! > 180))) {
      const err = t('guided.customDurationError');
      setSpeechError(err);
      speakText(err, () => { if (isOpenRef.current) startListening(); }, language);
      return;
    }
    if (res.type === 'until_date' && res.isPast) {
      const err = t('guided.pastDateError');
      setSpeechError(err);
      speakText(err, () => { if (isOpenRef.current) startListening(); }, language);
      return;
    }

    handledRef.current = true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    SpeechController.releaseMic(MIC_OWNER);
    if (res.type === 'days') {
      setCustomDaysCount(res.count || 10);
      setCustomUntilDate('');
      setCustomUntilDateDisplay('');
    } else if (res.type === 'until_date') {
      setCustomUntilDate(res.dateStr || '');
      setCustomUntilDateDisplay(res.displayDate || '');
      setCustomDaysCount(0);
    }
    handledRef.current = false;
    setSilenceCount(0);
    setLiveText('');
    setSpeechError(null);
    setStep('schedule_days_mode');
  }, [language, speakText, startListening, t]);

  // 4. Days Mode Set
  const handleDaysModeSet = useCallback((mode: DaysModeType) => {
    if (handledRef.current) return;
    handledRef.current = true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    SpeechController.releaseMic(MIC_OWNER);
    setSchedDaysMode(mode);
    handledRef.current = false;
    setSilenceCount(0);
    setLiveText('');
    setSpeechError(null);

    if (mode === 'all_days') {
      setStep('schedule_bill');
    } else {
      setStep('schedule_weekdays');
    }
  }, []);

  // 5. Particular Weekdays Set
  const handleWeekdaysSet = useCallback((days: string[]) => {
    if (handledRef.current || days.length === 0) return;
    handledRef.current = true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    SpeechController.releaseMic(MIC_OWNER);
    setSchedDays(days);
    handledRef.current = false;
    setSilenceCount(0);
    setLiveText('');
    setSpeechError(null);
    setStep('schedule_bill');
  }, []);

  const toggleDay = useCallback((day: string) => {
    setSchedDays(prev => {
      if (prev.includes(day)) {
        if (prev.length === 1) return prev;
        return prev.filter(d => d !== day);
      } else {
        return ALL_DAYS.filter(d => prev.includes(d) || d === day);
      }
    });
  }, []);

  // 6. Bill confirmation -> Move to PIN
  const handleBillProceedToPin = useCallback(() => {
    if (handledRef.current) return;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    SpeechController.releaseMic(MIC_OWNER);
    handledRef.current = false;
    setSilenceCount(0);
    setLiveText('');
    setSpeechError(null);
    setPinDigits(['', '', '', '']);
    setPinError(null);
    setStep('schedule_pin');
  }, []);

  // 7. PIN execution & Save Schedule
  const verifyAndSaveSchedule = useCallback(async (pinToVerify: string) => {
    if (isPinVerifying || pinLockSeconds > 0 || !selectedItem) return;
    setIsPinVerifying(true);
    setPinError(null);

    const res = await AuthService.verifyPIN(pinToVerify);
    setIsPinVerifying(false);

    if (res.success) {
      // 1. Delegate restricted items to existing nominee flow untouched
      const isRestricted = checkIsItemRestrictedByNominee(selectedItem.id, selectedItem.name);
      if (isRestricted) {
        SpeechController.releaseMic(MIC_OWNER);
        onClose();
        const safeTime = normalizeTime(schedTime);
        const hours = parseInt(safeTime.split(':')[0], 10) || 8;
        handleNomineeRestrictedInterception(selectedItem, 'scheduled', {
          time: safeTime,
          slotName: `${deriveMealSlot(hours)} Schedule`,
          duration: schedDuration as ScheduleDuration,
          frequency: schedDaysMode === 'all_days' ? 'daily' : 'weekly'
        });
        return;
      }

      // 2. Save ONE recurring schedule with existing scheduler
      const safeTime = normalizeTime(schedTime);
      const hours = parseInt(safeTime.split(':')[0], 10) || 8;
      const slotIdx = deriveSlotIndex(hours);
      const slot = deriveMealSlot(hours);
      const newSchedule: AutoOrderSchedule = {
        id: `sched-${Date.now()}`,
        slotName: `${slot} Schedule`,
        slotIndex: slotIdx,
        time: safeTime,
        frequency: schedDaysMode === 'all_days' ? 'daily' : 'weekly',
        selectedDays: schedDaysMode === 'all_days' ? undefined : schedDays,
        foodItemId: selectedItem.id,
        foodItemName: selectedItem.name,
        restaurant: selectedRestaurant || selectedItem.restaurant || 'Restaurant',
        quantity: 1,
        strategy: 'best_value',
        isEnabled: true,
        walletAutoDebit: true,
        duration: schedDuration as ScheduleDuration,
        startDate: deliveryDates[0] || getTodayDateStr(),
        endDate: deliveryDates[deliveryDates.length - 1],
        notes: `Deliveries: ${deliveryDates.length} days; Total: Rs ${bill.grandTotal}`
      };

      try {
        AutoOrderBackgroundService.saveSchedule(newSchedule);
        if (typeof saveSchedule === 'function') {
          saveSchedule(newSchedule, res.token);
        }

        const successMsg = (t('guided.scheduleSuccess') || 'Your {item} from {restaurant} is scheduled for {n} days at {time}. Total Rs {total}.')
          .replace('{item}', selectedItem.nativeNames?.[language] || selectedItem.name)
          .replace('{restaurant}', selectedRestaurant || selectedItem.restaurant || 'Restaurant')
          .replace('{n}', String(deliveryDates.length))
          .replace('{time}', schedTimeDisplay)
          .replace('{total}', String(bill.grandTotal));

        setSuccessPopupMsg(successMsg);
        showToast(successMsg);
        speakText(successMsg, undefined, language);
        setStep('schedule_success');
      } catch (err) {
        console.error('[GuidedDialog] Save error:', err);
        const errMsg = t('guided.schedSaveError');
        setSpeechError(errMsg);
        speakText(errMsg, undefined, language);
      }
    } else {
      // Wrong PIN or Locked
      setPinDigits(['', '', '', '']);
      if (res.isLocked) {
        const secs = res.lockRemainingSeconds || 30;
        setPinLockSeconds(secs);
        const lockMsg = (t('guided.pinLocked') || 'Too many attempts. Locked for {seconds} seconds.').replace('{seconds}', String(secs));
        setPinError(lockMsg);
        speakText(lockMsg, () => { if (isOpenRef.current) startListening(); }, language);
      } else {
        const attempts = res.attemptsLeft ?? 0;
        const errMsg = (t('guided.pinWrong') || 'Incorrect PIN. {attempts} attempts remaining.').replace('{attempts}', String(attempts));
        setPinError(errMsg);
        speakText(errMsg, () => { if (isOpenRef.current) startListening(); }, language);
      }
    }
  }, [
    bill.grandTotal,
    checkIsItemRestrictedByNominee,
    deliveryDates,
    handleNomineeRestrictedInterception,
    isPinVerifying,
    language,
    onClose,
    pinLockSeconds,
    saveSchedule,
    schedDays,
    schedDaysMode,
    schedDuration,
    schedTime,
    schedTimeDisplay,
    selectedItem,
    selectedRestaurant,
    showToast,
    speakText,
    startListening,
    t
  ]);

  // Keypad tap handler
  const handleKeypadDigit = (digit: string) => {
    if (isPinVerifying || pinLockSeconds > 0) return;
    setPinError(null);
    setPinDigits(prev => {
      const idx = prev.findIndex(d => d === '');
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = digit;
      if (idx === 3) {
        // Complete 4 digits entered!
        const full = next.join('');
        verifyAndSaveSchedule(full);
      }
      return next;
    });
  };

  const handleKeypadBackspace = () => {
    if (isPinVerifying || pinLockSeconds > 0) return;
    setPinError(null);
    setPinDigits(prev => {
      const filled = prev.map((d, i) => (d !== '' ? i : -1)).filter(i => i !== -1);
      if (filled.length === 0) return prev;
      const last = filled[filled.length - 1];
      const next = [...prev];
      next[last] = '';
      return next;
    });
  };

  const handleKeypadClear = () => {
    if (isPinVerifying || pinLockSeconds > 0) return;
    setPinDigits(['', '', '', '']);
    setPinError(null);
  };

  // ── Voice result router ───────────────────────────────────────────────────
  const handleVoiceResult = useCallback((candidates: string[]) => {
    const raw = candidates[0] || '';

    // Cancel everywhere
    if (isCancelIntent(raw)) {
      handleCancel();
      return;
    }

    // Back everywhere in schedule
    if (isBackIntent(raw)) {
      handleGoBack();
      return;
    }

    // Direct change commands
    const norm = normalizeInputText(raw);
    if (norm.includes('change time') || norm.includes('நேரம் மாற்று') || norm.includes('समय बदलो')) {
      setStep('schedule_time');
      return;
    }
    if (norm.includes('change duration') || norm.includes('காலம் மாற்று') || norm.includes('अवधि बदलो')) {
      setStep('schedule_duration');
      return;
    }
    if (norm.includes('change days') || norm.includes('நாட்கள் மாற்று') || norm.includes('दिन बदलो')) {
      setStep('schedule_days_mode');
      return;
    }

    const currentStep = stepRef.current;

    if (currentStep === 'variety') {
      const decision = matchOptionByTokens(raw, varieties, language);
      if (decision.chosen) {
        handleVarietyChosen(decision.chosen as FoodItem);
      } else if (decision.isTie && decision.tieCandidates) {
        const [a, b] = decision.tieCandidates as [FoodItem, FoodItem];
        const nameA = a.nativeNames?.[language] || a.name;
        const nameB = b.nativeNames?.[language] || b.name;
        const tieMsg = (t('guided.tiePrompt') || 'Did you mean {nameA}, or {nameB}?')
          .replace('{nameA}', nameA)
          .replace('{nameB}', nameB);
        speakText(tieMsg, () => { if (isOpenRef.current) startListening(); }, language);
      } else if (decision.isOnlyFamilyWord) {
        const top3Names = namesToSpeak(varieties.map(v => v.nativeNames?.[language] || v.name));
        const prompt = t('guided.step1Spoken')
          .replace('{dish}', query || 'dish')
          .replace('{names}', top3Names);
        speakText(prompt, () => { if (isOpenRef.current) startListening(); }, language);
      } else {
        startListening();
      }

    } else if (currentStep === 'restaurant') {
      const currentRestaurants = getUniqueRestaurants(
        matchedItems,
        userLocation.latitude,
        userLocation.longitude
      );
      const filteredRestaurants = selectedItem
        ? getUniqueRestaurants(
          matchedItems.filter(i => i.id === selectedItem.id || i.restaurant === selectedItem.restaurant),
          userLocation.latitude,
          userLocation.longitude
        )
        : currentRestaurants;
      const restaurantList = filteredRestaurants.length > 0 ? filteredRestaurants : currentRestaurants;

      if (restaurantList.length === 1) {
        const conf = SttMatcherService.matchConfirmation(candidates, language);
        if (conf.matchedValue === 'NO') {
          handleCancel();
        } else if (conf.matchedValue === 'YES') {
          handleRestaurantChosen(restaurantList[0]);
        } else {
          startListening();
        }
      } else {
        const decision = matchOptionByTokens(raw, restaurantList, language);
        if (decision.chosen) {
          handleRestaurantChosen(decision.chosen as string);
        } else {
          startListening();
        }
      }

    } else if (currentStep === 'when') {
      const isRestricted = selectedItem ? checkIsItemRestrictedByNominee(selectedItem.id, selectedItem.name) : false;
      const isApproved = selectedItem ? isItemApprovedByNominee(selectedItem.id) : false;
      if (isRestricted && !isApproved) {
        const conf = SttMatcherService.matchConfirmation(candidates, language);
        const lower = raw.toLowerCase();
        const wantsApproval = conf.matchedValue === 'YES' ||
          lower.includes('approval') || lower.includes('request') || lower.includes('yes') ||
          lower.includes('அனுமதி') || lower.includes('ஒப்புதல்') || lower.includes('स्वीकृति');

        if (wantsApproval && selectedItem) {
          onClose();
          handleNomineeRestrictedInterception(selectedItem, 'instant');
        } else {
          startListening();
        }
      } else {
        const intent = classifyOrderNowOrSchedule(raw);
        if (intent === 'NOW') {
          if (selectedItem) handleOrderNow(selectedItem);
        } else if (intent === 'SCHEDULE') {
          handleStartSchedule();
        } else {
          const parsed = parseTime(raw);
          if (parsed) {
            handleScheduleTimeSet(parsed);
          } else {
            startListening();
          }
        }
      }

    } else if (currentStep === 'schedule_time') {
      const parsed = parseTime(raw);
      if (parsed) {
        handleScheduleTimeSet(parsed);
      } else {
        speakText(t('guided.timeReask'), () => { if (isOpenRef.current) startListening(); }, language);
      }

    } else if (currentStep === 'schedule_duration') {
      const dur = parseDuration(raw);
      if (dur) {
        handleScheduleDurationSet(dur);
      } else {
        speakText(t('guided.schedDurationQuestion'), () => { if (isOpenRef.current) startListening(); }, language);
      }

    } else if (currentStep === 'schedule_custom_duration') {
      const res = parseCustomDays(raw);
      if (res) {
        handleCustomDurationSet(res);
      } else {
        speakText(t('guided.customDurationError'), () => { if (isOpenRef.current) startListening(); }, language);
      }

    } else if (currentStep === 'schedule_days_mode') {
      const mode = parseDaysMode(raw);
      if (mode) {
        handleDaysModeSet(mode);
      } else {
        speakText(t('guided.daysModeQuestion'), () => { if (isOpenRef.current) startListening(); }, language);
      }

    } else if (currentStep === 'schedule_weekdays') {
      const days = parseWeekdays(raw);
      if (days && days.length > 0) {
        handleWeekdaysSet(days);
      } else {
        speakText(t('guided.whichDaysQuestion'), () => { if (isOpenRef.current) startListening(); }, language);
      }

    } else if (currentStep === 'schedule_bill') {
      // Confirmation: NO checked before YES
      const conf = SttMatcherService.matchConfirmation(candidates, language);
      if (conf.matchedValue === 'NO') {
        handleGoBack();
      } else if (conf.matchedValue === 'YES') {
        handleBillProceedToPin();
      } else {
        startListening();
      }

    } else if (currentStep === 'schedule_pin') {
      // Spoken PIN parsed via parsePinSpeech
      const pinRes = parsePinSpeech(raw);
      if (pinRes.status === 'success' && pinRes.digits.length === 4) {
        const fullPin = pinRes.digits.join('');
        verifyAndSaveSchedule(fullPin);
      } else {
        speakText(t('guided.pinQuestion'), () => { if (isOpenRef.current) startListening(); }, language);
      }
    }
  }, [
    handleBillProceedToPin,
    handleCancel,
    handleCustomDurationSet,
    handleDaysModeSet,
    handleGoBack,
    handleOrderNow,
    handleRestaurantChosen,
    handleScheduleDurationSet,
    handleScheduleTimeSet,
    handleStartSchedule,
    handleVarietyChosen,
    handleWeekdaysSet,
    language,
    matchedItems,
    query,
    selectedItem,
    speakText,
    startListening,
    t,
    userLocation.latitude,
    userLocation.longitude,
    varieties,
    verifyAndSaveSchedule
  ]);

  // Reset state on open
  useEffect(() => {
    if (!isOpen) {
      SpeechController.releaseMic(MIC_OWNER);
      isSpeakingRef.current = false;
      setIsListening(false);
      return;
    }
    handledRef.current = false;
    setSilenceCount(0);
    setLiveText('');
    setSpeechError(null);
    setSuccessPopupMsg(null);
    setSelectedRestaurant(null);
    setPinDigits(['', '', '', '']);
    setPinError(null);

    if (matchedItems.length === 1) {
      setSelectedItem(matchedItems[0]);
      setStep('restaurant');
    } else {
      setSelectedItem(null);
      setStep('variety');
    }
  }, [isOpen, matchedItems]);

  // Speak prompt when step changes
  useEffect(() => {
    if (!isOpen || successPopupMsg) return;

    handledRef.current = false;
    setSilenceCount(0);
    setLiveText('');

    if (step === 'variety') {
      const dishLabel = query || 'dish';
      const top3Names = namesToSpeak(varieties.map(v => v.nativeNames?.[language] || v.name));
      const prompt = t('guided.step1Spoken')
        .replace('{dish}', dishLabel)
        .replace('{names}', top3Names);
      speakAndListen(prompt);

    } else if (step === 'restaurant') {
      if (!selectedItem) return;
      const currentRestaurants = getUniqueRestaurants(
        matchedItems.filter(i => i.id === selectedItem.id),
        userLocation.latitude,
        userLocation.longitude
      );
      const itemName = selectedItem.nativeNames?.[language] || selectedItem.name;
      const confirmPrefix = (t('guided.selectedConfirm') || '{item} selected.').replace('{item}', itemName);

      if (currentRestaurants.length === 0) {
        const fallback = selectedItem.restaurant || '';
        if (fallback) {
          const prompt = `${confirmPrefix} ${t('guided.step2SingleConfirm').replace('{restaurant}', fallback)}`;
          speakAndListen(prompt);
        } else {
          setStep('when');
        }
        return;
      }

      if (currentRestaurants.length === 1) {
        const prompt = `${confirmPrefix} ${t('guided.step2SingleConfirm').replace('{restaurant}', currentRestaurants[0])}`;
        speakAndListen(prompt);
      } else {
        const top3Names = namesToSpeak(currentRestaurants);
        const prompt = `${confirmPrefix} ${t('guided.step2Spoken').replace('{names}', top3Names)}`;
        speakAndListen(prompt);
      }

    } else if (step === 'when') {
      const isRestricted = selectedItem ? checkIsItemRestrictedByNominee(selectedItem.id, selectedItem.name) : false;
      const isApproved = selectedItem ? isItemApprovedByNominee(selectedItem.id) : false;
      if (isRestricted && !isApproved) {
        const prompt = `${t('nominee.approvalRequiredBadge')}. ${t('nominee.requestApprovalBtn')}?`;
        speakAndListen(prompt);
      } else {
        const rName = selectedRestaurant || selectedItem?.restaurant || '';
        const confirmPrefix = rName
          ? (t('guided.selectedConfirm') || '{item} selected.').replace('{item}', rName) + ' '
          : '';
        const prompt = `${confirmPrefix}${t('guided.step3Spoken')}`;
        speakAndListen(prompt);
      }

    } else if (step === 'schedule_time') {
      speakAndListen(t('guided.schedTimeQuestion'));

    } else if (step === 'schedule_duration') {
      const ack = (t('guided.timeAck') || 'Time set to {time}.').replace('{time}', schedTimeDisplay);
      speakAndListen(`${ack} ${t('guided.schedDurationQuestion')}`);

    } else if (step === 'schedule_custom_duration') {
      speakAndListen(t('guided.customDurationQuestion'));

    } else if (step === 'schedule_days_mode') {
      const durLabel =
        schedDuration === '1_week' ? t('guided.duration1Week') :
          schedDuration === '1_month' ? t('guided.duration1Month') :
            schedDuration === '3_months' ? t('guided.duration3Months') :
              (customUntilDateDisplay || `${customDaysCount} days`);
      const ack = (t('guided.durationAck') || '{duration}, got it.').replace('{duration}', durLabel);
      speakAndListen(`${ack} ${t('guided.daysModeQuestion')}`);

    } else if (step === 'schedule_weekdays') {
      speakAndListen(t('guided.whichDaysQuestion'));

    } else if (step === 'schedule_bill') {
      const billMsg = (t('guided.billSpoken') || 'Total for {n} deliveries is Rs {total}.')
        .replace('{n}', String(deliveryDates.length))
        .replace('{total}', String(bill.grandTotal));
      speakAndListen(billMsg);

    } else if (step === 'schedule_pin') {
      speakAndListen(t('guided.pinQuestion'));
    }
  }, [step, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    SpeechController.releaseMic(MIC_OWNER);
    clearSilenceTimer();
  }, []);

  const displayRestaurants: string[] = selectedItem
    ? (() => {
      const rs = getUniqueRestaurants(
        matchedItems.filter(i => i.id === selectedItem.id),
        userLocation.latitude,
        userLocation.longitude
      );
      return rs.length > 0 ? rs : (selectedItem.restaurant ? [selectedItem.restaurant] : []);
    })()
    : [];

  if (!isOpen) return null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-[#D93636]/30 overflow-hidden relative">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            {step !== 'variety' && step !== 'schedule_success' && (
              <button
                type="button"
                onClick={handleGoBack}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-[#D93636] hover:text-white text-slate-500 transition-all cursor-pointer"
                title={t('guided.backBtn')}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="p-2 rounded-xl bg-[#D93636]/10 text-[#D93636]">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-500 uppercase tracking-wider">
                {step === 'variety' && t('guided.step1Title').replace('{dish}', query)}
                {step === 'restaurant' && t('guided.step2Title')}
                {step === 'when' && t('guided.step3Title')}
                {step === 'schedule_time' && t('guided.schedTimeTitle')}
                {step === 'schedule_duration' && t('guided.schedDurationQuestion')}
                {step === 'schedule_custom_duration' && t('guided.customDurationQuestion')}
                {step === 'schedule_days_mode' && t('guided.daysModeQuestion')}
                {step === 'schedule_weekdays' && t('guided.whichDaysQuestion')}
                {step === 'schedule_bill' && t('guided.billTitle')}
                {step === 'schedule_pin' && t('guided.pinTitle')}
                {step === 'schedule_success' && 'Order Scheduled'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black ${isListening ? 'bg-[#D93636] text-white animate-pulse' : 'bg-slate-100 text-slate-400'
              }`}>
              {isListening ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
              {isListening ? 'Listening' : 'Tap or Speak'}
            </div>
            <button
              type="button"
              onClick={handleCancel}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live transcript */}
        {liveText && (
          <div className="mx-5 mt-3 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-800 truncate">
            🎙 &ldquo;{liveText}&rdquo;
          </div>
        )}

        {/* On-screen error hint */}
        {speechError && (
          <div className="mx-5 mt-2 px-3 py-1.5 bg-[#FBE9E5] dark:bg-rose-950/30 border border-[#F0E5DC] dark:border-rose-900 rounded-xl text-xs font-bold text-[#33251F] dark:text-rose-300 flex items-center gap-1.5 animate-fade-in">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{speechError}</span>
          </div>
        )}

        {/* ── STEP 1: VARIETY ── */}
        {step === 'variety' && (
          <div className="p-5 space-y-3">
            <p className="text-xs text-slate-500 font-bold">{t('guided.tapHint')}</p>
            <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
              {varieties.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleVarietyChosen(item)}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 bg-[#FBE9E5]/60 hover:bg-[#D93636] hover:text-white rounded-2xl border border-[#F0E5DC] transition-all group cursor-pointer"
                >
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-[#D93636]/20 group-hover:bg-white/20 text-[#D93636] group-hover:text-white text-xs font-black shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black truncate">
                      {item.nativeNames?.[language] || item.name}
                    </p>
                    <p className="text-[10px] opacity-70 truncate">{item.restaurant} · ₹{item.basePrice}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 2: RESTAURANT ── */}
        {step === 'restaurant' && (
          <div className="p-5 space-y-3">
            {selectedItem && (
              <p className="text-xs font-bold text-slate-500">
                {selectedItem.nativeNames?.[language] || selectedItem.name}
                &nbsp;·&nbsp;₹{selectedItem.basePrice}
              </p>
            )}
            <p className="text-xs text-slate-500 font-bold">{t('guided.tapHint')}</p>
            <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
              {displayRestaurants.length === 0 && (
                <button
                  type="button"
                  onClick={() => selectedItem && handleRestaurantChosen(selectedItem.restaurant || '')}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 bg-[#FBE9E5]/60 hover:bg-[#D93636] hover:text-white rounded-2xl border border-[#F0E5DC] transition-all group cursor-pointer"
                >
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-[#D93636]/20 group-hover:bg-white/20 text-xs font-black shrink-0">1</span>
                  <span className="text-sm font-black">{selectedItem?.restaurant || 'Restaurant'}</span>
                </button>
              )}
              {displayRestaurants.map((r, idx) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRestaurantChosen(r)}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 bg-[#FBE9E5]/60 hover:bg-[#D93636] hover:text-white rounded-2xl border border-[#F0E5DC] transition-all group cursor-pointer"
                >
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-[#D93636]/20 group-hover:bg-white/20 text-xs font-black shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-black truncate flex-1">{r}</span>
                  <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 3: WHEN (Order Now or Schedule) ── */}
        {step === 'when' && (() => {
          const isRestricted = selectedItem ? checkIsItemRestrictedByNominee(selectedItem.id, selectedItem.name) : false;
          const isApproved = selectedItem ? isItemApprovedByNominee(selectedItem.id) : false;
          const showOrderButtons = !isRestricted || isApproved;

          return (
            <div className="p-5 space-y-3">
              {selectedItem && (
                <p className="text-xs font-bold text-slate-500">
                  {selectedItem.nativeNames?.[language] || selectedItem.name}
                  &nbsp;·&nbsp;{selectedRestaurant || selectedItem.restaurant}
                </p>
              )}
              {showOrderButtons ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => selectedItem && handleOrderNow(selectedItem)}
                    className="flex flex-col items-center gap-2 px-4 py-5 bg-[#D93636] hover:bg-[#33251F] text-white rounded-2xl shadow-md transition-all cursor-pointer"
                  >
                    <Zap className="w-6 h-6" />
                    <span className="text-sm font-black">{t('guided.nowBtn')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleStartSchedule}
                    className="flex flex-col items-center gap-2 px-4 py-5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl transition-all cursor-pointer"
                  >
                    <Clock className="w-6 h-6" />
                    <span className="text-sm font-black">{t('guided.laterBtn')}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl text-xs font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>{t('nominee.approvalRequiredBadge')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedItem) {
                        onClose();
                        handleNomineeRestrictedInterception(selectedItem, 'instant');
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl shadow-md transition-all cursor-pointer"
                  >
                    <ShieldCheck className="w-5 h-5" />
                    <span className="text-sm font-black">{t('nominee.requestApprovalBtn')}</span>
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── STEP 4: TIME ── */}
        {step === 'schedule_time' && (
          <div className="p-5 space-y-4">
            <p className="text-xs font-bold text-slate-500">{t('guided.schedTimeQuestion')}</p>
            <input
              type="time"
              value={schedTime}
              onChange={e => {
                const val = e.target.value;
                if (!val) return;
                setSchedTime(val);
                const [h, m] = val.split(':').map(Number);
                const ampm = h >= 12 ? 'PM' : 'AM';
                const dh = h % 12 || 12;
                setSchedTimeDisplay(`${dh}:${String(m).padStart(2, '0')} ${ampm}`);
              }}
              className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-[#D93636] rounded-2xl text-xl font-black text-center text-slate-900 dark:text-white focus:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              {[
                { t24: '08:00', label: '8:00 AM' },
                { t24: '13:00', label: '1:00 PM' },
                { t24: '17:00', label: '5:00 PM' },
                { t24: '20:30', label: '8:30 PM' }
              ].map(preset => (
                <button
                  key={preset.t24}
                  type="button"
                  onClick={() => {
                    const [h, m] = preset.t24.split(':').map(Number);
                    handleScheduleTimeSet({
                      time24: preset.t24,
                      displayTime: preset.label,
                      hours: h,
                      minutes: m
                    });
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${schedTime === preset.t24
                    ? 'bg-[#D93636] text-white border-[#D93636]'
                    : 'bg-[#FBE9E5] text-[#33251F] border-[#F0E5DC] hover:bg-[#D93636] hover:text-white'
                    }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                const safeTime = normalizeTime(schedTime);
                const [h, m] = safeTime.split(':').map(Number);
                handleScheduleTimeSet({
                  time24: safeTime,
                  displayTime: schedTimeDisplay,
                  hours: h,
                  minutes: m
                });
              }}
              className="w-full py-3.5 bg-[#D93636] hover:bg-[#33251F] text-white font-black rounded-2xl shadow-md transition-all cursor-pointer"
            >
              {t('guided.continueBtn')} ({schedTimeDisplay}) ✓
            </button>
          </div>
        )}

        {/* ── STEP 5: DURATION ── */}
        {step === 'schedule_duration' && (
          <div className="p-5 space-y-3">
            <p className="text-xs font-bold text-slate-500">{t('guided.schedDurationQuestion')}</p>
            <div className="grid grid-cols-1 gap-2.5">
              {[
                { type: '1_week' as const, label: t('guided.duration1Week'), desc: '7 days schedule' },
                { type: '1_month' as const, label: t('guided.duration1Month'), desc: '30 days schedule' },
                { type: '3_months' as const, label: t('guided.duration3Months'), desc: '90 days schedule' },
                { type: 'custom' as const, label: t('guided.durationCustom'), desc: 'Specify days or end date' }
              ].map(opt => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => handleScheduleDurationSet(opt.type)}
                  className="w-full text-left flex items-center gap-3.5 px-4 py-3.5 bg-[#FBE9E5]/60 hover:bg-[#D93636] hover:text-white rounded-2xl border border-[#F0E5DC] transition-all group cursor-pointer"
                >
                  <div className="p-2 rounded-xl bg-[#D93636]/15 group-hover:bg-white/20 text-[#D93636] group-hover:text-white shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black">{opt.label}</p>
                    <p className="text-[11px] opacity-70">{opt.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 6: CUSTOM DURATION (Days count or Until date) ── */}
        {step === 'schedule_custom_duration' && (
          <div className="p-5 space-y-4">
            <p className="text-xs font-bold text-slate-500">{t('guided.customDurationQuestion')}</p>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">
                  {language === 'ta' ? 'நாட்களின் எண்ணிக்கை (1 - 180):' : language === 'hi' ? 'दिनों की संख्या (1 - 180):' : 'Number of Days (1 - 180):'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={customDaysCount}
                    onChange={e => setCustomDaysCount(parseInt(e.target.value, 10) || 1)}
                    className="flex-1 py-2.5 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-[#D93636] rounded-2xl text-lg font-black text-center"
                  />
                  <button
                    type="button"
                    onClick={() => handleCustomDurationSet({ type: 'days', count: customDaysCount })}
                    className="py-2.5 px-5 bg-[#D93636] hover:bg-[#33251F] text-white font-black rounded-2xl text-xs cursor-pointer"
                  >
                    Set Days
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-black text-slate-400">
                <div className="flex-1 border-t border-slate-200 dark:border-slate-800"></div>
                <span>OR</span>
                <div className="flex-1 border-t border-slate-200 dark:border-slate-800"></div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">
                  {language === 'ta' ? 'குறிப்பிட்ட முடிவு தேதி:' : language === 'hi' ? 'अंतिम तारीख:' : 'Until Specific Date:'}
                </label>
                <input
                  type="date"
                  min={getTodayDateStr()}
                  value={customUntilDate}
                  onChange={e => {
                    const val = e.target.value;
                    setCustomUntilDate(val);
                    if (val) {
                      handleCustomDurationSet({ type: 'until_date', dateStr: val, displayDate: val });
                    }
                  }}
                  className="w-full py-2.5 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-[#D93636] rounded-2xl text-sm font-black text-center"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 7: DAYS MODE (All Days vs Particular Days) ── */}
        {step === 'schedule_days_mode' && (
          <div className="p-5 space-y-3">
            <p className="text-xs font-bold text-slate-500">{t('guided.daysModeQuestion')}</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleDaysModeSet('all_days')}
                className="flex flex-col items-center gap-2 p-5 bg-[#FBE9E5]/60 hover:bg-[#D93636] hover:text-white rounded-2xl border border-[#F0E5DC] transition-all cursor-pointer group"
              >
                <Calendar className="w-6 h-6 text-[#D93636] group-hover:text-white" />
                <span className="text-sm font-black">{t('guided.daysModeAll')}</span>
                <span className="text-[10px] opacity-70">Daily delivery</span>
              </button>
              <button
                type="button"
                onClick={() => handleDaysModeSet('particular_days')}
                className="flex flex-col items-center gap-2 p-5 bg-[#FBE9E5]/60 hover:bg-[#D93636] hover:text-white rounded-2xl border border-[#F0E5DC] transition-all cursor-pointer group"
              >
                <Clock className="w-6 h-6 text-[#D93636] group-hover:text-white" />
                <span className="text-sm font-black">{t('guided.daysModeParticular')}</span>
                <span className="text-[10px] opacity-70">Custom weekdays</span>
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 8: PARTICULAR WEEKDAYS ── */}
        {step === 'schedule_weekdays' && (
          <div className="p-5 space-y-4">
            <p className="text-xs font-bold text-slate-500">{t('guided.whichDaysQuestion')}</p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSchedDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])}
                className="px-2.5 py-1 text-[11px] font-black rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-[#D93636] hover:text-white transition-all cursor-pointer"
              >
                Weekdays
              </button>
              <button
                type="button"
                onClick={() => setSchedDays(['Saturday', 'Sunday'])}
                className="px-2.5 py-1 text-[11px] font-black rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-[#D93636] hover:text-white transition-all cursor-pointer"
              >
                Weekends
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {ALL_DAYS.map(day => {
                const isSelected = schedDays.includes(day);
                const label = DAY_LABELS[day]?.[language] || day.slice(0, 3);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`py-2 px-2 rounded-xl text-xs font-black border transition-all text-center cursor-pointer ${isSelected
                      ? 'bg-[#D93636] text-white border-[#D93636] shadow-sm'
                      : 'bg-[#FBE9E5] text-[#33251F] border-[#F0E5DC] hover:bg-[#D93636]/20'
                      }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => handleWeekdaysSet(schedDays)}
              disabled={schedDays.length === 0}
              className="w-full py-3.5 bg-[#D93636] hover:bg-[#33251F] disabled:opacity-50 text-white font-black rounded-2xl shadow-md transition-all cursor-pointer"
            >
              {t('guided.continueBtn')} ({schedDays.length} days selected) ✓
            </button>
          </div>
        )}

        {/* ── STEP 9: FULL BILL PREVIEW & GST ── */}
        {step === 'schedule_bill' && (
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Header info */}
            <div className="bg-[#FBE9E5]/60 p-3.5 rounded-2xl border border-[#F0E5DC] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#D93636] block">
                  {selectedRestaurant || selectedItem?.restaurant}
                </span>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  {selectedItem?.nativeNames?.[language] || selectedItem?.name}
                </h4>
              </div>
              <span className="text-xs font-black bg-[#D93636] text-white px-3 py-1 rounded-full shadow-sm">
                {deliveryDates.length} {language === 'ta' ? 'நாட்கள்' : language === 'hi' ? 'दिन' : 'Deliveries'}
              </span>
            </div>

            {/* Financial Breakdown */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs font-bold text-slate-700 dark:text-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('guided.itemsSubtotal')}:</span>
                <span className="font-mono font-black">₹{bill.itemSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('guided.deliveryFee')}:</span>
                <span className="font-mono font-black">₹{bill.totalDeliveryFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('guided.platformFee')}:</span>
                <span className="font-mono font-black">₹{bill.totalPlatformFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('guided.gstTax')}:</span>
                <span className="font-mono font-black">₹{bill.totalGstTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 font-black text-slate-900 dark:text-white">
                <span>{t('guided.perOrderTotal')}:</span>
                <span className="font-mono text-[#D93636]">₹{bill.perOrderTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t-2 border-[#D93636]/30 pt-2 text-sm font-black text-slate-900 dark:text-white">
                <span>{t('guided.grandTotal')}:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 text-base">₹{bill.grandTotal}</span>
              </div>
            </div>

            {/* Delivery Dates preview */}
            <div>
              <p className="text-[11px] font-bold text-slate-500 mb-1.5">
                📅 Delivery Dates ({deliveryDates.length}):
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
                {deliveryDates.map(d => (
                  <span key={d} className="px-2 py-0.5 bg-white dark:bg-slate-700 text-[10px] font-mono font-black rounded-md border border-slate-200 dark:border-slate-600">
                    {d}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleBillProceedToPin}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-5 h-5" />
                <span>{t('guided.proceedPinBtn')} (₹{bill.grandTotal})</span>
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 10: SECURITY PIN ── */}
        {step === 'schedule_pin' && (
          <div className="p-5 space-y-4">
            <div className="text-center space-y-1">
              <div className="w-10 h-10 rounded-2xl bg-[#D93636]/10 text-[#D93636] flex items-center justify-center mx-auto">
                <Lock className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                {t('guided.pinQuestion')}
              </h4>
              <p className="text-[11px] text-slate-400 font-bold">
                {language === 'ta' ? '4 இலக்க எண்ணை சொல்லுங்கள் அல்லது விசைப்பலகையைப் பயன்படுத்தவும்' : language === 'hi' ? '4 अंकों का पिन बोलें या कीपैड का उपयोग करें' : 'Speak 4-digit PIN or tap numbers below'}
              </p>
            </div>

            {/* Masked PIN Display Circles (Never logs or reveals digits) */}
            <div className="flex justify-center items-center gap-4 py-2">
              {[0, 1, 2, 3].map(idx => (
                <div
                  key={idx}
                  className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center transition-all ${pinDigits[idx] !== ''
                    ? 'border-[#D93636] bg-[#D93636]/10 text-[#D93636]'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
                    }`}
                >
                  {pinDigits[idx] !== '' ? (
                    <span className="w-3.5 h-3.5 rounded-full bg-[#D93636]"></span>
                  ) : (
                    <span className="text-slate-300 dark:text-slate-600 text-xs font-mono">•</span>
                  )}
                </div>
              ))}
            </div>

            {/* Error or Lockout Display */}
            {pinError && (
              <div className="px-3 py-1.5 bg-[#FBE9E5] dark:bg-rose-950/40 border border-[#F0E5DC] dark:border-rose-900 rounded-xl text-xs font-bold text-[#33251F] dark:text-rose-300 text-center animate-fade-in">
                {pinError}
              </div>
            )}

            {/* Masked Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleKeypadDigit(d)}
                  disabled={isPinVerifying || pinLockSeconds > 0}
                  className="py-3 bg-slate-100 dark:bg-slate-800 hover:bg-[#D93636] hover:text-white rounded-2xl text-base font-black text-slate-900 dark:text-white transition-all cursor-pointer disabled:opacity-40"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={handleKeypadClear}
                disabled={isPinVerifying || pinLockSeconds > 0}
                className="py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 rounded-2xl transition-all cursor-pointer disabled:opacity-40"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleKeypadDigit('0')}
                disabled={isPinVerifying || pinLockSeconds > 0}
                className="py-3 bg-slate-100 dark:bg-slate-800 hover:bg-[#D93636] hover:text-white rounded-2xl text-base font-black text-slate-900 dark:text-white transition-all cursor-pointer disabled:opacity-40"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleKeypadBackspace}
                disabled={isPinVerifying || pinLockSeconds > 0}
                className="py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl flex items-center justify-center transition-all cursor-pointer disabled:opacity-40"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 11: SUCCESS POPUP ── */}
        {step === 'schedule_success' && successPopupMsg && (
          <div className="p-6 text-center space-y-4 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 animate-bounce" />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              {successPopupMsg}
            </h3>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 text-xs font-bold text-emerald-800 dark:text-emerald-300 space-y-1">
              <p>🕒 {schedTimeDisplay}&nbsp;&nbsp;·&nbsp;&nbsp;{deliveryDates.length} Deliveries</p>
              <p>💰 Grand Total: ₹{bill.grandTotal}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 bg-[#D93636] hover:bg-[#33251F] text-white font-black rounded-2xl shadow-md transition-all cursor-pointer"
            >
              Done ✓
            </button>
          </div>
        )}

        {/* Footer hint */}
        <div className="px-5 pb-4 pt-0">
          <p className="text-[10px] text-slate-400 text-center font-bold">
            {isListening
              ? (language === 'ta' ? '🎙️ கேட்கிறேன்...' : language === 'hi' ? '🎙️ सुन रहा हूँ...' : '🎙️ Listening…')
              : t('guided.tapHint')}
          </p>
        </div>
      </div>
    </div>
  );
};
