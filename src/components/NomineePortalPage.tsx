import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Trash2,
  Mail,
  ShieldAlert,
  KeyRound,
  Clock,
  ArrowLeft,
  LogOut,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog.js';
import { FoodItem } from '../types';
import { VoicePinInput } from './VoicePinInput';
import { SpeechController } from '../services/speechController';

type NomineeScreen = 'login' | 'forgot_email' | 'forgot_otp' | 'forgot_reset' | 'forgot_success';

export const NomineePortalPage: React.FC = () => {
  const { language, t, showToast, speakText } = useApp();

  // Screen state
  const [screen, setScreen] = useState<NomineeScreen>('login');

  // Auth & login state
  const [nomineeEmail, setNomineeEmail] = useState('');
  const [nomineePassword, setNomineePassword] = useState('');
  const [nomineeToken, setNomineeToken] = useState<string | null>(() => {
    try {
      const stored = sessionStorage.getItem('autofeast_nominee_token');
      return stored && stored !== 'undefined' ? stored : null;
    } catch {
      return null;
    }
  });
  const [nomineeName, setNomineeName] = useState<string>(() => {
    try {
      return sessionStorage.getItem('autofeast_nominee_name') || 'Nominee';
    } catch {
      return 'Nominee';
    }
  });

  // Forgot password flow state
  const [forgotEmail, setForgotEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  // Control Panel state
  const [enteredPin, setEnteredPin] = useState('');
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [newNomineePin, setNewNomineePin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [lockCountdown, setLockCountdown] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Approval requests & restricted food catalog
  const [serverApprovals, setServerApprovals] = useState<any[]>([]);
  const [restrictedFoodIds, setRestrictedFoodIds] = useState<string[]>([]);
  const [selectedFoodToAdd, setSelectedFoodToAdd] = useState('');
  const [itemPins, setItemPins] = useState<Record<string, string>>({});
  const [itemFeedback, setItemFeedback] = useState<Record<string, { type: 'success' | 'error'; message: string }>>({});
  const [isDeciding, setIsDeciding] = useState<Record<string, boolean>>({});

  // Helper for API URLs (Vercel-compatible: relative /api/... or VITE_API_BASE_URL)
  const getApiUrl = (path: string) => {
    const envBase = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.API_BASE_URL;
    if (envBase) {
      return `${envBase.replace(/\/$/, '')}${path.startsWith('/') ? path : '/' + path}`;
    }
    return path;
  };

  // Lock countdown timer
  useEffect(() => {
    let timer: any;
    if (lockCountdown !== null && lockCountdown > 0) {
      timer = setInterval(() => {
        setLockCountdown(prev => (prev && prev > 1 ? prev - 1 : null));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockCountdown]);

  // Fetch approvals and restricted items once logged in
  const fetchApprovals = async (token?: string | null) => {
    const tkn = token || nomineeToken;
    if (!tkn) return;
    try {
      const res = await fetch(getApiUrl('/api/nominee/approvals'), {
        headers: { Authorization: `Bearer ${tkn}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.approvals)) {
          setServerApprovals(data.approvals);
        }
      }
    } catch (err) {
      console.warn('[NomineePortalPage] Failed to fetch approvals:', err);
    }
  };

  const fetchRestrictedItems = async (token?: string | null) => {
    const tkn = token || nomineeToken;
    if (!tkn) return;
    try {
      const res = await fetch(getApiUrl('/api/nominee/restricted-items'), {
        headers: { Authorization: `Bearer ${tkn}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.restrictedFoodIds)) {
          setRestrictedFoodIds(data.restrictedFoodIds);
        }
      }
    } catch (err) {
      console.warn('[NomineePortalPage] Failed to fetch restricted items:', err);
    }
  };

  useEffect(() => {
    if (nomineeToken) {
      void fetchApprovals(nomineeToken);
      void fetchRestrictedItems(nomineeToken);
      const interval = setInterval(() => {
        void fetchApprovals(nomineeToken);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [nomineeToken]);

  // Handler: Nominee Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    if (!nomineeEmail.trim() || !nomineePassword) {
      setPinError('Nominee email and password are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(getApiUrl('/api/nominee/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomineeEmail: nomineeEmail.trim(), nomineePassword })
      });
      const data = await res.json();
      if (res.ok && data.success && data.nomineeToken) {
        setNomineeToken(data.nomineeToken);
        setNomineeName(data.nomineeName || 'Nominee');
        setNomineePassword('');
        try {
          sessionStorage.setItem('autofeast_nominee_token', data.nomineeToken);
          if (data.nomineeName) sessionStorage.setItem('autofeast_nominee_name', data.nomineeName);
        } catch {}
        showToast('Nominee signed in successfully!', 'success');
      } else if (res.status === 429) {
        setPinError('Account locked due to 5 failed attempts. Please try again in 15 minutes.');
      } else {
        setPinError(data.error || 'Invalid nominee credentials.');
      }
    } catch (err: any) {
      setPinError(err?.message || 'Network error logging in. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: Forgot Password - Step 1: Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotMessage(null);
    if (!forgotEmail.trim()) {
      setForgotError('Please enter your nominee email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(getApiUrl('/api/nominee/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomineeEmail: forgotEmail.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setForgotMessage(data.message || 'If that email is registered, a 6-digit OTP has been sent.');
        setScreen('forgot_otp');
      } else if (res.status === 429) {
        setForgotError('Too many requests. Please wait and try again later.');
      } else {
        setForgotError(data.error || 'Failed to send reset OTP.');
      }
    } catch {
      setForgotError('Network error sending OTP. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: Forgot Password - Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    if (!otp.trim()) {
      setForgotError('Please enter the 6-digit OTP.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(getApiUrl('/api/nominee/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomineeEmail: forgotEmail.trim(), otp: otp.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success && data.resetToken) {
        setResetToken(data.resetToken);
        setScreen('forgot_reset');
      } else if (res.status === 429) {
        setForgotError('Too many requests. Please wait.');
      } else {
        setForgotError(data.error || 'Invalid or expired OTP.');
      }
    } catch {
      setForgotError('Network error verifying OTP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: Forgot Password - Step 3: Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    if (!newPassword || !confirmPassword) {
      setForgotError('Please enter and confirm your new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setForgotError('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(getApiUrl('/api/nominee/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomineeEmail: forgotEmail.trim(),
          resetToken,
          newPassword,
          confirmPassword
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setScreen('forgot_success');
      } else if (res.status === 429) {
        setForgotError('Too many attempts. Please try again later.');
      } else {
        setForgotError(data.error || 'Failed to reset password.');
      }
    } catch {
      setForgotError('Network error resetting password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: Logout
  const handleLogout = () => {
    setNomineeToken(null);
    setIsPinVerified(false);
    setEnteredPin('');
    try {
      sessionStorage.removeItem('autofeast_nominee_token');
      sessionStorage.removeItem('autofeast_nominee_name');
    } catch {}
    setScreen('login');
  };

  // PIN verification
  const handleVerifyPin = async (voicePin?: string) => {
    SpeechController.releaseMic('nominee_verify_pin');
    if (!nomineeToken) return;
    if (lockCountdown && lockCountdown > 0) return;

    const pinToVerify = voicePin ?? enteredPin;
    if (!pinToVerify || pinToVerify.length !== 4) {
      setPinError('PIN must be 4 numeric digits.');
      return;
    }

    setIsSubmitting(true);
    setPinError(null);
    try {
      const res = await fetch(getApiUrl('/api/nominee/verify-pin'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${nomineeToken}`
        },
        body: JSON.stringify({ nomineePin: pinToVerify })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsPinVerified(true);
        setPinError(null);
        showToast('Nominee PIN verified successfully!', 'success');
        speakText('Nominee PIN verified successfully!');
      } else if (res.status === 429 || data.locked) {
        setLockCountdown(15 * 60);
        setPinError('Nominee PIN locked after 3 failed attempts.');
      } else {
        const left = data.attemptsLeft !== undefined ? data.attemptsLeft : 2;
        setPinError(`Incorrect Nominee PIN. ${left} attempt(s) remaining.`);
      }
    } catch {
      setPinError('Network error verifying PIN.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Set new PIN
  const handleSetNewPin = async () => {
    if (!nomineeToken) return;
    if (newNomineePin.length !== 4 || !/^\d{4}$/.test(newNomineePin)) {
      setPinError('PIN must be exactly 4 numeric digits.');
      return;
    }

    setIsSubmitting(true);
    setPinError(null);
    try {
      const res = await fetch(getApiUrl('/api/nominee/set-pin'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${nomineeToken}`
        },
        body: JSON.stringify({ nomineePin: newNomineePin })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEnteredPin('');
        setNewNomineePin('');
        showToast('Nominee PIN set successfully!', 'success');
        speakText('Nominee PIN set successfully!');
      } else {
        setPinError(data.error || 'Failed to set nominee PIN.');
      }
    } catch {
      setPinError('Network error setting PIN.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Approve or Deny Request on Website
  const handleDecision = async (approvalId: string, decision: 'approve' | 'deny') => {
    const pin = (itemPins[approvalId] || enteredPin || '').trim();
    if (!pin || pin.length !== 4) {
      setItemFeedback(prev => ({
        ...prev,
        [approvalId]: { type: 'error', message: '4-digit Nominee PIN required' }
      }));
      return;
    }

    if (!nomineeToken) {
      setItemFeedback(prev => ({
        ...prev,
        [approvalId]: { type: 'error', message: 'Nominee authorization token required' }
      }));
      return;
    }

    setIsDeciding(prev => ({ ...prev, [approvalId]: true }));
    try {
      const res = await fetch(getApiUrl(`/api/nominee/approvals/${approvalId}/decision`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${nomineeToken}`
        },
        body: JSON.stringify({ decision, pin })
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 200 && data.success) {
        const succMsg = decision === 'approve' ? 'Order approved successfully!' : 'Order denied successfully.';
        setItemFeedback(prev => ({
          ...prev,
          [approvalId]: { type: 'success', message: succMsg }
        }));
        showToast(succMsg, 'success');
        setItemPins(prev => ({ ...prev, [approvalId]: '' }));
        await fetchApprovals(nomineeToken);
      } else if (res.status === 409) {
        setItemFeedback(prev => ({
          ...prev,
          [approvalId]: { type: 'error', message: 'Request already decided' }
        }));
        await fetchApprovals(nomineeToken);
      } else if (res.status === 400) {
        const isExpired = (data.error || '').toLowerCase().includes('expired');
        setItemFeedback(prev => ({
          ...prev,
          [approvalId]: { type: 'error', message: isExpired ? 'Approval request has expired' : data.error || 'Wrong PIN' }
        }));
        await fetchApprovals(nomineeToken);
      } else if (res.status === 429) {
        setItemFeedback(prev => ({
          ...prev,
          [approvalId]: { type: 'error', message: 'PIN locked after 3 failed attempts' }
        }));
      } else {
        setItemFeedback(prev => ({
          ...prev,
          [approvalId]: { type: 'error', message: data.error || 'Decision failed' }
        }));
      }
    } catch {
      setItemFeedback(prev => ({
        ...prev,
        [approvalId]: { type: 'error', message: 'Network error submitting decision' }
      }));
    } finally {
      setIsDeciding(prev => ({ ...prev, [approvalId]: false }));
    }
  };

  // Add / Remove Restricted Food Items
  const handleAddRestrictedItem = async () => {
    if (!selectedFoodToAdd || !nomineeToken) return;
    const foodObj = INDIAN_FOOD_CATALOG.find(f => f.id === selectedFoodToAdd);
    try {
      const res = await fetch(getApiUrl('/api/nominee/restricted-items'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${nomineeToken}`
        },
        body: JSON.stringify({
          foodItemId: selectedFoodToAdd,
          foodItemName: foodObj?.name || selectedFoodToAdd,
          category: foodObj?.category || 'Food Item'
        })
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.restrictedFoodIds)) {
        setRestrictedFoodIds(data.restrictedFoodIds);
        setSelectedFoodToAdd('');
        showToast(`"${foodObj?.name || selectedFoodToAdd}" added to restricted food list.`, 'success');
      }
    } catch (err) {
      showToast('Failed to add restricted item.', 'error');
    }
  };

  const handleRemoveRestrictedItem = async (foodId: string) => {
    if (!nomineeToken) return;
    try {
      const res = await fetch(getApiUrl(`/api/nominee/restricted-items/${foodId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${nomineeToken}` }
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.restrictedFoodIds)) {
        setRestrictedFoodIds(data.restrictedFoodIds);
        showToast('Item removed from restricted list.', 'success');
      }
    } catch (err) {
      showToast('Failed to remove restricted item.', 'error');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-4 border-amber-500 overflow-hidden">
        
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-6 sm:p-8 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">AutoFeast Nominee Portal</h1>
              <p className="text-xs sm:text-sm text-amber-100 font-semibold">
                Autonomous Food Guard & Diet Restrictions Control
              </p>
            </div>
          </div>

          {nomineeToken && (
            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8">
          {!nomineeToken ? (
            /* ---------- AUTH & FORGOT PASSWORD FLOW ---------- */
            <div className="max-w-md mx-auto space-y-6">
              {screen === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="text-center space-y-1">
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">Nominee Login</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                      Sign in with your nominee credentials to manage orders & food restrictions.
                    </p>
                  </div>

                  {pinError && (
                    <div role="alert" className="p-3 bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 rounded-xl text-xs font-black text-red-700 dark:text-red-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{pinError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                      Nominee Email
                    </label>
                    <input
                      type="email"
                      required
                      autoComplete="username"
                      value={nomineeEmail}
                      onChange={e => setNomineeEmail(e.target.value)}
                      placeholder="nominee@example.com"
                      className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmail(nomineeEmail);
                          setForgotError(null);
                          setForgotMessage(null);
                          setScreen('forgot_email');
                        }}
                        className="text-xs font-black text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <input
                      type="password"
                      required
                      autoComplete="current-password"
                      value={nomineePassword}
                      onChange={e => setNomineePassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-center space-x-2"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <span>Sign In</span>
                    )}
                  </button>
                </form>
              )}

              {/* Forgot Password - Step 1: Email */}
              {screen === 'forgot_email' && (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div className="text-center space-y-1">
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">Forgot Password</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                      Enter your nominee email to receive a 6-digit verification OTP.
                    </p>
                  </div>

                  {forgotError && (
                    <div role="alert" className="p-3 bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 rounded-xl text-xs font-black text-red-700 dark:text-red-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                      Nominee Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      placeholder="nominee@example.com"
                      className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    {isSubmitting ? 'Sending OTP...' : 'Send Reset OTP'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setScreen('login')}
                    className="w-full py-2 text-xs font-black text-slate-600 dark:text-slate-400 hover:underline flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Login</span>
                  </button>
                </form>
              )}

              {/* Forgot Password - Step 2: OTP */}
              {screen === 'forgot_otp' && (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="text-center space-y-1">
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">Enter Verification OTP</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                      A 6-digit OTP was sent to <strong>{forgotEmail}</strong> (valid 10 mins, max 5 attempts).
                    </p>
                  </div>

                  {forgotMessage && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 text-center">
                      {forgotMessage}
                    </div>
                  )}

                  {forgotError && (
                    <div role="alert" className="p-3 bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 rounded-xl text-xs font-black text-red-700 dark:text-red-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1 text-center">
                      6-Digit Security Code
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      inputMode="numeric"
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="••••••"
                      className="w-full text-center tracking-widest text-2xl font-black py-3 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || otp.length < 6}
                    className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    {isSubmitting ? 'Verifying...' : 'Verify OTP'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setScreen('login')}
                    className="w-full py-2 text-xs font-black text-slate-600 dark:text-slate-400 hover:underline flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Cancel and return to login</span>
                  </button>
                </form>
              )}

              {/* Forgot Password - Step 3: New Password */}
              {screen === 'forgot_reset' && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="text-center space-y-1">
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">Create New Password</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                      Choose a secure new password (minimum 8 characters).
                    </p>
                  </div>

                  {forgotError && (
                    <div role="alert" className="p-3 bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 rounded-xl text-xs font-black text-red-700 dark:text-red-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    {isSubmitting ? 'Saving Password...' : 'Confirm & Reset Password'}
                  </button>
                </form>
              )}

              {/* Forgot Password - Step 4: Success */}
              {screen === 'forgot_success' && (
                <div className="text-center space-y-4 py-4">
                  <div className="w-16 h-16 mx-auto bg-emerald-100 dark:bg-emerald-950 text-emerald-600 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">Password Reset Successfully!</h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold">
                    You can now sign in with your new nominee password.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setNomineePassword('');
                      setScreen('login');
                    }}
                    className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-sm rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    Return to Login
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ---------- LOGGED IN NOMINEE CONTROL PANEL ---------- */
            <div className="space-y-8">
              
              {/* Nominee Welcome & PIN Status Bar */}
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-300 dark:border-amber-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Welcome, {nomineeName}</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    PIN Status: {isPinVerified ? '✅ Verified for Session' : '🔒 Verification Required to Modify Rules'}
                  </p>
                </div>

                {!isPinVerified && (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="password"
                      maxLength={4}
                      inputMode="numeric"
                      value={enteredPin}
                      onChange={e => setEnteredPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="4-digit PIN"
                      disabled={Boolean(lockCountdown && lockCountdown > 0)}
                      className="w-28 py-2 px-3 text-center tracking-widest text-sm font-black bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl"
                    />
                    <button
                      type="button"
                      disabled={isSubmitting || Boolean(lockCountdown && lockCountdown > 0)}
                      onClick={() => void handleVerifyPin()}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl cursor-pointer disabled:opacity-50"
                    >
                      Verify
                    </button>
                  </div>
                )}
              </div>

              {pinError && (
                <div role="alert" className="p-3 bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 rounded-xl text-xs font-black text-red-700 dark:text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}

              {/* Set/Update PIN block */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                  Update 4-Digit Security PIN:
                </span>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="password"
                    maxLength={4}
                    inputMode="numeric"
                    value={newNomineePin}
                    onChange={e => setNewNomineePin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="New PIN"
                    className="w-28 py-2 px-3 text-center tracking-widest text-sm font-black bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                  <button
                    type="button"
                    disabled={isSubmitting || newNomineePin.length !== 4}
                    onClick={() => void handleSetNewPin()}
                    className="px-4 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white text-xs font-black rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    Set PIN
                  </button>
                </div>
              </div>

              {/* SECTION 1: PENDING APPROVAL REQUESTS */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-amber-500" />
                    <span>Pending Order Approval Requests ({serverApprovals.filter(r => r.status === 'pending').length})</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => void fetchApprovals(nomineeToken)}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 cursor-pointer"
                    title="Refresh approvals"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {serverApprovals.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 font-bold text-xs">
                    No pending approval requests found.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {serverApprovals.map(req => {
                      const foodObj = req.foodItem || {};
                      const itemName = foodObj.nativeNames?.[language] || foodObj.name || req.foodItemName || req.foodItemId || 'Food Item';
                      const isPending = req.status === 'pending';

                      return (
                        <div
                          key={req.id}
                          className={`p-4 rounded-2xl border-2 flex flex-col gap-3 transition-colors ${
                            isPending
                              ? 'border-amber-400 bg-amber-50/40 dark:bg-amber-950/20'
                              : req.status === 'approved'
                              ? 'border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20'
                              : 'border-red-400 bg-red-50/30 dark:bg-red-950/20'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-slate-900 dark:text-white">{itemName}</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                                  {req.orderType || 'instant'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                                {req.scheduleDetails?.time ? `Scheduled: ${req.scheduleDetails.time}` : 'Instant Order'} • {req.requestedAt ? new Date(req.requestedAt).toLocaleTimeString() : ''}
                              </p>
                            </div>

                            {isPending ? (
                              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                <input
                                  type="password"
                                  inputMode="numeric"
                                  maxLength={4}
                                  placeholder="PIN"
                                  value={itemPins[req.id] !== undefined ? itemPins[req.id] : ''}
                                  onChange={e => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                    setItemPins(prev => ({ ...prev, [req.id]: val }));
                                  }}
                                  className="w-20 py-2 px-2 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-center text-xs font-black tracking-widest text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  disabled={Boolean(isDeciding[req.id])}
                                  onClick={() => void handleDecision(req.id, 'deny')}
                                  className="py-2 px-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-sm flex items-center gap-1 cursor-pointer"
                                >
                                  <XCircle className="w-4 h-4" />
                                  <span>Deny</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={Boolean(isDeciding[req.id])}
                                  onClick={() => void handleDecision(req.id, 'approve')}
                                  className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-sm flex items-center gap-1 cursor-pointer"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>Approve</span>
                                </button>
                              </div>
                            ) : (
                              <span
                                className={`text-xs font-black px-3 py-1 rounded-xl uppercase ${
                                  req.status === 'approved'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {req.status}
                              </span>
                            )}
                          </div>

                          {itemFeedback[req.id] && (
                            <div
                              role="alert"
                              className={`p-2.5 rounded-xl text-xs font-black flex items-center gap-2 ${
                                itemFeedback[req.id].type === 'success'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                                  : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'
                              }`}
                            >
                              {itemFeedback[req.id].type === 'success' ? (
                                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                              ) : (
                                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                              )}
                              <span>{itemFeedback[req.id].message}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION 2: RESTRICTED FOOD ITEMS CATALOG */}
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Restricted Food Items ({restrictedFoodIds.length})
                  </h3>
                  <span className="text-xs text-slate-500 font-semibold">
                    Orders for these items trigger approval requests
                  </span>
                </div>

                {/* Add new restricted item */}
                <div className="flex items-center gap-2">
                  <select
                    value={selectedFoodToAdd}
                    onChange={e => setSelectedFoodToAdd(e.target.value)}
                    className="flex-1 py-2.5 px-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="">-- Select Food Item from Catalog to Restrict --</option>
                    {INDIAN_FOOD_CATALOG.filter(f => !restrictedFoodIds.includes(f.id)).map(f => (
                      <option key={f.id} value={f.id}>
                        {f.name} • {f.nativeNames?.ta || ''} • {f.nativeNames?.hi || ''} ({f.category})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    disabled={!selectedFoodToAdd}
                    onClick={() => void handleAddRestrictedItem()}
                    className="py-2.5 px-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Restrict Item</span>
                  </button>
                </div>

                {/* Currently restricted items list */}
                {restrictedFoodIds.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 font-bold text-xs">
                    No restricted items set. The user can order any item without approval.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {restrictedFoodIds.map(id => {
                      const item = INDIAN_FOOD_CATALOG.find(f => f.id === id);
                      const displayName = item ? item.name : id;
                      const taName = item?.nativeNames?.ta;
                      const hiName = item?.nativeNames?.hi;

                      return (
                        <div
                          key={id}
                          className="p-3 bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-2xl flex items-center justify-between gap-3"
                        >
                          <div className="space-y-0.5">
                            <span className="text-xs font-black text-slate-900 dark:text-white block">
                              {displayName}
                            </span>
                            {(taName || hiName) && (
                              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold block">
                                {taName} • {hiName}
                              </span>
                            )}
                            {item && (
                              <span className="text-[10px] text-slate-500 font-semibold block">
                                {item.category} • ₹{item.basePrice}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => void handleRemoveRestrictedItem(id)}
                            className="p-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 rounded-xl cursor-pointer transition-colors"
                            title="Remove restriction"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
};
