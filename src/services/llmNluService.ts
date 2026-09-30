import { GoogleGenAI } from '@google/genai';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { FoodItem, Language, ScheduleDuration } from '../types';
import { NLPParserService, ParsedOrderBill, ParsedItem } from './nlpParserService';
import { PriceComparisonService } from './priceComparisonService';
import { FuzzyMatchEngine } from './fuzzyMatchService';

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

export class LlmNluService {
  private static extractionCache: Map<string, LlmFoodExtractionResult> = new Map();

  public static clearCache(): void {
    console.log('[ORDER_FLOW_DEBUG - Cache Reset]: LlmNluService extraction cache cleared.');
    this.extractionCache.clear();
  }

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
      console.warn('[LlmNluService] Gemini API key not found in env, using offline NLP fallback.');
    }
    return null;
  }

  /**
   * 🚀 STEP 1: LLM-based Entity Extraction & Normalization
   * Extracts core food item name(s) from Tamil script, Tanglish, or English natural sentences.
   * Caches results for repeated inputs to eliminate latency & API costs.
   */
  public static async extractFoodItemWithLlm(transcript: string): Promise<LlmFoodExtractionResult> {
    if (!transcript || !transcript.trim()) {
      return { item: null, confidence: 0, original_phrase: '', items: [] };
    }

    const cleanInput = transcript.trim();
    const cacheKey = cleanInput.toLowerCase();

    // Check in-memory cache first
    if (this.extractionCache.has(cacheKey)) {
      const cached = this.extractionCache.get(cacheKey)!;
      console.log(`[ORDER_FLOW_DEBUG - Step 2: NLU Extraction (Cache Hit)]: Raw Transcript: "${cleanInput}" → Extracted Item: "${cached.item}"`, cached);
      return cached;
    }

    const client = this.getGeminiClient();

    if (client) {
      try {
        const systemPrompt = `You are a food-order entity extractor. The user will type a sentence in Tamil script, Tanglish (Tamil written in English letters), or English, asking for a food item.

Extract ONLY the core food item name, ignoring filler words (venum, kavanum, please, I want, etc). Normalize the item name to standard English spelling (e.g. "தோசா" / "dosa" / "dosai" → "Dosa"; "பிரைட் ரைஸ்" / "fried rice" → "Fried Rice").

Respond ONLY with raw JSON, nothing else:
{"item": "<normalized English name>", "confidence": <0-1>, "original_phrase": "${cleanInput}", "items": ["<normalized English name 1>", "<normalized English name 2>"]}

If multiple items are mentioned, return an array under "items" and set "item" to the primary item.
If no food item is identifiable, return {"item": null, "confidence": 0, "original_phrase": "${cleanInput}", "items": []}.

User sentence: "${cleanInput}"`;

        const response = await client.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: systemPrompt,
          config: {
            responseMimeType: 'application/json',
            maxOutputTokens: 150
          }
        });

        const textResponse = response.text || '';
        console.log('[LlmNluService LLM Extraction Response]:', textResponse);
        const parsed: LlmFoodExtractionResult = JSON.parse(textResponse.trim());
        
        const result: LlmFoodExtractionResult = {
          item: parsed.item || (parsed.items && parsed.items.length > 0 ? parsed.items[0] : null),
          items: parsed.items || (parsed.item ? [parsed.item] : []),
          confidence: parsed.confidence || 0.95,
          original_phrase: cleanInput
        };

        // Cache the response
        this.extractionCache.set(cacheKey, result);
        console.log('[NLP Log]:', { original_phrase: cleanInput, llm_output: result });
        return result;

      } catch (err) {
        console.warn('[LlmNluService LLM Extraction failed, falling back to smart rule parser]:', err);
      }
    }

    // Fallback: Synchronous offline rule-based extractor
    const offlineResult = this.extractFoodItemOfflineFallback(cleanInput);
    this.extractionCache.set(cacheKey, offlineResult);
    console.log('[NLP Log (Offline Fallback)]:', { original_phrase: cleanInput, llm_output: offlineResult });
    return offlineResult;
  }

  /**
   * Fast synchronous accessor for LLM extraction (utilizing cache and rule fallback)
   */
  public static extractFoodItemWithLlmSync(transcript: string): LlmFoodExtractionResult {
    if (!transcript || !transcript.trim()) {
      return { item: null, confidence: 0, original_phrase: '', items: [] };
    }

    const cleanInput = transcript.trim();
    const cacheKey = cleanInput.toLowerCase();

    if (this.extractionCache.has(cacheKey)) {
      return this.extractionCache.get(cacheKey)!;
    }

    const result = this.extractFoodItemOfflineFallback(cleanInput);
    this.extractionCache.set(cacheKey, result);

    // Trigger background LLM extraction to populate cache for next turn if client exists
    this.extractFoodItemWithLlm(cleanInput).catch(() => {});

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
    lang: Language = 'en'
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

    console.log(`[LlmNluService] Parsing free-form voice sentence in "${lang}": "${transcript}"`);

    const scheduleDetails = NLPParserService.parseScheduleDetailsFromVoice(transcript);

    const client = this.getGeminiClient();
    let llmResult: ExtractedLlmOrder | null = null;

    if (client) {
      try {
        const catalogNames = INDIAN_FOOD_CATALOG.map(f => `${f.name} (${f.nativeNames.ta} / ${f.nativeNames.hi}) - Restaurant: ${f.restaurant}`).join(', ');
        
        const systemPrompt = `You are an expert NLU (Natural Language Understanding) food order parser for AutoFeast.
Extract structured order information from the user's spoken input in English, Tamil, Hindi, or Tanglish.

Food Catalog Available:
[${catalogNames}]

You MUST determine:
1. "intent":
   - "schedule": if sentence indicates scheduling for later, recurring order, specifying a time, or specifying duration/frequency (e.g. "daily", "everyday", "for 1 month", "oru masathuku", "1 masathuku", "for 1 week", "at 8am", "8 maniku", "schedule pannu", "schedule", "slot podu", "order potru", "every week", "Mondays and Fridays").
   - "order": if sentence indicates instant ordering NOW without any future time or recurrence duration (e.g. "order now", "ipove order", "kudunga", "vaangu").
   - "search": if just inquiring or searching without order/schedule action verbs.

2. "items": Array of extracted items with their quantities.
3. "restaurant": Restaurant Name if mentioned, else null.
4. "time": Extracted time if mentioned (e.g. "08:00", "8 AM"), else null.

Respond ONLY with raw valid JSON:
{
  "intent": "order" | "schedule" | "search",
  "items": [
    { "name": "Item Name", "quantity": number }
  ],
  "restaurant": "Restaurant Name or null",
  "time": "Time string or null"
}

User Spoken Input: "${transcript}"`;

        const response = await client.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: systemPrompt,
          config: {
            responseMimeType: 'application/json'
          }
        });

        const textResponse = response.text || '';
        console.log('[LlmNluService Gemini Output]:', textResponse);
        llmResult = JSON.parse(textResponse.trim());
      } catch (err) {
        console.warn('[LlmNluService Gemini API error, using offline NLP parser fallback]:', err);
        llmResult = null;
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
    console.log('[LlmNluService] Executing offline NLP Parser fallback...');
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
   * LLM + Fuzzy NLU classifier for Location Permission responses.
   * Understands natural Tamil, English, and Hindi phrasings for ALLOW / DENY intents,
   * while classifying off-topic or unclear speech as AMBIGUOUS.
   */
  public static async interpretLocationPermissionIntent(
    transcript: string,
    language: Language = 'en'
  ): Promise<{ intent: 'ALLOW' | 'DENY' | 'AMBIGUOUS'; confidence: number; explanation: string }> {
    if (!transcript || !transcript.trim()) {
      return { intent: 'AMBIGUOUS', confidence: 0, explanation: 'Empty transcript' };
    }

    const cleanInput = transcript.trim();
    const lower = cleanInput.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ' ').replace(/\s+/g, ' ');

    // 1. FAST RULE & FUZZY PRE-CHECK LAYER (Tamil, English, Hindi, Tanglish)
    const allowPatterns = [
      // Tamil script
      'அனுமதி', 'அனுமதிக்கிறேன்', 'அனுமதிக்கலாம்', 'ஆமா', 'ஆமாம்', 'சரி', 'சரிதான்',
      'கொடு', 'பரவாயில்லை', 'ஓகே', 'ஓகேப்பா', 'எடுத்துக்கோ', 'தறேன்', 'மாத்தலாம்',
      'ஓகே தான்', 'இருப்பிடம் எடு', 'இருப்பிடம் கொடு', 'எடுத்துக்க', 'தாராளமா', 'கொடுக்கலாம்',
      'அனுமதி உண்டு', 'இருப்பிடம் பயன்படுத்தலாம்', 'எடுத்துக்கலாம்', 'எடுத்துக்கங்க',
      // Tanglish
      'aama', 'aamam', 'sari', 'seri', 'kodu', 'paravaillai', 'okay', 'ok', 'aamampaa',
      'kudukalam', 'anumaadhi', 'anumathi', 'yeduthuko', 'thalam', 'eduthukonga',
      // English
      'allow', 'yes', 'sure', 'yep', 'yeah', 'grant', 'accept', 'go ahead', 'proceed',
      'fine', 'why not', 'use my location', 'enable location', 'agree', 'allow it', 'yes please',
      // Hindi
      'अनुमति', 'हाँ', 'हाँजी', 'ठीक', 'ठीक है', 'दे दो', 'मंजूर', 'चल जाएगा', 'अनुमति दें',
      'haa', 'haan', 'teek', 'le lo', 'haanjee'
    ];

    const denyPatterns = [
      // Tamil script
      'வேண்டாம்', 'வேண்டாம் பா', 'வேண்டாம்மா', 'வேண்டாத்', 'இல்ல', 'இல்லை', 'மாட்டேன்',
      'தேவையில்ல', 'தேவையில்லை', 'தவிர்க்கவும்', 'வேணாம்', 'வேணாம்ப்பா', 'வேண்டாம் என்று',
      'வேண்டாம்னு', 'இருப்பிடம் வேண்டாம்', 'நோ', 'வேண்டாதீங்க', 'வேணாம் பா',
      // Tanglish
      'vendam', 'vaendaam', 'venam', 'illa', 'illai', 'maaten', 'thevaiyillai', 'thevaiyilla',
      'thavirkavum', 'don\'t', 'dont',
      // English
      'deny', 'no', 'nope', 'nah', 'skip', 'cancel', 'decline', 'never', 'refuse',
      'don\'t allow', 'block', 'stop', 'reject', 'not now', 'no thanks',
      // Hindi
      'मना', 'नहीं', 'मना करें', 'रहने दो', 'स्किप', 'नही', 'नहीं चाहिए', 'मना है',
      'nahin', 'nahi', 'rehnedo'
    ];

    const hasAllowMatch = allowPatterns.some(p => lower.includes(p));
    const hasDenyMatch = denyPatterns.some(p => lower.includes(p));

    // Clear non-contradictory match
    if (hasAllowMatch && !hasDenyMatch) {
      console.log(`[LocationNLU] Rule/Fuzzy fast-match -> ALLOW: "${cleanInput}"`);
      return { intent: 'ALLOW', confidence: 0.98, explanation: 'Matched affirmative phrasing' };
    }
    if (hasDenyMatch && !hasAllowMatch) {
      console.log(`[LocationNLU] Rule/Fuzzy fast-match -> DENY: "${cleanInput}"`);
      return { intent: 'DENY', confidence: 0.98, explanation: 'Matched negative phrasing' };
    }

    // 2. GEMINI LLM NLU LAYER FOR COMPLEX / AMBIGUOUS / PHRASAL INPUTS
    const client = this.getGeminiClient();
    if (client) {
      try {
        const systemPrompt = `You are an intent classifier for a food ordering app asking for GPS location permission.
The prompt asked: "Can we access your location to find nearby restaurants?"
The user spoken response (in Tamil, Tanglish, Hindi, or English) is: "${cleanInput}"

Classify into EXACTLY ONE intent:
- "ALLOW": User agrees, permits, says yes, okay, sari, aama, kodu, paravaillai, sure, grant access, etc.
- "DENY": User declines, denies access, says no, vendam, venam, illa, skip, don't allow, refuse, etc.
- "AMBIGUOUS": User input is off-topic (e.g. ordering food like "biryani", asking unrelated questions, noise), ambiguous, or unclear.

Respond strictly with JSON:
{"intent": "ALLOW" | "DENY" | "AMBIGUOUS", "confidence": 0.95, "explanation": "reason"}`;

        const response = await client.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: systemPrompt,
          config: {
            responseMimeType: 'application/json',
            maxOutputTokens: 100
          }
        });

        const textRes = response.text || '';
        console.log('[LocationNLU] Gemini NLU Response:', textRes);
        const parsed = JSON.parse(textRes.trim());
        if (parsed.intent === 'ALLOW' || parsed.intent === 'DENY' || parsed.intent === 'AMBIGUOUS') {
          return {
            intent: parsed.intent,
            confidence: parsed.confidence || 0.9,
            explanation: parsed.explanation || 'LLM classified'
          };
        }
      } catch (err) {
        console.warn('[LocationNLU] Gemini LLM call failed, falling back to rule decision:', err);
      }
    }

    // 3. FALLBACK FOR UNMATCHED INPUTS
    console.log(`[LocationNLU] Unmatched input -> AMBIGUOUS: "${cleanInput}"`);
    return {
      intent: 'AMBIGUOUS',
      confidence: 0.5,
      explanation: 'Could not confidently determine ALLOW or DENY intent'
    };
  }
}
