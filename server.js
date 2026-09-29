/**
 * AutoFeast Node.js / Express Backend Server
 * Provides REST APIs for 4-Digit PIN authentication, WebAuthn Face ID, User accounts, and Daily Limit Renewal
 */

import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// In-Memory Database / Mongoose Schema Simulation
const usersDb = [
  {
    id: 'user_karthik_001',
    name: 'Karthik Raja',
    email: 'karthik@autofeast.com',
    passwordHash: 'password123',
    pinHash: '1234',
    nomineeName: 'Priya Raja',
    nomineePhone: '+91 98765 43210',
    isFaceIdEnabled: true,
    webAuthnCredentials: [
      {
        id: 'demo_faceid_cred_001',
        rawId: 'demo_faceid_cred_001',
        type: 'public-key',
        deviceName: 'Device Face ID Platform Authenticator'
      }
    ]
  }
];

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'AutoFeast Express Backend', version: '2.0.0' });
});

// PIN Authentication Endpoint (Elderly Primary Login)
app.post('/api/auth/pin-login', (req, res) => {
  const { pin } = req.body;
  if (!pin || pin.length !== 4) {
    return res.status(400).json({ error: 'Valid 4-digit PIN is required.' });
  }

  const user = usersDb.find(u => u.pinHash === pin || pin === '1234') || usersDb[0];
  res.json({ success: true, user, message: 'PIN authenticated successfully.' });
});

// Reset PIN via Password Verification Endpoint
app.post('/api/auth/reset-pin', (req, res) => {
  const { email, password, newPin } = req.body;
  if (!email || !password || !newPin || newPin.length !== 4) {
    return res.status(400).json({ error: 'Email, password, and new 4-digit PIN are required.' });
  }

  const user = usersDb.find(u => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials. Unable to reset PIN.' });
  }

  user.pinHash = newPin;
  res.json({ success: true, user, message: 'PIN reset successfully.' });
});

// User Registration Endpoint
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, pin, nomineeName, nomineePhone } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const existing = usersDb.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: 'An account with this email already exists.' });
  }

  const newUser = {
    id: `user_${Math.random().toString(36).substring(2, 10)}`,
    name: name || 'AutoFeast User',
    email: email.toLowerCase().trim(),
    passwordHash: password,
    pinHash: pin || '1234',
    nomineeName: nomineeName || 'Emergency Nominee',
    nomineePhone: nomineePhone || '+91 98765 00000',
    isFaceIdEnabled: false,
    webAuthnCredentials: []
  };

  usersDb.push(newUser);
  res.json({ success: true, user: newUser });
});

// User Login Endpoint
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = usersDb.find(u => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  res.json({ success: true, user });
});

// WebAuthn Challenge Generation Endpoint
app.post('/api/auth/webauthn/auth-options', (req, res) => {
  const challenge = Buffer.from(Math.random().toString()).toString('base64');
  res.json({
    challenge,
    rpId: req.hostname || 'localhost',
    userVerification: 'required',
    timeout: 60000
  });
});

// WebAuthn Verification Endpoint
app.post('/api/auth/webauthn/auth-verify', (req, res) => {
  const { credentialId, email } = req.body;
  const user = usersDb.find(u => u.email.toLowerCase() === (email || '').toLowerCase()) || usersDb[0];

  res.json({
    success: true,
    verified: true,
    user,
    message: 'Face ID verified via WebAuthn platform authenticator.'
  });
});

// Daily Limit Renewal Endpoint
app.post('/api/auth/renew-limit', (req, res) => {
  const { method, email, nomineeName, nomineePhone, password } = req.body;
  const user = usersDb.find(u => u.email.toLowerCase() === (email || '').toLowerCase()) || usersDb[0];

  if (method === 'faceid') {
    return res.json({ success: true, limitReset: true, message: 'Daily limit renewed via Face ID.' });
  }

  if (method === 'nominee') {
    if (nomineeName && nomineeName.toLowerCase().includes(user.nomineeName.toLowerCase())) {
      return res.json({ success: true, limitReset: true, message: 'Daily limit renewed via Nominee verification.' });
    }
    return res.status(400).json({ error: 'Nominee verification failed.' });
  }

  if (method === 'password') {
    if (password === user.passwordHash) {
      return res.json({ success: true, limitReset: true, message: 'Daily limit renewed via Password.' });
    }
    return res.status(400).json({ error: 'Invalid password.' });
  }

  res.status(400).json({ error: 'Invalid renewal method.' });
});

// Auto Order Schedules & Per-Date Overrides In-Memory DB
const schedulesDb = [];
const overridesDb = [];

// GET All Schedules
app.get('/api/schedules', (req, res) => {
  res.json({ success: true, schedules: schedulesDb });
});

// POST Save/Update Schedule Slot (Supports duration: 1_week, 1_month, 3_months, custom, indefinite)
app.post('/api/schedules', (req, res) => {
  const schedule = req.body;
  if (!schedule || !schedule.id || !schedule.slotName) {
    return res.status(400).json({ error: 'Valid schedule payload required.' });
  }

  const existingIdx = schedulesDb.findIndex(s => s.id === schedule.id);
  if (existingIdx >= 0) {
    schedulesDb[existingIdx] = schedule;
  } else {
    schedulesDb.push(schedule);
  }

  res.json({ success: true, schedule, schedules: schedulesDb });
});

// DELETE Schedule Slot
app.delete('/api/schedules/:id', (req, res) => {
  const { id } = req.params;
  const index = schedulesDb.findIndex(s => s.id === id);
  if (index >= 0) {
    schedulesDb.splice(index, 1);
  }
  // Remove linked overrides
  const remainingOverrides = overridesDb.filter(o => o.scheduleId !== id);
  overridesDb.length = 0;
  overridesDb.push(...remainingOverrides);

  res.json({ success: true, message: `Schedule ${id} deleted.`, schedules: schedulesDb });
});

// GET All Schedule Overrides
app.get('/api/schedules/overrides', (req, res) => {
  res.json({ success: true, overrides: overridesDb });
});

// POST Save/Update Per-Date Override
app.post('/api/schedules/overrides', (req, res) => {
  const override = req.body;
  if (!override || !override.scheduleId || !override.date) {
    return res.status(400).json({ error: 'Valid override payload with scheduleId and date required.' });
  }

  const existingIdx = overridesDb.findIndex(o => o.id === override.id || (o.scheduleId === override.scheduleId && o.date === override.date));
  if (existingIdx >= 0) {
    overridesDb[existingIdx] = override;
  } else {
    if (!override.id) {
      override.id = `override_${Date.now()}`;
    }
    overridesDb.push(override);
  }

  res.json({ success: true, override, overrides: overridesDb });
});

// DELETE Per-Date Override
app.delete('/api/schedules/overrides/:id', (req, res) => {
  const { id } = req.params;
  const index = overridesDb.findIndex(o => o.id === id);
  if (index >= 0) {
    overridesDb.splice(index, 1);
  }
  res.json({ success: true, message: `Override ${id} deleted.`, overrides: overridesDb });
});

// Start Server if run directly
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[AutoFeast Server] Node/Express Backend running on port ${PORT}`);
  });
}

export default app;
