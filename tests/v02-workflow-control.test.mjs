import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Handoff } from '../src/modules/workflow/index.mjs';

// Fault injection at external boundaries. Real A/DSH are exercised separately.
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'v02-004j-unit-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'workspace'));
  const state = { revision: 0, operations: {}, stopped: false, status: 'waiting_agent',
    calls: [], prompts: 0, hosts: 0, starts: 0, ack: true };
  const snapshot = () => ({ contract: 'reading-control-v1', parentJobId: 'job_1234567890abcdef',
    revision: state.revision, stopRequested: state.stopped, operations: structuredClone(state.operations),
    status: ['completed', 'failed'].includes(state.status) ? 'terminal' : state.stopped ? state.ack ? 'acknowledged' : 'requested' : 'active',
    pipelineState: { paper_id: 'p' }, independentChildrenStopped: false });
  const deps = { instance: { instanceId: 'j' },
    engine: async (args, input) => {
      const flag = name => args[args.indexOf(name) + 1];
      state.calls.push({ args, input: structuredClone(input) });
      switch (args[0]) {
        case 'folder-list': return [{ folder_id: 'f', name: 'Synthetic' }];
        case 'library-item-v2': return { paper_id: flag('--paper-id'), folder_id: 'f' };
        case 'full-read-pipeline-start': state.starts++; return { parent_job_id: 'job_1234567890abcdef' };
        case 'job-status': return { paper_id: 'p', job_id: 'job_1234567890abcdef', status: state.status, detail: { reason_code: 'gate' } };
        case 'full-read-pipeline-control': if (state.noControl) throw Error('engine_stop_control_unavailable'); return snapshot();
        case 'full-read-pipeline-stop':
        case 'full-read-pipeline-resume': {
          const stop = args[0].endsWith('-stop');
          if (!stop && !args.includes('--resume-stopped')) return snapshot();
          if (state.failBefore) throw Error('transport_lost');
          const id = flag('--request-id'), expectedRevision = Number(flag('--expected-revision'));
          const existing = state.operations[id];
          if (!existing) {
            if (expectedRevision !== state.revision) throw Error('reading_control_revision_conflict');
            if (!stop && (!state.stopped || !state.ack)) throw Error('reading_control_stop_unconfirmed');
            state.operations[id] = { kind: stop ? 'stop' : 'resume', expectedRevision, revision: ++state.revision,
              ...(!stop ? { input: structuredClone(input), dispatched: !state.uncertain } : {}) };
            state.stopped = stop;
          }
          if (state.loseReply) throw Error('receipt_lost');
          return snapshot();
        }
        default: throw Error('unexpected_command');
      }
    },
    rpc: async (method, payload) => {
      if (method === 'workspace.create') return { workspace: { workspaceId: 'w', path: payload.path } };
      if (method === 'session.prompt') { state.prompts++; return { accepted: true }; }
      return {};
    }, dispatchEvidence: async () => 'pending', reader: async () => ({ sha256: 'reader-fact' }),
    cancelTask: async () => { state.hosts++; if (state.failHost) throw Error('host_failed'); return { turn: 'not_targeted', removedQueued: 1 }; } };
  const service = await Handoff.open(root, deps);
  const request = { folderId: 'f', paperId: 'p', idempotencyKey: 'submit', runAgent: false };
  const task = await service.submit(request);
  return { root, state, service, task, deps, request };
}
const explicit = expectedRevision => ({ resumeStopped: true, expectedRevision, input: { supplied: 'original' } });

test('durable stop, reopen reconciliation, ordinary paths and same-paper new keys cannot bypass it', async t => {
  const { root, state, service, task, deps, request } = await fixture(t);
  const result = await service.cancel(task.taskId);
  assert.equal(result.stopOperation.status, 'acknowledged');
  assert.equal(result.control.independentChildrenStopped, false);
  const reopened = await Handoff.open(root, deps);
  await reopened.submit({ ...request, runAgent: true });
  await reopened.submit({ ...request, idempotencyKey: 'new-key', runAgent: true });
  await reopened.dispatch(task.taskId, 'retry');
  for (const kind of ['resume', 'attach']) await assert.rejects(reopened.operate(task.taskId, kind, kind, { input: {} }), /reading_stop_requested/);
  assert.equal(state.prompts, 0); assert.equal(state.starts, 1);
  await service.cancel(task.taskId);
  assert.equal(state.revision, 1);
});

test('engine and host failures are independent, legacy marker is never an acknowledgement', async t => {
  const { state, service, task, root, deps } = await fixture(t);
  state.noControl = true;
  let result = await service.cancel(task.taskId);
  assert.equal(state.hosts, 1); assert.equal(result.stopOperation.status, 'unknown');
  assert.equal(result.hostCancellation.status, 'received');
  const saved = Object.values(service.data.tasks)[0]; delete saved.stopOperation; delete saved.control;
  await service.save();
  const old = await Handoff.open(root, deps);
  assert.equal((await old.task(task.taskId)).stopOperation.status, 'unknown');
  state.noControl = false; state.failHost = true;
  await assert.rejects(old.cancel(task.taskId), /host_failed/);
  result = await old.task(task.taskId);
  assert.equal(result.control.status, 'acknowledged'); assert.equal(result.hostCancellation.status, 'unknown');
});

test('initial persistence failure prohibits both external effects; request-save failure still attempts host', async t => {
  const { service, state, task } = await fixture(t);
  const save = service.save.bind(service); let calls = 0;
  service.save = async () => { if (++calls === 1) throw Error('disk_failed'); return save(); };
  await assert.rejects(service.cancel(task.taskId), /disk_failed/);
  assert.equal(state.hosts, 0); assert.equal(state.revision, 0);
  calls = 0; service.save = async () => { if (++calls === 3) throw Error('request_save_failed'); return save(); };
  await assert.rejects(service.cancel(task.taskId), /request_save_failed/);
  assert.equal(state.hosts, 1); assert.equal(state.revision, 0);
});

test('stop receipt loss reuses original operation and read evidence; requested remains unconfirmed', async t => {
  const { service, state, task } = await fixture(t);
  state.loseReply = true; state.ack = false;
  const result = await service.cancel(task.taskId);
  assert.equal(result.stopOperation.status, 'requested');
  const requestId = result.stopOperation.requestId;
  await service.cancel(task.taskId);
  assert.equal((await service.task(task.taskId)).stopOperation.requestId, requestId);
  assert.equal(state.revision, 1);
  await assert.rejects(service.operate(task.taskId, 'resume', 'resume', explicit(1)), /stop_unconfirmed/);
  assert.equal((await service.task(task.taskId)).cancelRequested, true);
});

test('resume receipt loss retries exact original ID/input/revision and old key never clears later stop', async t => {
  const { service, state, task, root, deps } = await fixture(t);
  await service.cancel(task.taskId); state.failBefore = true;
  await assert.rejects(service.operate(task.taskId, 'resume', 'resume', explicit(1)), /transport_lost/);
  const first = state.calls.findLast(x => x.args.includes('--resume-stopped'));
  state.failBefore = false; state.loseReply = true;
  const reopened = await Handoff.open(root, deps);
  await assert.rejects(reopened.operate(task.taskId, 'resume', 'resume', explicit(1)), /receipt_lost/);
  const second = state.calls.findLast(x => x.args.includes('--resume-stopped'));
  assert.deepEqual(second, first);
  state.loseReply = false;
  const done = await reopened.operate(task.taskId, 'resume', 'resume', explicit(1));
  assert.equal(done.cancelRequested, false); assert.equal(state.revision, 2);
  await assert.rejects(reopened.operate(task.taskId, 'resume', 'resume', explicit(3)), /idempotency_conflict/);
  await reopened.cancel(task.taskId);
  const replay = await reopened.operate(task.taskId, 'resume', 'resume', explicit(1));
  assert.equal(replay.cancelRequested, true); assert.equal(replay.control.revision, 3);
});

test('revision conflict and uncertain scheduling preserve intent; fresh successful proof alone clears it', async t => {
  const { service, state, task } = await fixture(t);
  await service.cancel(task.taskId);
  await assert.rejects(service.operate(task.taskId, 'stale', 'resume', explicit(0)), /revision_conflict/);
  state.uncertain = true;
  await assert.rejects(service.operate(task.taskId, 'uncertain', 'resume', explicit(1)), /reconciliation_required/);
  assert.equal((await service.task(task.taskId)).cancelRequested, true);
  assert.equal(state.revision, 2);
  const op = Object.values(state.operations).find(x => x.kind === 'resume'); op.dispatched = true;
  assert.equal((await service.task(task.taskId)).cancelRequested, false);
});

test('a new local cancel before A receipt cannot be cleared by a historical resume', async t => {
  const { service, state, task } = await fixture(t);
  await service.cancel(task.taskId);
  await service.operate(task.taskId, 'old', 'resume', explicit(1));
  state.noControl = true;
  await service.cancel(task.taskId);
  state.noControl = false; state.failBefore = true;
  const replay = await service.operate(task.taskId, 'old', 'resume', explicit(1));
  assert.equal(replay.cancelRequested, true); assert.equal(state.revision, 2);
});

test('category guard uses actual session and target identity; other papers and reads remain available', async t => {
  const { service, state, task } = await fixture(t);
  state.noControl = true; await service.cancel(task.taskId);
  service.observeSession('child', task.sessionId);
  assert.throws(() => service.guardAdvance('child', 'sr_continue_full_read', { job_id: task.jobId, sessionId: 'forged' }), /reading_stop_requested/);
  assert.throws(() => service.guardAdvance(task.sessionId, 'sr_start_full_read', { paper_id: task.paperId }), /reading_stop_requested/);
  assert.throws(() => service.guardAdvance('unknown', 'sr_continue_full_read', { job_id: task.jobId }), /binding_required/);
  service.guardAdvance('child', 'sr_continue_full_read', { job_id: 'other' });
  service.guardAdvance('child', 'sr_start_full_read', { paper_id: 'other' });
  service.guardAdvance('child', 'sr_job_status', { job_id: task.jobId });
});

test('cancel after a lost resume receipt creates a new stop generation before reconciliation', async t => {
  const { service, state, task } = await fixture(t);
  await service.cancel(task.taskId); state.loseReply = true;
  await assert.rejects(service.operate(task.taskId, 'lost', 'resume', explicit(1)), /receipt_lost/);
  state.loseReply = false;
  const stopped = await service.cancel(task.taskId);
  assert.equal(stopped.control.revision, 3); assert.equal(stopped.cancelRequested, true);
  const replay = await service.operate(task.taskId, 'lost', 'resume', explicit(1)).catch(() => service.task(task.taskId));
  assert.equal(replay.cancelRequested, true); assert.equal(state.revision, 3);
});

test('terminal job and Reader facts survive stop requests', async t => {
  const { service, state, task } = await fixture(t);
  for (const status of ['completed', 'failed']) {
    state.status = status;
    const result = await service.cancel(task.taskId);
    assert.equal(result.status, status); assert.equal(result.job.status, status);
    assert.equal(result.control.status, 'terminal'); assert.equal(result.cancelRequested, true);
    if (status === 'completed') assert.equal(result.artifacts.sha256, 'reader-fact');
  }
});

test('resume journal failure prevents side effects; lost final persistence reconciles on reopen', async t => {
  const { service, state, task, root, deps } = await fixture(t);
  await service.cancel(task.taskId);
  const save = service.save.bind(service);
  service.save = async () => {
    if (Object.values(service.data.tasks)[0].operations && Object.values(Object.values(service.data.tasks)[0].operations)
      .some(op => op.resumeStopped)) throw Error('resume_save_failed');
    return save();
  };
  await assert.rejects(service.operate(task.taskId, 'resume', 'resume', explicit(1)), /resume_save_failed/);
  assert.equal(state.revision, 1);
  service.save = async () => { if (state.revision === 2) throw Error('final_save_failed'); return save(); };
  await assert.rejects(service.operate(task.taskId, 'resume', 'resume', explicit(1)), /final_save_failed/);
  assert.equal(state.revision, 2);
  const reopened = await Handoff.open(root, deps);
  assert.equal((await reopened.task(task.taskId)).cancelRequested, false);
  assert.equal(state.revision, 2);
});

test('a stop gate returned by ordinary resume is never recorded as completed', async t => {
  const { service, state, task } = await fixture(t);
  const engine = service.engine;
  service.engine = async (args, ...rest) => {
    if (args[0] === 'full-read-pipeline-resume') return { stopRequested: true };
    return engine(args, ...rest);
  };
  await assert.rejects(service.operate(task.taskId, 'ordinary', 'resume', { input: {} }), /reading_stop_requested/);
  assert.equal(Object.values(Object.values(service.data.tasks)[0].operations)[0].status, 'prepared');
  assert.equal(state.revision, 0);
});

test('host receipt persistence loss leaves requested on disk, never a recycled success', async t => {
  const { service, state, task, root, deps } = await fixture(t);
  await service.cancel(task.taskId);
  const save = service.save.bind(service);
  service.save = async () => { if (state.hosts === 2) throw Error('host_receipt_save_failed'); return save(); };
  await assert.rejects(service.cancel(task.taskId), /host_receipt_save_failed/);
  const persisted = Object.values(JSON.parse(await fs.readFile(service.file)).tasks)[0];
  assert.equal(persisted.hostCancellation.status, 'requested');
  assert.deepEqual(persisted.hostCancellation.previousResult, persisted.cancellation);
  const reopened = await Handoff.open(root, deps);
  assert.equal((await reopened.task(task.taskId)).cancelRequested, true);
  await reopened.cancel(task.taskId); assert.equal(state.hosts, 3);
});
