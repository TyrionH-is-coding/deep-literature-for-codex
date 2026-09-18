import fs from 'node:fs/promises';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const repo='C:/Users/15694/Documents/ChatGPT/deep-literature-engine',commit='dcdb8e6cb23dd8329ceabd4487db0a79fae470ea';
const report={repo,commit,time:new Date().toISOString(),layer:'frozen source audit, not worker execution',files:{}};
for(const file of ['engine/src/scientific_reading/background_store.py','engine/src/scientific_reading/background_launcher.py','engine/src/scientific_reading/worker.py','engine/src/scientific_reading/__main__.py','engine/src/scientific_reading/reading_pipeline.py']){
 const result=spawnSync('git',['-C',repo,'show',`${commit}:${file}`],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);const text=result.stdout;
 report.files[file]={sha256:createHash('sha256').update(text).digest('hex'),lines:text.split('\n').flatMap((line,i)=>/cancel|ALLOWED_TRANSITIONS|def resume_job|while True|selected.advance|start_new_session|creationflags|launch_existing|supplied_input is None/.test(line)?[{line:i+1,text:line}]:[])};
 if(file.endsWith('__main__.py')){assert.ok(text.includes('add_parser("full-read-pipeline-resume")'));assert.ok(!text.includes('full-read-pipeline-cancel'));}
 if(file.endsWith('background_store.py')){const transitions=text.slice(text.indexOf('ALLOWED_TRANSITIONS ='),text.indexOf('class InvalidJobTransition'));assert.ok(!/cancel/i.test(transitions));report.allowedTransitions=transitions;}
}
await fs.writeFile(path.resolve(import.meta.dirname,'../docs/project/evidence/V02-004C-frozen-A.json'),JSON.stringify(report,null,2));console.log('Frozen A source audit passed; no supported pipeline cancel or canceled transition.');
