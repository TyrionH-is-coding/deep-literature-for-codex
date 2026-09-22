import path from 'node:path';
import assert from 'node:assert/strict';
import {root,read,save,py,engine,action,start,stop,status} from './fixtures/v02-005/common.mjs';
const fixture=path.join(import.meta.dirname,'fixtures/v02-005');
const normal=await read('C:/tmp/v005/evidence/normal-formula-outline.json');
const report={startedAt:new Date().toISOString(),paperId:normal.paperId,taskId:normal.taskId};
try {
 report.xlsxDiff=py(path.join(fixture,'inspect-records.py'),'xlsx-diff');
 report.import=engine('xlsx-import-user-fields');assert.equal(report.import.status,'success');
 report.refresh=engine('xlsx-refresh');assert.equal(report.refresh.status,'success');
 report.recordsBefore=py(path.join(fixture,'inspect-records.py'),'records');
 report.before=await action('task',{taskId:normal.taskId});
 report.bootBefore=await status(root);
 report.stop=await stop(root);assert.equal((await status(root)).status,'stopped');
 report.bootAfter=await start(root);assert.notEqual(report.bootBefore.launchId,report.bootAfter.launchId);assert.equal(report.bootBefore.instanceId,report.bootAfter.instanceId);
 report.after=await action('task',{taskId:normal.taskId});
 report.reader=await action('reader',{paperId:normal.paperId});
 assert.equal(report.after.jobId,normal.jobId);assert.equal(report.after.status,'completed');
 assert.equal(report.reader.sha256,normal.reader.sha256);assert.equal(report.reader.sourcePdfSha256,normal.sourceSha256);
 report.recordsAfter=py(path.join(fixture,'inspect-records.py'),'records');
 assert.deepEqual(report.recordsBefore,report.recordsAfter);
 report.result='passed';
}catch(e){report.result='failed';report.error=e.stack;process.exitCode=1;}
report.finishedAt=new Date().toISOString();await save('records-restart',report);console.log(JSON.stringify(report,null,2));
