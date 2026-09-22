import fs from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
export const name = 'v006-local-counter';
export const inject = ['llm', 'tools'];
export async function apply(ctx, config) {
  const require = createRequire(config.entry);
  const { LlmAdapter } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-llm')).href);
  const bump = kind => fs.appendFileSync(config.counter, JSON.stringify({ kind, at: new Date().toISOString() }) + '\n');
  const model = { provider: 'v006-local', id: 'counter', name: 'V006 offline counter', inputModalities: ['text'] };
  ctx.llm.registerAdapter(['v006-local'], new class extends LlmAdapter {
    providerInfo() { return { id: 'v006-local', name: 'V006 offline counter' }; }
    async listModels() { return [model]; }
    async resolveModel() { return model; }
    async *stream(options) {
      bump('model');
      const lastUser = options.messages.findLastIndex(m => m.source.kind === 'user');
      if (!options.messages.slice(lastUser + 1).some(m => m.source.kind === 'tool')) {
        const id = 'v006-positive-' + Date.now();
        yield { type: 'block-start', index: 0, blockType: 'tool-call' };
        yield { type: 'tool-call-delta', index: 0, id, name: 'sr_job_status', argumentsDelta: JSON.stringify({ job_id: config.jobId }) };
        yield { type: 'block-end', index: 0, block: { type: 'tool-call', id, name: 'sr_job_status', arguments: JSON.stringify({ job_id: config.jobId }) } };
        yield { type: 'finish', reason: { kind: 'tool-calls' } }; return;
      }
      yield { type: 'block-start', index: 0, blockType: 'text' };
      yield { type: 'text-delta', index: 0, text: 'V006 synthetic history: completed tool result retained.' };
      yield { type: 'block-end', index: 0, block: { type: 'text', text: 'V006 synthetic history: completed tool result retained.' } };
      yield { type: 'finish', reason: { kind: 'stop' } };
    }
  }());
  ctx.on('tools/execute', async (_exec, next) => { bump('tool'); return next(); });
  ctx.on('agent/created', () => bump('agent-created'));
  bump('armed');
}
