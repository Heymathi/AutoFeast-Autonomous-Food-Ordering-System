import { describe, test, expect } from 'vitest';
import { signJwt, verifyJwt } from '../server.js';

describe('Server JWT Authentication & Security Unit Tests (All 7 JWT Rules)', () => {
  // JWT Test 1: Missing token returns null
  test('JWT Test 1: Missing Authorization token header returns null', () => {
    expect(verifyJwt('')).toBeNull();
    expect(verifyJwt(null as any)).toBeNull();
    expect(verifyJwt(undefined as any)).toBeNull();
  });

  // JWT Test 2: Expired JWT token returns null
  test('JWT Test 2: Expired JWT token returns null (expired timestamp)', () => {
    const expiredToken = signJwt({ userId: 'user_001', exp: Math.floor(Date.now() / 1000) - 10 });
    expect(verifyJwt(expiredToken)).toBeNull();
  });

  // JWT Test 3: Tampered JWT payload returns null
  test('JWT Test 3: Tampered JWT payload returns null (signature mismatch)', () => {
    const validToken = signJwt({ userId: 'user_001', role: 'user' });
    const parts = validToken.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ userId: 'user_admin_hacked', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
    expect(verifyJwt(tamperedToken)).toBeNull();
  });

  // JWT Test 4: Tampered JWT signature returns null
  test('JWT Test 4: Tampered JWT signature returns null', () => {
    const validToken = signJwt({ userId: 'user_001' });
    const parts = validToken.split('.');
    const invalidSigToken = `${parts[0]}.${parts[1]}.invalid_fake_signature_hash_12345`;
    expect(verifyJwt(invalidSigToken)).toBeNull();
  });

  // JWT Test 5: Token using "alg: none" algorithm attack returns null
  test('JWT Test 5: Token using "alg: none" algorithm attack returns null', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ userId: 'user_001', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
    const algNoneToken = `${header}.${payload}.`;
    expect(verifyJwt(algNoneToken)).toBeNull();
  });

  // JWT Test 6: Forged session ID header "session_<id>" without secret signature returns null
  test('JWT Test 6: Forged session ID header "session_<id>" without secret signature returns null', () => {
    const forgedToken = 'session_user_001_forged_token';
    expect(verifyJwt(forgedToken)).toBeNull();
  });

  // JWT Test 7: Valid JWT token resolves authenticated user ID correctly
  test('JWT Test 7: Valid JWT token resolves authenticated user ID correctly', () => {
    const validToken = signJwt({ userId: 'user_karthik_001' });
    const verified = verifyJwt(validToken);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe('user_karthik_001');
  });
});
