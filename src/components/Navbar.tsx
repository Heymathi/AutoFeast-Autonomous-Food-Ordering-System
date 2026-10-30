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

  const pillGroupSurface =
    currentTheme === 'high-contrast'
      ? 'bg-black text-white border-2 border-yellow-400'
      : currentTheme === 'dark'
      ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
      : 'bg-[#FFFFFF] text-[#111827] border border-[#D1D5DB] shadow-sm';

  const unselectedBtnClass =
    currentTheme === 'high-contrast'
      ? 'bg-black hover:bg-neutral-900 text-white border border-yellow-400'
      : currentTheme === 'dark'
      ? 'bg-slate-800 hover:bg-slate-700 text-white'
      : 'bg-[#FFFFFF] hover:bg-slate-100 text-[#111827]';

  return (
    <header
      className={`app-header sticky top-0 z-40 shadow-md transition-colors duration-200 w-full ${
        currentTheme === 'high-contrast'
          ? 'bg-black text-white border-b-4 border-yellow-400'
          : currentTheme === 'dark'
          ? 'bg-slate-900 text-slate-100 border-b border-slate-700'
          : 'bg-[#DAF0F7] text-[#111827] border-b border-[#B2E2F0]'
      }`}
    >
      <div className="header-container w-full max-w-full mx-auto px-2 sm:px-4 lg:px-6 py-2 sm:py-2.5">
        {/* MAIN TOP BAR */}
        <div className="flex flex-wrap items-stretch justify-between gap-2 sm:gap-2.5 w-full min-w-0">
          
          {/* LOGO, TITLE & GPS LOCATION BADGE (BRAND GROUP) */}
          <div className={`header-brand-group flex flex-wrap items-center justify-between gap-2.5 px-3 py-1.5 rounded-2xl min-w-0 ${pillGroupSurface}`}>
            <div className="flex items-center gap-2.5 shrink-0">
              <div
                className="bg-[#FF5A1F] min-h-[48px] min-w-[48px] p-2.5 rounded-xl shadow-md flex items-center justify-center cursor-pointer hover:bg-[#E04812] transition-colors shrink-0"
                onClick={() => setActiveView('search')}
                title="Go to AutoFeast Home"
                tabIndex={0}
                role="button"
                aria-label="AutoFeast Home"
              >
                <Sparkles className="w-6 h-6 text-white animate-pulse" />
              </div>

              <h1
                className={`font-black tracking-tight leading-tight cursor-pointer flex items-center gap-1 shrink-0 ${
                  currentTheme === 'dark' || currentTheme === 'high-contrast' ? 'text-white' : 'text-[#111827]'
                }`}
                onClick={() => setActiveView('search')}
              >
                AutoFeast AI
              </h1>
            </div>

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
              className={`header-location-chip min-h-[48px] flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl font-bold leading-snug transition-all border shadow-xs cursor-pointer min-w-0 flex-1 ${
                userLocation.area === 'Location not set' || userLocation.city === 'Not set'
                  ? 'bg-amber-100 text-[#111827] border-amber-500 hover:bg-amber-200'
                  : currentTheme === 'high-contrast'
                  ? 'bg-black text-white border-2 border-yellow-400'
                  : currentTheme === 'dark'
                  ? 'bg-slate-900 text-white border-slate-600 hover:bg-slate-700'
                  : 'bg-[#FFFFFF] text-[#111827] border-[#D1D5DB] hover:bg-slate-100'
              }`}
              title={t('location.changeAddress')}
              aria-label={t('location.changeAddress')}
            >
              {userLocation.area === 'Location not set' || userLocation.city === 'Not set' ? (
                <AlertTriangle className="w-6 h-6 text-amber-700 shrink-0" />
              ) : userLocation.isManualOverride ? (
                <Edit3 className="w-6 h-6 text-blue-700 shrink-0" />
              ) : userLocation.isApproximate ? (
                <AlertTriangle className="w-6 h-6 text-[#C2185B] shrink-0" />
              ) : (
                <Navigation className="w-6 h-6 text-[#FF5A1F] animate-spin shrink-0" style={{ animationDuration: '6s' }} />
              )}

              <span className="truncate leading-tight font-bold">
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

          {/* NAVIGATION PILLS GROUP */}
          <nav
            className={`header-nav-group flex flex-wrap items-center justify-evenly gap-2 p-1.5 rounded-2xl min-w-0 ${pillGroupSurface}`}
          >
            {/* Search */}
            <button
              type="button"
              onClick={() => setActiveView('search')}
              className={`header-btn flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold leading-tight transition-all cursor-pointer ${
                activeView === 'search'
                  ? 'bg-[#FF5A1F] text-white shadow-sm'
                  : unselectedBtnClass
              }`}
              title={t('nav.search')}
              aria-label={t('nav.search')}
            >
              <Search className="w-6 h-6 shrink-0" />
              <span className="header-label-responsive">{t('nav.search')}</span>
            </button>

            {/* Track Live Order */}
            {activeLiveOrder && (
              <button
                type="button"
                onClick={() => setActiveView('tracking')}
                className={`header-btn flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold leading-tight transition-all cursor-pointer ${
                  activeView === 'tracking'
                    ? 'bg-[#16A34A] text-white shadow-md'
                    : 'bg-[#16A34A] hover:bg-[#15803D] text-white'
                }`}
                title="Track Order"
                aria-label="Track Order"
              >
                <Bike className="w-6 h-6 text-yellow-300 shrink-0" />
                <span className="header-label-responsive">Track Order</span>
              </button>
            )}

            {/* Auto Scheduler */}
            <button
              type="button"
              onClick={() => setActiveView('scheduler')}
              className={`header-btn flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold leading-tight transition-all cursor-pointer ${
                activeView === 'scheduler'
                  ? 'bg-[#FF5A1F] text-white shadow-sm'
                  : unselectedBtnClass
              }`}
              title={t('nav.schedule')}
              aria-label={t('nav.schedule')}
            >
              <Calendar className="w-6 h-6 shrink-0" />
              <span className="header-label-responsive">{t('nav.schedule')}</span>
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
              className={`header-btn flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold leading-tight transition-all cursor-pointer ${
                activeView === 'wallet'
                  ? 'bg-[#FF5A1F] text-white shadow-sm'
                  : unselectedBtnClass
              }`}
              title={isWalletRevealed ? `Wallet Balance: ₹${walletBalance.toFixed(0)}` : t('wallet.maskedLabel')}
              aria-label={isWalletRevealed ? `Wallet Balance: ₹${walletBalance.toFixed(0)}` : t('wallet.maskedLabel')}
            >
              {isWalletRevealed ? (
                <>
                  <Eye className="w-6 h-6 text-[#16A34A] shrink-0" />
                  <span className="font-bold">₹{walletBalance.toFixed(0)}</span>
                </>
              ) : (
                <>
                  <Lock className="w-6 h-6 text-amber-600 shrink-0" />
                  <span className="font-bold">{t('wallet.maskedLabel')}</span>
                </>
              )}
            </button>

            {/* Limit */}
            <button
              type="button"
              onClick={() => setIsLimitRenewalModalOpen(true)}
              className={`header-btn flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold leading-tight transition-all border cursor-pointer ${
                dailyOrderCount >= 6
                  ? 'bg-[#C2185B] text-white border-[#C2185B]'
                  : currentTheme === 'high-contrast'
                  ? 'bg-black hover:bg-neutral-900 text-white border-yellow-400'
                  : currentTheme === 'dark'
                  ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-600'
                  : 'bg-[#FFFFFF] hover:bg-slate-100 text-[#111827] border-[#D1D5DB]'
              }`}
              title={`Daily Limit: ${dailyOrderCount}/6`}
              aria-label={`Daily Limit: ${dailyOrderCount}/6`}
            >
              <PackageCheck className={`w-6 h-6 shrink-0 ${dailyOrderCount >= 6 ? 'text-white' : 'text-[#FF5A1F]'}`} />
              <span className="font-bold"><span className="header-label-responsive">Limit: </span>{dailyOrderCount}/6</span>
            </button>

            {/* Nominee Control Portal */}
            <a
              href="/nominee"
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState(null, '', '/nominee');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className={`header-btn flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold leading-tight transition-all border cursor-pointer relative ${
                currentTheme === 'high-contrast'
                  ? 'bg-black hover:bg-neutral-900 text-white border-yellow-400'
                  : currentTheme === 'dark'
                  ? 'bg-slate-800 hover:bg-slate-700 text-white border-amber-400'
                  : 'bg-[#FFFFFF] hover:bg-amber-50 text-[#111827] border-amber-500'
              }`}
              title="Nominee Control Portal"
              aria-label="Nominee Control Portal"
            >
              <ShieldCheck className="w-6 h-6 shrink-0 text-amber-600" />
              <span className="header-label-responsive">Nominee</span>
              {pendingNomineeApprovals.filter(r => r.status === 'pending').length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {pendingNomineeApprovals.filter(r => r.status === 'pending').length}
                </span>
              )}
            </a>

            {/* Order History */}
            <button
              type="button"
              onClick={() => setActiveView('orders')}
              className={`header-btn flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold leading-tight transition-all cursor-pointer ${
                activeView === 'orders'
                  ? 'bg-[#FF5A1F] text-white shadow-sm'
                  : unselectedBtnClass
              }`}
              title={t('nav.orders')}
              aria-label={t('nav.orders')}
            >
              <History className="w-6 h-6 shrink-0" />
              <span className="header-label-responsive">{t('nav.orders')}</span>
            </button>

            {/* Shared Cart */}
            {(() => {
              const totalCartCount = cart.reduce((sum, i) => sum + (i.qty || (i as any).quantity || 1), 0);
              return (
                <button
                  type="button"
                  onClick={() => setIsScheduleCartModalOpen(true)}
                  className={`header-btn flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold leading-tight transition-all cursor-pointer border relative ${
                    currentTheme === 'high-contrast'
                      ? 'bg-black hover:bg-neutral-900 text-white border-yellow-400'
                      : currentTheme === 'dark'
                      ? 'bg-slate-800 hover:bg-slate-700 text-white border-amber-400'
                      : 'bg-[#FFFFFF] hover:bg-amber-50 text-[#111827] border-amber-500'
                  }`}
                  title={t('cartTitle')}
                  aria-label={t('cartTitle')}
                >
                  <ShoppingBag className="w-6 h-6 shrink-0 text-[#FF5A1F]" />
                  <span className="header-label-responsive">{t('cartTitle')}</span>
                  {totalCartCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-[#FF5A1F] text-white text-xs font-bold flex items-center justify-center shrink-0 min-w-[1.5rem] min-h-[1.5rem]">
                      {totalCartCount}
                    </span>
                  )}
                </button>
              );
            })()}
          </nav>

          {/* ACTION BUTTONS (USER PROFILE, VOICE SEARCH, HEALTHY FOOD, THEME, LOGOUT) */}
          <div className={`header-actions-group flex flex-wrap items-center justify-evenly gap-2 p-1.5 rounded-2xl min-w-0 ${pillGroupSurface}`}>
            
            {/* User Profile / Sign In */}
            {currentUser ? (
              <div
                className={`header-chip flex-1 flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border min-w-0 ${
                  currentTheme === 'high-contrast'
                    ? 'bg-black text-white border-yellow-400'
                    : currentTheme === 'dark'
                    ? 'bg-slate-900 text-white border-slate-600'
                    : 'bg-[#FFFFFF] text-[#111827] border-[#D1D5DB]'
                }`}
                title={`Signed in as ${currentUser.name}`}
              >
                <div className="p-1.5 bg-[#FF5A1F] rounded-lg text-white shrink-0">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <span className="header-label-responsive font-bold leading-tight">
                  {currentUser.name}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await registerFaceIDOnDevice();
                    if (res.success) {
                      showToast('Face ID registered!');
                      speakText('Face ID registered!');
                    }
                  }}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-[#FF5A1F] transition-colors cursor-pointer shrink-0"
                  title="Link Face ID (WebAuthn)"
                  aria-label="Link Face ID"
                >
                  <Scan className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthGateOpen(true)}
                className="header-btn flex-1 flex items-center justify-center gap-2 bg-[#FF5A1F] text-white font-bold px-3.5 py-2.5 rounded-xl shadow-sm hover:bg-[#E04812] cursor-pointer"
                title="Sign In"
                aria-label="Sign In"
              >
                <LogIn className="w-6 h-6 shrink-0" />
                <span className="header-label-responsive">Sign In</span>
              </button>
            )}

            {/* Voice Assistant Mic Button */}
            <button
              type="button"
              onClick={() => setIsVoiceModalOpen(true)}
              className="header-btn flex-1 flex items-center justify-center gap-2 bg-[#FF5A1F] hover:bg-[#E04812] text-white font-bold px-3.5 py-2.5 rounded-xl shadow-sm transition-colors cursor-pointer"
              title={t('search.voice')}
              aria-label={t('search.voice')}
            >
              <Mic className="w-6 h-6 text-white shrink-0" />
              <span className="header-label-responsive leading-tight">{t('search.voice')}</span>
            </button>

            {/* Healthy Food Guide */}
            <button
              type="button"
              onClick={() => setIsHealthModalOpen(true)}
              className="header-btn flex-1 flex items-center justify-center gap-2 bg-[#C2185B] hover:bg-[#A3134C] text-white font-bold px-3.5 py-2.5 rounded-xl shadow-sm transition-colors cursor-pointer border border-[#C2185B]"
              title={t('nav.healthyFood')}
              aria-label={t('nav.healthyFood')}
            >
              <HeartPulse className="w-6 h-6 text-yellow-300 shrink-0" />
              <span className="header-label-responsive leading-tight">{t('nav.healthyFood')}</span>
            </button>

            {/* Theme Selector */}
            <div
              className={`flex items-center gap-1.5 p-1 rounded-xl border shrink-0 ${
                currentTheme === 'high-contrast'
                  ? 'bg-black border-yellow-400'
                  : currentTheme === 'dark'
                  ? 'bg-slate-900 border-slate-600'
                  : 'bg-[#FFFFFF] border-[#D1D5DB]'
              }`}
            >
              <button
                type="button"
                onClick={() => handleThemeChange('light')}
                className={`header-btn px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                  currentTheme === 'light'
                    ? 'bg-[#FF5A1F] text-white shadow-xs'
                    : currentTheme === 'dark'
                    ? 'text-slate-200 hover:bg-slate-800'
                    : 'text-white hover:bg-neutral-900'
                }`}
                title="Light Theme"
                aria-label="Light Theme"
              >
                <Sun className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={() => handleThemeChange('dark')}
                className={`header-btn px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                  currentTheme === 'dark'
                    ? 'bg-[#FF5A1F] text-white shadow-xs'
                    : currentTheme === 'light'
                    ? 'text-[#111827] hover:bg-slate-100'
                    : 'text-white hover:bg-neutral-900'
                }`}
                title="Dark Theme"
                aria-label="Dark Theme"
              >
                <Moon className="w-6 h-6" />
              </button>
            </div>

            {/* Logout */}
            <button
              type="button"
              onClick={logout}
              className="header-btn px-3.5 py-2.5 bg-[#C2185B] hover:bg-[#A3134C] text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="w-6 h-6 text-white shrink-0" />
              <span className="header-label-responsive">Logout</span>
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};
