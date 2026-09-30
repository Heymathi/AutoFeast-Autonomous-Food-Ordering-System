import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { ToastItem } from '../types';
import { CheckCircle2, AlertCircle, AlertTriangle, Volume2, Sparkles, X } from 'lucide-react';

interface ToastCardProps {
  toast: ToastItem;
  onRemove: (id: string) => void;
}

const ToastCard: React.FC<ToastCardProps> = ({ toast, onRemove }) => {
  const { accessibilitySettings } = useApp();
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
  }, [toast.id, duration, isPaused, onRemove]);

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
          {toast.message}
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

  // Max 3 visible toasts
  const visibleToasts = toasts.slice(-3);

  return (
    <div className="fixed top-4 sm:top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2.5 max-w-[min(92vw,480px)] w-full pointer-events-none px-2 pt-[env(safe-area-inset-top)]">
      {visibleToasts.map(t => (
        <ToastCard key={t.id} toast={t} onRemove={removeToast} />
      ))}
    </div>
  );
};
