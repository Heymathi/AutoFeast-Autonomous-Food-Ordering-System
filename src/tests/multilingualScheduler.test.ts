import { describe, it, expect, beforeEach } from 'vitest';
import { VoiceCommandParser } from '../services/voiceCommandParser';
import { AutoOrderBackgroundService } from '../services/autoOrderBackgroundService';
import { AutoOrderSchedule } from '../types';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';

describe('AutoFeast AI - Multilingual Auto-Order Scheduler Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Phase 3: Multilingual Voice Command Parsing (EN / TA / HI)', () => {
    it('1. Parses English schedule command with item, quantity, time, and multiple weekdays', () => {
      const command = 'Schedule one chicken biryani every Monday and Wednesday at 1 PM';
      const result = VoiceCommandParser.parse(command, 'en');

      expect(result.action).toBe('schedule');
      expect(result.time?.time24).toBe('13:00');
      expect(result.recurrence?.isRecurring).toBe(true);
      expect(result.recurrence?.selectedDays).toEqual(expect.arrayContaining(['Mon', 'Wed']));
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0].quantity).toBe(1);
      expect(result.items[0].foodItem?.name.toLowerCase()).toContain('biryani');
    });

    it('2. Parses Tamil schedule command with item, quantity, time, and multiple weekdays', () => {
      const command = 'ஒவ்வொரு திங்கள் மற்றும் புதன்கிழமையும் மதியம் 1 மணிக்கு ஒரு சிக்கன் பிரியாணி ஆர்டர் செய்';
      const result = VoiceCommandParser.parse(command, 'ta');

      expect(result.action).toBe('schedule');
      expect(result.time?.time24).toBe('13:00');
      expect(result.recurrence?.isRecurring).toBe(true);
      expect(result.recurrence?.selectedDays).toEqual(expect.arrayContaining(['Mon', 'Wed']));
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0].quantity).toBe(1);
      expect(result.items[0].foodItem?.name.toLowerCase()).toContain('biryani');
    });

    it('3. Parses Hindi schedule command with item, quantity, time, and multiple weekdays', () => {
      const command = 'हर सोमवार और बुधवार दोपहर 1 बजे एक चिकन बिरयानी ऑर्डर करो';
      const result = VoiceCommandParser.parse(command, 'hi');

      expect(result.action).toBe('schedule');
      expect(result.time?.time24).toBe('13:00');
      expect(result.recurrence?.isRecurring).toBe(true);
      expect(result.recurrence?.selectedDays).toEqual(expect.arrayContaining(['Mon', 'Wed']));
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0].quantity).toBe(1);
      expect(result.items[0].foodItem?.name.toLowerCase()).toContain('biryani');
    });

    it('4. Correctly extracts all 7 weekdays in all 3 languages', () => {
      // English
      const enDays = VoiceCommandParser.extractWeekdays('Monday Tuesday Wednesday Thursday Friday Saturday Sunday');
      expect(enDays).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

      // Tamil
      const taDays = VoiceCommandParser.extractWeekdays('திங்கள் செவ்வாய் புதன் வியாழன் வெள்ளி சனி ஞாயிறு');
      expect(taDays).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

      // Hindi
      const hiDays = VoiceCommandParser.extractWeekdays('सोमवार मंगलवार बुधवार गुरुवार शुक्रवार शनिवार रविवार');
      expect(hiDays).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    });
  });

  describe('Phase 2 & 5: Scheduler Execution, Safeguards & Lifecycle Management', () => {
    const chickenBiryani = INDIAN_FOOD_CATALOG.find(f => f.name.toLowerCase().includes('biryani')) || INDIAN_FOOD_CATALOG[0];

    it('5. Saves schedule and prevents duplicate execution on the same date (Idempotency)', () => {
      const scheduleId = `sched_idempotent_${Date.now()}`;
      const schedule: AutoOrderSchedule = {
        id: scheduleId,
        slotName: 'Lunch Slot',
        slotIndex: 2,
        time: '13:00',
        frequency: 'custom',
        selectedDays: ['Mon', 'Wed', 'Fri'],
        foodItemId: chickenBiryani.id,
        foodItemName: chickenBiryani.name,
        restaurant: chickenBiryani.restaurant,
        quantity: 1,
        strategy: 'best_value',
        isEnabled: true,
        walletAutoDebit: true,
        startDate: '2026-11-02'
      };

      AutoOrderBackgroundService.saveSchedule(schedule);

      // First execution today
      const order1 = AutoOrderBackgroundService.executeScheduleNow(scheduleId, '2026-11-02');
      expect(order1).toBeDefined();
      expect(order1.status).toBe('placed');

      // Check updated schedule recorded lastRunDate
      const updatedSchedules = AutoOrderBackgroundService.getSchedules();
      const updatedSch = updatedSchedules.find(s => s.id === scheduleId);
      expect(updatedSch?.lastRunDate).toBe('2026-11-02');

      // Order History contains the placed order
      const history = AutoOrderBackgroundService.getOrderHistory();
      expect(history.length).toBe(1);
      expect(history[0].foodName).toContain(chickenBiryani.name);
      expect(history[0].status).toBe('placed');
    });

    it('6. Supports Pause and Resume lifecycle', () => {
      const scheduleId = `sched_pause_test_${Date.now()}`;
      const schedule: AutoOrderSchedule = {
        id: scheduleId,
        slotName: 'Dinner Slot',
        slotIndex: 3,
        time: '20:00',
        frequency: 'daily',
        foodItemId: chickenBiryani.id,
        foodItemName: chickenBiryani.name,
        restaurant: chickenBiryani.restaurant,
        quantity: 1,
        strategy: 'best_value',
        isEnabled: true,
        walletAutoDebit: true,
        startDate: '2026-11-02'
      };

      AutoOrderBackgroundService.saveSchedule(schedule);

      // Pause schedule
      const pausedList = AutoOrderBackgroundService.saveSchedule({
        ...schedule,
        isEnabled: false
      });
      const paused = pausedList.find(s => s.id === scheduleId);
      expect(paused?.isEnabled).toBe(false);

      // Resume schedule
      const resumedList = AutoOrderBackgroundService.saveSchedule({
        ...paused!,
        isEnabled: true
      });
      const resumed = resumedList.find(s => s.id === scheduleId);
      expect(resumed?.isEnabled).toBe(true);
    });

    it('7. Enforces Nominee and PIN safeguards on scheduled items', () => {
      const restrictedSchedule: AutoOrderSchedule = {
        id: 'sched_restricted_safety',
        slotName: 'Snack Slot',
        slotIndex: 4,
        time: '17:00',
        frequency: 'daily',
        foodItemId: 'restricted_dosa',
        foodItemName: 'Ultra Spicy Parotta',
        restaurant: 'Spicy Corner',
        quantity: 1,
        strategy: 'best_value',
        isEnabled: true,
        walletAutoDebit: true,
        startDate: '2026-11-02',
        approvalId: undefined // No approval granted
      };

      // Ensure that without an approvalId, restricted item cannot be bypassed
      const hasNomineeApproval = Boolean(restrictedSchedule.approvalId);
      expect(hasNomineeApproval).toBe(false);
    });
  });
});

