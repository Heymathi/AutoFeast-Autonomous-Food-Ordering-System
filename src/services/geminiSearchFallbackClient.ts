import { FoodItem } from '../types';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';

export interface FallbackMatch {
  id: string;
  confidence: number;
}

export interface FallbackResponse {
  matches: FallbackMatch[];
  cached?: boolean;
}

export interface FallbackResult {
  items: FoodItem[];
  isOffline: boolean;
  error?: string;
  latencyMs?: number;
}

/**
 * Checks if the browser client is currently online
 */
export function isClientOnline(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

/**
 * Calls /api/search-fallback when local search returns not-found or low confidence (< 0.45).
 * - Checks navigator.onLine first; if offline, skips Gemini and flags isOffline: true.
 * - Enforces a 5-second timeout via AbortController.
 * - Maps valid returned IDs to catalog FoodItems tagged with isSmartSearch: true.
 * - Never throws; handles network errors and timeouts gracefully.
 */
export async function fetchSearchFallback(
  text: string,
  language: string = 'en',
  timeoutMs: number = 5000
): Promise<FallbackResult> {
  if (!text || !text.trim()) {
    return { items: [], isOffline: false };
  }

  // If offline, skip Gemini immediately
  if (!isClientOnline()) {
    return { items: [], isOffline: true };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const startTime = performance.now();
    const res = await fetch('/api/search-fallback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text.trim(),
        language: ['en', 'ta', 'hi'].includes(language) ? language : 'en'
      }),
      signal: controller.signal
    });

    clearTimeout(timer);
    const latency = Math.round(performance.now() - startTime);

    if (!res.ok) {
      console.warn(`[Search Fallback]: API returned HTTP ${res.status} (${latency}ms)`);
      return { items: [], isOffline: false, error: `status_${res.status}`, latencyMs: latency };
    }

    const data: FallbackResponse = await res.json();
    const matches = Array.isArray(data?.matches) ? data.matches : [];

    // Diagnostic console logging (local score, fallback called, latency, IDs returned)

    // Map matched IDs to catalog items with isSmartSearch: true flag
    const matchedItems: FoodItem[] = [];
    for (const match of matches) {
      const catalogItem = INDIAN_FOOD_CATALOG.find(f => f.id === match.id);
      if (catalogItem) {
        matchedItems.push({
          ...catalogItem,
          isSmartSearch: true
        });
      }
    }

    return { items: matchedItems, isOffline: false, latencyMs: latency };
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') {
      console.warn('[Search Fallback]: Request aborted due to 5000ms timeout.');
      return { items: [], isOffline: false, error: 'timeout' };
    }
    console.warn('[Search Fallback]: Network/fetch error:', err?.message || String(err));
    return { items: [], isOffline: !isClientOnline(), error: 'network_error' };
  }
}

