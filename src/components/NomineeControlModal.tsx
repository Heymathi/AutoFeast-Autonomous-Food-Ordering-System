import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, Lock, CheckCircle2, XCircle, AlertCircle, Plus, Trash2, Mail, ShieldAlert, KeyRound, Clock, Mic } from 'lucide-react';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { FoodItem } from '../types';
import { AuthService } from '../services/authService';
import { NomineeNotificationService } from '../services/nomineeNotificationService';
import { VoicePinInput } from './VoicePinInput';
import { SpeechController } from '../services/speechController';
import { VoiceIntentRouter } from '../services/voiceIntentRouter';

interface NomineeControlModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NomineeControlModal: React.FC<NomineeControlModalProps> = ({ isOpen, onClose }) => {
  const {
    currentUser,
    updateUserProfile,
    pendingNomineeApprovals,
    approveNomineeRequest,
    denyNomineeRequest,
    t,
    language,
    showToast,
    speakText
  } = useApp();

  const [enteredPin, setEnteredPin] = useState('');
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [newNomineePin, setNewNomineePin] = useState('');
  const [nomineeEmail, setNomineeEmail] = useState(currentUser?.nomineeEmail || '');
  const [nomineePassword, setNomineePassword] = useState('');
  const [nomineeToken, setNomineeToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockCountdown, setLockCountdown] = useState<number | null>(null);
  const [pinPromptKey, setPinPromptKey] = useState(0);

  const [selectedFoodToAdd, setSelectedFoodToAdd] = useState('');
  const [serverApprovals, setServerApprovals] = useState<any[]>([]);
  const [itemPins, setItemPins] = useState<Record<string, string>>({});
  const [itemFeedback, setItemFeedback] = useState<Record<string, { type: 'success' | 'error'; message: string }>>({});
  const [isDeciding, setIsDeciding] = useState<Record<string, boolean>>({});
  const [isVoiceApproving, setIsVoiceApproving] = useState(false);

  const isNomineeRoute =
    typeof window !== 'undefined' &&
    (window.location.pathname === '/nominee' || window.location.pathname === '/nominee/');
  const isSetupRoute =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/nominee/setup');
  const isModalVisible = isOpen || (isNomineeRoute && !isSetupRoute);

  const getApiUrl = (path: string) => {
    if (typeof window !== 'undefined' && window.location?.origin && window.location.origin.startsWith('http')) {
      if (typeof navigator !== 'undefined' && navigator.userAgent?.includes('jsdom')) {
        return `${window.location.origin}${path}`;
      }
      return path;
    }
    return `http://localhost:5000${path}`;
  };

  const fetchApprovals = async (token?: string | null) => {
    const tkn = token || nomineeToken;
    if (!tkn) return;
    try {
      const res = await fetch(getApiUrl('/api/nominee/approvals'), {
        headers: { 'Authorization': `Bearer ${tkn}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.approvals)) {
          setServerApprovals(data.approvals);
        }
      }
    } catch (err) {
      console.warn('[NomineeControlModal] Failed to fetch approvals:', err);
    }
  };

  useEffect(() => {
    if (nomineeToken) {
      void fetchApprovals(nomineeToken);
    }
  }, [nomineeToken]);

  useEffect(() => {
    if (!isModalVisible) {
      setNomineeToken(null);
      setNomineePassword('');
      setEnteredPin('');
      setNewNomineePin('');
      setIsPinVerified(false);
      setPinError(null);
      setLockCountdown(null);
      setPinPromptKey(0);
      setNomineeEmail(currentUser?.nomineeEmail || '');
      setItemPins({});
      setItemFeedback({});
      setServerApprovals([]);
    }
  }, [isModalVisible, currentUser]);

  useEffect(() => {
    let timer: any;
    if (lockCountdown !== null && lockCountdown > 0) {
      timer = setInterval(() => {
        setLockCountdown(prev => (prev && prev > 1 ? prev - 1 : null));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockCountdown]);

  if (!isModalVisible) return null;

  const nomineeName = currentUser?.nomineeName || 'Emergency Nominee';
  const nomineePhone = currentUser?.nomineePhone || '+91 98765 00000';
  const restrictedIds = currentUser?.restrictedFoodIds || [];

  const getLocalizedAuthError = (status: number) => {
    if (status === 401) return t('nominee.auth401');
    if (status === 403) return t('nominee.auth403');
    if (status === 429) return t('nominee.auth429');
    if (status === 503) return t('nominee.auth503');
    return t('nominee.authError');
  };

  const handleNomineeLogin = async () => {
    if (!nomineeEmail.trim() || !nomineePassword) {
      setPinError(t('nominee.credentialsRequired'));
      return;
    }

    setIsSubmitting(true);
    setPinError(null);
    try {
      const token = await AuthService.loginNominee(nomineeEmail, nomineePassword);
      setNomineeToken(token);
      setNomineePassword('');
    } catch (err) {
      const status = err instanceof Error && 'status' in err && typeof err.status === 'number'
        ? err.status
        : 503;
      setPinError(getLocalizedAuthError(status));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveNomineeCredentials = async () => {
    if (!nomineeEmail.trim() || !nomineePassword) {
      setPinError(t('nominee.credentialsRequired'));
      return;
    }

    setIsSubmitting(true);
    setPinError(null);
    try {
      await AuthService.saveNomineeCredentials(nomineeEmail, nomineePassword);
      const token = await AuthService.loginNominee(nomineeEmail, nomineePassword);
      setNomineeToken(token);
      setNomineePassword('');
      updateUserProfile({ nomineeEmail: nomineeEmail.trim() });
    } catch (err) {
      const status = err instanceof Error && 'status' in err && typeof err.status === 'number'
        ? err.status
        : 503;
      setPinError(getLocalizedAuthError(status));
    } finally {
      setIsSubmitting(false);
    }
  };

  const appendPinDigit = (target: 'verify' | 'change', digit: string) => {
    const setPin = target === 'verify' ? setEnteredPin : setNewNomineePin;
    setPin(previous => previous.length < 4 ? previous + digit : previous);
    setPinError(null);
  };

  const editPin = (target: 'verify' | 'change', action: 'clear' | 'backspace') => {
    const setPin = target === 'verify' ? setEnteredPin : setNewNomineePin;
    setPin(previous => action === 'clear' ? '' : previous.slice(0, -1));
    setPinError(null);
  };

  const handleVerifyPin = async (voicePin?: string) => {
    SpeechController.releaseMic('nominee_verify_pin');
    if (!nomineeToken) {
      setPinError(getLocalizedAuthError(401));
      return;
    }
    if (lockCountdown && lockCountdown > 0) {
      return;
    }
    const pinToVerify = voicePin ?? enteredPin;
    if (!pinToVerify || pinToVerify.length !== 4) {
      setPinError(t('nominee.pinInvalid'));
      return;
    }

    setIsSubmitting(true);
    setPinError(null);
    let res: Awaited<ReturnType<typeof AuthService.verifyNomineePinServer>>;
    try {
      res = await AuthService.verifyNomineePinServer(pinToVerify, nomineeToken);
    } catch {
      setPinError(getLocalizedAuthError(503));
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(false);

    if (res.success) {
      setIsPinVerified(true);
      setPinError(null);
      setLockCountdown(null);
      const successMsg = language === 'ta'
        ? 'பரிந்துரைப்பாளர் PIN சரிபார்க்கப்பட்டது!'
        : language === 'hi'
        ? 'नामांकित पिन सत्यापित!'
        : 'Nominee PIN verified successfully!';
      showToast(successMsg);
      speakText(successMsg);
    } else {
      if (res.status === 401 || res.status === 403 || res.status === 503) {
        setPinError(getLocalizedAuthError(res.status));
      } else if (res.status === 429 || res.locked) {
        setLockCountdown(15 * 60);
        setPinError(getLocalizedAuthError(429));
      } else if (res.status === 409) {
        setPinError(t('nominee.pinNotSet'));
      } else {
        const tries = res.remainingTries !== undefined ? res.remainingTries : 2;
        const err = language === 'ta'
          ? `தவறான Nominee PIN! ${tries} வாய்ப்புகள் மீதம் உள்ளன.`
          : language === 'hi'
          ? `गलत नामांकित पिन! ${tries} प्रयास शेष हैं।`
          : `Incorrect Nominee Security PIN. ${tries} try(ies) remaining.`;
        setPinError(err);
        setPinPromptKey(previous => previous + 1);
        speakText(err);
      }
    }
  };

  const handleSetNewPin = async () => {
    SpeechController.releaseMic('nominee_change_pin');
    if (!nomineeToken) {
      setPinError(getLocalizedAuthError(401));
      return;
    }
    if (newNomineePin.length !== 4 || !/^\d{4}$/.test(newNomineePin)) {
      setPinError(t('nominee.pinInvalid'));
      return;
    }

    setIsSubmitting(true);
    setPinError(null);
    try {
      await AuthService.setNomineePin(newNomineePin, nomineeToken);
      setEnteredPin('');
      setNewNomineePin('');
      showToast(t('nominee.pinSaved'));
      speakText(t('nominee.pinSaved'));
    } catch (err) {
      const status = err instanceof Error && 'status' in err && typeof err.status === 'number'
        ? err.status
        : 503;
      setPinError(status === 400 ? t('nominee.pinCannotMatch') : getLocalizedAuthError(status));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleRestrictedItem = async (foodId: string) => {
    if (!isPinVerified) {
      setPinError(t('nominee.pinPrompt'));
      return;
    }

    const itemObj = INDIAN_FOOD_CATALOG.find(f => f.id === foodId);
    const itemName = itemObj ? (itemObj.nativeNames?.[language] || itemObj.name) : 'Food Item';

    const currentRestricted = currentUser?.restrictedFoodIds || [];
    let updated: string[];
    if (currentRestricted.includes(foodId)) {
      updated = currentRestricted.filter(id => id !== foodId);
    } else {
      updated = [...currentRestricted, foodId];
    }

    updateUserProfile({ restrictedFoodIds: updated });

    if (currentUser?.id) {
      NomineeNotificationService.toggleRestrictedItemServer(
        currentUser.id,
        foodId,
        itemObj?.name || foodId,
        itemObj?.category || 'Food Item'
      );
    }

    const msg = updated.includes(foodId)
      ? (language === 'ta' ? `"${itemName}" தடைப்பட்டியலில் சேர்க்கப்பட்டது.` : `"${itemName}" added to restricted list.`)
      : (language === 'ta' ? `"${itemName}" தடைப்பட்டியலில் இருந்து நீக்கப்பட்டது.` : `"${itemName}" removed from restricted list.`);
    showToast(msg);
  };

  const handleClose = () => {
    if (isNomineeRoute) {
      window.location.href = '/';
    } else {
      onClose();
    }
  };

  const handleDecision = async (approvalId: string, decision: 'approve' | 'deny') => {
    const pin = (itemPins[approvalId] || enteredPin || '').trim();
    if (!pin || pin.length !== 4) {
      setItemFeedback(prev => ({
        ...prev,
        [approvalId]: { type: 'error', message: t('nominee.pinInvalid') || 'Wrong PIN: 4 digits required' }
      }));
      return;
    }

    if (!nomineeToken) {
      setItemFeedback(prev => ({
        ...prev,
        [approvalId]: { type: 'error', message: 'Nominee authorization required' }
      }));
      return;
    }

    setIsDeciding(prev => ({ ...prev, [approvalId]: true }));
    try {
      const res = await fetch(getApiUrl(`/api/nominee/approvals/${approvalId}/decision`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${nomineeToken}`
        },
        body: JSON.stringify({ decision, pin })
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 200 && data.success) {
        const succMsg = decision === 'approve'
          ? (language === 'ta' ? 'ஆர்டர் அங்கீகரிக்கப்பட்டது!' : 'Order approved successfully!')
          : (language === 'ta' ? 'ஆர்டர் நிராகரிக்கப்பட்டது.' : 'Order denied successfully.');
        setItemFeedback(prev => ({
          ...prev,
          [approvalId]: { type: 'success', message: succMsg }
        }));
        showToast(succMsg);
        if (decision === 'approve') approveNomineeRequest(approvalId);
        else denyNomineeRequest(approvalId);
        setItemPins(prev => ({ ...prev, [approvalId]: '' }));
        await fetchApprovals(nomineeToken);
      } else if (res.status === 404) {
        setItemFeedback(prev => ({
          ...prev,
          [approvalId]: { type: 'error', message: 'Request not found' }
        }));
        await fetchApprovals(nomineeToken);
      } else if (res.status === 409) {
        setItemFeedback(prev => ({
          ...prev,
          [approvalId]: { type: 'error', message: 'Already decided' }
        }));
        await fetchApprovals(nomineeToken);
      } else if (res.status === 400) {
        const errStr = (data.error || '').toLowerCase();
        if (errStr.includes('expired')) {
          setItemFeedback(prev => ({
            ...prev,
            [approvalId]: { type: 'error', message: 'Request expired' }
          }));
        } else {
          setItemFeedback(prev => ({
            ...prev,
            [approvalId]: { type: 'error', message: data.error || 'Wrong PIN' }
          }));
        }
        await fetchApprovals(nomineeToken);
      } else if (res.status === 403) {
        setItemFeedback(prev => ({
          ...prev,
          [approvalId]: { type: 'error', message: 'Nominee token required (403)' }
        }));
      } else if (res.status === 429) {
        setItemFeedback(prev => ({
          ...prev,
          [approvalId]: { type: 'error', message: data.error || 'PIN locked after 3 failed attempts' }
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

  const handleApprove = (reqId: string) => {
    void handleDecision(reqId, 'approve');
  };

  const handleDeny = (reqId: string) => {
    void handleDecision(reqId, 'deny');
  };

  const startVoiceApprovalListening = () => {
    SpeechController.markUserGesture();
    if (!SpeechController.isSupported()) return;
    setIsVoiceApproving(true);
    SpeechController.startListening({
      owner: 'nominee_voice_decision',
      language,
      continuous: false,
      interimResults: true,
      maxAlternatives: 5,
      silenceTimeoutMs: 8000,
      onSilence: () => setIsVoiceApproving(false),
      onStart: () => setIsVoiceApproving(true),
      onResult: (transcript, isFinal, nBest) => {
        if (!transcript || !isFinal) return;
        setIsVoiceApproving(false);
        const candidates = nBest && nBest.length > 0 ? nBest : [transcript];
        const activeList = serverApprovals.length > 0 ? serverApprovals : pendingNomineeApprovals;
        const firstPending = activeList.find(r => r.status === 'pending');

        const portalMatch = VoiceIntentRouter.matchNomineePortalIntent(candidates, INDIAN_FOOD_CATALOG, language);
        if (portalMatch.action?.type === 'add_restricted' || portalMatch.action?.type === 'remove_restricted') {
          void handleToggleRestrictedItem(portalMatch.action.item.id);
          return;
        }
        if (portalMatch.action?.type === 'cancel') {
          onClose();
          return;
        }
        if (!firstPending) return;
        const targetId = firstPending.id || firstPending._id || '';

        if (portalMatch.action?.type === 'approve') {
          handleApprove(targetId);
          return;
        }
        if (portalMatch.action?.type === 'deny') {
          handleDeny(targetId);
          return;
        }

        // Check approve
        const isApprove = candidates.some(c => {
          const l = c.toLowerCase();
          return l.includes('approve') || l.includes('approved') || l.includes('ஒப்புதல்') || l.includes('மஞ்சூர்') || l.includes('मंजूर') || l.includes('स्वीकृत');
        });

        // Check reject
        const isDeny = candidates.some(c => {
          const l = c.toLowerCase();
          return l.includes('deny') || l.includes('reject') || l.includes('rejected') || l.includes('மறு') || l.includes('நிராகரி') || l.includes('अस्वीकृत') || l.includes('मना');
        });

        const isCancel = candidates.some(c => {
          const l = c.toLowerCase();
          return l.includes('cancel') || l.includes('close') || l.includes('ரத்து') || l.includes('बंद');
        });

        if (isApprove) {
          handleApprove(targetId);
        } else if (isDeny) {
          handleDeny(targetId);
        } else if (isCancel) {
          onClose();
        }
      },
      onError: () => setIsVoiceApproving(false),
      onEnd: () => setIsVoiceApproving(false)
    });
  };

  const pendingCount = pendingNomineeApprovals.filter(r => r.status === 'pending').length;
  const renderPinKeypad = (target: 'verify' | 'change', disabled = false) => (
    <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto" aria-label={t('nominee.pinKeypad')}>
      {(['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'backspace'] as const).map(key => (
        <button
          key={key}
          type="button"
          aria-label={key === 'clear'
            ? t('nominee.clearPin')
            : key === 'backspace'
            ? t('nominee.backspacePin')
            : `${t('nominee.pinDigit')} ${key}`}
          disabled={disabled}
          onClick={() => key === 'clear' || key === 'backspace'
            ? editPin(target, key)
            : appendPinDigit(target, key)}
          className="py-3 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-lg font-black text-slate-900 dark:text-white disabled:opacity-50"
        >
          {key === 'clear' ? t('nominee.clearPin') : key === 'backspace' ? t('nominee.backspacePin') : key}
        </button>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-3xl p-6 sm:p-8 shadow-2xl border-4 border-amber-500 my-8 space-y-6 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-amber-100 dark:bg-amber-950 text-amber-600 rounded-2xl border border-amber-300">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                {t('nominee.restrictedTitle')}
              </h3>
              <p className="text-xs text-slate-500 font-bold">
                {t('nominee.restrictedSubtitle')} • {nomineeName} ({nomineePhone})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {!nomineeToken ? (
          <form
            onSubmit={event => {
              event.preventDefault();
              void handleNomineeLogin();
            }}
            className="p-6 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 rounded-2xl space-y-4"
          >
            <div className="text-center">
              <h4 className="text-lg font-black text-slate-900 dark:text-white">{t('nominee.loginTitle')}</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-bold mt-1">{t('nominee.loginPrompt')}</p>
            </div>

            {pinError && (
              <div role="alert" className="p-3 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 rounded-xl text-xs font-black flex items-center justify-center space-x-2">
                <AlertCircle className="w-4 h-4" />
                <span>{pinError}</span>
              </div>
            )}

            <label className="block text-left text-xs font-black text-slate-700 dark:text-slate-300">
              {t('nominee.emailLabel')}
              <input
                type="email"
                autoComplete="username"
                required
                value={nomineeEmail}
                onChange={event => setNomineeEmail(event.target.value)}
                className="mt-1 w-full py-3 px-4 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white"
              />
            </label>

            <label className="block text-left text-xs font-black text-slate-700 dark:text-slate-300">
              {t('nominee.loginPasswordLabel')}
              <input
                type="password"
                autoComplete="current-password"
                required
                value={nomineePassword}
                onChange={event => setNomineePassword(event.target.value)}
                className="mt-1 w-full py-3 px-4 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white"
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-6 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-400 text-white font-black text-sm rounded-xl shadow-md"
            >
              {isSubmitting ? t('nominee.loading') : t('nominee.loginBtn')}
            </button>
            {pinError && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleSaveNomineeCredentials()}
                className="w-full py-2 px-4 border-2 border-amber-600 text-amber-800 dark:text-amber-200 font-black text-xs rounded-xl disabled:opacity-50"
              >
                {t('nominee.repairCredentialsBtn')}
              </button>
            )}
          </form>
        ) : !isPinVerified ? (
          <div className="p-6 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 rounded-2xl space-y-4 text-center">
            <div className="inline-flex p-3 bg-amber-200 dark:bg-amber-900 rounded-full text-amber-800 dark:text-amber-200">
              <KeyRound className="w-8 h-8 animate-bounce" />
            </div>

            <div>
              <h4 className="text-lg font-black text-slate-900 dark:text-white">
                {t('nominee.pinTitle')}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-bold mt-1">
                {t('nominee.pinPrompt')}
              </p>
            </div>

            {pinError && (
              <div role="alert" className="p-3 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 rounded-xl text-xs font-black flex items-center justify-center space-x-2">
                <AlertCircle className="w-4 h-4" />
                <span>{pinError}</span>
              </div>
            )}

            <div className="flex flex-col items-center justify-center gap-3 max-w-sm mx-auto">
              <input
                type="password"
                readOnly
                aria-label={t('nominee.pinLabel')}
                maxLength={4}
                disabled={Boolean(lockCountdown && lockCountdown > 0)}
                value={enteredPin}
                placeholder={t('nominee.pinLabel')}
                className="w-full text-center tracking-widest text-xl font-black py-3 px-4 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white disabled:opacity-50"
              />
              <VoicePinInput
                key={pinPromptKey}
                language={language}
                owner="nominee_verify_pin"
                purpose="nominee"
                autoStart
                disabled={Boolean(lockCountdown && lockCountdown > 0) || isSubmitting}
                onPinChange={pin => {
                  setEnteredPin(pin);
                  if (pin.length === 4) {
                    void handleVerifyPin(pin);
                  }
                }}
              />
              {renderPinKeypad('verify', Boolean(lockCountdown && lockCountdown > 0) || isSubmitting)}
              <button
                type="button"
                disabled={Boolean(lockCountdown && lockCountdown > 0) || isSubmitting}
                onClick={() => void handleVerifyPin()}
                className="w-full sm:w-auto py-3 px-6 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-400 text-white font-black text-sm rounded-xl shadow-md cursor-pointer transition-all active:scale-95 whitespace-nowrap flex items-center justify-center space-x-2"
              >
                {lockCountdown && lockCountdown > 0 ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>Locked ({Math.floor(lockCountdown / 60)}m {lockCountdown % 60}s)</span>
                  </>
                ) : (
                  <span>{t('nominee.verifyPinBtn')}</span>
                )}
              </button>
            </div>

            {/* Change/Set Nominee PIN block */}
            <div className="pt-4 border-t border-amber-200 dark:border-amber-900/60 text-left space-y-2">
              <span className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                {t('nominee.changePinPrompt')}
              </span>
              <div className="space-y-3">
                <input
                  type="password"
                  readOnly
                  aria-label={t('nominee.newPinLabel')}
                  maxLength={4}
                  value={newNomineePin}
                  placeholder={t('nominee.newPinLabel')}
                  className="w-full py-2 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white text-center tracking-widest"
                />
                <VoicePinInput
                  language={language}
                  owner="nominee_change_pin"
                  purpose="nominee"
                  disabled={isSubmitting}
                  onPinChange={setNewNomineePin}
                />
                {renderPinKeypad('change', isSubmitting)}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleSetNewPin()}
                  className="py-2 px-3 bg-slate-800 dark:bg-slate-700 text-white text-xs font-black rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {t('nominee.setPinBtn')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">

            {/* PENDING APPROVAL REQUESTS SECTION */}
            <div className="space-y-3">
              <h4 className="text-base font-black text-slate-900 dark:text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-500" />
                  {t('nominee.pendingRequestTitle')}
                </span>
                <div className="flex items-center gap-2">
                  {pendingCount > 0 && (
                    <button
                      type="button"
                      onClick={startVoiceApprovalListening}
                      className={`px-3 py-1 text-xs font-black rounded-xl shadow-sm flex items-center gap-1 cursor-pointer transition-all ${
                        isVoiceApproving
                          ? 'bg-red-600 text-white animate-pulse'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                      title="Speak 'Approve' or 'Reject' by voice"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>{isVoiceApproving ? 'Listening...' : 'Voice Decision'}</span>
                    </button>
                  )}
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-white">
                    {(serverApprovals.length > 0 ? serverApprovals : pendingNomineeApprovals).filter(r => r.status === 'pending').length} Pending
                  </span>
                </div>
              </h4>

              {(serverApprovals.length > 0 ? serverApprovals : pendingNomineeApprovals).length === 0 ? (
                <div className="p-4 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 font-bold text-xs">
                  No pending order approval requests.
                </div>
              ) : (
                <div className="space-y-3">
                  {(serverApprovals.length > 0 ? serverApprovals : pendingNomineeApprovals).map(req => {
                    const foodObj = req.foodItem || {};
                    const itemName = foodObj.nativeNames?.[language] || foodObj.name || req.foodItemName || req.foodItemId || 'Food Item';
                    const orderType = req.orderType || 'instant';
                    const sched = req.scheduleDetails;
                    const reqKey = req.id || req._id || '';
                    return (
                      <div
                        key={req.id}
                        className={`p-4 rounded-2xl border-2 shadow-sm flex flex-col gap-3 ${
                          req.status === 'pending'
                            ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/30'
                            : req.status === 'approved'
                            ? 'border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20'
                            : 'border-red-400 bg-red-50/30 dark:bg-red-950/20'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-black text-slate-900 dark:text-white">{itemName}</span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                                {orderType}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 font-semibold">
                              {sched ? `Slot: ${sched.slotName || ''} at ${sched.time || ''}` : 'Instant Order'} • {req.requestedAt ? new Date(req.requestedAt).toLocaleTimeString() : ''}
                            </p>
                            
                            {/* Email Sent Indicator */}
                            <div className="flex items-center space-x-1 text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                              <Mail className="w-3 h-3" />
                              <span>{t('nominee.emailSentNotice')}</span>
                            </div>
                          </div>

                          {req.status === 'pending' ? (
                            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end flex-wrap gap-y-2">
                              <input
                                type="password"
                                inputMode="numeric"
                                maxLength={4}
                                placeholder="PIN"
                                aria-label={`PIN for ${itemName}`}
                                value={itemPins[reqKey] !== undefined ? itemPins[reqKey] : ''}
                                onChange={e => {
                                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                  setItemPins(prev => ({ ...prev, [reqKey]: val }));
                                }}
                                className="w-20 py-2 px-2 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-center text-xs font-black tracking-widest text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none"
                              />
                              <button
                                type="button"
                                disabled={Boolean(isDeciding[reqKey])}
                                onClick={() => void handleDecision(reqKey, 'deny')}
                                className="py-2 px-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-sm flex items-center space-x-1 cursor-pointer"
                              >
                                <XCircle className="w-4 h-4" />
                                <span>{t('nominee.denyBtn') || 'Deny'}</span>
                              </button>

                              <button
                                type="button"
                                disabled={Boolean(isDeciding[reqKey])}
                                onClick={() => void handleDecision(reqKey, 'approve')}
                                className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-sm flex items-center space-x-1 cursor-pointer"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>{t('nominee.approveBtn') || 'Approve'}</span>
                              </button>
                            </div>
                          ) : (
                            <span className={`text-xs font-black px-3 py-1 rounded-xl uppercase ${
                              req.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {req.status}
                            </span>
                          )}
                        </div>

                        {itemFeedback[reqKey] && (
                          <div
                            role="alert"
                            className={`p-2.5 rounded-xl text-xs font-black flex items-center gap-2 ${
                              itemFeedback[reqKey].type === 'success'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'
                            }`}
                          >
                            {itemFeedback[reqKey].type === 'success' ? (
                              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                            ) : (
                              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                            )}
                            <span>{itemFeedback[reqKey].message}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RESTRICTED ITEMS LIST MANAGEMENT */}
            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <h4 className="text-base font-black text-slate-900 dark:text-white flex items-center justify-between">
                <span>Restricted Food Items Catalog ({restrictedIds.length})</span>
              </h4>

              {/* Add item dropdown */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedFoodToAdd}
                  onChange={(e) => setSelectedFoodToAdd(e.target.value)}
                  className="flex-1 py-2.5 px-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                >
                  <option value="">-- Select Food Item to Restrict --</option>
                  {INDIAN_FOOD_CATALOG.filter(f => !restrictedIds.includes(f.id)).map(f => (
                    <option key={f.id} value={f.id}>
                      {f.nativeNames?.[language] || f.name} ({f.category})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={!selectedFoodToAdd}
                  onClick={() => {
                    if (selectedFoodToAdd) {
                      handleToggleRestrictedItem(selectedFoodToAdd);
                      setSelectedFoodToAdd('');
                    }
                  }}
                  className="py-2.5 px-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md flex items-center space-x-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('nominee.addRestrictedItem')}</span>
                </button>
              </div>

              {/* List of currently restricted items */}
              {restrictedIds.length === 0 ? (
                <div className="p-4 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 font-bold text-xs">
                  {t('nominee.noRestrictedItems')}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {restrictedIds.map(id => {
                    const item = INDIAN_FOOD_CATALOG.find(f => f.id === id);
                    if (!item) return null;
                    const name = item.nativeNames?.[language] || item.name;
                    return (
                      <div
                        key={id}
                        className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl flex items-center justify-between gap-2"
                      >
                        <div className="space-y-0.5">
                          <span className="text-xs font-black text-slate-900 dark:text-white block">{name}</span>
                          <span className="text-[10px] text-slate-500 font-semibold">{item.category} • ₹{item.basePrice}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleRestrictedItem(id)}
                          className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg cursor-pointer"
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
  );
};
