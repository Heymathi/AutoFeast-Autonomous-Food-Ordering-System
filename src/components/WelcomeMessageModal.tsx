import React, { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Sparkles, Heart, CheckCircle2, ArrowRight } from 'lucide-react';

export const WelcomeMessageModal: React.FC = () => {
  const {
    entryStep,
    language,
    currentUser,
    speakText,
    handleWelcomeComplete
  } = useApp();

  const isSpokenRef = useRef(false);

  useEffect(() => {
    if (entryStep === 'welcome' && !isSpokenRef.current) {
      isSpokenRef.current = true;
      const userName = currentUser?.name || 'Friend';

      let welcomeMsg = '';
      if (language === 'ta') {
        welcomeMsg = `AutoFeast-க்கு வரவேற்கிறோம், ${userName}! உங்கள் சுவையான உணவை ஆர்டர் செய்ய அல்லது அட்டவணைப்படுத்தத் தயார்.`;
      } else if (language === 'hi') {
        welcomeMsg = `AutoFeast में आपका स्वागत है, ${userName}! अपना पसंदीदा भोजन ऑर्डर या शेड्यूल करें।`;
      } else {
        welcomeMsg = `Welcome to AutoFeast, ${userName}! Ready to order or schedule your favorite meal.`;
      }

      console.log('[WelcomeMessageModal]: Auto-speaking FULL welcome message in language:', language, 'Msg:', welcomeMsg);

      let timer: NodeJS.Timeout | null = null;
      speakText(welcomeMsg, () => {
        if (timer) clearTimeout(timer);
        console.log('[WelcomeMessageModal]: Welcome TTS playback finished completely. Auto-advancing to location step...');
        setTimeout(() => {
          handleWelcomeComplete();
        }, 600);
      }, language);

      // Generous 20s safety fallback so long speech is NEVER cut off prematurely by timeout
      timer = setTimeout(() => {
        console.warn('[WelcomeMessageModal]: Safety fallback 20s timeout reached. Advancing step.');
        handleWelcomeComplete();
      }, 20000);

      return () => {
        if (timer) clearTimeout(timer);
      };
    } else if (entryStep !== 'welcome') {
      isSpokenRef.current = false;
    }
  }, [entryStep, language, currentUser]);

  if (entryStep !== 'welcome') return null;

  const userName = currentUser?.name || 'Friend';

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-white text-[#1A1110] rounded-3xl p-6 sm:p-8 shadow-2xl border-4 border-[#FF5A1F] text-center space-y-6 transform scale-100">
        
        {/* Celebration Icon Header */}
        <div className="inline-flex p-4 bg-[#FF5A1F]/10 rounded-full border-2 border-[#FF5A1F] text-[#FF5A1F]">
          <Sparkles className="w-10 h-10 animate-bounce" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-black uppercase tracking-widest text-[#FF5A1F] bg-[#FF5A1F]/10 px-3 py-1 rounded-full border border-[#FF5A1F]/30">
            {language === 'ta' ? 'வரவேற்புச் செய்தி' : language === 'hi' ? 'स्वागत संदेश' : 'Welcome to AutoFeast'}
          </span>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[#1A1110]">
            {language === 'ta'
              ? `AutoFeast-க்கு வரவேற்கிறோம், ${userName}! 🎉`
              : language === 'hi'
              ? `AutoFeast में आपका स्वागत है, ${userName}! 🎉`
              : `Welcome to AutoFeast, ${userName}! 🎉`}
          </h2>

          <p className="text-sm font-extrabold text-[#4A5568] leading-relaxed max-w-md mx-auto">
            {language === 'ta'
              ? 'உங்கள் குரல் வழி உணவு ஆர்டர் மற்றும் அட்டவணை அமைப்பு தயாராக உள்ளது!'
              : language === 'hi'
              ? 'आपकी आवाज से भोजन ऑर्डर और शेड्यूल प्रणाली तैयार है!'
              : 'Your accessibility-first smart food ordering & auto-scheduling system is ready!'}
          </p>
        </div>

        <div className="p-4 bg-[#DAF0F7]/40 rounded-2xl border border-[#B2E2F0] flex items-center justify-center space-x-2 text-xs font-black text-[#1A1110]">
          <Heart className="w-4 h-4 text-[#FF5A1F] fill-[#FF5A1F] animate-pulse" />
          <span>
            {language === 'ta'
              ? 'மொழி வெற்றிகரமாகப் பயன்படுத்தப்பட்டது!'
              : language === 'hi'
              ? 'भाषा सफलतापूर्वक लागू की गई!'
              : 'Language preference successfully set!'}
          </span>
        </div>

        {/* Manual Proceed Button */}
        <button
          type="button"
          onClick={handleWelcomeComplete}
          className="w-full py-4 px-6 bg-[#FF5A1F] hover:bg-[#E04812] text-white font-black rounded-2xl text-base shadow-lg shadow-[#FF5A1F]/30 transition-transform active:scale-95 flex items-center justify-center space-x-2 cursor-pointer"
        >
          <span>
            {language === 'ta'
              ? 'தொடரவும் (Proceed to Location)'
              : language === 'hi'
              ? 'आगे बढ़ें (Proceed to Location)'
              : 'Continue to Location Access'}
          </span>
          <ArrowRight className="w-5 h-5 text-white" />
        </button>

      </div>
    </div>
  );
};
