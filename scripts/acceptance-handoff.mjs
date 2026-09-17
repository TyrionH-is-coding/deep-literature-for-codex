import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = await fs.realpath(process.argv[2]);
const output = path.resolve(process.argv[3] || 'outputs/handoff-acceptance.json');
const installed = JSON.parse(await fs.readFile(path.join(root, 'installation.json'), 'utf8'));
const fromApp = file => import(pathToFileURL(path.join(installed.app, 'src', file)).href);
const { start, stop, status } = await fromApp('control.mjs');
const { call } = await fromApp('client.mjs');
const { dshRpc, CATEGORY_TOOLS } = await fromApp('bridge-services.mjs');
const { writeJson } = await fromApp('core.mjs');
const results = { root, version: installed.version, appSha256: installed.appSha256, aSha256: installed.pins.plugin.sha256, checks: [], startedAt: new Date().toISOString() };
const check = (name, value) => { assert.ok(value, name); results.checks.push({ name, passed: true }); };
const invoke = async (action, payload = {}) => (await call(root, { action, payload })).value;
const patchPath = path.join(root, 'state', 'dsh-home', 'profiles', 'workbench', 'cordis.patch.yml');
const originalPatch = await fs.readFile(patchPath);
const stamp = String(Date.now());
try {
  let running = await start(root);
  const folder1 = await invoke('folder_create', { name: '验收分类甲-' + stamp });
  const folder2 = await invoke('folder_create', { name: '验收分类乙-' + stamp });
  const paper1 = await invoke('ingest', { metadata: { title: 'Synthetic isolation acceptance Alpha ' + stamp, year: 2026 } });
  const paper2 = await invoke('ingest', { metadata: { title: 'Synthetic isolation acceptance Beta ' + stamp, year: 2026 } });
  results.folders = [folder1, folder2]; results.papers = [paper1.paper_id, paper2.paper_id];
  await invoke('move', { paperId: paper1.paper_id, folderId: folder1.folder_id });
  await invoke('move', { paperId: paper2.paper_id, folderId: folder2.folder_id });
  const binding1 = await invoke('bind', { folderId: folder1.folder_id });
  const binding2 = await invoke('bind', { folderId: folder2.folder_id });
  check('two categories have different native sessions', binding1.sessionId !== binding2.sessionId);
  check('native session reuses stable binding', (await invoke('bind', { folderId: folder1.folder_id })).sessionId === binding1.sessionId);
  const request1 = { idempotencyKey: 'acceptance-alpha-' + stamp, paperId: paper1.paper_id, folderId: folder1.folder_id, runAgent: false };
  const [task1, repeated] = await Promise.all([invoke('submit', request1), invoke('submit', request1)]);
  const task2 = await invoke('submit', { idempotencyKey: 'acceptance-beta-' + stamp, paperId: paper2.paper_id, folderId: folder2.folder_id, runAgent: false });
  check('concurrent real handoff has one parent job', task1.taskId === repeated.taskId && task1.jobId === repeated.jobId);
  results.tasks = [task1.taskId, task2.taskId];
  if (process.argv[4]) {
    let gate;
    for (let attempt = 0; attempt < 30; attempt++) {
      gate = await invoke('task', { taskId: task1.taskId });
      if (gate.status === 'waiting_user') break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    check('missing full text waits for user', gate.status === 'waiting_user' && gate.job.detail?.reason_code === 'pdf_required');
    const pdf = await fs.realpath(process.argv[4]);
    const attachment = { taskId: task1.taskId, idempotencyKey: 'attach-' + stamp, sourceType: 'manual', pdf };
    const attached = await invoke('attach', attachment);
    const twice = await invoke('attach', attachment);
    check('manual PDF continues the same task idempotently', attached.jobId === task1.jobId && twice.jobId === task1.jobId && Object.keys(twice.operations).length === 1);
    const expectedSha = createHash('sha256').update(await fs.readFile(pdf)).digest('hex');
    const storedPdf = path.join(root, 'library', 'papers', paper1.paper_id, 'source.pdf');
    check('A published the exact imported PDF bytes', createHash('sha256').update(await fs.readFile(storedPdf)).digest('hex') === expectedSha);
    const listingWithPdf = await invoke('list', { folderId: folder1.folder_id });
    check('A library reports real PDF availability', listingWithPdf.items.find(row => row.paper_id === paper1.paper_id)?.has_pdf === true);
    results.manualPdfSha256 = expectedSha;
  }
  await invoke('folder_rename', { folderId: folder1.folder_id, name: '验收甲改名-' + stamp });
  check('rename preserves session', (await invoke('bind', { folderId: folder1.folder_id })).sessionId === binding1.sessionId);
  const fixture = fileURLToPath(new URL('./fixtures/scope-probe.mjs', import.meta.url));
  await stop(root);
  const localModel = fileURLToPath(new URL('./fixtures/local-model.mjs', import.meta.url));
  await writeJson(patchPath, [{ insert: [{ id: 'csr-acceptance-scope', name: pathToFileURL(fixture).href,
    config: { sessionId: binding1.sessionId, ownJobId: task1.jobId, foreignPaperId: paper2.paper_id, foreignJobId: task2.jobId } },
    { id: 'acceptance-local', name: pathToFileURL(localModel).href, config: { dshEntry: installed.dsh } }] }]);
  running = await start(root);
  await invoke('bind', { folderId: folder1.folder_id });
  const probeResponse = await fetch(running.url + '/__workbench/acceptance-scope');
  const probe = await probeResponse.json(); results.scopeProbe = probe;
  check('actual native scope fixture loaded', probeResponse.ok);
  check('native status tool returns canonical JSON for own waiting job', probe.ownJob.isError === false
    && probe.ownJob.value?.job_id === task1.jobId);
  const listing = JSON.stringify(probe.listing);
  check('native tool without folder argument remains scoped', probe.listing.isError === false && listing.includes(paper1.paper_id) && !listing.includes(paper2.paper_id));
  check('foreign job blocked before TS fast path', probe.foreignJob.isError === true);
  check('foreign full-read cannot start', probe.foreignStart.isError === true || probe.foreignStart.value?.ok === false || probe.foreignStart.value?.status === 'failed');
  check('registered escape tool denied before body', probe.escape.isError === true && probe.escapeBodyEntered === false);
  check('native model schema excludes escape tools', probe.tools.length > 0 && probe.tools.every(tool => CATEGORY_TOOLS.has(tool)));
  check('genuine native child inherits category query and write boundary', probe.childListing.isError === false
    && JSON.stringify(probe.childListing).includes(paper1.paper_id) && !JSON.stringify(probe.childListing).includes(paper2.paper_id)
    && probe.childForeignJob.isError === true);
  await dshRpc(running.url, 'session.selectModel', { sessionId: binding1.sessionId, provider: 'acceptance-local', model: 'scope-smoke' });
  async function toolRound(expectedCompletions) {
    await dshRpc(running.url, 'session.prompt', { sessionId: binding1.sessionId, mode: 'queue',
      content: [{ type: 'text', text: '执行合成查询的本地工具闭环验收。' }] });
    for (let attempt = 0; attempt < 60; attempt++) {
      const history = await dshRpc(running.url, 'session.history', { sessionId: binding1.sessionId, maxMessages: 100 });
      const completions = history.events.filter(({ event }) => event?.type === 'assistant/message'
        && event.data?.message?.source?.provider === 'acceptance-local'
        && event.data.message.content.some(block => block.type === 'text' && block.text.includes('ACCEPTANCE_LOCAL_TOOL_LOOP_OK'))).length;
      if (completions >= expectedCompletions) return { completions, events: history.events.length };
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error('native_tool_round_did_not_complete');
  }
  results.firstToolRound = await toolRound(1);
  check('native model executes real scoped tool and receives its result', true);
  await stop(root); running = await start(root);
  await invoke('bind', { folderId: folder1.folder_id });
  const catalog = await dshRpc(running.url, 'session.models', { sessionId: binding1.sessionId });
  check('native model choice persists across host restart', catalog.current.provider === 'acceptance-local' && catalog.current.model === 'scope-smoke');
  results.secondToolRound = await toolRound(2);
  check('native persisted session completes a second real tool round', true);
  const nativeSessions = await dshRpc(running.url, 'session.list', {});
  results.nativeSessions = nativeSessions;
  check('restart preserves handoff and parent job', (await invoke('task', { taskId: task1.taskId })).jobId === task1.jobId);
  await invoke('move', { paperId: paper1.paper_id, folderId: folder2.folder_id });
  const moved = await invoke('task', { taskId: task1.taskId });
  check('old task cannot claim moved paper', moved.status === 'failed' && moved.error === 'scope_changed');
  await invoke('folder_archive', { folderId: folder2.folder_id, archived: true });
  const archived = await invoke('task', { taskId: task2.taskId });
  check('archived category invalidates old task', archived.status === 'failed' && archived.error === 'folder_archived');
  const wrongInstance = await fetch(running.url + '/__workbench/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instanceId: 'wrong', action: 'folders' }) });
  check('machine API rejects another instance', !wrongInstance.ok);
  results.passed = true;
} catch (error) { results.passed = false; results.error = error.stack; process.exitCode = 1; }
finally {
  await stop(root).catch(() => {});
  await fs.writeFile(patchPath, originalPatch);
  check('test-only profile patch removed', createHash('sha256').update(await fs.readFile(patchPath)).digest('hex') === createHash('sha256').update(originalPatch).digest('hex'));
  results.completedAt = new Date().toISOString();
  await writeJson(output, results); console.log(JSON.stringify(results, null, 2));
}
