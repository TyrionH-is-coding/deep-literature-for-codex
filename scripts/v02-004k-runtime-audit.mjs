import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
import {root,out,installed,read,py} from './fixtures/v02-004k/common.mjs';
const b=path.resolve(import.meta.dirname,'..'),a='C:/Users/15694/Documents/ChatGPT/deep-literature-engine-v02-004k',base='697dfc4718b7c984223cafc4479b4843fe17dffd';
const sha=async f=>createHash('sha256').update(await fs.readFile(f)).digest('hex');
const old=f=>execFileSync('git',['show',base+':'+f],{cwd:b});
for(const f of ['runtime/requirements.lock','runtime/package.json','runtime/posix-node.tsv'])assert.equal((await fs.readFile(path.join(b,f),'utf8')).replaceAll('\r\n','\n'),old(f).toString().replaceAll('\r\n','\n'),f);
const lock=await read(path.join(b,'runtime/package-lock.json')),oldLock=JSON.parse(old('runtime/package-lock.json'));delete oldLock.packages['node_modules/@dsh-external/dsh-scientific-reading'];const unchanged=structuredClone(lock);delete unchanged.packages['node_modules/@dsh-external/dsh-scientific-reading'];assert.deepEqual(unchanged,oldLock);
const npmRoot=path.join(installed.slot,'runtime/npm'),npm=[],skipped=[];
for(const [name,row] of Object.entries(lock.packages)){if(!name||row.link)continue;let actual;try{actual=await read(path.join(npmRoot,name,'package.json'));}catch(e){assert.ok(row.optional&&(row.os||row.cpu),name);skipped.push({name,os:row.os,cpu:row.cpu});continue;}assert.equal(actual.version,row.version,name);npm.push({name,version:actual.version});}
const pins=await read(path.join(b,'runtime/pins.json')),priorPins=JSON.parse(old('runtime/pins.json'));delete pins.plugin;delete pins.channel;delete priorPins.plugin;delete priorPins.channel;assert.deepEqual(pins,priorPins);
const artifacts={};for(const f of ['runtime/requirements.lock','runtime/package-lock.json','runtime/pins.json'])artifacts[f]=await sha(path.join(b,f));
for(const f of [installed.node,installed.python,installed.dsh,path.join(a,'dist/python/dsh_scientific_reading_engine-0.2.0.dev3-py3-none-any.whl')])artifacts[f]=await sha(f);
const report={root,unchangedRuntimeDependencyLockExceptPlugin:true,unchangedRuntimePinsExceptPluginChannel:true,npm,platformOptionalSkipped:skipped,python:py(path.join(import.meta.dirname,'fixtures/v02-004k/locked-python.py'),path.join(installed.app,'runtime/requirements.lock')),artifacts};
await fs.writeFile(path.join(out,'runtime-audit.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({npm:npm.length,optionalSkipped:skipped.length,python:report.python.locked.length}));
