import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { PRODUCT, SKILL_NAME, readJson, writeJson } from '../foundation/index.mjs';

async function filesBelow(root, relative = '') {
  const result = {};
  for (const entry of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
    const file = path.join(relative, entry.name);
    if (entry.isDirectory()) Object.assign(result, await filesBelow(root, file));
    else if (entry.isFile()) result[file] = await fs.readFile(path.join(root, file));
    else throw new Error('unsupported_skill_link');
  }
  return result;
}

const fingerprints = files => Object.fromEntries(Object.entries(files).map(([file, data]) => [file, createHash('sha256').update(data).digest('hex')]));
const sameFiles = (a, b) => Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([file, sha]) => b[file] === sha);

export async function installSkill(source, skillsRoot, root) {
  const target = path.join(skillsRoot, SKILL_NAME);
  const expected = await filesBelow(source);
  expected['installation.json'] = Buffer.from(JSON.stringify({ product: PRODUCT, root }, null, 2) + '\n');
  expected['location.txt'] = Buffer.from(root + '\n');
  const receipt = path.join(root, 'state', 'installed-skill.json');
  let legacySkill;
  const remember = async () => {
    let previous;
    try { previous = await readJson(receipt); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (previous?.target === path.join(skillsRoot, PRODUCT)) legacySkill = await removeManagedSkill(root);
    await writeJson(receipt, { target, files: fingerprints(expected) });
  };
  let replace = false;
  try {
    const present = await filesBelow(target);
    if (sameFiles(fingerprints(present), fingerprints(expected))) {
      await remember();
      return { path: target, reused: true, ...(legacySkill ? { legacySkill } : {}) };
    }
    let previous;
    try { previous = await readJson(receipt); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (previous?.target !== target || !sameFiles(previous.files, fingerprints(present))) {
      return { status: 'retained_custom_changes', reason: 'skill_conflict', path: target };
    }
    replace = true;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.mkdir(skillsRoot, { recursive: true });
  const staging = path.join(skillsRoot, `${SKILL_NAME}.staging-${randomUUID()}`);
  await fs.mkdir(staging);
  let backup;
  try {
    for (const [file, data] of Object.entries(expected)) {
      await fs.mkdir(path.dirname(path.join(staging, file)), { recursive: true });
      await fs.writeFile(path.join(staging, file), data, { flag: 'wx' });
    }
    if (replace) {
      backup = path.join(root, 'state', 'skill-backups', randomUUID());
      await fs.cp(target, backup, { recursive: true });
      if (path.dirname(target) !== path.resolve(skillsRoot) || path.basename(target) !== SKILL_NAME) throw new Error('invalid_skill_target');
      await fs.rm(target, { recursive: true });
    }
    await fs.rename(staging, target);
    await remember();
  } catch (error) {
    if (backup) {
      try { await fs.access(target); } catch (missing) { if (missing.code !== 'ENOENT') throw missing; await fs.cp(backup, target, { recursive: true }); }
    }
    throw error;
  } finally {
    // The generated staging sibling is owned by this invocation, never the target.
    if (path.dirname(staging) !== path.resolve(skillsRoot)) throw new Error('invalid_skill_staging');
    await fs.rm(staging, { recursive: true, force: true });
  }
  return { path: target, reused: false, updated: replace, ...(legacySkill ? { legacySkill } : {}) };
}

export async function removeManagedSkill(root) {
  let receipt;
  try { receipt = await readJson(path.join(root, 'state', 'installed-skill.json')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; return { status: 'not_installed' }; }
  const target = path.resolve(receipt.target);
  if (![PRODUCT, SKILL_NAME].includes(path.basename(target)) || path.dirname(target) === target) throw new Error('invalid_skill_target');
  let current;
  try { current = await filesBelow(target); }
  catch (error) { if (error.code !== 'ENOENT') throw error; return { status: 'not_found', path: target }; }
  if (!sameFiles(receipt.files, fingerprints(current))) return { status: 'retained_custom_changes', path: target };
  await fs.rm(target, { recursive: true });
  return { status: 'removed', path: target };
}
