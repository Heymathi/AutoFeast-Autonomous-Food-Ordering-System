import { Language, FoodItem } from '../types';
import { SttMatcherService } from './sttMatcherService';
import { parsePinSpeech, ParsePinSpeechResult } from './pinVoiceParserService';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';

export type ChooserVoiceAction = 'order_now' | 'schedule' | 'add_to_cart' | 'cancel' | 'repeat' | null;
export type ConfirmVoiceAction = 'confirm' | 'cancel' | 'repeat' | null;
export type NomineeWaitingVoiceAction = 'send_reminder' | 'cancel' | null;
export type NomineePortalVoiceAction =
  | { type: 'approve'; targetItemName?: string }
  | { type: 'deny'; targetItemName?: string }
  | { type: 'add_restricted'; item: FoodItem }
  | { type: 'remove_restricted'; item: FoodItem }
  | { type: 'cancel' }
  | null;

export interface VoiceIntentMatch<T> {
  action: T;
  confidence: 'high' | 'low' | 'none';
  matchedPhrase?: string;
}

const ORDER_NOW_PHRASES = [
  'order now', 'order it now', 'instant order', 'instant', 'buy now', 'place order now',
  'ippove order', 'ippo order', 'ippave order', 'udane order', 'order pannu', 'order seiyum', 'order sei',
  'இப்போதே ஆர்டர்', 'இப்போதே ஆர்டர் செய்', 'இப்போதே ஆர்டர் செய்யவும்', 'இப்போ ஆர்டர்', 'ஆர்டர் பண்ணு',
  'ஆர்டர் செய்', 'உடனே ஆர்டர்', 'உடனடி ஆர்டர்', 'இப்போதே',
  'abhi order', 'abhi order karo', 'order karo', 'turant order', 'abhi mangao',
  'अभी ऑर्डर', 'अभी ऑर्डर करें', 'ऑर्डर करो', 'तुरंत ऑर्डर', 'अभी मंगाओ', 'अभी ऑर्डर करो'
];

const SCHEDULE_PHRASES = [
  'schedule', 'schedule for later', 'schedule later', 'later', 'plan for later', 'book for later',
  'thittamidu', 'schedule pannu', 'appuram', 'piragu', 'attavanai',
  'திட்டமிடு', 'பிறகு திட்டமிடு', 'பின்னர் திட்டமிடு', 'அட்டவணை', 'அட்டவணைப்படுத்து', 'பிறகு', 'நாளைக்கு',
  'baad mein', 'baad me', 'schedule karo', 'baad ke liye',
  'बाद में', 'शेड्यूल', 'शेड्यूल करें', 'शेड्यूल करो', 'बाद के लिए', 'बाद के लिए शेड्यूल करें'
];

const ADD_TO_CART_PHRASES = [
  'add to cart', 'add cart', 'put in cart', 'save to cart', 'cart', 'basket',
  'cart la podu', 'cart il ser', 'koodaiyil ser', 'kudaiyil ser',
  'கார்ட்டில் சேர்', 'கார்ட்', 'கூடையில் சேர்', 'கார்ட்டில் போடு', 'கூடை',
  'cart mein daalo', 'cart me dalo', 'cart mein jodo', 'cart me add karo',
  'कार्ट में डालो', 'कार्ट में जोड़ें', 'कार्ट में डालें', 'कार्ट'
];

const YES_CONFIRM_PHRASES = [
  'yes', 'yeah', 'yep', 'ok', 'okay', 'sure', 'confirm', 'proceed', 'go ahead', 'do it', 'correct', 'right', 'allow',
  'aama', 'aamam', 'sari', 'seri', 'uruthi', 'sey', 'ok pannu',
  'ஆமா', 'ஆம்', 'சரி', 'ஓகே', 'ஆமாம்', 'உறுதி', 'செய்', 'தொடரவும்', 'அனுமதி',
  'haan', 'ha', 'haanji', 'ji haan', 'theek hai', 'thik hai', 'sahi', 'kar do', 'karo',
  'हाँ', 'जी हाँ', 'हाँजी', 'ठीक है', 'ठीक', 'सही', 'करो', 'पुष्टि करें', 'आगे बढ़ें'
];

const NO_CANCEL_PHRASES = [
  'no', 'nope', 'cancel', 'stop', 'close', 'exit', 'back', 'go back', 'never mind', 'dont', "don't", 'deny', 'skip',
  'illai', 'illa', 'venam', 'vendam', 'vaendaam', 'vendaam', 'rathu', 'niruthu', 'moodu',
  'இல்லை', 'வேண்டாம்', 'ரத்து', 'ரத்து செய்', 'நிறுத்து', 'மூடு', 'வெளியேறு', 'வேணாம்', 'இல்ல', 'पின்னால்', 'பின்னால்',
  'nahi', 'nahin', 'naa', 'mat', 'band karo', 'ruko', 'hato', 'cancel karo',
  'नहीं', 'ना', 'मना', 'रद्द', 'रद्द करें', 'रोकें', 'बंद करो', 'बंद', 'रुको', 'पीछे', 'वापस'
];

const REPEAT_PHRASES = [
  'repeat', 'say again', 'what', 'pardon', 'hear again',
  'marupadiyum', 'meendum', 'meendum sollu', 'marupadiyum sollu',
  'மீண்டும்', 'மறுபடியும்', 'மீண்டும் சொல்லுங்கள்',
  'phir se', 'dobara', 'phir se bolo', 'दोहराएं', 'फिर से', 'फिर से बोलें'
];

const REMINDER_PHRASES = [
  'send reminder', 'reminder', 'resend', 'resend email', 'send email again', 'remind nominee', 'send again',
  'ninaivootal', 'meendum anuppu', 'reminder anuppu',
  'நினைவூட்டல்', 'நினைவூட்டல் அனுப்பு', 'மீண்டும் அனுப்பு', 'மின்னஞ்சல் அனுப்பு',
  'reminder bhejo', 'phir se bhejo', 'dobara bhejo',
  'रिमाइंडर', 'रिमाइंडर भेजें', 'फिर से भेजें', 'ईमेल भेजें'
];

const APPROVE_PHRASES = [
  'approve', 'accept', 'allow', 'grant',
  'anumathi', 'oppukkol', 'approve pannu',
  'அனுமதி', 'ஒப்புக்கொள்', 'ஏற்றுக்கொள்', 'அப்ரூவ்',
  'manzoor', 'swikar', 'approve karo', 'haan',
  'मंज़ूर', 'स्वीकार', 'अप्रूव', 'अनुमति दें'
];

const DENY_PHRASES = [
  'deny', 'reject', 'decline', 'refuse',
  'maru', 'niragari', 'deny pannu',
  'மறு', 'நிராகரி', 'வேண்டாம்',
  'aswikar', 'mana karo', 'reject karo',
  'अस्वीकार', 'मना करें', 'अस्वीकृत'
];

export class VoiceIntentRouter {
  /**
   * Normalize any spoken transcript across English, Tamil, Hindi, Tanglish, Hinglish
   */
  public static normalize(text: string): string {
    if (!text || typeof text !== 'string') return '';
    return text
      .toLowerCase()
      .replace(/[.,!?;:()"'~`\-_/\\[\]{}]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static toCandidateList(transcript: string | string[]): string[] {
    const raw = Array.isArray(transcript) ? transcript : [transcript];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of raw) {
      const norm = this.normalize(item);
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        result.push(norm);
      }
    }
    return result;
  }

  private static matchesAnyPhrase(candidate: string, phrases: string[]): string | null {
    const padded = ` ${candidate} `;
    for (const rawPhrase of phrases) {
      const phrase = this.normalize(rawPhrase);
      if (!phrase) continue;
      if (candidate === phrase || padded.includes(` ${phrase} `) || candidate.includes(phrase)) {
        return phrase;
      }
    }
    return null;
  }

  /**
   * 1. Item Chooser Intent Matcher (Order Now / Schedule / Add to Cart / Cancel / Repeat)
   */
  public static matchItemChooserIntent(
    transcript: string | string[],
    _language: Language = 'en'
  ): VoiceIntentMatch<ChooserVoiceAction> {
    const candidates = this.toCandidateList(transcript);
    if (candidates.length === 0) {
      return { action: null, confidence: 'none' };
    }

    for (const cand of candidates) {
      // Check Add to Cart first so "add to cart" isn't confused with generic words
      const cartHit = this.matchesAnyPhrase(cand, ADD_TO_CART_PHRASES);
      if (cartHit) {
        return { action: 'add_to_cart', confidence: 'high', matchedPhrase: cartHit };
      }

      // Check Schedule before Order Now so "schedule order" or "schedule for later" maps to schedule
      const scheduleHit = this.matchesAnyPhrase(cand, SCHEDULE_PHRASES);
      if (scheduleHit) {
        return { action: 'schedule', confidence: 'high', matchedPhrase: scheduleHit };
      }

      // Check Order Now (including standalone "order" / "ஆர்டர்" / "ऑर्डर")
      const orderHit = this.matchesAnyPhrase(cand, ORDER_NOW_PHRASES);
      if (orderHit) {
        return { action: 'order_now', confidence: 'high', matchedPhrase: orderHit };
      }
      if (cand === 'order' || cand === 'ஆர்டர்' || cand === 'ऑर्डर') {
        return { action: 'order_now', confidence: 'high', matchedPhrase: cand };
      }

      // Check Repeat
      const repeatHit = this.matchesAnyPhrase(cand, REPEAT_PHRASES);
      if (repeatHit) {
        return { action: 'repeat', confidence: 'high', matchedPhrase: repeatHit };
      }

      // Check Cancel / Close
      const cancelHit = this.matchesAnyPhrase(cand, NO_CANCEL_PHRASES);
      if (cancelHit) {
        return { action: 'cancel', confidence: 'high', matchedPhrase: cancelHit };
      }
    }

    // Numeric option shortcuts ("1", "first", "one" -> order_now; "2", "second" -> schedule; "3", "third" -> add_to_cart)
    for (const cand of candidates) {
      if (/^(1|one|first|ஒன்று|ஒன்னு|एक|पहला)$/.test(cand)) {
        return { action: 'order_now', confidence: 'high', matchedPhrase: cand };
      }
      if (/^(2|two|second|இரண்டு|ரெண்டு|दो|दूसरा)$/.test(cand)) {
        return { action: 'schedule', confidence: 'high', matchedPhrase: cand };
      }
      if (/^(3|three|third|மூன்று|மூணு|तीन|तीसरा)$/.test(cand)) {
        return { action: 'add_to_cart', confidence: 'high', matchedPhrase: cand };
      }
    }

    return { action: null, confidence: 'none' };
  }

  /**
   * 2. Confirmation Dialog Intent Matcher (Yes/Confirm vs No/Cancel)
   */
  public static matchConfirmationIntent(
    transcript: string | string[],
    language: Language = 'en'
  ): VoiceIntentMatch<ConfirmVoiceAction> {
    const candidates = this.toCandidateList(transcript);
    if (candidates.length === 0) {
      return { action: null, confidence: 'none' };
    }

    for (const cand of candidates) {
      const repeatHit = this.matchesAnyPhrase(cand, REPEAT_PHRASES);
      if (repeatHit) {
        return { action: 'repeat', confidence: 'high', matchedPhrase: repeatHit };
      }

      // Check NO/Cancel before YES so "no ok" or "don't confirm" is always cancel
      const noHit = this.matchesAnyPhrase(cand, NO_CANCEL_PHRASES);
      if (noHit) {
        return { action: 'cancel', confidence: 'high', matchedPhrase: noHit };
      }

      const negated = /\b(not sure|not ok|not ready|dont|don't|வேண்டாம்|இல்லை|नहीं|मत)\b/i.test(cand);
      const yesHit = this.matchesAnyPhrase(cand, YES_CONFIRM_PHRASES);
      if (yesHit && !negated) {
        return { action: 'confirm', confidence: 'high', matchedPhrase: yesHit };
      }
    }

    const fallback = SttMatcherService.matchConfirmation(candidates, language);
    if (fallback.isMatched && fallback.matchedValue === 'YES') {
      return { action: 'confirm', confidence: fallback.confidence >= 0.8 ? 'high' : 'low' };
    }
    if (fallback.isMatched && fallback.matchedValue === 'NO') {
      return { action: 'cancel', confidence: fallback.confidence >= 0.8 ? 'high' : 'low' };
    }

    return { action: null, confidence: 'none' };
  }

  /**
   * 3. PIN Speech Parser Wrapper
   * Never logs or speaks digits. Returns parsed digits and whether a repeat prompt is needed (without counting an attempt).
   */
  public static parsePinIntent(transcript: string | string[], lang: Language = 'en'): {
    parsed: ParsePinSpeechResult;
    isComplete4Digits: boolean;
    needsRepeatWithoutPenalty: boolean;
    isCancel: boolean;
  } {
    const candidates = this.toCandidateList(transcript);
    for (const cand of candidates) {
      if (this.matchesAnyPhrase(cand, NO_CANCEL_PHRASES)) {
        return {
          parsed: { digits: [], status: 'command', command: 'cancel' },
          isComplete4Digits: false,
          needsRepeatWithoutPenalty: false,
          isCancel: true
        };
      }
    }

    let bestParsed: ParsePinSpeechResult = { digits: [], status: 'no_speech' };
    for (const raw of (Array.isArray(transcript) ? transcript : [transcript])) {
      const p = parsePinSpeech(raw || '', lang);
      if (p.status === 'success' && p.digits.length === 4) {
        return {
          parsed: p,
          isComplete4Digits: true,
          needsRepeatWithoutPenalty: false,
          isCancel: false
        };
      }
      if (p.digits.length > bestParsed.digits.length) {
        bestParsed = p;
      }
    }

    return {
      parsed: bestParsed,
      isComplete4Digits: false,
      needsRepeatWithoutPenalty: bestParsed.digits.length !== 4,
      isCancel: false
    };
  }

  /**
   * 6a. User-side Nominee Waiting Modal Intent ("send reminder" / "cancel")
   */
  public static matchNomineeWaitingIntent(
    transcript: string | string[]
  ): VoiceIntentMatch<NomineeWaitingVoiceAction> {
    const candidates = this.toCandidateList(transcript);
    for (const cand of candidates) {
      const reminderHit = this.matchesAnyPhrase(cand, REMINDER_PHRASES);
      if (reminderHit) {
        return { action: 'send_reminder', confidence: 'high', matchedPhrase: reminderHit };
      }
      const cancelHit = this.matchesAnyPhrase(cand, NO_CANCEL_PHRASES);
      if (cancelHit) {
        return { action: 'cancel', confidence: 'high', matchedPhrase: cancelHit };
      }
    }
    return { action: null, confidence: 'none' };
  }

  /**
   * 6b. Nominee Control / Portal Intent (Approve / Deny / Add Restricted / Remove Restricted)
   * Note: Approve/Deny by voice only selects the action and opens/focuses the Nominee PIN step — never bypasses PIN!
   */
  public static matchNomineePortalIntent(
    transcript: string | string[],
    catalog: FoodItem[] = INDIAN_FOOD_CATALOG,
    language: Language = 'en'
  ): VoiceIntentMatch<NomineePortalVoiceAction> {
    const candidates = this.toCandidateList(transcript);
    for (const cand of candidates) {
      // Check add/remove restricted food item first if food item is mentioned
      const isRemove = /\b(remove|unrestrict|delete|allow item|நீக்கு|அகற்று|हटाओ|हटाएं)\b/i.test(cand);
      const isAdd = /\b(add|restrict|block|சேர்|தடை|जोड़ो|रोकें|प्रतिबंधित)\b/i.test(cand);
      if (isRemove || isAdd) {
        const matchedFood = SttMatcherService.matchFoodItem(cand, catalog, language);
        if (matchedFood) {
          return {
            action: isRemove
              ? { type: 'remove_restricted', item: matchedFood }
              : { type: 'add_restricted', item: matchedFood },
            confidence: 'high',
            matchedPhrase: cand
          };
        }
      }

      const denyHit = this.matchesAnyPhrase(cand, DENY_PHRASES);
      if (denyHit) {
        return { action: { type: 'deny' }, confidence: 'high', matchedPhrase: denyHit };
      }

      const approveHit = this.matchesAnyPhrase(cand, APPROVE_PHRASES);
      if (approveHit) {
        return { action: { type: 'approve' }, confidence: 'high', matchedPhrase: approveHit };
      }

      const cancelHit = this.matchesAnyPhrase(cand, NO_CANCEL_PHRASES);
      if (cancelHit) {
        return { action: { type: 'cancel' }, confidence: 'high', matchedPhrase: cancelHit };
      }
    }
    return { action: null, confidence: 'none' };
  }

  /**
   * Localized "Please repeat or tap a button" message
   */
  public static getAskRepeatMessage(language: Language): string {
    if (language === 'ta') {
      return 'புரியவில்லை, மீண்டும் சொல்லுங்கள் அல்லது பட்டனை அழுத்தவும்.';
    }
    if (language === 'hi') {
      return 'समझ नहीं आया, कृपया फिर से बोलें या बटन दबाएं।';
    }
    return "Didn't catch that. Please say it again or tap a button.";
  }

  /**
   * Localized "Voice stopped after 2 tries — please tap a button" message
   */
  public static getFallbackToButtonsMessage(language: Language): string {
    if (language === 'ta') {
      return 'தெளிவாகக் கேட்கவில்லை. தயவுசெய்து பட்டனைத் தொடவும்.';
    }
    if (language === 'hi') {
      return 'साफ़ सुनाई नहीं दिया। कृपया बटन दबाएं।';
    }
    return 'Could not hear clearly. Please tap a button to continue.';
  }
}

