import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, MapPin, Clock, ShieldCheck, PhoneCall, Bike, CheckCircle2, Volume2, Sparkles, Navigation } from 'lucide-react';
import { LiveGPSMapTracker } from './LiveGPSMapTracker';

export const LiveOrderTrackingModal: React.FC = () => {
  const { activeLiveOrder, setActiveLiveOrder, t, speakText, userLocation } = useApp();
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (activeLiveOrder) {
      setSecondsLeft(activeLiveOrder.remainingSeconds);

      // Speak order confirmation status in user's language
      const msg = `${activeLiveOrder.foodName} ${t('tracking.orderPlaced')} via ${activeLiveOrder.platformName}. ${t('tracking.deliveringTo')}: ${userLocation.area}, ${userLocation.city}.`;
      speakText(msg);
    }
  }, [activeLiveOrder]);

  // Countdown timer effect
  useEffect(() => {
    if (!activeLiveOrder || secondsLeft <= 0) return;

    const interval = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeLiveOrder, secondsLeft]);

  if (!activeLiveOrder) return null;

  const totalSeconds = activeLiveOrder.totalEtaMinutes * 60;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const stages = [
    { key: 'placed', label: t('tracking.stage1'), icon: '📝' },
    { key: 'preparing', label: t('tracking.stage2'), icon: '🍳' },
    { key: 'on_the_way', label: t('tracking.stage3'), icon: '🛵' },
    { key: 'delivered', label: t('tracking.stage4'), icon: '🎉' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border-2 border-orange-500 relative space-y-5 my-auto max-h-[92vh] overflow-y-auto">
        
        {/* Header Close */}
        <button
          onClick={() => setActiveLiveOrder(null)}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 z-30 shadow-md"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 rounded-2xl">
            <Bike className="w-7 h-7 animate-bounce" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              {t('tracking.title')}
            </h2>
            <p className="text-xs text-emerald-600 font-bold">
              #{activeLiveOrder.orderId} • {activeLiveOrder.platformName} (Auto-Debited ₹{activeLiveOrder.amountPaid})
            </p>
          </div>
        </div>

        {/* 🗺️ INTERACTIVE LIVE GPS MAP TRACKER (RESTAURANT -> DRIVER -> USER) */}
        <LiveGPSMapTracker
          userLat={userLocation.latitude}
          userLng={userLocation.longitude}
          addressName={userLocation.addressName}
          restaurantName={activeLiveOrder.restaurant}
          remainingSeconds={secondsLeft}
          totalSeconds={totalSeconds}
        />

        {/* Live GPS Countdown Timer Box */}
        <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white p-5 rounded-3xl text-center shadow-lg relative overflow-hidden flex items-center justify-between px-6">
          <div className="text-left space-y-0.5">
            <span className="text-xs uppercase font-bold tracking-wider text-orange-100 block">
              {t('tracking.eta')}
            </span>
            <span className="text-xs font-bold text-orange-100">
              {minutes} {t('tracking.minsRemaining')}
            </span>
          </div>

          <div className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-white drop-shadow-md">
            {timeFormatted}
          </div>
        </div>

        {/* Progress Stages Bar */}
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-2 text-center">
            {stages.map((st, idx) => (
              <div key={st.key} className="flex flex-col items-center">
                <span className="text-xl mb-1">{st.icon}</span>
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 leading-tight">
                  {st.label}
                </span>
              </div>
            ))}
          </div>

          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-emerald-500 h-full w-3/4 animate-pulse" />
          </div>
        </div>

        {/* Delivery Driver Details */}
        <div className="flex items-center justify-between p-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 text-xs">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-emerald-600 text-white font-black rounded-full flex items-center justify-center text-sm shadow-md">
              {activeLiveOrder.driverName.charAt(0)}
            </div>
            <div>
              <span className="font-extrabold text-slate-900 dark:text-white block">{activeLiveOrder.driverName}</span>
              <span className="text-slate-500">{t('tracking.driver')} • ⭐ 4.9</span>
            </div>
          </div>

          <a
            href={`tel:${activeLiveOrder.driverPhone}`}
            className="p-2.5 bg-emerald-600 text-white rounded-xl font-bold flex items-center space-x-1 shadow-md hover:bg-emerald-700"
          >
            <PhoneCall className="w-4 h-4" />
            <span className="hidden sm:inline">Call</span>
          </a>
        </div>

        {/* Speak Status Audio Button */}
        <button
          onClick={() => speakText(`${activeLiveOrder.foodName} ${t('tracking.orderPlaced')} via ${activeLiveOrder.platformName}. ${t('tracking.eta')}: ${minutes} ${t('tracking.minsRemaining')}.`)}
          className="w-full bg-slate-900 text-white hover:bg-slate-800 font-bold py-3 rounded-2xl flex items-center justify-center space-x-2 text-xs shadow-md"
        >
          <Volume2 className="w-4 h-4 text-yellow-300" />
          <span>Speak Live Delivery Status Audio</span>
        </button>

      </div>
    </div>
  );
};
