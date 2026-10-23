import { afterEach, describe, expect, test, vi } from 'vitest';
import { INDIAN_FOOD_CATALOG } from '../../data/indianFoodCatalog';
import { LlmNluService } from '../llmNluService';
import { parsePinSpeech } from '../pinVoiceParserService';
import { SttMatcherService } from '../sttMatcherService';
import { parseSpokenTimeTo24Hr } from '../../components/VoiceOrderDialogModal';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  LlmNluService.clearCache();
});

// Category 1: Yes/No confirmation cases (>= 40 phrases)
const confirmationCases: Array<[string, 'YES' | 'NO']> = [
  ['yes', 'YES'], ['yeah', 'YES'], ['yep', 'YES'], ['sure', 'YES'], ['ok', 'YES'],
  ['okay', 'YES'], ['confirm', 'YES'], ['proceed', 'YES'], ['do it', 'YES'], ['correct', 'YES'],
  ['right', 'YES'], ['absolutely', 'YES'], ['go ahead', 'YES'],
  ['ஆம்', 'YES'], ['ஆமாம்', 'YES'], ['ஆமா', 'YES'], ['சரி', 'YES'], ['உறுதி', 'YES'],
  ['செய்', 'YES'], ['aama', 'YES'], ['aamam', 'YES'], ['sari', 'YES'], ['seri', 'YES'],
  ['हाँ', 'YES'], ['जी हाँ', 'YES'], ['हाँजी', 'YES'], ['ठीक है', 'YES'], ['ठीक', 'YES'],
  ['करो', 'YES'], ['हाँ करो', 'YES'], ['haan', 'YES'], ['sahi', 'YES'], ['ji haan', 'YES'],
  ['thik hai', 'YES'], ['theek hai', 'YES'],
  ['no', 'NO'], ['nope', 'NO'], ['nah', 'NO'], ['no thanks', 'NO'], ['not at all', 'NO'],
  ['cancel', 'NO'], ['stop', 'NO'], ['dont', 'NO'], ['never', 'NO'],
  ['இல்லை', 'NO'], ['இல்ல', 'NO'], ['வேண்டாம்', 'NO'], ['வேணாம்', 'NO'], ['ரத்து', 'NO'],
  ['vendam', 'NO'], ['venam', 'NO'], ['vendaam', 'NO'], ['illa', 'NO'],
  ['नहीं', 'NO'], ['ना', 'NO'], ['नहीं चाहिए', 'NO'], ['मना', 'NO'], ['nahi', 'NO'],
  ['nahin', 'NO'], ['naa', 'NO'], ['nahi chahiye', 'NO']
];

// Category 2: Order now vs Schedule cases (>= 40 phrases)
const orderTypeCases: Array<[string, 'ORDER_NOW' | 'SCHEDULE']> = [
  ['order now', 'ORDER_NOW'], ['please order now', 'ORDER_NOW'], ['I want to order now', 'ORDER_NOW'],
  ['buy now', 'ORDER_NOW'], ['instant', 'ORDER_NOW'], ['instant order please', 'ORDER_NOW'],
  ['please buy now', 'ORDER_NOW'], ['make it an instant order', 'ORDER_NOW'],
  ['இப்போதே ஆர்டர் செய்', 'ORDER_NOW'], ['இப்போ ஆர்டர் செய்', 'ORDER_NOW'], ['உடனடி', 'ORDER_NOW'],
  ['இப்போதே ஆர்டர் செய்யுங்கள்', 'ORDER_NOW'], ['இப்போ ஆர்டர் பண்ணு', 'ORDER_NOW'],
  ['ஆர்டர் இப்போதே செய்', 'ORDER_NOW'], ['உடனடியாக ஆர்டர் செய்', 'ORDER_NOW'],
  ['अभी ऑर्डर करें', 'ORDER_NOW'], ['तुरंत ऑर्डर करें', 'ORDER_NOW'], ['अभी ऑर्डर करिए', 'ORDER_NOW'],
  ['अभी खाना ऑर्डर करें', 'ORDER_NOW'], ['तुरंत खाना मंगाओ', 'ORDER_NOW'], ['तुरंत', 'ORDER_NOW'],
  ['schedule', 'SCHEDULE'], ['please schedule', 'SCHEDULE'], ['schedule for later', 'SCHEDULE'],
  ['set time', 'SCHEDULE'], ['schedule this for tomorrow', 'SCHEDULE'],
  ['schedule this for later please', 'SCHEDULE'], ['schedule my food', 'SCHEDULE'],
  ['please set a time for it', 'SCHEDULE'], ['set a time', 'SCHEDULE'],
  ['அட்டவணைப்படுத்து', 'SCHEDULE'], ['அட்டவணை', 'SCHEDULE'], ['திட்டமிடு', 'SCHEDULE'],
  ['பிறகு அட்டவணைப்படுத்து', 'SCHEDULE'], ['பின்னர் திட்டமிடு', 'SCHEDULE'],
  ['நாளைக்கு அட்டவணைப்படுத்து', 'SCHEDULE'],
  ['शेड्यूल करें', 'SCHEDULE'], ['शेड्यूल', 'SCHEDULE'], ['बाद के लिए शेड्यूल करें', 'SCHEDULE'],
  ['कल के लिए शेड्यूल करें', 'SCHEDULE'], ['समय सेट करें', 'SCHEDULE'],
  ['बाद में खाना शेड्यूल करें', 'SCHEDULE'], ['शेड्यूल करो', 'SCHEDULE'], ['बाद में', 'SCHEDULE']
];

// Category 3: Unrelated phrases (>= 40 phrases)
const unrelatedPhrases = [
  'dosa venum', 'oru biryani kudu', 'what is the weather', 'tell me a story', 'maybe',
  'I am not sure', 'how are you', 'thank you', 'good morning', 'I like this food',
  'one dosa', 'two idli', 'eight in the morning', 'my name is Ravi', 'nearby restaurants',
  'find pizza', 'search for dosa', 'show me the menu', 'repeat the price', 'I need help',
  'where is my train', 'play music', 'open camera', 'turn on lights', 'battery percentage',
  'சாப்பாடு வேண்டும்', 'என்ன நேரம்', 'நன்றி', 'எனக்கு தோசை வேண்டும்', 'வானிலை எப்படி',
  'ஒரு பிரியாணி கொடு', 'நான் பார்க்கிறேன்', 'இது நல்லது', 'எங்கே கிடைக்கும்', 'விலை என்ன',
  'எனக்கு உதவி தேவை', 'பாட்டு போடு',
  'मुझे डोसा चाहिए', 'एक बिरयानी दो', 'मौसम कैसा है', 'मेरा नाम सीमा है', 'मेनू दिखाओ',
  'कितने बजे हैं', 'धन्यवाद', 'मुझे मदद चाहिए', 'यह अच्छा है', 'कहाँ मिलेगा',
  'गाना बजाओ', 'ट्रेन कहाँ है'
];

// Category 4: Time parsing cases (>= 40 phrases)
const timeCases: Array<[string, string]> = [
  ['8 AM', '08:00'], ['8 in the morning', '08:00'], ['8:30 AM', '08:30'], ['12 noon', '12:00'],
  ['12 PM', '12:00'], ['12 AM', '00:00'], ['6 PM', '18:00'], ['7 at night', '19:00'],
  ['5:15 PM', '17:15'], ['10:45 PM', '22:45'], ['morning', '08:00'], ['lunch', '12:00'],
  ['snacks', '16:00'], ['dinner', '19:00'], ['காலை', '08:00'], ['மதியம்', '12:00'],
  ['சிற்றுண்டி', '16:00'], ['இரவு', '19:00'], ['காலை 8 மணி', '08:00'], ['மாலை 6 மணி', '18:00'],
  ['காலை 9 மணி', '09:00'], ['மதியம் 1 மணி', '13:00'], ['இரவு 8 மணி', '20:00'],
  ['सुबह', '08:00'], ['दोपहर', '12:00'], ['शाम का नाश्ता', '16:00'], ['रात का खाना', '19:00'],
  ['सुबह 8 बजे', '08:00'], ['शाम 6 बजे', '18:00'], ['दोपहर 1 बजे', '13:00'], ['रात 8 बजे', '20:00'],
  ['9 am', '09:00'], ['10 am', '10:00'], ['11 am', '11:00'], ['1 pm', '13:00'],
  ['2 pm', '14:00'], ['3 pm', '15:00'], ['4 pm', '16:00'], ['5 pm', '17:00'],
  ['6 am', '06:00'], ['7 am', '07:00'], ['8 pm', '20:00'], ['9 pm', '21:00']
];

// Category 5: Days and frequency cases (>= 40 phrases)
const daysCases: Array<[string, string]> = [
  ['every day', 'daily'], ['everyday', 'daily'], ['daily', 'daily'], ['all days', 'daily'],
  ['every single day', 'daily'], ['தினமும்', 'daily'], ['ஒவ்வொரு நாளும்', 'daily'],
  ['எல்லா நாளும்', 'daily'], ['தினசரி', 'daily'], ['தினமுமே', 'daily'],
  ['रोजाना', 'daily'], ['हर रोज', 'daily'], ['हर दिन', 'daily'], ['प्रतिदिन', 'daily'], ['रोज', 'daily'],
  ['monday', 'Mon'], ['mondays', 'Mon'], ['திங்கள்', 'Mon'], ['திங்கட்கிழமை', 'Mon'], ['somvar', 'Mon'], ['सोमवार', 'Mon'],
  ['tuesday', 'Tue'], ['tuesdays', 'Tue'], ['செவ்வாய்', 'Tue'], ['செவ்வாய்க்கிழமை', 'Tue'], ['mangalvar', 'Tue'], ['मंगलवार', 'Tue'],
  ['wednesday', 'Wed'], ['wednesdays', 'Wed'], ['புதன்', 'Wed'], ['புதன்கிழமை', 'Wed'], ['budhvar', 'Wed'], ['बुधवार', 'Wed'],
  ['thursday', 'Thu'], ['thursdays', 'Thu'], ['வியாழன்', 'Thu'], ['வியாழக்கிழமை', 'Thu'], ['guruvar', 'Thu'], ['गुरुवार', 'Thu'],
  ['friday', 'Fri'], ['fridays', 'Fri'], ['வெள்ளி', 'Fri'], ['வெள்ளிக்கிழமை', 'Fri'], ['shukravar', 'Fri'], ['शुक्रवार', 'Fri'],
  ['saturday', 'Sat'], ['சனிக்கிழமை', 'Sat'], ['shanivar', 'Sat'], ['शनिवार', 'Sat'],
  ['sunday', 'Sun'], ['ஞாயிற்றுக்கிழமை', 'Sun'], ['ravivar', 'Sun'], ['रविवार', 'Sun']
];

// Category 6: 4-Digit Security PIN phrases (>= 40 phrases)
const pinCases: Array<[string, string]> = [
  ['one two three four', '1234'], ['1 2 3 4', '1234'], ['1234', '1234'],
  ['four three two one', '4321'], ['4 3 2 1', '4321'], ['4321', '4321'],
  ['five six seven eight', '5678'], ['5 6 7 8', '5678'], ['5678', '5678'],
  ['nine eight seven six', '9876'], ['9 8 7 6', '9876'], ['9876', '9876'],
  ['zero zero zero zero', '0000'], ['0 0 0 0', '0000'], ['0000', '0000'],
  ['one one one one', '1111'], ['1 1 1 1', '1111'], ['1111', '1111'],
  ['nine nine nine nine', '9999'], ['9 9 9 9', '9999'], ['9999', '9999'],
  ['two five eight zero', '2580'], ['2 5 8 0', '2580'], ['2580', '2580'],
  ['ஒன்று இரண்டு மூன்று நான்கு', '1234'], ['நான்கு மூன்று இரண்டு ஒன்று', '4321'],
  ['ஐந்து ஆறு ஏழு எட்டு', '5678'], ['ஒன்பது எட்டு ஏழு ஆறு', '9876'],
  ['பூஜ்ஜியம் பூஜ்ஜியம் பூஜ்ஜியம் பூஜ்ஜியம்', '0000'],
  ['ஒன்னு ரெண்டு மூணு நாலு', '1234'], ['நாலு மூணு ரெண்டு ஒன்னு', '4321'],
  ['அஞ்சு ஆறு ஏழு எட்டு', '5678'], ['onnu rendu moonu naalu', '1234'],
  ['naalu moonu rendu onnu', '4321'],
  ['एक दो तीन चार', '1234'], ['चार तीन दो एक', '4321'],
  ['पाँच छह सात आठ', '5678'], ['नौ आठ सात छह', '9876'],
  ['शून्य शून्य शून्य शून्य', '0000'], ['ek do teen char', '1234'],
  ['char teen do ek', '4321'], ['one rendu teen naalu', '1234'],
  ['वन टू थ्री फोर', '1234'], ['one two teen char', '1234'],
  ['ஒன் டூ த்ரீ போர்', '1234'], ['1 rendu three char', '1234']
];

describe('step-aware multilingual voice intents', () => {
  test.each(confirmationCases)('confirmation phrase "%s" is %s', (phrase, expected) => {
    const result = SttMatcherService.matchConfirmation([phrase], 'en');
    expect(result.isMatched).toBe(true);
    expect(result.matchedValue).toBe(expected);
  });

  describe('backend Gemini NLU client', () => {
    test('sends step context and caches a validated result for the same transcript', async () => {
      const modelResult = {
        intent: 'yes',
        item: null,
        quantity: null,
        time: null,
        language: 'ta',
        confidence: 0.95
      };
      const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(
        JSON.stringify(modelResult),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      ));
      vi.stubGlobal('fetch', fetchMock);

      const options = {
        step: 'confirm_order',
        expectedOptions: ['yes', 'no'],
        cart: [{ name: 'Dosa', quantity: 2 }],
        language: 'ta' as const,
        alternatives: ['ஆம்', 'சரி']
      };
      const firstResult = await LlmNluService.interpretVoiceTurn('ஆம்', options);
      const repeatedResult = await LlmNluService.interpretVoiceTurn('ஆம்', options);

      expect(firstResult).toEqual(modelResult);
      expect(repeatedResult).toEqual(modelResult);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
      expect(requestBody).toMatchObject({
        transcript: 'ஆம்',
        alternatives: ['ஆம்', 'சரி'],
        step: 'confirm_order',
        expectedOptions: ['yes', 'no'],
        cart: [{ name: 'Dosa', quantity: 2 }],
        language: 'ta'
      });
    });

    test('returns to local matching when the Gemini backend is unavailable', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      const result = await LlmNluService.interpretVoiceTurn('schedule', {
        step: 'order_type',
        expectedOptions: ['order_now', 'schedule']
      });

      expect(result).toBeNull();
    });

    test('lets background Gemini extraction replace the immediate local result', async () => {
      const modelResult = {
        intent: 'search',
        item: 'Dosa',
        quantity: 1,
        time: null,
        language: 'ta',
        confidence: 0.95
      };
      const fetchMock = vi.fn(async () => new Response(JSON.stringify(modelResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }));
      vi.stubGlobal('fetch', fetchMock);

      const immediateResult = LlmNluService.extractFoodItemWithLlmSync('dosa venum', 'ta');
      expect(immediateResult.item).toBe('Dosa');
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      await vi.waitFor(() => {
        expect(LlmNluService.extractFoodItemWithLlmSync('dosa venum', 'ta').confidence).toBe(0.95);
      });
    });
  });

  test('the first affirmative/negative N-best response resolves immediately by majority vote', () => {
    expect(SttMatcherService.matchConfirmation(['noise', 'aama', 'ஆம்'], 'ta').matchedValue).toBe('YES');
    expect(SttMatcherService.matchConfirmation(['noise', 'nahi', 'नहीं'], 'hi').matchedValue).toBe('NO');
  });

  test('contradictory alternatives and unrelated speech do not trigger confirmation', () => {
    expect(SttMatcherService.matchConfirmation(['yes', 'no'], 'en').isMatched).toBe(false);
    expect(SttMatcherService.matchConfirmation(['dosa venum'], 'en').isMatched).toBe(false);
  });

  test.each(orderTypeCases)('order type phrase "%s" is %s', (phrase, expected) => {
    expect(SttMatcherService.matchOrderType([phrase]).matchedValue).toBe(expected);
  });

  test.each(unrelatedPhrases)('unrelated phrase "%s" triggers neither order nor confirmation', phrase => {
    expect(SttMatcherService.matchOrderType([phrase]).isMatched).toBe(false);
    expect(SttMatcherService.matchConfirmation([phrase], 'en').isMatched).toBe(false);
  });

  test.each(timeCases)('spoken time "%s" resolves to %s', (phrase, expected) => {
    expect(parseSpokenTimeTo24Hr(phrase)?.time24).toBe(expected);
  });

  test.each(daysCases)('spoken day/frequency "%s" matches %s', (phrase, expected) => {
    const res = SttMatcherService.matchDaysChoice([phrase]);
    if (expected === 'daily') {
      expect(res.isEveryDay).toBe(true);
    } else {
      expect(res.selectedDays).toContain(expected);
    }
  });

  test.each([
    ['one dosa', 1], ['ஒரு தோசை', 1], ['एक डोसा', 1], ['two dosa', 2], ['ரெண்டு தோசை', 2],
    ['दो डोसा', 2], ['three idli', 3], ['மூணு இட்லி', 3], ['तीन इडली', 3], ['four vada', 4],
    ['நாலு வடை', 4], ['चार वड़ा', 4], ['five dosa', 5], ['அஞ்சு தோசை', 5], ['पाँच डोसा', 5],
    ['six idli', 6], ['ஆறு இட்லி', 6], ['छह इडली', 6], ['seven vada', 7], ['ஏழு வடை', 7],
    ['सात वड़ा', 7], ['eight dosa', 8], ['எட்டு தோசை', 8], ['आठ डोसा', 8], ['nine idli', 9],
    ['ஒன்பது இட்லி', 9], ['नौ इडली', 9], ['ten vada', 10], ['பத்து வடை', 10], ['दस वड़ा', 10],
    ['1 dosa', 1], ['2 idli', 2], ['3 vada', 3], ['4 dosa', 4], ['5 idli', 5],
    ['6 vada', 6], ['7 dosa', 7], ['8 idli', 8], ['9 vada', 9], ['10 dosa', 10]
  ])('quantity phrase "%s" extracts %i', (phrase, expected) => {
    expect(SttMatcherService.extractQuantityAndCleanPhrase(phrase).quantity).toBe(expected);
  });

  test.each(INDIAN_FOOD_CATALOG.slice(0, 40))('catalog item "%s" remains matched against the real catalog', food => {
    const result = SttMatcherService.matchCatalogItem([food.name], INDIAN_FOOD_CATALOG, 'en');
    expect(result.isMatched || result.needsClarification).toBe(true);
    expect(result.matchedValue?.id || result.bestCandidate?.id).toBe(food.id);
  });

  test.each(pinCases)('PIN phrase "%s" parses to exactly %s', (phrase, expectedDigits) => {
    const result = parsePinSpeech(phrase);
    expect(result.status).toBe('success');
    expect(result.digits.join('')).toBe(expectedDigits);
  });

  test('invalid times stay unaccepted', () => {
    expect(parseSpokenTimeTo24Hr('biryani')).toBeNull();
    expect(parseSpokenTimeTo24Hr('25:90')).toBeNull();
  });
});
