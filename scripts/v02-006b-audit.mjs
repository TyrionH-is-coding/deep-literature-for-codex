import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const base=path.resolve(import.meta.dirname,'..');const root=path.join(base,'.local/runtime/node_modules');
const lockBytes=await fs.readFile(path.join(base,'runtime/package-lock.json'));const lock=JSON.parse(lockBytes);
const hash=b=>createHash('sha256').update(b).digest('hex');
const ranges={
 'dsh-session':[[605,726],[1035,1140]],
 'dsh-session-persistence-jsonl':[[24, 70],[103,158],[767,835],[850,898],[1035,1105],[1335,1358]],
 'dsh-session-persistence':[[890,923]],
 'dsh-agent':[[10,42],[137,162]],
 'dsh-agent-loop':[[350,398],[1148,1175],[1230,1287]],
 'dsh-workspace':[[156,242],[289,323],[583,670]],
 'dsh-host-apiproxy':[[26, 70],[2578,2604],[4610,4635],[4928,4945]],
 'dsh-credentials-local':[[45, 60],[154,209]],
 'dsh-session-projection-cache':[[1,40]],
 'dsh-session-query-sqlite':[[465,490]]
};
const report={time:new Date().toISOString(),lockSha256:hash(lockBytes),packages:[],sources:[]};
for(const [rel,pin]of Object.entries(lock.packages)){if(!rel.startsWith('node_modules/@deepseek-ai/'))continue;const file=path.join(base,'.local/runtime',rel,'package.json');try{const meta=JSON.parse(await fs.readFile(file));if(meta.version!==pin.version)throw Error('version mismatch '+rel);report.packages.push({name:meta.name,version:meta.version,resolved:pin.resolved,integrity:pin.integrity});}catch(e){if(e.code==='ENOENT'&&pin.optional){report.packages.push({name:rel,version:pin.version,optionalNotInstalled:true,os:pin.os,cpu:pin.cpu});}else throw e;}}
for(const [pkg,spans]of Object.entries(ranges)){const file=path.join(root,'@deepseek-ai',pkg,'lib/index.js');const bytes=await fs.readFile(file);const lines=bytes.toString().split('\n');report.sources.push({package:pkg,path:'lib/index.js',sha256:hash(bytes),snippets:spans.map(([start,end])=>({start,end,text:lines.slice(start-1,end).join('\n')}))});}
const api=await fs.readFile(path.join(root,'@deepseek-ai/dsh-host-apiproxy/lib/index.js'),'utf8');report.sessionRpcMethods=[...api.matchAll(/^\s*"(session\.[^"]+)": \{/gm)].map(m=>m[1]);
await fs.writeFile(path.join(base,'docs/project/evidence/V02-006B-source-audit.json'),JSON.stringify(report,null,2));console.log({lockedPackages:report.packages.length,sources:report.sources.length});
