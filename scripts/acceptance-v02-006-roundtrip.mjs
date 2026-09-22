import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const read = async f => JSON.parse((await fs.readFile(f, 'utf8')).replace(/^\uFEFF/, ''));
const candidate = process.argv[4] ?? 'r3';
const source = 'C:/tmp/v006/source', target = process.argv[3] ?? 'C:/tmp/v006/restored-' + candidate;
const installed = await read(path.join(source, 'installation.json'));
const api = await import(pathToFileURL(path.join(installed.app, 'src/modules/releases/index.mjs')).href);
const mode = process.argv[2];
let result;
try {
  if (mode === 'backup') result = await api.backupInstance(source, 'C:/tmp/v006/backup-' + candidate);
  else if (mode === 'restore') result = await api.restoreInstance(target, { archive: 'C:/tmp/v006/backup-' + candidate,
    packageRoot: 'C:/tmp/v006/candidate-' + candidate + '/verified-extraction/deep-literature-for-codex-0.2.0-dev.5-win-x64', runtimeCache: 'C:/tmp/v006/downloads' });
  else if (mode === 'validate') {
    const gate = await read(path.join(target, 'state/instance-recovery.json'));
    result = await api.validateRecovery(target, gate.transactionId);
  } else throw Error('unknown mode');
} catch (error) { result = { status: 'failed', error: error.stack }; process.exitCode = 1; }
await fs.writeFile('C:/tmp/v006/evidence/' + mode + '-' + path.basename(target) + '.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
