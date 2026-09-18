import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const base = path.resolve(import.meta.dirname, '..');
const output = path.join(base, 'outputs/v02-004j');
const sha256 = async file => createHash('sha256').update(await fs.readFile(file)).digest('hex');
const integration = path.join(output, 'integration-1789730789872/report.json');
const native = path.join(output, 'native-1789730949246/report.json');
const chain = JSON.parse(await fs.readFile(integration)), host = JSON.parse(await fs.readFile(native));
if (chain.status !== 'passed' || host.status !== 'passed') throw Error('acceptance_failed');
const entries = [
  ['check-final.txt', 'node scripts/modules.mjs check', 0],
  ['impact-final.txt', 'node scripts/modules.mjs impact --base 36c27fb8b281faf4496ae6fade265e5f2d866555', 0],
  ['workflow-final.txt', 'node scripts/modules.mjs test workflow', 0],
  ['integration-1789730789872/report.json', 'node scripts/v02-004j-integration.mjs', 0],
  ['native-1789730949246/report.json', 'node scripts/v02-004j-native.mjs', 0],
  ['runtime/package-lock.json', 'node scripts/v02-004j-prepare.mjs (npm ci; 530 packages / 30m)', 0],
  ['directed.txt', 'node --test tests/handoff.test.mjs tests/v02-cancel-contract.test.mjs tests/v02-workflow-control.test.mjs tests/bridge.test.mjs tests/v02-control-adapter.test.mjs (pre-final 53 pass)', 0],
  ['workflow.txt', 'node scripts/modules.mjs test workflow (superseded; 2 process timeout failures)', 1],
  ['bridge-final.txt', 'node scripts/modules.mjs test bridge (superseded; process timeout; covered by successful final workflow consumer run)', 1],
  ['integration-1789729899936/report.json', 'node scripts/v02-004j-integration.mjs (verifier Reader path error)', 1],
  ['integration-1789730251466/report.json', 'node scripts/v02-004j-integration.mjs (transient engine read failure and unsafe probe dereference)', 1],
  ['diagnose.txt', 'node scripts/v02-004j-diagnose.mjs outputs/v02-004j/integration-1789730251466/instance', 0],
  ['native-1789730858726/report.json', 'node scripts/v02-004j-native.mjs (synthetic fixture transition rejected)', 1],
];
const evidence = [];
for (const [relative, command, exitCode] of entries) {
  const file = path.join(output, relative);
  evidence.push({ path: file, sha256: await sha256(file), command, exitCode,
    role: ['check-final.txt', 'impact-final.txt', 'workflow-final.txt', 'integration-1789730789872/report.json', 'native-1789730949246/report.json'].includes(relative)
      ? 'final acceptance' : 'preparation or preliminary/diagnostic evidence; not combined into final pass count',
    sourceCommit: relative === 'native-1789730949246/report.json' ? host.sourceCommit
      : ['check-final.txt', 'impact-final.txt', 'workflow-final.txt', 'integration-1789730789872/report.json'].includes(relative) ? chain.sourceCommit : null });
}
const productionHashes = {};
for (const relative of ['src/modules/workflow/handoff.mjs', 'src/modules/bridge/plugin.mjs', 'src/modules/bridge/services.mjs',
  'src/modules/catalog.json', 'tests/v02-workflow-control.test.mjs', 'runtime/pins.json', 'runtime/package-lock.json']) {
  productionHashes[relative] = await sha256(path.join(base, relative));
}
const git = (...args) => execFileSync('git', args, { cwd: base, encoding: 'utf8', windowsHide: true }).trim();
if (git('diff', chain.sourceCommit, 'HEAD', '--', 'src', 'tests')) throw Error('tested_production_changed');
const index = {
  taskId: 'V02-004J', generatedAt: new Date().toISOString(), locality: 'Detailed logs are local-only; retain until review and archive with final candidate',
  baseCommit: '36c27fb8b281faf4496ae6fade265e5f2d866555', productionCommit: '6d1bfd769a104413d3f416d130c1f19b19da5071',
  testedSourceCommit: chain.sourceCommit, nativeSourceCommit: host.sourceCommit,
  engineCommit: chain.engineCommit, python: chain.python, dsh: host.dsh, productionHashes, evidence,
  audit: { productionAndTestsUnchangedAcrossVerificationCommits: true,
    engineWorktreeCleanAtFinalAudit: true, ownedNodeAndPythonProcessesRemainingAtFinalAudit: 0,
    initialRuntimePreparation: 'npm ci --ignore-scripts --no-audit --no-fund in task outputs/runtime; default npm cache. Reproduction script now selects task-local cache.' },
  observations: {
    workflow: { total: 100, pass: 99, fail: 0, skip: 1, skipReason: 'POSIX socket test on Windows', bridgeConsumerTestsIncluded: true },
    chain: chain.rows.map(row => ({ name: row.name, pid: row.value.pid, parent: row.value.jobId ?? row.value.task?.jobId,
      controlRevision: row.value.control?.revision ?? row.value.task?.control?.revision, cancelRequested: row.value.cancelRequested ?? row.value.task?.cancelRequested })),
    host: host.observations.map(row => ({ name: row.name, hostCancellation: row.value.cancellation, controlRevision: row.value.control?.revision,
      aborted: row.value.aborted, status: row.value.status })),
    cleanup: host.boots.map(row => row.cleanup),
  },
  limitations: ['source-only, synthetic metadata and local LLM; no user installation, real library or real model',
    'Real chain reaches missing-PDF gate: source PDF SHA remains null; no rendered generation or scientific output is claimed',
    'Native dispatch gate is explicitly injected by test fixture through legal store transitions; actual Handoff, adapter, control, worker and DSH are not mocked',
    'Final combined installation/recovery acceptance remains required; unchanged Python full suite not rerun'],
};
await fs.writeFile(path.join(base, 'docs/project/evidence/V02-004J-index.json'), JSON.stringify(index, null, 2) + '\n');
console.log(JSON.stringify(index.observations, null, 2));
