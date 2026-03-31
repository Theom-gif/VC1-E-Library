import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

function spawnChild(command, args, {name}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    windowsHide: false,
  });
  child.on('exit', (code, signal) => {
    if (signal) process.stderr.write(`[dev-all] ${name} exited (signal ${signal})\n`);
    else process.stderr.write(`[dev-all] ${name} exited (code ${code})\n`);
  });
  return child;
}

function readEnvFileValue(filePath, key) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = String(line || '').trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const k = trimmed.slice(0, idx).trim();
      if (k !== key) continue;
      let v = trimmed.slice(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      return v;
    }
  } catch {}
  return '';
}

function shouldStartMockBackend(target) {
  const normalized = String(target || '').trim().toLowerCase().replace(/\/+$/, '');
  return (
    normalized === 'http://127.0.0.1:8000' ||
    normalized === 'http://localhost:8000' ||
    normalized === 'http://0.0.0.0:8000'
  );
}

const envTarget =
  process.env.VITE_BACKEND_PROXY_TARGET ||
  readEnvFileValue(path.resolve('frontend/.env.local'), 'VITE_BACKEND_PROXY_TARGET') ||
  'https://elibrary.pncproject.site';

const backend = shouldStartMockBackend(envTarget)
  ? spawnChild('node', ['scripts/mock-backend.mjs'], {name: 'backend'})
  : null;
const frontend = spawnChild(npmCmd, ['--prefix', 'frontend', 'run', 'dev'], {name: 'frontend'});

const shutdown = () => {
  try {
    backend?.kill('SIGINT');
  } catch {}
  try {
    frontend.kill('SIGINT');
  } catch {}
};

process.on('SIGINT', () => {
  shutdown();
  process.exit(0);
});
process.on('SIGTERM', () => {
  shutdown();
  process.exit(0);
});

// If either exits, shut down the other so the command doesn't hang.
const checkAlive = setInterval(() => {
  const backendExited = backend ? backend.exitCode !== null : false;
  if (backendExited || frontend.exitCode !== null) {
    clearInterval(checkAlive);
    shutdown();
  }
}, 500);
