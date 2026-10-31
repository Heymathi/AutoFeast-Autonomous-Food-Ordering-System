

// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpeechController } from '../services/speechController';
import { OfflineSpeechEngine } from '../services/offlineSpeechEngine';

if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = globalThis;
}

describe('SpeechController Step 2: Error Handling & Mic Exclusivity Fallback', () => {
  let mockInstances: any[] = [];
  let offlineStartSpy: any;
  let offlineStopSpy: any;

  beforeEach(() => {
    mockInstances = [];
    SpeechController.resetCircuitBreaker();
    SpeechController.stopAll();

    // Mock Web Speech Recognition
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

    // Reset localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    // Mock OfflineSpeechEngine methods
    offlineStartSpy = vi.spyOn(OfflineSpeechEngine, 'startRecording').mockImplementation(async (opts) => {
      return true;
    });
    offlineStopSpy = vi.spyOn(OfflineSpeechEngine, 'stopRecording').mockImplementation(() => { });
  });

  afterEach(() => {
    SpeechController.stopAll();
    SpeechController.resetCircuitBreaker();
    vi.restoreAllMocks();
  });

  it('1. Web Speech network error triggers fallback to Offline Whisper when model is downloaded', async () => {
    // Simulate model is downloaded
    vi.spyOn(OfflineSpeechEngine, 'getModelStatus').mockReturnValue({
      isDownloaded: true,
      sizeMb: 39,
      modelName: 'Whisper Multilingual Tiny'
    });

    const onResult = vi.fn();
    const onError = vi.fn();

    const started = SpeechController.requestMic({
      owner: 'food_search',
      language: 'en',
      onResult,
      onError
    });

    expect(started).toBe(true);
    expect(SpeechController.getActiveSttEngine()).toBe('webspeech');
    expect(mockInstances.length).toBe(1);

    const activeRec = mockInstances[0];

    // Trigger recoverable network error
    activeRec.onerror({ error: 'network' });

    // Exclusivity wait is 80ms
    await new Promise((r) => setTimeout(r, 120));

    // Offline Whisper should have been initiated
    expect(offlineStartSpy).toHaveBeenCalledTimes(1);
    expect(SpeechController.getActiveSttEngine()).toBe('whisper');
    expect(onError).not.toHaveBeenCalled();
  });

  it('2. Web Speech network error surfaces error if model is NOT downloaded', async () => {
    vi.spyOn(OfflineSpeechEngine, 'getModelStatus').mockReturnValue({
      isDownloaded: false,
      sizeMb: 39,
      modelName: 'Whisper Multilingual Tiny'
    });

    const onError = vi.fn();
    SpeechController.requestMic({
      owner: 'food_search',
      language: 'en',
      onResult: () => { },
      onError
    });

    const activeRec = mockInstances[0];
    activeRec.onerror({ error: 'network' });

    await new Promise((r) => setTimeout(r, 120));

    expect(offlineStartSpy).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('network', expect.any(String));
    expect(SpeechController.getActiveSttEngine()).toBe('none');
  });

  it('3. Terminal permission error (not-allowed) reports error immediately and NEVER attempts Whisper or retry', async () => {
    vi.spyOn(OfflineSpeechEngine, 'getModelStatus').mockReturnValue({
      isDownloaded: true,
      sizeMb: 39,
      modelName: 'Whisper Multilingual Tiny'
    });

    const onError = vi.fn();
    SpeechController.requestMic({
      owner: 'food_search',
      language: 'ta',
      onResult: () => { },
      onError
    });

    const activeRec = mockInstances[0];
    activeRec.onerror({ error: 'not-allowed' });

    await new Promise((r) => setTimeout(r, 120));

    expect(offlineStartSpy).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('not-allowed', expect.stringContaining('மைக்'));
    expect(SpeechController.getState().voiceState).toBe('error');
    expect(SpeechController.getActiveSttEngine()).toBe('none');
  });

  it('4. Terminal missing mic error (audio-capture) reports error immediately and does not retry', async () => {
    const onError = vi.fn();
    SpeechController.requestMic({
      owner: 'food_search',
      language: 'en',
      onResult: () => { },
      onError
    });

    const activeRec = mockInstances[0];
    activeRec.onerror({ error: 'audio-capture' });

    await new Promise((r) => setTimeout(r, 120));

    expect(offlineStartSpy).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('audio-capture', expect.stringMatching(/mic/i));
    expect(SpeechController.getState().voiceState).toBe('error');
  });

  it('5. Aborted event transitions cleanly to idle without retries or Whisper fallback', async () => {
    vi.spyOn(OfflineSpeechEngine, 'getModelStatus').mockReturnValue({
      isDownloaded: true,
      sizeMb: 39,
      modelName: 'Whisper Multilingual Tiny'
    });

    const onError = vi.fn();
    SpeechController.requestMic({
      owner: 'food_search',
      language: 'en',
      onResult: () => { },
      onError
    });

    const activeRec = mockInstances[0];
    activeRec.onerror({ error: 'aborted' });

    await new Promise((r) => setTimeout(r, 120));

    expect(offlineStartSpy).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(SpeechController.getState().voiceState).toBe('idle');
  });

  it('6. Microphone session exclusivity: Web Speech stops and releases before Whisper starts', async () => {
    vi.spyOn(OfflineSpeechEngine, 'getModelStatus').mockReturnValue({
      isDownloaded: true,
      sizeMb: 39,
      modelName: 'Whisper Multilingual Tiny'
    });

    const engineTimeline: string[] = [];

    SpeechController.requestMic({
      owner: 'food_search',
      language: 'en',
      onResult: () => { }
    });

    engineTimeline.push(`init:${SpeechController.getActiveSttEngine()}`);

    const activeRec = mockInstances[0];
    // Trigger network error
    activeRec.onerror({ error: 'network' });

    // Immediately after error, Web Speech was stopped and engine reset to 'none'
    engineTimeline.push(`immediate:${SpeechController.getActiveSttEngine()}`);

    // Wait for the exclusivity delay to complete
    await new Promise((r) => setTimeout(r, 120));
    engineTimeline.push(`after-fallback:${SpeechController.getActiveSttEngine()}`);

    expect(engineTimeline).toEqual([
      'init:webspeech',
      'immediate:none',
      'after-fallback:whisper'
    ]);
  });

  it('7. User cancellation during fallback aborts transition and prevents Whisper from starting', async () => {
    vi.spyOn(OfflineSpeechEngine, 'getModelStatus').mockReturnValue({
      isDownloaded: true,
      sizeMb: 39,
      modelName: 'Whisper Multilingual Tiny'
    });

    SpeechController.requestMic({
      owner: 'food_search',
      language: 'en',
      onResult: () => { }
    });

    const activeRec = mockInstances[0];
    activeRec.onerror({ error: 'network' });

    // User stops mic during the 80ms transition window
    SpeechController.stopMic('food_search');

    await new Promise((r) => setTimeout(r, 120));

    expect(offlineStartSpy).not.toHaveBeenCalled();
    expect(SpeechController.getActiveSttEngine()).toBe('none');
    expect(SpeechController.getState().voiceState).toBe('idle');
  });

  it('8. Duplicate error events during in-flight fallback do not trigger duplicate Whisper sessions', async () => {
    vi.spyOn(OfflineSpeechEngine, 'getModelStatus').mockReturnValue({
      isDownloaded: true,
      sizeMb: 39,
      modelName: 'Whisper Multilingual Tiny'
    });

    SpeechController.requestMic({
      owner: 'food_search',
      language: 'en',
      onResult: () => { }
    });

    const activeRec = mockInstances[0];
    const errorHandler = activeRec.onerror;

    // Fire network error handler multiple times rapidly before transition completes
    errorHandler({ error: 'network' });
    errorHandler({ error: 'service-not-allowed' });
    errorHandler({ error: 'network' });

    await new Promise((r) => setTimeout(r, 120));

    expect(offlineStartSpy).toHaveBeenCalledTimes(1);
  });

  it('9. Stale callbacks from previous sessions are ignored when turn changes', async () => {
    vi.spyOn(OfflineSpeechEngine, 'getModelStatus').mockReturnValue({
      isDownloaded: true,
      sizeMb: 39,
      modelName: 'Whisper Multilingual Tiny'
    });

    let whisperCallback: any;
    offlineStartSpy.mockImplementation(async (opts: any) => {
      whisperCallback = opts;
      return true;
    });

    const onResult = vi.fn();
    SpeechController.requestMic({
      owner: 'food_search',
      language: 'en',
      onResult
    });

    const activeRec = mockInstances[0];
    activeRec.onerror({ error: 'network' });

    await new Promise((r) => setTimeout(r, 120));

    expect(whisperCallback).toBeDefined();

    // Now user stops and changes session
    SpeechController.stopMic('food_search');

    // Stale whisper onResult fires after cancellation
    whisperCallback.onResult('masala dosa', true, ['masala dosa']);

    expect(onResult).not.toHaveBeenCalled();
  });

  it('10. Never starts Gemini or network services for voice recognition', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    vi.spyOn(OfflineSpeechEngine, 'getModelStatus').mockReturnValue({
      isDownloaded: true,
      sizeMb: 39,
      modelName: 'Whisper Multilingual Tiny'
    });

    SpeechController.requestMic({
      owner: 'food_search',
      language: 'ta',
      onResult: () => { }
    });

    const activeRec = mockInstances[0];
    activeRec.onerror({ error: 'network' });

    await new Promise((r) => setTimeout(r, 120));

    // Verify fetch was never invoked for Gemini or any network endpoint during offline STT fallback
    const geminiOrNetworkCalls = fetchSpy.mock.calls.filter((c: any) => {
      const url = String(c[0]);
      return url.includes('search-fallback') || url.includes('gemini');
    });

    expect(geminiOrNetworkCalls.length).toBe(0);
  });
});
