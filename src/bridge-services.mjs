import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const CATEGORY_TOOLS = new Set(['sr_ingest', 'sr_abstract_submit', 'sr_library_list', 'sr_start_full_read',
  'sr_continue_full_read', 'sr_export_assets', 'sr_job_status', 'sr_evidence_locate', 'sr_review_context',
  'sr_review_confirm', 'csr_read_job_input']);

export function engineAdapter(api, config) {
  return (args, input, scope) => {
    const run = async () => {
    const value = flag => args[args.indexOf(flag) + 1];
    let result;
    if (args[0] === 'full-read-pipeline-start') result = await api.engineStartFullRead(config, value('--paper-id'));
    else if (args[0] === 'full-read-pipeline-resume') result = await api.engineContinueFullRead(config, value('--job-id'), input);
    else if (args[0] === 'full-read-pdf-attach-resume') result = await api.engineAttachAndResumeFullReadPdf(config, value('--paper-id'), value('--job-id'), value('--pdf'));
    else result = await api.engineJson(config, args, input);
    const json = result.json;
    const foreground = ['queued', 'running', 'waiting_user', 'waiting_agent', 'interrupted', 'failed', 'completed'];
    if (json && (result.ok || (args[0] === 'job-status' && json.job_id && foreground.includes(json.status))
      || (args[0].startsWith('full-read-') && json.parent_job_id))) return json;
    const code = json?.error ?? json?.reason_code ?? json?.detail?.reason_code ?? 'engine_request_failed';
    throw new Error(typeof code === 'string' && /^[a-z0-9_]+$/i.test(code) ? code : 'engine_request_failed');
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
