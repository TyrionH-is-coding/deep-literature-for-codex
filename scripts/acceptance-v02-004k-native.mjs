import fs from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';import {randomUUID} from 'node:crypto';import assert from 'node:assert/strict';
import {root,out,installed,start,stop,status,action,py,read,poll,taskGate} from './fixtures/v02-004k/common.mjs';
const fixture=path.join(import.meta.dirname,'fixtures/v02-004k'),patch=path.join(root,'state/dsh-home/profiles/workbench/cordis.patch.yml'),original=await fs.readFile(patch),report={startedAt:new Date().toISOString(),mode:'installed native DSH/B/A; synthetic local LLM and explicitly injected agent gate',rows:[],boots:[]};let url;
const record=(name,value)=>{report.rows.push({name,value});return value;};
async function json(route,body){const r=await fetch(url+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(120000)});const v=await r.json();assert.ok(r.ok,JSON.stringify(v));return v;}
const rpc=async(method,payload,rpcId=randomUUID())=>{const v=await json('/api/'+method,{type:'client-request',method,payload,rpcId});assert.equal(v.result?.ok,true,JSON.stringify(v));return v.result.value;};
const probe=(sessionId,action='state',rpcIds)=>json('/v4j-probe',{sessionId,action,rpcIds});
const waitFor=(sessionId,predicate)=>poll(()=>probe(sessionId),predicate);
const prompt=(sessionId,id)=>rpc('session.prompt',{sessionId,mode:'queue',content:[{type:'text',text:'SYNTHETIC '+id}]},id);
try{
 await stop(root);const seed=py(path.join(fixture,'stage.py'),root,'native-seed');
 const overrides=['credentials','llm-pi-ai','llm-deepseek','session-title-llm','web-search-deepseek','skill-filesystem','hmr'].map(id=>({id,disabled:true}));
 overrides.push({id:'agent-default-model',config:{provider:'v4j-local',model:'synthetic'}},{insert:[{id:'v004k-local-probe',name:pathToFileURL(path.join(fixture,'host-probe.mjs')).href,config:{entry:installed.dsh}}]});
 // Existing installed profile/module resolution remains intact; only external synthetic LLM/observer is inserted.
 await fs.writeFile(patch,JSON.stringify(overrides));let boot=await start(root);report.boots.push(boot);url=boot.url;
 async function prepare(paperId,key){let t=await action('submit',{folderId:seed.folder,paperId,idempotencyKey:key,runAgent:false});t=await taskGate(t.taskId);assert.equal(t.job.detail.reason_code,'pdf_required');record('synthetic gate injection',py(path.join(fixture,'agent-gate.py'),path.join(root,'library'),t.jobId));return action('task',{taskId:t.taskId});}
 const one=await prepare(seed.papers[0],'queue-one'),other=await prepare(seed.papers[1],'queue-other');
 await prompt(one.sessionId,'manual-blocker');await waitFor(one.sessionId,s=>s.calls===1);
 const queued=await action('dispatch',{taskId:one.taskId}),ownedRpc=queued.dispatch.rpcId;await prompt(one.sessionId,'unrelated-queue');
 const canceled=record('trusted cancel removes only target queue',await action('cancel',{taskId:one.taskId}));assert.equal(canceled.cancellation.removedQueued,1);assert.equal(canceled.cancellation.turn,'not_targeted');assert.equal(canceled.control.independentChildrenStopped,false);
 const guard=record('installed category continuation guard',await json('/v4j-probe',{sessionId:one.sessionId,action:'advance',jobId:one.jobId}));assert.equal(guard.toolResult.isError,true);assert.match(JSON.stringify(guard.toolResult),/reading_stop_requested/);assert.equal((await action('task',{taskId:one.taskId})).control.stopRequested,true);
 let state=record('unrelated active turn and queue survive',await probe(one.sessionId));assert.equal(state.aborted,0);assert.ok(state.queue.includes('unrelated-queue'));assert.ok(!state.queue.includes(ownedRpc));
 await probe(one.sessionId,'release');await waitFor(one.sessionId,s=>s.calls===2);await probe(one.sessionId,'release');await waitFor(one.sessionId,s=>s.status!=='running');
 await action('dispatch',{taskId:other.taskId});await waitFor(one.sessionId,s=>s.calls===3);
 const exclusive=record('exclusive active turn cancellation request',await action('cancel',{taskId:other.taskId}));assert.equal(exclusive.cancellation.turn,'cancel_requested');await waitFor(one.sessionId,s=>s.aborted===1);
 await prompt(one.sessionId,'mixed-blocker');await waitFor(one.sessionId,s=>s.calls===4);await probe(one.sessionId,'stage-shared',[ownedRpc,'mixed-other']);await probe(one.sessionId,'release');
 await waitFor(one.sessionId,s=>s.events.some(e=>e.type==='user/message'&&e.data.source?.rpcId==='mixed-other'));
 const mixed=record('mixed turn is not canceled',await action('cancel',{taskId:one.taskId}));assert.equal(mixed.cancellation.turn,'not_targeted');state=await probe(one.sessionId);assert.equal(state.status,'running');assert.equal(state.aborted,1);record('mixed active stream survives',state);
 await probe(one.sessionId,'release');await waitFor(one.sessionId,s=>s.status!=='running');
 for(let n=0;n<2;n++){await stop(root);const prev=boot;boot=await start(root);report.boots.push(boot);url=boot.url;assert.notEqual(boot.launchId,prev.launchId);await action('bind',{folderId:seed.folder});await action('dispatch',{taskId:one.taskId,retryKey:'restart-'+n});const reopened=record('restart '+(n+1)+' no redispatch',await action('task',{taskId:one.taskId}));assert.equal(reopened.control.stopRequested,true);assert.equal((await probe(one.sessionId)).calls,0);}
 report.status='passed';
}catch(e){report.status='failed';report.error=e.stack;process.exitCode=1;}
finally{await stop(root);await fs.writeFile(patch,original);report.finalStatus=await status(root);report.finishedAt=new Date().toISOString();const file=path.join(out,'native-'+Date.now()+'.json');await fs.writeFile(file,JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,error:report.error,file}));}
