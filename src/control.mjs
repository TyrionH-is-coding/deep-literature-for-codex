import net from 'node:net';
import fs from 'node:fs/promises';
import { realpathSync, mkdirSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { initializeRoot, isolatedEnvironment, readJson } from './core.mjs';

function canonicalRoot(root) {
  const absolute = path.resolve(root);
  let resolved = absolute;
  try { resolved = realpathSync.native(absolute); }
  catch {
    try { resolved = realpathSync(absolute); } catch { /* directory may not exist yet */ }
  }
  if (resolved.startsWith('\\\\?\\UNC\\')) return `\\\\${resolved.slice(8)}`;
  if (resolved.startsWith('\\\\?\\')) return resolved.slice(4);
  return resolved;
}

export function pipeName(root) {
  const resolved = canonicalRoot(root);
  const identity = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  const hash = createHash('sha256').update(identity).digest('hex').slice(0, 28);
  if (process.platform === 'win32') return `\\\\.\\pipe\\csr-${hash}`;
  // Unix socket paths are limited to about 100 bytes on macOS. Keep them
  // outside potentially long or non-ASCII install paths, isolated by UID.
  const directory = `/tmp/deep-literature-${process.getuid()}`;
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const entry = lstatSync(directory);
  if (!entry.isDirectory() || entry.isSymbolicLink() || entry.uid !== process.getuid()
      || (entry.mode & 0o077)) throw new Error('insecure_control_directory');
  return path.join(directory, `${hash}.sock`);
}

export async function request(root, command = 'status') {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(pipeName(root));
    let data = '';
    socket.setTimeout(command === 'stop' ? 20000 : 2500);
    socket.on('connect', () => socket.write(JSON.stringify({ command }) + '\n'));
    socket.on('data', chunk => {
      data += chunk.toString('utf8');
      if (data.length > 16384) socket.destroy(new Error('control_response_too_large'));
    });
    socket.on('timeout', () => socket.destroy(new Error('control_timeout')));
    socket.on('end', () => {
      try { resolve(JSON.parse(data)); } catch { reject(new Error('invalid_control_response')); }
    });
    socket.on('error', error => {
      if (['ENOENT', 'ECONNREFUSED'].includes(error.code)) resolve(null);
      else reject(error);
    });
  });
}

async function validate(state, instance) {
  if (['product', 'instanceId', 'root'].some(key => state[key] !== instance[key])) throw new Error('instance_identity_mismatch');
  if (state.status !== 'running') return state;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(state.url)) throw new Error('invalid_instance_url');
  const response = await fetch(`${state.url}/__workbench/identity`, { signal: AbortSignal.timeout(3000), redirect: 'error' });
  const actual = await response.json();
  if (!response.ok || ['product', 'instanceId', 'launchId', 'pid'].some(key => actual[key] !== state[key])) {
    throw new Error('instance_identity_mismatch');
  }
  return state;
}

export async function status(root) {
  const instance = await initializeRoot(root);
  const live = await request(instance.root);
  if (live) return validate(live, instance);
  let previous;
  try { previous = await readJson(path.join(instance.root, 'state', 'last-run.json')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  return { ...instance, status: previous?.status === 'failed' ? 'failed' : 'stopped', startedAt: previous?.startedAt,
    ...(previous?.status === 'failed' ? { error: previous.error, startedAt: previous.startedAt } : {}) };
}

export async function assertStartAllowed(root) {
  try { await fs.access(path.join(root, 'state', 'release-transition.json')); throw new Error('release_recovery_required'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const maintenance = await new Promise((resolve, reject) => {
    const socket = net.createConnection(`${pipeName(root)}-maintenance`);
    socket.setTimeout(1000, () => socket.destroy(new Error('maintenance_probe_timeout')));
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', error => ['ENOENT', 'ECONNREFUSED'].includes(error.code) ? resolve(false) : reject(error));
  });
  if (maintenance) throw new Error('maintenance_in_progress');
}

export async function start(root, { maintenance = false } = {}) {
  const attemptStarted = Date.now();
  const instance = await initializeRoot(root);
  const installation = await readJson(path.join(instance.root, 'installation.json'));
  if (!maintenance) await assertStartAllowed(instance.root);
  const current = await request(instance.root);
  if (current?.status === 'running') return validate(current, instance);
  if (!current) {
    const log = await fs.open(path.join(instance.root, 'state', 'logs', 'supervisor.log'), 'a');
    const env = isolatedEnvironment(instance.root, process.env, installation);
    if (maintenance) env.CSR_MAINTENANCE = '1';
    const supervisor = installation.app ? path.join(installation.app, 'src', 'supervisor.mjs') : fileURLToPath(new URL('./supervisor.mjs', import.meta.url));
    const child = spawn(installation.node, [supervisor, instance.root], {
      cwd: path.join(instance.root, 'workspace'), env,
      detached: true, windowsHide: true, shell: false, stdio: ['ignore', log.fd, log.fd],
    });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    child.unref();
    await log.close();
  }
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const live = await request(instance.root);
    if (live?.status === 'running') return validate(live, instance);
    if (live?.status === 'failed') throw new Error(live.error);
    if (!live) {
      const stale = await status(instance.root);
      if (stale.status === 'failed' && stale.startedAt >= attemptStarted) throw new Error(stale.error);
      if (stale.status === 'stopped' && stale.startedAt >= attemptStarted) throw new Error('start_cancelled_by_stop');
    }
    await delay(100);
  }
  throw new Error('start_timeout: host may still be starting; run status before reinstall. see state/logs/supervisor.log and dsh.log');
}

export async function stop(root) {
  const instance = await initializeRoot(root);
  const before = await request(instance.root);
  if (before) await validate(before, instance);
  const result = await request(instance.root, 'stop');
  if (result && ['product', 'instanceId', 'root'].some(key => result[key] !== instance[key])) throw new Error('instance_identity_mismatch');
  return result ?? { ...instance, status: 'stopped' };
}
