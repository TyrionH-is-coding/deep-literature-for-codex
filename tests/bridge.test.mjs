import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { categoryGuard, cancelOwnedDispatch, readJobInput, verifyReader, engineAdapter, dshRpc } from '../src/bridge-services.mjs';

test('原生交接证据识别持久队列被正常停止撤销，并优先使用实际 pending 或 delivered', async () => {
  const { inspectDispatchEvidence } = await import('../src/bridge-services.mjs');
  assert.equal(typeof inspectDispatchEvidence, 'function');
  const message = (id, rpcId) => ({ id, source: { kind: 'user', rpcId } });
  const ours = message('ours', 'rpc'), other = message('other', 'another');
  const agent = { inbox: { nextTurn: [], nextStep: [] }, session: { header: {}, events: [
    { type: 'agent/inbox/spliced', data: { target: 'next-turn', start: 0, inserted: [ours, other] } },
    { type: 'agent/inbox/spliced', data: { target: 'next-turn', start: 0, removedCount: 2, inserted: [], outcome: 'canceled' } },
  ] } };
  assert.equal(inspectDispatchEvidence(agent, 'rpc'), 'canceled');
  assert.equal(inspectDispatchEvidence(agent, 'absent'), 'uncertain');
  agent.inbox.nextStep.push(ours);
  assert.equal(inspectDispatchEvidence(agent, 'rpc'), 'pending');
  agent.inbox.nextStep.pop();
  agent.session.events.push({ type: 'user/message', data: ours });
  assert.equal(inspectDispatchEvidence(agent, 'rpc'), 'delivered');
});

test('领取后尚未追加 user/message 或不完整取消记录仅能判为 uncertain', async () => {
  const { inspectDispatchEvidence } = await import('../src/bridge-services.mjs');
  assert.equal(typeof inspectDispatchEvidence, 'function');
  const ours = { id: 'ours', source: { kind: 'user', rpcId: 'rpc' } };
  const insert = { type: 'agent/inbox/spliced', data: { target: 'next-step', start: 0, inserted: [ours] } };
  const remove = { type: 'agent/inbox/spliced', data: { target: 'next-step', start: 0, removedCount: 1, inserted: [] } };
  const agent = { inbox: { nextTurn: [], nextStep: [] }, session: { header: {}, events: [insert, remove] } };
  assert.equal(inspectDispatchEvidence(agent, 'rpc'), 'uncertain');
  agent.session.events.push(insert, { ...remove, data: { ...remove.data, outcome: 'canceled' } });
  assert.equal(inspectDispatchEvidence(agent, 'rpc'), 'uncertain');
  agent.session.events = [{ ...remove, data: { ...remove.data, outcome: 'canceled' } }];
  assert.equal(inspectDispatchEvidence(agent, 'rpc'), 'uncertain');
});

test('实际会话身份决定工具范围，不能通过参数声明自己是其他分类', () => {
  const service = { scopeFor: id => id === 'bound' ? { scopeFolderId: 'f1' } : null };
  const agent = { session: { id: 'bound' } };
  for (const name of ['bash', 'str_replace_editor', 'sr_attach_pdf', 'sr_download_papers', 'sr_scansci_config', 'sr_setup']) {
    assert.ok(categoryGuard(service, { name, agent, arguments: { scopeFolderId: 'f1' } }));
  }
  assert.equal(categoryGuard(service, { name: 'sr_job_status', agent }), undefined);
  assert.ok(categoryGuard(service, { name: 'sr_job_status', agent: { session: { id: 'unbound' } } }));
});

test('取消只移除本任务排队消息，不取消同分类正在处理的另一篇论文', () => {
  let canceled = 0; const removed = [];
  const agent = { status: 'running', cancel: () => canceled++,
    inbox: { nextStep: [], nextTurn: [{ id: 'pending1', source: { kind: 'user', rpcId: 'ours' } }], remove: id => removed.push(id) },
    session: { events: [{ type: 'turn/start', data: { turn: 1 } }, { type: 'user/message', data: { source: { kind: 'user', rpcId: 'other' } } }] } };
  const task = { dispatches: { a: { rpcId: 'ours' } } };
  assert.equal(cancelOwnedDispatch(agent, task).turn, 'not_targeted');
  assert.deepEqual(removed, ['pending1']); assert.equal(canceled, 0);
  agent.session.events[1].data.source.rpcId = 'ours';
  assert.equal(cancelOwnedDispatch(agent, task).turn, 'cancel_requested'); assert.equal(canceled, 1);
});

test('上一任务结束后不能取消尚未追加消息的新 turn；领取记录必须属于当前 turn', () => {
  let canceled = 0;
  const agent = { status: 'running', cancel: () => canceled++,
    inbox: { nextStep: [], nextTurn: [], remove: () => assert.fail('queue is empty') },
    session: { events: [{ type: 'turn/start', data: { turn: 1 } },
      { type: 'user/message', data: { source: { kind: 'user', rpcId: 'ours' } } },
      { type: 'turn/end', data: { turn: 1 } }, { type: 'turn/start', data: { turn: 2 } }] } };
  const task = { dispatches: { a: { rpcId: 'ours' } } };
  assert.equal(cancelOwnedDispatch(agent, task).turn, 'not_targeted');
  assert.equal(cancelOwnedDispatch(agent, task, { turn: 1, rpcIds: new Set(['ours']) }).turn, 'not_targeted');
  assert.equal(cancelOwnedDispatch(agent, task, { turn: 2, rpcIds: new Set(['other']) }).turn, 'not_targeted');
  assert.equal(canceled, 0);
  assert.equal(cancelOwnedDispatch(agent, task, { turn: 2, rpcIds: new Set(['ours']) }).turn, 'cancel_requested');
  assert.equal(canceled, 1);
});

test('同一 turn 混入其他任务或手动消息时只撤回队列，不中断共享 turn', () => {
  const agent = { status: 'running', cancel: () => assert.fail('another prompt would be interrupted'),
    inbox: { nextStep: [], nextTurn: [], remove: () => {} },
    session: { events: [{ type: 'turn/start', data: { turn: 3 } },
      { type: 'user/message', data: { source: { kind: 'user', rpcId: 'other' } } },
      { type: 'user/message', data: { source: { kind: 'user', rpcId: 'ours' } } }] } };
  const task = { dispatches: { a: { rpcId: 'ours' } } };
  assert.equal(cancelOwnedDispatch(agent, task).turn, 'not_targeted');
  agent.session.events.splice(1);
  assert.equal(cancelOwnedDispatch(agent, task, { turn: 3, rpcIds: new Set(['ours', undefined]) }).turn, 'not_targeted');
});

test('gate 源文仅可分页读取真实本篇材料；任意路径和移出分类被拒绝', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'csr-input-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const paper = path.join(root, 'library', 'papers', 'p1');
  await fs.mkdir(paper, { recursive: true });
  const file = path.join(paper, 'batch.json');
  await fs.writeFile(file, '正文源材料');
  let requested = file, reads = 0, move = false;
  const engine = async () => { if (move && reads++ > 0) throw new Error('scope_changed'); return { paper_id: 'p1', detail: { required_input: { source_manifest_path: requested } } }; };
  const args = { job_id: 'job_1234567890abcdef', field: 'source_manifest_path', offset: 2, limit: 2 };
  assert.deepEqual((await readJobInput(root, engine, {}, args)).text, '源材');
  requested = path.join(root, 'outside.json'); await fs.writeFile(requested, 'private');
  await assert.rejects(readJobInput(root, engine, {}, args), /outside_paper/);
  requested = file; move = true;
  await assert.rejects(readJobInput(root, engine, {}, args), /scope_changed/);
});

test('A 门槛退出码保持真实状态，scope 错误不会伪装为正常任务', async () => {
  let calls = 0;
  const api = { withEngineScope: (scope, run) => { assert.equal(scope.scopeFolderId, 'f'); calls++; return run(); },
    engineJson: async (_config, args) => args[0] === 'job-status'
      ? { ok: false, json: { job_id: 'job_1', status: 'waiting_user' } }
      : { ok: false, json: { status: 'failed', error: 'scope_changed' } } };
  const engine = engineAdapter(api, {});
  assert.equal((await engine(['job-status'], undefined, { scopeFolderId: 'f' })).status, 'waiting_user');
  await assert.rejects(engine(['library-item-v2'], undefined, { scopeFolderId: 'f' }), /scope_changed/);
  assert.equal(calls, 2);
});

test('job-status 失败时返回完整 JSON，并把 detail.error 作为可识别错误', async () => {
  const api = {
    withEngineScope: (_scope, run) => run(),
    engineJson: async () => ({
      ok: false,
      json: { job_id: 'job_1', status: 'failed', paper_id: 'p1', detail: { error: 'full_read_parent_mismatch' } },
    }),
  };
  const job = await engineAdapter(api, {})(['job-status', '--job-id', 'job_1']);
  assert.equal(job.status, 'failed');
  assert.equal(job.detail.error, 'full_read_parent_mismatch');
});

test('完成以真实 Reader HTTP 字节和 SHA 为准，RPC 校验完整回执', async t => {
  const html = '<!doctype html><p>正式 Reader</p>';
  let corrupt = false;
  const server = http.createServer(async (req, res) => {
    if (req.url.startsWith('/api/')) {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const input = JSON.parse(Buffer.concat(chunks));
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ type: 'server-response', rpcId: corrupt ? 'wrong' : input.rpcId, result: { ok: true, value: { accepted: true } } }));
    } else { res.setHeader('Content-Type', 'text/html'); res.end(corrupt ? 'login required' : html); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}`;
  const sha256 = createHash('sha256').update(html).digest('hex');
  const engine = async () => ({ manifest: { reader_sha256: sha256 } });
  assert.equal((await verifyReader(engine, url, 'p', {})).sha256, sha256);
  assert.equal((await dshRpc(url, 'session.prompt', {})).accepted, true);
  corrupt = true;
  await assert.rejects(verifyReader(engine, url, 'p', {}), /reader_http_mismatch/);
  await assert.rejects(dshRpc(url, 'session.prompt', {}), /dsh_rpc_failed/);
});
