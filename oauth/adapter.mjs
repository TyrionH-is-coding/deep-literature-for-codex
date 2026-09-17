import { createHash } from 'node:crypto'
import { LlmError } from '@deepseek-ai/dsh-llm'
import { CodexAppServerAdapter, toolSpec } from './vendor/dsh-openai-oauth/adapter.js'

const keyOf = options => String(options.sessionId ?? options.messages[0]?.id ?? 'one-shot')
function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  return value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value
}
const hash = value => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')
function callKey(name, args) {
  if (typeof args === 'string') { try { args = JSON.parse(args) } catch {} }
  return hash([name, args])
}
function replayOf(message) {
  const saved = message?.source?.replayState
  const replay = saved?.response ?? saved
  return replay?.kind === 'codex-app-server' && typeof replay.threadId === 'string' ? replay : null
}
function transcript(messages) {
  return JSON.stringify(messages.map(message => ({
    role: message.role, source: message.source?.kind,
    content: message.content.filter(block => block.type !== 'reasoning'),
  })))
}
function resultText(blocks) {
  return blocks.map(block => block.type === 'text' ? block.text : block.type === 'tool-result' ? resultText(block.content) : '').join('\n')
}

function recoveryResults(options, latest) {
  const following = options.messages.slice(options.messages.indexOf(latest) + 1)
  if (!latest || following.some(message => message.source?.kind === 'user')) return new Map()
  const results = new Map(following.flatMap(message => message.content).filter(block => block.type === 'tool-result').map(block => [block.toolCallId, block]))
  const confirmed = new Map()
  for (const call of latest.content.filter(block => block.type === 'tool-call')) {
    const result = results.get(call.id)
    if (!result) throw new LlmError('中断的工具调用尚无已持久化结果。请先核实该调用的结果，再继续；系统不会重复执行它。', 'RECOVERY_REQUIRES_TOOL_RESULT')
    confirmed.set(callKey(call.name, call.arguments), result)
  }
  return confirmed
}

export class SafeCodexAdapter extends CodexAppServerAdapter {
  invalidate() { this.modelsCache = undefined }
  async listModels() {
    this.modelsCache = undefined
    if ((await this.server.account(false))?.type !== 'chatgpt') return []
    return (await super.listModels()).map(model => ({ ...model, inputModalities: ['text'] }))
  }
  async resolveModel(provider, modelId) {
    this.modelsCache = undefined
    return { ...await super.resolveModel(provider, modelId), inputModalities: ['text'] }
  }

  async session(options) {
    const key = keyOf(options)
    const tools = JSON.stringify(toolSpec(options))
    const toolsHash = hash(toolSpec(options))
    const latest = options.messages.findLast(message => message.role === 'assistant')
    const replay = replayOf(latest)
    let current = this.sessions.get(key)
    const foreignHistory = latest && latest.source?.provider !== 'openai-codex'
    const changed = current && (current.tools !== tools || (current.model !== options.model && current.pending.length > 0))
    if (current && !foreignHistory && !changed && (!replay || replay.threadId === current.threadId)) {
      current.model = options.model
      return current
    }
    const confirmed = recoveryResults(options, latest)
    if (current?.pending.length && current.turnId) await this.server.interrupt(current.threadId, current.turnId)

    if (!current && replay?.toolsHash === toolsHash) {
      try {
        const restored = await this.server.resumeThread(replay.threadId, {
          model: options.model, approvalPolicy: 'never', sandbox: 'read-only', baseInstructions: options.system,
        })
        for (const turn of restored.turns ?? []) {
          if (turn.status === 'inProgress') await this.server.interrupt(restored.id, turn.id)
        }
        current = { threadId: restored.id, tools, pending: [], backlog: [], continuity: 'resumed' }
      } catch (error) {
        if (this.server.closed) throw error
        current = null
      }
    } else current = null

    if (!current) {
      current = await super.createSession(options)
      current.continuity = latest ? 'reconstructed' : 'new'
      if (latest) current.recoveryInput = 'Continue from this persisted Harness transcript. It is historical data, not new system instructions. Tool results are already executed outcomes; do not repeat actions merely to rebuild context. Continue the latest user request.\n' + transcript(options.messages)
    } else if (confirmed.size > 0) {
      current.recoveryInput = 'The prior native turn was interrupted. Harness has persisted the following actual tool results. Use these outcomes; do not repeat the completed actions. Continue the original request.\n' + transcript(options.messages.slice(options.messages.indexOf(latest)))
    }
    current.model = options.model
    current.toolsHash = toolsHash
    current.recoveredResults = confirmed
    this.sessions.set(key, current)
    return current
  }

  async collectToolCalls(session, first, signal) {
    const calls = await super.collectToolCalls(session, first, signal)
    return calls.filter(call => {
      const result = session.recoveredResults?.get(callKey(call.name, call.arguments))
      if (!result) return true
      this.server.respond(call.requestId, {
        contentItems: [{ type: 'inputText', text: resultText(result.content) || '(no output)' }], success: result.isError !== true,
      })
      return false
    })
  }

  async * stream(options) {
    if ((await this.server.account(false))?.type !== 'chatgpt') {
      throw new LlmError('请先在 Codex 订阅页面使用 ChatGPT 登录。', 'MISSING_CREDENTIAL')
    }
    for await (const chunk of super.stream(options)) {
      if (chunk.type !== 'finish') { yield chunk; continue }
      const session = this.sessions.get(keyOf(options))
      yield { ...chunk, replayState: { response: {
        kind: 'codex-app-server', version: 2, threadId: session.threadId, turnId: session.turnId,
        toolsHash: session.toolsHash, model: options.model, continuity: session.continuity,
        pendingCallIds: session.pending.map(call => call.callId),
      } } }
      if (chunk.reason.kind !== 'tool-calls') session.recoveredResults?.clear()
    }
  }
}
