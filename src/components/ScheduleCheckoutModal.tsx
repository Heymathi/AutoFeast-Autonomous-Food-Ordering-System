import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { FoodItem, AutoOrderSchedule, ScheduleDuration, OrderStrategy } from '../types';
import { calculateScheduleEndDate } from '../services/autoOrderBackgroundService';
import { FuzzyMatchEngine } from '../services/fuzzyMatchService';
import { ScheduleBill } from './ScheduleBill';
import { WeekdaySelector } from './WeekdaySelector';
import { calculateScheduleOccurrences, calculateScheduleDatesList } from '../utils/scheduleCalculator';
import { Clock, Calendar, CheckCircle2, ShieldCheck, Wallet, Lock, X, AlertTriangle, ArrowRight, Utensils, Tag, FileText, Check, Mic } from 'lucide-react';
import { SpeechService } from '../services/speechService';
import { AuthService } from '../services/authService';
import { SttMatcherService } from '../services/sttMatcherService';
import { groupCartByRestaurant, validateCartItem } from '../utils/cartGrouping';
import { SecurityPinEntryView } from './SecurityPinEntryView';


export interface ScheduleCheckoutItem {
  foodItem: FoodItem;
  quantity: number;
}

export interface ScheduleCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ScheduleCheckoutItem[];
  initialSlotName?: string;
  initialTime?: string;
  onSuccess?: () => void;
}

export const ScheduleCheckoutModal: React.FC<ScheduleCheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  initialSlotName = 'Scheduled Slot',
  initialTime = '08:00',
  onSuccess
}) => {
  const {
    saveSchedule,
    walletBalance,
    dailyOrderCount,
    checkDailyOrderLimitReached,
    currentUser,
    checkIsItemRestrictedByNominee,
    handleNomineeRestrictedInterception,
    showToast,
    speakText,
    clearScheduleCart,
    t,
    language
  } = useApp();

  // Step State: 1 = Settings, 2 = Bill Preview, 3 = Security PIN, 4 = Receipt / Success
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Settings State
  const [timeInput, setTimeInput] = useState<string>(initialTime);
  const [showAmPmChoice, setShowAmPmChoice] = useState<boolean>(false);
  const [pendingHour, setPendingHour] = useState<number | null>(null);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'custom' | 'once'>('daily');
  const [selectedDays, setSelectedDays] = useState<string[]>(['Mon', 'Wed', 'Fri']);
  const [duration, setDuration] = useState<ScheduleDuration>('1_month');
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [strategy, setStrategy] = useState<OrderStrategy>('best_value');
  const [slotTitle, setSlotTitle] = useState<string>(initialSlotName);

  // Step 3: PIN Verification State
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '']);
  const [pinError, setPinError] = useState<string | null>(null);
  const [isListeningPin, setIsListeningPin] = useState<boolean>(false);

  // Validation & Error Feedback State
  const [validationError, setValidationError] = useState<string | null>(null);
  const [pastTimeSuggestion, setPastTimeSuggestion] = useState<{ suggestedTime: string; suggestedDate: string; label: string } | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setTimeInput(initialTime || '08:00');
      setShowAmPmChoice(false);
      setPendingHour(null);
      setPinDigits(['', '', '', '']);
      setPinError(null);
      setIsListeningPin(false);
      setValidationError(null);
      setPastTimeSuggestion(null);
      setIsValidating(false);
    }
  }, [isOpen, initialTime, initialSlotName]);

  if (!isOpen || items.length === 0) return null;

  // Group cart items by restaurant using shared helper
  const cartSummary = groupCartByRestaurant(items);
  const { groups, subtotal, totalDeliveryFee, platformFee, gstTax, perOrderTotal } = cartSummary;
  const grandTotal = perOrderTotal;

  const computedEndDate = calculateScheduleEndDate(startDate, duration, customEndDate);

  // Helper to check if selected time on today's start date has already passed
  const checkIsPastTime = (selectedTime: string, selectedStartDate: string): boolean => {
    if (!selectedStartDate || !selectedTime) return false;
    const now = new Date();
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    if (selectedStartDate !== todayISO) return false;

    const [hours, minutes] = selectedTime.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return false;

    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();

    if (hours < currentHours) return true;
    if (hours === currentHours && minutes <= currentMinutes) return true;
    return false;
  };

  // Fuzzy Time Parsing Helper
  const handleTimeBlurOrChange = (rawVal: string) => {
    setValidationError(null);
    setPastTimeSuggestion(null);
    if (!rawVal || !rawVal.trim()) return;
    const parsed = FuzzyMatchEngine.fuzzyParseTimeAndSchedule(rawVal, language);
    setTimeInput(parsed.time);

    if (parsed.isAmbiguous) {
      const match = rawVal.match(/(\d{1,2})/);
      if (match) {
        setPendingHour(parseInt(match[1], 10));
        setShowAmPmChoice(true);
      }
    } else {
      setShowAmPmChoice(false);
    }
  };

  const selectAmPm = (isPm: boolean) => {
    setValidationError(null);
    setPastTimeSuggestion(null);
    if (pendingHour !== null) {
      let finalHour = pendingHour;
      if (isPm && finalHour < 12) finalHour += 12;
      if (!isPm && finalHour === 12) finalHour = 0;
      const formatted = `${String(finalHour).padStart(2, '0')}:00`;
      setTimeInput(formatted);
      setShowAmPmChoice(false);
      setPendingHour(null);
    }
  };

  // Proceed from Settings to Bill Preview with strict validation feedback
  const handleProceedToBill = async () => {
    setIsValidating(true);
    setValidationError(null);
    setPastTimeSuggestion(null);

    await new Promise(r => setTimeout(r, 100));

    try {
      // 0. Validate each item in cart before proceeding
      for (const item of items) {
        const valRes = validateCartItem(item);
        if (!valRes.isValid) {
          const itemName = valRes.itemError || 'Cart Item';
          const template = t('cartItemInvalid') || '{item} has a problem. Remove it to continue.';
          const invalidMsg = template.replace('{item}', itemName);
          setValidationError(invalidMsg);
          showToast(invalidMsg, 'warning');
          setIsValidating(false);
          return;
        }
      }

      // 1. Resolve pending AM/PM choice if ambiguous
      if (showAmPmChoice && pendingHour !== null) {
        const msg = language === 'ta'
          ? 'தயவுசெய்து AM அல்லது PM தேர்வு செய்யவும்.'
          : language === 'hi'
          ? 'कृपया AM या PM चुनें।'
          : 'Please choose AM or PM for your selected time.';
        setValidationError(msg);
        showToast(msg, 'warning');
        setIsValidating(false);
        return;
      }

      // 2. Validate Past Time if start date is today
      if (checkIsPastTime(timeInput, startDate)) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tmrISO = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
        
        const err = language === 'ta'
          ? 'அந்த நேரம் ஏற்கனவே முடிந்துவிட்டது. புதிய நேரத்தைத் தேர்ந்தெடுக்கவும்.'
          : language === 'hi'
          ? 'वह समय बीत चुका है। नया समय चुनें।'
          : 'That time has passed. Pick a new time.';

        setValidationError(err);
        showToast(err, 'warning');
        
        setPastTimeSuggestion({
          suggestedDate: tmrISO,
          suggestedTime: timeInput,
          label: language === 'ta'
            ? `நாளை இதே நேரத்தில் (${tmrISO} at ${timeInput}) அமைக்கவா?`
            : language === 'hi'
            ? `कल इसी समय (${tmrISO} को ${timeInput}) सेट करें?`
            : `Set for tomorrow at same time (${tmrISO} at ${timeInput})?`
        });
        setIsValidating(false);
        return;
      }

      // 3. Daily Limit Check
      if (dailyOrderCount >= 6) {
        checkDailyOrderLimitReached();
        setIsValidating(false);
        return;
      }

      // 4. Nominee Restrictions Check
      for (const item of items) {
        if (!item || !item.foodItem) continue;
        const foodId = item.foodItem.id || '';
        const foodName = item.foodItem.name || '';
        if (checkIsItemRestrictedByNominee(foodId, foodName)) {
          handleNomineeRestrictedInterception(item.foodItem, 'scheduled', {
            time: timeInput,
            slotName: slotTitle,
            duration,
            frequency
          });
          onClose();
          setIsValidating(false);
          return;
        }
      }

      // All valid -> Proceed to Step 2 (Bill)
      setStep(2);
    } catch (e: any) {
      console.error('[ScheduleCheckoutModal]: Real unexpected error in handleProceedToBill:', e, e?.stack, 'Cart items:', items);
      const specificErr = e?.message || 'Unexpected validation failure';
      setValidationError(specificErr);
      showToast(`Error: ${specificErr}`, 'error');
    } finally {
      setIsValidating(false);
    }
  };

  // Proceed from Bill Preview to PIN Verification
  const handleProceedToPin = () => {
    setStep(3);
    // Announce PIN step aloud
    const pinMsg = language === 'ta'
      ? 'பாதுகாப்பு PIN சரிபார்க்கிறோம், உங்கள் 4-இலக்க PIN-ஐ பதிவு செய்யுங்கள்.'
      : language === 'hi'
      ? 'सुरक्षा पिन सत्यापन: कृपया अपना 4-अंकीय पिन दर्ज करें।'
      : 'Security PIN verification. Please enter your 4-digit PIN.';
    speakText(pinMsg);
  };

  // Handle PIN Key Input
  const handlePinKey = (digit: string) => {
    setPinError(null);
    setPinDigits(prev => {
      const next = [...prev];
      const emptyIdx = next.findIndex(d => d === '');
      if (emptyIdx !== -1) {
        next[emptyIdx] = digit;
        if (emptyIdx === 3) {
          // Auto verify on 4th digit
          const fullPin = next.join('');
          verifyAndConfirmPin(fullPin);
        }
      }
      return next;
    });
  };

  const handlePinBackspace = () => {
    setPinError(null);
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
  };

  const handlePinClear = () => {
    setPinDigits(['', '', '', '']);
    setPinError(null);
  };

  // Verify PIN & Save Schedules via server-side verification service
  const verifyAndConfirmPin = async (enteredPin: string) => {
    const res = await AuthService.verifyPIN(enteredPin);
    if (res.success && res.token) {
      // Save all schedules
      items.forEach((item, idx) => {
        if (!item || !item.foodItem) return;
        const schedule: AutoOrderSchedule = {
          id: `sched-${Date.now()}-${idx}`,
          slotName: slotTitle || `Scheduled Slot ${idx + 1}`,
          slotIndex: 1,
          time: timeInput,
          frequency,
          foodItemId: item.foodItem.id || `item_${idx}`,
          foodItemName: item.foodItem.name || 'Food Item',
          restaurant: item.foodItem.restaurant || 'Saravana Bhavan',
          quantity: item.quantity || 1,
          strategy,
          isEnabled: true,
          walletAutoDebit: true,
          duration,
          startDate,
          endDate: computedEndDate
        };
        saveSchedule(schedule, res.token);
      });

      clearScheduleCart();
      setStep(4);
      const successMsg = language === 'ta'
        ? 'அட்டவணை வெற்றிகரமாக அமைக்கப்பட்டது!'
        : language === 'hi'
        ? 'शेड्यूल सफलतापूर्वक बनाया गया!'
        : 'Schedule created successfully!';
      showToast(successMsg, 'success');
      speakText(successMsg);

      if (onSuccess) onSuccess();
    } else {
      const err = res.error || (language === 'ta'
        ? 'தவறான PIN. மீண்டும் முயற்சிக்கவும்.'
        : language === 'hi'
        ? 'गलत पिन। कृपया पुनः प्रयास करें।'
        : 'Invalid PIN. Please try again.');
      setPinError(err);
      setPinDigits(['', '', '', '']);
      showToast(err, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border-2 border-[#FF5A1F] relative max-h-[92vh] overflow-y-auto text-[#1A1110]">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-[#4A5568] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header & Progress Indicator */}
        <div className="space-y-3 pb-4 border-b border-[#DAF0F7]">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-black uppercase text-[#FF5A1F] bg-[#FF5A1F]/10 px-3 py-1 rounded-full border border-[#FF5A1F]/20">
              Schedule Checkout Flow
            </span>
            <span className="text-xs font-bold text-[#4A5568]">
              Step {step} of 4
            </span>
          </div>

          {/* Stepper Dots */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            {['1. Settings', '2. Bill', '3. PIN', '4. Success'].map((lbl, idx) => (
              <div
                key={idx}
                className={`h-2 rounded-full transition-all ${
                  idx + 1 <= step ? 'bg-[#FF5A1F]' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>

          <h3 className="text-2xl font-black text-[#1A1110] flex items-center gap-2 mt-2">
            <Clock className="w-6 h-6 text-[#FF5A1F]" />
            {step === 1 && 'Configure Schedule Time & Duration'}
            {step === 2 && 'Schedule Bill & GST Summary'}
            {step === 3 && 'Security PIN Verification'}
            {step === 4 && 'Schedule Confirmation Receipt'}
          </h3>
        </div>

        {/* STEP 1: SCHEDULE SETTINGS */}
        {step === 1 && (
          <div className="space-y-6 pt-4">
            
            {/* Items Summary Header */}
            <div className="bg-[#DAF0F7]/40 p-4 rounded-2xl border border-[#B2E2F0] space-y-2">
              <span className="text-xs font-black uppercase text-[#FF5A1F] tracking-wider block">
                Selected Food Items ({items.length})
              </span>
              <div className="space-y-2 max-h-36 overflow-y-auto">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs font-bold bg-white p-2.5 rounded-xl border border-[#B2E2F0]">
                    <div className="flex items-center space-x-2">
                      <img src={item.foodItem.image} alt={item.foodItem.name} className="w-8 h-8 rounded-lg object-cover" />
                      <div>
                        <span className="font-black text-[#1A1110]">{item.foodItem.name}</span>
                        <span className="text-[10px] text-[#4A5568] block">{item.foodItem.restaurant}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[#FF5A1F] font-black">₹{item.foodItem.basePrice} × {item.quantity}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Time & Fuzzy Parsing Prompt */}
            <div className="space-y-3 bg-white p-4 rounded-2xl border border-[#DAF0F7]">
              <label className="text-xs font-black uppercase text-[#4A5568] flex items-center justify-between">
                <span>Set Delivery Time</span>
                <span className="text-[11px] text-[#FF5A1F] font-extrabold">Fuzzy Parser Enabled</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="time"
                  value={timeInput}
                  onChange={e => handleTimeBlurOrChange(e.target.value)}
                  className="w-full p-3.5 rounded-2xl border border-[#B2E2F0] bg-slate-50 text-[#1A1110] font-black text-lg text-center focus:outline-none focus:border-[#FF5A1F]"
                />

                <input
                  type="text"
                  placeholder='Try "8 AM", "night 8", "evening 7:30"'
                  onBlur={e => handleTimeBlurOrChange(e.target.value)}
                  className="w-full p-3.5 rounded-2xl border border-[#B2E2F0] bg-slate-50 text-xs font-bold text-[#1A1110]"
                />
              </div>

              {/* Ambiguous Hour Disambiguation Prompt */}
              {showAmPmChoice && (
                <div className="p-4 bg-amber-50 rounded-2xl border-2 border-amber-300 space-y-3 text-center animate-fade-in">
                  <p className="text-xs font-black text-amber-900">
                    ⚠️ Did you mean {pendingHour}:00 AM (Morning) or {pendingHour}:00 PM (Evening)?
                  </p>
                  <div className="flex justify-center space-x-3">
                    <button
                      onClick={() => selectAmPm(false)}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl text-xs shadow-md"
                    >
                      ☀️ {pendingHour}:00 AM (Morning)
                    </button>
                    <button
                      onClick={() => selectAmPm(true)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-black rounded-xl text-xs shadow-md"
                    >
                      🌙 {pendingHour}:00 PM (Evening)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Frequency & Duration Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-[#4A5568]">Frequency</label>
                <select
                  value={frequency}
                  onChange={e => setFrequency(e.target.value as any)}
                  className="w-full p-3 rounded-xl border border-[#B2E2F0] bg-slate-50 font-black text-xs"
                >
                  <option value="daily">Every Day (Daily)</option>
                  <option value="weekly">Every Week (Weekly)</option>
                  <option value="once">One-time Only</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-[#4A5568]">Recurrence Duration</label>
                <select
                  value={duration}
                  onChange={e => setDuration(e.target.value as ScheduleDuration)}
                  className="w-full p-3 rounded-xl border border-[#B2E2F0] bg-slate-50 font-black text-xs"
                >
                  <option value="today_only">Today Only</option>
                  <option value="1_week">1 Week</option>
                  <option value="1_month">1 Month</option>
                  <option value="3_months">3 Months</option>
                  <option value="custom">Custom Date Range</option>
                  <option value="indefinite">Indefinite (Until Cancelled)</option>
                </select>
              </div>
            </div>

            {/* 🚀 FREE WEEKDAY SELECTION CHIPS */}
            {(frequency === 'weekly' || frequency === 'custom') && (
              <div className="bg-[#DAF0F7]/20 p-4 rounded-2xl border border-[#B2E2F0]">
                <WeekdaySelector
                  selectedDays={selectedDays}
                  onChange={setSelectedDays}
                />
              </div>
            )}

            {/* Start Date & End Date Preview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#DAF0F7]/30 p-4 rounded-2xl border border-[#B2E2F0]">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-[#4A5568] flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#FF5A1F]" /> Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#B2E2F0] bg-white font-bold text-xs"
                />
              </div>

              {duration === 'custom' ? (
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-[#4A5568]">Custom End Date</label>
                  <input
                    type="date"
                    value={customEndDate}
                    min={startDate}
                    onChange={e => setCustomEndDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#B2E2F0] bg-white font-bold text-xs"
                  />
                </div>
              ) : (
                <div className="flex flex-col justify-center space-y-1">
                  <span className="text-[10px] uppercase font-black text-[#4A5568]">Calculated End Date</span>
                  <span className="text-xs font-black text-[#16A34A] bg-white p-2 rounded-xl border border-[#B2E2F0]">
                    {computedEndDate || 'Runs Indefinitely'}
                  </span>
                </div>
              )}
            </div>

            {/* Computed Delivery Dates Verification List */}
            {(() => {
              const deliveryDates = calculateScheduleDatesList(startDate, duration, customEndDate, frequency === 'daily' ? [] : selectedDays);
              return (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-[#1A1110]">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-[#FF5A1F]" />
                      <span>{t('confirmDates')} ({deliveryDates.length} delivery dates)</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
                    {deliveryDates.slice(0, 15).map((d, i) => (
                      <span key={i} className="text-[11px] font-bold bg-white text-[#1A1110] px-2.5 py-1 rounded-lg border border-slate-300">
                        {d}
                      </span>
                    ))}
                    {deliveryDates.length > 15 && (
                      <span className="text-[11px] font-bold text-slate-500 py-1 px-1">
                        +{deliveryDates.length - 15} more...
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Inline Validation Error & Past-Time Suggestion Alert */}
            {validationError && (
              <div className="p-4 bg-rose-50 rounded-2xl border-2 border-rose-300 space-y-2 animate-fade-in">
                <div className="flex items-center space-x-2 text-rose-800 font-black text-xs">
                  <AlertTriangle className="w-5 h-5 text-[#C2185B] shrink-0" />
                  <span>{validationError}</span>
                </div>

                {pastTimeSuggestion && (
                  <div className="pt-2 border-t border-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-rose-900">{pastTimeSuggestion.label}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setStartDate(pastTimeSuggestion.suggestedDate);
                        setTimeInput(pastTimeSuggestion.suggestedTime);
                        setValidationError(null);
                        setPastTimeSuggestion(null);
                      }}
                      className="px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-black rounded-xl shadow-md cursor-pointer flex items-center space-x-1 shrink-0"
                    >
                      <Check className="w-4 h-4" />
                      <span>{language === 'ta' ? 'நாளைக்கு மாற்று (One-Tap Fix)' : language === 'hi' ? 'कल के लिए सेट करें' : 'Set for Tomorrow (One-Tap Fix)'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Sticky Action Footer Button */}
            <div className="sticky bottom-0 bg-white/95 backdrop-blur-md pt-4 pb-2 border-t border-[#DAF0F7] flex justify-end z-10">
              <button
                type="button"
                onClick={handleProceedToBill}
                disabled={isValidating}
                className={`px-8 py-3 bg-[#FF5A1F] hover:bg-[#E04812] text-white font-black rounded-2xl shadow-lg shadow-[#FF5A1F]/30 flex items-center space-x-2 cursor-pointer transition-all ${
                  isValidating ? 'opacity-60 cursor-not-allowed scale-95' : 'active:scale-95'
                }`}
              >
                {isValidating ? (
                  <>
                    <Clock className="w-4 h-4 text-white animate-spin" />
                    <span>Validating...</span>
                  </>
                ) : (
                  <>
                    <span>Proceed to Bill Breakdown</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

          </div>
        )}

        {/* STEP 2: BILL PREVIEW */}
        {step === 2 && (
          <div className="space-y-6 pt-4">
            
            {/* Shared Schedule Bill Component */}
            <ScheduleBill
              items={items}
              time={timeInput}
              frequency={frequency}
              duration={duration}
              startDate={startDate}
              endDate={customEndDate}
            />

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-4 border-t border-[#DAF0F7]">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-[#4A5568] font-black rounded-xl text-xs cursor-pointer"
              >
                Back to Settings
              </button>

              <button
                onClick={handleProceedToPin}
                className="px-8 py-3 bg-[#16A34A] hover:bg-[#15803D] text-white font-black rounded-2xl shadow-lg flex items-center space-x-2 cursor-pointer"
              >
                <ShieldCheck className="w-5 h-5 text-yellow-200" />
                <span>Confirm Bill & Enter Security PIN</span>
              </button>
            </div>

          </div>
        )}

        {/* STEP 3: SECURITY PIN */}
        {step === 3 && (
          <div className="pt-2">
            <SecurityPinEntryView
              title={t('pinConfirm.title')}
              subtitle={t('pinConfirm.scheduleSubtitle')}
              onPinComplete={(pinStr) => verifyAndConfirmPin(pinStr)}
              onCancel={() => setStep(2)}
              cancelButtonText={t('backToBill')}
              submitButtonText={t('pinConfirm.confirmScheduleBtn')}
              errorMessage={pinError}
              setErrorMessage={setPinError}
              summaryCard={
                <div className="p-3 bg-[#DAF0F7]/50 rounded-2xl border border-[#B2E2F0] flex items-center justify-between gap-3 my-2">
                  <div className="text-left">
                    <span className="text-[9px] font-black uppercase tracking-wider text-[#FF5A1F] bg-[#FF5A1F]/10 px-2 py-0.5 rounded-full border border-[#FF5A1F]/30">
                      Multi-Item Schedule
                    </span>
                    <h4 className="text-sm font-black text-[#1A1110] line-clamp-1">{slotTitle}</h4>
                    <p className="text-[11px] font-semibold text-[#4A5568] line-clamp-1">{items.length} items • {frequency} ({timeInput})</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[#4A5568] text-[10px] font-bold block">Bill Total</span>
                    <span className="text-[#16A34A] text-lg font-black">₹{grandTotal}</span>

                  </div>
                </div>
              }
            />
          </div>
        )}


        {/* STEP 4: CONFIRMATION RECEIPT */}
        {step === 4 && (
          <div className="space-y-6 pt-4 text-center">
            
            <div className="p-6 bg-emerald-50 rounded-3xl border-2 border-emerald-200 space-y-3">
              <CheckCircle2 className="w-14 h-14 text-[#16A34A] mx-auto animate-bounce" />
              <h4 className="text-xl font-black text-[#16A34A]">Schedule Confirmed!</h4>
              <p className="text-xs text-[#4A5568] font-bold max-w-md mx-auto">
                Your order schedule has been created and saved. Auto-ordering will trigger at {timeInput} daily/weekly as configured.
              </p>
            </div>

            {/* Receipt Details */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-[#DAF0F7] text-left space-y-2 text-xs font-bold text-[#1A1110]">
              <div className="flex justify-between">
                <span className="text-[#4A5568]">Slot Title:</span>
                <span className="font-black">{slotTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#4A5568]">Delivery Time:</span>
                <span className="font-mono text-[#FF5A1F]">{timeInput}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#4A5568]">Range:</span>
                <span>{startDate} to {computedEndDate || 'Indefinite'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#4A5568]">Total Items Scheduled:</span>
                <span className="font-black">{items.length} items</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3.5 bg-[#FF5A1F] hover:bg-[#E04812] text-white font-black rounded-2xl shadow-lg cursor-pointer"
            >
              Done & Return to App
            </button>

          </div>
        )}

      </div>
    </div>
  );
};
