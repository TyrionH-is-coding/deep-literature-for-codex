import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const read = async f => JSON.parse((await fs.readFile(f, 'utf8')).replace(/^\uFEFF/, ''));
const root = process.argv[2], installed = await read(path.join(root, 'installation.json'));
const api = await import(pathToFileURL(path.join(installed.app, 'src/modules/releases/index.mjs')).href);
const lifecycle = await import(pathToFileURL(path.join(installed.app, 'src/modules/lifecycle/index.mjs')).href);
const { isolatedEnvironment } = await import(pathToFileURL(path.join(installed.app, 'src/modules/foundation/index.mjs')).href);
const gate = await read(path.join(root, 'state/instance-recovery.json'));
const original = await read(path.join(root, 'state/recovery-original-native.json'));
const normal = await read('C:/tmp/v006/evidence/source/normal-formula-outline.json');
const patch = path.join(root, 'state/dsh-home/profiles/workbench/cordis.patch.yml'), originalPatch = await fs.readFile(patch);
const counter = 'C:/tmp/v006/evidence/gate-counter-' + path.basename(root) + '-' + Date.now() + '.jsonl';
const report = { root, boots: [], counter };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const handoffBefore = hash(await fs.readFile(path.join(root, 'state/handoff.json')));
async function jobsSnapshot() {
  const records = {};
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(file); else records[path.relative(root, file)] = hash(await fs.readFile(file));
    }
  }
  await walk(path.join(root, 'library/jobs')); return records;
}
const jobsBefore = await jobsSnapshot();
try {
  await assert.rejects(lifecycle.start(root), /recovery_start_blocked/);
  await assert.rejects(lifecycle.start(root, { maintenance: true }), /recovery_start_blocked/);
  const parked = await read('C:/tmp/v006/evidence/source/recovery-source-state.json');
  const code = `import json,sys\nfrom pathlib import Path\nfrom scientific_reading.background_launcher import BackgroundLauncher\nfrom scientific_reading.background_models import BackgroundRequest\nfrom scientific_reading.worker import run_job\nroot=Path(sys.argv[1]); job=sys.argv[2]; calls=[]\ndef popen(*a,**k):\n calls.append('popen'); raise AssertionError('popen_must_not_be_called')\nlauncher=BackgroundLauncher(root,popen=popen); request=launcher.store.load_request(job); results=[]\nfor name,fn in [('launch_existing',lambda:launcher.launch_existing(job)),('enqueue_parent',lambda:launcher.enqueue(request)),('enqueue_unrelated',lambda:launcher.enqueue(BackgroundRequest(request.paper_id,'xlsx_snapshot','f'*64,{'data_root':str(root)}))),('worker_entry',lambda:run_job(launcher.store,job))]:\n try: fn(); results.append({'name':name,'allowed':True})\n except ValueError as e: results.append({'name':name,'error':str(e)})\nprint(json.dumps({'results':results,'popen':len(calls)}))`;
  const negative = spawnSync(installed.python, ['-I', '-X', 'utf8', '-c', code, path.join(root, 'library'), parked.parentJobId], { env: isolatedEnvironment(root, process.env, installed), encoding: 'utf8', windowsHide: true });
  assert.equal(negative.status, 0, negative.stderr); report.engineAdmission = JSON.parse(negative.stdout);
  assert.equal(report.engineAdmission.popen, 0); assert.ok(report.engineAdmission.results.every(r => r.error === 'instance_recovery_execution_blocked'));
  await fs.writeFile(patch, JSON.stringify([{ insert: [{ id: 'v006-counter', name: pathToFileURL(path.join(import.meta.dirname, 'fixtures/v02-006/counter.mjs')).href,
    config: { entry: installed.dsh, counter, jobId: normal.jobId, probe: true, childId: 'v006-pending-child' } }] }]));
  for (let index = 0; index < 2; index++) {
    const live = await api.startRecovery(root, gate.transactionId), calls = [];
    const rpc = async (method, payload) => {
      const result = await (await fetch(live.url + '/api/' + method, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'client-request', rpcId: randomUUID(), method, payload }) })).json();
      calls.push({ method, result }); return result;
    };
    for (const s of original.sessions) {
      if (s.meta.origin === 'subagent') continue; // Native parent-owned registry resume is exercised by the observer plugin.
      const created = await rpc('session.create', { sessionId: s.meta.id, workspaceId: gate.mapping.workspaceId, agentPreset: 'scientific-reading' });
      assert.equal(created.result?.ok, true, JSON.stringify(created));
    }
    const prompt = await rpc('session.prompt', { sessionId: normal.finalTask.sessionId, mode: 'queue', content: [{ type: 'text', text: 'V006 must not run' }] });
    assert.equal(prompt.result?.ok, false);
    const stopped = await lifecycle.stop(root);
    assert.deepEqual(stopped.hostExit, { code: 0, signal: null, forced: false });
    report.boots.push({ launchId: live.launchId, calls, stopped });
  }
  report.rows = (await fs.readFile(counter, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(report.rows.filter(r => ['model', 'tool', 'maintenance-executed'].includes(r.kind)).length, 0);
  const probes = report.rows.filter(r => r.kind === 'probe');
  assert.equal(probes.length, original.sessions.length * 2);
  for (const p of probes) { assert.deepEqual(p.before, p.after); assert.ok(p.attempts.every(a => a.error === 'instance_recovery_execution_blocked')); }
  const pending = probes.filter(p => p.sessionId === 'v006-pending-child');
  assert.equal(pending.length, 2); assert.equal(pending[0].before.turn.length, 1); assert.equal(pending[0].before.step.length, 1);
  assert.deepEqual(pending[0].before, pending[1].before);
  assert.equal(hash(await fs.readFile(path.join(root, 'state/handoff.json'))), handoffBefore);
  assert.deepEqual(await jobsSnapshot(), jobsBefore);
  report.jobsAndLaunchMarkersUnchanged = true;
  report.result = 'passed';
} catch (error) { report.result = 'failed'; report.error = error.stack; process.exitCode = 1; }
finally { await lifecycle.stop(root); await fs.writeFile(patch, originalPatch); }
await fs.writeFile('C:/tmp/v006/evidence/gate-probe-' + path.basename(root) + '.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ result: report.result, error: report.error }));
