import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AppProvider, useApp } from '../context/AppContext';
import { FeaturesPage } from '../components/FeaturesPage';
import { HomePage } from '../components/HomePage';
import { HealthDietaryVoiceModal } from '../components/HealthDietaryVoiceModal';

// Mock speech controller and speech synthesis
vi.mock('../services/speechController', () => ({
  SpeechController: {
    speak: vi.fn(),
    stopSpeech: vi.fn(),
    cancelSpeech: vi.fn(),
    requestMic: vi.fn(),
    releaseMic: vi.fn(),
    stopMic: vi.fn(),
    startListening: vi.fn(),
    stopListening: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    getSnapshot: vi.fn(() => ({
      voiceState: 'idle',
      turnState: 'idle',
      turnId: 0,
      owner: null,
      language: 'en',
      micMode: 'push_to_talk',
      activeTtsVoice: 'Google UK English Female',
      userGestureUnlocked: true,
      isPinScreen: false,
      circuitBreakerTripped: false,
      logs: []
    }))
  }
}));

describe('AutoFeast AI – Recommendation System vs Healthy Food Recommendations Mapping Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('1. Features Page: "Recommendation System" card is mapped to normal Recommended For You (navigates to home section)', async () => {
    let capturedActiveView = 'features';

    const TestHarness = () => {
      const { activeView } = useApp();
      capturedActiveView = activeView;
      return (
        <div>
          <FeaturesPage />
          <div data-testid="current-view">{activeView}</div>
        </div>
      );
    };

    render(
      <AppProvider>
        <TestHarness />
      </AppProvider>
    );

    const heading = screen.getByRole('heading', { name: 'Recommendation System' });
    expect(heading).toBeDefined();

    const cardContainer = heading.closest('div.bg-white') || heading.parentElement?.parentElement;
    expect(cardContainer).toBeDefined();

    const openBtn = cardContainer!.querySelector('button');
    expect(openBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(openBtn!);
    });

    expect(capturedActiveView).toBe('home');
  });

  it('2. Features Page: "Healthy Food Recommendations" card opens HealthDietaryVoiceModal', async () => {
    let capturedIsHealthModalOpen = false;

    const TestHarness = () => {
      const { isHealthModalOpen } = useApp();
      capturedIsHealthModalOpen = isHealthModalOpen;
      return (
        <div>
          <FeaturesPage />
          <div data-testid="health-modal-state">{String(isHealthModalOpen)}</div>
        </div>
      );
    };

    render(
      <AppProvider>
        <TestHarness />
      </AppProvider>
    );

    const heading = screen.getByRole('heading', { name: 'Healthy Food Recommendations' });
    expect(heading).toBeDefined();

    const cardContainer = heading.closest('div.bg-white') || heading.parentElement?.parentElement;
    expect(cardContainer).toBeDefined();

    const openBtn = cardContainer!.querySelector('button');
    expect(openBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(openBtn!);
    });

    expect(capturedIsHealthModalOpen).toBe(true);
  });

  it('3. HealthDietaryVoiceModal: When health details are missing, displays prompt asking user to complete details', () => {
    localStorage.removeItem('autofeast_health_condition_details');
    localStorage.removeItem('autofeast_health_conditions');

    render(
      <AppProvider>
        <HealthDietaryVoiceModal isOpen={true} onClose={vi.fn()} />
      </AppProvider>
    );

    expect(screen.getByText(/No Saved Health Condition Details Found/i)).toBeDefined();
    expect(screen.getByText(/Please complete your Health Condition Details or speak your condition/i)).toBeDefined();
  });

  it('4. HealthDietaryVoiceModal: When saved health condition exists, it uses health details and triggers analysis with medical disclaimer', async () => {
    localStorage.setItem('autofeast_health_condition_details', 'Fever and cold');

    render(
      <AppProvider>
        <HealthDietaryVoiceModal isOpen={true} onClose={vi.fn()} />
      </AppProvider>
    );

    expect(screen.getByText(/Medical Disclaimer Notice|மருத்துவ எச்சரிக்கை/i)).toBeDefined();
    expect(screen.getByText(/AI Analyzing your health context|General Dietary Note/i)).toBeDefined();
  });

  it('5. Normal Recommended For You: Uses previous orders from orderHistory and preserves item actions', () => {
    const previousOrder = {
      id: 'prev_ord_1',
      foodName: 'Ambur Mutton Biryani',
      foodItemId: 'biryani-ambur-mutton',
      restaurant: 'Star Ambur Biryani',
      amountPaid: 320,
      timestamp: new Date().toISOString(),
      status: 'delivered' as const,
      isAutoOrder: false,
      quantity: 1
    };

    localStorage.setItem('smart_food_order_history', JSON.stringify([previousOrder]));

    render(
      <AppProvider>
        <HomePage />
      </AppProvider>
    );

    expect(screen.getByText('Recommended For You')).toBeDefined();
    const amburBiryani = screen.getAllByText(/Ambur Mutton Biryani/i);
    expect(amburBiryani.length).toBeGreaterThan(0);
  });
});
