import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { AuthService, NomineeRequestError } from './authService';

describe('AuthService nominee authentication', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  test('logs in with PIN using the authenticated server session and stores its token', async () => {
    const user = {
      id: 'pin-user',
      name: 'PIN User',
      email: 'pin@example.com',
      pinHash: '$2a$10$server-hash',
      nomineeName: 'Nominee',
      nomineePhone: '+10000000000',
      isFaceIdEnabled: false
    };
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, user, token: 'pin-login-token' })
    });

    await expect(AuthService.loginWithPIN('1234', 'ta')).resolves.toMatchObject(user);
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/pin-login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '1234' })
    });
    expect(localStorage.getItem('autofeast_jwt_token')).toBe('pin-login-token');
  });

  test.each([
    [401, 'ta', 'தவறான PIN. மீண்டும் முயற்சிக்கவும்.'],
    [429, 'hi', 'चार गलत पिन प्रयास। 30 सेकंड बाद फिर कोशिश कर सकते हैं।']
  ])('localizes PIN login failure status %i', async (status, language, message) => {
    fetchMock.mockResolvedValue({
      ok: false,
      status,
      json: async () => ({ lockRemainingSeconds: 30 })
    });
    await expect(AuthService.loginWithPIN('9999', language)).rejects.toThrow(message);
  });

  test('logs in using nominee credentials and returns the token without storing it', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, nomineeToken: 'memory-only-token' })
    });

    await expect(AuthService.loginNominee(' nominee@example.com ', 'password')).resolves.toBe('memory-only-token');
    expect(fetchMock).toHaveBeenCalledWith('/api/nominee/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomineeEmail: 'nominee@example.com', nomineePassword: 'password' })
    });
  });

  test('sends the nominee token and PIN to the verification endpoint', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true })
    });

    await expect(AuthService.verifyNomineePinServer('2468', 'memory-only-token')).resolves.toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/nominee/verify-pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer memory-only-token'
      },
      body: JSON.stringify({ pin: '2468' })
    });
  });

  test('returns server authorization status and never falls back to local PIN verification', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ success: false, error: 'Unauthorized.' })
    });
    await expect(AuthService.verifyNomineePinServer('2468', 'expired-token')).resolves.toEqual({
      success: false,
      status: 401,
      locked: undefined,
      remainingTries: undefined
    });

    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(AuthService.verifyNomineePinServer('2468', 'memory-only-token')).rejects.toThrow('offline');
  });

  test('changes the PIN through an authenticated server request', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true })
    });

    await expect(AuthService.setNomineePin('8642', 'memory-only-token')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('/api/nominee/set-pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer memory-only-token'
      },
      body: JSON.stringify({ pin: '8642' })
    });
  });

  test('saves nominee credentials using the signed-in account token', async () => {
    window.localStorage.setItem('autofeast_jwt_token', 'account-owner-token');
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true })
    });

    await expect(AuthService.saveNomineeCredentials('nominee@example.com', 'password')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('/api/nominee/credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer account-owner-token'
      },
      body: JSON.stringify({ nomineeEmail: 'nominee@example.com', nomineePassword: 'password' })
    });
  });

  test('preserves HTTP status for localized UI errors', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ success: false, error: 'Raw backend error' })
    });

    await expect(AuthService.loginNominee('nominee@example.com', 'password'))
      .rejects.toBeInstanceOf(NomineeRequestError);
    await expect(AuthService.setNomineePin('8642', 'memory-only-token'))
      .rejects.toMatchObject({ status: 503 });
  });
});
