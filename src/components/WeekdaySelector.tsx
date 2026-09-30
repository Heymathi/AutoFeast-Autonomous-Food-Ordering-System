import React from 'react';
import { useApp } from '../context/AppContext';
import { Calendar, Check } from 'lucide-react';

export interface WeekdaySelectorProps {
  selectedDays: string[];
  onChange: (days: string[]) => void;
  error?: string | null;
  className?: string;
}

export const ALL_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const WEEKDAY_LABELS: Record<string, { en: string; ta: string; hi: string }> = {
  Mon: { en: 'Mon', ta: 'திங்கள்', hi: 'सोम' },
  Tue: { en: 'Tue', ta: 'செவ்வாய்', hi: 'मंगल' },
  Wed: { en: 'Wed', ta: 'புதன்', hi: 'बुध' },
  Thu: { en: 'Thu', ta: 'வியாழன்', hi: 'गुरु' },
  Fri: { en: 'Fri', ta: 'வெள்ளி', hi: 'शुक्र' },
  Sat: { en: 'Sat', ta: 'சனி', hi: 'शनि' },
  Sun: { en: 'Sun', ta: 'ஞாயிறு', hi: 'रवि' }
};

export const WeekdaySelector: React.FC<WeekdaySelectorProps> = ({
  selectedDays,
  onChange,
  error,
  className = ''
}) => {
  const { language, t } = useApp();

  const toggleDay = (day: string) => {
    const exists = selectedDays.includes(day);
    if (exists) {
      onChange(selectedDays.filter(d => d !== day));
    } else {
      onChange([...selectedDays, day]);
    }
  };

  const selectPreset = (type: 'weekdays' | 'weekends' | 'all') => {
    if (type === 'weekdays') {
      onChange(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    } else if (type === 'weekends') {
      onChange(['Sat', 'Sun']);
    } else if (type === 'all') {
      onChange([...ALL_WEEKDAYS]);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header & Quick Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-black uppercase tracking-wider text-[#4A5568] flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-[#FF5A1F]" />
          <span>{t('chooseDays')}</span>
        </label>

        <div className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => selectPreset('weekdays')}
            className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
              selectedDays.length === 5 && !selectedDays.includes('Sat') && !selectedDays.includes('Sun')
                ? 'bg-[#FF5A1F] text-white shadow-sm'
                : 'bg-[#DAF0F7] hover:bg-[#B2E2F0] text-[#1A1110]'
            }`}
          >
            {t('presetWeekdays')}
          </button>
          <button
            type="button"
            onClick={() => selectPreset('weekends')}
            className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
              selectedDays.length === 2 && selectedDays.includes('Sat') && selectedDays.includes('Sun')
                ? 'bg-[#FF5A1F] text-white shadow-sm'
                : 'bg-[#DAF0F7] hover:bg-[#B2E2F0] text-[#1A1110]'
            }`}
          >
            {t('presetWeekends')}
          </button>
          <button
            type="button"
            onClick={() => selectPreset('all')}
            className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
              selectedDays.length === 7
                ? 'bg-[#FF5A1F] text-white shadow-sm'
                : 'bg-[#DAF0F7] hover:bg-[#B2E2F0] text-[#1A1110]'
            }`}
          >
            {t('presetAllDays')}
          </button>
        </div>
      </div>

      {/* 7 Localized Day Chips */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {ALL_WEEKDAYS.map(day => {
          const isSelected = selectedDays.includes(day);
          const label = WEEKDAY_LABELS[day]?.[language] || day;

          return (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={`py-2 px-1 rounded-2xl text-xs font-black flex flex-col items-center justify-center transition-all cursor-pointer border-2 ${
                isSelected
                  ? 'bg-[#FF5A1F] text-white border-[#FF5A1F] shadow-md scale-[1.02]'
                  : 'bg-white text-[#1A1110] border-slate-200 hover:border-[#FF5A1F]/40'
              }`}
            >
              <span>{label}</span>
              {isSelected && <Check className="w-3 h-3 mt-0.5 text-white" />}
            </button>
          );
        })}
      </div>

      {/* Minimum 1 Day Validation Warning */}
      {selectedDays.length === 0 && (
        <p className="text-xs font-bold text-[#C2185B] bg-[#C2185B]/10 p-2 rounded-xl border border-[#C2185B]/20 flex items-center gap-1">
          ⚠️ {t('pickOneDay')}
        </p>
      )}

      {error && (
        <p className="text-xs font-bold text-[#C2185B]">{error}</p>
      )}
    </div>
  );
};
