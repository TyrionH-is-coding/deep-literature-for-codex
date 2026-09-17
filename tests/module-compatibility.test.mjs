import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const source = fileURLToPath(new URL('../src/', import.meta.url));

// These names are the public exports of the v0.1.0-rc.6 entrypoints.
// Keep this contract independent of the evolving module implementations.
const contracts = [
  { facade: 'core.mjs', groups: [
    { module: 'foundation', names: ['PRODUCT', 'DISPLAY_NAME', 'SKILL_NAME', 'VERSION',
      'readJson', 'writeJson', 'initializeRoot', 'isolatedEnvironment', 'verifyFile'],
      aliases: { prerequisitePaths: 'runtimePaths' } },
    { module: 'skill', names: ['installSkill', 'removeManagedSkill'] },
  ] },
  { facade: 'platform.mjs', groups: [{ module: 'foundation', names: ['SUPPORTED_PLATFORMS',
    'selectPlatformPins', 'runtimePaths', 'venvPython', 'directoryLinkType', 'defaultRoot', 'npmCli'] }] },
  { facade: 'bridge.mjs', groups: [{ module: 'bridge', names: ['name', 'inject', 'apply'] }] },
  { facade: 'bridge-services.mjs', groups: [{ module: 'bridge', names: ['CATEGORY_TOOLS',
    'engineAdapter', 'dshRpc', 'verifyReader', 'readJobInput', 'categoryGuard',
    'inspectDispatchEvidence', 'cancelOwnedDispatch'] }] },
  { facade: 'handoff.mjs', groups: [{ module: 'workflow', names: ['Handoff'] }] },
  { facade: 'workspace.mjs', groups: [{ module: 'workflow', names: ['ensureInstanceWorkspace',
    'ensureLiteratureDefault'] }] },
  { facade: 'control.mjs', groups: [{ module: 'lifecycle', names: ['pipeName', 'request',
    'status', 'assertStartAllowed', 'start', 'stop'] }] },
  { facade: 'local-socket.mjs', groups: [{ module: 'lifecycle', names: ['prepareLocalSocket'] }] },
  { facade: 'releases.mjs', groups: [{ module: 'releases', names: ['maintenancePipe',
    'activateRelease', 'rollbackRelease', 'recoverRelease', 'retireInstallation'] }] },
  { facade: 'library-transfer.mjs', groups: [{ module: 'releases', names: ['runLibraryCommand',
    'snapshotLibrary', 'restoreNewLibrary'] }] },
];

for (const contract of contracts) {
  test(`${contract.facade} preserves the rc.6 public API and module object identity`, async () => {
    const facade = await import(pathToFileURL(path.join(source, contract.facade)).href);
    const expected = contract.groups.flatMap(group => [...group.names, ...Object.keys(group.aliases ?? {})]);
    assert.deepEqual(Object.keys(facade).sort(), expected.sort());
    for (const group of contract.groups) {
      const api = await import(pathToFileURL(path.join(source, 'modules', group.module, 'index.mjs')).href);
      const bindings = { ...Object.fromEntries(group.names.map(name => [name, name])), ...group.aliases };
      for (const [oldName, newName] of Object.entries(bindings)) {
        assert.notEqual(api[newName], undefined, `${group.module}.${newName} must exist`);
        assert.strictEqual(facade[oldName], api[newName], `${contract.facade}:${oldName}`);
      }
    }
  });
}

test('the stable bridge entrypoint retains the DSH plugin registration contract', async () => {
  const bridge = await import('../src/bridge.mjs');
  assert.equal(bridge.name, 'codex-scientific-reading-bridge');
  assert.deepEqual(bridge.inject, ['tools', 'webServer', 'systemPrompt', 'agents']);
  assert.equal(typeof bridge.apply, 'function');
});

test('relocated public APIs import from an unrelated cwd without loading the supervisor', async t => {
  const prefix = 'dl-module-relocation-';
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(async () => {
    const resolved = await fs.realpath(temporary);
    const tempRoot = await fs.realpath(os.tmpdir());
    assert.equal(path.dirname(resolved).toLowerCase(), tempRoot.toLowerCase());
    assert.ok(path.basename(resolved).startsWith(prefix));
    await fs.rm(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  });
  const relocated = path.join(temporary, 'copied source 文献', 'src');
  const unrelated = path.join(temporary, 'unrelated cwd');
  await fs.cp(source, relocated, { recursive: true });
  await fs.mkdir(unrelated);

  // A library import must never execute the long-running supervisor. A sentinel
  // in the isolated copy detects the dependency before any process can start.
  await fs.writeFile(path.join(relocated, 'modules', 'lifecycle', 'supervisor.mjs'),
    "throw new Error('supervisor_must_not_load_during_library_import');\n");
  const moduleNames = [...new Set(contracts.flatMap(contract => contract.groups.map(group => group.module)))];
  const entries = [...moduleNames.map(name => `modules/${name}/index.mjs`), ...contracts.map(contract => contract.facade)];
  const probe = `
    import assert from 'node:assert/strict';
    import path from 'node:path';
    import { pathToFileURL } from 'node:url';
    const imported = [];
    for (const entry of ${JSON.stringify(entries)}) {
      const api = await import(pathToFileURL(path.join(process.argv[1], entry)).href);
      assert.ok(Object.keys(api).length > 0, entry);
      imported.push(entry);
    }
    console.log(JSON.stringify(imported));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', probe, relocated], {
    cwd: unrelated, encoding: 'utf8', windowsHide: true, timeout: 10000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), entries);
  assert.deepEqual(await fs.readdir(unrelated), [], 'importing libraries must not initialize an instance in cwd');
});
