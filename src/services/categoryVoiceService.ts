import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { FoodItem, Language } from '../types';
import { LlmNluService } from './llmNluService';
import { CrossScriptPhoneticMatcher } from './crossScriptPhoneticMatcher';
import { SttMatcherService } from './sttMatcherService';

export interface CategoryQueryResult {
  isCategoryQuery: boolean;
  categoryName: string;
  varieties: FoodItem[];
  spokenPromptText: string;
}

export class CategoryVoiceService {
  private static categoryMap: { [key: string]: { label: string; ta: string; hi: string; keywords: string[] } } = {
    'dosa': { label: 'Dosa', ta: 'தோசை', hi: 'डोसा', keywords: ['dosa', 'தோசை', 'தோசா', 'डोसा'] },
    'biryani': { label: 'Biryani', ta: 'பிரியாணி', hi: 'बिरयानी', keywords: ['biryani', 'biyani', 'biriyani', 'briyani', 'பிரியாணி', 'பிரியானி', 'பிரீயாணி', 'சிக்கன் பிரியாணி', 'மட்டன் பிரியாணி', 'बिरयानी'] },
    'pizza': { label: 'Pizza', ta: 'பீட்சா', hi: 'पिज्जा', keywords: ['pizza', 'பீட்சா', 'பிஸா', 'पिज्जा', 'पिज़ा'] },
    'idli': { label: 'Idli', ta: 'இட்லி', hi: 'इडली', keywords: ['idli', 'இட்லி', 'இட்லீ', 'इडली'] },
    'parotta': { label: 'Parotta', ta: 'பரோட்டா', hi: 'परोटा', keywords: ['parotta', 'paratha', 'பரோட்டா', 'பரோடா', 'परोटा'] },
    'chaat': { label: 'Chaat & Snacks', ta: 'சாட்', hi: 'चाट', keywords: ['chaat', 'snack', 'சாட்', 'चाट', 'pani puri', 'பானி பூரி', 'पानी पूरी'] },
    'paneer': { label: 'Paneer Dishes', ta: 'பன்னீர்', hi: 'पनीर', keywords: ['paneer', 'பன்னீர்', 'पनीर'] },
    'coffee': { label: 'Coffee & Beverages', ta: 'காபி', hi: 'कॉफी', keywords: ['coffee', 'beverage', 'காபி', 'டிகிரி காபி', 'कॉफी', 'कॉफ़ी'] }
  };

  /**
   * Evaluates if a search query is a generic category and returns available catalog varieties with spoken prompt
   */
  public static checkCategoryQuery(rawQuery: string, lang: Language): CategoryQueryResult {
    if (!rawQuery || !rawQuery.trim()) {
      return { isCategoryQuery: false, categoryName: '', varieties: [], spokenPromptText: '' };
    }

    const llmExtraction = LlmNluService.extractFoodItemWithLlmSync(rawQuery);
    const extractedQuery = llmExtraction.item || rawQuery;

    for (const [catKey, catMeta] of Object.entries(this.categoryMap)) {
      const matchResult = SttMatcherService.matchVocabulary(extractedQuery, catMeta.keywords, lang);
      const matchesCategory = matchResult.isMatched || catMeta.keywords.some(kw => extractedQuery.toLowerCase().includes(kw.toLowerCase()));

      if (matchesCategory) {
        // Find all food items in catalog matching this category
        const varieties = INDIAN_FOOD_CATALOG.filter(item => {
          const itemTags = (item.tags || []).map(t => t.toLowerCase());
          return item.id.includes(catKey) || catMeta.keywords.some(kw => {
            const kwLower = kw.toLowerCase();
            return itemTags.includes(kwLower) || item.name.toLowerCase().includes(kwLower) || (item.nativeNames.ta && item.nativeNames.ta.toLowerCase().includes(kwLower));
          });
        });

        if (varieties.length >= 2) {
          const catDisplayName = lang === 'ta' ? catMeta.ta : lang === 'hi' ? catMeta.hi : catMeta.label;
          
          // Format variety names
          const namesList = varieties.slice(0, 4).map(item => item.nativeNames?.[lang] || item.name).join(', ');

          let prompt = '';
          if (lang === 'ta') {
            prompt = `${varieties.length} ${catDisplayName} வகைகள் உள்ளன: ${namesList}. இவற்றில் எது வேண்டும்?`;
          } else if (lang === 'hi') {
            prompt = `${varieties.length} ${catDisplayName} विकल्प उपलब्ध हैं: ${namesList}। आप कौन सा चाहते हैं?`;
          } else {
            prompt = `I found ${varieties.length} ${catDisplayName} options: ${namesList}. Which one would you like?`;
          }

          console.log(`[CategoryVoiceService]: Category Query Detected -> "${catKey}" (${varieties.length} varieties)`);
          return {
            isCategoryQuery: true,
            categoryName: catDisplayName,
            varieties,
            spokenPromptText: prompt
          };
        }
      }
    }

    return { isCategoryQuery: false, categoryName: '', varieties: [], spokenPromptText: '' };
  }
}
