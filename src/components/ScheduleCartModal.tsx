import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ShoppingBag, Trash2, Plus, Minus, X, AlertTriangle, ArrowRight, Utensils, CheckCircle2 } from 'lucide-react';
import { ScheduleCheckoutModal, ScheduleCheckoutItem } from './ScheduleCheckoutModal';

export interface ScheduleCartModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ScheduleCartModal: React.FC<ScheduleCartModalProps> = ({ isOpen, onClose }) => {
  const {
    scheduleCart,
    removeFromScheduleCart,
    updateScheduleCartQuantity,
    clearScheduleCart,
    t,
    language,
    showToast
  } = useApp();

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  if (!isOpen) return null;

  // Group items by restaurant
  const groupedItems: Record<string, typeof scheduleCart> = {};
  scheduleCart.forEach(item => {
    const restaurant = item.foodItem.restaurant || 'Hotel Saravana Bhavan';
    if (!groupedItems[restaurant]) {
      groupedItems[restaurant] = [];
    }
    groupedItems[restaurant].push(item);
  });

  const cartTotal = scheduleCart.reduce(
    (sum, item) => sum + (item.foodItem.basePrice || 100) * item.quantity,
    0
  );

  const checkoutItems: ScheduleCheckoutItem[] = scheduleCart.map(item => ({
    foodItem: item.foodItem,
    quantity: item.quantity
  }));

  const handleClearCart = () => {
    clearScheduleCart();
    setShowClearConfirm(false);
    showToast(t('cartEmpty'), 'info');
  };

  const handleProceedToCheckout = () => {
    if (scheduleCart.length === 0) return;
    setIsCheckoutOpen(true);
  };

  return (
    <>
      <div className="fixed inset-0 z-[9980] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
        <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border-2 border-[#FF5A1F] relative max-h-[90vh] flex flex-col text-[#1A1110]">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[#DAF0F7]">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-[#FF5A1F]/10 text-[#FF5A1F] rounded-2xl">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-[#1A1110] flex items-center gap-2">
                  {t('myCart')}
                  {scheduleCart.length > 0 && (
                    <span className="text-xs bg-[#FF5A1F] text-white px-2.5 py-0.5 rounded-full font-black">
                      {scheduleCart.length}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-[#4A5568] font-bold">
                  {scheduleCart.length === 1 ? '1 item in cart' : `${scheduleCart.length} items in cart`}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {scheduleCart.length > 0 && (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-[#C2185B] rounded-xl text-xs font-black border border-rose-200 transition-colors cursor-pointer flex items-center space-x-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('clearCart')}</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-[#4A5568] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Confirm Clear Modal Overlay */}
          {showClearConfirm && (
            <div className="p-4 my-3 bg-rose-50 border-2 border-[#C2185B] rounded-2xl text-center space-y-3 animate-fade-in">
              <p className="text-xs font-black text-[#C2185B]">
                ⚠️ Are you sure you want to clear all items from your schedule cart?
              </p>
              <div className="flex justify-center space-x-3">
                <button
                  onClick={handleClearCart}
                  className="px-4 py-2 bg-[#C2185B] hover:bg-[#A3134C] text-white font-black text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Yes, Clear Cart
                </button>
                <button
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
            {scheduleCart.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <div className="w-16 h-16 bg-[#DAF0F7] text-[#FF5A1F] rounded-full flex items-center justify-center mx-auto">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h4 className="text-lg font-black text-[#1A1110]">{t('cartEmpty')}</h4>
                <p className="text-xs text-[#4A5568] font-bold max-w-xs mx-auto">
                  Add items from Food Search, Healthy Food, or Auto Scheduler to build your cart!
                </p>
              </div>
            ) : (
              Object.entries(groupedItems).map(([restaurant, items]) => (
                <div key={restaurant} className="bg-slate-50 p-4 rounded-2xl border border-[#DAF0F7] space-y-3">
                  <div className="flex items-center space-x-2 border-b border-[#B2E2F0] pb-2">
                    <Utensils className="w-4 h-4 text-[#FF5A1F]" />
                    <h4 className="text-xs font-black text-[#1A1110] uppercase tracking-wider">{restaurant}</h4>
                  </div>

                  <div className="space-y-2">
                    {items.map(item => (
                      <div
                        key={item.foodItem.id}
                        className="bg-white p-3 rounded-xl border border-[#B2E2F0] flex items-center justify-between shadow-xs"
                      >
                        <div className="flex items-center space-x-3">
                          <img
                            src={item.foodItem.image}
                            alt={item.foodItem.name}
                            className="w-12 h-12 rounded-xl object-cover"
                          />
                          <div>
                            <h5 className="text-xs font-black text-[#1A1110]">
                              {item.foodItem.nativeNames?.[language] || item.foodItem.name}
                            </h5>
                            <span className="text-xs font-bold text-[#FF5A1F]">
                              ₹{item.foodItem.basePrice} each
                            </span>
                          </div>
                        </div>

                        {/* Qty Controls & Trash Button */}
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                            <button
                              type="button"
                              onClick={() => updateScheduleCartQuantity(item.foodItem.id, Math.max(1, item.quantity - 1))}
                              className="p-1 rounded-lg hover:bg-slate-200 text-[#1A1110] cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-6 text-center text-xs font-black">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateScheduleCartQuantity(item.foodItem.id, item.quantity + 1)}
                              className="p-1 rounded-lg hover:bg-slate-200 text-[#1A1110] cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeFromScheduleCart(item.foodItem.id)}
                            className="p-2 text-[#C2185B] hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            title={t('removeFromCart')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Subtotal & Proceed Button */}
          {scheduleCart.length > 0 && (
            <div className="pt-4 border-t border-[#DAF0F7] space-y-3">
              <div className="flex items-center justify-between text-sm font-black">
                <span className="text-[#4A5568]">Cart Subtotal:</span>
                <span className="text-lg text-[#FF5A1F]">₹{cartTotal}</span>
              </div>

              <button
                onClick={handleProceedToCheckout}
                className="w-full py-4 bg-[#FF5A1F] hover:bg-[#E04812] text-white font-black rounded-2xl shadow-xl flex items-center justify-center space-x-2 transition-transform active:scale-98 cursor-pointer text-sm"
              >
                <span>Proceed to Schedule Checkout ({scheduleCart.length} Items)</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Shared Schedule Checkout Modal */}
      {isCheckoutOpen && (
        <ScheduleCheckoutModal
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          items={checkoutItems}
          initialSlotName="Cart Schedule"
          onSuccess={() => {
            setIsCheckoutOpen(false);
            onClose();
          }}
        />
      )}
    </>
  );
};
