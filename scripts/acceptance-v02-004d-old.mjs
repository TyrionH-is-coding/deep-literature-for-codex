import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const out='docs/project/evidence/V02-004D';await fs.mkdir(out,{recursive:true});
const old=JSON.parse(await fs.readFile('docs/project/evidence/V02-003D/package.txt','utf8'));
const hash=async p=>createHash('sha256').update(await fs.readFile(p)).digest('hex');
if(await hash(old.zip)!=='a96a0d6bd702e7edd3f9e5327555c978aded3e189ceb06948a9d9da73fcdaca9')throw Error('old zip hash');
const extraction=path.resolve('outputs/v02-004d-old-extraction');await fs.mkdir(extraction,{recursive:true});
execFileSync('C:/Windows/System32/tar.exe',['-xf',old.zip,'-C',extraction],{windowsHide:true});
const source=path.join(extraction,'deep-literature-for-codex-0.2.0-dev.2-win-x64');
const m=JSON.parse(await fs.readFile(path.join(source,'BUILD-MANIFEST.json'),'utf8'));
for(const [f,h] of Object.entries(m.files))if(await hash(path.join(source,f))!==h)throw Error('old manifest '+f);
const root='C:/Users/15694/AppData/Local/Temp/v4do';
const {initializeRoot}=await import(pathToFileURL(path.join(source,'src/core.mjs')));await initializeRoot(root);
await fs.writeFile(path.join(root,'.v02-004d-test-instance'),'synthetic-only');
await fs.mkdir(path.join(root,'runtime/downloads'),{recursive:true});
for(const [name,h] of [['node-22.22.2.zip',m.pins.node.sha256],['python-3.11.16-20260901.tar.gz',m.pins.python.sha256]]){
const src=path.join('C:/Users/15694/AppData/Local/Temp/v02-001-20260917-probe/runtime/downloads',name);if(await hash(src)!==h)throw Error('cache');await fs.copyFile(src,path.join(root,'runtime/downloads',name));}
await fs.writeFile(path.join(out,'old-artifact.json'),JSON.stringify({oldZip:old.zip,sha256:await hash(old.zip),source,sourceCommit:m.sourceCommit,pluginSourceCommit:m.pluginSourceCommit,pins:m.pins,verifiedFiles:Object.keys(m.files).length,root},null,2));
console.log(source);
