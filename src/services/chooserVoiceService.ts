import { Language } from '../types';
import { VoiceIntentRouter } from './voiceIntentRouter';

export type ChooserAction = 'order_now' | 'schedule' | 'add_to_cart' | 'cancel' | 'retry' | 'instant' | 'cart' | null;

export class ChooserVoiceService {
  /**
   * Primary parser used by ItemActionChooser and voice tests:
   * Maps English, Tamil, Hindi, Tanglish, and Hinglish transcripts to:
   * 'order_now' | 'schedule' | 'add_to_cart' | 'cancel' | 'retry'
   */
  public static parseChooserAction(
    candidates: string | string[],
    promptText: string = '',
    lang: Language = 'en'
  ): 'order_now' | 'schedule' | 'add_to_cart' | 'cancel' | 'retry' {
    const list = Array.isArray(candidates) ? candidates : [candidates];
    const cleanPrompt = VoiceIntentRouter.normalize(promptText);

    // Filter out echo of the TTS prompt itself if present
    const filtered = list.filter(c => {
      const norm = VoiceIntentRouter.normalize(c);
      if (!norm) return false;
      if (cleanPrompt && cleanPrompt.length > 15 && cleanPrompt.includes(norm) && norm.split(' ').length > 5) {
        return false;
      }
      return true;
    });

    if (filtered.length === 0) return 'retry';

    const match = VoiceIntentRouter.matchItemChooserIntent(filtered, lang);
    if (match.action === 'order_now') return 'order_now';
    if (match.action === 'schedule') return 'schedule';
    if (match.action === 'add_to_cart') return 'add_to_cart';
    if (match.action === 'cancel') return 'cancel';
    return 'retry';
  }

  /**
   * Backward-compatible alias returning 'instant' | 'schedule' | 'cart' | 'cancel' | null
   */
  public static matchChooserAction(transcript: string, lang: Language = 'en'): 'instant' | 'schedule' | 'cart' | 'cancel' | null {
    if (!transcript) return null;
    const match = VoiceIntentRouter.matchItemChooserIntent(transcript, lang);
    if (match.action === 'order_now') return 'instant';
    if (match.action === 'schedule') return 'schedule';
    if (match.action === 'add_to_cart') return 'cart';
    if (match.action === 'cancel') return 'cancel';
    return null;
  }
}
