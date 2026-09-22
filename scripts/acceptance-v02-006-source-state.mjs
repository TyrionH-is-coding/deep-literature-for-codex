import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { root, out, installed, read, start, stop, action, gate, env, save } from './fixtures/v02-006/common.mjs';
const fixture = path.join(import.meta.dirname, 'fixtures/v02-006');
const normal = await read(path.join(out, 'normal-formula-outline.json'));
const failure = await read(path.join(out, 'failure-formula-outline.json'));
const payload = await read(path.join(fixture, 'formula-outline.json'));
await start(root);
let task = await gate(failure.taskId);
if (task.job.detail.reason_code === 'translate_full_read') {
const source = await read(task.job.detail.required_input.source_manifest_path);
const translations = new Map(payload.translations.map(t => [t.block_id, t]));
await action('resume', { taskId: task.taskId, idempotencyKey: 'v006-source-to-review', input: { full_translation: {
  contract_version: 'full-translation-v3', batch_id: source.batch_id, source_sha256: source.source_sha256,
  translations: source.blocks.map(b => ({ block_id: b.block_id, source_text: b.english,
    translation_zh: translations.get(b.block_id).translation_zh, highlight: translations.get(b.block_id).highlight })) } } });
task = await gate(task.taskId);
}
assert.equal(task.job.detail.reason_code, 'review_full_read');
await stop(root);
const { Handoff } = await import(pathToFileURL(path.join(installed.app, 'src/modules/workflow/index.mjs')).href);
const service = new Handoff(root, { instance: await read(path.join(root, '.workbench.json')),
  engine: (args, input, scope) => {
    if (args[0] === 'full-read-pipeline-resume' && !args.includes('--resume-stopped')) throw Error('synthetic_prepared_delivery_failure');
    let output;
    try { output = execFileSync(installed.python, ['-I', '-X', 'utf8', '-m', 'scientific_reading', '--data-root', path.join(root, 'library'), ...args],
      { cwd: root, env: { ...env, ...(scope ? { SR_SCOPE_CONTEXT: JSON.stringify(scope) } : {}) }, input: input === undefined ? undefined : JSON.stringify(input), encoding: 'utf8', windowsHide: true }); }
    catch (error) { if (args[0] !== 'job-status' || ![2,3,4].includes(error.status)) throw error; output = error.stdout; }
    const result = JSON.parse(output); if (result.error) throw Error(result.error); return result;
  },
  rpc: async () => { throw Error('synthetic_delivery_uncertain'); },
  dispatchEvidence: async () => 'uncertain', cancelTask: async () => ({ status: 'synthetic_no_live_agent', canceled: false }),
  reader: async () => normal.reader });
service.data = await read(path.join(root, 'state/handoff.json'));
const uncertain = await service.dispatch(task.taskId, 'v006-uncertain-fixture');
assert.equal(uncertain.dispatch.status, 'uncertain');
let preparedFailure;
try { await service.operate(task.taskId, 'v006-prepared-fixture', 'resume', { input: {} }); }
catch (error) { preparedFailure = String(error); }
assert.ok(preparedFailure);
const stopped = await service.cancel(task.taskId);
assert.equal(stopped.control.stopRequested, true);
assert.equal(stopped.control.acknowledgedRevision, stopped.control.revision);
assert.ok(Object.values(stopped.operations).some(o => o.status === 'prepared'));

process.env.DSH_HOME = path.join(root, 'state/dsh-home');
const require = createRequire(installed.dsh);
const load = n => import(pathToFileURL(require.resolve('@deepseek-ai/' + n)).href);
const [{ Context }, { Session, default: Sessions }, { default: Persistence }, { Inbox }, { createUserMessage, createAssistantMessage }] = await Promise.all([
  load('cordis'), load('dsh-session'), load('dsh-session-persistence-jsonl'), load('dsh-agent'), load('dsh-llm')]);
const ctx = new Context(); ctx.plugin(Sessions); ctx.plugin(Persistence, { root: path.join(root, 'state/dsh-home/sessions'), compression: 'zstd' });
await new Promise(resolve => ctx.inject(['sessionPersistence'], resolve));
const childId = 'v006-pending-child';
try {
  const session = new Session(childId, [], { version: 0, id: childId, createdAt: Date.now(), cwd: await fs.realpath(path.join(root, 'workspace')),
    parentSession: normal.finalTask.sessionId, origin: 'subagent', delegationDepth: 1, agentPreset: 'scientific-reading' });
  const user = text => createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } });
  session.append('user/message', user('V006 synthetic uncertain tool outcome'), { surfaceOp: 'append' });
  session.append('turn/start', { turn: 1 }); session.append('step/start', { turn: 1, step: 1 });
  session.append('assistant/message', { turn: 1, step: 1, message: createAssistantMessage({ content: [{ type: 'tool-call', id: 'v006-unknown', name: 'sr_job_status', arguments: JSON.stringify({ job_id: normal.jobId }) }], source: { kind: 'model', provider: 'v006-local', model: 'counter' } }) }, { surfaceOp: 'append' });
  session.append('tool/call', { turn: 1, step: 1, callId: 'v006-unknown', name: 'sr_job_status', arguments: { job_id: normal.jobId } });
  const inbox = new Inbox(session, { inserted() {}, discarded() {}, claimed() {} });
  inbox.append('next-turn', user('V006_PENDING_TURN')); inbox.append('next-step', user('V006_PENDING_STEP'));
  await ctx.sessionPersistence.materialize(session.header, session.events);
} finally { await ctx.fiber.dispose(); }
const workspaceFile = path.join(root, 'state/dsh-home/storages/workspace.json');
const workspace = await read(workspaceFile);
workspace.tables.workspaces[workspace.global.workspaceIds[0]].sessionIds.push(childId);
await fs.writeFile(workspaceFile, JSON.stringify(workspace));
service.observeSession(childId, normal.finalTask.sessionId); await service.save();

// The synthetic parser executable is a fixture runtime, not a scientific asset.
// Remove it from the supported source before export; preserve it outside the instance.
const parser = path.join(root, 'library/.mineru-venv');
await fs.rename(parser, path.join('C:/tmp/v006', 'parked-synthetic-parser'));
await save('recovery-source-state', { taskId: task.taskId, parentJobId: task.jobId, childId, stopped,
  expectedRevision: stopped.control.revision, resumeInput: { full_review: payload.review }, preparedFailure, normalPaperId: normal.paperId });
console.log(JSON.stringify({ taskId: task.taskId, parentJobId: task.jobId, revision: stopped.control.revision, childId }));
