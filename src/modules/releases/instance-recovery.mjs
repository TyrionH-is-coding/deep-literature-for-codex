import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { initializeRoot, readJson, writeJson, recoveryFile, readRecovery, isolatedEnvironment } from '../foundation/index.mjs';
import { start, stop, status, pipeName, prepareLocalSocket } from '../lifecycle/index.mjs';
import { Handoff } from '../workflow/index.mjs';
import { runLibraryCommand } from './library-transfer.mjs';
import { scanSupported, validateSessions } from './dsh-recovery.mjs';

const CONTRACT = 'deep-literature-instance-backup-v1';
export async function exclusiveMaintenance(root, action) {
  const pipe = `${pipeName(root)}-maintenance`;
  await prepareLocalSocket(pipe);
  const server = net.createServer(socket => { socket.on('error', () => {}); socket.end('maintenance'); });
  await new Promise((resolve, reject) => {
    server.once('error', error => reject(new Error(error.code === 'EADDRINUSE' ? 'maintenance_in_progress' : error.message)));
    server.listen(pipe, resolve);
  });
  try { return await action(); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
const files = ['library.zip', 'native.json', 'handoff.json'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const now = () => new Date().toISOString();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
const digest = value => sha(JSON.stringify(canonical(value)));
const identity = release => ({ appSha256: release.appSha256, version: release.version, dataFormat: release.dataFormat,
  platform: release.pins.platform, node: release.pins.node.version, python: release.pins.python.version,
  dsh: release.pins.dsh, plugin: release.pins.plugin });

export async function hashInstallSource(source, platform) {
  const hash = createHash('sha256'); hash.update(platform);
  async function tree(directory) {
    for (const item of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (['node_modules', '.git', '.gitignore', '.work', 'tests', 'test-results'].includes(item.name)) continue;
      const file = path.join(directory, item.name);
      if (item.isDirectory()) await tree(file);
      else if (item.isFile()) { hash.update(path.relative(source, file).replaceAll('\\', '/')); hash.update(await fs.readFile(file)); }
      else throw new Error('source_link_not_supported');
    }
  }
  for (const folder of ['src', 'skills', 'oauth']) await tree(path.join(source, folder));
  for (const file of ['install.ps1', 'workbench.ps1', 'uninstall.ps1', 'install.sh', 'workbench.sh', 'uninstall.sh', 'package.json']) {
    hash.update(file); hash.update(await fs.readFile(path.join(source, file)));
  }
  for (const file of ['pins.json', 'posix-node.tsv', 'package.json', 'package-lock.json', 'requirements.lock']) {
    hash.update(file); hash.update(await fs.readFile(path.join(source, 'runtime', file)));
  }
  return hash.digest('hex');
}

async function plainPath(requested, { absent = false } = {}) {
  const absolute = path.resolve(requested);
  let cursor = path.parse(absolute).root;
  for (const part of absolute.slice(cursor.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    try { if ((await fs.lstat(cursor)).isSymbolicLink()) throw new Error('recovery_path_alias'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (absent) {
    try { await fs.lstat(absolute); throw new Error('recovery_target_exists'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return absolute;
}
function separate(a, b) {
  const left = path.resolve(a).toLowerCase(), right = path.resolve(b).toLowerCase();
  if (left === right || left.startsWith(right + path.sep) || right.startsWith(left + path.sep)) throw new Error('recovery_roots_overlap');
}
async function command(exe, args, options = {}) {
  const { acceptedCodes = [0], ...spawnOptions } = options;
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'], ...spawnOptions });
    let output = '', errors = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { errors = (errors + data).slice(-16000); });
    child.once('error', reject);
    child.once('close', code => !acceptedCodes.includes(code) ? reject(new Error(`recovery_command_failed:${code}:${errors || output}`)) : resolve(output));
    child.stdin.end(options.input ?? '');
  });
}
async function dsh(mode, root, installed, input, output) {
  return command(installed.node, [fileURLToPath(new URL('./dsh-recovery.mjs', import.meta.url)), mode, root,
    path.join(root, 'installation.json'), input, output], { cwd: root, env: isolatedEnvironment(root, process.env, installed) });
}
async function engineJson(root, installed, args, input, scope) {
  const env = isolatedEnvironment(root, process.env, installed);
  if (args[0] === 'full-read-pipeline-resume') {
    // Preserve the parent's pinned provider profile without accepting an
    // executable from the backup or request. Later stages still construct it.
    const wrapper = path.join(installed.slot, 'runtime', 'npm', 'node_modules', '@dsh-external', 'dsh-scientific-reading', 'scripts', 'scansci_wrap.py');
    await fs.access(wrapper);
    env.SR_SCANSCI_PROVIDER_PYTHON = installed.python;
    env.SR_SCANSCI_PROVIDER_WRAPPER = wrapper;
    env.SR_SCANSCI_DISABLE_INSTITUTION = '1';
  }
  if (scope) env.SR_SCOPE_CONTEXT = JSON.stringify(scope);
  const result = JSON.parse(await command(installed.python, ['-I', '-X', 'utf8', '-m', 'scientific_reading', '--data-root', path.join(root, 'library'), ...args],
    { cwd: root, env, input: input === undefined ? '' : JSON.stringify(input), acceptedCodes: args[0] === 'job-status' ? [0, 2, 3, 4] : [0] }));
  if (result.error != null) throw new Error(result.error);
  return result;
}
async function frozenLibrary(root, installed, output, copyDomains) {
  const child = spawn(installed.python, ['-I', '-X', 'utf8', '-m', 'scientific_reading', '--data-root', path.join(root, 'library'),
    'library-backup', '--output', output, '--hold-for-instance', '--timeout', '120'], {
    cwd: root, env: isolatedEnvironment(root, process.env, installed), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '', completed = false;
  const exited = new Promise((resolve, reject) => {
    child.on('error', reject); child.on('close', code => { completed = true; resolve(code); });
  });
  child.stderr.on('data', bytes => { stderr += bytes; });
  const acquired = new Promise((resolve, reject) => {
    child.stdout.on('data', bytes => {
      stdout += bytes;
      if (stdout.includes('\n')) {
        try { const value = JSON.parse(stdout.split('\n')[0]); value.status === 'frozen' ? resolve(value) : reject(new Error(value.error ?? 'recovery_freeze_failed')); }
        catch (error) { reject(error); }
      }
    });
    exited.then(code => reject(new Error(`recovery_freeze_exited:${code}:${stderr || stdout}`)), reject);
  });
  try {
    const proof = await acquired;
    await copyDomains(proof);
    if (completed) throw new Error('recovery_freeze_lost');
    child.stdin.end('release\n');
    if (await exited) throw new Error('recovery_freeze_release_failed:' + stderr);
    const result = JSON.parse(stdout.trim().split('\n').at(-1));
    if (result.status !== 'completed') throw new Error('recovery_freeze_incomplete');
    return result;
  } catch (error) { child.stdin.end(); await exited; throw error; }
}
function relations(native, handoff, sourceId) {
  scanSupported(handoff);
  if (handoff.schema !== 1 || handoff.instanceId !== sourceId) throw new Error('recovery_handoff_identity');
  const ids = new Set(native.sessions.map(s => s.meta.id));
  for (const binding of Object.values(handoff.bindings)) if (!ids.has(binding.sessionId) || !binding.folderId) throw new Error('recovery_binding_session');
  for (const [child, parent] of Object.entries(handoff.children)) if (!ids.has(child) || !ids.has(parent)) throw new Error('recovery_child_session');
  for (const task of Object.values(handoff.tasks)) {
    if (!ids.has(task.sessionId) || !Object.values(handoff.bindings).some(b => b.sessionId === task.sessionId && b.folderId === task.folderId)) throw new Error('recovery_task_binding');
  }
}

export async function backupInstance(requestedRoot, requestedOutput) {
  const root = await plainPath(requestedRoot), output = await plainPath(requestedOutput, { absent: true });
  separate(root, output);
  const instance = await readJson(path.join(root, '.workbench.json'));
  const installed = await readJson(path.join(root, 'installation.json'));
  return exclusiveMaintenance(root, async () => {
    if (await readRecovery(root)) throw new Error('instance_recovery_already_pending');
    const transaction = { contract: 'deep-literature-instance-recovery-v1', root, instanceId: instance.instanceId,
      transactionId: randomUUID(), phase: 'backup', operation: 'backup', startedAt: now() };
    await writeJson(recoveryFile(root), transaction);
    const stage = output + '.partial-' + transaction.transactionId;
    try {
      await stop(root);
      if ((await status(root)).status !== 'stopped') throw new Error('recovery_host_not_stopped');
      await fs.mkdir(stage);
      let manifest;
      await frozenLibrary(root, installed, path.join(stage, 'library.zip'), async proof => {
        await dsh('export', root, installed, '-', path.join(stage, 'native.json'));
        const handoff = await readJson(path.join(root, 'state', 'handoff.json'));
        const native = await readJson(path.join(stage, 'native.json'));
        relations(native, handoff, instance.instanceId);
        await fs.writeFile(path.join(stage, 'handoff.json'), JSON.stringify(handoff));
        const records = [];
        for (const name of files) { const bytes = await fs.readFile(path.join(stage, name)); records.push({ path: name, size: bytes.length, sha256: sha(bytes) }); }
        manifest = { contract: CONTRACT, version: 1, backupId: transaction.transactionId, createdAt: now(), source: instance,
          release: identity(installed), domains: { library: true, native: true, handoff: true }, files: records,
          consistency: { hostStopped: true, supportedEngineWritersFrozen: true, librarySha256: proof.sha256 },
          limitations: ['same-platform-and-artifact', 'single-workspace', 'no-media-spill-custom-presets', 'known-structured-secrets-only', 'restore-requires-explicit-parent-confirmation'] };
        await writeJson(path.join(stage, 'manifest.json'), manifest);
      });
      // A removes its private .sr-backup staging directory when the held
      // snapshot closes. Domain bytes/digests were captured under the freeze;
      // validate the final directory shape only after that private cleanup.
      await verifyInstancePackage(stage);
      await fs.rename(stage, output);
      await fs.rm(recoveryFile(root));
      return { status: 'completed', path: output, manifestSha256: sha(await fs.readFile(path.join(output, 'manifest.json'))), backupId: manifest.backupId };
    } catch (error) {
      await writeJson(recoveryFile(root), { ...transaction, phase: 'failed', error: error.message, partial: stage });
      throw error;
    }
  });
}

export async function verifyInstancePackage(requested) {
  const archive = await plainPath(requested);
  const entries = await fs.readdir(archive);
  if (!same([...entries].sort(), [...files, 'manifest.json'].sort())) throw new Error('recovery_package_domains');
  const manifest = await readJson(path.join(archive, 'manifest.json'));
  if (manifest.contract !== CONTRACT || manifest.version !== 1 || !same(manifest.domains, { library: true, native: true, handoff: true })
      || !Array.isArray(manifest.files) || manifest.files.length !== 3) throw new Error('recovery_package_format');
  const seen = new Set(); let total = 0;
  for (const record of manifest.files) {
    if (!files.includes(record.path) || seen.has(record.path)) throw new Error('recovery_package_path');
    seen.add(record.path);
    const full = await plainPath(path.join(archive, record.path));
    const stat = await fs.stat(full); total += stat.size;
    if (!stat.isFile() || stat.size !== record.size || stat.size > 512 * 1024 ** 2 || total > 1024 ** 3) throw new Error('recovery_package_budget');
    if (sha(await fs.readFile(full)) !== record.sha256) throw new Error('recovery_package_digest');
  }
  const native = await readJson(path.join(archive, 'native.json')), handoff = await readJson(path.join(archive, 'handoff.json'));
  validateSessions(native);
  relations(native, handoff, manifest.source.instanceId);
  return { archive, manifest, native, handoff, manifestSha256: sha(await fs.readFile(path.join(archive, 'manifest.json'))) };
}

export async function abortBackup(root, transactionId) {
  return exclusiveMaintenance(root, async () => {
    const value = await readRecovery(root);
    if (!value) {
      const previous = await readJson(path.join(root, 'state', 'backup-aborted-' + transactionId + '.json')).catch(() => null);
      const instance = await readJson(path.join(root, '.workbench.json'));
      if (previous?.transactionId === transactionId && previous.instanceId === instance.instanceId && previous.quiescence?.status === 'completed') {
        return { status: 'aborted_source_stopped', transactionId, partialPreserved: previous.partial, replayed: true };
      }
      throw new Error('recovery_backup_abort_invalid');
    }
    if (value.transactionId !== transactionId || value.phase !== 'failed' || (value.operation !== undefined && value.operation !== 'backup')
        || typeof value.partial !== 'string' || !value.partial.endsWith('.partial-' + transactionId)
        || value.source || value.steps || value.allowedParents) throw new Error('recovery_backup_abort_invalid');
    await stop(root);
    if ((await status(root)).status !== 'stopped') throw new Error('recovery_host_not_stopped');
    const installed = await readJson(path.join(root, 'installation.json'));
    const check = path.join(root, 'state', 'backup-abort-checks', transactionId + '-' + randomUUID() + '.zip');
    await fs.mkdir(path.dirname(check), { recursive: true });
    const quiescence = await frozenLibrary(root, installed, check, async () => {});
    await writeJson(path.join(root, 'state', 'backup-aborted-' + transactionId + '.json'), { ...value, explicitlyAbortedAt: now(), quiescence });
    await fs.unlink(recoveryFile(root));
    return { status: 'aborted_source_stopped', transactionId, partialPreserved: value.partial };
  });
}

export async function restoreInstance(requestedTarget, request) {
  const source = await verifyInstancePackage(request.archive);
  const target = await plainPath(requestedTarget, { absent: true });
  separate(target, source.manifest.source.root); separate(target, source.archive);
  const packageRoot = await plainPath(request.packageRoot);
  const pins = await readJson(path.join(packageRoot, 'runtime', 'pins.json'));
  if (await hashInstallSource(packageRoot, source.manifest.release.platform) !== source.manifest.release.appSha256) throw new Error('recovery_release_mismatch');
  if (source.manifest.release.platform !== `${process.platform}-${process.arch}` || pins.dsh !== source.manifest.release.dsh
      || pins.plugin.sha256 !== source.manifest.release.plugin.sha256 || pins.node.version !== source.manifest.release.node
      || pins.python.version !== source.manifest.release.python) throw new Error('recovery_release_mismatch');
  await fs.mkdir(target); // Exclusive reservation; never reuse partial or ready roots.
  const instance = await initializeRoot(target);
  let transaction = { contract: 'deep-literature-instance-recovery-v1', root: instance.root, instanceId: instance.instanceId,
    transactionId: randomUUID(), phase: 'preparing', startedAt: now(), backupId: source.manifest.backupId,
    manifestSha256: source.manifestSha256, source: source.manifest.source, allowedParents: {}, steps: [] };
  await writeJson(recoveryFile(instance.root), transaction);
  try {
    if (request.runtimeCache) {
      const cache = await plainPath(request.runtimeCache);
      for (const [name, expected] of [[`node-${pins.node.version}.zip`, pins.node.sha256], [`python-${pins.python.version}-${pins.python.build}.tar.gz`, pins.python.sha256]]) {
        const bytes = await fs.readFile(await plainPath(path.join(cache, name)));
        if (sha(bytes) !== expected) throw new Error('recovery_runtime_cache_digest');
        const destination = path.join(instance.root, 'runtime', 'downloads', name);
        await fs.mkdir(path.dirname(destination), { recursive: true }); await fs.writeFile(destination, bytes, { flag: 'wx' });
      }
    }
    await command('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(packageRoot, 'install.ps1'),
      '-Root', instance.root, '-PluginArchive', path.join(packageRoot, 'inputs', 'scientific-reading.tgz')], {
      cwd: packageRoot, env: { ...process.env, CSR_RECOVERY_INSTALL_ID: transaction.transactionId } });
    const installed = await readJson(path.join(instance.root, 'installation.json'));
    if (!same(identity(installed), source.manifest.release)) throw new Error('recovery_release_mismatch');
    const context = { sourceInstanceId: source.manifest.source.instanceId, targetInstanceId: instance.instanceId,
      bindings: Object.fromEntries(Object.values(source.handoff.bindings).map(b => [b.sessionId, b.folderId])) };
    const contextFile = path.join(instance.root, 'state', 'recovery-context.json');
    await writeJson(contextFile, context);
    await runLibraryCommand(instance.root, installed, ['library-verify', '--archive', path.join(source.archive, 'library.zip')]);
    await runLibraryCommand(instance.root, installed, ['library-restore', '--archive', path.join(source.archive, 'library.zip'),
      '--target', path.join(instance.root, 'library'), '--recovery-context', contextFile]);
    transaction.steps.push('library'); await writeJson(recoveryFile(instance.root), transaction);
    const mappingFile = path.join(instance.root, 'state', 'recovery-native.json');
    await dsh('import', instance.root, installed, path.join(source.archive, 'native.json'), mappingFile);
    const mapping = await readJson(mappingFile);
    const handoff = { ...source.handoff, instanceId: instance.instanceId, workspace: { ...source.handoff.workspace, workspaceId: mapping.workspaceId, path: mapping.path } };
    const handoffTransforms = [];
    const pathKeys = new Set(['data_root', 'workspace_root', 'source_pdf', 'pdf_path', 'reader_html', 'reader_path', 'translations_json',
      'source_map_json', 'full_read_md', 'reading_guide_json', 'highlights_json', 'output_dir', 'source_manifest_path', 'source_path', 'output_path', 'manifest_path']);
    const sourceLibrary = path.join(source.manifest.source.root, 'library');
    function relocateSnapshot(value, location) {
      if (!value || typeof value !== 'object') return;
      for (const [key, item] of Object.entries(value)) {
        if (key === 'instanceId' && item === source.manifest.source.instanceId && value.scopeSessionId && value.scopeFolderId) {
          value[key] = instance.instanceId; handoffTransforms.push(location + '.' + key);
        } else if (pathKeys.has(key) && typeof item === 'string' && path.isAbsolute(item)) {
          const relative = path.relative(sourceLibrary, item);
          if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
            value[key] = path.join(instance.root, 'library', relative); handoffTransforms.push(location + '.' + key);
          }
        } else relocateSnapshot(item, location + '.' + key);
      }
    }
    await writeJson(path.join(instance.root, 'state', 'recovery-original-handoff.json'), source.handoff);
    for (const [key, task] of Object.entries(handoff.tasks)) {
      relocateSnapshot(task.job, 'tasks.' + key + '.job'); relocateSnapshot(task.control, 'tasks.' + key + '.control');
      if (task.artifacts?.readerUrl) { task.artifacts.readerUrl = '/sr/reader/' + encodeURIComponent(task.paperId); handoffTransforms.push('tasks.' + key + '.artifacts.readerUrl'); }
    }
    await writeJson(path.join(instance.root, 'state', 'handoff.json'), handoff);
    await writeJson(path.join(instance.root, 'state', 'recovery-original-native.json'), source.native);
    const folders = await engineJson(instance.root, installed, ['folder-list']);
    for (const binding of Object.values(handoff.bindings)) if (!folders.some(f => f.folder_id === binding.folderId)) throw new Error('recovery_folder_relation');
    for (const task of Object.values(handoff.tasks)) {
      const item = await engineJson(instance.root, installed, ['library-item-v2', '--paper-id', task.paperId]);
      if (item.folder_id !== task.folderId) throw new Error('recovery_paper_relation');
      if (task.jobId) {
        const job = await engineJson(instance.root, installed, ['job-status', '--job-id', task.jobId]);
        if (job.job_id !== task.jobId || job.paper_id !== task.paperId) throw new Error('recovery_parent_relation');
      }
    }
    await verifyInstancePackage(source.archive); // Detect substitution throughout import.
    transaction = { ...transaction, phase: 'validating', steps: [...transaction.steps, 'native', 'handoff'], mapping, handoffTransforms };
    await writeJson(recoveryFile(instance.root), transaction);
    return { status: 'awaiting_validation', root: instance.root, transactionId: transaction.transactionId };
  } catch (error) {
    await stop(instance.root);
    await writeJson(recoveryFile(instance.root), { ...transaction, phase: 'failed', error: error.message });
    throw error;
  }
}

export async function startRecovery(root, transactionId) { return start(root, { recoveryId: transactionId }); }

async function rpc(url, method, payload) {
  const response = await fetch(url + '/api/' + method, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: randomUUID(), method, payload }), signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok || !result.result?.ok) throw new Error('recovery_native_read_failed:' + method);
  return result.result.value;
}
export async function validateRecovery(root, transactionId) {
  return exclusiveMaintenance(root, async () => {
    let transaction = await readRecovery(root);
    if (!transaction || transaction.transactionId !== transactionId || !['validating', 'ready'].includes(transaction.phase)) throw new Error('instance_recovery_transaction_mismatch');
    const original = await readJson(path.join(root, 'state', 'recovery-original-native.json'));
    const boots = [];
    try {
      await stop(root);
      for (let index = 0; index < 2; index++) {
        const live = await start(root, { maintenance: true, recoveryId: transactionId });
        const workspace = await rpc(live.url, 'workspace.list', {});
        if (!workspace.items.some(w => w.workspaceId === transaction.mapping.workspaceId)) throw new Error('recovery_workspace_readback');
        const histories = [];
        for (const session of original.sessions) {
          const history = await rpc(live.url, 'session.history', { sessionId: session.meta.id, maxMessages: 10000 });
          const events = history.events.map(e => e.event ?? e);
          for (const event of session.events) if (digest(events.find(e => e.seq === event.seq)) !== digest(event)) throw new Error('recovery_history_prefix_changed');
          histories.push({ sessionId: session.meta.id, prefixEvents: session.events.length, readEvents: events.length });
        }
        const handoff = await readJson(path.join(root, 'state', 'handoff.json'));
        const readers = [];
        for (const paperId of [...new Set(Object.values(handoff.tasks).filter(t => t.status === 'completed').map(t => t.paperId))]) {
          const response = await fetch(live.url + '/__workbench/api', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instanceId: transaction.instanceId, action: 'reader', payload: { paperId } }) });
          const result = await response.json();
          if (!result.ok) throw new Error('recovery_reader_readback');
          readers.push({ paperId, value: result.value });
        }
        boots.push({ launchId: live.launchId, histories, readers, at: now() });
        await stop(root);
      }
      transaction = { ...transaction, phase: 'ready', verifiedAt: now(), validationBoots: boots, confirmationRequired: true };
      await writeJson(recoveryFile(root), transaction);
      return { status: 'ready_requires_confirmation', transactionId, boots };
    } catch (error) {
      await stop(root);
      await writeJson(recoveryFile(root), { ...transaction, phase: 'failed', error: error.message, validationBoots: boots });
      throw error;
    }
  });
}

export async function continueRecovery(root, request) {
  return exclusiveMaintenance(root, async () => {
    const transaction = await readRecovery(root);
    if (!transaction || transaction.phase !== 'ready' || transaction.transactionId !== request.transactionId
        || request.confirmManifestSha256 !== transaction.manifestSha256) throw new Error('recovery_confirmation_required');
    const installed = await readJson(path.join(root, 'installation.json'));
    await stop(root); // No running host may concurrently rewrite handoff.
    const handoff = await readJson(path.join(root, 'state', 'handoff.json'));
    const task = Object.values(handoff.tasks).find(t => t.taskId === request.taskId);
    if (!task?.jobId || typeof request.idempotencyKey !== 'string' || !request.idempotencyKey.trim()
        || !Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 0
        || !request.input || typeof request.input !== 'object' || Array.isArray(request.input)) throw new Error('recovery_resume_request_invalid');
    const key = digest(request.idempotencyKey), requestId = 'resume-' + digest({ taskId: task.taskId, key });
    const control = await readJson(path.join(root, 'library', 'jobs', task.jobId, 'control.json'));
    const previous = transaction.allowedParents[task.jobId];
    const grant = { requestId, expectedRevision: request.expectedRevision, inputDigest: digest(request.input), taskId: task.taskId, idempotencyKey: request.idempotencyKey };
    const history = (transaction.grantHistory ??= {})[task.jobId] ??= {};
    const old = history[requestId];
    if (old && !same(old.grant, grant)) throw new Error('recovery_parent_confirmation_conflict');
    if (old && previous?.requestId !== requestId) return { status: 'replayed_superseded', parentJobId: task.jobId, requestId,
      result: old.result ?? null, operation: control.operations[requestId] ?? null, currentRevision: control.revision, nativeQueuesRemainBlocked: true };
    if (!previous || previous.requestId !== requestId) {
      if (!control.stopRequested || control.acknowledgedRevision !== request.expectedRevision || control.revision !== request.expectedRevision
          || (previous && request.expectedRevision <= previous.expectedRevision)) throw new Error('recovery_stop_confirmation_required');
      if (previous && !history[previous.requestId]) history[previous.requestId] = { grant: previous };
    }
    for (const alias of Object.values(handoff.tasks).filter(t => t.jobId === task.jobId && t.cancelRequested)) {
      if (!control.operations[alias.stopOperation?.requestId]) throw new Error('recovery_unresolved_stop');
    }
    if (previous?.requestId === requestId && !same(previous, grant)) throw new Error('recovery_parent_confirmation_conflict');
    history[requestId] ??= { grant };
    transaction.allowedParents[task.jobId] = grant;
    await writeJson(recoveryFile(root), transaction);
    const service = new Handoff(root, { instance: await readJson(path.join(root, '.workbench.json')),
      recoveryPermit: { transactionId: transaction.transactionId, parentJobId: task.jobId, requestId },
      engine: (args, input, scope) => {
        if (!['library-item-v2', 'job-status', 'full-read-pipeline-control', 'full-read-pipeline-resume'].includes(args[0])) throw new Error('recovery_operation_not_authorized');
        if (args.includes('--job-id') && args[args.indexOf('--job-id') + 1] !== task.jobId) throw new Error('recovery_other_parent_blocked');
        return engineJson(root, installed, args, input, scope);
      }, rpc: () => { throw new Error('recovery_native_dispatch_blocked'); }, reader: async (paperId, scope) => {
        const artifact = await engineJson(root, installed, ['artifact-resolve', '--paper-id', paperId, '--kind', 'reader'], undefined, scope);
        const paper = path.join(root, 'library', 'papers', paperId);
        const file = await plainPath(path.resolve(paper, artifact.rel_path));
        if (!file.startsWith(paper + path.sep) || sha(await fs.readFile(file)) !== artifact.manifest?.reader_sha256) throw new Error('recovery_reader_digest');
        return { readerPath: file, sha256: artifact.manifest.reader_sha256, sourcePdfSha256: artifact.manifest.source_pdf_sha256,
          verification: 'local_manifest_verified_http_pending' };
      } });
    service.data = handoff;
    const result = await service.operate(task.taskId, request.idempotencyKey, 'resume', {
      resumeStopped: true, expectedRevision: request.expectedRevision, input: request.input });
    history[requestId].result = result;
    await writeJson(recoveryFile(root), transaction);
    await writeJson(path.join(root, 'state', 'recovery-continue-' + digest(requestId) + '.json'), {
      transactionId: transaction.transactionId, request: grant, parentJobId: task.jobId, result, at: now() });
    return { status: 'continued', parentJobId: task.jobId, requestId, task: result, nativeQueuesRemainBlocked: true };
  });
}

export async function stopRecovery(root, request) {
  return exclusiveMaintenance(root, async () => {
    const transaction = await readRecovery(root);
    if (!transaction || transaction.phase !== 'ready' || transaction.transactionId !== request.transactionId
        || request.confirmManifestSha256 !== transaction.manifestSha256) throw new Error('recovery_confirmation_required');
    const handoff = await readJson(path.join(root, 'state', 'handoff.json'));
    const task = Object.values(handoff.tasks).find(t => t.taskId === request.taskId);
    if (!task?.jobId || !transaction.allowedParents[task.jobId] || typeof request.idempotencyKey !== 'string' || !request.idempotencyKey.trim()
        || !Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 0) throw new Error('recovery_stop_request_invalid');
    const requestId = 'stop-' + digest({ taskId: task.taskId, key: request.idempotencyKey });
    const installed = await readJson(path.join(root, 'installation.json'));
    await stop(root);
    const control = await readJson(path.join(root, 'library', 'jobs', task.jobId, 'control.json'));
    const old = control.operations[requestId];
    if (old) {
      if (old.kind !== 'stop' || old.expectedRevision !== request.expectedRevision) throw new Error('recovery_stop_request_conflict');
      return { status: 'replayed', parentJobId: task.jobId, requestId, operation: old, currentRevision: control.revision };
    }
    if (control.revision !== request.expectedRevision) throw new Error('recovery_stop_revision_conflict');
    (transaction.allowedStops ??= {})[task.jobId] = { requestId, expectedRevision: request.expectedRevision };
    await writeJson(recoveryFile(root), transaction);
    const binding = Object.values(handoff.bindings).find(b => b.sessionId === task.sessionId && b.folderId === task.folderId && b.active);
    if (!binding) throw new Error('recovery_stop_binding_invalid');
    const result = await engineJson(root, installed, ['full-read-pipeline-stop', '--job-id', task.jobId, '--request-id', requestId,
      '--expected-revision', String(request.expectedRevision)], undefined,
      { instanceId: transaction.instanceId, scopeSessionId: task.sessionId, scopeFolderId: task.folderId });
    await writeJson(path.join(root, 'state', 'recovery-stop-' + digest(requestId) + '.json'), { request, requestId, result, at: now() });
    return result;
  });
}
