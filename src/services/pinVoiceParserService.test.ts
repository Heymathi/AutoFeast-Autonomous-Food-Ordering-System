import { describe, test, expect, vi } from 'vitest';
import { parsePinSpeech } from './pinVoiceParserService';

describe('parsePinSpeech Unit Tests', () => {
  const languages = ['en', 'ta', 'hi'];

  languages.forEach((lang) => {
    const inputs1234 = [
      'one two three four',
      '1 2 3 4',
      '1234',
      'onnu rendu moonu naalu',
      'ஒன்று இரண்டு மூன்று நான்கு',
      'ek do teen char',
      'एक दो तीन चार',
      '१२३४',
      '௧௨௩௪',
      'one rendu teen naalu',
      'ஒன் டூ த்ரீ போர்',
      'वन टू थ्री फोर',
      '1 rendu three char',
      'won to tree for'
    ];

    inputs1234.forEach((input, idx) => {
      test(`[Lang: ${lang}] Input #${idx + 1} "${input}" parses to 1234`, () => {
        const res = parsePinSpeech(input, lang);
        expect(res.status).toBe('success');
        expect(res.digits.join('')).toBe('1234');
      });
    });
  });

  test('5 digits rejected', () => {
    const res = parsePinSpeech('1 2 3 4 5');
    expect(res.status).toBe('too_many');
    expect(res.digits.length).toBe(0);
  });

  test('3 digits kept, status need_more', () => {
    const res = parsePinSpeech('1 2 3');
    expect(res.status).toBe('need_more');
    expect(res.digits.join('')).toBe('123');
  });

  test('Invalid text returns no_speech', () => {
    const res = parsePinSpeech('xyz');
    expect(res.status).toBe('no_speech');
    expect(res.digits.length).toBe(0);
  });

  test('"double" returns requires_each_digit', () => {
    const res = parsePinSpeech('double one two three');
    expect(res.status).toBe('requires_each_digit');
    expect(res.digits.length).toBe(0);
  });

  test('Command "clear" handled (English)', () => {
    const res = parsePinSpeech('clear');
    expect(res.status).toBe('command');
    expect(res.command).toBe('clear');
  });

  test('Command "அழி" handled (Tamil clear)', () => {
    const res = parsePinSpeech('அழி');
    expect(res.status).toBe('command');
    expect(res.command).toBe('clear');
  });

  test('Command "मिटाओ" handled (Hindi clear)', () => {
    const res = parsePinSpeech('मिटाओ');
    expect(res.status).toBe('command');
    expect(res.command).toBe('clear');
  });

  test('Command "मिटாओ" handled (Legacy mixed Hindi/Tamil clear)', () => {
    const res = parsePinSpeech('मिटாओ');
    expect(res.status).toBe('command');
    expect(res.command).toBe('clear');
  });

  test('Command "பின்" handled (Tamil back)', () => {
    const res = parsePinSpeech('பின்');
    expect(res.status).toBe('command');
    expect(res.command).toBe('back');
  });

  test('Command "रद्द" handled (Hindi cancel)', () => {
    const res = parsePinSpeech('रद्द');
    expect(res.status).toBe('command');
    expect(res.command).toBe('cancel');
  });

  test('Command "ரத்து" handled (Pure Tamil cancel)', () => {
    const res = parsePinSpeech('ரத்து');
    expect(res.status).toBe('command');
    expect(res.command).toBe('cancel');
  });

  test('Command "ரद्द" handled (Legacy mixed Hindi/Tamil cancel)', () => {
    const res = parsePinSpeech('ரद्द');
    expect(res.status).toBe('command');
    expect(res.command).toBe('cancel');
  });

  test('Console logs never print raw PIN digits in plain text', () => {
    const consoleSpy = vi.spyOn(console, 'log');
    parsePinSpeech('1 2 3 4');
    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('1234'));
    consoleSpy.mockRestore();
  });
});
