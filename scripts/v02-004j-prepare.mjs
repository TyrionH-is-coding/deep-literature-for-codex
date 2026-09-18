import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const base = path.resolve(import.meta.dirname, '..');
const dir = path.join(base, 'outputs/v02-004j/runtime');
await fs.mkdir(dir, { recursive: true });
const pkg = JSON.parse(await fs.readFile(path.join(base, 'runtime/package.json')));
const lock = JSON.parse(await fs.readFile(path.join(base, 'runtime/package-lock.json')));
for (const name of ['@dsh-external/dsh-scientific-reading', 'codex-scientific-reading-oauth']) {
  delete pkg.dependencies[name]; delete lock.packages[''].dependencies[name]; delete lock.packages['node_modules/' + name];
}
await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
await fs.writeFile(path.join(dir, 'package-lock.json'), JSON.stringify(lock, null, 2));
const result = spawnSync('cmd.exe', ['/d', '/c', 'npm ci --ignore-scripts --no-audit --no-fund'], { cwd: dir, stdio: 'inherit', windowsHide: true });
process.exitCode = result.status ?? 1;
