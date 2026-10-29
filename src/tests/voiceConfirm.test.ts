/**
 * voiceConfirm.test.ts
 * Tests for the pure-function voice confirmation + restaurant-selection matchers.
 * No DOM, no window, no speechSynthesis – safe to run in vitest's Node environment.
 */
import { describe, expect, test } from 'vitest';
import { SttMatcherService } from '../services/sttMatcherService';

// ────────────────────────────────────────────────────────────
// Sample restaurant lists used across tests
// ────────────────────────────────────────────────────────────
const DOSA_RESTAURANTS = [
  'Murugan Idli Shop',
  'Saravana Bhavan',
  'A2B Adyar Ananda Bhavan',
  'Sangeetha Veg Restaurant',
];

const BIRYANI_RESTAURANTS = ['Bawarchi Biryani', 'Star Ambur Biryani'];

const SINGLE_RESTAURANT = ['Haldirams'];

// ────────────────────────────────────────────────────────────
// matchConfirmation
// ────────────────────────────────────────────────────────────
describe('matchConfirmation – English YES', () => {
  test.each([
    ['yes'],
    ['yeah'],
    ['yep'],
    ['ok'],
    ['okay'],
    ['sure'],
    ['proceed'],
    ['confirm'],
    ['correct'],
    ['do it'],
    ['go ahead'],
    ['absolutely'],
  ])('"%s" → YES', (phrase) => {
    expect(SttMatcherService.matchConfirmation([phrase], 'en').matchedValue).toBe('YES');
  });
});

describe('matchConfirmation – English NO', () => {
  test.each([
    ['no'],
    ['nope'],
    ['cancel'],
    ['stop'],
    ['wrong'],
    ['deny'],
    ['reject'],
    ['nah'],
  ])('"%s" → NO', (phrase) => {
    expect(SttMatcherService.matchConfirmation([phrase], 'en').matchedValue).toBe('NO');
  });

  test('"no, cancel" → NO (not accidentally YES)', () => {
    expect(SttMatcherService.matchConfirmation(['no, cancel'], 'en').matchedValue).toBe('NO');
  });

  test('"no please" → NO', () => {
    expect(SttMatcherService.matchConfirmation(['no please'], 'en').matchedValue).toBe('NO');
  });
});

describe('matchConfirmation – Tamil YES', () => {
  test.each([
    ['ஆமா'],
    ['ஆம்'],
    ['சரி'],
    ['ஓகே'],
    ['ஆமாம்'],
    ['உறுதி'],
    ['aama'],
    ['sari'],
  ])('"%s" → YES', (phrase) => {
    expect(SttMatcherService.matchConfirmation([phrase], 'ta').matchedValue).toBe('YES');
  });
});

describe('matchConfirmation – Tamil NO', () => {
  test.each([
    ['இல்லை'],
    ['வேண்டாம்'],
    ['ரத்து'],
    ['நிறுத்து'],
    ['illa'],
    ['vendam'],
    ['niruthu'],
  ])('"%s" → NO', (phrase) => {
    expect(SttMatcherService.matchConfirmation([phrase], 'ta').matchedValue).toBe('NO');
  });
});

describe('matchConfirmation – Hindi YES', () => {
  test.each([
    ['haan'],
    ['ha'],
    ['haanji'],
    ['theek hai'],
    ['sahi'],
    ['kar do'],
    ['हाँ'],
    ['ठीक है'],
    ['ji haan'],
  ])('"%s" → YES', (phrase) => {
    expect(SttMatcherService.matchConfirmation([phrase], 'hi').matchedValue).toBe('YES');
  });
});

describe('matchConfirmation – Hindi NO', () => {
  test.each([
    ['nahi'],
    ['nahin'],
    ['mat'],
    ['band karo'],
    ['galat'],
    ['नहीं'],
    ['ना'],
    ['रद्द'],
    ['naa'],
  ])('"%s" → NO', (phrase) => {
    expect(SttMatcherService.matchConfirmation([phrase], 'hi').matchedValue).toBe('NO');
  });
});

describe('matchConfirmation – Noise / Silence', () => {
  test('random noise → UNKNOWN', () => {
    expect(SttMatcherService.matchConfirmation(['kjhfkjsdhfkjhsdf'], 'en').matchedValue).toBe('UNKNOWN');
  });

  test('empty array → UNKNOWN', () => {
    expect(SttMatcherService.matchConfirmation([], 'en').matchedValue).toBe('UNKNOWN');
  });

  test('empty string → UNKNOWN', () => {
    expect(SttMatcherService.matchConfirmation([''], 'en').matchedValue).toBe('UNKNOWN');
  });

  test('silence (whitespace only) → UNKNOWN', () => {
    expect(SttMatcherService.matchConfirmation(['   '], 'en').matchedValue).toBe('UNKNOWN');
  });
});

describe('matchConfirmation – Cross-language English fallback', () => {
  // English YES/NO must be accepted in Tamil and Hindi modes too
  test('"yes" is accepted in Tamil mode → YES', () => {
    expect(SttMatcherService.matchConfirmation(['yes'], 'ta').matchedValue).toBe('YES');
  });

  test('"no" is accepted in Hindi mode → NO', () => {
    expect(SttMatcherService.matchConfirmation(['no'], 'hi').matchedValue).toBe('NO');
  });
});

// ────────────────────────────────────────────────────────────
// matchRestaurantSelection
// ────────────────────────────────────────────────────────────
describe('matchRestaurantSelection – English ordinals', () => {
  test('"first" → index 0 (Murugan Idli Shop)', () => {
    const r = SttMatcherService.matchRestaurantSelection(['first'], DOSA_RESTAURANTS);
    expect(r.isMatched).toBe(true);
    expect(r.restaurant).toBe('Murugan Idli Shop');
    expect(r.matchedBy).toBe('ordinal');
  });

  test('"1st" → index 0', () => {
    expect(SttMatcherService.matchRestaurantSelection(['1st'], DOSA_RESTAURANTS).restaurant).toBe('Murugan Idli Shop');
  });

  test('"second" → index 1 (Saravana Bhavan)', () => {
    expect(SttMatcherService.matchRestaurantSelection(['second'], DOSA_RESTAURANTS).restaurant).toBe('Saravana Bhavan');
  });

  test('"2nd" → index 1', () => {
    expect(SttMatcherService.matchRestaurantSelection(['2nd'], DOSA_RESTAURANTS).restaurant).toBe('Saravana Bhavan');
  });

  test('"third" → index 2 (A2B Adyar Ananda Bhavan)', () => {
    expect(SttMatcherService.matchRestaurantSelection(['third'], DOSA_RESTAURANTS).restaurant).toBe('A2B Adyar Ananda Bhavan');
  });

  test('"option 3" → index 2', () => {
    expect(SttMatcherService.matchRestaurantSelection(['option 3'], DOSA_RESTAURANTS).restaurant).toBe('A2B Adyar Ananda Bhavan');
  });

  test('"doosra" biryani restaurant → index 1 (Star Ambur Biryani)', () => {
    expect(SttMatcherService.matchRestaurantSelection(['doosra'], BIRYANI_RESTAURANTS).restaurant).toBe('Star Ambur Biryani');
  });

  test('"teesra" with only 2 restaurants → no match (out of range)', () => {
    const r = SttMatcherService.matchRestaurantSelection(['teesra'], BIRYANI_RESTAURANTS);
    expect(r.isMatched).toBe(false);
  });
});

describe('matchRestaurantSelection – Tamil ordinals', () => {
  test('"முதல்" → index 0', () => {
    expect(SttMatcherService.matchRestaurantSelection(['முதல்'], DOSA_RESTAURANTS).restaurant).toBe('Murugan Idli Shop');
  });

  test('"இரண்டாவது" → index 1', () => {
    expect(SttMatcherService.matchRestaurantSelection(['இரண்டாவது'], DOSA_RESTAURANTS).restaurant).toBe('Saravana Bhavan');
  });

  test('"மூன்றாவது" → index 2', () => {
    expect(SttMatcherService.matchRestaurantSelection(['மூன்றாவது'], DOSA_RESTAURANTS).restaurant).toBe('A2B Adyar Ananda Bhavan');
  });

  test('"ஒன்று" (one) → index 0', () => {
    expect(SttMatcherService.matchRestaurantSelection(['ஒன்று'], DOSA_RESTAURANTS).restaurant).toBe('Murugan Idli Shop');
  });
});

describe('matchRestaurantSelection – Hindi ordinals', () => {
  test('"pehla" → index 0', () => {
    expect(SttMatcherService.matchRestaurantSelection(['pehla'], DOSA_RESTAURANTS).restaurant).toBe('Murugan Idli Shop');
  });

  test('"doosra" → index 1', () => {
    expect(SttMatcherService.matchRestaurantSelection(['doosra'], DOSA_RESTAURANTS).restaurant).toBe('Saravana Bhavan');
  });

  test('"teesra" → index 2', () => {
    expect(SttMatcherService.matchRestaurantSelection(['teesra'], DOSA_RESTAURANTS).restaurant).toBe('A2B Adyar Ananda Bhavan');
  });

  test('"chautha" with 4 restaurants → index 3', () => {
    expect(SttMatcherService.matchRestaurantSelection(['chautha'], DOSA_RESTAURANTS).restaurant).toBe('Sangeetha Veg Restaurant');
  });

  test('"पहला" → index 0', () => {
    expect(SttMatcherService.matchRestaurantSelection(['पहला'], BIRYANI_RESTAURANTS).restaurant).toBe('Bawarchi Biryani');
  });
});

describe('matchRestaurantSelection – Restaurant names (English)', () => {
  test('"saravana" → Saravana Bhavan', () => {
    expect(SttMatcherService.matchRestaurantSelection(['saravana'], DOSA_RESTAURANTS).restaurant).toBe('Saravana Bhavan');
  });

  test('"a2b" → A2B Adyar Ananda Bhavan', () => {
    expect(SttMatcherService.matchRestaurantSelection(['a2b'], DOSA_RESTAURANTS).restaurant).toBe('A2B Adyar Ananda Bhavan');
  });

  test('"order from a2b please" → A2B Adyar Ananda Bhavan', () => {
    expect(SttMatcherService.matchRestaurantSelection(['order from a2b please'], DOSA_RESTAURANTS).restaurant).toBe('A2B Adyar Ananda Bhavan');
  });

  test('"murugan" → Murugan Idli Shop', () => {
    expect(SttMatcherService.matchRestaurantSelection(['murugan'], DOSA_RESTAURANTS).restaurant).toBe('Murugan Idli Shop');
  });

  test('"bawarchi" → Bawarchi Biryani', () => {
    expect(SttMatcherService.matchRestaurantSelection(['bawarchi'], BIRYANI_RESTAURANTS).restaurant).toBe('Bawarchi Biryani');
  });

  test('"ambur" → Star Ambur Biryani', () => {
    expect(SttMatcherService.matchRestaurantSelection(['ambur'], BIRYANI_RESTAURANTS).restaurant).toBe('Star Ambur Biryani');
  });

  test('"sangeetha" → Sangeetha Veg Restaurant', () => {
    expect(SttMatcherService.matchRestaurantSelection(['sangeetha'], DOSA_RESTAURANTS).restaurant).toBe('Sangeetha Veg Restaurant');
  });

  test('"haldirams" in single-item list → Haldirams', () => {
    expect(SttMatcherService.matchRestaurantSelection(['haldirams'], SINGLE_RESTAURANT).restaurant).toBe('Haldirams');
  });
});

describe('matchRestaurantSelection – Tamil transliterations', () => {
  test('"சரவண பவன்" → Saravana Bhavan', () => {
    expect(SttMatcherService.matchRestaurantSelection(['சரவண பவன்'], DOSA_RESTAURANTS).restaurant).toBe('Saravana Bhavan');
  });

  test('"சங்கீதா" → Sangeetha Veg Restaurant', () => {
    expect(SttMatcherService.matchRestaurantSelection(['சங்கீதா'], DOSA_RESTAURANTS).restaurant).toBe('Sangeetha Veg Restaurant');
  });

  test('"முருகன் இட்லி" → Murugan Idli Shop', () => {
    expect(SttMatcherService.matchRestaurantSelection(['முருகன் இட்லி'], DOSA_RESTAURANTS).restaurant).toBe('Murugan Idli Shop');
  });

  test('"ஆம்பூர் பிரியாணி" → Star Ambur Biryani', () => {
    expect(SttMatcherService.matchRestaurantSelection(['ஆம்பூர் பிரியாணி'], BIRYANI_RESTAURANTS).restaurant).toBe('Star Ambur Biryani');
  });
});

describe('matchRestaurantSelection – Hindi transliterations', () => {
  test('"सरवना" → Saravana Bhavan', () => {
    expect(SttMatcherService.matchRestaurantSelection(['सरवना'], DOSA_RESTAURANTS).restaurant).toBe('Saravana Bhavan');
  });

  test('"बावर्ची" → Bawarchi Biryani', () => {
    expect(SttMatcherService.matchRestaurantSelection(['बावर्ची'], BIRYANI_RESTAURANTS).restaurant).toBe('Bawarchi Biryani');
  });

  test('"अंबुर" → Star Ambur Biryani', () => {
    expect(SttMatcherService.matchRestaurantSelection(['अंबुर'], BIRYANI_RESTAURANTS).restaurant).toBe('Star Ambur Biryani');
  });
});

describe('matchRestaurantSelection – Edge cases', () => {
  test('noise → no match', () => {
    const r = SttMatcherService.matchRestaurantSelection(['kjhfksjhdfkjhsdf'], DOSA_RESTAURANTS);
    expect(r.isMatched).toBe(false);
    expect(r.restaurant).toBeNull();
  });

  test('empty array → no match', () => {
    expect(SttMatcherService.matchRestaurantSelection([], DOSA_RESTAURANTS).isMatched).toBe(false);
  });

  test('empty restaurant list → no match', () => {
    expect(SttMatcherService.matchRestaurantSelection(['first'], []).isMatched).toBe(false);
  });

  test('string (not array) input is accepted', () => {
    // The function signature accepts string | string[]
    const r = SttMatcherService.matchRestaurantSelection('saravana', DOSA_RESTAURANTS);
    expect(r.isMatched).toBe(true);
    expect(r.restaurant).toBe('Saravana Bhavan');
  });
});

