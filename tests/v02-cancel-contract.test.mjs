import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Handoff } from '../src/modules/workflow/index.mjs';
import { cancelOwnedDispatch } from '../src/modules/bridge/index.mjs';

// Injected host/engine boundary tests, not native DSH or A end-to-end tests.
async function fixture(t) {
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'v02-004e-'));
 await fs.mkdir(path.join(root,'workspace'));
 t.after(async()=>{assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep+'v02-004e-'));await fs.rm(root,{recursive:true,force:true});});
 const s={status:'waiting_agent',prompts:0,cancels:0,resumes:0,starts:0,failCancel:false,failResume:false};
 const deps={instance:{instanceId:'synthetic-004c'},
 engine:async(args)=>{switch(args[0]){
 case 'folder-list':return [{folder_id:'f',name:'synthetic'}];
 case 'library-item-v2':return {paper_id:'p',folder_id:'f'};
 case 'full-read-pipeline-start':s.starts++;return {parent_job_id:'job_1234567890abcdef'};
 case 'job-status':return {paper_id:'p',job_id:'job_1234567890abcdef',status:s.status,detail:{reason_code:'translate_full_read',required_input:{batch:s.batch??1}}};
 case 'full-read-pipeline-resume':s.resumes++;if(s.failResume)throw Error('resume_lost');s.status='running';return {};
 default:throw Error(args[0]);}},
 rpc:async(method,payload)=>{if(method==='workspace.create')return {workspace:{workspaceId:'w',path:payload.path}};if(method==='session.prompt'){s.prompts++;return {accepted:true}};return {};},
 dispatchEvidence:async()=> 'canceled',reader:async()=>({sha256:'synthetic-artifact',readerUrl:'/synthetic'}),
 cancelTask:async()=>{s.cancels++;if(s.failCancel)throw Error('host_unavailable');return {turn:'not_targeted',removedQueued:0}}};
 const service=await Handoff.open(root,deps);
 const request={folderId:'f',paperId:'p',idempotencyKey:'same',runAgent:false};
 const task=await service.submit(request);
 return {root,deps,s,service,request,id:task.taskId};
}
test('not yet dispatched: cancel persists across reopen and suppresses submit/default dispatch/new gate',async t=>{
 const {root,deps,s,service,request,id}=await fixture(t);
 assert.equal((await service.cancel(id)).status,'cancel_requested');
 const restored=await Handoff.open(root,deps);s.batch=2;
 await restored.submit({...request,runAgent:true});
 assert.equal((await restored.dispatch(id)).dispatch.status,'not_needed');
 assert.equal((await restored.list()).tasks[0].cancelRequested,true);
 assert.equal(s.prompts,0);assert.equal(s.starts,1);
});
test('queued receipt: repeat cancel preserves job; retry key cannot clear stop intent',async t=>{
 const {s,service,id}=await fixture(t);await service.dispatch(id);
 await service.cancel(id);await service.cancel(id);assert.equal(s.cancels,2);
 assert.equal((await service.dispatch(id)).dispatch.status,'not_needed');
 await service.dispatch(id,'retry');await service.dispatch(id,'retry');
 assert.equal(s.prompts,1);assert.equal((await service.task(id)).cancelRequested,true);assert.equal(s.starts,1);
});
test('detached engine status is independent; completed artifacts remain visible after cancel (injected)',async t=>{
 const {s,service,id}=await fixture(t);s.status='running';await service.cancel(id);
 s.status='completed';const task=await service.task(id);
 assert.equal(task.status,'completed');assert.equal(task.cancelRequested,true);assert.equal(task.artifacts.sha256,'synthetic-artifact');assert.equal(s.resumes,0);
});
test('ordinary resume cannot clear cancellation even when engine is available',async t=>{
 const {s,service,id}=await fixture(t);await service.cancel(id);s.failResume=true;
 await assert.rejects(service.operate(id,'failure','resume',{input:{}}),/reading_stop_requested/);
 assert.equal((await service.task(id)).cancelRequested,true);s.failResume=false;
 await assert.rejects(service.operate(id,'new','resume',{input:{}}),/reading_stop_requested/);
 assert.equal((await service.task(id)).cancelRequested,true);assert.equal(s.resumes,0);
});
test('replaying an already completed resume operation after cancellation does not reopen it',async t=>{
 const {s,service,id}=await fixture(t);await service.operate(id,'old','resume',{input:{}});await service.cancel(id);
 const replay=await service.operate(id,'old','resume',{input:{}});
 assert.equal(replay.cancelRequested,true);assert.equal(s.resumes,1);
});
test('host failure preserves cancellation intent after reopen and suppresses default delivery',async t=>{
 const {root,deps,s,service,id}=await fixture(t);s.failCancel=true;
 await assert.rejects(service.cancel(id),/host_unavailable/);
 const restored=await Handoff.open(root,deps);await restored.dispatch(id);
 assert.equal((await restored.task(id)).cancelRequested,true);assert.equal(s.prompts,0);
});
test('shared turn only removes owned queues; exclusive current claim requests host cancel with keepInbox',()=>{
 const removed=[],calls=[];const task={dispatches:{one:{rpcId:'ours'}}};
 const agent={status:'running',inbox:{nextTurn:[{id:'a',source:{kind:'user',rpcId:'ours'}},{id:'b',source:{kind:'user',rpcId:'other'}}],nextStep:[],remove:id=>removed.push(id)},cancel:(...x)=>calls.push(x),session:{events:[{type:'turn/start',data:{turn:1}}]}};
 assert.equal(cancelOwnedDispatch(agent,task,{turn:1,rpcIds:new Set(['ours','other'])}).turn,'not_targeted');
 assert.deepEqual(removed,['a']);assert.equal(calls.length,0);
 assert.equal(cancelOwnedDispatch(agent,task,{turn:1,rpcIds:new Set(['ours'])}).turn,'cancel_requested');
 assert.deepEqual(calls,[[{kind:'user'},{keepInbox:true}]]);
});

// 004E fault regressions use synthetic data and the real atomic JSON writer.
test('cancel intent is on disk before host call; failure propagates unchanged without a false receipt', async t => {
 const {root,s,service,id,request}=await fixture(t);
 const failure=new Error('synthetic_host_failure');
 service.cancelTask=async task=>{
  s.cancels++;
  const disk=JSON.parse(await fs.readFile(path.join(root,'state','handoff.json'),'utf8'));
  assert.equal(Object.values(disk.tasks).find(x=>x.taskId===task.taskId).cancelRequested,true);
  throw failure;
 };
 await assert.rejects(service.cancel(id),error=>error===failure);
 assert.equal((await service.task(id)).status,'cancel_requested');
 assert.equal((await service.list()).tasks[0].cancelRequested,true);
 await service.submit({...request,runAgent:true});
 assert.equal((await service.dispatch(id)).dispatch.status,'not_needed');
 assert.equal(s.prompts,0);
 const raw=await fs.readFile(service.file,'utf8');
 assert.equal(Object.values(JSON.parse(raw).tasks)[0].hostCancellation.error,'synthetic_host_failure');
 assert.equal(Object.values(JSON.parse(raw).tasks)[0].cancellation,undefined);
});

test('atomic rename failure prevents host side effects; retry must save even when marker is already in memory', async t => {
 const {root,s,service,id}=await fixture(t);
 const file=service.file, before=await fs.readFile(file,'utf8');
 const blocked=path.join(root,'blocked-destination');await fs.mkdir(blocked);
 service.file=blocked;
 await assert.rejects(service.cancel(id));
 await assert.rejects(service.cancel(id));
 assert.equal(s.cancels,0);
 assert.equal(await fs.readFile(file,'utf8'),before);
 assert.deepEqual((await fs.readdir(root)).filter(x=>x.endsWith('.tmp')),[]);
 service.file=file;
 await service.cancel(id);assert.equal(s.cancels,1);
 assert.equal(Object.values(JSON.parse(await fs.readFile(file,'utf8')).tasks)[0].cancelRequested,true);
});

test('failed repeated cancel retains last real receipt and can retry host again', async t => {
 const {s,service,id}=await fixture(t);
 const first=await service.cancel(id);s.failCancel=true;
 await assert.rejects(service.cancel(id),/host_unavailable/);
 const failed=await service.task(id);
 assert.deepEqual(failed.cancellation,first.cancellation);
 assert.equal(failed.cancelRequested,true);assert.equal(s.cancels,2);
 s.failCancel=false;await service.cancel(id);assert.equal(s.cancels,3);
});

test('host failure intent survives independent read-only Node process and service reopen/retry process', async t => {
 const {root,s,service,id}=await fixture(t);s.failCancel=true;
 await assert.rejects(service.cancel(id),/host_unavailable/);
 const probe=fileURLToPath(new URL('../scripts/fixtures/v02-004e/reopen.mjs',import.meta.url));
 const before=await fs.readFile(service.file,'utf8');
 const read=JSON.parse(execFileSync(process.execPath,[probe,'read',root,id],{encoding:'utf8',windowsHide:true,timeout:60000}));
 assert.equal(read.cancelRequested,true);assert.notEqual(read.pid,process.pid);
 assert.equal(await fs.readFile(service.file,'utf8'),before);
 const reopened=JSON.parse(execFileSync(process.execPath,[probe,'reopen',root,id],{encoding:'utf8',windowsHide:true,timeout:60000}));
 assert.equal(reopened.cancelRequested,true);assert.equal(reopened.cancels,2);
 assert.equal(reopened.prompts,0);assert.notEqual(reopened.pid,read.pid);
});

test('host failure keeps real terminal states and submitted Reader artifacts', async t => {
 for(const status of ['completed','failed','running']) {
  const {s,service,id}=await fixture(t);s.status=status;s.failCancel=true;
  await assert.rejects(service.cancel(id),/host_unavailable/);
  const task=await service.task(id);
  assert.equal(task.job.status,status);assert.equal(task.cancelRequested,true);
  assert.equal(task.status,status==='running'?'cancel_requested':status);
  if(status==='completed')assert.equal(task.artifacts.sha256,'synthetic-artifact');
 }
});

test('fresh attach cannot clear intent; replaying an earlier completed attach preserves later cancellation', async t => {
 const {root,s,service,id}=await fixture(t);
 const engine=service.engine;let attaches=0;
 service.engine=async (...args)=>{
  if(args[0][0]==='full-read-pdf-attach-resume'){attaches++;return {};}
  return engine(...args);
 };
 const pdf=path.join(root,'synthetic.pdf');await fs.writeFile(pdf,'%PDF-1.4 synthetic');
 const payload={sourceType:'manual',pdf};
 await service.operate(id,'attach-new','attach',payload);
 s.failCancel=true;
 await assert.rejects(service.cancel(id),/host_unavailable/);
 await assert.rejects(service.operate(id,'attach-fresh','attach',payload),/reading_stop_requested/);
 const replay=await service.operate(id,'attach-new','attach',payload);
 assert.equal(replay.cancelRequested,true);assert.equal(attaches,1);
});
