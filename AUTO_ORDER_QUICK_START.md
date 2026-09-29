# Auto-Order Feature - Quick Start Guide

## 🚀 Getting Started

### Step 1: Access Auto-Order Scheduler
1. Open the Swiggy application (http://localhost:3000)
2. Look for "Auto Schedule" or auto-order option in the main navigation
3. Click to open the Auto-Order Scheduler interface

### Step 2: Create Your First Schedule

#### Option A: Using Text Input (For Desktop Users)
1. Click on **Slot 1 (Breakfast Time)** card
2. A form will appear with these fields:
   - **Schedule Time**: Enter time (e.g., 08:00)
   - **Select Restaurant**: Auto-populated with current selection
   - **Frequency**: Choose "Daily" or "Weekly"
   - **Auto-select Best Price**: ✓ Checkbox enabled by default
3. **Add Items**: Select from cart (items appear automatically)
4. Review **Estimated Total**: Shows ₹X.XX
5. Click **"Save Schedule"**
6. Success! Schedule created for daily orders at 8:00 AM

#### Option B: Using Voice Input (Accessibility-Friendly)
1. Click the **microphone icon** (🎤) in the header
2. Speak your order: "Set breakfast at 8 AM" or "आठ बजे नाश्ता" (Hindi)
3. System processes voice and fills in the details
4. Verify and click "Save Schedule"
5. Done! Your voice order is scheduled

### Step 3: Set Up Other Time Slots

Repeat the process for up to 4 schedules:
- **Slot 1**: Breakfast (8:00 AM)
- **Slot 2**: Lunch (12:00 PM)
- **Slot 3**: Snack (4:00 PM)
- **Slot 4**: Dinner (8:00 PM)

### Step 4: Manage Wallet

#### Check Balance
- **Wallet Balance**: Displayed prominently at top of page
- Default balance: **₹1000**

#### Recharge Wallet
1. Click **"Recharge Wallet"** button
2. Enter amount (e.g., ₹500)
3. Click **"Recharge Now"**
4. Balance updated immediately
5. View transaction in **"Transaction History"**

### Step 5: Enable Accessibility Mode

#### For Elderly Users / Visually Impaired
1. Click **"A"** button (top right)
2. Toggles **High Contrast Mode**:
   - Dark background
   - Large white text
   - Larger buttons
   - Increased spacing

3. Click **microphone** icon for **Voice Assistant**:
   - Text-to-speech reads all content
   - Speak commands instead of typing

#### Adjust Text Size (Settings)
1. Go to **Accessibility Settings**
2. Select size:
   - 🔤 Small: Default size
   - 🔤🔤 Medium: Slightly larger
   - 🔤🔤🔤 Large: Much larger
   - 🔤🔤🔤🔤 XL: Extra large (for elderly/visually impaired)

#### Select Language
1. Dropdown shows: **English**, **Tamil**, **Hindi**
2. All UI text changes instantly
3. Voice commands work in selected language

## 📋 Daily Usage

### When Orders Execute Automatically

The system checks for due schedules **every 60 seconds**:

1. **Breakfast (8:00 AM)**
   - If enabled, order placed automatically
   - Deducted from wallet
   - Notification: "Order #SWG-123456 placed successfully"

2. **Lunch (12:00 PM)**
   - Same process as breakfast

3. **Snack (4:00 PM)**
   - Same process

4. **Dinner (8:00 PM)**
   - Same process

### Order Execution Process
```
User Sets Schedule at 8:00 AM
    ↓
System Checks at 8:00 AM (within 1 minute window)
    ↓
Compares Prices Across Platforms
    ↓
Selects Best Price + Best Rating
    ↓
Verifies Wallet Balance
    ↓
Places Order Automatically
    ↓
Deducts from Wallet
    ↓
Updates Order History
    ↓
Notification Sent
```

### Managing Your Schedules

#### View Active Schedules
- Scroll down to see all created schedules
- Green badge = **Active** (enabled)
- Gray badge = **Inactive** (disabled)

#### Edit a Schedule
1. Click **"Edit"** button on schedule card
2. Modify time, restaurant, items
3. Click **"Save Schedule"**

#### Disable Temporarily
1. Click **"Disable Schedule"** button
2. Schedule pauses (won't execute)
3. Click **"Enable Schedule"** to resume

#### Delete a Schedule
1. Click **"Delete"** button
2. Confirm deletion
3. Schedule removed permanently

## 💰 Price Comparison Example

### How Auto-Selection Works

**Your Order**: 2x Butter Chicken, 1x Naan

**Prices Across Platforms**:
```
Swiggy:    ₹350 | Rating: 4.2 | Delivery: 30 mins
Zomato:    ₹380 | Rating: 4.8 | Delivery: 25 mins
EatSure:   ₹320 | Rating: 4.0 | Delivery: 45 mins
MagicPin:  ₹400 | Rating: 3.9 | Delivery: 40 mins
```

**System Selects**: **Zomato @ ₹380** (Best balance of price & rating)

**You Save**: ₹20 compared to MagicPin

**Next Execution**: Tomorrow at 8:00 AM

## 🔊 Voice Command Examples

### English
- "Schedule order at 8 AM"
- "Set lunch for 12 noon"
- "Daily breakfast"
- "Order from Pizza Hut every day"

### Tamil (தமிழ்)
- "நான்கு மணிக்கு சாப்பாடு"
- "தினமும் காலை நேரம்"

### Hindi (हिंदी)
- "आठ बजे ऑर्डर सेट करो"
- "हर दिन दोपहर का खाना"
- "डोमिनोस से ऑर्डर करो"

## 📊 Viewing Execution Logs

### Check if Orders Executed
1. Open browser **Developer Tools** (F12)
2. Go to **Console** tab
3. Type: `AutoOrderBackgroundService.getExecutionLogs()`
4. View recent orders:
   ```
   [{
     scheduleId: "SCHEDULE_123456",
     orderId: "AUTO_ORD_123456",
     status: "success",
     timestamp: "2024-08-27T08:00:30Z",
     message: "Order placed successfully"
   }]
   ```

### Check Service Status
1. Open **Console**
2. Type: `AutoOrderBackgroundService.getStatus()`
3. View output:
   ```
   {
     isRunning: true,
     checkInterval: 60000,
     executionLogs: [...],
     lastCheck: "2024-08-27T12:30:45Z"
   }
   ```

## 🛠️ Troubleshooting

### "Insufficient Wallet Balance" Error
**Problem**: You tried to create a schedule but wallet doesn't have enough
**Solution**: 
1. Click "Recharge Wallet"
2. Enter amount (minimum ₹100)
3. Add to your estimated order cost

### Voice Input Not Working
**Problem**: Microphone button doesn't respond
**Solution**:
1. Check browser permissions (allow microphone)
2. Ensure microphone is connected
3. Use Chrome/Edge for best support
4. Fall back to text input

### Schedule Not Executing at Right Time
**Problem**: Order placed at wrong time
**Solution**:
1. Verify time entered (24-hour format: 08:00 = 8 AM)
2. Check schedule is **enabled** (green badge)
3. Ensure wallet has balance
4. Check system time in browser

### High Contrast Mode Too Dark
**Problem**: Can't see all buttons
**Solution**:
1. Click "A" button again to disable
2. Increase text size instead
3. Adjust browser zoom (Ctrl + plus)

## 📱 For Mobile Users

### Responsive Layout
- All features work on mobile
- Touch-friendly buttons
- Swipe through schedule slots
- Voice input may vary by device

### Recommended for Mobile
1. **Accessibility Mode**: Enabled by default for better touch
2. **Voice Input**: Recommended for hands-free ordering
3. **Text Size**: Set to "Large" for readability

## 🎓 Learning Path

### Beginner
1. ✅ Create 1st schedule with text input
2. ✅ Enable accessibility mode
3. ✅ Recharge wallet
4. ✅ View order history

### Intermediate
1. ✅ Create 4 different time slot schedules
2. ✅ Use voice input for scheduling
3. ✅ Edit and modify existing schedules
4. ✅ Check price comparisons

### Advanced
1. ✅ Set custom schedules (weekly, specific days)
2. ✅ Monitor execution logs
3. ✅ Analyze spending patterns
4. ✅ Use multi-language features
5. ✅ Configure accessibility for others

## 💡 Pro Tips

### Money-Saving Tips
- Set schedules for peak discount hours (7-8 AM, 12-1 PM)
- Use "Auto-select Best Price" for maximum savings
- Combine with wallet rewards programs
- Monitor price trends across platforms

### Accessibility Tips (For Elderly Users)
- Always enable High Contrast Mode
- Set text size to "Large" or "XL"
- Use voice input instead of typing
- Enable "Read Aloud" for confirmations
- Ask family members to set up initially

### Best Practices
1. **Start Small**: Create 1-2 schedules first
2. **Test First**: Verify execution for 2-3 days
3. **Monitor Wallet**: Keep ₹500+ buffer for multiple orders
4. **Review Regularly**: Check if schedules still match your needs
5. **Backup**: Screenshot important schedule details

## 🔐 Data Privacy

### Where Data Stored
- All schedules saved locally in browser
- No data sent to servers (demo version)
- Can be cleared anytime: `localStorage.clear()`

### Clear All Data
```javascript
// In browser console:
localStorage.removeItem('swiggy_auto_schedules');
localStorage.removeItem('swiggy_wallet_balance');
localStorage.removeItem('swiggy_wallet_transactions');
localStorage.removeItem('swiggy_execution_logs');
```

## 📞 Support

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Schedule not created | Check if all fields filled |
| Wallet balance stuck | Refresh page (F5) |
| Voice not recognized | Speak clearly, use microphone |
| High contrast too dark | Use text size instead |
| Orders not executing | Check wallet balance, ensure enabled |

### Debug Mode
```javascript
// Enable detailed logging
localStorage.setItem('debug_auto_orders', 'true');

// View all stored data
Object.keys(localStorage)
  .filter(k => k.includes('swiggy'))
  .forEach(k => console.log(k, localStorage.getItem(k)));
```

## 🎉 Next Steps

1. **Create Your First Schedule**: Follow Step 2 above
2. **Test Execution**: Wait for scheduled time or monitor logs
3. **Invite Others**: Share this guide with family/friends
4. **Provide Feedback**: Report issues or suggest improvements

---

**Happy Auto-Ordering! 🍔🍜🍕**

*Auto-Order Scheduler © 2024 - Making food ordering effortless*
