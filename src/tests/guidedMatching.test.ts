import { describe, it, expect } from 'vitest';
import {
  matchOptionByTokens,
  classifyOrderNowOrSchedule,
  extractDistinctiveTokens,
  tokensMatch
} from '../services/guidedMatchingService';
import { parseSpokenTimeTo24Hr } from '../services/timeVoiceParser';

describe('guidedMatchingService - Token and Distinctive Matching', () => {
  const biryaniOptions = [
    {
      id: 'biryani-hyderabadi',
      name: 'Hyderabadi Chicken Dum Biryani',
      nativeNames: {
        en: 'Hyderabadi Chicken Dum Biryani',
        ta: 'ஹைதராபாதி சிக்கன் தம் பிரியாணி',
        hi: 'हैदराबादी चिकन दम बिरयानी'
      }
    },
    {
      id: 'biryani-ambur',
      name: 'Ambur Mutton Biryani',
      nativeNames: {
        en: 'Ambur Mutton Biryani',
        ta: 'ஆம்பூர் மட்டன் பிரியாணி',
        hi: 'अंबुर मटन बिरयानी'
      }
    },
    {
      id: 'biryani-paneer',
      name: 'Special Paneer Veg Biryani',
      nativeNames: {
        en: 'Special Paneer Veg Biryani',
        ta: 'ஸ்பெஷல் பன்னீர் வெஜ் பிரியாணி',
        hi: 'स्पेशल पनीर वेज बिरयानी'
      }
    }
  ];

  it('correctly extracts distinctive tokens and ignores family word "biryani"', () => {
    const ext = extractDistinctiveTokens('mutton biryani');
    expect(ext.tokens).toEqual(['mutton']);
    expect(ext.hasFamilyWordOnly).toBe(false);

    const familyOnly = extractDistinctiveTokens('biryani');
    expect(familyOnly.hasFamilyWordOnly).toBe(true);
    expect(familyOnly.tokens).toEqual([]);
  });

  it('matches "mutton biryani" to Ambur Mutton Biryani', () => {
    const res = matchOptionByTokens('mutton biryani', biryaniOptions, 'en');
    expect(res.chosen).not.toBeNull();
    expect(res.chosen?.name).toBe('Ambur Mutton Biryani');
    expect(res.score).toBeGreaterThanOrEqual(0.6);
  });

  it('matches "ambur mutton" to Ambur Mutton Biryani', () => {
    const res = matchOptionByTokens('ambur mutton', biryaniOptions, 'en');
    expect(res.chosen).not.toBeNull();
    expect(res.chosen?.name).toBe('Ambur Mutton Biryani');
  });

  it('matches ordinal "second one" to Ambur Mutton Biryani', () => {
    const res = matchOptionByTokens('second one', biryaniOptions, 'en');
    expect(res.chosen).not.toBeNull();
    expect(res.chosen?.name).toBe('Ambur Mutton Biryani');
    expect(res.score).toBe(1.0);
  });

  it('matches Tamil "மட்டன் பிரியாணி" to Ambur Mutton Biryani', () => {
    const res = matchOptionByTokens('மட்டன் பிரியாணி', biryaniOptions, 'ta');
    expect(res.chosen).not.toBeNull();
    expect(res.chosen?.name).toBe('Ambur Mutton Biryani');
    expect(res.score).toBeGreaterThanOrEqual(0.6);
  });

  it('matches Hindi "मटन बिरयानी" to Ambur Mutton Biryani', () => {
    const res = matchOptionByTokens('मटन बिरयानी', biryaniOptions, 'hi');
    expect(res.chosen).not.toBeNull();
    expect(res.chosen?.name).toBe('Ambur Mutton Biryani');
    expect(res.score).toBeGreaterThanOrEqual(0.6);
  });

  it('identifies when ONLY family word is spoken (e.g. "biryani")', () => {
    const res = matchOptionByTokens('biryani', biryaniOptions, 'en');
    expect(res.chosen).toBeNull();
    expect(res.isOnlyFamilyWord).toBe(true);
  });

  describe('Restaurant Matching with the same function', () => {
    const restaurantOptions = [
      'Bawarchi Biryani',
      'Star Ambur Biryani',
      'Saravana Bhavan'
    ];

    it('matches "star ambur" to Star Ambur Biryani', () => {
      const res = matchOptionByTokens('star ambur', restaurantOptions, 'en');
      expect(res.chosen).toBe('Star Ambur Biryani');
    });

    it('matches "bawarchi" to Bawarchi Biryani', () => {
      const res = matchOptionByTokens('bawarchi', restaurantOptions, 'en');
      expect(res.chosen).toBe('Bawarchi Biryani');
    });
  });

  describe('Order Now / Schedule Classification', () => {
    it('classifies "now", "இப்போதே", "abhi" as NOW', () => {
      expect(classifyOrderNowOrSchedule('now')).toBe('NOW');
      expect(classifyOrderNowOrSchedule('order now')).toBe('NOW');
      expect(classifyOrderNowOrSchedule('இப்போதே')).toBe('NOW');
      expect(classifyOrderNowOrSchedule('abhi')).toBe('NOW');
      expect(classifyOrderNowOrSchedule('abhi karo')).toBe('NOW');
    });

    it('classifies "later", "schedule", "பிறகு", "बाद में" as SCHEDULE', () => {
      expect(classifyOrderNowOrSchedule('later')).toBe('SCHEDULE');
      expect(classifyOrderNowOrSchedule('schedule')).toBe('SCHEDULE');
      expect(classifyOrderNowOrSchedule('பிறகு')).toBe('SCHEDULE');
      expect(classifyOrderNowOrSchedule('அட்டவணை')).toBe('SCHEDULE');
      expect(classifyOrderNowOrSchedule('बाद में')).toBe('SCHEDULE');
    });

    it('classifies noise/silence as UNKNOWN', () => {
      expect(classifyOrderNowOrSchedule('random gibberish 123')).toBe('UNKNOWN');
      expect(classifyOrderNowOrSchedule('')).toBe('UNKNOWN');
    });
  });

  describe('Spoken Time Parsing', () => {
    it('parses "8 AM", "காலை 8 மணி", "subah 8 baje"', () => {
      expect(parseSpokenTimeTo24Hr('8 AM')?.time24).toBe('08:00');
      expect(parseSpokenTimeTo24Hr('காலை 8 மணி')?.time24).toBe('08:00');
      expect(parseSpokenTimeTo24Hr('subah 8 baje')?.time24).toBe('08:00');
    });
  });
});

