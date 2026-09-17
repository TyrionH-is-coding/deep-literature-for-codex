import fs from 'node:fs/promises';
import path from 'node:path';
import { readJson, verifyFile } from '../src/core.mjs';

const pins = await readJson(new URL('../runtime/pins.json', import.meta.url));
if (!pins.plugin.url?.startsWith('https://github.com/TyrionH-is-coding/')) throw new Error('engine_release_url_missing');
const target = path.resolve('inputs/scientific-reading.tgz');
await fs.mkdir(path.dirname(target), { recursive: true });
const response = await fetch(pins.plugin.url, { signal: AbortSignal.timeout(120000) });
if (!response.ok) throw new Error('engine_download_http_' + response.status);
const partial = target + '.part';
await fs.writeFile(partial, Buffer.from(await response.arrayBuffer()));
await verifyFile(partial, pins.plugin.sha256);
await fs.rename(partial, target);
console.log('Pinned engine download SHA verified.');
