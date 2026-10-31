import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Compass,
  Store,
  Mic,
  UtensilsCrossed,
  ShoppingCart,
  ShieldCheck,
  Bike,
  Sparkles,
  ArrowRight,
  Calendar,
  Lock,
  Globe2
} from 'lucide-react';

export const HowItWorksPage: React.FC = () => {
  const { setActiveView, setIsVoiceModalOpen, t, accessibilitySettings } = useApp();

  const currentTheme =
    accessibilitySettings.themeMode ||
    (accessibilitySettings.highContrast ? 'high-contrast' : 'light');

  const steps = [
    {
      number: '01',
      title: 'Discover Food',
      desc: 'Browse hundreds of regional Indian delicacies or type natural cravings. Smart semantic search finds dishes even if you spell or pronounce them phonetically.',
      icon: Compass,
      tag: 'Smart Search'
    },
    {
      number: '02',
      title: 'Search Nearby Restaurants',
      desc: 'View real-time delivery distances, availability, and live platform price comparisons across Swiggy and Zomato to ensure you get the best deal.',
      icon: Store,
      tag: 'Best Price'
    },
    {
      number: '03',
      title: 'Use Voice Search or AI Assistance',
      desc: 'Order effortlessly by speaking in English, Tamil (தமிழ்), or Hindi (हिन्दी). Works with online Web Speech as well as an offline local Whisper AI speech engine.',
      icon: Mic,
      tag: 'Multi-lingual Voice'
    },
    {
      number: '04',
      title: 'Choose Your Food',
      desc: 'Filter by Pure Veg, cuisine, or health requirements. Automated nominee restrictions protect elders and patients from non-permitted dietary items.',
      icon: UtensilsCrossed,
      tag: 'Dietary Safe'
    },
    {
      number: '05',
      title: 'Add Items to Cart or Schedule',
      desc: 'Add to instant cart for immediate delivery, or add to the Weekly Schedule Cart to automate lunch and dinner on specific weekdays.',
      icon: ShoppingCart,
      tag: 'Smart Cart'
    },
    {
      number: '06',
      title: 'Place Your Order Securely',
      desc: 'Verify and authorize payment using your 4-digit security PIN, biometric Face ID, or linked wallet balance with full budget safeguards.',
      icon: ShieldCheck,
      tag: 'PIN & Biometrics'
    },
    {
      number: '07',
      title: 'Track Your Order Live',
      desc: 'Watch delivery rider movement in real time with OpenStreetMap GPS tracking, live status updates, and interactive audio delivery alerts.',
      icon: Bike,
      tag: 'Live GPS Tracking'
    }
  ];

  return (
    <div className="w-full max-w-6xl mx-auto py-8 sm:py-12 px-4 sm:px-6 space-y-12 animate-fade-in">
      {/* Page Hero Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F3EDE4] text-[#B85C38] text-xs font-bold tracking-wide">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Autonomous Food Platform</span>
        </div>
        <h1 className="font-serif-editorial text-3xl sm:text-5xl font-bold text-[#302720] tracking-tight leading-tight">
          How AutoFeast AI Works
        </h1>
        <p className="text-sm sm:text-base text-[#786E64] leading-relaxed">
          AutoFeast AI combines voice intelligence, live platform price comparisons, and recurring meal scheduling into a seamless, accessible experience.
        </p>
      </div>

      {/* 7-Step User Journey Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.number}
              className={`rounded-2xl p-6 border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 flex flex-col justify-between ${
                currentTheme === 'high-contrast'
                  ? 'bg-black text-white border-2 border-yellow-400'
                  : currentTheme === 'dark'
                  ? 'bg-zinc-800 text-zinc-100 border-zinc-700'
                  : 'bg-white text-[#302720] border-[#E5DDD2] shadow-xs'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-[#FAF7F2] text-[#B85C38] flex items-center justify-center font-bold text-lg">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-2xl font-black text-[#F3EDE4] group-hover:text-[#B85C38]">
                    {step.number}
                  </span>
                </div>

                <div>
                  <div className="inline-block px-2.5 py-0.5 rounded-md bg-[#FAF7F2] text-[#B85C38] text-[11px] font-bold mb-2">
                    {step.tag}
                  </div>
                  <h3 className="font-serif-editorial text-xl font-bold text-[#302720] mb-2">{step.title}</h3>
                  <p className="text-xs sm:text-sm text-[#786E64] leading-relaxed">{step.desc}</p>
                </div>
              </div>
            </div>
          );
        })}

        {/* Feature Highlight CTA Box */}
        <div className="rounded-2xl p-6 bg-gradient-to-br from-[#B85C38] to-[#302720] text-white flex flex-col justify-between shadow-lg">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center text-white font-bold">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">Autonomous Scheduling</h3>
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
              Never forget a meal. Set recurring breakfast, lunch, or dinner delivery on specific days with automatic guardian budget limits.
            </p>
          </div>

          <div className="pt-6">
            <button
              type="button"
              onClick={() => setActiveView('home')}
              className="w-full py-3 px-4 rounded-lg bg-white text-[#302720] font-bold text-xs sm:text-sm shadow-md hover:bg-[#F3EDE4] transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Explore Food Catalog</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Safety & Nominee Assurance Section */}
      <div className={`p-6 sm:p-8 rounded-2xl border ${
        currentTheme === 'dark' ? 'bg-zinc-800/80 border-zinc-700' : 'bg-[#FAF7F2] border-[#E5DDD2]'
      }`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center md:text-left">
          <div className="flex flex-col md:flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F3EDE4] text-[#B85C38] flex items-center justify-center shrink-0">
              <Globe2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#302720]">3 Official Languages</h4>
              <p className="text-xs text-[#786E64]">English, தமிழ், and हिन्दी supported with full functionality.</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F3EDE4] text-[#B85C38] flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#302720]">Nominee Guardianship</h4>
              <p className="text-xs text-[#786E64]">Remote approval for restricted items & daily order safety caps.</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F3EDE4] text-[#B85C38] flex items-center justify-center shrink-0">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#302720]">Offline Whisper Speech</h4>
              <p className="text-xs text-[#786E64]">Local on-device transcription when internet is intermittent.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

