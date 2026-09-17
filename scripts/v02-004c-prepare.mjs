// Prepare only this task's isolated dependencies; never edit the product lock.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const base=path.resolve(import.meta.dirname,'..');
const dir=path.join(base,'.local/v02-004c-runtime');await fs.mkdir(dir,{recursive:true});
const p=JSON.parse(await fs.readFile(path.join(base,'runtime/package.json')));
const l=JSON.parse(await fs.readFile(path.join(base,'runtime/package-lock.json')));
for(const n of ['@dsh-external/dsh-scientific-reading','codex-scientific-reading-oauth']){delete p.dependencies[n];delete l.packages[''].dependencies[n];delete l.packages['node_modules/'+n];}
await fs.writeFile(path.join(dir,'package.json'),JSON.stringify(p,null,2));await fs.writeFile(path.join(dir,'package-lock.json'),JSON.stringify(l,null,2));
// Windows npm.cmd is launched by PowerShell, with fixed arguments and task-local cache.
const result=spawnSync('powershell.exe',['-NoProfile','-Command','npm ci --prefix .local/v02-004c-runtime --cache .local/v02-004c-npm-cache --ignore-scripts --no-audit --no-fund'],{cwd:base,stdio:'inherit',windowsHide:true});
if(result.status!==0)process.exit(result.status??1);
