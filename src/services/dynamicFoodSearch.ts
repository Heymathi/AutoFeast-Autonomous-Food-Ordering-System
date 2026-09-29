import Fuse, { IFuseOptions } from 'fuse.js';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { FoodItem } from '../types';
import { CrossScriptPhoneticMatcher } from './crossScriptPhoneticMatcher';
import { LlmNluService, LlmFoodExtractionResult } from './llmNluService';
import { SttMatcherService } from './sttMatcherService';

export interface SearchFilterOptions {
  query: string;
  selectedLocation?: string;
  selectedCuisine?: string;
  vegOnly?: boolean;
}

export interface SearchResult {
  query: string;
  isExactMatch: boolean;
  matchedItems: FoodItem[];
  suggestedItems: FoodItem[];
  extractedIntent: {
    foodKeyword?: string;
    extractedItems?: string[];
    location?: string;
    cuisine?: string;
    isVeg?: boolean;
    confidence?: number;
  };
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

    // 0. Use Centralized SttMatcherService for Fuzzy + Phonetic Match
    const sttMatch = SttMatcherService.matchCatalogItem(rawText, INDIAN_FOOD_CATALOG);
    if (sttMatch.isMatched && sttMatch.matchedValue) {
      console.log(`[ORDER_FLOW_DEBUG - Step 4 & 5: Match Selected (SttMatcherService)]: target: "${rawText}" -> item ID: "${sttMatch.matchedValue.id}", name: "${sttMatch.matchedValue.name}", confidence: ${sttMatch.confidence}`);
      return sttMatch.matchedValue;
    }

    // 2. Step 1: LLM-based Entity Extraction
    const llmExtraction = LlmNluService.extractFoodItemWithLlmSync(rawText);
    const targetItemName = (llmExtraction.item || rawText).toLowerCase().trim();
    console.log(`[ORDER_FLOW_DEBUG - Step 3: Catalog Target Item Name]: "${targetItemName}"`);

    // 2.5 Direct Substring / Primary Keyword Match Check (Before Fuse.js distance/fuzzy)
    const directExactMatch = INDIAN_FOOD_CATALOG.find(item => {
      const nameLower = item.name.toLowerCase();
      const enNative = item.nativeNames.en.toLowerCase();
      const taNative = (item.nativeNames.ta || '').toLowerCase();
      const hiNative = (item.nativeNames.hi || '').toLowerCase();
      return nameLower === targetItemName || enNative === targetItemName || taNative === targetItemName || hiNative === targetItemName;
    });

    if (directExactMatch) {
      console.log(`[ORDER_FLOW_DEBUG - Step 4 & 5: Match Selected (Direct Exact Name)]: item ID: "${directExactMatch.id}", name: "${directExactMatch.name}"`);
      return directExactMatch;
    }

    // 3. Step 2: Fuse.js Fuzzy Catalog Search
    const fuseResults = catalogFuse.search(targetItemName);
    console.log(`[ORDER_FLOW_DEBUG - Step 4: Catalog Items Returned by Fuse.js]: count = ${fuseResults.length}`, fuseResults.slice(0, 3).map(r => `${r.item.name} (${r.item.id}, score: ${r.score})`));

    if (fuseResults.length > 0) {
      const bestFuse = fuseResults[0].item;
      console.log(`[ORDER_FLOW_DEBUG - Step 5: Match Selected (Fuse.js Top Result)]: target: "${targetItemName}" → item ID: "${bestFuse.id}", name: "${bestFuse.name}", score: ${fuseResults[0].score}`);
      return bestFuse;
    }

    // Fallback: Cross-script phonetic matcher
    const phoneticQuery = CrossScriptPhoneticMatcher.toPhoneticLatin(targetItemName);
    let bestItem: FoodItem | null = null;
    let maxScore = 0;

    for (const item of INDIAN_FOOD_CATALOG) {
      let score = 0;
      const candidates = [item.name, item.nativeNames.ta, item.nativeNames.hi, ...item.tags];

      for (const candidate of candidates) {
        const candidatePhonetic = CrossScriptPhoneticMatcher.toPhoneticLatin(candidate);
        const similarity = CrossScriptPhoneticMatcher.calculateSimilarity(phoneticQuery, candidatePhonetic);
        if (similarity >= 0.5) {
          score += 100 * similarity;
        }
      }

      if (score > maxScore) {
        maxScore = score;
        bestItem = item;
      }
    }

    if (bestItem && maxScore >= 25) {
      console.log(`[ORDER_FLOW_DEBUG - Step 5: Match Selected (Phonetic Fallback)]: target: "${targetItemName}" → item ID: "${bestItem.id}", name: "${bestItem.name}", score: ${maxScore}`);
      return bestItem;
    }

    console.log(`[ORDER_FLOW_DEBUG - Step 5: No Match Selected]: target: "${targetItemName}" returned null`);
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

    // 3. STEP 1: LLM Entity Extraction & Normalization
    const llmExtraction: LlmFoodExtractionResult = LlmNluService.extractFoodItemWithLlmSync(options.query);
    const targetItems: string[] = (llmExtraction.items && llmExtraction.items.length > 0)
      ? llmExtraction.items
      : (llmExtraction.item ? [llmExtraction.item] : [options.query]);

    const isVegQuery = rawQuery.includes('veg') || rawQuery.includes('vegetarian') || rawQuery.includes('சைவம்') || options.vegOnly;

    console.log(`[Two-Stage Search Pipeline]: Input: "${options.query}" → LLM Extracted: [${targetItems.join(', ')}] (Confidence: ${llmExtraction.confidence})`);

    // 4. STEP 2: Fuse.js Catalog Search Layer
    const matchedMap = new Map<string, { item: FoodItem; score: number }>();

    for (const searchTerm of targetItems) {
      // 4.1 Direct Exact Substring Match Check First
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

      // 4.2 Fuse.js Fuzzy Search Fallback
      const fuseResults = catalogFuse.search(searchTerm);
      fuseResults.forEach(res => {
        const item = res.item;
        const fuseScore = res.score !== undefined ? 1.0 - res.score : 0.7; // Fuse.js score 0 = perfect match

        if (!matchedMap.has(item.id)) {
          matchedMap.set(item.id, { item, score: fuseScore });
        } else {
          const existing = matchedMap.get(item.id)!;
          if (fuseScore > existing.score) {
            matchedMap.set(item.id, { item, score: fuseScore });
          }
        }
      });

      // 4.3 Cross-Script Phonetic Backup Matcher
      const phoneticTerm = CrossScriptPhoneticMatcher.toPhoneticLatin(searchTerm);
      INDIAN_FOOD_CATALOG.forEach(item => {
        const candidates = [item.name, item.nativeNames.ta, item.nativeNames.hi, ...item.tags];
        for (const candidate of candidates) {
          const candidatePhonetic = CrossScriptPhoneticMatcher.toPhoneticLatin(candidate);
          const sim = CrossScriptPhoneticMatcher.calculateSimilarity(phoneticTerm, candidatePhonetic);

          if (sim >= 0.65) {
            if (!matchedMap.has(item.id)) {
              matchedMap.set(item.id, { item, score: sim * 0.9 });
            }
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
      const suggestedItems = INDIAN_FOOD_CATALOG.filter(item => {
        if (isVegQuery && !item.isVeg) return false;
        return item.rating >= 4.7;
      }).slice(0, 3);

      return {
        query: options.query,
        isExactMatch: false,
        matchedItems: [],
        suggestedItems,
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
