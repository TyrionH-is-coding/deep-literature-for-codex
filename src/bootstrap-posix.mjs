import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initializeRoot, readJson, verifyFile, isolatedEnvironment } from './modules/foundation/index.mjs';
import { defaultRoot, selectPlatformPins, runtimePaths } from './modules/foundation/index.mjs';
import { pipeName } from './modules/lifecycle/index.mjs';
import { prepareLocalSocket } from './modules/lifecycle/index.mjs';

const source = await fs.realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const options = {};
for (let i = 2; i < process.argv.length; i++) {
  const flag = process.argv[i];
  if (flag === '--install-skill') options.skill = true;
  else if (['--root', '--plugin-archive', '--skills-directory', '--library-backup', '--bootstrap-node'].includes(flag)) {
    if (!process.argv[i + 1] || process.argv[i + 1].startsWith('--')) throw new Error('missing_argument: ' + flag);
    options[flag.slice(2)] = process.argv[++i];
  } else throw new Error('unknown_argument: ' + flag);
}
if (!options['plugin-archive'] || !options['bootstrap-node']) throw new Error('plugin_archive_required');
if (process.platform === 'win32') throw new Error('use_windows_installer');
const pins = selectPlatformPins(await readJson(path.join(source, 'runtime', 'pins.json')));
const archive = await fs.realpath(path.resolve(options['plugin-archive']));
await verifyFile(archive, pins.plugin.sha256);
let manifest;
try { manifest = await readJson(path.join(source, 'BUILD-MANIFEST.json')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (manifest) {
  for (const [relative, sha] of Object.entries(manifest.files)) {
    const file = path.resolve(source, relative);
    if (!file.startsWith(source + path.sep) || (await fs.realpath(file)) !== file) throw new Error('invalid_build_manifest');
    try { await verifyFile(file, sha); } catch { throw new Error('source_checksum_mismatch: ' + relative); }
  }
}
const { root } = await initializeRoot(options.root || defaultRoot());
const lockName = `${pipeName(root)}-install`;
await prepareLocalSocket(lockName);
const lock = net.createServer(socket => socket.end());
await new Promise((resolve, reject) => {
  lock.once('error', error => reject(new Error(error.code === 'EADDRINUSE' ? 'installation_in_progress' : error.message)));
  lock.listen(lockName, resolve);
});
async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, stdio: ['ignore', 'inherit', 'inherit'],
      env: isolatedEnvironment(root, process.env), cwd: root });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(new Error('runtime_prepare_failed: ' + command)));
  });
}
try {
  const paths = runtimePaths(root, pins);
  async function exists(file) { try { await fs.access(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }
  if (!await exists(paths.node)) {
    await fs.mkdir(path.dirname(paths.nodeRoot), { recursive: true });
    await fs.cp(path.resolve(options['bootstrap-node']), paths.nodeRoot, { recursive: true, force: false, errorOnExist: true, verbatimSymlinks: true });
  }
  if (!await exists(paths.pythonBase)) {
    const downloads = path.join(root, 'runtime', 'downloads');
    await fs.mkdir(downloads, { recursive: true });
    const target = path.join(downloads, `python-${pins.platform}-${pins.python.version}-${pins.python.build}.tar.gz`);
    let valid = false;
    if (await exists(target)) { try { await verifyFile(target, pins.python.sha256); valid = true; } catch { /* redownload corrupt cache */ } }
    if (!valid) {
      console.error('Downloading pinned Python for ' + pins.platform);
      await run('/usr/bin/curl', ['--fail', '--location', '--retry', '3', '--proto', '=https', '--proto-redir', '=https',
        '--connect-timeout', '30', '--max-time', '600', '--output', target + '.part', pins.python.url]);
      await verifyFile(target + '.part', pins.python.sha256);
      await fs.rename(target + '.part', target);
    }
    await fs.mkdir(paths.pythonRoot, { recursive: true });
    await run('/usr/bin/tar', ['-xzf', target, '-C', paths.pythonRoot]);
  }
  const skills = options.skill
    ? path.resolve(options['skills-directory'] || path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'skills')) : '-';
  // Run the shared installer in this process while its OS socket lock is held.
  process.argv = [process.execPath, path.join(source, 'src', 'install.mjs'), root, archive, skills,
    options['library-backup'] ? path.resolve(options['library-backup']) : '-'];
  await import('./install.mjs');
} finally {
  await new Promise(resolve => lock.close(resolve));
}
