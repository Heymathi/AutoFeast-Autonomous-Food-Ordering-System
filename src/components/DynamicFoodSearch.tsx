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
import { ScheduleCheckoutModal } from './ScheduleCheckoutModal';
import { ItemActionChooser } from './ItemActionChooser';
import { PriceComparisonModal } from './PriceComparisonModal';
import { SearchGuidedOrderModal as _SearchGuidedOrderModal } from './SearchGuidedOrderModal'; // mounted in App.tsx
import { Search, MapPin, Utensils, Leaf, Star, Clock, Sparkles, AlertCircle, ShieldCheck, Zap, Navigation, Mic, MicOff, Volume2, BarChart2, ArrowLeft, ArrowRight } from 'lucide-react';

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
    processNaturalLanguageVoiceCommand
  } = useApp();

  const [isMicListening, setIsMicListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [categoryStatusText, setCategoryStatusText] = useState('');
  const [topSuggestions, setTopSuggestions] = useState<{ items: FoodItem[]; prompt?: string } | null>(null);
  const [schedulingItem, setSchedulingItem] = useState<FoodItem | null>(null);
  const [chooserItem, setChooserItem] = useState<FoodItem | null>(null);
  const [priceCompareItem, setPriceCompareItem] = useState<FoodItem | null>(null);
  const chooserItems = useMemo(() => (chooserItem ? [chooserItem] : []), [chooserItem]);

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
          setChooserItem(matchedVariety);
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
    <div id="dynamic-food-search-section" className="space-y-8">
      
      {/* Food Categories and Filter Bar - Direct extension of Dynamic Food Search */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#F0E5DC] shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F0E5DC] pb-4">
          <div>
            <h2 className="font-serif-editorial text-2xl sm:text-3xl font-bold text-[#33251F] tracking-tight">
              Food Categories & Catalog
            </h2>
            <p className="text-xs sm:text-sm text-[#8A817A] font-medium mt-0.5">
              {searchQuery
                ? `Showing results for "${searchQuery}"`
                : 'Handcrafted meals and dishes with live real-time price comparison across platforms'}
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

        {/* 8 Food Categories matching Tomato Red + Warm Cream theme */}
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

        {/* Filter Controls: City, Cuisine, Veg Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {/* City Selector */}
            <div className="flex items-center space-x-2 bg-[#FBE9E5] px-3.5 py-1.5 rounded-full border border-[#F0E5DC] shadow-2xs">
              <MapPin className="w-3.5 h-3.5 text-[#D93636]" />
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

            {/* Cuisine Selector */}
            <div className="flex items-center space-x-2 bg-[#FBE9E5] px-3.5 py-1.5 rounded-full border border-[#F0E5DC] shadow-2xs">
              <Utensils className="w-3.5 h-3.5 text-[#D93636]" />
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

          {/* Veg Only Toggle */}
          <button
            type="button"
            onClick={() => setVegOnly(!vegOnly)}
            className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-2xs cursor-pointer border ${
              vegOnly
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-[#33251F] border-[#F0E5DC] hover:bg-[#FBE9E5]'
            }`}
          >
            <Leaf className={`w-3.5 h-3.5 ${vegOnly ? 'text-white' : 'text-emerald-600'}`} />
            <span>{t('search.vegOnly')}</span>
          </button>
        </div>
      </div>

      {/* Quick Test Prompt Chips */}
      <div className="bg-[#FBE9E5]/40 p-4 rounded-3xl border border-[#F0E5DC] shadow-2xs">
        <div className="flex items-center space-x-2 mb-2.5">
          <Sparkles className="w-3.5 h-3.5 text-[#D93636]" />
          <span className="text-xs font-extrabold text-zinc-800 uppercase tracking-wider">
            {t('search.quickTestsTitle')}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickTestCases.map(tc => (
            <button
              key={tc.label}
              onClick={() => handleQuickTest(tc.query)}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-white text-zinc-700 hover:bg-[#D93636] hover:text-white transition-all shadow-2xs border border-[#F0E5DC] cursor-pointer"
            >
              "{tc.label}"
            </button>
          ))}
        </div>
      </div>

      {/* Search Status & Intent Summary */}
      {searchResult.query && (
        <div className="flex items-center justify-between text-sm font-bold text-zinc-900 px-2">
          <span>{t('search.resultsFor')} <span className="text-[#D93636] font-extrabold">"{searchResult.query}"</span></span>
          {searchResult.extractedIntent.location && (
            <span className="text-xs bg-[#FBE9E5] text-[#D93636] px-3 py-1 rounded-full font-bold border border-[#F0E5DC]">
              Location Filter: {searchResult.extractedIntent.location}
            </span>
          )}
        </div>
      )}

      {/* DID YOU MEAN SUGGESTION CHIP FOR MEDIUM CONFIDENCE MATCHES */}
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
              <span>{language === 'ta' ? 'ஸ்மார்ட் தேடலுக்கு இணையம் தேவை (Internet needed for smart search)' : language === 'hi' ? 'स्मार्ट खोज के लिए इंटरनेट आवश्यक है (Internet needed for smart search)' : 'Internet needed for smart search'}</span>
            </p>
          )}
        </div>
      )}

      {/* RESULTS HEADER */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h2 className="font-serif-editorial text-2xl sm:text-3xl font-bold text-[#33251F] tracking-tight">
            Popular Food Dishes
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 font-medium mt-0.5">
            Hand-picked delicacies with live real-time price comparison across food platforms
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('food-results-grid');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            aria-label="Previous dishes"
            className="w-9 h-9 rounded-xl border border-[#F0E5DC] hover:border-[#D93636] hover:text-[#D93636] bg-white text-zinc-600 flex items-center justify-center transition-all shadow-2xs hover:scale-105 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('food-results-grid');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }}
            aria-label="Next dishes"
            className="w-9 h-9 rounded-xl border border-[#F0E5DC] hover:border-[#D93636] hover:text-[#D93636] bg-white text-zinc-600 flex items-center justify-center transition-all shadow-2xs hover:scale-105 cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* RESULTS GRID: Clean White Food Listing Cards with Coral Red CTA Buttons */}
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
                    <span className="text-[#D93636] font-bold bg-[#FBE9E5] px-2 py-0.5 rounded-full border border-[#F0E5DC]">
                      Save ₹{item.platforms[0].originalPrice - item.platforms[3].price}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {item.platforms.map(p => (
                      <div
                        key={p.platform}
                        className={`p-2 rounded-2xl border flex flex-col justify-between transition-colors ${
                          p.discountBadge === 'BEST PRICE' || p.discountBadge === '15% OFF'
                            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                            : 'bg-[#FBE9E5]/60 border-[#F0E5DC] text-zinc-800'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span>{p.platformName}</span>
                          <span className="text-xs text-zinc-500 font-medium">★ {p.rating}</span>
                        </div>
                        <div className="flex items-baseline justify-between mt-1">
                          <span className="text-sm font-black text-[#D93636]">₹{p.price + p.deliveryFee}</span>
                          <span className="text-[10px] text-zinc-400 line-through">₹{p.originalPrice}</span>
                        </div>
                        {p.discountBadge && (
                          <span className="text-[10px] font-bold text-[#D93636] mt-0.5">
                            🔥 {p.discountBadge}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Card Action Footer with Elegant Coral Red CTA (#D93636) */}
            <div className="p-4 bg-[#FBE9E5]/60 border-t border-[#F0E5DC] space-y-2">
              {(() => {
                const isRestricted = checkIsItemRestrictedByNominee(item.id, item.name);
                const isApproved = isItemApprovedByNominee(item.id);
                const canDirectOrder = !isRestricted || isApproved;

                return (
                  <>
                    <button
                      type="button"
                      onClick={() => setChooserItem(item)}
                      className="w-full bg-[#33251F] hover:bg-black text-white font-bold py-2.5 rounded-full shadow-xs transition-transform active:scale-95 flex items-center justify-center space-x-2 text-xs sm:text-sm cursor-pointer"
                    >
                      <Mic className="w-4 h-4 text-[#D93636]" />
                      <span>{canDirectOrder ? 'Choose Action (Voice / Tap)' : `🔒 ${t('nominee.approvalRequiredBadge')}`}</span>
                    </button>

                    {canDirectOrder ? (
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setChooserItem(item)}
                          className="bg-[#D93636] hover:bg-[#33251F] text-white font-bold py-2 rounded-full shadow-xs transition-transform active:scale-95 flex items-center justify-center space-x-1 text-xs cursor-pointer"
                        >
                          <Zap className="w-3.5 h-3.5 text-white" />
                          <span>Instant</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setChooserItem(item)}
                          className="bg-[#FBE9E5] hover:bg-[#FBE9E5]/80 text-[#D93636] font-bold py-2 rounded-full border border-[#F0E5DC]/70 shadow-2xs transition-transform active:scale-95 flex items-center justify-center space-x-1 text-xs cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5 text-[#D93636]" />
                          <span>Schedule</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setChooserItem(item)}
                          className="bg-white hover:bg-[#FBE9E5] text-zinc-800 font-bold py-2 rounded-full border border-[#F0E5DC] shadow-2xs transition-transform active:scale-95 flex items-center justify-center space-x-1 text-xs cursor-pointer"
                          title={t('addToCart')}
                        >
                          <span>+ Cart</span>
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleNomineeRestrictedInterception(item, 'instant')}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 rounded-full shadow-xs transition-transform active:scale-95 flex items-center justify-center space-x-1 text-xs cursor-pointer"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-white" />
                          <span>{t('nominee.requestApprovalBtn')}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setChooserItem(item)}
                          className="bg-white hover:bg-[#FBE9E5] text-zinc-800 font-bold py-2 rounded-full border border-[#F0E5DC] shadow-2xs transition-transform active:scale-95 flex items-center justify-center space-x-1 text-xs cursor-pointer"
                          title={t('addToCart')}
                        >
                          <span>+ Cart</span>
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Live Price Comparison Button */}
              <button
                type="button"
                onClick={() => setPriceCompareItem(item)}
                className="w-full flex items-center justify-center gap-2 py-1.5 rounded-full text-xs font-bold transition-all border border-[#F0E5DC] bg-white hover:bg-[#FBE9E5] text-zinc-600 cursor-pointer"
              >
                <BarChart2 className="w-3.5 h-3.5 text-[#D93636]" />
                <span>Live Price Comparison</span>
              </button>

            </div>

          </div>
        ))}
      </div>

      {/* SHARED ITEM ACTION CHOOSER MODAL */}
      <ItemActionChooser
        isOpen={Boolean(chooserItem)}
        onClose={() => setChooserItem(null)}
        items={chooserItems}
        onOrderNow={(items) => {
          console.log('[DynamicFoodSearch onOrderNow]: Callback triggered with items:', items);
          if (items && items[0]) {
            console.log('[DynamicFoodSearch onOrderNow]: Calling placeInstantOrder for item:', items[0].name);
            placeInstantOrder(items[0]);
          } else {
            console.warn('[DynamicFoodSearch onOrderNow]: No items passed to onOrderNow!');
          }
        }}
        onSchedule={(items) => {
          console.log('[DynamicFoodSearch onSchedule]: Callback triggered with items:', items);
          if (items && items[0]) {
            console.log('[DynamicFoodSearch onSchedule]: Setting schedulingItem for item:', items[0].name);
            setSchedulingItem(items[0]);
          } else {
            console.warn('[DynamicFoodSearch onSchedule]: No items passed to onSchedule!');
          }
        }}
        onAddToCart={(items) => {
          console.log('[DynamicFoodSearch onAddToCart]: Callback invoked with items:', items);
          if (items && items.length > 0) {
            items.forEach(itm => {
              console.log('[DynamicFoodSearch onAddToCart]: Calling addToCart for item:', itm.name, 'id:', itm.id);
              addToCart(itm, 1, 'dynamic_search');
              const itemName = itm.nativeNames?.[language] || itm.name;
              const addedMsg = t('addedNext').replace('{item}', itemName);
              showToast(addedMsg);
              speakText(addedMsg);
            });
          }
        }}
      />

      {/* SHARED SCHEDULE CHECKOUT MODAL */}
      <ScheduleCheckoutModal
        isOpen={Boolean(schedulingItem)}
        onClose={() => setSchedulingItem(null)}
        items={schedulingItem ? [{ foodItem: schedulingItem, quantity: 1 }] : []}
        initialSlotName={schedulingItem ? `${schedulingItem.name} Schedule` : 'Scheduled Order'}
      />

      {/* LIVE PRICE COMPARISON MODAL */}
      <PriceComparisonModal
        isOpen={Boolean(priceCompareItem)}
        item={priceCompareItem}
        onClose={() => setPriceCompareItem(null)}
        onSelectPlatform={(platform, price) => {
          if (priceCompareItem) {
            placeInstantOrder(priceCompareItem);
            setPriceCompareItem(null);
          }
        }}
      />

    </div>
  );
};
