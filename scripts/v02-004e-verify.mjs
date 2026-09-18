import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const runs = [
 ['check', ['scripts/modules.mjs', 'check']],
 ['impact', ['scripts/modules.mjs', 'impact', '--base', 'd78e48bbad317c92770b767390addd589b475038']],
 ['workflow', ['scripts/modules.mjs', 'test', 'workflow']],
 ['bridge', ['--test', 'tests/bridge.test.mjs']],
];
const results = [];
for (const [name, args] of runs) {
 const start = new Date().toISOString();
 const result = spawnSync(process.execPath, args, {cwd:root, encoding:'utf8', windowsHide:true, timeout:180000});
 const output = (result.stdout ?? '') + (result.stderr ?? '');
 await fs.writeFile(new URL(`../docs/project/evidence/V02-004E-${name}.txt`,import.meta.url),output);
 results.push({name,command:[process.execPath,...args],start,end:new Date().toISOString(),exit:result.status,error:result.error?.message ?? null});
 console.log(JSON.stringify(results.at(-1)));
 if(result.status !== 0) process.exitCode=1;
}
await fs.writeFile(new URL('../docs/project/evidence/V02-004E-runs.json',import.meta.url),JSON.stringify({node:process.version,platform:process.platform,results},null,2)+'\n');
