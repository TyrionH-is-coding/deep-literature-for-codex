import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { isolatedEnvironment, readJson, writeJson, verifyFile } from '../foundation/index.mjs';

export async function runLibraryCommand(root, release, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(release.python, ['-I', '-X', 'utf8', '-m', 'scientific_reading', '--data-root', path.join(root, 'library'), ...args], {
      cwd: root, env: isolatedEnvironment(root, process.env, release), windowsHide: true, shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '', error = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { error = (error + data).slice(-2000); });
    child.once('error', reject);
    child.once('close', code => {
      let result;
      try { result = JSON.parse(output.trim()); } catch { return reject(new Error('library_command_invalid_response: ' + code)); }
      if (code || result.status !== 'completed') return reject(new Error(result.error ?? 'library_command_failed: ' + code));
      resolve(result);
    });
  });
}

export async function snapshotLibrary(root, release) {
  try { await fs.access(path.join(root, 'library', 'library.sqlite')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  const output = path.join(root, 'state', 'library-backups', `${Date.now()}-${randomUUID()}.zip`);
  console.error('Create consistent library snapshot; wait up to 30 seconds for active work');
  const result = await runLibraryCommand(root, release, ['library-backup', '--output', output, '--timeout', '30']);
  await verifyFile(output, result.sha256);
  await writeJson(output + '.json', result);
  return result;
}

export async function restoreNewLibrary(root, release, requestedArchive) {
  const archive = await fs.realpath(requestedArchive);
  const sha256 = createHash('sha256').update(await fs.readFile(archive)).digest('hex');
  const receipt = path.join(root, 'state', 'library-migration.json');
  try {
    const previous = await readJson(receipt);
    if (previous.sha256 !== sha256) throw new Error('different_migration_archive');
    return { ...previous, reused: true };
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if ((await fs.readdir(path.join(root, 'library'))).length) throw new Error('migration_requires_empty_library');
  const result = await runLibraryCommand(root, release, ['library-restore', '--archive', archive, '--target', path.join(root, 'library')]);
  const migrated = { ...result, sha256, migratedAt: new Date().toISOString() };
  await writeJson(receipt, migrated);
  return migrated;
}
