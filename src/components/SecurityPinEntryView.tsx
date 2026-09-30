import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { SpeechService } from '../services/speechService';
import { parsePinSpeech } from '../services/pinVoiceParserService';
import { Lock, ShieldCheck, Mic, Delete, AlertTriangle, Grid as KeypadIcon, Volume2 } from 'lucide-react';

export interface SecurityPinEntryViewProps {
  title?: string;
  subtitle?: string;
  onPinComplete: (pinStr: string) => void | Promise<void>;
  onCancel?: () => void;
  isVerifying?: boolean;
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
  errorMessage = null,
  setErrorMessage,
  submitButtonText,
  cancelButtonText,
  summaryCard
}) => {
  const { language, t, speakText, accessibilitySettings } = useApp();

  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '']);
  const [micState, setMicState] = useState<'idle' | 'listening' | 'processing' | 'error'>('idle');
  const [activeLocale, setActiveLocale] = useState<string>('en-IN');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const activeRetryIndex = useRef<number>(0);

  // Define locale fallback chain based on app language
  const getLocaleChain = (): string[] => {
    switch (language) {
      case 'ta':
        return ['ta-IN', 'en-IN', 'hi-IN'];
      case 'hi':
        return ['hi-IN', 'en-IN', 'ta-IN'];
      case 'en':
      default:
        return ['en-IN', 'ta-IN', 'hi-IN'];
    }
  };

  const localeChain = getLocaleChain();

  // Reset PIN digits and stop mic on mount / unmount
  useEffect(() => {
    setPinDigits(['', '', '', '']);
    setMicState('idle');
    setStatusMessage(null);
    SpeechService.stopListening();

    return () => {
      SpeechService.stopListening();
    };
  }, []);

  const currentPinString = pinDigits.join('');

  // Auto-submit when all 4 digits filled
  useEffect(() => {
    if (currentPinString.length === 4 && !isVerifying) {
      SpeechService.stopListening();
      setMicState('idle');
      onPinComplete(currentPinString);
    }
  }, [currentPinString, isVerifying]);

  // Physical Keyboard Listener (0-9, Backspace, Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
          onPinComplete(currentPinString);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPinString]);

  // Handle digit click from Keypad
  const handleDigitClick = (num: number) => {
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
    if (setErrorMessage) setErrorMessage(null);
    setStatusMessage(null);
    setPinDigits(['', '', '', '']);
  };

  // STT Voice Handler with Locale Retry Chain
  const startVoiceRecognition = (retryIdx: number = 0) => {
    if (retryIdx >= localeChain.length) {
      setMicState('error');
      const err = t('noSpeech');
      if (setErrorMessage) setErrorMessage(err);
      speakText(err, undefined, language);
      return;
    }

    activeRetryIndex.current = retryIdx;
    const targetLocale = localeChain[retryIdx];
    setActiveLocale(targetLocale);
    setMicState('listening');
    setStatusMessage(t('pinListening'));

    // STT MUST BE OFF WHILE APP IS SPEAKING (TTS)
    SpeechService.stopListening();

    const success = SpeechService.startListening({
      language,
      overrideLocale: targetLocale,
      continuous: true,
      interimResults: true,
      maxAlternatives: 5,
      onStart: () => {
        setMicState('listening');
      },
      onResult: (rawTranscript, _isFinal) => {
        if (!rawTranscript || !rawTranscript.trim()) return;

        setMicState('processing');
        const parsed = parsePinSpeech(rawTranscript, language);

        if (parsed.status === 'command') {
          if (parsed.command === 'clear') {
            handleClear();
          } else if (parsed.command === 'back') {
            handleBackspace();
          } else if (parsed.command === 'cancel') {
            SpeechService.stopListening();
            if (onCancel) onCancel();
          }
          return;
        }

        if (parsed.status === 'requires_each_digit') {
          setStatusMessage(t('pinSayDigits'));
          speakText(t('pinSayDigits'), undefined, language);
          return;
        }

        if (parsed.status === 'too_many') {
          setStatusMessage(t('pinTooMany'));
          setPinDigits(['', '', '', '']);
          speakText(t('pinTooMany'), undefined, language);
          return;
        }

        if (parsed.status === 'need_more' && parsed.digits.length > 0) {
          const newDigits = ['', '', '', ''];
          parsed.digits.forEach((d, i) => {
            if (i < 4) newDigits[i] = d;
          });
          setPinDigits(newDigits);
          setStatusMessage(t('pinNeedMore'));
          return;
        }

        if (parsed.status === 'success' && parsed.digits.length === 4) {
          SpeechService.stopListening();
          setMicState('idle');
          setPinDigits(parsed.digits);
          setStatusMessage(t('pinReceived'));

          // Security Rule: Confirmation speech says ONLY "PIN received", never digits!
          speakText(t('pinReceived'), () => {
            onPinComplete(parsed.digits.join(''));
          }, language);
        }
      },
      onError: (err) => {
        console.warn(`[Voice PIN STT Error on locale ${targetLocale}]:`, err);
        if (err === 'not-allowed' || err === 'Permission denied') {
          setMicState('error');
          const msg = t('micDenied');
          if (setErrorMessage) setErrorMessage(msg);
          speakText(msg, undefined, language);
        } else {
          // Try next locale in fallback chain
          startVoiceRecognition(retryIdx + 1);
        }
      },
      onEnd: () => {
        if (micState === 'listening' && currentPinString.length < 4) {
          setMicState('idle');
        }
      }
    });

    if (!success) {
      setMicState('error');
      const msg = t('micDenied');
      if (setErrorMessage) setErrorMessage(msg);
      speakText(msg, undefined, language);
    }
  };

  const handleMicToggle = () => {
    if (micState === 'listening') {
      SpeechService.stopListening();
      setMicState('idle');
      setStatusMessage(null);
    } else {
      const prompt = t('pinSayDigits');
      speakText(prompt, () => {
        startVoiceRecognition(0);
      }, language);
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
          {title || t('pinEnter4')}
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

      {statusMessage && !errorMessage && (
        <div className="p-2 bg-[#DAF0F7] border border-[#B2E2F0] rounded-xl text-[#0284C7] font-bold text-xs text-center flex items-center justify-center space-x-2 animate-fadeIn">
          <Volume2 className="w-4 h-4 text-[#0284C7] shrink-0 animate-pulse" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* 🚀 VOICE MIC SECTION (PROMINENT TOP BANNER FOR VOICE INPUT) */}
      <div className="bg-slate-50 p-3.5 rounded-2xl border-2 border-[#FF5A1F]/30 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleMicToggle}
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
                ? `${t('pinListening')} (${activeLocale})`
                : micState === 'processing'
                ? 'Processing PIN...'
                : t('useVoice')}
            </span>
            <span className="text-[10px] font-bold text-[#FF5A1F] block">
              💡 {t('pinAnyLang')}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleMicToggle}
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
        🛡️ {t('pinPrivacy')}
      </div>

      {/* 🚀 TOUCH KEYPAD & TEXT ENTRY SECTION (ALWAYS VISIBLE TOGETHER WITH VOICE) */}
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <button
            key={num}
            type="button"
            onClick={() => handleDigitClick(num)}
            className="py-2.5 sm:py-3 rounded-2xl bg-slate-100 hover:bg-[#FF5A1F] hover:text-white text-[#1A1110] font-black text-lg sm:text-xl shadow-xs active:scale-95 transition-all border border-slate-200 cursor-pointer"
          >
            {num}
          </button>
        ))}
        <button
          type="button"
          onClick={handleClear}
          className="py-2.5 sm:py-3 rounded-2xl bg-slate-200 hover:bg-slate-300 text-xs font-black uppercase text-[#4A5568] transition-all cursor-pointer"
        >
          {t('clear')}
        </button>
        <button
          type="button"
          onClick={() => handleDigitClick(0)}
          className="py-2.5 sm:py-3 rounded-2xl bg-slate-100 hover:bg-[#FF5A1F] hover:text-white text-[#1A1110] font-black text-lg sm:text-xl shadow-xs active:scale-95 transition-all border border-slate-200 cursor-pointer"
        >
          0
        </button>
        <button
          type="button"
          onClick={handleBackspace}
          className="py-2.5 sm:py-3 rounded-2xl bg-slate-200 hover:bg-slate-300 text-[#4A5568] flex items-center justify-center transition-all cursor-pointer"
          title={t('back')}
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
            {cancelButtonText || t('pinConfirm.cancel')}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (currentPinString.length === 4) {
              onPinComplete(currentPinString);
            }
          }}
          disabled={isVerifying || currentPinString.length !== 4}
          className={`flex-1 py-3.5 px-4 font-black rounded-xl text-xs sm:text-sm shadow-xl transition-all flex items-center justify-center space-x-2 cursor-pointer ${
            currentPinString.length === 4
              ? 'bg-[#16A34A] hover:bg-[#15803D] text-white shadow-[#16A34A]/40 ring-4 ring-[#16A34A]/30 animate-pulse'
              : 'bg-slate-300 text-slate-500 cursor-not-allowed'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-white" />
          <span>{isVerifying ? 'Verifying...' : submitButtonText || t('pinConfirm.confirmOrderBtn')}</span>
        </button>
      </div>

    </div>
  );
};
