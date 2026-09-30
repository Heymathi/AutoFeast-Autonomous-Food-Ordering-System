import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, Lock, CheckCircle2, XCircle, AlertCircle, Plus, Trash2, Mail, ShieldAlert, KeyRound, Clock } from 'lucide-react';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { FoodItem } from '../types';
import { AuthService } from '../services/authService';
import { NomineeNotificationService } from '../services/nomineeNotificationService';

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
    showToast
  } = useApp();

  const [enteredPin, setEnteredPin] = useState('');
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [newNomineePin, setNewNomineePin] = useState('');
  const [lockCountdown, setLockCountdown] = useState<number | null>(null);

  const [selectedFoodToAdd, setSelectedFoodToAdd] = useState('');

  useEffect(() => {
    let timer: any;
    if (lockCountdown !== null && lockCountdown > 0) {
      timer = setInterval(() => {
        setLockCountdown(prev => (prev && prev > 1 ? prev - 1 : null));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockCountdown]);

  if (!isOpen) return null;

  const nomineeName = currentUser?.nomineeName || 'Emergency Nominee';
  const nomineePhone = currentUser?.nomineePhone || '+91 98765 00000';
  const nomineeEmail = currentUser?.nomineeEmail || `${nomineeName.toLowerCase().replace(/\s+/g, '')}@autofeast.app`;
  const restrictedIds = currentUser?.restrictedFoodIds || [];

  const handleVerifyPin = async () => {
    if (lockCountdown && lockCountdown > 0) {
      return;
    }
    if (!enteredPin || enteredPin.length !== 4) {
      setPinError(language === 'ta' ? '4-இலக்க PIN உள்ளிடவும்.' : 'Please enter a valid 4-digit PIN.');
      return;
    }

    const res = await AuthService.verifyNomineePinServer(enteredPin, currentUser?.pinHash, currentUser?.id);

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
    } else {
      if (res.locked && res.lockTimeRemaining) {
        setLockCountdown(res.lockTimeRemaining);
        const mins = Math.ceil(res.lockTimeRemaining / 60);
        const lockMsg = language === 'ta'
          ? `அதிகமுறை தவறான PIN. ${mins} நிமிடங்களுக்குப் பின் முயற்சிக்கவும்.`
          : language === 'hi'
          ? `बहुत सारे गलत प्रयास। ${mins} मिनट के बाद पुनः प्रयास करें।`
          : `3 wrong PIN tries! Nominee access locked for ${mins} minute(s).`;
        setPinError(res.error || lockMsg);
      } else {
        const tries = res.remainingTries !== undefined ? res.remainingTries : 2;
        const err = language === 'ta'
          ? `தவறான Nominee PIN! ${tries} வாய்ப்புகள் மீதம் உள்ளன.`
          : language === 'hi'
          ? `गलत नामांकित पिन! ${tries} प्रयास शेष हैं।`
          : `Incorrect Nominee Security PIN. ${tries} try(ies) remaining.`;
        setPinError(res.error || err);
      }
    }
  };

  const handleSetNewPin = () => {
    if (newNomineePin.length !== 4 || !/^\d{4}$/.test(newNomineePin)) {
      setPinError('Nominee PIN must be 4 digits.');
      return;
    }

    if (newNomineePin === currentUser?.pinHash) {
      setPinError(language === 'ta'
        ? 'Nominee PIN பயனரின் PIN உடன் ஒன்றாக இருக்கக்கூடாது!'
        : language === 'hi'
        ? 'नामांकित पिन मुख्य उपयोगकर्ता पिन से अलग होना चाहिए!'
        : 'Nominee Security PIN must be DIFFERENT from the main user\'s PIN!');
      return;
    }

    updateUserProfile({ nomineePinHash: newNomineePin });
    setIsPinVerified(true);
    setNewNomineePin('');
    setPinError(null);

    const setMsg = language === 'ta'
      ? 'புதிய Nominee PIN வெற்றிகரமாக உருவாக்கப்பட்டது!'
      : language === 'hi'
      ? 'नया नामांकित पिन सफलतापूर्वक सहेजा गया!'
      : 'New Nominee Security PIN saved successfully!';
    showToast(setMsg);
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

  const handleApprove = (reqId: string) => {
    if (!isPinVerified) return;
    approveNomineeRequest(reqId);
    onClose();
  };

  const handleDeny = (reqId: string) => {
    if (!isPinVerified) return;
    denyNomineeRequest(reqId);
    onClose();
  };

  const pendingCount = pendingNomineeApprovals.filter(r => r.status === 'pending').length;

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
            onClick={onClose}
            className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* NOMINEE PIN SECURITY VERIFICATION GATE */}
        {!isPinVerified ? (
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
              <div className="p-3 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 rounded-xl text-xs font-black flex items-center justify-center space-x-2">
                <AlertCircle className="w-4 h-4" />
                <span>{pinError}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-sm mx-auto">
              <input
                type="password"
                maxLength={4}
                disabled={Boolean(lockCountdown && lockCountdown > 0)}
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 4-Digit Nominee PIN"
                className="w-full text-center tracking-widest text-xl font-black py-3 px-4 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 disabled:opacity-50"
              />

              <button
                type="button"
                disabled={Boolean(lockCountdown && lockCountdown > 0)}
                onClick={handleVerifyPin}
                className="w-full sm:w-auto py-3 px-6 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-400 text-white font-black text-sm rounded-xl shadow-md cursor-pointer transition-all active:scale-95 whitespace-nowrap flex items-center justify-center space-x-2"
              >
                {lockCountdown && lockCountdown > 0 ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>Locked ({Math.floor(lockCountdown / 60)}m {lockCountdown % 60}s)</span>
                  </>
                ) : (
                  <span>Verify PIN</span>
                )}
              </button>
            </div>

            {/* Change/Set Nominee PIN block */}
            <div className="pt-4 border-t border-amber-200 dark:border-amber-900/60 text-left space-y-2">
              <span className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                {language === 'ta' ? 'புதிய Nominee PIN அமைக்கவா?' : 'Set or Change Nominee Security PIN:'}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  maxLength={4}
                  value={newNomineePin}
                  onChange={(e) => setNewNomineePin(e.target.value.replace(/\D/g, ''))}
                  placeholder="New 4-Digit PIN"
                  className="py-2 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white w-36"
                />
                <button
                  type="button"
                  onClick={handleSetNewPin}
                  className="py-2 px-3 bg-slate-800 dark:bg-slate-700 text-white text-xs font-black rounded-xl cursor-pointer"
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
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-white">
                  {pendingCount} Pending
                </span>
              </h4>

              {pendingNomineeApprovals.length === 0 ? (
                <div className="p-4 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 font-bold text-xs">
                  No pending order approval requests.
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingNomineeApprovals.map(req => {
                    const itemName = req.foodItem.nativeNames?.[language] || req.foodItem.name;
                    return (
                      <div
                        key={req.id}
                        className={`p-4 rounded-2xl border-2 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                          req.status === 'pending'
                            ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/30'
                            : req.status === 'approved'
                            ? 'border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20'
                            : 'border-red-400 bg-red-50/30 dark:bg-red-950/20'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-black text-slate-900 dark:text-white">{itemName}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                              {req.orderType}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-semibold">
                            {req.scheduleDetails ? `Slot: ${req.scheduleDetails.slotName} at ${req.scheduleDetails.time}` : 'Instant Order'} • {new Date(req.requestedAt).toLocaleTimeString()}
                          </p>
                          
                          {/* Email Sent Indicator */}
                          <div className="flex items-center space-x-1 text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                            <Mail className="w-3 h-3" />
                            <span>{t('nominee.emailSentNotice')}</span>
                          </div>
                        </div>

                        {req.status === 'pending' ? (
                          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                            <button
                              type="button"
                              onClick={() => handleDeny(req.id)}
                              className="py-2 px-3 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl shadow-sm flex items-center space-x-1 cursor-pointer"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>{t('nominee.denyBtn')}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleApprove(req.id)}
                              className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-sm flex items-center space-x-1 cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>{t('nominee.approveBtn')}</span>
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
