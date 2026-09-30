import { Language } from '../types';
import { parsePinSpeech, ParsePinSpeechResult } from './pinVoiceParserService';


export interface SpeechRecognitionOptions {
  language: Language;
  overrideLocale?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  autoRestart?: boolean;
  onStart?: () => void;
  onResult: (transcript: string, isFinal: boolean, nBestTranscripts?: string[]) => void;
  onError?: (error: any) => void;
  onEnd?: () => void;
}

export class SpeechService {
  private static activeRecognition: any = null;
  private static isListening: boolean = false;
  private static sessionCounter: number = 0;
  private static currentLanguage: Language = 'en';

  private static lastSpokenText: string = '';

  public static setLastSpokenText(text: string): void {
    this.lastSpokenText = (text || '').toLowerCase().trim();
  }

  public static getLastSpokenText(): string {
    return this.lastSpokenText;
  }

  public static isEchoText(transcript: string): boolean {
    if (!transcript) return false;
    const cleanRaw = transcript.toLowerCase().trim();
    if (!cleanRaw) return false;

    // 1. Suppress recognition if browser TTS synthesis is actively speaking
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
      return true;
    }

    // 2. Suppress recognition if transcript matches last spoken TTS prompt
    if (this.lastSpokenText) {
      if (cleanRaw === this.lastSpokenText) return true;
      if (this.lastSpokenText.length > 8 && (cleanRaw.includes(this.lastSpokenText) || this.lastSpokenText.includes(cleanRaw))) {
        return true;
      }
    }

    return false;
  }

  public static setLanguage(lang: Language): void {
    console.log(`[SpeechService] Updating active STT recognition language to: "${lang}" (${this.getLocale(lang)})`);
    this.currentLanguage = lang;
  }

  public static getCurrentLanguage(): Language {
    return this.currentLanguage;
  }

  public static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  public static getLocale(lang: Language): string {
    switch (lang) {
      case 'ta':
        return 'ta-IN';
      case 'hi':
        return 'hi-IN';
      case 'en':
      default:
        return 'en-IN';
    }
  }

  public static getLowConfidenceCue(lang: Language): string {
    switch (lang) {
      case 'ta':
        return 'மன்னிக்கவும், தெளிவாகக் கேட்கவில்லை. மீண்டும் சொல்லுங்கள்.';
      case 'hi':
        return 'क्षमा करें, स्पष्ट रूप से नहीं सुना। कृपया फिर से बोलें।';
      case 'en':
      default:
        return "Sorry, I didn't catch that clearly. Please repeat.";
    }
  }

  /**
   * Completely stop and destroy any running SpeechRecognition instance,
   * detaching all event listeners first so asynchronous native events don't leak.
   */
  public static stopListening(): void {
    if (this.activeRecognition) {
      console.log('[SpeechService] Cleaning up & aborting active recognition instance...');
      const instance = this.activeRecognition;
      this.activeRecognition = null;
      this.isListening = false;

      try {
        instance.onstart = null;
        instance.onresult = null;
        instance.onerror = null;
        instance.onend = null;

        if (typeof instance.abort === 'function') {
          instance.abort();
        }
        if (typeof instance.stop === 'function') {
          instance.stop();
        }
      } catch (err) {
        console.warn('[SpeechService] Non-critical error while stopping recognition:', err);
      }
    } else {
      this.isListening = false;
    }
  }

  /**
   * Start a brand-new SpeechRecognition session, properly re-armed and reset.
   */
  public static startListening(options: SpeechRecognitionOptions): boolean {
    if (!this.isSupported()) {
      console.warn('[SpeechService] Speech Recognition API is not supported in this browser.');
      if (options.onError) options.onError('Speech recognition not supported in this browser.');
      return false;
    }

    // 1. Force full cleanup of previous session
    this.stopListening();

    // 2. Allow active TTS speech synthesis to complete naturally without interrupting spoken prompts
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
      console.log('[SpeechService] TTS active while starting listening session; allowing TTS prompt to speak...');
    }

    const currentSessionId = ++this.sessionCounter;
    console.log(`[SpeechService Session #${currentSessionId}] Creating fresh SpeechRecognition instance...`);

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recog = new SpeechRecognition();

      recog.continuous = options.continuous ?? true;
      recog.interimResults = options.interimResults ?? true;
      recog.maxAlternatives = options.maxAlternatives ?? 5;
      const targetLang = options.language || this.currentLanguage || 'en';
      recog.lang = options.overrideLocale || this.getLocale(targetLang);

      recog.onstart = () => {
        if (this.activeRecognition !== recog) return;
        this.isListening = true;
        console.log(`[SpeechService Session #${currentSessionId} SUCCESS] Mic Listening Active. Locale: ${recog.lang}`);
        if (options.onStart) options.onStart();
      };

      recog.onresult = (event: any) => {
        if (this.activeRecognition !== recog) return;

        let interimText = '';
        let finalText = '';
        const nBestSet = new Set<string>();

        // Loop from index 0 across all result buffers so pauses between phrases don't drop earlier words
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          const primary = result[0]?.transcript || '';
          if (result.isFinal) {
            finalText += (finalText ? ' ' : '') + primary;
          } else {
            interimText += (interimText ? ' ' : '') + primary;
          }

          // Collect n-best alternative hypotheses for this speech segment
          for (let j = 0; j < result.length; j++) {
            if (result[j]?.transcript) {
              nBestSet.add(result[j].transcript.trim());
            }
          }
        }

        const recognizedText = (finalText.trim() + ' ' + interimText.trim()).trim();
        const isFinal = !!finalText.trim();
        const nBestTranscripts = Array.from(nBestSet);

        if (SpeechService.isEchoText(recognizedText)) {
          console.log(`[SpeechService ECHO FILTER]: Suppressed app's own spoken prompt echo -> "${recognizedText}"`);
          return;
        }

        // Temporary logging: Raw transcript, isFinal status, and results length
        console.log(`[SpeechService RAW TRANSCRIPT LOG]: "${recognizedText}" | isFinal: ${isFinal} | n-best: ${nBestTranscripts.join(' | ')}`);
        options.onResult(recognizedText, isFinal, nBestTranscripts);
      };

      recog.onerror = (event: any) => {
        if (this.activeRecognition !== recog) return;
        const errorReason = event.error || 'Unknown speech error';
        console.warn(`[SpeechService Session #${currentSessionId} END LOG - ERROR]: Reason: "${errorReason}"`);
        this.isListening = false;
        if (options.onError) options.onError(errorReason);
      };

      recog.onend = () => {
        if (this.activeRecognition !== recog) return;
        this.isListening = false;
        console.log(`[SpeechService Session #${currentSessionId} END LOG - NATURAL END]: Reason: Speech input session ended by browser or silence.`);
        if (options.onEnd) options.onEnd();
      };

      this.activeRecognition = recog;

      // Small 80ms buffer before starting recognition to ensure audio hardware clean state
      setTimeout(() => {
        if (this.activeRecognition === recog) {
          try {
            recog.start();
          } catch (err: any) {
            console.warn(`[SpeechService Session #${currentSessionId}] Start error:`, err);
            this.isListening = false;
            if (options.onError) options.onError(err);
          }
        }
      }, 80);

      return true;
    } catch (err) {
      console.error(`[SpeechService Session #${currentSessionId}] Exception during creation:`, err);
      this.isListening = false;
      if (options.onError) options.onError(err);
      return false;
    }
  }

  public static getIsListening(): boolean {
    return this.isListening;
  }

  /**
   * Helper function to extract 4 PIN digits from raw speech transcript using language-agnostic parser
   */
  public static extractFourDigits(rawTranscript: string, lang?: string): string[] | null {
    const res = parsePinSpeech(rawTranscript, lang);
    if (res.status === 'success' && res.digits.length === 4) {
      return res.digits;
    }
    return null;
  }

  public static parsePinSpeech(rawTranscript: string, lang?: string): ParsePinSpeechResult {
    return parsePinSpeech(rawTranscript, lang);
  }
}

