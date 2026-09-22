import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
export const root='C:/tmp/v005/instance', out='C:/tmp/v005/evidence';
await fs.mkdir(out,{recursive:true});
export const read=async f=>JSON.parse((await fs.readFile(f,'utf8')).replace(/^\uFEFF/,''));
export const installed=await read(path.join(root,'installation.json'));
export const from=f=>import(pathToFileURL(path.join(installed.app,'src',f)).href);
export const {start,stop,status}=await from('control.mjs');
export const {call}=await from('client.mjs');
const {isolatedEnvironment}=await from('core.mjs');
export const env=isolatedEnvironment(root,process.env,installed);
export const py=(file,...args)=>JSON.parse(execFileSync(installed.python,['-I','-X','utf8',file,...args],{cwd:root,env,encoding:'utf8',windowsHide:true,timeout:120000}));
export const engine=(...args)=>JSON.parse(execFileSync(installed.python,['-I','-X','utf8','-m','scientific_reading','--data-root',path.join(root,'library'),...args],{cwd:root,env,encoding:'utf8',windowsHide:true,timeout:120000}));
export async function action(action,payload={}) {
 const request={action,payload};
 const result=await call(root,request);
 await fs.appendFile(path.join(out,'calls.jsonl'),JSON.stringify({at:new Date().toISOString(),request,result})+'\n');
 return result.value;
}
export async function gate(taskId){const deadline=Date.now()+90000;let t;while(Date.now()<deadline){t=await action('task',{taskId});if(!['queued','running'].includes(t.job?.status)&&t.control?.worker===null)return t;await new Promise(r=>setTimeout(r,700));}throw Error('gate_timeout '+JSON.stringify(t));}
export const save=async(name,value)=>fs.writeFile(path.join(out,name+'.json'),JSON.stringify(value,null,2));
