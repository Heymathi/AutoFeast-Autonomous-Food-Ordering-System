import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { SpeechService } from '../services/speechService';
import { Lock, ShieldCheck, Mic, Delete, CheckCircle, AlertTriangle, X, ArrowRight } from 'lucide-react';

export const OrderPinConfirmationModal: React.FC = () => {
  const {
    isOrderPinModalOpen,
    setIsOrderPinModalOpen,
    pendingPinVerification,
    confirmPendingPinAction,
    cancelPendingPinAction,
    accessibilitySettings,
    t,
    speakText,
    language
  } = useApp();

  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '']);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isListeningPin, setIsListeningPin] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const isAutoListeningTriggered = useRef(false);

  // 🚀 AUTOMATIC VOICE PROMPT & AUTO-LISTENING ON MODAL OPEN
  useEffect(() => {
    if (isOrderPinModalOpen) {
      setPinDigits(['', '', '', '']);
      setErrorMessage(null);
      setIsListeningPin(false);
      setIsVerifying(false);
      setIsSuccess(false);
      isAutoListeningTriggered.current = false;
      SpeechService.stopListening();

      const autoPrompt = language === 'ta'
        ? 'பாதுகாப்பு PIN சரிபார்க்கிறோம், உங்கள் 4-இலக்க PIN-ஐ சொல்லுங்கள்'
        : language === 'hi'
        ? 'सुरक्षा पिन सत्यापन: कृपया अपना 4-अंकीय पिन बोलें'
        : 'Checking Security PIN. Please say your 4-digit security PIN.';

      console.log('[Order PIN Modal]: Auto-prompting user aloud & activating voice listener...');

      // Speak prompt aloud and automatically start microphone capture afterwards
      speakText(autoPrompt, () => {
        if (!isAutoListeningTriggered.current && isOrderPinModalOpen) {
          isAutoListeningTriggered.current = true;
          startVoicePinListening();
        }
      }, language);
    } else {
      SpeechService.stopListening();
    }
  }, [isOrderPinModalOpen, pendingPinVerification]);

  const currentPinString = pinDigits.join('');

  // Physical Keyboard Listener (0-9, Backspace, Enter)
  useEffect(() => {
    if (!isOrderPinModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        const num = parseInt(e.key, 10);
        setErrorMessage(null);
        setPinDigits(prev => {
          const emptyIdx = prev.findIndex(d => d === '');
          if (emptyIdx !== -1) {
            const next = [...prev];
            next[emptyIdx] = num.toString();

            // Auto trigger validation if 4th digit just entered
            if (emptyIdx === 3) {
              const fullPin = next.join('');
              console.log('[PIN Modal Keyboard]: 4th digit entered, auto-validating PIN:', fullPin);
              triggerVerification(fullPin);
            }

            return next;
          }
          return prev;
        });
      } else if (e.key === 'Backspace') {
        setErrorMessage(null);
        setPinDigits(prev => {
          const filled = prev.map((d, i) => (d !== '' ? i : -1)).filter(i => i !== -1);
          if (filled.length > 0) {
            const lastIdx = filled[filled.length - 1];
            const next = [...prev];
            next[lastIdx] = '';
            return next;
          }
          return prev;
        });
      } else if (e.key === 'Enter') {
        if (currentPinString.length === 4) {
          handleConfirmOrderWithPIN();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOrderPinModalOpen, currentPinString]);

  if (!isOrderPinModalOpen || !pendingPinVerification) {
    return null;
  }

  const handleDigitClick = (num: number) => {
    setErrorMessage(null);
    const emptyIdx = pinDigits.findIndex(d => d === '');
    if (emptyIdx !== -1) {
      const next = [...pinDigits];
      next[emptyIdx] = num.toString();
      setPinDigits(next);

      // Auto trigger validation if all 4 digits completed
      if (emptyIdx === 3) {
        const fullPin = next.join('');
        console.log('[PIN Modal Keypad]: 4th digit entered, auto-validating PIN:', fullPin);
        triggerVerification(fullPin);
      }
    }
  };

  const handleBackspace = () => {
    setErrorMessage(null);
    const filledIndices = pinDigits.map((d, i) => (d !== '' ? i : -1)).filter(i => i !== -1);
    if (filledIndices.length > 0) {
      const lastIdx = filledIndices[filledIndices.length - 1];
      const next = [...pinDigits];
      next[lastIdx] = '';
      setPinDigits(next);
    }
  };

  const handleClear = () => {
    setErrorMessage(null);
    setPinDigits(['', '', '', '']);
  };

  // Helper method to start voice recognition
  const startVoicePinListening = () => {
    if (!SpeechService.isSupported()) {
      return;
    }

    setIsListeningPin(true);
    setErrorMessage(null);

    SpeechService.startListening({
      language,
      continuous: false,
      interimResults: true,
      onResult: (transcript: string, isFinal: boolean, nBestTranscripts?: string[]) => {
        if (!transcript || !transcript.trim()) return;

        const candidates = nBestTranscripts && nBestTranscripts.length > 0 ? nBestTranscripts : [transcript];
        let fourDigits: string[] | null = null;
        for (const cand of candidates) {
          fourDigits = SpeechService.extractFourDigits(cand);
          if (fourDigits && fourDigits.length === 4) break;
        }

        if (fourDigits && fourDigits.length === 4) {
          console.log('[Order PIN Modal Voice Success]: Extracted 4-digit PIN:', fourDigits);
          SpeechService.stopListening();
          setIsListeningPin(false);
          setPinDigits(fourDigits);

          const speakDigitsMsg = language === 'ta'
            ? `உள்ளிடப்பட்ட PIN எண்கள்: ${fourDigits.join(', ')}`
            : language === 'hi'
            ? `दर्ज किए गए पिन अंक: ${fourDigits.join(', ')}`
            : `PIN digits entered: ${fourDigits.join(', ')}`;

          speakText(speakDigitsMsg);
          triggerVerification(fourDigits.join(''));
        } else if (isFinal) {
          console.warn('[Order PIN Modal Voice Failed]: Could not extract 4 digits from transcript:', transcript);
          SpeechService.stopListening();
          setIsListeningPin(false);
          const retryMsg = language === 'ta'
            ? '4 எண்களை தெளிவாகச் சொல்லவும் அல்லது விசைப்பலகையைப் பயன்படுத்தவும்.'
            : language === 'hi'
            ? 'कृपया 4 अंकों को बोलें या नीचे कीपैड का उपयोग करें।'
            : 'Could not detect 4 digits by voice. Please say 4 digits clearly or use keypad.';
          setErrorMessage(retryMsg);

          // Auto-restart listening after retry prompt completes
          speakText(retryMsg, () => {
            if (isOrderPinModalOpen) {
              startVoicePinListening();
            }
          }, language);
        }
      },
      onError: (err: any) => {
        setIsListeningPin(false);
        console.warn('[Order PIN Modal Voice Error]:', err);
      },
      onEnd: () => {
        setIsListeningPin(false);
      }
    });
  };

  const handleManualVoiceButtonClick = () => {
    if (isListeningPin) {
      SpeechService.stopListening();
      setIsListeningPin(false);
      return;
    }

    const listenPrompt = t('pinConfirm.speakPinListening');
    speakText(listenPrompt, () => {
      startVoicePinListening();
    }, language);
  };

  const triggerVerification = (pinStr: string) => {
    if (!pinStr || pinStr.length !== 4) {
      console.warn('[Order PIN Modal]: triggerVerification called without 4 digits. Ignoring.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);

    setTimeout(() => {
      const success = confirmPendingPinAction(pinStr);
      setIsVerifying(false);

      if (success) {
        setIsSuccess(true);
        if (pendingPinVerification?.type !== 'save_schedule' && pendingPinVerification?.type !== 'reveal_wallet') {
          const successMsg = language === 'ta'
            ? 'பாதுகாப்பு PIN வெற்றிகரமாக சரிபார்க்கப்பட்டது!'
            : language === 'hi'
            ? 'सुरक्षा पिन सफलतापूर्वक सत्यापित हो गया!'
            : 'Security PIN Verified successfully!';
          speakText(successMsg, undefined, language);
        }
      } else {
        const invalidMsg = t('pinConfirm.invalidPin');
        setErrorMessage(invalidMsg);
        setPinDigits(['', '', '', '']);

        // Auto-restart voice listening after speaking invalid PIN error
        speakText(invalidMsg, () => {
          if (isOrderPinModalOpen) {
            startVoicePinListening();
          }
        }, language);
      }
    }, 400);
  };

  const handleConfirmOrderWithPIN = () => {
    if (currentPinString.length !== 4) {
      const err = language === 'ta'
        ? 'தயவுசெய்து 4-இலக்க PIN ஐ உள்ளிடவும்.'
        : language === 'hi'
        ? 'कृपया 4-अंकीय पिन दर्ज करें।'
        : 'Please enter all 4 digits of your security PIN.';
      setErrorMessage(err);
      speakText(err);
      return;
    }

    triggerVerification(currentPinString);
  };

  const getItemDetails = () => {
    if (pendingPinVerification.type === 'bill_order' && pendingPinVerification.bill) {
      const bill = pendingPinVerification.bill;
      const itemsSummary = bill.items.map(i => `${i.quantity}x ${i.foodItem.nativeNames?.[language] || i.foodItem.name}`).join(', ');
      return {
        title: itemsSummary,
        subtitle: `${bill.restaurantName} • GST Tax Invoice`,
        amount: bill.grandTotal,
        typeBadge: 'GST Invoice Order'
      };
    }
    if (pendingPinVerification.type === 'instant_order' && pendingPinVerification.item) {
      const item = pendingPinVerification.item;
      const price = item.basePrice || 100;
      return {
        title: item.name,
        subtitle: `${item.restaurant || 'Authentic Kitchen'} • Instant GPS Order`,
        amount: price + 20,
        typeBadge: 'Instant Order Payment'
      };
    }
    if (pendingPinVerification.type === 'save_schedule' && pendingPinVerification.schedule) {
      const sch = pendingPinVerification.schedule;
      return {
        title: `${sch.slotName}: ${sch.foodItemName}`,
        subtitle: `${sch.restaurant} • Time: ${sch.time} (${sch.frequency})`,
        amount: null,
        typeBadge: 'Auto-Order Schedule Setup'
      };
    }
    if (pendingPinVerification.type === 'execute_schedule') {
      return {
        title: 'Manual Execution of Scheduled Order',
        subtitle: 'Debiting Wallet & Triggering GPS Delivery',
        amount: pendingPinVerification.amount || 150,
        typeBadge: 'Scheduled Order Execution'
      };
    }
    if (pendingPinVerification.type === 'reveal_wallet') {
      const title = language === 'ta'
        ? 'வாலட் இருப்பு பாதுகாப்பு'
        : language === 'hi'
        ? 'वॉलेट बैलेंस सुरक्षा'
        : 'Unlock Wallet Balance';
      const subtitle = language === 'ta'
        ? 'வாலட் இருப்பைக் காண 4-இலக்க PIN-ஐ உள்ளிடவும்'
        : language === 'hi'
        ? 'वॉलेट बैलेंस देखने के लिए 4-अंकों का पिन दर्ज करें'
        : 'Enter 4-digit PIN to reveal wallet balance';
      return {
        title,
        subtitle,
        amount: null,
        typeBadge: 'Wallet Security'
      };
    }
    return {
      title: 'AutoFeast Order',
      subtitle: 'Wallet Auto-Debit Order',
      amount: pendingPinVerification.amount || 120,
      typeBadge: 'Order Confirmation'
    };
  };

  const details = getItemDetails();
  const isPinComplete = currentPinString.length === 4;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      
      {/* 🚀 COMPACT VIEWPORT CONTAINER WITH FIXED STICKY PROCEED BUTTON AT BOTTOM */}
      <div className={`relative w-full max-w-md max-h-[94vh] flex flex-col rounded-3xl shadow-2xl transition-all border-4 overflow-hidden ${
        accessibilitySettings.highContrast
          ? 'bg-black text-white border-yellow-400'
          : 'bg-white text-[#1A1110] border-[#FF5A1F]'
      }`}>
        
        {/* Close / Cancel Button */}
        <button
          onClick={cancelPendingPinAction}
          className="absolute top-3 right-3 z-20 p-2 rounded-full bg-slate-100 hover:bg-red-100 hover:text-red-600 transition-all text-[#4A5568] cursor-pointer"
          title="Cancel"
        >
          <X className="w-4 h-4" />
        </button>

        {/* SCROLLABLE INNER CONTENT AREA (Fits Header + Summary + Digit Boxes + Keypad) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
          
          {/* Modal Header */}
          <div className="text-center space-y-1">
            <div className="inline-flex p-2.5 bg-[#FF5A1F]/10 rounded-xl border border-[#FF5A1F]/30 text-[#FF5A1F]">
              <Lock className="w-6 h-6 animate-bounce" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#1A1110]">
              {t('pinConfirm.title')}
            </h2>
            <p className="text-xs font-bold text-[#4A5568]">
              {pendingPinVerification.type === 'save_schedule'
                ? t('pinConfirm.scheduleSubtitle')
                : pendingPinVerification.type === 'execute_schedule'
                ? t('pinConfirm.executeSubtitle')
                : t('pinConfirm.orderSubtitle')}
            </p>
          </div>

          {/* Compact Order / Schedule Summary Card */}
          <div className="bg-[#DAF0F7]/50 p-3 rounded-xl border border-[#B2E2F0] flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-[9px] font-black uppercase tracking-wider text-[#FF5A1F] bg-[#FF5A1F]/10 px-2 py-0.5 rounded-full border border-[#FF5A1F]/30">
                {details.typeBadge}
              </span>
              <h4 className="text-sm font-black text-[#1A1110] line-clamp-1">{details.title}</h4>
              <p className="text-[11px] font-semibold text-[#4A5568] line-clamp-1">{details.subtitle}</p>
            </div>
            {details.amount !== null && (
              <div className="text-right shrink-0">
                <span className="text-[10px] font-bold text-[#4A5568] block">Total</span>
                <span className="text-lg font-black text-[#16A34A]">₹{details.amount}</span>
              </div>
            )}
          </div>

          {/* PIN Digit Displays (4 Boxes) */}
          <div className="flex justify-center items-center space-x-2.5 sm:space-x-3">
            {pinDigits.map((digit, idx) => (
              <div
                key={idx}
                className={`w-12 h-14 sm:w-14 sm:h-16 rounded-xl border-3 flex items-center justify-center text-xl sm:text-2xl font-black transition-all shadow-inner ${
                  digit
                    ? 'border-[#FF5A1F] bg-[#FF5A1F]/10 text-[#FF5A1F] scale-105'
                    : 'border-[#DAF0F7] bg-slate-50 text-slate-400'
                }`}
              >
                {digit ? '●' : ''}
              </div>
            ))}
          </div>

          {/* Error Alert Box */}
          {errorMessage && (
            <div className="p-2.5 bg-red-500/10 border-2 border-red-500 rounded-xl text-red-600 font-black text-xs text-center flex items-center justify-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Fallback / Retry Voice PIN Input Button */}
          <div className="text-center">
            <button
              type="button"
              onClick={handleManualVoiceButtonClick}
              className={`w-full py-2.5 px-3 rounded-xl font-black text-xs transition-all border-2 flex items-center justify-center space-x-2 cursor-pointer ${
                isListeningPin
                  ? 'bg-red-500 text-white border-red-600 animate-pulse'
                  : 'bg-[#DAF0F7] text-[#1A1110] border-[#B2E2F0] hover:border-[#FF5A1F]'
              }`}
            >
              <Mic className={`w-3.5 h-3.5 ${isListeningPin ? 'animate-bounce text-white' : 'text-[#FF5A1F]'}`} />
              <span>{isListeningPin ? 'Listening for 4-digit PIN...' : 'Speak PIN (Voice Listening Retry)'}</span>
            </button>
          </div>

          {/* Touch Keypad (0-9, Clear, Backspace) */}
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleDigitClick(num)}
                className="py-2.5 sm:py-3 rounded-xl bg-slate-100 hover:bg-[#FF5A1F] hover:text-white text-[#1A1110] font-black text-lg sm:text-xl shadow-xs active:scale-95 transition-all border border-slate-200 cursor-pointer"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="py-2.5 sm:py-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-[11px] font-black uppercase text-[#4A5568] transition-all cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleDigitClick(0)}
              className="py-2.5 sm:py-3 rounded-xl bg-slate-100 hover:bg-[#FF5A1F] hover:text-white text-[#1A1110] font-black text-lg sm:text-xl shadow-xs active:scale-95 transition-all border border-slate-200 cursor-pointer"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="py-2.5 sm:py-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-[#4A5568] flex items-center justify-center transition-all cursor-pointer"
              title="Backspace"
            >
              <Delete className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* 🚀 STICKY ALWAYS-VISIBLE BOTTOM ACTION BAR (Cancel + PROCEED & CONFIRM PIN) */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-3 sm:p-4 shrink-0 flex items-center gap-2.5 z-30 shadow-lg">
          <button
            type="button"
            onClick={cancelPendingPinAction}
            className="w-1/3 py-3 px-3 bg-slate-100 hover:bg-slate-200 text-[#4A5568] font-black rounded-xl text-xs transition-all border border-slate-300 cursor-pointer text-center"
          >
            {t('pinConfirm.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirmOrderWithPIN}
            disabled={isVerifying}
            className={`w-2/3 py-3.5 px-4 font-black rounded-xl text-xs sm:text-sm shadow-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95 ${
              isPinComplete
                ? 'bg-[#16A34A] hover:bg-[#15803D] text-white shadow-[#16A34A]/40 ring-4 ring-[#16A34A]/30 animate-pulse'
                : 'bg-[#FF5A1F] hover:bg-[#E04812] text-white shadow-[#FF5A1F]/30'
            }`}
          >
            {isVerifying ? (
              <span className="animate-pulse">Verifying PIN...</span>
            ) : isSuccess ? (
              <>
                <CheckCircle className="w-4 h-4 text-white animate-bounce" />
                <span>Verified! Proceeding...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-white" />
                <span className="truncate">
                  {isPinComplete ? 'PROCEED & CONFIRM PIN' : 'PROCEED'}
                </span>
                <ArrowRight className="w-4 h-4 text-white" />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
