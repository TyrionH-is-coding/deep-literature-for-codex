import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';

export const catalogPath = 'src/modules/catalog.json';
export const normalize = value => value.replaceAll('\\', '/');
export const owns = (module, file) => module.ownedPaths.some(p => p.endsWith('/') ? file.startsWith(p) : p === file);
export function ownerOf(catalog, file) {
  const matches = catalog.modules.filter(module => owns(module, normalize(file)));
  if (matches.length > 1) throw new Error(`ambiguous_owner: ${file}`);
  return matches[0];
}
export async function loadCatalog(root) {
  return JSON.parse(await fs.readFile(path.join(root, catalogPath), 'utf8'));
}
export async function walk(root, relative = '') {
  const result = [];
  for (const entry of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
    if (['.git', 'node_modules', 'outputs', 'inputs', '.local'].includes(entry.name)) continue;
    const file = normalize(path.join(relative, entry.name));
    if (entry.isDirectory()) result.push(...await walk(root, file));
    else if (entry.isFile()) result.push(file);
  }
  return result.sort();
}
function visit(node, fn) {
  if (!node || typeof node !== 'object') return;
  if (node.type) fn(node);
  for (const child of Object.values(node)) {
    if (Array.isArray(child)) child.forEach(item => visit(item, fn));
    else if (child && typeof child === 'object') visit(child, fn);
  }
}
// Parse syntax, not text matches: comments and string examples are not dependencies.
export function importsOf(source) {
  const imports = [];
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const factories = new Set(), requires = new Set(['require']);
  visit(ast, node => {
    if (node.type === 'ImportDeclaration' && node.source.value === 'node:module') {
      for (const specifier of node.specifiers) {
        if (specifier.imported?.name === 'createRequire') factories.add(specifier.local.name);
        else if (specifier.type !== 'ImportSpecifier') throw new Error('use_named_node_module_imports');
      }
    }
  });
  visit(ast, node => {
    if (node.type === 'VariableDeclarator' && factories.has(node.init?.callee?.name) && node.id.type === 'Identifier') requires.add(node.id.name);
  });
  visit(ast, node => {
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type) && node.source) {
      imports.push({ specifier: node.source.type === 'Literal' ? node.source.value : null,
        expression: source.slice(node.start, node.end), line: node.loc.start.line });
    }
    if (node.type === 'CallExpression') {
      if (factories.has(node.callee.name)) imports.push({ specifier: null, expression: source.slice(node.start, node.end), line: node.loc.start.line });
      else if (requires.has(node.callee.name) || (requires.has(node.callee.object?.name) && node.callee.property?.name === 'resolve')) {
        const argument = node.arguments[0];
        imports.push({ specifier: argument?.type === 'Literal' ? argument.value : null,
          expression: source.slice(node.start, node.end), line: node.loc.start.line });
      }
    }
  });
  return imports;
}
export function impactedModules(catalog, ids) {
  const selected = new Set(ids);
  for (const id of selected) if (!catalog.modules.some(m => m.id === id)) throw new Error(`unknown_module: ${id}`);
  let changed;
  do {
    changed = false;
    for (const module of catalog.modules) {
      if (!selected.has(module.id) && [...module.dependencies, ...(module.runtimeDependencies ?? [])].some(id => selected.has(id))) {
        selected.add(module.id); changed = true;
      }
    }
  } while (changed);
  return catalog.modules.filter(m => selected.has(m.id));
}
export function validateEdge(catalog, from, target) {
  const owner = ownerOf(catalog, from), dependency = ownerOf(catalog, target);
  if (!owner || !dependency) throw new Error(`unowned_import: ${from} -> ${target}`);
  // Implementation code must not take a shortcut through the legacy facades.
  if (from.startsWith('src/modules/') && (catalog.compatibilityFiles ?? []).includes(target)) throw new Error(`legacy_import: ${from} -> ${target}`);
  if (owner.id === dependency.id) return;
  if (!owner.dependencies.includes(dependency.id)) throw new Error(`undeclared_dependency: ${from} -> ${target}`);
  if (!dependency.publicEntries.includes(target)) throw new Error(`private_import: ${from} -> ${target}`);
}
function validateDAG(catalog) {
  const done = new Set(), visiting = new Set();
  const check = id => {
    if (visiting.has(id)) throw new Error(`dependency_cycle: ${id}`);
    if (done.has(id)) return;
    const module = catalog.modules.find(m => m.id === id);
    if (!module) throw new Error(`unknown_dependency: ${id}`);
    visiting.add(id); module.dependencies.forEach(check); visiting.delete(id); done.add(id);
  };
  catalog.modules.forEach(m => check(m.id));
}
const production = file => /\.(mjs|js)$/.test(file) && (file.startsWith('src/') || file.startsWith('oauth/')) && !file.includes('/tests/');
export async function checkModules(root, catalog) {
  catalog ??= await loadCatalog(root);
  if (catalog.schema !== 1 || new Set(catalog.modules.map(m => m.id)).size !== catalog.modules.length) throw new Error('invalid_catalog');
  validateDAG(catalog);
  const files = await walk(root);
  const registeredTests = new Set(catalog.modules.flatMap(m => m.tests));
  for (const file of files.filter(f => f.endsWith('.test.mjs'))) if (!registeredTests.has(file)) throw new Error(`unregistered_test: ${file}`);
  for (const module of catalog.modules) {
    if (!/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(module.version)) throw new Error(`invalid_version: ${module.id}`);
    for (const id of module.runtimeDependencies ?? []) if (!catalog.modules.some(m => m.id === id)) throw new Error(`unknown_dependency: ${id}`);
    for (const file of [...module.publicEntries, module.context, module.changelog, ...module.tests]) {
      if (!files.includes(file)) throw new Error(`module_file_missing: ${module.id}: ${file}`);
    }
  }
  let importCount = 0;
  const usedExceptions = new Set();
  for (const file of files.filter(production)) {
    const owner = ownerOf(catalog, file);
    if (!owner) throw new Error(`unowned_source: ${file}`);
    for (const item of importsOf(await fs.readFile(path.join(root, file), 'utf8'))) {
      importCount++;
      if (item.specifier === null) {
        const exception = catalog.dynamicImports.find(row => row.file === file && row.expression === item.expression && row.reason);
        if (!exception) throw new Error(`unreviewed_dynamic_import: ${file}:${item.line}`);
        usedExceptions.add(exception);
      } else if (item.specifier.startsWith('.')) {
        const target = normalize(path.relative(root, path.resolve(root, path.dirname(file), item.specifier)));
        if (!files.includes(target)) throw new Error(`missing_import: ${file} -> ${target}`);
        validateEdge(catalog, file, target);
      } else if (!item.specifier.startsWith('node:')) {
        const pkg = item.specifier.startsWith('@') ? item.specifier.split('/').slice(0, 2).join('/') : item.specifier.split('/')[0];
        if (!(owner.externalPackages ?? []).includes(pkg)) throw new Error(`undeclared_package: ${file} -> ${pkg}`);
      }
    }
  }
  if (usedExceptions.size !== catalog.dynamicImports.length) throw new Error('stale_dynamic_import_exception');
  const json = async file => JSON.parse(await fs.readFile(path.join(root, file), 'utf8'));
  const [oauth, lock, runtime, runtimeLock, pins] = await Promise.all(['oauth/package.json', 'oauth/package-lock.json', 'runtime/package.json', 'runtime/package-lock.json', 'runtime/pins.json'].map(json));
  const metadata = catalog.modules.find(m => m.id === 'oauth');
  if (metadata.version !== oauth.version || lock.packages[''].version !== oauth.version || runtimeLock.packages.oauth.version !== oauth.version ||
      runtime.dependencies[oauth.name] !== 'file:oauth' || runtimeLock.packages[`node_modules/${oauth.name}`]?.resolved !== 'oauth') throw new Error('oauth_version_or_link_mismatch');
  if (catalog.modules.find(m => m.id === 'engine').version !== pins.plugin.version || catalog.externalEngine.version !== pins.plugin.version || catalog.externalEngine.sourceCommit !== pins.plugin.sourceCommit || catalog.externalEngine.sha256 !== pins.plugin.sha256) throw new Error('engine_pin_mismatch');
  return { modules: catalog.modules.length, sourceFiles: files.filter(production).length, imports: importCount };
}
export async function moduleSnapshot(root, catalog) {
  catalog ??= await loadCatalog(root);
  const files = await walk(root), modules = [];
  for (const module of catalog.modules) {
    const selected = files.filter(file => owns(module, file));
    const hash = createHash('sha256');
    for (const file of selected) hash.update(file + '\0').update(await fs.readFile(path.join(root, file))).update('\0');
    modules.push({ id: module.id, version: module.version, sha256: hash.digest('hex'), files: selected,
      dependencies: module.dependencies, runtimeDependencies: module.runtimeDependencies ?? [] });
  }
  return { schema: 1, baseline: catalog.baseline, externalEngine: catalog.externalEngine, modules };
}
