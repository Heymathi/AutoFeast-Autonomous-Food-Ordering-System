import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AuthService } from '../services/authService';
import { SecurityPinEntryView } from './SecurityPinEntryView';
import { X } from 'lucide-react';

export const OrderPinConfirmationModal: React.FC = () => {
  const {
    isOrderPinModalOpen,
    pendingPinVerification,
    confirmPendingPinAction,
    cancelPendingPinAction,
    accessibilitySettings,
    t,
    speakText,
    language
  } = useApp();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOrderPinModalOpen || !pendingPinVerification) {
    return null;
  }

  const triggerVerification = async (pinStr: string) => {
    setIsVerifying(true);
    setErrorMessage(null);

    const res = await AuthService.verifyPIN(pinStr);
    setIsVerifying(false);

    if (res.success) {
      const success = confirmPendingPinAction(pinStr);
      if (success && pendingPinVerification?.type !== 'save_schedule' && pendingPinVerification?.type !== 'reveal_wallet') {
        const successMsg = language === 'ta'
          ? 'பாதுகாப்பு PIN வெற்றிகரமாக சரிபார்க்கப்பட்டது!'
          : language === 'hi'
          ? 'सुरक्षा पिन सफलतापूर्वक सत्यापित हो गया!'
          : 'Security PIN verified successfully!';
        speakText(successMsg, undefined, language);
      }
    } else {
      setErrorMessage(res.error || t('pinConfirm.invalidPin'));
    }
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
    if (pendingPinVerification.type === 'cancel_schedule') {
      const scopeLabel = pendingPinVerification.cancelType === 'whole'
        ? (language === 'ta' ? 'முழு அட்டவணை' : language === 'hi' ? 'पूरा शेड्यूल' : 'Whole Schedule')
        : (language === 'ta' ? 'இந்த ஒரு முறை மட்டும்' : language === 'hi' ? 'सिर्फ़ इस बार' : 'Only This Occurrence');
      return {
        title: language === 'ta' ? 'அட்டவணை ரத்து செய்கிறது' : language === 'hi' ? 'शेड्यूल रद्द किया जा रहा है' : 'Cancel Schedule Confirmation',
        subtitle: `${scopeLabel} • ${pendingPinVerification.cancelDateStr || 'Today'}`,
        amount: null,
        typeBadge: 'Cancel Schedule Security'
      };
    }
    if (pendingPinVerification.type === 'reveal_wallet') {
      const titleLabel = language === 'ta'
        ? 'வாலட் இருப்பு பாதுகாப்பு'
        : language === 'hi'
        ? 'वॉलेट बैलेंस सुरक्षा'
        : 'Unlock Wallet Balance';
      const subtitleLabel = language === 'ta'
        ? 'வாலட் இருப்பைக் காண 4-இலக்க PIN-ஐ உள்ளிடவும்'
        : language === 'hi'
        ? 'वॉलेट बैलेंस देखने के लिए 4-अंकीय पिन दर्ज करें'
        : 'Enter 4-digit PIN to reveal wallet balance';
      return {
        title: titleLabel,
        subtitle: subtitleLabel,
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

  const summaryCard = (
    <div className="bg-[#DAF0F7]/50 p-3 rounded-xl border border-[#B2E2F0] flex items-center justify-between gap-3 my-2">
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
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className={`relative w-full max-w-md max-h-[94vh] flex flex-col rounded-3xl shadow-2xl transition-all border-4 overflow-y-auto p-5 ${
        accessibilitySettings.highContrast
          ? 'bg-black text-white border-yellow-400'
          : 'bg-white text-[#1A1110] border-[#FF5A1F]'
      }`}>
        <button
          onClick={cancelPendingPinAction}
          className="absolute top-3 right-3 z-20 p-2 rounded-full bg-slate-100 hover:bg-red-100 hover:text-red-600 transition-all text-[#4A5568] cursor-pointer"
          title="Cancel"
        >
          <X className="w-4 h-4" />
        </button>

        <SecurityPinEntryView
          title={t('pinConfirm.title')}
          subtitle={
            pendingPinVerification.type === 'save_schedule'
              ? t('pinConfirm.scheduleSubtitle')
              : pendingPinVerification.type === 'execute_schedule'
              ? t('pinConfirm.executeSubtitle')
              : t('pinConfirm.orderSubtitle')
          }
          onPinComplete={triggerVerification}
          onCancel={cancelPendingPinAction}
          isVerifying={isVerifying}
          errorMessage={errorMessage}
          setErrorMessage={setErrorMessage}
          summaryCard={summaryCard}
        />
      </div>
    </div>
  );
};
