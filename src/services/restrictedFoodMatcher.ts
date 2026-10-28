import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog.js';

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
    'pani puri', 'chaat pani puri', 'golgappa', 'gol gappa', 'puchka', 'phuchka', 'paani poori', 'panipuri', 'paani puri',
    'பானி பூரி', 'பானிபூரி', 'பானி', 'பூரி',
    'पानी पूरी', 'पानीपूरी', 'गोलगप्पा', 'गोल गप्पे', 'पुचका', 'फुचका',
    'panipuri', 'golgappe', 'pani-puri', 'puchkas'
  ],
  'dosa-masala': [
    'crispy masala dosa', 'masala dosa', 'masaladosa', 'masala dosai', 'masala dhosa', 'dosa masala',
    'மசாலா தோசை', 'மசாலா தோசா', 'மசால் தோசை', 'தோசை',
    'मसाला डोसा', 'मसाला दोसा', 'डोसा'
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
    'steamed idli with sambar', 'idli sambar', 'idli', 'idly', 'sambar idli',
    'இட்லி சாம்பார்', 'இட்லி', 'சாம்பார் இட்லி',
    'इडली सांभर', 'इडली', 'सांभर इडली'
  ],
  'medu-vada': [
    'crispy medu vada', 'medu vada', 'vada', 'vadai', 'ulundu vadai',
    'மெது வடை', 'வடை', 'உளுந்து வடை',
    'मेदु वड़ा', 'वड़ा', 'उड़द वड़ा'
  ],
  'pongal-ghee': [
    'traditional ghee ven pongal', 'ven pongal', 'ghee pongal', 'pongal',
    'வெண் பொங்கல்', 'நெய் பொங்கல்', 'பொங்கல்',
    'घी पोंगल', 'वेन पोंगल', 'पोंगल'
  ],
  'parotta-kothu': [
    'madurai bun parotta with veg salna', 'kothu parotta', 'parotta', 'bun parotta', 'barotta', 'kothu barotta',
    'கொத்து பரோட்டா', 'பரோட்டா', 'பன் பரோட்டா',
    'कोथू परोटा', 'परोटा', 'बन परोटा'
  ],
  'biryani-hyderabadi': [
    'hyderabadi dum veg biryani', 'hyderabadi biryani', 'dum biryani', 'biryani', 'briyani', 'veg biryani',
    'ஹைதராபாத் பிரியாணி', 'பிரியாணி', 'தம் பிரியாணி',
    'हैदराबाद बिरयानी', 'बिरयानी', 'दम बिरयानी'
  ],
  'biryani-ambur': [
    'ambur star chicken biryani', 'ambur biryani', 'star biryani',
    'ஆம்பூர் பிரியாணி', 'பிரியாணி',
    'आम्बुर बिरयानी', 'बिरयानी'
  ],
  'biryani-veg-paneer': [
    'royal paneer dum biryani', 'paneer biryani', 'paneer dum biryani',
    'பன்னீர் பிரியாணி', 'பன்னீர் தம் பிரியாணி',
    'पनीर बिरयानी', 'पनीर दम बिरयानी'
  ],
  'kerala-appam-stew': [
    'kerala appam with veg stew', 'kerala appam', 'appam stew', 'appam',
    'ஆப்பம்', 'கேரளா ஆப்பம்',
    'अप्पम', 'केरल अप्पम'
  ],
  'paneer-butter-masala': [
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
    'farm fresh veggie supreme pizza', 'veggie pizza', 'pizza',
    'பீட்சா', 'வெஜ் பீட்சா',
    'पिज्जा', 'वेज पिज्जा'
  ],
  'chinese-fried-rice': [
    'schezwan veg fried rice', 'fried rice', 'veg fried rice',
    'பிரைடு ரைஸ்', 'வெஜ் பிரைடு ரைஸ்',
    'फ्राइड राइस', 'वेज फ्राइड राइस'
  ],
  'beverage-filter-coffee': [
    'authentic south indian filter coffee', 'filter coffee', 'coffee',
    'பில்டர் காபி', 'காபி', 'டிகாக்ஷன் காபி',
    'फिल्टर कॉफी', 'कॉफी'
  ],
  'dessert-gulab-jamun': [
    'melt in mouth hot gulab jamun', 'gulab jamun', 'jamun',
    'குலாப் ஜாமூன்', 'ஜாமூன்',
    'गुलाब जामुन', 'जामुन'
  ]
};

/**
 * Checks whether an item specified by ID, name, or speech transcript is in the restricted items list.
 * Works across English, Tamil, and Hindi scripts and transliterations.
 */
export function isFoodItemRestricted(
  queryOrId: string,
  restrictedIds: string[]
): boolean {
  if (!queryOrId || !restrictedIds || restrictedIds.length === 0) return false;

  const rawQuery = String(queryOrId).trim();
  const normalizedQuery = normalizeFoodText(rawQuery);
  if (!normalizedQuery) return false;

  // 1. Direct ID match
  if (restrictedIds.includes(rawQuery) || restrictedIds.includes(normalizedQuery)) {
    return true;
  }

  // 2. Check each restricted ID against catalog item and transliterations
  for (const restrictedId of restrictedIds) {
    if (!restrictedId) continue;
    const cleanRestrictedId = String(restrictedId).trim().toLowerCase();

    // Check direct ID similarity
    if (cleanRestrictedId === normalizedQuery || normalizedQuery.includes(cleanRestrictedId)) {
      return true;
    }

    // Look up in transliterations dictionary
    const aliases = FOOD_TRANSLITERATIONS[cleanRestrictedId] || [];
    for (const alias of aliases) {
      const normAlias = normalizeFoodText(alias);
      if (!normAlias) continue;

      if (
        normalizedQuery === normAlias ||
        normalizedQuery.includes(normAlias) ||
        normAlias.includes(normalizedQuery)
      ) {
        return true;
      }
    }

    // Look up in catalog
    const catalogItem = INDIAN_FOOD_CATALOG.find(f => f.id === cleanRestrictedId);
    if (catalogItem) {
      const itemNames = [
        catalogItem.name,
        catalogItem.nativeNames?.en,
        catalogItem.nativeNames?.ta,
        catalogItem.nativeNames?.hi,
        ...(catalogItem.tags || [])
      ].filter(Boolean);

      for (const name of itemNames) {
        const normName = normalizeFoodText(name as string);
        if (!normName) continue;

        if (
          normalizedQuery === normName ||
          normalizedQuery.includes(normName) ||
          normName.includes(normalizedQuery)
        ) {
          return true;
        }
      }
    }
  }

  return false;
}
