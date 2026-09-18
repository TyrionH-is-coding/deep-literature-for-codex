import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const base = path.resolve(import.meta.dirname, '..');
const a = 'C:/Users/15694/Documents/ChatGPT/deep-literature-engine-v02-004i';
const runtime = path.join(base, 'outputs/v02-004j/runtime');
const entry = path.join(runtime, 'node_modules/@deepseek-ai/dsh/lib/bin.js');
const python = path.join(a, '.venv/Scripts/python.exe');
const run = path.join(base, 'outputs/v02-004j/native-' + Date.now());
const root = path.join(run, 'instance'), home = path.join(run, 'home');
await fs.mkdir(path.join(root, 'workspace'), { recursive: true });
process.env.PYTHONDONTWRITEBYTECODE = '1'; delete process.env.PYTHONPATH;
const exec = (exe, args, cwd = base) => execFileSync(exe, args, { cwd, encoding: 'utf8', windowsHide: true, timeout: 120000 });
const report = { run, startedAt: new Date().toISOString(), boots: [], observations: [],
  mode: 'real DSH rc.7 + production B HTTP/Handoff/adapter + fixed A/Python; synthetic local LLM and injected agent gate' };
let host, url;
const pause = () => new Promise(r => setTimeout(r, 100));
const record = (name, value) => { report.observations.push({ name, value }); return value; };
async function stop() {
  if (!host) return;
  if (host.exitCode === null && host.signalCode === null) { const closed = new Promise(r => host.once('close', r)); host.kill(); await closed; }
  report.boots.at(-1).cleanup = { pid: host.pid, exitCode: host.exitCode, signal: host.signalCode, closed: true };
  host = null;
}
async function boot() {
  const env = {};
  for (const key of ['SystemRoot', 'WINDIR', 'PATH', 'PATHEXT', 'TEMP', 'TMP']) if (process.env[key]) env[key] = process.env[key];
  Object.assign(env, { DSH_HOME: home, DSH_CWD: path.join(root, 'workspace'), HOME: run, USERPROFILE: run, NO_PROXY: '*', PYTHONDONTWRITEBYTECODE: '1' });
  host = spawn(process.execPath, [entry, '--profile', 'web', '--host', '127.0.0.1', '--port', '0'], { cwd: path.join(root, 'workspace'), env, windowsHide: true });
  const row = { pid: host.pid, log: '' }; report.boots.push(row);
  host.stdout.on('data', x => row.log += x); host.stderr.on('data', x => row.log += x);
  for (let i = 0; i < 1200; i++) {
    const match = row.log.match(/http:\/\/127\.0\.0\.1:\d+/);
    if (match) { url = match[0]; row.url = url; return; }
    if (host.exitCode !== null) throw Error(row.log);
    await pause();
  }
  throw Error('boot_timeout');
}
async function json(route, body) {
  const response = await fetch(url + route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
  const result = await response.json(); assert.ok(response.ok, JSON.stringify(result)); return result;
}
const rpc = async (method, payload, rpcId = randomUUID()) => {
  const value = await json('/api/' + method, { type: 'client-request', rpcId, method, payload });
  assert.equal(value.result?.ok, true, JSON.stringify(value)); return value.result.value;
};
const action = async (action, payload = {}) => {
  const result = await json('/__workbench/api', { instanceId: 'v02-004j-native', action, payload });
  assert.equal(result.ok, true, JSON.stringify(result)); return result.value;
};
const probe = (sessionId, action = 'state', rpcIds) => json('/v4j-probe', { sessionId, action, rpcIds });
async function waitFor(sessionId, predicate) {
  for (let i = 0; i < 600; i++) { const state = await probe(sessionId); if (predicate(state)) return state; await pause(); }
  throw Error('state_timeout ' + JSON.stringify(await probe(sessionId)));
}
const prompt = (sessionId, id) => rpc('session.prompt', { sessionId, mode: 'queue', content: [{ type: 'text', text: 'SYNTHETIC ' + id }] }, id);
try {
  report.sourceCommit = exec('git', ['rev-parse', 'HEAD']).trim();
  assert.equal(exec('git', ['rev-parse', 'HEAD'], a).trim(), 'b4a9ecc00a76b85c244a0167c79b5a3539e97415');
  report.python = JSON.parse(exec(python, [path.join(base, 'scripts/fixtures/v02-004j/verify-python.py'), a]));
  const pkg = JSON.parse(await fs.readFile(path.join(runtime, 'node_modules/@deepseek-ai/dsh/package.json')));
  assert.equal(pkg.version, '0.1.0-rc.7'); report.dsh = pkg.version;
  report.hashes = {};
  for (const file of [entry, path.join(a, 'lib/index.js'), path.join(a, 'lib/cli.js'), path.join(base, 'runtime/package-lock.json'),
    path.join(base, 'src/modules/workflow/handoff.mjs'), path.join(base, 'src/modules/bridge/plugin.mjs')]) {
    report.hashes[file] = createHash('sha256').update(await fs.readFile(file)).digest('hex');
  }
  const link = path.join(runtime, 'node_modules/@dsh-external/dsh-scientific-reading');
  await fs.mkdir(path.dirname(link), { recursive: true });
  try { await fs.symlink(a, link, 'junction'); } catch (error) { if (error.code !== 'EEXIST') throw error; assert.equal(await fs.realpath(link), await fs.realpath(a)); }
  const metadata = JSON.parse(exec(python, [path.join(base, 'scripts/fixtures/v02-004j/metadata.py'), path.join(root, 'library')]));
  const engineConfig = { dataRoot: metadata.root, enginePython: python, scansciPython: python, school: '', outputDir: '', legalOnly: true };
  await fs.writeFile(path.join(root, '.workbench.json'), JSON.stringify({ instanceId: 'v02-004j-native' }));
  await fs.writeFile(path.join(root, 'installation.json'), JSON.stringify({ dsh: entry }));
  const profile = path.join(home, 'profiles/web'); await fs.mkdir(profile, { recursive: true });
  const patch = ['credentials', 'llm-pi-ai', 'llm-deepseek', 'session-title-llm', 'web-search-deepseek', 'skill-filesystem', 'hmr'].map(id => ({ id, disabled: true }));
  patch.push({ id: 'agent-default-model', config: { provider: 'v4j-local', model: 'synthetic' } }, { insert: [
    { id: 'v4j-probe', name: pathToFileURL(path.join(base, 'scripts/fixtures/v02-004j/host-probe.mjs')).href, config: { entry } },
    { id: 'v4j-engine', name: pathToFileURL(path.join(a, 'lib/index.js')).href, config: engineConfig },
    { id: 'v4j-bridge', name: pathToFileURL(path.join(base, 'src/modules/bridge/plugin.mjs')).href, config: { root, engineConfig } },
  ] });
  await fs.writeFile(path.join(profile, 'cordis.patch.yml'), JSON.stringify(patch));
  await boot();
  async function prepareTask(paperId, idempotencyKey) {
    let task = await action('submit', { folderId: metadata.folder, paperId, idempotencyKey, runAgent: false });
    for (let i = 0; i < 80; i++) {
      task = await action('task', { taskId: task.taskId });
      if (task.job?.status === 'waiting_user' && task.control?.worker === null) break;
      await pause();
    }
    if (idempotencyKey === 'one') {
      const stopped = await action('cancel', { taskId: task.taskId });
      record('trusted HTTP explicit resume', await action('resume', { taskId: task.taskId, idempotencyKey: 'http-explicit',
        resumeStopped: true, expectedRevision: stopped.control.revision, input: {} }));
      for (let i = 0; i < 80; i++) {
        task = await action('task', { taskId: task.taskId });
        if (task.job?.status === 'waiting_user' && task.control?.worker === null) break;
        await pause();
      }
      assert.equal(task.cancelRequested, false); assert.equal(task.control.revision, 2);
    }
    record('synthetic gate injection', JSON.parse(exec(python, [path.join(base, 'scripts/fixtures/v02-004j/agent-gate.py'), metadata.root, task.jobId])));
    return action('task', { taskId: task.taskId });
  }
  const one = await prepareTask(metadata.papers[0], 'one');
  const other = await prepareTask(metadata.papers[1], 'other');
  await prompt(one.sessionId, 'manual-blocker'); await waitFor(one.sessionId, s => s.calls === 1);
  const queued = await action('dispatch', { taskId: one.taskId }); const ownedRpc = queued.dispatch.rpcId;
  await prompt(one.sessionId, 'unrelated-queue');
  const canceled = record('HTTP cancel removes only owned queue and stops real A parent', await action('cancel', { taskId: one.taskId }));
  assert.equal(canceled.cancellation.removedQueued, 1); assert.equal(canceled.cancellation.turn, 'not_targeted');
  assert.equal(canceled.control.status, 'acknowledged');
  const state = record('unrelated running turn and queue survive', await probe(one.sessionId));
  assert.equal(state.aborted, 0); assert.ok(state.queue.includes('unrelated-queue')); assert.ok(!state.queue.includes(ownedRpc));
  await probe(one.sessionId, 'release'); await waitFor(one.sessionId, s => s.calls === 2);
  await probe(one.sessionId, 'release'); await waitFor(one.sessionId, s => s.status !== 'running');
  await action('dispatch', { taskId: other.taskId }); await waitFor(one.sessionId, s => s.calls === 3);
  const exclusive = record('HTTP cancel exclusive active turn', await action('cancel', { taskId: other.taskId }));
  assert.equal(exclusive.cancellation.turn, 'cancel_requested'); await waitFor(one.sessionId, s => s.aborted === 1);
  // Replay a known task RPC together with a manual RPC inside a native claimed turn.
  await prompt(one.sessionId, 'mixed-blocker'); await waitFor(one.sessionId, s => s.calls === 4);
  await probe(one.sessionId, 'stage-shared', [ownedRpc, 'mixed-other']); await probe(one.sessionId, 'release');
  await waitFor(one.sessionId, s => s.events.some(e => e.type === 'user/message' && e.data.source?.rpcId === 'mixed-other'));
  const mixed = record('HTTP cancel mixed native turn', await action('cancel', { taskId: one.taskId }));
  assert.equal(mixed.cancellation.turn, 'not_targeted');
  const mixedState = record('mixed stream was not aborted', await probe(one.sessionId));
  assert.equal(mixedState.status, 'running'); assert.equal(mixedState.aborted, 1);
  await probe(one.sessionId, 'release'); await waitFor(one.sessionId, s => s.status !== 'running');
  await stop(); await boot();
  await action('bind', { folderId: metadata.folder });
  await action('dispatch', { taskId: one.taskId, retryKey: 'cannot-unstop' });
  const reopened = record('restart reconciles stop and never requeues canceled task', await action('task', { taskId: one.taskId }));
  assert.equal(reopened.cancelRequested, true); assert.equal(reopened.control.stopRequested, true);
  assert.equal((await probe(one.sessionId)).calls, 0);
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.error = error.stack; process.exitCode = 1; }
finally { await stop(); report.finishedAt = new Date().toISOString(); await fs.writeFile(path.join(run, 'report.json'), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ status: report.status, error: report.error, report: path.join(run, 'report.json') }));
