/**
 * PriceComparisonService
 * ──────────────────────────────────────────────────────────────────────────
 * Provides:
 *  1. Realistic mock-live pricing for Swiggy, Zomato, EatSure, Magicpin
 *     (simulates surge pricing, discount badges, availability windows)
 *  2. Real restaurant data from Yelp Fusion API (free tier, 500 calls/day)
 *  3. Auto-refresh support (seeded per 30s time bucket)
 *  4. Best-value scoring algorithm
 */

import { PlatformPriceOption, PlatformName, FoodItem, OrderStrategy } from '../types';
import { FuzzyMatchEngine, FuzzyMatchResult } from './fuzzyMatchService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PriceComparisonSummary {
  bestValue: PlatformPriceOption;
  cheapest: PlatformPriceOption;
  highestRated: PlatformPriceOption;
  fastest: PlatformPriceOption;
  maxSavings: number;
  allPlatforms: PlatformPriceOption[];
  refreshedAt: Date;
}

export interface YelpRestaurant {
  id: string;
  name: string;
  rating: number;
  price?: string; // '$' | '$$' | '$$$'
  location: { address1: string; city: string };
  categories: { title: string }[];
  image_url?: string;
  url?: string;
  is_closed: boolean;
  distance?: number; // meters
}

export interface PlatformLiveData extends PlatformPriceOption {
  surgeActive: boolean;
  surgeMultiplier: number;
  estimatedArrival: string; // "12:45 PM"
  promoCode?: string;
  lastRefreshed: Date;
}

// ─── Platform Config ──────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<PlatformName, {
  displayName: string;
  color: string;
  logo: string;
  baseDeliveryFee: number;
  freeDeliveryAbove: number;
  surgeHours: number[];
  avgRating: number;
}> = {
  swiggy: {
    displayName: 'Swiggy',
    color: '#FC8019',
    logo: '🟠',
    baseDeliveryFee: 35,
    freeDeliveryAbove: 299,
    surgeHours: [12, 13, 19, 20, 21],
    avgRating: 4.1,
  },
  zomato: {
    displayName: 'Zomato',
    color: '#E23744',
    logo: '🔴',
    baseDeliveryFee: 30,
    freeDeliveryAbove: 349,
    surgeHours: [13, 14, 20, 21, 22],
    avgRating: 4.2,
  },
  eatsure: {
    displayName: 'EatSure',
    color: '#7C3AED',
    logo: '🟣',
    baseDeliveryFee: 25,
    freeDeliveryAbove: 249,
    surgeHours: [12, 13, 14],
    avgRating: 4.3,
  },
  magicpin: {
    displayName: 'Magicpin',
    color: '#F59E0B',
    logo: '🟡',
    baseDeliveryFee: 20,
    freeDeliveryAbove: 199,
    surgeHours: [18, 19, 20],
    avgRating: 3.9,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function seededRandom(seed: string, timeBucket: number): number {
  let hash = timeBucket;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 1000) / 1000;
}

function currentTimeBucket(): number {
  return Math.floor(Date.now() / 30000); // refreshes every 30 seconds
}

function isSurgeHour(platform: PlatformName): boolean {
  const hour = new Date().getHours();
  return PLATFORM_CONFIG[platform].surgeHours.includes(hour);
}

function getDiscountBadge(platform: PlatformName, totalPrice: number, seed: number): string | undefined {
  const badges: Record<PlatformName, string[]> = {
    swiggy:  ['50% OFF up to ₹100', 'Free Delivery', '₹50 OFF on ₹299+', 'SWIGGY50'],
    zomato:  ['60% OFF up to ₹120', 'Zomato Gold -20%', '₹75 OFF', 'ZOMATO60'],
    eatsure: ['₹30 OFF', 'Hygiene Certified + Free Delivery', '20% Cashback'],
    magicpin:['Earn 5% Cashback', '₹25 Magicpin Cash', 'Flat ₹20 OFF'],
  };
  const list = badges[platform];
  if (seed > 0.55 && totalPrice > 150) {
    return list[Math.floor(seed * list.length)];
  }
  return undefined;
}

// ─── Core Service ─────────────────────────────────────────────────────────────

export class PriceComparisonService {

  /**
   * Generate realistic live-simulated platform prices for a given food item.
   * Simulates: surge pricing, availability, discount badges, delivery time.
   */
  public static generateLivePlatformPrices(item: FoodItem): PlatformLiveData[] {
    const bucket = currentTimeBucket();
    const platforms: PlatformName[] = ['swiggy', 'zomato', 'eatsure', 'magicpin'];
    const now = new Date();

    return platforms.map((platform) => {
      const cfg = PLATFORM_CONFIG[platform];
      const seed = seededRandom(`${item.id}-${platform}`, bucket);
      const prevSeed = seededRandom(`${item.id}-${platform}`, bucket - 1);

      // Price: ±8% from base
      const priceVariation = 0.92 + (seed * 0.16);
      const rawPrice = Math.round(item.basePrice * priceVariation);

      // Surge pricing
      const surgeActive = isSurgeHour(platform) && seed > 0.6;
      const surgeMultiplier = surgeActive ? (1.1 + seed * 0.25) : 1.0;
      const price = Math.round(rawPrice * surgeMultiplier);
      const originalPrice = surgeActive
        ? rawPrice
        : Math.round(rawPrice * (1 + prevSeed * 0.15));

      // Delivery fee
      const deliveryFee = price >= cfg.freeDeliveryAbove
        ? 0
        : cfg.baseDeliveryFee + Math.round(seed * 20);

      // Delivery time: 15–50 min
      const deliveryTime = 15 + Math.round(seed * 35);

      // Rating: small variance per refresh
      const rating = parseFloat((cfg.avgRating - 0.2 + seed * 0.4).toFixed(1));

      // Availability: 95% chance
      const available = seed < 0.95;

      // ETA string
      const etaDate = new Date(now.getTime() + deliveryTime * 60000);
      const estimatedArrival = etaDate.toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit',
      });

      return {
        platform,
        platformName: cfg.displayName,
        price,
        originalPrice,
        rating,
        deliveryTime,
        deliveryFee,
        discountBadge: getDiscountBadge(platform, price, seed),
        available,
        surgeActive,
        surgeMultiplier: parseFloat(surgeMultiplier.toFixed(2)),
        estimatedArrival,
        lastRefreshed: now,
      } as PlatformLiveData;
    });
  }

  /**
   * Compare all available platform options for a food item.
   */
  public static compare(platforms: PlatformPriceOption[]): PriceComparisonSummary {
    const available = platforms.filter(p => p.available);
    if (available.length === 0) {
      throw new Error('No delivery platform available for this item');
    }

    const cheapest = [...available].sort((a, b) =>
      (a.price + a.deliveryFee) - (b.price + b.deliveryFee))[0];

    const highestRated = [...available].sort((a, b) => b.rating - a.rating)[0];

    const fastest = [...available].sort((a, b) => a.deliveryTime - b.deliveryTime)[0];

    const bestValue = [...available].sort((a, b) => {
      const scoreA = (a.rating * 50) - (a.price + a.deliveryFee);
      const scoreB = (b.rating * 50) - (b.price + b.deliveryFee);
      return scoreB - scoreA;
    })[0];

    const maxPrice = Math.max(...available.map(p => p.price + p.deliveryFee));
    const minPrice = Math.min(...available.map(p => p.price + p.deliveryFee));
    const maxSavings = Math.max(0, maxPrice - minPrice);

    return {
      bestValue, cheapest, highestRated, fastest, maxSavings,
      allPlatforms: available,
      refreshedAt: new Date(),
    };
  }

  /**
   * Pick single optimal platform based on user's strategy.
   */
  public static selectByStrategy(
    platforms: PlatformPriceOption[],
    strategy: OrderStrategy
  ): PlatformPriceOption {
    const summary = this.compare(platforms);
    switch (strategy) {
      case 'cheapest':      return summary.cheapest;
      case 'highest_rated': return summary.highestRated;
      case 'fastest':       return summary.fastest;
      case 'best_value':
      default:              return summary.bestValue;
    }
  }

  /**
   * Match user query against canonical restaurant list using FuzzyMatchEngine
   */
  public static matchRestaurantName(query: string): FuzzyMatchResult<{ canonicalName: string }> {
    return FuzzyMatchEngine.matchRestaurant(query);
  }

  /**
   * Get platform display config (color, logo, name) for UI rendering.
   */
  public static getPlatformConfig(platform: PlatformName) {
    return PLATFORM_CONFIG[platform];
  }

  /**
   * Calculate savings percentage.
   */
  public static savingsPercent(original: number, current: number): number {
    if (original <= current) return 0;
    return Math.round(((original - current) / original) * 100);
  }

  /**
   * Fetch real restaurant data from backend Yelp proxy API.
   * Backend handles Yelp API key securely (free tier: 500 calls/day).
   */
  public static async fetchYelpRestaurants(params: {
    term: string;
    location?: string;
    latitude?: number;
    longitude?: number;
    limit?: number;
  }): Promise<YelpRestaurant[]> {
    try {
      const query = new URLSearchParams({
        term: params.term,
        limit: String(params.limit ?? 5),
        ...(params.location   ? { location:  params.location              } : {}),
        ...(params.latitude   ? { latitude:  String(params.latitude)      } : {}),
        ...(params.longitude  ? { longitude: String(params.longitude)     } : {}),
      });

      const res = await fetch(`/api/yelp/search?${query.toString()}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        console.warn('[PriceComparison] Yelp API unavailable, falling back to mock data');
        return [];
      }

      const data = await res.json();
      return data.businesses ?? [];
    } catch (err) {
      console.warn('[PriceComparison] Yelp fetch failed:', err);
      return [];
    }
  }
}
