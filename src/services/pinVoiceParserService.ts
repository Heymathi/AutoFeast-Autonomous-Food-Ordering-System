/**
 * Language-Agnostic PIN Voice Parser Service
 * Converts spoken PIN digits across English, Tamil, Hindi, Tanglish, Hinglish,
 * Devanagari/Tamil numerals, and cross-script transliterations into 4 numeric digits.
 */

import { FuzzyMatchEngine } from './fuzzyMatchService';

export interface ParsePinSpeechResult {
  digits: string[];
  status: 'success' | 'need_more' | 'too_many' | 'no_speech' | 'command' | 'requires_each_digit';
  command?: 'clear' | 'back' | 'cancel';
  errorMessage?: string;
}

// Dictionary mapping words, transliterations, and native scripts to single-digit strings '0'-'9'
const PIN_DIGIT_MAP: Record<string, string> = {
  // Digit 0
  '0': '0',
  'zero': '0',
  'oh': '0',
  'o': '0',
  'nought': '0',
  'null': '0',
  'poojyam': '0',
  'pujyam': '0',
  'suzhiyam': '0',
  'sujiyam': '0',
  'shunya': '0',
  'shoonya': '0',
  'shunyam': '0',
  'பூஜ்யம்': '0',
  'சுழியம்': '0',
  'பூஜியம்': '0',
  'ஜீரோ': '0',
  'சீரோ': '0',
  'शून्य': '0',
  'शुन्य': '0',
  'ज़ीरो': '0',
  'जीरो': '0',

  // Digit 1
  '1': '1',
  'one': '1',
  'won': '1',
  '1st': '1',
  'onnu': '1',
  'ondru': '1',
  'onru': '1',
  'oru': '1',
  'ek': '1',
  'aik': '1',
  'ஒன்று': '1',
  'ஒன்னு': '1',
  'ஒரு': '1',
  'ஒன்': '1',
  'एक': '1',
  'वन': '1',

  // Digit 2
  '2': '2',
  'two': '2',
  'to': '2',
  'too': '2',
  '2nd': '2',
  'rendu': '2',
  'randu': '2',
  'irandoo': '2',
  'irandu': '2',
  'do': '2',
  'doo': '2',
  'இரண்டு': '2',
  'ரெண்டு': '2',
  'டூ': '2',
  'दो': '2',
  'टू': '2',
  'टु': '2',

  // Digit 3
  '3': '3',
  'three': '3',
  'tree': '3',
  '3rd': '3',
  'moonu': '3',
  'moondru': '3',
  'moonru': '3',
  'munu': '3',
  'teen': '3',
  'tin': '3',
  'மூன்று': '3',
  'மூணு': '3',
  'த்ரீ': '3',
  'திரீ': '3',
  'तीन': '3',
  'थ्री': '3',
  'थरी': '3',

  // Digit 4
  '4': '4',
  'four': '4',
  'for': '4',
  'fore': '4',
  '4th': '4',
  'naalu': '4',
  'naangu': '4',
  'nalu': '4',
  'char': '4',
  'chaar': '4',
  'நான்கு': '4',
  'நாளு': '4',
  'நாலு': '4',
  'போர்': '4',
  'ஃபோர்': '4',
  'चार': '4',
  'फोर': '4',
  'फ़ोर': '4',

  // Digit 5
  '5': '5',
  'five': '5',
  'hive': '5',
  '5th': '5',
  'anju': '5',
  'ainthu': '5',
  'paanch': '5',
  'panch': '5',
  'paach': '5',
  'ஐந்து': '5',
  'அஞ்சு': '5',
  'ஃபைவ்': '5',
  'பைவ்': '5',
  'पाँच': '5',
  'पांच': '5',
  'फाइव': '5',
  'फ़ाइव': '5',

  // Digit 6
  '6': '6',
  'six': '6',
  '6th': '6',
  'aaru': '6',
  'aru': '6',
  'chhe': '6',
  'chhah': '6',
  'che': '6',
  'ஆறு': '6',
  'சிக்ஸ்': '6',
  'छह': '6',
  'छः': '6',
  'सिक्स': '6',

  // Digit 7
  '7': '7',
  'seven': '7',
  '7th': '7',
  'ezhu': '7',
  'yelu': '7',
  'elu': '7',
  'saat': '7',
  'sat': '7',
  'ஏழு': '7',
  'செவன்': '7',
  'सात': '7',
  'सेवन': '7',

  // Digit 8
  '8': '8',
  'eight': '8',
  'ate': '8',
  '8th': '8',
  'ettu': '8',
  'aath': '8',
  'ath': '8',
  'எட்டு': '8',
  'எய்ட்': '8',
  'आठ': '8',
  'एट': '8',

  // Digit 9
  '9': '9',
  'nine': '9',
  '9th': '9',
  'onbadhu': '9',
  'onpathu': '9',
  'ombodhu': '9',
  'nau': '9',
  'now': '9',
  'ஒன்பது': '9',
  'நைன்': '9',
  'नौ': '9',
  'नाइन': '9'
};

const COMMAND_MAP: Record<string, 'clear' | 'back' | 'cancel'> = {
  'clear': 'clear',
  'அழி': 'clear',
  'அழிக்கவும்': 'clear',
  'मिटाओ': 'clear',
  'मिटाएं': 'clear',
  'हटाओ': 'clear',

  'back': 'back',
  'பின்': 'back',
  'பின்னாடி': 'back',
  'पीछे': 'back',
  'वापस': 'back',

  'cancel': 'cancel',
  'ரத்து': 'cancel',
  'ரத்துசெய்': 'cancel',
  'रद्द': 'cancel',
  'रद्दकरें': 'cancel'
};

const UNSUPPORTED_COUNT_WORDS = [
  'double', 'triple', 'டபுள்', 'ட்ரிபிள்', 'डबल', 'ट्रिपल'
];

/**
 * Converts Indic script numerals (Tamil, Devanagari) into standard ASCII '0'-'9'
 */
function normalizeIndicNumerals(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // Tamil numerals ௧-௯ (0x0BE7-0x0BEF) & ௦ (0x0BE6)
    if (code >= 0x0BE6 && code <= 0x0BEF) {
      result += (code - 0x0BE6).toString();
    }
    // Devanagari numerals ०-९ (0x0966-0x096F)
    else if (code >= 0x0966 && code <= 0x096F) {
      result += (code - 0x0966).toString();
    } else {
      result += text[i];
    }
  }
  return result;
}

/**
 * Language-Agnostic PIN Voice Parser
 * Accepts spoken PIN digits in English, Tamil, Hindi, Tanglish, Hinglish, Indic numerals,
 * and cross-script transliterations. Returns structured result.
 */
export function parsePinSpeech(rawText: string, _lang?: string): ParsePinSpeechResult {
  if (!rawText || !rawText.trim()) {
    return { digits: [], status: 'no_speech' };
  }

  // 1. Normalize Unicode and Indic numerals first
  const indicNormalized = normalizeIndicNumerals(rawText.trim());

  // 2. Lowercase and strip punctuation except spaces
  const cleanText = indicNormalized
    .toLowerCase()
    .replace(/[\-,\.!\?\/:;"'\(\)\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanText) {
    return { digits: [], status: 'no_speech' };
  }

  // 3. Check for unsupported count phrases ("double", "triple")
  for (const word of UNSUPPORTED_COUNT_WORDS) {
    if (cleanText.includes(word)) {
      return {
        digits: [],
        status: 'requires_each_digit',
        errorMessage: 'Please say each digit one by one.'
      };
    }
  }

  // 4. Check for voice commands
  const words = cleanText.split(' ').filter(w => w.length > 0);
  for (const word of words) {
    if (COMMAND_MAP[word]) {
      return {
        digits: [],
        status: 'command',
        command: COMMAND_MAP[word]
      };
    }
  }

  // 5. Extract PIN digits token by token
  const extractedDigits: string[] = [];

  for (const word of words) {
    // 5a. If token is pure ASCII numeric string (e.g. "1234", "12", "1")
    if (/^\d+$/.test(word)) {
      for (const char of word) {
        extractedDigits.push(char);
      }
      continue;
    }

    // 5b. Direct dictionary lookup
    if (PIN_DIGIT_MAP[word] !== undefined) {
      extractedDigits.push(PIN_DIGIT_MAP[word]);
      continue;
    }

    // 5c. Token contains mixed digits and text (e.g., "1rendu" -> "1" and "rendu")
    if (/\d/.test(word)) {
      let currentSub = '';
      for (let i = 0; i < word.length; i++) {
        const char = word[i];
        if (/\d/.test(char)) {
          if (currentSub) {
            if (PIN_DIGIT_MAP[currentSub] !== undefined) {
              extractedDigits.push(PIN_DIGIT_MAP[currentSub]);
            }
            currentSub = '';
          }
          extractedDigits.push(char);
        } else {
          currentSub += char;
        }
      }
      if (currentSub && PIN_DIGIT_MAP[currentSub] !== undefined) {
        extractedDigits.push(PIN_DIGIT_MAP[currentSub]);
      }
      continue;
    }

    // 5d. High-confidence fuzzy matching (similarity >= 0.85) against dictionary keys
    let bestMatchDigit: string | null = null;
    let maxSimilarity = 0;

    for (const key of Object.keys(PIN_DIGIT_MAP)) {
      // Ignore single character keys for fuzzy matching
      if (key.length <= 1) continue;

      const distance = FuzzyMatchEngine.damerauLevenshteinDistance(word, key);
      const similarity = 1 - distance / Math.max(word.length, key.length);

      if (similarity >= 0.85 && similarity > maxSimilarity) {
        maxSimilarity = similarity;
        bestMatchDigit = PIN_DIGIT_MAP[key];
      }
    }

    if (bestMatchDigit !== null) {
      extractedDigits.push(bestMatchDigit);
    }
  }

  // 6. Evaluate extracted digits length
  if (extractedDigits.length === 0) {
    return { digits: [], status: 'no_speech' };
  }

  if (extractedDigits.length === 4) {
    return {
      digits: extractedDigits,
      status: 'success'
    };
  }

  if (extractedDigits.length > 4) {
    return {
      digits: [],
      status: 'too_many',
      errorMessage: 'Too many digits. Please say again.'
    };
  }

  // 1 to 3 digits
  return {
    digits: extractedDigits,
    status: 'need_more'
  };
}
