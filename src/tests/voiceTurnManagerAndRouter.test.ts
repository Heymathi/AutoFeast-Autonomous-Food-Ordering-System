// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpeechController } from '../services/speechController';
import { SpeechService } from '../services/speechService';
import { VoiceIntentRouter } from '../services/voiceIntentRouter';
import { ChooserVoiceService } from '../services/chooserVoiceService';
import { parsePinSpeech } from '../services/pinVoiceParserService';

if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = globalThis;
}

describe('Voice Turn Manager, Circuit Breaker, Intent Router & PIN Voice Rules', () => {
  let mockInstances: any[] = [];
  let speakSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockInstances = [];
    SpeechController.resetCircuitBreaker();
    SpeechController.stopAll();

    speakSpy = vi.fn((utterance: any) => {
      setTimeout(() => {
        if (utterance.onend) utterance.onend();
      }, 5);
    });

    (globalThis as any).SpeechSynthesisUtterance = class {
      text: string;
      lang: string = 'en-IN';
      voice: any = null;
      rate: number = 1;
      pitch: number = 1;
      volume: number = 1;
      onend: (() => void) | null = null;
      onerror: ((e: any) => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    };

    const mockSpeechSynthesis = {
      speaking: false,
      pending: false,
      paused: false,
      // Only English voice installed -> simulates missing Tamil ('ta') & Hindi ('hi') voice in browser
      getVoices: vi.fn(() => [{ name: 'English India', lang: 'en-IN' }]),
      speak: speakSpy,
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      onvoiceschanged: null
    };

    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'speechSynthesis', {
        value: mockSpeechSynthesis,
        writable: true,
        configurable: true
      });

      class MockSpeechRecognition {
        lang = 'en-IN';
        continuous = false;
        interimResults = true;
        maxAlternatives = 5;
        onstart: (() => void) | null = null;
        onresult: ((e: any) => void) | null = null;
        onerror: ((e: any) => void) | null = null;
        onend: (() => void) | null = null;
        start = vi.fn(() => {
          if (this.onstart) this.onstart();
        });
        abort = vi.fn(() => {
          if (this.onerror) this.onerror({ error: 'aborted' });
          if (this.onend) this.onend();
        });
        stop = vi.fn(() => {
          if (this.onend) this.onend();
        });
        constructor() {
          mockInstances.push(this);
        }
      }

      (window as any).SpeechRecognition = MockSpeechRecognition;
      (window as any).webkitSpeechRecognition = MockSpeechRecognition;
    }

    // Mock fetch for /api/tts fallback
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, fallback: true })
    } as any);
  });

  afterEach(() => {
    SpeechController.stopAll();
    SpeechController.resetCircuitBreaker();
    vi.restoreAllMocks();
  });

  it('1. A failing TTS (no Tamil voice) transitions to LISTENING once and never restarts a turn or re-triggers speak via toast fallback', async () => {
    let onEndCalls = 0;
    let reentrantSpeakCalls = 0;

    SpeechController.speak(
      'மசாலா தோசை ஆர்டர் செய்யவா?',
      'ta',
      () => {
        onEndCalls += 1;
        SpeechController.requestMic({
          owner: 'item_chooser',
          language: 'ta',
          onResult: () => {}
        });
      },
      (fallbackText) => {
        // Simulate AppContext.showToast calling speakText(fallbackText) inside onToastFallback!
        reentrantSpeakCalls += 1;
        SpeechController.speak(fallbackText, 'ta', undefined, undefined, 'user_action');
      },
      'item_chooser',
      'item_chooser_dosa'
    );

    await new Promise(resolve => setTimeout(resolve, 40));

    expect(reentrantSpeakCalls).toBe(1);
    expect(onEndCalls).toBe(1);
    expect(mockInstances.length).toBe(1);
    expect(SpeechController.getTurnState()).toBe('LISTENING');
  });

  it('2. STT end / abort never re-triggers speak or infinite recognition loops', async () => {
    let speakCount = 0;
    const origSpeak = SpeechController.speak.bind(SpeechController);
    const spyControllerSpeak = vi.spyOn(SpeechController, 'speak').mockImplementation((...args) => {
      speakCount += 1;
      return origSpeak(...args);
    });

    SpeechController.requestMic({
      owner: 'item_chooser',
      language: 'ta',
      continuous: false,
      onResult: () => {}
    });

    expect(mockInstances.length).toBe(1);
    const inst = mockInstances[0];

    // Simulate external abort + end
    inst.onerror?.({ error: 'aborted' });
    inst.onend?.();

    await new Promise(resolve => setTimeout(resolve, 400));

    // Intentional/external abort must NEVER restart STT or trigger speak
    expect(mockInstances.length).toBe(1);
    expect(speakCount).toBe(0);
    expect(SpeechController.getTurnState()).toBe('IDLE');
    spyControllerSpeak.mockRestore();
  });

  it('3. More than 5 speech sessions within 10s trips the circuit breaker and pauses voice until user clicks mic', () => {
    const errors: string[] = [];

    for (let i = 1; i <= 6; i++) {
      SpeechController.stopMic();
      SpeechController.requestMic({
        owner: `loop_owner_${i}`,
        language: 'ta',
        onResult: () => {},
        onError: (code) => errors.push(code)
      });
    }

    expect(SpeechController.isCircuitBreakerTripped()).toBe(true);
    expect(errors).toContain('circuit-breaker');
    expect(mockInstances.length).toBe(5);

    // Further automatic mic requests are blocked while breaker is tripped
    const blockedStart = SpeechController.requestMic({
      owner: 'blocked_owner',
      language: 'ta',
      onResult: () => {}
    });
    expect(blockedStart).toBe(false);

    // Manual user mic gesture resets circuit breaker
    SpeechController.markUserGesture();
    expect(SpeechController.isCircuitBreakerTripped()).toBe(false);
  });

  it('4. A prompt is spoken once per turn (deduplicated against re-renders)', () => {
    SpeechController.startNewTurn('test_turn');
    const prompt = 'Order Masala Dosa now, schedule for later, or add to cart?';

    SpeechController.speak(prompt, 'en', undefined, undefined, 'item_chooser', 'chooser_prompt_1');
    // Simulate duplicate re-render calling speak with same prompt in same turn
    SpeechController.speak(prompt, 'en', undefined, undefined, 'item_chooser', 'chooser_prompt_1');
    SpeechController.speak(prompt, 'en', undefined, undefined, 'user_action', 'chooser_prompt_1');

    expect(speakSpy).toHaveBeenCalledTimes(1);
  });

  it('5. Intent router maps "order now", "schedule", and "add to cart" in en/ta/hi (plus Tanglish & Hinglish) to the right handler', () => {
    const handlers = {
      order_now: vi.fn(),
      schedule: vi.fn(),
      add_to_cart: vi.fn()
    };

    const dispatchVoiceChoice = (utterance: string, lang: 'en' | 'ta' | 'hi') => {
      const action = ChooserVoiceService.parseChooserAction([utterance], '', lang);
      if (action === 'order_now') handlers.order_now();
      else if (action === 'schedule') handlers.schedule();
      else if (action === 'add_to_cart') handlers.add_to_cart();
    };

    // Order Now in EN, TA, Tanglish, HI, Hinglish
    for (const phrase of ['order now', 'order', 'ippove order', 'இப்போதே ஆர்டர்', 'ஆர்டர் பண்ணு', 'अभी ऑर्डर', 'ऑर्डर करो']) {
      dispatchVoiceChoice(phrase, 'ta');
    }
    expect(handlers.order_now).toHaveBeenCalledTimes(7);

    // Schedule in EN, TA, Tanglish, HI, Hinglish
    for (const phrase of ['schedule', 'later', 'thittamidu', 'திட்டமிடு', 'schedule pannu', 'बाद में', 'शेड्यूल']) {
      dispatchVoiceChoice(phrase, 'ta');
    }
    expect(handlers.schedule).toHaveBeenCalledTimes(7);

    // Add to Cart in EN, TA, HI
    for (const phrase of ['add to cart', 'cart', 'கார்ட்டில் சேர்', 'கார்ட்', 'कार्ट में डालो']) {
      dispatchVoiceChoice(phrase, 'hi');
    }
    expect(handlers.add_to_cart).toHaveBeenCalledTimes(5);

    // Confirmation Yes/No across EN, TA, HI
    for (const yesWord of ['yes', 'ok', 'sure', 'aama', 'sari', 'ஆமா', 'ஆம்', 'சரி', 'haan', 'हाँ', 'ठीक है']) {
      expect(VoiceIntentRouter.matchConfirmationIntent(yesWord, 'ta').action).toBe('confirm');
    }
    for (const noWord of ['no', 'illai', 'venam', 'இல்லை', 'வேண்டாம்', 'nahi', 'नहीं', 'cancel', 'stop']) {
      expect(VoiceIntentRouter.matchConfirmationIntent(noWord, 'ta').action).toBe('cancel');
    }
  });

  it('6. 4 spoken digits call verify once; wrong digit length asks to repeat without counting a failed attempt', () => {
    const verifyPinSpy = vi.fn();
    let failedAttempts = 0;

    const handleSpokenPin = (transcript: string, lang: 'en' | 'ta' | 'hi') => {
      const parsed = parsePinSpeech(transcript, lang);
      if (parsed.status === 'success' && parsed.digits.length === 4) {
        const pin = parsed.digits.join('');
        verifyPinSpy(pin);
        if (pin !== '1234') failedAttempts += 1;
        return { verified: true, askRepeat: false };
      }
      // Wrong length (<4 or >4 digits) -> ask to repeat WITHOUT calling verify or counting an attempt!
      return { verified: false, askRepeat: true };
    };

    // 2 digits spoken -> asks to repeat, does NOT call verify, does NOT increment failedAttempts
    const shortRes = handleSpokenPin('one two', 'en');
    expect(shortRes.verified).toBe(false);
    expect(shortRes.askRepeat).toBe(true);
    expect(verifyPinSpy).not.toHaveBeenCalled();
    expect(failedAttempts).toBe(0);

    // 5 digits spoken -> asks to repeat, does NOT call verify, does NOT increment failedAttempts
    const longRes = handleSpokenPin('1 2 3 4 5', 'en');
    expect(longRes.verified).toBe(false);
    expect(longRes.askRepeat).toBe(true);
    expect(verifyPinSpy).not.toHaveBeenCalled();
    expect(failedAttempts).toBe(0);

    // 4 digits spoken in Tamil -> calls verifyPinSpy ONCE with '1234'
    const validTa = handleSpokenPin('ஒன்று இரண்டு மூன்று நான்கு', 'ta');
    expect(validTa.verified).toBe(true);
    expect(verifyPinSpy).toHaveBeenCalledTimes(1);
    expect(verifyPinSpy).toHaveBeenCalledWith('1234');
    expect(failedAttempts).toBe(0);
  });

  it('7. Approve/deny by voice selects the decision handler and still requires the 4-digit nominee PIN', () => {
    const submitDecisionToServer = vi.fn();
    let pinRequiredError = '';

    const handleNomineeDecision = (decision: 'approve' | 'deny', enteredNomineePin: string) => {
      if (!/^\d{4}$/.test(enteredNomineePin)) {
        pinRequiredError = '4-digit Nominee PIN required';
        return false;
      }
      submitDecisionToServer(decision, enteredNomineePin);
      return true;
    };

    // Voice says "approve" (or "அனுமதி" / "मंज़ूर") without PIN entered yet
    const voiceMatch = VoiceIntentRouter.matchNomineePortalIntent('அனுமதி', [], 'ta');
    expect(voiceMatch.action?.type).toBe('approve');

    const allowedWithoutPin = handleNomineeDecision('approve', '');
    expect(allowedWithoutPin).toBe(false);
    expect(pinRequiredError).toBe('4-digit Nominee PIN required');
    expect(submitDecisionToServer).not.toHaveBeenCalled();

    // After 4-digit nominee PIN is provided, decision succeeds
    const allowedWithPin = handleNomineeDecision('approve', '4321');
    expect(allowedWithPin).toBe(true);
    expect(submitDecisionToServer).toHaveBeenCalledOnce();
    expect(submitDecisionToServer).toHaveBeenCalledWith('approve', '4321');
  });
});

