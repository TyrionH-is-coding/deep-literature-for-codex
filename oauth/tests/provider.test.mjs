import assert from 'node:assert/strict'
import test from 'node:test'
import { SafeCodexAdapter, apply } from '../index.mjs'

class Server {
  current = null
  starts = 0
  async account() { return this.current }
  async models() { return [{ model: 'fixture-model', displayName: 'Fixture', inputModalities: ['text', 'image'] }] }
  async startThread() { this.starts++; return 'fixture-thread' }
}

test('PB-08 unavailable account leaves other providers usable and rejects generation', async () => {
  const server = new Server()
  const adapter = new SafeCodexAdapter(server)
  assert.deepEqual(await adapter.listModels(), [])
  await assert.rejects(Array.fromAsync(adapter.stream({ messages: [] })), error => error.code === 'MISSING_CREDENTIAL')
  assert.equal(server.starts, 0)
  server.current = { type: 'apiKey' }
  await assert.rejects(Array.fromAsync(adapter.stream({ messages: [] })), error => error.code === 'MISSING_CREDENTIAL')
  assert.equal(server.starts, 0)
})

test('PB-08 provider advertises supported text input and does not retain account cache after logout', async () => {
  const server = new Server()
  const adapter = new SafeCodexAdapter(server)
  server.current = { type: 'chatgpt' }
  assert.deepEqual((await adapter.listModels())[0].inputModalities, ['text'])
  server.current = null
  assert.deepEqual(await adapter.listModels(), [])
})

test('PB-08 native plugin registers only openai-codex and preserves existing model configuration', () => {
  const registrations = []
  const effects = []
  const ctx = {
    llm: { registerAdapter(providers, adapter) { registrations.push({ providers, adapter }) } },
    effect(fn) { effects.push(fn()) },
    inject(names, fn) { assert.deepEqual(names, ['webServer']); fn({ effect: fn => effects.push(fn()), webServer: { register(route) { assert.equal(route.path, '/api/codex-oauth'); return () => {} } } }) },
  }
  apply(ctx, { stateRoot: process.cwd() })
  assert.deepEqual(registrations[0].providers, ['openai-codex'])
  assert.equal(registrations.length, 1)
  assert.equal(registrations[0].adapter.providerInfo().id, 'openai-codex')
  return Promise.all(effects.map(dispose => dispose?.()))
})
