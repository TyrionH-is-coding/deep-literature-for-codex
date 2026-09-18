import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { engineAdapter } from '../src/bridge-services.mjs';

const a = path.resolve('C:/Users/15694/Documents/ChatGPT/deep-literature-engine-v02-004i');
const b = path.resolve(import.meta.dirname, '..');
const python = path.join(a, '.venv/Scripts/python.exe');
const output = path.join(b, 'docs/project/evidence/V02-004I-integration.json');
const root = path.join(b, 'outputs/v02-004i', process.argv[2] ?? 'integration');
delete process.env.PYTHONPATH;
const fixture = JSON.parse(execFileSync(python, [path.join(a, 'scripts/fixtures/v02-004i/parent.py'), root], { encoding: 'utf8', windowsHide: true }));
const api = await import(pathToFileURL(path.join(a, 'lib/index.js')).href);
assert.equal(typeof api.engineResumeStoppedFullRead, 'function');
const config = { dataRoot: root, enginePython: python, scansciPython: python, school: '', outputDir: '', legalOnly: true };
const engine = engineAdapter(api, config);
const rows = [];
const scope = fixture.scope;
const args = command => [command, '--job-id', fixture.job];
const call = async (name, command, input, actualScope = scope) => {
  const result = await engine(command, input, actualScope); rows.push({ name, args: command, result }); return result;
};
const reject = async (name, command, expected, actualScope = scope) => {
  await assert.rejects(async () => {
    try { await engine(command, {}, actualScope); }
    catch (error) { rows.push({ name, args: command, error: error.message }); throw error; }
  }, new RegExp(expected));
};
const stop = [...args('full-read-pipeline-stop'), '--request-id', 'stop', '--expected-revision', '0'];
const explicit = [...args('full-read-pipeline-resume'), '--resume-stopped', '--request-id', 'resume', '--expected-revision', '1'];
const initial = await call('read initial', args('full-read-pipeline-control'));
assert.equal(initial.revision, 0); assert.equal(initial.status, 'active');
const stopped = await call('stop', stop);
assert.equal(stopped.revision, 1); assert.equal(stopped.status, 'acknowledged');
assert.equal((await call('repeat stop', stop)).revision, 1);
const gate = await call('ordinary resume blocked', args('full-read-pipeline-resume'), {});
assert.equal(gate.stopRequested, true); assert.equal(gate.revision, 1);
const attached = await call('attach blocked before reading PDF', ['full-read-pdf-attach-resume', '--job-id', fixture.job,
  '--paper-id', fixture.paper, '--pdf', path.join(root, 'absent.pdf')]);
assert.equal(attached.stopRequested, true);
const rawGate = await api.withEngineScope(scope, () => api.engineJson(config, args('full-read-pipeline-resume'), {}));
assert.equal(rawGate.exitCode, 2); rows.push({ name: 'actual CLI exit 2', result: rawGate });
await reject('stale revision', [...args('full-read-pipeline-stop'), '--request-id', 'stale', '--expected-revision', '0'], 'reading_control_revision_conflict');
await reject('request collision', [...args('full-read-pipeline-stop'), '--request-id', 'stop', '--expected-revision', '1'], 'reading_control_request_conflict');
for (const command of [args('full-read-pipeline-control'), stop, explicit]) {
  await reject('cross paper', command, 'scope_paper_forbidden', { ...scope, scopePaperId: fixture.second });
  await reject('cross category', command, 'scope_changed', { ...scope, scopeFolderId: fixture.other });
}
const resumed = await call('explicit resume', explicit, {});
assert.equal(resumed.revision, 2); assert.equal(resumed.stopRequested, false);
assert.equal((await call('repeat explicit resume', explicit, {})).revision, 2);
let final;
for (let attempt = 0; attempt < 100; attempt++) {
  final = await engine(args('full-read-pipeline-control'), undefined, scope);
  if (final.businessStatus.state === 'waiting_user' && final.worker === null) break;
  await new Promise(resolve => setTimeout(resolve, 100));
}
assert.equal(final.businessStatus.state, 'waiting_user');
assert.equal(final.businessStatus.reason_code, 'pdf_required');
assert.equal(final.worker, null); assert.equal(final.pipelineState.parent_job_id, fixture.job);
rows.push({ name: 'real worker reached missing PDF gate and unregistered', result: final });
const modulePath = execFileSync(python, ['-c', 'import scientific_reading,sys; print(scientific_reading.__file__); print(sys.version)'], { encoding: 'utf8', windowsHide: true }).trim();
assert.ok(modulePath.includes(path.join(a, '.venv')));
const manifest = {};
for (const file of [path.join(a, 'src/cli.ts'), path.join(a, 'src/index.ts'), path.join(a, 'lib/cli.js'), path.join(a, 'lib/index.js'),
  path.join(b, 'src/modules/bridge/services.mjs'), path.join(b, 'scripts/v02-004i-integration.mjs')]) {
  manifest[file] = createHash('sha256').update(await fs.readFile(file)).digest('hex');
}
await fs.writeFile(output, JSON.stringify({ mode: 'actual source integration; no product installation or real provider',
  time: new Date().toISOString(), a, b, python, modulePath, fixture, manifest, rows,
  engineCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: a, encoding: 'utf8' }).trim(),
  bridgeCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: b, encoding: 'utf8' }).trim() }, null, 2) + '\n');
console.log(`PASS: ${rows.length} real cross-package observations, PDF gate, same parent and scope refusals. Evidence: ${output}`);
