/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { VoiceCommandModal } from '../components/VoiceCommandModal';
import { SpeechController } from '../services/speechController';
import { VoiceCommandParser } from '../services/voiceCommandParser';
import { DynamicFoodSearchEngine } from '../services/dynamicFoodSearch';
import { NomineeNotificationService } from '../services/nomineeNotificationService';

let mockAppValue: any = {};
let capturedListenerCallbacks: any = null;

vi.mock('../context/AppContext', () => ({
  useApp: () => mockAppValue,
}));

describe('Voice Workflow Fixes & Regression Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    cleanup();

    capturedListenerCallbacks = null;

    vi.spyOn(SpeechController, 'isSupported').mockReturnValue(true);
    vi.spyOn(SpeechController, 'startListening').mockImplementation((opts: any) => {
      capturedListenerCallbacks = opts;
      return true;
    });
    vi.spyOn(SpeechController, 'stopListening').mockImplementation(() => {});
    vi.spyOn(SpeechController, 'releaseMic').mockImplementation(() => {});
    vi.spyOn(SpeechController, 'cancelSpeech').mockImplementation(() => {});
    vi.spyOn(SpeechController, 'speak').mockImplementation((text, lang, onEnd) => {
      if (onEnd) setTimeout(onEnd, 10);
    });

    mockAppValue = {
      isVoiceModalOpen: true,
      setIsVoiceModalOpen: vi.fn(),
      t: (k: string) => k,
      language: 'en',
      executeSearch: vi.fn(),
      rechargeWallet: vi.fn(),
      setActiveView: vi.fn(),
      speakText: vi.fn(),
      showToast: vi.fn(),
      saveSchedule: vi.fn(),
      placeInstantOrder: vi.fn(),
      setVoiceDialogItem: vi.fn(),
      addToCart: vi.fn(),
      setIsScheduleCartOpen: vi.fn(),
      checkDailyOrderLimitReached: vi.fn(() => false),
      processNaturalLanguageVoiceCommand: vi.fn(),
      requestWalletBalanceReveal: vi.fn(),
      skipScheduleByVoiceCommand: vi.fn(),
      currentUser: null,
      accessibilitySettings: { highContrast: false, largeFont: false },
      userLocation: { latitude: 13.0827, longitude: 80.2707 },
      openGuidedSearch: vi.fn(),
      checkIsItemRestrictedByNominee: vi.fn(() => false),
      handleNomineeRestrictedInterception: vi.fn()
    };
  });

  // TEST A: Parotta
  it('Test A: "Add two Parotta to cart." adds exactly 2 items, does not call executeSearch in parallel', async () => {
    render(<VoiceCommandModal />);

    expect(capturedListenerCallbacks).toBeTruthy();

    // Deliver speech result from STT: onResult(text, isFinal, nBestTranscripts)
    capturedListenerCallbacks.onResult('Add two Parotta to cart.', true, ['Add two Parotta to cart.']);

    await waitFor(() => {
      // addToCart called with quantity 2
      expect(mockAppValue.addToCart).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'parotta-kothu' }),
        2,
        'voice_search'
      );
    });

    // executeSearch MUST NOT be called in parallel
    expect(mockAppValue.executeSearch).not.toHaveBeenCalled();
    // openGuidedSearch MUST NOT be called
    expect(mockAppValue.openGuidedSearch).not.toHaveBeenCalled();
    // Modal is closed after add to cart
    expect(mockAppValue.setIsVoiceModalOpen).toHaveBeenCalledWith(false);
  });

  // TEST B: Biryani
  it('Test B: "Order one Chicken Biryani." identifies Chicken Biryani and does not prompt unrelated biryani restaurants', async () => {
    render(<VoiceCommandModal />);

    expect(capturedListenerCallbacks).toBeTruthy();

    capturedListenerCallbacks.onResult('Order one Chicken Biryani.', true, ['Order one Chicken Biryani.']);

    await waitFor(() => {
      // Direct order flow invoked for Bawarchi Chicken Biryani
      expect(mockAppValue.placeInstantOrder).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'biryani-hyderabadi' })
      );
    });

    // Should NOT prompt for unrelated restaurant (e.g. Star Ambur Biryani)
    expect(screen.queryByText(/Which restaurant/i)).toBeNull();
    // Security checks preserved
    expect(mockAppValue.checkIsItemRestrictedByNominee).toHaveBeenCalledWith(
      'biryani-hyderabadi',
      expect.any(String)
    );
    // Modal closes on order
    expect(mockAppValue.setIsVoiceModalOpen).toHaveBeenCalledWith(false);
  });

  // TEST C: Dosa
  it('Test C: "Dosa." displays variety options without auto-selecting, adding to cart, or ordering', async () => {
    render(<VoiceCommandModal />);

    expect(capturedListenerCallbacks).toBeTruthy();

    capturedListenerCallbacks.onResult('Dosa.', true, ['Dosa.']);

    await waitFor(() => {
      // Status asks which variety
      expect(mockAppValue.speakText).toHaveBeenCalledWith(
        expect.stringContaining('Which variety'),
        expect.any(Function),
        'en'
      );
    });

    // Should display variety buttons: Plain Dosa, Masala Dosa, Ghee Podi Dosa
    const masalaElements = screen.getAllByText(/Crispy Masala Dosa/i);
    expect(masalaElements.length).toBeGreaterThan(0);
    expect(screen.getByText(/Golden Plain Paper Dosa/i)).toBeTruthy();
    expect(screen.getByText(/Ghee Podi Dosa/i)).toBeTruthy();

    // MUST NOT auto-add to cart or auto-order!
    expect(mockAppValue.addToCart).not.toHaveBeenCalled();
    expect(mockAppValue.placeInstantOrder).not.toHaveBeenCalled();
    expect(mockAppValue.setIsVoiceModalOpen).not.toHaveBeenCalled();

    // Clicking a variety button sets chooser for that specific variety
    const masalaBtn = masalaElements[masalaElements.length - 1];
    fireEvent.click(masalaBtn);

    // After selection, variety suggestions are cleared
    expect(screen.queryByText(/Which variety/i)).toBeNull();
  });

  // TEST D: Schedule
  it('Test D: "Schedule one Biryani for 8 PM." invokes schedule workflow with correct time and item', async () => {
    render(<VoiceCommandModal />);

    expect(capturedListenerCallbacks).toBeTruthy();

    capturedListenerCallbacks.onResult('Schedule one Biryani for 8 PM.', true, ['Schedule one Biryani for 8 PM.']);

    await waitFor(() => {
      // saveSchedule is called with the item and 20:00 (8 PM)
      expect(mockAppValue.saveSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          foodItemId: 'biryani-hyderabadi',
          time: '20:00'
        })
      );
    });

    // Nominee checks preserved
    expect(mockAppValue.checkIsItemRestrictedByNominee).toHaveBeenCalled();
    // Modal closes
    expect(mockAppValue.setIsVoiceModalOpen).toHaveBeenCalledWith(false);
  });

  // TEST E: Typed search
  it('Test E: Normal typed search still functions when voice modal is not active', () => {
    const searchRes = DynamicFoodSearchEngine.search({
      query: 'biryani',
      selectedLocation: 'All',
      language: 'en'
    });

    expect(searchRes.matchedItems.length).toBeGreaterThan(0);
    expect(searchRes.matchedItems.some(i => i.id === 'biryani-hyderabadi')).toBe(true);
  });

  // TEST F: Security verification - nominee restricted item blocked
  it('Test F: Nominee restricted item is intercepted and blocked during voice order', async () => {
    mockAppValue.checkIsItemRestrictedByNominee.mockReturnValue(true);

    render(<VoiceCommandModal />);

    capturedListenerCallbacks.onResult('Order one Chicken Biryani.', true, ['Order one Chicken Biryani.']);

    await waitFor(() => {
      // Interception handler called
      expect(mockAppValue.handleNomineeRestrictedInterception).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'biryani-hyderabadi' }),
        'instant'
      );
    });

    // Order MUST NOT be placed
    expect(mockAppValue.placeInstantOrder).not.toHaveBeenCalled();
  });
});
