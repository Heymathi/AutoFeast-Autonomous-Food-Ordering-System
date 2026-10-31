import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Sparkles, Heart, ArrowRight, Mic, AlertCircle } from 'lucide-react';
import { Language } from '../types';
import { SpeechController } from '../services/speechController';

/**
 * Waits for speechSynthesis voices to load (with a 1.5s timeout).
 */
export function waitForVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve([]);
      return;
    }
    const current = window.speechSynthesis.getVoices();
    if (current && current.length > 0) {
      console.log('[Welcome] voices loaded:', current.length, 'available immediately');
      resolve(current);
      return;
    }

    let isResolved = false;
    const timer = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        console.warn('[Welcome] voices loaded: timed out after 1.5s waiting for voiceschanged');
        resolve(window.speechSynthesis.getVoices() || []);
      }
    }, timeoutMs);

    const onVoicesChanged = () => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        const v = window.speechSynthesis.getVoices();
        console.log('[Welcome] voices loaded: voiceschanged fired with', v.length, 'voices');
        resolve(v);
      }
    };

    if (typeof window.speechSynthesis.addEventListener === 'function') {
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged, { once: true });
    } else {
      window.speechSynthesis.onvoiceschanged = onVoicesChanged;
    }
  });
}

/**
 * Voice Picker Per Language:
 * 1) Microsoft Online/Natural or Google high quality voice
 * 2) Exact locale match (ta-IN, hi-IN, en-IN)
 * 3) Same language-family voice by name
 * 4) Fall back to any voice with the same 2-letter prefix
 */
export function pickBestVoice(voices: SpeechSynthesisVoice[], lang: Language): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  const targetLocale = lang === 'ta' ? 'ta-in' : lang === 'hi' ? 'hi-in' : 'en-in';
  const langShort = lang.toLowerCase();
  const normalize = (s: string) => (s || '').toLowerCase().replace(/_/g, '-');

  // Tier 1: Microsoft Online / Natural or Google voice matching lang code or name
  const natural = voices.find(v => {
    const vl = normalize(v.lang);
    const vn = normalize(v.name);
    const match = vl.startsWith(langShort) ||
      (lang === 'ta' && (vn.includes('tamil') || vn.includes('தமிழ்'))) ||
      (lang === 'hi' && (vn.includes('hindi') || vn.includes('हिन्दी')));
    return match && (vn.includes('online') || vn.includes('natural') || vn.includes('google'));
  });
  if (natural) return natural;

  // Tier 2: Exact locale match (ta-IN, hi-IN, en-IN)
  const exact = voices.find(v => normalize(v.lang) === targetLocale);
  if (exact) return exact;

  // Tier 3: Same language-family voice by name
  const family = voices.find(v => {
    const vn = normalize(v.name);
    return (lang === 'ta' && (vn.includes('tamil') || vn.includes('தமிழ்'))) ||
      (lang === 'hi' && (vn.includes('hindi') || vn.includes('हिन्दी') || vn.includes('hindustani'))) ||
      (lang === 'en' && (vn.includes('english') || vn.includes('india')));
  });
  if (family) return family;

  // Tier 4: Fall back to any voice with the same 2-letter prefix (ta, hi, en)
  const prefixMatch = voices.find(v => normalize(v.lang).startsWith(langShort));
  if (prefixMatch) return prefixMatch;

  return null;
}

export const WelcomeMessageModal: React.FC = () => {
  const {
    entryStep,
    language,
    currentUser,
    handleWelcomeComplete,
    t
  } = useApp();

  const [sttHint, setSttHint] = useState<string | null>(null);

  // Single-execution guard: prevents auto-continue and manual button click from firing twice
  const handledRef = useRef(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSpokenKeyRef = useRef<string | null>(null);

  // Derive the active language synchronously from localStorage if available to prevent stale "en"
  const rawStoredLang = typeof window !== 'undefined' ? localStorage.getItem('autofeast_language_preference') : null;
  const activeLang: Language = (rawStoredLang as Language) || language || 'en';
  const userName = currentUser?.name || 'Friend';

  const clearAllTimers = () => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
  };

  // Shared proceed handler (called either on TTS onend, 4s fallback, user button click, or voice proceed)
  const proceed = useCallback(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    console.log('[Welcome] auto-continue fired: navigating to location step');

    clearAllTimers();

    // Call speechSynthesis.cancel() when leaving the step
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }

    // Release STT mic lock
    SpeechController.releaseMic('welcome_modal');

    // Go straight into website / location step
    handleWelcomeComplete();
  }, [handleWelcomeComplete]);

  const proceedRef = useRef(proceed);
  proceedRef.current = proceed;
  const tRef = useRef(t);
  tRef.current = t;

  // Cleanup: cancel speech ONLY when leaving the welcome step or unmounting
  useEffect(() => {
    if (entryStep !== 'welcome') {
      lastSpokenKeyRef.current = null;
      handledRef.current = false;
      clearAllTimers();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try { window.speechSynthesis.cancel(); } catch (_) {}
      }
      SpeechController.releaseMic('welcome_modal');
    }
  }, [entryStep]);

  useEffect(() => {
    return () => {
      clearAllTimers();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try { window.speechSynthesis.cancel(); } catch (_) {}
      }
      SpeechController.releaseMic('welcome_modal');
    };
  }, []);

  // STT Listener: list for "proceed", "continue", "சரி", "ஆம்", "आगे बढ़ें", "हाँ"
  useEffect(() => {
    if (entryStep !== 'welcome') return;
    if (!SpeechController.isSupported()) return;

    const targetLocale = activeLang === 'ta' ? 'ta-IN' : activeLang === 'hi' ? 'hi-IN' : 'en-IN';

    SpeechController.requestMic({
      owner: 'welcome_modal',
      language: activeLang,
      overrideLocale: targetLocale,
      continuous: false,
      interimResults: true,
      maxAlternatives: 5,
      allowDuringTts: true,
      onResult: (transcript) => {
        if (!transcript) return;
        const clean = transcript.toLowerCase().trim();
        const isProceed =
          clean.includes('proceed') || clean.includes('continue') || clean.includes('yes') || clean.includes('ok') || clean.includes('next') ||
          clean.includes('தொடர') || clean.includes('சரி') || clean.includes('ஆமா') || clean.includes('ஆம்') ||
          clean.includes('आगे') || clean.includes('हाँ') || clean.includes('ठीक');

        if (isProceed) {
          console.log('[Welcome STT]: User confirmed proceed via voice:', clean);
          proceedRef.current();
        }
      },
      onError: (errCode) => {
        console.warn('[Welcome STT onError]:', errCode);
        if (errCode === 'not-allowed' || errCode === 'permission-denied') {
          setSttHint(tRef.current('welcome.micDenied') || (activeLang === 'ta' ? 'மைக் அணுகல் மறுக்கப்பட்டது' : activeLang === 'hi' ? 'माइक्रोफ़ोन अनुमति अस्वीकृत' : 'Microphone permission denied'));
        } else if (errCode === 'language-not-supported') {
          setSttHint(tRef.current('welcome.langUnsupported') || (activeLang === 'ta' ? 'இந்த மொழிக்கு குரல் அறிதல் ஆதரிக்கப்படவில்லை' : activeLang === 'hi' ? 'इस भाषा के लिए आवाज पहचान समर्थित नहीं है' : 'Speech recognition not supported for this language'));
        }
      }
    });

    return () => {
      SpeechController.releaseMic('welcome_modal');
    };
  }, [entryStep, activeLang]);

  // TTS playback & 4s Auto-continue Effect
  useEffect(() => {
    if (entryStep !== 'welcome') return;

    const currentKey = `${userName}|${activeLang}`;
    if (lastSpokenKeyRef.current === currentKey) {
      // Already started or completed speaking for this user & language
      return;
    }

    // Set key BEFORE starting wait/speech to prevent re-entrant or duplicate triggers
    lastSpokenKeyRef.current = currentKey;
    handledRef.current = false;
    clearAllTimers();

    const greetingTemplate = tRef.current('welcome.greeting') || (
      activeLang === 'ta'
        ? 'AutoFeast-க்கு வரவேற்கிறோம், {name}! உங்கள் சுவையான உணவை ஆர்டர் செய்ய அல்லது அட்டவணைப்படுத்தத் தயார்.'
        : activeLang === 'hi'
        ? 'AutoFeast में आपका स्वागत है, {name}! अपना पसंदीदा भोजन ऑर्डर या शेड्यूल करें।'
        : 'Welcome to AutoFeast, {name}! Ready to order or schedule your favorite meal.'
    );
    const welcomeMsg = greetingTemplate.replace('{name}', userName);

    console.log(`[Welcome]: Active step=welcome | lang=${activeLang} | text="${welcomeMsg}"`);

    // 4-second safety fallback: if TTS is unavailable, blocked by autoplay, or errors out
    fallbackTimerRef.current = setTimeout(() => {
      console.warn('[Welcome]: Fallback timer (~4s) reached. Auto-continuing to location.');
      proceedRef.current();
    }, 4000);

    // Cancel any previous residual speech before starting new speech
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (_) {}
    }

    // Wait for speechSynthesis voices to load (1.5s max)
    waitForVoices(1500).then((voices) => {
      if (handledRef.current || lastSpokenKeyRef.current !== currentKey) return;

      if (typeof window === 'undefined' || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
        console.warn('[Welcome TTS]: SpeechSynthesis not supported in browser environment. Relying on auto-continue timer.');
        return;
      }

      const voice = pickBestVoice(voices, activeLang);
      const targetLocale = activeLang === 'ta' ? 'ta-IN' : activeLang === 'hi' ? 'hi-IN' : 'en-IN';
      console.log(`[Welcome] voice chosen: lang=${activeLang} | voice="${voice?.name || 'native-browser-default'}" | locale=${targetLocale}`);

      const utterance = new SpeechSynthesisUtterance(welcomeMsg);
      utterance.lang = targetLocale;
      utterance.rate = 0.95;
      if (voice) {
        utterance.voice = voice;
      }

      // Utterance Watchdog: in case browser drops onend event
      const watchdogMs = Math.max(3500, welcomeMsg.length * 75 + 1500);
      watchdogTimerRef.current = setTimeout(() => {
        console.warn(`[Welcome TTS]: Watchdog fired after ${watchdogMs}ms without onend.`);
        proceedRef.current();
      }, watchdogMs);

      utterance.onstart = () => {
        console.log('[Welcome] speech started:', welcomeMsg.substring(0, 40));
      };

      utterance.onend = () => {
        console.log('[Welcome] onend: Welcome TTS completed successfully. Auto-continuing...');
        // Auto-continue when welcome TTS finishes
        proceedRef.current();
      };

      utterance.onerror = (evt: any) => {
        const error = evt?.error || 'unknown';
        console.warn(`[Welcome TTS]: Utterance onerror (${error}). Continuing flow.`);
        if (error !== 'canceled' && error !== 'interrupted') {
          proceedRef.current();
        }
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch (err: any) {
        console.warn('[Welcome TTS]: Exception on window.speechSynthesis.speak:', err);
        proceedRef.current();
      }
    });

    // NOTE: Effect cleanup intentionally does NOT cancel speech for the same key.
    // Speech is only cancelled when unmounting or transitioning to another step.
  }, [entryStep, activeLang, userName]);

  if (entryStep !== 'welcome') return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-white text-[#302720] rounded-3xl p-6 sm:p-8 shadow-2xl border-4 border-[#B85C38] text-center space-y-6 transform scale-100">
        
        {/* Celebration Icon Header */}
        <div className="inline-flex p-4 bg-[#B85C38]/10 rounded-full border-2 border-[#B85C38] text-[#B85C38]">
          <Sparkles className="w-10 h-10 animate-bounce" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-black uppercase tracking-widest text-[#B85C38] bg-[#B85C38]/10 px-3 py-1 rounded-full border border-[#B85C38]/30">
            {t('welcome.badge') || (activeLang === 'ta' ? 'வரவேற்புச் செய்தி' : activeLang === 'hi' ? 'स्वागत संदेश' : 'Welcome to AutoFeast')}
          </span>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[#302720]">
            {(t('welcome.title') || 'Welcome to AutoFeast, {name}! 🎉').replace('{name}', userName)}
          </h2>

          <p className="text-sm font-extrabold text-[#4A5568] leading-relaxed max-w-md mx-auto">
            {t('welcome.subtitle') || (activeLang === 'ta'
              ? 'உங்கள் குரல் வழி உணவு ஆர்டர் மற்றும் அட்டவணை அமைப்பு தயாராக உள்ளது!'
              : activeLang === 'hi'
              ? 'आपकी आवाज से भोजन ऑर्डर और शेड्यूल प्रणाली तैयार है!'
              : 'Your accessibility-first smart food ordering & auto-scheduling system is ready!')}
          </p>
        </div>

        <div className="p-4 bg-[#F3EDE4]/40 rounded-2xl border border-[#E5DDD2] flex items-center justify-center space-x-2 text-xs font-black text-[#302720]">
          <Heart className="w-4 h-4 text-[#B85C38] fill-[#B85C38] animate-pulse" />
          <span>
            {t('welcome.langSet') || (activeLang === 'ta'
              ? 'மொழி வெற்றிகரமாகப் பயன்படுத்தப்பட்டது!'
              : activeLang === 'hi'
              ? 'भाषा सफलतापूर्वक लागू की गई!'
              : 'Language preference successfully set!')}
          </span>
        </div>

        {/* Small STT Hint if mic permission denied or unsupported */}
        {sttHint && (
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 font-bold text-xs flex items-center justify-center space-x-1.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{sttHint}</span>
          </div>
        )}

        {/* Manual Proceed Button */}
        <button
          type="button"
          onClick={proceed}
          className="w-full py-4 px-6 bg-[#B85C38] hover:bg-[#302720] text-white font-black rounded-2xl text-base shadow-lg shadow-[#B85C38]/30 transition-transform active:scale-95 flex items-center justify-center space-x-2 cursor-pointer"
        >
          <span>
            {t('welcome.proceedBtn') || (activeLang === 'ta'
              ? 'தொடரவும் (Proceed to Location)'
              : activeLang === 'hi'
              ? 'आगे बढ़ें (Proceed to Location)'
              : 'Continue to Location Access')}
          </span>
          <ArrowRight className="w-5 h-5 text-white" />
        </button>

      </div>
    </div>
  );
};
