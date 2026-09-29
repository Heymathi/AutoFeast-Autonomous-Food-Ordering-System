import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { FoodItem } from '../types';
import { HealthDietaryNluService, HealthDietaryAnalysisResult, HealthFoodSuggestion } from '../services/healthDietaryNluService';
import { PriceComparisonService, PriceComparisonSummary } from '../services/priceComparisonService';
import { SttMatcherService, CONFIRMATION_VOCABULARY } from '../services/sttMatcherService';
import { SpeechService } from '../services/speechService';
import { Mic, MicOff, X, HeartPulse, AlertTriangle, ShieldAlert, Sparkles, CheckCircle2, Zap, Clock, Volume2, Store, Star, Award, ChevronRight } from 'lucide-react';

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
    setVoiceDialogItem,
    showToast
  } = useApp();

  const [step, setStep] = useState<HealthModalStep>('speak_condition');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<HealthDietaryAnalysisResult | null>(null);
  const [selectedItem, setSelectedItem] = useState<FoodItem | null>(null);
  const [priceComparison, setPriceComparison] = useState<PriceComparisonSummary | null>(null);

  const stepRef = useRef<HealthModalStep>('speak_condition');
  const isComponentMounted = useRef(true);

  useEffect(() => {
    isComponentMounted.current = true;
    return () => {
      isComponentMounted.current = false;
      SpeechService.stopListening();
    };
  }, []);

  const getDisclaimerText = () => {
    if (language === 'ta') {
      return 'இது ஒரு பொதுவான உணவுப் பரிந்துரை மட்டுமே, மருத்துவ ஆலோசனை அல்ல. உங்கள் உடல்நலக் கோளாறுக்கு மருத்துவரை அணுகவும்.';
    }
    if (language === 'hi') {
      return 'यह एक सामान्य आहार सुझाव है, चिकित्सीय सलाह नहीं — कृपया अपनी स्थिति के लिए डॉक्टर से परामर्श लें।';
    }
    return 'This is a general dietary suggestion, not medical advice — please consult a doctor for your condition.';
  };

  const startListeningForCondition = () => {
    if (!isOpen || !SpeechService.isSupported()) return;

    stepRef.current = 'speak_condition';
    setStep('speak_condition');
    console.log('[HealthDietaryVoiceModal]: Starting microphone stream for health condition description...');

    SpeechService.startListening({
      language,
      continuous: false,
      interimResults: true,
      onStart: () => setIsListening(true),
      onResult: (text, isFinal) => {
        if (!text) return;
        setLiveTranscript(text);
        if (isFinal) {
          handleAnalyzeHealthText(text);
        }
      },
      onError: (err) => {
        console.warn('[HealthDietaryVoiceModal Mic Error]:', err);
        setIsListening(false);
      },
      onEnd: () => setIsListening(false)
    });
  };

  const handleAnalyzeHealthText = async (text: string) => {
    if (!text || !text.trim()) return;

    SpeechService.stopListening();
    setIsListening(false);
    setStep('analyzing');
    stepRef.current = 'analyzing';

    console.log(`[HealthDietaryVoiceModal]: Processing spoken health input: "${text}"`);
    const result = await HealthDietaryNluService.analyzeHealthContextAndSuggestFood(text, language);
    
    setAnalysisResult(result);
    setStep('view_suggestions');
    stepRef.current = 'view_suggestions';

    // Speak Disclaimer + Suggestions aloud in active language
    speakSuggestionsAloud(result);
  };

  const speakSuggestionsAloud = (result: HealthDietaryAnalysisResult) => {
    const disclaimer = getDisclaimerText();

    const introMsg = language === 'ta'
      ? `${disclaimer} உங்களுக்கான லேசான உணவுப் பரிந்துரைகள்:`
      : language === 'hi'
      ? `${disclaimer} आपके लिए सुपाच्य आहार सुझाव:`
      : `${disclaimer} Here are general food suggestions for your situation:`;

    const itemsSummary = result.suggestions.map(s => {
      const name = s.foodItem.nativeNames?.[language] || s.foodItem.name;
      const reason = language === 'ta' ? s.reasonTa : language === 'hi' ? s.reasonHi : s.reasonEn;
      return `${name}. ${reason}`;
    }).join('. ');

    const fullSpeechText = `${introMsg} ${itemsSummary}. எந்த உணவைத் தேர்ந்தெடுக்க விரும்புகிறீர்கள் என்று சொல்லுங்கள்!`;

    console.log('[HealthDietaryVoiceModal]: Speaking recommendations aloud ->', fullSpeechText);

    speakText(fullSpeechText, () => {
      if (isComponentMounted.current && isOpen) {
        startListeningForItemSelection(result.suggestions.map(s => s.foodItem));
      }
    });
  };

  const startListeningForItemSelection = (availableCatalog: FoodItem[]) => {
    if (!isOpen || !SpeechService.isSupported()) return;

    stepRef.current = 'view_suggestions';
    console.log('[HealthDietaryVoiceModal]: Listening for spoken item choice selection...');

    SpeechService.startListening({
      language,
      continuous: true,
      interimResults: true,
      onStart: () => setIsListening(true),
      onResult: (text, isFinal, nBest) => {
        if (!text) return;
        setLiveTranscript(text);
        const candidates = nBest && nBest.length > 0 ? nBest : [text];

        // Match spoken reply against available catalog suggestions using shared SttMatcherService
        const matchedFood = SttMatcherService.matchFoodItem(candidates, availableCatalog, language);
        if (matchedFood) {
          console.log(`🚀 [Health STT Choice Match Success]: Matched "${matchedFood.name}" from spoken input!`);
          SpeechService.stopListening();
          setIsListening(false);
          handleSelectItem(matchedFood);
        }
      },
      onError: (err) => {
        console.warn('[Health Choice Listening Error]:', err);
        setIsListening(false);
      },
      onEnd: () => setIsListening(false)
    });
  };

  const handleSelectItem = (item: FoodItem) => {
    setSelectedItem(item);
    const comparison = PriceComparisonService.compare(item.platforms);
    setPriceComparison(comparison);

    setStep('view_price_comparison');
    stepRef.current = 'view_price_comparison';

    const itemName = item.nativeNames?.[language] || item.name;
    const bestValName = comparison.bestValue.platformName;
    const cheapestName = comparison.cheapest.platformName;
    const cheapestPrice = comparison.cheapest.price + comparison.cheapest.deliveryFee;

    const summarySpeech = language === 'ta'
      ? `${itemName} தேர்ந்தெடுக்கப்பட்டது. ${cheapestName}-இல் மிகக் குறைந்த விலையில் ₹${cheapestPrice}-க்குக் கிடைக்கிறது. இப்போதே ஆர்டர் செய்யவா அல்லது அட்டவணைப்படுத்தவா?`
      : language === 'hi'
      ? `${itemName} चुना गया। ${cheapestName} पर सबसे कम कीमत ₹${cheapestPrice} में उपलब्ध है। क्या अभी ऑर्डर करें या शेड्यूल करें?`
      : `${itemName} selected. Lowest price available on ${cheapestName} for ₹${cheapestPrice}. Do you want to order now or schedule it?`;

    speakText(summarySpeech, () => {
      if (isComponentMounted.current && isOpen) {
        startListeningForOrderOrSchedule(item);
      }
    });
  };

  const startListeningForOrderOrSchedule = (item: FoodItem) => {
    if (!isOpen || !SpeechService.isSupported()) return;

    SpeechService.startListening({
      language,
      continuous: true,
      interimResults: true,
      onStart: () => setIsListening(true),
      onResult: (text, isFinal, nBest) => {
        if (!text) return;
        setLiveTranscript(text);
        const candidates = nBest && nBest.length > 0 ? nBest : [text];

        const orderNowWords = [
          ...CONFIRMATION_VOCABULARY.ORDER_NOW.en,
          ...CONFIRMATION_VOCABULARY.ORDER_NOW.ta,
          ...CONFIRMATION_VOCABULARY.ORDER_NOW.hi
        ];
        const scheduleWords = [
          ...CONFIRMATION_VOCABULARY.SCHEDULE.en,
          ...CONFIRMATION_VOCABULARY.SCHEDULE.ta,
          ...CONFIRMATION_VOCABULARY.SCHEDULE.hi
        ];

        const matchOrderNow = SttMatcherService.matchVocabulary(candidates, orderNowWords, language);
        const matchSchedule = SttMatcherService.matchVocabulary(candidates, scheduleWords, language);

        if (matchOrderNow.isMatched || text.includes('now') || text.includes('இப்போதே') || text.includes('ஆர்டர்')) {
          console.log('[Health Modal]: Voice intent = ORDER NOW');
          SpeechService.stopListening();
          setIsListening(false);
          placeInstantOrder(item);
          onClose();
        } else if (matchSchedule.isMatched || text.includes('schedule') || text.includes('அட்டவணை')) {
          console.log('[Health Modal]: Voice intent = SCHEDULE FOR LATER');
          SpeechService.stopListening();
          setIsListening(false);
          onClose();
          setVoiceDialogItem(item);
        }
      },
      onError: (err) => setIsListening(false),
      onEnd: () => setIsListening(false)
    });
  };

  useEffect(() => {
    if (isOpen) {
      setStep('speak_condition');
      stepRef.current = 'speak_condition';
      setLiveTranscript('');
      setAnalysisResult(null);
      setSelectedItem(null);
      setPriceComparison(null);

      const promptMsg = language === 'ta'
        ? 'உங்கள் உடல்நிலை அல்லது உணவுக் தேவையை குரல் மூலம் சொல்லுங்கள். எ.கா: "எனக்கு காய்ச்சல் இருக்கு என்ன சாப்பிடலாம்?"'
        : language === 'hi'
        ? 'अपनी स्वास्थ्य स्थिति या आहार संबंधी आवश्यकता बोलें। जैसे: "मुझे बुखार है, क्या खाएं?"'
        : 'Describe your health situation or dietary preference by voice. (e.g. "I have fever, what should I eat?")';

      const timer = setTimeout(() => {
        speakText(promptMsg, () => {
          startListeningForCondition();
        });
      }, 100);

      return () => clearTimeout(timer);
    } else {
      SpeechService.stopListening();
    }
  }, [isOpen, language]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 shadow-2xl border-2 border-rose-500 relative space-y-5 my-8">
        
        {/* Close Button */}
        <button
          onClick={() => {
            SpeechService.stopListening();
            setIsListening(false);
            onClose();
          }}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 z-10 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-rose-100 dark:bg-rose-950 text-rose-600 rounded-2xl">
            <HeartPulse className="w-7 h-7 text-rose-600 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black uppercase text-rose-600 tracking-wider">
                {language === 'ta' ? 'உடல்நல & உணவு வழிகாட்டி' : language === 'hi' ? 'स्वास्थ्य और आहार सलाहकार' : 'Health & Dietary AI Guide'}
              </span>
              <span className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-400 flex items-center gap-1">
                <Mic className="w-3 h-3 text-yellow-300" /> Catalog Verified
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
              {language === 'ta' ? 'உடல்நலக்கேற்ப உணவு பரிந்துரை' : language === 'hi' ? 'स्वास्थ्य के अनुसार आहार सुझाव' : 'Voice Food Suggestions by Health Context'}
            </h2>
          </div>
        </div>

        {/* 🚀 MANDATORY MEDICAL SAFETY DISCLAIMER BANNER */}
        <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-600 rounded-2xl p-4 flex items-start space-x-3 shadow-inner">
          <ShieldAlert className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 block">
              {language === 'ta' ? 'மருத்துவ எச்சரிக்கை (General Dietary Note)' : language === 'hi' ? 'चिकित्सीय ध्यान दें' : 'Medical Disclaimer Notice'}
            </span>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 leading-relaxed">
              {getDisclaimerText()}
            </p>
          </div>
        </div>

        {/* STEP 1: Speak Condition */}
        {step === 'speak_condition' && (
          <div className="space-y-4">
            <div className="bg-rose-50 dark:bg-slate-800/80 p-5 rounded-2xl border border-rose-200 text-center space-y-2">
              <p className="text-base font-black text-slate-900 dark:text-white leading-relaxed">
                {language === 'ta'
                  ? 'உங்களுக்கு அல்லது உங்கள் குடும்பத்தினருக்கு (அப்பா/அம்மா/தாத்தா/பாட்டி) என்ன உடல்நல சவால்கள் உள்ளன? பேசவும்!'
                  : language === 'hi'
                  ? 'आपके या आपके परिवार (माता/पिता/दादा/दादी) के लिए क्या स्वास्थ्य स्थिति है? बोलें!'
                  : 'Describe your health situation or dietary preference out loud (e.g., "I have fever", "heart condition", "stomach pain for appa").'}
              </p>
            </div>

            <div className="flex flex-col items-center justify-center space-y-2">
              <button
                type="button"
                onClick={startListeningForCondition}
                className={`p-4 rounded-2xl flex items-center space-x-3 font-black shadow-md border cursor-pointer transition-all ${
                  isListening
                    ? 'bg-slate-900 text-white border-rose-500 ring-2 ring-rose-400'
                    : 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700'
                }`}
              >
                <Mic className={`w-6 h-6 ${isListening ? 'text-rose-400 animate-pulse' : 'text-yellow-300'}`} />
                <span className="text-sm">
                  {isListening
                    ? (language === 'ta' ? 'தானியங்கியாகக் கேட்கிறது... பேசுங்கள்' : 'Listening... Speak your condition now')
                    : (language === 'ta' ? 'மைக் தொடங்க தட்டவும் (Tap to Speak)' : 'Tap to Start Speaking')}
                </span>
              </button>

              {liveTranscript && (
                <p className="text-xs text-center text-rose-600 dark:text-rose-400 font-black bg-rose-50 dark:bg-slate-800 p-2 rounded-xl w-full border border-rose-200">
                  Detected Speech: "{liveTranscript}"
                </p>
              )}
            </div>

            {/* Quick Prompt Suggestions */}
            <div className="space-y-1.5 pt-2">
              <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400">
                {language === 'ta' ? 'எடுத்துக்காட்டு கேள்விகள் (Tap to test):' : 'Example Spoken Queries:'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {[
                  { labelEn: '"I have fever, is idli or pongal good?"', labelTa: '"எனக்கு காய்ச்சல் இருக்கு, இட்லி சாப்பிடாலாமா?"' },
                  { labelEn: '"I have stomach pain, need tablet food"', labelTa: '"வயிறு வலிக்குது, மாத்திரை சாப்பிட உணவு வேணும்"' },
                  { labelEn: '"Heart patient, 60 yrs old, mild food"', labelTa: '"60 வயது அப்பாவுக்கு இதயப் பிரச்சனை, காரமில்லாத உணவு"' },
                  { labelEn: '"Fever for paati, less spicy food"', labelTa: '"பாட்டிக்கு காய்ச்சல், காரமில்லாத லேசான உணவு"' }
                ].map((ex, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnalyzeHealthText(language === 'ta' ? ex.labelTa : ex.labelEn)}
                    className="p-2.5 bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold text-left cursor-pointer transition-all border border-slate-200 dark:border-slate-700"
                  >
                    {language === 'ta' ? ex.labelTa : ex.labelEn}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Analyzing */}
        {step === 'analyzing' && (
          <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="p-4 bg-rose-100 dark:bg-slate-800 rounded-full animate-bounce">
              <Sparkles className="w-10 h-10 text-rose-600 dark:text-rose-400" />
            </div>
            <p className="text-lg font-black text-slate-900 dark:text-white">
              {language === 'ta'
                ? 'உங்கள் உடல்நிலைக்கு ஏற்ற கட்லாக் உணவுகளை AI ஆய்வு செய்கிறது...'
                : language === 'hi'
                ? 'AI आपके स्वास्थ्य के लिए उपयुक्त आहार खोज रहा है...'
                : 'AI Analyzing your health context & selecting safe food from catalog...'}
            </p>
          </div>
        )}

        {/* STEP 3: View Suggestions */}
        {step === 'view_suggestions' && analysisResult && (
          <div className="space-y-4">
            <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-2xl border border-emerald-300">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block">
                ✓ {analysisResult.healthContextSummary} ({analysisResult.targetPerson.toUpperCase()})
              </span>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">
                {language === 'ta'
                  ? '📢 குரல் மூலம் உணவைத் தேர்ந்தெடுக்கவும் (எ.கா: "இட்லி" அல்லது "பொங்கல்"): '
                  : '📢 Speak item name out loud (e.g. "Idli" or "Pongal") or tap a card below:'}
              </p>
            </div>

            {/* Mic Listening Status */}
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="p-3 bg-slate-900 text-white rounded-2xl flex items-center space-x-3 font-black shadow-md border border-slate-700 w-full justify-center">
                <Mic className="w-5 h-5 text-yellow-400 animate-pulse" />
                <span className="text-xs">
                  {language === 'ta'
                    ? 'தானியங்கியாகக் கேட்கிறது: உணவின் பெயரைச் சொல்லுங்கள்...'
                    : 'Listening automatically: Speak food item choice name...'}
                </span>
              </div>

              {liveTranscript && (
                <p className="text-xs text-center text-emerald-600 dark:text-emerald-400 font-black">
                  Detected Voice Speech: "{liveTranscript}"
                </p>
              )}
            </div>

            {/* Food Suggestions List */}
            <div className="space-y-3">
              {analysisResult.suggestions.map((sug, idx) => {
                const item = sug.foodItem;
                const nativeName = item.nativeNames?.[language] || item.name;
                const reason = language === 'ta' ? sug.reasonTa : language === 'hi' ? sug.reasonHi : sug.reasonEn;

                return (
                  <div
                    key={idx}
                    onClick={() => handleSelectItem(item)}
                    className="p-4 bg-slate-50 dark:bg-slate-800/90 rounded-2xl border-2 border-slate-200 hover:border-emerald-500 dark:border-slate-700 hover:shadow-lg transition-all cursor-pointer flex items-center space-x-4"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-16 h-16 rounded-xl object-cover shrink-0 border border-slate-300"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-black text-slate-900 dark:text-white text-base">
                          {nativeName}
                        </span>
                        <span className="text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                          ₹{item.basePrice}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                        💡 {reason}
                      </p>
                      <span className="text-[10px] text-slate-500 font-bold block mt-1">
                        📍 {item.restaurant} • ⭐ {item.rating}
                      </span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 4: Price Comparison & Order/Schedule Handoff */}
        {step === 'view_price_comparison' && selectedItem && priceComparison && (
          <div className="space-y-4">
            <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-2xl border border-emerald-300 flex items-center justify-between">
              <div>
                <span className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-300">
                  {language === 'ta' ? 'தேர்ந்தெடுக்கப்பட்ட உணவு:' : 'Selected Food Item:'}
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {selectedItem.nativeNames?.[language] || selectedItem.name}
                </h3>
              </div>
              <button
                onClick={() => {
                  setStep('view_suggestions');
                  stepRef.current = 'view_suggestions';
                  if (analysisResult) {
                    startListeningForItemSelection(analysisResult.suggestions.map(s => s.foodItem));
                  }
                }}
                className="text-xs font-bold text-rose-600 underline cursor-pointer"
              >
                {language === 'ta' ? 'மாற்று' : 'Change Item'}
              </button>
            </div>

            {/* Price Comparison Cards */}
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 block mb-2">
                📊 {language === 'ta' ? 'டெலிவரி செயலிகளின் விலை ஒப்பீடு:' : 'Delivery Platform Price Comparison:'}
              </span>
              
              <div className="grid grid-cols-2 gap-2.5">
                {priceComparison.allPlatforms.map((p, idx) => {
                  const isCheapest = p.platform === priceComparison.cheapest.platform;
                  const isFastest = p.platform === priceComparison.fastest.platform;
                  const isBestValue = p.platform === priceComparison.bestValue.platform;

                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-2xl border-2 flex flex-col justify-between ${
                        isCheapest
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-slate-900 dark:text-white">
                          {p.platformName}
                        </span>
                        {isCheapest && (
                          <span className="text-[9px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full uppercase">
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
                        <div className="text-lg font-black text-slate-900 dark:text-white">
                          ₹{p.price} <span className="text-[10px] text-slate-500 font-bold">+ ₹{p.deliveryFee} Fee</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 block">
                          ⏱ {p.deliveryTime} mins • ⭐ {p.rating}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Voice Intent Listener Bar */}
            <div className="p-3 bg-slate-900 text-white rounded-2xl flex items-center space-x-3 font-black shadow-md border border-slate-700 justify-center">
              <Mic className="w-5 h-5 text-yellow-400 animate-pulse" />
              <span className="text-xs">
                {language === 'ta'
                  ? 'பேசுங்கள்: "இப்போதே ஆர்டர் செய்" அல்லது "அட்டவணைப்படுத்து"'
                  : 'Listening automatically: Say "Order Now" or "Schedule for Later"'}
              </span>
            </div>

            {/* Action Handoff Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => {
                  SpeechService.stopListening();
                  setIsListening(false);
                  placeInstantOrder(selectedItem);
                  onClose();
                }}
                className="p-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm shadow-lg flex flex-col items-center justify-center space-y-1 cursor-pointer transition-all active:scale-95"
              >
                <Zap className="w-6 h-6 text-yellow-300" />
                <span>{language === 'ta' ? 'இப்போதே ஆர்டர் செய்' : 'Order Instantly Now'}</span>
                <span className="text-[10px] opacity-90">Wallet Auto-Debit</span>
              </button>

              <button
                onClick={() => {
                  SpeechService.stopListening();
                  setIsListening(false);
                  onClose();
                  setVoiceDialogItem(selectedItem);
                }}
                className="p-4 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black text-sm shadow-lg flex flex-col items-center justify-center space-y-1 cursor-pointer transition-all active:scale-95"
              >
                <Clock className="w-6 h-6 text-white" />
                <span>{language === 'ta' ? 'நேரத்திற்கு அட்டவணைப்படுத்து' : 'Schedule for Later'}</span>
                <span className="text-[10px] opacity-90">Time & Duration Flow</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
