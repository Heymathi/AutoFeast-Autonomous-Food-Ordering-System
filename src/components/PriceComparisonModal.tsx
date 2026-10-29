import { useCallback, useEffect, useRef, useState } from 'react';
/**
 * PriceComparisonModal
 * Live real-time price comparison across Swiggy, Zomato, EatSure & Magicpin.
 * Auto-refreshes every 30s. Uses /api/prices/live (backend) + Yelp API.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  X, RefreshCw, TrendingDown, Star, Clock, Zap, ShieldCheck,
  ChevronDown, ChevronUp, Award, Flame, ExternalLink, AlertTriangle
} from 'lucide-react';
import { FoodItem, PlatformName } from '../types';
import { PriceComparisonService, PlatformLiveData, YelpRestaurant } from '../services/priceComparisonService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PriceComparisonModalProps {
  isOpen: boolean;
  item: FoodItem | null;
  onClose: () => void;
  onSelectPlatform?: (platform: PlatformName, price: number) => void;
  userLatitude?: number;
  userLongitude?: number;
  userCity?: string;
}

interface LivePriceResponse {
  success: boolean;
  itemId: string;
  platforms: PlatformLiveData[];
  refreshedAt: string;
  nextRefresh: string;
}

// ─── Platform colours / logos (mirrors priceComparisonService) ────────────────

const PLATFORM_STYLE: Record<string, { color: string; bg: string; emoji: string; tagline: string }> = {
  swiggy:   { color: '#FC8019', bg: 'rgba(252,128,25,0.12)',  emoji: '🟠', tagline: 'Fast Delivery Guaranteed' },
  zomato:   { color: '#E23744', bg: 'rgba(226,55,68,0.12)',   emoji: '🔴', tagline: 'Gold Members Get Extra Off' },
  eatsure:  { color: '#7C3AED', bg: 'rgba(124,58,237,0.12)',  emoji: '🟣', tagline: 'Hygiene Certified Kitchens' },
  magicpin: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  emoji: '🟡', tagline: 'Earn Cashback on Every Order' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 30000;

function secondsUntilNextBucket(): number {
  return 30 - (Math.floor(Date.now() / 1000) % 30);
}

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className="w-3 h-3"
          fill={i <= Math.round(rating) ? 'currentColor' : 'none'}
          style={{ color: '#FBBF24' }}
        />
      ))}
      <span className="ml-1 text-xs font-semibold" style={{ color: '#FBBF24' }}>{rating}</span>
    </span>
  );
}

// ─── Platform Card ────────────────────────────────────────────────────────────

interface PlatformCardProps {
  data: PlatformLiveData;
  isBest: boolean;
  isCheapest: boolean;
  isFastest: boolean;
  isHighestRated: boolean;
  onSelect: () => void;
}

const PlatformCard: React.FC<PlatformCardProps> = ({
  data, isBest, isCheapest, isFastest, isHighestRated, onSelect,
}) => {
  const style = PLATFORM_STYLE[data.platform] ?? { color: '#888', bg: '#f0f0f0', emoji: '🔵', tagline: '' };
  const totalPrice = data.price + data.deliveryFee;
  const savings = data.originalPrice > data.price
    ? Math.round(((data.originalPrice - data.price) / data.originalPrice) * 100)
    : 0;

  return (
    <div
      className="relative rounded-2xl border transition-all duration-300 cursor-pointer hover:scale-[1.02] hover:shadow-xl"
      style={{
        background: data.available ? style.bg : 'rgba(100,100,100,0.06)',
        borderColor: isBest ? style.color : 'rgba(255,255,255,0.12)',
        borderWidth: isBest ? 2 : 1,
        opacity: data.available ? 1 : 0.5,
      }}
      onClick={data.available ? onSelect : undefined}
    >
      {/* Best Value Banner */}
      {isBest && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-black text-white flex items-center gap-1 z-10 shadow-lg"
          style={{ background: style.color }}
        >
          <Award className="w-3 h-3" /> BEST VALUE
        </div>
      )}

      <div className="p-4 pt-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{style.emoji}</span>
            <div>
              <div className="font-black text-base" style={{ color: style.color }}>
                {data.platformName}
              </div>
              <div className="text-xs text-slate-400">{style.tagline}</div>
            </div>
          </div>

          {/* Surge badge */}
          {data.surgeActive && (
            <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
              <Flame className="w-3 h-3" /> Surge ×{data.surgeMultiplier}
            </span>
          )}
        </div>

        {/* Price */}
        <div className="flex items-end gap-2 mb-1">
          <span className="text-3xl font-black text-white">₹{data.price}</span>
          {data.originalPrice > data.price && (
            <span className="text-sm line-through text-slate-500 mb-1">₹{data.originalPrice}</span>
          )}
          {savings > 0 && (
            <span className="text-xs font-bold text-green-400 mb-1">-{savings}%</span>
          )}
        </div>

        {/* Delivery fee */}
        <div className="text-xs text-slate-400 mb-3">
          {data.deliveryFee === 0
            ? <span className="text-green-400 font-semibold">✓ Free Delivery</span>
            : <span>+ ₹{data.deliveryFee} delivery</span>}
          <span className="mx-2 text-slate-600">|</span>
          <span className="font-semibold text-slate-300">Total ₹{totalPrice}</span>
        </div>

        {/* Chips */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {isCheapest && (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-green-500/20 text-green-400 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> Cheapest
            </span>
          )}
          {isFastest && (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-blue-500/20 text-blue-400 flex items-center gap-1">
              <Zap className="w-3 h-3" /> Fastest
            </span>
          )}
          {isHighestRated && (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-yellow-500/20 text-yellow-400 flex items-center gap-1">
              <Star className="w-3 h-3" /> Top Rated
            </span>
          )}
          {data.discountBadge && (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-orange-500/20 text-orange-400">
              🏷 {data.discountBadge}
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <StarRow rating={data.rating} />
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {data.deliveryTime} min
          </span>
          <span className="text-slate-500">ETA {(data as any).estimatedArrival}</span>
        </div>

        {/* CTA */}
        {data.available ? (
          <button
            className="mt-4 w-full py-2.5 rounded-xl text-sm font-black text-white transition-all hover:brightness-110 active:scale-95"
            style={{ background: style.color }}
          >
            Order on {data.platformName} →
          </button>
        ) : (
          <div className="mt-4 w-full py-2.5 rounded-xl text-sm font-bold text-center bg-slate-700 text-slate-400">
            Currently Unavailable
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Yelp Restaurant Card ─────────────────────────────────────────────────────

const YelpCard: React.FC<{ r: YelpRestaurant }> = ({ r }) => (
  <a
    href={r.url}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-3 p-3 rounded-xl border border-white/10 hover:border-white/25 transition-all bg-white/5 hover:bg-white/10"
  >
    {r.image_url && (
      <img src={r.image_url} alt={r.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
    )}
    <div className="flex-1 min-w-0">
      <div className="font-bold text-sm text-white truncate">{r.name}</div>
      <div className="text-xs text-slate-400">{r.categories?.map(c => c.title).join(' · ')}</div>
      <div className="flex items-center gap-2 mt-0.5">
        <StarRow rating={r.rating} />
        {r.price && <span className="text-xs text-green-400 font-bold">{r.price}</span>}
        {r.is_closed && <span className="text-xs text-red-400">Closed</span>}
      </div>
    </div>
    <ExternalLink className="w-4 h-4 text-slate-500 flex-shrink-0" />
  </a>
);

// ─── Main Modal ───────────────────────────────────────────────────────────────

export const PriceComparisonModal: React.FC<PriceComparisonModalProps> = ({
  isOpen,
  item,
  onClose,
  onSelectPlatform,
  userLatitude,
  userLongitude,
  userCity,
}) => {
  const [platforms, setPlatforms] = useState<PlatformLiveData[]>([]);
  const [yelpResults, setYelpResults] = useState<YelpRestaurant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showYelp, setShowYelp] = useState(false);
  const [isYelpLoading, setIsYelpLoading] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch live prices from /api/prices/live ────────────────────────────────
  const fetchLivePrices = useCallback(async (silent = false) => {
    if (!item) return;
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/prices/live?itemId=${encodeURIComponent(item.id)}&basePrice=${item.basePrice}&itemName=${encodeURIComponent(item.name)}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data: LivePriceResponse = await res.json();
      if (data.success) {
        setPlatforms(data.platforms as PlatformLiveData[]);
        setRefreshedAt(new Date(data.refreshedAt));
        setCountdown(secondsUntilNextBucket());
      }
    } catch (err) {
      // Fallback: generate prices client-side
      console.warn('[PriceComparisonModal] API unavailable, using client-side generation:', err);
      const generated = PriceComparisonService.generateLivePlatformPrices(item);
      setPlatforms(generated);
      setRefreshedAt(new Date());
      setCountdown(secondsUntilNextBucket());
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [item]);

  // ── Fetch Yelp restaurants ─────────────────────────────────────────────────
  const fetchYelp = useCallback(async () => {
    if (!item) return;
    setIsYelpLoading(true);
    const results = await PriceComparisonService.fetchYelpRestaurants({
      term: item.name,
      latitude: userLatitude,
      longitude: userLongitude,
      location: userCity,
      limit: 5,
    });
    setYelpResults(results);
    setIsYelpLoading(false);
  }, [item, userLatitude, userLongitude, userCity]);

  // ── On open ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen && item) {
      fetchLivePrices(false);
      fetchYelp();

      // Auto-refresh every 30s
      timerRef.current = setInterval(() => fetchLivePrices(true), REFRESH_INTERVAL_MS);

      // Countdown ticker
      countdownRef.current = setInterval(() => {
        setCountdown(secondsUntilNextBucket());
      }, 1000);
    }

    return () => {
      if (timerRef.current)    clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [isOpen, item, fetchLivePrices, fetchYelp]);

  if (!isOpen || !item) return null;

  // ── Summary ────────────────────────────────────────────────────────────────
  let summary = null;
  try {
    summary = platforms.length ? PriceComparisonService.compare(platforms) : null;
  } catch { /* no available platforms yet */ }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative w-full sm:max-w-2xl max-h-[95vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 25px 80px rgba(0,0,0,0.8)',
        }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 px-5 py-4 flex items-center justify-between"
          style={{ background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <h2 className="text-lg font-black text-white">📊 Live Price Comparison</h2>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{item.name} • {item.restaurant}</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Countdown pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/8 border border-white/10">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  background: countdown > 10 ? '#22C55E' : '#EF4444',
                  animation: 'pulse 1s infinite',
                }}
              />
              <span className="text-xs font-mono font-bold text-white">{countdown}s</span>
              {isRefreshing && <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />}
            </div>

            <button
              onClick={() => fetchLivePrices(false)}
              className="p-2 rounded-full bg-white/8 hover:bg-white/15 transition-colors"
              title="Refresh now"
            >
              <RefreshCw className={`w-4 h-4 text-white ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            <button onClick={onClose} className="p-2 rounded-full bg-white/8 hover:bg-red-500/30 transition-colors">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">

          {/* Savings Banner */}
          {summary && summary.maxSavings > 0 && (
            <div className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(16,185,129,0.10))', border: '1px solid rgba(34,197,94,0.25)' }}>
              <TrendingDown className="w-6 h-6 text-green-400 flex-shrink-0" />
              <div>
                <div className="font-black text-green-400 text-base">Save up to ₹{summary.maxSavings}!</div>
                <div className="text-xs text-green-300/70">
                  Comparing {platforms.filter(p => p.available).length} platforms • Updated {refreshedAt?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl p-3 flex items-center gap-2 bg-red-500/15 border border-red-500/30">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-300">{error}</span>
            </div>
          )}

          {/* Loading skeleton */}
          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="rounded-2xl h-52 animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
              ))}
            </div>
          )}

          {/* Platform Cards */}
          {!isLoading && platforms.length > 0 && summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {platforms
                .filter(p => p.available)
                .sort((a, b) => {
                  const scoreA = (a.rating * 50) - (a.price + a.deliveryFee);
                  const scoreB = (b.rating * 50) - (b.price + b.deliveryFee);
                  return scoreB - scoreA;
                })
                .map((p) => (
                  <PlatformCard
                    key={p.platform}
                    data={p}
                    isBest={summary.bestValue.platform === p.platform}
                    isCheapest={summary.cheapest.platform === p.platform}
                    isFastest={summary.fastest.platform === p.platform}
                    isHighestRated={summary.highestRated.platform === p.platform}
                    onSelect={() => onSelectPlatform?.(p.platform, p.price)}
                  />
                ))}
            </div>
          )}

          {/* Unavailable platforms notice */}
          {!isLoading && platforms.some(p => !p.available) && (
            <p className="text-xs text-center text-slate-500">
              {platforms.filter(p => !p.available).map(p => p.platformName).join(', ')} unavailable right now
            </p>
          )}

          {/* ── Yelp Section ─────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/8 overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.03)' }}>
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-white hover:bg-white/5 transition-colors"
              onClick={() => { setShowYelp(v => !v); if (!showYelp && yelpResults.length === 0) fetchYelp(); }}
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-red-400" />
                <span>Real Restaurants nearby (via Yelp)</span>
                {yelpResults.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-black">
                    {yelpResults.length}
                  </span>
                )}
              </span>
              {showYelp ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {showYelp && (
              <div className="px-4 pb-4 space-y-2">
                {isYelpLoading && (
                  <div className="text-xs text-center text-slate-400 py-4 flex items-center justify-center gap-2">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Fetching from Yelp…
                  </div>
                )}
                {!isYelpLoading && yelpResults.length === 0 && (
                  <div className="text-xs text-center text-slate-500 py-4">
                    No Yelp results found. Add your{' '}
                    <code className="text-yellow-400">YELP_API_KEY</code> to .env for live restaurant data.
                  </div>
                )}
                {yelpResults.map(r => <YelpCard key={r.id} r={r} />)}
              </div>
            )}
          </div>

          {/* Live data disclaimer */}
          <p className="text-center text-xs text-slate-600 pb-2">
            🔄 Prices auto-refresh every 30s • Simulated live pricing based on surge patterns
          </p>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};

export default PriceComparisonModal;
