import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShoppingBag,
  CheckCircle2,
  Clock,
  Calendar,
  Hourglass,
  FileText,
  Printer,
  RotateCcw,
  XCircle,
  Navigation,
  MapPin,
  Utensils,
  Sparkles,
  ArrowRight,
  Receipt,
  ChevronDown,
  ChevronUp,
  ShieldCheck
} from 'lucide-react';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { ExecutedOrder } from '../types';

type HistoryCategory = 'pending' | 'successful' | 'cancelled';

export const OrderHistoryModal: React.FC = () => {
  const {
    orderHistory = [],
    cancelOrder,
    reorderItem,
    setActiveView,
    orderHistoryTab,
    setOrderHistoryTab,
    t
  } = useApp();

  const [activeCategory, setActiveCategory] = useState<HistoryCategory>(() => {
    if (orderHistoryTab === 'successful') return 'successful';
    if (orderHistoryTab === 'cancelled') return 'cancelled';
    return 'pending';
  });

  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);

  // Helper to safely format currency amounts without throwing TypeError on null/undefined/NaN
  const formatCurrency = (val: any, decimals = 0): string => {
    if (val === null || val === undefined) {
      return decimals > 0 ? '₹0.00' : '₹0';
    }
    const n = Number(val);
    if (isNaN(n)) {
      return decimals > 0 ? '₹0.00' : '₹0';
    }
    return `₹${n.toFixed(decimals)}`;
  };

  // Safe savings calculator
  const getSavings = (ord: ExecutedOrder): number => {
    if (ord?.savings !== null && ord?.savings !== undefined && !isNaN(Number(ord.savings))) {
      return Number(ord.savings);
    }
    if (ord?.originalPrice && ord?.amountPaid && Number(ord.originalPrice) > Number(ord.amountPaid)) {
      return Number(ord.originalPrice) - Number(ord.amountPaid);
    }
    return 0;
  };

  // Safe date-time formatter
  const formatDateTime = (isoString?: string | null): string => {
    if (!isoString) return 'Date not available';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return String(isoString);
      return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} at ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return String(isoString || 'Date not available');
    }
  };

  // Helper to resolve food item image
  const getFoodImage = (foodName?: string, existingImage?: string): string => {
    if (existingImage) return existingImage;
    if (!foodName) return 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=60';
    const found = INDIAN_FOOD_CATALOG.find(
      f => f.name.toLowerCase() === foodName.toLowerCase() ||
           foodName.toLowerCase().includes(f.name.toLowerCase())
    );
    return found?.image || 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=60';
  };

  // Categorize orders accurately based on actual status
  const getNormalizedStatus = (ord: ExecutedOrder): HistoryCategory => {
    if (!ord) return 'pending';
    const s = String(ord.status || '').toLowerCase().trim();
    if (s === 'delivered' || s === 'completed' || s === 'successful' || s === 'success') {
      return 'successful';
    }
    if (s === 'cancelled' || s === 'canceled') {
      return 'cancelled';
    }
    if (s === 'scheduled') {
      return ord.completedAt ? 'successful' : 'pending';
    }
    // 'placed', 'pending', 'processing', 'preparing', 'on_the_way', etc.
    return 'pending';
  };

  const safeOrders = Array.isArray(orderHistory) ? orderHistory : [];
  const pendingOrders = safeOrders.filter(ord => getNormalizedStatus(ord) === 'pending');
  const successfulOrders = safeOrders.filter(ord => getNormalizedStatus(ord) === 'successful');
  const cancelledOrders = safeOrders.filter(ord => getNormalizedStatus(ord) === 'cancelled');

  const handleTabChange = (category: HistoryCategory) => {
    setActiveCategory(category);
    if (setOrderHistoryTab) {
      setOrderHistoryTab(category === 'pending' ? 'pending' : category === 'successful' ? 'instant' : 'all');
    }
  };

  const handleCancel = async (orderId: string) => {
    if (window.confirm('Are you sure you want to cancel this order?')) {
      setCancellingOrderId(orderId);
      await cancelOrder(orderId, 'Cancelled by customer via Order History');
      setCancellingOrderId(null);
    }
  };

  const handleTrack = () => {
    setActiveView('tracking');
  };

  const handleReorder = (order: ExecutedOrder) => {
    reorderItem(order);
  };

  const renderBillBreakdown = (ord: ExecutedOrder) => {
    const qty = ord.quantity && ord.quantity > 0 ? ord.quantity : 1;
    const amountPaid = typeof ord.amountPaid === 'number' && !isNaN(ord.amountPaid) ? ord.amountPaid : (Number(ord.amountPaid) || 0);
    const itemPrice = ord.itemPrice ?? (qty > 0 ? amountPaid / qty : amountPaid);
    const subtotal = ord.subtotal ?? (itemPrice * qty);
    const deliveryFee = ord.deliveryFee ?? 0;
    const platformFee = ord.platformFee ?? 0;
    const gst = ord.gst ?? 0;
    const grandTotal = ord.grandTotal ?? amountPaid;

    return (
      <div className="mt-3 p-3.5 rounded-2xl bg-[#F7F3EB] border border-[#E9DED5] space-y-1.5 text-xs text-[#302720] animate-fade-in">
        <div className="flex items-center justify-between text-[#786E64] font-bold">
          <span>Item Price</span>
          <span>{formatCurrency(itemPrice, 2)}</span>
        </div>
        <div className="flex items-center justify-between text-[#786E64] font-bold">
          <span>Subtotal ({qty} item{qty > 1 ? 's' : ''})</span>
          <span>{formatCurrency(subtotal, 2)}</span>
        </div>
        <div className="flex items-center justify-between text-[#786E64] font-bold">
          <span>Delivery Fee</span>
          <span>{deliveryFee > 0 ? formatCurrency(deliveryFee, 2) : 'FREE'}</span>
        </div>
        <div className="flex items-center justify-between text-[#786E64] font-bold">
          <span>Platform Fee</span>
          <span>{platformFee > 0 ? formatCurrency(platformFee, 2) : 'FREE'}</span>
        </div>
        <div className="flex items-center justify-between text-[#786E64] font-bold">
          <span>GST (5%)</span>
          <span>{gst > 0 ? formatCurrency(gst, 2) : 'Included'}</span>
        </div>
        <div className="pt-2 border-t border-[#E9DED5] flex items-center justify-between text-sm font-black text-[#302720]">
          <span className="text-[#D93636]">Grand Total:</span>
          <span className="font-mono text-[#33251F]">{formatCurrency(grandTotal, 2)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-6 sm:py-8 px-4 sm:px-6 space-y-6 animate-fade-in pb-16">
      
      {/* Page Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#F0E5DC] shadow-xs space-y-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-2xl bg-[#FBE9E5] text-[#D93636] flex items-center justify-center shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <h1 className="font-serif-editorial text-2xl sm:text-3xl font-bold text-[#33251F]">
                My Order History
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[#8A817A] mt-1 pl-12.5">
              View and manage all your food orders in one place.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setActiveView('search')}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#FBE9E5] hover:bg-[#FBE9E5]/80 text-[#D93636] border border-[#F0E5DC] transition-all cursor-pointer"
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Discover Food</span>
          </button>
        </div>

        {/* 3 CATEGORY TABS: Pending | Successful | Cancelled */}
        <div className="pt-4 border-t border-[#F0E5DC]/70">
          <div className="grid grid-cols-3 gap-2 bg-[#FBE9E5] p-1.5 rounded-2xl border border-[#F0E5DC]">
            
            {/* 1. Pending Tab */}
            <button
              type="button"
              onClick={() => handleTabChange('pending')}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                activeCategory === 'pending'
                  ? 'bg-amber-600 text-white shadow-xs font-black'
                  : 'text-[#33251F] hover:bg-white/60'
              }`}
            >
              <Hourglass className="w-4 h-4 shrink-0 text-amber-200" />
              <span>Pending ({pendingOrders.length})</span>
            </button>

            {/* 2. Successful Tab */}
            <button
              type="button"
              onClick={() => handleTabChange('successful')}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                activeCategory === 'successful'
                  ? 'bg-emerald-600 text-white shadow-xs font-black'
                  : 'text-[#33251F] hover:bg-white/60'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-200" />
              <span>Successful ({successfulOrders.length})</span>
            </button>

            {/* 3. Cancelled Tab */}
            <button
              type="button"
              onClick={() => handleTabChange('cancelled')}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                activeCategory === 'cancelled'
                  ? 'bg-[#D93636] text-white shadow-xs font-black'
                  : 'text-[#33251F] hover:bg-white/60'
              }`}
            >
              <XCircle className="w-4 h-4 shrink-0 text-rose-200" />
              <span>Cancelled ({cancelledOrders.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          CATEGORY 1: PENDING ORDERS
          ========================================================================= */}
      {activeCategory === 'pending' && (
        <div className="space-y-4">
          {pendingOrders.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 sm:p-14 text-center border border-[#F0E5DC] shadow-xs space-y-4">
              <div className="w-14 h-14 rounded-full bg-[#FBE9E5] text-[#D93636] flex items-center justify-center mx-auto">
                <Hourglass className="w-7 h-7 text-amber-600" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-lg text-[#33251F]">You have no pending orders.</h3>
                <p className="text-xs text-[#8A817A] max-w-sm mx-auto">
                  When you place an order, it will appear here with live tracking updates until it is delivered.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveView('search')}
                className="px-5 py-2.5 rounded-xl bg-[#D93636] hover:bg-[#C02B2B] text-white font-bold text-xs shadow-xs transition-all cursor-pointer inline-flex items-center space-x-2"
              >
                <span>Order Food Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            pendingOrders.map(ord => {
              const image = getFoodImage(ord.foodName, ord.foodImage);
              const isScheduled = ord.orderType === 'scheduled' || ord.isAutoOrder || ord.status === 'scheduled';
              const isReceiptOpen = expandedReceiptId === ord.id;
              return (
                <div
                  key={ord.id}
                  className="bg-white rounded-3xl p-5 sm:p-6 border border-[#F0E5DC] shadow-xs space-y-4 hover:border-amber-300 transition-all"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#F0E5DC]/60">
                    <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                      <span className="text-xs font-mono font-bold text-[#8A817A]">#{ord.id}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#FBE9E5] text-[#D93636] uppercase">
                        {ord.platformName || (ord.platform ? String(ord.platform).toUpperCase() : 'AutoFeast Direct')}
                      </span>
                      {isScheduled && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-purple-600" /> Auto-Scheduled
                        </span>
                      )}
                    </div>

                    {/* Status Badge: Orange / Amber */}
                    <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1.5 shrink-0">
                      <Hourglass className="w-3.5 h-3.5 animate-spin" />
                      <span>{isScheduled ? 'Scheduled (In Queue)' : 'Order Placed (In Progress)'}</span>
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    {/* Food Image */}
                    <img
                      src={image}
                      alt={ord.foodName || 'Food Item'}
                      className="w-20 h-20 rounded-2xl object-cover shrink-0 border border-[#F0E5DC]"
                    />

                    {/* Details */}
                    <div className="flex-1 space-y-1.5">
                      <h3 className="font-bold text-base sm:text-lg text-[#33251F]">
                        {ord.foodName || 'Food Item'}
                      </h3>
                      <p className="text-xs text-[#8A817A] flex items-center gap-1.5 flex-wrap">
                        <Utensils className="w-3.5 h-3.5 text-[#D93636]" />
                        <span>Restaurant: <strong className="text-[#33251F]">{ord.restaurant || 'AutoFeast Partner'}</strong></span>
                        <span className="text-[#8A817A]">•</span>
                        <span>Qty: <strong className="text-[#33251F]">{ord.quantity && ord.quantity > 0 ? ord.quantity : 1}</strong></span>
                      </p>

                      <p className="text-xs text-[#8A817A] flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#8A817A]" />
                        <span>Placed: <strong className="text-[#33251F]">{formatDateTime(ord.timestamp)}</strong></span>
                      </p>

                      {ord.deliveryAddress && (
                        <p className="text-xs text-[#8A817A] flex items-center gap-1.5 truncate">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">Deliver to: <strong className="text-[#33251F]">{ord.deliveryAddress}</strong></span>
                        </p>
                      )}

                      <p className="text-xs text-amber-700 font-semibold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Expected Delivery: <strong>{ord.expectedDeliveryTime || '25-30 minutes'}</strong></span>
                      </p>

                      <button
                        type="button"
                        onClick={() => setExpandedReceiptId(isReceiptOpen ? null : ord.id)}
                        className="text-xs font-bold text-[#8A817A] hover:text-[#D93636] flex items-center gap-1 transition-colors cursor-pointer pt-1"
                      >
                        <Receipt className="w-3.5 h-3.5 text-[#D93636]" />
                        <span>{isReceiptOpen ? 'Hide Bill Breakdown' : 'View Bill Breakdown'}</span>
                        {isReceiptOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>

                      {isReceiptOpen && renderBillBreakdown(ord)}
                    </div>

                    {/* Total & Action Buttons */}
                    <div className="sm:text-right w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F0E5DC] flex sm:flex-col justify-between items-end gap-3">
                      <div>
                        <span className="text-lg sm:text-xl font-bold text-[#33251F] block">
                          {formatCurrency(ord.amountPaid, 0)}
                        </span>
                        {getSavings(ord) > 0 && (
                          <span className="text-[10px] font-bold text-emerald-600 block">
                            Saved {formatCurrency(getSavings(ord), 0)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Track Button */}
                        <button
                          type="button"
                          onClick={handleTrack}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Track Order</span>
                        </button>

                        {/* Cancel Button */}
                        <button
                          type="button"
                          disabled={cancellingOrderId === ord.id}
                          onClick={() => handleCancel(ord.id)}
                          className="px-3 py-1.5 rounded-xl bg-[#FBE9E5] hover:bg-rose-100 text-[#D93636] font-bold text-xs border border-[#F0E5DC] transition-all cursor-pointer disabled:opacity-50"
                        >
                          <span>{cancellingOrderId === ord.id ? 'Cancelling...' : 'Cancel'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* =========================================================================
          CATEGORY 2: SUCCESSFUL ORDERS
          ========================================================================= */}
      {activeCategory === 'successful' && (
        <div className="space-y-4">
          {successfulOrders.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 sm:p-14 text-center border border-[#F0E5DC] shadow-xs space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-lg text-[#33251F]">Your completed orders will appear here.</h3>
                <p className="text-xs text-[#8A817A] max-w-sm mx-auto">
                  Once your food has been delivered, you can find the complete receipt and one-click reorder options here.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveView('search')}
                className="px-5 py-2.5 rounded-xl bg-[#D93636] hover:bg-[#C02B2B] text-white font-bold text-xs shadow-xs transition-all cursor-pointer inline-flex items-center space-x-2"
              >
                <span>Explore Menu</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            successfulOrders.map(ord => {
              const image = getFoodImage(ord.foodName, ord.foodImage);
              const isReceiptOpen = expandedReceiptId === ord.id;
              return (
                <div
                  key={ord.id}
                  className="bg-white rounded-3xl p-5 sm:p-6 border border-[#F0E5DC] shadow-xs space-y-4 hover:border-emerald-300 transition-all"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#F0E5DC]/60">
                    <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                      <span className="text-xs font-mono font-bold text-[#8A817A]">#{ord.id}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#FBE9E5] text-[#D93636] uppercase">
                        {ord.platformName || (ord.platform ? String(ord.platform).toUpperCase() : 'AutoFeast Direct')}
                      </span>
                    </div>

                    {/* Status Badge: Green */}
                    <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Delivered Successfully</span>
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    {/* Food Image */}
                    <img
                      src={image}
                      alt={ord.foodName || 'Food Item'}
                      className="w-20 h-20 rounded-2xl object-cover shrink-0 border border-[#F0E5DC]"
                    />

                    {/* Details */}
                    <div className="flex-1 space-y-1.5">
                      <h3 className="font-bold text-base sm:text-lg text-[#33251F]">
                        {ord.foodName || 'Food Item'}
                      </h3>
                      <p className="text-xs text-[#8A817A] flex items-center gap-1.5 flex-wrap">
                        <Utensils className="w-3.5 h-3.5 text-[#D93636]" />
                        <span>Restaurant: <strong className="text-[#33251F]">{ord.restaurant || 'AutoFeast Partner'}</strong></span>
                        <span className="text-[#8A817A]">•</span>
                        <span>Qty: <strong className="text-[#33251F]">{ord.quantity && ord.quantity > 0 ? ord.quantity : 1}</strong></span>
                      </p>

                      <p className="text-xs text-[#8A817A] flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#8A817A]" />
                        <span>Ordered: <strong className="text-[#33251F]">{formatDateTime(ord.timestamp)}</strong></span>
                      </p>

                      <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Delivered at: <strong>{formatDateTime(ord.completedAt || ord.timestamp)}</strong></span>
                      </p>

                      <p className="text-xs text-emerald-800 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Payment Status: <strong className="text-[#33251F]">Paid via Wallet (Auto-Debited)</strong></span>
                      </p>

                      {ord.deliveryAddress && (
                        <p className="text-xs text-[#8A817A] flex items-center gap-1.5 truncate">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">Delivered to: <strong className="text-[#33251F]">{ord.deliveryAddress}</strong></span>
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedReceiptId(isReceiptOpen ? null : ord.id)}
                        className="text-xs font-bold text-[#8A817A] hover:text-[#D93636] flex items-center gap-1 transition-colors cursor-pointer pt-1"
                      >
                        <Receipt className="w-3.5 h-3.5 text-[#D93636]" />
                        <span>{isReceiptOpen ? 'Hide Bill Breakdown' : 'View Bill Breakdown'}</span>
                        {isReceiptOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>

                      {isReceiptOpen && renderBillBreakdown(ord)}
                    </div>

                    {/* Total & Reorder Button */}
                    <div className="sm:text-right w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F0E5DC] flex sm:flex-col justify-between items-end gap-3">
                      <div>
                        <span className="text-lg sm:text-xl font-bold text-[#33251F] block">
                          {formatCurrency(ord.amountPaid, 0)}
                        </span>
                        {getSavings(ord) > 0 && (
                          <span className="text-[10px] font-bold text-emerald-600 block">
                            Saved {formatCurrency(getSavings(ord), 0)}
                          </span>
                        )}
                      </div>

                      {/* Reorder Button */}
                      <button
                        type="button"
                        onClick={() => handleReorder(ord)}
                        className="px-4 py-2 rounded-xl bg-[#D93636] hover:bg-[#C02B2B] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reorder</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* =========================================================================
          CATEGORY 3: CANCELLED ORDERS
          ========================================================================= */}
      {activeCategory === 'cancelled' && (
        <div className="space-y-4">
          {cancelledOrders.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 sm:p-14 text-center border border-[#F0E5DC] shadow-xs space-y-4">
              <div className="w-14 h-14 rounded-full bg-rose-50 text-[#D93636] flex items-center justify-center mx-auto">
                <XCircle className="w-7 h-7 text-[#D93636]" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-lg text-[#33251F]">You have no cancelled orders.</h3>
                <p className="text-xs text-[#8A817A] max-w-sm mx-auto">
                  Any orders cancelled by you or refunded will be recorded here with cancellation details.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveView('search')}
                className="px-5 py-2.5 rounded-xl bg-[#D93636] hover:bg-[#C02B2B] text-white font-bold text-xs shadow-xs transition-all cursor-pointer inline-flex items-center space-x-2"
              >
                <span>Explore Menu</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            cancelledOrders.map(ord => {
              const image = getFoodImage(ord.foodName, ord.foodImage);
              const isReceiptOpen = expandedReceiptId === ord.id;
              return (
                <div
                  key={ord.id}
                  className="bg-white rounded-3xl p-5 sm:p-6 border border-[#F0E5DC] shadow-xs space-y-4 hover:border-rose-300 transition-all opacity-90"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#F0E5DC]/60">
                    <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                      <span className="text-xs font-mono font-bold text-[#8A817A]">#{ord.id}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#FBE9E5] text-[#D93636] uppercase">
                        {ord.platformName || (ord.platform ? String(ord.platform).toUpperCase() : 'AutoFeast Direct')}
                      </span>
                    </div>

                    {/* Status Badge: Muted Red */}
                    <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1.5 shrink-0">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancelled & Refunded</span>
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    {/* Food Image */}
                    <img
                      src={image}
                      alt={ord.foodName || 'Food Item'}
                      className="w-20 h-20 rounded-2xl object-cover shrink-0 border border-[#F0E5DC] grayscale-30"
                    />

                    {/* Details */}
                    <div className="flex-1 space-y-1.5">
                      <h3 className="font-bold text-base sm:text-lg text-[#33251F]">
                        {ord.foodName || 'Food Item'}
                      </h3>
                      <p className="text-xs text-[#8A817A] flex items-center gap-1.5 flex-wrap">
                        <Utensils className="w-3.5 h-3.5 text-[#D93636]" />
                        <span>Restaurant: <strong className="text-[#33251F]">{ord.restaurant || 'AutoFeast Partner'}</strong></span>
                        <span className="text-[#8A817A]">•</span>
                        <span>Qty: <strong className="text-[#33251F]">{ord.quantity && ord.quantity > 0 ? ord.quantity : 1}</strong></span>
                      </p>

                      <p className="text-xs text-[#8A817A] flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#8A817A]" />
                        <span>Original Order: <strong className="text-[#33251F]">{formatDateTime(ord.timestamp)}</strong></span>
                      </p>

                      <p className="text-xs text-rose-700 flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Cancelled on: <strong className="text-[#33251F]">{formatDateTime(ord.cancelledAt || ord.timestamp)}</strong></span>
                      </p>

                      <p className="text-xs text-[#8A817A] bg-[#FBE9E5]/60 p-2 rounded-xl border border-[#F0E5DC] inline-block">
                        Reason: <strong className="text-[#33251F]">{ord.cancellationReason || 'Cancelled by customer'}</strong>
                      </p>

                      <div>
                        <button
                          type="button"
                          onClick={() => setExpandedReceiptId(isReceiptOpen ? null : ord.id)}
                          className="text-xs font-bold text-[#8A817A] hover:text-[#D93636] flex items-center gap-1 transition-colors cursor-pointer pt-1"
                        >
                          <Receipt className="w-3.5 h-3.5 text-[#D93636]" />
                          <span>{isReceiptOpen ? 'Hide Bill Breakdown' : 'View Bill Breakdown'}</span>
                          {isReceiptOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        {isReceiptOpen && renderBillBreakdown(ord)}
                      </div>
                    </div>

                    {/* Amount & Reorder */}
                    <div className="sm:text-right w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F0E5DC] flex sm:flex-col justify-between items-end gap-3">
                      <div>
                        <span className="text-lg sm:text-xl font-bold text-[#8A817A] line-through block">
                          {formatCurrency(ord.amountPaid, 0)}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-600 block">
                          Amount Credited to Wallet
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleReorder(ord)}
                        className="px-4 py-2 rounded-xl bg-[#D93636] hover:bg-[#C02B2B] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reorder Item</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

    </div>
  );
};
