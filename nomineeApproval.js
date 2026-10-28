/**
 * AutoFeast: Nominee approval via EMAIL link or WEBSITE (nominee PIN)
 * Self-contained. Wire it up from server.js with registerNomineeApproval({...}).
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const APPROVAL_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function registerNomineeApproval(deps) {
  const {
    app, express, mongoose,
    User, ApprovalRequest,
    fallbackUsersDb, fallbackApprovalRequestsDb,
    verifyJwt, sendEmail,
    checkRateLimit, recordFailedLogin,
    connectDB
  } = deps;

  const isMongo = () => mongoose.connection.readyState === 1;
  const dbUnavailable = () =>
    process.env.NODE_ENV !== 'test' && (!isMongo() || !mongoose.connection.host);

  const hashToken = raw => crypto.createHash('sha256').update(String(raw)).digest('hex');

  const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Atomic decision (used by BOTH email and website paths) ----------
  async function findPendingByToken(raw) {
    const tokenHash = hashToken(raw);
    const now = new Date();
    if (isMongo()) {
      return ApprovalRequest.findOne({ emailTokenHash: tokenHash, status: 'pending', expiresAt: { $gt: now } });
    }
    return fallbackApprovalRequestsDb.find(a =>
      a.emailTokenHash === tokenHash && a.status === 'pending' && a.expiresAt > now) || null;
  }

  async function decideApproval(filter, decision, via) {
    const status = decision === 'approve' ? 'approved' : 'denied';
    const now = new Date();
    const patch = {
      status,
      decidedAt: now,
      decidedVia: via,
      emailTokenHash: null
    };
    if (filter.emailTokenHash) {
      patch.previousTokenHash = filter.emailTokenHash;
    }
    if (isMongo()) {
      return ApprovalRequest.findOneAndUpdate(
        { ...filter, status: 'pending', expiresAt: { $gt: now } },
        { $set: patch },
        { new: true }
      );
    }
    const rec = fallbackApprovalRequestsDb.find(a => {
      if (filter.emailTokenHash && a.emailTokenHash !== filter.emailTokenHash) return false;
      if (filter.id && a.id !== filter.id && a._id !== filter.id) return false;
      return a.status === 'pending' && (!a.expiresAt || a.expiresAt > now);
    });
    if (!rec) return null;
    Object.assign(rec, patch);
    return rec;
  }

  // ---------- Nominee PIN check (3 wrong tries -> 15 min lock) ----------
  async function verifyNomineePin(user, pin) {
    if (!user.nomineePinHash) {
      return { ok: false, status: 409, body: { success: false, error: 'Nominee PIN not set.' } };
    }
    const now = new Date();
    if (user.nomineeLockedUntil && now < user.nomineeLockedUntil) {
      return {
        ok: false, status: 429,
        body: {
          success: false, locked: true, attemptsLeft: 0, error: 'Nominee PIN locked. Try again later.',
          lockExpiresMs: user.nomineeLockedUntil.getTime()
        }
      };
    }
    if (user.nomineeLockedUntil && now >= user.nomineeLockedUntil) {
      if (isMongo()) {
        await User.findOneAndUpdate({ id: user.id }, { $set: { nomineeFailedAttempts: 0, nomineeLockedUntil: null } });
      }
      user.nomineeFailedAttempts = 0;
      user.nomineeLockedUntil = null;
    }
    const match = await bcrypt.compare(pin, user.nomineePinHash).catch(() => false);
    if (match) {
      if (isMongo()) {
        await User.findOneAndUpdate({ id: user.id }, { $set: { nomineeFailedAttempts: 0, nomineeLockedUntil: null } });
      }
      user.nomineeFailedAttempts = 0;
      return { ok: true };
    }
    let attempts = (user.nomineeFailedAttempts || 0) + 1;
    if (isMongo()) {
      const upd = await User.findOneAndUpdate({ id: user.id }, { $inc: { nomineeFailedAttempts: 1 } }, { new: true });
      if (upd) attempts = upd.nomineeFailedAttempts;
    } else {
      user.nomineeFailedAttempts = attempts;
    }
    if (attempts >= 3) {
      const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      if (isMongo()) await User.findOneAndUpdate({ id: user.id }, { $set: { nomineeLockedUntil: lockUntil } });
      user.nomineeLockedUntil = lockUntil;
      return {
        ok: false, status: 429,
        body: { success: false, locked: true, attemptsLeft: 0, error: 'Incorrect PIN. Locked after 3 failed attempts.' }
      };
    }
    const left = Math.max(0, 3 - attempts);
    return {
      ok: false, status: 400,
      body: { success: false, locked: false, attemptsLeft: left, error: `Incorrect PIN. ${left} attempts remaining.` }
    };
  }

  // ---------- Approval email (real Approve / Deny links) ----------
  async function sendApprovalRequestEmail({
    nomineeEmail, nomineeName, userName, foodItemName, orderType,
    requestedTime, selectedDays, duration, approveLink, denyLink
  }) {
    const appUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    const loginLink = `${appUrl}/nominee`;
    const days = Array.isArray(selectedDays) ? selectedDays.join(', ') : (selectedDays || '');
    const details = orderType === 'scheduled'
      ? `Scheduled at <strong>${escapeHtml(requestedTime || 'TBD')}</strong>${days ? ` on ${escapeHtml(days)}` : ''}${duration ? ` (${escapeHtml(duration)})` : ''}`
      : '<strong>Instant order</strong> (right now)';

    const subject = `🚨 [AutoFeast] Approval Required: ${userName} wants to order "${foodItemName}"`;
    const text =
      `Hello ${nomineeName}, ${userName} wants to order "${foodItemName}" (${orderType}).\n` +
      `Approve: ${approveLink}\nDeny: ${denyLink}\n` +
      `Or log in at ${loginLink} and enter your nominee PIN. This request expires in 24 hours.`;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:30px 0"><tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10)">
  <tr><td style="background:linear-gradient(135deg,#f97316,#ea580c);padding:32px 40px;text-align:center">
    <h1 style="margin:0;color:#fff;font-size:26px;font-weight:900">🍽️ AutoFeast AI</h1>
    <p style="margin:6px 0 0;color:#fed7aa;font-size:13px;font-weight:600">NOMINEE APPROVAL REQUEST</p>
  </td></tr>
  <tr><td style="background:#fff7ed;border-left:5px solid #f97316;padding:18px 40px">
    <p style="margin:0;color:#9a3412;font-size:15px;font-weight:700">⚠️ Action required: your approval is needed before this order is placed.</p>
  </td></tr>
  <tr><td style="padding:32px 40px">
    <p style="margin:0 0 8px;color:#374151;font-size:15px">Hello <strong>${escapeHtml(nomineeName)}</strong>,</p>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6">
      <strong>${escapeHtml(userName)}</strong> is trying to order a <em>restricted food item</em>.
      As the nominated guardian, you decide whether it goes ahead.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef3c7;border:2px solid #fbbf24;border-radius:12px;margin-bottom:24px">
      <tr><td style="padding:20px 24px">
        <p style="margin:0 0 4px;color:#92400e;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Requested food item</p>
        <h2 style="margin:0 0 8px;color:#1f2937;font-size:22px;font-weight:900">${escapeHtml(foodItemName)}</h2>
        <p style="margin:0;color:#6b7280;font-size:13px">${details}</p>
      </td></tr></table>
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:12px"><a href="${approveLink}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:800">✅ Approve</a></td>
      <td><a href="${denyLink}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:800">❌ Deny</a></td>
    </tr></table>
    <p style="margin:16px 0 0;color:#6b7280;font-size:12px">Prefer the website? Log in at <a href="${loginLink}">${loginLink}</a> and enter your nominee PIN.</p>
    <p style="margin:20px 0 0;color:#9ca3af;font-size:12px">This request expires in <strong>24 hours</strong>. With no response, the order stays blocked.</p>
  </td></tr>
  <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center">
    <p style="margin:0;color:#9ca3af;font-size:11px">AutoFeast AI • You are a registered nominee for ${escapeHtml(userName)}.</p>
  </td></tr>
</table></td></tr></table></body></html>`;

    return sendEmail({
      to: nomineeEmail, subject, text, html,
      meta: { foodItemName, orderType, requestedTime, nomineeEmail, approveLink, denyLink }
    });
  }

  // ---------- Call this right after an ApprovalRequest is created ----------
  async function dispatchApprovalEmail(approval, user) {
    const nomineeEmail = (user.nomineeEmail || '').toLowerCase().trim();
    if (!nomineeEmail || nomineeEmail === 'nominee@autofeast.com') {
      return { success: false, error: 'no_nominee_email' };
    }
    const raw = crypto.randomBytes(32).toString('base64url');
    const patch = {
      emailTokenHash: hashToken(raw),            // only the hash is stored
      expiresAt: new Date(Date.now() + APPROVAL_TTL_MS),
      nomineeEmail,
      nomineeName: user.nomineeName
    };
    if (isMongo()) await ApprovalRequest.updateOne({ id: approval.id }, { $set: patch });
    else Object.assign(approval, patch);

    const base = process.env.API_BASE_URL || process.env.APP_BASE_URL || 'http://localhost:5000';
    const sched = approval.scheduleDetails || {};
    return sendApprovalRequestEmail({
      nomineeEmail,
      nomineeName: user.nomineeName || 'Nominee',
      userName: user.name || 'User',
      foodItemName: approval.foodItem?.name || approval.foodItemId,
      orderType: approval.orderType,
      requestedTime: sched.time,
      selectedDays: sched.selectedDays,
      duration: sched.duration,
      approveLink: `${base}/api/nominee/email-decision?token=${raw}&d=approve`,
      denyLink: `${base}/api/nominee/email-decision?token=${raw}&d=deny`
    });
  }

  // ---------- (A) EMAIL path ----------
  const page = (title, body) => `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
<style>body{font-family:Arial,sans-serif;background:#f4f4f5;display:flex;justify-content:center;padding:48px 16px}
.c{background:#fff;border-radius:16px;padding:32px;max-width:420px;box-shadow:0 4px 24px rgba(0,0,0,.1);text-align:center}
button{background:#f97316;color:#fff;border:0;border-radius:10px;padding:14px 28px;font-size:15px;font-weight:700;cursor:pointer}</style>
</head><body><div class="c">${body}</div></body></html>`;

  // GET never changes state (mail scanners open links); it only shows a confirm button
  app.get('/api/nominee/email-decision', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (dbUnavailable()) return res.status(503).send(page('Unavailable', '<p>Please try again later.</p>'));
    const { token, d } = req.query;
    const decision = d === 'deny' ? 'deny' : 'approve';
    const approval = typeof token === 'string' && token ? await findPendingByToken(token) : null;
    if (!approval) {
      return res.status(400).send(page('Link expired', '<h2>Link not valid</h2><p>This link is invalid, already used, or expired.</p>'));
    }
    const name = escapeHtml(approval.foodItem?.name || approval.foodItemId);
    res.send(page('Confirm decision', `
      <h2>${decision === 'approve' ? 'Approve' : 'Deny'} "${name}"?</h2>
      <p>${decision === 'approve' ? 'The order will go ahead once.' : 'The order will be cancelled.'}</p>
      <form method="POST" action="/api/nominee/email-decision">
        <input type="hidden" name="token" value="${escapeHtml(token)}">
        <input type="hidden" name="decision" value="${decision}">
        <button type="submit">Confirm ${decision}</button>
      </form>`));
  });

  app.post('/api/nominee/email-decision', express.urlencoded({ extended: false }), async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const acceptsJson = req.headers['accept']?.includes('application/json') || req.is('json');

    if (dbUnavailable()) {
      if (acceptsJson) return res.status(503).json({ success: false, error: 'Database service unavailable. Failed closed.' });
      return res.status(503).send(page('Unavailable', '<p>Please try again later.</p>'));
    }
    const key = `email_decision_${req.ip || '127.0.0.1'}`;
    if (!checkRateLimit(key).allowed) {
      if (acceptsJson) return res.status(429).json({ success: false, error: 'Too many attempts. Please wait.' });
      return res.status(429).send(page('Too many attempts', '<p>Please wait and try again.</p>'));
    }
    const { token, decision } = req.body || {};
    if (typeof token !== 'string' || !['approve', 'deny'].includes(decision)) {
      if (acceptsJson) return res.status(400).json({ success: false, error: 'Invalid request: token and valid decision required.' });
      return res.status(400).send(page('Invalid request', '<p>Invalid request.</p>'));
    }

    const tokenHash = hashToken(token);
    const updated = await decideApproval({ emailTokenHash: tokenHash }, decision, 'email');

    if (!updated) {
      recordFailedLogin(key);
      const now = new Date();
      // Check whether this token was already decided or is expired
      const existing = isMongo()
        ? await ApprovalRequest.findOne({ $or: [{ emailTokenHash: tokenHash }, { previousTokenHash: tokenHash }] })
        : fallbackApprovalRequestsDb.find(a => a.emailTokenHash === tokenHash || a.previousTokenHash === tokenHash);

      if (existing) {
        if (existing.expiresAt && new Date(existing.expiresAt) <= now) {
          if (acceptsJson) return res.status(400).json({ success: false, error: 'Approval request has expired.' });
          return res.status(400).send(page('Link expired', '<h2>Link Expired</h2><p>This request has expired.</p>'));
        }
        if (existing.status !== 'pending') {
          if (acceptsJson) return res.status(409).json({ success: false, error: 'Request already decided.' });
          return res.status(400).send(page('Already decided', '<h2>Already Decided</h2><p>This request has already been decided.</p>'));
        }
      }

      if (acceptsJson) return res.status(409).json({ success: false, error: 'Link invalid or already decided.' });
      return res.status(400).send(page('Link not valid', '<h2>Link not valid</h2><p>Already decided, or expired.</p>'));
    }

    if (acceptsJson) {
      return res.json({ success: true, status: updated.status });
    }
    res.send(page('Done', `<h2>${decision === 'approve' ? '✅ Approved' : '❌ Denied'}</h2><p>Thank you. You can close this page.</p>`));
  });

  // ---------- (B) WEBSITE path: nominee JWT + nominee PIN in the same request ----------
  app.get('/api/nominee/approvals', async (req, res) => {
    try {
      if (connectDB && !isMongo()) await connectDB();
      if (dbUnavailable()) {
        console.error('[GET /api/nominee/approvals] 503 - DB not connected');
        return res.status(503).json({ success: false, error: 'Database service unavailable. Failed closed.' });
      }
      const decoded = nomineeFromRequest(req);
      if (!decoded) return res.status(403).json({ success: false, error: 'Nominee authorization required.' });
      const now = new Date();
      const list = isMongo()
        ? await ApprovalRequest.find({ userId: decoded.nomineeUserId, status: 'pending', expiresAt: { $gt: now } })
          .select('-emailTokenHash').sort({ requestedAt: -1, createdAt: -1 }).lean()
        : fallbackApprovalRequestsDb.filter(a => a.userId === decoded.nomineeUserId && a.status === 'pending' && a.expiresAt > now);
      return res.json({ success: true, approvals: list });
    } catch (err) {
      console.error('[nominee approvals list]', err);
      return res.status(500).json({ success: false, error: 'Server error.' });
    }
  });

  // Website decision handler helper
  async function handleWebsiteDecision(req, res, approvalId) {
    try {
      if (connectDB && !isMongo()) await connectDB();
      if (dbUnavailable()) {
        console.error('[POST /api/nominee/approvals/:id/decision] 503 - DB not connected');
        return res.status(503).json({ success: false, error: 'Database service unavailable. Failed closed.' });
      }
      const decoded = nomineeFromRequest(req);
      if (!decoded) return res.status(403).json({ success: false, error: 'Nominee authorization required.' });

      const { decision, pin } = req.body || {};
      if (!['approve', 'deny'].includes(decision) || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
        return res.status(400).json({ success: false, error: 'decision and a 4-digit pin are required.' });
      }
      const user = isMongo()
        ? await User.findOne({ id: decoded.nomineeUserId })
        : fallbackUsersDb.find(u => u.id === decoded.nomineeUserId);
      if (!user) return res.status(404).json({ success: false, error: 'Account not found.' });

      const check = await verifyNomineePin(user, pin);
      if (!check.ok) return res.status(check.status).json(check.body);

      // Differentiate between 404 (not found), 400 (expired), and 409 (already decided)
      const query = mongoose.Types.ObjectId.isValid(approvalId)
        ? { $or: [{ id: approvalId }, { _id: approvalId }] }
        : { id: approvalId };

      const existing = isMongo()
        ? await ApprovalRequest.findOne(query)
        : fallbackApprovalRequestsDb.find(a => (a.id === approvalId || a._id === approvalId));

      if (!existing) {
        return res.status(404).json({ success: false, error: 'Request not found.' });
      }
      if (existing.expiresAt && new Date(existing.expiresAt) <= new Date()) {
        return res.status(400).json({ success: false, error: 'Approval request has expired.' });
      }
      if (existing.status !== 'pending') {
        return res.status(409).json({ success: false, error: 'Request already decided.' });
      }

      const updated = await decideApproval(query, decision, 'website');
      if (!updated) {
        return res.status(409).json({ success: false, error: 'Request already decided or expired.' });
      }
      return res.json({ success: true, status: updated.status });
    } catch (err) {
      console.error('[nominee decision]', err);
      return res.status(500).json({ success: false, error: 'Server error.' });
    }
  }

  app.post('/api/nominee/approvals/:id/decision', async (req, res) => {
    return handleWebsiteDecision(req, res, req.params.id);
  });

  app.post('/api/nominee/decide', async (req, res) => {
    const approvalId = req.body?.approvalId || req.body?.id || req.body?.requestId;
    if (!approvalId) {
      return res.status(400).json({ success: false, error: 'approvalId is required.' });
    }
    return handleWebsiteDecision(req, res, approvalId);
  });

  // User polling endpoint for approval status
  app.get('/api/nominee/approval-status/:id', async (req, res) => {
    try {
      if (connectDB && !isMongo()) await connectDB();
      if (dbUnavailable()) {
        console.error('[GET /api/nominee/approval-status/:id] 503 - DB not connected');
        return res.status(503).json({ success: false, error: 'Database service unavailable. Failed closed.' });
      }
      const id = req.params.id;
      const query = mongoose.Types.ObjectId.isValid(id) ? { $or: [{ id }, { _id: id }] } : { id };
      let record = null;
      if (isMongo()) {
        record = await ApprovalRequest.findOne(query).select('-emailTokenHash -previousTokenHash').lean();
      } else {
        record = fallbackApprovalRequestsDb.find(a => a.id === id || a._id === id);
      }
      if (!record) {
        return res.status(404).json({ success: false, error: 'Approval request not found.' });
      }
      const isExpired = record.expiresAt && new Date(record.expiresAt) <= new Date();
      const status = (record.status === 'pending' && isExpired) ? 'expired' : record.status;

      return res.json({
        success: true,
        id: record.id || record._id,
        status,
        orderType: record.orderType,
        foodItemName: record.foodItem?.name || record.foodItemId,
        decidedAt: record.decidedAt,
        expiresAt: record.expiresAt
      });
    } catch (err) {
      console.error('[approval-status error]:', err);
      return res.status(500).json({ success: false, error: 'Server error.' });
    }
  });

  app.get('/api/approval-status/:id', async (req, res) => {
    try {
      if (connectDB && !isMongo()) await connectDB();
      if (dbUnavailable()) {
        console.error('[GET /api/approval-status/:id] 503 - DB not connected');
        return res.status(503).json({ success: false, error: 'Database service unavailable. Failed closed.' });
      }
      const id = req.params.id;
      const query = mongoose.Types.ObjectId.isValid(id) ? { $or: [{ id }, { _id: id }] } : { id };
      let record = null;
      if (isMongo()) {
        record = await ApprovalRequest.findOne(query).select('-emailTokenHash -previousTokenHash').lean();
      } else {
        record = fallbackApprovalRequestsDb.find(a => a.id === id || a._id === id);
      }
      if (!record) {
        return res.status(404).json({ success: false, error: 'Approval request not found.' });
      }
      const isExpired = record.expiresAt && new Date(record.expiresAt) <= new Date();
      const status = (record.status === 'pending' && isExpired) ? 'expired' : record.status;

      return res.json({
        success: true,
        id: record.id || record._id,
        status,
        orderType: record.orderType,
        foodItemName: record.foodItem?.name || record.foodItemId,
        decidedAt: record.decidedAt,
        expiresAt: record.expiresAt
      });
    } catch (err) {
      console.error('[approval-status error]:', err);
      return res.status(500).json({ success: false, error: 'Server error.' });
    }
  });

  function nomineeFromRequest(req) {
    const auth = req.headers['authorization'];
    const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : req.headers['x-nominee-token']?.trim();
    const decoded = token ? verifyJwt(token) : null;
    return decoded?.isNominee && decoded.nomineeUserId ? decoded : null;
  }

  return { dispatchApprovalEmail, decideApproval, verifyNomineePin };
}

