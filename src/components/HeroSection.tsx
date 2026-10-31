import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Search,
  Mic,
  ArrowRight,
  Sparkles,
  ShieldAlert,
  Calendar,
  Heart,
  Clock,
  ShieldCheck,
  Compass
} from 'lucide-react';
import { SpeechController } from '../services/speechController';

export const HeroSection: React.FC = () => {
  const {
    searchQuery,
    setSearchQuery,
    executeSearch,
    setIsVoiceModalOpen,
    setIsNomineeModalOpen,
    setIsHealthModalOpen,
    setActiveView,
    language,
    t
  } = useApp();

  const [localSearchInput, setLocalSearchInput] = useState(searchQuery || '');
  const [isMicListening, setIsMicListening] = useState(false);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = (localSearchInput || searchQuery).trim();
    if (query) {
      setSearchQuery(query);
      executeSearch(query, true);
      const searchSection = document.getElementById('dynamic-food-search-section');
      if (searchSection) {
        searchSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleChipClick = (term: string) => {
    setLocalSearchInput(term);
    setSearchQuery(term);
    executeSearch(term, true);
    const searchSection = document.getElementById('dynamic-food-search-section');
    if (searchSection) {
      searchSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleVoiceSearchClick = () => {
    setIsVoiceModalOpen(true);
  };

  return (
    <div className="space-y-8 sm:space-y-12">
      {/* HERO SECTION */}
      <section className="relative w-full pt-4 pb-4 sm:pt-6 sm:pb-8 overflow-hidden">
        {/* Ambient subtle warm blush glows */}
        <div className="absolute top-1/4 right-0 -z-10 w-96 h-96 bg-[#FBE9E5]/60 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-10 left-1/3 -z-10 w-72 h-72 bg-[#FFF8F0]/80 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Headline, search bar, chips */}
          <div className="lg:col-span-7 space-y-6 text-left">
            {/* Pill Badge matching PDF: Smart food ordering */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FBE9E5] border border-[#F0E5DC] text-[#33251F] text-xs font-semibold tracking-wide shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-[#D93636]" />
              <span className="font-semibold">Smart food ordering</span>
            </div>

            {/* Main Serif Headline: Discover Your Next Favourite Meal */}
            <h1 className="font-serif-editorial text-4xl sm:text-5xl lg:text-6xl font-bold text-[#33251F] tracking-tight leading-[1.15]">
              Discover Your Next{' '}
              <span className="text-[#D93636] block sm:inline">
                Favourite Meal
              </span>
            </h1>

            {/* Subtitle matching PDF */}
            <p className="text-sm sm:text-base text-[#8A817A] max-w-xl leading-relaxed font-normal">
              Personalised, voice-enabled food discovery tailored to your health, daily limits, and routine.
            </p>

            {/* Prominent Hero Search Bar matching PDF Page 1 */}
            <div className="pt-2 max-w-xl">
              <form
                onSubmit={handleSearchSubmit}
                className="relative flex items-center bg-white rounded-full border border-[#F0E5DC] shadow-sm hover:border-[#D93636]/50 focus-within:border-[#D93636] focus-within:ring-2 focus-within:ring-[#D93636]/20 transition-all p-1.5 sm:p-2"
              >
                <div className="pl-3 sm:pl-4 pr-2 text-[#8A817A]">
                  <Search className="w-5 h-5 text-[#8A817A]" />
                </div>

                <input
                  type="text"
                  value={localSearchInput}
                  onChange={(e) => setLocalSearchInput(e.target.value)}
                  placeholder="Search food or restaurant..."
                  aria-label="Search food or restaurant"
                  className="w-full bg-transparent text-sm sm:text-base text-[#33251F] placeholder-[#8A817A] focus:outline-none py-1.5"
                />

                {/* Voice mic inside search bar */}
                <button
                  type="button"
                  onClick={handleVoiceSearchClick}
                  aria-label="Voice search assistant"
                  className="p-2 sm:p-2.5 rounded-full text-[#D93636] hover:bg-[#FBE9E5] transition-colors cursor-pointer mr-1.5 shrink-0"
                  title="Search with Voice"
                >
                  <Mic className="w-5 h-5" />
                </button>

                {/* Solid Tomato Red Search Button */}
                <button
                  type="submit"
                  className="px-5 sm:px-7 py-2.5 sm:py-3 rounded-full bg-[#D93636] hover:bg-[#C02B2B] text-white text-xs sm:text-sm font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-95 shrink-0 cursor-pointer"
                >
                  Search
                </button>
              </form>

              {/* Suggested Chips below Search Bar matching PDF */}
              <div className="flex flex-wrap items-center gap-2 pt-3">
                <span className="text-xs text-[#8A817A] font-medium mr-1">Popular:</span>
                {['Pani Poori', 'Kothu Parotta', 'Healthy bowls', 'Masala Dosa', 'Biryani'].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleChipClick(chip)}
                    className="px-3 py-1 rounded-full text-xs font-medium bg-white text-[#33251F] border border-[#F0E5DC] hover:border-[#D93636] hover:bg-[#FBE9E5] transition-all cursor-pointer shadow-2xs"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Highlights metrics */}
            <div className="pt-3 flex flex-wrap items-center gap-6 text-xs text-[#8A817A] font-medium border-t border-[#F0E5DC]">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#D93636]" />
                <span>Delivery in <strong className="text-[#33251F]">20 mins</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
                <span>Live <strong className="text-[#33251F]">Price Comparison</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm">🗣️</span>
                <span>Voice in <strong className="text-[#33251F]">Tamil • English • Hindi</strong></span>
              </div>
            </div>
          </div>

          {/* Right Column: Visual dish presentation matching PDF & reference */}
          <div className="lg:col-span-5 relative flex items-center justify-center pt-6 lg:pt-0">
            {/* Main Circular Food Plate */}
            <div className="relative w-64 h-64 sm:w-80 sm:h-80 lg:w-92 lg:h-92 rounded-full p-2 bg-gradient-to-tr from-[#FBE9E5] via-white to-[#FBE9E5] shadow-[0_20px_50px_rgba(51,37,31,0.08)]">
              <div className="w-full h-full rounded-full overflow-hidden border-4 border-white shadow-inner">
                <img
                  src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80"
                  alt="Delicious gourmet food bowl"
                  className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
                />
              </div>

              {/* Small floating tomato heart icon */}
              <div className="absolute top-4 right-1/4 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center text-[#D93636]">
                <Heart className="w-4 h-4 fill-current text-[#D93636]" />
              </div>

              {/* Floating Review Card 1 */}
              <div className="absolute -left-4 sm:-left-8 top-12 bg-white/95 backdrop-blur-md rounded-xl p-3 border border-[#F0E5DC] shadow-lg flex items-center gap-3 max-w-[210px] animate-fade-in hover:scale-105 transition-transform">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100&q=80"
                  alt="Maria Martinez"
                  className="w-9 h-9 rounded-full object-cover border border-[#F0E5DC]"
                />
                <div className="text-left">
                  <p className="text-xs font-bold text-[#33251F] leading-tight">Maria Martinez</p>
                  <p className="text-[10px] text-[#8A817A] line-clamp-1">Healthy and fresh food. I love it.</p>
                  <div className="flex text-amber-500 text-[10px] mt-0.5">
                    {'★'.repeat(5)}
                  </div>
                </div>
              </div>

              {/* Floating Review Card 2 */}
              <div className="absolute -right-2 sm:-right-6 bottom-8 bg-white/95 backdrop-blur-md rounded-xl p-3 border border-[#F0E5DC] shadow-lg flex items-center gap-3 max-w-[210px] animate-fade-in hover:scale-105 transition-transform">
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80"
                  alt="John Doe"
                  className="w-9 h-9 rounded-full object-cover border border-[#F0E5DC]"
                />
                <div className="text-left">
                  <p className="text-xs font-bold text-[#33251F] leading-tight">John Doe</p>
                  <p className="text-[10px] text-[#8A817A] line-clamp-1">Healthy hot food bowl in 20 mins.</p>
                  <div className="flex text-amber-500 text-[10px] mt-0.5">
                    {'★'.repeat(5)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 FEATURE SHORTCUT CARDS (Requirement 2 & PDF Page 1) */}
      <section aria-label="Feature Shortcuts" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* 1. Nominee Management */}
        <div className="bg-white rounded-2xl p-5 border border-[#F0E5DC] shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[#FBE9E5] text-[#D93636] flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-[#D93636]" />
            </div>
            <h3 className="font-bold text-base text-[#33251F]">Nominee Management</h3>
            <p className="text-xs text-[#8A817A] leading-relaxed">
              Assign trusted contacts to review and approve orders on your behalf.
            </p>
          </div>
          <div className="pt-4">
            <button
              type="button"
              onClick={() => setIsNomineeModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D93636] hover:text-[#C02B2B] transition-colors cursor-pointer group"
            >
              <span>Manage nominee</span>
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </button>
          </div>
        </div>

        {/* 2. Recommendations */}
        <div className="bg-white rounded-2xl p-5 border border-[#F0E5DC] shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[#FBE9E5] text-[#D93636] flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-[#D93636]" />
            </div>
            <h3 className="font-bold text-base text-[#33251F]">Recommendation System</h3>
            <p className="text-xs text-[#8A817A] leading-relaxed">
              Dishes tailored to your dietary profile, past orders, and preferences.
            </p>
          </div>
          <div className="pt-4">
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('recommended-dishes-section');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                  setIsHealthModalOpen(true);
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D93636] hover:text-[#C02B2B] transition-colors cursor-pointer group"
            >
              <span>See picks</span>
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </button>
          </div>
        </div>

        {/* 3. Auto Scheduler */}
        <div className="bg-white rounded-2xl p-5 border border-[#F0E5DC] shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[#FBE9E5] text-[#D93636] flex items-center justify-center">
              <Calendar className="w-6 h-6 text-[#D93636]" />
            </div>
            <h3 className="font-bold text-base text-[#33251F]">Auto Scheduler</h3>
            <p className="text-xs text-[#8A817A] leading-relaxed">
              Set recurring meals on your schedule so you never miss breakfast or dinner.
            </p>
          </div>
          <div className="pt-4">
            <button
              type="button"
              onClick={() => setActiveView('schedule')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D93636] hover:text-[#C02B2B] transition-colors cursor-pointer group"
            >
              <span>Open scheduler</span>
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </button>
          </div>
        </div>

        {/* 4. Voice Search */}
        <div className="bg-white rounded-2xl p-5 border border-[#F0E5DC] shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[#FBE9E5] text-[#D93636] flex items-center justify-center">
              <Mic className="w-6 h-6 text-[#D93636]" />
            </div>
            <h3 className="font-bold text-base text-[#33251F]">Voice Search</h3>
            <p className="text-xs text-[#8A817A] leading-relaxed">
              Order naturally using voice in English, Tamil, or Hindi with zero hassle.
            </p>
          </div>
          <div className="pt-4">
            <button
              type="button"
              onClick={() => setIsVoiceModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D93636] hover:text-[#C02B2B] transition-colors cursor-pointer group"
            >
              <span>Start speaking</span>
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
