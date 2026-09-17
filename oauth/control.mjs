const PROVIDER = 'openai-codex'
const unavailable = reason => ({ status: 'unavailable', reason, scope: 'account', sharedAcrossClients: true, buckets: [] })
const finite = value => typeof value === 'number' && Number.isFinite(value)

function windowView(value) {
  if (!value || !finite(value.usedPercent)) return null
  return {
    usedPercent: value.usedPercent,
    remainingPercent: Math.max(0, Math.min(100, 100 - value.usedPercent)),
    windowDurationMins: finite(value.windowDurationMins) ? value.windowDurationMins : null,
    resetsAt: finite(value.resetsAt) ? value.resetsAt : null,
  }
}

export function normalizeUsage(result) {
  const entries = result?.rateLimitsByLimitId && typeof result.rateLimitsByLimitId === 'object'
    ? Object.entries(result.rateLimitsByLimitId)
    : result?.rateLimits ? [[result.rateLimits.limitId ?? 'codex', result.rateLimits]] : []
  const buckets = entries.map(([id, value]) => ({
    id, name: typeof value?.limitName === 'string' ? value.limitName : null,
    primary: windowView(value?.primary), secondary: windowView(value?.secondary),
  })).filter(bucket => bucket.primary !== null || bucket.secondary !== null)
  return buckets.length
    ? { status: 'available', scope: 'account', sharedAcrossClients: true, buckets }
    : unavailable('not_reported')
}

export class OAuthControl {
  constructor(server, { onAccountChange = () => {} } = {}) {
    this.server = server
    this.loginState = null
    this.onAccountChange = onAccountChange
    this.unsubscribe = server.onNotification(({ method, params }) => {
      if (method === 'account/updated') this.onAccountChange()
      if (method === 'account/login/completed' && params.loginId === this.loginState?.loginId) {
        if (this.loginState.status === 'canceled') return
        this.loginState = { loginId: params.loginId, status: params.success === true ? 'completed' : 'failed' }
        this.onAccountChange()
      }
    })
  }

  async status() {
    const base = { authenticated: false, provider: PROVIDER, planType: null, models: [], login: this.loginState }
    try {
      const account = await this.server.account(false)
      if (!account) return { status: 'unauthenticated', ...base }
      if (account.type !== 'chatgpt') return { status: 'unsupported_auth', ...base }
      const models = (await this.server.models()).filter(model => model.hidden !== true).map(model => ({
        id: String(model.model ?? model.id), name: String(model.displayName ?? model.model ?? model.id),
      }))
      return { ...base, status: 'authenticated', authenticated: true, planType: typeof account.planType === 'string' ? account.planType : null, models, login: this.loginState }
    } catch {
      return { status: 'unavailable', ...base, reason: 'request_failed' }
    }
  }

  async login() {
    if (this.loginState?.status === 'pending' || this.loginState?.status === 'starting') throw new Error('LOGIN_IN_PROGRESS')
    this.loginState = { status: 'starting' }
    try {
      const result = await this.server.request('account/login/start', {
        type: 'chatgpt', useHostedLoginSuccessPage: true, appBrand: 'chatgpt',
      })
      const url = new URL(result.authUrl)
      if (url.protocol !== 'https:' || !['auth.openai.com', 'chatgpt.com'].includes(url.hostname) || url.username || url.password || typeof result.loginId !== 'string') {
        if (typeof result.loginId === 'string') await this.server.request('account/login/cancel', { loginId: result.loginId })
        throw new Error('LOGIN_RESPONSE_INVALID')
      }
      this.loginState = { status: 'pending', loginId: result.loginId }
      return { status: 'pending', authUrl: result.authUrl, loginId: result.loginId }
    } catch {
      this.loginState = { status: 'failed' }
      throw new Error('LOGIN_START_FAILED')
    }
  }

  async cancelLogin() {
    if (this.loginState?.status !== 'pending') return { status: 'not_found' }
    await this.server.request('account/login/cancel', { loginId: this.loginState.loginId })
    this.loginState = { status: 'canceled', loginId: this.loginState.loginId }
    return { status: 'canceled' }
  }

  async logout() {
    await this.cancelLogin()
    await this.server.request('account/logout', {})
    this.loginState = null
    this.onAccountChange()
    return { status: 'unauthenticated' }
  }

  async usage() {
    try {
      if ((await this.server.account(false))?.type !== 'chatgpt') return unavailable('not_authenticated')
      return normalizeUsage(await this.server.request('account/rateLimits/read', {}))
    } catch { return unavailable('request_failed') }
  }

  async close() {
    try { await this.cancelLogin() } finally { this.unsubscribe(); await this.server.close() }
  }
}
