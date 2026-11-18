import { spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateDir = '/tmp/sportsgrow-dev';
const stateFile = path.join(stateDir, 'servers.json');

const services = [
  {
    name: 'api',
    port: 3000,
    cwd: path.join(root, 'server'),
    command: 'npm',
    args: ['run', 'dev'],
    url: 'http://127.0.0.1:3000',
    health: 'http://127.0.0.1:3000/api/health',
  },
  {
    name: 'web',
    port: 5173,
    cwd: path.join(root, 'web'),
    command: 'npm',
    args: ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173', '--strictPort'],
    url: 'http://127.0.0.1:5173',
    health: 'http://127.0.0.1:5173/',
  },
  {
    name: 'root',
    port: 8765,
    cwd: root,
    command: 'python3',
    args: ['-m', 'http.server', '8765', '--bind', '127.0.0.1'],
    url: 'http://127.0.0.1:8765',
    health: 'http://127.0.0.1:8765/login.html',
  },
];

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const done = (open) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.setTimeout(400, () => done(false));
  });
}

async function readState() {
  try {
    const parsed = JSON.parse(await readFile(stateFile, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeState(state) {
  await mkdir(stateDir, { recursive: true });
  await writeFile(stateFile, JSON.stringify(state, null, 2) + '\n');
}

function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
    child.on('error', () => resolve({ code: 1, stdout, stderr }));
  });
}

async function database() {
  const inspect = await run('docker', ['inspect', '-f', '{{.State.Running}}', 'sportsgrow-db-1']);
  if (inspect.code !== 0) {
    return { container: 'sportsgrow-db-1', state: 'missing' };
  }
  if (inspect.stdout.trim() === 'true') {
    return { container: 'sportsgrow-db-1', state: 'running' };
  }
  if (await portOpen(5432)) {
    return { container: 'sportsgrow-db-1', state: 'port_busy' };
  }
  const started = await run('docker', ['start', 'sportsgrow-db-1']);
  if (started.code !== 0) {
    return { container: 'sportsgrow-db-1', state: 'start_failed' };
  }
  const ready = await run('docker', ['exec', 'sportsgrow-db-1', 'pg_isready', '-U', 'sportsgrow_migrate', '-d', 'sportsgrow']);
  return { container: 'sportsgrow-db-1', state: ready.code === 0 ? 'started' : 'starting' };
}

async function inspectDatabase() {
  const inspect = await run('docker', ['inspect', '-f', '{{.State.Running}}', 'sportsgrow-db-1']);
  if (inspect.code !== 0) {
    return { container: 'sportsgrow-db-1', state: 'missing' };
  }
  return {
    container: 'sportsgrow-db-1',
    state: inspect.stdout.trim() === 'true' ? 'running' : 'stopped',
  };
}

async function waitHealth(url) {
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (response.ok || response.status === 401) return 'ok';
    } catch {
      // The process is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return 'timeout';
}

async function startOwned(service) {
  await mkdir(stateDir, { recursive: true });
  const logFd = openSync(path.join(stateDir, `${service.name}.log`), 'a');
  const child = spawn(service.command, service.args, {
    cwd: service.cwd,
    detached: true,
    stdio: ['ignore', logFd, logFd],
  });
  child.unref();
  closeSync(logFd);
  return child.pid;
}

async function reportStatus() {
  const report = { database: await inspectDatabase() };
  for (const service of services) {
    const open = await portOpen(service.port);
    report[service.name] = {
      url: service.url,
      port: service.port,
      state: open ? 'already_running' : 'stopped',
      health: open ? await waitHealth(service.health) : 'stopped',
    };
  }
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

async function startAll() {
  const state = await readState();
  const databaseState = await database();
  const report = { database: databaseState };
  for (const service of services) {
    const open = await portOpen(service.port);
    if (open) {
      report[service.name] = {
        url: service.url,
        port: service.port,
        state: 'already_running',
        health: await waitHealth(service.health),
      };
      continue;
    }
    const pid = await startOwned(service);
    state[service.name] = { pid, port: service.port, owned: true };
    report[service.name] = {
      url: service.url,
      port: service.port,
      state: 'started',
      pid,
      health: await waitHealth(service.health),
    };
  }
  await writeState(state);
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

async function stopOwned() {
  const state = await readState();
  const report = {};
  for (const service of services) {
    const entry = state[service.name];
    if (!entry?.owned || !alive(entry.pid)) {
      report[service.name] = { state: 'not_owned' };
      delete state[service.name];
      continue;
    }
    try {
      process.kill(-entry.pid, 'SIGTERM');
    } catch {
      try {
        process.kill(entry.pid, 'SIGTERM');
      } catch {
        report[service.name] = { state: 'stop_failed', pid: entry.pid };
        continue;
      }
    }
    report[service.name] = { state: 'stopped', pid: entry.pid };
    delete state[service.name];
  }
  await writeState(state);
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

const command = process.argv[2] ?? 'start';
if (command === 'stop') {
  await stopOwned();
} else if (command === 'status') {
  await reportStatus();
} else if (command === 'start') {
  await startAll();
} else {
  process.stderr.write('usage: node scripts/dev-servers.mjs [start|stop]\n');
  process.exit(1);
}
