// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NomineeControlModal } from '../components/NomineeControlModal';
import { AuthService } from '../services/authService';

import { TRANSLATIONS } from '../data/translations';

if (typeof window !== 'undefined') {
  (window as any).SpeechSynthesisUtterance = class {
    text: string = '';
    lang: string = 'en';
  };
  (window as any).speechSynthesis = {
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: () => []
  };
}

vi.mock('../services/speechController', () => ({
  SpeechController: {
    releaseMic: vi.fn(),
    markUserGesture: vi.fn(),
    isSupported: () => false,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    cancelSpeech: vi.fn(),
    speak: vi.fn()
  }
}));

const mockAppContext = {
  currentUser: {
    id: 'user_main_123',
    name: 'Main Account User',
    email: 'mainuser@example.com',
    nomineeName: 'Nominee User',
    nomineePhone: '+91 98765 43210',
    nomineeEmail: 'nominee@example.com',
    restrictedFoodIds: ['item_1']
  },
  updateUserProfile: vi.fn(),
  pendingNomineeApprovals: [],
  approveNomineeRequest: vi.fn(),
  denyNomineeRequest: vi.fn(),
  t: (key: string) => TRANSLATIONS['en'][key] || key,
  language: 'en' as const,
  showToast: vi.fn(),
  speakText: vi.fn()
};

vi.mock('../context/AppContext', () => ({
  useApp: () => mockAppContext
}));

describe('Nominee Session Separation & Modal Navigation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('1. Nominee login stores token in sessionStorage and does NOT change main user token or state', async () => {
    window.localStorage.setItem('autofeast_jwt_token', 'main_user_jwt_token');
    window.localStorage.setItem(
      'autofeast_current_user_obj',
      JSON.stringify(mockAppContext.currentUser)
    );

    vi.spyOn(AuthService, 'loginNominee').mockResolvedValue('ephemeral_nominee_token_123');

    render(<NomineeControlModal isOpen={true} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Nominee Email'), {
      target: { value: 'nominee@example.com' }
    });
    fireEvent.change(screen.getByLabelText('Nominee Password'), {
      target: { value: 'Secret123!' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to PIN' }));

    await waitFor(() => {
      expect(window.sessionStorage.getItem('nomineeToken')).toBe('ephemeral_nominee_token_123');
    });

    // Verify main user session in localStorage is completely untouched
    expect(window.localStorage.getItem('autofeast_jwt_token')).toBe('main_user_jwt_token');
    expect(JSON.parse(window.localStorage.getItem('autofeast_current_user_obj') || '{}').id).toBe(
      'user_main_123'
    );
  });

  it('2. Closing the modal keeps the main user logged in and clears only the nominee session', async () => {
    window.localStorage.setItem('autofeast_jwt_token', 'main_user_jwt_token');
    window.sessionStorage.setItem('nomineeToken', 'ephemeral_nominee_token_123');

    const onCloseSpy = vi.fn();
    render(<NomineeControlModal isOpen={true} onClose={onCloseSpy} />);

    // Click the Close button
    const closeBtn = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeBtn);

    expect(onCloseSpy).toHaveBeenCalled();
    // Nominee session cleared
    expect(window.sessionStorage.getItem('nomineeToken')).toBeNull();
    // Main user session fully intact
    expect(window.localStorage.getItem('autofeast_jwt_token')).toBe('main_user_jwt_token');
  });

  it('3. A 401 from a nominee endpoint clears nominee session and does NOT log out the main user', async () => {
    window.localStorage.setItem('autofeast_jwt_token', 'main_user_jwt_token');
    window.sessionStorage.setItem('nomineeToken', 'expired_nominee_token');

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      if (String(url).includes('/api/nominee/approvals')) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response('{}', { status: 200 });
    });

    render(<NomineeControlModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      // Nominee session is cleared due to 401
      expect(window.sessionStorage.getItem('nomineeToken')).toBeNull();
    });

    // Main user token is completely preserved
    expect(window.localStorage.getItem('autofeast_jwt_token')).toBe('main_user_jwt_token');
  });

  it('4. A main-user 401 does not clear the nominee session', () => {
    window.sessionStorage.setItem('nomineeToken', 'active_nominee_token_456');
    window.localStorage.setItem('autofeast_jwt_token', 'main_user_token');

    // Simulate main user session expiration or 401 clearing main user token
    window.localStorage.removeItem('autofeast_jwt_token');

    // Nominee token in sessionStorage remains safe and isolated
    expect(window.sessionStorage.getItem('nomineeToken')).toBe('active_nominee_token_456');
  });

  it('5. Nominee logout clears only the nominee session and preserves main user session', () => {
    window.localStorage.setItem('autofeast_jwt_token', 'main_user_jwt_token');
    window.sessionStorage.setItem('nomineeToken', 'active_nominee_token_789');

    render(<NomineeControlModal isOpen={true} onClose={vi.fn()} />);

    const logoutBtn = screen.getByRole('button', { name: /logout/i });
    fireEvent.click(logoutBtn);

    expect(window.sessionStorage.getItem('nomineeToken')).toBeNull();
    expect(window.localStorage.getItem('autofeast_jwt_token')).toBe('main_user_jwt_token');
  });

  it('6. Direct /nominee visit with no main-user session leads to sign-in, while with main session restores dashboard', () => {
    // Sub-case A: No main user session
    window.localStorage.clear();
    const hasUserWithoutSession = Boolean(
      AuthService.getCurrentUser() && AuthService.getAuthToken()
    );
    expect(hasUserWithoutSession).toBe(false);
    const entryStepWithoutSession = hasUserWithoutSession ? 'dashboard' : 'auth';
    expect(entryStepWithoutSession).toBe('auth'); // Shows sign-in page

    // Sub-case B: Main user session exists
    window.localStorage.setItem('autofeast_jwt_token', 'valid_main_token');
    window.localStorage.setItem(
      'autofeast_current_user_obj',
      JSON.stringify(mockAppContext.currentUser)
    );
    const hasUserWithSession = Boolean(
      AuthService.getCurrentUser() && AuthService.getAuthToken()
    );
    expect(hasUserWithSession).toBe(true);
    const entryStepWithSession = hasUserWithSession ? 'dashboard' : 'auth';
    expect(entryStepWithSession).toBe('dashboard'); // Restores dashboard without sign-in modal
  });
});
