import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base=path.resolve(import.meta.dirname,'..');
const run=await fs.mkdtemp(path.join(base,'.local/v02-006b-'));
const ev=path.join(base,'docs/project/evidence/V02-006B-raw',path.basename(run));await fs.mkdir(ev,{recursive:true});
const entry=path.join(base,'.local/runtime/node_modules/@deepseek-ai/dsh/lib/bin.js');
const report={time:new Date().toISOString(),run,node:process.version,baseCommit:'bde3ee1d79d527fb11c15eda6f46b5522483f02e',commands:[],checks:[],boots:[]};
const sha=b=>createHash('sha256').update(b).digest('hex');
const save=()=>fs.writeFile(path.join(ev,'probe.json'),JSON.stringify(report,null,2));
async function command(args){const child=spawn(process.execPath,args,{cwd:base,windowsHide:true});let text='';child.stdout.on('data',b=>text+=b);child.stderr.on('data',b=>text+=b);const code=await new Promise(r=>child.on('close',r));report.commands.push({args,code,output:text});if(code!==0)throw Error(text);}
const worker=path.join(base,'scripts/fixtures/v02-006b/storage-worker.mjs');
const source=path.join(run,'source'),target=path.join(run,'新 target');
let host;
async function stop(){if(!host)return;if(host.exitCode===null&&host.signalCode===null){const closed=new Promise(r=>host.once('close',r));host.kill();await closed;}report.boots.at(-1).stopped=true;host=null;}
async function boot(root){
 const home=path.join(root,'home'),profile=path.join(home,'profiles/web');await fs.mkdir(profile,{recursive:true});
 const counter=path.join(root,'counter.jsonl');
 const patch=['credentials','llm-pi-ai','llm-deepseek','session-title-llm','web-search-deepseek','skill-filesystem','hmr'].map(id=>({id,disabled:true}));
 patch.push({id:'agent-default-model',config:{provider:'v02-local',model:'canary'}},{insert:[{id:'v02-canary',name:pathToFileURL(path.join(base,'scripts/fixtures/v02-006b/canary-plugin.mjs')).href,config:{entry,counter}}]});
 await fs.writeFile(path.join(profile,'cordis.patch.yml'),JSON.stringify(patch));
 const env={};for(const k of ['SystemRoot','WINDIR','PATH','PATHEXT','TEMP','TMP'])if(process.env[k])env[k]=process.env[k];
 Object.assign(env,{DSH_HOME:home,DSH_CWD:path.join(root,'workspace'),HOME:root,USERPROFILE:root,NO_PROXY:'*'});
 host=spawn(process.execPath,[entry,'--profile','web','--host','127.0.0.1','--port','0'],{cwd:path.join(root,'workspace'),env,windowsHide:true});
 const b={root,pid:host.pid,stopped:false,log:''};report.boots.push(b);
 host.stdout.on('data',x=>b.log+=x);host.stderr.on('data',x=>b.log+=x);
 for(let i=0;i<150;i++){const match=b.log.match(/http:\/\/127\.0\.0\.1:\d+/);if(match){b.url=match[0];return b.url;}if(host.exitCode!==null)throw Error(b.log);await new Promise(r=>setTimeout(r,200));}throw Error('host ready timeout '+b.log);
}
async function rpc(url,method,payload){const res=await fetch(url+'/api/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:randomUUID(),method,payload}),signal:AbortSignal.timeout(10000)});const json=await res.json();report.commands.push({method,payload,response:json});if(!json.result?.ok)throw Error(JSON.stringify(json));return json.result.value;}
try{
 report.scriptSha256={};for(const rel of ['scripts/v02-006b-probe.mjs','scripts/fixtures/v02-006b/storage-worker.mjs','scripts/fixtures/v02-006b/canary-plugin.mjs','runtime/package-lock.json'])report.scriptSha256[rel]=sha(await fs.readFile(path.join(base,rel)));report.nodeSha256=sha(await fs.readFile(process.execPath));
 await command([worker,'seed',source,path.join(ev,'source.json')]);
 const sourceUrl=await boot(source);
 const sourceWorkspace=await rpc(sourceUrl,'workspace.list',{});
 const sourceId=sourceWorkspace.items[0].workspaceId;
 await rpc(sourceUrl,'workspace.rename',{workspaceId:sourceId,title:'合成分类'});
 await rpc(sourceUrl,'workspace.archiveSession',{sessionId:'v02-006b-child',archived:true});
 const exp=await fetch(sourceUrl+'/api/session.export?sessionId=v02-006b-parent&includeDescendants=true');assert.equal(exp.status,200);const zip=Buffer.from(await exp.arrayBuffer());await fs.writeFile(path.join(ev,'native-export.zip'),zip);
 const require=createRequire(path.join(base,'.local/runtime/package.json'));const {unzipSync}=require('fflate');const entries=unzipSync(zip);report.nativeExport={sha256:createHash('sha256').update(zip).digest('hex'),entries:Object.keys(entries)};for(const [name,bytes]of Object.entries(entries)){assert.ok(!Buffer.from(bytes).includes(Buffer.from('SYNTHETIC_CREDENTIAL_CANARY')));await fs.writeFile(path.join(ev,'export-'+name.replaceAll('/','-')),bytes);}
 await stop();
 const sourceSnapshot={};const original=JSON.parse(await fs.readFile(path.join(ev,'source.json')));for(const item of original.sessions)sourceSnapshot[item.location.path]=sha(await fs.readFile(item.location.path));for(const file of ['storages/workspace.json','.credentials.yaml','settings.yaml']){const abs=path.join(source,'home',file);sourceSnapshot[abs]=sha(await fs.readFile(abs));}
 const ws=JSON.parse(await fs.readFile(path.join(source,'home/storages/workspace.json'),'utf8'));
 await fs.writeFile(path.join(ev,'source-workspace.json'),JSON.stringify(ws,null,2));
 await command([worker,'adapt',target,path.join(ev,'target-offline.json'),path.join(ev,'source.json')]);
 const newId=randomUUID(),oldId=ws.global.workspaceIds[0];
 assert.equal(ws.unit.version,2);assert.equal(ws.global.pendingMutation,undefined);
 ws.global.workspaceIds=[newId];ws.tables.workspaces={[newId]:{...ws.tables.workspaces[oldId],path:await fs.realpath(path.join(target,'workspace'))}};
 await fs.mkdir(path.join(target,'home/storages'),{recursive:true});await fs.writeFile(path.join(target,'home/storages/workspace.json'),JSON.stringify(ws,null,2));
 report.workspaceMapping={sourceId:oldId,targetId:newId};
 const a=JSON.parse(await fs.readFile(path.join(ev,'source.json'))),b=JSON.parse(await fs.readFile(path.join(ev,'target-offline.json')));
 for(const x of a.sessions){const y=b.sessions.find(y=>y.stored.meta.id===x.stored.meta.id);assert.deepEqual(x.stored.events,y.stored.events);assert.deepEqual(x.queue,y.queue);assert.equal(x.stored.meta.parentSession,y.stored.meta.parentSession);assert.notEqual(x.stored.meta.cwd,y.stored.meta.cwd);}
 const contaminated=structuredClone(a);contaminated.sessions[0].stored.events.find(e=>e.type==='user/message').data.content[0].text='SYNTHETIC_CREDENTIAL_CANARY';
 await fs.writeFile(path.join(ev,'secret-history-input.json'),JSON.stringify(contaminated,null,2));
 let refused=false;try{await command([worker,'adapt',path.join(run,'secret-refusal'),path.join(ev,'unexpected.json'),path.join(ev,'secret-history-input.json')]);}catch(e){refused=e.message.includes('known secret canary');}assert.ok(refused);report.checks.push({name:'known free-text canary causes explicit refusal',pass:true});
 report.checks.push({name:'offline exact event/order/id/parent/queues preserved',pass:true});
 for(let restart=0;restart<2;restart++){
  const url=await boot(target);
  await new Promise(r=>setTimeout(r,1500));
  const visible=await rpc(url,'workspace.list',{});assert.equal(visible.items[0].workspaceId,newId);assert.equal(visible.items[0].title,'合成分类');assert.deepEqual(visible.items[0].sessionIds,ws.tables.workspaces[newId].sessionIds);assert.deepEqual(visible.archivedSessionIds,ws.global.archivedSessionIds);
  await rpc(url,'session.list',{});
  for(const item of a.sessions){const history=await rpc(url,'session.history',{sessionId:item.stored.meta.id,maxMessages:100});assert.ok(history.events.length>0);for(const event of item.stored.events){const found=history.events.find(e=>(e.event??e).seq===event.seq);assert.deepEqual(found?.event??found,event);}}
  await rpc(url,'session.selectModel',{sessionId:'v02-006b-parent',provider:'v02-local',model:'canary'});
  await new Promise(r=>setTimeout(r,2000));
  const lines=(await fs.readFile(path.join(target,'counter.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
  assert.ok(lines.some(x=>x.kind==='armed'));assert.equal(lines.filter(x=>x.kind==='model'||x.kind==='tool').length,0);
  report.checks.push({name:'native host restart '+restart+' query zero execution',pass:true,counters:lines});
  if(restart===1){
   await command([worker,'inspect',target,path.join(ev,'target-before-explicit.json')]);
   const before=JSON.parse(await fs.readFile(path.join(ev,'target-before-explicit.json')));for(const original of a.sessions){const current=before.sessions.find(x=>x.stored.meta.id===original.stored.meta.id);assert.deepEqual(current.queue,original.queue);assert.deepEqual(current.stored.events.slice(0,original.stored.events.length),original.stored.events);}
   report.checks.push({name:'both queues and original prefix survive warm resume and two boots',pass:true});
   for(const item of before.sessions)await fs.copyFile(item.location.path,path.join(ev,item.stored.meta.id+'.jsonl.zstd'));
   const targetFiles=await fs.readdir(path.join(target,'home'));assert.ok(!targetFiles.includes('.credentials.yaml'));const regeneratedSettings=await fs.readFile(path.join(target,'home/settings.yaml'),'utf8').catch(()=> '');assert.ok(!regeneratedSettings.includes('SYNTHETIC_SETTINGS_CANARY'));report.checks.push({name:'structured credential/settings files excluded',pass:true});
   await rpc(url,'session.prompt',{sessionId:'v02-006b-parent',mode:'queue',content:[{type:'text',text:'EXPLICIT_POSITIVE_CONTROL'}]});
   let control=[];for(let i=0;i<80;i++){await new Promise(r=>setTimeout(r,100));control=(await fs.readFile(path.join(target,'counter.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);if(control.some(x=>x.kind==='tool-body'))break;}
   assert.ok(control.some(x=>x.kind==='model'));assert.ok(control.some(x=>x.kind==='tool-body'));report.positiveControl=control;
  }
  await stop();
 }
 await command([worker,'inspect',target,path.join(ev,'target-after.json')]);
 for(const [file,digest]of Object.entries(sourceSnapshot))assert.equal(sha(await fs.readFile(file)),digest);report.sourceSnapshot=sourceSnapshot;report.checks.push({name:'source sessions/workspace/credentials/settings unchanged during target probe',pass:true});report.status='bounded-probe-passed';await fs.writeFile(path.join(base,'docs/project/evidence/V02-006B-raw/latest.json'),JSON.stringify({directory:path.basename(run),node:process.version},null,2));
}catch(error){report.status='blocked';report.error=error.stack;process.exitCode=1;}finally{await stop();await save();}
console.log(JSON.stringify({status:report.status,run,error:report.error}));
