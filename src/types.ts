export type Language = 'en' | 'ta' | 'hi';

export type CuisineType =
  | 'South Indian'
  | 'North Indian'
  | 'Tamil'
  | 'Kerala'
  | 'Andhra'
  | 'Telangana'
  | 'Karnataka'
  | 'Bengali'
  | 'Gujarati'
  | 'Maharashtrian'
  | 'Punjabi'
  | 'Rajasthani'
  | 'Mughlai'
  | 'Indo-Chinese'
  | 'Fast Food'
  | 'Street Food'
  | 'Desserts'
  | 'Beverages';

export type PlatformName = 'swiggy' | 'zomato' | 'eatsure' | 'magicpin';

export interface PlatformPriceOption {
  platform: PlatformName;
  platformName: string;
  price: number;
  originalPrice: number;
  rating: number;
  deliveryTime: number; // in minutes
  deliveryFee: number;
  discountBadge?: string;
  available: boolean;
}

export interface FoodItem {
  id: string;
  name: string;
  nativeNames: {
    en: string;
    ta: string;
    hi: string;
  };
  cuisine: CuisineType;
  category: string;
  isVeg: boolean;
  basePrice: number;
  description: string;
  image: string;
  rating: number;
  tags: string[];
  locations: string[];
  restaurant: string;
  restaurantLat: number;
  restaurantLng: number;
  distanceKm?: number;
  platforms: PlatformPriceOption[];
}

export type OrderStrategy = 'best_value' | 'cheapest' | 'highest_rated' | 'fastest';

export type ScheduleDuration = 'today_only' | '1_week' | '1_month' | '3_months' | 'custom' | 'indefinite';

export interface ScheduleOverride {
  id: string;
  scheduleId: string;
  date: string; // YYYY-MM-DD
  isSkipped?: boolean;
  foodItemId?: string;
  foodItemName?: string;
  restaurant?: string;
  quantity?: number;
  time?: string; // HH:mm
  strategy?: OrderStrategy;
  notes?: string;
}

export interface AutoOrderSchedule {
  id: string;
  slotName: string;
  slotIndex: 1 | 2 | 3 | 4;
  time: string;
  frequency: 'daily' | 'weekly' | 'custom' | 'once';
  selectedDays?: string[];
  foodItemId: string;
  foodItemName: string;
  restaurant: string;
  quantity: number;
  strategy: OrderStrategy;
  isEnabled: boolean;
  walletAutoDebit: boolean;
  lastRun?: string;
  nextRun?: string;
  notes?: string;
  duration?: ScheduleDuration;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD (null/undefined if indefinite)
  excludedDates?: string[]; // Array of YYYY-MM-DD dates skipped from recurring schedule
}

export interface LinkedBank {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  ifscCode: string;
  upiId: string;
  autoRechargeEnabled: boolean;
}

export interface WalletTransaction {
  id: string;
  type: 'recharge' | 'auto_debit' | 'manual_order';
  amount: number;
  timestamp: string;
  description: string;
  orderId?: string;
  platform?: PlatformName;
  status: 'completed' | 'failed' | 'pending';
}

export interface AccessibilitySettings {
  textSize: 'sm' | 'md' | 'lg' | 'xl';
  highContrast: boolean;
  themeMode?: 'light' | 'dark' | 'high-contrast';
  voiceAssistant: boolean;
  readAloud: boolean;
}

export type AppView = 'search' | 'scheduler' | 'wallet' | 'orders' | 'tracking';

export type EntryStep = 'auth' | 'language' | 'welcome' | 'location_permission' | 'dashboard';

export interface UserLocation {
  latitude: number;
  longitude: number;
  addressName: string;
  city: string;
  area: string;
  isLiveGPS: boolean;
  isApproximate?: boolean;
  accuracyMeters?: number;
  isManualOverride?: boolean;
}

export interface LiveOrderTracking {
  orderId: string;
  foodName: string;
  restaurant: string;
  restaurantLat: number;
  restaurantLng: number;
  platformName: string;
  platform: PlatformName;
  amountPaid: number;
  savings: number;
  deliveryAddress: string;
  totalEtaMinutes: number;
  remainingSeconds: number;
  driverName: string;
  driverPhone: string;
  statusStage: 'placed' | 'preparing' | 'on_the_way' | 'delivered';
  timestamp: string;
  isAutoScheduled: boolean;
}

export interface ExecutedOrder {
  id: string;
  foodName: string;
  restaurant: string;
  platform: PlatformName;
  platformName: string;
  amountPaid: number;
  originalPrice: number;
  savings: number;
  rating: number;
  timestamp: string;
  status: 'delivered' | 'processing' | 'scheduled';
  isAutoOrder: boolean;
  orderType?: 'instant' | 'scheduled';
  deliveryAddress?: string;
}

import { ParsedOrderBill } from './services/nlpParserService';

export interface PendingNomineeApproval {
  id: string;
  foodItem: FoodItem;
  orderType: 'instant' | 'scheduled';
  scheduleDetails?: { time: string; slotName: string; duration?: string; frequency?: string };
  requestedAt: string;
  status: 'pending' | 'approved' | 'denied';
  nomineeEmail?: string;
  nomineeName?: string;
}

export interface PendingPinVerification {
  type: 'instant_order' | 'save_schedule' | 'execute_schedule' | 'bill_order' | 'reveal_wallet' | 'cancel_schedule';
  item?: FoodItem;
  bill?: ParsedOrderBill;
  strategy?: OrderStrategy;
  schedule?: AutoOrderSchedule;
  scheduleId?: string;
  amount?: number;
  cancelType?: 'only_this' | 'whole';
  cancelDateStr?: string;
}

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

export interface ScheduleCartItem {
  foodItem: FoodItem;
  quantity: number;
}


