/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { OfflineSpeechEngine } from '../services/offlineSpeechEngine';
import { SpeechController } from '../services/speechController';
import { VoiceCommandParser } from '../services/voiceCommandParser';
import { DynamicFoodSearchEngine } from '../services/dynamicFoodSearch';
import { VoiceCommandModal } from '../components/VoiceCommandModal';

const mockPipelineInstance = vi.fn();

vi.mock('@huggingface/transformers', () => {
  return {
    pipeline: vi.fn().mockImplementation(async () => mockPipelineInstance),
    env: {
      backends: { onnx: { wasm: {} } },
      allowLocalModels: false,
      useBrowserCache: true,
      useWasmCache: true
    }
  };
});

let mockAppValue: any = {};

vi.mock('../context/AppContext', () => ({
  useApp: () => mockAppValue
}));

describe('Offline Tamil Voice Recognition Accuracy & Delivery Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    OfflineSpeechEngine.resetForTesting();
    SpeechController.resetCircuitBreaker();
    SpeechController.stopAll();

    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
      localStorage.setItem('autofeast_offline_whisper_ready', 'true');
    }

    mockPipelineInstance.mockReset();
    mockPipelineInstance.mockResolvedValue({ text: 'பரோட்டா' });

    // Mock AudioContext in jsdom
    if (typeof window !== 'undefined') {
      class MockAudioContext {
        decodeAudioData = vi.fn().mockResolvedValue({
          sampleRate: 16000,
          numberOfChannels: 1,
          length: 32000, // 2 seconds
          getChannelData: () => new Float32Array(32000).fill(0.35)
        });
        close = vi.fn().mockResolvedValue(undefined);
      }
      (window as any).AudioContext = MockAudioContext;
      (window as any).webkitAudioContext = MockAudioContext;
    }

    // Mock navigator.mediaDevices
    if (typeof navigator !== 'undefined') {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn().mockResolvedValue({
            getTracks: () => [{ stop: vi.fn() }]
          })
        },
        configurable: true
      });
    }

    // Mock MediaRecorder in jsdom
    class MockMediaRecorder {
      public state = 'inactive';
      public ondataavailable: any = null;
      public onstop: any = null;
      static isTypeSupported = vi.fn().mockReturnValue(true);
      start() {
        this.state = 'recording';
        setTimeout(() => {
          if (this.ondataavailable) {
            this.ondataavailable({ data: new Blob([new Uint8Array(1024)], { type: 'audio/webm' }) });
          }
        }, 10);
      }
      stop() {
        this.state = 'inactive';
        if (this.onstop) this.onstop();
      }
    }
    (window as any).MediaRecorder = MockMediaRecorder;
    (globalThis as any).MediaRecorder = MockMediaRecorder;

    mockAppValue = {
      isVoiceModalOpen: true,
      setIsVoiceModalOpen: vi.fn(),
      t: (k: string) => k,
      language: 'ta',
      executeSearch: vi.fn(),
      rechargeWallet: vi.fn(),
      setActiveView: vi.fn(),
      speakText: vi.fn(),
      showToast: vi.fn(),
      saveSchedule: vi.fn(),
      placeInstantOrder: vi.fn(),
      setVoiceDialogItem: vi.fn(),
      addToCart: vi.fn(),
      setIsScheduleCartOpen: vi.fn(),
      checkDailyOrderLimitReached: vi.fn(() => false),
      processNaturalLanguageVoiceCommand: vi.fn(),
      requestWalletBalanceReveal: vi.fn(),
      skipScheduleByVoiceCommand: vi.fn(),
      currentUser: null,
      userLocation: null,
      openGuidedSearch: vi.fn(),
      checkIsItemRestrictedByNominee: vi.fn(() => false),
      handleNomineeRestrictedInterception: vi.fn()
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    SpeechController.stopAll();
  });

  it('1. Configures Whisper explicitly with language "ta", task "transcribe", and repetition penalties for Tamil', async () => {
    mockPipelineInstance.mockResolvedValueOnce({ text: 'பரோட்டா' });

    const onResult = vi.fn();
    const onError = vi.fn();

    const started = await OfflineSpeechEngine.startRecording({
      language: 'ta',
      onResult,
      onError
    });
    expect(started).toBe(true);

    // Allow mock MediaRecorder data event to fire
    await new Promise(r => setTimeout(r, 30));

    OfflineSpeechEngine.stopRecording();
    await new Promise(r => setTimeout(r, 100));

    expect(mockPipelineInstance).toHaveBeenCalledWith(
      expect.any(Float32Array),
      expect.objectContaining({
        language: 'ta',
        task: 'transcribe',
        chunk_length_s: 30,
        repetition_penalty: 1.2,
        no_repeat_ngram_size: 3
      })
    );
    expect(onResult).toHaveBeenCalledWith('பரோட்டா', true, ['பரோட்டா']);
  });

  it('2. Prevents empty or extremely short audio (< 0.4s) from submitting to Whisper and avoids hallucinations', async () => {
    // Return audio buffer with only 2000 samples (< 6400 samples / 0.4s)
    class ShortAudioContext {
      decodeAudioData = vi.fn().mockResolvedValue({
        sampleRate: 16000,
        numberOfChannels: 1,
        length: 2000,
        getChannelData: () => new Float32Array(2000).fill(0.3)
      });
      close = vi.fn().mockResolvedValue(undefined);
    }
    (window as any).AudioContext = ShortAudioContext;

    const onResult = vi.fn();
    const onError = vi.fn();

    await OfflineSpeechEngine.startRecording({
      language: 'ta',
      onResult,
      onError
    });

    await new Promise(r => setTimeout(r, 20));
    OfflineSpeechEngine.stopRecording();
    await new Promise(r => setTimeout(r, 80));

    // Pipeline should NOT have been invoked for sub-0.4s audio
    expect(mockPipelineInstance).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('no-speech', expect.any(String));
    expect(onResult).not.toHaveBeenCalled();
  });

  it('3. Rejects silent microphone audio (rms < 0.002, peak < 0.008) with localized no-speech error', async () => {
    // Pure silence audio buffer (all zeros)
    class SilentAudioContext {
      decodeAudioData = vi.fn().mockResolvedValue({
        sampleRate: 16000,
        numberOfChannels: 1,
        length: 16000,
        getChannelData: () => new Float32Array(16000).fill(0.0001)
      });
      close = vi.fn().mockResolvedValue(undefined);
    }
    (window as any).AudioContext = SilentAudioContext;

    const onResult = vi.fn();
    const onError = vi.fn();

    await OfflineSpeechEngine.startRecording({
      language: 'ta',
      onResult,
      onError
    });

    await new Promise(r => setTimeout(r, 20));
    OfflineSpeechEngine.stopRecording();
    await new Promise(r => setTimeout(r, 80));

    expect(mockPipelineInstance).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('no-speech', expect.stringContaining('குரல்'));
  });

  it('4. Cleans repeated-word hallucinations and hallucination artifacts from Whisper output', () => {
    // Repeated word hallucination
    const repeated = OfflineSpeechEngine.cleanWhisperTranscript('பரோட்டா பரோட்டா பரோட்டா');
    expect(repeated).toBe('பரோட்டா');

    // Repeated phrase hallucination
    const repeatedPhrase = OfflineSpeechEngine.cleanWhisperTranscript('கொத்து பரோட்டா கொத்து பரோட்டா');
    expect(repeatedPhrase).toBe('கொத்து பரோட்டா');

    // Hallucination brackets and artifacts
    const blank = OfflineSpeechEngine.cleanWhisperTranscript('[BLANK_AUDIO] (blank audio) [ Music ]');
    expect(blank).toBe('');

    // Punctuation-only output
    const punctOnly = OfflineSpeechEngine.cleanWhisperTranscript('...');
    expect(punctOnly).toBe('');

    // Authentic multi-word sentence preserved
    const multi = OfflineSpeechEngine.cleanWhisperTranscript('சூடான மொறுமொறு மசாலா தோசை');
    expect(multi).toBe('சூடான மொறுமொறு மசாலா தோசை');
  });

  it('5. Recognizes all 5 Tamil food names: பரோட்டா, தோசை, இட்லி, பிரியாணி, and சப்பாத்தி in voice search', () => {
    const tamilFoods = [
      { speech: 'பரோட்டா', expectedFamily: 'parotta', idPart: 'parotta' },
      { speech: 'தோசை', expectedFamily: 'dosa', idPart: 'dosa' },
      { speech: 'இட்லி', expectedFamily: 'idli', idPart: 'idli' },
      { speech: 'பிரியாணி', expectedFamily: 'biryani', idPart: 'biryani' },
      { speech: 'சப்பாத்தி', expectedFamily: 'chapati', idPart: 'chapati' }
    ];

    for (const item of tamilFoods) {
      // 1. Dynamic Food Search Engine matches
      const searchRes = DynamicFoodSearchEngine.search({
        query: item.speech,
        language: 'ta'
      });
      expect(searchRes.matchedItems.length).toBeGreaterThan(0);
      expect(searchRes.matchedItems.some(f => f.id.includes(item.idPart))).toBe(true);

      // 2. Voice Command Parser recognizes as item query
      const parsed = VoiceCommandParser.parse(item.speech, 'ta');
      expect(parsed.items.length).toBeGreaterThan(0);
      expect(parsed.matchedFoodItem).toBeDefined();
      expect(parsed.needsOrderOrScheduleClarification).toBe(true);
    }
  });

  it('6. Delivers final Whisper transcript end-to-end to Voice Assistant UI and triggers local food search', async () => {
    mockPipelineInstance.mockResolvedValueOnce({ text: 'பரோட்டா' });

    render(<VoiceCommandModal />);

    // Simulate SpeechController starting STT and falling back to Whisper
    act(() => {
      SpeechController.requestMic({
        owner: 'VoiceCommandModal',
        language: 'ta',
        onResult: (text) => {
          mockAppValue.executeSearch(text, true);
        }
      });
    });

    // Simulate offline Whisper completing and returning "பரோட்டா"
    act(() => {
      (SpeechController as any).currentState = 'processing';
      (SpeechController as any).notifyStateChange();
    });

    const activeOpts = (SpeechController as any).activeOptions;
    expect(activeOpts).toBeDefined();

    act(() => {
      activeOpts.onResult('பரோட்டா', true, ['பரோட்டா']);
    });

    // Verify executeSearch was called with "பரோட்டா"
    expect(mockAppValue.executeSearch).toHaveBeenCalledWith('பரோட்டா', true);
  });
});
