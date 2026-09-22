import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const read = async f => JSON.parse((await fs.readFile(f, 'utf8')).replace(/^\uFEFF/, ''));
const write = (f, v) => fs.writeFile(f, JSON.stringify(v, null, 2));
const sha = b => createHash('sha256').update(b).digest('hex');
const source = 'C:/tmp/v006/source', neighbor = process.argv[2], candidate = process.argv[3] ?? 'r4';
const installed = await read(path.join(source, 'installation.json'));
const api = await import(pathToFileURL(path.join(installed.app, 'src/modules/releases/index.mjs')).href);
const life = await import(pathToFileURL(path.join(installed.app, 'src/modules/lifecycle/index.mjs')).href);
const foundation = await import(pathToFileURL(path.join(installed.app, 'src/modules/foundation/index.mjs')).href);
const base = await fs.mkdtemp('C:/tmp/v006/failures-');
const archive = 'C:/tmp/v006/backup-' + candidate;
const packageRoot = 'C:/tmp/v006/candidate-' + candidate + '/verified-extraction/deep-literature-for-codex-0.2.0-dev.5-win-x64';
const report = { base, source, neighbor, cases: [] };
async function inventory(root) {
  const result = {};
  async function walk(dir) {
    for (const item of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      if ((await fs.lstat(full)).isSymbolicLink() || item.name === 'node_modules') continue;
      if (item.isDirectory()) await walk(full);
      else result[path.relative(root, full)] = sha(await fs.readFile(full));
    }
  }
  for (const name of ['library', 'state/dsh-home']) await walk(path.join(root, name));
  result.handoff = sha(await fs.readFile(path.join(root, 'state/handoff.json')));
  return result;
}
const sourceBefore = await inventory(source), neighborBefore = await inventory(neighbor);
async function rejected(name, fn, expected) {
  try { await fn(); throw Error('unexpected_success:' + name); }
  catch (error) { assert.match(error.message, expected, name + ': ' + error.message); report.cases.push({ name, error: error.message, passed: true }); }
}
async function mutated(name, mutate) {
  const target = path.join(base, name); await fs.cp(archive, target, { recursive: true });
  await mutate(target);
  return target;
}
async function rewriteNative(dir, mutate) {
  const native = await read(path.join(dir, 'native.json')); mutate(native);
  await write(path.join(dir, 'native.json'), native);
  const manifest = await read(path.join(dir, 'manifest.json')), bytes = await fs.readFile(path.join(dir, 'native.json'));
  Object.assign(manifest.files.find(f => f.path === 'native.json'), { size: bytes.length, sha256: sha(bytes) });
  await write(path.join(dir, 'manifest.json'), manifest);
}
try {
  for (const [name, mutate, pattern] of [
    ['missing-domain', d => fs.unlink(path.join(d, 'handoff.json')), /domains/],
    ['truncated-file', d => fs.writeFile(path.join(d, 'library.zip'), 'broken'), /budget|digest/],
    ['digest-corrupt', async d => { const b = await fs.readFile(path.join(d, 'library.zip')); b[10] ^= 1; await fs.writeFile(path.join(d, 'library.zip'), b); }, /digest/],
    ['path-traversal', async d => { const m = await read(path.join(d, 'manifest.json')); m.files[0].path = '../escape'; await write(path.join(d, 'manifest.json'), m); }, /path/],
    ['over-budget', async d => { const m = await read(path.join(d, 'manifest.json')); m.files[0].size = 2 ** 30; await write(path.join(d, 'manifest.json'), m); }, /budget/],
    ['unknown-media', d => rewriteNative(d, n => n.sessions[0].events.push({ type: 'user/message', seq: 100000, data: { type: 'image', data: 'synthetic' } })), /media_spill/],
    ['known-secret', d => rewriteNative(d, n => { n.sessions[0].events[0].data.access_token = 'SYNTHETIC_CREDENTIAL_CANARY'; }), /secret/],
    ['custom-preset', d => rewriteNative(d, n => { n.sessions[0].meta.agentPreset = 'custom'; }), /header/],
    ['unknown-plugin-event', d => rewriteNative(d, n => { n.sessions[0].events.push({ type: 'custom/plugin-state', seq: 100000, data: {} }); }), /event_unsupported/],
    ['multi-workspace', d => rewriteNative(d, n => { n.workspace.global.workspaceIds.push('other'); }), /workspace/],
  ]) {
    const changed = await mutated(name, mutate);
    await rejected(name, () => api.restoreInstance(path.join(base, name + '-target'), { archive: changed, packageRoot }), pattern);
    assert.equal(await fs.stat(path.join(base, name + '-target')).then(() => true, () => false), false);
  }
  const mismatch = await mutated('wrong-artifact', async d => { const m = await read(path.join(d, 'manifest.json')); m.release.appSha256 = '0'.repeat(64); await write(path.join(d, 'manifest.json'), m); });
  await rejected('wrong-artifact', () => api.restoreInstance(path.join(base, 'wrong-artifact-target'), { archive: mismatch, packageRoot }), /release_mismatch/);
  for (const target of [source, neighbor, path.join(source, 'new-descendant')]) await rejected('occupied-or-related:' + path.basename(target), () => api.restoreInstance(target, { archive, packageRoot }), /target_exists|roots_overlap/);
  const nonempty = path.join(base, 'nonempty'); await fs.mkdir(nonempty); await fs.writeFile(path.join(nonempty, 'sentinel'), 'unchanged');
  await rejected('nonempty', () => api.restoreInstance(nonempty, { archive, packageRoot }), /target_exists/);
  assert.equal(await fs.readFile(path.join(nonempty, 'sentinel'), 'utf8'), 'unchanged');
  const alias = path.join(base, 'alias'); await fs.symlink(neighbor, alias, 'junction');
  await rejected('path-alias', () => api.restoreInstance(path.join(alias, 'new'), { archive, packageRoot }), /path_alias/);
  const badCache = path.join(base, 'bad-cache'); await fs.mkdir(badCache); await fs.writeFile(path.join(badCache, 'node-22.22.2.zip'), 'synthetic bad cache');
  const failed = path.join(base, 'failed-target');
  await rejected('runtime-failure', () => api.restoreInstance(failed, { archive, packageRoot, runtimeCache: badCache }), /runtime_cache_digest/);
  const failedGate = await read(path.join(failed, 'state/instance-recovery.json')); assert.equal(failedGate.phase, 'failed');
  await rejected('failed-ordinary-start', () => life.start(failed), /recovery_start_blocked/);
  await rejected('failed-maintenance-start', () => life.start(failed, { maintenance: true, recoveryId: failedGate.transactionId }), /recovery_start_blocked/);
  await rejected('abort-cannot-clear-target', () => api.abortBackup(failed, failedGate.transactionId), /abort_invalid/);

  // Controlled owner fault fixture; all data and the live-owner sentinel belong
  // to this task. The real installed freeze rejects it before any package copy.
  const clone = path.join(base, 'abort-source'), identity = await foundation.initializeRoot(clone);
  await fs.cp(path.join(source, 'library'), path.join(clone, 'library'), { recursive: true });
  await write(path.join(clone, 'installation.json'), installed);
  const owner = path.join(clone, 'library/jobs/job_aaaaaaaaaaaaaaaa'); await fs.mkdir(owner);
  await write(path.join(owner, 'status.json'), { state: 'running', pid: process.pid });
  await rejected('backup-live-owner', () => api.backupInstance(clone, path.join(base, 'owner-package')), /independent_writer/);
  const markerFile = path.join(clone, 'state/instance-recovery.json'), marker = await read(markerFile);
  await rejected('abort-wrong-transaction', () => api.abortBackup(clone, randomUUID()), /abort_invalid/);
  await write(markerFile, { ...marker, phase: 'preparing' });
  await rejected('abort-wrong-phase', () => api.abortBackup(clone, marker.transactionId), /abort_invalid/);
  await write(markerFile, marker);
  await rejected('abort-live-owner', () => api.abortBackup(clone, marker.transactionId), /independent_writer/);
  assert.deepEqual(await read(markerFile), marker);
  await write(path.join(owner, 'status.json'), { state: 'interrupted', pid: null });
  report.cases.push({ name: 'abort-quiescent', result: await api.abortBackup(clone, marker.transactionId), passed: true });
  // Persisted snapshot at the audit/unlink interruption boundary: an old audit
  // must not bypass a new failed static check while the gate still exists.
  await write(markerFile, marker); await write(path.join(owner, 'status.json'), { state: 'running', pid: process.pid });
  await rejected('abort-audit-before-unlink-live-owner', () => api.abortBackup(clone, marker.transactionId), /independent_writer/);
  await write(path.join(owner, 'status.json'), { state: 'interrupted', pid: null });
  report.cases.push({ name: 'abort-interruption-retry', result: await api.abortBackup(clone, marker.transactionId), passed: true });
  assert.equal((await api.abortBackup(clone, marker.transactionId)).replayed, true);
  report.abortAudit = await read(path.join(clone, 'state/backup-aborted-' + marker.transactionId + '.json'));
  assert.equal(report.abortAudit.quiescence.status, 'completed'); assert.ok(await fs.stat(marker.partial));
  assert.deepEqual(await inventory(source), sourceBefore); assert.deepEqual(await inventory(neighbor), neighborBefore);
  report.isolation = { sourceUnchanged: true, neighborUnchanged: true }; report.result = 'passed';
} catch (error) { report.result = 'failed'; report.error = error.stack; process.exitCode = 1; }
await write('C:/tmp/v006/evidence/failure-matrix-' + candidate + '.json', report);
console.log(JSON.stringify({ result: report.result, error: report.error, cases: report.cases.length, base }));
