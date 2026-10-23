/* eslint-disable */
'use strict';
const fs = require('fs');
const path = require('path');
const outPath = path.join(__dirname, '..', 'src', 'services', 'foodFamilyTable.ts');

const src = `/**
 * Food Family Table – multilingual aliases (EN / TA / HI / Tanglish / Hinglish)
 * ─────────────────────────────────────────────────────────────────────────────
 * Used by DynamicFoodSearchEngine.search() and SttMatcherService.matchCatalogItem()
 * to resolve whether a query is a GENERIC family ("dosa" → show all dosas)
 * or a SPECIFIC variant ("masala dosa" → show only masala dosa).
 */

export interface FoodFamily {
  key: string;
  familyTag: string;   // matches item.tags[]
  aliases: string[];   // every surface form that means the WHOLE family
  variantTokens: string[]; // words that narrow to a specific variant
}

/** Romanized / Hinglish filler phrases stripped before alias matching. */
export const FILLER_PHRASES: string[] = [
  'show me', 'i want', 'i need', 'give me', 'get me', 'bring me',
  'order', 'please', 'add', 'find', 'search', 'look for',
  // Tamil romanized
  'kaattu', 'kaatthu', 'venum', 'vaenum', 'vendam', 'kudu', 'kodu',
  'taa', 'kaatu', 'podu', 'panno', 'kudungga', 'vaanggu',
  'enakku venum', 'enaku venum', 'dosai venum',
  // Hindi / Hinglish
  'dikhao', 'dikhaiye', 'chahiye', 'karo', 'laya', 'dedo',
  'mujhe', 'order karo', 'mujhe chahiye', 'leke aao',
];

/**
 * Tamil-script filler words.
 * Word-boundary \\b does not work for non-Latin scripts, so these are
 * removed via String.split().join() instead of regex.
 */
export const UNICODE_FILLER_WORDS: string[] = [
  '\u0b95\u0bbe\u0b9f\u0bcd\u0b9f\u0bc1',
  '\u0b95\u0bbe\u0b9f\u0bcd\u0b9f\u0bc1\u0b99\u0bcd\u0b95\u0bb3\u0bcd',
  '\u0bb5\u0bc7\u0ba3\u0bcd\u0b9f\u0bc1\u0bae\u0bcd',
  '\u0bb5\u0bc7\u0ba3\u0bc1\u0bae\u0bcd',
  '\u0b95\u0bc1\u0b9f\u0bc1',
  '\u0b95\u0bca\u0b9f\u0bc1',
];

export const FOOD_FAMILIES: FoodFamily[] = [
  // ── DOSA ─────────────────────────────────────────────────────────────────────
  {
    key: 'dosa',
    familyTag: 'dosa',
    aliases: [
      // Romanized / Tanglish
      'dosa', 'dosai', 'dosaa', 'dhosa', 'dhosai', 'dosha', 'dosah', 'doser',
      'thosai', 'thosaa', 'tosa', 'tosai', 'tosaa', 'dosay',
      // Tamil script – phonetic variants
      '\u0ba4\u0bcb\u0b9a\u0bc8', '\u0ba4\u0bcb\u0b9a\u0bbe', '\u0ba4\u0bcb\u0b9a\u0bbf', '\u0ba4\u0bcb\u0b9a\u0bc7',
      '\u0ba4\u0bcb\u0bb7\u0bc8', '\u0ba4\u0bcb\u0bb7\u0bbe',
      '\u0da3\u0bcb\u0b9a\u0bc8', '\u0da3\u0bcb\u0b9a\u0bbe', '\u0da3\u0bcb\u0bb7\u0bc8', '\u0da3\u0bcb\u0bb7\u0bbe',
      // Hindi / Devanagari
      '\u0921\u094b\u0938\u093e', '\u0821\u094b\u0936\u093e', '\u0821\u094b\u0938\u093e\u0908',
    ],
    variantTokens: [
      'masala', 'plain', 'paper', 'podi', 'ghee', 'rava', 'onion', 'set',
      'roast', 'butter', 'cheese', 'spring', 'egg', 'chicken', 'paneer',
      '\u0bae\u0b9a\u0bbe\u0bb2\u0bbe', '\u0baa\u0bca\u0b9f\u0bbf', '\u0ba8\u0bc6\u0baf\u0bcd', '\u0bb0\u0bb5\u0bbe', '\u0bb5\u0bc6\u0b99\u0bcd\u0b95\u0bbe\u0baf',
      '\u0b9a\u0bc7\u0b9f\u0bcd', '\u0baa\u0bc7\u0baa\u0bcd\u0baa\u0bb0\u0bcd', '\u0bb0\u0bcb\u0b9a\u0bcd\u0b9f\u0bcd',
      '\u092e\u0938\u093e\u0932\u093e', '\u092a\u094b\u0921\u0940', '\u0918\u0940', '\u0930\u0935\u093e', '\u092a\u094d\u092f\u093e\u091c',
    ],
  },

  // ── IDLI ─────────────────────────────────────────────────────────────────────
  {
    key: 'idli',
    familyTag: 'idli',
    aliases: [
      'idli', 'idly', 'iddli', 'idlee', 'idlies', 'idlis', 'idlys',
      'italy', 'eatly', 'itli', 'edli', 'it lee',
      '\u0b87\u0b9f\u0bcd\u0bb2\u0bbf', '\u0b87\u0b9f\u0bcd\u0b9f\u0bb2\u0bbf', '\u0b87\u0b9f\u0bcd\u0b9f\u0bbf\u0bb2\u0bbf',
      '\u0907\u0921\u0932\u0940', '\u0907\u0921\u0932\u093f',
    ],
    variantTokens: [
      'sambar', 'ghee', 'mini', 'button', 'stuffed', 'fried', 'tawa',
      '\u0b9a\u0bbe\u0bae\u0bcd\u0baa\u0bbe\u0bb0\u0bcd', '\u0ba8\u0bc6\u0baf\u0bcd', '\u0bae\u0bbf\u0ba9\u0bbf', '\u0baa\u0b9f\u0bcd\u0b9f\u0ba9\u0bcd',
      '\u0938\u093e\u0902\u092c\u0930', '\u0918\u0940', '\u092e\u093f\u0928\u0940',
    ],
  },

  // ── BIRYANI ───────────────────────────────────────────────────────────────────
  {
    key: 'biryani',
    familyTag: 'biryani',
    aliases: [
      'biryani', 'biriyani', 'birani', 'briyani', 'biriayni',
      'beer yani', 'berryani', 'byriany', 'briani',
      '\u0baa\u0bbf\u0bb0\u0bbf\u0baf\u0bbe\u0ba3\u0bbf', '\u0baa\u0bbf\u0bb0\u0bbf\u0baf\u0bbe\u0ba9\u0bbf', '\u0baa\u0bbf\u0bb0\u0bc0\u0baf\u0bbe\u0ba3\u0bbf', '\u0baa\u0bbf\u0bb0\u0bbf\u0baf\u0bbe\u0ba3\u0bc0',
      '\u092c\u093f\u0930\u092f\u093e\u0928\u0940', '\u092c\u093f\u0930\u093f\u092f\u093e\u0928\u0940', '\u092c\u093f\u0930\u093e\u0928\u0940',
    ],
    variantTokens: [
      'chicken', 'mutton', 'veg', 'vegetable', 'paneer', 'fish', 'prawn',
      'hyderabadi', 'ambur', 'lucknowi', 'kolkata', 'dum', 'thalassery',
      '\u0b9a\u0bbf\u0b95\u0bcd\u0b95\u0ba9\u0bcd', '\u0bae\u0b9f\u0bcd\u0b9f\u0ba9\u0bcd', '\u0b95\u0bbe\u0baf\u0bcd\u0b95\u0bb1\u0bbf', '\u0baa\u0ba9\u0bcd\u0ba9\u0bc0\u0bb0\u0bcd',
      '\u0bb9\u0bc8\u0ba4\u0bb0\u0bbe\u0baa\u0bbe\u0ba4\u0bcd', '\u0b86\u0bae\u0bcd\u0baa\u0bc2\u0bb0\u0bcd',
      '\u091a\u093f\u0915\u0928', '\u092e\u091f\u0928', '\u0935\u0947\u091c', '\u092a\u0928\u0940\u0930',
      '\u0939\u0948\u0926\u0930\u093e\u092c\u093e\u0926\u0940', '\u0906\u0902\u092c\u0942\u0930',
    ],
  },

  // ── PAROTTA ───────────────────────────────────────────────────────────────────
  {
    key: 'parotta',
    familyTag: 'parotta',
    aliases: [
      'parotta', 'parota', 'barota', 'parrota', 'parrotta',
      'paratha', 'porotta', 'porota',
      '\u0baa\u0bb0\u0bcb\u0b9f\u0bcd\u0b9f\u0bbe', '\u0baa\u0bb0\u0bcb\u0b9f\u0bbe', '\u0baa\u0bb0\u0b9f\u0bcd\u0b9f\u0bbe', '\u0baa\u0bca\u0bb0\u0bcb\u0b9f\u0bcd\u0b9f\u0bbe',
      '\u092a\u0930\u094b\u091f\u093e', '\u092a\u0930\u094b\u0920\u093e', '\u092a\u0930\u093e\u0920\u093e',
    ],
    variantTokens: [
      'kothu', 'chicken', 'egg', 'beef', 'mutton', 'plain', 'veg', 'salna',
      '\u0b95\u0bca\u0ba4\u0bcd\u0ba4\u0bc1', '\u0b9a\u0bbf\u0b95\u0bcd\u0b95\u0ba9\u0bcd', '\u0bae\u0bc1\u0b9f\u0bcd\u0b9f\u0bc8', '\u0bae\u0b9f\u0bcd\u0b9f\u0ba9\u0bcd', '\u0b9a\u0bbe\u0bb2\u0bcd\u0ba9\u0bbe',
      '\u0915\u094b\u0925\u0942', '\u091a\u093f\u0915\u0928', '\u092e\u091f\u0928',
    ],
  },

  // ── PIZZA ─────────────────────────────────────────────────────────────────────
  {
    key: 'pizza',
    familyTag: 'pizza',
    aliases: [
      'pizza', 'pizaa', 'pisa', 'pitsa',
      '\u0baa\u0bc0\u0b9f\u0bcd\u0b9a\u0bbe', '\u0baa\u0b9f\u0bcd\u0b9a\u0bbe', '\u0baa\u0bbf\u0b9f\u0bcd\u0b9a\u0bbe',
      '\u092a\u093f\u091c\u093c\u094d\u091c\u093e', '\u092a\u093f\u091c\u093c\u093e',
    ],
    variantTokens: [
      'veg', 'cheese', 'chicken', 'margherita', 'pepperoni',
      'supreme', 'farmhouse', 'bbq', 'mushroom',
      '\u0bb5\u0bc6\u0b9c\u0bcd', '\u0b9a\u0bc0\u0bb8\u0bcd', '\u0b9a\u0bbf\u0b95\u0bcd\u0b95\u0ba9\u0bcd',
      '\u0935\u0947\u091c', '\u091a\u0940\u091c\u093c', '\u091a\u093f\u0915\u0928',
    ],
  },

  // ── VADA ──────────────────────────────────────────────────────────────────────
  {
    key: 'vada',
    familyTag: 'vada',
    aliases: [
      'vada', 'vadai', 'wada', 'vade',
      '\u0bb5\u0b9f\u0bc8', '\u0bae\u0bc6\u0ba4\u0bc1 \u0bb5\u0b9f\u0bc8',
      '\u0935\u0921\u093c\u093e', '\u0935\u0921\u093e',
    ],
    variantTokens: [
      'medu', 'sambar', 'masala', 'dahi', 'fried',
      '\u0bae\u0bc6\u0ba4\u0bc1', '\u0b9a\u0bbe\u0bae\u0bcd\u0baa\u0bbe\u0bb0\u0bcd', '\u0bae\u0b9a\u0bbe\u0bb2\u0bbe',
      '\u092e\u0947\u0926\u0942', '\u0938\u093e\u0902\u092c\u0930', '\u0926\u0939\u0940',
    ],
  },
];

/** Strip filler phrases from raw query text. */
export function stripFillerPhrases(text: string): string {
  let clean = text.toLowerCase().trim();
  for (const f of UNICODE_FILLER_WORDS) {
    clean = clean.split(f).join(' ').trim();
  }
  // Simple token-by-token removal for Romanized fillers
  for (const filler of FILLER_PHRASES) {
    // Use split+join to avoid regex special-char escaping issues
    clean = (' ' + clean + ' ').split(' ' + filler + ' ').join(' ').trim();
  }
  return clean.replace(/  +/g, ' ').trim();
}

/**
 * Returns { isFamily: true, family } when the filler-stripped query matches a
 * family alias with NO variant token present → show ALL catalog items of that family.
 */
export function detectFamilyQuery(normalizedQuery: string): {
  isFamily: boolean;
  family: FoodFamily | null;
} {
  const q = normalizedQuery.toLowerCase().trim();
  if (!q) return { isFamily: false, family: null };
  for (const family of FOOD_FAMILIES) {
    const aliasHit = family.aliases.some(alias => alias.toLowerCase() === q);
    if (!aliasHit) continue;
    const hasVariant = family.variantTokens.some(token => q.includes(token.toLowerCase()));
    if (!hasVariant) return { isFamily: true, family };
    return { isFamily: false, family: null };
  }
  return { isFamily: false, family: null };
}

/**
 * Returns { familyKey, variantToken } when the query contains a family alias
 * AND a variant token → filter catalog to only matching variant items.
 */
export function detectVariantQuery(normalizedQuery: string): {
  familyKey: string;
  variantToken: string;
} | null {
  const q = normalizedQuery.toLowerCase().trim();
  if (!q) return null;
  for (const family of FOOD_FAMILIES) {
    const aliasHit = family.aliases.some(alias => q.includes(alias.toLowerCase()));
    if (!aliasHit) continue;
    for (const token of family.variantTokens) {
      if (q.includes(token.toLowerCase())) return { familyKey: family.key, variantToken: token };
    }
  }
  return null;
}
`;

fs.writeFileSync(outPath, src, 'utf8');
console.log('Written', Buffer.byteLength(src, 'utf8'), 'bytes to', outPath);
