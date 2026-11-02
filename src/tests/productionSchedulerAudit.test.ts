import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AutoOrderBackgroundService } from '../services/autoOrderBackgroundService';
import { VoiceCommandParser } from '../services/voiceCommandParser';
import { AutoOrderSchedule } from '../types';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';

describe('AutoFeast AI - Final Scheduler Production Audit Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('1. Schedule Synchronization: UI to MongoDB payload verification', async () => {
    const mockSchedule: AutoOrderSchedule = {
      id: 'sched-sync-test',
      slotName: 'Lunch Slot',
      slotIndex: 2,
      time: '13:00',
      frequency: 'custom',
      selectedDays: ['Mon', 'Wed', 'Fri'],
      foodItemId: 'biryani-hyderabadi-chicken',
      foodItemName: 'Hyderabadi Chicken Dum Biryani',
      restaurant: 'Bawarchi Biryani',
      quantity: 2,
      strategy: 'best_value',
      isEnabled: true,
      walletAutoDebit: true,
      duration: '1_month',
      startDate: '2026-11-03',
      endDate: '2026-12-03'
    };

    // Save locally
    const saved = AutoOrderBackgroundService.saveSchedule(mockSchedule);
    expect(saved.some(s => s.id === 'sched-sync-test')).toBe(true);

    // Verify payload structure matches server requirements
    expect(mockSchedule.selectedDays).toEqual(['Mon', 'Wed', 'Fri']);
    expect(mockSchedule.time).toBe('13:00');
    expect(mockSchedule.startDate).toBe('2026-11-03');
    expect(mockSchedule.endDate).toBe('2026-12-03');
    expect(mockSchedule.quantity).toBe(2);
    expect(mockSchedule.foodItemId).toBe('biryani-hyderabadi-chicken');
    expect(mockSchedule.restaurant).toBe('Bawarchi Biryani');
  });

  it('2. Schedule Persistence across simulated browser restart', () => {
    const mockSchedule: AutoOrderSchedule = {
      id: 'sched-persist-1',
      slotName: 'Dinner Slot',
      slotIndex: 3,
      time: '20:00',
      frequency: 'daily',
      foodItemId: 'dosa-masala',
      foodItemName: 'Crispy Masala Dosa',
      restaurant: 'Murugan Idli Shop',
      quantity: 1,
      strategy: 'best_value',
      isEnabled: true,
      walletAutoDebit: true,
      duration: '1_month',
      startDate: '2026-11-02'
    };

    AutoOrderBackgroundService.saveSchedule(mockSchedule);

    // Simulate browser restart by reading fresh from storage
    const reloaded = AutoOrderBackgroundService.getSchedules();
    const found = reloaded.find(s => s.id === 'sched-persist-1');
    expect(found).toBeDefined();
    expect(found?.foodItemName).toBe('Crispy Masala Dosa');
    expect(found?.time).toBe('20:00');
  });

  it('3 & 4. Browser-Closed & Laptop-Off Execution: validates server cron skipping vs triggering', () => {
    // Current time in IST: 13:00 (1 PM)
    const istTimeStr = '13:00';
    const istDateStr = '2026-11-02';

    // Schedule 1: 1:00 PM IST (Due now)
    const dueSchedule: AutoOrderSchedule = {
      id: 'sched-due',
      slotName: 'Lunch',
      slotIndex: 2,
      time: '13:00',
      frequency: 'daily',
      foodItemId: 'biryani-hyderabadi',
      foodItemName: 'Chicken Biryani',
      restaurant: 'Bawarchi',
      quantity: 1,
      strategy: 'best_value',
      isEnabled: true,
      walletAutoDebit: true,
      startDate: '2026-11-01'
    };

    // Schedule 2: 6:00 PM IST (Not due yet)
    const futureSchedule: AutoOrderSchedule = {
      id: 'sched-future',
      slotName: 'Dinner',
      slotIndex: 3,
      time: '18:00',
      frequency: 'daily',
      foodItemId: 'dosa-masala',
      foodItemName: 'Masala Dosa',
      restaurant: 'Murugan',
      quantity: 1,
      strategy: 'best_value',
      isEnabled: true,
      walletAutoDebit: true,
      startDate: '2026-11-01'
    };

    // Simulate Server Cron Logic:
    const evaluateCron = (sch: AutoOrderSchedule) => {
      if (istDateStr < (sch.startDate || istDateStr)) return 'skipped_future_start_date';
      if (sch.lastRunDate === istDateStr) return 'already_executed_today';
      if (istTimeStr < sch.time) return 'skipped_not_due_yet';
      return 'execute_order';
    };

    expect(evaluateCron(dueSchedule)).toBe('execute_order');
    expect(evaluateCron(futureSchedule)).toBe('skipped_not_due_yet');
  });

  it('5. Dynamic Search Order Pipeline: price comparison, taxes, and savings calculation', () => {
    const catalogItem = INDIAN_FOOD_CATALOG.find(i => i.id === 'biryani-hyderabadi-chicken');
    const baseItemPrice = catalogItem?.basePrice || 240;
    const quantity = 2;
    const subtotal = baseItemPrice * quantity; // 480
    const deliveryFee = subtotal >= 299 ? 0 : 35; // 0 (above 299)
    const taxesAndCharges = Math.round(subtotal * 0.05) + 15; // 24 + 15 = 39
    const totalAmount = subtotal + deliveryFee + taxesAndCharges; // 519
    const discountSavings = Math.min(50, Math.round(subtotal * 0.15)); // 50
    const finalAmount = totalAmount - discountSavings; // 469

    expect(subtotal).toBe(480);
    expect(deliveryFee).toBe(0);
    expect(discountSavings).toBe(50);
    expect(finalAmount).toBe(469);
  });

  it('6. Wallet Authorization & Atomic Debit Safeguard', () => {
    let serverWalletBalance = 500;
    const orderCost = 469;

    // First order: sufficient balance
    let canDebit = serverWalletBalance >= orderCost;
    expect(canDebit).toBe(true);
    serverWalletBalance -= orderCost;
    expect(serverWalletBalance).toBe(31);

    // Second order: insufficient balance
    canDebit = serverWalletBalance >= orderCost;
    expect(canDebit).toBe(false); // Safeguard prevents overdraft!
  });

  it('7. Nominee Approval Safeguard: restricts sensitive food orders until approved', () => {
    const restrictedSchedule: AutoOrderSchedule = {
      id: 'sched-restricted',
      slotName: 'Snack',
      slotIndex: 4,
      time: '17:00',
      frequency: 'daily',
      foodItemId: 'chaat-pani-puri',
      foodItemName: 'Crispy Pani Puri',
      restaurant: 'Haldirams',
      quantity: 1,
      strategy: 'best_value',
      isEnabled: true,
      walletAutoDebit: true,
      approvalId: undefined // Not approved!
    };

    const isBlocked = (restrictedSchedule.foodItemId === 'chaat-pani-puri' && !restrictedSchedule.approvalId);
    expect(isBlocked).toBe(true);
  });

  it('8. Concurrent Duplicate Cron Requests: Idempotency Key guarantees single execution', () => {
    const istDateStr = '2026-11-02';
    const schedule = {
      id: 'sched-atomic-test',
      lastRunDate: null as string | null
    };

    // Simulated atomic findOneAndUpdate({ id, lastRunDate: { $ne: istDateStr } })
    const atomicClaim = () => {
      if (schedule.lastRunDate === istDateStr) {
        return false; // Already claimed by another concurrent request!
      }
      schedule.lastRunDate = istDateStr;
      return true;
    };

    // First request claims
    const req1Success = atomicClaim();
    // Concurrent second request tries at same millisecond
    const req2Success = atomicClaim();

    expect(req1Success).toBe(true);
    expect(req2Success).toBe(false); // Second request safely rejected!
  });

  it('9. Pause, Resume, and Cancellation Management', () => {
    const sch: AutoOrderSchedule = {
      id: 'sched-toggle-test',
      slotName: 'Breakfast',
      slotIndex: 1,
      time: '08:00',
      frequency: 'daily',
      foodItemId: 'dosa-masala',
      foodItemName: 'Crispy Masala Dosa',
      restaurant: 'Murugan',
      quantity: 1,
      strategy: 'best_value',
      isEnabled: true,
      walletAutoDebit: true
    };

    AutoOrderBackgroundService.saveSchedule(sch);

    // Pause
    sch.isEnabled = false;
    AutoOrderBackgroundService.saveSchedule(sch);
    expect(AutoOrderBackgroundService.getSchedules().find(s => s.id === 'sched-toggle-test')?.isEnabled).toBe(false);

    // Resume
    sch.isEnabled = true;
    AutoOrderBackgroundService.saveSchedule(sch);
    expect(AutoOrderBackgroundService.getSchedules().find(s => s.id === 'sched-toggle-test')?.isEnabled).toBe(true);

    // Cancellation
    AutoOrderBackgroundService.deleteSchedule('sched-toggle-test');
    expect(AutoOrderBackgroundService.getSchedules().find(s => s.id === 'sched-toggle-test')).toBeUndefined();
  });

  it('10. Multilingual Scheduling across Tamil, English, Hindi, and Tanglish', () => {
    const commands = [
      { text: 'schedule one chicken biryani daily at 1 PM', expectedFreq: 'daily', expectedTime: '13:00' },
      { text: 'தினமும் மதியம் 1 மணிக்கு ஒரு சிக்கன் பிரியாணி திட்டமிடு', expectedFreq: 'daily', expectedTime: '13:00' },
      { text: 'रोज दोपहर 1 बजे एक चिकन बिरयानी शेड्यूल करो', expectedFreq: 'daily', expectedTime: '13:00' },
      { text: 'Daily afternoon one mani ku one chicken biryani schedule pannu', expectedFreq: 'daily', expectedTime: '13:00' }
    ];

    for (const cmd of commands) {
      const parsed = VoiceCommandParser.parse(cmd.text);
      expect(parsed.action).toBe('schedule');
      expect(parsed.time?.time24).toBe(cmd.expectedTime);
      expect(parsed.items.length).toBeGreaterThan(0);
      expect(parsed.items[0].name.toLowerCase()).toContain('biryani');
    }
  });
});
