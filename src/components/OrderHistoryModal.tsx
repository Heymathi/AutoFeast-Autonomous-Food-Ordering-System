import React from 'react';
import { useApp } from '../context/AppContext';
import { ShoppingBag, CheckCircle, Sparkles, Tag, Zap, Clock, Calendar, Hourglass, PlayCircle } from 'lucide-react';

export const OrderHistoryModal: React.FC = () => {
  const {
    orderHistory,
    schedules,
    executeScheduleNow,
    orderHistoryTab,
    setOrderHistoryTab,
    t,
    language
  } = useApp();

  const instantOrders = orderHistory.filter(ord => ord.orderType === 'instant' || (!ord.orderType && !ord.isAutoOrder));
  const scheduledExecutedOrders = orderHistory.filter(ord => ord.orderType === 'scheduled' || (!ord.orderType && ord.isAutoOrder));
  const pendingSchedules = schedules.filter(s => s.isEnabled);

  const activeTab = orderHistoryTab;
  const setActiveTab = setOrderHistoryTab;

  const displayedHistoryOrders = activeTab === 'instant'
    ? instantOrders
    : activeTab === 'scheduled'
    ? scheduledExecutedOrders
    : orderHistory;

  return (
    <div className="space-y-6">
      
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingBag className="w-7 h-7 text-orange-600" />
              {t('nav.orders')} ({orderHistory.length + pendingSchedules.length})
            </h2>
            <p className="text-xs text-slate-500 font-bold mt-1">
              Track Instant GPS Orders, Active Pending Scheduled Orders & Completed History
            </p>
          </div>

          <span className="text-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black px-3.5 py-1.5 rounded-full border border-emerald-300">
            ✓ Auto-Debited via Wallet
          </span>
        </div>

        {/* ORDER TYPE TABS NAVIGATION */}
        <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
          
          {/* Instant Orders Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('instant')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              activeTab === 'instant'
                ? 'bg-emerald-600 text-white shadow-md scale-102'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Zap className="w-4 h-4 text-yellow-300" />
            <span>Instant ({instantOrders.length})</span>
          </button>

          {/* Pending Orders Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              activeTab === 'pending'
                ? 'bg-amber-600 text-white shadow-md scale-102 animate-pulse'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Hourglass className="w-4 h-4 text-yellow-300" />
            <span>Pending ({pendingSchedules.length})</span>
          </button>

          {/* Scheduled Executed Orders Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('scheduled')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              activeTab === 'scheduled'
                ? 'bg-purple-600 text-white shadow-md scale-102'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Clock className="w-4 h-4 text-white" />
            <span>Executed ({scheduledExecutedOrders.length})</span>
          </button>

          {/* All Orders Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              activeTab === 'all'
                ? 'bg-orange-600 text-white shadow-md scale-102'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>All ({orderHistory.length})</span>
          </button>

        </div>

        {/* PENDING ORDERS TAB CONTENT */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            {pendingSchedules.length === 0 ? (
              <div className="p-10 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 font-bold text-sm">
                No active pending scheduled orders. Create a schedule in Auto-Order Scheduler or via Voice Assistant!
              </div>
            ) : (
              <div className="space-y-4">
                {pendingSchedules.map(sched => (
                  <div
                    key={sched.id}
                    className="p-5 rounded-2xl border-2 border-amber-400/60 bg-amber-500/5 dark:bg-amber-950/20 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="text-xs font-bold text-slate-400 font-mono">#{sched.id}</span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 flex items-center gap-1 border border-amber-300 animate-pulse">
                          <Hourglass className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Scheduled — Pending Delivery
                        </span>
                      </div>

                      <h4 className="text-lg font-black text-slate-900 dark:text-white">
                        {sched.foodItemName} (x{sched.quantity})
                      </h4>

                      <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-2">
                        <span>Slot: <strong className="text-orange-600 dark:text-orange-400">{sched.slotName}</strong></span>
                        <span>•</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-amber-600" /> Time: <strong className="text-slate-900 dark:text-white">{sched.time}</strong></span>
                      </p>
                    </div>

                    <div className="flex items-center space-x-4 text-right w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-amber-200 dark:border-slate-700 pt-3 sm:pt-0">
                      <div>
                        <span className="text-xs text-slate-500 font-bold block">Auto-Debits Wallet</span>
                        <span className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase">
                          Strategy: {sched.strategy}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => executeScheduleNow(sched.id)}
                        className="py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-md flex items-center space-x-1.5 cursor-pointer transform active:scale-95"
                        title="Execute order right now"
                      >
                        <PlayCircle className="w-4 h-4 text-yellow-300" />
                        <span>Trigger Now</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* EXECUTED ORDER HISTORY CONTENT (INSTANT / SCHEDULED / ALL) */}
        {activeTab !== 'pending' && (
          <div>
            {displayedHistoryOrders.length === 0 ? (
              <div className="p-10 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 font-bold text-sm">
                {activeTab === 'instant'
                  ? 'No instant orders placed yet. Place an instant order from Food Search!'
                  : activeTab === 'scheduled'
                  ? 'No auto-scheduled orders executed yet. Configure a slot in Auto-Order Scheduler!'
                  : 'No executed orders yet.'}
              </div>
            ) : (
              <div className="space-y-4">
                {displayedHistoryOrders.map(ord => {
                  const isScheduled = ord.orderType === 'scheduled' || (!ord.orderType && ord.isAutoOrder);
                  return (
                    <div
                      key={ord.id}
                      className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <span className="text-xs font-bold text-slate-400 font-mono">#{ord.id}</span>
                          
                          {/* Platform Tag */}
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 uppercase">
                            {ord.platformName}
                          </span>

                          {/* Order Type Badge */}
                          {isScheduled ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300 flex items-center gap-1 border border-purple-300">
                              <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-300" /> Auto Scheduled
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1 border border-emerald-300">
                              <Zap className="w-3 h-3 text-emerald-600 dark:text-emerald-300" /> Instant Order (GPS)
                            </span>
                          )}
                        </div>

                        <h4 className="text-lg font-black text-slate-900 dark:text-white">
                          {ord.foodName}
                        </h4>

                        <p className="text-xs text-slate-500 font-semibold">
                          Restaurant: <span className="font-extrabold text-slate-700 dark:text-slate-300">{ord.restaurant}</span> • {new Date(ord.timestamp).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center space-x-6 text-right w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-slate-200 dark:border-slate-700 pt-3 sm:pt-0">
                        <div>
                          <span className="text-lg font-black text-slate-900 dark:text-white block">
                            ₹{ord.amountPaid.toFixed(2)}
                          </span>
                          {ord.savings > 0 && (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 justify-end">
                              <Tag className="w-3 h-3" /> Saved ₹{ord.savings.toFixed(2)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 text-xs font-black bg-emerald-50 dark:bg-emerald-950 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle className="w-4 h-4" />
                          <span>Delivered</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
