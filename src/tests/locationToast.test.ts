import { describe, expect, test } from 'vitest';
import {
  extractAreaCityFromAddress,
  formatLocationPlace,
  formatLocationSetToast,
  reverseGeocode
} from '../services/locationService';
import { TRANSLATIONS } from '../data/translations';

// Simple t helper function replicating useApp().t
function makeT(lang: 'en' | 'ta' | 'hi') {
  return (key: string) => TRANSLATIONS[lang]?.[key] || key;
}

describe('extractAreaCityFromAddress (Nominatim address object parser)', () => {
  test('Suramangalam, Salem: extracts suburb as area and state_district as city', () => {
    // Real Nominatim address structure for Suramangalam (lat 11.6738, lon 78.1230)
    const addr = {
      quarter: 'Kuranguchavadi',
      suburb: 'Suramangalam',
      county: 'Salem West',
      state_district: 'Salem',
      state: 'Tamil Nadu',
      country: 'India'
    };

    const result = extractAreaCityFromAddress(addr);
    expect(result.area).toBe('Suramangalam');
    expect(result.city).toBe('Salem');
  });

  test('Strips "district" and "taluk" from city (e.g. Salem District -> Salem)', () => {
    const addrWithDistrict = {
      suburb: 'Suramangalam',
      state_district: 'Salem District'
    };
    expect(extractAreaCityFromAddress(addrWithDistrict).city).toBe('Salem');

    const addrWithTaluk = {
      suburb: 'Suramangalam',
      county: 'Salem taluk'
    };
    expect(extractAreaCityFromAddress(addrWithTaluk).city).toBe('Salem');
  });

  test('Dharmapuri with village/area: extracts village and city', () => {
    // Real Nominatim address structure for Gollapatti, Dharmapuri (lat 12.1872, lon 78.1308)
    const addr = {
      village: 'Gollapatti',
      county: 'Palakkodu',
      state_district: 'Dharmapuri',
      state: 'Tamil Nadu',
      country: 'India'
    };

    const result = extractAreaCityFromAddress(addr);
    expect(result.area).toBe('Gollapatti');
    expect(result.city).toBe('Dharmapuri');
  });

  test('Dharmapuri city center: city only when no local suburb/village', () => {
    // Real Nominatim address for Dharmapuri city (lat 12.1348, lon 78.1589)
    const addr = {
      city: 'Dharmapuri',
      county: 'Dharmapuri',
      state_district: 'Dharmapuri',
      state: 'Tamil Nadu'
    };

    const result = extractAreaCityFromAddress(addr);
    expect(result.city).toBe('Dharmapuri');
    // Area avoids duplicating town/city
    expect(result.area).toBe('');
  });

  test('Area extraction priority: suburb > neighbourhood > village > town > city_district > hamlet', () => {
    const addr = {
      suburb: 'TestSuburb',
      neighbourhood: 'TestNeighbourhood',
      village: 'TestVillage',
      city: 'TestCity'
    };
    expect(extractAreaCityFromAddress(addr).area).toBe('TestSuburb');

    const addr2 = {
      neighbourhood: 'TestNeighbourhood',
      village: 'TestVillage',
      city: 'TestCity'
    };
    expect(extractAreaCityFromAddress(addr2).area).toBe('TestNeighbourhood');

    const addr3 = {
      village: 'TestVillage',
      hamlet: 'TestHamlet',
      city: 'TestCity'
    };
    expect(extractAreaCityFromAddress(addr3).area).toBe('TestVillage');
  });

  test('City extraction priority: city > town > municipality > state_district > county', () => {
    const addr = {
      city: 'PrimaryCity',
      town: 'SecondaryTown',
      state_district: 'ThirdDistrict'
    };
    expect(extractAreaCityFromAddress(addr).city).toBe('PrimaryCity');

    const addr2 = {
      town: 'SecondaryTown',
      state_district: 'ThirdDistrict'
    };
    expect(extractAreaCityFromAddress(addr2).city).toBe('SecondaryTown');

    const addr3 = {
      municipality: 'MunicipalityCity',
      state_district: 'DistrictOnly'
    };
    expect(extractAreaCityFromAddress(addr3).city).toBe('MunicipalityCity');

    const addr4 = {
      state_district: 'Dharmapuri District'
    };
    expect(extractAreaCityFromAddress(addr4).city).toBe('Dharmapuri');
  });
});

describe('formatLocationPlace & Fallbacks', () => {
  test('1. area + city', () => {
    expect(formatLocationPlace({ area: 'Suramangalam', city: 'Salem' })).toBe('Suramangalam, Salem');
    expect(formatLocationPlace({ area: 'Gollapatti', city: 'Dharmapuri' })).toBe('Gollapatti, Dharmapuri');
  });

  test('2. city only (when area is missing or identical to city)', () => {
    expect(formatLocationPlace({ area: '', city: 'Dharmapuri' })).toBe('Dharmapuri');
    expect(formatLocationPlace({ area: 'Dharmapuri', city: 'Dharmapuri' })).toBe('Dharmapuri');
  });

  test('3. area only (when city is missing)', () => {
    expect(formatLocationPlace({ area: 'Suramangalam', city: '' })).toBe('Suramangalam');
  });

  test('4. "your location" when neither is available', () => {
    expect(formatLocationPlace({ area: '', city: '' }, 'en')).toBe('your location');
    expect(formatLocationPlace({ area: '', city: '' }, 'ta')).toBe('உங்கள் இருப்பிடம்');
    expect(formatLocationPlace({ area: '', city: '' }, 'hi')).toBe('आपका स्थान');
    expect(formatLocationPlace(null, 'en')).toBe('your location');
  });

  test('Bans literal "Current Area" or "Current City" from being displayed', () => {
    expect(formatLocationPlace({ area: 'Current Area', city: 'Salem' })).toBe('Salem');
    expect(formatLocationPlace({ area: 'Suramangalam', city: 'Current City' })).toBe('Suramangalam');
    expect(formatLocationPlace({ area: 'Current Area', city: 'Current City' }, 'en')).toBe('your location');
    expect(formatLocationPlace({ area: 'தற்போதைய பகுதி', city: 'தற்போதைய நகரம்' }, 'ta')).toBe('உங்கள் இருப்பிடம்');
    expect(formatLocationPlace({ area: 'वर्तमान क्षेत्र', city: 'वर्तमान शहर' }, 'hi')).toBe('आपका स्थान');
  });
});

describe('formatLocationSetToast (Toast Message Building)', () => {
  const tEn = makeT('en');
  const tTa = makeT('ta');
  const tHi = makeT('hi');

  test('English: shows "Location set to Suramangalam, Salem"', () => {
    const loc = { area: 'Suramangalam', city: 'Salem' };
    const toast = formatLocationSetToast(loc, tEn, 'en');
    expect(toast).toBe('Location set to Suramangalam, Salem');
  });

  test('English: shows "Location set to <Area>, Dharmapuri" with area', () => {
    const loc = { area: 'Gollapatti', city: 'Dharmapuri' };
    const toast = formatLocationSetToast(loc, tEn, 'en');
    expect(toast).toBe('Location set to Gollapatti, Dharmapuri');
  });

  test('English: shows "Location set to Dharmapuri" if city only', () => {
    const loc = { area: '', city: 'Dharmapuri' };
    const toast = formatLocationSetToast(loc, tEn, 'en');
    expect(toast).toBe('Location set to Dharmapuri');
  });

  test('English: fallback to "Location set to your location"', () => {
    const loc = { area: '', city: '' };
    const toast = formatLocationSetToast(loc, tEn, 'en');
    expect(toast).toBe('Location set to your location');
  });

  test('Tamil: translated toast "இருப்பிடம் அமைக்கப்பட்டது: Suramangalam, Salem"', () => {
    const loc = { area: 'Suramangalam', city: 'Salem' };
    const toast = formatLocationSetToast(loc, tTa, 'ta');
    expect(toast).toBe('இருப்பிடம் அமைக்கப்பட்டது: Suramangalam, Salem');
  });

  test('Hindi: translated toast "स्थान सेट किया गया: Suramangalam, Salem"', () => {
    const loc = { area: 'Suramangalam', city: 'Salem' };
    const toast = formatLocationSetToast(loc, tHi, 'hi');
    expect(toast).toBe('स्थान सेट किया गया: Suramangalam, Salem');
  });

  test('Never produces literal "Current Area" or "Current City"', () => {
    const loc = { area: 'Current Area', city: 'Current City' };
    const toast = formatLocationSetToast(loc, tEn, 'en');
    expect(toast).not.toContain('Current Area');
    expect(toast).not.toContain('Current City');
    expect(toast).toBe('Location set to your location');
  });
});
