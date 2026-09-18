import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const cwd=process.cwd(), p=JSON.parse(await fs.readFile('docs/project/evidence/V02-004D/package.txt','utf8'));
const root='C:/Users/15694/AppData/Local/Temp/v4d';
try {await fs.stat(root);throw Error('root already exists');} catch(e){if(e.code!=='ENOENT')throw e;}
const {initializeRoot}=await import(pathToFileURL(path.join(p.extractedRoot,'src/core.mjs')));
await initializeRoot(root); await fs.writeFile(path.join(root,'.v02-004d-test-instance'),'synthetic-only');
const pins=JSON.parse(await fs.readFile('runtime/pins.json','utf8')), records=[];
await fs.mkdir(path.join(root,'runtime/downloads'),{recursive:true});
for(const [name,sha] of [['node-22.22.2.zip',pins.node.sha256],['python-3.11.16-20260901.tar.gz',pins.python.sha256]]) {
 const source=path.join('C:/Users/15694/AppData/Local/Temp/v02-001-20260917-probe/runtime/downloads',name), target=path.join(root,'runtime/downloads',name);
 const hash=async f=>createHash('sha256').update(await fs.readFile(f)).digest('hex');
 if(await hash(source)!==sha)throw Error('source checksum');await fs.copyFile(source,target);if(await hash(target)!==sha)throw Error('copy checksum');records.push({source,target,sha256:sha});
}
await fs.writeFile('docs/project/evidence/V02-004D/cache-copy.json',JSON.stringify({root,extractedRoot:p.extractedRoot,records},null,2));
