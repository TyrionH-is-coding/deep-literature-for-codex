import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const base = 'C:/tmp/v006', repo = path.resolve(import.meta.dirname, '..');
const review = path.join(base, 'candidate-r4/review');
const read = async f => JSON.parse((await fs.readFile(f, 'utf8')).replace(/^\uFEFF/, ''));
const record = async file => { const bytes = await fs.readFile(file); return { path: file.replaceAll('\\', '/'), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }; };
const selected = ['a-artifact.json', 'install-cache.json', 'backup-concurrency-r4.json', 'restore-restored-r4.json',
 'restore-恢复 工作台 r4.json', 'validate-before-confirm-r4.json', 'validate-chinese-before-confirm-r4.json',
 'validate-chinese-after-confirm-r4.json', 'gate-before-confirm-r4.json', 'gate-chinese-before-confirm-r4.json',
 'gate-chinese-after-confirm-r4.json', 'continue-restored-r4.json', 'continue-恢复 工作台 r4.json',
 'derived-crash-r4.json', 'failure-matrix-r4.json', 'interruption-r4.json', 'dsh-import-failure-r4.json',
 'scientific-assets-r4.json', 'closeout-r4.json', 'process-closeout-r4.json', 'source/native-positive.json',
 'source/recovery-source-state.json', 'source/multigate-source.json', 'source/personal-authored.json',
 'source/personal-import.json', 'source/personal-verified.json'];
const positives = await read(path.join(base, 'evidence/source/native-positive.json'));
selected.push(path.relative(path.join(base, 'evidence'), positives.counter));
const logs = ['a-engine-all-6.txt', 'a-grant-stop-6.txt', 'a-freeze-5.txt', 'a-offline-r3.txt', 'a-offline-tail-r3.txt',
 'a-assets-r3.txt', 'b-all-6.txt', 'b-modules-final.txt', 'b-impact-final.json', 'package-r4.txt',
 'install-source-r4.txt', 'derived-crash-r4b.txt', 'dsh-import-failure-r4.txt', 'interruption-r4.txt'];
await fs.mkdir(review, { recursive: true });
const archived = [];
for (const [category, names] of [['evidence', selected], ['logs', logs]]) {
 for (const name of names) {
  const source = path.join(base, category, name), target = path.join(review, category, name);
  await fs.mkdir(path.dirname(target), { recursive: true }); await fs.copyFile(source, target);
  const original = await record(source), copy = await record(target); assert.equal(original.sha256, copy.sha256);
  archived.push({ category, ...original, archivedPath: copy.path });
 }
}
for (const root of ['source', 'restored-r4', '恢复 工作台 r4', 'derived-fault-r4', 'dsh-failed-r4']) {
 const target = path.join(review, 'installations', root + '.json'); await fs.mkdir(path.dirname(target), { recursive: true });
 await fs.copyFile(path.join(base, root, 'installation.json'), target); archived.push({ category: 'installed-identity', ...await record(target) });
}
const artifacts = [];
for (const [file, expected] of [
 ['build/a/dsh-external-dsh-scientific-reading-0.2.0-dev.5.tgz', '1c034c3e2e8f4b212a35fc0b03a614ef64843488d1daf4e604bc2820d0381c65'],
 ['build/a/dist/python/dsh_scientific_reading_engine-0.2.0.dev4-py3-none-any.whl', 'b7c04ce35f403879334114b937715ab1f5295570bc6113954f6d2d9ade17da5e'],
 ['candidate-r4/deep-literature-for-codex-0.2.0-dev.5-win-x64.zip', 'cb0d5a01b3cad6c6292aa10a7eaf1b9af76c244a069e856322fc7561d6c35044'],
 ['backup-r4/manifest.json', '2132f289901786fa6e87a03c0a91b34f16a219d62458478e7767b5db19589e1a']]) {
 const item = await record(path.join(base, file)); assert.equal(item.sha256, expected); artifacts.push(item);
}
for (const file of ['library.zip', 'native.json', 'handoff.json']) artifacts.push(await record(path.join(base, 'backup-r4', file)));
const rawLogs = [];
for (const file of await fs.readdir(path.join(base, 'logs'))) {
 const full = path.join(base, 'logs', file); if ((await fs.stat(full)).isFile()) rawLogs.push(await record(full));
}
const index = { task: 'V02-006', generatedAt: new Date().toISOString(),
 sourceA: '8b195c9109efd92ba74c37bb244b2c6b155060de', sourceB: '058afb0fe8ebd5e39a4f9ca7e495011e4cde61ca',
 delivery: 'review/delivery-commits.json (created after the delivery commit; intentionally outside its own commit)',
 artifacts, archived, rawLogs,
 limitations: ['r1/r2/r3 logs are development evidence, not final installed r4 acceptance',
 'A offline JS evidence is split original run plus corrected git-context tail; no claim of one green command',
 'writer/abort failure branch uses a controlled library clone; actual restore and continuation use full installed products',
 'native event prefix is preserved; rc7 appends interrupted cleanup events',
 'independent keyring opt-in, POSIX-only tests and Windows symlink fixture skips remain explicit'],
 resolvedFailures: [
 { paths: ['logs/a-engine-all-1.txt','logs/test-runner-interruption.json'], reason: 'task runner lacked __main__; fixed runner, task-owned process cleanup, later full pass' },
 { paths: ['logs/a-engine-all-2.txt'], reason: 'two caller tests exposed pipeline.data_root assumption; fixed persisted request root' },
 { paths: ['logs/a-engine-all-4.txt'], reason: '599 passed but Windows worker.log teardown race; preserved, later final full pass' },
 { paths: ['logs/b-all-1.txt','logs/b-all-2.txt'], reason: 'legacy facade then missing own OAuth dependency; fixed facade and installed existing locked dev deps' },
 { paths: ['evidence/backup-restored-r2.json','evidence/backup-restored-r3.json'], reason: 'historical PID reuse and private backup-stage final-shape check; fixed; successful final r4 actual backup' },
 { paths: ['evidence/continue-restored-r3.json'], reason: 'offline trusted provider environment incomplete; corrected installed-source wrapper; r4 fresh-root continuation passes' },
 { paths: ['evidence/derived-crash-r4-harness-timeout.json'], reason: 'read-only job-status does not auto-mark dead worker interrupted; harness now observes dead PID then uses actual stop/resume' },
 { paths: ['scripts/fixtures/v02-006/verify-assets.py'], reason: 'initial byte check included relocated metadata; now asserts exactly three allowed fields and unchanged remainder' }
 ] };
const out = path.join(repo, 'docs/project/evidence/V02-006-evidence-index.json');
await fs.writeFile(out, JSON.stringify(index, null, 2) + '\n');
for (const name of ['V02-006-delivery.md', 'V02-006-demo.md', 'V02-006-receipt.json', 'V02-006-evidence-index.json'])
 await fs.copyFile(path.join(repo, 'docs/project/evidence', name), path.join(review, name));
console.log(JSON.stringify({ artifacts: artifacts.length, archived: archived.length, rawLogs: rawLogs.length, review }));
