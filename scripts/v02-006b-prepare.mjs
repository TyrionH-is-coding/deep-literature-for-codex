// Prepare only this task's isolated dependencies; never edit the product lock.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const base=path.resolve(import.meta.dirname,'..');
const dir=path.join(base,'.local/runtime');await fs.mkdir(dir,{recursive:true});
const p=JSON.parse(await fs.readFile(path.join(base,'runtime/package.json')));
const l=JSON.parse(await fs.readFile(path.join(base,'runtime/package-lock.json')));
for(const n of ['@dsh-external/dsh-scientific-reading','codex-scientific-reading-oauth']){delete p.dependencies[n];delete l.packages[''].dependencies[n];delete l.packages['node_modules/'+n];}
await fs.writeFile(path.join(dir,'package.json'),JSON.stringify(p,null,2));await fs.writeFile(path.join(dir,'package-lock.json'),JSON.stringify(l,null,2));
// Windows npm.cmd is launched by PowerShell, with fixed arguments and task-local cache.
const result=spawnSync('powershell.exe',['-NoProfile','-Command','npm ci --prefix .local/runtime --cache .local/npm-cache --ignore-scripts --no-audit --no-fund'],{cwd:base,stdio:'inherit',windowsHide:true});
if(result.status!==0)process.exit(result.status??1);
// Optional: obtain the product-pinned Windows Node runtime into this task only.
const pins=JSON.parse(await fs.readFile(path.join(base,'runtime/pins.json')));
const {createHash}=await import('node:crypto');
const archive=path.join(base,'.local/node-22.zip');
let bytes=await fs.readFile(archive).catch(()=>null);
if(!bytes){const response=await fetch(pins.node.url);if(!response.ok)throw Error('Node download '+response.status);bytes=Buffer.from(await response.arrayBuffer());await fs.writeFile(archive,bytes);}
if(createHash('sha256').update(bytes).digest('hex')!==pins.node.sha256)throw Error('Node archive SHA mismatch');
const binary=path.join(base,'.local/node22/node-v22.22.2-win-x64/node.exe');
if(!(await fs.stat(binary).catch(()=>null))){const expand=spawnSync('powershell.exe',['-NoProfile','-Command','Expand-Archive -LiteralPath .local/node-22.zip -DestinationPath .local/node22'],{cwd:base,stdio:'inherit',windowsHide:true});if(expand.status!==0)throw Error('Node extraction failed');}
console.log('Prepared pinned DSH dependencies and Node 22.22.2 within .local');
