import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { FoodItem, Language } from '../types';

export interface HealthFoodSuggestion {
  foodItem: FoodItem;
  reasonEn: string;
  reasonTa: string;
  reasonHi: string;
  dietaryAttributes?: string[];
}

export interface HealthDietaryAnalysisResult {
  rawTranscript: string;
  healthContextSummary: string;
  targetPerson: string; // 'self' | 'appa' | 'amma' | 'thatha' | 'paati' | 'relative'
  suggestions: HealthFoodSuggestion[];
  disclaimerEn: string;
  disclaimerTa: string;
  disclaimerHi: string;
  detectedAttributes?: {
    conditions: string[];
    isElderly: boolean;
    isMild: boolean;
    isLowOil: boolean;
    isLowSalt: boolean;
    isVegetarian: boolean;
    isEasilyDigestible: boolean;
  };
}

interface ParsedHealthProfile {
  targetPerson: string;
  isHeart: boolean;
  isDiabetes: boolean;
  isBp: boolean;
  isCholesterol: boolean;
  isFever: boolean;
  isDigestion: boolean;
  isElderly: boolean;
  isMild: boolean;
  isLowOil: boolean;
  isLowSalt: boolean;
  isVegetarian: boolean;
  isEasilyDigestible: boolean;
  isBreakfast: boolean;
  isLunch: boolean;
  isDinner: boolean;
  summaryEn: string;
  summaryTa: string;
  summaryHi: string;
}

export class HealthDietaryNluService {
  private static DISCLAIMER_EN = 'This is a general dietary suggestion, not medical advice — please consult a doctor for your condition.';
  private static DISCLAIMER_TA = 'இது ஒரு பொதுவான உணவுப் பரிந்துரை மட்டுமே, மருத்துவ ஆலோசனை அல்ல. உங்கள் உடல்நலக் கோளாறுக்கு மருத்துவரை அணுகவும்.';
  private static DISCLAIMER_HI = 'यह एक सामान्य आहार सुझाव है, चिकित्सीय सलाह नहीं — कृपया अपनी स्थिति के लिए डॉक्टर से परामर्श लें।';

  // In-memory cache for ultra-fast repeated queries (< 5ms)
  private static cache = new Map<string, { result: HealthDietaryAnalysisResult; timestamp: number }>();
  private static inFlightRequests = new Map<string, Promise<HealthDietaryAnalysisResult>>();
  private static CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

  /**
   * Main Health / Dietary Recommendation Pipeline:
   * 1. Checks memory cache
   * 2. Combines query with saved conditions
   * 3. Attempts single fast AI endpoint (3000ms timeout)
   * 4. Seamlessly falls back to deterministic catalog matching on timeout/failure
   */
  public static async analyzeHealthContextAndSuggestFood(
    transcript: string,
    language: Language = 'en',
    savedConditions?: string
  ): Promise<HealthDietaryAnalysisResult> {
    const cleanInput = (transcript || '').trim();
    const cleanSaved = (savedConditions || '').trim();
    const effectiveInput = cleanInput || cleanSaved || 'general mild dietary recommendation';

    const cacheKey = `${language}:${effectiveInput.toLowerCase()}:${cleanSaved.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      console.log(`[HealthDietaryNluService] Serving cached recommendations for: "${effectiveInput}"`);
      return cached.result;
    }

    // Deduplicate simultaneous identical requests
    const inFlight = this.inFlightRequests.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const requestPromise = (async () => {
      try {
        // Attempt AI analysis with strict 3.5s timeout
        const aiResult = await this.fetchWithTimeout(effectiveInput, language, 3500);
        if (aiResult && aiResult.suggestions.length >= 2) {
          this.cache.set(cacheKey, { result: aiResult, timestamp: Date.now() });
          return aiResult;
        }
      } catch (err) {
        console.warn('[HealthDietaryNluService] AI endpoint bypassed/timed out, using deterministic catalog matcher:', err);
      }

      // Safe, immediate, deterministic catalog recommendation
      const fallbackResult = this.generateCatalogHealthSuggestions(effectiveInput, language, cleanSaved);
      this.cache.set(cacheKey, { result: fallbackResult, timestamp: Date.now() });
      return fallbackResult;
    })().finally(() => {
      this.inFlightRequests.delete(cacheKey);
    });

    this.inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }

  /**
   * Fast HTTP fetch with AbortController timeout to prevent indefinite hangs
   */
  private static async fetchWithTimeout(
    transcript: string,
    language: Language,
    timeoutMs: number
  ): Promise<HealthDietaryAnalysisResult | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch('/api/voice/health-nlu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, language }),
        signal: controller.signal
      });

      if (!response.ok) return null;

      const parsed = await response.json() as {
        healthContextSummary?: unknown;
        targetPerson?: unknown;
        suggestedItemIds?: Array<{ itemId?: unknown; reasonEn?: unknown; reasonTa?: unknown; reasonHi?: unknown }>;
      };

      if (!Array.isArray(parsed?.suggestedItemIds)) return null;

      const suggestions: HealthFoodSuggestion[] = [];
      for (const itemReq of parsed.suggestedItemIds.slice(0, 4)) {
        if (typeof itemReq?.itemId !== 'string') continue;
        const found = INDIAN_FOOD_CATALOG.find(f => f.id === itemReq.itemId);
        if (found) {
          const attributes = this.deriveDietaryAttributes(found);
          suggestions.push({
            foodItem: found,
            reasonEn: typeof itemReq.reasonEn === 'string' ? itemReq.reasonEn : 'Nutritionally gentle on digestion.',
            reasonTa: typeof itemReq.reasonTa === 'string' ? itemReq.reasonTa : 'செரிமானத்திற்கு எளிதான சத்தான உணவு.',
            reasonHi: typeof itemReq.reasonHi === 'string' ? itemReq.reasonHi : 'पाचन के लिए उपयुक्त पौष्टिक आहार।',
            dietaryAttributes: attributes
          });
        }
      }

      if (suggestions.length >= 2) {
        const targetPeople = ['self', 'appa', 'amma', 'thatha', 'paati', 'relative'];
        const targetPerson = typeof parsed.targetPerson === 'string' && targetPeople.includes(parsed.targetPerson)
          ? parsed.targetPerson
          : 'self';

        return {
          rawTranscript: transcript,
          healthContextSummary: typeof parsed.healthContextSummary === 'string'
            ? parsed.healthContextSummary
            : 'Personalized Health-Verified Recommendations',
          targetPerson,
          suggestions,
          disclaimerEn: this.DISCLAIMER_EN,
          disclaimerTa: this.DISCLAIMER_TA,
          disclaimerHi: this.DISCLAIMER_HI
        };
      }
      return null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Deterministic Natural-Language Health Context Parser
   * Parses English, Tamil & Hindi queries for conditions, age, restrictions, and preferences.
   */
  public static parseHealthQuery(transcript: string, savedConditions: string = ''): ParsedHealthProfile {
    const combined = `${transcript} ${savedConditions}`.toLowerCase().replace(/[,.-]/g, ' ');

    // 1. Target person
    let targetPerson = 'self';
    if (/(appa|father|dad|அப்பா|தந்தை|பிதா|पिताजी|पिता|पापा)/i.test(combined)) targetPerson = 'appa';
    else if (/(amma|mother|mom|அம்மா|தாய்|माँ|माताजी|मम्मी)/i.test(combined)) targetPerson = 'amma';
    else if (/(thatha|grandpa|grandfather|தாத்தா|दादा|नाना|बाबा)/i.test(combined)) targetPerson = 'thatha';
    else if (/(paati|grandma|grandmother|பாட்டி|दादी|नानी)/i.test(combined)) targetPerson = 'paati';
    else if (/(relative|friend|patient|நோயாளி|मरीज|रोगी)/i.test(combined)) targetPerson = 'relative';

    // 2. Health conditions
    const isHeart = /(heart|cardiac|attack|coronary|இதய|நெஞ்சு|ஹார்ட்|हृदय|दिल)/i.test(combined);
    const isDiabetes = /(diabet|sugar|glucose|insulin|சர்க்கரை|நீரிழிவு|டையாபடீஸ்|डायबिटीज|मधुमेह|शुगर)/i.test(combined);
    const isBp = /(blood pressure|\bbp\b|hypertension|இரத்த அழுத்தம்|ரத்த அழுத்தம்|ब्लड प्रेशर|बीपी|रक्तचाप)/i.test(combined);
    const isCholesterol = /(cholesterol|lipid|fatty|கொலஸ்ட்ரால்|கொழுப்பு|कोलेस्ट्रॉल|कोलेस्ट्रोल)/i.test(combined);
    const isFever = /(fever|temperature|cold|cough|flu|காய்ச்சல்|சளி|இருமல்|புண்|बुखार|सर्दी|खांसी)/i.test(combined);
    const isDigestion = /(stomach|digestion|digestible|digest|gastric|acidity|ulcer|pain|tablet|medicine|வயிறு|செரிமானம்|வாய்வு|அல்சர்|மாத்திரை|மருந்து|पेट|पाचन|अपच|गैस|अल्सर|दवा)/i.test(combined);

    // 3. Age context (60+ years old / elderly)
    const isElderly = /(6[0-9]|7[0-9]|8[0-9]|9[0-9]|elderly|older|old age|senior|aged|முதியவர்|வயதான|வயது|साल|बुजुर्ग|वृद्ध|उम्रदराज)/i.test(combined) ||
      targetPerson === 'thatha' || targetPerson === 'paati';

    // 4. Dietary attributes
    const isMild = /(mild|bland|soft|less spice|non spicy|not spicy|light|காரமில்லாத|காரமில்லா|மிதமான|லேசான|हल्का|कम तीखा|फीका|बिना मिर्च)/i.test(combined);
    const isLowOil = /(low oil|less oil|no oil|oil free|oil-free|zero oil|குறைந்த எண்ணெய்|எண்ணெய் இல்லாத|எண்ணெய் குறைவான|कम तेल|बिना तेल|तेल मुक्त)/i.test(combined);
    const isLowSalt = /(low salt|less salt|no salt|salt free|salt-free|low sodium|குறைந்த உப்பு|உப்பு குறைவான|कम नमक|बिना नमक|नमक कम)/i.test(combined);
    const isVegetarian = /(\bveg\b|vegetarian|pure veg|சைவ|சைவம்|शाकाहारी|वेज)/i.test(combined);
    const isEasilyDigestible = /(easily digestible|digestible|light on stomach|easy to digest|எளிதில் செரிக்கும்|சுலபமாக செரிக்கும்|செரிமான|सुपाच्य|पचने में आसान)/i.test(combined) || isDigestion || isElderly;

    // 5. Meal context
    const isBreakfast = /(breakfast|morning|tiffin|காலை|காலை உணவு|டிபன்|नाश्ता|सुबह)/i.test(combined);
    const isLunch = /(lunch|afternoon|meals|thali|மதியம்|மதிய உணவு|சாப்பாடு|दोपहर|लंच|थाली)/i.test(combined);
    const isDinner = /(dinner|night|supper|இரவு|இரவு உணவு|रात|डिनर)/i.test(combined);

    // Build summaries
    const conditionsList: string[] = [];
    if (isHeart) conditionsList.push('Heart Care');
    if (isDiabetes) conditionsList.push('Diabetic Support');
    if (isBp) conditionsList.push('BP Control');
    if (isCholesterol) conditionsList.push('Low-Cholesterol');
    if (isFever) conditionsList.push('Fever Recovery');
    if (isDigestion) conditionsList.push('Digestive Comfort');
    if (isElderly) conditionsList.push('Senior Dietary Care');
    if (isMild) conditionsList.push('Mild & Low-Spice');
    if (isLowOil) conditionsList.push('Low-Oil');
    if (isLowSalt) conditionsList.push('Low-Salt');

    const summaryEn = conditionsList.length > 0
      ? `${conditionsList.join(', ')} (${targetPerson.toUpperCase()})`
      : 'General Light & Healthy Recommendations';

    const summaryTa = conditionsList.length > 0
      ? `உடல்நலப் பரிந்துரை: ${conditionsList.join(', ')}`
      : 'பொதுவான லேசான உணவுப் பரிந்துரைகள்';

    const summaryHi = conditionsList.length > 0
      ? `स्वास्थ्य सिफारिशें: ${conditionsList.join(', ')}`
      : 'सामान्य सुपाच्य आहार सुझाव';

    return {
      targetPerson,
      isHeart,
      isDiabetes,
      isBp,
      isCholesterol,
      isFever,
      isDigestion,
      isElderly,
      isMild,
      isLowOil,
      isLowSalt,
      isVegetarian,
      isEasilyDigestible,
      isBreakfast,
      isLunch,
      isDinner,
      summaryEn,
      summaryTa,
      summaryHi
    };
  }

  /**
   * Deterministic Catalog Recommendation Generator
   * Maps queries directly to verified INDIAN_FOOD_CATALOG items with medical responsibility
   */
  public static generateCatalogHealthSuggestions(
    transcript: string,
    language: Language = 'en',
    savedConditions: string = ''
  ): HealthDietaryAnalysisResult {
    const profile = this.parseHealthQuery(transcript, savedConditions);

    // Catalog candidate items with match scoring
    const candidates = INDIAN_FOOD_CATALOG.map(item => {
      let score = 0;
      let reasons = { en: '', ta: '', hi: '' };
      const tags = (item.tags || []).join(' ').toLowerCase();

      // STRICT FILTER: If vegetarian requested, discard non-veg
      if ((profile.isVegetarian || profile.isHeart || profile.isFever) && !item.isVeg) {
        return { item, score: -100, reasons };
      }

      // STRICT FILTER: For Diabetes, exclude high sugar/simple syrup desserts
      if (profile.isDiabetes && (item.category === 'Desserts' || tags.includes('sweet') || item.id === 'dessert-gulab-jamun')) {
        return { item, score: -100, reasons };
      }

      // STRICT FILTER: For Heart, BP, Cholesterol, Elderly or Low Oil, exclude deep fried & heavy butter items
      if ((profile.isHeart || profile.isBp || profile.isCholesterol || profile.isElderly || profile.isLowOil) &&
          (item.id === 'parotta-kothu' || item.id === 'butter-chicken' || item.id === 'chole-bhature' ||
           item.id === 'pav-bhaji' || item.id === 'pizza-veggie-supreme' || item.id === 'chinese-fried-rice')) {
        return { item, score: -100, reasons };
      }

      // STRICT FILTER: For Fever, Ulcer, Digestion or Mild, exclude spicy curries and street food
      if ((profile.isFever || profile.isDigestion || profile.isMild) &&
          (item.id === 'biryani-hyderabadi' || item.id === 'biryani-ambur' || item.id === 'chaat-pani-puri' || tags.includes('spicy'))) {
        return { item, score: -100, reasons };
      }

      // SCORING:
      if (item.id === 'idli-sambar') {
        score += 50; // Universal light steamed food
        if (profile.isHeart) score += 30;
        if (profile.isElderly) score += 30;
        if (profile.isBp || profile.isLowSalt) score += 25;
        if (profile.isFever || profile.isDigestion) score += 35;
        if (profile.isMild || profile.isLowOil) score += 30;
        if (profile.isBreakfast) score += 20;

        reasons = {
          en: profile.isHeart
            ? 'Steamed, virtually zero-oil rice cakes that are soft, easily digestible, and gentle on cardiovascular health.'
            : profile.isElderly
            ? 'Soft, steamed, and effortless to chew and digest — ideal nutrition for seniors and older adults.'
            : profile.isDiabetes
            ? 'Steamed fermented rice cakes paired with vegetable and lentil sambar for steady nutrient absorption.'
            : 'Soft steamed rice cakes that are very gentle on the digestive system with zero heavy oils.',
          ta: profile.isHeart
            ? 'எண்ணெய் இல்லாத அவித்த மென்மையான இட்லி, இதய நலம் மற்றும் இரத்த அழுத்தத்திற்கு உகந்தது.'
            : profile.isElderly
            ? 'முதியவர்கள் மென்று விழுங்க எளிதான அவித்த உணவு; செரிமானத்திற்கு மிகவும் நல்லது.'
            : 'மென்மையான அவித்த இட்லி, வயிற்றில் எவ்வித அசௌகரியமும் ஏற்படுத்தாது.',
          hi: profile.isHeart
            ? 'भाप में बनी बिना तेल की इडली जो हृदय और रक्तचाप के लिए अत्यंत हल्की और सुरक्षित है।'
            : profile.isElderly
            ? 'बुजुर्गों के लिए आसानी से चबाने और पचने योग्य पौष्टिक भाप का आहार।'
            : 'मुलायम भाप में बनी इडली जो पेट के लिए बहुत सुपाच्य और हल्की है।'
        };
      } else if (item.id === 'chapati-kurma') {
        score += 40;
        if (profile.isDiabetes) score += 45; // Complex carbs & high fiber
        if (profile.isCholesterol) score += 35;
        if (profile.isHeart) score += 25;
        if (profile.isElderly) score += 25;
        if (profile.isDinner || profile.isLunch) score += 20;

        reasons = {
          en: profile.isDiabetes
            ? '100% whole-wheat flatbread with rich complex fiber, helping prevent rapid blood sugar spikes.'
            : profile.isCholesterol
            ? 'Whole-grain fiber helps support healthy lipid levels, served with mild vegetable kurma.'
            : 'Soft whole-wheat chapati rich in complex fiber and nutrients, gentle on digestion.',
          ta: profile.isDiabetes
            ? 'முழு கோதுமை நார்ச்சத்து நிறைந்த சப்பாத்தி, இரத்த சர்க்கரை அளவை சீராக வைக்க உதவுகிறது.'
            : 'நார்ச்சத்து நிறைந்த மென்மையான கோதுமை சப்பாத்தி மற்றும் காய்கறி குருமா.',
          hi: profile.isDiabetes
            ? 'साबुत गेहूं की फाइबर युक्त चपाती, जो ब्लड शुगर को स्थिर रखने में बहुत सहायक है।'
            : 'गेहूं के रेशेदार फाइबर से युक्त सुपाच्य चपाती और हल्की सब्जी।'
        };
      } else if (item.id === 'kerala-appam-stew') {
        score += 35;
        if (profile.isMild) score += 40;
        if (profile.isElderly) score += 30;
        if (profile.isHeart) score += 25;
        if (profile.isDigestion || profile.isFever) score += 30;
        if (profile.isLowOil) score += 20;

        reasons = {
          en: profile.isMild
            ? 'Completely non-spicy vegetable stew made with gentle coconut milk and soft fermented rice appam.'
            : profile.isElderly
            ? 'Delicate soft-textured appam with soothing, mildly spiced vegetable stew suitable for older adults.'
            : 'Gentle, soothing coconut vegetable stew with soft fermented appam; zero pungent spices.',
          ta: 'காரமில்லாத மென்மையான ஆப்பம் மற்றும் காய்கறி ஸ்டூ, செரிமானத்திற்கும் முதியவர்களுக்கும் ஏற்றது.',
          hi: 'बिना मिर्च वाला नारियल दूध का पौष्टिक वेज स्टू और मुलायम आपम जो पेट को शांति देता है।'
        };
      } else if (item.id === 'pongal-ghee') {
        score += 30;
        if (profile.isDigestion || profile.isFever) score += 35;
        if (profile.isElderly) score += 25;
        if (profile.isBreakfast) score += 15;
        // Moderate ghee: if strict low-oil, slight reduction
        if (profile.isLowOil || profile.isCholesterol) score -= 15;

        reasons = {
          en: 'Comforting warm moong dal and rice porridge providing gentle protein and easy digestion.',
          ta: 'பாசிப்பருப்பு மற்றும் அரிசி கலந்த மிதமான சூடான சத்தான வெண் பொங்கல்.',
          hi: 'मूंग दाल और चावल की सुपाच्य खिचड़ी जो शरीर को तुरंत और हल्की ऊर्जा प्रदान करती है।'
        };
      } else if (item.id === 'dosa-plain') {
        score += 25;
        if (profile.isMild) score += 20;
        if (profile.isVegetarian) score += 15;

        reasons = {
          en: 'Light, golden fermented crepe prepared without heavy masala fillings or chili paste.',
          ta: 'மசாலா இல்லாத எளிய மெல்லிய பிளைன் தோசை, எளிதில் செரிக்கக்கூடியது.',
          hi: 'हल्का और सादा पेपर डोसा, बिना तीखे मसालों के।'
        };
      } else if (item.id === 'gujarati-thali') {
        score += 20;
        if (profile.isLunch) score += 25;
        if (profile.isVegetarian) score += 20;
        if (profile.isElderly || profile.isHeart) score += 10;

        reasons = {
          en: 'Wholesome balanced vegetarian meal featuring steamed dhokla, seasonal vegetables, and rotis.',
          ta: 'அவித்த டோக்ளா மற்றும் காய்கறிகளுடன் கூடிய சமச்சீரான முழுமையான சைவ உணவு.',
          hi: 'ढोकला और हरी सब्जियों से भरपूर संतुलित पारंपरिक शाकाहारी थाली।'
        };
      } else if (item.id === 'biryani-veg-paneer') {
        if (profile.isVegetarian && !profile.isElderly && !profile.isHeart && !profile.isFever) {
          score += 15;
          reasons = {
            en: 'Vegetarian rice delicacy with cottage cheese providing natural vegetarian protein.',
            ta: 'பன்னீர் மற்றும் காய்கறிகள் நிறைந்த ஆரோக்கியமான சைவ பிரியாணி.',
            hi: 'पनीर और ताजी सब्जियों से भरपूर शाकाहारी भोजन।'
          };
        } else {
          score = -50;
        }
      }

      return { item, score, reasons };
    });

    // Sort descending by suitability score and pick top 3
    const sorted = candidates
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    // If for any reason no candidates pass, fall back safely to idli and chapati
    const finalItems = sorted.length >= 2 ? sorted : [
      {
        item: INDIAN_FOOD_CATALOG.find(f => f.id === 'idli-sambar')!,
        reasons: {
          en: 'Soft steamed rice cakes that are gentle on digestion with zero heavy spices.',
          ta: 'மென்மையான அவித்த இட்லி, வயிற்றில் எவ்வித அசௌகரியமும் ஏற்படுத்தாது.',
          hi: 'मुलायम भाप में बनी इडली जो पेट के लिए बहुत सुपाच्य और सुरक्षित है।'
        }
      },
      {
        item: INDIAN_FOOD_CATALOG.find(f => f.id === 'kerala-appam-stew')!,
        reasons: {
          en: 'Mild, soothing vegetable stew with soft appam, completely non-spicy.',
          ta: 'காரமில்லாத மென்மையான ஆப்பம் மற்றும் காய்கறி ஸ்டூ.',
          hi: 'बिना मिर्च वाला नारियल दूध का पौष्टिक वेज स्टू और मुलायम आपम।'
        }
      },
      {
        item: INDIAN_FOOD_CATALOG.find(f => f.id === 'chapati-kurma')!,
        reasons: {
          en: 'Soft whole-wheat flatbread rich in dietary fiber and nutrients.',
          ta: 'நார்ச்சத்து நிறைந்த மென்மையான கோதுமை சப்பாத்தி.',
          hi: 'गेहूं के रेशेदार फाइबर से युक्त सुपाच्य चपाती।'
        }
      }
    ];

    const suggestions: HealthFoodSuggestion[] = finalItems.map(c => ({
      foodItem: c.item,
      reasonEn: c.reasons.en,
      reasonTa: c.reasons.ta,
      reasonHi: c.reasons.hi,
      dietaryAttributes: this.deriveDietaryAttributes(c.item)
    }));

    const healthSummary = language === 'ta'
      ? profile.summaryTa
      : language === 'hi'
      ? profile.summaryHi
      : profile.summaryEn;

    return {
      rawTranscript: transcript,
      healthContextSummary: healthSummary,
      targetPerson: profile.targetPerson,
      suggestions,
      disclaimerEn: this.DISCLAIMER_EN,
      disclaimerTa: this.DISCLAIMER_TA,
      disclaimerHi: this.DISCLAIMER_HI,
      detectedAttributes: {
        conditions: [
          ...(profile.isHeart ? ['Heart Patient'] : []),
          ...(profile.isDiabetes ? ['Diabetes'] : []),
          ...(profile.isBp ? ['High Blood Pressure'] : []),
          ...(profile.isCholesterol ? ['High Cholesterol'] : []),
          ...(profile.isFever ? ['Fever'] : []),
          ...(profile.isDigestion ? ['Digestive Sensitivity'] : [])
        ],
        isElderly: profile.isElderly,
        isMild: profile.isMild,
        isLowOil: profile.isLowOil,
        isLowSalt: profile.isLowSalt,
        isVegetarian: profile.isVegetarian,
        isEasilyDigestible: profile.isEasilyDigestible
      }
    };
  }

  /**
   * Derives human-readable badges for a catalog item based on its verified attributes
   */
  public static deriveDietaryAttributes(item: FoodItem): string[] {
    const badges: string[] = [];
    const tags = (item.tags || []).join(' ').toLowerCase();

    if (item.id === 'idli-sambar') {
      badges.push('Steamed', 'Zero-Oil', 'Mild', 'Easily Digestible', 'Vegetarian');
    } else if (item.id === 'chapati-kurma') {
      badges.push('Whole-Wheat', 'High-Fiber', 'Diabetic-Friendly', 'Vegetarian');
    } else if (item.id === 'kerala-appam-stew') {
      badges.push('Non-Spicy', 'Mild', 'Gentle on Stomach', 'Vegetarian');
    } else if (item.id === 'pongal-ghee') {
      badges.push('Moong Dal Porridge', 'Gentle Protein', 'Easily Digestible', 'Vegetarian');
    } else if (item.id === 'dosa-plain') {
      badges.push('Crispy', 'Light', 'Vegetarian');
    } else if (item.id === 'gujarati-thali') {
      badges.push('Balanced Thali', 'Steamed Dhokla', 'Vegetarian');
    } else {
      if (item.isVeg) badges.push('Vegetarian');
      if (tags.includes('steamed')) badges.push('Steamed');
      if (tags.includes('healthy')) badges.push('Healthy');
    }

    return badges;
  }

  /**
   * Resets in-memory cache (useful for testing)
   */
  public static clearCache(): void {
    this.cache.clear();
    this.inFlightRequests.clear();
  }
}
