import { describe, expect, test } from 'vitest';
import {
  isFoodItemRestricted,
  resolveRestrictedFoodInterception,
  stripGenericDescriptors
} from '../services/restrictedFoodMatcher';
import { SttMatcherService } from '../services/sttMatcherService';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog.js';

// The nominee's restricted list from the user request:
// - Hot Shahi Gulab Jamun ('dessert-gulab-jamun')
// - Paneer Butter Masala & Naan ('paneer-butter-masala')
// - Crispy Pani Puri ('chaat-pani-puri')
// - Crispy Medu Vada ('medu-vada')
const NOMINEE_RESTRICTED_IDS = [
  'dessert-gulab-jamun',
  'paneer-butter-masala',
  'chaat-pani-puri',
  'medu-vada'
];

const RESTRICTED_CATALOG_ITEMS = INDIAN_FOOD_CATALOG.filter(i =>
  NOMINEE_RESTRICTED_IDS.includes(i.id)
);

describe('Restricted Food Check - False-Positive Prevention (NOT Restricted)', () => {
  // English
  test('Crispy Masala Dosa -> NOT restricted (no approval)', () => {
    expect(isFoodItemRestricted('Crispy Masala Dosa', NOMINEE_RESTRICTED_IDS)).toBe(false);
    expect(isFoodItemRestricted('dosa-masala', NOMINEE_RESTRICTED_IDS)).toBe(false);
    const interception = SttMatcherService.checkRestrictedFoodInterception('Crispy Masala Dosa', RESTRICTED_CATALOG_ITEMS);
    expect(interception.isRestricted).toBe(false);
  });

  // Tamil
  test('க்ரிஸ்பி மசாலா தோசை (Tamil) -> NOT restricted (no approval)', () => {
    expect(isFoodItemRestricted('க்ரிஸ்பி மசாலா தோசை', NOMINEE_RESTRICTED_IDS)).toBe(false);
    expect(isFoodItemRestricted('மசாலா தோசை', NOMINEE_RESTRICTED_IDS)).toBe(false);
  });

  // Hindi
  test('masala dosa / मसाला डोसा (Hindi) -> NOT restricted (no approval)', () => {
    expect(isFoodItemRestricted('masala dosa', NOMINEE_RESTRICTED_IDS)).toBe(false);
    expect(isFoodItemRestricted('मसाला डोसा', NOMINEE_RESTRICTED_IDS)).toBe(false);
    expect(isFoodItemRestricted('क्रिस्पी मसाला डोसा', NOMINEE_RESTRICTED_IDS)).toBe(false);
  });

  // Plain Dosa
  test('Plain Dosa / பிளைன் தோசை / प्लेन डोसा -> NOT restricted', () => {
    expect(isFoodItemRestricted('Plain Dosa', NOMINEE_RESTRICTED_IDS)).toBe(false);
    expect(isFoodItemRestricted('Golden Plain Paper Dosa', NOMINEE_RESTRICTED_IDS)).toBe(false);
    expect(isFoodItemRestricted('dosa-plain', NOMINEE_RESTRICTED_IDS)).toBe(false);
  });

  // Idli
  test('Idli / இட்லி / इडली -> NOT restricted', () => {
    expect(isFoodItemRestricted('Idli', NOMINEE_RESTRICTED_IDS)).toBe(false);
    expect(isFoodItemRestricted('Steamed Button Sambar Idli', NOMINEE_RESTRICTED_IDS)).toBe(false);
    expect(isFoodItemRestricted('idli-sambar', NOMINEE_RESTRICTED_IDS)).toBe(false);
  });

  // Biryani
  test('Biryani / பிரியாணி / बिरयानी -> NOT restricted', () => {
    expect(isFoodItemRestricted('Biryani', NOMINEE_RESTRICTED_IDS)).toBe(false);
    expect(isFoodItemRestricted('Hyderabadi Chicken Dum Biryani', NOMINEE_RESTRICTED_IDS)).toBe(false);
    expect(isFoodItemRestricted('biryani-hyderabadi', NOMINEE_RESTRICTED_IDS)).toBe(false);
  });
});

describe('Restricted Food Check - True-Positive Interception (RESTRICTED, Approval Required)', () => {
  // Pani Puri in English, misspellings, Tamil, Hindi
  test('Crispy Pani Puri (English) -> RESTRICTED', () => {
    expect(isFoodItemRestricted('Crispy Pani Puri', NOMINEE_RESTRICTED_IDS)).toBe(true);
    expect(isFoodItemRestricted('chaat-pani-puri', NOMINEE_RESTRICTED_IDS)).toBe(true);
    const interception = SttMatcherService.checkRestrictedFoodInterception('Crispy Pani Puri', RESTRICTED_CATALOG_ITEMS);
    expect(interception.isRestricted).toBe(true);
    expect(interception.matchedItem?.id).toBe('chaat-pani-puri');
  });

  test('"panipoory" misspelling caught by step 3 (0.40 fuzzy threshold) -> RESTRICTED', () => {
    expect(isFoodItemRestricted('panipoory', NOMINEE_RESTRICTED_IDS)).toBe(true);
    expect(isFoodItemRestricted('pani pury', NOMINEE_RESTRICTED_IDS)).toBe(true);
    const interception = SttMatcherService.checkRestrictedFoodInterception('panipoory', RESTRICTED_CATALOG_ITEMS);
    expect(interception.isRestricted).toBe(true);
  });

  test('பானி பூரி (Tamil) -> RESTRICTED', () => {
    expect(isFoodItemRestricted('பானி பூரி', NOMINEE_RESTRICTED_IDS)).toBe(true);
    expect(isFoodItemRestricted('பானிபூரி', NOMINEE_RESTRICTED_IDS)).toBe(true);
  });

  test('पानी पूरी (Hindi) -> RESTRICTED', () => {
    expect(isFoodItemRestricted('पानी पूरी', NOMINEE_RESTRICTED_IDS)).toBe(true);
    expect(isFoodItemRestricted('पानीपूरी', NOMINEE_RESTRICTED_IDS)).toBe(true);
  });

  // Medu Vada in English, Tamil, Hindi
  test('Crispy Medu Vada (English) -> RESTRICTED', () => {
    expect(isFoodItemRestricted('Crispy Medu Vada', NOMINEE_RESTRICTED_IDS)).toBe(true);
    expect(isFoodItemRestricted('medu-vada', NOMINEE_RESTRICTED_IDS)).toBe(true);
  });

  test('மெது வடை (Tamil) -> RESTRICTED', () => {
    expect(isFoodItemRestricted('மெது வடை', NOMINEE_RESTRICTED_IDS)).toBe(true);
  });

  // Gulab Jamun in English, Tamil, Hindi
  test('Gulab Jamun (English) -> RESTRICTED', () => {
    expect(isFoodItemRestricted('Gulab Jamun', NOMINEE_RESTRICTED_IDS)).toBe(true);
    expect(isFoodItemRestricted('Hot Shahi Gulab Jamun', NOMINEE_RESTRICTED_IDS)).toBe(true);
    expect(isFoodItemRestricted('dessert-gulab-jamun', NOMINEE_RESTRICTED_IDS)).toBe(true);
  });

  test('குலாப் ஜாமுன் (Tamil) -> RESTRICTED', () => {
    expect(isFoodItemRestricted('குலாப் ஜாமுன்', NOMINEE_RESTRICTED_IDS)).toBe(true);
    expect(isFoodItemRestricted('குலாப் ஜாமூன்', NOMINEE_RESTRICTED_IDS)).toBe(true);
  });

  test('गुलाब जामुन (Hindi) -> RESTRICTED', () => {
    expect(isFoodItemRestricted('गुलाब जामुन', NOMINEE_RESTRICTED_IDS)).toBe(true);
  });

  // Paneer Butter Masala & Naan
  test('Paneer Butter Masala & Naan -> RESTRICTED', () => {
    expect(isFoodItemRestricted('Paneer Butter Masala & Naan', NOMINEE_RESTRICTED_IDS)).toBe(true);
    expect(isFoodItemRestricted('Paneer Butter Masala', NOMINEE_RESTRICTED_IDS)).toBe(true);
    expect(isFoodItemRestricted('paneer-butter-masala', NOMINEE_RESTRICTED_IDS)).toBe(true);
    expect(isFoodItemRestricted('பன்னீர் பட்டர் மசாலா', NOMINEE_RESTRICTED_IDS)).toBe(true);
    expect(isFoodItemRestricted('पनीर बटर मसाला', NOMINEE_RESTRICTED_IDS)).toBe(true);
  });
});

describe('Edge Cases, Descriptors, and List Scoping', () => {
  test('Undefined or empty foodItemId NEVER matches anything in restricted list', () => {
    expect(isFoodItemRestricted('', NOMINEE_RESTRICTED_IDS)).toBe(false);
    expect(isFoodItemRestricted('   ', NOMINEE_RESTRICTED_IDS)).toBe(false);
    expect(isFoodItemRestricted(undefined as any, NOMINEE_RESTRICTED_IDS)).toBe(false);
    expect(isFoodItemRestricted(null as any, NOMINEE_RESTRICTED_IDS)).toBe(false);
    expect(isFoodItemRestricted('undefined', NOMINEE_RESTRICTED_IDS)).toBe(false);
    expect(isFoodItemRestricted('null', NOMINEE_RESTRICTED_IDS)).toBe(false);
  });

  test('Empty restricted list means NO items are restricted', () => {
    expect(isFoodItemRestricted('Crispy Pani Puri', [])).toBe(false);
    expect(isFoodItemRestricted('Crispy Medu Vada', [])).toBe(false);
    expect(isFoodItemRestricted('Hot Shahi Gulab Jamun', [])).toBe(false);
  });

  test('Only items actually in the nominee restricted list require approval', () => {
    // If nominee only restricted Gulab Jamun:
    const onlyJamun = ['dessert-gulab-jamun'];
    expect(isFoodItemRestricted('Gulab Jamun', onlyJamun)).toBe(true);
    expect(isFoodItemRestricted('Crispy Pani Puri', onlyJamun)).toBe(false);
    expect(isFoodItemRestricted('Crispy Medu Vada', onlyJamun)).toBe(false);
    expect(isFoodItemRestricted('Crispy Masala Dosa', onlyJamun)).toBe(false);
  });

  test('stripGenericDescriptors removes generic words without affecting core dish tokens', () => {
    expect(stripGenericDescriptors('Crispy Masala Dosa')).toBe('dosa');
    expect(stripGenericDescriptors('Hot Shahi Gulab Jamun')).toBe('shahi gulab jamun');
    expect(stripGenericDescriptors('Crispy Pani Puri')).toBe('pani puri');
    expect(stripGenericDescriptors('Crispy Medu Vada')).toBe('medu vada');
  });

  test('Direct tap/catalog ID: ID resolution takes precedence over fuzzy text', () => {
    const res = resolveRestrictedFoodInterception('dosa-masala', NOMINEE_RESTRICTED_IDS);
    expect(res.isRestricted).toBe(false);

    const resRestricted = resolveRestrictedFoodInterception('chaat-pani-puri', NOMINEE_RESTRICTED_IDS);
    expect(resRestricted.isRestricted).toBe(true);
    expect(resRestricted.matchedItem.id).toBe('chaat-pani-puri');
  });
});

