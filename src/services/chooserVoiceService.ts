import { Language } from '../types';
import { FuzzyMatchEngine } from './fuzzyMatchService';

export type ChooserAction = 'order_now' | 'schedule' | 'add_to_cart';

export class ChooserVoiceService {
  /**
   * Parse user spoken response for ItemActionChooser in English, Tamil, Hindi, Tanglish, and Hinglish.
   */
  static parseChooserAction(spokenText: string, lastSpokenPrompt?: string): ChooserAction | 'retry' | null {
    if (!spokenText || !spokenText.trim()) return null;

    const text = spokenText.toLowerCase().trim();

    // 1. ECHO CANCELLATION: Ignore transcript if it matches the app's prompt
    if (lastSpokenPrompt) {
      const promptLower = lastSpokenPrompt.toLowerCase().trim();
      if (text === promptLower || text.includes(promptLower) || promptLower.includes(text)) {
        console.log('[ChooserVoiceService]: Ignored echo of app prompt:', text);
        return null;
      }
    }

    // Keywords dictionary
    const orderKeywords = [
      'order now', 'instant', 'now', 'order', 'buy now', 'place order',
      'ippove order pannu', 'ippove order', 'ippove', 'udane', 'ஆர்டர்', 'இப்போதே', 'உடனே', 'இப்போதே ஆர்டர்', 'ஆர்டர் செய்',
      'अभी', 'तुरंत ऑर्डर', 'अभी ऑर्डर करें', 'तुरंत', 'abhi', 'turant', 'abhi order'
    ];

    const scheduleKeywords = [
      'schedule', 'later', 'daily', 'weekly', 'schedule order', 'book later',
      'schedule pannu', 'thittamidu', 'appram', 'திட்டமிடு', 'அப்புறம்', 'நாளைக்கு',
      'शेड्यूल', 'बाद में', 'कल', 'schedule karo', 'bad me', 'baad me'
    ];

    const cartKeywords = [
      'cart', 'add to cart', 'cart la podu', 'add cart', 'put in cart', 'cart-il ser',
      'கார்ட்', 'கார்ட்டில் சேர்', 'கார்ட்டில் போடு', 'கார்ட்டில்',
      'कार्ट', 'कार्ट में डालो', 'कार्ट में जोड़ें', 'cart me dalo', 'cart me jod'
    ];

    // Check exact or phrase inclusion first
    for (const kw of orderKeywords) {
      if (text.includes(kw.toLowerCase())) return 'order_now';
    }
    for (const kw of scheduleKeywords) {
      if (text.includes(kw.toLowerCase())) return 'schedule';
    }
    for (const kw of cartKeywords) {
      if (text.includes(kw.toLowerCase())) return 'add_to_cart';
    }

    // Fuzzy matching fallback
    const bestOrder = FuzzyMatchEngine.findBestMatch(text, orderKeywords);
    const bestSchedule = FuzzyMatchEngine.findBestMatch(text, scheduleKeywords);
    const bestCart = FuzzyMatchEngine.findBestMatch(text, cartKeywords);

    const scores = [
      { action: 'order_now' as ChooserAction, score: bestOrder ? bestOrder.score : 0 },
      { action: 'schedule' as ChooserAction, score: bestSchedule ? bestSchedule.score : 0 },
      { action: 'add_to_cart' as ChooserAction, score: bestCart ? bestCart.score : 0 }
    ].sort((a, b) => b.score - a.score);

    if (scores[0].score >= 0.65) {
      console.log(`[ChooserVoiceService]: Fuzzy matched action: ${scores[0].action} (score: ${scores[0].score})`);
      return scores[0].action;
    }

    if (scores[0].score >= 0.4) {
      console.log(`[ChooserVoiceService]: Low confidence match (${scores[0].score}) -> trigger retry prompt.`);
      return 'retry';
    }

    return null;
  }
}
