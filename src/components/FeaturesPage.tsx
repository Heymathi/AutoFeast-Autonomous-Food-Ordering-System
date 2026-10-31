import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Globe2,
  MapPin,
  Type,
  SunMoon,
  Mic,
  Calendar,
  HeartPulse,
  Search,
  Sparkles,
  PackageCheck,
  Wallet,
  Bike,
  History,
  ShoppingCart,
  ShieldAlert,
  Building2,
  ChevronRight,
  Navigation,
  Check,
  Edit3
} from 'lucide-react';
import { Language } from '../types';

export const FeaturesPage: React.FC = () => {
  const {
    language,
    setLanguage,
    userLocation,
    setIsLocationModalOpen,
    fetchLiveGpsLocation,
    accessibilitySettings,
    setTextSize,
    setThemeMode,
    setHighContrast,
    setIsVoiceModalOpen,
    setActiveView,
    setIsHealthModalOpen,
    setIsNomineeModalOpen,
    setIsLimitRenewalModalOpen,
    setIsScheduleCartModalOpen,
    walletBalance,
    dailyOrderCount,
    scheduleCart,
    t
  } = useApp();

  const currentTheme =
    accessibilitySettings.themeMode ||
    (accessibilitySettings.highContrast ? 'high-contrast' : 'light');

  const languages: { code: Language; name: string; native: string }[] = [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
    { code: 'hi', name: 'Hindi', native: 'हिन्दी' }
  ];

  const fontSizes: { size: 'sm' | 'md' | 'lg' | 'xl'; label: string }[] = [
    { size: 'sm', label: 'Small' },
    { size: 'md', label: 'Medium' },
    { size: 'lg', label: 'Large' },
    { size: 'xl', label: 'Extra Large' }
  ];

  const themes: { mode: 'light' | 'dark' | 'high-contrast'; label: string }[] = [
    { mode: 'light', label: 'Light' },
    { mode: 'dark', label: 'Dark' },
    { mode: 'high-contrast', label: 'High Contrast' }
  ];

  return (
    <div className="w-full max-w-6xl mx-auto py-8 sm:py-12 px-4 sm:px-6 space-y-12 animate-fade-in">
      {/* Page Header */}
      <div className="text-center space-y-3 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#DFF3E8] text-[#087F5B] text-xs font-bold tracking-wide">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Complete Platform Capabilities</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-[#064E3B] tracking-tight">
          {t('features.title') || 'Application Features & Settings'}
        </h1>
        <p className="text-sm sm:text-base text-[#707B73] leading-relaxed">
          Configure language, accessibility, address, food features, and manage your account settings in one central hub.
        </p>
      </div>

      {/* =========================================================================
          SECTION A – PERSONALIZATION AND ACCESSIBILITY
          ========================================================================= */}
      <section className="space-y-6">
        <div className="border-b border-[#E4EBE5] pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#064E3B] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#087F5B]"></span>
              {t('features.personalization') || 'Personalization & Accessibility'}
            </h2>
            <p className="text-xs sm:text-sm text-[#707B73]">
              Configure language, address, typography scale, and theme preferences.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1. Language Selection */}
          <div className={`p-6 rounded-2xl border shadow-xs space-y-4 ${
            currentTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-[#E4EBE5]'
          }`}>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-[#EFF7F1] text-[#087F5B] flex items-center justify-center">
                <Globe2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#064E3B]">Application Language</h3>
                <p className="text-xs text-[#707B73]">English, Tamil, and Hindi with full feature parity</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-2">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setLanguage(lang.code)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    language === lang.code
                      ? 'bg-[#087F5B] text-white border-[#087F5B] shadow-xs'
                      : currentTheme === 'dark'
                      ? 'bg-zinc-700 text-zinc-200 border-zinc-600 hover:bg-zinc-600'
                      : 'bg-[#F7FAF8] text-[#242B27] border-[#E4EBE5] hover:bg-[#DFF3E8]/50'
                  }`}
                >
                  <span className="text-xs">{lang.native}</span>
                  <span className={`text-[10px] ${language === lang.code ? 'text-white/80' : 'text-[#707B73]'}`}>
                    {lang.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Address & Location Management */}
          <div className={`p-6 rounded-2xl border shadow-xs space-y-4 ${
            currentTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-[#E4EBE5]'
          }`}>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-[#EFF7F1] text-[#087F5B] flex items-center justify-center">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#064E3B]">Delivery Location</h3>
                <p className="text-xs text-[#707B73]">Current delivery address & GPS position</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F7FAF8] border border-[#E4EBE5] flex items-center justify-between">
              <div className="min-w-0 flex-1 pr-3">
                <span className="text-[11px] text-[#707B73] block font-medium">Saved Location</span>
                <p className="text-xs sm:text-sm font-bold text-[#242B27] truncate">
                  {userLocation.area === 'Location not set'
                    ? 'Location not set'
                    : `📍 ${userLocation.area}, ${userLocation.city}`}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={fetchLiveGpsLocation}
                  title="Detect GPS"
                  className="p-2 rounded-lg bg-white border border-[#E4EBE5] text-[#087F5B] hover:bg-[#DFF3E8] transition-colors cursor-pointer"
                >
                  <Navigation className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsLocationModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-[#087F5B] hover:bg-[#064E3B] text-white text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Change</span>
                </button>
              </div>
            </div>
          </div>

          {/* 3. Website Font Size */}
          <div className={`p-6 rounded-2xl border shadow-xs space-y-4 ${
            currentTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-[#E4EBE5]'
          }`}>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-[#EFF7F1] text-[#087F5B] flex items-center justify-center">
                <Type className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#064E3B]">Website Font Size</h3>
                <p className="text-xs text-[#707B73]">Accessibility text scaling (Small to XL)</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-2">
              {fontSizes.map((f) => (
                <button
                  key={f.size}
                  type="button"
                  onClick={() => setTextSize(f.size)}
                  className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    accessibilitySettings.textSize === f.size
                      ? 'bg-[#087F5B] text-white border-[#087F5B] shadow-xs'
                      : currentTheme === 'dark'
                      ? 'bg-zinc-700 text-zinc-200 border-zinc-600 hover:bg-zinc-600'
                      : 'bg-[#F7FAF8] text-[#242B27] border-[#E4EBE5] hover:bg-[#DFF3E8]/50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Website Theme */}
          <div className={`p-6 rounded-2xl border shadow-xs space-y-4 ${
            currentTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-[#E4EBE5]'
          }`}>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-[#EFF7F1] text-[#087F5B] flex items-center justify-center">
                <SunMoon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#064E3B]">Theme Appearance</h3>
                <p className="text-xs text-[#707B73]">Light, Dark, and High-Contrast Accessibility</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-2">
              {themes.map((th) => (
                <button
                  key={th.mode}
                  type="button"
                  onClick={() => {
                    if (th.mode === 'high-contrast') {
                      setHighContrast(true);
                      setThemeMode('high-contrast');
                    } else {
                      setHighContrast(false);
                      setThemeMode(th.mode);
                    }
                  }}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    currentTheme === th.mode
                      ? 'bg-[#087F5B] text-white border-[#087F5B] shadow-xs'
                      : currentTheme === 'dark'
                      ? 'bg-zinc-700 text-zinc-200 border-zinc-600 hover:bg-zinc-600'
                      : 'bg-[#F7FAF8] text-[#242B27] border-[#E4EBE5] hover:bg-[#DFF3E8]/50'
                  }`}
                >
                  {th.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION B – FOOD AND AI FEATURES
          ========================================================================= */}
      <section className="space-y-6">
        <div className="border-b border-[#E4EBE5] pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#064E3B] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#087F5B]"></span>
              {t('features.foodAi') || 'Food & AI Features'}
            </h2>
            <p className="text-xs sm:text-sm text-[#707B73]">
              Voice NLU, smart scheduling, healthy food filters, and catalog intelligence.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feature 1: Voice Search */}
          <div className={`p-6 rounded-2xl border shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow ${
            currentTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-[#E4EBE5]'
          }`}>
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#EFF7F1] text-[#087F5B] flex items-center justify-center">
                <Mic className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#064E3B]">Voice Search</h3>
              <p className="text-xs text-[#707B73] leading-relaxed">
                Order by speaking naturally in Tamil, Hindi, or English. Supports offline local Whisper AI inference when offline.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsVoiceModalOpen(true)}
              className="w-full py-2.5 px-3 rounded-lg bg-[#EFF7F1] hover:bg-[#DFF3E8] text-[#087F5B] text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Launch Voice Assistant</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Feature 2: Auto Scheduler */}
          <div className={`p-6 rounded-2xl border shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow ${
            currentTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-[#E4EBE5]'
          }`}>
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#EFF7F1] text-[#087F5B] flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#064E3B]">Auto Scheduler</h3>
              <p className="text-xs text-[#707B73] leading-relaxed">
                Configure automated recurring meal deliveries for Monday through Sunday with customizable time slots.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveView('scheduler')}
              className="w-full py-2.5 px-3 rounded-lg bg-[#EFF7F1] hover:bg-[#DFF3E8] text-[#087F5B] text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Open Auto Scheduler</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Feature 3: Healthy Foods */}
          <div className={`p-6 rounded-2xl border shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow ${
            currentTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-[#E4EBE5]'
          }`}>
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#EFF7F1] text-[#087F5B] flex items-center justify-center">
                <HeartPulse className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#064E3B]">Healthy Foods</h3>
              <p className="text-xs text-[#707B73] leading-relaxed">
                Health & dietary AI assistant to discover diabetic-friendly, low-oil, high-protein, and nutrient-dense dishes.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsHealthModalOpen(true)}
              className="w-full py-2.5 px-3 rounded-lg bg-[#EFF7F1] hover:bg-[#DFF3E8] text-[#087F5B] text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Explore Healthy Diet Guide</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Feature 4: Dynamic Food Search */}
          <div className={`p-6 rounded-2xl border shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow ${
            currentTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-[#E4EBE5]'
          }`}>
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#EFF7F1] text-[#087F5B] flex items-center justify-center">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#064E3B]">Dynamic Food Search</h3>
              <p className="text-xs text-[#707B73] leading-relaxed">
                Fuzzy and cross-script phonetic matching identifies dishes across multiple regional Indian cuisines instantly.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveView('home')}
              className="w-full py-2.5 px-3 rounded-lg bg-[#EFF7F1] hover:bg-[#DFF3E8] text-[#087F5B] text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Go to Dynamic Search</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Feature 5: AI Food Assistance */}
          <div className={`p-6 rounded-2xl border shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-2 ${
            currentTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-[#E4EBE5]'
          }`}>
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#EFF7F1] text-[#087F5B] flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#064E3B]">AI Food Assistance & Fallback</h3>
              <p className="text-xs text-[#707B73] leading-relaxed">
                Dual fallback engine powered by Gemini AI when online, automatically transitioning to local phonetic dictionary matching when quota or connectivity expires.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsVoiceModalOpen(true)}
                className="py-2.5 px-4 rounded-lg bg-[#087F5B] hover:bg-[#064E3B] text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Try Voice AI Assistance</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION C – ACCOUNT AND ORDER FEATURES
          ========================================================================= */}
      <section className="space-y-6">
        <div className="border-b border-[#E4EBE5] pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#064E3B] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#087F5B]"></span>
              {t('features.accountOrders') || 'Account & Order Features'}
            </h2>
            <p className="text-xs sm:text-sm text-[#707B73]">
              Daily order caps, wallet balances, live tracking, order history, carts, and nominee security.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 1. Limit Details */}
          <div className={`p-6 rounded-2xl border shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow ${
            currentTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-[#E4EBE5]'
          }`}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-[#EFF7F1] text-[#087F5B] flex items-center justify-center">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[#DFF3E8] text-[#087F5B]">
                  {dailyOrderCount} / 6 Orders
                </span>
              </div>
              <h3 className="text-base font-bold text-[#064E3B]">Daily Limit Details</h3>
              <p className="text-xs text-[#707B73] leading-relaxed">
                6 orders per day budget protection. Face ID & Nominee consent required to renew limits after exhaustion.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsLimitRenewalModalOpen(true)}
              className="w-full py-2.5 px-3 rounded-lg bg-[#EFF7F1] hover:bg-[#DFF3E8] text-[#087F5B] text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>View & Renew Limit</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 2. Amount Details (Wallet) */}
          <div className={`p-6 rounded-2xl border shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow ${
            currentTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-[#E4EBE5]'
          }`}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-[#EFF7F1] text-[#087F5B] flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[#DFF3E8] text-[#087F5B]">
                  Balance: ₹{walletBalance.toFixed(0)}
                </span>
              </div>
              <h3 className="text-base font-bold text-[#064E3B]">Wallet & Amount Details</h3>
              <p className="text-xs text-[#707B73] leading-relaxed">
                Instant digital wallet with automated recharge protection and one-tap order deduction.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveView('wallet')}
              className="w-full py-2.5 px-3 rounded-lg bg-[#EFF7F1] hover:bg-[#DFF3E8] text-[#087F5B] text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>Manage Wallet</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 3. Order Tracking */}
          <div className={`p-6 rounded-2xl border shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow ${
            currentTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-[#E4EBE5]'
          }`}>
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#EFF7F1] text-[#087F5B] flex items-center justify-center">
                <Bike className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#064E3B]">Live Order Tracking</h3>
              <p className="text-xs text-[#707B73] leading-relaxed">
                Interactive OpenStreetMap live rider dispatch tracker with real-time ETA and status updates.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveView('tracking')}
              className="w-full py-2.5 px-3 rounded-lg bg-[#EFF7F1] hover:bg-[#DFF3E8] text-[#087F5B] text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>View Tracking</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 4. Order History */}
          <div className={`p-6 rounded-2xl border shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow ${
            currentTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-[#E4EBE5]'
          }`}>
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#EFF7F1] text-[#087F5B] flex items-center justify-center">
                <History className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#064E3B]">Order History & Bills</h3>
              <p className="text-xs text-[#707B73] leading-relaxed">
                Review past instant orders, recurring scheduled meal logs, and generate monthly GST summary invoices.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveView('orders')}
              className="w-full py-2.5 px-3 rounded-lg bg-[#EFF7F1] hover:bg-[#DFF3E8] text-[#087F5B] text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>Open History</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 5. My Cart */}
          <div className={`p-6 rounded-2xl border shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow ${
            currentTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-[#E4EBE5]'
          }`}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-[#EFF7F1] text-[#087F5B] flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                {scheduleCart.length > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[#DFF3E8] text-[#087F5B]">
                    {scheduleCart.length} Items
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-[#064E3B]">My Cart (Schedule Cart)</h3>
              <p className="text-xs text-[#707B73] leading-relaxed">
                Manage dishes queued for batch schedule checkout, weekday meal allocations, and recurring orders.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsScheduleCartModalOpen(true)}
              className="w-full py-2.5 px-3 rounded-lg bg-[#EFF7F1] hover:bg-[#DFF3E8] text-[#087F5B] text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>View Cart</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 6. Nominee Management */}
          <div className={`p-6 rounded-2xl border shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow ${
            currentTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-[#E4EBE5]'
          }`}>
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#EFF7F1] text-[#087F5B] flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#064E3B]">Nominee Guardianship</h3>
              <p className="text-xs text-[#707B73] leading-relaxed">
                Manage restricted food catalog items, approval requests, guardian email alerts, and PIN security.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsNomineeModalOpen(true)}
              className="w-full py-2.5 px-3 rounded-lg bg-[#EFF7F1] hover:bg-[#DFF3E8] text-[#087F5B] text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>Nominee Portal</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 7. Linked Bank Account */}
          <div className={`p-6 rounded-2xl border shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow ${
            currentTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-[#E4EBE5]'
          }`}>
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#EFF7F1] text-[#087F5B] flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#064E3B]">Linked Bank Account</h3>
              <p className="text-xs text-[#707B73] leading-relaxed">
                Securely review authorized linked payment accounts, IFSC routing, and auto-debit thresholds.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveView('wallet')}
              className="w-full py-2.5 px-3 rounded-lg bg-[#EFF7F1] hover:bg-[#DFF3E8] text-[#087F5B] text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>View Bank Settings</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

