import { Language, FoodItem } from '../types';
import { CrossScriptPhoneticMatcher } from './crossScriptPhoneticMatcher';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { resolveRestrictedFoodInterception } from './restrictedFoodMatcher';
import { FuzzyMatchEngine } from './fuzzyMatchService';
import { FUZZY_CONFIG, CANONICAL_FOOD_ALIASES } from '../config/fuzzyConfig';
import { UserAliasService } from './userAliasService';

export type ConfirmationIntent = 'YES' | 'NO' | 'UNKNOWN';
export type ControlCommandIntent = 'YES' | 'NO' | 'NEXT' | 'BACK' | 'CANCEL' | 'STOP' | 'REPEAT' | 'ORDER_NOW' | 'SCHEDULE' | 'UNKNOWN';

export interface MatchResult<T = string> {
  isMatched: boolean;
  matchedValue: T | null;
  confidence: number;
  needsClarification: boolean;
  bestCandidate?: T;
  top3Candidates?: T[];
  clarificationPrompt?: string;
  matchedTranscript?: string;
  quantity?: number;
  isGenericCategory?: boolean;
}

export interface MultiItemMatchResult {
  items: Array<{ foodItem: FoodItem; quantity: number }>;
  unmatchedSegments: string[];
  confidence: number;
  needsClarification: boolean;
  clarificationPrompt?: string;
  top3Candidates?: FoodItem[];
}


export const RESTAURANT_TRANSLITERATIONS: Record<string, string[]> = {
  'Murugan Idli Shop': ['murugan', 'murugan idli', 'murugan idli shop', 'முருகன்', 'முருகன் இட்லி', 'முருகன் இட்லி ஷாப்', 'मुरुगन', 'मुरुगन इडली', 'मुरुगन इडली शॉप'],
  'Saravana Bhavan': ['saravana bhavan', 'saravana', 'சரவண பவன்', 'சரவணா', 'சரவண', 'सरवण भवन', 'सरवना भवन', 'सरवना', 'होटल सरवण भवन'],
  'A2B Adyar Ananda Bhavan': ['a2b', 'adyar ananda bhavan', 'ananda bhavan', 'அடையார் ஆனந்த பவன்', 'ஆனந்த பவன்', 'ஏ2பி', 'ஏ 2 பி', 'அடையார்', 'अड्यार आनंद भवन', 'आनंद भवन', 'ए2बी'],
  'Sangeetha Veg Restaurant': ['sangeetha', 'sangeetha veg', 'sangeetha restaurant', 'சங்கீதா', 'சங்கீதா உணவகம்', 'संगीता', 'संगीता वेज'],
  'Madurai Mess': ['madurai mess', 'madurai', 'மதுரை மெஸ்', 'மதுரை', 'मदुरै मेस', 'मदुरै'],
  'Bawarchi Biryani': ['bawarchi', 'bawarchi biryani', 'பவார்ச்சி', 'बावर्ची', 'बावर्ची बिरयानी'],
  'Star Ambur Biryani': ['star ambur', 'ambur biryani', 'star biryani', 'ambur', 'ஆம்பூர் பிரியாணி', 'ஸ்டார் ஆம்பூர்', 'ஆம்பூர்', 'अंबुर बिरयानी', 'स्टार अंबुर', 'अंबुर'],
  'Coconut Lagoon Kerala Restaurant': ['coconut lagoon', 'lagoon', 'kerala restaurant', 'கோகனட் லகூன்', 'कोकोनट लगून'],
  'Pind Balluchi': ['pind balluchi', 'balluchi', 'पिंड बल्लूची'],
  'Haldirams': ['haldirams', 'haldiram', 'ஹல்திராம்ஸ்', 'ஹல்திராம்', 'हल्दीराम', 'हल्दीराम्स'],
  'Kake Da Hotel': ['kake da hotel', 'kake da', 'काके दा होटल', 'काके दा'],
  'Rajdhani Thali Restaurant': ['rajdhani', 'rajdhani thali', 'ராஜ்தானி', 'राजधानी'],
  'Sardar Pav Bhaji': ['sardar', 'sardar pav bhaji', 'சர்தார் பாவ் பாஜி', 'सरदार पाव भाजी'],
  'Dominos Pizza': ['dominos', 'domino\'s', 'dominos pizza', 'டோமினோஸ்', 'डोमिनोज़'],
  'Mainland China': ['mainland china', 'mainland', 'மெயின்லேண்ட் சீனா', 'சீனா', 'मेनलैंड चाइना'],
  'Kumbakonam Degree Coffee': ['kumbakonam', 'degree coffee', 'கும்பகோணம்', 'कुंभकोणम']
};

export const CONFIRMATION_VOCABULARY: any = {
  YES: {
    en: ['yes', 'yeah', 'yep', 'ok', 'okay', 'sure', 'proceed', 'confirm', 'correct', 'do it', 'right', 'absolutely', 'go ahead'],
    ta: ['ஆமா', 'ஆம்', 'சரி', 'ஓகே', 'ஆமாம்', 'உறுதி', 'செய்', 'aama', 'aamam', 'sari', 'seri', 'okay', 'ok', 'uruthi', 'sey'],
    hi: ['haan', 'ha', 'haanji', 'theek hai', 'sahi', 'kar do', 'proceed', 'हाँ', 'जी हाँ', 'हाँजी', 'ठीक', 'ठीक है', 'करो', 'हाँ करो', 'ji haan', 'thik hai']
  },
  NO: {
    en: ['no', 'nope', 'cancel', 'stop', 'wrong', 'deny', 'dont', "don't", 'reject', 'decline', 'never', 'nah', 'not at all'],
    ta: ['இல்லை', 'வேண்டாம்', 'ரத்து', 'நிறுத்து', 'இல்ல', 'வேணாம்', 'மறு', 'வேண்டாதீங்க', 'மனா', 'illa', 'illai', 'vendam', 'venam', 'vaendaam', 'vendaam', 'rathu', 'niruthu', 'நிறுத்துங்கள்'],
    hi: ['nahi', 'nahin', 'mat', 'cancel', 'band karo', 'galat', 'नहीं', 'ना', 'मना', 'कैंसल', 'नहीं चाहिए', 'रद्द', 'मना करें', 'रुक', 'ruko', 'रोकें', 'गलत', 'बंद करो', 'naa']
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
    hi: ['ரத்து', 'बंद', 'बाहर']
  },
  STOP: {
    en: ['stop', 'pause'],
    ta: ['நிறுத்து', 'போதும்', 'நிறுத்துங்கள்', 'niruthu', 'pothum'],
    hi: ['रुको', 'बंद करो', 'रोकें', 'ruko', 'bas']
  },
  REPEAT: {
    en: ['repeat', 'say again', 'repeat that'],
    ta: ['மீண்டும் சொல்லுங்கள்', 'மறுபடியும்', 'மீண்டும்', 'meendum', 'marupadiyum'],
    hi: ['दोहराएं', 'फिर से बोलें', 'फिर से', 'dobara', 'phir se']
  },
  ORDER_NOW: {
    en: ['order now', 'instant', 'buy now'],
    ta: ['இப்போதே ஆர்டர் செய்', 'இப்போதே ஆர்டர் செய்யுங்கள்', 'உடனடி', 'இப்போ ஆர்டர் செய்', 'இப்போ ஆர்டர் பண்ணு', 'ஆர்டர் இப்போதே செய்', 'உடனடியாக ஆர்டர் செய்'],
    hi: ['अभी ऑर्डर करें', 'अभी ऑर्डर करिए', 'अभी खाना ऑर्डर करें', 'तुरंत ऑर्डर करें', 'तुरंत खाना मंगाओ', 'तुरंत']
  },
  SCHEDULE: {
    en: ['schedule', 'schedule for later', 'schedule this for tomorrow', 'set time', 'set a time'],
    ta: ['அட்டவணைப்படுத்து', 'அட்டவணை', 'திட்டமிடு', 'பிறகு அட்டவணைப்படுத்து', 'பின்னர் திட்டமிடு', 'நாளைக்கு அட்டவணைப்படுத்து'],
    hi: ['शेड्यूल करें', 'शेड्यूल', 'बाद के लिए शेड्यूल करें', 'कल के लिए शेड्यूल करें', 'समय सेट करें', 'बाद में']
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
  ta: ['tamil', 'தமிழ்', 'tamizh', 'thamil', 'தமிள்', 'तमिल'],
  en: ['english', 'inglish', 'ஆங்கிலம்', 'ஆங்கில', 'இங்கிலீஷ்', 'इंग्लिश', 'अंग्रेज़ी', 'अंग्रेजी'],
  hi: ['hindi', 'हिंदी', 'hindhi', 'हिन्दी', 'இந்தி', 'ஹிந்தி', 'ஹிந்தீ']
};

const FILLER_WORDS = [
  'i want', 'order', 'please', 'give me', 'bring me', 'add', 'get me',
  'venum', 'vaenum', 'podu', 'kudu', 'kodu', 'panno', 'kudungga', 'vaanggu',
  'chahiye', 'karo', 'laya', 'do', 'dedo', 'mujhe', 'enaku', 'enakku', 'order karo'
];

const GENERIC_CATEGORY_KEYWORDS: { [key: string]: string[] } = {
  'idli': ['idli', 'idly', 'iddli', 'italy', 'eatly', 'itli', 'edli', 'இட்லி', 'இட்டலி', 'इडली'],
  'dosa': ['dosa', 'dosai', 'dhosai', 'dosha', 'doser', 'தோசை', 'डोसा'],
  'biryani': ['biryani', 'biriyani', 'briyani', 'beer yani', 'berryani', 'பிரியாணி', 'बिरयानी'],
  'parotta': ['parotta', 'parota', 'barota', 'பரோட்டா', 'परोटा']
};

export class SttMatcherService {
  private static toCandidateList(input: string | string[]): string[] {
    const list = Array.isArray(input) ? input : [input];
    return list
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .map(s => s.toLowerCase().trim());
  }

  public static extractQuantityAndCleanPhrase(text: string): { quantity: number; cleanPhrase: string } {
    let clean = (text || '').toLowerCase().trim();
    let quantity = 1;

    const numMatch = clean.match(/\b(\d+)\b/);
    if (numMatch) {
      const parsed = parseInt(numMatch[1], 10);
      if (parsed > 0 && parsed <= 99) {
        quantity = parsed;
        clean = clean.replace(/\b\d+\b/g, '').trim();
      }
    } else {
      const wordNumbers: Array<{ value: number; words: string[] }> = [
        { value: 1, words: ['one', 'ek', 'ஒரு', 'ஒன்று', 'ஒன்னு', 'ஒண்ணு', 'एक'] },
        { value: 2, words: ['two', 'rendu', 'இரண்டு', 'ரெண்டு', 'दो'] },
        { value: 3, words: ['three', 'moonu', 'மூன்று', 'மூணு', 'तीन'] },
        { value: 4, words: ['four', 'naangu', 'நான்கு', 'நாலு', 'चार'] },
        { value: 5, words: ['five', 'ainthu', 'ஐந்து', 'அஞ்சு', 'पांच', 'पाँच'] },
        { value: 6, words: ['six', 'aaru', 'ஆறு', 'छह', 'छः'] },
        { value: 7, words: ['seven', 'ezhu', 'ஏழு', 'सात'] },
        { value: 8, words: ['eight', 'ettu', 'எட்டு', 'आठ'] },
        { value: 9, words: ['nine', 'onpathu', 'ஒன்பது', 'नौ'] },
        { value: 10, words: ['ten', 'pathu', 'பத்து', 'दस'] }
      ];
      const paddedText = ` ${clean} `;
      const match = wordNumbers.find(({ words }) => words.some(word => paddedText.includes(` ${word} `)));
      if (match) {
        quantity = match.value;
        for (const word of match.words) {
          clean = ` ${clean} `.replace(` ${word} `, ' ').trim();
        }
      }
    }

    for (const filler of FILLER_WORDS) {
      const reg = new RegExp(`\\b${filler}\\b`, 'gi');
      clean = clean.replace(reg, '').trim();
    }

    clean = clean.replace(/\s+/g, ' ').trim();
    return { quantity, cleanPhrase: clean || text };
  }

  public static matchFoodItem(
    transcripts: string | string[],
    catalog: FoodItem[] = INDIAN_FOOD_CATALOG,
    language: Language = 'en'
  ): FoodItem | null {
    const res = this.matchCatalogItem(transcripts, catalog, language);
    return res.isMatched ? res.matchedValue : (res.needsClarification ? res.bestCandidate || null : null);
  }

  public static matchConfirmation(
    transcripts: string | string[],
    language: Language = 'en'
  ): MatchResult<ConfirmationIntent> {
    const candidates = this.toCandidateList(transcripts);
    if (candidates.length === 0) {
      return { isMatched: false, matchedValue: 'UNKNOWN', confidence: 0, needsClarification: false };
    }

    let maxScore = 0;
    let matchedTranscript = '';

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

    const votes: Record<'YES' | 'NO', number> = { YES: 0, NO: 0 };
    const normalize = (value: string) => value.toLowerCase().replace(/[,.!?;:()"'~`-]+/g, ' ').replace(/\s+/g, ' ').trim();
    const matchesPhrase = (text: string, phrase: string) =>
      ` ${normalize(text)} `.includes(` ${normalize(phrase)} `);

    for (const text of candidates) {
      const clean = normalize(text);
      if (!clean) continue;

      // Check NO intent BEFORE YES intent so "no, cancel" or "no proceed" is never read as yes
      const noExact = noWords.some(word => matchesPhrase(text, word));
      const yesExact = yesWords.some(word => matchesPhrase(text, word));

      if (noExact) {
        votes.NO++;
        maxScore = 1;
        matchedTranscript = text;
        continue;
      }

      const negatedAffirmative = /\b(?:not sure|not certain|not ready|not okay|unsure|not now)\b/i.test(text);
      if (yesExact && !negatedAffirmative) {
        votes.YES++;
        maxScore = 1;
        matchedTranscript = text;
        continue;
      } else if (yesExact && negatedAffirmative) {
        votes.NO++;
        maxScore = 1;
        matchedTranscript = text;
        continue;
      }

      // Fuzzy matching: Check NO before YES
      let candidateIntent: 'YES' | 'NO' | null = null;
      let candidateScore = 0;
      for (const [intent, words] of [['NO', noWords], ['YES', yesWords]] as const) {
        for (const word of words) {
          const score = FuzzyMatchEngine.calculateMatchScore(text, word);
          if (score > candidateScore) {
            candidateScore = score;
            candidateIntent = intent;
          }
        }
      }
      if (candidateIntent && candidateScore >= FUZZY_CONFIG.highConfidence && clean.split(' ').length === 1) {
        votes[candidateIntent]++;
        maxScore = Math.max(maxScore, candidateScore);
        matchedTranscript = text;
      }
    }

    const bestIntent: ConfirmationIntent = votes.YES === votes.NO
      ? 'UNKNOWN'
      : votes.YES > votes.NO ? 'YES' : 'NO';

    if (bestIntent === 'UNKNOWN') {
      return { isMatched: false, matchedValue: 'UNKNOWN', confidence: maxScore, needsClarification: false, matchedTranscript };
    }

    if (maxScore >= FUZZY_CONFIG.highConfidence) {
      return {
        isMatched: true,
        matchedValue: bestIntent,
        confidence: maxScore,
        needsClarification: false,
        matchedTranscript
      };
    }

    if (maxScore >= FUZZY_CONFIG.mediumConfidence) {
      const prompt = language === 'ta'
        ? `உங்களின் பதில் "${bestIntent === 'YES' ? 'ஆம்' : 'இல்லை'}" என்பதா?`
        : language === 'hi'
        ? `क्या आपका मतलब "${bestIntent === 'YES' ? 'हाँ' : 'नहीं'}" था?`
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

  public static matchOrderType(transcripts: string | string[]): MatchResult<'ORDER_NOW' | 'SCHEDULE'> {
    const candidates = this.toCandidateList(transcripts);
    const votes: Record<'ORDER_NOW' | 'SCHEDULE', number> = { ORDER_NOW: 0, SCHEDULE: 0 };
    const normalize = (value: string) => value.toLowerCase().replace(/[.,!?;:]+/g, ' ').replace(/\s+/g, ' ').trim();
    const matchesPhrase = (text: string, phrase: string) =>
      ` ${normalize(text)} `.includes(` ${normalize(phrase)} `);

    for (const candidate of candidates) {
      const orderNow = (Object.values(CONFIRMATION_VOCABULARY.ORDER_NOW).flat() as string[])
        .some(phrase => matchesPhrase(candidate, phrase));
      const schedule = (Object.values(CONFIRMATION_VOCABULARY.SCHEDULE).flat() as string[])
        .some(phrase => matchesPhrase(candidate, phrase));
      if (orderNow !== schedule) votes[orderNow ? 'ORDER_NOW' : 'SCHEDULE']++;
    }

    if (votes.ORDER_NOW === votes.SCHEDULE || votes.ORDER_NOW + votes.SCHEDULE === 0) {
      return { isMatched: false, matchedValue: null, confidence: 0, needsClarification: false };
    }
    const matchedValue = votes.ORDER_NOW > votes.SCHEDULE ? 'ORDER_NOW' : 'SCHEDULE';
    return {
      isMatched: true,
      matchedValue,
      confidence: Math.max(votes.ORDER_NOW, votes.SCHEDULE) / (votes.ORDER_NOW + votes.SCHEDULE),
      needsClarification: false
    };
  }

  public static matchControlCommand(transcripts: string | string[]): MatchResult<'STOP' | 'REPEAT' | 'BACK' | 'CANCEL'> {
    const candidates = this.toCandidateList(transcripts);
    const entries: Array<['STOP' | 'REPEAT' | 'BACK' | 'CANCEL', string[]]> = [
      ['STOP', [...CONFIRMATION_VOCABULARY.STOP.en, ...CONFIRMATION_VOCABULARY.STOP.ta, ...CONFIRMATION_VOCABULARY.STOP.hi]],
      ['REPEAT', [...CONFIRMATION_VOCABULARY.REPEAT.en, ...CONFIRMATION_VOCABULARY.REPEAT.ta, ...CONFIRMATION_VOCABULARY.REPEAT.hi]],
      ['BACK', [...CONFIRMATION_VOCABULARY.BACK.en, ...CONFIRMATION_VOCABULARY.BACK.ta, ...CONFIRMATION_VOCABULARY.BACK.hi]],
      ['CANCEL', [...CONFIRMATION_VOCABULARY.CANCEL.en, ...CONFIRMATION_VOCABULARY.CANCEL.ta, ...CONFIRMATION_VOCABULARY.CANCEL.hi]]
    ];
    const votes = new Map<string, number>();
    const normalize = (value: string) => value.toLowerCase().replace(/[.,!?;:]+/g, ' ').replace(/\s+/g, ' ').trim();
    for (const candidate of candidates) {
      const normalized = ` ${normalize(candidate)} `;
      const found = entries.filter(([, words]) => words.some(word => normalized.includes(` ${normalize(word)} `)));
      if (found.length === 1) votes.set(found[0][0], (votes.get(found[0][0]) || 0) + 1);
    }
    const sorted = [...votes.entries()].sort((a, b) => b[1] - a[1]);
    if (!sorted.length || (sorted[1] && sorted[0][1] === sorted[1][1])) {
      return { isMatched: false, matchedValue: null, confidence: 0, needsClarification: false };
    }
    return {
      isMatched: true,
      matchedValue: sorted[0][0] as 'STOP' | 'REPEAT' | 'BACK' | 'CANCEL',
      confidence: 1,
      needsClarification: false
    };
  }

  public static matchVocabulary<T extends string>(
    transcripts: string | string[],
    vocabList: T[],
    language: Language = 'en'
  ): MatchResult<T> {
    const candidates = this.toCandidateList(transcripts);
    let bestVal: T | null = null;
    let maxScore = 0;

    for (const text of candidates) {
      for (const target of vocabList) {
        const score = FuzzyMatchEngine.calculateMatchScore(text, target);
        if (score > maxScore) {
          maxScore = score;
          bestVal = target;
        }
      }
    }

    if (maxScore >= 0.50 && bestVal) {
      return { isMatched: true, matchedValue: bestVal, confidence: maxScore, needsClarification: false };
    }
    return { isMatched: false, matchedValue: null, confidence: maxScore, needsClarification: false };
  }

  public static matchLanguageChoice(transcripts: string | string[]): MatchResult<Language> {
    const candidates = this.toCandidateList(transcripts);
    let matched: Language | null = null;
    let maxScore = 0;

    for (const text of candidates) {
      for (const w of LANGUAGE_VOCABULARY.ta) {
        const score = FuzzyMatchEngine.calculateMatchScore(text, w);
        if (score > maxScore) { maxScore = score; matched = 'ta'; }
      }
      for (const w of LANGUAGE_VOCABULARY.en) {
        const score = FuzzyMatchEngine.calculateMatchScore(text, w);
        if (score > maxScore) { maxScore = score; matched = 'en'; }
      }
      for (const w of LANGUAGE_VOCABULARY.hi) {
        const score = FuzzyMatchEngine.calculateMatchScore(text, w);
        if (score > maxScore) { maxScore = score; matched = 'hi'; }
      }
    }

    const confidence = maxScore;
    const isMatched = maxScore >= FUZZY_CONFIG.mediumConfidence && !!matched;
    const needsClarification = maxScore >= FUZZY_CONFIG.mediumConfidence && maxScore < FUZZY_CONFIG.highConfidence;

    return {
      isMatched,
      matchedValue: matched,
      confidence,
      needsClarification
    };
  }

  public static matchDaysChoice(
    transcripts: string | string[],
    language: Language = 'en'
  ): { isEveryDay: boolean; selectedDays: string[]; isMatched?: boolean; matchedValue?: any } {
    const candidates = this.toCandidateList(transcripts);
    let isEveryDay = false;
    const selectedDays: string[] = [];

    for (const text of candidates) {
      for (const ev of EVERY_DAY_VOCABULARY) {
        if (FuzzyMatchEngine.calculateMatchScore(text, ev) >= 0.65) {
          isEveryDay = true;
          return {
            isEveryDay: true,
            selectedDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            isMatched: true,
            matchedValue: { isEveryDay: true, selectedDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }
          };
        }
      }
      for (const [dayKey, words] of Object.entries(WEEKDAY_MAP)) {
        for (const w of words) {
          if (FuzzyMatchEngine.calculateMatchScore(text, w) >= 0.65) {
            if (!selectedDays.includes(dayKey)) selectedDays.push(dayKey);
          }
        }
      }
    }

    return {
      isEveryDay,
      selectedDays,
      isMatched: selectedDays.length > 0,
      matchedValue: { isEveryDay, selectedDays }
    };
  }

  public static matchDurationChoice(
    transcripts: string | string[],
    language: Language = 'en'
  ): MatchResult<string> & string {
    const candidates = this.toCandidateList(transcripts);
    let matchedDur: string | null = null;
    let maxScore = 0;

    for (const text of candidates) {
      for (const [durKey, words] of Object.entries(DURATION_VOCABULARY)) {
        for (const w of words) {
          const score = FuzzyMatchEngine.calculateMatchScore(text, w);
          if (score >= 0.60 && score > maxScore) {
            maxScore = score;
            matchedDur = durKey;
          }
        }
      }
    }

    const res: any = matchedDur || '1_week';
    res.isMatched = !!matchedDur;
    res.matchedValue = matchedDur;
    res.confidence = maxScore;
    res.needsClarification = false;
    return res;
  }

  public static parseSpokenDate(transcripts: string | string[]): string | null {
    return null;
  }

  public static isGenericCategoryPhrase(cleanPhrase: string): { isGeneric: boolean; categoryKey: string | null } {
    const clean = cleanPhrase.toLowerCase().trim();
    for (const [catKey, aliasList] of Object.entries(GENERIC_CATEGORY_KEYWORDS)) {
      if (aliasList.some(alias => clean === alias || clean === `a ${alias}` || clean === `some ${alias}`)) {
        return { isGeneric: true, categoryKey: catKey };
      }
    }
    return { isGeneric: false, categoryKey: null };
  }

  public static checkRestrictedFoodInterception(
    query: string,
    restrictedCatalogItems: FoodItem[]
  ): { isRestricted: boolean; matchedItem: FoodItem | null; score: number } {
    if (!query || !restrictedCatalogItems || restrictedCatalogItems.length === 0) {
      return { isRestricted: false, matchedItem: null, score: 0 };
    }

    const { cleanPhrase } = this.extractQuantityAndCleanPhrase(query);
    const restrictedIds = restrictedCatalogItems.map(i => i.id);
    const res = resolveRestrictedFoodInterception(cleanPhrase || query, restrictedIds);
    return {
      isRestricted: res.isRestricted,
      matchedItem: res.matchedItem as FoodItem | null,
      score: res.score
    };
  }

  public static matchCatalogItem(
    transcripts: string | string[],
    catalog: FoodItem[] = INDIAN_FOOD_CATALOG,
    language: Language = 'en',
    userId: string = 'default_user'
  ): MatchResult<FoodItem> {
    const rawCandidates = this.toCandidateList(transcripts);
    if (rawCandidates.length === 0 || catalog.length === 0) {
      return {
        isMatched: false,
        matchedValue: null,
        confidence: 0,
        needsClarification: false,
        top3Candidates: catalog.slice(0, 3)
      };
    }

    const primaryExt = this.extractQuantityAndCleanPhrase(rawCandidates[0]);
    const globalQuantity = primaryExt.quantity;

    const genericCheck = this.isGenericCategoryPhrase(primaryExt.cleanPhrase);

    const candidateScores: Array<{
      foodItem: FoodItem;
      score: number;
      rawText: string;
      cleanText: string;
    }> = [];

    rawCandidates.forEach((rawText, index) => {
      const rankWeight = Math.max(0.65, 1 - index * 0.07);
      const { cleanPhrase } = this.extractQuantityAndCleanPhrase(rawText);

      const learnedTargetId = UserAliasService.findLearnedTargetId(cleanPhrase, userId);
      if (learnedTargetId) {
        const learnedItem = catalog.find(item => item.id === learnedTargetId);
        if (learnedItem) {
          candidateScores.push({
            foodItem: learnedItem,
            score: 0.98 * rankWeight,
            rawText,
            cleanText: cleanPhrase
          });
        }
      }

      catalog.forEach(item => {
        let maxItemScore = 0;

        const namesToCompare = [
          item.name,
          item.id,
          item.nativeNames?.en || '',
          item.nativeNames?.ta || '',
          item.nativeNames?.hi || ''
        ].filter(Boolean);

        const aliasEntry = CANONICAL_FOOD_ALIASES.find(a => a.id === item.id || item.name.toLowerCase().includes(a.canonicalName.toLowerCase()));
        if (aliasEntry) {
          namesToCompare.push(...aliasEntry.aliases);
        }

        for (const targetName of namesToCompare) {
          const matchScore = FuzzyMatchEngine.calculateMatchScore(cleanPhrase, targetName);
          if (matchScore > maxItemScore) {
            maxItemScore = matchScore;
          }
        }

        const weightedScore = maxItemScore * rankWeight;
        if (weightedScore > 0.30) {
          candidateScores.push({
            foodItem: item,
            score: weightedScore,
            rawText,
            cleanText: cleanPhrase
          });
        }
      });
    });

    const itemMap = new Map<string, { foodItem: FoodItem; score: number; rawText: string }>();
    candidateScores.forEach(cs => {
      const existing = itemMap.get(cs.foodItem.id);
      if (!existing || cs.score > existing.score) {
        itemMap.set(cs.foodItem.id, { foodItem: cs.foodItem, score: cs.score, rawText: cs.rawText });
      }
    });

    const sortedCandidates = Array.from(itemMap.values()).sort((a, b) => b.score - a.score);

    if (sortedCandidates.length === 0) {
      return {
        isMatched: false,
        matchedValue: null,
        confidence: 0,
        needsClarification: false,
        top3Candidates: catalog.slice(0, 3),
        quantity: globalQuantity
      };
    }

    const topCandidate = sortedCandidates[0];
    const catKey = genericCheck.categoryKey || primaryExt.cleanPhrase;
    const catLower = catKey.toLowerCase();
    const categoryVariants = catalog.filter(f => {
      const name = f.name.toLowerCase();
      const cat = f.category.toLowerCase();
      const tags = (f.tags || []).map(t => t.toLowerCase());
      return name.includes(catLower) || cat.includes(catLower) || tags.some(t => t.includes(catLower));
    });
    const top3Items = categoryVariants.length >= 1 ? categoryVariants : sortedCandidates.slice(0, 3).map(c => c.foodItem);

    // Rule 1: Generic Category Term Rule ("idli", "dosa", "biryani", "parotta")
    // If only 1 variant exists in catalog (e.g. "idli" -> Steamed Button Sambar Idli), auto-select it directly!
    // Never show "Which idli?" with a single button.
    // If 2 or more variants exist (e.g. "dosa" -> 4 variants), ask "Which {category} would you like?" with ALL variant buttons!
    if (genericCheck.isGeneric && sortedCandidates.length >= 1) {
      if (categoryVariants.length === 1) {
        return {
          isMatched: true,
          matchedValue: categoryVariants[0],
          confidence: Math.max(topCandidate.score, 0.90),
          needsClarification: false,
          bestCandidate: categoryVariants[0],
          top3Candidates: [categoryVariants[0]],
          matchedTranscript: topCandidate.rawText,
          quantity: globalQuantity,
          isGenericCategory: true
        };
      } else if (categoryVariants.length > 1) {
        const catName = genericCheck.categoryKey || primaryExt.cleanPhrase;
        const prompt = language === 'ta'
          ? `எந்த ${catName} உங்களுக்கு வேண்டும்?`
          : language === 'hi'
          ? `आपको कौन सा ${catName} चाहिए?`
          : `Which ${catName} would you like?`;

        return {
          isMatched: false,
          matchedValue: null,
          confidence: topCandidate.score,
          needsClarification: true,
          bestCandidate: topCandidate.foodItem,
          top3Candidates: categoryVariants,
          clarificationPrompt: prompt,
          matchedTranscript: topCandidate.rawText,
          quantity: globalQuantity,
          isGenericCategory: true
        };
      }
    }

    // Rule 2: High Confidence (>= 0.75) -> Auto-Proceed
    if (topCandidate.score >= FUZZY_CONFIG.highConfidence) {
      return {
        isMatched: true,
        matchedValue: topCandidate.foodItem,
        confidence: topCandidate.score,
        needsClarification: false,
        top3Candidates: top3Items,
        matchedTranscript: topCandidate.rawText,
        quantity: globalQuantity
      };
    }

    // Rule 3: Medium Confidence (0.45 <= score < 0.75) -> "Did you mean {Item}?" + Top 3 Buttons
    if (topCandidate.score >= FUZZY_CONFIG.mediumConfidence) {
      const topName = topCandidate.foodItem.nativeNames?.[language] || topCandidate.foodItem.name;
      const prompt = language === 'ta'
        ? `நீங்கள் "${topName}" என்று கூறினீர்களா?`
        : language === 'hi'
        ? `क्या आपका मतलब "${topName}" था?`
        : `Did you mean "${topName}"?`;

      return {
        isMatched: false,
        matchedValue: topCandidate.foodItem,
        confidence: topCandidate.score,
        needsClarification: true,
        bestCandidate: topCandidate.foodItem,
        top3Candidates: top3Items,
        clarificationPrompt: prompt,
        matchedTranscript: topCandidate.rawText,
        quantity: globalQuantity
      };
    }

    // Rule 4: Low Confidence (< 0.45) -> Top 3 candidate buttons / popular suggestions
    return {
      isMatched: false,
      matchedValue: null,
      confidence: topCandidate.score,
      needsClarification: false,
      top3Candidates: top3Items.length > 0 ? top3Items : catalog.slice(0, 3),
      matchedTranscript: topCandidate.rawText,
      quantity: globalQuantity
    };
  }

  public static matchLocation(
    transcripts: string | string[],
    language: Language = 'en'
  ): { isMatched: boolean; area: string; city: string; confidence: number } {
    const candidates = this.toCandidateList(transcripts);
    if (candidates.length === 0) {
      return { isMatched: false, area: '', city: '', confidence: 0 };
    }

    const LOCATION_PRESETS = [
      {
        city: 'Chennai',
        area: 'Anna Nagar',
        aliases: ['anna nagar', 'அண்ணா நகர்', 'अन्ना नगर', 'chennai anna nagar', 'சென்னை அண்ணா நகர்', 'சென்னை', 'chennai', 'चेन्नई', 'madras']
      },
      {
        city: 'Chennai',
        area: 'T. Nagar',
        aliases: ['t nagar', 't. nagar', 'thiagaraya nagar', 'தி நகர்', 'டி நகர்', 'टी नगर', 'chennai t nagar']
      },
      {
        city: 'Chennai',
        area: 'Velachery',
        aliases: ['velachery', 'வேளச்சேரி', 'वेलाचेरी', 'chennai velachery']
      },
      {
        city: 'Coimbatore',
        area: 'Gandhipuram',
        aliases: ['coimbatore', 'கோவை', 'கோயம்புத்தூர்', 'कोयंबटूर', 'gandhipuram', 'காந்திபுரம்', 'गांधीपुरम']
      },
      {
        city: 'Madurai',
        area: 'KK Nagar',
        aliases: ['madurai', 'மதுரை', 'मदुरै', 'kk nagar', 'கே கே நகர்', 'के के नगर']
      },
      {
        city: 'Salem',
        area: 'Fairlands',
        aliases: ['salem', 'சேலம்', 'सलेम', 'fairlands', 'பேர்லேண்ட்ஸ்', 'फेयरलैंड्स']
      },
      {
        city: 'Bengaluru',
        area: 'Indiranagar',
        aliases: ['bengaluru', 'bangalore', 'பெங்களூரு', 'பெங்களூர்', 'बेंगलुरु', 'बैंगलोर', 'indiranagar', 'இந்திரா நகர்', 'इंदिरानगर']
      },
      {
        city: 'Hyderabad',
        area: 'Gachibowli',
        aliases: ['hyderabad', 'ஹைதராபாத்', 'हैदराबाद', 'gachibowli', 'கச்சிபௌலி', 'गाचीबोवली']
      },
      {
        city: 'Mumbai',
        area: 'Bandra West',
        aliases: ['mumbai', 'bombay', 'மும்பை', 'பம்பாய்', 'मुंबई', 'बॉम्बे', 'bandra', 'பாந்த்ரா', 'बांद्रा']
      },
      {
        city: 'Delhi',
        area: 'Connaught Place',
        aliases: ['delhi', 'new delhi', 'டெல்லி', 'புது டெல்லி', 'दिल्ली', 'नई दिल्ली', 'connaught place', 'கன்னாட் பிளேஸ்', 'कनॉट प्लेस']
      }
    ];

    for (const cand of candidates) {
      const clean = cand.toLowerCase().trim();
      for (const loc of LOCATION_PRESETS) {
        for (const alias of loc.aliases) {
          if (clean === alias || clean.includes(alias) || alias.includes(clean)) {
            return {
              isMatched: true,
              area: loc.area,
              city: loc.city,
              confidence: 0.95
            };
          }
        }
      }
    }

    return { isMatched: false, area: '', city: '', confidence: 0 };
  }

  public static matchRestaurantSelection(
    transcripts: string | string[],
    availableRestaurants: string[]
  ): { isMatched: boolean; restaurant: string | null; matchedBy: 'ordinal' | 'name' | null } {
    if (!availableRestaurants || availableRestaurants.length === 0) {
      return { isMatched: false, restaurant: null, matchedBy: null };
    }
    const candidates = this.toCandidateList(transcripts);
    if (candidates.length === 0) {
      return { isMatched: false, restaurant: null, matchedBy: null };
    }

    const normalize = (value: string) =>
      value.toLowerCase().replace(/[,.!?;:()"'~`\-]+/g, ' ').replace(/\s+/g, ' ').trim();

    const ordinals: Array<{ idx: number; words: string[] }> = [
      { idx: 0, words: ['first', '1st', 'one', '1', 'முதல்', 'முதலாவது', 'ஒன்று', 'ஒன்னு', 'ஒண்ணு', 'முதலில்', 'पहला', 'पहिला', 'एक', 'pehla', 'pahila', 'ek', 'first one', 'option 1', 'option one'] },
      { idx: 1, words: ['second', '2nd', 'two', '2', 'இரண்டாவது', 'இரண்டு', 'ரெண்டாவது', 'ரெண்டு', 'இரண்டில்', 'दूसरा', 'दो', 'doosra', 'dusra', 'do', 'second one', 'option 2', 'option two'] },
      { idx: 2, words: ['third', '3rd', 'three', '3', 'மூன்றாவது', 'மூன்று', 'மூணாவது', 'மூணு', 'மூன்றில்', 'तीसरा', 'तीन', 'teesra', 'tisra', 'teen', 'third one', 'option 3', 'option three'] },
      { idx: 3, words: ['fourth', '4th', 'four', '4', 'நான்காவது', 'நான்கு', 'நாலாவது', 'நாலு', 'चौथा', 'चार', 'chautha', 'char'] }
    ];

    for (const raw of candidates) {
      const text = normalize(raw);
      if (!text) continue;

      // 1. Check Ordinals
      for (const ord of ordinals) {
        const matches = ord.words.some(w => {
          const nw = normalize(w);
          return text === nw || ` ${text} `.includes(` ${nw} `);
        });
        if (matches && ord.idx < availableRestaurants.length) {
          return { isMatched: true, restaurant: availableRestaurants[ord.idx], matchedBy: 'ordinal' };
        }
      }

      // 2. Check Restaurant Names & Transliterations
      for (const restaurant of availableRestaurants) {
        const normR = normalize(restaurant);
        if (text === normR || ` ${text} `.includes(` ${normR} `) || normR.includes(text)) {
          return { isMatched: true, restaurant, matchedBy: 'name' };
        }
        const aliases = RESTAURANT_TRANSLITERATIONS[restaurant] || [];
        for (const alias of aliases) {
          const normA = normalize(alias);
          if (text === normA || ` ${text} `.includes(` ${normA} `) || normA.includes(text)) {
            return { isMatched: true, restaurant, matchedBy: 'name' };
          }
        }
      }

      // 3. Fuzzy check for restaurant names
      for (const restaurant of availableRestaurants) {
        const score = FuzzyMatchEngine.calculateMatchScore(text, normalize(restaurant));
        if (score >= FUZZY_CONFIG.highConfidence) {
          return { isMatched: true, restaurant, matchedBy: 'name' };
        }
        const aliases = RESTAURANT_TRANSLITERATIONS[restaurant] || [];
        for (const alias of aliases) {
          const aliasScore = FuzzyMatchEngine.calculateMatchScore(text, normalize(alias));
          if (aliasScore >= FUZZY_CONFIG.highConfidence) {
            return { isMatched: true, restaurant, matchedBy: 'name' };
          }
        }
      }
    }

    return { isMatched: false, restaurant: null, matchedBy: null };
  }

}
