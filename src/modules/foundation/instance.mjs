import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PRODUCT } from './constants.mjs';
import { readJson } from './json.mjs';

export async function initializeRoot(requested) {
  if (/[\r\n\0]/.test(requested)) throw new Error('invalid_root');
  const absolute = path.resolve(requested);
  if (absolute === path.parse(absolute).root) throw new Error('invalid_root');
  await fs.mkdir(absolute, { recursive: true });
  const root = await fs.realpath(absolute);
  const marker = path.join(root, '.workbench.json');
  let instance;
  try { instance = await readJson(marker); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    if ((await fs.readdir(root)).length) throw new Error('root_not_empty');
    instance = { product: PRODUCT, schema: 1, instanceId: randomUUID(), root };
    await fs.writeFile(marker, JSON.stringify(instance, null, 2) + '\n', { flag: 'wx' });
  }
  if (instance.product !== PRODUCT || instance.schema !== 1 || instance.root !== root ||
      !/^[a-f0-9-]{36}$/.test(instance.instanceId)) throw new Error('invalid_instance_marker');
  for (const relative of ['library', 'workspace', 'state/dsh-home', 'state/logs', 'runtime']) {
    await fs.mkdir(path.join(root, relative), { recursive: true });
  }
  return instance;
}
