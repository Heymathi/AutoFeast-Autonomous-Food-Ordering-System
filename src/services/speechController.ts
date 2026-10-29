import { Language } from '../types';
import { SpeechService } from './speechService';

export type SpeechState = 'idle' | 'speaking' | 'listening' | 'processing' | 'error';
export type MicLanguageMode = 'auto' | 'en' | 'ta' | 'hi';

export interface SpeechControllerOptions {
  owner: string;
  language: Language | string;
  overrideLocale?: string;
  micMode?: MicLanguageMode;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  isPinScreen?: boolean;
  allowDuringTts?: boolean;
  silenceTimeoutMs?: number;
  onSilence?: () => void;
  onStart?: () => void;
  onResult: (transcript: string, isFinal: boolean, nBestTranscripts?: string[]) => void;
  onError?: (errorCode: string, errorMessage: string) => void;
  onEnd?: () => void;
}

export interface ListenOptions {
  language?: Language | string;
  expected?: string[];
  timeoutMs?: number;
  promptQuestion?: string;
  owner?: string;
  onInterim?: (transcript: string) => void;
  onStateChange?: (state: SpeechState) => void;
  isPinScreen?: boolean;
}

export interface ListenResult {
  transcript: string;
  alternatives: string[];
  confidence: number;
}

export interface DebugLogEvent {
  timestamp: string;
  type: string;
  detail: string;
}

export interface SystemVoiceInfo {
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

class SpeechControllerManager {
  private currentState: SpeechState = 'idle';
  private currentOwner: string | null = null;
  private currentLanguage: Language | string = 'en';
  private micMode: MicLanguageMode = 'auto';
  private isPinScreen: boolean = false;

  private activeOptions: SpeechControllerOptions | null = null;
  private lastSpokenText: string = '';
  private lastSpokenTime: number = 0;

  // System voices cache
  private availableVoices: SpeechSynthesisUtterance['voice'][] = [];
  private voicesLogged: boolean = false;
  private voiceListInfo: SystemVoiceInfo[] = [];

  // STT Auto-restart & Error Backoff State
  private restartAttempts: number = 0;
  private maxRestarts: number = 3;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private isRecognitionBlocked: boolean = false;
  private isAppPausedSttForTts: boolean = false;
  private isIntentionallyStopped: boolean = false;

  // TTS Queue & Chunking State
  private ttsQueue: Array<{
    text: string;
    targetLang: Language;
    onEnd?: () => void;
    id: string;
    generation: number;
  }> = [];
  private isTtsActive: boolean = false;
  private currentUtteranceChunk: SpeechSynthesisUtterance | null = null;
  private ttsGeneration: number = 0;

  // Pending-gesture queue: speak() calls made before any user interaction
  // are stored here and replayed on the first click/key/touch.
  private pendingGestureQueue: Array<{
    text: string;
    targetLang: Language;
    onEnd?: () => void;
    onToastFallback?: (msg: string) => void;
    source: string;
  }> = [];

  // Debug event log ring buffer
  private debugLogs: DebugLogEvent[] = [];
  private listeners: Set<() => void> = new Set();

  private userGestureActivated: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const markGesture = () => {
        if (!this.userGestureActivated) {
          this.userGestureActivated = true;
          console.log('[SpeechController]: First user gesture detected — replaying pending TTS queue', this.pendingGestureQueue.length, 'item(s)');
          // Replay all pending speak() calls that were blocked by autoplay policy
          const pending = [...this.pendingGestureQueue];
          this.pendingGestureQueue = [];
          for (const item of pending) {
            this.speak(item.text, item.targetLang, item.onEnd, item.onToastFallback, item.source);
          }
        }
      };
      window.addEventListener('click', markGesture, { capture: true, passive: true });
      window.addEventListener('keydown', markGesture, { capture: true, passive: true });
      window.addEventListener('touchstart', markGesture, { capture: true, passive: true });
      window.addEventListener('pointerdown', markGesture, { capture: true, passive: true });

      if ('speechSynthesis' in window) {
        this.initVoices();
        if (typeof window.speechSynthesis.addEventListener === 'function') {
          window.speechSynthesis.addEventListener('voiceschanged', () => this.initVoices());
        } else {
          window.speechSynthesis.onvoiceschanged = () => this.initVoices();
        }
      }
    }
  }

  public notifyUserGesture(): void {
    if (!this.userGestureActivated) {
      this.userGestureActivated = true;
      console.log('[SpeechController]: notifyUserGesture() called — replaying pending TTS queue', this.pendingGestureQueue.length, 'item(s)');
      const pending = [...this.pendingGestureQueue];
      this.pendingGestureQueue = [];
      for (const item of pending) {
        this.speak(item.text, item.targetLang, item.onEnd, item.onToastFallback, item.source);
      }
    } else {
      // Already gestured; just drain any leftover pending items (safety)
      if (this.pendingGestureQueue.length > 0) {
        const pending = [...this.pendingGestureQueue];
        this.pendingGestureQueue = [];
        for (const item of pending) {
          this.speak(item.text, item.targetLang, item.onEnd, item.onToastFallback, item.source);
        }
      }
    }
  }

  public hasUserGesture(): boolean {
    if (typeof navigator !== 'undefined' && (navigator as any).userActivation?.hasBeenActive) {
      return true;
    }
    return this.userGestureActivated;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyStateChange(): void {
    this.listeners.forEach(fn => fn());
  }

  public getState(): SpeechState {
    return this.currentState;
  }

  public getOwner(): string | null {
    return this.currentOwner;
  }

  public getLanguage(): Language {
    const lang = this.currentLanguage;
    return (typeof lang === 'string' && lang.startsWith('ta') ? 'ta' : typeof lang === 'string' && lang.startsWith('hi') ? 'hi' : 'en') as Language;
  }

  public getMicMode(): MicLanguageMode {
    return this.micMode;
  }

  public setMicMode(mode: MicLanguageMode): void {
    this.micMode = mode;
    this.addDebugLog('MIC_MODE_CHANGE', `Mic mode set to: ${mode}`);
    this.notifyStateChange();
  }

  public getDebugLogs(): DebugLogEvent[] {
    return this.debugLogs;
  }

  public getSystemVoicesInfo(): SystemVoiceInfo[] {
    return this.voiceListInfo;
  }

  private addDebugLog(type: string, detail: string): void {
    if (!(import.meta as any).env?.DEV) return;
    if (this.isPinScreen && (type.includes('RESULT') || type.includes('TRANSCRIPT') || detail.match(/\d/))) {
      // Security rule: Never log transcripts or digits on PIN screens
      detail = '[REDACTED PIN DATA]';
    }
    const log: DebugLogEvent = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      detail: detail.length > 80 ? detail.substring(0, 80) + '...' : detail
    };
    this.debugLogs.unshift(log);
    if (this.debugLogs.length > 25) {
      this.debugLogs.pop();
    }
    console.log(`[SpeechController ${log.type}]: ${log.detail}`);
    this.notifyStateChange();
  }

  private lastSpokenSource: string = '';

  private initVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const rawVoices = window.speechSynthesis.getVoices();
    if (rawVoices && rawVoices.length > 0) {
      this.availableVoices = rawVoices as any;
      this.voiceListInfo = rawVoices.map(v => ({
        name: v.name,
        lang: v.lang,
        localService: v.localService,
        default: v.default
      }));

      if (!this.voicesLogged) {
        this.voicesLogged = true;
        if ((import.meta as any).env?.DEV) {
          console.log(`================ [SYSTEM GETVOICES INVENTORY (${rawVoices.length} VOICES)] ================`);
          console.table(this.voiceListInfo);
          console.log('================================================================================');
        }
        this.addDebugLog('VOICES_LOADED', `voiceschanged event: Loaded ${rawVoices.length} synthesis voices.`);
      } else {
        this.notifyStateChange();
      }
    }
  }

  /**
   * Voice Picker Strategy Per Language:
   * 1) Microsoft Online (Natural) voice of exact language
   * 2) Any local voice of exact language code (e.g. ta-IN, hi-IN, en-IN)
   * 3) Same-language-family voice (name contains Tamil / Hindi)
   * 4) No match -> Return null (Never speak Tamil/Hindi text with English voice)
   */
  public selectBestVoice(targetLang: Language): { voice: any | null; isExactMatch: boolean } {
    if (this.availableVoices.length === 0) {
      this.initVoices();
    }
    const voices = this.availableVoices;
    const langCode = targetLang === 'ta' ? 'ta-in' : targetLang === 'hi' ? 'hi-in' : 'en-in';
    const langShort = targetLang;

    // Tier 1: Microsoft Online (Natural) or Google high quality voice
    const naturalVoice = voices.find(v => {
      const vLang = (v.lang || '').toLowerCase().replace('_', '-');
      const vName = (v.name || '').toLowerCase();
      const langMatch = vLang.startsWith(langShort) ||
        (targetLang === 'ta' && (vName.includes('tamil') || vName.includes('தமிழ்'))) ||
        (targetLang === 'hi' && (vName.includes('hindi') || vName.includes('हिन्दी')));
      return langMatch && (vName.includes('online') || vName.includes('natural') || vName.includes('google'));
    });
    if (naturalVoice) return { voice: naturalVoice, isExactMatch: true };

    // Tier 2: Any voice matching exact language code
    const exactLangVoice = voices.find(v => {
      const vLang = (v.lang || '').toLowerCase().replace('_', '-');
      return vLang === langCode || vLang.startsWith(langShort);
    });
    if (exactLangVoice) return { voice: exactLangVoice, isExactMatch: true };

    // Tier 3: Same-language-family voice by name
    const familyVoice = voices.find(v => {
      const vName = (v.name || '').toLowerCase();
      return (targetLang === 'ta' && (vName.includes('tamil') || vName.includes('தமிழ்'))) ||
        (targetLang === 'hi' && (vName.includes('hindi') || vName.includes('हिन्दी') || vName.includes('hindustani'))) ||
        (targetLang === 'en' && (vName.includes('english') || vName.includes('india')));
    });
    if (familyVoice) return { voice: familyVoice, isExactMatch: true };

    // Tier 4: Fallback -> Return null for non-English languages to avoid speaking Tamil/Hindi with English accent
    if (targetLang === 'en') {
      const enFallback = voices.find(v => (v.lang || '').toLowerCase().startsWith('en'));
      return { voice: enFallback || null, isExactMatch: !!enFallback };
    }

    return { voice: null, isExactMatch: false };
  }

  /**
   * TTS Engine Call with Queueing, Deduplication, Sentence Chunking & Mic Pause
   */
  public speak(
    text: string,
    targetLang: Language = 'en',
    onEnd?: () => void,
    onToastFallback?: (msg: string) => void,
    source: string = 'user_action'
  ): void {
    if (!text || !text.trim()) {
      if (onEnd) onEnd();
      return;
    }

    const cleanText = text.trim();
    const now = Date.now();

    // DIAGNOSTIC LOG: trace every speak() call
    console.log(`[SpeechController SPEAK CALLED]: lang=${targetLang} | source=${source} | gestureOK=${this.hasUserGesture()} | text="${cleanText.substring(0, 60)}${cleanText.length > 60 ? '...' : ''}"`); 

    // AUTOPLAY POLICY: If no user gesture yet, queue and replay on first interaction
    if (!this.hasUserGesture()) {
      console.warn('[SpeechController AUTOPLAY BLOCKED]: No user gesture yet. Queuing TTS for replay on first interaction.');
      this.pendingGestureQueue.push({ text: cleanText, targetLang, onEnd, onToastFallback, source });
      return;
    }

    this.cancelSpeech();
    // Deduplicate: Suppress ONLY identical TTS fired within 4s from the SAME background/automated source (e.g. 'gps')
    if (
      source !== 'user_action' &&
      source === this.lastSpokenSource &&
      cleanText.toLowerCase() === this.lastSpokenText.toLowerCase() &&
      (now - this.lastSpokenTime < 4000)
    ) {
      this.addDebugLog('TTS_DEDUPE_SKIP', `Skipping identical automated TTS prompt within 4s from source "${source}": "${cleanText.substring(0, 30)}"`);
      if (onEnd) onEnd();
      return;
    }

    this.lastSpokenSource = source;

    // DIAGNOSTIC: log voice chosen
    const voiceResult = this.selectBestVoice(targetLang);
    console.log(`[SpeechController VOICE CHOSEN]: lang=${targetLang} | voice="${voiceResult.voice?.name || 'browser-default'}" | exactMatch=${voiceResult.isExactMatch}`);

    // Pause mic gracefully before TTS output starts
    this.pauseMicForTts();

    if (!voiceResult.voice && targetLang !== 'en') {
      // In browsers without offline voice objects, SpeechSynthesis still synthesizes
      // online with utterance.lang = 'ta-IN' or 'hi-IN'. Show toast as parallel accessibility aid,
      // and proceed with synthesis so user actually hears the spoken audio.
      this.addDebugLog('TTS_VOICE_INFO', `No offline ${targetLang} voice package detected; using browser native ${targetLang === 'ta' ? 'ta-IN' : 'hi-IN'} engine.`);
      if (onToastFallback) {
        onToastFallback(cleanText);
      }
    }

    // Queue TTS request
    const promptId = `tts_${Date.now()}`;
    this.ttsQueue.push({ text: cleanText, targetLang, onEnd, id: promptId, generation: this.ttsGeneration });

    if (!this.isTtsActive) {
      this.processTtsQueue(onToastFallback);
    }
  }

  private processTtsQueue(onToastFallback?: (msg: string) => void): void {
    if (this.ttsQueue.length === 0) {
      this.isTtsActive = false;
      this.resumeMicAfterTts();
      return;
    }

    this.isTtsActive = true;
    this.currentState = 'speaking';
    this.notifyStateChange();

    const item = this.ttsQueue.shift()!;
    this.lastSpokenText = item.text;
    this.lastSpokenTime = Date.now();
    SpeechService.setLastSpokenText(item.text);

    // Split long text into short sentence chunks (< 180 chars) to avoid browser TTS stall
    const chunks = this.splitTextIntoSentenceChunks(item.text);
    this.speakChunksSequentially(chunks, item.targetLang, 0, item.generation, () => {
      if (item.generation !== this.ttsGeneration) return;
      this.isTtsActive = false;
      if (item.onEnd) item.onEnd();
      this.processTtsQueue(onToastFallback);
    });
  }

  private splitTextIntoSentenceChunks(text: string): string[] {
    if (text.length <= 180) return [text];
    const sentences = text.match(/[^.!?;|।\n]+[.!?;|।\n]*/g) || [text];
    const result: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      if (sentence.length <= 180) {
        if ((current + sentence).length > 180) {
          if (current.trim()) result.push(current.trim());
          current = sentence;
        } else {
          current += sentence;
        }
        continue;
      }

      const words = sentence.match(/\S+\s*/g) || [sentence];
      for (const word of words) {
        if ((current + word).length > 180) {
          if (current.trim()) result.push(current.trim());
          current = word;
        } else {
          current += word;
        }
      }
    }
    if (current.trim()) result.push(current.trim());
    return result.length > 0 ? result : [text];
  }

  private speakChunksSequentially(
    chunks: string[],
    targetLang: Language,
    index: number,
    generation: number,
    onComplete: () => void
  ): void {
    if (generation !== this.ttsGeneration) return;
    if (index >= chunks.length) {
      onComplete();
      return;
    }

    const chunkText = chunks[index];
    const voiceResult = this.selectBestVoice(targetLang);

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onComplete();
      return;
    }

    if (typeof window === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined' || !window.speechSynthesis) {
      this.addDebugLog('TTS_ERROR', 'SpeechSynthesis API unavailable in current environment');
      onComplete();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunkText);
    utterance.lang = targetLang === 'ta' ? 'ta-IN' : targetLang === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.rate = 0.95;
    if (voiceResult.voice) {
      utterance.voice = voiceResult.voice;
    }

    this.currentUtteranceChunk = utterance;
    this.addDebugLog('TTS_START', `[${targetLang}] Spoken chunk ${index + 1}/${chunks.length}: "${chunkText.substring(0, 30)}..."`);

    let isHandled = false;
    const finishChunk = () => {
      if (!isHandled) {
        isHandled = true;
        clearTimeout(safetyTimer);
        this.speakChunksSequentially(chunks, targetLang, index + 1, generation, onComplete);
      }
    };

    const safetyMax = Math.max(3000, chunkText.length * 110 + 2000);
    const safetyTimer = setTimeout(() => {
      this.addDebugLog('TTS_TIMEOUT', `TTS chunk timeout safety triggered for chunk ${index + 1}`);
      finishChunk();
    }, safetyMax);

    utterance.onend = () => {
      this.addDebugLog('TTS_END', `Completed chunk ${index + 1}/${chunks.length}`);
      finishChunk();
    };

    utterance.onerror = (evt: any) => {
      const code = evt.error || 'unknown';
      this.addDebugLog('TTS_ERROR', `Code: "${code}" | Lang: ${utterance.lang}`);
      // Handle non-critical cancellation gracefully
      if (code === 'interrupted' || code === 'canceled') {
        // Ignored when caused by app operations
      }
      finishChunk();
    };

    // Small 60ms gap before calling speak() to prevent Chromium audio engine lockup
    setTimeout(() => {
      if (generation !== this.ttsGeneration) return;
      try {
        window.speechSynthesis.speak(utterance);
      } catch (err: any) {
        this.addDebugLog('TTS_EXCEPT', `Exception on speak: ${err?.message || err}`);
        finishChunk();
      }
    }, 60);
  }

  public cancelSpeech(): void {
    this.ttsGeneration++;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (error) {
        this.addDebugLog('TTS_CANCEL_ERROR', error instanceof Error ? error.message : String(error));
      }
    }
    this.ttsQueue = [];
    this.isTtsActive = false;
    this.currentUtteranceChunk = null;
    if (this.currentState === 'speaking') {
      this.currentState = 'idle';
      this.notifyStateChange();
    }
  }

  /**
   * STT Mic Management via Single Controller Lock
   */
  public requestMic(options: SpeechControllerOptions): boolean {
    if (!SpeechService.isSupported()) {
      const message = this.getLocalizedSttErrorMessage('not-supported', options.language);
      this.currentState = 'error';
      this.addDebugLog('STT_UNSUPPORTED', message);
      if (options.onError) options.onError('not-supported', message);
      return false;
    }

    // Explicit requestMic cancels any TTS and unblocks paused STT
    if (this.isTtsActive || this.isAppPausedSttForTts) {
      this.cancelSpeech();
      this.isAppPausedSttForTts = false;
    }

    this.isPinScreen = !!options.isPinScreen;

    // If another component currently holds ownership, yield lock
    if (this.currentOwner && this.currentOwner !== options.owner) {
      this.addDebugLog('MIC_LOCK_SWITCH', `Switching ownership from "${this.currentOwner}" to "${options.owner}"`);
      this.stopMicInternal(false);
    }

    this.currentOwner = options.owner;
    this.currentLanguage = options.language;
    this.micMode = options.micMode || 'auto';
    this.activeOptions = options;
    this.restartAttempts = 0;
    this.isRecognitionBlocked = false;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    this.isIntentionallyStopped = false;

    return this.startSttSession();
  }

  private startSttSession(): boolean {
    if (!this.activeOptions || this.isAppPausedSttForTts) return false;

    const opt = this.activeOptions;
    const targetLang = this.micMode !== 'auto' ? this.micMode : opt.language;

    const isSpeaking = typeof window !== 'undefined' && 'speechSynthesis' in window &&
      (window.speechSynthesis.speaking || window.speechSynthesis.pending);
    if (!opt.allowDuringTts && (this.isTtsActive || isSpeaking)) {
      this.addDebugLog('STT_DEFERRED', 'Recognition deferred until TTS has finished.');
      if (this.restartTimer) clearTimeout(this.restartTimer);
      this.restartTimer = setTimeout(() => {
        this.restartTimer = null;
        if (this.activeOptions && !this.isIntentionallyStopped) this.startSttSession();
      }, 300);
      return true;
    }

    this.currentState = 'listening';
    this.addDebugLog('STT_REQUEST', `Owner "${opt.owner}" requesting mic. Mode: ${this.micMode} | Target: ${targetLang}`);

    const clearSilenceTimer = () => {
      if (this.silenceTimer) clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    };
    const armSilenceTimer = () => {
      if (!opt.onSilence || !opt.silenceTimeoutMs || this.silenceTimer) return;
      this.silenceTimer = setTimeout(() => {
        this.silenceTimer = null;
        if (this.activeOptions !== opt || this.isIntentionallyStopped) return;
        this.addDebugLog('STT_SILENCE_TIMEOUT', `No speech received in ${opt.silenceTimeoutMs}ms.`);
        this.stopMicInternal(false);
        opt.onSilence?.();
      }, opt.silenceTimeoutMs);
    };

    const success = SpeechService.startListening({
      language: targetLang,
      overrideLocale: opt.overrideLocale,
      continuous: opt.continuous ?? false, // Default continuous=false for command/answer prompts
      interimResults: opt.interimResults ?? true,
      maxAlternatives: opt.maxAlternatives ?? 5,
      isSensitive: this.isPinScreen,
      onStart: () => {
        this.currentState = 'listening';
        armSilenceTimer();
        this.addDebugLog('STT_ONSTART', `Mic active for owner "${opt.owner}"`);
        if (opt.onStart) opt.onStart();
        this.notifyStateChange();
      },
      onResult: (transcript, isFinal, nBest) => {
        if (!opt.allowDuringTts && this.currentState === 'speaking') return;
        if (transcript.trim()) {
          clearSilenceTimer();
          armSilenceTimer();
        }
        this.restartAttempts = 0;
        this.currentState = isFinal ? 'processing' : 'listening';

        if (!this.isPinScreen) {
          this.addDebugLog('STT_ONRESULT', `"${transcript.substring(0, 40)}" (isFinal: ${isFinal})`);
        } else {
          this.addDebugLog('STT_ONRESULT', `[PIN SPEECH RECEIVED] (isFinal: ${isFinal})`);
        }

        opt.onResult(transcript, isFinal, nBest);
        this.notifyStateChange();
      },
      onError: (errCode: any) => {
        const errString = (typeof errCode === 'string' ? errCode : errCode?.error || 'unknown').toLowerCase();
        this.addDebugLog('STT_ONERROR', `Error Code: "${errString}"`);

        if (errString === 'no-speech') {
          if (this.scheduleSttRestart('no-speech', 400)) {
            return;
          }
        } else if (errString === 'aborted') {
          if (this.scheduleSttRestart('aborted', 300)) {
            return;
          }
        }

        clearSilenceTimer();
        this.isRecognitionBlocked = true;
        this.currentState = 'error';
        if (opt.onError) opt.onError(errString, this.getLocalizedSttErrorMessage(errString, opt.language));
        this.notifyStateChange();
      },
      onEnd: () => {
        this.addDebugLog('STT_ONEND', `Session ended for owner "${opt.owner}"`);
        const isRestarting = opt.continuous && !this.isRecognitionBlocked &&
          this.scheduleSttRestart('natural-end', 300);
        if (!isRestarting) clearSilenceTimer();
        if (!isRestarting && !this.isAppPausedSttForTts && !this.isIntentionallyStopped && opt.onEnd) {
          opt.onEnd();
        }
        if (this.currentState !== 'speaking') {
          this.currentState = isRestarting ? 'listening' : 'idle';
        }
        this.notifyStateChange();
      }
    });

    return success;
  }

  private scheduleSttRestart(reason: string, delay: number): boolean {
    if (!this.activeOptions || this.isIntentionallyStopped || this.isAppPausedSttForTts || this.isRecognitionBlocked) {
      return false;
    }
    if ((!this.activeOptions.continuous || reason === 'aborted') && this.restartAttempts >= this.maxRestarts) {
      return false;
    }
    if (this.restartTimer) return true;

    this.restartAttempts++;
    this.addDebugLog('STT_RESTART_BACKOFF', `Restarting after ${reason} (attempt ${this.restartAttempts})`);
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (this.activeOptions && !this.isIntentionallyStopped && !this.isAppPausedSttForTts && !this.isRecognitionBlocked) {
        this.startSttSession();
      }
    }, delay);
    return true;
  }

  public releaseMic(owner: string): void {
    if (this.currentOwner === owner) {
      this.addDebugLog('MIC_RELEASE', `Owner "${owner}" released mic.`);
      this.stopMicInternal(true);
    }
  }

  public isSupported(): boolean {
    return SpeechService.isSupported();
  }

  public startListening(options: SpeechControllerOptions): boolean {
    return this.requestMic(options);
  }

  public stopListening(owner?: string): void {
    if (owner) {
      this.releaseMic(owner);
    } else {
      this.stopMic();
    }
  }

  public stopMic(): void {
    this.addDebugLog('MIC_STOP_MANUAL', 'User or component requested stopMic.');
    this.stopMicInternal(true);
  }

  public setLanguage(lang: Language): void {
    console.log(`[SpeechController]: setLanguage -> updating active language to "${lang}"`);
    this.currentLanguage = lang;
    SpeechService.setLanguage(lang);
    if (this.activeOptions && !this.isIntentionallyStopped) {
      this.activeOptions.language = lang;
      if (this.currentState === 'listening' || SpeechService.getIsListening()) {
        this.addDebugLog('LANG_SWITCH_RESTART', `Switching active recognition locale immediately to "${SpeechService.getLocale(lang)}"`);
        this.stopMicInternal(false);
        this.isIntentionallyStopped = false;
        setTimeout(() => {
          if (this.activeOptions && !this.isIntentionallyStopped) {
            this.startSttSession();
          }
        }, 100);
      }
    }
  }

  public async listen(options: ListenOptions): Promise<ListenResult> {
    const owner = options.owner || 'shared_listen_turn';
    const lang = (options.language || this.currentLanguage || 'en') as Language;
    const timeoutMs = options.timeoutMs ?? 8000;
    const promptQuestion = options.promptQuestion;

    // 1. Proactive Browser Check: Warn if Edge or unsupported
    if (!SpeechService.isSupported()) {
      const warnMsg = this.getLocalizedSttErrorMessage('not-supported', lang);
      this.addDebugLog('STT_UNSUPPORTED', warnMsg);
      this.speak(warnMsg, lang, undefined, undefined, 'system_warning');
      return { transcript: '', alternatives: [], confidence: 0 };
    }

    const browser = typeof navigator === 'undefined' ? '' : navigator.userAgent.toLowerCase();
    if (browser.includes('edg/')) {
      const edgeWarn = lang === 'ta'
        ? 'Edge உலாவியில் குரல் சேவை சில சமயம் செயல்படாது. சிறந்த அனுபவத்திற்கு Google Chrome பயன்படுத்தவும்.'
        : lang === 'hi'
        ? 'Edge ब्राउज़र में आवाज़ पहचान अविश्वसनीय हो सकती है। कृपया Google Chrome का उपयोग करें।'
        : 'Voice recognition may be unreliable in Edge. Please use Google Chrome.';
      this.addDebugLog('BROWSER_WARN_EDGE', edgeWarn);
    }

    // 2. Microphone Permission Check (where supported)
    if (typeof navigator !== 'undefined' && (navigator as any).permissions?.query) {
      try {
        const permStatus = await (navigator as any).permissions.query({ name: 'microphone' });
        if (permStatus?.state === 'denied') {
          const permMsg = this.getLocalizedSttErrorMessage('not-allowed', lang);
          this.addDebugLog('MIC_PERMISSION_DENIED', permMsg);
          this.speak(permMsg, lang, undefined, undefined, 'system_warning');
          return { transcript: '', alternatives: [], confidence: 0 };
        }
      } catch {
        // query for microphone not supported in some browsers, proceed normally
      }
    }

    // 3. Audio constraints: noise suppression, echo cancellation, auto gain where supported
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            noiseSuppression: true,
            echoCancellation: true,
            autoGainControl: true
          }
        });
        stream.getTracks().forEach(track => track.stop());
      } catch {
        // getUserMedia error handled in normal speech lifecycle
      }
    }

    // 4. Single Question/Answer Turn with Promise
    return new Promise<ListenResult>((resolve) => {
      let hasRepeatedOnce = false;
      let isResolved = false;

      const safeResolve = (res: ListenResult) => {
        if (!isResolved) {
          isResolved = true;
          this.releaseMic(owner);
          options.onStateChange?.('idle');
          resolve(res);
        }
      };

      const startTurn = () => {
        this.requestMic({
          owner,
          language: lang,
          continuous: false,
          interimResults: true,
          maxAlternatives: 5,
          isPinScreen: options.isPinScreen,
          silenceTimeoutMs: timeoutMs,
          onStart: () => {
            options.onStateChange?.('listening');
          },
          onSilence: () => {
            if (!hasRepeatedOnce && promptQuestion) {
              hasRepeatedOnce = true;
              this.addDebugLog('LISTEN_TIMEOUT_RETRY', 'Silence timeout: repeating question once via TTS.');
              this.speak(
                promptQuestion,
                lang,
                () => {
                  setTimeout(() => {
                    if (!isResolved) {
                      startTurn();
                    }
                  }, 300);
                },
                undefined,
                owner
              );
            } else {
              this.addDebugLog('LISTEN_TIMEOUT_STOP', 'Silence timeout: stopping and signaling tap buttons.');
              safeResolve({ transcript: '', alternatives: [], confidence: 0 });
            }
          },
          onResult: (text, isFinal, nBest) => {
            if (options.onInterim) {
              options.onInterim(text);
            }
            if (isFinal && text.trim()) {
              const alts = (nBest && nBest.length > 0) ? nBest : [text.trim()];
              safeResolve({
                transcript: text.trim(),
                alternatives: alts,
                confidence: 1.0
              });
            }
          },
          onError: (code) => {
            const errStr = (typeof code === 'string' ? code : 'error').toLowerCase();
            if (errStr === 'no-speech') {
              const noSpeechCue = SpeechService.getLowConfidenceCue(lang);
              this.speak(noSpeechCue, lang, undefined, undefined, 'system_warning');
            } else if (errStr === 'not-allowed' || errStr === 'audio-capture') {
              const permMsg = this.getLocalizedSttErrorMessage('not-allowed', lang);
              this.speak(permMsg, lang, undefined, undefined, 'system_warning');
            } else if (errStr === 'network') {
              const netMsg = this.getLocalizedSttErrorMessage('network', lang);
              this.speak(netMsg, lang, undefined, undefined, 'system_warning');
            }
            safeResolve({ transcript: '', alternatives: [], confidence: 0 });
          },
          onEnd: () => {
            safeResolve({ transcript: '', alternatives: [], confidence: 0 });
          }
        });
      };

      startTurn();
    });
  }

  private stopMicInternal(isFullReset: boolean): void {
    this.isIntentionallyStopped = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    SpeechService.stopListening();
    if (isFullReset) {
      this.currentOwner = null;
      this.activeOptions = null;
    }
    this.currentState = 'idle';
    this.notifyStateChange();
  }

  private pauseMicForTts(): void {
    if (this.activeOptions?.allowDuringTts) return;
    if (this.currentState === 'listening' || SpeechService.getIsListening()) {
      this.addDebugLog('MIC_PAUSE_TTS', 'Pausing microphone capture while TTS output is active.');
      this.isAppPausedSttForTts = true;
      SpeechService.stopListening();
    }
  }

  private resumeMicAfterTts(): void {
    if (this.isAppPausedSttForTts && this.activeOptions && !this.isIntentionallyStopped) {
      this.addDebugLog('MIC_RESUME_TTS', 'Resuming microphone capture ~300ms after TTS completion.');
      setTimeout(() => {
        this.isAppPausedSttForTts = false;
        if (this.activeOptions && !this.isIntentionallyStopped) {
          this.startSttSession();
        }
      }, 300);
    } else {
      this.isAppPausedSttForTts = false;
      if (this.currentState === 'speaking') this.currentState = 'idle';
      this.notifyStateChange();
    }
  }

  private getLocalizedSttErrorMessage(code: string, lang: Language | string): string {
    if (code === 'not-supported') {
      const browser = typeof navigator === 'undefined' ? '' : navigator.userAgent.toLowerCase();
      const browserHint = browser.includes('edg/') || !SpeechService.isSupported();
      if (browserHint) {
        return lang === 'ta'
          ? 'இந்த உலாவியில் குரல் சேவை இல்லை. தயவுசெய்து Chrome பயன்படுத்தவும் அல்லது திரையில் தேர்வு செய்யவும்.'
          : lang === 'hi'
            ? 'इस ब्राउज़र में आवाज़ सेवा उपलब्ध नहीं है। कृपया Chrome का उपयोग करें या स्क्रीन पर विकल्प चुनें।'
            : 'Voice recognition is unavailable here. Please use Chrome or choose an on-screen option.';
      }
    }
    if (code === 'not-allowed' || code === 'audio-capture') {
      return lang === 'ta'
        ? 'மைக் அணுகல் தேவை. தயவுசெய்து உலாவியில் மைக் அனுமதியை வழங்கவும்.'
        : lang === 'hi'
          ? 'माइक्रोफ़ोन एक्सेस की आवश्यकता है। कृपया ब्राउज़र में अनुमति दें।'
          : 'Microphone permission required. Please allow mic access in browser.';
    }
    if (code === 'aborted') {
      return lang === 'ta'
        ? 'குரல் கேட்பு நிறுத்தப்பட்டது. மைக்கை மீண்டும் முயற்சிக்கவும்.'
        : lang === 'hi'
          ? 'आवाज़ सुनना रुक गया। कृपया माइक फिर से आज़माएँ।'
          : 'Voice listening stopped. Please retry the microphone.';
    }
    if (code === 'network') {
      const browser = typeof navigator === 'undefined' ? '' : navigator.userAgent.toLowerCase();
      const browserHint = browser.includes('edg/') || !SpeechService.isSupported();
      return lang === 'ta'
        ? (browserHint ? 'குரல் சேவைக்கு Chrome உலாவியைப் பயன்படுத்தவும்.' : 'குரல் உணர்தலுக்கு இணைய இணைப்பு தேவை.')
        : lang === 'hi'
          ? (browserHint ? 'कृपया आवाज़ सेवा के लिए Chrome ब्राउज़र का उपयोग करें।' : 'आवाज़ पहचान के लिए इंटरनेट कनेक्शन आवश्यक है।')
          : (browserHint ? 'Please use Chrome for voice recognition.' : 'Voice recognition requires an active internet connection.');
    }
    const baseLang: Language = typeof lang === 'string' && lang.startsWith('ta') ? 'ta' : typeof lang === 'string' && lang.startsWith('hi') ? 'hi' : 'en';
    return SpeechService.getLowConfidenceCue(baseLang);
  }
}

export const SpeechController = new SpeechControllerManager();
export const listen = (options: ListenOptions) => SpeechController.listen(options);
