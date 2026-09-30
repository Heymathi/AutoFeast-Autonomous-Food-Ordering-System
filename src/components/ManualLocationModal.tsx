import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { UserLocation } from '../types';
import { MapPin, Navigation, CheckCircle2, X, Building2, Mic, MicOff, Volume2, ArrowRight } from 'lucide-react';
import { SpeechService } from '../services/speechService';
import { SttMatcherService } from '../services/sttMatcherService';

interface ManualLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManualLocationModal: React.FC<ManualLocationModalProps> = ({ isOpen, onClose }) => {
  const { userLocation, setManualUserLocation, detectGPSLocation, language, speakText, showToast } = useApp();

  const [step, setStep] = useState<'confirm' | 'manual'>('confirm');
  const [customArea, setCustomArea] = useState(userLocation.area || '');
  const [customCity, setCustomCity] = useState(userLocation.city || '');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [recognizedVoiceText, setRecognizedVoiceText] = useState('');

  const listeningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const popularCities = [
    { city: 'Chennai', area: 'Anna Nagar', lat: 13.0827, lng: 80.2707 },
    { city: 'Chennai', area: 'T. Nagar', lat: 13.0418, lng: 80.2341 },
    { city: 'Chennai', area: 'Velachery', lat: 12.9815, lng: 80.2180 },
    { city: 'Coimbatore', area: 'Gandhipuram', lat: 11.0168, lng: 76.9558 },
    { city: 'Madurai', area: 'KK Nagar', lat: 9.9252, lng: 78.1198 },
    { city: 'Salem', area: 'Fairlands', lat: 11.6643, lng: 78.1460 },
    { city: 'Bengaluru', area: 'Indiranagar', lat: 12.9784, lng: 77.6408 },
    { city: 'Hyderabad', area: 'Gachibowli', lat: 17.4401, lng: 78.3489 },
    { city: 'Mumbai', area: 'Bandra West', lat: 19.0596, lng: 72.8295 },
    { city: 'Delhi', area: 'Connaught Place', lat: 28.6315, lng: 77.2167 }
  ];

  // Helper texts per language
  const getPromptText = () => {
    if (step === 'confirm') {
      switch (language) {
        case 'ta': return 'வேறு விநியோக முகவரியை உள்ளிட விரும்புகிறீர்களா?';
        case 'hi': return 'क्या आप दूसरा डिलीवरी पता दर्ज करना चाहते हैं?';
        case 'en': default: return 'Would you like to enter a different delivery address?';
      }
    } else {
      switch (language) {
        case 'ta': return 'உங்கள் டெலிவரி பகுதி மற்றும் நகரைக் கூறவும் அல்லது தட்டச்சு செய்யவும்.';
        case 'hi': return 'कृपया अपना डिलीवरी क्षेत्र और शहर बोलें या टाइप करें।';
        case 'en': default: return 'Please state or type your delivery area and city.';
      }
    }
  };

  const getSubTitleText = () => {
    if (step === 'confirm') {
      const currentLabel = `${userLocation.area}, ${userLocation.city}`;
      switch (language) {
        case 'ta': return `தற்போதைய இருப்பிடம்: ${currentLabel}`;
        case 'hi': return `वर्तमान स्थान: ${currentLabel}`;
        case 'en': default: return `Current location: ${currentLabel}`;
      }
    } else {
      switch (language) {
        case 'ta': return 'தானியங்கி ஜிபிஎஸ், பிரபல இடங்கள் அல்லது தட்டச்சு செய்யவும்';
        case 'hi': return 'ऑटो-जीपीएस, लोकप्रिय क्षेत्र चुनें या टाइप करें';
        case 'en': default: return 'Auto-detect GPS, pick popular area, or type address';
      }
    }
  };

  // Reset and trigger initial step voice prompt when modal opens
  useEffect(() => {
    if (isOpen) {
      // If user is not on live GPS (e.g. came from DENY permission flow), open manual entry step directly!
      const initialStep: 'confirm' | 'manual' = (!userLocation.isLiveGPS) ? 'manual' : 'confirm';
      setStep(initialStep);
      setCustomArea(userLocation.area || '');
      setCustomCity(userLocation.city || '');
      setRecognizedVoiceText('');
      startStepVoiceFlow(initialStep);
    } else {
      SpeechService.stopListening();
      setIsListening(false);
    }
  }, [isOpen]);

  const startStepVoiceFlow = (targetStep: 'confirm' | 'manual') => {
    const prompt = targetStep === 'confirm'
      ? (language === 'ta'
          ? 'வேறு விநியோக முகவரியை உள்ளிட விரும்புகிறீர்களா? ஆம் அல்லது இல்லை என்று சொல்லுங்கள்.'
          : language === 'hi'
          ? 'क्या आप दूसरा डिलीवरी पता दर्ज करना चाहते हैं? हाँ या नहीं बोलें।'
          : 'Would you like to enter a different delivery address? Say yes or no.')
      : (language === 'ta'
          ? 'உங்கள் டெலிவரி பகுதி மற்றும் நகரைக் கூறவும் அல்லது தட்டச்சு செய்யவும்.'
          : language === 'hi'
          ? 'कृपया अपना डिलीवरी क्षेत्र और शहर बोलें या टाइप करें।'
          : 'Please state or type your delivery area and city.');

    // Speak prompt via TTS and start mic listening once spoken
    speakText(prompt, () => {
      startVoiceListening(targetStep);
    });
  };

  const startVoiceListening = (targetStep: 'confirm' | 'manual') => {
    if (!isOpen) return;

    setIsListening(true);
    SpeechService.startListening({
      language,
      continuous: true,
      interimResults: true,
      onStart: () => setIsListening(true),
      onResult: (text: string, isFinal: boolean, nBestTranscripts?: string[]) => {
        setRecognizedVoiceText(text);
        if (isFinal && text.trim()) {
          const candidates = nBestTranscripts && nBestTranscripts.length > 0 ? nBestTranscripts : [text.trim()];
          handleVoiceInput(text.trim(), targetStep, candidates);
        }
      },
      onError: (err: any) => {
        console.warn('[ManualLocationModal]: Voice recognition error:', err);
        setIsListening(false);
      },
      onEnd: () => {
        setIsListening(false);
        if (isOpen) {
          setTimeout(() => {
            if (isOpen) {
              startVoiceListening(targetStep);
            }
          }, 400);
        }
      }
    });
  };

  const handleVoiceInput = (text: string, currentStep: 'confirm' | 'manual', candidates: string[] = [text]) => {
    console.log(`[ManualLocationModal]: Voice Input Received in step "${currentStep}": "${text}"`);

    if (currentStep === 'confirm') {
      const matchResult = SttMatcherService.matchConfirmation(candidates, language);

      if (matchResult.isMatched) {
        if (matchResult.matchedValue === 'YES') {
          SpeechService.stopListening();
          setStep('manual');
          startStepVoiceFlow('manual');
        } else if (matchResult.matchedValue === 'NO') {
          handleConfirmNo();
        }
      } else {
        const cue = matchResult.clarificationPrompt || (language === 'ta'
          ? 'தயவுசெய்து ஆம் அல்லது இல்லை என்று தெளிவாகக் கூறவும்.'
          : language === 'hi'
          ? 'कृपया स्पष्ट रूप से हाँ या नहीं कहें।'
          : 'Please say yes or no clearly.');
        speakText(cue, () => startVoiceListening('confirm'));
      }
    } else if (currentStep === 'manual') {
      // Parse spoken address for area and city
      let area = text;
      let city = userLocation.city || 'Chennai';

      if (text.includes(',')) {
        const parts = text.split(',');
        area = parts[0].trim();
        city = parts[1].trim() || city;
      } else {
        const words = text.trim().split(/\s+/);
        if (words.length >= 2) {
          city = words[words.length - 1];
          area = words.slice(0, words.length - 1).join(' ');
        }
      }

      setCustomArea(area);
      setCustomCity(city);
      saveLocation(area, city);
    }
  };

  const handleConfirmYes = () => {
    SpeechService.stopListening();
    setStep('manual');
    startStepVoiceFlow('manual');
  };

  const handleConfirmNo = () => {
    SpeechService.stopListening();
    setIsListening(false);

    const msg = language === 'ta'
      ? 'தற்போதைய இருப்பிடம் அப்படியே வைக்கப்பட்டது.'
      : language === 'hi'
      ? 'वर्तमान स्थान बना रहेगा।'
      : 'Keeping current delivery location.';

    showToast(msg);
    speakText(msg);
    onClose();
  };

  const saveLocation = (areaName: string, cityName: string) => {
    SpeechService.stopListening();
    setIsListening(false);

    const newLoc: UserLocation = {
      latitude: userLocation.latitude || 13.0827,
      longitude: userLocation.longitude || 80.2707,
      addressName: `${areaName.trim()}, ${cityName.trim()}`,
      city: cityName.trim(),
      area: areaName.trim(),
      isLiveGPS: true,
      isApproximate: false,
      isManualOverride: true
    };

    setManualUserLocation(newLoc);

    const msg = language === 'ta'
      ? `இருப்பிடம் மாற்றப்பட்டது: ${areaName}, ${cityName}`
      : language === 'hi'
      ? `स्थान बदला गया: ${areaName}, ${cityName}`
      : `Location set to ${areaName}, ${cityName}`;

    showToast(msg);
    speakText(msg);
    onClose();
  };

  const handleSelectPreset = (preset: typeof popularCities[0]) => {
    setSelectedPreset(`${preset.area}, ${preset.city}`);
    setCustomArea(preset.area);
    setCustomCity(preset.city);
    saveLocation(preset.area, preset.city);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customArea.trim() || !customCity.trim()) return;
    saveLocation(customArea, customCity);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border-2 border-orange-500 relative space-y-5">
        
        {/* Close Button */}
        <button
          onClick={() => {
            SpeechService.stopListening();
            onClose();
          }}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-orange-100 dark:bg-orange-950 text-orange-600 rounded-2xl">
            <MapPin className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight">
              {getPromptText()}
            </h2>
            <p className="text-xs text-orange-600 dark:text-orange-400 font-bold mt-0.5">
              {getSubTitleText()}
            </p>
          </div>
        </div>

        {/* STEP 1: YES / NO CONFIRMATION FLOW */}
        {step === 'confirm' && (
          <div className="space-y-4 pt-2">
            
            {/* Live Mic Listening Status Badge */}
            <div className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
              isListening
                ? 'bg-amber-500/10 border-amber-500 text-amber-900 dark:text-amber-200 animate-pulse'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              <div className="flex items-center space-x-2.5">
                {isListening ? (
                  <div className="relative flex items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-red-400 opacity-75"></span>
                    <Mic className="w-5 h-5 text-red-600 dark:text-red-400 relative z-10" />
                  </div>
                ) : (
                  <MicOff className="w-5 h-5 opacity-60" />
                )}
                <span className="text-xs font-black">
                  {isListening
                    ? (language === 'ta' ? 'குரலைக் கேட்கிறது... "ஆம்" அல்லது "இல்லை" என்று சொல்லுங்கள்' : language === 'hi' ? 'आपकी आवाज सुन रहे हैं... "हाँ" या "नहीं" बोलें' : 'Listening... Say "Yes" or "No"')
                    : (language === 'ta' ? 'குரல் உள்ளீடு தயார்' : language === 'hi' ? 'आवाज़ सहायता तैयार' : 'Voice Assistant Ready')}
                </span>
              </div>

              <button
                type="button"
                onClick={() => startVoiceListening('confirm')}
                className="px-3 py-1.5 bg-orange-600 text-white font-black text-xs rounded-xl shadow hover:bg-orange-700 flex items-center space-x-1 cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>{language === 'ta' ? 'மீண்டும் கேள்' : language === 'hi' ? 'पुनः सुनें' : 'Listen Again'}</span>
              </button>
            </div>

            {recognizedVoiceText && (
              <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-extrabold text-slate-700 dark:text-slate-300">
                🗣️ "{recognizedVoiceText}"
              </div>
            )}

            {/* Interactive Yes / No Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleConfirmNo}
                className="py-4 px-4 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-black rounded-2xl text-sm shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer border-2 border-slate-300 dark:border-slate-700"
              >
                <X className="w-5 h-5 text-red-500" />
                <span>
                  {language === 'ta' ? 'இல்லை (Keep)' : language === 'hi' ? 'नहीं (Keep)' : 'No, Keep Current'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleConfirmYes}
                className="py-4 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black rounded-2xl text-sm shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer border-2 border-emerald-400"
              >
                <CheckCircle2 className="w-5 h-5 text-yellow-300" />
                <span>
                  {language === 'ta' ? 'ஆம், மாற்று' : language === 'hi' ? 'हाँ, बदलें' : 'Yes, Change Address'}
                </span>
              </button>
            </div>

          </div>
        )}

        {/* STEP 2: MANUAL ADDRESS ENTRY STEP */}
        {step === 'manual' && (
          <div className="space-y-4">
            
            {/* Quick GPS Auto-Detect Button */}
            <button
              type="button"
              onClick={() => {
                detectGPSLocation();
                onClose();
              }}
              className="w-full p-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black rounded-2xl shadow-md hover:from-emerald-700 hover:to-teal-700 flex items-center justify-center space-x-2 text-xs sm:text-sm cursor-pointer"
            >
              <Navigation className="w-4 h-4 text-yellow-300 animate-spin" style={{ animationDuration: '6s' }} />
              <span>{language === 'ta' ? 'உண்மையான ஜிபிஎஸ் இடத்தைக் கண்டறி' : language === 'hi' ? 'ऑटो-जीपीएस स्थान खोजें' : 'Auto-Detect High-Accuracy Device GPS'}</span>
            </button>

            {/* Live Mic Speech-to-Text Button for Location */}
            <div className="p-3 bg-orange-50 dark:bg-orange-950/40 border border-orange-300 dark:border-orange-800 rounded-2xl flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Mic className={`w-5 h-5 ${isListening ? 'text-red-600 animate-bounce' : 'text-orange-600'}`} />
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                  {isListening
                    ? (language === 'ta' ? 'முகவரியைச் சொல்லுங்கள்...' : language === 'hi' ? 'अपना पता बोलें...' : 'Speak your area & city...')
                    : (language === 'ta' ? 'குரல் மூலம் கூறலாம்' : language === 'hi' ? 'बोलकर पता दर्ज करें' : 'Speak location to fill')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => startVoiceListening('manual')}
                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-black text-xs rounded-xl shadow cursor-pointer"
              >
                {isListening ? 'Listening...' : 'Speak Now 🎙️'}
              </button>
            </div>

            {/* Popular Preset City Chips */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                {language === 'ta' ? 'பிரபலமான இடங்கள்:' : language === 'hi' ? 'लोकप्रिय क्षेत्र:' : 'Popular Delivery Areas:'}
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                {popularCities.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className={`p-2.5 rounded-xl border text-left text-xs font-black transition-all flex items-center justify-between cursor-pointer ${
                      selectedPreset === `${p.area}, ${p.city}` || (userLocation.area === p.area && userLocation.city === p.city)
                        ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-500 text-orange-950 dark:text-orange-200'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-orange-400'
                    }`}
                  >
                    <div>
                      <span className="block font-black">{p.area}</span>
                      <span className="text-[10px] text-slate-500 font-bold">{p.city}</span>
                    </div>
                    <Building2 className="w-3.5 h-3.5 text-orange-500 opacity-70" />
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Area & City Form */}
            <form onSubmit={handleCustomSubmit} className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <label className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 block">
                {language === 'ta' ? 'அல்லது முகவரியைத் தட்டச்சு செய்யவும்:' : language === 'hi' ? 'या क्षेत्र और शहर दर्ज करें:' : 'Or Enter Custom Area & City:'}
              </label>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Area / Suburb (e.g. Anna Nagar)"
                  value={customArea}
                  onChange={e => setCustomArea(e.target.value)}
                  className="p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-black bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
                <input
                  type="text"
                  placeholder="City (e.g. Chennai)"
                  value={customCity}
                  onChange={e => setCustomCity(e.target.value)}
                  className="p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-black bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black text-xs shadow-md flex items-center justify-center space-x-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-yellow-300" />
                <span>{language === 'ta' ? 'இடத்தை சேமி' : language === 'hi' ? 'स्थान सहेजें' : 'Save Custom Location'}</span>
              </button>
            </form>

          </div>
        )}

      </div>
    </div>
  );
};
