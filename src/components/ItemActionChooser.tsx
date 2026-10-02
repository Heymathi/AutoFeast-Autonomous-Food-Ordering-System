import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { FoodItem } from '../types';
import { SpeechService } from '../services/speechService';
import { ChooserVoiceService, ChooserAction } from '../services/chooserVoiceService';
import { Zap, Clock, ShoppingCart, X, Volume2, Mic, MicOff, Sparkles, AlertCircle } from 'lucide-react';

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
  const { language, speakText, t, showToast, accessibilitySettings } = useApp();

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
    SpeechService.stopListening();
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
    console.log('[ItemActionChooser]: Prompting user aloud:', promptText);

    // Speak prompt; show toast fallback if TTS voice not available
    try {
      speakText(promptText, () => {
        if (isComponentMounted.current && isOpen) {
          startListeningForChoice();
        }
      });
    } catch (err) {
      console.warn('[ItemActionChooser TTS fallback]:', err);
      showToast(promptText);
      startListeningForChoice();
    }
  };

  const startListeningForChoice = () => {
    if (!SpeechService.isSupported()) {
      setIsListening(false);
      return;
    }

    setIsListening(true);
    console.log('[ItemActionChooser]: Listening for user voice action choice...');

    SpeechService.startListening({
      language,
      continuous: true,
      interimResults: true,
      onStart: () => {
        if (isComponentMounted.current) setIsListening(true);
      },
      onResult: (text, isFinal, nBest) => {
        if (!text) return;
        setLiveTranscript(text);
        if (!isFinal) return;

        const candidate = nBest && nBest.length > 0 ? nBest[0] : text;
        console.log(`[ItemActionChooser Spoken Answer]: "${candidate}"`);

        const action = ChooserVoiceService.parseChooserAction(candidate, activePromptRef.current);

        if (action === 'order_now') {
          handleSelectAction('order_now');
        } else if (action === 'schedule') {
          handleSelectAction('schedule');
        } else if (action === 'add_to_cart') {
          handleSelectAction('add_to_cart');
        } else if (action === 'retry' && !hasRetried) {
          setHasRetried(true);
          const retryMsg = t('chooserRetry');
          setStatusMessage(retryMsg);
          speakText(retryMsg, () => {
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

    if (action === 'order_now') {
      onOrderNow(items);
    } else if (action === 'schedule') {
      onSchedule(items);
    } else if (action === 'add_to_cart') {
      onAddToCart(items);
    }
    onClose();
  };

  const handleClose = () => {
    cleanupSpeech();
    onClose();
  };

  if (!isOpen || !items || items.length === 0) return null;

  const primaryItem = items[0];

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
          <div className="flex items-center space-x-3 bg-slate-50 p-3 rounded-2xl border border-slate-200 mb-6">
            <img src={primaryItem.image} alt={primaryItem.name} className="w-16 h-16 rounded-xl object-cover" />
            <div>
              <h4 className="text-sm font-black text-[#1A1110]">{primaryItem.name}</h4>
              <p className="text-xs text-[#FF5A1F] font-extrabold">{primaryItem.restaurant}</p>
              <span className="text-xs font-black text-[#16A34A]">₹{primaryItem.basePrice}</span>
            </div>
          </div>
        )}

        {/* 3 BIG ACTION BUTTONS (Min 44px height, high touch area) */}
        <div className="grid grid-cols-1 gap-3">
          
          {/* ORDER NOW BUTTON */}
          <button
            type="button"
            onClick={() => handleSelectAction('order_now')}
            className="w-full min-h-[48px] bg-[#FF5A1F] hover:bg-[#E04812] text-white font-black py-3.5 px-4 rounded-2xl shadow-md transition-all active:scale-95 flex items-center justify-center space-x-2 text-sm sm:text-base cursor-pointer"
          >
            <Zap className="w-5 h-5 text-white" />
            <span>{t('orderNow')}</span>
          </button>

          {/* SCHEDULE BUTTON */}
          <button
            type="button"
            onClick={() => handleSelectAction('schedule')}
            className="w-full min-h-[48px] bg-[#DAF0F7] hover:bg-[#B2E2F0] text-[#1A1110] font-black py-3.5 px-4 rounded-2xl border-2 border-[#B2E2F0] shadow-sm transition-all active:scale-95 flex items-center justify-center space-x-2 text-sm sm:text-base cursor-pointer"
          >
            <Clock className="w-5 h-5 text-[#FF5A1F]" />
            <span>{t('scheduleCart')}</span>
          </button>

          {/* ADD TO CART BUTTON */}
          <button
            type="button"
            onClick={() => handleSelectAction('add_to_cart')}
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
