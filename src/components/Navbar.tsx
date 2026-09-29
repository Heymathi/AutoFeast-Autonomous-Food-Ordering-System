import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Language } from '../types';
import {
  Search,
  Calendar,
  Wallet,
  History,
  Eye,
  LogOut,
  Sparkles,
  ShieldCheck,
  PackageCheck,
  Bike,
  Scan,
  Navigation,
  Edit3,
  AlertTriangle,
  Mic,
  LogIn,
  Sun,
  Moon,
  Globe,
  Menu,
  X,
  HeartPulse,
  Lock
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    activeView,
    setActiveView,
    walletBalance,
    isWalletRevealed,
    requestWalletBalanceReveal,
    language,
    setLanguage,
    setIsLanguageModalOpen,
    accessibilitySettings,
    setAccessibilitySettings,
    t,
    speakText,
    logout,
    currentUser,
    userLocation,
    setIsLocationModalOpen,
    dailyOrderCount,
    linkedBank,
    registerFaceIDOnDevice,
    activeLiveOrder,
    setIsVoiceModalOpen,
    isHealthModalOpen,
    setIsHealthModalOpen,
    setIsLimitRenewalModalOpen,
    setIsAuthGateOpen,
    showToast
  } = useApp();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value as Language;
    setLanguage(newLang);
    const langMsg =
      newLang === 'ta'
        ? 'தமிழ் மொழி தேர்ந்தெடுக்கப்பட்டது'
        : newLang === 'hi'
        ? 'हिंदी भाषा चुनी गई'
        : 'English Language Selected';
    speakText(langMsg);
  };

  const handleThemeChange = (mode: 'light' | 'dark' | 'high-contrast') => {
    const isHC = mode === 'high-contrast';
    setAccessibilitySettings(prev => ({
      ...prev,
      themeMode: mode,
      highContrast: isHC
    }));
    const msg =
      mode === 'light'
        ? 'Light theme activated'
        : mode === 'dark'
        ? 'Dark theme activated'
        : 'High contrast theme activated';
    speakText(msg);
  };

  const currentTheme =
    accessibilitySettings.themeMode ||
    (accessibilitySettings.highContrast ? 'high-contrast' : 'light');

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <header
      className={`sticky top-0 z-40 shadow-md transition-colors duration-200 w-full ${
        currentTheme === 'high-contrast'
          ? 'bg-black text-white border-b-4 border-yellow-400'
          : currentTheme === 'dark'
          ? 'bg-slate-900 text-slate-100 border-b border-slate-700'
          : 'bg-[#DAF0F7] text-[#1A1110] border-b border-[#B2E2F0]'
      }`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5">
        
        {/* MAIN TOP BAR (FLUID RESPONSIVE CONTAINMENT) */}
        <div className="flex items-center justify-between gap-2">
          
          {/* LOGO & GPS LOCATION BADGE */}
          <div className="flex items-center space-x-2 shrink-0">
            <div
              className="bg-[#FF5A1F] p-2 rounded-xl shadow-md flex items-center justify-center cursor-pointer hover:bg-[#E04812] transition-colors"
              onClick={() => { setActiveView('search'); closeMobileMenu(); }}
              title="Go to AutoFeast Home"
            >
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h1
                className={`text-base sm:text-lg font-black tracking-tight flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  currentTheme === 'dark' || currentTheme === 'high-contrast' ? 'text-white' : 'text-[#1A1110]'
                }`}
                onClick={() => { setActiveView('search'); closeMobileMenu(); }}
              >
                AutoFeast AI
              </h1>

              {/* GPS Live Location Indicator Button */}
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(true)}
                className={`mt-0.5 flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-black transition-all border shadow-xs cursor-pointer max-w-[140px] sm:max-w-[200px] truncate ${
                  userLocation.isManualOverride
                    ? 'bg-blue-900/10 text-blue-900 border-blue-400/50 hover:bg-blue-900/20'
                    : userLocation.isApproximate
                    ? 'bg-[#C2185B]/10 text-[#C2185B] border-[#C2185B]/40 hover:bg-[#C2185B]/20 animate-pulse'
                    : 'bg-white text-[#1A1110] border-[#4A5568]/30 hover:bg-slate-50'
                }`}
                title="Click to Change Delivery Location"
              >
                {userLocation.isManualOverride ? (
                  <Edit3 className="w-3 h-3 text-blue-600 shrink-0" />
                ) : userLocation.isApproximate ? (
                  <AlertTriangle className="w-3 h-3 text-[#C2185B] shrink-0" />
                ) : (
                  <Navigation className="w-3 h-3 text-[#FF5A1F] animate-spin shrink-0" style={{ animationDuration: '6s' }} />
                )}

                <span className="truncate">
                  {userLocation.isManualOverride
                    ? `✏️ ${userLocation.area}`
                    : userLocation.isApproximate
                    ? `⚠️ ${userLocation.city}`
                    : `📍 ${userLocation.area}, ${userLocation.city}`}
                </span>
              </button>
            </div>
          </div>

          {/* DESKTOP NAVIGATION LINKS (VISIBLE ONLY ON LARGE SCREENS ≥ 1024px) */}
          <nav className="hidden lg:flex items-center space-x-1 bg-white/90 p-1.5 rounded-xl border border-[#B2E2F0] shadow-xs">
            <button
              type="button"
              onClick={() => setActiveView('search')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                activeView === 'search'
                  ? 'bg-[#FF5A1F] text-white shadow-xs'
                  : 'hover:bg-[#DAF0F7] text-[#1A1110]'
              }`}
            >
              <Search className="w-4 h-4 shrink-0" />
              <span>{t('nav.search')}</span>
            </button>

            {activeLiveOrder && (
              <button
                type="button"
                onClick={() => setActiveView('tracking')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all animate-bounce cursor-pointer ${
                  activeView === 'tracking'
                    ? 'bg-[#16A34A] text-white shadow-md'
                    : 'bg-[#16A34A] hover:bg-[#15803D] text-white'
                }`}
              >
                <Bike className="w-4 h-4 text-yellow-300 shrink-0" />
                <span>Track Order</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveView('scheduler')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                activeView === 'scheduler'
                  ? 'bg-[#FF5A1F] text-white shadow-xs'
                  : 'hover:bg-[#DAF0F7] text-[#1A1110]'
              }`}
            >
              <Calendar className="w-4 h-4 shrink-0" />
              <span>{t('nav.schedule')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (isWalletRevealed) {
                  setActiveView('wallet');
                } else {
                  requestWalletBalanceReveal();
                }
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                activeView === 'wallet'
                  ? 'bg-[#FF5A1F] text-white shadow-xs'
                  : 'hover:bg-[#DAF0F7] text-[#1A1110]'
              }`}
              title={
                isWalletRevealed
                  ? `Wallet Balance: ₹${walletBalance.toFixed(0)} • Bank: ${linkedBank.bankName}`
                  : language === 'ta'
                  ? 'இருப்பைக் காண கிளிக் செய்யவும் (PIN தேவை)'
                  : language === 'hi'
                  ? 'बैलेंस देखने के लिए क्लिक करें (पिन आवश्यक)'
                  : 'Click to show balance (PIN Required)'
              }
            >
              {isWalletRevealed ? (
                <>
                  <Eye className="w-4 h-4 text-[#16A34A] shrink-0 animate-pulse" />
                  <span>₹{walletBalance.toFixed(0)}</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{t('wallet.maskedLabel')}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsLimitRenewalModalOpen(true)}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-black transition-all border cursor-pointer ${
                dailyOrderCount >= 6
                  ? 'bg-[#C2185B] text-white border-[#C2185B] animate-bounce'
                  : 'bg-white hover:bg-[#DAF0F7] text-[#1A1110] border-[#4A5568]/30'
              }`}
              title={`Daily Limit: ${dailyOrderCount}/6 Today`}
            >
              <PackageCheck className={`w-4 h-4 shrink-0 ${dailyOrderCount >= 6 ? 'text-white' : 'text-[#FF5A1F]'}`} />
              <span>Limit: {dailyOrderCount}/6</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('orders')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                activeView === 'orders'
                  ? 'bg-[#FF5A1F] text-white shadow-xs'
                  : 'hover:bg-[#DAF0F7] text-[#1A1110]'
              }`}
            >
              <History className="w-4 h-4 shrink-0" />
              <span>{t('nav.orders')}</span>
            </button>
          </nav>

          {/* DESKTOP CONTROLS (VISIBLE ONLY ON LARGE SCREENS ≥ 1024px) */}
          <div className="hidden lg:flex items-center space-x-2 shrink-0">
            
            {/* User Profile */}
            {currentUser ? (
              <div className="flex items-center space-x-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-[#B2E2F0] shadow-xs">
                <div className="p-1 bg-[#FF5A1F] rounded-lg text-white shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-black text-[#1A1110] max-w-[90px] truncate">{currentUser.name}</span>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await registerFaceIDOnDevice();
                    if (res.success) {
                      showToast('Face ID registered!');
                      speakText('Face ID registered!');
                    }
                  }}
                  className="p-1 hover:bg-[#DAF0F7] rounded-md text-[#FF5A1F] transition-colors cursor-pointer shrink-0"
                  title="Link Face ID (WebAuthn)"
                >
                  <Scan className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthGateOpen(true)}
                className="flex items-center space-x-1 bg-[#FF5A1F] text-white font-black px-3 py-1.5 rounded-xl text-xs shadow-sm hover:bg-[#E04812] cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </button>
            )}

            {/* Voice Assistant Mic Button */}
            <button
              type="button"
              onClick={() => setIsVoiceModalOpen(true)}
              className="flex items-center space-x-1.5 bg-[#FF5A1F] hover:bg-[#E04812] text-white font-black px-3 py-1.5 rounded-xl text-xs shadow-sm transition-transform hover:scale-102 cursor-pointer"
            >
              <Mic className="w-4 h-4 text-white animate-pulse" />
              <span>{t('search.voice')}</span>
            </button>

            {/* Healthy Food AI Guide Button */}
            <button
              type="button"
              onClick={() => setIsHealthModalOpen(true)}
              className="flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black px-3 py-1.5 rounded-xl text-xs shadow-sm transition-transform hover:scale-102 cursor-pointer border border-rose-400"
              title="Voice Food Suggestions by Health Context"
            >
              <HeartPulse className="w-4 h-4 text-yellow-300 animate-pulse" />
              <span>{t('nav.healthyFood')}</span>
            </button>



            {/* Theme Selector */}
            <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-[#4A5568]/30 shadow-xs">
              <button
                type="button"
                onClick={() => handleThemeChange('light')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  currentTheme === 'light' ? 'bg-[#FF5A1F] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Light Theme"
              >
                <Sun className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleThemeChange('dark')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  currentTheme === 'dark' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Dark Theme"
              >
                <Moon className="w-4 h-4" />
              </button>
            </div>

            {/* Logout Button */}
            <button
              type="button"
              onClick={logout}
              className="p-2 bg-[#C2185B] hover:bg-[#A3134C] text-white rounded-xl shadow-xs transition-all cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-4 h-4 text-white" />
            </button>

          </div>

          {/* MOBILE / TABLET RIGHT CONTROLS (< 1024px) */}
          <div className="flex lg:hidden items-center space-x-1.5 shrink-0">
            
            {/* Quick Healthy Food Button */}
            <button
              type="button"
              onClick={() => setIsHealthModalOpen(true)}
              className="flex items-center space-x-1 bg-rose-600 hover:bg-rose-700 text-white font-black px-2.5 py-1.5 rounded-xl text-xs shadow-sm border border-rose-400 cursor-pointer"
              title="Voice Food Suggestions by Health Context"
            >
              <HeartPulse className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
              <span>{t('nav.healthyFood')}</span>
            </button>

            {/* Quick Voice Mic */}
            <button
              type="button"
              onClick={() => setIsVoiceModalOpen(true)}
              className="p-2 bg-[#FF5A1F] text-white rounded-xl shadow-sm hover:bg-[#E04812] cursor-pointer"
              title="Voice Search"
            >
              <Mic className="w-4 h-4 animate-pulse text-white" />
            </button>

            {/* Hamburger / Close Menu Toggle Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 bg-white text-[#1A1110] border border-[#B2E2F0] rounded-xl shadow-xs hover:bg-[#DAF0F7] transition-all cursor-pointer"
              title="Toggle Menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6 text-[#C2185B]" /> : <Menu className="w-6 h-6 text-[#1A1110]" />}
            </button>

          </div>

        </div>

        {/* MOBILE SLIDE-DOWN DRAWER MENU (< 1024px) */}
        {isMobileMenuOpen && (
          <div className="lg:hidden mt-3 pt-3 border-t border-[#B2E2F0] space-y-3 bg-white/95 p-4 rounded-2xl shadow-xl animate-fadeIn">
            
            {/* Nav Links Grid */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setActiveView('search'); closeMobileMenu(); }}
                className={`flex items-center space-x-2 p-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                  activeView === 'search' ? 'bg-[#FF5A1F] text-white' : 'bg-[#DAF0F7]/50 text-[#1A1110]'
                }`}
              >
                <Search className="w-4 h-4" />
                <span>{t('nav.search')}</span>
              </button>

              {activeLiveOrder && (
                <button
                  type="button"
                  onClick={() => { setActiveView('tracking'); closeMobileMenu(); }}
                  className="flex items-center space-x-2 p-2.5 rounded-xl font-black text-xs bg-[#16A34A] text-white transition-all cursor-pointer"
                >
                  <Bike className="w-4 h-4 text-yellow-300" />
                  <span>Track Order</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => { setActiveView('scheduler'); closeMobileMenu(); }}
                className={`flex items-center space-x-2 p-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                  activeView === 'scheduler' ? 'bg-[#FF5A1F] text-white' : 'bg-[#DAF0F7]/50 text-[#1A1110]'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>{t('nav.schedule')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isWalletRevealed) {
                    setActiveView('wallet');
                    closeMobileMenu();
                  } else {
                    closeMobileMenu();
                    requestWalletBalanceReveal();
                  }
                }}
                className={`flex items-center space-x-2 p-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                  activeView === 'wallet' ? 'bg-[#FF5A1F] text-white' : 'bg-[#DAF0F7]/50 text-[#1A1110]'
                }`}
              >
                {isWalletRevealed ? (
                  <>
                    <Eye className="w-4 h-4 text-[#16A34A] shrink-0" />
                    <span>₹{walletBalance.toFixed(0)}</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{t('wallet.maskedLabel')}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setIsLimitRenewalModalOpen(true); closeMobileMenu(); }}
                className="flex items-center space-x-2 p-2.5 rounded-xl font-black text-xs bg-slate-100 text-[#1A1110] border border-slate-300 cursor-pointer"
              >
                <PackageCheck className="w-4 h-4 text-[#FF5A1F]" />
                <span>Limit: {dailyOrderCount}/6</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveView('orders'); closeMobileMenu(); }}
                className={`flex items-center space-x-2 p-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                  activeView === 'orders' ? 'bg-[#FF5A1F] text-white' : 'bg-[#DAF0F7]/50 text-[#1A1110]'
                }`}
              >
                <History className="w-4 h-4" />
                <span>{t('nav.orders')}</span>
              </button>

              <button
                type="button"
                onClick={() => { setIsHealthModalOpen(true); closeMobileMenu(); }}
                className="flex items-center space-x-2 p-2.5 rounded-xl font-black text-xs bg-rose-600 text-white border border-rose-400 cursor-pointer transition-all col-span-2 shadow-xs"
              >
                <HeartPulse className="w-4 h-4 text-yellow-300 animate-pulse" />
                <span>{t('nav.healthyFood')}</span>
              </button>
            </div>

            {/* User Profile & Voice Search Row */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
              {currentUser ? (
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-[#FF5A1F] rounded-xl text-white">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-black text-[#1A1110]">{currentUser.name}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setIsAuthGateOpen(true); closeMobileMenu(); }}
                  className="flex items-center space-x-1.5 bg-[#FF5A1F] text-white font-black px-3 py-1.5 rounded-xl text-xs cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </button>
              )}


            </div>

            {/* Theme & Logout Row */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-extrabold text-[#4A5568]">Theme:</span>
                <button
                  type="button"
                  onClick={() => handleThemeChange('light')}
                  className={`p-2 rounded-xl border ${currentTheme === 'light' ? 'bg-[#FF5A1F] text-white' : 'bg-slate-100 text-slate-700'}`}
                >
                  <Sun className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  className={`p-2 rounded-xl border ${currentTheme === 'dark' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
                >
                  <Moon className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => { logout(); closeMobileMenu(); }}
                className="flex items-center space-x-1.5 px-3 py-2 bg-[#C2185B] text-white rounded-xl text-xs font-black cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>

          </div>
        )}

      </div>
    </header>
  );
};
