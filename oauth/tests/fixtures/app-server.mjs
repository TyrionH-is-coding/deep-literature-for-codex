import { createInterface } from 'node:readline'
const send = value => process.stdout.write(`${JSON.stringify(value)}\n`)
for await (const line of createInterface({ input: process.stdin })) {
  const message = JSON.parse(line)
  if (message.method === 'initialize') send({ id: message.id, result: { userAgent: 'offline-fixture' } })
  if (message.method === 'account/read') send({ id: message.id, result: { account: null } })
  if (message.method === 'fixture/environment') send({ id: message.id, result: {
    codexHome: process.env.CODEX_HOME, hasApiKey: Boolean(process.env.OPENAI_API_KEY), hasOuterConfig: Boolean(process.env.CODEX_CONFIG), cwd: process.cwd(),
  } })
  if (message.method === 'fixture/notification') {
    send({ method: 'account/login/completed', params: { loginId: 'offline-login', success: false } })
    send({ id: message.id, result: {} })
  }
  if (message.method === 'fixture/crash') process.exit(7)
  if (message.method === 'fixture/malformed') process.stdout.write('not-json\n')
  if (message.method === 'fixture/error') send({ id: message.id, error: { code: 123, message: 'SECRET-FIXTURE-SHOULD-NOT-LEAK' } })
  if (message.method === 'fixture/noise') { process.stderr.write('SECRET-FIXTURE-SHOULD-NOT-LEAK'); send({ id: message.id, result: {} }) }
}
