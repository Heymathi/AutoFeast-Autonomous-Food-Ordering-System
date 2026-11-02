/**
 * Tanglish Normalization Service for AutoFeast AI
 *
 * Normalizes colloquial, spoken Tanglish (Tamil written in English/Latin script)
 * into structured tokens for the VoiceCommandParser and FuzzyMatchEngine.
 */

export interface TanglishNormalizedResult {
  original: string;
  normalized: string;
  isTanglish: boolean;
  detectedIntent?: 'order' | 'schedule' | 'add_to_cart' | 'search';
  quantity?: number;
  timeRaw?: string;
  time24?: string;
  dateStr?: 'today' | 'tomorrow' | 'yesterday';
  weekdays?: string[];
  foodCandidate?: string;
}

export class TanglishNormalizer {
  // Key Tanglish vocabulary patterns
  private static TANGLISH_MARKERS = [
    /\b(naalaiku|nalaiku|naalaiki|nalaki|inniku|innaiku|innaiki|iniku|nethu|netru)\b/i,
    /\b(rendu|rendo|moonu|monu|oru|onnu|naalu|anju)\b/i,
    /\b(maniku|mani\s*ku|kaalaila|kalaila|kaalai|madhiyam|mathiyam|mathiyanam|madhiyanam|saayangaalam|saayankalam|sayankalam|sayantharam|raathiri|iravu)\b/i,
    /\b(order\s*pannu|order\s*podu|add\s*pannu|cart\s*la|schedule\s*pannu|venum|vaenum|thevai|enakku)\b/i
  ];

  /**
   * Check whether input text contains distinctive Tanglish markers
   */
  public static isTanglish(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    return this.TANGLISH_MARKERS.some(regex => regex.test(text));
  }

  /**
   * Normalize Tanglish text while preserving food terms and intent
   */
  public static normalize(text: string): TanglishNormalizedResult {
    const original = (text || '').trim();
    if (!original) {
      return { original: '', normalized: '', isTanglish: false };
    }

    const isTanglishDetected = this.isTanglish(original);
    let norm = original.toLowerCase();

    // 1. Normalize Date Spoken Variants
    let dateStr: 'today' | 'tomorrow' | 'yesterday' | undefined;
    if (/\b(naalaiku|nalaiku|naalaiki|nalaki|naalai)\b/i.test(norm)) {
      dateStr = 'tomorrow';
      norm = norm.replace(/\b(naalaiku|nalaiku|naalaiki|nalaki|naalai)\b/gi, 'tomorrow');
    } else if (/\b(inniku|innaiku|innaiki|iniku|indru)\b/i.test(norm)) {
      dateStr = 'today';
      norm = norm.replace(/\b(inniku|innaiku|innaiki|iniku|indru)\b/gi, 'today');
    } else if (/\b(nethu|netru)\b/i.test(norm)) {
      dateStr = 'yesterday';
      norm = norm.replace(/\b(nethu|netru)\b/gi, 'yesterday');
    }

    // 2. Normalize Spoken Number / Quantity Words (only if NOT followed by mani/maniku/baje)
    let quantity: number | undefined;
    if (/\b(rendu|rendo|erandu|irandu)(?!\s*mani(?:ku|\s*ku)?)\b/i.test(norm)) {
      quantity = 2;
      norm = norm.replace(/\b(rendu|rendo|erandu|irandu)(?!\s*mani(?:ku|\s*ku)?)\b/gi, '2');
    } else if (/\b(moonu|monu|moondru)(?!\s*mani(?:ku|\s*ku)?)\b/i.test(norm)) {
      quantity = 3;
      norm = norm.replace(/\b(moonu|monu|moondru)(?!\s*mani(?:ku|\s*ku)?)\b/gi, '3');
    } else if (/\b(naalu|naangu)(?!\s*mani(?:ku|\s*ku)?)\b/i.test(norm)) {
      quantity = 4;
      norm = norm.replace(/\b(naalu|naangu)(?!\s*mani(?:ku|\s*ku)?)\b/gi, '4');
    } else if (/\b(anju|ainthu)(?!\s*mani(?:ku|\s*ku)?)\b/i.test(norm)) {
      quantity = 5;
      norm = norm.replace(/\b(anju|ainthu)(?!\s*mani(?:ku|\s*ku)?)\b/gi, '5');
    } else if (/\b(oru|onnu|onru)(?!\s*mani(?:ku|\s*ku)?)\b/i.test(norm)) {
      quantity = 1;
      norm = norm.replace(/\b(oru|onnu|onru)(?!\s*mani(?:ku|\s*ku)?)\b/gi, '1');
    }

    // 3. Normalize Time Slots & Meal Periods
    // "afternoon one mani ku" -> "1:00 PM"
    // "night 8 mani ku" -> "8:00 PM"
    // "morning 9 mani ku" -> "9:00 AM"
    // "evening six thirty ku" -> "6:30 PM"
    let time24: string | undefined;
    let timeRaw: string | undefined;

    // Detect period markers
    const hasMorning = /\b(morning|kaalaila|kalaila|kaalai|kaalaiyil)\b/i.test(norm);
    const hasAfternoon = /\b(afternoon|madhiyam|mathiyam|mathiyanam|madhiyanam)\b/i.test(norm);
    const hasEvening = /\b(evening|saayangaalam|saayankalam|sayankalam|saayankaalam|sayankaalam|sayantharam|sayangalam|maalaile)\b/i.test(norm);
    const hasNight = /\b(night|raathiri|rathiri|iravu)\b/i.test(norm);
    const isPmSlot = hasAfternoon || hasEvening || hasNight;

    // Pattern A: e.g. "six thirty ku", "8:30 ku"
    const sixThirtyMatch = norm.match(/\b(six\s*thirty|6\s*30|6\s*:\s*30)\s*(?:mani\s*)?ku\b/i);
    if (sixThirtyMatch) {
      timeRaw = sixThirtyMatch[0];
      const hour = isPmSlot || hasEvening ? 18 : 6;
      time24 = `${hour}:30`;
      norm = norm.replace(sixThirtyMatch[0], `${time24} `);
    }

    // Pattern B: e.g. "one mani ku", "1 mani ku", "8 mani ku", "rendu mani ku", "moonu mani ku"
    const maniKuMatch = norm.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|oru|onnu|rendu|rendo|moonu|naalu|anju|aaru|ezhu|ettu|onbadhu|onpadhu|pathu|padhinonnu|pannirandu)\s*mani(?:\s*ku)?\b/i);
    if (maniKuMatch && !time24) {
      timeRaw = maniKuMatch[0];
      let h = parseInt(maniKuMatch[1], 10);
      if (isNaN(h)) {
        const wordMap: Record<string, number> = {
          one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
          seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
          oru: 1, onnu: 1, rendu: 2, rendo: 2, moonu: 3, naalu: 4, anju: 5,
          aaru: 6, ezhu: 7, ettu: 8, onbadhu: 9, onpadhu: 9, pathu: 10,
          padhinonnu: 11, pannirandu: 12
        };
        h = wordMap[maniKuMatch[1].toLowerCase()] || 8;
      }

      if ((isPmSlot || (h >= 1 && h <= 6)) && !hasMorning && h < 12) {
        h += 12;
      } else if (hasMorning && h === 12) {
        h = 0;
      }
      time24 = `${String(h).padStart(2, '0')}:00`;
      norm = norm.replace(maniKuMatch[0], `${time24} `);
    }

    // Pattern C: "1 PM ku" / "1:00 PM ku"
    const pmKuMatch = norm.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*ku\b/i);
    if (pmKuMatch && !time24) {
      timeRaw = pmKuMatch[0];
      let h = parseInt(pmKuMatch[1], 10);
      const m = pmKuMatch[2] ? parseInt(pmKuMatch[2], 10) : 0;
      const ampm = pmKuMatch[3].toLowerCase();
      if (ampm === 'pm' && h < 12) h += 12;
      if (ampm === 'am' && h === 12) h = 0;
      time24 = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      norm = norm.replace(pmKuMatch[0], `${time24} `);
    }

    // 4. Normalize Spoken Action / Intent Markers
    let detectedIntent: 'order' | 'schedule' | 'add_to_cart' | 'search' | undefined;

    if (/\b(cart\s*la\s*add\s*pannu|cart\s*la\s*podu|cart\s*la)\b/i.test(norm)) {
      detectedIntent = 'add_to_cart';
      norm = norm.replace(/\b(cart\s*la\s*add\s*pannu|cart\s*la\s*podu|cart\s*la)\b/gi, 'add to cart');
    } else if (/\b(add\s*pannu)\b/i.test(norm)) {
      detectedIntent = 'add_to_cart';
      norm = norm.replace(/\b(add\s*pannu)\b/gi, 'add to cart');
    } else if (/\b(schedule\s*pannu|thittamidu)\b/i.test(norm)) {
      detectedIntent = 'schedule';
      norm = norm.replace(/\b(schedule\s*pannu|thittamidu)\b/gi, 'schedule');
    } else if (/\b(order\s*pannu|order\s*podu|order\s*panunga|order\s*pannanum)\b/i.test(norm)) {
      // If a specific scheduled date/time is given, mark schedule, else order
      detectedIntent = (dateStr === 'tomorrow' || time24) ? 'schedule' : 'order';
      norm = norm.replace(/\b(order\s*pannu|order\s*podu|order\s*panunga|order\s*pannanum)\b/gi, 'order');
    } else if (/\b(venum|vaenum|thevai)\b/i.test(norm)) {
      detectedIntent = 'order';
      norm = norm.replace(/\b(venum|vaenum|thevai)\b/gi, 'want');
    }

    // Clean common polite/pronoun fillers
    norm = norm.replace(/\b(enakku|konjam|nu|la)\b/gi, ' ');
    norm = norm.replace(/\s+/g, ' ').trim();

    return {
      original,
      normalized: norm,
      isTanglish: isTanglishDetected,
      detectedIntent,
      quantity,
      timeRaw,
      time24,
      dateStr
    };
  }
}
