import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readJson } from './core.mjs';
import { Handoff } from './handoff.mjs';
import { engineAdapter, dshRpc, verifyReader, readJobInput, categoryGuard, cancelOwnedDispatch, inspectDispatchEvidence, CATEGORY_TOOLS } from './bridge-services.mjs';

export const name = 'codex-scientific-reading-bridge';
export const inject = ['tools', 'webServer', 'systemPrompt', 'agents'];

export async function apply(ctx, config) {
  const { root, engineConfig } = config;
  const instance = await readJson(path.join(root, '.workbench.json'));
  const installed = await readJson(path.join(root, 'installation.json'));
  const require = createRequire(installed.dsh);
  const api = await import(pathToFileURL(require.resolve('@dsh-external/dsh-scientific-reading')).href);
  const engine = engineAdapter(api, engineConfig);
  const url = () => `http://127.0.0.1:${ctx.webServer.port}`;
  const claims = new WeakMap();
  ctx.on('agent/inbox/claimed', ({ agent, message, turn }) => {
    let claimed = claims.get(agent);
    if (claimed?.turn !== turn) claims.set(agent, claimed = { turn, rpcIds: new Set() });
    if (message.source?.kind === 'user') claimed.rpcIds.add(message.source.rpcId);
  });
  const service = await Handoff.open(root, { instance, engine,
    rpc: (method, payload, id) => dshRpc(url(), method, payload, id),
    dispatchEvidence: async (sessionId, rpcId) => inspectDispatchEvidence(await sessionAgent(sessionId), rpcId),
    cancelTask: async task => {
      const agent = await sessionAgent(task.sessionId);
      return cancelOwnedDispatch(agent, task, claims.get(agent));
    },
    reader: (paper, scope) => verifyReader(engine, url(), paper, scope) });
  await service.prepareHost().catch(() => {});
  async function sessionAgent(sessionId) {
    // Native session.create restores a persisted inbox without sending a prompt.
    if (!ctx.agents.get(sessionId)) {
      const workspace = service.data.workspace ?? await service.prepareHost();
      await dshRpc(url(), 'session.create', {
        sessionId, workspaceId: workspace.workspaceId, agentPreset: 'scientific-reading' });
    }
    const agent = ctx.agents.get(sessionId);
    if (!agent) throw new Error('native_session_unavailable');
    return agent;
  }
  ctx.tools.guard(exec => categoryGuard(service, exec));
  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembly = await next();
    const bound = service.scopeFor(context.scope?.session?.id);
    return { ...assembly, tools: bound ? assembly.tools.filter(tool => CATEGORY_TOOLS.has(tool.name)) : [] };
  });
  ctx.on('tools/execute', async (exec, next) => {
    const scope = service.scopeFor(exec.agent?.session?.id);
    if (!scope || !CATEGORY_TOOLS.has(exec.name)) throw new Error('scope_command_forbidden');
    // A's download status has a TS fast path; require the scoped Python fact first.
    if (exec.name === 'sr_job_status') {
      await engine(['job-status', '--job-id', exec.arguments.job_id], undefined, scope);
    }
    return api.withEngineScope(scope, next);
  });
  ctx.on('agent/created', ({ agent }) => {
    service.observeSession(agent.session.id, agent.session.header.parentSession);
    service.serial(() => service.save()).catch(() => {});
  });
  ctx.systemPrompt.section({ name: 'codex-reading-boundary', order: 190, text:
    '你是当前文献分类的管理员。范围由宿主固定，工具无法越权。用 csr_read_job_input 按 job_id 分页读取当前 gate 的 source_manifest_path 或 translations_json，再用 sr_continue_full_read 提交原合同的 JSON；不要使用文件编辑器、shell 或浏览器。提交回执仅表示已交给后台，需用 sr_job_status 等待 queued/running 结束。翻译和复核 revision_required 是可自行修正的 agent gate，按 validation_error 修正后继续；不要把它当作用户确认。遇到 PDF、密钥、用户阅读确认时保留任务并报告等待。其他分类、全局设置、移动归档和浏览器下载交给 Codex 总管理员。' });
  ctx.tools.register({ name: 'csr_read_job_input', description: '分页读取当前分类真实任务 gate 的翻译源或复核材料，不接受任意文件路径。',
    parameters: { type: 'object', properties: { job_id: { type: 'string' }, field: { type: 'string', enum: ['source_manifest_path', 'translations_json'] }, offset: { type: 'integer', minimum: 0 }, limit: { type: 'integer', minimum: 1, maximum: 50000 } }, required: ['job_id', 'field'], additionalProperties: false },
    output: { schema: { type: 'object', properties: { job_id: { type: 'string' }, field: { type: 'string' }, offset: { type: 'integer' }, total: { type: 'integer' }, text: { type: 'string' }, nextOffset: { oneOf: [{ type: 'integer' }, { type: 'null' }] } }, required: ['job_id', 'field', 'offset', 'total', 'text', 'nextOffset'], additionalProperties: false },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    execute: (args, exec) => readJobInput(root, engine, service.scopeFor(exec.agent?.session?.id), args) });

  const required = value => {
    if (typeof value !== 'string' || !value.trim() || value.length > 1000) throw new Error('required_value');
    return value;
  };
  async function action(action, p = {}) {
    switch (action) {
      case 'bind': return service.bind(p.folderId);
      case 'submit': return service.submit(p);
      case 'task': return service.task(p.taskId);
      case 'tasks': return service.list();
      case 'dispatch': return service.dispatch(p.taskId, p.retryKey);
      case 'resume': return service.operate(p.taskId, p.idempotencyKey, 'resume', p);
      case 'attach': return service.operate(p.taskId, p.idempotencyKey, 'attach', p);
      case 'cancel': return service.cancel(p.taskId);
      case 'folder_archive':
        if (typeof p.archived !== 'boolean') throw new Error('archived_boolean_required');
        return service.archive(p.folderId, p.archived);
      case 'folders': return engine(['folder-list']);
      case 'folder_create': return engine(['folder-create', '--name', required(p.name)]);
      case 'folder_rename': {
        const result = await engine(['folder-rename', '--folder-id', required(p.folderId), '--name', required(p.name)]);
        await service.bind(p.folderId);
        return result;
      }
      case 'ingest': {
        const result = await engine(['library-ingest'], p.metadata);
        // The same detached metadata/abstract/XLSX pipeline used by A's tool.
        let derived;
        try { derived = await engine(['derived-enqueue', '--paper-id', result.paper_id]); }
        catch { derived = { status: 'pending', reason: 'enqueue_failed' }; }
        return { ...result, derived };
      }
      case 'item': return engine(['library-item-v2', '--paper-id', required(p.paperId)]);
      case 'list': return engine(['library-list-v2', '--page', String(p.page ?? 1), '--page-size', String(p.pageSize ?? 50),
        ...(p.folderId ? ['--folder-id', required(p.folderId)] : []), ...(p.query ? ['--query', required(p.query)] : [])]);
      case 'move': {
        const folders = await engine(['folder-list']);
        const folder = folders.find(row => row.folder_id === p.folderId);
        if (!folder) throw new Error('folder_not_found');
        return engine(['classification-apply', '--input', '-'], { proposals: [{ paper_id: required(p.paperId), folder_name: folder.name, confidence: 1, tags: p.tags ?? [] }] });
      }
      case 'reader': return verifyReader(engine, url(), required(p.paperId));
      default: throw new Error('unknown_action');
    }
  }
  ctx.webServer.register({ kind: 'exact', path: '/__workbench/api', async handler(request, response) {
    const send = (code, data) => { response.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(data)); };
    if (request.method !== 'POST') return send(405, { ok: false, error: 'post_required' });
    if (request.headers.host !== new URL(url()).host || (request.headers.origin && request.headers.origin !== url())
      || !request.headers['content-type']?.startsWith('application/json')) return send(403, { ok: false, error: 'local_json_required' });
    try {
      const chunks = []; let size = 0;
      for await (const chunk of request) { size += chunk.length; if (size > 2 * 1024 * 1024) throw new Error('request_too_large'); chunks.push(chunk); }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (body.instanceId !== instance.instanceId) throw new Error('instance_mismatch');
      send(200, { ok: true, value: await action(body.action, body.payload) });
    } catch (error) {
      send(400, { ok: false, error: /^[a-z0-9_-]+$/i.test(error.message) ? error.message : 'request_failed' });
    }
  } });
}
