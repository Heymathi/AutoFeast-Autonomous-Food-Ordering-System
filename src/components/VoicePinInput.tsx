import { useEffect, useRef, useState } from 'react';
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
  autoStart?: boolean;
  disabled?: boolean;
}

export const VoicePinInput: React.FC<VoicePinInputProps> = ({
  language,
  owner,
  purpose,
  onPinChange,
  autoStart = false,
  disabled = false
}) => {
  const [isListening, setIsListening] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const isMounted = useRef(false);

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

  const startListening = () => {
    if (disabled) return;
    if (!SpeechController.isSupported()) {
      const message = language === 'ta'
        ? 'இந்த உலாவியில் குரல் அடையாளம் கிடைக்கவில்லை. PIN-ஐ தட்டச்சு செய்யவும்.'
        : language === 'hi'
        ? 'इस ब्राउज़र में आवाज़ पहचान उपलब्ध नहीं है। पिन टाइप करें।'
        : 'Voice recognition is unavailable in this browser. Please type the PIN.';
      setStatusMessage(message);
      SpeechController.speak(message, language, undefined, undefined, owner);
      return;
    }

    setStatusMessage('');
    setIsListening(true);
    SpeechController.speak(getPrompt(), language, () => {
      if (!isMounted.current || disabled) return;
      SpeechController.requestMic({
        owner,
        language,
        continuous: true,
        interimResults: true,
        maxAlternatives: 5,
        isPinScreen: true,
        onStart: () => {
          if (isMounted.current) setIsListening(true);
        },
        onResult: (transcript, isFinal, alternatives) => {
          if (!isMounted.current || !isFinal || !transcript) return;
          const candidates = alternatives?.length ? alternatives : [transcript];
          const parsed = candidates
            .map(candidate => parsePinSpeech(candidate, language))
            .find(result => result.status === 'success' && result.digits.length === 4);

          if (parsed) {
            SpeechController.releaseMic(owner);
            setIsListening(false);
            setStatusMessage(language === 'ta'
              ? 'PIN பெறப்பட்டது.'
              : language === 'hi'
              ? 'पिन प्राप्त हुआ।'
              : 'PIN received.');
            onPinChange(parsed.digits.join(''));
            SpeechController.speak(
              language === 'ta' ? 'PIN பெறப்பட்டது.' : language === 'hi' ? 'पिन प्राप्त हुआ।' : 'PIN received.',
              language,
              undefined,
              undefined,
              owner
            );
          } else {
            const message = language === 'ta'
              ? 'நான்கு இலக்கங்களையும் தனித்தனியாகக் கூறுங்கள்.'
              : language === 'hi'
              ? 'कृपया चारों अंक अलग-अलग बोलें।'
              : 'Please say all four digits individually.';
            setStatusMessage(message);
            SpeechController.speak(message, language, undefined, undefined, owner);
          }
        },
        onError: (_code, message) => {
          if (!isMounted.current) return;
          setIsListening(false);
          setStatusMessage(message);
          SpeechController.speak(message, language, undefined, undefined, owner);
        },
        onEnd: () => {
          if (isMounted.current) setIsListening(false);
        }
      });
    }, undefined, owner);
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
          if (isListening) {
            SpeechController.releaseMic(owner);
            setIsListening(false);
          } else {
            startListening();
          }
        }}
        className="inline-flex items-center gap-2 rounded-lg border border-[#FF5A1F]/50 px-3 py-2 text-xs font-bold text-[#C2410C] hover:bg-[#FF5A1F]/10 disabled:opacity-50"
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
