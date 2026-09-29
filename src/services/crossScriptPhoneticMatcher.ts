/**
 * 🚀 Cross-Script Phonetic Transliteration & Fuzzy Matcher Engine
 * Supports Tamil, Hindi (Devanagari), and English text.
 */

// Mapping of Tamil characters and vowel signs to Latin phonetic equivalents
const TAMIL_MAP: { [key: string]: string } = {
  // Vowels
  'அ': 'a', 'ஆ': 'aa', 'இ': 'i', 'ஈ': 'ee', 'உ': 'u', 'ஊ': 'oo', 'எ': 'e', 'ஏ': 'ae', 'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'oa', 'ஔ': 'au',
  // Consonants
  'க': 'k', 'ங': 'ng', 'ச': 's', 'ஞ': 'ny', 'ட': 't', 'ண': 'n', 'த': 'th', 'ந': 'n', 'ப': 'p', 'ம': 'm', 'ய': 'y', 'ர': 'r', 'ல': 'l', 'வ': 'v', 'ழ': 'zh', 'ள': 'l', 'ற': 'r', 'ன': 'n',
  'ஜ': 'j', 'ஷ': 'sh', 'ஸ': 's', 'ஹ': 'h', 'ஃ': 'f',
  // Vowel signs
  'ா': 'aa', 'ி': 'i', 'ீ': 'ee', 'ு': 'u', 'ூ': 'oo', 'ெ': 'e', 'ே': 'ae', 'ை': 'ai', 'ொ': 'o', 'ோ': 'oa', 'ௌ': 'au',
  '்': '' // Pulli removes implicit 'a'
};

// Common Tamil word phonetics overrides for food names
const TAMIL_FOOD_OVERWRITES: { [key: string]: string } = {
  'தோசா': 'dosa',
  'தோசை': 'dosa',
  'பிரைட்': 'fried',
  'ரைஸ்': 'rice',
  'பிரைட்ரைஸ்': 'fried rice',
  'பீட்சா': 'pizza',
  'இட்லி': 'idli',
  'பரோட்டா': 'parotta',
  'பரோடா': 'parotta',
  'பிரியாணி': 'biryani',
  'பிரியானி': 'biryani',
  'பிரீயாணி': 'biryani',
  'சிக்கன் பிரியாணி': 'chicken biryani',
  'மட்டன் பிரியாணி': 'mutton biryani',
  'பானி': 'pani',
  'பூரி': 'puri',
  'காபி': 'coffee',
  'பன்னீர்': 'paneer',
  'சோலே': 'chole',
  'பட்டூரே': 'bhature',
  'சாம்பார்': 'sambar',
  'பொங்கல்': 'pongal',
  'வடை': 'vada',
  'ஜாமுன்': 'jamun'
};

// Hindi / Devanagari Unicode character mapping
const DEVANAGARI_MAP: { [key: string]: string } = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n', 'प': 'p', 'फ': 'f', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', '्': ''
};

const HINDI_FOOD_OVERWRITES: { [key: string]: string } = {
  'डोसा': 'dosa',
  'फ्राइड': 'fried',
  'राइस': 'rice',
  'पिज्जा': 'pizza',
  'पिज़ा': 'pizza',
  'इडली': 'idli',
  'परोटा': 'parotta',
  'बिरयानी': 'biryani',
  'कॉफी': 'coffee',
  'कॉफ़ी': 'coffee',
  'पनीर': 'paneer',
  'छोले': 'chole',
  'भटूरे': 'bhature',
  'सांबर': 'sambar',
  'पोंगल': 'pongal',
  'वड़ा': 'vada',
  'जामुन': 'jamun'
};

export class CrossScriptPhoneticMatcher {
  /**
   * Transliterates Tamil script text into Romanized phonetic English representation
   */
  public static transliterateTamilToLatin(text: string): string {
    if (!text) return '';
    let normalized = text.trim();

    // Check direct word overrides first
    for (const [taWord, enWord] of Object.entries(TAMIL_FOOD_OVERWRITES)) {
      if (normalized.includes(taWord)) {
        normalized = normalized.replace(new RegExp(taWord, 'g'), ` ${enWord} `);
      }
    }

    let result = '';
    const chars = Array.from(normalized);

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      if (TAMIL_MAP[char] !== undefined) {
        result += TAMIL_MAP[char];
      } else {
        result += char;
      }
    }

    return result.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  /**
   * Transliterates Hindi/Devanagari script text into Romanized phonetic English representation
   */
  public static transliterateHindiToLatin(text: string): string {
    if (!text) return '';
    let normalized = text.trim();

    for (const [hiWord, enWord] of Object.entries(HINDI_FOOD_OVERWRITES)) {
      if (normalized.includes(hiWord)) {
        normalized = normalized.replace(new RegExp(hiWord, 'g'), ` ${enWord} `);
      }
    }

    let result = '';
    const chars = Array.from(normalized);

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      if (DEVANAGARI_MAP[char] !== undefined) {
        result += DEVANAGARI_MAP[char];
      } else {
        result += char;
      }
    }

    return result.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  /**
   * Unified Romanization: converts any script (Tamil, Hindi, English) to a clean phonetic Latin string
   */
  public static toPhoneticLatin(text: string): string {
    if (!text) return '';
    let str = text.toLowerCase().trim();

    // Check if contains Tamil characters
    if (/[\u0B80-\u0BFF]/.test(str)) {
      str = this.transliterateTamilToLatin(str);
    }

    // Check if contains Hindi/Devanagari characters
    if (/[\u0900-\u097F]/.test(str)) {
      str = this.transliterateHindiToLatin(str);
    }

    // Standardize common phonetic equivalents
    return str
      .replace(/thosa|dossa|dosai|thosai|dosah/g, 'dosa')
      .replace(/friedrice|piraitrais|friderice|fried rice/g, 'fried rice')
      .replace(/pitca|pitsa|pizza/g, 'pizza')
      .replace(/itli|iddli|idly/g, 'idli')
      .replace(/parota|paratha|barotta/g, 'parotta')
      .replace(/biyani|biriyani|briyani|biryani/g, 'biryani')
      .replace(/kaapi|cofi|coffee/g, 'coffee')
      .replace(/panir/g, 'paneer')
      .replace(/vadai/g, 'vada')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Computes Levenshtein edit distance between two strings
   */
  public static levenshteinDistance(a: string, b: string): number {
    const s1 = a.toLowerCase();
    const s2 = b.toLowerCase();
    const len1 = s1.length;
    const len2 = s2.length;

    if (len1 === 0) return len2;
    if (len2 === 0) return len1;

    const matrix: number[][] = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return matrix[len1][len2];
  }

  /**
   * Calculates similarity ratio between 0.0 and 1.0 (1.0 = exact match)
   */
  public static calculateSimilarity(str1: string, str2: string): number {
    const p1 = this.toPhoneticLatin(str1);
    const p2 = this.toPhoneticLatin(str2);

    if (p1 === p2) return 1.0;
    if (!p1 || !p2) return 0.0;

    // Direct substring match bonus
    if (p1.includes(p2) || p2.includes(p1)) {
      const minLen = Math.min(p1.length, p2.length);
      const maxLen = Math.max(p1.length, p2.length);
      return Math.max(0.85, minLen / maxLen);
    }

    const dist = this.levenshteinDistance(p1, p2);
    const maxLen = Math.max(p1.length, p2.length);
    return Math.max(0, 1 - dist / maxLen);
  }

  /**
   * Checks if query text matches a catalog text via exact, substring, phonetic, or fuzzy distance
   */
  public static isPhoneticOrFuzzyMatch(query: string, candidate: string, threshold: number = 0.65): boolean {
    if (!query || !candidate) return false;

    const qLower = query.toLowerCase().trim();
    const cLower = candidate.toLowerCase().trim();

    // 1. Direct string equality or inclusion
    if (qLower === cLower || cLower.includes(qLower) || qLower.includes(cLower)) {
      return true;
    }

    // 2. Phonetic Latin similarity
    const sim = this.calculateSimilarity(qLower, cLower);
    return sim >= threshold;
  }
}
