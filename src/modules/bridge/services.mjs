import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const CATEGORY_TOOLS = new Set(['sr_ingest', 'sr_abstract_submit', 'sr_library_list', 'sr_start_full_read',
  'sr_continue_full_read', 'sr_export_assets', 'sr_job_status', 'sr_evidence_locate', 'sr_review_context',
  'sr_review_confirm', 'csr_read_job_input']);

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const revision = value => Number.isSafeInteger(value) && value >= 0;
const requestId = value => typeof value === 'string' && !!value.trim() && [...value].length <= 200;
const businessStates = ['queued', 'running', 'waiting_user', 'waiting_agent', 'interrupted', 'failed', 'completed'];
const pipelineStates = ['queued', 'ensure_pdf', 'parse_mineru', 'translate_full', 'render_reader',
  'schedule_derived_updates', 'needs_user', 'waiting_agent', 'failed', 'completed'];

function controlSnapshot(json, jobId, paperId) {
  const invalid = () => { throw new Error('engine_stop_control_invalid'); };
  if (!record(json) || json.contract !== 'reading-control-v1' || !jobId || json.parentJobId !== jobId
    || !revision(json.revision) || typeof json.stopRequested !== 'boolean'
    || !(json.requestId === null || requestId(json.requestId))
    || !(json.acknowledgedRevision === null || revision(json.acknowledgedRevision))
    || !(json.effectiveBoundary === null || typeof json.effectiveBoundary === 'string')
    || json.independentChildrenStopped !== false || !record(json.operations)
    || !record(json.businessStatus) || json.businessStatus.job_id !== jobId
    || !businessStates.includes(json.businessStatus.state)
    || !record(json.pipelineState) || json.pipelineState.contract_version !== 'reading-pipeline-v1'
    || json.pipelineState.parent_job_id !== jobId || !pipelineStates.includes(json.pipelineState.state)
    || typeof json.pipelineState.paper_id !== 'string' || !json.pipelineState.paper_id
    || (paperId && json.pipelineState.paper_id !== paperId)) invalid();
  for (const owner of [json.activeStage, json.worker]) {
    if (owner !== null && (!record(owner) || !Number.isSafeInteger(owner.pid) || owner.pid <= 0
      || !(owner.identity === null || typeof owner.identity === 'string'))) invalid();
  }
  const scope = json.businessStatus.scope;
  if (scope != null && (!record(scope) || ['instanceId', 'scopeSessionId', 'scopeFolderId'].some(key =>
    typeof scope[key] !== 'string' || !scope[key]) || scope.scopePaperId !== json.pipelineState.paper_id
    || !revision(scope.scopePaperRevision))) invalid();
  if (json.acknowledgedRevision !== null && (!json.stopRequested
    || json.acknowledgedRevision !== json.revision || typeof json.effectiveBoundary !== 'string')) invalid();
  const operations = Object.entries(json.operations);
  if (operations.length !== json.revision) invalid();
  const seen = new Set();
  for (const [id, op] of operations) {
    if (!requestId(id) || !record(op) || !['stop', 'resume'].includes(op.kind)
      || !revision(op.expectedRevision) || !revision(op.revision) || op.revision !== op.expectedRevision + 1
      || op.revision > json.revision || seen.has(op.revision)
      || (op.kind === 'resume' && (!record(op.input) || typeof op.dispatched !== 'boolean'))) invalid();
    seen.add(op.revision);
  }
  const latest = Object.hasOwn(json.operations, json.requestId) ? json.operations[json.requestId] : null;
  if (json.revision === 0 ? (json.requestId !== null || json.stopRequested || json.acknowledgedRevision !== null)
    : (!latest || latest.revision !== json.revision || (latest.kind === 'stop') !== json.stopRequested)) invalid();
  const terminal = [json.businessStatus.state, json.pipelineState.state].some(state => ['failed', 'completed'].includes(state));
  const phase = terminal ? 'terminal' : !json.stopRequested ? 'active'
    : json.acknowledgedRevision === json.revision ? 'acknowledged' : 'requested';
  if (json.status !== phase || json.compatibility !== (phase === 'requested' ? 'unconfirmed_worker_or_stage' : 'cooperative_boundary')) invalid();
  const replay = json.replayedOperation;
  if (replay !== null && (!record(replay) || !operations.some(([, op]) =>
    op.kind === replay.kind && op.revision === replay.revision && op.expectedRevision === replay.expectedRevision
    && (op.kind !== 'resume' || (record(replay.input) && typeof replay.dispatched === 'boolean'))))) invalid();
  return json;
}

export function engineAdapter(api, config) {
  return (args, input, scope) => {
    const run = async () => {
      const value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
      const command = args[0];
      const explicit = command === 'full-read-pipeline-resume' && args.includes('--resume-stopped');
      const control = ['full-read-pipeline-stop', 'full-read-pipeline-control'].includes(command) || explicit;
      const optionsPresent = ['--request-id', '--expected-revision', '--resume-stopped'].some(flag => args.includes(flag));
      let options;
      if (command === 'full-read-pipeline-stop' || explicit) {
        const rawRevision = value('--expected-revision');
        options = { requestId: value('--request-id'), expectedRevision: Number(rawRevision) };
        if (!requestId(options.requestId) || typeof rawRevision !== 'string' || !/^\d+$/.test(rawRevision)
          || !revision(options.expectedRevision) || ['--request-id', '--expected-revision', '--resume-stopped']
            .some(flag => args.filter(arg => arg === flag).length > 1)) throw new Error('reading_control_operation_invalid');
      } else if (optionsPresent) throw new Error('resume_stopped_required');
      let result;
      if (command === 'full-read-pipeline-start') result = await api.engineStartFullRead(config, value('--paper-id'));
      else if (explicit) {
        if (typeof api.engineResumeStoppedFullRead !== 'function') throw new Error('engine_stop_control_unavailable');
        result = await api.engineResumeStoppedFullRead(config, value('--job-id'), input, options);
      } else if (command === 'full-read-pipeline-resume') result = await api.engineContinueFullRead(config, value('--job-id'), input);
      else if (command === 'full-read-pdf-attach-resume') result = await api.engineAttachAndResumeFullReadPdf(config, value('--paper-id'), value('--job-id'), value('--pdf'));
      else result = await api.engineJson(config, args, input);
      if (!record(result) || typeof result.ok !== 'boolean'
        || (result.exitCode !== undefined && !revision(result.exitCode))) throw new Error('engine_request_failed');
      const json = result.json;
      const code = json?.error ?? json?.reason_code ?? json?.detail?.reason_code ?? 'engine_request_failed';
      const fail = () => { throw new Error(typeof code === 'string' && /^[a-z0-9_]+$/i.test(code) ? code : 'engine_request_failed'); };
      // A's generic runner also marks exit 2/3 as ok. Error envelopes must win.
      if (json?.error != null) fail();
      if (control || json?.contract === 'reading-control-v1' || json?.parentJobId !== undefined) {
        const snapshot = controlSnapshot(json, value('--job-id'), value('--paper-id') ?? scope?.scopePaperId);
        const blocked = !explicit && ['full-read-pipeline-resume', 'full-read-pdf-attach-resume'].includes(command)
          && snapshot.stopRequested;
        const accepted = result.ok && (result.exitCode === undefined || result.exitCode === 0
          || (blocked && result.exitCode === 2));
        if (!accepted && !(blocked && result.exitCode === 2)) fail();
        return snapshot;
      }
      if (json?.parent_job_id && ((value('--job-id') && json.parent_job_id !== value('--job-id'))
        || (value('--paper-id') && json.paper_id && json.paper_id !== value('--paper-id')))) throw new Error('engine_parent_mismatch');
      if (json && (result.ok || (command === 'job-status' && json.job_id && businessStates.includes(json.status)))) return json;
      fail();
    };
    return scope ? api.withEngineScope(scope, run) : run();
  };
}

export async function dshRpc(url, method, payload, rpcId = randomUUID()) {
  const response = await fetch(`${url}/api/${method}`, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000),
    body: JSON.stringify({ type: 'client-request', rpcId, method, payload }) });
  const reply = await response.json();
  if (!response.ok || reply.type !== 'server-response' || reply.rpcId !== rpcId || reply.result?.ok !== true) {
    const code = reply.result?.error?.code;
    throw new Error(typeof code === 'string' ? `dsh_${code}` : 'dsh_rpc_failed');
  }
  return reply.result.value;
}

export async function verifyReader(engine, url, paperId, scope) {
  const artifact = await engine(['artifact-resolve', '--paper-id', paperId, '--kind', 'reader'], undefined, scope);
  const sha256 = artifact.sha256 ?? artifact.manifest?.reader_sha256;
  if (!/^[a-f0-9]{64}$/.test(sha256 ?? '')) throw new Error('reader_manifest_invalid');
  const readerUrl = `${url}/sr/reader/${encodeURIComponent(paperId)}`;
  const response = await fetch(readerUrl, { signal: AbortSignal.timeout(30000), redirect: 'error' });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!response.ok || !response.headers.get('content-type')?.startsWith('text/html')
    || createHash('sha256').update(bytes).digest('hex') !== sha256) throw new Error('reader_http_mismatch');
  await engine(['library-item-v2', '--paper-id', paperId], undefined, scope);
  return { readerUrl, sha256, sourcePdfSha256: artifact.manifest?.source_pdf_sha256 ?? null };
}

export async function readJobInput(root, engine, scope, args) {
  if (!scope) throw new Error('category_binding_required');
  const fields = ['source_manifest_path', 'translations_json'];
  if (!fields.includes(args.field) || !/^job_[a-f0-9]{16}$/.test(args.job_id ?? '')) throw new Error('invalid_job_input');
  const offset = args.offset ?? 0, limit = args.limit ?? 20000;
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 50000) throw new Error('invalid_page');
  const job = await engine(['job-status', '--job-id', args.job_id], undefined, scope);
  const requested = job.detail?.required_input?.[args.field];
  if (typeof requested !== 'string') throw new Error('job_input_unavailable');
  const papersRoot = await fs.realpath(path.join(root, 'library', 'papers'));
  const paperRoot = await fs.realpath(path.join(papersRoot, job.paper_id));
  const paperRelative = path.relative(papersRoot, paperRoot);
  if (!paperRelative || paperRelative.startsWith('..') || path.isAbsolute(paperRelative)) throw new Error('job_input_outside_paper');
  const file = await fs.realpath(requested);
  const relative = path.relative(paperRoot, file);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || path.extname(file) !== '.json') throw new Error('job_input_outside_paper');
  const text = await fs.readFile(file, 'utf8');
  const current = await engine(['job-status', '--job-id', args.job_id], undefined, scope);
  if (current.detail?.required_input?.[args.field] !== requested) throw new Error('job_gate_changed');
  return { job_id: args.job_id, field: args.field, offset, total: text.length,
    text: text.slice(offset, offset + limit), nextOffset: offset + limit < text.length ? offset + limit : null };
}

export function categoryGuard(service, exec) {
  if (!service.scopeFor(exec.agent?.session?.id)) return '本会话尚未绑定有效文献分类，请由 Codex 总管理员绑定。';
  if (!CATEGORY_TOOLS.has(exec.name)) return '分类管理员仅可使用本分类的文献工具；此操作请交给 Codex 总管理员。';
}

export function inspectDispatchEvidence(agent, rpcId) {
  if (!agent || !rpcId) return 'uncertain';
  const matches = message => message?.source?.kind === 'user' && message.source.rpcId === rpcId;
  if ([...agent.inbox.nextTurn, ...agent.inbox.nextStep].some(matches)) return 'pending';
  const events = agent.session.events.slice(agent.session.header?.seedLength ?? 0);
  if (events.some(event => event.type === 'user/message' && matches(event.data))) return 'delivered';
  const queues = { 'next-turn': [], 'next-step': [] };
  let canceled = false, claimed = false;
  for (const event of events) {
    if (event.type !== 'agent/inbox/spliced') continue;
    const { target, start, removedCount = 0, inserted, outcome } = event.data;
    const removed = queues[target].splice(start, removedCount, ...inserted);
    if (removed.some(matches)) {
      if (outcome === 'canceled') canceled = true;
      else claimed = true;
    }
  }
  // A claimed message may still be awaiting prompt assembly. Its absence from
  // both the inbox and user/message events is not evidence of cancellation.
  return canceled && !claimed ? 'canceled' : 'uncertain';
}

export function cancelOwnedDispatch(agent, task, claimed) {
  if (!agent) return { turn: 'not_active', removedQueued: 0 };
  const ids = new Set(Object.values(task.dispatches).map(row => row.rpcId));
  let removedQueued = 0;
  for (const message of [...agent.inbox.nextTurn, ...agent.inbox.nextStep]) {
    if (message.source?.kind === 'user' && ids.has(message.source.rpcId)) {
      agent.inbox.remove(message.id); removedQueued++;
    }
  }
  // Snapshot and cancellation run synchronously on DSH's event loop; do not
  // interrupt a different paper or a later manual prompt in the same category.
  const events = agent.session.events;
  const boundary = events.findLastIndex(event => event.type === 'turn/start' || event.type === 'turn/end');
  const turn = events[boundary]?.type === 'turn/start' ? events[boundary].data.turn : undefined;
  const activeIds = new Set(events.slice(boundary + 1)
    .filter(event => event.type === 'user/message' && event.data?.source?.kind === 'user')
    .map(event => event.data.source.rpcId));
  // DSH claims the inbox before awaiting prompt assembly and appending messages.
  if (turn !== undefined && claimed?.turn === turn) for (const id of claimed.rpcIds) activeIds.add(id);
  const ours = agent.status === 'running' && turn !== undefined && activeIds.size > 0
    && [...activeIds].every(id => ids.has(id));
  if (ours) agent.cancel({ kind: 'user' }, { keepInbox: true });
  return { turn: ours ? 'cancel_requested' : 'not_targeted', removedQueued };
}
