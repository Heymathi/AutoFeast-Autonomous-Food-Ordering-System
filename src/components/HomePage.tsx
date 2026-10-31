import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { HeroSection } from './HeroSection';
import { DynamicFoodSearch } from './DynamicFoodSearch';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { FoodItem, Language } from '../types';
import {
  Store,
  Star,
  Clock,
  Navigation,
  Sparkles,
  HeartPulse,
  Leaf,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  CheckCircle2,
  Mic,
  Compass,
  Utensils,
  ShoppingCart,
  Sliders,
  Globe2,
  Sun,
  Moon,
  Eye,
  Type,
  MapPin,
  ShieldAlert
} from 'lucide-react';
import { ItemActionChooser } from './ItemActionChooser';

export const HomePage: React.FC = () => {
  const {
    searchQuery,
    setSearchQuery,
    executeSearch,
    setSelectedCuisine,
    setVegOnly,
    setIsHealthModalOpen,
    setIsVoiceModalOpen,
    setIsNomineeModalOpen,
    setIsLocationModalOpen,
    language,
    setLanguage,
    accessibilitySettings,
    setTextSize,
    setThemeMode,
    setHighContrast,
    addToCart,
    showToast,
    t
  } = useApp();

  const [isPreferencesExpanded, setIsPreferencesExpanded] = useState(false);
  const [selectedDishForOrder, setSelectedDishForOrder] = useState<FoodItem | null>(null);

  const currentTheme =
    accessibilitySettings.themeMode ||
    (accessibilitySettings.highContrast ? 'high-contrast' : 'light');

  // Curated 6 Food Categories matching PDF Page 1
  const categories = [
    { id: 'Breakfast', name: 'Breakfast', icon: '🥞', count: '8 dishes', cuisine: 'South Indian' },
    { id: 'Lunch', name: 'Lunch', icon: '🍱', count: '12 dishes', cuisine: 'Tamil' },
    { id: 'Dinner', name: 'Dinner', icon: '🍛', count: '10 dishes', cuisine: 'North Indian' },
    { id: 'Snacks', name: 'Snacks', icon: '🥪', count: '6 dishes', cuisine: 'Street Food' },
    { id: 'Healthy Food', name: 'Healthy Food', icon: '🥗', count: '5 dishes', cuisine: 'South Indian' },
    { id: 'Beverages', name: 'Beverages', icon: '🥤', count: '4 dishes', cuisine: 'Beverages' }
  ];

  // 4 Featured dishes for "Recommended For You" matching PDF Page 1
  const recommendedDishes = useMemo(() => {
    return [
      INDIAN_FOOD_CATALOG.find(i => i.name.toLowerCase().includes('masala dosa')) || INDIAN_FOOD_CATALOG[0],
      INDIAN_FOOD_CATALOG.find(i => i.name.toLowerCase().includes('biryani')) || INDIAN_FOOD_CATALOG[1],
      INDIAN_FOOD_CATALOG.find(i => i.name.toLowerCase().includes('idli')) || INDIAN_FOOD_CATALOG[2],
      INDIAN_FOOD_CATALOG.find(i => i.name.toLowerCase().includes('parotta')) || INDIAN_FOOD_CATALOG[3],
    ].filter(Boolean) as FoodItem[];
  }, []);

  // Authentic restaurants
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

  const handleCategorySelect = (category: typeof categories[0]) => {
    setSelectedCuisine(category.cuisine);
    setSearchQuery(category.name);
    executeSearch(category.name, false);
    const el = document.getElementById('dynamic-food-search-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleAddToCartClick = (dish: FoodItem) => {
    setSelectedDishForOrder(dish);
  };

  return (
    <div className="space-y-12 sm:space-y-16 animate-fade-in pb-12">
      {/* 1. Hero Section with Integrated Search Bar & 4 Feature Shortcuts */}
      <HeroSection />

      {/* 2. Categories Section matching PDF Page 1 */}
      <section className="space-y-5">
        <div className="flex items-center justify-between border-b border-[#F0E5DC] pb-3">
          <div>
            <h2 className="font-serif-editorial text-2xl sm:text-3xl font-bold text-[#33251F]">
              Food Categories
            </h2>
            <p className="text-xs sm:text-sm text-[#8A817A]">
              Explore handcrafted meals curated for every time of day
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategorySelect(cat)}
              className="p-4 rounded-2xl border border-[#F0E5DC] bg-white text-[#33251F] hover:border-[#D93636] hover:bg-[#FBE9E5]/50 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer flex flex-col items-center justify-center gap-2 group text-center shadow-2xs"
            >
              <span className="text-3xl sm:text-4xl group-hover:scale-110 transition-transform">
                {cat.icon}
              </span>
              <span className="text-xs sm:text-sm font-bold text-[#33251F] group-hover:text-[#D93636] transition-colors">
                {cat.name}
              </span>
              <span className="text-[10px] text-[#8A817A]">{cat.count}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 3. "Recommended For You" Section matching PDF Page 1 */}
      <section id="recommended-dishes-section" className="space-y-6">
        <div className="flex items-center justify-between border-b border-[#F0E5DC] pb-3">
          <div>
            <h2 className="font-serif-editorial text-2xl sm:text-3xl font-bold text-[#33251F]">
              Recommended For You
            </h2>
            <p className="text-xs sm:text-sm text-[#8A817A]">
              Personalized selections tailored to your health profile and taste
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsHealthModalOpen(true)}
            className="text-xs sm:text-sm font-bold text-[#D93636] hover:text-[#C02B2B] flex items-center gap-1 cursor-pointer"
          >
            <span>Personalise picks</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {recommendedDishes.map((dish) => (
            <div
              key={dish.id}
              className="rounded-2xl border border-[#F0E5DC] bg-white overflow-hidden shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between hover:-translate-y-0.5 group"
            >
              <div>
                {/* Dish Photo */}
                <div className="relative h-44 overflow-hidden bg-[#FBE9E5]">
                  <img
                    src={dish.image}
                    alt={dish.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {dish.isVeg && (
                    <span className="absolute top-2.5 left-2.5 bg-[#16A34A] text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                      <Leaf className="w-2.5 h-2.5" /> Veg
                    </span>
                  )}
                  <span className="absolute top-2.5 right-2.5 bg-white text-[#33251F] text-[11px] font-bold px-2 py-0.5 rounded-full shadow-2xs flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current text-amber-500" />
                    <span>{dish.rating}</span>
                  </span>
                </div>

                {/* Dish Information */}
                <div className="p-4 space-y-1.5">
                  <h3 className="font-bold text-sm sm:text-base text-[#33251F] line-clamp-1 group-hover:text-[#D93636] transition-colors">
                    {dish.name}
                  </h3>
                  <p className="text-xs text-[#8A817A] truncate">
                    {dish.restaurant}
                  </p>
                  <p className="text-[11px] text-[#8A817A] line-clamp-2 leading-relaxed">
                    {dish.description}
                  </p>
                </div>
              </div>

              {/* Bottom Price & Add to Cart Button matching PDF */}
              <div className="p-4 pt-2 border-t border-[#F0E5DC] flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#8A817A]">Price</span>
                  <p className="text-base font-bold text-[#D93636]">₹{dish.basePrice}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddToCartClick(dish)}
                  className="px-4 py-2 rounded-full bg-[#D93636] hover:bg-[#C02B2B] text-white text-xs font-bold transition-all hover:scale-105 active:scale-95 shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Add to cart</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Dynamic Food Search (Interactive Catalog, Live Price Comparison & Voice Filter) */}
      <DynamicFoodSearch />

      {/* 5. Nearby Top Rated Kitchens */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-[#F0E5DC] pb-3">
          <div>
            <h2 className="font-serif-editorial text-2xl sm:text-3xl font-bold text-[#33251F]">
              Top Rated Local Kitchens
            </h2>
            <p className="text-xs sm:text-sm text-[#8A817A]">
              Verified multi-platform pricing across Swiggy and Zomato
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {restaurants.map((res) => (
            <div
              key={res.name}
              className="rounded-2xl border border-[#F0E5DC] bg-white overflow-hidden shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="relative h-44 overflow-hidden bg-[#FBE9E5]">
                  <img
                    src={res.image}
                    alt={res.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3 bg-[#33251F]/90 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1 shadow-xs">
                    <Store className="w-3.5 h-3.5" />
                    <span>{res.cuisine}</span>
                  </div>

                  <div className="absolute top-3 right-3 bg-white text-[#33251F] text-xs font-bold px-2.5 py-1 rounded-md shadow-xs flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-current text-amber-500" />
                    <span>{res.rating}</span>
                  </div>

                  <div className="absolute bottom-3 left-3 bg-white/95 text-[#33251F] text-[11px] font-semibold px-2.5 py-1 rounded-md shadow-xs flex items-center gap-1">
                    <Navigation className="w-3 h-3 text-[#D93636]" />
                    <span>{res.distanceKm} km away</span>
                  </div>
                </div>

                <div className="p-5 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-serif-editorial text-lg font-bold text-[#33251F]">{res.name}</h3>
                      <p className="text-xs text-[#8A817A]">Featured: {res.sampleDish}</p>
                    </div>
                    {res.isVeg && (
                      <span className="px-2 py-0.5 rounded-md bg-[#FBE9E5] text-[#D93636] text-[10px] font-bold border border-[#F0E5DC] flex items-center gap-1 shrink-0">
                        <Leaf className="w-2.5 h-2.5" /> Pure Veg
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-[#8A817A] pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#D93636]" /> {res.deliveryTime} mins delivery
                    </span>
                    <span>•</span>
                    <span className="text-[#16A34A] font-semibold">Live Price Verified</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[#FFF8F0] border-t border-[#F0E5DC]">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery(res.name);
                    executeSearch(res.name, true);
                    const el = document.getElementById('dynamic-food-search-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-[#D93636] hover:bg-[#C02B2B] text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Utensils className="w-3.5 h-3.5" />
                  <span>View Dishes from this Kitchen</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Requirement 5 & PDF Page 5: ACCESSIBILITY & PREFERENCES (Single feature name, expands on click) */}
      <section className="rounded-2xl border border-[#F0E5DC] bg-white shadow-xs overflow-hidden transition-all duration-300">
        <button
          type="button"
          onClick={() => setIsPreferencesExpanded(!isPreferencesExpanded)}
          aria-expanded={isPreferencesExpanded}
          className="w-full p-5 sm:p-6 flex items-center justify-between text-left hover:bg-[#FFF8F0] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#FBE9E5] text-[#D93636] flex items-center justify-center shrink-0">
              <Sliders className="w-6 h-6 text-[#D93636]" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-[#33251F]">
                Accessibility & Preferences
              </h3>
              <p className="text-xs text-[#8A817A]">
                Customize font size, theme mode, language, and personal dining parameters
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#D93636] hidden sm:inline">
              {isPreferencesExpanded ? 'Hide Settings' : 'Open Settings'}
            </span>
            <div className="w-8 h-8 rounded-full bg-[#FBE9E5] text-[#D93636] flex items-center justify-center">
              {isPreferencesExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </button>

        {/* Expandable Settings matching PDF Page 5 */}
        {isPreferencesExpanded && (
          <div className="p-5 sm:p-6 pt-0 border-t border-[#F0E5DC] bg-[#FFF8F0]/40 space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
              {/* Card 1: Display Settings */}
              <div className="p-5 rounded-xl border border-[#F0E5DC] bg-white space-y-4 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <Type className="w-5 h-5 text-[#D93636]" />
                  <h4 className="font-bold text-sm text-[#33251F]">Display Settings</h4>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[#8A817A] block">Font Size Scale</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['sm', 'md', 'lg', 'xl'] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setTextSize(sz)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          accessibilitySettings.textSize === sz
                            ? 'bg-[#D93636] text-white border-[#D93636]'
                            : 'bg-white text-[#33251F] border-[#F0E5DC] hover:bg-[#FBE9E5]'
                        }`}
                      >
                        {sz === 'sm' ? 'A-' : sz === 'md' ? 'A' : sz === 'lg' ? 'A+' : 'A++'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <label className="text-xs font-semibold text-[#8A817A] block">Theme Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setThemeMode('light');
                        setHighContrast(false);
                      }}
                      className={`py-1.5 px-3 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 cursor-pointer ${
                        currentTheme === 'light'
                          ? 'bg-[#D93636] text-white border-[#D93636]'
                          : 'bg-white text-[#33251F] border-[#F0E5DC] hover:bg-[#FBE9E5]'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      <span>Light</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setThemeMode('dark');
                        setHighContrast(false);
                      }}
                      className={`py-1.5 px-3 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 cursor-pointer ${
                        currentTheme === 'dark'
                          ? 'bg-[#D93636] text-white border-[#D93636]'
                          : 'bg-white text-[#33251F] border-[#F0E5DC] hover:bg-[#FBE9E5]'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      <span>Dark</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 2: Language Settings */}
              <div className="p-5 rounded-xl border border-[#F0E5DC] bg-white space-y-4 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <Globe2 className="w-5 h-5 text-[#D93636]" />
                  <h4 className="font-bold text-sm text-[#33251F]">Language Settings</h4>
                </div>
                <p className="text-xs text-[#8A817A]">
                  Select your preferred language for the interface and voice queries:
                </p>

                <div className="space-y-2">
                  {[
                    { code: 'en' as Language, name: 'English', native: 'English' },
                    { code: 'ta' as Language, name: 'Tamil', native: 'தமிழ்' },
                    { code: 'hi' as Language, name: 'Hindi', native: 'हिन्दी' }
                  ].map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => setLanguage(l.code)}
                      className={`w-full py-2 px-3.5 rounded-lg text-xs font-bold border flex items-center justify-between transition-all cursor-pointer ${
                        language === l.code
                          ? 'bg-[#FBE9E5] text-[#D93636] border-[#D93636]'
                          : 'bg-white text-[#33251F] border-[#F0E5DC] hover:bg-[#FFF8F0]'
                      }`}
                    >
                      <span>{l.native}</span>
                      <span className="text-[11px] font-normal text-[#8A817A]">{l.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Card 3: Personal Preferences */}
              <div className="p-5 rounded-xl border border-[#F0E5DC] bg-white space-y-4 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <HeartPulse className="w-5 h-5 text-[#D93636]" />
                  <h4 className="font-bold text-sm text-[#33251F]">Personal Preferences</h4>
                </div>
                <p className="text-xs text-[#8A817A]">
                  Quick access to delivery location, dietary safeguards, and nominee permissions:
                </p>

                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const btn = document.getElementById('header-location-chip');
                      if (btn) btn.click();
                      else setIsLocationModalOpen(true);
                    }}
                    className="w-full py-2 px-3.5 rounded-lg text-xs font-bold border border-[#F0E5DC] bg-white hover:bg-[#FBE9E5] text-[#33251F] flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#D93636]" /> Address Settings
                    </span>
                    <span className="text-[#D93636]">→</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsHealthModalOpen(true)}
                    className="w-full py-2 px-3.5 rounded-lg text-xs font-bold border border-[#F0E5DC] bg-white hover:bg-[#FBE9E5] text-[#33251F] flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <HeartPulse className="w-3.5 h-3.5 text-[#D93636]" /> Dietary AI Safeguards
                    </span>
                    <span className="text-[#D93636]">→</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsNomineeModalOpen(true)}
                    className="w-full py-2 px-3.5 rounded-lg text-xs font-bold border border-[#F0E5DC] bg-white hover:bg-[#FBE9E5] text-[#33251F] flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-[#D93636]" /> Nominee Approvals
                    </span>
                    <span className="text-[#D93636]">→</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Item Action Chooser Dialog when adding item to cart */}
      {selectedDishForOrder && (
        <ItemActionChooser
          isOpen={!!selectedDishForOrder}
          onClose={() => setSelectedDishForOrder(null)}
          items={[selectedDishForOrder]}
          onAddInstantCart={() => {
            addToCart(selectedDishForOrder);
            showToast(`${selectedDishForOrder.name} added to cart!`);
            setSelectedDishForOrder(null);
          }}
          onScheduleRecurring={() => {
            setSelectedDishForOrder(null);
          }}
        />
      )}
    </div>
  );
};
