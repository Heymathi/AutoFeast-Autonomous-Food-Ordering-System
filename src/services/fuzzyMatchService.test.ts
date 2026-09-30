/**
 * Unit Tests for Unified Shared Fuzzy Matching Engine
 * Validates cross-script transliteration, Indian phonetic matching, token order independence, and gibberish rejection.
 */
import { FuzzyMatchEngine } from './fuzzyMatchService';

export function runFuzzyEngineUnitTests(): { total: number; passed: number; results: Array<{ testName: string; passed: boolean; details: string }> } {
  const testResults: Array<{ testName: string; passed: boolean; details: string }> = [];

  const addResult = (testName: string, passed: boolean, details: string) => {
    testResults.push({ testName, passed, details });
    if (passed) {
      console.log(`[PASS] ${testName}: ${details}`);
    } else {
      console.error(`[FAIL] ${testName}: ${details}`);
    }
  };

  // Test Case 1: "italy", "idly", "eatly", "இட்லி", "इडली" -> Idli
  const idliInputs = ['italy', 'idly', 'eatly', 'இட்லி', 'इडली'];
  idliInputs.forEach(input => {
    const res = FuzzyMatchEngine.matchFoodItem(input);
    const isIdli = res.item?.id === 'idli-sambar';
    const isValidConf = res.confidence === 'high' || res.confidence === 'medium';
    addResult(
      `Idli Test Input: "${input}"`,
      isIdli && isValidConf,
      `Matched: "${res.item?.canonicalName || 'None'}" (Score: ${res.score}, Confidence: ${res.confidence})`
    );
  });

  // Test Case 2: "panipuri", "pani puri", "பானி பூரி", "पानी पूरी" -> Pani Puri
  const paniPuriInputs = ['panipuri', 'pani puri', 'பானி பூரி', 'पानी पूरी'];
  paniPuriInputs.forEach(input => {
    const res = FuzzyMatchEngine.matchFoodItem(input);
    const isPaniPuri = res.item?.id === 'pani-puri';
    const isValidConf = res.confidence === 'high' || res.confidence === 'medium';
    addResult(
      `Pani Puri Test Input: "${input}"`,
      isPaniPuri && isValidConf,
      `Matched: "${res.item?.canonicalName || 'None'}" (Score: ${res.score}, Confidence: ${res.confidence})`
    );
  });

  // Test Case 3: "kothu parota chicken" -> Chicken Kothu Parotta (Token order independence)
  const kothuRes = FuzzyMatchEngine.matchFoodItem('kothu parota chicken');
  const isKothu = kothuRes.item?.id === 'kothu-parotta';
  addResult(
    `Token Order Test Input: "kothu parota chicken"`,
    isKothu,
    `Matched: "${kothuRes.item?.canonicalName || 'None'}" (Score: ${kothuRes.score}, Confidence: ${kothuRes.confidence})`
  );

  // Test Case 4: Gibberish "xqzv" -> low confidence / notUnderstood
  const gibberishRes = FuzzyMatchEngine.matchFoodItem('xqzv');
  const isGibberishRejected = gibberishRes.confidence === 'low' && gibberishRes.score < 0.60;
  addResult(
    `Gibberish Test Input: "xqzv"`,
    isGibberishRejected,
    `Confidence: ${gibberishRes.confidence}, Score: ${gibberishRes.score} (Properly Rejected)`
  );

  // Test Case 5: Restricted Item check with strict threshold (>= 0.50)
  const restrictedRes = FuzzyMatchEngine.matchFoodItem('panipuri', undefined, true);
  const isRestrictedMatched = restrictedRes.score >= 0.50;
  addResult(
    `Restricted Safety Check Input: "panipuri"`,
    isRestrictedMatched,
    `Score: ${restrictedRes.score} (>= 0.50 Strict Threshold Enforced)`
  );

  const passed = testResults.filter(r => r.passed).length;
  return {
    total: testResults.length,
    passed,
    results: testResults
  };
}

runFuzzyEngineUnitTests();
