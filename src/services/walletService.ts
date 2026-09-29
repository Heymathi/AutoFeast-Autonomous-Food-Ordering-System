import { WalletTransaction, PlatformName } from '../types';

const WALLET_BALANCE_KEY = 'smart_food_wallet_balance';
const WALLET_TX_KEY = 'smart_food_wallet_transactions';

const INITIAL_BALANCE = 1250; // Initial demo wallet balance in Rupees

const INITIAL_TRANSACTIONS: WalletTransaction[] = [
  {
    id: 'tx-init-1',
    type: 'recharge',
    amount: 1500,
    timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
    description: 'Initial Wallet Recharge via UPI',
    status: 'completed'
  },
  {
    id: 'tx-init-2',
    type: 'auto_debit',
    amount: 250,
    timestamp: new Date(Date.now() - 86400000 * 1).toISOString(),
    description: 'Auto-Debit: Breakfast Crispy Masala Dosa (Swiggy)',
    orderId: 'ORD-9821',
    platform: 'swiggy',
    status: 'completed'
  }
];

export class WalletService {
  /**
   * Retrieve current wallet balance.
   */
  public static getBalance(): number {
    const stored = localStorage.getItem(WALLET_BALANCE_KEY);
    if (stored !== null) {
      return parseFloat(stored);
    }
    localStorage.setItem(WALLET_BALANCE_KEY, INITIAL_BALANCE.toString());
    return INITIAL_BALANCE;
  }

  /**
   * Retrieve transaction history.
   */
  public static getTransactions(): WalletTransaction[] {
    const stored = localStorage.getItem(WALLET_TX_KEY);
    if (stored !== null) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Error parsing wallet transactions', e);
      }
    }
    localStorage.setItem(WALLET_TX_KEY, JSON.stringify(INITIAL_TRANSACTIONS));
    return INITIAL_TRANSACTIONS;
  }

  /**
   * Recharge wallet balance.
   */
  public static recharge(amount: number, paymentMethod: string = 'UPI / Debit Card'): WalletTransaction {
    if (amount <= 0) throw new Error('Recharge amount must be greater than zero');

    const currentBalance = this.getBalance();
    const newBalance = currentBalance + amount;
    localStorage.setItem(WALLET_BALANCE_KEY, newBalance.toString());

    const tx: WalletTransaction = {
      id: `tx-rec-${Date.now()}`,
      type: 'recharge',
      amount,
      timestamp: new Date().toISOString(),
      description: `Wallet Recharge via ${paymentMethod}`,
      status: 'completed'
    };

    const txs = this.getTransactions();
    const updatedTxs = [tx, ...txs];
    localStorage.setItem(WALLET_TX_KEY, JSON.stringify(updatedTxs));

    return tx;
  }

  /**
   * Auto-debit wallet balance for scheduled or manual orders.
   */
  public static autoDebit(amount: number, description: string, orderId: string, platform: PlatformName): WalletTransaction {
    const currentBalance = this.getBalance();
    if (currentBalance < amount) {
      throw new Error(`Insufficient wallet balance (₹${currentBalance.toFixed(2)}). Order requires ₹${amount.toFixed(2)}.`);
    }

    const newBalance = currentBalance - amount;
    localStorage.setItem(WALLET_BALANCE_KEY, newBalance.toString());

    const tx: WalletTransaction = {
      id: `tx-deb-${Date.now()}`,
      type: 'auto_debit',
      amount,
      timestamp: new Date().toISOString(),
      description: `Auto-Debit: ${description}`,
      orderId,
      platform,
      status: 'completed'
    };

    const txs = this.getTransactions();
    const updatedTxs = [tx, ...txs];
    localStorage.setItem(WALLET_TX_KEY, JSON.stringify(updatedTxs));

    return tx;
  }
}
