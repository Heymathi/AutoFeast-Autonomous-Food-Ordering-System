import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { FoodItem } from '../types';
import { SpeechService } from '../services/speechService';
import { SttMatcherService } from '../services/sttMatcherService';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { CategoryVoiceService } from '../services/categoryVoiceService';
import { DynamicFoodSearchEngine } from '../services/dynamicFoodSearch';
import { ScheduleCheckoutModal } from './ScheduleCheckoutModal';
import { Search, MapPin, Utensils, Leaf, Star, Clock, Sparkles, AlertCircle, ShieldCheck, Zap, Navigation, Mic, MicOff, Volume2 } from 'lucide-react';

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
    addToScheduleCart,
    t,
    accessibilitySettings,
    language,
    speakText,
    showToast
  } = useApp();

  const [isMicListening, setIsMicListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [categoryStatusText, setCategoryStatusText] = useState('');
  const [schedulingItem, setSchedulingItem] = useState<FoodItem | null>(null);

  useEffect(() => {
    return () => {
      SpeechService.stopListening();
    };
  }, []);

  const startCategoryFollowUpListening = (categoryVarieties: FoodItem[]) => {
    console.log('[Category Follow-up]: Starting follow-up listening for category selection...');
    SpeechService.startListening({
      language,
      continuous: true,
      interimResults: true,
      onStart: () => {
        setIsMicListening(true);
      },
      onResult: (followUpText, isFinal, nBestTranscripts) => {
        if (!followUpText) return;
        setLiveTranscript(followUpText);
        if (!isFinal) return; // Live transcript updated; process selection on final result only

        console.log(`[Category Follow-up Spoken Reply]: "${followUpText}" (isFinal: ${isFinal})`);
        const candidates = nBestTranscripts && nBestTranscripts.length > 0 ? nBestTranscripts : [followUpText];
        const matchedVariety = SttMatcherService.matchFoodItem(candidates, categoryVarieties, language) || DynamicFoodSearchEngine.findBestMatchingFoodItem(followUpText);

        if (matchedVariety) {
          console.log(`[Category Follow-up SUCCESS]: Matched specific variety -> "${matchedVariety.name}"`);
          setCategoryStatusText('');
          setVoiceDialogItem(matchedVariety);
        }
      },
      onError: (err) => {
        console.warn('[Category Follow-up Error]:', err);
        setIsMicListening(false);
      },
      onEnd: () => {
        setIsMicListening(false);
      }
    });
  };

  const toggleSearchMic = () => {
    if (isMicListening) {
      console.log('[Search Voice Mic] Manual stop toggled by user.');
      SpeechService.stopListening();
      setIsMicListening(false);
      return;
    }

    if (!SpeechService.isSupported()) {
      console.warn('[Search Voice Mic] Web Speech API not supported in this browser.');
      const noSupportMsg = language === 'ta'
        ? 'குரல் தேடல் இந்த உலாவியில் ஆதரிக்கப்படவில்லை.'
        : language === 'hi'
        ? 'वॉइस खोज इस ब्राउज़र में समर्थित नहीं है।'
        : 'Voice search is not supported in this browser. Please type in search bar.';
      showToast(noSupportMsg);
      speakText(noSupportMsg);
      return;
    }

    setSearchQuery('');
    setLiveTranscript('');
    setCategoryStatusText('');
    setIsMicListening(true);
    console.log('[Search Voice Mic]: Opening microphone immediately...');

    SpeechService.startListening({
      language,
      continuous: true,
      interimResults: true,
      onStart: () => {
        console.log('[Search Voice Mic SUCCESS]: Microphone active and listening...');
        setIsMicListening(true);
      },
      onResult: (transcribedText, isFinal, nBestTranscripts) => {
        if (!transcribedText) return;
        setLiveTranscript(transcribedText);
        setSearchQuery(transcribedText);

        if (!isFinal) return; // Live transcript shown in input bar; execute search ONLY on final speech result

        console.log(`[Search Voice Mic]: Speech Finalized -> "${transcribedText}"`);
        const candidates = nBestTranscripts && nBestTranscripts.length > 0 ? nBestTranscripts : [transcribedText];
        const bestMatch = SttMatcherService.matchFoodItem(candidates, INDIAN_FOOD_CATALOG, language);
        const searchInput = bestMatch ? (bestMatch.nativeNames?.[language] || bestMatch.name) : transcribedText;

        if (searchInput.trim()) {
          console.log(`[Search Voice Mic]: Auto-triggering food search execution for: "${searchInput}"`);
          executeSearch(searchInput, true);

          // Check if query is a generic category query (e.g. "dosa", "biryani", "pizza")
          const categoryResult = CategoryVoiceService.checkCategoryQuery(searchInput, language);

          if (categoryResult.isCategoryQuery && categoryResult.varieties.length >= 2) {
            setCategoryStatusText(`📢 Listing ${categoryResult.categoryName} Varieties...`);
            console.log(`[Search Voice Mic Category Listing]: Speaking varieties aloud...`);

            speakText(categoryResult.spokenPromptText, () => {
              setCategoryStatusText(`🎙️ Listening for variety selection (e.g. "${categoryResult.varieties[0].name}")...`);
              startCategoryFollowUpListening(categoryResult.varieties);
            });
          }
        }
      },
      onError: (err) => {
        console.warn('[Search Voice Mic ERROR]: Recognition error:', err);
        setIsMicListening(false);

        if (err !== 'no-speech' && err !== 'aborted') {
          const lowConfidenceCue = SpeechService.getLowConfidenceCue(language);
          showToast(lowConfidenceCue);
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
    <div className="space-y-6">
      
      {/* Search Header & Input Bar (Light Blue Structure Base #DAF0F7) */}
      <div className={`p-6 rounded-3xl shadow-lg transition-all ${
        accessibilitySettings.highContrast
          ? 'bg-black text-white border-4 border-yellow-400'
          : 'bg-[#DAF0F7] text-[#1A1110] border-2 border-[#B2E2F0]'
      }`}>
        <div className="max-w-4xl mx-auto space-y-4">
          
          <div className="text-center space-y-1">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[#1A1110]">
              Dynamic Food Search & Live GPS Location 🇮🇳
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-[#4A5568]">
              OpenStreetMap Live Geocoding • Haversine Nearest Restaurant Sorting • Interactive Voice Prompts!
            </p>
          </div>

          {/* MAIN SEARCH INPUT WITH GOOGLE-STYLE MIC ICON & CALM LISTENING BADGE */}
          <div className="relative flex-1 w-full flex flex-col justify-center">
            <div className="relative flex items-center">
              <Search className="absolute left-4 w-5 h-5 text-[#4A5568] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('search.placeholder')}
                className="w-full pl-12 pr-14 py-3.5 rounded-2xl bg-white text-[#1A1110] placeholder-[#4A5568] font-extrabold shadow-inner focus:outline-none focus:ring-4 focus:ring-[#FF5A1F] border border-[#B2E2F0] text-base"
              />
              
              {/* MIC SEARCH ICON BUTTON ON RIGHT INSIDE SEARCH BAR */}
              <button
                type="button"
                onClick={toggleSearchMic}
                className={`absolute right-3 p-2 rounded-xl transition-all cursor-pointer ${
                  isMicListening
                    ? 'bg-[#C2185B] text-white shadow-md'
                    : 'bg-[#FF5A1F]/10 hover:bg-[#FF5A1F]/20 text-[#FF5A1F]'
                }`}
                title="Voice Search (Speak Food Name in English, Tamil, Hindi)"
              >
                {isMicListening ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5" />}
              </button>
            </div>

            {/* Calm Spoken Transcription Display Badge */}
            {(isMicListening || liveTranscript || categoryStatusText) && (
              <div className="mt-2 p-2.5 bg-[#1A1110] rounded-xl text-yellow-300 text-xs font-black flex items-center justify-between border border-[#FF5A1F]">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-[#FF5A1F]" />
                  {categoryStatusText || `Live Spoken Query: "${liveTranscript || searchQuery || 'Listening...'}"`}
                </span>
                <span className="text-[10px] bg-[#C2185B] text-white px-2.5 py-0.5 rounded-md uppercase font-bold">
                  Listening Active 🎙️
                </span>
              </div>
            )}
          </div>

          {/* Filter Options: Location, Cuisine, Veg Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            
            {/* Location Selector */}
            <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-[#B2E2F0] shadow-sm">
              <MapPin className="w-4 h-4 text-[#FF5A1F]" />
              <span className="text-xs font-extrabold text-[#1A1110]">City:</span>
              <select
                value={selectedLocation}
                onChange={e => setSelectedLocation(e.target.value)}
                className="bg-transparent text-xs font-black focus:outline-none text-[#1A1110] cursor-pointer"
              >
                {locationsList.map(loc => (
                  <option key={loc} value={loc} className="text-black font-bold">{loc}</option>
                ))}
              </select>
            </div>

            {/* Cuisine Selector */}
            <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-[#B2E2F0] shadow-sm">
              <Utensils className="w-4 h-4 text-[#FF5A1F]" />
              <span className="text-xs font-extrabold text-[#1A1110]">Cuisine:</span>
              <select
                value={selectedCuisine}
                onChange={e => setSelectedCuisine(e.target.value)}
                className="bg-transparent text-xs font-black focus:outline-none text-[#1A1110] cursor-pointer"
              >
                {cuisinesList.map(c => (
                  <option key={c} value={c} className="text-black font-bold">{c}</option>
                ))}
              </select>
            </div>

            {/* Veg Only Toggle */}
            <button
              type="button"
              onClick={() => setVegOnly(!vegOnly)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors shadow-sm ${
                vegOnly
                  ? 'bg-[#16A34A] text-white'
                  : 'bg-white text-[#1A1110] border border-[#B2E2F0] hover:bg-slate-50'
              }`}
            >
              <Leaf className={`w-3.5 h-3.5 ${vegOnly ? 'text-white' : 'text-[#16A34A]'}`} />
              <span>{t('search.vegOnly')}</span>
            </button>
          </div>

        </div>
      </div>

      {/* Quick Test Prompt Chips */}
      <div className="bg-[#DAF0F7]/40 p-4 rounded-2xl border border-[#B2E2F0] shadow-sm">
        <div className="flex items-center space-x-2 mb-2">
          <Sparkles className="w-4 h-4 text-[#FF5A1F]" />
          <span className="text-xs font-black text-[#1A1110] uppercase tracking-wider">
            {t('search.quickTestsTitle')}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickTestCases.map(tc => (
            <button
              key={tc.label}
              onClick={() => handleQuickTest(tc.query)}
              className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-white text-[#FF5A1F] hover:bg-[#FF5A1F] hover:text-white transition-all shadow-sm border border-[#FF5A1F]/30 cursor-pointer"
            >
              "{tc.label}"
            </button>
          ))}
        </div>
      </div>

      {/* Search Status & Intent Summary */}
      {searchResult.query && (
        <div className="flex items-center justify-between text-sm font-black text-[#1A1110] px-2">
          <span>{t('search.resultsFor')} <span className="text-[#FF5A1F]">"{searchResult.query}"</span></span>
          {searchResult.extractedIntent.location && (
            <span className="text-xs bg-[#FF5A1F]/10 text-[#FF5A1F] px-2.5 py-0.5 rounded-md font-bold">
              Location Filter: {searchResult.extractedIntent.location}
            </span>
          )}
        </div>
      )}

      {/* DID YOU MEAN SUGGESTION CHIP FOR MEDIUM CONFIDENCE MATCHES */}
      {searchResult.didYouMean && (
        <div className="bg-[#FF5A1F]/10 border-2 border-[#FF5A1F] p-3.5 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2 text-sm font-black text-[#1A1110]">
            <Sparkles className="w-5 h-5 text-[#FF5A1F]" />
            <span>{t('search.didYouMean')}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSearchQuery(searchResult.didYouMean!.name);
              executeSearch(searchResult.didYouMean!.name, true);
            }}
            className="px-4 py-2 rounded-xl bg-[#FF5A1F] text-white font-extrabold text-xs hover:bg-[#E04810] transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <span>{searchResult.didYouMean.nativeNames?.[language] || searchResult.didYouMean.name}</span>
            <span className="text-[10px] opacity-80">({searchResult.didYouMean.name})</span>
          </button>
        </div>
      )}

      {/* ZERO-FALLBACK NOTICE when item unavailable */}
      {!searchResult.isExactMatch && (
        <div className="bg-[#C2185B]/10 border-2 border-[#C2185B] p-4 rounded-2xl text-[#C2185B] space-y-2">
          <div className="flex items-center space-x-2 text-base font-black">
            <AlertCircle className="w-5 h-5 text-[#C2185B]" />
            <span>{t('search.noResultsTitle')}</span>
          </div>
          <p className="text-xs sm:text-sm font-bold">{t('search.noResultsMessage')}</p>
          <div className="p-3 bg-white rounded-xl border border-[#C2185B]/30 text-xs font-extrabold text-[#1A1110]">
            <ShieldCheck className="w-4 h-4 inline mr-1 text-[#16A34A]" />
            {t('search.zeroFallbackNotice')}
          </div>
        </div>
      )}

      {/* RESULTS GRID: Pure White Food Listing Cards with Tomato Orange CTA Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(searchResult.isExactMatch ? searchResult.matchedItems : searchResult.suggestedItems).map(item => (
          <div
            key={item.id}
            className={`rounded-3xl overflow-hidden shadow-lg border-2 border-[#DAF0F7] transition-all duration-300 hover:shadow-2xl flex flex-col justify-between ${
              accessibilitySettings.highContrast
                ? 'bg-black text-white border-yellow-400'
                : 'bg-[#FFFFFF] text-[#1A1110]'
            }`}
          >
            <div>
              {/* Food Image with Veg Badge & Distance */}
              <div className="relative h-48 overflow-hidden">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 left-3 flex items-center space-x-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-md ${
                    item.isVeg ? 'bg-[#16A34A] text-white' : 'bg-[#C2185B] text-white'
                  }`}>
                    <Leaf className="w-3 h-3" />
                    {item.isVeg ? 'Veg' : 'Non-Veg'}
                  </span>
                  <span className="bg-[#1A1110]/80 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-xs font-black">
                    {item.cuisine}
                  </span>
                </div>

                <div className="absolute top-3 right-3 bg-[#FF5A1F] text-white font-black px-2.5 py-1 rounded-full text-xs shadow-md flex items-center space-x-1">
                  <Star className="w-3.5 h-3.5 fill-current text-white" />
                  <span>{item.rating}</span>
                </div>

                {/* Distance Badge in km */}
                <div className="absolute bottom-3 left-3 bg-[#1A1110]/90 text-white font-extrabold px-2.5 py-1 rounded-lg text-xs shadow-md backdrop-blur-sm flex items-center space-x-1 border border-[#FF5A1F]">
                  <Navigation className="w-3 h-3 text-[#FF5A1F]" />
                  <span>📍 {item.distanceKm || 1.4} km away</span>
                </div>
              </div>

              {/* Food Title & Restaurant */}
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-black text-[#1A1110] leading-snug">
                      {item.name}
                    </h3>
                    <p className="text-xs font-extrabold text-[#FF5A1F]">
                      {item.nativeNames.ta} • {item.restaurant}
                    </p>
                  </div>
                  <span className="text-xs bg-[#DAF0F7] text-[#1A1110] font-bold px-2 py-1 rounded-md">
                    {item.locations[0]}
                  </span>
                </div>

                <p className="text-xs text-[#4A5568] font-semibold line-clamp-2">
                  {item.description}
                </p>

                {/* Platform Price Comparison List */}
                <div className="pt-3 border-t border-[#DAF0F7] space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-[#1A1110]">
                    <span>Live Platform Comparison:</span>
                    <span className="text-[#C2185B] font-black bg-[#C2185B]/10 px-2 py-0.5 rounded-md">
                      Save ₹{item.platforms[0].originalPrice - item.platforms[3].price}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {item.platforms.map(p => (
                      <div
                        key={p.platform}
                        className={`p-2 rounded-xl border flex flex-col justify-between ${
                          p.discountBadge === 'BEST PRICE' || p.discountBadge === '15% OFF'
                            ? 'bg-[#16A34A]/10 border-[#16A34A]/40 text-[#1A1110]'
                            : 'bg-[#DAF0F7]/40 border-[#B2E2F0]'
                        }`}
                      >
                        <div className="flex items-center justify-between font-black text-[#1A1110]">
                          <span>{p.platformName}</span>
                          <span className="text-xs text-[#4A5568] font-bold">★ {p.rating}</span>
                        </div>
                        <div className="flex items-baseline justify-between mt-1">
                          <span className="text-sm font-black text-[#FF5A1F]">₹{p.price + p.deliveryFee}</span>
                          <span className="text-[10px] text-[#4A5568] line-through">₹{p.originalPrice}</span>
                        </div>
                        {p.discountBadge && (
                          <span className="text-[10px] font-black text-[#C2185B] mt-0.5">
                            🔥 {p.discountBadge}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Card Action Footer with Vibrant Tomato Orange CTA (#FF5A1F) */}
            <div className="p-4 bg-[#DAF0F7]/30 border-t border-[#DAF0F7] space-y-2">
              
              <button
                type="button"
                onClick={() => {
                  console.log(`[DynamicFoodSearch]: Voice Ask Prompt Clicked -> Item ID: "${item.id}", Name: "${item.name}"`);
                  setVoiceDialogItem(item);
                }}
                className="w-full bg-[#1A1110] hover:bg-black text-white font-black py-2.5 rounded-xl shadow-md transition-transform active:scale-95 flex items-center justify-center space-x-2 text-xs sm:text-sm cursor-pointer"
              >
                <Mic className="w-4 h-4 text-[#FF5A1F]" />
                <span>Voice Ask: Order Now or Schedule?</span>
              </button>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={e => handleInstantOrderClick(e, item)}
                  className="bg-[#FF5A1F] hover:bg-[#E04812] text-white font-black py-2.5 rounded-xl shadow-sm transition-transform active:scale-95 flex items-center justify-center space-x-1 text-xs cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-white" />
                  <span>Instant</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSchedulingItem(item)}
                  className="bg-[#DAF0F7] hover:bg-[#B2E2F0] text-[#1A1110] font-black py-2.5 rounded-xl border border-[#B2E2F0] shadow-sm transition-transform active:scale-95 flex items-center justify-center space-x-1 text-xs cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5 text-[#FF5A1F]" />
                  <span>Schedule</span>
                </button>

                <button
                  type="button"
                  onClick={() => addToScheduleCart(item, 1)}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-black py-2.5 rounded-xl border border-emerald-300 shadow-sm transition-transform active:scale-95 flex items-center justify-center space-x-1 text-xs cursor-pointer"
                >
                  <span>+ Cart</span>
                </button>
              </div>

            </div>

          </div>
        ))}
      </div>

      {/* SHARED SCHEDULE CHECKOUT MODAL */}
      <ScheduleCheckoutModal
        isOpen={Boolean(schedulingItem)}
        onClose={() => setSchedulingItem(null)}
        items={schedulingItem ? [{ foodItem: schedulingItem, quantity: 1 }] : []}
        initialSlotName={schedulingItem ? `${schedulingItem.name} Schedule` : 'Scheduled Order'}
      />

    </div>
  );
};
