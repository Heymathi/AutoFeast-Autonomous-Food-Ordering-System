import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Navbar } from '../components/Navbar';
import { AccessibilityToolbar } from '../components/AccessibilityToolbar';
import { AppProvider } from '../context/AppContext';
import { SpeechController } from '../services/speechController';
import { TRANSLATIONS } from '../data/translations';
import * as locationService from '../services/locationService';

// Mock speech controller
vi.mock('../services/speechController', () => ({
  SpeechController: {
    isSupported: vi.fn(() => true),
    speak: vi.fn((text, lang, onEnd) => {
      if (onEnd) setTimeout(onEnd, 10);
    }),
    cancelSpeech: vi.fn(),
    requestMic: vi.fn(),
    releaseMic: vi.fn(),
  }
}));

describe('Header & Accessibility Bar Layout + Location Voice Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Part A: Header & Accessibility Bar Overlap & Wrapping', () => {
    it('renders Navbar with flexible wrapping containers and no justify-evenly clipping', () => {
      const { container } = render(
        <AppProvider>
          <Navbar />
        </AppProvider>
      );

      const navGroup = container.querySelector('.header-nav-group');
      expect(navGroup).toBeDefined();
      expect(navGroup?.className).toContain('flex-wrap');
      expect(navGroup?.className).not.toContain('justify-evenly');

      const actionsGroup = container.querySelector('.header-actions-group');
      expect(actionsGroup).toBeDefined();
      expect(actionsGroup?.className).toContain('flex-wrap');
      expect(actionsGroup?.className).not.toContain('justify-evenly');

      // Verify no nav button uses flex-1 which causes equal basis squishing
      const navButtons = container.querySelectorAll('.header-nav-group button');
      navButtons.forEach(btn => {
        expect(btn.className).not.toContain('flex-1');
      });
    });

    it('renders AccessibilityToolbar with flexible wrapping containers and no justify-evenly clipping', () => {
      const { container } = render(
        <AppProvider>
          <AccessibilityToolbar />
        </AppProvider>
      );

      const a11yGroups = container.querySelectorAll('.a11y-group');
      expect(a11yGroups.length).toBeGreaterThan(0);
      a11yGroups.forEach(group => {
        expect(group.className).not.toContain('justify-evenly');
      });
    });

    it('has full translations for all location voice prompts in en, ta, hi', () => {
      const requiredKeys = [
        'location.voicePrompt',
        'location.voiceTopResults',
        'location.voiceSingleResult',
        'location.voiceConfirm',
        'location.voiceUpdated',
        'location.voiceRepeatSlowly',
        'location.voiceMicDenied',
        'location.voiceNoSpeech',
        'location.voiceMicAria'
      ];

      ['en', 'ta', 'hi'].forEach(lang => {
        const trans = TRANSLATIONS[lang as 'en' | 'ta' | 'hi'];
        requiredKeys.forEach(k => {
          expect(trans[k]).toBeDefined();
          expect(trans[k].length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Part B: Location Popover Voice Flow', () => {
    it('opens popover and shows the voice mic button with accessible label', async () => {
      render(
        <AppProvider>
          <Navbar />
        </AppProvider>
      );

      const locationChip = screen.getByRole('button', { name: /change delivery address/i });
      fireEvent.click(locationChip);

      // Verify popover is open
      const popover = screen.getByRole('dialog', { name: /edit delivery location/i });
      expect(popover).toBeDefined();

      // Verify voice mic button is present inside the popover
      const micBtn = document.getElementById('popover-voice-location-btn');
      expect(micBtn).toBeDefined();
      expect(micBtn?.getAttribute('aria-label')).toBe('Voice input for delivery address');
    });

    it('triggers speech prompt and requests mic when the voice mic button is clicked', async () => {
      render(
        <AppProvider>
          <Navbar />
        </AppProvider>
      );

      const locationChip = screen.getByRole('button', { name: /change delivery address/i });
      fireEvent.click(locationChip);

      const micBtn = document.getElementById('popover-voice-location-btn');
      expect(micBtn).toBeDefined();
      fireEvent.click(micBtn!);

      // Should speak the prompt
      expect(SpeechController.speak).toHaveBeenCalledWith(
        'Tell me the area or address for delivery, or say use my current location.',
        'en',
        expect.any(Function)
      );

      // After speech ends, it should request mic
      await waitFor(() => {
        expect(SpeechController.requestMic).toHaveBeenCalledWith(
          expect.objectContaining({
            owner: 'header_location_voice',
            language: 'en',
            continuous: false
          })
        );
      });
    });

    it('cancels speech and releases mic when popover is closed', async () => {
      render(
        <AppProvider>
          <Navbar />
        </AppProvider>
      );

      const locationChip = screen.getByRole('button', { name: /change delivery address/i });
      fireEvent.click(locationChip);

      const micBtn = document.getElementById('popover-voice-location-btn');
      fireEvent.click(micBtn!);

      // Click cancel button by ID
      const cancelBtn = document.getElementById('popover-cancel-location-btn');
      expect(cancelBtn).toBeDefined();
      fireEvent.click(cancelBtn!);

      expect(SpeechController.cancelSpeech).toHaveBeenCalled();
      expect(SpeechController.releaseMic).toHaveBeenCalledWith('header_location_voice');
    });
  });
});
