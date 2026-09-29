import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ParsedOrderBill } from '../services/nlpParserService';
import { SpeechService } from '../services/speechService';
import { SttMatcherService } from '../services/sttMatcherService';
import { FileText, CheckCircle, XCircle, Mic, MapPin, Clock, X } from 'lucide-react';

interface PreOrderBillModalProps {
  bill: ParsedOrderBill | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmProceedToPin: (bill: ParsedOrderBill) => void;
}

export const PreOrderBillModal: React.FC<PreOrderBillModalProps> = ({
  bill,
  isOpen,
  onClose,
  onConfirmProceedToPin
}) => {
  const { language, accessibilitySettings, speakText } = useApp();
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');

  useEffect(() => {
    if (isOpen && bill) {
      setLiveTranscript('');

      // Format spoken bill summary prompt
      const itemNamesList = bill.items.map(i => `${i.quantity} ${i.foodItem.nativeNames?.[language] || i.foodItem.name}`).join(', ');

      // Price Comparison Readout String
      let priceCompMsg = '';
      if (bill.priceComparison) {
        const cheapest = bill.priceComparison.cheapest;
        const fastest = bill.priceComparison.fastest;
        const cheapestPrice = cheapest.price + cheapest.deliveryFee;

        if (language === 'ta') {
          priceCompMsg = ` விலை ஒப்பீடு: இதே உணவு ${cheapest.platformName}-இல் குறைந்த விலையாக ₹${cheapestPrice}-க்கு கிடைக்கிறது, ${fastest.platformName}-இல் ${fastest.deliveryTime} நிமிடத்தில் வேகமானது.`;
        } else if (language === 'hi') {
          priceCompMsg = ` कीमत तुलना: यही आइटम ${cheapest.platformName} पर ₹${cheapestPrice} में सबसे सस्ता और ${fastest.platformName} पर ${fastest.deliveryTime} मिनट में सबसे तेज़ है।`;
        } else {
          priceCompMsg = ` Price Comparison: Same item is cheapest on ${cheapest.platformName} at ₹${cheapestPrice}, and fastest on ${fastest.platformName} in ${fastest.deliveryTime} mins.`;
        }
      }

      let speakMsg = '';
      if (language === 'ta') {
        speakMsg = `உங்கள் ஆர்டர்: ${bill.restaurantName}-லிருந்து ${itemNamesList}. சப்-டோட்டல் ₹${bill.subtotal.toFixed(2)}, ஜிஎஸ்டி ₹${bill.totalGst.toFixed(2)}, மொத்தம் ₹${bill.grandTotal}.${priceCompMsg} இப்போது இந்த ஆர்டரை செய்யவா?`;
      } else if (language === 'hi') {
        speakMsg = `आपका ऑर्डर: ${bill.restaurantName} से ${itemNamesList}। सब-टोटल ₹${bill.subtotal.toFixed(2)}, जीएसटी ₹${bill.totalGst.toFixed(2)}, कुल ₹${bill.grandTotal}।${priceCompMsg} क्या मैं यह ऑर्डर अभी रखूं?`;
      } else {
        speakMsg = `Your order: ${itemNamesList} from ${bill.restaurantName}. Subtotal ₹${bill.subtotal.toFixed(2)}, GST ₹${bill.totalGst.toFixed(2)}, Total ₹${bill.grandTotal}.${priceCompMsg} Should I place this order now?`;
      }

      console.log('[PreOrderBillModal]: Speaking bill summary aloud ->', speakMsg);

      // Stop any existing mic session before TTS speaks
      SpeechService.stopListening();
      setIsListening(false);

      speakText(speakMsg, () => {
        // Start listening for spoken "Yes" or "No" after TTS finishes
        startListeningForConfirmation();
      }, language);
    } else {
      SpeechService.stopListening();
      setIsListening(false);
    }
  }, [isOpen, bill, language]);

  const startListeningForConfirmation = () => {
    if (!isOpen || !SpeechService.isSupported()) return;

    SpeechService.startListening({
      language,
      continuous: true,
      interimResults: true,
      onStart: () => setIsListening(true),
      onResult: (transcript, isFinal, nBestTranscripts) => {
        if (!transcript) return;
        setLiveTranscript(transcript);
        console.log('[PreOrderBillModal Spoken Confirmation Reply]:', transcript);

        const candidates = nBestTranscripts && nBestTranscripts.length > 0 ? nBestTranscripts : [transcript];
        const matchResult = SttMatcherService.matchConfirmation(candidates, language);

        if (matchResult.isMatched) {
          if (matchResult.matchedValue === 'YES') {
            console.log('🚀 [PreOrderBillModal via SttMatcherService]: Spoken Yes confirmed! Advancing to PIN Modal...');
            handleConfirmProceed();
          } else if (matchResult.matchedValue === 'NO') {
            console.log('[PreOrderBillModal via SttMatcherService]: Spoken No detected. Cancelling order.');
            SpeechService.stopListening();
            setIsListening(false);
            onClose();
          }
        }
      },
      onError: () => setIsListening(false),
      onEnd: () => setIsListening(false)
    });
  };

  const handleConfirmProceed = () => {
    if (!bill) return;
    SpeechService.stopListening();
    setIsListening(false);
    onConfirmProceedToPin(bill);
  };

  if (!isOpen || !bill) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className={`relative w-full max-w-lg max-h-[94vh] flex flex-col rounded-3xl p-4 sm:p-6 shadow-2xl transition-all border-4 overflow-hidden ${
        accessibilitySettings.highContrast
          ? 'bg-black text-white border-yellow-400'
          : 'bg-white text-[#1A1110] border-[#FF5A1F]'
      }`}>

        {/* Close Button */}
        <button
          onClick={() => {
            SpeechService.stopListening();
            setIsListening(false);
            onClose();
          }}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-red-100 hover:text-red-600 transition-all text-[#4A5568] cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header (Fixed Top) */}
        <div className="flex items-center space-x-3 mb-3 pr-8 shrink-0">
          <div className="p-2.5 bg-[#FF5A1F]/10 rounded-2xl border border-[#FF5A1F]/30 text-[#FF5A1F] shrink-0">
            <FileText className="w-6 h-6 text-[#FF5A1F]" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#FF5A1F] bg-[#FF5A1F]/10 px-2.5 py-0.5 rounded-full inline-block truncate max-w-full">
              {language === 'ta' ? 'GST இன்வாய்ஸ் விவரம்' : language === 'hi' ? 'जीएसटी चालान विवरण' : 'Official GST Tax Invoice Preview'}
            </span>
            <h2 className="text-lg sm:text-xl font-black text-[#1A1110] dark:text-white mt-0.5 truncate">
              {bill.restaurantName}
            </h2>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 my-1 text-xs">
          
          {/* Delivery Address & ETA Badge */}
          <div className="bg-[#DAF0F7]/40 dark:bg-slate-900/60 p-3 rounded-2xl border border-[#B2E2F0] dark:border-slate-800 flex items-center justify-between text-xs gap-2">
            <div className="flex items-center space-x-2 text-[#4A5568] dark:text-slate-300 font-bold min-w-0 truncate">
              <MapPin className="w-4 h-4 text-[#FF5A1F] shrink-0" />
              <span className="truncate">{bill.deliveryAddress}</span>
            </div>
            <div className="flex items-center space-x-1 shrink-0 text-[#16A34A] font-black bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200">
              <Clock className="w-3.5 h-3.5" />
              <span>{bill.etaMinutes} mins</span>
            </div>
          </div>

          {/* Itemized Order List */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase text-[#4A5568] dark:text-slate-400 tracking-wider">
              {language === 'ta' ? 'உணவுப் பட்டியல்:' : language === 'hi' ? 'ऑर्डर आइटम:' : 'Order Items Breakdown:'}
            </h4>
            {bill.items.map((item, idx) => (
              <div key={idx} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-[#FF5A1F] text-white font-black text-xs flex items-center justify-center shrink-0">
                    {item.quantity}x
                  </span>
                  <div className="min-w-0">
                    <h5 className="text-xs font-black text-[#1A1110] dark:text-white truncate">
                      {item.foodItem.nativeNames?.[language] || item.foodItem.name}
                    </h5>
                    <span className="text-[10px] text-[#4A5568] dark:text-slate-400 font-bold block">₹{item.unitPrice} each</span>
                  </div>
                </div>
                <span className="text-xs font-black text-[#1A1110] dark:text-white shrink-0">₹{item.totalPrice}</span>
              </div>
            ))}
          </div>

          {/* Delivery Platform Price Comparison Card */}
          {bill.priceComparison && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-2xl border border-emerald-300 dark:border-emerald-800 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                📊 {language === 'ta' ? 'செயலி விலை ஒப்பீடு (Price Comparison):' : language === 'hi' ? 'ऐप कीमत तुलना:' : 'App Price Comparison:'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {bill.priceComparison.allPlatforms.map((p, idx) => {
                  const isCheapest = p.platform === bill.priceComparison!.cheapest.platform;

                  return (
                    <div
                      key={idx}
                      className={`p-2 rounded-xl border flex items-center justify-between gap-2 ${
                        isCheapest
                          ? 'bg-emerald-100 dark:bg-emerald-900/60 border-emerald-500 font-black'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="font-extrabold text-[11px] text-slate-900 dark:text-white block truncate">
                          {p.platformName}
                        </span>
                        <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold block">
                          ⏱ {p.deliveryTime} mins
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-black text-xs text-slate-900 dark:text-white block">
                          ₹{p.price + p.deliveryFee}
                        </span>
                        {isCheapest && (
                          <span className="text-[8px] font-black bg-emerald-600 text-white px-1.5 py-0.5 rounded-full uppercase inline-block">
                            Best Price
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tax & Bill Breakdown Calculation Card */}
          <div className="bg-slate-100 dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-[#4A5568] dark:text-slate-400 font-bold">
              <span>{language === 'ta' ? 'பொருட்கள் தொகை' : language === 'hi' ? 'सब-टोटल' : 'Items Subtotal'}</span>
              <span>₹{bill.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-[#4A5568] dark:text-slate-400 font-bold">
              <span>CGST (2.5%)</span>
              <span>₹{bill.cgst.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-[#4A5568] dark:text-slate-400 font-bold">
              <span>SGST (2.5%)</span>
              <span>₹{bill.sgst.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-[#4A5568] dark:text-slate-400 font-bold">
              <span>{language === 'ta' ? 'டெலிவரி கட்டணம்' : language === 'hi' ? 'डिलीवरी शुल्क' : 'Delivery Fee'}</span>
              <span>₹{bill.deliveryFee.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-[#4A5568] dark:text-slate-400 font-bold">
              <span>{language === 'ta' ? 'தள கட்டணம்' : language === 'hi' ? 'प्लेटफॉर्म शुल्क' : 'Platform Fee'}</span>
              <span>₹{bill.platformFee.toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-slate-300 dark:border-slate-700 flex items-center justify-between text-sm sm:text-base font-black text-[#1A1110] dark:text-white">
              <span className="text-[#FF5A1F]">{language === 'ta' ? 'மொத்தத் தொகை (GST உடன்):' : language === 'hi' ? 'कुल योग (GST सहित):' : 'Grand Total (with GST):'}</span>
              <span className="text-[#16A34A] text-lg sm:text-xl font-mono">₹{bill.grandTotal}</span>
            </div>
          </div>

          {/* Voice Confirmation Status Card */}
          <div className="p-2.5 bg-slate-900 text-white rounded-2xl text-center space-y-1">
            <div className="flex items-center justify-center space-x-2 text-xs font-black text-yellow-300">
              <Mic className="w-4 h-4 animate-bounce shrink-0" />
              <span className="truncate">
                {isListening
                  ? (language === 'ta' ? 'தானியங்கியாகக் கேட்கிறது: "ஆம்" அல்லது "இல்லை" என்று பேசவும்...' : language === 'hi' ? 'सुन रहा है: "हाँ" या "नहीं" कहें...' : 'Listening: Say "Yes" to confirm or "No" to cancel...')
                  : (language === 'ta' ? 'குரல் உதவி தயார்' : language === 'hi' ? 'वॉइस सहायक तैयार' : 'Voice Assistant Ready')}
              </span>
            </div>
            {liveTranscript && (
              <p className="text-[11px] text-emerald-400 font-bold truncate">Detected Speech: "{liveTranscript}"</p>
            )}
          </div>

          {/* Prompt Question */}
          <p className="text-center text-xs sm:text-sm font-black text-[#1A1110] dark:text-white">
            {language === 'ta'
              ? 'இந்த ஆர்டரை பதிவு செய்ய விரும்புகிறீர்களா?'
              : language === 'hi'
              ? 'क्या आप इस ऑर्डर की पुष्टि करना चाहते हैं?'
              : 'Do you want to confirm and place this order?'}
          </p>
        </div>

        {/* Action Buttons (Fixed Bottom Container) */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-2 shrink-0">
          <button
            onClick={() => {
              SpeechService.stopListening();
              setIsListening(false);
              onClose();
            }}
            className="w-full sm:w-1/3 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-[#4A5568] font-black rounded-2xl text-xs sm:text-sm transition-all border border-slate-300 flex items-center justify-center space-x-1 cursor-pointer"
          >
            <XCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{language === 'ta' ? 'ரத்து' : language === 'hi' ? 'रद्द करें' : 'Cancel'}</span>
          </button>
          <button
            onClick={handleConfirmProceed}
            className="w-full sm:w-2/3 py-3 px-5 bg-[#FF5A1F] hover:bg-[#E04812] text-white font-black rounded-2xl text-xs sm:text-sm shadow-lg shadow-[#FF5A1F]/30 transition-transform active:scale-95 flex items-center justify-center space-x-2 cursor-pointer"
          >
            <CheckCircle className="w-4.5 h-4.5 text-white shrink-0" />
            <span>{language === 'ta' ? 'ஆம், PIN செலுத்தச் செல்' : language === 'hi' ? 'हाँ, पिन दर्ज करें' : 'Yes, Proceed to PIN & Pay'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
