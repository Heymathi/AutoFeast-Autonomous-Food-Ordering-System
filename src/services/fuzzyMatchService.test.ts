import { describe, test, expect } from 'vitest';
import { FuzzyMatchEngine } from './fuzzyMatchService';

describe('Unified Shared Fuzzy Matching Engine Unit Tests', () => {
  // Test Case 1: "italy", "idly", "eatly", "இட்லி", "इडली" -> Idli
  const idliInputs = ['italy', 'idly', 'eatly', 'இட்லி', 'इडली'];
  idliInputs.forEach((input) => {
    test(`Idli Test Input: "${input}"`, () => {
      const res = FuzzyMatchEngine.matchFoodItem(input);
      expect(res.item?.id).toBe('idli-sambar');
      expect(['high', 'medium']).toContain(res.confidence);
    });
  });

  // Test Case 2: "panipuri", "pani puri", "பானி பூரி", "पानी पूरी" -> Pani Puri
  const paniPuriInputs = ['panipuri', 'pani puri', 'பானி பூரி', 'पानी पूरी'];
  paniPuriInputs.forEach((input) => {
    test(`Pani Puri Test Input: "${input}"`, () => {
      const res = FuzzyMatchEngine.matchFoodItem(input);
      expect(res.item?.id).toBe('pani-puri');
      expect(['high', 'medium']).toContain(res.confidence);
    });
  });

  // Test Case 3: "kothu parota chicken" -> Chicken Kothu Parotta (Token order independence)
  test('Token Order Test Input: "kothu parota chicken"', () => {
    const res = FuzzyMatchEngine.matchFoodItem('kothu parota chicken');
    expect(res.item?.id).toBe('kothu-parotta');
  });

  // Test Case 4: Gibberish "xqzv" -> low confidence / notUnderstood
  test('Gibberish Test Input: "xqzv"', () => {
    const res = FuzzyMatchEngine.matchFoodItem('xqzv');
    expect(res.confidence).toBe('low');
    expect(res.score).toBeLessThan(0.60);
  });

  // Test Case 5: Restricted Item check with strict threshold (>= 0.50)
  test('Restricted Safety Check Input: "panipuri"', () => {
    const res = FuzzyMatchEngine.matchFoodItem('panipuri', undefined, true);
    expect(res.score).toBeGreaterThanOrEqual(0.50);
  });
});
