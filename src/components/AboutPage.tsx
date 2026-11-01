import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Sparkles,
  Target,
  Eye,
  Compass,
  Mic,
  CalendarClock,
  TrendingDown,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';

export const AboutPage: React.FC = () => {
  const { setActiveView, accessibilitySettings } = useApp();

  const isHighContrast = accessibilitySettings?.highContrast;

  const specialFeatures = [
    {
      icon: Sparkles,
      title: 'AI-Powered Recommendations',
      description:
        'Discover food suggestions based on user preferences, dietary requirements, and previous choices.'
    },
    {
      icon: Compass,
      title: 'Smart Food Discovery',
      description:
        'Search for food and restaurants using dynamic search, voice commands, and location-based discovery.'
    },
    {
      icon: Mic,
      title: 'Voice-Enabled Ordering',
      description:
        'Interact with the platform using voice commands in English, Tamil, and Hindi.'
    },
    {
      icon: CalendarClock,
      title: 'Automated Meal Scheduling',
      description:
        'Plan recurring meals and organize food orders according to your preferred schedule.'
    },
    {
      icon: TrendingDown,
      title: 'Smart Price Comparison',
      description:
        'Compare available food prices across supported platforms to make informed decisions.'
    },
    {
      icon: ShieldCheck,
      title: 'Personalized Food Management',
      description:
        'Manage dietary preferences, health information, daily limits, nominees, and other food-related settings.'
    }
  ];

  return (
    <div className={`w-full max-w-5xl mx-auto py-8 sm:py-14 px-4 sm:px-6 space-y-12 sm:space-y-16 animate-fade-in pb-16 ${
      isHighContrast ? 'text-white' : 'text-[#302720]'
    }`}>
      {/* 1. About Page Heading */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FCE8E3] text-[#D93636] text-xs font-bold tracking-wide border border-[#E9DED5] shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-[#D93636]" />
          <span>About The Platform</span>
        </div>

        <h1 className="font-serif-editorial text-4xl sm:text-6xl font-bold tracking-tight text-[#302720]">
          AutoFeast AI
        </h1>

        <p className="text-base sm:text-lg text-[#786E64] font-medium leading-relaxed max-w-2xl mx-auto font-sans">
          Smarter Food Choices. Easier Ordering. Happier Living.
        </p>
      </div>

      {/* 2. About AutoFeast AI – Introduction */}
      <div className={`p-6 sm:p-9 rounded-3xl border shadow-xs text-center max-w-3xl mx-auto ${
        isHighContrast
          ? 'bg-black border-yellow-400 text-yellow-100'
          : 'bg-white border-[#E9DED5] text-[#302720]'
      }`}>
        <p className="text-base sm:text-lg leading-relaxed font-normal">
          AutoFeast AI is an intelligent food ordering platform designed to make food discovery, meal planning, and ordering simpler and smarter. It combines AI-powered recommendations, voice-enabled search, location-based restaurant discovery, and automated scheduling to provide a convenient and personalized food experience.
        </p>
      </div>

      {/* 3 & 5. Our Mission & Our Vision */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-stretch">
        {/* Mission Card */}
        <div className={`p-6 sm:p-8 rounded-3xl border shadow-xs space-y-4 flex flex-col transition-all hover:border-[#D93636]/40 ${
          isHighContrast
            ? 'bg-black border-yellow-400'
            : 'bg-white border-[#E9DED5]'
        }`}>
          <div className="w-12 h-12 rounded-2xl bg-[#FCE8E3] text-[#D93636] flex items-center justify-center font-bold shadow-2xs">
            <Target className="w-6 h-6" />
          </div>
          <h2 className="font-serif-editorial text-2xl sm:text-3xl font-bold text-[#302720]">
            Our Mission
          </h2>
          <p className="text-sm sm:text-base text-[#786E64] leading-relaxed flex-1 font-sans">
            Our mission is to simplify everyday food decisions by bringing intelligent technology and convenience together. We aim to help users discover suitable meals, make informed food choices, manage their food budgets, and organize their meal schedules effortlessly.
          </p>
        </div>

        {/* Vision Card */}
        <div className={`p-6 sm:p-8 rounded-3xl border shadow-xs space-y-4 flex flex-col transition-all hover:border-[#D93636]/40 ${
          isHighContrast
            ? 'bg-black border-yellow-400'
            : 'bg-white border-[#E9DED5]'
        }`}>
          <div className="w-12 h-12 rounded-2xl bg-[#FCE8E3] text-[#D93636] flex items-center justify-center font-bold shadow-2xs">
            <Eye className="w-6 h-6" />
          </div>
          <h2 className="font-serif-editorial text-2xl sm:text-3xl font-bold text-[#302720]">
            Our Vision
          </h2>
          <p className="text-sm sm:text-base text-[#786E64] leading-relaxed flex-1 font-sans">
            To create a smarter and more accessible food ordering experience where technology helps people discover food, manage their meals, and make everyday dining decisions with confidence.
          </p>
        </div>
      </div>

      {/* 4. What Makes AutoFeast AI Special? */}
      <div className="space-y-6 sm:space-y-8">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <h2 className="font-serif-editorial text-2xl sm:text-4xl font-bold text-[#302720] tracking-tight">
            What Makes AutoFeast AI Special?
          </h2>
          <p className="text-xs sm:text-sm text-[#786E64] leading-relaxed font-sans">
            Explore the core features that bring intelligence, convenience, and peace of mind to every meal.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {specialFeatures.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className={`p-6 sm:p-7 rounded-3xl border shadow-xs hover:shadow-md transition-all space-y-3.5 group hover:border-[#D93636]/40 flex flex-col ${
                  isHighContrast
                    ? 'bg-black border-yellow-400'
                    : 'bg-white border-[#E9DED5]'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-[#FCE8E3] text-[#D93636] flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-serif-editorial text-lg sm:text-xl font-bold text-[#302720] leading-snug">
                  {feat.title}
                </h3>
                <p className="text-xs sm:text-sm text-[#786E64] leading-relaxed font-sans flex-1">
                  {feat.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Closing Section */}
      <div className={`text-center p-8 sm:p-12 rounded-3xl border-2 space-y-4 shadow-sm max-w-4xl mx-auto ${
        isHighContrast
          ? 'bg-black border-yellow-400 text-white'
          : 'bg-gradient-to-br from-[#FFF8EF] via-[#FCE8E3] to-[#FFF8EF] border-[#E9DED5]'
      }`}>
        <h2 className="font-serif-editorial text-2xl sm:text-4xl font-bold text-[#302720] tracking-tight">
          Experience a Smarter Way to Order Food
        </h2>
        <p className="text-sm sm:text-base text-[#786E64] max-w-xl mx-auto leading-relaxed font-sans">
          Discover, plan, and enjoy your meals with AutoFeast AI.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setActiveView('features')}
            className="px-8 py-3.5 rounded-2xl bg-[#D93636] hover:bg-[#B9252D] text-white font-black text-sm shadow-md hover:shadow-lg active:scale-98 transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            <span>Explore Features</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
