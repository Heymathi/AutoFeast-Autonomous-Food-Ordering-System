import { FoodItem, Language } from '../types';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { FuzzyMatchEngine } from './fuzzyMatchService';
import { CrossScriptPhoneticMatcher } from './crossScriptPhoneticMatcher';

export interface CartVoiceAction {
  type: 'add' | 'multi_add' | 'show' | 'remove' | 'update_qty' | 'clear' | 'checkout' | 'schedule_cart' | 'none';
  items?: { foodItem: FoodItem; quantity: number; restaurantName?: string }[];
  targetItemId?: string;
  targetItemName?: string;
  targetRestaurantName?: string;
  targetQuantity?: number;
  requiresConfirmation?: boolean;
  confirmationPrompt?: string;
  didYouMeanItem?: FoodItem;
}

export class CartVoiceService {
  /**
   * Multilingual Number Extraction (English, Tamil script, Tanglish, Hindi script, Hinglish)
   */
  public static parseQuantity(text: string): number {
    if (!text) return 1;
    const lower = text.toLowerCase().trim();

    // Digits match
    const digitMatch = lower.match(/\b\d+\b/);
    if (digitMatch) {
      const val = parseInt(digitMatch[0], 10);
      if (val > 0 && val <= 50) return val;
    }

    // Word mappings
    const wordMap: Record<string, number> = {
      // English
      'one': 1, 'single': 1, 'a': 1,
      'two': 2, 'double': 2, 'couple': 2,
      'three': 3, 'triple': 3,
      'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
      // Tamil & Tanglish
      'oru': 1, 'onnu': 1, 'ஒன்று': 1, 'ஒரு': 1, 'ஒன்னு': 1,
      'rendu': 2, 'இரண்டு': 2, 'ரெண்டு': 2,
      'moonu': 3, 'மூன்று': 3, 'மூணு': 3,
      'naalu': 4, 'நான்கு': 4, 'நாளு': 4,
      'anju': 5, 'ஐந்து': 5, 'அஞ்சு': 5,
      'aaru': 6, 'ஆறு': 6,
      // Hindi & Hinglish
      'ek': 1, 'एक': 1,
      'do': 2, 'दो': 2,
      'teen': 3, 'तीन': 3,
      'chaar': 4, 'चार': 4,
      'paanch': 5, 'पांच': 5,
      'chah': 6, 'छह': 6
    };

    for (const [word, val] of Object.entries(wordMap)) {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      if (regex.test(lower)) {
        return val;
      }
    }

    return 1;
  }

  /**
   * Restaurant Name Matcher (Fuzzy & Keyword aware)
   */
  public static extractRestaurantName(text: string): string | undefined {
    if (!text) return undefined;
    const lower = text.toLowerCase();

    if (lower.includes('murugan') || lower.includes('முருகன்')) return 'Murugan Idli Shop';
    if (lower.includes('saravana') || lower.includes('சரவண')) return 'Saravana Bhavan';
    if (lower.includes('bawarchi') || lower.includes('பவாச்சி')) return 'Bawarchi Biryani';
    if (lower.includes('a2b') || lower.includes('adyar') || lower.includes('அடையார்')) return 'A2B Adyar Ananda Bhavan';
    if (lower.includes('dominos') || lower.includes('டோமினோஸ்')) return 'Dominos Pizza';
    if (lower.includes('sangeetha') || lower.includes('சங்கீதா')) return 'Sangeetha Veg Restaurant';
    if (lower.includes('madurai') || lower.includes('மதுரை')) return 'Madurai Mess';

    return undefined;
  }

  /**
   * Main Cart Voice Command Parser
   * Handles multi-lingual (EN, TA, HI, Tanglish, Hinglish) cart commands
   */
  public static parseCartCommand(transcript: string, currentLanguage: Language = 'en'): CartVoiceAction {
    if (!transcript || !transcript.trim()) {
      return { type: 'none' };
    }

    const raw = transcript.toLowerCase().trim();

    // 1. SHOW / READ CART INTENT
    if (
      raw.includes('show cart') ||
      raw.includes('view cart') ||
      raw.includes('open cart') ||
      raw.includes('my cart') ||
      raw.includes('read cart') ||
      raw.includes('cart la enna') ||
      raw.includes('cart-il enna') ||
      raw.includes('கார்ட்டைக் காட்டு') ||
      raw.includes('கார்ட்டில் என்ன') ||
      raw.includes('கார்ட் காட்டு') ||
      raw.includes('கார்ட் திற') ||
      raw.includes('கார்ட்டை திற') ||
      raw.includes('கார்ட்டில் என்ன இருக்கிறது') ||
      raw.includes('कार्ट दिखाओ') ||
      raw.includes('कार्ट में क्या है') ||
      raw.includes('मेरा कार्ट') ||
      raw.includes('कार्ट खोलो')
    ) {
      return { type: 'show' };
    }

    // 2. CLEAR CART INTENT
    if (
      raw.includes('clear cart') ||
      raw.includes('clear the cart') ||
      raw.includes('empty cart') ||
      raw.includes('clear whole cart') ||
      raw.includes('cart la irukkura') ||
      raw.includes('கார்ட்டை காலி செய்') ||
      raw.includes('முழு கார்ட்டையும் காலி செய்') ||
      raw.includes('கார்ட்டை அழி') ||
      raw.includes('கார்ட் அழி') ||
      raw.includes('कार्ट खाली करो') ||
      raw.includes('पूरा कार्ट खाली करो') ||
      raw.includes('कार्ट साफ करो')
    ) {
      const askMsg = currentLanguage === 'ta'
        ? 'முழு கார்ட்டையும் அழிக்கவா? ஆம் அல்லது இல்லை என்று சொல்லுங்கள்.'
        : currentLanguage === 'hi'
        ? 'पूरा कार्ट खाली करें? हाँ या नहीं बोलें।'
        : 'Clear the whole cart? Say yes or no.';
      return {
        type: 'clear',
        requiresConfirmation: true,
        confirmationPrompt: askMsg
      };
    }

    // 3. CHECKOUT / ORDER NOW CART INTENT
    if (
      raw === 'checkout' ||
      raw.includes('checkout cart') ||
      raw.includes('order cart now') ||
      raw.includes('order now cart') ||
      raw.includes('cart order now') ||
      raw.includes('cart order') ||
      raw.includes('கார்ட் ஆர்டர் செய்') ||
      raw.includes('கார்ட்டை ஆர்டர் செய்') ||
      raw.includes('கார்ட்டில் உள்ளதை ஆர்டர் செய்') ||
      raw.includes('कार्ट अभी ऑर्डर करें') ||
      raw.includes('कार्ट ऑर्डर करो')
    ) {
      return { type: 'checkout' };
    }

    // 4. SCHEDULE CART INTENT
    if (
      raw.includes('schedule cart') ||
      raw.includes('cart schedule') ||
      raw.includes('கார்ட் திட்டமிடு') ||
      raw.includes('கார்ட்டை திட்டமிடு') ||
      raw.includes('கார்ட் அட்டவணை') ||
      raw.includes('கார்ட்டை அட்டவணைப்படுத்து') ||
      raw.includes('कार्ट शेड्यूल करो') ||
      raw.includes('कार्ट शेड्यूल करें')
    ) {
      return { type: 'schedule_cart' };
    }

    // 5. REMOVE ITEM INTENT
    if (
      raw.startsWith('remove') ||
      raw.startsWith('delete') ||
      raw.includes('eduthuru') ||
      raw.includes('eduthudu') ||
      raw.includes('நீக்கு') ||
      raw.includes('அழி') ||
      raw.includes('हटाओ') ||
      raw.includes('निकालो')
    ) {
      const cleanSegment = raw
        .replace(/remove|delete|from cart|cart la|cart-il|eduthuru|eduthudu|கார்ட்டில் இருந்து|கார்ட்டிலிருந்து|நீக்கு|அழி|कार्ट से|हटाओ|निकालो/g, '')
        .trim();

      const matchedFood = FuzzyMatchEngine.matchCatalogFoodItem(cleanSegment, INDIAN_FOOD_CATALOG);
      if (matchedFood.item && matchedFood.score >= 0.40) {
        return {
          type: 'remove',
          targetItemId: matchedFood.item.id,
          targetItemName: matchedFood.item.nativeNames?.[currentLanguage] || matchedFood.item.name,
          targetRestaurantName: matchedFood.item.restaurant
        };
      }
    }

    // 6. UPDATE QUANTITY INTENT ("make idli 3", "change idli 2", "idli 3 ah maathu")
    if (raw.includes('make') || raw.includes('change') || raw.includes('maathu') || raw.includes('மாற்று') || raw.includes('करो')) {
      const qty = this.parseQuantity(raw);
      const cleanSegment = raw
        .replace(/make|change|quantity|to|qty|ah|maathu|மாற்று|करो|आइटम/g, '')
        .replace(/\d+/g, '')
        .trim();

      const matchedFood = FuzzyMatchEngine.matchCatalogFoodItem(cleanSegment, INDIAN_FOOD_CATALOG);
      if (matchedFood.item && matchedFood.score >= 0.40) {
        return {
          type: 'update_qty',
          targetItemId: matchedFood.item.id,
          targetItemName: matchedFood.item.nativeNames?.[currentLanguage] || matchedFood.item.name,
          targetRestaurantName: matchedFood.item.restaurant,
          targetQuantity: qty
        };
      }
    }

    // 7. MULTI-ITEM / MULTI-RESTAURANT ADD TO CART ("add idli from Murugan and dosa from Bawarchi")
    const isMultiSentence = raw.includes(' and ') || raw.includes(' மற்றும் ') || raw.includes(' aur ') || raw.includes(' அப்புறம் ') || raw.includes(', ');
    const isAddIntent = raw.includes('add') || raw.includes('podu') || raw.includes('சேர்') || raw.includes('போடு') || raw.includes('जोड़ो') || raw.includes('डालो') || raw.includes('cart');

    if (isMultiSentence && isAddIntent) {
      // Split into sub-clauses
      const segments = raw.split(/\s*(?:and|மற்றும்|aur|அப்புறம்|,)\s*/);
      const itemsToAdd: { foodItem: FoodItem; quantity: number; restaurantName?: string }[] = [];

      for (const seg of segments) {
        if (!seg.trim()) continue;
        const qty = this.parseQuantity(seg);
        const resName = this.extractRestaurantName(seg);
        const matchedFood = FuzzyMatchEngine.matchCatalogFoodItem(seg, INDIAN_FOOD_CATALOG);

        if (matchedFood.item && matchedFood.score >= 0.35) {
          const finalRes = resName || matchedFood.item.restaurant;
          itemsToAdd.push({
            foodItem: { ...matchedFood.item, restaurant: finalRes },
            quantity: qty,
            restaurantName: finalRes
          });
        }
      }

      if (itemsToAdd.length >= 2) {
        const itemSummaries = itemsToAdd.map(i => `${i.quantity} ${i.foodItem.nativeNames?.[currentLanguage] || i.foodItem.name} from ${i.restaurantName || i.foodItem.restaurant}`).join(', ');
        const confirmMsg = currentLanguage === 'ta'
          ? `நான் கேட்டது: ${itemSummaries}. இவற்றைச் சேர்க்கவா?`
          : currentLanguage === 'hi'
          ? `मैंने सुना: ${itemSummaries}। क्या इन्हें जोड़ूं?`
          : `I heard: ${itemSummaries}. Add these?`;

        return {
          type: 'multi_add',
          items: itemsToAdd,
          requiresConfirmation: true,
          confirmationPrompt: confirmMsg
        };
      }
    }

    // 8. SINGLE ITEM ADD TO CART ("add idli to cart", "cart la 2 dosa podu", "கார்ட்டில் இட்லி சேர்", "2 dosa")
    if (isAddIntent || raw.includes('cart')) {
      const qty = this.parseQuantity(raw);
      const resName = this.extractRestaurantName(raw);

      // Clean command keywords to isolate food term
      const foodQuery = raw
        .replace(/add|to cart|in cart|cart la|cart-il|podu|சேர்|போடு|கார்ட்டில்|கார்ட்ல|கார்ட்டில் சேர்|கார்ட்|cart mein|cart me|jodo|daalo|कार्ट में|जोड़ो|डालो|please|want|venum/g, '')
        .replace(/\b\d+\b/g, '')
        .replace(/rendu|moonu|naalu|anju|onnu|oru|ek|do|teen|chaar|paanch|one|two|three|four|five/gi, '')
        .trim();

      const matchedFood = FuzzyMatchEngine.matchCatalogFoodItem(foodQuery || raw, INDIAN_FOOD_CATALOG);

      if (matchedFood.item) {
        const targetRes = resName || matchedFood.item.restaurant;
        const targetItem = { ...matchedFood.item, restaurant: targetRes };

        if (matchedFood.confidence === 'high' || matchedFood.score >= 0.60) {
          return {
            type: 'add',
            items: [{ foodItem: targetItem, quantity: qty, restaurantName: targetRes }]
          };
        } else if (matchedFood.confidence === 'medium' || matchedFood.score >= 0.40) {
          const didName = matchedFood.item.nativeNames?.[currentLanguage] || matchedFood.item.name;
          const confirmMsg = currentLanguage === 'ta'
            ? `நீங்கள் "${didName}" உணவைத்தான் கார்ட்டில் சேர்க்க விரும்புகிறீர்களா? "ஆம்" அல்லது "இல்லை" என்று சொல்லுங்கள்.`
            : currentLanguage === 'hi'
            ? `क्या आप "${didName}" को कार्ट में जोड़ना चाहते हैं? "हाँ" या "नहीं" बोलें।`
            : `Did you mean ${didName}? Say yes or no.`;

          return {
            type: 'add',
            items: [{ foodItem: targetItem, quantity: qty, restaurantName: targetRes }],
            requiresConfirmation: true,
            confirmationPrompt: confirmMsg,
            didYouMeanItem: matchedFood.item
          };
        }
      }
    }

    return { type: 'none' };
  }
}
