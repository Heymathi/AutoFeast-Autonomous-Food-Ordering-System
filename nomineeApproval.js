/**
 * AutoFeast: Nominee approval via EMAIL link or WEBSITE (nominee PIN)
 * Self-contained. Wire it up from server.js with registerNomineeApproval({...}).
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const APPROVAL_TTL_INSTANT_MS = 30 * 60 * 1000; // 30 minutes for instant order
const APPROVAL_TTL_SCHEDULE_MS = 24 * 60 * 60 * 1000; // 24 hours for scheduled order

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
      a.emailTokenHash === tokenHash && a.status === 'pending' && (!a.expiresAt || new Date(a.expiresAt) > now)) || null;
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
    let updated = null;
    if (isMongo()) {
      updated = await ApprovalRequest.findOneAndUpdate(
        { ...filter, status: 'pending', expiresAt: { $gt: now } },
        { $set: patch },
        { new: true }
      );
    } else {
      const rec = fallbackApprovalRequestsDb.find(a => {
        if (filter.emailTokenHash && a.emailTokenHash !== filter.emailTokenHash) return false;
        if (filter.id && a.id !== filter.id && a._id !== filter.id) return false;
        return a.status === 'pending' && (!a.expiresAt || new Date(a.expiresAt) > now);
      });
      if (rec) {
        Object.assign(rec, patch);
        updated = rec;
      }
    }
    if (updated) {
      console.log(`[NomineeApproval] [DECISION] id=${updated.id || updated._id} decision=${updated.status} via=${via}`);
    }
    return updated;
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
    nomineeEmail, nomineeName, userName, foodItemName, foodItemNativeName, orderType,
    requestedTime, selectedDays, duration, approveLink, denyLink, language = 'en',
    approvalId
  }) {
    const appUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    const loginLink = `${appUrl}/nominee`;
    const days = Array.isArray(selectedDays) ? selectedDays.join(', ') : (selectedDays || '');

    const hasNative = foodItemNativeName && foodItemNativeName !== foodItemName;
    const itemDisplayName = hasNative ? `${foodItemNativeName} (${foodItemName})` : foodItemName;

    let subject = '';
    let text = '';
    let html = '';
    const lang = (language || 'en').toLowerCase();

    if (lang === 'ta') {
      const orderTypeLabel = orderType === 'scheduled' ? 'திட்டமிடப்பட்ட ஆர்டர் (Scheduled)' : 'உடனடி ஆர்டர் (Instant)';
      const schedDetails = orderType === 'scheduled'
        ? `திட்டமிடப்பட்ட நேரம்: <strong>${escapeHtml(requestedTime || 'TBD')}</strong>${days ? `, நாட்கள்: ${escapeHtml(days)}` : ''}${duration ? `, கால அளவு: ${escapeHtml(duration)}` : ''}`
        : '<strong>உடனடி ஆர்டர் (இப்போதே)</strong>';

      subject = `🚨 [AutoFeast] பரிந்துரையாளர் ஒப்புதல் தேவை: ${userName} "${itemDisplayName}" ஆர்டர் செய்ய விரும்புகிறார்`;
      text =
        `வணக்கம் ${nomineeName},\n\n` +
        `${userName} "${itemDisplayName}" (${orderTypeLabel}) என்ற உணவை ஆர்டர் செய்ய உங்கள் ஒப்புதலைக் கோருகிறார்.\n\n` +
        `ஒப்புதல் அளிக்க (Approve): ${approveLink}\n` +
        `நிராகரிக்க (Deny): ${denyLink}\n\n` +
        `இந்த முடிவு இணைப்பு ஒருமுறை மட்டுமே செல்லுபடியாகும். கடவுச்சொல் தேவையில்லை.\n` +
        `English: ${userName} wants to order "${foodItemName}". Approve: ${approveLink} | Deny: ${denyLink}`;

      html = `<!DOCTYPE html><html lang="ta"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:30px 0"><tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10)">
  <tr><td style="background:linear-gradient(135deg,#f97316,#ea580c);padding:32px 40px;text-align:center">
    <h1 style="margin:0;color:#fff;font-size:26px;font-weight:900">🍽️ AutoFeast AI</h1>
    <p style="margin:6px 0 0;color:#fed7aa;font-size:13px;font-weight:600">பரிந்துரையாளர் ஒப்புதல் கோரிக்கை • NOMINEE APPROVAL</p>
  </td></tr>
  <tr><td style="background:#fff7ed;border-left:5px solid #f97316;padding:18px 40px">
    <p style="margin:0;color:#9a3412;font-size:15px;font-weight:700">⚠️ கவனம்: இந்த ஆர்டர் தொடர உங்கள் ஒப்புதல் தேவை.</p>
  </td></tr>
  <tr><td style="padding:32px 40px">
    <p style="margin:0 0 8px;color:#374151;font-size:15px">வணக்கம் <strong>${escapeHtml(nomineeName)}</strong>,</p>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6">
      <strong>${escapeHtml(userName)}</strong> ஒரு <em>கட்டுப்படுத்தப்பட்ட உணவுப் பொருளை</em> (${orderTypeLabel}) ஆர்டர் செய்ய முயற்சிக்கிறார்.
      பாதுகாப்புப் பரிந்துரையாளராக, இந்த ஆர்டரை அனுமதிக்கலாமா என்பதை நீங்கள் தீர்மானிக்கலாம்.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef3c7;border:2px solid #fbbf24;border-radius:12px;margin-bottom:24px">
      <tr><td style="padding:20px 24px">
        <p style="margin:0 0 4px;color:#92400e;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px">கோரப்பட்ட உணவு / REQUESTED FOOD ITEM</p>
        <h2 style="margin:0 0 8px;color:#1f2937;font-size:22px;font-weight:900">${escapeHtml(itemDisplayName)}</h2>
        <p style="margin:0;color:#6b7280;font-size:13px">${schedDetails}</p>
      </td></tr></table>
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:12px"><a href="${approveLink}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:800">✅ அனுமதி (Approve)</a></td>
      <td><a href="${denyLink}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:800">❌ நிராகரி (Deny)</a></td>
    </tr></table>
    <p style="margin:16px 0 0;color:#6b7280;font-size:12px">🔒 இந்த இணைப்பு ஒருமுறை மட்டுமே பயன்படுத்தக்கூடியது. தனி உள்நுழைவு தேவையில்லை.</p>
    <p style="margin:20px 0 0;color:#9ca3af;font-size:12px">பதில் அளிக்கப்படாவிட்டால் ஆர்டர் தடுத்து வைக்கப்படும்.</p>
  </td></tr>
  <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center">
    <p style="margin:0;color:#9ca3af;font-size:11px">AutoFeast AI • ${escapeHtml(userName)} அவர்களின் பதிவுசெய்யப்பட்ட பரிந்துரையாளர்.</p>
  </td></tr>
</table></td></tr></table></body></html>`;

    } else if (lang === 'hi') {
      const orderTypeLabel = orderType === 'scheduled' ? 'अनुसूचित ऑर्डर (Scheduled)' : 'तत्काल ऑर्डर (Instant)';
      const schedDetails = orderType === 'scheduled'
        ? `अनुसूचित समय: <strong>${escapeHtml(requestedTime || 'TBD')}</strong>${days ? `, दिन: ${escapeHtml(days)}` : ''}${duration ? `, अवधि: ${escapeHtml(duration)}` : ''}`
        : '<strong>तत्काल ऑर्डर (अभी)</strong>';

      subject = `🚨 [AutoFeast] नॉमिनी स्वीकृति आवश्यक: ${userName} "${itemDisplayName}" का ऑर्डर करना चाहते हैं`;
      text =
        `नमस्ते ${nomineeName},\n\n` +
        `${userName} "${itemDisplayName}" (${orderTypeLabel}) का ऑर्डर करने के लिए आपकी अनुमति चाहते हैं।\n\n` +
        `स्वीकृति दें (Approve): ${approveLink}\n` +
        `अस्वीकार करें (Deny): ${denyLink}\n\n` +
        `यह निर्णय लिंक केवल एक बार उपयोग के लिए है। किसी पासवर्ड की आवश्यकता नहीं है।\n` +
        `English: ${userName} wants to order "${foodItemName}". Approve: ${approveLink} | Deny: ${denyLink}`;

      html = `<!DOCTYPE html><html lang="hi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:30px 0"><tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10)">
  <tr><td style="background:linear-gradient(135deg,#f97316,#ea580c);padding:32px 40px;text-align:center">
    <h1 style="margin:0;color:#fff;font-size:26px;font-weight:900">🍽️ AutoFeast AI</h1>
    <p style="margin:6px 0 0;color:#fed7aa;font-size:13px;font-weight:600">नॉमिनी अनुमोदन अनुरोध • NOMINEE APPROVAL</p>
  </td></tr>
  <tr><td style="background:#fff7ed;border-left:5px solid #f97316;padding:18px 40px">
    <p style="margin:0;color:#9a3412;font-size:15px;font-weight:700">⚠️ कार्रवाई आवश्यक: इस ऑर्डर को देने से पहले आपकी स्वीकृति आवश्यक है।</p>
  </td></tr>
  <tr><td style="padding:32px 40px">
    <p style="margin:0 0 8px;color:#374151;font-size:15px">नमस्ते <strong>${escapeHtml(nomineeName)}</strong>,</p>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6">
      <strong>${escapeHtml(userName)}</strong> एक <em>प्रतिबंधित खाद्य वस्तु</em> (${orderTypeLabel}) ऑर्डर करने का प्रयास कर रहे हैं।
      नामांकित अभिभावक के रूप में, आप निर्णय लेते हैं कि यह आगे बढ़े या नहीं।</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef3c7;border:2px solid #fbbf24;border-radius:12px;margin-bottom:24px">
      <tr><td style="padding:20px 24px">
        <p style="margin:0 0 4px;color:#92400e;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px">अनुरोधित भोजन / REQUESTED FOOD ITEM</p>
        <h2 style="margin:0 0 8px;color:#1f2937;font-size:22px;font-weight:900">${escapeHtml(itemDisplayName)}</h2>
        <p style="margin:0;color:#6b7280;font-size:13px">${schedDetails}</p>
      </td></tr></table>
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:12px"><a href="${approveLink}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:800">✅ स्वीकृति दें (Approve)</a></td>
      <td><a href="${denyLink}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:800">❌ अस्वीकार करें (Deny)</a></td>
    </tr></table>
    <p style="margin:16px 0 0;color:#6b7280;font-size:12px">🔒 यह निर्णय लिंक एकल-उपयोग (single-use) है। किसी अलग लॉगिन की आवश्यकता नहीं है।</p>
    <p style="margin:20px 0 0;color:#9ca3af;font-size:12px">कोई उत्तर न मिलने पर ऑर्डर ब्लॉक रहेगा।</p>
  </td></tr>
  <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center">
    <p style="margin:0;color:#9ca3af;font-size:11px">AutoFeast AI • आप ${escapeHtml(userName)} के पंजीकृत नॉमिनी हैं।</p>
  </td></tr>
</table></td></tr></table></body></html>`;

    } else {
      // English / Default
      const details = orderType === 'scheduled'
        ? `Scheduled at <strong>${escapeHtml(requestedTime || 'TBD')}</strong>${days ? ` on ${escapeHtml(days)}` : ''}${duration ? ` (${escapeHtml(duration)})` : ''}`
        : '<strong>Instant order</strong> (right now)';

      subject = `🚨 [AutoFeast] Approval Required: ${userName} wants to order "${itemDisplayName}"`;
      text =
        `Hello ${nomineeName},\n\n` +
        `${userName} wants to order restricted food item "${itemDisplayName}" (${orderType}).\n\n` +
        `Approve: ${approveLink}\n` +
        `Deny: ${denyLink}\n\n` +
        `This decision link is single-use and requires no password.`;

      html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif">
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
        <h2 style="margin:0 0 8px;color:#1f2937;font-size:22px;font-weight:900">${escapeHtml(itemDisplayName)}</h2>
        <p style="margin:0;color:#6b7280;font-size:13px">${details}</p>
      </td></tr></table>
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:12px"><a href="${approveLink}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:800">✅ Approve</a></td>
      <td><a href="${denyLink}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:800">❌ Deny</a></td>
    </tr></table>
    <p style="margin:16px 0 0;color:#6b7280;font-size:12px">🔒 This decision link is single-use and requires no password.</p>
    <p style="margin:20px 0 0;color:#9ca3af;font-size:12px">With no response, the order stays blocked.</p>
  </td></tr>
  <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center">
    <p style="margin:0;color:#9ca3af;font-size:11px">AutoFeast AI • You are a registered nominee for ${escapeHtml(userName)}.</p>
  </td></tr>
</table></td></tr></table></body></html>`;
    }

    const res = await sendEmail({
      to: nomineeEmail, subject, text, html,
      meta: { foodItemName, itemDisplayName, orderType, requestedTime, nomineeEmail, approveLink, denyLink, language: lang }
    });

    if (res?.success) {
      console.log(`[NomineeApproval] [EMAIL_SENT] id=${approvalId || 'unknown'} to=${nomineeEmail} lang=${lang} subject="${subject}"`);
    } else {
      console.error(`[NomineeApproval] [EMAIL_FAILED] id=${approvalId || 'unknown'} to=${nomineeEmail} err=${res?.error || 'send error'}`);
    }
    return res;
  }

  // ---------- Call this right after an ApprovalRequest is created ----------
  async function dispatchApprovalEmail(approval, user) {
    const nomineeEmail = (user?.nomineeEmail || approval?.nomineeEmail || '').toLowerCase().trim();
    if (!nomineeEmail || nomineeEmail === 'nominee@autofeast.com') {
      return { success: false, error: 'no_nominee_email' };
    }
    const raw = crypto.randomBytes(32).toString('base64url');
    const ttl = approval.orderType === 'instant' ? APPROVAL_TTL_INSTANT_MS : APPROVAL_TTL_SCHEDULE_MS;
    const expiresAt = new Date(Date.now() + ttl);

    const patch = {
      emailTokenHash: hashToken(raw),            // only the hash is stored
      expiresAt,
      nomineeEmail,
      nomineeName: user?.nomineeName || approval?.nomineeName || 'Emergency Nominee',
      language: approval?.language || user?.preferredLanguage || 'en',
      used: false
    };
    if (isMongo()) await ApprovalRequest.updateOne({ id: approval.id }, { $set: patch });
    else Object.assign(approval, patch);

    const base = process.env.API_BASE_URL || process.env.APP_BASE_URL || 'http://localhost:5000';
    const sched = approval.scheduleDetails || {};
    const foodItem = approval.foodItem || {};
    const lang = patch.language;
    const nativeName = foodItem.nativeNames?.[lang] || foodItem.nativeName;

    return sendApprovalRequestEmail({
      nomineeEmail,
      nomineeName: patch.nomineeName,
      userName: user?.name || 'User',
      foodItemName: foodItem.name || approval.foodItemId,
      foodItemNativeName: nativeName,
      orderType: approval.orderType,
      requestedTime: sched.time,
      selectedDays: sched.selectedDays,
      duration: sched.duration,
      approveLink: `${base}/api/nominee/email-decision?token=${raw}&d=approve`,
      denyLink: `${base}/api/nominee/email-decision?token=${raw}&d=deny`,
      language: lang,
      approvalId: approval.id || approval._id
    });
  }

  // ---------- (A) EMAIL path ----------
  const page = (title, body, lang = 'en') => `<!doctype html><html lang="${escapeHtml(lang)}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f4f4f5;display:flex;justify-content:center;padding:48px 16px;color:#18181b}
.c{background:#fff;border-radius:20px;padding:36px;max-width:440px;width:100%;box-shadow:0 8px 30px rgba(0,0,0,.08);text-align:center;box-sizing:border-box}
button{background:#f97316;color:#fff;border:0;border-radius:12px;padding:14px 28px;font-size:16px;font-weight:800;cursor:pointer;transition:transform .1s ease}
button:hover{background:#ea580c}button:active{transform:scale(.98)}
.btn-deny{background:#dc2626}.btn-deny:hover{background:#b91c1c}</style>
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

    const tokenHash = hashToken(token);
    console.log(`[NomineeApproval] [LINK_OPENED] id=${approval.id || approval._id} action=${decision} tokenHash=${tokenHash.slice(0, 8)}...`);

    const lang = (approval.language || 'en').toLowerCase();
    const foodItem = approval.foodItem || {};
    const nativeName = foodItem.nativeNames?.[lang] || foodItem.nativeName;
    const foodItemName = foodItem.name || approval.foodItemId;
    const name = nativeName && nativeName !== foodItemName ? `${nativeName} (${foodItemName})` : foodItemName;

    if (lang === 'ta') {
      const title = decision === 'approve' ? 'ஒப்புதல் உறுதிப்படுத்தல்' : 'நிராகரிப்பு உறுதிப்படுத்தல்';
      const prompt = decision === 'approve'
        ? `"${escapeHtml(name)}" ஆர்டருக்கு <strong>ஒப்புதல் அளிக்க</strong> விரும்புகிறீர்களா?`
        : `"${escapeHtml(name)}" ஆர்டரை <strong>நிராகரிக்க</strong> விரும்புகிறீர்களா?`;
      const btnText = decision === 'approve' ? '✅ ஒப்புதலை உறுதிசெய் (Confirm Approve)' : '❌ நிராகரிப்பை உறுதிசெய் (Confirm Deny)';

      return res.send(page(title, `
        <h2 style="margin-top:0">${title}</h2>
        <p style="font-size:16px;margin:20px 0;line-height:1.5">${prompt}</p>
        <p style="color:#71717a;font-size:13px;margin-bottom:24px">${decision === 'approve' ? 'ஒப்புதல் அளித்தவுடன் பயனர் ஆர்டர் தொடரும்.' : 'ஆர்டர் ரத்து செய்யப்படும்.'}</p>
        <form method="POST" action="/api/nominee/email-decision">
          <input type="hidden" name="token" value="${escapeHtml(token)}">
          <input type="hidden" name="decision" value="${decision}">
          <button type="submit" class="${decision === 'deny' ? 'btn-deny' : ''}">${btnText}</button>
        </form>`, 'ta'));
    }

    if (lang === 'hi') {
      const title = decision === 'approve' ? 'निर्णय की पुष्टि करें' : 'अस्वीकृति की पुष्टि करें';
      const prompt = decision === 'approve'
        ? `क्या आप "${escapeHtml(name)}" के ऑर्डर को <strong>स्वीकृति देना</strong> चाहते हैं?`
        : `क्या आप "${escapeHtml(name)}" के ऑर्डर को <strong>अस्वीकार करना</strong> चाहते हैं?`;
      const btnText = decision === 'approve' ? '✅ स्वीकृति की पुष्टि करें (Confirm Approve)' : '❌ अस्वीकार की पुष्टि करें (Confirm Deny)';

      return res.send(page(title, `
        <h2 style="margin-top:0">${title}</h2>
        <p style="font-size:16px;margin:20px 0;line-height:1.5">${prompt}</p>
        <p style="color:#71717a;font-size:13px;margin-bottom:24px">${decision === 'approve' ? 'स्वीकृति के बाद ऑर्डर आगे बढ़ेगा।' : 'ऑर्डर रद्द कर दिया जाएगा।'}</p>
        <form method="POST" action="/api/nominee/email-decision">
          <input type="hidden" name="token" value="${escapeHtml(token)}">
          <input type="hidden" name="decision" value="${decision}">
          <button type="submit" class="${decision === 'deny' ? 'btn-deny' : ''}">${btnText}</button>
        </form>`, 'hi'));
    }

    // English
    res.send(page('Confirm decision', `
      <h2 style="margin-top:0">${decision === 'approve' ? 'Approve' : 'Deny'} "${escapeHtml(name)}"?</h2>
      <p style="font-size:16px;margin:20px 0;line-height:1.5">${decision === 'approve' ? 'The order will go ahead once approved.' : 'The order will be cancelled.'}</p>
      <form method="POST" action="/api/nominee/email-decision">
        <input type="hidden" name="token" value="${escapeHtml(token)}">
        <input type="hidden" name="decision" value="${decision}">
        <button type="submit" class="${decision === 'deny' ? 'btn-deny' : ''}">Confirm ${decision}</button>
      </form>`, 'en'));
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

    const lang = (updated.language || 'en').toLowerCase();
    if (lang === 'ta') {
      const heading = decision === 'approve' ? '✅ ஒப்புதல் அளிக்கப்பட்டது (Approved)' : '❌ நிராகரிக்கப்பட்டது (Denied)';
      return res.send(page('முடிவு பதிவு செய்யப்பட்டது', `
        <h2 style="margin-top:0">${heading}</h2>
        <p style="font-size:16px;color:#374151;margin:16px 0">உங்கள் முடிவு வெற்றிகரமாக பதிவு செய்யப்பட்டது.</p>
        <p style="color:#71717a;font-size:13px">இந்தப் பக்கத்தை நீங்கள் மூடலாம்.</p>`, 'ta'));
    }
    if (lang === 'hi') {
      const heading = decision === 'approve' ? '✅ स्वीकृत (Approved)' : '❌ अस्वीकृत (Denied)';
      return res.send(page('निर्णय दर्ज किया गया', `
        <h2 style="margin-top:0">${heading}</h2>
        <p style="font-size:16px;color:#374151;margin:16px 0">आपका निर्णय सफलतापूर्वक दर्ज कर लिया गया है।</p>
        <p style="color:#71717a;font-size:13px">आप इस पृष्ठ को बंद कर सकते हैं।</p>`, 'hi'));
    }

    res.send(page('Done', `
      <h2 style="margin-top:0">${decision === 'approve' ? '✅ Approved' : '❌ Denied'}</h2>
      <p style="font-size:16px;color:#374151;margin:16px 0">Your decision has been recorded.</p>
      <p style="color:#71717a;font-size:13px">You can close this page.</p>`, 'en'));
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
  const handleApprovalStatus = async (req, res) => {
    try {
      if (connectDB && !isMongo()) await connectDB();
      if (dbUnavailable()) {
        console.error('[GET /api/approvals/:id] 503 - DB not connected');
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

      console.log(`[NomineeApproval] [POLL] id=${id} status=${status} used=${Boolean(record.used)}`);

      return res.json({
        success: true,
        id: record.id || record._id,
        status,
        orderType: record.orderType,
        foodItemName: record.foodItem?.name || record.foodItemId,
        decidedAt: record.decidedAt,
        expiresAt: record.expiresAt,
        used: Boolean(record.used)
      });
    } catch (err) {
      console.error('[approval-status error]:', err);
      return res.status(500).json({ success: false, error: 'Server error.' });
    }
  };

  app.get('/api/approvals/:id', handleApprovalStatus);
  app.get('/api/nominee/approval-status/:id', handleApprovalStatus);
  app.get('/api/approval-status/:id', handleApprovalStatus);

  // Send reminder email to nominee
  const handleApprovalReminder = async (req, res) => {
    try {
      if (connectDB && !isMongo()) await connectDB();
      if (dbUnavailable()) {
        return res.status(503).json({ success: false, error: 'Database service unavailable. Failed closed.' });
      }
      const id = req.params.id;
      const query = mongoose.Types.ObjectId.isValid(id) ? { $or: [{ id }, { _id: id }] } : { id };
      let record = isMongo()
        ? await ApprovalRequest.findOne(query)
        : fallbackApprovalRequestsDb.find(a => a.id === id || a._id === id);

      if (!record) {
        return res.status(404).json({ success: false, error: 'Approval request not found.' });
      }
      if (record.status !== 'pending') {
        return res.status(400).json({ success: false, error: `Cannot remind: request already ${record.status}` });
      }

      const user = isMongo()
        ? await User.findOne({ id: record.userId })
        : fallbackUsersDb.find(u => u.id === record.userId);

      const emailRes = await dispatchApprovalEmail(record, user || {
        nomineeEmail: record.nomineeEmail,
        nomineeName: record.nomineeName,
        name: 'User',
        preferredLanguage: record.language
      });

      console.log(`[NomineeApproval] [REMINDER_SENT] id=${id} to=${record.nomineeEmail}`);
      return res.json({ success: true, message: 'Reminder sent to nominee', emailRes });
    } catch (err) {
      console.error('[approval-reminder error]:', err);
      return res.status(500).json({ success: false, error: 'Server error.' });
    }
  };

  app.post('/api/approvals/:id/remind', handleApprovalReminder);
  app.post('/api/nominee/approvals/:id/remind', handleApprovalReminder);

  // User cancel approval request
  const handleApprovalCancel = async (req, res) => {
    try {
      const id = req.params.id;
      const query = mongoose.Types.ObjectId.isValid(id) ? { $or: [{ id }, { _id: id }] } : { id };
      const updated = await decideApproval(query, 'deny', 'user_cancel');
      if (updated) {
        console.log(`[NomineeApproval] [CANCELLED] id=${id}`);
        return res.json({ success: true, status: 'denied', message: 'Approval request cancelled.' });
      }
      return res.status(400).json({ success: false, error: 'Could not cancel request.' });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Server error.' });
    }
  };

  app.post('/api/approvals/:id/cancel', handleApprovalCancel);
  app.post('/api/nominee/approvals/:id/cancel', handleApprovalCancel);

  function nomineeFromRequest(req) {
    const auth = req.headers['authorization'];
    const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : req.headers['x-nominee-token']?.trim();
    const decoded = token ? verifyJwt(token) : null;
    return decoded?.isNominee && decoded.nomineeUserId ? decoded : null;
  }

  return { dispatchApprovalEmail, decideApproval, verifyNomineePin };
}

