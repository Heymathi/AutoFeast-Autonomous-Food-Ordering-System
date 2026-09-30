import React from 'react';
import { useApp } from '../context/AppContext';
import { ShoppingBag, CheckCircle, Sparkles, Tag, Zap, Clock, Calendar, Hourglass, PlayCircle, FileText, Printer, ArrowDownToLine } from 'lucide-react';

export const OrderHistoryModal: React.FC = () => {
  const {
    orderHistory,
    schedules,
    executeScheduleNow,
    orderHistoryTab,
    setOrderHistoryTab,
    t,
    language,
    showToast
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

  // Monthly Bill Calculations
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const currentMonthOrders = orderHistory.filter(ord => {
    const d = new Date(ord.timestamp);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalMonthSpent = currentMonthOrders.reduce((sum, ord) => sum + ord.amountPaid, 0);
  const totalMonthSaved = currentMonthOrders.reduce((sum, ord) => sum + (ord.savings || 0), 0);

  const handlePrintReceipt = () => {
    const printMsg = language === 'ta'
      ? 'மாத பில் அறிக்கை அச்சிட தயாரிக்கப்படுகிறது...'
      : language === 'hi'
      ? 'मासिक रसीद प्रिंट की जा रही है...'
      : 'Preparing monthly bill receipt for print/download...';
    showToast(printMsg);
    window.print();
  };

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
              {t('orders.headerSubtitle')}
            </p>
          </div>

          <span className="text-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black px-3.5 py-1.5 rounded-full border border-emerald-300">
            {t('orders.autoDebited')}
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
            <span>{t('orders.tabInstant')} ({instantOrders.length})</span>
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
            <span>{t('orders.tabPending')} ({pendingSchedules.length})</span>
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
            <span>{t('orders.tabExecuted')} ({scheduledExecutedOrders.length})</span>
          </button>

          {/* Monthly Bill Summary Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('monthly_bill')}
            className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              activeTab === 'monthly_bill'
                ? 'bg-blue-600 text-white shadow-md scale-102'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <FileText className="w-4 h-4 text-sky-200" />
            <span>{t('orders.tabMonthlyBill')}</span>
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
            <span>{t('orders.tabAll')} ({orderHistory.length})</span>
          </button>

        </div>

        {/* PENDING ORDERS TAB CONTENT */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            {pendingSchedules.length === 0 ? (
              <div className="p-10 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 font-bold text-sm">
                {t('orders.noPending')}
              </div>
            ) : (
              <div className="space-y-4">
                {pendingSchedules.map(sched => {
                  const strategyKey = `strategy.${sched.strategy}`;
                  const simpleStrategy = t(strategyKey) !== strategyKey ? t(strategyKey) : sched.strategy;
                  return (
                    <div
                      key={sched.id}
                      className="p-5 rounded-2xl border-2 border-amber-400/60 bg-amber-500/5 dark:bg-amber-950/20 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <span className="text-xs font-bold text-slate-400 font-mono">#{sched.id}</span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 flex items-center gap-1 border border-amber-300 animate-pulse">
                            <Hourglass className="w-3 h-3 text-amber-600 dark:text-amber-400" /> {t('orders.pendingDelivery')}
                          </span>
                        </div>

                        <h4 className="text-lg font-black text-slate-900 dark:text-white">
                          {sched.foodItemName} (x{sched.quantity})
                        </h4>

                        <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-2">
                          <span>{t('orders.slot')} <strong className="text-orange-600 dark:text-orange-400">{sched.slotName}</strong></span>
                          <span>•</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-amber-600" /> {t('orders.time')} <strong className="text-slate-900 dark:text-white">{sched.time}</strong></span>
                        </p>
                      </div>

                      <div className="flex items-center space-x-4 text-right w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-amber-200 dark:border-slate-700 pt-3 sm:pt-0">
                        <div>
                          <span className="text-xs text-slate-500 font-bold block">{t('orders.autoDebitsWallet')}</span>
                          <span className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase">
                            {simpleStrategy}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => executeScheduleNow(sched.id)}
                          className="py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-md flex items-center space-x-1.5 cursor-pointer transform active:scale-95"
                          title="Execute order right now"
                        >
                          <PlayCircle className="w-4 h-4 text-yellow-300" />
                          <span>{t('orders.triggerNow')}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* MONTHLY BILL SUMMARY TAB */}
        {activeTab === 'monthly_bill' && (
          <div className="space-y-6">
            <div className="p-6 bg-slate-900 text-white rounded-3xl border-2 border-blue-500/40 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-700 pb-4">
                <div>
                  <h3 className="text-xl font-black text-white flex items-center gap-2">
                    <FileText className="w-6 h-6 text-blue-400" />
                    {t('bill.summaryTitle')}
                  </h3>
                  <p className="text-xs text-slate-400 font-bold mt-1">
                    {t('bill.summarySubtitle')} ({now.toLocaleString('default', { month: 'long', year: 'numeric' })})
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md flex items-center space-x-2 cursor-pointer transition-all active:scale-95"
                >
                  <Printer className="w-4 h-4 text-white" />
                  <span>{t('bill.printReceipt')}</span>
                </button>
              </div>

              {/* Monthly Stats Summary Boxes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700 text-center">
                  <span className="text-xs font-extrabold text-slate-400 block">{t('bill.totalSpent')}</span>
                  <span className="text-2xl font-black text-emerald-400 mt-1 block">₹{totalMonthSpent.toFixed(2)}</span>
                </div>

                <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700 text-center">
                  <span className="text-xs font-extrabold text-slate-400 block">{t('bill.totalSaved')}</span>
                  <span className="text-2xl font-black text-amber-400 mt-1 block">₹{totalMonthSaved.toFixed(2)}</span>
                </div>

                <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700 text-center">
                  <span className="text-xs font-extrabold text-slate-400 block">{t('bill.totalOrders')}</span>
                  <span className="text-2xl font-black text-blue-400 mt-1 block">{currentMonthOrders.length}</span>
                </div>
              </div>
            </div>

            {/* Itemized Receipt Table */}
            {currentMonthOrders.length === 0 ? (
              <div className="p-10 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 font-bold text-sm">
                {t('bill.noOrdersMonth')}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-md">
                <div className="p-4 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 font-black text-xs text-slate-700 dark:text-slate-300 flex justify-between items-center">
                  <span>ITEM & RESTAURANT</span>
                  <span>AMOUNT PAID</span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {currentMonthOrders.map(ord => (
                    <div key={ord.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-black text-slate-900 dark:text-white">{ord.foodName}</span>
                          <span className="text-[10px] font-extrabold bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 px-2 py-0.5 rounded-full uppercase">
                            {ord.platformName}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-semibold">
                          {t('orders.restaurantLabel')} <strong className="text-slate-700 dark:text-slate-300">{ord.restaurant}</strong> • {new Date(ord.timestamp).toLocaleDateString()} {new Date(ord.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-base font-black text-slate-900 dark:text-white block">₹{ord.amountPaid.toFixed(2)}</span>
                        {ord.savings > 0 && (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            {t('orders.savedLabel')} ₹{ord.savings.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* EXECUTED ORDER HISTORY CONTENT (INSTANT / SCHEDULED / ALL) */}
        {activeTab !== 'pending' && activeTab !== 'monthly_bill' && (
          <div>
            {displayedHistoryOrders.length === 0 ? (
              <div className="p-10 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 font-bold text-sm">
                {activeTab === 'instant'
                  ? t('orders.noInstant')
                  : activeTab === 'scheduled'
                  ? t('orders.noExecuted')
                  : t('orders.noOrdersYet')}
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
                              <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-300" /> {t('orders.autoScheduledBadge')}
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1 border border-emerald-300">
                              <Zap className="w-3 h-3 text-emerald-600 dark:text-emerald-300" /> {t('orders.instantGpsBadge')}
                            </span>
                          )}
                        </div>

                        <h4 className="text-lg font-black text-slate-900 dark:text-white">
                          {ord.foodName}
                        </h4>

                        <p className="text-xs text-slate-500 font-semibold">
                          {t('orders.restaurantLabel')} <span className="font-extrabold text-slate-700 dark:text-slate-300">{ord.restaurant}</span> • {new Date(ord.timestamp).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center space-x-6 text-right w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-slate-200 dark:border-slate-700 pt-3 sm:pt-0">
                        <div>
                          <span className="text-lg font-black text-slate-900 dark:text-white block">
                            ₹{ord.amountPaid.toFixed(2)}
                          </span>
                          {ord.savings > 0 && (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 justify-end">
                              <Tag className="w-3 h-3" /> {t('orders.savedLabel')} ₹{ord.savings.toFixed(2)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 text-xs font-black bg-emerald-50 dark:bg-emerald-950 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle className="w-4 h-4" />
                          <span>{t('orders.deliveredBadge')}</span>
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
