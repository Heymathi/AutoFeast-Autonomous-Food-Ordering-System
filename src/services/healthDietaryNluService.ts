import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { FoodItem, Language } from '../types';

export interface HealthFoodSuggestion {
  foodItem: FoodItem;
  reasonEn: string;
  reasonTa: string;
  reasonHi: string;
}

export interface HealthDietaryAnalysisResult {
  rawTranscript: string;
  healthContextSummary: string;
  targetPerson: string; // 'self' | 'appa' | 'amma' | 'thatha' | 'paati' | 'relative'
  suggestions: HealthFoodSuggestion[];
  disclaimerEn: string;
  disclaimerTa: string;
  disclaimerHi: string;
}

export class HealthDietaryNluService {
  private static DISCLAIMER_EN = 'This is a general dietary suggestion, not medical advice — please consult a doctor for your condition.';
  private static DISCLAIMER_TA = 'இது ஒரு பொதுவான உணவுப் பரிந்துரை மட்டுமே, மருத்துவ ஆலோசனை அல்ல. உங்கள் உடல்நலக் கோளாறுக்கு மருத்துவரை அணுகவும்.';
  private static DISCLAIMER_HI = 'यह एक सामान्य आहार सुझाव है, चिकित्सीय सलाह नहीं — कृपया अपनी स्थिति के लिए डॉक्टर से परामर्श लें।';

  /**
   * Main Health / Dietary LLM NLU Engine with Offline Fallback
   */
  public static async analyzeHealthContextAndSuggestFood(
    transcript: string,
    language: Language = 'en'
  ): Promise<HealthDietaryAnalysisResult> {
    if (!transcript || !transcript.trim()) {
      return this.getFallbackHealthSuggestions(transcript, language);
    }

    const cleanInput = transcript.trim();
    console.log(`[HealthDietaryNluService]: Analyzing health transcript in "${language}": "${cleanInput}"`);

    try {
      const response = await fetch('/api/voice/health-nlu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: cleanInput, language })
      });
      if (!response.ok) throw new Error(`Health NLU endpoint returned ${response.status}`);
      const parsed = await response.json() as {
        healthContextSummary?: unknown;
        targetPerson?: unknown;
        suggestedItemIds?: Array<{ itemId?: unknown; reasonEn?: unknown; reasonTa?: unknown; reasonHi?: unknown }>;
      };
      const allowedTargetPeople = ['self', 'appa', 'amma', 'thatha', 'paati', 'relative'];
      const suggestions: HealthFoodSuggestion[] = [];
      if (Array.isArray(parsed.suggestedItemIds)) {
        for (const itemReq of parsed.suggestedItemIds.slice(0, 3)) {
          if (typeof itemReq.itemId !== 'string' || typeof itemReq.reasonEn !== 'string' ||
              typeof itemReq.reasonTa !== 'string' || typeof itemReq.reasonHi !== 'string') continue;
          const foundItem = INDIAN_FOOD_CATALOG.find(food => food.id === itemReq.itemId);
          if (foundItem) {
            suggestions.push({
              foodItem: foundItem,
              reasonEn: itemReq.reasonEn,
              reasonTa: itemReq.reasonTa,
              reasonHi: itemReq.reasonHi
            });
          }
        }
      }
      if (suggestions.length >= 2 && typeof parsed.healthContextSummary === 'string' &&
          typeof parsed.targetPerson === 'string' && allowedTargetPeople.includes(parsed.targetPerson)) {
        return {
          rawTranscript: cleanInput,
          healthContextSummary: parsed.healthContextSummary,
          targetPerson: parsed.targetPerson,
          suggestions,
          disclaimerEn: this.DISCLAIMER_EN,
          disclaimerTa: this.DISCLAIMER_TA,
          disclaimerHi: this.DISCLAIMER_HI
        };
      }
      throw new Error('Health NLU endpoint returned invalid or unverified suggestions');
    } catch (error) {
      console.warn('[HealthDietaryNluService] Gemini unavailable or invalid; using local health fallback.', error);
    }

    // Fallback: Synchronous offline rule-based dietary recommender
    return this.getFallbackHealthSuggestions(cleanInput, language);
  }

  /**
   * Rule-based Multilingual Offline Health Suggestion Fallback
   */
  private static getFallbackHealthSuggestions(
    transcript: string,
    language: Language
  ): HealthDietaryAnalysisResult {
    const text = (transcript || '').toLowerCase();

    // Default safe items: Idli & Ven Pongal & Kerala Appam Stew
    let itemIds = ['idli-sambar', 'pongal-ghee'];

    let healthSummary = 'General light dietary recommendation';
    let targetPerson = 'self';

    if (text.includes('appa') || text.includes('அப்பா') || text.includes('पिता')) targetPerson = 'appa';
    if (text.includes('amma') || text.includes('அம்மா') || text.includes('माँ')) targetPerson = 'amma';
    if (text.includes('thatha') || text.includes('தாத்தா') || text.includes('दादा')) targetPerson = 'thatha';
    if (text.includes('paati') || text.includes('பாட்டி') || text.includes('दादी')) targetPerson = 'paati';

    if (text.includes('fever') || text.includes('காய்ச்சல்') || text.includes('புண்') || text.includes('बुखार')) {
      healthSummary = 'Fever & temperature support (soft & steamed food)';
      itemIds = ['idli-sambar', 'pongal-ghee', 'kerala-appam-stew'];
    } else if (text.includes('heart') || text.includes('இதயம்') || text.includes('நெஞ்சு') || text.includes('दिल')) {
      healthSummary = 'Heart care (low-fat, non-spicy, steamed vegetarian options)';
      itemIds = ['idli-sambar', 'kerala-appam-stew', 'dosa-plain'];
    } else if (text.includes('stomach') || text.includes('pain') || text.includes('tablet') || text.includes('வயிறு') || text.includes('மாத்திரை') || text.includes('पेट')) {
      healthSummary = 'Digestive comfort & medicine intake support';
      itemIds = ['idli-sambar', 'pongal-ghee'];
    }

    const suggestions: HealthFoodSuggestion[] = [];

    for (const id of itemIds) {
      const found = INDIAN_FOOD_CATALOG.find(f => f.id === id);
      if (found) {
        let reasonEn = 'Soft, steamed, and light on the stomach.';
        let reasonTa = 'மென்மையான அவித்த உணவு, செரிமானத்திற்கு மிகவும் நல்லது.';
        let reasonHi = 'भाप में बना हल्का और सुपाच्य आहार।';

        if (id === 'idli-sambar') {
          reasonEn = 'Soft steamed rice cakes that are gentle on the digestive system.';
          reasonTa = 'மென்மையான அவித்த இட்லி, வயிற்றில் எவ்வித அசௌகரியமும் ஏற்படுத்தாது.';
          reasonHi = 'मुलायम भाप में बनी इडली जो पेट के लिए बहुत सुपाच्य है।';
        } else if (id === 'pongal-ghee') {
          reasonEn = 'Comforting warm moong dal porridge providing gentle energy.';
          reasonTa = 'பாசிப்பருப்பு மற்றும் அரிசி கலந்த மிதமான சூடான சத்தான பொங்கல்.';
          reasonHi = 'मूंग दाल और चावल का हल्का और ऊर्जादायक पोंगल।';
        } else if (id === 'kerala-appam-stew') {
          reasonEn = 'Mild coconut milk stew with soft appam, completely non-spicy.';
          reasonTa = 'காரமில்லாத தேங்காய்ப்பால் காய்கறி ஸ்டூ மற்றும் மென்மையான ஆப்பம்.';
          reasonHi = 'बिना मिर्च वाला नारियल दूध का स्टू और मुलायम आपम।';
        }

        suggestions.push({
          foodItem: found,
          reasonEn,
          reasonTa,
          reasonHi
        });
      }
    }

    return {
      rawTranscript: transcript,
      healthContextSummary: healthSummary,
      targetPerson,
      suggestions,
      disclaimerEn: this.DISCLAIMER_EN,
      disclaimerTa: this.DISCLAIMER_TA,
      disclaimerHi: this.DISCLAIMER_HI
    };
  }
}
