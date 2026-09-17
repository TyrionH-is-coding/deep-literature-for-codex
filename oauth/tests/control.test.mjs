import assert from 'node:assert/strict'
import test from 'node:test'
import { OAuthControl, normalizeUsage } from '../control.mjs'

class Server {
  current = null
  calls = []
  listeners = new Set()
  onNotification(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  notify(method, params) { for (const listener of this.listeners) listener({ method, params }) }
  async account(refreshToken) { this.calls.push(['account', refreshToken]); return this.current }
  async models() { return [{ model: 'fixture-model', displayName: 'Fixture', hidden: false }, { model: 'hidden', hidden: true }] }
  async request(method, params) {
    this.calls.push([method, params])
    if (method === 'account/login/start') return { type: 'chatgpt', loginId: 'fixture-login', authUrl: 'https://auth.openai.com/authorize?state=fixture' }
    if (method === 'account/login/cancel') return { status: 'canceled' }
    if (method === 'account/logout') { this.current = null; return {} }
    throw new Error('fixture transport error with sensitive contents')
  }
  async close() { this.closed = true }
}

test('PB-08 unsigned account is explicit and does not fetch models or quota', async () => {
  const server = new Server()
  const control = new OAuthControl(server)
  assert.deepEqual(await control.status(), {
    status: 'unauthenticated', authenticated: false, provider: 'openai-codex', planType: null, models: [], login: null,
  })
  assert.deepEqual(await control.usage(), { status: 'unavailable', reason: 'not_authenticated', scope: 'account', sharedAcrossClients: true, buckets: [] })
  assert.ok(server.calls.every(([method, refresh]) => method === 'account' && refresh === false))
})

test('PB-08 managed login completion, cancel and logout use official methods', async () => {
  const server = new Server()
  const control = new OAuthControl(server)
  assert.equal((await control.login()).loginId, 'fixture-login')
  assert.equal((await control.status()).login.status, 'pending')
  assert.equal((await control.cancelLogin()).status, 'canceled')
  assert.equal((await control.status()).login.status, 'canceled')
  await control.login()
  server.current = { type: 'chatgpt', planType: 'plus', email: 'fixture@example.invalid', accessToken: 'never-return' }
  server.notify('account/login/completed', { loginId: 'fixture-login', success: true })
  const state = await control.status()
  assert.equal(state.authenticated, true)
  assert.equal(state.login.status, 'completed')
  assert.equal(state.models.length, 1)
  assert.ok(!JSON.stringify(state).includes('accessToken'))
  assert.ok(!JSON.stringify(state).includes('fixture@example'))
  await control.logout()
  assert.equal((await control.status()).authenticated, false)
  assert.ok(server.calls.some(([method, params]) => method === 'account/login/cancel' && params.loginId === 'fixture-login'))
  assert.ok(server.calls.filter(([method]) => method === 'account/login/start').every(([, params]) => params.type === 'chatgpt'))
})

test('PB-08 API-key account is unsupported and cannot fall back to API billing', async () => {
  const server = new Server()
  server.current = { type: 'apiKey' }
  const state = await new OAuthControl(server).status()
  assert.equal(state.status, 'unsupported_auth')
  assert.equal(state.authenticated, false)
  assert.deepEqual(state.models, [])
})

test('PB-09 quota prefers multiple buckets and converts used to remaining once', () => {
  const result = normalizeUsage({
    rateLimits: { primary: { usedPercent: 99 } },
    rateLimitsByLimitId: {
      codex: { primary: { usedPercent: 25, windowDurationMins: 300, resetsAt: 1800000000 }, secondary: { usedPercent: null } },
      extra: { primary: { usedPercent: 120 }, secondary: { usedPercent: -5 } },
    },
  })
  assert.equal(result.status, 'available')
  assert.equal(result.scope, 'account')
  assert.equal(result.sharedAcrossClients, true)
  assert.deepEqual(result.buckets[0].primary, { usedPercent: 25, remainingPercent: 75, windowDurationMins: 300, resetsAt: 1800000000 })
  assert.equal(result.buckets[0].secondary, null)
  assert.equal(result.buckets[1].primary.remainingPercent, 0)
  assert.equal(result.buckets[1].secondary.remainingPercent, 100)
})

test('PB-09 missing, null and invalid quota are unavailable, never zero usage', () => {
  for (const input of [null, {}, { rateLimits: null }, { rateLimitsByLimitId: {} }, { rateLimits: { primary: { usedPercent: '25' } } }]) {
    const result = normalizeUsage(input)
    assert.equal(result.status, 'unavailable')
    assert.deepEqual(result.buckets, [])
  }
})

test('PB-09 quota transport failures return unavailable without raw error contents', async () => {
  const server = new Server()
  server.current = { type: 'chatgpt' }
  const result = await new OAuthControl(server).usage()
  assert.equal(result.status, 'unavailable')
  assert.equal(result.reason, 'request_failed')
  assert.ok(!JSON.stringify(result).includes('sensitive'))
})
