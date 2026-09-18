import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {spawnSync} from 'node:child_process';
const root=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]);
assert.equal(await fs.readFile(path.join(root,'.v02-004d-test-instance'),'utf8'),'synthetic-only');
const i=JSON.parse(await fs.readFile(path.join(root,'installation.json'),'utf8'));
const {start,stop,status}=await import(pathToFileURL(path.join(i.app,'src/control.mjs')));
const {isolatedEnvironment}=await import(pathToFileURL(path.join(i.app,'src/core.mjs')));
const evidence={root,startedAt:new Date().toISOString(),checks:[],commands:[]};
function probe(mode){const args=['-I','-X','utf8',path.join(import.meta.dirname,'fixtures/v02-004d/restart-failure.py'),root,mode,path.join(import.meta.dirname,'fixtures/v02-004d/process-probe.py')];const r=spawnSync(i.python,args,{env:isolatedEnvironment(root,process.env,i),windowsHide:true,encoding:'utf8'});evidence.commands.push({python:i.python,args,code:r.status,stdout:r.stdout,stderr:r.stderr});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);}
try{
await stop(root);evidence.seed=probe('seed');let previous;
for(let cycle=0;cycle<3;cycle++){
 const s=await start(root);if(previous){assert.equal(s.instanceId,previous.instanceId);assert.notEqual(s.launchId,previous.launchId);}
 const id=await fetch(s.url+'/__workbench/identity').then(r=>r.json());assert.equal(id.instanceId,s.instanceId);
 evidence.checks.push({cycle,launch:s,identity:id,failed:probe('read')});
 previous=s;await stop(root);assert.equal((await status(root)).status,'stopped');
}
evidence.explicitResume=probe('resume');
}finally{await stop(root);evidence.finalStatus=await status(root);await fs.writeFile(out,JSON.stringify(evidence,null,2));}
