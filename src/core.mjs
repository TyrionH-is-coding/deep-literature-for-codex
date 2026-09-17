import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { runtimePaths } from './platform.mjs';

export const PRODUCT = 'codex-scientific-reading';
export const DISPLAY_NAME = 'Deep Literature for Codex';
export const SKILL_NAME = 'deep-literature-for-codex';
export const VERSION = '0.1.0-rc.6';

export async function readJson(file) {
  return JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
}

export async function writeJson(file, value) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    await fs.writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
    await fs.rename(temporary, file);
  } finally { await fs.rm(temporary, { force: true }); }
}

export async function initializeRoot(requested) {
  if (/[\r\n\0]/.test(requested)) throw new Error('invalid_root');
  const absolute = path.resolve(requested);
  if (absolute === path.parse(absolute).root) throw new Error('invalid_root');
  await fs.mkdir(absolute, { recursive: true });
  const root = await fs.realpath(absolute);
  const marker = path.join(root, '.workbench.json');
  let instance;
  try { instance = await readJson(marker); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    if ((await fs.readdir(root)).length) throw new Error('root_not_empty');
    instance = { product: PRODUCT, schema: 1, instanceId: randomUUID(), root };
    await fs.writeFile(marker, JSON.stringify(instance, null, 2) + '\n', { flag: 'wx' });
  }
  if (instance.product !== PRODUCT || instance.schema !== 1 || instance.root !== root ||
      !/^[a-f0-9-]{36}$/.test(instance.instanceId)) throw new Error('invalid_instance_marker');
  for (const relative of ['library', 'workspace', 'state/dsh-home', 'state/logs', 'runtime']) {
    await fs.mkdir(path.join(root, relative), { recursive: true });
  }
  return instance;
}

// Only operating-system and explicit network settings cross into this host.
export function isolatedEnvironment(root, parent = process.env, installation = {}, platform = process.platform) {
  const env = {};
  const keep = new Set(['SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP',
    'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'PROGRAMDATA', 'PROGRAMFILES',
    'PROGRAMFILES(X86)', 'COMMONPROGRAMFILES', 'PROCESSOR_ARCHITECTURE', 'NUMBER_OF_PROCESSORS',
    'USERNAME', 'USERDOMAIN', 'OS', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY',
    'SSL_CERT_FILE', 'SSL_CERT_DIR', 'NODE_EXTRA_CA_CERTS',
    'HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TMPDIR',
    'XDG_RUNTIME_DIR', 'DBUS_SESSION_BUS_ADDRESS', 'DISPLAY', 'WAYLAND_DISPLAY', 'XAUTHORITY']);
  for (const [key, value] of Object.entries(parent)) {
    if (keep.has(key.toUpperCase()) && value !== undefined) env[key.toUpperCase()] = value;
  }
  const windows = env.SYSTEMROOT || 'C:\\Windows';
  const systemPaths = platform === 'win32'
    ? [path.join(windows, 'System32'), windows, path.join(windows, 'System32', 'WindowsPowerShell', 'v1.0')]
    : ['/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'];
  env.PATH = [installation.node ? path.dirname(installation.node) : path.join(root, 'runtime', 'node'),
    installation.python ? path.dirname(installation.python) : path.join(root, 'runtime', 'venv', platform === 'win32' ? 'Scripts' : 'bin'),
    ...systemPaths].join(path.delimiter);
  env.DSH_HOME = path.join(root, 'state', 'dsh-home');
  env.DSH_TELEMETRY_DISABLED = '1';
  env.PYTHONUTF8 = '1';
  env.PYTHONIOENCODING = 'utf-8';
  env.PYTHONNOUSERSITE = '1';
  env.VIRTUAL_ENV = installation.python ? path.dirname(path.dirname(installation.python)) : path.join(root, 'runtime', 'venv');
  env.CODEX_HOME = path.join(root, 'state', 'codex-home');
  env.NO_COLOR = '1';
  return env;
}

export function prerequisitePaths(root, pins) {
  return runtimePaths(root, pins);
}

export async function verifyFile(file, expected) {
  if (!/^[a-f0-9]{64}$/.test(expected)) throw new Error('invalid_checksum');
  const actual = createHash('sha256').update(await fs.readFile(file)).digest('hex');
  if (actual !== expected) throw new Error(`checksum_mismatch: ${path.basename(file)}`);
  return actual;
}

async function filesBelow(root, relative = '') {
  const result = {};
  for (const entry of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
    const file = path.join(relative, entry.name);
    if (entry.isDirectory()) Object.assign(result, await filesBelow(root, file));
    else if (entry.isFile()) result[file] = await fs.readFile(path.join(root, file));
    else throw new Error('unsupported_skill_link');
  }
  return result;
}

const fingerprints = files => Object.fromEntries(Object.entries(files).map(([file, data]) => [file, createHash('sha256').update(data).digest('hex')]));
const sameFiles = (a, b) => Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([file, sha]) => b[file] === sha);

export async function installSkill(source, skillsRoot, root) {
  const target = path.join(skillsRoot, SKILL_NAME);
  const expected = await filesBelow(source);
  expected['installation.json'] = Buffer.from(JSON.stringify({ product: PRODUCT, root }, null, 2) + '\n');
  expected['location.txt'] = Buffer.from(root + '\n');
  const receipt = path.join(root, 'state', 'installed-skill.json');
  let legacySkill;
  const remember = async () => {
    let previous;
    try { previous = await readJson(receipt); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (previous?.target === path.join(skillsRoot, PRODUCT)) legacySkill = await removeManagedSkill(root);
    await writeJson(receipt, { target, files: fingerprints(expected) });
  };
  let replace = false;
  try {
    const present = await filesBelow(target);
    if (sameFiles(fingerprints(present), fingerprints(expected))) {
      await remember();
      return { path: target, reused: true, ...(legacySkill ? { legacySkill } : {}) };
    }
    let previous;
    try { previous = await readJson(receipt); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (previous?.target !== target || !sameFiles(previous.files, fingerprints(present))) {
      return { status: 'retained_custom_changes', reason: 'skill_conflict', path: target };
    }
    replace = true;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.mkdir(skillsRoot, { recursive: true });
  const staging = path.join(skillsRoot, `${SKILL_NAME}.staging-${randomUUID()}`);
  await fs.mkdir(staging);
  let backup;
  try {
    for (const [file, data] of Object.entries(expected)) {
      await fs.mkdir(path.dirname(path.join(staging, file)), { recursive: true });
      await fs.writeFile(path.join(staging, file), data, { flag: 'wx' });
    }
    if (replace) {
      backup = path.join(root, 'state', 'skill-backups', randomUUID());
      await fs.cp(target, backup, { recursive: true });
      if (path.dirname(target) !== path.resolve(skillsRoot) || path.basename(target) !== SKILL_NAME) throw new Error('invalid_skill_target');
      await fs.rm(target, { recursive: true });
    }
    await fs.rename(staging, target);
    await remember();
  } catch (error) {
    if (backup) {
      try { await fs.access(target); } catch (missing) { if (missing.code !== 'ENOENT') throw missing; await fs.cp(backup, target, { recursive: true }); }
    }
    throw error;
  } finally {
    // The generated staging sibling is owned by this invocation, never the target.
    if (path.dirname(staging) !== path.resolve(skillsRoot)) throw new Error('invalid_skill_staging');
    await fs.rm(staging, { recursive: true, force: true });
  }
  return { path: target, reused: false, updated: replace, ...(legacySkill ? { legacySkill } : {}) };
}

export async function removeManagedSkill(root) {
  let receipt;
  try { receipt = await readJson(path.join(root, 'state', 'installed-skill.json')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; return { status: 'not_installed' }; }
  const target = path.resolve(receipt.target);
  if (![PRODUCT, SKILL_NAME].includes(path.basename(target)) || path.dirname(target) === target) throw new Error('invalid_skill_target');
  let current;
  try { current = await filesBelow(target); }
  catch (error) { if (error.code !== 'ENOENT') throw error; return { status: 'not_found', path: target }; }
  if (!sameFiles(receipt.files, fingerprints(current))) return { status: 'retained_custom_changes', path: target };
  await fs.rm(target, { recursive: true });
  return { status: 'removed', path: target };
}
