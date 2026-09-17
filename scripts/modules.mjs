import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { loadCatalog, checkModules, moduleSnapshot, ownerOf, impactedModules } from './module-graph.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = await loadCatalog(root);
const [command = 'list', id, ...options] = process.argv.slice(2);
const json = value => console.log(JSON.stringify(value, null, 2));
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
const gitFiles = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).split('\0').filter(Boolean);
try {
  if (command === 'check') json({ ok: true, ...await checkModules(root, catalog) });
  else if (command === 'list') json(catalog.modules.map(({ id, version, purpose, dependencies }) => ({ id, version, purpose, dependencies })));
  else if (command === 'snapshot') json({ ...await moduleSnapshot(root, catalog), sourceCommit: git(['rev-parse', 'HEAD']), dirty: Boolean(git(['status', '--porcelain'])) });
  else if (command === 'context') {
    const module = catalog.modules.find(m => m.id === id);
    if (!module) throw new Error(`unknown_module: ${id}`);
    json({ module, baseline: catalog.baseline, sourceCommit: git(['rev-parse', 'HEAD']),
      workingTree: git(['status', '--short']), readFirst: ['AGENTS.md', module.context, module.changelog, ...module.publicEntries],
      dependencyInterfaces: module.dependencies.flatMap(id => catalog.modules.find(m => m.id === id).publicEntries),
      impact: impactedModules(catalog, [id]).map(m => m.id) });
    console.log('\n' + await fs.readFile(path.join(root, module.context), 'utf8'));
  } else if (command === 'impact') {
    const args = [id, ...options];
    const base = args[args.indexOf('--base') + 1];
    if (!args.includes('--base') || !base) throw new Error('usage: impact --base <git-ref>');
    const commit = git(['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`]);
    const files = [...new Set([...gitFiles(['diff', '--name-only', '-z', '--no-renames', commit, '--']),
      ...gitFiles(['ls-files', '-z', '--others', '--exclude-standard'])])];
    const changed = [...new Set(files.map(file => ownerOf(catalog, file)?.id).filter(Boolean))];
    const unowned = files.filter(file => !ownerOf(catalog, file));
    json({ base: commit, files, changed, affected: impactedModules(catalog, changed).map(m => m.id), unowned,
      note: unowned.length ? 'Unowned changes require manual review; do not infer that tests can be skipped.' : 'Includes transitive consumers and declared runtime dependencies.' });
  } else if (command === 'test') {
    await checkModules(root, catalog);
    const selected = id === 'all' ? catalog.modules : impactedModules(catalog, [id]);
    const files = [...new Set(selected.flatMap(m => m.tests))];
    console.log('Modules: ' + selected.map(m => m.id).join(', '));
    // Run OAuth from its own cwd: its fixtures and dependency resolution use that package.
    for (const oauth of [false, true]) {
      const tests = files.filter(file => file.startsWith('oauth/') === oauth).map(file => oauth ? file.slice(6) : file);
      if (!tests.length) continue;
      const result = spawnSync(process.execPath, ['--test', ...tests], { cwd: oauth ? path.join(root, 'oauth') : root,
        stdio: 'inherit', windowsHide: true, shell: false });
      if (result.error) throw result.error;
      if (result.status !== 0) { process.exitCode = result.status ?? 1; break; }
    }
  } else throw new Error('usage: modules list | context <id> | impact --base <git-ref> | test <id|all> | check | snapshot');
} catch (error) { console.error(error.message); process.exitCode = 1; }
