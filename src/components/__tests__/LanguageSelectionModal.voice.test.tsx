import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { LanguageSelectionModal } from '../LanguageSelectionModal';
import { SpeechController } from '../../services/speechController';

const mockHandleLanguageSelected = vi.fn();
const mockSetLanguage = vi.fn();
const mockShowToast = vi.fn();

vi.mock('../../services/speechController', () => ({
  SpeechController: {
    isSupported: () => true,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    releaseMic: vi.fn(),
    cancelSpeech: vi.fn(),
    requestMic: vi.fn(),
    selectBestVoice: vi.fn((lang?: string) => ({
      voice: { name: 'Native Voice', lang: lang === 'ta' ? 'ta-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN' },
      isExactMatch: true
    })),
    speak: vi.fn((text?: string, lang?: string, onEnd?: () => void) => {
      if (onEnd) onEnd();
    }),
    hasUserGesture: vi.fn(() => false),
    notifyUserGesture: vi.fn(),
  }
}));

vi.mock('../../context/AppContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../context/AppContext')>();
  return {
    ...actual,
    useApp: () => ({
      entryStep: 'language',
      isLanguageModalOpen: true,
      setIsLanguageModalOpen: vi.fn(),
      handleLanguageSelected: mockHandleLanguageSelected,
      setLanguage: mockSetLanguage,
      language: 'en',
      speakText: vi.fn((text, onEnd) => { if (onEnd) onEnd(); }),
      t: (key: string) => key,
      showToast: mockShowToast,
      accessibilitySettings: { highContrast: false },
      currentUser: { id: 'user_001', name: 'Test User' },
    })
  };
});

describe('LanguageSelectionModal Voice RTL Tests (Step 3 Requirements)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('1. First gesture starts prompts without clicking tap-to-start button', () => {
    vi.mocked(SpeechController.hasUserGesture).mockReturnValueOnce(false);

    render(<LanguageSelectionModal />);

    // Before any user interaction, speak was not called
    expect(SpeechController.speak).not.toHaveBeenCalled();

    // Trigger a window pointerdown gesture anywhere on page
    act(() => {
      window.dispatchEvent(new Event('pointerdown'));
    });

    // Sequential prompts start automatically on first gesture
    expect(SpeechController.speak).toHaveBeenCalledWith(
      expect.stringContaining('Please say your language'),
      'en',
      expect.any(Function),
      expect.any(Function),
      'language_selection'
    );
  });

  test('2. Mic opens after TTS even if TTS throws an error or times out', () => {
    vi.useFakeTimers();

    // Mock speak to simulate a TTS error / fallback on English
    vi.mocked(SpeechController.speak).mockImplementation((text, lang, onEnd, onToastFallback) => {
      if (lang === 'en' && onToastFallback) {
        // Trigger fallback/error on English
        onToastFallback('TTS blocked');
      } else if (onEnd) {
        onEnd();
      }
    });

    render(<LanguageSelectionModal />);

    const tapBtn = screen.getByTestId('btn-tap-start-voice');
    fireEvent.click(tapBtn);

    // Fast-forward past safety 300ms timer
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Mic request should still open despite English TTS error
    expect(SpeechController.requestMic).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'language_selection',
        continuous: false,
        interimResults: true,
        maxAlternatives: 5
      })
    );

    vi.useRealTimers();
  });

  test('3. Restart rotation: auto-restarts with locale rotation en-IN -> ta-IN -> hi-IN', () => {
    vi.useFakeTimers();
    vi.mocked(SpeechController.speak).mockImplementation((text, lang, onEnd) => {
      if (onEnd) onEnd();
    });

    render(<LanguageSelectionModal />);

    const tapBtn = screen.getByTestId('btn-tap-start-voice');
    fireEvent.click(tapBtn);

    act(() => {
      vi.advanceTimersByTime(400);
    });

    const mockRequestMic = vi.mocked(SpeechController.requestMic);
    expect(mockRequestMic).toHaveBeenCalled();

    // Attempt 0 should be en-IN
    expect(mockRequestMic.mock.calls[0][0].overrideLocale).toBe('en-IN');

    // Simulate silence / natural end with no speech on attempt 0
    act(() => {
      mockRequestMic.mock.calls[0][0].onEnd?.();
      vi.advanceTimersByTime(500);
    });

    // Attempt 1 should rotate to ta-IN
    expect(mockRequestMic.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(mockRequestMic.mock.calls[1][0].overrideLocale).toBe('ta-IN');

    // Simulate silence / natural end with no speech on attempt 1
    act(() => {
      mockRequestMic.mock.calls[1][0].onEnd?.();
      vi.advanceTimersByTime(500);
    });

    // Attempt 2 should rotate to hi-IN
    expect(mockRequestMic.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(mockRequestMic.mock.calls[2][0].overrideLocale).toBe('hi-IN');

    vi.useRealTimers();
  });

  test('4. Spoken "tamizh" selects Tamil, speaks confirmation in Tamil, and proceeds', () => {
    vi.useFakeTimers();
    vi.mocked(SpeechController.speak).mockImplementation((text, lang, onEnd) => {
      if (onEnd) onEnd();
    });

    render(<LanguageSelectionModal />);

    const tapBtn = screen.getByTestId('btn-tap-start-voice');
    fireEvent.click(tapBtn);

    act(() => {
      vi.advanceTimersByTime(400);
    });

    const mockRequestMic = vi.mocked(SpeechController.requestMic);
    const micOptions = mockRequestMic.mock.calls[0][0];

    // Deliver user speech "tamizh"
    act(() => {
      micOptions.onResult('tamizh', true, ['tamizh']);
      vi.advanceTimersByTime(100);
    });

    // Spoken confirmation should be in Tamil
    expect(SpeechController.speak).toHaveBeenCalledWith(
      'தமிழ் மொழி தேர்ந்தெடுக்கப்பட்டது.',
      'ta',
      expect.any(Function),
      undefined,
      'language_selection'
    );

    // Fast-forward timer to advance
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockHandleLanguageSelected).toHaveBeenCalledWith('ta');
    vi.useRealTimers();
  });

  test('5. Echo of app own prompt is ignored and does not select', () => {
    vi.useFakeTimers();
    vi.mocked(SpeechController.speak).mockImplementation((text, lang, onEnd) => {
      if (onEnd) onEnd();
    });

    render(<LanguageSelectionModal />);

    const tapBtn = screen.getByTestId('btn-tap-start-voice');
    fireEvent.click(tapBtn);

    act(() => {
      vi.advanceTimersByTime(400);
    });

    const mockRequestMic = vi.mocked(SpeechController.requestMic);
    const micOptions = mockRequestMic.mock.calls[0][0];

    // Send the app's exact prompt echo as transcript
    act(() => {
      micOptions.onResult(
        'Please say your language: English, Tamil or Hindi',
        true,
        ['Please say your language: English, Tamil or Hindi']
      );
      vi.advanceTimersByTime(100);
    });

    // Confirmation must NOT be spoken, handleLanguageSelected must NOT be called
    expect(mockHandleLanguageSelected).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  test('6. User answer "Tamil" or "English" is NOT ignored and is properly selected', () => {
    vi.useFakeTimers();
    vi.mocked(SpeechController.speak).mockImplementation((text, lang, onEnd) => {
      if (onEnd) onEnd();
    });

    render(<LanguageSelectionModal />);

    const tapBtn = screen.getByTestId('btn-tap-start-voice');
    fireEvent.click(tapBtn);

    act(() => {
      vi.advanceTimersByTime(400);
    });

    const mockRequestMic = vi.mocked(SpeechController.requestMic);
    const micOptions = mockRequestMic.mock.calls[0][0];

    // Send user answer "English"
    act(() => {
      micOptions.onResult('English', true, ['English']);
      vi.advanceTimersByTime(100);
    });

    expect(SpeechController.speak).toHaveBeenCalledWith(
      'English language selected.',
      'en',
      expect.any(Function),
      undefined,
      'language_selection'
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockHandleLanguageSelected).toHaveBeenCalledWith('en');
    vi.useRealTimers();
  });
});
