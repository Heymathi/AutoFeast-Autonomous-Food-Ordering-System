import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { AccessibilityToolbar } from './components/AccessibilityToolbar';
import { VoiceCommandModal } from './components/VoiceCommandModal';
import { VoiceOrderDialogModal } from './components/VoiceOrderDialogModal';
import { SearchGuidedOrderModal } from './components/SearchGuidedOrderModal';
import { LiveOrderTrackingView } from './components/LiveOrderTrackingView';
import { DynamicFoodSearch } from './components/DynamicFoodSearch';
import { AutoOrderScheduler } from './components/AutoOrderScheduler';
import { WalletModal } from './components/WalletModal';
import { OrderHistoryModal } from './components/OrderHistoryModal';
import { ManualLocationModal } from './components/ManualLocationModal';
import { AuthModal } from './components/AuthModal';
import { DailyLimitRenewalModal } from './components/DailyLimitRenewalModal';
import { OrderPinConfirmationModal } from './components/OrderPinConfirmationModal';
import { PreOrderBillModal } from './components/PreOrderBillModal';
import { LanguageSelectionModal } from './components/LanguageSelectionModal';
import { WelcomeMessageModal } from './components/WelcomeMessageModal';
import { LocationPermissionModal } from './components/LocationPermissionModal';
import { HealthDietaryVoiceModal } from './components/HealthDietaryVoiceModal';
import { NomineeControlModal } from './components/NomineeControlModal';
import { NomineeApprovalWaitingModal } from './components/NomineeApprovalWaitingModal';
import { CenteredToastContainer } from './components/CenteredToastContainer';
import { ScheduleCheckoutModal } from './components/ScheduleCheckoutModal';
import { ScheduleCartModal } from './components/ScheduleCartModal';
import { SpeechDebugPanel } from './components/SpeechDebugPanel';
import { NomineeSetupScreen } from './components/NomineeSetupScreen';
import { NomineePortalPage } from './components/NomineePortalPage';
import { HeroSection } from './components/HeroSection';
import { HomePage } from './components/HomePage';
import { HowItWorksPage } from './components/HowItWorksPage';
import { FeaturesPage } from './components/FeaturesPage';
import { AboutPage } from './components/AboutPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Volume2, Sparkles, Clock, ShoppingBag } from 'lucide-react';

const MainLayout: React.FC = () => {
  const {
    entryStep,
    activeView,
    accessibilitySettings,
    voiceDialogItem,
    setVoiceDialogItem,
    isGuidedSearchOpen,
    closeGuidedSearch,
    guidedSearchQuery,
    guidedSearchItems,
    isLocationModalOpen,
    setIsLocationModalOpen,
    isAuthenticated,
    isAuthGateOpen,
    isLimitRenewalModalOpen,
    setIsLimitRenewalModalOpen,
    pendingBillModal,
    isBillModalOpen,
    setIsBillModalOpen,
    onConfirmProceedToPinFromBill,
    isLanguageModalOpen,
    isHealthModalOpen,
    setIsHealthModalOpen,
    isNomineeModalOpen,
    setIsNomineeModalOpen,
    waitingNomineeApproval,
    setWaitingNomineeApproval,
    handleNomineeApprovalApproved,
    handleNomineeApprovalDenied,
    scheduleCart,
    clearScheduleCart,
    isScheduleCartModalOpen,
    setIsScheduleCartModalOpen,
    language
  } = useApp();

  const [currentPath, setCurrentPath] = useState(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const isNomineeSetupRoute = currentPath.startsWith('/nominee/setup');
  const isNomineeRoute = currentPath === '/nominee' || currentPath === '/nominee/';
  const isNomineeFlow = isNomineeRoute || isNomineeSetupRoute;

  const currentTheme =
    accessibilitySettings.themeMode ||
    (accessibilitySettings.highContrast ? 'high-contrast' : 'light');

  return (
    <div className={`min-h-screen w-full max-w-full overflow-x-hidden flex flex-col transition-colors duration-200 text-scale-${accessibilitySettings.textSize} ${
      currentTheme === 'high-contrast'
        ? 'high-contrast-mode bg-black text-white'
        : currentTheme === 'dark'
        ? 'bg-zinc-900 text-zinc-100'
        : 'bg-[#F7F3EB] text-[#302720]'
    }`}>

      {/* Dev Debug Speech Controller Panel */}
      {(import.meta as any).env?.DEV && <SpeechDebugPanel activeLanguage={language} />}

      {/* Centered Toast Container for all system toasts & notifications */}
      <CenteredToastContainer />

      {/* Top Navbar */}
      <Navbar />

      {/* Accessibility Controls Bar */}
      <AccessibilityToolbar />

      {/* Floating Schedule Cart Action Button */}
      {scheduleCart.length > 0 && !isNomineeFlow && (
        <div className="fixed bottom-6 right-6 z-40 animate-bounce">
          <button
            onClick={() => setIsScheduleCartModalOpen(true)}
            className="px-6 py-3.5 bg-[#B85C38] hover:bg-[#A34F2F] text-white font-bold rounded-lg shadow-xl border border-white flex items-center space-x-3 cursor-pointer hover:scale-105 transition-all"
          >
            <ShoppingBag className="w-5 h-5 text-white" />
            <span className="text-xs sm:text-sm">Checkout Schedule Cart ({scheduleCart.length} items)</span>
          </button>
        </div>
      )}

      {/* Main View Container (Dashboard visible after all entry steps complete) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isNomineeSetupRoute ? (
          <ErrorBoundary fallbackTitle="Nominee Setup Error">
            <NomineeSetupScreen />
          </ErrorBoundary>
        ) : isNomineeRoute ? (
          <ErrorBoundary fallbackTitle="Nominee Portal Error">
            <NomineePortalPage />
          </ErrorBoundary>
        ) : (
          <>
            {(activeView === 'home' || activeView === 'search') && <HomePage />}
            {activeView === 'how-it-works' && <HowItWorksPage />}
            {activeView === 'features' && <FeaturesPage />}
            {activeView === 'about' && <AboutPage />}
            {activeView === 'scheduler' && <AutoOrderScheduler />}
            {activeView === 'wallet' && <WalletModal />}
            {activeView === 'orders' && <OrderHistoryModal />}
            {activeView === 'tracking' && <LiveOrderTrackingView />}
          </>
        )}
      </main>

      {/* EXACT 5-STEP ENTRY SEQUENCE MODALS (Only for user app flow, suppressed for Nominee portal) */}
      {!isNomineeFlow && (
        <>
          <AuthModal isOpen={entryStep === 'auth'} />
          <LanguageSelectionModal />
          <WelcomeMessageModal />
          <LocationPermissionModal />
        </>
      )}

      {/* Interactive Voice Order Prompt Modal */}
      <VoiceOrderDialogModal
        item={voiceDialogItem}
        isOpen={Boolean(voiceDialogItem)}
        onClose={() => setVoiceDialogItem(null)}
      />

      {/* Guided 3-Step Search Order Dialog (Variety -> Restaurant -> When) */}
      <SearchGuidedOrderModal
        isOpen={isGuidedSearchOpen}
        onClose={closeGuidedSearch}
        query={guidedSearchQuery}
        matchedItems={guidedSearchItems}
      />

      {/* Voice Assistant Modal */}
      <VoiceCommandModal />

      {/* Health & Dietary AI Guide Modal */}
      <HealthDietaryVoiceModal
        isOpen={isHealthModalOpen}
        onClose={() => setIsHealthModalOpen(false)}
      />

      {/* Manual Location Picker Modal */}
      <ManualLocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
      />

      {/* Daily Order Limit Renewal Modal (Face ID + Nominee Verification) */}
      <DailyLimitRenewalModal
        isOpen={isLimitRenewalModalOpen}
        onClose={() => setIsLimitRenewalModalOpen(false)}
      />

      {/* Pre-Order GST Tax Invoice & Bill Breakdown Modal (Generated via NLP Voice Command) */}
      <PreOrderBillModal
        bill={pendingBillModal}
        isOpen={isBillModalOpen}
        onClose={() => setIsBillModalOpen(false)}
        onConfirmProceedToPin={onConfirmProceedToPinFromBill}
      />

      {/* Security PIN Confirmation Modal before Food Order / Schedule Payment */}
      <OrderPinConfirmationModal />

      {/* Nominee Control Portal & Restricted Food List Modal */}
      <ErrorBoundary fallbackTitle="Nominee Modal Error">
        <NomineeControlModal
          isOpen={isNomineeModalOpen}
          onClose={() => setIsNomineeModalOpen(false)}
        />
      </ErrorBoundary>

      {/* Nominee Email Approval Waiting Modal */}
      {waitingNomineeApproval && (
        <NomineeApprovalWaitingModal
          isOpen={Boolean(waitingNomineeApproval)}
          onClose={() => setWaitingNomineeApproval(null)}
          approvalId={waitingNomineeApproval.requestId}
          foodItem={waitingNomineeApproval.foodItem}
          orderType={waitingNomineeApproval.orderType}
          scheduleDetails={waitingNomineeApproval.scheduleDetails}
          onApproved={handleNomineeApprovalApproved}
          onDenied={handleNomineeApprovalDenied}
        />
      )}

      {/* Persistent Schedule Cart Modal */}
      <ScheduleCartModal
        isOpen={isScheduleCartModalOpen}
        onClose={() => setIsScheduleCartModalOpen(false)}
      />


      {/* Footer */}
      <footer className="bg-[#241C16] text-[#E9DFD0]/70 border-t border-[#302720] py-8 text-center text-xs">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 font-semibold">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[#B85C38]" />
            <span className="font-extrabold text-white text-sm">AutoFeast AI • Smart Autonomous Food Scheduling</span>
          </div>
          <p className="text-[#E9DFD0]/80">© 2026 Accessibility-First Food Ordering Platform • English | தமிழ் | हिन्दी</p>
        </div>
      </footer>

    </div>
  );
};

export function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}

export default App;
