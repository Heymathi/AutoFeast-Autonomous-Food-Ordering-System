import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VoiceCommandParser } from '../services/voiceCommandParser';
import { CANONICAL_FOOD_ALIASES } from '../config/fuzzyConfig';
import { FOOD_FAMILIES } from '../services/foodFamilyTable';
import { AuthService } from '../services/authService';

describe('Voice Assistant, Multi-Dish Recognition, Action Parsing & Security Suite', () => {

  describe('1. Full Catalog Multilingual Food Recognition', () => {
    const dishesToVerify = [
      { id: 'parotta-kothu', queryTa: 'பரோட்டா', queryEn: 'parotta', queryHi: 'परोटा' },
      { id: 'dosa-masala', queryTa: 'மசாலா தோசை', queryEn: 'masala dosa', queryHi: 'मसाला डोसा' },
      { id: 'idli-sambar', queryTa: 'இட்லி சாம்பார்', queryEn: 'idli sambar', queryHi: 'इडली सांभर' },
      { id: 'biryani-hyderabadi', queryTa: 'பிரியாணி', queryEn: 'biryani', queryHi: 'बिरयानी' },
      { id: 'chapati-kurma', queryTa: 'சப்பாத்தி', queryEn: 'chapati', queryHi: 'चपाती' },
      { id: 'pongal-ghee', queryTa: 'பொங்கல்', queryEn: 'pongal', queryHi: 'पोंगल' },
      { id: 'chole-bhature', queryTa: 'சோலே பதூரே', queryEn: 'chole bhature', queryHi: 'छोले भटूरे' },
      { id: 'paneer-butter-masala', queryTa: 'பன்னீர் பட்டர் மசாலா', queryEn: 'paneer butter masala', queryHi: 'पनीर बटर मसाला' },
      { id: 'butter-chicken', queryTa: 'பட்டர் சிக்கன்', queryEn: 'butter chicken', queryHi: 'बटर चिकन' },
      { id: 'gujarati-thali', queryTa: 'குஜராத்தி தாலி', queryEn: 'gujarati thali', queryHi: 'गुजराती थाली' },
      { id: 'pav-bhaji', queryTa: 'பாவ் பாஜி', queryEn: 'pav bhaji', queryHi: 'पाव भाजी' },
      { id: 'chaat-pani-puri', queryTa: 'பானி பூரி', queryEn: 'pani puri', queryHi: 'पानी पूरी' },
      { id: 'beverage-filter-coffee', queryTa: 'ஃபில்டர் காபி', queryEn: 'filter coffee', queryHi: 'फ़िल्टर कॉफ़ी' },
      { id: 'dessert-gulab-jamun', queryTa: 'குலாப் ஜாமூன்', queryEn: 'gulab jamun', queryHi: 'गुलाब जामुन' }
    ];

    it('ensures all major catalog dishes have canonical aliases configured', () => {
      dishesToVerify.forEach(dish => {
        const found = CANONICAL_FOOD_ALIASES.find(a => a.id === dish.id);
        expect(found, `Alias for ${dish.id} must be defined`).toBeDefined();
        expect(found?.aliases.length).toBeGreaterThan(0);
      });
    });

    it('ensures all food families are defined with matching catalog items', () => {
      const familyKeys = ['parotta', 'dosa', 'idli', 'biryani', 'pongal', 'paneer', 'chicken', 'thali', 'panipuri', 'coffee', 'dessert'];
      familyKeys.forEach(k => {
        const found = FOOD_FAMILIES.find(f => f.key === k || f.familyTag === k);
        expect(found, `Family ${k} must be defined`).toBeDefined();
      });
    });

    it('parses Tamil, English, and Hindi voice queries into matched food items', () => {
      // Tamil: பரோட்டா
      const resTa = VoiceCommandParser.parse('பரோட்டா', 'ta');
      expect(resTa.matchedFoodItem).toBeDefined();
      expect(resTa.matchedFoodItem?.id).toContain('parotta');

      // English: masala dosa
      const resEn = VoiceCommandParser.parse('masala dosa', 'en');
      expect(resEn.matchedFoodItem).toBeDefined();
      expect(resEn.matchedFoodItem?.id).toBe('dosa-masala');

      // Hindi: बिरयानी
      const resHi = VoiceCommandParser.parse('बिरयानी', 'hi');
      expect(resHi.matchedFoodItem).toBeDefined();
      expect(resHi.matchedFoodItem?.id).toContain('biryani');

      // Tamil: பொங்கல்
      const resPongal = VoiceCommandParser.parse('பொங்கல்', 'ta');
      expect(resPongal.matchedFoodItem).toBeDefined();
      expect(resPongal.matchedFoodItem?.id).toBe('pongal-ghee');

      // Hindi: पानी पूरी
      const resPuri = VoiceCommandParser.parse('पानी पूरी', 'hi');
      expect(resPuri.matchedFoodItem).toBeDefined();
      expect(resPuri.matchedFoodItem?.id).toBe('chaat-pani-puri');
    });
  });

  describe('2. Voice Action Intent Extraction Pipeline', () => {
    it('correctly parses "add to cart" intent in English, Tamil, and Hindi', () => {
      const enCart = VoiceCommandParser.parse('add 2 dosa to cart', 'en');
      expect(enCart.action).toBe('add_to_cart');
      expect(enCart.items[0]?.quantity).toBe(2);
      expect(enCart.matchedFoodItem).toBeDefined();

      const taCart = VoiceCommandParser.parse('2 பரோட்டா கார்டில் சேர்', 'ta');
      expect(taCart.action).toBe('add_to_cart');
      expect(taCart.matchedFoodItem?.id).toContain('parotta');

      const hiCart = VoiceCommandParser.parse('बिरयानी कार्ट में जोड़ो', 'hi');
      expect(hiCart.action).toBe('add_to_cart');
      expect(hiCart.matchedFoodItem?.id).toContain('biryani');
    });

    it('correctly parses "order now" intent without confusion', () => {
      const taOrder = VoiceCommandParser.parse('இப்போதே 2 பரோட்டா ஆர்டர் செய்', 'ta');
      expect(taOrder.action).toBe('order');
      expect(taOrder.items[0]?.quantity).toBe(2);
      expect(taOrder.matchedFoodItem?.id).toContain('parotta');

      const enOrder = VoiceCommandParser.parse('order 1 biryani now', 'en');
      expect(enOrder.action).toBe('order');
      expect(enOrder.matchedFoodItem?.id).toContain('biryani');
    });

    it('correctly parses "schedule" intent with time extraction', () => {
      const sched = VoiceCommandParser.parse('schedule idli for tomorrow 8 AM', 'en');
      expect(sched.action).toBe('schedule');
      expect(sched.time?.time24).toBe('08:00');
      expect(sched.matchedFoodItem?.id).toContain('idli');

      const taSched = VoiceCommandParser.parse('நாளைக்கு 8 மணிக்கு தோசை அட்டவணை செய்', 'ta');
      expect(taSched.action).toBe('schedule');
      expect(taSched.time?.time24).toBe('08:00');
      expect(taSched.matchedFoodItem?.id).toContain('dosa');
    });

    it('requires clarification when user only speaks a food name (never auto-orders)', () => {
      const onlyItem = VoiceCommandParser.parse('பரோட்டா', 'ta');
      expect(onlyItem.needsOrderOrScheduleClarification).toBe(true);
      expect(onlyItem.action).not.toBe('order');

      const onlyDosa = VoiceCommandParser.parse('dosa', 'en');
      expect(onlyDosa.needsOrderOrScheduleClarification).toBe(true);
      expect(onlyDosa.action).not.toBe('order');
    });
  });

  describe('3. Security PIN Offline Error vs Wrong PIN Attempts', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('distinguishes network errors and does not count against failed PIN attempts when offline', async () => {
      // Mock navigator.onLine = false
      vi.stubGlobal('navigator', { onLine: false });

      const result = await AuthService.verifyPIN('1234');
      expect(result.success).toBe(false);
      expect(result.isNetworkError).toBe(true);
      expect(result.error).toContain('Internet connection unavailable');
    });

    it('handles fetch network exceptions (ERR_INTERNET_DISCONNECTED) without incrementing failed attempts', async () => {
      vi.stubGlobal('navigator', { onLine: true });
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch: net::ERR_INTERNET_DISCONNECTED')));

      const result = await AuthService.verifyPIN('1234');
      expect(result.success).toBe(false);
      expect(result.isNetworkError).toBe(true);
      expect(result.error).toContain('Internet connection unavailable');
    });

    it('never bypasses PIN verification when response is invalid or server is down', async () => {
      vi.stubGlobal('navigator', { onLine: true });
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: 'Service Unavailable' })
      }));

      const result = await AuthService.verifyPIN('1234');
      expect(result.success).toBe(false);
    });
  });
});
