import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Language } from '../types';
import { SpeechService } from '../services/speechService';
import { SttMatcherService } from '../services/sttMatcherService';
import { Sparkles, Globe, Volume2, Mic, CheckCircle2 } from 'lucide-react';

export const LanguageSelectionModal: React.FC = () => {
  const {
    entryStep,
    isLanguageModalOpen,
    handleLanguageSelected,
    speakText,
    language: currentLanguage,
    setLanguage,
    currentUser
  } = useApp();

  const [isListening, setIsListening] = useState(false);
  const [selectedTemp, setSelectedTemp] = useState<Language | null>(currentLanguage || 'en');
  const [liveTranscript, setLiveTranscript] = useState('');
  const hasSpokenWelcomeRef = useRef(false);

  const hasProceededRef = useRef(false);

  // Sync selectedTemp with currentLanguage when component mounts or currentLanguage changes
  useEffect(() => {
    if (currentLanguage) {
      setSelectedTemp(currentLanguage);
    }
  }, [currentLanguage]);

  // Reset hasProceededRef when modal opens
  useEffect(() => {
    if (entryStep === 'language' || isLanguageModalOpen) {
      hasProceededRef.current = false;
    }
  }, [entryStep, isLanguageModalOpen]);

  /**
   * Speak personalized welcome out loud immediately on load + start mic listening automatically
   */
  useEffect(() => {
    if ((entryStep === 'language' || isLanguageModalOpen) && !hasSpokenWelcomeRef.current) {
      hasSpokenWelcomeRef.current = true;
      const userName = currentUser?.name || 'User';
      const welcomePrompt =
        `Welcome ${userName}! Please select your preferred language. Say Tamil, Hindi, or English. ` +
        `வணக்கம் ${userName}! உங்கள் விருப்பமான மொழியைத் தேர்ந்தெடுக்கவும். தமிழ் அல்லது ஆங்கிலம் என்று சொல்லுங்கள்.`;

      console.log('[Language Selection Modal]: Auto-speaking welcome prompt & opening voice listener -> Prompt:', welcomePrompt);

      let fallbackTimer: NodeJS.Timeout | null = null;
      // 1. Immediately trigger TTS spoken prompt
      speakText(welcomePrompt, () => {
        if (fallbackTimer) clearTimeout(fallbackTimer);
        // Automatically start voice listening after welcome TTS finishes
        startLanguageVoiceListening();
      });

      // 2. Safety Fallback: Ensure mic starts listening even if browser postpones TTS autoplay
      fallbackTimer = setTimeout(() => {
        if (!SpeechService.getIsListening()) {
          startLanguageVoiceListening();
        }
      }, 8000);

      return () => {
        if (fallbackTimer) clearTimeout(fallbackTimer);
      };
    }
  }, [entryStep, isLanguageModalOpen, currentUser]);

  const startLanguageVoiceListening = () => {
    if (!SpeechService.isSupported() || hasProceededRef.current) return;

    setIsListening(true);

    SpeechService.startListening({
      language: currentLanguage || 'en',
      continuous: true,
      interimResults: true,
      onResult: (transcript, isFinal, nBestTranscripts) => {
        if (!transcript || hasProceededRef.current) return;
        setLiveTranscript(transcript);
        console.log('[Language Selection Voice Transcript]:', transcript, '(isFinal:', isFinal, ')');

        if (!isFinal) return; // Update live transcript UI; execute language selection on final speech result only

        const candidates = nBestTranscripts && nBestTranscripts.length > 0 ? nBestTranscripts : [transcript];
        const matchResult = SttMatcherService.matchLanguageChoice(candidates);

        if (matchResult.isMatched && matchResult.matchedValue) {
          console.log(`🎙️ [LanguageSelection STT Match via SttMatcherService]: Matched -> "${matchResult.matchedValue}" (confidence: ${matchResult.confidence})`);
          handleChooseLanguage(matchResult.matchedValue, true);
        }
      },
      onError: (err) => {
        setIsListening(false);
        console.warn('Language selection speech error:', err);
      },
      onEnd: () => {
        setIsListening(false);
        // Automatically restart speech listener if modal remains open and selection hasn't completed
        if ((entryStep === 'language' || isLanguageModalOpen) && !hasProceededRef.current) {
          setTimeout(() => {
            if ((entryStep === 'language' || isLanguageModalOpen) && !hasProceededRef.current) {
              startLanguageVoiceListening();
            }
          }, 400);
        }
      }
    });
  };

  const autoProceedWithLanguage = (lang: Language) => {
    if (hasProceededRef.current) return;
    hasProceededRef.current = true;
    SpeechService.stopListening();
    setIsListening(false);
    console.log(`🚀 [LanguageSelectionModal]: Auto-advancing to welcome step with language: "${lang}"`);
    handleLanguageSelected(lang);
  };

  const handleChooseLanguage = (lang: Language, isSpoken: boolean = false) => {
    if (hasProceededRef.current) return;
    console.log(`[LanguageSelectionModal]: Switching active language to "${lang}" (isSpoken: ${isSpoken}) -> Will auto-proceed`);
    SpeechService.stopListening();
    setIsListening(false);
    setSelectedTemp(lang);
    setLanguage(lang);

    // Speak brief voice confirmation in newly selected language, then auto-proceed immediately
    const confirmMsg = lang === 'ta'
      ? 'தமிழ் மொழி தேர்ந்தெடுக்கப்பட்டது.'
      : lang === 'hi'
      ? 'हिंदी भाषा चुनी गई।'
      : 'English language selected.';

    let safeTimer: NodeJS.Timeout | null = null;
    const doAdvance = () => {
      if (safeTimer) clearTimeout(safeTimer);
      autoProceedWithLanguage(lang);
    };

    speakText(confirmMsg, doAdvance, lang);
    safeTimer = setTimeout(doAdvance, 3500);
  };

  const handleProceedWithLanguage = () => {
    const targetLang = selectedTemp || currentLanguage || 'en';
    autoProceedWithLanguage(targetLang);
  };

  if (entryStep !== 'language' && !isLanguageModalOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-lg animate-fade-in">
      <div className="w-full max-w-xl bg-white text-[#1A1110] rounded-3xl shadow-2xl overflow-hidden border-4 border-[#FF5A1F] transition-all transform scale-100">

        {/* Top Branding Banner */}
        <div className="bg-[#DAF0F7] p-6 text-center border-b border-[#B2E2F0]">
          <div className="inline-flex items-center justify-center p-3.5 bg-white rounded-2xl mb-3 shadow-md border border-[#B2E2F0]">
            <Sparkles className="w-8 h-8 text-[#FF5A1F] mr-2 animate-pulse" />
            <h1 className="text-3xl font-black text-[#1A1110] tracking-tight">AutoFeast AI</h1>
          </div>

          <p className="text-xs font-black text-[#FF5A1F] uppercase tracking-widest flex items-center justify-center gap-1">
            <Globe className="w-4 h-4" />
            <span>Select Your Preferred Language / மொழியைத் தேர்ந்தெடுக்கவும்</span>
          </p>

          <div className="mt-3 space-y-1 text-xs font-bold text-[#4A5568]">
            <p>🇬🇧 Say "English", "Tamil", or "Hindi"</p>
            <p>🇮🇳 "தமிழ்", "ஆங்கிலம்" அல்லது "ஹிந்தி" என்று சொல்லுங்கள்</p>
          </div>
        </div>

        {/* Language Options Cards Container */}
        <div className="p-6 sm:p-8 space-y-4">

          {/* Voice Listening Active Status Badge */}
          <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs shadow-xs">
            <div className="flex items-center space-x-2">
              <Volume2 className="w-5 h-5 text-[#FF5A1F] animate-bounce shrink-0" />
              <span className="font-extrabold text-[#1A1110]">
                {liveTranscript
                  ? `🎙️ Spoken: "${liveTranscript}"`
                  : isListening
                  ? '🎙️ Listening... Say "Tamil", "English", or "Hindi"'
                  : '🔊 Speak or tap your preferred language'}
              </span>
            </div>
            <button
              type="button"
              onClick={startLanguageVoiceListening}
              className="px-3 py-1.5 bg-[#FF5A1F] text-white rounded-xl font-bold flex items-center space-x-1 shadow-xs hover:bg-[#E04812] cursor-pointer shrink-0"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Voice</span>
            </button>
          </div>

          {/* 3 Interactive Language Cards (Tap or Voice) */}
          <div className="grid grid-cols-1 gap-4 pt-2">

            {/* Option 1: Tamil */}
            <button
              type="button"
              onClick={() => handleChooseLanguage('ta')}
              className={`p-5 rounded-2xl border-3 flex items-center justify-between transition-all cursor-pointer text-left ${
                selectedTemp === 'ta' || currentLanguage === 'ta'
                  ? 'border-[#FF5A1F] bg-[#FF5A1F]/10 shadow-lg scale-102'
                  : 'border-[#DAF0F7] bg-slate-50 hover:bg-[#DAF0F7]/40 hover:border-[#B2E2F0]'
              }`}
            >
              <div className="flex items-center space-x-4">
                <span className="text-4xl">🇮🇳</span>
                <div>
                  <h3 className="text-xl font-black text-[#1A1110]">தமிழ் (Tamil)</h3>
                  <p className="text-xs font-bold text-[#4A5568]">முழுமையான குரல் வழி வழிகாட்டுதலுடன் தமிழ்</p>
                </div>
              </div>
              <div className="p-2 bg-white rounded-full border border-slate-200">
                <CheckCircle2 className={`w-6 h-6 ${selectedTemp === 'ta' ? 'text-[#FF5A1F]' : 'text-slate-300'}`} />
              </div>
            </button>

            {/* Option 2: English */}
            <button
              type="button"
              onClick={() => handleChooseLanguage('en')}
              className={`p-5 rounded-2xl border-3 flex items-center justify-between transition-all cursor-pointer text-left ${
                selectedTemp === 'en' || currentLanguage === 'en'
                  ? 'border-[#FF5A1F] bg-[#FF5A1F]/10 shadow-lg scale-102'
                  : 'border-[#DAF0F7] bg-slate-50 hover:bg-[#DAF0F7]/40 hover:border-[#B2E2F0]'
              }`}
            >
              <div className="flex items-center space-x-4">
                <span className="text-4xl">🇬🇧</span>
                <div>
                  <h3 className="text-xl font-black text-[#1A1110]">English</h3>
                  <p className="text-xs font-bold text-[#4A5568]">Full English voice assistance & natural interaction</p>
                </div>
              </div>
              <div className="p-2 bg-white rounded-full border border-slate-200">
                <CheckCircle2 className={`w-6 h-6 ${selectedTemp === 'en' ? 'text-[#FF5A1F]' : 'text-slate-300'}`} />
              </div>
            </button>

            {/* Option 3: Hindi */}
            <button
              type="button"
              onClick={() => handleChooseLanguage('hi')}
              className={`p-5 rounded-2xl border-3 flex items-center justify-between transition-all cursor-pointer text-left ${
                selectedTemp === 'hi' || currentLanguage === 'hi'
                  ? 'border-[#FF5A1F] bg-[#FF5A1F]/10 shadow-lg scale-102'
                  : 'border-[#DAF0F7] bg-slate-50 hover:bg-[#DAF0F7]/40 hover:border-[#B2E2F0]'
              }`}
            >
              <div className="flex items-center space-x-4">
                <span className="text-4xl">🇮🇳</span>
                <div>
                  <h3 className="text-xl font-black text-[#1A1110]">हिन्दी (Hindi)</h3>
                  <p className="text-xs font-bold text-[#4A5568]">पूर्ण आवाज सहायता के साथ हिंदी भाषा</p>
                </div>
              </div>
              <div className="p-2 bg-white rounded-full border border-slate-200">
                <CheckCircle2 className={`w-6 h-6 ${selectedTemp === 'hi' ? 'text-[#FF5A1F]' : 'text-slate-300'}`} />
              </div>
            </button>

          </div>

          {/* Action Button: Proceed to Welcome */}
          <button
            type="button"
            onClick={handleProceedWithLanguage}
            className="w-full py-4 px-6 bg-[#FF5A1F] hover:bg-[#E04812] text-white font-black rounded-2xl text-base shadow-lg shadow-[#FF5A1F]/30 transition-transform active:scale-95 flex items-center justify-center space-x-2 cursor-pointer mt-4"
          >
            <span>
              {currentLanguage === 'ta'
                ? 'தொடரவும் (Proceed)'
                : currentLanguage === 'hi'
                ? 'आगे बढ़ें (Proceed)'
                : 'Continue with Selected Language'}
            </span>
          </button>

        </div>

      </div>
    </div>
  );
};
