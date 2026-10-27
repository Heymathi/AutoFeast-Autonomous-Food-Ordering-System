/**
 * AutoFeast – Nominee Approval Flow Tests
 * Tests the email-link path and website path for nominee approval decisions.
 * Requirements: email approve once, second click fails, website after email = 409,
 * expired = 400, wrong PIN = 400, user token = 403.
 */
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import serverModule, {
  signJwt,
  fallbackApprovalRequestsDb,
  fallbackUsersDb,
  sentEmailsArray
} from '../server.js';
import http from 'http';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const app = serverModule || (serverModule as any).default;

// Helper: SHA-256 hash (mirrors what nomineeApproval.js does internally)
const hashToken = (raw: string) => crypto.createHash('sha256').update(String(raw)).digest('hex');

describe('Nominee Approval Flow – email-decision and website-decision', () => {
  let server: http.Server;
  let baseUrl: string;

  const testUserId = 'nominee_flow_user_001';
  const nomineePin   = '9876';
  const userToken    = signJwt({ userId: testUserId });
  const nomineeToken = signJwt({ nomineeUserId: testUserId, isNominee: true, role: 'nominee' });

  // Build a helper that creates a fresh approval record in the fallback DB
  function makeApproval(overrides: Record<string, unknown> = {}) {
    const id = `approval_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const raw = crypto.randomBytes(32).toString('base64url');
    const record: Record<string, unknown> = {
      id,
      userId: testUserId,
      foodItemId: 'test-food-001',
      foodItem: { name: 'Test Biryani', id: 'test-food-001' },
      orderType: 'instant',
      status: 'pending',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      emailTokenHash: hashToken(raw),
      requestedAt: new Date().toISOString()
    };
    Object.assign(record, overrides);
    fallbackApprovalRequestsDb.push(record as any);
    return { id, raw, record };
  }

  beforeAll(async () => {
    // Seed test user
    fallbackUsersDb.push({
      id: testUserId,
      name: 'Approval Tester',
      email: 'approvaltest@autofeast.com',
      passwordHash: bcrypt.hashSync('pass123', 10),
      pinHash: bcrypt.hashSync('1234', 10),
      nomineeName: 'Test Nominee',
      nomineeEmail: 'nominee_approval@autofeast.com',
      nomineePinHash: bcrypt.hashSync(nomineePin, 10),
      nomineePasswordHash: bcrypt.hashSync('nomineePass123', 10),
      nomineeFailedAttempts: 0,
      nomineeLockedUntil: null
    } as any);

    if (sentEmailsArray) sentEmailsArray.length = 0;

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

  beforeEach(() => {
    // Remove approval records for this user between tests to avoid bleed
    for (let i = fallbackApprovalRequestsDb.length - 1; i >= 0; i--) {
      if ((fallbackApprovalRequestsDb[i] as any).userId === testUserId) {
        fallbackApprovalRequestsDb.splice(i, 1);
      }
    }
  });

  // -----------------------------------------------------------------------
  // Test 1: Email approve link works once (GET shows confirm page, POST approves)
  // -----------------------------------------------------------------------
  test('Test 1: Email approve: GET shows confirm page, POST approves and returns 200', async () => {
    const { raw } = makeApproval();

    // GET should render a confirm page (not change state)
    const getRes = await fetch(`${baseUrl}/api/nominee/email-decision?token=${raw}&d=approve`);
    expect(getRes.status).toBe(200);
    const html = await getRes.text();
    expect(html).toContain('Confirm decision');
    expect(html).toContain('Approve');

    // POST should actually approve
    const postRes = await fetch(`${baseUrl}/api/nominee/email-decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: raw, decision: 'approve' }).toString()
    });
    expect(postRes.status).toBe(200);
    const postHtml = await postRes.text();
    expect(postHtml).toContain('Approved');
  });

  // -----------------------------------------------------------------------
  // Test 2: Second email-decision POST on the same token fails (already decided)
  // -----------------------------------------------------------------------
  test('Test 2: Second email POST click returns 400 (link already used)', async () => {
    const { raw } = makeApproval();

    // First approve succeeds
    await fetch(`${baseUrl}/api/nominee/email-decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: raw, decision: 'approve' }).toString()
    });

    // Second click must fail
    const secondRes = await fetch(`${baseUrl}/api/nominee/email-decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: raw, decision: 'approve' }).toString()
    });
    expect(secondRes.status).toBe(400);
    const html = await secondRes.text();
    expect(html.toLowerCase()).toMatch(/already|expired|not valid/);
  });

  // -----------------------------------------------------------------------
  // Test 3: Website decision after email decision returns 409 (already decided)
  // -----------------------------------------------------------------------
  test('Test 3: Website decision after email decision returns 409', async () => {
    const { id, raw } = makeApproval();

    // Approve via email first
    await fetch(`${baseUrl}/api/nominee/email-decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: raw, decision: 'approve' }).toString()
    });

    // Now try website path – should return 409
    const websiteRes = await fetch(`${baseUrl}/api/nominee/approvals/${id}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${nomineeToken}`
      },
      body: JSON.stringify({ decision: 'approve', pin: nomineePin })
    });
    expect(websiteRes.status).toBe(409);
    const body = await websiteRes.json();
    expect(body.success).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Test 4: Expired request returns 400
  // -----------------------------------------------------------------------
  test('Test 4: Expired email token returns 400 on GET', async () => {
    const { raw } = makeApproval({
      expiresAt: new Date(Date.now() - 1000) // already expired
    });

    const res = await fetch(`${baseUrl}/api/nominee/email-decision?token=${raw}&d=approve`);
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html.toLowerCase()).toMatch(/invalid|expired|not valid/);
  });

  // -----------------------------------------------------------------------
  // Test 5: Wrong PIN is rejected (website path)
  // -----------------------------------------------------------------------
  test('Test 5: Wrong PIN is rejected on website path (400)', async () => {
    const { id } = makeApproval();

    const res = await fetch(`${baseUrl}/api/nominee/approvals/${id}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${nomineeToken}`
      },
      body: JSON.stringify({ decision: 'approve', pin: '0000' }) // wrong PIN
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/incorrect|pin/i);
  });

  // -----------------------------------------------------------------------
  // Test 6: Nominee decision with a regular user token returns 403
  // -----------------------------------------------------------------------
  test('Test 6: User JWT (not nominee JWT) on website decision path returns 403', async () => {
    const { id } = makeApproval();

    const res = await fetch(`${baseUrl}/api/nominee/approvals/${id}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}` // regular user token, not nominee
      },
      body: JSON.stringify({ decision: 'approve', pin: nomineePin })
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Test 7: Expired approval request on website decision path returns 400
  // -----------------------------------------------------------------------
  test('Test 7: Expired approval on website path returns 400', async () => {
    const { id } = makeApproval({
      expiresAt: new Date(Date.now() - 1000) // already expired
    });

    const res = await fetch(`${baseUrl}/api/nominee/approvals/${id}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${nomineeToken}`
      },
      body: JSON.stringify({ decision: 'approve', pin: nomineePin })
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/expired/i);
  });
});
