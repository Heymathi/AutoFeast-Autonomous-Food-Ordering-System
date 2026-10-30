/**
 * guidedMatchingService.ts
 *
 * Pure function matching service for the guided order dialog:
 * - Variety selection (tokenizes, strips family & generic words, matches distinctive tokens)
 * - Restaurant selection (matches distinctive tokens or ordinals)
 * - Order Now vs Schedule Later classification
 * Supports English, Tamil, and Hindi.
 */

import { Language, FoodItem } from '../types';

export interface ScoredOption<T> {
  item: T;
  score: number;
  matchedBy: 'distinctive-tokens' | 'ordinal' | 'exact' | 'none';
  label: string;
}

export interface MatchDecision<T> {
  chosen: T | null;
  score: number;
  isTie: boolean;
  tieCandidates?: [T, T];
  isOnlyFamilyWord: boolean;
  reason: string;
  scored: ScoredOption<T>[];
}

// ─── 1. FAMILY & GENERIC WORDS ────────────────────────────────────────────────

export const FAMILY_WORDS = new Set([
  // Biryani
  'biryani', 'biriyani', 'briyani', 'briyani', 'बिरयानी', 'பிரியாணி',
  // Dosa
  'dosa', 'dosai', 'dhosai', 'தோசை', 'डोसा',
  // Idli
  'idli', 'idly', 'iddli', 'இட்லி', 'இட்டலி', 'इडली',
  // Parotta / Roti / Naan
  'parotta', 'parota', 'barota', 'பரோட்டா', 'परोटा', 'naan', 'roti', 'ரொட்டி', 'नान',
  // Rice / Pulao
  'rice', 'pulao', 'fried rice', 'சாதம்', 'புலாவ்', 'चावल', 'पुलाव',
  // Pizza / Burger / Sandwich
  'pizza', 'பீட்சா', 'पिज़्ज़ा', 'burger', 'பர்கர்', 'बर्गर', 'sandwich', 'சாண்ட்விச்', 'सैंडविच',
  // Chaat / Pani Puri
  'pani puri', 'panipuri', 'பானி பூரி', 'पानी पूरी', 'chaat', 'சாட்', 'चाट',
  // Desserts / Sweets
  'gulab jamun', 'ஜாமுன்', 'गुलाब जामुन', 'sweet', 'இனிப்பு', 'मिठाई',
  // Vada / Sambar
  'vada', 'vadai', 'வடை', 'वड़ा'
]);

export const GENERIC_WORDS = new Set([
  'special', 'hot', 'crispy', 'veg', 'non-veg', 'nonveg', 'the', 'and', 'with', 'dish',
  'food', 'item', 'plate', 'full', 'half', 'quarter', 'roasted', 'fried', 'steamed', 'fresh',
  'ஸ்பெஷல்', 'சூடான', 'மொறுமொறு', 'சைவம்', 'அசைவம்', 'மற்றும்',
  'स्पेशल', 'गरम', 'क्रिस्पी', 'वेज', 'नॉनवेज', 'और', 'वाला', 'वाली'
]);

export const FILLER_PHRASES = [
  'i want', 'i would like', 'please give me', 'give me', 'bring me', 'order', 'please order', 'please',
  'enakku venum', 'enakku kudu', 'venum', 'vaanggu', 'podu', 'kodu',
  'mujhe chahiye', 'chahiye', 'karo', 'dedo', 'lao', 'bhejo'
];

// ─── 2. DISTINCTIVE TOKEN CANONICAL MAP (EN, TA, HI, Phonetic) ─────────────────

export const CANONICAL_TOKEN_MAP: Record<string, string[]> = {
  // Meats & Proteins
  'mutton': ['mutton', 'matan', 'muton', 'மட்டன்', 'ஆட்டுக்கறி', 'மட்டன்', 'मटन', 'बकरे'],
  'chicken': ['chicken', 'chiken', 'chikkin', 'சிக்கன்', 'கோழிக்கறி', 'சிக்கன்', 'चिकन', 'मुर्ग'],
  'paneer': ['paneer', 'panir', 'பன்னீர்', 'பனீர்', 'पनीर'],
  'egg': ['egg', 'muttai', 'முட்டை', 'அண்டா', 'अंडा'],
  'fish': ['fish', 'meen', 'மீன்', 'मछली'],
  'prawn': ['prawn', 'iraal', 'இறால்', 'झींगा'],
  'mushroom': ['mushroom', 'kaalan', 'காளான்', 'मशरूम', 'खुंब'],

  // Regional Styles / Biryani / Dosa styles
  'ambur': ['ambur', 'aambur', 'ஆம்பூர்', 'அம்பூர்', 'अंबुर', 'आंबुर'],
  'hyderabadi': ['hyderabadi', 'hyderabad', 'ஹைதராபாதி', 'ஹைதராபாத்', 'हैदराबादी', 'हैदराबाद'],
  'dum': ['dum', 'தம்', 'டம்', 'दम'],
  'dindigul': ['dindigul', 'திண்டுக்கல்', 'डिंडीगुल'],
  'chettinad': ['chettinad', 'செட்டிநாடு', 'चेत्तिनाड'],
  'thalassery': ['thalassery', 'தலச்சேரி', 'थलस्सेरी'],

  // Dosa specific
  'masala': ['masala', 'மசாலா', 'मसाला'],
  'plain': ['plain', 'பிளைன்', 'சாதாரண', 'प्लेन', 'सादा'],
  'ghee': ['ghee', 'நெய்', 'घी', 'ney'],
  'podi': ['podi', 'பொடி', 'पोड़ी'],
  'roast': ['roast', 'ரோஸ்ட்', 'रोस्ट'],
  'rava': ['rava', 'ரவா', 'ரவை', 'रवा'],
  'onion': ['onion', 'vengayam', 'வெங்காயம்', 'प्याज'],
  'paper': ['paper', 'பேப்பர்', 'पेपर'],
  'golden': ['golden', 'கோல்டன்', 'தங்க'],

  // Restaurants
  'bawarchi': ['bawarchi', 'பவார்ச்சி', 'बावर्ची'],
  'star': ['star', 'ஸ்டார்', 'स्टार'],
  'saravana': ['saravana', 'saravanabhavan', 'சரவண', 'சரவணா', 'சரவணபவன்', 'सरवण', 'सरवना'],
  'bhavan': ['bhavan', 'பவன்', 'भवन'],
  'murugan': ['murugan', 'முருகன்', 'मुरुगन'],
  'a2b': ['a2b', 'adyar', 'ananda', 'அடையார்', 'ஆனந்த', 'ஏ2பி', 'अड्यार', 'आनंद'],
  'sangeetha': ['sangeetha', 'சங்கீதா', 'संगीता'],
  'madurai': ['madurai', 'mess', 'மதுரை', 'மெஸ்', 'मदुरै']
};

// ─── 3. STRING NORMALISATION & TOKEN EXTRACTION ──────────────────────────────

export function normalizeInputText(text: string): string {
  if (!text) return '';
  let str = text.toLowerCase();
  for (const filler of FILLER_PHRASES) {
    str = str.replace(new RegExp(`\\b${filler}\\b`, 'gi'), ' ');
  }
  return str
    .replace(/[,.!?;:()"'~`_+\\/\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Maps a single token to its canonical form (e.g. "மட்டன்" -> "mutton")
 */
export function getCanonicalToken(token: string): string {
  const t = token.toLowerCase().trim();
  for (const [canonical, variants] of Object.entries(CANONICAL_TOKEN_MAP)) {
    if (canonical === t || variants.some(v => v.toLowerCase() === t)) {
      return canonical;
    }
  }
  return t;
}

/**
 * Compute Levenshtein distance
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1], prev, row[j]) + 1;
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

/**
 * Checks if tokenA fuzzy matches tokenB (exact, canonical, or edit distance <= 1 for >= 5 chars)
 */
export function tokensMatch(tokenA: string, tokenB: string): boolean {
  if (!tokenA || !tokenB) return false;
  if (tokenA === tokenB) return true;

  const canA = getCanonicalToken(tokenA);
  const canB = getCanonicalToken(tokenB);
  if (canA === canB) return true;

  // Edit distance check for words of at least 5 chars
  const minLen = Math.min(canA.length, canB.length);
  if (minLen >= 5 && levenshtein(canA, canB) <= 1) {
    return true;
  }
  return false;
}

/**
 * Extracts distinctive tokens by removing family and generic words.
 */
export function extractDistinctiveTokens(text: string): { tokens: string[]; hasFamilyWordOnly: boolean; familyTokensFound: string[] } {
  const norm = normalizeInputText(text);
  if (!norm) return { tokens: [], hasFamilyWordOnly: false, familyTokensFound: [] };

  const rawTokens = norm.split(' ').filter(t => t.length > 0);
  const distinctive: string[] = [];
  const familyTokensFound: string[] = [];

  for (const raw of rawTokens) {
    if (FAMILY_WORDS.has(raw)) {
      familyTokensFound.push(raw);
    } else if (GENERIC_WORDS.has(raw)) {
      // skip generic descriptor
    } else {
      distinctive.push(raw);
    }
  }

  const hasFamilyWordOnly = distinctive.length === 0 && familyTokensFound.length > 0;
  return { tokens: distinctive, hasFamilyWordOnly, familyTokensFound };
}

// ─── 4. ORDINALS MATCHER ───────────────────────────────────────────────────────

export const ORDINALS_DEF: Array<{ idx: number; words: string[] }> = [
  // Multi-word phrases listed first, so "second one" isn't misread as "one" (first)
  { idx: 0, words: ['first one', 'option 1', 'option one', 'first', '1st', 'முதல்', 'முதலாவது', 'ஒன்று', 'ஒன்னு', 'ஒண்ணு', 'முதலில்', 'पहला', 'पहिला', 'pehla', 'pahila', 'ek', '1', 'one'] },
  { idx: 1, words: ['second one', 'option 2', 'option two', 'second', '2nd', 'இரண்டாவது', 'இரண்டு', 'ரெண்டாவது', 'ரெண்டு', 'இரண்டில்', 'दूसरा', 'doosra', 'dusra', '2', 'two', 'do'] },
  { idx: 2, words: ['third one', 'option 3', 'option three', 'third', '3rd', 'மூன்றாவது', 'மூன்று', 'மூணாவது', 'மூணு', 'மூன்றில்', 'तीसरा', 'teesra', 'tisra', 'teen', '3', 'three', 'तीन'] },
  { idx: 3, words: ['fourth one', 'option 4', 'option four', 'fourth', '4th', 'நான்காவது', 'நான்கு', 'நாலாவது', 'நாலு', 'चौथा', 'chautha', '4', 'four', 'char', 'चार'] }
];

export function checkOrdinalMatch<T>(heardText: string, options: T[]): { matchedItem: T; idx: number } | null {
  const norm = normalizeInputText(heardText);
  if (!norm) return null;

  // Flatten and sort words by length descending so longer phrases ("second one") match before single words ("one")
  const allWordMatches: Array<{ idx: number; phrase: string }> = [];
  for (const ord of ORDINALS_DEF) {
    if (ord.idx >= options.length) continue;
    for (const w of ord.words) {
      allWordMatches.push({ idx: ord.idx, phrase: normalizeInputText(w) });
    }
  }
  allWordMatches.sort((a, b) => b.phrase.length - a.phrase.length);

  for (const item of allWordMatches) {
    if (norm === item.phrase || ` ${norm} `.includes(` ${item.phrase} `)) {
      return { matchedItem: options[item.idx], idx: item.idx };
    }
  }
  return null;
}

// ─── 5. PURE DISTINCTIVE TOKEN MATCHER (For Variety & Restaurant) ─────────────

export interface MatchOptionItem {
  name: string;
  nativeNames?: Record<string, string>;
  id?: string;
  [key: string]: any;
}

export function matchOptionByTokens<T extends MatchOptionItem | string>(
  heardText: string,
  options: T[],
  language: Language = 'en'
): MatchDecision<T> {
  const normHeard = normalizeInputText(heardText);

  // 1. Check Ordinal first (e.g. "first one", "second", "இரண்டாவது")
  const ordMatch = checkOrdinalMatch(normHeard, options);
  if (ordMatch) {
    const scored: ScoredOption<T>[] = options.map((opt, i) => ({
      item: opt,
      score: i === ordMatch.idx ? 1.0 : 0.0,
      matchedBy: i === ordMatch.idx ? 'ordinal' : 'none',
      label: typeof opt === 'string' ? opt : (opt.nativeNames?.[language] || opt.name)
    }));
    return {
      chosen: ordMatch.matchedItem,
      score: 1.0,
      isTie: false,
      isOnlyFamilyWord: false,
      reason: `Matched by ordinal index ${ordMatch.idx}`,
      scored
    };
  }

  // 2. Extract distinctive tokens from heard text
  const { tokens: heardTokens, hasFamilyWordOnly } = extractDistinctiveTokens(normHeard);

  if (hasFamilyWordOnly) {
    const scored: ScoredOption<T>[] = options.map(opt => ({
      item: opt,
      score: 0.0,
      matchedBy: 'none',
      label: typeof opt === 'string' ? opt : (opt.nativeNames?.[language] || opt.name)
    }));
    return {
      chosen: null,
      score: 0.0,
      isTie: false,
      isOnlyFamilyWord: true,
      reason: 'Only family word spoken (e.g. "biryani" or "dosa")',
      scored
    };
  }

  if (heardTokens.length === 0) {
    const scored: ScoredOption<T>[] = options.map(opt => ({
      item: opt,
      score: 0.0,
      matchedBy: 'none',
      label: typeof opt === 'string' ? opt : (opt.nativeNames?.[language] || opt.name)
    }));
    return {
      chosen: null,
      score: 0.0,
      isTie: false,
      isOnlyFamilyWord: false,
      reason: 'No distinctive tokens in heard text',
      scored
    };
  }

  // 3. Score each option based on share of heard distinctive tokens matched
  const scoredOptions: ScoredOption<T>[] = options.map(opt => {
    const optLabel = typeof opt === 'string' ? opt : (opt.nativeNames?.[language] || opt.name);
    // Gather all tokens across name, native names, aliases
    const allOptTexts = typeof opt === 'string'
      ? [opt]
      : [
          opt.name,
          opt.nativeNames?.en || '',
          opt.nativeNames?.ta || '',
          opt.nativeNames?.hi || '',
          ...(opt.aliases || [])
        ];

    const optDistinctiveTokens: string[] = [];
    for (const t of allOptTexts) {
      const ext = extractDistinctiveTokens(t);
      optDistinctiveTokens.push(...ext.tokens);
    }

    // Direct exact string containment check
    const normOptLabel = normalizeInputText(optLabel);
    if (normHeard === normOptLabel || ` ${normOptLabel} `.includes(` ${normHeard} `) || ` ${normHeard} `.includes(` ${normOptLabel} `)) {
      return {
        item: opt,
        score: 1.0,
        matchedBy: 'exact',
        label: optLabel
      };
    }

    // Match share: for each heard distinctive token, check if any option token matches
    let matchedCount = 0;
    for (const ht of heardTokens) {
      const isMatched = optDistinctiveTokens.some(ot => tokensMatch(ht, ot));
      if (isMatched) {
        matchedCount++;
      }
    }

    const score = matchedCount / heardTokens.length;
    return {
      item: opt,
      score,
      matchedBy: score > 0 ? 'distinctive-tokens' : 'none',
      label: optLabel
    };
  });

  // Sort descending by score
  scoredOptions.sort((a, b) => b.score - a.score);

  const best = scoredOptions[0];
  const second = scoredOptions[1];

  // Check threshold >= 0.6
  if (!best || best.score < 0.6) {
    return {
      chosen: null,
      score: best?.score || 0,
      isTie: false,
      isOnlyFamilyWord: false,
      reason: `Best score ${best?.score.toFixed(2) || 0} is below threshold 0.6`,
      scored: scoredOptions
    };
  }

  // Check tie: if two options have identical score >= 0.6
  if (second && second.score >= 0.6 && Math.abs(best.score - second.score) < 0.05) {
    return {
      chosen: null,
      score: best.score,
      isTie: true,
      tieCandidates: [best.item, second.item],
      isOnlyFamilyWord: false,
      reason: `Tie between "${best.label}" and "${second.label}" (scores: ${best.score.toFixed(2)})`,
      scored: scoredOptions
    };
  }

  // Best option wins and beats second best
  return {
    chosen: best.item,
    score: best.score,
    isTie: false,
    isOnlyFamilyWord: false,
    reason: `Selected "${best.label}" with score ${best.score.toFixed(2)} (beats second: ${second ? second.score.toFixed(2) : 'none'})`,
    scored: scoredOptions
  };
}

// ─── 6. ORDER NOW VS SCHEDULE CLASSIFICATION ─────────────────────────────────

export const ORDER_NOW_WORDS = [
  'now', 'order now', 'instant', 'buy now', 'right now', 'immediately', 'today',
  'இப்போதே', 'இப்போது', 'உடனடி', 'இப்போ ஆர்டர் செய்', 'இப்போதே ஆர்டர்',
  'ippothe', 'ippodhe', 'ippo',
  'अभी', 'अभी करो', 'अभी ऑर्डर', 'तुरंत', 'तुरंत ऑर्डर', 'abhi', 'abhi karo', 'turant'
];

export const SCHEDULE_WORDS = [
  'later', 'schedule', 'schedule later', 'for later', 'set time', 'set a time', 'schedule order',
  'பிறகு', 'அட்டவணை', 'அப்புறம்', 'பின்னர்', 'திட்டமிடு', 'நேரம்',
  'piragu', 'piraghu', 'attavanai', 'appuram',
  'बाद में', 'शेड्यूल', 'बाद', 'समय सेट करें', 'समय', 'baad mein', 'baad', 'schedule'
];

export function classifyOrderNowOrSchedule(text: string): 'NOW' | 'SCHEDULE' | 'UNKNOWN' {
  const norm = normalizeInputText(text);
  if (!norm) return 'UNKNOWN';

  // Check NOW intent first
  for (const w of ORDER_NOW_WORDS) {
    const nw = normalizeInputText(w);
    if (norm === nw || ` ${norm} `.includes(` ${nw} `)) {
      return 'NOW';
    }
  }

  // Check SCHEDULE intent
  for (const w of SCHEDULE_WORDS) {
    const nw = normalizeInputText(w);
    if (norm === nw || ` ${norm} `.includes(` ${nw} `)) {
      return 'SCHEDULE';
    }
  }

  return 'UNKNOWN';
}
