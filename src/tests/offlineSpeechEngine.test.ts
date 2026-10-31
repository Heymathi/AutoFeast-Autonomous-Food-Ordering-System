import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OfflineSpeechEngine } from '../services/offlineSpeechEngine';

describe('OfflineSpeechEngine - Step 1 Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
});
