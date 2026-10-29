import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog.js';
import { FuzzyMatchEngine } from './fuzzyMatchService';

/**
 * Normalizes text for insensitive comparison across English, Tamil, and Hindi
 * - Lowercase
 * - Strips diacritics / unicode accents
 * - Strips punctuation and excessive whitespace
 */
export function normalizeFoodText(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // remove combining diacritics
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // keep unicode letters and numbers, strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generic descriptor words to ignore when scoring restricted items.
 * Only the core dish-name tokens count.
 */
export const GENERIC_DESCRIPTORS: string[] = [
  // English
  'crispy', 'hot', 'special', 'steamed', 'spicy', 'soft', 'fresh', 'plain', 'butter', 'masala',
  // Tamil
  'க்ரிஸ்பி', 'மொறுமொறு', 'சூடான', 'சூடு', 'ஸ்பெஷல்', 'சிறப்பு', 'அவித்த', 'காரமான', 'காரம்', 'மென்மையான', 'மெதுவான', 'புதிய', 'சாதா', 'பிளைன்', 'பட்டர்', 'வெண்ணெய்', 'மசாலா',
  // Hindi
  'क्रिस्पी', 'कुरकुरी', 'कुरकुरा', 'गरम', 'गर्म', 'स्पेशल', 'खास', 'उबला', 'मसालेदार', 'तीखा', 'सॉफ्ट', 'ताज़ा', 'ताजा', 'सादा', 'प्लेन', 'मक्खन', 'बटर', 'मसाला'
];

/**
 * Strips generic descriptor words from a dish name or query to compare only dish-name tokens.
 */
export function stripGenericDescriptors(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let cleaned = normalizeFoodText(text);
  if (!cleaned) return '';

  for (const word of GENERIC_DESCRIPTORS) {
    const normWord = normalizeFoodText(word);
    if (!normWord) continue;
    const regex = new RegExp(`(^|\\s)${normWord.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}($|\\s)`, 'gi');
    cleaned = cleaned.replace(regex, ' ').replace(/\s+/g, ' ').trim();
  }

  return cleaned;
}

/**
 * Comprehensive multilingual transliterations & aliases dictionary for Indian food items
 * Maps food item IDs to all known English, Tamil, Hindi, Tanglish, and Hinglish names.
 */
export const FOOD_TRANSLITERATIONS: Record<string, string[]> = {
  'chole-bhature': [
    'chole bhature', 'punjabi chole bhature', 'chhole bhature', 'chana bhatura', 'chole', 'bhature', 'bhatura', 'chana',
    'சோலே பட்டூரே', 'சோலே', 'பட்டூரே', 'பட்டூரா', 'சென்னா மசாலா',
    'छोले भटूरे', 'छोले', 'भटूरे', 'भटूरा', 'चना भटूरा', 'चना मसाला',
    'soley baturey', 'chhole', 'bhatoore', 'chana bhature'
  ],
  'chaat-pani-puri': [
    'crispy pani puri', 'pani puri', 'chaat pani puri', 'golgappa', 'gol gappa', 'puchka', 'phuchka', 'paani poori', 'panipuri', 'paani puri', 'panipoory', 'pani pury', 'paanipuri',
    'பானி பூரி', 'பானிபூரி', 'பானி', 'பூரி', 'க்ரிஸ்பி பானி பூரி',
    'पानी पूरी', 'पानीपूरी', 'गोलगप्पा', 'गोल गप्पे', 'पुचका', 'फुचका', 'क्रिस्पी पानी पूरी'
  ],
  'dosa-masala': [
    'crispy masala dosa', 'masala dosa', 'masaladosa', 'masala dosai', 'masala dhosa', 'dosa masala',
    'மசாலா தோசை', 'மசாலா தோசா', 'மசால் தோசை', 'தோசை', 'க்ரிஸ்பி மசாலா தோசை',
    'मसाला डोसा', 'मसाला दोसा', 'डोसा', 'क्रिस्पी मसाला डोसा'
  ],
  'dosa-podi': [
    'ghee podi dosa', 'podi dosa', 'ghee dosa', 'ney podi thosai',
    'நெய் பொடி தோசை', 'பொடி தோசை', 'நெய் தோசை',
    'घी पोडी डोसा', 'पोडी डोसा', 'घी डोसा'
  ],
  'dosa-plain': [
    'golden plain paper dosa', 'plain dosa', 'paper dosa', 'sada dosa',
    'பிளைன் தோசை', 'சாதா தோசை', 'பேப்பர் தோசை',
    'प्लेन डोसा', 'सादा डोसा', 'पेपर डोसा'
  ],
  'dosa-rava': [
    'crispy onion rava dosa', 'rava dosa', 'rava masala', 'ravai dosai',
    'ரவா தோசை', 'ரவை தோசை', 'வெங்காய ரவா தோசை',
    'रवा डोसा', 'प्याज रवा डोसा'
  ],
  'idli-sambar': [
    'steamed idli with sambar', 'steamed button sambar idli', 'idli sambar', 'idli', 'idly', 'sambar idli',
    'இட்லி சாம்பார்', 'இட்லி', 'சாம்பார் இட்லி',
    'इडली सांभर', 'इडली', 'सांभर इडली'
  ],
  'medu-vada': [
    'crispy medu vada', 'medu vada', 'vada', 'vadai', 'ulundu vadai',
    'மெது வடை', 'வடை', 'உளுந்து வடை', 'க்ரிஸ்பி மெது வடை',
    'मेदु वड़ा', 'वड़ा', 'उड़द वड़ा', 'मेदू वड़ा', 'क्रिस्पी मेदु वड़ा'
  ],
  'pongal-ghee': [
    'traditional ghee ven pongal', 'ven pongal', 'ghee pongal', 'pongal',
    'வெண் பொங்கல்', 'நெய் பொங்கல்', 'பொங்கல்',
    'घी पोंगल', 'वेन पोंगल', 'पोंगल'
  ],
  'parotta-kothu': [
    'madurai bun parotta with veg salna', 'kothu parotta', 'parotta', 'bun parotta', 'barotta', 'kothu barotta', 'chicken kothu parotta',
    'கொத்து பரோட்டா', 'பரோட்டா', 'பன் பரோட்டா', 'சிக்கன் கொத்து பரோட்டா',
    'कोथू परोटा', 'परोटा', 'बन परोटा', 'चिकन कोथू परोठा'
  ],
  'biryani-hyderabadi': [
    'hyderabadi dum veg biryani', 'hyderabadi chicken dum biryani', 'hyderabadi biryani', 'dum biryani', 'biryani', 'briyani', 'veg biryani',
    'ஹைதராபாத் பிரியாணி', 'பிரியாணி', 'தம் பிரியாணி',
    'हैदराबाद बिरयानी', 'बिरयानी', 'दम बिरयानी'
  ],
  'biryani-ambur': [
    'ambur star chicken biryani', 'ambur mutton biryani', 'ambur biryani', 'star biryani',
    'ஆம்பூர் பிரியாணி', 'பிரியாணி',
    'आम्बुर बिरयानी', 'बिरयानी'
  ],
  'biryani-veg-paneer': [
    'royal paneer dum biryani', 'special paneer veg biryani', 'paneer biryani', 'paneer dum biryani',
    'பன்னீர் பிரியாணி', 'பன்னீர் தம் பிரியாணி',
    'पनीर बिरयानी', 'पनीर दम बिरयानी'
  ],
  'kerala-appam-stew': [
    'kerala appam with veg stew', 'kerala appam', 'appam stew', 'appam',
    'ஆப்பம்', 'கேரளா ஆப்பம்',
    'अप्पम', 'केरल अप्पम'
  ],
  'paneer-butter-masala': [
    'paneer butter masala & naan', 'paneer butter masala and naan', 'paneer butter masala & butter naan',
    'paneer butter masala', 'paneer makhani', 'pbm',
    'பன்னீர் பட்டர் மசாலா', 'பன்னீர் மக்கனி',
    'पनीर बटर मसाला', 'पनीर मखनी'
  ],
  'butter-chicken': [
    'murgh makhani butter chicken', 'butter chicken', 'chicken makhani', 'chicken',
    'பட்டர் சிக்கன்', 'சிக்கன்', 'முர்க் மக்கனி',
    'बटर चिकन', 'चिकन', 'मुर्ग मखनी'
  ],
  'gujarati-thali': [
    'authentic gujarati royal thali', 'gujarati thali', 'thali',
    'குஜராத்தி தாலி', 'தாலி',
    'गुजराती थाली', 'थाली'
  ],
  'pav-bhaji': [
    'mumbai butter pav bhaji', 'pav bhaji', 'butter pav bhaji',
    'பாவ் பாஜி', 'பட்டர் பாவ் பாஜி',
    'पाव भाजी', 'मक्खन पाव भाजी'
  ],
  'pizza-veggie-supreme': [
    'farm fresh veggie supreme pizza', 'cheesy veg supreme pizza', 'veggie pizza', 'pizza',
    'பீட்சா', 'வெஜ் பீட்சா',
    'पिज्जा', 'वेज पिज्जा'
  ],
  'chinese-fried-rice': [
    'schezwan veg fried rice', 'chicken schezwan fried rice', 'fried rice', 'veg fried rice',
    'பிரைடு ரைஸ்', 'வெஜ் பிரைடு ரைஸ்',
    'फ्राइड राइस', 'वेज फ्राइड राइस'
  ],
  'beverage-filter-coffee': [
    'authentic south indian filter coffee', 'kumbakonam degree filter coffee', 'filter coffee', 'coffee',
    'பில்டர் காபி', 'காபி', 'டிகாக்ஷன் காபி',
    'फिल्टर कॉफी', 'कॉफी'
  ],
  'dessert-gulab-jamun': [
    'melt in mouth hot gulab jamun', 'hot shahi gulab jamun', 'gulab jamun', 'jamun', 'shahi gulab jamun',
    'குலாப் ஜாமூன்', 'குலாப் ஜாமுன்', 'ஜாமூன்',
    'गुलाब जामुन', 'जामुन', 'शाही गुलाब जामुन'
  ]
};

/**
 * Resolves a food item query and checks whether it requires nominee approval.
 * 
 * Rules:
 * 1. Undefined or empty ID/query can NEVER match anything.
 * 2. If concrete ID is provided, check exact ID membership in restrictedIds.
 *    If ID not in restricted list -> NOT restricted, no approval request.
 * 3. Spoken / typed / unconfirmed query:
 *    - First resolve to ONE catalog item using normal matcher (>= 0.75).
 *      If resolved and its ID is not restricted -> NOT restricted.
 *    - The 0.40 fuzzy threshold is used ONLY when step 2 could not resolve,
 *      and ONLY if the best-scoring item overall in the catalog is itself a restricted item
 *      (it must beat every non-restricted item).
 * 4. Ignore generic descriptor words and never match on cuisine/tags/restaurant. Only dish tokens count.
 */
export function resolveRestrictedFoodInterception(
  queryOrId: string,
  restrictedIds: string[],
  optionalItemName?: string
): { isRestricted: boolean; matchedItem: any | null; score: number } {
  // 5. Make sure an undefined/empty foodItemId can never match anything in the restricted list
  if (
    !queryOrId ||
    typeof queryOrId !== 'string' ||
    !queryOrId.trim() ||
    queryOrId === 'undefined' ||
    queryOrId === 'null'
  ) {
    return { isRestricted: false, matchedItem: null, score: 0 };
  }

  if (!restrictedIds || !Array.isArray(restrictedIds) || restrictedIds.length === 0) {
    return { isRestricted: false, matchedItem: null, score: 0 };
  }

  const cleanRestrictedIds = restrictedIds
    .filter(id => id && typeof id === 'string' && id.trim() !== '' && id !== 'undefined' && id !== 'null')
    .map(id => id.trim().toLowerCase());

  if (cleanRestrictedIds.length === 0) {
    return { isRestricted: false, matchedItem: null, score: 0 };
  }

  const rawQuery = queryOrId.trim();
  const rawLower = rawQuery.toLowerCase();

  // 1. Direct Catalog ID match
  const directCatalogItem = INDIAN_FOOD_CATALOG.find(f => f.id.toLowerCase() === rawLower);
  if (directCatalogItem) {
    if (cleanRestrictedIds.includes(directCatalogItem.id.toLowerCase())) {
      return { isRestricted: true, matchedItem: directCatalogItem, score: 1.0 };
    }
    // Concrete ID not in restricted list -> NOT restricted!
    return { isRestricted: false, matchedItem: null, score: 0 };
  }

  // Also check if rawQuery directly matches any restricted ID
  if (cleanRestrictedIds.includes(rawLower)) {
    const item = INDIAN_FOOD_CATALOG.find(f => f.id.toLowerCase() === rawLower) || null;
    return { isRestricted: true, matchedItem: item, score: 1.0 };
  }

  // 2. Resolve first, then check by ID:
  // Score query against ALL items in INDIAN_FOOD_CATALOG
  const fullQuery = optionalItemName ? `${rawQuery} ${optionalItemName}` : rawQuery;
  const normQuery = normalizeFoodText(fullQuery);
  const strippedQuery = stripGenericDescriptors(fullQuery) || normQuery;

  let bestCatalogItem: any = null;
  let bestScore = 0;

  for (const food of INDIAN_FOOD_CATALOG) {
    // Only dish-name tokens count: name, nativeNames, and food transliterations.
    // NEVER match on cuisine/category tags, ingredient tags, or restaurant names.
    const aliases = FOOD_TRANSLITERATIONS[food.id.toLowerCase()] || [];
    const candidates = [
      food.name,
      food.nativeNames?.en,
      food.nativeNames?.ta,
      food.nativeNames?.hi,
      ...aliases
    ].filter((x): x is string => Boolean(x));

    let maxItemScore = 0;

    for (const cand of candidates) {
      const normCand = normalizeFoodText(cand);
      if (normQuery === normCand) {
        maxItemScore = 1.0;
        break;
      }

      // Check with stripped generic descriptors (only dish-name tokens count)
      const strippedCand = stripGenericDescriptors(cand) || normCand;
      if (strippedQuery && strippedCand && strippedQuery === strippedCand) {
        maxItemScore = Math.max(maxItemScore, 0.95);
      }

      const scoreStripped = FuzzyMatchEngine.calculateMatchScore(strippedQuery, strippedCand);
      const scoreRaw = FuzzyMatchEngine.calculateMatchScore(normQuery, normCand);
      const score = Math.max(scoreStripped, scoreRaw);

      if (score > maxItemScore) {
        maxItemScore = score;
      }
    }

    if (maxItemScore > bestScore) {
      bestScore = maxItemScore;
      bestCatalogItem = food;
    }
  }

  // Step 2: If normal matcher resolved with >= 0.75:
  if (bestCatalogItem && bestScore >= 0.75) {
    const isRestricted = cleanRestrictedIds.includes(bestCatalogItem.id.toLowerCase());
    return {
      isRestricted,
      matchedItem: isRestricted ? bestCatalogItem : null,
      score: bestScore
    };
  }

  // Step 3: The 0.40 fuzzy threshold may be used ONLY when step 2 could not resolve
  // a catalog item, and only if the best-scoring catalog item overall is
  // itself a restricted item (a restricted item must beat every non-restricted item).
  if (bestCatalogItem && bestScore >= 0.40) {
    const isRestricted = cleanRestrictedIds.includes(bestCatalogItem.id.toLowerCase());
    if (isRestricted) {
      return {
        isRestricted: true,
        matchedItem: bestCatalogItem,
        score: bestScore
      };
    }
  }

  return { isRestricted: false, matchedItem: null, score: bestScore };
}

/**
 * Checks whether an item specified by ID, name, or speech transcript is in the restricted items list.
 * Works across English, Tamil, and Hindi scripts and transliterations.
 */
export function isFoodItemRestricted(
  queryOrId: string,
  restrictedIds: string[],
  optionalItemName?: string
): boolean {
  return resolveRestrictedFoodInterception(queryOrId, restrictedIds, optionalItemName).isRestricted;
}
