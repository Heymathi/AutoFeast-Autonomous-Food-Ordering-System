import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { formatLocationPlace } from '../services/locationService';
import { ToastItem } from '../types';
import { CheckCircle2, AlertCircle, AlertTriangle, Volume2, Sparkles, X } from 'lucide-react';

interface ToastCardProps {
  toast: ToastItem;
  onRemove: (id: string) => void;
}

const ToastCard: React.FC<ToastCardProps> = ({ toast, onRemove }) => {
  const { accessibilitySettings, userLocation, language } = useApp();
  const [isPaused, setIsPaused] = useState(false);
  const duration = toast.duration || (toast.type === 'error' ? 7000 : 5000);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isPaused) {
      timerRef.current = setTimeout(() => {
        onRemove(toast.id);
      }, duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id, toast.updatedAt, duration, isPaused, onRemove]);

  let displayMessage = toast.message || '';

  // 1. Process explicit i18nParams if provided
  if (toast.i18nParams) {
    Object.entries(toast.i18nParams).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        displayMessage = displayMessage.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v).trim());
      }
    });
  }

  // 2. Ensure {area} and {city} placeholders are ALWAYS interpolated if they remain
  if (displayMessage.includes('{area}') || displayMessage.includes('{city}')) {
    let resolvedArea = '';
    let resolvedCity = '';

    if (toast.i18nParams?.area && String(toast.i18nParams.area).trim() !== '') {
      resolvedArea = String(toast.i18nParams.area).trim();
    }
    if (toast.i18nParams?.city && String(toast.i18nParams.city).trim() !== '') {
      resolvedCity = String(toast.i18nParams.city).trim();
    }

    if (!resolvedArea && userLocation?.area && userLocation.area.trim() !== '') {
      resolvedArea = userLocation.area.trim();
    }
    if (!resolvedCity && userLocation?.city && userLocation.city.trim() !== '') {
      resolvedCity = userLocation.city.trim();
    }

    // Try reading directly from localStorage fallback
    if (!resolvedArea || !resolvedCity) {
      try {
        const stored = typeof window !== 'undefined' ? localStorage.getItem('smart_food_user_location') : null;
        if (stored) {
          const parsed = JSON.parse(stored);
          if (!resolvedArea && parsed?.area) resolvedArea = parsed.area.trim();
          if (!resolvedCity && parsed?.city) resolvedCity = parsed.city.trim();
          if (!resolvedArea && parsed?.addressName) {
            resolvedArea = parsed.addressName.split(',')[0]?.trim() || '';
          }
        }
      } catch (e) {}
    }

    const place = formatLocationPlace({ area: resolvedArea, city: resolvedCity }, language);
    if (resolvedArea && resolvedCity && resolvedArea.toLowerCase() !== resolvedCity.toLowerCase()) {
      displayMessage = displayMessage
        .replace(/\{area\}/g, resolvedArea)
        .replace(/\{city\}/g, resolvedCity);
    } else {
      displayMessage = displayMessage
        .replace(/\{area\}[,\s]*\{city\}/g, place)
        .replace(/\{area\}/g, place)
        .replace(/\{city\}/g, place);
    }
  }

  const currentTheme =
    accessibilitySettings.themeMode ||
    (accessibilitySettings.highContrast ? 'high-contrast' : 'light');

  const getStyleClasses = () => {
    if (currentTheme === 'high-contrast') {
      return 'bg-black text-yellow-300 border-4 border-yellow-400';
    }
    if (currentTheme === 'dark') {
      return 'bg-slate-900 text-white border-2 border-slate-700 shadow-2xl';
    }

    switch (toast.type) {
      case 'success':
        return 'bg-emerald-900 text-white border-2 border-emerald-500 shadow-2xl';
      case 'error':
        return 'bg-rose-950 text-white border-2 border-rose-500 shadow-2xl';
      case 'warning':
        return 'bg-amber-950 text-amber-100 border-2 border-amber-500 shadow-2xl';
      case 'info':
      default:
        return 'bg-[#1A1110] text-white border-2 border-[#FF5A1F] shadow-2xl';
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />;
      case 'info':
      default:
        return <Sparkles className="w-5 h-5 text-[#FF5A1F] shrink-0 animate-pulse" />;
    }
  };

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
      className={`pointer-events-auto w-full p-3.5 sm:p-4 rounded-2xl flex items-center justify-between gap-3 transition-all duration-300 transform animate-fadeIn shadow-2xl ${getStyleClasses()}`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="p-2 rounded-xl bg-white/10 shrink-0">
          {getIcon()}
        </div>
        <p className="text-xs sm:text-sm font-black leading-snug break-words flex-1 text-left">
          {displayMessage}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onRemove(toast.id)}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer shrink-0"
        aria-label="Dismiss Notification"
        title="Dismiss Notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const CenteredToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (!toasts || toasts.length === 0) return null;

  // Max 1 toast per message key, max 3 visible toasts of distinct keys
  const uniqueToasts: ToastItem[] = [];
  const seenKeys = new Set<string>();

  for (const t of toasts) {
    const itemKey = t.key || t.message;
    if (!seenKeys.has(itemKey)) {
      seenKeys.add(itemKey);
      uniqueToasts.push(t);
    }
    if (uniqueToasts.length >= 3) break;
  }

  return (
    <div className="fixed top-4 sm:top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2.5 max-w-[min(92vw,480px)] w-full pointer-events-none px-2 pt-[env(safe-area-inset-top)]">
      {uniqueToasts.map(t => (
        <ToastCard key={t.id} toast={t} onRemove={removeToast} />
      ))}
    </div>
  );
};
