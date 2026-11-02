import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { SpeechDebugPanel } from '../components/SpeechDebugPanel';
import { SpeechController } from '../services/speechController';

describe('SpeechDebugPanel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without throwing "Objects are not valid as a React child" error', () => {
    // Verify initial getState() returns the full diagnostic object
    const stateObj = SpeechController.getState();
    expect(typeof stateObj).toBe('object');
    expect(stateObj).toHaveProperty('voiceState');
    expect(stateObj).toHaveProperty('turnState');
    expect(stateObj).toHaveProperty('circuitBreakerTripped');

    // Rendering SpeechDebugPanel should render safely without error
    const { container } = render(<SpeechDebugPanel activeLanguage="en" />);
    expect(container).toBeDefined();

    // Verify the badge text inside span is a string ('idle'), not the full diagnostic object
    const spanBadges = container.querySelectorAll('span');
    const badgeTexts = Array.from(spanBadges).map(s => s.textContent?.trim());
    expect(badgeTexts).toContain('Speech Engine');
    expect(badgeTexts).toContain('idle');
  });

  it('updates string voiceState when SpeechController broadcasts a diagnostic object update', () => {
    const { container } = render(<SpeechDebugPanel activeLanguage="en" />);

    // Trigger state change via SpeechController internal notifyStateChange
    act(() => {
      (SpeechController as any).currentState = 'listening';
      (SpeechController as any).notifyStateChange();
    });

    const spanBadges = container.querySelectorAll('span');
    const badgeTexts = Array.from(spanBadges).map(s => s.textContent?.trim());
    expect(badgeTexts).toContain('listening');

    // Clean up
    act(() => {
      (SpeechController as any).currentState = 'idle';
      (SpeechController as any).notifyStateChange();
    });
  });
});

