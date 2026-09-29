import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { SpeechService } from '../services/speechService';
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
    language
  } = useApp();

  const [renewalMethod, setRenewalMethod] = useState<'pin' | 'faceid' | 'nominee' | 'password'>('pin');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [nomineeNotificationSent, setNomineeNotificationSent] = useState(false);

  // PIN Form & Keypad State
  const [pinDigits, setPinDigits] = useState('');
  const [isListeningPin, setIsListeningPin] = useState(false);

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
      setIsListeningPin(false);
      SpeechService.stopListening();
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
      setIsListeningPin(false);
      SpeechService.stopListening();

      const promptMsg = language === 'ta'
        ? 'தினசரி ஆர்டர் வரம்பு முடிந்தது. உங்கள் 4-இலக்க PIN-ஐ சொல்லவும் அல்லது உள்ளிடவும்.'
        : language === 'hi'
        ? 'दैनिक ऑर्डर सीमा समाप्त हो गई है। कृपया अपना 4-अंकीय पिन बोलें या दर्ज करें।'
        : 'Daily limit reached. Please say or type your 4-digit PIN to reset limit.';

      console.log('[Limit Renewal Modal]: Auto-prompting aloud & opening voice listener...');

      speakText(promptMsg, () => {
        if (isOpen && renewalMethod === 'pin') {
          startVoicePinListeningForLimit();
        }
      }, language);
    } else if (!isOpen) {
      SpeechService.stopListening();
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
  const handlePINSubmit = (pinToVerify: string) => {
    if (!pinToVerify || pinToVerify.length !== 4) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const result = renewLimitWithPIN(pinToVerify);
    setIsProcessing(false);

    if (result.success) {
      const msg = language === 'ta'
        ? `தினசரி ஆர்டர் வரம்பு 0/6 ஆக வெற்றிகரமாக மீட்டமைக்கப்பட்டது!`
        : language === 'hi'
        ? `दैनिक ऑर्डर सीमा सफलतापूर्वक 0/6 पर रीसेट हो गई!`
        : `Daily order limit successfully reset to 0/6 for ${currentUser?.name || 'User'}!`;

      setSuccessMessage(msg);
      speakText(msg);
      showToast(msg);

      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      setPinDigits('');
      const newFailCount = failedAttempts + 1;
      setFailedAttempts(newFailCount);

      if (newFailCount >= 3) {
        // Trigger Nominee Fallback after 3 failed attempts
        triggerNomineeNotification('Maximum PIN attempts reached.');
      } else {
        const failMsg = language === 'ta'
          ? `தவறான PIN (${newFailCount}/3 முயற்சிகள்). மீண்டும் முயற்சிக்கவும்.`
          : language === 'hi'
          ? `गलत पिन (${newFailCount}/3 प्रयास)। कृपया पुनः प्रयास करें।`
          : `Incorrect PIN (${newFailCount}/3 attempts). Please try again.`;

        setErrorMessage(failMsg);

        // Auto-restart voice listening after speaking incorrect PIN retry prompt
        speakText(failMsg, () => {
          if (isOpen && renewalMethod === 'pin') {
            startVoicePinListeningForLimit();
          }
        }, language);
      }
    }
  };

  /**
   * Listen for Spoken PIN digits using shared SpeechService.extractFourDigits
   */
  const startVoicePinListeningForLimit = () => {
    if (!SpeechService.isSupported() || !isOpen) return;

    setIsListeningPin(true);
    setErrorMessage(null);

    SpeechService.startListening({
      language,
      continuous: false,
      interimResults: true,
      onResult: (text, isFinal, nBestTranscripts) => {
        if (!text || !text.trim()) return;

        const candidates = nBestTranscripts && nBestTranscripts.length > 0 ? nBestTranscripts : [text];
        let digits: string[] | null = null;
        for (const cand of candidates) {
          digits = SpeechService.extractFourDigits(cand);
          if (digits && digits.length === 4) break;
        }
        if (digits && digits.length === 4) {
          console.log('[Limit Renewal Voice Success]: Extracted 4-digit PIN:', digits);
          SpeechService.stopListening();
          setIsListeningPin(false);
          const fourStr = digits.join('');
          setPinDigits(fourStr);
          handlePINSubmit(fourStr);
        } else if (isFinal) {
          console.warn('[Limit Renewal Voice Failed]: Could not extract 4 digits:', text);
          SpeechService.stopListening();
          setIsListeningPin(false);
          const failStr = language === 'ta'
            ? '4 இலக்கங்கள் கண்டறியப்படவில்லை. மீண்டும் பேசுங்கள்.'
            : language === 'hi'
            ? '4 अंक नहीं मिले। कृपया पुनः स्पष्ट बोलें।'
            : 'Could not detect 4 digits by voice. Please speak clearly or type using keypad.';
          setErrorMessage(failStr);

          // Auto-restart listening after retry prompt completes
          speakText(failStr, () => {
            if (isOpen && renewalMethod === 'pin') {
              startVoicePinListeningForLimit();
            }
          }, language);
        }
      },
      onError: (err) => {
        console.warn('[Voice PIN Error]:', err);
        setIsListeningPin(false);
      },
      onEnd: () => {
        setIsListeningPin(false);
      }
    });
  };

  const toggleVoicePinListening = () => {
    if (isListeningPin) {
      SpeechService.stopListening();
      setIsListeningPin(false);
      return;
    }

    const promptMsg = language === 'ta'
      ? 'உங்கள் 4 இலக்க பின்னை கூறுக'
      : language === 'hi'
      ? 'अपना 4 अंकों का पिन बोलें'
      : 'Please speak your 4-digit PIN numbers out loud.';

    speakText(promptMsg, () => {
      startVoicePinListeningForLimit();
    }, language);
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
      <div className="relative w-full max-w-lg bg-white text-[#1A1110] border-2 border-[#DAF0F7] rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] overflow-y-auto">

        {/* Modal Header */}
        <div className="bg-[#DAF0F7] p-6 text-[#1A1110] text-center relative border-b border-[#B2E2F0]">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-white/80 hover:bg-white rounded-full text-[#1A1110] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center justify-center p-3 bg-white rounded-2xl mb-3 shadow-sm border border-[#B2E2F0]">
            <ShieldAlert className="w-8 h-8 text-[#C2185B] animate-pulse" />
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-[#C2185B]">{t('limit.title')}</h2>
          <p className="text-xs text-[#4A5568] mt-1 max-w-md mx-auto leading-relaxed font-bold">
            Verify 4-digit PIN (Typed/Spoken), Face ID, or Nominee Fallback to reset daily limit to 0/6.
          </p>
        </div>

        {/* Method Selector Tabs */}
        <div className="grid grid-cols-4 border-b border-[#DAF0F7] bg-[#DAF0F7]/40 p-2 gap-1.5 text-center">
          <button
            onClick={() => setRenewalMethod('pin')}
            className={`py-2.5 px-1 rounded-xl text-xs font-black flex items-center justify-center space-x-1 transition-all cursor-pointer ${
              renewalMethod === 'pin'
                ? 'bg-[#FF5A1F] text-white shadow-md'
                : 'text-[#4A5568] hover:text-[#1A1110] hover:bg-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>PIN</span>
          </button>

          <button
            onClick={() => setRenewalMethod('faceid')}
            className={`py-2.5 px-1 rounded-xl text-xs font-black flex items-center justify-center space-x-1 transition-all cursor-pointer ${
              renewalMethod === 'faceid'
                ? 'bg-[#FF5A1F] text-white shadow-md'
                : 'text-[#4A5568] hover:text-[#1A1110] hover:bg-white'
            }`}
          >
            <Scan className="w-3.5 h-3.5" />
            <span>Face ID</span>
          </button>

          <button
            onClick={() => setRenewalMethod('nominee')}
            className={`py-2.5 px-1 rounded-xl text-xs font-black flex items-center justify-center space-x-1 transition-all cursor-pointer ${
              renewalMethod === 'nominee'
                ? 'bg-[#FF5A1F] text-white shadow-md'
                : 'text-[#4A5568] hover:text-[#1A1110] hover:bg-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Nominee</span>
          </button>

          <button
            onClick={() => setRenewalMethod('password')}
            className={`py-2.5 px-1 rounded-xl text-xs font-black flex items-center justify-center space-x-1 transition-all cursor-pointer ${
              renewalMethod === 'password'
                ? 'bg-[#FF5A1F] text-white shadow-md'
                : 'text-[#4A5568] hover:text-[#1A1110] hover:bg-white'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Pass</span>
          </button>
        </div>

        {/* Status Alerts */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-4 bg-[#C2185B]/10 border border-[#C2185B] rounded-2xl flex items-start space-x-3 text-[#C2185B] text-xs sm:text-sm">
            <AlertCircle className="w-5 h-5 text-[#C2185B] shrink-0 mt-0.5" />
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

        {/* Method 1: 4-Digit PIN Renewal (Typed / Spoken) */}
        {renewalMethod === 'pin' && (
          <div className="p-6 space-y-5 text-center">
            <div>
              <h3 className="text-base font-black text-[#1A1110]">Enter or Speak Your 4-Digit PIN</h3>
              <p className="text-xs text-[#4A5568] mt-1 font-semibold">
                Type or speak your 4-digit PIN to reset daily order limit to 0/6
              </p>
            </div>

            {/* 4 Large PIN Digits Display */}
            <div className="flex justify-center items-center space-x-3 my-2">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className={`w-12 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl font-black transition-all ${
                    pinDigits[index]
                      ? 'border-[#FF5A1F] bg-[#FF5A1F]/10 text-[#FF5A1F] scale-105 shadow-md'
                      : 'border-[#B2E2F0] bg-slate-50 text-slate-300'
                  }`}
                >
                  {pinDigits[index] ? '●' : ''}
                </div>
              ))}
            </div>

            {/* Voice PIN Button */}
            <button
              type="button"
              onClick={toggleVoicePinListening}
              className={`w-full py-3 px-4 rounded-2xl text-xs font-black flex items-center justify-center space-x-2 transition-all cursor-pointer border ${
                isListeningPin
                  ? 'bg-[#C2185B] text-white animate-pulse border-[#C2185B]'
                  : 'bg-[#FF5A1F] hover:bg-[#E04812] text-white shadow-sm'
              }`}
            >
              {isListeningPin ? <MicOff className="w-4 h-4 text-white animate-bounce" /> : <Mic className="w-4 h-4 text-white" />}
              <span>{isListeningPin ? 'Listening for PIN digits...' : '🎙️ Speak PIN Digits Out Loud (EN / TA / HI)'}</span>
            </button>

            {/* Touch Keypad Grid */}
            <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto pt-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeyClick(num)}
                  disabled={isProcessing}
                  className="py-3 bg-slate-50 hover:bg-[#DAF0F7] text-[#1A1110] font-black rounded-2xl text-lg shadow-sm border border-[#B2E2F0] transition-transform active:scale-95 cursor-pointer"
                >
                  {num}
                </button>
              ))}

              <button
                type="button"
                onClick={handleClear}
                disabled={isProcessing}
                className="py-3 bg-slate-100 hover:bg-slate-200 text-[#4A5568] font-bold rounded-2xl text-xs shadow-sm flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
              >
                Clear
              </button>

              <button
                type="button"
                onClick={() => handleKeyClick('0')}
                disabled={isProcessing}
                className="py-3 bg-slate-50 hover:bg-[#DAF0F7] text-[#1A1110] font-black rounded-2xl text-lg shadow-sm border border-[#B2E2F0] transition-transform active:scale-95 cursor-pointer"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleBackspace}
                disabled={isProcessing}
                className="py-3 bg-slate-100 hover:bg-slate-200 text-[#C2185B] font-bold rounded-2xl text-xs shadow-sm flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Direct Reset Limit Button */}
            <button
              onClick={() => handlePINSubmit(pinDigits)}
              disabled={isProcessing || pinDigits.length !== 4}
              className="w-full py-4 px-6 bg-[#FF5A1F] hover:bg-[#E04812] disabled:opacity-50 text-white font-black rounded-2xl shadow-xl flex items-center justify-center space-x-2 text-sm transition-all cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Verifying PIN...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5 text-white" />
                  <span>Verify PIN & Reset Daily Limit</span>
                </>
              )}
            </button>

            {/* Forgot PIN / Nominee Notification Fallback Trigger */}
            <div className="pt-2 border-t border-[#DAF0F7]">
              <button
                type="button"
                onClick={() => triggerNomineeNotification('User requested Nominee approval')}
                className="text-xs text-[#C2185B] hover:underline font-extrabold flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-[#C2185B]" />
                <span>Forgot PIN? Send Notification Alert to Nominee to Approve</span>
              </button>
            </div>

          </div>
        )}

        {/* Method 2: Face ID Renewal */}
        {renewalMethod === 'faceid' && (
          <div className="p-6 sm:p-8 text-center space-y-6">
            <div className="relative inline-flex items-center justify-center p-6 bg-[#DAF0F7] rounded-full border-4 border-[#FF5A1F] shadow-lg">
              <Scan className="w-16 h-16 text-[#FF5A1F]" />
            </div>

            <div>
              <h3 className="text-base font-black text-[#1A1110]">{t('limit.renewFaceID')}</h3>
              <p className="text-xs text-[#4A5568] mt-1">
                Authenticates via WebAuthn platform biometric hardware (Face ID / Windows Hello).
              </p>
            </div>

            <button
              onClick={handleRenewWithFaceID}
              disabled={isProcessing}
              className="w-full py-4 px-6 bg-[#FF5A1F] hover:bg-[#E04812] disabled:opacity-50 text-white font-black rounded-2xl shadow-xl flex items-center justify-center space-x-3 text-sm transition-all cursor-pointer"
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
            <div className="p-4 bg-[#DAF0F7] border-2 border-[#B2E2F0] rounded-2xl space-y-2 text-left">
              <div className="flex items-center space-x-2 text-[#FF5A1F] font-black text-xs uppercase tracking-wider">
                <Mail className="w-4 h-4 text-[#FF5A1F]" />
                <span>Nominee Notification Alert Status</span>
              </div>
              <p className="text-xs font-bold text-[#1A1110]">
                📧 Notification sent to registered nominee: <span className="text-[#FF5A1F] font-black">{nomineeName}</span> ({nomineePhone})
              </p>
              <p className="text-[11px] text-[#4A5568] font-semibold">
                Nominee can verify their details below to approve the daily limit reset from 6/6 to 0/6 on behalf of {currentUser?.name || 'User'}.
              </p>
            </div>

            <div>
              <label className="block text-xs font-black text-[#1A1110] uppercase tracking-wider mb-1 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-[#FF5A1F]" />
                <span>Registered Nominee Name *</span>
              </label>
              <input
                type="text"
                value={nomineeName}
                onChange={e => setNomineeName(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-[#B2E2F0] rounded-2xl text-[#1A1110] font-bold text-sm focus:outline-none focus:border-[#FF5A1F]"
                placeholder="Priya Raja"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-[#1A1110] uppercase tracking-wider mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-[#FF5A1F]" />
                <span>Nominee Phone Number *</span>
              </label>
              <input
                type="text"
                value={nomineePhone}
                onChange={e => setNomineePhone(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-[#B2E2F0] rounded-2xl text-[#1A1110] font-bold text-sm focus:outline-none focus:border-[#FF5A1F]"
                placeholder="+91 98765 43210"
              />
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-4 px-6 bg-[#FF5A1F] hover:bg-[#E04812] disabled:opacity-50 text-white font-black rounded-2xl shadow-xl flex items-center justify-center space-x-2 text-sm transition-all cursor-pointer"
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
              <label className="block text-xs font-black text-[#1A1110] uppercase tracking-wider mb-1">
                Enter Account Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-[#B2E2F0] rounded-2xl text-[#1A1110] text-sm focus:outline-none focus:border-[#FF5A1F]"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-4 px-6 bg-[#FF5A1F] hover:bg-[#E04812] disabled:opacity-50 text-white font-black rounded-2xl shadow-xl flex items-center justify-center space-x-2 text-sm transition-all cursor-pointer"
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
