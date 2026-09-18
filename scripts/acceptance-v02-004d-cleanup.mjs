import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const records=[];
for(const root of ['C:/Users/15694/AppData/Local/Temp/v4d','C:/Users/15694/AppData/Local/Temp/v4do']){
 assert.equal(await fs.readFile(path.join(root,'.v02-004d-test-instance'),'utf8'),'synthetic-only');
 const i=JSON.parse(await fs.readFile(path.join(root,'installation.json'),'utf8'));
 const {stop,status}=await import(pathToFileURL(path.join(i.app,'src/control.mjs')));
 await stop(root);const s=await status(root);assert.equal(s.status,'stopped');records.push({root,app:i.app,python:i.python,status:s});
}
await fs.writeFile('docs/project/evidence/V02-004D/final-stop.json',JSON.stringify({time:new Date().toISOString(),records},null,2));
