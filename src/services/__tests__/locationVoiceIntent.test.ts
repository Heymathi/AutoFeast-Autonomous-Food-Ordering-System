import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LlmNluService, LocationChoiceIntent } from '../llmNluService';
import { forwardGeocode } from '../locationService';

describe('Location Voice Intent & Multilingual NLU Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 15 PHRASES PER LANGUAGE FOR EACH INTENT
  const testPhrases: Record<
    LocationChoiceIntent,
    { en: string[]; ta: string[]; hi: string[] }
  > = {
    use_live_location: {
      en: [
        'allow', 'yes', 'ok', 'sure', 'use my location',
        'use live location', 'enable location', 'current location', 'live location', 'turn on location',
        'yep', 'yeah', 'okay', 'fine', 'why not'
      ],
      ta: [
        'aama', 'sari', 'seri', 'ஆமாம்', 'சரி',
        'ok pannu', 'live address eduthukko', 'aamam', 'seri pannu', 'eduthuko',
        'anumathi', 'kudukalam', 'கொடுக்கலாம்', 'அனுமதி', 'சரிதான்'
      ],
      hi: [
        'haan', 'theek hai', 'ठीक है', 'हाँ', 'लोकेशन चालू करो',
        'haa', 'haanjee', 'sahi hai', 'sahi', 'le lo',
        'chalega', 'अनुमति', 'अनुमति दें', 'चालू करो', 'स्थान का उपयोग करो'
      ]
    },
    change_location: {
      en: [
        'no', 'deny', 'change address', 'skip', 'change location',
        'different address', 'another address', 'different place', 'another place', 'manual',
        'choose location', 'enter address', 'not now', 'nope', 'dont use live location'
      ],
      ta: [
        'venaam', 'illa', 'maathu', 'address maathu', 'vera idam',
        'இல்லை', 'வேண்டாம்', 'முகவரி மாற்று', 'venam', 'illai',
        'vera address', 'மாற்று', 'வேற இடம்', 'தவிர்க்கவும்', 'வேணாம்'
      ],
      hi: [
        'nahi', 'badlo', 'address badlo', 'दूसरा पता', 'नहीं',
        'बदलो', 'nahin', 'dusra pata', 'dusra address', 'location badlo',
        'मना', 'मना करें', 'पता बदलो', 'छोड़ो', 'बदलें'
      ]
    },
    give_address: {
      en: [
        'Salem', 'Anna Nagar Chennai', 'Connaught Place Delhi', 'Dharmapuri', 'Gandhipuram Coimbatore',
        'Indiranagar Bengaluru', 'T Nagar', 'Madurai', 'Chennai', 'Mumbai',
        'Hyderabad', 'Gachibowli', 'Bandra West', 'deliver to Salem', 'delivery to Chennai'
      ],
      ta: [
        'சேலம்', 'அண்ணா நகர் சென்னை', 'கோயம்புத்தூர் காந்திபுரம்', 'தர்மபுரி', 'மதுரை',
        'சென்னை', 'பெங்களூரு', 'காந்திபுரம்', 'இந்திரா நகர்', 'தர்மபுரி மெயின் ரோடு',
        'மும்பை', 'ஹைதராபாத்', 'கச்சிபௌலி', 'சேலம் டெலிவரி', 'சென்னைக்கு டெலிவரி'
      ],
      hi: [
        'दिल्ली', 'सेलम', 'चेन्नई', 'बेंगलुरु', 'मुंबई',
        'मुझे दिल्ली में डिलीवरी चाहिए', 'कनॉट प्लेस दिल्ली', 'अन्ना नगर சென்னை', 'गाचीबोवली हैदराबाद', 'बांद्रा मुंबई',
        'धर्मपुरी', 'सेलम में डिलीवरी', 'कोयंबटूर', 'मदुरै', 'केके नगर'
      ]
    },
    repeat: {
      en: [
        'repeat', 'pardon', 'what did you say', 'once again', 'tell me again',
        'say again', 'say that again', 'repeat please', 'come again', 'repeat the question',
        'didn t hear', 'say once more', 'repeat that', 'speak again', 'can you repeat'
      ],
      ta: [
        'மீண்டும் சொல்', 'இன்னொரு முறை', 'திரும்ப சொல்', 'marupadiyum sollu', 'marubadiyum',
        'thirumba sollu', 'thirumba pesu', 'marubadi sollu', 'innoru thadava', 'innoru murai sollu',
        'marupadiyum kelu', 'thirumbavum sollu', 'puriyala thirumba sollu', 'marupadiyum solunga', 'திரும்பவும் சொல்'
      ],
      hi: [
        'फिर से बोलो', 'दोबारा बताओ', 'phir se bolo', 'ek baar aur', 'dobara bolo',
        'fir se bolo', 'sunai nahi diya', 'dobara kahiye', 'fir se batao', 'ek bar aur bolo',
        'phir bolo', 'kya kaha', 'dobara sunao', 'fir se kahiye', 'samajh nahi aaya fir se bolo'
      ]
    },
    cancel: {
      en: [
        'cancel', 'close', 'stop', 'exit', 'dismiss',
        'back', 'cancel that', 'close modal', 'cancel now', 'shut down',
        'go back', 'abort', 'discard', 'stop now', 'close this'
      ],
      ta: [
        'ரத்து செய்', 'நிறுத்து', 'மூடு', 'cancel pannu', 'close pannu',
        'vendaam mudu', 'niruthu', 'rathu sei', 'veliya po', 'back po',
        'stop pannu', 'vendam niruthu', 'moodu', 'rathu seiyavum', 'cancel seidu vidu'
      ],
      hi: [
        'रद्द करो', 'बंद करो', 'रोक दो', 'cancel karo', 'ruk jao',
        'wapas jao', 'band kar do', 'cancel kar do', 'radd karo', 'hatao',
        'roko', 'peeche jao', 'band karo ise', 'cancel kijiye', 'chhod do abhi'
      ]
    },
    unclear: {
      en: [
        'asdfghjkl', 'blablabla', 'pineapple umbrella', 'flying rocket', 'supercalifragilistic',
        'what is the weather today', 'crypto bitcoin market', 'football cricket match', 'yesterday movie review', 'laptop battery charger',
        'banana shake recipe', 'guitar acoustic piano', 'random noise 123', 'who is the prime minister', 'mathematics formula integral'
      ],
      ta: [
        'சும்மா', 'என்னாச்சு', 'வானிலை எப்படி இருக்கு', 'கிரிக்கெட் மேட்ச்', 'சினிமா பாட்டு',
        'அலைபேசி சார்ஜர்', 'சமையல் குறிப்பு', 'விண்கலம் ராக்கெட்', 'புத்தகம் வாசிப்பு', 'கணினி பழுது',
        'ரயிலின் நேரம்', 'பூங்கா மலர்கள்', 'பள்ளி விடுமுறை', 'மழை பெய்யுமா', 'குளிர்பானம் விலை'
      ],
      hi: [
        'मौसम कैसा है', 'क्रिकेट स्कोर', 'गाना बजाओ', 'मोबाइल चार्जर', 'हवाई जहाज',
        'सिनेमा टिकट', 'रॉकेट साइंस', 'चाय की रेसिपी', 'बाजार का भाव', 'कंप्यूटर चालू करो',
        'किताब पढ़ना', 'रेलगाड़ी का समय', 'कल की छुट्टी', 'बारिश होगी क्या', 'अजीब बातें'
      ]
    }
  };

  describe('1. At least 15 phrases per language for each intent (Total 270 phrases)', () => {
    const intents: LocationChoiceIntent[] = [
      'use_live_location',
      'change_location',
      'give_address',
      'repeat',
      'cancel',
      'unclear'
    ];

    intents.forEach((intent) => {
      describe(`Intent: ${intent}`, () => {
        it(`recognizes >= 15 English phrases for "${intent}"`, () => {
          const phrases = testPhrases[intent].en;
          expect(phrases.length).toBeGreaterThanOrEqual(15);
          phrases.forEach((phrase) => {
            const res = LlmNluService.classifyLocationChoiceLocally(phrase, 'en');
            expect(res.intent, `Failed for phrase: "${phrase}"`).toBe(intent);
          });
        });

        it(`recognizes >= 15 Tamil / Tanglish phrases for "${intent}"`, () => {
          const phrases = testPhrases[intent].ta;
          expect(phrases.length).toBeGreaterThanOrEqual(15);
          phrases.forEach((phrase) => {
            const res = LlmNluService.classifyLocationChoiceLocally(phrase, 'ta');
            expect(res.intent, `Failed for phrase: "${phrase}"`).toBe(intent);
          });
        });

        it(`recognizes >= 15 Hindi / Hinglish phrases for "${intent}"`, () => {
          const phrases = testPhrases[intent].hi;
          expect(phrases.length).toBeGreaterThanOrEqual(15);
          phrases.forEach((phrase) => {
            const res = LlmNluService.classifyLocationChoiceLocally(phrase, 'hi');
            expect(res.intent, `Failed for phrase: "${phrase}"`).toBe(intent);
          });
        });
      });
    });
  });

  describe('2. Fallback when LLM is unavailable, rate-limited, or returns invalid JSON', () => {
    it('falls back to local classifier when backend returns 500 Internal Server Error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response);

      const result = await LlmNluService.interpretLocationChoice('yes use live location', {
        language: 'en'
      });

      expect(result.intent).toBe('use_live_location');
      expect(result.source).toBe('local_fallback');
    });

    it('falls back to local classifier when fetch throws network failure / offline', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network disconnected'));

      const result = await LlmNluService.interpretLocationChoice('வேண்டாம் முகவரி மாற்று', {
        language: 'ta'
      });

      expect(result.intent).toBe('change_location');
      expect(result.source).toBe('local_fallback');
    });

    it('falls back to local classifier when backend returns invalid JSON shape', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ unexpected: 'shape', status: 'unknown' })
      } as Response);

      const result = await LlmNluService.interpretLocationChoice('नहीं मुझे दूसरा पता चाहिए', {
        language: 'hi'
      });

      expect(result.intent).toBe('change_location');
      expect(result.source).toBe('local_fallback');
    });

    it('uses Gemini result when backend returns valid JSON schema', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          intent: 'give_address',
          address: 'Salem Fairlands',
          confidence: 0.98
        })
      } as Response);

      const result = await LlmNluService.interpretLocationChoice('deliver to Salem Fairlands please', {
        language: 'en'
      });

      expect(result.intent).toBe('give_address');
      expect(result.address).toBe('Salem Fairlands');
      expect(result.source).toBe('gemini');
    });
  });

  describe('3. Address confirmation and geocoding logic', () => {
    it('forwardGeocode resolves known Indian locations instantly with high confidence', async () => {
      const salem = await forwardGeocode('Salem');
      expect(salem.length).toBeGreaterThan(0);
      expect(salem[0].city).toBe('Salem');
      expect(salem[0].confidence).toBeGreaterThanOrEqual(0.85);

      const delhi = await forwardGeocode('दिल्ली');
      expect(delhi.length).toBeGreaterThan(0);
      expect(delhi[0].city).toBe('Delhi');

      const chennai = await forwardGeocode('Anna Nagar Chennai');
      expect(chennai.length).toBeGreaterThan(0);
      expect(chennai[0].city).toBe('Chennai');
    });

    it('extracts address from give_address intent for confirmation prompt', () => {
      const res = LlmNluService.classifyLocationChoiceLocally('Salem', 'en');
      expect(res.intent).toBe('give_address');
      expect(res.address).toBeTruthy();
      expect(res.address?.toLowerCase()).toContain('salem');
    });

    it('never sets an address on unclear or gibberish input', () => {
      const res = LlmNluService.classifyLocationChoiceLocally('supercalifragilistic random noise', 'en');
      expect(res.intent).toBe('unclear');
      expect(res.address).toBeNull();
    });
  });
});
