import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import express from 'express';
import { registerNomineeApproval } from '../../nomineeApproval.js';
import { processRestrictedOrderOrSchedule } from '../../server.js';
import { fallbackApprovalRequestsDb, fallbackRestrictedItemsDb, fallbackUsersDb, sentEmailsArray } from '../../server.js';

const hashToken = (raw: string) => crypto.createHash('sha256').update(String(raw)).digest('hex');

describe('Nominee Email Approval System (Instant + Scheduled Orders, EN/TA/HI)', () => {
  const testUserId = `user_nominee_${Date.now()}`;
  let app: express.Express;
  let nomineeModule: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    sentEmailsArray.length = 0;
    fallbackApprovalRequestsDb.length = 0;
    fallbackRestrictedItemsDb.length = 0;

    // Seed test user with nominee
    fallbackUsersDb.push({
      id: testUserId,
      name: 'Karthik',
      email: 'karthik@test.com',
      nomineeName: 'Guardian Nominee',
      nomineeEmail: 'guardian@test.com',
      preferredLanguage: 'en',
      restrictedFoodIds: ['test-biryani-01']
    } as any);

    // Mock dependencies for registerNomineeApproval
    nomineeModule = registerNomineeApproval({
      app,
      express,
      mongoose: {
        connection: { readyState: 0, host: null } // fallback in-memory mode
      },
      User: null,
      ApprovalRequest: null,
      fallbackUsersDb,
      fallbackApprovalRequestsDb,
      verifyJwt: () => null,
      sendEmail: async (opts: any) => {
        sentEmailsArray.push(opts);
        return { success: true };
      },
      checkRateLimit: () => ({ allowed: true }),
      recordFailedLogin: () => {},
      connectDB: async () => {}
    });
  });

  describe('1. Approval Creation & Expiry TTLs', () => {
    it('creates instant order approval with 30 min expiry and single-use token hash', async () => {
      const rawToken = crypto.randomBytes(32).toString('base64url');
      const tokenHash = hashToken(rawToken);
      const now = Date.now();

      const approval = {
        id: 'REQ-INSTANT-01',
        userId: testUserId,
        foodItemId: 'test-biryani-01',
        foodItem: { id: 'test-biryani-01', name: 'Mutton Biryani' },
        orderType: 'instant',
        status: 'pending',
        used: false,
        emailTokenHash: tokenHash,
        expiresAt: new Date(now + 30 * 60 * 1000), // 30 mins
        language: 'en',
        nomineeEmail: 'guardian@test.com',
        nomineeName: 'Guardian'
      };
      fallbackApprovalRequestsDb.push(approval as any);

      expect(approval.orderType).toBe('instant');
      expect(approval.status).toBe('pending');
      expect(approval.used).toBe(false);
      expect(approval.expiresAt.getTime() - now).toBeLessThanOrEqual(30 * 60 * 1000 + 50);
      expect(approval.expiresAt.getTime() - now).toBeGreaterThanOrEqual(30 * 60 * 1000 - 50);
    });

    it('creates scheduled order approval with 24 hr expiry', async () => {
      const now = Date.now();
      const approval = {
        id: 'REQ-SCHED-01',
        userId: testUserId,
        foodItemId: 'test-biryani-01',
        foodItem: { id: 'test-biryani-01', name: 'Mutton Biryani' },
        orderType: 'scheduled',
        scheduleDetails: { time: '01:00 PM', slotName: 'Lunch Slot', duration: '1_week', frequency: 'daily' },
        status: 'pending',
        used: false,
        expiresAt: new Date(now + 24 * 60 * 60 * 1000), // 24 hours
        language: 'ta'
      };
      fallbackApprovalRequestsDb.push(approval as any);

      expect(approval.orderType).toBe('scheduled');
      expect(approval.expiresAt.getTime() - now).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 100);
    });
  });

  describe('2. Multilingual Email Dispatch (EN, TA, HI)', () => {
    it('dispatches email in English with Approve & Deny links and both item names', async () => {
      const user = fallbackUsersDb.find(u => u.id === testUserId);
      const approval = {
        id: 'REQ-EMAIL-EN',
        userId: testUserId,
        foodItemId: 'test-dosa-01',
        foodItem: { id: 'test-dosa-01', name: 'Ghee Roast Dosa', nativeNames: { en: 'Ghee Roast Dosa', ta: 'நெய் ரோஸ்ட் தோசை' } },
        orderType: 'instant',
        language: 'en'
      };

      await nomineeModule.dispatchApprovalEmail(approval, user);
      expect(sentEmailsArray.length).toBe(1);

      const sent = sentEmailsArray[0];
      expect(sent.to).toBe('guardian@test.com');
      expect(sent.subject).toContain('Approval Required: Karthik wants to order');
      expect(sent.html).toContain('NOMINEE APPROVAL REQUEST');
      expect(sent.html).toContain('d=approve');
      expect(sent.html).toContain('d=deny');
    });

    it('dispatches email in Tamil with Tamil subject, body and labels', async () => {
      const user = fallbackUsersDb.find(u => u.id === testUserId);
      const approval = {
        id: 'REQ-EMAIL-TA',
        userId: testUserId,
        foodItemId: 'test-dosa-01',
        foodItem: { id: 'test-dosa-01', name: 'Ghee Roast Dosa', nativeNames: { ta: 'நெய் ரோஸ்ட் தோசை' } },
        orderType: 'scheduled',
        scheduleDetails: { time: '08:00 AM', selectedDays: ['Mon', 'Wed'], duration: '1 week' },
        language: 'ta'
      };

      await nomineeModule.dispatchApprovalEmail(approval, user);
      expect(sentEmailsArray.length).toBe(1);

      const sent = sentEmailsArray[0];
      expect(sent.subject).toContain('பரிந்துரையாளர் ஒப்புதல் தேவை');
      expect(sent.html).toContain('நெய் ரோஸ்ட் தோசை');
      expect(sent.html).toContain('அனுமதி (Approve)');
      expect(sent.html).toContain('நிராகரி (Deny)');
    });

    it('dispatches email in Hindi with Hindi subject, body and labels', async () => {
      const user = fallbackUsersDb.find(u => u.id === testUserId);
      const approval = {
        id: 'REQ-EMAIL-HI',
        userId: testUserId,
        foodItemId: 'test-biryani-01',
        foodItem: { id: 'test-biryani-01', name: 'Mutton Biryani', nativeNames: { hi: 'मटन बिरयानी' } },
        orderType: 'instant',
        language: 'hi'
      };

      await nomineeModule.dispatchApprovalEmail(approval, user);
      expect(sentEmailsArray.length).toBe(1);

      const sent = sentEmailsArray[0];
      expect(sent.subject).toContain('नॉमिनी स्वीकृति आवश्यक');
      expect(sent.html).toContain('मटन बिरयानी');
      expect(sent.html).toContain('स्वीकृति दें (Approve)');
      expect(sent.html).toContain('अस्वीकार करें (Deny)');
    });
  });

  describe('3. Atomic Decision Execution & Single-Use Tokens', () => {
    it('records approval decision and invalidates single-use token', async () => {
      const rawToken = crypto.randomBytes(32).toString('base64url');
      const tokenHash = hashToken(rawToken);

      const approval = {
        id: 'REQ-DECIDE-01',
        userId: testUserId,
        foodItemId: 'test-biryani-01',
        foodItem: { id: 'test-biryani-01', name: 'Mutton Biryani' },
        orderType: 'instant',
        status: 'pending',
        used: false,
        emailTokenHash: tokenHash,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      };
      fallbackApprovalRequestsDb.push(approval as any);

      // 1. Decide via approve
      const result = await nomineeModule.decideApproval({ emailTokenHash: tokenHash }, 'approve', 'email');
      expect(result).not.toBeNull();
      expect(result.status).toBe('approved');
      expect(result.emailTokenHash).toBeNull();
      expect(result.decidedVia).toBe('email');

      // 2. Second click on same token hash returns null (already consumed)
      const secondTry = await nomineeModule.decideApproval({ emailTokenHash: tokenHash }, 'approve', 'email');
      expect(secondTry).toBeNull();
    });

    it('records deny decision and marks status as denied', async () => {
      const rawToken = crypto.randomBytes(32).toString('base64url');
      const tokenHash = hashToken(rawToken);

      const approval = {
        id: 'REQ-DENY-01',
        userId: testUserId,
        foodItemId: 'test-biryani-01',
        foodItem: { id: 'test-biryani-01', name: 'Mutton Biryani' },
        orderType: 'instant',
        status: 'pending',
        used: false,
        emailTokenHash: tokenHash,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      };
      fallbackApprovalRequestsDb.push(approval as any);

      const result = await nomineeModule.decideApproval({ emailTokenHash: tokenHash }, 'deny', 'email');
      expect(result.status).toBe('denied');
      expect(result.emailTokenHash).toBeNull();
    });

    it('rejects expired token', async () => {
      const rawToken = crypto.randomBytes(32).toString('base64url');
      const tokenHash = hashToken(rawToken);

      const expiredApproval = {
        id: 'REQ-EXPIRED-01',
        userId: testUserId,
        foodItemId: 'test-biryani-01',
        status: 'pending',
        emailTokenHash: tokenHash,
        expiresAt: new Date(Date.now() - 5000) // 5 seconds in the past
      };
      fallbackApprovalRequestsDb.push(expiredApproval as any);

      const result = await nomineeModule.decideApproval({ emailTokenHash: tokenHash }, 'approve', 'email');
      expect(result).toBeNull();
    });
  });

  describe('4. Server Order Enforcement (HTTP 403 Forbidden on Restricted Items)', () => {
    it('returns 403 when ordering a restricted item without approval', async () => {
      fallbackRestrictedItemsDb.push({
        id: 'REST-01',
        userId: testUserId,
        foodItemId: 'biryani-ambur'
      } as any);

      const result = await processRestrictedOrderOrSchedule({
        userId: testUserId,
        rawItemsPayload: [{ id: 'biryani-ambur', name: 'Ambur Mutton Biryani' }],
        orderType: 'instant'
      });

      expect(result.status).toBe(403);
      expect(result.body.success).toBe(false);
      expect(result.body.requiresNomineeApproval).toBe(true);
      expect(result.body.status).toBe('held_for_approval');
    });

    it('returns 200 and atomically consumes approval when valid approval exists', async () => {
      fallbackRestrictedItemsDb.push({
        id: 'REST-02',
        userId: testUserId,
        foodItemId: 'biryani-ambur'
      } as any);

      const validApproval = {
        id: 'APP-VALID-01',
        userId: testUserId,
        foodItemId: 'biryani-ambur',
        orderType: 'instant',
        status: 'approved',
        used: false,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      };
      fallbackApprovalRequestsDb.push(validApproval as any);

      const firstOrder = await processRestrictedOrderOrSchedule({
        userId: testUserId,
        rawItemsPayload: [{ id: 'biryani-ambur', name: 'Ambur Mutton Biryani' }],
        orderType: 'instant'
      });

      expect(firstOrder.status).toBe(200);
      expect(firstOrder.claimedApprovalIds).toContain('APP-VALID-01');
      expect(validApproval.used).toBe(true);

      // Re-use of the same consumed approval returns 403!
      const secondOrder = await processRestrictedOrderOrSchedule({
        userId: testUserId,
        rawItemsPayload: [{ id: 'biryani-ambur', name: 'Ambur Mutton Biryani' }],
        orderType: 'instant'
      });
      expect(secondOrder.status).toBe(403);
    });

    it('rejects order when approval orderType does not match (instant vs scheduled)', async () => {
      fallbackRestrictedItemsDb.push({
        id: 'REST-03',
        userId: testUserId,
        foodItemId: 'biryani-ambur'
      } as any);

      // Approval was granted for 'instant'
      fallbackApprovalRequestsDb.push({
        id: 'APP-INSTANT-ONLY',
        userId: testUserId,
        foodItemId: 'biryani-ambur',
        orderType: 'instant',
        status: 'approved',
        used: false,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      } as any);

      // Attempting to schedule using an instant approval fails with 403!
      const schedResult = await processRestrictedOrderOrSchedule({
        userId: testUserId,
        rawItemsPayload: { id: 'SCHED-01', slotName: 'Lunch', foodItemId: 'biryani-ambur' },
        orderType: 'scheduled'
      });

      expect(schedResult.status).toBe(403);
      expect(schedResult.body.requiresNomineeApproval).toBe(true);
    });
  });
});
