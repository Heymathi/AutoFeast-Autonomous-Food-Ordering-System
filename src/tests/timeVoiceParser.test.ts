import { describe, test, expect } from 'vitest';
import { parseSpokenTimeTo24Hr } from '../services/timeVoiceParser';

describe('Multilingual Spoken Time Parser', () => {
  describe('English Spoken Times', () => {
    test('8 AM -> 08:00 Breakfast', () => {
      const res = parseSpokenTimeTo24Hr('8 AM');
      expect(res).not.toBeNull();
      expect(res?.time24).toBe('08:00');
      expect(res?.time12Formatted).toBe('8:00 AM');
      expect(res?.mealSlot).toBe('Breakfast');
    });

    test('eight thirty -> 08:30 Breakfast', () => {
      const res = parseSpokenTimeTo24Hr('eight thirty');
      expect(res).not.toBeNull();
      expect(res?.time24).toBe('08:30');
      expect(res?.time12Formatted).toBe('8:30 AM');
      expect(res?.mealSlot).toBe('Breakfast');
    });

    test('8 PM -> 20:00 Dinner', () => {
      const res = parseSpokenTimeTo24Hr('8 PM');
      expect(res).not.toBeNull();
      expect(res?.time24).toBe('20:00');
      expect(res?.mealSlot).toBe('Dinner');
    });

    test('1:30 PM -> 13:30 Lunch', () => {
      const res = parseSpokenTimeTo24Hr('1:30 PM');
      expect(res?.time24).toBe('13:30');
      expect(res?.mealSlot).toBe('Lunch');
    });

    test('breakfast -> 08:00', () => {
      const res = parseSpokenTimeTo24Hr('breakfast');
      expect(res?.time24).toBe('08:00');
      expect(res?.mealSlot).toBe('Breakfast');
    });

    test('lunch -> 12:30', () => {
      const res = parseSpokenTimeTo24Hr('lunch');
      expect(res?.time24).toBe('12:30');
      expect(res?.mealSlot).toBe('Lunch');
    });
  });

  describe('Tamil Spoken Times', () => {
    test('காலை 8 மணி -> 08:00 Breakfast', () => {
      const res = parseSpokenTimeTo24Hr('காலை 8 மணி');
      expect(res).not.toBeNull();
      expect(res?.time24).toBe('08:00');
      expect(res?.time12Formatted).toBe('8:00 AM');
      expect(res?.mealSlot).toBe('Breakfast');
    });

    test('இரவு 8:30 -> 20:30 Dinner', () => {
      const res = parseSpokenTimeTo24Hr('இரவு 8:30');
      expect(res).not.toBeNull();
      expect(res?.time24).toBe('20:30');
      expect(res?.time12Formatted).toBe('8:30 PM');
      expect(res?.mealSlot).toBe('Dinner');
    });

    test('மதியம் 1 மணி -> 13:00 Lunch', () => {
      const res = parseSpokenTimeTo24Hr('மதியம் 1 மணி');
      expect(res?.time24).toBe('13:00');
      expect(res?.mealSlot).toBe('Lunch');
    });

    test('எட்டு மணி (Transliteration: ettu mani) -> 08:00', () => {
      const res = parseSpokenTimeTo24Hr('kaalai 8 mani');
      expect(res?.time24).toBe('08:00');
      expect(res?.mealSlot).toBe('Breakfast');
    });
  });

  describe('Hindi Spoken Times', () => {
    test('subah 8 baje -> 08:00 Breakfast', () => {
      const res = parseSpokenTimeTo24Hr('subah 8 baje');
      expect(res).not.toBeNull();
      expect(res?.time24).toBe('08:00');
      expect(res?.time12Formatted).toBe('8:00 AM');
      expect(res?.mealSlot).toBe('Breakfast');
    });

    test('सुबह 8 बजे -> 08:00 Breakfast', () => {
      const res = parseSpokenTimeTo24Hr('सुबह 8 बजे');
      expect(res?.time24).toBe('08:00');
      expect(res?.mealSlot).toBe('Breakfast');
    });

    test('shaam 6 baje -> 18:00 Snack', () => {
      const res = parseSpokenTimeTo24Hr('shaam 6 baje');
      expect(res).not.toBeNull();
      expect(res?.time24).toBe('18:00');
      expect(res?.time12Formatted).toBe('6:00 PM');
      expect(res?.mealSlot).toBe('Snack');
    });

    test('dopahar 1 baje -> 13:00 Lunch', () => {
      const res = parseSpokenTimeTo24Hr('dopahar 1 baje');
      expect(res).not.toBeNull();
      expect(res?.time24).toBe('13:00');
      expect(res?.time12Formatted).toBe('1:00 PM');
      expect(res?.mealSlot).toBe('Lunch');
    });

    test('दोपहर 1 बजे -> 13:00 Lunch', () => {
      const res = parseSpokenTimeTo24Hr('दोपहर 1 बजे');
      expect(res?.time24).toBe('13:00');
      expect(res?.mealSlot).toBe('Lunch');
    });
  });

  describe('Edge cases and unclear times', () => {
    test('unclear / noise returns null', () => {
      expect(parseSpokenTimeTo24Hr('hello')).toBeNull();
      expect(parseSpokenTimeTo24Hr('some random noise')).toBeNull();
      expect(parseSpokenTimeTo24Hr('')).toBeNull();
    });
  });
});

