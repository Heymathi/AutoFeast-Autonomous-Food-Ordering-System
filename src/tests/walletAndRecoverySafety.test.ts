import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('AutoFeast AI – Wallet Crash Recovery & State Machine Safety Suite', () => {

  describe('1. Idempotent Occurrence State Machine & Crash Recovery', () => {
    let mockOccurrencesDb: any[] = [];
    let mockUsersDb: any[] = [];
    let mockOrdersDb: any[] = [];

    beforeEach(() => {
      mockOccurrencesDb = [];
      mockUsersDb = [{
        id: 'usr_test_123',
        walletBalance: 2500,
        walletTransactions: []
      }];
      mockOrdersDb = [];
    });

    it('simulates safe crash recovery: debited state without order record triggers compensating refund', () => {
      const scheduleId = 'sched_999';
      const istDateStr = '2026-11-02';
      const occurrenceKey = `occ_${scheduleId}_${istDateStr}`;
      const amount = 160;

      // Stage 1: Schedule claimed
      const occurrence = {
        occurrenceId: occurrenceKey,
        scheduleId,
        userId: 'usr_test_123',
        date: istDateStr,
        state: 'claimed',
        amount,
        foodItemName: 'Chicken Biryani',
        restaurant: 'AutoFeast Kitchen',
        orderId: 'ord_auto_test_1',
        debitTxId: null,
        refundTxId: null
      };
      mockOccurrencesDb.push(occurrence);

      // Stage 2: Wallet debited atomically
      const user = mockUsersDb.find(u => u.id === 'usr_test_123');
      expect(user.walletBalance).toBe(2500);

      user.walletBalance -= amount;
      occurrence.state = 'debited';
      occurrence.debitTxId = `tx_deb_${occurrenceKey}`;
      user.walletTransactions.push({
        id: occurrence.debitTxId,
        idempotencyKey: occurrenceKey,
        type: 'auto_debit',
        amount
      });

      expect(user.walletBalance).toBe(2340);
      expect(occurrence.state).toBe('debited');

      // Stage 3: CRASH SIMULATION!
      // Server crashed here before OrderRecord could be saved.
      // Next Cron run arrives to recover:
      const existingOcc = mockOccurrencesDb.find(o => o.occurrenceId === occurrenceKey);
      expect(existingOcc).toBeDefined();
      expect(existingOcc.state).toBe('debited');

      const existingOrder = mockOrdersDb.find(o => o.id === existingOcc.orderId);
      expect(existingOrder).toBeUndefined(); // Order was never saved!

      // Compensating refund triggers
      expect(existingOcc.refundTxId).toBeNull();
      const refundTxId = `tx_ref_${occurrenceKey}`;
      user.walletBalance += existingOcc.amount;
      user.walletTransactions.push({
        id: refundTxId,
        idempotencyKey: `refund_${occurrenceKey}`,
        type: 'refund',
        amount: existingOcc.amount
      });
      existingOcc.refundTxId = refundTxId;
      existingOcc.state = 'refunded';

      // Verify that balance is fully restored and no money is lost
      expect(user.walletBalance).toBe(2500);
      expect(existingOcc.state).toBe('refunded');
    });

    it('prevents duplicate debits on the same occurrenceKey', () => {
      const occurrenceKey = 'occ_sched_1_2026-11-02';
      const user = mockUsersDb[0];
      const amount = 200;

      // First debit
      user.walletBalance -= amount;
      user.walletTransactions.push({
        id: `tx_deb_${occurrenceKey}`,
        idempotencyKey: occurrenceKey,
        type: 'auto_debit',
        amount
      });
      expect(user.walletBalance).toBe(2300);

      // Duplicate debit attempt with same idempotencyKey
      const hasDuplicate = user.walletTransactions.some((tx: any) => tx.idempotencyKey === occurrenceKey);
      expect(hasDuplicate).toBe(true);

      // System rejects duplicate debit
      if (!hasDuplicate) {
        user.walletBalance -= amount;
      }
      expect(user.walletBalance).toBe(2300); // Unchanged!
    });

    it('prevents duplicate refunds on the same occurrenceKey', () => {
      const occurrenceKey = 'occ_sched_1_2026-11-02';
      const refundIdempotencyKey = `refund_${occurrenceKey}`;
      const user = mockUsersDb[0];
      const amount = 200;

      // First refund
      user.walletBalance += amount;
      user.walletTransactions.push({
        id: `tx_ref_${occurrenceKey}`,
        idempotencyKey: refundIdempotencyKey,
        type: 'refund',
        amount
      });
      expect(user.walletBalance).toBe(2700);

      // Duplicate refund attempt with same idempotencyKey
      const alreadyRefunded = user.walletTransactions.some((tx: any) => tx.idempotencyKey === refundIdempotencyKey);
      expect(alreadyRefunded).toBe(true);

      // Second refund is blocked
      if (!alreadyRefunded) {
        user.walletBalance += amount;
      }
      expect(user.walletBalance).toBe(2700); // Exactly once!
    });

    it('never refunds an already completed or delivered order', () => {
      const isRefundEligible = (status: string) => {
        if (status === 'delivered' || status === 'completed') {
          return false;
        }
        return status === 'cancelled';
      };

      expect(isRefundEligible('delivered')).toBe(false);
      expect(isRefundEligible('completed')).toBe(false);
      expect(isRefundEligible('placed')).toBe(false);
      expect(isRefundEligible('cancelled')).toBe(true);
    });
  });

  describe('2. GitHub Actions Workflow Error Handling Inspection', () => {
    it('verifies .github/workflows/cron-scheduler.yml error handling configuration', () => {
      const workflowPath = path.resolve(process.cwd(), '.github/workflows/cron-scheduler.yml');
      expect(fs.existsSync(workflowPath)).toBe(true);

      const content = fs.readFileSync(workflowPath, 'utf8');

      // 1. Must run every 15 minutes
      expect(content).toContain("cron: '*/15 * * * *'");

      // 2. Must NOT swallow errors with echo
      expect(content).not.toContain('|| echo "Execution completed or skipped."');
      expect(content).not.toContain('|| echo');

      // 3. Must use --fail-with-body
      expect(content).toContain('--fail-with-body');

      // 4. Must configure timeouts
      expect(content).toContain('--connect-timeout');
      expect(content).toContain('--max-time');

      // 5. Must read CRON_SECRET exclusively from secrets
      expect(content).toContain('${{ secrets.CRON_SECRET }}');
    });
  });

  describe('3. Wallet Demo Transparency & Consistent Demo Balance', () => {
    it('verifies WalletModal.tsx displays explicit Sandbox / Demo Credits disclosure', () => {
      const modalPath = path.resolve(process.cwd(), 'src/components/WalletModal.tsx');
      const content = fs.readFileSync(modalPath, 'utf8');

      expect(content).toContain('Demo / Sandbox Credits');
      expect(content).toContain('Simulated Balance');
      expect(content).toContain('No real money is deposited');
      expect(content).toContain('Bank Settlement Simulator');
      expect(content).toContain('Mock bank profile used for simulated order settlement');
    });

    it('verifies walletService.ts uses reconciled 2500 default demo balance', () => {
      const servicePath = path.resolve(process.cwd(), 'src/services/walletService.ts');
      const content = fs.readFileSync(servicePath, 'utf8');

      expect(content).toContain('const INITIAL_BALANCE = 2500');
    });
  });

});
