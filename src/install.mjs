import { installSkill } from './modules/skill/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { initializeRoot, isolatedEnvironment, runtimePaths, readJson, writeJson, verifyFile, VERSION, SKILL_NAME, readRecovery } from './modules/foundation/index.mjs';
import { activateRelease, recoverRelease, hashInstallSource } from './modules/releases/index.mjs';
import { restoreNewLibrary } from './modules/releases/index.mjs';
import { selectPlatformPins, venvPython, npmCli, directoryLinkType } from './modules/foundation/index.mjs';
import { setupSteps } from './onboarding.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [requestedRoot, archive, requestedSkills, requestedBackup, requestedRecoveryId] = process.argv.slice(2);
const recoveryId = requestedRecoveryId ?? process.env.CSR_RECOVERY_INSTALL_ID;
const skillsRoot = requestedSkills === '-' ? null : requestedSkills;
const libraryBackup = requestedBackup === '-' ? null : requestedBackup;
const pins = selectPlatformPins(await readJson(path.join(source, 'runtime', 'pins.json')));
await verifyFile(archive, pins.plugin.sha256);
const instance = await initializeRoot(requestedRoot);
const root = instance.root;
const recovery = await readRecovery(root);
if (recovery && (recovery.phase !== 'preparing' || recovery.transactionId !== recoveryId)) throw new Error('instance_recovery_install_blocked');
if (!recovery && recoveryId) throw new Error('instance_recovery_transaction_mismatch');
const { node, pythonBase } = runtimePaths(root, pins);
const appSha256 = await hashInstallSource(source, pins.platform);
// Short directory names keep Python's bundled pip below Windows MAX_PATH.
// The descriptor still checks the complete SHA, including prefix collisions.
const slot = path.join(root, 'releases', appSha256.slice(0, 16));
const runtime = path.join(slot, 'runtime');
const npmRoot = path.join(runtime, 'npm');
const python = venvPython(path.join(runtime, 'venv'));
const app = path.join(slot, 'app');
const env = isolatedEnvironment(root, process.env, { node, python });
async function run(command, args, label, cwd = root) {
  const started = Date.now();
  console.error(label);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    const heartbeat = setInterval(() => {
      console.error(`${label} … ${Math.round((Date.now() - started) / 1000)}s`);
    }, 15000);
    let stdout = '';
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => process.stderr.write(data));
    child.on('error', error => { clearInterval(heartbeat); reject(error); });
    child.on('close', code => {
      clearInterval(heartbeat);
      code === 0 ? resolve(stdout.trim()) : reject(new Error(label + ': exit ' + code));
    });
  });
}
await recoverRelease(root);
let release;
try { release = await readJson(path.join(slot, 'release.json')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (release && release.appSha256 !== appSha256) throw new Error('release_hash_collision');
if (!release) {
  if (await run(node, ['--version'], 'Check private Node') !== 'v' + pins.node.version) throw new Error('node_version_mismatch');
  if (await run(pythonBase, ['-I', '-X', 'utf8', '-c', 'import platform; print(platform.python_version())'], 'Check private Python') !== pins.python.version) throw new Error('python_version_mismatch');
  await fs.mkdir(npmRoot, { recursive: true });
  for (const file of ['package.json', 'package-lock.json']) await fs.copyFile(path.join(source, 'runtime', file), path.join(npmRoot, file));
  await fs.copyFile(archive, path.join(npmRoot, 'scientific-reading.tgz'));
  await verifyFile(path.join(npmRoot, 'scientific-reading.tgz'), pins.plugin.sha256);
  await fs.cp(path.join(source, 'oauth'), path.join(npmRoot, 'oauth'), {
    recursive: true, filter: file => !file.split(path.sep).some(part => ['node_modules', '.work', '.git', 'tests', 'test-results'].includes(part)),
  });
  await fs.writeFile(path.join(runtime, 'npmrc'), 'registry=https://registry.npmjs.org/\n');
  env.NPM_CONFIG_USERCONFIG = path.join(runtime, 'npmrc');
  env.NPM_CONFIG_GLOBALCONFIG = path.join(runtime, 'npmrc-global');
  env.NPM_CONFIG_CACHE = path.join(root, 'runtime', 'cache', 'npm');
  await run(node, [npmCli(node),
    'ci', '--ignore-scripts', '--no-audit', '--no-fund'], 'Install locked DSH packages', npmRoot);
  await run(pythonBase, ['-I', '-X', 'utf8', '-m', 'venv', path.join(runtime, 'venv')], 'Create private Python environment');
  env.PIP_CONFIG_FILE = process.platform === 'win32' ? 'NUL' : '/dev/null';
  env.PIP_CACHE_DIR = path.join(root, 'runtime', 'cache', 'pip');
  await run(python, ['-I', '-X', 'utf8', '-m', 'pip', 'install', '--disable-pip-version-check', '--no-input',
    '--index-url', 'https://pypi.org/simple', '--only-binary=:all:', '--require-hashes', '--no-deps',
    '-r', path.join(source, 'runtime', 'requirements.lock')], 'Install locked Python dependencies');
  const plugin = path.join(npmRoot, 'node_modules', '@dsh-external', 'dsh-scientific-reading');
  const metadata = await readJson(path.join(plugin, 'package.json'));
  if (metadata.name !== pins.plugin.name || metadata.version !== pins.plugin.version) throw new Error('plugin_version_mismatch');
  const wheels = (await fs.readdir(path.join(plugin, 'dist', 'python'))).filter(f => f.endsWith('.whl'));
  if (wheels.length !== 1) throw new Error('one_bundled_wheel_required');
  await run(python, ['-I', '-X', 'utf8', '-m', 'pip', 'install', '--disable-pip-version-check', '--no-input', '--no-index', '--no-deps', '--force-reinstall',
    path.join(plugin, 'dist', 'python', wheels[0])], 'Install A bundled engine');
  const probe = await run(python, ['-I', '-X', 'utf8', '-c', 'import scientific_reading, bs4, latex2mathml, PIL, openpyxl; print(scientific_reading.__file__)'], 'Verify engine imports');
  if (!probe.toLowerCase().startsWith(path.join(runtime, 'venv').toLowerCase() + path.sep)) throw new Error('engine_outside_instance');
  for (const folder of ['src', 'skills']) await fs.cp(path.join(source, folder), path.join(app, folder), { recursive: true });
  await fs.cp(path.join(source, 'runtime'), path.join(app, 'runtime'), {
    recursive: true, filter: file => !file.endsWith('.tgz') && !file.split(path.sep).includes('node_modules'),
  });
  const profile = path.join(env.DSH_HOME, 'profiles', 'workbench');
  await fs.mkdir(profile, { recursive: true });
  const profilePackage = path.join(slot, 'profile-package.json');
  await writeJson(profilePackage, { name: 'codex-reading-profile', private: true,
    dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', pins.plugin.name, 'codex-scientific-reading-oauth'] } } });
  await fs.writeFile(path.join(profile, 'cordis.patch.yml'), '[]\n', { flag: 'wx' }).catch(error => { if (error.code !== 'EEXIST') throw error; });
  const profileModules = path.join(slot, 'profile-modules');
  const pluginLink = path.join(profileModules, '@dsh-external', 'dsh-scientific-reading');
  await fs.mkdir(path.dirname(pluginLink), { recursive: true });
  try { await fs.symlink(plugin, pluginLink, directoryLinkType()); }
  catch (error) { if (error.code !== 'EEXIST' || await fs.realpath(pluginLink) !== await fs.realpath(plugin)) throw error; }
  const oauthPath = path.join(npmRoot, 'node_modules', 'codex-scientific-reading-oauth');
  const oauthLink = path.join(profileModules, 'codex-scientific-reading-oauth');
  try { await fs.symlink(oauthPath, oauthLink, directoryLinkType()); }
  catch (error) { if (error.code !== 'EEXIST' || await fs.realpath(oauthLink) !== await fs.realpath(oauthPath)) throw error; }
  release = { product: instance.product, version: VERSION, appSha256, slot, app, profileModules, profilePackage, dataFormat: 4, node, python,
    dsh: path.join(npmRoot, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'),
    pins, candidate: pins.channel !== 'release', browserCapability: 'check_in_codex', installedAt: new Date().toISOString() };
  await writeJson(path.join(slot, 'release.json'), release);
}
const migration = libraryBackup ? await restoreNewLibrary(root, release, libraryBackup) : null;
const selected = await activateRelease(root, release, { recoveryId });
for (const file of ['workbench.ps1', 'uninstall.ps1', 'workbench.sh', 'uninstall.sh']) await fs.copyFile(path.join(source, file), path.join(root, file));
await fs.copyFile(path.join(source, 'src', 'launcher.mjs'), path.join(root, 'launcher.mjs'));
await fs.writeFile(path.join(root, '.workbench-node'), node + '\n', { mode: 0o600 });
const skill = skillsRoot ? await installSkill(path.join(app, 'skills', SKILL_NAME), path.resolve(skillsRoot), root) : null;
console.error('\n接下来完成首次配置：\n' + setupSteps.join('\n'));
console.log(JSON.stringify({ ok: true, root, instanceId: instance.instanceId, version: VERSION,
  candidate: release.candidate, installation: selected.status, skill, migration, setupSteps, start: { node, cli: path.join(app, 'src', 'cli.mjs'), args: ['start', root] } }, null, 2));
