/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { VoiceCommandModal } from '../components/VoiceCommandModal';
import { OfflineSpeechEngine } from '../services/offlineSpeechEngine';
import { SpeechController } from '../services/speechController';

let mockAppValue: any = {};

vi.mock('../context/AppContext', () => ({
  useApp: () => mockAppValue,
}));

describe('VoiceCommandModal - Offline Voice Setup Section', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    cleanup();

    // Prevent actual audio/mic capture in jsdom during test
    vi.spyOn(SpeechController, 'startListening').mockReturnValue(true);
    vi.spyOn(SpeechController, 'stopListening').mockImplementation(() => {});
    vi.spyOn(SpeechController, 'releaseMic').mockImplementation(() => {});
    vi.spyOn(SpeechController, 'cancelSpeech').mockImplementation(() => {});
    vi.spyOn(SpeechController, 'speak').mockImplementation(() => {});

    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    mockAppValue = {
      isVoiceModalOpen: true,
      setIsVoiceModalOpen: vi.fn(),
      t: (k: string) => {
        if (k === 'voice.modalTitle') return 'Voice Assistant (Speech Input)';
        if (k === 'voice.listening') return 'Listening...';
        return k;
      },
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
      userLocation: null,
      openGuidedSearch: vi.fn(),
      checkIsItemRestrictedByNominee: vi.fn(() => false),
      handleNomineeRestrictedInterception: vi.fn()
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('1. Displays the Offline Voice Setup section and initial "Not Downloaded" status', () => {
    vi.spyOn(OfflineSpeechEngine, 'getModelStatus').mockReturnValue({
      isDownloaded: false,
      sizeMb: 39,
      modelName: 'Whisper Multilingual Tiny'
    });

    render(<VoiceCommandModal />);

    expect(screen.getByText('Offline Voice Setup')).toBeDefined();
    expect(screen.getByText('Not Downloaded')).toBeDefined();
    expect(screen.getByText(/Download Offline Voice Model/)).toBeDefined();
  });

  it('2. Clicking download button shows user consent prompt and does NOT download without consent', () => {
    vi.spyOn(OfflineSpeechEngine, 'getModelStatus').mockReturnValue({
      isDownloaded: false,
      sizeMb: 39,
      modelName: 'Whisper Multilingual Tiny'
    });
    const downloadSpy = vi.spyOn(OfflineSpeechEngine, 'downloadModelWithConsent');

    render(<VoiceCommandModal />);

    const downloadBtn = screen.getByText(/Download Offline Voice Model/);
    fireEvent.click(downloadBtn);

    // Consent prompt is now visible
    expect(screen.getByText(/Download Offline Whisper Model \(~39 MB\)\?/)).toBeDefined();
    expect(screen.getByText('Confirm & Download')).toBeDefined();
    expect(screen.getByText('Cancel')).toBeDefined();

    // downloadModelWithConsent should NOT have been called yet
    expect(downloadSpy).not.toHaveBeenCalled();
  });

  it('3. Cancelling the consent prompt dismisses it without downloading', () => {
    vi.spyOn(OfflineSpeechEngine, 'getModelStatus').mockReturnValue({
      isDownloaded: false,
      sizeMb: 39,
      modelName: 'Whisper Multilingual Tiny'
    });
    const downloadSpy = vi.spyOn(OfflineSpeechEngine, 'downloadModelWithConsent');

    render(<VoiceCommandModal />);

    fireEvent.click(screen.getByText(/Download Offline Voice Model/));
    expect(screen.getByText('Cancel')).toBeDefined();

    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByText(/Download Offline Whisper Model \(~39 MB\)\?/)).toBeNull();
    expect(downloadSpy).not.toHaveBeenCalled();
  });

  it('4. Confirming consent calls downloadModelWithConsent, shows progress and completes with ready state', async () => {
    vi.spyOn(OfflineSpeechEngine, 'getModelStatus').mockReturnValue({
      isDownloaded: false,
      sizeMb: 39,
      modelName: 'Whisper Multilingual Tiny'
    });

    const downloadSpy = vi.spyOn(OfflineSpeechEngine, 'downloadModelWithConsent').mockImplementation(async (onProgress) => {
      onProgress?.(50);
      return true;
    });

    render(<VoiceCommandModal />);

    // Open consent and confirm
    fireEvent.click(screen.getByText(/Download Offline Voice Model/));
    fireEvent.click(screen.getByText('Confirm & Download'));

    expect(downloadSpy).toHaveBeenCalledTimes(1);

    // Mock download finish
    vi.spyOn(OfflineSpeechEngine, 'getModelStatus').mockReturnValue({
      isDownloaded: true,
      sizeMb: 39,
      modelName: 'Whisper Multilingual Tiny'
    });

    await waitFor(() => {
      expect(screen.getByText(/Downloaded \/ Ready/)).toBeDefined();
      expect(screen.getByText(/Whisper offline voice model downloaded & cached successfully!/)).toBeDefined();
    });
  });

  it('5. Handles download failure gracefully with "Download Failed" badge and retry button', async () => {
    vi.spyOn(OfflineSpeechEngine, 'getModelStatus').mockReturnValue({
      isDownloaded: false,
      sizeMb: 39,
      modelName: 'Whisper Multilingual Tiny'
    });

    vi.spyOn(OfflineSpeechEngine, 'downloadModelWithConsent').mockResolvedValue(false);

    render(<VoiceCommandModal />);

    fireEvent.click(screen.getByText(/Download Offline Voice Model/));
    fireEvent.click(screen.getByText('Confirm & Download'));

    await waitFor(() => {
      expect(screen.getByText('Download Failed')).toBeDefined();
      expect(screen.getByText(/Model download failed/)).toBeDefined();
      expect(screen.getByText(/Retry Download Offline Voice Model/)).toBeDefined();
    });
  });

  it('6. Shows "Downloaded / Ready" badge when model was already cached in previous session', () => {
    vi.spyOn(OfflineSpeechEngine, 'getModelStatus').mockReturnValue({
      isDownloaded: true,
      sizeMb: 39,
      modelName: 'Whisper Multilingual Tiny'
    });

    render(<VoiceCommandModal />);

    expect(screen.getByText('Downloaded / Ready')).toBeDefined();
    expect(screen.getByText(/Offline Voice Ready \(Whisper 39 MB Cached\)/)).toBeDefined();
  });
});
