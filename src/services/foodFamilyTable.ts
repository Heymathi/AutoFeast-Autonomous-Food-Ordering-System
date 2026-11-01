/**
 * Food Family Table – multilingual aliases (EN / TA / HI / Tanglish / Hinglish)
 * ─────────────────────────────────────────────────────────────────────────────
 * Used by DynamicFoodSearchEngine.search() and the voice-search intent matcher
 * to resolve whether a query is a GENERIC family ("dosa" → show all dosas)
 * or a SPECIFIC variant ("masala dosa" → show only masala dosa).
 */

export interface FoodFamily {
  key: string;
  familyTag: string;   // matches item.tags[]
  aliases: string[];   // every surface form that means the WHOLE family
  variantTokens: string[]; // words that narrow to a specific variant
}

export interface FoodFamilyIntent {
  transcript: string;
  normalizedQuery: string;
  family: FoodFamily;
  kind: 'family' | 'variant';
  variantToken?: string;
  score: number;
}

/** Romanized / Hinglish filler phrases stripped before alias matching. */
export const FILLER_PHRASES: string[] = [
  'show me', 'i want', 'i need', 'give me', 'get me', 'bring me',
  'order', 'please', 'add', 'find', 'search', 'look for',
  // Tamil romanized
  'kaattu', 'kaatthu', 'venum', 'vaenum', 'vendam', 'kudu', 'kodu',
  'taa', 'kaatu', 'podu', 'panno', 'kudungga', 'vaanggu',
  'enakku', 'enaku',
  // Hindi / Hinglish
  'dikhao', 'dikhaiye', 'chahiye', 'karo', 'laya', 'dedo',
  'mujhe', 'order karo', 'mujhe chahiye', 'leke aao',
];

/**
 * Tamil- and Hindi-script filler words.
 * Matching uses normalized whitespace-delimited phrases rather than \b,
 * which does not work for non-Latin scripts.
 */
export const UNICODE_FILLER_WORDS: string[] = [
  'காட்டு',
  'காட்டுங்கள்',
  'காட்டுங்க',
  'வேண்டும்',
  'வேணும்',
  'குடு',
  'கொடு',
  'கொடுங்கள்',
  'दिखाओ',
  'दिखाइए',
  'चाहिए',
  'बताओ',
  'मुझे',
  'मंगाओ',
  'दे दो',
];

function normalizeFamilyText(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[.,!?;:।॥]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsPhrase(text: string, phrase: string): boolean {
  return ` ${text} `.includes(` ${normalizeFamilyText(phrase)} `);
}

export const FOOD_FAMILIES: FoodFamily[] = [
  // ── CHAPATI ───────────────────────────────────────────────────────────────────
  {
    key: 'chapati',
    familyTag: 'chapati',
    aliases: [
      'chapati', 'chappathi', 'chappati', 'chapathi', 'roti', 'chapatis', 'chapaties', 'phulka',
      'சப்பாத்தி', 'சப்பாதி', 'ரொட்டி',
      'चपाती', 'रोटी', 'फुल्का',
    ],
    variantTokens: [
      'kurma', 'veg', 'curry', 'butter', 'soft', 'wheat', 'whole wheat',
      'குருமா', 'காய்கறி', 'கறி', 'வெண்ணெய்',
      'कुर्मा', 'सब्जी', 'बटर', 'गेहूं',
    ],
  },

  // ── DOSA ─────────────────────────────────────────────────────────────────────
  {
    key: 'dosa',
    familyTag: 'dosa',
    aliases: [
      // Romanized / Tanglish
      'dosa', 'dosai', 'dosaa', 'dhosa', 'dhosai', 'dosha', 'dosah', 'doser',
      'thosai', 'thosaa', 'tosa', 'tosai', 'tosaa', 'dosay',
      // Tamil script – phonetic variants
      'தோசை', 'தோசா', 'தோசி', 'தோசே', 'டோசை', 'டோசா',
      'தோஷை', 'தோஷா',
      // Hindi / Devanagari
      'डोसा', 'डोसाई', 'डोसे', 'दोसा',
    ],
    variantTokens: [
      'masala', 'plain', 'paper', 'podi', 'ghee', 'rava', 'onion', 'set',
      'roast', 'butter', 'cheese', 'spring', 'egg', 'chicken', 'paneer',
      'மசாலா', 'பொடி', 'நெய்', 'ரவா', 'வெங்காய',
      'சேட்', 'பேப்பர்', 'ரோச்ட்',
      'मसाला', 'पोडी', 'घी', 'रवा', 'प्याज', 'सादा', 'पेपर', 'सेट',
    ],
  },

  // ── IDLI ─────────────────────────────────────────────────────────────────────
  {
    key: 'idli',
    familyTag: 'idli',
    aliases: [
      'idli', 'idly', 'iddli', 'idlee', 'idlies', 'idlis', 'idlys',
      'italy', 'eatly', 'itli', 'edli', 'it lee',
      'இட்லி', 'இட்டலி', 'இட்டிலி',
      'इडली', 'इडलि',
    ],
    variantTokens: [
      'sambar', 'ghee', 'mini', 'button', 'stuffed', 'fried', 'tawa',
      'சாம்பார்', 'நெய்', 'மினி', 'பட்டன்',
      'सांबर', 'घी', 'मिनी', 'बटन', 'फ्राइड',
    ],
  },

  // ── BIRYANI ───────────────────────────────────────────────────────────────────
  {
    key: 'biryani',
    familyTag: 'biryani',
    aliases: [
      'biryani', 'biriyani', 'birani', 'briyani', 'biriayni',
      'beer yani', 'berryani', 'byriany', 'briani',
      'பிரியாணி', 'பிரியானி', 'பிரீயாணி', 'பிரியாணீ',
      'बिरयानी', 'बिरियानी', 'बिरानी',
    ],
    variantTokens: [
      'chicken', 'mutton', 'veg', 'vegetable', 'paneer', 'fish', 'prawn',
      'hyderabadi', 'ambur', 'lucknowi', 'kolkata', 'dum', 'thalassery',
      'சிக்கன்', 'மட்டன்', 'காய்கறி', 'பன்னீர்',
      'ஹைதராபாத்', 'ஆம்பூர்',
      'चिकन', 'मटन', 'वेज', 'पनीर', 'हैदराबादी', 'आंबूर', 'लखनऊ', 'कोलकाता',
    ],
  },

  // ── PAROTTA ───────────────────────────────────────────────────────────────────
  {
    key: 'parotta',
    familyTag: 'parotta',
    aliases: [
      'parotta', 'parota', 'barota', 'parrota', 'parrotta',
      'paratha', 'porotta', 'porota',
      'பரோட்டா', 'பரோடா', 'பரட்டா', 'பொரோட்டா',
      'परोटा', 'परोठा', 'पराठा',
    ],
    variantTokens: [
      'kothu', 'chicken', 'egg', 'beef', 'mutton', 'plain', 'veg', 'salna',
      'கொத்து', 'சிக்கன்', 'முட்டை', 'மட்டன்', 'சால்னா',
      'कोथू', 'चिकन', 'मटन', 'अंडा', 'सादा', 'सलना',
    ],
  },

  // ── PIZZA ─────────────────────────────────────────────────────────────────────
  {
    key: 'pizza',
    familyTag: 'pizza',
    aliases: [
      'pizza', 'pizaa', 'pisa', 'pitsa',
      'பீட்சா', 'பட்சா', 'பிட்சா',
      'पिज़्जा', 'पिज़ा',
    ],
    variantTokens: [
      'veg', 'cheese', 'chicken', 'margherita', 'pepperoni',
      'supreme', 'farmhouse', 'bbq', 'mushroom',
      'வெஜ்', 'சீஸ்', 'சிக்கன்',
      'वेज', 'चीज़', 'चिकन', 'मशरूम',
    ],
  },

  // ── VADA ──────────────────────────────────────────────────────────────────────
  {
    key: 'vada',
    familyTag: 'vada',
    aliases: [
      'vada', 'vadai', 'wada', 'vade',
      'வடை', 'மெது வடை',
      'वड़ा', 'वडा',
    ],
    variantTokens: [
      'medu', 'sambar', 'masala', 'dahi', 'fried',
      'மெது', 'சாம்பார்', 'மசாலா',
      'मेदू', 'सांबर', 'दही', 'तला हुआ',
    ],
  },

  // ── PONGAL ────────────────────────────────────────────────────────────────────
  {
    key: 'pongal',
    familyTag: 'pongal',
    aliases: [
      'pongal', 'ven pongal', 'ghee pongal', 'pongall',
      'பொங்கல்', 'வெண் பொங்கல்', 'நெய் பொங்கல்',
      'पोंगल', 'वेन पोंगल', 'घी पोंगल',
    ],
    variantTokens: [
      'ven', 'ghee', 'sakkarai', 'sweet', 'vadai',
      'வெண்', 'நெய்', 'வடை',
      'वेन', 'घी', 'वड़ा',
    ],
  },

  // ── POORI & BHATURE ───────────────────────────────────────────────────────────
  {
    key: 'bhature',
    familyTag: 'bhature',
    aliases: [
      'chole bhature', 'bhature', 'bhatura', 'poori', 'puri', 'chola bhatura',
      'சோலே பட்டூரே', 'பூரி', 'பட்டூரே',
      'छोले भटूरे', 'भटूरे', 'पूरी',
    ],
    variantTokens: [
      'chole', 'punjabi', 'masala', 'aloo',
      'சோலே', 'பஞ்சாபி',
      'छोले', 'पंजाबी', 'आलू',
    ],
  },

  // ── PANEER ────────────────────────────────────────────────────────────────────
  {
    key: 'paneer',
    familyTag: 'paneer',
    aliases: [
      'paneer', 'paneer butter masala', 'paneer masala',
      'பன்னீர்', 'பன்னீர் பட்டர் மசாலா', 'பனீர்',
      'पनीर', 'पनीर बटर मसाला',
    ],
    variantTokens: [
      'butter', 'masala', 'naan', 'tikka', 'kadai',
      'பட்டர்', 'மசாலா', 'நான்',
      'बटर', 'मसाला', 'नान',
    ],
  },

  // ── CHICKEN / BUTTER CHICKEN ──────────────────────────────────────────────────
  {
    key: 'chicken',
    familyTag: 'chicken',
    aliases: [
      'butter chicken', 'chicken curry', 'murgh makhani',
      'பட்டர் சிக்கன்', 'சிக்கன் கிரேவி',
      'बटर चिकन', 'मुर्ग मखनी',
    ],
    variantTokens: [
      'butter', 'curry', 'makhani', 'rice',
      'பட்டர்', 'சாதம்',
      'बटर', 'चावल',
    ],
  },

  // ── APPAM ─────────────────────────────────────────────────────────────────────
  {
    key: 'appam',
    familyTag: 'appam',
    aliases: [
      'appam', 'kerala appam', 'stew',
      'ஆப்பம்', 'அப்‌பம்', 'அப்பம்',
      'अप्पम',
    ],
    variantTokens: [
      'kerala', 'stew', 'veg stew',
      'கேரளா', 'ஸ்டூ',
      'केरल', 'वेज स्टू',
    ],
  },

  // ── THALI & MEALS ─────────────────────────────────────────────────────────────
  {
    key: 'thali',
    familyTag: 'thali',
    aliases: [
      'thali', 'meals', 'south indian meals', 'gujarati thali',
      'மீல்ஸ்', 'சாப்பாடு', 'தாலி',
      'थाली', 'गुजराती थाली', 'भोजन',
    ],
    variantTokens: [
      'gujarati', 'special', 'royal', 'south indian',
      'குஜராத்தி', 'ஸ்பெஷல்',
      'गुजराती', 'शाही',
    ],
  },

  // ── PAV BHAJI ─────────────────────────────────────────────────────────────────
  {
    key: 'pavbhaji',
    familyTag: 'pavbhaji',
    aliases: [
      'pav bhaji', 'pav baji', 'bhaji pav',
      'பாவ் பாஜி',
      'पाव भाजी',
    ],
    variantTokens: [
      'butter', 'mumbai', 'cheese',
      'பட்டர்', 'மும்பை',
      'बटर', 'मुंबई',
    ],
  },

  // ── PANI PURI / CHAAT ─────────────────────────────────────────────────────────
  {
    key: 'panipuri',
    familyTag: 'panipuri',
    aliases: [
      'pani puri', 'panipuri', 'golgappa', 'gol gappa', 'puchka', 'chaat',
      'பானி பூரி', 'பானிபூரி', 'கோல்கப்பா',
      'पानी पूरी', 'गोलगप्पा', 'गोलगप्पे', 'पुचका',
    ],
    variantTokens: [
      'crispy', 'masala', 'sweet',
      'மொறுமொறு',
      'क्रिस्पी',
    ],
  },

  // ── FRIED RICE & NOODLES ──────────────────────────────────────────────────────
  {
    key: 'friedrice',
    familyTag: 'friedrice',
    aliases: [
      'fried rice', 'schezwan fried rice', 'chicken fried rice', 'noodles',
      'ஃப்ரைட் ரைஸ்', 'நூடுல்ஸ்', 'பிரைட் ரைஸ்',
      'फ्राइड राइस', 'नूडल्स',
    ],
    variantTokens: [
      'chicken', 'schezwan', 'veg', 'egg',
      'சிக்கன்', 'செஸ்வான்',
      'चिकन', 'शेजवान',
    ],
  },

  // ── COFFEE & BEVERAGES ────────────────────────────────────────────────────────
  {
    key: 'coffee',
    familyTag: 'coffee',
    aliases: [
      'coffee', 'filter coffee', 'kaapi', 'degree coffee',
      'காபி', 'டிகிரி காபி', 'ஃபில்டர் காபி', 'காஃபி',
      'कॉफ़ी', 'कॉफी',
    ],
    variantTokens: [
      'filter', 'degree', 'kumbakonam', 'hot',
      'டிகிரி', 'ஃபில்டர்', 'கும்பகோணம்',
      'फिल्टर', 'डिग्री',
    ],
  },

  // ── DESSERT / GULAB JAMUN ─────────────────────────────────────────────────────
  {
    key: 'dessert',
    familyTag: 'dessert',
    aliases: [
      'gulab jamun', 'jamun', 'gulab jamoon', 'sweet',
      'குலாப் ஜாமுன்', 'ஜாமுன்', 'இனிப்பு',
      'गुलाब जामुन', 'जामुन', 'मिठाई',
    ],
    variantTokens: [
      'hot', 'shahi',
      'சூடான',
      'शाही', 'गरम',
    ],
  },
];

/** Strip filler phrases from raw query text. */
export function stripFillerPhrases(text: string): string {
  let clean = normalizeFamilyText(text);
  const fillers = [...FILLER_PHRASES, ...UNICODE_FILLER_WORDS]
    .map(normalizeFamilyText)
    .sort((a, b) => b.length - a.length);
  for (const filler of fillers) {
    clean = ` ${clean} `.split(` ${filler} `).join(' ').trim();
  }
  return normalizeFamilyText(clean);
}

/**
 * Returns { isFamily: true, family } when the filler-stripped query matches a
 * family alias with NO variant token present → show ALL catalog items of that family.
 */
export function detectFamilyQuery(normalizedQuery: string): {
  isFamily: boolean;
  family: FoodFamily | null;
} {
  const q = normalizeFamilyText(normalizedQuery);
  if (!q) return { isFamily: false, family: null };
  for (const family of FOOD_FAMILIES) {
    const aliasHit = family.aliases.some(alias => normalizeFamilyText(alias) === q);
    if (!aliasHit) continue;
    const hasVariant = family.variantTokens.some(token => containsPhrase(q, token));
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
  const q = normalizeFamilyText(normalizedQuery);
  if (!q) return null;
  for (const family of FOOD_FAMILIES) {
    const aliasHit = family.aliases.some(alias => containsPhrase(q, alias));
    if (!aliasHit) continue;
    for (const token of family.variantTokens) {
      if (containsPhrase(q, token)) return { familyKey: family.key, variantToken: normalizeFamilyText(token) };
    }
  }
  return null;
}

/** Detect the first generic-family or specific-variant intent in STT alternatives. */
export function detectFoodFamilyIntent(transcripts: string | string[]): FoodFamilyIntent | null {
  const candidates = Array.isArray(transcripts) ? transcripts : [transcripts];
  for (const transcript of candidates) {
    if (!transcript.trim()) continue;
    const normalizedQuery = stripFillerPhrases(transcript);
    const variant = detectVariantQuery(normalizedQuery);
    if (variant) {
      const family = FOOD_FAMILIES.find(item => item.key === variant.familyKey);
      if (family) {
        return {
          transcript: transcript.trim(),
          normalizedQuery,
          family,
          kind: 'variant',
          variantToken: variant.variantToken,
          score: 1,
        };
      }
    }

    const familyMatch = detectFamilyQuery(normalizedQuery);
    if (familyMatch.isFamily && familyMatch.family) {
      return {
        transcript: transcript.trim(),
        normalizedQuery,
        family: familyMatch.family,
        kind: 'family',
        score: 1,
      };
    }
  }
  return null;
}
