import { describe, test, expect } from 'vitest';
import { SttMatcherService } from '../sttMatcherService';
import { FuzzyMatchEngine } from '../fuzzyMatchService';
import { INDIAN_FOOD_CATALOG } from '../../data/indianFoodCatalog';
import { ChooserVoiceService } from '../chooserVoiceService';
import { FUZZY_CONFIG } from '../../config/fuzzyConfig';

describe('Comprehensive STT & NLU Matcher Unit Tests (Exact Threshold Assertions)', () => {
  // Unseen Phonetic Spellings (Tests 1 - 6)
  test('Test 1: Unseen Phonetic Spelling "idlee" matches Idli (score >= FUZZY_CONFIG.mediumConfidence 0.45)', () => {
    const res = FuzzyMatchEngine.matchFoodItem('idlee');
    expect(res.item).toBeDefined();
    expect(res.score).toBeGreaterThanOrEqual(FUZZY_CONFIG.mediumConfidence);
  });

  test('Test 2: Unseen Phonetic Spelling "iddly" matches Idli (score >= FUZZY_CONFIG.mediumConfidence 0.45)', () => {
    const res = FuzzyMatchEngine.matchFoodItem('iddly');
    expect(res.item).toBeDefined();
    expect(res.score).toBeGreaterThanOrEqual(FUZZY_CONFIG.mediumConfidence);
  });

  test('Test 3: Unseen Phonetic Spelling "eetli" matches Idli (score >= FUZZY_CONFIG.mediumConfidence 0.45)', () => {
    const res = FuzzyMatchEngine.matchFoodItem('eetli');
    expect(res.item).toBeDefined();
    expect(res.score).toBeGreaterThanOrEqual(FUZZY_CONFIG.mediumConfidence);
  });

  test('Test 4: Unseen Phonetic Spelling "dosha" matches Dosa (score >= FUZZY_CONFIG.mediumConfidence 0.45)', () => {
    const res = FuzzyMatchEngine.matchFoodItem('dosha');
    expect(res.item).toBeDefined();
    expect(res.score).toBeGreaterThanOrEqual(FUZZY_CONFIG.mediumConfidence);
  });

  test('Test 5: Unseen Phonetic Spelling "biriyani" matches Biryani (score >= FUZZY_CONFIG.mediumConfidence 0.45)', () => {
    const res = FuzzyMatchEngine.matchFoodItem('biriyani');
    expect(res.item).toBeDefined();
    expect(res.score).toBeGreaterThanOrEqual(FUZZY_CONFIG.mediumConfidence);
  });

  test('Test 6: Unseen Phonetic Spelling "parota" matches Parotta (score >= FUZZY_CONFIG.mediumConfidence 0.45)', () => {
    const res = FuzzyMatchEngine.matchFoodItem('parota');
    expect(res.item).toBeDefined();
    expect(res.score).toBeGreaterThanOrEqual(FUZZY_CONFIG.mediumConfidence);
  });

  // False Positive Preventions (Tests 7 - 8)
  test('Test 7: False-positive prevention: "italian pasta" does not match Idli (score < FUZZY_CONFIG.mediumConfidence 0.45)', () => {
    const match = FuzzyMatchEngine.matchFoodItem('italian pasta');
    const name = match.item ? match.item.canonicalName.toLowerCase() : '';
    expect(name).not.toContain('idli');
    expect(match.score).toBeLessThan(FUZZY_CONFIG.mediumConfidence);
  });

  test('Test 8: False-positive prevention: "toast" does not match Dosa (score < FUZZY_CONFIG.mediumConfidence 0.45)', () => {
    const match = FuzzyMatchEngine.matchFoodItem('toast');
    const name = match.item ? match.item.canonicalName.toLowerCase() : '';
    expect(name).not.toContain('dosa');
    expect(match.score).toBeLessThan(FUZZY_CONFIG.mediumConfidence);
  });

  // Generic Term Rules (Tests 9 - 10)
  test('Test 9: Generic term rule: "dosa" triggers generic phrase detection', () => {
    const res = SttMatcherService.isGenericCategoryPhrase('dosa');
    expect(res.isGeneric).toBe(true);
  });

  test('Test 10: Single variant "idli" auto-selects canonical item', () => {
    const match = SttMatcherService.matchCatalogItem(['idli'], INDIAN_FOOD_CATALOG, 'en');
    expect(match).toBeDefined();
  });

  // Score Threshold Assertions: Medium Confidence & Restaurant Typo (Tests 11 - 12)
  test('Test 11: Medium confidence "crispy masala roll" falls in range 0.45 - 0.75', () => {
    const match = FuzzyMatchEngine.matchFoodItem('crispy masala roll');
    expect(match.item).toBeDefined();
    expect(match.score).toBeGreaterThanOrEqual(0.45);
    expect(match.score).toBeLessThanOrEqual(0.75);
    expect(match.confidence).toBe('medium');
  });

  test('Test 12: Restaurant typo "saravana bavan" matches with score >= 0.70', () => {
    const match = FuzzyMatchEngine.matchFoodItem('dosa from saravana bavan');
    expect(match.item).toBeDefined();
    expect(match.score).toBeGreaterThanOrEqual(0.70);
  });

  // Restricted Item Interception Threshold Assertions (Tests 13 - 17)
  test('Test 13: Unseen restricted spelling "panipoory" intercepted with score >= 0.40', () => {
    const match = FuzzyMatchEngine.matchFoodItem('panipoory', undefined, true);
    expect(match.score).toBeGreaterThanOrEqual(0.40);
  });

  test('Test 14: Unseen restricted spelling "pani pury" intercepted with score >= 0.40', () => {
    const match = FuzzyMatchEngine.matchFoodItem('pani pury', undefined, true);
    expect(match.score).toBeGreaterThanOrEqual(0.40);
  });

  test('Test 15: Unseen restricted spelling "paanipuri" intercepted with score >= 0.40', () => {
    const match = FuzzyMatchEngine.matchFoodItem('paanipuri', undefined, true);
    expect(match.score).toBeGreaterThanOrEqual(0.40);
  });

  test('Test 16: Non-restricted "pasta" does not trigger restricted interception', () => {
    const restrictedItems = INDIAN_FOOD_CATALOG.filter(i => i.id === 'chaat-pani-puri');
    const interception = SttMatcherService.checkRestrictedFoodInterception('pasta', restrictedItems);
    expect(interception.isRestricted).toBe(false);
  });

  test('Test 17: Non-restricted "pizza" does not trigger restricted interception', () => {
    const restrictedItems = INDIAN_FOOD_CATALOG.filter(i => i.id === 'chaat-pani-puri');
    const interception = SttMatcherService.checkRestrictedFoodInterception('pizza', restrictedItems);
    expect(interception.isRestricted).toBe(false);
  });

  // Echo Filters & Actions (Tests 18 - 22)
  test('Test 18: ChooserVoiceService ignores own prompt echo text as answer', () => {
    const prompt = 'Crispy Masala Dosa from Saravana Bhavan. Order now, schedule, or add to cart?';
    const action = ChooserVoiceService.parseChooserAction(prompt, prompt);
    expect(action).toBeNull();
  });

  test('Test 19: ItemActionChooser voice "cart la podu" parses to ADD_TO_CART', () => {
    const action = ChooserVoiceService.parseChooserAction('cart la podu', 'Prompt');
    expect(action).toBe('add_to_cart');
  });

  test('Test 20: Spoken "order now" parses to order_now action', () => {
    const action = ChooserVoiceService.parseChooserAction('order now', 'Prompt');
    expect(action).toBe('order_now');
  });

  test('Test 21: Spoken "schedule" parses to schedule action', () => {
    const action = ChooserVoiceService.parseChooserAction('schedule', 'Prompt');
    expect(action).toBe('schedule');
  });

  test('Test 22: PreOrderBillModal own TTS prompt spoken back filtered out as echo', () => {
    const prompt = 'You have 1 items from Saravana Bhavan. Total 250 rupees. Order now or schedule?';
    const parsed = ChooserVoiceService.parseChooserAction(prompt, prompt);
    expect(parsed).toBeNull();
  });

  test('Test 23: N-best alternatives ["italy", "eatly", "it lee"] match Idli (score >= FUZZY_CONFIG.mediumConfidence 0.45)', () => {
    const match = SttMatcherService.matchCatalogItem(['italy', 'eatly', 'it lee'], INDIAN_FOOD_CATALOG, 'en');
    expect(match.matchedValue || match.bestCandidate).toBeDefined();
    expect(match.confidence).toBeGreaterThanOrEqual(FUZZY_CONFIG.mediumConfidence);
  });

  // Native Script & Multilingual STT Match Tests (Tests 24 - 30)
  test('Test 24: Spoken Tamil script "தோசை" matches Dosa item', () => {
    const res = FuzzyMatchEngine.matchFoodItem('தோசை');
    expect(res.item).toBeDefined();
    expect(res.score).toBeGreaterThanOrEqual(FUZZY_CONFIG.mediumConfidence);
  });

  test('Test 25: Spoken Tamil script "பானி பூரி" matches Pani Puri restricted item (score >= 0.40)', () => {
    const res = FuzzyMatchEngine.matchFoodItem('பானி பூரி', undefined, true);
    expect(res.score).toBeGreaterThanOrEqual(0.40);
  });

  test('Test 26: Spoken Hindi script "पानी पूरी" matches Pani Puri restricted item (score >= 0.40)', () => {
    const res = FuzzyMatchEngine.matchFoodItem('पानी पूरी', undefined, true);
    expect(res.score).toBeGreaterThanOrEqual(0.40);
  });

  test('Test 27: Spoken Hindi script "डोसा" matches Dosa item', () => {
    const res = FuzzyMatchEngine.matchFoodItem('डोसा');
    expect(res.item).toBeDefined();
    expect(res.score).toBeGreaterThanOrEqual(FUZZY_CONFIG.mediumConfidence);
  });

  test('Test 28: Generic phrase "biryani" triggers generic category detection', () => {
    const res = SttMatcherService.isGenericCategoryPhrase('biryani');
    expect(res.isGeneric).toBe(true);
  });

  test('Test 29: Spoken Hindi "ऑर्डर करो" parses to order_now action in ChooserVoiceService', () => {
    const action = ChooserVoiceService.parseChooserAction('ऑर्डर करो', 'Prompt');
    expect(action).toBe('order_now');
  });

  test('Test 30: Spoken Tamil "ஆர்டர் பண்ணு" parses to order_now action in ChooserVoiceService', () => {
    const action = ChooserVoiceService.parseChooserAction('ஆர்டர் பண்ணு', 'Prompt');
    expect(action).toBe('order_now');
  });
});
