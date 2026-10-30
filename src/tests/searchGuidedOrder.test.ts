import { describe, it, expect } from 'vitest';
import { parseSpokenTimeTo24Hr, deriveMealSlot } from '../services/timeVoiceParser';
import { SttMatcherService } from '../services/sttMatcherService';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';

describe('Search Guided Order Dialog Logic', () => {
  describe('Step 1: Variety Selection (English, Tamil, Hindi)', () => {
    const dosaVarieties = INDIAN_FOOD_CATALOG.filter(item =>
      item.name.toLowerCase().includes('dosa') || (item.category && item.category.toLowerCase().includes('dosa'))
    );

    it('matches variety by full/partial English name', () => {
      const match = SttMatcherService.matchFoodItem(['masala dosa'], dosaVarieties, 'en');
      expect(match).not.toBeNull();
      expect(match?.name.toLowerCase()).toContain('masala dosa');
    });

    it('matches variety by Tamil script and transliteration', () => {
      const matchTamil = SttMatcherService.matchFoodItem(['மசாலா தோசை'], dosaVarieties, 'ta');
      expect(matchTamil).not.toBeNull();
      expect(matchTamil?.name.toLowerCase()).toContain('masala dosa');

      const matchGheePodi = SttMatcherService.matchFoodItem(['நெய் பொடி தோசை'], dosaVarieties, 'ta');
      expect(matchGheePodi).not.toBeNull();
      expect(matchGheePodi?.name.toLowerCase()).toContain('podi dosa');
    });

    it('matches variety by Hindi script and transliteration', () => {
      const matchHindi = SttMatcherService.matchFoodItem(['मसाला डोसा'], dosaVarieties, 'hi');
      expect(matchHindi).not.toBeNull();
      expect(matchHindi?.name.toLowerCase()).toContain('masala dosa');
    });
  });

  describe('Step 2: Restaurant Selection (English, Tamil, Hindi)', () => {
    const restaurants = ['Saravana Bhavan', 'Murugan Idli Shop', 'A2B Adyar Ananda Bhavan'];

    it('matches restaurant by ordinal in English (first, second, third)', () => {
      const r1 = SttMatcherService.matchRestaurantSelection(['first'], restaurants);
      expect(r1.isMatched).toBe(true);
      expect(r1.restaurant).toBe('Saravana Bhavan');

      const r2 = SttMatcherService.matchRestaurantSelection(['second option'], restaurants);
      expect(r2.isMatched).toBe(true);
      expect(r2.restaurant).toBe('Murugan Idli Shop');
    });

    it('matches restaurant by ordinal in Tamil (ஒன்று, இரண்டு, முதலாவது, ரெண்டாவது)', () => {
      const r1 = SttMatcherService.matchRestaurantSelection(['முதல்'], restaurants);
      expect(r1.isMatched).toBe(true);
      expect(r1.restaurant).toBe('Saravana Bhavan');

      const r2 = SttMatcherService.matchRestaurantSelection(['இரண்டாவது'], restaurants);
      expect(r2.isMatched).toBe(true);
      expect(r2.restaurant).toBe('Murugan Idli Shop');
    });

    it('matches restaurant by ordinal in Hindi (पहला, दूसरा, तीसरा, pehla)', () => {
      const r1 = SttMatcherService.matchRestaurantSelection(['पहला'], restaurants);
      expect(r1.isMatched).toBe(true);
      expect(r1.restaurant).toBe('Saravana Bhavan');

      const r2 = SttMatcherService.matchRestaurantSelection(['doosra'], restaurants);
      expect(r2.isMatched).toBe(true);
      expect(r2.restaurant).toBe('Murugan Idli Shop');
    });

    it('matches restaurant by name or transliteration in all languages', () => {
      const rEn = SttMatcherService.matchRestaurantSelection(['murugan idli'], restaurants);
      expect(rEn.isMatched).toBe(true);
      expect(rEn.restaurant).toBe('Murugan Idli Shop');

      const rTa = SttMatcherService.matchRestaurantSelection(['சரவண பவன்'], restaurants);
      expect(rTa.isMatched).toBe(true);
      expect(rTa.restaurant).toBe('Saravana Bhavan');

      const rHi = SttMatcherService.matchRestaurantSelection(['मुरुगन'], restaurants);
      expect(rHi.isMatched).toBe(true);
      expect(rHi.restaurant).toBe('Murugan Idli Shop');
    });

    it('single restaurant confirms with YES/NO in en, ta, hi', () => {
      expect(SttMatcherService.matchConfirmation(['yes'], 'en').matchedValue).toBe('YES');
      expect(SttMatcherService.matchConfirmation(['ஆம்'], 'ta').matchedValue).toBe('YES');
      expect(SttMatcherService.matchConfirmation(['हाँ'], 'hi').matchedValue).toBe('YES');

      expect(SttMatcherService.matchConfirmation(['no'], 'en').matchedValue).toBe('NO');
      expect(SttMatcherService.matchConfirmation(['வேண்டாம்'], 'ta').matchedValue).toBe('NO');
      expect(SttMatcherService.matchConfirmation(['नहीं'], 'hi').matchedValue).toBe('NO');

      // "No cancel" priority check
      expect(SttMatcherService.matchConfirmation(['no cancel'], 'en').matchedValue).toBe('NO');
    });
  });

  describe('Step 3: Spoken Time Parsing (English, Tamil, Hindi)', () => {
    it('parses English spoken times and derives meal slot', () => {
      const t1 = parseSpokenTimeTo24Hr('8 AM');
      expect(t1).not.toBeNull();
      expect(t1?.time24).toBe('08:00');
      expect(t1?.mealSlot).toBe('Breakfast');

      const t2 = parseSpokenTimeTo24Hr('eight thirty');
      expect(t2).not.toBeNull();
      expect(t2?.time24).toBe('08:30');
      expect(t2?.mealSlot).toBe('Breakfast');

      const t3 = parseSpokenTimeTo24Hr('1:30 PM');
      expect(t3).not.toBeNull();
      expect(t3?.time24).toBe('13:30');
      expect(t3?.mealSlot).toBe('Lunch');
    });

    it('parses Tamil spoken times and derives meal slot', () => {
      const t1 = parseSpokenTimeTo24Hr('காலை 8 மணி');
      expect(t1).not.toBeNull();
      expect(t1?.time24).toBe('08:00');
      expect(t1?.mealSlot).toBe('Breakfast');

      const t2 = parseSpokenTimeTo24Hr('இரவு 8:30');
      expect(t2).not.toBeNull();
      expect(t2?.time24).toBe('20:30');
      expect(t2?.mealSlot).toBe('Dinner');

      const t3 = parseSpokenTimeTo24Hr('kaalai 8 mani');
      expect(t3).not.toBeNull();
      expect(t3?.time24).toBe('08:00');
    });

    it('parses Hindi spoken times and derives meal slot', () => {
      const t1 = parseSpokenTimeTo24Hr('सुबह 8 बजे');
      expect(t1).not.toBeNull();
      expect(t1?.time24).toBe('08:00');
      expect(t1?.mealSlot).toBe('Breakfast');

      const t2 = parseSpokenTimeTo24Hr('shaam 6 baje');
      expect(t2).not.toBeNull();
      expect(t2?.time24).toBe('18:00');
      expect(t2?.mealSlot).toBe('Snack');

      const t3 = parseSpokenTimeTo24Hr('dopahar 1 baje');
      expect(t3).not.toBeNull();
      expect(t3?.time24).toBe('13:00');
      expect(t3?.mealSlot).toBe('Lunch');
    });

    it('returns null on noise or unclear input', () => {
      expect(parseSpokenTimeTo24Hr('blablabla')).toBeNull();
      expect(parseSpokenTimeTo24Hr('')).toBeNull();
    });
  });
});
