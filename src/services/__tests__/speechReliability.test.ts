import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SpeechController } from '../speechController';
import { SpeechService } from '../speechService';

describe('multilingual speech reliability', () => {
  let startListeningSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    SpeechController.stopMic();
    vi.spyOn(SpeechService, 'isSupported').mockReturnValue(true);
    startListeningSpy = vi.spyOn(SpeechService, 'startListening').mockReturnValue(true);
  });

  afterEach(() => {
    SpeechController.stopMic();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  test('normalizes app languages and explicit locale strings for recognition', () => {
    expect(SpeechService.getLocale('en')).toBe('en-IN');
    expect(SpeechService.getLocale('ta')).toBe('ta-IN');
    expect(SpeechService.getLocale('hi')).toBe('hi-IN');
    expect(SpeechService.getLocale('ta-IN')).toBe('ta-IN');
    expect(SpeechService.getLocale('hi-IN')).toBe('hi-IN');
  });

  test('restarts one continuous listener once after a no-speech end', () => {
    vi.useFakeTimers();
    const started = SpeechController.requestMic({
      owner: 'continuous_test',
      language: 'ta',
      continuous: true,
      onResult: vi.fn()
    });

    expect(started).toBe(true);
    expect(startListeningSpy).toHaveBeenCalledTimes(1);

    const firstSession = startListeningSpy.mock.calls[0][0];
    firstSession.onError?.('no-speech');
    firstSession.onEnd?.();
    vi.advanceTimersByTime(400);

    expect(startListeningSpy).toHaveBeenCalledTimes(2);
    expect(startListeningSpy.mock.calls[1][0].language).toBe('ta');
    SpeechController.releaseMic('continuous_test');
  });

  test('defers microphone activation while browser speech synthesis is active', () => {
    vi.useFakeTimers();
    Object.defineProperty(window.speechSynthesis, 'speaking', { configurable: true, value: true });

    SpeechController.requestMic({
      owner: 'tts_lock_test',
      language: 'en',
      onResult: vi.fn()
    });
    expect(startListeningSpy).not.toHaveBeenCalled();

    Object.defineProperty(window.speechSynthesis, 'speaking', { configurable: true, value: false });
    vi.advanceTimersByTime(300);
    expect(startListeningSpy).toHaveBeenCalledTimes(1);
    SpeechController.releaseMic('tts_lock_test');
  });

  test('stops after the configured silence window and calls the prompt fallback once', () => {
    vi.useFakeTimers();
    const onSilence = vi.fn();

    SpeechController.requestMic({
      owner: 'silence_test',
      language: 'ta',
      continuous: true,
      silenceTimeoutMs: 8000,
      onSilence,
      onResult: vi.fn()
    });

    startListeningSpy.mock.calls[0][0].onStart?.();
    vi.advanceTimersByTime(7999);
    expect(onSilence).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onSilence).toHaveBeenCalledTimes(1);
    expect(SpeechController.getState()).toBe('idle');
    SpeechController.releaseMic('silence_test');
  });
});
