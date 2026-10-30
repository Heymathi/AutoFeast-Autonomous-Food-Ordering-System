import { Language } from '../types';

export interface SpeechRecognitionOptions {
  language: Language | string;
  overrideLocale?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  redactTranscriptLogs?: boolean;
  isSensitive?: boolean;
  onResult: (transcript: string, isFinal: boolean, alternatives?: string[]) => void;
  onError?: (errorCode: string, userMessage: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

const LOCALE_MAP: Record<string, string> = {
  ta: 'ta-IN',
  hi: 'hi-IN',
  en: 'en-IN',
  'ta-IN': 'ta-IN',
  'hi-IN': 'hi-IN',
  'en-IN': 'en-IN'
};

export class SpeechService {
  private static activeRecognition: any = null;
  private static isCurrentlyListening: boolean = false;
  private static isIntentionallyStopped: boolean = false;
  private static currentLanguage: Language = 'en';
  private static activeSessionId: number = 0;

  public static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  public static getLocale(lang: Language | string): string {
    return LOCALE_MAP[lang] || 'en-IN';
  }

  public static setLanguage(lang: Language | string): void {
    const base: Language = String(lang).startsWith('ta') ? 'ta' : String(lang).startsWith('hi') ? 'hi' : 'en';
    this.currentLanguage = base;
  }

  public static getLanguage(): Language {
    return this.currentLanguage;
  }

  public static getIsListening(): boolean {
    return this.isCurrentlyListening;
  }

  public static stopListening(): void {
    this.isIntentionallyStopped = true;
    this.isCurrentlyListening = false;
    if (this.activeRecognition) {
      const recogToStop = this.activeRecognition;
      this.activeRecognition = null;
      try {
        recogToStop.onresult = null;
        recogToStop.onerror = null;
        recogToStop.onend = null;
        recogToStop.onstart = null;
        recogToStop.abort();
      } catch {
        // Ignore abort errors during cleanup
      }
    }
  }

  public static startListening(options: SpeechRecognitionOptions): boolean {
    if (!this.isSupported()) {
      if (options.onError) {
        options.onError('not-supported', this.getErrorMessage('not-supported', options.language));
      }
      return false;
    }

    // Stop any active TTS before starting STT
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          window.speechSynthesis.cancel();
        }
      } catch {
        // Ignore synthesis cancel errors
      }
    }

    // Cleanly stop any existing recognition instance without firing its onEnd/onError
    if (this.activeRecognition) {
      this.stopListening();
    }

    this.isIntentionallyStopped = false;
    const baseLang: Language = String(options.language).startsWith('ta') ? 'ta' : String(options.language).startsWith('hi') ? 'hi' : 'en';
    this.currentLanguage = baseLang;
    this.activeSessionId += 1;

    const SpeechRecognitionConstructor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    try {
      const recog = new SpeechRecognitionConstructor();
      const targetLocale = options.overrideLocale || this.getLocale(options.language);

      recog.lang = targetLocale;
      recog.continuous = options.continuous ?? false;
      recog.interimResults = options.interimResults ?? true;
      recog.maxAlternatives = options.maxAlternatives ?? 5;

      let lastInterimTranscript = '';
      let lastInterimAlternatives: string[] = [];
      let hasDeliveredFinalResult = false;

      recog.onstart = () => {
        if (this.activeRecognition !== recog || this.isIntentionallyStopped) return;
        this.isCurrentlyListening = true;
        if (options.onStart) options.onStart();
      };

      recog.onresult = (event: any) => {
        if (this.activeRecognition !== recog || this.isIntentionallyStopped) return;

        let interimTranscript = '';
        let finalTranscript = '';
        const alternativesList: string[] = [];

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const resultItem = event.results[i];
          const primaryText = resultItem[0]?.transcript || '';

          for (let j = 0; j < resultItem.length; j++) {
            const altText = resultItem[j]?.transcript?.trim();
            if (altText) alternativesList.push(altText);
          }

          if (resultItem.isFinal) {
            finalTranscript += primaryText;
          } else {
            interimTranscript += primaryText;
          }
        }

        const isFinal = finalTranscript.trim().length > 0;
        const primaryTranscript = (isFinal ? finalTranscript : interimTranscript).trim();

        if (primaryTranscript) {
          const uniqueAlternatives = Array.from(new Set([primaryTranscript, ...alternativesList]));
          if (isFinal) {
            hasDeliveredFinalResult = true;
            lastInterimTranscript = '';
            lastInterimAlternatives = [];
            options.onResult(primaryTranscript, true, uniqueAlternatives);
          } else {
            lastInterimTranscript = primaryTranscript;
            lastInterimAlternatives = uniqueAlternatives;
            options.onResult(primaryTranscript, false, uniqueAlternatives);
          }
        }
      };

      recog.onerror = (event: any) => {
        if (this.activeRecognition !== recog) return;
        const errorCode = event?.error || 'unknown';

        // Intentional abort must never trigger error or restart
        if (errorCode === 'aborted' && this.isIntentionallyStopped) {
          this.isCurrentlyListening = false;
          return;
        }

        this.isCurrentlyListening = false;
        const userMessage = this.getErrorMessage(errorCode, this.currentLanguage);
        if (options.onError) {
          options.onError(errorCode, userMessage);
        }
      };

      recog.onend = () => {
        if (this.activeRecognition !== recog) return;
        const wasIntentional = this.isIntentionallyStopped;
        this.isCurrentlyListening = false;
        this.activeRecognition = null;

        if (wasIntentional) {
          return;
        }

        // Flush buffered interim transcript as final if browser ended session before marking isFinal=true
        if (!hasDeliveredFinalResult && lastInterimTranscript.trim().length > 0) {
          hasDeliveredFinalResult = true;
          const flushed = lastInterimTranscript.trim();
          const flushedAlts = lastInterimAlternatives.length > 0 ? lastInterimAlternatives : [flushed];
          lastInterimTranscript = '';
          lastInterimAlternatives = [];
          try {
            options.onResult(flushed, true, flushedAlts);
          } catch {
            // Ignore handler error during flush
          }
        }

        if (options.onEnd) {
          options.onEnd();
        }
      };

      this.activeRecognition = recog;
      recog.start();
      return true;
    } catch {
      this.isCurrentlyListening = false;
      this.activeRecognition = null;
      if (options.onError) {
        options.onError('start-failed', this.getErrorMessage('start-failed', options.language));
      }
      return false;
    }
  }

  public static getErrorMessage(errorCode: string, lang: Language | string): string {
    const baseLang: Language = String(lang).startsWith('ta') ? 'ta' : String(lang).startsWith('hi') ? 'hi' : 'en';
    const messages: Record<string, Record<Language, string>> = {
      'no-speech': {
        ta: 'குரல் கேட்கவில்லை. மீண்டும் பேசவும் அல்லது பட்டனைத் தொடவும்.',
        hi: 'कोई आवाज़ नहीं सुनाई दी। कृपया फिर से बोलें या बटन दबाएं।',
        en: 'No speech detected. Please speak again or tap a button.'
      },
      'audio-capture': {
        ta: 'மைக்ரோஃபோன் கிடைக்கவில்லை. உங்கள் மைக்கை சரிபார்க்கவும்.',
        hi: 'माइक्रोफ़ोन नहीं मिला। कृपया अपना माइक जांचें।',
        en: 'No microphone found. Please check your microphone.'
      },
      'not-allowed': {
        ta: 'மைக்ரோஃபோன் அனுமதி மறுக்கப்பட்டது. உலாவியில் மைக் அனுமதியை வழங்கவும்.',
        hi: 'माइक्रोफ़ोन की अनुमति नहीं है। कृपया ब्राउज़र में अनुमति दें।',
        en: 'Microphone permission denied. Please allow microphone access.'
      },
      'network': {
        ta: 'நெட்வொர்க் பிழை. தயவுசெய்து பட்டனைத் தொடவும்.',
        hi: 'नेटवर्क त्रुटि। कृपया बटन दबाएं।',
        en: 'Network error during speech recognition. Please tap a button.'
      },
      'not-supported': {
        ta: 'உங்கள் உலாவியில் குரல் அறிதல் ஆதரிக்கப்படவில்லை.',
        hi: 'आपके ब्राउज़र में वॉइस रिकग्निशन समर्थित नहीं है।',
        en: 'Speech recognition is not supported in this browser.'
      }
    };

    const entry = messages[errorCode];
    if (entry) return entry[baseLang] || entry.en;

    return baseLang === 'ta'
      ? 'குரல் அறிதலில் பிழை. தயவுசெய்து பட்டனைத் தொடவும்.'
      : baseLang === 'hi'
      ? 'वॉइस रिकग्निशन में त्रुटि। कृपया बटन दबाएं।'
      : 'Speech recognition paused. Please tap a button or press the mic.';
  }

  public static getLowConfidenceCue(lang: Language | string): string {
    const baseLang: Language = String(lang).startsWith('ta') ? 'ta' : String(lang).startsWith('hi') ? 'hi' : 'en';
    return baseLang === 'ta'
      ? 'தெளிவாகக் கேட்கவில்லை. மீண்டும் சொல்லுங்கள் அல்லது பட்டனைத் தொடவும்.'
      : baseLang === 'hi'
      ? 'साफ़ सुनाई नहीं दिया। कृपया फिर से बोलें या बटन दबाएं।'
      : 'Could not hear clearly. Please say it again or tap a button.';
  }
}
