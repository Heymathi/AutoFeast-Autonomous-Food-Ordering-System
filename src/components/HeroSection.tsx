import React from 'react';
import { useApp } from '../context/AppContext';
import { Mic, ArrowRight, Sparkles, Clock, ShieldCheck, Heart, Compass } from 'lucide-react';

export const HeroSection: React.FC = () => {
  const {
    setIsVoiceModalOpen,
    language,
    t
  } = useApp();

  const handleOrderFoodClick = () => {
    const searchSection = document.getElementById('dynamic-food-search-section');
    if (searchSection) {
      searchSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const searchInput = searchSection.querySelector('input');
      if (searchInput) {
        searchInput.focus();
      }
    }
  };

  const handleVoiceOrderClick = () => {
    setIsVoiceModalOpen(true);
  };

  return (
    <section className="relative w-full pt-4 pb-8 sm:py-12 overflow-hidden">
      {/* Background soft ambient warm tints */}
      <div className="absolute top-1/4 right-0 -z-10 w-96 h-96 bg-[#F8EBE9]/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-10 left-1/3 -z-10 w-72 h-72 bg-[#D8B6A8]/20 rounded-full blur-3xl pointer-events-none" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        
        {/* Left Column: Headline, subtext, and CTAs */}
        <div className="lg:col-span-7 space-y-6 text-left">
          
          {/* Tag Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F8EBE9] border border-[#E7D9D6] text-[#8B1E2D] text-xs font-semibold tracking-wide shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-[#8B1E2D]" />
            <span className="uppercase text-[11px] tracking-wider font-semibold">Editorial Food Discovery & Smart Ordering</span>
          </div>

          {/* Main Headline with Editorial Serif */}
          <h1 className="font-serif-editorial text-4xl sm:text-6xl lg:text-7xl font-bold text-[#302720] tracking-tight leading-[1.12]">
            Good Food Is Always<br />
            <span className="italic font-normal text-[#8B1E2D] block mt-1">
              a Good Idea.
            </span>
          </h1>

          {/* Description */}
          <p className="text-sm sm:text-base text-[#786E64] max-w-xl leading-relaxed font-normal">
            Explore local restaurants, discover delicious meals and experience intelligent food ordering with AutoFeast AI. Compare live prices across Swiggy and Zomato, order hands-free with voice in English, Tamil, and Hindi, or schedule weekly automated deliveries.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3.5 pt-2">
            <button
              type="button"
              onClick={handleOrderFoodClick}
              className="px-6 py-3.5 rounded-lg bg-[#8B1E2D] hover:bg-[#641B29] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <Compass className="w-4 h-4" />
              <span>Explore Food Catalog</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleVoiceOrderClick}
              className="px-5 py-3.5 rounded-lg bg-white hover:bg-[#F8EBE9] text-[#302720] font-semibold text-sm border border-[#E7D9D6] shadow-xs transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-2.5 cursor-pointer"
            >
              <div className="w-6 h-6 rounded-md bg-[#F1DEDC] text-[#8B1E2D] flex items-center justify-center">
                <Mic className="w-3.5 h-3.5" />
              </div>
              <span>Voice Assistant</span>
            </button>
          </div>

          {/* Value Metrics Bar */}
          <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-[#786E64] font-semibold border-t border-[#E7D9D6]">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#8B1E2D]" />
              <span>Average delivery in <strong className="text-[#302720]">20 mins</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#4F8964]" />
              <span>Multi-Platform <strong className="text-[#302720]">Best Price Guarantee</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">🗣️</span>
              <span>Voice in <strong className="text-[#302720]">Tamil • English • Hindi</strong></span>
            </div>
          </div>

        </div>

        {/* Right Column: Visual dish presentation with floating review cards */}
        <div className="lg:col-span-5 relative flex items-center justify-center pt-6 lg:pt-0">
          
          {/* Main Circular Food Plate */}
          <div className="relative w-64 h-64 sm:w-80 sm:h-80 lg:w-92 lg:h-92 rounded-full p-2 bg-gradient-to-tr from-[#F8EBE9] via-white to-[#F1DEDC] shadow-[0_20px_50px_rgba(48,39,32,0.08)]">
            <div className="w-full h-full rounded-full overflow-hidden border-4 border-white shadow-inner">
              <img
                src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80"
                alt="Delicious gourmet food bowl"
                className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
              />
            </div>

            {/* Small floating terracotta heart icon */}
            <div className="absolute top-4 right-1/4 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center text-[#8B1E2D]">
              <Heart className="w-4 h-4 fill-current text-[#8B1E2D]" />
            </div>

            {/* Floating Review Card 1 */}
            <div className="absolute -left-4 sm:-left-8 top-12 bg-white/95 backdrop-blur-md rounded-xl p-3 border border-[#E7D9D6] shadow-lg flex items-center gap-3 max-w-[210px] animate-fade-in hover:scale-105 transition-transform">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100&q=80"
                alt="Maria Martinez"
                className="w-9 h-9 rounded-full object-cover border border-[#E7D9D6]"
              />
              <div className="text-left">
                <p className="text-xs font-bold text-[#302720] leading-tight">Maria Martinez</p>
                <p className="text-[10px] text-[#786E64] line-clamp-1">Healthy and fresh food. I love it.</p>
                <div className="flex text-amber-500 text-[10px] mt-0.5">
                  {'★'.repeat(5)}
                </div>
              </div>
            </div>

            {/* Floating Review Card 2 */}
            <div className="absolute -right-2 sm:-right-6 bottom-8 bg-white/95 backdrop-blur-md rounded-xl p-3 border border-[#E7D9D6] shadow-lg flex items-center gap-3 max-w-[210px] animate-fade-in hover:scale-105 transition-transform">
              <img
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80"
                alt="John Doe"
                className="w-9 h-9 rounded-full object-cover border border-[#E7D9D6]"
              />
              <div className="text-left">
                <p className="text-xs font-bold text-[#302720] leading-tight">John Doe</p>
                <p className="text-[10px] text-[#786E64] line-clamp-1">Healthy hot food bowl in 20 mins.</p>
                <div className="flex text-amber-500 text-[10px] mt-0.5">
                  {'★'.repeat(5)}
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
