import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { FoodItem } from '../types';

import { ChooserVoiceService, ChooserAction } from '../services/chooserVoiceService';
import { SttMatcherService } from '../services/sttMatcherService';
import { NomineeNotificationService } from '../services/nomineeNotificationService';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { Zap, Clock, ShoppingCart, X, Volume2, Mic, MicOff, Sparkles, AlertCircle } from 'lucide-react';

import { SpeechController } from '../services/speechController';
import { debounceHandler } from '../utils/debounce';

export interface ItemActionChooserProps {
  isOpen: boolean;
  onClose: () => void;
  items: FoodItem[];
  onOrderNow: (items: FoodItem[]) => void;
  onSchedule: (items: FoodItem[]) => void;
  onAddToCart: (items: FoodItem[]) => void;
}

export const ItemActionChooser: React.FC<ItemActionChooserProps> = ({
  isOpen,
  onClose,
  items,
  onOrderNow,
  onSchedule,
  onAddToCart
}) => {
  const {
    language,
    speakText,
    t,
    showToast,
    accessibilitySettings,
    currentUser,
    checkIsItemRestrictedByNominee,
    handleNomineeRestrictedInterception
  } = useApp();

  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [hasRetried, setHasRetried] = useState(false);

  const activePromptRef = useRef<string>('');
  const isComponentMounted = useRef<boolean>(false);

  useEffect(() => {
    isComponentMounted.current = true;
    if (isOpen && items && items.length > 0) {
      setHasRetried(false);
      setLiveTranscript('');
      triggerChooserTTSAndListening();
    } else {
      cleanupSpeech();
    }

    return () => {
      isComponentMounted.current = false;
      cleanupSpeech();
    };
  }, [isOpen, items]);

  const cleanupSpeech = () => {
    SpeechController.cancelSpeech();
    SpeechController.releaseMic('item_chooser');
    setIsListening(false);
  };

  const getPromptText = (): string => {
    if (!items || items.length === 0) return '';
    if (items.length === 1) {
      const item = items[0];
      const itemName = item.nativeNames?.[language] || item.name;
      return t('chooserAsk')
        .replace('{item}', itemName)
        .replace('{restaurant}', item.restaurant);
    } else {
      return t('chooserAskMulti').replace('{n}', String(items.length));
    }
  };

  const triggerChooserTTSAndListening = () => {
    const promptText = getPromptText();
    if (!promptText) return;

    activePromptRef.current = promptText;
    setStatusMessage(promptText);

    SpeechController.speak(
      promptText,
      language,
      () => {
        if (isComponentMounted.current && isOpen) {
          startListeningForChoice();
        }
      },
      (fallbackText) => {
        showToast(fallbackText, 'info');
      },
      'item_chooser'
    );
  };

  const startListeningForChoice = () => {
    if (!SpeechController.isSupported()) {
      setIsListening(false);
      return;
    }

    setIsListening(true);

    SpeechController.startListening({
      owner: 'item_chooser',
      language,
      continuous: false,
      interimResults: true,
      maxAlternatives: 5,
      onStart: () => {
        if (isComponentMounted.current) setIsListening(true);
      },
      onResult: (text, isFinal, nBest) => {
        if (!text) return;
        setLiveTranscript(text);
        if (!isFinal) return;

        const candidates = nBest && nBest.length > 0 ? nBest : [text];

        // Check for cancel / close
        const controlMatch = SttMatcherService.matchControlCommand(candidates);
        if (controlMatch.isMatched && (controlMatch.matchedValue === 'CANCEL' || controlMatch.matchedValue === 'STOP')) {
          cleanupSpeech();
          onClose();
          return;
        }

        const action = ChooserVoiceService.parseChooserAction(candidates, activePromptRef.current);

        if (action === 'cancel') {
          cleanupSpeech();
          onClose();
        } else if (action === 'order_now') {
          handleSelectAction('order_now');
        } else if (action === 'schedule') {
          handleSelectAction('schedule');
        } else if (action === 'add_to_cart') {
          handleSelectAction('add_to_cart');
        } else if (action === 'retry' && !hasRetried) {
          setHasRetried(true);
          const retryMsg = language === 'ta'
            ? 'மன்னிக்கவும், புரியவில்லை. ஆர்டர் செய்ய, அட்டவணைப்படுத்த அல்லது கார்ட்டில் சேர்க்க என்று சொல்லவும்.'
            : language === 'hi'
            ? 'क्षमा करें, समझ नहीं आया। ऑर्डर करें, शेड्यूल करें या कार्ट में जोड़ें बोलें।'
            : 'Sorry, I did not catch that. Please say Order Now, Schedule, or Add to Cart.';
          setStatusMessage(retryMsg);
          SpeechController.speak(retryMsg, language, () => {
            if (isComponentMounted.current && isOpen) startListeningForChoice();
          });
        }
      },
      onError: (err) => {
        console.warn('[ItemActionChooser Mic Error]:', err);
        setIsListening(false);
      },
      onEnd: () => {
        if (isComponentMounted.current) setIsListening(false);
      }
    });
  };

  const handleSelectAction = (action: ChooserAction) => {
    cleanupSpeech();
    console.log('[ItemActionChooser]: handleSelectAction triggered -> action:', action, 'items count:', items?.length);

    if (!items || items.length === 0) {
      console.warn('[ItemActionChooser]: handleSelectAction called with empty items!');
      onClose();
      return;
    }

    if (action === 'add_to_cart') {
      // Add to Cart: Allowed even if restricted (item is marked "Needs helper approval" in cart)
      console.log('[ItemActionChooser]: Calling onAddToCart with items:', items);
      onAddToCart(items);
      onClose();
      return;
    }

    const restrictedCatalogItems = INDIAN_FOOD_CATALOG.filter(i => currentUser?.restrictedFoodIds?.includes(i.id));
    for (const item of items) {
      const isRestrictedByNominee = checkIsItemRestrictedByNominee(item.id, item.name);
      const interception = SttMatcherService.checkRestrictedFoodInterception(item.name, restrictedCatalogItems);
      if (isRestrictedByNominee || interception.isRestricted) {
        // Block restricted order if nominee restricted item list could not be verified
        if (NomineeNotificationService.hasRestrictedFetchError()) {
          console.warn('[ItemActionChooser]: Restricted load error for restricted item:', item.name);
          showToast(t('nominee.restrictedLoadError'), 'warning');
          SpeechController.speak(t('nominee.restrictedLoadError'), language);
          onClose();
          return;
        }

        console.log('[ItemActionChooser]: Intercepting restricted item for nominee approval:', item.name);
        handleNomineeRestrictedInterception(item, action === 'schedule' ? 'scheduled' : 'instant');
        onClose();
        return;
      }
    }

    if (action === 'order_now') {
      console.log('[ItemActionChooser]: Calling onOrderNow with items:', items);
      onOrderNow(items);
    } else if (action === 'schedule') {
      console.log('[ItemActionChooser]: Calling onSchedule with items:', items);
      onSchedule(items);
    }
    onClose();
  };

  // Keep a ref to the latest handleSelectAction so the debounceHandler closure never becomes stale
  const handleSelectActionRef = useRef(handleSelectAction);
  handleSelectActionRef.current = handleSelectAction;
  useEffect(() => {
    handleSelectActionRef.current = handleSelectAction;
  }, [handleSelectAction]);

  const debouncedSelectAction = useRef(
    debounceHandler((act: ChooserAction) => {
      handleSelectActionRef.current(act);
    }, 1000)
  ).current;

  const handleClose = () => {
    cleanupSpeech();
    onClose();
  };

  if (!isOpen || !items || items.length === 0) return null;

  const primaryItem = items[0];

  const restrictedCatalogItems = INDIAN_FOOD_CATALOG.filter(i => currentUser?.restrictedFoodIds?.includes(i.id));
  const isAnyRestricted = items.some(item => {
    const isRestrictedByNominee = checkIsItemRestrictedByNominee(item.id, item.name);
    const interception = SttMatcherService.checkRestrictedFoodInterception(item.name, restrictedCatalogItems);
    return isRestrictedByNominee || interception.isRestricted;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className={`relative w-full max-w-lg rounded-3xl p-6 shadow-2xl border-4 transition-all ${
        accessibilitySettings.highContrast
          ? 'bg-black text-white border-yellow-400'
          : 'bg-white text-[#1A1110] border-[#FF5A1F]'
      }`}>
        
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-[#4A5568] transition-colors cursor-pointer"
          aria-label={t('nav.close')}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-2 pr-8 border-b border-[#DAF0F7] pb-4">
          <span className="text-xs font-black uppercase text-[#FF5A1F] bg-[#FF5A1F]/10 px-3 py-1 rounded-full border border-[#FF5A1F]/20">
            {t('nav.title')} • Item Chooser
          </span>

          <h3 className="text-xl sm:text-2xl font-black text-[#1A1110] flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#FF5A1F]" />
            {items.length === 1 ? primaryItem.name : `${items.length} Items Selected`}
          </h3>

          <p className="text-xs sm:text-sm font-semibold text-[#4A5568]">
            {items.length === 1 ? `${primaryItem.restaurant} • ₹${primaryItem.basePrice}` : items.map(i => i.name).join(', ')}
          </p>
        </div>

        {/* Spoken Prompt / Live Voice Indicator */}
        <div className="my-4 p-3 bg-[#DAF0F7]/40 rounded-2xl border border-[#B2E2F0] space-y-1">
          <div className="flex items-center justify-between text-xs font-black text-[#1A1110]">
            <span className="flex items-center gap-1.5 text-[#FF5A1F]">
              <Volume2 className="w-4 h-4 animate-pulse" />
              <span>Prompt:</span>
            </span>
            {isListening && (
              <span className="bg-[#C2185B] text-white px-2 py-0.5 rounded-md text-[10px] uppercase font-bold flex items-center gap-1">
                <Mic className="w-3 h-3 animate-ping" /> Listening...
              </span>
            )}
          </div>
          <p className="text-xs font-bold text-[#1A1110]">{statusMessage || getPromptText()}</p>
          {liveTranscript && (
            <p className="text-xs font-extrabold text-[#C2185B] italic">Heard: "{liveTranscript}"</p>
          )}
        </div>

        {/* Item Preview Card */}
        {items.length === 1 && (
          <div className="flex items-center space-x-3 bg-slate-50 p-3 rounded-2xl border border-slate-200 mb-4">
            <img src={primaryItem.image} alt={primaryItem.name} className="w-16 h-16 rounded-xl object-cover" />
            <div>
              <h4 className="text-sm font-black text-[#1A1110]">{primaryItem.name}</h4>
              <p className="text-xs text-[#FF5A1F] font-extrabold">{primaryItem.restaurant}</p>
              <span className="text-xs font-black text-[#16A34A]">₹{primaryItem.basePrice}</span>
            </div>
          </div>
        )}

        {/* Nominee Restriction Alert Banner */}
        {isAnyRestricted && (
          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 text-xs font-bold mb-4">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="font-black text-amber-800">
                {language === 'ta'
                  ? 'பரிந்துரைப்பாளர் அனுமதி தேவை'
                  : language === 'hi'
                  ? 'नामांकित व्यक्ति की अनुमति आवश्यक है'
                  : 'Nominee Permission Required'}
              </span>
              <span className="text-[11px] font-semibold text-amber-700/90">
                {language === 'ta'
                  ? 'இந்த உணவை நேரடியாக ஆர்டர் செய்ய உங்கள் பரிந்துரைப்பாளரின் ஒப்புதல் தேவை. கார்ட்டில் சேர்க்கலாம்.'
                  : language === 'hi'
                  ? 'इस वस्तु को सीधे ऑर्डर करने के लिए आपके नामांकित व्यक्ति की अनुमति चाहिए। आप इसे कार्ट में जोड़ सकते हैं।'
                  : 'Direct ordering requires approval from your emergency nominee. You can still add to cart.'}
              </span>
            </div>
          </div>
        )}

        {/* 3 BIG ACTION BUTTONS (Min 44px height, high touch area) */}
        <div className="grid grid-cols-1 gap-3">
          
          {/* ORDER NOW BUTTON */}
          <button
            type="button"
            onClick={() => {
              console.log('[ItemActionChooser]: "Order Now" button clicked for items:', items);
              debouncedSelectAction('order_now');
            }}
            className="w-full min-h-[48px] bg-[#FF5A1F] hover:bg-[#E04812] text-white font-black py-3.5 px-4 rounded-2xl shadow-md transition-all active:scale-95 flex items-center justify-center space-x-2 text-sm sm:text-base cursor-pointer"
          >
            <Zap className="w-5 h-5 text-white" />
            <span>{t('orderNow')}</span>
          </button>

          {/* SCHEDULE BUTTON */}
          <button
            type="button"
            onClick={() => {
              console.log('[ItemActionChooser]: "Schedule" button clicked for items:', items);
              debouncedSelectAction('schedule');
            }}
            className="w-full min-h-[48px] bg-[#DAF0F7] hover:bg-[#B2E2F0] text-[#1A1110] font-black py-3.5 px-4 rounded-2xl border-2 border-[#B2E2F0] shadow-sm transition-all active:scale-95 flex items-center justify-center space-x-2 text-sm sm:text-base cursor-pointer"
          >
            <Clock className="w-5 h-5 text-[#FF5A1F]" />
            <span>{t('scheduleCart')}</span>
          </button>

          {/* ADD TO CART BUTTON */}
          <button
            type="button"
            onClick={() => {
              console.log('[ItemActionChooser]: "Add to Cart" button clicked for items:', items);
              debouncedSelectAction('add_to_cart');
            }}
            className="w-full min-h-[48px] bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 px-4 rounded-2xl shadow-md transition-all active:scale-95 flex items-center justify-center space-x-2 text-sm sm:text-base cursor-pointer"
          >
            <ShoppingCart className="w-5 h-5 text-white" />
            <span>{t('addToCart')}</span>
          </button>

        </div>

      </div>
    </div>
  );
};
