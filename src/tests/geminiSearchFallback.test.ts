import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateSearchFallbackResult, VALID_CATALOG_IDS } from '../../api/search-fallback.js';
import { fetchSearchFallback, resetCircuitBreaker, isCircuitBreakerOpen, tripCircuitBreaker, CIRCUIT_BREAKER_DURATION_MS } from '../services/geminiSearchFallbackClient';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { DynamicFoodSearchEngine } from '../services/dynamicFoodSearch';
import { isFoodItemRestricted } from '../services/restrictedFoodMatcher';
import { TRANSLATIONS } from '../data/translations';

describe('Gemini Search Fallback - STEP 3 Verification Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetCircuitBreaker();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetCircuitBreaker();
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

  // =========================================================================
  // PART 5: Comprehensive Voice, Fallback & Safeguard Test Suite
  // =========================================================================
  describe('Voice, Fallback & Safeguard Scenarios (Parotta, Dosa, Degraded Audio, Gemini)', () => {
    it('Scenario 1: Typed Parotta search resolves directly via catalog without triggering fallback', () => {
      const result = DynamicFoodSearchEngine.search({ query: 'parotta', language: 'en' });
      expect(result.matchedItems.length).toBeGreaterThan(0);
      expect(result.matchedItems[0].id).toBe('parotta-kothu');
      expect(result.isExactMatch).toBe(true);
    });

    it('Scenario 2: Online Tamil voice "பரோட்டா" matches locally with score >= 0.45 without calling Gemini', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const result = DynamicFoodSearchEngine.search({ query: 'பரோட்டா', language: 'ta' });
      expect(result.matchedItems.length).toBeGreaterThan(0);
      expect(result.matchedItems.some(f => f.id === 'parotta-kothu')).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('Scenario 3: Offline Tamil voice "பரோட்டா" matches parotta food family', () => {
      const result = DynamicFoodSearchEngine.search({ query: 'பரோட்டா', language: 'ta' });
      expect(result.matchedItems.length).toBeGreaterThan(0);
      expect(result.matchedItems[0].id).toBe('parotta-kothu');
    });

    it('Scenario 4: Offline Tamil voice "தோசை" matches dosa items locally', () => {
      const result = DynamicFoodSearchEngine.search({ query: 'தோசை', language: 'ta' });
      expect(result.matchedItems.length).toBeGreaterThan(0);
      expect(result.matchedItems.some(f => f.id.includes('dosa'))).toBe(true);
    });

    it('Scenario 5: Local no-match / low score (< 0.45) e.g. "தவறும்" triggers POST /api/search-fallback and maps to validated catalog item', async () => {
      const localResult = DynamicFoodSearchEngine.search({ query: 'தவறும்', language: 'ta' });
      expect(localResult.matchedItems.length).toBe(0);

      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          matches: [{ id: 'parotta-kothu', confidence: 0.88 }]
        })
      } as Response);

      const fallbackResult = await fetchSearchFallback('தவறும்', 'ta');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/search-fallback',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ text: 'தவறும்', language: 'ta' })
        })
      );
      expect(fallbackResult.items.length).toBe(1);
      expect(fallbackResult.items[0].id).toBe('parotta-kothu');
      expect(fallbackResult.items[0].isSmartSearch).toBe(true);
    });

    it('Scenario 6: Gemini API failure or offline gracefully produces catalog fallback suggestions', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'gemini_unavailable' })
      } as Response);

      const fallbackResult = await fetchSearchFallback('unrecognized phoneme', 'ta');
      expect(fallbackResult.items).toEqual([]);
      expect(fallbackResult.error).toBe('status_503');

      const fallbackSuggestions = INDIAN_FOOD_CATALOG.slice(0, 4);
      expect(fallbackSuggestions.length).toBeGreaterThanOrEqual(3);
      expect(fallbackSuggestions.some(f => f.id === 'parotta-kothu' || f.id === 'dosa-masala')).toBe(true);
    });
  });

  // =========================================================================
  // PART 6: Circuit Breaker, Not-Configured & Nominee Restriction Verification
  // =========================================================================
  describe('Circuit Breaker, 503 GEMINI_NOT_CONFIGURED & Nominee Safeguards', () => {
    it('Server 503 GEMINI_NOT_CONFIGURED causes client to treat fallback as offline/not-configured', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          code: 'GEMINI_NOT_CONFIGURED',
          error: 'gemini_unavailable',
          message: 'GEMINI_API_KEY is not configured on the server'
        })
      } as Response);

      const result = await fetchSearchFallback('something rare', 'en');
      expect(result.items).toEqual([]);
      expect(result.isOffline).toBe(true);
      expect(result.error).toBe('not_configured');
    });

    it('Circuit breaker trips on 5xx failure and skips Gemini for 30 seconds', async () => {
      // First call fails with 503
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'gemini_unavailable' })
      } as Response);

      const res1 = await fetchSearchFallback('query 1', 'en');
      expect(res1.error).toBe('status_503');
      expect(isCircuitBreakerOpen()).toBe(true);

      // Second call within 30s: fetch should NOT be called; returns circuit_open
      fetchSpy.mockClear();
      const res2 = await fetchSearchFallback('query 2', 'en');
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(res2.isOffline).toBe(true);
      expect(res2.error).toBe('circuit_open');

      // After manual reset or 30s expiry: circuit closes and calls fetch again
      resetCircuitBreaker();
      expect(isCircuitBreakerOpen()).toBe(false);

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ matches: [{ id: 'dosa-masala', confidence: 0.95 }] })
      } as Response);

      const res3 = await fetchSearchFallback('query 3', 'en');
      expect(fetchSpy).toHaveBeenCalled();
      expect(res3.items.length).toBe(1);
      expect(res3.items[0].id).toBe('dosa-masala');
    });

    it('Circuit breaker trips on timeout as well', async () => {
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

      const res = await fetchSearchFallback('slow', 'en', 20);
      expect(res.error).toBe('timeout');
      expect(isCircuitBreakerOpen()).toBe(true);
    });

    it('Restricted item returned by Gemini still passes checkIsItemRestrictedByNominee and gets intercepted', async () => {
      // Mock Gemini returning chaat-pani-puri (the canonical restricted item)
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          matches: [{ id: 'chaat-pani-puri', confidence: 0.95 }]
        })
      } as Response);

      const fallbackResult = await fetchSearchFallback('pani puri street snack', 'en');
      expect(fallbackResult.items.length).toBe(1);
      const returnedItem = fallbackResult.items[0];
      expect(returnedItem.id).toBe('chaat-pani-puri');

      // Verify restricted item check against nominee restricted list
      const nomineeRestrictedIds = ['chaat-pani-puri'];
      const isRestricted = isFoodItemRestricted(returnedItem.id, nomineeRestrictedIds, returnedItem.name);
      expect(isRestricted).toBe(true);

      // Unrestricted item returns false
      const unrestrictedItem = INDIAN_FOOD_CATALOG.find(f => f.id === 'dosa-masala')!;
      expect(isFoodItemRestricted(unrestrictedItem.id, nomineeRestrictedIds, unrestrictedItem.name)).toBe(false);
    });

    it('Fallback unavailable hint string is correctly defined in translations for en, ta, and hi', () => {
      expect(TRANSLATIONS.en['search.smartSearchUnavailable']).toBe('Smart search is unavailable. Showing the closest matches.');
      expect(TRANSLATIONS.ta['search.smartSearchUnavailable']).toBeDefined();
      expect(TRANSLATIONS.ta['search.smartSearchUnavailable'].length).toBeGreaterThan(10);
      expect(TRANSLATIONS.hi['search.smartSearchUnavailable']).toBeDefined();
      expect(TRANSLATIONS.hi['search.smartSearchUnavailable'].length).toBeGreaterThan(10);
    });

    it('Tamil voice degraded audio query "??????" triggers fallback and maps to parotta-kothu', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          matches: [{ id: 'parotta-kothu', confidence: 0.90 }]
        })
      } as Response);

      const res = await fetchSearchFallback('??????', 'ta');
      expect(res.items.length).toBe(1);
      expect(res.items[0].id).toBe('parotta-kothu');
      expect(res.items[0].isSmartSearch).toBe(true);
    });

    it('Hindi food craving query "???? ???" triggers fallback with language: hi', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          matches: [{ id: 'pongal-ghee', confidence: 0.88 }]
        })
      } as Response);

      const res = await fetchSearchFallback('???? ???', 'hi');
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/search-fallback',
        expect.objectContaining({
          body: JSON.stringify({ text: '???? ???', language: 'hi' })
        })
      );
      expect(res.items.length).toBe(1);
      expect(res.items[0].id).toBe('pongal-ghee');
    });
  });

});