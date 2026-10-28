import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import serverModule, {
  signJwt,
  fallbackApprovalRequestsDb,
  fallbackUsersDb,
  sentEmailsArray,
  loginRateLimitMap
} from '../server.js';
import http from 'http';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { isFoodItemRestricted, normalizeFoodText } from './services/restrictedFoodMatcher';

const app = serverModule || (serverModule as any).default;

describe('Nominee Portal & Approval System Tests', () => {
  let server: http.Server;
  let baseUrl: string;

  const testUserId = 'user_test_nominee_001';
  const nomineeEmail = 'guardian@autofeast.com';
  const initialNomineePass = 'InitialNomineePass123!';
  const nomineePin = '5678';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await new Promise<void>(resolve => {
      server = app.listen(0, () => {
        const port = (server.address() as any).port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>(resolve => {
      server.close(() => resolve());
    });
  });

  beforeEach(() => {
    // Reset test user fixture before each test
    fallbackUsersDb.length = 0;
    fallbackApprovalRequestsDb.length = 0;
    if (Array.isArray(sentEmailsArray)) sentEmailsArray.length = 0;
    if (loginRateLimitMap) loginRateLimitMap.clear();

    fallbackUsersDb.push({
      id: testUserId,
      name: 'Test Student',
      email: 'student@autofeast.com',
      passwordHash: bcrypt.hashSync('studentPass123', 10),
      pinHash: bcrypt.hashSync('1111', 10),
      nomineeName: 'Guardian Uncle',
      nomineePhone: '+91 98765 12345',
      nomineeEmail: nomineeEmail,
      nomineePasswordHash: bcrypt.hashSync(initialNomineePass, 10),
      nomineePinHash: bcrypt.hashSync(nomineePin, 10),
      nomineeFailedAttempts: 0,
      nomineeLockedUntil: null,
      nomineeOtpHash: null,
      nomineeOtpExpiresAt: null,
      nomineeOtpAttempts: 0,
      nomineeResetTokenHash: null,
      nomineeResetTokenExpiresAt: null,
      restrictedFoodIds: ['chole-bhature', 'chaat-pani-puri']
    } as any);
  });

  // -------------------------------------------------------------
  // TEST 1: Login success / fail
  // -------------------------------------------------------------
  test('1. Nominee login success with correct credentials, fail with wrong password and unknown email', async () => {
    // 1a. Success
    const successRes = await fetch(`${baseUrl}/api/nominee/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomineeEmail, nomineePassword: initialNomineePass })
    });
    expect(successRes.status).toBe(200);
    const successData = await successRes.json();
    expect(successData.success).toBe(true);
    expect(successData.nomineeToken).toBeDefined();

    // 1b. Fail with wrong password -> 401
    const wrongPassRes = await fetch(`${baseUrl}/api/nominee/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomineeEmail, nomineePassword: 'WrongPassword999!' })
    });
    expect(wrongPassRes.status).toBe(401);
    const wrongPassData = await wrongPassRes.json();
    expect(wrongPassData.error).toContain('Invalid nominee credentials');

    // 1c. Fail with unknown email -> 401
    const unknownRes = await fetch(`${baseUrl}/api/nominee/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomineeEmail: 'nobody@nowhere.com', nomineePassword: initialNomineePass })
    });
    expect(unknownRes.status).toBe(401);
  });

  // -------------------------------------------------------------
  // TEST 2: OTP wrong / expired / attempt-limit
  // -------------------------------------------------------------
  test('2. OTP flow: forgot-password generates OTP, wrong OTP rejected, 5-attempt lockout, expired OTP rejected', async () => {
    // Request OTP
    const forgotRes = await fetch(`${baseUrl}/api/nominee/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomineeEmail })
    });
    expect(forgotRes.status).toBe(200);
    const forgotData = await forgotRes.json();
    expect(forgotData.success).toBe(true);

    const user = fallbackUsersDb.find(u => u.nomineeEmail === nomineeEmail)!;
    expect(user.nomineeOtpHash).toBeDefined();
    expect(user.nomineeOtpExpiresAt).toBeDefined();

    // 2a. Wrong OTP -> 400
    const wrongOtpRes = await fetch(`${baseUrl}/api/nominee/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomineeEmail, otp: '000000' })
    });
    expect(wrongOtpRes.status).toBe(400);

    // 2b. Attempt-limit: attempt 4 more wrong OTPs (total 5) -> invalidates OTP
    for (let i = 0; i < 3; i++) {
      await fetch(`${baseUrl}/api/nominee/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomineeEmail, otp: '111111' })
      });
    }
    const fifthAttemptRes = await fetch(`${baseUrl}/api/nominee/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomineeEmail, otp: '999999' })
    });
    expect(fifthAttemptRes.status).toBe(400);
    const fifthData = await fifthAttemptRes.json();
    expect(fifthData.error).toContain('Maximum attempts exceeded');
    expect(user.nomineeOtpHash).toBeNull(); // invalidated

    // 2c. Expired OTP rejected
    if (loginRateLimitMap) loginRateLimitMap.clear();
    // Request a fresh OTP
    await fetch(`${baseUrl}/api/nominee/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomineeEmail })
    });
    // Set expiry in the past
    user.nomineeOtpExpiresAt = new Date(Date.now() - 1000);

    const expiredRes = await fetch(`${baseUrl}/api/nominee/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomineeEmail, otp: '123456' })
    });
    expect(expiredRes.status).toBe(400);
    const expiredData = await expiredRes.json();
    expect(expiredData.error).toContain('expired');
  });

  // -------------------------------------------------------------
  // TEST 3: Reset password success and old password rejected
  // -------------------------------------------------------------
  test('3. Reset password: old password rejected, new password succeeds and allows login', async () => {
    // Generate valid OTP
    const rawOtp = '789123';
    const user = fallbackUsersDb.find(u => u.nomineeEmail === nomineeEmail)!;
    user.nomineeOtpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');
    user.nomineeOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    user.nomineeOtpAttempts = 0;

    // Verify OTP -> returns resetToken
    const verifyRes = await fetch(`${baseUrl}/api/nominee/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomineeEmail, otp: rawOtp })
    });
    expect(verifyRes.status).toBe(200);
    const verifyData = await verifyRes.json();
    expect(verifyData.resetToken).toBeDefined();
    const resetToken = verifyData.resetToken;

    // 3a. Old password rejected
    const samePassRes = await fetch(`${baseUrl}/api/nominee/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nomineeEmail,
        resetToken,
        newPassword: initialNomineePass,
        confirmPassword: initialNomineePass
      })
    });
    expect(samePassRes.status).toBe(400);
    const sameData = await samePassRes.json();
    expect(sameData.error).toContain('New password cannot be the same as your old password');

    // 3b. Reset with valid new password
    const newPass = 'BrandNewSecretPass2026!';
    const resetSuccessRes = await fetch(`${baseUrl}/api/nominee/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nomineeEmail,
        resetToken,
        newPassword: newPass,
        confirmPassword: newPass
      })
    });
    expect(resetSuccessRes.status).toBe(200);

    // 3c. Login with new password succeeds
    const loginNewRes = await fetch(`${baseUrl}/api/nominee/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomineeEmail, nomineePassword: newPass })
    });
    expect(loginNewRes.status).toBe(200);

    // 3d. Login with old password fails
    const loginOldRes = await fetch(`${baseUrl}/api/nominee/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomineeEmail, nomineePassword: initialNomineePass })
    });
    expect(loginOldRes.status).toBe(401);
  });

  // -------------------------------------------------------------
  // TEST 4: Restricted item match in English / Tamil / Hindi
  // -------------------------------------------------------------
  test('4. Restricted food item matching works in English, Tamil, and Hindi scripts and transliterations', () => {
    const restrictedList = ['chole-bhature', 'chaat-pani-puri'];

    // English queries
    expect(isFoodItemRestricted('chole-bhature', restrictedList)).toBe(true);
    expect(isFoodItemRestricted('Punjabi Chole Bhature', restrictedList)).toBe(true);
    expect(isFoodItemRestricted('chole bhature', restrictedList)).toBe(true);
    expect(isFoodItemRestricted('Pani Puri', restrictedList)).toBe(true);
    expect(isFoodItemRestricted('golgappa', restrictedList)).toBe(true);

    // Tamil queries
    expect(isFoodItemRestricted('சோலே பட்டூரே', restrictedList)).toBe(true);
    expect(isFoodItemRestricted('சோலே', restrictedList)).toBe(true);
    expect(isFoodItemRestricted('பட்டூரே', restrictedList)).toBe(true);
    expect(isFoodItemRestricted('பானி பூரி', restrictedList)).toBe(true);
    expect(isFoodItemRestricted('பானிபூரி', restrictedList)).toBe(true);

    // Hindi queries
    expect(isFoodItemRestricted('छोले भटूरे', restrictedList)).toBe(true);
    expect(isFoodItemRestricted('छोले', restrictedList)).toBe(true);
    expect(isFoodItemRestricted('भटूरे', restrictedList)).toBe(true);
    expect(isFoodItemRestricted('पानी पूरी', restrictedList)).toBe(true);
    expect(isFoodItemRestricted('पानीपूरी', restrictedList)).toBe(true);
    expect(isFoodItemRestricted('गोलगप्पा', restrictedList)).toBe(true);

    // Unrestricted item should return false
    expect(isFoodItemRestricted('filter coffee', restrictedList)).toBe(false);
    expect(isFoodItemRestricted('பில்டர் காபி', restrictedList)).toBe(false);
    expect(isFoodItemRestricted('फिल्टर कॉफी', restrictedList)).toBe(false);
  });

  // -------------------------------------------------------------
  // TEST 5: Email approve works once, second click fails (409)
  // -------------------------------------------------------------
  test('5. Email approval: first decision succeeds, second click fails with 409', async () => {
    const rawToken = 'random_email_token_32_bytes_test_abc123';
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const reqId = 'req_email_test_001';

    fallbackApprovalRequestsDb.push({
      id: reqId,
      userId: testUserId,
      foodItemId: 'chole-bhature',
      orderType: 'instant',
      status: 'pending',
      emailTokenHash: tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      requestedAt: new Date().toISOString()
    } as any);

    // First click: POST decision
    const firstRes = await fetch(`${baseUrl}/api/nominee/email-decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ token: rawToken, decision: 'approve' })
    });
    expect(firstRes.status).toBe(200);
    const firstData = await firstRes.json();
    expect(firstData.success).toBe(true);
    expect(firstData.status).toBe('approved');

    // Second click: same token -> fails with 409
    const secondRes = await fetch(`${baseUrl}/api/nominee/email-decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ token: rawToken, decision: 'approve' })
    });
    expect(secondRes.status).toBe(409);
  });

  // -------------------------------------------------------------
  // TEST 6: Website decision after email returns 409
  // -------------------------------------------------------------
  test('6. Website decision after email decision returns 409 Conflict', async () => {
    const rawToken = 'random_email_token_test_409_check';
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const reqId = 'req_dual_decision_001';

    fallbackApprovalRequestsDb.push({
      id: reqId,
      userId: testUserId,
      foodItemId: 'chole-bhature',
      orderType: 'instant',
      status: 'pending',
      emailTokenHash: tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      requestedAt: new Date().toISOString()
    } as any);

    // 6a. Decide via email first
    await fetch(`${baseUrl}/api/nominee/email-decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ token: rawToken, decision: 'approve' })
    });

    // 6b. Nominee attempts website decision on the same request -> 409
    const nomineeToken = signJwt({ nomineeUserId: testUserId, isNominee: true });
    const websiteRes = await fetch(`${baseUrl}/api/nominee/approvals/${reqId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${nomineeToken}`
      },
      body: JSON.stringify({ decision: 'deny', pin: nomineePin })
    });
    expect(websiteRes.status).toBe(409);
    const data = await websiteRes.json();
    expect(data.error).toContain('already decided');
  });

  // -------------------------------------------------------------
  // TEST 7: Expired returns 400
  // -------------------------------------------------------------
  test('7. Decision on expired approval request returns 400', async () => {
    const reqId = 'req_expired_test_001';
    fallbackApprovalRequestsDb.push({
      id: reqId,
      userId: testUserId,
      foodItemId: 'chole-bhature',
      orderType: 'instant',
      status: 'pending',
      expiresAt: new Date(Date.now() - 5000), // expired 5 seconds ago
      requestedAt: new Date(Date.now() - 86400000).toISOString()
    } as any);

    const nomineeToken = signJwt({ nomineeUserId: testUserId, isNominee: true });
    const res = await fetch(`${baseUrl}/api/nominee/approvals/${reqId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${nomineeToken}`
      },
      body: JSON.stringify({ decision: 'approve', pin: nomineePin })
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('expired');
  });

  // -------------------------------------------------------------
  // TEST 8: Wrong PIN rejected
  // -------------------------------------------------------------
  test('8. Website decision with wrong PIN is rejected with 400', async () => {
    const reqId = 'req_pin_test_001';
    fallbackApprovalRequestsDb.push({
      id: reqId,
      userId: testUserId,
      foodItemId: 'chole-bhature',
      orderType: 'instant',
      status: 'pending',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      requestedAt: new Date().toISOString()
    } as any);

    const nomineeToken = signJwt({ nomineeUserId: testUserId, isNominee: true });
    const res = await fetch(`${baseUrl}/api/nominee/approvals/${reqId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${nomineeToken}`
      },
      body: JSON.stringify({ decision: 'approve', pin: '0000' }) // wrong PIN
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Incorrect PIN');
  });

  // -------------------------------------------------------------
  // TEST 9: A user token on a nominee endpoint returns 403
  // -------------------------------------------------------------
  test('9. A regular user token on a nominee endpoint returns 403 Forbidden', async () => {
    const userToken = signJwt({ userId: testUserId }); // Regular user token (no isNominee flag)

    // 9a. /api/nominee/approvals
    const resApprovals = await fetch(`${baseUrl}/api/nominee/approvals`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    expect(resApprovals.status).toBe(403);

    // 9b. /api/nominee/approvals/:id/decision
    const resDecision = await fetch(`${baseUrl}/api/nominee/approvals/any_req/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`
      },
      body: JSON.stringify({ decision: 'approve', pin: '1234' })
    });
    expect(resDecision.status).toBe(403);

    // 9c. /api/nominee/approval-requests/:id (PUT)
    const resPut = await fetch(`${baseUrl}/api/nominee/approval-requests/any_req`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`
      },
      body: JSON.stringify({ status: 'approved', nomineePin: '1234' })
    });
    expect(resPut.status).toBe(403);
  });
});
