import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const root = 'C:/tmp/v006/source';
const read = async f => JSON.parse((await fs.readFile(f, 'utf8')).replace(/^\uFEFF/, ''));
const installed = await read(path.join(root, 'installation.json'));
const api = await import(pathToFileURL(path.join(installed.app, 'src/modules/releases/index.mjs')).href);
const life = await import(pathToFileURL(path.join(installed.app, 'src/modules/lifecycle/index.mjs')).href);
const report = { installed, checks: [] };
let pending;
try {
  pending = api.backupInstance(root, 'C:/tmp/v006/backup-r4');
  pending.catch(() => {});
  const deadline = Date.now() + 10000;
  let gate;
  while (Date.now() < deadline) {
    gate = await read(path.join(root, 'state/instance-recovery.json')).catch(() => null);
    if (gate?.phase === 'backup') break;
    await new Promise(resolve => setTimeout(resolve, 1));
  }
  assert.equal(gate?.phase, 'backup'); report.observedGate = gate;
  const results = await Promise.allSettled([life.start(root), life.start(root, { maintenance: true }), api.backupInstance(root, 'C:/tmp/v006/backup-concurrent-refused-r4')]);
  for (const [index, result] of results.entries()) {
    assert.equal(result.status, 'rejected');
    assert.match(result.reason.message, /recovery_start_blocked|maintenance_in_progress/);
    report.checks.push({ action: ['ordinary-start', 'maintenance-start', 'parallel-backup'][index], error: result.reason.message });
  }
  report.backup = await pending;
  assert.equal(report.backup.status, 'completed');
  report.result = 'passed';
} catch (error) { report.result = 'failed'; report.error = error.stack; process.exitCode = 1; if (pending) await pending.catch(() => {}); }
await fs.writeFile('C:/tmp/v006/evidence/backup-concurrency-r4.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ result: report.result, error: report.error, backup: report.backup }));
