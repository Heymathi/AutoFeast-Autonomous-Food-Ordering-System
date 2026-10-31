import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { HeroSection } from './HeroSection';
import { DynamicFoodSearch } from './DynamicFoodSearch';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { FoodItem } from '../types';
import {
  Store,
  Star,
  Clock,
  Navigation,
  Sparkles,
  HeartPulse,
  Leaf,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  Mic,
  Compass,
  Utensils
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const {
    searchQuery,
    setSearchQuery,
    executeSearch,
    setSelectedCuisine,
    setVegOnly,
    setIsHealthModalOpen,
    setIsVoiceModalOpen,
    t,
    accessibilitySettings
  } = useApp();

  const currentTheme =
    accessibilitySettings.themeMode ||
    (accessibilitySettings.highContrast ? 'high-contrast' : 'light');

  // Curated Food Categories with icons
  const categories = [
    { id: 'South Indian', name: 'South Indian', icon: '🥞', count: '8 dishes' },
    { id: 'Tamil', name: 'Tamil Special', icon: '🥘', count: '5 dishes' },
    { id: 'North Indian', name: 'North Indian', icon: '🍛', count: '6 dishes' },
    { id: 'Kerala', name: 'Kerala', icon: '🥥', count: '4 dishes' },
    { id: 'Punjabi', name: 'Punjabi', icon: '🫓', count: '3 dishes' },
    { id: 'Street Food', name: 'Street Food', icon: '🍢', count: '4 dishes' },
    { id: 'Fast Food', name: 'Fast Food', icon: '🍕', count: '3 dishes' },
    { id: 'Beverages', name: 'Beverages', icon: '☕', count: '2 dishes' }
  ];

  // Derive unique authentic restaurants from the food catalog
  const restaurants = useMemo(() => {
    const map = new Map<string, {
      name: string;
      cuisine: string;
      rating: number;
      image: string;
      distanceKm: number;
      deliveryTime: number;
      sampleDish: string;
      isVeg: boolean;
    }>();

    for (const item of INDIAN_FOOD_CATALOG) {
      if (!map.has(item.restaurant)) {
        map.set(item.restaurant, {
          name: item.restaurant,
          cuisine: item.cuisine,
          rating: item.rating,
          image: item.image,
          distanceKm: item.distanceKm || 1.8,
          deliveryTime: item.platforms[0]?.deliveryTime || 25,
          sampleDish: item.name,
          isVeg: item.isVeg
        });
      }
    }
    return Array.from(map.values()).slice(0, 6);
  }, []);

  // Healthy food highlights from catalog
  const healthyDishes = useMemo(() => {
    return INDIAN_FOOD_CATALOG.filter(item =>
      item.isVeg && (
        item.name.toLowerCase().includes('idli') ||
        item.name.toLowerCase().includes('salad') ||
        item.name.toLowerCase().includes('dosa') ||
        item.name.toLowerCase().includes('thali') ||
        item.name.toLowerCase().includes('appam')
      )
    ).slice(0, 4);
  }, []);

  const handleCategorySelect = (categoryName: string) => {
    setSelectedCuisine(categoryName);
    setSearchQuery(categoryName);
    executeSearch(categoryName, false);
    const el = document.getElementById('dynamic-food-search-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleRestaurantSelect = (restaurantName: string) => {
    setSearchQuery(restaurantName);
    executeSearch(restaurantName, true);
    const el = document.getElementById('dynamic-food-search-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-14 animate-fade-in pb-12">
      {/* 1. Hero Section */}
      <HeroSection />

      {/* 2. Dynamic Food Search (Central Focus) */}
      <DynamicFoodSearch />

      {/* 3. Food Categories Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-[#E5DDD2] pb-3">
          <div>
            <h2 className="font-serif-editorial text-2xl sm:text-3xl font-bold text-[#302720] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#B85C38]"></span>
              Popular Food Categories
            </h2>
            <p className="text-xs sm:text-sm text-[#786E64]">
              Tap any category to filter authentic Indian specialties in real time
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategorySelect(cat.id)}
              className={`p-3.5 rounded-xl border text-center transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                currentTheme === 'dark'
                  ? 'bg-zinc-800 text-zinc-100 border-zinc-700 hover:border-[#B85C38]'
                  : 'bg-white text-[#302720] border-[#E5DDD2] hover:border-[#B85C38] hover:bg-[#FAF7F2]/50 shadow-2xs'
              }`}
            >
              <span className="text-2xl sm:text-3xl">{cat.icon}</span>
              <span className="text-xs font-bold text-[#302720] truncate max-w-full">
                {cat.name}
              </span>
              <span className="text-[10px] text-[#786E64]">{cat.count}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 4. Nearby Restaurant Listings Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-[#E5DDD2] pb-3">
          <div>
            <h2 className="font-serif-editorial text-2xl sm:text-3xl font-bold text-[#302720] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#B85C38]"></span>
              Nearby Top Rated Restaurants
            </h2>
            <p className="text-xs sm:text-sm text-[#786E64]">
              Kitchens delivering fresh to your location with multi-platform price checks
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {restaurants.map((res) => (
            <div
              key={res.name}
              className={`rounded-2xl border overflow-hidden shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between ${
                currentTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-[#E5DDD2]'
              }`}
            >
              <div>
                <div className="relative h-44 overflow-hidden bg-[#FAF7F2]">
                  <img
                    src={res.image}
                    alt={res.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3 bg-[#302720]/90 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1 shadow-xs">
                    <Store className="w-3.5 h-3.5" />
                    <span>{res.cuisine}</span>
                  </div>

                  <div className="absolute top-3 right-3 bg-white text-[#302720] text-xs font-bold px-2.5 py-1 rounded-md shadow-xs flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-current text-amber-500" />
                    <span>{res.rating}</span>
                  </div>

                  <div className="absolute bottom-3 left-3 bg-white/95 text-[#302720] text-[11px] font-semibold px-2.5 py-1 rounded-md shadow-xs flex items-center gap-1">
                    <Navigation className="w-3 h-3 text-[#B85C38]" />
                    <span>{res.distanceKm} km away</span>
                  </div>
                </div>

                <div className="p-5 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-serif-editorial text-lg font-bold text-[#302720]">{res.name}</h3>
                      <p className="text-xs text-[#786E64]">Featured: {res.sampleDish}</p>
                    </div>
                    {res.isVeg && (
                      <span className="px-2 py-0.5 rounded-md bg-[#FAF7F2] text-[#B85C38] text-[10px] font-bold border border-[#F3EDE4] flex items-center gap-1 shrink-0">
                        <Leaf className="w-2.5 h-2.5" /> Pure Veg
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-[#786E64] pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#B85C38]" /> {res.deliveryTime} mins delivery
                    </span>
                    <span>•</span>
                    <span className="text-[#4F8964] font-semibold">Live Price Verified</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[#FAF7F2] border-t border-[#E5DDD2]">
                <button
                  type="button"
                  onClick={() => handleRestaurantSelect(res.name)}
                  className="w-full py-2 px-3 rounded-lg bg-[#B85C38] hover:bg-[#302720] text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Utensils className="w-3.5 h-3.5" />
                  <span>View Dishes from this Kitchen</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. AI-Powered Food Discovery Banner */}
      <section className="p-6 sm:p-10 rounded-2xl bg-gradient-to-r from-[#FAF7F2] via-[#FAF7F2] to-[#F3EDE4]/60 border border-[#E5DDD2] shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-white border border-[#E5DDD2] text-[#B85C38] text-xs font-bold shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-[#B85C38]" />
              <span>Voice Intelligence & Semantic Discovery</span>
            </div>
            <h2 className="font-serif-editorial text-2xl sm:text-4xl font-bold text-[#302720] tracking-tight">
              Order Without Typing. Just Speak Naturally.
            </h2>
            <p className="text-xs sm:text-sm text-[#786E64] leading-relaxed max-w-2xl font-medium">
              Say &quot;மசாலா தோசை வேண்டும்&quot; or &quot;मुझे बिरयानी चाहिए&quot; or &quot;order masala dosa&quot;. AutoFeast AI listens in your native tongue, cross-references with local restaurant catalogs, checks live Swiggy & Zomato prices, and sets up your order instantly.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsVoiceModalOpen(true)}
                className="py-2.5 px-5 rounded-lg bg-[#B85C38] hover:bg-[#302720] text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <Mic className="w-4 h-4" />
                <span>Try Voice Search</span>
              </button>
              <button
                type="button"
                onClick={() => setIsHealthModalOpen(true)}
                className="py-2.5 px-4 rounded-lg bg-white hover:bg-[#FAF7F2] text-[#302720] font-semibold text-xs sm:text-sm border border-[#E5DDD2] transition-all flex items-center gap-2 cursor-pointer"
              >
                <HeartPulse className="w-4 h-4 text-[#B85C38]" />
                <span>Ask Health & Dietary AI</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-3">
            <div className="p-3.5 rounded-xl bg-white border border-[#E5DDD2] shadow-2xs flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#FAF7F2] text-[#B85C38] flex items-center justify-center font-bold text-xs shrink-0">
                EN
              </div>
              <div>
                <p className="text-xs font-bold text-[#302720]">English Speech Recognition</p>
                <p className="text-[11px] text-[#786E64]">Online Web Speech + Offline Tiny</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-[#E5DDD2] shadow-2xs flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#FAF7F2] text-[#B85C38] flex items-center justify-center font-bold text-xs shrink-0">
                தமிழ்
              </div>
              <div>
                <p className="text-xs font-bold text-[#302720]">Tamil Voice & Phonetic Match</p>
                <p className="text-[11px] text-[#786E64]">Tamil script & Tanglish mapping</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-[#E5DDD2] shadow-2xs flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#FAF7F2] text-[#B85C38] flex items-center justify-center font-bold text-xs shrink-0">
                हिंदी
              </div>
              <div>
                <p className="text-xs font-bold text-[#302720]">Hindi Natural Language NLU</p>
                <p className="text-[11px] text-[#786E64]">Devanagari query extraction</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Healthy Food Highlights Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-[#E5DDD2] pb-3">
          <div>
            <h2 className="font-serif-editorial text-2xl sm:text-3xl font-bold text-[#302720] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#B85C38]"></span>
              Healthy Food Highlights
            </h2>
            <p className="text-xs sm:text-sm text-[#786E64]">
              Nutrient-balanced vegetarian meals vetted for dietary and nominee safety
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsHealthModalOpen(true)}
            className="text-xs font-bold text-[#B85C38] hover:text-[#302720] flex items-center gap-1 cursor-pointer"
          >
            <span>Consult Dietary AI</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {healthyDishes.map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl border overflow-hidden shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between ${
                currentTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-[#E5DDD2]'
              }`}
            >
              <div>
                <div className="relative h-40 overflow-hidden bg-[#FAF7F2]">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                  />
                  <span className="absolute top-2.5 left-2.5 bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                    <Leaf className="w-2.5 h-2.5" /> Veg
                  </span>
                  <span className="absolute top-2.5 right-2.5 bg-white text-[#302720] text-[11px] font-bold px-2 py-0.5 rounded-md shadow-2xs flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current text-amber-500" />
                    <span>{item.rating}</span>
                  </span>
                </div>

                <div className="p-4 space-y-1.5">
                  <h3 className="text-sm font-bold text-[#302720] line-clamp-1">{item.name}</h3>
                  <p className="text-[11px] text-[#786E64] line-clamp-2">{item.description}</p>
                  <p className="text-xs font-bold text-[#B85C38]">₹{item.basePrice}</p>
                </div>
              </div>

              <div className="p-3 bg-[#FAF7F2] border-t border-[#E5DDD2]">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery(item.name);
                    executeSearch(item.name, true);
                    const el = document.getElementById('dynamic-food-search-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="w-full py-2 px-2.5 rounded-lg bg-[#FAF7F2] hover:bg-[#F3EDE4] text-[#B85C38] text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>Select & Order</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

