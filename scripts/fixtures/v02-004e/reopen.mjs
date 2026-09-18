import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Handoff } from '../../../src/modules/workflow/index.mjs';

const [mode, root, id] = process.argv.slice(2);
const data = JSON.parse(await fs.readFile(path.join(root, 'state', 'handoff.json'), 'utf8'));
const task = Object.values(data.tasks).find(task => task.taskId === id);
assert.equal(data.instanceId, 'synthetic-004c');
assert.equal(task.cancelRequested, true);
assert.equal(task.cancellation, undefined);
let cancels = 0, prompts = 0;
if (mode === 'reopen') {
 const service = await Handoff.open(root, {
  instance: { instanceId: data.instanceId },
  engine: async args => {
   if (args[0] === 'library-item-v2') return { paper_id: task.paperId, folder_id: task.folderId };
   if (args[0] === 'job-status') return { paper_id: task.paperId, job_id: task.jobId, status: 'waiting_agent', detail: {reason_code:'translate_full_read',required_input:{batch:2}} };
   throw Error('unexpected engine call');
  },
  rpc: async () => { prompts++; throw Error('unexpected RPC'); },
  cancelTask: async () => { if (++cancels === 1) throw Error('host_still_unavailable'); return {turn:'not_targeted',removedQueued:0}; }
 });
 assert.equal((await service.task(id)).status, 'cancel_requested');
 assert.equal((await service.list()).tasks[0].cancelRequested, true);
 await service.submit({folderId:task.folderId,paperId:task.paperId,idempotencyKey:'same'});
 assert.equal((await service.dispatch(id)).dispatch.status, 'not_needed');
 await assert.rejects(service.cancel(id), /host_still_unavailable/);
 assert.equal((await service.task(id)).cancellation, undefined);
 assert.equal((await service.cancel(id)).cancelRequested, true);
 assert.equal(prompts, 0);
} else assert.equal(mode, 'read');
console.log(JSON.stringify({pid:process.pid,mode,cancelRequested:task.cancelRequested,cancels,prompts}));
