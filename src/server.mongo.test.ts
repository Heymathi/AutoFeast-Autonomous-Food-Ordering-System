import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import mongoose from 'mongoose';
import app, { connectDB } from '../server.js';
import http from 'http';

describe('Vercel Serverless MongoDB & Mongoose Integration Tests', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const port = (server.address() as any).port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  test('1. Uses cached global Mongoose connection (global._mongoose)', () => {
    expect((global as any)._mongoose).toBeDefined();
    expect(typeof (global as any)._mongoose).toBe('object');
    expect('conn' in (global as any)._mongoose).toBe(true);
    expect('promise' in (global as any)._mongoose).toBe(true);
    expect('error' in (global as any)._mongoose).toBe(true);
  });

  test('2. /api/health returns real error name when MONGODB_URI is missing or disconnected', async () => {
    const origUri = process.env.MONGODB_URI;
    delete process.env.MONGODB_URI;
    (global as any)._mongoose.conn = null;
    (global as any)._mongoose.promise = null;
    (global as any)._mongoose.error = null;

    try {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('database');
      expect(data.database).toBe('MongoConfigurationError');
    } finally {
      process.env.MONGODB_URI = origUri;
    }
  });

  test('3. /api/health returns { database: "connected" } when readyState is 1', async () => {
    const readyStateSpy = vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1 as any);

    try {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ database: 'connected' });
    } finally {
      readyStateSpy.mockRestore();
    }
  });

  test('4. Connects with exact URI, serverSelectionTimeoutMS: 8000, bufferCommands: false', async () => {
    const testUri = 'mongodb+srv://testUser:secretPassword123@cluster0.abc.mongodb.net/autofeast?retryWrites=true&w=majority';
    process.env.MONGODB_URI = testUri;

    (global as any)._mongoose.conn = null;
    (global as any)._mongoose.promise = null;
    (global as any)._mongoose.error = null;

    const readyStateSpy = vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(0 as any);
    const connectSpy = vi.spyOn(mongoose, 'connect').mockResolvedValue(mongoose as any);

    try {
      await connectDB();

      expect(connectSpy).toHaveBeenCalledWith(
        testUri,
        expect.objectContaining({
          bufferCommands: false,
          serverSelectionTimeoutMS: 8000,
        })
      );
    } finally {
      readyStateSpy.mockRestore();
      connectSpy.mockRestore();
      delete process.env.MONGODB_URI;
    }
  });

  test('5. On failure, console.error logs real error name and message, never the password', async () => {
    const testPassword = 'SuperSecretP@ssword!2026';
    const testUri = `mongodb+srv://adminUser:${testPassword}@cluster0.mongodb.net/prod?retryWrites=true`;
    process.env.MONGODB_URI = testUri;

    (global as any)._mongoose.conn = null;
    (global as any)._mongoose.promise = null;
    (global as any)._mongoose.error = null;

    const readyStateSpy = vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(0 as any);

    const mockError = new Error(`Connection failed to ${testUri} because of network timeout with secret ${testPassword}`);
    mockError.name = 'MongoServerSelectionError';

    const connectSpy = vi.spyOn(mongoose, 'connect').mockRejectedValue(mockError);
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await connectDB();

      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedOutput = consoleErrorSpy.mock.calls.map(call => call.join(' ')).join('\n');

      // Must log real error name
      expect(loggedOutput).toContain('MongoServerSelectionError');
      // Must NOT log the secret password anywhere
      expect(loggedOutput).not.toContain(testPassword);
      expect(loggedOutput).toContain('***');

      // Also verify /api/health reflects the real error name
      const res = await fetch(`${baseUrl}/api/health`);
      const data = await res.json();
      expect(data).toEqual({ database: 'MongoServerSelectionError' });
    } finally {
      readyStateSpy.mockRestore();
      connectSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      delete process.env.MONGODB_URI;
    }
  });

  test('6. Auth routes keep fail-closed 503 if still disconnected', async () => {
    const readyStateSpy = vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(0 as any);
    const origNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'password123' })
      });

      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.error).toBe('database_unavailable');
    } finally {
      readyStateSpy.mockRestore();
      process.env.NODE_ENV = origNodeEnv;
    }
  });
});
