// Explicit synthetic root required. Runs installed code; no product patching.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import http from 'node:http';
import assert from 'node:assert/strict';
const root = await fs.realpath(process.argv[2]);
assert.equal(await fs.readFile(path.join(root, '.v02-004d-test-instance'), 'utf8'), 'synthetic-only');
const output = path.resolve(process.argv[3]);
const failureControl = process.argv[4] === '--failure-control';
const here = path.dirname(fileURLToPath(import.meta.url));
const read = async p => JSON.parse(await fs.readFile(p, 'utf8'));
const installed = await read(path.join(root, 'installation.json'));
const marker = await read(path.join(root, '.workbench.json'));
assert.equal(marker.root, root);
assert.equal(installed.pins.plugin.sha256, 'a2e9e629140688df3fce947c4118e32157326a7e0a75c3d7952f6a67b413ba44');
assert.equal(installed.pins.dsh, '0.1.0-rc.7');
assert.equal(installed.pins.node.version, '22.22.2');
const from = f => import(pathToFileURL(path.join(installed.app, 'src', f)));
const {start,stop,status} = await from('control.mjs');
const {isolatedEnvironment} = await from('core.mjs');
const {call} = await from('client.mjs');
const {dshRpc} = await from('bridge-services.mjs');
const report = {root, failureControl, instance:marker, appSha256:installed.appSha256, pins:installed.pins, startedAt:new Date().toISOString(), commands:[], checks:[]};
async function check(name, fn) {
  try { const value=await fn(); report.checks.push({name,status:'passed',value}); console.log('PASS '+name); return value; }
  catch(e) { report.checks.push({name,status:'failed',error:e.stack}); console.log('FAIL '+name+': '+e.message); }
}
async function run(command,args) {
  let stdout='',stderr='';
  const code=await new Promise((resolve,reject)=>{
    const p=spawn(command,args,{cwd:root,env:isolatedEnvironment(root,process.env,installed),windowsHide:true,stdio:['ignore','pipe','pipe']});
    p.stdout.on('data',b=>stdout+=b); p.stderr.on('data',b=>stderr+=b); p.once('error',reject); p.once('close',resolve);
  });
  report.commands.push({command,args,code,stdout,stderr}); assert.equal(code,0,stderr); return stdout;
}
const probe = async mode => JSON.parse(await run(installed.python,['-I','-X','utf8',path.join(here,'fixtures','v02-004d','engine-probe.py'),root,mode]));
const invoke=async(action,payload={})=>(await call(root,{action,payload})).value;
const patch=path.join(root,'state','dsh-home','profiles','workbench','cordis.patch.yml');
const original=await fs.readFile(patch);
const sentinel=http.createServer((_req,res)=>res.end('v02-owned-sentinel'));
await new Promise(r=>sentinel.listen(0,'127.0.0.1',r));
const sentinelUrl=`http://127.0.0.1:${sentinel.address().port}`;
let running, info;
try {
  await check('runtime versions',async()=>({node:await run(installed.node,['--version']),python:await run(installed.python,['-I','--version'])}));
  await stop(root);
  info=await check('local PDF + parser fixture + translation fixture → real Reader; Excel save',()=>probe('seed'));
  await fs.writeFile(patch,JSON.stringify([{insert:[{id:'v02-local-model',name:pathToFileURL(path.join(here,'fixtures','local-model.mjs')).href,config:{dshEntry:installed.dsh}}]}]));
  running=await check('real host start and identity',async()=>{const s=await start(root); const id=await fetch(s.url+'/__workbench/identity').then(r=>r.json()); assert.equal(id.instanceId,marker.instanceId); return s;});
  if (running) {
    if(!failureControl) {
      await check('repeated start reuses launch',async()=>{const second=await start(root); assert.equal(second.launchId,running.launchId); return second;});
      await check('engine library HTTP route',async()=>{const r=await fetch(running.url+'/sr/api/library'); assert.ok(r.ok); return {status:r.status};});
      if(info) await check('Reader HTTP bytes match engine manifest',async()=>{const r=await invoke('reader',{paperId:info.paper_id}); assert.equal(r.sha256,info.reader_sha256); return r;});
    }
    await check('local model executes native tool; native session and handoff persisted',async()=>{
      const folder=await invoke('folder_create',{name:'V02 synthetic category '+Date.now()});
      if(info) await invoke('move',{paperId:info.paper_id,folderId:folder.folder_id});
      const binding=await invoke('bind',{folderId:folder.folder_id});
      await dshRpc(running.url,'session.selectModel',{sessionId:binding.sessionId,provider:'acceptance-local',model:'scope-smoke'});
      await dshRpc(running.url,'session.prompt',{sessionId:binding.sessionId,mode:'queue',content:[{type:'text',text:'Synthetic V02 local tool round'}]});
      let history;
      for(let i=0;i<60;i++) {
        history=await dshRpc(running.url,'session.history',{sessionId:binding.sessionId,maxMessages:100});
        if(JSON.stringify(history).includes('ACCEPTANCE_LOCAL_TOOL_LOOP_OK')) {report.sessionId=binding.sessionId; return {binding,events:history.events.length};}
        await new Promise(r=>setTimeout(r,500));
      }
      throw new Error('local model tool round incomplete');
    });
    for(let cycle=1;cycle<=(failureControl?0:2);cycle++) await check(`restart ${cycle}: identity, notes, Reader, native history`,async()=>{
      assert.ok(info,'seed failed; records and Reader are unverified');
      const prev=running; await stop(root); assert.equal((await status(root)).status,'stopped');
      assert.equal(await fetch(sentinelUrl).then(r=>r.text()),'v02-owned-sentinel');
      running=await start(root); assert.equal(running.instanceId,prev.instanceId); assert.notEqual(running.launchId,prev.launchId);
      const records=info?await probe('read'):null;
      if(info) assert.equal((await invoke('reader',{paperId:info.paper_id})).sha256,info.reader_sha256);
      if(report.sessionId) assert.ok(JSON.stringify(await dshRpc(running.url,'session.history',{sessionId:report.sessionId,maxMessages:100})).includes('ACCEPTANCE_LOCAL_TOOL_LOOP_OK'));
      return {running,records};
    });
  } else report.checks.push({name:'repeat start / two restarts / HTTP Reader / local model',status:'unverified',reason:'real host startup failed'});
  await stop(root);
  if(info) {
    await check('old Excel vs newer SQLite preservation',async()=>{const v=await probe('conflict'); report.conflict=v; assert.ok(v.newer_preserved,JSON.stringify(v)); return v;});
    await check('library backup and actual empty-directory restore',async()=>{const v=await probe('backup'); report.backup=v; return v;});
    const handoff=path.join(root,'state','handoff.json');
    report.handoffExists=await fs.stat(handoff).then(()=>true,()=>false);
    report.nativeSessionCreated=Boolean(report.sessionId);
    report.checks.push({name:'whole instance recovery includes native sessions and handoff',status:'known_gap',reason:'library backup scope excludes state/dsh-home and state/handoff.json; library-only restore is not whole-instance restore'});
  }
} finally {
  await check('final stop leaves owned sentinel alive',async()=>{await stop(root); const s=await status(root); assert.equal(s.status,'stopped'); assert.equal(await fetch(sentinelUrl).then(r=>r.text()),'v02-owned-sentinel'); return s;});
  await fs.writeFile(patch,original);
  await new Promise(r=>sentinel.close(r));
  report.completedAt=new Date().toISOString();
  await fs.mkdir(path.dirname(output),{recursive:true});
  await fs.writeFile(output,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report.checks,null,2));
  process.exitCode=report.checks.some(c=>!['passed','known_gap'].includes(c.status))?1:0;
}

