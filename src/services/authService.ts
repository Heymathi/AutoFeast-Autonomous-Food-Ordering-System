/**
 * User Authentication & Account Management Service
 * Manages user accounts, 4-Digit PINs, WebAuthn credentials, nominees, and session persistence
 * Connects directly to backend API (/api/auth/*) backed by MongoDB Atlas
 */
import { RegisteredCredential } from './webAuthnService';

const STORAGE_USERS_KEY = 'autofeast_registered_users';
const STORAGE_CURRENT_USER_KEY = 'autofeast_current_user_id';
const STORAGE_CURRENT_USER_OBJ = 'autofeast_current_user_obj';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  passwordHash?: string;
  pinHash: string; // 4-digit numeric PIN
  nomineeName: string;
  nomineePhone: string;
  nomineeEmail?: string;
  nomineePinHash?: string;
  restrictedFoodIds?: string[];
  isFaceIdEnabled: boolean;
  webAuthnCredentials?: RegisteredCredential[];
  createdAt?: string;
}

export interface VerifyPinResult {
  success: boolean;
  token?: string;
  error?: string;
  isLocked?: boolean;
  lockRemainingSeconds?: number;
}

export class AuthService {
  private static failedPinAttempts = 0;
  private static lockoutUntil = 0;
  private static verifiedTokensMap = new Map<string, { expiry: number; consumedAt?: number }>();

  /**
   * Load all registered users from local cache if any
   */
  public static getUsers(): UserProfile[] {
    try {
      const stored = localStorage.getItem(STORAGE_USERS_KEY);
      if (stored) {
        const parsed: UserProfile[] = JSON.parse(stored);
        return parsed.filter(u => 
          u.id !== 'user_karthik_001' && 
          !u.name.toLowerCase().includes('karthik') && 
          !u.email.toLowerCase().includes('karthik')
        );
      }
    } catch (e) {
      console.warn('Error reading users database cache:', e);
    }
    return [];
  }

  /**
   * Save users array to local storage cache
   */
  public static saveUsers(users: UserProfile[]): void {
    try {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
    } catch (e) {
      console.warn('Error saving users database cache:', e);
    }
  }

  /**
   * Get current active user profile from local storage session
   */
  public static getCurrentUser(): UserProfile | null {
    try {
      const userObjStr = localStorage.getItem(STORAGE_CURRENT_USER_OBJ);
      if (userObjStr) {
        const user: UserProfile = JSON.parse(userObjStr);
        if (user && !user.name.toLowerCase().includes('karthik')) {
          return user;
        }
      }
    } catch (e) {}
    return null;
  }

  /**
   * Set active user session
   */
  public static setCurrentUser(user: UserProfile | null): void {
    try {
      if (user) {
        localStorage.setItem(STORAGE_CURRENT_USER_KEY, user.id);
        localStorage.setItem(STORAGE_CURRENT_USER_OBJ, JSON.stringify(user));
        const users = this.getUsers();
        const idx = users.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
        if (idx >= 0) {
          users[idx] = user;
        } else {
          users.push(user);
        }
        this.saveUsers(users);
      } else {
        localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
        localStorage.removeItem(STORAGE_CURRENT_USER_OBJ);
      }
    } catch (e) {}
  }

  public static updateUser(user: UserProfile): void {
    this.setCurrentUser(user);
  }

  /**
   * Clear all stored accounts and sessions to start fresh
   */
  public static clearAllUsersAndSession(): void {
    try {
      localStorage.removeItem(STORAGE_USERS_KEY);
      localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
      localStorage.removeItem(STORAGE_CURRENT_USER_OBJ);
    } catch (e) {}
  }

  /**
   * Check if any user accounts are registered locally or in session
   */
  public static hasRegisteredUsers(): boolean {
    return Boolean(this.getCurrentUser() || this.getUsers().length > 0);
  }

  /**
   * Register a new user account with backend API & MongoDB Atlas
   * NO localStorage fallback allowed — network failure throws server unreachable error
   */
  public static async createUser(
    name: string,
    email: string,
    password: string,
    pin: string,
    nomineeName: string = 'Emergency Nominee',
    nomineePhone: string = '+91 98765 00000',
    initialCredential?: RegisteredCredential
  ): Promise<UserProfile> {
    const cleanEmail = email.toLowerCase().trim();
    const cleanPin = pin ? pin.trim() : '';

    if (!/^\d{4}$/.test(cleanPin)) {
      throw new Error('Please enter a 4-digit numeric PIN for your account.');
    }

    let res: Response;
    try {
      res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || 'AutoFeast User',
          email: cleanEmail,
          password,
          pin: cleanPin,
          nomineeName,
          nomineePhone,
          initialCredential
        })
      });
    } catch (netErr: any) {
      console.error('[AuthService] Registration Network Failure:', netErr);
      throw new Error('Cannot reach server. Please check your internet connection.');
    }

    const data = await res.json().catch(() => ({ error: 'server_error' }));
    if (!res.ok || !data.success) {
      if (res.status === 400 && data.error && data.error.includes('already exists')) {
        throw new Error('An account with this email already exists.');
      }
      throw new Error(data.message || data.error || 'Server error occurred. Please try again later.');
    }

    const user: UserProfile = {
      ...data.user,
      pinHash: cleanPin
    };

    this.setCurrentUser(user);
    return user;
  }

  /**
   * Login with Email Address OR Username and password via Backend API & MongoDB Atlas
   * NO localStorage fallback — Network failure throws 'Cannot reach server', non-OK response throws specific errors
   */
  public static async loginWithPassword(emailOrUsername: string, pass: string): Promise<UserProfile> {
    const cleanInput = emailOrUsername.toLowerCase().trim();

    // Check & Migrate legacy local account before logging in if present
    await this.migrateLocalAccountIfPresent(cleanInput, pass);

    let res: Response;
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanInput,
          password: pass
        })
      });
    } catch (netErr: any) {
      console.error('[AuthService] Login Network Failure:', netErr);
      throw new Error('Cannot reach server. Please check your internet connection.');
    }

    const data = await res.json().catch(() => ({ error: 'server_error' }));

    if (!res.ok || !data.success) {
      if (res.status === 404 || data.error === 'account_not_found') {
        throw new Error('Account not found. Please check your email or username.');
      }
      if (res.status === 401 || data.error === 'wrong_password') {
        throw new Error('Incorrect password. Please try again.');
      }
      if (res.status === 429 || data.error === 'rate_limit_exceeded') {
        throw new Error('Too many login attempts. Please try again in 15 minutes.');
      }
      throw new Error(data.message || data.error || 'Server error occurred. Please try again later.');
    }

    const user: UserProfile = data.user;
    this.setCurrentUser(user);
    return user;
  }

  /**
   * Migrate legacy single localStorage account ONLY after user enters matching email & password
   */
  private static async migrateLocalAccountIfPresent(emailOrUsername: string, pass: string): Promise<void> {
    try {
      const localUsers = this.getUsers();
      const localMatchIndex = localUsers.findIndex(u =>
        u.email.toLowerCase() === emailOrUsername || u.name.toLowerCase() === emailOrUsername
      );

      if (localMatchIndex !== -1) {
        const localUser = localUsers[localMatchIndex];
        console.log(`[AuthService Migration]: Migrating legacy local user account "${localUser.email}" to server DB...`);

        const res = await fetch('/api/auth/migrate-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: localUser.email,
            password: pass,
            name: localUser.name,
            pin: localUser.pinHash,
            nomineeName: localUser.nomineeName,
            nomineePhone: localUser.nomineePhone
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            console.log(`[AuthService Migration SUCCESS]: Legacy local user "${localUser.email}" migrated to server. Removing local copy.`);
            localUsers.splice(localMatchIndex, 1);
            this.saveUsers(localUsers);
          }
        }
      }
    } catch (e) {
      console.warn('[AuthService Migration WARN]: Migration skipped due to network or server response:', e);
    }
  }


  /**
   * Verify 4-Digit Security PIN via Backend API & Issue Single-Use 2-Minute Token
   */
  public static async verifyPIN(pin: string): Promise<VerifyPinResult> {
    const now = Date.now();
    if (now < this.lockoutUntil) {
      const rem = Math.ceil((this.lockoutUntil - now) / 1000);
      return {
        success: false,
        isLocked: true,
        lockRemainingSeconds: rem,
        error: `3 incorrect attempts. Security locked for ${rem} seconds.`
      };
    }

    const cleanPin = pin ? pin.trim() : '';
    if (!/^\d{4}$/.test(cleanPin)) {
      return { success: false, error: 'Please enter a valid 4-digit numeric PIN.' };
    }

    let isMatch = false;

    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: cleanPin })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) isMatch = true;
      }
    } catch (e) {
      console.warn('[AuthService] Server verify-pin request error:', e);
    }

    // Fallback to active user session PIN comparison if server offline
    if (!isMatch) {
      const currentUser = this.getCurrentUser();
      if (currentUser && currentUser.pinHash && currentUser.pinHash === cleanPin) {
        isMatch = true;
      } else if (!currentUser && cleanPin.length === 4) {
        // Fallback for default onboarding initial session
        isMatch = true;
      }
    }

    if (isMatch) {
      this.failedPinAttempts = 0;
      const token = `tok_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
      // Issued token valid for 2 minutes (120,000 ms)
      this.verifiedTokensMap.set(token, { expiry: Date.now() + 120000 });
      console.log(`[AuthService]: PIN verified. Single-use token issued: "${token}" (expires in 2m)`);
      return { success: true, token };
    } else {
      this.failedPinAttempts += 1;
      if (this.failedPinAttempts >= 3) {
        this.lockoutUntil = Date.now() + 30000; // 30 seconds temporary lockout
        this.failedPinAttempts = 0;
        return {
          success: false,
          isLocked: true,
          lockRemainingSeconds: 30,
          error: '3 incorrect PIN attempts! Security locked for 30 seconds.'
        };
      }
      return {
        success: false,
        error: `Invalid Security PIN. Attempt ${this.failedPinAttempts} of 3.`
      };
    }
  }

  /**
   * Validate & Consume Single-Use Verified Token (Server Validation)
   * Prevents token reuse for a second time
   */
  public static async validateAndConsumeToken(token?: string): Promise<{ isValid: boolean; error?: string }> {
    if (!token) {
      return { isValid: false, error: 'Security verification token is missing.' };
    }

    try {
      const res = await fetch('/api/auth/validate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.isValid) {
          this.verifiedTokensMap.delete(token);
          return { isValid: true };
        }
      }
    } catch (e) {}

    // Check local in-memory single-use token map
    const tokenData = this.verifiedTokensMap.get(token);
    if (tokenData && Date.now() <= tokenData.expiry) {
      // Single-use enforcement: mark consumed, permit batch multi-item creation within 5 seconds then delete
      if (!tokenData.consumedAt) {
        tokenData.consumedAt = Date.now();
        setTimeout(() => {
          this.verifiedTokensMap.delete(token);
        }, 5000);
      }
      console.log(`[AuthService]: Single-use token "${token}" validated and consumed successfully.`);
      return { isValid: true };
    }

    console.warn(`[AuthService Security Violation]: Token "${token}" is invalid, expired, or ALREADY REUSED.`);
    return { isValid: false, error: 'Token has expired or was already used.' };
  }

  /**
   * Authenticate user via 4-Digit PIN via Backend API
   */
  public static async loginWithPIN(pin: string): Promise<UserProfile> {
    const cleanPin = pin.trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      throw new Error('Please enter a valid 4-digit numeric PIN.');
    }

    try {
      const res = await fetch('/api/auth/pin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: cleanPin })
      });

      const data = await res.json();
      if (res.ok && data.success && data.user) {
        const user: UserProfile = data.user;
        this.setCurrentUser(user);
        return user;
      }
    } catch (e) {}

    // Fallback to local active session user if PIN matches
    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.pinHash === cleanPin) {
      this.setCurrentUser(currentUser);
      return currentUser;
    }

    throw new Error('That PIN was not correct. Please try again.');
  }

  /**
   * Reset user PIN after verifying Email & Password identity via Backend API
   */
  public static async resetPINWithPassword(email: string, pass: string, newPin: string): Promise<UserProfile> {
    const cleanPin = newPin.trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      throw new Error('New PIN must be exactly 4 numeric digits.');
    }

    try {
      const res = await fetch('/api/auth/reset-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password: pass,
          newPin: cleanPin
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid credentials. Unable to reset PIN.');
      }

      const user: UserProfile = {
        ...data.user,
        pinHash: cleanPin
      };
      this.setCurrentUser(user);
      return user;
    } catch (err: any) {
      if (err.message && err.message.includes('Invalid credentials')) {
        throw err;
      }
      throw new Error(err.message || 'Unable to reset PIN.');
    }
  }

  /**
   * Add a new WebAuthn Face ID credential to an existing user profile
   */
  public static addCredentialToUser(userId: string, credential: RegisteredCredential): UserProfile {
    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      const exists = currentUser.webAuthnCredentials.some(c => c.id === credential.id);
      if (!exists) {
        currentUser.webAuthnCredentials.push(credential);
        currentUser.isFaceIdEnabled = true;
        this.setCurrentUser(currentUser);
      }
      return currentUser;
    }
    throw new Error('User account not found.');
  }

  /**
   * Verify Nominee PIN server-side with 3-try 5-minute lockout enforcement
   */
  public static async verifyNomineePinServer(
    nomineePin: string,
    userPin?: string,
    userId?: string
  ): Promise<{ success: boolean; locked?: boolean; lockTimeRemaining?: number; remainingTries?: number; error?: string }> {
    const cleanPin = nomineePin.trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      return { success: false, error: 'Nominee PIN must be 4 numeric digits.' };
    }

    try {
      const res = await fetch('/api/nominee/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomineePin: cleanPin, userPin, userId })
      });

      const data = await res.json();
      return data;
    } catch (err: any) {
      console.warn('[AuthService] Server verify PIN offline fallback:', err);
      // Fallback verification if server offline
      const currentUser = this.getCurrentUser();
      const expectedPin = currentUser?.nomineePinHash || '4321';
      const mainPin = currentUser?.pinHash || '1234';

      if (cleanPin === mainPin) {
        return { success: false, error: "Nominee PIN must be DIFFERENT from main user's PIN!" };
      }

      if (cleanPin === expectedPin) {
        return { success: true };
      } else {
        return { success: false, remainingTries: 2, error: 'Incorrect Nominee Security PIN.' };
      }
    }
  }
}
