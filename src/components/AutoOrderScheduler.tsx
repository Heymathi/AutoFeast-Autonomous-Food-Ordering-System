import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AutoOrderSchedule, FoodItem, OrderStrategy, ScheduleDuration, ScheduleOverride } from '../types';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { calculateScheduleEndDate } from '../services/autoOrderBackgroundService';
import { FuzzyMatchEngine } from '../services/fuzzyMatchService';
import { ScheduleCheckoutModal } from './ScheduleCheckoutModal';
import { WeekdaySelector } from './WeekdaySelector';
import { Clock, Calendar, CheckCircle2, ShieldCheck, Wallet, Plus, Trash2, Edit, AlertCircle, Sparkles, Utensils, Search, Zap, Star, X, Settings2, Ban, Check } from 'lucide-react';

interface ScheduleOverrideModalProps {
  schedule: AutoOrderSchedule | null;
  isOpen: boolean;
  onClose: () => void;
}

const ScheduleOverrideModal: React.FC<ScheduleOverrideModalProps> = ({ schedule, isOpen, onClose }) => {
  const { saveOverride, deleteOverride, getOverridesForSchedule, executeScheduleNow, t, language } = useApp();

  const getTodayFormattedDate = (): string => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [targetDate, setTargetDate] = useState<string>(getTodayFormattedDate());
  const [actionType, setActionType] = useState<'modify' | 'skip'>('modify');
  const [overrideTime, setOverrideTime] = useState<string>('08:00');
  const [selectedItem, setSelectedItem] = useState<FoodItem>(INDIAN_FOOD_CATALOG[0]);
  const [quantity, setQuantity] = useState<number>(1);
  const [strategy, setStrategy] = useState<OrderStrategy>('best_value');
  const [notes, setNotes] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  if (!isOpen || !schedule) return null;

  const existingOverrides = getOverridesForSchedule(schedule.id);
  const currentOverrideForDate = existingOverrides.find(o => o.date === targetDate);

  const filteredCatalog = INDIAN_FOOD_CATALOG.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.restaurant.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSaveOverride = () => {
    const override: ScheduleOverride = {
      id: currentOverrideForDate?.id || `override-${Date.now()}`,
      scheduleId: schedule.id,
      date: targetDate,
      isSkipped: actionType === 'skip',
      foodItemId: actionType === 'modify' ? selectedItem.id : undefined,
      foodItemName: actionType === 'modify' ? selectedItem.name : undefined,
      restaurant: actionType === 'modify' ? selectedItem.restaurant : undefined,
      time: actionType === 'modify' ? overrideTime : undefined,
      quantity: actionType === 'modify' ? quantity : undefined,
      strategy: actionType === 'modify' ? strategy : undefined,
      notes: notes || (actionType === 'skip' ? 'Skipped for this date' : 'Custom date override')
    };

    saveOverride(override);
    setNotes('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border-2 border-[#FF5A1F] relative max-h-[90vh] overflow-y-auto text-[#1A1110]">
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-[#4A5568] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1 pr-8 border-b border-[#DAF0F7] pb-4">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-black uppercase text-[#FF5A1F] bg-[#FF5A1F]/10 px-2.5 py-0.5 rounded-full border border-[#FF5A1F]/20">
              {t('override.badge')}
            </span>
            <span className="text-xs font-bold text-[#4A5568]">Slot: {schedule.slotName}</span>
          </div>
          <h3 className="text-2xl font-black text-[#1A1110] flex items-center gap-2 mt-1">
            <Settings2 className="w-6 h-6 text-[#FF5A1F]" />
            {t('override.title')}
          </h3>
          <p className="text-xs text-[#4A5568] font-bold">
            {t('override.defaultSummary').replace('{item}', schedule.foodItemName).replace('{restaurant}', schedule.restaurant).replace('{time}', schedule.time)}
          </p>
        </div>

        {/* Date Selection & Existing Overrides */}
        <div className="space-y-6 pt-4">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#DAF0F7]/40 p-4 rounded-2xl border border-[#B2E2F0]">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-[#4A5568] flex items-center gap-1">
                <Calendar className="w-4 h-4 text-[#FF5A1F]" /> {t('override.selectDate')}
              </label>
              <input
                type="date"
                value={targetDate}
                min={schedule.startDate || getTodayFormattedDate()}
                max={schedule.endDate}
                onChange={e => {
                  setTargetDate(e.target.value);
                  const existing = existingOverrides.find(o => o.date === e.target.value);
                  if (existing) {
                    setActionType(existing.isSkipped ? 'skip' : 'modify');
                    if (existing.time) setOverrideTime(existing.time);
                    if (existing.foodItemId) {
                      const found = INDIAN_FOOD_CATALOG.find(f => f.id === existing.foodItemId);
                      if (found) setSelectedItem(found);
                    }
                    if (existing.quantity) setQuantity(existing.quantity);
                    if (existing.notes) setNotes(existing.notes);
                  }
                }}
                className="w-full p-3 rounded-xl border border-[#B2E2F0] bg-white font-black text-sm text-[#1A1110]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-[#4A5568]">
                {t('override.actionFor').replace('{date}', targetDate)}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setActionType('modify')}
                  className={`p-2.5 rounded-xl font-black text-xs border flex items-center justify-center space-x-1 ${
                    actionType === 'modify'
                      ? 'bg-[#FF5A1F] text-white border-[#FF5A1F] shadow-sm'
                      : 'bg-white text-[#1A1110] border-[#DAF0F7] hover:bg-slate-50'
                  }`}
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>{t('override.btnModify')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActionType('skip')}
                  className={`p-2.5 rounded-xl font-black text-xs border flex items-center justify-center space-x-1 ${
                    actionType === 'skip'
                      ? 'bg-[#C2185B] text-white border-[#C2185B] shadow-sm'
                      : 'bg-white text-[#1A1110] border-[#DAF0F7] hover:bg-slate-50'
                  }`}
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>{t('override.btnSkip')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Form Controls for Modify Action */}
          {actionType === 'modify' ? (
            <div className="space-y-5 bg-white p-4 rounded-2xl border border-[#DAF0F7]">
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-[#4A5568]">{t('override.customTime')}</label>
                  <input
                    type="time"
                    value={overrideTime}
                    onChange={e => setOverrideTime(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#B2E2F0] font-black text-sm bg-slate-50 text-center"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-[#4A5568]">{t('override.quantity')}</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={quantity}
                    onChange={e => setQuantity(parseInt(e.target.value, 10) || 1)}
                    className="w-full p-2.5 rounded-xl border border-[#B2E2F0] font-black text-sm bg-slate-50 text-center"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-[#4A5568]">{t('override.strategy')}</label>
                  <select
                    value={strategy}
                    onChange={e => setStrategy(e.target.value as OrderStrategy)}
                    className="w-full p-2.5 rounded-xl border border-[#B2E2F0] font-black text-xs bg-slate-50"
                  >
                    <option value="best_value">{t('strategy.best_value')}</option>
                    <option value="cheapest">{t('strategy.cheapest')}</option>
                    <option value="highest_rated">{t('strategy.highest_rated')}</option>
                    <option value="fastest">{t('strategy.fastest')}</option>
                  </select>
                </div>
              </div>

              {/* Food Item Selection */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-[#4A5568] flex items-center justify-between">
                  <span>{t('override.chooseFood').replace('{date}', targetDate)}</span>
                  <span className="text-xs font-bold text-[#FF5A1F]">Current: {selectedItem.nativeNames?.[language] || selectedItem.name}</span>
                </label>

                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-[#4A5568]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={t('override.searchPlaceholder')}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#B2E2F0] bg-slate-50 text-xs font-bold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                  {filteredCatalog.map(item => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center space-x-2 ${
                        selectedItem.id === item.id
                          ? 'bg-[#FF5A1F] text-white border-[#FF5A1F] shadow-sm'
                          : 'bg-slate-50 border-[#DAF0F7] hover:bg-[#DAF0F7]/40 text-[#1A1110]'
                      }`}
                    >
                      <img src={item.image} alt={item.name} className="w-10 h-10 rounded-lg object-cover" />
                      <div className="overflow-hidden">
                        <h5 className="text-xs font-black truncate">{item.nativeNames?.[language] || item.name}</h5>
                        <p className="text-[10px] opacity-80 truncate">{item.restaurant}</p>
                        <span className={`text-xs font-black ${selectedItem.id === item.id ? 'text-yellow-200' : 'text-[#FF5A1F]'}`}>₹{item.basePrice}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-[#4A5568]">{t('override.notes')}</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Birthday special, Guest arriving, etc."
                  className="w-full p-2.5 rounded-xl border border-[#B2E2F0] bg-slate-50 text-xs font-semibold"
                />
              </div>

            </div>
          ) : (
            <div className="p-6 bg-rose-50 rounded-2xl border border-rose-200 text-center space-y-2">
              <Ban className="w-8 h-8 text-[#C2185B] mx-auto animate-bounce" />
              <h4 className="text-base font-black text-[#C2185B]">
                {t('override.skipTitle').replace('{date}', targetDate)}
              </h4>
              <p className="text-xs text-[#4A5568] font-semibold max-w-md mx-auto">
                {t('override.skipDesc').replace('{date}', targetDate)}
              </p>
            </div>
          )}

          {/* Save Override Button */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-bold text-[#4A5568]">
              {currentOverrideForDate ? '✏️ Updating Existing Date Override' : '✨ New Date Override'}
            </span>

            <button
              onClick={handleSaveOverride}
              className="px-6 py-2.5 bg-[#16A34A] hover:bg-[#15803D] text-white font-black rounded-xl text-xs shadow-md flex items-center space-x-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{t('override.btnSave').replace('{date}', targetDate)}</span>
            </button>
          </div>

          {/* List of Configured Overrides for this Schedule Slot */}
          <div className="space-y-3 pt-4 border-t border-[#DAF0F7]">
            <h4 className="text-xs font-black uppercase text-[#4A5568] tracking-wider">
              {t('override.activeTitle').replace('{n}', String(existingOverrides.length))}
            </h4>

            {existingOverrides.length === 0 ? (
              <p className="text-xs text-[#4A5568] font-medium italic">{t('override.emptyList')}</p>
            ) : (
              <div className="space-y-2 max-h-44 overflow-y-auto">
                {existingOverrides.map(o => (
                  <div
                    key={o.id}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                      o.isSkipped
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-2 font-black">
                        <span className="font-mono text-[#FF5A1F]">{o.date}</span>
                        <span>{o.isSkipped ? `🚫 ${t('override.skippedDay')}` : `🍔 ${o.foodItemName} (${o.restaurant})`}</span>
                      </div>
                      <p className="text-[11px] font-semibold opacity-90 mt-0.5">
                        {o.isSkipped ? t('override.willNotPlace') : `Time: ${o.time || schedule.time} • Qty: ${o.quantity || 1} • Notes: ${o.notes || 'Custom override'}`}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => executeScheduleNow(schedule.id, o.date)}
                        className="px-2.5 py-1 bg-[#16A34A] text-white rounded-lg text-[10px] font-black hover:bg-[#15803D]"
                        title="Test Run Override Now"
                      >
                        {t('override.runNow')}
                      </button>
                      <button
                        onClick={() => deleteOverride(o.id)}
                        className="p-1 text-[#C2185B] hover:bg-rose-200/50 rounded-lg"
                        title="Delete Override"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};

export const AutoOrderScheduler: React.FC = () => {
  const { schedules, saveSchedule, deleteSchedule, executeScheduleNow, walletBalance, t, accessibilitySettings, language, overrides, getOverridesForSchedule, skipScheduleDate, restoreScheduleDate } = useApp();

  const getTodayFormattedDate = (): string => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [activeSlotIndex, setActiveSlotIndex] = useState<1 | 2 | 3 | 4>(1);
  const [slotSearchQuery, setSlotSearchQuery] = useState('');
  const [selectedFoodItem, setSelectedFoodItem] = useState<FoodItem>(INDIAN_FOOD_CATALOG[0]);
  const [scheduleTime, setScheduleTime] = useState('08:00');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'custom' | 'once'>('daily');
  const [selectedDays, setSelectedDays] = useState<string[]>(['Mon', 'Wed', 'Fri']);
  const [strategy, setStrategy] = useState<OrderStrategy>('best_value');
  const [slotTitle, setSlotTitle] = useState('Breakfast Time');

  // NEW DURATION & RECURRENCE RANGE STATE
  const [duration, setDuration] = useState<ScheduleDuration>('1_month');
  const [startDate, setStartDate] = useState<string>(getTodayFormattedDate());
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Per-Date Override Modal State
  const [activeOverrideSchedule, setActiveOverrideSchedule] = useState<AutoOrderSchedule | null>(null);

  // Shared Schedule Checkout Modal State
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState<boolean>(false);

  const calculatedEndDatePreview = calculateScheduleEndDate(startDate, duration, customEndDate);

  // Filter catalog based on scheduler food search bar using FuzzyMatchEngine
  const filteredCatalog = slotSearchQuery.trim()
    ? INDIAN_FOOD_CATALOG.filter(item => {
        const fuzzy = FuzzyMatchEngine.matchCatalogFoodItem(slotSearchQuery, [item]);
        return fuzzy.score >= 0.50 || item.name.toLowerCase().includes(slotSearchQuery.toLowerCase());
      }).sort((a, b) => {
        const scoreA = FuzzyMatchEngine.matchCatalogFoodItem(slotSearchQuery, [a]).score;
        const scoreB = FuzzyMatchEngine.matchCatalogFoodItem(slotSearchQuery, [b]).score;
        return scoreB - scoreA;
      })
    : INDIAN_FOOD_CATALOG;

  const getSlotSuggestions = (slotIdx: number): FoodItem[] => {
    if (slotIdx === 1) {
      return INDIAN_FOOD_CATALOG.filter(f => ['idli-sambar', 'dosa-masala', 'dosa-podi', 'beverage-filter-coffee', 'pongal-ghee'].includes(f.id));
    }
    if (slotIdx === 2) {
      return INDIAN_FOOD_CATALOG.filter(f => ['biryani-hyderabadi', 'biryani-ambur', 'gujarati-thali', 'biryani-veg-paneer'].includes(f.id));
    }
    if (slotIdx === 3) {
      return INDIAN_FOOD_CATALOG.filter(f => ['chaat-pani-puri', 'pav-bhaji', 'chole-bhature', 'beverage-filter-coffee'].includes(f.id));
    }
    return INDIAN_FOOD_CATALOG.filter(f => ['parotta-kothu', 'pizza-veggie-supreme', 'paneer-butter-masala', 'chinese-fried-rice'].includes(f.id));
  };

  const formatDurationLabel = (dur?: ScheduleDuration): string => {
    if (dur === 'today_only') return t('scheduler.durationTodayAlone');
    if (!dur || dur === '1_month') return t('scheduler.duration1Month');
    if (dur === '1_week') return t('scheduler.duration1Week');
    if (dur === '3_months') return t('scheduler.duration3Months');
    if (dur === 'custom') return t('scheduler.durationCustom');
    if (dur === 'indefinite') return t('scheduler.durationIndefinite');
    return dur;
  };

  const presetSlots = [
    { index: 1 as const, name: t('scheduler.slotBreakfast'), time: '08:00', defaultFood: INDIAN_FOOD_CATALOG[0] },
    { index: 2 as const, name: t('scheduler.slotLunch'), time: '13:00', defaultFood: INDIAN_FOOD_CATALOG[4] },
    { index: 3 as const, name: t('scheduler.slotSnacks'), time: '17:00', defaultFood: INDIAN_FOOD_CATALOG[9] },
    { index: 4 as const, name: t('scheduler.slotDinner'), time: '20:30', defaultFood: INDIAN_FOOD_CATALOG[5] }
  ];

  const handleSelectSlot = (slot: typeof presetSlots[0]) => {
    setActiveSlotIndex(slot.index);
    setSlotTitle(slot.name);
    setScheduleTime(slot.time);
    setSelectedFoodItem(slot.defaultFood);
  };

  const handleSaveCurrentSchedule = () => {
    setIsCheckoutModalOpen(true);
  };

  return (
    <div className="space-y-8">
      
      {/* Scheduler Header */}
      <div className={`p-8 rounded-3xl shadow-lg transition-all ${
        accessibilitySettings.highContrast
          ? 'bg-black text-white border-4 border-yellow-400'
          : 'bg-[#DAF0F7] text-[#1A1110] border-2 border-[#B2E2F0]'
      }`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black flex items-center gap-2 text-[#1A1110]">
              <Clock className="w-8 h-8 text-[#FF5A1F] animate-pulse" />
              {t('scheduler.title')}
            </h2>
            <p className="text-sm font-semibold text-[#4A5568] max-w-xl">
              {t('scheduler.subtitle')}
            </p>
          </div>

          {/* Wallet Balance Badge */}
          <div className="bg-white text-[#1A1110] p-4 rounded-2xl border border-[#B2E2F0] flex items-center space-x-3 shadow-sm">
            <Wallet className="w-6 h-6 text-[#16A34A]" />
            <div>
              <span className="text-[10px] text-[#4A5568] uppercase font-black tracking-wider block">{t('wallet.balance')}</span>
              <span className="text-xl font-black text-[#FF5A1F]">₹{walletBalance.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 PRESET SCHEDULE SLOTS NAVIGATION */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase text-[#4A5568] tracking-wider">{t('scheduler.selectSlotHeader')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {presetSlots.map(slot => (
            <button
              key={slot.index}
              onClick={() => handleSelectSlot(slot)}
              className={`p-4 rounded-2xl font-black text-left transition-all border flex flex-col justify-between ${
                activeSlotIndex === slot.index
                  ? 'bg-[#FF5A1F] text-white border-[#FF5A1F] shadow-lg scale-105'
                  : 'bg-white text-[#1A1110] border-[#DAF0F7] hover:border-[#FF5A1F]/50 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs uppercase font-extrabold ${activeSlotIndex === slot.index ? 'text-yellow-200' : 'text-[#FF5A1F]'}`}>Slot {slot.index}</span>
                <Clock className="w-4 h-4 opacity-80" />
              </div>
              <span className="text-base font-black mt-2">{slot.name}</span>
              <span className="text-xs font-mono font-bold opacity-90">{slot.time}</span>
            </button>
          ))}
        </div>
      </div>

      {/* TIME-BASED AUTO-SUGGESTIONS FOR ACTIVE SLOT */}
      <div className="bg-[#DAF0F7]/50 p-5 rounded-3xl border-2 border-[#B2E2F0] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-[#FF5A1F] animate-bounce" />
            <h4 className="text-sm font-black text-[#1A1110] uppercase tracking-wider">
              {language === 'ta'
                ? `நேரம் ${activeSlotIndex} க்கான பரிந்துரைகள் (${presetSlots[activeSlotIndex - 1].name}):`
                : language === 'hi'
                ? `स्लॉट ${activeSlotIndex} के लिए अनुशंसित सुझाव (${presetSlots[activeSlotIndex - 1].name}):`
                : `Recommended Suggestions for Slot ${activeSlotIndex} (${presetSlots[activeSlotIndex - 1].name}):`}
            </h4>
          </div>
          <span className="text-xs text-[#FF5A1F] font-extrabold bg-[#FF5A1F]/10 px-2.5 py-1 rounded-full">
            {t('scheduler.timeSensitive')}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {getSlotSuggestions(activeSlotIndex).map(sug => (
            <div
              key={sug.id}
              onClick={() => setSelectedFoodItem(sug)}
              className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center space-x-3 ${
                selectedFoodItem.id === sug.id
                  ? 'bg-[#FF5A1F] text-white border-[#FF5A1F] shadow-md scale-105'
                  : 'bg-white text-[#1A1110] border-[#DAF0F7] hover:bg-slate-50 shadow-sm'
              }`}
            >
              <img src={sug.image} alt={sug.name} className="w-12 h-12 rounded-xl object-cover" />
              <div className="overflow-hidden">
                <h5 className="text-xs font-black truncate">{sug.name}</h5>
                <p className="text-[10px] opacity-80 truncate">{sug.restaurant}</p>
                <span className={`text-xs font-black ${selectedFoodItem.id === sug.id ? 'text-yellow-200' : 'text-[#FF5A1F]'}`}>₹{sug.basePrice}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SCHEDULE BUILDER FORM */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border-2 border-[#DAF0F7] shadow-xl space-y-6 text-[#1A1110]">
        
        <div className="flex items-center justify-between border-b border-[#DAF0F7] pb-4">
          <h3 className="text-xl font-black text-[#1A1110] flex items-center gap-2">
            <Utensils className="w-5 h-5 text-[#FF5A1F]" />
            {t('scheduler.configureSlot')} {presetSlots[activeSlotIndex - 1].name}
          </h3>
          <span className="text-xs font-black text-[#16A34A] bg-[#16A34A]/10 px-3 py-1 rounded-full border border-[#16A34A]/30">
            {t('scheduler.autoDebitEnabled')}
          </span>
        </div>

        {/* Form Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Time Selector */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-[#4A5568]">
              {t('scheduler.timeField')}
            </label>
            <input
              type="time"
              value={scheduleTime}
              onChange={e => setScheduleTime(e.target.value)}
              className="w-full p-3.5 rounded-2xl border border-[#B2E2F0] bg-slate-50 text-[#1A1110] font-black text-lg text-center focus:outline-none focus:border-[#FF5A1F]"
            />
          </div>

          {/* Frequency Selector */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-[#4A5568]">
              {t('scheduler.frequencyField')}
            </label>
            <select
              value={frequency}
              onChange={e => setFrequency(e.target.value as any)}
              className="w-full p-3.5 rounded-2xl border border-[#B2E2F0] bg-slate-50 text-[#1A1110] font-black text-sm focus:outline-none focus:border-[#FF5A1F]"
            >
              <option value="daily">{t('scheduler.daily')}</option>
              <option value="weekly">{t('scheduler.weekly')}</option>
              <option value="once">{t('scheduler.once')}</option>
            </select>
          </div>

          {/* DURATION SELECTOR */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-[#4A5568] flex items-center justify-between">
              <span>{t('scheduler.recurrenceDuration')}</span>
              <span className="text-[#FF5A1F] font-bold text-[11px]">{t('scheduler.extendedRange')}</span>
            </label>
            <select
              value={duration}
              onChange={e => setDuration(e.target.value as ScheduleDuration)}
              className="w-full p-3.5 rounded-2xl border border-[#B2E2F0] bg-slate-50 text-[#1A1110] font-black text-sm focus:outline-none focus:border-[#FF5A1F]"
            >
              <option value="today_only">{t('scheduler.durationTodayAlone')}</option>
              <option value="1_week">{t('scheduler.duration1Week')}</option>
              <option value="1_month">{t('scheduler.duration1Month')}</option>
              <option value="3_months">{t('scheduler.duration3Months')}</option>
              <option value="custom">{t('scheduler.durationCustom')}</option>
              <option value="indefinite">{t('scheduler.durationIndefinite')}</option>
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

        {/* Start Date & Custom End Date Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#DAF0F7]/30 p-4 rounded-2xl border border-[#B2E2F0]">
          <div className="space-y-1">
            <label className="text-xs font-black uppercase text-[#4A5568] flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#FF5A1F]" /> {t('scheduler.startDate')}
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
              <label className="text-xs font-black uppercase text-[#4A5568] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#FF5A1F]" /> {t('scheduler.customEndDate')}
              </label>
              <input
                type="date"
                value={customEndDate}
                min={startDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#B2E2F0] bg-white font-bold text-xs"
              />
            </div>
          ) : (
            <div className="space-y-1 flex flex-col justify-center">
              <span className="text-[10px] uppercase font-black text-[#4A5568]">{t('scheduler.calculatedRange')}</span>
              <div className="p-2.5 bg-white rounded-xl border border-[#B2E2F0] text-xs font-black text-[#16A34A] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                <span>
                  {duration === 'indefinite'
                    ? (language === 'ta'
                        ? `${startDate} அன்று தொடங்குகிறது • தொடர்ந்து செயல்படும்`
                        : language === 'hi'
                        ? `${startDate} से शुरू • लगातार जारी रहेगा`
                        : `Starts ${startDate} • Runs Indefinitely`)
                    : (language === 'ta'
                        ? `${startDate} முதல் ${calculatedEndDatePreview || 'N/A'} வரை செயல்படும் (${formatDurationLabel(duration)})`
                        : language === 'hi'
                        ? `${startDate} से ${calculatedEndDatePreview || 'N/A'} तक सक्रिय (${formatDurationLabel(duration)})`
                        : `Active ${startDate} to ${calculatedEndDatePreview || 'N/A'} (${formatDurationLabel(duration)})`)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* DEDICATED SEARCH BAR INSIDE SCHEDULER */}
        <div className="space-y-3 pt-2">
          <label className="text-xs font-black uppercase text-[#4A5568] flex items-center justify-between">
            <span>{t('scheduler.searchCatalogLabel')}</span>
            <span className="text-xs text-[#FF5A1F] font-extrabold">{filteredCatalog.length} {t('scheduler.itemsAvailable')}</span>
          </label>

          <div className="relative">
            <Search className="absolute left-4 top-3.5 w-4 h-4 text-[#4A5568]" />
            <input
              type="text"
              value={slotSearchQuery}
              onChange={e => setSlotSearchQuery(e.target.value)}
              placeholder={t('scheduler.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-3 rounded-2xl border border-[#B2E2F0] bg-slate-50 text-[#1A1110] font-bold text-sm focus:outline-none focus:border-[#FF5A1F]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto p-1">
            {filteredCatalog.map(item => (
              <div
                key={item.id}
                onClick={() => setSelectedFoodItem(item)}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center space-x-3 ${
                  selectedFoodItem.id === item.id
                    ? 'bg-[#FF5A1F] text-white border-[#FF5A1F] shadow-md'
                    : 'bg-slate-50 border-[#DAF0F7] hover:bg-[#DAF0F7]/50 text-[#1A1110]'
                }`}
              >
                <img src={item.image} alt={item.name} className="w-12 h-12 rounded-xl object-cover" />
                <div className="overflow-hidden">
                  <h4 className="text-xs font-black truncate">{item.name}</h4>
                  <p className="text-[10px] opacity-80 truncate">{item.restaurant}</p>
                  <span className={`text-xs font-black ${selectedFoodItem.id === item.id ? 'text-yellow-200' : 'text-[#FF5A1F]'}`}>₹{item.basePrice}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Item Summary & Save Button */}
        <div className="p-4 bg-[#DAF0F7]/40 rounded-2xl border border-[#B2E2F0] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <img src={selectedFoodItem.image} alt={selectedFoodItem.name} className="w-12 h-12 rounded-xl object-cover" />
            <div>
              <span className="text-xs text-[#FF5A1F] font-extrabold uppercase block">{t('scheduler.selectedFoodItem')}</span>
              <h4 className="text-base font-black text-[#1A1110]">{selectedFoodItem.name}</h4>
              <p className="text-xs text-[#4A5568] font-bold">{selectedFoodItem.restaurant} • ₹{selectedFoodItem.basePrice}</p>
            </div>
          </div>

          <button
            onClick={handleSaveCurrentSchedule}
            className="w-full sm:w-auto px-8 py-3 bg-[#FF5A1F] hover:bg-[#E04812] text-white font-black rounded-2xl shadow-lg shadow-[#FF5A1F]/30 transition-transform active:scale-95 flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Plus className="w-5 h-5 text-white" />
            <span>{t('scheduler.saveScheduleWithDuration')} ({formatDurationLabel(duration)})</span>
          </button>
        </div>

      </div>

      {/* ACTIVE SCHEDULE CARDS LIST */}
      <div className="space-y-4">
        <h3 className="text-lg font-black text-[#1A1110] flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
          Active Configured Schedules ({schedules.length})
        </h3>

        {schedules.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-[#DAF0F7] text-[#4A5568] font-bold text-sm shadow-sm">
            No active schedules created yet. Configure a slot above and save!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {schedules.map(sch => {
              const schOverrides = getOverridesForSchedule(sch.id);
              return (
                <div key={sch.id} className="bg-white p-6 rounded-3xl border border-[#DAF0F7] shadow-md flex flex-col justify-between space-y-4 text-[#1A1110]">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-black uppercase text-[#FF5A1F]">{sch.slotName}</span>
                        <span className="text-[10px] font-black uppercase bg-[#16A34A]/10 text-[#16A34A] px-2 py-0.5 rounded-full border border-[#16A34A]/20">
                          {formatDurationLabel(sch.duration)}
                        </span>
                      </div>
                      <h4 className="text-lg font-black text-[#1A1110] mt-0.5">{sch.foodItemName}</h4>
                      <p className="text-xs text-[#4A5568] font-bold">{sch.restaurant}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-xl font-black font-mono text-[#16A34A]">{sch.time}</span>
                      <span className="block text-[10px] uppercase font-extrabold text-[#4A5568]">{sch.frequency}</span>
                    </div>
                  </div>

                  {/* Recurrence Range & Overrides Count Badge */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-[#DAF0F7] space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-[#4A5568]">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-[#FF5A1F]" />
                        Range: {sch.startDate || 'Started'} → {sch.endDate || 'Until Cancelled'}
                      </span>
                    </div>

                    {/* Excluded / Skipped Dates Badges */}
                    {((sch.excludedDates && sch.excludedDates.length > 0) || schOverrides.some(o => o.isSkipped)) && (
                      <div className="space-y-1.5 pt-1 border-t border-slate-200">
                        <span className="text-[10px] font-black uppercase text-[#C2185B] block">🚫 Skipped Single Dates:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {Array.from(new Set([...(sch.excludedDates || []), ...schOverrides.filter(o => o.isSkipped).map(o => o.date)])).map(skDate => (
                            <span key={skDate} className="bg-rose-100 text-rose-800 text-[11px] font-black px-2 py-0.5 rounded-lg border border-rose-300 flex items-center gap-1">
                              <span>{skDate}</span>
                              <button
                                onClick={() => restoreScheduleDate(sch.id, skDate)}
                                className="text-rose-600 hover:text-rose-900 font-bold ml-1 hover:underline cursor-pointer"
                                title="Restore order for this date"
                              >
                                ↺ Restore
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between pt-2 border-t border-[#DAF0F7] gap-2">
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => {
                          const tmr = (() => {
                            const d = new Date();
                            d.setDate(d.getDate() + 1);
                            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                          })();

                          const isTmrSkipped = (sch.excludedDates && sch.excludedDates.includes(tmr)) || schOverrides.some(o => o.date === tmr && o.isSkipped);
                          if (isTmrSkipped) {
                            restoreScheduleDate(sch.id, tmr);
                          } else {
                            skipScheduleDate(sch.id, tmr);
                          }
                        }}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-[#C2185B] rounded-xl font-black text-xs border border-rose-200 flex items-center space-x-1 cursor-pointer transition-colors"
                      >
                        <Ban className="w-3.5 h-3.5 text-[#C2185B]" />
                        <span>
                          {(() => {
                            const tmr = (() => {
                              const d = new Date();
                              d.setDate(d.getDate() + 1);
                              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                            })();
                            const isSkipped = (sch.excludedDates && sch.excludedDates.includes(tmr)) || schOverrides.some(o => o.date === tmr && o.isSkipped);
                            return isSkipped ? '↺ Restore Tomorrow' : '🚫 Skip Tomorrow';
                          })()}
                        </span>
                      </button>

                      <button
                        onClick={() => setActiveOverrideSchedule(sch)}
                        className="px-3 py-1.5 bg-[#DAF0F7] hover:bg-[#B2E2F0] text-[#1A1110] rounded-xl font-black text-xs border border-[#B2E2F0] flex items-center space-x-1 cursor-pointer"
                      >
                        <Settings2 className="w-3.5 h-3.5 text-[#FF5A1F]" />
                        <span>Customize Dates</span>
                      </button>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => executeScheduleNow(sch.id)}
                        className="px-3 py-1.5 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-xl font-black text-xs shadow-md flex items-center space-x-1 cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5 text-yellow-200" />
                        <span>Run Now</span>
                      </button>

                      <button
                        onClick={() => deleteSchedule(sch.id)}
                        className="p-1.5 text-[#C2185B] bg-[#C2185B]/10 hover:bg-[#C2185B]/20 rounded-xl transition-colors cursor-pointer"
                        title="Delete Schedule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PER-DATE CUSTOMIZATION OVERRIDE MODAL */}
      <ScheduleOverrideModal
        schedule={activeOverrideSchedule}
        isOpen={!!activeOverrideSchedule}
        onClose={() => setActiveOverrideSchedule(null)}
      />

      {/* SHARED SCHEDULE CHECKOUT FLOW MODAL */}
      <ScheduleCheckoutModal
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        items={[{ foodItem: selectedFoodItem, quantity: 1 }]}
        initialSlotName={`${presetSlots[activeSlotIndex - 1].name} Schedule`}
        initialTime={scheduleTime}
      />

    </div>
  );
};
