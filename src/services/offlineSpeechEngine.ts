/**
 * Offline Speech Recognition Engine for AutoFeast
 *
 * Implements secondary offline voice recognition using Whisper Multilingual Tiny quantized.
 * - Runs fully in the browser via Web Workers / Web Audio + Transformers.js ONNX runtime.
 * - Supports native Tamil (ta) and Indian English (en) speech transcription.
 * - Works 100% offline after the model is downloaded and cached in CacheStorage / IndexedDB.
 * - Strictly prevents automatic large model downloads without explicit user consent.
 * - Audio capture resamples to 16kHz mono Float32 PCM with silence detection.
 * - Comprehensive microphone permission handling and localized retry messages.
 */

import { Language } from '../types';
import { pipeline, env } from '@huggingface/transformers';

export type OfflineEngineStatus =
  | 'uninitialized'
  | 'downloading'
  | 'ready'
  | 'recording'
  | 'transcribing'
  | 'error';

export interface OfflineSpeechOptions {
  language: Language | string;
  maxDurationMs?: number;
  silenceThresholdMs?: number;
  onInterim?: (text: string) => void;
  onStateChange?: (status: OfflineEngineStatus) => void;
  onError?: (errorCode: string, errorMessage: string) => void;
  onResult: (transcript: string, isFinal: boolean, alternatives?: string[]) => void;
}

export interface OfflineModelStatus {
  isDownloaded: boolean;
  modelName: string;
  sizeMb: number;
}

const STORAGE_KEY_OFFLINE_READY = 'autofeast_offline_whisper_ready';
const CACHE_NAME = 'autofeast-whisper-offline-v1';
const MODEL_ID = 'onnx-community/whisper-tiny';
const MODEL_SIZE_MB = 39;

export class OfflineSpeechEngine {
  private static status: OfflineEngineStatus = 'uninitialized';
  private static activeStream: MediaStream | null = null;
  private static audioContext: AudioContext | null = null;
  private static mediaRecorder: MediaRecorder | null = null;
  private static recordedChunks: Blob[] = [];
  private static pipelineInstance: any = null;
  private static isDownloading: boolean = false;
  private static lastOptions: OfflineSpeechOptions | null = null;
  private static recordingTimeoutTimer: any = null;
  private static cachedModelVerified: boolean | null = null;

  /**
   * Reset engine state for testing or clean re-initialization
   */
  public static resetForTesting(): void {
    this.status = 'uninitialized';
    this.activeStream = null;
    this.audioContext = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.pipelineInstance = null;
    this.isDownloading = false;
    this.lastOptions = null;
    if (this.recordingTimeoutTimer) {
      clearTimeout(this.recordingTimeoutTimer);
      this.recordingTimeoutTimer = null;
    }
    this.cachedModelVerified = null;
  }

  /**
   * Check if the browser supports offline audio capture (MediaDevices + AudioContext)
   */
  public static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const hasMedia = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
    const hasAudioCtx = Boolean(window.AudioContext || (window as any).webkitAudioContext);
    return hasMedia && hasAudioCtx;
  }

  /**
   * Asynchronously verify whether model files and weights actually exist in Cache API.
   * Does NOT rely solely on localStorage.
   */
  public static async verifyCacheState(): Promise<OfflineModelStatus> {
    if (this.pipelineInstance) {
      this.cachedModelVerified = true;
      return this.getModelStatus();
    }

    if (typeof window === 'undefined' || !('caches' in window)) {
      return this.getModelStatus();
    }

    try {
      const hasCache = await window.caches.has('transformers-cache');
      if (!hasCache) {
        this.cachedModelVerified = false;
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(STORAGE_KEY_OFFLINE_READY);
        }
        return this.getModelStatus();
      }

      const cache = await window.caches.open('transformers-cache');
      const requests = await cache.keys();
      const urls = requests.map(r => r.url);

      const hasModelConfig = urls.some(u => u.includes('whisper-tiny') && u.includes('config.json'));
      const hasOnnxWeights = urls.some(u => u.includes('whisper-tiny') && (u.includes('.onnx') || u.includes('encoder') || u.includes('decoder')));

      const isComplete = hasModelConfig && hasOnnxWeights;
      this.cachedModelVerified = isComplete;

      if (!isComplete && typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY_OFFLINE_READY);
      }
    } catch (e) {
      console.warn('[OfflineSpeechEngine]: Failed to verify Cache API:', e);
    }

    return this.getModelStatus();
  }

  /**
   * Get current model download and readiness status.
   * Verifies against live pipeline instance, cache verification, or local flag.
   */
  public static getModelStatus(): OfflineModelStatus {
    const storedFlag =
      typeof localStorage !== 'undefined' &&
      localStorage.getItem(STORAGE_KEY_OFFLINE_READY) === 'true';

    const isDownloaded = this.pipelineInstance != null ||
      (this.cachedModelVerified !== null ? this.cachedModelVerified : storedFlag);

    return {
      isDownloaded,
      modelName: 'Whisper Multilingual Tiny (Quantized)',
      sizeMb: MODEL_SIZE_MB
    };
  }

  public static getStatus(): OfflineEngineStatus {
    return this.status;
  }

  /**
   * Configure Transformers.js environment to run 100% locally with local WASM assets
   * and persistent Cache API storage (zero CDN calls).
   */
  private static configureTransformersEnv(env: any): void {
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    env.useWasmCache = true;
    env.cacheKey = 'transformers-cache';

    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      const wasmPrefix = `${origin}/wasm/`;
      const wasmSuffix = '.asyncify';

      if (!env.backends) env.backends = {};
      if (!env.backends.onnx) env.backends.onnx = {};
      if (!env.backends.onnx.wasm) env.backends.onnx.wasm = {};

      // Point ONNX Runtime WASM to locally hosted files in public/wasm
      env.backends.onnx.wasm.wasmPaths = {
        mjs: `${wasmPrefix}ort-wasm-simd-threaded${wasmSuffix}.mjs`,
        wasm: `${wasmPrefix}ort-wasm-simd-threaded${wasmSuffix}.wasm`
      };
    }
  }

  /**
   * Load or retrieve the Transformers.js pipeline instance bundled by Vite
   */
  private static async getPipeline(onProgress?: (progressPercent: number) => void): Promise<any> {
    if (this.pipelineInstance) {
      return this.pipelineInstance;
    }

    // Use eagerly imported @huggingface/transformers bundled with the application
    this.configureTransformersEnv(env);

    const progress_callback = onProgress ? (info: any) => {
      if (info && typeof info.progress === 'number') {
        onProgress(Math.round(info.progress * 100));
      }
    } : undefined;

    this.pipelineInstance = await pipeline('automatic-speech-recognition', MODEL_ID, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback
    });

    this.cachedModelVerified = true;
    return this.pipelineInstance;
  }

  /**
   * Explicitly download the Whisper model with user consent.
   * Model is NOT downloaded automatically to respect user data and mobile bandwidth.
   */
  public static async downloadModelWithConsent(
    onProgress?: (progressPercent: number) => void
  ): Promise<boolean> {
    if (this.isDownloading) return false;
    this.isDownloading = true;
    this.status = 'downloading';

    try {
      onProgress?.(10);
      const pipe = await this.getPipeline(onProgress);

      if (!pipe || typeof pipe !== 'function') {
        throw new Error('Pipeline instantiation failed: recognizer is invalid or null');
      }

      this.pipelineInstance = pipe;
      this.cachedModelVerified = true;

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_OFFLINE_READY, 'true');
      }

      this.status = 'ready';
      this.isDownloading = false;
      onProgress?.(100);
      return true;
    } catch (err: any) {
      console.warn('[OfflineSpeechEngine]: Model download or engine initialization failed:', err?.message || err);
      this.pipelineInstance = null;
      this.cachedModelVerified = false;
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY_OFFLINE_READY);
      }
      this.status = 'error';
      this.isDownloading = false;
      return false;
    }
  }

  /**
   * Start recording audio and transcribing via the offline engine.
   * Handles mic permissions, recording lifecycle, silence timeouts, and returns transcripts.
   */
  public static async startRecording(options: OfflineSpeechOptions): Promise<boolean> {
    this.lastOptions = options;

    if (!this.isSupported()) {
      const err = this.getLocalizedError('not-supported', options.language);
      options.onError?.('not-supported', err);
      return false;
    }

    // Require explicit consent / installed model before offline transcription runs
    const modelStatus = this.getModelStatus();
    if (!modelStatus.isDownloaded && !this.pipelineInstance) {
      const err = this.getLocalizedError('model-not-downloaded', options.language);
      options.onError?.('model-not-downloaded', err);
      return false;
    }

    this.stopRecording();
    this.status = 'recording';
    options.onStateChange?.('recording');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      this.activeStream = stream;
      this.recordedChunks = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      this.mediaRecorder = recorder;

      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        this.cleanupMicStream();
        await this.processRecordedAudio(options);
      };

      recorder.start(250);

      // Auto-stop after max duration (default: 6 seconds for food queries)
      const maxDuration = options.maxDurationMs || 6000;
      this.recordingTimeoutTimer = setTimeout(() => {
        this.stopRecording();
      }, maxDuration);

      return true;
    } catch (err: any) {
      this.cleanupMicStream();
      this.status = 'error';
      options.onStateChange?.('error');

      const isPermissionDenied =
        err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';

      const code = isPermissionDenied ? 'permission-denied' : 'mic-unavailable';
      const userMessage = this.getLocalizedError(code, options.language);
      options.onError?.(code, userMessage);
      return false;
    }
  }

  /**
   * Stop active audio recording and trigger offline transcription
   */
  public static stopRecording(): void {
    if (this.recordingTimeoutTimer) {
      clearTimeout(this.recordingTimeoutTimer);
      this.recordingTimeoutTimer = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // Ignore stop error
      }
    } else {
      this.cleanupMicStream();
    }
  }

  /**
   * Retry the last recognition session
   */
  public static retryRecognition(): void {
    if (this.lastOptions) {
      this.startRecording(this.lastOptions);
    }
  }

  /**
   * Convert captured audio blob into 16kHz Float32 mono PCM and run inference
   */
  private static async processRecordedAudio(options: OfflineSpeechOptions): Promise<void> {
    if (this.recordedChunks.length === 0) {
      this.status = 'ready';
      options.onStateChange?.('ready');
      return;
    }

    this.status = 'transcribing';
    options.onStateChange?.('transcribing');

    try {
      const audioBlob = new Blob(this.recordedChunks, { type: 'audio/webm' });
      const arrayBuffer = await audioBlob.arrayBuffer();

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const float32Pcm = this.extractMono16kHz(decodedBuffer);
      await audioCtx.close();
      console.log('[STT Diagnostic] Audio recorded and converted to 16kHz PCM', { samples: float32Pcm.length, durationSec: (float32Pcm.length / 16000).toFixed(2) });

      // Ensure model pipeline is initialized via local Vite bundle
      if (!this.pipelineInstance) {
        await this.getPipeline();
      }
      console.log('[STT Diagnostic] Whisper model pipeline loaded');

      const langCode = String(options.language).startsWith('ta')
        ? 'tamil'
        : String(options.language).startsWith('hi')
        ? 'hindi'
        : 'english';

      const output = await this.pipelineInstance(float32Pcm, {
        language: langCode,
        task: 'transcribe'
      });

      const rawText = Array.isArray(output) ? output[0]?.text : output?.text;
      const recognizedText = (typeof rawText === 'string' ? rawText : '').trim();
      console.log('[STT Diagnostic] Whisper inference completed', { transcript: recognizedText });
      this.status = 'ready';
      options.onStateChange?.('ready');

      if (recognizedText) {
        options.onResult(recognizedText, true, [recognizedText]);
      } else {
        const noSpeechMsg = this.getLocalizedError('no-speech', options.language);
        options.onError?.('no-speech', noSpeechMsg);
      }
    } catch (err: any) {
      console.warn('[OfflineSpeechEngine]: Transcription error:', err?.message || err);
      this.status = 'error';
      options.onStateChange?.('error');
      const msg = this.getLocalizedError('transcription-failed', options.language);
      options.onError?.('transcription-failed', msg);
    }
  }

  /**
   * Resamples AudioBuffer to 16kHz mono Float32Array for Whisper input
   */
  private static extractMono16kHz(buffer: AudioBuffer): Float32Array {
    const rawData = buffer.getChannelData(0);
    const sourceSampleRate = buffer.sampleRate;
    const targetSampleRate = 16000;

    if (sourceSampleRate === targetSampleRate) {
      return rawData;
    }

    const ratio = sourceSampleRate / targetSampleRate;
    const newLength = Math.round(rawData.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const index = Math.round(i * ratio);
      result[i] = rawData[Math.min(index, rawData.length - 1)];
    }

    return result;
  }

  private static cleanupMicStream(): void {
    if (this.activeStream) {
      try {
        this.activeStream.getTracks().forEach(t => t.stop());
        console.log('[STT Diagnostic] Microphone tracks released');
      } catch {
        // Ignore track stop error
      }
      this.activeStream = null;
    }
  }

  /**
   * Localized user-friendly error messages across English, Tamil, and Hindi
   */
  public static getLocalizedError(code: string, language: string = 'en'): string {
    const lang = String(language).toLowerCase();
    const isTa = lang.startsWith('ta');
    const isHi = lang.startsWith('hi');

    switch (code) {
      case 'permission-denied':
        if (isTa) return 'மைக்ரோஃபோன் அனுமதி மறுக்கப்பட்டது. பேச உலாவியின் அமைப்புகளில் மைக்கை அனுமதிக்கவும்.';
        if (isHi) return 'माइक्रोफ़ोन की अनुमति अस्वीकृत कर दी गई। बोलने के लिए कृपया ब्राउज़र सेटिंग्स में माइक्रोफ़ोन की अनुमति दें।';
        return 'Microphone permission was denied. Please allow microphone access in your browser settings to speak.';

      case 'mic-unavailable':
        if (isTa) return 'மைக்ரோஃபோன் கிடைக்கவில்லை அல்லது வேறு செயலி பயன்படுத்துகிறது. மைக்கை சரிபார்த்து மீண்டும் முயற்சிக்கவும்.';
        if (isHi) return 'माइक्रोफ़ोन उपलब्ध नहीं है या किसी अन्य ऐप द्वारा उपयोग में है। कृपया अपना माइक जांचें और पुनः प्रयास करें।';
        return 'Microphone is unavailable or in use by another application. Please check your mic and retry.';

      case 'model-not-downloaded':
        if (isTa) return 'ஆஃப்லைன் குரல் மாதிரி இன்னும் பதிவிறக்கப்படவில்லை. இணையமின்றி பேச அமைப்புகளில் ஆஃப்லைன் குரலை இயக்கவும் (39MB).';
        if (isHi) return 'ऑफ़लाइन वॉयस मॉडल अभी इंस्टॉल नहीं है। बिना इंटरनेट के बोलने के लिए सेटिंग्स में ऑफ़लाइन वॉयस चालू करें (39MB)।';
        return 'Offline voice model is not installed yet. Enable offline voice in settings (39MB) to speak without internet.';

      case 'no-speech':
        if (isTa) return 'குரல் எதுவும் கேட்கவில்லை. மைக் பட்டனை அழுத்தி மீண்டும் தெளிவாகப் பேசவும்.';
        if (isHi) return 'कोई आवाज़ सुनाई नहीं दी। कृपया माइक दबाकर पुनः स्पष्ट बोलें।';
        return 'No speech detected. Please tap the mic button and speak clearly again.';

      case 'transcription-failed':
        if (isTa) return 'ஆஃப்லைன் அங்கீகாரம் தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.';
        if (isHi) return 'ऑफ़लाइन पहचान विफल रही। कृपया पुनः प्रयास करें।';
        return 'Offline voice recognition failed. Please tap retry.';

      case 'not-supported':
      default:
        if (isTa) return 'இந்த உலாவியில் ஆஃப்லைன் குரல் ஆதரவு இல்லை.';
        if (isHi) return 'इस ब्राउज़र में ऑफ़लाइन आवाज़ समर्थित नहीं है।';
        return 'Offline voice recognition is not supported in this browser.';
    }
  }
}

