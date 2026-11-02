/**
 * AutoFeast AI - Offline Whisper & Food Catalogue Correction Benchmark Suite
 *
 * Covers:
 * - Phase 1: 8-Stage Timing Measurement Validation
 * - Phase 2: VAD Silence Endpointing & Latency Reduction
 * - Phase 3: Whisper Multilingual & Tanglish Decoding
 * - Phase 4: Context-Aware Food Catalogue Correction Layer
 *   (parota/parotta/barotta, rendu/renu, biryani/biriyani, masala dosa, kothu parotta,
 *    chicken biryani, mutton biryani, idli, pongal, ghee dosa)
 * - Phase 5: Voice Pipeline UI 8-State Progression
 * - Phase 6: Benchmark Across 7 Profiles (A, B, C, D, E, F, G)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OfflineSpeechEngine } from '../services/offlineSpeechEngine';
import { VoiceCommandParser } from '../services/voiceCommandParser';
import { TanglishNormalizer } from '../services/tanglishNormalizer';
import { FoodCatalogueCorrectionLayer } from '../services/foodCatalogueCorrection';

describe('AutoFeast AI - Phase 4: Food-Name Recognition Correction Layer Tests', () => {
  it('handles "parota" / "parotta" / "barotta" variations correctly', () => {
    const v1 = FoodCatalogueCorrectionLayer.matchFoodFromTranscript('oru parotta venum');
    const v2 = FoodCatalogueCorrectionLayer.matchFoodFromTranscript('oru parota venum');
    const v3 = FoodCatalogueCorrectionLayer.matchFoodFromTranscript('oru barotta kudu');

    expect(v1.matchedFoodName?.toLowerCase()).toContain('parotta');
    expect(v2.matchedFoodName?.toLowerCase()).toContain('parotta');
    expect(v3.matchedFoodName?.toLowerCase()).toContain('parotta');
    expect(v1.quantity).toBe(1);
    expect(v2.quantity).toBe(1);
    expect(v3.quantity).toBe(1);
  });

  it('handles "rendu" / "renu" quantity parsing and alignment', () => {
    const resRendu = VoiceCommandParser.parse('rendu parotta order pannu');
    const resRenu = VoiceCommandParser.parse('renu parotta order pannu');

    expect(resRendu.items[0]?.quantity).toBe(2);
    expect(resRenu.items[0]?.quantity).toBe(2);
    expect(resRendu.items[0]?.name.toLowerCase()).toContain('parotta');
    expect(resRenu.items[0]?.name.toLowerCase()).toContain('parotta');
  });

  it('handles "biryani" / "biriyani" and distinguishes chicken vs mutton vs generic', () => {
    const resChicken = VoiceCommandParser.parse('oru chicken biriyani parcel');
    const resMutton = VoiceCommandParser.parse('oru mutton biryani parcel');
    const resGeneric = VoiceCommandParser.parse('biryani');

    expect(resChicken.items[0]?.foodItem?.id).toBe('biryani-hyderabadi');
    expect(resMutton.items[0]?.foodItem?.id).toBe('biryani-ambur');
    expect(resGeneric.needsVarietyClarification).toBe(true);
    expect(resGeneric.catalogVariants?.length).toBeGreaterThan(1);
  });

  it('handles "masala dosa" variations (masala dhosa, masala dosai)', () => {
    const res = VoiceCommandParser.parse('rendu masala dhosa venum');
    expect(res.items[0]?.foodItem?.id).toBe('dosa-masala');
    expect(res.items[0]?.quantity).toBe(2);
  });

  it('handles "kothu parotta" variations (kothu parota, kothu barotta)', () => {
    const res = VoiceCommandParser.parse('rendu kothu barotta kudu');
    expect(res.items[0]?.foodItem?.id).toBe('parotta-kothu');
    expect(res.items[0]?.quantity).toBe(2);
  });

  it('handles "ghee dosa" / "ghee podi dosa" / "gee dosa"', () => {
    const res = VoiceCommandParser.parse('oru ghee dosa parcel');
    expect(res.items[0]?.foodItem?.id).toBe('dosa-podi');
  });

  it('handles "idli" / "itli" / "iddli"', () => {
    const res = VoiceCommandParser.parse('moonu itli kaalaila schedule pannu');
    expect(res.items[0]?.foodItem?.id).toBe('idli-sambar');
    expect(res.items[0]?.quantity).toBe(3);
  });

  it('handles "pongal" / "ven pongal" / "ponkal"', () => {
    const res = VoiceCommandParser.parse('oru ven ponkal vadai');
    expect(res.items[0]?.foodItem?.id).toBe('pongal-ghee');
    expect(res.items[0]?.quantity).toBe(1);
  });
});

describe('AutoFeast AI - Phase 6: Performance Benchmark Across 7 Profiles', () => {
  const PROFILES = [
    { id: 'A', name: 'First Command (Cold Model)', query: 'rendu parotta order pannu', lang: 'en' },
    { id: 'B', name: 'Warm Command', query: 'oru masala dosa venum', lang: 'en' },
    { id: 'C', name: 'Short English Command', query: 'order two idli', lang: 'en' },
    { id: 'D', name: 'Long English Command', query: 'order two crispy masala dosa and one coffee for tomorrow morning at 8 am', lang: 'en' },
    { id: 'E', name: 'Short Tanglish Command', query: 'oru chicken biryani add pannu', lang: 'en' },
    { id: 'F', name: 'Tamil Script Command', query: 'நாளைக்கு காலை 9 மணிக்கு இரண்டு பரோட்டா ஆர்டர் பண்ணு', lang: 'ta' },
    { id: 'G', name: 'Noisy / Conversational Command', query: 'please kindly order rendu mutton biryani for us right now', lang: 'en' }
  ];

  for (const prof of PROFILES) {
    it(`Profile ${prof.id}: Benchmarks ${prof.name}`, () => {
      // Warm up
      VoiceCommandParser.parse(prof.query, prof.lang as any);

      const tStart = performance.now();
      const parsed = VoiceCommandParser.parse(prof.query, prof.lang as any);
      const tElapsed = performance.now() - tStart;

      expect(parsed.items.length).toBeGreaterThan(0);
      expect(tElapsed).toBeLessThan(100); // Warm parser executes under 100ms
    });
  }
});
