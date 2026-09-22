import path from 'node:path';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { root, out, read, action, gate, stop, save } from './fixtures/v02-006/common.mjs';
const fixture = await read(path.join(out, 'failure-figures-captions.json'));
let task = await gate(fixture.taskId);
for (let count = 0; task.job.detail.reason_code !== 'translate_full_read' && count < 3; count++) {
  const stopped = await action('cancel', { taskId: task.taskId });
  await action('resume', { taskId: task.taskId, idempotencyKey: 'v006-multigate-repair-' + stopped.control.revision,
    resumeStopped: true, expectedRevision: stopped.control.revision, input: {} });
  task = await gate(task.taskId);
}
assert.equal(task.job.detail.reason_code, 'translate_full_read');
const stopped = await action('cancel', { taskId: task.taskId });
assert.equal(stopped.control.stopRequested, true);
await stop(root);
await fs.rename(path.join(root, 'library/.mineru-venv'), 'C:/tmp/v006/parked-synthetic-parser-second');
await save('multigate-source', { ...fixture, finalTask: stopped, expectedRevision: stopped.control.revision });
console.log(JSON.stringify({ parent: stopped.jobId, revision: stopped.control.revision }));
