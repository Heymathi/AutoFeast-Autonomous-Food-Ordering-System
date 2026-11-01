import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { toTime24, toTimeText, normalizeTime, formatScheduleTime } from '../utils/scheduleCalculator';
import { AutoOrderScheduler } from '../components/AutoOrderScheduler';
import { AppProvider } from '../context/AppContext';
import { VoiceCommandParser } from '../services/voiceCommandParser';
import { parseSpokenTimeTo24Hr } from '../services/timeVoiceParser';
import { FuzzyMatchEngine } from '../services/fuzzyMatchService';
import { AutoOrderBackgroundService } from '../services/autoOrderBackgroundService';

describe('Time Safety Helpers & Scheduler Render Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('1. toTime24 and toTimeText conversions', () => {
    it('handles standard string inputs', () => {
      expect(toTime24('08:00')).toBe('08:00');
      expect(toTime24('8:00 AM')).toBe('08:00');
      expect(toTime24('8:30 PM')).toBe('20:30');
      expect(toTime24('20:30')).toBe('20:30');
      expect(toTime24('8 AM')).toBe('08:00');
      expect(toTime24('8 PM')).toBe('20:00');

      expect(toTimeText('08:00')).toBe('8:00 AM');
      expect(toTimeText('8:00 AM')).toBe('8:00 AM');
      expect(toTimeText('20:30')).toBe('8:30 PM');
      expect(toTimeText('8:30 PM')).toBe('8:30 PM');
    });

    it('handles object with time12Formatted shape', () => {
      const obj12 = { time12Formatted: '8:00 AM' };
      expect(toTime24(obj12)).toBe('08:00');
      expect(toTimeText(obj12)).toBe('8:00 AM');

      const obj12Pm = { time12Formatted: '8:30 PM' };
      expect(toTime24(obj12Pm)).toBe('20:30');
      expect(toTimeText(obj12Pm)).toBe('8:30 PM');
    });

    it('handles object with time24 shape', () => {
      const obj24 = { time24: '08:00' };
      expect(toTime24(obj24)).toBe('08:00');
      expect(toTimeText(obj24)).toBe('8:00 AM');

      const obj24Pm = { time24: '20:30' };
      expect(toTime24(obj24Pm)).toBe('20:30');
      expect(toTimeText(obj24Pm)).toBe('8:30 PM');
    });

    it('handles voiceCommandParser result object shape with needsAmPmClarification', () => {
      const parserObj = {
        time24: '08:00',
        time12Formatted: '8:00 AM',
        raw: '8',
        needsAmPmClarification: true
      };
      expect(toTime24(parserObj)).toBe('08:00');
      expect(toTimeText(parserObj)).toBe('8:00 AM');
    });

    it('handles null and undefined safely without throwing', () => {
      expect(toTime24(undefined)).toBe('');
      expect(toTime24(null)).toBe('');
      expect(toTimeText(undefined)).toBe('');
      expect(toTimeText(null)).toBe('');

      // normalizeTime defaults
      expect(normalizeTime(undefined)).toBe('08:00');
      expect(normalizeTime(null)).toBe('08:00');
      expect(formatScheduleTime(undefined)).toBe('8:00 AM');
      expect(formatScheduleTime(null)).toBe('8:00 AM');
    });
  });

  describe('2. Parser Inputs Verification', () => {
    it('parses "8 AM"', () => {
      const t1 = parseSpokenTimeTo24Hr('8 AM');
      expect(t1?.time24).toBe('08:00');
      expect(t1?.time12Formatted).toBe('8:00 AM');

      const v1 = VoiceCommandParser.extractTime('8 AM');
      expect(v1?.time24).toBe('08:00');
      expect(v1?.time12Formatted).toBe('8:00 AM');
    });

    it('parses "night 8"', () => {
      const t2 = parseSpokenTimeTo24Hr('night 8');
      expect(t2?.time24).toBe('20:00');
      expect(t2?.time12Formatted).toBe('8:00 PM');
    });

    it('parses "evening 7:30"', () => {
      const t3 = parseSpokenTimeTo24Hr('evening 7:30');
      expect(t3?.time24).toBe('19:30');
      expect(t3?.time12Formatted).toBe('7:30 PM');
    });

    it('parses "8" and flags ambiguous / needs AM/PM clarification', () => {
      const f8 = FuzzyMatchEngine.fuzzyParseTimeAndSchedule('8', 'en');
      expect(f8.isAmbiguous).toBe(true);

      const v2 = VoiceCommandParser.extractTime('2 maniku');
      expect(v2?.needsAmPmClarification).toBe(true);
    });

    it('parses Tamil "காலை 8 மணி"', () => {
      const ta = parseSpokenTimeTo24Hr('காலை 8 மணி');
      expect(ta?.time24).toBe('08:00');
      expect(ta?.time12Formatted).toBe('8:00 AM');
    });

    it('parses Hindi "subah 8 baje"', () => {
      const hi = parseSpokenTimeTo24Hr('subah 8 baje');
      expect(hi?.time24).toBe('08:00');
      expect(hi?.time12Formatted).toBe('8:00 AM');
    });
  });

  describe('3. Scheduler Render Safety with Corrupted Object-Shaped Time in Storage', () => {
    it('renders AutoOrderScheduler without throwing React error #31 when schedule.time is an object', () => {
      const corruptedSchedules = [
        {
          id: 'corrupted-sched-1',
          slotName: 'Breakfast Schedule',
          slotIndex: 1,
          time: {
            time24: '08:00',
            time12Formatted: '8:00 AM',
            raw: '8',
            needsAmPmClarification: true
          },
          frequency: 'daily',
          foodItemId: 'dosa-masala',
          foodItemName: 'Masala Dosa',
          restaurant: 'Saravana Bhavan',
          quantity: 1,
          strategy: 'best_value',
          isEnabled: true,
          walletAutoDebit: true,
          duration: '1_week',
          startDate: '2026-11-01',
          endDate: '2026-11-07'
        }
      ];

      localStorage.setItem('smart_food_auto_schedules', JSON.stringify(corruptedSchedules));

      // AutoOrderBackgroundService should sanitize this automatically
      const loaded = AutoOrderBackgroundService.getSchedules();
      expect(typeof loaded[0].time).toBe('string');
      expect(loaded[0].time).toBe('08:00');

      // Now render AutoOrderScheduler inside AppProvider - must NOT throw
      expect(() => {
        render(
          <AppProvider>
            <AutoOrderScheduler />
          </AppProvider>
        );
      }).not.toThrow();

      // Ensure the display string renders cleanly in the DOM
      const timeElements = screen.getAllByText('8:00 AM');
      expect(timeElements.length).toBeGreaterThanOrEqual(1);
    });
  });
});
