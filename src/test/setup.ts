import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.speechSynthesis and SpeechRecognition for jsdom environment
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'speechSynthesis', {
    writable: true,
    value: {
      getVoices: () => [],
      speak: vi.fn(),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      paused: false,
      speaking: false,
      onvoiceschanged: null,
    },
  });

  Object.defineProperty(window, 'SpeechRecognition', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      abort: vi.fn(),
    })),
  });

  Object.defineProperty(window, 'webkitSpeechRecognition', {
    writable: true,
    value: (window as any).SpeechRecognition,
  });
}
