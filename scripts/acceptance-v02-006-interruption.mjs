import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const read = async f => JSON.parse((await fs.readFile(f, 'utf8')).replace(/^\uFEFF/, ''));
const installed = await read('C:/tmp/v006/source/installation.json');
const api = await import(pathToFileURL(path.join(installed.app, 'src/modules/releases/index.mjs')).href);
const lifecycle = await import(pathToFileURL(path.join(installed.app, 'src/modules/lifecycle/index.mjs')).href);
const root = 'C:/tmp/v006/interrupted-r4', cache = 'C:/tmp/v006/interruption-cache-r4';
if (process.argv[2] === 'child') {
  await api.restoreInstance(root, { archive: 'C:/tmp/v006/backup-r4', packageRoot: 'C:/tmp/v006/candidate-r4/verified-extraction/deep-literature-for-codex-0.2.0-dev.5-win-x64', runtimeCache: cache });
} else {
  const report = { root, method: 'terminate the owned restore process after its preparing marker, during bounded cache read and before installer spawn' };
  try {
    await fs.mkdir(cache);
    const file = await fs.open(path.join(cache, 'node-22.22.2.zip'), 'wx'); await file.truncate(64 * 1024 * 1024); await file.close();
    const child = spawn(installed.node, [process.argv[1], 'child'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', b => { output += b; }); child.stderr.on('data', b => { output += b; });
    const exit = new Promise(resolve => child.once('close', (code, signal) => resolve({ code, signal })));
    const deadline = Date.now() + 10000;
    let marker;
    while (Date.now() < deadline) {
      marker = await read(path.join(root, 'state/instance-recovery.json')).catch(() => null);
      if (marker?.phase === 'preparing') { child.kill(); break; }
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    if (!marker) child.kill();
    report.exit = await exit; report.output = output;
    report.marker = await read(path.join(root, 'state/instance-recovery.json'));
    assert.equal(report.marker.phase, 'preparing');
    assert.equal(await fs.stat(path.join(root, '.install.lock')).then(() => true, () => false), false);
    assert.equal(await fs.stat(path.join(root, 'installation.json')).then(() => true, () => false), false);
    for (const options of [{}, { maintenance: true }, { maintenance: true, recoveryId: report.marker.transactionId }]) await assert.rejects(lifecycle.start(root, options), /recovery_start_blocked/);
    await assert.rejects(api.restoreInstance(root, { archive: 'C:/tmp/v006/backup-r4' }), /target_exists/);
    await assert.rejects(api.abortBackup(root, report.marker.transactionId), /abort_invalid/);
    report.result = 'passed';
  } catch (error) { report.result = 'failed'; report.error = error.stack; process.exitCode = 1; }
  await fs.writeFile('C:/tmp/v006/evidence/interruption-r4.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ result: report.result, error: report.error }));
}
