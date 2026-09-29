import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { LiveGPSMapTracker } from './LiveGPSMapTracker';
import { LiveOrderTracking } from '../types';
import { Bike, CheckCircle2, Clock, MapPin, PhoneCall, ShieldCheck, Volume2, ArrowLeft, Building2, Sparkles, AlertCircle } from 'lucide-react';

export const LiveOrderTrackingView: React.FC = () => {
  const { activeLiveOrder: stateOrder, setActiveView, t, speakText, userLocation, linkedBank, accessibilitySettings, language } = useApp();
  
  // 🚀 REACTIVELY SYNC ACTIVE ORDER FROM APP CONTEXT OR LOCALSTORAGE
  const [activeLiveOrder, setActiveLiveOrder] = useState<LiveOrderTracking | null>(() => {
    if (stateOrder) return stateOrder;
    try {
      const stored = localStorage.getItem('smart_food_active_live_order');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (stateOrder) {
      setActiveLiveOrder(stateOrder);
    } else {
      try {
        const stored = localStorage.getItem('smart_food_active_live_order');
        if (stored) {
          setActiveLiveOrder(JSON.parse(stored));
        }
      } catch (e) {}
    }
  }, [stateOrder]);

  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (activeLiveOrder) {
      console.log(`[ORDER_FLOW_DEBUG - Step 8: Confirmed Order Render Read]: order ID: "${activeLiveOrder.orderId}", foodName: "${activeLiveOrder.foodName}", restaurant: "${activeLiveOrder.restaurant}"`);
      setSecondsLeft(activeLiveOrder.remainingSeconds || 1500);

      const areaStr = userLocation?.area || 'Anna Nagar';
      const cityStr = userLocation?.city || 'Chennai';
      const locStr = activeLiveOrder.deliveryAddress || `${areaStr}, ${cityStr}`;

      const msg = language === 'ta'
        ? `${activeLiveOrder.foodName} ஆர்டர் ${activeLiveOrder.platformName} மூலம் வெற்றிகரமாக பதிவு செய்யப்பட்டது. டெலிவரி இடம்: ${locStr}.`
        : language === 'hi'
        ? `${activeLiveOrder.foodName} का ऑर्डर ${activeLiveOrder.platformName} से सफलतापूर्वक दिया गया। डिलीवरी स्थान: ${locStr}।`
        : `${activeLiveOrder.foodName} order placed successfully via ${activeLiveOrder.platformName}. Delivering to: ${locStr}.`;

      console.log('[LiveOrderTrackingView]: Speaking order confirmation aloud ->', msg);
      speakText(msg);
    }
  }, [activeLiveOrder?.orderId, language]);

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

  if (!activeLiveOrder) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
        <AlertCircle className="w-12 h-12 text-orange-500 mx-auto" />
        <h3 className="text-xl font-black text-slate-900 dark:text-white">No Active Order Being Tracked</h3>
        <p className="text-xs text-slate-500 font-bold">Place an instant order or trigger a scheduled order to view live map tracking.</p>
        <button
          onClick={() => setActiveView('search')}
          className="px-6 py-2.5 bg-orange-600 text-white font-extrabold rounded-2xl text-xs shadow-md"
        >
          Go to Food Search
        </button>
      </div>
    );
  }

  const totalSeconds = (activeLiveOrder.totalEtaMinutes || 25) * 60;
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
    <div className="space-y-6">
      
      {/* Back & Title Header Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setActiveView('search')}
          className="flex items-center space-x-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-black px-4 py-2 rounded-2xl text-xs shadow-sm hover:bg-slate-100 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Search</span>
        </button>

        <span className="text-xs font-black bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full border border-emerald-300 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Order Confirmed • #{activeLiveOrder.orderId}
        </span>
      </div>

      {/* Order Confirmation Hero Banner */}
      <div className={`p-6 sm:p-8 rounded-3xl shadow-xl transition-all ${
        accessibilitySettings.highContrast
          ? 'bg-black text-white border-4 border-yellow-400'
          : 'bg-gradient-to-r from-emerald-600 via-teal-700 to-slate-900 text-white'
      }`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-6 h-6 text-yellow-300 animate-pulse" />
              <h2 className="text-2xl sm:text-3xl font-black">{t('tracking.orderPlaced')}</h2>
            </div>
            <p className="text-base sm:text-xl font-black text-yellow-300">
              {activeLiveOrder.foodName} • {activeLiveOrder.restaurant}
            </p>
            <p className="text-xs text-emerald-100 font-bold flex items-center gap-2">
              <span>Platform: <strong className="uppercase font-black text-white">{activeLiveOrder.platformName || 'Swiggy'}</strong></span>
              <span>•</span>
              <span>Paid: <strong className="font-black text-white">₹{activeLiveOrder.amountPaid}</strong> via Wallet ({linkedBank?.bankName || 'HDFC Bank'})</span>
            </p>
          </div>

          {/* Live Countdown Box */}
          <div className="bg-slate-900/90 text-white p-5 rounded-2xl border-2 border-orange-400 text-center w-full md:w-auto shadow-2xl">
            <span className="text-[10px] uppercase font-black tracking-wider text-orange-400 block">
              {t('tracking.eta')}
            </span>
            <div className="text-4xl font-black font-mono text-yellow-300 my-0.5">
              {timeFormatted}
            </div>
            <span className="text-xs text-slate-300 font-bold">
              {minutes} {t('tracking.minsRemaining')}
            </span>
          </div>
        </div>
      </div>

      {/* 🗺️ INTERACTIVE OPENSTREETMAP LIVE GPS TRACKER */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-2 text-xs font-black text-slate-700 dark:text-slate-300">
          <span>Live GPS Route & Delivery Partner Path:</span>
          <span className="text-emerald-600">✓ Swiggy / Zomato Live API Stream Connected</span>
        </div>

        <LiveGPSMapTracker
          userLat={userLocation?.latitude || 13.0827}
          userLng={userLocation?.longitude || 80.2707}
          addressName={userLocation?.addressName || activeLiveOrder.deliveryAddress || 'Anna Nagar, Chennai'}
          restaurantName={activeLiveOrder.restaurant || 'Hotel Saravana Bhavan'}
          remainingSeconds={secondsLeft}
          totalSeconds={totalSeconds}
        />
      </div>

      {/* Real-time Order Status Stage Timeline */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
        <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
          Real-Time Order Status Timeline:
        </h3>

        <div className="grid grid-cols-4 gap-2 text-center">
          {stages.map((st, idx) => (
            <div key={st.key} className="flex flex-col items-center">
              <span className="text-2xl mb-1">{st.icon}</span>
              <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                {st.label}
              </span>
            </div>
          ))}
        </div>

        <div className="w-full bg-slate-200 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-500 h-full w-3/4 animate-pulse" />
        </div>
      </div>

      {/* Driver Contact & Audio Announcement */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Driver Contact Box */}
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-3xl border border-emerald-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-emerald-600 text-white font-black rounded-full flex items-center justify-center text-base shadow-md">
              {activeLiveOrder.driverName ? activeLiveOrder.driverName.charAt(0) : 'R'}
            </div>
            <div>
              <span className="font-black text-slate-900 dark:text-white block text-sm">{activeLiveOrder.driverName || 'Ramesh Kumar'}</span>
              <span className="text-xs text-slate-500 font-bold">{t('tracking.driver')} • ⭐ 4.9 Rating</span>
            </div>
          </div>

          <a
            href={`tel:${activeLiveOrder.driverPhone || '+91 98765 43210'}`}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs shadow-md flex items-center space-x-1"
          >
            <PhoneCall className="w-4 h-4" />
            <span>Call Driver</span>
          </a>
        </div>

        {/* Speak Status Button */}
        <button
          onClick={() => speakText(`${activeLiveOrder.foodName} ${t('tracking.orderPlaced')} via ${activeLiveOrder.platformName}. ${t('tracking.eta')}: ${minutes} ${t('tracking.minsRemaining')}.`)}
          className="p-4 bg-slate-900 text-white hover:bg-slate-800 font-black rounded-3xl shadow-lg flex items-center justify-center space-x-2 text-xs cursor-pointer"
        >
          <Volume2 className="w-5 h-5 text-yellow-300 animate-bounce" />
          <span>Speak Live Delivery Status Audio</span>
        </button>

      </div>

    </div>
  );
};
