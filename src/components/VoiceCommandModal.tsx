import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { FoodItem } from '../types';
import { SpeechService } from '../services/speechService';
import { SttMatcherService } from '../services/sttMatcherService';
import { Mic, MicOff, X, Command, CheckCircle2, XCircle, Volume2 } from 'lucide-react';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { DynamicFoodSearchEngine } from '../services/dynamicFoodSearch';
import { parseSpokenTimeTo24Hr } from './VoiceOrderDialogModal';
import { calculateScheduleEndDate } from '../services/autoOrderBackgroundService';
import { NLPParserService } from '../services/nlpParserService';
import { ItemActionChooser } from './ItemActionChooser';

export const VoiceCommandModal: React.FC = () => {
  const {
    isVoiceModalOpen,
    setIsVoiceModalOpen,
    t,
    language,
    executeSearch,
    rechargeWallet,
    setActiveView,
    speakText,
    showToast,
    saveSchedule,
    placeInstantOrder,
    setVoiceDialogItem,
    addToCart,
    setIsScheduleCartOpen,
    checkDailyOrderLimitReached,
    processNaturalLanguageVoiceCommand,
    requestWalletBalanceReveal,
    skipScheduleByVoiceCommand
  } = useApp();

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [pendingCommand, setPendingCommand] = useState('');
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [chooserItems, setChooserItems] = useState<FoodItem[] | null>(null);

  const pendingCommandRef = useRef(pendingCommand);
  const awaitingConfirmationRef = useRef(awaitingConfirmation);

  useEffect(() => {
    pendingCommandRef.current = pendingCommand;
  }, [pendingCommand]);

  useEffect(() => {
    awaitingConfirmationRef.current = awaitingConfirmation;
  }, [awaitingConfirmation]);

  useEffect(() => {
    if (!isVoiceModalOpen) {
      SpeechService.stopListening();
      setIsListening(false);
      setTranscript('');
      setPendingCommand('');
      setAwaitingConfirmation(false);
    } else {
      startListeningSession();
    }
    return () => {
      SpeechService.stopListening();
    };
  }, [isVoiceModalOpen]);

  const startListeningSession = () => {
    if (!SpeechService.isSupported()) return;

    setIsListening(true);
    SpeechService.startListening({
      language,
      continuous: true,
      interimResults: true,
      onStart: () => setIsListening(true),
      onResult: (text, isFinal, nBestTranscripts) => {
        if (text && text.trim()) {
          const candidates = nBestTranscripts && nBestTranscripts.length > 0 ? nBestTranscripts : [text.trim()];
          if (isFinal) {
            handleSpeechResult(text.trim(), candidates);
          } else {
            setTranscript(text);
          }
        }
      },
      onError: (err) => {
        console.warn('[VoiceCommandModal Error]:', err);
        setIsListening(false);
      },
      onEnd: () => {
        setIsListening(false);
        if (isVoiceModalOpen) {
          setTimeout(() => {
            if (isVoiceModalOpen) {
              startListeningSession();
            }
          }, 400);
        }
      }
    });
  };

  const toggleListening = () => {
    if (isListening) {
      SpeechService.stopListening();
      setIsListening(false);
    } else {
      startListeningSession();
    }
  };

  const handleSpeechResult = (spokenText: string, candidates: string[] = [spokenText]) => {
    const lower = spokenText.toLowerCase().trim();

    // Check if user is answering YES/NO to a pending command prompt
    if (awaitingConfirmationRef.current && pendingCommandRef.current) {
      const matchConfirm = SttMatcherService.matchConfirmation(candidates, language);

      if (matchConfirm.isMatched && matchConfirm.matchedValue === 'YES') {
        console.log(`[VoiceCommandModal]: User confirmed with YES via SttMatcherService! Executing "${pendingCommandRef.current}"...`);
        const cmdToRun = pendingCommandRef.current;
        setPendingCommand('');
        setAwaitingConfirmation(false);
        processCommand(cmdToRun);
        return;
      } else if (matchConfirm.isMatched && matchConfirm.matchedValue === 'NO') {
        console.log(`[VoiceCommandModal]: User cancelled with NO via SttMatcherService.`);
        handleCancelCommand();
        return;
      }
    }

    // New spoken command e.g., "Order Dosa", "Order Parotta", "Schedule Dosa at 8 AM"
    setTranscript(spokenText);
    setPendingCommand(spokenText);
    setAwaitingConfirmation(true);

    const askPrompt = language === 'ta'
      ? `"${spokenText}" தொடரவா? "ஆம்" அல்லது "இல்லை" என்று சொல்லுங்கள்.`
      : language === 'hi'
      ? `क्या "${spokenText}" जारी रखें? "हाँ" या "नहीं" बोलें।`
      : `Proceed with "${spokenText}"? Say Yes or No.`;

    SpeechService.stopListening();
    speakText(askPrompt, () => {
      startListeningSession();
    });
  };

  const handleConfirmCommand = () => {
    const cmdToRun = pendingCommand || transcript;
    if (!cmdToRun) return;
    setPendingCommand('');
    setAwaitingConfirmation(false);
    processCommand(cmdToRun);
  };

  const handleCancelCommand = () => {
    setPendingCommand('');
    setTranscript('');
    setAwaitingConfirmation(false);
    SpeechService.stopListening();

    const cancelMsg = language === 'ta'
      ? 'கட்டளை ரத்து செய்யப்பட்டது. புதிய கட்டளையைக் கூறுங்கள்.'
      : language === 'hi'
      ? 'कमांड रद्द कर दिया गया। नया कमांड बोलें।'
      : 'Command cancelled. Please speak your new command.';

    showToast(cancelMsg);
    speakText(cancelMsg, () => {
      startListeningSession();
    });
  };

  const processCommand = async (cmdText: string) => {
    if (!cmdText || !cmdText.trim()) return;

    const raw = cmdText.toLowerCase().trim();

    // 🚀 STEP -1: Check single-day schedule skip/cancel voice command
    const isSkipHandled = await skipScheduleByVoiceCommand(cmdText);
    if (isSkipHandled) {
      console.log(`[VoiceCommandModal]: Single-day schedule skip voice command processed for "${cmdText}"`);
      setIsVoiceModalOpen(false);
      return;
    }

    // 🚀 STEP 0: Run NLP Algorithm parser for multi-item / Tanglish / Saravana Bhavan orders
    const isNlpHandled = await processNaturalLanguageVoiceCommand(cmdText);
    if (isNlpHandled) {
      console.log(`[VoiceCommandModal]: Handled by NLP algorithm -> Voice command processed!`);
      setIsVoiceModalOpen(false);
      return;
    }

    // Balance Reveal Intent
    if (
      raw.includes('check balance') ||
      raw.includes('show balance') ||
      raw.includes('view balance') ||
      raw.includes('my balance') ||
      raw.includes('wallet balance') ||
      raw.includes('இருப்பு') ||
      raw.includes('வாலட் இருப்பு') ||
      raw.includes('बैलेंस')
    ) {
      setIsVoiceModalOpen(false);
      requestWalletBalanceReveal();
      return;
    }

    // 1. Recharge Wallet Intent
    if (raw.includes('recharge') || raw.includes('பணம்') || raw.includes('ரீசார்ஜ்') || raw.includes('रिचार्ज')) {
      const match = raw.match(/\d+/);
      const amount = match ? parseInt(match[0], 10) : 500;
      rechargeWallet(amount);
      setActiveView('wallet');
      setIsVoiceModalOpen(false);
      return;
    }

    // Smart Multilingual Food Item Matcher
    const matchedItem = DynamicFoodSearchEngine.findBestMatchingFoodItem(cmdText);

    // Multilingual Intent Detection
    const isScheduleIntent = raw.includes('schedule') || raw.includes('அட்டவணை') || raw.includes('திட்டமிடு') || raw.includes('அட்டவணைப்படுத்து') || raw.includes('शेड्यूल');
    const isOrderNowIntent = raw.includes('order') || raw.includes('now') || raw.includes('instant') || raw.includes('ஆர்டர்') || raw.includes('இப்போதே') || raw.includes('இப்போ') || raw.includes('ஆர்டர் பண்ணு') || raw.includes('ஆர்டர் செய்') || raw.includes('ऑर्डर') || raw.includes('अभी');

    // 🚀 RULE 1: SCHEDULE INTENT ("schedule [item]") -> LAUNCH FULL INTERACTIVE VOICE SCHEDULING WIZARD
    if (isScheduleIntent && matchedItem) {
      console.log(`[VoiceCommandModal]: Schedule Intent Triggered for "${matchedItem.name}" -> Launching Interactive Voice Scheduling Wizard...`);
      if (checkDailyOrderLimitReached()) {
        setIsVoiceModalOpen(false);
        return;
      }
      setVoiceDialogItem(matchedItem);
      setIsVoiceModalOpen(false);
      return;
    }

    // 🚀 RULE 2: ORDER INSTANT INTENT ("order [item]" / "order [item] now") -> DIRECT INSTANT ORDER WITHOUT QUESTIONS
    if (isOrderNowIntent && matchedItem) {
      console.log(`[VoiceCommandModal]: Direct Instant Order Triggered for "${matchedItem.name}" (Spoken: "${cmdText}")`);
      if (checkDailyOrderLimitReached()) {
        setIsVoiceModalOpen(false);
        return;
      }
      placeInstantOrder(matchedItem);
      setIsVoiceModalOpen(false);
      return;
    }

    // 🚀 RULE 3: ONLY ITEM NAME SPOKEN (e.g. just "Parotta", "Dosa", "பரோட்டா") -> OPEN ITEM ACTION CHOOSER
    if (matchedItem) {
      console.log(`[VoiceCommandModal]: Item matched ("${cmdText}") -> Opening ItemActionChooser for "${matchedItem.name}"`);
      setChooserItems([matchedItem]);
      return;
    }

    // Fallback if no specific food item matched
    executeSearch(cmdText, false);
    setActiveView('search');
    setIsVoiceModalOpen(false);
  };

  if (!isVoiceModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border-2 border-[#DAF0F7] relative text-[#1A1110]">
        
        {/* Close Button */}
        <button
          onClick={() => {
            SpeechService.stopListening();
            setIsVoiceModalOpen(false);
          }}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-[#4A5568] cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-3 bg-[#FF5A1F]/10 text-[#FF5A1F] rounded-2xl">
            <Mic className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-black text-[#1A1110]">{t('voice.modalTitle')}</h2>
            <p className="text-xs text-[#4A5568] font-bold">
              {awaitingConfirmation
                ? (language === 'ta' ? 'குரல் உறுதிப்படுத்தல்: "ஆம்" அல்லது "இல்லை" என்று சொல்லுங்கள்' : language === 'hi' ? 'आवाज़ पुष्टि: "हाँ" या "नहीं" बोलें' : 'Voice Confirmation Active: Say "Yes" or "No"')
                : t('voice.listening')}
            </p>
          </div>
        </div>

        {/* Listening Visualizer Button */}
        <div className="flex flex-col items-center justify-center my-4">
          <button
            onClick={toggleListening}
            className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 transform active:scale-95 cursor-pointer ${
              isListening
                ? 'bg-[#C2185B] text-white animate-ping'
                : 'bg-[#FF5A1F] hover:bg-[#E04812] text-white hover:scale-105'
            }`}
          >
            {isListening ? <MicOff className="w-8 h-8 text-white" /> : <Mic className="w-8 h-8 text-white" />}
          </button>
          <span className="mt-2 text-xs font-extrabold text-[#1A1110]">
            {isListening ? 'Mic Active - Listening...' : 'Tap Mic to Speak'}
          </span>
        </div>

        {/* Transcript & Voice Yes/No Confirmation Card */}
        <div className={`p-4 rounded-2xl border min-h-[90px] mb-4 transition-all text-center flex flex-col items-center justify-center space-y-2 ${
          awaitingConfirmation
            ? 'bg-[#DAF0F7]/60 border-[#FF5A1F] text-[#1A1110]'
            : 'bg-[#DAF0F7]/30 border-[#B2E2F0] text-[#1A1110]'
        }`}>
          {transcript ? (
            <div>
              <p className="text-xs uppercase font-black tracking-wider text-[#FF5A1F] mb-1">
                {awaitingConfirmation ? 'Recognized Command — Awaiting Voice "Yes" or "No"' : 'Recognized Speech'}
              </p>
              <p className="text-lg font-black leading-snug">"{transcript}"</p>
              {awaitingConfirmation && (
                <p className="text-xs font-bold text-[#4A5568] mt-1 flex items-center justify-center gap-1">
                  <Volume2 className="w-3.5 h-3.5 text-[#FF5A1F] animate-pulse" />
                  <span>
                    {language === 'ta' ? 'தொடரவா? "ஆம்" அல்லது "இல்லை" என்று சொல்லுங்கள்' : language === 'hi' ? 'जारी रखें? "हाँ" या "नहीं" बोलें' : 'Proceed? Say "Yes" or "No" out loud'}
                  </span>
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-[#4A5568] italic font-bold">
              Say "order dosa" or "schedule parotta at 8 AM". Say "Yes" or "No" to confirm hands-free!
            </p>
          )}
        </div>

        {/* Voice or Tap Confirmation Action Buttons */}
        {awaitingConfirmation && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={handleCancelCommand}
              className="py-3 px-4 bg-[#C2185B]/10 hover:bg-[#C2185B]/20 text-[#C2185B] font-black rounded-2xl text-xs shadow-sm transition-all flex items-center justify-center space-x-1.5 cursor-pointer border border-[#C2185B]/30"
            >
              <XCircle className="w-4 h-4 text-[#C2185B]" />
              <span>
                {language === 'ta' ? 'இல்லை (Cancel)' : language === 'hi' ? 'नहीं (Cancel)' : 'No, Cancel (Say "No")'}
              </span>
            </button>

            <button
              onClick={handleConfirmCommand}
              className="py-3 px-4 bg-[#FF5A1F] hover:bg-[#E04812] text-white font-black rounded-2xl text-xs shadow-md shadow-[#FF5A1F]/30 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>
                {language === 'ta' ? 'ஆம் (Proceed)' : language === 'hi' ? 'हाँ (Proceed)' : 'Yes, Proceed (Say "Yes")'}
              </span>
            </button>
          </div>
        )}

        {/* Process Command Fallback Button */}
        {transcript && !awaitingConfirmation && (
          <button
            onClick={() => processCommand(transcript)}
            className="w-full bg-[#FF5A1F] hover:bg-[#E04812] text-white font-black py-3 rounded-2xl mb-4 shadow-md transition-transform active:scale-98 cursor-pointer text-xs sm:text-sm"
          >
            Process Voice Command Now 🚀
          </button>
        )}

        {/* Quick Sample Voice Command Presets */}
        <div>
          <h4 className="text-xs font-black text-[#4A5568] uppercase tracking-wider mb-2 flex items-center gap-1">
            <Command className="w-3.5 h-3.5" /> Direct Voice Command Presets (Click or Speak):
          </h4>
          <div className="grid grid-cols-1 gap-2 text-xs">
            <button
              onClick={() => handleSpeechResult("order dosa")}
              className="text-left bg-[#16A34A]/10 hover:bg-[#16A34A]/20 text-[#16A34A] font-extrabold p-2.5 rounded-xl border border-[#16A34A]/30 cursor-pointer"
            >
              ⚡ "order dosa" → (Transcribes "Order Dosa" & Asks Voice "Yes/No")
            </button>

            <button
              onClick={() => handleSpeechResult("schedule parotta at 8 AM")}
              className="text-left bg-[#DAF0F7] hover:bg-[#B2E2F0] text-[#1A1110] font-extrabold p-2.5 rounded-xl border border-[#B2E2F0] cursor-pointer"
            >
              📅 "schedule parotta at 8 AM" → Direct Schedule for 8 AM
            </button>

            <button
              onClick={() => handleSpeechResult("parotta")}
              className="text-left bg-[#FF5A1F]/10 hover:bg-[#FF5A1F]/20 text-[#FF5A1F] font-extrabold p-2.5 rounded-xl border border-[#FF5A1F]/30 cursor-pointer"
            >
              ❓ "parotta" → (Item only spoken → Asks "Order Now or Schedule?")
            </button>
          </div>
        </div>

      </div>

      {/* SHARED ITEM ACTION CHOOSER MODAL */}
      <ItemActionChooser
        isOpen={Boolean(chooserItems && chooserItems.length > 0)}
        onClose={() => setChooserItems(null)}
        items={chooserItems || []}
        onOrderNow={(items) => {
          if (items.length === 1) {
            placeInstantOrder(items[0]);
          } else {
            items.forEach(i => addToCart(i, 1, 'voice_search'));
            setIsScheduleCartOpen(true);
          }
          setIsVoiceModalOpen(false);
        }}
        onSchedule={(items) => {
          items.forEach(i => addToCart(i, 1, 'voice_search'));
          setIsScheduleCartOpen(true);
          setIsVoiceModalOpen(false);
        }}
        onAddToCart={(items) => {
          items.forEach(i => addToCart(i, 1, 'voice_search'));
          const firstItemName = items[0].nativeNames?.[language] || items[0].name;
          const addedMsg = t('addedNext').replace('{item}', items.length > 1 ? `${items.length} items` : firstItemName);
          showToast(addedMsg);
          speakText(addedMsg);
          setIsVoiceModalOpen(false);
        }}
      />
    </div>
  );
};
