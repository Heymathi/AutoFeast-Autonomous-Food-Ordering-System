import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { FoodItem } from '../types';
import { SpeechController } from '../services/speechController';
import { SttMatcherService } from '../services/sttMatcherService';
import { UserAliasService } from '../services/userAliasService';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { CategoryVoiceService } from '../services/categoryVoiceService';
import { DynamicFoodSearchEngine } from '../services/dynamicFoodSearch';
import { detectFoodFamilyIntent } from '../services/foodFamilyTable';
import { Search, MapPin, Utensils, Leaf, Star, Clock, Sparkles, AlertCircle, ShieldCheck, ShieldAlert, Calendar, Zap, Navigation, Mic, MicOff, Volume2, BarChart2, ArrowLeft, ArrowRight, HeartPulse } from 'lucide-react';

export const DynamicFoodSearch: React.FC = () => {
  const {
    searchQuery,
    setSearchQuery,
    selectedLocation,
    setSelectedLocation,
    selectedCuisine,
    setSelectedCuisine,
    vegOnly,
    setVegOnly,
    searchResult,
    executeSearch,
    setActiveView,
    placeInstantOrder,
    setVoiceDialogItem,
    addToCart,
    addToScheduleCart,
    setIsScheduleCartOpen,
    t,
    accessibilitySettings,
    language,
    speakText,
    showToast,
    checkIsItemRestrictedByNominee,
    isItemApprovedByNominee,
    handleNomineeRestrictedInterception,
    processNaturalLanguageVoiceCommand,
    setIsNomineeModalOpen,
    setIsHealthModalOpen,
    setIsVoiceModalOpen,
    openGuidedSearch,
    openPriceComparison
  } = useApp();

  const [isMicListening, setIsMicListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [categoryStatusText, setCategoryStatusText] = useState('');
  const [topSuggestions, setTopSuggestions] = useState<{ items: FoodItem[]; prompt?: string } | null>(null);

  useEffect(() => {
    return () => {
      SpeechController.releaseMic('dynamic_search');
      SpeechController.releaseMic('dynamic_search_followup');
    };
  }, []);

  const handleSelectSuggestion = (item: FoodItem) => {
    if (liveTranscript) {
      UserAliasService.learnAlias('default_user', liveTranscript, item.id, item.name);
    }
    const searchInput = item.nativeNames?.[language] || item.name;
    setSearchQuery(searchInput);
    setTopSuggestions(null);
    executeSearch(searchInput, true);
  };

  const startCategoryFollowUpListening = (categoryVarieties: FoodItem[]) => {
    console.log('[Category Follow-up]: Starting follow-up listening for category selection via SpeechController...');
    SpeechController.requestMic({
      owner: 'dynamic_search_followup',
      language,
      continuous: false,
      interimResults: true,
      maxAlternatives: 5,
      onStart: () => setIsMicListening(true),
      onResult: (followUpText, isFinal, nBestTranscripts) => {
        if (!followUpText) return;
        setLiveTranscript(followUpText);
        if (!isFinal) return;

        console.log(`[Category Follow-up Spoken Reply]: "${followUpText}" (isFinal: ${isFinal})`);
        const candidates = nBestTranscripts && nBestTranscripts.length > 0 ? nBestTranscripts : [followUpText];
        const matchedVariety = SttMatcherService.matchFoodItem(candidates, categoryVarieties, language) || DynamicFoodSearchEngine.findBestMatchingFoodItem(followUpText);

        if (matchedVariety) {
          console.log(`[Category Follow-up SUCCESS]: Matched specific variety -> "${matchedVariety.name}"`);
          setCategoryStatusText('');
          openGuidedSearch(matchedVariety.name, [matchedVariety]);
          SpeechController.releaseMic('dynamic_search_followup');
        }
      },
      onError: (errCode, errMsg) => {
        console.warn('[Category Follow-up Error]:', errCode, errMsg);
        setIsMicListening(false);
        showToast(errMsg);
      },
      onEnd: () => {
        setIsMicListening(false);
      }
    });
  };

  const toggleSearchMic = () => {
    SpeechController.markUserGesture();
    if (isMicListening || SpeechController.getOwner() === 'dynamic_search') {
      SpeechController.stopMic();
      setIsMicListening(false);
      return;
    }

    if (!SpeechController.isSupported()) {
      const noSupportMsg = language === 'ta'
        ? 'குரல் தேடல் இந்த உலாவியில் ஆதரிக்கப்படவில்லை.'
        : language === 'hi'
        ? 'वॉइस खोज इस ब्राउज़र में समर्थित नहीं है।'
        : 'Voice search is not supported in this browser. Please type in search bar.';
      showToast(noSupportMsg, 'info', 5000, undefined, undefined, undefined, true);
      speakText(noSupportMsg);
      return;
    }

    setSearchQuery('');
    setLiveTranscript('');
    setCategoryStatusText('');
    setTopSuggestions(null);
    setIsMicListening(true);

    SpeechController.requestMic({
      owner: 'dynamic_search',
      language,
      continuous: false,
      interimResults: true,
      maxAlternatives: 5,
      onStart: () => setIsMicListening(true),
      onResult: async (transcribedText, isFinal, nBestTranscripts) => {
        if (!transcribedText) return;
        setLiveTranscript(transcribedText);
        setSearchQuery(transcribedText);

        if (!isFinal) return;

        setIsMicListening(false);
        try {
          const candidates = nBestTranscripts && nBestTranscripts.length > 0 ? nBestTranscripts : [transcribedText];
          if (transcribedText.trim().split(/\s+/).length >= 3) {
            const handledByNlp = await processNaturalLanguageVoiceCommand(transcribedText, candidates);
            if (handledByNlp) return;
          }
          const familyIntent = detectFoodFamilyIntent(candidates);
          if (familyIntent) {
            console.log(`[Search Voice Family Match]: alternatives=${JSON.stringify(candidates)} transcript="${familyIntent.transcript}" normalized="${familyIntent.normalizedQuery}" score=${familyIntent.score} rule=${familyIntent.kind === 'family' ? 'generic-family-alias' : 'specific-variant-alias'} family="${familyIntent.family.key}" variant="${familyIntent.variantToken || ''}"`);
            console.log('[STT Diagnostic] Transcript sent to local food search', { query: familyIntent.transcript });
            setSearchQuery(familyIntent.transcript);
            setTopSuggestions(null);
            setCategoryStatusText('');
            executeSearch(familyIntent.transcript, false);
            return;
          }

          const matchRes = SttMatcherService.matchCatalogItem(candidates, INDIAN_FOOD_CATALOG, language);

          if (matchRes.isMatched && matchRes.matchedValue) {
            const searchInput = matchRes.matchedValue.nativeNames?.[language] || matchRes.matchedValue.name;
            console.log('[STT Diagnostic] Transcript sent to local food search', { query: searchInput });
            setSearchQuery(searchInput);
            setTopSuggestions(null);
            executeSearch(searchInput, true);

            const categoryResult = CategoryVoiceService.checkCategoryQuery(searchInput, language);
            if (categoryResult.isCategoryQuery && categoryResult.varieties.length >= 2) {
              setCategoryStatusText(`📢 Listing ${categoryResult.categoryName} Varieties...`);
              speakText(categoryResult.spokenPromptText, () => {
                setCategoryStatusText(`🎙️ Listening for variety selection...`);
                startCategoryFollowUpListening(categoryResult.varieties);
              });
            }
          } else if (matchRes.needsClarification && matchRes.top3Candidates && matchRes.top3Candidates.length > 0) {
            console.log('[STT Diagnostic] Transcript sent to local food search', { query: transcribedText });
            executeSearch(transcribedText, true);
            setTopSuggestions({ items: matchRes.top3Candidates, prompt: matchRes.clarificationPrompt });
            if (matchRes.clarificationPrompt) {
              speakText(matchRes.clarificationPrompt);
            }
          } else {
            console.log('[STT Diagnostic] Transcript sent to local food search', { query: transcribedText });
            executeSearch(transcribedText, true);
            if (matchRes.top3Candidates && matchRes.top3Candidates.length > 0) {
              const notFoundPrompt = language === 'ta'
                ? 'தெளிவாகப் புரியவில்லை. இந்த பிரபலமான உணவுகளில் ஒன்றா?'
                : language === 'hi'
                ? 'स्पष्ट नहीं हुआ। क्या आप इनमें से कुछ चाहते हैं?'
                : "Didn't catch that clearly. Did you mean one of these popular dishes?";
              setTopSuggestions({ items: matchRes.top3Candidates, prompt: notFoundPrompt });
              speakText(notFoundPrompt);
            }
          }
        } finally {
          setIsMicListening(false);
        }
      },
      onError: (errCode, errMsg) => {
        console.warn('[Search Voice Mic ERROR]: Recognition error:', errCode, errMsg);
        setIsMicListening(false);
        if (errCode !== 'no-speech' && errCode !== 'aborted') {
          showToast(errMsg);
        }
      },
      onEnd: () => {
        console.log('[Search Voice Mic]: Audio capture session ended.');
        setIsMicListening(false);
      }
    });
  };

  const handleQuickTest = (queryText: string) => {
    setSearchQuery(queryText);
    executeSearch(queryText, true);
  };

  const locationsList = ['All', 'Chennai', 'Salem', 'Bengaluru', 'Hyderabad', 'Mumbai', 'Delhi', 'Coimbatore'];
  const cuisinesList = ['All', 'South Indian', 'North Indian', 'Tamil', 'Kerala', 'Gujarati', 'Punjabi', 'Fast Food', 'Street Food', 'Indo-Chinese', 'Desserts', 'Beverages'];

  const quickTestCases = [
    { label: 'Dosa / தோசை', query: 'dosa' },
    { label: 'Biryani / பிரியாணி', query: 'biryani' },
    { label: 'Pizza / பீட்சா', query: 'pizza' },
    { label: 'Idli / இட்லி', query: 'idli' },
    { label: 'Parotta / பரோட்டா', query: 'parotta' },
    { label: 'Pani Puri / பானி பூரி', query: 'pani puri' },
    { label: 'Gujarati / குஜராத்தி', query: 'Gujarati' },
    { label: 'Coffee / காபி', query: 'coffee' }
  ];

  const handleInstantOrderClick = (e: React.MouseEvent, item: FoodItem) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Instant Auto-Order Clicked:', item.name);
    placeInstantOrder(item);
  };

  return (
    <div className="space-y-10 sm:space-y-12">
      
      {/* 1. DYNAMIC FOOD SEARCH SECTION */}
      <section
        id="dynamic-food-search-section"
        className="bg-white rounded-3xl p-6 sm:p-8 lg:p-10 border border-[#F0E5DC] shadow-[0_10px_35px_rgba(51,37,31,0.05)] transition-all"
      >
        <div className="max-w-4xl mx-auto space-y-6 text-left">
          
          <div className="space-y-1.5">
            <h2 className="font-serif-editorial text-2xl sm:text-3xl lg:text-4xl font-bold text-[#33251F] tracking-tight">
              Dynamic Food Search & Live GPS Location
            </h2>
            <p className="text-xs sm:text-sm text-[#8A817A] font-medium leading-relaxed">
              OpenStreetMap Live Geocoding • Haversine Nearest Restaurant Sorting • Interactive Voice Prompts
            </p>
          </div>

          {/* Large Food Search Input with Search Icon, Mic Button & Search Button */}
          <div className="relative flex items-center">
            <div className="absolute left-4 text-[#8A817A] pointer-events-none">
              <Search className="w-5 h-5 text-[#8A817A]" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                executeSearch(e.target.value, false);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  executeSearch(searchQuery, true);
                }
              }}
              placeholder={t('search.placeholder') || "Search food dishes in English, Tamil (பரோட்டா) or Hindi (बिरयानी)..."}
              aria-label="Search food dishes in English, Tamil or Hindi"
              className="w-full pl-12 pr-36 py-3.5 sm:py-4 rounded-2xl bg-[#FBE9E5]/40 hover:bg-[#FBE9E5]/60 text-[#33251F] placeholder-[#8A817A] font-medium text-sm sm:text-base border border-[#F0E5DC] focus:outline-none focus:ring-2 focus:ring-[#D93636] focus:bg-white transition-all shadow-2xs"
            />
            <div className="absolute right-2.5 flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleSearchMic}
                aria-label={isMicListening ? "Stop voice search" : "Voice search food dishes"}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  isMicListening
                    ? 'bg-red-600 text-white animate-pulse'
                    : 'bg-[#FBE9E5] text-[#D93636] hover:bg-[#D93636] hover:text-white'
                }`}
                title="Voice search"
              >
                <Mic className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => executeSearch(searchQuery, true)}
                className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-[#D93636] hover:bg-[#C02B2B] text-white text-xs sm:text-sm font-bold shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                Search
              </button>
            </div>
          </div>

          {/* Filters: City Selector, Cuisine Selector, Veg Only Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              {/* City/Location Dropdown */}
              <div className="flex items-center space-x-2 bg-[#FBE9E5] px-3.5 py-2 rounded-xl border border-[#F0E5DC] shadow-2xs">
                <MapPin className="w-4 h-4 text-[#D93636] shrink-0" />
                <span className="text-xs font-bold text-[#8A817A]">City:</span>
                <select
                  value={selectedLocation}
                  onChange={e => setSelectedLocation(e.target.value)}
                  className="bg-transparent text-xs font-bold focus:outline-none text-[#33251F] cursor-pointer"
                >
                  {locationsList.map(loc => (
                    <option key={loc} value={loc} className="text-[#33251F] font-medium">{loc}</option>
                  ))}
                </select>
              </div>

              {/* Cuisine Dropdown */}
              <div className="flex items-center space-x-2 bg-[#FBE9E5] px-3.5 py-2 rounded-xl border border-[#F0E5DC] shadow-2xs">
                <Utensils className="w-4 h-4 text-[#D93636] shrink-0" />
                <span className="text-xs font-bold text-[#8A817A]">Cuisine:</span>
                <select
                  value={selectedCuisine}
                  onChange={e => setSelectedCuisine(e.target.value)}
                  className="bg-transparent text-xs font-bold focus:outline-none text-[#33251F] cursor-pointer"
                >
                  {cuisinesList.map(c => (
                    <option key={c} value={c} className="text-[#33251F] font-medium">{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Vegetarian Only Option */}
            <button
              type="button"
              onClick={() => setVegOnly(!vegOnly)}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer border ${
                vegOnly
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-[#33251F] border-[#F0E5DC] hover:bg-[#FBE9E5]'
              }`}
            >
              <Leaf className={`w-3.5 h-3.5 ${vegOnly ? 'text-white' : 'text-emerald-600'}`} />
              <span>{t('search.vegOnly') || 'Vegetarian Only'}</span>
            </button>
          </div>

          {/* Quick Test Prompt Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
            <span className="text-[#8A817A] font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#D93636]" /> Quick test:
            </span>
            {quickTestCases.map(tc => (
              <button
                key={tc.label}
                type="button"
                onClick={() => handleQuickTest(tc.query)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#FBE9E5]/60 hover:bg-[#D93636] hover:text-white text-[#33251F] border border-[#F0E5DC] transition-all cursor-pointer"
              >
                {tc.label}
              </button>
            ))}
          </div>

        </div>
      </section>

      {/* 2. FOUR FEATURE CARDS – DISPLAYED IN ONE ROW ON DESKTOP (Order: Nominee, Health-Based Recommendation, Scheduler, Voice) */}
      <section aria-label="Feature Shortcuts" className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* 1. Nominee Management */}
        <div className="bg-white rounded-2xl p-5 border border-[#F0E5DC] shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between h-full">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[#FBE9E5] text-[#D93636] flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-[#D93636]" />
            </div>
            <h3 className="font-serif-editorial font-bold text-base sm:text-lg text-[#33251F]">Nominee Management</h3>
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

        {/* 2. Health-Based Recommendation */}
        <div className="bg-white rounded-2xl p-5 border border-[#F0E5DC] shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between h-full">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[#FBE9E5] text-[#D93636] flex items-center justify-center">
              <HeartPulse className="w-6 h-6 text-[#D93636]" />
            </div>
            <h3 className="font-serif-editorial font-bold text-base sm:text-lg text-[#33251F]">Health-Based Recommendation System</h3>
            <p className="text-xs text-[#8A817A] leading-relaxed">
              Dishes tailored to your health conditions, dietary restrictions, and allergies.
            </p>
          </div>
          <div className="pt-4">
            <button
              type="button"
              onClick={() => setIsHealthModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D93636] hover:text-[#C02B2B] transition-colors cursor-pointer group"
            >
              <span>See picks</span>
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </button>
          </div>
        </div>

        {/* 3. Auto Scheduler */}
        <div className="bg-white rounded-2xl p-5 border border-[#F0E5DC] shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between h-full">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[#FBE9E5] text-[#D93636] flex items-center justify-center">
              <Calendar className="w-6 h-6 text-[#D93636]" />
            </div>
            <h3 className="font-serif-editorial font-bold text-base sm:text-lg text-[#33251F]">Auto Scheduler</h3>
            <p className="text-xs text-[#8A817A] leading-relaxed">
              Set recurring meals on your schedule so you never miss breakfast or dinner.
            </p>
          </div>
          <div className="pt-4">
            <button
              type="button"
              onClick={() => setActiveView('scheduler')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D93636] hover:text-[#C02B2B] transition-colors cursor-pointer group"
            >
              <span>Open scheduler</span>
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </button>
          </div>
        </div>

        {/* 4. Voice Search */}
        <div className="bg-white rounded-2xl p-5 border border-[#F0E5DC] shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between h-full">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[#FBE9E5] text-[#D93636] flex items-center justify-center">
              <Mic className="w-6 h-6 text-[#D93636]" />
            </div>
            <h3 className="font-serif-editorial font-bold text-base sm:text-lg text-[#33251F]">Voice Search</h3>
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

      {/* 3. FOOD CATALOG – DIRECTLY AFTER THE FOUR FEATURE CARDS */}
      <section id="food-catalog-section" className="space-y-6">
        
        {/* Categories Bar & Results Header */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#F0E5DC] shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F0E5DC] pb-4">
            <div>
              <h2 className="font-serif-editorial text-2xl sm:text-3xl font-bold text-[#33251F] tracking-tight">
                Food Categories & Catalog
              </h2>
              <p className="text-xs sm:text-sm text-[#8A817A] font-medium mt-0.5">
                {searchQuery
                  ? `Showing results for "${searchQuery}"`
                  : 'Explore handcrafted meals and dishes with live real-time price comparison across food platforms'}
              </p>
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCuisine('All');
                  executeSearch('', false);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-[#D93636] bg-[#FBE9E5] hover:bg-[#D93636] hover:text-white border border-[#F0E5DC] transition-all cursor-pointer self-start sm:self-auto shadow-2xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Clear Filter</span>
              </button>
            )}
          </div>

          {/* 8 Categories Pills */}
          <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto pb-2 scrollbar-none">
            {[
              { id: 'All', name: 'All Dishes', icon: '🍽️', count: '23' },
              { id: 'Breakfast', name: 'Breakfast', icon: '🥞', count: '8' },
              { id: 'Lunch', name: 'Lunch', icon: '🍱', count: '12' },
              { id: 'Dinner', name: 'Dinner', icon: '🍛', count: '10' },
              { id: 'Snacks', name: 'Snacks', icon: '🥪', count: '6' },
              { id: 'Healthy Food', name: 'Healthy Food', icon: '🥗', count: '5' },
              { id: 'Beverages', name: 'Beverages', icon: '🥤', count: '4' },
              { id: 'Desserts', name: 'Desserts', icon: '🍨', count: '3' }
            ].map((cat) => {
              const isSelected = (cat.id === 'All' && !searchQuery) || (searchQuery && searchQuery.toLowerCase() === cat.name.toLowerCase());
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    if (cat.id === 'All') {
                      setSearchQuery('');
                      setSelectedCuisine('All');
                      executeSearch('', false);
                    } else {
                      setSearchQuery(cat.name);
                      executeSearch(cat.name, false);
                    }
                  }}
                  className={`px-3.5 sm:px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 shrink-0 transition-all cursor-pointer shadow-2xs border ${
                    isSelected
                      ? 'bg-[#D93636] text-white border-[#D93636] shadow-sm scale-105'
                      : 'bg-white text-[#33251F] border-[#F0E5DC] hover:border-[#D93636] hover:bg-[#FBE9E5]'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-[#FBE9E5] text-[#8A817A]'
                  }`}>
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* DID YOU MEAN SUGGESTION CHIP */}
        {searchResult.didYouMean && (
          <div className="bg-[#FBE9E5] border border-[#F0E5DC] p-4 rounded-3xl flex items-center justify-between shadow-2xs">
            <div className="flex items-center space-x-2 text-sm font-bold text-zinc-900">
              <Sparkles className="w-4 h-4 text-[#D93636]" />
              <span>{t('search.didYouMean')}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchQuery(searchResult.didYouMean!.name);
                executeSearch(searchResult.didYouMean!.name, true);
              }}
              className="px-4 py-2 rounded-xl bg-[#D93636] text-white font-extrabold text-xs hover:bg-[#33251F] transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <span>{searchResult.didYouMean.nativeNames?.[language] || searchResult.didYouMean.name}</span>
              <span className="text-[10px] opacity-80">({searchResult.didYouMean.name})</span>
            </button>
          </div>
        )}

        {/* ZERO-FALLBACK NOTICE when item unavailable */}
        {!searchResult.isExactMatch && (
          <div className="bg-[#D93636]/10 border-2 border-[#D93636] p-4 rounded-2xl text-[#D93636] space-y-2">
            <div className="flex items-center space-x-2 text-base font-black">
              <AlertCircle className="w-5 h-5 text-[#D93636]" />
              <span>{t('search.noResultsTitle')}</span>
            </div>
            <p className="text-xs sm:text-sm font-bold">{t('search.noResultsMessage')}</p>
            <div className="p-3 bg-white rounded-xl border border-[#D93636]/30 text-xs font-extrabold text-[#33251F]">
              <ShieldCheck className="w-4 h-4 inline mr-1 text-[#16A34A]" />
              {t('search.zeroFallbackNotice')}
            </div>
            {searchResult.offlineHint && (
              <p className="text-xs font-bold text-amber-800 bg-amber-100/80 p-2.5 rounded-xl border border-amber-300 flex items-center gap-1.5" data-testid="offline-smart-search-hint">
                <span>🌐</span>
                <span>{t('search.smartSearchUnavailable')}</span>
              </p>
            )}
          </div>
        )}

        {/* RESULTS GRID: Clean Food Cards with Coral Red CTA Buttons */}
        <div id="food-results-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {(searchResult.isExactMatch ? searchResult.matchedItems : searchResult.suggestedItems).map(item => (
            <div
              key={item.id}
              className={`group rounded-3xl overflow-hidden shadow-[0_4px_25px_rgba(0,0,0,0.04)] border border-[#F0E5DC] transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between ${
                accessibilitySettings.highContrast
                  ? 'bg-black text-white border-2 border-yellow-400'
                  : 'bg-white text-zinc-900'
              }`}
            >
              <div>
                {/* Food Image with Veg Badge & Distance */}
                <div className="relative h-48 overflow-hidden bg-[#FBE9E5]/60">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3 flex items-center space-x-1.5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 shadow-xs ${
                      item.isVeg ? 'bg-emerald-600 text-white' : 'bg-[#D93636] text-white'
                    }`}>
                      <Leaf className="w-3 h-3" />
                      {item.isVeg ? 'Veg' : 'Non-Veg'}
                    </span>
                    <span className="bg-[#33251F]/80 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-xs font-bold">
                      {item.cuisine}
                    </span>
                    {item.isSmartSearch && (
                      <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-xs flex items-center gap-1" data-testid="smart-search-badge">
                        ✨ Smart search
                      </span>
                    )}
                  </div>

                  <div className="absolute top-3 right-3 bg-[#D93636] text-white font-bold px-2.5 py-1 rounded-full text-xs shadow-xs flex items-center space-x-1">
                    <Star className="w-3.5 h-3.5 fill-current text-white" />
                    <span>{item.rating}</span>
                  </div>

                  {/* Distance Badge in km */}
                  <div className="absolute bottom-3 left-3 bg-[#33251F]/85 text-white font-bold px-2.5 py-1 rounded-full text-xs shadow-xs backdrop-blur-sm flex items-center space-x-1 border border-rose-400/30">
                    <Navigation className="w-3 h-3 text-[#D93636]" />
                    <span>📍 {item.distanceKm || 1.4} km away</span>
                  </div>
                </div>

                {/* Food Title & Restaurant */}
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-serif-editorial text-lg font-bold text-[#33251F] leading-snug group-hover:text-[#D93636] transition-colors">
                        {item.name}
                      </h3>
                      <p className="text-xs font-bold text-[#D93636] mt-0.5">
                        {item.nativeNames.ta} • <span className="text-zinc-500 font-semibold">{item.restaurant}</span>
                      </p>
                    </div>
                    <span className="text-xs bg-[#FBE9E5] text-[#D93636] font-bold px-2.5 py-1 rounded-full border border-[#F0E5DC] shrink-0">
                      {item.locations[0]}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-500 font-medium line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>

                  {/* Platform Price Comparison List */}
                  <div className="pt-3 border-t border-[#F0E5DC] space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-zinc-800">
                      <span>Live Platform Comparison:</span>
                      {(() => {
                        const originalPrices = (item.platforms || []).map(p => p.originalPrice || p.price);
                        const currentPrices = (item.platforms || []).map(p => p.price);
                        const maxP = originalPrices.length > 0 ? Math.max(...originalPrices) : item.basePrice;
                        const minP = currentPrices.length > 0 ? Math.min(...currentPrices) : item.basePrice;
                        const savings = Math.max(0, maxP - minP);
                        return savings > 0 ? (
                          <span className="text-[#D93636] font-bold bg-[#FBE9E5] px-2 py-0.5 rounded-full border border-[#F0E5DC]">
                            Save ₹{savings}
                          </span>
                        ) : null;
                      })()}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {item.platforms.map(p => (
                        <div
                          key={p.platformName}
                          className={`p-2.5 rounded-xl border flex flex-col justify-between transition-all ${
                            p.platformName === 'AutoFeast (Direct)'
                              ? 'bg-rose-50/80 border-[#D93636] text-[#D93636] font-bold shadow-2xs'
                              : 'bg-white border-[#F0E5DC] text-zinc-600'
                          }`}
                        >
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="font-extrabold truncate">{p.platformName}</span>
                            {p.platformName === 'AutoFeast (Direct)' && (
                              <span className="text-[9px] bg-[#D93636] text-white px-1.5 py-0.2 rounded-xs">
                                Best
                              </span>
                            )}
                          </div>
                          <div className="flex justify-between items-baseline mt-1.5">
                            <span className="text-sm font-black">₹{p.price}</span>
                            <span className="text-[10px] text-zinc-400 font-medium">{p.deliveryTime}m</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Price Compare, Add to Cart, Instant Order */}
              <div className="p-4 pt-0 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openPriceComparison(item)}
                    className="w-full py-2 px-2.5 rounded-xl border border-[#F0E5DC] hover:border-[#D93636] text-zinc-700 hover:text-[#D93636] text-xs font-bold flex items-center justify-center gap-1 transition-all bg-white hover:bg-[#FBE9E5] cursor-pointer"
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    <span>Compare</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openGuidedSearch(item.name, [item])}
                    className="w-full py-2 px-2.5 rounded-xl bg-[#D93636] hover:bg-[#C02B2B] text-white text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-xs hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Order / Schedule</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => addToCart(item, 1, 'dynamic_search')}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#FBE9E5] hover:bg-[#D93636] text-[#D93636] hover:text-white border border-[#F0E5DC] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Utensils className="w-3.5 h-3.5" />
                  <span>Add to Cart (₹{item.basePrice})</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
