import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { Language } from '../types';
import { SpeechController } from '../services/speechController';
import { parsePinSpeech } from '../services/pinVoiceParserService';

interface VoicePinInputProps {
  language: Language;
  owner: string;
  purpose: 'account' | 'nominee';
  onPinChange: (pin: string) => void;
  onPinComplete?: (pin: string) => void;
  autoStart?: boolean;
  disabled?: boolean;
}

export const VoicePinInput: React.FC<VoicePinInputProps> = ({
  language,
  owner,
  purpose,
  onPinChange,
  onPinComplete,
  autoStart = false,
  disabled = false
}) => {
  const [isListening, setIsListening] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const isMounted = useRef(false);
  const repeatCountRef = useRef(0);
  const completedRef = useRef(false);

  const getPrompt = () => {
    if (purpose === 'nominee') {
      return language === 'ta'
        ? 'உங்கள் நான்கு இலக்க nominee பாதுகாப்பு PIN-ஐ கூறுங்கள்.'
        : language === 'hi'
        ? 'अपना चार अंकों का नामांकित सुरक्षा पिन बोलें।'
        : 'Please say your four-digit nominee security PIN.';
    }
    return language === 'ta'
      ? 'உங்கள் நான்கு இலக்க பாதுகாப்பு PIN-ஐ கூறுங்கள்.'
      : language === 'hi'
      ? 'अपना चार अंकों का सुरक्षा पिन बोलें।'
      : 'Please say your four-digit security PIN.';
  };

  const listenForPinDigits = () => {
    if (!isMounted.current || disabled || completedRef.current) return;
    SpeechController.requestMic({
      owner,
      language,
      continuous: false,
      interimResults: true,
      maxAlternatives: 5,
      isPinScreen: true,
      onStart: () => {
        if (isMounted.current) setIsListening(true);
      },
      onResult: (transcript, isFinal, alternatives) => {
        if (!isMounted.current || !transcript || completedRef.current) return;
        const candidates = alternatives?.length ? alternatives : [transcript];

        // Check for complete 4 digits across candidates
        const fullMatch = candidates
          .map(candidate => parsePinSpeech(candidate, language))
          .find(result => result.status === 'success' && result.digits.length === 4);

        if (fullMatch) {
          completedRef.current = true;
          const pinStr = fullMatch.digits.join('');
          SpeechController.markHandling(owner);
          SpeechController.releaseMic(owner);
          setIsListening(false);
          const receivedMsg = language === 'ta'
            ? 'PIN பெறப்பட்டது.'
            : language === 'hi'
            ? 'पिन प्राप्त हुआ।'
            : 'PIN received.';
          setStatusMessage(receivedMsg);
          onPinChange(pinStr);
          if (onPinComplete) {
            onPinComplete(pinStr);
          }
          return;
        }

        // Fill partial boxes as digits are recognized
        const partialMatch = candidates
          .map(candidate => parsePinSpeech(candidate, language))
          .find(result => result.digits.length > 0 && result.digits.length < 4);
        if (partialMatch) {
          onPinChange(partialMatch.digits.join(''));
        }

        if (!isFinal) return;

        // Wrong length (count != 4) on final result: ask ONCE to repeat without counting a wrong attempt
        repeatCountRef.current += 1;
        if (repeatCountRef.current <= 1) {
          const repeatMsg = language === 'ta'
            ? 'நான்கு இலக்கங்களையும் தனித்தனியாகக் கூறுங்கள்.'
            : language === 'hi'
            ? 'कृपया चारों अंक अलग-अलग बोलें।'
            : 'Please say all four digits individually.';
          setStatusMessage(repeatMsg);
          SpeechController.speak(
            repeatMsg,
            language,
            () => {
              if (isMounted.current && !disabled && !completedRef.current) {
                listenForPinDigits();
              }
            },
            undefined,
            owner,
            `${owner}_repeat`
          );
        } else {
          SpeechController.releaseMic(owner);
          setIsListening(false);
          const fallbackMsg = language === 'ta'
            ? 'தெளிவாகக் கேட்கவில்லை. தயவுசெய்து PIN-ஐ தட்டச்சு செய்யவும்.'
            : language === 'hi'
            ? 'साफ़ सुनाई नहीं दिया। कृपया पिन टाइप करें।'
            : 'Could not hear 4 digits clearly. Please enter your PIN using the buttons.';
          setStatusMessage(fallbackMsg);
        }
      },
      onError: (_code, message) => {
        if (!isMounted.current) return;
        setIsListening(false);
        setStatusMessage(message);
      },
      onEnd: () => {
        if (isMounted.current) setIsListening(false);
      }
    });
  };

  const startListening = () => {
    if (disabled) return;
    SpeechController.markUserGesture();
    completedRef.current = false;
    repeatCountRef.current = 0;

    if (!SpeechController.isSupported()) {
      const message = language === 'ta'
        ? 'இந்த உலாவியில் குரல் அடையாளம் கிடைக்கவில்லை. PIN-ஐ தட்டச்சு செய்யவும்.'
        : language === 'hi'
        ? 'इस ब्राउज़र में आवाज़ पहचान उपलब्ध नहीं है। पिन टाइप करें।'
        : 'Voice recognition is unavailable in this browser. Please type the PIN.';
      setStatusMessage(message);
      return;
    }

    setStatusMessage('');
    setIsListening(true);
    SpeechController.speak(
      getPrompt(),
      language,
      () => {
        listenForPinDigits();
      },
      undefined,
      owner,
      `${owner}_prompt`
    );
  };

  useEffect(() => {
    isMounted.current = true;
    if (autoStart) startListening();
    return () => {
      isMounted.current = false;
      SpeechController.releaseMic(owner);
    };
  }, []);

  useEffect(() => {
    if (disabled) {
      SpeechController.releaseMic(owner);
      setIsListening(false);
    }
  }, [disabled, owner]);

  const buttonLabel = language === 'ta' ? 'PIN பேசுங்கள்' : language === 'hi' ? 'पिन बोलें' : 'Speak PIN';

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        disabled={disabled}
        aria-pressed={isListening}
        onClick={() => {
          SpeechController.markUserGesture();
          if (isListening) {
            SpeechController.releaseMic(owner);
            setIsListening(false);
          } else {
            startListening();
          }
        }}
        className="inline-flex items-center gap-2 rounded-lg border border-[#D93636]/50 px-3 py-2 text-xs font-bold text-[#C2410C] hover:bg-[#D93636]/10 disabled:opacity-50"
      >
        {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        {buttonLabel}
      </button>
      {statusMessage && (
        <p role="status" className="text-xs font-semibold text-slate-600">
          {statusMessage}
        </p>
      )}
    </div>
  );
};
