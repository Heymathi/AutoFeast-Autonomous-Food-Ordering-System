/**
 * SearchGuidedOrderModal.tsx
 *
 * 3-step spoken + listened guided dialog launched whenever a search query
 * matches 2+ catalog items (or exactly 1 item, skipping straight to step 2).
 *
 * Step 1 – VARIETY:  Which type of dosa would you like?
 * Step 2 – RESTAURANT: Which restaurant would you like to order from?
 * Step 3 – WHEN: Order now, or schedule for later? (+ time parsing)
 *
 * Rules:
 * - TTS starts immediately; STT starts as soon as TTS finishes (no self-hearing).
 * - Tap and voice call the same handlers, guarded against double-firing.
 * - "cancel / வேண்டாம் / ரத்து / nahi / band karo" closes with "Okay, cancelled."
 * - Silence: re-prompt once, then keep buttons usable.
 * - Restricted-item check delegated to AppContext exactly as before.
 * - DO NOT IMPORT: window directly → use typeof window guard; no DOM imports.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { FoodItem } from '../types';
import { SpeechController } from '../services/speechController';
import { SttMatcherService } from '../services/sttMatcherService';
import { parseSpokenTimeTo24Hr, deriveMealSlot } from '../services/timeVoiceParser';
import { calculateHaversineDistance } from '../services/locationService';
import {
  matchOptionByTokens,
  classifyOrderNowOrSchedule,
  normalizeInputText
} from '../services/guidedMatchingService';
import { Mic, MicOff, X, Zap, Clock, ChevronRight, AlertCircle } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

type GuidedStep = 'variety' | 'restaurant' | 'when' | 'time';

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

// ─── Read up to 3 names aloud ─────────────────────────────────────────────────

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
  const [schedulingItem, setSchedulingItem] = useState<{ item: FoodItem; time24: string; slotName: string } | null>(null);
  const [timeReaskDone, setTimeReaskDone] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerVal, setTimePickerVal] = useState('08:00');
  const [speechError, setSpeechError] = useState<string | null>(null);

  // ── Refs (guard double-fire) ──────────────────────────────────────────────
  const handledRef = useRef(false);
  const stepRef = useRef<GuidedStep>('variety');
  const isSpeakingRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOpenRef = useRef(false);

  // Keep refs in sync
  useEffect(() => { stepRef.current = step; }, [step]);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  // ── Computed ──────────────────────────────────────────────────────────────
  const varieties = matchedItems;
  const restaurants: string[] = selectedItem
    ? getUniqueRestaurants(
        matchedItems.filter(i => i.id === selectedItem.id || i.restaurant === selectedItem.restaurant),
        userLocation.latitude,
        userLocation.longitude
      )
    : [];

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
        // Auto-restart while dialog is open and not speaking
        if (isOpenRef.current && !isSpeakingRef.current) {
          setTimeout(() => {
            if (isOpenRef.current && !isSpeakingRef.current) startListening();
          }, 400);
        }
      }
    });
  }, [language]);

  // ── Silence handling ──────────────────────────────────────────────────────
  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const handleSilence = useCallback(() => {
    setSilenceCount(prev => {
      if (prev === 0) {
        // Re-prompt once
        const rePrompt = t('guided.silenceRePrompt');
        speakText(rePrompt, () => { if (isOpenRef.current) startListening(); }, language);
        return 1;
      }
      // Second silence: just keep buttons usable, stop mic for now
      setIsListening(false);
      return 2;
    });
  }, [language, speakText, t]);

  // ── Cancel helper ─────────────────────────────────────────────────────────
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

  /** Called when variety is chosen (tap or voice) */
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

  /** Called when restaurant is chosen (tap or voice) */
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

  /** Called when "Order Now" chosen */
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

  /** Called when "Schedule" chosen with a parsed time */
  const handleSchedule = useCallback((item: FoodItem, time24: string, slotName: string) => {
    if (handledRef.current) return;
    handledRef.current = true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    SpeechController.releaseMic(MIC_OWNER);
    onClose();
    const isRestricted = checkIsItemRestrictedByNominee(item.id, item.name);
    if (isRestricted) {
      handleNomineeRestrictedInterception(item, 'scheduled', { time: time24, slotName });
    } else {
      setSchedulingItem({ item, time24, slotName });
    }
  }, [checkIsItemRestrictedByNominee, handleNomineeRestrictedInterception, onClose]);

  // ── Voice result router ───────────────────────────────────────────────────
  const handleVoiceResult = useCallback((candidates: string[]) => {
    const raw = candidates[0] || '';

    if (isCancelIntent(raw)) {
      handleCancel();
      return;
    }

    const currentStep = stepRef.current;

    if (currentStep === 'variety') {
      // Use guidedMatchingService: strips family words, scores by distinctive tokens
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
        // Only family word heard (e.g. just "biryani") — re-prompt
        const top3Names = namesToSpeak(varieties.map(v => v.nativeNames?.[language] || v.name));
        const prompt = t('guided.step1Spoken')
          .replace('{dish}', query || 'dish')
          .replace('{names}', top3Names);
        speakText(prompt, () => { if (isOpenRef.current) startListening(); }, language);
      } else {
        // No match — re-listen silently
        startListening();
      }

    } else if (currentStep === 'restaurant') {
      // All restaurants across all matched varieties (not just same id)
      const currentRestaurants = getUniqueRestaurants(
        matchedItems,
        userLocation.latitude,
        userLocation.longitude
      );
      // Further filter to only those that serve the selected item's family
      const filteredRestaurants = selectedItem
        ? getUniqueRestaurants(
            matchedItems.filter(i => i.id === selectedItem.id || i.restaurant === selectedItem.restaurant),
            userLocation.latitude,
            userLocation.longitude
          )
        : currentRestaurants;
      const restaurantList = filteredRestaurants.length > 0 ? filteredRestaurants : currentRestaurants;

      if (restaurantList.length === 1) {
        // Single restaurant: treat as yes/no confirmation
        const conf = SttMatcherService.matchConfirmation(candidates, language);
        console.log('[GuidedDialog]', {
          step: currentStep,
          heard: raw,
          normalized: normalizeInputText(raw),
          candidates: [{ label: restaurantList[0], score: 'yes/no' }],
          chosen: conf.matchedValue === 'YES' ? restaurantList[0] : null,
          reason: `Single restaurant confirm: ${conf.matchedValue}`
        });
        if (conf.matchedValue === 'YES') {
          handleRestaurantChosen(restaurantList[0]);
        } else if (conf.matchedValue === 'NO') {
          handleCancel();
        } else {
          startListening();
        }
      } else {
        const decision = matchOptionByTokens(raw, restaurantList, language);
        console.log('[GuidedDialog]', {
          step: currentStep,
          heard: raw,
          normalized: normalizeInputText(raw),
          candidates: decision.scored.map(s => ({ label: s.label, score: parseFloat(s.score.toFixed(2)) })),
          chosen: decision.chosen as string | null,
          reason: decision.reason
        });

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
        setSilenceCount(0);
        setLiveText('');
        setStep('time');
        handledRef.current = false;
      } else {
        // Maybe they said a time directly (e.g. "8 AM")
        const parsed = parseSpokenTimeTo24Hr(raw);
        if (parsed && selectedItem) {
          const slot = deriveMealSlot(parsed.hours);
          handleSchedule(selectedItem, parsed.time24, `${slot} Schedule`);
        } else {
          startListening();
        }
      }

    } else if (currentStep === 'time') {
      const parsed = parseSpokenTimeTo24Hr(raw);
      console.log('[GuidedDialog]', {
        step: currentStep,
        heard: raw,
        normalized: normalizeInputText(raw),
        candidates: [],
        chosen: parsed ? parsed.time24 : null,
        reason: parsed ? `parsed time: ${parsed.time24}` : 'time parse failed'
      });

      if (parsed && selectedItem) {
        const slot = deriveMealSlot(parsed.hours);
        handleSchedule(selectedItem, parsed.time24, `${slot} Schedule`);
      } else if (!timeReaskDone) {
        setTimeReaskDone(true);
        speakText(t('guided.step3TimeReask'), () => { if (isOpenRef.current) startListening(); }, language);
      } else {
        // Show time picker
        setShowTimePicker(true);
        setIsListening(false);
      }
    }
  }, [
    handleCancel, handleOrderNow, handleRestaurantChosen, handleSchedule, handleVarietyChosen,
    language, matchedItems, query, selectedItem, speakText, startListening, t, timeReaskDone,
    userLocation.latitude, userLocation.longitude, varieties
  ]);

  // ── Effects: drive TTS → STT per step ────────────────────────────────────

  // Reset state when modal opens
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
    setTimeReaskDone(false);
    setShowTimePicker(false);
    setSchedulingItem(null);
    setSelectedRestaurant(null);

    // Decide initial step
    if (matchedItems.length === 1) {
      // Skip variety step
      setSelectedItem(matchedItems[0]);
      setStep('restaurant');
    } else {
      setSelectedItem(null);
      setStep('variety');
    }
  }, [isOpen, matchedItems]);

  // Speak prompt when step changes
  useEffect(() => {
    if (!isOpen) return;

    handledRef.current = false;
    setSilenceCount(0);
    setLiveText('');

    if (step === 'variety') {
      const dishLabel = query || 'dish';
      const top3Names = namesToSpeak(varieties.map(v => v.nativeNames?.[language] || v.name));
      const prompt = t('guided.step1Spoken')
        .replace('{dish}', dishLabel)
        .replace('{names}', top3Names);
      speakAndListen(prompt, () => {
      });

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

    } else if (step === 'time') {
      const prompt = t('guided.step3TimeSpoken');
      speakAndListen(prompt, () => {
      });
    }
  }, [step, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => () => {
    SpeechController.releaseMic(MIC_OWNER);
    clearSilenceTimer();
  }, []);

  // ── Derived display data ──────────────────────────────────────────────────
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
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-[#FF5A1F]/30 overflow-hidden">

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
                {(step === 'when') && t('guided.step3Title')}
                {step === 'time' && t('guided.step3TimeTitle')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Mic status badge */}
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

        {/* ── STEP 3: WHEN ── */}
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
                onClick={() => { setSilenceCount(0); setLiveText(''); setStep('time'); handledRef.current = false; }}
                className="flex flex-col items-center gap-2 px-4 py-5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl transition-all cursor-pointer"
              >
                <Clock className="w-6 h-6" />
                <span className="text-sm font-black">{t('guided.laterBtn')}</span>
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: TIME ── */}
        {step === 'time' && (
          <div className="p-5 space-y-4">
            {showTimePicker ? (
              <>
                <p className="text-xs font-bold text-slate-500">{t('guided.step3TimeTitle')}</p>
                <input
                  type="time"
                  value={timePickerVal}
                  onChange={e => setTimePickerVal(e.target.value)}
                  className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-[#FF5A1F] rounded-2xl text-lg font-black text-center text-slate-900 dark:text-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedItem) return;
                    const [h, m] = timePickerVal.split(':').map(Number);
                    const slot = deriveMealSlot(h);
                    handleSchedule(selectedItem, timePickerVal, `${slot} Schedule`);
                  }}
                  className="w-full py-3 bg-[#FF5A1F] hover:bg-[#E04810] text-white font-black rounded-2xl shadow-md transition-all cursor-pointer"
                >
                  {t('guided.laterBtn')} ✓
                </button>
              </>
            ) : (
              <>
                <p className="text-xs font-bold text-slate-500">{t('guided.step3TimeSpoken')}</p>
                <div className="flex flex-wrap gap-2">
                  {['08:00', '12:00', '13:00', '19:00', '20:00'].map(t24 => {
                    const [h] = t24.split(':').map(Number);
                    const slot = deriveMealSlot(h);
                    const display = `${h > 12 ? h - 12 : h}:${t24.split(':')[1]} ${h >= 12 ? 'PM' : 'AM'}`;
                    return (
                      <button
                        key={t24}
                        type="button"
                        onClick={() => {
                          if (!selectedItem) return;
                          handleSchedule(selectedItem, t24, `${slot} Schedule`);
                        }}
                        className="px-3 py-1.5 bg-[#DAF0F7] hover:bg-[#FF5A1F] hover:text-white text-[#1A1110] text-xs font-black rounded-xl border border-[#B2E2F0] transition-all cursor-pointer"
                      >
                        {display} ({slot})
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setShowTimePicker(true)}
                  className="text-xs text-[#FF5A1F] underline font-bold cursor-pointer"
                >
                  {language === 'ta' ? 'நேர பிக்கர் திறக்க' : language === 'hi' ? 'समय चुनें' : 'Open time picker'}
                </button>
              </>
            )}
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

      {/* ScheduleCheckoutModal lazily rendered when scheduling */}
      {schedulingItem && (
        <ScheduleCheckoutLauncher
          item={schedulingItem.item}
          time24={schedulingItem.time24}
          slotName={schedulingItem.slotName}
          onDone={() => setSchedulingItem(null)}
        />
      )}
    </div>
  );
};

// ─── Thin bridge to ScheduleCheckoutModal ───────────────────────────────────

const ScheduleCheckoutLauncher: React.FC<{
  item: FoodItem;
  time24: string;
  slotName: string;
  onDone: () => void;
}> = ({ item, time24, slotName, onDone }) => {
  // Dynamically import to avoid circular imports
  const [Comp, setComp] = React.useState<React.ComponentType<any> | null>(null);
  useEffect(() => {
    import('./ScheduleCheckoutModal').then(m => setComp(() => m.ScheduleCheckoutModal));
  }, []);

  if (!Comp) return null;

  return (
    <Comp
      isOpen={true}
      onClose={onDone}
      items={[{ foodItem: item, quantity: 1 }]}
      initialSlotName={slotName}
      initialTime={time24}
      onSuccess={onDone}
    />
  );
};
