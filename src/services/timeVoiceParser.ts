/**
 * timeVoiceParser.ts
 * Pure function multilingual spoken time parser for English, Tamil, and Hindi.
 * Supports:
 * - Digits: "8 AM", "8:30", "20:00"
 * - English word numbers: "eight", "eight thirty", "seven fifteen"
 * - Tamil word numbers & script: "எட்டு மணி", "காலை 8 மணி", "இரவு 8:30", "எட்டு முக்கால்"
 * - Tamil transliterations: "kaalai 8 mani", "iravu 8 mani"
 * - Hindi word numbers & script: "सुबह 8 बजे", "शाम 6 बजे", "दोपहर 1 बजे", "आठ बजे"
 * - Hindi transliterations: "subah 8 baje", "shaam 6 baje", "dopahar 1 baje"
 * - Half/Quarter keywords: "half past", "quarter past", "quarter to", "அரை", "கால்", "முக்கால்", "साढ़े", "सवा", "पौने"
 * - Meal slot derivation: Breakfast, Lunch, Snack, Dinner
 */

export interface ParsedSpokenTime {
  time24: string;
  time12Formatted: string;
  hours: number;
  minutes: number;
  mealSlot: 'Breakfast' | 'Lunch' | 'Snack' | 'Dinner';
}

export function deriveMealSlot(hours: number): 'Breakfast' | 'Lunch' | 'Snack' | 'Dinner' {
  if (hours >= 5 && hours < 12) return 'Breakfast';
  if (hours >= 12 && hours < 16) return 'Lunch';
  if (hours >= 16 && hours < 19) return 'Snack';
  return 'Dinner';
}

export function parseSpokenTimeTo24Hr(text: string): ParsedSpokenTime | null {
  if (!text || typeof text !== 'string') return null;

  const raw = text.toLowerCase().replace(/[,.!?;:()"'~`]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!raw) return null;

  let isPM = false;
  let isAM = false;

  // 1. Detect AM / PM / Time of day (Script & Transliterations)
  const amKeywords = [
    'am', 'morning', 'breakfast',
    // Tamil
    'காலை', 'விடியற்காலை', 'kaalai', 'vidiyarkalai',
    // Hindi
    'सुबह', 'प्रातः', 'भोर', 'subah', 'pratah', 'bhor'
  ];

  const pmKeywords = [
    'pm', 'afternoon', 'evening', 'night', 'dinner', 'lunch', 'snacks',
    // Tamil
    'மதியம்', 'பிற்பகல்', 'மாலை', 'இரவு', 'mathiyam', 'madhiyam', 'maalai', 'iravu', 'raathiri',
    // Hindi
    'दोपहर', 'शाम', 'रात', 'संध्या', 'रात्रि', 'dopahar', 'dopehar', 'shaam', 'sham', 'raat', 'sanjh'
  ];

  for (const kw of pmKeywords) {
    if (` ${raw} `.includes(` ${kw} `) || raw.includes(kw)) {
      isPM = true;
      break;
    }
  }

  for (const kw of amKeywords) {
    if (` ${raw} `.includes(` ${kw} `) || raw.includes(kw)) {
      isAM = true;
      break;
    }
  }

  // If both flagged (e.g. "morning snacks"), AM takes precedence if morning keyword explicitly matches
  if (isAM && (raw.includes('morning') || raw.includes('காலை') || raw.includes('kaalai') || raw.includes('सुबह') || raw.includes('subah'))) {
    isPM = false;
  }

  // 2. Named Meals Fast Path (if no numbers at all)
  const namedSlots: Array<{ words: string[]; time24: string; slot: 'Breakfast' | 'Lunch' | 'Snack' | 'Dinner' }> = [
    { words: ['breakfast', 'காலை உணவு', 'tiffin', 'नाश्ता', 'subah ka khana'], time24: '08:00', slot: 'Breakfast' },
    { words: ['lunch', 'மதிய உணவு', 'दोपहर का खाना', 'noon'], time24: '12:30', slot: 'Lunch' },
    { words: ['snacks', 'tea time', 'சிற்றுண்டி', 'शाम का नाश्ता', 'chai'], time24: '16:30', slot: 'Snack' },
    { words: ['dinner', 'இரவு உணவு', 'रात का खाना', 'supper'], time24: '20:00', slot: 'Dinner' }
  ];

  const slotMatch = namedSlots.find(s => s.words.some(w => ` ${raw} `.includes(` ${w} `)));
  if (slotMatch && !/\d/.test(raw) && !containsNumberWords(raw)) {
    const [h, m] = slotMatch.time24.split(':').map(Number);
    const displayHours = h % 12 || 12;
    const ampm = h >= 12 ? 'PM' : 'AM';
    return {
      time24: slotMatch.time24,
      time12Formatted: `${displayHours}:${String(m).padStart(2, '0')} ${ampm}`,
      hours: h,
      minutes: m,
      mealSlot: slotMatch.slot
    };
  }

  let hours = -1;
  let minutes = 0;

  // 3. Half / Quarter modifiers (use whole-word check so 'kaalai' is not misread as 'kaal')
  const hasWholeWord = (str: string, word: string) => new RegExp(`(^|\\s)${word}($|\\s)`).test(str);

  if (raw.includes('half past') || raw.includes('அரை') || hasWholeWord(raw, 'arai') || raw.includes('साढ़े') || hasWholeWord(raw, 'sadhe') || hasWholeWord(raw, 'saade')) {
    minutes = 30;
  } else if (raw.includes('quarter past') || raw.includes('கால்') || hasWholeWord(raw, 'kaal') || raw.includes('सवा') || hasWholeWord(raw, 'sawa') || hasWholeWord(raw, 'quarter')) {
    minutes = 15;
  } else if (raw.includes('quarter to') || raw.includes('முக்கால்') || hasWholeWord(raw, 'mukkal') || raw.includes('पौने') || hasWholeWord(raw, 'paune')) {
    minutes = 45;
  }

  // 4. Digit Extraction (e.g. "8", "8:30", "8 30", "08:00")
  const colonMatch = raw.match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (colonMatch) {
    hours = parseInt(colonMatch[1], 10);
    minutes = parseInt(colonMatch[2], 10);
  } else {
    const digitTokens = raw.match(/\d+/g);
    if (digitTokens && digitTokens.length > 0) {
      hours = parseInt(digitTokens[0], 10);
      if (digitTokens.length > 1) {
        minutes = parseInt(digitTokens[1], 10);
      }
    }
  }

  // 5. Word-to-number mapping (English, Tamil, Hindi scripts and transliterations)
  if (hours < 0) {
    const wordNumMap: Record<string, number> = {
      // English
      'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6,
      'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'eleven': 11, 'twelve': 12,
      // Tamil Script
      'ஒன்று': 1, 'ஒன்னு': 1, 'இரண்டு': 2, 'ரெண்டு': 2, 'மூன்று': 3, 'மூணு': 3,
      'நான்கு': 4, 'நாலு': 4, 'ஐந்து': 5, 'அஞ்சு': 5, 'ஆறு': 6, 'ஏழு': 7,
      'எட்டு': 8, 'ஒன்பது': 9, 'பத்து': 10, 'பதினொன்று': 11, 'பனிரெண்டு': 12,
      // Tamil Transliteration
      'ondru': 1, 'onnu': 1, 'irandu': 2, 'rendu': 2, 'moondru': 3, 'moonu': 3,
      'naangu': 4, 'naalu': 4, 'aindhu': 5, 'anju': 5, 'aaru': 6, 'ezhu': 7,
      'ettu': 8, 'onbadhu': 9, 'patthu': 10, 'pathinondru': 11, 'pannirendu': 12,
      // Hindi Script
      'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5,
      'छह': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10, 'ग्यारह': 11, 'बारह': 12,
      // Hindi Transliteration
      'ek': 1, 'do': 2, 'teen': 3, 'chaar': 4, 'char': 4, 'paanch': 5, 'panch': 5,
      'chhe': 6, 'che': 6, 'saat': 7, 'aath': 8, 'ath': 8, 'nau': 9, 'das': 10,
      'gyarah': 11, 'baarah': 12, 'barah': 12
    };

    // Clean slot words first so words like 'do' in 'dopahar' or 'pat' in 'pathinondru' don't false match
    const cleanWords = raw.replace(/\b(dopahar|dopehar|subah|shaam|raat|kaalai|iravu|mathiyam|breakfast|lunch|dinner|snacks|baje|mani|manikku)\b/g, ' ');

    for (const [word, val] of Object.entries(wordNumMap)) {
      const regex = new RegExp(`(^|\\s)${word}($|\\s)`);
      if (regex.test(cleanWords)) {
        hours = val;
        break;
      }
    }
  }

  // 6. Minute Words (e.g. "eight thirty", "seven forty five", "six twenty")
  if (minutes === 0) {
    if (raw.includes('thirty') || raw.includes('முப்பது') || raw.includes('तीस') || raw.includes('tees')) {
      minutes = 30;
    } else if (raw.includes('fifteen') || raw.includes('பதினைந்து') || raw.includes('पंद्रह') || raw.includes('pandrah')) {
      minutes = 15;
    } else if (raw.includes('forty five') || raw.includes('நாற்பத்தைந்து') || raw.includes('पैंतालीस')) {
      minutes = 45;
    } else if (raw.includes('twenty') || raw.includes('இருபது') || raw.includes('बीस')) {
      minutes = 20;
    }
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  // 7. Adjust for 12-hour AM/PM
  if (isPM && hours < 12) {
    hours += 12;
  } else if (!isPM && !isAM) {
    // Contextual AM/PM inference:
    // Times 1 to 6 without explicit AM are typically afternoon/evening (e.g. "shaam 6 baje", or "dinner at 8")
    if (hours >= 1 && hours <= 6) {
      // 1 to 6 is PM (13:00 to 18:00) unless AM specified
      hours += 12;
    }
  } else if (isAM && hours === 12) {
    hours = 0;
  }

  const time24 = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  const displayHours = hours % 12 || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const time12Formatted = `${displayHours}:${String(minutes).padStart(2, '0')} ${ampm}`;
  const mealSlot = deriveMealSlot(hours);

  return { time24, time12Formatted, hours, minutes, mealSlot };
}

function containsNumberWords(text: string): boolean {
  const numberKeywords = [
    'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
    'ஒன்று', 'இரண்டு', 'மூன்று', 'நான்கு', 'ஐந்து', 'ஆறு', 'ஏழு', 'எட்டு', 'ஒன்பது', 'பத்து',
    'एक', 'दो', 'तीन', 'चार', 'पांच', 'छह', 'सात', 'आठ', 'नौ', 'दस'
  ];
  return numberKeywords.some(w => ` ${text} `.includes(` ${w} `));
}
