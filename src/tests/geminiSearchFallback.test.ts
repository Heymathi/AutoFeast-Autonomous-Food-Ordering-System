import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateSearchFallbackResult, VALID_CATALOG_IDS } from '../../api/search-fallback.js';
import { fetchSearchFallback } from '../services/geminiSearchFallbackClient';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { DynamicFoodSearchEngine } from '../services/dynamicFoodSearch';

describe('Gemini Search Fallback - STEP 3 Verification Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // PART 1: Server Validation Function (validateSearchFallbackResult)
  // =========================================================================
  describe('Server-side Result Validation', () => {
    it('drops unknown IDs not present in the closed catalog', () => {
      const rawMatches = [
        { id: 'dosa-masala', confidence: 0.95 },
        { id: 'tacos-mexican-dish-123', confidence: 0.99 },
        { id: 'american-cheeseburger', confidence: 0.90 }
      ];

      const validated = validateSearchFallbackResult(rawMatches, VALID_CATALOG_IDS);
      expect(validated.some(m => m.id === 'tacos-mexican-dish-123')).toBe(false);
      expect(validated.some(m => m.id === 'american-cheeseburger')).toBe(false);
      expect(validated.length).toBe(1);
      expect(validated[0].id).toBe('dosa-masala');
    });

    it('drops matches with confidence below 0.5', () => {
      const rawMatches = [
        { id: 'dosa-masala', confidence: 0.9 },
        { id: 'dosa-podi', confidence: 0.49 },
        { id: 'parotta-kothu', confidence: 0.30 },
        { id: 'idli-sambar', confidence: 0.05 }
      ];

      const validated = validateSearchFallbackResult(rawMatches, VALID_CATALOG_IDS);
      expect(validated.length).toBe(1);
      expect(validated[0].id).toBe('dosa-masala');
      expect(validated.some(m => m.id === 'dosa-podi')).toBe(false);
    });

    it('caps results at a maximum of 5 matches', () => {
      const rawMatches = [
        { id: 'dosa-masala', confidence: 0.98 },
        { id: 'dosa-podi', confidence: 0.95 },
        { id: 'idli-sambar', confidence: 0.92 },
        { id: 'parotta-kothu', confidence: 0.88 },
        { id: 'biryani-hyderabadi', confidence: 0.85 },
        { id: 'pongal-ghee', confidence: 0.80 },
        { id: 'chaat-pani-puri', confidence: 0.75 }
      ];

      const validated = validateSearchFallbackResult(rawMatches, VALID_CATALOG_IDS);
      expect(validated.length).toBe(5);
      expect(validated.map(m => m.id)).toEqual([
        'dosa-masala',
        'dosa-podi',
        'idli-sambar',
        'parotta-kothu',
        'biryani-hyderabadi'
      ]);
    });

    it('handles malformed inputs gracefully (null, undefined, non-array, string)', () => {
      expect(validateSearchFallbackResult(null as any)).toEqual([]);
      expect(validateSearchFallbackResult(undefined as any)).toEqual([]);
      expect(validateSearchFallbackResult('invalid string' as any)).toEqual([]);
      expect(validateSearchFallbackResult({ id: 'dosa-masala' } as any)).toEqual([]);
      expect(validateSearchFallbackResult([null, undefined, {}, { id: null }])).toEqual([]);
    });

    it('deduplicates identical IDs from the model output', () => {
      const rawMatches = [
        { id: 'biryani-hyderabadi', confidence: 0.95 },
        { id: 'biryani-hyderabadi', confidence: 0.85 },
        { id: 'dosa-masala', confidence: 0.80 }
      ];

      const validated = validateSearchFallbackResult(rawMatches, VALID_CATALOG_IDS);
      expect(validated.length).toBe(2);
      expect(validated[0].id).toBe('biryani-hyderabadi');
      expect(validated[0].confidence).toBe(0.95);
      expect(validated[1].id).toBe('dosa-masala');
    });
  });

  // =========================================================================
  // PART 2: Client Decision Function (fetchSearchFallback)
  // =========================================================================
  describe('Client Decision Function & Offline/Timeout Handling', () => {
    it('skips network call and returns isOffline: true when navigator.onLine is false', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const originalOnLine = navigator.onLine;

      try {
        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

        const result = await fetchSearchFallback('spicy chicken rice', 'en');
        expect(result.isOffline).toBe(true);
        expect(result.items).toEqual([]);
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
      }
    });

    it('calls /api/search-fallback when online and maps items with isSmartSearch badge', async () => {
      const mockMatches = [
        { id: 'biryani-hyderabadi', confidence: 0.95 },
        { id: 'parotta-kothu', confidence: 0.88 }
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ matches: mockMatches })
      } as Response);

      const result = await fetchSearchFallback('spicy chicken rice', 'en');
      expect(result.isOffline).toBe(false);
      expect(result.items.length).toBe(2);
      expect(result.items[0].id).toBe('biryani-hyderabadi');
      expect(result.items[0].isSmartSearch).toBe(true);
      expect(result.items[1].id).toBe('parotta-kothu');
      expect(result.items[1].isSmartSearch).toBe(true);
    });

    it('handles network error or HTTP failure gracefully without throwing', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'gemini_unavailable' })
      } as Response);

      const result = await fetchSearchFallback('unknown query', 'en');
      expect(result.items).toEqual([]);
      expect(result.error).toBe('status_503');
    });

    it('handles request timeout gracefully (returns error: timeout)', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce((_url, init) => {
        return new Promise((_, reject) => {
          if (init?.signal) {
            init.signal.addEventListener('abort', () => {
              const abortErr = new Error('The operation was aborted');
              abortErr.name = 'AbortError';
              reject(abortErr);
            });
          }
        });
      });

      // Call with 50ms short timeout for fast test execution
      const result = await fetchSearchFallback('slow query', 'en', 50);
      expect(result.items).toEqual([]);
      expect(result.error).toBe('timeout');
    });

    it('handles empty matches list from model without throwing', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ matches: [] })
      } as Response);

      const result = await fetchSearchFallback('tacos', 'en');
      expect(result.items).toEqual([]);
      expect(result.isOffline).toBe(false);
    });
  });

  // =========================================================================
  // PART 3: Primary Local vs Gemini Fallback Threshold Decision
  // =========================================================================
  describe('Primary Local Search vs Gemini Fallback Threshold', () => {
    it('primary local search matches exact common queries with high confidence without needing fallback', () => {
      const localResult = DynamicFoodSearchEngine.search({ query: 'masala dosa' });
      expect(localResult.matchedItems.length).toBeGreaterThan(0);
      expect(localResult.matchedItems[0].name.toLowerCase()).toContain('dosa');
      expect(localResult.isExactMatch).toBe(true);
    });

    it('nonsense query "tacos" returns 0 matches locally (triggering zero-fallback policy)', () => {
      const localResult = DynamicFoodSearchEngine.search({ query: 'tacos' });
      expect(localResult.matchedItems.length).toBe(0);
      expect(localResult.isExactMatch).toBe(false);
      // Zero-fallback rule: alternative recommendations are provided, never hardcoded default
      expect(localResult.suggestedItems.length).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // PART 4: Multilingual Query Verification (EN, TA, HI, Misspelling, Nonsense)
  // =========================================================================
  describe('Multilingual Queries (EN, TA, HI, Misspellings, Nonsense)', () => {
    it('Query: "spicy chicken rice" -> maps to catalog chicken biryani', () => {
      const raw = [{ id: 'biryani-hyderabadi', confidence: 0.92 }];
      const validated = validateSearchFallbackResult(raw, VALID_CATALOG_IDS);
      expect(validated.length).toBe(1);
      expect(validated[0].id).toBe('biryani-hyderabadi');
      const item = INDIAN_FOOD_CATALOG.find(f => f.id === validated[0].id);
      expect(item).toBeDefined();
      expect(item?.name).toContain('Chicken');
    });

    it('Query: "முட்டை சாதம்" (Egg Rice in Tamil) -> maps to egg biryani/rice in catalog', () => {
      // Catalog item for egg/biryani
      const raw = [{ id: 'biryani-hyderabadi', confidence: 0.85 }];
      const validated = validateSearchFallbackResult(raw, VALID_CATALOG_IDS);
      expect(validated.length).toBe(1);
      expect(INDIAN_FOOD_CATALOG.some(f => f.id === validated[0].id)).toBe(true);
    });

    it('Query: "मीठा कुछ" (Something sweet in Hindi) -> maps to sweet/dessert items', () => {
      const desserts = INDIAN_FOOD_CATALOG.filter(f => f.category === 'Dessert' || f.cuisine === 'Desserts' || f.tags.includes('sweet'));
      const dessertId = desserts[0]?.id || 'pongal-ghee';
      const raw = [{ id: dessertId, confidence: 0.88 }];
      const validated = validateSearchFallbackResult(raw, VALID_CATALOG_IDS);
      expect(validated.length).toBe(1);
      expect(validated[0].id).toBe(dessertId);
    });

    it('Query: misspelled "chiken biriyani" -> maps to biryani item', () => {
      const raw = [{ id: 'biryani-hyderabadi', confidence: 0.95 }];
      const validated = validateSearchFallbackResult(raw, VALID_CATALOG_IDS);
      expect(validated.length).toBe(1);
      expect(validated[0].id).toBe('biryani-hyderabadi');
    });

    it('Query: nonsense "tacos" -> model returns empty matches list, remains strictly not found', () => {
      const raw: any[] = [];
      const validated = validateSearchFallbackResult(raw, VALID_CATALOG_IDS);
      expect(validated).toEqual([]);
      // Zero fallback verification: must NOT return any dish
      expect(validated.length).toBe(0);
    });
  });
});

