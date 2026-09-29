import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { FoodItem, Language, ScheduleDuration } from '../types';

import { PriceComparisonSummary, PriceComparisonService } from './priceComparisonService';

export interface ParsedItem {
  foodItem: FoodItem;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ParsedOrderBill {
  restaurantName: string;
  items: ParsedItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  totalGst: number;
  deliveryFee: number;
  platformFee: number;
  grandTotal: number;
  deliveryAddress: string;
  etaMinutes: number;
  rawTranscript: string;
  priceComparison?: PriceComparisonSummary;
}

export class NLPParserService {
  /**
   * Multilingual Quantity Extraction Map (EN, Tanglish, Tamil, Hindi)
   */
  private static quantityMap: { [key: string]: number } = {
    // Tamil & Tanglish
    'oru': 1, 'onnu': 1, 'ஒன்று': 1, 'ஒரு': 1, 'ஒன்னு': 1,
    'rendu': 2, 'rendudosa': 2, 'இரண்டு': 2, 'ரெண்டு': 2,
    'moonu': 3, 'மூன்று': 3, 'மூணு': 3,
    'naalu': 4, 'நான்கு': 4, 'நாளு': 4,
    'anju': 5, 'ஐந்து': 5, 'அஞ்சு': 5,
    'aaru': 6, 'ஆறு': 6,

    // English
    'one': 1, 'single': 1, '1': 1,
    'two': 2, 'double': 2, '2': 2, 'couple': 2,
    'three': 3, '3': 3, 'triple': 3,
    'four': 4, '4': 4,
    'five': 5, '5': 5,
    'six': 6, '6': 6,

    // Hindi
    'ek': 1, 'एक': 1,
    'do': 2, 'दो': 2,
    'teen': 3, 'तीन': 3,
    'chaar': 4, 'चार': 4,
    'paanch': 5, 'पांच': 5,
    'chah': 6, 'छह': 6
  };

  /**
   * Restaurant Synonym Detection Map (Tamil, Tanglish, Hindi, English)
   */
  private static restaurantKeywords: { [key: string]: string } = {
    'saravana': 'Saravana Bhavan',
    'சரவண': 'Saravana Bhavan',
    'சரவண பவன்': 'Saravana Bhavan',
    'சரவண பவன்ல': 'Saravana Bhavan',
    'சரவண பவனில்': 'Saravana Bhavan',
    'saravana bhavan': 'Saravana Bhavan',
    'murugan': 'Murugan Idli Shop',
    'முருகன்': 'Murugan Idli Shop',
    'முருகன் இட்லி': 'Murugan Idli Shop',
    'a2b': 'A2B Adyar Ananda Bhavan',
    'adyar ananda': 'A2B Adyar Ananda Bhavan',
    'அடையார்': 'A2B Adyar Ananda Bhavan',
    'bawarchi': 'Bawarchi Biryani',
    'பவாச்சி': 'Bawarchi Biryani',
    'dominos': 'Dominos Pizza',
    'டோமினோஸ்': 'Dominos Pizza',
    'sangeetha': 'Sangeetha Veg Restaurant',
    'சங்கீதா': 'Sangeetha Veg Restaurant',
    'madurai mess': 'Madurai Mess',
    'மதுரை மெஸ்': 'Madurai Mess',
    'kumbakonam': 'Kumbakonam Degree Coffee',
    'கும்பகோணம்': 'Kumbakonam Degree Coffee'
  };

  /**
   * Food Keyword to Catalog Item ID mapping
   */
  private static foodKeywordMap: { keywords: string[]; itemId: string }[] = [
    { keywords: ['masala dosa', 'மசாலா தோசை', 'மசாலா தோச', 'மசாலா தோசை வேணும்', 'मसाला डोसा'], itemId: 'dosa-masala' },
    { keywords: ['podi dosa', 'ghee podi dosa', 'பொடி தோசை', 'நெய் தோசை'], itemId: 'dosa-podi' },
    { keywords: ['plain dosa', 'paper dosa', 'பிளைன் தோசை'], itemId: 'dosa-plain' },
    { keywords: ['rava dosa', 'ரவா தோசை'], itemId: 'dosa-rava' },
    { keywords: ['dosa', 'dosai', 'தோசை', 'தோச', 'தோசை வேணும்', 'डोसा'], itemId: 'dosa-masala' },
    { keywords: ['idli', 'idly', 'இட்லி', 'இட்லி வேணும்', 'इडली', 'sambar idli'], itemId: 'idli-sambar' },
    { keywords: ['vada', 'vadai', 'வடை', 'வடை வேணும்', 'வड़ा'], itemId: 'medu-vada' },
    { keywords: ['pongal', 'பொங்கல்', 'பொங்கல் வேணும்', 'पोंगल'], itemId: 'pongal-ghee' },
    { keywords: ['kothu parotta', 'கொத்து பரோட்டா'], itemId: 'parotta-kothu' },
    { keywords: ['parotta', 'பரோட்டா', 'பரோடா', 'परोटा'], itemId: 'parotta-kothu' },
    { keywords: ['ambur biryani', 'mutton biryani', 'ஆம்பூர் பிரியாணி', 'மட்டன் பிரியாணி'], itemId: 'biryani-ambur' },
    { keywords: ['paneer biryani', 'veg biryani', 'பன்னீர் பிரியாணி'], itemId: 'biryani-veg-paneer' },
    { keywords: [
      'biryani', 'biyani', 'biriyani', 'briyani',
      'பிரியாணி', 'பிரியானி', 'பிரீயாணி', 'சிக்கன் பிரியாணி', 'ஹைதராபாத் பிரியாணி',
      'பிரியாணி வேணும்', 'பிரியானி வேணும்', 'பிரியாணி பார்சல்', 'biryani order', 'briyani order', 'biriyani order',
      'बिरयानी', 'चिकन बिरयानी'
    ], itemId: 'biryani-hyderabadi' },
    { keywords: ['coffee', 'kaapi', 'காபி', 'कॉफी'], itemId: 'beverage-filter-coffee' },
    { keywords: ['pizza', 'பீட்சா', 'पिज्जा'], itemId: 'pizza-veggie-supreme' },
    { keywords: ['paneer', 'பன்னீர்', 'पनीर'], itemId: 'paneer-butter-masala' },
    { keywords: ['chole', 'bhature', 'சோலே', 'छोले'], itemId: 'chole-bhature' },
    { keywords: ['fried rice', 'rice', 'ரைஸ்', 'फ्राइड राइस'], itemId: 'chinese-fried-rice' },
    { keywords: ['gulab jamun', 'jamun', 'ஜாமூன்', 'गुलाब जामुन'], itemId: 'dessert-gulab-jamun' }
  ];

  /**
   * Detect Intent from voice transcript (schedule vs order vs search)
   */
  public static detectIntent(transcript: string): 'schedule' | 'order' | 'search' {
    if (!transcript) return 'order';
    const lower = transcript.toLowerCase().trim();

    // Schedule intent keywords & recurrence patterns (Tanglish, Tamil, English, Hindi)
    const scheduleKeywords = [
      'schedule', 'scheduled', 'slot', 'shdule', 'schedul',
      'daily', 'everyday', 'every day', 'every week', 'for 1 month', 'for 1 week', 'for 3 months',
      'oru masathuku', '1 masathuku', 'oru maasathuku', '1 maasathuku', 'masathuku', 'maasathuku', 'daily vum',
      'schedule pannu', 'schedule pannunga', 'schedule pannanum', 'schedule pannidu', 'schedule podu', 'schedule panu',
      'order potru', 'schedule potru', 'slot potru', 'potru', 'potturu', 'pottru',
      'தினமும்', 'திட்டமிடு', 'செட் பண்ணு', 'செட் செய்', 'ஷெட்யூல்', 'ஷெட்யூல் பண்ணு',
      'शेड्यूल', 'शेड्यूल करो', 'हर रोज', 'प्रतिदिन', 'बाद में'
    ];

    if (scheduleKeywords.some(kw => lower.includes(kw))) {
      return 'schedule';
    }

    // Also if specific time pattern like "ettu maniku", "9 am", "8:00" is mentioned, treat as schedule
    if (/\b(\d{1,2}|ஒன்பது|எட்டு|ஏழு|ஆறு|ஐந்து|நான்கு|மூன்று|இரண்டு|ஒன்று|ettu|onpadhu|ezhu|aaru|anju|naalu|moonu|rendu|onnu)\s*(maniku|mani|am|pm|மணி|மணிக்கு|बजे)\b/i.test(lower)) {
      return 'schedule';
    }

    // Order intent keywords (Tanglish, Tamil, English, Hindi)
    const orderKeywords = [
      'order', 'order now', 'order pannu', 'order pannunga', 'order pannanum', 'order pannidu', 'order podu',
      'kudunga', 'kudu', 'taanga', 'thanga', 'vaangu', 'anuppu', 'ipovae', 'ipove',
      'ஆர்டர்', 'ஆர்டர் பண்ணு', 'ஆர்டர் செய்', 'ஆர்டர் பண்ணுங்க', 'கொடுங்க', 'தாங்க', 'வாங்கு', 'அனுப்பு', 'இப்போதே', 'இப்போ',
      'ऑर्डर', 'ऑर्डर करो', 'अभी', 'लाओ', 'दो'
    ];

    if (orderKeywords.some(kw => lower.includes(kw))) {
      return 'order';
    }

    return 'search';
  }

  /**
   * Main NLP Parser Algorithm: Parses natural language sentence into structured GST Bill
   */
  public static parseNaturalLanguageOrder(
    transcript: string,
    deliveryAddress: string = 'Anna Nagar 2nd Avenue, Chennai'
  ): ParsedOrderBill | null {
    if (!transcript || !transcript.trim()) return null;

    const raw = transcript.toLowerCase().trim();
    console.log('[NLPParserService]: Parsing natural language command ->', raw);

    // 1. Detect Specified Restaurant Name
    let detectedRestaurant = '';
    for (const [kw, restName] of Object.entries(this.restaurantKeywords)) {
      if (raw.includes(kw)) {
        detectedRestaurant = restName;
        break;
      }
    }

    // 2. Multi-Item Tokenizer & Slang Quantity Extractor
    const parsedItems: ParsedItem[] = [];

    // Helper: Find preceding quantity word or digit before a matched keyword index
    const extractQuantityBeforeIndex = (text: string, kwIndex: number): number => {
      const textBefore = text.substring(0, kwIndex).trim();
      const words = textBefore.split(/\s+/).slice(-3); // Check up to 3 words before item

      for (let i = words.length - 1; i >= 0; i--) {
        const w = words[i].replace(/[^a-z0-9அ-ஹ]/gi, '');
        if (this.quantityMap[w] !== undefined) {
          return this.quantityMap[w];
        }
        const num = parseInt(w, 10);
        if (!isNaN(num) && num > 0 && num <= 20) {
          return num;
        }
      }
      return 1;
    };

    // Iterate through food keyword map to find ALL items mentioned in sentence
    for (const entry of this.foodKeywordMap) {
      for (const kw of entry.keywords) {
        const kwIndex = raw.indexOf(kw);
        if (kwIndex !== -1) {
          const foundItem = INDIAN_FOOD_CATALOG.find(f => f.id === entry.itemId);
          if (foundItem) {
            const qty = extractQuantityBeforeIndex(raw, kwIndex);
            const existingIdx = parsedItems.findIndex(p => p.foodItem.id === foundItem.id);
            
            if (existingIdx !== -1) {
              // Item already found; update quantity if larger
              parsedItems[existingIdx].quantity = Math.max(parsedItems[existingIdx].quantity, qty);
              parsedItems[existingIdx].totalPrice = parsedItems[existingIdx].quantity * parsedItems[existingIdx].unitPrice;
            } else {
              const unitPrice = foundItem.basePrice || 100;
              parsedItems.push({
                foodItem: foundItem,
                quantity: qty,
                unitPrice,
                totalPrice: unitPrice * qty
              });
            }
            break; // Stop checking other synonyms for this entry
          }
        }
      }
    }

    // Fallback: Segment-based parsing if primary extraction yielded 0 items
    if (parsedItems.length === 0) {
      const segments = raw.split(/and|மற்றும்|அப்புறம்|,|\+/g);

      segments.forEach(segment => {
        const segText = segment.trim();
        if (!segText) return;

        let qty = 1;
        const words = segText.split(/\s+/);
        for (const word of words) {
          const cleanW = word.replace(/[^a-z0-9அ-ஹ]/gi, '');
          if (this.quantityMap[cleanW] !== undefined) {
            qty = this.quantityMap[cleanW];
            break;
          }
          const parsedNum = parseInt(cleanW, 10);
          if (!isNaN(parsedNum) && parsedNum > 0 && parsedNum <= 20) {
            qty = parsedNum;
            break;
          }
        }

        let matchedItem: FoodItem | null = null;
        for (const entry of this.foodKeywordMap) {
          if (entry.keywords.some(kw => segText.includes(kw))) {
            const found = INDIAN_FOOD_CATALOG.find(f => f.id === entry.itemId);
            if (found) {
              matchedItem = found;
              break;
            }
          }
        }

        if (matchedItem) {
          const existingIdx = parsedItems.findIndex(p => p.foodItem.id === matchedItem!.id);
          if (existingIdx !== -1) {
            parsedItems[existingIdx].quantity += qty;
            parsedItems[existingIdx].totalPrice = parsedItems[existingIdx].quantity * parsedItems[existingIdx].unitPrice;
          } else {
            const unitPrice = matchedItem.basePrice || 100;
            parsedItems.push({
              foodItem: matchedItem,
              quantity: qty,
              unitPrice,
              totalPrice: unitPrice * qty
            });
          }
        }
      });
    }

    if (parsedItems.length === 0) {
      console.warn('[NLPParserService]: No catalog food items recognized from transcript.');
      return null;
    }

    // Assign detected or default restaurant
    const finalRestaurant = detectedRestaurant || parsedItems[0].foodItem.restaurant || 'Hotel Saravana Bhavan';

    // 3. Compute GST Bill Tax Invoice Totals
    const subtotal = parsedItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const cgst = parseFloat((subtotal * 0.025).toFixed(2)); // 2.5% CGST
    const sgst = parseFloat((subtotal * 0.025).toFixed(2)); // 2.5% SGST
    const totalGst = parseFloat((cgst + sgst).toFixed(2));  // 5% Total GST
    const deliveryFee = 25.00;
    const platformFee = 5.00;
    const grandTotal = Math.round(subtotal + totalGst + deliveryFee + platformFee);

    const priceComparison = parsedItems[0]?.foodItem?.platforms?.length 
      ? PriceComparisonService.compare(parsedItems[0].foodItem.platforms) 
      : undefined;

    const bill: ParsedOrderBill = {
      restaurantName: finalRestaurant,
      items: parsedItems,
      subtotal,
      cgst,
      sgst,
      totalGst,
      deliveryFee,
      platformFee,
      grandTotal,
      deliveryAddress,
      etaMinutes: 25,
      rawTranscript: transcript,
      priceComparison
    };

    console.log('[NLPParserService Success]: Bill Generated ->', bill);
    return bill;
  }

  /**
   * Voice Schedule Duration & Date Range Extractor (multilingual: EN, Tanglish, Tamil, Hindi)
   */
  public static parseScheduleDetailsFromVoice(transcript: string): {
    frequency: 'daily' | 'weekly' | 'once';
    duration: ScheduleDuration;
    durationMentioned: boolean;
    startDate: string;
    customEndDate?: string;
    durationLabel: string;
    isEveryDay?: boolean;
    selectedDays?: string[];
  } {
    const text = (transcript || '').toLowerCase();

    const getTodayStr = (): string => {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const getTomorrowStr = (): string => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const yyyy = tomorrow.getFullYear();
      const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const dd = String(tomorrow.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    // 1. Frequency
    let frequency: 'daily' | 'weekly' | 'once' = 'daily';
    if (text.includes('weekly') || text.includes('every week') || text.includes('வாரம் ஒரு முறை') || text.includes('ஹफ्ते')) {
      frequency = 'weekly';
    } else if (text.includes('once') || text.includes('one time') || text.includes('ஒரு முறை') || text.includes('एक बार')) {
      frequency = 'once';
    }

    // 2. Start Date
    let startDate = getTodayStr();
    if (text.includes('tomorrow') || text.includes('நாளை') || text.includes('நாளைக்கு') || text.includes('कल')) {
      startDate = getTomorrowStr();
    }

    // 3. Duration & Custom Date Range Parsing (1 Month, 2 Months, 3 Months, 30/60/90 Days, Indefinite, Custom)
    let duration: ScheduleDuration = '1_week'; // Default to 1_week fallback per spec
    let durationMentioned = false;

    // Indefinite / Until Cancelled
    if (
      text.includes('until i cancel') ||
      text.includes('until cancel') ||
      text.includes('indefinite') ||
      text.includes('always') ||
      text.includes('continuously') ||
      text.includes('தொடர்ந்து') ||
      text.includes('நிறுத்தும் வரை') ||
      text.includes('जब तक') ||
      text.includes('हमेशा')
    ) {
      duration = 'indefinite';
      durationMentioned = true;
    }
    // 3 Months / 90 Days / More than 2 Months
    else if (
      text.includes('3 month') ||
      text.includes('3 months') ||
      text.includes('three month') ||
      text.includes('three months') ||
      text.includes('90 days') ||
      text.includes('next 90 days') ||
      text.includes('3 மாதம்') ||
      text.includes('3 மாசம்') ||
      text.includes('3 மாதங்கள்') ||
      text.includes('90 நாட்கள்') ||
      text.includes('3 महीने') ||
      text.includes('90 दिन')
    ) {
      duration = '3_months';
      durationMentioned = true;
    }
    // 1 Month / 2 Months / 30 Days / 60 Days / More than a Month
    else if (
      text.includes('1 month') ||
      text.includes('a month') ||
      text.includes('one month') ||
      text.includes('2 month') ||
      text.includes('2 months') ||
      text.includes('two month') ||
      text.includes('two months') ||
      text.includes('30 days') ||
      text.includes('60 days') ||
      text.includes('next 30 days') ||
      text.includes('next 60 days') ||
      text.includes('more than a month') ||
      text.includes('more than 1 month') ||
      text.includes('over a month') ||
      text.includes('1 மாதம்') ||
      text.includes('ஒரு மாதம்') ||
      text.includes('ஒரு மாசம்') ||
      text.includes('1 மாசம்') ||
      text.includes('2 மாதம்') ||
      text.includes('2 மாசம்') ||
      text.includes('30 நாட்கள்') ||
      text.includes('60 நாட்கள்') ||
      text.includes('1 month ku') ||
      text.includes('1 maasam') ||
      text.includes('1 masam') ||
      text.includes('oru masathuku') ||
      text.includes('oru maasathuku') ||
      text.includes('1 masathuku') ||
      text.includes('1 maasathuku') ||
      text.includes('masathuku') ||
      text.includes('maasathuku') ||
      text.includes('1 மாதத்திற்கும் மேல்') ||
      text.includes('1 महीने') ||
      text.includes('2 महीने') ||
      text.includes('30 दिन') ||
      text.includes('60 दिन') ||
      text.includes('1 महीने से अधिक')
    ) {
      duration = '1_month';
      durationMentioned = true;
    }
    // Today alone / 1 Day / Today Only
    if (
      text.includes('today alone') ||
      text.includes('today only') ||
      text.includes('just today') ||
      text.includes('1 day') ||
      text.includes('one day') ||
      text.includes('for today') ||
      text.includes('இன்று மட்டும்') ||
      text.includes('இன்னைக்கு மட்டும்') ||
      text.includes('ஒரு நாள்') ||
      text.includes('இன்று') ||
      text.includes('केवल आज') ||
      text.includes('आज ही') ||
      text.includes('आज बस') ||
      text.includes('एक दिन')
    ) {
      duration = 'today_only';
      durationMentioned = true;
    }
    // 1 Week / 7 Days
    else if (
      text.includes('1 week') ||
      text.includes('a week') ||
      text.includes('one week') ||
      text.includes('7 days') ||
      text.includes('for a week') ||
      text.includes('1 வாரம்') ||
      text.includes('ஒரு வாரம்') ||
      text.includes('7 நாட்கள்') ||
      text.includes('1 haftah') ||
      text.includes('1 सप्ताह') ||
      text.includes('1 हफ्ते') ||
      text.includes('7 दिन') ||
      text.includes('2 weeks')
    ) {
      duration = '1_week';
      durationMentioned = true;
    }

    // Custom date range phrasing check (e.g. "from October 1st to October 31st")
    if (text.includes('from') && (text.includes('to') || text.includes('until') || text.includes('for'))) {
      if (!durationMentioned) {
        duration = 'custom';
        durationMentioned = true;
      }
    }

    let durationLabel = '1 Week';
    if (duration === 'today_only') durationLabel = 'Today alone (1 Day)';
    if (duration === '1_month') durationLabel = '1 Month';
    if (duration === '3_months') durationLabel = '3 Months';
    if (duration === 'indefinite') durationLabel = 'Until Cancelled';
    if (duration === 'custom') durationLabel = 'Custom Date Range';

    // 4. Days / Frequency Extraction (Every Day vs Specific Days)
    let isEveryDay = true;
    let selectedDays: string[] = [];

    if (
      text.includes('daily') ||
      text.includes('daily vum') ||
      text.includes('dailyum') ||
      text.includes('everyday') ||
      text.includes('every day') ||
      text.includes('தினமும்') ||
      text.includes('நாளிதோறும்') ||
      text.includes('हर रोज') ||
      text.includes('प्रतिदिन')
    ) {
      isEveryDay = true;
      selectedDays = [];
    } else {
      const dayMatches: string[] = [];
      if (text.includes('mon') || text.includes('திங்கள்')) dayMatches.push('Mon');
      if (text.includes('tue') || text.includes('செவ்வாய்')) dayMatches.push('Tue');
      if (text.includes('wed') || text.includes('புதன்')) dayMatches.push('Wed');
      if (text.includes('thu') || text.includes('வியாழன்')) dayMatches.push('Thu');
      if (text.includes('fri') || text.includes('வெள்ளி')) dayMatches.push('Fri');
      if (text.includes('sat') || text.includes('சனி')) dayMatches.push('Sat');
      if (text.includes('sun') || text.includes('ஞாயிறு')) dayMatches.push('Sun');

      if (dayMatches.length > 0) {
        isEveryDay = false;
        selectedDays = dayMatches;
      }
    }

    return {
      frequency,
      duration,
      durationMentioned,
      startDate,
      durationLabel,
      isEveryDay,
      selectedDays
    };
  }
}

