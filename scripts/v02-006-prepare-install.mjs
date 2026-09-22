import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const packageRoot = process.argv[2], root = 'C:/tmp/v006/source';
try { await fs.stat(root); throw Error('source already exists'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const pins = JSON.parse(await fs.readFile(path.join(packageRoot, 'runtime/pins.json'), 'utf8'));
const { initializeRoot } = await import(pathToFileURL(path.join(packageRoot, 'src/core.mjs')).href);
await initializeRoot(root);
await fs.mkdir('C:/tmp/v006/downloads', { recursive: true });
await fs.mkdir(path.join(root, 'runtime/downloads'), { recursive: true });
const records = [];
for (const [name, expected] of [[`node-${pins.node.version}.zip`, pins.node.sha256], [`python-${pins.python.version}-${pins.python.build}.tar.gz`, pins.python.sha256]]) {
  const source = path.join('C:/tmp/v004k/downloads', name);
  const bytes = await fs.readFile(source), sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== expected) throw Error('runtime digest mismatch');
  for (const destination of [path.join('C:/tmp/v006/downloads', name), path.join(root, 'runtime/downloads', name)]) await fs.writeFile(destination, bytes, { flag: 'wx' });
  records.push({ source, sha256 });
}
await fs.writeFile('C:/tmp/v006/evidence/install-cache.json', JSON.stringify({ root, packageRoot, records }, null, 2));
console.log(root);
