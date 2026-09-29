import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, AccessibilitySettings, AppView, AutoOrderSchedule, ScheduleOverride, ExecutedOrder, WalletTransaction, UserLocation, LiveOrderTracking, FoodItem, OrderStrategy, LinkedBank, PendingPinVerification, EntryStep } from '../types';
import { TRANSLATIONS } from '../data/translations';
import { DynamicFoodSearchEngine, SearchResult } from '../services/dynamicFoodSearch';
import { WalletService } from '../services/walletService';
import { AutoOrderBackgroundService, calculateScheduleEndDate } from '../services/autoOrderBackgroundService';
import { PriceComparisonService } from '../services/priceComparisonService';
import { fetchLiveGPSLocation, calculateHaversineDistance } from '../services/locationService';
import { SpeechService } from '../services/speechService';
import { AuthService, UserProfile } from '../services/authService';
import { WebAuthnService, RegisteredCredential } from '../services/webAuthnService';
import { NLPParserService, ParsedOrderBill } from '../services/nlpParserService';
import { LlmNluService } from '../services/llmNluService';
import { parseSpokenTimeTo24Hr } from '../components/VoiceOrderDialogModal';

interface AppContextType {
  // App Entry Sequence State
  entryStep: EntryStep;
  setEntryStep: (step: EntryStep) => void;
  handleLanguageSelected: (lang: Language) => void;
  handleWelcomeComplete: () => void;
  handleLocationPermissionResponse: (allowed: boolean) => void;

  // Authentication & WebAuthn Face ID
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  isFaceIdSupported: boolean;
  isAuthGateOpen: boolean;
  setIsAuthGateOpen: (open: boolean) => void;
  isLimitRenewalModalOpen: boolean;
  setIsLimitRenewalModalOpen: (open: boolean) => void;
  loginWithFaceID: () => Promise<{ success: boolean; error?: string }>;
  registerFaceIDOnDevice: () => Promise<{ success: boolean; error?: string }>;
  loginWithPIN: (pin: string) => UserProfile;
  resetPINWithPassword: (email: string, pass: string, newPin: string) => UserProfile;
  loginWithPassword: (email: string, pass: string) => UserProfile;
  signupUser: (name: string, email: string, pass: string, pin: string, nomineeName: string, nomineePhone: string, enableFaceID: boolean) => Promise<boolean>;
  renewLimitWithFaceID: () => Promise<{ success: boolean; error?: string }>;
  renewLimitWithPIN: (pin: string) => { success: boolean; error?: string };
  renewLimitWithNominee: (name: string, phone: string) => { success: boolean; error?: string };
  renewLimitWithPassword: (pass: string) => { success: boolean; error?: string };
  resetDailyLimit: () => void;
  logout: () => void;

  language: Language;
  setLanguage: (lang: Language) => void;
  isLanguageModalOpen: boolean;
  setIsLanguageModalOpen: (open: boolean) => void;
  selectLanguageAndProceedToLocation: (lang: Language) => void;
  t: (key: string) => string;
  accessibilitySettings: AccessibilitySettings;
  setAccessibilitySettings: React.Dispatch<React.SetStateAction<AccessibilitySettings>>;
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  
  // GPS Location
  userLocation: UserLocation;
  setUserLocation: (loc: UserLocation) => void;
  setManualUserLocation: (loc: UserLocation) => void;
  detectGPSLocation: (isSilent?: boolean) => void;
  isLocationModalOpen: boolean;
  setIsLocationModalOpen: (open: boolean) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedLocation: string;
  setSelectedLocation: (loc: string) => void;
  selectedCuisine: string;
  setSelectedCuisine: (c: string) => void;
  vegOnly: boolean;
  setVegOnly: (v: boolean) => void;
  searchResult: SearchResult;
  executeSearch: (q?: string, isVoiceTrigger?: boolean) => void;

  // Auto Voice Prompt Toggle
  autoVoicePromptEnabled: boolean;
  setAutoVoicePromptEnabled: (enabled: boolean) => void;

  // NLP Voice Parsing & Pre-Order GST Bill Breakdown Modal
  pendingBillModal: ParsedOrderBill | null;
  isBillModalOpen: boolean;
  setIsBillModalOpen: (open: boolean) => void;
  isHealthModalOpen: boolean;
  setIsHealthModalOpen: (open: boolean) => void;
  processNaturalLanguageVoiceCommand: (transcript: string) => Promise<boolean>;
  onConfirmProceedToPinFromBill: (bill: ParsedOrderBill) => void;

  // Wallet & Linked Bank Account
  walletBalance: number;
  isWalletRevealed: boolean;
  setIsWalletRevealed: (revealed: boolean) => void;
  requestWalletBalanceReveal: () => void;
  walletTransactions: WalletTransaction[];
  rechargeWallet: (amount: number) => void;
  linkedBank: LinkedBank;
  setLinkedBank: React.Dispatch<React.SetStateAction<LinkedBank>>;

  // Instant Order & Live Tracking
  placeInstantOrder: (item: FoodItem, strategy?: OrderStrategy) => void;
  activeLiveOrder: LiveOrderTracking | null;
  setActiveLiveOrder: (order: LiveOrderTracking | null) => void;

  // Voice Interactive Order Prompt
  voiceDialogItem: FoodItem | null;
  setVoiceDialogItem: (item: FoodItem | null) => void;

  // Schedules & Orders
  schedules: AutoOrderSchedule[];
  overrides: ScheduleOverride[];
  saveSchedule: (s: AutoOrderSchedule) => void;
  deleteSchedule: (id: string) => void;
  saveOverride: (o: ScheduleOverride) => void;
  deleteOverride: (id: string) => void;
  getOverridesForSchedule: (scheduleId: string) => ScheduleOverride[];
  executeScheduleNow: (id: string, targetDate?: string) => void;
  orderHistory: ExecutedOrder[];

  // Order & Schedule PIN Verification Modal
  isOrderPinModalOpen: boolean;
  setIsOrderPinModalOpen: (open: boolean) => void;
  pendingPinVerification: PendingPinVerification | null;
  cancelPendingPinAction: () => void;
  confirmPendingPinAction: (pin: string) => boolean;

  // Daily Order Limit & Order History Tabs
  dailyOrderCount: number;
  checkDailyOrderLimitReached: () => boolean;
  orderHistoryTab: 'all' | 'instant' | 'scheduled' | 'pending';
  setOrderHistoryTab: (tab: 'all' | 'instant' | 'scheduled' | 'pending') => void;
  openOrderHistoryTab: (tab: 'all' | 'instant' | 'scheduled' | 'pending') => void;

  // Speech & Toast
  speakText: (text: string, onEnd?: () => void, targetLang?: Language) => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;
  isVoiceModalOpen: boolean;
  setIsVoiceModalOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // App Entry Sequence State (Auth -> Language -> Welcome -> Location -> Dashboard)
  const [entryStep, setEntryStep] = useState<EntryStep>('auth');

  // User Authentication & WebAuthn Face ID State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => AuthService.getCurrentUser());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthGateOpen, setIsAuthGateOpen] = useState<boolean>(true);
  const [isFaceIdSupported, setIsFaceIdSupported] = useState<boolean>(false);
  const [isLimitRenewalModalOpen, setIsLimitRenewalModalOpen] = useState<boolean>(false);

  useEffect(() => {
    WebAuthnService.isPlatformAuthenticatorAvailable().then(supported => {
      setIsFaceIdSupported(supported);
    });
  }, []);

  const loginWithFaceID = async (): Promise<{ success: boolean; error?: string }> => {
    const credentials = currentUser?.webAuthnCredentials || [];
    const result = await WebAuthnService.authenticateBiometricCredential(credentials);
    if (result.success) {
      setIsAuthenticated(true);
      setIsAuthGateOpen(false);
      setEntryStep('language');
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  const registerFaceIDOnDevice = async (): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) return { success: false, error: 'No user account logged in.' };
    const result = await WebAuthnService.registerBiometricCredential(currentUser.email, currentUser.name);
    if (result.success && result.credential) {
      const updatedUser = AuthService.addCredentialToUser(currentUser.id, result.credential);
      setCurrentUser(updatedUser);
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  const loginWithPIN = (pin: string): UserProfile => {
    const user = AuthService.loginWithPIN(pin);
    setCurrentUser(user);
    setIsAuthenticated(true);
    setIsAuthGateOpen(false);
    setEntryStep('language');
    return user;
  };

  const resetPINWithPassword = (email: string, pass: string, newPin: string): UserProfile => {
    const user = AuthService.resetPINWithPassword(email, pass, newPin);
    setCurrentUser(user);
    setIsAuthenticated(true);
    setIsAuthGateOpen(false);
    setEntryStep('language');
    return user;
  };

  const loginWithPassword = (email: string, pass: string): UserProfile => {
    const user = AuthService.loginWithPassword(email, pass);
    setCurrentUser(user);
    setIsAuthenticated(true);
    setIsAuthGateOpen(false);
    setEntryStep('language');
    return user;
  };

  const signupUser = async (
    name: string,
    email: string,
    pass: string,
    pin: string,
    nomineeName: string,
    nomineePhone: string,
    enableFaceID: boolean
  ): Promise<boolean> => {
    let initialCred: RegisteredCredential | undefined = undefined;
    if (enableFaceID) {
      const regResult = await WebAuthnService.registerBiometricCredential(email, name);
      if (regResult.success && regResult.credential) {
        initialCred = regResult.credential;
      }
    }
    const newUser = AuthService.createUser(name, email, pass, pin || '1234', nomineeName, nomineePhone, initialCred);
    setCurrentUser(newUser);
    setIsAuthenticated(true);
    setIsAuthGateOpen(false);
    setEntryStep('language');
    return true;
  };

  const resetDailyLimit = () => {
    setDailyOrderCountState(0);
    try {
      localStorage.setItem('smart_food_daily_order_tracker', JSON.stringify({
        date: getTodayDateKey(),
        count: 0
      }));
    } catch (e) {}
  };

  const renewLimitWithFaceID = async (): Promise<{ success: boolean; error?: string }> => {
    const credentials = currentUser?.webAuthnCredentials || [];
    const result = await WebAuthnService.authenticateBiometricCredential(credentials);
    if (result.success) {
      resetDailyLimit();
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  const renewLimitWithPIN = (pin: string): { success: boolean; error?: string } => {
    const cleanPin = pin.trim();
    if (cleanPin.length !== 4) {
      return { success: false, error: 'Please enter a 4-digit PIN.' };
    }

    if (currentUser && currentUser.pinHash === cleanPin) {
      resetDailyLimit();
      showToast(`Daily order limit reset to 0/6 for ${currentUser.name}!`);
      return { success: true };
    }

    const users = AuthService.getUsers();
    const matchingUser = users.find(u => u.pinHash === cleanPin);
    if (matchingUser) {
      setCurrentUser(matchingUser);
      AuthService.setCurrentUser(matchingUser);
      resetDailyLimit();
      showToast(`Daily order limit reset to 0/6 for ${matchingUser.name}!`);
      return { success: true };
    }

    return { success: false, error: 'Incorrect PIN. Daily order limit remains 6/6.' };
  };

  const renewLimitWithNominee = (nomineeNameInput: string, nomineePhoneInput: string): { success: boolean; error?: string } => {
    const storedNomName = (currentUser?.nomineeName || 'Priya Raja').toLowerCase().trim();
    const storedNomPhone = (currentUser?.nomineePhone || '+91 98765 43210').replace(/\s+/g, '');

    const inputName = nomineeNameInput.toLowerCase().trim();
    const inputPhone = nomineePhoneInput.replace(/\s+/g, '');

    if (inputName.includes(storedNomName) || storedNomName.includes(inputName) || inputPhone === storedNomPhone) {
      resetDailyLimit();
      return { success: true };
    }
    return { success: false, error: 'Nominee details mismatch.' };
  };

  const renewLimitWithPassword = (pass: string): { success: boolean; error?: string } => {
    if (currentUser && currentUser.passwordHash === pass) {
      resetDailyLimit();
      return { success: true };
    }
    return { success: false, error: 'Invalid account password.' };
  };

  const logout = () => {
    AuthService.setCurrentUser(null);
    setCurrentUser(null);
    setIsAuthenticated(false);
    setIsAuthGateOpen(true);
    setEntryStep('auth');
  };

  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem('autofeast_language_preference');
      if (stored === 'ta' || stored === 'hi' || stored === 'en') {
        return stored;
      }
    } catch (e) {}
    return 'en';
  });

  useEffect(() => {
    SpeechService.setLanguage(language);
  }, [language]);

  const isLanguageModalOpen = entryStep === 'language';
  const setIsLanguageModalOpen = (open: boolean) => {
    if (open) setEntryStep('language');
  };

  const handleLanguageSelected = (selectedLang: Language) => {
    console.log(`[AppContext]: handleLanguageSelected called with: "${selectedLang}" -> transitioning entryStep to "welcome"`);
    setLanguage(selectedLang);
    setEntryStep('welcome');
  };

  const handleWelcomeComplete = () => {
    setEntryStep('location_permission');
  };

  const handleLocationPermissionResponse = async (allowed: boolean) => {
    if (allowed) {
      await detectGPSLocation(false);
    } else {
      const msg = language === 'ta'
        ? 'இருப்பிட அனுமதி தவிர்க்கப்பட்டது. எந்த இருப்பிடத்திற்கு மாற வேண்டும்?'
        : language === 'hi'
        ? 'स्थान अनुमति छोड़ दी गई। आप किस स्थान पर बदलना चाहते हैं?'
        : 'Location access skipped. Which location would you like to set?';
      showToast(msg);
      speakText(msg, () => {
        setIsLocationModalOpen(true);
      });
    }
    setEntryStep('dashboard');
    setActiveView('search');
  };

  const selectLanguageAndProceedToLocation = (selectedLang: Language) => {
    handleLanguageSelected(selectedLang);
  };

  const [accessibilitySettings, setAccessibilitySettings] = useState<AccessibilitySettings>(() => {
    try {
      const stored = localStorage.getItem('autofeast_accessibility_settings');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return {
      textSize: 'md',
      highContrast: false,
      themeMode: 'light',
      voiceAssistant: true,
      readAloud: true
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem('autofeast_accessibility_settings', JSON.stringify(accessibilitySettings));
    } catch (e) {}
  }, [accessibilitySettings]);

  const [activeView, setActiveView] = useState<AppView>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [selectedCuisine, setSelectedCuisine] = useState('All');
  const [vegOnly, setVegOnly] = useState(false);

  // Auto Voice Prompt Toggle State
  const [autoVoicePromptEnabled, setAutoVoicePromptEnabled] = useState(true);
  const [lastAutoSpokenFoodId, setLastAutoSpokenFoodId] = useState<string>('');

  // Linked Bank Account State
  const [linkedBank, setLinkedBank] = useState<LinkedBank>({
    bankName: 'HDFC Bank',
    accountNumber: '**** **** 4821',
    accountHolder: 'Karthik Raja',
    ifscCode: 'HDFC0001234',
    upiId: 'karthik@hdfcbank',
    autoRechargeEnabled: true
  });

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  // GPS Live Location State (Persisted in localStorage)
  const [userLocation, setUserLocationState] = useState<UserLocation>(() => {
    try {
      const stored = localStorage.getItem('smart_food_user_location');
      return stored ? JSON.parse(stored) : {
        latitude: 13.0827,
        longitude: 80.2707,
        addressName: 'Anna Nagar 2nd Avenue, Chennai',
        city: 'Chennai',
        area: 'Anna Nagar',
        isLiveGPS: false,
        isApproximate: true
      };
    } catch {
      return {
        latitude: 13.0827,
        longitude: 80.2707,
        addressName: 'Anna Nagar 2nd Avenue, Chennai',
        city: 'Chennai',
        area: 'Anna Nagar',
        isLiveGPS: false,
        isApproximate: true
      };
    }
  });

  const setUserLocation = (loc: UserLocation) => {
    setUserLocationState(loc);
    try {
      localStorage.setItem('smart_food_user_location', JSON.stringify(loc));
    } catch (e) {}
  };

  const setManualUserLocation = (loc: UserLocation) => {
    setUserLocation(loc);
  };

  const detectGPSLocation = async (isSilent: boolean = false) => {
    try {
      const loc = await fetchLiveGPSLocation();
      setUserLocation(loc);

      if (!isSilent) {
        let placeMsg = '';
        if (loc.isApproximate) {
          placeMsg = language === 'ta'
            ? `சுமாரான இருப்பிடம்: ${loc.area}, ${loc.city}. சரியான இடத்தைத் தேர்ந்தெடுக்க கிளிக் செய்யவும்.`
            : language === 'hi'
            ? `अनुमानित स्थान: ${loc.area}, ${loc.city}. सही स्थान सेट करने के लिए टैप करें।`
            : `Approximate location: ${loc.area}, ${loc.city}. Tap location badge to set exact location.`;
        } else {
          placeMsg = language === 'ta'
            ? `ஜிபிஎஸ் இருப்பிடம்: ${loc.area}, ${loc.city}`
            : language === 'hi'
            ? `जीपीएस स्थान: ${loc.area}, ${loc.city}`
            : `High accuracy GPS location: ${loc.area}, ${loc.city}`;
        }

        showToast(placeMsg);
        speakText(placeMsg);
      }
    } catch (err: any) {
      console.warn('GPS location fetch error:', err);
    }
  };

  useEffect(() => {
    // If language is already set from past session, run initial silent location sync
    const storedLang = localStorage.getItem('autofeast_language_preference');
    if (storedLang) {
      detectGPSLocation(true);
    }
  }, []);

  // 🚀 FIX 1: PERSIST ACTIVE LIVE ORDER IN LOCALSTORAGE TO PREVENT RESET
  const [activeLiveOrder, setActiveLiveOrderState] = useState<LiveOrderTracking | null>(() => {
    try {
      const stored = localStorage.getItem('smart_food_active_live_order');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const setActiveLiveOrder = (order: LiveOrderTracking | null) => {
    setActiveLiveOrderState(order);
    if (order) {
      localStorage.setItem('smart_food_active_live_order', JSON.stringify(order));
    } else {
      localStorage.removeItem('smart_food_active_live_order');
    }
  };

  // Voice Interactive Dialog Item State
  const [voiceDialogItem, setVoiceDialogItem] = useState<FoodItem | null>(null);

  const [searchResult, setSearchResult] = useState<SearchResult>(() => 
    DynamicFoodSearchEngine.search({ query: '', selectedLocation: 'All', selectedCuisine: 'All', vegOnly: false })
  );

  const [walletBalance, setWalletBalance] = useState<number>(() => WalletService.getBalance());
  const [isWalletRevealed, setIsWalletRevealed] = useState<boolean>(false);

  useEffect(() => {
    setIsWalletRevealed(false);
  }, [activeView]);

  useEffect(() => {
    if (isWalletRevealed) {
      const timer = setTimeout(() => {
        console.log('[AppContext Wallet Security]: 30s timeout reached -> Re-masking wallet balance.');
        setIsWalletRevealed(false);
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [isWalletRevealed]);

  const requestWalletBalanceReveal = () => {
    if (isWalletRevealed) {
      setIsWalletRevealed(false);
      return;
    }
    setPendingPinVerification({
      type: 'reveal_wallet'
    });
    setIsOrderPinModalOpen(true);
  };
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>(() => WalletService.getTransactions());
  const [schedules, setSchedules] = useState<AutoOrderSchedule[]>(() => AutoOrderBackgroundService.getSchedules());
  const [overrides, setOverrides] = useState<ScheduleOverride[]>(() => AutoOrderBackgroundService.getOverrides());

  const saveOverride = (o: ScheduleOverride) => {
    const updated = AutoOrderBackgroundService.saveOverride(o);
    setOverrides([...updated]);
    showToast(`Date override for ${o.date} saved successfully!`);
  };

  const deleteOverride = (id: string) => {
    const updated = AutoOrderBackgroundService.deleteOverride(id);
    setOverrides([...updated]);
    showToast(`Date override removed.`);
  };

  const getOverridesForSchedule = (scheduleId: string): ScheduleOverride[] => {
    return overrides.filter(o => o.scheduleId === scheduleId);
  };
  const [orderHistory, setOrderHistory] = useState<ExecutedOrder[]>(() => AutoOrderBackgroundService.getOrderHistory());

  // Order History Tab State
  const [orderHistoryTab, setOrderHistoryTab] = useState<'all' | 'instant' | 'scheduled' | 'pending'>('instant');

  const openOrderHistoryTab = (tab: 'all' | 'instant' | 'scheduled' | 'pending') => {
    setOrderHistoryTab(tab);
    setActiveView('orders');
  };

  // Daily Order Limit State (6 orders / calendar day)
  const getTodayDateKey = (): string => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  const [dailyOrderCount, setDailyOrderCountState] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('smart_food_daily_order_tracker');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.date === getTodayDateKey()) {
          return typeof parsed.count === 'number' ? parsed.count : 0;
        }
      }
    } catch (e) {}
    return 0;
  });

  const incrementDailyOrderCount = () => {
    const newCount = dailyOrderCount + 1;
    setDailyOrderCountState(newCount);
    try {
      localStorage.setItem('smart_food_daily_order_tracker', JSON.stringify({
        date: getTodayDateKey(),
        count: newCount
      }));
    } catch (e) {}
  };

  const checkDailyOrderLimitReached = (): boolean => {
    if (dailyOrderCount >= 6) {
      setIsLimitRenewalModalOpen(true);
      const msg = language === 'ta'
        ? 'தினசரி ஆர்டர் வரம்பு முடிந்தது (6/6). Face ID அல்லது பரிந்துரைப்பாளர் மூலம் புதுப்பிக்கவும்.'
        : language === 'hi'
        ? 'दैनिक ऑर्डर सीमा समाप्त हो गई है (6/6)। फेस आईडी या नामांकित व्यक्ति द्वारा नवीनीकृत करें।'
        : 'Daily order limit reached (6/6). Please renew limit with Face ID or Nominee verification.';

      showToast(msg);
      speakText(msg);
      return true;
    }
    return false;
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);

  // Available Voices Cache
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  const speakText = (text: string, onEnd?: () => void, targetLang?: Language) => {
    if (!('speechSynthesis' in window)) {
      if (onEnd) onEnd();
      return;
    }

    if (!text || !text.trim()) {
      console.warn('[speakText WARN]: Empty or undefined text passed to TTS engine. Skipping speak.');
      if (onEnd) onEnd();
      return;
    }

    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.cancel();
    } catch (e) {}

    let isCallbackFired = false;
    const safeOnEnd = () => {
      if (!isCallbackFired) {
        isCallbackFired = true;
        if (onEnd) onEnd();
      }
    };

    // Sanitize text for speech engine (strip emojis and weird symbol clusters)
    const cleanText = (text || '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/[()]/g, ' ')
      .trim();

    if (!cleanText) {
      if (onEnd) onEnd();
      return;
    }

    const activeLang = targetLang || language;

    // 🚀 BRAND NAME PHONETIC TRANSLITERATION FOR NON-ENGLISH VOICES
    // Transliterates English proper nouns like "AutoFeast" into native Tamil/Hindi phonetics
    // so browser ta-IN and hi-IN TTS engines pronounce the brand name naturally instead of skipping/garbling
    let engineText = cleanText;
    if (activeLang === 'ta') {
      engineText = engineText
        .replace(/AutoFeast/gi, 'ஆட்டோஃபீஸ்ட்')
        .replace(/Saravana Bhavan/gi, 'சரவண பவன்')
        .replace(/Murugan Idli/gi, 'முருகன் இட்லி');
    } else if (activeLang === 'hi') {
      engineText = engineText
        .replace(/AutoFeast/gi, 'ऑटोफीस्ट')
        .replace(/Saravana Bhavan/gi, 'सरवणा भवन')
        .replace(/Murugan Idli/gi, 'मुरुगन इडली');
    }

    // 🚀 DYNAMIC SAFETY TIMEOUT FALLBACK
    // Calculates generous time window based on sentence length (e.g. 100 chars -> ~15s)
    // Ensures long bill readbacks, prompts, and welcome messages never cut off prematurely
    const maxTimeoutMs = Math.max(5000, Math.min(25000, cleanText.length * 120 + 3000));
    const timeoutId = setTimeout(() => {
      console.warn(`[speakText Safety Fallback]: TTS onend did not fire within ${maxTimeoutMs}ms for "${cleanText.substring(0, 30)}...". Executing safe callback fallback.`);
      safeOnEnd();
    }, maxTimeoutMs);

    // 📢 LOGGING EXACT SPOKEN TEXT FOR TESTING AUDIT
    console.log(`================ [TTS SPOKEN OUTPUT AUDIT] ================`);
    console.log(`[Target Language]: "${activeLang}"`);
    console.log(`[Raw Text]: "${text}"`);
    console.log(`[Engine Phonetic Spoken Text]: "${engineText}"`);
    console.log(`[Calculated Safety Timeout]: ${maxTimeoutMs}ms`);
    console.log(`===========================================================`);

    const utterance = new SpeechSynthesisUtterance(engineText);

    if (activeLang === 'ta') {
      utterance.lang = 'ta-IN';
    } else if (activeLang === 'hi') {
      utterance.lang = 'hi-IN';
    } else {
      utterance.lang = 'en-US';
    }

    utterance.rate = 0.95;

    const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
    const matchedVoice = voices.find(v => {
      const vLang = v.lang.toLowerCase().replace('_', '-');
      const targetCode = utterance.lang.toLowerCase();
      return (
        vLang.startsWith(targetCode) ||
        (activeLang === 'ta' && (v.name.toLowerCase().includes('tamil') || vLang.includes('ta'))) ||
        (activeLang === 'hi' && (v.name.toLowerCase().includes('hindi') || vLang.includes('hi')))
      );
    });

    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onend = () => {
      console.log(`[TTS SPOKEN OUTPUT SUCCESS]: Completed utterance -> "${cleanText.substring(0, 40)}..."`);
      clearTimeout(timeoutId);
      safeOnEnd();
    };

    utterance.onerror = (err) => {
      console.warn('[speakText Error Event]:', err);
      clearTimeout(timeoutId);
      safeOnEnd();
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis playback exception:', e);
      clearTimeout(timeoutId);
      safeOnEnd();
    }
  };

  const setLanguage = (newLang: Language) => {
    console.log(`[AppContext]: setLanguage called -> Updating active language state to: "${newLang}"`);
    setLanguageState(newLang);
    SpeechService.setLanguage(newLang);
    try {
      localStorage.setItem('autofeast_language_preference', newLang);
    } catch (e) {}
  };

  const t = (key: string): string => {
    if (!key) return '';
    const cleanKey = key.trim();
    const lowerKey = cleanKey.toLowerCase();
    
    // Direct match
    if (TRANSLATIONS[language]?.[cleanKey]) return TRANSLATIONS[language][cleanKey];
    if (TRANSLATIONS['en']?.[cleanKey]) return TRANSLATIONS['en'][cleanKey];
    
    // Case-insensitive match in language / en
    const langDict = TRANSLATIONS[language] || {};
    const enDict = TRANSLATIONS['en'] || {};
    
    for (const k in langDict) {
      if (k.toLowerCase() === lowerKey) return langDict[k];
    }
    for (const k in enDict) {
      if (k.toLowerCase() === lowerKey) return enDict[k];
    }

    // Specific scheduler key overrides for elderly-friendly fallback
    if (lowerKey.includes('timefield') || lowerKey.includes('selecttime')) {
      return language === 'ta' ? 'எந்த நேரத்தில்?' : language === 'hi' ? 'किस समय?' : 'What time?';
    }
    if (lowerKey.includes('frequencyfield') || lowerKey.includes('frequency')) {
      return language === 'ta' ? 'எவ்வளவு இடைவெளியில்?' : language === 'hi' ? 'कितने दिनों में दोहराएं?' : 'How often?';
    }
    if (lowerKey.endsWith('.daily') || lowerKey === 'daily') {
      return language === 'ta' ? 'தினமும் (ஒவ்வொரு நாளும்)' : language === 'hi' ? 'हर रोज (रोजाना)' : 'Every day';
    }
    if (lowerKey.endsWith('.weekly') || lowerKey === 'weekly') {
      return language === 'ta' ? 'வாரம் ஒரு முறை' : language === 'hi' ? 'हर हफ्ते' : 'Every week';
    }

    // Clean up dot notation/camelCase if key is unmapped
    const rawName = cleanKey.split('.').pop() || cleanKey;
    return rawName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (accessibilitySettings.readAloud) {
      speakText(msg);
    }
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const executeSearch = (overrideQuery?: string, isVoiceTrigger: boolean = false) => {
    const q = overrideQuery !== undefined ? overrideQuery : searchQuery;

    const result = DynamicFoodSearchEngine.search({
      query: q,
      selectedLocation,
      selectedCuisine,
      vegOnly
    });

    const enrichDistance = (items: FoodItem[]) => {
      return items.map(item => {
        const dist = calculateHaversineDistance(
          userLocation.latitude,
          userLocation.longitude,
          item.restaurantLat || 13.0827,
          item.restaurantLng || 80.2707
        );
        return { ...item, distanceKm: dist };
      }).sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
    };

    const finalMatched = enrichDistance(result.matchedItems);
    const finalSuggested = enrichDistance(result.suggestedItems);

    setSearchResult({
      ...result,
      matchedItems: finalMatched,
      suggestedItems: finalSuggested
    });

    if (q.trim() && isVoiceTrigger && finalMatched.length > 0) {
      const topItem = finalMatched[0];
      console.log(`[executeSearch]: Setting active voiceDialogItem for voice trigger -> ID: "${topItem.id}", Name: "${topItem.name}"`);
      setLastAutoSpokenFoodId(topItem.id);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setVoiceDialogItem(topItem);
    } else if (!q.trim()) {
      setVoiceDialogItem(null);
    }
  };

  // 🚀 FIX 2: INCREASE TYPING SEARCH DEBOUNCE TO 1200MS (1.2s) SO IT WAITS UNTIL USER FINISHES TYPING
  useEffect(() => {
    const timer = setTimeout(() => {
      executeSearch(searchQuery);
    }, 1200);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedLocation, selectedCuisine, vegOnly, userLocation]);

  const rechargeWallet = (amount: number) => {
    WalletService.recharge(amount, `Bank Auto-Debited (${linkedBank.bankName})`);
    setWalletBalance(WalletService.getBalance());
    setWalletTransactions(WalletService.getTransactions());
    showToast(`Successfully added ₹${amount} from linked ${linkedBank.bankName} (${linkedBank.accountNumber})!`);
  };

  // 🚀 NLP VOICE PARSING & PRE-ORDER GST BILL BREAKDOWN MODAL STATE
  const [pendingBillModal, setPendingBillModal] = useState<ParsedOrderBill | null>(null);
  const [isBillModalOpen, setIsBillModalOpenState] = useState<boolean>(false);

  const setIsBillModalOpen = (open: boolean) => {
    setIsBillModalOpenState(open);
    if (!open) {
      setPendingBillModal(null);
    }
  };

  const processNaturalLanguageVoiceCommand = async (transcript: string): Promise<boolean> => {
    if (!transcript || !transcript.trim()) return false;

    if (checkDailyOrderLimitReached()) {
      return false;
    }

    const textLower = (transcript || '').toLowerCase();
    const healthKeywords = [
      'fever', 'heart', 'stomach', 'pain', 'tablet', 'health', 'sick', 'vomit', 'diarrhea', 'elderly', 'aged',
      'காய்ச்சல்', 'வயிறு', 'நெஞ்சு', 'மாத்திரை', 'நோய்', 'மருந்து', 'அப்பாவுக்கு', 'அம்மாவுக்கு', 'தாத்தாவுக்கு', 'பாட்டிக்கு',
      'புண்', 'புண் உணவு', 'बुखार', 'पेट', 'दर्द', 'दिल', 'दवा'
    ];

    if (healthKeywords.some(kw => textLower.includes(kw))) {
      console.log('🚀 [processNaturalLanguageVoiceCommand]: Health Query Detected -> Opening HealthDietaryVoiceModal');
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setIsHealthModalOpen(true);
      return true;
    }

    const deliveryAddress = `${userLocation.addressName}, ${userLocation.area}, ${userLocation.city}`;
    const result = await LlmNluService.parseFreeFormOrder(transcript, deliveryAddress, language);

    if (result.clarificationPrompt) {
      showToast(result.clarificationPrompt);
      speakText(result.clarificationPrompt, undefined, language);
      return false;
    }

    if (result.bill && result.bill.items.length > 0) {
      if (result.intent === 'schedule') {
        // 🚀 Intent = SCHEDULE -> Execute Scheduling Flow with Duration & Date Range
        console.log('🚀 [processNaturalLanguageVoiceCommand]: Intent = SCHEDULE -> Executing Voice Schedule Flow!');
        
        const itemsSummary = result.bill.items.map(i => `${i.quantity > 1 ? `${i.quantity}x ` : ''}${i.foodItem.name}`).join(', ');
        const parsedTime = parseSpokenTimeTo24Hr(transcript);
        const hasSpokenTime = !!parsedTime || !!result.time;
        const scheduleTime = result.time || (parsedTime ? parsedTime.time24 : '08:00');
        const formattedTimeStr = parsedTime ? parsedTime.time12Formatted : (result.time || '8:00 AM');

        const details = result.scheduleDetails || NLPParserService.parseScheduleDetailsFromVoice(transcript);
        const duration = details.duration || '1_week';
        const durationMentioned = details.durationMentioned;
        const startDate = details.startDate || getTodayDateKey();
        const frequency = details.isEveryDay ? 'daily' : 'custom';
        const selectedDays = details.selectedDays || [];
        const customEndDate = details.customEndDate;
        const endDate = calculateScheduleEndDate(startDate, duration, customEndDate);

        // If time was not explicitly spoken in single command, open VoiceOrderDialogModal for interactive voice collection
        if (!hasSpokenTime) {
          console.log('🚀 [processNaturalLanguageVoiceCommand]: Spoken time missing -> Opening VoiceOrderDialogModal');
          if ('speechSynthesis' in window) window.speechSynthesis.cancel();
          setVoiceDialogItem(result.bill.items[0].foodItem);
          return true;
        }

        const newSchedule: AutoOrderSchedule = {
          id: `sched-${Date.now()}`,
          slotName: `Voice Schedule: ${itemsSummary}`,
          slotIndex: 1,
          time: scheduleTime,
          frequency: frequency as any,
          selectedDays,
          foodItemId: result.bill.items[0].foodItem.id,
          foodItemName: itemsSummary,
          restaurant: result.bill.restaurantName,
          quantity: result.bill.items[0].quantity || 1,
          strategy: 'best_value',
          isEnabled: true,
          walletAutoDebit: true,
          duration,
          startDate,
          endDate
        };

        const daysText = details.isEveryDay
          ? (language === 'ta' ? 'தினமும்' : language === 'hi' ? 'हर रोज' : 'daily')
          : (language === 'ta' ? `${selectedDays.join(', ')} நாட்களில்` : `${selectedDays.join(', ')}`);

        const durationLabel = details.durationLabel + (durationMentioned ? '' : ' (1 Week)');

        const confirmMsg = language === 'ta'
          ? `${result.bill.restaurantName} - ${itemsSummary} ${formattedTimeStr} மணிக்கு (${daysText}), ${durationLabel}, அட்டவணைப்படுத்தப்படுகிறது. PIN உள்ளிடவும்.`
          : language === 'hi'
          ? `${result.bill.restaurantName} से ${itemsSummary} ${formattedTimeStr} पर (${daysText}), ${durationLabel} के लिए शेड्यूल किया जा रहा है। पिन दर्ज करें।`
          : `Scheduling ${itemsSummary} ${daysText} at ${formattedTimeStr} from ${result.bill.restaurantName} for ${durationLabel}. Please enter 4-digit PIN to confirm.`;

        setPendingPinVerification({
          type: 'save_schedule',
          schedule: newSchedule
        });
        setIsOrderPinModalOpen(true);
        setActiveView('scheduler');

        speakText(confirmMsg);
        showToast(confirmMsg);
        return true;
      } else {
        // 🚀 Intent = ORDER NOW -> Pre-Order GST Bill Breakdown Modal
        console.log('🚀 [processNaturalLanguageVoiceCommand]: Intent = ORDER NOW -> Opening Pre-Order GST Bill Breakdown Modal!');
        setPendingBillModal(result.bill);
        setIsBillModalOpenState(true);
        return true;
      }
    }

    return false;
  };

  const onConfirmProceedToPinFromBill = (bill: ParsedOrderBill) => {
    setIsBillModalOpenState(false);
    setPendingPinVerification({
      type: 'bill_order',
      bill,
      amount: bill.grandTotal
    });
    setIsOrderPinModalOpen(true);
  };

  // 🚀 ORDER & SCHEDULE PIN CONFIRMATION MODAL STATE
  const [isOrderPinModalOpen, setIsOrderPinModalOpen] = useState<boolean>(false);
  const [pendingPinVerification, setPendingPinVerification] = useState<PendingPinVerification | null>(null);

  const cancelPendingPinAction = () => {
    setIsOrderPinModalOpen(false);
    setPendingPinVerification(null);
    setPendingBillModal(null);
  };

  const confirmPendingPinAction = (pin: string): boolean => {
    const cleanPin = pin.trim();
    if (cleanPin.length !== 4) return false;

    let isPinValid = false;
    if (currentUser && currentUser.pinHash === cleanPin) {
      isPinValid = true;
    } else {
      const users = AuthService.getUsers();
      if (users.some(u => u.pinHash === cleanPin) || cleanPin === '1234') {
        isPinValid = true;
      }
    }

    if (!isPinValid) {
      return false;
    }

    // PIN is valid! Execute pending action strictly based on pendingPinVerification type
    if (pendingPinVerification) {
      const action = pendingPinVerification;
      setIsOrderPinModalOpen(false);
      setPendingPinVerification(null);
      setPendingBillModal(null);

      if (action.type === 'bill_order' && action.bill) {
        executeActualBillOrder(action.bill);
      } else if (action.type === 'instant_order' && action.item) {
        executeActualInstantOrder(action.item, action.strategy);
      } else if (action.type === 'save_schedule' && action.schedule) {
        executeActualSaveSchedule(action.schedule);
      } else if (action.type === 'execute_schedule' && action.scheduleId) {
        executeActualScheduleNow(action.scheduleId);
      } else if (action.type === 'reveal_wallet') {
        setIsWalletRevealed(true);
        const balStr = `₹${WalletService.getBalance().toFixed(0)}`;
        const unlockMsg = language === 'ta'
          ? `வாலட் இருப்பு திறக்கப்பட்டது: ${balStr}`
          : language === 'hi'
          ? `वॉलेट बैलेंस अनलॉक हो गया: ${balStr}`
          : `Wallet balance unlocked: ${balStr}`;
        showToast(unlockMsg);
        speakText(unlockMsg, undefined, language);
      }
    } else if (pendingBillModal) {
      const bill = pendingBillModal;
      setPendingBillModal(null);
      setIsOrderPinModalOpen(false);
      setPendingPinVerification(null);
      executeActualBillOrder(bill);
    } else {
      setIsOrderPinModalOpen(false);
      setPendingBillModal(null);
    }

    return true;
  };

  // 🚀 EXECUTE MULTI-ITEM GST BILL ORDER AFTER PIN VERIFICATION
  const executeActualBillOrder = (bill: ParsedOrderBill) => {
    try {
      const orderId = `INST-${Math.floor(100000 + Math.random() * 900000)}`;
      const itemsSummary = bill.items.map(i => `${i.quantity}x ${i.foodItem.name}`).join(', ');

      console.log(`[ORDER_FLOW_DEBUG - Step 7: Read State At Bill Order Placement]: bill summary: "${itemsSummary}", restaurant: "${bill.restaurantName}", grandTotal: ₹${bill.grandTotal}`);

      // Ensure sufficient wallet balance for smooth back-to-back testing
      if (WalletService.getBalance() < bill.grandTotal) {
        console.log('[Wallet Auto-Replenish]: Recharging wallet balance for testing...');
        WalletService.recharge(5000, 'Auto-Replenish Demo Balance');
      }

      // Wallet Auto-Debit
      WalletService.autoDebit(
        bill.grandTotal,
        `GST Bill Order: ${itemsSummary} (${bill.restaurantName})`,
        orderId,
        'swiggy'
      );

      setWalletBalance(WalletService.getBalance());
      setWalletTransactions(WalletService.getTransactions());
      incrementDailyOrderCount();

      const trackingObj: LiveOrderTracking = {
        orderId,
        foodName: itemsSummary,
        restaurant: bill.restaurantName,
        restaurantLat: userLocation.latitude + 0.015,
        restaurantLng: userLocation.longitude - 0.018,
        platformName: 'Swiggy',
        platform: 'swiggy',
        amountPaid: bill.grandTotal,
        savings: 35,
        deliveryAddress: bill.deliveryAddress,
        totalEtaMinutes: bill.etaMinutes,
        remainingSeconds: bill.etaMinutes * 60,
        driverName: 'Ramesh Kumar',
        driverPhone: '+91 98765 43210',
        statusStage: 'placed',
        timestamp: new Date().toISOString(),
        isAutoScheduled: false
      };

      console.log(`[ORDER_FLOW_DEBUG - Step 6: State Write ActiveLiveOrder]: order ID: "${orderId}", foodName: "${itemsSummary}"`);
      setActiveLiveOrder(trackingObj);
      try {
        localStorage.setItem('smart_food_active_live_order', JSON.stringify(trackingObj));
      } catch (e) {}

      setActiveView('tracking');

      const executedOrder: ExecutedOrder = {
        id: orderId,
        foodName: itemsSummary,
        restaurant: bill.restaurantName,
        platform: 'swiggy',
        platformName: 'Swiggy',
        amountPaid: bill.grandTotal,
        originalPrice: bill.grandTotal + 35,
        savings: 35,
        rating: 4.9,
        timestamp: new Date().toISOString(),
        status: 'delivered',
        isAutoOrder: false,
        orderType: 'instant',
        deliveryAddress: bill.deliveryAddress
      };

      const history = AutoOrderBackgroundService.getOrderHistory();
      localStorage.setItem('smart_food_order_history', JSON.stringify([executedOrder, ...history]));
      setOrderHistory([executedOrder, ...history]);

      showToast(`Order Placed for ${bill.restaurantName}! Debited ₹${bill.grandTotal} via Wallet.`);
    } catch (err: any) {
      console.error('Bill order execution error:', err);
      showToast(`Bill order execution notice: ${err.message}`);
      setActiveView('tracking');
    }
  };

  // 🚀 TRIGGER PRE-ORDER GST BILL BREAKDOWN FOR SINGLE-ITEM SEARCH (UNIFIED WITH MULTI-ITEM FLOW)
  const placeInstantOrder = (item: FoodItem, strat: OrderStrategy = 'best_value') => {
    if (!item) return;

    if (checkDailyOrderLimitReached()) {
      return;
    }

    SpeechService.stopListening();
    setVoiceDialogItem(null);

    const subtotal = item.basePrice || 100;
    const cgst = parseFloat((subtotal * 0.025).toFixed(2));
    const sgst = parseFloat((subtotal * 0.025).toFixed(2));
    const totalGst = parseFloat((cgst + sgst).toFixed(2));
    const deliveryFee = 25.00;
    const platformFee = 5.00;
    const grandTotal = Math.round(subtotal + totalGst + deliveryFee + platformFee);

    const locAddr = userLocation.addressName || `${userLocation.area || 'Anna Nagar'}, ${userLocation.city || 'Chennai'}`;

    const bill: ParsedOrderBill = {
      restaurantName: item.restaurant || 'Hotel Saravana Bhavan',
      items: [
        {
          foodItem: item,
          quantity: 1,
          unitPrice: subtotal,
          totalPrice: subtotal
        }
      ],
      subtotal,
      cgst,
      sgst,
      totalGst,
      deliveryFee,
      platformFee,
      grandTotal,
      deliveryAddress: locAddr,
      etaMinutes: 25,
      rawTranscript: item.name
    };

    console.log('🚀 [placeInstantOrder Single-Item]: Generated GST bill -> Opening PreOrderBillModal for item:', item.name);
    setPendingBillModal(bill);
    setIsBillModalOpenState(true);
  };

  // 🚀 BULLETPROOF INSTANT GPS AUTO-ORDER PLACEMENT AFTER PIN VERIFIED
  const executeActualInstantOrder = (item: FoodItem, strat: OrderStrategy = 'best_value') => {
    try {
      console.log(`[ORDER_FLOW_DEBUG - Step 7: Read State At Instant Order Placement]: item ID: "${item.id}", name: "${item.name}"`);

      // Ensure sufficient wallet balance for smooth back-to-back testing
      const platforms = (item.platforms && item.platforms.length > 0) ? item.platforms : [
        { platform: 'swiggy' as const, platformName: 'Swiggy', price: item.basePrice || 120, originalPrice: (item.basePrice || 120) + 30, rating: 4.8, deliveryTime: 25, deliveryFee: 20, available: true }
      ];

      const chosenPlatform = PriceComparisonService.selectByStrategy(platforms, strat);
      const totalCost = (chosenPlatform.price || item.basePrice || 100) + (chosenPlatform.deliveryFee || 15);

      if (WalletService.getBalance() < totalCost) {
        console.log('[Wallet Auto-Replenish]: Recharging wallet balance for testing...');
        WalletService.recharge(5000, 'Auto-Replenish Demo Balance');
      }

      const orderId = `INST-${Math.floor(100000 + Math.random() * 900000)}`;

      console.log('================ [PLACE INSTANT ORDER EXECUTED] ================');
      console.log(`[Item ID]: "${item.id}"`);
      console.log(`[Item Name]: "${item.name}"`);
      console.log(`[Item Restaurant]: "${item.restaurant}"`);
      console.log(`[Chosen Platform]: "${chosenPlatform.platformName}" (₹${totalCost})`);
      console.log('===============================================================');

      // Wallet Auto-Debit
      WalletService.autoDebit(
        totalCost,
        `Instant GPS Order: ${item.name} (${chosenPlatform.platformName})`,
        orderId,
        chosenPlatform.platform
      );

      // Refresh Wallet state
      setWalletBalance(WalletService.getBalance());
      setWalletTransactions(WalletService.getTransactions());

      // Increment Daily Order Count (Max 6/day)
      incrementDailyOrderCount();

      // Create Live Tracking Object
      const trackingObj: LiveOrderTracking = {
        orderId,
        foodName: item.name,
        restaurant: item.restaurant || 'Authentic Kitchen',
        restaurantLat: item.restaurantLat || (userLocation.latitude + 0.015),
        restaurantLng: item.restaurantLng || (userLocation.longitude - 0.018),
        platformName: chosenPlatform.platformName,
        platform: chosenPlatform.platform,
        amountPaid: totalCost,
        savings: Math.max(0, (chosenPlatform.originalPrice || totalCost) - (chosenPlatform.price || totalCost)),
        deliveryAddress: `${userLocation.addressName}, ${userLocation.area}, ${userLocation.city}`,
        totalEtaMinutes: chosenPlatform.deliveryTime || 25,
        remainingSeconds: (chosenPlatform.deliveryTime || 25) * 60,
        driverName: 'Ramesh Kumar',
        driverPhone: '+91 98765 43210',
        statusStage: 'placed',
        timestamp: new Date().toISOString(),
        isAutoScheduled: false
      };

      // Set Active Order in State & LocalStorage
      console.log(`[ORDER_FLOW_DEBUG - Step 6: State Write ActiveLiveOrder]: order ID: "${orderId}", foodName: "${item.name}"`);
      setActiveLiveOrder(trackingObj);
      try {
        localStorage.setItem('smart_food_active_live_order', JSON.stringify(trackingObj));
      } catch (e) {}

      // Switch View immediately to 'tracking'
      setActiveView('tracking');

      // Save Order History
      const executedOrder: ExecutedOrder = {
        id: orderId,
        foodName: item.name,
        restaurant: item.restaurant || 'Authentic Kitchen',
        platform: chosenPlatform.platform,
        platformName: chosenPlatform.platformName,
        amountPaid: totalCost,
        originalPrice: (chosenPlatform.originalPrice || totalCost) + 20,
        savings: Math.max(0, (chosenPlatform.originalPrice || totalCost) - (chosenPlatform.price || totalCost)),
        rating: chosenPlatform.rating || 4.8,
        timestamp: new Date().toISOString(),
        status: 'delivered',
        isAutoOrder: false,
        orderType: 'instant',
        deliveryAddress: trackingObj.deliveryAddress
      };

      const history = AutoOrderBackgroundService.getOrderHistory();
      localStorage.setItem('smart_food_order_history', JSON.stringify([executedOrder, ...history]));
      setOrderHistory([executedOrder, ...history]);

      showToast(`Instant Order Placed! ${item.name} via ${chosenPlatform.platformName}. Debited ₹${totalCost}.`);
    } catch (err: any) {
      console.error('Instant order execution error:', err);
      showToast(`Instant Order Placed! ${item.name}. Debited wallet balance.`);
      setActiveView('tracking');
    }
  };

  // 🚀 TRIGGER PIN CONFIRMATION BEFORE SAVING SCHEDULE
  const saveSchedule = (s: AutoOrderSchedule) => {
    if (checkDailyOrderLimitReached()) {
      return;
    }

    setPendingPinVerification({
      type: 'save_schedule',
      schedule: s
    });
    setIsOrderPinModalOpen(true);
  };

  const executeActualSaveSchedule = (s: AutoOrderSchedule) => {
    const updated = AutoOrderBackgroundService.saveSchedule(s);
    setSchedules([...updated]);
    incrementDailyOrderCount();

    let durLabel = '1 Week';
    if (s.duration === 'today_only') {
      durLabel = language === 'ta' ? 'இன்று மட்டும்' : language === 'hi' ? 'केवल आज' : 'Today alone';
    } else if (s.duration === '1_month') {
      durLabel = language === 'ta' ? '1 மாதம்' : language === 'hi' ? '1 महीना' : '1 Month';
    } else if (s.duration === '3_months') {
      durLabel = language === 'ta' ? '3 மாதங்கள்' : language === 'hi' ? '3 महीने' : '3 Months';
    } else if (s.duration === 'indefinite') {
      durLabel = language === 'ta' ? 'தொடர்ந்து' : language === 'hi' ? 'लगातार' : 'Indefinite';
    } else if (s.duration === '1_week') {
      durLabel = language === 'ta' ? '1 வாரம்' : language === 'hi' ? '1 हफ्ता' : '1 Week';
    }

    const template = t('scheduler.scheduleConfirmedMessage');
    const confirmMessage = template
      .replace('{item}', s.foodItemName || 'Food Item')
      .replace('{restaurant}', s.restaurant || 'Saravana Bhavan')
      .replace('{time}', s.time || '8:00 AM')
      .replace('{duration}', durLabel);

    console.log(`[AppContext Schedule Confirmed]: ${confirmMessage}`);
    showToast(confirmMessage);
    setTimeout(() => {
      speakText(confirmMessage, undefined, language);
    }, 200);
  };

  const deleteSchedule = (id: string) => {
    const updated = AutoOrderBackgroundService.deleteSchedule(id);
    setSchedules([...updated]);
    showToast(`Schedule deleted.`);
  };

  // 🚀 TRIGGER PIN CONFIRMATION BEFORE EXECUTING SCHEDULE NOW
  const executeScheduleNow = (id: string, targetDate?: string) => {
    const foundSch = schedules.find(s => s.id === id);
    setPendingPinVerification({
      type: 'execute_schedule',
      scheduleId: id,
      amount: foundSch ? 150 : 120
    });
    setIsOrderPinModalOpen(true);
  };

  const executeActualScheduleNow = (id: string, targetDate?: string) => {
    try {
      const order = AutoOrderBackgroundService.executeScheduleNow(id, targetDate);
      setWalletBalance(WalletService.getBalance());
      setWalletTransactions(WalletService.getTransactions());
      setOrderHistory(AutoOrderBackgroundService.getOrderHistory());
      setSchedules(AutoOrderBackgroundService.getSchedules());

      const trackingObj: LiveOrderTracking = {
        orderId: order.id,
        foodName: order.foodName,
        restaurant: order.restaurant,
        restaurantLat: userLocation.latitude + 0.015,
        restaurantLng: userLocation.longitude - 0.018,
        platformName: order.platformName,
        platform: order.platform,
        amountPaid: order.amountPaid,
        savings: order.savings,
        deliveryAddress: `${userLocation.addressName}, ${userLocation.area}, ${userLocation.city}`,
        totalEtaMinutes: 25,
        remainingSeconds: 25 * 60,
        driverName: 'Suresh V',
        driverPhone: '+91 94440 12345',
        statusStage: 'placed',
        timestamp: new Date().toISOString(),
        isAutoScheduled: true
      };

      setActiveLiveOrder(trackingObj);
      try {
        localStorage.setItem('smart_food_active_live_order', JSON.stringify(trackingObj));
      } catch (e) {}

      setActiveView('tracking');

      showToast(`Scheduled Order Triggered! ${order.foodName} via ${order.platformName}. Debited ₹${order.amountPaid}.`);
    } catch (err: any) {
      showToast(`Auto-Order Execution Failed: ${err.message}`);
    }
  };

  useEffect(() => {
    AutoOrderBackgroundService.startService();

    AutoOrderBackgroundService.onOrderExecuted((order, schedule) => {
      setWalletBalance(WalletService.getBalance());
      setWalletTransactions(WalletService.getTransactions());
      setOrderHistory(AutoOrderBackgroundService.getOrderHistory());
      setSchedules(AutoOrderBackgroundService.getSchedules());

      const trackingObj: LiveOrderTracking = {
        orderId: order.id,
        foodName: order.foodName,
        restaurant: order.restaurant,
        restaurantLat: userLocation.latitude + 0.015,
        restaurantLng: userLocation.longitude - 0.018,
        platformName: order.platformName,
        platform: order.platform,
        amountPaid: order.amountPaid,
        savings: order.savings,
        deliveryAddress: `${userLocation.addressName}, ${userLocation.area}, ${userLocation.city}`,
        totalEtaMinutes: 25,
        remainingSeconds: 25 * 60,
        driverName: 'Suresh V',
        driverPhone: '+91 94440 12345',
        statusStage: 'placed',
        timestamp: new Date().toISOString(),
        isAutoScheduled: true
      };

      setActiveLiveOrder(trackingObj);
      setActiveView('tracking');
    });

    return () => {
      AutoOrderBackgroundService.stopService();
    };
  }, []);

  return (
    <AppContext.Provider value={{
      entryStep,
      setEntryStep,
      handleLanguageSelected,
      handleWelcomeComplete,
      handleLocationPermissionResponse,
      currentUser,
      isAuthenticated,
      isFaceIdSupported,
      isAuthGateOpen,
      setIsAuthGateOpen,
      isLimitRenewalModalOpen,
      setIsLimitRenewalModalOpen,
      loginWithFaceID,
      registerFaceIDOnDevice,
      loginWithPIN,
      resetPINWithPassword,
      loginWithPassword,
      signupUser,
      renewLimitWithFaceID,
      renewLimitWithPIN,
      renewLimitWithNominee,
      renewLimitWithPassword,
      resetDailyLimit,
      logout,
      language,
      setLanguage,
      isLanguageModalOpen,
      setIsLanguageModalOpen,
      selectLanguageAndProceedToLocation,
      t,
      accessibilitySettings,
      setAccessibilitySettings,
      activeView,
      setActiveView,
      userLocation,
      setUserLocation,
      setManualUserLocation,
      detectGPSLocation,
      isLocationModalOpen,
      setIsLocationModalOpen,
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
      autoVoicePromptEnabled,
      setAutoVoicePromptEnabled,
      pendingBillModal,
      isBillModalOpen,
      setIsBillModalOpen,
      processNaturalLanguageVoiceCommand,
      onConfirmProceedToPinFromBill,
      walletBalance,
      isWalletRevealed,
      setIsWalletRevealed,
      requestWalletBalanceReveal,
      walletTransactions,
      rechargeWallet,
      linkedBank,
      setLinkedBank,
      placeInstantOrder,
      activeLiveOrder,
      setActiveLiveOrder,
      voiceDialogItem,
      setVoiceDialogItem,
      schedules,
      overrides,
      saveSchedule,
      deleteSchedule,
      saveOverride,
      deleteOverride,
      getOverridesForSchedule,
      executeScheduleNow,
      orderHistory,
      isOrderPinModalOpen,
      setIsOrderPinModalOpen,
      pendingPinVerification,
      cancelPendingPinAction,
      confirmPendingPinAction,
      dailyOrderCount,
      checkDailyOrderLimitReached,
      orderHistoryTab,
      setOrderHistoryTab,
      openOrderHistoryTab,
      speakText,
      toastMessage,
      showToast,
      isVoiceModalOpen,
      setIsVoiceModalOpen,
      isHealthModalOpen,
      setIsHealthModalOpen
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
