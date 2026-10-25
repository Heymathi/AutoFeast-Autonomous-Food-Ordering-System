import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Search,
  Calendar,
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
    accessibilitySettings,
    setAccessibilitySettings,
    t,
    speakText,
    logout,
    currentUser,
    userLocation,
    setIsLocationModalOpen,
    dailyOrderCount,
    registerFaceIDOnDevice,
    activeLiveOrder,
    setIsVoiceModalOpen,
    setIsHealthModalOpen,
    setIsLimitRenewalModalOpen,
    setIsAuthGateOpen,
    setIsNomineeModalOpen,
    pendingNomineeApprovals,
    showToast,
    cart,
    setIsScheduleCartModalOpen
  } = useApp();

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
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2">
        {/* MAIN TOP BAR */}
        <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full">
          
          {/* LOGO & GPS LOCATION BADGE (LEFT BLOCK) */}
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="bg-[#FF5A1F] min-h-[40px] min-w-[40px] p-2 rounded-xl shadow-md flex items-center justify-center cursor-pointer hover:bg-[#E04812] transition-colors shrink-0"
              onClick={() => setActiveView('search')}
              title="Go to AutoFeast Home"
              tabIndex={0}
              role="button"
              aria-label="AutoFeast Home"
            >
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
            </div>

            <div className="min-w-0 flex flex-col justify-center">
              <h1
                className={`text-base md:text-lg font-black tracking-tight leading-tight cursor-pointer flex items-center gap-1 shrink-0 ${
                  currentTheme === 'dark' || currentTheme === 'high-contrast' ? 'text-white' : 'text-[#1A1110]'
                }`}
                onClick={() => setActiveView('search')}
              >
                AutoFeast AI
              </h1>

              {/* GPS Live Location Button */}
              <button
                type="button"
                id="header-location-chip"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('[Navbar]: Location chip clicked -> opening Location Change modal');
                  setIsLocationModalOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('[Navbar]: Location chip keydown -> opening Location Change modal');
                    setIsLocationModalOpen(true);
                  }
                }}
                className={`mt-0.5 min-h-[32px] sm:min-h-[36px] flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black leading-snug transition-all border shadow-xs cursor-pointer max-w-[160px] sm:max-w-[240px] ${
                  userLocation.area === 'Location not set' || userLocation.city === 'Not set'
                    ? 'bg-amber-100 text-amber-900 border-amber-400 hover:bg-amber-200'
                    : userLocation.isManualOverride
                    ? 'bg-blue-900/10 text-blue-900 border-blue-400/50 hover:bg-blue-900/20'
                    : userLocation.isApproximate
                    ? 'bg-[#C2185B]/10 text-[#C2185B] border-[#C2185B]/40 hover:bg-[#C2185B]/20 animate-pulse'
                    : 'bg-white text-[#1A1110] border-[#4A5568]/30 hover:bg-slate-50'
                }`}
                title={t('location.changeAddress')}
                aria-label={t('location.changeAddress')}
              >
                {userLocation.area === 'Location not set' || userLocation.city === 'Not set' ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                ) : userLocation.isManualOverride ? (
                  <Edit3 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                ) : userLocation.isApproximate ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-[#C2185B] shrink-0" />
                ) : (
                  <Navigation className="w-3.5 h-3.5 text-[#FF5A1F] animate-spin shrink-0" style={{ animationDuration: '6s' }} />
                )}

                <span className="truncate leading-tight">
                  {userLocation.area === 'Location not set' || userLocation.city === 'Not set'
                    ? `📍 ${t('location.notSet')}`
                    : userLocation.isManualOverride
                    ? `✏️ ${userLocation.area}`
                    : userLocation.isApproximate
                    ? `⚠️ ${userLocation.city}`
                    : `📍 ${userLocation.area}, ${userLocation.city}`}
                </span>
              </button>
            </div>
          </div>

          {/* NAVIGATION PILLS GROUP */}
          <nav
            className={`flex flex-wrap items-center gap-1.5 sm:gap-2 p-1 rounded-2xl shadow-xs min-w-0 ${
              currentTheme === 'high-contrast'
                ? 'bg-black border border-yellow-400'
                : currentTheme === 'dark'
                ? 'bg-black border border-slate-700'
                : 'bg-white border border-[#B2E2F0]'
            }`}
          >
            {/* Search */}
            <button
              type="button"
              onClick={() => setActiveView('search')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-black leading-tight transition-all cursor-pointer ${
                activeView === 'search'
                  ? 'bg-[#FF5A1F] text-white shadow-xs'
                  : currentTheme === 'dark'
                  ? 'bg-black hover:bg-slate-800 text-white'
                  : 'hover:bg-[#DAF0F7] text-[#1A1110]'
              }`}
            >
              <Search className="w-4 h-4 shrink-0" />
              <span>{t('nav.search')}</span>
            </button>

            {/* Track Live Order */}
            {activeLiveOrder && (
              <button
                type="button"
                onClick={() => setActiveView('tracking')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-black leading-tight transition-all animate-bounce cursor-pointer ${
                  activeView === 'tracking'
                    ? 'bg-[#16A34A] text-white shadow-md'
                    : 'bg-[#16A34A] hover:bg-[#15803D] text-white'
                }`}
              >
                <Bike className="w-4 h-4 text-yellow-300 shrink-0" />
                <span>Track Order</span>
              </button>
            )}

            {/* Auto Scheduler */}
            <button
              type="button"
              onClick={() => setActiveView('scheduler')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-black leading-tight transition-all cursor-pointer ${
                activeView === 'scheduler'
                  ? 'bg-[#FF5A1F] text-white shadow-xs'
                  : currentTheme === 'dark'
                  ? 'bg-black hover:bg-slate-800 text-white'
                  : 'hover:bg-[#DAF0F7] text-[#1A1110]'
              }`}
            >
              <Calendar className="w-4 h-4 shrink-0" />
              <span>{t('nav.schedule')}</span>
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
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-black leading-tight transition-all cursor-pointer ${
                activeView === 'wallet'
                  ? 'bg-[#FF5A1F] text-white shadow-xs'
                  : currentTheme === 'dark'
                  ? 'bg-black hover:bg-slate-800 text-white'
                  : 'hover:bg-[#DAF0F7] text-[#1A1110]'
              }`}
            >
              {isWalletRevealed ? (
                <>
                  <Eye className="w-4 h-4 text-[#16A34A] shrink-0 animate-pulse" />
                  <span className="font-bold">₹{walletBalance.toFixed(0)}</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{t('wallet.maskedLabel')}</span>
                </>
              )}
            </button>

            {/* Limit */}
            <button
              type="button"
              onClick={() => setIsLimitRenewalModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-black leading-tight transition-all border cursor-pointer ${
                dailyOrderCount >= 6
                  ? 'bg-[#C2185B] text-white border-[#C2185B] animate-bounce'
                  : currentTheme === 'dark'
                  ? 'bg-black hover:bg-slate-800 text-white border-slate-600'
                  : 'bg-white hover:bg-[#DAF0F7] text-[#1A1110] border-[#4A5568]/30'
              }`}
            >
              <PackageCheck className={`w-4 h-4 shrink-0 ${dailyOrderCount >= 6 ? 'text-white' : 'text-[#FF5A1F]'}`} />
              <span>Limit: {dailyOrderCount}/6</span>
            </button>

            {/* Nominee Control Portal */}
            <button
              type="button"
              onClick={() => setIsNomineeModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-black leading-tight transition-all border cursor-pointer relative ${
                currentTheme === 'dark'
                  ? 'bg-black hover:bg-slate-800 text-white border-amber-400'
                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 border-amber-400'
              }`}
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
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-black leading-tight transition-all cursor-pointer ${
                activeView === 'orders'
                  ? 'bg-[#FF5A1F] text-white shadow-xs'
                  : currentTheme === 'dark'
                  ? 'bg-black hover:bg-slate-800 text-white'
                  : 'hover:bg-[#DAF0F7] text-[#1A1110]'
              }`}
            >
              <History className="w-4 h-4 shrink-0" />
              <span>{t('nav.orders')}</span>
            </button>

            {/* Shared Cart */}
            <button
              type="button"
              onClick={() => setIsScheduleCartModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-black leading-tight transition-all cursor-pointer border border-amber-400 relative ${
                currentTheme === 'dark'
                  ? 'bg-black hover:bg-slate-800 text-white'
                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-900'
              }`}
              title={t('cartTitle')}
            >
              <ShoppingBag className="w-4 h-4 shrink-0 text-[#FF5A1F]" />
              <span>{t('cartTitle')}</span>
              {cart.reduce((sum, i) => sum + i.qty, 0) > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-[#FF5A1F] text-white text-[10px] font-black flex items-center justify-center animate-pulse shrink-0 min-w-[1.25rem] min-h-[1.25rem]">
                  {cart.reduce((sum, i) => sum + i.qty, 0)}
                </span>
              )}
            </button>
          </nav>

          {/* ACTION BUTTONS (VOICE SEARCH, HEALTHY FOOD, USER PROFILE, THEME, LOGOUT) */}
          <div className="flex flex-wrap items-center justify-end gap-2 ml-auto">
            
            {/* User Profile / Sign In */}
            {currentUser ? (
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-2 rounded-xl border border-[#B2E2F0] dark:border-slate-700 shadow-xs">
                <div className="p-1 bg-[#FF5A1F] rounded-lg text-white shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-black text-[#1A1110] dark:text-white max-w-[120px] truncate leading-tight">{currentUser.name}</span>
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
                className="flex items-center gap-1.5 bg-[#FF5A1F] text-white font-black px-3 py-2 rounded-xl text-sm shadow-sm hover:bg-[#E04812] cursor-pointer"
              >
                <LogIn className="w-4 h-4 shrink-0" />
                <span>Sign In</span>
              </button>
            )}

            {/* Voice Assistant Mic Button */}
            <button
              type="button"
              onClick={() => setIsVoiceModalOpen(true)}
              className="flex items-center gap-1.5 bg-[#FF5A1F] hover:bg-[#E04812] text-white font-black px-3 py-2 rounded-xl text-sm shadow-sm transition-transform hover:scale-102 cursor-pointer"
            >
              <Mic className="w-4 h-4 text-white animate-pulse shrink-0" />
              <span className="leading-tight">{t('search.voice')}</span>
            </button>

            {/* Healthy Food Guide */}
            <button
              type="button"
              onClick={() => setIsHealthModalOpen(true)}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black px-3 py-2 rounded-xl text-sm shadow-sm transition-transform hover:scale-102 cursor-pointer border border-rose-400"
            >
              <HeartPulse className="w-4 h-4 text-yellow-300 animate-pulse shrink-0" />
              <span className="leading-tight">{t('nav.healthyFood')}</span>
            </button>

            {/* Theme Selector */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-[#4A5568]/30 shadow-xs">
              <button
                type="button"
                onClick={() => handleThemeChange('light')}
                className={`p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
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
                className={`p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
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
              className="p-2.5 bg-[#C2185B] hover:bg-[#A3134C] text-white rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4 text-white" />
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};
