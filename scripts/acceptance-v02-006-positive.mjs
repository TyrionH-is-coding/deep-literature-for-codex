import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { root, out, installed, read, start, stop, save } from './fixtures/v02-006/common.mjs';
const normal = await read(path.join(out, 'normal-formula-outline.json'));
const patch = path.join(root, 'state/dsh-home/profiles/workbench/cordis.patch.yml');
const original = await fs.readFile(patch);
const counter = path.join(out, 'native-positive-counter.jsonl');
const report = { synthetic: 'offline model adapter with actual DSH tool runtime', counter, calls: [] };
await stop(root);
try {
  await fs.writeFile(patch, JSON.stringify([{ insert: [{ id: 'v006-counter', name: pathToFileURL(path.join(import.meta.dirname, 'fixtures/v02-006/counter.mjs')).href,
    config: { entry: installed.dsh, counter, jobId: normal.jobId } }] }]));
  const live = await start(root);
  const rpc = async (method, payload) => {
    const result = await (await fetch(live.url + '/api/' + method, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId: randomUUID(), method, payload }) })).json();
    report.calls.push({ method, result }); assert.equal(result.result?.ok, true, JSON.stringify(result)); return result.result.value;
  };
  await rpc('session.selectModel', { sessionId: normal.finalTask.sessionId, provider: 'v006-local', model: 'counter' });
  await rpc('session.prompt', { sessionId: normal.finalTask.sessionId, mode: 'queue', content: [{ type: 'text', text: 'V006 synthetic positive control: inspect the existing completed job.' }] });
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const rows = (await fs.readFile(counter, 'utf8')).trim().split('\n').map(JSON.parse);
    if (rows.filter(r => r.kind === 'model').length >= 2 && rows.some(r => r.kind === 'tool')) { report.counters = rows; break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(report.counters, 'positive model/tool control did not execute');
  report.history = await rpc('session.history', { sessionId: normal.finalTask.sessionId, maxMessages: 10000 });
  report.result = 'passed';
} catch (error) { report.result = 'failed'; report.error = error.stack; process.exitCode = 1; }
finally { await stop(root); await fs.writeFile(patch, original); await save('native-positive', report); }
console.log(JSON.stringify({ result: report.result, error: report.error, counters: report.counters }));
