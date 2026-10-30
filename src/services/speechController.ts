import { Language } from '../types';
import { SpeechService } from './speechService';

export type VoiceState = 'idle' | 'speaking' | 'listening' | 'processing' | 'error';
export type SpeechState = VoiceState;
export type TurnState = 'IDLE' | 'SPEAKING' | 'LISTENING' | 'HANDLING';
export type MicMode = 'auto' | 'ta' | 'hi' | 'en';
export type MicLanguageMode = MicMode;

export interface DebugLogEntry {
  id: string;
  timestamp: string;
  event: string;
  detail: string;
  type?: string;
  message?: string;
}

export interface SpeechControllerOptions {
  owner: string;
  language: Language | string;
  micMode?: MicMode;
  overrideLocale?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  isPinScreen?: boolean;
  allowDuringTts?: boolean;
  silenceTimeoutMs?: number;
  promptKey?: string;
  onResult: (transcript: string, isFinal: boolean, alternatives?: string[]) => void;
  onError?: (errorCode: string, userMessage: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onSilence?: () => void;
}

export interface ListenOptions {
  owner?: string;
  language?: Language | string;
  timeoutMs?: number;
  promptQuestion?: string;
  isPinScreen?: boolean;
  onInterim?: (transcript: string) => void;
  onStateChange?: (state: 'listening' | 'idle') => void;
}

export interface ListenResult {
  transcript: string;
  alternatives: string[];
  confidence: number;
}

type StateListener = (state: {
  voiceState: VoiceState;
  turnState: TurnState;
  turnId: number;
  owner: string | null;
  language: Language;
  micMode: MicMode;
  activeTtsVoice: string;
  userGestureUnlocked: boolean;
  isPinScreen: boolean;
  circuitBreakerTripped: boolean;
  logs: DebugLogEntry[];
}) => void;

const LOCALE_MAP: Record<Language, string> = {
  ta: 'ta-IN',
  hi: 'hi-IN',
  en: 'en-IN'
};

// Known pre-recorded prompt keys in /public/audio/<lang>/<key>.mp3
const KNOWN_PRERECORDED_KEYS = new Set<string>([
  'welcome',
  'select_language',
  'location_permission',
  'order_confirmed'
]);

// Client-side in-memory cache for /api/tts audio data URLs keyed by `${lang}:${text}`
const clientTtsAudioCache = new Map<string, string>();

class SpeechControllerManager {
  // Single Source of Truth Turn Manager State (outside React render state)
  private turnState: TurnState = 'IDLE';
  private currentTurnId: number = 0;
  private spokenPromptsInTurn: Set<string> = new Set();
  private lastGlobalSpokenText: string = '';
  private lastGlobalSpokenAt: number = 0;
  private isInToastFallback: boolean = false;

  // Circuit Breaker State (>5 speech sessions in 10 seconds)
  private sessionStartTimestamps: number[] = [];
  private circuitBreakerTripped: boolean = false;
  private static readonly CIRCUIT_BREAKER_MAX_SESSIONS = 5;
  private static readonly CIRCUIT_BREAKER_WINDOW_MS = 10000;

  private currentState: VoiceState = 'idle';
  private currentOwner: string | null = null;
  private currentLanguage: Language = 'en';
  private micMode: MicMode = 'auto';
  private activeTtsVoiceName: string = 'Loading voices...';
  private userGestureUnlocked: boolean = false;
  private isPinScreen: boolean = false;

  private cachedVoices: SpeechSynthesisVoice[] = [];
  private voicesLoaded: boolean = false;
  private listeners: Set<StateListener> = new Set();
  private debugLogs: DebugLogEntry[] = [];

  private activeOptions: SpeechControllerOptions | null = null;
  private restartAttempts: number = 0;
  private maxRestarts: number = 2; // Cap auto-restarts at 2 per turn
  private restartTimer: any = null;
  private silenceTimer: any = null;
  private isIntentionallyStopped: boolean = false;
  private isAppPausedSttForTts: boolean = false;
  private isRecognitionBlocked: boolean = false;

  private isTtsActive: boolean = false;
  private activeAudioElement: HTMLAudioElement | null = null;
  private chromeHeartbeatTimer: any = null;
  private ttsGeneration: number = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initVoices();
      this.initUserGestureUnlock();
    }
  }

  private setTurnState(next: TurnState, reason?: string): void {
    if (this.turnState !== next) {
      const prev = this.turnState;
      this.turnState = next;
      this.addDebugLog('TURN_STATE', `[Turn #${this.currentTurnId}] ${prev} -> ${next}${reason ? ` (${reason})` : ''}`);
    }
  }

  public getTurnState(): TurnState {
    return this.turnState;
  }

  public getTurnId(): number {
    return this.currentTurnId;
  }

  public getOwner(): string | null {
    return this.currentOwner;
  }

  public getVoiceState(): VoiceState {
    return this.currentState;
  }

  public isTtsSpeaking(): boolean {
    return this.isTtsActive || this.currentState === 'speaking';
  }

  public isCircuitBreakerTripped(): boolean {
    return this.circuitBreakerTripped;
  }

  public resetCircuitBreaker(): void {
    this.circuitBreakerTripped = false;
    this.sessionStartTimestamps = [];
    this.isRecognitionBlocked = false;
    this.restartAttempts = 0;
  }

  /**
   * Starts a fresh voice turn, cancelling any prior turn and resetting per-turn counters.
   */
  public startNewTurn(source: string = 'turn'): number {
    this.currentTurnId += 1;
    this.spokenPromptsInTurn.clear();
    this.restartAttempts = 0;
    this.isRecognitionBlocked = false;
    this.cancelSpeech();
    this.stopMicInternal(false);
    this.setTurnState('IDLE', `new turn from ${source}`);
    return this.currentTurnId;
  }

  public markHandling(owner?: string): void {
    if (owner && this.currentOwner && this.currentOwner !== owner) return;
    this.setTurnState('HANDLING', owner || this.currentOwner || 'action');
    this.stopMicInternal(true);
    this.setTurnState('IDLE', 'handled');
  }

  private initVoices(): void {
    if (!('speechSynthesis' in window)) {
      this.activeTtsVoiceName = 'SpeechSynthesis Not Supported';
      return;
    }

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        this.cachedVoices = voices;
        this.voicesLoaded = true;
        this.updateBestVoiceDisplay(this.currentLanguage);
      }
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    setTimeout(loadVoices, 500);
  }

  private initUserGestureUnlock(): void {
    const unlock = () => {
      if (!this.userGestureUnlocked) {
        this.userGestureUnlocked = true;
        if ('speechSynthesis' in window) {
          try {
            const silentUtterance = new SpeechSynthesisUtterance('');
            silentUtterance.volume = 0;
            window.speechSynthesis.speak(silentUtterance);
          } catch {
            // Ignore silent unlock error
          }
        }
        this.notifyStateChange();
      }
    };

    window.addEventListener('click', unlock, { passive: true, once: true });
    window.addEventListener('touchstart', unlock, { passive: true, once: true });
    window.addEventListener('keydown', unlock, { passive: true, once: true });
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  public getState() {
    return {
      voiceState: this.currentState,
      turnState: this.turnState,
      turnId: this.currentTurnId,
      owner: this.currentOwner,
      language: this.currentLanguage,
      micMode: this.micMode,
      activeTtsVoice: this.activeTtsVoiceName,
      userGestureUnlocked: this.userGestureUnlocked,
      isPinScreen: this.isPinScreen,
      circuitBreakerTripped: this.circuitBreakerTripped,
      logs: [...this.debugLogs]
    };
  }

  private normalizeLang(lang?: Language | string): Language {
    if (!lang) return this.currentLanguage;
    const lower = String(lang).toLowerCase();
    if (lower.startsWith('ta')) return 'ta';
    if (lower.startsWith('hi')) return 'hi';
    return 'en';
  }

  public hasUserGestureUnlocked(): boolean {
    return this.userGestureUnlocked;
  }

  public hasUserGesture(): boolean {
    return this.userGestureUnlocked;
  }

  public markUserGesture(): void {
    this.userGestureUnlocked = true;
    this.resetCircuitBreaker();
    this.notifyStateChange();
  }

  public notifyUserGesture(): void {
    this.markUserGesture();
  }

  public getDebugLogs(): DebugLogEntry[] {
    return [...this.debugLogs];
  }

  public getSystemVoicesInfo(): { name: string; lang: string; default: boolean; localService: boolean }[] {
    return this.cachedVoices.map(v => ({
      name: v.name,
      lang: v.lang,
      default: v.default,
      localService: v.localService
    }));
  }

  public selectBestVoice(lang: Language | string): { voice: SpeechSynthesisVoice | null; isFallback: boolean } {
    return this.selectVoiceForLanguage(this.normalizeLang(lang));
  }

  public getActiveTtsVoice(): string {
    return this.activeTtsVoiceName;
  }

  public getMicMode(): MicMode {
    return this.micMode;
  }

  public setMicMode(mode: MicMode): void {
    this.micMode = mode;
    this.notifyStateChange();
  }

  public setPinScreenMode(isPin: boolean): void {
    this.isPinScreen = isPin;
    this.notifyStateChange();
  }

  public clearDebugLogs(): void {
    this.debugLogs = [];
    this.notifyStateChange();
  }

  private addDebugLog(event: string, detail: string): void {
    const now = new Date();
    const timestamp = `${now.toTimeString().split(' ')[0]}.${String(now.getMilliseconds()).padStart(3, '0')}`;
    const entry: DebugLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp,
      event,
      detail,
      type: event,
      message: detail
    };
    this.debugLogs = [entry, ...this.debugLogs].slice(0, 40);
    this.notifyStateChange();
  }

  private notifyStateChange(): void {
    const state = this.getState();
    this.listeners.forEach(l => l(state));
  }

  private selectVoiceForLanguage(lang: Language): { voice: SpeechSynthesisVoice | null; isFallback: boolean } {
    if (!this.voicesLoaded || this.cachedVoices.length === 0) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        this.cachedVoices = window.speechSynthesis.getVoices() || [];
        if (this.cachedVoices.length > 0) this.voicesLoaded = true;
      }
    }

    const voices = this.cachedVoices;
    if (voices.length === 0) {
      return { voice: null, isFallback: false };
    }

    const exactLocale = LOCALE_MAP[lang].toLowerCase();
    const langPrefix = lang.toLowerCase();

    // 1. Exact locale match (e.g., ta-IN, hi-IN, en-IN)
    const exactMatch = voices.find(v => v.lang.toLowerCase().replace('_', '-') === exactLocale);
    if (exactMatch) return { voice: exactMatch, isFallback: false };

    // 2. Same language prefix match (e.g., ta*, hi*, en*)
    const prefixMatch = voices.find(v => v.lang.toLowerCase().startsWith(langPrefix));
    if (prefixMatch) return { voice: prefixMatch, isFallback: false };

    // 3. Name-based match for Tamil/Hindi/English
    if (lang === 'ta') {
      const nameMatch = voices.find(v => /tamil|valluvar|pallavi|heera/i.test(v.name));
      if (nameMatch) return { voice: nameMatch, isFallback: false };
      return { voice: null, isFallback: true };
    }

    if (lang === 'hi') {
      const nameMatch = voices.find(v => /hindi|hemant|kalpana|lekha|swara|madhur/i.test(v.name));
      if (nameMatch) return { voice: nameMatch, isFallback: false };
      return { voice: null, isFallback: true };
    }

    const defaultEn = voices.find(v => v.lang.toLowerCase().startsWith('en')) || voices[0] || null;
    return { voice: defaultEn, isFallback: false };
  }

  private updateBestVoiceDisplay(lang: Language): void {
    const { voice } = this.selectVoiceForLanguage(lang);
    if (voice) {
      this.activeTtsVoiceName = `${voice.name} (${voice.lang})`;
    } else {
      this.activeTtsVoiceName = `Server/Text Fallback (${LOCALE_MAP[lang]})`;
    }
    this.notifyStateChange();
  }

  private sanitizeTextForTts(rawText: string): string {
    if (!rawText) return '';
    return rawText
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/[*_~`#>]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private splitTextIntoChunks(text: string, maxLen: number = 180): string[] {
    if (text.length <= maxLen) return [text];
    const sentences = text.split(/(?<=[.!?।|])\s+/);
    const chunks: string[] = [];
    let current = '';

    for (const s of sentences) {
      if ((current + ' ' + s).trim().length <= maxLen) {
        current = (current + ' ' + s).trim();
      } else {
        if (current) chunks.push(current);
        if (s.length <= maxLen) {
          current = s;
        } else {
          const words = s.split(' ');
          current = '';
          for (const w of words) {
            if ((current + ' ' + w).trim().length <= maxLen) {
              current = (current + ' ' + w).trim();
            } else {
              if (current) chunks.push(current);
              current = w;
            }
          }
        }
      }
    }
    if (current) chunks.push(current);
    return chunks.length > 0 ? chunks : [text];
  }

  private startChromeHeartbeat(): void {
    this.stopChromeHeartbeat();
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.chromeHeartbeatTimer = setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);
  }

  private stopChromeHeartbeat(): void {
    if (this.chromeHeartbeatTimer) {
      clearInterval(this.chromeHeartbeatTimer);
      this.chromeHeartbeatTimer = null;
    }
  }

  /**
   * Safe wrapper around onToastFallback so displaying fallback text NEVER re-invokes speak()
   */
  private invokeToastFallbackSafely(onToastFallback: ((text: string) => void) | undefined, text: string): void {
    if (!onToastFallback) return;
    this.isInToastFallback = true;
    try {
      onToastFallback(text);
    } finally {
      this.isInToastFallback = false;
    }
  }

  /**
   * Try playing a known pre-recorded MP3 or server TTS audio when browser lacks a native ta/hi voice.
   * Resolves true if audio played, false if unavailable (falling back to on-screen text).
   */
  private async tryFallbackAudioPlayback(
    cleanText: string,
    targetLang: Language,
    sourceOrKey: string,
    generation: number
  ): Promise<boolean> {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return false;

    // 1. Check if sourceOrKey is a known pre-recorded prompt key in /public/audio/<lang>/<key>.mp3
    const normalizedKey = sourceOrKey.toLowerCase().trim();
    if (KNOWN_PRERECORDED_KEYS.has(normalizedKey)) {
      const playedPreRecorded = await this.playAudioUrl(`/audio/${targetLang}/${normalizedKey}.mp3`, generation);
      if (playedPreRecorded) return true;
    }

    // 2. Never send PIN prompts or 4-digit numbers to /api/tts
    if (this.isPinScreen || sourceOrKey === 'voice_pin' || /\b\d{4}\b/.test(cleanText)) {
      return false;
    }

    // 3. Check client-side cache for /api/tts
    const cacheKey = `${targetLang}:${cleanText}`;
    const cachedDataUrl = clientTtsAudioCache.get(cacheKey);
    if (cachedDataUrl) {
      return await this.playAudioUrl(cachedDataUrl, generation);
    }

    // 4. Call server /api/tts with a short timeout; fail gracefully on any error
    if (typeof fetch !== 'function') return false;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = setTimeout(() => controller?.abort(), 3000);

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, lang: targetLang }),
        signal: controller?.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok || generation !== this.ttsGeneration) return false;
      const data = await response.json();
      if (!data || !data.success || !data.audioBase64) return false;

      const mimeType = data.mimeType || 'audio/wav';
      const dataUrl = `data:${mimeType};base64,${data.audioBase64}`;
      if (clientTtsAudioCache.size >= 100) {
        const oldestKey = clientTtsAudioCache.keys().next().value;
        if (oldestKey) clientTtsAudioCache.delete(oldestKey);
      }
      clientTtsAudioCache.set(cacheKey, dataUrl);

      if (generation !== this.ttsGeneration) return false;
      return await this.playAudioUrl(dataUrl, generation);
    } catch {
      clearTimeout(timeoutId);
      return false;
    }
  }

  private playAudioUrl(url: string, generation: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      if (generation !== this.ttsGeneration) {
        resolve(false);
        return;
      }
      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        if (this.activeAudioElement === audio) {
          this.activeAudioElement = null;
        }
        resolve(ok);
      };

      const audio = new Audio(url);
      this.activeAudioElement = audio;
      const timer = setTimeout(() => done(false), 8000);

      audio.onended = () => {
        clearTimeout(timer);
        done(true);
      };
      audio.onerror = () => {
        clearTimeout(timer);
        done(false);
      };

      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          clearTimeout(timer);
          done(false);
        });
      }
    });
  }

  /**
   * Unified TTS Speak Method (`speak(text, lang, onEnd, onToastFallback, sourceOrKey)`)
   * - Speaks a prompt at most ONCE per turn.
   * - Never loops when no Tamil/Hindi voice is installed.
   * - Transitions cleanly from SPEAKING -> LISTENING once via onEnd.
   */
  public speak(
    text: string,
    targetLangInput: Language | string = this.currentLanguage,
    onEnd?: () => void,
    onToastFallback?: (text: string) => void,
    source: string = 'user_action',
    promptKey?: string
  ): void {
    const targetLang = this.normalizeLang(targetLangInput);
    // 1. Block re-entrant speak calls triggered by showToast inside onToastFallback!
    if (this.isInToastFallback) {
      return;
    }

    const cleanText = this.sanitizeTextForTts(text);
    if (!cleanText) {
      if (onEnd) onEnd();
      return;
    }

    // 2. If Circuit Breaker is tripped, only show text without starting TTS/STT
    if (this.circuitBreakerTripped) {
      this.invokeToastFallbackSafely(onToastFallback, cleanText);
      return;
    }

    const now = Date.now();
    const keyId = promptKey || source || 'default';

    // 3. Deduplicate identical text spoken within 1200ms (e.g. component speak + showToast speakText)
    if (cleanText === this.lastGlobalSpokenText && now - this.lastGlobalSpokenAt < 1200) {
      return;
    }

    // 4. Start a new turn if we are not currently in the middle of one or if a new prompt with onEnd arrives
    if (this.turnState === 'IDLE' || onEnd) {
      this.currentTurnId += 1;
      this.spokenPromptsInTurn.clear();
      this.restartAttempts = 0;
    }

    const turnDedupeKey = `${this.currentTurnId}:${keyId}:${cleanText}`;
    if (this.spokenPromptsInTurn.has(turnDedupeKey)) {
      return;
    }
    this.spokenPromptsInTurn.add(turnDedupeKey);
    this.lastGlobalSpokenText = cleanText;
    this.lastGlobalSpokenAt = now;

    // 5. Cancel any previous speech and pause STT before speaking
    this.cancelSpeech();
    this.pauseMicForTts();

    const generation = ++this.ttsGeneration;
    const turnIdAtStart = this.currentTurnId;
    this.currentLanguage = targetLang;
    this.isTtsActive = true;
    this.currentState = 'speaking';
    this.setTurnState('SPEAKING', keyId);

    let hasFinishedSpeak = false;
    const finishSpeakOnce = () => {
      if (hasFinishedSpeak) return;
      hasFinishedSpeak = true;

      if (generation !== this.ttsGeneration || turnIdAtStart !== this.currentTurnId) {
        return;
      }

      this.isTtsActive = false;
      this.stopChromeHeartbeat();

      if (onEnd) {
        this.isAppPausedSttForTts = false;
        this.currentState = 'idle';
        this.notifyStateChange();
        onEnd();
      } else {
        this.resumeMicAfterTts();
      }
    };

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.invokeToastFallbackSafely(onToastFallback, cleanText);
      finishSpeakOnce();
      return;
    }

    const { voice, isFallback } = this.selectVoiceForLanguage(targetLang);
    this.updateBestVoiceDisplay(targetLang);

    // 6. If no local browser voice exists for ta/hi: try pre-recorded audio -> /api/tts -> on-screen text once
    if (isFallback && (targetLang === 'ta' || targetLang === 'hi')) {
      this.addDebugLog('TTS_FALLBACK', `No browser voice for ${targetLang}; trying audio/server fallback once.`);
      this.invokeToastFallbackSafely(onToastFallback, cleanText);
      this.tryFallbackAudioPlayback(cleanText, targetLang, keyId, generation)
        .catch(() => false)
        .finally(() => {
          finishSpeakOnce();
        });
      return;
    }

    const chunks = this.splitTextIntoChunks(cleanText, 180);
    this.startChromeHeartbeat();
    this.speakChunkRecursive(chunks, 0, targetLang, voice, generation, finishSpeakOnce, () => {
      this.invokeToastFallbackSafely(onToastFallback, cleanText);
    });
  }

  private speakChunkRecursive(
    chunks: string[],
    index: number,
    lang: Language,
    voice: SpeechSynthesisVoice | null,
    generation: number,
    onAllChunksDone: () => void,
    onFallbackToast: () => void
  ): void {
    if (generation !== this.ttsGeneration) return;

    if (index >= chunks.length) {
      onAllChunksDone();
      return;
    }

    const chunkText = chunks[index];
    const utterance = new SpeechSynthesisUtterance(chunkText);
    utterance.lang = voice ? voice.lang : LOCALE_MAP[lang];
    if (voice) {
      utterance.voice = voice;
    }
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    let chunkSettled = false;
    const finishChunk = () => {
      if (chunkSettled) return;
      chunkSettled = true;
      clearTimeout(watchdogTimer);
      if (generation !== this.ttsGeneration) return;
      this.speakChunkRecursive(chunks, index + 1, lang, voice, generation, onAllChunksDone, onFallbackToast);
    };

    const estSpeechDurationMs = Math.max(1200, chunkText.length * 75);
    const watchdogMax = Math.min(10000, estSpeechDurationMs + 2500);
    const watchdogTimer = setTimeout(() => {
      finishChunk();
    }, watchdogMax);

    utterance.onend = () => {
      finishChunk();
    };

    utterance.onerror = () => {
      onFallbackToast();
      finishChunk();
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      onFallbackToast();
      finishChunk();
    }
  }

  public cancelSpeech(): void {
    this.ttsGeneration++;
    this.stopChromeHeartbeat();
    if (this.activeAudioElement) {
      try {
        this.activeAudioElement.pause();
        this.activeAudioElement.src = '';
      } catch {
        // Ignore audio cleanup error
      }
      this.activeAudioElement = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          window.speechSynthesis.cancel();
        }
      } catch {
        // Ignore synthesis cancel error
      }
    }
    this.isTtsActive = false;
    if (this.currentState === 'speaking') {
      this.currentState = 'idle';
      this.notifyStateChange();
    }
  }

  /**
   * STT Mic Management via Single Turn Manager Lock
   */
  public requestMic(options: SpeechControllerOptions): boolean | void {
    const normalizedLang = this.normalizeLang(options.language);
    if (this.circuitBreakerTripped) {
      const cbMsg = this.getCircuitBreakerMessage(normalizedLang);
      if (options.onError) options.onError('circuit-breaker', cbMsg);
      return false;
    }

    if (!SpeechService.isSupported()) {
      const message = this.getLocalizedSttErrorMessage('not-supported', normalizedLang);
      this.currentState = 'error';
      this.setTurnState('IDLE', 'stt-unsupported');
      if (options.onError) options.onError('not-supported', message);
      return false;
    }

    // Never create a duplicate recognition session if the exact same owner is already actively listening in the same language
    if (
      this.currentOwner === options.owner &&
      this.currentLanguage === normalizedLang &&
      this.currentState === 'listening' &&
      SpeechService.getIsListening() &&
      !this.isTtsActive
    ) {
      this.activeOptions = options;
      return true;
    }

    // Stop any active TTS before starting STT
    if (this.isTtsActive || this.isAppPausedSttForTts) {
      this.cancelSpeech();
      this.isAppPausedSttForTts = false;
    }

    this.isPinScreen = !!options.isPinScreen;

    // Yield lock if another component owned the mic
    if (this.currentOwner && this.currentOwner !== options.owner) {
      this.stopMicInternal(false);
    }

    this.currentOwner = options.owner;
    this.currentLanguage = normalizedLang;
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

  private checkAndRecordSessionForCircuitBreaker(lang: Language, onError?: (code: string, msg: string) => void): boolean {
    const now = Date.now();
    this.sessionStartTimestamps = this.sessionStartTimestamps.filter(
      ts => now - ts < SpeechControllerManager.CIRCUIT_BREAKER_WINDOW_MS
    );
    this.sessionStartTimestamps.push(now);

    if (this.sessionStartTimestamps.length > SpeechControllerManager.CIRCUIT_BREAKER_MAX_SESSIONS) {
      this.circuitBreakerTripped = true;
      this.cancelSpeech();
      this.stopMicInternal(true);
      this.setTurnState('IDLE', 'circuit-breaker-tripped');
      const warnMsg = this.getCircuitBreakerMessage(lang);
      console.warn('[SpeechController CircuitBreaker] >5 speech sessions started in 10s. Stopping voice until user clicks mic.');
      this.addDebugLog('CIRCUIT_BREAKER', warnMsg);
      if (onError) onError('circuit-breaker', warnMsg);
      this.notifyStateChange();
      return false;
    }
    return true;
  }

  private getCircuitBreakerMessage(lang: Language): string {
    if (lang === 'ta') {
      return 'குரல் தற்காலிகமாக நிறுத்தப்பட்டது. மீண்டும் பேச மைக் பட்டனை அழுத்தவும் அல்லது பட்டனைத் தொடவும்.';
    }
    if (lang === 'hi') {
      return 'आवाज़ अस्थायी रूप से रोकी गई है। फिर से बोलने के लिए माइक दबाएं या बटन चुनें।';
    }
    return 'Voice paused. Please tap a button or press the mic to speak again.';
  }

  private startSttSession(): boolean {
    if (!this.activeOptions || this.isAppPausedSttForTts || this.circuitBreakerTripped) return false;

    const opt = this.activeOptions;
    const rawTargetLang = this.micMode !== 'auto' ? this.micMode : opt.language;
    const targetLang = this.normalizeLang(rawTargetLang);

    // Never start STT while TTS is speaking
    const isBrowserSpeaking = typeof window !== 'undefined' && 'speechSynthesis' in window &&
      (window.speechSynthesis.speaking || window.speechSynthesis.pending);
    if (!opt.allowDuringTts && (this.isTtsActive || isBrowserSpeaking)) {
      if (this.restartTimer) clearTimeout(this.restartTimer);
      this.restartTimer = setTimeout(() => {
        this.restartTimer = null;
        if (this.activeOptions && !this.isIntentionallyStopped && !this.circuitBreakerTripped) {
          this.startSttSession();
        }
      }, 250);
      return true;
    }

    // Check circuit breaker (>5 sessions in 10s)
    if (!this.checkAndRecordSessionForCircuitBreaker(targetLang, opt.onError)) {
      return false;
    }

    const sessionTurnId = this.currentTurnId;
    this.currentState = 'listening';
    this.setTurnState('LISTENING', opt.owner);

    const clearSilenceTimer = () => {
      if (this.silenceTimer) clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    };
    const armSilenceTimer = () => {
      if (!opt.onSilence || !opt.silenceTimeoutMs || this.silenceTimer) return;
      this.silenceTimer = setTimeout(() => {
        this.silenceTimer = null;
        if (this.activeOptions !== opt || this.isIntentionallyStopped || sessionTurnId !== this.currentTurnId) return;
        this.stopMicInternal(false);
        opt.onSilence?.();
      }, opt.silenceTimeoutMs);
    };

    const success = SpeechService.startListening({
      language: rawTargetLang,
      overrideLocale: opt.overrideLocale,
      continuous: opt.continuous ?? false,
      interimResults: opt.interimResults ?? true,
      maxAlternatives: opt.maxAlternatives ?? 5,
      isSensitive: this.isPinScreen,
      onStart: () => {
        if (sessionTurnId !== this.currentTurnId || this.isIntentionallyStopped) return;
        this.currentState = 'listening';
        armSilenceTimer();
        if (opt.onStart) opt.onStart();
        this.notifyStateChange();
      },
      onResult: (transcript, isFinal, nBest) => {
        if (sessionTurnId !== this.currentTurnId || this.isIntentionallyStopped) return;
        if (!opt.allowDuringTts && (this.currentState === 'speaking' || this.isAppPausedSttForTts)) {
          return;
        }
        if (transcript.trim()) {
          clearSilenceTimer();
          armSilenceTimer();
        }
        this.restartAttempts = 0;
        if (isFinal) {
          this.currentState = 'processing';
          this.setTurnState('HANDLING', opt.owner);
        } else {
          this.currentState = 'listening';
        }

        opt.onResult(transcript, isFinal, nBest);
        this.notifyStateChange();
      },
      onError: (errCode: any) => {
        if (sessionTurnId !== this.currentTurnId || this.isIntentionallyStopped) return;
        const errString = (typeof errCode === 'string' ? errCode : errCode?.error || 'unknown').toLowerCase();

        // Intentional or external abort must NEVER auto-restart
        if (errString === 'aborted') {
          clearSilenceTimer();
          this.currentState = 'idle';
          this.setTurnState('IDLE', 'aborted');
          this.notifyStateChange();
          return;
        }

        // Auto-restart at most 2 times per turn on no-speech
        if (errString === 'no-speech') {
          if (this.scheduleSttRestart('no-speech', 400)) {
            return;
          }
        }

        clearSilenceTimer();
        this.isRecognitionBlocked = true;
        this.currentState = 'error';
        this.setTurnState('IDLE', `error:${errString}`);
        if (opt.onError) opt.onError(errString, this.getLocalizedSttErrorMessage(errString, opt.language));
        this.notifyStateChange();
      },
      onEnd: () => {
        if (sessionTurnId !== this.currentTurnId || this.isIntentionallyStopped) return;
        const shouldRestart = opt.continuous && !this.isRecognitionBlocked && this.turnState !== 'HANDLING' &&
          this.scheduleSttRestart('natural-end', 350);
        if (!shouldRestart) clearSilenceTimer();
        if (!shouldRestart && !this.isAppPausedSttForTts && !this.isIntentionallyStopped && opt.onEnd) {
          opt.onEnd();
        }
        if (this.currentState !== 'speaking') {
          this.currentState = shouldRestart ? 'listening' : 'idle';
          if (!shouldRestart) {
            this.setTurnState('IDLE', 'stt-end');
          }
        }
        this.notifyStateChange();
      }
    });

    return success;
  }

  private scheduleSttRestart(reason: string, delay: number): boolean {
    if (
      !this.activeOptions ||
      this.isIntentionallyStopped ||
      this.isAppPausedSttForTts ||
      this.isRecognitionBlocked ||
      this.circuitBreakerTripped ||
      reason === 'aborted'
    ) {
      return false;
    }
    if (this.restartAttempts >= this.maxRestarts) {
      return false;
    }
    if (this.restartTimer) return true;

    this.restartAttempts += 1;
    const expectedTurnId = this.currentTurnId;
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (
        expectedTurnId === this.currentTurnId &&
        this.activeOptions &&
        !this.isIntentionallyStopped &&
        !this.isAppPausedSttForTts &&
        !this.isRecognitionBlocked &&
        !this.circuitBreakerTripped
      ) {
        this.startSttSession();
      }
    }, delay);
    return true;
  }

  public releaseMic(owner: string): void {
    if (this.currentOwner === owner) {
      this.stopMicInternal(true);
    }
  }

  public isSupported(): boolean {
    return SpeechService.isSupported();
  }

  public startListening(options: SpeechControllerOptions): boolean | void {
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
    this.stopMicInternal(true);
  }

  public stopAll(): void {
    this.cancelSpeech();
    this.stopMicInternal(true);
    this.setTurnState('IDLE', 'stopAll');
  }

  public setLanguage(langInput: Language | string): void {
    const lang = this.normalizeLang(langInput);
    this.currentLanguage = lang;
    SpeechService.setLanguage(lang);
    this.updateBestVoiceDisplay(lang);
    if (this.activeOptions && !this.isIntentionallyStopped) {
      this.activeOptions.language = lang;
      if (this.currentState === 'listening' || SpeechService.getIsListening()) {
        this.stopMicInternal(false);
      }
    }
  }

  public async listen(options: ListenOptions): Promise<ListenResult> {
    const owner = options.owner || 'shared_listen_turn';
    const lang = this.normalizeLang(options.language || this.currentLanguage || 'en');
    const timeoutMs = options.timeoutMs ?? 8000;
    const promptQuestion = options.promptQuestion;

    if (!SpeechService.isSupported() || this.circuitBreakerTripped) {
      return { transcript: '', alternatives: [], confidence: 0 };
    }

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
            if (!hasRepeatedOnce && promptQuestion && !this.circuitBreakerTripped) {
              hasRepeatedOnce = true;
              this.speak(
                promptQuestion,
                lang,
                () => {
                  if (!isResolved) {
                    startTurn();
                  }
                },
                undefined,
                `${owner}_repeat`
              );
            } else {
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
          onError: () => {
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
    if (this.turnState === 'LISTENING') {
      this.setTurnState('IDLE', 'mic-stopped');
    }
    this.notifyStateChange();
  }

  private pauseMicForTts(): void {
    if (this.activeOptions?.allowDuringTts) return;
    if (this.currentState === 'listening' || SpeechService.getIsListening()) {
      this.isAppPausedSttForTts = true;
      SpeechService.stopListening();
    }
  }

  private resumeMicAfterTts(): void {
    if (this.isAppPausedSttForTts && this.activeOptions && !this.isIntentionallyStopped && !this.circuitBreakerTripped) {
      const expectedTurnId = this.currentTurnId;
      setTimeout(() => {
        this.isAppPausedSttForTts = false;
        if (
          expectedTurnId === this.currentTurnId &&
          this.activeOptions &&
          !this.isIntentionallyStopped &&
          !this.circuitBreakerTripped
        ) {
          this.startSttSession();
        }
      }, 250);
    } else {
      this.isAppPausedSttForTts = false;
      if (this.currentState === 'speaking') this.currentState = 'idle';
      if (this.turnState === 'SPEAKING') this.setTurnState('IDLE', 'tts-done');
      this.notifyStateChange();
    }
  }

  private getLocalizedSttErrorMessage(code: string, lang: Language | string): string {
    if (code === 'circuit-breaker') {
      const baseLang: Language = typeof lang === 'string' && lang.startsWith('ta') ? 'ta' : typeof lang === 'string' && lang.startsWith('hi') ? 'hi' : 'en';
      return this.getCircuitBreakerMessage(baseLang);
    }
    if (code === 'not-supported') {
      return lang === 'ta'
        ? 'இந்த உலாவியில் குரல் சேவை இல்லை. தயவுசெய்து Chrome பயன்படுத்தவும் அல்லது திரையில் தேர்வு செய்யவும்.'
        : lang === 'hi'
          ? 'इस ब्राउज़र में आवाज़ सेवा उपलब्ध नहीं है। कृपया Chrome का उपयोग करें या स्क्रीन पर विकल्प चुनें।'
          : 'Voice recognition is unavailable here. Please use Chrome or choose an on-screen option.';
    }
    if (code === 'not-allowed' || code === 'audio-capture') {
      return lang === 'ta'
        ? 'மைக் அணுகல் தேவை. தயவுசெய்து உலாவியில் மைக் அனுமதியை வழங்கவும்.'
        : lang === 'hi'
          ? 'माइक्रोफ़ोन एक्सेस की आवश्यकता है। कृपया ब्राउज़र में अनुमति दें।'
          : 'Microphone permission required. Please allow mic access in browser.';
    }
    if (code === 'network') {
      return lang === 'ta'
        ? 'குரல் உணர்தலுக்கு இணைய இணைப்பு தேவை. தயவுசெய்து பட்டனைத் தொடவும்.'
        : lang === 'hi'
          ? 'आवाज़ पहचान के लिए इंटरनेट कनेक्शन आवश्यक है। कृपया बटन दबाएं।'
          : 'Voice recognition requires an active internet connection. Please tap a button.';
    }
    const baseLang: Language = typeof lang === 'string' && lang.startsWith('ta') ? 'ta' : typeof lang === 'string' && lang.startsWith('hi') ? 'hi' : 'en';
    return SpeechService.getLowConfidenceCue(baseLang);
  }
}

export const SpeechController = new SpeechControllerManager();
export const listen = (options: ListenOptions) => SpeechController.listen(options);
