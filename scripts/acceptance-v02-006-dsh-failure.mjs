import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const read = async f => JSON.parse((await fs.readFile(f, 'utf8')).replace(/^\uFEFF/, ''));
const source = 'C:/tmp/v006/source', neighbor = 'C:/tmp/v006/restored-r4', root = 'C:/tmp/v006/dsh-failed-r4';
const installed = await read(path.join(source, 'installation.json'));
const api = await import(pathToFileURL(path.join(installed.app, 'src/modules/releases/index.mjs')).href);
const life = await import(pathToFileURL(path.join(installed.app, 'src/modules/lifecycle/index.mjs')).href);
const fingerprint = async r => {
  const result = {};
  async function walk(dir) {
    for (const item of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) await walk(file);
      else result[path.relative(r, file)] = createHash('sha256').update(await fs.readFile(file)).digest('hex');
    }
  }
  await walk(path.join(r, 'library'));
  result.handoff = createHash('sha256').update(await fs.readFile(path.join(r, 'state/handoff.json'))).digest('hex');
  return result;
};
const report = { root, fault: 'create a destination workspace collision only after the real library import completes' };
const before = { source: await fingerprint(source), neighbor: await fingerprint(neighbor) };
try {
  const result = api.restoreInstance(root, { archive: 'C:/tmp/v006/backup-r4',
    packageRoot: 'C:/tmp/v006/candidate-r4/verified-extraction/deep-literature-for-codex-0.2.0-dev.5-win-x64', runtimeCache: 'C:/tmp/v006/downloads' });
  let ended = false; const settled = result.then(value => ({ value }), error => ({ error: error.message })).finally(() => { ended = true; });
  const until = Date.now() + 900000;
  while (!ended && Date.now() < until) {
    const state = await read(path.join(root, 'state/instance-recovery.json')).catch(() => null);
    if (state?.steps?.includes('library')) {
      report.afterLibrary = state;
      const file = path.join(root, 'state/dsh-home/storages/workspace.json');
      await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, '{"v006Fault":"destination collision"}', { flag: 'wx' });
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  report.settled = await settled; assert.ok(report.afterLibrary);
  assert.match(report.settled.error, /EEXIST/);
  report.final = await read(path.join(root, 'state/instance-recovery.json'));
  assert.equal(report.final.phase, 'failed'); assert.deepEqual(report.final.steps, ['library']);
  assert.ok(await fs.stat(path.join(root, 'library/library.sqlite')));
  for (const options of [{}, { maintenance: true, recoveryId: report.final.transactionId }]) await assert.rejects(life.start(root, options), /recovery_start_blocked/);
  await assert.rejects(api.abortBackup(root, report.final.transactionId), /abort_invalid/);
  assert.deepEqual(await fingerprint(source), before.source); assert.deepEqual(await fingerprint(neighbor), before.neighbor);
  report.isolation = { sourceUnchanged: true, validNeighborUnchanged: true, failedTargetBlocked: true }; report.result = 'passed';
} catch (error) { report.result = 'failed'; report.error = error.stack; process.exitCode = 1; }
await fs.writeFile('C:/tmp/v006/evidence/dsh-import-failure-r4.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ result: report.result, error: report.error }));
