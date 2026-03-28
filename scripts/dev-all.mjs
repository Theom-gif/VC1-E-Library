import {spawn} from 'node:child_process';

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

const backend = spawnChild('node', ['scripts/mock-backend.mjs'], {name: 'backend'});
const frontend = spawnChild(npmCmd, ['--prefix', 'frontend', 'run', 'dev'], {name: 'frontend'});

const shutdown = () => {
  try {
    backend.kill('SIGINT');
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
  if (backend.exitCode !== null || frontend.exitCode !== null) {
    clearInterval(checkAlive);
    shutdown();
  }
}, 500);
