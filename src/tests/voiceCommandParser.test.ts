import { describe, it, expect } from 'vitest';
import { VoiceCommandParser } from '../services/voiceCommandParser';

describe('VoiceCommandParser - Multilingual Decision Rules', () => {
  // English Test Cases
  it('parses "order dosa"', () => {
    const res = VoiceCommandParser.parse('order dosa', 'en');
    expect(res.action).toBe('order');
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.items[0].name.toLowerCase()).toContain('dosa');
    expect(res.items[0].quantity).toBe(1);
  });

  it('parses "I want a dosa"', () => {
    const res = VoiceCommandParser.parse('I want a dosa', 'en');
    expect(res.action).toBe('order');
    expect(res.items[0].name.toLowerCase()).toContain('dosa');
    expect(res.items[0].quantity).toBe(1);
  });

  it('parses "get me two dosas"', () => {
    const res = VoiceCommandParser.parse('get me two dosas', 'en');
    expect(res.action).toBe('order');
    expect(res.items[0].name.toLowerCase()).toContain('dosa');
    expect(res.items[0].quantity).toBe(2);
  });

  it('parses "order dosa now"', () => {
    const res = VoiceCommandParser.parse('order dosa now', 'en');
    expect(res.action).toBe('order');
    expect(res.items[0].name.toLowerCase()).toContain('dosa');
    expect(res.items[0].quantity).toBe(1);
  });

  it('parses "can you order parotta for me"', () => {
    const res = VoiceCommandParser.parse('can you order parotta for me', 'en');
    expect(res.action).toBe('order');
    expect(res.items[0].name.toLowerCase()).toContain('parotta');
    expect(res.items[0].quantity).toBe(1);
  });

  it('parses "schedule parotta at 8 AM"', () => {
    const res = VoiceCommandParser.parse('schedule parotta at 8 AM', 'en');
    expect(res.action).toBe('schedule');
    expect(res.items[0].name.toLowerCase()).toContain('parotta');
    expect(res.time?.time24).toBe('08:00');
    expect(res.time?.time12Formatted).toBe('8:00 AM');
  });

  it('parses "order idli tomorrow at 7:30 in the morning"', () => {
    const res = VoiceCommandParser.parse('order idli tomorrow at 7:30 in the morning', 'en');
    expect(res.action).toBe('schedule');
    expect(res.items[0].name.toLowerCase()).toContain('idli');
    expect(res.date?.isTomorrow).toBe(true);
    expect(res.time?.time24).toBe('07:30');
  });

  it('parses "order dosa daily at 8 AM for a month"', () => {
    const res = VoiceCommandParser.parse('order dosa daily at 8 AM for a month', 'en');
    expect(res.action).toBe('schedule');
    expect(res.items[0].name.toLowerCase()).toContain('dosa');
    expect(res.time?.time24).toBe('08:00');
    expect(res.recurrence?.isRecurring).toBe(true);
    expect(res.recurrence?.duration).toBe('1_month');
  });

  // Tamil Script Test Cases
  it('parses "இப்போவே தோசை ஆர்டர் பண்ணி குடு"', () => {
    const res = VoiceCommandParser.parse('இப்போவே தோசை ஆர்டர் பண்ணி குடு', 'ta');
    expect(res.action).toBe('order');
    expect(res.items[0].quantity).toBe(1);
  });

  it('parses "தோசை ரெண்டு மணிக்கு ஆர்டர் போட்டு குடு"', () => {
    const res = VoiceCommandParser.parse('தோசை ரெண்டு மணிக்கு ஆர்டர் போட்டு குடு', 'ta');
    expect(res.action).toBe('schedule');
    expect(res.time?.time24).toBe('14:00');
    expect(res.items[0].quantity).toBe(1); // TIME (rendu maniku) is NOT quantity!
  });

  it('parses "நாளைக்கு காலை 8 மணிக்கு பரோட்டா ஆர்டர் பண்ணு"', () => {
    const res = VoiceCommandParser.parse('நாளைக்கு காலை 8 மணிக்கு பரோட்டா ஆர்டர் பண்ணு', 'ta');
    expect(res.action).toBe('schedule');
    expect(res.date?.isTomorrow).toBe(true);
    expect(res.time?.time24).toBe('08:00');
    expect(res.items[0].quantity).toBe(1);
  });

  it('parses "ரெண்டு இட்லி வேணும்"', () => {
    const res = VoiceCommandParser.parse('ரெண்டு இட்லி வேணும்', 'ta');
    expect(res.action).toBe('order');
    expect(res.items[0].quantity).toBe(2);
  });

  // Tanglish Test Cases
  it('parses "ippovae dosa order panni kudu"', () => {
    const res = VoiceCommandParser.parse('ippovae dosa order panni kudu', 'ta');
    expect(res.action).toBe('order');
    expect(res.items[0].name.toLowerCase()).toContain('dosa');
    expect(res.items[0].quantity).toBe(1);
  });

  it('parses "dosa rendu maniku order potu kudu"', () => {
    const res = VoiceCommandParser.parse('dosa rendu maniku order potu kudu', 'ta');
    expect(res.action).toBe('schedule');
    expect(res.time?.time24).toBe('14:00');
    expect(res.items[0].quantity).toBe(1);
  });

  it('parses "naalaikku kaalai 8 maniku parotta venum"', () => {
    const res = VoiceCommandParser.parse('naalaikku kaalai 8 maniku parotta venum', 'ta');
    expect(res.action).toBe('schedule');
    expect(res.date?.isTomorrow).toBe(true);
    expect(res.time?.time24).toBe('08:00');
  });

  it('parses "dhinamum 8 maniku dosa oru masathuku order pannu"', () => {
    const res = VoiceCommandParser.parse('dhinamum 8 maniku dosa oru masathuku order pannu', 'ta');
    expect(res.action).toBe('schedule');
    expect(res.time?.time24).toBe('08:00');
    expect(res.recurrence?.isRecurring).toBe(true);
    expect(res.recurrence?.duration).toBe('1_month');
  });

  // Hindi Script Test Cases
  it('parses "अभी डोसा ऑर्डर कर दो"', () => {
    const res = VoiceCommandParser.parse('अभी डोसा ऑर्डर कर दो', 'hi');
    expect(res.action).toBe('order');
    expect(res.items[0].quantity).toBe(1);
  });

  it('parses "दो बजे डोसा ऑर्डर कर देना"', () => {
    const res = VoiceCommandParser.parse('दो बजे डोसा ऑर्डर कर देना', 'hi');
    expect(res.action).toBe('schedule');
    expect(res.time?.time24).toBe('14:00');
    expect(res.items[0].quantity).toBe(1);
  });

  it('parses "कल सुबह 8 बजे पराठा शेड्यूल करो"', () => {
    const res = VoiceCommandParser.parse('कल सुबह 8 बजे पराठा शेड्यूल करो', 'hi');
    expect(res.action).toBe('schedule');
    expect(res.date?.isTomorrow).toBe(true);
    expect(res.time?.time24).toBe('08:00');
  });

  it('parses "दो इडली चाहिए"', () => {
    const res = VoiceCommandParser.parse('दो इडली चाहिए', 'hi');
    expect(res.action).toBe('order');
    expect(res.items[0].quantity).toBe(2);
  });

  // Hinglish Test Cases
  it('parses "abhi dosa order kar do"', () => {
    const res = VoiceCommandParser.parse('abhi dosa order kar do', 'hi');
    expect(res.action).toBe('order');
    expect(res.items[0].name.toLowerCase()).toContain('dosa');
    expect(res.items[0].quantity).toBe(1);
  });

  it('parses "do baje dosa order kar dena"', () => {
    const res = VoiceCommandParser.parse('do baje dosa order kar dena', 'hi');
    expect(res.action).toBe('schedule');
    expect(res.time?.time24).toBe('14:00');
    expect(res.items[0].quantity).toBe(1);
  });

  it('parses "kal subah 8 baje parotta schedule karo"', () => {
    const res = VoiceCommandParser.parse('kal subah 8 baje parotta schedule karo', 'hi');
    expect(res.action).toBe('schedule');
    expect(res.date?.isTomorrow).toBe(true);
    expect(res.time?.time24).toBe('08:00');
  });

  // Decision Rules Verification
  it('identifies standalone item name as needing order vs schedule question', () => {
    const res = VoiceCommandParser.parse('parotta', 'en');
    expect(res.needsOrderOrScheduleClarification).toBe(true);
  });

  it('extracts restaurant name when present', () => {
    const res = VoiceCommandParser.parse('ghee podi dosa from Saravana Bhavan', 'en');
    expect(res.restaurant).toBe('Saravana Bhavan');
  });
});
