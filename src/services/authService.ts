/**
 * User Authentication & Account Management Service
 * Manages user accounts, 4-Digit PINs, WebAuthn credentials, nominees, and session persistence
 */
import { RegisteredCredential } from './webAuthnService';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  pinHash: string; // 4-digit numeric PIN
  nomineeName: string;
  nomineePhone: string;
  isFaceIdEnabled: boolean;
  webAuthnCredentials: RegisteredCredential[];
  createdAt: string;
}

const STORAGE_USERS_KEY = 'autofeast_users_db';
const STORAGE_CURRENT_USER_KEY = 'autofeast_current_user_id';

export class AuthService {
  /**
   * Default initial users database - starts empty so users create their own profile
   */
  private static getDefaultUsers(): UserProfile[] {
    return [];
  }

  /**
   * Load all registered users from local storage permanently
   */
  public static getUsers(): UserProfile[] {
    try {
      const stored = localStorage.getItem(STORAGE_USERS_KEY);
      if (stored) {
        const parsed: UserProfile[] = JSON.parse(stored);
        // Clean out legacy demo accounts if present
        const cleaned = parsed.filter(u => 
          u.id !== 'user_karthik_001' && 
          !u.name.toLowerCase().includes('karthik') && 
          !u.email.toLowerCase().includes('karthik')
        ).map(u => ({
          ...u,
          pinHash: u.pinHash || '1234'
        }));

        if (cleaned.length !== parsed.length) {
          this.saveUsers(cleaned);
        }
        return cleaned;
      }
    } catch (e) {
      console.warn('Error reading users database:', e);
    }
    return [];
  }

  /**
   * Save users array to local storage
   */
  public static saveUsers(users: UserProfile[]): void {
    try {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
    } catch (e) {
      console.warn('Error saving users database:', e);
    }
  }

  /**
   * Get current active user profile if logged in
   */
  public static getCurrentUser(): UserProfile | null {
    try {
      const currentId = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
      if (currentId) {
        const users = this.getUsers();
        const found = users.find(u => u.id === currentId);
        if (found && !found.name.toLowerCase().includes('karthik')) {
          return found;
        }
        // If legacy Karthik demo user, purge session
        localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
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
      } else {
        localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
      }
    } catch (e) {}
  }

  /**
   * Clear all stored accounts and sessions to start completely fresh from scratch
   */
  public static clearAllUsersAndSession(): void {
    try {
      localStorage.removeItem(STORAGE_USERS_KEY);
      localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
    } catch (e) {}
  }

  /**
   * Authenticate user via 4-Digit PIN
   */
  public static loginWithPIN(pin: string): UserProfile {
    const cleanPin = pin.trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      throw new Error('Please enter a valid 4-digit numeric PIN.');
    }

    const users = this.getUsers();
    
    // First check if any registered user matches this PIN
    const found = users.find(u => u.pinHash === cleanPin);
    if (found) {
      this.setCurrentUser(found);
      return found;
    }

    // Check current active session user
    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.pinHash === cleanPin) {
      this.setCurrentUser(currentUser);
      return currentUser;
    }

    throw new Error('That PIN was not correct. Please try again.');
  }

  /**
   * Reset user PIN after verifying Email & Password identity
   */
  public static resetPINWithPassword(email: string, pass: string, newPin: string): UserProfile {
    const cleanPin = newPin.trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      throw new Error('New PIN must be exactly 4 numeric digits.');
    }

    const users = this.getUsers();
    const userIndex = users.findIndex(
      u => u.email.toLowerCase() === email.toLowerCase().trim() && u.passwordHash === pass
    );

    if (userIndex === -1) {
      throw new Error('Invalid email or password. Unable to verify identity to reset PIN.');
    }

    const user = users[userIndex];
    user.pinHash = cleanPin;
    users[userIndex] = user;
    this.saveUsers(users);
    this.setCurrentUser(user);
    return user;
  }

  /**
   * Register a new user account with custom PIN
   */
  public static createUser(
    name: string,
    email: string,
    password: string,
    pin: string,
    nomineeName: string = 'Emergency Nominee',
    nomineePhone: string = '+91 90000 00000',
    initialCredential?: RegisteredCredential
  ): UserProfile {
    const users = this.getUsers();
    const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      throw new Error('An account with this email already exists.');
    }

    const cleanPin = pin ? pin.trim() : '';
    if (!/^\d{4}$/.test(cleanPin)) {
      throw new Error('Please enter a 4-digit numeric PIN for your account.');
    }

    const newUser: UserProfile = {
      id: `user_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`,
      name: name || 'AutoFeast User',
      email: email.toLowerCase().trim(),
      passwordHash: password,
      pinHash: cleanPin,
      nomineeName: nomineeName || 'Emergency Nominee',
      nomineePhone: nomineePhone || '+91 98765 00000',
      isFaceIdEnabled: Boolean(initialCredential),
      webAuthnCredentials: initialCredential ? [initialCredential] : [],
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    this.saveUsers(users);
    this.setCurrentUser(newUser);
    return newUser;
  }

  /**
   * Add a new WebAuthn Face ID credential to an existing user profile
   */
  public static addCredentialToUser(userId: string, credential: RegisteredCredential): UserProfile {
    const users = this.getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      throw new Error('User account not found.');
    }

    const user = users[userIndex];
    const exists = user.webAuthnCredentials.some(c => c.id === credential.id);
    if (!exists) {
      user.webAuthnCredentials.push(credential);
      user.isFaceIdEnabled = true;
      users[userIndex] = user;
      this.saveUsers(users);
    }
    return user;
  }

  /**
   * Check if any user accounts are registered in the database
   */
  public static hasRegisteredUsers(): boolean {
    return this.getUsers().length > 0;
  }

  /**
   * Login with Email Address OR Username and password
   */
  public static loginWithPassword(emailOrUsername: string, pass: string): UserProfile {
    const users = this.getUsers();
    const cleanInput = emailOrUsername.toLowerCase().trim();
    const user = users.find(u => u.email.toLowerCase() === cleanInput || u.name.toLowerCase() === cleanInput);

    if (!user || user.passwordHash !== pass) {
      throw new Error('Invalid username or password. Please check your credentials and try again.');
    }

    this.setCurrentUser(user);
    return user;
  }
}
