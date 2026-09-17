// Derived from DGPisces/dsh-openai-oauth 0.4.0 (MIT), lib/app-server.js.
// B changes: explicit isolated home, direct native child, safe errors and bounded lifecycle.
import { spawn } from 'node:child_process'
import { mkdir, realpath } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createInterface } from 'node:readline'
import { dirname, isAbsolute, join } from 'node:path'

export function isolatedEnvironment(home, source = process.env) {
  const allowed = /^(path|systemroot|windir|comspec|pathext|temp|tmp|userprofile|home|appdata|localappdata|lang|lc_all|https?_proxy|all_proxy|no_proxy|node_extra_ca_certs|ssl_cert_file|ssl_cert_dir)$/i
  return { ...Object.fromEntries(Object.entries(source).filter(([key]) => allowed.test(key))), CODEX_HOME: home }
}

export function codexExecutable({ platform = process.platform, arch = process.arch,
  resolvePackage = createRequire(import.meta.url).resolve } = {}) {
  // Match the native package layout shipped by the pinned official Codex CLI.
  const targets = {
    'win32-x64': 'x86_64-pc-windows-msvc',
    'darwin-arm64': 'aarch64-apple-darwin',
    'darwin-x64': 'x86_64-apple-darwin',
    'linux-arm64': 'aarch64-unknown-linux-musl',
    'linux-x64': 'x86_64-unknown-linux-musl',
  }
  const triple = targets[`${platform}-${arch}`]
  if (!triple) throw new Error(`Unsupported Codex OAuth platform: ${platform}-${arch}`)
  return join(dirname(resolvePackage(`@openai/codex-${platform}-${arch}/package.json`)),
    'vendor', triple, 'bin', platform === 'win32' ? 'codex.exe' : 'codex')
}

class EventQueue {
  values = []
  waiters = []
  error = null
  push(value) {
    const waiter = this.waiters.shift()
    waiter ? waiter.resolve(value) : this.values.push(value)
  }
  fail(error) {
    this.error = error
    this.values = []
    for (const waiter of this.waiters.splice(0)) waiter.reject(error)
  }
  take(signal) {
    if (this.error) return Promise.reject(this.error)
    if (signal?.aborted) return Promise.reject(signal.reason)
    if (this.values.length) return Promise.resolve(this.values.shift())
    return new Promise((resolve, reject) => {
      const cleanup = () => signal?.removeEventListener('abort', abort)
      const waiter = { resolve: value => { cleanup(); resolve(value) }, reject: error => { cleanup(); reject(error) } }
      const abort = () => { this.waiters = this.waiters.filter(entry => entry !== waiter); waiter.reject(signal.reason) }
      signal?.addEventListener('abort', abort, { once: true })
      this.waiters.push(waiter)
    })
  }
}

export class AppServer {
  child = null
  nextId = 1
  pending = new Map()
  queues = new Map()
  turnThreads = new Map()
  listeners = new Set()
  starting = null
  closed = false

  constructor({ stateRoot, command, requestTimeoutMs = 20000 } = {}) {
    if (typeof stateRoot !== 'string' || !stateRoot) throw new Error('stateRoot is required')
    if (!isAbsolute(stateRoot)) throw new Error('stateRoot must be absolute')
    this.stateRoot = stateRoot
    this.home = join(stateRoot, 'codex-home')
    this.command = command
    this.requestTimeoutMs = requestTimeoutMs
  }

  onNotification(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener) }

  async start() {
    if (this.closed) throw new Error('Codex app-server is closed')
    this.starting ??= this.startInner()
    return this.starting
  }

  async startInner() {
    await mkdir(this.home, { recursive: true, mode: 0o700 })
    if ((await realpath(this.home)).toLowerCase() !== join(await realpath(this.stateRoot), 'codex-home').toLowerCase()) throw new Error('Codex home must remain inside instance state')
    if (this.closed) throw new Error('Codex app-server is closed')
    const [executable, ...prefix] = this.command ?? [codexExecutable()]
    const disabled = ['shell_tool', 'goals', 'apps', 'browser_use', 'computer_use', 'hooks', 'image_generation', 'in_app_browser', 'multi_agent', 'plugins', 'skill_search', 'tool_suggest', 'unified_exec', 'workspace_dependencies']
    const args = [
      ...prefix, ...disabled.flatMap(feature => ['-c', `features.${feature}=false`]),
      '-c', 'web_search="disabled"', '-c', 'agents.enabled=false', '-c', 'tools.view_image=false',
      '-c', 'project_doc_max_bytes=0', '-c', 'model_provider="openai"',
      '-c', 'forced_login_method="chatgpt"', '-c', 'cli_auth_credentials_store="file"',
      'app-server', '--listen', 'stdio://',
    ]
    const child = this.child = spawn(executable, args, {
      cwd: this.home, env: isolatedEnvironment(this.home), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.exited = new Promise(resolve => child.once('close', resolve))
    createInterface({ input: child.stdout }).on('line', line => {
      try { this.receive(JSON.parse(line)) } catch { this.fail(new Error('Codex app-server protocol error')); child.kill() }
    })
    // Drain without logging: upstream stderr and RPC errors may contain authentication data.
    child.stderr.resume()
    child.stdin.on('error', () => this.fail(new Error('Codex app-server input closed')))
    child.on('error', () => this.fail(new Error('Codex app-server failed to start')))
    child.on('close', code => { this.fail(new Error(`Codex app-server exited (${String(code)})`)); this.child = null })
    await this.request('initialize', {
      clientInfo: { name: 'codex_scientific_reading', title: 'Deep Literature for Codex', version: '0.1.0' },
      capabilities: { experimentalApi: true },
    })
    this.send({ method: 'initialized', params: {} })
  }

  fail(error) {
    this.closed = true
    for (const request of this.pending.values()) request.reject(error)
    this.pending.clear()
    for (const queue of this.queues.values()) queue.fail(error)
  }

  send(message) {
    if (!this.child || this.closed) throw new Error('Codex app-server is closed')
    this.child.stdin.write(`${JSON.stringify(message)}\n`)
  }

  receive(message) {
    if (!message || typeof message !== 'object') throw new Error('protocol')
    const { id, method, params } = message
    if (typeof id === 'number' && ('result' in message || 'error' in message)) {
      const request = this.pending.get(id)
      if (!request) return
      this.pending.delete(id)
      message.error ? request.reject(new Error(`Codex RPC failed (${Number(message.error.code) || 'unknown'})`)) : request.resolve(message.result)
      return
    }
    if (typeof method !== 'string' || !params) return
    if (id === undefined) for (const listener of this.listeners) listener({ method, params })
    const threadId = typeof params.threadId === 'string' ? params.threadId : this.turnThreads.get(params.turn?.id)
    if (id !== undefined && (method !== 'item/tool/call' || !threadId)) {
      this.send({ id, error: { code: -32601, message: 'Unsupported request' } })
    }
    if (threadId) this.queue(threadId).push({ method, params, ...(id === undefined ? {} : { requestId: id }) })
  }

  queue(threadId) {
    if (!this.queues.has(threadId)) this.queues.set(threadId, new EventQueue())
    return this.queues.get(threadId)
  }

  async request(method, params = {}) {
    if (method !== 'initialize') await this.start()
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.fail(new Error('Codex app-server request timed out'))
        this.child?.kill()
      }, this.requestTimeoutMs)
      const pending = {
        resolve: value => { clearTimeout(timeout); resolve(value) },
        reject: error => { clearTimeout(timeout); reject(error) },
      }
      this.pending.set(id, pending)
      try { this.send({ id, method, params }) } catch (error) { this.pending.delete(id); pending.reject(error) }
    })
  }

  async account(refreshToken = false) { return (await this.request('account/read', { refreshToken })).account ?? null }
  async models() { return (await this.request('model/list', {})).data ?? [] }
  async startThread(input) {
    const result = await this.request('thread/start', { ...input, cwd: this.home, allowProviderModelFallback: false })
    if (typeof result.thread?.id !== 'string') throw new Error('Codex returned no thread id')
    this.queue(result.thread.id)
    return result.thread.id
  }
  async resumeThread(threadId, input = {}) {
    const result = await this.request('thread/resume', { ...input, threadId, cwd: this.home })
    if (result.thread?.id !== threadId) throw new Error('Codex resumed an unexpected thread')
    this.queue(threadId)
    return result.thread
  }
  async startTurn(threadId, input) {
    const result = await this.request('turn/start', { threadId, ...input })
    if (typeof result.turn?.id !== 'string') throw new Error('Codex returned no turn id')
    this.turnThreads.set(result.turn.id, threadId)
    return result.turn.id
  }
  nextEvent(threadId, signal) {
    if (this.closed) return Promise.reject(new Error('Codex app-server is closed'))
    return this.queue(threadId).take(signal)
  }
  respond(id, result) { this.send({ id, result }) }
  async interrupt(threadId, turnId) {
    await this.request('turn/interrupt', { threadId, turnId })
    const queue = this.queues.get(threadId)
    if (queue) queue.values = queue.values.filter(event => (event?.params?.turnId ?? event?.params?.turn?.id) !== turnId)
  }
  async close() {
    this.fail(new Error('Codex app-server is closed'))
    if (!this.child) return
    this.child.stdin.end()
    const force = setTimeout(() => this.child?.kill(), 1500)
    try { await this.exited } finally { clearTimeout(force) }
  }
}
