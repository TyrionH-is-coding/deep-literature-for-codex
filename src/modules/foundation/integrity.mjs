import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export async function verifyFile(file, expected) {
  if (!/^[a-f0-9]{64}$/.test(expected)) throw new Error('invalid_checksum');
  const actual = createHash('sha256').update(await fs.readFile(file)).digest('hex');
  if (actual !== expected) throw new Error(`checksum_mismatch: ${path.basename(file)}`);
  return actual;
}
