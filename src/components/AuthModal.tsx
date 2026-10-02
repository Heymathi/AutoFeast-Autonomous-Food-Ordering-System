import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { AuthService } from '../services/authService';
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
  User
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
}

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
  const [enableFaceIDOnSignup, setEnableFaceIDOnSignup] = useState(false);

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
        const failMsg = result.error || t('auth.failed');
        setErrorMessage(failMsg);
        speakText(failMsg);
      }
    } catch (err: any) {
      setIsProcessing(false);
      const failMsg = err.message || t('auth.failed');
      setErrorMessage(failMsg);
      speakText(failMsg);
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
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setIsProcessing(true);
    try {
      const user = await loginWithPassword(email, password);
      setIsProcessing(false);
      const msg = `Welcome back, ${user.name}! Login successful.`;
      setSuccessMessage(msg);
      speakText(msg);
      showToast(msg);

      setTimeout(() => {
        setIsAuthGateOpen(false);
      }, 1000);
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMessage(err.message);
      speakText(err.message);
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
      setErrorMessage(err.message);
      speakText(err.message);
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
      const pinErr = 'Please set a 4-digit numeric PIN for your account.';
      setErrorMessage(pinErr);
      speakText(pinErr);
      return;
    }

    setIsProcessing(true);
    try {
      await signupUser(
        signupName,
        signupEmail,
        signupPassword,
        cleanPin,
        signupNomineeName || 'Emergency Nominee',
        signupNomineePhone || '+91 98765 43210',
        enableFaceIDOnSignup
      );
      setIsProcessing(false);
      const msg = `Account created successfully! Welcome to AutoFeast, ${signupName}. Your security PIN is saved for payment confirmations.`;
      setSuccessMessage(msg);
      speakText(msg);
      showToast(msg);

      setTimeout(() => {
        setIsAuthGateOpen(false);
      }, 1200);
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMessage(err.message);
      speakText(err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-white text-[#1A1110] rounded-3xl shadow-2xl overflow-hidden border-2 border-[#DAF0F7] transition-all">

        {/* Modal Top Header */}
        <div className="relative bg-[#DAF0F7] p-6 text-center text-[#1A1110] border-b border-[#B2E2F0]">
          <div className="inline-flex items-center justify-center p-3 bg-white rounded-2xl mb-2 shadow-sm border border-[#B2E2F0]">
            <Sparkles className="w-7 h-7 text-[#FF5A1F] mr-2" />
            <h1 className="text-3xl font-black tracking-tight text-[#1A1110]">AutoFeast AI</h1>
          </div>
          <p className="text-xs font-black text-[#FF5A1F] uppercase tracking-widest">
            {activeTab === 'signup' ? 'First-Time Account Setup' : 'Secure Account Login'}
          </p>
        </div>

        {/* Status Alerts */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-4 bg-[#C2185B]/10 border-2 border-[#C2185B] rounded-2xl flex items-start space-x-3 text-[#C2185B] text-sm animate-pulse">
            <AlertCircle className="w-6 h-6 text-[#C2185B] shrink-0 mt-0.5" />
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
              <h2 className="text-2xl font-black text-[#1A1110] flex items-center justify-center gap-2">
                <LogIn className="w-6 h-6 text-[#FF5A1F]" />
                <span>Account Sign In</span>
              </h2>
              <p className="text-xs font-bold text-[#4A5568] mt-1">
                Enter Email and Password to access your AutoFeast account
              </p>
            </div>

            <div>
              <label className="block text-xs font-black text-[#1A1110] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-[#FF5A1F]" />
                <span>Email Address / Username *</span>
              </label>
              <input
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="email"
                className="w-full px-4 py-3 bg-slate-50 border border-[#B2E2F0] rounded-2xl text-[#1A1110] font-bold text-sm focus:outline-none focus:border-[#FF5A1F]"
                placeholder="name@autofeast.com or Username"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-[#1A1110] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-[#FF5A1F]" />
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
                  className="w-full px-4 py-3 bg-slate-50 border border-[#B2E2F0] rounded-2xl text-[#1A1110] font-bold text-sm focus:outline-none focus:border-[#FF5A1F] pr-10"
                  placeholder="••••••••"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-[#4A5568] hover:text-[#1A1110] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 px-6 bg-[#FF5A1F] hover:bg-[#E04812] text-white font-black rounded-2xl shadow-xl flex items-center justify-center space-x-2 text-sm transition-all cursor-pointer"
            >
              <LogIn className="w-5 h-5 text-white" />
              <span>Sign In with Password</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('faceid'); handleTriggerFaceID(); }}
              className="w-full py-3 px-4 bg-[#DAF0F7] hover:bg-[#B2E2F0] text-[#1A1110] border border-[#B2E2F0] rounded-2xl font-black text-xs flex items-center justify-center space-x-2 shadow-sm transition-all cursor-pointer"
            >
              <Scan className="w-4 h-4 text-[#FF5A1F]" />
              <span>Use Face ID Quick Login (WebAuthn)</span>
            </button>

            <div className="flex items-center justify-between text-xs font-bold pt-3 border-t border-[#DAF0F7]">
              <button
                type="button"
                onClick={() => setActiveTab('signup')}
                className="text-[#FF5A1F] hover:underline cursor-pointer"
              >
                New Account? Sign Up
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('reset_pin')}
                className="text-[#4A5568] hover:text-[#1A1110] cursor-pointer"
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
              <h2 className="text-xl font-black text-[#1A1110]">First-Time Account & PIN Setup</h2>
              <p className="text-xs text-[#FF5A1F] font-bold mt-0.5">
                Create your account and set your custom 4-digit PIN for order confirmations
              </p>
            </div>

            <div>
              <label className="block text-xs font-black text-[#1A1110] uppercase tracking-wider mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-[#FF5A1F]" />
                <span>Full Name *</span>
              </label>
              <input
                type="text"
                value={signupName}
                onChange={e => setSignupName(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-[#B2E2F0] rounded-2xl text-[#1A1110] text-sm font-bold focus:outline-none focus:border-[#FF5A1F]"
                placeholder="Ramesh Kumar"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-[#1A1110] uppercase tracking-wider mb-1 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-[#FF5A1F]" />
                <span>Email Address / Username *</span>
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
                className="w-full px-4 py-2.5 bg-slate-50 border border-[#B2E2F0] rounded-2xl text-[#1A1110] text-sm font-bold focus:outline-none focus:border-[#FF5A1F]"
                placeholder="user@autofeast.com"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black text-[#1A1110] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-[#FF5A1F]" />
                  <span>Account Password *</span>
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
                  className="w-full px-3 py-2.5 bg-slate-50 border border-[#B2E2F0] rounded-xl text-[#1A1110] text-xs font-bold focus:outline-none focus:border-[#FF5A1F]"
                  placeholder="••••••••"
                />

              </div>

              <div>
                <label className="block text-xs font-black text-[#FF5A1F] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5 text-[#FF5A1F]" />
                  <span>Set 4-Digit PIN *</span>
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={signupPin}
                  onChange={e => setSignupPin(e.target.value.replace(/\D/g, ''))}
                  required
                  className="w-full px-3 py-2.5 bg-slate-50 border-2 border-[#FF5A1F] rounded-xl text-[#1A1110] text-sm font-black tracking-widest text-center"
                  placeholder="5678"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black text-[#1A1110] uppercase tracking-wider mb-1">
                  Nominee Name
                </label>
                <input
                  type="text"
                  value={signupNomineeName}
                  onChange={e => setSignupNomineeName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-[#B2E2F0] rounded-xl text-[#1A1110] text-xs focus:outline-none focus:border-[#FF5A1F]"
                  placeholder="Priya Raja"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#1A1110] uppercase tracking-wider mb-1">
                  Nominee Phone Number
                </label>
                <input
                  type="text"
                  value={signupNomineePhone}
                  onChange={e => setSignupNomineePhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-[#B2E2F0] rounded-xl text-[#1A1110] text-xs focus:outline-none focus:border-[#FF5A1F]"
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

            <div className="p-3 bg-[#DAF0F7] border border-[#B2E2F0] rounded-2xl flex items-center space-x-3">
              <input
                type="checkbox"
                id="enableFaceIDSignup"
                checked={enableFaceIDOnSignup}
                onChange={e => setEnableFaceIDOnSignup(e.target.checked)}
                className="w-5 h-5 text-[#FF5A1F] accent-[#FF5A1F] rounded cursor-pointer"
              />
              <label htmlFor="enableFaceIDSignup" className="text-xs font-bold text-[#1A1110] cursor-pointer">
                Optional: Also Link Face ID for this device (WebAuthn)
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-4 px-6 bg-[#FF5A1F] hover:bg-[#E04812] text-white font-black rounded-2xl shadow-xl flex items-center justify-center space-x-2 text-sm transition-all cursor-pointer"
            >
              <UserPlus className="w-5 h-5 text-white" />
              <span>Create My Account & Save PIN</span>
            </button>

            <div className="text-center pt-2 border-t border-[#DAF0F7]">
              <button
                type="button"
                onClick={() => setActiveTab('password')}
                className="text-xs text-[#FF5A1F] hover:underline font-extrabold cursor-pointer"
              >
                Already have an account? Sign In with Password
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: OPTIONAL FACE ID QUICK LOGIN */}
        {activeTab === 'faceid' && (
          <div className="p-6 sm:p-8 text-center space-y-6">
            <div className="relative inline-flex items-center justify-center p-8 bg-[#DAF0F7] rounded-full border-4 border-[#FF5A1F] shadow-lg">
              <Scan className="w-20 h-20 text-[#FF5A1F]" />
            </div>

            <div>
              <h2 className="text-xl font-black text-[#1A1110]">{t('auth.promptFaceID')}</h2>
              <p className="text-xs text-[#4A5568] mt-1">
                Optional WebAuthn platform authenticator biometric check.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleTriggerFaceID}
                disabled={isProcessing}
                className="w-full py-4 px-6 bg-[#FF5A1F] hover:bg-[#E04812] disabled:opacity-50 text-white font-black rounded-2xl shadow-xl flex items-center justify-center space-x-3 text-sm transition-all cursor-pointer"
              >
                <ShieldCheck className="w-5 h-5 text-white" />
                <span>{t('auth.retryFaceID')}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('password')}
                className="w-full py-3 px-6 bg-[#DAF0F7] hover:bg-[#B2E2F0] text-[#1A1110] font-bold rounded-2xl text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-[#FF5A1F]" />
                <span>Return to Password Login</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: RESET FORGOTTEN PIN VIA EMAIL & PASSWORD */}
        {activeTab === 'reset_pin' && (
          <form onSubmit={handleResetPINSubmit} className="p-6 sm:p-8 space-y-4">
            <div>
              <h3 className="text-lg font-black text-[#1A1110]">{t('auth.resetPinTitle')}</h3>
              <p className="text-xs text-[#4A5568] mt-0.5">Verify email & password to update your 4-digit PIN</p>
            </div>

            <div>
              <label className="block text-xs font-black text-[#1A1110] uppercase tracking-wider mb-1">
                Account Email Address
              </label>
              <input
                type="email"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-[#B2E2F0] rounded-2xl text-[#1A1110] text-sm focus:outline-none focus:border-[#FF5A1F]"
                placeholder="name@autofeast.com"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-[#1A1110] uppercase tracking-wider mb-1">
                Account Password
              </label>
              <input
                type="password"
                value={resetPassword}
                onChange={e => setResetPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-[#B2E2F0] rounded-2xl text-[#1A1110] text-sm focus:outline-none focus:border-[#FF5A1F]"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-[#FF5A1F] uppercase tracking-wider mb-1">
                New 4-Digit PIN
              </label>
              <input
                type="text"
                maxLength={4}
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                required
                className="w-full px-4 py-3 bg-slate-50 border-2 border-[#FF5A1F] rounded-2xl text-[#1A1110] text-lg font-black tracking-widest text-center focus:outline-none"
                placeholder="5678"
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 px-6 bg-[#FF5A1F] hover:bg-[#E04812] text-white font-black rounded-2xl shadow-xl flex items-center justify-center space-x-2 text-sm transition-all cursor-pointer"
            >
              <KeyRound className="w-5 h-5 text-white" />
              <span>Update 4-Digit PIN</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('password')}
              className="w-full py-2 text-xs text-[#4A5568] hover:text-[#1A1110] font-bold cursor-pointer"
            >
              Cancel & Return to Password Login
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
