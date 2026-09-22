import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { initializeRoot, writeJson, readJson, assertRecoveryStart, recoveryFile } from '../src/modules/foundation/index.mjs';
import { start } from '../src/modules/lifecycle/index.mjs';
import { Handoff } from '../src/modules/workflow/index.mjs';
import { verifyInstancePackage, restoreInstance, activateRelease } from '../src/modules/releases/index.mjs';
import { scanSupported, validateSessions } from '../src/modules/releases/dsh-recovery.mjs';

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'v006-recovery-'));
  const instance = await initializeRoot(root);
  const state = { contract: 'deep-literature-instance-recovery-v1', root: instance.root, instanceId: instance.instanceId,
    transactionId: randomUUID(), phase: 'preparing', allowedParents: {} };
  await writeJson(recoveryFile(instance.root), state);
  await writeJson(path.join(root, 'installation.json'), {});
  return { root: instance.root, instance, state };
}
test('persistent gate rejects ordinary/maintenance and wrong transaction or phase before spawn', async () => {
  const { root, state } = await fixture();
  for (const options of [{}, { maintenance: true }, { maintenance: true, recoveryId: state.transactionId }, { recoveryId: randomUUID() }]) {
    await assert.rejects(start(root, options), /recovery_start_blocked/);
  }
  state.phase = 'validating'; await writeJson(recoveryFile(root), state);
  await assertRecoveryStart(root, state.transactionId);
  await assert.rejects(assertRecoveryStart(root, randomUUID()), /recovery_start_blocked/);
  state.instanceId = randomUUID(); await writeJson(recoveryFile(root), state);
  await assert.rejects(assertRecoveryStart(root, state.transactionId), /state_invalid/);
});
test('handoff open/list preserve prepared uncertain and stop facts without engine calls', async () => {
  const { root, instance } = await fixture();
  const data = { schema: 1, instanceId: instance.instanceId, bindings: {}, children: {}, tasks: { one: {
    taskId: 'one', jobId: 'job_original', cancelRequested: true, stopOperation: { requestId: 'stop-original', status: 'prepared' },
    operations: { old: { status: 'uncertain', coveredStops: [{ taskId: 'one', requestId: 'stop-original', revision: 1 }] } }, dispatches: { old: { status: 'prepared' } }
  } } };
  await writeJson(path.join(root, 'state', 'handoff.json'), data);
  let calls = 0;
  const service = await Handoff.open(root, { instance, engine: () => { calls++; throw Error('must not execute'); } });
  await service.list(); await service.task('one');
  assert.equal(calls, 0);
  assert.deepEqual(await readJson(path.join(root, 'state', 'handoff.json')), data);
  await assert.rejects(service._dispatch(data.tasks.one), /write_blocked/);
});
test('installation activation refuses generic maintenance bypass under persistent recovery', async () => {
  const { root } = await fixture();
  let called = false;
  await assert.rejects(activateRelease(root, {}, { lifecycle: { start: () => { called = true; } } }), /install_blocked/);
  assert.equal(called, false);
});
test('structured secrets and unknown media are rejected without deleting content', () => {
  for (const item of [{ access_token: 'synthetic' }, { nested: { type: 'image' } }, { spill: { path: 'x' } }, 'SYNTHETIC_CREDENTIAL_CANARY']) {
    assert.throws(() => scanSupported(item), /recovery_/);
  }
});
test('DSH rejects multi workspace and dangling parent', () => {
  const snapshot = { contract: 'deep-literature-dsh-rc7-v1', workspacePath: 'old', sessions: [{ meta: { version: 0, id: 's', cwd: 'old', parentSession: 'absent' }, events: [] }],
    workspace: { unit: { version: 2 }, global: { workspaceIds: ['a'] }, tables: { workspaces: { a: { path: 'old', sessionIds: ['s'] } } } } };
  assert.throws(() => validateSessions(snapshot, new Set()), /parent_graph/);
  delete snapshot.sessions[0].meta.parentSession;
  snapshot.workspace.global.workspaceIds.push('b');
  assert.throws(() => validateSessions(snapshot, new Set()), /workspace/);
});
test('package missing domains/hash corruption/path entries refused; occupied target unchanged', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'v006-package-'));
  await assert.rejects(verifyInstancePackage(root), /domains/);
  const source = { instanceId: randomUUID(), root: path.join(root, 'source') };
  const manifest = { contract: 'deep-literature-instance-backup-v1', version: 1, source,
    domains: { library: true, native: true, handoff: true }, files: [] };
  for (const [name, value] of Object.entries({ 'library.zip': 'synthetic', 'native.json': '{"sessions":[]}', 'handoff.json': JSON.stringify({ schema: 1, instanceId: source.instanceId, bindings: {}, children: {}, tasks: {} }) })) {
    await fs.writeFile(path.join(root, name), value);
    manifest.files.push({ path: name, size: Buffer.byteLength(value), sha256: createHash('sha256').update(value).digest('hex') });
  }
  await writeJson(path.join(root, 'manifest.json'), manifest);
  await verifyInstancePackage(root);
  const occupied = await fs.mkdtemp(path.join(os.tmpdir(), 'v006-occupied-'));
  await fs.writeFile(path.join(occupied, 'sentinel'), 'untouched');
  await assert.rejects(restoreInstance(occupied, { archive: root }), /target_exists/);
  assert.equal(await fs.readFile(path.join(occupied, 'sentinel'), 'utf8'), 'untouched');
  manifest.files[0].sha256 = '0'.repeat(64); await writeJson(path.join(root, 'manifest.json'), manifest);
  await assert.rejects(verifyInstancePackage(root), /digest/);
  manifest.files[0].path = '../outside'; await writeJson(path.join(root, 'manifest.json'), manifest);
  await assert.rejects(verifyInstancePackage(root), /path/);
});
