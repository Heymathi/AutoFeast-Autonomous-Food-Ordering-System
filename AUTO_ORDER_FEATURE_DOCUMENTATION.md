# Auto-Order Scheduling Feature Documentation

## Overview

The Auto-Order Scheduler is a comprehensive feature that enables users to schedule automatic food orders from their favorite restaurants at designated times. This feature is designed to be accessible to all users, including elderly people and persons with physical disabilities, through multiple input methods and accessibility features.

## Key Features

### 1. **Scheduled Order Management**
- **4 Time Slots**: Users can set up to 4 automated order schedules per day
  - Slot 1: Breakfast Time (e.g., 8:00 AM)
  - Slot 2: Lunch Time (e.g., 12:00 PM)
  - Slot 3: Snack Time (e.g., 4:00 PM)
  - Slot 4: Dinner Time (e.g., 8:00 PM)

- **Flexible Scheduling**:
  - Daily recurring orders
  - Weekly scheduled orders
  - Custom day selection
  - One-time orders

### 2. **Smart Price Comparison**
The system automatically compares prices across multiple food delivery platforms:
- Swiggy
- Zomato
- EatSure
- MagicPin

**Selection Criteria**:
- Best Price + Best Rating algorithm
- Lowest price option
- Highest rated option
- Fastest delivery option
- Maximum savings calculation

### 3. **Wallet-Based Payment**
- Automatic payment from wallet
- Wallet balance management
- Transaction history tracking
- Low balance warnings
- One-click recharge options (₹500, ₹1000, ₹2000)

### 4. **Multi-Language Support**
Support for 3 languages:
- **English (en)**: Full English interface
- **Tamil (ta)**: Tamil Nadu regional language
- **Hindi (hi)**: Hindi language support

### 5. **Voice & Text Input**
- **Voice Commands**: Speech-to-text ordering
- **Text Input**: Traditional form-based scheduling
- **Voice Feedback**: Text-to-speech for confirmations
- Supports voice input in all 3 languages

### 6. **Accessibility Features**
Designed for elderly users and physically challenged persons:
- **Text Size Options**: Small, Medium, Large, Extra Large
- **High Contrast Mode**: Enhanced visibility
- **Voice Assistant**: Complete voice-based navigation
- **Read Aloud**: Text-to-speech for all UI elements
- **Simplified UI**: Cleaner interface with larger touch targets
- **Keyboard Navigation**: Full keyboard support
- **Increased Touch Targets**: Larger buttons and input fields

## Architecture

### File Structure

```
src/
├── types.ts (Extended with AutoOrderSchedule, Language, AccessibilitySettings)
├── data/
│   ├── translations.ts (Multi-language support)
│   ├── serviceLayer.ts (Price comparison, Wallet, Auto-order services)
│   └── autoOrderBackgroundService.ts (Background execution service)
├── context/
│   └── AppContext.tsx (Updated with language & auto-order state)
├── components/
│   └── AutoOrderScheduler.tsx (Main UI component)
└── App.tsx (Updated with auto-schedule view)
```

### Core Components

#### 1. **AutoOrderScheduler Component**
Main UI component for managing schedules.

**Features**:
- Schedule creation/editing form
- Active schedules display
- Wallet management
- Voice input integration
- Accessibility mode toggle

**Props**:
```typescript
interface AutoOrderSchedulerProps {
  language?: Language;
  onAccessibilityModeChange?: (enabled: boolean) => void;
}
```

#### 2. **Service Layer**

**PriceComparisonService**:
```typescript
- getBestPriceOption(platforms): Best price + rating option
- getCheapestOption(platforms): Lowest price
- getHighestRatedOption(platforms): Best rating
- getFastestDeliveryOption(platforms): Fastest delivery
- getMaxSavings(platforms): Calculate potential savings
- compareAllOptions(platforms): Comprehensive comparison
```

**WalletService**:
```typescript
- getBalance(): Get current balance
- setBalance(amount): Set balance
- rechargeWallet(amount): Add money
- deductFromWallet(amount, orderId): Deduct for order
- getTransactions(): Transaction history
- addTransaction(...): Log transaction
```

**AutoOrderExecutionService**:
```typescript
- getScheduledOrders(): Retrieve all schedules
- saveSchedule(schedule): Create/update schedule
- deleteSchedule(scheduleId): Remove schedule
- getActiveSchedules(): Get enabled schedules only
- checkSchedulesForExecution(): Check due schedules
- updateLastExecution(scheduleId): Update execution status
- calculateNextExecution(schedule): Calculate next run time
- getExecutionStatus(scheduleId): Get execution details
```

#### 3. **Background Service**

**AutoOrderBackgroundService**:
- Runs continuously in browser
- Checks schedules every 60 seconds
- Automatically executes due orders
- Handles price comparison
- Deducts from wallet
- Logs execution results
- Provides status and statistics

**Key Methods**:
```typescript
- startService(): Start background monitoring
- stopService(): Stop background monitoring
- getStatus(): Current service status
- getStatistics(): Execution statistics
- getExecutionLogs(): Historical logs
```

## Usage Guide

### For End Users

#### Setting Up Auto-Orders

1. **Access Auto-Order Scheduler**:
   - Click "Auto Schedule" button in navigation menu
   - Or navigate via: `Home > Auto Schedule`

2. **Create New Schedule**:
   - Click on a time slot (1-4)
   - Fill in the form:
     - Select time (e.g., 08:00 AM)
     - Select restaurant
     - Choose food items from cart
     - Set frequency (daily/weekly)
     - Enable "Auto-select best price & rating"
   - Review estimated total
   - Click "Save Schedule"

3. **Enable/Disable Schedules**:
   - Toggle schedule activation on/off
   - Edit: Click "Edit" button
   - Delete: Click "Delete" button

#### Voice Input Usage

1. **Enable Voice Mode**:
   - Click microphone icon in header
   - System will prompt for voice input

2. **Voice Commands**:
   - "Set breakfast at 8 AM"
   - "Lunch time 12 30"
   - "Order from Dominos every day"
   - All commands in English/Tamil/Hindi

#### Wallet Management

1. **Check Balance**:
   - Displayed in wallet widget
   - Current balance shows on main screen

2. **Recharge Wallet**:
   - Click "Recharge Wallet" button
   - Select amount (₹500, ₹1000, etc.)
   - Confirm recharge

3. **View Transactions**:
   - Click "Transaction History"
   - View all debits/credits with timestamps

#### Accessibility Features

1. **Enable Accessibility Mode**:
   - Click "A" button (top right)
   - Toggles high contrast + large text

2. **Adjust Text Size**:
   - Settings > Accessibility > Text Size
   - Options: Small, Medium, Large, XL

3. **Enable Voice Assistant**:
   - Click microphone icon
   - System reads all UI text aloud

4. **Use Read Aloud**:
   - All instructions and confirmations read automatically
   - Works in background

### For Developers

#### Integration with Existing Code

1. **Initialize in App**:
```typescript
import { AutoOrderScheduler } from './components/AutoOrderScheduler';
import { initializeAutoOrderService } from './data/autoOrderBackgroundService';

// In useEffect
useEffect(() => {
  initializeAutoOrderService();
}, []);
```

2. **Access Context**:
```typescript
const { language, setLanguage, accessibilitySettings } = useApp();
```

3. **Use Price Comparison**:
```typescript
import { PriceComparisonService } from './data/serviceLayer';

const bestOption = PriceComparisonService.getBestPriceOption(platforms);
const savings = PriceComparisonService.getMaxSavings(platforms);
```

4. **Wallet Operations**:
```typescript
import { WalletService } from './data/serviceLayer';

const balance = WalletService.getBalance();
WalletService.rechargeWallet(500);
WalletService.deductFromWallet(amount, orderId);
```

#### Adding New Languages

1. **Update types.ts**:
```typescript
export type Language = 'en' | 'ta' | 'hi' | 'new_lang';
```

2. **Add translations.ts**:
```typescript
export const translations: Record<Language, Record<string, string>> = {
  new_lang: {
    'autoOrder.title': 'New Language Title',
    // ... all keys
  }
};
```

3. **Update language selector** in UI component

#### Extending Price Comparison

1. **Add new platform**:
```typescript
const platforms: PlatformPriceOption[] = [
  // ... existing
  {
    platform: 'newapp',
    platformName: 'New App',
    price: 250,
    rating: 4.8,
    // ... other fields
  }
];
```

2. **Use comparison service**:
```typescript
const comparison = PriceComparisonService.compareAllOptions(platforms);
// comparison.bestValue, cheapest, highestRated, fastest, maxSavings
```

## Data Storage

All data is stored in browser localStorage:

- **`swiggy_auto_schedules`**: Array of scheduled orders
- **`swiggy_wallet_balance`**: Current wallet balance
- **`swiggy_wallet_transactions`**: Transaction history
- **`swiggy_execution_logs`**: Auto-order execution logs
- **`swiggy_language`**: User's language preference
- **`swiggy_accessibility`**: Accessibility settings
- **`swiggy_order_history`**: Order history
- **`swiggy_user`**: User profile
- **`swiggy_cart`**: Shopping cart

## Security Considerations

1. **Wallet Balance**:
   - Always validate balance before deducting
   - Check insufficient balance and notify user
   - Maintain transaction audit log

2. **Payment Processing**:
   - Validate all amounts
   - Prevent duplicate charges
   - Log all transactions

3. **Data Privacy**:
   - Store sensitive data in localStorage (client-side)
   - No server transmission (for demo)
   - Clear data on logout

## Performance Optimization

1. **Background Service**:
   - Checks every 60 seconds (configurable)
   - Minimal CPU usage
   - Continues when tab is hidden
   - Auto-restarts on visibility change

2. **State Management**:
   - Efficient re-renders with React hooks
   - Memoized service methods
   - Debounced input handlers

3. **Accessibility**:
   - Text-to-speech API (native browser)
   - Speech recognition (native browser)
   - No external dependencies for accessibility

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| localStorage | ✅ | ✅ | ✅ | ✅ |
| Voice Input | ✅ | ✅ | ⚠️ | ✅ |
| Text-to-Speech | ✅ | ✅ | ✅ | ✅ |
| Web Workers | ✅ | ✅ | ✅ | ✅ |

## Troubleshooting

### Voice Input Not Working
- Check browser permissions for microphone
- Ensure microphone is connected
- Try in Chrome/Edge for better support

### Schedules Not Executing
- Verify wallet has sufficient balance
- Check browser console for logs
- Ensure service is running: `AutoOrderBackgroundService.getStatus()`

### Accessibility Features Not Working
- Enable JavaScript in browser settings
- Check browser text-to-speech settings
- Verify language selection

## Future Enhancements

1. **Server Integration**:
   - Backend API for persistence
   - Real-time order placement
   - Actual payment gateway integration

2. **Advanced Features**:
   - AI-based ordering suggestions
   - Dietary preference learning
   - Loyalty points integration
   - Order customization templates

3. **Social Features**:
   - Share schedules with family
   - Group ordering
   - Notification system

4. **Analytics**:
   - User behavior tracking
   - Spending analytics
   - Order history insights

## Support

For issues or feature requests:
1. Check browser console for errors
2. Review execution logs: `AutoOrderBackgroundService.getExecutionLogs()`
3. Clear localStorage and restart: `localStorage.clear()`

## License

This feature is part of the Swiggy Clone project and follows the same license.
