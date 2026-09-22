import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const read = async f => JSON.parse((await fs.readFile(f, 'utf8')).replace(/^\uFEFF/, ''));
const root = process.argv[2], installed = await read(path.join(root, 'installation.json'));
const development = process.argv[3] === 'development';
const api = await import(pathToFileURL(development ? path.join(import.meta.dirname, '../src/modules/releases/index.mjs') : path.join(installed.app, 'src/modules/releases/index.mjs')).href);
const { isolatedEnvironment } = await import(pathToFileURL(path.join(installed.app, 'src/modules/foundation/index.mjs')).href);
const gate = await read(path.join(root, 'state/instance-recovery.json'));
const source = await read('C:/tmp/v006/evidence/source/multigate-source.json');
const fixture = await read(path.join(import.meta.dirname, 'fixtures/v02-006/figures-captions.json'));
const env = isolatedEnvironment(root, process.env, installed);
const engine = (...args) => {
  const result = spawnSync(installed.python, ['-I', '-X', 'utf8', '-m', 'scientific_reading', '--data-root', path.join(root, 'library'), ...args], { cwd: root, env, encoding: 'utf8', windowsHide: true });
  const value = JSON.parse(result.stdout); if (value.error) throw Error(JSON.stringify(value)); return value;
};
const report = { root, sourceParent: source.jobId, development, rows: [] };
const row = (name, result) => { report.rows.push({ name, result }); return result; };
const controlFile = path.join(root, 'library/jobs', source.jobId, 'control.json');
const wait = async jobId => {
  const end = Date.now() + 90000;
  while (Date.now() < end) {
    const job = engine('job-status', '--job-id', jobId);
    if (!['queued', 'running'].includes(job.status)) {
      const control = await read(path.join(root, 'library/jobs', jobId, 'control.json')).catch(() => null);
      if (!control?.worker && !control?.activeStage) return job;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw Error('worker_timeout');
};
try {
  const before = await fs.readdir(path.join(root, 'library/jobs'));
  const job = engine('job-status', '--job-id', source.jobId);
  const pipeline = await read(path.join(root, 'library/jobs', source.jobId, 'reading_pipeline.json'));
  const material = await read(job.detail.required_input.source_manifest_path ?? pipeline.required_action.source_manifest_path);
  const translations = new Map(fixture.translations.map(t => [t.block_id, t]));
  const base = { transactionId: gate.transactionId, confirmManifestSha256: gate.manifestSha256, taskId: source.taskId };
  let firstRevision = source.expectedRevision;
  if (development) {
    const current = await read(controlFile);
    const stopped = await api.stopRecovery(root, { ...base, idempotencyKey: 'v006-development-retry', expectedRevision: current.revision });
    firstRevision = stopped.revision;
  }
  const first = { ...base, idempotencyKey: 'v006-recovered-translation' + (development ? '-development' : ''), expectedRevision: firstRevision, input: { full_translation: {
    contract_version: 'full-translation-v3', batch_id: material.batch_id, source_sha256: material.source_sha256,
    translations: material.blocks.map(b => ({ block_id: b.block_id, source_text: b.english, translation_zh: translations.get(b.block_id).translation_zh, highlight: translations.get(b.block_id).highlight })) } } };
  row('first trusted confirmation', await api.continueRecovery(root, first));
  const review = row('real worker second required input', await wait(source.jobId));
  assert.equal(review.job_id, source.jobId); assert.equal(review.detail.reason_code, 'review_full_read');
  const c1 = await read(controlFile);
  const stop = { ...base, idempotencyKey: 'v006-second-stop', expectedRevision: c1.revision };
  const stopped = row('new explicit stop generation', await api.stopRecovery(root, stop));
  assert.equal(stopped.stopRequested, true); assert.equal(stopped.revision, stopped.acknowledgedRevision);
  row('repeated stop', await api.stopRecovery(root, stop));
  row('old request before new grant', await api.continueRecovery(root, first));
  assert.equal((await read(controlFile)).stopRequested, true);
  const second = { ...base, idempotencyKey: 'v006-recovered-review', expectedRevision: stopped.revision, input: { full_review: fixture.review } };
  row('second trusted confirmation', await api.continueRecovery(root, second));
  row('same key repeated', await api.continueRecovery(root, second));
  const completed = row('real worker completed', await wait(source.jobId));
  assert.equal(completed.status, 'completed');
  const marker = await fs.readFile(path.join(root, 'library/jobs', source.jobId, 'launch.json'));
  // Models a client retrying the same request after not receiving its response.
  // Durable receipts are retained; this is not a missing-persistent-receipt test.
  row('client response retry simulation (durable receipts retained)', await api.continueRecovery(root, second));
  assert.deepEqual(await fs.readFile(path.join(root, 'library/jobs', source.jobId, 'launch.json')), marker);
  const controlBeforeOld = await fs.readFile(controlFile);
  row('superseded old request', await api.continueRecovery(root, first));
  assert.deepEqual(await fs.readFile(controlFile), controlBeforeOld);
  await assert.rejects(api.continueRecovery(root, { ...second, input: {} }), /confirmation_conflict/);
  const after = await fs.readdir(path.join(root, 'library/jobs'));
  const newJobs = after.filter(id => !before.includes(id)); assert.equal(newJobs.length, 1);
  const derived = row('necessary derived real worker', await wait(newJobs[0]));
  assert.equal(derived.status, 'completed');
  assert.equal((await read(path.join(root, 'library/jobs', newJobs[0], 'request.json'))).target_stage, 'xlsx_snapshot');
  report.derivedPermit = await read(path.join(root, 'library/recovery-derived', newJobs[0] + '.json'));
  assert.equal(report.derivedPermit.parentJobId, source.jobId);
  report.reader = engine('artifact-resolve', '--paper-id', source.paperId, '--kind', 'reader');
  report.finalControl = await read(controlFile); report.newJobs = newJobs;
  const parked = await read('C:/tmp/v006/evidence/source/recovery-source-state.json');
  assert.equal((await read(path.join(root, 'library/jobs', parked.parentJobId, 'control.json'))).stopRequested, true);
  report.result = 'passed';
} catch (error) { report.result = 'failed'; report.error = error.stack; process.exitCode = 1; }
await fs.writeFile('C:/tmp/v006/evidence/continue-' + path.basename(root) + '.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ result: report.result, error: report.error, newJobs: report.newJobs }));
