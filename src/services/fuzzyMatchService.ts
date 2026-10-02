/**
 * Unified Shared Fuzzy-Matching Engine (Antigravity Core)
 * Single engine used everywhere in the app for Food Items, Restaurants, Orders, Schedules, and Restricted Checks.
 */
import { FUZZY_CONFIG, CANONICAL_FOOD_ALIASES, CanonicalItemAlias, CANONICAL_RESTAURANT_ALIASES } from '../config/fuzzyConfig';

export interface FuzzyMatchResult<T> {
  item: T | null;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  topAlternatives: Array<{ item: T; score: number }>;
}

export class FuzzyMatchEngine {
  /**
   * 1. NORMALIZATION
   * Lowercase, trim, remove punctuation/extra spaces, and normalize Unicode (Tamil/Devanagari NFD/NFC)
   */
  public static normalizeText(text: string): string {
    if (!text) return '';
    return text
      .normalize('NFD') // Decompose combined characters
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks if any
      .toLowerCase()
      .replace(/[^\w\s\u0B80-\u0BFF\u0900-\u097F]/gi, ' ') // Preserve Latin, Tamil (0B80-0BFF), Hindi (0900-097F)
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Phonetic simplification for Indian language speech-to-text variations
   * E.g. "italy", "eatly", "idly" -> "idli"
   */
  public static getPhoneticKey(text: string): string {
    let norm = this.normalizeText(text);
    return norm
      .replace(/th/g, 't')
      .replace(/dh/g, 'd')
      .replace(/ph/g, 'f')
      .replace(/bh/g, 'b')
      .replace(/gh/g, 'g')
      .replace(/kh/g, 'k')
      .replace(/sh/g, 's')
      .replace(/ch/g, 'c')
      .replace(/ee/g, 'i')
      .replace(/oo/g, 'u')
      .replace(/y$/g, 'i')
      .replace(/y\s/g, 'i ')
      .replace(/w/g, 'v')
      .replace(/(.)\1+/g, '$1'); // Collapse duplicate letters (e.g. iddli -> idli)
  }

  /**
   * Damerau-Levenshtein Distance for typos and transposition errors
   */
  public static damerauLevenshteinDistance(a: string, b: string): number {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const lenA = a.length;
    const lenB = b.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= lenA; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= lenB; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= lenA; i++) {
      for (let j = 1; j <= lenB; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // Deletion
          matrix[i][j - 1] + 1,      // Insertion
          matrix[i - 1][j - 1] + cost // Substitution
        );

        // Transposition check
        if (
          i > 1 &&
          j > 1 &&
          a[i - 1] === b[j - 2] &&
          a[i - 2] === b[j - 1]
        ) {
          matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + cost);
        }
      }
    }

    return matrix[lenA][lenB];
  }

  /**
   * Similarity score based on Damerau-Levenshtein Distance (0.0 to 1.0)
   */
  public static levenshteinSimilarity(a: string, b: string): number {
    const dist = this.damerauLevenshteinDistance(a, b);
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1.0;
    return 1 - dist / maxLen;
  }

  /**
   * Token-Set Ratio for word-order independence
   * E.g. "chicken kothu parotta" vs "kothu parotta chicken"
   */
  public static tokenSetRatio(str1: string, str2: string): number {
    const tokens1 = new Set(this.normalizeText(str1).split(' ').filter(Boolean));
    const tokens2 = new Set(this.normalizeText(str2).split(' ').filter(Boolean));

    if (tokens1.size === 0 || tokens2.size === 0) return 0;

    let intersectionCount = 0;
    tokens1.forEach(t => {
      if (tokens2.has(t)) intersectionCount++;
    });

    const unionCount = new Set([...tokens1, ...tokens2]).size;
    return intersectionCount / unionCount;
  }

  /**
   * Combined Weighted Match Score (0.0 to 1.0)
   */
  public static calculateMatchScore(query: string, target: string): number {
    const normQ = this.normalizeText(query);
    const normT = this.normalizeText(target);

    if (!normQ || !normT) return 0;
    if (normQ === normT) return 1.0;

    // Substring / Prefix match bonus
    let prefixScore = 0;
    if (normT.startsWith(normQ) || normQ.startsWith(normT)) {
      prefixScore = 0.95;
    } else if (normT.includes(normQ) || normQ.includes(normT)) {
      prefixScore = 0.85;
    }

    // Levenshtein Similarity
    const levScore = this.levenshteinSimilarity(normQ, normT);

    // Phonetic Similarity
    const phonQ = this.getPhoneticKey(normQ);
    const phonT = this.getPhoneticKey(normT);
    const phonScore = this.levenshteinSimilarity(phonQ, phonT);

    // Token Set Ratio
    const tokenScore = this.tokenSetRatio(normQ, normT);

    // Weighted Ensemble Calculation
    const ensembleScore = Math.max(
      prefixScore,
      levScore * 0.35 + phonScore * 0.35 + tokenScore * 0.30
    );

    return parseFloat(ensembleScore.toFixed(3));
  }

  /**
   * Find best string match among candidate string list
   */
  public static findBestMatch(query: string, candidates: string[]): { item: string; score: number } | null {
    if (!query || !candidates || candidates.length === 0) return null;
    let bestItem: string | null = null;
    let bestScore = 0;
    for (const cand of candidates) {
      const score = this.calculateMatchScore(query, cand);
      if (score > bestScore) {
        bestScore = score;
        bestItem = cand;
      }
    }
    return bestItem ? { item: bestItem, score: bestScore } : null;
  }

  /**
   * Match user query against Food Item Catalog & Aliases
   */
  public static matchFoodItem(
    query: string,
    catalog: CanonicalItemAlias[] = CANONICAL_FOOD_ALIASES,
    isRestrictedCheck: boolean = false
  ): FuzzyMatchResult<CanonicalItemAlias> {
    const normQuery = this.normalizeText(query);
    if (!normQuery) {
      return { item: null, score: 0, confidence: 'low', topAlternatives: [] };
    }

    const scoredItems: Array<{ item: CanonicalItemAlias; score: number }> = [];

    catalog.forEach(canonical => {
      let maxItemScore = 0;
      // Test against canonical name and all cross-script aliases
      const testCandidates = [
        canonical.canonicalName,
        canonical.nativeNames.en,
        canonical.nativeNames.ta,
        canonical.nativeNames.hi,
        ...canonical.aliases
      ];

      testCandidates.forEach(alias => {
        const score = this.calculateMatchScore(normQuery, alias);
        if (score > maxItemScore) {
          maxItemScore = score;
        }
      });

      scoredItems.push({ item: canonical, score: maxItemScore });
    });

    // Sort candidates by score descending
    scoredItems.sort((a, b) => b.score - a.score);

    const best = scoredItems[0] || { item: null, score: 0 };
    const effectiveHigh = isRestrictedCheck ? FUZZY_CONFIG.restrictedThreshold : FUZZY_CONFIG.highConfidence;
    const effectiveMed = isRestrictedCheck ? FUZZY_CONFIG.restrictedThreshold : FUZZY_CONFIG.mediumConfidence;

    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (best.score >= effectiveHigh) {
      confidence = 'high';
    } else if (best.score >= effectiveMed) {
      confidence = 'medium';
    }

    const topAlternatives = scoredItems
      .filter(s => s.score >= 0.50)
      .slice(0, 3);

    return {
      item: confidence !== 'low' ? best.item : (scoredItems[0]?.score >= 0.60 ? scoredItems[0].item : null),
      score: best.score,
      confidence,
      topAlternatives
    };
  }

  /**
   * Match user query against FoodItem catalog objects (e.g., INDIAN_FOOD_CATALOG)
   */
  public static matchCatalogFoodItem<T extends { id: string; name: string; nativeNames?: { en?: string; ta?: string; hi?: string }; tags?: string[] }>(
    query: string,
    catalog: T[] = [],
    isRestrictedCheck: boolean = false
  ): FuzzyMatchResult<T> {
    const normQuery = this.normalizeText(query);
    if (!normQuery) {
      return { item: null, score: 0, confidence: 'low', topAlternatives: [] };
    }

    const scoredItems: Array<{ item: T; score: number }> = [];

    catalog.forEach(food => {
      let maxItemScore = 0;
      // Gather all candidate names and cross-script aliases
      const candidates = [
        food.name,
        food.nativeNames?.en,
        food.nativeNames?.ta,
        food.nativeNames?.hi,
        ...(food.tags || [])
      ].filter((x): x is string => Boolean(x));

      // Check if canonical aliases exist for this item
      const canonicalMatch = CANONICAL_FOOD_ALIASES.find(
        c => c.id === food.id || c.canonicalName.toLowerCase() === food.name.toLowerCase()
      );
      if (canonicalMatch) {
        candidates.push(...canonicalMatch.aliases);
      }

      candidates.forEach(alias => {
        const score = this.calculateMatchScore(normQuery, alias);
        if (score > maxItemScore) {
          maxItemScore = score;
        }
      });

      scoredItems.push({ item: food, score: maxItemScore });
    });

    scoredItems.sort((a, b) => b.score - a.score);

    const best = scoredItems[0] || { item: null, score: 0 };
    const effectiveHigh = isRestrictedCheck ? FUZZY_CONFIG.restrictedThreshold : FUZZY_CONFIG.highConfidence;
    const effectiveMed = isRestrictedCheck ? FUZZY_CONFIG.restrictedThreshold : FUZZY_CONFIG.mediumConfidence;

    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (best.score >= effectiveHigh) {
      confidence = 'high';
    } else if (best.score >= effectiveMed) {
      confidence = 'medium';
    }

    const topAlternatives = scoredItems
      .filter(s => s.score >= 0.50)
      .slice(0, 3);

    return {
      item: confidence !== 'low' ? best.item : (scoredItems[0]?.score >= 0.60 ? scoredItems[0].item : null),
      score: best.score,
      confidence,
      topAlternatives
    };
  }

  /**
   * Match user query against Restaurant Names
   */
  public static matchRestaurant(
    query: string,
    restaurants = CANONICAL_RESTAURANT_ALIASES
  ): FuzzyMatchResult<{ canonicalName: string }> {
    const normQuery = this.normalizeText(query);
    if (!normQuery) {
      return { item: null, score: 0, confidence: 'low', topAlternatives: [] };
    }

    const scored: Array<{ item: { canonicalName: string }; score: number }> = [];

    restaurants.forEach(r => {
      let maxScore = 0;
      const candidates = [r.canonicalName, ...r.aliases];
      candidates.forEach(alias => {
        const s = this.calculateMatchScore(normQuery, alias);
        if (s > maxScore) maxScore = s;
      });
      scored.push({ item: { canonicalName: r.canonicalName }, score: maxScore });
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0] || { item: null, score: 0 };

    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (best.score >= FUZZY_CONFIG.highConfidence) confidence = 'high';
    else if (best.score >= FUZZY_CONFIG.mediumConfidence) confidence = 'medium';

    return {
      item: confidence !== 'low' ? best.item : null,
      score: best.score,
      confidence,
      topAlternatives: scored.slice(0, 3)
    };
  }

  /**
   * Scan input text to detect restaurant mention using FuzzyMatchEngine
   */
  public static findRestaurantInText(
    text: string,
    restaurants = CANONICAL_RESTAURANT_ALIASES
  ): string | null {
    if (!text || !text.trim()) return null;
    const norm = this.normalizeText(text);

    // Token sliding window scan (up to 4 words) to find explicit restaurant mentions
    const words = norm.split(' ').filter(Boolean);
    for (let len = Math.min(words.length, 4); len >= 1; len--) {
      for (let i = 0; i <= words.length - len; i++) {
        const subphrase = words.slice(i, i + len).join(' ');
        const subMatch = this.matchRestaurant(subphrase, restaurants);
        if (subMatch.item && subMatch.confidence === 'high') {
          return subMatch.item.canonicalName;
        }
      }
    }

    return null;
  }

  /**
   * Fuzzy Time & Schedule Parser with AM/PM Ambiguity Resolution & Past-Time Validation
   */
  public static fuzzyParseTimeAndSchedule(
    text: string,
    language: 'en' | 'ta' | 'hi' = 'en'
  ): FuzzyTimeParseResult {
    const norm = this.normalizeText(text);
    const result: FuzzyTimeParseResult = {
      time: '08:00',
      timeFormatted: '08:00 AM',
      isAmbiguous: false,
      isPastTime: false
    };

    if (!norm) return result;

    // 1. Relative Minutes (e.g., "in 20 minutes", "20 நிமிடத்தில்", "20 मिनट में")
    const relMinMatch = norm.match(/(\d{1,3})\s*(mins?|minutes?|நிமிட|நிமிடம்|मिनट)/i);
    if (relMinMatch) {
      const addedMins = parseInt(relMinMatch[1], 10);
      const now = new Date();
      now.setMinutes(now.getMinutes() + addedMins);
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
      const hours12 = String(now.getHours() % 12 || 12).padStart(2, '0');
      
      return {
        time: `${hh}:${mm}`,
        timeFormatted: `${hours12}:${mm} ${ampm}`,
        isAmbiguous: false,
        isPastTime: false,
        relativeMinutes: addedMins
      };
    }

    // 2. Explicit AM / PM or Time Keywords
    const isMorning = norm.includes('am') || norm.includes('morning') || norm.includes('காலை') || norm.includes('सुबह');
    const isAfternoon = norm.includes('afternoon') || norm.includes('மதியம்') || norm.includes('இரவு') || norm.includes('दोपहर');
    const isEvening = norm.includes('evening') || norm.includes('மாலை') || norm.includes('शाम');
    const isNight = norm.includes('pm') || norm.includes('night') || norm.includes('இரவு') || norm.includes('நைட்') || norm.includes('रात');

    const isExplicitPm = isAfternoon || isEvening || isNight || norm.includes('pm');
    const isExplicitAm = isMorning || norm.includes('am');

    // 3. Time Regex Matching (e.g. 08:30, 8:30, 8, 8 o'clock, 8.30)
    const timeMatch = norm.match(/(\d{1,2})[:.]?(\d{2})?\s*(am|pm|மணி|बजे)?/i);

    if (timeMatch) {
      let hour = parseInt(timeMatch[1], 10);
      const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;

      if (hour >= 1 && hour <= 12) {
        // If hour is 1..12 and NO explicit AM/PM or morning/evening indicator was found
        if (!isExplicitAm && !isExplicitPm && !timeMatch[3]) {
          result.isAmbiguous = true;
          const amHourStr = String(hour % 12).padStart(2, '0');
          const pmHourStr = String((hour % 12) + 12).padStart(2, '0');
          const minStr = String(minute).padStart(2, '0');

          const prompt = language === 'ta'
            ? `நீங்கள் "${hour}:${minStr} AM" (காலை) அல்லது "${hour}:${minStr} PM" (இரவு) என்று கூறினீர்களா?`
            : language === 'hi'
            ? `क्या आपका मतलब "${hour}:${minStr} AM" (सुबह) या "${hour}:${minStr} PM" (रात) था?`
            : `Did you mean ${hour}:${minStr} AM or ${hour}:${minStr} PM?`;

          result.askAmPmPrompt = prompt;

          // Default fallback to morning
          hour = hour === 12 ? 0 : hour;
        } else if (isExplicitPm) {
          hour = hour === 12 ? 12 : hour + 12;
        } else if (isExplicitAm) {
          hour = hour === 12 ? 0 : hour;
        }
      }

      const hhStr = String(hour).padStart(2, '0');
      const mmStr = String(minute).padStart(2, '0');
      result.time = `${hhStr}:${mmStr}`;

      const dispHour = hour % 12 || 12;
      const dispAmPm = hour >= 12 ? 'PM' : 'AM';
      result.timeFormatted = `${String(dispHour).padStart(2, '0')}:${mmStr} ${dispAmPm}`;
    }

    // 4. Past Time Check (If execution time is earlier than current time today)
    const now = new Date();
    const [hVal, mVal] = result.time.split(':').map(Number);
    if (hVal < now.getHours() || (hVal === now.getHours() && mVal <= now.getMinutes())) {
      result.isPastTime = true;
      result.pastTimeNotice = language === 'ta'
        ? `குறிப்பு: ${result.timeFormatted} கடந்த நேரம். ஆர்டர் அடுத்த வேலை நாளில் இயங்கும்.`
        : language === 'hi'
        ? `नोट: ${result.timeFormatted} बीत चुका है। ऑर्डर अगले दिन निष्पादित होगा।`
        : `Notice: ${result.timeFormatted} has already passed for today. Order will run on the next upcoming scheduled date.`;
    }

    return result;
  }
}

export interface FuzzyTimeParseResult {
  time: string; // HH:MM 24-hour format
  timeFormatted: string; // e.g. "08:00 AM"
  isAmbiguous: boolean;
  askAmPmPrompt?: string;
  isPastTime: boolean;
  pastTimeNotice?: string;
  relativeMinutes?: number;
}
