import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ShoppingBag, Trash2, Plus, Minus, X, AlertTriangle, ArrowRight, Utensils, Volume2, Zap, Clock, ShieldAlert } from 'lucide-react';
import { ScheduleCheckoutModal, ScheduleCheckoutItem } from './ScheduleCheckoutModal';
import { PreOrderBillModal } from './PreOrderBillModal';
import { ParsedOrderBill } from '../services/nlpParserService';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';

import { SpeechController } from '../services/speechController';
import { ChooserVoiceService } from '../services/chooserVoiceService';

export interface ScheduleCartModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ScheduleCartModal: React.FC<ScheduleCartModalProps> = ({ isOpen, onClose }) => {
  const {
    cart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    readCartTTS,
    t,
    language,
    showToast,
    checkIsItemRestrictedByNominee,
    onConfirmProceedToPinFromBill
  } = useApp();

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isScheduleCheckoutOpen, setIsScheduleCheckoutOpen] = useState(false);

  React.useEffect(() => {
    if (isOpen && cart.length > 0) {
      const numItems = cart.reduce((sum, item) => sum + item.qty, 0);
      const restaurantCount = new Set(cart.map(item => item.restaurantName || 'Saravana Bhavan')).size;
      const totalAmount = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

      let speakMsg = '';
      if (language === 'ta') {
        speakMsg = `${restaurantCount} உணவகங்களிலிருந்து ${numItems} பொருட்கள். மொத்தம் ${totalAmount} ரூபாய். இப்போதே ஆர்டர் செய்யவா அல்லது அட்டவணைப்படுத்தவா?`;
      } else if (language === 'hi') {
        speakMsg = `आपके पास ${restaurantCount} रेस्तरां से ${numItems} आइटम हैं। कुल ${totalAmount} रुपये। अभी ऑर्डर करें या शेड्यूल करें?`;
      } else {
        speakMsg = `You have ${numItems} items from ${restaurantCount} ${restaurantCount === 1 ? 'restaurant' : 'restaurants'}. Total ${totalAmount} rupees. Order now or schedule?`;
      }

      SpeechController.speak(
        speakMsg,
        language,
        () => {
          if (isOpen && SpeechController.isSupported()) {
            SpeechController.startListening({
              owner: 'cart_checkout',
              language,
              continuous: false,
              interimResults: true,
              maxAlternatives: 5,
              onResult: (transcript: string, isFinal?: boolean, nBest?: string[]) => {
                if (!transcript) return;
                if (!isFinal) return;

                const candidates = nBest && nBest.length > 0 ? nBest : [transcript];
                const action = ChooserVoiceService.parseChooserAction(candidates, speakMsg);

                if (action === 'cancel') {
                  SpeechController.cancelSpeech();
                  SpeechController.releaseMic('cart_checkout');
                  onClose();
                } else if (action === 'order_now') {
                  SpeechController.cancelSpeech();
                  SpeechController.releaseMic('cart_checkout');
                  handleProceedToOrderNow();
                } else if (action === 'schedule') {
                  SpeechController.cancelSpeech();
                  SpeechController.releaseMic('cart_checkout');
                  handleProceedToSchedule();
                }
              }
            });
          }
        },
        (fallbackText: string) => {
          showToast(fallbackText, 'info');
        },
        'cart_checkout'
      );
    } else {
      SpeechController.releaseMic('cart_checkout');
    }

    return () => {
      SpeechController.cancelSpeech();
      SpeechController.releaseMic('cart_checkout');
    };
  }, [isOpen, cart.length, language]);

  if (!isOpen) return null;

  // Group cart items by restaurantName
  const groupedCartItems: Record<string, typeof cart> = {};
  cart.forEach(item => {
    const restaurant = item.restaurantName || 'Hotel Saravana Bhavan';
    if (!groupedCartItems[restaurant]) {
      groupedCartItems[restaurant] = [];
    }
    groupedCartItems[restaurant].push(item);
  });

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.price * item.qty,
    0
  );

  const totalItemCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const checkoutItems: ScheduleCheckoutItem[] = cart.map(item => ({
    foodItem: item.foodItem || {
      id: item.itemId,
      name: item.name,
      restaurant: item.restaurantName,
      basePrice: item.price,
      nativeNames: { ta: item.name, hi: item.name, en: item.name },
      image: item.image || 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=60',
      description: '',
      category: item.category || 'General',
      isVegetarian: item.isVegetarian || false,
      rating: 4.5,
      preparationTimeMinutes: 20,
      locations: ['Chennai'],
      tags: [],
      platforms: []
    },
    quantity: item.qty
  }));

  const handleClearCart = () => {
    clearCart();
    setShowClearConfirm(false);
  };

  const handleProceedToSchedule = () => {
    if (cart.length === 0) return;
    setIsScheduleCheckoutOpen(true);
  };

  const handleProceedToOrderNow = () => {
    if (cart.length === 0) return;

    // Build multi-restaurant bill breakdown object for PreOrderBillModal
    const subtotal = cartTotal;
    const cgst = Math.round(subtotal * 0.025);
    const sgst = Math.round(subtotal * 0.025);
    const totalGst = cgst + sgst;
    const deliveryFee = 30 * Object.keys(groupedCartItems).length;
    const platformFee = 10;
    const grandTotal = subtotal + totalGst + deliveryFee + platformFee;

    const parsedItems = cart.map(item => {
      const catalogMatch = INDIAN_FOOD_CATALOG.find(f => f.id === item.itemId || f.name.toLowerCase() === item.name.toLowerCase());
      const itemPlatforms = (item.foodItem?.platforms && item.foodItem.platforms.length > 0)
        ? item.foodItem.platforms
        : (catalogMatch?.platforms || []);

      const foodItem = item.foodItem
        ? { ...item.foodItem, platforms: itemPlatforms }
        : {
            id: item.itemId,
            name: item.name,
            restaurant: item.restaurantName,
            basePrice: item.price,
            nativeNames: { ta: item.name, hi: item.name, en: item.name },
            image: item.image || '',
            description: '',
            category: item.category || 'General',
            isVegetarian: item.isVegetarian || false,
            rating: 4.5,
            preparationTimeMinutes: 20,
            locations: ['Chennai'],
            tags: [],
            platforms: itemPlatforms
          };

      return {
        foodItem,
        quantity: item.qty,
        unitPrice: item.price,
        totalPrice: item.price * item.qty,
        platforms: itemPlatforms
      };
    });

    const billObj: ParsedOrderBill = {
      restaurantName: Object.keys(groupedCartItems).join(', '),
      items: parsedItems,
      subtotal,
      cgst,
      sgst,
      totalGst,
      deliveryFee,
      platformFee,
      grandTotal,
      deliveryAddress: 'Live GPS Location',
      etaMinutes: 30,
      rawTranscript: 'Cart Order Now Checkout'
    };

    onConfirmProceedToPinFromBill(billObj);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-[9980] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
        <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border-2 border-[#C82346] relative max-h-[90vh] flex flex-col text-[#1A1110]">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[#FFF5F6]">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-[#C82346]/10 text-[#C82346] rounded-2xl">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-[#1A1110] flex items-center gap-2">
                  {t('cartTitle')}
                  {totalItemCount > 0 && (
                    <span className="text-xs bg-[#C82346] text-white px-2.5 py-0.5 rounded-full font-black">
                      {totalItemCount}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-[#4A5568] font-bold">
                  {totalItemCount === 1 ? '1 item in cart' : `${totalItemCount} items in cart`}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {cart.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={readCartTTS}
                    className="p-2 bg-[#FFF5F6] hover:bg-[#FCE7EB] text-[#C82346] rounded-xl transition-colors cursor-pointer"
                    title="Read Cart Aloud"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-[#C82346] rounded-xl text-xs font-black border border-rose-200 transition-colors cursor-pointer flex items-center space-x-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('clearCart')}</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-[#4A5568] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Confirm Clear Modal Overlay */}
          {showClearConfirm && (
            <div className="p-4 my-3 bg-rose-50 border-2 border-[#C82346] rounded-2xl text-center space-y-3 animate-fade-in">
              <p className="text-xs font-black text-[#C82346]">
                ⚠️ {t('clearCartAsk')}
              </p>
              <div className="flex justify-center space-x-3">
                <button
                  type="button"
                  onClick={handleClearCart}
                  className="px-4 py-2 bg-[#C82346] hover:bg-[#B31D3D] text-white font-black text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Yes, Clear Cart
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-[#1A1110] font-black text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Cart Items List Grouped by Restaurant */}
          <div className="flex-1 overflow-y-auto py-4 space-y-5">
            {cart.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <div className="w-16 h-16 bg-[#FFF5F6] text-[#C82346] rounded-full flex items-center justify-center mx-auto">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h4 className="text-lg font-black text-[#1A1110]">{t('cartEmpty')}</h4>
                <p className="text-xs text-[#4A5568] font-bold max-w-xs mx-auto">
                  Add items from Food Search, Healthy Food, or Auto Scheduler to build your unified cart!
                </p>
              </div>
            ) : (
              Object.entries(groupedCartItems).map(([restaurant, items]) => {
                const restaurantSubtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
                return (
                  <div key={restaurant} className="bg-slate-50 p-4 rounded-2xl border border-[#FFF5F6] space-y-3">
                    <div className="flex items-center justify-between border-b border-[#FCE7EB] pb-2">
                      <div className="flex items-center space-x-2">
                        <Utensils className="w-4 h-4 text-[#C82346]" />
                        <h4 className="text-xs font-black text-[#1A1110] uppercase tracking-wider">{restaurant}</h4>
                      </div>
                      <span className="text-xs font-black text-[#C82346]">Subtotal: ₹{restaurantSubtotal}</span>
                    </div>

                    <div className="space-y-2">
                      {items.map(item => {
                        const isRestricted = item.needsNomineeApproval || checkIsItemRestrictedByNominee(item.itemId, item.name);
                        return (
                          <div
                            key={`${item.itemId}-${item.restaurantName}`}
                            className="bg-white p-3 rounded-xl border border-[#FCE7EB] flex items-center justify-between shadow-xs"
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="w-12 h-12 rounded-xl object-cover shrink-0"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 font-bold shrink-0">
                                  🍲
                                </div>
                              )}
                              <div className="min-w-0">
                                <h5 className="text-xs font-black text-[#1A1110] truncate">
                                  {item.foodItem?.nativeNames?.[language] || item.name}
                                </h5>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <span className="text-xs font-bold text-[#C82346]">
                                    ₹{item.price} each
                                  </span>
                                  {isRestricted && (
                                    <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-md flex items-center gap-1">
                                      <ShieldAlert className="w-3 h-3 text-rose-600" />
                                      Needs helper approval
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Qty Controls & Trash Button */}
                            <div className="flex items-center space-x-3 shrink-0">
                              <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => updateCartQuantity(item.itemId, item.restaurantName, item.qty - 1)}
                                  className="p-1 rounded-lg hover:bg-slate-200 text-[#1A1110] cursor-pointer"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="w-6 text-center text-xs font-black">{item.qty}</span>
                                <button
                                  type="button"
                                  onClick={() => updateCartQuantity(item.itemId, item.restaurantName, item.qty + 1)}
                                  className="p-1 rounded-lg hover:bg-slate-200 text-[#1A1110] cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => removeFromCart(item.itemId, item.restaurantName)}
                                className="p-2 text-[#C82346] hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                title={t('removeFromCart')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Subtotal & Action Buttons: [Order Now] [Schedule] */}
          {cart.length > 0 && (
            <div className="pt-4 border-t border-[#FFF5F6] space-y-3">
              <div className="flex items-center justify-between text-sm font-black">
                <span className="text-[#4A5568]">{t('cartTotal')}:</span>
                <span className="text-xl text-[#C82346]">₹{cartTotal}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleProceedToOrderNow}
                  className="py-3.5 bg-[#C82346] hover:bg-[#B31D3D] text-white font-black rounded-2xl shadow-xl flex items-center justify-center space-x-2 transition-transform active:scale-98 cursor-pointer text-xs sm:text-sm"
                >
                  <Zap className="w-4 h-4 text-white" />
                  <span>{t('orderNow')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleProceedToSchedule}
                  className="py-3.5 bg-[#FFF5F6] hover:bg-[#FCE7EB] text-[#1A1110] font-black rounded-2xl border border-[#FCE7EB] shadow-sm flex items-center justify-center space-x-2 transition-transform active:scale-98 cursor-pointer text-xs sm:text-sm"
                >
                  <Clock className="w-4 h-4 text-[#C82346]" />
                  <span>{t('scheduleCart')}</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Shared Schedule Checkout Modal */}
      {isScheduleCheckoutOpen && (
        <ScheduleCheckoutModal
          isOpen={isScheduleCheckoutOpen}
          onClose={() => setIsScheduleCheckoutOpen(false)}
          items={checkoutItems}
          initialSlotName="Cart Schedule"
          onSuccess={() => {
            setIsScheduleCheckoutOpen(false);
            onClose();
          }}
        />
      )}
    </>
  );
};
