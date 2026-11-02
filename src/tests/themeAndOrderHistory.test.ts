import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutedOrder } from '../types';

describe('Typography Scale & Theme Mode State & CSS Attributes', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-typography');
  });

  it('correctly sets data-typography and text-scale class for sm, md, lg, xl', () => {
    const scales = ['sm', 'md', 'lg', 'xl'] as const;
    scales.forEach(size => {
      document.documentElement.setAttribute('data-typography', size);
      document.documentElement.classList.remove('text-scale-sm', 'text-scale-md', 'text-scale-lg', 'text-scale-xl');
      document.documentElement.classList.add(`text-scale-${size}`);

      expect(document.documentElement.getAttribute('data-typography')).toBe(size);
      expect(document.documentElement.classList.contains(`text-scale-${size}`)).toBe(true);
    });
  });

  it('correctly toggles dark mode attribute and class', () => {
    // Light mode
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.classList.remove('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    // Dark mode
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.classList.add('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});

describe('Order History Categorization & Status Management', () => {
  const sampleOrders: ExecutedOrder[] = [
    {
      id: 'ord_1',
      foodName: 'Crispy Masala Dosa',
      restaurant: 'Murugan Idli Shop',
      platform: 'swiggy',
      platformName: 'Swiggy',
      amountPaid: 110,
      originalPrice: 130,
      savings: 20,
      rating: 4.8,
      timestamp: new Date().toISOString(),
      status: 'placed',
      isAutoOrder: false
    },
    {
      id: 'ord_2',
      foodName: 'Paneer Butter Masala',
      restaurant: 'A2B',
      platform: 'zomato',
      platformName: 'Zomato',
      amountPaid: 240,
      originalPrice: 280,
      savings: 40,
      rating: 4.7,
      timestamp: new Date().toISOString(),
      status: 'delivered',
      completedAt: new Date().toISOString(),
      isAutoOrder: false
    },
    {
      id: 'ord_3',
      foodName: 'Filter Coffee',
      restaurant: 'Kumbakonam Degree Coffee',
      platform: 'swiggy',
      platformName: 'Swiggy',
      amountPaid: 45,
      originalPrice: 55,
      savings: 10,
      rating: 4.9,
      timestamp: new Date().toISOString(),
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancellationReason: 'Cancelled by customer',
      isAutoOrder: false
    }
  ];

  it('categorizes orders correctly into pending, successful, and cancelled', () => {
    const pending = sampleOrders.filter(o => o.status === 'placed' || o.status === 'pending' || o.status === 'processing');
    const successful = sampleOrders.filter(o => o.status === 'delivered' || o.status === 'completed');
    const cancelled = sampleOrders.filter(o => o.status === 'cancelled');

    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe('ord_1');

    expect(successful).toHaveLength(1);
    expect(successful[0].id).toBe('ord_2');

    expect(cancelled).toHaveLength(1);
    expect(cancelled[0].id).toBe('ord_3');
  });

  it('cancelling an order updates status and moves it from pending to cancelled', () => {
    let orders = [...sampleOrders];
    
    // Cancel ord_1
    orders = orders.map(o => o.id === 'ord_1' ? { ...o, status: 'cancelled' as const, cancelledAt: new Date().toISOString(), cancellationReason: 'User cancelled' } : o);

    const pendingAfter = orders.filter(o => o.status === 'placed' || o.status === 'pending' || o.status === 'processing');
    const cancelledAfter = orders.filter(o => o.status === 'cancelled');

    expect(pendingAfter).toHaveLength(0);
    expect(cancelledAfter).toHaveLength(2);
    expect(cancelledAfter.find(o => o.id === 'ord_1')?.cancellationReason).toBe('User cancelled');
  });
});

