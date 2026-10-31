import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { AuthService } from '../services/authService';
import { TRANSLATIONS } from '../data/translations';
import { Language } from '../types';
import { SpeechController } from '../services/speechController';
import { VoicePinInput } from './VoicePinInput';
import {
  KeyRound,
  Scan,
  ShieldCheck,
  UserPlus,
  LogIn,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  Mic
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
}

export const getLocalizedAuthErrorMessage = (errMessage: string | null | undefined, lang: Language): string => {
  if (!errMessage) return TRANSLATIONS[lang]['auth.errServerError'] || 'Server error occurred.';
  const str = String(errMessage).trim();
  const lower = str.toLowerCase();

  if (lower === 'server_error' || lower.includes('500') || lower.includes('unexpected error') || lower.includes('error registering account')) {
    return TRANSLATIONS[lang]['auth.errServerError'] || 'Server error occurred. Please try again later.';
  }
  if (lower.includes('already exists') || lower === 'account_exists' || lower.includes('409')) {
    return TRANSLATIONS[lang]['auth.errAccountExists'] || 'An account with this email already exists.';
  }
  if (lower.includes('account not found') || lower === 'account_not_found' || lower.includes('404')) {
    return TRANSLATIONS[lang]['auth.errAccountNotFound'] || 'Account not found. Please check your email or username.';
  }
  if (lower.includes('incorrect password') || lower === 'wrong_password' || lower.includes('401')) {
    return TRANSLATIONS[lang]['auth.errWrongPassword'] || 'Incorrect password. Please try again.';
  }
  if (lower.includes('too many') || lower === 'rate_limit_exceeded' || lower.includes('429')) {
    return TRANSLATIONS[lang]['auth.errRateLimitExceeded'] || 'Too many login attempts. Please try again in 15 minutes.';
  }
  if (lower.includes('unavailable') || lower.includes('database service unavailable') || lower === 'database_unavailable' || lower.includes('503')) {
    return TRANSLATIONS[lang]['auth.errServerUnavailable'] || 'Server database is currently unavailable. Please try again later.';
  }
  if (lower.includes('cannot reach') || lower.includes('network') || lower.includes('fetch failed')) {
    return TRANSLATIONS[lang]['auth.errCannotReachServer'] || 'Cannot reach server. Please check your internet connection.';
  }
  if (lower.includes('invalid input') || lower === 'invalid_input' || lower.includes('400')) {
    return TRANSLATIONS[lang]['auth.errInvalidInput'] || str;
  }
  return str;
};

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen }) => {
  const {
    t,
    language,
    speakText,
    currentUser,
    loginWithFaceID,
    loginWithPassword,
    resetPINWithPassword,
    signupUser,
    userLocation,
    showToast,
    setIsAuthGateOpen
  } = useApp();

  // Regular login uses Password or Face ID. PIN is reserved for sensitive checkpoints (Daily Limit & Payment).
  const [activeTab, setActiveTab] = useState<'password' | 'signup' | 'faceid' | 'reset_pin'>(() => {
    return (AuthService.hasRegisteredUsers() || currentUser) ? 'password' : 'signup';
  });

  // Status State
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Password Login State (Email/Username + Password)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Reset PIN State
  const [resetEmail, setResetEmail] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [newPin, setNewPin] = useState('');

  // Signup State
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPin, setSignupPin] = useState('');
  const [signupNomineeName, setSignupNomineeName] = useState('');
  const [signupNomineePhone, setSignupNomineePhone] = useState('');
  const [signupNomineeEmail, setSignupNomineeEmail] = useState('');
  const [signupNomineePassword, setSignupNomineePassword] = useState('');
  const [enableFaceIDOnSignup, setEnableFaceIDOnSignup] = useState(false);
  const lastSpokenServerErrorRef = useRef<string | null>(null);
  // Track whether the browser has received a user gesture yet (needed for Chrome autoplay policy display hint)
  const [gestureReceived, setGestureReceived] = useState(() => SpeechController.hasUserGesture());
  const [isListeningEmail, setIsListeningEmail] = useState(false);

  const handleVoiceEmailInput = async () => {
    if (!SpeechController.isSupported()) return;
    setIsListeningEmail(true);
    const result = await SpeechController.listen({
      language,
      owner: 'auth_voice_email',
      promptQuestion: language === 'ta'
        ? 'உங்கள் மின்னஞ்சல் அல்லது பயனர்பெயரைக் கூறுங்கள்.'
        : language === 'hi'
        ? 'कृपया अपना ईमेल या उपयोगकर्ता नाम बोलें।'
        : 'Please say your email address or username.'
    });
    setIsListeningEmail(false);
    if (result.transcript && result.transcript.trim()) {
      let raw = result.transcript.trim().toLowerCase();
      // format spoken email: replace " at " with "@", " dot " with "."
      raw = raw.replace(/\s+at\s+/g, '@').replace(/\s+dot\s+/g, '.').replace(/\s+/g, '');
      setEmail(raw);
      const confirmReadback = language === 'ta'
        ? `நீங்கள் கூறியது: ${raw}. தொடர உங்கள் கடவுச்சொல்லை உள்ளிடவும்.`
        : language === 'hi'
        ? `आपने कहा: ${raw}। जारी रखने के लिए अपना पासवर्ड दर्ज करें।`
        : `You entered: ${raw}. Please type your password to continue.`;
      speakText(confirmReadback, undefined, language);
    }
  };

  useEffect(() => {
    if (gestureReceived) return;
    const onGesture = () => setGestureReceived(true);
    window.addEventListener('click', onGesture, { once: true, capture: true });
    window.addEventListener('keydown', onGesture, { once: true, capture: true });
    window.addEventListener('touchstart', onGesture, { once: true, capture: true });
    return () => {
      window.removeEventListener('click', onGesture, { capture: true });
      window.removeEventListener('keydown', onGesture, { capture: true });
      window.removeEventListener('touchstart', onGesture, { capture: true });
    };
  }, [gestureReceived]);

  const announceAuthError = (message: string) => {
    const isServerError =
      message === TRANSLATIONS[language]['auth.errServerError'] ||
      message === TRANSLATIONS.en['auth.errServerError'] ||
      message === TRANSLATIONS.ta['auth.errServerError'] ||
      message === TRANSLATIONS.hi['auth.errServerError'];

    if (isServerError) {
      if (lastSpokenServerErrorRef.current === message) return;
      lastSpokenServerErrorRef.current = message;
    }
    speakText(message);
  };

  /**
   * Sync activeTab on open:
   * Regular login uses Email/Password or Face ID.
   */
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);

      if (AuthService.hasRegisteredUsers() || currentUser) {
        setActiveTab('password');
      } else {
        setActiveTab('signup');
      }
    }
  }, [isOpen]);

  /**
   * Voice Guidance Welcome Prompt on Open:
   */
  useEffect(() => {
    if (isOpen) {
      const speakLocationAfterWelcome = () => {
        const areaStr = userLocation?.area || 'Anna Nagar';
        const cityStr = userLocation?.city || 'Chennai';
        const locText = language === 'ta'
          ? `உங்கள் டெலிவரி இருப்பிடம்: ${areaStr}, ${cityStr}.`
          : language === 'hi'
          ? `आपका डिलीवरी स्थान: ${areaStr}, ${cityStr}।`
          : `Your delivery location is set to ${areaStr}, ${cityStr}.`;
        speakText(locText);
      };

      if (activeTab === 'password') {
        const welcomePasswordMsg = language === 'ta'
          ? 'வணக்கம்! உங்கள் மின்னஞ்சல் மற்றும் கடவுச்சொல்லை உள்ளிடவும்.'
          : language === 'hi'
          ? 'नमस्ते! अपना ईमेल और पासवर्ड दर्ज करें।'
          : 'Welcome to AutoFeast! Please enter your email and password to sign in.';
        speakText(welcomePasswordMsg, speakLocationAfterWelcome);
      } else if (activeTab === 'signup') {
        const welcomeFirst = language === 'ta'
          ? 'AutoFeast-க்கு வரவேற்கிறோம்! கணக்கை உருவாக்க உங்கள் தகவல்களை நிரப்பவும்.'
          : language === 'hi'
          ? 'AutoFeast में आपका स्वागत है! आरंभ करने के लिए अपना नया खाता बनाएं।'
          : 'Welcome to AutoFeast! Please create your account to get started.';
        speakText(welcomeFirst, speakLocationAfterWelcome);
      }
    }
  }, [isOpen, activeTab]);

  /**
   * Optional Quick Face ID Authentication Trigger
   */
  const handleTriggerFaceID = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const promptText = t('auth.promptFaceID');
    speakText(promptText);

    try {
      const result = await loginWithFaceID();
      setIsProcessing(false);
      if (result.success) {
        const successMsg = t('auth.success');
        setSuccessMessage(successMsg);
        speakText(successMsg);
        showToast(successMsg);

        setTimeout(() => {
          setIsAuthGateOpen(false);
        }, 1000);
      } else {
        const failMsg = getLocalizedAuthErrorMessage(result.error || t('auth.failed'), language);
        setErrorMessage(failMsg);
        announceAuthError(failMsg);
      }
    } catch (err: any) {
      setIsProcessing(false);
      const failMsg = getLocalizedAuthErrorMessage(err.message || t('auth.failed'), language);
      setErrorMessage(failMsg);
      announceAuthError(failMsg);
    }
  };

  /**
   * Handle Password Login Submit (Traditional Email/Username + Password)
   */
  const handlePasswordLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !password) {
      const msg = getLocalizedAuthErrorMessage('invalid_input', language);
      setErrorMessage(msg);
      return;
    }

    setIsProcessing(true);
    SpeechController.notifyUserGesture();
    try {
      const user = await loginWithPassword(email, password);
      SpeechController.notifyUserGesture();
      setIsProcessing(false);
      lastSpokenServerErrorRef.current = null;
      const msg = `Welcome back, ${user.name}! Login successful.`;
      setSuccessMessage(msg);
      speakText(msg);
      showToast(msg);

      setTimeout(() => {
        setIsAuthGateOpen(false);
      }, 1000);
    } catch (err: any) {
      setIsProcessing(false);
      const localizedErr = getLocalizedAuthErrorMessage(err.message, language);
      setErrorMessage(localizedErr);
      announceAuthError(localizedErr);
    }
  };

  /**
   * Handle Reset PIN Submit
   */
  const handleResetPINSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    setIsProcessing(true);
    try {
      const user = await resetPINWithPassword(resetEmail, resetPassword, newPin);
      setIsProcessing(false);
      const msg = `4-Digit PIN updated successfully for ${user.name}. Your security PIN is ready for orders & limit renewals.`;
      setSuccessMessage(msg);
      speakText(msg);
      showToast(msg);
      setTimeout(() => {
        setActiveTab('password');
      }, 1500);
    } catch (err: any) {
      setIsProcessing(false);
      const localizedErr = getLocalizedAuthErrorMessage(err.message, language);
      setErrorMessage(localizedErr);
      announceAuthError(localizedErr);
    }
  };

  /**
   * Handle Signup Submit
   */
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanPin = signupPin.trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      const pinErr = getLocalizedAuthErrorMessage('invalid_input', language);
      setErrorMessage(pinErr);
      speakText(pinErr);
      return;
    }

    setIsProcessing(true);
    SpeechController.notifyUserGesture();
    try {
      await signupUser(
        signupName,
        signupEmail,
        signupPassword,
        cleanPin,
        signupNomineeName || 'Emergency Nominee',
        signupNomineePhone || '+91 98765 43210',
        signupNomineeEmail,
        signupNomineePassword,
        enableFaceIDOnSignup
      );
      SpeechController.notifyUserGesture();
      setIsProcessing(false);
      lastSpokenServerErrorRef.current = null;
      const msg = `Account created successfully! Welcome to AutoFeast, ${signupName}. Your security PIN is saved for payment confirmations.`;
      setSuccessMessage(msg);
      speakText(msg);
      showToast(msg);

      setTimeout(() => {
        setIsAuthGateOpen(false);
      }, 1200);
    } catch (err: any) {
      setIsProcessing(false);
      const localizedErr = getLocalizedAuthErrorMessage(err.message, language);
      setErrorMessage(localizedErr);
      announceAuthError(localizedErr);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-white text-[#302720] rounded-3xl shadow-2xl overflow-hidden border-2 border-[#F1DEDC] transition-all">

        {/* Modal Top Header */}
        <div className="relative bg-[#F1DEDC] p-6 text-center text-[#302720] border-b border-[#E7D9D6]">
          <div className="inline-flex items-center justify-center p-3 bg-white rounded-2xl mb-2 shadow-sm border border-[#E7D9D6]">
            <Sparkles className="w-7 h-7 text-[#8B1E2D] mr-2" />
            <h1 className="text-3xl font-black tracking-tight text-[#302720]">AutoFeast AI</h1>
          </div>
          <p className="text-xs font-black text-[#8B1E2D] uppercase tracking-widest">
            {activeTab === 'signup' ? 'First-Time Account Setup' : 'Secure Account Login'}
          </p>
        </div>

        {/* Autoplay policy hint: visible until first user gesture */}
        {!gestureReceived && (
          <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-300 rounded-2xl flex items-center gap-2 text-amber-800 text-xs font-bold">
            <span className="text-base">🔊</span>
            <span>
              {language === 'ta'
                ? 'குரல் வழிகாட்டுதலை இயக்க எங்கும் தட்டவும்'
                : language === 'hi'
                ? 'आवाज़ मार्गदर्शन चालू करने के लिए कहीं भी टैप करें'
                : 'Tap anywhere to enable voice guidance'}
            </span>
          </div>
        )}

        {/* Status Alerts */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-4 bg-[#8B1E2D]/10 border-2 border-[#8B1E2D] rounded-2xl flex items-start space-x-3 text-[#8B1E2D] text-sm animate-pulse">
            <AlertCircle className="w-6 h-6 text-[#8B1E2D] shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold">{errorMessage}</p>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mx-6 mt-4 p-4 bg-[#16A34A]/10 border-2 border-[#16A34A] rounded-2xl flex items-center space-x-3 text-[#16A34A] text-sm">
            <CheckCircle2 className="w-6 h-6 text-[#16A34A] shrink-0" />
            <p className="font-extrabold">{successMessage}</p>
          </div>
        )}

        {/* TAB 1: TRADITIONAL EMAIL / PASSWORD LOGIN */}
        {activeTab === 'password' && (
          <form onSubmit={handlePasswordLoginSubmit} className="p-6 sm:p-8 space-y-5">
            <div className="text-center mb-2">
              <h2 className="text-2xl font-black text-[#302720] flex items-center justify-center gap-2">
                <LogIn className="w-6 h-6 text-[#8B1E2D]" />
                <span>Account Sign In</span>
              </h2>
              <p className="text-xs font-bold text-[#4A5568] mt-1">
                Enter Email and Password to access your AutoFeast account
              </p>
            </div>

            <div>
              <label className="block text-xs font-black text-[#302720] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-[#8B1E2D]" />
                <span>Email Address / Username *</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="email"
                  className="w-full px-4 py-3 bg-slate-50 border border-[#E7D9D6] rounded-2xl text-[#302720] font-bold text-sm focus:outline-none focus:border-[#8B1E2D] pr-12"
                  placeholder="name@autofeast.com or Username"
                />
                <button
                  type="button"
                  onClick={handleVoiceEmailInput}
                  className={`absolute right-2 top-2 p-1.5 rounded-xl transition-all cursor-pointer ${
                    isListeningEmail ? 'bg-red-600 text-white animate-pulse' : 'text-[#4A5568] hover:text-[#8B1E2D] hover:bg-orange-50'
                  }`}
                  title="Speak email or username"
                >
                  <Mic className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-[#302720] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-[#8B1E2D]" />
                <span>Account Password *</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="current-password"
                  className="w-full px-4 py-3 bg-slate-50 border border-[#E7D9D6] rounded-2xl text-[#302720] font-bold text-sm focus:outline-none focus:border-[#8B1E2D] pr-10"
                  placeholder="••••••••"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-[#4A5568] hover:text-[#302720] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 px-6 bg-[#8B1E2D] hover:bg-[#302720] text-white font-black rounded-2xl shadow-xl flex items-center justify-center space-x-2 text-sm transition-all cursor-pointer"
            >
              <LogIn className="w-5 h-5 text-white" />
              <span>Sign In with Password</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('faceid'); handleTriggerFaceID(); }}
              className="w-full py-3 px-4 bg-[#F1DEDC] hover:bg-[#E7D9D6] text-[#302720] border border-[#E7D9D6] rounded-2xl font-black text-xs flex items-center justify-center space-x-2 shadow-sm transition-all cursor-pointer"
            >
              <Scan className="w-4 h-4 text-[#8B1E2D]" />
              <span>Use Face ID Quick Login (WebAuthn)</span>
            </button>

            <div className="flex items-center justify-between text-xs font-bold pt-3 border-t border-[#F1DEDC]">
              <button
                type="button"
                onClick={() => setActiveTab('signup')}
                className="text-[#8B1E2D] hover:underline cursor-pointer"
              >
                New Account? Sign Up
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('reset_pin')}
                className="text-[#4A5568] hover:text-[#302720] cursor-pointer"
              >
                Reset 4-Digit PIN
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: SIGNUP & INITIAL ACCOUNT CREATION */}
        {activeTab === 'signup' && (
          <form onSubmit={handleSignupSubmit} className="p-6 sm:p-8 space-y-4 max-h-[75vh] overflow-y-auto">
            <div className="text-center mb-2">
              <h2 className="text-xl font-black text-[#302720]">First-Time Account & PIN Setup</h2>
              <p className="text-xs text-[#8B1E2D] font-bold mt-0.5">
                Create your account and set your custom 4-digit PIN for order confirmations
              </p>
            </div>

            <div>
              <label className="block text-xs font-black text-[#302720] uppercase tracking-wider mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-[#8B1E2D]" />
                <span>{t('auth.fullNameLabel')} *</span>
              </label>
              <input
                type="text"
                value={signupName}
                onChange={e => setSignupName(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-[#E7D9D6] rounded-2xl text-[#302720] text-sm font-bold focus:outline-none focus:border-[#8B1E2D]"
                placeholder="Ramesh Kumar"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-[#302720] uppercase tracking-wider mb-1 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-[#8B1E2D]" />
                <span>{t('auth.emailLabel')} *</span>
              </label>
              <input
                type="email"
                value={signupEmail}
                onChange={e => setSignupEmail(e.target.value)}
                required
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="email"
                className="w-full px-4 py-2.5 bg-slate-50 border border-[#E7D9D6] rounded-2xl text-[#302720] text-sm font-bold focus:outline-none focus:border-[#8B1E2D]"
                placeholder="user@autofeast.com"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black text-[#302720] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-[#8B1E2D]" />
                  <span>{t('auth.passwordLabel')} *</span>
                </label>
                <input
                  type="password"
                  value={signupPassword}
                  onChange={e => setSignupPassword(e.target.value)}
                  required
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="new-password"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-[#E7D9D6] rounded-xl text-[#302720] text-xs font-bold focus:outline-none focus:border-[#8B1E2D]"
                  placeholder="••••••••"
                />

              </div>

              <div>
                <label className="block text-xs font-black text-[#8B1E2D] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5 text-[#8B1E2D]" />
                  <span>{t('auth.createPinLabel')} *</span>
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={signupPin}
                  onChange={e => setSignupPin(e.target.value.replace(/\D/g, ''))}
                  required
                  className="w-full px-3 py-2.5 bg-slate-50 border-2 border-[#8B1E2D] rounded-xl text-[#302720] text-sm font-black tracking-widest text-center"
                  placeholder="5678"
                />
                <VoicePinInput
                  language={language}
                  owner="signup_security_pin"
                  purpose="account"
                  autoStart
                  disabled={isProcessing}
                  onPinChange={setSignupPin}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black text-[#302720] uppercase tracking-wider mb-1">
                  {t('auth.nomineeNameLabel')}
                </label>
                <input
                  type="text"
                  value={signupNomineeName}
                  onChange={e => setSignupNomineeName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-[#E7D9D6] rounded-xl text-[#302720] text-xs focus:outline-none focus:border-[#8B1E2D]"
                  placeholder="Priya Raja"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#302720] uppercase tracking-wider mb-1">
                  {t('auth.nomineePhoneLabel')}
                </label>
                <input
                  type="text"
                  value={signupNomineePhone}
                  onChange={e => setSignupNomineePhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-[#E7D9D6] rounded-xl text-[#302720] text-xs focus:outline-none focus:border-[#8B1E2D]"
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black text-[#302720] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-[#8B1E2D]" />
                  <span>{t('auth.nomineeEmailLabel')} *</span>
                </label>
                <input
                  type="email"
                  value={signupNomineeEmail}
                  onChange={e => setSignupNomineeEmail(e.target.value)}
                  required
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="off"
                  className="w-full px-3 py-2 bg-slate-50 border border-[#E7D9D6] rounded-xl text-[#302720] text-xs focus:outline-none focus:border-[#8B1E2D]"
                  placeholder="nominee@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#302720] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-[#8B1E2D]" />
                  <span>{t('auth.nomineePasswordLabel')} *</span>
                </label>
                <input
                  type="password"
                  value={signupNomineePassword}
                  onChange={e => setSignupNomineePassword(e.target.value)}
                  required
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="new-password"
                  className="w-full px-3 py-2 bg-slate-50 border border-[#E7D9D6] rounded-xl text-[#302720] text-xs focus:outline-none focus:border-[#8B1E2D]"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <p className="text-[11px] font-semibold text-slate-500">
              {t('auth.nomineeCredentialsHint')}
            </p>

            <div className="p-3 bg-[#F1DEDC] border border-[#E7D9D6] rounded-2xl flex items-center space-x-3">
              <input
                type="checkbox"
                id="enableFaceIDSignup"
                checked={enableFaceIDOnSignup}
                onChange={e => setEnableFaceIDOnSignup(e.target.checked)}
                className="w-5 h-5 text-[#8B1E2D] accent-[#8B1E2D] rounded cursor-pointer"
              />
              <label htmlFor="enableFaceIDSignup" className="text-xs font-bold text-[#302720] cursor-pointer">
                {t('auth.enableFaceID')}
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-4 px-6 bg-[#8B1E2D] hover:bg-[#302720] text-white font-black rounded-2xl shadow-xl flex items-center justify-center space-x-2 text-sm transition-all cursor-pointer"
            >
              <UserPlus className="w-5 h-5 text-white" />
              <span>{t('auth.signupBtn')}</span>
            </button>

            <div className="text-center pt-2 border-t border-[#F1DEDC]">
              <button
                type="button"
                onClick={() => setActiveTab('password')}
                className="text-xs text-[#8B1E2D] hover:underline font-extrabold cursor-pointer"
              >
                Already have an account? Sign In with Password
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: OPTIONAL FACE ID QUICK LOGIN */}
        {activeTab === 'faceid' && (
          <div className="p-6 sm:p-8 text-center space-y-6">
            <div className="relative inline-flex items-center justify-center p-8 bg-[#F1DEDC] rounded-full border-4 border-[#8B1E2D] shadow-lg">
              <Scan className="w-20 h-20 text-[#8B1E2D]" />
            </div>

            <div>
              <h2 className="text-xl font-black text-[#302720]">{t('auth.promptFaceID')}</h2>
              <p className="text-xs text-[#4A5568] mt-1">
                Optional WebAuthn platform authenticator biometric check.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleTriggerFaceID}
                disabled={isProcessing}
                className="w-full py-4 px-6 bg-[#8B1E2D] hover:bg-[#302720] disabled:opacity-50 text-white font-black rounded-2xl shadow-xl flex items-center justify-center space-x-3 text-sm transition-all cursor-pointer"
              >
                <ShieldCheck className="w-5 h-5 text-white" />
                <span>{t('auth.retryFaceID')}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('password')}
                className="w-full py-3 px-6 bg-[#F1DEDC] hover:bg-[#E7D9D6] text-[#302720] font-bold rounded-2xl text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-[#8B1E2D]" />
                <span>Return to Password Login</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: RESET FORGOTTEN PIN VIA EMAIL & PASSWORD */}
        {activeTab === 'reset_pin' && (
          <form onSubmit={handleResetPINSubmit} className="p-6 sm:p-8 space-y-4">
            <div>
              <h3 className="text-lg font-black text-[#302720]">{t('auth.resetPinTitle')}</h3>
              <p className="text-xs text-[#4A5568] mt-0.5">Verify email & password to update your 4-digit PIN</p>
            </div>

            <div>
              <label className="block text-xs font-black text-[#302720] uppercase tracking-wider mb-1">
                Account Email Address
              </label>
              <input
                type="email"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-[#E7D9D6] rounded-2xl text-[#302720] text-sm focus:outline-none focus:border-[#8B1E2D]"
                placeholder="name@autofeast.com"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-[#302720] uppercase tracking-wider mb-1">
                Account Password
              </label>
              <input
                type="password"
                value={resetPassword}
                onChange={e => setResetPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-[#E7D9D6] rounded-2xl text-[#302720] text-sm focus:outline-none focus:border-[#8B1E2D]"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-[#8B1E2D] uppercase tracking-wider mb-1">
                New 4-Digit PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                required
                className="w-full px-4 py-3 bg-slate-50 border-2 border-[#8B1E2D] rounded-2xl text-[#302720] text-lg font-black tracking-widest text-center focus:outline-none"
                placeholder="5678"
              />
              <VoicePinInput
                language={language}
                owner="reset_security_pin"
                purpose="account"
                autoStart
                disabled={isProcessing}
                onPinChange={setNewPin}
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 px-6 bg-[#8B1E2D] hover:bg-[#302720] text-white font-black rounded-2xl shadow-xl flex items-center justify-center space-x-2 text-sm transition-all cursor-pointer"
            >
              <KeyRound className="w-5 h-5 text-white" />
              <span>Update 4-Digit PIN</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('password')}
              className="w-full py-2 text-xs text-[#4A5568] hover:text-[#302720] font-bold cursor-pointer"
            >
              Cancel & Return to Password Login
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
