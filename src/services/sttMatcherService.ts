import { Language, FoodItem } from '../types';
import { CrossScriptPhoneticMatcher } from './crossScriptPhoneticMatcher';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { FuzzyMatchEngine } from './fuzzyMatchService';

export type ConfirmationIntent = 'YES' | 'NO' | 'UNKNOWN';
export type ControlCommandIntent = 'YES' | 'NO' | 'NEXT' | 'BACK' | 'CANCEL' | 'ORDER_NOW' | 'SCHEDULE' | 'UNKNOWN';

export interface MatchResult<T = string> {
  isMatched: boolean;
  matchedValue: T | null;
  confidence: number;
  needsClarification: boolean;
  bestCandidate?: T;
  clarificationPrompt?: string;
  matchedTranscript?: string;
}

export interface MultiItemMatchResult {
  items: FoodItem[];
  unmatchedSegments: string[];
  confidence: number;
  needsClarification: boolean;
  clarificationPrompt?: string;
}

// 🚀 CENTRALIZED MULTILINGUAL VOCABULARIES
export const CONFIRMATION_VOCABULARY = {
  YES: {
    en: ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'confirm', 'proceed', 'do it', 'correct', 'right', 'accept', 'allow'],
    ta: ['ஆம்', 'ஆமாம்', 'சரி', 'ஆமா', 'செய்', 'வேண்டும்', 'உறுதி', 'அனுமதி', 'ஓகே', 'கொடு', 'aama', 'aamam', 'sari', 'seri', 'kodu', 'aam'],
    hi: ['हाँ', 'जी हाँ', 'हाँजी', 'ठीक', 'ठीक है', 'करो', 'हाँ करो', 'मंजूर', 'अनुमति', 'haan', 'sahi', 'ji haan']
  },
  NO: {
    en: ['no', 'nope', 'cancel', 'stop', 'deny', 'dont', 'don\'t', 'reject', 'decline', 'never', 'nah'],
    ta: ['இல்லை', 'இல்ல', 'வேண்டாம்', 'வேணாம்', 'ரத்து', 'மறு', 'வேண்டாதீங்க', 'மனா', 'illa', 'illai', 'vendam', 'venam', 'vaendaam'],
    hi: ['नहीं', 'ना', 'मना', 'कैंसल', 'नहीं चाहिए', 'रद्द', 'मना करें', 'nahi', 'naa', 'nahin']
  },
  NEXT: {
    en: ['next', 'forward', 'continue', 'skip'],
    ta: ['அடுத்தது', 'அடுத்து', 'முன்னேறு'],
    hi: ['अगला', 'आगे', 'जारी रखें']
  },
  BACK: {
    en: ['back', 'previous', 'go back'],
    ta: ['பின்னாடி', 'திரும்பு', 'முந்தைய'],
    hi: ['पीछे', 'वापस', 'पिछला']
  },
  CANCEL: {
    en: ['cancel', 'exit', 'close'],
    ta: ['ரத்து', 'மூடு', 'வெளியேறு'],
    hi: ['रद्द', 'बंद', 'बाहर']
  },
  ORDER_NOW: {
    en: ['order now', 'instant', 'order', 'now', 'buy now'],
    ta: ['இப்போதே ஆர்டர் செய்', 'இப்போதே', 'இப்போ', 'உடனடி', 'ஆர்டர் செய்', 'ஆர்டர் பண்ணு'],
    hi: ['अभी ऑर्डर करें', 'अभी', 'तुरंत', 'ऑर्डर करें']
  },
  SCHEDULE: {
    en: ['schedule', 'later', 'schedule for later', 'set time'],
    ta: ['அட்டவணைப்படுத்து', 'அட்டவணை', 'திட்டமிடு', 'பிறகு', 'பின்னர்', 'அப்புறம்'],
    hi: ['शेड्यूल करें', 'शेड्यूल', 'बाद में', 'समय सेट करें']
  }
};

export const DURATION_VOCABULARY = {
  'today_only': ['today alone', 'today only', 'just today', '1 day', 'one day', 'for today', 'இன்று மட்டும்', 'இன்னைக்கு மட்டும்', 'ஒரு நாள்', 'இன்று', 'केवल आज', 'आज ही', 'आज बस', 'एक दिन'],
  '1_week': ['1 week', 'one week', '7 days', 'seven days', '1 வாரம்', 'ஒரு வாரம்', '1 வாரத்திற்கு', 'ஒரு வாரத்திற்கு', '7 நாட்கள்', '1 हफ्ता', 'एक हफ्ता', '7 दिन'],
  '1_month': ['1 month', 'one month', '30 days', 'thirty days', '1 மாதம்', 'ஒரு மாதம்', '1 மாதத்திற்கு', 'ஒரு மாதத்திற்கு', '30 நாட்கள்', '1 महीना', 'एक महीना', '30 दिन'],
  '3_months': ['3 months', 'three months', '90 days', '3 மாதம்', '3 மாதங்கள்', '3 மாதத்திற்கு', '90 நாட்கள்', '3 महीने', 'तीन महीने', '90 दिन'],
  'custom': ['custom date range', 'custom range', 'custom date', 'custom', 'date range', 'சுயவிருப்ப தேதி', 'தேதி வரம்பு', 'குறிப்பிட்ட தேதி', 'கஸ்டம்', 'கஸ்டம் தேதி', 'கஸ்டம் ரேஞ்ச்', 'कस्टम तिथि सीमा', 'कस्टम तारीख', 'कस्टम रेट', 'कस्टम'],
  'indefinite': ['indefinite', 'forever', 'always', 'continuous', 'தொடர்ச்சியாக', 'எப்போதும்', 'வரம்பில்லாமல்', 'हमेशा', 'लगातार']
};

export const EVERY_DAY_VOCABULARY = [
  'every day', 'everyday', 'daily', 'all days', 'every single day',
  'தினமும்', 'ஒவ்வொரு நாளும்', 'எல்லா நாளும்', 'தினசரி', 'தினமுமே',
  'रोजाना', 'हर रोज', 'हर दिन', 'प्रतिदिन', 'रोज'
];

export const WEEKDAY_MAP: { [key: string]: string[] } = {
  'Mon': ['monday', 'mondays', 'mon', 'திங்கள்', 'திங்கட்கிழமை', 'tingal', 'somvar', 'सोमवार'],
  'Tue': ['tuesday', 'tuesdays', 'tue', 'செவ்வாய்', 'செவ்வாய்க்கிழமை', 'sevvai', 'mangalvar', 'मंगलवार'],
  'Wed': ['wednesday', 'wednesdays', 'wed', 'புதன்', 'புதன்கிழமை', 'budhan', 'budhvar', 'बुधवार'],
  'Thu': ['thursday', 'thursdays', 'thu', 'வியாழன்', 'வியாழக்கிழமை', 'vyazhan', 'guruvar', 'गुरुवार'],
  'Fri': ['friday', 'fridays', 'fri', 'வெள்ளி', 'வெள்ளிக்கிழமை', 'velli', 'shukravar', 'शुक्रवार'],
  'Sat': ['saturday', 'saturdays', 'sat', 'சனி', 'சனிக்கிழமை', 'sani', 'shanivar', 'शनिवार'],
  'Sun': ['sunday', 'sundays', 'sun', 'ஞாயிறு', 'ஞாயிற்றுக்கிழமை', 'nyayiru', 'ravivar', 'रविवार']
};

export const LANGUAGE_VOCABULARY = {
  ta: ['tamil', 'தமிழ்', 'tamizh', 'thamil', 'தமிள்', 'ஒன்று', 'ஒன்னு', 'ஒரு', '1'],
  en: ['english', 'இங்கிலீஷ்', 'इंग्लिश', 'inglish', 'ஆங்கிலம்', 'ஆங்கில', 'இரண்டு', 'ரெண்டு', '2'],
  hi: ['hindi', 'हिंदी', 'hindhi', 'हिन्दी', 'இந்தி', 'ஹிந்தி', 'ஹிந்தீ', 'तीन', '3']
};

export class SttMatcherService {
  private static ACCEPT_THRESHOLD = 0.65;
  private static CLARIFY_THRESHOLD = 0.45;

  /**
   * Helper: Normalizes transcription list into clean non-empty string candidates
   */
  private static toCandidateList(input: string | string[]): string[] {
    const list = Array.isArray(input) ? input : [input];
    return list
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .map(s => s.toLowerCase().trim());
  }

  /**
   * 🚀 Phonetic + Fuzzy Distance Matcher Core
   * Returns normalized similarity score [0.0 to 1.0] between STT text and target string
   */
  public static calculateMatchScore(sttText: string, targetStr: string): number {
    if (!sttText || !targetStr) return 0.0;
    const sLower = sttText.toLowerCase().trim();
    const tLower = targetStr.toLowerCase().trim();

    // 1. Direct string equality or substring inclusion (High Priority)
    if (sLower === tLower) return 1.0;
    if (sLower.length >= 3 && tLower.length >= 3) {
      if (sLower.includes(tLower) || tLower.includes(sLower)) {
        const minLen = Math.min(sLower.length, tLower.length);
        const maxLen = Math.max(sLower.length, tLower.length);
        return Math.max(0.85, minLen / maxLen);
      }
    }

    // 2. Phonetic Latin Transliteration Comparison
    const pStt = CrossScriptPhoneticMatcher.toPhoneticLatin(sLower);
    const pTarget = CrossScriptPhoneticMatcher.toPhoneticLatin(tLower);

    if (pStt === pTarget && pStt.length > 0) return 0.98;

    if (pStt.length >= 3 && pTarget.length >= 3) {
      if (pStt.includes(pTarget) || pTarget.includes(pStt)) {
        const minLen = Math.min(pStt.length, pTarget.length);
        const maxLen = Math.max(pStt.length, pTarget.length);
        return Math.max(0.82, minLen / maxLen);
      }
    }

    // 3. Levenshtein Edit Distance Score
    const rawDist = CrossScriptPhoneticMatcher.levenshteinDistance(sLower, tLower);
    const maxRawLen = Math.max(sLower.length, tLower.length);
    const rawScore = maxRawLen > 0 ? Math.max(0, 1 - rawDist / maxRawLen) : 0;

    const phonDist = CrossScriptPhoneticMatcher.levenshteinDistance(pStt, pTarget);
    const maxPhonLen = Math.max(pStt.length, pTarget.length);
    const phonScore = maxPhonLen > 0 ? Math.max(0, 1 - phonDist / maxPhonLen) : 0;

    // Combined Weighted Score (60% Phonetic + 40% Text Edit Distance)
    return (phonScore * 0.6) + (rawScore * 0.4);
  }

  /**
   * 🚀 CENTRALIZED YES / NO CONFIRMATION MATCHER
   * Supports n-best STT hypotheses & multilingual phonetic matching (EN, TA, HI)
   */
  public static matchConfirmation(
    transcripts: string | string[],
    language: Language = 'en'
  ): MatchResult<ConfirmationIntent> {
    const candidates = this.toCandidateList(transcripts);
    if (candidates.length === 0) {
      return { isMatched: false, matchedValue: 'UNKNOWN', confidence: 0, needsClarification: false };
    }

    let bestIntent: ConfirmationIntent = 'UNKNOWN';
    let maxScore = 0;
    let matchedTranscript = '';

    // Collect all expected vocabulary words for YES and NO across languages
    const yesWords = [
      ...CONFIRMATION_VOCABULARY.YES.en,
      ...CONFIRMATION_VOCABULARY.YES.ta,
      ...CONFIRMATION_VOCABULARY.YES.hi
    ];

    const noWords = [
      ...CONFIRMATION_VOCABULARY.NO.en,
      ...CONFIRMATION_VOCABULARY.NO.ta,
      ...CONFIRMATION_VOCABULARY.NO.hi
    ];

    for (const text of candidates) {
      // Check YES vocabulary
      for (const word of yesWords) {
        const score = this.calculateMatchScore(text, word);
        if (score > maxScore) {
          maxScore = score;
          bestIntent = 'YES';
          matchedTranscript = text;
        }
      }

      // Check NO vocabulary
      for (const word of noWords) {
        const score = this.calculateMatchScore(text, word);
        if (score > maxScore) {
          maxScore = score;
          bestIntent = 'NO';
          matchedTranscript = text;
        }
      }
    }

    if (maxScore >= this.ACCEPT_THRESHOLD) {
      return {
        isMatched: true,
        matchedValue: bestIntent,
        confidence: maxScore,
        needsClarification: false,
        matchedTranscript
      };
    }

    if (maxScore >= this.CLARIFY_THRESHOLD && bestIntent !== 'UNKNOWN') {
      const prompt = language === 'ta'
        ? `உங்களின் பதில் "${bestIntent === 'YES' ? 'ஆம்' : 'இல்லை'}" என்பதா?`
        : language === 'hi'
        ? `क्या आपका उत्तर "${bestIntent === 'YES' ? 'हाँ' : 'नहीं'}" है?`
        : `Did you mean "${bestIntent === 'YES' ? 'Yes' : 'No'}"?`;

      return {
        isMatched: false,
        matchedValue: 'UNKNOWN',
        confidence: maxScore,
        needsClarification: true,
        bestCandidate: bestIntent,
        clarificationPrompt: prompt,
        matchedTranscript
      };
    }

    return {
      isMatched: false,
      matchedValue: 'UNKNOWN',
      confidence: maxScore,
      needsClarification: false,
      matchedTranscript
    };
  }

  /**
   * 🚀 MULTI-ITEM CONJUNCTION SPLITTER & CATALOG MATCHER
   * Splits phrases like "idli-um dosa-um", "2 dosa and 1 coffee", "biryani மற்றும் கோக்"
   */
  public static splitMultiItemPhrase(text: string): string[] {
    if (!text) return [];
    let cleaned = text.toLowerCase().trim();

    // Transliterate Tamil suffix '-um' / '-ஆவும்' or conjunctions
    cleaned = cleaned
      .replace(/(\w+)(உம்|மும்|வும்|ஆவும்)/gi, '$1 ')
      .replace(/\s+(மற்றும்|மத்தும்|அப்புறம்|ஆண்டு|and|plus|with|or|और|तथा)\s+/gi, ', ');

    const parts = cleaned.split(/[,;&+]/).map(p => p.trim()).filter(p => p.length > 0);
    return parts.length > 0 ? parts : [text];
  }

  /**
   * Helper: Matches single FoodItem directly returning FoodItem or null
   */
  public static matchFoodItem(
    transcripts: string | string[],
    catalog: FoodItem[] = INDIAN_FOOD_CATALOG,
    language: Language = 'en'
  ): FoodItem | null {
    const res = this.matchCatalogItem(transcripts, catalog, language);
    return res.isMatched ? res.matchedValue : null;
  }

  /**
   * 🚀 CATALOG FOOD ITEM MATCHER
   * Matches single/multiple items with fuzzy + phonetic + n-best hypotheses
   */
  public static matchCatalogItem(
    transcripts: string | string[],
    catalog: FoodItem[] = INDIAN_FOOD_CATALOG,
    language: Language = 'en'
  ): MatchResult<FoodItem> {
    const candidates = this.toCandidateList(transcripts);
    if (candidates.length === 0 || catalog.length === 0) {
      return { isMatched: false, matchedValue: null, confidence: 0, needsClarification: false };
    }

    let bestItem: FoodItem | null = null;
    let maxScore = 0;
    let matchedTranscript = '';
    let bestConfidence: 'high' | 'medium' | 'low' = 'low';

    for (const text of candidates) {
      const res = FuzzyMatchEngine.matchCatalogFoodItem(text, catalog);
      if (res.score > maxScore) {
        maxScore = res.score;
        bestItem = res.item;
        bestConfidence = res.confidence;
        matchedTranscript = text;
      }
    }

    if (bestItem && bestConfidence === 'high') {
      return {
        isMatched: true,
        matchedValue: bestItem,
        confidence: maxScore,
        needsClarification: false,
        matchedTranscript
      };
    }

    if (bestItem && bestConfidence === 'medium') {
      const bestName = bestItem.nativeNames?.[language] || bestItem.name;
      const prompt = language === 'ta'
        ? `நீங்கள் "${bestName}" என்று கூறினீர்களா?`
        : language === 'hi'
        ? `क्या आपका मतलब "${bestName}" था?`
        : `Did you mean "${bestName}"?`;

      return {
        isMatched: false,
        matchedValue: bestItem,
        confidence: maxScore,
        needsClarification: true,
        bestCandidate: bestItem,
        clarificationPrompt: prompt,
        matchedTranscript
      };
    }

    return {
      isMatched: false,
      matchedValue: null,
      confidence: maxScore,
      needsClarification: false,
      matchedTranscript
    };
  }

  /**
   * 🚀 MULTI-ITEM PHRASE MATCHER
   * Processes phrases containing multiple food items
   */
  public static matchMultipleCatalogItems(
    transcripts: string | string[],
    catalog: FoodItem[] = INDIAN_FOOD_CATALOG,
    language: Language = 'en'
  ): MultiItemMatchResult {
    const candidates = this.toCandidateList(transcripts);
    if (candidates.length === 0) {
      return { items: [], unmatchedSegments: [], confidence: 0, needsClarification: false };
    }

    const primaryTranscript = candidates[0];
    const segments = this.splitMultiItemPhrase(primaryTranscript);
    const matchedItems: FoodItem[] = [];
    const unmatchedSegments: string[] = [];
    let totalConfidence = 0;
    let needsClarification = false;
    let clarificationItemName = '';

    for (const seg of segments) {
      const result = this.matchCatalogItem(seg, catalog, language);
      if (result.isMatched && result.matchedValue) {
        if (!matchedItems.some(i => i.id === result.matchedValue!.id)) {
          matchedItems.push(result.matchedValue);
        }
        totalConfidence += result.confidence;
      } else if (result.needsClarification && result.bestCandidate) {
        needsClarification = true;
        clarificationItemName = result.bestCandidate.nativeNames?.[language] || result.bestCandidate.name;
        unmatchedSegments.push(seg);
      } else {
        unmatchedSegments.push(seg);
      }
    }

    const avgConfidence = segments.length > 0 ? totalConfidence / segments.length : 0;
    const prompt = needsClarification && clarificationItemName
      ? (language === 'ta'
          ? `நீங்கள் "${clarificationItemName}" என்று கூறினீர்களா?`
          : language === 'hi'
          ? `क्या आपका मतलब "${clarificationItemName}" था?`
          : `Did you mean "${clarificationItemName}"?`)
      : undefined;

    return {
      items: matchedItems,
      unmatchedSegments,
      confidence: avgConfidence,
      needsClarification,
      clarificationPrompt: prompt
    };
  }

  /**
   * 🚀 LANGUAGE SELECTION MATCHER
   * Matches spoken language choices ("tamil", "ஆங்கிலம்", "hindi", etc.)
   */
  public static matchLanguageChoice(
    transcripts: string | string[]
  ): MatchResult<Language> {
    const candidates = this.toCandidateList(transcripts);
    if (candidates.length === 0) {
      return { isMatched: false, matchedValue: null, confidence: 0, needsClarification: false };
    }

    let bestLang: Language | null = null;
    let maxScore = 0;

    for (const text of candidates) {
      for (const [langKey, words] of Object.entries(LANGUAGE_VOCABULARY)) {
        for (const word of words) {
          const score = this.calculateMatchScore(text, word);
          if (score > maxScore) {
            maxScore = score;
            bestLang = langKey as Language;
          }
        }
      }
    }

    if (bestLang && maxScore >= 0.55) {
      return {
        isMatched: true,
        matchedValue: bestLang,
        confidence: maxScore,
        needsClarification: false
      };
    }

    return { isMatched: false, matchedValue: null, confidence: maxScore, needsClarification: false };
  }

  /**
   * 🚀 GENERIC VOCABULARY MATCHER
   * Matches STT input against any given array of expected candidate strings
   */
  public static matchVocabulary<T extends string>(
    transcripts: string | string[],
    expectedVocab: T[],
    language: Language = 'en'
  ): MatchResult<T> {
    const candidates = this.toCandidateList(transcripts);
    if (candidates.length === 0 || expectedVocab.length === 0) {
      return { isMatched: false, matchedValue: null, confidence: 0, needsClarification: false };
    }

    let bestWord: T | null = null;
    let maxScore = 0;
    let matchedTranscript = '';

    for (const text of candidates) {
      for (const target of expectedVocab) {
        const score = this.calculateMatchScore(text, target);
        if (score > maxScore) {
          maxScore = score;
          bestWord = target;
          matchedTranscript = text;
        }
      }
    }

    if (bestWord && maxScore >= this.ACCEPT_THRESHOLD) {
      return {
        isMatched: true,
        matchedValue: bestWord,
        confidence: maxScore,
        needsClarification: false,
        matchedTranscript
      };
    }

    if (bestWord && maxScore >= this.CLARIFY_THRESHOLD) {
      const prompt = language === 'ta'
        ? `நீங்கள் "${bestWord}" என்று கூறினீர்களா?`
        : language === 'hi'
        ? `क्या आपका मतलब "${bestWord}" था?`
        : `Did you mean "${bestWord}"?`;

      return {
        isMatched: false,
        matchedValue: null,
        confidence: maxScore,
        needsClarification: true,
        bestCandidate: bestWord,
        clarificationPrompt: prompt,
        matchedTranscript
      };
    }

    return {
      isMatched: false,
      matchedValue: null,
      confidence: maxScore,
      needsClarification: false,
      matchedTranscript
    };
  }

  /**
   * 🚀 RECURRENCE DURATION CHOICE MATCHER
   * Matches spoken durations ("1 week", "1 month", "3 months", "10 days", "2 weeks", "45 days")
   */
  public static matchDurationChoice(
    transcripts: string | string[],
    language: Language = 'en'
  ): MatchResult<string> & { customDays?: number } {
    const candidates = this.toCandidateList(transcripts);
    if (candidates.length === 0) {
      return { isMatched: false, matchedValue: null, confidence: 0, needsClarification: false };
    }

    // 1. Check dynamic custom number of days/weeks (e.g., "10 days", "2 weeks", "45 days", "10 நாட்கள்", "2 हफ़्ते")
    for (const text of candidates) {
      const raw = text.toLowerCase().trim();
      const numMatch = raw.match(/(\d+)\s*(days|day|weeks|week|months|month|நாட்கள்|நாள்|வாரம்|வாரங்கள்|தினங்கள்|दिन|हफ्ते|हफ़्ते|महीने)/i);
      const wordNumMap: Record<string, number> = {
        'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'ten': 10, 'fifteen': 15, 'twenty': 20, 'thirty': 30, 'forty five': 45,
        'ஒன்று': 1, 'ஒன்னு': 1, 'இரண்டு': 2, 'ரெண்டு': 2, 'பத்து': 10, 'பதினைந்து': 15, 'இருபது': 20, 'முப்பது': 30,
        'एक': 1, 'दो': 2, 'तीन': 3, 'दस': 10, 'पंद्रह': 15, 'बीस': 20, 'तीस': 30, 'पैंतालीस': 45
      };

      let extractedNum: number | null = null;
      if (numMatch) {
        extractedNum = parseInt(numMatch[1], 10);
      } else {
        for (const [w, n] of Object.entries(wordNumMap)) {
          if (raw.includes(w)) {
            extractedNum = n;
            break;
          }
        }
      }

      if (extractedNum && extractedNum > 0) {
        const isWeek = /week|weeks|வாரம்|வாரங்கள்|vaaram|vaarangal|हफ्ता|हफ़्ते|हफ्ते|सप्ताह/i.test(raw);
        const isMonth = /month|months|மாதம்|மாதங்கள்|maatham|महीना|महीने/i.test(raw);
        const isDay = /day|days|நாட்கள்|நாள்|naatkal|naal|दिन/i.test(raw);

        let totalDays = extractedNum;
        if (isWeek) totalDays = extractedNum * 7;
        if (isMonth) totalDays = extractedNum * 30;

        if (isWeek || isMonth || isDay) {
          console.log(`[Custom Duration Parser Success]: "${raw}" -> ${totalDays} total days`);
          return {
            isMatched: true,
            matchedValue: 'custom',
            confidence: 0.95,
            needsClarification: false,
            matchedTranscript: text,
            customDays: totalDays
          };
        }
      }
    }

    let bestDuration: string | null = null;
    let maxScore = 0;
    let matchedTranscript = '';

    for (const text of candidates) {
      for (const [durKey, words] of Object.entries(DURATION_VOCABULARY)) {
        for (const word of words) {
          const score = this.calculateMatchScore(text, word);
          if (score > maxScore) {
            maxScore = score;
            bestDuration = durKey;
            matchedTranscript = text;
          }
        }
      }
    }

    if (bestDuration && maxScore >= 0.55) {
      return {
        isMatched: true,
        matchedValue: bestDuration,
        confidence: maxScore,
        needsClarification: false,
        matchedTranscript
      };
    }

    if (bestDuration && maxScore >= 0.40) {
      const durLabel = bestDuration === 'today_only' ? 'Today alone' : bestDuration === '1_week' ? '1 Week' : bestDuration === '1_month' ? '1 Month' : bestDuration === '3_months' ? '3 Months' : 'Indefinite';
      const prompt = language === 'ta'
        ? `நீங்கள் "${durLabel}" என்று கூறினீர்களா?`
        : language === 'hi'
        ? `क्या आपका मतलब "${durLabel}" था?`
        : `Did you mean "${durLabel}"?`;

      return {
        isMatched: false,
        matchedValue: null,
        confidence: maxScore,
        needsClarification: true,
        bestCandidate: bestDuration,
        clarificationPrompt: prompt,
        matchedTranscript
      };
    }

    return { isMatched: false, matchedValue: null, confidence: maxScore, needsClarification: false };
  }

  /**
   * 🚀 EVERY DAY vs SPECIFIC DAYS MATCHER
   * Returns { isEveryDay: boolean, selectedDays: string[] }
   */
  public static matchDaysChoice(
    transcripts: string | string[],
    language: Language = 'en'
  ): { isEveryDay: boolean; selectedDays: string[]; isMatched: boolean; confidence: number } {
    const candidates = this.toCandidateList(transcripts);
    if (candidates.length === 0) {
      return { isEveryDay: true, selectedDays: [], isMatched: false, confidence: 0 };
    }

    // 1. Check if user spoke "every day" / "daily" / "தினமும்"
    for (const text of candidates) {
      for (const word of EVERY_DAY_VOCABULARY) {
        const score = this.calculateMatchScore(text, word);
        if (score >= 0.55 || text.includes(word)) {
          return { isEveryDay: true, selectedDays: [], isMatched: true, confidence: Math.max(score, 0.85) };
        }
      }
    }

    // 2. Scan candidates for specific weekday mentions (e.g. "Mondays and Fridays")
    const foundDaysSet = new Set<string>();
    let maxDayScore = 0;

    for (const text of candidates) {
      for (const [dayKey, dayWords] of Object.entries(WEEKDAY_MAP)) {
        for (const word of dayWords) {
          if (text.includes(word) || this.calculateMatchScore(text, word) >= 0.65) {
            foundDaysSet.add(dayKey);
            maxDayScore = 0.85;
          }
        }
      }
    }

    const selectedDays = Array.from(foundDaysSet);
    if (selectedDays.length > 0) {
      return { isEveryDay: false, selectedDays, isMatched: true, confidence: maxDayScore };
    }

    return { isEveryDay: true, selectedDays: [], isMatched: false, confidence: 0 };
  }

  /**
   * 🚀 MULTILINGUAL SPOKEN DATE PARSER (EN, TA, HI)
   * Resolves relative date expressions ("tomorrow", "நாளை", "कल", "next monday") to YYYY-MM-DD format.
   */
  public static parseSpokenDate(text: string): string | null {
    if (!text) return null;
    const raw = text.toLowerCase().replace(/[\.,!\?]/g, ' ').trim();
    const now = new Date();

    // 1. Direct YYYY-MM-DD
    const isoMatch = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (isoMatch) return isoMatch[0];

    // 2. Relative Words
    if (
      raw.includes('today') ||
      raw.includes('இன்று') ||
      raw.includes('இன்னைக்கு') ||
      raw.includes('आज')
    ) {
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    if (
      raw.includes('tomorrow') ||
      raw.includes('நாளை') ||
      raw.includes('நாளைக்கு') ||
      raw.includes('कल')
    ) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    }

    if (
      raw.includes('day after tomorrow') ||
      raw.includes('நாளை மறுநாள்') ||
      raw.includes('परसों')
    ) {
      const dayAfter = new Date(now);
      dayAfter.setDate(dayAfter.getDate() + 2);
      return `${dayAfter.getFullYear()}-${String(dayAfter.getMonth() + 1).padStart(2, '0')}-${String(dayAfter.getDate()).padStart(2, '0')}`;
    }

    // 3. Weekdays (e.g. "next Monday", "வெள்ளிக்கிழமை", "शुक्रवार")
    const dayNamesObj: { [key: number]: string[] } = {
      1: ['monday', 'mon', 'திங்கள்', 'திங்கட்கிழமை', 'somvar', 'सोमवार'],
      2: ['tuesday', 'tue', 'செவ்வாய்', 'செவ்வாய்க்கிழமை', 'mangalvar', 'मंगलवार'],
      3: ['wednesday', 'wed', 'புதன்', 'புதன்கிழமை', 'budhvar', 'बुधवार'],
      4: ['thursday', 'thu', 'வியாழன்', 'வியாழக்கிழமை', 'guruvar', 'गुरुवार'],
      5: ['friday', 'fri', 'வெள்ளி', 'வெள்ளிக்கிழமை', 'shukravar', 'शुक्रवार'],
      6: ['saturday', 'sat', 'சனி', 'சனிக்கிழமை', 'shanivar', 'शनिवार'],
      0: ['sunday', 'sun', 'ஞாயிறு', 'ஞாயிற்றுக்கிழமை', 'ravivar', 'रविवार']
    };

    for (const [dayNumStr, words] of Object.entries(dayNamesObj)) {
      const targetDayNum = parseInt(dayNumStr, 10);
      if (words.some(w => raw.includes(w))) {
        const targetDate = new Date(now);
        let diff = targetDayNum - now.getDay();
        if (diff <= 0) diff += 7; // Next upcoming occurrence
        targetDate.setDate(targetDate.getDate() + diff);
        return `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
      }
    }

    return null;
  }
}

