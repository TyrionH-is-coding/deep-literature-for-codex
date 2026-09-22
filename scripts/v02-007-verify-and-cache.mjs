import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const taskRoot = 'C:/tmp/v007';
const packageRoot = path.join(taskRoot, 'package/deep-literature-for-codex-0.2.0-dev.5-win-x64');
const instanceRoot = path.join(taskRoot, 'instance');
const evidenceRoot = path.join(taskRoot, 'evidence');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const manifestPath = path.join(packageRoot, 'BUILD-MANIFEST.json');
const manifestBytes = await fs.readFile(manifestPath);
const manifest = JSON.parse(manifestBytes);
assert.equal(manifest.sourceCommit, '058afb0fe8ebd5e39a4f9ca7e495011e4cde61ca');
assert.equal(manifest.pluginSourceCommit, '8b195c9109efd92ba74c37bb244b2c6b155060de');
assert.equal(manifest.version, '0.2.0-dev.5');
const files = [];
for (const [relative, expected] of Object.entries(manifest.files)) {
  const target = path.resolve(packageRoot, relative);
  assert(target.startsWith(path.resolve(packageRoot) + path.sep), `unsafe manifest path: ${relative}`);
  assert.match(expected, /^[a-f0-9]{64}$/);
  const bytes = await fs.readFile(target);
  const actual = digest(bytes);
  assert.equal(actual, expected, relative);
  files.push({ path: relative, sha256: actual, bytes: bytes.length });
}
const pins = await read(path.join(packageRoot, 'runtime/pins.json'));
assert.equal(pins.plugin.sourceCommit, manifest.pluginSourceCommit);
const { hashInstallSource } = await import(pathToFileURL(path.join(packageRoot, 'src/modules/releases/index.mjs')).href);
const appSha256 = await hashInstallSource(packageRoot, 'win32-x64');
assert.equal(appSha256, 'bc4479d1e5a402f1a4f0d9d95e80142de65e0de25fec14a4a52366ef5fa92ee7');
await fs.writeFile(path.join(evidenceRoot, 'build-manifest-verification.json'), JSON.stringify({
  checkedAt: new Date().toISOString(), packageRoot, manifestSha256: digest(manifestBytes),
  sourceCommit: manifest.sourceCommit, pluginSourceCommit: manifest.pluginSourceCommit,
  appSha256, verifiedFiles: files.length, files,
}, null, 2), { flag: 'wx' });
try { await fs.stat(instanceRoot); throw Error('instance_already_exists'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const { initializeRoot } = await import(pathToFileURL(path.join(packageRoot, 'src/modules/foundation/index.mjs')).href);
const instance = await initializeRoot(instanceRoot);
await fs.mkdir(path.join(instanceRoot, 'runtime/downloads'), { recursive: true });
const records = [];
for (const [name, expected] of [
  [`node-${pins.node.version}.zip`, pins.node.sha256],
  [`python-${pins.python.version}-${pins.python.build}.tar.gz`, pins.python.sha256],
]) {
  const source = path.join('C:/tmp/v006/downloads', name);
  const destination = path.join(instanceRoot, 'runtime/downloads', name);
  const bytes = await fs.readFile(source);
  const sha256 = digest(bytes);
  assert.equal(sha256, expected, `runtime archive ${name}`);
  await fs.writeFile(destination, bytes, { flag: 'wx' });
  records.push({ source, destination, sha256, bytes: bytes.length });
}
await fs.writeFile(path.join(evidenceRoot, 'install-cache.json'), JSON.stringify({
  preparedAt: new Date().toISOString(), packageRoot, instanceRoot, instanceId: instance.instanceId, records,
}, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ ok: true, appSha256, verifiedFiles: files.length, instanceId: instance.instanceId }));
