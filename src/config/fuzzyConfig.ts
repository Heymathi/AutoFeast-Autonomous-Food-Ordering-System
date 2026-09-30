/**
 * Configuration & Threshold Settings for Unified Fuzzy Matching Engine
 */
export interface FuzzyThresholdConfig {
  highConfidence: number;   // >= 0.85: Auto-proceed
  mediumConfidence: number; // 0.60 - 0.84: Ask "Did you mean {item}?"
  restrictedThreshold: number; // Stricter threshold for restricted food checks (>= 0.50)
}

export const FUZZY_CONFIG: FuzzyThresholdConfig = {
  highConfidence: 0.85,
  mediumConfidence: 0.60,
  restrictedThreshold: 0.50
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
    id: 'idli-sambar',
    canonicalName: 'Ghee Sambar Idli',
    nativeNames: {
      en: 'Ghee Sambar Idli',
      ta: 'நெய் சாம்பார் இட்லி',
      hi: 'घी सांभर इडली'
    },
    aliases: [
      'idli', 'idly', 'iddli', 'italy', 'eatly', 'idlee', 'idles',
      'இட்லி', 'சாம்பார் இட்லி', 'நெய் இட்லி',
      'इडली', 'सांभर इडली', 'घी इडली'
    ]
  },
  {
    id: 'dosa-masala',
    canonicalName: 'Crispy Masala Dosa',
    nativeNames: {
      en: 'Crispy Masala Dosa',
      ta: 'மொறுமொறு மசாலா தோசை',
      hi: 'क्रिस्पी मसाला डोसा'
    },
    aliases: [
      'dosa', 'dosai', 'dhosai', 'dosaa', 'dosha', 'dosah',
      'தோசை', 'மசாலா தோசை', 'மொறுமொறு தோசை',
      'डोसा', 'मसाला डोसा', 'डोशा'
    ]
  },
  {
    id: 'pani-puri',
    canonicalName: 'Pani Puri',
    nativeNames: {
      en: 'Pani Puri',
      ta: 'பானி பூரி',
      hi: 'पानी पूरी'
    },
    aliases: [
      'panipuri', 'pani puri', 'paani puri', 'golgappa', 'gol gappa', 'puchka',
      'பானி பூரி', 'கோல்கப்பா',
      'पानी पूरी', 'गोलगप्पा', 'पुचका'
    ]
  },
  {
    id: 'kothu-parotta',
    canonicalName: 'Chicken Kothu Parotta',
    nativeNames: {
      en: 'Chicken Kothu Parotta',
      ta: 'சிக்கன் கொத்து பரோட்டா',
      hi: 'चिकन कोथू परोठा'
    },
    aliases: [
      'chicken kothu parotta', 'kothu parotta chicken', 'kothu parota chicken',
      'kothu parotta', 'kothu parota', 'chick koth', 'kottu parotta',
      'கொத்து பரோட்டா', 'சிக்கன் கொத்து',
      'कोथू परोठा', 'चिकन कोथू'
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
      'biryani', 'biriyani', 'birani', 'chicken biryani', 'dum biryani', 'briyani',
      'பிரியாணி', 'சிக்கன் பிரியாணி',
      'बिरयानी', 'चिकन बिरयानी'
    ]
  },
  {
    id: 'samosa-chole',
    canonicalName: 'Punjabi Samosa Chole',
    nativeNames: {
      en: 'Punjabi Samosa Chole',
      ta: 'பஞ்சாபி சமோசா சோலே',
      hi: 'पंजाबी समोसा छोले'
    },
    aliases: [
      'samosa', 'smosa', 'samosha', 'chole samosa', 'samosa chole',
      'சமோசா', 'சோலே சமோசா',
      'समोसा', 'छोले समोसा'
    ]
  },
  {
    id: 'pongal-ven',
    canonicalName: 'Ghee Ven Pongal',
    nativeNames: {
      en: 'Ghee Ven Pongal',
      ta: 'நெய் வெண் பொங்கல்',
      hi: 'घी वेन पोंगल'
    },
    aliases: [
      'pongal', 'ven pongal', 'ghee pongal', 'pongall',
      'பொங்கல்', 'வெண் பொங்கல்',
      'पोंगल', 'वेन पोंगल'
    ]
  },
  {
    id: 'vada-medu',
    canonicalName: 'Medu Vada (2 Pcs)',
    nativeNames: {
      en: 'Medu Vada (2 Pcs)',
      ta: 'மெது வடை (2)',
      hi: 'मेदू वड़ा (2)'
    },
    aliases: [
      'vada', 'vadai', 'medu vada', 'medu vadai', 'wada',
      'வடை', 'மெது வடை',
      'वड़ा', 'मेदू वड़ा'
    ]
  }
];

export const CANONICAL_RESTAURANT_ALIASES = [
  {
    canonicalName: 'Saravana Bhavan',
    aliases: ['saravana bhavan', 'saravana bavan', 'hotel saravana bhavan', 'saravana', 'சரவண பவன்', 'சரவண', 'सरवना भवन']
  },
  {
    canonicalName: 'Murugan Idli Shop',
    aliases: ['murugan idli shop', 'murugan idli', 'murugan idly', 'murugan', 'முருகன் இட்லி கடை', 'मुरुगन इडली शॉप']
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
    aliases: ['madurai mess', 'madurai mess hotel', 'மதுரை மெஸ்', 'मदुरै मेस']
  },
  {
    canonicalName: 'Kumbakonam Degree Coffee',
    aliases: ['kumbakonam degree coffee', 'kumbakonam coffee', 'கும்பகோணம்', 'कुंभकोणम डिग्री कॉफी']
  }
];
