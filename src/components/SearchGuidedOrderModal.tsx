/**
 * SearchGuidedOrderModal.tsx
 *
 * Spoken + listened guided dialog launched whenever a search query matches
 * generic or multi-variety items. Extended with a complete scheduling dialog
 * flow across English, Tamil, and Hindi.
 *
 * Flow:
 * 1. variety: Which variety?
 * 2. restaurant: Which restaurant?
 * 3. when: Order now or schedule for later?
 * 4. schedule_time: At what time?
 * 5. schedule_repeat: Weekly, Monthly, or Custom date?
 * 6. schedule_days (if weekly) / schedule_monthday (if monthly) / schedule_customdate (if custom)
 * 7. schedule_confirm: Spoken summary, Yes/No confirmation (NO checked before YES)
 * 8. schedule_change (if NO): Select what to change
 * 9. Result popup: Scheduled order confirmed
 *
 * Rules:
 * - TTS starts immediately; STT starts as soon as TTS finishes.
 * - Tap and voice call the same handlers, guarded against double-firing.
 * - Cancel-intent closes immediately.
 * - Restricted-item check delegated to existing nominee flow untouched.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { FoodItem, AutoOrderSchedule } from '../types';
import { SpeechController } from '../services/speechController';
import { SttMatcherService } from '../services/sttMatcherService';
import { deriveMealSlot } from '../services/timeVoiceParser';
import { calculateHaversineDistance } from '../services/locationService';
import { AutoOrderBackgroundService } from '../services/autoOrderBackgroundService';
import {
  matchOptionByTokens,
  classifyOrderNowOrSchedule,
  normalizeInputText
} from '../services/guidedMatchingService';
import {
  parseTime,
  parseRepeatType,
  parseDays,
  parseDayOfMonth,
  parseCustomDate,
  buildSummary,
  parseChangeTarget,
  RepeatType,
  CustomDateResult,
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
  RotateCcw,
  CheckCircle2
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

type GuidedStep =
  | 'variety'
  | 'restaurant'
  | 'when'
  | 'schedule_time'
  | 'schedule_repeat'
  | 'schedule_days'
  | 'schedule_monthday'
  | 'schedule_customdate'
  | 'schedule_confirm'
  | 'schedule_change';

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

// ─── Date formatting helpers ────────────────────────────────────────────────

const getTodayDateStr = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getTomorrowDateStr = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatCustomDateDisplay = (dateStr: string): string => {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  if (isNaN(d.getTime())) return dateStr;
  const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${d.getDate()} ${monthNamesEn[d.getMonth()]} ${d.getFullYear()}`;
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

// ─── Deduplicate restaurants from matched items ──────────────────────────────

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
  const [schedRepeatType, setSchedRepeatType] = useState<RepeatType>('weekly');
  const [schedDays, setSchedDays] = useState<string[]>(['Monday', 'Thursday']);
  const [schedMonthDay, setSchedMonthDay] = useState<number>(1);
  const [schedCustomDate, setSchedCustomDate] = useState<string>(getTomorrowDateStr);
  const [schedCustomDateDisplay, setSchedCustomDateDisplay] = useState<string>(() => formatCustomDateDisplay(getTomorrowDateStr()));
  const [schedSuccessPopup, setSchedSuccessPopup] = useState<string | null>(null);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const handledRef = useRef(false);
  const stepRef = useRef<GuidedStep>('variety');
  const isSpeakingRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOpenRef = useRef(false);

  useEffect(() => { stepRef.current = step; }, [step]);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  const varieties = matchedItems;

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
        if (isOpenRef.current && !isSpeakingRef.current && !schedSuccessPopup) {
          setTimeout(() => {
            if (isOpenRef.current && !isSpeakingRef.current && !schedSuccessPopup) startListening();
          }, 400);
        }
      }
    });
  }, [language, schedSuccessPopup]);

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

  // ── Step handlers ─────────────────────────────────────────────────────────

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

  // Start scheduling flow
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

  // Time step handler
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
    setStep('schedule_repeat');
  }, []);

  // Repeat step handler
  const handleScheduleRepeatSet = useCallback((type: RepeatType) => {
    if (handledRef.current) return;
    handledRef.current = true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    SpeechController.releaseMic(MIC_OWNER);
    setSchedRepeatType(type);
    handledRef.current = false;
    setSilenceCount(0);
    setLiveText('');
    setSpeechError(null);

    if (type === 'weekly') {
      setStep('schedule_days');
    } else if (type === 'monthly') {
      setStep('schedule_monthday');
    } else {
      setStep('schedule_customdate');
    }
  }, []);

  // Days step handler (Weekly)
  const handleScheduleDaysSet = useCallback((days: string[]) => {
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
    setStep('schedule_confirm');
  }, []);

  // Day of Month handler (Monthly)
  const handleScheduleMonthDaySet = useCallback((day: number) => {
    if (handledRef.current || day < 1 || day > 31) return;
    handledRef.current = true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    SpeechController.releaseMic(MIC_OWNER);
    setSchedMonthDay(day);
    handledRef.current = false;
    setSilenceCount(0);
    setLiveText('');
    setSpeechError(null);
    setStep('schedule_confirm');
  }, []);

  // Custom Date handler
  const handleScheduleCustomDateSet = useCallback((dateResult: CustomDateResult) => {
    if (handledRef.current) return;
    if (dateResult.isPast) {
      const pastErr = t('guided.pastDateError');
      setSpeechError(pastErr);
      speakText(pastErr, () => { if (isOpenRef.current) startListening(); }, language);
      return;
    }
    handledRef.current = true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    SpeechController.releaseMic(MIC_OWNER);
    setSchedCustomDate(dateResult.dateStr);
    setSchedCustomDateDisplay(dateResult.displayDate);
    handledRef.current = false;
    setSilenceCount(0);
    setLiveText('');
    setSpeechError(null);
    setStep('schedule_confirm');
  }, [language, speakText, startListening, t]);

  // Confirm YES -> execute save schedule
  const handleScheduleConfirmYes = useCallback(() => {
    if (handledRef.current || !selectedItem) return;
    handledRef.current = true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    SpeechController.releaseMic(MIC_OWNER);

    // 1. Delegate restricted items to existing nominee flow untouched
    const isRestricted = checkIsItemRestrictedByNominee(selectedItem.id, selectedItem.name);
    if (isRestricted) {
      onClose();
      handleNomineeRestrictedInterception(selectedItem, 'scheduled', {
        time: schedTime,
        slotName: `${deriveMealSlot(parseInt(schedTime.split(':')[0], 10))} Schedule`,
        frequency: schedRepeatType === 'weekly' ? 'weekly' : (schedRepeatType === 'monthly' ? 'custom' : 'once')
      });
      return;
    }

    // 2. Save schedule via existing scheduler
    const hours = parseInt(schedTime.split(':')[0], 10) || 8;
    const slotIdx = deriveSlotIndex(hours);
    const slot = deriveMealSlot(hours);
    const newSchedule: AutoOrderSchedule = {
      id: `sched-${Date.now()}`,
      slotName: `${slot} Schedule`,
      slotIndex: slotIdx,
      time: schedTime,
      frequency: schedRepeatType === 'weekly' ? 'weekly' : (schedRepeatType === 'monthly' ? 'custom' : 'once'),
      selectedDays: schedRepeatType === 'weekly' ? schedDays : undefined,
      foodItemId: selectedItem.id,
      foodItemName: selectedItem.name,
      restaurant: selectedRestaurant || selectedItem.restaurant || 'Restaurant',
      quantity: 1,
      strategy: 'best_value',
      isEnabled: true,
      walletAutoDebit: true,
      duration: schedRepeatType === 'custom' ? 'custom' : (schedRepeatType === 'monthly' ? '3_months' : '1_month'),
      startDate: schedRepeatType === 'custom' ? schedCustomDate : undefined,
      endDate: schedRepeatType === 'custom' ? schedCustomDate : undefined,
      notes: schedRepeatType === 'monthly' ? `monthlyDay: ${schedMonthDay}` : undefined
    };

    try {
      AutoOrderBackgroundService.saveSchedule(newSchedule);
      if (typeof saveSchedule === 'function') {
        saveSchedule(newSchedule);
      }
      const successMsg = t('guided.schedSuccessPopup');
      setSchedSuccessPopup(successMsg);
      showToast(successMsg);
      speakText(successMsg, () => {
        setTimeout(() => {
          onClose();
        }, 1500);
      }, language);
    } catch (err) {
      console.error('[GuidedDialog] Schedule save error:', err);
      const errMsg = t('guided.schedSaveError');
      setSpeechError(errMsg);
      speakText(errMsg, undefined, language);
      handledRef.current = false;
    }
  }, [
    checkIsItemRestrictedByNominee,
    handleNomineeRestrictedInterception,
    language,
    onClose,
    saveSchedule,
    schedCustomDate,
    schedDays,
    schedMonthDay,
    schedRepeatType,
    schedTime,
    selectedItem,
    selectedRestaurant,
    showToast,
    speakText,
    t
  ]);

  // Confirm NO -> ask what to change
  const handleScheduleConfirmNo = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    SpeechController.releaseMic(MIC_OWNER);
    handledRef.current = false;
    setSilenceCount(0);
    setLiveText('');
    setSpeechError(null);
    setStep('schedule_change');
  }, []);

  // Jump to specific step from change menu
  const handleScheduleChangeTarget = useCallback((target: 'time' | 'repeat' | 'days' | 'restaurant') => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    SpeechController.releaseMic(MIC_OWNER);
    handledRef.current = false;
    setSilenceCount(0);
    setLiveText('');
    setSpeechError(null);

    if (target === 'time') {
      setStep('schedule_time');
    } else if (target === 'repeat') {
      setStep('schedule_repeat');
    } else if (target === 'days') {
      if (schedRepeatType === 'weekly') {
        setStep('schedule_days');
      } else if (schedRepeatType === 'monthly') {
        setStep('schedule_monthday');
      } else {
        setStep('schedule_customdate');
      }
    } else if (target === 'restaurant') {
      setStep('restaurant');
    }
  }, [schedRepeatType]);

  // Toggle single day chip
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

  // ── Voice result router ───────────────────────────────────────────────────
  const handleVoiceResult = useCallback((candidates: string[]) => {
    const raw = candidates[0] || '';

    if (isCancelIntent(raw)) {
      handleCancel();
      return;
    }

    const currentStep = stepRef.current;

    if (currentStep === 'variety') {
      const decision = matchOptionByTokens(raw, varieties, language);
      console.log('[GuidedDialog]', {
        step: currentStep,
        heard: raw,
        normalized: normalizeInputText(raw),
        candidates: decision.scored.map(s => ({ label: s.label, score: parseFloat(s.score.toFixed(2)) })),
        chosen: decision.chosen ? (decision.chosen as FoodItem).name : null,
        reason: decision.reason
      });

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
        if (conf.matchedValue === 'YES') {
          handleRestaurantChosen(restaurantList[0]);
        } else if (conf.matchedValue === 'NO') {
          handleCancel();
        } else {
          startListening();
        }
      } else {
        const decision = matchOptionByTokens(raw, restaurantList, language);
        if (decision.chosen) {
          handleRestaurantChosen(decision.chosen as string);
        } else if (decision.isTie && decision.tieCandidates) {
          const [a, b] = decision.tieCandidates as [string, string];
          const tieMsg = (t('guided.tiePrompt') || 'Did you mean {nameA}, or {nameB}?')
            .replace('{nameA}', a)
            .replace('{nameB}', b);
          speakText(tieMsg, () => { if (isOpenRef.current) startListening(); }, language);
        } else {
          startListening();
        }
      }

    } else if (currentStep === 'when') {
      const intent = classifyOrderNowOrSchedule(raw);
      console.log('[GuidedDialog]', {
        step: currentStep,
        heard: raw,
        normalized: normalizeInputText(raw),
        candidates: [{ label: 'NOW', score: intent === 'NOW' ? 1 : 0 }, { label: 'SCHEDULE', score: intent === 'SCHEDULE' ? 1 : 0 }],
        chosen: intent === 'UNKNOWN' ? null : intent,
        reason: `classifyOrderNowOrSchedule → ${intent}`
      });

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

    } else if (currentStep === 'schedule_time') {
      const parsed = parseTime(raw);
      console.log('[GuidedDialog]', {
        step: currentStep,
        heard: raw,
        normalized: normalizeInputText(raw),
        candidates: [],
        chosen: parsed ? parsed.time24 : null,
        reason: parsed ? `parsed time: ${parsed.time24}` : 'time parse failed'
      });
      if (parsed) {
        handleScheduleTimeSet(parsed);
      } else {
        speakText(t('guided.timeReask'), () => { if (isOpenRef.current) startListening(); }, language);
      }

    } else if (currentStep === 'schedule_repeat') {
      const rType = parseRepeatType(raw);
      console.log('[GuidedDialog]', {
        step: currentStep,
        heard: raw,
        normalized: normalizeInputText(raw),
        candidates: [],
        chosen: rType,
        reason: rType ? `parsed repeat: ${rType}` : 'repeat parse failed'
      });
      if (rType) {
        handleScheduleRepeatSet(rType);
      } else {
        speakText(t('guided.repeatReask'), () => { if (isOpenRef.current) startListening(); }, language);
      }

    } else if (currentStep === 'schedule_days') {
      const days = parseDays(raw);
      console.log('[GuidedDialog]', {
        step: currentStep,
        heard: raw,
        normalized: normalizeInputText(raw),
        candidates: [],
        chosen: days,
        reason: days ? `parsed days: ${days.join(', ')}` : 'days parse failed'
      });
      if (days && days.length > 0) {
        handleScheduleDaysSet(days);
      } else {
        speakText(t('guided.daysReask'), () => { if (isOpenRef.current) startListening(); }, language);
      }

    } else if (currentStep === 'schedule_monthday') {
      const mDay = parseDayOfMonth(raw);
      console.log('[GuidedDialog]', {
        step: currentStep,
        heard: raw,
        normalized: normalizeInputText(raw),
        candidates: [],
        chosen: mDay,
        reason: mDay ? `parsed month day: ${mDay}` : 'month day parse failed'
      });
      if (mDay) {
        handleScheduleMonthDaySet(mDay);
      } else {
        speakText(t('guided.monthDayReask'), () => { if (isOpenRef.current) startListening(); }, language);
      }

    } else if (currentStep === 'schedule_customdate') {
      const cDate = parseCustomDate(raw);
      console.log('[GuidedDialog]', {
        step: currentStep,
        heard: raw,
        normalized: normalizeInputText(raw),
        candidates: [],
        chosen: cDate ? cDate.dateStr : null,
        reason: cDate ? `parsed date: ${cDate.dateStr} (isPast: ${cDate.isPast})` : 'custom date parse failed'
      });
      if (cDate) {
        if (cDate.isPast) {
          setSpeechError(t('guided.pastDateError'));
          speakText(t('guided.pastDateError'), () => { if (isOpenRef.current) startListening(); }, language);
        } else {
          handleScheduleCustomDateSet(cDate);
        }
      } else {
        speakText(t('guided.customDateReask'), () => { if (isOpenRef.current) startListening(); }, language);
      }

    } else if (currentStep === 'schedule_confirm') {
      // RULE: NO checked before YES
      const conf = SttMatcherService.matchConfirmation(candidates, language);
      console.log('[GuidedDialog]', {
        step: currentStep,
        heard: raw,
        normalized: normalizeInputText(raw),
        candidates: [{ label: 'CONFIRM', score: conf.matchedValue }],
        chosen: conf.matchedValue,
        reason: `matchConfirmation: ${conf.matchedValue}`
      });
      if (conf.matchedValue === 'NO') {
        handleScheduleConfirmNo();
      } else if (conf.matchedValue === 'YES') {
        handleScheduleConfirmYes();
      } else {
        speakText(t('guided.confirmReask'), () => { if (isOpenRef.current) startListening(); }, language);
      }

    } else if (currentStep === 'schedule_change') {
      const target = parseChangeTarget(raw);
      console.log('[GuidedDialog]', {
        step: currentStep,
        heard: raw,
        normalized: normalizeInputText(raw),
        candidates: [],
        chosen: target,
        reason: `parseChangeTarget: ${target}`
      });
      if (target) {
        handleScheduleChangeTarget(target);
      } else {
        speakText(t('guided.changeQuestion'), () => { if (isOpenRef.current) startListening(); }, language);
      }
    }
  }, [
    handleCancel,
    handleOrderNow,
    handleRestaurantChosen,
    handleScheduleChangeTarget,
    handleScheduleConfirmNo,
    handleScheduleConfirmYes,
    handleScheduleCustomDateSet,
    handleScheduleDaysSet,
    handleScheduleMonthDaySet,
    handleScheduleRepeatSet,
    handleScheduleTimeSet,
    handleStartSchedule,
    handleVarietyChosen,
    language,
    matchedItems,
    query,
    selectedItem,
    speakText,
    startListening,
    t,
    userLocation.latitude,
    userLocation.longitude,
    varieties
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
    setSchedSuccessPopup(null);
    setSelectedRestaurant(null);

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
    if (!isOpen || schedSuccessPopup) return;

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
      const rName = selectedRestaurant || selectedItem?.restaurant || '';
      const confirmPrefix = rName
        ? (t('guided.selectedConfirm') || '{item} selected.').replace('{item}', rName) + ' '
        : '';
      const prompt = `${confirmPrefix}${t('guided.step3Spoken')}`;
      speakAndListen(prompt);

    } else if (step === 'schedule_time') {
      speakAndListen(t('guided.schedTimeQuestion'));

    } else if (step === 'schedule_repeat') {
      const ack = (t('guided.timeAck') || 'Time set to {time}.').replace('{time}', schedTimeDisplay);
      speakAndListen(`${ack} ${t('guided.schedRepeatQuestion')}`);

    } else if (step === 'schedule_days') {
      const ack = (t('guided.repeatAck') || '{type} selected.').replace('{type}', t('guided.repeatWeekly'));
      speakAndListen(`${ack} ${t('guided.schedDaysQuestion')}`);

    } else if (step === 'schedule_monthday') {
      const ack = (t('guided.repeatAck') || '{type} selected.').replace('{type}', t('guided.repeatMonthly'));
      speakAndListen(`${ack} ${t('guided.schedMonthDayQuestion')}`);

    } else if (step === 'schedule_customdate') {
      const ack = (t('guided.repeatAck') || '{type} selected.').replace('{type}', t('guided.repeatCustom'));
      speakAndListen(`${ack} ${t('guided.schedCustomDateQuestion')}`);

    } else if (step === 'schedule_confirm') {
      const itemName = selectedItem?.nativeNames?.[language] || selectedItem?.name || 'Dish';
      const restName = selectedRestaurant || selectedItem?.restaurant || 'Restaurant';
      const summary = buildSummary({
        foodItemName: itemName,
        restaurant: restName,
        repeatType: schedRepeatType,
        timeDisplay: schedTimeDisplay,
        days: schedDays,
        dayOfMonth: schedMonthDay,
        customDate: schedCustomDateDisplay || schedCustomDate
      }, language);
      speakAndListen(summary);

    } else if (step === 'schedule_change') {
      speakAndListen(t('guided.changeQuestion'));
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
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-[#FF5A1F]/30 overflow-hidden relative">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#FF5A1F]/10 text-[#FF5A1F]">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-500 uppercase tracking-wider">
                {step === 'variety' && t('guided.step1Title').replace('{dish}', query)}
                {step === 'restaurant' && t('guided.step2Title')}
                {step === 'when' && t('guided.step3Title')}
                {step === 'schedule_time' && t('guided.schedTimeTitle')}
                {step === 'schedule_repeat' && t('guided.schedRepeatTitle')}
                {step === 'schedule_days' && t('guided.schedDaysTitle')}
                {step === 'schedule_monthday' && t('guided.schedMonthDayTitle')}
                {step === 'schedule_customdate' && t('guided.schedCustomDateTitle')}
                {step === 'schedule_confirm' && t('guided.schedConfirmTitle')}
                {step === 'schedule_change' && t('guided.changeTitle')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black ${
              isListening ? 'bg-[#C2185B] text-white animate-pulse' : 'bg-slate-100 text-slate-400'
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
          <div className="mx-5 mt-2 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5 animate-fade-in">
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
                  className="w-full text-left flex items-center gap-3 px-4 py-3 bg-[#DAF0F7]/60 hover:bg-[#FF5A1F] hover:text-white rounded-2xl border border-[#B2E2F0] transition-all group cursor-pointer"
                >
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-[#FF5A1F]/20 group-hover:bg-white/20 text-[#FF5A1F] group-hover:text-white text-xs font-black shrink-0">
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
                  className="w-full text-left flex items-center gap-3 px-4 py-3 bg-[#DAF0F7]/60 hover:bg-[#FF5A1F] hover:text-white rounded-2xl border border-[#B2E2F0] transition-all group cursor-pointer"
                >
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-[#FF5A1F]/20 group-hover:bg-white/20 text-xs font-black shrink-0">1</span>
                  <span className="text-sm font-black">{selectedItem?.restaurant || 'Restaurant'}</span>
                </button>
              )}
              {displayRestaurants.map((r, idx) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRestaurantChosen(r)}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 bg-[#DAF0F7]/60 hover:bg-[#FF5A1F] hover:text-white rounded-2xl border border-[#B2E2F0] transition-all group cursor-pointer"
                >
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-[#FF5A1F]/20 group-hover:bg-white/20 text-xs font-black shrink-0">
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
        {step === 'when' && (
          <div className="p-5 space-y-3">
            {selectedItem && (
              <p className="text-xs font-bold text-slate-500">
                {selectedItem.nativeNames?.[language] || selectedItem.name}
                &nbsp;·&nbsp;{selectedRestaurant || selectedItem.restaurant}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => selectedItem && handleOrderNow(selectedItem)}
                className="flex flex-col items-center gap-2 px-4 py-5 bg-[#FF5A1F] hover:bg-[#E04810] text-white rounded-2xl shadow-md transition-all cursor-pointer"
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
          </div>
        )}

        {/* ── STEP 4: SCHEDULE TIME ── */}
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
              className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-[#FF5A1F] rounded-2xl text-xl font-black text-center text-slate-900 dark:text-white focus:outline-none"
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                    schedTime === preset.t24
                      ? 'bg-[#FF5A1F] text-white border-[#FF5A1F]'
                      : 'bg-[#DAF0F7] text-[#1A1110] border-[#B2E2F0] hover:bg-[#FF5A1F] hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                const [h, m] = schedTime.split(':').map(Number);
                handleScheduleTimeSet({
                  time24: schedTime,
                  displayTime: schedTimeDisplay,
                  hours: h,
                  minutes: m
                });
              }}
              className="w-full py-3.5 bg-[#FF5A1F] hover:bg-[#E04810] text-white font-black rounded-2xl shadow-md transition-all cursor-pointer"
            >
              {t('guided.continueBtn')} ({schedTimeDisplay}) ✓
            </button>
          </div>
        )}

        {/* ── STEP 5: SCHEDULE REPEAT ── */}
        {step === 'schedule_repeat' && (
          <div className="p-5 space-y-3">
            <p className="text-xs font-bold text-slate-500">{t('guided.schedRepeatQuestion')}</p>
            <div className="grid grid-cols-1 gap-2.5">
              {[
                { type: 'weekly' as const, label: t('guided.repeatWeekly'), desc: 'Deliver every week on chosen days', icon: Calendar },
                { type: 'monthly' as const, label: t('guided.repeatMonthly'), desc: 'Deliver once every month on a set date', icon: Clock },
                { type: 'custom' as const, label: t('guided.repeatCustom'), desc: 'Deliver once on a specific future date', icon: Check }
              ].map(opt => {
                const IconComp = opt.icon;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => handleScheduleRepeatSet(opt.type)}
                    className="w-full text-left flex items-center gap-3.5 px-4 py-3.5 bg-[#DAF0F7]/60 hover:bg-[#FF5A1F] hover:text-white rounded-2xl border border-[#B2E2F0] transition-all group cursor-pointer"
                  >
                    <div className="p-2 rounded-xl bg-[#FF5A1F]/15 group-hover:bg-white/20 text-[#FF5A1F] group-hover:text-white shrink-0">
                      <IconComp className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-black">{opt.label}</p>
                      <p className="text-[11px] opacity-70">{opt.desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── STEP 6A: WEEKLY DAYS ── */}
        {step === 'schedule_days' && (
          <div className="p-5 space-y-4">
            <p className="text-xs font-bold text-slate-500">{t('guided.schedDaysQuestion')}</p>
            
            {/* Presets */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSchedDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])}
                className="px-2.5 py-1 text-[11px] font-black rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-[#FF5A1F] hover:text-white transition-all cursor-pointer"
              >
                Weekdays
              </button>
              <button
                type="button"
                onClick={() => setSchedDays(['Saturday', 'Sunday'])}
                className="px-2.5 py-1 text-[11px] font-black rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-[#FF5A1F] hover:text-white transition-all cursor-pointer"
              >
                Weekends
              </button>
              <button
                type="button"
                onClick={() => setSchedDays([...ALL_DAYS])}
                className="px-2.5 py-1 text-[11px] font-black rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-[#FF5A1F] hover:text-white transition-all cursor-pointer"
              >
                All Days
              </button>
            </div>

            {/* Day Chips */}
            <div className="grid grid-cols-4 gap-2">
              {ALL_DAYS.map(day => {
                const isSelected = schedDays.includes(day);
                const label = DAY_LABELS[day]?.[language] || day.slice(0, 3);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`py-2 px-2 rounded-xl text-xs font-black border transition-all text-center cursor-pointer ${
                      isSelected
                        ? 'bg-[#FF5A1F] text-white border-[#FF5A1F] shadow-sm'
                        : 'bg-[#DAF0F7] text-[#1A1110] border-[#B2E2F0] hover:bg-[#FF5A1F]/20'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => handleScheduleDaysSet(schedDays)}
              disabled={schedDays.length === 0}
              className="w-full py-3.5 bg-[#FF5A1F] hover:bg-[#E04810] disabled:opacity-50 text-white font-black rounded-2xl shadow-md transition-all cursor-pointer"
            >
              {t('guided.continueBtn')} ({schedDays.length} days selected) ✓
            </button>
          </div>
        )}

        {/* ── STEP 6B: MONTHLY DAY ── */}
        {step === 'schedule_monthday' && (
          <div className="p-5 space-y-4">
            <p className="text-xs font-bold text-slate-500">{t('guided.schedMonthDayQuestion')}</p>
            <input
              type="number"
              min={1}
              max={31}
              value={schedMonthDay}
              onChange={e => {
                const val = parseInt(e.target.value, 10);
                if (val >= 1 && val <= 31) setSchedMonthDay(val);
              }}
              className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-[#FF5A1F] rounded-2xl text-2xl font-black text-center text-slate-900 dark:text-white focus:outline-none"
            />
            <div className="flex flex-wrap gap-2 justify-center">
              {[1, 5, 10, 15, 20, 25, 31].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSchedMonthDay(d)}
                  className={`w-10 h-10 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                    schedMonthDay === d
                      ? 'bg-[#FF5A1F] text-white border-[#FF5A1F]'
                      : 'bg-[#DAF0F7] text-[#1A1110] border-[#B2E2F0] hover:bg-[#FF5A1F]/20'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => handleScheduleMonthDaySet(schedMonthDay)}
              className="w-full py-3.5 bg-[#FF5A1F] hover:bg-[#E04810] text-white font-black rounded-2xl shadow-md transition-all cursor-pointer"
            >
              {t('guided.continueBtn')} (Day {schedMonthDay}) ✓
            </button>
          </div>
        )}

        {/* ── STEP 6C: CUSTOM DATE ── */}
        {step === 'schedule_customdate' && (
          <div className="p-5 space-y-4">
            <p className="text-xs font-bold text-slate-500">{t('guided.schedCustomDateQuestion')}</p>
            <input
              type="date"
              min={getTodayDateStr()}
              value={schedCustomDate}
              onChange={e => {
                const val = e.target.value;
                if (!val) return;
                setSchedCustomDate(val);
                setSchedCustomDateDisplay(formatCustomDateDisplay(val));
              }}
              className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-[#FF5A1F] rounded-2xl text-base font-black text-center text-slate-900 dark:text-white focus:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const tStr = getTomorrowDateStr();
                  setSchedCustomDate(tStr);
                  setSchedCustomDateDisplay(formatCustomDateDisplay(tStr));
                }}
                className="px-3 py-1.5 rounded-xl bg-[#DAF0F7] text-xs font-black text-[#1A1110] border border-[#B2E2F0] hover:bg-[#FF5A1F] hover:text-white transition-all cursor-pointer"
              >
                {language === 'ta' ? 'நாளை' : language === 'hi' ? 'कल' : 'Tomorrow'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 2);
                  const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  setSchedCustomDate(s);
                  setSchedCustomDateDisplay(formatCustomDateDisplay(s));
                }}
                className="px-3 py-1.5 rounded-xl bg-[#DAF0F7] text-xs font-black text-[#1A1110] border border-[#B2E2F0] hover:bg-[#FF5A1F] hover:text-white transition-all cursor-pointer"
              >
                {language === 'ta' ? 'நாளை மறுநாள்' : language === 'hi' ? 'परसों' : 'Day After Tomorrow'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                const parsed = parseCustomDate(schedCustomDate);
                if (parsed) handleScheduleCustomDateSet(parsed);
              }}
              className="w-full py-3.5 bg-[#FF5A1F] hover:bg-[#E04810] text-white font-black rounded-2xl shadow-md transition-all cursor-pointer"
            >
              {t('guided.continueBtn')} ({schedCustomDateDisplay}) ✓
            </button>
          </div>
        )}

        {/* ── STEP 7: CONFIRM (YES / NO) ── */}
        {step === 'schedule_confirm' && (
          <div className="p-5 space-y-4">
            <div className="p-4 bg-[#DAF0F7]/70 rounded-2xl border border-[#B2E2F0] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {selectedRestaurant || selectedItem?.restaurant}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#FF5A1F]/15 text-[#FF5A1F] text-[10px] font-black uppercase">
                  {schedRepeatType}
                </span>
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {selectedItem?.nativeNames?.[language] || selectedItem?.name}
              </h3>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                🕒 {schedTimeDisplay}&nbsp;&nbsp;·&nbsp;&nbsp;
                {schedRepeatType === 'weekly' && `Every ${schedDays.join(', ')}`}
                {schedRepeatType === 'monthly' && `Day ${schedMonthDay} of every month`}
                {schedRepeatType === 'custom' && schedCustomDateDisplay}
              </p>
            </div>

            <p className="text-xs font-black text-slate-700 dark:text-slate-300 text-center italic">
              &ldquo;{buildSummary({
                foodItemName: selectedItem?.nativeNames?.[language] || selectedItem?.name || '',
                restaurant: selectedRestaurant || selectedItem?.restaurant || '',
                repeatType: schedRepeatType,
                timeDisplay: schedTimeDisplay,
                days: schedDays,
                dayOfMonth: schedMonthDay,
                customDate: schedCustomDateDisplay || schedCustomDate
              }, language)}&rdquo;
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={handleScheduleConfirmYes}
                className="py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-5 h-5" />
                <span>{t('guided.confirmYes')}</span>
              </button>
              <button
                type="button"
                onClick={handleScheduleConfirmNo}
                className="py-3.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-5 h-5" />
                <span>{t('guided.confirmNo')}</span>
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 8: CHANGE (If user says NO) ── */}
        {step === 'schedule_change' && (
          <div className="p-5 space-y-3">
            <p className="text-xs font-bold text-slate-500">{t('guided.changeQuestion')}</p>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { target: 'time' as const, label: t('guided.changeTime'), icon: Clock },
                { target: 'repeat' as const, label: t('guided.changeRepeat'), icon: Calendar },
                { target: 'days' as const, label: t('guided.changeDays'), icon: Check },
                { target: 'restaurant' as const, label: t('guided.changeRestaurant'), icon: Zap }
              ].map(opt => {
                const IconComp = opt.icon;
                return (
                  <button
                    key={opt.target}
                    type="button"
                    onClick={() => handleScheduleChangeTarget(opt.target)}
                    className="p-4 bg-[#DAF0F7]/60 hover:bg-[#FF5A1F] hover:text-white rounded-2xl border border-[#B2E2F0] flex flex-col items-center gap-2 font-black text-xs transition-all cursor-pointer group"
                  >
                    <IconComp className="w-5 h-5 text-[#FF5A1F] group-hover:text-white" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── SUCCESS POPUP MODAL ── */}
        {schedSuccessPopup && (
          <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center z-20 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 animate-bounce" />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">
              {schedSuccessPopup}
            </h3>
            <p className="text-xs font-semibold text-slate-500 mb-6 max-w-xs">
              {selectedItem?.nativeNames?.[language] || selectedItem?.name} from {selectedRestaurant || selectedItem?.restaurant}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-8 bg-[#FF5A1F] hover:bg-[#E04810] text-white font-black rounded-2xl shadow-md transition-all cursor-pointer"
            >
              {t('guided.continueBtn')}
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
