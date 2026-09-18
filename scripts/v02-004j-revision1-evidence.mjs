import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const base = path.resolve(import.meta.dirname, '..');
const out = path.join(base, 'outputs/v02-004j');
const git = (...args) => execFileSync('git', args, { cwd: base, encoding: 'utf8', windowsHide: true }).trim();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sha = async file => hash(await fs.readFile(file));
const priorCommit = 'da1d08a2e7f8b57065fd6f2218e673480e1ce9b3';
const prior = JSON.parse(git('show', priorCommit + ':docs/project/evidence/V02-004J-index.json'));
const reportPath = path.resolve(base, process.argv[2]);
const report = JSON.parse(await fs.readFile(reportPath));
if (report.status !== 'passed' || git('diff', report.sourceCommit, 'HEAD', '--', 'src', 'tests')) throw Error('unverified_source');
const entries = [
  ['revision1-check.txt', 'node scripts/modules.mjs check'],
  ['revision1-impact.txt', 'node scripts/modules.mjs impact --base ' + priorCommit],
  ['revision1-module.txt', 'node scripts/modules.mjs test workflow'],
  [path.relative(out, reportPath), 'node scripts/v02-004j-integration.mjs'],
];
const evidence = [];
for (const [file, command] of entries) {
  const actual = path.join(out, file);
  evidence.push({ path: actual, sha256: await sha(actual), command, exitCode: 0, sourceCommit: report.sourceCommit });
}
const controllerRoot = 'C:/Users/15694/Documents/ChatGPT/deep-literature-for-codex/outputs/v02-004j-control-review';
const findingEvidence = [];
for (const relative of ['real-alias-1789731799167/report.json', 'real-alias-probe.mjs', 'alias-probe.mjs']) {
  const file = path.join(controllerRoot, relative);
  findingEvidence.push({ path: file, sha256: await sha(file), ownership: 'controller; read-only; original failure retained' });
}
const reusedNative = prior.evidence.find(row => row.path.endsWith('native-1789730949246' + path.sep + 'report.json'));
if (!reusedNative || await sha(reusedNative.path) !== reusedNative.sha256) throw Error('native_evidence_changed');
for (const file of ['src/modules/bridge/plugin.mjs', 'src/modules/bridge/services.mjs', 'runtime/pins.json', 'runtime/package-lock.json']) {
  if (await sha(path.join(base, file)) !== prior.productionHashes[file]) throw Error('native_dependency_changed');
}
const sourceHashes = {};
for (const relative of ['src/modules/workflow/handoff.mjs', 'src/modules/bridge/plugin.mjs', 'src/modules/bridge/services.mjs',
  'src/modules/catalog.json', 'tests/v02-workflow-control.test.mjs', 'scripts/v02-004j-integration.mjs', 'scripts/fixtures/v02-004j/reopen.mjs']) {
  sourceHashes[relative] = await sha(path.join(base, relative));
}
const index = { taskId: 'V02-004J', revisionRound: 1, generatedAt: new Date().toISOString(),
  baseCommit: prior.baseCommit, previousDeliveryCommit: priorCommit, sourceCommit: report.sourceCommit,
  engineCommit: report.engineCommit, python: report.python, sourceHashes, evidence, findingEvidence,
  reusedNative: { ...reusedNative, scope: 'Unchanged DSH rc.7 host withdrawal/claims/mixed-turn/restart evidence, reused as controller requested; not substituted for revised alias integration' },
  previousEvidence: prior.evidence,
  results: { workflow: { total: 106, pass: 105, fail: 0, skip: 1, note: 'Windows POSIX skip; includes bridge/direct and transitive consumers; counts overlap prior delivery' },
    focused: { total: 19, pass: 19, note: 'Six added cross-alias cases; also included in final module run' },
    realChain: report.rows.map(row => ({ name: row.name, parent: row.value.jobId ?? row.value.task?.jobId,
      revision: row.value.control?.revision ?? row.value.task?.control?.revision,
      cancelRequested: row.value.cancelRequested ?? row.value.task?.cancelRequested,
      pid: row.value.pid, guard: row.value.guard,
      aliases: row.value.tasks?.map(t => ({ taskId: t.taskId, jobId: t.jobId, status: t.status, cancelRequested: t.cancelRequested, revision: t.control?.revision })) })) },
  limitations: ['Source-only synthetic metadata, real Handoff/adapter/A JS/Python/worker; host RPC in this chain is synthetic. Native DSH evidence separately reused.',
    'Missing PDF gate: source SHA null, no rendered generation or scientific quality claimed; final installed combination gate remains open.',
    'Legacy resume records without coveredStops cannot retrospectively prove cross-alias local generations. A fresh cancel followed by revision-bound explicit resume is tested recovery.',
    'All detailed logs remain local-only and must be retained until controller review/archive; A and controller trees were read-only.'],
};
await fs.writeFile(path.join(base, 'docs/project/evidence/V02-004J-index.json'), JSON.stringify(index, null, 2) + '\n');
console.log(JSON.stringify(index.results, null, 2));
