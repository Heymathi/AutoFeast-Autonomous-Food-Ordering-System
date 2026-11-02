import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AppProvider, useApp } from '../context/AppContext';
import { OrderHistoryModal } from '../components/OrderHistoryModal';
import { FeaturesPage } from '../components/FeaturesPage';
import { UserProfileDropdown } from '../components/UserProfileDropdown';
import { AutoOrderBackgroundService } from '../services/autoOrderBackgroundService';
import { ExecutedOrder } from '../types';

describe('AutoFeast AI - Order History Navigation, Status Filtering & Cancellation Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  const sampleCorruptedAndValidOrders: any[] = [
    {
      id: 'ord_pending_1',
      foodName: 'Paneer Butter Masala',
      restaurant: 'A2B',
      platform: 'swiggy',
      platformName: 'Swiggy',
      amountPaid: 220,
      originalPrice: 250,
      savings: 30,
      rating: 4.8,
      timestamp: new Date().toISOString(),
      status: 'placed',
      isAutoOrder: false,
      quantity: 1
    },
    {
      id: 'ord_successful_1',
      foodName: 'Ghee Roast Dosa',
      restaurant: 'Saravana Bhavan',
      platform: 'zomato',
      platformName: 'Zomato',
      amountPaid: 140,
      originalPrice: 160,
      savings: 20,
      rating: 4.9,
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      completedAt: new Date(Date.now() - 1800000).toISOString(),
      status: 'delivered',
      isAutoOrder: false,
      quantity: 1
    },
    {
      id: 'ord_successful_null_fields',
      foodName: 'Filter Coffee',
      restaurant: 'Degree Coffee',
      platform: 'swiggy',
      platformName: null,
      amountPaid: null, // Null to test .toFixed() safety!
      originalPrice: null,
      savings: null,
      rating: null,
      timestamp: null,
      completedAt: null,
      status: 'completed',
      isAutoOrder: false,
      quantity: null
    },
    {
      id: 'ord_cancelled_1',
      foodName: 'Veg Biryani',
      restaurant: 'Bawarchi Biryani',
      platform: 'eatsure',
      platformName: 'EatSure',
      amountPaid: 210,
      originalPrice: 240,
      savings: 30,
      rating: 4.6,
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      cancelledAt: new Date(Date.now() - 3600000).toISOString(),
      cancellationReason: 'Cancelled by customer',
      status: 'cancelled',
      isAutoOrder: false,
      quantity: 1
    }
  ];

  it('1. Features Page card is titled "Order History" and navigates to orders view (does NOT open cart)', () => {
    let capturedActiveView = '';

    const TestFeaturesConsumer = () => {
      const { activeView, isScheduleCartModalOpen } = useApp();
      capturedActiveView = activeView;
      return (
        <div>
          <FeaturesPage />
          <div data-testid="cart-modal-state">{String(isScheduleCartModalOpen)}</div>
        </div>
      );
    };

    render(
      <AppProvider>
        <TestFeaturesConsumer />
      </AppProvider>
    );

    // Verify card title is exactly "Order History", NOT "Cart & Order History"
    expect(screen.getByText('Order History')).toBeDefined();
    expect(screen.queryByText('Cart & Order History')).toBeNull();

    // Click "Open" under Order History card
    const orderHistoryHeading = screen.getByText('Order History');
    const orderHistoryCard = orderHistoryHeading.closest('div.bg-white') || orderHistoryHeading.parentElement?.parentElement;
    const openBtn = orderHistoryCard?.querySelector('button');
    expect(openBtn).toBeDefined();

    fireEvent.click(openBtn!);

    // Verify view changed to 'orders' and cart modal remains false
    expect(capturedActiveView).toBe('orders');
    expect(screen.getByTestId('cart-modal-state').textContent).toBe('false');
  });

  it('2. UserProfileDropdown menu item opens Order History view', () => {
    let capturedActiveView = '';

    const TestProfileConsumer = () => {
      const { activeView } = useApp();
      capturedActiveView = activeView;
      return <UserProfileDropdown />;
    };

    render(
      <AppProvider>
        <TestProfileConsumer />
      </AppProvider>
    );

    // Open dropdown button
    const profileTrigger = screen.getByLabelText(/user profile and account menu/i);
    fireEvent.click(profileTrigger);

    // Click "Order History"
    const orderHistoryBtn = screen.getByText(/order history/i);
    fireEvent.click(orderHistoryBtn);

    expect(capturedActiveView).toBe('orders');
  });

  it('3. AutoOrderBackgroundService safely normalizes corrupted/null fields without throwing .toFixed() error', () => {
    localStorage.setItem('smart_food_order_history', JSON.stringify(sampleCorruptedAndValidOrders));

    const normalized = AutoOrderBackgroundService.getOrderHistory();
    expect(normalized).toHaveLength(4);

    // Verify null amountPaid is converted to 0 number
    const nullOrder = normalized.find(o => o.id === 'ord_successful_null_fields');
    expect(nullOrder).toBeDefined();
    expect(typeof nullOrder?.amountPaid).toBe('number');
    expect(nullOrder?.amountPaid).toBe(0);
    expect(nullOrder?.amountPaid.toFixed(0)).toBe('0');
    expect(nullOrder?.quantity).toBe(1);
    expect(nullOrder?.status).toBe('delivered');
  });

  it('4. Tab navigation renders Pending, Successful (even with null fields), and Cancelled without crashing', () => {
    localStorage.setItem('smart_food_order_history', JSON.stringify(sampleCorruptedAndValidOrders));

    render(
      <AppProvider>
        <OrderHistoryModal />
      </AppProvider>
    );

    // Verify Pending tab is active initially
    expect(screen.getByRole('button', { name: /^pending/i })).toBeDefined();
    expect(screen.getByText('Paneer Butter Masala')).toBeDefined();

    // Click "Successful" tab - should NOT crash with Cannot read properties of null (reading 'toFixed')
    const successfulTab = screen.getByRole('button', { name: /^successful/i });
    fireEvent.click(successfulTab);

    // Verify completed order records are displayed
    expect(screen.getByText('Ghee Roast Dosa')).toBeDefined();
    expect(screen.getByText('Filter Coffee')).toBeDefined(); // Order with null fields renders safely!

    // Click "Cancelled" tab
    const cancelledTab = screen.getByRole('button', { name: /^cancelled/i });
    fireEvent.click(cancelledTab);

    // Verify cancelled order is displayed
    expect(screen.getByText('Veg Biryani')).toBeDefined();
    expect(screen.getByText(/cancelled & refunded/i)).toBeDefined();
  });

  it('5. Cancelling a pending order moves it automatically to Cancelled tab and persists', async () => {
    // Setup 1 pending order
    localStorage.setItem('smart_food_order_history', JSON.stringify([sampleCorruptedAndValidOrders[0]]));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <AppProvider>
        <OrderHistoryModal />
      </AppProvider>
    );

    // Pending tab has 1 order
    expect(screen.getByText('Paneer Butter Masala')).toBeDefined();
    const cancelBtn = screen.getByRole('button', { name: /^cancel$/i });

    // Click Cancel
    await act(async () => {
      fireEvent.click(cancelBtn);
    });

    // Pending tab now shows empty state
    expect(screen.getByText(/you have no pending orders/i)).toBeDefined();

    // Click Cancelled tab
    const cancelledTab = screen.getByRole('button', { name: /^cancelled/i });
    fireEvent.click(cancelledTab);

    // Order is now in Cancelled tab
    expect(screen.getByText('Paneer Butter Masala')).toBeDefined();
    expect(screen.getByText(/cancelled & refunded/i)).toBeDefined();

    // Verify persistence in localStorage
    const saved = AutoOrderBackgroundService.getOrderHistory();
    const cancelledRecord = saved.find(o => o.id === 'ord_pending_1');
    expect(cancelledRecord?.status).toBe('cancelled');
    expect(cancelledRecord?.cancelledAt).toBeDefined();
  });

  it('6. Bill details breakdown toggles open and renders all financial fields safely', () => {
    localStorage.setItem('smart_food_order_history', JSON.stringify([sampleCorruptedAndValidOrders[0]]));

    render(
      <AppProvider>
        <OrderHistoryModal />
      </AppProvider>
    );

    const breakdownBtn = screen.getByRole('button', { name: /view bill breakdown/i });
    expect(breakdownBtn).toBeDefined();

    fireEvent.click(breakdownBtn);

    // Verify Item Price, Subtotal, Delivery Fee, Platform Fee, GST, Grand Total
    expect(screen.getByText('Item Price')).toBeDefined();
    expect(screen.getByText('Subtotal (1 item)')).toBeDefined();
    expect(screen.getByText('Delivery Fee')).toBeDefined();
    expect(screen.getByText('Platform Fee')).toBeDefined();
    expect(screen.getByText('GST (5%)')).toBeDefined();
    expect(screen.getByText('Grand Total:')).toBeDefined();
  });
});
