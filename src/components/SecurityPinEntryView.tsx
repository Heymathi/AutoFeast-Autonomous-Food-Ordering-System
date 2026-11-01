import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { SpeechController } from '../services/speechController';
import { parsePinSpeech } from '../services/pinVoiceParserService';
import { Lock, ShieldCheck, Mic, Delete, AlertTriangle, Volume2 } from 'lucide-react';

export interface SecurityPinEntryViewProps {
  title?: string;
  leadPrompt?: string;
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
  belowSubmitContent?: React.ReactNode;
  showCancelButton?: boolean;
}

export const SecurityPinEntryView: React.FC<SecurityPinEntryViewProps> = ({
  title,
  leadPrompt,
  subtitle,
  onPinComplete,
  onCancel,
  isVerifying = false,
  lockSecondsLeft = 0,
  errorMessage = null,
  setErrorMessage,
  submitButtonText,
  cancelButtonText,
  summaryCard,
  belowSubmitContent,
  showCancelButton = false
}) => {
  const { language, t } = useApp();

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
  const onPinCompleteRef = useRef(onPinComplete);
  onPinCompleteRef.current = onPinComplete;
  const isVoiceSubmittingRef = useRef<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);

  const debouncedPinComplete = useRef((pinStr: string) => {
    if (pinStr.length === 4 && !isSubmittingRef.current) {
      isSubmittingRef.current = true;
      isVoiceSubmittingRef.current = false;
      cleanupSpeech();
      Promise.resolve(onPinCompleteRef.current(pinStr)).finally(() => {
        isSubmittingRef.current = false;
      });
    }
  }).current;

  // Auto-submit when all 4 digits filled via keypad/keyboard
  useEffect(() => {
    if (currentPinString.length === 4 && !isVerifying && !isVoiceSubmittingRef.current) {
      cleanupSpeech();
      debouncedPinComplete(currentPinString);
    }
  }, [currentPinString, isVerifying]);

  useEffect(() => {
    if (errorMessage) {
      setPinDigits(['', '', '', '']);
      setStatusMessage(null);
    }
  }, [errorMessage]);

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
    setPinDigits(prev => {
      const emptyIdx = prev.findIndex(d => d === '');
      if (emptyIdx !== -1) {
        const next = [...prev];
        next[emptyIdx] = num.toString();
        return next;
      }
      return prev;
    });
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

  const voicePinRepeatCountRef = useRef<number>(0);

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
      language: language || 'en',
      overrideLocale: targetLocale,
      continuous: false,
      interimResults: true,
      maxAlternatives: 5,
      isPinScreen: true,
      onStart: () => {
        if (isComponentMounted.current) setMicState('listening');
      },
      onResult: (rawTranscript, isFinal, nBestTranscripts) => {
        if (!isComponentMounted.current || !rawTranscript || isVoiceSubmittingRef.current) return;

        const candidates = nBestTranscripts && nBestTranscripts.length > 0 ? nBestTranscripts : [rawTranscript];

        // Echo filter: ignore any transcript equal to or contained in the app's prompt
        const isEcho = candidates.some(cand =>
          activePromptsRef.current.some(prompt => cand.toLowerCase().includes(prompt.toLowerCase().substring(0, 10)))
        );
        if (isEcho) {
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
          if (res.digits.length > parseResult.digits.length) {
            parseResult = res;
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

        // Fill the 4 boxes in real time as digits are recognized
        if (parseResult.digits.length > 0 && parseResult.digits.length <= 4) {
          const previewDigits = ['', '', '', ''];
          parseResult.digits.forEach((d, i) => {
            if (i < 4) previewDigits[i] = d;
          });
          setPinDigits(previewDigits);
        }

        if (parseResult.status === 'success' && parseResult.digits.length === 4) {
          isVoiceSubmittingRef.current = true;
          voicePinRepeatCountRef.current = 0;
          SpeechController.markHandling('voice_pin');
          SpeechController.releaseMic('voice_pin');
          setPinDigits(parseResult.digits);
          setMicState('idle');

          const confirmText = language === 'ta'
            ? 'PIN பெறப்பட்டது'
            : language === 'hi'
            ? 'पिन प्राप्त हुआ'
            : 'PIN received';

          setStatusMessage(confirmText);
          const fullPin = parseResult.digits.join('');

          // Call the exact same verify function as the Verify button!
          debouncedPinComplete(fullPin);
          return;
        }

        if (!isFinal) return;
        setMicState('processing');

        // Wrong length (count != 4) on final transcript: ask ONCE to repeat WITHOUT counting a wrong attempt!
        voicePinRepeatCountRef.current += 1;
        if (voicePinRepeatCountRef.current <= 1) {
          const repeatMsg = (parseResult.status === 'need_more' && parseResult.digits.length > 0)
            ? (language === 'ta' ? 'மீதமுள்ள இலக்கங்களை கூறுங்கள்' : language === 'hi' ? 'शेष अंक कहें' : 'Please say all 4 digits.')
            : (language === 'ta'
              ? 'தயவுசெய்து 4 தனித்தனி இலக்கங்களை கூறவும்.'
              : language === 'hi'
              ? 'कृपया 4 अलग-अलग अंक कहें।'
              : 'Please say 4 single digits.');

          setStatusMessage(repeatMsg);
          SpeechController.speak(
            repeatMsg,
            language || 'en',
            () => {
              if (isComponentMounted.current && !isVoiceSubmittingRef.current) {
                startVoicePinListening(retryIdx);
              }
            },
            undefined,
            'voice_pin'
          );
        } else {
          // After 2 failed voice tries, stop and leave keypad buttons only
          cleanupSpeech();
          const fallbackMsg = language === 'ta'
            ? 'தெளிவாகக் கேட்கவில்லை. தயவுசெய்து எண்களைத் தொடவும்.'
            : language === 'hi'
            ? 'साफ़ सुनाई नहीं दिया। कृपया कीपैड बटन दबाएं।'
            : 'Could not hear 4 digits clearly. Please use the keypad buttons below.';
          setStatusMessage(fallbackMsg);
        }
      },
      onError: (errCode) => {
        if (!isComponentMounted.current) return;
        if (errCode === 'not-allowed') {
          setMicState('error');
          setStatusMessage('Microphone access denied. Please use keypad.');
        } else if (errCode === 'language-not-supported' && retryIdx + 1 < localeChain.length) {
          startVoicePinListening(retryIdx + 1);
        } else {
          setMicState('idle');
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
    if (typeof (SpeechController as any).markUserGesture === 'function') {
      (SpeechController as any).markUserGesture();
    }
    voicePinRepeatCountRef.current = 0;
    if (micState === 'listening') {
      cleanupSpeech();
    } else {
      SpeechController.cancelSpeech();
      startVoicePinListening(0);
    }
  };

  return (
    <div className="space-y-3.5">

      {/* Lock Icon inside pale peach circular background & Heading */}
      <div className="text-center space-y-1.5 pt-1">
        <div className="w-14 h-14 rounded-full bg-[#FCE8E3] border border-[#E9DED5] text-[#D93636] flex items-center justify-center mx-auto shadow-xs">
          <Lock className="w-6 h-6 text-[#D93636]" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-[#302720] tracking-tight">
          {title || t('pinEnter4') || 'Security PIN Verification'}
        </h2>
        {leadPrompt && (
          <p className="text-sm font-bold text-[#302720]">
            {leadPrompt}
          </p>
        )}
        {subtitle && (
          <p className="text-xs font-semibold text-[#786E64]">
            {subtitle}
          </p>
        )}
      </div>

      {/* Optional Summary Card */}
      {summaryCard}

      {/* PIN Digit Displays (4 Boxes - Pale Peach Background with Tomato Red Border & Centered Dots) */}
      <div className="flex justify-center items-center space-x-3 sm:space-x-4 my-2">
        {pinDigits.map((digit, idx) => (
          <div
            key={idx}
            data-testid={`pin-box-${idx}`}
            className={`w-14 h-16 sm:w-16 sm:h-18 rounded-2xl border-2 border-[#D93636] bg-[#FCE8E3] flex items-center justify-center text-3xl font-black text-[#D93636] transition-all shadow-xs ${
              digit ? 'scale-105 shadow-sm' : ''
            }`}
          >
            {digit ? '●' : ''}
          </div>
        ))}
      </div>

      {/* Error & Lockout Alert Box */}
      {errorMessage && (
        <div className="p-3 bg-[#FCE8E3] border-2 border-[#D93636] rounded-2xl text-[#D93636] font-black text-xs text-center flex items-center justify-center space-x-2 animate-fadeIn shadow-xs">
          <AlertTriangle className="w-4 h-4 text-[#D93636] shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {lockSecondsLeft > 0 && (
        <div role="status" className="text-center text-xs font-bold text-[#D93636]">
          {language === 'ta'
            ? `${lockSecondsLeft} வினாடிகளுக்குப் பிறகு மீண்டும் முயற்சிக்கலாம்.`
            : language === 'hi'
            ? `${lockSecondsLeft} सेकंड बाद फिर कोशिश कर सकते हैं।`
            : `Retry becomes available in ${lockSecondsLeft} seconds.`}
        </div>
      )}

      {statusMessage && !errorMessage && (
        <div className="p-2.5 bg-[#FCE8E3] border border-[#E9DED5] rounded-xl text-[#302720] font-bold text-xs text-center flex items-center justify-center space-x-2 animate-fadeIn">
          <Volume2 className="w-4 h-4 text-[#D93636] shrink-0 animate-pulse" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Voice PIN Section */}
      <div className="bg-[#FFFFFF] p-3.5 sm:p-4 rounded-2xl border border-[#E9DED5] flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            data-testid="btn-speak-pin-mic"
            onClick={handleMicToggle}
            disabled={isInputBlocked}
            className={`p-3 rounded-2xl transition-all cursor-pointer shadow-md active:scale-95 shrink-0 ${
              micState === 'listening'
                ? 'bg-[#D93636] text-white animate-pulse ring-4 ring-[#D93636]/30'
                : micState === 'processing'
                ? 'bg-amber-500 text-white animate-bounce'
                : 'bg-[#D93636] text-white hover:bg-[#B9252D]'
            }`}
            title="Tap to speak PIN digits"
          >
            <Mic className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <div className="space-y-0.5 text-left">
            <span className="text-xs font-black uppercase text-[#302720] block">
              {micState === 'listening'
                ? `Listening for PIN... (${activeLocale})`
                : micState === 'processing'
                ? 'Processing PIN...'
                : 'Speak PIN Digits'}
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold text-[#D93636] block">
              💡 Say 4 digits in English, Tamil, or Hindi
            </span>
          </div>
        </div>

        <button
          type="button"
          data-testid="btn-speak-pin-toggle"
          onClick={handleMicToggle}
          disabled={isInputBlocked}
          className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-black text-xs transition-all cursor-pointer shadow-xs ${
            micState === 'listening'
              ? 'bg-[#D93636] text-white border border-[#B9252D]'
              : 'bg-[#FCE8E3] text-[#D93636] hover:bg-[#FCE8E3]/80 border border-[#E9DED5]'
          }`}
        >
          {micState === 'listening' ? 'Stop' : 'Speak PIN'}
        </button>
      </div>

      {/* Privacy Warning Note */}
      <div className="text-[10px] sm:text-[11px] font-semibold text-[#786E64] text-center px-3 py-2 bg-[#FCE8E3]/60 rounded-xl border border-[#E9DED5]">
        🛡️ Voice PIN security: Digits are never logged, displayed, or spoken aloud.
      </div>

      {/* 3-Column Numeric Keypad Buttons */}
      <div className="p-3.5 sm:p-4 bg-[#FCE8E3] rounded-3xl border border-[#E9DED5]">
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              type="button"
              data-testid={`keypad-digit-${num}`}
              onClick={() => handleDigitClick(num)}
              disabled={isInputBlocked}
              className="py-3 sm:py-3.5 rounded-2xl bg-[#FFFFFF] hover:bg-[#D93636] hover:text-white text-[#302720] font-black text-lg sm:text-xl shadow-xs active:scale-95 transition-all border border-[#E9DED5] cursor-pointer"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            disabled={isInputBlocked}
            className="py-3 sm:py-3.5 rounded-2xl bg-[#FFFFFF] hover:bg-[#D93636] hover:text-white text-xs font-black uppercase text-[#D93636] border border-[#E9DED5] transition-all cursor-pointer shadow-xs active:scale-95"
          >
            Clear
          </button>
          <button
            type="button"
            data-testid="keypad-digit-0"
            onClick={() => handleDigitClick(0)}
            disabled={isInputBlocked}
            className="py-3 sm:py-3.5 rounded-2xl bg-[#FFFFFF] hover:bg-[#D93636] hover:text-white text-[#302720] font-black text-lg sm:text-xl shadow-xs active:scale-95 transition-all border border-[#E9DED5] cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            disabled={isInputBlocked}
            className="py-3 sm:py-3.5 rounded-2xl bg-[#FFFFFF] hover:bg-[#D93636] hover:text-white text-[#786E64] flex items-center justify-center border border-[#E9DED5] transition-all cursor-pointer shadow-xs active:scale-95"
            title="Backspace"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Primary Action Button (Full Width Tomato Red) & Below Content */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center gap-2">
          {showCancelButton && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-1/3 py-3.5 px-3 bg-[#FFFFFF] hover:bg-[#FCE8E3] text-[#302720] font-black rounded-2xl text-xs transition-all border border-[#E9DED5] cursor-pointer text-center shadow-xs"
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
            className={`w-full py-3.5 sm:py-4 px-4 font-black rounded-2xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer ${
              currentPinString.length === 4 && !isInputBlocked
                ? 'bg-[#D93636] hover:bg-[#B9252D] text-white shadow-[#D93636]/30 active:scale-[0.99]'
                : 'bg-[#F7F3EB] text-[#786E64] border border-[#E9DED5] cursor-not-allowed opacity-75'
            }`}
          >
            <ShieldCheck className="w-5 h-5 shrink-0" />
            <span>
              {isVerifying
                ? 'Verifying...'
                : lockSecondsLeft > 0
                  ? language === 'ta'
                    ? `${lockSecondsLeft} வினாடிகளுக்குப் பிறகு மீண்டும் முயற்சிக்கவும்`
                    : language === 'hi'
                      ? `${lockSecondsLeft} सेकंड बाद फिर कोशिश करें`
                      : `Retry in ${lockSecondsLeft}s`
                  : submitButtonText || 'Verify PIN'}
            </span>
          </button>
        </div>
        {belowSubmitContent}
      </div>

    </div>
  );
};
