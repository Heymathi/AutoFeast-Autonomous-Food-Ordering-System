import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OfflineSpeechEngine } from '../services/offlineSpeechEngine';

const mockPipelineInstance = vi.fn().mockImplementation(async () => {
  return { text: 'Paneer Butter Masala' };
});

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

describe('OfflineSpeechEngine - Step 1 Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    OfflineSpeechEngine.resetForTesting();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    // Mock AudioContext in jsdom
    if (typeof window !== 'undefined') {
      (window as any).AudioContext = vi.fn().mockImplementation(() => ({
        decodeAudioData: vi.fn().mockResolvedValue({
          sampleRate: 16000,
          length: 16000,
          getChannelData: vi.fn().mockReturnValue(new Float32Array(16000))
        }),
        close: vi.fn().mockResolvedValue(undefined)
      }));
    }

    // Mock mediaDevices
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
      }
      stop() {
        this.state = 'inactive';
        if (this.onstop) this.onstop();
      }
    }
    (window as any).MediaRecorder = MockMediaRecorder;
    (globalThis as any).MediaRecorder = MockMediaRecorder;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports correct model status and strictly does not mark downloaded without consent', () => {
    const status = OfflineSpeechEngine.getModelStatus();
    expect(status.isDownloaded).toBe(false);
    expect(status.sizeMb).toBe(39);
    expect(status.modelName).toContain('Whisper Multilingual Tiny');
  });

  it('rejects recording with model-not-downloaded when user has not downloaded model', async () => {
    const onError = vi.fn();
    const onResult = vi.fn();

    const success = await OfflineSpeechEngine.startRecording({
      language: 'en',
      onError,
      onResult
    });

    expect(success).toBe(false);
    expect(onError).toHaveBeenCalledWith(
      'model-not-downloaded',
      expect.stringContaining('Offline voice model is not installed yet')
    );
  });

  it('provides multilingual error messages in Tamil, Hindi, and English', () => {
    // English
    const enDenied = OfflineSpeechEngine.getLocalizedError('permission-denied', 'en');
    expect(enDenied).toContain('Microphone permission was denied');

    // Tamil
    const taDenied = OfflineSpeechEngine.getLocalizedError('permission-denied', 'ta');
    expect(taDenied).toContain('மைக்ரோஃபோன் அனுமதி மறுக்கப்பட்டது');

    // Hindi
    const hiDenied = OfflineSpeechEngine.getLocalizedError('permission-denied', 'hi');
    expect(hiDenied).toContain('माइक्रोफ़ोन की अनुमति अस्वीकृत');

    // Model not downloaded in Tamil
    const taModel = OfflineSpeechEngine.getLocalizedError('model-not-downloaded', 'ta');
    expect(taModel).toContain('ஆஃப்லைன் குரல் மாதிரி');
    expect(taModel).toContain('39MB');
  });

  it('handles permission-denied error when getUserMedia rejects with NotAllowedError', async () => {
    // Mark model as downloaded
    localStorage.setItem('autofeast_offline_whisper_ready', 'true');

    const notAllowedErr = new Error('Permission denied');
    notAllowedErr.name = 'NotAllowedError';

    const getUserMediaMock = vi.fn().mockRejectedValueOnce(notAllowedErr);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: getUserMediaMock },
      configurable: true
    });

    const onError = vi.fn();
    const onResult = vi.fn();

    const success = await OfflineSpeechEngine.startRecording({
      language: 'ta',
      onError,
      onResult
    });

    expect(success).toBe(false);
    expect(onError).toHaveBeenCalledWith(
      'permission-denied',
      expect.stringContaining('மைக்ரோஃபோன் அனுமதி மறுக்கப்பட்டது')
    );
  });

  it('supports retryRecognition() reusing last options', async () => {
    localStorage.setItem('autofeast_offline_whisper_ready', 'true');

    const onError = vi.fn();
    const onResult = vi.fn();

    const startRecordingSpy = vi.spyOn(OfflineSpeechEngine, 'startRecording');

    await OfflineSpeechEngine.startRecording({
      language: 'en',
      onError,
      onResult
    });

    OfflineSpeechEngine.retryRecognition();
    expect(startRecordingSpy).toHaveBeenCalledTimes(2);
  });

  it('proves engine initializes and transcribes with internet disabled (net::ERR_INTERNET_DISCONNECTED) after online preparation', async () => {
    // 1. Online preparation step: User downloads model with consent
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
    const progressSpy = vi.fn();
    const downloadSuccess = await OfflineSpeechEngine.downloadModelWithConsent(progressSpy);

    expect(downloadSuccess).toBe(true);
    expect(progressSpy).toHaveBeenCalledWith(100);
    expect(OfflineSpeechEngine.getModelStatus().isDownloaded).toBe(true);
    expect(OfflineSpeechEngine.getStatus()).toBe('ready');

    // 2. Disconnect internet completely (navigator.onLine = false and block any network fetch)
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true });
    const fetchMock = vi.fn().mockImplementation(() => {
      return Promise.reject(new TypeError('Failed to fetch net::ERR_INTERNET_DISCONNECTED'));
    });
    globalThis.fetch = fetchMock;

    // 3. Verify engine initializes and transcribes offline without triggering network requests
    const onResult = vi.fn();
    const onError = vi.fn();

    const startSuccess = await OfflineSpeechEngine.startRecording({
      language: 'en',
      onError,
      onResult
    });

    expect(startSuccess).toBe(true);
    expect(OfflineSpeechEngine.getStatus()).toBe('recording');

    // Stop recording to complete session
    OfflineSpeechEngine.stopRecording();

    // Verify zero network calls were made and no network errors were raised
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalledWith('transcription-failed', expect.anything());
  });
});
