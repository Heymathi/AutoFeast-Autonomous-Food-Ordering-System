import { PlatformPriceOption, OrderStrategy } from '../types';
import { FuzzyMatchEngine, FuzzyMatchResult } from './fuzzyMatchService';

export interface PriceComparisonSummary {
  bestValue: PlatformPriceOption;
  cheapest: PlatformPriceOption;
  highestRated: PlatformPriceOption;
  fastest: PlatformPriceOption;
  maxSavings: number;
  allPlatforms: PlatformPriceOption[];
}

export class PriceComparisonService {
  /**
   * Compare all available platform options for a food item.
   */
  public static compare(platforms: PlatformPriceOption[]): PriceComparisonSummary {
    const available = platforms.filter(p => p.available);
    if (available.length === 0) {
      throw new Error('No delivery platform available for this item');
    }

    // 1. Cheapest
    const cheapest = [...available].sort((a, b) => (a.price + a.deliveryFee) - (b.price + b.deliveryFee))[0];

    // 2. Highest Rated
    const highestRated = [...available].sort((a, b) => b.rating - a.rating)[0];

    // 3. Fastest Delivery
    const fastest = [...available].sort((a, b) => a.deliveryTime - b.deliveryTime)[0];

    // 4. Best Value Algorithm: Weighted (Rating * 50) - (Total Cost)
    const bestValue = [...available].sort((a, b) => {
      const scoreA = (a.rating * 50) - (a.price + a.deliveryFee);
      const scoreB = (b.rating * 50) - (b.price + b.deliveryFee);
      return scoreB - scoreA;
    })[0];

    // Calculate max savings between highest total price and lowest total price
    const maxPrice = Math.max(...available.map(p => p.price + p.deliveryFee));
    const minPrice = Math.min(...available.map(p => p.price + p.deliveryFee));
    const maxSavings = Math.max(0, maxPrice - minPrice);

    return {
      bestValue,
      cheapest,
      highestRated,
      fastest,
      maxSavings,
      allPlatforms: available
    };
  }

  /**
   * Pick single optimal platform option based on user's chosen strategy.
   */
  public static selectByStrategy(platforms: PlatformPriceOption[], strategy: OrderStrategy): PlatformPriceOption {
    const summary = this.compare(platforms);

    switch (strategy) {
      case 'cheapest':
        return summary.cheapest;
      case 'highest_rated':
        return summary.highestRated;
      case 'fastest':
        return summary.fastest;
      case 'best_value':
      default:
        return summary.bestValue;
    }
  }

  /**
   * Match user query against canonical restaurant list using FuzzyMatchEngine
   */
  public static matchRestaurantName(query: string): FuzzyMatchResult<{ canonicalName: string }> {
    return FuzzyMatchEngine.matchRestaurant(query);
  }
}
