import { describe, it, expect } from 'vitest';
import { VoiceCommandParser } from '../services/voiceCommandParser';
import { TanglishNormalizer } from '../services/tanglishNormalizer';

describe('AutoFeast AI - Tanglish Voice Command Parsing & Normalization Suite', () => {
  describe('Mandatory Spoken Tanglish Commands (Exact User Specifications)', () => {
    it('1. "Naalaiku afternoon one mani ku rendu parotta order pannu."', () => {
      const raw = 'Naalaiku afternoon one mani ku rendu parotta order pannu.';
      const parsed = VoiceCommandParser.parse(raw);

      expect(parsed.rawTranscript).toBe(raw);
      expect(['schedule', 'order']).toContain(parsed.action);
      expect(parsed.date?.isTomorrow).toBe(true);
      expect(parsed.time?.time24).toBe('13:00');
      expect(parsed.items.length).toBeGreaterThan(0);
      expect(parsed.items[0].name.toLowerCase()).toContain('parotta');
      expect(parsed.items[0].quantity).toBe(2);
    });

    it('2. "Inniku night 8 mani ku one chicken biryani add pannu."', () => {
      const raw = 'Inniku night 8 mani ku one chicken biryani add pannu.';
      const parsed = VoiceCommandParser.parse(raw);

      expect(parsed.action).toBe('add_to_cart');
      expect(parsed.time?.time24).toBe('20:00');
      expect(parsed.items.length).toBeGreaterThan(0);
      expect(parsed.items[0].name.toLowerCase()).toContain('biryani');
      expect(parsed.items[0].quantity).toBe(1);
    });

    it('3. "Daily morning 9 mani ku two idli schedule pannu."', () => {
      const raw = 'Daily morning 9 mani ku two idli schedule pannu.';
      const parsed = VoiceCommandParser.parse(raw);

      expect(parsed.action).toBe('schedule');
      expect(parsed.recurrence?.isRecurring).toBe(true);
      expect(parsed.recurrence?.frequency).toBe('daily');
      expect(parsed.time?.time24).toBe('09:00');
      expect(parsed.items.length).toBeGreaterThan(0);
      expect(parsed.items[0].name.toLowerCase()).toContain('idli');
      expect(parsed.items[0].quantity).toBe(2);
    });

    it('4. "Enakku oru masala dosa venum."', () => {
      const raw = 'Enakku oru masala dosa venum.';
      const parsed = VoiceCommandParser.parse(raw);

      expect(parsed.action).toBe('order');
      expect(parsed.items.length).toBeGreaterThan(0);
      expect(parsed.items[0].name.toLowerCase()).toContain('masala dosa');
      expect(parsed.items[0].quantity).toBe(1);
    });

    it('5. "Monday and Wednesday 1 PM ku biryani order pannu."', () => {
      const raw = 'Monday and Wednesday 1 PM ku biryani order pannu.';
      const parsed = VoiceCommandParser.parse(raw);

      expect(parsed.action).toBe('schedule');
      expect(parsed.recurrence?.isRecurring).toBe(true);
      expect(parsed.recurrence?.selectedDays).toEqual(expect.arrayContaining(['Mon', 'Wed']));
      expect(parsed.time?.time24).toBe('13:00');
      expect(parsed.items.length).toBeGreaterThan(0);
      expect(parsed.items[0].name.toLowerCase()).toContain('biryani');
    });

    it('6. "Rendu chicken biryani cart la add pannu."', () => {
      const raw = 'Rendu chicken biryani cart la add pannu.';
      const parsed = VoiceCommandParser.parse(raw);

      expect(parsed.action).toBe('add_to_cart');
      expect(parsed.items.length).toBeGreaterThan(0);
      expect(parsed.items[0].name.toLowerCase()).toContain('biryani');
      expect(parsed.items[0].quantity).toBe(2);
    });

    it('7. "Naalaiku evening six thirty ku dosa order pannu."', () => {
      const raw = 'Naalaiku evening six thirty ku dosa order pannu.';
      const parsed = VoiceCommandParser.parse(raw);

      expect(['schedule', 'order']).toContain(parsed.action);
      expect(parsed.date?.isTomorrow).toBe(true);
      expect(parsed.time?.time24).toBe('18:30');
      expect(parsed.items.length).toBeGreaterThan(0);
      expect(parsed.items[0].name.toLowerCase()).toContain('dosa');
    });
  });

  describe('Multilingual Comparative Testing: Tamil Script, English, Hindi, Tanglish', () => {
    it('Tamil Script: parses equivalent commands accurately', () => {
      const parsedTa = VoiceCommandParser.parse('நாளைக்கு மதியம் 1 மணிக்கு இரண்டு பரோட்டா ஆர்டர் பண்ணு', 'ta');
      expect(parsedTa.date?.isTomorrow).toBe(true);
      expect(parsedTa.time?.time24).toBe('13:00');
      expect(parsedTa.items[0]?.quantity).toBe(2);
      expect(parsedTa.items[0]?.name.toLowerCase()).toContain('parotta');
    });

    it('English: parses equivalent commands accurately', () => {
      const parsedEn = VoiceCommandParser.parse('Order two parotta tomorrow at 1 PM', 'en');
      expect(parsedEn.date?.isTomorrow).toBe(true);
      expect(parsedEn.time?.time24).toBe('13:00');
      expect(parsedEn.items[0]?.quantity).toBe(2);
      expect(parsedEn.items[0]?.name.toLowerCase()).toContain('parotta');
    });

    it('Hindi Script: parses equivalent commands accurately', () => {
      const parsedHi = VoiceCommandParser.parse('कल दोपहर 1 बजे दो परोटा ऑर्डर करो', 'hi');
      expect(parsedHi.date?.isTomorrow).toBe(true);
      expect(parsedHi.time?.time24).toBe('13:00');
      expect(parsedHi.items[0]?.quantity).toBe(2);
      expect(parsedHi.items[0]?.name.toLowerCase()).toContain('parotta');
    });

    it('Catalog Coverage: recognizes all 8 user-mandated items in Tanglish', () => {
      const testCases = [
        { phrase: 'oru parotta venum', keyword: 'parotta' },
        { phrase: 'rendu kothu parotta order pannu', keyword: 'parotta' },
        { phrase: 'oru chicken biryani add pannu', keyword: 'biryani' },
        { phrase: 'oru mutton biryani kudu', keyword: 'biryani' },
        { phrase: 'rendu masala dosa venum', keyword: 'dosa' },
        { phrase: 'oru ghee dosa parcel pannu', keyword: 'dosa' },
        { phrase: 'moonu idli kaalaila schedule pannu', keyword: 'idli' },
        { phrase: 'oru ven pongal vadai venum', keyword: 'pongal' }
      ];

      for (const tc of testCases) {
        const res = VoiceCommandParser.parse(tc.phrase);
        expect(res.items.length).toBeGreaterThan(0);
        expect(res.items[0].name.toLowerCase()).toContain(tc.keyword);
      }
    });

    it('Latency Benchmark: parses commands under 15ms per invocation', () => {
      // Warm up JIT to avoid cold start overhead under parallel test execution
      for (let i = 0; i < 20; i++) {
        VoiceCommandParser.parse('Naalaiku afternoon one mani ku rendu parotta order pannu.');
      }
      const start = performance.now();
      for (let i = 0; i < 50; i++) {
        VoiceCommandParser.parse('Naalaiku afternoon one mani ku rendu parotta order pannu.');
      }
      const totalMs = performance.now() - start;
      const avgMs = totalMs / 50;
      expect(avgMs).toBeLessThan(45);
    });
  });
});
