import { GoogleGenAI } from '@google/genai';
import { INDIAN_FOOD_CATALOG } from '../src/data/indianFoodCatalog.js';

// Cache for repeated queries: key -> { matches, timestamp }
export const searchFallbackCache = new Map();
const CACHE_MAX_SIZE = 100;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Rate limit map: ip/user -> [timestamps]
export const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30;

export function resetSearchFallbackCache() {
  searchFallbackCache.clear();
}

export function resetSearchFallbackRateLimit() {
  rateLimitMap.clear();
}

// Set of valid catalog IDs for ultra-fast validation
export const VALID_CATALOG_IDS = new Set(INDIAN_FOOD_CATALOG.map(item => item.id));

// Compact closed menu: id, English, Tamil, Hindi, cuisine
export const COMPACT_MENU = INDIAN_FOOD_CATALOG.map(f => ({
  id: f.id,
  name: f.name,
  ta: f.nativeNames?.ta || f.name,
  hi: f.nativeNames?.hi || f.name,
  cuisine: f.cuisine || f.category || 'Indian'
}));

/**
 * Validates raw Gemini response:
 * 1. Checks that rawMatches is an array
 * 2. Only keeps IDs that exist in the catalog
 * 3. Drops confidence < 0.5
 * 4. Deduplicates IDs
 * 5. Sorts by confidence descending and caps at 5
 */
export function validateSearchFallbackResult(rawMatches, validCatalogIds = VALID_CATALOG_IDS) {
  if (!Array.isArray(rawMatches)) {
    return [];
  }

  const validIdSet = validCatalogIds instanceof Set ? validCatalogIds : new Set(validCatalogIds);
  const seen = new Set();
  const validMatches = [];

  for (const item of rawMatches) {
    if (!item || typeof item !== 'object') continue;
    const id = typeof item.id === 'string' ? item.id.trim() : null;
    const confidence = typeof item.confidence === 'number' ? item.confidence : parseFloat(item.confidence);

    if (!id || !validIdSet.has(id)) continue;
    if (isNaN(confidence) || confidence < 0.5 || confidence > 1.0) continue;
    if (seen.has(id)) continue;

    seen.add(id);
    validMatches.push({
      id,
      confidence: Math.round(confidence * 100) / 100
    });
  }

  validMatches.sort((a, b) => b.confidence - a.confidence);
  return validMatches.slice(0, 5);
}

function checkRateLimit(clientId) {
  const now = Date.now();
  let timestamps = rateLimitMap.get(clientId);
  if (!timestamps) {
    timestamps = [];
    rateLimitMap.set(clientId, timestamps);
  }

  // Remove timestamps outside window
  const validTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (validTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitMap.set(clientId, validTimestamps);
    return false;
  }

  validTimestamps.push(now);
  rateLimitMap.set(clientId, validTimestamps);
  return true;
}

let geminiClient = null;

export async function handleSearchFallback(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed', message: 'POST required' });
  }

  const { text, language } = req.body || {};

  // Validate body: only dish text, no personal user data
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'invalid_text', message: 'Query text is required' });
  }

  const cleanText = text.trim();
  if (cleanText.length > 300) {
    return res.status(400).json({ error: 'text_too_long', message: 'Query text exceeds 300 characters' });
  }

  const safeLang = ['en', 'ta', 'hi'].includes(language) ? language : 'en';

  // Per-user / Per-IP rate limiting
  const clientId = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(clientId)) {
    return res.status(429).json({ error: 'rate_limited', message: 'Too many search fallback requests. Please wait a minute.' });
  }

  // Check in-memory cache
  const cacheKey = `${safeLang}:${cleanText.toLowerCase()}`;
  const cached = searchFallbackCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json({ matches: cached.matches, cached: true });
  }

  // Check Gemini credentials from process.env (never logged, never sent to client)
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return res.status(503).json({
      error: 'gemini_unavailable',
      message: 'GEMINI_API_KEY is not configured on the server'
    });
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  try {
    geminiClient ||= new GoogleGenAI({ apiKey });

    const prompt = `You are the intelligent food search engine for AutoFeast.
Your job is to understand the user's food search query and match it ONLY to the dishes available in the CLOSED MENU below.

The user query may be in English, Tamil (தமிழ்), Hindi (हिंदी), Tanglish, Hinglish, with misspellings, ingredient descriptions (e.g. "முட்டை சாதம்" -> egg rice/biryani), flavor or craving descriptions (e.g. "spicy chicken rice", "मीठा कुछ", "chiken biriyani").

CRITICAL RULES:
1. ONLY return item IDs from the CLOSED MENU below. NEVER invent, hallucinate, or recommend an item not in this menu.
2. If the user query is unrelated to the menu (e.g., "tacos", "pizza", "pasta", "sushi", non-food items, or gibberish), return an empty array: {"matches": []}.
3. Return at most 5 matches.
4. Each match must include the exact menu "id" and a "confidence" between 0.0 and 1.0 (where 1.0 is exact match, 0.5-0.9 is strong semantic or ingredient match).

CLOSED MENU:
${JSON.stringify(COMPACT_MENU)}

User query: ${JSON.stringify(cleanText)}
Selected language: ${safeLang}`;

    // 5-second timeout
    const abortTimeout = new Promise((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Search fallback timed out after 5000ms'));
      }, 5000);
      if (typeof timer.unref === 'function') timer.unref();
    });

    const geminiCall = geminiClient.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            matches: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  id: { type: 'STRING' },
                  confidence: { type: 'NUMBER' }
                },
                required: ['id', 'confidence']
              }
            }
          },
          required: ['matches']
        }
      }
    });

    const response = await Promise.race([geminiCall, abortTimeout]);
    const rawText = response?.text || '';
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { matches: [] };
    }

    const validatedMatches = validateSearchFallbackResult(parsed?.matches, VALID_CATALOG_IDS);

    // Save in cache (cap cache size at 100)
    if (searchFallbackCache.size >= CACHE_MAX_SIZE) {
      const firstKey = searchFallbackCache.keys().next().value;
      if (firstKey) searchFallbackCache.delete(firstKey);
    }
    searchFallbackCache.set(cacheKey, {
      matches: validatedMatches,
      timestamp: Date.now()
    });

    return res.json({ matches: validatedMatches, cached: false });
  } catch (err) {
    if (err && err.message && err.message.includes('timed out')) {
      return res.status(504).json({ error: 'timeout', message: 'Search fallback timed out', matches: [] });
    }
    console.error('[Search Fallback] Error processing request:', err?.message || String(err));
    return res.status(502).json({ error: 'gemini_failed', message: 'Failed to process search fallback', matches: [] });
  }
}

export default handleSearchFallback;

