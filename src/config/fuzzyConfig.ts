/**
 * Configuration & Threshold Settings for Unified Fuzzy Matching Engine
 */
export interface FuzzyThresholdConfig {
  highConfidence: number;      // >= 0.75: Auto-proceed
  mediumConfidence: number;    // 0.45 - 0.74: Ask "Did you mean {item}?" with top 3 buttons
  restrictedThreshold: number; // Stricter threshold for restricted food checks (>= 0.40)
}

export const FUZZY_CONFIG: FuzzyThresholdConfig = {
  highConfidence: 0.75,
  mediumConfidence: 0.45,
  restrictedThreshold: 0.40
};

/**
 * Canonical Alias Dictionary mapping food items to cross-script & phonetic variants
 */
export interface CanonicalItemAlias {
  id: string;
  canonicalName: string;
  nativeNames: {
    en: string;
    ta: string;
    hi: string;
  };
  aliases: string[];
}

export const CANONICAL_FOOD_ALIASES: CanonicalItemAlias[] = [
  {
    id: 'dosa-masala',
    canonicalName: 'Crispy Masala Dosa',
    nativeNames: {
      en: 'Crispy Masala Dosa',
      ta: 'மொறுமொறு மசாலா தோசை',
      hi: 'क्रिस्पी मसाला डोसा'
    },
    aliases: [
      'dosa', 'dosai', 'dhosai', 'dosaa', 'dosha', 'dosah', 'doser', 'thosai', 'masala dosa', 'crispy masala dosa',
      'தோசை', 'மசாலா தோசை', 'மொறுமொறு தோசை', 'டோசை',
      'डोसा', 'मसाला डोसा', 'डोशा'
    ]
  },
  {
    id: 'dosa-podi',
    canonicalName: 'Ghee Podi Dosa',
    nativeNames: {
      en: 'Ghee Podi Dosa',
      ta: 'நெய் பொடி தோசை',
      hi: 'घी पोडी डोसा'
    },
    aliases: [
      'podi dosa', 'ghee podi dosa', 'podi dosai', 'ghee podi dosai',
      'பொடி தோசை', 'நெய் பொடி தோசை', 'நெய் தோசை',
      'पोडी डोसा', 'घी पोडी डोसा'
    ]
  },
  {
    id: 'dosa-plain',
    canonicalName: 'Golden Plain Paper Dosa',
    nativeNames: {
      en: 'Golden Plain Paper Dosa',
      ta: 'தங்க நிற பிளைன் பேப்பர் தோசை',
      hi: 'गोल्डन प्लेन पेपर डोसा'
    },
    aliases: [
      'plain dosa', 'paper dosa', 'plain paper dosa', 'golden dosa',
      'பிளைன் தோசை', 'பேப்பர் தோசை', 'சாதாரண தோசை',
      'प्लेन डोसा', 'पेपर डोसा'
    ]
  },
  {
    id: 'dosa-rava',
    canonicalName: 'Onion Rava Dosa',
    nativeNames: {
      en: 'Onion Rava Dosa',
      ta: 'வெங்காய ரவா தோசை',
      hi: 'प्याज रवा डोसा'
    },
    aliases: [
      'rava dosa', 'onion rava dosa', 'rava dosai', 'onion rava',
      'ரவா தோசை', 'வெங்காய ரவா தோசை',
      'रवा डोसा', 'प्याज रवा डोसा'
    ]
  },
  {
    id: 'idli-sambar',
    canonicalName: 'Steamed Button Sambar Idli',
    nativeNames: {
      en: 'Steamed Button Sambar Idli',
      ta: 'நெய் சாம்பார் இட்லி',
      hi: 'स्टीम्ड बटन सांभर इडली'
    },
    aliases: [
      'idli', 'idly', 'iddli', 'italy', 'eatly', 'itli', 'edli', 'it lee', 'idlee', 'idles', 'sambar idli', 'button idli',
      'இட்லி', 'இட்டலி', 'சாம்பார் இட்லி', 'நெய் இட்லி', 'இட்டிலி',
      'इडली', 'सांभर इडली', 'घी इडली'
    ]
  },
  {
    id: 'medu-vada',
    canonicalName: 'Crispy Medu Vada (2 pcs)',
    nativeNames: {
      en: 'Crispy Medu Vada (2 pcs)',
      ta: 'மொறுமொறு மெது வடை (2)',
      hi: 'क्रिस्पी मेदू वड़ा (2)'
    },
    aliases: [
      'vada', 'vadai', 'medu vada', 'medu vadai', 'wada', 'vade', 'crispy vada',
      'வடை', 'மெது வடை', 'உளுந்து வடை',
      'वड़ा', 'मेदू वड़ा'
    ]
  },
  {
    id: 'pongal-ghee',
    canonicalName: 'Ven Pongal with Vadai',
    nativeNames: {
      en: 'Ven Pongal with Vadai',
      ta: 'நெய் வெண் பொங்கல் வடை',
      hi: 'घी वेन पोंगल वड़ा'
    },
    aliases: [
      'pongal', 'ven pongal', 'ghee pongal', 'pongall', 'pongal vadai',
      'பொங்கல்', 'வெண் பொங்கல்', 'நெய் பொங்கல்',
      'पोंगल', 'वेन पोंगल', 'घी पोंगल'
    ]
  },
  {
    id: 'chapati-kurma',
    canonicalName: 'Soft Whole Wheat Chapati with Kurma',
    nativeNames: {
      en: 'Soft Whole Wheat Chapati with Kurma',
      ta: 'சப்பாத்தி குருமா',
      hi: 'चपाती और कुर्मा'
    },
    aliases: [
      'chapati', 'chappathi', 'chappati', 'chapathi', 'roti', 'phulka', 'chapatti', 'chapathi kurma', 'wheat chapati',
      'சப்பாத்தி', 'சப்பாத்தி குருமா', 'ரொட்டி',
      'चपाती', 'रोटी', 'फुल्का', 'कुर्मा'
    ]
  },
  {
    id: 'parotta-kothu',
    canonicalName: 'Chicken Kothu Parotta',
    nativeNames: {
      en: 'Chicken Kothu Parotta',
      ta: 'சிக்கன் கொத்து பரோட்டா',
      hi: 'चिकन कोथू परोटा'
    },
    aliases: [
      'parotta', 'parota', 'barota', 'parrota', 'parrotta', 'paratha', 'porotta', 'porota',
      'chicken kothu parotta', 'kothu parotta', 'kothu parota', 'chilli parotta',
      'பரோட்டா', 'பரோடா', 'பரட்டா', 'பொரோட்டா', 'கொத்து பரோட்டா', 'சிக்கன் கொத்து',
      'परोटा', 'परोठा', 'पराठा', 'कोथू परोटा'
    ]
  },
  {
    id: 'biryani-hyderabadi',
    canonicalName: 'Hyderabadi Chicken Dum Biryani',
    nativeNames: {
      en: 'Hyderabadi Chicken Dum Biryani',
      ta: 'ஹைதராபாத் சிக்கன் தம் பிரியாணி',
      hi: 'हैदराबादी चिकन दम बिरयानी'
    },
    aliases: [
      'biryani', 'biriyani', 'birani', 'beer yani', 'berryani', 'chicken biryani', 'dum biryani', 'briyani', 'hyderabadi biryani',
      'பிரியாணி', 'சிக்கன் பிரியாணி', 'ஹைதராபாத் பிரியாணி', 'பிரியானி',
      'बिरयानी', 'चिकन बिरयानी', 'दम बिरयानी'
    ]
  },
  {
    id: 'biryani-ambur',
    canonicalName: 'Ambur Mutton Biryani',
    nativeNames: {
      en: 'Ambur Mutton Biryani',
      ta: 'ஆம்பூர் மட்டன் பிரியாணி',
      hi: 'आंबूर मटन बिरयानी'
    },
    aliases: [
      'ambur biryani', 'mutton biryani', 'ambur mutton biryani',
      'ஆம்பூர் பிரியாணி', 'மட்டன் பிரியாணி', 'ஆம்பூர் மட்டன்',
      'आंबूर बिरयानी', 'मटन बिरयानी'
    ]
  },
  {
    id: 'biryani-veg-paneer',
    canonicalName: 'Special Paneer Veg Biryani',
    nativeNames: {
      en: 'Special Paneer Veg Biryani',
      ta: 'பன்னீர் வெஜ் பிரியாணி',
      hi: 'पनीर वेज बिरयानी'
    },
    aliases: [
      'veg biryani', 'paneer biryani', 'vegetable biryani', 'paneer veg biryani',
      'வெஜ் பிரியாணி', 'பன்னீர் பிரியாணி', 'காய்கறி பிரியாணி',
      'वेज बिरयानी', 'पनीर बिरयानी'
    ]
  },
  {
    id: 'kerala-appam-stew',
    canonicalName: 'Kerala Appam with Veg Stew',
    nativeNames: {
      en: 'Kerala Appam with Veg Stew',
      ta: 'கேரளா ஆப்பம் வெஜ் ஸ்டூ',
      hi: 'केरल अप्पम वेज स्टू'
    },
    aliases: [
      'appam', 'kerala appam', 'stew', 'appam stew', 'veg stew',
      'ஆப்பம்', 'அப்‌பம்', 'அப்பம்', 'ஆப்பம் ஸ்டூ',
      'अप्पम', 'वेज स्टू'
    ]
  },
  {
    id: 'paneer-butter-masala',
    canonicalName: 'Paneer Butter Masala & Butter Naan',
    nativeNames: {
      en: 'Paneer Butter Masala & Butter Naan',
      ta: 'பன்னீர் பட்டர் மசாலா நான்',
      hi: 'पनीर बटर मसाला बटर नान'
    },
    aliases: [
      'paneer', 'paneer butter masala', 'butter naan', 'paneer masala', 'naan',
      'பன்னீர்', 'பன்னீர் பட்டர் மசாலா', 'நான்', 'பன்னீர் மசாலா',
      'पनीर', 'पनीर बटर मसाला', 'बटर नान'
    ]
  },
  {
    id: 'chole-bhature',
    canonicalName: 'Punjabi Chole Bhature (2 pcs)',
    nativeNames: {
      en: 'Punjabi Chole Bhature (2 pcs)',
      ta: 'பஞ்சாபி சோலே பட்டூரே (2)',
      hi: 'पंजाबी छोले भटूरे (2)'
    },
    aliases: [
      'chole bhature', 'bhature', 'chola bhatura', 'poori', 'puri', 'chole poori', 'punjabi chole',
      'சோலே பட்டூரே', 'பூரி', 'சோலே பூரி', 'பட்டூரே',
      'छोले भटूरे', 'भटूरे', 'पूरी', 'छोले पूरी'
    ]
  },
  {
    id: 'butter-chicken',
    canonicalName: 'Murgh Makhani Butter Chicken & Rice',
    nativeNames: {
      en: 'Murgh Makhani Butter Chicken & Rice',
      ta: 'பட்டர் சிக்கன் சாதம்',
      hi: 'बटर चिकन और चावल'
    },
    aliases: [
      'butter chicken', 'murgh makhani', 'chicken curry', 'chicken rice',
      'பட்டர் சிக்கன்', 'சிக்கன் கிரேவி', 'சிக்கன் சாதம்',
      'बटर चिकन', 'मुर्ग मखनी', 'चिकन करी'
    ]
  },
  {
    id: 'gujarati-thali',
    canonicalName: 'Royal Gujarati Thali Special',
    nativeNames: {
      en: 'Royal Gujarati Thali Special',
      ta: 'குஜராத்தி தாலி மீல்ஸ்',
      hi: 'शाही गुजराती थाली'
    },
    aliases: [
      'thali', 'gujarati thali', 'meals', 'south indian meals', 'full meals', 'saapaadu',
      'தாலி', 'மீல்ஸ்', 'சாப்பாடு', 'குஜராத்தி தாலி',
      'थाली', 'गुजराती थाली', 'भोजन'
    ]
  },
  {
    id: 'pav-bhaji',
    canonicalName: 'Butter Mumbai Pav Bhaji',
    nativeNames: {
      en: 'Butter Mumbai Pav Bhaji',
      ta: 'மும்பை பட்டர் பாவ் பாஜி',
      hi: 'बटर मुंबई पाव भाजी'
    },
    aliases: [
      'pav bhaji', 'pav baji', 'bhaji pav', 'mumbai pav bhaji',
      'பாவ் பாஜி', 'பட்டர் பாவ் பாஜி',
      'पाव भाजी', 'बटर पाव भाजी'
    ]
  },
  {
    id: 'chaat-pani-puri',
    canonicalName: 'Crispy Pani Puri (Golgappa 8 pcs)',
    nativeNames: {
      en: 'Crispy Pani Puri (Golgappa 8 pcs)',
      ta: 'பானி பூரி (கோல்கப்பா 8)',
      hi: 'क्रिस्पी पानी पूरी (गोलगप्पा 8)'
    },
    aliases: [
      'pani puri', 'panipuri', 'golgappa', 'gol gappa', 'puchka', 'paani poori', 'chaat',
      'பானி பூரி', 'பானிபூரி', 'கோல்கப்பா', 'சாட்',
      'पानी पूरी', 'गोलगप्पा', 'गोलगप्पे', 'पुचका', 'चाट'
    ]
  },
  {
    id: 'pizza-veggie-supreme',
    canonicalName: 'Cheesy Veg Supreme Pizza',
    nativeNames: {
      en: 'Cheesy Veg Supreme Pizza',
      ta: 'சீஸ் வெஜ் சுப்ரீம் பீட்சா',
      hi: 'चीज़ी वेज सुप्रीम पिज़्ज़ा'
    },
    aliases: [
      'pizza', 'veg pizza', 'cheese pizza', 'supreme pizza',
      'பீட்சா', 'பிட்சா', 'சீஸ் பீட்சா',
      'पिज़्ज़ा', 'पिज़ा', 'वेज पिज़्ज़ा'
    ]
  },
  {
    id: 'chinese-fried-rice',
    canonicalName: 'Chicken Schezwan Fried Rice',
    nativeNames: {
      en: 'Chicken Schezwan Fried Rice',
      ta: 'சிக்கன் செஸ்வான் ஃப்ரைட் ரைஸ்',
      hi: 'चिकन शेजवान फ्राइड राइस'
    },
    aliases: [
      'fried rice', 'schezwan fried rice', 'chicken fried rice', 'chinese rice', 'noodles',
      'ஃப்ரைட் ரைஸ்', 'பிரைட் ரைஸ்', 'நூடுல்ஸ்', 'செஸ்வான் ரைஸ்',
      'फ्राइड राइस', 'शेजवान फ्राइड राइस', 'नूडल्स'
    ]
  },
  {
    id: 'beverage-filter-coffee',
    canonicalName: 'Kumbakonam Degree Filter Coffee',
    nativeNames: {
      en: 'Kumbakonam Degree Filter Coffee',
      ta: 'கும்பகோணம் டிகிரி ஃபில்டர் காபி',
      hi: 'कुंभकोणम डिग्री फिल्टर कॉफी'
    },
    aliases: [
      'coffee', 'filter coffee', 'kaapi', 'degree coffee', 'kumbakonam coffee', 'hot coffee',
      'காபி', 'டிகிரி காபி', 'ஃபில்டர் காபி', 'காஃபி',
      'कॉफ़ी', 'कॉफी', 'फिल्टर कॉफी', 'डिग्री कॉफी'
    ]
  },
  {
    id: 'dessert-gulab-jamun',
    canonicalName: 'Hot Shahi Gulab Jamun (2 pcs)',
    nativeNames: {
      en: 'Hot Shahi Gulab Jamun (2 pcs)',
      ta: 'சூடான குலாப் ஜாமுன் (2)',
      hi: 'शाही गुलाब जामुन (2)'
    },
    aliases: [
      'gulab jamun', 'jamun', 'gulab jamoon', 'sweet', 'dessert',
      'குலாப் ஜாமுன்', 'ஜாமுன்', 'இனிப்பு',
      'गुलाब जामुन', 'जामुन', 'मिठाई'
    ]
  }
];

export const CANONICAL_RESTAURANT_ALIASES = [
  {
    canonicalName: 'Saravana Bhavan',
    aliases: ['saravana bhavan', 'saravana bavan', 'sharavana', 'hotel saravana bhavan', 'saravana', 'சரவண பவன்', 'சரவண', 'सरवना भवन']
  },
  {
    canonicalName: 'Murugan Idli Shop',
    aliases: ['murugan idli shop', 'murugan idli', 'murugan idly', 'murugan', 'முருகன் இட்லி கடை', 'மொருகன்', 'मुरुगन इडली शॉप']
  },
  {
    canonicalName: 'Bawarchi Biryani',
    aliases: ['bawarchi biryani', 'bawarchi', 'bavarchi', 'bawarchi restaurant', 'பவர்ச்சி பிரியாணி', 'बावर्ची बिरयानी']
  },
  {
    canonicalName: 'A2B - Adyar Ananda Bhavan',
    aliases: ['adyar ananda bhavan', 'a2b', 'ananda bhavan', 'அடையாறு ஆனந்த பவன்', 'அடையார்', 'अद्यार आनंद भवन']
  },
  {
    canonicalName: 'Dominos Pizza',
    aliases: ['dominos pizza', 'dominos', 'dominoes', 'domino', 'டோமினோஸ்', 'डोमिनोज']
  },
  {
    canonicalName: 'Sangeetha Veg Restaurant',
    aliases: ['sangeetha veg restaurant', 'sangeetha', 'sangetha', 'சங்கீதா', 'संगीता']
  },
  {
    canonicalName: 'Madurai Mess',
    aliases: ['madurai mess', 'madurai mess hotel', 'மதுரை மெஸ்', 'மदुरै मेस']
  },
  {
    canonicalName: 'Kumbakonam Degree Coffee',
    aliases: ['kumbakonam degree coffee', 'kumbakonam coffee', 'கும்பகோணம்', 'कुंभकोणम डिग्री कॉफी']
  }
];
