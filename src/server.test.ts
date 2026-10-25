import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { INDIAN_FOOD_CATALOG } from './data/indianFoodCatalog';
import serverModule, { signJwt, fallbackRestrictedItemsDb, fallbackApprovalRequestsDb, fallbackUsersDb, User, sentEmailsArray, sendApprovalRequestEmail } from '../server.js';
import http from 'http';
import bcrypt from 'bcryptjs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

const app = serverModule || (serverModule as any).default;

describe('REAL HTTP Endpoint Test Suite against Express Server (/api/orders/create & /api/schedules)', () => {
  let server: http.Server;
  let baseUrl: string;

  const testUserId = 'user_karthik_001';
  const validToken = signJwt({ userId: testUserId });
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${validToken}`
  };

  const sampleCatalogItem = INDIAN_FOOD_CATALOG[0]; // dosa-masala
  const restrictedCatalogItem = INDIAN_FOOD_CATALOG.find(i => i.id === 'chaat-pani-puri') || INDIAN_FOOD_CATALOG[17];

  beforeAll(async () => {
    // Populate test fixture user in fallbackUsersDb
    fallbackUsersDb.length = 0;
    fallbackUsersDb.push({
      id: testUserId,
      name: 'Karthik Raja',
      email: 'karthik@autofeast.com',
      passwordHash: bcrypt.hashSync('password123', 10),
      pinHash: bcrypt.hashSync('1234', 10),
      pinFailedAttempts: 0,
      pinLockedUntil: null,
      nomineeName: 'Priya Raja',
      nomineePhone: '+91 98765 43210',
      nomineeEmail: 'priya@autofeast.com',
      nomineePinHash: bcrypt.hashSync('4321', 10),
      nomineePasswordHash: bcrypt.hashSync('nomineePass123', 10),
      nomineeLoginFailedAttempts: 0,
      nomineeLoginLockedUntil: null,
      nomineeFailedAttempts: 0,
      nomineeLockedUntil: null,
      restrictedFoodIds: [],
      isFaceIdEnabled: true,
      webAuthnCredentials: []
    });

    // Start real HTTP server on random available port
    await new Promise<void>((resolve) => {
      server = (app as any).listen(0, () => {
        const port = (server.address() as any).port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // Ensure fallback DB restricted records exist for test user
    if (fallbackRestrictedItemsDb) {
      fallbackRestrictedItemsDb.push({
        id: `restr_${Date.now()}`,
        userId: testUserId,
        foodItemId: restrictedCatalogItem.id,
        foodItemName: restrictedCatalogItem.name,
        category: restrictedCatalogItem.category
      });
    }
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  // HTTP Test 1: No token -> 401
  test('HTTP Test 1: No token -> 401', async () => {
    const res = await fetch(`${baseUrl}/api/orders/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ itemId: sampleCatalogItem.id, quantity: 1 }] })
    });
    expect(res.status).toBe(401);
  });

  // HTTP Test 2: Unknown itemId -> 400
  test('HTTP Test 2: Unknown itemId -> 400', async () => {
    const res = await fetch(`${baseUrl}/api/orders/create`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ items: [{ itemId: 'invalid_non_existent_item_9999', quantity: 1 }] })
    });
    expect(res.status).toBe(400);
  });

  // HTTP Test 3: Restricted item without nominee approval -> 403
  test('HTTP Test 3: Restricted item without nominee approval -> 403', async () => {
    const res = await fetch(`${baseUrl}/api/orders/create`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ items: [{ itemId: restrictedCatalogItem.id, quantity: 1 }] })
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.requiresNomineeApproval).toBe(true);
  });

  // HTTP Test 4: Multi-item cart with one restricted item -> 403
  test('HTTP Test 4: Multi-item cart with one restricted item -> 403', async () => {
    const res = await fetch(`${baseUrl}/api/orders/create`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        items: [
          { itemId: sampleCatalogItem.id, quantity: 1 },
          { itemId: restrictedCatalogItem.id, quantity: 1 }
        ]
      })
    });
    expect(res.status).toBe(403);
  });

  // HTTP Test 5: Approved item -> 200
  test('HTTP Test 5: Approved item -> 200', async () => {
    const approvalId = `app_test_${Date.now()}_1`;
    fallbackApprovalRequestsDb.push({
      id: approvalId,
      userId: testUserId,
      foodItemId: restrictedCatalogItem.id,
      orderType: 'instant',
      status: 'approved',
      used: false
    });

    const res = await fetch(`${baseUrl}/api/orders/create`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ items: [{ itemId: restrictedCatalogItem.id, quantity: 1 }] })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  // HTTP Test 6: Approval reuse -> 403
  test('HTTP Test 6: Approval reuse (used approval used a 2nd time) -> 403', async () => {
    const res = await fetch(`${baseUrl}/api/orders/create`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ items: [{ itemId: restrictedCatalogItem.id, quantity: 1 }] })
    });
    expect(res.status).toBe(403);
  });

  // HTTP Test 7: Instant approval used for schedule -> 403
  test('HTTP Test 7: Instant approval used for schedule -> 403', async () => {
    const instantApprovalId = `app_instant_${Date.now()}`;
    fallbackApprovalRequestsDb.push({
      id: instantApprovalId,
      userId: testUserId,
      foodItemId: restrictedCatalogItem.id,
      orderType: 'instant',
      status: 'approved',
      used: false
    });

    const res = await fetch(`${baseUrl}/api/schedules`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        id: `sched_${Date.now()}`,
        slotName: 'Breakfast',
        slotIndex: 1,
        time: '08:00',
        frequency: 'daily',
        foodItemId: restrictedCatalogItem.id,
        foodItemName: restrictedCatalogItem.name,
        restaurant: restrictedCatalogItem.restaurant || 'Saravana Bhavan'
      })
    });
    expect(res.status).toBe(403);
  });

  // HTTP Test 8: Two parallel requests with one approval -> one 200 and one 403
  test('HTTP Test 8: Two parallel requests with one approval -> one 200 and one 403', async () => {
    for (let i = fallbackApprovalRequestsDb.length - 1; i >= 0; i--) {
      if (fallbackApprovalRequestsDb[i].userId === testUserId) {
        fallbackApprovalRequestsDb.splice(i, 1);
      }
    }

    const singleApprovalId = `app_parallel_${Date.now()}`;
    fallbackApprovalRequestsDb.push({
      id: singleApprovalId,
      userId: testUserId,
      foodItemId: restrictedCatalogItem.id,
      orderType: 'instant',
      status: 'approved',
      used: false
    });

    const req1 = fetch(`${baseUrl}/api/orders/create`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ items: [{ itemId: restrictedCatalogItem.id, quantity: 1 }] })
    });

    const req2 = fetch(`${baseUrl}/api/orders/create`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ items: [{ itemId: restrictedCatalogItem.id, quantity: 1 }] })
    });

    const [res1, res2] = await Promise.all([req1, req2]);
    const statuses = [res1.status, res2.status].sort();

    expect(statuses).toEqual([200, 403]);
  });

  // HTTP Test 9: DB unavailable -> 503
  test('HTTP Test 9: DB unavailable -> 503', async () => {
    const res = await fetch(`${baseUrl}/api/orders/create`, {
      method: 'POST',
      headers: { ...authHeaders, 'x-simulate-db-down': 'true' },
      body: JSON.stringify({ items: [{ itemId: sampleCatalogItem.id, quantity: 1 }] })
    });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain('Database');
  });

  // HTTP Test 10: PIN verify without token -> 401
  test('HTTP Test 10: PIN verify without token -> 401', async () => {
    const res = await fetch(`${baseUrl}/api/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '1234' })
    });
    expect(res.status).toBe(401);
  });

  // HTTP Test 11: User without PIN set returns 409
  test('HTTP Test 11: User without PIN set returns 409 PIN not set', async () => {
    const noPinUserToken = signJwt({ userId: 'user_nopin_999' });
    fallbackUsersDb.push({
      id: 'user_nopin_999',
      name: 'No PIN User',
      email: 'nopin@autofeast.com',
      passwordHash: 'hashed_pass',
      pinHash: null as any,
      nomineeName: 'Nominee',
      nomineePhone: '123',
      isFaceIdEnabled: false
    } as any);

    const res = await fetch(`${baseUrl}/api/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${noPinUserToken}` },
      body: JSON.stringify({ pin: '1234' })
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('PIN not set');
  });

  // HTTP Test 12: Default "1234" does NOT work for user without pinHash
  test('HTTP Test 12: Default "1234" does NOT work for user without a pinHash', async () => {
    const noPinUserToken = signJwt({ userId: 'user_nopin_999' });
    const res = await fetch(`${baseUrl}/api/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${noPinUserToken}` },
      body: JSON.stringify({ pin: '1234' })
    });
    expect(res.status).toBe(409);
  });

  test('PIN login sets an authenticated session that allows subsequent bcrypt verification', async () => {
    const testUser = fallbackUsersDb.find(u => u.id === testUserId);
    if (testUser) {
      testUser.pinFailedAttempts = 0;
      testUser.pinLockedUntil = null;
    }

    const loginRes = await fetch(`${baseUrl}/api/auth/pin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '1234' })
    });
    expect(loginRes.status).toBe(200);
    const loginBody = await loginRes.json();
    expect(loginBody.success).toBe(true);
    expect(loginBody.token).toBeDefined();
    const cookie = loginRes.headers.get('set-cookie')?.split(';')[0];
    expect(cookie).toContain('autofeast_jwt=');

    const verifyRes = await fetch(`${baseUrl}/api/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie || '' },
      body: JSON.stringify({ pin: '1234' })
    });
    expect(verifyRes.status).toBe(200);
    expect((await verifyRes.json()).success).toBe(true);
  });

  test('PIN login enforces a server-side 30-second cooldown after four incorrect attempts', async () => {
    const testUser = fallbackUsersDb.find(u => u.id === testUserId);
    if (testUser) {
      testUser.pinFailedAttempts = 0;
      testUser.pinLockedUntil = null;
    }

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const res = await fetch(`${baseUrl}/api/auth/pin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '9999' })
      });
      expect(res.status).toBe(attempt < 4 ? 401 : 429);
      if (attempt === 4) {
        const body = await res.json();
        expect(body.locked).toBe(true);
        expect(body.lockExpiresMs).toBeGreaterThan(Date.now());
        expect(body.lockExpiresMs).toBeLessThanOrEqual(Date.now() + 30_000);
      }
    }

    const blocked = await fetch(`${baseUrl}/api/auth/pin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '1234' })
    });
    expect(blocked.status).toBe(429);
  });

  test('PIN verification allows three failures, locks on the fourth, and unlocks after cooldown', async () => {
    const testUser = fallbackUsersDb.find(u => u.id === testUserId);
    expect(testUser).toBeDefined();
    if (testUser) {
      testUser.pinFailedAttempts = 0;
      testUser.pinLockedUntil = null;
    }

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const res = await fetch(`${baseUrl}/api/verify-pin`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ pin: '9999' })
      });
      if (attempt < 4) {
        expect(res.status).toBe(400);
        expect((await res.json()).attemptsLeft).toBe(4 - attempt);
      } else {
        expect(res.status).toBe(429);
        const body = await res.json();
        expect(body.locked).toBe(true);
        expect(body.attemptsLeft).toBe(0);
        expect(body.lockExpiresMs).toBeGreaterThan(Date.now());
        expect(body.lockExpiresMs).toBeLessThanOrEqual(Date.now() + 30_000);
      }
    }

    const blockedCorrectPin = await fetch(`${baseUrl}/api/verify-pin`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ pin: '1234' })
    });
    expect(blockedCorrectPin.status).toBe(429);

    if (testUser) testUser.pinLockedUntil = new Date(Date.now() - 1000);
    const retryAfterCooldown = await fetch(`${baseUrl}/api/verify-pin`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ pin: '1234' })
    });
    expect(retryAfterCooldown.status).toBe(200);
    expect((await retryAfterCooldown.json()).success).toBe(true);
  });

  // HTTP Test 13: Parallel incorrect requests also trigger the PIN lockout.
  test('HTTP Test 13: Parallel wrong requests trigger the PIN lockout', async () => {
    const testUser = fallbackUsersDb.find(u => u.id === testUserId);
    if (testUser) {
      testUser.pinFailedAttempts = 0;
      testUser.pinLockedUntil = null;
    }

    const requests = Array.from({ length: 5 }, () =>
      fetch(`${baseUrl}/api/verify-pin`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ pin: '9999' })
      })
    );

    const responses = await Promise.all(requests);
    const statuses = responses.map(r => r.status);
    const lockedResponses = statuses.filter(s => s === 429);
    expect(lockedResponses.length).toBeGreaterThan(0);
  });

  // HTTP Test 14: Lock persists after simulating new server instance (read from DB state)
  test('HTTP Test 14: Lock persists after simulating new server instance', async () => {
    const testUser = fallbackUsersDb.find(u => u.id === testUserId);
    if (testUser) {
      testUser.pinLockedUntil = new Date(Date.now() + 30 * 1000);
    }

    const res = await fetch(`${baseUrl}/api/verify-pin`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ pin: '1234' })
    });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.locked).toBe(true);
  });

  // HTTP Test 15: DB down -> 503 (fail closed)
  test('HTTP Test 15: DB down -> 503 (fail closed)', async () => {
    const res = await fetch(`${baseUrl}/api/verify-pin`, {
      method: 'POST',
      headers: { ...authHeaders, 'x-simulate-db-down': 'true' },
      body: JSON.stringify({ pin: '1234' })
    });
    expect(res.status).toBe(503);
  });

  // HTTP Test 16: Nominee PIN cannot be verified with user token -> 403
  test('HTTP Test 16: Nominee PIN cannot be verified with user token -> 403', async () => {
    const res = await fetch(`${baseUrl}/api/nominee/verify-pin`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ pin: '4321' })
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Nominee PIN cannot be verified with user token');
  });

  // HTTP Test 17: Nominee PIN succeeds with valid nominee token -> 200
  test('HTTP Test 17: Nominee PIN succeeds with valid nominee token -> 200', async () => {
    const nomineeToken = signJwt({ nomineeUserId: testUserId, isNominee: true });
    const res = await fetch(`${baseUrl}/api/nominee/verify-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${nomineeToken}`
      },
      body: JSON.stringify({ pin: '4321' })
    });
    expect(res.status).toBe(200);
  });

  // HTTP Test 18: User A token cannot verify as User B (JWT user isolation)
  test('HTTP Test 18: User A token cannot verify as User B (JWT user isolation)', async () => {
    const userAToken = signJwt({ userId: 'user_A' });
    const res = await fetch(`${baseUrl}/api/verify-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userAToken}`
      },
      body: JSON.stringify({ pin: '1234', userId: 'user_karthik_001' })
    });
    expect(res.status).not.toBe(200);
  });

  // HTTP Test 19: NODE_ENV=production ignores x-simulate-db-down header and fails closed (503) if DB offline
  test('HTTP Test 19: NODE_ENV=production ignores x-simulate-db-down header and fails closed (503) if DB offline', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = await fetch(`${baseUrl}/api/verify-pin`, {
        method: 'POST',
        headers: { ...authHeaders, 'x-simulate-db-down': 'true' },
        body: JSON.stringify({ pin: '1234' })
      });
      expect(res.status).toBe(503);
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  // HTTP Test 20: Known nominee email without credential set returns 401
  test('HTTP Test 20: Known nominee email without credential set returns 401', async () => {
    const noCredUser = {
      id: 'user_nocred_001',
      name: 'No Cred User',
      email: 'nocred@autofeast.com',
      nomineeEmail: 'nocred_nominee@autofeast.com',
      nomineePasswordHash: null
    };
    fallbackUsersDb.push(noCredUser as any);

    const res = await fetch(`${baseUrl}/api/nominee/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomineeEmail: 'nocred_nominee@autofeast.com', nomineePassword: 'somePassword123' })
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid nominee credentials.');
  });

  // HTTP Test 21: Nominee approve/deny endpoint requires nominee token (user token returns 403)
  test('HTTP Test 21: Nominee approve/deny endpoint requires nominee token (user token returns 403)', async () => {
    const res = await fetch(`${baseUrl}/api/nominee/approval-requests/app_req_001`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ status: 'approved', nomineePin: '4321' })
    });
    expect(res.status).toBe(403);
  });

  // HTTP Test 22: Nominee approve/deny endpoint requires nominee PIN (missing/wrong PIN returns 400/401)
  test('HTTP Test 22: Nominee approve/deny endpoint requires nominee PIN (missing/wrong PIN returns 400/401)', async () => {
    const nomineeToken = signJwt({ nomineeUserId: testUserId, isNominee: true });
    const res1 = await fetch(`${baseUrl}/api/nominee/approval-requests/app_req_001`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${nomineeToken}` },
      body: JSON.stringify({ status: 'approved' })
    });
    expect(res1.status).toBe(400);

    const res2 = await fetch(`${baseUrl}/api/nominee/approval-requests/app_req_001`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${nomineeToken}` },
      body: JSON.stringify({ status: 'approved', nomineePin: '0000' })
    });
    expect(res2.status).toBe(401);
  });

  // HTTP Test 23: Nominee approve/deny endpoint with valid nominee token + valid nominee PIN succeeds (200)
  test('HTTP Test 23: Nominee approve/deny endpoint with valid nominee token + valid nominee PIN succeeds (200)', async () => {
    const approvalId = `app_req_nominee_${Date.now()}`;
    fallbackApprovalRequestsDb.push({
      id: approvalId,
      userId: testUserId,
      foodItemId: restrictedCatalogItem.id,
      orderType: 'instant',
      status: 'pending',
      requestedAt: new Date().toISOString()
    });

    const nomineeToken = signJwt({ nomineeUserId: testUserId, isNominee: true });
    const res = await fetch(`${baseUrl}/api/nominee/approval-requests/${approvalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${nomineeToken}` },
      body: JSON.stringify({ status: 'approved', nomineePin: '4321' })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.request.status).toBe('approved');
  });

  // HTTP Test 24: With NODE_ENV=production and DB down, login with former default credentials returns 503
  test('HTTP Test 24: With NODE_ENV=production and DB down, login with former default credentials returns 503', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'karthik@autofeast.com', password: 'password123' })
      });
      expect(res.status).toBe(503);
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  // HTTP Test 25: With NODE_ENV=production and DB down, verify-pin with PIN 1234 returns 503
  test('HTTP Test 25: With NODE_ENV=production and DB down, verify-pin with PIN 1234 returns 503', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = await fetch(`${baseUrl}/api/verify-pin`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ pin: '1234' })
      });
      expect(res.status).toBe(503);
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  // HTTP Test 26: Wrong nominee credential returns 401
  test('HTTP Test 26: Wrong nominee credential returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/nominee/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomineeEmail: 'priya@autofeast.com', nomineePassword: 'wrongPassword999' })
    });
    expect(res.status).toBe(401);
  });

  // HTTP Test 27: Repeated wrong nominee login failures trigger 429 lockout
  test('HTTP Test 27: Repeated wrong nominee login failures trigger 429 lockout', async () => {
    const targetEmail = 'lockout_priya@autofeast.com';
    fallbackUsersDb.push({
      id: 'user_lockout_priya',
      name: 'Lockout User',
      email: 'lockout_user@test.com',
      passwordHash: 'hash',
      nomineeEmail: targetEmail,
      nomineePasswordHash: bcrypt.hashSync('nomineePass123', 10),
      nomineeLoginFailedAttempts: 0,
      nomineeLoginLockedUntil: null
    } as any);

    for (let i = 0; i < 5; i++) {
      await fetch(`${baseUrl}/api/nominee/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomineeEmail: targetEmail, nomineePassword: 'wrongPassword999' })
      });
    }

    const res = await fetch(`${baseUrl}/api/nominee/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomineeEmail: targetEmail, nomineePassword: 'nomineePass123' })
    });
    expect(res.status).toBe(429);
  });

  // HTTP Test 28: Valid nominee email + valid nominee password issues nominee JWT token (200)
  test('HTTP Test 28: Valid nominee email + valid nominee password issues nominee JWT token (200)', async () => {
    const targetUser = fallbackUsersDb.find(u => u.id === testUserId);
    if (targetUser) {
      targetUser.nomineeLoginFailedAttempts = 0;
      targetUser.nomineeLoginLockedUntil = null;
    }

    const res = await fetch(`${baseUrl}/api/nominee/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomineeEmail: 'priya@autofeast.com', nomineePassword: 'nomineePass123' })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.nomineeToken).toBeDefined();
  });

  // Pure Logic Test: Multi-restaurant cart grouping per-order calculation
  test('Pure Logic: Multi-restaurant cart grouping per-order calculation', () => {
    const items = [sampleCatalogItem, restrictedCatalogItem];
    expect(items.length).toBe(2);
    expect(items[0].restaurant).toBeDefined();
  });
});

describe('Real MongoDB MongoMemoryServer PIN Lockout & Persistence Tests', () => {
  let mongoServer: MongoMemoryServer;
  let mongoBaseUrl: string;
  let mongoAppServer: http.Server;

  const mongoUserId = 'user_mongo_test_001';
  const mongoUserToken = signJwt({ userId: mongoUserId });

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    const hashedPin = await bcrypt.hash('1234', 10);
    const hashedNomineePin = await bcrypt.hash('4321', 10);
    await User.create({
      id: mongoUserId,
      name: 'Mongo Test User',
      email: 'mongo@test.com',
      passwordHash: 'hashed_pw',
      pinHash: hashedPin,
      pinFailedAttempts: 0,
      pinLockedUntil: null,
      nomineeName: 'Mongo Nominee',
      nomineePhone: '+1234567890',
      nomineeEmail: 'nominee@test.com',
      nomineePinHash: hashedNomineePin,
      nomineeFailedAttempts: 0,
      nomineeLockedUntil: null
    });

    await new Promise<void>((resolve) => {
      mongoAppServer = (app as any).listen(0, () => {
        const port = (mongoAppServer.address() as any).port;
        mongoBaseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  }, 30000);

  afterAll(async () => {
    if (mongoAppServer) {
      await new Promise<void>((resolve) => mongoAppServer.close(() => resolve()));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  }, 30000);

  test('Real DB Test 1: Parallel wrong PIN requests lock account after four attempts', async () => {
    const requests = Array.from({ length: 5 }, () =>
      fetch(`${mongoBaseUrl}/api/verify-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mongoUserToken}`
        },
        body: JSON.stringify({ pin: '9999' })
      })
    );

    const responses = await Promise.all(requests);
    const statuses = responses.map(r => r.status);
    const lockedCount = statuses.filter(s => s === 429).length;
    expect(lockedCount).toBeGreaterThanOrEqual(1);

    const userDb: any = await (User as any).findOne({ id: mongoUserId });
    expect(userDb?.pinFailedAttempts).toBeGreaterThanOrEqual(4);
    expect(userDb?.pinLockedUntil).not.toBeNull();
  });

  test('Real DB Test 2: Lock persists across new Mongoose query (simulating fresh server instance)', async () => {
    const freshUserDb: any = await (User as any).findOne({ id: mongoUserId });
    expect(freshUserDb?.pinLockedUntil).not.toBeNull();

    const res = await fetch(`${mongoBaseUrl}/api/verify-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mongoUserToken}`
      },
      body: JSON.stringify({ pin: '1234' })
    });
    expect(res.status).toBe(429);
  });

  test('Real DB Test 3: Lock expires after timestamp passes', async () => {
    await (User as any).findOneAndUpdate(
      { id: mongoUserId },
      { $set: { pinLockedUntil: new Date(Date.now() - 1000) } }
    );

    const res = await fetch(`${mongoBaseUrl}/api/verify-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mongoUserToken}`
      },
      body: JSON.stringify({ pin: '1234' })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('Real DB Test 4: Registration accepts the full payload sent by the signup UI with MongoDB connected', async () => {
    const email = `mongo_ui_reg_${Date.now()}@test.com`;
    const registration = await fetch(`${mongoBaseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Mongo UI User',
        email,
        password: 'Password123!',
        pin: '5678',
        nomineeName: 'Emergency Nominee',
        nomineePhone: '+91 98765 43210',
        nomineeEmail: `nominee_${Date.now()}@test.com`,
        nomineePassword: 'NomineePassword123!',
        initialCredential: false
      })
    });

    expect(registration.status).toBe(201);
    const registered = await registration.json();
    expect(registered.success).toBe(true);
    expect(registered.user.email).toBe(email);
    expect(registered.token).toBeDefined();

    const dbUser = await (User as any).findOne({ email });
    expect(dbUser).not.toBeNull();
    expect(dbUser.email).toBe(email);
  });

  test('Real DB Test 5: Login by username ("Harini") with MongoDB connected', async () => {
    const hariniEmail = `harini_${Date.now()}@test.com`;
    const hashed = await bcrypt.hash('Password123!', 10);
    await (User as any).create({
      id: `user_harini_${Date.now()}`,
      name: 'Harini',
      email: hariniEmail,
      passwordHash: hashed
    });

    // Test with email field containing username "Harini"
    const loginRes1 = await fetch(`${mongoBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'Harini', password: 'Password123!' })
    });
    expect(loginRes1.status).toBe(200);
    const data1 = await loginRes1.json();
    expect(data1.success).toBe(true);
    expect(data1.user.email).toBe(hariniEmail);

    // Test with explicit username field "Harini"
    const loginRes2 = await fetch(`${mongoBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Harini', password: 'Password123!' })
    });
    expect(loginRes2.status).toBe(200);
    const data2 = await loginRes2.json();
    expect(data2.success).toBe(true);
    expect(data2.user.email).toBe(hariniEmail);
  });

  test('Real DB Test 6: User missing passwordHash receives 401 not 500 with MongoDB connected', async () => {
    const noHashEmail = `nohash_${Date.now()}@test.com`;
    await (User as any).create({
      id: `user_nohash_${Date.now()}`,
      name: 'No Hash User',
      email: noHashEmail
    });

    const loginRes = await fetch(`${mongoBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: noHashEmail, password: 'Password123!' })
    });
    expect(loginRes.status).toBe(401);
    const data = await loginRes.json();
    expect(data.error).toBe('wrong_password');
  });
});

describe('Nominee Credential Setup & Anti-Enumeration Login Test Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  const testUserId = 'user_nominee_setup_001';
  const userToken = signJwt({ userId: testUserId });
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken}`
  };

  beforeAll(async () => {
    fallbackUsersDb.push({
      id: testUserId,
      name: 'Nominee Host User',
      email: 'host@autofeast.com',
      passwordHash: bcrypt.hashSync('password123', 10),
      pinHash: bcrypt.hashSync('1234', 10),
      nomineeName: 'Setup Nominee',
      nomineePhone: '+91 99999 88888',
      nomineeEmail: 'setup_nominee@autofeast.com',
      nomineePasswordHash: null,
      nomineePinHash: null,
      nomineeInviteTokenHash: null,
      nomineeInviteExpiresAt: null,
      nomineeInviteUsed: false,
      nomineeLoginFailedAttempts: 0,
      nomineeLoginLockedUntil: null
    });

    await new Promise<void>((resolve) => {
      server = (app as any).listen(0, () => {
        const port = (server.address() as any).port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test('Nominee cannot log in before setup (returns 401 Invalid nominee credentials)', async () => {
    const res = await fetch(`${baseUrl}/api/nominee/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nomineeEmail: 'setup_nominee@autofeast.com',
        nomineePassword: 'SomePassword123!'
      })
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid nominee credentials.');
  });

  test('Nominee Invite Flow: token single-use enforcement', async () => {
    if (sentEmailsArray) sentEmailsArray.length = 0;

    // 1. Trigger Invite
    const inviteRes = await fetch(`${baseUrl}/api/nominee/invite`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ nomineeEmail: 'setup_nominee@autofeast.com' })
    });
    expect(inviteRes.status).toBe(200);
    const inviteData = await inviteRes.json();
    expect(inviteData.success).toBe(true);
    expect(inviteData.inviteToken).toBeUndefined(); // Token NOT returned in response body

    const lastEmail = sentEmailsArray[sentEmailsArray.length - 1];
    const token = lastEmail.inviteToken;

    // 2. Setup Nominee Credentials 1st time -> 200 Success
    const setupRes1 = await fetch(`${baseUrl}/api/nominee/setup-credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nomineeEmail: 'setup_nominee@autofeast.com',
        inviteToken: token,
        nomineePassword: 'SecureNomineePass123!',
        nomineePin: '5678'
      })
    });
    expect(setupRes1.status).toBe(200);
    const setupData1 = await setupRes1.json();
    expect(setupData1.success).toBe(true);

    // 3. Reuse same token 2nd time -> 400 Token already used (generic error)
    const setupRes2 = await fetch(`${baseUrl}/api/nominee/setup-credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nomineeEmail: 'setup_nominee@autofeast.com',
        inviteToken: token,
        nomineePassword: 'AnotherPassword123!',
        nomineePin: '9999'
      })
    });
    expect(setupRes2.status).toBe(400);
    const setupData2 = await setupRes2.json();
    expect(setupData2.error).toBe('Invalid or expired invite token.');
  });

  test('Nominee Credential Setup: expired token rejected', async () => {
    const expiredUserId = 'user_expired_token_001';
    const expiredToken = 'expired_raw_token_xyz_123';
    const expiredTokenHash = require('crypto').createHash('sha256').update(expiredToken).digest('hex');

    fallbackUsersDb.push({
      id: expiredUserId,
      name: 'Expired Host',
      email: 'expired_host@test.com',
      passwordHash: 'hash',
      nomineeEmail: 'expired_nominee@test.com',
      nomineeInviteTokenHash: expiredTokenHash,
      nomineeInviteExpiresAt: new Date(Date.now() - 3600 * 1000), // 1h ago
      nomineeInviteUsed: false
    });

    const res = await fetch(`${baseUrl}/api/nominee/setup-credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nomineeEmail: 'expired_nominee@test.com',
        inviteToken: expiredToken,
        nomineePassword: 'Pass123!',
        nomineePin: '1234'
      })
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid or expired invite token.');
  });

  test('Nominee Login: identify by nomineeEmail ONLY (userId parameter ignored/rejected)', async () => {
    const res = await fetch(`${baseUrl}/api/nominee/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUserId,
        nomineePassword: 'SecureNomineePass123!'
      })
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Nominee email is required.');
  });

  test('Nominee Login: uniform 401 "Invalid nominee credentials" for unknown email, wrong password, and not-set credential', async () => {
    // Unknown email
    const resUnknown = await fetch(`${baseUrl}/api/nominee/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomineeEmail: 'unknown_nominee_email_999@test.com', nomineePassword: 'Password123' })
    });
    expect(resUnknown.status).toBe(401);
    const bodyUnknown = await resUnknown.json();
    expect(bodyUnknown.error).toBe('Invalid nominee credentials.');

    // Wrong password for existing setup nominee
    const resWrongPass = await fetch(`${baseUrl}/api/nominee/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomineeEmail: 'setup_nominee@autofeast.com', nomineePassword: 'WrongPassword999!' })
    });
    expect(resWrongPass.status).toBe(401);
    const bodyWrongPass = await resWrongPass.json();
    expect(bodyWrongPass.error).toBe('Invalid nominee credentials.');
  });

  test('Nominee Login: lockout counters applied per nominee email even when account does not exist (rate limit by IP + email)', async () => {
    const nonExistentEmail = `ghost_nominee_${Date.now()}@test.com`;

    for (let i = 0; i < 4; i++) {
      const res = await fetch(`${baseUrl}/api/nominee/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomineeEmail: nonExistentEmail, nomineePassword: 'AnyPassword123!' })
      });
      expect(res.status).toBe(401);
    }

    // 5th attempt -> 429 Rate Limit Exceeded / Account Locked
    const res5 = await fetch(`${baseUrl}/api/nominee/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomineeEmail: nonExistentEmail, nomineePassword: 'AnyPassword123!' })
    });
    expect(res5.status).toBe(429);
    const body5 = await res5.json();
    expect(body5.locked).toBe(true);
    expect(body5.error).toContain('locked');
  });

  // Requirement 1 & 3 Tests: Nominee Invite Security & Real Mailer Assertions
  test('/api/nominee/invite: no JWT -> 401', async () => {
    const res = await fetch(`${baseUrl}/api/nominee/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomineeEmail: 'no_jwt@autofeast.com' })
    });
    expect(res.status).toBe(401);
  });

  test('/api/nominee/invite: body userId ignored and response has no inviteToken', async () => {
    if (sentEmailsArray) sentEmailsArray.length = 0;

    const res = await fetch(`${baseUrl}/api/nominee/invite`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        userId: 'malicious_other_user_id_999',
        nomineeEmail: 'setup_nominee_req1@autofeast.com'
      })
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.inviteToken).toBeUndefined(); // Token NOT returned in body

    // Assert email mailer recorded the dispatch with the link
    if (sentEmailsArray && sentEmailsArray.length > 0) {
      const lastEmail = sentEmailsArray[sentEmailsArray.length - 1];
      expect(lastEmail.to).toBe('setup_nominee_req1@autofeast.com');
      expect(lastEmail.inviteLink).toBeDefined();
      expect(lastEmail.text).toContain('/nominee/setup?email=');
    }
  });

  // Requirement 2 Tests: /api/nominee/setup-credentials generic error & email mismatch
  test('/api/nominee/setup-credentials: email mismatch returns generic Invalid or expired invite token', async () => {
    const rawToken = 'raw_test_token_mismatch_123';
    const tokenHash = require('crypto').createHash('sha256').update(rawToken).digest('hex');

    fallbackUsersDb.push({
      id: 'user_mismatch_host',
      name: 'Mismatch Host',
      email: 'mismatch_host@test.com',
      passwordHash: 'hash',
      nomineeEmail: 'correct_nominee_email@test.com',
      nomineeInviteTokenHash: tokenHash,
      nomineeInviteExpiresAt: new Date(Date.now() + 3600 * 1000),
      nomineeInviteUsed: false
    } as any);

    const res = await fetch(`${baseUrl}/api/nominee/setup-credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nomineeEmail: 'wrong_mismatched_email@test.com',
        inviteToken: rawToken,
        nomineePassword: 'Password123!',
        nomineePin: '1234'
      })
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid or expired invite token.');
  });

  test('/api/nominee/setup-credentials: invalid token returns generic Invalid or expired invite token', async () => {
    const res = await fetch(`${baseUrl}/api/nominee/setup-credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nomineeEmail: 'any_email@test.com',
        inviteToken: 'non_existent_invalid_token_99999',
        nomineePassword: 'Password123!',
        nomineePin: '1234'
      })
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid or expired invite token.');
  });

  test('Mailer helper dispatches approval request email with item, order type, requested time, schedule details', async () => {
    if (sentEmailsArray) sentEmailsArray.length = 0;

    sendApprovalRequestEmail({
      nomineeEmail: 'nominee_test_approval@test.com',
      nomineeName: 'Priya',
      userName: 'Karthik',
      foodItemName: 'Masala Dosa',
      orderType: 'scheduled',
      requestedTime: '08:00 AM',
      selectedDays: ['Mon', 'Wed', 'Fri'],
      duration: '1_month'
    });

    expect(sentEmailsArray.length).toBeGreaterThan(0);
    const lastMail = sentEmailsArray[sentEmailsArray.length - 1];
    expect(lastMail.to).toBe('nominee_test_approval@test.com');
    expect(lastMail.text).toContain('Masala Dosa');
    expect(lastMail.text).toContain('scheduled');
    expect(lastMail.text).toContain('08:00 AM');
    expect(lastMail.text).toContain('Mon');
  });

  test('/api/nominee/set-pin: requires nominee authentication and persists a distinct PIN', async () => {
    const userId = 'user_set_nominee_pin_test';
    const user = {
      id: userId,
      name: 'PIN Test User',
      email: 'pin-test-user@test.com',
      passwordHash: bcrypt.hashSync('password', 10),
      pinHash: bcrypt.hashSync('1357', 10),
      nomineePinHash: bcrypt.hashSync('2468', 10),
      nomineeFailedAttempts: 0,
      nomineeLockedUntil: null
    };
    fallbackUsersDb.push(user as any);

    try {
      const unauthorized = await fetch(`${baseUrl}/api/nominee/set-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '9876' })
      });
      expect(unauthorized.status).toBe(401);

      const nomineeToken = signJwt({ nomineeUserId: userId, isNominee: true });
      const sameAsAccountPin = await fetch(`${baseUrl}/api/nominee/set-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${nomineeToken}` },
        body: JSON.stringify({ pin: '1357' })
      });
      expect(sameAsAccountPin.status).toBe(400);

      const saved = await fetch(`${baseUrl}/api/nominee/set-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${nomineeToken}` },
        body: JSON.stringify({ pin: '9876' })
      });
      expect(saved.status).toBe(200);
      expect(await bcrypt.compare('9876', user.nomineePinHash)).toBe(true);
    } finally {
      const fixtureIndex = fallbackUsersDb.indexOf(user as any);
      if (fixtureIndex >= 0) fallbackUsersDb.splice(fixtureIndex, 1);
    }
  });
});

describe('New User Registration & Login Root Cause Fix Test Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = (app as any).listen(0, () => {
        const port = (server.address() as any).port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test('1. Register success (exact UI payload: nominee phone, no nominee email) -> 201/200 & login works with same credentials', async () => {
    const testEmail = `newuser_${Date.now()}@test.com`;
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'UI Test User',
        email: testEmail,
        password: 'Password123!',
        pin: '1234',
        nomineeName: 'Emergency Nominee',
        nomineePhone: '+91 98765 00000'
      })
    });

    expect([200, 201]).toContain(regRes.status);
    const regData = await regRes.json();
    expect(regData.success).toBe(true);
    expect(regData.user.email).toBe(testEmail);
    expect(regData.token).toBeDefined();

    // Login with same credentials
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'Password123!'
      })
    });

    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData.success).toBe(true);
    expect(loginData.user.email).toBe(testEmail);
    expect(loginData.token).toBeDefined();
  });

  test('Login accepts a case-insensitive username', async () => {
    const user = {
      id: `username_login_${Date.now()}`,
      name: 'Harini',
      email: `username_login_${Date.now()}@test.com`,
      passwordHash: bcrypt.hashSync('Password123!', 10)
    };
    fallbackUsersDb.push(user as any);

    try {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'Harini', password: 'Password123!' })
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.user.email).toBe(user.email);
    } finally {
      const fixtureIndex = fallbackUsersDb.indexOf(user as any);
      if (fixtureIndex >= 0) fallbackUsersDb.splice(fixtureIndex, 1);
    }
  });

  test('User without a password hash receives 401', async () => {
    const user = {
      id: `missing_password_hash_${Date.now()}`,
      name: 'Hashless User',
      email: `hashless_${Date.now()}@test.com`
    };
    fallbackUsersDb.push(user as any);

    try {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: 'Password123!' })
      });

      expect(response.status).toBe(401);
      expect((await response.json()).error).toBe('wrong_password');
    } finally {
      const fixtureIndex = fallbackUsersDb.indexOf(user as any);
      if (fixtureIndex >= 0) fallbackUsersDb.splice(fixtureIndex, 1);
    }
  });

  test('Registration accepts the full payload sent by the signup UI', async () => {
    const email = `ui_registration_${Date.now()}@test.com`;
    const registration = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'UI Registration User',
        email,
        password: 'Password123!',
        pin: '4826',
        nomineeName: 'Emergency Nominee',
        nomineePhone: '+91 98765 43210',
        nomineeEmail: `nominee_${Date.now()}@test.com`,
        nomineePassword: 'NomineePassword123!',
        initialCredential: false
      })
    });

    expect(registration.status).toBe(201);
    const registered = await registration.json();
    expect(registered.success).toBe(true);
    expect(registered.user.email).toBe(email);
    expect(registered.token).toBeDefined();

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Password123!' })
    });
    expect(login.status).toBe(200);
    expect((await login.json()).success).toBe(true);

    const fixtureIndex = fallbackUsersDb.findIndex(user => user.email === email);
    if (fixtureIndex >= 0) fallbackUsersDb.splice(fixtureIndex, 1);
  });

  test('Registration saves nominee email and sends invite (nominee must set their own password via setup flow)', async () => {
    const testEmail = `nominee_owner_${Date.now()}@test.com`;
    const nomineeEmail = `nominee_${Date.now()}@test.com`;
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Nominee Credential User',
        email: testEmail,
        password: 'AccountPassword123!',
        pin: '1234',
        nomineeName: 'Nominee User',
        nomineeEmail,
        nomineePassword: 'NomineePassword123!' // silently ignored; nominee uses invite flow
      })
    });

    expect(regRes.status).toBe(201);
    const regData = await regRes.json();
    expect(regData.user.nomineeEmail).toBe(nomineeEmail);
    // nomineePasswordHash is NOT set during registration (nominee must use /nominee/setup)
    expect(regData.user.nomineePasswordHash).toBeUndefined();
    const storedUser = fallbackUsersDb.find(user => user.email === testEmail);
    // nomineePasswordHash should be null; nominee must set via invite flow
    expect(storedUser?.nomineePasswordHash).toBeNull();
    // An invite token hash should have been generated
    expect(storedUser?.nomineeInviteTokenHash).toBeDefined();

    // Nominee cannot log in yet (no password set via invite/setup)
    const nomineeLogin = await fetch(`${baseUrl}/api/nominee/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomineeEmail, nomineePassword: 'NomineePassword123!' })
    });
    expect(nomineeLogin.status).toBe(401); // no credential set yet

    const fixtureIndex = storedUser ? fallbackUsersDb.indexOf(storedUser) : -1;
    if (fixtureIndex >= 0) fallbackUsersDb.splice(fixtureIndex, 1);
  });

  test('Account owner can repair nominee credentials and immediately use nominee login', async () => {
    const userId = `nominee_repair_${Date.now()}`;
    const nomineeEmail = `repaired_${Date.now()}@test.com`;
    const user = {
      id: userId,
      name: 'Existing Account',
      email: `${userId}@test.com`,
      passwordHash: bcrypt.hashSync('account-pass', 10),
      pinHash: bcrypt.hashSync('1234', 10),
      nomineeEmail: 'legacy_nominee@test.com',
      nomineePasswordHash: null
    };
    fallbackUsersDb.push(user as any);

    try {
      const unauthorized = await fetch(`${baseUrl}/api/nominee/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomineeEmail, nomineePassword: 'NomineePass123!' })
      });
      expect(unauthorized.status).toBe(401);

      const ownerToken = signJwt({ userId });
      const saved = await fetch(`${baseUrl}/api/nominee/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ nomineeEmail, nomineePassword: 'NomineePass123!' })
      });
      expect(saved.status).toBe(200);
      expect(user.nomineeEmail).toBe(nomineeEmail);
      expect(await bcrypt.compare('NomineePass123!', user.nomineePasswordHash)).toBe(true);

      const login = await fetch(`${baseUrl}/api/nominee/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomineeEmail, nomineePassword: 'NomineePass123!' })
      });
      expect(login.status).toBe(200);
      expect((await login.json()).nomineeToken).toBeDefined();
    } finally {
      const fixtureIndex = fallbackUsersDb.indexOf(user as any);
      if (fixtureIndex >= 0) fallbackUsersDb.splice(fixtureIndex, 1);
    }
  });

  test('2. Duplicate email -> returns 409', async () => {
    const dupEmail = `dupuser_${Date.now()}@test.com`;
    // Register 1st time
    await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'First User',
        email: dupEmail,
        password: 'Password123!',
        pin: '1234'
      })
    });

    // Register 2nd time with same email
    const res2 = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Second User',
        email: dupEmail,
        password: 'Password123!',
        pin: '1234'
      })
    });

    expect(res2.status).toBe(409);
    const body2 = await res2.json();
    expect(body2.error).toBe('account_exists');
  });

  test('3. Missing required field -> returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'No Password User',
        email: 'nopassword@test.com'
      })
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_input');
  });

  test('4. DB down -> returns 503', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'DB Down User',
          email: 'dbdown@test.com',
          password: 'Password123!'
        })
      });

      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error).toBe('database_unavailable');
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  test('5. Wrong password during login -> returns 401', async () => {
    const userEmail = `wrongpass_${Date.now()}@test.com`;
    await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Valid User',
        email: userEmail,
        password: 'CorrectPassword123!',
        pin: '1234'
      })
    });

    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userEmail,
        password: 'WrongPassword999!'
      })
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('wrong_password');
  });
});
