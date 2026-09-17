import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const start=JSON.parse(await fs.readFile('docs/project/evidence/V02-003C/ui-start.json','utf8'));const probe=JSON.parse(await fs.readFile('docs/project/evidence/V02-003C/locate.json','utf8'));
const id=probe.locate.paper_id;const response=await fetch(start.url+'/sr/api/paper/'+id);const value=await response.json();assert.equal(response.status,200);assert.equal(value.item.active_job_id,probe.worker.job_id);assert.ok(JSON.stringify(value.job).includes('xlsx_user_fields_conflict'));assert.ok(JSON.stringify(value.job).includes('user_notes'));
await fs.writeFile('docs/project/evidence/V02-003C/ui-paper-api.json',JSON.stringify({url:start.url+'/sr/api/paper/'+id,status:response.status,value},null,2));
