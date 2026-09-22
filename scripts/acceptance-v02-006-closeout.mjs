import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const base = 'C:/tmp/v006';
const read = async f => JSON.parse((await fs.readFile(f, 'utf8')).replace(/^\uFEFF/, ''));
const exists = async f => fs.stat(f).then(() => true, e => { if (e.code === 'ENOENT') return false; throw e; });
const report = { instances: [], result: 'passed' };
for (const entry of await fs.readdir(base, { withFileTypes: true })) {
  const root = path.join(base, entry.name);
  if (!entry.isDirectory() || !await exists(path.join(root, 'installation.json'))) continue;
  const installed = await read(path.join(root, 'installation.json'));
  const lifecycle = await import(pathToFileURL(path.join(installed.app, 'src/modules/lifecycle/index.mjs')).href);
  const before = await lifecycle.status(root);
  assert.equal(before.status, 'stopped', JSON.stringify(before));
  const patchFile = path.join(root, 'state/dsh-home/profiles/workbench/cordis.patch.yml');
  const patch = (await fs.readFile(patchFile, 'utf8')).trim();
  assert.equal(patch, '[]', root);
  const site = path.join(path.dirname(path.dirname(installed.python)), 'Lib/site-packages');
  for (const name of ['v006_derived_fault.pth', 'v006_derived_fault.py']) assert.equal(await exists(path.join(site, name)), false);
  const gate = await read(path.join(root, 'state/instance-recovery.json')).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
  report.instances.push({ root, instanceId: installed.instanceId ?? (await read(path.join(root, '.workbench.json'))).instanceId,
    status: before.status, appSha256: installed.appSha256, patch, faultHookAbsent: true, phase: gate?.phase ?? null });
}
await fs.writeFile(path.join(base, 'evidence/closeout-r4.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
