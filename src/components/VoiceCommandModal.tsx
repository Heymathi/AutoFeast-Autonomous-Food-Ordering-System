import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { FoodItem } from '../types';
import { SpeechController } from '../services/speechController';
import { SttMatcherService } from '../services/sttMatcherService';
import { VoiceIntentRouter } from '../services/voiceIntentRouter';
import { NomineeNotificationService } from '../services/nomineeNotificationService';
import { Mic, MicOff, X, Command, CheckCircle2, XCircle, Volume2, Bug, Sparkles, HardDrive, Download, AlertCircle, Loader2, WifiOff } from 'lucide-react';
import { OfflineSpeechEngine, OfflineModelStatus } from '../services/offlineSpeechEngine';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { DynamicFoodSearchEngine } from '../services/dynamicFoodSearch';
import { parseSpokenTimeTo24Hr } from './VoiceOrderDialogModal';
import { calculateHaversineDistance } from '../services/locationService';
import { calculateScheduleEndDate } from '../services/autoOrderBackgroundService';
import { NLPParserService } from '../services/nlpParserService';
import { ItemActionChooser } from './ItemActionChooser';
import { VoiceCommandParser } from '../services/voiceCommandParser';
import { fetchSearchFallback } from '../services/geminiSearchFallbackClient';

const voiceDebug = (message: string, details?: unknown) => {
  if ((import.meta as any).env?.DEV) console.info(message, details ?? '');
};

const POPULAR_ITEMS = INDIAN_FOOD_CATALOG.filter(i =>
  i.name === 'Crispy Plain Dosa' ||
  i.name === 'South Indian Idli' ||
  i.name === 'Parotta with Salna' ||
  i.name === 'Crispy Masala Dosa'
).slice(0, 4);

const sanitizeTranscriptForDisplay = (text: string) => {
  if (!text) return '';
  return text.replace(/\b\d{4}\b/g, '••••');
};

export const VoiceCommandModal: React.FC = () => {
  const {
    isVoiceModalOpen,
    setIsVoiceModalOpen,
    t,
    language,
    executeSearch,
    rechargeWallet,
    setActiveView,
    speakText,
    showToast,
    saveSchedule,
    placeInstantOrder,
    setVoiceDialogItem,
    addToCart,
    setIsScheduleCartOpen,
    checkDailyOrderLimitReached,
    processNaturalLanguageVoiceCommand,
    requestWalletBalanceReveal,
    skipScheduleByVoiceCommand,
    currentUser,
    userLocation,
    openGuidedSearch,
    checkIsItemRestrictedByNominee,
    handleNomineeRestrictedInterception
  } = useApp();

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [showPopularSuggestions, setShowPopularSuggestions] = useState(false);
  const [pendingScheduleFlow, setPendingScheduleFlow] = useState<{ item: FoodItem; recurrence?: string } | null>(null);
  const [pendingCommand, setPendingCommand] = useState('');
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [chooserItems, setChooserItems] = useState<FoodItem[] | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  // Offline Voice Setup State
  const [offlineStatus, setOfflineStatus] = useState<OfflineModelStatus>(() => OfflineSpeechEngine.getModelStatus());
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [isDownloadingModel, setIsDownloadingModel] = useState<boolean>(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);
  const [showConsentPrompt, setShowConsentPrompt] = useState<boolean>(false);

  // Synchronize Offline Voice model status when modal opens
  useEffect(() => {
    if (isVoiceModalOpen) {
      const current = OfflineSpeechEngine.getModelStatus();
      setOfflineStatus(current);
      if (current.isDownloaded) {
        setDownloadError(null);
      }
      // Check actual Cache API files to verify status is accurate
      OfflineSpeechEngine.verifyCacheState().then(verified => {
        setOfflineStatus(verified);
      }).catch(() => {});
    }
  }, [isVoiceModalOpen]);

  const handleInitiateDownload = () => {
    if (isDownloadingModel || offlineStatus.isDownloaded) return;
    setDownloadError(null);
    setDownloadSuccessMessage(null);
    setShowConsentPrompt(true);
  };

  const handleConfirmConsentDownload = async () => {
    setShowConsentPrompt(false);
    if (isDownloadingModel || offlineStatus.isDownloaded) return;

    setIsDownloadingModel(true);
    setDownloadProgress(5);
    setDownloadError(null);
    setDownloadSuccessMessage(null);

    try {
      const success = await OfflineSpeechEngine.downloadModelWithConsent((progress) => {
        setDownloadProgress(progress);
      });

      if (success) {
        const updatedStatus = OfflineSpeechEngine.getModelStatus();
        setOfflineStatus(updatedStatus);
        setDownloadSuccessMessage(
          language === 'ta'
            ? 'Whisper ஆஃப்லைன் குரல் மாதிரி வெற்றிகரமாக பதிவிறக்கப்பட்டு சேமிக்கப்பட்டது! இணையம் இல்லாமலும் குரல் தேடல் செயல்படும்.'
            : language === 'hi'
            ? 'Whisper ऑफ़लाइन वॉइस मॉडल सफलतापूर्वक डाउनलोड और कैश हो गया! अब बिना इंटरनेट के भी वॉइस सर्च काम करेगा।'
            : 'Whisper offline voice model downloaded & cached successfully! Speech recognition is now ready for offline use.'
        );
      } else {
        setDownloadError(
          language === 'ta'
            ? 'மாதிரி பதிவிறக்கம் தோல்வியடைந்தது. இணைய இணைப்பை சரிபார்த்து மீண்டும் முயற்சிக்கவும்.'
            : language === 'hi'
            ? 'मॉडल डाउनलोड विफल रहा। कृपया इंटरनेट कनेक्शन जांचें और पुनः प्रयास करें।'
            : 'Model download failed. Please check your internet connection and retry.'
        );
      }
    } catch (err: any) {
      setDownloadError(err?.message || 'Download error. Please retry.');
    } finally {
      setIsDownloadingModel(false);
    }
  };

  const handleCancelConsent = () => {
    setShowConsentPrompt(false);
  };

  // Guard refs to prevent double-firing
  const confirmHandledRef = useRef(false);
  const confirmRepromptCountRef = useRef(0);
  const pendingConfirmedFoodItemRef = useRef<FoodItem | null>(null);
  const restaurantHandledRef = useRef(false);
  const retryCountRef = useRef(0);
  const pendingScheduleFlowRef = useRef(pendingScheduleFlow);

  useEffect(() => {
    pendingScheduleFlowRef.current = pendingScheduleFlow;
  }, [pendingScheduleFlow]);

  // Restaurant selection state
  const [restaurantStep, setRestaurantStep] = useState<{ item: FoodItem; restaurants: string[]; candidates: string[] } | null>(null);
  const [singleRestaurantPrompt, setSingleRestaurantPrompt] = useState<{ item: FoodItem; restaurant: string; candidates: string[] } | null>(null);
  const [micErrorHint, setMicErrorHint] = useState<string | null>(null);

  const pendingCommandRef = useRef(pendingCommand);
  const awaitingConfirmationRef = useRef(awaitingConfirmation);
  const silenceRepeatCount = useRef(0);
  const pendingAlternativesRef = useRef<string[]>([]);
  const restaurantStepRef = useRef(restaurantStep);
  const singleRestaurantPromptRef = useRef(singleRestaurantPrompt);

  useEffect(() => {
    pendingCommandRef.current = pendingCommand;
  }, [pendingCommand]);

  useEffect(() => {
    awaitingConfirmationRef.current = awaitingConfirmation;
  }, [awaitingConfirmation]);

  useEffect(() => {
    restaurantStepRef.current = restaurantStep;
  }, [restaurantStep]);

  useEffect(() => {
    singleRestaurantPromptRef.current = singleRestaurantPrompt;
  }, [singleRestaurantPrompt]);

  useEffect(() => {
    if (!isVoiceModalOpen) {
      SpeechController.stopListening('VoiceCommandModal');
      SpeechController.cancelSpeech();
      setIsListening(false);
      setTranscript('');
      setStatusMessage('');
      setShowPopularSuggestions(false);
      setPendingScheduleFlow(null);
      retryCountRef.current = 0;
      setPendingCommand('');
      setAwaitingConfirmation(false);
      setRestaurantStep(null);
      setSingleRestaurantPrompt(null);
      confirmHandledRef.current = false;
      restaurantHandledRef.current = false;
      setShowConsentPrompt(false);
    } else {
      startListeningSession();
    }
    return () => {
      SpeechController.stopListening('VoiceCommandModal');
      SpeechController.cancelSpeech();
    };
  }, [isVoiceModalOpen]);

  const startListeningSession = (opts?: { allowDuringTts?: boolean }) => {
    if (!SpeechController.isSupported()) {
      const message = t('voice.micUnavailableHint');
      setStatusMessage(message);
      setMicErrorHint(message);
      showToast(message);
      speakText(message, undefined, language);
      return;
    }

    const allowDuringTts = opts?.allowDuringTts ?? (awaitingConfirmationRef.current || !!restaurantStepRef.current || !!singleRestaurantPromptRef.current);

    setIsListening(true);
    SpeechController.startListening({
      owner: 'VoiceCommandModal',
      language,
      continuous: true,
      interimResults: true,
      allowDuringTts,
      maxAlternatives: 5,
      silenceTimeoutMs: 8000,
      onSilence: () => {
        setIsListening(false);
        if (awaitingConfirmationRef.current || restaurantStepRef.current || singleRestaurantPromptRef.current) {
          if (silenceRepeatCount.current < 1) {
            silenceRepeatCount.current += 1;
            startListeningSession({ allowDuringTts: true });
          }
          return;
        }
        if (silenceRepeatCount.current === 0) {
          silenceRepeatCount.current = 1;
          const message = language === 'ta'
            ? 'உணவுப் பெயரைச் சொல்லுங்கள். மீண்டும் ஒருமுறை கேட்கிறேன்.'
            : language === 'hi'
            ? 'कृपया भोजन का नाम बोलें। मैं एक बार फिर सुनूँगा।'
            : 'Please say a food name. I will listen once more.';
          setStatusMessage(message);
          speakText(message, () => startListeningSession(), language);
        } else {
          const message = language === 'ta'
            ? 'கேட்பது நிறுத்தப்பட்டது. தொடர மைக்கை மீண்டும் முயற்சிக்கவும் அல்லது தேடலைத் தொடவும்.'
            : language === 'hi'
            ? 'सुनना रोक दिया गया है। Retry mic दबाएँ या खोज शुरू करें।'
            : 'Listening stopped. Tap Retry mic or search on screen.';
          setStatusMessage(message);
          showToast(message, 'info', 5000, undefined, undefined, undefined, true);
        }
      },
      onStart: () => {
        setIsListening(true);
        setMicErrorHint(null);
      },
      onResult: (text, isFinal, nBestTranscripts) => {
        if (text && text.trim()) {
          const cleanText = text.trim();
          console.log('[STT Diagnostic] UI state update', {
            component: 'VoiceCommandModal',
            transcriptLength: cleanText.length,
            isFinal
          });
          setTranscript(cleanText);

          // Cancel active speech synthesis on first speech detection
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            try { window.speechSynthesis.cancel(); } catch {}
          }
          SpeechController.cancelSpeech();

          const candidates = nBestTranscripts && nBestTranscripts.length > 0 ? nBestTranscripts : [cleanText];

          // Check voice confirmation YES/NO on both interim and final results
          if (awaitingConfirmationRef.current && !confirmHandledRef.current) {
            const routerConfirm = VoiceIntentRouter.matchConfirmationIntent(candidates, language);
            if (routerConfirm.action === 'cancel') {
              handleNo();
              return;
            }
            if (routerConfirm.action === 'confirm') {
              handleYes();
              return;
            }
            const matchConfirm = SttMatcherService.matchConfirmation(candidates, language);
            if (matchConfirm.isMatched && matchConfirm.matchedValue === 'NO') {
              handleNo();
              return;
            }
            if (matchConfirm.isMatched && matchConfirm.matchedValue === 'YES') {
              handleYes();
              return;
            }
          }

          // Check single restaurant YES/NO confirmation on both interim and final
          if (singleRestaurantPromptRef.current && !confirmHandledRef.current) {
            const routerConfirm = VoiceIntentRouter.matchConfirmationIntent(candidates, language);
            if (routerConfirm.action === 'cancel') {
              handleNo();
              return;
            }
            if (routerConfirm.action === 'confirm') {
              handleRestaurantSelected(singleRestaurantPromptRef.current.restaurant);
              return;
            }
            const matchConfirm = SttMatcherService.matchConfirmation(candidates, language);
            if (matchConfirm.isMatched && matchConfirm.matchedValue === 'NO') {
              handleNo();
              return;
            }
            if (matchConfirm.isMatched && matchConfirm.matchedValue === 'YES') {
              handleRestaurantSelected(singleRestaurantPromptRef.current.restaurant);
              return;
            }
          }

          // Check restaurant list selection on both interim and final
          if (restaurantStepRef.current && !restaurantHandledRef.current) {
            const matchRest = SttMatcherService.matchRestaurantSelection(candidates, restaurantStepRef.current.restaurants);
            if (matchRest.isMatched && matchRest.restaurant) {
              handleRestaurantSelected(matchRest.restaurant);
              return;
            }
          }

          if (isFinal) {
            silenceRepeatCount.current = 0;
            // If confirmation still pending and no match on final result, re-prompt at most once
            if (awaitingConfirmationRef.current && !confirmHandledRef.current) {
              if (confirmRepromptCountRef.current === 0) {
                confirmRepromptCountRef.current = 1;
                const reprompt = t('voice.pleaseSayYesOrNo');
                setStatusMessage(reprompt);
                speakText(reprompt, () => startListeningSession({ allowDuringTts: true }), language);
                return;
              }
              return;
            }

            if (!awaitingConfirmationRef.current && !restaurantStepRef.current && !singleRestaurantPromptRef.current) {
              voiceDebug('[Voice Turn]', {
                state: SpeechController.getState(),
                step: 'item_search',
                transcript: cleanText,
                alternatives: candidates,
                chosenIntent: 'pending-local-match',
                source: SpeechController.getActiveSttEngine()
              });
              setTranscript(cleanText);
              console.log('[STT Diagnostic] Transcript sent to local food search', {
                queryLength: cleanText.length
              });
              executeSearch(cleanText, true);
              handleSpeechResult(cleanText, candidates);
            }
          } else {
            setTranscript(cleanText);
          }
        }
      },
      onError: (errorCode, errorMessage) => {
        console.warn('[VoiceCommandModal Error]:', errorCode, errorMessage);
        setIsListening(false);
        if (errorCode === 'not-allowed' || errorCode === 'not-supported') {
          const hint = t('voice.micUnavailableHint');
          setMicErrorHint(hint);
          setStatusMessage(hint);
        } else {
          setStatusMessage(errorMessage);
          showToast(errorMessage);
        }
      },
      onEnd: () => {
        setIsListening(false);
        // Restart recognition if confirmation or restaurant selection is still active
        if ((awaitingConfirmationRef.current && !confirmHandledRef.current) ||
            (singleRestaurantPromptRef.current && !confirmHandledRef.current) ||
            (restaurantStepRef.current && !restaurantHandledRef.current)) {
          startListeningSession({ allowDuringTts: true });
        }
      }
    });
  };

  const toggleListening = () => {
    if (isListening) {
      if (SpeechController.getActiveSttEngine() === 'whisper') {
        OfflineSpeechEngine.stopRecording();
        setIsListening(false);
        setStatusMessage(
          language === 'ta'
            ? 'குரல் செயலாக்கப்படுகிறது...'
            : language === 'hi'
            ? 'आवाज़ संसाधित हो रही है...'
            : 'Processing voice...'
        );
      } else {
        SpeechController.stopListening('VoiceCommandModal');
        setIsListening(false);
      }
    } else {
      startListeningSession();
    }
  };

  const [variantSuggestions, setVariantSuggestions] = useState<{ prompt: string; items: FoodItem[] } | null>(null);

  const executeVoiceSchedule = (item: FoodItem, timeStr: string, recurrence?: string) => {
    if (NomineeNotificationService.hasRestrictedFetchError()) {
      showToast(t('nominee.restrictedLoadError'), 'warning');
      setIsVoiceModalOpen(false);
      return;
    }
    if (checkIsItemRestrictedByNominee(item.id, item.name)) {
      handleNomineeRestrictedInterception(item, 'scheduled', {
        time: timeStr || '08:00',
        duration: recurrence === 'once' ? 'today_only' : '1_month',
        frequency: recurrence || 'daily'
      });
      setIsVoiceModalOpen(false);
      return;
    }
    if (checkDailyOrderLimitReached()) {
      setIsVoiceModalOpen(false);
      return;
    }

    const newSchedule: any = {
      id: Date.now().toString(),
      foodItemId: item.id,
      foodItemName: item.name,
      restaurant: item.restaurant || 'Saravana Bhavan',
      slotName: 'custom',
      time: timeStr || '08:00',
      frequency: recurrence === 'daily' ? 'daily' : (recurrence === 'weekdays' ? 'weekdays' : (recurrence === 'weekends' ? 'weekends' : (recurrence === 'once' ? 'once' : 'daily'))),
      duration: recurrence === 'once' ? 'today_only' : '1_month',
      customDays: [],
      enabled: true,
      createdAt: new Date().toISOString()
    };

    saveSchedule(newSchedule);
    setIsVoiceModalOpen(false);
  };

  const handleUnknownCommand = (spokenText: string) => {
    retryCountRef.current += 1;
    if (retryCountRef.current >= 2) {
      setShowPopularSuggestions(true);
      const deadEndPrompt = language === 'ta'
        ? 'எந்த உணவு? தோசை, இட்லி, பரோட்டா என்று சொல்லுங்கள் அல்லது கீழே தொடவும்.'
        : language === 'hi'
        ? 'कौन सा आइटम? डोसा, इडली, पराठा बोलें या नीचे टैप करें।'
        : 'Which item? Say dosa, idli, or parotta, or tap below.';
      setStatusMessage(deadEndPrompt);
      speakText(deadEndPrompt, () => startListeningSession(), language);
    } else {
      const retryPrompt = language === 'ta'
        ? 'உணவுப் பெயரைச் சொல்லுங்கள். மீண்டும் ஒருமுறை கேட்கிறேன்.'
        : language === 'hi'
        ? 'कृपया भोजन का नाम बोलें। मैं फिर से सुन रहा हूँ।'
        : 'Which food item would you like? Please say the name again.';
      setStatusMessage(retryPrompt);
      speakText(retryPrompt, () => startListeningSession(), language);
    }
  };

  const handleSpeechResult = async (spokenText: string, candidates: string[] = [spokenText]) => {
    if (!spokenText || !spokenText.trim()) return;

    // Check if we are waiting for schedule time
    if (pendingScheduleFlowRef.current) {
      const timeMatch = VoiceCommandParser.extractTime(spokenText, language) || parseSpokenTimeTo24Hr(spokenText);
      if (timeMatch) {
        const pending = pendingScheduleFlowRef.current;
        pendingScheduleFlowRef.current = null;
        setPendingScheduleFlow(null);
        executeVoiceSchedule(pending.item, timeMatch.time24, pending.recurrence);
        return;
      }
    }

    // Step 0: Single-day schedule skip/cancel voice command
    const isSkipHandled = await skipScheduleByVoiceCommand(spokenText);
    if (isSkipHandled) {
      voiceDebug(`[VoiceCommandModal]: Single-day schedule skip voice command processed for "${spokenText}"`);
      setIsVoiceModalOpen(false);
      return;
    }

    // Balance Reveal Intent
    const rawLower = spokenText.toLowerCase().trim();
    if (
      rawLower.includes('check balance') ||
      rawLower.includes('show balance') ||
      rawLower.includes('view balance') ||
      rawLower.includes('my balance') ||
      rawLower.includes('wallet balance') ||
      rawLower.includes('இருப்பு') ||
      rawLower.includes('வாலட் இருப்பு') ||
      rawLower.includes('बैलेंस')
    ) {
      setIsVoiceModalOpen(false);
      requestWalletBalanceReveal();
      return;
    }

    // Recharge Wallet Intent
    if (rawLower.includes('recharge') || rawLower.includes('பணம்') || rawLower.includes('ரீசார்ஜ்') || rawLower.includes('रिचार्ज')) {
      const match = rawLower.match(/\d+/);
      const amount = match ? parseInt(match[0], 10) : 500;
      rechargeWallet(amount);
      setActiveView('wallet');
      setIsVoiceModalOpen(false);
      return;
    }

    // Unified Voice Command Parser
    const parsed = VoiceCommandParser.parse(spokenText, language);
    voiceDebug('[VoiceCommandParser Result]', parsed);

    // Case 1: Item-only spoken ("parotta", "dosa", "பரோட்டா", "डोसा") -> prompt Order or Schedule
    if (parsed.needsOrderOrScheduleClarification && parsed.matchedFoodItem) {
      const targetItem = parsed.matchedFoodItem;
      const targetName = targetItem.nativeNames?.[language] || targetItem.name;
      const clarifyPrompt = language === 'ta'
        ? `${targetName} - இப்போதே ஆர்டர் செய்யவா அல்லது திட்டமிடவா?`
        : language === 'hi'
        ? `${targetName} - अभी ऑर्डर करें या बाद के लिए शेड्यूल करें?`
        : `${targetName} - Order now or schedule for later?`;
      setStatusMessage(clarifyPrompt);
      setChooserItems([targetItem]);
      speakText(clarifyPrompt, () => startListeningSession({ allowDuringTts: true }), language);
      return;
    }

    // Case 2: Order Instant
    if (parsed.action === 'order' && parsed.items.length > 0) {
      let matchedItem = parsed.matchedFoodItem || DynamicFoodSearchEngine.findBestMatchingFoodItem(parsed.items[0].name);
      if (!matchedItem && typeof navigator !== 'undefined' && navigator.onLine) {
        const fallback = await fetchSearchFallback(parsed.items[0].name, language);
        if (fallback.items.length > 0) {
          matchedItem = fallback.items[0];
        }
      }
      if (!matchedItem) {
        handleUnknownCommand(spokenText);
        return;
      }

      // Check multiple restaurants if restaurant not specified
      const matchingItems = INDIAN_FOOD_CATALOG.filter(i =>
        i.id === matchedItem!.id ||
        i.name.toLowerCase() === matchedItem!.name.toLowerCase() ||
        (matchedItem!.tags && matchedItem!.tags[0] && i.tags && i.tags.includes(matchedItem!.tags[0]))
      );

      let chosenItem = matchedItem;
      if (parsed.restaurant) {
        const restLower = parsed.restaurant.toLowerCase();
        const found = matchingItems.find(i => i.restaurant.toLowerCase().includes(restLower));
        if (found) chosenItem = found;
      } else {
        const restaurantNames = [...new Set(matchingItems.map(i => i.restaurant))];
        if (restaurantNames.length > 1) {
          const rList = restaurantNames;
          setRestaurantStep({ item: matchedItem, restaurants: rList, candidates });
          restaurantHandledRef.current = false;
          const top3Names = rList.slice(0, 3).join(', ');
          const prompt = language === 'ta'
            ? `எந்த உணவகம்? ${top3Names}`
            : language === 'hi'
            ? `कौन सा रेस्तरां? ${top3Names}`
            : `Which restaurant? ${top3Names}`;
          setStatusMessage(prompt);
          speakText(prompt, undefined, language);
          startListeningSession({ allowDuringTts: true });
          return;
        }
      }

      // Check nominee restriction
      if (NomineeNotificationService.hasRestrictedFetchError()) {
        showToast(t('nominee.restrictedLoadError'), 'warning');
        setIsVoiceModalOpen(false);
        return;
      }
      if (checkIsItemRestrictedByNominee(chosenItem.id, chosenItem.name)) {
        handleNomineeRestrictedInterception(chosenItem, 'instant');
        setIsVoiceModalOpen(false);
        return;
      }
      if (checkDailyOrderLimitReached()) {
        setIsVoiceModalOpen(false);
        return;
      }

      placeInstantOrder(chosenItem);
      setIsVoiceModalOpen(false);
      return;
    }

    // Case 3: Schedule
    if (parsed.action === 'schedule' && parsed.items.length > 0) {
      let matchedItem = parsed.matchedFoodItem || DynamicFoodSearchEngine.findBestMatchingFoodItem(parsed.items[0].name);
      if (!matchedItem && typeof navigator !== 'undefined' && navigator.onLine) {
        const fallback = await fetchSearchFallback(parsed.items[0].name, language);
        if (fallback.items.length > 0) {
          matchedItem = fallback.items[0];
        }
      }
      if (!matchedItem) {
        handleUnknownCommand(spokenText);
        return;
      }

      let chosenItem = matchedItem;
      if (parsed.restaurant) {
        const restLower = parsed.restaurant.toLowerCase();
        const matchingItems = INDIAN_FOOD_CATALOG.filter(i =>
          i.id === matchedItem!.id ||
          i.name.toLowerCase() === matchedItem!.name.toLowerCase() ||
          (matchedItem!.tags && matchedItem!.tags[0] && i.tags && i.tags.includes(matchedItem!.tags[0]))
        );
        const found = matchingItems.find(i => i.restaurant.toLowerCase().includes(restLower));
        if (found) chosenItem = found;
      }

      // Check nominee restriction early
      if (NomineeNotificationService.hasRestrictedFetchError()) {
        showToast(t('nominee.restrictedLoadError'), 'warning');
        setIsVoiceModalOpen(false);
        return;
      }
      if (checkIsItemRestrictedByNominee(chosenItem.id, chosenItem.name)) {
        handleNomineeRestrictedInterception(chosenItem, 'scheduled', {
          time: parsed.time || '08:00',
          duration: parsed.recurrence === 'once' ? 'today_only' : '1_month',
          frequency: parsed.recurrence || 'daily'
        });
        setIsVoiceModalOpen(false);
        return;
      }

      // If time missing, ask "At what time?"
      if (!parsed.time) {
        const askTimePrompt = language === 'ta'
          ? 'எந்த நேரத்தில் அட்டவணைப்படுத்த வேண்டும்?'
          : language === 'hi'
          ? 'किस समय शेड्यूल करना है?'
          : 'At what time should I schedule the order?';
        setStatusMessage(askTimePrompt);
        setPendingScheduleFlow({ item: chosenItem, recurrence: parsed.recurrence });
        speakText(askTimePrompt, () => startListeningSession({ allowDuringTts: true }), language);
        return;
      }

      executeVoiceSchedule(chosenItem, parsed.time, parsed.recurrence);
      return;
    }

    // Case 4: Search action or dynamic catalog match fallback
    const dynamicMatch = DynamicFoodSearchEngine.search({ query: spokenText, language });
    if (dynamicMatch.matchedItems.length > 0) {
      const best = dynamicMatch.matchedItems[0];
      const targetName = best.nativeNames?.[language] || best.name;
      const clarifyPrompt = language === 'ta'
        ? `${targetName} - இப்போதே ஆர்டர் செய்யவா அல்லது திட்டமிடவா?`
        : language === 'hi'
        ? `${targetName} - अभी ऑर्डर करें या बाद के लिए शेड्यूल करें?`
        : `${targetName} - Order now or schedule for later?`;
      setStatusMessage(clarifyPrompt);
      setChooserItems([best]);
      speakText(clarifyPrompt, () => startListeningSession({ allowDuringTts: true }), language);
      return;
    }

    if (parsed.action === 'search' || (parsed.items.length > 0 && !parsed.matchedFoodItem)) {
      const q = parsed.items[0]?.name || spokenText;
      executeSearch(q, false);
      setActiveView('search');
      setIsVoiceModalOpen(false);
      return;
    }

    // If still not matched, handle unknown
    handleUnknownCommand(spokenText);
  };

  const handleYes = () => {
    if (confirmHandledRef.current) return;
    confirmHandledRef.current = true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
    SpeechController.cancelSpeech();

    const item = pendingConfirmedFoodItemRef.current;
    const cmd = pendingCommandRef.current;
    const candidates = pendingAlternativesRef.current;
    setAwaitingConfirmation(false);

    if (!item) {
      processCommand(cmd);
      return;
    }

    // Find all restaurants serving this item
    const matchingItems = INDIAN_FOOD_CATALOG.filter(i =>
      i.id === item.id ||
      i.name.toLowerCase() === item.name.toLowerCase() ||
      (item.tags && item.tags[0] && i.tags && i.tags.includes(item.tags[0]))
    );
    const restaurantNames = [...new Set(matchingItems.map(i => i.restaurant))];

    // Enrich with distance and sort nearest first
    const sorted = restaurantNames.map(rName => {
      const rItem = matchingItems.find(i => i.restaurant === rName) || item;
      const dist = calculateHaversineDistance(
        userLocation?.latitude || 13.0827,
        userLocation?.longitude || 80.2707,
        rItem.restaurantLat || 13.0827,
        rItem.restaurantLng || 80.2707
      );
      return { name: rName, distanceKm: dist, item: rItem };
    }).sort((a, b) => a.distanceKm - b.distanceKm);

    if (sorted.length === 1) {
      const singleR = sorted[0].name;
      setSingleRestaurantPrompt({ item, restaurant: singleR, candidates });
      confirmHandledRef.current = false;
      const singlePrompt = t('voice.orderFromSingleRestaurant').replace('{restaurant}', singleR);
      setStatusMessage(singlePrompt);
      speakText(singlePrompt, undefined, language);
      startListeningSession({ allowDuringTts: true });
      return;
    }

    const rList = sorted.map(r => r.name);
    setRestaurantStep({ item, restaurants: rList, candidates });
    restaurantHandledRef.current = false;
    const top3Names = rList.slice(0, 3).join(', ');
    const multiPrompt = t('voice.restaurantPromptSpoken').replace('{names}', top3Names);
    setStatusMessage(multiPrompt);
    speakText(multiPrompt, undefined, language);
    startListeningSession({ allowDuringTts: true });
  };

  const handleNo = () => {
    if (confirmHandledRef.current) return;
    confirmHandledRef.current = true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
    SpeechController.cancelSpeech();
    setAwaitingConfirmation(false);
    setSingleRestaurantPrompt(null);
    setRestaurantStep(null);
    setPendingCommand('');
    setStatusMessage('');
    pendingConfirmedFoodItemRef.current = null;

    const cancelMsg = t('voice.cancelledOkay');
    showToast(cancelMsg);
    setStatusMessage(cancelMsg);
    speakText(cancelMsg, () => {
      startListeningSession();
    }, language);
  };

  const handleRestaurantSelected = (restaurantName: string) => {
    if (restaurantHandledRef.current) return;
    restaurantHandledRef.current = true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
    SpeechController.cancelSpeech();

    const baseItem = restaurantStep?.item || singleRestaurantPrompt?.item || pendingConfirmedFoodItemRef.current;
    setRestaurantStep(null);
    setSingleRestaurantPrompt(null);
    setAwaitingConfirmation(false);

    let chosenItem = baseItem;
    if (baseItem) {
      const specificItem = INDIAN_FOOD_CATALOG.find(i =>
        i.restaurant === restaurantName && (
          i.id === baseItem.id ||
          i.name.toLowerCase() === baseItem.name.toLowerCase() ||
          (baseItem.tags && baseItem.tags[0] && i.tags && i.tags.includes(baseItem.tags[0]))
        )
      );
      chosenItem = specificItem || { ...baseItem, restaurant: restaurantName };
    }

    if (!chosenItem) return;

    if (NomineeNotificationService.hasRestrictedFetchError()) {
      showToast(t('nominee.restrictedLoadError'), 'warning');
      setIsVoiceModalOpen(false);
      return;
    }
    if (checkIsItemRestrictedByNominee(chosenItem.id, chosenItem.name)) {
      handleNomineeRestrictedInterception(chosenItem, 'instant');
      setIsVoiceModalOpen(false);
      return;
    }
    if (checkDailyOrderLimitReached()) {
      setIsVoiceModalOpen(false);
      return;
    }

    placeInstantOrder(chosenItem);
    setIsVoiceModalOpen(false);
  };

  const processCommand = (cmdText: string) => {
    if (!cmdText || !cmdText.trim()) return;
    handleSpeechResult(cmdText, [cmdText]);
  };

  if (!isVoiceModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-3 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 shadow-2xl border-2 border-[#FBE9E5] relative text-[#33251F]">
        
        {/* Close Button & Debug Toggle (Dev Only) */}
        <div className="absolute top-4 right-4 flex items-center space-x-2">
          {(import.meta as any).env?.DEV && (
            <button
              onClick={() => setShowDebugPanel(!showDebugPanel)}
              className={`p-2 rounded-full cursor-pointer transition-colors ${
                showDebugPanel ? 'bg-[#D93636] text-white' : 'bg-slate-100 hover:bg-slate-200 text-[#4A5568]'
              }`}
              title="Toggle SpeechController Debug Logs"
            >
              <Bug className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => {
              SpeechController.stopListening('VoiceCommandModal');
              setIsVoiceModalOpen(false);
            }}
            className="p-2 rounded-full hover:bg-slate-100 text-[#4A5568] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-3 bg-[#D93636]/10 text-[#D93636] rounded-2xl">
            <Mic className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-black text-[#33251F]">{t('voice.modalTitle')}</h2>
            <p className="text-xs text-[#4A5568] font-bold">
              {awaitingConfirmation
                ? (language === 'ta' ? 'குரல் உறுதிப்படுத்தல்: "ஆம்" அல்லது "இல்லை" என்று சொல்லுங்கள்' : language === 'hi' ? 'आवाज़ पुष्टि: "हाँ" या "नहीं" बोलें' : 'Voice Confirmation Active: Say "Yes" or "No"')
                : restaurantStep
                ? (language === 'ta' ? 'உணவகத்தைத் தேர்ந்தெடுக்கவும்: பெயரை அல்லது எண்ணைக் கூறுங்கள்' : language === 'hi' ? 'रेस्तरां चुनें: नाम या संख्या बोलें' : 'Choose Restaurant: Say name, number, or tap')
                : singleRestaurantPrompt
                ? (language === 'ta' ? 'உணவக உறுதிப்படுத்தல்: "ஆம்" அல்லது "இல்லை" என்று சொல்லுங்கள்' : language === 'hi' ? 'रेस्तरां पुष्टि: "हाँ" या "नहीं" बोलें' : 'Confirm Restaurant: Say "Yes" or "No"')
                : t('voice.listening')}
            </p>
          </div>
        </div>

        {/* Listening Visualizer Button - Fixed mic icon state */}
        <div className="flex flex-col items-center justify-center my-4">
          <button
            onClick={toggleListening}
            className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 transform active:scale-95 cursor-pointer ${
              isListening
                ? 'bg-[#D93636] text-white animate-ping'
                : 'bg-[#D93636] hover:bg-[#33251F] text-white hover:scale-105'
            }`}
          >
            {isListening ? <Mic className="w-8 h-8 text-white" /> : <MicOff className="w-8 h-8 text-white" />}
          </button>
          <span className="mt-2 text-xs font-extrabold text-[#33251F]">
            {isListening ? 'Mic Active - Listening...' : 'Tap Mic to Speak'}
          </span>
        </div>

        {/* Transcript & Confirmation Display */}
        <div className={`p-4 rounded-2xl border min-h-[90px] mb-4 transition-all text-center flex flex-col items-center justify-center space-y-2 ${
          awaitingConfirmation || singleRestaurantPrompt || restaurantStep
            ? 'bg-[#FBE9E5]/60 border-[#D93636] text-[#33251F]'
            : 'bg-[#FBE9E5]/30 border-[#F0E5DC] text-[#33251F]'
        }`}>
          {transcript ? (
            <div>
              <p className="text-xs uppercase font-black tracking-wider text-[#D93636] mb-1">
                {restaurantStep
                  ? (language === 'ta' ? 'உணவகத்தைத் தேர்ந்தெடுக்கவும்' : language === 'hi' ? 'रेस्तरां चुनें' : 'Select Restaurant')
                  : singleRestaurantPrompt
                  ? (language === 'ta' ? 'உணவக உறுதிப்படுத்தல்' : language === 'hi' ? 'रेस्तरां पुष्टि' : 'Confirm Restaurant')
                  : awaitingConfirmation
                  ? 'Recognized Command — Awaiting Voice "Yes" or "No"'
                  : (t('voice.recognizedSpeech') || 'Recognized Speech')}
              </p>
              <p className="text-lg font-black leading-snug">"{sanitizeTranscriptForDisplay(transcript)}"</p>
              {statusMessage && (
                <p className="text-xs font-bold text-[#D93636] mt-2 flex items-center justify-center gap-1">
                  <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                  <span>{statusMessage}</span>
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className="text-xs text-[#4A5568] italic font-bold">
                {language === 'ta'
                  ? 'Say "தோசை ஆர்டர் பண்ணு" or "காலை 8 மணிக்கு பரோட்டா அட்டவணைப்படுத்து".'
                  : language === 'hi'
                  ? 'Say "दो डोसा ऑर्डर करो" or "सुबह 8 बजे पराठा शेड्यूल करो".'
                  : 'Say "order dosa" or "schedule parotta at 8 AM".'}
              </p>
              {statusMessage && (
                <p className="text-xs font-bold text-[#D93636] mt-2 flex items-center justify-center gap-1">
                  <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                  <span>{statusMessage}</span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Mic unavailable hint if permission denied or unsupported */}
        {micErrorHint && (
          <p className="text-[11px] text-[#D93636] font-bold text-center mb-3">
            {micErrorHint}
          </p>
        )}

        {/* Step 1: Voice or Tap Confirmation Action Buttons */}
        {awaitingConfirmation && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={handleNo}
              className="py-3 px-4 bg-[#D93636]/10 hover:bg-[#D93636]/20 text-[#D93636] font-black rounded-2xl text-xs shadow-sm transition-all flex items-center justify-center space-x-1.5 cursor-pointer border border-[#D93636]/30"
            >
              <XCircle className="w-4 h-4 text-[#D93636]" />
              <span>
                {language === 'ta' ? 'இல்லை (Cancel)' : language === 'hi' ? 'नहीं (Cancel)' : 'No, Cancel (Say "No")'}
              </span>
            </button>

            <button
              onClick={handleYes}
              className="py-3 px-4 bg-[#D93636] hover:bg-[#33251F] text-white font-black rounded-2xl text-xs shadow-md shadow-[#D93636]/30 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>
                {language === 'ta' ? 'ஆம் (Proceed)' : language === 'hi' ? 'हाँ (Proceed)' : 'Yes, Proceed (Say "Yes")'}
              </span>
            </button>
          </div>
        )}

        {/* Single Restaurant Yes/No Confirmation Action Buttons */}
        {singleRestaurantPrompt && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={handleNo}
              className="py-3 px-4 bg-[#D93636]/10 hover:bg-[#D93636]/20 text-[#D93636] font-black rounded-2xl text-xs shadow-sm transition-all flex items-center justify-center space-x-1.5 cursor-pointer border border-[#D93636]/30"
            >
              <XCircle className="w-4 h-4 text-[#D93636]" />
              <span>
                {language === 'ta' ? 'இல்லை (Cancel)' : language === 'hi' ? 'नहीं (Cancel)' : 'No, Cancel'}
              </span>
            </button>

            <button
              onClick={() => handleRestaurantSelected(singleRestaurantPrompt.restaurant)}
              className="py-3 px-4 bg-[#D93636] hover:bg-[#33251F] text-white font-black rounded-2xl text-xs shadow-md shadow-[#D93636]/30 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>
                {language === 'ta' ? 'ஆம் (Proceed)' : language === 'hi' ? 'हाँ (Proceed)' : 'Yes, Proceed'}
              </span>
            </button>
          </div>
        )}

        {/* Multi-Restaurant List Selection Cards */}
        {restaurantStep && restaurantStep.restaurants.length > 0 && (
          <div className="mb-4 p-4 bg-[#D93636]/10 rounded-2xl border border-[#D93636]/30 space-y-2">
            <p className="text-xs font-black text-[#D93636] flex items-center gap-1">
              <Volume2 className="w-4 h-4 animate-pulse" /> {t('voice.restaurantsAvailable')}
            </p>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
              {restaurantStep.restaurants.map((rName, idx) => (
                <button
                  key={rName}
                  onClick={() => handleRestaurantSelected(rName)}
                  className="p-3 bg-white hover:bg-[#FBE9E5] text-[#33251F] font-black rounded-xl text-xs border border-[#F0E5DC] text-left shadow-sm flex items-center justify-between cursor-pointer transition-all active:scale-95"
                >
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-[#D93636] text-white text-[10px] flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    <span className="font-extrabold">{rName}</span>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-[#D93636]" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Popular Items Fallback after retries */}
        {showPopularSuggestions && (
          <div className="mb-4 p-4 bg-[#D93636]/10 rounded-2xl border border-[#D93636]/30 space-y-2">
            <p className="text-xs font-black text-[#D93636] flex items-center gap-1">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span>
                {language === 'ta'
                  ? 'பிரபலமான உணவுகள் (தொட்டு தேர்ந்தெடுக்கலாம்):'
                  : language === 'hi'
                  ? 'लोकप्रिय आइटम (टैप करके चुनें):'
                  : 'Popular Items (Tap to choose):'}
              </span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              {POPULAR_ITEMS.map(pItem => (
                <button
                  key={pItem.id}
                  onClick={() => {
                    setShowPopularSuggestions(false);
                    handleSpeechResult(pItem.name);
                  }}
                  className="p-2.5 bg-white hover:bg-[#FBE9E5] text-[#33251F] font-black rounded-xl text-xs border border-[#F0E5DC] text-left shadow-sm flex items-center justify-between cursor-pointer transition-all active:scale-95"
                >
                  <span className="truncate">{pItem.nativeNames?.[language] || pItem.name}</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#D93636] shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Generic Category Variant Buttons */}
        {variantSuggestions && variantSuggestions.items.length > 0 && (
          <div className="mb-4 p-4 bg-[#D93636]/10 rounded-2xl border border-[#D93636]/30 space-y-2">
            <p className="text-xs font-black text-[#D93636] flex items-center gap-1">
              <Volume2 className="w-4 h-4 animate-pulse" /> {variantSuggestions.prompt}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {variantSuggestions.items.map(vItem => (
                <button
                  key={vItem.id}
                  onClick={() => {
                    setVariantSuggestions(null);
                    setChooserItems([vItem]);
                  }}
                  className="p-3 bg-white hover:bg-[#FBE9E5] text-[#33251F] font-black rounded-xl text-xs border border-[#F0E5DC] text-left shadow-sm flex items-center justify-between cursor-pointer transition-all active:scale-95"
                >
                  <div>
                    <div className="font-extrabold">{vItem.nativeNames?.[language] || vItem.name}</div>
                    <div className="text-[10px] text-[#4A5568]">{vItem.restaurant} • ₹{vItem.basePrice}</div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-[#D93636]" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Process Command Fallback Button */}
        {transcript && !awaitingConfirmation && !restaurantStep && !singleRestaurantPrompt && (
          <button
            onClick={() => processCommand(transcript)}
            className="w-full bg-[#D93636] hover:bg-[#33251F] text-white font-black py-3 rounded-2xl mb-4 shadow-md transition-transform active:scale-98 cursor-pointer text-xs sm:text-sm"
          >
            Process Voice Command Now 🚀
          </button>
        )}

        {/* Real Debug Log Panel (Dev Only) */}
        {(import.meta as any).env?.DEV && showDebugPanel && (
          <div className="mb-4 p-3 bg-slate-900 text-green-400 rounded-2xl font-mono text-[10px] max-h-40 overflow-y-auto border border-slate-700">
            <div className="font-bold text-white mb-1 border-b border-slate-700 pb-1 flex justify-between">
              <span>SpeechController Debug Event Logs</span>
              <span className="text-slate-400">Owner: VoiceCommandModal</span>
            </div>
            {SpeechController.getDebugLogs().length === 0 ? (
              <p className="text-slate-500 italic">No events logged yet...</p>
            ) : (
              SpeechController.getDebugLogs().map((log, idx) => (
                <div key={idx} className="leading-tight py-0.5 border-b border-slate-800">
                  <span className="text-slate-400">[{log.timestamp}]</span> <span className="text-yellow-400 font-bold">[{log.type}]</span>: {log.detail}
                </div>
              ))
            )}
          </div>
        )}

        {/* Offline Voice Setup Section */}
        <div className="my-4 p-4 bg-slate-50 border border-slate-200/90 rounded-2xl shadow-sm text-left">
          {/* Header & Status Badge */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-[#D93636]/10 text-[#D93636] rounded-lg">
                <HardDrive className="w-4 h-4" />
              </div>
              <h4 className="text-xs sm:text-sm font-black text-[#33251F]">
                {language === 'ta'
                  ? 'ஆஃப்லைன் குரல் அமைப்பு'
                  : language === 'hi'
                  ? 'ऑफ़लाइन वॉइस सेटअप'
                  : 'Offline Voice Setup'}
              </h4>
            </div>

            {/* Model Status Badge */}
            {isDownloadingModel ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-100 text-blue-700 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Downloading {downloadProgress}%</span>
              </span>
            ) : offlineStatus.isDownloaded ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Downloaded / Ready</span>
              </span>
            ) : downloadError ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-red-100 text-red-700 border border-red-200">
                <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                <span>Download Failed</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-slate-200/80 text-slate-700">
                <WifiOff className="w-3 h-3 text-slate-500" />
                <span>Not Downloaded</span>
              </span>
            )}
          </div>

          {/* Model Description & Details */}
          <p className="text-[11px] text-[#4A5568] font-medium leading-relaxed mb-3">
            {language === 'ta'
              ? 'Whisper Multilingual Tiny (~39 MB) மாதிரியை உலாவியில் சேமித்து வைத்தால், இணைய இணைப்பு இல்லாதபோதும் தமிழ் மற்றும் ஆங்கில குரல் தேடல் சீராக இயங்கும்.'
              : language === 'hi'
              ? 'Whisper Multilingual Tiny (~39 MB) मॉडल को ब्राउज़र में सहेजें ताकि बिना इंटरनेट के भी तमिल और अंग्रेज़ी वॉइस सर्च काम करे।'
              : 'Download the compact Whisper Multilingual Tiny model (~39 MB) into browser storage to enable voice search even without internet connectivity.'}
          </p>

          {/* Progress Bar (Visible while downloading) */}
          {isDownloadingModel && (
            <div className="mb-3 space-y-1.5">
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#D93636] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(5, downloadProgress)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-extrabold text-[#4A5568]">
                <span>Downloading Whisper model...</span>
                <span>{downloadProgress}%</span>
              </div>
            </div>
          )}

          {/* Success Message Banner */}
          {downloadSuccessMessage && (
            <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{downloadSuccessMessage}</span>
            </div>
          )}

          {/* Error Message Banner */}
          {downloadError && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-bold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{downloadError}</span>
            </div>
          )}

          {/* User Consent Prompt */}
          {showConsentPrompt ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
              <p className="text-xs font-bold text-amber-900">
                {language === 'ta'
                  ? 'ஆஃப்லைன் குரல் மாதிரி பதிவிறக்கம் (~39 MB):'
                  : language === 'hi'
                  ? 'ऑफ़लाइन वॉइस मॉडल डाउनलोड (~39 MB):'
                  : 'Download Offline Whisper Model (~39 MB)?'}
              </p>
              <p className="text-[11px] text-amber-800 leading-normal">
                {language === 'ta'
                  ? 'இந்த மாதிரி உங்கள் சாதனத்தின் உலாவியில் ஒருமுறை மட்டுமே பதிவிறக்கப்பட்டு சேமிக்கப்படும். இணையம் இல்லாதபோதும் குரல் மூலம் உணவுகளைத் தேட இது உதவும். தொடரலாமா?'
                  : language === 'hi'
                  ? 'यह मॉडल आपके ब्राउज़र में एक बार डाउनलोड होकर सुरक्षित रहेगा जिससे बिना इंटरनेट के भी वॉइस सर्च चलेगा। क्या आप आगे बढ़ना चाहते हैं?'
                  : 'This will download the Whisper Multilingual Tiny model (~39 MB) into your local browser cache so voice search works without internet. Would you like to proceed?'}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleConfirmConsentDownload}
                  className="flex-1 py-2 px-3 bg-[#D93636] hover:bg-[#33251F] text-white font-black text-xs rounded-lg shadow-sm transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {language === 'ta' ? 'ஆம், பதிவிறக்கு' : language === 'hi' ? 'हाँ, डाउनलोड करें' : 'Confirm & Download'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleCancelConsent}
                  className="py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-lg border border-slate-300 transition-colors cursor-pointer"
                >
                  {language === 'ta' ? 'ரத்து செய்' : language === 'hi' ? 'रद्द करें' : 'Cancel'}
                </button>
              </div>
            </div>
          ) : (
            /* Action Button: Download or Ready Status */
            <div>
              {offlineStatus.isDownloaded ? (
                <div className="w-full py-2.5 px-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-black flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>
                    {language === 'ta'
                      ? 'ஆஃப்லைன் குரல் தயார் (Whisper 39 MB சேமிக்கப்பட்டுள்ளது)'
                      : language === 'hi'
                      ? 'ऑफ़लाइन वॉइस तैयार (Whisper 39 MB सुरक्षित)'
                      : 'Offline Voice Ready (Whisper 39 MB Cached)'}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleInitiateDownload}
                  disabled={isDownloadingModel}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isDownloadingModel
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-[#D93636] hover:bg-[#33251F] text-white hover:shadow active:scale-98'
                  }`}
                >
                  {isDownloadingModel ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>
                        {language === 'ta'
                          ? `பதிவிறக்குகிறது (${downloadProgress}%)...`
                          : language === 'hi'
                          ? `डाउनलोड हो रहा है (${downloadProgress}%)...`
                          : `Downloading (${downloadProgress}%)...`}
                      </span>
                    </>
                  ) : downloadError ? (
                    <>
                      <Download className="w-4 h-4" />
                      <span>
                        {language === 'ta'
                          ? 'மீண்டும் பதிவிறக்க முயற்சிக்கவும் (~39 MB)'
                          : language === 'hi'
                          ? 'पुनः डाउनलोड का प्रयास करें (~39 MB)'
                          : 'Retry Download Offline Voice Model (~39 MB)'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>
                        {language === 'ta'
                          ? 'ஆஃப்லைன் குரல் மாதிரியைப் பதிவிறக்கு (~39 MB)'
                          : language === 'hi'
                          ? 'ऑफ़लाइन वॉइस मॉडल डाउनलोड करें (~39 MB)'
                          : 'Download Offline Voice Model (~39 MB)'}
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Quick Sample Voice Command Presets */}
        <div>
          <h4 className="text-xs font-black text-[#4A5568] uppercase tracking-wider mb-2 flex items-center gap-1">
            <Command className="w-3.5 h-3.5" /> Direct Voice Command Presets (Click or Speak):
          </h4>
          <div className="grid grid-cols-1 gap-2 text-xs">
            <button
              onClick={() => handleSpeechResult("order dosa")}
              className="text-left bg-[#16A34A]/10 hover:bg-[#16A34A]/20 text-[#16A34A] font-extrabold p-2.5 rounded-xl border border-[#16A34A]/30 cursor-pointer"
            >
              ⚡ "order dosa" → (Orders Dosa via Dynamic Search Pipeline)
            </button>

            <button
              onClick={() => handleSpeechResult("schedule parotta at 8 AM")}
              className="text-left bg-[#FBE9E5] hover:bg-[#F0E5DC] text-[#33251F] font-extrabold p-2.5 rounded-xl border border-[#F0E5DC] cursor-pointer"
            >
              📅 "schedule parotta at 8 AM" → Direct Schedule for 8 AM
            </button>

            <button
              onClick={() => handleSpeechResult("parotta")}
              className="text-left bg-[#D93636]/10 hover:bg-[#D93636]/20 text-[#D93636] font-extrabold p-2.5 rounded-xl border border-[#D93636]/30 cursor-pointer"
            >
              ❓ "parotta" → (Item only spoken → Asks "Order Now or Schedule?")
            </button>
          </div>
        </div>

      </div>

      {/* SHARED ITEM ACTION CHOOSER MODAL */}
      <ItemActionChooser
        isOpen={Boolean(chooserItems && chooserItems.length > 0)}
        onClose={() => setChooserItems(null)}
        items={chooserItems || []}
        onOrderNow={(items) => {
          if (items.length === 1) {
            placeInstantOrder(items[0]);
          } else {
            items.forEach(i => addToCart(i, 1, 'voice_search'));
            setIsScheduleCartOpen(true);
          }
          setIsVoiceModalOpen(false);
        }}
        onSchedule={(items) => {
          items.forEach(i => addToCart(i, 1, 'voice_search'));
          setIsScheduleCartOpen(true);
          setIsVoiceModalOpen(false);
        }}
        onAddToCart={(items) => {
          if (items && items.length > 0) {
            items.forEach(i => {
              addToCart(i, 1, 'voice_search');
            });
            const firstItemName = items[0].nativeNames?.[language] || items[0].name;
            const addedMsg = t('addedNext').replace('{item}', items.length > 1 ? `${items.length} items` : firstItemName);
            showToast(addedMsg);
            speakText(addedMsg, undefined, language);
          }
          setIsVoiceModalOpen(false);
        }}
      />
    </div>
  );
};
