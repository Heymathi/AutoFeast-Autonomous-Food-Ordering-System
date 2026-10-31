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
      {/* Background soft ambient green tint */}
      <div className="absolute top-1/4 right-0 -z-10 w-96 h-96 bg-[#DFF3E8]/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-10 left-1/3 -z-10 w-72 h-72 bg-[#EFF7F1]/60 rounded-full blur-3xl pointer-events-none" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        
        {/* Left Column: Headline, subtext, and CTAs */}
        <div className="lg:col-span-7 space-y-6 text-left">
          
          {/* Tag Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EFF7F1] border border-[#E4EBE5] text-[#087F5B] text-xs font-bold tracking-wide shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-[#087F5B]" />
            <span>AI Autonomous Food Ordering & Multi-Platform Comparison</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-[#064E3B] tracking-tight leading-[1.15]">
            Every Craving Has a Destination.<br />
            <span className="text-[#087F5B] font-extrabold block mt-1">
              Discover Delicious Food. Order Smarter.
            </span>
          </h1>

          {/* Description */}
          <p className="text-sm sm:text-base text-[#707B73] max-w-xl leading-relaxed font-medium">
            Find nearby restaurants, explore delicious meals and enjoy intelligent food ordering with AutoFeast AI. Compare live prices across Swiggy and Zomato, order hands-free with voice in English, Tamil, and Hindi, or schedule weekly automated deliveries.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3.5 pt-2">
            <button
              type="button"
              onClick={handleOrderFoodClick}
              className="px-6 py-3.5 rounded-lg bg-[#087F5B] hover:bg-[#064E3B] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <Compass className="w-4 h-4" />
              <span>Explore Food Catalog</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleVoiceOrderClick}
              className="px-5 py-3.5 rounded-lg bg-white hover:bg-[#EFF7F1] text-[#242B27] font-semibold text-sm border border-[#E4EBE5] shadow-xs transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-2.5 cursor-pointer"
            >
              <div className="w-6 h-6 rounded-md bg-[#EFF7F1] text-[#087F5B] flex items-center justify-center">
                <Mic className="w-3.5 h-3.5" />
              </div>
              <span>Voice Assistant</span>
            </button>
          </div>

          {/* Value Metrics Bar */}
          <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-[#707B73] font-semibold border-t border-[#E4EBE5]">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#087F5B]" />
              <span>Average delivery in <strong className="text-[#242B27]">20 mins</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#16845B]" />
              <span>Multi-Platform <strong className="text-[#242B27]">Best Price Guarantee</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">🗣️</span>
              <span>Voice in <strong className="text-[#242B27]">Tamil • English • Hindi</strong></span>
            </div>
          </div>

        </div>

        {/* Right Column: Visual dish presentation with floating review cards */}
        <div className="lg:col-span-5 relative flex items-center justify-center pt-6 lg:pt-0">
          
          {/* Main Circular Food Plate */}
          <div className="relative w-64 h-64 sm:w-80 sm:h-80 lg:w-92 lg:h-92 rounded-full p-2 bg-gradient-to-tr from-[#DFF3E8] via-white to-[#EFF7F1] shadow-[0_20px_50px_rgba(8,127,91,0.12)]">
            <div className="w-full h-full rounded-full overflow-hidden border-4 border-white shadow-inner">
              <img
                src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80"
                alt="Delicious gourmet food bowl"
                className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
              />
            </div>

            {/* Small floating green leaf/heart icon */}
            <div className="absolute top-4 right-1/4 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center text-[#087F5B]">
              <Heart className="w-4 h-4 fill-current text-[#087F5B]" />
            </div>

            {/* Floating Review Card 1 */}
            <div className="absolute -left-4 sm:-left-8 top-12 bg-white/95 backdrop-blur-md rounded-xl p-3 border border-[#E4EBE5] shadow-lg flex items-center gap-3 max-w-[210px] animate-fade-in hover:scale-105 transition-transform">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100&q=80"
                alt="Maria Martinez"
                className="w-9 h-9 rounded-full object-cover border border-[#DFF3E8]"
              />
              <div className="text-left">
                <p className="text-xs font-bold text-[#242B27] leading-tight">Maria Martinez</p>
                <p className="text-[10px] text-[#707B73] line-clamp-1">Healthy and fresh food. I love it.</p>
                <div className="flex text-amber-500 text-[10px] mt-0.5">
                  {'★'.repeat(5)}
                </div>
              </div>
            </div>

            {/* Floating Review Card 2 */}
            <div className="absolute -right-2 sm:-right-6 bottom-8 bg-white/95 backdrop-blur-md rounded-xl p-3 border border-[#E4EBE5] shadow-lg flex items-center gap-3 max-w-[210px] animate-fade-in hover:scale-105 transition-transform">
              <img
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80"
                alt="John Doe"
                className="w-9 h-9 rounded-full object-cover border border-[#DFF3E8]"
              />
              <div className="text-left">
                <p className="text-xs font-bold text-[#242B27] leading-tight">John Doe</p>
                <p className="text-[10px] text-[#707B73] line-clamp-1">Healthy hot food bowl in 20 mins.</p>
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
