import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=await fs.realpath(process.argv[2]),out=path.resolve(process.argv[3]);
assert.equal(await fs.readFile(path.join(root,'.v02-003c-test-instance'),'utf8'),'synthetic-only');
const read=async f=>JSON.parse(await fs.readFile(f,'utf8')),installed=await read(path.join(root,'installation.json'));
const {start,stop,status}=await import(pathToFileURL(path.join(installed.app,'src/control.mjs')));
const {isolatedEnvironment}=await import(pathToFileURL(path.join(installed.app,'src/core.mjs')));
const report={root,startedAt:new Date().toISOString(),checks:[],commands:[]};
async function check(name,fn){try{const value=await fn();report.checks.push({name,status:'passed',value});console.log('PASS '+name);return value;}catch(e){report.checks.push({name,status:'failed',error:e.stack});console.log('FAIL '+name+': '+e.message);}}
function probe(mode){const args=['-I','-X','utf8',path.join(import.meta.dirname,'fixtures/v02-003c/conflict-probe.py'),root,mode];const r=spawnSync(installed.python,args,{cwd:root,env:isolatedEnvironment(root,process.env,installed),encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024});report.commands.push({command:installed.python,args,code:r.status,stdout:r.stdout,stderr:r.stderr});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);}
let running;
try{
 await stop(root);
 await check('installed CLI seven conflict/legacy/three-field cases',()=>probe('cases'));
 const info=await check('prepare live two-row conflict',()=>probe('live-seed'));
 if(info){
  let previous;
  for(let cycle=0;cycle<3;cycle++){
   await check(`worker retry ${cycle}: waiting_user, exact field and paper, atomic batch`,()=>probe('live-check'));
   running=await check(`host start ${cycle}`,async()=>{const r=await start(root);if(previous){assert.equal(r.instanceId,previous.instanceId);assert.notEqual(r.launchId,previous.launchId);}return r;});
   if(running){
    await check(`HTTP job details after restart ${cycle}`,async()=>{const response=await fetch(running.url+'/sr/api/job/'+encodeURIComponent(info.job_id));const value=await response.json();assert.equal(response.status,200);assert.ok(JSON.stringify(value).includes('xlsx_user_fields_conflict'));assert.ok(JSON.stringify(value).includes(info.paper_id));assert.ok(JSON.stringify(value).includes('user_notes'));return value;});
    await check(`UI status API after restart ${cycle}`,async()=>{const response=await fetch(running.url+'/sr/api/settings/status');const value=await response.json();assert.equal(response.status,200);assert.equal(value.library.papers,2);assert.equal(path.resolve(value.library.data_root),path.join(root,'library'));return value;});
    previous=running;await stop(root);assert.equal((await status(root)).status,'stopped');
   }
  }
 }
}finally{await stop(root);report.finalStatus=await status(root);report.completedAt=new Date().toISOString();await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(report,null,2));process.exitCode=report.checks.some(c=>c.status!=='passed')?1:0;}
