import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Wallet, Plus, CreditCard, ArrowDownRight, ArrowUpRight, ShieldCheck, History, AlertTriangle, Building2, CheckCircle2, RefreshCw } from 'lucide-react';

export const WalletModal: React.FC = () => {
  const { walletBalance, walletTransactions, rechargeWallet, t, accessibilitySettings, linkedBank, setLinkedBank, showToast } = useApp();
  const [customAmount, setCustomAmount] = useState('500');

  const presetAmounts = [100, 500, 1000, 2000];

  const availableBanks = [
    { name: 'HDFC Bank', acc: '**** **** 4821', ifsc: 'HDFC0001234', upi: 'karthik@hdfcbank' },
    { name: 'State Bank of India', acc: '**** **** 8932', ifsc: 'SBIN0004567', upi: 'karthik@sbi' },
    { name: 'ICICI Bank', acc: '**** **** 1209', ifsc: 'ICIC0008899', upi: 'karthik@icici' },
    { name: 'Axis Bank', acc: '**** **** 6754', ifsc: 'UTIB0002233', upi: 'karthik@axis' },
    { name: 'Google Pay (UPI)', acc: 'UPI Direct', ifsc: 'GPI000000', upi: 'karthik@okaxis' }
  ];

  const handleBankSwitch = (bank: typeof availableBanks[0]) => {
    setLinkedBank(prev => ({
      ...prev,
      bankName: bank.name,
      accountNumber: bank.acc,
      ifscCode: bank.ifsc,
      upiId: bank.upi
    }));
    showToast(`Linked Bank updated to ${bank.name} (${bank.acc})!`);
  };

  const handleRechargeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(customAmount);
    if (!isNaN(amount) && amount > 0) {
      rechargeWallet(amount);
    }
  };

  return (
    <div className="space-y-8">
      
      {/* Wallet Balance & Linked Bank Hero Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Wallet Balance Card (Light Blue Base #DAF0F7) */}
        <div className={`p-8 rounded-3xl shadow-lg transition-all flex flex-col justify-between ${
          accessibilitySettings.highContrast
            ? 'bg-black text-white border-4 border-yellow-400'
            : 'bg-[#DAF0F7] text-[#1A1110] border-2 border-[#B2E2F0]'
        }`}>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Wallet className="w-8 h-8 text-[#FF5A1F]" />
              <h2 className="text-xl font-black uppercase tracking-wider text-[#1A1110]">{t('wallet.balance')}</h2>
            </div>
            <div className="text-4xl sm:text-5xl font-black text-[#FF5A1F]">
              ₹{walletBalance.toFixed(2)}
            </div>
            <p className="text-xs text-[#4A5568] flex items-center gap-1 font-semibold">
              <ShieldCheck className="w-4 h-4 text-[#16A34A] inline" />
              Pre-recharged digital wallet active for automated food ordering
            </p>
          </div>

          {/* Quick Recharge Preset Buttons */}
          <div className="mt-6 bg-white p-4 rounded-2xl border border-[#B2E2F0] space-y-2 shadow-sm">
            <span className="text-xs font-black uppercase tracking-wider block text-[#1A1110]">{t('wallet.quickRecharge')}</span>
            <div className="grid grid-cols-4 gap-2">
              {presetAmounts.map(amt => (
                <button
                  key={amt}
                  onClick={() => rechargeWallet(amt)}
                  className="px-3 py-2 bg-[#FF5A1F] text-white hover:bg-[#E04812] font-black rounded-xl text-xs shadow-md transition-transform active:scale-95 cursor-pointer"
                >
                  +₹{amt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 🏦 LINKED BANK ACCOUNT CARD (Pure White Surface) */}
        <div className="bg-white text-[#1A1110] p-8 rounded-3xl shadow-lg border-2 border-[#DAF0F7] flex flex-col justify-between space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 text-9xl">🏦</div>

          <div className="space-y-3 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building2 className="w-6 h-6 text-[#FF5A1F]" />
                <span className="text-xs font-black uppercase tracking-wider text-[#FF5A1F]">Linked Bank Account</span>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Auto Refill Active
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-2xl font-black text-[#1A1110]">{linkedBank.bankName}</h3>
              <p className="text-sm font-mono font-extrabold text-[#FF5A1F] tracking-widest">{linkedBank.accountNumber}</p>
              <div className="flex items-center space-x-3 text-xs text-[#4A5568] font-bold pt-1">
                <span>IFSC: {linkedBank.ifscCode}</span>
                <span>•</span>
                <span>UPI: {linkedBank.upiId}</span>
              </div>
            </div>
          </div>

          {/* Switch Linked Bank Account Selector */}
          <div className="space-y-2 z-10 border-t border-[#DAF0F7] pt-3">
            <span className="text-xs font-black text-[#4A5568] uppercase tracking-wider block">Switch Linked Bank Account:</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {availableBanks.map(b => (
                <button
                  key={b.name}
                  onClick={() => handleBankSwitch(b)}
                  className={`p-2 rounded-xl text-left text-xs font-black border transition-all ${
                    linkedBank.bankName === b.name
                      ? 'bg-[#FF5A1F] text-white border-[#FF5A1F] shadow-md scale-105'
                      : 'bg-[#DAF0F7]/50 text-[#1A1110] border-[#B2E2F0] hover:bg-[#DAF0F7]'
                  }`}
                >
                  <span className="block truncate">{b.name}</span>
                  <span className="text-[9px] opacity-75 font-mono">{b.acc}</span>
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Low Balance Warning (Deep Crimson Red #C2185B) */}
      {walletBalance < 300 && (
        <div className="p-4 bg-[#C2185B]/10 border-2 border-[#C2185B] rounded-2xl flex items-center space-x-3 text-[#C2185B]">
          <AlertTriangle className="w-6 h-6 text-[#C2185B] flex-shrink-0" />
          <p className="text-xs sm:text-sm font-black">{t('wallet.lowBalance')}</p>
        </div>
      )}

      {/* Custom Amount Recharge Form */}
      <form onSubmit={handleRechargeSubmit} className="bg-white p-6 rounded-3xl border-2 border-[#DAF0F7] shadow-lg space-y-4 text-[#1A1110]">
        <h3 className="text-lg font-black text-[#1A1110] flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-[#16A34A]" />
          Custom Wallet Recharge (Auto-Debited from {linkedBank.bankName})
        </h3>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <span className="absolute left-4 top-3 text-lg font-black text-[#4A5568]">₹</span>
            <input
              type="number"
              min="1"
              value={customAmount}
              onChange={e => setCustomAmount(e.target.value)}
              placeholder="Enter recharge amount"
              className="w-full pl-9 pr-4 py-3 rounded-2xl border border-[#B2E2F0] bg-slate-50 text-[#1A1110] font-black text-base focus:outline-none focus:border-[#FF5A1F]"
            />
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto px-8 py-3 bg-[#FF5A1F] hover:bg-[#E04812] text-white font-black rounded-2xl shadow-lg shadow-[#FF5A1F]/30 transition-transform active:scale-95 flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Plus className="w-5 h-5 text-white" />
            <span>Recharge from {linkedBank.bankName}</span>
          </button>
        </div>
      </form>

      {/* Transaction History Table */}
      <div className="bg-white rounded-3xl border-2 border-[#DAF0F7] p-6 shadow-lg space-y-4 text-[#1A1110]">
        <h3 className="text-lg font-black text-[#1A1110] flex items-center gap-2">
          <History className="w-5 h-5 text-[#FF5A1F]" />
          {t('wallet.history')}
        </h3>

        <div className="divide-y divide-[#DAF0F7]">
          {walletTransactions.map(tx => (
            <div key={tx.id} className="py-3.5 flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center space-x-3">
                <div className={`p-2.5 rounded-2xl ${
                  tx.type === 'recharge' ? 'bg-[#16A34A]/10 text-[#16A34A]' : 'bg-[#C2185B]/10 text-[#C2185B]'
                }`}>
                  {tx.type === 'recharge' ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                </div>
                <div>
                  <h4 className="font-black text-[#1A1110]">{tx.description}</h4>
                  <span className="text-[11px] text-[#4A5568] font-bold">{new Date(tx.timestamp).toLocaleString()}</span>
                </div>
              </div>

              <div className="text-right">
                <span className={`text-sm font-black ${
                  tx.type === 'recharge' ? 'text-[#16A34A]' : 'text-[#1A1110]'
                }`}>
                  {tx.type === 'recharge' ? '+' : '-'}₹{tx.amount.toFixed(2)}
                </span>
                <span className="block text-[10px] text-[#16A34A] font-bold uppercase">{tx.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
