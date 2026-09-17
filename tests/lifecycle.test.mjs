import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import net from 'node:net';
import { initializeRoot, writeJson } from '../src/core.mjs';
import { start, status, stop, pipeName } from '../src/control.mjs';

async function fixture(t, name = 'fixture-host.mjs') {
  const requested = await fs.mkdtemp(path.join(os.tmpdir(), 'csr-process-'));
  const { root } = await initializeRoot(requested);
  await writeJson(path.join(root, 'installation.json'), {
    version: 'test', node: process.execPath,
    dsh: path.resolve('tests', name), python: process.execPath, candidate: true,
  });
  t.after(async () => {
    await stop(root);
    const resolved = await fs.realpath(root);
    const temp = await fs.realpath(os.tmpdir());
    if (path.dirname(resolved).toLowerCase() !== temp.toLowerCase()) throw new Error('invalid_fixture_root');
    if (!path.basename(resolved).toLowerCase().startsWith('csr-process-')) throw new Error('invalid_fixture_root');
    await fs.rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
  });
  return root;
}

test('并发启动复用一个真实子进程，停止后状态准确，旁边的服务继续可用', async t => {
  const foreign = http.createServer((_q, s) => s.end('foreign'));
  await new Promise(resolve => foreign.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => foreign.close(resolve)));
  const foreignUrl = `http://127.0.0.1:${foreign.address().port}`;
  const root = await fixture(t);
  const [a, b] = await Promise.all([start(root), start(root)]);
  assert.equal(a.status, 'running');
  assert.equal(a.pid, b.pid);
  assert.equal(a.launchId, b.launchId);
  assert.notEqual(a.url, foreignUrl);
  assert.equal((await status(root)).instanceId, a.instanceId);
  assert.equal((await fetch(`${a.url}/__workbench/identity`).then(r => r.json())).pid, a.pid);
  assert.equal((await stop(root)).status, 'stopped');
  assert.equal((await status(root)).status, 'stopped');
  assert.equal(await fetch(foreignUrl).then(r => r.text()), 'foreign');
  const next = await start(root);
  assert.equal(next.instanceId, a.instanceId);
  assert.notEqual(next.launchId, a.launchId);
});

test('不按陈旧磁盘 PID 停止其他进程', async t => {
  const root = await fixture(t);
  await writeJson(path.join(root, 'state', 'last-run.json'), {
    status: 'running', pid: process.pid, url: 'http://127.0.0.1:1', launchId: 'stale',
  });
  assert.equal((await stop(root)).status, 'stopped');
  process.kill(process.pid, 0);
});

test('宿主失败后返回具体状态，不能把进程存在当成就绪', async t => {
  const root = await fixture(t, 'fixture-failed.mjs');
  await assert.rejects(start(root), /host_exited/);
  assert.equal((await status(root)).status, 'failed');
  const installed = JSON.parse(await fs.readFile(path.join(root, 'installation.json'), 'utf8'));
  installed.dsh = path.resolve('tests', 'fixture-host.mjs');
  await writeJson(path.join(root, 'installation.json'), installed);
  assert.equal((await start(root)).status, 'running');
});

test('拒绝控制通道返回的其他实例，即使其 HTTP 身份自洽', async t => {
  const requested = await fs.mkdtemp(path.join(os.tmpdir(), 'csr-wrong-instance-'));
  const instance = await initializeRoot(requested);
  const root = instance.root;
  const wrong = { ...instance, instanceId: 'wrong-instance', launchId: 'wrong-launch', pid: process.pid, status: 'running' };
  const web = http.createServer((_q, response) => response.end(JSON.stringify(wrong)));
  await new Promise(resolve => web.listen(0, '127.0.0.1', resolve));
  wrong.url = `http://127.0.0.1:${web.address().port}`;
  const control = net.createServer(socket => socket.once('data', () => socket.end(JSON.stringify(wrong))));
  await new Promise(resolve => control.listen(pipeName(root), resolve));
  t.after(async () => {
    await new Promise(resolve => control.close(resolve));
    await new Promise(resolve => web.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  });
  await assert.rejects(status(root), /instance_identity_mismatch/);
  await assert.rejects(stop(root), /instance_identity_mismatch/);
});

test('控制管道按解析后的安装根命名，联接路径仍拒绝伪造实例', async t => {
  const created = await fs.mkdtemp(path.join(os.tmpdir(), 'csr-pipe-alias-'));
  const canonical = await fs.realpath(created);
  let requested = created;
  let extraAlias;
  if (created === canonical) {
    extraAlias = await fs.mkdtemp(path.join(os.tmpdir(), 'csr-pipe-junc-'));
    requested = path.join(extraAlias, 'instance');
    await fs.symlink(canonical, requested, 'junction');
  }
  t.after(async () => {
    if (extraAlias) await fs.rm(extraAlias, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    await fs.rm(created, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  });
  const instance = await initializeRoot(requested);
  assert.notEqual(path.resolve(requested), instance.root);
  const wrong = { ...instance, instanceId: 'wrong-instance', launchId: 'wrong-launch', pid: process.pid, status: 'running' };
  const web = http.createServer((_q, response) => response.end(JSON.stringify(wrong)));
  await new Promise(resolve => web.listen(0, '127.0.0.1', resolve));
  wrong.url = `http://127.0.0.1:${web.address().port}`;
  const control = net.createServer(socket => socket.once('data', () => socket.end(JSON.stringify(wrong))));
  await new Promise(resolve => control.listen(pipeName(requested), resolve));
  t.after(async () => {
    await new Promise(resolve => control.close(resolve));
    await new Promise(resolve => web.close(resolve));
  });
  assert.equal(pipeName(requested), pipeName(instance.root));
  await assert.rejects(status(requested), /instance_identity_mismatch/);
  await assert.rejects(status(instance.root), /instance_identity_mismatch/);
});

test('升级日志未恢复时禁止普通启动，不猜测切换已经完成', async t => {
  const root = await fixture(t);
  await writeJson(path.join(root, 'state', 'release-transition.json'), { interrupted: true });
  await assert.rejects(start(root), /release_recovery_required/);
});
