import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {root,out,installed,read,start,stop,status,action,gate,py,engine,save} from './fixtures/v02-006/common.mjs';
const fixture=path.join(import.meta.dirname,'fixtures/v02-006');
const mode=process.argv[2]??'normal';
const caseName=process.argv[3]??'formula-outline';
const payload=await read(path.join(fixture,caseName+'.json'));
const report={startedAt:new Date().toISOString(),mode,caseName,installed,synthetic:['source PDF','external parser','translations','review'],rows:[]};
const record=async(name,value)=>{report.rows.push({name,value});await save(mode+'-'+caseName,report);console.log(name+' '+JSON.stringify(value).slice(0,350));return value;};
try {
 let task;
 if(process.argv[4]==='continue') {
  const prior=await read(path.join(out,mode+'-'+caseName+'.json'));
  await save(mode+'-'+caseName+'-prior-'+Date.now(),prior);
  Object.assign(report,{rows:prior.rows,folderId:prior.folderId,paperId:prior.paperId,taskId:prior.taskId,jobId:prior.jobId,sourceSha256:prior.sourceSha256});
  report.boot=await start(root);task=await gate(report.taskId);
 } else {
 if(mode==='normal' && caseName==='formula-outline') await record('prepare synthetic inputs',py(path.join(fixture,'prepare.py'),root));
 report.boot=await start(root);
 const folder=await record('create category',await action('folder_create',{name:'V02-006 synthetic '+mode+' '+caseName}));
 report.folderId=folder.folder_id;
 await record('bind category',await action('bind',{folderId:report.folderId}));
 const metadata=mode==='failure'?{...payload.metadata,title:payload.metadata.title+' - V02-006 provider failure'}:payload.metadata;
 const ingested=await record('ingest',await action('ingest',{metadata}));
 report.paperId=ingested.paper_id;
 await record('move',await action('move',{paperId:report.paperId,folderId:report.folderId}));
 const providerPayload=structuredClone(payload);
 providerPayload.content_items[0].text=metadata.title;
 await fs.writeFile(path.join(root,'v006-provider',caseName+'.json'),JSON.stringify(providerPayload));
 await fs.writeFile(path.join(root,'v006-provider/mode.json'),JSON.stringify({case:caseName,fail_once:mode==='failure'}));
 task=await action('submit',{folderId:report.folderId,paperId:report.paperId,idempotencyKey:'v006-'+mode+'-'+caseName,runAgent:false});
 report.taskId=task.taskId;report.jobId=task.jobId;
 task=await record('missing PDF gate',await gate(task.taskId));
 assert.equal(task.job.detail.reason_code,'pdf_required');
 const pdf=path.join(root,'v006-provider',caseName+'.pdf');
 report.sourceSha256=createHash('sha256').update(await fs.readFile(pdf)).digest('hex');
 await record('attach PDF',await action('attach',{taskId:task.taskId,idempotencyKey:'v006-attach-'+mode+'-'+caseName,pdf,sourceType:'manual'}));
 task=await record('after installed default worker parse',await gate(task.taskId));
 }
 if(mode==='failure') {
  const failedParent=task.jobId;
  if(task.job.status==='failed') {
  const canceled=await record('cancel after provider failure',await action('cancel',{taskId:task.taskId}));
  // A failed business job keeps its terminal label, even after stop is acknowledged.
  assert.equal(canceled.control.status,'terminal');
  assert.equal(canceled.control.businessStatus.state,'failed');
  assert.equal(canceled.control.stopRequested,true);
  assert.equal(canceled.control.acknowledgedRevision,canceled.control.revision);
  assert.equal(canceled.control.worker,null);
  await record('explicit resumeStopped',await action('resume',{taskId:task.taskId,idempotencyKey:'v006-explicit-safe-recovery-r'+canceled.control.revision,resumeStopped:true,expectedRevision:canceled.control.revision,input:{}}));
  task=await record('same parent reaches legal translation gate',await gate(task.taskId));
  }
  assert.equal(task.jobId,failedParent);assert.equal(task.job.status,'waiting_agent');assert.equal(task.job.detail.reason_code,'translate_full_read');
  assert.equal(task.control.stopRequested,false);
  assert.equal(task.control.pipelineState.source_pdf_sha256,report.sourceSha256);
  report.result='passed-to-legal-gate';
 } else {
  let n=0;
  while(task.job.status==='waiting_agent') {
   assert.ok(n++<10,'unexpected gate loop');
   const detail=task.job.detail;
   const required=detail.required_input ?? detail.required_action ?? detail;
   let input;
   if(detail.reason_code==='translate_full_read') {
    const source=await read(required.source_manifest_path);
    const translations=new Map(payload.translations.map(t=>[t.block_id,t]));
    input={full_translation:{contract_version:'full-translation-v3',batch_id:source.batch_id,source_sha256:source.source_sha256,translations:source.blocks.map(b=>({block_id:b.block_id,source_text:b.english,translation_zh:translations.get(b.block_id).translation_zh,highlight:translations.get(b.block_id).highlight}))}};
   } else if(detail.reason_code==='review_full_read') input={full_review:payload.review};
   else throw Error('unexpected gate '+JSON.stringify(detail));
   await record('submit synthetic '+detail.reason_code,await action('resume',{taskId:task.taskId,idempotencyKey:'v006-'+caseName+'-v3-gate-'+n,input}));
   task=await record('gate result '+n,await gate(task.taskId));
  }
  assert.equal(task.status,'completed');assert.equal(task.jobId,report.jobId);
  report.reader=await record('official Reader verification',await action('reader',{paperId:report.paperId}));
  report.item=await record('library item',await action('item',{paperId:report.paperId}));
  report.result='passed';
 }
 report.finalTask=task;
} catch(e) {report.result='failed';report.error=e.stack;process.exitCode=1;console.error(e);}
report.finishedAt=new Date().toISOString();await save(mode+'-'+caseName,report);
console.log(JSON.stringify({result:report.result,file:path.join(out,mode+'-'+caseName+'.json'),boot:report.boot}));
