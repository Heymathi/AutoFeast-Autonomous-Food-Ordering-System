/**
 * scheduleVoiceParser.ts
 *
 * Pure functions for the voice & tap guided scheduling flow:
 * 1. parseTime: parses spoken / typed time across English, Tamil, and Hindi
 * 2. parseRepeatType: monthly, weekly, custom
 * 3. parseDays: parses days of the week (multiple days, weekdays, weekend, daily)
 * 4. parseDayOfMonth: 1-31, number words, first/last day, Tamil/Hindi numerals
 * 5. parseCustomDate: relative dates, specific dates, rejecting past dates
 * 6. buildSummary: generates natural localized confirmation summary
 */

import { Language } from '../types';

export interface ParsedTimeResult {
  time24: string;      // HH:mm format, e.g. "08:30"
  displayTime: string; // e.g. "8:30 AM"
  hours: number;
  minutes: number;
}

export type RepeatType = 'weekly' | 'monthly' | 'custom';

export interface CustomDateResult {
  dateStr: string; // YYYY-MM-DD
  isPast: boolean;
  displayDate: string; // e.g. "15 November 2026"
}

export interface ScheduleSummaryParams {
  foodItemName: string;
  restaurant: string;
  repeatType: RepeatType;
  timeDisplay: string;
  days?: string[];      // e.g. ["Monday", "Thursday"]
  dayOfMonth?: number;  // 1-31
  customDate?: string;  // YYYY-MM-DD
}

// ─── 0. Normalizer ──────────────────────────────────────────────────────────

export function normalizeInput(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[,.!?;:()'"~`_+\\/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const FILLER_WORDS = [
  'please', 'i want', 'i would like', 'set it for', 'set for', 'set', 'at', 'on', 'order',
  'தயவுசெய்து', 'எனக்கு வேண்டும்', 'அமைக்கவும்', 'போடு',
  'कृपया', 'मुझे चाहिए', 'सेट करो', 'रखो', 'के लिए'
];

export function stripFillers(text: string): string {
  let str = normalizeInput(text);
  for (const f of FILLER_WORDS) {
    str = str.replace(new RegExp(`\\b${f}\\b`, 'gi'), ' ');
  }
  return str.replace(/\s+/g, ' ').trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function containsWord(text: string, word: string): boolean {
  if (!text || !word) return false;
  const escaped = escapeRegex(word.trim());
  const regex = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'u');
  return regex.test(text);
}

// ─── 1. parseTime ───────────────────────────────────────────────────────────

const NUMBER_WORDS: Record<string, number> = {
  // English
  'thirty one': 31, 'thirty': 30, 'twenty nine': 29, 'twenty eight': 28, 'twenty seven': 27,
  'twenty six': 26, 'twenty five': 25, 'twenty four': 24, 'twenty three': 23, 'twenty two': 22,
  'twenty one': 21, 'twenty': 20, 'nineteen': 19, 'eighteen': 18, 'seventeen': 17,
  'sixteen': 16, 'fifteen': 15, 'fourteen': 14, 'thirteen': 13, 'twelve': 12,
  'eleven': 11, 'ten': 10, 'nine': 9, 'eight': 8, 'seven': 7, 'six': 6,
  'five': 5, 'four': 4, 'three': 3, 'two': 2, 'one': 1,
  'forty five': 45, 'forty': 40, 'fifty': 50,

  // Tamil
  'முப்பத்தியொன்று': 31, 'முப்பது': 30, 'இருபத்தொன்பது': 29, 'இருபத்தியெட்டு': 28,
  'இருபத்தியேழு': 27, 'இருபத்தியாறு': 26, 'இருபத்தைந்து': 25, 'இருபத்தி நான்கு': 24,
  'இருபத்தி மூன்று': 23, 'இருபத்தி இரண்டு': 22, 'இருபத்தியொன்று': 21, 'இருபது': 20,
  'பத்தொன்பது': 19, 'பதினெட்டு': 18, 'பதினேழு': 17, 'பதினாறு': 16, 'பதினைந்து': 15,
  'பதினான்கு': 14, 'பதின்மூன்று': 13, 'பன்னிரண்டு': 12, 'பதினொன்று': 11, 'பத்து': 10,
  'ஒன்பது': 9, 'எட்டு': 8, 'ஏழு': 7, 'ஆறு': 6, 'ஐந்து': 5, 'அஞ்சு': 5,
  'நான்கு': 4, 'நாலு': 4, 'மூன்று': 3, 'மூணு': 3, 'இரண்டு': 2, 'ரெண்டு': 2,
  'ஒன்று': 1, 'ஒன்னு': 1, 'நாற்பத்தைந்து': 45,

  // Hindi
  'इकत्तीस': 31, 'तीस': 30, 'उनतीस': 29, 'अट्ठाईस': 28, 'सत्ताईस': 27, 'छब्बीस': 26,
  'पच्चीस': 25, 'चौबीस': 24, 'तेईस': 23, 'बाईस': 22, 'इक्कीस': 21, 'बीस': 20,
  'उन्नीस': 19, 'अट्ठारह': 18, 'सत्रह': 17, 'सोलह': 16, 'पंद्रह': 15, 'चौदह': 14,
  'तेरह': 13, 'बारह': 12, 'ग्यारह': 11, 'दस': 10, 'नौ': 9, 'आठ': 8, 'सात': 7,
  'छह': 6, 'पाँच': 5, 'पांच': 5, 'चार': 4, 'तीन': 3, 'दो': 2, 'एक': 1,
  'पैंतालीस': 45,
  // Transliterated
  'ikattis': 31, 'tees': 30, 'bees': 20, 'pandrah': 15, 'barah': 12, 'gyarah': 11,
  'das': 10, 'nau': 9, 'aath': 8, 'saat': 7, 'che': 6, 'paanch': 5, 'char': 4,
  'teen': 3, 'do': 2, 'ek': 1
};

export function parseTime(text: string): ParsedTimeResult | null {
  const norm = normalizeInput(text);
  if (!norm) return null;

  // Period detection (AM vs PM)
  const isPM = /\b(pm|p\.m|evening|night|afternoon|shaam|raat|dopahar)\b/i.test(norm) ||
    norm.includes('மாலை') || norm.includes('இரவு') || norm.includes('மதியம்');
  const isAM = /\b(am|a\.m|morning|subah)\b/i.test(norm) ||
    norm.includes('காலை');

  // 1. Direct HH:MM format e.g. "8:30 pm", "20:30", "8:30"
  const colonMatch = norm.match(/(\d{1,2})\s*:\s*(\d{2})\s*(am|pm)?/i);
  if (colonMatch) {
    let h = parseInt(colonMatch[1], 10);
    const m = parseInt(colonMatch[2], 10);
    const colonPeriod = colonMatch[3]?.toLowerCase();

    if (colonPeriod === 'pm' || (!colonPeriod && isPM)) {
      if (h < 12) h += 12;
    } else if (colonPeriod === 'am' || (!colonPeriod && isAM)) {
      if (h === 12) h = 0;
    }
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      return formatTimeResult(h, m);
    }
  }

  // 2. Direct digits: "8 am", "8 pm", "8 baje", "8 மணி"
  const digitMatch = norm.match(/(\d{1,2})\s*(?:மணி|baje|o'clock|am|pm)?/i);
  if (digitMatch) {
    let h = parseInt(digitMatch[1], 10);
    let m = 0;

    // Check for minutes e.g. "8 30", "eight thirty", "8 மணி 30 நிமிடம்"
    const minMatch = norm.match(/\d{1,2}\s*(?:மணி|baje|:)?\s*(\d{2})/i);
    if (minMatch) {
      m = parseInt(minMatch[1], 10);
    } else if (norm.includes('thirty') || norm.includes('அரை') || norm.includes('साढ़े') || norm.includes('saadhe')) {
      m = 30;
    } else if (norm.includes('fifteen') || norm.includes('கால்') || norm.includes('पाव') || norm.includes('paav')) {
      m = 15;
    }

    if (h >= 1 && h <= 12) {
      if (isPM && h < 12) h += 12;
      else if (isAM && h === 12) h = 0;
      else if (!isAM && !isPM) {
        if (h >= 1 && h <= 6) h += 12; // 1-6 default to PM for meal orders
      }
    }
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      return formatTimeResult(h, m);
    }
  }

  // 3. Spoken number words: "eight thirty", "subah aath baje", "காலை எட்டு மணி"
  const sortedNumberWords = Object.entries(NUMBER_WORDS).sort((a, b) => b[0].length - a[0].length);
  for (const [w, val] of sortedNumberWords) {
    if (containsWord(norm, w)) {
      let h = val;
      let m = 0;
      if (norm.includes('thirty') || norm.includes('அரை') || norm.includes('तीस') || norm.includes('साढ़े') || norm.includes('saadhe')) {
        m = 30;
      }
      if (h >= 1 && h <= 12) {
        if (isPM && h < 12) h += 12;
        else if (isAM && h === 12) h = 0;
        else if (h >= 1 && h <= 6) h += 12;
      }
      if (h >= 0 && h < 24 && m >= 0 && m < 60) {
        return formatTimeResult(h, m);
      }
    }
  }

  return null;
}

function formatTimeResult(hours: number, minutes: number): ParsedTimeResult {
  const h24 = String(hours).padStart(2, '0');
  const m24 = String(minutes).padStart(2, '0');
  const displayHours = hours % 12 || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayTime = `${displayHours}:${m24} ${ampm}`;
  return { time24: `${h24}:${m24}`, displayTime, hours, minutes };
}

// ─── 2. parseRepeatType ─────────────────────────────────────────────────────

const REPEAT_KEYWORDS = {
  monthly: [
    'monthly', 'every month', 'each month', 'once a month', 'month', 'per month',
    'மாதம்', 'மாதாந்திர', 'ஒவ்வொரு மாதம்', 'மாதந்தோறும்', 'மாதம் ஒருமுறை', 'maadham', 'madham',
    'महीने', 'मासिक', 'हर महीने', 'महीना', 'mahine', 'masik', 'har mahine', 'mahina'
  ],
  weekly: [
    'weekly', 'every week', 'each week', 'week', 'per week',
    'வாரம்', 'வாராந்திர', 'ஒவ்வொரு வாரம்', 'வாரந்தோறும்', 'vaaram', 'varam',
    'हफ्ते', 'साप्ताहिक', 'हर हफ्ते', 'हफ्ता', 'hafte', 'saptahik', 'har hafte', 'hafta'
  ],
  custom: [
    'custom', 'specific date', 'one time', 'once', 'single date', 'particular date',
    'ஒரு தேதி', 'குறிப்பிட்ட தேதி', 'தனிப்பயன்', 'ஒரே முறை', 'oru thethi', 'kurippitta thethi',
    'कस्टम', 'खास तारीख', 'एक बार', 'विशिष्ट तारीख', 'custom', 'khas tareekh', 'ek baar'
  ]
};

export function parseRepeatType(text: string): RepeatType | null {
  const norm = normalizeInput(text);
  if (!norm) return null;

  for (const w of REPEAT_KEYWORDS.monthly) {
    if (norm.includes(w)) return 'monthly';
  }
  for (const w of REPEAT_KEYWORDS.weekly) {
    if (norm.includes(w)) return 'weekly';
  }
  for (const w of REPEAT_KEYWORDS.custom) {
    if (norm.includes(w)) return 'custom';
  }
  return null;
}

// ─── 3. parseDays ───────────────────────────────────────────────────────────

export const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DAY_VARIANTS: Record<string, string[]> = {
  Monday: ['monday', 'mon', 'திங்கள்', 'திங்கட்கிழமை', 'thingal', 'somwar', 'somvar', 'सोमवार'],
  Tuesday: ['tuesday', 'tue', 'செவ்வாய்', 'செவ்வாய்க்கிழமை', 'sevvai', 'mangalwar', 'mangalvar', 'मंगलवार'],
  Wednesday: ['wednesday', 'wed', 'புதன்', 'புதன்கிழமை', 'budhan', 'budhwar', 'budhvar', 'बुधवार'],
  Thursday: ['thursday', 'thu', 'வியாழன்', 'வியாழக்கிழமை', 'vyazhan', 'guruwar', 'guruvar', 'brihaspativar', 'गुरुवार'],
  Friday: ['friday', 'fri', 'வெள்ளி', 'வெள்ளிக்கிழமை', 'velli', 'shukrawar', 'shukravar', 'शुक्रवार'],
  Saturday: ['saturday', 'sat', 'சனி', 'சனிக்கிழமை', 'sani', 'shaniwar', 'shanivar', 'शनिवार'],
  Sunday: ['sunday', 'sun', 'ஞாயிறு', 'ஞாயிற்றுக்கிழமை', 'nyayiru', 'raviwar', 'ravivar', 'itwar', 'रविवार', 'इतवार']
};

export function parseDays(text: string): string[] | null {
  const norm = normalizeInput(text);
  if (!norm) return null;

  // Presets
  if (norm.includes('weekdays') || norm.includes('வார நாட்கள்') || norm.includes('सप्ताह के दिन') || norm.includes('working days')) {
    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  }
  if (norm.includes('weekend') || norm.includes('வார இறுதி') || norm.includes('वीकेंड')) {
    return ['Saturday', 'Sunday'];
  }
  if (norm.includes('every day') || norm.includes('daily') || norm.includes('all days') ||
      norm.includes('தினமும்') || norm.includes('எல்லா நாளும்') || norm.includes('रोज') || norm.includes('हर दिन') || norm.includes('प्रतिदिन')) {
    return [...ALL_DAYS];
  }

  const matched = new Set<string>();
  for (const [dayName, variants] of Object.entries(DAY_VARIANTS)) {
    for (const v of variants) {
      if (containsWord(norm, v)) {
        matched.add(dayName);
        break;
      }
    }
  }

  if (matched.size === 0) return null;

  // Preserve natural week order
  return ALL_DAYS.filter(d => matched.has(d));
}

// ─── 4. parseDayOfMonth ─────────────────────────────────────────────────────

const ORDINAL_MAP: Record<string, number> = {
  'first day': 1, 'last day': 31,
  'முதல் நாள்': 1, 'கடைசி நாள்': 31,
  'पहला दिन': 1, 'आखिरी दिन': 31,
  'first': 1, '1st': 1, 'second': 2, '2nd': 2, 'third': 3, '3rd': 3,
  'fourth': 4, '4th': 4, 'fifth': 5, '5th': 5, 'sixth': 6, '6th': 6,
  'seventh': 7, '7th': 7, 'eighth': 8, '8th': 8, 'ninth': 9, '9th': 9,
  'tenth': 10, '10th': 10, 'eleventh': 11, '11th': 11, 'twelfth': 12, '12th': 12,
  'thirteenth': 13, '13th': 13, 'fourteenth': 14, '14th': 14, 'fifteenth': 15, '15th': 15,
  'sixteenth': 16, '16th': 16, 'seventeenth': 17, '17th': 17, 'eighteenth': 18, '18th': 18,
  'nineteenth': 19, '19th': 19, 'twentieth': 20, '20th': 20, 'twenty first': 21, '21st': 21,
  'twenty second': 22, '22nd': 22, 'twenty third': 23, '23rd': 23, 'twenty fourth': 24, '24th': 24,
  'twenty fifth': 25, '25th': 25, 'twenty sixth': 26, '26th': 26, 'twenty seventh': 27, '27th': 27,
  'twenty eighth': 28, '28th': 28, 'twenty ninth': 29, '29th': 29, 'thirtieth': 30, '30th': 30,
  'thirty first': 31, '31st': 31
};

export function parseDayOfMonth(text: string): number | null {
  const norm = normalizeInput(text);
  if (!norm) return null;

  // Check ordinal map first (longer phrases matched first)
  const sortedOrdinals = Object.entries(ORDINAL_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [w, val] of sortedOrdinals) {
    if (containsWord(norm, w)) {
      return val;
    }
  }

  // Check digits (1-31)
  const digitMatch = norm.match(/\b([1-9]|[12][0-9]|3[01])(?:st|nd|rd|th)?\b/) ||
    norm.match(/([1-9]|[12][0-9]|3[01])\s*(?:ஆம் தேதி|तारीख)/);
  if (digitMatch) {
    const n = parseInt(digitMatch[1], 10);
    if (n >= 1 && n <= 31) return n;
  }

  // Check NUMBER_WORDS (1-31)
  const sortedNumberWords = Object.entries(NUMBER_WORDS).sort((a, b) => b[0].length - a[0].length);
  for (const [w, val] of sortedNumberWords) {
    if (containsWord(norm, w)) {
      if (val >= 1 && val <= 31) return val;
    }
  }

  return null;
}

// ─── 5. parseCustomDate ─────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  january: 0, jan: 0, ஜனவரி: 0, जनवरी: 0,
  february: 1, feb: 1, பிப்ரவரி: 1, फ़रवरी: 1, फरवरी: 1,
  march: 2, mar: 2, மார்ச்: 2, मार्च: 2,
  april: 3, apr: 3, ஏப்ரல்: 3, अप्रैल: 3,
  may: 4, மே: 4, मई: 4,
  june: 5, jun: 5, ஜூன்: 5, जून: 5,
  july: 6, jul: 6, ஜூலை: 6, जुलाई: 6,
  august: 7, aug: 7, ஆகஸ்ட்: 7, अगस्त: 7,
  september: 8, sep: 8, sept: 8, செப்டம்பர்: 8, सितंबर: 8,
  october: 9, oct: 9, அக்டோபர்: 9, अक्टूबर: 9,
  november: 10, nov: 10, நவம்பர்: 10, नवंबर: 10,
  december: 11, dec: 11, டிசம்பர்: 11, दिसंबर: 11
};

export function parseCustomDate(text: string, referenceDate?: Date): CustomDateResult | null {
  if (!text) return null;
  const raw = text.trim();
  const norm = normalizeInput(text);
  if (!norm && !raw) return null;

  const ref = referenceDate ? new Date(referenceDate) : new Date();
  const todayMidnight = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());

  let targetDate: Date | null = null;

  // 1. Direct YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = raw.match(/\b(\d{4})[-\s/](\d{1,2})[-\s/](\d{1,2})\b/);
  if (isoMatch) {
    targetDate = new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
  }

  // 2. Relative dates: "day after tomorrow", "நாளை மறுநாள்", "parso" MUST be checked before "tomorrow"!
  if (!targetDate) {
    if (norm.includes('day after tomorrow') || norm.includes('நாளை மறுநாள்') || norm.includes('parso') || norm.includes('parson')) {
      targetDate = new Date(todayMidnight);
      targetDate.setDate(targetDate.getDate() + 2);
    } else if (norm.includes('tomorrow') || norm.includes('நாளை') || norm.includes('kal')) {
      targetDate = new Date(todayMidnight);
      targetDate.setDate(targetDate.getDate() + 1);
    } else if (norm.includes('today') || norm.includes('இன்று') || norm.includes('aaj')) {
      targetDate = new Date(todayMidnight);
    } else if (norm.includes('next week') || norm.includes('அடுத்த வாரம்') || norm.includes('अगले हफ्ते')) {
      targetDate = new Date(todayMidnight);
      targetDate.setDate(targetDate.getDate() + 7);
    }
  }

  // 3. Next [DayOfWeek] e.g. "next Monday", "அடுத்த திங்கள்", "agle somvar"
  if (!targetDate) {
    if (norm.includes('next') || norm.includes('அடுத்த') || norm.includes('agle')) {
      const parsedD = parseDays(norm);
      if (parsedD && parsedD.length > 0) {
        const targetDayIdx = ALL_DAYS.indexOf(parsedD[0]) + 1; // 1=Mon..7=Sun
        const currentDayIdx = todayMidnight.getDay() === 0 ? 7 : todayMidnight.getDay();
        let daysToAdd = (targetDayIdx - currentDayIdx + 7) % 7;
        if (daysToAdd === 0) daysToAdd = 7;
        targetDate = new Date(todayMidnight);
        targetDate.setDate(targetDate.getDate() + daysToAdd);
      }
    }
  }

  // 4. Month + Day e.g. "15th November", "15 november", "november 15", "நவம்பர் 15", "15 नवंबर"
  if (!targetDate) {
    for (const [mName, mIdx] of Object.entries(MONTHS)) {
      if (norm.includes(mName)) {
        const dayMatch = norm.match(/\b([1-9]|[12][0-9]|3[01])(?:st|nd|rd|th)?\b/) ||
          norm.match(/([1-9]|[12][0-9]|3[01])/);
        if (dayMatch) {
          const d = parseInt(dayMatch[1], 10);
          let y = todayMidnight.getFullYear();
          const candidate = new Date(y, mIdx, d);
          if (candidate < todayMidnight) {
            candidate.setFullYear(y + 1);
          }
          targetDate = candidate;
          break;
        }
      }
    }
  }

  if (!targetDate || isNaN(targetDate.getTime())) return null;

  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;

  const isPast = targetDate < todayMidnight;
  const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const displayDate = `${targetDate.getDate()} ${monthNamesEn[targetDate.getMonth()]} ${y}`;

  return { dateStr, isPast, displayDate };
}

// ─── 6. buildSummary ────────────────────────────────────────────────────────

const DAY_NAMES_LOCALIZED: Record<Language, Record<string, string>> = {
  en: {
    Monday: 'Monday', Tuesday: 'Tuesday', Wednesday: 'Wednesday',
    Thursday: 'Thursday', Friday: 'Friday', Saturday: 'Saturday', Sunday: 'Sunday'
  },
  ta: {
    Monday: 'திங்கள்', Tuesday: 'செவ்வாய்', Wednesday: 'புதன்',
    Thursday: 'வியாழன்', Friday: 'வெள்ளி', Saturday: 'சனி', Sunday: 'ஞாயிறு'
  },
  hi: {
    Monday: 'सोमवार', Tuesday: 'मंगलवार', Wednesday: 'बुधवार',
    Thursday: 'गुरुवार', Friday: 'शुक्रवार', Saturday: 'शनिवार', Sunday: 'रविवार'
  }
};

export function buildSummary(params: ScheduleSummaryParams, lang: Language): string {
  const { foodItemName, restaurant, repeatType, timeDisplay, days, dayOfMonth, customDate } = params;

  if (lang === 'ta') {
    if (repeatType === 'weekly' && days && days.length > 0) {
      const locDays = days.map(d => DAY_NAMES_LOCALIZED.ta[d] || d).join(' மற்றும் ');
      return `${restaurant}-லிருந்து ${foodItemName}, ஒவ்வொரு ${locDays} ${timeDisplay} மணிக்கு. அட்டவணைப்படுத்தவா?`;
    }
    if (repeatType === 'monthly') {
      const d = dayOfMonth || 1;
      return `${restaurant}-லிருந்து ${foodItemName}, ஒவ்வொரு மாதமும் ${d} ஆம் தேதி ${timeDisplay} மணிக்கு. அட்டவணைப்படுத்தவா?`;
    }
    const cDate = customDate || 'அட்டவணைத் தேதி';
    return `${restaurant}-லிருந்து ${foodItemName}, ${cDate} அன்று ${timeDisplay} மணிக்கு. அட்டவணைப்படுத்தவா?`;
  }

  if (lang === 'hi') {
    if (repeatType === 'weekly' && days && days.length > 0) {
      const locDays = days.map(d => DAY_NAMES_LOCALIZED.hi[d] || d).join(' और ');
      return `${restaurant} से ${foodItemName}, हर ${locDays} को ${timeDisplay} बजे। क्या मैं इसे शेड्यूल करूँ?`;
    }
    if (repeatType === 'monthly') {
      const d = dayOfMonth || 1;
      return `${restaurant} से ${foodItemName}, हर महीने की ${d} तारीख को ${timeDisplay} बजे। क्या मैं इसे शेड्यूल करूँ?`;
    }
    const cDate = customDate || 'तारीख';
    return `${restaurant} से ${foodItemName}, ${cDate} को ${timeDisplay} बजे। क्या मैं इसे शेड्यूल करूँ?`;
  }

  // English default
  if (repeatType === 'weekly' && days && days.length > 0) {
    const formattedDays = days.length > 1
      ? `${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}`
      : days[0];
    return `${foodItemName} from ${restaurant}, every ${formattedDays} at ${timeDisplay}. Shall I schedule it?`;
  }
  if (repeatType === 'monthly') {
    const d = dayOfMonth || 1;
    const suffix = d === 1 || d === 21 || d === 31 ? 'st' : d === 2 || d === 22 ? 'nd' : d === 3 || d === 23 ? 'rd' : 'th';
    return `${foodItemName} from ${restaurant}, on the ${d}${suffix} of every month at ${timeDisplay}. Shall I schedule it?`;
  }
  const cDate = customDate || 'scheduled date';
  return `${foodItemName} from ${restaurant}, on ${cDate} at ${timeDisplay}. Shall I schedule it?`;
}

// ─── 7. parseChangeTarget ───────────────────────────────────────────────────

export function parseChangeTarget(text: string): 'time' | 'repeat' | 'days' | 'restaurant' | null {
  const norm = normalizeInput(text);
  if (!norm) return null;

  if (
    containsWord(norm, 'time') || containsWord(norm, 'நேரம்') ||
    containsWord(norm, 'samay') || containsWord(norm, 'समय') || containsWord(norm, 'waqt')
  ) {
    return 'time';
  }

  if (
    containsWord(norm, 'repeat') || containsWord(norm, 'frequency') ||
    containsWord(norm, 'வகை') || containsWord(norm, 'மாதாந்திர') || containsWord(norm, 'வாராந்திர') ||
    containsWord(norm, 'prakar') || containsWord(norm, 'प्रकार')
  ) {
    return 'repeat';
  }

  if (
    containsWord(norm, 'day') || containsWord(norm, 'days') || containsWord(norm, 'date') ||
    containsWord(norm, 'நாள்') || containsWord(norm, 'நாட்கள்') || containsWord(norm, 'தேதி') ||
    containsWord(norm, 'din') || containsWord(norm, 'दिन') || containsWord(norm, 'tareekh') || containsWord(norm, 'तारीख')
  ) {
    return 'days';
  }

  if (
    containsWord(norm, 'restaurant') || containsWord(norm, 'hotel') ||
    containsWord(norm, 'உணவகம்') || containsWord(norm, 'ஹோட்டல்') ||
    containsWord(norm, 'रेस्तरां') || containsWord(norm, 'होटल')
  ) {
    return 'restaurant';
  }

  return null;
}
