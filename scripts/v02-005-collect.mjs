// Read-only evidence collection; does not start the host or rerun acceptance.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const local='C:/tmp/v005',root=local+'/instance',out=local+'/evidence';
const read=async file=>JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,''));
const entries=[];
async function add(file,role) {
 const bytes=await fs.readFile(file);
 entries.push({path:file.replaceAll('\\','/'),role,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
async function walk(dir,role) {
 for(const entry of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
  const file=path.join(dir,entry.name);
  if(entry.isDirectory()) await walk(file,role);
  else if(entry.isFile()) await add(file,role);
 }
}
const receipt=await read(path.join(repo,'docs/project/evidence/V02-005-receipt.json'));
assert.equal(receipt.phase,'review');
const cleanup=await read(out+'/cleanup.json'),processes=await read(out+'/cleanup-processes.json');
assert.equal(cleanup.status.status,'stopped');assert.equal(cleanup.profileRestored,true);assert.deepEqual(processes.matchingProcesses,[]);
const installed=await read(root+'/installation.json');
const assets=await read(out+'/assets-verified.json');
assert.equal(assets.result,'passed');
for(const name of ['formula-outline','figures-captions','superscript-text']) assert.equal((await read(out+'/normal-'+name+'.json')).result,'passed');
assert.equal((await read(out+'/records-restart.json')).result,'passed');
assert.equal((await read(out+'/failure-formula-outline.json')).result,'passed-to-legal-gate');
assert.equal((await read(out+'/native-entry.json')).result,'passed');
const node=installed.node.replaceAll('\\','/'),python=installed.python.replaceAll('\\','/');
const bundledNode='C:/Users/15694/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe';
const js=args=>`& '${node}' ${args}`;
const py=args=>`& '${python}' -I -X utf8 ${args}`;
const history=[
 ['install.log',0,"powershell.exe -NoProfile -File C:/tmp/v005/package/deep-literature-for-codex-0.2.0-dev.4-win-x64/install.ps1 -Root C:/tmp/v005/instance -PluginArchive C:/tmp/v005/package/deep-literature-for-codex-0.2.0-dev.4-win-x64/inputs/scientific-reading.tgz",'original installer'],
 ['normal-formula-outline.log',1,js('scripts/acceptance-v02-005-demo.mjs normal formula-outline'),'old translation contract rejected'],
 ['normal-formula-outline-continue.log',0,js('scripts/acceptance-v02-005-demo.mjs normal formula-outline continue'),'corrected v3 contract; same task'],
 ['normal-figures-captions.log',0,js('scripts/acceptance-v02-005-demo.mjs normal figures-captions'),'completed'],
 ['normal-superscript-text.log',0,js('scripts/acceptance-v02-005-demo.mjs normal superscript-text'),'completed'],
 ['xlsx-inspect.log',0,`& '${bundledNode}' scripts/v02-005-records.mjs inspect`,'read/render'],
 ['xlsx-edit.log',0,`& '${bundledNode}' scripts/v02-005-records.mjs edit`,'three synthetic values authored; later hidden-sheet guard rejected export'],
 ['records-restart.log',1,js('scripts/acceptance-v02-005-records-restart.mjs'),'hidden sheet mismatch; before import'],
 ['xlsx-preserve.log',1,py('scripts/fixtures/v02-005/preserve-xlsx.py'),'self-closing cell regex corrected'],
 ['xlsx-preserve-r2.log',0,py('scripts/fixtures/v02-005/preserve-xlsx.py'),'only three text values merged into original ZIP'],
 ['records-restart-r2.log',0,js('scripts/acceptance-v02-005-records-restart.mjs'),'import/refresh/full stop-start/persistence passed'],
 ['failure-formula-outline.log',1,js('scripts/acceptance-v02-005-demo.mjs failure formula-outline'),'provider exit19; assertion expected canceled instead of terminal'],
 ['failure-formula-outline-continue.log',1,js('scripts/acceptance-v02-005-demo.mjs failure formula-outline continue'),'synthetic parser title mismatch; identity guard rejected'],
 ['failure-formula-outline-continue-r2.log',1,js('scripts/acceptance-v02-005-demo.mjs failure formula-outline continue'),'actual gate reached; final assertion used wrong field name'],
 ['failure-final-readonly.log',0,null,'historical inline read-only assertion correction: pipelineState; exact shell text not retained; no worker operation repeated'],
 ['assets-verified.log',0,js('scripts/acceptance-v02-005-assets.mjs'),'fixture/source/Reader/package/assets hashes and current gates'],
 ['reopen-command.log',0,'powershell.exe -NoProfile -File scripts/v02-005-reopen.ps1','three trusted Reader URLs'],
 ['native-entry.log',1,js('scripts/acceptance-v02-005-native-entry.mjs'),'legacy bridge import failed before prompt'],
 ['native-entry-continue.log',0,js('scripts/acceptance-v02-005-native-entry.mjs continue'),'one completed native local mock turn; no tool call'],
 ['cleanup.log',0,js('scripts/v02-005-cleanup.mjs'),'normal stop and byte-exact original profile restoration'],
 ['static-checks.log',0,null,'node --check each task mjs; Python AST parse; PowerShell parser; no acceptance rerun']
].map(([log,exitCode,command,note])=>({log:local+'/logs/'+log,exitCode,command,note}));
for(const dir of ['evidence','screenshots','logs'])await walk(local+'/'+dir,dir);
await walk(root+'/v005-provider','synthetic provider inputs and calls');
await walk(root+'/library/jobs','installed job state/logs (frozen after stop)');
for(const row of assets.rows) await walk(row.generation,'installed normal-generation assets');
for(const file of ['installation.json','.workbench.json','state/dsh-home/profiles/workbench/cordis.patch.yml'])await add(root+'/'+file,'installed identity/restored profile');
await add(root+'/library/library/scientific-reading.xlsx','current native workbook');
await walk(path.join(repo,'scripts/fixtures/v02-005'),'task source');
for(const name of (await fs.readdir(path.join(repo,'scripts'))).filter(n=>/^(acceptance-)?v02-005-.*\.(mjs|ps1)$/.test(n)))await add(path.join(repo,'scripts',name),'task source');
for(const name of ['report.md','demo.md','receipt.json'])await add(path.join(repo,'docs/project/evidence/V02-005-'+name),'delivery');
const zip='C:/tmp/v004k/candidate-r1/deep-literature-for-codex-0.2.0-dev.4-win-x64.zip';
await add(zip,'original approved candidate');
assert.equal(entries.at(-1).sha256,'862e08c5ba85b399f6530d468298cfc7d3866675eae4b5ebe09e8b950610d105');
const result={schema:1,task:'V02-005',collectedAt:new Date().toISOString(),receipt,retention:'Local evidence at C:/tmp/v005; keep until control review. SHA covers observed bytes, not a portable archive. Index excludes itself; Git commit is the delivery anchor.',source:{engineFixtureCommit:'ad00bc5a84110346801dbb6e98c8b9e19135287d',installed},outcomes:{normal:'3 completed',translationBlocks:38,recordsRestart:'passed',failure:'same parent/source resumed to waiting_agent/translate_full_read',native:'one completed local synthetic turn, no tool call',library:'actual category filter and Open HTML navigation passed',excel:'fallback feedback only; desktop edit/selected row not verified',cleanup:'stopped, original profile restored, zero task-owned Node/Python processes'},commandHistory:{cwd:repo.replaceAll('\\','/'),notation:'Normalized PowerShell invocations; logs preserve actual outputs; earlier attempts used then-current fixture revisions. Do not replay against retained instance.',entries:history},files:entries};
await fs.writeFile(path.join(repo,'docs/project/evidence/V02-005-index.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({result:'collected',files:entries.length,bytes:entries.reduce((s,e)=>s+e.bytes,0)}));
