import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { SpeechController } from '../services/speechController';
import { SecurityPinEntryView } from './SecurityPinEntryView';
import {
  ShieldAlert,
  Scan,
  UserCheck,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  ShieldCheck,
  Lock,
  Mic,
  MicOff,
  Delete,
  Mail,
  Send,
  Phone
} from 'lucide-react';

interface DailyLimitRenewalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DailyLimitRenewalModal: React.FC<DailyLimitRenewalModalProps> = ({ isOpen, onClose }) => {
  const {
    t,
    speakText,
    showToast,
    currentUser,
    renewLimitWithPIN,
    renewLimitWithFaceID,
    renewLimitWithNominee,
    renewLimitWithPassword,
    language,
    dailyOrderCount
  } = useApp();

  const [renewalMethod, setRenewalMethod] = useState<'pin' | 'faceid' | 'nominee' | 'password'>('pin');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [nomineeNotificationSent, setNomineeNotificationSent] = useState(false);
  const attemptIdRef = useRef(0);
  const lastSpokenAttemptIdRef = useRef(0);

  // PIN Form & Keypad State
  const [pinDigits, setPinDigits] = useState('');

  // Nominee Form State
  const [nomineeName, setNomineeName] = useState(currentUser?.nomineeName || 'Priya Raja');
  const [nomineePhone, setNomineePhone] = useState(currentUser?.nomineePhone || '+91 98765 43210');

  // Password Form State
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setPinDigits('');
      setErrorMessage(null);
      setSuccessMessage(null);
      setFailedAttempts(0);
      setNomineeNotificationSent(false);
    } else {
      if (currentUser) {
        setNomineeName(currentUser.nomineeName || 'Priya Raja');
        setNomineePhone(currentUser.nomineePhone || '+91 98765 43210');
      }
      setPinDigits('');
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen, currentUser]);

  /**
   * Auto-speak prompt & auto-start voice listening when PIN renewal tab is active
   */
  useEffect(() => {
    if (isOpen && renewalMethod === 'pin') {
      setPinDigits('');
      setErrorMessage(null);
      setSuccessMessage(null);
      SpeechController.cancelSpeech();
    } else if (!isOpen) {
      SpeechController.cancelSpeech();
    }
  }, [isOpen, renewalMethod]);

  if (!isOpen) return null;

  /**
   * Trigger Nominee Notification Alert (Fallback when PIN fails or forgotten)
   */
  const triggerNomineeNotification = (customReason?: string) => {
    setNomineeNotificationSent(true);
    setRenewalMethod('nominee');

    const alertMsg = language === 'ta'
      ? `பின்கோடு சரிபார்ப்புத் தோல்வி. உங்கள் பரிந்துரைக்கப்பட்டவர் ${nomineeName} அவர்களுக்கு அறிவிப்பு அனுப்பப்பட்டது!`
      : language === 'hi'
      ? `पिन सत्यापन विफल। आपके नामांकित व्यक्ति ${nomineeName} को सूचना भेजी गई!`
      : `Notification sent to registered nominee ${nomineeName} (${nomineePhone}) to approve daily limit renewal!`;

    setErrorMessage(null);
    setSuccessMessage(alertMsg);
    speakText(alertMsg);
    showToast(alertMsg);
  };

  /**
   * Handle Keypad Input for PIN Renewal
   */
  const handleKeyClick = (num: string) => {
    if (pinDigits.length < 4) {
      const updated = pinDigits + num;
      setPinDigits(updated);
      setErrorMessage(null);

      if (updated.length === 4) {
        handlePINSubmit(updated);
      }
    }
  };

  const handleBackspace = () => {
    setPinDigits(prev => prev.slice(0, -1));
    setErrorMessage(null);
  };

  const handleClear = () => {
    setPinDigits('');
    setErrorMessage(null);
  };

  /**
   * Option 1: 4-Digit PIN Limit Renewal Verification
   */
  const handlePINSubmit = async (pinToVerify: string) => {
    const cleanPin = String(pinToVerify ?? '').trim();
    if (!/^\d{4}$/.test(cleanPin) || isProcessing) return;

    const currentAttemptId = ++attemptIdRef.current;
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const speakOnceForAttempt = (text: string) => {
      if (lastSpokenAttemptIdRef.current === currentAttemptId) return;
      lastSpokenAttemptIdRef.current = currentAttemptId;
      SpeechController.cancelSpeech();
      speakText(text, undefined, language);
    };

    const result = await renewLimitWithPIN(cleanPin);
    setIsProcessing(false);

    if (result.success) {
      setFailedAttempts(0);
      setAttemptsLeft(3);
      const msg = language === 'ta'
        ? `தினசரி ஆர்டர் வரம்பு 0/6 ஆக வெற்றிகரமாக மீட்டமைக்கப்பட்டது!`
        : language === 'hi'
        ? `दैनिक ऑर्डर सीमा सफलतापूर्वक 0/6 पर रीसेट हो गई!`
        : `Daily order limit successfully reset to 0/6 for ${currentUser?.name || 'User'}!`;

      setSuccessMessage(msg);
      speakOnceForAttempt(msg);
      showToast(msg);

      setTimeout(() => {
        onClose();
      }, 1500);
      return;
    }

    setPinDigits('');

    if (result.code === 'PIN_NOT_SET' || result.pinNotSet) {
      const noPinMsg = 'No PIN set. Please set your PIN first';
      setErrorMessage(noPinMsg);
      speakOnceForAttempt(noPinMsg);
      return;
    }

    if (result.serverError) {
      const serverErrMsg = result.error || 'Cannot verify PIN right now, please try again.';
      setErrorMessage(serverErrMsg);
      speakOnceForAttempt(serverErrMsg);
      return;
    }

    const serverAttemptsLeft = typeof result.attemptsLeft === 'number'
      ? result.attemptsLeft
      : Math.max(0, 3 - (failedAttempts + 1));
    const usedAttempts = Math.min(3, Math.max(1, 3 - serverAttemptsLeft));
    setFailedAttempts(usedAttempts);
    setAttemptsLeft(serverAttemptsLeft);

    if (result.isLocked || serverAttemptsLeft <= 0) {
      const lockMsg = language === 'ta'
        ? `தவறான PIN (3/3 முயற்சிகள், 0 முயற்சிகள் மீதமுள்ளன). கணக்கு 15 நிமிடங்களுக்கு முடக்கப்பட்டுள்ளது.`
        : language === 'hi'
        ? `गलत पिन (3/3 प्रयास, 0 प्रयास शेष)। खाता 15 मिनट के लिए लॉक किया गया है।`
        : `Incorrect PIN (3/3 attempts, 0 attempts left). Account locked for 15 minutes.`;
      setErrorMessage(lockMsg);
      speakOnceForAttempt(lockMsg);
    } else {
      const failMsg = language === 'ta'
        ? `தவறான PIN (${usedAttempts}/3 முயற்சிகள், ${serverAttemptsLeft} மீதமுள்ளன). மீண்டும் முயற்சிக்கவும்.`
        : language === 'hi'
        ? `गलत पिन (${usedAttempts}/3 प्रयास, ${serverAttemptsLeft} शेष)। कृपया पुनः प्रयास करें।`
        : `Incorrect PIN (${usedAttempts}/3 attempts, ${serverAttemptsLeft} attempts left). Please try again.`;

      setErrorMessage(failMsg);
      speakOnceForAttempt(failMsg);
    }
  };


  /**
   * Option 2: Face ID WebAuthn Limit Renewal
   */
  const handleRenewWithFaceID = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const promptMsg = t('auth.promptFaceID');
    speakText(promptMsg);

    try {
      const result = await renewLimitWithFaceID();
      setIsProcessing(false);

      if (result.success) {
        const msg = t('limit.renewedSuccess');
        setSuccessMessage(msg);
        speakText(msg);
        showToast(msg);

        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        const failMsg = result.error || t('limit.renewFailed');
        setErrorMessage(failMsg);
        speakText(failMsg);
      }
    } catch (err: any) {
      setIsProcessing(false);
      const failMsg = err.message || t('limit.renewFailed');
      setErrorMessage(failMsg);
      speakText(failMsg);
    }
  };

  /**
   * Option 3: Nominee-based Limit Renewal Fallback
   */
  const handleNomineeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const result = renewLimitWithNominee(nomineeName, nomineePhone);
    setIsProcessing(false);

    if (result.success) {
      const msg = language === 'ta'
        ? `பரிந்துரைக்கப்பட்டவர் ${nomineeName} உங்கள் தினசரி ஆர்டர் வரம்பை 0/6 ஆக அங்கீகரித்தார்!`
        : language === 'hi'
        ? `नामांकित व्यक्ति ${nomineeName} ने आपकी दैनिक सीमा 0/6 रीसेट करने की स्वीकृति दी!`
        : `Nominee ${nomineeName} successfully approved daily order limit renewal to 0/6!`;

      setSuccessMessage(msg);
      speakText(msg);
      showToast(msg);

      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      const failMsg = result.error || 'Nominee details did not match registered nominee profile.';
      setErrorMessage(failMsg);
      speakText(failMsg);
    }
  };

  /**
   * Option 4: Password Security Renewal Fallback
   */
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const result = renewLimitWithPassword(password);
    setIsProcessing(false);

    if (result.success) {
      const msg = t('limit.renewedSuccess');
      setSuccessMessage(msg);
      speakText(msg);
      showToast(msg);

      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      const failMsg = result.error || 'Password verification failed.';
      setErrorMessage(failMsg);
      speakText(failMsg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-white text-[#302720] border-2 border-[#F3EDE4] rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] overflow-y-auto">

        {/* Modal Header */}
        <div className="bg-[#F3EDE4] p-6 text-[#302720] text-center relative border-b border-[#E5DDD2]">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-white/80 hover:bg-white rounded-full text-[#302720] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center justify-center p-3 bg-white rounded-2xl mb-3 shadow-sm border border-[#E5DDD2]">
            <ShieldAlert className="w-8 h-8 text-[#B85C38] animate-pulse" />
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-[#B85C38]">{t('limit.title')}</h2>
          <p className="text-xs text-[#786E64] mt-1 max-w-md mx-auto leading-relaxed font-bold">
            Verify 4-digit PIN (Typed/Spoken), Face ID, or Nominee Fallback to reset daily limit to 0/6.
          </p>

          {/* Daily Limit Usage Progress Bar */}
          <div className="mt-4 p-3.5 rounded-xl border border-[#E5DDD2] bg-white text-left space-y-2 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-[#302720]">Daily Orders: {dailyOrderCount} / 6 Used</span>
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                dailyOrderCount >= 6
                  ? 'bg-red-100 text-[#BD5149]'
                  : dailyOrderCount >= 4
                  ? 'bg-amber-100 text-[#C18A42]'
                  : 'bg-[#F3EDE4] text-[#B85C38]'
              }`}>
                {dailyOrderCount >= 6 ? 'Limit Reached' : `${6 - dailyOrderCount} Orders Left`}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  dailyOrderCount >= 6
                    ? 'bg-[#BD5149]'
                    : dailyOrderCount >= 4
                    ? 'bg-[#C18A42]'
                    : 'bg-[#B85C38]'
                }`}
                style={{ width: `${Math.min(100, (dailyOrderCount / 6) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Method Selector Tabs */}
        <div className="grid grid-cols-4 border-b border-[#F3EDE4] bg-[#F3EDE4]/40 p-2 gap-1.5 text-center">
          <button
            onClick={() => setRenewalMethod('pin')}
            className={`py-2.5 px-1 rounded-xl text-xs font-black flex items-center justify-center space-x-1 transition-all cursor-pointer ${
              renewalMethod === 'pin'
                ? 'bg-[#B85C38] text-white shadow-md'
                : 'text-[#4A5568] hover:text-[#302720] hover:bg-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>PIN</span>
          </button>

          <button
            onClick={() => setRenewalMethod('faceid')}
            className={`py-2.5 px-1 rounded-xl text-xs font-black flex items-center justify-center space-x-1 transition-all cursor-pointer ${
              renewalMethod === 'faceid'
                ? 'bg-[#B85C38] text-white shadow-md'
                : 'text-[#4A5568] hover:text-[#302720] hover:bg-white'
            }`}
          >
            <Scan className="w-3.5 h-3.5" />
            <span>Face ID</span>
          </button>

          <button
            onClick={() => setRenewalMethod('nominee')}
            className={`py-2.5 px-1 rounded-xl text-xs font-black flex items-center justify-center space-x-1 transition-all cursor-pointer ${
              renewalMethod === 'nominee'
                ? 'bg-[#B85C38] text-white shadow-md'
                : 'text-[#4A5568] hover:text-[#302720] hover:bg-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Nominee</span>
          </button>

          <button
            onClick={() => setRenewalMethod('password')}
            className={`py-2.5 px-1 rounded-xl text-xs font-black flex items-center justify-center space-x-1 transition-all cursor-pointer ${
              renewalMethod === 'password'
                ? 'bg-[#B85C38] text-white shadow-md'
                : 'text-[#4A5568] hover:text-[#302720] hover:bg-white'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Pass</span>
          </button>
        </div>

        {/* Status Alerts (when not already shown inside SecurityPinEntryView) */}
        {errorMessage && renewalMethod !== 'pin' && (
          <div className="mx-6 mt-4 p-4 bg-[#B85C38]/10 border border-[#B85C38] rounded-2xl flex items-start space-x-3 text-[#B85C38] text-xs sm:text-sm">
            <AlertCircle className="w-5 h-5 text-[#B85C38] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">{errorMessage}</p>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mx-6 mt-4 p-4 bg-[#16A34A]/10 border border-[#16A34A] rounded-2xl flex items-center space-x-3 text-[#16A34A] text-xs sm:text-sm">
            <CheckCircle2 className="w-5 h-5 text-[#16A34A] shrink-0" />
            <p className="font-bold">{successMessage}</p>
          </div>
        )}

        {/* Method 1: 4-Digit PIN Renewal (Shared SecurityPinEntryView) */}
        {renewalMethod === 'pin' && (
          <div className="p-6">
            <SecurityPinEntryView
              title="Daily Limit Renewal PIN"
              subtitle="Enter or speak your 4-digit PIN to reset daily limit to 0/6"
              onPinComplete={(pinStr) => handlePINSubmit(pinStr)}
              isVerifying={isProcessing}
              errorMessage={errorMessage}
              setErrorMessage={setErrorMessage}
              submitButtonText="Verify PIN & Reset Daily Limit"
            />

            {/* Forgot PIN / Nominee Notification Fallback Trigger */}
            <div className="pt-4 border-t border-[#F3EDE4] mt-4">
              <button
                type="button"
                onClick={() => triggerNomineeNotification('User requested Nominee approval')}
                className="text-xs text-[#B85C38] hover:underline font-extrabold flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-[#B85C38]" />
                <span>Forgot PIN? Send Notification Alert to Nominee to Approve</span>
              </button>
            </div>
          </div>
        )}

        {/* Method 2: Face ID Renewal */}
        {renewalMethod === 'faceid' && (
          <div className="p-6 sm:p-8 text-center space-y-6">
            <div className="relative inline-flex items-center justify-center p-6 bg-[#F3EDE4] rounded-full border-4 border-[#B85C38] shadow-lg">
              <Scan className="w-16 h-16 text-[#B85C38]" />
            </div>

            <div>
              <h3 className="text-base font-black text-[#302720]">{t('limit.renewFaceID')}</h3>
              <p className="text-xs text-[#4A5568] mt-1">
                Authenticates via WebAuthn platform biometric hardware (Face ID / Windows Hello).
              </p>
            </div>

            <button
              onClick={handleRenewWithFaceID}
              disabled={isProcessing}
              className="w-full py-4 px-6 bg-[#B85C38] hover:bg-[#302720] disabled:opacity-50 text-white font-black rounded-2xl shadow-xl flex items-center justify-center space-x-3 text-sm transition-all cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Verifying Face ID...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5 text-white" />
                  <span>Verify Face ID & Reset Limit to 0/6</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Method 3: Nominee Notification & Approval Fallback */}
        {renewalMethod === 'nominee' && (
          <form onSubmit={handleNomineeSubmit} className="p-6 sm:p-8 space-y-4">
            
            {/* Nominee Alert Card */}
            <div className="p-4 bg-[#F3EDE4] border-2 border-[#E5DDD2] rounded-2xl space-y-2 text-left">
              <div className="flex items-center space-x-2 text-[#B85C38] font-black text-xs uppercase tracking-wider">
                <Mail className="w-4 h-4 text-[#B85C38]" />
                <span>Nominee Notification Alert Status</span>
              </div>
              <p className="text-xs font-bold text-[#302720]">
                📧 Notification sent to registered nominee: <span className="text-[#B85C38] font-black">{nomineeName}</span> ({nomineePhone})
              </p>
              <p className="text-[11px] text-[#4A5568] font-semibold">
                Nominee can verify their details below to approve the daily limit reset from 6/6 to 0/6 on behalf of {currentUser?.name || 'User'}.
              </p>
            </div>

            <div>
              <label className="block text-xs font-black text-[#302720] uppercase tracking-wider mb-1 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-[#B85C38]" />
                <span>Registered Nominee Name *</span>
              </label>
              <input
                type="text"
                value={nomineeName}
                onChange={e => setNomineeName(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-[#E5DDD2] rounded-2xl text-[#302720] font-bold text-sm focus:outline-none focus:border-[#B85C38]"
                placeholder="Priya Raja"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-[#302720] uppercase tracking-wider mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-[#B85C38]" />
                <span>Nominee Phone Number *</span>
              </label>
              <input
                type="text"
                value={nomineePhone}
                onChange={e => setNomineePhone(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-[#E5DDD2] rounded-2xl text-[#302720] font-bold text-sm focus:outline-none focus:border-[#B85C38]"
                placeholder="+91 98765 43210"
              />
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-4 px-6 bg-[#B85C38] hover:bg-[#302720] disabled:opacity-50 text-white font-black rounded-2xl shadow-xl flex items-center justify-center space-x-2 text-sm transition-all cursor-pointer"
            >
              <UserCheck className="w-5 h-5 text-white" />
              <span>Approve Renewal as Nominee</span>
            </button>
          </form>
        )}

        {/* Method 4: Password Fallback Renewal */}
        {renewalMethod === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="p-6 sm:p-8 space-y-4">
            <div>
              <label className="block text-xs font-black text-[#302720] uppercase tracking-wider mb-1">
                Enter Account Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-[#E5DDD2] rounded-2xl text-[#302720] text-sm focus:outline-none focus:border-[#B85C38]"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-4 px-6 bg-[#B85C38] hover:bg-[#302720] disabled:opacity-50 text-white font-black rounded-2xl shadow-xl flex items-center justify-center space-x-2 text-sm transition-all cursor-pointer"
            >
              <KeyRound className="w-5 h-5 text-white" />
              <span>Verify Password & Reset Limit</span>
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
