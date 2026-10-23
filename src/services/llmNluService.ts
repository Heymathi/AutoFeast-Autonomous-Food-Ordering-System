import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { FoodItem, Language, ScheduleDuration } from '../types';
import { NLPParserService, ParsedOrderBill, ParsedItem } from './nlpParserService';
import { PriceComparisonService } from './priceComparisonService';
import { FuzzyMatchEngine } from './fuzzyMatchService';

const voiceNluDebug = (message: string, details?: unknown) => {
  if ((import.meta as any).env?.DEV) console.info(message, details ?? '');
};

export interface ExtractedLlmOrder {
  items: { name: string; quantity: number }[];
  restaurant: string | null;
  intent: 'order' | 'schedule' | 'search';
  time: string | null;
  location: string | null;
  unmatchedItems?: string[];
  clarificationPrompt?: string;
}

export interface LlmFoodExtractionResult {
  item: string | null;
  items?: string[];
  confidence: number;
  original_phrase: string;
}

export interface VoiceNluResult {
  intent: 'order_now' | 'schedule' | 'yes' | 'no' | 'search' | 'repeat' | 'stop' | 'cancel' | 'back' | 'unknown';
  item: string | null;
  quantity: number | null;
  time: string | null;
  language: Language;
  confidence: number;
}

export class LlmNluService {
  private static extractionCache: Map<string, LlmFoodExtractionResult> = new Map();
  private static pendingExtractionRequests: Set<string> = new Set();
  private static voiceNluCache: Map<string, VoiceNluResult> = new Map();
  private static locationNluCache: Map<string, LocationChoiceNluResult> = new Map();

  public static clearCache(): void {
    voiceNluDebug('[ORDER_FLOW_DEBUG - Cache Reset]: LlmNluService extraction cache cleared.');
    this.extractionCache.clear();
    this.pendingExtractionRequests.clear();
    this.voiceNluCache.clear();
    this.locationNluCache.clear();
  }

  public static async interpretVoiceTurn(
    transcript: string,
    options: {
      alternatives?: string[];
      step: string;
      expectedOptions?: string[];
      cart?: Array<{ name: string; quantity: number }>;
      language?: Language;
    }
  ): Promise<VoiceNluResult | null> {
    const cleanTranscript = transcript.trim();
    if (!cleanTranscript) return null;
    const payload = {
      transcript: cleanTranscript,
      alternatives: (options.alternatives || []).slice(0, 5),
      step: options.step,
      expectedOptions: (options.expectedOptions || []).slice(0, 40),
      cart: (options.cart || []).slice(0, 20),
      language: options.language || 'en'
    };
    const cacheKey = JSON.stringify(payload).toLowerCase();
    const cached = this.voiceNluCache.get(cacheKey);
    if (cached) {
      voiceNluDebug('[Voice NLU]', { step: options.step, chosenIntent: cached.intent, confidence: cached.confidence, source: 'cache' });
      return cached;
    }

    try {
      const response = await fetch('/api/voice/nlu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`Voice NLU endpoint returned ${response.status}`);
      const parsed = await response.json() as VoiceNluResult;
      const valid = parsed && typeof parsed === 'object' &&
        ['order_now', 'schedule', 'yes', 'no', 'search', 'repeat', 'stop', 'cancel', 'back', 'unknown'].includes(parsed.intent) &&
        (parsed.item === null || (typeof parsed.item === 'string' && parsed.item.length <= 120)) &&
        (parsed.quantity === null || (Number.isInteger(parsed.quantity) && parsed.quantity >= 1 && parsed.quantity <= 99)) &&
        (parsed.time === null || (typeof parsed.time === 'string' && parsed.time.length <= 40)) &&
        ['en', 'ta', 'hi'].includes(parsed.language) &&
        Number.isFinite(parsed.confidence) && parsed.confidence >= 0 && parsed.confidence <= 1;
      if (!valid) throw new Error('Voice NLU endpoint returned an invalid response shape');
      this.voiceNluCache.set(cacheKey, parsed);
      if (this.voiceNluCache.size > 100) {
        this.voiceNluCache.delete(this.voiceNluCache.keys().next().value!);
      }
      voiceNluDebug('[Voice NLU]', { step: options.step, chosenIntent: parsed.intent, confidence: parsed.confidence, source: 'Gemini' });
      return parsed;
    } catch (error) {
      console.warn('[Voice NLU] Gemini unavailable; using local intent and catalog matching.', error);
      return null;
    }
  }

  /**
   * 🚀 STEP 1: LLM-based Entity Extraction & Normalization
   * Extracts core food item name(s) from Tamil script, Tanglish, or English natural sentences.
   * Caches results for repeated inputs to eliminate latency & API costs.
   */
  public static async extractFoodItemWithLlm(transcript: string, language: Language = 'en'): Promise<LlmFoodExtractionResult> {
    if (!transcript || !transcript.trim()) {
      return { item: null, confidence: 0, original_phrase: '', items: [] };
    }

    const cleanInput = transcript.trim();
    const cacheKey = cleanInput.toLowerCase();

    // Check in-memory cache first
    if (this.extractionCache.has(cacheKey)) {
      const cached = this.extractionCache.get(cacheKey)!;
      voiceNluDebug(`[ORDER_FLOW_DEBUG - Step 2: NLU Extraction (Cache Hit)]: Raw Transcript: "${cleanInput}" → Extracted Item: "${cached.item}"`, cached);
      return cached;
    }

    const nluResult = await this.interpretVoiceTurn(cleanInput, {
      step: 'item_search',
      expectedOptions: INDIAN_FOOD_CATALOG.slice(0, 40).map(food => food.name),
      language
    });
    if (nluResult?.item && nluResult.confidence >= 0.7) {
      const catalogMatch = FuzzyMatchEngine.matchCatalogFoodItem(nluResult.item, INDIAN_FOOD_CATALOG);
      if (catalogMatch.item && catalogMatch.confidence === 'high') {
        const safeItem = catalogMatch.item.name;
        const result = { item: safeItem, items: [safeItem], confidence: nluResult.confidence, original_phrase: cleanInput };
        this.extractionCache.set(cacheKey, result);
        voiceNluDebug('[NLP Log]', { step: 'item_search', transcript: cleanInput, chosenIntent: nluResult.intent, item: safeItem, confidence: nluResult.confidence, source: 'Gemini+catalog verification' });
        return result;
      }
      voiceNluDebug('[Voice NLU] Gemini item did not meet catalog confidence; falling back to local matching.');
    }

    // Fallback: Synchronous offline rule-based extractor
    const offlineResult = this.extractFoodItemOfflineFallback(cleanInput);
    this.extractionCache.set(cacheKey, offlineResult);
    voiceNluDebug('[NLP Log (Offline Fallback)]:', { original_phrase: cleanInput, llm_output: offlineResult });
    return offlineResult;
  }

  /**
   * Fast synchronous accessor for LLM extraction (utilizing cache and rule fallback)
   */
  public static extractFoodItemWithLlmSync(transcript: string, language: Language = 'en'): LlmFoodExtractionResult {
    if (!transcript || !transcript.trim()) {
      return { item: null, confidence: 0, original_phrase: '', items: [] };
    }

    const cleanInput = transcript.trim();
    const cacheKey = cleanInput.toLowerCase();

    if (this.extractionCache.has(cacheKey)) {
      return this.extractionCache.get(cacheKey)!;
    }

    const result = this.extractFoodItemOfflineFallback(cleanInput);
    if (!this.pendingExtractionRequests.has(cacheKey)) {
      this.pendingExtractionRequests.add(cacheKey);
      void this.extractFoodItemWithLlm(cleanInput, language)
        .catch(error => {
          console.error('[Voice NLU] Background extraction failed unexpectedly.', error);
        })
        .finally(() => this.pendingExtractionRequests.delete(cacheKey));
    }

    return result;
  }

  /**
   * Smart rule-based offline entity extractor (Tamil / Tanglish / English)
   */
  private static extractFoodItemOfflineFallback(transcript: string): LlmFoodExtractionResult {
    const text = transcript.trim();
    const lower = text.toLowerCase();

    // Check multi-item mentions (e.g. "2 idli and 1 vada")
    const extractedItems: string[] = [];

    if (lower.includes('idli') || lower.includes('இட்லி') || lower.includes('idly')) extractedItems.push('Idli');
    if (lower.includes('vada') || lower.includes('வடை') || lower.includes('vadai')) extractedItems.push('Vada');
    if (lower.includes('dosa') || lower.includes('தோசா') || lower.includes('தோசை') || lower.includes('dosai')) extractedItems.push('Dosa');
    if (lower.includes('fried rice') || lower.includes('பிரைட் ரைஸ்') || lower.includes('ஃப்ரெடு ரைஸ்')) extractedItems.push('Fried Rice');
    if (lower.includes('pizza') || lower.includes('பீட்சா') || lower.includes('பிஸா')) extractedItems.push('Pizza');
    if (lower.includes('biryani') || lower.includes('biriyani') || lower.includes('briyani') || lower.includes('biyani') || lower.includes('பிரியாணி') || lower.includes('பிரியானி') || lower.includes('பிரீயாணி')) extractedItems.push('Biryani');
    if (lower.includes('parotta') || lower.includes('பரோட்டா') || lower.includes('பரோடா')) extractedItems.push('Parotta');
    if (lower.includes('paneer') || lower.includes('பன்னீர்')) extractedItems.push('Paneer');
    if (lower.includes('coffee') || lower.includes('காபி')) extractedItems.push('Coffee');
    if (lower.includes('pani puri') || lower.includes('பானி பூரி')) extractedItems.push('Pani Puri');

    if (extractedItems.length > 0) {
      return {
        item: extractedItems[0],
        items: extractedItems,
        confidence: 0.90,
        original_phrase: text
      };
    }

    // Strip filler words
    let clean = text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, '');
    const fillerPatterns = [
      /\bஎனக்கு\b/gi, /\bவேண்டும்\b/gi, /\bவேணும்\b/gi, /\bஆர்டர்\b/gi, /\bபண்ணு\b/gi, /\bகொடுங்க\b/gi, /\bதாங்க\b/gi,
      /\bஇருந்தா\b/gi, /\bகுடு\b/gi, /\bஒரு\b/gi, /\bஇப்போதே\b/gi, /\bஉடனே\b/gi, /\bதயவுசெய்து\b/gi, /\bவேண்டும்\b/gi,
      /\bஎனக்கு\b/gi, /\bna\b/gi, /\bpannanum\b/gi, /\bvenum\b/gi, /\bkavanum\b/gi,
      /\bमुझे\b/gi, /\bचाहिए\b/gi, /\bऑर्डर\b/gi, /\bकरो\b/gi, /\bलाओ\b/gi, /\bदो\b/gi, /\bएक\b/gi, /\bअभी\b/gi, /\bतुरंत\b/gi,
      /\bi want\b/gi, /\bplease\b/gi, /\border\b/gi, /\bcan i get\b/gi, /\bbring me\b/gi, /\bgive me\b/gi, /\ba\b/gi, /\ban\b/gi, /\bthe\b/gi, /\bfor me\b/gi, /\bnow\b/gi
    ];

    fillerPatterns.forEach(p => { clean = clean.replace(p, ' '); });
    clean = clean.replace(/\s+/g, ' ').trim();

    return {
      item: clean || text,
      items: clean ? [clean] : [text],
      confidence: 0.70,
      original_phrase: text
    };
  }

  /**
   * Free-form Natural Language Order Parsing using LLM (Gemini) with offline NLP fallback
   */
  public static async parseFreeFormOrder(
    transcript: string,
    userLocationAddress: string = 'Anna Nagar 2nd Avenue, Chennai',
    lang: Language = 'en',
    alternatives: string[] = [transcript],
    currentCart: Array<{ name: string; quantity: number }> = []
  ): Promise<{
    intent: 'order' | 'schedule' | 'search';
    bill: ParsedOrderBill | null;
    time?: string | null;
    clarificationPrompt?: string;
    scheduleDetails?: {
      frequency: 'daily' | 'weekly' | 'once';
      duration: ScheduleDuration;
      durationMentioned: boolean;
      startDate: string;
      endDate?: string;
      customEndDate?: string;
      durationLabel: string;
      isEveryDay?: boolean;
      selectedDays?: string[];
    };
  }> {
    if (!transcript || !transcript.trim()) {
      return { intent: 'search', bill: null };
    }

    voiceNluDebug(`[LlmNluService] Parsing free-form voice sentence in "${lang}": "${transcript}"`);

    const scheduleDetails = NLPParserService.parseScheduleDetailsFromVoice(transcript);

    let llmResult: ExtractedLlmOrder | null = null;

    const nlu = await this.interpretVoiceTurn(transcript, {
      alternatives,
      step: 'free_form_order',
      expectedOptions: INDIAN_FOOD_CATALOG.slice(0, 40).map(food => food.name),
      cart: currentCart,
      language: lang
    });
    if (nlu && nlu.confidence >= 0.75 && nlu.item) {
      const match = FuzzyMatchEngine.matchCatalogFoodItem(nlu.item, INDIAN_FOOD_CATALOG);
      if (match.item && match.confidence === 'high') {
        llmResult = {
          items: [{ name: match.item.name, quantity: nlu.quantity || 1 }],
          restaurant: null,
          intent: nlu.intent === 'schedule' ? 'schedule' : nlu.intent === 'order_now' ? 'order' : 'search',
          time: nlu.time,
          location: null
        };
      } else {
        voiceNluDebug('[Voice NLU] Free-form item failed catalog verification; using local NLP fallback.');
      }
    }

    // 🚀 RECURRENCE SIGNAL OVERRIDE LOGIC
    // If command contains recurrence duration, frequency, days, or time, force intent to 'schedule'!
    const lowerText = transcript.toLowerCase();
    const isRecurringOrScheduled = 
      scheduleDetails.durationMentioned || 
      (scheduleDetails.isEveryDay && (lowerText.includes('daily') || lowerText.includes('everyday') || lowerText.includes('தினமும்') || lowerText.includes('हर रोज'))) || 
      (scheduleDetails.selectedDays && scheduleDetails.selectedDays.length > 0) || 
      !!llmResult?.time || 
      /\b(\d{1,2}|ettu|onpadhu|ezhu|aaru|anju|naalu|moonu|rendu|onnu)\s*(maniku|mani|am|pm|மணி|மணிக்கு|बजे)\b/i.test(lowerText);

    const detectedIntent = isRecurringOrScheduled 
      ? 'schedule' 
      : ((llmResult && llmResult.intent) ? llmResult.intent : NLPParserService.detectIntent(transcript));

    // Process LLM result if available
    if (llmResult && llmResult.items && llmResult.items.length > 0) {
      const parsedItems: ParsedItem[] = [];
      const unmatchedNames: string[] = [];

      for (const itemReq of llmResult.items) {
        const qty = itemReq.quantity > 0 ? itemReq.quantity : 1;
        const rawSearchName = itemReq.name.toLowerCase().trim();
        const searchName = rawSearchName
          .replace(/\bidlys?\b/g, 'idli')
          .replace(/\bdosais?\b/g, 'dosa')
          .replace(/\b(briyani|biriyani|biyani)\b/g, 'biryani')
          .replace(/\b(parata|parota|barotta)\b/g, 'parotta');

        // Unified Fuzzy Matcher against catalog
        const fuzzyResult = FuzzyMatchEngine.matchCatalogFoodItem(searchName, INDIAN_FOOD_CATALOG);

        if (fuzzyResult.item && fuzzyResult.confidence === 'high') {
          const unitPrice = fuzzyResult.item.basePrice || 100;
          parsedItems.push({
            foodItem: fuzzyResult.item,
            quantity: qty,
            unitPrice,
            totalPrice: unitPrice * qty
          });
        } else if (fuzzyResult.item && fuzzyResult.confidence === 'medium') {
          // Medium confidence -> Ask user to confirm item before scheduling
          const suggestedName = fuzzyResult.item.nativeNames?.[lang] || fuzzyResult.item.name;
          const prompt = lang === 'ta'
            ? `நீங்கள் "${suggestedName}" ஆர்டர் செய்ய விரும்புகிறீர்களா? "ஆம்" என்று கூறுங்கள்.`
            : lang === 'hi'
            ? `क्या आपका मतलब "${suggestedName}" था? "हाँ" बोलें।`
            : `Did you mean "${suggestedName}"? Say Yes to confirm.`;

          return { intent: detectedIntent, bill: null, clarificationPrompt: prompt, scheduleDetails };
        } else {
          // Low confidence -> Never auto-schedule; prompt for clarification
          unmatchedNames.push(itemReq.name);
        }
      }

      if (unmatchedNames.length > 0 && parsedItems.length === 0) {
        const prompt = lang === 'ta'
          ? `மன்னிக்கவும், "${unmatchedNames.join(', ')}" எங்கள் உணவக பட்டியலில் இல்லை. தோசை, இட்லி அல்லது பரோட்டா வேண்டுமா?`
          : lang === 'hi'
          ? `क्षमा करें, "${unmatchedNames.join(', ')}" हमारे मेनू में नहीं मिला। क्या आप डोसा या पराठा चाहते हैं?`
          : `Sorry, I couldn't find "${unmatchedNames.join(', ')}" in our catalog. Did you mean Dosa, Idli, or Parotta?`;

        return { intent: detectedIntent, bill: null, clarificationPrompt: prompt, scheduleDetails };
      }

      if (parsedItems.length > 0) {
        const rawRest = llmResult.restaurant || transcript;
        const matchedRest = FuzzyMatchEngine.findRestaurantInText(rawRest);
        const restaurantName = matchedRest || parsedItems[0].foodItem.restaurant || 'Saravana Bhavan';
        const subtotal = parsedItems.reduce((sum, i) => sum + i.totalPrice, 0);
        
        const gstRate = 0.05;
        const cgst = parseFloat((subtotal * (gstRate / 2)).toFixed(2));
        const sgst = parseFloat((subtotal * (gstRate / 2)).toFixed(2));
        const totalGst = parseFloat((cgst + sgst).toFixed(2));
        const deliveryFee = 25.00;
        const platformFee = 5.00;
        const grandTotal = Math.round(subtotal + totalGst + deliveryFee + platformFee);

        const priceComparison = parsedItems[0]?.foodItem?.platforms?.length 
          ? PriceComparisonService.compare(parsedItems[0].foodItem.platforms) 
          : undefined;

        const bill: ParsedOrderBill = {
          restaurantName,
          items: parsedItems,
          subtotal,
          cgst,
          sgst,
          totalGst,
          deliveryFee,
          platformFee,
          grandTotal,
          deliveryAddress: userLocationAddress,
          etaMinutes: 25,
          rawTranscript: transcript,
          priceComparison
        };

        return { intent: detectedIntent, bill, time: llmResult.time, scheduleDetails };
      }
    }

    // Fallback to offline rule-based NLP parser if LLM yields empty or offline
    voiceNluDebug('[LlmNluService] Executing offline NLP Parser fallback...');
    const offlineBill = NLPParserService.parseNaturalLanguageOrder(transcript, userLocationAddress);
    
    if (!offlineBill) {
      const fallbackClarification = lang === 'ta'
        ? 'மன்னிக்கவும், உங்கள் குரல் கட்டளை தெளிவாகப் புரியவில்லை. தோசை அல்லது இட்லி என்று கூறி முயற்சிக்கவும்.'
        : lang === 'hi'
        ? 'क्षमा करें, आपकी आवाज़ का कमांड स्पष्ट नहीं समझा गया। डोसा या इडली बोलकर प्रयास करें।'
        : "Sorry, I couldn't understand your order clearly. Please try saying '1 Dosa and 2 Idlis from Saravana Bhavan'.";

      return { intent: detectedIntent, bill: null, clarificationPrompt: fallbackClarification, scheduleDetails };
    }

    return { intent: detectedIntent, bill: offlineBill, scheduleDetails };
  }

        /**
   * Local heuristic / keyword classifier for location choice intent.
   * Runs if Gemini is down or network fails.
   */
  public static classifyLocationChoiceLocally(
    transcript: string,
    language: Language = 'en',
    candidates: string[] = [transcript]
  ): LocationChoiceNluResult {
    const knownPlaces = [
      'salem', 'சேலம்', 'सेलम', 'सेलम्',
      'chennai', 'சென்னை', 'चेन्नई',
      'anna nagar chennai', 'anna nagar', 'அண்ணா நகர்', 'अन्ना नगर',
      't nagar', 't. nagar', 'தி நகர்',
      'coimbatore gandhipuram', 'coimbatore', 'gandhipuram', 'கோயம்புத்தூர் காந்திபுரம்', 'கோயம்புத்தூர்', 'காந்திபுரம்', 'कोयंबटूर',
      'delhi', 'connaught place', 'दिल्ली', 'कनॉट प्लेस', 'नई दिल्ली',
      'bengaluru', 'bangalore', 'indiranagar', 'பெங்களூரு', 'இந்திரா நகர்', 'बेंगलुरु', 'इंदिरा नगर',
      'hyderabad', 'gachibowli', 'ஹைதராபாத்', 'கச்சிபௌலி', 'हैदराबाद', 'गाचीबोवली',
      'mumbai', 'bandra west', 'bandra', 'மும்பை', 'பாந்த்ரா', 'मुंबई', 'बांद्रा',
      'madurai', 'kk nagar', 'மதுரை', 'मदुरै', 'केके नगर',
      'dharmapuri main road', 'dharmapuri', 'main road dharmapuri', 'தர்மபுரி', 'धर्मपुरी'
    ];

    const repeatPatterns = [
      'repeat', 'pardon', 'what did you say', 'once again', 'tell me again', 'say again',
      'say that again', 'repeat please', 'come again', 'repeat the question', 'didn t hear',
      'say once more', 'repeat that', 'speak again', 'can you repeat',
      'மீண்டும் சொல்', 'இன்னொரு முறை', 'திரும்ப சொல்', 'marupadiyum sollu', 'marubadiyum',
      'thirumba sollu', 'thirumba pesu', 'marubadi sollu', 'innoru thadava', 'innoru murai sollu',
      'marupadiyum kelu', 'thirumbavum sollu', 'puriyala thirumba sollu', 'marupadiyum solunga', 'திரும்பவும் சொல்',
      'फिर से बोलो', 'दोबारा बताओ', 'phir se bolo', 'ek baar aur', 'dobara bolo',
      'fir se bolo', 'sunai nahi diya', 'dobara kahiye', 'fir se batao', 'ek bar aur bolo',
      'phir bolo', 'kya kaha', 'dobara sunao', 'fir se kahiye', 'samajh nahi aaya fir se bolo'
    ];

    const cancelPatterns = [
      'cancel', 'close', 'stop', 'exit', 'dismiss', 'back', 'cancel that', 'close modal',
      'cancel now', 'shut down', 'go back', 'abort', 'discard', 'stop now', 'close this',
      'ரத்து செய்', 'நிறுத்து', 'மூடு', 'cancel pannu', 'close pannu', 'vendaam mudu',
      'niruthu', 'rathu sei', 'veliya po', 'back po', 'stop pannu', 'vendam niruthu',
      'moodu', 'rathu seiyavum', 'cancel seidu vidu',
      'रद्द करो', 'बंद करो', 'रोक दो', 'cancel karo', 'ruk jao', 'wapas jao',
      'band kar do', 'cancel kar do', 'radd karo', 'hatao', 'roko', 'peeche jao',
      'band karo ise', 'cancel kijiye', 'chhod do abhi'
    ];

    const changePatterns = [
      // English
      'no', 'deny', 'change address', 'skip', 'change location', 'different address', 'another address',
      'different place', 'another place', 'manual', 'choose location', 'enter address', 'not now', 'nope',
      'dont use live location', 'don t use live location',
      // Tamil / Tanglish
      'venaam', 'illa', 'maathu', 'address maathu', 'vera idam', 'இல்லை', 'வேண்டாம்', 'முகவரி மாற்று',
      'venam', 'illai', 'vera address', 'மாற்று', 'வேற இடம்', 'தவிர்க்கவும்', 'வேணாம்', 'தேவையில்லை', 'இல்ல',
      // Hindi / Hinglish
      'nahi', 'badlo', 'address badlo', 'दूसरा पता', 'नहीं', 'बदलो', 'nahin', 'dusra pata',
      'dusra address', 'location badlo', 'मना', 'मना करें', 'पता बदलो', 'छोड़ो', 'बदलें'
    ];

    const allowPatterns = [
      // English
      'allow', 'yes', 'ok', 'sure', 'use my location', 'use live location', 'enable location',
      'current location', 'live location', 'turn on location', 'yep', 'yeah', 'okay', 'fine', 'why not',
      // Tamil / Tanglish
      'aama', 'sari', 'seri', 'ஆமாம்', 'சரி', 'ok pannu', 'live address eduthukko', 'aamam',
      'seri pannu', 'eduthuko', 'anumathi', 'kudukalam', 'கொடுக்கலாம்', 'அனுமதி', 'சரிதான்',
      'அனுமதிக்கிறேன்', 'அனுமதிக்கலாம்', 'ஆமா', 'தாராளமா', 'இருப்பிடம் எடு',
      // Hindi / Hinglish
      'haan', 'theek hai', 'ठीक है', 'हाँ', 'लोकेशन चालू करो', 'haa', 'haanjee', 'sahi hai',
      'sahi', 'le lo', 'chalega', 'अनुमति', 'अनुमति दें', 'स्थान का उपयोग करो'
    ];

    const effectiveCandidates = (candidates && candidates.length > 0) ? candidates : [transcript];

    for (const cand of effectiveCandidates) {
      const lower = cand.toLowerCase().trim();
      const normalized = lower.replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, ' ').replace(/\s+/g, ' ').trim();

      // 1. Repeat check
      if (repeatPatterns.some(p => normalized === p || normalized.startsWith(p) || normalized.includes(p))) {
        return { intent: 'repeat', address: null, confidence: 0.95, source: 'local_fallback' };
      }

      // 2. Cancel check
      if (cancelPatterns.some(p => normalized === p || normalized.startsWith(p) || normalized.includes(p))) {
        return { intent: 'cancel', address: null, confidence: 0.95, source: 'local_fallback' };
      }

      // 3. Give Address: explicit phrasing or direct place mention
      const directPlacePhrase = normalized.match(/मुझे\s+([a-zA-Z\u0B80-\u0BFF\u0900-\u097F\s]+?)\s+में\s+डिलीवरी/i);
      if (directPlacePhrase && directPlacePhrase[1]) {
        return { intent: 'give_address', address: directPlacePhrase[1].trim(), confidence: 0.95, source: 'local_fallback' };
      }

      const reverseDeliveryPhraseRegex = /([a-zA-Z\u0B80-\u0BFF\u0900-\u097F\s]+?)\s*(?:டெலிவரி|க்கு டெலிவரி|में डिलीवरी|la delivery|ku delivery|mein delivery|me delivery)/i;
      const matchRev = normalized.match(reverseDeliveryPhraseRegex);
      if (matchRev && matchRev[1] && matchRev[1].trim().length >= 2) {
        return { intent: 'give_address', address: matchRev[1].trim(), confidence: 0.92, source: 'local_fallback' };
      }

      const deliveryPhraseRegex = /(?:deliver(?:y)?\s+(?:to|in)|delivery|டெலிவரி|க்கு டெலிவரி|டெலிவரி செய்|में डिलीवरी|डिलीवरी चाहिए|डिलीवरी)\s*([a-zA-Z\u0B80-\u0BFF\u0900-\u097F\s]+)/i;
      const matchFwd = normalized.match(deliveryPhraseRegex);
      if (matchFwd && matchFwd[1] && matchFwd[1].trim().length >= 2) {
        return { intent: 'give_address', address: matchFwd[1].trim(), confidence: 0.92, source: 'local_fallback' };
      }

      for (const place of knownPlaces) {
        if (normalized === place || normalized.includes(place)) {
          const extracted = place.length > 2
            ? place.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
            : place;
          return { intent: 'give_address', address: extracted, confidence: 0.92, source: 'local_fallback' };
        }
      }

      // 4. Change Location (no, venaam, nahi, badlo, etc.)
      const hasChange = changePatterns.some(p => {
        const regex = new RegExp(`(^|\\s)${p.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}($|\\s)`, 'i');
        return regex.test(normalized) || normalized === p;
      });

      // 5. Use Live Location (allow, aama, haan, etc.)
      const isNegativeLiveLocation = /dont use live|don't use live|do not use live|live location (?:venaam|nahi|badlo|maathu)/i.test(cand);
      const isExactChaluKaro = normalized === 'चालू करो' || normalized === 'chalu karo';
      const hasAllow = !isNegativeLiveLocation && (isExactChaluKaro || allowPatterns.some(p => {
        const regex = new RegExp(`(^|\\s)${p.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}($|\\s)`, 'i');
        return regex.test(normalized) || normalized === p;
      }));

      if (hasAllow && !hasChange) {
        return { intent: 'use_live_location', address: null, confidence: 0.95, source: 'local_fallback' };
      }
      if (hasChange && !hasAllow) {
        return { intent: 'change_location', address: null, confidence: 0.95, source: 'local_fallback' };
      }
    }

    return { intent: 'unclear', address: null, confidence: 0.3, source: 'local_fallback' };
  }


  public static async interpretLocationChoice(
    transcript: string,
    options: { language?: Language; alternatives?: string[]; step?: string } = {}
  ): Promise<LocationChoiceNluResult> {
    const cleanTranscript = (transcript || '').trim();
    if (!cleanTranscript) {
      return { intent: 'unclear', address: null, confidence: 0, source: 'local_fallback' };
    }

    const lang: Language = options.language || 'en';
    const cacheKey = `${lang}:${cleanTranscript.toLowerCase()}`;
    const cached = this.locationNluCache.get(cacheKey);
    if (cached) {
      voiceNluDebug('[Location NLU Cache Hit]:', cached);
      return { ...cached, source: 'cache' };
    }

    // Try Gemini LLM via backend endpoint
    try {
      const response = await fetch('/api/voice/nlu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: cleanTranscript,
          alternatives: (options.alternatives || []).slice(0, 5),
          step: options.step || 'location_choice',
          language: lang
        })
      });

      if (response.ok) {
        const parsed = await response.json();
        if (
          parsed &&
          ['use_live_location', 'change_location', 'give_address', 'repeat', 'cancel', 'unclear'].includes(parsed.intent)
        ) {
          const result: LocationChoiceNluResult = {
            intent: parsed.intent,
            address: parsed.address || null,
            confidence: Number.isFinite(parsed.confidence) ? parsed.confidence : 0.9,
            source: 'gemini'
          };
          this.locationNluCache.set(cacheKey, result);
          if (this.locationNluCache.size > 150) {
            this.locationNluCache.delete(this.locationNluCache.keys().next().value!);
          }
          return result;
        }
      }
    } catch (err) {
      console.warn('[LlmNluService]: Gemini call failed or offline, using local fallback pipeline:', err);
    }

    // Fallback to local keyword/phrasal matching
    const candidates = (options.alternatives && options.alternatives.length > 0)
      ? options.alternatives
      : [cleanTranscript];
    const local = this.classifyLocationChoiceLocally(cleanTranscript, lang, candidates);
    this.locationNluCache.set(cacheKey, local);
    return local;
  }

  /**
   * LLM + Fuzzy NLU classifier for Location Permission responses.
   * Backward-compatible bridge to interpretLocationChoice.
   */
  public static async interpretLocationPermissionIntent(
    transcript: string,
    language: Language = 'en'
  ): Promise<{ intent: 'ALLOW' | 'DENY' | 'AMBIGUOUS'; confidence: number; explanation: string }> {
    const choice = await this.interpretLocationChoice(transcript, { language, step: 'location_permission' });
    if (choice.intent === 'use_live_location') {
      return { intent: 'ALLOW', confidence: choice.confidence, explanation: 'Affirmative live location' };
    }
    if (choice.intent === 'change_location') {
      return { intent: 'DENY', confidence: choice.confidence, explanation: 'Declined live location' };
    }
    return { intent: 'AMBIGUOUS', confidence: choice.confidence, explanation: `Intent: ${choice.intent}` };
  }
}

export type LocationChoiceIntent =
  | 'use_live_location'
  | 'change_location'
  | 'give_address'
  | 'repeat'
  | 'cancel'
  | 'unclear';

export interface LocationChoiceNluResult {
  intent: LocationChoiceIntent;
  address: string | null;
  confidence: number;
  source: 'gemini' | 'local_fallback' | 'cache';
}
