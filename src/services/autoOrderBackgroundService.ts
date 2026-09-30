import { AutoOrderSchedule, ExecutedOrder, ScheduleDuration, ScheduleOverride } from '../types';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { PriceComparisonService } from './priceComparisonService';
import { WalletService } from './walletService';

const SCHEDULES_KEY = 'smart_food_auto_schedules';
const OVERRIDES_KEY = 'smart_food_schedule_overrides';
const ORDER_HISTORY_KEY = 'smart_food_order_history';

/**
 * Calculate end date based on start date and duration setting
 */
export function calculateScheduleEndDate(
  startDateStr: string,
  duration?: ScheduleDuration,
  customEndDate?: string
): string | undefined {
  if (!duration || duration === 'indefinite') return undefined;
  if (duration === 'custom') return customEndDate || undefined;
  if (duration === 'today_only') return startDateStr;

  const parts = startDateStr.split('-');
  if (parts.length !== 3) return undefined;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const start = new Date(year, month, day);
  if (isNaN(start.getTime())) return undefined;

  if (duration === '1_week') {
    start.setDate(start.getDate() + 7);
  } else if (duration === '1_month') {
    start.setMonth(start.getMonth() + 1);
  } else if (duration === '3_months') {
    start.setMonth(start.getMonth() + 3);
  }

  const yyyy = start.getFullYear();
  const mm = String(start.getMonth() + 1).padStart(2, '0');
  const dd = String(start.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const getTodayFormattedDate = (): string => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const INITIAL_SCHEDULES: AutoOrderSchedule[] = [
  {
    id: 'sched-1',
    slotName: 'Breakfast Slot',
    slotIndex: 1,
    time: '08:00',
    frequency: 'daily',
    foodItemId: 'dosa-masala',
    foodItemName: 'Crispy Masala Dosa',
    restaurant: 'Murugan Idli Shop',
    quantity: 1,
    strategy: 'best_value',
    isEnabled: true,
    walletAutoDebit: true,
    notes: 'Morning energy breakfast',
    duration: '1_month',
    startDate: getTodayFormattedDate(),
    endDate: calculateScheduleEndDate(getTodayFormattedDate(), '1_month')
  },
  {
    id: 'sched-2',
    slotName: 'Lunch Slot',
    slotIndex: 2,
    time: '13:00',
    frequency: 'daily',
    foodItemId: 'biryani-hyderabadi',
    foodItemName: 'Hyderabadi Chicken Dum Biryani',
    restaurant: 'Bawarchi Biryani',
    quantity: 1,
    strategy: 'best_value',
    isEnabled: true,
    walletAutoDebit: true,
    notes: 'Afternoon feast',
    duration: '3_months',
    startDate: getTodayFormattedDate(),
    endDate: calculateScheduleEndDate(getTodayFormattedDate(), '3_months')
  }
];

const INITIAL_OVERRIDES: ScheduleOverride[] = [
  {
    id: 'override-demo-1',
    scheduleId: 'sched-1',
    date: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })(),
    isSkipped: false,
    foodItemId: 'idli-sambar',
    foodItemName: 'Ghee Sambar Idli (4 Pcs)',
    restaurant: 'Murugan Idli Shop',
    time: '08:30',
    quantity: 2,
    notes: 'Special weekend breakfast override (Idli instead of Dosa at 8:30 AM)'
  }
];

export class AutoOrderBackgroundService {
  private static timerId: any = null;
  private static listeners: Array<(order: ExecutedOrder, schedule: AutoOrderSchedule) => void> = [];

  /**
   * Retrieve all schedules.
   */
  public static getSchedules(): AutoOrderSchedule[] {
    const stored = localStorage.getItem(SCHEDULES_KEY);
    if (stored !== null) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Error reading schedules', e);
      }
    }
    localStorage.setItem(SCHEDULES_KEY, JSON.stringify(INITIAL_SCHEDULES));
    return INITIAL_SCHEDULES;
  }

  /**
   * Save or update a schedule.
   */
  public static saveSchedule(schedule: AutoOrderSchedule): AutoOrderSchedule[] {
    const schedules = this.getSchedules();

    // Enforce default start date & end date calculation if missing
    if (!schedule.startDate) {
      schedule.startDate = getTodayFormattedDate();
    }
    if (schedule.duration && !schedule.endDate) {
      schedule.endDate = calculateScheduleEndDate(schedule.startDate, schedule.duration);
    }

    const existingIndex = schedules.findIndex(s => s.id === schedule.id);

    if (existingIndex >= 0) {
      schedules[existingIndex] = schedule;
    } else {
      schedules.push(schedule);
    }

    localStorage.setItem(SCHEDULES_KEY, JSON.stringify(schedules));
    return schedules;
  }

  /**
   * Delete a schedule and its associated date overrides.
   */
  public static deleteSchedule(scheduleId: string): AutoOrderSchedule[] {
    const schedules = this.getSchedules();
    const filtered = schedules.filter(s => s.id !== scheduleId);
    localStorage.setItem(SCHEDULES_KEY, JSON.stringify(filtered));

    // Also delete all overrides linked to this schedule
    const overrides = this.getOverrides();
    const remainingOverrides = overrides.filter(o => o.scheduleId !== scheduleId);
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(remainingOverrides));

    return filtered;
  }

  /**
   * Retrieve all per-date schedule overrides/exceptions.
   */
  public static getOverrides(): ScheduleOverride[] {
    const stored = localStorage.getItem(OVERRIDES_KEY);
    if (stored !== null) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Error reading overrides', e);
      }
    }
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(INITIAL_OVERRIDES));
    return INITIAL_OVERRIDES;
  }

  /**
   * Get overrides for a specific schedule ID.
   */
  public static getOverridesForSchedule(scheduleId: string): ScheduleOverride[] {
    return this.getOverrides().filter(o => o.scheduleId === scheduleId);
  }

  /**
   * Get override for a specific schedule ID and date (YYYY-MM-DD).
   */
  public static getOverride(scheduleId: string, dateStr: string): ScheduleOverride | undefined {
    return this.getOverrides().find(o => o.scheduleId === scheduleId && o.date === dateStr);
  }

  /**
   * Save or update a per-date schedule override/exception.
   */
  public static saveOverride(override: ScheduleOverride): ScheduleOverride[] {
    const overrides = this.getOverrides();
    const existingIndex = overrides.findIndex(o => o.id === override.id || (o.scheduleId === override.scheduleId && o.date === override.date));

    if (existingIndex >= 0) {
      overrides[existingIndex] = override;
    } else {
      overrides.push(override);
    }

    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
    return overrides;
  }

  /**
   * Delete a per-date schedule override.
   */
  public static deleteOverride(overrideId: string): ScheduleOverride[] {
    const overrides = this.getOverrides();
    const filtered = overrides.filter(o => o.id !== overrideId);
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(filtered));
    return filtered;
  }

  /**
   * 🚀 Exclude/Skip a specific date from a recurring schedule.
   * Syncs both schedule.excludedDates and ScheduleOverride (isSkipped: true).
   */
  public static skipScheduleDate(scheduleId: string, dateStr: string): AutoOrderSchedule[] {
    const schedules = this.getSchedules();
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) return schedules;

    if (!schedule.excludedDates) schedule.excludedDates = [];
    if (!schedule.excludedDates.includes(dateStr)) {
      schedule.excludedDates.push(dateStr);
    }

    this.saveSchedule(schedule);

    // Also persist in ScheduleOverride table
    this.saveOverride({
      id: `override-skip-${scheduleId}-${dateStr}`,
      scheduleId,
      date: dateStr,
      isSkipped: true,
      notes: `Single-day skipped by user for ${dateStr}`
    });

    return this.getSchedules();
  }

  /**
   * 🚀 Restore/Unskip a previously excluded date for a recurring schedule.
   */
  public static restoreScheduleDate(scheduleId: string, dateStr: string): AutoOrderSchedule[] {
    const schedules = this.getSchedules();
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) return schedules;

    if (schedule.excludedDates) {
      schedule.excludedDates = schedule.excludedDates.filter(d => d !== dateStr);
    }

    this.saveSchedule(schedule);

    // Remove override if present
    const override = this.getOverride(scheduleId, dateStr);
    if (override) {
      this.deleteOverride(override.id);
    }

    return this.getSchedules();
  }

  /**
   * Retrieve order history.
   */
  public static getOrderHistory(): ExecutedOrder[] {
    const stored = localStorage.getItem(ORDER_HISTORY_KEY);
    if (stored !== null) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Error reading order history', e);
      }
    }
    return [];
  }

  /**
   * Subscribe to execution events.
   */
  public static onOrderExecuted(callback: (order: ExecutedOrder, schedule: AutoOrderSchedule) => void) {
    this.listeners.push(callback);
  }

  /**
   * Check if daily order limit (6/6) is reached for today.
   */
  private static isDailyLimitReachedToday(): boolean {
    try {
      const stored = localStorage.getItem('smart_food_daily_order_tracker');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.date === getTodayFormattedDate()) {
          return typeof parsed.count === 'number' && parsed.count >= 6;
        }
      }
    } catch (e) {}
    return false;
  }

  /**
   * Execute a schedule immediately (Manual trigger or Auto-timer trigger).
   * Respects per-date custom overrides for targetDate (defaults to today).
   */
  public static executeScheduleNow(scheduleId: string, targetDate?: string): ExecutedOrder {
    const schedules = this.getSchedules();
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) throw new Error('Schedule not found');

    const todayStr = targetDate || getTodayFormattedDate();

    // Check if an override exists for target date
    const override = this.getOverride(scheduleId, todayStr);
    if (override && override.isSkipped) {
      throw new Error(`Schedule occurrence for ${todayStr} is marked as SKIPPED by user override.`);
    }

    // Determine effective item, restaurant, quantity, and strategy
    const effectiveFoodItemId = (override && override.foodItemId) ? override.foodItemId : schedule.foodItemId;
    const effectiveFoodItemName = (override && override.foodItemName) ? override.foodItemName : schedule.foodItemName;
    const effectiveRestaurant = (override && override.restaurant) ? override.restaurant : schedule.restaurant;
    const effectiveQuantity = (override && override.quantity) ? override.quantity : schedule.quantity;
    const effectiveStrategy = (override && override.strategy) ? override.strategy : schedule.strategy;

    const foodItem = INDIAN_FOOD_CATALOG.find(f => f.id === effectiveFoodItemId) || INDIAN_FOOD_CATALOG[0];

    // Evaluate live prices across platforms
    const chosenPlatform = PriceComparisonService.selectByStrategy(foodItem.platforms, effectiveStrategy);
    const totalCost = (chosenPlatform.price + chosenPlatform.deliveryFee) * effectiveQuantity;

    const orderId = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;

    if (schedule.walletAutoDebit) {
      const debitDesc = override
        ? `${effectiveFoodItemName} (${chosenPlatform.platformName}) [Custom Date Override: ${todayStr}]`
        : `${effectiveFoodItemName} (${chosenPlatform.platformName})`;

      WalletService.autoDebit(
        totalCost,
        debitDesc,
        orderId,
        chosenPlatform.platform
      );
    }

    // Save executed order record
    const executedOrder: ExecutedOrder = {
      id: orderId,
      foodName: `${effectiveFoodItemName} (x${effectiveQuantity})${override ? ' (Date Customised)' : ''}`,
      restaurant: effectiveRestaurant || foodItem.restaurant,
      platform: chosenPlatform.platform,
      platformName: chosenPlatform.platformName,
      amountPaid: totalCost,
      originalPrice: (chosenPlatform.originalPrice + chosenPlatform.deliveryFee) * effectiveQuantity,
      savings: Math.max(0, (chosenPlatform.originalPrice - chosenPlatform.price) * effectiveQuantity),
      rating: chosenPlatform.rating,
      timestamp: new Date().toISOString(),
      status: 'delivered',
      isAutoOrder: true,
      orderType: 'scheduled'
    };

    const history = this.getOrderHistory();
    const updatedHistory = [executedOrder, ...history];
    localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(updatedHistory));

    // Update schedule's lastRun timestamp
    schedule.lastRun = new Date().toISOString();
    this.saveSchedule(schedule);

    // Notify listeners
    this.listeners.forEach(cb => cb(executedOrder, schedule));

    return executedOrder;
  }

  private static preOrderListeners: Array<(schedule: AutoOrderSchedule) => void> = [];
  private static promptedSchedulesToday: Set<string> = new Set();

  public static onPreOrderPrompt(cb: (schedule: AutoOrderSchedule) => void) {
    this.preOrderListeners.push(cb);
    return () => {
      this.preOrderListeners = this.preOrderListeners.filter(l => l !== cb);
    };
  }

  /**
   * Start background monitor service polling schedules across extended long-term durations.
   */
  public static startService() {
    if (this.timerId !== null) return;

    this.timerId = setInterval(() => {
      const now = new Date();
      const todayStr = getTodayFormattedDate();
      const currentHoursMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

      const schedules = this.getSchedules();
      schedules.forEach(schedule => {
        if (!schedule.isEnabled) return;

        // 1. Check Schedule Duration & Start/End Date Range
        const startDate = schedule.startDate || todayStr;
        if (todayStr < startDate) {
          return; // Schedule start date is in the future
        }

        if (schedule.endDate && todayStr > schedule.endDate) {
          return; // Schedule duration has ended
        }

        // 2. Check Recurrence Frequency
        if (schedule.frequency === 'once' && todayStr !== startDate) {
          return;
        }

        if (schedule.frequency === 'weekly' && schedule.selectedDays && schedule.selectedDays.length > 0) {
          const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
          const currentDayName = dayNames[now.getDay()];
          if (!schedule.selectedDays.map(d => d.toLowerCase()).includes(currentDayName)) {
            return;
          }
        }

        // 3. Check Per-Date Override or Excluded Dates for Today
        if (schedule.excludedDates && schedule.excludedDates.includes(todayStr)) {
          return; // Explicitly excluded for today
        }
        const override = this.getOverride(schedule.id, todayStr);
        if (override && override.isSkipped) {
          // Explicitly skipped by user for today
          return;
        }

        // Effective trigger time for today (override time if set, else schedule default time)
        const targetTime = (override && override.time) ? override.time : schedule.time;

        // 4. Check 5-Minute Pre-Order Voice Confirmation Trigger
        const [targetH, targetM] = targetTime.split(':').map(n => parseInt(n, 10));
        if (!isNaN(targetH) && !isNaN(targetM)) {
          const targetTotalMinutes = targetH * 60 + targetM;
          const diffMinutes = targetTotalMinutes - currentTotalMinutes;

          const promptKey = `preorder_prompt_${schedule.id}_${todayStr}`;
          if (diffMinutes === 5 && !this.promptedSchedulesToday.has(promptKey)) {
            this.promptedSchedulesToday.add(promptKey);
            console.log(`[AutoOrderBackgroundService]: Triggering 5-minute pre-order voice confirmation for schedule "${schedule.slotName}" (${schedule.foodItemName})`);
            this.preOrderListeners.forEach(cb => cb(schedule));
          }
        }

        if (targetTime === currentHoursMin) {
          const lastRunDate = schedule.lastRun ? new Date(schedule.lastRun) : null;
          const isSameMinute = lastRunDate && (now.getTime() - lastRunDate.getTime() < 60000);

          if (!isSameMinute) {
            // Check Daily Order Limit before executing scheduled order
            if (this.isDailyLimitReachedToday()) {
              console.warn(`[AutoOrderBackgroundService]: Daily order limit reached (6/6). Skipping auto-execution for schedule "${schedule.slotName}" until limit is renewed.`);
              return;
            }

            try {
              this.executeScheduleNow(schedule.id, todayStr);
            } catch (err) {
              console.error('Failed to auto-execute schedule:', err);
            }
          }
        }
      });
    }, 15000); // Check every 15 seconds
  }

  public static stopService() {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
