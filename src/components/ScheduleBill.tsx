import React from 'react';
import { FoodItem, ScheduleDuration, Language } from '../types';
import { useApp } from '../context/AppContext';
import { MapPin, Clock, Utensils, Wallet, FileText, AlertCircle, ShieldCheck, Zap } from 'lucide-react';

export interface ScheduleBillItem {
  foodItem: FoodItem;
  quantity: number;
}

export interface ScheduleBillProps {
  items: ScheduleBillItem[];
  time: string;
  frequency: 'daily' | 'weekly' | 'custom' | 'once';
  duration: ScheduleDuration;
  startDate: string;
  endDate?: string;
  showDailyLimitImpact?: boolean;
}

export const calculateOccurrences = (
  frequency: 'daily' | 'weekly' | 'custom' | 'once',
  duration: ScheduleDuration,
  startDate: string,
  endDate?: string
): number => {
  if (frequency === 'once' || duration === 'today_only') return 1;

  let totalDays = 30; // default 1 month
  if (duration === '1_week') totalDays = 7;
  else if (duration === '1_month') totalDays = 30;
  else if (duration === '3_months') totalDays = 90;
  else if (duration === 'indefinite') totalDays = 30; // 30-day billing cycle preview
  else if (duration === 'custom' && startDate && endDate) {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const diff = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
    totalDays = diff;
  }

  if (frequency === 'daily') return totalDays;
  if (frequency === 'weekly') return Math.max(1, Math.ceil(totalDays / 7));
  return 1;
};

export const ScheduleBill: React.FC<ScheduleBillProps> = ({
  items,
  time,
  frequency,
  duration,
  startDate,
  endDate,
  showDailyLimitImpact = true
}) => {
  const { language, walletBalance, dailyOrderCount, t } = useApp();

  if (!items || items.length === 0) return null;

  // Group items by restaurant
  const restaurantGroups: { [restaurant: string]: ScheduleBillItem[] } = {};
  items.forEach(item => {
    if (!item || !item.foodItem) return;
    const rest = item.foodItem.restaurant || 'Saravana Bhavan';
    if (!restaurantGroups[rest]) {
      restaurantGroups[rest] = [];
    }
    restaurantGroups[rest].push(item);
  });

  const restaurantNames = Object.keys(restaurantGroups);

  // Calculate per-order subtotal
  let subtotal = 0;
  items.forEach(i => {
    if (i && i.foodItem) {
      subtotal += (i.foodItem.basePrice || 100) * (i.quantity || 1);
    }
  });

  const deliveryFeePerRestaurant = 30;
  const totalDeliveryFee = restaurantNames.length * deliveryFeePerRestaurant;
  const platformFee = 5.00;
  const gstTax = (subtotal + totalDeliveryFee) * 0.05;
  const perOrderTotal = subtotal + totalDeliveryFee + platformFee + gstTax;

  // Calculate total occurrences
  const occurrences = calculateOccurrences(frequency, duration, startDate, endDate);
  const grandTotal = perOrderTotal * occurrences;

  const durationLabel =
    duration === 'today_only'
      ? (language === 'ta' ? 'இன்று மட்டும் (1 நாள்)' : language === 'hi' ? 'केवल आज (1 दिन)' : 'Today alone (1 Day)')
      : duration === '1_week'
      ? (language === 'ta' ? '1 வாரம் (7 நாட்கள்)' : language === 'hi' ? '1 हफ्ता (7 दिन)' : '1 Week (7 Days)')
      : duration === '1_month'
      ? (language === 'ta' ? '1 மாதம் (30 நாட்கள்)' : language === 'hi' ? '1 महीना (30 दिन)' : '1 Month (30 Days)')
      : duration === '3_months'
      ? (language === 'ta' ? '3 மாதங்கள் (90 நாட்கள்)' : language === 'hi' ? '3 महीने (90 दिन)' : '3 Months (90 Days)')
      : duration === 'indefinite'
      ? (language === 'ta' ? 'ரத்து செய்யும் வரை' : language === 'hi' ? 'रद्द करने तक' : 'Indefinite (30-day preview)')
      : `${startDate} → ${endDate || 'Custom'}`;

  return (
    <div className="space-y-4 text-xs text-[#1A1110]">
      
      {/* Bill Section Header */}
      <div className="bg-[#DAF0F7]/50 p-3 rounded-2xl border border-[#B2E2F0] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FileText className="w-4 h-4 text-[#FF5A1F]" />
          <span className="font-black text-[#1A1110] uppercase tracking-wider">
            {language === 'ta'
              ? 'அட்டவணை பில் & GST விவரம்'
              : language === 'hi'
              ? 'शेड्यूल बिल और जीएसटी सारांश'
              : 'Schedule Bill & GST Summary'}
          </span>
        </div>
        <span className="text-[10px] font-black bg-[#FF5A1F]/10 text-[#FF5A1F] px-2.5 py-0.5 rounded-full border border-[#FF5A1F]/20">
          {occurrences} {language === 'ta' ? 'டெலிவரிகள்' : language === 'hi' ? 'डिलीवरी' : 'Deliveries'}
        </span>
      </div>

      {/* Restaurant-grouped Items Section */}
      <div className="space-y-3">
        {restaurantNames.map(restName => (
          <div key={restName} className="bg-slate-50 p-3.5 rounded-2xl border border-[#DAF0F7] space-y-2">
            <div className="flex items-center justify-between border-b border-[#DAF0F7] pb-1.5">
              <span className="font-black text-[#FF5A1F] uppercase text-xs">{restName}</span>
              <span className="text-[10px] text-[#4A5568] font-bold">
                {language === 'ta' ? 'டெலிவரி கட்டணம்:' : language === 'hi' ? 'डिलीवरी शुल्क:' : 'Delivery Fee:'} ₹{deliveryFeePerRestaurant}
              </span>
            </div>

            <div className="space-y-1.5">
              {restaurantGroups[restName].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between font-bold">
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-[#FF5A1F] text-white font-black text-[10px] flex items-center justify-center shrink-0">
                      {item.quantity}x
                    </span>
                    <span className="truncate text-xs font-black">
                      {item.foodItem.nativeNames?.[language] || item.foodItem.name}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-black shrink-0">
                    ₹{(item.foodItem.basePrice * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Financial Breakdown Card */}
      <div className="p-4 bg-[#DAF0F7]/40 rounded-2xl border border-[#B2E2F0] space-y-2 text-xs font-bold text-[#1A1110]">
        <div className="flex justify-between">
          <span className="text-[#4A5568]">
            {language === 'ta' ? 'பொருட்கள் தொகை:' : language === 'hi' ? 'सामग्री सब-टोटल:' : 'Items Subtotal:'}
          </span>
          <span className="font-mono font-black">₹{subtotal.toFixed(2)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-[#4A5568]">
            {language === 'ta'
              ? `டெலிவரி கட்டணம் (${restaurantNames.length} உணவகம்):`
              : language === 'hi'
              ? `डिलीवरी शुल्क (${restaurantNames.length} रेस्टोरेंट):`
              : `Total Delivery Fees (${restaurantNames.length} restaurant):`}
          </span>
          <span className="font-mono font-black">₹{totalDeliveryFee.toFixed(2)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-[#4A5568]">
            {language === 'ta' ? 'பிளாட்பார்ம் கட்டணம்:' : language === 'hi' ? 'प्लेटफॉर्म शुल्क:' : 'Platform Fee:'}
          </span>
          <span className="font-mono font-black">₹{platformFee.toFixed(2)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-[#4A5568]">GST Tax (5%):</span>
          <span className="font-mono font-black">₹{gstTax.toFixed(2)}</span>
        </div>

        {/* Per-Order Total Row */}
        <div className="flex justify-between border-t border-[#B2E2F0] pt-2 text-xs font-black text-[#1A1110]">
          <span>
            {language === 'ta' ? 'ஒரு ஆர்டரின் மொத்தம் (Per-Order Total):' : language === 'hi' ? 'प्रति ऑर्डर कुल (Per-Order Total):' : 'Per-Order Total:'}
          </span>
          <span className="font-mono text-[#FF5A1F]">₹{perOrderTotal.toFixed(2)}</span>
        </div>

        {/* Occurrences & Duration Row */}
        <div className="flex justify-between text-xs font-black text-[#4A5568]">
          <span>
            {language === 'ta' ? 'அட்டவணை சுழற்சி & நாட்கள்:' : language === 'hi' ? 'शेड्यूल अवधि और दिन:' : 'Schedule Duration & Occurrences:'}
          </span>
          <span>{durationLabel} ({occurrences} {language === 'ta' ? 'நாட்கள்' : language === 'hi' ? 'दिन' : 'days'})</span>
        </div>

        {/* Grand Total Row */}
        <div className="flex justify-between border-t-2 border-[#FF5A1F] pt-2 text-base font-black text-[#FF5A1F]">
          <span>
            {language === 'ta' ? 'மொத்த தொகை (Grand Total):' : language === 'hi' ? 'कुल योग (Grand Total):' : 'Grand Total:'}
          </span>
          <span className="font-mono">₹{grandTotal.toFixed(2)}</span>
        </div>
      </div>

      {/* Daily Limit Impact & Wallet Status */}
      {showDailyLimitImpact && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Daily Limit Usage */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-black uppercase text-[#4A5568] block">
                {language === 'ta' ? 'தினசரி ஆர்டர் வரம்பு பயன்பாடு' : language === 'hi' ? 'दैनिक सीमा उपयोग' : 'Daily Limit Impact'}
              </span>
              <span className="text-xs font-black text-[#1A1110]">
                {dailyOrderCount}/6 {language === 'ta' ? 'ஆர்டர்கள் முடிந்தது' : language === 'hi' ? 'ऑर्डर प्रयुक्त' : 'orders used today'}
              </span>
            </div>
            <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
              dailyOrderCount >= 6 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {dailyOrderCount >= 6 ? 'Limit Full' : 'OK'}
            </span>
          </div>

          {/* Wallet Balance Status */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-black uppercase text-[#4A5568] block">
                {language === 'ta' ? 'வால்லெட் இருப்பு' : language === 'hi' ? 'वॉलेट शेष' : 'Wallet Balance'}
              </span>
              <span className="text-xs font-black font-mono text-[#1A1110]">₹{walletBalance.toFixed(2)}</span>
            </div>
            {walletBalance >= perOrderTotal ? (
              <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                Sufficient
              </span>
            ) : (
              <span className="text-[10px] font-black bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                Low Balance
              </span>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
