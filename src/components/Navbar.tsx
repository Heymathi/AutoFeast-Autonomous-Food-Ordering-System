import React, { useState, useEffect, useRef } from 'react';
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
  Lock,
  ShoppingBag
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
    setIsHealthModalOpen,
    setIsLimitRenewalModalOpen,
    setIsAuthGateOpen,
    setIsNomineeModalOpen,
    pendingNomineeApprovals,
    showToast,
    scheduleCart,
    isScheduleCartModalOpen,
    setIsScheduleCartModalOpen
  } = useApp();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileMenuOpen]);

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
      className={`sticky top-0 z-40 shadow-md transition-colors duration-200 w-full [container-type:inline-size] @container ${
        currentTheme === 'high-contrast'
          ? 'bg-black text-white border-b-4 border-yellow-400'
          : currentTheme === 'dark'
          ? 'bg-slate-900 text-slate-100 border-b border-slate-700'
          : 'bg-[#DAF0F7] text-[#1A1110] border-b border-[#B2E2F0]'
      }`}
    >
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2" ref={menuRef}>
        
        {/* MAIN TOP BAR (FLUID RESPONSIVE CONTAINMENT WITH MIN 0 & FLEX WRAP) */}
        <div className="flex items-center justify-between gap-2 flex-wrap min-w-0">
          
          {/* LOGO & GPS LOCATION BADGE (ALWAYS VISIBLE) */}
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            <div
              className="bg-[#FF5A1F] min-h-[44px] min-w-[44px] p-2.5 rounded-xl shadow-md flex items-center justify-center cursor-pointer hover:bg-[#E04812] transition-colors"
              onClick={() => { setActiveView('search'); closeMobileMenu(); }}
              title="Go to AutoFeast Home"
              tabIndex={0}
              role="button"
              aria-label="AutoFeast Home"
            >
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
            </div>

            <div className="min-w-0 flex flex-col justify-center">
              <h1
                className={`text-[clamp(1rem,2vw,1.15rem)] font-black tracking-tight leading-tight cursor-pointer flex items-center gap-1 ${
                  currentTheme === 'dark' || currentTheme === 'high-contrast' ? 'text-white' : 'text-[#1A1110]'
                }`}
                onClick={() => { setActiveView('search'); closeMobileMenu(); }}
              >
                AutoFeast AI
              </h1>

              {/* GPS Live Location Button (Fluid min-h 44px touch target fallback) */}
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(true)}
                className={`mt-0.5 min-h-[32px] sm:min-h-[36px] flex items-center gap-1 px-2.5 py-1 rounded-xl text-[clamp(0.65rem,1.2vw,0.75rem)] font-black leading-snug transition-all border shadow-xs cursor-pointer max-w-[150px] sm:max-w-[260px] ${
                  userLocation.isManualOverride
                    ? 'bg-blue-900/10 text-blue-900 border-blue-400/50 hover:bg-blue-900/20'
                    : userLocation.isApproximate
                    ? 'bg-[#C2185B]/10 text-[#C2185B] border-[#C2185B]/40 hover:bg-[#C2185B]/20 animate-pulse'
                    : 'bg-white text-[#1A1110] border-[#4A5568]/30 hover:bg-slate-50'
                }`}
                title="Click to Change Delivery Location"
                aria-label="Change Delivery Location"
              >
                {userLocation.isManualOverride ? (
                  <Edit3 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                ) : userLocation.isApproximate ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-[#C2185B] shrink-0" />
                ) : (
                  <Navigation className="w-3.5 h-3.5 text-[#FF5A1F] animate-spin shrink-0" style={{ animationDuration: '6s' }} />
                )}

                <span className="line-clamp-1 truncate leading-tight">
                  {userLocation.isManualOverride
                    ? `✏️ ${userLocation.area}`
                    : userLocation.isApproximate
                    ? `⚠️ ${userLocation.city}`
                    : `📍 ${userLocation.area}, ${userLocation.city}`}
                </span>
              </button>
            </div>
          </div>

          {/* DESKTOP & TABLET NAVIGATION LINKS (PRIORITY COLLAPSE AT CONTAINER WIDTH OR MD) */}
          <nav className="hidden md:flex flex-wrap items-center gap-[clamp(0.25rem,0.5vw,0.5rem)] bg-white/90 dark:bg-slate-800/90 p-1.5 rounded-2xl border border-[#B2E2F0] dark:border-slate-700 shadow-xs min-w-0">
            
            {/* Search */}
            <button
              type="button"
              onClick={() => setActiveView('search')}
              className={`min-h-[44px] flex items-center gap-1.5 px-[clamp(0.5rem,1vw,0.75rem)] py-[clamp(0.35rem,0.8vw,0.5rem)] rounded-xl text-[clamp(0.7rem,1.1vw,0.8rem)] font-black leading-tight transition-all cursor-pointer ${
                activeView === 'search'
                  ? 'bg-[#FF5A1F] text-white shadow-xs'
                  : 'hover:bg-[#DAF0F7] dark:hover:bg-slate-700 text-[#1A1110] dark:text-white'
              }`}
            >
              <Search className="w-4 h-4 shrink-0" />
              <span className="line-clamp-2 text-left">{t('nav.search')}</span>
            </button>

            {/* Track Live Order */}
            {activeLiveOrder && (
              <button
                type="button"
                onClick={() => setActiveView('tracking')}
                className={`min-h-[44px] flex items-center gap-1.5 px-[clamp(0.5rem,1vw,0.75rem)] py-[clamp(0.35rem,0.8vw,0.5rem)] rounded-xl text-[clamp(0.7rem,1.1vw,0.8rem)] font-black leading-tight transition-all animate-bounce cursor-pointer ${
                  activeView === 'tracking'
                    ? 'bg-[#16A34A] text-white shadow-md'
                    : 'bg-[#16A34A] hover:bg-[#15803D] text-white'
                }`}
              >
                <Bike className="w-4 h-4 text-yellow-300 shrink-0" />
                <span className="line-clamp-2 text-left">Track Order</span>
              </button>
            )}

            {/* Auto Scheduler */}
            <button
              type="button"
              onClick={() => setActiveView('scheduler')}
              className={`min-h-[44px] flex items-center gap-1.5 px-[clamp(0.5rem,1vw,0.75rem)] py-[clamp(0.35rem,0.8vw,0.5rem)] rounded-xl text-[clamp(0.7rem,1.1vw,0.8rem)] font-black leading-tight transition-all cursor-pointer ${
                activeView === 'scheduler'
                  ? 'bg-[#FF5A1F] text-white shadow-xs'
                  : 'hover:bg-[#DAF0F7] dark:hover:bg-slate-700 text-[#1A1110] dark:text-white'
              }`}
            >
              <Calendar className="w-4 h-4 shrink-0" />
              <span className="line-clamp-2 text-left">{t('nav.schedule')}</span>
            </button>

            {/* Wallet Balance */}
            <button
              type="button"
              onClick={() => {
                if (isWalletRevealed) {
                  setActiveView('wallet');
                } else {
                  requestWalletBalanceReveal();
                }
              }}
              className={`min-h-[44px] flex items-center gap-1.5 px-[clamp(0.5rem,1vw,0.75rem)] py-[clamp(0.35rem,0.8vw,0.5rem)] rounded-xl text-[clamp(0.7rem,1.1vw,0.8rem)] font-black leading-tight transition-all cursor-pointer ${
                activeView === 'wallet'
                  ? 'bg-[#FF5A1F] text-white shadow-xs'
                  : 'hover:bg-[#DAF0F7] dark:hover:bg-slate-700 text-[#1A1110] dark:text-white'
              }`}
            >
              {isWalletRevealed ? (
                <>
                  <Eye className="w-4 h-4 text-[#16A34A] shrink-0 animate-pulse" />
                  <span className="line-clamp-1 font-bold">₹{walletBalance.toFixed(0)}</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="line-clamp-2 text-left">{t('wallet.maskedLabel')}</span>
                </>
              )}
            </button>

            {/* Limit */}
            <button
              type="button"
              onClick={() => setIsLimitRenewalModalOpen(true)}
              className={`min-h-[44px] flex items-center gap-1.5 px-[clamp(0.4rem,0.8vw,0.6rem)] py-[clamp(0.35rem,0.8vw,0.5rem)] rounded-xl text-[clamp(0.7rem,1.1vw,0.8rem)] font-black leading-tight transition-all border cursor-pointer ${
                dailyOrderCount >= 6
                  ? 'bg-[#C2185B] text-white border-[#C2185B] animate-bounce'
                  : 'bg-white dark:bg-slate-700 hover:bg-[#DAF0F7] text-[#1A1110] dark:text-white border-[#4A5568]/30'
              }`}
            >
              <PackageCheck className={`w-4 h-4 shrink-0 ${dailyOrderCount >= 6 ? 'text-white' : 'text-[#FF5A1F]'}`} />
              <span className="line-clamp-1">Limit: {dailyOrderCount}/6</span>
            </button>

            {/* Nominee Control Portal */}
            <button
              type="button"
              onClick={() => setIsNomineeModalOpen(true)}
              className="min-h-[44px] flex items-center gap-1.5 px-[clamp(0.4rem,0.8vw,0.6rem)] py-[clamp(0.35rem,0.8vw,0.5rem)] rounded-xl text-[clamp(0.7rem,1.1vw,0.8rem)] font-black leading-tight transition-all border bg-amber-500/10 border-amber-400 text-amber-900 dark:text-amber-300 hover:bg-amber-500/20 cursor-pointer relative"
            >
              <ShieldCheck className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Nominee</span>
              {pendingNomineeApprovals.filter(r => r.status === 'pending').length > 0 && (
                <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center animate-pulse shrink-0">
                  {pendingNomineeApprovals.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>

            {/* Order History */}
            <button
              type="button"
              onClick={() => setActiveView('orders')}
              className={`min-h-[44px] flex items-center gap-1.5 px-[clamp(0.5rem,1vw,0.75rem)] py-[clamp(0.35rem,0.8vw,0.5rem)] rounded-xl text-[clamp(0.7rem,1.1vw,0.8rem)] font-black leading-tight transition-all cursor-pointer ${
                activeView === 'orders'
                  ? 'bg-[#FF5A1F] text-white shadow-xs'
                  : 'hover:bg-[#DAF0F7] dark:hover:bg-slate-700 text-[#1A1110] dark:text-white'
              }`}
            >
              <History className="w-4 h-4 shrink-0" />
              <span className="line-clamp-2 text-left">{t('nav.orders')}</span>
            </button>

            {/* Schedule Cart */}
            <button
              type="button"
              onClick={() => setIsScheduleCartModalOpen(true)}
              className="min-h-[44px] flex items-center gap-1.5 px-[clamp(0.5rem,1vw,0.75rem)] py-[clamp(0.35rem,0.8vw,0.5rem)] rounded-xl text-[clamp(0.7rem,1.1vw,0.8rem)] font-black leading-tight transition-all cursor-pointer bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-400 relative"
              title="View Schedule Cart"
            >
              <ShoppingBag className="w-4 h-4 shrink-0 text-[#FF5A1F]" />
              <span className="line-clamp-1">Cart</span>
              {scheduleCart.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#FF5A1F] text-white text-[9px] font-black flex items-center justify-center animate-pulse shrink-0">
                  {scheduleCart.length}
                </span>
              )}
            </button>
          </nav>

          {/* DESKTOP CONTROLS (VOICE SEARCH, HEALTHY FOOD, USER PROFILE, THEME) */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            
            {/* Voice Assistant Mic Button */}
            <button
              type="button"
              onClick={() => setIsVoiceModalOpen(true)}
              className="min-h-[44px] flex items-center gap-1.5 bg-[#FF5A1F] hover:bg-[#E04812] text-white font-black px-3 py-2 rounded-xl text-xs shadow-sm transition-transform hover:scale-102 cursor-pointer"
            >
              <Mic className="w-4 h-4 text-white animate-pulse shrink-0" />
              <span className="leading-tight">{t('search.voice')}</span>
            </button>

            {/* Healthy Food Guide */}
            <button
              type="button"
              onClick={() => setIsHealthModalOpen(true)}
              className="min-h-[44px] flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black px-3 py-2 rounded-xl text-xs shadow-sm transition-transform hover:scale-102 cursor-pointer border border-rose-400"
            >
              <HeartPulse className="w-4 h-4 text-yellow-300 animate-pulse shrink-0" />
              <span className="leading-tight">{t('nav.healthyFood')}</span>
            </button>

            {/* User Profile / Sign In */}
            {currentUser ? (
              <div className="min-h-[44px] flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-[#B2E2F0] dark:border-slate-700 shadow-xs">
                <div className="p-1 bg-[#FF5A1F] rounded-lg text-white shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-black text-[#1A1110] dark:text-white max-w-[100px] truncate leading-tight">{currentUser.name}</span>
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
                  aria-label="Link Face ID"
                >
                  <Scan className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthGateOpen(true)}
                className="min-h-[44px] flex items-center gap-1.5 bg-[#FF5A1F] text-white font-black px-3.5 py-2 rounded-xl text-xs shadow-sm hover:bg-[#E04812] cursor-pointer"
              >
                <LogIn className="w-4 h-4 shrink-0" />
                <span>Sign In</span>
              </button>
            )}

            {/* Theme Selector */}
            <div className="min-h-[44px] flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-[#4A5568]/30 shadow-xs">
              <button
                type="button"
                onClick={() => handleThemeChange('light')}
                className={`min-h-[36px] min-w-[36px] p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                  currentTheme === 'light' ? 'bg-[#FF5A1F] text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                }`}
                title="Light Theme"
                aria-label="Light Theme"
              >
                <Sun className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleThemeChange('dark')}
                className={`min-h-[36px] min-w-[36px] p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                  currentTheme === 'dark' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                }`}
                title="Dark Theme"
                aria-label="Dark Theme"
              >
                <Moon className="w-4 h-4" />
              </button>
            </div>

            {/* Logout */}
            <button
              type="button"
              onClick={logout}
              className="min-h-[44px] min-w-[44px] p-2.5 bg-[#C2185B] hover:bg-[#A3134C] text-white rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4 text-white" />
            </button>

          </div>

          {/* MOBILE / TABLET RIGHT CONTROLS (< 768px OR COLLAPSED CONTAINER) */}
          <div className="flex md:hidden items-center gap-1.5 shrink-0">
            
            {/* Profile Pill (Always Visible on Mobile) */}
            {currentUser && (
              <div className="min-h-[44px] flex items-center gap-1 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-[#B2E2F0] dark:border-slate-700 shadow-xs">
                <ShieldCheck className="w-4 h-4 text-[#FF5A1F] shrink-0" />
                <span className="text-xs font-black text-[#1A1110] dark:text-white max-w-[80px] truncate leading-tight">{currentUser.name}</span>
              </div>
            )}

            {/* Hamburger / "More" Menu Toggle Button (Min 44px Touch Target) */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="min-h-[44px] min-w-[44px] px-3 py-2 bg-white dark:bg-slate-800 text-[#1A1110] dark:text-white border border-[#B2E2F0] dark:border-slate-700 rounded-xl shadow-xs hover:bg-[#DAF0F7] transition-all flex items-center gap-1.5 cursor-pointer font-black text-xs"
              aria-expanded={isMobileMenuOpen}
              aria-label={isMobileMenuOpen ? t('nav.close') : t('nav.more')}
              title={isMobileMenuOpen ? t('nav.close') : t('nav.more')}
            >
              {isMobileMenuOpen ? (
                <>
                  <X className="w-5 h-5 text-[#C2185B] shrink-0" />
                  <span className="hidden sm:inline">{t('nav.close')}</span>
                </>
              ) : (
                <>
                  <Menu className="w-5 h-5 text-[#FF5A1F] shrink-0" />
                  <span className="hidden sm:inline">{t('nav.more')}</span>
                </>
              )}
            </button>

          </div>

        </div>

        {/* MOBILE SLIDE-DOWN DRAWER / "MORE" MENU (< 768px) */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-3 pt-3 border-t border-[#B2E2F0] dark:border-slate-700 space-y-2 bg-white/95 dark:bg-slate-900/95 p-4 rounded-2xl shadow-2xl animate-fadeIn flex flex-col">
            
            {/* Header Menu Title */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-black uppercase tracking-wider text-[#FF5A1F]">
                {t('nav.menu')}
              </span>
              <button
                type="button"
                onClick={closeMobileMenu}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-300"
                aria-label={t('nav.close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav Links Vertical List (Min 44px Touch Targets) */}
            <div className="flex flex-col gap-2 pt-1">
              
              {/* Search */}
              <button
                type="button"
                onClick={() => { setActiveView('search'); closeMobileMenu(); }}
                className={`min-h-[44px] flex items-center gap-3 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                  activeView === 'search' ? 'bg-[#FF5A1F] text-white' : 'bg-[#DAF0F7]/60 dark:bg-slate-800 text-[#1A1110] dark:text-white'
                }`}
              >
                <Search className="w-5 h-5 shrink-0" />
                <span className="leading-normal">{t('nav.search')}</span>
              </button>

              {/* Track Live Order */}
              {activeLiveOrder && (
                <button
                  type="button"
                  onClick={() => { setActiveView('tracking'); closeMobileMenu(); }}
                  className="min-h-[44px] flex items-center gap-3 px-4 py-2.5 rounded-xl font-black text-xs bg-[#16A34A] text-white transition-all cursor-pointer shadow-md"
                >
                  <Bike className="w-5 h-5 text-yellow-300 shrink-0" />
                  <span className="leading-normal">Track Live Order</span>
                </button>
              )}

              {/* Auto Scheduler */}
              <button
                type="button"
                onClick={() => { setActiveView('scheduler'); closeMobileMenu(); }}
                className={`min-h-[44px] flex items-center gap-3 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                  activeView === 'scheduler' ? 'bg-[#FF5A1F] text-white' : 'bg-[#DAF0F7]/60 dark:bg-slate-800 text-[#1A1110] dark:text-white'
                }`}
              >
                <Calendar className="w-5 h-5 shrink-0" />
                <span className="leading-normal">{t('nav.schedule')}</span>
              </button>

              {/* Wallet Balance */}
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
                className={`min-h-[44px] flex items-center gap-3 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                  activeView === 'wallet' ? 'bg-[#FF5A1F] text-white' : 'bg-[#DAF0F7]/60 dark:bg-slate-800 text-[#1A1110] dark:text-white'
                }`}
              >
                {isWalletRevealed ? (
                  <>
                    <Eye className="w-5 h-5 text-[#16A34A] shrink-0" />
                    <span className="leading-normal font-bold">Wallet: ₹{walletBalance.toFixed(0)}</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5 text-amber-600 shrink-0" />
                    <span className="leading-normal">{t('wallet.maskedLabel')}</span>
                  </>
                )}
              </button>

              {/* Daily Order Limit */}
              <button
                type="button"
                onClick={() => { setIsLimitRenewalModalOpen(true); closeMobileMenu(); }}
                className="min-h-[44px] flex items-center gap-3 px-4 py-2.5 rounded-xl font-black text-xs bg-slate-100 dark:bg-slate-800 text-[#1A1110] dark:text-white border border-slate-300 dark:border-slate-700 cursor-pointer"
              >
                <PackageCheck className="w-5 h-5 text-[#FF5A1F] shrink-0" />
                <span className="leading-normal">Daily Order Limit: {dailyOrderCount}/6</span>
              </button>

              {/* Nominee Control Portal */}
              <button
                type="button"
                onClick={() => { setIsNomineeModalOpen(true); closeMobileMenu(); }}
                className="min-h-[44px] flex items-center gap-3 px-4 py-2.5 rounded-xl font-black text-xs bg-amber-500/10 border border-amber-400 text-amber-900 dark:text-amber-300 cursor-pointer"
              >
                <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                <span className="leading-normal">Nominee Controls</span>
                {pendingNomineeApprovals.filter(r => r.status === 'pending').length > 0 && (
                  <span className="ml-auto w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center animate-pulse">
                    {pendingNomineeApprovals.filter(r => r.status === 'pending').length}
                  </span>
                )}
              </button>

              {/* Order History */}
              <button
                type="button"
                onClick={() => { setActiveView('orders'); closeMobileMenu(); }}
                className={`min-h-[44px] flex items-center gap-3 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                  activeView === 'orders' ? 'bg-[#FF5A1F] text-white' : 'bg-[#DAF0F7]/60 dark:bg-slate-800 text-[#1A1110] dark:text-white'
                }`}
              >
                <History className="w-5 h-5 shrink-0" />
                <span className="leading-normal">{t('nav.orders')}</span>
              </button>

              {/* Schedule Cart */}
              <button
                type="button"
                onClick={() => { setIsScheduleCartModalOpen(true); closeMobileMenu(); }}
                className="min-h-[44px] flex items-center gap-3 px-4 py-2.5 rounded-xl font-black text-xs bg-amber-500/10 text-amber-900 dark:text-amber-300 border border-amber-400 cursor-pointer"
              >
                <ShoppingBag className="w-5 h-5 text-[#FF5A1F] shrink-0" />
                <span className="leading-normal">Schedule Cart</span>
                {scheduleCart.length > 0 && (
                  <span className="ml-auto w-5 h-5 rounded-full bg-[#FF5A1F] text-white text-[10px] font-black flex items-center justify-center animate-pulse">
                    {scheduleCart.length}
                  </span>
                )}
              </button>

              {/* Voice Search */}
              <button
                type="button"
                onClick={() => { setIsVoiceModalOpen(true); closeMobileMenu(); }}
                className="min-h-[44px] flex items-center gap-3 px-4 py-2.5 rounded-xl font-black text-xs bg-[#FF5A1F] text-white cursor-pointer shadow-md"
              >
                <Mic className="w-5 h-5 text-white animate-pulse shrink-0" />
                <span className="leading-normal">{t('search.voice')}</span>
              </button>

              {/* Healthy Food AI Guide */}
              <button
                type="button"
                onClick={() => { setIsHealthModalOpen(true); closeMobileMenu(); }}
                className="min-h-[44px] flex items-center gap-3 px-4 py-2.5 rounded-xl font-black text-xs bg-rose-600 text-white border border-rose-400 cursor-pointer shadow-md"
              >
                <HeartPulse className="w-5 h-5 text-yellow-300 animate-pulse shrink-0" />
                <span className="leading-normal">{t('nav.healthyFood')}</span>
              </button>
            </div>

            {/* Account & Biometric Section */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              {currentUser ? (
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#FF5A1F]" />
                  <span className="text-xs font-black text-[#1A1110] dark:text-white">{currentUser.name}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setIsAuthGateOpen(true); closeMobileMenu(); }}
                  className="min-h-[44px] flex items-center gap-2 bg-[#FF5A1F] text-white font-black px-4 py-2 rounded-xl text-xs cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </button>
              )}
            </div>

            {/* Theme & Logout Row */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-[#4A5568] dark:text-slate-400">Theme:</span>
                <button
                  type="button"
                  onClick={() => handleThemeChange('light')}
                  className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl border flex items-center justify-center ${
                    currentTheme === 'light' ? 'bg-[#FF5A1F] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                  aria-label="Light Theme"
                >
                  <Sun className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl border flex items-center justify-center ${
                    currentTheme === 'dark' ? 'bg-slate-900 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                  aria-label="Dark Theme"
                >
                  <Moon className="w-5 h-5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => { logout(); closeMobileMenu(); }}
                className="min-h-[44px] flex items-center gap-2 px-4 py-2.5 bg-[#C2185B] text-white rounded-xl text-xs font-black cursor-pointer shadow-md"
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
