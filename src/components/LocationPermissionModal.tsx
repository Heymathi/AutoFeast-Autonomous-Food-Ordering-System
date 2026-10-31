import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { SpeechController } from '../services/speechController';
import { LlmNluService } from '../services/llmNluService';
import { forwardGeocode, GeocodedPlace, formatLocationSetToast, reverseGeocode } from '../services/locationService';
import { UserLocation } from '../types';
import { MapPin, Navigation, CheckCircle2, XCircle, Mic, Volume2, Sparkles, Search, Building2, AlertTriangle, ArrowRight } from 'lucide-react';

// ---------------------------------------------------------------------------
// Local fast keyword classifier for the "initial" turn.
// Runs synchronously; avoids any network call for simple yes/no/change answers.
// Priority: CHANGE is checked before ALLOW to prevent "no, change address"
// being mis-read as an affirmative.
// ---------------------------------------------------------------------------
function classifyInitialTranscript(
  raw: string,
  language: string
): 'allow' | 'change' | 'none' {
  const t = raw.toLowerCase().replace(/[.,!?।।""]/g, ' ').replace(/\s+/g, ' ').trim();

  // ── CHANGE / DENY intent ────────────────────────────────────────────────
  const changeKw = [
    // English
    'no', 'nope', 'nah', 'change', 'address', 'different', 'manual', 'enter', 'set address',
    'change address', 'set location', 'different address', 'another address',
    // Tamil
    'இல்லை', 'வேண்டாம்', 'வேணாம்', 'இல்ல', 'இல்லட்டும்', 'illai', 'illam', 'illa',
    'venaam', 'vendam', 'maathu', 'mukavari', 'address maathu', 'vera idam', 'வேற முகவரி',
    'முகவரி மாற்று', 'அட்ரஸ் மாத்து',
    // Hindi
    'nahi', 'nahin', 'na', 'mat', 'nhin', 'नहीं', 'ना', 'मत', 'नही',
    'badlo', 'address badlo', 'address change', 'dusra', 'बदलो', 'पता बदलो',
    'दूसरा', 'दूसरा पता',
  ];

  // ── ALLOW / YES intent ──────────────────────────────────────────────────
  const allowKw = [
    // English
    'yes', 'yeah', 'yep', 'yup', 'ok', 'okay', 'sure', 'allow', 'fine', 'go ahead',
    'use my location', 'use live location', 'live location', 'current location',
    'allow location', 'enable location', 'why not', 'of course',
    // Tamil
    'ஆமா', 'ஆமாம்', 'சரி', 'சரிதான்', 'அனுமதி', 'aama', 'aamam', 'sari', 'seri', 'anumathi',
    'ok pannu', 'eduthuko', 'இப்போதைய இடம்', 'லைவ் லொகேஷன்',
    // Hindi
    'haan', 'ha', 'haa', 'han', 'हाँ', 'हां', 'ठीक है', 'theek hai', 'theek',
    'abhi ki location', 'live location', 'use karo', 'allow karo',
    'अनुमति', 'location do',
  ];

  // Check CHANGE first (higher precedence)
  if (changeKw.some(kw => t.includes(kw))) return 'change';
  if (allowKw.some(kw => t.includes(kw))) return 'allow';
  return 'none';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
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

  // ── Sub-states ────────────────────────────────────────────────────────────
  const [modalMode, setModalMode] = useState<
    'initial' | 'asking_place' | 'confirming_place' | 'manual_picker'
  >('initial');
  const [isSpeakingPrompt, setIsSpeakingPrompt] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingCandidatePlace, setPendingCandidatePlace] = useState<GeocodedPlace | null>(null);
  const [customSearchQuery, setCustomSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodedPlace[]>([]);
  const [isSearchingGeocode, setIsSearchingGeocode] = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const isActiveRef = useRef(true);
  const hasHandledRef = useRef(false);          // double-trigger guard
  const lastPromptRef = useRef<string>('');
  const hasRetriedSilenceRef = useRef(false);

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

  // ── Finalize (proceed to dashboard) ──────────────────────────────────────
  const finalizeLocation = useCallback((newLoc: UserLocation) => {
    SpeechController.releaseMic('location_permission');
    SpeechController.cancelSpeech();
    setManualUserLocation(newLoc);
    if (newLoc.city && newLoc.city !== 'Not set') setSelectedLocation(newLoc.city);
    const toastMsg = newLoc.city === 'Not set'
      ? t('location.notSet')
      : formatLocationSetToast(newLoc, t, language);
    showToast(toastMsg);
    setEntryStep('dashboard');
  }, [setManualUserLocation, setSelectedLocation, t, showToast, setEntryStep, language]);

  // ── HANDLE ALLOW (live GPS) ───────────────────────────────────────────────
  // This is the single shared handler for the button AND voice intent.
  const handleAllowLocation = useCallback(async () => {
    if (hasHandledRef.current) return;         // double-trigger guard
    hasHandledRef.current = true;

    // Stop TTS + mic immediately
    SpeechController.cancelSpeech();
    SpeechController.releaseMic('location_permission');
    setIsSpeakingPrompt(false);
    setIsListening(false);
    setIsAnalyzing(true);
    setStatusMessage(
      language === 'ta'
        ? '📍 GPS கண்டறிகிறது...'
        : language === 'hi'
        ? '📍 GPS खोज रहा है...'
        : '📍 Detecting GPS location...'
    );

    // Check geolocation permission first (fast path if already granted)
    let geoPermission: PermissionState | null = null;
    try {
      const perm = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      geoPermission = perm.state;
    } catch (_) { /* not supported in all browsers */ }

    if (geoPermission === 'denied') {
      const msg =
        language === 'ta'
          ? "⚠️ GPS அனுமதி மறுக்கப்பட்டது. தயவுசெய்து உங்கள் இடத்தை கைமுறையாக அமைக்கவும்."
          : language === 'hi'
          ? "⚠️ GPS अनुमति अस्वीकृत। कृपया मैन्युअल रूप से पता सेट करें।"
          : "⚠️ GPS access denied. Please set your address manually.";
      setIsAnalyzing(false);
      setStatusMessage(msg);
      showToast(msg, 'warning');
      setModalMode('manual_picker');
      hasHandledRef.current = false;   // allow retry via button
      return;
    }

    if (!('geolocation' in navigator)) {
      const msg =
        language === 'ta'
          ? "⚠️ இந்த சாதனம் GPS ஐ ஆதரிக்கவில்லை."
          : language === 'hi'
          ? "⚠️ इस डिवाइस में GPS समर्थित नहीं है।"
          : "⚠️ GPS not supported on this device.";
      setIsAnalyzing(false);
      setStatusMessage(msg);
      setModalMode('manual_picker');
      hasHandledRef.current = false;
      return;
    }

    // Request GPS position and resolve geocoding before displaying location toast
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (!isActiveRef.current) return;
        const { latitude, longitude, accuracy } = position.coords;

        let geocoded: { addressName: string; city: string; area: string } | null = null;
        try {
          geocoded = await reverseGeocode(latitude, longitude);
        } catch (err) {
          console.warn('[LocationPermissionModal] reverseGeocode error:', err);
        }

        const isLowAccuracy = accuracy > 1000;
        const resolvedLoc: UserLocation = {
          latitude,
          longitude,
          addressName: geocoded?.addressName || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          city: geocoded?.city || '',
          area: geocoded?.area || '',
          isLiveGPS: !isLowAccuracy,
          isApproximate: isLowAccuracy,
          accuracyMeters: accuracy,
          isManualOverride: false,
        };

        setIsAnalyzing(false);
        finalizeLocation(resolvedLoc);
      },
      async (error) => {
        if (!isActiveRef.current) return;
        const msg =
          language === 'ta'
            ? `⚠️ GPS தோல்வி: ${error.message}. கைமுறையாக இடத்தை அமைக்கவும்.`
            : language === 'hi'
            ? `⚠️ GPS विफल: ${error.message}. कृपया स्थान मैन्युअल रूप से सेट करें।`
            : `⚠️ Couldn't get live location — please set your address. (${error.message})`;
        setIsAnalyzing(false);
        setStatusMessage(msg);
        showToast(msg, 'warning');
        setModalMode('manual_picker');
        hasHandledRef.current = false;
      },
      {
        enableHighAccuracy: false,   // fast cached fix
        timeout: 8000,
        maximumAge: 300000,          // accept 5-min old cached position
      }
    );
  }, [language, finalizeLocation, showToast, setManualUserLocation, setSelectedLocation]);

  // ── HANDLE CHANGE (open address input) ───────────────────────────────────
  const handleChangeAddress = useCallback(() => {
    if (hasHandledRef.current) return;
    hasHandledRef.current = true;

    SpeechController.cancelSpeech();
    SpeechController.releaseMic('location_permission');
    setIsSpeakingPrompt(false);
    setIsListening(false);
    setModalMode('manual_picker');
  }, []);

  // ── Start STT for the initial turn ───────────────────────────────────────
  const startInitialListening = useCallback(() => {
    if (!SpeechController.isSupported()) return;
    if (!isActiveRef.current) return;

    setIsListening(true);
    setLiveTranscript('');
    hasHandledRef.current = false;

    SpeechController.requestMic({
      owner: 'location_permission',
      language,
      continuous: false,
      interimResults: true,
      maxAlternatives: 5,
      silenceTimeoutMs: 8000,

      onStart: () => {
        if (isActiveRef.current) setIsListening(true);
      },

      onResult: (transcript, isFinal, nBest) => {
        if (!transcript || !isActiveRef.current) return;
        setLiveTranscript(transcript);

        // Cancel TTS the moment we hear anything
        SpeechController.cancelSpeech();
        setIsSpeakingPrompt(false);

        // Match on INTERIM results too — fire intent as soon as keyword is heard
        const intent = classifyInitialTranscript(transcript, language);
        if (intent === 'change') {
          setIsListening(false);
          SpeechController.releaseMic('location_permission');
          handleChangeAddress();
          return;
        }
        if (intent === 'allow') {
          setIsListening(false);
          SpeechController.releaseMic('location_permission');
          handleAllowLocation();
          return;
        }

        // On final result, if still unclear — try LLM (async, no block)
        if (isFinal) {
          setIsListening(false);
          SpeechController.releaseMic('location_permission');
          setIsAnalyzing(true);
          const candidates = (nBest && nBest.length > 0) ? nBest : [transcript];
          LlmNluService.interpretLocationChoice(transcript, {
            language,
            alternatives: candidates,
            step: 'location_choice',
          }).then(nlu => {
            if (!isActiveRef.current) return;
            setIsAnalyzing(false);
            if (nlu.intent === 'use_live_location') {
              handleAllowLocation();
            } else if (nlu.intent === 'change_location' || nlu.intent === 'give_address') {
              if (nlu.intent === 'give_address' && nlu.address) {
                processAddressCandidate(nlu.address);
              } else {
                handleChangeAddress();
              }
            } else {
              // Unclear — restart listening quietly without re-reading the full prompt
              if (!hasRetriedSilenceRef.current) {
                hasRetriedSilenceRef.current = true;
                startInitialListening();
              }
            }
          }).catch(() => {
            if (isActiveRef.current) setIsAnalyzing(false);
          });
        }
      },

      onSilence: () => {
        if (!isActiveRef.current) return;
        setIsListening(false);
        SpeechController.releaseMic('location_permission');
        if (!hasRetriedSilenceRef.current) {
          hasRetriedSilenceRef.current = true;
          // Speak a shorter retry hint, then re-listen
          const hint =
            language === 'ta'
              ? 'அனுமதியா அல்லது மாற்றவா?'
              : language === 'hi'
              ? 'अनुमति दें या पता बदलें?'
              : 'Allow location or change address?';
          setIsSpeakingPrompt(true);
          speakText(hint, () => {
            setIsSpeakingPrompt(false);
            if (isActiveRef.current) startInitialListening();
          }, language);
        }
      },

      onError: (errCode) => {
        if (!isActiveRef.current) return;
        setIsListening(false);
        if (errCode === 'not-allowed' || errCode === 'permission-denied') {
          setStatusMessage(
            language === 'ta'
              ? 'மைக் அணுகல் தடுக்கப்பட்டுள்ளது.'
              : language === 'hi'
              ? 'माइक्रोफ़ोन अवरुद्ध है।'
              : 'Microphone access blocked. Use the buttons below.'
          );
        }
      },

      onEnd: () => {
        if (isActiveRef.current) setIsListening(false);
      },
    });
  }, [language, speakText, handleAllowLocation, handleChangeAddress]);

  // ── Address geocoding helpers (for manual / ask_place modes) ─────────────
  const processAddressCandidate = useCallback(async (placeName: string) => {
    if (!placeName.trim()) { setModalMode('manual_picker'); return; }
    setIsAnalyzing(true);
    setStatusMessage(t('location.searchingNominatim'));
    const matches = await forwardGeocode(placeName);
    setIsAnalyzing(false);
    if (matches && matches.length > 0) {
      const best = matches[0];
      setPendingCandidatePlace(best);
      setModalMode('confirming_place');
      const confirmPrompt = t('location.confirmLocation').replace('{place}', best.addressName);
      lastPromptRef.current = confirmPrompt;
      setIsSpeakingPrompt(true);
      speakText(confirmPrompt, () => {
        setIsSpeakingPrompt(false);
        if (isActiveRef.current) startListeningForTurn('confirm_place', confirmPrompt);
      }, language);
    } else {
      const noMatchMsg = t('location.noMatchFound');
      setStatusMessage(noMatchMsg);
      speakText(noMatchMsg, () => { setModalMode('manual_picker'); }, language);
    }
  }, [t, speakText, language]);

  const startListeningForTurn = useCallback((turnType: 'ask_place' | 'confirm_place', promptQuestion: string) => {
    if (!SpeechController.isSupported() || !isActiveRef.current) return;
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
      onStart: () => { if (isActiveRef.current) setIsListening(true); },
      onResult: async (transcript, isFinal, nBest) => {
        if (!transcript || !isActiveRef.current) return;
        setLiveTranscript(transcript);
        SpeechController.cancelSpeech();
        setIsSpeakingPrompt(false);
        if (!isFinal) return;

        setIsListening(false);
        SpeechController.releaseMic('location_permission');
        setIsAnalyzing(true);
        const candidates = (nBest && nBest.length > 0) ? nBest : [transcript];

        if (turnType === 'confirm_place') {
          const { SttMatcherService } = await import('../services/sttMatcherService');
          const confirmMatch = SttMatcherService.matchConfirmation(candidates, language);
          setIsAnalyzing(false);
          if (confirmMatch.isMatched && confirmMatch.matchedValue === 'YES' && pendingCandidatePlace) {
            finalizeLocation({
              latitude: pendingCandidatePlace.latitude,
              longitude: pendingCandidatePlace.longitude,
              addressName: pendingCandidatePlace.addressName,
              city: pendingCandidatePlace.city,
              area: pendingCandidatePlace.area,
              isLiveGPS: false,
              isApproximate: false,
              isManualOverride: true,
            });
          } else if (confirmMatch.isMatched && confirmMatch.matchedValue === 'NO') {
            setPendingCandidatePlace(null);
            setModalMode('manual_picker');
          } else {
            setModalMode('manual_picker');
          }
        } else {
          // ask_place
          setIsAnalyzing(false);
          await processAddressCandidate(transcript);
        }
      },
      onSilence: () => {
        if (isActiveRef.current) { setIsListening(false); setModalMode('manual_picker'); }
      },
      onError: () => { if (isActiveRef.current) setIsListening(false); },
      onEnd: () => { if (isActiveRef.current) setIsListening(false); },
    });
  }, [language, pendingCandidatePlace, finalizeLocation, processAddressCandidate]);

  // ── Bootstrap when modal opens ────────────────────────────────────────────
  useEffect(() => {
    if (entryStep !== 'location_permission') return;

    isActiveRef.current = true;
    hasHandledRef.current = false;
    hasRetriedSilenceRef.current = false;
    setModalMode('initial');
    setStatusMessage(null);
    setLiveTranscript('');

    // Speak a SHORT one-sentence prompt, but start recognition immediately
    // (don't wait for TTS to finish — recognition is warmed up in parallel)
    const question = getQuestionText();
    lastPromptRef.current = question;
    setIsSpeakingPrompt(true);

    speakText(question, () => {
      setIsSpeakingPrompt(false);
    }, language);

    // Start listening right away without waiting for TTS
    setTimeout(() => {
      if (isActiveRef.current && entryStep === 'location_permission') {
        startInitialListening();
      }
    }, 0);

    return () => {
      isActiveRef.current = false;
      SpeechController.releaseMic('location_permission');
      SpeechController.cancelSpeech();
    };
    // Only re-run on step or language change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryStep, language]);

  // ── Manual search ─────────────────────────────────────────────────────────
  const handleManualSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSearchQuery.trim()) return;
    setIsSearchingGeocode(true);
    setStatusMessage(t('location.searchingNominatim'));
    const matches = await forwardGeocode(customSearchQuery);
    setIsSearchingGeocode(false);
    setSearchResults(matches);
    setStatusMessage(matches.length === 0 ? t('location.noMatchFound') : null);
  };

  const handleSelectPreset = (p: typeof popularCities[0]) => {
    finalizeLocation({
      latitude: p.lat,
      longitude: p.lng,
      addressName: `${p.area}, ${p.city}`,
      city: p.city,
      area: p.area,
      isLiveGPS: false,
      isApproximate: false,
      isManualOverride: true,
    });
  };

  const handleExplicitSkip = () => {
    finalizeLocation({
      latitude: 13.0827,
      longitude: 80.2707,
      addressName: 'Location not set',
      city: 'Not set',
      area: 'Location not set',
      isLiveGPS: false,
      isApproximate: true,
      isManualOverride: false,
    });
  };

  if (entryStep !== 'location_permission') return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-white text-[#302720] rounded-3xl p-6 sm:p-8 shadow-2xl border-4 border-[#8B1E2D] text-center space-y-5">

        {/* Header Icon */}
        <div className="inline-flex p-4 bg-[#F1DEDC] rounded-full border-2 border-[#E7D9D6] text-[#8B1E2D]">
          <MapPin className="w-9 h-9 animate-bounce text-[#8B1E2D]" />
        </div>

        {/* Step Badge */}
        <div>
          <span className="text-xs font-black uppercase tracking-widest text-[#8B1E2D] bg-[#8B1E2D]/10 px-3 py-1 rounded-full border border-[#8B1E2D]/30">
            {language === 'ta' ? 'படி 4: இருப்பிட அனுமதி' : language === 'hi' ? 'चरण 4: स्थान अनुमति' : 'Step 4: Location Choice'}
          </span>
        </div>

        {/* Dynamic Header Question */}
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-[#302720]">
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
              <Mic className="w-4 h-4 text-[#8B1E2D]" />
            )}
            <span>
              {isSpeakingPrompt
                ? (language === 'ta' ? '🗣️ AutoFeast பேசுகிறது...' : language === 'hi' ? '🗣️ बोल रहा है...' : '🗣️ AutoFeast Speaking...')
                : isAnalyzing
                ? '🤖 Understanding...'
                : isListening
                ? (language === 'ta' ? '🎙️ கேட்கிறது: "அனுமதி" அல்லது "மாற்று"...' : language === 'hi' ? '🎙️ सुन रहा है: "हाँ" या "बदलो"...' : '🎙️ Listening: say "Allow" or "Change"...')
                : (language === 'ta' ? 'குரல் உள்ளீடு தயார்' : language === 'hi' ? 'आवाज़ सहायक तैयार' : 'Voice Assistant Ready')}
            </span>
          </div>

          {/* Retry Mic — enabled whenever not actively listening */}
          <button
            type="button"
            id="retry-mic-btn"
            onClick={() => {
              hasRetriedSilenceRef.current = false;
              SpeechController.cancelSpeech();
              SpeechController.releaseMic('location_permission');
              setIsSpeakingPrompt(false);
              if (modalMode === 'confirming_place' && pendingCandidatePlace) {
                startListeningForTurn('confirm_place', lastPromptRef.current);
              } else if (modalMode === 'asking_place') {
                startListeningForTurn('ask_place', lastPromptRef.current);
              } else {
                startInitialListening();
              }
            }}
            disabled={isListening}
            className={`px-3 py-1.5 rounded-xl font-bold text-[11px] shadow-xs cursor-pointer flex items-center space-x-1 transition-all ${
              isListening
                ? 'bg-emerald-600 text-white animate-pulse cursor-not-allowed'
                : 'bg-[#8B1E2D] hover:bg-[#302720] text-white'
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
              onClick={handleChangeAddress}
              className="w-full sm:w-1/2 py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-[#4A5568] font-black rounded-2xl text-xs sm:text-sm transition-all border border-slate-300 flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <XCircle className="w-4 h-4 text-amber-600" />
              <span>{t('location.denyBtn')}</span>
            </button>

            <button
              type="button"
              id="allow-live-gps-btn"
              onClick={handleAllowLocation}
              className="w-full sm:w-1/2 py-3.5 px-6 bg-[#16A34A] hover:bg-[#15803D] text-white font-black rounded-2xl text-xs sm:text-sm shadow-lg shadow-[#16A34A]/30 transition-transform active:scale-95 flex items-center justify-center space-x-2 cursor-pointer ring-4 ring-[#16A34A]/20"
            >
              <CheckCircle2 className="w-5 h-5 text-white" />
              <span>{t('location.allowBtn')}</span>
            </button>
          </div>
        )}

        {/* 2. CONFIRMING PLACE MODE */}
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
                onClick={() => { setPendingCandidatePlace(null); setModalMode('manual_picker'); }}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl text-xs border border-slate-300 cursor-pointer"
              >
                {language === 'ta' ? 'இல்லை (வேறு இடம்)' : language === 'hi' ? 'नहीं (दूसरा पता)' : 'No, Pick Another'}
              </button>
              <button
                type="button"
                onClick={() => {
                  finalizeLocation({
                    latitude: pendingCandidatePlace.latitude,
                    longitude: pendingCandidatePlace.longitude,
                    addressName: pendingCandidatePlace.addressName,
                    city: pendingCandidatePlace.city,
                    area: pendingCandidatePlace.area,
                    isLiveGPS: false,
                    isApproximate: false,
                    isManualOverride: true,
                  });
                }}
                className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow-md cursor-pointer flex items-center justify-center space-x-1"
              >
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>{language === 'ta' ? 'ஆம், உறுதி செய்' : language === 'hi' ? 'हाँ, पुष्टि करें' : 'Yes, Confirm'}</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. ASKING PLACE MODE */}
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

        {/* 4. MANUAL PICKER MODE */}
        {modalMode === 'manual_picker' && (
          <div className="space-y-4 pt-1 text-left">

            {/* Live GPS Re-check Button */}
            <button
              type="button"
              onClick={handleAllowLocation}
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
                  className="px-4 py-2.5 bg-[#8B1E2D] hover:bg-[#302720] text-white font-black text-xs rounded-xl shadow cursor-pointer shrink-0"
                >
                  {isSearchingGeocode ? '...' : <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </form>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                <span className="text-[10px] font-black uppercase text-slate-500">Search Results:</span>
                {searchResults.map((res, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      finalizeLocation({
                        latitude: res.latitude,
                        longitude: res.longitude,
                        addressName: res.addressName,
                        city: res.city,
                        area: res.area,
                        isLiveGPS: false,
                        isApproximate: false,
                        isManualOverride: true,
                      });
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

            {/* Skip */}
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
