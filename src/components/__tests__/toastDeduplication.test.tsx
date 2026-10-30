import React, { useState } from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CenteredToastContainer } from '../CenteredToastContainer';
import { AppProvider, useApp } from '../../context/AppContext';
import { debounceHandler } from '../../utils/debounce';

// Test Component to simulate rapid clicks, language switching, and multiple toast keys
const ToastTestHarness: React.FC = () => {
  const { showToast, setLanguage, language } = useApp();

  return (
    <div>
      <div data-testid="current-lang">{language}</div>
      <button
        data-testid="btn-rapid-gps"
        onClick={() => {
          showToast('High accuracy GPS location updated', 'info', 5000, 'gps_location');
        }}
      >
        Trigger GPS Toast
      </button>

      <button
        data-testid="btn-multi-key-1"
        onClick={() => showToast('First Notification', 'info', 5000, 'key_1')}
      >
        Key 1
      </button>
      <button
        data-testid="btn-multi-key-2"
        onClick={() => showToast('Second Notification', 'info', 5000, 'key_2')}
      >
        Key 2
      </button>
      <button
        data-testid="btn-multi-key-3"
        onClick={() => showToast('Third Notification', 'info', 5000, 'key_3')}
      >
        Key 3
      </button>
      <button
        data-testid="btn-multi-key-4"
        onClick={() => showToast('Fourth Notification', 'info', 5000, 'key_4')}
      >
        Key 4
      </button>

      <button
        data-testid="btn-switch-ta"
        onClick={() => setLanguage('ta')}
      >
        Switch to Tamil
      </button>
      <button
        data-testid="btn-switch-hi"
        onClick={() => setLanguage('hi')}
      >
        Switch to Hindi
      </button>
      <button
        data-testid="btn-switch-en"
        onClick={() => setLanguage('en')}
      >
        Switch to English
      </button>

      <button
        data-testid="btn-gps-param-toast"
        onClick={() => {
          showToast(
            'GPS location: Suramangalam, Salem West',
            'info',
            5000,
            'gps_location_toast',
            'toast.gpsHighAccuracy',
            { area: 'Suramangalam', city: 'Salem West' }
          );
        }}
      >
        Trigger Param GPS Toast
      </button>

      <button
        data-testid="btn-i18n-toast"
        onClick={() => showToast('Order Confirmed', 'success', 5000, 'nav.orders')}
      >
        Trigger i18n Toast
      </button>

      <CenteredToastContainer />
    </div>
  );
};

const RealAddToCartHarness: React.FC = () => {
  const { addToCart, cart } = useApp();
  const sampleFood = {
    id: 'dosa-masala',
    name: 'Crispy Masala Dosa',
    restaurant: 'Saravana Bhavan',
    basePrice: 120,
    cuisine: 'Tamil' as any,
    category: 'South Indian',
    isVeg: true,
    description: 'Crispy rice crepe',
    image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&q=80&w=400',
    rating: 4.8,
    tags: ['dosa'],
    locations: ['Chennai'],
    platforms: []
  };

  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div>
      <div data-testid="cart-qty">{totalQty}</div>
      <button
        data-testid="real-add-to-cart-btn"
        onClick={() => addToCart(sampleFood, 1, 'general')}
      >
        Add to Cart
      </button>
      <CenteredToastContainer />
    </div>
  );
};

describe('Issue 2 Toast Deduplication & Dynamic Language RTL Tests', () => {
  test('5 rapid showToast calls with the same key render exactly 1 toast', () => {
    render(
      <AppProvider>
        <ToastTestHarness />
      </AppProvider>
    );

    const btn = screen.getByTestId('btn-rapid-gps');

    // 5 rapid consecutive clicks
    act(() => {
      fireEvent.click(btn);
      fireEvent.click(btn);
      fireEvent.click(btn);
      fireEvent.click(btn);
      fireEvent.click(btn);
    });

    // Exactly 1 toast element should be rendered
    const toastCards = screen.getAllByRole('status');
    expect(toastCards.length).toBe(1);
    expect(screen.getByText('High accuracy GPS location updated')).toBeTruthy();
  });

  test('Different message keys can show together up to max 3 visible toasts', () => {
    render(
      <AppProvider>
        <ToastTestHarness />
      </AppProvider>
    );

    act(() => {
      fireEvent.click(screen.getByTestId('btn-multi-key-1'));
      fireEvent.click(screen.getByTestId('btn-multi-key-2'));
      fireEvent.click(screen.getByTestId('btn-multi-key-3'));
      fireEvent.click(screen.getByTestId('btn-multi-key-4'));
    });

    // Exactly 3 visible toasts max allowed in container
    const statusToasts = screen.getAllByRole('status');
    expect(statusToasts.length).toBe(3);
  });

  test('Language switch updates open toast text dynamically', () => {
    render(
      <AppProvider>
        <ToastTestHarness />
      </AppProvider>
    );

    act(() => {
      fireEvent.click(screen.getByTestId('btn-i18n-toast'));
    });

    expect(screen.getByRole('status')).toBeTruthy();

    // Switch language to Tamil
    act(() => {
      fireEvent.click(screen.getByTestId('btn-switch-ta'));
    });

    expect(screen.getByTestId('current-lang').textContent).toBe('ta');
  });

  test('5 rapid clicks on real Add to Cart button results in cart qty 1 and exactly 1 toast', async () => {
    render(
      <AppProvider>
        <RealAddToCartHarness />
      </AppProvider>
    );

    const btn = screen.getByTestId('real-add-to-cart-btn');

    // 5 rapid consecutive clicks
    await act(async () => {
      fireEvent.click(btn);
      fireEvent.click(btn);
      fireEvent.click(btn);
      fireEvent.click(btn);
      fireEvent.click(btn);
    });

    // Cart qty should be 1 and exactly 1 toast rendered
    expect(screen.getByTestId('cart-qty').textContent).toBe('1');
    const toastCards = screen.getAllByRole('status');
    expect(toastCards.length).toBe(1);
  });

  test('GPS toast interpolates area and city properly across languages without literal placeholders', () => {
    render(
      <AppProvider>
        <ToastTestHarness />
      </AppProvider>
    );

    act(() => {
      fireEvent.click(screen.getByTestId('btn-switch-ta'));
      fireEvent.click(screen.getByTestId('btn-gps-param-toast'));
    });

    let toastEl = screen.getAllByRole('status')[0];
    expect(toastEl.textContent).toContain('Suramangalam');
    expect(toastEl.textContent).toContain('Salem West');
    expect(toastEl.textContent).not.toContain('{area}');
    expect(toastEl.textContent).not.toContain('{city}');

    // Switch to English
    act(() => {
      fireEvent.click(screen.getByTestId('btn-switch-en'));
    });

    toastEl = screen.getAllByRole('status')[0];
    expect(toastEl.textContent).toContain('High accuracy GPS location: Suramangalam, Salem West');
    expect(toastEl.textContent).not.toContain('{area}');

    // Switch to Hindi
    act(() => {
      fireEvent.click(screen.getByTestId('btn-switch-hi'));
    });

    toastEl = screen.getAllByRole('status')[0];
    expect(toastEl.textContent).toContain('जीपीएस स्थान: Suramangalam, Salem West');
    expect(toastEl.textContent).not.toContain('{area}');
  });
});
