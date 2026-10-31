import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Mic,
  Sparkles,
  HeartPulse,
  Calendar,
  Receipt,
  BarChart3,
  Wallet,
  ShieldCheck,
  Lock,
  Users,
  Building2,
  Bike,
  ShoppingBag,
  Globe2,
  Type,
  Sun,
  Moon,
  ArrowRight
} from 'lucide-react';
import { Language } from '../types';

export const FeaturesPage: React.FC = () => {
  const {
    language,
    setLanguage,
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
    t
  } = useApp();

  const currentTheme =
    accessibilitySettings.themeMode ||
    (accessibilitySettings.highContrast ? 'high-contrast' : 'light');

  return (
    <div className="w-full max-w-6xl mx-auto py-8 sm:py-12 px-4 sm:px-6 space-y-12 sm:space-y-16 animate-fade-in pb-16">
      {/* Page Header matching PDF Page 2 */}
      <div className="text-center space-y-3 max-w-3xl mx-auto">
        <h1 className="font-serif-editorial text-3xl sm:text-5xl font-bold text-[#33251F] tracking-tight leading-tight">
          Everything you need to{' '}
          <span className="text-[#D93636]">order smarter</span>
        </h1>
        <p className="text-sm sm:text-base text-[#8A817A] leading-relaxed">
          AutoFeast AI brings together voice, intelligence, and safety to make every meal effortless.
        </p>
      </div>

      {/* =========================================================================
          GROUP 1 – DISCOVER & RECOMMEND
          ========================================================================= */}
      <section className="space-y-5">
        <div className="border-b border-[#F0E5DC] pb-2.5">
          <h2 className="font-bold text-lg sm:text-xl text-[#33251F]">
            Discover & Recommend
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* 1. Voice Search */}
          <div className="bg-white rounded-2xl p-5 border border-[#F0E5DC] shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#FBE9E5] text-[#D93636] flex items-center justify-center">
                <Mic className="w-6 h-6 text-[#D93636]" />
              </div>
              <h3 className="font-bold text-base text-[#33251F]">Voice Search</h3>
              <p className="text-xs text-[#8A817A] leading-relaxed">
                Order hands-free in Tamil, Hindi, or English with local Whisper fallback.
              </p>
            </div>
            <div className="pt-4">
              <button
                type="button"
                onClick={() => setIsVoiceModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D93636] hover:text-[#C02B2B] transition-colors cursor-pointer group"
              >
                <span>Open</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </button>
            </div>
          </div>

          {/* 2. Recommendation System */}
          <div className="bg-white rounded-2xl p-5 border border-[#F0E5DC] shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#FBE9E5] text-[#D93636] flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-[#D93636]" />
              </div>
              <h3 className="font-bold text-base text-[#33251F]">Recommendation System</h3>
              <p className="text-xs text-[#8A817A] leading-relaxed">
                Personalized dietary and taste suggestions based on past orders and nutrition.
              </p>
            </div>
            <div className="pt-4">
              <button
                type="button"
                onClick={() => setIsHealthModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D93636] hover:text-[#C02B2B] transition-colors cursor-pointer group"
              >
                <span>Open</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </button>
            </div>
          </div>

          {/* 3. Healthy Food Recommendations */}
          <div className="bg-white rounded-2xl p-5 border border-[#F0E5DC] shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#FBE9E5] text-[#D93636] flex items-center justify-center">
                <HeartPulse className="w-6 h-6 text-[#D93636]" />
              </div>
              <h3 className="font-bold text-base text-[#33251F]">Healthy Food Recommendations</h3>
              <p className="text-xs text-[#8A817A] leading-relaxed">
                Nutrient-balanced vegetarian dishes vetted against personal health guidelines.
              </p>
            </div>
            <div className="pt-4">
              <button
                type="button"
                onClick={() => {
                  setActiveView('home');
                  setTimeout(() => {
                    const el = document.getElementById('recommended-dishes-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D93636] hover:text-[#C02B2B] transition-colors cursor-pointer group"
              >
                <span>Open</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </button>
            </div>
          </div>

          {/* 4. Auto Scheduler */}
          <div className="bg-white rounded-2xl p-5 border border-[#F0E5DC] shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#FBE9E5] text-[#D93636] flex items-center justify-center">
                <Calendar className="w-6 h-6 text-[#D93636]" />
              </div>
              <h3 className="font-bold text-base text-[#33251F]">Auto Scheduler</h3>
              <p className="text-xs text-[#8A817A] leading-relaxed">
                Set weekly automated meal deliveries with weekday customization and auto-checkout.
              </p>
            </div>
            <div className="pt-4">
              <button
                type="button"
                onClick={() => setActiveView('schedule')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D93636] hover:text-[#C02B2B] transition-colors cursor-pointer group"
              >
                <span>Open</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          GROUP 2 – BILLS & PAYMENTS
          ========================================================================= */}
      <section className="space-y-5">
        <div className="border-b border-[#F0E5DC] pb-2.5">
          <h2 className="font-bold text-lg sm:text-xl text-[#33251F]">
            Bills & Payments
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* 1. Bill Generation */}
          <div className="bg-white rounded-2xl p-5 border border-[#F0E5DC] shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#FBE9E5] text-[#D93636] flex items-center justify-center">
                <Receipt className="w-6 h-6 text-[#D93636]" />
              </div>
              <h3 className="font-bold text-base text-[#33251F]">Bill Generation</h3>
              <p className="text-xs text-[#8A817A] leading-relaxed">
                Transparent breakdown of item rates, packaging charges, GST, and savings.
              </p>
            </div>
            <div className="pt-4">
              <button
                type="button"
                onClick={() => setActiveView('schedule')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D93636] hover:text-[#C02B2B] transition-colors cursor-pointer group"
              >
                <span>Open</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </button>
            </div>
          </div>

          {/* 2. Live App Price Comparison */}
          <div className="bg-white rounded-2xl p-5 border border-[#F0E5DC] shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#FBE9E5] text-[#D93636] flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-[#D93636]" />
              </div>
              <h3 className="font-bold text-base text-[#33251F]">Live App Price Comparison</h3>
              <p className="text-xs text-[#8A817A] leading-relaxed">
                Real-time price comparisons between Swiggy, Zomato, and direct platform.
              </p>
            </div>
            <div className="pt-4">
              <button
                type="button"
                onClick={() => {
                  setActiveView('home');
                  setTimeout(() => {
                    const el = document.getElementById('dynamic-food-search-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D93636] hover:text-[#C02B2B] transition-colors cursor-pointer group"
              >
                <span>Open</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </button>
            </div>
          </div>

          {/* 3. Amount Details */}
          <div className="bg-white rounded-2xl p-5 border border-[#F0E5DC] shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#FBE9E5] text-[#D93636] flex items-center justify-center">
                <Wallet className="w-6 h-6 text-[#D93636]" />
              </div>
              <h3 className="font-bold text-base text-[#33251F]">Amount Details</h3>
              <p className="text-xs text-[#8A817A] leading-relaxed">
                Comprehensive ledger of spent amounts, remaining daily allowance, and linked wallet.
              </p>
            </div>
            <div className="pt-4">
              <button
                type="button"
                onClick={() => setActiveView('wallet')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D93636] hover:text-[#C02B2B] transition-colors cursor-pointer group"
              >
                <span>Open</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </button>
            </div>
          </div>

          {/* 4. Daily Limit */}
          <div className="bg-white rounded-2xl p-5 border border-[#F0E5DC] shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#FBE9E5] text-[#D93636] flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-[#D93636]" />
              </div>
              <h3 className="font-bold text-base text-[#33251F]">Daily Limit</h3>
              <p className="text-xs text-[#8A817A] leading-relaxed">
                Configurable daily spending limit safeguards to prevent budget overruns.
              </p>
            </div>
            <div className="pt-4">
              <button
                type="button"
                onClick={() => setIsLimitRenewalModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D93636] hover:text-[#C02B2B] transition-colors cursor-pointer group"
              >
                <span>Open</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          GROUP 3 – SAFETY & FAMILY
          ========================================================================= */}
      <section className="space-y-5">
        <div className="border-b border-[#F0E5DC] pb-2.5">
          <h2 className="font-bold text-lg sm:text-xl text-[#33251F]">
            Safety & Family
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* 1. Security PIN Verification */}
          <div className="bg-white rounded-2xl p-5 border border-[#F0E5DC] shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#FBE9E5] text-[#D93636] flex items-center justify-center">
                <Lock className="w-6 h-6 text-[#D93636]" />
              </div>
              <h3 className="font-bold text-base text-[#33251F]">Security PIN Verification</h3>
              <p className="text-xs text-[#8A817A] leading-relaxed">
                Mandatory 4-digit security PIN verification for order authorization and protection.
              </p>
            </div>
            <div className="pt-4">
              <button
                type="button"
                onClick={() => setActiveView('wallet')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D93636] hover:text-[#C02B2B] transition-colors cursor-pointer group"
              >
                <span>Open</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </button>
            </div>
          </div>

          {/* 2. Nominee Management */}
          <div className="bg-white rounded-2xl p-5 border border-[#F0E5DC] shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#FBE9E5] text-[#D93636] flex items-center justify-center">
                <Users className="w-6 h-6 text-[#D93636]" />
              </div>
              <h3 className="font-bold text-base text-[#33251F]">Nominee Management</h3>
              <p className="text-xs text-[#8A817A] leading-relaxed">
                Assign trusted family members to review and approve orders exceeding your limit.
              </p>
            </div>
            <div className="pt-4">
              <button
                type="button"
                onClick={() => setIsNomineeModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D93636] hover:text-[#C02B2B] transition-colors cursor-pointer group"
              >
                <span>Open</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </button>
            </div>
          </div>

          {/* 3. Linked Bank Account */}
          <div className="bg-white rounded-2xl p-5 border border-[#F0E5DC] shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#FBE9E5] text-[#D93636] flex items-center justify-center">
                <Building2 className="w-6 h-6 text-[#D93636]" />
              </div>
              <h3 className="font-bold text-base text-[#33251F]">Linked Bank Account</h3>
              <p className="text-xs text-[#8A817A] leading-relaxed">
                Direct bank integration for zero-fee payments, balance checks, and instant refunds.
              </p>
            </div>
            <div className="pt-4">
              <button
                type="button"
                onClick={() => setActiveView('wallet')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D93636] hover:text-[#C02B2B] transition-colors cursor-pointer group"
              >
                <span>Open</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          GROUP 4 – ORDERS
          ========================================================================= */}
      <section className="space-y-5">
        <div className="border-b border-[#F0E5DC] pb-2.5">
          <h2 className="font-bold text-lg sm:text-xl text-[#33251F]">
            Orders
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* 1. Order Tracking */}
          <div className="bg-white rounded-2xl p-5 border border-[#F0E5DC] shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#FBE9E5] text-[#D93636] flex items-center justify-center">
                <Bike className="w-6 h-6 text-[#D93636]" />
              </div>
              <h3 className="font-bold text-base text-[#33251F]">Order Tracking</h3>
              <p className="text-xs text-[#8A817A] leading-relaxed">
                Live OpenStreetMap GPS rider tracking with real-time ETA and status.
              </p>
            </div>
            <div className="pt-4">
              <button
                type="button"
                onClick={() => setActiveView('live-tracker')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D93636] hover:text-[#C02B2B] transition-colors cursor-pointer group"
              >
                <span>Open</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </button>
            </div>
          </div>

          {/* 2. Cart & Order History */}
          <div className="bg-white rounded-2xl p-5 border border-[#F0E5DC] shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#FBE9E5] text-[#D93636] flex items-center justify-center">
                <ShoppingBag className="w-6 h-6 text-[#D93636]" />
              </div>
              <h3 className="font-bold text-base text-[#33251F]">Cart & Order History</h3>
              <p className="text-xs text-[#8A817A] leading-relaxed">
                Instant cart, schedule weekly orders, and past transaction receipts.
              </p>
            </div>
            <div className="pt-4">
              <button
                type="button"
                onClick={() => setIsScheduleCartModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D93636] hover:text-[#C02B2B] transition-colors cursor-pointer group"
              >
                <span>Open</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          INTERACTIVE SETTINGS SECTION (Preserves Display, Theme & Language toggles)
          ========================================================================= */}
      <section className="p-6 sm:p-8 rounded-2xl border border-[#F0E5DC] bg-white space-y-6">
        <div>
          <h2 className="font-bold text-lg sm:text-xl text-[#33251F]">
            Display & Language Controls
          </h2>
          <p className="text-xs text-[#8A817A]">
            Customize visual theme, font size, and interface language.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Language Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-[#D93636]" />
              <span className="text-xs font-bold text-[#33251F]">Interface Language</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { code: 'en' as Language, label: 'English' },
                { code: 'ta' as Language, label: 'தமிழ்' },
                { code: 'hi' as Language, label: 'हिन्दी' }
              ].map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setLanguage(l.code)}
                  className={`py-2 px-2.5 rounded-lg text-xs font-bold border text-center transition-all cursor-pointer ${
                    language === l.code
                      ? 'bg-[#FBE9E5] text-[#D93636] border-[#D93636]'
                      : 'bg-white text-[#33251F] border-[#F0E5DC] hover:bg-[#FFF8F0]'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Type className="w-4 h-4 text-[#D93636]" />
              <span className="text-xs font-bold text-[#33251F]">Typography Scale</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(['sm', 'md', 'lg', 'xl'] as const).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setTextSize(sz)}
                  className={`py-2 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
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

          {/* Theme */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-[#D93636]" />
              <span className="text-xs font-bold text-[#33251F]">Theme Mode</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setThemeMode('light');
                  setHighContrast(false);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 cursor-pointer ${
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
                className={`py-2 px-3 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 cursor-pointer ${
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
      </section>
    </div>
  );
};
