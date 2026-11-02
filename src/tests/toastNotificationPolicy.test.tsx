import '@testing-library/jest-dom';
import React from 'react';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CenteredToastContainer } from '../components/CenteredToastContainer';
import { AppProvider, useApp, isConversationalMessage } from '../context/AppContext';

const ToastPolicyHarness: React.FC = () => {
  const { showToast } = useApp();

  return (
    <div>
      {/* ── Important Events ── */}
      <button
        data-testid="btn-addr-changed"
        onClick={() => showToast('Location successfully updated to Suramangalam, Salem', 'success')}
      >
        Address Changed
      </button>

      <button
        data-testid="btn-order-placed"
        onClick={() => showToast('Your order has been placed successfully!', 'success')}
      >
        Order Placed
      </button>

      <button
        data-testid="btn-order-scheduled"
        onClick={() => showToast('Your food order has been scheduled successfully!', 'success')}
      >
        Order Scheduled
      </button>

      <button
        data-testid="btn-nominee-req"
        onClick={() => showToast('Nominee approval is required for this order.', 'warning')}
      >
        Nominee Approval
      </button>

      <button
        data-testid="btn-security-alert"
        onClick={() => showToast('⛔ Four incorrect PIN attempts. Retry becomes available in 30s.', 'error')}
      >
        Security Alert
      </button>

      <button
        data-testid="btn-wallet-txn"
        onClick={() => showToast('Successfully added ₹500 from linked HDFC Bank!', 'success')}
      >
        Wallet Txn
      </button>

      {/* ── Conversational Questions / Prompts (Must NOT show toast) ── */}
      <button
        data-testid="btn-conv-location"
        onClick={() => showToast('Can we use your live location, or do you want to change the address?')}
      >
        Conv Location
      </button>

      <button
        data-testid="btn-conv-order-or-schedule"
        onClick={() => showToast('Do you want to order now or schedule for later?')}
      >
        Conv Order Schedule
      </button>

      <button
        data-testid="btn-conv-order-dosa"
        onClick={() => showToast('Would you like to order dosa?')}
      >
        Conv Order Dosa
      </button>

      <button
        data-testid="btn-conv-biryani-type"
        onClick={() => showToast('Which type of biryani would you like?')}
      >
        Conv Biryani
      </button>

      <button
        data-testid="btn-conv-restaurant"
        onClick={() => showToast('Which restaurant would you prefer?')}
      >
        Conv Restaurant
      </button>

      <button
        data-testid="btn-conv-confirm-order"
        onClick={() => showToast('Would you like to place this order?')}
      >
        Conv Confirm
      </button>

      <button
        data-testid="btn-conv-ta"
        onClick={() => showToast('உங்களது தற்போதைய இருப்பிடத்தைப் பயன்படுத்தவா?')}
      >
        Conv Tamil
      </button>

      <button
        data-testid="btn-conv-hi"
        onClick={() => showToast('क्या आप अभी ऑर्डर करना चाहते हैं?')}
      >
        Conv Hindi
      </button>

      <CenteredToastContainer />
    </div>
  );
};

describe('Toast Notification Policy: Restrict Toasts to Important Events Only', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  test('isConversationalMessage correctly identifies conversational prompts vs important system events', () => {
    // Conversational - must return true
    expect(isConversationalMessage('Can we use your live location, or do you want to change the address?')).toBe(true);
    expect(isConversationalMessage('Do you want to order now or schedule for later?')).toBe(true);
    expect(isConversationalMessage('Would you like to order dosa?')).toBe(true);
    expect(isConversationalMessage('Which type of biryani would you like?')).toBe(true);
    expect(isConversationalMessage('Which restaurant would you prefer?')).toBe(true);
    expect(isConversationalMessage('Would you like to place this order?')).toBe(true);
    expect(isConversationalMessage('Please say a food name. I will listen once more.')).toBe(true);
    expect(isConversationalMessage('Listening stopped. Tap Retry mic or search on screen.')).toBe(true);
    expect(isConversationalMessage('I did not understand. Say one of the choices or tap a button below.')).toBe(true);

    // Multilingual conversational
    expect(isConversationalMessage('உங்களது தற்போதைய இருப்பிடத்தைப் பயன்படுத்தவா?')).toBe(true);
    expect(isConversationalMessage('இப்போது ஆர்டர் செய்யவா அல்லது திட்டமிடவா?')).toBe(true);
    expect(isConversationalMessage('क्या आप अभी ऑर्डर करना चाहते हैं?')).toBe(true);

    // Important events - must return false
    expect(isConversationalMessage('Location successfully updated to Suramangalam, Salem')).toBe(false);
    expect(isConversationalMessage('Location set to Suramangalam, Salem')).toBe(false);
    expect(isConversationalMessage('Your order has been placed successfully!')).toBe(false);
    expect(isConversationalMessage('Your food order has been scheduled successfully!')).toBe(false);
    expect(isConversationalMessage('Nominee approval is required for this order.')).toBe(false);
    expect(isConversationalMessage('⛔ Four incorrect PIN attempts. Retry becomes available in 30s.')).toBe(false);
    expect(isConversationalMessage('Successfully added ₹500 from linked HDFC Bank!')).toBe(false);
    expect(isConversationalMessage('Added Crispy Masala Dosa to cart!')).toBe(false);
  });

  test('Important Events trigger toast popups on the UI', () => {
    render(
      <AppProvider>
        <ToastPolicyHarness />
      </AppProvider>
    );

    // 1. Address Changed
    act(() => {
      fireEvent.click(screen.getByTestId('btn-addr-changed'));
    });
    expect(screen.getByText('Location successfully updated to Suramangalam, Salem')).toBeTruthy();

    // 2. Order Placed
    act(() => {
      fireEvent.click(screen.getByTestId('btn-order-placed'));
    });
    expect(screen.getByText('Your order has been placed successfully!')).toBeTruthy();

    // 3. Security Alert
    act(() => {
      fireEvent.click(screen.getByTestId('btn-security-alert'));
    });
    expect(screen.getByText('⛔ Four incorrect PIN attempts. Retry becomes available in 30s.')).toBeTruthy();
  });

  test('Ordinary conversational messages and voice assistant questions NEVER appear as toasts', () => {
    render(
      <AppProvider>
        <ToastPolicyHarness />
      </AppProvider>
    );

    // Live location question
    act(() => {
      fireEvent.click(screen.getByTestId('btn-conv-location'));
    });
    expect(screen.queryByText(/Can we use your live location/i)).toBeNull();

    // Order now or schedule question
    act(() => {
      fireEvent.click(screen.getByTestId('btn-conv-order-or-schedule'));
    });
    expect(screen.queryByText(/order now or schedule/i)).toBeNull();

    // Order dosa question
    act(() => {
      fireEvent.click(screen.getByTestId('btn-conv-order-dosa'));
    });
    expect(screen.queryByText(/Would you like to order dosa/i)).toBeNull();

    // Biryani type question
    act(() => {
      fireEvent.click(screen.getByTestId('btn-conv-biryani-type'));
    });
    expect(screen.queryByText(/Which type of biryani/i)).toBeNull();

    // Restaurant preference question
    act(() => {
      fireEvent.click(screen.getByTestId('btn-conv-restaurant'));
    });
    expect(screen.queryByText(/Which restaurant would you prefer/i)).toBeNull();

    // Confirm order question
    act(() => {
      fireEvent.click(screen.getByTestId('btn-conv-confirm-order'));
    });
    expect(screen.queryByText(/Would you like to place this order/i)).toBeNull();

    // Tamil & Hindi questions
    act(() => {
      fireEvent.click(screen.getByTestId('btn-conv-ta'));
      fireEvent.click(screen.getByTestId('btn-conv-hi'));
    });
    expect(screen.queryByText(/பயன்படுத்தவா/i)).toBeNull();
    expect(screen.queryByText(/ऑर्डर करना चाहते हैं/i)).toBeNull();
  });

  test('Toast can be dismissed manually using the dismiss button', () => {
    render(
      <AppProvider>
        <ToastPolicyHarness />
      </AppProvider>
    );

    act(() => {
      fireEvent.click(screen.getByTestId('btn-order-scheduled'));
    });
    expect(screen.getByText('Your food order has been scheduled successfully!')).toBeTruthy();

    const dismissButton = screen.getByTitle('Dismiss Notification');
    expect(dismissButton).toBeTruthy();

    act(() => {
      fireEvent.click(dismissButton);
    });

    expect(screen.queryByText('Your food order has been scheduled successfully!')).toBeNull();
  });
});

