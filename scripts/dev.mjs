import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiPort = Number(process.env.PORT) || 5000;
const api = spawn(process.execPath, [
  path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
  path.join(root, 'server.js')
], { cwd: root, stdio: 'inherit' });

let vite;
let shuttingDown = false;

const stopChildren = (signal = 'SIGTERM') => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of [api, vite]) {
    if (child && child.exitCode === null) child.kill(signal);
  }
};

const fail = (message) => {
  console.error(`[AutoFeast Dev] ${message}`);
  stopChildren();
  process.exitCode = 1;
};

process.once('SIGINT', () => stopChildren('SIGINT'));
process.once('SIGTERM', () => stopChildren('SIGTERM'));

api.once('error', error => fail(`Could not start API server: ${error.message}`));
api.once('exit', (code, signal) => {
  if (!shuttingDown && code !== 0) {
    fail(`API server exited (${signal || code}).`);
  } else if (!shuttingDown) {
    stopChildren();
  }
});

const waitForApi = (deadline) => new Promise((resolve, reject) => {
  if (Date.now() >= deadline) {
    reject(new Error(`API server did not listen on port ${apiPort} in time.`));
    return;
  }

  const socket = createConnection({ host: '127.0.0.1', port: apiPort });
  socket.once('connect', () => {
    socket.destroy();
    resolve();
  });
  socket.once('error', () => {
    socket.destroy();
    if (api.exitCode !== null) {
      reject(new Error('API server exited before it started listening.'));
    } else {
      setTimeout(() => waitForApi(deadline).then(resolve, reject), 200);
    }
  });
});

try {
  await waitForApi(Date.now() + 45000);
  if (shuttingDown) process.exit(1);

  vite = spawn(process.execPath, [
    path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'),
    '--port=3000',
    '--host=0.0.0.0'
  ], { cwd: root, stdio: 'inherit' });

  vite.once('error', error => fail(`Could not start Vite: ${error.message}`));
  vite.once('exit', (code, signal) => {
    if (!shuttingDown && code !== 0) {
      fail(`Vite exited (${signal || code}).`);
    } else if (!shuttingDown) {
      stopChildren();
    }
  });
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
