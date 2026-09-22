import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {root,out,read,save,action,engine} from './fixtures/v02-005/common.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={checkedAt:new Date().toISOString(),rows:[]};
for(const name of ['formula-outline','figures-captions','superscript-text']) {
 const fixturePath=path.join(import.meta.dirname,'fixtures/v02-005',name+'.json');
 const bytes=await fs.readFile(fixturePath);
 const original=execFileSync('git',['show','ad00bc5a84110346801dbb6e98c8b9e19135287d:review/fixtures/'+name+'.json'],{cwd:'C:/Users/15694/Documents/ChatGPT/deep-literature-engine',windowsHide:true});
 assert.equal(sha(bytes),sha(original));
 const fixture=JSON.parse(bytes),run=await read(path.join(out,'normal-'+name+'.json'));
 assert.equal(run.result,'passed');
 const task=await action('task',{taskId:run.taskId});assert.equal(task.status,'completed');
 const reader=await action('reader',{paperId:run.paperId});assert.equal(reader.sha256,run.reader.sha256);assert.equal(reader.sourcePdfSha256,run.sourceSha256);
 const gen=path.join(root,'library/papers',run.paperId,'generations',run.sourceSha256.slice(0,16));
 const manifest=await read(path.join(gen,'reading/reader-manifest.json'));
 assert.equal(manifest.paper_id,run.paperId);assert.equal(manifest.source_pdf_sha256,run.sourceSha256);
 assert.equal(sha(await fs.readFile(path.join(gen,'source.pdf'))),run.sourceSha256);
 assert.equal(sha(await fs.readFile(path.join(gen,'reading/reader.html'))),reader.sha256);
 const pkg=await read(path.join(gen,'package-manifest.json'));
 for(const entry of pkg.entries) assert.equal(sha(await fs.readFile(path.join(gen,entry.path))),entry.sha256,entry.path);
 for(const asset of manifest.assets) assert.equal(sha(await fs.readFile(path.join(gen,asset.path))),asset.sha256,asset.path);
 const translations=await read(path.join(gen,'reading/full/translations.json'));
 assert.equal(translations.source_sha256,run.sourceSha256);
 const sourceMap=new Map();
 for(const file of await fs.readdir(path.join(gen,'reading/full/batches'))) if(file.endsWith('.source.json')) {
  const source=await read(path.join(gen,'reading/full/batches',file));
  for(const b of source.blocks)sourceMap.set(b.block_id,b.english);
 }
 const expected=new Map(fixture.translations.map(t=>[t.block_id,t]));
 assert.equal(translations.translations.length,expected.size);
 for(const t of translations.translations){assert.equal(t.translation_zh,expected.get(t.block_id).translation_zh);assert.equal(t.source_text,sourceMap.get(t.block_id));}
 await fs.copyFile(path.join(gen,'reading/reader-manifest.json'),path.join(out,name+'-reader-manifest.json'));
 await fs.copyFile(path.join(gen,'package-manifest.json'),path.join(out,name+'-package-manifest.json'));
 report.rows.push({case:name,paperId:run.paperId,taskId:run.taskId,parent:run.jobId,generation:gen,sourceSha256:run.sourceSha256,reader,fixtureSha256:sha(bytes),translationBlocks:expected.size,verifiedAssets:manifest.assets.length,verifiedPackageEntries:pkg.entries.length});
}
const failure=await read(path.join(out,'failure-formula-outline.json'));
const t=await action('task',{taskId:failure.taskId});
assert.equal(t.jobId,failure.jobId);assert.equal(t.job.status,'waiting_agent');assert.equal(t.job.detail.reason_code,'translate_full_read');assert.equal(t.control.pipelineState.source_pdf_sha256,failure.sourceSha256);
const calls=(await fs.readFile(path.join(root,'v005-provider/calls.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
report.failure={taskId:t.taskId,parent:t.jobId,status:t.job.status,reason:t.job.detail.reason_code,revision:t.control.revision,sourceSha256:t.control.pipelineState.source_pdf_sha256,providerCalls:calls.filter(c=>c.argv.join(' ').includes(failure.paperId))};
report.result='passed';await save('assets-verified',report);console.log(JSON.stringify(report,null,2));
