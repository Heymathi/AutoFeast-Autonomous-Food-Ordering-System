import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { SpeechController } from '../services/speechController';
import { parsePinSpeech } from '../services/pinVoiceParserService';
import { debounceHandler } from '../utils/debounce';
import { Lock, ShieldCheck, Mic, Delete, AlertTriangle, Volume2 } from 'lucide-react';

export interface SecurityPinEntryViewProps {
  title?: string;
  subtitle?: string;
  onPinComplete: (pinStr: string) => void | Promise<void>;
  onCancel?: () => void;
  isVerifying?: boolean;
  lockSecondsLeft?: number;
  errorMessage?: string | null;
  setErrorMessage?: (msg: string | null) => void;
  submitButtonText?: string;
  cancelButtonText?: string;
  summaryCard?: React.ReactNode;
}

export const SecurityPinEntryView: React.FC<SecurityPinEntryViewProps> = ({
  title,
  subtitle,
  onPinComplete,
  onCancel,
  isVerifying = false,
  lockSecondsLeft = 0,
  errorMessage = null,
  setErrorMessage,
  submitButtonText,
  cancelButtonText,
  summaryCard
}) => {
  const { language, t, accessibilitySettings } = useApp();

  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '']);
  const [micState, setMicState] = useState<'idle' | 'listening' | 'processing' | 'error'>('idle');
  const [activeLocale, setActiveLocale] = useState<string>('en-IN');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const activeRetryIndex = useRef<number>(0);
  const isComponentMounted = useRef<boolean>(false);
  const hasSpokenPromptRef = useRef<boolean>(false);
  const activePromptsRef = useRef<string[]>([]);

  // Prompts in 3 languages - NEVER contains PIN digits!
  const PROMPT_EN = 'Please say your 4-digit PIN';
  const PROMPT_TA = 'தயவுசெய்து உங்கள் 4 இலக்க PIN கூறவும்';
  const PROMPT_HI = 'कृपया अपना 4 अंकों का पिन कहें';

  const getPromptForLanguage = () => {
    switch (language) {
      case 'ta': return PROMPT_TA;
      case 'hi': return PROMPT_HI;
      default: return PROMPT_EN;
    }
  };

  const getLocaleChain = (): string[] => {
    switch (language) {
      case 'ta': return ['ta-IN', 'en-IN', 'hi-IN'];
      case 'hi': return ['hi-IN', 'en-IN', 'ta-IN'];
      default: return ['en-IN', 'ta-IN', 'hi-IN'];
    }
  };

  const localeChain = getLocaleChain();

  useEffect(() => {
    isComponentMounted.current = true;
    activePromptsRef.current = [PROMPT_EN, PROMPT_TA, PROMPT_HI];
    setPinDigits(['', '', '', '']);
    setMicState('idle');
    setStatusMessage(null);

    // Initial prompt speak once on open (STT is OFF during TTS)
    if (!hasSpokenPromptRef.current) {
      hasSpokenPromptRef.current = true;
      const promptText = getPromptForLanguage();

      SpeechController.speak(
        promptText,
        language || 'en',
        () => {
          if (!isComponentMounted.current) return;
          const timer = setTimeout(() => {
            if (isComponentMounted.current) {
              startVoicePinListening(0);
            }
          }, 300);
        },
        undefined,
        'voice_pin'
      );
    }

    return () => {
      isComponentMounted.current = false;
      cleanupSpeech();
    };
  }, []);

  const cleanupSpeech = () => {
    SpeechController.cancelSpeech();
    SpeechController.releaseMic('voice_pin');
    setMicState('idle');
  };

  const currentPinString = pinDigits.join('');
  const isInputBlocked = isVerifying || lockSecondsLeft > 0;

  const debouncedPinComplete = useRef(
    debounceHandler((pinStr: string) => {
      if (pinStr.length === 4) {
        cleanupSpeech();
        onPinComplete(pinStr);
      }
    }, 500)
  ).current;

  // Auto-submit when all 4 digits filled
  useEffect(() => {
    if (currentPinString.length === 4 && !isVerifying) {
      cleanupSpeech();
      debouncedPinComplete(currentPinString);
    }
  }, [currentPinString, isVerifying]);

  useEffect(() => {
    if (lockSecondsLeft > 0) setPinDigits(['', '', '', '']);
  }, [lockSecondsLeft]);

  // Physical Keyboard Listener (0-9, Backspace, Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputBlocked) return;
      if (e.key >= '0' && e.key <= '9') {
        const num = e.key;
        if (setErrorMessage) setErrorMessage(null);
        setStatusMessage(null);
        setPinDigits(prev => {
          const emptyIdx = prev.findIndex(d => d === '');
          if (emptyIdx !== -1) {
            const next = [...prev];
            next[emptyIdx] = num;
            return next;
          }
          return prev;
        });
      } else if (e.key === 'Backspace') {
        if (setErrorMessage) setErrorMessage(null);
        setStatusMessage(null);
        setPinDigits(prev => {
          const filled = prev.map((d, i) => (d !== '' ? i : -1)).filter(i => i !== -1);
          if (filled.length > 0) {
            const lastIdx = filled[filled.length - 1];
            const next = [...prev];
            next[lastIdx] = '';
            return next;
          }
          return prev;
        });
      } else if (e.key === 'Enter') {
        if (currentPinString.length === 4) {
          debouncedPinComplete(currentPinString);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPinString, isInputBlocked]);

  const handleDigitClick = (num: number) => {
    if (isInputBlocked) return;
    if (setErrorMessage) setErrorMessage(null);
    setStatusMessage(null);
    const emptyIdx = pinDigits.findIndex(d => d === '');
    if (emptyIdx !== -1) {
      const next = [...pinDigits];
      next[emptyIdx] = num.toString();
      setPinDigits(next);
    }
  };

  const handleBackspace = () => {
    if (isInputBlocked) return;
    if (setErrorMessage) setErrorMessage(null);
    setStatusMessage(null);
    setPinDigits(prev => {
      const filledIndices = prev.map((d, i) => (d !== '' ? i : -1)).filter(i => i !== -1);
      if (filledIndices.length > 0) {
        const lastIdx = filledIndices[filledIndices.length - 1];
        const next = [...prev];
        next[lastIdx] = '';
        return next;
      }
      return prev;
    });
  };

  const handleClear = () => {
    if (isInputBlocked) return;
    if (setErrorMessage) setErrorMessage(null);
    setStatusMessage(null);
    setPinDigits(['', '', '', '']);
  };

  const startVoicePinListening = (retryIdx: number = 0) => {
    if (isInputBlocked || !SpeechController.isSupported() || !isComponentMounted.current) return;
    if (retryIdx >= localeChain.length) {
      setMicState('error');
      setStatusMessage('Voice recognition unavailable. Please use keypad.');
      return;
    }

    activeRetryIndex.current = retryIdx;
    const targetLocale = localeChain[retryIdx];
    setActiveLocale(targetLocale);
    setMicState('listening');

    SpeechController.requestMic({
      owner: 'voice_pin',
      language: targetLocale,
      continuous: false,
      interimResults: true,
      maxAlternatives: 5,
      isPinScreen: true,
      onStart: () => {
        if (isComponentMounted.current) setMicState('listening');
      },
      onResult: (rawTranscript, isFinal, nBestTranscripts) => {
        if (!isComponentMounted.current || !isFinal || !rawTranscript) return;
        setMicState('processing');

        const candidates = nBestTranscripts && nBestTranscripts.length > 0 ? nBestTranscripts : [rawTranscript];

        // Echo filter: ignore any transcript equal to or contained in the app's prompt
        const isEcho = candidates.some(cand =>
          activePromptsRef.current.some(prompt => cand.toLowerCase().includes(prompt.toLowerCase().substring(0, 10)))
        );
        if (isEcho) {
          console.log('[SecurityPinEntryView]: Ignored app prompt echo.');
          setMicState('listening');
          return;
        }

        // Try parsing every alternative candidate
        let parseResult = parsePinSpeech(candidates[0], language);
        for (const cand of candidates) {
          const res = parsePinSpeech(cand, language);
          if (res.status === 'success' || res.status === 'command') {
            parseResult = res;
            break;
          }
        }

        if (parseResult.status === 'command') {
          if (parseResult.command === 'clear') handleClear();
          else if (parseResult.command === 'back') handleBackspace();
          else if (parseResult.command === 'cancel') {
            cleanupSpeech();
            if (onCancel) onCancel();
          }
          return;
        }

        if (parseResult.status === 'requires_each_digit' || parseResult.status === 'too_many') {
          const invalidCountMsg = language === 'ta'
            ? 'தயவுசெய்து 4 தனித்தனி இலக்கங்களை கூறவும். அழிக்க "அழி" எனக் கூறவும்.'
            : language === 'hi'
            ? 'कृपया 4 अलग-अलग अंक कहें। रीसेट के लिए "मिटाओ" कहें।'
            : 'Please say 4 single digits. Say "clear" to reset.';

          setStatusMessage(invalidCountMsg);
          setPinDigits(['', '', '', '']);
          SpeechController.speak(invalidCountMsg, language || 'en', () => {
            if (isComponentMounted.current) startVoicePinListening(retryIdx);
          }, undefined, 'voice_pin');
          return;
        }

        if (parseResult.status === 'need_more' && parseResult.digits.length > 0) {
          const newDigits = ['', '', '', ''];
          parseResult.digits.forEach((d, i) => {
            if (i < 4) newDigits[i] = d;
          });
          setPinDigits(newDigits);
          const remainMsg = language === 'ta'
            ? 'மீதமுள்ள இலக்கங்களை கூறுங்கள்'
            : language === 'hi'
            ? 'शेष अंक कहें'
            : 'Say the remaining digits';
          setStatusMessage(remainMsg);
          SpeechController.speak(remainMsg, language || 'en', () => {
            if (isComponentMounted.current) startVoicePinListening(retryIdx);
          }, undefined, 'voice_pin');
          return;
        }

        if (parseResult.status === 'success' && parseResult.digits.length === 4) {
          SpeechController.releaseMic('voice_pin');
          setPinDigits(parseResult.digits);
          setMicState('idle');

          const confirmText = language === 'ta'
            ? 'PIN பெறப்பட்டது'
            : language === 'hi'
            ? 'पिन प्राप्त हुआ'
            : 'PIN received';

          setStatusMessage(confirmText);

          // SECURITY RULE: Confirmation speech says ONLY "PIN received", NEVER the digits!
          SpeechController.speak(confirmText, language || 'en', () => {
            debouncedPinComplete(parseResult.digits.join(''));
          }, undefined, 'voice_pin');
        }
      },
      onError: (errCode) => {
        if (!isComponentMounted.current) return;
        console.warn(`[Voice PIN Error on locale ${targetLocale}]:`, errCode);
        if (errCode === 'not-allowed') {
          setMicState('error');
          setStatusMessage('Microphone access denied. Please use keypad.');
        } else {
          startVoicePinListening(retryIdx + 1);
        }
      },
      onEnd: () => {
        if (isComponentMounted.current && currentPinString.length < 4) {
          setMicState('idle');
        }
      }
    });
  };

  const handleMicToggle = () => {
    if (micState === 'listening') {
      cleanupSpeech();
    } else {
      SpeechController.cancelSpeech();
      startVoicePinListening(0);
    }
  };

  return (
    <div className="space-y-3.5">

      {/* Title & Lock Icon */}
      <div className="text-center space-y-1">
        <div className="inline-flex p-2.5 bg-[#FF5A1F]/10 rounded-2xl border border-[#FF5A1F]/30 text-[#FF5A1F] shadow-sm">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-[#1A1110]">
          {title || t('pinEnter4') || 'Enter 4-Digit PIN'}
        </h2>
        {subtitle && (
          <p className="text-xs font-bold text-[#4A5568]">
            {subtitle}
          </p>
        )}
      </div>

      {/* Optional Summary Card */}
      {summaryCard}

      {/* PIN Digit Displays (4 Boxes - Dots ONLY) */}
      <div className="flex justify-center items-center space-x-3 sm:space-x-4 my-1">
        {pinDigits.map((digit, idx) => (
          <div
            key={idx}
            data-testid={`pin-box-${idx}`}
            className={`w-12 h-14 sm:w-14 sm:h-16 rounded-2xl border-3 flex items-center justify-center text-2xl font-black transition-all shadow-inner ${
              digit
                ? 'border-[#FF5A1F] bg-[#FF5A1F]/10 text-[#FF5A1F] scale-105'
                : 'border-slate-200 bg-slate-50 text-slate-400'
            }`}
          >
            {digit ? '●' : ''}
          </div>
        ))}
      </div>

      {/* Error & Status Alert Box */}
      {errorMessage && (
        <div className="p-2.5 bg-red-500/10 border-2 border-red-500 rounded-xl text-red-600 font-black text-xs text-center flex items-center justify-center space-x-2 animate-fadeIn">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {lockSecondsLeft > 0 && (
        <div role="status" className="text-center text-xs font-bold text-red-700">
          {language === 'ta'
            ? `${lockSecondsLeft} வினாடிகளுக்குப் பிறகு மீண்டும் முயற்சிக்கலாம்.`
            : language === 'hi'
            ? `${lockSecondsLeft} सेकंड बाद फिर कोशिश कर सकते हैं।`
            : `Retry becomes available in ${lockSecondsLeft} seconds.`}
        </div>
      )}

      {statusMessage && !errorMessage && (
        <div className="p-2 bg-[#DAF0F7] border border-[#B2E2F0] rounded-xl text-[#0284C7] font-bold text-xs text-center flex items-center justify-center space-x-2 animate-fadeIn">
          <Volume2 className="w-4 h-4 text-[#0284C7] shrink-0 animate-pulse" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Prominent Voice Mic Banner */}
      <div className="bg-slate-50 p-3.5 rounded-2xl border-2 border-[#FF5A1F]/30 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            data-testid="btn-speak-pin-mic"
            onClick={handleMicToggle}
            disabled={isInputBlocked}
            className={`p-3 rounded-2xl transition-all cursor-pointer shadow-md active:scale-95 shrink-0 ${
              micState === 'listening'
                ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-300'
                : micState === 'processing'
                ? 'bg-amber-500 text-white animate-bounce'
                : 'bg-[#FF5A1F] text-white hover:bg-[#E04812]'
            }`}
            title="Tap to speak PIN digits"
          >
            <Mic className="w-6 h-6" />
          </button>
          <div className="space-y-0.5 text-left">
            <span className="text-xs font-black uppercase text-slate-800 block">
              {micState === 'listening'
                ? `Listening for PIN... (${activeLocale})`
                : micState === 'processing'
                ? 'Processing PIN...'
                : 'Speak PIN Digits'}
            </span>
            <span className="text-[10px] font-bold text-[#FF5A1F] block">
              💡 Say 4 digits in English, Tamil, or Hindi
            </span>
          </div>
        </div>

        <button
          type="button"
          data-testid="btn-speak-pin-toggle"
          onClick={handleMicToggle}
          disabled={isInputBlocked}
          className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
            micState === 'listening'
              ? 'bg-red-100 text-red-600 border border-red-300'
              : 'bg-[#FF5A1F]/10 text-[#FF5A1F] hover:bg-[#FF5A1F]/20'
          }`}
        >
          {micState === 'listening' ? 'Stop' : 'Speak PIN'}
        </button>
      </div>

      {/* Privacy Warning Note */}
      <div className="text-[10px] font-semibold text-slate-500 text-center px-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
        🛡️ Voice PIN security: Digits are never logged, displayed, or spoken aloud.
      </div>

      {/* Keypad Buttons */}
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <button
            key={num}
            type="button"
            data-testid={`keypad-digit-${num}`}
            onClick={() => handleDigitClick(num)}
            disabled={isInputBlocked}
            className="py-2.5 sm:py-3 rounded-2xl bg-slate-100 hover:bg-[#FF5A1F] hover:text-white text-[#1A1110] font-black text-lg sm:text-xl shadow-xs active:scale-95 transition-all border border-slate-200 cursor-pointer"
          >
            {num}
          </button>
        ))}
        <button
          type="button"
          onClick={handleClear}
          disabled={isInputBlocked}
          className="py-2.5 sm:py-3 rounded-2xl bg-slate-200 hover:bg-slate-300 text-xs font-black uppercase text-[#4A5568] transition-all cursor-pointer"
        >
          Clear
        </button>
        <button
          type="button"
          data-testid="keypad-digit-0"
          onClick={() => handleDigitClick(0)}
          disabled={isInputBlocked}
          className="py-2.5 sm:py-3 rounded-2xl bg-slate-100 hover:bg-[#FF5A1F] hover:text-white text-[#1A1110] font-black text-lg sm:text-xl shadow-xs active:scale-95 transition-all border border-slate-200 cursor-pointer"
        >
          0
        </button>
        <button
          type="button"
          onClick={handleBackspace}
          disabled={isInputBlocked}
          className="py-2.5 sm:py-3 rounded-2xl bg-slate-200 hover:bg-slate-300 text-[#4A5568] flex items-center justify-center transition-all cursor-pointer"
          title="Backspace"
        >
          <Delete className="w-5 h-5" />
        </button>
      </div>

      {/* Submit / Action Buttons */}
      <div className="flex items-center gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-1/3 py-3 px-3 bg-slate-100 hover:bg-slate-200 text-[#4A5568] font-black rounded-xl text-xs transition-all border border-slate-300 cursor-pointer text-center"
          >
            {cancelButtonText || 'Cancel'}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (currentPinString.length === 4) {
              debouncedPinComplete(currentPinString);
            }
          }}
          disabled={isInputBlocked || currentPinString.length !== 4}
          className={`flex-1 py-3.5 px-4 font-black rounded-xl text-xs sm:text-sm shadow-xl transition-all flex items-center justify-center space-x-2 cursor-pointer ${
            currentPinString.length === 4
              ? 'bg-[#16A34A] hover:bg-[#15803D] text-white shadow-[#16A34A]/40 ring-4 ring-[#16A34A]/30 animate-pulse'
              : 'bg-slate-300 text-slate-500 cursor-not-allowed'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-white" />
          <span>
            {isVerifying
              ? 'Verifying...'
              : lockSecondsLeft > 0
                ? language === 'ta'
                  ? `${lockSecondsLeft} வினாடிகளுக்குப் பிறகு மீண்டும் முயற்சிக்கவும்`
                  : language === 'hi'
                    ? `${lockSecondsLeft} सेकंड बाद फिर कोशिश करें`
                    : `Retry in ${lockSecondsLeft}s`
                : submitButtonText || 'Confirm PIN'}
          </span>
        </button>
      </div>

    </div>
  );
};
