import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = 'C:/tmp/v006/derived-fault-r4';
const read = async f => JSON.parse((await fs.readFile(f, 'utf8')).replace(/^\uFEFF/, ''));
const installed = await read(path.join(root, 'installation.json'));
const api = await import(pathToFileURL(path.join(installed.app, 'src/modules/releases/index.mjs')).href);
const { isolatedEnvironment } = await import(pathToFileURL(path.join(installed.app, 'src/modules/foundation/index.mjs')).href);
const initial = await read(path.join(root, 'state/instance-recovery.json'));
const site = path.join(path.dirname(path.dirname(installed.python)), 'Lib/site-packages');
const hook = path.join(site, 'v006_derived_fault.py'), pth = path.join(site, 'v006_derived_fault.pth');
const report = { root, installed, fixture: 'site trace hook only at real launcher enqueue entry; os._exit(97); removed after crash' };
const env = isolatedEnvironment(root, process.env, installed);
const jobStatus = id => {
  const p = spawnSync(installed.python, ['-I', '-X', 'utf8', '-m', 'scientific_reading', '--data-root', path.join(root, 'library'), 'job-status', '--job-id', id], { env, encoding: 'utf8', windowsHide: true });
  return JSON.parse(p.stdout);
};
async function waitFor(fn) {
  const until = Date.now() + 90000;
  while (Date.now() < until) { const value = await fn(); if (value) return value; await new Promise(r => setTimeout(r, 300)); }
  throw Error('fault_or_worker_timeout');
}
try {
  report.validation = await api.validateRecovery(root, initial.transactionId);
  const gate = await read(path.join(root, 'state/instance-recovery.json'));
  const source = await read('C:/tmp/v006/evidence/source/recovery-source-state.json');
  const fixture = await read(path.join(import.meta.dirname, 'fixtures/v02-006/formula-outline.json'));
  const base = { transactionId: gate.transactionId, confirmManifestSha256: gate.manifestSha256, taskId: source.taskId };
  const first = { ...base, idempotencyKey: 'v006-before-derived-crash', expectedRevision: source.expectedRevision, input: { full_review: fixture.review } };
  report.crash = await read(path.join(root, 'state/v006-derived-crash.json')).catch(() => null);
  if (!report.crash) {
    await fs.copyFile(path.join(import.meta.dirname, 'fixtures/v02-006/derived-crash-hook.py'), hook, fs.constants?.COPYFILE_EXCL ?? 1);
    await fs.writeFile(pth, 'import v006_derived_fault\n', { flag: 'wx' });
    await fs.writeFile(path.join(root, 'state/v006-fault-armed'), 'task-only', { flag: 'wx' });
    report.first = await api.continueRecovery(root, first);
    report.crash = await waitFor(() => read(path.join(root, 'state/v006-derived-crash.json')).catch(() => null));
    await fs.unlink(pth); await fs.unlink(hook);
  } else report.first = (await read(path.join(root, 'state/instance-recovery.json'))).grantHistory[source.parentJobId][report.crash.permit.parentRequestId];
  assert.equal(await fs.stat(path.join(root, 'library/jobs', report.crash.childJobId)).then(() => true, () => false), false);
  const controlFile = path.join(root, 'library/jobs', source.parentJobId, 'control.json');
  await waitFor(async () => {
    const p = spawnSync(installed.python, ['-I', '-X', 'utf8', '-c', 'from scientific_reading.background_store import BackgroundJobStore; import sys; print(BackgroundJobStore._pid_is_alive(int(sys.argv[1])))', String(report.crash.pid)], { env, encoding: 'utf8', windowsHide: true });
    return p.stdout.trim() === 'False';
  });
  const beforeStop = await read(controlFile);
  report.stopped = await api.stopRecovery(root, { ...base, idempotencyKey: 'v006-after-derived-crash', expectedRevision: beforeStop.revision });
  assert.equal(report.stopped.stopRequested, true); assert.equal(report.stopped.acknowledgedRevision, report.stopped.revision);
  const second = { ...base, idempotencyKey: 'v006-resume-derived-after-crash', expectedRevision: report.stopped.revision, input: {} };
  report.second = await api.continueRecovery(root, second);
  report.parent = await waitFor(() => { const s = jobStatus(source.parentJobId); return s.status === 'completed' ? s : null; });
  report.child = await waitFor(() => { const s = jobStatus(report.crash.childJobId); return s.status === 'completed' ? s : null; });
  report.finalPermit = await read(path.join(root, 'library/recovery-derived', report.crash.childJobId + '.json'));
  assert.ok(report.finalPermit.priorRequestIds.includes(report.crash.permit.parentRequestId));
  assert.notEqual(report.finalPermit.parentRequestId, report.crash.permit.parentRequestId);
  const marker = await fs.readFile(path.join(root, 'library/jobs', report.crash.childJobId, 'launch.json'));
  report.replayed = await api.continueRecovery(root, second);
  report.old = await api.continueRecovery(root, first);
  assert.equal(report.old.status, 'replayed_superseded');
  assert.deepEqual(await fs.readFile(path.join(root, 'library/jobs', report.crash.childJobId, 'launch.json')), marker);
  report.result = 'passed';
} catch (error) { report.result = 'failed'; report.error = error.stack; process.exitCode = 1; }
finally { for (const f of [pth, hook]) await fs.unlink(f).catch(e => { if (e.code !== 'ENOENT') throw e; }); }
await fs.writeFile('C:/tmp/v006/evidence/derived-crash-r4.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ result: report.result, error: report.error, child: report.crash?.childJobId }));
