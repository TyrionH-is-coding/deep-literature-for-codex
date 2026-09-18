import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { Handoff } from '../src/modules/workflow/index.mjs';
import { engineAdapter } from '../src/modules/bridge/index.mjs';

const a = 'C:/Users/15694/Documents/ChatGPT/deep-literature-engine-v02-004i';
const b = path.resolve(import.meta.dirname, '..');
const python = path.join(a, '.venv/Scripts/python.exe');
process.env.PYTHONDONTWRITEBYTECODE = '1'; delete process.env.PYTHONPATH;
const run = path.join(b, 'outputs/v02-004j/integration-' + Date.now());
await fs.mkdir(run, { recursive: true });
const report = { run, startedAt: new Date().toISOString(), mode: 'real Handoff -> I adapter -> A JS/Python/worker; synthetic metadata and host RPC', rows: [] };
const execute = (exe, args, cwd = b) => execFileSync(exe, args, { cwd, encoding: 'utf8', windowsHide: true, timeout: 120000 });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const record = (name, value) => { report.rows.push({ name, value }); return value; };
try {
  report.sourceCommit = execute('git', ['rev-parse', 'HEAD']).trim();
  report.engineCommit = execute('git', ['rev-parse', 'HEAD'], a).trim();
  assert.equal(report.engineCommit, 'b4a9ecc00a76b85c244a0167c79b5a3539e97415');
  assert.equal(execute('git', ['status', '--porcelain'], a).trim(), '');
  const prior = JSON.parse(await fs.readFile(path.join(b, 'docs/project/evidence/V02-004I-integration.json')));
  report.sources = {};
  for (const [file, hash] of Object.entries(prior.manifest).filter(([file]) => file.includes('deep-literature-engine-v02-004i'))) {
    assert.equal(sha(await fs.readFile(file)), hash); report.sources[file] = hash;
  }
  report.python = JSON.parse(execute(python, [path.join(b, 'scripts/fixtures/v02-004j/verify-python.py'), a]));
  const root = path.join(run, 'instance');
  await fs.mkdir(path.join(root, 'workspace'), { recursive: true });
  const metadata = JSON.parse(execute(python, [path.join(b, 'scripts/fixtures/v02-004j/metadata.py'), path.join(root, 'library')]));
  const api = await import(pathToFileURL(path.join(a, 'lib/index.js')).href);
  const engine = engineAdapter(api, { dataRoot: metadata.root, enginePython: python, scansciPython: python, legalOnly: true, school: '', outputDir: '' });
  const instance = { instanceId: 'v02-004j-integration' }; await fs.writeFile(path.join(root, '.workbench.json'), JSON.stringify(instance));
  let prompts = 0, hosts = 0;
  const service = await Handoff.open(root, { instance, engine,
    rpc: async (method, payload) => { if (method === 'workspace.create') return { workspace: { workspaceId: 'synthetic-host', path: payload.path } };
      if (method === 'session.prompt') { prompts++; return { accepted: true }; } return {}; },
    cancelTask: async () => { hosts++; return { turn: 'not_active', removedQueued: 0 }; } });
  const request = { folderId: metadata.folder, paperId: metadata.papers[0], idempotencyKey: 'initial', runAgent: false };
  let task = record('Handoff real start', await service.submit(request));
  const parent = task.jobId;
  async function poll(predicate) {
    for (let i = 0; i < 80; i++) { task = await service.task(task.taskId); if (predicate(task)) return task; await new Promise(r => setTimeout(r, 100)); }
    throw Error('worker_gate_timeout');
  }
  await poll(t => t.job?.status === 'waiting_user' && t.control?.worker === null);
  assert.equal(task.job.detail.reason_code, 'pdf_required');
  record('initial authoritative gate', task);
  const originalId = task.taskId;
  const alias = await service.submit({ ...request, idempotencyKey: 'alias-before-stop' });
  assert.equal(alias.jobId, parent);
  await poll(t => t.job?.status === 'waiting_user' && t.control?.worker === null);
  const other = await service.submit({ ...request, paperId: metadata.papers[1], idempotencyKey: 'other-paper' });
  const source = task.control.pipelineState.source_pdf_sha256;
  const generation = task.control.pipelineState.generation;
  task = record('cancel and real A acknowledgement', await service.cancel(task.taskId));
  assert.equal(task.control.status, 'acknowledged'); assert.equal(task.control.revision, 1); assert.equal(hosts, 1);
  record('second alias stop', await service.cancel(alias.taskId));
  assert.equal((await service.cancel(task.taskId)).control.revision, 2);
  service.guardAdvance(other.sessionId, 'sr_continue_full_read', { job_id: other.jobId });
  for (let i = 0; i < 2; i++) {
    const reopened = record('independent reopen ' + i, JSON.parse(execute(process.execPath,
      [path.join(b, 'scripts/fixtures/v02-004j/reopen.mjs'), root, a, task.taskId])));
    assert.equal(reopened.effects, 0); assert.equal(reopened.task.control.status, 'acknowledged'); assert.notEqual(reopened.pid, process.pid);
  }
  const scope = service.scopeFor(task.sessionId);
  for (const kind of ['resume', 'attach']) await assert.rejects(service.operate(task.taskId, 'ordinary-' + kind, kind, { input: {} }), /reading_stop_requested/);
  for (const command of [['full-read-pipeline-resume', '--job-id', parent], ['full-read-pdf-attach-resume', '--job-id', parent,
    '--paper-id', task.paperId, '--pdf', path.join(root, 'absent.pdf')]]) {
    assert.equal(record('A final guard', await engine(command, {}, scope)).stopRequested, true);
  }
  await assert.rejects(service.operate(task.taskId, 'wrong-gate', 'resume', { resumeStopped: true, expectedRevision: 2, input: { bogus: true } }), /pdf_resume_input_invalid/);
  assert.equal((await service.task(task.taskId)).cancelRequested, true);
  const payload = { resumeStopped: true, expectedRevision: 2, input: {} };
  task = record('explicit cross-alias same-parent resume', await service.operate(alias.taskId, 'explicit', 'resume', payload));
  assert.equal(task.control.revision, 3); assert.equal(task.cancelRequested, false);
  task = await poll(t => t.job?.status === 'waiting_user' && t.control?.worker === null);
  assert.equal(task.jobId, parent); assert.equal(task.job.detail.reason_code, 'pdf_required');
  assert.equal(task.control.pipelineState.source_pdf_sha256, source); assert.equal(task.control.pipelineState.generation, generation);
  record('real worker returned to PDF gate; source remains null and generation absent', task);
  const original = await service.task(originalId);
  assert.equal(original.cancelRequested, false); assert.equal(original.status, 'waiting_user');
  service.guardAdvance(original.sessionId, 'sr_continue_full_read', { job_id: parent });
  record('both aliases cleared by covered stop revisions', { original, alias: task });
  task = await service.cancel(task.taskId);
  task = record('old resume replay after newer stop', await service.operate(task.taskId, 'explicit', 'resume', payload));
  assert.equal(task.cancelRequested, true); assert.equal(task.control.revision, 4); assert.equal(prompts, 0);
  const afterStop = record('alias submitted after stop binds existing parent', await service.submit({ ...request, idempotencyKey: 'alias-after-stop' }));
  assert.equal(afterStop.jobId, parent);
  await service.cancel(afterStop.taskId);
  task = record('resume original covers later alias stop', await service.operate(originalId, 'recover-all', 'resume', { resumeStopped: true, expectedRevision: 5, input: {} }));
  assert.equal(task.control.revision, 6);
  await poll(t => t.job?.status === 'waiting_user' && t.control?.worker === null);
  for (let i = 0; i < 2; i++) {
    const reopened = record('independent active alias reopen ' + i, JSON.parse(execute(process.execPath,
      [path.join(b, 'scripts/fixtures/v02-004j/reopen.mjs'), root, a, originalId])));
    assert.equal(reopened.effects, 0); assert.equal(reopened.guard, 'allowed');
    for (const row of reopened.tasks.filter(row => row.jobId === parent)) {
      assert.equal(row.cancelRequested, false); assert.equal(row.status, 'waiting_user'); assert.equal(row.control.revision, 6);
    }
  }
  const otherFinal = record('other paper control untouched', await service.task(other.taskId));
  assert.equal(otherFinal.control.revision, 0); assert.equal(otherFinal.control.stopRequested, false);
  assert.equal(execute('git', ['status', '--porcelain'], a).trim(), '');
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.error = error.stack; process.exitCode = 1; }
finally {
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(run, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, error: report.error, report: path.join(run, 'report.json') }));
}
