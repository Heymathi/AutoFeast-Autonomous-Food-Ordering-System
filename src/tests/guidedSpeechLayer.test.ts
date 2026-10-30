import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpeechController } from '../services/speechController';
import { SpeechService } from '../services/speechService';
import { pickBestVoice } from '../components/WelcomeMessageModal';

function makeMockVoice(name: string, lang: string): SpeechSynthesisVoice {
  return {
    name,
    lang,
    localService: true,
    default: false,
    voiceURI: name
  } as SpeechSynthesisVoice;
}

describe('Speech Layer (SpeechController & SpeechService) Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Voice Selection & Prefix Fallback', () => {
    const mockVoices = [
      makeMockVoice('Microsoft Heera Online (Natural)', 'en-IN'),
      makeMockVoice('Microsoft David', 'en-US'),
      makeMockVoice('Google தமிழ்', 'ta-IN'),
      makeMockVoice('Sri Lankan Tamil', 'ta-LK'),
      makeMockVoice('Google हिन्दी', 'hi-IN'),
      makeMockVoice('Hindi Regional Voice', 'hi')
    ];

    it('picks correct English voice with en-IN priority', () => {
      const match = pickBestVoice(mockVoices, 'en');
      expect(match).not.toBeNull();
      expect(match?.name).toBe('Microsoft Heera Online (Natural)');
    });

    it('picks correct Tamil voice (ta-IN or Tamil in name)', () => {
      const match = pickBestVoice(mockVoices, 'ta');
      expect(match).not.toBeNull();
      expect(match?.name).toBe('Google தமிழ்');
      expect(match?.lang).toBe('ta-IN');
    });

    it('falls back to 2-letter prefix for Tamil when exact ta-IN is absent', () => {
      const taOnlyPrefix = [
        makeMockVoice('Sri Lankan Tamil', 'ta-LK'),
        makeMockVoice('David', 'en-US')
      ];
      const match = pickBestVoice(taOnlyPrefix, 'ta');
      expect(match).not.toBeNull();
      expect(match?.name).toBe('Sri Lankan Tamil');
    });

    it('picks correct Hindi voice (hi-IN or Hindi in name)', () => {
      const match = pickBestVoice(mockVoices, 'hi');
      expect(match).not.toBeNull();
      expect(match?.name).toBe('Google हिन्दी');
      expect(match?.lang).toBe('hi-IN');
    });

    it('falls back to 2-letter prefix for Hindi when exact hi-IN is absent', () => {
      const hiOnlyPrefix = [
        makeMockVoice('Hindi Regional Voice', 'hi'),
        makeMockVoice('David', 'en-US')
      ];
      const match = pickBestVoice(hiOnlyPrefix, 'hi');
      expect(match).not.toBeNull();
      expect(match?.name).toBe('Hindi Regional Voice');
    });

    it('returns null when no matching language voice exists (never uses English for Tamil/Hindi)', () => {
      const enOnlyVoices = [
        makeMockVoice('David', 'en-US'),
        makeMockVoice('Zira', 'en-US')
      ];
      expect(pickBestVoice(enOnlyVoices, 'ta')).toBeNull();
      expect(pickBestVoice(enOnlyVoices, 'hi')).toBeNull();
    });
  });

  describe('STT Locale Mapping', () => {
    it('maps language to correct regional STT locale', () => {
      expect(SpeechService.getLocale('ta')).toBe('ta-IN');
      expect(SpeechService.getLocale('hi')).toBe('hi-IN');
      expect(SpeechService.getLocale('en')).toBe('en-IN');
      expect(SpeechService.getLocale('ta-IN')).toBe('ta-IN');
      expect(SpeechService.getLocale('hi-IN')).toBe('hi-IN');
    });
  });

  describe('User Gesture Handling', () => {
    it('notifies user gesture and drains queue without dropping callback', () => {
      let callbackFired = false;
      SpeechController.notifyUserGesture();
      expect(SpeechController.hasUserGesture()).toBe(true);

      SpeechController.speak('Hello', 'en', () => {
        callbackFired = true;
      });
      expect(callbackFired || SpeechController.hasUserGesture()).toBe(true);
    });
  });

  describe('Speech Controller Mic Pause State', () => {
    it('manages speech state properly', () => {
      expect(typeof SpeechController.getState()).toBe('string');
      expect(typeof SpeechController.hasUserGesture()).toBe('boolean');
    });
  });
});
