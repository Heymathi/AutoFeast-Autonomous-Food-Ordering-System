import { Language, FoodItem } from '../types';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { CANONICAL_FOOD_ALIASES } from '../config/fuzzyConfig';
import { FuzzyMatchEngine } from './fuzzyMatchService';
import { RESTAURANT_TRANSLITERATIONS } from './sttMatcherService';

export interface ParsedVoiceCommandItem {
  name: string;
  quantity: number;
  foodItem?: FoodItem;
}

export interface ParsedVoiceCommandResult {
  action: 'order' | 'schedule' | 'search' | 'unknown';
  items: ParsedVoiceCommandItem[];
  restaurant?: string;
  time?: { time24: string; time12Formatted: string; raw: string; needsAmPmClarification?: boolean };
  date?: { dateStr: string; displayDate: string; isTomorrow?: boolean; isToday?: boolean };
  recurrence?: {
    isRecurring: boolean;
    frequency: 'daily' | 'weekly' | 'custom' | 'once';
    duration?: '1_week' | '1_month' | '3_months' | 'custom';
    raw?: string;
  };
  language: Language;
  rawTranscript: string;
  matchedFoodItem?: FoodItem;
  catalogVariants?: FoodItem[];
  needsVarietyClarification?: boolean;
  needsOrderOrScheduleClarification?: boolean;
}

// Polite/filler words to ignore
const POLITE_FILLER_WORDS = [
  'can you', 'could you', 'would you', 'kindly',
  'i want a', 'i want', 'i would like', 'get me', 'bring me', 'give me',
  'for me', 'for us', 'please',
  'kudu', 'kodu', 'kudunga', 'pannu', 'panni', 'pannunga', 'pannanum', 'pannidu',
  'potu', 'pottu', 'podu', 'potru', 'pottru', 'potturu', 'venum', 'vaenum',
  'thanga', 'thaanga', 'solu', 'sollu', 'sollunga', 'vaangu', 'anuppu',
  'kar do', 'kar dena', 'kardo', 'kardena', 'karo', 'kariye', 'chahiye',
  'dedo', 'do', 'lao', 'bhejo', 'dijiye', 'दीजिए', 'कर दो', 'कर देना', 'करो',
  'சொல்லு', 'சொல்லுங்கள்', 'பண்ணு', 'குடு', 'போடு', 'வேண்டும்', 'வேணும்'
];

// Number word map across English, Tamil, Hindi, Tanglish, Hinglish
const QUANTITY_WORD_MAP: Array<{ value: number; tokens: string[] }> = [
  { value: 1, tokens: ['one', 'a', 'an', 'oru', 'onnu', 'onpathu', 'ondru', 'ஒன்று', 'ஒன்னு', 'ஒரு', 'ek', 'एक'] },
  { value: 2, tokens: ['two', 'rendu', 'erandu', 'irandu', 'இரண்டு', 'ரெண்டு', 'do', 'दो'] },
  { value: 3, tokens: ['three', 'moonu', 'moondru', 'மூன்று', 'மூணு', 'teen', 'तीन'] },
  { value: 4, tokens: ['four', 'naalu', 'naangu', 'நான்கு', 'நாலு', 'char', 'chaar', 'चार'] },
  { value: 5, tokens: ['five', 'anju', 'ainthu', 'ஐந்து', 'அஞ்சு', 'paanch', 'panch', 'पांच', 'पाँच'] },
  { value: 6, tokens: ['six', 'aaru', 'ஆறு', 'che', 'chhah', 'छह', 'छः'] },
  { value: 7, tokens: ['seven', 'ezhu', 'ஏழு', 'saat', 'सात'] },
  { value: 8, tokens: ['eight', 'ettu', 'எட்டு', 'aath', 'आठ'] },
  { value: 9, tokens: ['nine', 'onbadhu', 'onpathu', 'ஒன்பது', 'nau', 'नौ'] },
  { value: 10, tokens: ['ten', 'pathu', 'பத்து', 'das', 'दस'] }
];

export class VoiceCommandParser {
  /**
   * Normalize transcript string
   */
  public static normalize(text: string): string {
    if (!text || typeof text !== 'string') return '';
    return text
      .toLowerCase()
      .replace(/(\d+)\s*:\s*(\d+)/g, '$1###COLON###$2')
      .replace(/[.,!?;:()"'~`\-_/\\[\]{}]+/g, ' ')
      .replace(/###COLON###/g, ':')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Main unified parser for English, Tamil script, Hindi script, Tanglish, Hinglish
   */
  public static parse(transcript: string, currentLang: Language = 'en'): ParsedVoiceCommandResult {
    const rawTranscript = (transcript || '').trim();
    const norm = this.normalize(rawTranscript);

    // 1. Detect Explicit Language clues or keep current
    const lang = this.detectLanguage(norm, currentLang);

    // 2. Extract Time (respecting TIME vs QUANTITY rule)
    const timeRes = this.extractTime(norm);

    // 3. Extract Date and Recurrence
    const dateRes = this.extractDate(norm);
    const recurrenceRes = this.extractRecurrence(norm);

    // 4. Extract Restaurant if named
    const restaurant = this.extractRestaurant(norm);

    // 5. Determine Action ('order' | 'schedule' | 'search' | 'unknown')
    const action = this.determineAction(norm, timeRes, recurrenceRes, dateRes);

    // 6. Clean sentence for item & quantity matching
    const cleanedForItems = this.cleanTranscriptForItems(norm, timeRes, restaurant);

    // 7. Extract Items & Quantities with Fuzzy Catalog Match
    const items = this.extractItems(cleanedForItems, norm, lang);

    // 8. Identify primary matched item and check if generic (needs variety)
    let matchedFoodItem: FoodItem | undefined = items[0]?.foodItem;
    let catalogVariants: FoodItem[] | undefined;
    let needsVarietyClarification = false;

    if (matchedFoodItem) {
      const familyCheck = this.findCategoryVariants(items[0].name, matchedFoodItem);
      if (familyCheck.length > 1) {
        catalogVariants = familyCheck;
        // If user didn't specify a distinctive variant e.g. "masala dosa" vs generic "dosa"
        if (this.isGenericBaseTerm(items[0].name, familyCheck)) {
          needsVarietyClarification = true;
        }
      }
    }

    // 9. If only an item name was spoken with no action/time ("parotta", "dosa"), flag needsOrderOrScheduleClarification
    let needsOrderOrScheduleClarification = false;
    if (items.length > 0 && !timeRes && !recurrenceRes && !dateRes) {
      const hasActionKeyword = this.hasExplicitActionKeyword(norm);
      if (!hasActionKeyword) {
        needsOrderOrScheduleClarification = true;
      }
    }

    return {
      action,
      items,
      restaurant,
      time: timeRes || undefined,
      date: dateRes || undefined,
      recurrence: recurrenceRes || undefined,
      language: lang,
      rawTranscript,
      matchedFoodItem,
      catalogVariants,
      needsVarietyClarification,
      needsOrderOrScheduleClarification
    };
  }

  private static detectLanguage(norm: string, fallback: Language): Language {
    if (/[\u0B80-\u0BFF]/.test(norm)) return 'ta';
    if (/[\u0900-\u097F]/.test(norm)) return 'hi';
    return fallback;
  }

  /**
   * TIME vs QUANTITY:
   * A number followed by மணிக்கு / maniku / mani / மணி / baje / बजे / o'clock / AM / PM / morning / evening / night / noon is a TIME.
   * If AM/PM is not clear e.g. "2 maniku", flag needsAmPmClarification.
   */
  public static extractTime(norm: string): {
    time24: string;
    time12Formatted: string;
    raw: string;
    needsAmPmClarification?: boolean;
  } | null {
    // Check named meal slots if no digits: morning, afternoon, evening, night
    const isPM = /\b(pm|p\.m|evening|night|shaam|raat|dopahar|மதியம்|மாலை|இரவு)\b/i.test(norm);
    const isAM = /\b(am|a\.m|morning|subah|காலை)\b/i.test(norm);

    // 1. Digits followed by colon: "8:30", "8:30 pm", "7:30 in the morning"
    const colonMatch = norm.match(/(\d{1,2})\s*:\s*(\d{2})\s*(am|pm)?/i);
    if (colonMatch) {
      let h = parseInt(colonMatch[1], 10);
      const m = parseInt(colonMatch[2], 10);
      const ampm = colonMatch[3]?.toLowerCase();
      if (ampm === 'pm' || (!ampm && isPM)) {
        if (h < 12) h += 12;
      } else if (ampm === 'am' || (!ampm && isAM)) {
        if (h === 12) h = 0;
      }
      return this.formatTime(h, m, colonMatch[0]);
    }

    // 2. Number or Word followed by time markers: "8 am", "8 maniku", "8 மணிக்கு", "8 baje", "8 बजे", "2 maniku"
    // Regex matches digits or number words right before a time unit (using non-word boundary for Indic script)
    const timeUnitRegex = /(?:^|\s)(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|onnu|rendu|moonu|naalu|anju|aaru|ezhu|ettu|onpadhu|pathu|ek|do|teen|char|paanch|che|saat|aath|nau|das|gyarah|barah|ஒன்று|இரண்டு|மூன்று|நான்கு|ஐந்து|ஆறு|ஏழு|எட்டு|ஒன்பது|பத்து|ஒரு|ரெண்டு|மூணு|நாலு|அஞ்சு|एक|दो|तीन|चार|पांच|पाँच|छह|सात|आठ|नौ|दस|ग्यारह|बारह)\s*(மணிக்கு|maniku|mani|மணி|baje|बजे|o'clock|am|pm)(?:\s|$)/i;
    const unitMatch = norm.match(timeUnitRegex);

    if (unitMatch) {
      const numToken = unitMatch[1].toLowerCase();
      const rawHour = this.parseNumberToken(numToken);
      if (rawHour !== null && rawHour >= 1 && rawHour <= 24) {
        let h = rawHour;
        let m = 0;

        // Check for minutes e.g. "30", "half past", "அரை", "साढ़े"
        if (norm.includes('thirty') || norm.includes('அரை') || norm.includes('साढ़े') || norm.includes('saadhe')) {
          m = 30;
        }

        let needsClarification = false;
        if (unitMatch[2].toLowerCase().includes('pm') || isPM) {
          if (h < 12) h += 12;
        } else if (unitMatch[2].toLowerCase().includes('am') || isAM) {
          if (h === 12) h = 0;
        } else {
          // No AM/PM explicitly provided
          if (h >= 1 && h <= 6) {
            needsClarification = true;
            h += 12; // default PM
          } else if (h >= 7 && h <= 11) {
            if (norm.includes('dinner') || norm.includes('இரவு') || norm.includes('night') || norm.includes('shaam')) {
              h += 12;
            }
          }
        }

        return {
          ...this.formatTime(h, m, unitMatch[0].trim()),
          needsAmPmClarification: needsClarification && !isAM && !isPM
        };
      }
    }

    // 3. "at 8", "at 7:30", "at 8:00"
    const atMatch = norm.match(/\bat\s+(\d{1,2})(?::(\d{2}))?(?:\s*(am|pm))?\b/i);
    if (atMatch) {
      let h = parseInt(atMatch[1], 10);
      const m = atMatch[2] ? parseInt(atMatch[2], 10) : 0;
      const ampm = atMatch[3]?.toLowerCase();
      if (ampm === 'pm' || (!ampm && isPM)) {
        if (h < 12) h += 12;
      } else if (ampm === 'am' || (!ampm && isAM)) {
        if (h === 12) h = 0;
      } else if (h >= 1 && h <= 6) {
        h += 12;
      }
      return this.formatTime(h, m, atMatch[0]);
    }

    return null;
  }

  private static formatTime(hours: number, minutes: number, raw: string): {
    time24: string;
    time12Formatted: string;
    raw: string;
  } {
    const h24 = String(hours % 24).padStart(2, '0');
    const m24 = String(minutes).padStart(2, '0');
    const displayHours = hours % 12 || 12;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const time12Formatted = `${displayHours}:${m24} ${ampm}`;
    return { time24: `${h24}:${m24}`, time12Formatted, raw };
  }

  private static parseNumberToken(token: string): number | null {
    if (/^\d+$/.test(token)) {
      return parseInt(token, 10);
    }
    for (const entry of QUANTITY_WORD_MAP) {
      if (entry.tokens.includes(token)) {
        return entry.value;
      }
    }
    const extraMap: Record<string, number> = {
      'eleven': 11, 'twelve': 12, 'gyarah': 11, 'barah': 12,
      'பதினொன்று': 11, 'பனிரெண்டு': 12, 'ग्यारह': 11, 'बारह': 12
    };
    return extraMap[token] ?? null;
  }

  /**
   * Extract Date: today, tomorrow / naalaikku / நாளைக்கு / kal / कल
   */
  public static extractDate(norm: string): {
    dateStr: string;
    displayDate: string;
    isTomorrow?: boolean;
    isToday?: boolean;
  } | null {
    const today = new Date();
    const isTomorrow = /(?:^|\s)(tomorrow|naalaikku|nalaikku|naalai|kal|नालाई|நாளைக்கு|நாளை|कल)(?:\s|$)/i.test(norm);
    const isToday = /(?:^|\s)(today|inru|indru|aaj|இன்று|இன்னைக்கு|आज)(?:\s|$)/i.test(norm);

    if (isTomorrow) {
      const d = new Date(today);
      d.setDate(d.getDate() + 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return { dateStr: `${yyyy}-${mm}-${dd}`, displayDate: 'Tomorrow', isTomorrow: true };
    }

    if (isToday) {
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      return { dateStr: `${yyyy}-${mm}-${dd}`, displayDate: 'Today', isToday: true };
    }

    return null;
  }

  /**
   * Extract Recurrence:
   * "daily / dhinamum / everyday / roz / रोज़", "for a week / month", "oru vaaram / oru masam / ek hafta / ek mahina", "3 months"
   */
  public static extractRecurrence(norm: string): {
    isRecurring: boolean;
    frequency: 'daily' | 'weekly' | 'custom' | 'once';
    duration?: '1_week' | '1_month' | '3_months' | 'custom';
    raw?: string;
  } | null {
    let isRecurring = false;
    let frequency: 'daily' | 'weekly' | 'custom' | 'once' = 'once';
    let duration: '1_week' | '1_month' | '3_months' | 'custom' | undefined;

    // Daily / Everyday keywords
    if (/\b(daily|everyday|every day|dhinamum|dinamum|roz|har roz|har din|தினமும்|ஒவ்வொரு நாளும்|रोज़|रोज|हर दिन|प्रतिदिन)\b/i.test(norm)) {
      isRecurring = true;
      frequency = 'daily';
    } else if (/\b(weekly|every week|வாரம் ஒரு முறை|har hafte|हफ्ते)\b/i.test(norm)) {
      isRecurring = true;
      frequency = 'weekly';
    }

    // Duration keywords
    if (/\b(3\s*months?|three\s*months?|3\s*மாதம்|3\s*மாதங்கள்|3\s*மாத|teen\s*mahine|3\s*महीने|3\s*महीना)\b/i.test(norm)) {
      isRecurring = true;
      duration = '3_months';
    } else if (/\b(1\s*month|one\s*month|a\s*month|oru\s*masam|oru\s*masathuku|1\s*masathuku|ஒரு\s*மாதம்|1\s*மாதம்|1\s*மாத|ek\s*mahina|1\s*mahina|ek\s*mahine|1\s*महीना|1\s*महीने)\b/i.test(norm)) {
      isRecurring = true;
      duration = '1_month';
    } else if (/\b(1\s*week|one\s*week|a\s*week|oru\s*vaaram|1\s*vaaram|ஒரு\s*வாரம்|1\s*வாரம்|ek\s*hafta|1\s*hafta|ek\s*hafte|1\s*हफ्ता|1\s*हफ्ते)\b/i.test(norm)) {
      isRecurring = true;
      duration = '1_week';
    }

    if (!isRecurring && !duration) return null;
    return {
      isRecurring: true,
      frequency: frequency === 'once' ? 'daily' : frequency,
      duration: duration || '1_week',
      raw: norm
    };
  }

  /**
   * Determine Action:
   * action = schedule if the sentence has a time ("8 AM", "8 maniku", "காலை 8 மணிக்கு", "सुबह 8 बजे"),
   * or words like schedule, later, tomorrow, daily, every day, weekly, monthly.
   * Otherwise action = order.
   * "now / ippovae / ippove / இப்போவே / இப்பவே / abhi / अभी / turant" force order.
   */
  public static determineAction(
    norm: string,
    time: unknown,
    recurrence: unknown,
    date: { isTomorrow?: boolean } | null
  ): 'order' | 'schedule' | 'search' | 'unknown' {
    const hasForceOrder = /\b(now|ippovae|ippove|ippo|udane|இப்போவே|இப்பவே|இப்போதே|இப்போ|உடனே|abhi|turant|अभी|तुरंत)\b/i.test(norm);
    if (hasForceOrder && !time) {
      return 'order';
    }

    const hasScheduleWord = /\b(schedule|later|tomorrow|daily|everyday|every day|weekly|monthly|thittamidu|naalaikku|dhinamum|அட்டவணை|திட்டமிடு|நாளைக்கு|தினமும்|शेड्यूल|कल|रोज|प्रतिदिन|बाद में)\b/i.test(norm);

    if (time || recurrence || date?.isTomorrow || hasScheduleWord) {
      return 'schedule';
    }

    const hasOrderWord = /\b(order|get|want|buy|bring|give|send|pannu|kudu|podu|venum|ஆர்டர்|வாங்கு|கொடு|வேணும்|மங்காओ|करो|लाओ|दो)\b/i.test(norm);
    if (hasOrderWord) {
      return 'order';
    }

    return 'order';
  }

  private static hasExplicitActionKeyword(norm: string): boolean {
    return /(?:\b|(?:^|\s))(order|schedule|now|later|tomorrow|daily|weekly|month|at|am|pm|maniku|baje|மணிக்கு|ஆர்டர்|திட்டமிடு|இப்போ|நாளைக்கு|शेड्यूल|अभी|कल)(?:\b|(?:\s|$))/i.test(norm);
  }

  /**
   * Extract Restaurant if mentioned in transcript
   */
  public static extractRestaurant(norm: string): string | undefined {
    for (const [restName, aliases] of Object.entries(RESTAURANT_TRANSLITERATIONS)) {
      if (norm.includes(restName.toLowerCase())) return restName;
      for (const a of aliases) {
        if (` ${norm} `.includes(` ${a.toLowerCase()} `)) {
          return restName;
        }
      }
    }
    // Also check distinctive restaurant keywords from catalog
    const allRestaurants = [...new Set(INDIAN_FOOD_CATALOG.map(i => i.restaurant))];
    for (const r of allRestaurants) {
      if (norm.includes(r.toLowerCase())) return r;
    }
    return undefined;
  }

  /**
   * Clean transcript to leave food keywords & quantity
   */
  private static cleanTranscriptForItems(
    norm: string,
    time: { raw: string } | null,
    restaurant?: string
  ): string {
    let clean = ` ${norm} `;

    // 1. Remove restaurant name if matched
    if (restaurant) {
      clean = clean.replace(new RegExp(`\\b${restaurant}\\b`, 'gi'), ' ');
      const aliases = RESTAURANT_TRANSLITERATIONS[restaurant] || [];
      for (const a of aliases) {
        clean = clean.replace(new RegExp(`\\b${a}\\b`, 'gi'), ' ');
      }
    }

    // 2. Remove time raw text (e.g. "8 am", "8 maniku", "காலை 8 மணிக்கு", "rendu maniku")
    if (time) {
      clean = clean.replace(time.raw.toLowerCase(), ' ');
    }
    // Remove standalone time tokens e.g. "காலை", "இரவு", "baje", "maniku", "மணிக்கு"
    clean = clean.replace(/\b(maniku|mani|மணிக்கு|மணி|baje|बजे|am|pm|morning|evening|night|காலை|இரவு|மாலை|सुबह|शाम|रात|dopahar)\b/gi, ' ');

    // 3. Remove date & recurrence keywords
    clean = clean.replace(/\b(tomorrow|naalaikku|kal|today|inru|aaj|daily|everyday|dhinamum|roz|நாளைக்கு|நாளை|இன்று|தினமும்|कल|आज|रोज|हर दिन)\b/gi, ' ');
    clean = clean.replace(/\b(for a month|for a week|for 1 month|for 1 week|for 3 months|oru masathuku|oru masam|oru vaaram|ek mahina|ek hafta|1 month|1 week|3 months|ஒரு மாதம்|ஒரு வாரம்|3 மாதம்|एक महीना|एक हफ्ता|3 महीने)\b/gi, ' ');

    // 4. Remove order/schedule intent triggers and polite words
    clean = clean.replace(/\b(order|schedule|instant|now|later|ippovae|udane|இப்போவே|ஆர்டர்|திட்டமிடு|शेड्यूल|अभी)\b/gi, ' ');
    // Handle Indic words without \b boundary
    clean = clean.replace(/(?:^|\s)(இப்போவே|இப்பவே|இப்போதே|இப்போ|உடனே|ஆர்டர்|திட்டமிடு|शेड्यूल|अभी|ऑर्डर)(?:\s|$)/gi, ' ');
    for (const filler of POLITE_FILLER_WORDS) {
      clean = clean.replace(new RegExp(`(?:^|\\s)${filler}(?:\\s|$)`, 'gi'), ' ');
      clean = clean.replace(new RegExp(`\\b${filler}\\b`, 'gi'), ' ');
    }

    return clean.replace(/\s+/g, ' ').trim();
  }

  /**
   * Extract Items & Quantities
   */
  public static extractItems(cleaned: string, fullNorm: string, lang: Language): ParsedVoiceCommandItem[] {
    const items: ParsedVoiceCommandItem[] = [];

    // Split on 'and' / 'மற்றும்' / 'aur' / ',' if multiple items in sentence
    const parts = cleaned.split(/\b(?:and|மற்றும்|aur|और|,)\b/i).map(p => p.trim()).filter(Boolean);
    const candidatePhrases = parts.length > 0 ? parts : [cleaned];

    for (const phrase of candidatePhrases) {
      const { quantity, foodItem, matchedName } = this.matchSingleItemWithQuantity(phrase, fullNorm, lang);
      if (foodItem || matchedName) {
        items.push({
          name: matchedName || foodItem?.name || phrase,
          quantity: quantity || 1,
          foodItem: foodItem || undefined
        });
      }
    }

    return items;
  }

  private static matchSingleItemWithQuantity(
    phrase: string,
    fullNorm: string,
    lang: Language
  ): { quantity: number; foodItem: FoodItem | null; matchedName: string | null } {
    let clean = ` ${phrase} `;
    let quantity = 1;

    // Detect quantity placed before the item e.g. "rendu dosa", "2 idli", "do dosa", "दो डोसा"
    // Regex check for numeric digits
    const digitMatch = clean.match(/\b(\d+)\b/);
    if (digitMatch) {
      const val = parseInt(digitMatch[1], 10);
      if (val >= 1 && val <= 99) {
        quantity = val;
        clean = clean.replace(` ${digitMatch[1]} `, ' ');
      }
    } else {
      // Word quantity
      for (const entry of QUANTITY_WORD_MAP) {
        for (const tok of entry.tokens) {
          if (clean.includes(` ${tok} `)) {
            quantity = entry.value;
            clean = clean.replace(` ${tok} `, ' ');
            break;
          }
        }
      }
    }

    const itemCandidate = clean.replace(/\s+/g, ' ').trim();
    if (!itemCandidate) {
      return { quantity, foodItem: null, matchedName: null };
    }

    // Match against catalog with phonetic & fuzzy matching
    let bestFood: FoodItem | null = null;
    let bestScore = 0;
    let matchedName: string | null = null;

    // 1. Direct canonical food aliases lookup
    for (const aliasEntry of CANONICAL_FOOD_ALIASES) {
      for (const alias of aliasEntry.aliases) {
        const score = FuzzyMatchEngine.calculateMatchScore(itemCandidate, alias.toLowerCase());
        if (score > bestScore && score >= 0.50) {
          bestScore = score;
          const found = INDIAN_FOOD_CATALOG.find(i => i.id === aliasEntry.id || i.name.toLowerCase().includes(aliasEntry.canonicalName.toLowerCase()));
          if (found) {
            bestFood = found;
            matchedName = aliasEntry.canonicalName;
          }
        }
      }
    }

    // 2. Direct catalog item lookup (including tags and partial names)
    for (const item of INDIAN_FOOD_CATALOG) {
      const names = [
        item.name,
        item.nativeNames?.en || '',
        item.nativeNames?.ta || '',
        item.nativeNames?.hi || '',
        ...(item.tags || [])
      ].filter(Boolean);

      for (const n of names) {
        const score = FuzzyMatchEngine.calculateMatchScore(itemCandidate, n.toLowerCase());
        if (score > bestScore && score >= 0.45) {
          bestScore = score;
          bestFood = item;
          matchedName = item.nativeNames?.[lang] || item.name;
        }
      }
    }

    return {
      quantity,
      foodItem: bestFood,
      matchedName: matchedName || (bestScore >= 0.50 ? bestFood?.name || null : null)
    };
  }

  /**
   * Find all catalog variants for a generic family query (e.g. "dosa" -> Masala, Ghee Podi, Plain, Rava)
   */
  public static findCategoryVariants(queryName: string, matchedItem: FoodItem): FoodItem[] {
    const qLower = queryName.toLowerCase();
    const itemTag = matchedItem.tags?.[0];

    return INDIAN_FOOD_CATALOG.filter(i => {
      if (i.id === matchedItem.id) return true;
      if (itemTag && i.tags && i.tags.includes(itemTag)) return true;
      if (i.name.toLowerCase().includes(qLower) || qLower.includes(i.name.toLowerCase())) return true;
      return false;
    });
  }

  private static isGenericBaseTerm(queryName: string, variants: FoodItem[]): boolean {
    const q = queryName.toLowerCase().trim();
    const genericBases = [
      'dosa', 'dosai', 'idli', 'biryani', 'parotta', 'vada', 'pongal', 'chapati', 'chappathi',
      'தோசை', 'இட்லி', 'பிரியாணி', 'பரோட்டா', 'சப்பாத்தி',
      'डोसा', 'इडली', 'बिरयानी', 'परोटा', 'चपाती'
    ];
    if (genericBases.includes(q)) return true;
    // Check if query is just the base family word while variants have distinctive prefixes
    return variants.length > 1 && variants.every(v => v.name.toLowerCase() !== q);
  }
}
