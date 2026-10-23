import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { SpeechController } from '../services/speechController';
import { LlmNluService, LocationChoiceNluResult } from '../services/llmNluService';
import { SttMatcherService } from '../services/sttMatcherService';
import { forwardGeocode, GeocodedPlace } from '../services/locationService';
import { UserLocation } from '../types';
import { MapPin, Navigation, CheckCircle2, XCircle, Mic, Volume2, Sparkles, Search, Building2, AlertTriangle, ArrowRight } from 'lucide-react';

export const LocationPermissionModal: React.FC = () => {
  const {
    entryStep,
    setEntryStep,
    language,
    speakText,
    setManualUserLocation,
    setSelectedLocation,
    t,
    showToast
  } = useApp();



  // Modal Sub-state
  // 'initial': asking "Can we use your live location, or do you want to change the address?"
  // 'asking_place': asking "Which location should I set?"
  // 'confirming_place': "Setting location to <place>. Is that correct?"
  // 'manual_picker': fallback / tap panel with search box, city list, GPS, and skip
  const [modalMode, setModalMode] = useState<'initial' | 'asking_place' | 'confirming_place' | 'manual_picker'>('initial');

  const [isSpeakingPrompt, setIsSpeakingPrompt] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Address Geocoding & Confirmation State
  const [pendingCandidatePlace, setPendingCandidatePlace] = useState<GeocodedPlace | null>(null);
  const [customSearchQuery, setCustomSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodedPlace[]>([]);
  const [isSearchingGeocode, setIsSearchingGeocode] = useState(false);

  // Silence retry tracking
  const hasRetriedSilenceRef = useRef(false);
  const isComponentActiveRef = useRef(true);
  const lastSpokenPromptRef = useRef<string>('');

  const popularCities = [
    { city: 'Chennai', area: 'Anna Nagar', lat: 13.0827, lng: 80.2707 },
    { city: 'Chennai', area: 'T. Nagar', lat: 13.0418, lng: 80.2341 },
    { city: 'Salem', area: 'Fairlands', lat: 11.6643, lng: 78.1460 },
    { city: 'Coimbatore', area: 'Gandhipuram', lat: 11.0168, lng: 76.9558 },
    { city: 'Madurai', area: 'KK Nagar', lat: 9.9252, lng: 78.1198 },
    { city: 'Bengaluru', area: 'Indiranagar', lat: 12.9784, lng: 77.6408 },
    { city: 'Hyderabad', area: 'Gachibowli', lat: 17.4401, lng: 78.3489 },
    { city: 'Mumbai', area: 'Bandra West', lat: 19.0596, lng: 72.8295 },
    { city: 'Delhi', area: 'Connaught Place', lat: 28.6315, lng: 77.2167 },
    { city: 'Dharmapuri', area: 'Main Road', lat: 12.1211, lng: 78.1582 }
  ];

  const getQuestionText = useCallback((): string => {
    return t('location.permissionQuestion');
  }, [t]);

  /**
   * Finalize location and proceed to dashboard
   */
  const finalizeLocation = useCallback((newLoc: UserLocation) => {
    console.log('[LocationPermissionModal]: Finalizing location:', newLoc);
    SpeechController.releaseMic('location_permission');
    SpeechController.cancelSpeech();

    setManualUserLocation(newLoc);
    if (newLoc.city && newLoc.city !== 'Not set') {
      setSelectedLocation(newLoc.city);
    }

    const toastMsg = newLoc.city === 'Not set'
      ? t('location.notSet')
      : t('location.locationSet').replace('{area}', newLoc.area).replace('{city}', newLoc.city);

    showToast(toastMsg);
    setEntryStep('dashboard');
  }, [setManualUserLocation, setSelectedLocation, t, showToast, setEntryStep]);

  /**
   * Handler when live GPS is chosen.
   *
   * ROOT-CAUSE FIX: detectGPSLocation() returns void and only calls setUserLocation()
   * internally. Reading `userLocation` after awaiting it hits a stale closure — React
   * state hasn't re-rendered yet, so the old (empty) location is captured and
   * finalizeLocation() never calls setEntryStep('dashboard').
   *
   * Fix: call fetchLiveGPSLocation() directly here so we get the resolved UserLocation
   * object back synchronously from the Promise, bypassing the stale-closure entirely.
   */
  const handleUseLiveGPS = useCallback(async () => {
    SpeechController.releaseMic('location_permission');
    setIsAnalyzing(true);
    setStatusMessage(
      language === 'ta'
        ? '📍 GPS கண்டறிகிறது...'
        : language === 'hi'
        ? '📍 GPS खोज रहा है...'
        : '📍 Detecting device GPS...'
    );

    try {
      // ✅ Import fetchLiveGPSLocation at the top of the file (already imported via locationService)
      const { fetchLiveGPSLocation } = await import('../services/locationService');
      const loc = await fetchLiveGPSLocation();   // ← get the real location object directly

      const area = loc.area || (language === 'ta' ? 'தற்போதைய பகுதி' : language === 'hi' ? 'वर्तमान क्षेत्र' : 'Current Area');
      const city = loc.city || (language === 'ta' ? 'தற்போதைய நகரம்' : language === 'hi' ? 'वर्तमान शहर' : 'Current City');
      const spoken = t('location.locationSet').replace('{area}', area).replace('{city}', city);

      setIsAnalyzing(false);
      setStatusMessage(null);

      // Speak the confirmed location, then advance to dashboard
      speakText(spoken, () => {
        finalizeLocation(loc);
      }, language);

      // Advance immediately if TTS is unavailable / disabled
      if (!speakText) {
        finalizeLocation(loc);
      }
    } catch (e: any) {
      console.warn('[LocationPermissionModal]: GPS failed:', e);
      setIsAnalyzing(false);

      const deniedMsg =
        language === 'ta'
          ? '⚠️ GPS அனுமதி மறுக்கப்பட்டது. கைமுறையாக இடத்தை தேர்வு செய்யவும்.'
          : language === 'hi'
          ? '⚠️ GPS अनुमति अस्वीकृत। कृपया स्थान मैन्युअल रूप से चुनें।'
          : '⚠️ GPS access denied or unavailable. Please pick your location manually.';

      setStatusMessage(deniedMsg);
      speakText(deniedMsg, () => {
        setModalMode('manual_picker');
      }, language);
    }
  }, [language, t, speakText, finalizeLocation]);


  /**
   * Forward geocode and prompt confirmation for recognized address
   */
  const processAddressCandidate = useCallback(async (placeName: string) => {
    if (!placeName || !placeName.trim()) {
      setStatusMessage(t('location.noMatchFound'));
      setModalMode('manual_picker');
      return;
    }

    setIsAnalyzing(true);
    setStatusMessage(t('location.searchingNominatim'));

    const matches = await forwardGeocode(placeName);
    setIsAnalyzing(false);

    if (matches && matches.length > 0) {
      const best = matches[0];
      setPendingCandidatePlace(best);
      setModalMode('confirming_place');

      const confirmPrompt = t('location.confirmLocation').replace('{place}', best.addressName);
      lastSpokenPromptRef.current = confirmPrompt;
      setIsSpeakingPrompt(true);

      speakText(confirmPrompt, () => {
        setIsSpeakingPrompt(false);
        if (isComponentActiveRef.current) {
          startListeningForTurn('confirm_place', confirmPrompt);
        }
      }, language);
    } else {
      const noMatchMsg = t('location.noMatchFound');
      setStatusMessage(noMatchMsg);
      speakText(noMatchMsg, () => {
        setModalMode('manual_picker');
      }, language);
    }
  }, [t, speakText, language]);

  /**
   * Unified Turn-Based Speech Listener
   */
  const startListeningForTurn = useCallback((turnType: 'initial' | 'ask_place' | 'confirm_place', promptQuestion: string) => {
    if (!SpeechController.isSupported()) return;

    // Never listen while TTS is speaking! Cancel speech and pause
    SpeechController.cancelSpeech();
    setIsSpeakingPrompt(false);
    setIsListening(true);
    setLiveTranscript('');

    SpeechController.requestMic({
      owner: 'location_permission',
      language,
      continuous: false,
      interimResults: true,
      maxAlternatives: 5,
      silenceTimeoutMs: 8000,
      onStart: () => {
        setIsListening(true);
      },
      onSilence: () => {
        setIsListening(false);
        SpeechController.releaseMic('location_permission');

        if (!hasRetriedSilenceRef.current && promptQuestion) {
          hasRetriedSilenceRef.current = true;
          console.log('[LocationPermissionModal]: Silence timeout (8s) -> repeating prompt once');
          setIsSpeakingPrompt(true);
          speakText(promptQuestion, () => {
            setIsSpeakingPrompt(false);
            if (isComponentActiveRef.current) {
              startListeningForTurn(turnType, promptQuestion);
            }
          }, language);
        } else {
          console.log('[LocationPermissionModal]: Repeated silence -> keeping tap buttons visible');
          setIsListening(false);
        }
      },
      onResult: async (transcript, isFinal, nBestTranscripts) => {
        if (!transcript || !transcript.trim()) return;
        setLiveTranscript(transcript);

        if (!isFinal) return; // Process only completed utterance

        console.log(`[LocationPermissionModal Turn: ${turnType} Spoken]: "${transcript}"`);
        setIsListening(false);
        SpeechController.releaseMic('location_permission');
        setIsAnalyzing(true);

        const candidates = (nBestTranscripts && nBestTranscripts.length > 0) ? nBestTranscripts : [transcript];

        if (turnType === 'confirm_place') {
          // Confirming candidate place
          const confirmMatch = SttMatcherService.matchConfirmation(candidates, language);
          setIsAnalyzing(false);

          if (confirmMatch.isMatched && confirmMatch.matchedValue === 'YES' && pendingCandidatePlace) {
            const newLoc: UserLocation = {
              latitude: pendingCandidatePlace.latitude,
              longitude: pendingCandidatePlace.longitude,
              addressName: pendingCandidatePlace.addressName,
              city: pendingCandidatePlace.city,
              area: pendingCandidatePlace.area,
              isLiveGPS: false,
              isApproximate: false,
              isManualOverride: true
            };
            finalizeLocation(newLoc);
          } else if (confirmMatch.isMatched && confirmMatch.matchedValue === 'NO') {
            setPendingCandidatePlace(null);
            setModalMode('manual_picker');
          } else {
            // Check via LLM
            const nlu = await LlmNluService.interpretLocationChoice(transcript, { language, alternatives: candidates, step: 'location_choice' });
            if (nlu.intent === 'use_live_location') {
              if (pendingCandidatePlace) {
                const newLoc: UserLocation = {
                  latitude: pendingCandidatePlace.latitude,
                  longitude: pendingCandidatePlace.longitude,
                  addressName: pendingCandidatePlace.addressName,
                  city: pendingCandidatePlace.city,
                  area: pendingCandidatePlace.area,
                  isLiveGPS: false,
                  isApproximate: false,
                  isManualOverride: true
                };
                finalizeLocation(newLoc);
              }
            } else {
              setModalMode('manual_picker');
            }
          }
          return;
        }

        if (turnType === 'ask_place') {
          setIsAnalyzing(false);
          const nlu = await LlmNluService.interpretLocationChoice(transcript, { language, alternatives: candidates, step: 'location_choice' });
          if (nlu.intent === 'give_address' && nlu.address) {
            await processAddressCandidate(nlu.address);
          } else if (nlu.intent === 'use_live_location') {
            await handleUseLiveGPS();
          } else if (nlu.intent === 'cancel') {
            setModalMode('manual_picker');
          } else {
            // Treat spoken phrase directly as place name candidate
            await processAddressCandidate(transcript);
          }
          return;
        }

        // turnType === 'initial'
        const nlu = await LlmNluService.interpretLocationChoice(transcript, { language, alternatives: candidates, step: 'location_choice' });
        console.log('[LocationPermissionModal Initial NLU Result]:', nlu);
        setIsAnalyzing(false);

        switch (nlu.intent) {
          case 'use_live_location':
            await handleUseLiveGPS();
            break;

          case 'change_location':
            setModalMode('asking_place');
            const askPlacePrompt = t('location.whichLocationQuestion');
            lastSpokenPromptRef.current = askPlacePrompt;
            setIsSpeakingPrompt(true);
            speakText(askPlacePrompt, () => {
              setIsSpeakingPrompt(false);
              if (isComponentActiveRef.current) {
                startListeningForTurn('ask_place', askPlacePrompt);
              }
            }, language);
            break;

          case 'give_address':
            if (nlu.address) {
              await processAddressCandidate(nlu.address);
            } else {
              await processAddressCandidate(transcript);
            }
            break;

          case 'repeat':
            hasRetriedSilenceRef.current = false;
            triggerInitialVoicePrompt();
            break;

          case 'cancel':
            setModalMode('manual_picker');
            break;

          case 'unclear':
          default:
            const hint = t('location.unclearHint');
            setStatusMessage(hint);
            speakText(hint, () => {
              if (isComponentActiveRef.current) {
                startListeningForTurn('initial', getQuestionText());
              }
            }, language);
            break;
        }
      },
      onError: (errCode) => {
        console.warn('[LocationPermissionModal Voice Error]:', errCode);
        setIsListening(false);
        setIsAnalyzing(false);
        if (errCode === 'not-allowed' || errCode === 'permission-denied') {
          setStatusMessage(language === 'ta' ? 'மைக் அணுகல் தடுக்கப்பட்டுள்ளது.' : language === 'hi' ? 'माइक्रोफ़ोन अवरुद्ध है।' : 'Microphone access blocked.');
        }
      },
      onEnd: () => {
        setIsListening(false);
      }
    });
  }, [language, t, getQuestionText, speakText, pendingCandidatePlace, finalizeLocation, handleUseLiveGPS, processAddressCandidate]);

  /**
   * Initial voice prompt sequence: TTS speaks first, then STT listens
   */
  const triggerInitialVoicePrompt = useCallback(() => {
    SpeechController.releaseMic('location_permission');
    SpeechController.cancelSpeech();

    const question = getQuestionText();
    lastSpokenPromptRef.current = question;
    setIsSpeakingPrompt(true);
    setIsListening(false);
    setStatusMessage(null);
    setLiveTranscript('');

    console.log('[LocationPermissionModal]: Speaking initial question:', question);

    speakText(question, () => {
      setIsSpeakingPrompt(false);
      if (isComponentActiveRef.current && entryStep === 'location_permission') {
        startListeningForTurn('initial', question);
      }
    }, language);
  }, [getQuestionText, speakText, language, entryStep, startListeningForTurn]);

  // Restart voice flow if modal opens or if user switches app language mid-flow
  useEffect(() => {
    isComponentActiveRef.current = true;
    hasRetriedSilenceRef.current = false;

    if (entryStep === 'location_permission') {
      setModalMode('initial');
      triggerInitialVoicePrompt();
    }

    return () => {
      isComponentActiveRef.current = false;
      SpeechController.releaseMic('location_permission');
      SpeechController.cancelSpeech();
    };
  }, [entryStep, language]);

  const handleManualSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSearchQuery.trim()) return;

    setIsSearchingGeocode(true);
    setStatusMessage(t('location.searchingNominatim'));
    const matches = await forwardGeocode(customSearchQuery);
    setIsSearchingGeocode(false);
    setSearchResults(matches);

    if (matches.length === 0) {
      setStatusMessage(t('location.noMatchFound'));
    } else {
      setStatusMessage(null);
    }
  };

  const handleSelectPreset = (p: typeof popularCities[0]) => {
    const newLoc: UserLocation = {
      latitude: p.lat,
      longitude: p.lng,
      addressName: `${p.area}, ${p.city}`,
      city: p.city,
      area: p.area,
      isLiveGPS: false,
      isApproximate: false,
      isManualOverride: true
    };
    finalizeLocation(newLoc);
  };

  const handleExplicitSkip = () => {
    const unassignedLoc: UserLocation = {
      latitude: 13.0827,
      longitude: 80.2707,
      addressName: 'Location not set',
      city: 'Not set',
      area: 'Location not set',
      isLiveGPS: false,
      isApproximate: true,
      isManualOverride: false
    };
    finalizeLocation(unassignedLoc);
  };

  if (entryStep !== 'location_permission') return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-white text-[#1A1110] rounded-3xl p-6 sm:p-8 shadow-2xl border-4 border-[#FF5A1F] text-center space-y-5">
        
        {/* Header Icon */}
        <div className="inline-flex p-4 bg-[#DAF0F7] rounded-full border-2 border-[#B2E2F0] text-[#FF5A1F]">
          <MapPin className="w-9 h-9 animate-bounce text-[#FF5A1F]" />
        </div>

        {/* Step Badge */}
        <div>
          <span className="text-xs font-black uppercase tracking-widest text-[#FF5A1F] bg-[#FF5A1F]/10 px-3 py-1 rounded-full border border-[#FF5A1F]/30">
            {language === 'ta' ? 'படி 4: இருப்பிட அனுமதி' : language === 'hi' ? 'चरण 4: स्थान अनुमति' : 'Step 4: Location Choice'}
          </span>
        </div>

        {/* Dynamic Header Question / Mode Title */}
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-[#1A1110]">
            {modalMode === 'confirming_place' && pendingCandidatePlace
              ? t('location.confirmLocation').replace('{place}', pendingCandidatePlace.addressName)
              : modalMode === 'asking_place'
              ? t('location.whichLocationQuestion')
              : modalMode === 'manual_picker'
              ? t('location.changeAddress')
              : getQuestionText()}
          </h2>

          <p className="text-xs font-bold text-[#4A5568]">
            {modalMode === 'manual_picker'
              ? (language === 'ta' ? 'ஜிபிஎஸ், பிரபலமான பகுதிகள் அல்லது தட்டச்சு செய்து தேர்வு செய்யவும்.' : language === 'hi' ? 'जीपीएस, लोकप्रिय क्षेत्र चुनें या टाइप करें।' : 'Auto-detect GPS, pick a popular area, or type an address.')
              : (language === 'ta' ? 'துல்லியமான தூரம் மற்றும் அருகிலுள்ள உணவகங்களை வரிசைப்படுத்த உதவுகிறது.' : language === 'hi' ? 'सटीक दूरी और निकटतम रेस्तरां खोजने में मदद करता है।' : 'Helps sort nearest restaurants, accurate distance & fast delivery.')}
          </p>
        </div>

        {/* Voice Status Card with Mic Control */}
        <div className={`p-3 border rounded-2xl flex items-center justify-between text-xs font-black transition-all ${
          isSpeakingPrompt
            ? 'bg-blue-50 border-blue-300 text-blue-900 animate-pulse'
            : isListening
            ? 'bg-emerald-50 border-emerald-400 text-emerald-900 ring-2 ring-emerald-400/30'
            : isAnalyzing
            ? 'bg-amber-50 border-amber-300 text-amber-900'
            : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}>
          <div className="flex items-center space-x-2">
            {isSpeakingPrompt ? (
              <Volume2 className="w-4 h-4 text-blue-600 animate-spin" style={{ animationDuration: '3s' }} />
            ) : isListening ? (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            ) : (
              <Mic className="w-4 h-4 text-[#FF5A1F]" />
            )}
            <span>
              {isSpeakingPrompt
                ? (language === 'ta' ? '🗣️ AutoFeast பேசுகிறது...' : language === 'hi' ? '🗣️ बोल रहा है...' : '🗣️ AutoFeast Speaking...')
                : isAnalyzing
                ? '🤖 AI Understanding Location...'
                : isListening
                ? (language === 'ta' ? '🎙️ கேட்கிறது: "அனுமதி", "மாற்று" அல்லது ஓர் இடம்...' : language === 'hi' ? '🎙️ सुन रहा है: "हाँ", "बदलो" या स्थान बोलें...' : '🎙️ Listening: Say "Allow", "Change", or a place name...')
                : (language === 'ta' ? 'குரல் உள்ளீடு தயார்' : 'Voice Assistant Ready')}
            </span>
          </div>

          <button
            type="button"
            id="retry-mic-btn"
            onClick={() => {
              hasRetriedSilenceRef.current = false;
              if (modalMode === 'confirming_place' && pendingCandidatePlace) {
                startListeningForTurn('confirm_place', lastSpokenPromptRef.current);
              } else if (modalMode === 'asking_place') {
                startListeningForTurn('ask_place', lastSpokenPromptRef.current);
              } else {
                startListeningForTurn('initial', getQuestionText());
              }
            }}
            disabled={isSpeakingPrompt}
            className={`px-3 py-1.5 rounded-xl font-bold text-[11px] shadow-xs cursor-pointer flex items-center space-x-1 transition-all ${
              isSpeakingPrompt
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : isListening
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse'
                : 'bg-[#FF5A1F] hover:bg-[#E04812] text-white'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>{isListening ? t('location.listening') : t('location.retryMic')}</span>
          </button>
        </div>

        {liveTranscript && (
          <p className="text-xs text-center text-emerald-600 font-black animate-pulse">
            🎙️ "{liveTranscript}"
          </p>
        )}

        {statusMessage && (
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 font-bold text-xs">
            {statusMessage}
          </div>
        )}

        {/* 1. INITIAL MODE: ALLOW LIVE GPS vs CHANGE ADDRESS */}
        {modalMode === 'initial' && (
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="button"
              id="deny-change-location-btn"
              onClick={() => {
                SpeechController.releaseMic('location_permission');
                SpeechController.cancelSpeech();
                setModalMode('manual_picker');
              }}
              className="w-full sm:w-1/2 py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-[#4A5568] font-black rounded-2xl text-xs sm:text-sm transition-all border border-slate-300 flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <XCircle className="w-4 h-4 text-amber-600" />
              <span>{t('location.denyBtn')}</span>
            </button>

            <button
              type="button"
              id="allow-live-gps-btn"
              onClick={handleUseLiveGPS}
              className="w-full sm:w-1/2 py-3.5 px-6 bg-[#16A34A] hover:bg-[#15803D] text-white font-black rounded-2xl text-xs sm:text-sm shadow-lg shadow-[#16A34A]/30 transition-transform active:scale-95 flex items-center justify-center space-x-2 cursor-pointer ring-4 ring-[#16A34A]/20"
            >
              <CheckCircle2 className="w-5 h-5 text-white" />
              <span>{t('location.allowBtn')}</span>
            </button>
          </div>
        )}

        {/* 2. CONFIRMING PLACE MODE: Spoken or geocoded address confirmation */}
        {modalMode === 'confirming_place' && pendingCandidatePlace && (
          <div className="space-y-4 pt-1">
            <div className="p-4 bg-orange-50 rounded-2xl border-2 border-orange-400 text-left">
              <span className="text-[10px] uppercase font-black tracking-wider text-orange-600 block">Matched Address:</span>
              <p className="text-sm font-black text-slate-900 mt-0.5">{pendingCandidatePlace.addressName}</p>
              <p className="text-xs text-slate-600 font-bold">{pendingCandidatePlace.area}, {pendingCandidatePlace.city}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setPendingCandidatePlace(null);
                  setModalMode('manual_picker');
                }}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl text-xs border border-slate-300 cursor-pointer"
              >
                {language === 'ta' ? 'இல்லை (வேறு இடம்)' : language === 'hi' ? 'नहीं (दूसरा पता)' : 'No, Pick Another'}
              </button>

              <button
                type="button"
                onClick={() => {
                  const newLoc: UserLocation = {
                    latitude: pendingCandidatePlace.latitude,
                    longitude: pendingCandidatePlace.longitude,
                    addressName: pendingCandidatePlace.addressName,
                    city: pendingCandidatePlace.city,
                    area: pendingCandidatePlace.area,
                    isLiveGPS: false,
                    isApproximate: false,
                    isManualOverride: true
                  };
                  finalizeLocation(newLoc);
                }}
                className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow-md cursor-pointer flex items-center justify-center space-x-1"
              >
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>{language === 'ta' ? 'ஆம், உறுதி செய்' : language === 'hi' ? 'हाँ, पुष्टि करें' : 'Yes, Confirm'}</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. ASKING PLACE MODE: User said change address, listening for place */}
        {modalMode === 'asking_place' && (
          <div className="space-y-3 pt-1">
            <button
              type="button"
              onClick={() => setModalMode('manual_picker')}
              className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-[#4A5568] font-black rounded-xl text-xs border border-slate-300 cursor-pointer"
            >
              {language === 'ta' ? 'தட்டச்சு செய்ய அல்லது பிரபல பகுதிகளைத் தேர்ந்தெடுக்க இங்கே அழுத்தவும்' : language === 'hi' ? 'टाइप करने या क्षेत्र चुनने के लिए यहाँ टैप करें' : 'Tap here to type address or pick from list'}
            </button>
          </div>
        )}

        {/* 4. MANUAL PICKER MODE: Non-dead-ending comprehensive picker */}
        {modalMode === 'manual_picker' && (
          <div className="space-y-4 pt-1 text-left">
            
            {/* Live GPS Re-check Button */}
            <button
              type="button"
              onClick={handleUseLiveGPS}
              className="w-full p-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black rounded-xl shadow hover:from-emerald-700 hover:to-teal-700 flex items-center justify-center space-x-2 text-xs cursor-pointer"
            >
              <Navigation className="w-4 h-4 text-yellow-300 animate-spin" style={{ animationDuration: '6s' }} />
              <span>{t('location.useLiveGPS')}</span>
            </button>

            {/* Address Search Form */}
            <form onSubmit={handleManualSearchSubmit} className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={customSearchQuery}
                    onChange={e => setCustomSearchQuery(e.target.value)}
                    placeholder={t('location.manualSearchPlaceholder')}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs font-black bg-slate-50 text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearchingGeocode}
                  className="px-4 py-2.5 bg-[#FF5A1F] hover:bg-[#E04812] text-white font-black text-xs rounded-xl shadow cursor-pointer shrink-0"
                >
                  {isSearchingGeocode ? '...' : <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </form>

            {/* Search Results if any */}
            {searchResults.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                <span className="text-[10px] font-black uppercase text-slate-500">Search Results:</span>
                {searchResults.map((res, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const newLoc: UserLocation = {
                        latitude: res.latitude,
                        longitude: res.longitude,
                        addressName: res.addressName,
                        city: res.city,
                        area: res.area,
                        isLiveGPS: false,
                        isApproximate: false,
                        isManualOverride: true
                      };
                      finalizeLocation(newLoc);
                    }}
                    className="w-full p-2 bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-400 rounded-lg text-left text-xs font-bold transition-colors cursor-pointer"
                  >
                    <p className="font-black text-slate-900 truncate">{res.addressName}</p>
                    <p className="text-[10px] text-slate-500">{res.area}, {res.city}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Popular Area Chips */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                {t('location.popularAreas')}
              </span>
              <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
                {popularCities.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className="p-2 rounded-lg border border-slate-200 hover:border-orange-400 bg-slate-50 hover:bg-orange-50/50 text-left text-xs transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <span className="block font-black text-slate-800">{p.area}</span>
                      <span className="text-[10px] text-slate-500">{p.city}</span>
                    </div>
                    <Building2 className="w-3 h-3 text-orange-500 opacity-70" />
                  </button>
                ))}
              </div>
            </div>

            {/* Explicit Skip with "Location not set" clearly shown */}
            <div className="pt-2 border-t border-slate-200 text-center">
              <button
                type="button"
                id="skip-location-not-set-btn"
                onClick={handleExplicitSkip}
                className="text-xs font-black text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                {t('location.skipWithoutLocation')}
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
