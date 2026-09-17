import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Handoff } from '../src/modules/workflow/index.mjs';
import { cancelOwnedDispatch } from '../src/modules/bridge/index.mjs';

// Injected host/engine boundary tests, not native DSH or A end-to-end tests.
async function fixture(t) {
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'v4c-'));
 await fs.mkdir(path.join(root,'workspace'));
 t.after(async()=>{assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep+'v4c-'));await fs.rm(root,{recursive:true,force:true});});
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
test('queued receipt: repeat cancel preserves job; explicit retry key clears marker and creates only one new dispatch',async t=>{
 const {s,service,id}=await fixture(t);await service.dispatch(id);
 await service.cancel(id);await service.cancel(id);assert.equal(s.cancels,2);
 assert.equal((await service.dispatch(id)).dispatch.status,'not_needed');
 await service.dispatch(id,'retry');await service.dispatch(id,'retry');
 assert.equal(s.prompts,2);assert.equal((await service.task(id)).cancelRequested,false);assert.equal(s.starts,1);
});
test('detached engine status is independent; completed artifacts remain visible after cancel (injected)',async t=>{
 const {s,service,id}=await fixture(t);s.status='running';await service.cancel(id);
 s.status='completed';const task=await service.task(id);
 assert.equal(task.status,'completed');assert.equal(task.cancelRequested,true);assert.equal(task.artifacts.sha256,'synthetic-artifact');assert.equal(s.resumes,0);
});
test('fresh successful resume clears cancellation; failed resume leaves request set',async t=>{
 const {s,service,id}=await fixture(t);await service.cancel(id);s.failResume=true;
 await assert.rejects(service.operate(id,'failure','resume',{input:{}}),/resume_lost/);
 assert.equal((await service.task(id)).cancelRequested,true);s.failResume=false;
 await service.operate(id,'new','resume',{input:{}});
 assert.equal((await service.task(id)).cancelRequested,false);
});
test('replaying an already completed resume operation after cancellation does not reopen it',async t=>{
 const {s,service,id}=await fixture(t);await service.operate(id,'old','resume',{input:{}});await service.cancel(id);
 const replay=await service.operate(id,'old','resume',{input:{}});
 assert.equal(replay.cancelRequested,true);assert.equal(s.resumes,1);
});
test('host failure before persistence loses cancellation intent after reopen: current gap',async t=>{
 const {root,deps,s,service,id}=await fixture(t);s.failCancel=true;
 await assert.rejects(service.cancel(id),/host_unavailable/);
 const restored=await Handoff.open(root,deps);await restored.dispatch(id);
 assert.equal((await restored.task(id)).cancelRequested,undefined);assert.equal(s.prompts,1);
});
test('shared turn only removes owned queues; exclusive current claim requests host cancel with keepInbox',()=>{
 const removed=[],calls=[];const task={dispatches:{one:{rpcId:'ours'}}};
 const agent={status:'running',inbox:{nextTurn:[{id:'a',source:{kind:'user',rpcId:'ours'}},{id:'b',source:{kind:'user',rpcId:'other'}}],nextStep:[],remove:id=>removed.push(id)},cancel:(...x)=>calls.push(x),session:{events:[{type:'turn/start',data:{turn:1}}]}};
 assert.equal(cancelOwnedDispatch(agent,task,{turn:1,rpcIds:new Set(['ours','other'])}).turn,'not_targeted');
 assert.deepEqual(removed,['a']);assert.equal(calls.length,0);
 assert.equal(cancelOwnedDispatch(agent,task,{turn:1,rpcIds:new Set(['ours'])}).turn,'cancel_requested');
 assert.deepEqual(calls,[[{kind:'user'},{keepInbox:true}]]);
});
