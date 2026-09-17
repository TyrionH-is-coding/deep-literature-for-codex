import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { importsOf, ownerOf, validateEdge, impactedModules, loadCatalog, checkModules, moduleSnapshot } from '../scripts/module-graph.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const catalog = await loadCatalog(root);
test('the actual source graph has declared public boundaries and pinned module identities', async () => {
  const report = await checkModules(root, catalog);
  assert.equal(report.modules, catalog.modules.length);
  assert.ok(report.sourceFiles > 30);
});
test('syntax parsing ignores example imports but detects export-from and computed imports', () => {
  const rows = importsOf(`// import x from './private.mjs';
    const example = "import('./not-a-dependency.mjs')";
    export { x } from './public.mjs';
    const other = await import('./dynamic.mjs');
    const injected = await import(variable);`);
  assert.deepEqual(rows.map(row => row.specifier), ['./public.mjs', './dynamic.mjs', null]);
});
test('a consumer cannot import private implementations or unregistered dependencies', () => {
  assert.doesNotThrow(() => validateEdge(catalog, 'src/modules/bridge/plugin.mjs', 'src/modules/workflow/index.mjs'));
  assert.throws(() => validateEdge(catalog, 'src/modules/bridge/plugin.mjs', 'src/modules/workflow/handoff.mjs'), /private_import/);
  assert.throws(() => validateEdge(catalog, 'src/modules/workflow/handoff.mjs', 'src/modules/bridge/index.mjs'), /undeclared_dependency/);
  assert.throws(() => validateEdge(catalog, 'src/modules/workflow/handoff.mjs', 'src/core.mjs'), /legacy_import/);
  assert.throws(() => validateEdge(catalog, 'src/modules/workflow/handoff.mjs', 'elsewhere.mjs'), /unowned_import/);
});
test('CommonJS bridges require review and literal require calls participate in dependency checks', () => {
  const imports = importsOf(`import { createRequire as make } from 'node:module';
    const load = make(import.meta.url); load('../workflow/handoff.mjs');`);
  assert.deepEqual(imports.map(i => i.specifier), ['node:module', null, '../workflow/handoff.mjs']);
});
test('unknown module requests fail and impact includes transitive consumers and runtime wiring', () => {
  assert.throws(() => impactedModules(catalog, ['workfow']), /unknown_module/);
  const impact = impactedModules(catalog, ['workflow']).map(m => m.id);
  for (const id of ['workflow', 'bridge', 'lifecycle', 'releases', 'application', 'tooling']) assert.ok(impact.includes(id), id);
  assert.ok(!impact.includes('oauth'), 'unchanged OAuth is a dependency, not a consumer');
});
test('ambiguous ownership is rejected rather than silently choosing a module', () => {
  assert.throws(() => ownerOf({ modules: [{ id: 'a', ownedPaths: ['src/'] }, { id: 'b', ownedPaths: ['src/x.mjs'] }] }, 'src/x.mjs'), /ambiguous_owner/);
});
test('a source cycle is rejected before traversing files', async () => {
  const changed = structuredClone(catalog);
  changed.modules.find(m => m.id === 'foundation').dependencies = ['workflow'];
  await assert.rejects(checkModules(root, changed), /dependency_cycle/);
});
test('module fingerprints change only for modules that own changed bytes', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dl-module-snapshot-'));
  t.after(async () => {
    const real = await fs.realpath(directory), temp = await fs.realpath(os.tmpdir());
    assert.equal(path.dirname(real).toLowerCase(), temp.toLowerCase());
    assert.ok(path.basename(real).startsWith('dl-module-snapshot-'));
    await fs.rm(real, { recursive: true, force: true });
  });
  await fs.writeFile(path.join(directory, 'one.mjs'), 'export const x = 1;');
  await fs.writeFile(path.join(directory, 'two.mjs'), 'export const y = 2;');
  const fixture = { baseline: 'fixture', externalEngine: {}, modules: [
    { id: 'one', version: '1.0.0', ownedPaths: ['one.mjs'], dependencies: [] },
    { id: 'two', version: '1.0.0', ownedPaths: ['two.mjs'], dependencies: [] },
  ] };
  const before = await moduleSnapshot(directory, fixture);
  assert.deepEqual(await moduleSnapshot(directory, fixture), before);
  await fs.writeFile(path.join(directory, 'one.mjs'), 'export const x = 3;');
  const after = await moduleSnapshot(directory, fixture);
  assert.notEqual(before.modules[0].sha256, after.modules[0].sha256);
  assert.equal(before.modules[1].sha256, after.modules[1].sha256);
});
