import test from 'node:test';
import assert from 'node:assert/strict';
import { engineAdapter, CATEGORY_TOOLS } from '../src/bridge-services.mjs';

const job = 'job_0123456789abcdef';
const read = ['full-read-pipeline-control', '--job-id', job];
const resume = ['full-read-pipeline-resume', '--job-id', job];
const explicit = [...resume, '--resume-stopped', '--request-id', 'resume', '--expected-revision', '0'];
function snapshot(phase = 'active', state = 'queued') {
  const stopped = ['requested', 'acknowledged'].includes(phase);
  return { contract: 'reading-control-v1', parentJobId: job, revision: stopped ? 1 : 0,
    requestId: stopped ? 'stop' : null, stopRequested: stopped,
    acknowledgedRevision: phase === 'acknowledged' ? 1 : null,
    effectiveBoundary: phase === 'acknowledged' ? 'between_stages' : null,
    activeStage: null, worker: null, status: phase,
    operations: stopped ? { stop: { kind: 'stop', expectedRevision: 0, revision: 1 } } : {},
    businessStatus: { job_id: job, state },
    pipelineState: { contract_version: 'reading-pipeline-v1', parent_job_id: job, paper_id: 'paper', state },
    independentChildrenStopped: false, replayedOperation: null,
    compatibility: phase === 'requested' ? 'unconfirmed_worker_or_stage' : 'cooperative_boundary' };
}
const apiFor = result => ({ engineJson: async () => result, engineContinueFullRead: async () => result,
  engineResumeStoppedFullRead: async () => result, engineAttachAndResumeFullReadPdf: async () => result });

test('control phases and business terminal states are lossless', async () => {
  for (const [phase, state] of [['active', 'queued'], ['requested', 'queued'], ['acknowledged', 'queued'],
    ['terminal', 'failed'], ['terminal', 'completed']]) {
    const json = snapshot(phase, state);
    const engine = engineAdapter(apiFor({ ok: true, exitCode: 0, json }), {});
    assert.strictEqual(await engine(read), json);
  }
});

test('explicit resume preserves zero revision, input and scope; legacy paths remain separate', async () => {
  const calls = [], input = { supplied: 'input' }, scope = { scopePaperId: 'paper' }, config = {};
  const api = apiFor({ ok: true, json: snapshot() });
  api.withEngineScope = (actual, fn) => { assert.strictEqual(actual, scope); return fn(); };
  for (const name of ['engineStartFullRead', 'engineContinueFullRead', 'engineResumeStoppedFullRead', 'engineAttachAndResumeFullReadPdf']) {
    api[name] = async (...args) => { calls.push([name, ...args]); return { ok: true, json: { legacy: true } }; };
  }
  api.engineResumeStoppedFullRead = async (...args) => { calls.push(['explicit', ...args]); return { ok: true, json: snapshot() }; };
  const engine = engineAdapter(api, config);
  await engine(explicit, input, scope);
  assert.deepEqual(calls[0], ['explicit', config, job, input, { requestId: 'resume', expectedRevision: 0 }]);
  await engine(resume, input); await engine(['full-read-pipeline-start', '--paper-id', 'paper']);
  await engine(['full-read-pdf-attach-resume', '--paper-id', 'paper', '--job-id', job, '--pdf', 'file']);
  assert.deepEqual(calls.slice(1).map(row => row[0]), ['engineContinueFullRead', 'engineStartFullRead', 'engineAttachAndResumeFullReadPdf']);
  delete api.engineResumeStoppedFullRead;
  await assert.rejects(engine(explicit, input), /engine_stop_control_unavailable/);
  assert.equal(calls.length, 4);
  assert.ok(!CATEGORY_TOOLS.has('sr_resume_stopped_full_read'));
});

test('invalid control inputs fail before any engine call', async () => {
  const engine = engineAdapter({ engineJson: () => assert.fail('called'), engineResumeStoppedFullRead: () => assert.fail('called') }, {});
  for (const id of ['', ' ', 'x'.repeat(201)]) {
    await assert.rejects(engine([...resume, '--resume-stopped', '--request-id', id, '--expected-revision', '0']), /operation_invalid/);
  }
  for (const rev of ['', '-1', '1.5', 'NaN', '9007199254740992', 'Infinity']) {
    await assert.rejects(engine([...resume, '--resume-stopped', '--request-id', 'r', '--expected-revision', rev]), /operation_invalid/);
  }
  await assert.rejects(engine([...resume, '--request-id', 'r']), /resume_stopped_required/);
  await assert.rejects(engine(['full-read-pipeline-stop', '--job-id', job]), /operation_invalid/);
});

test('only stopped resume/attach accept exit 2 gates, never arbitrary failed envelopes', async () => {
  for (const command of [resume, ['full-read-pdf-attach-resume', '--job-id', job, '--paper-id', 'paper']]) {
    const json = snapshot('acknowledged');
    assert.strictEqual(await engineAdapter(apiFor({ ok: false, exitCode: 2, json }), {})(command), json);
    await assert.rejects(engineAdapter(apiFor({ ok: false, exitCode: 4, json }), {})(command), /engine_request_failed/);
    await assert.rejects(engineAdapter(apiFor({ ok: false, json }), {})(command), /engine_request_failed/);
  }
  await assert.rejects(engineAdapter(apiFor({ ok: false, json: { parent_job_id: job } }), {})(resume), /engine_request_failed/);
  await assert.rejects(engineAdapter(apiFor({ ok: true, exitCode: 2, json: snapshot() }), {})(read), /engine_request_failed/);
});

test('forged control snapshots and identity mismatches fail closed', async () => {
  const mutations = [j => j.parentJobId = 'other', j => j.businessStatus.job_id = 'other',
    j => j.pipelineState.parent_job_id = 'other', j => j.pipelineState.paper_id = 'other',
    j => j.businessStatus.scope = { scopePaperId: 'other' }, j => j.contract = 'future',
    j => j.revision = -1, j => j.stopRequested = 'true', j => j.status = 'canceled',
    j => j.businessStatus.state = 'canceled', j => j.acknowledgedRevision = 5,
    j => j.independentChildrenStopped = true, j => j.activeStage = { pid: '1' },
    j => j.operations = { wrong: {} }, j => j.requestId = 'missing', j => delete j.pipelineState,
    j => j.replayedOperation = { kind: 'resume', revision: 99 }, j => j.compatibility = 'stopped'];
  for (const mutate of mutations) {
    const json = snapshot('acknowledged'); mutate(json);
    const api = apiFor({ ok: true, json }); api.withEngineScope = (_, fn) => fn();
    await assert.rejects(engineAdapter(api, {})(read, undefined, { scopePaperId: 'paper' }), /engine_stop_control_invalid/);
  }
});

test('safe errors remain distinct and error envelopes cannot impersonate gates', async () => {
  for (const code of ['reading_control_revision_conflict', 'reading_control_request_conflict',
    'reading_control_dispatch_uncertain', 'scope_changed', 'scope_paper_forbidden']) {
    for (const ok of [true, false]) {
      const json = { ...snapshot(), error: code };
      await assert.rejects(engineAdapter(apiFor({ ok, exitCode: 2, json }), {})(read), new RegExp(`^Error: ${code}$`));
    }
  }
  for (const result of [null, { ok: 'true' }, { ok: true, exitCode: '0', json: snapshot() },
    { ok: false, json: { error: 'secret /path token' } }]) {
    await assert.rejects(engineAdapter(apiFor(result), {})(read), /engine_request_failed/);
  }
});
