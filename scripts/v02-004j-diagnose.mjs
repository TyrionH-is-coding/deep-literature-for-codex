import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const a = 'C:/Users/15694/Documents/ChatGPT/deep-literature-engine-v02-004i';
const root = path.resolve(process.argv[2]);
process.env.PYTHONDONTWRITEBYTECODE = '1'; delete process.env.PYTHONPATH;
const data = JSON.parse(await fs.readFile(path.join(root, 'state/handoff.json')));
const task = Object.values(data.tasks)[0];
const scope = { instanceId: data.instanceId, scopeSessionId: task.sessionId, scopeFolderId: task.folderId };
const api = await import(pathToFileURL(path.join(a, 'lib/index.js')).href);
const config = { dataRoot: path.join(root, 'library'), enginePython: path.join(a, '.venv/Scripts/python.exe'), legalOnly: true };
for (const args of [['library-item-v2', '--paper-id', task.paperId], ['job-status', '--job-id', task.jobId], ['full-read-pipeline-control', '--job-id', task.jobId]]) {
  const startedAt = Date.now();
  console.log(JSON.stringify({ args, result: await api.withEngineScope(scope, () => api.engineJson(config, args)), elapsedMs: Date.now() - startedAt }));
}
