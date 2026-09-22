import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = 'C:/tmp/v007/instance';
const evidence = 'C:/tmp/v007/evidence';
const read = async file => JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
const write = async (name, value) => fs.writeFile(path.join(evidence, name), JSON.stringify(value, null, 2), { flag: 'wx' });
const installation = await read(path.join(root, 'installation.json'));
assert.equal(installation.appSha256, 'bc4479d1e5a402f1a4f0d9d95e80142de65e0de25fec14a4a52366ef5fa92ee7');
assert.equal(installation.pins.plugin.sourceCommit, '8b195c9109efd92ba74c37bb244b2c6b155060de');
assert.equal(installation.pins.dsh, '0.1.0-rc.7');
for (const key of ['node', 'python', 'app', 'dsh']) {
  assert(path.resolve(installation[key]).startsWith(path.resolve(root) + path.sep), `${key} outside instance`);
}
const env = { ...process.env };
for (const key of ['NODE_OPTIONS', 'NODE_PATH', 'PYTHONPATH', 'PYTHONHOME']) delete env[key];
async function cli(action, requestFile) {
  const args = [path.join(root, 'launcher.mjs'), action, ...(requestFile ? [requestFile] : [])];
  const { stdout, stderr } = await exec(installation.node, args, {
    cwd: root, env, windowsHide: true, timeout: 180000, maxBuffer: 1024 * 1024,
  });
  assert.equal(stderr.trim(), '', `${action} unexpected stderr`);
  const result = JSON.parse(stdout);
  assert.equal(result.ok, true, `${action} failed`);
  return { command: installation.node, args, result };
}
const start = await cli('start');
assert.equal(start.result.status, 'running');
assert.match(start.result.url, /^http:\/\/127\.0\.0\.1:\d+$/);
await write('start.json', start);
const identityResponse = await fetch(start.result.url + '/__workbench/identity');
assert.equal(identityResponse.status, 200);
const identity = await identityResponse.json();
for (const key of ['product', 'instanceId', 'launchId', 'pid']) assert.equal(identity[key], start.result[key], `identity ${key}`);
await write('identity.json', Object.fromEntries(['product', 'instanceId', 'launchId', 'pid', 'version', 'candidate'].map(key => [key, identity[key]])));
for (const action of ['tasks', 'folders']) {
  const requestFile = path.join(evidence, `${action}-request.json`);
  await fs.writeFile(requestFile, JSON.stringify({ action, payload: {} }), { flag: 'wx' });
  const result = await cli('call', requestFile);
  await write(`${action}.json`, result);
  const value = result.result.value;
  if (action === 'folders') assert.deepEqual(value, []);
  else {
    assert.deepEqual(value.tasks, []);
    assert.deepEqual(value.bindings, []);
  }
}
const status = await cli('status');
assert.equal(status.result.status, 'running');
for (const key of ['instanceId', 'launchId', 'url']) assert.equal(status.result[key], start.result[key]);
await write('status.json', status);
const ready = {
  preparedAt: new Date().toISOString(), phase: 'ready_awaiting_user_local_login', acceptancePassed: false,
  instanceRoot: root, instanceId: identity.instanceId, launchId: identity.launchId, url: start.result.url,
  identityPage: start.result.url + '/__workbench', loginUrl: start.result.url + '/api/codex-oauth/ui',
  appSha256: installation.appSha256, pluginSourceCommit: installation.pins.plugin.sourceCommit,
  dsh: installation.pins.dsh, tasks: 0, folders: 0, bindings: 0,
  actions: ['installed original package', 'start', 'identity', 'tasks', 'folders', 'status'],
  modelCalls: 0, mineruCalls: 0, credentialsConfiguredByAgent: false, skillInstalled: false,
};
await write('ready.json', ready);
console.log(JSON.stringify(ready, null, 2));
