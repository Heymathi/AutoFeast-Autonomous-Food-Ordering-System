import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { HealthDietaryNluService } from '../services/healthDietaryNluService';
import { HealthDietaryVoiceModal } from '../components/HealthDietaryVoiceModal';
import { AppProvider } from '../context/AppContext';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';

describe('AutoFeast AI – Health-Based Recommendation System Comprehensive Verification Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    HealthDietaryNluService.clearCache();

    // Mock fetch for tests to simulate API / network failure or timeout safely
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/voice/health-nlu')) {
        // Return 503 so pipeline automatically verifies the deterministic catalog fallback
        return Promise.resolve({
          ok: false,
          status: 503,
          json: () => Promise.resolve({ error: 'gemini_unavailable' })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, items: [] })
      });
    });
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  describe('1. Health Condition, Age, Dietary & Combined Query Matching', () => {
    it('handles query: "Food for a heart patient" with cardiovascular-safe dishes and reasons', async () => {
      const result = await HealthDietaryNluService.analyzeHealthContextAndSuggestFood('Food for a heart patient', 'en');

      expect(result.suggestions.length).toBeGreaterThanOrEqual(2);
      expect(result.healthContextSummary).toContain('Heart Care');

      const itemIds = result.suggestions.map(s => s.foodItem.id);
      // Heart-safe items: Steamed idli sambar, Kerala appam stew, whole wheat chapati
      expect(itemIds).toContain('idli-sambar');
      // Must NOT recommend deep-fried or oily non-veg items
      expect(itemIds).not.toContain('parotta-kothu');
      expect(itemIds).not.toContain('butter-chicken');
      expect(itemIds).not.toContain('chole-bhature');

      // Reason includes cardiovascular/heart health
      const idliSug = result.suggestions.find(s => s.foodItem.id === 'idli-sambar');
      expect(idliSug?.reasonEn.toLowerCase()).toContain('cardiovascular');
    });

    it('handles age-based query: "Food for a 60-year-old person" with soft, easily digestible dishes', async () => {
      const result = await HealthDietaryNluService.analyzeHealthContextAndSuggestFood('Food for a 60-year-old person', 'en');

      expect(result.suggestions.length).toBeGreaterThanOrEqual(2);
      expect(result.detectedAttributes?.isElderly).toBe(true);

      const itemIds = result.suggestions.map(s => s.foodItem.id);
      expect(itemIds).toContain('idli-sambar');
      expect(itemIds).not.toContain('parotta-kothu');

      const idliSug = result.suggestions.find(s => s.foodItem.id === 'idli-sambar');
      expect(idliSug?.reasonEn.toLowerCase()).toMatch(/seniors|older adults|chew|digest/i);
    });

    it('handles dietary query: "Mild food" by prioritizing non-spicy and soothing dishes', async () => {
      const result = await HealthDietaryNluService.analyzeHealthContextAndSuggestFood('Mild food', 'en');

      expect(result.suggestions.length).toBeGreaterThanOrEqual(2);
      expect(result.detectedAttributes?.isMild).toBe(true);

      const itemIds = result.suggestions.map(s => s.foodItem.id);
      expect(itemIds).toContain('kerala-appam-stew');
      expect(itemIds).toContain('idli-sambar');
      // No spicy items
      expect(itemIds).not.toContain('biryani-hyderabadi');
      expect(itemIds).not.toContain('chinese-fried-rice');
    });

    it('handles dietary query: "Low-oil vegetarian food" with zero-oil and steamed items', async () => {
      const result = await HealthDietaryNluService.analyzeHealthContextAndSuggestFood('Low-oil vegetarian food', 'en');

      expect(result.suggestions.length).toBeGreaterThanOrEqual(2);
      expect(result.detectedAttributes?.isLowOil).toBe(true);
      expect(result.detectedAttributes?.isVegetarian).toBe(true);

      // All returned items must be strictly vegetarian
      result.suggestions.forEach(s => {
        expect(s.foodItem.isVeg).toBe(true);
      });

      const itemIds = result.suggestions.map(s => s.foodItem.id);
      expect(itemIds).toContain('idli-sambar');
      expect(itemIds).not.toContain('parotta-kothu');
      expect(itemIds).not.toContain('chole-bhature');
    });

    it('handles condition query: "Diabetic-friendly breakfast" with high-fiber whole grain & no sweets', async () => {
      const result = await HealthDietaryNluService.analyzeHealthContextAndSuggestFood('Diabetic-friendly breakfast', 'en');

      expect(result.suggestions.length).toBeGreaterThanOrEqual(2);
      expect(result.detectedAttributes?.conditions).toContain('Diabetes');

      const itemIds = result.suggestions.map(s => s.foodItem.id);
      expect(itemIds).toContain('chapati-kurma');
      expect(itemIds).not.toContain('dessert-gulab-jamun');

      const chapatiSug = result.suggestions.find(s => s.foodItem.id === 'chapati-kurma');
      expect(chapatiSug?.reasonEn.toLowerCase()).toContain('blood sugar');
      expect(chapatiSug?.dietaryAttributes).toContain('Diabetic-Friendly');
    });

    it('handles combined multi-requirement query: "Mild vegetarian food for a 60-year-old heart patient"', async () => {
      const result = await HealthDietaryNluService.analyzeHealthContextAndSuggestFood(
        'Mild vegetarian food for a 60-year-old heart patient',
        'en'
      );

      expect(result.suggestions.length).toBeGreaterThanOrEqual(2);
      expect(result.detectedAttributes?.isElderly).toBe(true);
      expect(result.detectedAttributes?.isMild).toBe(true);
      expect(result.detectedAttributes?.isVegetarian).toBe(true);
      expect(result.detectedAttributes?.conditions).toContain('Heart Patient');

      result.suggestions.forEach(s => {
        expect(s.foodItem.isVeg).toBe(true);
      });

      const itemIds = result.suggestions.map(s => s.foodItem.id);
      expect(itemIds).toContain('idli-sambar');
      expect(itemIds).toContain('kerala-appam-stew');
      expect(itemIds).not.toContain('parotta-kothu');
      expect(itemIds).not.toContain('butter-chicken');
    });

    it('correctly understands Tamil query: "60 வயது அப்பாவுக்கு இதயப் பிரச்சனை, காரமில்லாத உணவு"', async () => {
      const result = await HealthDietaryNluService.analyzeHealthContextAndSuggestFood(
        '60 வயது அப்பாவுக்கு இதயப் பிரச்சனை, காரமில்லாத உணவு',
        'ta'
      );

      expect(result.targetPerson).toBe('appa');
      expect(result.detectedAttributes?.isElderly).toBe(true);
      expect(result.detectedAttributes?.isMild).toBe(true);
      expect(result.suggestions.length).toBeGreaterThanOrEqual(2);

      const idliSug = result.suggestions.find(s => s.foodItem.id === 'idli-sambar');
      expect(idliSug?.reasonTa).toBeDefined();
      expect(idliSug?.reasonTa.length).toBeGreaterThan(10);
    });

    it('correctly understands Hindi query: "60 वर्ष के बुजुर्ग के लिए हल्का शाकाहारी खाना"', async () => {
      const result = await HealthDietaryNluService.analyzeHealthContextAndSuggestFood(
        '60 वर्ष के बुजुर्ग के लिए हल्का शाकाहारी खाना',
        'hi'
      );

      expect(result.detectedAttributes?.isElderly).toBe(true);
      expect(result.detectedAttributes?.isMild).toBe(true);
      expect(result.detectedAttributes?.isVegetarian).toBe(true);
      expect(result.suggestions.length).toBeGreaterThanOrEqual(2);

      const idliSug = result.suggestions.find(s => s.foodItem.id === 'idli-sambar');
      expect(idliSug?.reasonHi).toBeDefined();
      expect(idliSug?.reasonHi.length).toBeGreaterThan(10);
    });
  });

  describe('2. Pipeline Performance, Timeout, and Caching', () => {
    it('returns cached results immediately (< 5ms) on repeated query', async () => {
      const query = 'Food for a heart patient';
      const start1 = performance.now();
      const res1 = await HealthDietaryNluService.analyzeHealthContextAndSuggestFood(query, 'en');
      const time1 = performance.now() - start1;

      const start2 = performance.now();
      const res2 = await HealthDietaryNluService.analyzeHealthContextAndSuggestFood(query, 'en');
      const time2 = performance.now() - start2;

      expect(res1.healthContextSummary).toBe(res2.healthContextSummary);
      expect(time2).toBeLessThan(10); // Cache response is practically instantaneous
    });

    it('handles API timeout / failure gracefully without hanging or throwing', async () => {
      // Simulate network hanging forever until AbortController signal fires
      global.fetch = vi.fn().mockImplementation((_url, options) => {
        return new Promise((_resolve, reject) => {
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              const err = new Error('The operation was aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }
        });
      });

      const start = performance.now();
      // Should fall back deterministically without infinite hang
      const result = await HealthDietaryNluService.analyzeHealthContextAndSuggestFood('mild food', 'en');
      const duration = performance.now() - start;

      expect(result).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThanOrEqual(2);
      expect(duration).toBeLessThan(4500); // Enforces strict timeout
    });
  });

  describe('3. Modal UI, Text Input, and Actions Verification', () => {
    it('renders text input field and allows typing health queries', async () => {
      render(
        <AppProvider>
          <HealthDietaryVoiceModal isOpen={true} onClose={vi.fn()} />
        </AppProvider>
      );

      const input = document.getElementById('health-condition-input') as HTMLInputElement;
      expect(input).toBeDefined();

      const analyzeBtn = screen.getByRole('button', { name: /Analyze|ஆய்வு செய்|खोजें/i });
      expect(analyzeBtn).toBeDefined();

      // Enter query and click analyze
      await act(async () => {
        fireEvent.change(input, { target: { value: 'mild food for heart patient' } });
        fireEvent.click(analyzeBtn);
      });

      // Must transition past analyzing step and render recommendation cards
      await waitFor(() => {
        expect(screen.getByText(/Steamed Button Sambar Idli/i)).toBeDefined();
      }, { timeout: 3000 });

      // Verify actions exist: Compare, Order / Schedule, Add to Cart
      expect(screen.getAllByRole('button', { name: /Compare/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: /Order \/ Schedule/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: /Add to Cart/i }).length).toBeGreaterThan(0);
    });

    it('displays why food fits and dietary attribute badges', async () => {
      render(
        <AppProvider>
          <HealthDietaryVoiceModal isOpen={true} onClose={vi.fn()} />
        </AppProvider>
      );

      const input = document.getElementById('health-condition-input') as HTMLInputElement;
      const analyzeBtn = screen.getByRole('button', { name: /Analyze|ஆய்வு செய்|खोजें/i });

      await act(async () => {
        fireEvent.change(input, { target: { value: 'food for diabetic patient' } });
      });

      await act(async () => {
        fireEvent.click(analyzeBtn);
      });

      await waitFor(() => {
        expect(screen.getAllByText(/Why this fits:/i).length).toBeGreaterThan(0);
      }, { timeout: 3500 });
      expect(screen.getAllByText(/Diabetic-Friendly/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Whole-Wheat/i).length).toBeGreaterThan(0);
    });

    it('retains medical safety disclaimer notice at all times', () => {
      render(
        <AppProvider>
          <HealthDietaryVoiceModal isOpen={true} onClose={vi.fn()} />
        </AppProvider>
      );

      expect(screen.getByText(/Medical Disclaimer Notice/i)).toBeDefined();
      expect(screen.getByText(/not medical advice — please consult a doctor/i)).toBeDefined();
    });
  });
});
