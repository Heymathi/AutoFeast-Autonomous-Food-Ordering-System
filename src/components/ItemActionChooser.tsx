import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { FoodItem } from '../types';

import { ChooserVoiceService, ChooserAction } from '../services/chooserVoiceService';
import { SttMatcherService } from '../services/sttMatcherService';
import { NomineeNotificationService } from '../services/nomineeNotificationService';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { Zap, Clock, ShoppingCart, X, Volume2, Mic, MicOff, Sparkles, AlertCircle, ShieldAlert } from 'lucide-react';

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
    isItemApprovedByNominee,
    handleNomineeRestrictedInterception
  } = useApp();

  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [hasRetried, setHasRetried] = useState(false);

  const activePromptRef = useRef<string>('');
  const isComponentMounted = useRef<boolean>(false);
  const spokenTurnKeyRef = useRef<string>('');
  const handledActionRef = useRef<boolean>(false);
  const failedCountRef = useRef<number>(0);

  const itemIdsKey = items && items.length > 0 ? items.map(i => i.id).join(',') : '';

  useEffect(() => {
    isComponentMounted.current = true;
    if (isOpen && itemIdsKey) {
      const turnKey = `${itemIdsKey}:${language}`;
      if (spokenTurnKeyRef.current !== turnKey) {
        spokenTurnKeyRef.current = turnKey;
        handledActionRef.current = false;
        failedCountRef.current = 0;
        setHasRetried(false);
        setLiveTranscript('');
        triggerChooserTTSAndListening();
      }
    } else {
      spokenTurnKeyRef.current = '';
      handledActionRef.current = false;
      failedCountRef.current = 0;
      cleanupSpeech();
    }

    return () => {
      if (!isOpen) {
        isComponentMounted.current = false;
        spokenTurnKeyRef.current = '';
        cleanupSpeech();
      }
    };
  }, [isOpen, itemIdsKey, language]);

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
        if (isComponentMounted.current && isOpen && !handledActionRef.current) {
          startListeningForChoice();
        }
      },
      (fallbackText) => {
        showToast(fallbackText, 'info', 5000, 'item_chooser_prompt', undefined, undefined, true);
      },
      'item_chooser',
      `item_chooser_${itemIdsKey}`
    );
  };

  const startListeningForChoice = () => {
    if (!SpeechController.isSupported() || handledActionRef.current) {
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
        if (!text || handledActionRef.current) return;
        setLiveTranscript(text);

        const candidates = nBest && nBest.length > 0 ? nBest : [text];
        const action = ChooserVoiceService.parseChooserAction(candidates, activePromptRef.current, language);

        if (action === 'cancel') {
          handledActionRef.current = true;
          SpeechController.markHandling('item_chooser');
          cleanupSpeech();
          onClose();
          return;
        }
        if (action === 'order_now' || action === 'schedule' || action === 'add_to_cart') {
          handledActionRef.current = true;
          SpeechController.markHandling('item_chooser');
          handleSelectActionRef.current(action);
          return;
        }

        // Only evaluate retry/stop on final transcripts
        if (!isFinal) return;

        const controlMatch = SttMatcherService.matchControlCommand(candidates);
        if (controlMatch.isMatched && (controlMatch.matchedValue === 'CANCEL' || controlMatch.matchedValue === 'STOP')) {
          handledActionRef.current = true;
          SpeechController.markHandling('item_chooser');
          cleanupSpeech();
          onClose();
          return;
        }

        failedCountRef.current += 1;
        if (failedCountRef.current === 1 && !hasRetried) {
          setHasRetried(true);
          const retryMsg = language === 'ta'
            ? 'மன்னிக்கவும், புரியவில்லை. இப்போதே ஆர்டர், திட்டமிடு அல்லது கார்ட்டில் சேர் என்று சொல்லவும்.'
            : language === 'hi'
            ? 'क्षमा करें, समझ नहीं आया। अभी ऑर्डर, शेड्यूल या कार्ट में डालो बोलें।'
            : 'Sorry, I did not catch that. Please say Order Now, Schedule, or Add to Cart.';
          setStatusMessage(retryMsg);
          SpeechController.speak(
            retryMsg,
            language,
            () => {
              if (isComponentMounted.current && isOpen && !handledActionRef.current) {
                startListeningForChoice();
              }
            },
            (fallbackText) => {
              showToast(fallbackText, 'info', 5000, 'item_chooser_retry', undefined, undefined, true);
            },
            'item_chooser',
            `item_chooser_retry_${itemIdsKey}`
          );
        } else {
          // After 2 failed attempts, stop voice and leave buttons usable
          cleanupSpeech();
          const stopMsg = language === 'ta'
            ? 'தெளிவாகக் கேட்கவில்லை. தயவுசெய்து கீழே உள்ள பட்டனைத் தொடவும்.'
            : language === 'hi'
            ? 'साफ़ सुनाई नहीं दिया। कृपया नीचे दिए गए बटन को दबाएं।'
            : 'Could not hear clearly. Please tap one of the buttons below.';
          setStatusMessage(stopMsg);
        }
      },
      onError: () => {
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
      if (isRestrictedByNominee) {
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
  const isAnyRestricted = items.some(item => checkIsItemRestrictedByNominee(item.id, item.name));
  const isApproved = items.every(item => !checkIsItemRestrictedByNominee(item.id, item.name) || isItemApprovedByNominee(item.id));
  const showOrderAndSchedule = !isAnyRestricted || isApproved;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className={`relative w-full max-w-lg rounded-3xl p-6 shadow-2xl border-4 transition-all ${
        accessibilitySettings.highContrast
          ? 'bg-black text-white border-yellow-400'
          : 'bg-white text-[#1A1110] border-[#C82346]'
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
        <div className="space-y-2 pr-8 border-b border-[#FFF5F6] pb-4">
          <span className="text-xs font-black uppercase text-[#C82346] bg-[#C82346]/10 px-3 py-1 rounded-full border border-[#C82346]/20">
            {t('nav.title')} • Item Chooser
          </span>

          <h3 className="text-xl sm:text-2xl font-black text-[#1A1110] flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#C82346]" />
            {items.length === 1 ? primaryItem.name : `${items.length} Items Selected`}
          </h3>

          <p className="text-xs sm:text-sm font-semibold text-[#4A5568]">
            {items.length === 1 ? `${primaryItem.restaurant} • ₹${primaryItem.basePrice}` : items.map(i => i.name).join(', ')}
          </p>
        </div>

        {/* Spoken Prompt / Live Voice Indicator */}
        <div className="my-4 p-3 bg-[#FFF5F6]/40 rounded-2xl border border-[#FCE7EB] space-y-1">
          <div className="flex items-center justify-between text-xs font-black text-[#1A1110]">
            <span className="flex items-center gap-1.5 text-[#C82346]">
              <Volume2 className="w-4 h-4 animate-pulse" />
              <span>Prompt:</span>
            </span>
            {isListening && (
              <span className="bg-[#C82346] text-white px-2 py-0.5 rounded-md text-[10px] uppercase font-bold flex items-center gap-1">
                <Mic className="w-3 h-3 animate-ping" /> Listening...
              </span>
            )}
          </div>
          <p className="text-xs font-bold text-[#1A1110]">{statusMessage || getPromptText()}</p>
          {liveTranscript && (
            <p className="text-xs font-extrabold text-[#C82346] italic">Heard: "{liveTranscript}"</p>
          )}
        </div>

        {/* Item Preview Card */}
        {items.length === 1 && (
          <div className="flex items-center space-x-3 bg-slate-50 p-3 rounded-2xl border border-slate-200 mb-4">
            <img src={primaryItem.image} alt={primaryItem.name} className="w-16 h-16 rounded-xl object-cover" />
            <div>
              <h4 className="text-sm font-black text-[#1A1110]">{primaryItem.name}</h4>
              <p className="text-xs text-[#C82346] font-extrabold">{primaryItem.restaurant}</p>
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

        {/* ACTION BUTTONS (Order Now & Schedule appear only after approval for restricted items) */}
        <div className="grid grid-cols-1 gap-3">
          {showOrderAndSchedule ? (
            <>
              {/* ORDER NOW BUTTON */}
              <button
                type="button"
                onClick={() => {
                  console.log('[ItemActionChooser]: "Order Now" button clicked for items:', items);
                  debouncedSelectAction('order_now');
                }}
                className="w-full min-h-[48px] bg-[#C82346] hover:bg-[#B31D3D] text-white font-black py-3.5 px-4 rounded-2xl shadow-md transition-all active:scale-95 flex items-center justify-center space-x-2 text-sm sm:text-base cursor-pointer"
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
                className="w-full min-h-[48px] bg-[#FFF5F6] hover:bg-[#FCE7EB] text-[#1A1110] font-black py-3.5 px-4 rounded-2xl border-2 border-[#FCE7EB] shadow-sm transition-all active:scale-95 flex items-center justify-center space-x-2 text-sm sm:text-base cursor-pointer"
              >
                <Clock className="w-5 h-5 text-[#C82346]" />
                <span>{t('scheduleCart')}</span>
              </button>
            </>
          ) : (
            /* REQUEST NOMINEE APPROVAL BUTTON - SHOWN WHEN RESTRICTED & NOT APPROVED */
            <button
              type="button"
              onClick={() => {
                console.log('[ItemActionChooser]: "Request Nominee Approval" clicked for item:', primaryItem.name);
                handleNomineeRestrictedInterception(primaryItem, 'instant');
                onClose();
              }}
              className="w-full min-h-[50px] bg-amber-500 hover:bg-amber-600 text-white font-black py-3.5 px-4 rounded-2xl shadow-md transition-all active:scale-95 flex items-center justify-center space-x-2 text-sm sm:text-base cursor-pointer"
            >
              <ShieldAlert className="w-5 h-5 text-white" />
              <span>{t('nominee.requestApprovalBtn')}</span>
            </button>
          )}

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
