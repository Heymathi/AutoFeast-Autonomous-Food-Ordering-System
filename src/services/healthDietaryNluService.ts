import { GoogleGenAI } from '@google/genai';
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

  private static getGeminiClient(): GoogleGenAI | null {
    try {
      const apiKey =
        (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
        (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
        '';

      if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
        return new GoogleGenAI({ apiKey });
      }
    } catch (e) {
      console.warn('[HealthDietaryNluService] Gemini API key missing, utilizing offline health fallback.');
    }
    return null;
  }

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

    const client = this.getGeminiClient();

    if (client) {
      try {
        const catalogSummary = INDIAN_FOOD_CATALOG.map(f => `ID: ${f.id} | Name: ${f.name} | Tamil: ${f.nativeNames.ta} | Description: ${f.description}`).join('\n');

        const systemPrompt = `You are a gentle health dietary food recommender for AutoFeast.
The user speaks a free-form sentence describing a health situation, symptom, age, or dietary requirement for themselves or a relative (appa/amma/thatha/paati).

AVAILABLE FOOD CATALOG (STRICT CONSTRAINT — YOU MUST ONLY SELECT ITEM IDs FROM THIS LIST):
${catalogSummary}

CRITICAL RULES:
1. You MUST select 2 to 3 food item IDs ONLY from the above catalog list (e.g. "idli-sambar", "pongal-ghee", "kerala-appam-stew", "dosa-plain"). Never invent IDs or food names outside this catalog.
2. Recommendations MUST be mild, general dietary food texture/spice suggestions (e.g., steamed, soft, non-spicy, low-fat, comforting).
3. NEVER make a clinical diagnosis, medical claim, or treatment statement.
4. For each selected food item ID, provide a short 1-line reason in English, Tamil, and Hindi explaining why it fits this health/dietary context.
5. Identify who the food is for ("self", "appa", "amma", "thatha", "paati", etc).

Respond ONLY with valid raw JSON:
{
  "healthContextSummary": "<brief summary of condition>",
  "targetPerson": "self | appa | amma | thatha | paati | relative",
  "suggestedItemIds": [
    {
      "itemId": "<exact catalog ID>",
      "reasonEn": "<1 line reason in English>",
      "reasonTa": "<1 line reason in Tamil>",
      "reasonHi": "<1 line reason in Hindi>"
    }
  ]
}

User Spoken Description: "${cleanInput}"`;

        const response = await client.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: systemPrompt,
          config: {
            responseMimeType: 'application/json',
            maxOutputTokens: 350
          }
        });

        const textResponse = response.text || '';
        console.log('[HealthDietaryNluService Gemini Output]:', textResponse);
        const parsed = JSON.parse(textResponse.trim());

        if (parsed && parsed.suggestedItemIds && Array.isArray(parsed.suggestedItemIds)) {
          const suggestions: HealthFoodSuggestion[] = [];

          for (const itemReq of parsed.suggestedItemIds) {
            const foundItem = INDIAN_FOOD_CATALOG.find(f => f.id === itemReq.itemId);
            if (foundItem) {
              suggestions.push({
                foodItem: foundItem,
                reasonEn: itemReq.reasonEn || `${foundItem.name} is mild and easy to consume.`,
                reasonTa: itemReq.reasonTa || `${foundItem.nativeNames.ta} செரிமானத்திற்கு எளிதான லேசான உணவு.`,
                reasonHi: itemReq.reasonHi || `${foundItem.nativeNames.hi} हल्का और सुपाच्य आहार है।`
              });
            }
          }

          if (suggestions.length > 0) {
            return {
              rawTranscript: cleanInput,
              healthContextSummary: parsed.healthContextSummary || 'General health & dietary advice',
              targetPerson: parsed.targetPerson || 'self',
              suggestions,
              disclaimerEn: this.DISCLAIMER_EN,
              disclaimerTa: this.DISCLAIMER_TA,
              disclaimerHi: this.DISCLAIMER_HI
            };
          }
        }
      } catch (err) {
        console.warn('[HealthDietaryNluService Gemini API Error, using offline health fallback]:', err);
      }
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
