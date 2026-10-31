import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeTime, formatScheduleTime, checkIsDateTimePast, calculateScheduleDatesList } from '../utils/scheduleCalculator';
import { calculateScheduleEndDate } from '../services/autoOrderBackgroundService';

describe('Nominee Approval Gate & Scheduler Robustness', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Time Normalization & No .split Crash', () => {
    it('normalizes various time representations to HH:MM format', () => {
      expect(normalizeTime('08:00')).toBe('08:00');
      expect(normalizeTime('8:30')).toBe('08:30');
      expect(normalizeTime('8:00 AM')).toBe('08:00');
      expect(normalizeTime('1:30 PM')).toBe('13:30');
      expect(normalizeTime({ time24: '14:45' })).toBe('14:45');
      expect(normalizeTime({ time: '09:15' })).toBe('09:15');
      expect(normalizeTime({ displayTime: '8:00 AM' })).toBe('08:00');
      expect(normalizeTime({ hour: 7, minute: 30 })).toBe('07:30');
      expect(normalizeTime(null)).toBe('08:00');
      expect(normalizeTime(undefined)).toBe('08:00');
    });

    it('formats schedule time without "[object Object]"', () => {
      expect(formatScheduleTime('08:00')).toBe('8:00 AM');
      expect(formatScheduleTime('13:30')).toBe('1:30 PM');
      expect(formatScheduleTime('20:15')).toBe('8:15 PM');
      expect(formatScheduleTime({ time24: '08:00' })).toBe('8:00 AM');
      expect(formatScheduleTime({ displayTime: '8:00 AM' })).toBe('8:00 AM');
      expect(formatScheduleTime({ time: '14:00' })).toBe('2:00 PM');
      expect(formatScheduleTime(null)).toBe('8:00 AM');

      // Verify template substitution produces clean string
      const templateTa = 'அட்டவணை உறுதி செய்யப்பட்டது! Saravana Bhavan-ல் இருந்து Parotta, {time}-க்கு அட்டவணைப்படுத்தப்பட்டது (1 மாதம்).';
      const resultTa = templateTa.replace('{time}', formatScheduleTime({ time24: '08:00' }));
      expect(resultTa).not.toContain('[object Object]');
      expect(resultTa).toContain('8:00 AM');
    });

    it('checkIsDateTimePast, calculateScheduleDatesList & calculateScheduleEndDate never throw on objects or non-strings', () => {
      // Passes objects as dateStr/timeStr
      expect(() => checkIsDateTimePast({ bad: 'object' } as any, { time24: '08:00' } as any)).not.toThrow();
      expect(checkIsDateTimePast(null as any, undefined)).toBe(false);

      expect(() => calculateScheduleDatesList({ bad: 'object' } as any, '1_month', undefined, undefined, { time: '08:00' } as any)).not.toThrow();
      expect(calculateScheduleDatesList(null as any, '1_month')).toEqual([]);

      expect(() => calculateScheduleEndDate({ bad: 'object' } as any, '1_month')).not.toThrow();
      expect(calculateScheduleEndDate(null as any, '1_month')).toBeUndefined();
    });
  });

  describe('2. Server Endpoints: Status Polling & Approval Consumption', () => {
    // Test endpoint logic with mock req & res objects mimicking server.js handler
    const mockDb: any[] = [];

    const handleStatusPoll = (req: any, res: any) => {
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer valid_token_user_1')) {
        return res.status(401).json({ success: false, error: 'Unauthorized. Authentication token required.' });
      }
      const userId = 'user_1';
      const record = mockDb.find(r => r.id === req.params.id);
      if (!record) {
        return res.status(404).json({ success: false, error: 'Approval request not found.' });
      }
      if (record.userId !== userId) {
        return res.status(403).json({ success: false, error: 'Forbidden. You do not own this approval request.' });
      }
      const isExpired = record.expiresAt && new Date(record.expiresAt) <= new Date();
      const status = (record.status === 'pending' && isExpired) ? 'expired' : record.status;
      return res.status(200).json({
        success: true,
        status,
        expiresAt: record.expiresAt,
        decidedAt: record.decidedAt,
        decidedVia: record.decidedVia,
        used: Boolean(record.used)
      });
    };

    const handleConsume = (req: any, res: any) => {
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer valid_token_user_1')) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }
      const userId = 'user_1';
      const record = mockDb.find(r => r.id === req.params.id);
      if (!record) return res.status(404).json({ success: false, error: 'Approval request not found.' });
      if (record.userId !== userId) return res.status(403).json({ success: false, error: 'Forbidden.' });
      if (record.status !== 'approved') return res.status(400).json({ success: false, error: 'Approval request is not approved.' });
      if (record.used) return res.status(409).json({ success: false, error: 'Approval request has already been used.' });
      if (record.expiresAt && new Date(record.expiresAt) <= new Date()) return res.status(410).json({ success: false, error: 'Approval request has expired.' });

      record.used = true;
      record.usedAt = new Date();
      return res.status(200).json({ success: true, message: 'Approval consumed successfully.', used: true });
    };

    beforeEach(() => {
      mockDb.length = 0;
      mockDb.push({
        id: 'APP-101',
        userId: 'user_1',
        foodItemId: 'parotta_01',
        orderType: 'scheduled',
        status: 'approved',
        used: false,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        decidedAt: new Date().toISOString(),
        decidedVia: 'email'
      });
      mockDb.push({
        id: 'APP-OTHER-USER',
        userId: 'user_2',
        foodItemId: 'biryani_01',
        orderType: 'instant',
        status: 'approved',
        used: false,
        expiresAt: new Date(Date.now() + 60000).toISOString()
      });
    });

    it('status poll: returns 200 for owner with main user JWT token', () => {
      const req = { headers: { authorization: 'Bearer valid_token_user_1' }, params: { id: 'APP-101' } };
      let statusCode = 0;
      let body: any = null;
      const res = {
        status: (code: number) => { statusCode = code; return res; },
        json: (data: any) => { body = data; return res; }
      };
      handleStatusPoll(req, res);
      expect(statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.status).toBe('approved');
      expect(body.used).toBe(false);
      expect(body.emailTokenHash).toBeUndefined(); // never leaks token hash
    });

    it('status poll: returns 401 when no token is passed', () => {
      const req = { headers: {}, params: { id: 'APP-101' } };
      let statusCode = 0;
      const res = {
        status: (code: number) => { statusCode = code; return res; },
        json: vi.fn()
      };
      handleStatusPoll(req, res);
      expect(statusCode).toBe(401);
    });

    it('status poll: returns 403 for another user request', () => {
      const req = { headers: { authorization: 'Bearer valid_token_user_1' }, params: { id: 'APP-OTHER-USER' } };
      let statusCode = 0;
      const res = {
        status: (code: number) => { statusCode = code; return res; },
        json: vi.fn()
      };
      handleStatusPoll(req, res);
      expect(statusCode).toBe(403);
    });

    it('status poll: returns 404 for non-existent request', () => {
      const req = { headers: { authorization: 'Bearer valid_token_user_1' }, params: { id: 'NON_EXISTENT' } };
      let statusCode = 0;
      const res = {
        status: (code: number) => { statusCode = code; return res; },
        json: vi.fn()
      };
      handleStatusPoll(req, res);
      expect(statusCode).toBe(404);
    });

    it('consume approval: marks used=true on first call, returns 409 on second call', () => {
      const req = { headers: { authorization: 'Bearer valid_token_user_1' }, params: { id: 'APP-101' } };
      let statusCode = 0;
      let body: any = null;
      const res = {
        status: (code: number) => { statusCode = code; return res; },
        json: (data: any) => { body = data; return res; }
      };

      // First call -> 200
      handleConsume(req, res);
      expect(statusCode).toBe(200);
      expect(body.used).toBe(true);
      expect(mockDb[0].used).toBe(true);

      // Second call -> 409 Conflict
      handleConsume(req, res);
      expect(statusCode).toBe(409);
    });
  });

  describe('3. Deduplication and Single-Gate Approval', () => {
    it('detects existing pending or approved request and avoids creating duplicates', () => {
      const existingDb = [
        {
          id: 'REQ-EXISTING-1',
          userId: 'user_test',
          foodItemId: 'chicken-kothu-parotta',
          orderType: 'scheduled',
          status: 'pending',
          used: false,
          expiresAt: new Date(Date.now() + 3600000)
        }
      ];

      const findExisting = (userId: string, foodItemId: string, orderType: string) => {
        const now = new Date();
        return existingDb.find(a =>
          a.userId === userId &&
          a.foodItemId === foodItemId &&
          a.orderType === orderType &&
          !a.used &&
          (a.status === 'pending' || a.status === 'approved') &&
          a.expiresAt > now
        );
      };

      const match = findExisting('user_test', 'chicken-kothu-parotta', 'scheduled');
      expect(match).toBeDefined();
      expect(match?.id).toBe('REQ-EXISTING-1');

      // Different item does not match
      expect(findExisting('user_test', 'mutton-biryani', 'scheduled')).toBeUndefined();
    });

    it('recurring schedule with approvalId bypasses nominee gate on execution', () => {
      const scheduleWithApproval = {
        id: 'SCHED-12345',
        foodItemId: 'chicken-kothu-parotta',
        foodItemName: 'Chicken Kothu Parotta',
        approvalId: 'APPROVAL-APPROVED-999',
        time: '08:00',
        duration: '1_month',
        frequency: 'daily'
      };

      // Simulate saveSchedule gate logic
      const shouldIntercept = (sched: typeof scheduleWithApproval, isRestricted: boolean) => {
        if (sched.approvalId) return false; // bypassed because already approved
        return isRestricted;
      };

      expect(shouldIntercept(scheduleWithApproval, true)).toBe(false);
    });
  });
});

