import React from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TRANSLATIONS } from '../../data/translations';
import { Language } from '../../types';
import { NomineeControlModal } from '../NomineeControlModal';

const nomineeMocks = vi.hoisted(() => ({
  language: 'en' as Language,
  t: (key: string) => key,
  loginNominee: vi.fn(),
  saveNomineeCredentials: vi.fn(),
  setNomineePin: vi.fn(),
  verifyNomineePinServer: vi.fn(),
  speakText: vi.fn()
}));

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    currentUser: {
      id: 'account-1',
      name: 'Account Holder',
      email: 'owner@example.com',
      pinHash: 'not-used',
      nomineeName: 'Nominee',
      nomineePhone: '0000000000',
      nomineeEmail: 'nominee@example.com',
      isFaceIdEnabled: false
    },
    updateUserProfile: vi.fn(),
    pendingNomineeApprovals: [],
    approveNomineeRequest: vi.fn(),
    denyNomineeRequest: vi.fn(),
    t: nomineeMocks.t,
    language: nomineeMocks.language,
    showToast: vi.fn(),
    speakText: nomineeMocks.speakText
  })
}));

vi.mock('../../services/authService', () => ({
  AuthService: {
    loginNominee: nomineeMocks.loginNominee,
    saveNomineeCredentials: nomineeMocks.saveNomineeCredentials,
    setNomineePin: nomineeMocks.setNomineePin,
    verifyNomineePinServer: nomineeMocks.verifyNomineePinServer
  }
}));

vi.mock('../../services/nomineeNotificationService', () => ({
  NomineeNotificationService: {
    toggleRestrictedItemServer: vi.fn()
  }
}));

const enterPin = (pin: string, inputName: string, target: 'verify' | 'change') => {
  for (const digit of pin) {
    const digitButtons = screen.getAllByRole('button', {
      name: `${TRANSLATIONS[nomineeMocks.language]['nominee.pinDigit']} ${digit}`
    });
    fireEvent.click(digitButtons[target === 'verify' ? 0 : 1]);
  }
  const pinInput = screen.getByLabelText(TRANSLATIONS[nomineeMocks.language][inputName]);
  expect(pinInput instanceof HTMLInputElement ? pinInput.value : undefined).toBe(pin);
};

describe('NomineeControlModal authentication flow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    nomineeMocks.language = 'en';
    nomineeMocks.t = key => TRANSLATIONS[nomineeMocks.language][key] || key;
    window.localStorage.clear();
  });

  test('requires nominee email and password before keypad PIN verification and passes the in-memory token', async () => {
    nomineeMocks.loginNominee.mockResolvedValue('ephemeral-nominee-token');
    nomineeMocks.verifyNomineePinServer.mockResolvedValue({ success: true });

    render(<NomineeControlModal isOpen onClose={vi.fn()} />);

    expect(screen.getByLabelText('Nominee Email')).not.toBeNull();
    expect(screen.getByLabelText('Nominee Password')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Verify PIN' })).toBeNull();

    fireEvent.change(screen.getByLabelText('Nominee Email'), { target: { value: 'nominee@example.com' } });
    fireEvent.change(screen.getByLabelText('Nominee Password'), { target: { value: 'secret-pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to PIN' }));

    await waitFor(() => expect(nomineeMocks.loginNominee).toHaveBeenCalledWith('nominee@example.com', 'secret-pass'));
    expect(await screen.findByRole('button', { name: 'Verify PIN' })).not.toBeNull();
    const verifyPinInput = screen.getByLabelText('4-Digit Nominee PIN');
    expect(verifyPinInput instanceof HTMLInputElement && verifyPinInput.readOnly).toBe(true);

    enterPin('2468', 'nominee.pinLabel', 'verify');
    fireEvent.click(screen.getByRole('button', { name: 'Verify PIN' }));
    await waitFor(() => {
      expect(nomineeMocks.verifyNomineePinServer).toHaveBeenCalledWith('2468', 'ephemeral-nominee-token');
    });
    expect(window.localStorage.length).toBe(0);
    expect(screen.getByText('Pending Nominee Approval Requests')).not.toBeNull();
  }, 20000);

  test('allows PIN changes only after nominee login and still requires PIN verification afterward', async () => {
    nomineeMocks.loginNominee.mockResolvedValue('ephemeral-nominee-token');
    nomineeMocks.setNomineePin.mockResolvedValue(undefined);

    render(<NomineeControlModal isOpen onClose={vi.fn()} />);

    expect(screen.queryByText('Set or change nominee PIN:')).toBeNull();
    fireEvent.change(screen.getByLabelText('Nominee Password'), { target: { value: 'secret-pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to PIN' }));

    expect(await screen.findByText('Set or change nominee PIN:')).not.toBeNull();
    const newPinInput = screen.getByLabelText('New 4-digit nominee PIN');
    expect(newPinInput instanceof HTMLInputElement && newPinInput.readOnly).toBe(true);
    enterPin('8642', 'nominee.newPinLabel', 'change');
    fireEvent.click(screen.getByRole('button', { name: 'Set Nominee Security PIN' }));

    await waitFor(() => {
      expect(nomineeMocks.setNomineePin).toHaveBeenCalledWith('8642', 'ephemeral-nominee-token');
    });
    expect(screen.getByRole('button', { name: 'Verify PIN' })).not.toBeNull();
    expect(screen.queryByText('Pending Nominee Approval Requests')).toBeNull();
  }, 20000);

  test('offers account-owner credential repair after rejected nominee login and retries login', async () => {
    nomineeMocks.loginNominee
      .mockRejectedValueOnce(Object.assign(new Error('Invalid nominee credentials'), { status: 401 }))
      .mockResolvedValueOnce('new-nominee-token');
    nomineeMocks.saveNomineeCredentials.mockResolvedValue(undefined);

    render(<NomineeControlModal isOpen onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Nominee Email'), { target: { value: 'nominee@example.com' } });
    fireEvent.change(screen.getByLabelText('Nominee Password'), { target: { value: 'NomineePass123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to PIN' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Save these credentials to this account' }));

    await waitFor(() => {
      expect(nomineeMocks.saveNomineeCredentials).toHaveBeenCalledWith('nominee@example.com', 'NomineePass123!');
      expect(nomineeMocks.loginNominee).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByRole('button', { name: 'Verify PIN' })).not.toBeNull();
  }, 20000);

  test.each([
    ['401', 'nominee.auth401'],
    ['403', 'nominee.auth403'],
    ['429', 'nominee.auth429'],
    ['503', 'nominee.auth503']
  ] as const)('localizes login HTTP %s errors in English, Tamil, and Hindi', async (status, messageKey) => {
    for (const language of ['en', 'ta', 'hi'] as const) {
      nomineeMocks.language = language;
      nomineeMocks.loginNominee.mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: Number(status) }));

      const { unmount } = render(<NomineeControlModal isOpen onClose={vi.fn()} />);
      fireEvent.change(screen.getByLabelText(TRANSLATIONS[language]['nominee.loginPasswordLabel']), {
        target: { value: 'secret-pass' }
      });
      fireEvent.click(screen.getByRole('button', { name: TRANSLATIONS[language]['nominee.loginBtn'] }));

      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toContain(TRANSLATIONS[language][messageKey]);
      });
      const alert = screen.getByRole('alert');
      expect(alert.textContent).not.toMatch(/unauthorized/i);
      unmount();
      nomineeMocks.loginNominee.mockReset();
    }
  });

  test.each([
    ['401', 'nominee.auth401'],
    ['403', 'nominee.auth403'],
    ['429', 'nominee.auth429'],
    ['503', 'nominee.auth503']
  ] as const)('localizes PIN verification HTTP %s errors in English, Tamil, and Hindi', async (status, messageKey) => {
    for (const language of ['en', 'ta', 'hi'] as const) {
      nomineeMocks.language = language;
      nomineeMocks.loginNominee.mockResolvedValue('ephemeral-nominee-token');
      nomineeMocks.verifyNomineePinServer.mockResolvedValue({
        success: false,
        status: Number(status),
        locked: Number(status) === 429
      });

      const { unmount } = render(<NomineeControlModal isOpen onClose={vi.fn()} />);
      fireEvent.change(screen.getByLabelText(TRANSLATIONS[language]['nominee.loginPasswordLabel']), {
        target: { value: 'secret-pass' }
      });
      fireEvent.click(screen.getByRole('button', { name: TRANSLATIONS[language]['nominee.loginBtn'] }));
      await screen.findByRole('button', { name: TRANSLATIONS[language]['nominee.verifyPinBtn'] });
      enterPin('2468', 'nominee.pinLabel', 'verify');
      fireEvent.click(screen.getByRole('button', { name: TRANSLATIONS[language]['nominee.verifyPinBtn'] }));

      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toContain(TRANSLATIONS[language][messageKey]);
      });
      const alert = screen.getByRole('alert');
      expect(alert.textContent).not.toMatch(/unauthorized/i);
      unmount();
      nomineeMocks.loginNominee.mockReset();
      nomineeMocks.verifyNomineePinServer.mockReset();
    }
  }, 30000);
});
