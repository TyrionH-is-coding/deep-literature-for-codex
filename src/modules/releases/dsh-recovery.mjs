// Fixed rc.7 offline adapter. Executed in an isolated child, never in a live host.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

const headerKeys = new Set(['version', 'id', 'createdAt', 'cwd', 'parentSession', 'seedLength', 'origin', 'delegationDepth', 'agentPreset']);
// Fixed rc.7 durable core vocabulary. Active goals/schedules/approval requests
// and subagent descriptors remain outside the supported first recovery format.
export const RECOVERY_EVENT_TYPES = new Set(['agent-preset/selected', 'agent/inbox/spliced', 'approval/policy', 'assistant/chunk', 'assistant/message',
  'command/done', 'command/run', 'compaction/end', 'compaction/prune', 'compaction/start', 'compaction/summary', 'feedback/record',
  'hook/invoked', 'hook/result', 'llm/retry', 'llm/retry-started', 'permission/preset', 'plan/mode', 'request/context', 'request/header', 'sandbox/mode',
  'session/end-seed', 'session/title', 'session/title-llm-request', 'step/end', 'step/start', 'todo/write', 'tool-workflow/agent-end',
  'tool-workflow/agent-start', 'tool-workflow/run-end', 'tool-workflow/run-start', 'tool/call', 'tool/code-dispatch', 'tool/code-dispatch-start',
  'tool/result', 'turn/end', 'turn/start', 'user/message', 'web/deepseek-search-llm-request']);
export function scanSupported(value) {
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && /SYNTHETIC_(CREDENTIAL|SECRET)_CANARY/.test(value)) throw new Error('recovery_known_secret');
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (/^(api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|password|client[_-]?secret)$/i.test(key) && item) throw new Error('recovery_structured_secret');
    if (/^(spill|media|attachments|attachmentRef|blobRef)$/i.test(key) && item && (!Array.isArray(item) || item.length)) throw new Error('recovery_media_spill_unsupported');
    if (key === 'type' && ['image', 'image_url', 'audio', 'video', 'file'].includes(item)) throw new Error('recovery_media_spill_unsupported');
    scanSupported(item);
  }
}

async function filesAt(root) {
  const result = [];
  async function walk(dir) {
    for (const item of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      if (dir === root && item.name === 'profiles') continue; // Validated separately; never traverse managed module links.
      if ((await fs.lstat(full)).isSymbolicLink()) throw new Error('recovery_link_unsupported');
      if (item.isDirectory()) await walk(full);
      else if (item.isFile()) result.push(path.relative(root, full).replaceAll('\\', '/'));
      else throw new Error('recovery_special_file_unsupported');
    }
  }
  await walk(root);
  return result;
}

export function validateSessions(snapshot, knownTypes = RECOVERY_EVENT_TYPES) {
  if (snapshot.contract !== 'deep-literature-dsh-rc7-v1' || !Array.isArray(snapshot.sessions)) throw new Error('recovery_dsh_format');
  scanSupported(snapshot);
  const ids = new Set();
  for (const { meta, events } of snapshot.sessions) {
    if (meta.version !== 0 || Object.keys(meta).some(k => !headerKeys.has(k))
        || typeof meta.id !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(meta.id)
        || ids.has(meta.id) || meta.cwd !== snapshot.workspacePath
        || (meta.agentPreset && !['scientific-reading', 'default'].includes(meta.agentPreset))) throw new Error('recovery_dsh_header');
    ids.add(meta.id);
    let seq = -1;
    for (const event of events) {
      if (!knownTypes.has(event.type) || /goal|schedule|subagent/.test(event.type) || (event.type.startsWith('approval/') && event.type !== 'approval/policy')
          || !Number.isInteger(event.seq) || event.seq <= seq) throw new Error('recovery_dsh_event_unsupported:' + event.type + ':' + event.seq);
      seq = event.seq;
    }
  }
  for (const { meta } of snapshot.sessions) {
    const seen = new Set([meta.id]); let parent = meta.parentSession;
    while (parent) {
      if (!ids.has(parent) || seen.has(parent)) throw new Error('recovery_dsh_parent_graph');
      seen.add(parent); parent = snapshot.sessions.find(s => s.meta.id === parent).meta.parentSession;
    }
  }
  const ws = snapshot.workspace;
  if (!ws || ws.unit?.version !== 2 || ws.global?.pendingMutation !== undefined
      || !Array.isArray(ws.global.workspaceIds) || ws.global.workspaceIds.length !== 1
      || Object.keys(ws.tables?.workspaces ?? {}).length !== 1) throw new Error('recovery_dsh_workspace');
  const row = ws.tables.workspaces[ws.global.workspaceIds[0]];
  if (!row || row.path !== snapshot.workspacePath || !Array.isArray(row.sessionIds)
      || new Set(row.sessionIds).size !== row.sessionIds.length || row.sessionIds.some(id => !ids.has(id))
      || [...ids].some(id => !row.sessionIds.includes(id))
      || (ws.global.archivedSessionIds ?? []).some(id => !ids.has(id))) throw new Error('recovery_dsh_workspace_relations');
  return ids;
}

async function main() {
  const [mode, root, installationFile, input, output] = process.argv.slice(2);
  if (!['export', 'import'].includes(mode)) throw new Error('recovery_dsh_mode');
  const installation = JSON.parse(await fs.readFile(installationFile, 'utf8'));
  if (installation.pins.dsh !== '0.1.0-rc.7') throw new Error('recovery_dsh_version');
  const home = path.join(root, 'state', 'dsh-home');
  process.env.DSH_HOME = home;
  const require = createRequire(installation.dsh);
  if (mode === 'export') {
    const profile = path.join(home, 'profiles', 'workbench');
    const profiles = await fs.readdir(path.join(home, 'profiles'));
    if (!profiles.includes('workbench') || profiles.some(name => !['workbench', 'node_modules'].includes(name))) throw new Error('recovery_custom_profile_unsupported');
    // rc.7 creates an ancestor resolution cache of links to the fixed runtime.
    if (profiles.includes('node_modules')) {
      const cache = path.join(home, 'profiles', 'node_modules');
      const modules = path.join(installation.slot, 'runtime', 'npm', 'node_modules');
      async function verifyCache(dir) {
        for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
          const file = path.join(dir, entry.name), stat = await fs.lstat(file);
          if (stat.isSymbolicLink()) {
            if (await fs.realpath(file) !== await fs.realpath(path.join(modules, path.relative(cache, file)))) throw new Error('recovery_custom_module_unsupported');
          } else if (stat.isDirectory() && dir === cache && entry.name.startsWith('@')) await verifyCache(file);
          else throw new Error('recovery_custom_module_unsupported');
        }
      }
      await verifyCache(cache);
    }
    if (await fs.realpath(path.join(profile, 'node_modules')) !== await fs.realpath(installation.profileModules)) throw new Error('recovery_custom_module_unsupported');
    if ((await fs.readFile(path.join(profile, 'cordis.patch.yml'), 'utf8')).trim() !== '[]') throw new Error('recovery_custom_profile_unsupported');
    const composition = (await fs.readFile(path.join(profile, 'cordis.yml'), 'utf8')).split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith('#')).join('').trim();
    if (composition !== '[]' || (await fs.readFile(path.join(profile, 'package.json'), 'utf8')) !== (await fs.readFile(installation.profilePackage, 'utf8'))) throw new Error('recovery_custom_profile_unsupported');
    const packageRoot = path.dirname(require.resolve('@dsh-external/dsh-scientific-reading/package.json'));
    for (const file of ['preset.yml', 'agent.cordis.yml']) {
      const actual = await fs.readFile(path.join(home, '.agent-presets', 'scientific-reading', file));
      const expected = await fs.readFile(path.join(packageRoot, 'preset', 'scientific-reading', file));
      if (!actual.equals(expected)) throw new Error('recovery_custom_preset_unsupported');
    }
  }
  const load = name => import(pathToFileURL(require.resolve('@deepseek-ai/' + name)).href);
  const [{ Context }, { default: Sessions, KNOWN_SESSION_EVENT_TYPES }, { default: Persistence }] = await Promise.all([
    load('cordis'), load('dsh-session'), load('dsh-session-persistence-jsonl')]);
  const ctx = new Context();
  ctx.plugin(Sessions); ctx.plugin(Persistence, { root: path.join(home, 'sessions'), compression: 'zstd' });
  await new Promise(resolve => ctx.inject(['sessionPersistence'], resolve));
  try {
    const p = ctx.sessionPersistence;
    if (mode === 'export') {
      const files = await filesAt(home);
      for (const file of files) {
        if (file.startsWith('sessions/') && !/^sessions\/[^/]+\/[^/]+\/session\.jsonl(?:\.zstd)?$/.test(file)) throw new Error('recovery_dsh_unknown_session_file');
        if (file.startsWith('storages/') && !['storages/workspace.json', 'storages/session_projcache.json'].includes(file)) throw new Error('recovery_dsh_unknown_storage');
        if (!/^(sessions\/|storages\/|settings\.yaml$|\.credentials\.yaml$|\.agent-presets\/scientific-reading\/(preset.yml|agent.cordis.yml)$)/.test(file)) throw new Error('recovery_dsh_unknown_state');
      }
      const snapshot = { contract: 'deep-literature-dsh-rc7-v1', workspacePath: await fs.realpath(path.join(root, 'workspace')),
        workspace: JSON.parse(await fs.readFile(path.join(home, 'storages', 'workspace.json'), 'utf8')), sessions: [] };
      for (const meta of await p.list()) snapshot.sessions.push(await p.readFrom(meta.id, 0));
      if (snapshot.sessions.length !== files.filter(f => f.startsWith('sessions/')).length) throw new Error('recovery_dsh_hidden_or_corrupt_session');
      validateSessions(snapshot, KNOWN_SESSION_EVENT_TYPES);
      await fs.writeFile(output, JSON.stringify(snapshot), { flag: 'wx' });
    } else {
      const snapshot = JSON.parse(await fs.readFile(input, 'utf8'));
      validateSessions(snapshot, KNOWN_SESSION_EVENT_TYPES);
      const cwd = await fs.realpath(path.join(root, 'workspace'));
      const oldId = snapshot.workspace.global.workspaceIds[0], newId = randomUUID();
      const workspace = structuredClone(snapshot.workspace);
      workspace.global.workspaceIds = [newId];
      workspace.tables.workspaces = { [newId]: { ...workspace.tables.workspaces[oldId], path: cwd } };
      for (const item of snapshot.sessions) {
        await p.materialize({ ...item.meta, cwd }, item.events);
        const actual = await p.readFrom(item.meta.id, 0);
        if (JSON.stringify(actual.events) !== JSON.stringify(item.events)) throw new Error('recovery_dsh_event_readback');
      }
      await fs.mkdir(path.join(home, 'storages'), { recursive: true });
      await fs.writeFile(path.join(home, 'storages', 'workspace.json'), JSON.stringify(workspace), { flag: 'wx' });
      await fs.writeFile(output, JSON.stringify({ sourceWorkspaceId: oldId, workspaceId: newId, path: cwd,
        sessionIds: snapshot.sessions.map(s => s.meta.id), transformations: ['header.cwd', 'workspace.id', 'workspace.path'], originalEventsPreserved: true }), { flag: 'wx' });
    }
  } finally { await ctx.fiber.dispose(); }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { await main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
