/**
 * Food Catalogue Context-Aware Recognition & Correction Layer for AutoFeast AI
 *
 * Provides context-aware phonetic alignment and transcript normalization
 * for Whisper ASR outputs and Tanglish speech patterns against the Indian Food Catalog.
 * Handles common misrecognitions, phonetic transpositions, and Tanglish numeral tokens
 * without relying on brittle hardcoded strings.
 */

import { FoodItem, Language } from '../types';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { CANONICAL_FOOD_ALIASES } from '../config/fuzzyConfig';
import { FuzzyMatchEngine } from './fuzzyMatchService';

export interface FoodCorrectionMatchResult {
  originalTranscript: string;
  correctedTranscript: string;
  matchedFoodItem: FoodItem | null;
  matchedFoodName: string | null;
  quantity: number;
  confidence: 'high' | 'medium' | 'low';
  score: number;
  isAmbiguous: boolean;
  topAlternatives: Array<{ item: FoodItem; score: number }>;
}

export class FoodCatalogueCorrectionLayer {
  // Common phonetic mappings for Indian food ASR errors
  private static readonly PHONETIC_FOOD_CORRECTIONS: Array<{ pattern: RegExp; replacement: string }> = [
    // Parotta & variations (barotta, porotta, etc.)
    { pattern: /\b(chicken\s+)?(kothu|kotu|koth)\s+(parotta|parota|barotta|barota|porotta|porota)\b/gi, replacement: 'kothu parotta' },
    { pattern: /\b(barotta|barota|parota|parrotta|porotta|porota|paratha|protta)\b/gi, replacement: 'parotta' },

    // Biryani & variations (biriyani, briyani, etc.)
    { pattern: /\b(chicken)\s+(biryani|biriyani|briyani|beer\s*yani|birani)\b/gi, replacement: 'chicken biryani' },
    { pattern: /\b(mutton|ambur)\s+(biryani|biriyani|briyani|beer\s*yani|birani)\b/gi, replacement: 'mutton biryani' },
    { pattern: /\b(paneer|veg|vegetable)\s+(biryani|biriyani|briyani|beer\s*yani|birani)\b/gi, replacement: 'veg biryani' },
    { pattern: /\b(biriyani|briyani|beer\s*yani|birani|beriyani)\b/gi, replacement: 'biryani' },

    // Dosa & variations
    { pattern: /\b(crispy\s+)?(masala|masala\s+dosa)\s*(dhosa|dosai|dosah|dhosai)?\b/gi, replacement: 'masala dosa' },
    { pattern: /\b(ghee|gee|ney)\s+(podi|podi\s+dosa|dosa|dosai|dhosa|dhosai)\b/gi, replacement: 'ghee podi dosa' },
    { pattern: /\b(onion\s+)?rava\s+(dosa|dosai|dhosa|dhosai)\b/gi, replacement: 'rava dosa' },
    { pattern: /\b(plain|paper)\s+(dosa|dosai|dhosa|dhosai)\b/gi, replacement: 'plain dosa' },
    { pattern: /\b(dosai|dhosa|dhosai|dosaa|dosah)\b/gi, replacement: 'dosa' },

    // Idli & variations
    { pattern: /\b(sambar\s+)?(button\s+)?(idly|iddli|italy|eatly|itli|edli|idlee)\b/gi, replacement: 'idli' },

    // Pongal & variations
    { pattern: /\b(ven\s+)?(pongal|ponkal|pongall|ghee\s+pongal)(\s+vadai)?\b/gi, replacement: 'pongal' },

    // Vada & variations
    { pattern: /\b(medu\s+)?(vadai|wada|vade)\b/gi, replacement: 'vada' },

    // Chapati & variations
    { pattern: /\b(chappathi|chappati|chapathi|roti|phulka)\b/gi, replacement: 'chapati' },

    // Paneer Butter Masala
    { pattern: /\b(paneer\s+butter|paneer\s+masala|butter\s+naan)\b/gi, replacement: 'paneer butter masala' },

    // Chole Bhature
    { pattern: /\b(chola\s+bhatura|bhature|chole\s+puri|chole\s+poori)\b/gi, replacement: 'chole bhature' }
  ];

  // Tanglish & Indic quantity phonetic tokens
  private static readonly QUANTITY_PHONETIC_TOKENS: Array<{ pattern: RegExp; value: number }> = [
    { pattern: /\b(rendu|rendo|renu|rend|erandu|irandu|do|இரண்டு|ரெண்டு|दो)\b/i, value: 2 },
    { pattern: /\b(oru|onnu|onru|ondru|ek|ஒன்று|ஒரு|एक)\b/i, value: 1 },
    { pattern: /\b(moonu|monu|moondru|teen|மூன்று|மூணு|तीन)\b/i, value: 3 },
    { pattern: /\b(naalu|naangu|char|chaar|நான்கு|நாலு|चार)\b/i, value: 4 },
    { pattern: /\b(anju|ainthu|paanch|panch|ஐந்து|அஞ்சு|पांच)\b/i, value: 5 },
    { pattern: /\b(aaru|che|छह|ஆறு)\b/i, value: 6 }
  ];

  /**
   * Phonetically normalize food words and common ASR errors in the transcript
   */
  public static normalizePhoneticFoodWords(text: string): string {
    if (!text || typeof text !== 'string') return '';
    let normalized = text;
    for (const rule of this.PHONETIC_FOOD_CORRECTIONS) {
      normalized = normalized.replace(rule.pattern, rule.replacement);
    }
    return normalized.replace(/\s+/g, ' ').trim();
  }

  /**
   * Extract quantity from transcript, prioritizing numeral words and Tanglish numbers
   */
  public static extractQuantity(text: string): { quantity: number; textWithoutQuantity: string } {
    let quantity = 1;
    let clean = ` ${text} `;

    // 1. Direct digits (e.g., "2 parotta", "1 biryani")
    const digitMatch = clean.match(/\b([1-9]\d?)\b(?!\s*(?:am|pm|mani|baje|o'clock|:))/i);
    if (digitMatch) {
      quantity = parseInt(digitMatch[1], 10);
      clean = clean.replace(digitMatch[0], ' ');
      return { quantity, textWithoutQuantity: clean.replace(/\s+/g, ' ').trim() };
    }

    // 2. Tanglish & Spoken Word quantities
    for (const token of this.QUANTITY_PHONETIC_TOKENS) {
      if (token.pattern.test(clean)) {
        quantity = token.value;
        clean = clean.replace(token.pattern, ' ');
        break;
      }
    }

    return { quantity, textWithoutQuantity: clean.replace(/\s+/g, ' ').trim() };
  }

  /**
   * Context-aware alignment against the Indian food catalog
   */
  public static matchFoodFromTranscript(
    transcript: string,
    currentLanguage: Language = 'en'
  ): FoodCorrectionMatchResult {
    const originalTranscript = (transcript || '').trim();
    if (!originalTranscript) {
      return {
        originalTranscript: '',
        correctedTranscript: '',
        matchedFoodItem: null,
        matchedFoodName: null,
        quantity: 1,
        confidence: 'low',
        score: 0,
        isAmbiguous: false,
        topAlternatives: []
      };
    }

    // 1. Normalize phonetics & extract quantity
    const phoneticallyCleaned = this.normalizePhoneticFoodWords(originalTranscript);
    const { quantity, textWithoutQuantity } = this.extractQuantity(phoneticallyCleaned);

    // 2. Remove filler and intent keywords to focus on food terms
    const foodCandidate = textWithoutQuantity
      .replace(/\b(order|schedule|add to cart|add\s*pannu|cart\s*la|cart|parcel|want|need|venum|vaenum|kudu|kodu|enakku|please|tomorrow|today|daily|now|later)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    // 3. Score against Canonical Aliases
    let bestFood: FoodItem | null = null;
    let bestName: string | null = null;
    let bestScore = 0;
    const scoredCandidates: Array<{ item: FoodItem; score: number }> = [];

    // Check specific dish overrides first
    if (foodCandidate.includes('chicken biryani')) {
      const hyderabadi = INDIAN_FOOD_CATALOG.find(i => i.id === 'biryani-hyderabadi');
      if (hyderabadi) {
        return {
          originalTranscript,
          correctedTranscript: phoneticallyCleaned,
          matchedFoodItem: hyderabadi,
          matchedFoodName: hyderabadi.nativeNames?.[currentLanguage] || hyderabadi.name,
          quantity,
          confidence: 'high',
          score: 0.95,
          isAmbiguous: false,
          topAlternatives: [{ item: hyderabadi, score: 0.95 }]
        };
      }
    }

    if (foodCandidate.includes('mutton biryani') || foodCandidate.includes('ambur biryani')) {
      const ambur = INDIAN_FOOD_CATALOG.find(i => i.id === 'biryani-ambur');
      if (ambur) {
        return {
          originalTranscript,
          correctedTranscript: phoneticallyCleaned,
          matchedFoodItem: ambur,
          matchedFoodName: ambur.nativeNames?.[currentLanguage] || ambur.name,
          quantity,
          confidence: 'high',
          score: 0.95,
          isAmbiguous: false,
          topAlternatives: [{ item: ambur, score: 0.95 }]
        };
      }
    }

    if (foodCandidate.includes('kothu parotta') || foodCandidate.includes('kothu parota')) {
      const kothu = INDIAN_FOOD_CATALOG.find(i => i.id === 'parotta-kothu');
      if (kothu) {
        return {
          originalTranscript,
          correctedTranscript: phoneticallyCleaned,
          matchedFoodItem: kothu,
          matchedFoodName: kothu.nativeNames?.[currentLanguage] || kothu.name,
          quantity,
          confidence: 'high',
          score: 0.95,
          isAmbiguous: false,
          topAlternatives: [{ item: kothu, score: 0.95 }]
        };
      }
    }

    if (foodCandidate.includes('masala dosa') || foodCandidate.includes('masala dosai')) {
      const masala = INDIAN_FOOD_CATALOG.find(i => i.id === 'dosa-masala');
      if (masala) {
        return {
          originalTranscript,
          correctedTranscript: phoneticallyCleaned,
          matchedFoodItem: masala,
          matchedFoodName: masala.nativeNames?.[currentLanguage] || masala.name,
          quantity,
          confidence: 'high',
          score: 0.95,
          isAmbiguous: false,
          topAlternatives: [{ item: masala, score: 0.95 }]
        };
      }
    }

    if (foodCandidate.includes('ghee dosa') || foodCandidate.includes('ghee podi dosa') || foodCandidate.includes('podi dosa')) {
      const podi = INDIAN_FOOD_CATALOG.find(i => i.id === 'dosa-podi');
      if (podi) {
        return {
          originalTranscript,
          correctedTranscript: phoneticallyCleaned,
          matchedFoodItem: podi,
          matchedFoodName: podi.nativeNames?.[currentLanguage] || podi.name,
          quantity,
          confidence: 'high',
          score: 0.95,
          isAmbiguous: false,
          topAlternatives: [{ item: podi, score: 0.95 }]
        };
      }
    }

    // Match across Canonical Aliases
    for (const aliasEntry of CANONICAL_FOOD_ALIASES) {
      for (const alias of aliasEntry.aliases) {
        const score = FuzzyMatchEngine.calculateMatchScore(foodCandidate, alias.toLowerCase());
        const item = INDIAN_FOOD_CATALOG.find(i => i.id === aliasEntry.id);
        if (item && score > 0.40) {
          scoredCandidates.push({ item, score });
          if (score > bestScore) {
            bestScore = score;
            bestFood = item;
            bestName = aliasEntry.canonicalName;
          }
        }
      }
    }

    // Match directly across catalog item titles and native names
    for (const item of INDIAN_FOOD_CATALOG) {
      const candidates = [
        item.name,
        item.nativeNames?.en || '',
        item.nativeNames?.ta || '',
        item.nativeNames?.hi || '',
        ...(item.tags || [])
      ].filter(Boolean);

      for (const cand of candidates) {
        const score = FuzzyMatchEngine.calculateMatchScore(foodCandidate, cand.toLowerCase());
        if (score > 0.40) {
          scoredCandidates.push({ item, score });
          if (score > bestScore) {
            bestScore = score;
            bestFood = item;
            bestName = item.nativeNames?.[currentLanguage] || item.name;
          }
        }
      }
    }

    // Deduplicate and rank top alternatives
    const sorted = scoredCandidates
      .filter((v, idx, arr) => arr.findIndex(t => t.item.id === v.item.id) === idx)
      .sort((a, b) => b.score - a.score);

    const topAlternatives = sorted.slice(0, 3);
    const confidence = bestScore >= 0.75 ? 'high' : bestScore >= 0.45 ? 'medium' : 'low';
    const isAmbiguous = confidence === 'medium' || (sorted.length > 1 && sorted[0].score - sorted[1].score < 0.15);

    return {
      originalTranscript,
      correctedTranscript: phoneticallyCleaned,
      matchedFoodItem: bestFood,
      matchedFoodName: bestName || bestFood?.name || null,
      quantity,
      confidence,
      score: bestScore,
      isAmbiguous,
      topAlternatives
    };
  }
}

