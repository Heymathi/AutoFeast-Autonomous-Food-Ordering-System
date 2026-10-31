import Fuse, { IFuseOptions } from 'fuse.js';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { FoodItem, Language } from '../types';
import { CrossScriptPhoneticMatcher } from './crossScriptPhoneticMatcher';
import { LlmNluService, LlmFoodExtractionResult } from './llmNluService';
import { SttMatcherService } from './sttMatcherService';
import { FuzzyMatchEngine } from './fuzzyMatchService';
import { detectFoodFamilyIntent } from './foodFamilyTable';

export interface SearchFilterOptions {
  query: string;
  language?: Language;
  selectedLocation?: string;
  selectedCuisine?: string;
  vegOnly?: boolean;
}

export interface SearchResult {
  query: string;
  isExactMatch: boolean;
  matchedItems: FoodItem[];
  suggestedItems: FoodItem[];
  didYouMean?: FoodItem;
  extractedIntent: {
    foodKeyword?: string;
    extractedItems?: string[];
    location?: string;
    cuisine?: string;
    isVeg?: boolean;
    confidence?: number;
  };
  isSmartSearch?: boolean;
  offlineHint?: boolean;
}

// 🚀 INITIALIZE FUSE.JS INDEX OVER CATALOG
const fuseOptions: IFuseOptions<FoodItem> = {
  keys: [
    { name: 'name', weight: 0.4 },
    { name: 'nativeNames.en', weight: 0.3 },
    { name: 'nativeNames.ta', weight: 0.3 },
    { name: 'nativeNames.hi', weight: 0.3 },
    { name: 'tags', weight: 0.3 },
    { name: 'category', weight: 0.2 },
    { name: 'cuisine', weight: 0.2 }
  ],
  threshold: 0.4,
  ignoreLocation: true,
  includeScore: true
};

const catalogFuse = new Fuse(INDIAN_FOOD_CATALOG, fuseOptions);

export class DynamicFoodSearchEngine {
  /**
   * 🚀 SMART MULTILINGUAL FOOD MATCHER FOR VOICE & TEXT
   * Stage 1: LLM Extraction & Normalization
   * Stage 2: Fuse.js Catalog Search Layer
   */
  public static findBestMatchingFoodItem(rawText: string): FoodItem | null {
    if (!rawText || !rawText.trim()) return null;

    const normalized = rawText.toLowerCase().trim();
    console.log(`[ORDER_FLOW_DEBUG - Step 3: Catalog Search Query]: Searching for rawText: "${rawText}" (normalized: "${normalized}")`);

    const fuzzyRes = FuzzyMatchEngine.matchCatalogFoodItem(rawText, INDIAN_FOOD_CATALOG);
    if (fuzzyRes.item && (fuzzyRes.confidence === 'high' || fuzzyRes.confidence === 'medium')) {
      console.log(`[ORDER_FLOW_DEBUG - Match Selected (FuzzyMatchEngine)]: target: "${rawText}" -> item ID: "${fuzzyRes.item.id}", name: "${fuzzyRes.item.name}", confidence: ${fuzzyRes.confidence} (${fuzzyRes.score})`);
      return fuzzyRes.item;
    }

    // Direct Exact Substring Check Fallback
    const targetItemName = rawText.toLowerCase().trim();
    const directExactMatch = INDIAN_FOOD_CATALOG.find(item => {
      const nameLower = item.name.toLowerCase();
      const enNative = item.nativeNames.en.toLowerCase();
      const taNative = (item.nativeNames.ta || '').toLowerCase();
      const hiNative = (item.nativeNames.hi || '').toLowerCase();
      return nameLower === targetItemName || enNative === targetItemName || taNative === targetItemName || hiNative === targetItemName;
    });

    if (directExactMatch) {
      return directExactMatch;
    }

    return null;
  }

  /**
   * 🚀 TWO-STAGE SEARCH PIPELINE (LLM Extraction + Fuse.js Search Layer)
   */
  public static search(options: SearchFilterOptions): SearchResult {
    const rawQuery = options.query.trim().toLowerCase();

    // If query is empty, return initial catalog filtered by location/cuisine/veg
    if (!rawQuery) {
      const filtered = INDIAN_FOOD_CATALOG.filter(item => {
        if (options.vegOnly && !item.isVeg) return false;
        if (options.selectedCuisine && options.selectedCuisine !== 'All' && item.cuisine !== options.selectedCuisine) return false;
        if (options.selectedLocation && options.selectedLocation !== 'All' && !item.locations.includes(options.selectedLocation) && !item.locations.includes('All')) return false;
        return true;
      });

      return {
        query: options.query,
        isExactMatch: true,
        matchedItems: filtered,
        suggestedItems: [],
        extractedIntent: {}
      };
    }

    // 1. Extract location mentions in query
    const locationsList = ['chennai', 'salem', 'bengaluru', 'hyderabad', 'mumbai', 'delhi', 'coimbatore', 'madurai', 'kochi', 'ahmedabad'];
    let extractedLocation = options.selectedLocation && options.selectedLocation !== 'All' ? options.selectedLocation : undefined;
    
    for (const loc of locationsList) {
      if (rawQuery.includes(loc)) {
        extractedLocation = loc.charAt(0).toUpperCase() + loc.slice(1);
        break;
      }
    }

    // 2. Extract cuisine mentions
    const cuisinesList = [
      'south indian', 'north indian', 'tamil', 'kerala', 'andhra', 'telangana',
      'karnataka', 'bengali', 'gujarati', 'maharashtrian', 'punjabi', 'rajasthani',
      'mughlai', 'chinese', 'indo-chinese', 'fast food', 'street food', 'dessert', 'beverage',
      'குஜராத்தி', 'கேரளா', 'தமிழ்'
    ];
    let extractedCuisine = options.selectedCuisine && options.selectedCuisine !== 'All' ? options.selectedCuisine : undefined;
    
    for (const cuis of cuisinesList) {
      if (rawQuery.includes(cuis)) {
        extractedCuisine = cuis;
        break;
      }
    }

    // ── STEP 0: Family / Variant Pre-check (runs BEFORE LLM & fuzzy) ───────────
    // Strip filler words then check if the query is a pure generic family name
    // ("dosa", "தோசை", "डोसा", etc.) OR a specific variant ("masala dosa").
    // This prevents the fuzzy engine from picking the top-1 item and showing
    // a spurious "Did you mean Masala Dosa?" for a bare family name.
    const familyIntent = detectFoodFamilyIntent(options.query);
    const familyCheck = familyIntent?.kind === 'family' ? familyIntent.family : null;
    const variantCheck = familyIntent?.kind === 'variant' && familyIntent.variantToken
      ? { familyKey: familyIntent.family.key, variantToken: familyIntent.variantToken }
      : null;

    const isVegQuery = rawQuery.includes('veg') || rawQuery.includes('vegetarian') || rawQuery.includes('சைவம்') || options.vegOnly;

    if (familyCheck) {
      // ── GENERIC FAMILY QUERY: return ALL catalog items that share this family tag ──
      const familyTag = familyCheck.familyTag;
      console.log(`[Family Pre-check]: transcript="${options.query}" normalized="${familyIntent?.normalizedQuery}" score=${familyIntent?.score} rule=exact-family-alias family="${familyTag}"`);

      const familyItems = INDIAN_FOOD_CATALOG.filter(item => {
        const tags = (item.tags || []).map(t => t.toLowerCase());
        if (!tags.includes(familyTag)) return false;
        if (isVegQuery && !item.isVeg) return false;
        if (extractedLocation && extractedLocation !== 'All') {
          if (!item.locations.some(l => l.toLowerCase() === extractedLocation!.toLowerCase() || l === 'All')) return false;
        }
        if (extractedCuisine && extractedCuisine !== 'All') {
          if (!item.cuisine.toLowerCase().includes(extractedCuisine.toLowerCase()) &&
              !item.category.toLowerCase().includes(extractedCuisine.toLowerCase())) return false;
        }
        return true;
      });

      if (familyItems.length === 0) {
        console.log(`[Food search no-match]: transcript="${options.query}" normalized="${familyIntent?.normalizedQuery}" score=${familyIntent?.score} rule=recognized-family-with-no-catalog-items`);
        return {
          query: options.query,
          isExactMatch: false,
          matchedItems: [],
          suggestedItems: [],
          extractedIntent: { foodKeyword: familyTag, confidence: 1 },
        };
      } else {
        console.log(`[Family Pre-check]: Returning ${familyItems.length} items for family "${familyTag}".`);
        return {
          query: options.query,
          isExactMatch: true,
          matchedItems: familyItems,
          suggestedItems: [],
          // Never show "Did you mean" for a correctly detected generic family
          didYouMean: undefined,
          extractedIntent: {
            foodKeyword: familyTag,
            extractedItems: familyItems.map(i => i.name),
            location: extractedLocation,
            cuisine: extractedCuisine,
            isVeg: isVegQuery,
            confidence: 1.0,
          },
        };
      }
    }

    if (variantCheck) {
      // ── SPECIFIC VARIANT QUERY: filter to items that carry both the family tag
      //    AND the variant token somewhere in their tags/name/nativeNames ─────────
      const { familyKey, variantToken } = variantCheck;
      console.log(`[Variant Pre-check]: transcript="${options.query}" normalized="${familyIntent?.normalizedQuery}" score=${familyIntent?.score} rule=family-and-variant-alias family="${familyKey}" token="${variantToken}"`);

      const variantItems = INDIAN_FOOD_CATALOG.filter(item => {
        const tags = (item.tags || []).map(t => t.toLowerCase());
        const familyHit = tags.includes(familyKey);
        if (!familyHit) return false;
        const tokenLower = variantToken.toLowerCase();
        const nameHit = item.name.toLowerCase().includes(tokenLower) ||
          (item.nativeNames?.en || '').toLowerCase().includes(tokenLower) ||
          (item.nativeNames?.ta || '').toLowerCase().includes(tokenLower) ||
          (item.nativeNames?.hi || '').toLowerCase().includes(tokenLower) ||
          tags.some(t => t.includes(tokenLower));
        if (!nameHit) return false;
        if (isVegQuery && !item.isVeg) return false;
        if (extractedLocation && extractedLocation !== 'All') {
          if (!item.locations.some(l => l.toLowerCase() === extractedLocation!.toLowerCase() || l === 'All')) return false;
        }
        return true;
      });

      if (variantItems.length > 0) {
        console.log(`[Variant Pre-check]: Returning ${variantItems.length} items for variant "${variantToken}" in family "${familyKey}".`);
        return {
          query: options.query,
          isExactMatch: true,
          matchedItems: variantItems,
          suggestedItems: [],
          didYouMean: undefined,
          extractedIntent: {
            foodKeyword: variantToken,
            extractedItems: variantItems.map(i => i.name),
            location: extractedLocation,
            cuisine: extractedCuisine,
            isVeg: isVegQuery,
            confidence: 0.95,
          },
        };
      }
      const relatedItems = INDIAN_FOOD_CATALOG.filter(item =>
        (item.tags || []).some(tag => tag.toLowerCase() === familyIntent.family.familyTag)
      ).slice(0, 3);
      console.log(`[Food search no-match]: transcript="${options.query}" normalized="${familyIntent.normalizedQuery}" score=${familyIntent.score} rule=recognized-variant-with-no-catalog-match`);
      return {
        query: options.query,
        isExactMatch: false,
        matchedItems: [],
        suggestedItems: relatedItems,
        extractedIntent: {
          foodKeyword: variantToken,
          location: extractedLocation,
          cuisine: extractedCuisine,
          isVeg: isVegQuery,
          confidence: 1,
        },
      };
    }

    // 3. STEP 1: LLM Entity Extraction & Normalization
    const llmExtraction: LlmFoodExtractionResult = LlmNluService.extractFoodItemWithLlmSync(options.query, options.language);
    const targetItems: string[] = (llmExtraction.items && llmExtraction.items.length > 0)
      ? llmExtraction.items
      : (llmExtraction.item ? [llmExtraction.item] : [options.query]);

    console.log(`[Two-Stage Search Pipeline]: Input: "${options.query}" → LLM Extracted: [${targetItems.join(', ')}] (Confidence: ${llmExtraction.confidence})`);

    // 4. STEP 2: Unified FuzzyMatchEngine + Catalog Search Layer
    const matchedMap = new Map<string, { item: FoodItem; score: number }>();
    const overallFuzzy = FuzzyMatchEngine.matchCatalogFoodItem(options.query, INDIAN_FOOD_CATALOG);
    let didYouMean: FoodItem | undefined = undefined;

    if (overallFuzzy.item && overallFuzzy.confidence === 'medium') {
      didYouMean = overallFuzzy.item;
    }

    for (const searchTerm of targetItems) {
      // 4.1 FuzzyMatchEngine scoring on every catalog item
      INDIAN_FOOD_CATALOG.forEach(item => {
        const fuzzyRes = FuzzyMatchEngine.matchCatalogFoodItem(searchTerm, [item]);
        if (fuzzyRes.score >= 0.50) {
          if (!matchedMap.has(item.id)) {
            matchedMap.set(item.id, { item, score: fuzzyRes.score });
          } else {
            const existing = matchedMap.get(item.id)!;
            if (fuzzyRes.score > existing.score) {
              matchedMap.set(item.id, { item, score: fuzzyRes.score });
            }
          }
        }
      });

      // 4.2 Direct Substring Check
      const termLower = searchTerm.toLowerCase();
      const directMatches = INDIAN_FOOD_CATALOG.filter(item => {
        const nameLower = item.name.toLowerCase();
        const taName = item.nativeNames.ta.toLowerCase();
        const hiName = item.nativeNames.hi.toLowerCase();
        const genericNoiseTags = ['tamil', 'english', 'hindi', 'ta', 'en', 'hi', 'all', 'south indian', 'north indian'];
        const tags = item.tags.map(t => t.toLowerCase()).filter(t => !genericNoiseTags.includes(t));

        return nameLower.includes(termLower) || taName.includes(termLower) || hiName.includes(termLower) || tags.some(t => t === termLower || termLower.includes(t) || t.includes(termLower));
      });

      directMatches.forEach(item => {
        if (!matchedMap.has(item.id)) {
          matchedMap.set(item.id, { item, score: 1.0 });
        }
      });

      // 4.3 Fuse.js Fuzzy Search Fallback
      const fuseResults = catalogFuse.search(searchTerm);
      fuseResults.forEach(res => {
        const item = res.item;
        const fuseScore = res.score !== undefined ? 1.0 - res.score : 0.7; // Fuse.js score 0 = perfect match
        if (fuseScore < 0.5) return;

        if (!matchedMap.has(item.id)) {
          matchedMap.set(item.id, { item, score: fuseScore });
        } else {
          const existing = matchedMap.get(item.id)!;
          if (fuseScore > existing.score) {
            matchedMap.set(item.id, { item, score: fuseScore });
          }
        }
      });
    }

    // Filter matched items by Veg/Location/Cuisine constraints
    let filteredResults = Array.from(matchedMap.values()).filter(({ item }) => {
      if (isVegQuery && !item.isVeg) return false;

      if (extractedLocation && extractedLocation !== 'All') {
        const matchesLoc = item.locations.some(l => l.toLowerCase() === extractedLocation!.toLowerCase() || l === 'All');
        if (!matchesLoc) return false;
      }

      if (extractedCuisine && extractedCuisine !== 'All') {
        const matchesCuis = item.cuisine.toLowerCase().includes(extractedCuisine.toLowerCase()) || item.category.toLowerCase().includes(extractedCuisine.toLowerCase());
        if (!matchesCuis) return false;
      }

      return true;
    });

    // Sort by Fuse.js/Match score descending
    filteredResults.sort((a, b) => b.score - a.score);
    const finalMatchedItems = filteredResults.map(r => r.item);

    // Logging Stage Result
    console.log('[NLP Search Engine Log]:', {
      original_phrase: options.query,
      llm_output: llmExtraction,
      final_matched_items: finalMatchedItems.map(i => i.name)
    });

    // 5. Fallback Policy:
    // If no direct/fuse matches found, return top suggested items
    if (finalMatchedItems.length === 0) {
      const suggestedItems = overallFuzzy.topAlternatives
        .filter(({ score }) => score >= 0.6)
        .map(({ item }) => item)
        .slice(0, 3);
      console.log(`[Food search no-match]: transcript="${options.query}" normalized="${rawQuery}" score=${overallFuzzy.score} rule=no-relevant-fuzzy-candidate`);

      return {
        query: options.query,
        isExactMatch: false,
        matchedItems: [],
        suggestedItems,
        didYouMean,
        extractedIntent: {
          foodKeyword: llmExtraction.item || undefined,
          extractedItems: targetItems,
          location: extractedLocation,
          cuisine: extractedCuisine,
          isVeg: isVegQuery,
          confidence: llmExtraction.confidence
        }
      };
    }

    return {
      query: options.query,
      isExactMatch: true,
      matchedItems: finalMatchedItems,
      suggestedItems: [],
      didYouMean,
      extractedIntent: {
        foodKeyword: llmExtraction.item || undefined,
        extractedItems: targetItems,
        location: extractedLocation,
        cuisine: extractedCuisine,
        isVeg: isVegQuery,
        confidence: llmExtraction.confidence
      }
    };
  }
}
