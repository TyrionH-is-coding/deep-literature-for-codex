import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdir, mkdtemp } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'
import { AppServer, isolatedEnvironment } from '../app-server.mjs'

const scratch = fileURLToPath(new URL('../.work/transport/', import.meta.url))
const fixture = fileURLToPath(new URL('./fixtures/app-server.mjs', import.meta.url))
async function serverFor(t) {
  await mkdir(scratch, { recursive: true })
  const stateRoot = await mkdtemp(join(scratch, '隔离-'))
  const server = new AppServer({ stateRoot, command: [process.execPath, fixture], requestTimeoutMs: 500 })
  t.after(() => server.close())
  return { server, stateRoot }
}

test('PB-08 explicit instance state is mandatory and ambient credentials are excluded', () => {
  assert.throws(() => new AppServer(), /stateRoot/)
  assert.throws(() => new AppServer({ stateRoot: 'relative' }), /absolute/)
  const env = isolatedEnvironment(resolve('fixture-state'), { OPENAI_API_KEY: 'fixture', CODEX_HOME: 'outer', CODEX_CONFIG: 'outer', Path: 'fixture-path', HTTPS_PROXY: 'http://127.0.0.1:1234' })
  assert.equal(env.OPENAI_API_KEY, undefined)
  assert.equal(env.CODEX_CONFIG, undefined)
  assert.equal(env.CODEX_HOME, resolve('fixture-state'))
  assert.equal(env.Path, 'fixture-path')
  assert.equal(env.HTTPS_PROXY, 'http://127.0.0.1:1234')
})

test('PB-08 real child JSONL handshake uses isolated cwd and delivers account events', async t => {
  const { server, stateRoot } = await serverFor(t)
  const notifications = []
  server.onNotification(event => notifications.push(event))
  assert.equal(await server.account(false), null)
  const result = await server.request('fixture/environment', {})
  assert.equal(result.codexHome, join(stateRoot, 'codex-home'))
  assert.equal(result.cwd, join(stateRoot, 'codex-home'))
  assert.equal(result.hasApiKey, false)
  await server.request('fixture/notification', {})
  assert.equal(notifications[0].method, 'account/login/completed')
  await server.request('fixture/noise', {})
  await assert.rejects(server.request('fixture/error', {}), error => !error.message.includes('SECRET') && error.message.includes('123'))
  await server.close()
  await assert.rejects(server.request('account/read', {}), /closed/)
})

test('PB-08 pending RPC fails promptly after child exit', async t => {
  const { server } = await serverFor(t)
  await assert.rejects(server.request('fixture/crash', {}), /exited/)
})

test('PB-08 hung and malformed responses close the transport with safe errors', async t => {
  const first = await serverFor(t)
  await assert.rejects(first.server.request('fixture/hang', {}), /timed out/)
  const second = await serverFor(t)
  await assert.rejects(second.server.request('fixture/malformed', {}), /protocol/)
})
