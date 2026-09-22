import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {root,out,installed,read,save,start,stop,action,from} from './fixtures/v02-005/common.mjs';
const patch=path.join(root,'state/dsh-home/profiles/workbench/cordis.patch.yml');
const backup=path.join(out,'native-original-profile-patch.json');
const report={startedAt:new Date().toISOString(),scope:'one native prompt; synthetic local LLM only; no tool call or gate mutation'};
try {
 if(process.argv[2]!=='continue') {
 await stop(root);
 const original=await fs.readFile(patch,'utf8');assert.equal(original.trim(),'[]');
 await fs.writeFile(backup,original);
 const overrides=['credentials','llm-pi-ai','llm-deepseek','session-title-llm','web-search-deepseek','skill-filesystem','hmr'].map(id=>({id,disabled:true}));
 overrides.push({id:'agent-default-model',config:{provider:'v005-local',model:'synthetic'}},{insert:[{id:'v005-local-model',name:pathToFileURL(path.join(import.meta.dirname,'fixtures/v02-005/local-model.mjs')).href,config:{entry:installed.dsh}}]});
 await fs.writeFile(patch,JSON.stringify(overrides));await save('native-synthetic-profile',overrides);
 } else await fs.copyFile(path.join(out,'native-entry.json'),path.join(out,'native-entry-attempt1.json'));
 report.boot=await start(root);
 const normal=await read(path.join(out,'normal-formula-outline.json'));
 report.binding=await action('bind',{folderId:normal.folderId});
 const {dshRpc}=await from('modules/bridge/index.mjs');
 report.prompt=await dshRpc(report.boot.url,'session.prompt',{sessionId:report.binding.sessionId,mode:'queue',content:[{type:'text',text:'V02-005 合成界面验收。请只回复合成确认文字，不调用任何工具。'}]},'v005-native-entry-confirmation');
 const deadline=Date.now()+30000;
 while(Date.now()<deadline) {
  const response=await fetch(report.boot.url+'/v005-probe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId:report.binding.sessionId})});
  report.observation=await response.json();
  if(report.observation.calls===1 && report.observation.events?.some(e=>e.type==='turn/end') && report.observation.status!=='running')break;
  await new Promise(r=>setTimeout(r,500));
 }
 assert.equal(report.observation.calls,1);
 assert.ok(report.observation.events.some(e=>e.type==='turn/end' && e.data?.reason?.kind==='completed'));
 assert.ok(JSON.stringify(report.observation.events).includes('V02-005 SYNTHETIC CONFIRMATION'));
 assert.equal(report.observation.events.some(e=>JSON.stringify(e).includes('"type":"tool-call"')),false);
 report.result='passed';
}catch(e){report.result='failed';report.error=e.stack;process.exitCode=1;}
report.finishedAt=new Date().toISOString();await save('native-entry',report);console.log(JSON.stringify(report,null,2));
