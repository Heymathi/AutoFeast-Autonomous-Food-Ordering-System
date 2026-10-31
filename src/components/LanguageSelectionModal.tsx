import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Language } from '../types';
import { SpeechController } from '../services/speechController';
import { SttMatcherService } from '../services/sttMatcherService';
import { TRANSLATIONS } from '../data/translations';
import { Sparkles, Globe, Volume2, Mic, CheckCircle2, HelpCircle, AlertCircle } from 'lucide-react';

const ROTATION_LOCALES = ['en-IN', 'ta-IN', 'hi-IN'] as const;

export const LanguageSelectionModal: React.FC = () => {
  const {
    entryStep,
    isLanguageModalOpen,
    handleLanguageSelected,
    speakText,
    language: currentLanguage,
    setLanguage,
    currentUser,
    showToast,
    t
  } = useApp();

  const [isListening, setIsListening] = useState(false);
  const [selectedTemp, setSelectedTemp] = useState<Language | null>(currentLanguage || 'en');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [ttsBlocked, setTtsBlocked] = useState(false);
  const [userTapped, setUserTapped] = useState(false);
  const [displayedSentences, setDisplayedSentences] = useState<string[]>([]);
  const [mediumConfidencePrompt, setMediumConfidencePrompt] = useState<{ lang: Language; label: string } | null>(null);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const [activeLocale, setActiveLocale] = useState<string>('en-IN');
  const [rotationAttempt, setRotationAttempt] = useState<number>(0);

  const hasStartedSequenceRef = useRef(false);
  const hasProceededRef = useRef(false);
  const hasRetriedRef = useRef(false);
  const rotationAttemptRef = useRef(0);
  const activePromptsRef = useRef<string[]>([]);
  const isComponentMounted = useRef<boolean>(false);
  const hasOpenedMicRef = useRef(false);
  const safetySequenceTimerRef = useRef<any>(null);
  const nextRotationTimerRef = useRef<any>(null);

  const ENGLISH_PROMPT = TRANSLATIONS.en['langModal.promptEn'] || 'Please say your language: English, Tamil or Hindi';
  const TAMIL_PROMPT = TRANSLATIONS.ta['langModal.promptTa'] || 'தயவுசெய்து உங்கள் மொழியைக் கூறுங்கள்: ஆங்கிலம், தமிழ் அல்லது இந்தி';
  const HINDI_PROMPT = TRANSLATIONS.hi['langModal.promptHi'] || 'कृपया अपनी भाषा कहें: अंग्रेज़ी, तमिल या हिंदी';

  useEffect(() => {
    isComponentMounted.current = true;
    return () => {
      isComponentMounted.current = false;
      if (safetySequenceTimerRef.current) clearTimeout(safetySequenceTimerRef.current);
      if (nextRotationTimerRef.current) clearTimeout(nextRotationTimerRef.current);
      cleanupSpeech();
    };
  }, []);

  useEffect(() => {
    if (currentLanguage) {
      setSelectedTemp(currentLanguage);
    }
  }, [currentLanguage]);

  useEffect(() => {
    if (entryStep === 'language' || isLanguageModalOpen) {
      hasProceededRef.current = false;
      hasStartedSequenceRef.current = false;
      hasOpenedMicRef.current = false;
      hasRetriedRef.current = false;
      rotationAttemptRef.current = 0;
      setRotationAttempt(0);
      setDisplayedSentences([]);
      setMediumConfidencePrompt(null);
      setTtsBlocked(false);
      setMicPermissionDenied(false);

      // Auto-start without manual tap where the browser allows it (e.g. carried user gesture from login/sign-in click)
      if (SpeechController.hasUserGesture?.()) {
        setUserTapped(true);
        startSequentialPromptSequence();
      } else {
        setUserTapped(false);
        // Start sequence on the first user gesture of any kind (click, keydown, touch, pointer move)
        const onFirstGesture = () => {
          SpeechController.notifyUserGesture?.();
          setUserTapped(true);
          startSequentialPromptSequence();
        };

        window.addEventListener('click', onFirstGesture, { once: true, capture: true });
        window.addEventListener('keydown', onFirstGesture, { once: true, capture: true });
        window.addEventListener('touchstart', onFirstGesture, { once: true, capture: true });
        window.addEventListener('pointerdown', onFirstGesture, { once: true, capture: true });

        return () => {
          window.removeEventListener('click', onFirstGesture, { capture: true });
          window.removeEventListener('keydown', onFirstGesture, { capture: true });
          window.removeEventListener('touchstart', onFirstGesture, { capture: true });
          window.removeEventListener('pointerdown', onFirstGesture, { capture: true });
        };
      }
    } else {
      cleanupSpeech();
    }
  }, [entryStep, isLanguageModalOpen]);

  const cleanupSpeech = () => {
    SpeechController.cancelSpeech();
    SpeechController.releaseMic('language_selection');
    setIsListening(false);
  };

  /**
   * Sequential 3-Sentence TTS Prompting:
   * English -> Tamil -> Hindi
   * If ta/hi voice is missing, show sentence as text.
   * Guarantees onEnd/timeout fallback so mic ALWAYS opens after last prompt (+300ms) even on error/timeout.
   */
  const startSequentialPromptSequence = () => {
    if (hasStartedSequenceRef.current || hasProceededRef.current) return;
    hasStartedSequenceRef.current = true;
    setUserTapped(true);
    SpeechController.notifyUserGesture?.();

    activePromptsRef.current = [ENGLISH_PROMPT, TAMIL_PROMPT, HINDI_PROMPT];
    setDisplayedSentences([ENGLISH_PROMPT]);

    // Safety timeout fallback: Guarantee mic opens even if TTS engine hangs, errors, or gets blocked
    if (safetySequenceTimerRef.current) clearTimeout(safetySequenceTimerRef.current);
    safetySequenceTimerRef.current = setTimeout(() => {
      if (isComponentMounted.current && !hasProceededRef.current && !hasOpenedMicRef.current) {
        console.warn('[LanguageModal]: Safety sequence timeout reached. Opening mic fallback.');
        setDisplayedSentences([ENGLISH_PROMPT, TAMIL_PROMPT, HINDI_PROMPT]);
        scheduleMicAutoOpen();
      }
    }, 12000);

    // Sentence 1: English
    let s1Advanced = false;
    const advanceToSentence2 = () => {
      if (s1Advanced || !isComponentMounted.current || hasProceededRef.current) return;
      s1Advanced = true;

      // Sentence 2: Tamil prompt spoken aloud (show text as fallback if voice missing)
      setDisplayedSentences(prev => prev.includes(TAMIL_PROMPT) ? prev : [...prev, TAMIL_PROMPT]);

      let s2Advanced = false;
      const advanceToSentence3 = () => {
        if (s2Advanced || !isComponentMounted.current || hasProceededRef.current) return;
        s2Advanced = true;

        // Sentence 3: Hindi prompt spoken aloud (show text as fallback if voice missing)
        setDisplayedSentences(prev => prev.includes(HINDI_PROMPT) ? prev : [...prev, HINDI_PROMPT]);

        let s3Advanced = false;
        const advanceToMic = () => {
          if (s3Advanced || !isComponentMounted.current || hasProceededRef.current) return;
          s3Advanced = true;
          if (safetySequenceTimerRef.current) clearTimeout(safetySequenceTimerRef.current);
          scheduleMicAutoOpen();
        };

        SpeechController.speak(
          HINDI_PROMPT,
          'hi',
          advanceToMic,
          (fallbackMsg) => {
            console.log('[LanguageModal]: Hindi voice note:', fallbackMsg);
          },
          'language_selection'
        );
      };

      SpeechController.speak(
        TAMIL_PROMPT,
        'ta',
        advanceToSentence3,
        (fallbackMsg) => {
          console.log('[LanguageModal]: Tamil voice note:', fallbackMsg);
        },
        'language_selection'
      );
    };

    SpeechController.speak(
      ENGLISH_PROMPT,
      'en',
      advanceToSentence2,
      (fallbackMsg) => {
        setTtsBlocked(true);
        console.warn('[LanguageModal]: English TTS note:', fallbackMsg);
        advanceToSentence2();
      },
      'language_selection'
    );
  };

  const scheduleMicAutoOpen = () => {
    if (!isComponentMounted.current || hasProceededRef.current || hasOpenedMicRef.current) return;
    const timer = setTimeout(() => {
      if (isComponentMounted.current && !hasProceededRef.current) {
        startListeningForLanguage(0);
      }
    }, 300);
  };

  /**
   * Mic Configuration:
   * continuous=false, interimResults=true, maxAlternatives=5
   * Auto-restarts up to 3 times on no-speech/aborted/end with locale rotation: en-IN -> ta-IN -> hi-IN
   */
  const startListeningForLanguage = (attemptIndex: number = 0) => {
    if (!SpeechController.isSupported() || hasProceededRef.current || !isComponentMounted.current) return;

    if (attemptIndex >= 3) {
      console.log('[LanguageSelectionModal]: Max 3 STT restart attempts reached without speech. Interactive buttons remain active.');
      setIsListening(false);
      return;
    }

    hasOpenedMicRef.current = true;
    rotationAttemptRef.current = attemptIndex;
    setRotationAttempt(attemptIndex);

    const currentLocale = ROTATION_LOCALES[attemptIndex % ROTATION_LOCALES.length];
    setActiveLocale(currentLocale);
    setIsListening(true);
    setMicPermissionDenied(false);

    SpeechController.requestMic({
      owner: 'language_selection',
      language: currentLocale,
      overrideLocale: currentLocale,
      continuous: false,
      interimResults: true,
      maxAlternatives: 5,
      onStart: () => {
        if (isComponentMounted.current) {
          setIsListening(true);
          setMicPermissionDenied(false);
        }
      },
      onResult: (transcript, isFinal, nBestTranscripts) => {
        if (!transcript || hasProceededRef.current) return;
        setLiveTranscript(transcript);
        if (!isFinal) return;

        const candidates = nBestTranscripts && nBestTranscripts.length > 0 ? nBestTranscripts : [transcript];
        console.log('[LanguageSelection Voice Candidates]:', candidates);

        // Echo filter: ONLY ignore text equal to the app's own prompt, never the user's answer
        const isPromptEcho = (text: string): boolean => {
          if (!text) return false;
          const clean = text.trim().toLowerCase().replace(/[.,!?:;]/g, '');
          const prompts = [
            ENGLISH_PROMPT,
            TAMIL_PROMPT,
            HINDI_PROMPT
          ].map(p => (p || '').trim().toLowerCase().replace(/[.,!?:;]/g, ''));
          return prompts.some(p => clean === p || (clean.length > 25 && p.includes(clean)));
        };

        const validCandidates = candidates.filter(cand => !isPromptEcho(cand));
        if (validCandidates.length === 0) {
          console.log('[LanguageSelectionModal]: Ignored prompt echo speech input.');
          return;
        }

        // Handle Medium Confidence Yes/No Confirmation if active
        if (mediumConfidencePrompt) {
          const matchConfirm = SttMatcherService.matchConfirmation(validCandidates, currentLanguage || 'en');
          if (matchConfirm.isMatched && matchConfirm.matchedValue === 'YES') {
            handleChooseLanguage(mediumConfidencePrompt.lang, true);
            setMediumConfidencePrompt(null);
            return;
          } else if (matchConfirm.isMatched && matchConfirm.matchedValue === 'NO') {
            setMediumConfidencePrompt(null);
            setLiveTranscript('');
            startListeningForLanguage(0);
            return;
          }
        }

        // Match language choice using shared SttMatcherService over all 5 candidates
        const matchResult = SttMatcherService.matchLanguageChoice(validCandidates);

        if (matchResult.isMatched && matchResult.matchedValue) {
          const matchedLang = matchResult.matchedValue;
          console.log(`[LanguageSelection STT Match]: Matched -> "${matchedLang}" (score: ${matchResult.confidence})`);

          if (matchResult.needsClarification || (matchResult.confidence >= 0.45 && matchResult.confidence < 0.75)) {
            // Medium confidence: Ask "Did you mean Tamil/Hindi/English?"
            const langLabel = matchedLang === 'ta' ? 'Tamil' : matchedLang === 'hi' ? 'Hindi' : 'English';
            const askText = matchedLang === 'ta'
              ? 'தமிழ் மொழியைக் குறிக்கிறீர்களா?'
              : matchedLang === 'hi'
              ? 'क्या आपका मतलब हिंदी है?'
              : 'Did you mean English?';

            setMediumConfidencePrompt({ lang: matchedLang, label: langLabel });
            SpeechController.speak(askText, matchedLang, () => {
              if (isComponentMounted.current && !hasProceededRef.current) {
                startListeningForLanguage(0);
              }
            }, undefined, 'language_selection');
          } else {
            // High confidence >= 0.75: Select language directly and speak confirmation in THAT language
            handleChooseLanguage(matchedLang, true);
          }
        } else {
          // Low confidence < 0.45: Reprompt once then rotate through locales up to 3 attempts
          if (!hasRetriedRef.current) {
            hasRetriedRef.current = true;
            const retryMsg = currentLanguage === 'ta'
              ? 'மன்னிக்கவும், புரியவில்லை. தமிழ், ஹிந்தி அல்லது ஆங்கிலம் என்று சொல்லவும்.'
              : currentLanguage === 'hi'
              ? 'क्षमा करें, समझ नहीं आया। हिंदी, तमिल या अंग्रेजी बोलें।'
              : 'Sorry, I did not catch that. Please say English, Tamil, or Hindi.';

            SpeechController.speak(retryMsg, currentLanguage || 'en', () => {
              if (isComponentMounted.current && !hasProceededRef.current) {
                if (attemptIndex + 1 < 3) {
                  startListeningForLanguage(attemptIndex + 1);
                } else {
                  startListeningForLanguage(0);
                }
              }
            }, undefined, 'language_selection');
          } else if (attemptIndex + 1 < 3) {
            scheduleNextRotation(attemptIndex + 1);
          } else {
            setIsListening(false);
          }
        }
      },
      onError: (errCode) => {
        if (!isComponentMounted.current) return;
        console.warn('[LanguageSelection Mic Error]:', errCode);
        if (errCode === 'not-allowed' || errCode === 'permission-denied') {
          setIsListening(false);
          setMicPermissionDenied(true);
          return;
        }
        if (errCode === 'no-speech' || errCode === 'aborted') {
          if (attemptIndex + 1 < 3) {
            scheduleNextRotation(attemptIndex + 1);
          } else {
            setIsListening(false);
          }
        } else {
          setIsListening(false);
        }
      },
      onEnd: () => {
        if (!isComponentMounted.current || hasProceededRef.current) return;
        setIsListening(false);
        // On natural end (silence) without proceeding, auto-restart rotation up to 3 times
        if (!mediumConfidencePrompt && attemptIndex + 1 < 3) {
          scheduleNextRotation(attemptIndex + 1);
        }
      }
    });
  };

  const scheduleNextRotation = (nextAttempt: number) => {
    if (hasProceededRef.current || !isComponentMounted.current) return;
    if (nextRotationTimerRef.current) clearTimeout(nextRotationTimerRef.current);
    nextRotationTimerRef.current = setTimeout(() => {
      if (isComponentMounted.current && !hasProceededRef.current) {
        startListeningForLanguage(nextAttempt);
      }
    }, 400);
  };

  const handleUserGesture = () => {
    if (!userTapped || !hasStartedSequenceRef.current) {
      SpeechController.notifyUserGesture();
      startSequentialPromptSequence();
    }
  };

  const handleChooseLanguage = (lang: Language, isSpoken: boolean = false) => {
    if (hasProceededRef.current) return;
    hasProceededRef.current = true;

    cleanupSpeech();
    SpeechController.notifyUserGesture();
    setSelectedTemp(lang);
    setLanguage(lang);

    const confirmMsg = lang === 'ta'
      ? 'தமிழ் மொழி தேர்ந்தெடுக்கப்பட்டது.'
      : lang === 'hi'
      ? 'हिंदी भाषा चुनी गई।'
      : 'English language selected.';

    showToast(confirmMsg, 'success');

    let safeTimer: NodeJS.Timeout | null = null;
    const doAdvance = () => {
      if (safeTimer) clearTimeout(safeTimer);
      handleLanguageSelected(lang);
    };

    SpeechController.speak(confirmMsg, lang, doAdvance, undefined, 'language_selection');
    safeTimer = setTimeout(doAdvance, 2500);
  };

  if (entryStep !== 'language' && !isLanguageModalOpen) return null;

  return (
    <div
      onClick={handleUserGesture}
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-lg animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white text-[#1A1110] rounded-3xl shadow-2xl overflow-hidden border-4 border-[#C82346] transition-all transform scale-100"
      >

        {/* Top Branding Banner */}
        <div className="bg-[#FFF5F6] p-6 text-center border-b border-[#FCE7EB]">
          <div className="inline-flex items-center justify-center p-3.5 bg-white rounded-2xl mb-3 shadow-md border border-[#FCE7EB]">
            <Sparkles className="w-8 h-8 text-[#C82346] mr-2 animate-pulse" />
            <h1 className="text-3xl font-black text-[#1A1110] tracking-tight">AutoFeast AI</h1>
          </div>

          <p className="text-xs font-black text-[#C82346] uppercase tracking-widest flex items-center justify-center gap-1">
            <Globe className="w-4 h-4" />
            <span>Select Your Preferred Language / மொழியைத் தேர்ந்தெடுக்கவும்</span>
          </p>

          <div className="mt-3 space-y-1 text-xs font-bold text-[#4A5568]">
            <p>🇬🇧 Say "English", "Tamil", or "Hindi"</p>
            <p>🇮🇳 "தமிழ்", "ஆங்கிலம்" அல்லது "ஹிந்தி" என்று சொல்லுங்கள்</p>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="p-6 sm:p-8 space-y-4">

          {/* User Gesture Tap to Start Voice Button */}
          {!userTapped && (
            <button
              type="button"
              data-testid="btn-tap-start-voice"
              onClick={startSequentialPromptSequence}
              className="w-full p-4 bg-[#C82346] hover:bg-[#B31D3D] text-white rounded-2xl font-black text-sm sm:text-base shadow-lg flex items-center justify-center space-x-2 cursor-pointer transition-transform active:scale-95 animate-pulse"
            >
              <Mic className="w-5 h-5 text-yellow-300" />
              <span>{t('langModal.tapToStart') || 'Tap to start voice prompt'}</span>
            </button>
          )}

          {/* Localized Mic Permission Denied Banner */}
          {micPermissionDenied && (
            <div data-testid="mic-permission-denied-box" className="p-4 bg-red-50 border-2 border-red-300 rounded-2xl flex items-start space-x-3 text-xs text-red-900 shadow-sm animate-fade-in">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-sm text-red-700">Microphone Access Blocked / அனுமதி மறுக்கப்பட்டது</p>
                <p className="font-medium mt-1">
                  {currentLanguage === 'ta'
                    ? 'மைக் அணுகல் மறுக்கப்பட்டது. உலாவியில் மைக் அனுமதியை இயக்கவும், அல்லது கீழே உள்ள மொழிகளில் ஒன்றைத் தட்டவும்.'
                    : currentLanguage === 'hi'
                    ? 'माइक्रोफ़ोन एक्सेस अस्वीकृत। कृपया ब्राउज़र सेटिंग्स में माइक्रोफ़ोन की अनुमति दें, या नीचे अपनी भाषा चुनें।'
                    : 'Microphone permission was denied. Please allow microphone access in your browser address bar settings, or tap your preferred language card below.'}
                </p>
              </div>
            </div>
          )}

          {/* Displayed Sentences / Spoken Prompts */}
          {displayedSentences.length > 0 && (
            <div className="p-3 bg-[#FFF5F6]/50 rounded-2xl border border-[#FCE7EB] space-y-1">
              <span className="text-[10px] font-black uppercase text-[#C82346] flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5" /> Spoken Prompts:
              </span>
              {displayedSentences.map((sent, idx) => (
                <p key={idx} className="text-xs font-bold text-[#1A1110]">{sent}</p>
              ))}
            </div>
          )}

          {/* Medium Confidence "Did You Mean" Confirmation Card */}
          {mediumConfidencePrompt && (
            <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-2xl space-y-3 shadow-md animate-fade-in text-center">
              <div className="flex items-center justify-center space-x-2 text-amber-900 font-black text-sm">
                <HelpCircle className="w-5 h-5 text-[#C82346]" />
                <span>Did you mean {mediumConfidencePrompt.label}?</span>
              </div>
              <p className="text-xs text-amber-800 font-bold">Say "Yes" or "No", or tap below:</p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  data-testid="btn-confirm-did-you-mean-yes"
                  onClick={() => handleChooseLanguage(mediumConfidencePrompt.lang, true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-sm cursor-pointer"
                >
                  Yes, select {mediumConfidencePrompt.label}
                </button>
                <button
                  type="button"
                  data-testid="btn-confirm-did-you-mean-no"
                  onClick={() => {
                    setMediumConfidencePrompt(null);
                    setLiveTranscript('');
                    startListeningForLanguage(0);
                  }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-black text-xs rounded-xl shadow-sm cursor-pointer"
                >
                  No, try again
                </button>
              </div>
            </div>
          )}

          {/* Voice Status Badge */}
          <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs shadow-xs">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full shrink-0 ${isListening ? 'bg-emerald-500 animate-ping' : 'bg-slate-300'}`} />
              <Volume2 className="w-5 h-5 text-[#C82346] animate-bounce shrink-0" />
              <span className="font-extrabold text-[#1A1110]">
                {liveTranscript
                  ? `🎙️ Spoken: "${liveTranscript}"`
                  : isListening
                  ? `🎙️ Listening [${activeLocale}] (Attempt ${rotationAttempt + 1}/3)... Say "Tamil", "English", or "Hindi"`
                  : '🔊 Speak or tap your preferred language'}
              </span>
            </div>
            <button
              type="button"
              onClick={startSequentialPromptSequence}
              className="px-3 py-1.5 bg-[#C82346] text-white rounded-xl font-bold flex items-center space-x-1 shadow-xs hover:bg-[#B31D3D] cursor-pointer shrink-0"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Voice</span>
            </button>
          </div>

          {/* 3 Interactive Language Cards (Tap or Voice Fallback) */}
          <div className="grid grid-cols-1 gap-3 pt-1">

            {/* Option 1: Tamil */}
            <button
              type="button"
              data-testid="btn-select-language-ta"
              onClick={() => handleChooseLanguage('ta')}
              className={`p-4 rounded-2xl border-3 flex items-center justify-between transition-all cursor-pointer text-left ${
                selectedTemp === 'ta' || currentLanguage === 'ta'
                  ? 'border-[#C82346] bg-[#C82346]/10 shadow-lg scale-102'
                  : 'border-[#FFF5F6] bg-slate-50 hover:bg-[#FFF5F6]/40 hover:border-[#FCE7EB]'
              }`}
            >
              <div className="flex items-center space-x-4">
                <span className="text-3xl">🇮🇳</span>
                <div>
                  <h3 className="text-lg font-black text-[#1A1110]">தமிழ் (Tamil)</h3>
                  <p className="text-xs font-bold text-[#4A5568]">முழுமையான குரல் வழி வழிகாட்டுதலுடன் தமிழ்</p>
                </div>
              </div>
              <div className="p-2 bg-white rounded-full border border-slate-200">
                <CheckCircle2 className={`w-5 h-5 ${selectedTemp === 'ta' ? 'text-[#C82346]' : 'text-slate-300'}`} />
              </div>
            </button>

            {/* Option 2: English */}
            <button
              type="button"
              data-testid="btn-select-language-en"
              onClick={() => handleChooseLanguage('en')}
              className={`p-4 rounded-2xl border-3 flex items-center justify-between transition-all cursor-pointer text-left ${
                selectedTemp === 'en' || currentLanguage === 'en'
                  ? 'border-[#C82346] bg-[#C82346]/10 shadow-lg scale-102'
                  : 'border-[#FFF5F6] bg-slate-50 hover:bg-[#FFF5F6]/40 hover:border-[#FCE7EB]'
              }`}
            >
              <div className="flex items-center space-x-4">
                <span className="text-3xl">🇬🇧</span>
                <div>
                  <h3 className="text-lg font-black text-[#1A1110]">English</h3>
                  <p className="text-xs font-bold text-[#4A5568]">Full English voice assistance & natural interaction</p>
                </div>
              </div>
              <div className="p-2 bg-white rounded-full border border-slate-200">
                <CheckCircle2 className={`w-5 h-5 ${selectedTemp === 'en' ? 'text-[#C82346]' : 'text-slate-300'}`} />
              </div>
            </button>

            {/* Option 3: Hindi */}
            <button
              type="button"
              data-testid="btn-select-language-hi"
              onClick={() => handleChooseLanguage('hi')}
              className={`p-4 rounded-2xl border-3 flex items-center justify-between transition-all cursor-pointer text-left ${
                selectedTemp === 'hi' || currentLanguage === 'hi'
                  ? 'border-[#C82346] bg-[#C82346]/10 shadow-lg scale-102'
                  : 'border-[#FFF5F6] bg-slate-50 hover:bg-[#FFF5F6]/40 hover:border-[#FCE7EB]'
              }`}
            >
              <div className="flex items-center space-x-4">
                <span className="text-3xl">🇮🇳</span>
                <div>
                  <h3 className="text-lg font-black text-[#1A1110]">हिन्दी (Hindi)</h3>
                  <p className="text-xs font-bold text-[#4A5568]">पूर्ण आवाज सहायता के साथ हिंदी भाषा</p>
                </div>
              </div>
              <div className="p-2 bg-white rounded-full border border-slate-200">
                <CheckCircle2 className={`w-5 h-5 ${selectedTemp === 'hi' ? 'text-[#C82346]' : 'text-slate-300'}`} />
              </div>
            </button>

          </div>

        </div>

      </div>
    </div>
  );
};
