// Synthetic local LLM and observation only. Production bridge/Handoff own cancellation.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
export const name = 'v02-004j-probe';
export const inject = ['llm', 'agents', 'webServer', 'tools'];
export async function apply(ctx, config) {
  const require = createRequire(config.entry);
  const { LlmAdapter } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-llm')).href);
  const releases = new Set(); let calls = 0, aborted = 0;
  const model = { provider: 'v4j-local', id: 'synthetic', name: 'synthetic', inputModalities: ['text'] };
  ctx.llm.registerAdapter(['v4j-local'], new class extends LlmAdapter {
    providerInfo() { return { id: 'v4j-local', name: 'synthetic' }; }
    async listModels() { return [model]; }
    async resolveModel() { return model; }
    async *stream(options) {
      calls++;
      await new Promise(resolve => {
        let timer;
        const done = () => { clearTimeout(timer); releases.delete(done); options.signal?.removeEventListener('abort', onAbort); resolve(); };
        const onAbort = () => { aborted++; done(); };
        releases.add(done); timer = setTimeout(done, 120000);
        options.signal?.addEventListener('abort', onAbort, { once: true });
        if (options.signal?.aborted) onAbort();
      });
      if (options.signal?.aborted) return;
      yield { type: 'block-start', index: 0, blockType: 'text' };
      yield { type: 'text-delta', index: 0, text: 'SYNTHETIC' };
      yield { type: 'block-end', index: 0, block: { type: 'text', text: 'SYNTHETIC' } };
      yield { type: 'finish', reason: { kind: 'stop' } };
    }
  }());
  ctx.webServer.register({ kind: 'exact', path: '/v4j-probe', async handler(req, res) {
    try {
      let body = ''; for await (const bytes of req) body += bytes;
      const p = JSON.parse(body), agent = ctx.agents.get(p.sessionId);
      const toolResult = p.action === 'advance' ? await ctx.tools.execute({callId:'v004k-stop-guard',name:'sr_continue_full_read',arguments:{job_id:p.jobId,input:{}},agent,signal:new AbortController().signal}) : undefined;
      if (p.action === 'stage-shared') for (const id of p.rpcIds) agent.inbox.append('next-step', {
        id, role: 'user', source: { kind: 'user', rpcId: id }, content: [{ type: 'text', text: 'SYNTHETIC ' + id }] });
      if (p.action === 'release') for (const release of [...releases]) release();
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ calls, aborted, toolResult, status: agent?.status,
        queue: agent ? [...agent.inbox.nextTurn, ...agent.inbox.nextStep].map(m => m.source?.rpcId) : [],
        events: agent?.session.events.filter(e => ['turn/start', 'turn/end', 'user/message', 'agent/inbox/spliced'].includes(e.type)) }));
    } catch (error) { res.writeHead(500); res.end(String(error.stack)); }
  } });
}
