import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer, request } from 'node:http'
import { Script } from 'node:vm'
import { handleOAuthRequest } from '../http.mjs'

async function fixture(t) {
  const calls = []
  const control = Object.fromEntries(['status', 'usage', 'login', 'cancelLogin', 'logout'].map(method => [method, async () => { calls.push(method); return { status: method } }]))
  const server = createServer((req, res) => handleOAuthRequest(control, req, res))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  return { base: `http://127.0.0.1:${server.address().port}`, control, calls }
}

test('PB-08 native HTTP controls expose status/login/cancel/logout with no-store', async t => {
  const { base, calls } = await fixture(t)
  for (const [suffix, method, called] of [['', 'GET', 'status'], ['/usage', 'GET', 'usage'], ['/login', 'POST', 'login'], ['/cancel', 'POST', 'cancelLogin'], ['/logout', 'POST', 'logout']]) {
    const response = await fetch(`${base}/api/codex-oauth${suffix}`, { method, headers: { origin: base } })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal((await response.json()).status, called)
  }
  assert.deepEqual(calls, ['status', 'usage', 'login', 'cancelLogin', 'logout'])
})

test('PB-08 OAuth mutations reject foreign Origin, hostile Host and cross-site requests', async t => {
  const { base, calls } = await fixture(t)
  for (const headers of [{ origin: 'https://attacker.invalid' }, { host: 'attacker.invalid' }, { 'sec-fetch-site': 'cross-site' }]) {
    const status = await new Promise((resolve, reject) => {
      const req = request(`${base}/api/codex-oauth/logout`, { method: 'POST', headers }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)) })
      req.on('error', reject)
      req.end()
    })
    assert.equal(status, 403, JSON.stringify(headers))
  }
  assert.deepEqual(calls, [])
})

test('PB-08 login subpage is discoverable and forbids framing and cached credentials', async t => {
  const { base } = await fixture(t)
  const response = await fetch(`${base}/api/codex-oauth/ui`)
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type'), /text\/html/)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/)
  const page = await response.text()
  assert.match(page, /同一账号额度/)
  assert.match(page, /不会自动切换/)
  assert.match(page, /取消登录/)
  assert.doesNotThrow(() => new Script(page.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)[1]))
})

test('PB-08 HTTP failures do not return app-server error payloads', async t => {
  const { base, control } = await fixture(t)
  control.login = async () => { throw new Error('sensitive fixture content') }
  const response = await fetch(`${base}/api/codex-oauth/login`, { method: 'POST' })
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: 'operation_failed' })
})
