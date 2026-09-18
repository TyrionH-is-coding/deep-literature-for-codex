import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Handoff } from '../../../src/modules/workflow/index.mjs';
import { engineAdapter } from '../../../src/modules/bridge/index.mjs';
const [root, a, id] = process.argv.slice(2);
const api = await import(pathToFileURL(path.join(a, 'lib/index.js')).href);
const engine = engineAdapter(api, { dataRoot: path.join(root, 'library'), enginePython: path.join(a, '.venv/Scripts/python.exe'),
  scansciPython: path.join(a, '.venv/Scripts/python.exe'), legalOnly: true, school: '', outputDir: '' });
let effects = 0;
const instance = JSON.parse(await fs.readFile(path.join(root, '.workbench.json')));
const service = await Handoff.open(root, { instance, engine,
  rpc: async () => { effects++; throw Error('unexpected_dispatch'); }, cancelTask: async () => { effects++; throw Error('unexpected_host_cancel'); } });
const task = await service.task(id);
await service.dispatch(id, 'ordinary-retry');
let guard;
try { service.guardAdvance(task.sessionId, 'sr_continue_full_read', { job_id: task.jobId }); guard = 'allowed'; }
catch (error) { guard = error.message; }
console.log(JSON.stringify({ pid: process.pid, task, tasks: (await service.list()).tasks, guard, effects }));
