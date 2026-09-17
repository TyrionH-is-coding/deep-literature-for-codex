import assert from 'node:assert/strict'
import test from 'node:test'
import { SafeCodexAdapter } from '../index.mjs'

class Server {
  starts = []; resumes = []; turns = []; responses = []; interrupts = []; events = []
  async account() { return { type: 'chatgpt' } }
  async models() { return [{ model: 'fixture-model', displayName: 'Fixture' }] }
  async startThread(input) { this.starts.push(input); return 'native-' + this.starts.length }
  async resumeThread(threadId, input) { this.resumes.push({ threadId, input }); return { id: threadId, turns: this.savedTurns ?? [] } }
  async interrupt(threadId, turnId) { this.interrupts.push({ threadId, turnId }) }
  finish(threadId) {
    this.events.push(
      { method: 'item/agentMessage/delta', params: { threadId, itemId: 'answer', delta: 'continued' } },
      { method: 'item/completed', params: { threadId, item: { id: 'answer' } } },
      { method: 'turn/completed', params: { threadId, turn: { id: 'new-turn', status: 'completed' } } },
    )
  }
  async startTurn(threadId, input) {
    this.turns.push({ threadId, input })
    if (this.toolNext) {
      this.events.push({ method: 'item/tool/call', requestId: 99, params: { threadId, callId: 'reissued-call', tool: 'write_file', arguments: { path: 'fixture.txt', text: 'done' } } })
      this.toolNext = false
    } else this.finish(threadId)
    return 'new-turn'
  }
  respond(requestId, result) { this.responses.push({ requestId, result }); this.finish(this.turns.at(-1).threadId) }
  nextEvent(_threadId, signal) {
    if (this.events.length) return Promise.resolve(this.events.shift())
    return new Promise((_resolve, reject) => {
      const keepAlive = setTimeout(() => {}, 100)
      const abort = () => { clearTimeout(keepAlive); reject(signal.reason) }
      if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true })
    })
  }
}
const user = text => ({ id: text, role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] })
const assistant = (chunks, content = [{ type: 'text', text: 'continued' }], provider = 'openai-codex') => ({
  id: 'a1', role: 'assistant', source: { kind: 'model', provider, model: 'fixture-model', replayState: chunks?.at(-1).replayState }, content,
})
const base = { provider: 'openai-codex', model: 'fixture-model', sessionId: 'dsh-durable-1', tools: [{ name: 'write_file', description: 'fixture', parameters: { type: 'object' } }] }
const toolBlock = { type: 'tool-call', id: 'reissued-call', name: 'write_file', arguments: '{"path":"fixture.txt","text":"done"}' }
const toolResult = { id: 't1', role: 'user', source: { kind: 'tool', callId: 'reissued-call' }, content: [{ type: 'tool-result', toolCallId: 'reissued-call', content: [{ type: 'text', text: 'confirmed persisted result: file already written' }] }] }

test('PB-06 persisted DSH replay envelope resumes official native thread after restart', async () => {
  const firstServer = new Server()
  const first = await Array.fromAsync(new SafeCodexAdapter(firstServer).stream({ ...base, messages: [user('first request')] }))
  assert.equal(first.at(-1).replayState.response.kind, 'codex-app-server')
  const nextServer = new Server()
  const persisted = JSON.parse(JSON.stringify([user('first request'), assistant(first), user('followup')]))
  const next = await Array.fromAsync(new SafeCodexAdapter(nextServer).stream({ ...base, messages: persisted }))
  assert.equal(nextServer.resumes[0].threadId, 'native-1')
  assert.equal(nextServer.starts.length, 0)
  assert.equal(nextServer.turns[0].input.input[0].text, 'followup')
  assert.equal(next.at(-1).reason.kind, 'stop')
})

test('PB-11 returning to a cached Codex session after another provider includes intervening messages', async () => {
  const server = new Server()
  const adapter = new SafeCodexAdapter(server)
  const first = await Array.fromAsync(adapter.stream({ ...base, messages: [user('initial')] }))
  await Array.fromAsync(adapter.stream({ ...base, messages: [user('initial'), assistant(first), user('other question'), assistant(null, [{ type: 'text', text: 'intervening provider answer' }], 'deepseek'), user('back to Codex')] }))
  assert.equal(server.starts.length, 2)
  assert.match(server.turns.at(-1).input.input[0].text, /intervening provider answer/)
})

test('PB-06 missing native rollout reconstructs from the durable DSH transcript', async () => {
  const first = await Array.fromAsync(new SafeCodexAdapter(new Server()).stream({ ...base, messages: [user('durable facts')] }))
  const server = new Server()
  server.resumeThread = async () => { throw new Error('fixture rollout missing') }
  const result = await Array.fromAsync(new SafeCodexAdapter(server).stream({ ...base, messages: [user('durable facts'), assistant(first), user('continue')] }))
  assert.equal(server.starts.length, 1)
  assert.match(server.turns[0].input.input[0].text, /durable facts/)
  assert.equal(result.at(-1).replayState.response.continuity, 'reconstructed')
})

test('PB-11 switching provider with prior history reconstructs full neutral transcript', async () => {
  const server = new Server()
  const history = [user('prior question'), assistant(null, [{ type: 'text', text: 'prior answer from other provider' }], 'deepseek'), user('continue here')]
  await Array.fromAsync(new SafeCodexAdapter(server).stream({ ...base, messages: history }))
  assert.equal(server.starts.length, 1)
  assert.match(server.turns[0].input.input[0].text, /prior question/)
  assert.match(server.turns[0].input.input[0].text, /prior answer from other provider/)
  assert.match(server.turns[0].input.input[0].text, /continue here/)
})

test('PB-06 restart with confirmed tool result interrupts old turn and does not re-execute duplicate side effect', async () => {
  const firstServer = new Server(); firstServer.toolNext = true
  const first = await Array.fromAsync(new SafeCodexAdapter(firstServer).stream({ ...base, messages: [user('write once')] }))
  assert.equal(first.at(-1).reason.kind, 'tool-calls')
  const restarted = new Server(); restarted.toolNext = true
  restarted.savedTurns = [{ id: 'old-turn', status: 'inProgress' }]
  const chunks = await Array.fromAsync(new SafeCodexAdapter(restarted).stream({ ...base, messages: [user('write once'), assistant(first, [toolBlock]), toolResult] }))
  assert.equal(restarted.resumes.length, 1)
  assert.deepEqual(restarted.interrupts[0], { threadId: 'native-1', turnId: 'old-turn' })
  assert.match(restarted.turns[0].input.input[0].text, /confirmed persisted result/)
  assert.equal(chunks.filter(chunk => chunk.blockType === 'tool-call').length, 0)
  assert.match(restarted.responses[0].result.contentItems[0].text, /file already written/)
  assert.equal(chunks.at(-1).reason.kind, 'stop')
})

test('PB-06 unknown outcome of interrupted tool cannot be blindly re-executed', async () => {
  const firstServer = new Server(); firstServer.toolNext = true
  const first = await Array.fromAsync(new SafeCodexAdapter(firstServer).stream({ ...base, messages: [user('write once')] }))
  const restarted = new Server()
  await assert.rejects(Array.fromAsync(new SafeCodexAdapter(restarted).stream({ ...base, messages: [user('write once'), assistant(first, [toolBlock])] })), error => error.code === 'RECOVERY_REQUIRES_TOOL_RESULT')
  assert.equal(restarted.turns.length, 0)
})

test('PB-11 model switch during tool continuation preserves result without using old RPC request IDs', async () => {
  const server = new Server(); server.toolNext = true
  const adapter = new SafeCodexAdapter(server)
  const first = await Array.fromAsync(adapter.stream({ ...base, messages: [user('write once')] }))
  await Array.fromAsync(adapter.stream({ ...base, model: 'other-fixture-model', messages: [user('write once'), assistant(first, [toolBlock]), toolResult] }))
  assert.equal(server.interrupts.length, 1)
  assert.equal(server.starts.length, 2)
  assert.equal(server.turns.at(-1).input.model, 'other-fixture-model')
  assert.match(server.turns.at(-1).input.input[0].text, /confirmed persisted result/)
  assert.equal(server.responses.length, 0)
})

test('Stop generating 后切换模型，下一回合不消费上一 turn 的中断事件', async () => {
  const server = new Server()
  const adapter = new SafeCodexAdapter(server)
  const first = await Array.fromAsync(adapter.stream({ ...base, messages: [user('translate')] }))
  server.events.unshift({method: 'turn/started', params: {threadId: 'native-1', turn: {id: 'stale-turn'}}},
    {method: 'item/agentMessage/delta', params: {threadId: 'native-1', turnId: 'stale-turn', itemId: 'stale-answer', delta: 'STALE OUTPUT'}}, {
    method: 'turn/completed',
    params: { threadId: 'native-1', turn: { id: 'stale-turn', status: 'interrupted' } },
  })
  const next = await Array.fromAsync(adapter.stream({
    ...base,
    model: 'other-fixture-model',
    messages: [user('translate'), assistant(first), user('continue after stop')],
  }))
  assert.equal(next.at(-1).reason.kind, 'stop')
  assert.equal(server.turns.at(-1).input.model, 'other-fixture-model')
  assert.ok(!JSON.stringify(next).includes('STALE OUTPUT'))
})

test('PB-08 account metadata update during a turn cannot destroy its replay mapping', async () => {
  const server = new Server()
  const adapter = new SafeCodexAdapter(server)
  const startTurn = server.startTurn.bind(server)
  server.startTurn = async (...args) => { const id = await startTurn(...args); adapter.invalidate(); return id }
  const result = await Array.fromAsync(adapter.stream({ ...base, messages: [user('fixture')] }))
  assert.equal(result.at(-1).replayState.response.threadId, 'native-1')
})
