import { describe, it, expect } from 'vitest';
import {
  parseTime,
  parseRepeatType,
  parseDays,
  parseDayOfMonth,
  parseCustomDate,
  buildSummary,
  parseChangeTarget
} from '../services/scheduleVoiceParser';

describe('scheduleVoiceParser - Pure Function Tests Across EN, TA, HI', () => {

  // ─── 1. parseTime ─────────────────────────────────────────────────────────
  describe('1. parseTime', () => {
    // English (at least 6)
    it('parses English time strings', () => {
      expect(parseTime('8 AM')?.time24).toBe('08:00');
      expect(parseTime('eight thirty')?.time24).toBe('08:30');
      expect(parseTime('8:30 pm')?.time24).toBe('20:30');
      expect(parseTime('1 PM')?.time24).toBe('13:00');
      expect(parseTime('12:00 pm')?.time24).toBe('12:00');
      expect(parseTime('7:15 am')?.time24).toBe('07:15');
    });

    // Tamil (at least 6)
    it('parses Tamil time strings', () => {
      expect(parseTime('காலை 8 மணி')?.time24).toBe('08:00');
      expect(parseTime('இரவு 8:30')?.time24).toBe('20:30');
      expect(parseTime('மதியம் 1 மணி')?.time24).toBe('13:00');
      expect(parseTime('மாலை 7 மணி')?.time24).toBe('19:00');
      expect(parseTime('காலையில் 9 மணி')?.time24).toBe('09:00');
      expect(parseTime('இரவு எட்டு மணி')?.time24).toBe('20:00');
    });

    // Hindi (at least 6)
    it('parses Hindi time strings', () => {
      expect(parseTime('subah 8 baje')?.time24).toBe('08:00');
      expect(parseTime('shaam 6 baje')?.time24).toBe('18:00');
      expect(parseTime('dopahar 1 baje')?.time24).toBe('13:00');
      expect(parseTime('raat 8:30')?.time24).toBe('20:30');
      expect(parseTime('subah saat baje')?.time24).toBe('07:00');
      expect(parseTime('dopahar do baje')?.time24).toBe('14:00');
    });

    // Noise and Empty
    it('handles noise and empty inputs', () => {
      expect(parseTime('')).toBeNull();
      expect(parseTime('   ')).toBeNull();
      expect(parseTime('hello some random text')).toBeNull();
      expect(parseTime('blablabla 99999')).toBeNull();
    });
  });

  // ─── 2. parseRepeatType ───────────────────────────────────────────────────
  describe('2. parseRepeatType', () => {
    // English (at least 6)
    it('parses English repeat types', () => {
      expect(parseRepeatType('monthly')).toBe('monthly');
      expect(parseRepeatType('every month')).toBe('monthly');
      expect(parseRepeatType('weekly')).toBe('weekly');
      expect(parseRepeatType('every week')).toBe('weekly');
      expect(parseRepeatType('custom date')).toBe('custom');
      expect(parseRepeatType('specific date')).toBe('custom');
    });

    // Tamil (at least 6)
    it('parses Tamil repeat types', () => {
      expect(parseRepeatType('மாதம்')).toBe('monthly');
      expect(parseRepeatType('மாதாந்திர')).toBe('monthly');
      expect(parseRepeatType('வாரம்')).toBe('weekly');
      expect(parseRepeatType('வாராந்திர')).toBe('weekly');
      expect(parseRepeatType('ஒரு தேதி')).toBe('custom');
      expect(parseRepeatType('குறிப்பிட்ட தேதி')).toBe('custom');
    });

    // Hindi (at least 6)
    it('parses Hindi repeat types', () => {
      expect(parseRepeatType('महीने')).toBe('monthly');
      expect(parseRepeatType('मासिक')).toBe('monthly');
      expect(parseRepeatType('हर महीने')).toBe('monthly');
      expect(parseRepeatType('हफ्ते')).toBe('weekly');
      expect(parseRepeatType('साप्ताहिक')).toBe('weekly');
      expect(parseRepeatType('खास तारीख')).toBe('custom');
    });

    // Noise and Empty
    it('handles noise and empty inputs', () => {
      expect(parseRepeatType('')).toBeNull();
      expect(parseRepeatType('random gibberish')).toBeNull();
      expect(parseRepeatType('12345')).toBeNull();
    });
  });

  // ─── 3. parseDays ─────────────────────────────────────────────────────────
  describe('3. parseDays', () => {
    // English (at least 6)
    it('parses English days', () => {
      expect(parseDays('Monday and Thursday')).toEqual(['Monday', 'Thursday']);
      expect(parseDays('tuesday, friday')).toEqual(['Tuesday', 'Friday']);
      expect(parseDays('wednesday')).toEqual(['Wednesday']);
      expect(parseDays('weekdays')).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
      expect(parseDays('weekend')).toEqual(['Saturday', 'Sunday']);
      expect(parseDays('every day')).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
    });

    // Tamil (at least 6)
    it('parses Tamil days', () => {
      expect(parseDays('திங்கள் வியாழன்')).toEqual(['Monday', 'Thursday']);
      expect(parseDays('செவ்வாய் மற்றும் வெள்ளி')).toEqual(['Tuesday', 'Friday']);
      expect(parseDays('புதன்கிழமை')).toEqual(['Wednesday']);
      expect(parseDays('வார நாட்கள்')).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
      expect(parseDays('வார இறுதி')).toEqual(['Saturday', 'Sunday']);
      expect(parseDays('தினமும்')).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
    });

    // Hindi (at least 6)
    it('parses Hindi days', () => {
      expect(parseDays('somvar aur guruwar')).toEqual(['Monday', 'Thursday']);
      expect(parseDays('सोमवार')).toEqual(['Monday']);
      expect(parseDays('मंगलवार और शुक्रवार')).toEqual(['Tuesday', 'Friday']);
      expect(parseDays('बुधवार')).toEqual(['Wednesday']);
      expect(parseDays('वीकेंड')).toEqual(['Saturday', 'Sunday']);
      expect(parseDays('हर दिन')).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
    });

    // Noise and Empty
    it('handles noise and empty inputs', () => {
      expect(parseDays('')).toBeNull();
      expect(parseDays('no days mentioned here')).toBeNull();
      expect(parseDays('xyz 123')).toBeNull();
    });
  });

  // ─── 4. parseDayOfMonth ───────────────────────────────────────────────────
  describe('4. parseDayOfMonth', () => {
    // English (at least 6)
    it('parses English day-of-month', () => {
      expect(parseDayOfMonth('1st')).toBe(1);
      expect(parseDayOfMonth('fifth')).toBe(5);
      expect(parseDayOfMonth('15th')).toBe(15);
      expect(parseDayOfMonth('twenty fifth')).toBe(25);
      expect(parseDayOfMonth('first day')).toBe(1);
      expect(parseDayOfMonth('last day')).toBe(31);
    });

    // Tamil (at least 6)
    it('parses Tamil day-of-month', () => {
      expect(parseDayOfMonth('முதல் நாள்')).toBe(1);
      expect(parseDayOfMonth('கடைசி நாள்')).toBe(31);
      expect(parseDayOfMonth('5 ஆம் தேதி')).toBe(5);
      expect(parseDayOfMonth('பதினைந்து')).toBe(15);
      expect(parseDayOfMonth('இருபது')).toBe(20);
      expect(parseDayOfMonth('முப்பது')).toBe(30);
    });

    // Hindi (at least 6)
    it('parses Hindi day-of-month', () => {
      expect(parseDayOfMonth('पहला दिन')).toBe(1);
      expect(parseDayOfMonth('आखिरी दिन')).toBe(31);
      expect(parseDayOfMonth('5 तारीख')).toBe(5);
      expect(parseDayOfMonth('पंद्रह')).toBe(15);
      expect(parseDayOfMonth('बीस')).toBe(20);
      expect(parseDayOfMonth('इकत्तीस')).toBe(31);
    });

    // Noise and Empty
    it('handles noise and empty inputs', () => {
      expect(parseDayOfMonth('')).toBeNull();
      expect(parseDayOfMonth('50th day')).toBeNull(); // out of range
      expect(parseDayOfMonth('random text')).toBeNull();
    });
  });

  // ─── 5. parseCustomDate ───────────────────────────────────────────────────
  describe('5. parseCustomDate', () => {
    const fixedRef = new Date(2026, 10, 10); // 10 Nov 2026

    // English (at least 6)
    it('parses English custom dates', () => {
      const tomorrow = parseCustomDate('tomorrow', fixedRef);
      expect(tomorrow?.dateStr).toBe('2026-11-11');
      expect(tomorrow?.isPast).toBe(false);

      const dayAfter = parseCustomDate('day after tomorrow', fixedRef);
      expect(dayAfter?.dateStr).toBe('2026-11-12');

      const nov15 = parseCustomDate('15th November', fixedRef);
      expect(nov15?.dateStr).toBe('2026-11-15');

      const nov20 = parseCustomDate('november 20', fixedRef);
      expect(nov20?.dateStr).toBe('2026-11-20');

      const nextWeek = parseCustomDate('next week', fixedRef);
      expect(nextWeek?.dateStr).toBe('2026-11-17');

      const iso = parseCustomDate('2026-12-25', fixedRef);
      expect(iso?.dateStr).toBe('2026-12-25');
    });

    // Tamil (at least 6)
    it('parses Tamil custom dates', () => {
      const tomorrow = parseCustomDate('நாளை', fixedRef);
      expect(tomorrow?.dateStr).toBe('2026-11-11');

      const dayAfter = parseCustomDate('நாளை மறுநாள்', fixedRef);
      expect(dayAfter?.dateStr).toBe('2026-11-12');

      const nov15 = parseCustomDate('நவம்பர் 15', fixedRef);
      expect(nov15?.dateStr).toBe('2026-11-15');

      const nov25 = parseCustomDate('25 நவம்பர்', fixedRef);
      expect(nov25?.dateStr).toBe('2026-11-25');

      const dec5 = parseCustomDate('டிசம்பர் 5', fixedRef);
      expect(dec5?.dateStr).toBe('2026-12-05');

      const today = parseCustomDate('இன்று', fixedRef);
      expect(today?.dateStr).toBe('2026-11-10');
    });

    // Hindi (at least 6)
    it('parses Hindi custom dates', () => {
      const tomorrow = parseCustomDate('kal', fixedRef);
      expect(tomorrow?.dateStr).toBe('2026-11-11');

      const dayAfter = parseCustomDate('parso', fixedRef);
      expect(dayAfter?.dateStr).toBe('2026-11-12');

      const nov15 = parseCustomDate('15 नवंबर', fixedRef);
      expect(nov15?.dateStr).toBe('2026-11-15');

      const nov22 = parseCustomDate('नवंबर 22', fixedRef);
      expect(nov22?.dateStr).toBe('2026-11-22');

      const dec1 = parseCustomDate('दिसंबर 1', fixedRef);
      expect(dec1?.dateStr).toBe('2026-12-01');

      const today = parseCustomDate('aaj', fixedRef);
      expect(today?.dateStr).toBe('2026-11-10');
    });

    // Past date detection
    it('flags past dates as isPast: true', () => {
      const past = parseCustomDate('2025-01-01', fixedRef);
      expect(past?.isPast).toBe(true);
    });

    // Noise and Empty
    it('handles noise and empty inputs', () => {
      expect(parseCustomDate('', fixedRef)).toBeNull();
      expect(parseCustomDate('gibberish date', fixedRef)).toBeNull();
    });
  });

  // ─── 6. buildSummary ──────────────────────────────────────────────────────
  describe('6. buildSummary', () => {
    const weeklyParams = {
      foodItemName: 'Mutton Biryani',
      restaurant: 'Star Ambur Biryani',
      repeatType: 'weekly' as const,
      timeDisplay: '8:30 PM',
      days: ['Monday', 'Thursday']
    };

    const monthlyParams = {
      foodItemName: 'Masala Dosa',
      restaurant: 'Saravana Bhavan',
      repeatType: 'monthly' as const,
      timeDisplay: '1:00 PM',
      dayOfMonth: 5
    };

    const customParams = {
      foodItemName: 'Idli Vada Combo',
      restaurant: 'A2B',
      repeatType: 'custom' as const,
      timeDisplay: '7:00 AM',
      customDate: '2026-11-11'
    };

    // English (at least 6)
    it('builds English summaries', () => {
      const s1 = buildSummary(weeklyParams, 'en');
      expect(s1).toContain('Mutton Biryani from Star Ambur Biryani');
      expect(s1).toContain('every Monday and Thursday at 8:30 PM');
      expect(s1).toContain('Shall I schedule it?');

      const s2 = buildSummary(monthlyParams, 'en');
      expect(s2).toContain('Masala Dosa from Saravana Bhavan');
      expect(s2).toContain('on the 5th of every month at 1:00 PM');

      const s3 = buildSummary(customParams, 'en');
      expect(s3).toContain('Idli Vada Combo from A2B');
      expect(s3).toContain('on 2026-11-11 at 7:00 AM');

      const s4 = buildSummary({ ...weeklyParams, days: ['Monday'] }, 'en');
      expect(s4).toContain('every Monday at 8:30 PM');

      const s5 = buildSummary({ ...monthlyParams, dayOfMonth: 1 }, 'en');
      expect(s5).toContain('1st of every month');

      const s6 = buildSummary({ ...monthlyParams, dayOfMonth: 22 }, 'en');
      expect(s6).toContain('22nd of every month');
    });

    // Tamil (at least 6)
    it('builds Tamil summaries', () => {
      const s1 = buildSummary(weeklyParams, 'ta');
      expect(s1).toContain('Star Ambur Biryani-லிருந்து Mutton Biryani');
      expect(s1).toContain('திங்கள் மற்றும் வியாழன்');
      expect(s1).toContain('8:30 PM மணிக்கு');
      expect(s1).toContain('அட்டவணைப்படுத்தவா?');

      const s2 = buildSummary(monthlyParams, 'ta');
      expect(s2).toContain('ஒவ்வொரு மாதமும் 5 ஆம் தேதி');

      const s3 = buildSummary(customParams, 'ta');
      expect(s3).toContain('2026-11-11 அன்று');

      const s4 = buildSummary({ ...weeklyParams, days: ['Friday'] }, 'ta');
      expect(s4).toContain('வெள்ளி');

      const s5 = buildSummary({ ...monthlyParams, dayOfMonth: 1 }, 'ta');
      expect(s5).toContain('1 ஆம் தேதி');

      const s6 = buildSummary({ ...monthlyParams, dayOfMonth: 15 }, 'ta');
      expect(s6).toContain('15 ஆம் தேதி');
    });

    // Hindi (at least 6)
    it('builds Hindi summaries', () => {
      const s1 = buildSummary(weeklyParams, 'hi');
      expect(s1).toContain('Star Ambur Biryani से Mutton Biryani');
      expect(s1).toContain('सोमवार और गुरुवार');
      expect(s1).toContain('8:30 PM बजे');
      expect(s1).toContain('क्या मैं इसे शेड्यूल करूँ?');

      const s2 = buildSummary(monthlyParams, 'hi');
      expect(s2).toContain('हर महीने की 5 तारीख को');

      const s3 = buildSummary(customParams, 'hi');
      expect(s3).toContain('2026-11-11 को');

      const s4 = buildSummary({ ...weeklyParams, days: ['Sunday'] }, 'hi');
      expect(s4).toContain('रविवार');

      const s5 = buildSummary({ ...monthlyParams, dayOfMonth: 1 }, 'hi');
      expect(s5).toContain('1 तारीख को');

      const s6 = buildSummary({ ...monthlyParams, dayOfMonth: 10 }, 'hi');
      expect(s6).toContain('10 तारीख को');
    });
  });

  // ─── 7. parseChangeTarget ─────────────────────────────────────────────────
  describe('7. parseChangeTarget', () => {
    it('parses English change targets', () => {
      expect(parseChangeTarget('change time')).toBe('time');
      expect(parseChangeTarget('repeat')).toBe('repeat');
      expect(parseChangeTarget('change the days')).toBe('days');
      expect(parseChangeTarget('restaurant')).toBe('restaurant');
    });

    it('parses Tamil change targets', () => {
      expect(parseChangeTarget('நேரம் மாற்ற வேண்டும்')).toBe('time');
      expect(parseChangeTarget('வகை')).toBe('repeat');
      expect(parseChangeTarget('நாட்கள்')).toBe('days');
      expect(parseChangeTarget('உணவகம்')).toBe('restaurant');
    });

    it('parses Hindi change targets', () => {
      expect(parseChangeTarget('samay badlo')).toBe('time');
      expect(parseChangeTarget('समय')).toBe('time');
      expect(parseChangeTarget('प्रकार')).toBe('repeat');
      expect(parseChangeTarget('दिन')).toBe('days');
      expect(parseChangeTarget('होटल')).toBe('restaurant');
    });

    it('handles noise and empty inputs', () => {
      expect(parseChangeTarget('')).toBeNull();
      expect(parseChangeTarget('random unrelated word')).toBeNull();
    });
  });
});
