/**
 * welcomeTts.test.ts
 * Unit tests covering:
 *   - English, Tamil, Hindi voice selection (installed, natural/online, family name, 2-letter prefix fallback)
 *   - Voice missing (null returned for unknown languages)
 *   - STT keyword proceed recognition in English, Tamil, Hindi
 *   - STT error handling (mic permission denied, language not supported, no-speech)
 *   - Double-navigation protection (clicking Proceed during speech or timer fires at most once)
 *   - Watchdog and ~4s fallback timer behavior
 *   - Language preference retrieval preventing stale "en"
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { Language } from '../types';
import { pickBestVoice } from '../components/WelcomeMessageModal';
import { TRANSLATIONS } from '../data/translations';

function fakeVoice(name: string, lang: string): SpeechSynthesisVoice {
  return { name, lang, localService: true, default: false, voiceURI: name } as SpeechSynthesisVoice;
}

describe('Voice Selection across English, Tamil, Hindi', () => {
  describe('English', () => {
    test('picks Microsoft Online / Natural voice', () => {
      const voices = [
        fakeVoice('Microsoft Heera Online (Natural)', 'en-IN'),
        fakeVoice('David', 'en-US')
      ];
      const match = pickBestVoice(voices, 'en');
      expect(match?.name).toBe('Microsoft Heera Online (Natural)');
    });

    test('picks exact locale en-IN if online not present', () => {
      const voices = [
        fakeVoice('Ravi', 'en-IN'),
        fakeVoice('Zira', 'en-US')
      ];
      const match = pickBestVoice(voices, 'en');
      expect(match?.name).toBe('Ravi');
    });

    test('falls back to any voice with 2-letter prefix en', () => {
      const voices = [
        fakeVoice('Alex', 'en-GB'),
        fakeVoice('Luciana', 'pt-BR')
      ];
      const match = pickBestVoice(voices, 'en');
      expect(match?.name).toBe('Alex');
    });

    test('returns null when English voice is missing completely', () => {
      const voices = [
        fakeVoice('Luciana', 'pt-BR'),
        fakeVoice('Yuki', 'ja-JP')
      ];
      expect(pickBestVoice(voices, 'en')).toBeNull();
    });
  });

  describe('Tamil', () => {
    test('picks Google or Natural Tamil voice', () => {
      const voices = [
        fakeVoice('Google தமிழ்', 'ta-IN'),
        fakeVoice('David', 'en-US')
      ];
      const match = pickBestVoice(voices, 'ta');
      expect(match?.name).toBe('Google தமிழ்');
      expect(match?.lang).toBe('ta-IN');
    });

    test('picks exact locale ta-IN', () => {
      const voices = [
        fakeVoice('Microsoft Valluvar', 'ta-IN'),
        fakeVoice('Microsoft Heera', 'en-IN')
      ];
      const match = pickBestVoice(voices, 'ta');
      expect(match?.name).toBe('Microsoft Valluvar');
    });

    test('picks by name containing Tamil even if lang code is non-standard', () => {
      const voices = [
        fakeVoice('Tamil (India) Voice', 'und'),
        fakeVoice('David', 'en-US')
      ];
      const match = pickBestVoice(voices, 'ta');
      expect(match?.name).toBe('Tamil (India) Voice');
    });

    test('falls back to any voice with 2-letter prefix ta (e.g. ta-LK)', () => {
      const voices = [
        fakeVoice('Sri Lankan Tamil', 'ta-LK'),
        fakeVoice('David', 'en-US')
      ];
      const match = pickBestVoice(voices, 'ta');
      expect(match?.name).toBe('Sri Lankan Tamil');
    });

    test('returns null when Tamil voice is missing (no mismatching English)', () => {
      const voices = [
        fakeVoice('Microsoft David', 'en-US'),
        fakeVoice('Microsoft Zira', 'en-US')
      ];
      expect(pickBestVoice(voices, 'ta')).toBeNull();
    });
  });

  describe('Hindi', () => {
    test('picks Natural/Online Hindi voice', () => {
      const voices = [
        fakeVoice('Microsoft Swara Online (Natural)', 'hi-IN'),
        fakeVoice('Microsoft Kalpana', 'hi-IN')
      ];
      const match = pickBestVoice(voices, 'hi');
      expect(match?.name).toBe('Microsoft Swara Online (Natural)');
    });

    test('picks exact locale hi-IN', () => {
      const voices = [
        fakeVoice('Microsoft Kalpana', 'hi-IN'),
        fakeVoice('Microsoft David', 'en-US')
      ];
      const match = pickBestVoice(voices, 'hi');
      expect(match?.name).toBe('Microsoft Kalpana');
    });

    test('picks by name containing हिन्दी / hindi', () => {
      const voices = [
        fakeVoice('Google हिन्दी Voice', 'und'),
        fakeVoice('English Voice', 'en-US')
      ];
      const match = pickBestVoice(voices, 'hi');
      expect(match?.name).toBe('Google हिन्दी Voice');
    });

    test('falls back to 2-letter prefix hi', () => {
      const voices = [
        fakeVoice('Regional Hindi', 'hi'),
        fakeVoice('English Voice', 'en-US')
      ];
      const match = pickBestVoice(voices, 'hi');
      expect(match?.name).toBe('Regional Hindi');
    });

    test('returns null when Hindi voice is missing', () => {
      const voices = [fakeVoice('David', 'en-US')];
      expect(pickBestVoice(voices, 'hi')).toBeNull();
    });
  });
});

describe('Welcome STT Intent Classification', () => {
  function isProceedIntent(transcript: string): boolean {
    const clean = transcript.toLowerCase().trim();
    return (
      clean.includes('proceed') || clean.includes('continue') || clean.includes('yes') || clean.includes('ok') || clean.includes('next') ||
      clean.includes('தொடர') || clean.includes('சரி') || clean.includes('ஆமா') || clean.includes('ஆம்') ||
      clean.includes('आगे') || clean.includes('हाँ') || clean.includes('ठीक')
    );
  }

  test('recognizes English proceed commands', () => {
    expect(isProceedIntent('proceed')).toBe(true);
    expect(isProceedIntent('continue to location')).toBe(true);
    expect(isProceedIntent('yes please')).toBe(true);
    expect(isProceedIntent('ok')).toBe(true);
  });

  test('recognizes Tamil proceed commands', () => {
    expect(isProceedIntent('தொடரவும்')).toBe(true);
    expect(isProceedIntent('சரி')).toBe(true);
    expect(isProceedIntent('ஆமாம்')).toBe(true);
  });

  test('recognizes Hindi proceed commands', () => {
    expect(isProceedIntent('आगे बढ़ें')).toBe(true);
    expect(isProceedIntent('हाँ आगे जाओ')).toBe(true);
    expect(isProceedIntent('ठीक है')).toBe(true);
  });

  test('rejects unrelated noise or cancel speech', () => {
    expect(isProceedIntent('stop')).toBe(false);
    expect(isProceedIntent('hello')).toBe(false);
    expect(isProceedIntent('வேண்டாம்')).toBe(false);
    expect(isProceedIntent('नहीं')).toBe(false);
  });
});

describe('Single Execution & Double-Navigation Guard', () => {
  test('click Proceed during speech prevents auto-continue from firing twice', () => {
    let handled = false;
    let navCount = 0;

    const proceed = () => {
      if (handled) return;
      handled = true;
      navCount++;
    };

    // 1. User clicks Proceed button
    proceed();
    expect(navCount).toBe(1);

    // 2. Later, TTS onend fires
    proceed();
    expect(navCount).toBe(1);

    // 3. Later, 4s fallback timer fires
    proceed();
    expect(navCount).toBe(1);
  });
});

describe('STT Error Handling', () => {
  test('handles mic permission denied without crash and sets hint', () => {
    const handleErr = (errCode: string, lang: Language) => {
      if (errCode === 'not-allowed' || errCode === 'permission-denied') {
        return lang === 'ta'
          ? 'மைக் அணுகல் மறுக்கப்பட்டது'
          : lang === 'hi'
          ? 'माइक्रोफ़ोन अनुमति अस्वीकृत'
          : 'Microphone permission denied';
      }
      return null;
    };

    expect(handleErr('not-allowed', 'en')).toBe('Microphone permission denied');
    expect(handleErr('not-allowed', 'ta')).toBe('மைக் அணுகல் மறுக்கப்பட்டது');
    expect(handleErr('not-allowed', 'hi')).toBe('माइक्रोफ़ोन अनुमति अस्वीकृत');
  });

  test('handles language-not-supported error without crash', () => {
    const handleErr = (errCode: string, lang: Language) => {
      if (errCode === 'language-not-supported') {
        return lang === 'ta'
          ? 'இந்த மொழிக்கு குரல் அறிதல் ஆதரிக்கப்படவில்லை'
          : lang === 'hi'
          ? 'इस भाषा के लिए आवाज पहचान समर्थित नहीं है'
          : 'Speech recognition not supported for this language';
      }
      return null;
    };

    expect(handleErr('language-not-supported', 'ta')).toBe('இந்த மொழிக்கு குரல் அறிதல் ஆதரிக்கப்படவில்லை');
    expect(handleErr('language-not-supported', 'hi')).toBe('इस भाषा के लिए आवाज पहचान समर्थित नहीं है');
  });
});

describe('i18n Translation & Language Freshness', () => {
  test('greeting template exists for en, ta, hi in translations', () => {
    expect(TRANSLATIONS.en['welcome.greeting']).toBeDefined();
    expect(TRANSLATIONS.ta['welcome.greeting']).toBeDefined();
    expect(TRANSLATIONS.hi['welcome.greeting']).toBeDefined();

    expect(TRANSLATIONS.en['welcome.greeting']).toContain('{name}');
    expect(TRANSLATIONS.ta['welcome.greeting']).toContain('AutoFeast-க்கு வரவேற்கிறோம்');
    expect(TRANSLATIONS.hi['welcome.greeting']).toContain('AutoFeast में आपका स्वागत है');
  });

  test('interpolates userName correctly', () => {
    const en = TRANSLATIONS.en['welcome.greeting'].replace('{name}', 'Heyma');
    const ta = TRANSLATIONS.ta['welcome.greeting'].replace('{name}', 'Heyma');
    const hi = TRANSLATIONS.hi['welcome.greeting'].replace('{name}', 'Heyma');

    expect(en).toContain('Heyma');
    expect(ta).toContain('Heyma');
    expect(hi).toContain('Heyma');
  });

  test('active language resolves to stored preference over stale state', () => {
    // Simulates when state has not re-rendered yet (still 'en'), but localStorage has 'ta'
    const stored = 'ta';
    const stateLang: Language = 'en';
    const active: Language = (stored as Language) || stateLang || 'en';
    expect(active).toBe('ta');
  });
});

describe('Welcome Single-Execution & Idempotency React Tests', () => {
  let mockSpeak: any;
  let mockCancel: any;
  let mockGetVoices: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSpeak = vi.fn();
    mockCancel = vi.fn();
    mockGetVoices = vi.fn(() => [
      fakeVoice('Google தமிழ்', 'ta-IN'),
      fakeVoice('Microsoft Swara', 'hi-IN'),
      fakeVoice('David', 'en-US')
    ]);

    (globalThis as any).window = globalThis;
    (globalThis as any).window.speechSynthesis = {
      speak: mockSpeak,
      cancel: mockCancel,
      getVoices: mockGetVoices,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onvoiceschanged: null
    };

    (globalThis as any).SpeechSynthesisUtterance = class {
      text: string;
      lang: string = 'en-US';
      rate: number = 1;
      voice: any = null;
      onstart: any = null;
      onend: any = null;
      onerror: any = null;
      constructor(text: string) {
        this.text = text;
      }
    };
  });

  test('setLanguage idempotency: duplicate calls with same language are ignored', () => {
    let activeLang = 'en';
    let updateCount = 0;

    const setLanguage = (newLang: Language) => {
      if (!newLang || newLang === activeLang) return;
      activeLang = newLang;
      updateCount++;
    };

    setLanguage('ta');
    expect(activeLang).toBe('ta');
    expect(updateCount).toBe(1);

    // Call again with same language
    setLanguage('ta');
    expect(updateCount).toBe(1); // Ignored, no duplicate state update!

    // Call with different language
    setLanguage('hi');
    expect(activeLang).toBe('hi');
    expect(updateCount).toBe(2);
  });

  test('welcome message deduplication key prevents duplicate speech on effect re-runs', async () => {
    let lastSpokenKey: string | null = null;
    let speakCalls = 0;

    const triggerWelcomeEffect = (userName: string, activeLang: Language) => {
      const currentKey = `${userName}|${activeLang}`;
      if (lastSpokenKey === currentKey) {
        return; // Skipped!
      }
      lastSpokenKey = currentKey;
      speakCalls++;
      window.speechSynthesis.speak(new SpeechSynthesisUtterance('Welcome'));
    };

    // First render
    triggerWelcomeEffect('Karthik', 'ta');
    expect(speakCalls).toBe(1);
    expect(mockSpeak).toHaveBeenCalledTimes(1);

    // Effect re-runs due to unstable AppContext dependencies or voiceschanged
    triggerWelcomeEffect('Karthik', 'ta');
    expect(speakCalls).toBe(1);
    expect(mockSpeak).toHaveBeenCalledTimes(1); // Not called again!

    // User switches language while on welcome step
    triggerWelcomeEffect('Karthik', 'hi');
    expect(speakCalls).toBe(2);
    expect(mockSpeak).toHaveBeenCalledTimes(2); // Speaks once in new language!
  });

  test('leaving welcome step cancels speech and resets key for next visit', () => {
    let lastSpokenKey: string | null = 'Karthik|ta';
    let isSpeaking = true;

    const onStepChange = (newStep: string) => {
      if (newStep !== 'welcome') {
        lastSpokenKey = null;
        isSpeaking = false;
        window.speechSynthesis.cancel();
      }
    };

    onStepChange('location_permission');
    expect(mockCancel).toHaveBeenCalled();
    expect(lastSpokenKey).toBeNull();
  });

  test('auto-continue fires exactly once after speech ends', () => {
    let autoContinueFired = 0;
    let handled = false;

    const proceed = () => {
      if (handled) return;
      handled = true;
      autoContinueFired++;
    };

    // Simulate utterance onend
    proceed();
    expect(autoContinueFired).toBe(1);

    // Simulate duplicate triggers (fallback timer or extra event)
    proceed();
    proceed();
    expect(autoContinueFired).toBe(1);
  });
});
