import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {root,out,installed,start,stop,status,action,py,read,poll,taskGate} from './fixtures/v02-004k/common.mjs';
const fixture=path.join(import.meta.dirname,'fixtures/v02-004k'),probe=(mode,...args)=>py(path.join(fixture,'stage.py'),root,mode,...args);
const report={startedAt:new Date().toISOString(),installed,mode:'installed trusted B HTTP -> installed A JS/CLI/default worker; synthetic PDF, parser and translation seed only',rows:[],boots:[]};
const record=(name,value)=>{report.rows.push({name,value});console.log('OBSERVED '+name);return value;};let held=false;
try{
 await stop(root);
 let reader,seed,boot,task,original,parent,before,alias,other,later,req;
 if(process.argv[2]){
  const prior=await read(process.argv[2]);report.continues=process.argv[2];report.priorRows=prior.rows;
  const v=name=>prior.rows.find(r=>r.name===name).value;
  reader=v('seed valid PDF, committed parse/translation/Reader and personal records');seed=v('prepare new source generation; preserve old committed assets');task=v('submit installed real worker');original=task.taskId;parent=task.jobId;before=v('running stage snapshot');alias=v('second alias shares parent');later=v('new alias while stopped binds parent');
  const handoff=await read(path.join(root,'state/handoff.json'));other=Object.values(handoff.tasks).find(t=>t.paperId===seed.other);
  boot=await start(root);report.boots.push(boot);task=await action('task',{taskId:original});
 }else{
 reader=record('seed valid PDF, committed parse/translation/Reader and personal records',py(path.join(fixture,'engine-probe.py'),root,'seed'));
 boot=await start(root);report.boots.push(boot);record('immediate API after first start',await action('tasks'));
 const httpReader=record('installed Reader HTTP assets',await action('reader',{paperId:reader.paper_id}));assert.equal(httpReader.sha256,reader.reader_sha256);
 seed=record('prepare new source generation; preserve old committed assets',probe('prepare'));
 req={folderId:seed.folder,paperId:seed.paper,idempotencyKey:'stage-original',runAgent:false};
 task=record('submit installed real worker',await action('submit',req));original=task.taskId;parent=task.jobId;
 await poll(()=>read(path.join(root,'v004k-stage/held.json')).catch(()=>null),Boolean);held=true;
 task=await action('task',{taskId:original});assert.equal(task.job.status,'running');
 before=record('running stage snapshot',probe('snapshot',parent));
 alias=record('second alias shares parent',await action('submit',{...req,idempotencyKey:'stage-alias'}));assert.equal(alias.jobId,parent);
 other=await action('submit',{...req,paperId:seed.other,idempotencyKey:'other-paper'});await taskGate(other.taskId);
 task=record('stop while real parser is active',await action('cancel',{taskId:original}));assert.equal(task.control.status,'requested');assert.equal(task.control.stopRequested,true);
 await action('cancel',{taskId:alias.taskId});task=await action('task',{taskId:original});assert.equal(task.control.revision,2);
 later=record('new alias while stopped binds parent',await action('submit',{...req,idempotencyKey:'alias-after-stop'}));assert.equal(later.jobId,parent);assert.equal(later.control.stopRequested,true);
 }
 await assert.rejects(action('resume',{taskId:later.taskId,idempotencyKey:'later-ordinary-resume',input:{}}),/reading_stop_requested/);
 for(const which of ['resume','attach'])await assert.rejects(action(which,{taskId:original,idempotencyKey:'ordinary-'+which,input:{},pdf:seed.source,sourceType:'manual'}),/reading_stop_requested/);
 await action('dispatch',{taskId:original,retryKey:'ordinary-retry'});await action('bind',{folderId:seed.folder});
 record('ordinary retry/resume/attach/category bind retain stop',await action('task',{taskId:original}));
 probe('release');held=false;
 task=await poll(()=>action('task',{taskId:original}),t=>t.control?.status==='acknowledged'&&t.control?.worker===null);
 record('current parse completes, acknowledgement blocks next stage',task);assert.equal(task.control.revision,2);assert.equal(task.control.stopRequested,true);
 const ack=record('acknowledged assets and state',probe('snapshot',parent));assert.equal(ack.pipeline.source_pdf_sha256,seed.source_sha256);assert.ok(ack.generation_path.endsWith(seed.source_sha256.slice(0,16)));assert.equal(ack.pipeline.current_stage,'translate_full');
 assert.equal(ack.pipeline.stage_timings.translate_full,undefined);
 const pointer=ack.library.reader_html??ack.library.reader_path;
 assert.ok(pointer);assert.ok(ack.protected_count>0);assert.equal(task.control.independentChildrenStopped,false);
 for(let cycle=1;cycle<=2;cycle++){
  await stop(root);assert.equal((await status(root)).status,'stopped');const previous=boot;boot=await start(root);report.boots.push(boot);assert.notEqual(boot.launchId,previous.launchId);assert.equal(boot.instanceId,previous.instanceId);
  record('immediate API after restart '+cycle,await action('tasks'));await action('bind',{folderId:seed.folder});await action('dispatch',{taskId:original,retryKey:'after-restart-'+cycle});
  for(const id of [original,alias.taskId,later.taskId]){const t=await action('task',{taskId:id});assert.equal(t.jobId,parent);assert.equal(t.control.status,'acknowledged');assert.equal(t.control.stopRequested,true);}
  const snap=record('restart '+cycle+' stopped state and asset protection',probe('snapshot',parent));assert.deepEqual(snap.pipeline,ack.pipeline);assert.equal(snap.library.reader_html??snap.library.reader_path,pointer);
  record('personal records after restart '+cycle,py(path.join(fixture,'engine-probe.py'),root,'read'));
  await assert.rejects(action('reader',{paperId:seed.paper}),/^(Error: )?(reader_publication_invalid|artifact_not_ready)$/);
 }
 const payload={taskId:alias.taskId,idempotencyKey:'explicit-resume',resumeStopped:true,expectedRevision:2,input:{}};
 record('explicit resume through second alias',await action('resume',payload));task=await taskGate(original);assert.equal(task.jobId,parent);assert.equal(task.control.stopRequested,false);assert.equal(task.control.revision,3);assert.equal(task.job.status,'waiting_agent');
 for(const id of [original,alias.taskId,later.taskId]){const t=await action('task',{taskId:id});assert.equal(Boolean(t.cancelRequested),false);assert.equal(t.control.stopRequested,false);}
 const resumed=record('same parent/generation reaches legal translation gate',probe('snapshot',parent));assert.equal(resumed.pipeline.source_pdf_sha256,seed.source_sha256);assert.equal(resumed.generation_path,ack.generation_path);
 for(const [file,digest] of Object.entries(ack.committed_assets))assert.equal(resumed.committed_assets[file],digest,file);
 task=await action('cancel',{taskId:original});assert.equal(task.control.revision,4);
 task=record('old resume key cannot override newer stop',await action('resume',payload));assert.equal(task.control.stopRequested,true);assert.equal(task.control.revision,4);
 await action('resume',{taskId:original,idempotencyKey:'resume-latest-with-translation',resumeStopped:true,expectedRevision:4,input:probe('translation-input',parent)});await taskGate(original);
 const unaffected=record('other paper remains unstopped',await action('task',{taskId:other.taskId}));assert.equal(unaffected.control.revision,0);assert.equal(unaffected.control.stopRequested,false);
 record('004D-O1 direct advance refuses lifecycle write',probe('direct-reject',parent));
 const excel=record('old Excel snapshot preserves newer SQLite notes',py(path.join(fixture,'engine-probe.py'),root,'conflict'));assert.equal(excel.newer_preserved,true);
 const fault=probe('fault-prepare');let ft=await action('submit',{folderId:fault.folder,paperId:fault.paper,idempotencyKey:'fault-parent',runAgent:false});ft=await taskGate(ft.taskId);assert.equal(ft.job.status,'failed');const fid=ft.taskId,fp=ft.jobId;
 record('synthetic external provider exit causes recoverable failure',ft);record('failed direct lifecycle write rejected',probe('direct-reject',fp));
 const failed=probe('snapshot',fp);await stop(root);boot=await start(root);report.boots.push(boot);ft=await action('task',{taskId:fid});assert.equal(ft.job.status,'failed');assert.equal(ft.jobId,fp);assert.deepEqual(probe('snapshot',fp).json_hashes,failed.json_hashes);
 await action('resume',{taskId:fid,idempotencyKey:'recover-provider-failure',input:{}});ft=await taskGate(fid);record('explicit continuation after provider interruption',ft);assert.equal(ft.jobId,fp);assert.equal(ft.job.status,'waiting_agent');
 report.status='passed';
}catch(e){report.status='failed';report.error=e.stack;process.exitCode=1;}
finally{if(held)try{probe('release');}catch{}await stop(root);report.finalStatus=await status(root);report.finishedAt=new Date().toISOString();const file=path.join(out,'control-'+Date.now()+'.json');await fs.writeFile(file,JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,error:report.error,file}));}
