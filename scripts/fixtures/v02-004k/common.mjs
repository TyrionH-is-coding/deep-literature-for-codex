import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {execFileSync} from 'node:child_process';
export const root=process.env.V004K_INSTANCE||'C:/tmp/v004k/instance',out=root.endsWith('/final')?'C:/tmp/v004k/evidence-final':'C:/tmp/v004k/evidence';assert.ok(['C:/tmp/v004k/instance','C:/tmp/v004k/final'].includes(root));await fs.mkdir(out,{recursive:true});
export const read=async f=>JSON.parse(await fs.readFile(f,'utf8')),installed=await read(path.join(root,'installation.json'));
assert.equal(await fs.readFile(path.join(root,'.v02-004k-test-instance'),'utf8'),'synthetic-only');
export const from=f=>import(pathToFileURL(path.join(installed.app,'src',f)).href);
export const {start,stop,status}=await from('control.mjs');export const {call}=await from('client.mjs');
export const {isolatedEnvironment}=await from('core.mjs');
export const env=isolatedEnvironment(root,process.env,installed);delete env.PYTHONPATH;
export const py=(file,...args)=>JSON.parse(execFileSync(installed.python,['-I','-X','utf8',file,...args],{cwd:root,env,encoding:'utf8',windowsHide:true,timeout:120000}));
export const action=async(action,payload={})=>(await call(root,{action,payload})).value;
export const pause=ms=>new Promise(r=>setTimeout(r,ms));
export async function poll(fn,predicate,timeout=60000){const deadline=Date.now()+timeout;let value;while(Date.now()<deadline){value=await fn();if(predicate(value))return value;await pause(100);}throw Error('poll_timeout '+JSON.stringify(value));}
export async function taskGate(id){return poll(()=>action('task',{taskId:id}),t=>!['queued','running'].includes(t.job?.status)&&t.control?.worker===null);}
