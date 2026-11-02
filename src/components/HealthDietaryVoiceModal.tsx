import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { FoodItem } from '../types';
import { HealthDietaryNluService, HealthDietaryAnalysisResult, HealthFoodSuggestion } from '../services/healthDietaryNluService';
import { PriceComparisonService, PriceComparisonSummary } from '../services/priceComparisonService';
import { SttMatcherService } from '../services/sttMatcherService';
import { VoiceIntentRouter } from '../services/voiceIntentRouter';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { ScheduleCheckoutModal } from './ScheduleCheckoutModal';
import { ItemActionChooser } from './ItemActionChooser';
import { SpeechController } from '../services/speechController';
import {
  Mic,
  MicOff,
  X,
  HeartPulse,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  Zap,
  Clock,
  Volume2,
  Store,
  Star,
  Award,
  ChevronRight,
  ShoppingBag,
  Search,
  RotateCcw,
  Scale
} from 'lucide-react';

interface HealthDietaryVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type HealthModalStep = 'speak_condition' | 'analyzing' | 'view_suggestions' | 'view_price_comparison';

export const HealthDietaryVoiceModal: React.FC<HealthDietaryVoiceModalProps> = ({
  isOpen,
  onClose
}) => {
  const {
    language,
    speakText,
    placeInstantOrder,
    addToCart,
    t,
    showToast,
    currentUser,
    vegOnly,
    checkIsItemRestrictedByNominee,
    openPriceComparison
  } = useApp();

  const [step, setStep] = useState<HealthModalStep>('speak_condition');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<HealthDietaryAnalysisResult | null>(null);
  const [selectedItem, setSelectedItem] = useState<FoodItem | null>(null);
  const [priceComparison, setPriceComparison] = useState<PriceComparisonSummary | null>(null);
  const [isSchedulingModalOpen, setIsSchedulingModalOpen] = useState(false);
  const [chooserItem, setChooserItem] = useState<FoodItem | null>(null);
  const chooserItems = useMemo(() => (chooserItem ? [chooserItem] : []), [chooserItem]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stepRef = useRef<HealthModalStep>('speak_condition');
  const isComponentMounted = useRef(true);
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);

  const savedHealthCondition = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const stored =
      localStorage.getItem('autofeast_health_condition_details') ||
      localStorage.getItem('autofeast_health_conditions');
    if (stored && stored.trim()) return stored.trim();
    if (
      (currentUser as any)?.healthConditions &&
      Array.isArray((currentUser as any).healthConditions) &&
      (currentUser as any).healthConditions.length > 0
    ) {
      return (currentUser as any).healthConditions.join(', ').trim();
    }
    return '';
  }, [currentUser]);

  useEffect(() => {
    isComponentMounted.current = true;
    return () => {
      isComponentMounted.current = false;
      if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
      SpeechController.releaseMic('healthy_food');
    };
  }, []);

  const getDisclaimerText = useCallback(() => {
    if (language === 'ta') {
      return 'இது ஒரு பொதுவான உணவுப் பரிந்துரை மட்டுமே, மருத்துவ ஆலோசனை அல்ல. உங்கள் உடல்நலக் கோளாறுக்கு மருத்துவரை அணுகவும்.';
    }
    if (language === 'hi') {
      return 'यह एक सामान्य आहार सुझाव है, चिकित्सीय सलाह नहीं — कृपया अपनी स्थिति के लिए डॉक्टर से परामर्श लें।';
    }
    return 'This is a general dietary suggestion, not medical advice — please consult a doctor for your condition.';
  }, [language]);

  /**
   * Main Analysis Handler:
   * Accepts text or voice input, enforces timeout protection, never blocks indefinitely.
   */
  const handleAnalyzeHealthText = useCallback(
    async (text: string, candidates: string[] = [text]) => {
      const query = (text || '').trim();
      if (!query && !savedHealthCondition) return;

      SpeechController.stopListening('healthy_food');
      setIsListening(false);
      setErrorMessage(null);
      setStep('analyzing');
      stepRef.current = 'analyzing';

      console.log(`[HealthDietaryVoiceModal] Analyzing health query: "${query}" (saved: "${savedHealthCondition}")`);

      const effectiveQuery = query || savedHealthCondition;

      // Watchdog timeout timer: guarantees step never hangs past 4.5 seconds
      if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = setTimeout(() => {
        if (stepRef.current === 'analyzing' && isComponentMounted.current) {
          console.warn('[HealthDietaryVoiceModal] Watchdog fired: forcing immediate catalog suggestions.');
          const directFallback = HealthDietaryNluService.generateCatalogHealthSuggestions(
            effectiveQuery,
            language,
            savedHealthCondition
          );
          setAnalysisResult(directFallback);
          setStep('view_suggestions');
          stepRef.current = 'view_suggestions';
        }
      }, 4500);

      try {
        const primaryInput = candidates[0] || effectiveQuery;
        const result = await HealthDietaryNluService.analyzeHealthContextAndSuggestFood(
          primaryInput,
          language,
          savedHealthCondition
        );

        if (!isComponentMounted.current) return;

        // Filter restricted items
        const safeSuggestions = result.suggestions.filter(s => {
          const isRestricted = checkIsItemRestrictedByNominee(s.foodItem.id, s.foodItem.name);
          if (isRestricted) return false;
          if (vegOnly && !s.foodItem.isVeg) return false;
          return true;
        });

        const safeResult: HealthDietaryAnalysisResult = {
          ...result,
          suggestions: safeSuggestions.length > 0 ? safeSuggestions : result.suggestions
        };

        if (safeResult.suggestions.length === 0) {
          setErrorMessage(
            language === 'ta'
              ? 'உங்கள் தேவைகளுக்கு ஏற்ற உணவுகள் பட்டியலில் கிடைக்கவில்லை. தயவுசெய்து வேறு வினவலை முயற்சிக்கவும்.'
              : language === 'hi'
              ? 'आपकी आवश्यकताओं के अनुसार कैटलॉग में कोई व्यंजन नहीं मिला। कृपया अन्य खोज करें।'
              : 'No matching dishes found in catalog matching all requirements. Please try another request.'
          );
        } else {
          setAnalysisResult(safeResult);
        }

        setStep('view_suggestions');
        stepRef.current = 'view_suggestions';

        // Read suggestions aloud gently
        speakSuggestionsAloud(safeResult);
      } catch (err: any) {
        console.error('[HealthDietaryVoiceModal] Analysis error, recovering via deterministic catalog:', err);
        if (!isComponentMounted.current) return;

        const fallback = HealthDietaryNluService.generateCatalogHealthSuggestions(
          effectiveQuery,
          language,
          savedHealthCondition
        );
        setAnalysisResult(fallback);
        setStep('view_suggestions');
        stepRef.current = 'view_suggestions';
      } finally {
        if (watchdogTimerRef.current) {
          clearTimeout(watchdogTimerRef.current);
          watchdogTimerRef.current = null;
        }
      }
    },
    [language, savedHealthCondition, checkIsItemRestrictedByNominee, vegOnly]
  );

  const speakSuggestionsAloud = (result: HealthDietaryAnalysisResult) => {
    if (!result || !result.suggestions || result.suggestions.length === 0) return;
    const disclaimer = getDisclaimerText();

    const introMsg =
      language === 'ta'
        ? `${disclaimer} உங்களுக்கான லேசான உணவுப் பரிந்துரைகள்:`
        : language === 'hi'
        ? `${disclaimer} आपके लिए सुपाच्य आहार सुझाव:`
        : `${disclaimer} Here are general food suggestions for your situation:`;

    const itemsSummary = result.suggestions
      .slice(0, 3)
      .map(s => {
        const name = s.foodItem.nativeNames?.[language] || s.foodItem.name;
        const reason = language === 'ta' ? s.reasonTa : language === 'hi' ? s.reasonHi : s.reasonEn;
        return `${name}. ${reason}`;
      })
      .join('. ');

    const fullSpeechText = `${introMsg} ${itemsSummary}`;

    speakText(fullSpeechText, () => {
      if (isComponentMounted.current && isOpen && stepRef.current === 'view_suggestions') {
        startListeningForItemSelection(result.suggestions.map(s => s.foodItem));
      }
    });
  };

  const startListeningForCondition = () => {
    if (!isOpen) return;

    stepRef.current = 'speak_condition';
    setStep('speak_condition');
    console.log('[HealthDietaryVoiceModal]: Starting microphone stream via SpeechController...');

    SpeechController.startListening({
      owner: 'healthy_food',
      language,
      continuous: false,
      interimResults: true,
      maxAlternatives: 5,
      silenceTimeoutMs: 8000,
      onSilence: () => setIsListening(false),
      onStart: () => setIsListening(true),
      onResult: (text, isFinal, nBest) => {
        if (!text) return;
        setLiveTranscript(text);
        if (!isFinal) return;

        const candidates = nBest && nBest.length > 0 ? nBest : [text];
        handleAnalyzeHealthText(text, candidates);
      },
      onError: err => {
        console.warn('[HealthDietaryVoiceModal Mic Error]:', err);
        setIsListening(false);
      },
      onEnd: () => {
        setIsListening(false);
      }
    });
  };

  const startListeningForItemSelection = (availableCatalog: FoodItem[]) => {
    if (!isOpen) return;

    stepRef.current = 'view_suggestions';

    SpeechController.startListening({
      owner: 'healthy_food',
      language,
      continuous: true,
      interimResults: true,
      onStart: () => setIsListening(true),
      onResult: (text, isFinal, nBest) => {
        if (!text) return;
        setLiveTranscript(text);
        if (!isFinal) return;

        const candidates = nBest && nBest.length > 0 ? nBest : [text];
        const confirmMatch = VoiceIntentRouter.matchConfirmationIntent(candidates, language);
        if (confirmMatch.action === 'cancel') {
          SpeechController.stopListening('healthy_food');
          setIsListening(false);
          onClose();
          return;
        }

        const norm = VoiceIntentRouter.normalize(text);
        let matchedFood = SttMatcherService.matchFoodItem(candidates, availableCatalog, language);
        if (!matchedFood) {
          if (/^(1|one|first|ஒன்று|ஒன்னு|एक|पहला)$/.test(norm) && availableCatalog[0]) {
            matchedFood = availableCatalog[0];
          } else if (/^(2|two|second|இரண்டு|ரெண்டு|दो|दूसरा)$/.test(norm) && availableCatalog[1]) {
            matchedFood = availableCatalog[1];
          } else if (/^(3|three|third|மூன்று|மூணு|तीन|तीसरा)$/.test(norm) && availableCatalog[2]) {
            matchedFood = availableCatalog[2];
          } else {
            matchedFood = SttMatcherService.matchFoodItem(candidates, INDIAN_FOOD_CATALOG, language);
          }
        }
        if (matchedFood) {
          SpeechController.stopListening('healthy_food');
          setIsListening(false);
          handleSelectItem(matchedFood);
        }
      },
      onError: err => {
        console.warn('[Health Choice Listening Error]:', err);
        setIsListening(false);
      },
      onEnd: () => {
        setIsListening(false);
      }
    });
  };

  const handleSelectItem = (item: FoodItem) => {
    setSelectedItem(item);
    const comparison = PriceComparisonService.compare(item.platforms);
    setPriceComparison(comparison);

    setStep('view_price_comparison');
    stepRef.current = 'view_price_comparison';

    // Open shared ItemActionChooser for Order Now / Schedule / Add to Cart
    setChooserItem(item);
  };

  const prevOpenRef = useRef<boolean>(false);

  // Reset modal state strictly on opening transition
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = isOpen;

    if (!wasOpen && isOpen) {
      setLiveTranscript('');
      setManualInput('');
      setSelectedItem(null);
      setPriceComparison(null);
      setErrorMessage(null);

      // If user has saved health condition profile, automatically trigger analysis
      if (savedHealthCondition) {
        handleAnalyzeHealthText(savedHealthCondition);
      } else {
        setStep('speak_condition');
        stepRef.current = 'speak_condition';
        setAnalysisResult(null);
      }
    } else if (wasOpen && !isOpen) {
      if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
      SpeechController.releaseMic('healthy_food');
    }
  }, [isOpen, savedHealthCondition, handleAnalyzeHealthText]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-[#302720]/40 backdrop-blur-sm p-4 animate-fade-in overflow-y-auto">
      <div className="bg-[#FFF8EF] text-[#302720] rounded-3xl max-w-xl w-full p-6 shadow-2xl border-2 border-[#E9DED5] relative space-y-5 my-8">
        
        {/* Close Button */}
        <button
          onClick={() => {
            SpeechController.releaseMic('healthy_food');
            setIsListening(false);
            onClose();
          }}
          className="absolute top-4 right-4 p-2 rounded-full bg-[#FCE8E3] hover:bg-[#E9DED5] text-[#786E64] z-10 cursor-pointer"
          aria-label="Close Health Recommendations"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-[#FCE8E3] text-[#D93636] rounded-2xl border border-[#E9DED5]">
            <HeartPulse className="w-7 h-7 text-[#D93636] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black uppercase text-[#D93636] tracking-wider">
                {language === 'ta'
                  ? 'உடல்நல & உணவு வழிகாட்டி'
                  : language === 'hi'
                  ? 'स्वास्थ्य और आहार सलाहकार'
                  : 'Health & Dietary AI Guide'}
              </span>
              <span className="bg-[#43845C] text-white text-[10px] font-black px-2.5 py-0.5 rounded-full border border-[#43845C]/40 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-white" /> Catalog Verified
              </span>
            </div>
            <h2 className="text-xl font-black text-[#302720] mt-0.5">
              {language === 'ta'
                ? 'உடல்நலக்கேற்ப உணவு பரிந்துரை'
                : language === 'hi'
                ? 'स्वास्थ्य के अनुसार आहार सुझाव'
                : 'Health & Dietary Food Recommendations'}
            </h2>
          </div>
        </div>

        {/* Mandatory Medical Safety Disclaimer Notice */}
        <div className="bg-[#FCE8E3] border border-[#E9DED5] rounded-2xl p-4 flex items-start space-x-3 shadow-inner">
          <ShieldAlert className="w-6 h-6 text-[#D93636] shrink-0 mt-0.5" />
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-[#D93636] block">
              {language === 'ta'
                ? 'மருத்துவ எச்சரிக்கை (General Dietary Note)'
                : language === 'hi'
                ? 'चिकित्सीय ध्यान दें'
                : 'Medical Disclaimer Notice'}
            </span>
            <p className="text-xs font-bold text-[#302720] mt-0.5 leading-relaxed">
              {getDisclaimerText()}
            </p>
          </div>
        </div>

        {/* STEP 1: Enter / Speak Condition */}
        {step === 'speak_condition' && (
          <div className="space-y-4">
            
            {/* Saved Profile Banner if available, or helper banner if missing */}
            {!savedHealthCondition ? (
              <div className="bg-[#FFF8F0] p-4 rounded-2xl border border-[#F0E5DC] text-center space-y-1">
                <span className="text-xs font-bold text-[#D93636] uppercase tracking-wider block">
                  {language === 'ta' ? 'உடல்நல விவரங்கள் பதிவு செய்யப்படவில்லை' : language === 'hi' ? 'स्वास्थ्य विवरण उपलब्ध नहीं हैं' : 'No Saved Health Condition Details Found'}
                </span>
                <p className="text-xs text-[#8A817A] leading-relaxed">
                  {language === 'ta'
                    ? 'உங்கள் உடல்நிலை விவரங்களை முடிக்கவும் அல்லது கீழே உள்ள உள்ளீட்டுப் பெட்டி அல்லது மைக் வழியாக பேசி உணவுப் பரிந்துரைகளைப் பெறவும்.'
                    : language === 'hi'
                    ? 'कृपया अपने स्वास्थ्य विवरण पूर्ण करें या नीचे लिखकर/बोलकर उपयुक्त आहार सुझाव प्राप्त करें।'
                    : 'Please complete your Health Condition Details or speak your condition below to receive tailored dietary recommendations.'}
                </p>
              </div>
            ) : (
              <div className="bg-[#43845C]/10 p-3.5 rounded-2xl border border-[#43845C]/25 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#43845C] block">
                    {language === 'ta' ? 'பதிவு செய்யப்பட்ட உடல்நிலை' : language === 'hi' ? 'सहेजी गई स्वास्थ्य स्थिति' : 'Saved Health Profile'}
                  </span>
                  <p className="text-xs font-bold text-[#302720] truncate mt-0.5">{savedHealthCondition}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAnalyzeHealthText(savedHealthCondition)}
                  className="px-3 py-1.5 bg-[#43845C] hover:bg-[#356848] text-white rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer"
                >
                  {language === 'ta' ? 'சுயவிவரப் பரிந்துரை' : language === 'hi' ? 'सुझाव देखें' : 'View Profile Picks'}
                </button>
              </div>
            )}

            {/* Natural Language Text Search Input */}
            <div className="space-y-2">
              <label htmlFor="health-condition-input" className="text-xs font-black text-[#302720] block">
                {language === 'ta'
                  ? 'உடல்நிலை அல்லது உணவுத் தேவையை உள்ளிடவும் (டைப் செய்யவும் அல்லது பேசவும்):'
                  : language === 'hi'
                  ? 'अपनी स्वास्थ्य स्थिति या आहार संबंधी आवश्यकता लिखें या बोलें:'
                  : 'Enter your health requirement or dietary preference (Type or Speak):'}
              </label>

              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (manualInput.trim()) {
                    handleAnalyzeHealthText(manualInput);
                  }
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#786E64] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="health-condition-input"
                    type="text"
                    value={manualInput}
                    onChange={e => setManualInput(e.target.value)}
                    placeholder={
                      language === 'ta'
                        ? 'எ.கா: "இதய நோயாளிக்கான உணவு", "60 வயது", "காரமில்லாத உணவு"...'
                        : language === 'hi'
                        ? 'उदा: "हृदय रोगी के लिए आहार", "60 वर्ष बुजुर्ग", "कम तीखा खाना"...'
                        : 'e.g. "Food for a heart patient", "60 years old", "mild food"...'
                    }
                    className="w-full pl-10 pr-3 py-3 bg-white border border-[#E9DED5] rounded-xl text-xs sm:text-sm font-semibold text-[#302720] focus:outline-none focus:border-[#D93636] focus:ring-1 focus:ring-[#D93636] shadow-inner"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!manualInput.trim()}
                  onClick={e => {
                    e.preventDefault();
                    if (manualInput.trim()) {
                      handleAnalyzeHealthText(manualInput);
                    }
                  }}
                  className="px-4 py-3 bg-[#D93636] hover:bg-[#C02B2B] disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl cursor-pointer transition-colors shadow-sm shrink-0"
                >
                  {language === 'ta' ? 'ஆய்வு செய்' : language === 'hi' ? 'खोजें' : 'Analyze'}
                </button>
              </form>
            </div>

            {/* Voice Mic Button */}
            <div className="flex flex-col items-center justify-center space-y-2 pt-1">
              <button
                type="button"
                onClick={startListeningForCondition}
                className={`w-full py-3.5 px-4 rounded-xl flex items-center justify-center space-x-2 font-black shadow-sm border cursor-pointer transition-all ${
                  isListening
                    ? 'bg-slate-900 text-white border-rose-500 ring-2 ring-rose-400'
                    : 'bg-[#FBE9E5] hover:bg-[#F8D5CE] text-[#D93636] border-[#F0E5DC]'
                }`}
              >
                <Mic className={`w-5 h-5 ${isListening ? 'text-rose-400 animate-pulse' : 'text-[#D93636]'}`} />
                <span className="text-xs sm:text-sm">
                  {isListening
                    ? (language === 'ta' ? 'தானியங்கியாகக் கேட்கிறது... பேசுங்கள்' : 'Listening... Speak your condition now')
                    : (language === 'ta' ? 'குரல் மூலம் சொல்ல மைக் அழுத்தவும்' : 'Or Tap to Speak Health Request')}
                </span>
              </button>

              {liveTranscript && (
                <p className="text-xs text-center text-[#D93636] font-bold bg-[#FCE8E3] p-2 rounded-xl w-full border border-[#E9DED5]">
                  Detected Speech: "{liveTranscript}"
                </p>
              )}
            </div>

            {/* Quick Example Chips for One-Tap Testing */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#786E64] block">
                {language === 'ta' ? 'விரைவுத் தேர்வுகள் (Quick Prompts):' : 'Suggested Health Queries (Tap to test):'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {[
                  {
                    en: 'Food for a heart patient',
                    ta: 'இதய நோயாளிக்கான உணவு',
                    hi: 'हृदय रोगी के लिए उपयुक्त भोजन'
                  },
                  {
                    en: 'Food suitable for a 60-year-old person',
                    ta: '60 வயது நபருக்கு ஏற்ற உணவு',
                    hi: '60 वर्ष के बुजुर्ग के लिए सुपाच्य आहार'
                  },
                  {
                    en: 'Mild vegetarian food',
                    ta: 'காரமில்லாத சைவ உணவு',
                    hi: 'कम तीखा शाकाहारी भोजन'
                  },
                  {
                    en: 'Diabetic-friendly breakfast',
                    ta: 'நீரிழிவு நோயாளிகளுக்கான காலை உணவு',
                    hi: 'डायबिटीज के लिए सुरक्षित नाश्ता'
                  },
                  {
                    en: 'Low-oil & low-salt food for BP',
                    ta: 'குறைந்த எண்ணெய் மற்றும் உப்பு உணவு',
                    hi: 'कम तेल और कम नमक वाला आहार'
                  },
                  {
                    en: 'Easily digestible meals',
                    ta: 'எளிதில் செரிக்கும் லேசான உணவு',
                    hi: 'पचने में आसान और हल्का खाना'
                  }
                ].map((item, idx) => {
                  const queryText = language === 'ta' ? item.ta : language === 'hi' ? item.hi : item.en;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAnalyzeHealthText(queryText)}
                      className="p-2.5 bg-white hover:bg-[#FCE8E3] text-[#302720] rounded-xl font-semibold text-left cursor-pointer transition-all border border-[#E9DED5] text-[11px] sm:text-xs truncate shadow-2xs"
                    >
                      💡 {queryText}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Analyzing (With Timeout & Cancel Safety) */}
        {step === 'analyzing' && (
          <div className="py-10 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="p-4 bg-[#FCE8E3] rounded-full animate-bounce">
              <Sparkles className="w-10 h-10 text-[#D93636]" />
            </div>
            <div className="space-y-1">
              <p className="text-base sm:text-lg font-black text-[#302720]">
                {language === 'ta'
                  ? 'உங்கள் உடல்நிலைக்கு ஏற்ற கட்லாக் உணவுகளை AI ஆய்வு செய்கிறது...'
                  : language === 'hi'
                  ? 'AI आपके स्वास्थ्य के लिए उपयुक्त आहार खोज रहा है...'
                  : 'AI Analyzing your health context & selecting safe food from catalog...'}
              </p>
              <p className="text-xs text-[#8A817A]">
                {language === 'ta'
                  ? 'கட்லாக் சரிபார்ப்பு & செரிமான பகுப்பாய்வு நடக்கிறது...'
                  : language === 'hi'
                  ? 'कैटलॉग सत्यापन और पोषण संतुलन की जांच जारी है...'
                  : 'Verifying nutrition profiles, spice levels, and digestibility...'}
              </p>
            </div>

            {/* User Safety Control: Never trapped on loading */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
                  setStep('speak_condition');
                  stepRef.current = 'speak_condition';
                }}
                className="px-4 py-2 bg-white border border-[#E9DED5] rounded-xl text-xs font-bold text-[#786E64] hover:bg-[#FCE8E3] transition-colors cursor-pointer"
              >
                {language === 'ta' ? 'ரத்து செய்' : language === 'hi' ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
                  const directFallback = HealthDietaryNluService.generateCatalogHealthSuggestions(
                    manualInput || savedHealthCondition || 'mild food',
                    language,
                    savedHealthCondition
                  );
                  setAnalysisResult(directFallback);
                  setStep('view_suggestions');
                  stepRef.current = 'view_suggestions';
                }}
                className="px-4 py-2 bg-[#D93636] text-white rounded-xl text-xs font-bold hover:bg-[#C02B2B] transition-colors cursor-pointer shadow-sm"
              >
                {language === 'ta' ? 'உடனடி பரிந்துரைகளைக் காட்டு' : language === 'hi' ? 'तुरंत देखें' : 'Show Results Immediately'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: View Suggestions */}
        {step === 'view_suggestions' && (
          <div className="space-y-4">
            
            {/* Header Status & New Search Button */}
            <div className="bg-[#43845C]/10 p-3.5 rounded-2xl border border-[#43845C]/20 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#43845C] block">
                  ✓ {analysisResult?.healthContextSummary || 'Health Context Matched'}
                </span>
                <p className="text-xs text-[#302720] font-bold mt-0.5">
                  {language === 'ta'
                    ? 'கீழே உள்ள உணவுகளை ஆர்டர் அல்லது விலை ஒப்பீடு செய்யலாம்:'
                    : 'Select a suitable dish below for instant order, scheduling, or comparison:'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep('speak_condition');
                  stepRef.current = 'speak_condition';
                  setManualInput('');
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-[#E9DED5] rounded-xl text-xs font-bold text-[#D93636] hover:bg-[#FCE8E3] shrink-0 transition-colors cursor-pointer shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{language === 'ta' ? 'புதிய தேடல்' : language === 'hi' ? 'नई खोज' : 'New Query'}</span>
              </button>
            </div>

            {/* Error / Empty State */}
            {errorMessage ? (
              <div className="p-6 bg-white border border-[#E9DED5] rounded-2xl text-center space-y-3">
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                <p className="text-xs sm:text-sm font-bold text-[#302720]">{errorMessage}</p>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setStep('speak_condition');
                    stepRef.current = 'speak_condition';
                  }}
                  className="px-4 py-2 bg-[#D93636] text-white rounded-xl text-xs font-bold hover:bg-[#C02B2B] transition-colors cursor-pointer"
                >
                  {language === 'ta' ? 'மீண்டும் முயலவும்' : language === 'hi' ? 'पुनः प्रयास करें' : 'Try Another Search'}
                </button>
              </div>
            ) : analysisResult && analysisResult.suggestions.length > 0 ? (
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {analysisResult.suggestions.map((sug, idx) => {
                  const item = sug.foodItem;
                  const nativeName = item.nativeNames?.[language] || item.name;
                  const reason = language === 'ta' ? sug.reasonTa : language === 'hi' ? sug.reasonHi : sug.reasonEn;
                  const badges = sug.dietaryAttributes || HealthDietaryNluService.deriveDietaryAttributes(item);

                  return (
                    <div
                      key={idx}
                      className="p-4 bg-white rounded-2xl border border-[#E9DED5] hover:border-[#D93636] hover:shadow-md transition-all space-y-3"
                    >
                      {/* Top Item Row */}
                      <div className="flex items-start gap-3.5">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-18 h-18 sm:w-20 sm:h-20 rounded-xl object-cover shrink-0 border border-[#E9DED5]"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-black text-[#302720] text-sm sm:text-base truncate">
                              {nativeName}
                            </h4>
                            <span className="text-xs font-black bg-[#43845C]/15 text-[#43845C] px-2.5 py-0.5 rounded-full shrink-0">
                              ₹{item.basePrice}
                            </span>
                          </div>

                          <p className="text-[11px] text-[#786E64] line-clamp-1 mt-0.5">
                            {item.description}
                          </p>

                          <div className="flex items-center gap-2 text-[10px] text-[#8A817A] font-semibold mt-1">
                            <span className="truncate">📍 {item.restaurant}</span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5 text-amber-700">⭐ {item.rating}</span>
                          </div>
                        </div>
                      </div>

                      {/* Why this matches requirement */}
                      <div className="bg-[#FFF8F0] p-2.5 rounded-xl border border-[#F0E5DC] text-[11px] sm:text-xs text-[#302720] font-semibold leading-relaxed">
                        <span className="text-[#D93636] font-black mr-1">💡 Why this fits:</span>
                        {reason}
                      </div>

                      {/* Dietary Attribute Badges */}
                      {badges.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {badges.map((b, bIdx) => (
                            <span
                              key={bIdx}
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FBE9E5] text-[#D93636] border border-[#F0E5DC]"
                            >
                              {b}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Food Card Actions: Compare, Order/Schedule, Add to Cart */}
                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#F0E5DC]">
                        <button
                          type="button"
                          onClick={() => openPriceComparison(item)}
                          className="py-2 px-2 bg-white hover:bg-[#FBE9E5] text-[#302720] border border-[#E9DED5] hover:border-[#D93636] rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          title="Compare prices across Swiggy, Zomato, MagicPin, EatSure"
                        >
                          <Scale className="w-3.5 h-3.5 text-[#D93636]" />
                          <span>Compare</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setChooserItem(item)}
                          className="py-2 px-2 bg-[#D93636] hover:bg-[#C02B2B] text-white rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        >
                          <Zap className="w-3.5 h-3.5 text-white" />
                          <span>Order / Schedule</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            addToCart(item, 1, 'healthy_food');
                            const itemName = item.nativeNames?.[language] || item.name;
                            const addedMsg = t('addedNext').replace('{item}', itemName);
                            showToast(addedMsg);
                          }}
                          className="py-2 px-2 bg-[#43845C] hover:bg-[#356848] text-white rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        >
                          <ShoppingBag className="w-3.5 h-3.5 text-white" />
                          <span>Add to Cart</span>
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}

        {/* STEP 4: Price Comparison (if user selected item via voice) */}
        {step === 'view_price_comparison' && selectedItem && priceComparison && (
          <div className="space-y-4">
            <div className="bg-[#43845C]/10 p-3.5 rounded-2xl border border-[#43845C]/20 flex items-center justify-between">
              <div>
                <span className="text-xs font-black uppercase text-[#43845C]">
                  {language === 'ta' ? 'தேர்ந்தெடுக்கப்பட்ட உணவு:' : 'Selected Food Item:'}
                </span>
                <h3 className="text-base sm:text-lg font-black text-[#302720]">
                  {selectedItem.nativeNames?.[language] || selectedItem.name}
                </h3>
              </div>
              <button
                onClick={() => {
                  setStep('view_suggestions');
                  stepRef.current = 'view_suggestions';
                }}
                className="text-xs font-bold text-[#D93636] underline cursor-pointer"
              >
                {language === 'ta' ? 'மாற்று' : 'Back to Picks'}
              </button>
            </div>

            {/* Price Comparison Cards */}
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-[#786E64] block mb-2">
                📊 {language === 'ta' ? 'டெலிவரி செயலிகளின் விலை ஒப்பீடு:' : 'Delivery Platform Price Comparison:'}
              </span>
              
              <div className="grid grid-cols-2 gap-2.5">
                {priceComparison.allPlatforms.map((p, idx) => {
                  const isCheapest = p.platform === priceComparison.cheapest.platform;
                  const isFastest = p.platform === priceComparison.fastest.platform;

                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-2xl border-2 flex flex-col justify-between ${
                        isCheapest
                          ? 'bg-[#43845C]/10 border-[#43845C]'
                          : 'bg-white border-[#E9DED5]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-[#302720]">
                          {p.platformName}
                        </span>
                        {isCheapest && (
                          <span className="text-[9px] font-black bg-[#43845C] text-white px-2 py-0.5 rounded-full uppercase">
                            Best Price
                          </span>
                        )}
                        {isFastest && !isCheapest && (
                          <span className="text-[9px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-full uppercase">
                            Fastest
                          </span>
                        )}
                      </div>

                      <div className="mt-2">
                        <div className="text-base font-black text-[#302720]">
                          ₹{p.price} <span className="text-[10px] text-[#786E64] font-bold">+ ₹{p.deliveryFee} Fee</span>
                        </div>
                        <span className="text-[10px] font-bold text-[#786E64] block mt-0.5">
                          ⏱ {p.deliveryTime} mins • ⭐ {p.rating}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Handoff Buttons */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                onClick={() => {
                  if (selectedItem) {
                    addToCart(selectedItem, 1, 'healthy_food');
                    showToast(t('addedNext').replace('{item}', selectedItem.name));
                  }
                }}
                className="p-3 bg-white hover:bg-[#F7F3EB] text-[#302720] border border-[#E9DED5] rounded-2xl font-black text-xs shadow-sm flex flex-col items-center justify-center space-y-1 cursor-pointer transition-all active:scale-95"
              >
                <ShoppingBag className="w-5 h-5 text-[#D93636]" />
                <span>{t('addToCart')}</span>
              </button>

              <button
                onClick={() => {
                  if (selectedItem) setChooserItem(selectedItem);
                }}
                className="p-3 bg-[#D93636] hover:bg-[#B9252D] text-white rounded-2xl font-black text-xs shadow-sm flex flex-col items-center justify-center space-y-1 cursor-pointer transition-all active:scale-95"
              >
                <Zap className="w-5 h-5 text-white" />
                <span>{t('orderNow')}</span>
              </button>

              <button
                onClick={() => {
                  if (selectedItem) {
                    setSelectedItem(selectedItem);
                    setIsSchedulingModalOpen(true);
                  }
                }}
                className="p-3 bg-[#FCE8E3] hover:bg-[#E9DED5] text-[#302720] rounded-2xl font-black text-xs shadow-sm border border-[#E9DED5] flex flex-col items-center justify-center space-y-1 cursor-pointer transition-all active:scale-95"
              >
                <Clock className="w-5 h-5 text-white" />
                <span>{t('scheduleCart')}</span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Shared Item Action Chooser Modal */}
      <ItemActionChooser
        isOpen={Boolean(chooserItem)}
        onClose={() => setChooserItem(null)}
        items={chooserItems}
        onOrderNow={items => {
          if (items[0]) {
            placeInstantOrder(items[0]);
            onClose();
          }
        }}
        onSchedule={items => {
          if (items[0]) {
            setSelectedItem(items[0]);
            setIsSchedulingModalOpen(true);
          }
        }}
        onAddToCart={items => {
          if (items && items.length > 0) {
            items.forEach(itm => {
              addToCart(itm, 1, 'healthy_food');
              const itemName = itm.nativeNames?.[language] || itm.name;
              const addedMsg = t('addedNext').replace('{item}', itemName);
              showToast(addedMsg);
              speakText(addedMsg);
            });
          }
        }}
      />

      {/* Shared Schedule Checkout Modal */}
      <ScheduleCheckoutModal
        isOpen={isSchedulingModalOpen}
        onClose={() => setIsSchedulingModalOpen(false)}
        items={selectedItem ? [{ foodItem: selectedItem, quantity: 1 }] : []}
        initialSlotName={selectedItem ? `${selectedItem.name} Healthy Schedule` : 'Healthy Schedule'}
      />

    </div>,
    document.body
  );
};
