import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { SpeechService } from '../services/speechService';
import { LlmNluService } from '../services/llmNluService';
import { SttMatcherService } from '../services/sttMatcherService';
import { MapPin, Navigation, CheckCircle2, XCircle, Mic, Volume2, Sparkles } from 'lucide-react';

export const LocationPermissionModal: React.FC = () => {
  const {
    entryStep,
    language,
    speakText,
    handleLocationPermissionResponse
  } = useApp();

  const [isListening, setIsListening] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [clarificationText, setClarificationText] = useState<string | null>(null);
  const hasPromptedRef = useRef(false);

  useEffect(() => {
    if (entryStep === 'location_permission' && !hasPromptedRef.current) {
      hasPromptedRef.current = true;
      setLiveTranscript('');

      let locationPrompt = '';
      if (language === 'ta') {
        locationPrompt = 'அருகிலுள்ள உணவகங்களைக் கண்டறிய உங்கள் இருப்பிடத்தைப் பயன்படுத்தலாமா? அனுமதி அல்லது வேண்டாம் என்று சொல்லுங்கள்.';
      } else if (language === 'hi') {
        locationPrompt = 'क्या हम पास के रेस्तरां खोजने के लिए आपके स्थान तक पहुंच सकते हैं? अनुमति या मना करें बोलें।';
      } else {
        locationPrompt = 'Can we access your location to find nearby restaurants? Say Allow or Deny out loud.';
      }

      console.log('[LocationPermissionModal]: Auto-speaking location access prompt in language:', language, 'Prompt:', locationPrompt);

      let fallbackTimer: NodeJS.Timeout | null = null;
      speakText(locationPrompt, () => {
        if (fallbackTimer) clearTimeout(fallbackTimer);
        startVoiceListening();
      }, language);

      fallbackTimer = setTimeout(() => {
        if (!SpeechService.getIsListening()) {
          startVoiceListening();
        }
      }, 7000);

      return () => {
        if (fallbackTimer) clearTimeout(fallbackTimer);
      };
    }
  }, [entryStep, language]);

  const startVoiceListening = () => {
    if (!SpeechService.isSupported()) return;

    setIsListening(true);
    setLiveTranscript('');
    setClarificationText(null);

    SpeechService.startListening({
      language,
      continuous: true,
      interimResults: true,
      onResult: async (transcript, isFinal, nBestTranscripts) => {
        if (!transcript || !transcript.trim()) return;
        setLiveTranscript(transcript);

        if (!isFinal) return; // Wait for final speech utterance

        console.log('[LocationPermissionModal Spoken Transcript]:', transcript);
        setIsListening(false);
        SpeechService.stopListening();
        setIsAnalyzing(true);

        const candidates = nBestTranscripts && nBestTranscripts.length > 0 ? nBestTranscripts : [transcript];
        const matchResult = SttMatcherService.matchConfirmation(candidates, language);
        console.log('🚀 [LocationPermissionModal SttMatcherResult]:', matchResult);

        let intent: 'ALLOW' | 'DENY' | 'AMBIGUOUS' = 'AMBIGUOUS';

        if (matchResult.isMatched) {
          intent = matchResult.matchedValue === 'YES' ? 'ALLOW' : matchResult.matchedValue === 'NO' ? 'DENY' : 'AMBIGUOUS';
        } else {
          // Fallback to LLM NLU Service
          const nluResult = await LlmNluService.interpretLocationPermissionIntent(transcript, language);
          intent = nluResult.intent;
        }

        setIsAnalyzing(false);

        if (intent === 'ALLOW') {
          console.log('[LocationPermissionModal]: Intent = ALLOW -> Granting GPS location access');
          handleLocationPermissionResponse(true);
        } else if (intent === 'DENY') {
          console.log('[LocationPermissionModal]: Intent = DENY -> Declining GPS access, opening manual address entry');
          handleLocationPermissionResponse(false);
        } else {
          // AMBIGUOUS: Do NOT guess! Ask user to clarify by repeating question
          console.warn('[LocationPermissionModal]: Intent = AMBIGUOUS -> Prompting user for clarification');
          const clarifyPrompt = matchResult.clarificationPrompt || (language === 'ta'
            ? 'மன்னிக்கவும், தெளிவாகப் புரியவில்லை. இருப்பிட அனுமதி தருவீர்களா? அனுமதி அல்லது வேண்டாம் என்று சொல்லுங்கள்.'
            : language === 'hi'
            ? 'क्षमा करें, स्पष्ट रूप से समझ नहीं आया। क्या आप स्थान अनुमति देना चाहते हैं? अनुमति या मना करें बोलें।'
            : "Sorry, I didn't catch if you want to allow or deny location access. Please say Allow or Deny clearly.");

          setClarificationText(clarifyPrompt);
          speakText(clarifyPrompt, () => {
            if (entryStep === 'location_permission') {
              startVoiceListening();
            }
          }, language);
        }
      },
      onError: (err) => {
        setIsListening(false);
        setIsAnalyzing(false);
        console.warn('Location permission voice error:', err);
      },
      onEnd: () => {
        setIsListening(false);
        if (entryStep === 'location_permission' && !isAnalyzing) {
          setTimeout(() => {
            if (entryStep === 'location_permission' && !isAnalyzing) {
              startVoiceListening();
            }
          }, 400);
        }
      }
    });
  };

  if (entryStep !== 'location_permission') return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-white text-[#1A1110] rounded-3xl p-6 sm:p-8 shadow-2xl border-4 border-[#FF5A1F] text-center space-y-6 transform scale-100">
        
        {/* Header Icon */}
        <div className="inline-flex p-4 bg-[#DAF0F7] rounded-full border-2 border-[#B2E2F0] text-[#FF5A1F]">
          <MapPin className="w-10 h-10 animate-bounce text-[#FF5A1F]" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-black uppercase tracking-widest text-[#FF5A1F] bg-[#FF5A1F]/10 px-3 py-1 rounded-full border border-[#FF5A1F]/30">
            {language === 'ta' ? 'இருப்பிட அனுமதி' : language === 'hi' ? 'स्थान अनुमति' : 'Step 4: Location Permission'}
          </span>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-[#1A1110]">
            {language === 'ta'
              ? 'அருகிலுள்ள உணவகங்களைக் கண்டறிய இருப்பிடத்தைப் பயன்படுத்தலாமா?'
              : language === 'hi'
              ? 'क्या हम पास के रेस्तरां खोजने के लिए आपके स्थान का उपयोग कर सकते हैं?'
              : 'Can we access your location to find nearby restaurants?'}
          </h2>

          <p className="text-xs font-bold text-[#4A5568] max-w-md mx-auto">
            {language === 'ta'
              ? 'லைவ் ஜிபிஎஸ் இருப்பிடம் மிக வேகமான டெலிவரி மற்றும் துல்லியமான உணவகப் பரிந்துரைகளுக்கு உதவுகிறது.'
              : language === 'hi'
              ? 'लाइव जीपीएस स्थान निकटतम डिलीवरी और सटीक रेस्तरां सुझावों के लिए मदद करता है।'
              : 'Live GPS location powers accurate distance sorting, fast delivery tracking & nearest restaurant suggestions.'}
          </p>
        </div>

        {/* Voice Listening / NLU Analyzing Status Card */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between text-xs font-black">
          <div className="flex items-center space-x-2 text-[#1A1110]">
            <Volume2 className="w-4 h-4 text-[#FF5A1F] animate-pulse" />
            <span>
              {isAnalyzing
                ? '🤖 NLU AI Analyzing Intent...'
                : isListening
                ? (language === 'ta' ? 'தானியங்கியாகக் கேட்கிறது: "அனுமதி", "ஆமா", "சரி" / "வேண்டாம்"' : 'Listening automatically: Say "Allow" or "Deny"')
                : (language === 'ta' ? 'குரல் உள்ளீடு தயார்' : 'Voice Assistant Ready')}
            </span>
          </div>
          <button
            type="button"
            onClick={startVoiceListening}
            className="px-3 py-1.5 bg-[#FF5A1F] text-white rounded-xl font-bold text-[11px] shadow-xs hover:bg-[#E04812] cursor-pointer flex items-center space-x-1"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Speak</span>
          </button>
        </div>

        {liveTranscript && (
          <p className="text-xs text-center text-emerald-600 font-black">
            🎙️ Detected Speech: "{liveTranscript}"
          </p>
        )}

        {clarificationText && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 font-bold text-xs text-center">
            {clarificationText}
          </div>
        )}

        {/* Action Buttons: Allow vs Deny */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          
          <button
            type="button"
            onClick={() => {
              SpeechService.stopListening();
              handleLocationPermissionResponse(false);
            }}
            className="w-full sm:w-1/3 py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-[#4A5568] font-black rounded-2xl text-xs sm:text-sm transition-all border border-slate-300 flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <XCircle className="w-4 h-4 text-red-500" />
            <span>
              {language === 'ta' ? 'வேண்டாம் (Deny)' : language === 'hi' ? 'मना करें (Deny)' : 'Deny / Skip'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              SpeechService.stopListening();
              handleLocationPermissionResponse(true);
            }}
            className="w-full sm:w-2/3 py-3.5 px-6 bg-[#16A34A] hover:bg-[#15803D] text-white font-black rounded-2xl text-sm sm:text-base shadow-lg shadow-[#16A34A]/30 transition-transform active:scale-95 flex items-center justify-center space-x-2 cursor-pointer ring-4 ring-[#16A34A]/20"
          >
            <CheckCircle2 className="w-5 h-5 text-white" />
            <span>
              {language === 'ta' ? 'அனுமதி (Allow GPS Location)' : language === 'hi' ? 'अनुमति दें (Allow GPS)' : 'Allow Location Access'}
            </span>
          </button>

        </div>

      </div>
    </div>
  );
};
