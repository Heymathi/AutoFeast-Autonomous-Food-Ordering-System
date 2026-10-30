/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import bcrypt from 'bcryptjs';
import app, { fallbackUsersDb, signJwt } from '../../server.js';
import { DailyLimitRenewalModal } from '../components/DailyLimitRenewalModal';
import { SpeechController } from '../services/speechController';

let mockAppValue: any = {};

vi.mock('../context/AppContext', () => ({
  useApp: () => mockAppValue,
}));

// Helper to invoke the Express app in-process without opening a TCP socket
async function invokeVerifyPin(headers: Record<string, string>, body: any): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const req: any = {
      method: 'POST',
      url: '/api/verify-pin',
      originalUrl: '/api/verify-pin',
      path: '/api/verify-pin',
      baseUrl: '',
      headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
      body,
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      get(name: string) {
        return this.headers[name.toLowerCase()];
      }
    };

    let statusCode = 200;
    const res: any = {
      statusCode: 200,
      headers: {},
      setHeader(k: string, v: any) { this.headers[k] = v; },
      header(k: string, v: any) { this.headers[k] = v; return this; },
      status(code: number) { statusCode = code; this.statusCode = code; return this; },
      sendStatus(code: number) { statusCode = code; this.statusCode = code; resolve({ status: statusCode, json: null }); return this; },
      json(payload: any) { resolve({ status: statusCode, json: payload }); return this; }
    };

    app.handle(req, res, (err: any) => {
      if (err) reject(err);
    });
  });
}

describe('Daily Limit Renewal PIN & /api/verify-pin Verification Suite', () => {
  const userId = 'user_daily_limit_test_01';
  let userToken: string;

  beforeEach(() => {
    fallbackUsersDb.length = 0;
    userToken = signJwt({ userId, email: 'kavin@autofeast.com' });

    fallbackUsersDb.push({
      id: userId,
      name: 'Kavin Kumar',
      email: 'kavin@autofeast.com',
      passwordHash: bcrypt.hashSync('Password123!', 10),
      pinHash: bcrypt.hashSync('1234', 10),
      nomineePinHash: bcrypt.hashSync('9876', 10),
      pinFailedAttempts: 0,
      pinLockedUntil: null,
      nomineeName: 'Priya',
      nomineePhone: '+91 98765 43210',
      isFaceIdEnabled: false,
    });

    vi.spyOn(SpeechController, 'cancelSpeech').mockImplementation(() => {});
    vi.spyOn(SpeechController, 'releaseMic').mockImplementation(() => {});
    vi.spyOn(SpeechController, 'requestMic').mockImplementation(() => {});
    vi.spyOn(SpeechController, 'isSupported').mockReturnValue(true);
    vi.spyOn(SpeechController, 'speak').mockImplementation((_text, _lang, onEnd) => {
      if (onEnd) onEnd();
    });

    mockAppValue = {
      t: (k: string) => k,
      speakText: vi.fn(),
      showToast: vi.fn(),
      currentUser: {
        id: userId,
        name: 'Kavin Kumar',
        email: 'kavin@autofeast.com',
        nomineeName: 'Priya',
        nomineePhone: '+91 98765 43210',
      },
      language: 'en',
      accessibilitySettings: { highContrast: false },
      renewLimitWithPIN: vi.fn(async (pin: string) => {
        const res = await invokeVerifyPin(
          { Authorization: `Bearer ${userToken}` },
          { pin }
        );
        if (res.status === 200 && res.json?.success) {
          return { success: true, attemptsLeft: res.json.attemptsLeft ?? 3 };
        }
        if (res.status === 409 || res.json?.code === 'PIN_NOT_SET') {
          return {
            success: false,
            code: 'PIN_NOT_SET',
            pinNotSet: true,
            error: 'No PIN set. Please set your PIN first',
          };
        }
        return {
          success: false,
          isLocked: res.status === 429 || Boolean(res.json?.locked),
          attemptsLeft: res.json?.attemptsLeft,
          error: res.json?.error,
        };
      }),
      renewLimitWithFaceID: vi.fn(),
      renewLimitWithNominee: vi.fn(),
      renewLimitWithPassword: vi.fn(),
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('1. Accepts correct PIN via keypad path and via voice path', async () => {
    let capturedVoiceOpts: any = null;
    vi.spyOn(SpeechController, 'requestMic').mockImplementation((opts: any) => {
      capturedVoiceOpts = opts;
    });

    const onClose = vi.fn();
    render(<DailyLimitRenewalModal isOpen={true} onClose={onClose} />);

    // A) Keypad path: click 1, 2, 3, 4
    fireEvent.click(screen.getByTestId('keypad-digit-1'));
    fireEvent.click(screen.getByTestId('keypad-digit-2'));
    fireEvent.click(screen.getByTestId('keypad-digit-3'));
    fireEvent.click(screen.getByTestId('keypad-digit-4'));

    await waitFor(() => {
      expect(mockAppValue.renewLimitWithPIN).toHaveBeenCalledWith('1234');
      expect(screen.getByText(/Daily order limit successfully reset to 0\/6/i)).toBeTruthy();
    }, { timeout: 2000 });

    // B) Voice path: speak "one two three four"
    cleanup();
    mockAppValue.renewLimitWithPIN.mockClear();
    render(<DailyLimitRenewalModal isOpen={true} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('btn-speak-pin-mic'));
    expect(capturedVoiceOpts).toBeTruthy();

    await act(async () => {
      capturedVoiceOpts.onResult('one two three four', true, ['one two three four']);
    });

    await waitFor(() => {
      expect(mockAppValue.renewLimitWithPIN).toHaveBeenCalledWith('1234');
      expect(screen.getByText(/Daily order limit successfully reset to 0\/6/i)).toBeTruthy();
    }, { timeout: 2000 });
  });

  it('2. Wrong PIN returns attemptsLeft 2, then 1, then locks (persisted on user document, not memory) and speaks error TTS once per attempt', async () => {
    const userDoc = fallbackUsersDb.find(u => u.id === userId)!;
    render(<DailyLimitRenewalModal isOpen={true} onClose={vi.fn()} />);

    // Attempt 1 (wrong PIN 9999) -> attemptsLeft: 2, DB pinFailedAttempts: 1
    fireEvent.click(screen.getByTestId('keypad-digit-9'));
    fireEvent.click(screen.getByTestId('keypad-digit-9'));
    fireEvent.click(screen.getByTestId('keypad-digit-9'));
    fireEvent.click(screen.getByTestId('keypad-digit-9'));

    await waitFor(() => {
      expect(screen.getByText(/1\/3 attempts, 2 attempts left/i)).toBeTruthy();
    }, { timeout: 2000 });
    expect(userDoc.pinFailedAttempts).toBe(1);
    expect(userDoc.pinLockedUntil).toBeNull();
    expect(mockAppValue.speakText).toHaveBeenCalledTimes(1);

    // Attempt 2 (wrong PIN 8888) -> attemptsLeft: 1, DB pinFailedAttempts: 2
    fireEvent.click(screen.getByTestId('keypad-digit-8'));
    fireEvent.click(screen.getByTestId('keypad-digit-8'));
    fireEvent.click(screen.getByTestId('keypad-digit-8'));
    fireEvent.click(screen.getByTestId('keypad-digit-8'));

    await waitFor(() => {
      expect(screen.getByText(/2\/3 attempts, 1 attempts left/i)).toBeTruthy();
    }, { timeout: 2000 });
    expect(userDoc.pinFailedAttempts).toBe(2);
    expect(userDoc.pinLockedUntil).toBeNull();
    expect(mockAppValue.speakText).toHaveBeenCalledTimes(2);

    // Attempt 3 (wrong PIN 7777) -> attemptsLeft: 0, locked: true, DB pinLockedUntil set (~15 min)
    fireEvent.click(screen.getByTestId('keypad-digit-7'));
    fireEvent.click(screen.getByTestId('keypad-digit-7'));
    fireEvent.click(screen.getByTestId('keypad-digit-7'));
    fireEvent.click(screen.getByTestId('keypad-digit-7'));

    await waitFor(() => {
      expect(screen.getByText(/3\/3 attempts, 0 attempts left/i)).toBeTruthy();
    }, { timeout: 2000 });
    expect(userDoc.pinFailedAttempts).toBe(3);
    expect(userDoc.pinLockedUntil).toBeInstanceOf(Date);
    expect(userDoc.pinLockedUntil.getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000);
    expect(mockAppValue.speakText).toHaveBeenCalledTimes(3);
  });

  it('3. PIN with leading zero (0123) verifies accurately', async () => {
    const userDoc = fallbackUsersDb.find(u => u.id === userId)!;
    userDoc.pinHash = bcrypt.hashSync('0123', 10);

    const res = await invokeVerifyPin(
      { Authorization: `Bearer ${userToken}` },
      { pin: '0123' }
    );

    expect(res.status).toBe(200);
    expect(res.json.success).toBe(true);
  });

  it('4. Plain-stored PIN verifies and is automatically re-saved as a bcrypt hash', async () => {
    const userDoc = fallbackUsersDb.find(u => u.id === userId)!;
    // Simulate legacy plain-text PIN stored on user document
    userDoc.pinHash = '0456';

    const res = await invokeVerifyPin(
      { Authorization: `Bearer ${userToken}` },
      { pin: '0456' }
    );

    expect(res.status).toBe(200);
    expect(res.json.success).toBe(true);
    // Verify it was upgraded to a bcrypt hash and still matches '0456'
    expect(userDoc.pinHash).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(await bcrypt.compare('0456', userDoc.pinHash)).toBe(true);
  });

  it('5. User with no PIN gets PIN_NOT_SET and screen shows "No PIN set. Please set your PIN first"', async () => {
    const userDoc = fallbackUsersDb.find(u => u.id === userId)!;
    userDoc.pinHash = null;

    const apiRes = await invokeVerifyPin(
      { Authorization: `Bearer ${userToken}` },
      { pin: '1234' }
    );
    expect(apiRes.status).toBe(409);
    expect(apiRes.json.code).toBe('PIN_NOT_SET');

    render(<DailyLimitRenewalModal isOpen={true} onClose={vi.fn()} />);

    fireEvent.click(screen.getByTestId('keypad-digit-1'));
    fireEvent.click(screen.getByTestId('keypad-digit-2'));
    fireEvent.click(screen.getByTestId('keypad-digit-3'));
    fireEvent.click(screen.getByTestId('keypad-digit-4'));

    await waitFor(() => {
      expect(screen.getByText('No PIN set. Please set your PIN first')).toBeTruthy();
    }, { timeout: 2000 });
  });

  it('6. Nominee PIN is NOT accepted on /api/verify-pin (rejects both nominee PIN digits and nominee JWT)', async () => {
    // A) Main user sends their nominee's PIN ('9876') instead of their own PIN ('1234')
    const wrongOwnerRes = await invokeVerifyPin(
      { Authorization: `Bearer ${userToken}` },
      { pin: '9876' }
    );
    expect(wrongOwnerRes.status).toBe(400);
    expect(wrongOwnerRes.json.success).toBe(false);
    expect(wrongOwnerRes.json.attemptsLeft).toBe(2);

    // B) Nominee JWT token is rejected with 403 on main user's /api/verify-pin endpoint
    const nomineeToken = signJwt({ nomineeUserId: userId, isNominee: true });
    const nomineeTokenRes = await invokeVerifyPin(
      { Authorization: `Bearer ${nomineeToken}` },
      { pin: '9876' }
    );
    expect(nomineeTokenRes.status).toBe(403);
    expect(nomineeTokenRes.json.success).toBe(false);
  });
});
