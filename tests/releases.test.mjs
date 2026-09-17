import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { initializeRoot, readJson, writeJson } from '../src/core.mjs';
import { activateRelease, rollbackRelease, retireInstallation, recoverRelease } from '../src/releases.mjs';

async function assertManagedTemp(dir, prefix) {
  const resolved = await fs.realpath(dir);
  const temp = await fs.realpath(os.tmpdir());
  assert.equal(path.dirname(resolved).toLowerCase(), temp.toLowerCase());
  assert.ok(path.basename(resolved).toLowerCase().startsWith(prefix.toLowerCase()));
}

async function fixture(t) {
  const requested = await fs.mkdtemp(path.join(os.tmpdir(), 'csr-release-'));
  const { root } = await initializeRoot(requested);
  await fs.writeFile(path.join(root, 'library', 'paper.pdf'), 'real-user-asset-sentinel');
  await fs.writeFile(path.join(root, 'state', 'settings.json'), 'private-settings-sentinel');
  t.after(async () => {
    await assertManagedTemp(root, 'csr-release-');
    await fs.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  });
  const candidate = async id => {
    const slot = path.join(root, 'releases', id.repeat(16));
    await fs.mkdir(path.join(slot, 'profile-modules'), { recursive: true });
    const release = { product: 'codex-scientific-reading', version: id, appSha256: id.repeat(64),
      slot, app: path.join(slot, 'app'), profileModules: path.join(slot, 'profile-modules'), dataFormat: 4 };
    await writeJson(path.join(slot, 'release.json'), release);
    return release;
  };
  let running = false;
  const calls = [];
  const lifecycle = {
    status: async () => ({ status: running ? 'running' : 'stopped' }),
    stop: async () => { calls.push('stop'); running = false; return { status: 'stopped' }; },
    start: async () => { calls.push('start'); running = true; return { status: 'running' }; },
  };
  return { root, candidate, lifecycle, calls };
}

test('未解析临时路径或联接到达同一安装根时，发行槽位仍有效', async t => {
  const created = await fs.mkdtemp(path.join(os.tmpdir(), 'csr-release-alias-'));
  const canonical = await fs.realpath(created);
  let requested = created;
  let extraAlias;
  if (created === canonical) {
    extraAlias = await fs.mkdtemp(path.join(os.tmpdir(), 'csr-release-junc-'));
    requested = path.join(extraAlias, 'instance');
    await fs.symlink(canonical, requested, 'junction');
  }
  t.after(async () => {
    if (extraAlias) await fs.rm(extraAlias, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    await fs.rm(created, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  });
  assert.notEqual(path.resolve(requested), await fs.realpath(requested));
  await initializeRoot(requested);
  const slot = path.join(requested, 'releases', 'a'.repeat(16));
  await fs.mkdir(path.join(slot, 'profile-modules'), { recursive: true });
  const release = {
    product: 'codex-scientific-reading', version: 'a', appSha256: 'a'.repeat(64),
    slot, app: path.join(slot, 'app'), profileModules: path.join(slot, 'profile-modules'), dataFormat: 4,
  };
  await writeJson(path.join(slot, 'release.json'), release);
  const lifecycle = {
    status: async () => ({ status: 'stopped' }),
    stop: async () => ({ status: 'stopped' }),
    start: async () => ({ status: 'running' }),
  };
  await activateRelease(requested, release, { lifecycle });
  assert.equal((await readJson(path.join(requested, 'installation.json'))).version, 'a');
  await assert.rejects(activateRelease(requested, { ...release, slot: path.dirname(requested) }, { lifecycle }), /release_path/);
});

test('发行槽位若联接到实例外目录则拒绝', async t => {
  const requested = await fs.mkdtemp(path.join(os.tmpdir(), 'csr-release-escape-'));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'csr-release-outside-'));
  const { root } = await initializeRoot(requested);
  t.after(async () => {
    await fs.rm(requested, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    await fs.rm(outside, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  });
  const slot = path.join(root, 'releases', 'a'.repeat(16));
  await fs.mkdir(path.dirname(slot), { recursive: true });
  await fs.symlink(await fs.realpath(outside), slot, 'junction');
  await fs.mkdir(path.join(slot, 'profile-modules'), { recursive: true });
  const release = {
    product: 'codex-scientific-reading', version: 'a', appSha256: 'a'.repeat(64),
    slot, app: path.join(slot, 'app'), profileModules: path.join(slot, 'profile-modules'), dataFormat: 4,
  };
  await writeJson(path.join(slot, 'release.json'), release);
  const lifecycle = {
    status: async () => ({ status: 'stopped' }),
    stop: async () => ({ status: 'stopped' }),
    start: async () => ({ status: 'running' }),
  };
  await assert.rejects(activateRelease(root, release, { lifecycle }), /release_path/);
  await assert.rejects(fs.access(path.join(root, 'installation.json')), { code: 'ENOENT' });
});

test('升级和回退保留新旧文献、配置和实例身份', async t => {
  const { root, candidate, lifecycle } = await fixture(t);
  const marker = await fs.readFile(path.join(root, '.workbench.json'));
  const a = await candidate('a'), b = await candidate('b');
  await activateRelease(root, a, { lifecycle });
  await activateRelease(root, b, { lifecycle });
  await fs.writeFile(path.join(root, 'library', 'new.pdf'), 'new-paper');
  await rollbackRelease(root, { lifecycle });
  assert.equal((await readJson(path.join(root, 'installation.json'))).appSha256, a.appSha256);
  assert.equal(await fs.readFile(path.join(root, 'library', 'new.pdf'), 'utf8'), 'new-paper');
  assert.equal(await fs.readFile(path.join(root, 'state', 'settings.json'), 'utf8'), 'private-settings-sentinel');
  assert.deepEqual(await fs.readFile(path.join(root, '.workbench.json')), marker);
});

test('候选启动失败自动恢复旧版本，既有 PDF 字节不变', async t => {
  const { root, candidate, lifecycle } = await fixture(t);
  const a = await candidate('a'), b = await candidate('b');
  await activateRelease(root, a, { lifecycle });
  const start = lifecycle.start;
  lifecycle.start = async () => {
    if ((await readJson(path.join(root, 'installation.json'))).version === 'b') throw new Error('candidate_failed');
    return start();
  };
  await assert.rejects(activateRelease(root, b, { lifecycle }), /candidate_failed/);
  assert.equal((await readJson(path.join(root, 'installation.json'))).version, 'a');
  assert.equal(await fs.readFile(path.join(root, 'library', 'paper.pdf'), 'utf8'), 'real-user-asset-sentinel');
  await assert.rejects(fs.access(path.join(root, 'state', 'release-transition.json')), { code: 'ENOENT' });
});

test('中断切换可恢复旧描述符，不恢复旧数据库覆盖新文献', async t => {
  const { root, candidate, lifecycle } = await fixture(t);
  const a = await candidate('a'), b = await candidate('b');
  await activateRelease(root, a, { lifecycle });
  await writeJson(path.join(root, 'state', 'release-transition.json'), { previous: a, candidate: b, wasRunning: false });
  await writeJson(path.join(root, 'installation.json'), b);
  await recoverRelease(root, { lifecycle });
  assert.equal((await readJson(path.join(root, 'installation.json'))).version, 'a');
});

test('拒绝跨数据格式回退与实例外目录，卸载只退役代码描述符', async t => {
  const { root, candidate, lifecycle } = await fixture(t);
  const a = await candidate('a');
  await activateRelease(root, a, { lifecycle });
  const b = await candidate('b');
  await assert.rejects(activateRelease(root, { ...b, dataFormat: 5 }, { lifecycle }), /data_format/);
  await assert.rejects(activateRelease(root, { ...b, slot: path.dirname(root) }, { lifecycle }), /release_path/);
  const retired = await retireInstallation(root, { lifecycle });
  assert.equal(retired.status, 'uninstalled');
  await assert.rejects(fs.access(path.join(root, 'installation.json')), { code: 'ENOENT' });
  assert.equal(await fs.readFile(path.join(root, 'library', 'paper.pdf'), 'utf8'), 'real-user-asset-sentinel');
  assert.equal(await fs.readFile(path.join(root, 'state', 'settings.json'), 'utf8'), 'private-settings-sentinel');
});

test('有活动写入导致一致快照失败时，不切换候选版本', async t => {
  const { root, candidate, lifecycle } = await fixture(t);
  const a = await candidate('a'), b = await candidate('b');
  await activateRelease(root, a, { lifecycle });
  await assert.rejects(activateRelease(root, b, { lifecycle, snapshot: async () => { throw new Error('data_root_busy'); } }), /data_root_busy/);
  assert.equal((await readJson(path.join(root, 'installation.json'))).version, 'a');
});
