// 仅用于专用验收 Profile；不加入生产 bundle，不发起模型网络请求。
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'

export const name = 'acceptance-local'
export const inject = ['llm']
export const COMPLETION_TEXT = '本地闭环验收完成（ACCEPTANCE_LOCAL_TOOL_LOOP_OK）：已收到 sr_library_list 工具结果。'
const MODEL = 'scope-smoke'
const TOOL = 'sr_library_list'
const TOOL_ARGS = JSON.stringify({ page: 1, page_size: 1, query: '__codex_b_acceptance_fixture_only__' })

export async function createAcceptanceAdapter(config = {}) {
  if (typeof config.dshEntry !== 'string' || !isAbsolute(config.dshEntry)) {
    throw new Error('acceptance-local requires an absolute config.dshEntry from installation.dsh')
  }
  const requireFromHost = createRequire(config.dshEntry)
  const { LlmAdapter, LlmError, CallId } = await import(pathToFileURL(requireFromHost.resolve('@deepseek-ai/dsh-llm')).href)
  const model = { provider: name, id: MODEL, name: '本地工具闭环验收（不连接模型）', inputModalities: ['text'] }
  return new class extends LlmAdapter {
    providerInfo() { return { id: name, name: '本地验收专用' } }
    async listModels() { return [model] }
    async resolveModel(provider, modelId) {
      if (provider !== name || modelId !== MODEL) throw new LlmError('Unknown acceptance model', 'UNKNOWN_MODEL')
      return model
    }
    async *stream(options) {
      if (options.signal?.aborted) throw new LlmError('Acceptance aborted', 'ABORTED')
      await this.resolveModel(options.provider, options.model)
      if (!(options.tools ?? []).some(tool => tool.name === TOOL)) {
        throw new LlmError('The scoped sr_library_list tool is unavailable', 'ACCEPTANCE_TOOL_NOT_AVAILABLE')
      }
      const currentUser = options.messages.findLastIndex(message => message.role === 'user' && message.source.kind === 'user')
      if (currentUser < 0) throw new LlmError('Acceptance requires a user message', 'INVALID_REQUEST')
      const seed = JSON.stringify([options.sessionId, options.messages[currentUser].id])
      const callId = CallId(`acceptance-local-${createHash('sha256').update(seed).digest('hex').slice(0, 24)}`)
      const current = options.messages.slice(currentUser + 1)
      const callIndex = current.findIndex(message => message.role === 'assistant' && message.source.kind === 'model'
        && message.source.provider === name && message.content.some(block => block.type === 'tool-call' && block.id === callId && block.name === TOOL))
      if (callIndex < 0) {
        yield { type: 'block-start', index: 0, blockType: 'tool-call' }
        yield { type: 'tool-call-delta', index: 0, id: callId, name: TOOL, argumentsDelta: TOOL_ARGS }
        yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: callId, name: TOOL, arguments: TOOL_ARGS } }
        yield { type: 'finish', reason: { kind: 'tool-calls' } }
        return
      }
      const toolMessage = current.slice(callIndex + 1).find(message => message.source.kind === 'tool' && message.source.callId === callId)
      const result = toolMessage?.content.find(block => block.type === 'tool-result' && block.toolCallId === callId)
      if (!result || !Array.isArray(result.content) || result.content.length === 0) {
        throw new LlmError('No matching DSH tool result has arrived', 'ACCEPTANCE_TOOL_RESULT_MISSING')
      }
      if (result.isError === true) throw new LlmError('The DSH tool returned a failure', 'ACCEPTANCE_TOOL_FAILED')
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text: COMPLETION_TEXT }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: COMPLETION_TEXT } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    }
  }()
}

export async function apply(ctx, config) {
  ctx.llm.registerAdapter([name], await createAcceptanceAdapter(config))
}

export default { name, inject, apply }
