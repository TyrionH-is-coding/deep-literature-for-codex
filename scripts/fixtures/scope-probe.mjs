// Loaded only by acceptance-handoff.mjs into its private test profile.
import { randomUUID } from 'node:crypto';
export const name = 'csr-acceptance-scope';
export const inject = ['webServer', 'agents', 'tools', 'systemPrompt', 'agentPresets'];
export function apply(ctx, config) {
  let escapeBodyEntered = false;
  ctx.tools.register({ name: 'csr_escape_probe', description: 'Acceptance fixture; must never execute in category agents.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: { schema: { type: 'object', properties: {}, additionalProperties: false }, render: () => [] },
    async execute() { escapeBodyEntered = true; return {}; } });
  ctx.webServer.register({ kind: 'exact', path: '/__workbench/acceptance-scope', async handler(_req, res) {
    try {
      const agent = ctx.agents.get(config.sessionId);
      if (!agent) throw new Error('test_agent_missing');
      const run = (name, args) => ctx.tools.execute({ name, arguments: args, agent, callId: 'acceptance-' + name, signal: new AbortController().signal });
      const listing = await run('sr_library_list', {});
      const ownJob = await run('sr_job_status', { job_id: config.ownJobId });
      const foreignJob = await run('sr_job_status', { job_id: config.foreignJobId });
      const foreignStart = await run('sr_start_full_read', { paper_id: config.foreignPaperId });
      const escape = await run('csr_escape_probe', {});
      const assembly = await ctx.systemPrompt.assemble({ scope: agent });
      const child = await ctx.agents.create({ sessionId: 'session-' + randomUUID(),
        meta: { cwd: agent.session.header.cwd, parentSession: agent.session.id, origin: 'subagent', agentPreset: 'scientific-reading' },
        setup: async childCtx => { await ctx.agentPresets.mount(childCtx, 'scientific-reading'); } });
      let childListing, childForeignJob;
      try {
        const execute = (name, args) => ctx.tools.execute({ name, arguments: args, agent: child.agent,
          callId: 'child-acceptance-' + name, signal: new AbortController().signal });
        childListing = await execute('sr_library_list', {});
        childForeignJob = await execute('sr_job_status', { job_id: config.foreignJobId });
      } finally { await child.dispose(); }
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ listing, ownJob, foreignJob, foreignStart, escape, escapeBodyEntered,
        childListing, childForeignJob, childSessionId: child.agent.session.id,
        tools: assembly.tools.map(tool => tool.name) }));
    } catch (error) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: error.message })); }
  } });
}
