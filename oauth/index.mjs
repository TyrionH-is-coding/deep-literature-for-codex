import { AppServer } from './app-server.mjs'
import { OAuthControl } from './control.mjs'
import { oauthRoute } from './http.mjs'
import { SafeCodexAdapter } from './adapter.mjs'
export { SafeCodexAdapter } from './adapter.mjs'

export const name = 'scientific-reading-codex'
export const inject = ['llm']

export function createOAuthRuntime(config) {
  const server = new AppServer(config)
  const adapter = new SafeCodexAdapter(server)
  const control = new OAuthControl(server, { onAccountChange: () => adapter.invalidate() })
  return { server, adapter, control, start: () => server.start(), stop: () => control.close() }
}

export function apply(ctx, config) {
  const runtime = createOAuthRuntime(config)
  ctx.llm.registerAdapter(['openai-codex'], runtime.adapter)
  ctx.effect(() => () => runtime.stop(), 'scientific-reading-codex.close')
  ctx.inject(['webServer'], webCtx => {
    webCtx.effect(() => webCtx.webServer.register(oauthRoute(runtime.control)), 'scientific-reading-codex.http')
  })
}

export default { name, inject, apply }
