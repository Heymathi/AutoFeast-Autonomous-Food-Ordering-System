import React from 'react';
import { useApp } from '../context/AppContext';
import { Mic, ArrowRight, Play, Star, Sparkles, Clock, ShieldCheck, Heart } from 'lucide-react';

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
      {/* Background soft ambient glow */}
      <div className="absolute top-1/4 right-0 -z-10 w-96 h-96 bg-rose-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-10 left-1/3 -z-10 w-72 h-72 bg-amber-100/40 rounded-full blur-3xl pointer-events-none" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        
        {/* Left Column: Headline, subtext, and CTAs */}
        <div className="lg:col-span-7 space-y-6 text-left">
          
          {/* Subtle Tag Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 border border-rose-200/80 text-[#C82346] text-xs font-bold tracking-wide shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#C82346]" />
            <span>AI Autonomous Food System • Live Comparison</span>
          </div>

          {/* Main Headline with two contrasting colors */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-[#1E1A1C] tracking-tight leading-[1.12]">
            Cravings Made Simple.<br />
            <span className="text-[#C82346] font-serif font-black italic block mt-1">
              Smart Ordering Made Better.
            </span>
          </h1>

          {/* Description */}
          <p className="text-sm sm:text-base text-zinc-600 max-w-xl leading-relaxed font-medium">
            Discover delicious food with live price comparison across Swiggy and Zomato.
            Order instantly via voice in English, Tamil, and Hindi, or schedule recurring meal deliveries with smart nominee protection.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              type="button"
              onClick={handleOrderFoodClick}
              className="px-8 py-4 rounded-full bg-[#C82346] hover:bg-[#B31D3D] text-white font-extrabold text-sm sm:text-base shadow-lg shadow-rose-900/15 transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-2.5 cursor-pointer"
            >
              <span>Order Food</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleVoiceOrderClick}
              className="px-6 py-4 rounded-full bg-white hover:bg-rose-50/60 text-[#1E1A1C] font-bold text-sm sm:text-base border border-rose-200/80 shadow-xs transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-3 cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-rose-100 text-[#C82346] flex items-center justify-center">
                <Mic className="w-3.5 h-3.5" />
              </div>
              <span>Voice Assistant</span>
            </button>
          </div>

          {/* Quick Value Metrics */}
          <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-zinc-500 font-semibold border-t border-rose-100/60">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#C82346]" />
              <span>Average delivery in <strong className="text-zinc-800">20 mins</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Multi-Platform <strong className="text-zinc-800">Best Price Guarantee</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">🗣️</span>
              <span>Voice in <strong className="text-zinc-800">Tamil • English • Hindi</strong></span>
            </div>
          </div>

        </div>

        {/* Right Column: Visual dish presentation with floating review cards */}
        <div className="lg:col-span-5 relative flex items-center justify-center pt-6 lg:pt-0">
          
          {/* Main Circular Food Hero Plate */}
          <div className="relative w-64 h-64 sm:w-80 sm:h-80 lg:w-96 lg:h-96 rounded-full p-2 bg-gradient-to-tr from-rose-200/50 via-white to-rose-100/60 shadow-[0_20px_50px_rgba(200,35,70,0.12)]">
            <div className="w-full h-full rounded-full overflow-hidden border-4 border-white shadow-inner">
              <img
                src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80"
                alt="Delicious gourmet food bowl"
                className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
              />
            </div>

            {/* Small floating red heart icon */}
            <div className="absolute top-4 right-1/4 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center text-[#C82346] animate-pulse">
              <Heart className="w-4 h-4 fill-current text-[#C82346]" />
            </div>

            {/* Floating Review Card 1 (Top Left) */}
            <div className="absolute -left-4 sm:-left-8 top-12 bg-white/95 backdrop-blur-md rounded-2xl p-3 border border-rose-100/80 shadow-[0_10px_25px_rgba(0,0,0,0.06)] flex items-center gap-3 max-w-[210px] animate-fade-in hover:scale-105 transition-transform">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100&q=80"
                alt="Maria Martinez"
                className="w-9 h-9 rounded-full object-cover border border-rose-200"
              />
              <div className="text-left">
                <p className="text-xs font-bold text-zinc-900 leading-tight">Maria Martinez</p>
                <p className="text-[10px] text-zinc-500 line-clamp-1">Healthy and fresh food. I love it.</p>
                <div className="flex text-amber-400 text-[10px] mt-0.5">
                  {'★'.repeat(5)}
                </div>
              </div>
            </div>

            {/* Floating Review Card 2 (Bottom Right) */}
            <div className="absolute -right-2 sm:-right-6 bottom-8 bg-white/95 backdrop-blur-md rounded-2xl p-3 border border-rose-100/80 shadow-[0_10px_25px_rgba(0,0,0,0.06)] flex items-center gap-3 max-w-[210px] animate-fade-in hover:scale-105 transition-transform">
              <img
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80"
                alt="John Doe"
                className="w-9 h-9 rounded-full object-cover border border-rose-200"
              />
              <div className="text-left">
                <p className="text-xs font-bold text-zinc-900 leading-tight">John Doe</p>
                <p className="text-[10px] text-zinc-500 line-clamp-1">Hot crispy dosa in 20 mins!</p>
                <div className="flex text-amber-400 text-[10px] mt-0.5">
                  {'★'.repeat(5)}
                </div>
              </div>
            </div>

            {/* 20 Mins Delivery Floating Chip */}
            <div className="absolute -bottom-3 left-1/4 bg-[#1E1A1C] text-white text-xs font-black px-4 py-1.5 rounded-full shadow-lg border border-rose-400/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>⚡ Hot & Fresh in 20 mins</span>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};

