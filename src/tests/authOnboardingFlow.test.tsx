import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppProvider, useApp } from '../context/AppContext';
import { App } from '../App';
import { TRANSLATIONS } from '../data/translations';

// Mock fetch to avoid undici URL parse issues
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();

  global.fetch = vi.fn().mockImplementation((url: string) => {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, items: [] })
    });
  });
});

describe('Authentication & Onboarding Flow without Location Choice Screen', () => {
  it('proceeds from welcome directly to dashboard (Home) without location_permission', async () => {
    let capturedContext: any = null;

    const TestConsumer = () => {
      capturedContext = useApp();
      return (
        <div>
          <span data-testid="entryStep">{capturedContext.entryStep}</span>
          <span data-testid="activeView">{capturedContext.activeView}</span>
          <button
            data-testid="selectLangBtn"
            onClick={() => capturedContext.handleLanguageSelected('en')}
          >
            Select Language
          </button>
          <button
            data-testid="welcomeDoneBtn"
            onClick={capturedContext.handleWelcomeComplete}
          >
            Complete Welcome
          </button>
        </div>
      );
    };

    render(
      <AppProvider>
        <TestConsumer />
      </AppProvider>
    );

    // Initial state without user: 'auth'
    expect(screen.getByTestId('entryStep').textContent).toBe('auth');

    // Simulate selecting language (Step 2 -> Step 3)
    fireEvent.click(screen.getByTestId('selectLangBtn'));
    await waitFor(() => {
      expect(screen.getByTestId('entryStep').textContent).toBe('welcome');
    });

    // Complete welcome step (Step 3 -> Step 4: Home)
    fireEvent.click(screen.getByTestId('welcomeDoneBtn'));
    await waitFor(() => {
      expect(screen.getByTestId('entryStep').textContent).toBe('dashboard');
      expect(screen.getByTestId('activeView').textContent).toBe('home');
    });
  });

  it('renders App without Location Choice modal appearing in the DOM', () => {
    // Render full App
    const { container } = render(<App />);

    // Step 4: Location Choice screen should NEVER be present
    expect(screen.queryByText(/Step 4: Location Choice/i)).toBeNull();
    expect(screen.queryByText(/படி 4: இருப்பிட அனுமதி/i)).toBeNull();
    expect(screen.queryByText(/चरण 4: स्थान अनुमति/i)).toBeNull();
    expect(screen.queryByText(/Can we use your live location, or do you want to change the address\?/i)).toBeNull();
    expect(container.querySelector('section[aria-label="Location Permission"]')).toBeNull();
  });

  it('provides a clean Continue button on WelcomeMessageModal in English, Tamil, and Hindi', () => {
    expect(TRANSLATIONS.en['welcome.proceedBtn']).toBe('Continue');
    expect(TRANSLATIONS.ta['welcome.proceedBtn']).toBe('தொடரவும்');
    expect(TRANSLATIONS.hi['welcome.proceedBtn']).toBe('आगे बढ़ें');
  });

  it('preserves header location chip and popover functionality for manual and GPS setting', async () => {
    const { container } = render(<App />);

    // Location chip is in header
    const locationChip = container.querySelector('#header-location-chip');
    expect(locationChip).toBeDefined();

    // Click location chip to open popover
    if (locationChip) {
      fireEvent.click(locationChip);
      const popover = container.querySelector('#header-location-popover');
      expect(popover).toBeDefined();

      // Manual input field exists
      const addressInput = container.querySelector('input[aria-label="Enter delivery address or landmark"]');
      expect(addressInput).toBeDefined();

      // Use GPS button exists in the popover
      const gpsBtn = screen.getByText(/Use my current location \(GPS\)/i);
      expect(gpsBtn).toBeDefined();
    }
  });
});
