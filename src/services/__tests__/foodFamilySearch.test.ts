/**
 * foodFamilySearch.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests for the food family / generic-name detection + search pipeline fix.
 *
 * Coverage:
 *   - detectFamilyQuery: 8+ phrases per language for each of dosa/idli/biryani/parotta
 *   - detectVariantQuery: 5+ specific variant phrases per language
 *   - DynamicFoodSearchEngine.search() family path returns ALL family items
 *   - DynamicFoodSearchEngine.search() variant path returns ONLY that variant
 *   - "tacos" returns not-found (empty matchedItems, no default)
 *   - stripFillerPhrases removes filler words correctly
 */

import { describe, it, expect } from 'vitest';
import {
  detectFamilyQuery,
  detectVariantQuery,
  detectFoodFamilyIntent,
  stripFillerPhrases,
  FOOD_FAMILIES,
} from '../foodFamilyTable';
import { DynamicFoodSearchEngine } from '../dynamicFoodSearch';
import { INDIAN_FOOD_CATALOG } from '../../data/indianFoodCatalog';

// ── Helper: get all catalog items whose tags include a given family tag ────────
function getFamilyItems(familyTag: string) {
  return INDIAN_FOOD_CATALOG.filter(item =>
    (item.tags || []).some(t => t.toLowerCase() === familyTag || t.toLowerCase().includes(familyTag))
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. stripFillerPhrases
// ═══════════════════════════════════════════════════════════════════════════════
describe('stripFillerPhrases', () => {
  it('strips English filler words', () => {
    expect(stripFillerPhrases('show me dosa')).toBe('dosa');
    expect(stripFillerPhrases('i want biryani')).toBe('biryani');
    expect(stripFillerPhrases('give me idli please')).toBe('idli');
  });

  it('strips Tanglish filler', () => {
    expect(stripFillerPhrases('dosai venum')).toBe('dosai');
    expect(stripFillerPhrases('biryani venum')).toBe('biryani');
  });

  it('strips Hindi/Hinglish filler', () => {
    expect(stripFillerPhrases('biryani dikhao')).toBe('biryani');
    expect(stripFillerPhrases('dosa chahiye')).toBe('dosa');
  });

  it('returns bare word unchanged', () => {
    expect(stripFillerPhrases('dosa')).toBe('dosa');
    expect(stripFillerPhrases('idli')).toBe('idli');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. detectFamilyQuery – DOSA (8 English/Tanglish/Tamil/Hindi phrases)
// ═══════════════════════════════════════════════════════════════════════════════
describe('detectFamilyQuery – DOSA family', () => {
  const DOSA_PHRASES = [
    // English
    'dosa', 'dosai', 'dhosai', 'thosai', 'dosaa', 'dosha',
    // Tamil script
    'தோசை', 'தோசா',
    // Hindi
    'डोसा',
  ];

  DOSA_PHRASES.forEach(phrase => {
    it(`detects "${phrase}" as dosa family`, () => {
      const result = detectFamilyQuery(phrase);
      expect(result.isFamily).toBe(true);
      expect(result.family?.key).toBe('dosa');
    });
  });

  it('does NOT treat "masala dosa" as generic family (has variant token)', () => {
    expect(detectFamilyQuery('masala dosa').isFamily).toBe(false);
  });

  it('does NOT treat "podi dosa" as generic family (has variant token)', () => {
    expect(detectFamilyQuery('podi dosa').isFamily).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. detectFamilyQuery – IDLI (8 phrases)
// ═══════════════════════════════════════════════════════════════════════════════
describe('detectFamilyQuery – IDLI family', () => {
  const IDLI_PHRASES = [
    'idli', 'idly', 'iddli', 'italy', 'eatly', 'itli',
    'இட்லி', 'இட்டலி',
    'इडली',
  ];

  IDLI_PHRASES.forEach(phrase => {
    it(`detects "${phrase}" as idli family`, () => {
      const result = detectFamilyQuery(phrase);
      expect(result.isFamily).toBe(true);
      expect(result.family?.key).toBe('idli');
    });
  });

  it('does NOT treat "ghee idli" as generic (has variant token)', () => {
    expect(detectFamilyQuery('ghee idli').isFamily).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. detectFamilyQuery – BIRYANI (8 phrases)
// ═══════════════════════════════════════════════════════════════════════════════
describe('detectFamilyQuery – BIRYANI family', () => {
  const BIRYANI_PHRASES = [
    'biryani', 'biriyani', 'birani', 'briyani', 'beer yani', 'berryani',
    'பிரியாணி', 'பிரியானி',
    'बिरयानी',
  ];

  BIRYANI_PHRASES.forEach(phrase => {
    it(`detects "${phrase}" as biryani family`, () => {
      const result = detectFamilyQuery(phrase);
      expect(result.isFamily).toBe(true);
      expect(result.family?.key).toBe('biryani');
    });
  });

  it('does NOT treat "chicken biryani" as generic (has variant token)', () => {
    expect(detectFamilyQuery('chicken biryani').isFamily).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. detectFamilyQuery – PAROTTA (8 phrases)
// ═══════════════════════════════════════════════════════════════════════════════
describe('detectFamilyQuery – PAROTTA family', () => {
  const PAROTTA_PHRASES = [
    'parotta', 'parota', 'barota', 'parrotta', 'paratha', 'porotta',
    'பரோட்டா', 'பரோடா',
    'परोटा',
  ];

  PAROTTA_PHRASES.forEach(phrase => {
    it(`detects "${phrase}" as parotta family`, () => {
      const result = detectFamilyQuery(phrase);
      expect(result.isFamily).toBe(true);
      expect(result.family?.key).toBe('parotta');
    });
  });

  it('does NOT treat "kothu parotta" as generic (has variant token)', () => {
    expect(detectFamilyQuery('kothu parotta').isFamily).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. detectVariantQuery – SPECIFIC DOSA VARIANTS (5+ per language)
// ═══════════════════════════════════════════════════════════════════════════════
describe('detectVariantQuery – specific dosa variants', () => {
  const SPECIFIC_DOSA = [
    // English/Tanglish
    'masala dosa', 'podi dosa', 'ghee dosa', 'rava dosa', 'onion dosa',
    // Tamil – Tanglish mix
    'masala dosai', 'podi dosai',
    // Tamil script
    'மசாலா தோசை',
    'பொடி தோசை',
    'மசாலா தோசா',
    // Hindi
    'मसाला डोसा',
    'घी डोसा',
  ];

  SPECIFIC_DOSA.forEach(phrase => {
    it(`detects "${phrase}" as specific dosa variant`, () => {
      const result = detectVariantQuery(phrase);
      expect(result).not.toBeNull();
      expect(result?.familyKey).toBe('dosa');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. detectVariantQuery – SPECIFIC BIRYANI VARIANTS
// ═══════════════════════════════════════════════════════════════════════════════
describe('detectVariantQuery – specific biryani variants', () => {
  const SPECIFIC_BIRYANI = [
    'chicken biryani', 'mutton biryani', 'veg biryani', 'paneer biryani',
    'சிக்கன் பிரியாணி',
    'चिकन बिरयानी',
  ];

  SPECIFIC_BIRYANI.forEach(phrase => {
    it(`detects "${phrase}" as specific biryani variant`, () => {
      const result = detectVariantQuery(phrase);
      expect(result).not.toBeNull();
      expect(result?.familyKey).toBe('biryani');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. DynamicFoodSearchEngine.search() – family queries show ALL items
// ═══════════════════════════════════════════════════════════════════════════════
describe('DynamicFoodSearchEngine.search() – generic family query', () => {
  const expectedDosaIds = getFamilyItems('dosa').map(i => i.id);
  const expectedBiryaniIds = getFamilyItems('biryani').map(i => i.id);

  const DOSA_FAMILY_QUERIES = [
    'dosa', 'dosai', 'thosai',
    'தோசை', 'தோசா',
    'show me dosa',
    'डोसा',
    'dosa dikhao',
  ];

  DOSA_FAMILY_QUERIES.forEach(query => {
    it(`"${query}" returns ALL dosa varieties (>= 2 items, no single-item didYouMean)`, () => {
      const result = DynamicFoodSearchEngine.search({ query });
      expect(result.matchedItems.length).toBeGreaterThanOrEqual(2);
      // Every returned item must be a dosa variant
      for (const item of result.matchedItems) {
        const tags = (item.tags || []).map(t => t.toLowerCase());
        expect(tags.some(t => t === 'dosa' || t.includes('dosa'))).toBe(true);
      }
      // Must NOT show a single-item "Did you mean X?" when a full family was requested
      expect(result.didYouMean).toBeUndefined();
    });
  });

  it('"biryani" returns ALL biryani varieties', () => {
    const result = DynamicFoodSearchEngine.search({ query: 'biryani' });
    expect(result.matchedItems.length).toBeGreaterThanOrEqual(2);
    for (const item of result.matchedItems) {
      const tags = (item.tags || []).map(t => t.toLowerCase());
      expect(tags.some(t => t === 'biryani' || t.includes('biryani'))).toBe(true);
    }
    expect(result.didYouMean).toBeUndefined();
  });

  it('"idli" returns ALL idli varieties', () => {
    const result = DynamicFoodSearchEngine.search({ query: 'idli' });
    expect(result.matchedItems.length).toBeGreaterThanOrEqual(1);
    for (const item of result.matchedItems) {
      const tags = (item.tags || []).map(t => t.toLowerCase());
      expect(tags.some(t => t === 'idli' || t.includes('idli'))).toBe(true);
    }
    expect(result.didYouMean).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. DynamicFoodSearchEngine.search() – specific variant queries
// ═══════════════════════════════════════════════════════════════════════════════
describe('DynamicFoodSearchEngine.search() – specific variant query', () => {
  it('"masala dosa" returns only masala dosa items', () => {
    const result = DynamicFoodSearchEngine.search({ query: 'masala dosa' });
    expect(result.matchedItems.length).toBeGreaterThanOrEqual(1);
    for (const item of result.matchedItems) {
      const combined = (item.name + ' ' + (item.nativeNames?.en || '') + ' ' + (item.tags || []).join(' ')).toLowerCase();
      expect(combined.includes('masala')).toBe(true);
    }
  });

  it('"podi dosa" returns only podi dosa items', () => {
    const result = DynamicFoodSearchEngine.search({ query: 'podi dosa' });
    expect(result.matchedItems.length).toBeGreaterThanOrEqual(1);
    for (const item of result.matchedItems) {
      const combined = (item.name + ' ' + (item.tags || []).join(' ')).toLowerCase();
      expect(combined.includes('podi') || combined.includes('ghee')).toBe(true);
    }
  });

  it('"chicken biryani" returns only chicken biryani items', () => {
    const result = DynamicFoodSearchEngine.search({ query: 'chicken biryani' });
    expect(result.matchedItems.length).toBeGreaterThanOrEqual(1);
    for (const item of result.matchedItems) {
      const combined = (item.name + ' ' + (item.tags || []).join(' ')).toLowerCase();
      expect(combined.includes('chicken') || combined.includes('biryani')).toBe(true);
    }
  });

  it('Tamil: "masala thosai" returns masala dosa item', () => {
    const result = DynamicFoodSearchEngine.search({ query: 'masala thosai' });
    expect(result.matchedItems.length).toBeGreaterThanOrEqual(1);
    for (const item of result.matchedItems) {
      const tags = (item.tags || []).map(t => t.toLowerCase());
      expect(tags.some(t => t === 'dosa' || t.includes('dosa'))).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. Not-found: "tacos" → empty matchedItems, no default
// ═══════════════════════════════════════════════════════════════════════════════
describe('DynamicFoodSearchEngine.search() – not found', () => {
  it('"tacos" returns 0 matched items (no silent default)', () => {
    const result = DynamicFoodSearchEngine.search({ query: 'tacos' });
    // Should NOT silently return some unrelated dish
    expect(result.matchedItems.length).toBe(0);
    expect(result.suggestedItems.length).toBe(0);
    expect(result.isExactMatch).toBe(false);
  });

  it('"xyz123unknown" returns 0 matched items', () => {
    const result = DynamicFoodSearchEngine.search({ query: 'xyz123unknown' });
    expect(result.matchedItems.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. Hinglish filler-prefixed queries still work
// ═══════════════════════════════════════════════════════════════════════════════
describe('Hinglish / Tanglish filler-stripped family detection', () => {
  it('"dosai venum" is dosa family after strip', () => {
    const stripped = stripFillerPhrases('dosai venum');
    const result = detectFamilyQuery(stripped);
    expect(result.isFamily).toBe(true);
    expect(result.family?.key).toBe('dosa');
  });

  it('"biryani dikhao" is biryani family after strip', () => {
    const stripped = stripFillerPhrases('biryani dikhao');
    const result = detectFamilyQuery(stripped);
    expect(result.isFamily).toBe(true);
    expect(result.family?.key).toBe('biryani');
  });

  it('"show me idli" is idli family after strip', () => {
    const stripped = stripFillerPhrases('show me idli');
    const result = detectFamilyQuery(stripped);
    expect(result.isFamily).toBe(true);
    expect(result.family?.key).toBe('idli');
  });
});

const FAMILY_QUERIES: Record<string, Record<string, string[]>> = {
  dosa: {
    English: ['dosa', 'dosa please', 'show me dosa', 'I want dosa', 'give me dosa', 'order dosa', 'find dosa', 'search dosa'],
    Tamil: ['தோசை', 'தோசா', 'தோசி', 'தோசே', 'தோசை காட்டு', 'தோசா காட்டுங்கள்', 'தோசை வேண்டும்', 'தோசா குடு'],
    Hindi: ['डोसा', 'डोसाई', 'डोसे', 'मुझे डोसा', 'डोसा दिखाओ', 'डोसा दिखाइए', 'डोसा चाहिए', 'डोसा बताओ'],
    Tanglish: ['dosai venum', 'dosai kaatu', 'dosai kaattu', 'thosai venum', 'thosai kaatu', 'dosaa venum', 'dhosa venum', 'dhosai venum'],
    Hinglish: ['dosa dikhao', 'mujhe dosa', 'dosa chahiye', 'dosa dikhaiye', 'dosa dedo', 'dosa order karo', 'dosa please', 'dosa leke aao'],
  },
  idli: {
    English: ['idli', 'idly', 'idlis', 'show me idli', 'I want idli', 'give me idli', 'order idli', 'find idli'],
    Tamil: ['இட்லி', 'இட்டலி', 'இட்டிலி', 'இட்லி காட்டு', 'இட்லி காட்டுங்கள்', 'இட்லி வேண்டும்', 'இட்லி வேணும்', 'இட்டிலி குடு'],
    Hindi: ['इडली', 'इडलि', 'मुझे इडली', 'इडली दिखाओ', 'इडली दिखाइए', 'इडली चाहिए', 'इडली बताओ', 'इडली मंगाओ'],
    Tanglish: ['idli venum', 'idly venum', 'idli kaatu', 'idli kaattu', 'idli kudu', 'itli venum', 'edli venum', 'idlee venum'],
    Hinglish: ['idli chahiye', 'mujhe idli', 'idli dikhao', 'idli dikhaiye', 'idli dedo', 'idli order karo', 'idli please', 'idli leke aao'],
  },
  biryani: {
    English: ['biryani', 'biriyani', 'birani', 'show me biryani', 'I want biryani', 'give me biryani', 'order biryani', 'find biryani'],
    Tamil: ['பிரியாணி', 'பிரியானி', 'பிரீயாணி', 'பிரியாணி காட்டு', 'பிரியாணி காட்டுங்கள்', 'பிரியாணி வேண்டும்', 'பிரியாணி வேணும்', 'பிரியாணி குடு'],
    Hindi: ['बिरयानी', 'बिरियानी', 'बिरानी', 'मुझे बिरयानी', 'बिरयानी दिखाओ', 'बिरयानी दिखाइए', 'बिरयानी चाहिए', 'बिरयानी बताओ'],
    Tanglish: ['biryani venum', 'biriyani venum', 'biryani kaatu', 'biryani kaattu', 'birani venum', 'briyani venum', 'biryani kudu', 'biriyani kaatu'],
    Hinglish: ['biryani dikhao', 'mujhe biryani', 'biryani chahiye', 'biryani dikhaiye', 'biryani dedo', 'biryani order karo', 'biryani please', 'biryani leke aao'],
  },
  parotta: {
    English: ['parotta', 'parota', 'paratha', 'show me parotta', 'I want parotta', 'give me parotta', 'order parotta', 'find parotta'],
    Tamil: ['பரோட்டா', 'பரோடா', 'பரட்டா', 'பொரோட்டா', 'பரோட்டா காட்டு', 'பரோட்டா காட்டுங்கள்', 'பரோட்டா வேண்டும்', 'பரோட்டா குடு'],
    Hindi: ['परोटा', 'परोठा', 'पराठा', 'मुझे परोटा', 'परोटा दिखाओ', 'परोटा दिखाइए', 'परोटा चाहिए', 'परोटा बताओ'],
    Tanglish: ['parotta venum', 'parota venum', 'parotta kaatu', 'porotta venum', 'porota venum', 'paratha venum', 'parotta kudu', 'parota kaattu'],
    Hinglish: ['parotta dikhao', 'mujhe parotta', 'parotta chahiye', 'parotta dikhaiye', 'parotta dedo', 'parotta order karo', 'parotta please', 'parotta leke aao'],
  },
};

describe('multilingual generic family search coverage', () => {
  for (const [familyKey, languageQueries] of Object.entries(FAMILY_QUERIES)) {
    const expectedIds = getFamilyItems(familyKey).map(item => item.id).sort();
    for (const [language, queries] of Object.entries(languageQueries)) {
      it(`${familyKey}: returns the complete family for all ${language} phrases`, () => {
        expect(queries).toHaveLength(8);
        for (const query of queries) {
          const result = DynamicFoodSearchEngine.search({ query });
          expect(result.isExactMatch, query).toBe(true);
          expect(result.matchedItems.map(item => item.id).sort(), query).toEqual(expectedIds);
          expect(result.didYouMean, query).toBeUndefined();
        }
      });
    }
  }

  it('checks all five STT alternatives and opens a generic family for a later alias', () => {
    const alternatives = ['noise', 'unrecognized food', 'maybe dosa', 'தோசா', 'मसाला डोसा'];
    const intent = detectFoodFamilyIntent(alternatives);
    expect(intent).toMatchObject({ transcript: 'தோசா', kind: 'family', family: { key: 'dosa' }, score: 1 });
  });
});

const VARIANT_QUERIES: Record<string, Record<string, Array<{ query: string; id: string }>>> = {
  dosa: {
    English: [
      { query: 'masala dosa', id: 'dosa-masala' },
      { query: 'podi dosa', id: 'dosa-podi' },
      { query: 'ghee dosa', id: 'dosa-podi' },
      { query: 'rava dosa', id: 'dosa-rava' },
      { query: 'onion dosa', id: 'dosa-rava' },
    ],
    Tamil: [
      { query: 'மசாலா தோசை', id: 'dosa-masala' },
      { query: 'பொடி தோசை', id: 'dosa-podi' },
      { query: 'நெய் தோசை', id: 'dosa-podi' },
      { query: 'ரவா தோசை', id: 'dosa-rava' },
      { query: 'வெங்காய தோசை', id: 'dosa-rava' },
    ],
    Hindi: [
      { query: 'मसाला डोसा', id: 'dosa-masala' },
      { query: 'पोडी डोसा', id: 'dosa-podi' },
      { query: 'घी डोसा', id: 'dosa-podi' },
      { query: 'रवा डोसा', id: 'dosa-rava' },
      { query: 'प्याज डोसा', id: 'dosa-rava' },
    ],
    Tanglish: [
      { query: 'masala dosai', id: 'dosa-masala' },
      { query: 'podi dosai', id: 'dosa-podi' },
      { query: 'ghee dosai', id: 'dosa-podi' },
      { query: 'rava dosai', id: 'dosa-rava' },
      { query: 'onion dosai', id: 'dosa-rava' },
    ],
    Hinglish: [
      { query: 'mujhe masala dosa chahiye', id: 'dosa-masala' },
      { query: 'podi dosa dikhao', id: 'dosa-podi' },
      { query: 'ghee wala dosa', id: 'dosa-podi' },
      { query: 'rava dosa chahiye', id: 'dosa-rava' },
      { query: 'onion dosa dikhao', id: 'dosa-rava' },
    ],
  },
  idli: {
    English: [
      { query: 'sambar idli', id: 'idli-sambar' },
      { query: 'button idli', id: 'idli-sambar' },
      { query: 'show me sambar idli', id: 'idli-sambar' },
      { query: 'I want button idli', id: 'idli-sambar' },
      { query: 'give me idli sambar', id: 'idli-sambar' },
    ],
    Tamil: [
      { query: 'சாம்பார் இட்லி', id: 'idli-sambar' },
      { query: 'இட்லி சாம்பார்', id: 'idli-sambar' },
      { query: 'சாம்பார் இட்லி காட்டு', id: 'idli-sambar' },
      { query: 'சாம்பார் இட்லி குடு', id: 'idli-sambar' },
      { query: 'சாம்பார் இட்லி வேண்டும்', id: 'idli-sambar' },
    ],
    Hindi: [
      { query: 'सांबर इडली', id: 'idli-sambar' },
      { query: 'इडली सांबर', id: 'idli-sambar' },
      { query: 'मुझे सांबर इडली दिखाओ', id: 'idli-sambar' },
      { query: 'सांबर इडली चाहिए', id: 'idli-sambar' },
      { query: 'सांबर इडली बताओ', id: 'idli-sambar' },
    ],
    Tanglish: [
      { query: 'sambar idli', id: 'idli-sambar' },
      { query: 'idli sambar', id: 'idli-sambar' },
      { query: 'sambar idli venum', id: 'idli-sambar' },
      { query: 'sambar idli kaatu', id: 'idli-sambar' },
      { query: 'sambar idli kudu', id: 'idli-sambar' },
    ],
    Hinglish: [
      { query: 'sambar idli chahiye', id: 'idli-sambar' },
      { query: 'mujhe sambar idli', id: 'idli-sambar' },
      { query: 'sambar idli dikhao', id: 'idli-sambar' },
      { query: 'sambar idli dedo', id: 'idli-sambar' },
      { query: 'idli sambar please', id: 'idli-sambar' },
    ],
  },
  biryani: {
    English: [
      { query: 'chicken biryani', id: 'biryani-hyderabadi' },
      { query: 'mutton biryani', id: 'biryani-ambur' },
      { query: 'veg biryani', id: 'biryani-veg-paneer' },
      { query: 'paneer biryani', id: 'biryani-veg-paneer' },
      { query: 'hyderabadi biryani', id: 'biryani-hyderabadi' },
    ],
    Tamil: [
      { query: 'சிக்கன் பிரியாணி', id: 'biryani-hyderabadi' },
      { query: 'மட்டன் பிரியாணி', id: 'biryani-ambur' },
      { query: 'காய்கறி பிரியாணி', id: 'biryani-veg-paneer' },
      { query: 'பன்னீர் பிரியாணி', id: 'biryani-veg-paneer' },
      { query: 'ஹைதராபாத் பிரியாணி', id: 'biryani-hyderabadi' },
    ],
    Hindi: [
      { query: 'चिकन बिरयानी', id: 'biryani-hyderabadi' },
      { query: 'मटन बिरयानी', id: 'biryani-ambur' },
      { query: 'वेज बिरयानी', id: 'biryani-veg-paneer' },
      { query: 'पनीर बिरयानी', id: 'biryani-veg-paneer' },
      { query: 'हैदराबादी बिरयानी', id: 'biryani-hyderabadi' },
    ],
    Tanglish: [
      { query: 'chicken biryani venum', id: 'biryani-hyderabadi' },
      { query: 'mutton biryani venum', id: 'biryani-ambur' },
      { query: 'veg biryani kaatu', id: 'biryani-veg-paneer' },
      { query: 'paneer biryani venum', id: 'biryani-veg-paneer' },
      { query: 'hyderabadi biryani kaatu', id: 'biryani-hyderabadi' },
    ],
    Hinglish: [
      { query: 'chicken biryani dikhao', id: 'biryani-hyderabadi' },
      { query: 'mutton biryani chahiye', id: 'biryani-ambur' },
      { query: 'veg biryani dedo', id: 'biryani-veg-paneer' },
      { query: 'paneer biryani please', id: 'biryani-veg-paneer' },
      { query: 'hyderabadi biryani dikhao', id: 'biryani-hyderabadi' },
    ],
  },
  parotta: {
    English: [
      { query: 'chicken kothu parotta', id: 'parotta-kothu' },
      { query: 'kothu parotta', id: 'parotta-kothu' },
      { query: 'chicken parotta', id: 'parotta-kothu' },
      { query: 'show me chicken parotta', id: 'parotta-kothu' },
      { query: 'I want kothu parotta', id: 'parotta-kothu' },
    ],
    Tamil: [
      { query: 'சிக்கன் கொத்து பரோட்டா', id: 'parotta-kothu' },
      { query: 'கொத்து பரோட்டா', id: 'parotta-kothu' },
      { query: 'சிக்கன் பரோட்டா', id: 'parotta-kothu' },
      { query: 'கொத்து பரோட்டா காட்டு', id: 'parotta-kothu' },
      { query: 'பரோட்டா சிக்கன்', id: 'parotta-kothu' },
    ],
    Hindi: [
      { query: 'चिकन कोथू परोटा', id: 'parotta-kothu' },
      { query: 'कोथू परोटा', id: 'parotta-kothu' },
      { query: 'चिकन परोटा', id: 'parotta-kothu' },
      { query: 'चिकन परोटा दिखाओ', id: 'parotta-kothu' },
      { query: 'परोटा चिकन चाहिए', id: 'parotta-kothu' },
    ],
    Tanglish: [
      { query: 'chicken kothu parotta', id: 'parotta-kothu' },
      { query: 'kothu parotta venum', id: 'parotta-kothu' },
      { query: 'chicken parotta venum', id: 'parotta-kothu' },
      { query: 'kothu parotta kaatu', id: 'parotta-kothu' },
      { query: 'parotta chicken kudu', id: 'parotta-kothu' },
    ],
    Hinglish: [
      { query: 'chicken kothu parotta chahiye', id: 'parotta-kothu' },
      { query: 'mujhe kothu parotta', id: 'parotta-kothu' },
      { query: 'chicken parotta dikhao', id: 'parotta-kothu' },
      { query: 'kothu parotta dedo', id: 'parotta-kothu' },
      { query: 'parotta chicken please', id: 'parotta-kothu' },
    ],
  },
};

describe('multilingual specific-variant search coverage', () => {
  for (const [familyKey, languageQueries] of Object.entries(VARIANT_QUERIES)) {
    for (const [language, queries] of Object.entries(languageQueries)) {
      it(`${familyKey}: returns only the requested variant for ${language} phrases`, () => {
        expect(queries).toHaveLength(5);
        for (const { query, id } of queries) {
          const result = DynamicFoodSearchEngine.search({ query });
          expect(result.isExactMatch, query).toBe(true);
          expect(result.matchedItems.map(item => item.id), query).toEqual([id]);
          expect(result.didYouMean, query).toBeUndefined();
        }
      });
    }
  }
});
