import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const root='C:/Users/15694/AppData/Local/Temp/v3d';
assert.equal(await fs.readFile(path.join(root,'.v02-003d-test-instance'),'utf8'),'synthetic-only');
const i=JSON.parse(await fs.readFile(path.join(root,'installation.json'),'utf8'));
const {start,stop,status}=await import(pathToFileURL(path.join(i.app,'src/control.mjs')));
const dir='docs/project/evidence/V02-003D';
const action=process.argv[2];let value;
if(action==='start'||action==='restart'){
 if(action==='restart')await stop(root);
 value=await start(root);
 await fs.writeFile(path.join(dir,'ui-start.json'),JSON.stringify(value,null,2));
}else if(action==='stop'){await stop(root);value=await status(root);assert.equal(value.status,'stopped');await fs.writeFile(path.join(dir,'final-stop.json'),JSON.stringify(value,null,2));}
else if(action==='locate'||action==='provenance'){
 const r=spawnSync(i.python,['-I','-X','utf8',`scripts/fixtures/v02-003d/${action==='locate'?'locate-probe':'provenance'}.py`,root],{cwd:process.cwd(),encoding:'utf8',windowsHide:true});
 assert.equal(r.status,0,r.stderr);value=JSON.parse(r.stdout);await fs.writeFile(path.join(dir,action==='locate'?'locate.json':'installed-wheel.json'),JSON.stringify(value,null,2));
}else throw Error('unknown action');
const log=path.join(dir,'ui-lifecycle.json');const entries=await fs.readFile(log,'utf8').then(JSON.parse,()=>[]);entries.push({action,time:new Date().toISOString(),value});await fs.writeFile(log,JSON.stringify(entries,null,2));console.log(JSON.stringify(value,null,2));
