import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { FoodItem } from '../types';
import { Mail, Clock, RefreshCw, X, ShieldAlert, CheckCircle2, AlertCircle, Mic } from 'lucide-react';
import { SpeechController } from '../services/speechController';
import { VoiceIntentRouter } from '../services/voiceIntentRouter';

export interface NomineeApprovalWaitingModalProps {
  isOpen: boolean;
  onClose: () => void;
  approvalId: string;
  foodItem: FoodItem;
  orderType: 'instant' | 'scheduled';
  scheduleDetails?: any;
  onApproved: (foodItem: FoodItem, orderType: 'instant' | 'scheduled', scheduleDetails?: any) => void;
  onDenied: () => void;
}

const MIC_OWNER = 'nominee_waiting';

export const NomineeApprovalWaitingModal: React.FC<NomineeApprovalWaitingModalProps> = ({
  isOpen,
  onClose,
  approvalId,
  foodItem,
  orderType,
  scheduleDetails,
  onApproved,
  onDenied
}) => {
  const { language, t, showToast } = useApp();

  const [isPolling, setIsPolling] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [reminderCount, setReminderCount] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [hasPollingError, setHasPollingError] = useState(false);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const handledRef = useRef(false);
  const consecutiveErrorsRef = useRef(0);

  const itemName = foodItem?.nativeNames?.[language] || foodItem?.name || 'Food item';

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const handleCancel = useCallback(() => {
    if (handledRef.current) return;
    handledRef.current = true;
    stopPolling();
    SpeechController.cancelSpeech();
    SpeechController.releaseMic(MIC_OWNER);

    // Notify backend cancel
    if (approvalId) {
      const token = localStorage.getItem('autofeast_jwt_token') || '';
      fetch(`/api/approvals/${approvalId}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => {});
    }

    onClose();
  }, [approvalId, onClose, stopPolling]);

  // STT matching for cancel words in EN, TA, HI
  const isCancelCommand = useCallback((text: string): boolean => {
    const lower = (text || '').toLowerCase().trim();
    const cancelKeywords = [
      // English
      'cancel', 'stop', 'abort', 'close', 'go back', 'exit', 'no',
      // Tamil
      'ரத்து', 'ரத்து செய்', 'நிறுத்து', 'வேண்டாம்', 'திரும்பு', 'மூடு',
      // Hindi
      'रद्द', 'रद्द करो', 'कैंसिल', 'वापस', 'बंद करो', 'नहीं', 'रोको'
    ];
    return cancelKeywords.some(kw => lower.includes(kw));
  }, []);

  const handleSendReminderRef = useRef<() => void>(() => {});

  const startListeningForCancel = useCallback(() => {
    if (!isMountedRef.current || handledRef.current) return;

    const onMicResult = (transcript: string, _isFinal?: boolean, alternatives?: string[]) => {
      if (!isMountedRef.current || handledRef.current || !transcript) return;
      setLiveTranscript(transcript);
      const candidates = alternatives && alternatives.length > 0 ? alternatives : [transcript];
      const match = VoiceIntentRouter.matchNomineeWaitingIntent(candidates);
      if (match.action === 'send_reminder') {
        handleSendReminderRef.current();
        return;
      }
      if (match.action === 'cancel' || isCancelCommand(transcript)) {
        handleCancel();
      }
    };
    const onMicError = () => {
      setIsListening(false);
    };
    const onMicEnd = () => {
      setIsListening(false);
    };

    if (typeof (SpeechController as any).acquireMic === 'function') {
      (SpeechController as any).acquireMic(MIC_OWNER, onMicResult, onMicError, onMicEnd, language);
    } else if (typeof SpeechController.requestMic === 'function') {
      SpeechController.requestMic({
        owner: MIC_OWNER,
        language,
        continuous: false,
        interimResults: true,
        onResult: (transcript, isFinal, alternatives) => onMicResult(transcript, isFinal, alternatives),
        onError: () => onMicError(),
        onEnd: () => onMicEnd()
      });
    }
    setIsListening(true);
  }, [handleCancel, isCancelCommand, language]);

  // Status check logic
  const checkStatus = useCallback(async () => {
    if (!approvalId || handledRef.current) return;
    const token = localStorage.getItem('autofeast_jwt_token') || '';
    try {
      // 1) STATUS POLLING: Use dedicated status endpoint with main user's JWT
      const res = await fetch(`/api/nominee/approval-requests/${approvalId}/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        if (res.status === 404 || res.status === 410) {
          stopPolling();
          return;
        }
        consecutiveErrorsRef.current += 1;
        if (consecutiveErrorsRef.current >= 2) {
          stopPolling();
          setHasPollingError(true);
        }
        return;
      }

      // Successful poll: clear consecutive errors
      consecutiveErrorsRef.current = 0;
      setHasPollingError(false);

      const data = await res.json();
      if (!isMountedRef.current || handledRef.current) return;

      if (data.status === 'approved') {
        handledRef.current = true;
        stopPolling();
        SpeechController.cancelSpeech();
        SpeechController.releaseMic(MIC_OWNER);

        const approvedMsg = orderType === 'scheduled'
          ? (t('nominee.approvedSchedulingNow') || t('nominee.approved'))
          : (t('nominee.approvedOrderNow') || t('nominee.approved'));
        showToast(approvedMsg, 'success');
        SpeechController.speak(approvedMsg, language);

        onApproved(foodItem, orderType, scheduleDetails);
        onClose();
      } else if (data.status === 'denied') {
        handledRef.current = true;
        stopPolling();
        SpeechController.cancelSpeech();
        SpeechController.releaseMic(MIC_OWNER);

        const deniedMsg = t('nominee.denied');
        showToast(deniedMsg, 'error');
        SpeechController.speak(deniedMsg, language);

        onDenied();
        onClose();
      } else if (data.status === 'expired') {
        setIsExpired(true);
        stopPolling();
        const expiredMsg = t('nominee.expired');
        showToast(expiredMsg, 'warning');
        SpeechController.speak(expiredMsg, language);
      }
    } catch (err) {
      consecutiveErrorsRef.current += 1;
      if (consecutiveErrorsRef.current >= 2) {
        stopPolling();
        setHasPollingError(true);
      }
    }
  }, [approvalId, foodItem, language, onApproved, onClose, onDenied, orderType, scheduleDetails, showToast, stopPolling, t]);

  const handleCheckAgain = useCallback(() => {
    consecutiveErrorsRef.current = 0;
    setHasPollingError(false);
    checkStatus();
    stopPolling();
    pollTimerRef.current = setInterval(checkStatus, 5000);
    setIsPolling(true);
  }, [checkStatus, stopPolling]);

  const handleSendReminder = async () => {
    if (!approvalId || isSendingReminder) return;
    setIsSendingReminder(true);
    try {
      const token = localStorage.getItem('autofeast_jwt_token') || '';
      const res = await fetch(`/api/approvals/${approvalId}/remind`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const sentMsg = t('nominee.reminderSent');
        showToast(sentMsg, 'success');
        SpeechController.speak(sentMsg, language);
        setReminderCount(prev => prev + 1);
        setIsExpired(false);
        consecutiveErrorsRef.current = 0;
        setHasPollingError(false);
        // Resume polling
        stopPolling();
        pollTimerRef.current = setInterval(checkStatus, 5000);
        setIsPolling(true);
      } else {
        const errMsg = t('nominee.emailSendError');
        showToast(errMsg, 'error');
      }
    } catch {
      showToast(t('nominee.emailSendError'), 'error');
    } finally {
      setIsSendingReminder(false);
    }
  };

  handleSendReminderRef.current = handleSendReminder;
  const checkStatusRef = useRef(checkStatus);
  checkStatusRef.current = checkStatus;
  const startListeningRef = useRef(startListeningForCancel);
  startListeningRef.current = startListeningForCancel;
  const stopPollingRef = useRef(stopPolling);
  stopPollingRef.current = stopPolling;
  const tRef = useRef(t);
  tRef.current = t;
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  useEffect(() => {
    isMountedRef.current = true;
    handledRef.current = false;
    setIsExpired(false);
    setReminderCount(0);
    setLiveTranscript('');
    consecutiveErrorsRef.current = 0;
    setHasPollingError(false);

    if (isOpen && approvalId) {
      const waitingPrompt = tRef.current('nominee.waitingApproval');
      showToastRef.current(waitingPrompt, 'warning', 5000, 'nominee_waiting', undefined, undefined, true);

      SpeechController.speak(
        waitingPrompt,
        language,
        () => {
          if (isMountedRef.current && !handledRef.current) {
            startListeningRef.current();
          }
        },
        undefined,
        MIC_OWNER,
        `nominee_waiting_${approvalId}`
      );

      // Poll server every 5 seconds (5000 ms) as specified in requirement
      checkStatusRef.current();
      pollTimerRef.current = setInterval(() => checkStatusRef.current(), 5000);
      setIsPolling(true);
    }

    return () => {
      isMountedRef.current = false;
      stopPollingRef.current();
      SpeechController.cancelSpeech();
      SpeechController.releaseMic(MIC_OWNER);
    };
  }, [isOpen, approvalId, language]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border-4 border-[#D93636] shadow-2xl p-6 text-center space-y-5">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={handleCancel}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors cursor-pointer"
          aria-label={t('nominee.cancelBtn')}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Pulsing Icon */}
        <div className="flex justify-center pt-2">
          <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-orange-100 dark:bg-orange-950/60 border-2 border-[#D93636]/30">
            <Mail className="w-10 h-10 text-[#D93636] animate-bounce" />
            <span className="absolute top-1 right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D93636] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-[#D93636]"></span>
            </span>
          </div>
        </div>

        {/* Title & Message */}
        <div className="space-y-2">
          <span className="text-[11px] font-black uppercase text-[#D93636] bg-[#D93636]/10 px-3 py-1 rounded-full border border-[#D93636]/20">
            {t('nominee.approvalRequiredBadge')}
          </span>

          <h3 className="text-xl font-black text-slate-900 dark:text-white">
            {isExpired ? t('nominee.expired') : t('nominee.waitingApproval')}
          </h3>

          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            <strong>{itemName}</strong> • {orderType === 'scheduled' ? t('nominee.scheduledOrder') : t('nominee.instantOrder')}
          </p>
        </div>

        {/* Live Mic Feedback */}
        {isListening && (
          <div className="p-2.5 rounded-2xl bg-[#FBE9E5]/40 border border-[#F0E5DC] text-xs flex items-center justify-between text-slate-700 dark:text-slate-300">
            <span className="flex items-center gap-1.5 font-bold text-[#D93636]">
              <Mic className="w-3.5 h-3.5 animate-pulse" />
              <span>Say "cancel" to abort</span>
            </span>
            {liveTranscript && (
              <span className="text-[11px] font-extrabold italic text-[#D93636]">
                "{liveTranscript}"
              </span>
            )}
          </div>
        )}

        {/* Status notice */}
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs font-medium text-amber-800 dark:text-amber-200 flex items-start gap-2 text-left">
          <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            {isExpired
              ? t('nominee.expired')
              : 'An e-mail with single-use Approve & Deny buttons has been sent to your registered nominee. Once they decide, this screen will update automatically.'}
          </span>
        </div>

        {/* 1) Polling error alert with Check Again button */}
        {hasPollingError && (
          <div className="p-3.5 rounded-2xl bg-[#FBE9E5] dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-xs font-semibold text-rose-900 dark:text-emerald-200 flex flex-col items-center gap-2">
            <span className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-[#D93636] shrink-0" />
              <span>{t('nominee.pollError')}</span>
            </span>
            <button
              type="button"
              onClick={handleCheckAgain}
              className="px-4 py-2 bg-[#D93636] hover:bg-[#C02B2B] text-white font-bold rounded-xl text-xs shadow transition-all cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t('nominee.checkAgain')}</span>
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          {/* Send Reminder Button (Available if expired or after waiting) */}
          <button
            type="button"
            onClick={handleSendReminder}
            disabled={isSendingReminder}
            className="w-full min-h-[46px] bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-black py-3 px-4 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSendingReminder ? 'animate-spin' : ''}`} />
            <span>{isSendingReminder ? 'Sending...' : t('nominee.sendReminder')} {reminderCount > 0 ? `(${reminderCount})` : ''}</span>
          </button>

          {/* Cancel Button */}
          <button
            type="button"
            onClick={handleCancel}
            className="w-full min-h-[46px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 font-black py-3 px-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm cursor-pointer border border-slate-200 dark:border-slate-700"
          >
            <X className="w-4 h-4" />
            <span>{t('nominee.cancelBtn')}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
