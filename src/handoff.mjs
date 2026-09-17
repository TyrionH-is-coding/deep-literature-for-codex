import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { readJson, writeJson } from './core.mjs';
import { ensureInstanceWorkspace, ensureLiteratureDefault } from './workspace.mjs';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
const digest = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
function identifier(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 300) throw new Error('identifier_required');
  return value;
}
const gateDigest = job => digest({ status: job?.status, reason: job?.detail?.reason_code, input: job?.detail?.required_input });

export class Handoff {
  pending = Promise.resolve();
  static async open(root, dependencies) {
    const service = new Handoff(root, dependencies);
    try { service.data = await readJson(service.file); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (service.data.instanceId !== dependencies.instance.instanceId || service.data.schema !== 1) throw new Error('handoff_instance_mismatch');
    return service;
  }
  constructor(root, dependencies) {
    this.root = root;
    Object.assign(this, dependencies);
    this.file = path.join(root, 'state', 'handoff.json');
    this.data = { schema: 1, instanceId: this.instance.instanceId, bindings: {}, children: {}, tasks: {} };
  }
  serial(action) {
    const result = this.pending.then(action, action);
    this.pending = result.catch(() => {});
    return result;
  }
  save() { return writeJson(this.file, this.data); }
  scopeFor(sessionId) {
    const seen = new Set();
    while (sessionId && !seen.has(sessionId)) {
      seen.add(sessionId);
      const binding = Object.values(this.data.bindings).find(value => value.sessionId === sessionId);
      if (binding) return binding.active ? { instanceId: this.instance.instanceId, scopeSessionId: binding.sessionId, scopeFolderId: binding.folderId } : null;
      sessionId = this.data.children[sessionId];
    }
    return null;
  }
  observeSession(sessionId, parentSessionId) {
    if (!parentSessionId || sessionId === parentSessionId) return;
    // Only the bridge's actual DSH creation event calls this, never HTTP input.
    Object.defineProperty(this.data.children, sessionId, { value: parentSessionId, writable: true, enumerable: true, configurable: true });
  }
  bind(folderId) { return this.serial(() => this._bind(folderId)); }
  async _bind(folderId) {
    identifier(folderId);
    const folders = await this.engine(['folder-list']);
    const folder = folders.find(value => value.folder_id === folderId);
    if (!folder) throw new Error('folder_not_found');
    const key = digest(folderId);
    let binding = this.data.bindings[key];
    if (!binding) {
      binding = this.data.bindings[key] = { folderId, sessionId: 'session-' + randomUUID(), active: true };
      await this.save();
    }
    if (!binding.active) throw new Error('folder_archived');
    await this.prepareHost();
    await this.rpc('session.create', {
      sessionId: binding.sessionId,
      workspaceId: this.data.workspace.workspaceId,
      agentPreset: 'scientific-reading',
    });
    await this.rpc('session.rename', { sessionId: binding.sessionId, title: '文献 · ' + folder.name });
    return { ...binding, name: folder.name };
  }
  async prepareHost() {
    const workspace = await ensureInstanceWorkspace(this.rpc, this.root);
    this.data.workspace = { workspaceId: workspace.workspaceId, path: workspace.path };
    await this.save();
    await ensureLiteratureDefault(this.rpc);
    return this.data.workspace;
  }
  async checkedTask(taskId) {
    const task = Object.values(this.data.tasks).find(value => value.taskId === taskId);
    if (!task) throw new Error('task_not_found');
    const scope = this.scopeFor(task.sessionId);
    if (!scope) throw new Error('folder_archived');
    const item = await this.engine(['library-item-v2', '--paper-id', task.paperId], undefined, scope);
    if (item.folder_id !== task.folderId) throw new Error('scope_changed');
    return { task, scope };
  }
  submit(request) {
    return this.serial(async () => {
      const key = digest(identifier(request.idempotencyKey));
      const normalized = { folderId: identifier(request.folderId), paperId: identifier(request.paperId) };
      let task = this.data.tasks[key];
      if (task && task.requestDigest !== digest(normalized)) throw new Error('idempotency_conflict');
      if (!task) {
        const binding = await this._bind(normalized.folderId);
        task = this.data.tasks[key] = { ...normalized, sessionId: binding.sessionId, taskId: 'task-' + randomUUID(),
          requestDigest: digest(normalized), status: 'accepted', jobId: null, dispatches: {}, operations: {}, createdAt: new Date().toISOString() };
        await this.save();
      }
      const { scope } = await this.checkedTask(task.taskId);
      if (!task.jobId) {
        // A's content identity is stable; a crash before this receipt can safely
        // repeat start without starting a second parse or changing the paper ID.
        const result = await this.engine(['full-read-pipeline-start', '--paper-id', task.paperId], undefined, scope);
        if (!/^job_[a-f0-9]{16}$/.test(result.parent_job_id ?? '')) throw new Error('invalid_parent_job');
        task.jobId = result.parent_job_id;
        await this.save();
      }
      await this._refresh(task);
      if (request.runAgent !== false && task.status === 'waiting_agent') await this._dispatch(task);
      return structuredClone(task);
    });
  }
  async _refresh(task) {
    try {
      const { scope } = await this.checkedTask(task.taskId);
      if (!task.jobId) { await this.save(); return task; }
      const job = await this.engine(['job-status', '--job-id', task.jobId], undefined, scope);
      if (job.paper_id !== task.paperId || job.job_id !== task.jobId) throw new Error('job_identity_mismatch');
      task.job = job;
      task.error = job.status === 'failed'
        ? (typeof job.detail?.error === 'string' && job.detail.error ? job.detail.error
          : typeof job.detail?.reason_code === 'string' && job.detail.reason_code ? job.detail.reason_code
          : 'job_failed')
        : null;
      task.status = ['waiting_user', 'waiting_agent', 'failed'].includes(job.status) ? job.status
        : job.status === 'interrupted' ? 'waiting_user' : 'dispatched';
      if (job.status === 'completed') {
        task.artifacts = await this.reader(task.paperId, scope);
        task.status = 'completed';
      }
      if (task.cancelRequested && !['completed', 'failed'].includes(task.status)) task.status = 'cancel_requested';
    } catch (error) { task.status = 'failed'; task.error = error.message; }
    task.checkedAt = new Date().toISOString();
    await this.save();
    return task;
  }
  task(taskId) {
    return this.serial(async () => {
      const task = Object.values(this.data.tasks).find(value => value.taskId === taskId);
      if (!task) throw new Error('task_not_found');
      return structuredClone(await this._refresh(task));
    });
  }
  list() {
    return this.serial(async () => {
      for (const task of Object.values(this.data.tasks)) await this._refresh(task);
      return structuredClone({ bindings: Object.values(this.data.bindings), tasks: Object.values(this.data.tasks) });
    });
  }
  dispatch(taskId, retryKey) {
    return this.serial(async () => {
      const { task } = await this.checkedTask(taskId);
      if (retryKey !== undefined) { identifier(retryKey); task.cancelRequested = false; }
      await this._refresh(task);
      return this._dispatch(task, retryKey);
    });
  }
  async _dispatch(task, retryKey) {
    if (task.status !== 'waiting_agent') return { ...structuredClone(task), dispatch: { status: 'not_needed' } };
    const gate = digest({ reason: task.job.detail?.reason_code, input: task.job.detail?.required_input, retryKey });
    let dispatch = task.dispatches[gate];
    if (dispatch) {
      let evidence;
      try { evidence = await this.dispatchEvidence(task.sessionId, dispatch.rpcId); } catch { evidence = 'uncertain'; }
      dispatch.evidence = ['pending', 'delivered', 'canceled'].includes(evidence) ? evidence : 'uncertain';
      dispatch.status = ['pending', 'delivered'].includes(dispatch.evidence) ? 'accepted' : dispatch.evidence;
      await this.save();
      return { ...structuredClone(task), dispatch };
    }
    dispatch = task.dispatches[gate] = { rpcId: randomUUID(), status: 'prepared' };
    await this.save();
    try {
      const result = await this.rpc('session.prompt', { sessionId: task.sessionId, mode: 'queue', clientTimeZone: 'Asia/Shanghai',
        content: [{ type: 'text', text: `请继续本分类的论文 ${task.paperId}，现有任务 ${task.jobId}。先用 sr_job_status 读取真实状态；需要翻译/复核时用 csr_read_job_input 读取当前 gate 的材料，按原合同提交。不要重新建立同篇任务。遇到需要用户的 PDF、密钥、阅读确认或失败时报告具体状态并等待。` }] }, dispatch.rpcId);
      if (result.accepted !== true) throw new Error('prompt_not_accepted');
      dispatch.status = 'accepted';
    } catch { dispatch.status = 'uncertain'; }
    await this.save();
    return { ...structuredClone(task), dispatch };
  }
  operate(taskId, idempotencyKey, kind, payload) {
    return this.serial(async () => {
      const { task, scope } = await this.checkedTask(taskId);
      const key = digest(identifier(idempotencyKey)), fingerprint = digest({ kind, payload });
      const previous = task.operations[key];
      if (previous && previous.fingerprint !== fingerprint) throw new Error('idempotency_conflict');
      if (['completed', 'observed_progress'].includes(previous?.status)) return structuredClone(await this._refresh(task));
      await this._refresh(task);
      if (previous) {
        if (kind === 'attach') {
          const artifact = await this.engine(['artifact-resolve', '--paper-id', task.paperId, '--kind', 'pdf'], undefined, scope);
          if (artifact.sha256 === previous.sha256) {
            if (task.job.detail?.reason_code === 'pdf_required') {
              await this.engine(['full-read-pipeline-resume', '--job-id', task.jobId, '--input', '-'], { pdf_attached: true }, scope);
            }
            previous.status = 'completed';
            await this.save();
            return structuredClone(await this._refresh(task));
          }
        } else if (kind === 'resume' && previous.gateDigest !== gateDigest(task.job)) {
          // Progress is observable, but a lost receipt cannot prove which writer supplied it.
          previous.status = 'observed_progress';
          await this.save();
          return structuredClone(task);
        }
        throw new Error('operation_reconciliation_required');
      }
      let pdf, sha256;
      if (kind === 'attach') {
        if (!['manual', 'codex_authorized'].includes(payload.sourceType)) throw new Error('pdf_source_type_required');
        if (typeof payload.pdf !== 'string' || !path.isAbsolute(payload.pdf)) throw new Error('absolute_pdf_path_required');
        pdf = await fs.realpath(payload.pdf);
        const bytes = await fs.readFile(pdf);
        if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('invalid_pdf');
        sha256 = createHash('sha256').update(bytes).digest('hex');
      } else if (kind !== 'resume' || !payload.input || typeof payload.input !== 'object' || Array.isArray(payload.input)) throw new Error('invalid_operation');
      const operation = task.operations[key] = { fingerprint, kind, status: 'prepared', gateDigest: gateDigest(task.job),
        ...(kind === 'attach' ? { sha256, sourceType: payload.sourceType } : {}) };
      await this.save();
      if (kind === 'resume') await this.engine(['full-read-pipeline-resume', '--job-id', task.jobId, '--input', '-'], payload.input, scope);
      else await this.engine(['full-read-pdf-attach-resume', '--paper-id', task.paperId, '--job-id', task.jobId, '--pdf', pdf], undefined, scope);
      operation.status = 'completed';
      task.cancelRequested = false;
      await this.save();
      return structuredClone(await this._refresh(task));
    });
  }
  cancel(taskId) {
    return this.serial(async () => {
      const { task } = await this.checkedTask(taskId);
      task.cancellation = await this.cancelTask(task);
      task.cancelRequested = true;
      // DSH cancellation does not kill A's detached worker. Keep that distinction.
      await this._refresh(task);
      return structuredClone(task);
    });
  }
  archive(folderId, archived) {
    return this.serial(async () => {
      await this.engine(['scope-folder-state', '--folder-id', identifier(folderId), '--archived', archived ? 'true' : 'false']);
      const binding = this.data.bindings[digest(folderId)];
      if (binding) binding.active = !archived;
      await this.save();
      return { folderId, archived: Boolean(archived) };
    });
  }
}
