import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../src/core.mjs';

// Real isolated installation and OS credential service, without model/MinerU calls.
const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'dl-platform-'));
const root = path.join(temporary, '文献 workbench');
const output = path.resolve(process.argv[2] || `outputs/platform-${process.platform}-${process.arch}.json`);
await fs.mkdir(path.dirname(output), { recursive: true });
const report = { platform: process.platform, arch: process.arch, startedAt: new Date().toISOString(), root, checks: [] };
try {
  const manifest = await readJson(path.join(source, 'BUILD-MANIFEST.json'));
  report.source = 'release-archive';
  report.sourceCommit = manifest.sourceCommit;
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  report.source = 'checkout';
}
const check = (name, condition) => { assert.ok(condition, name); report.checks.push(name); };
let sequence = 0;
async function run(command, args, input = '') {
  const started = Date.now();
  const log = output + '.' + (++sequence) + '.log';
  const out = await fs.open(log + '.stdout', 'w'), err = await fs.open(log + '.stderr', 'w');
  // File handles avoid waiting for output pipes inherited by a detached Windows host.
  let code;
  try {
    code = await new Promise((resolve, reject) => {
      const child = spawn(command, args, { cwd: source, shell: false, windowsHide: true,
        stdio: [input ? 'pipe' : 'ignore', out.fd, err.fd] });
      child.once('error', reject);
      child.once('exit', resolve);
      if (input) child.stdin.end(input);
    });
  } finally { await out.close(); await err.close(); }
  const result = { code, stdout: await fs.readFile(log + '.stdout', 'utf8'),
    stderr: await fs.readFile(log + '.stderr', 'utf8'), seconds: (Date.now() - started) / 1000 };
  await fs.writeFile(log, result.stdout + '\n' + result.stderr);
  assert.equal(result.code, 0, path.basename(command) + ': ' + result.stderr.slice(-1800));
  return result;
}
const shell = process.platform === 'win32'
  ? path.join(process.env.SYSTEMROOT, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe') : '/bin/sh';
const control = async action => {
  const args = process.platform === 'win32'
    ? ['-NoProfile', '-File', path.join(root, 'workbench.ps1'), action]
    : [path.join(root, 'workbench.sh'), action];
  const result = await run(shell, args);
  return { ...result, json: JSON.parse(result.stdout.replace(/^\uFEFF/, '')) };
};
try {
  const archive = path.join(source, 'inputs', 'scientific-reading.tgz');
  const skills = path.join(temporary, 'skills');
  const args = process.platform === 'win32'
    ? ['-NoProfile', '-File', path.join(source, 'install.ps1'), '-Root', root, '-PluginArchive', archive, '-InstallSkill', '-SkillsDirectory', skills]
    : [path.join(source, 'install.sh'), '--root', root, '--plugin-archive', archive, '--install-skill', '--skills-directory', skills];
  const installationRun = await run(shell, args);
  report.installSeconds = installationRun.seconds;
  check('installation explains Codex OAuth and MinerU setup', installationRun.stderr.includes('/api/codex-oauth/ui') && installationRun.stderr.includes('MinerU'));
  const skillRoot = path.join(skills, 'deep-literature-for-codex');
  check('installed Skill uses the new name', /^name: deep-literature-for-codex$/m.test(await fs.readFile(path.join(skillRoot, 'SKILL.md'), 'utf8')));
  const installed = await readJson(path.join(root, 'installation.json'));
  check('installs the intended runtime architecture', installed.pins.platform === `${process.platform}-${process.arch}`);
  const started = await control('start');
  report.firstStartSeconds = started.seconds;
  check('installed launcher starts a real host', started.json.ok && started.json.status === 'running');
  const identity = await fetch(started.json.url + '/__workbench/identity').then(r => r.json());
  check('HTTP identity matches the installed instance', identity.instanceId === started.json.instanceId);
  const page = await fetch(started.json.url).then(r => ({ ok: r.ok, contentType: r.headers.get('content-type') }));
  check('workbench serves its web UI', page.ok && page.contentType.includes('text/html'));
  const oauth = await fetch(started.json.url + '/api/codex-oauth').then(r => r.json());
  check('installed native OAuth starts with an isolated unauthenticated account', oauth.status === 'unauthenticated' && oauth.authenticated === false);
  const loginPage = await fetch(started.json.url + '/api/codex-oauth/ui').then(r => r.text());
  check('OAuth page provides the explicit authorization link', loginPage.includes('打开 OpenAI 授权页'));
  const skillArgs = process.platform === 'win32'
    ? ['-NoProfile', '-File', path.join(skillRoot, 'scripts', 'workbench.ps1'), 'status']
    : [path.join(skillRoot, 'scripts', 'workbench.sh'), 'status'];
  const skillStatus = JSON.parse((await run(shell, skillArgs)).stdout.replace(/^\uFEFF/, ''));
  check('installed Skill wrapper controls the same host', skillStatus.instanceId === started.json.instanceId && skillStatus.launchId === started.json.launchId);
  const repeated = await control('start');
  check('repeated start reuses the same host', repeated.json.launchId === started.json.launchId);
  const engine = async (args, input = '') => run(installed.python, ['-I', '-X', 'utf8', '-m', 'scientific_reading', '--data-root', path.join(root, 'library'), ...args], input);
  const ingest = JSON.parse((await engine(['library-ingest'], JSON.stringify({ title: 'Platform acceptance fixture', doi: '10.9999/platform-fixture', authors: ['Fixture'] }))).stdout);
  check('real installed engine stores a paper', Boolean(ingest.paper_id));
  await run(installed.python, ['-I', '-X', 'utf8', path.join(source, 'scripts', 'fixtures', 'mineru-empty-visual.py'), path.join(temporary, 'mineru-fixture')]);
  check('installed wheel passes MinerU empty visual regression with provenance and integrity guards', true);
  const xlsx = JSON.parse((await engine(['xlsx-refresh'])).stdout);
  check('real installed engine generates the Excel library', xlsx.status === 'success' && xlsx.rows === 1);
  await run(installed.python, ['-I', '-X', 'utf8', '-c',
    "from scientific_reading.secret_store import MineruSecretStore; from pathlib import Path; import sys; s=MineruSecretStore(Path(sys.argv[1]));\ntry:\n s.save('synthetic-platform-smoke'); assert s.load()=='synthetic-platform-smoke'\nfinally:\n s.delete()\nassert s.load() is None\nprint('native credential roundtrip passed')", path.join(temporary, 'keyring-fixture')]);
  check('native OS credential store saves, reads and deletes an instance-scoped credential', true);
  const notesCode = "from openpyxl import load_workbook; import sys; p=sys.argv[1]; w=load_workbook(p); s=w['文献']; h={c.value:c.column for c in s[1]}; s.cell(2,h['个人思考']).value='跨平台思考'; s.cell(2,h['个人理解程度']).value='待复读'; s.cell(2,h['用户笔记']).value='saved platform note'; w.save(p); w.close()";
  await run(installed.python, ['-I', '-X', 'utf8', '-c', notesCode, xlsx.path]);
  const workbookBytes = await fs.readFile(xlsx.path);
  for (const name of ['~$scientific-reading.xlsx', '.~lock.scientific-reading.xlsx#']) {
    const lock = path.join(path.dirname(xlsx.path), name);
    await fs.writeFile(lock, 'synthetic office owner', { flag: 'wx' });
    try {
      const blocked = JSON.parse((await engine(['xlsx-refresh'])).stdout);
      check('Excel owner marker defers refresh: ' + name, blocked.status === 'pending' && blocked.error.code === 'xlsx_in_use');
      check('open workbook bytes are preserved: ' + name, workbookBytes.equals(await fs.readFile(xlsx.path)));
    } finally { await fs.unlink(lock); }
  }
  check('Excel notes refresh successfully', JSON.parse((await engine(['xlsx-refresh'])).stdout).status === 'success');
  const verifyNotes = async () => run(installed.python, ['-I', '-X', 'utf8', '-c', "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); assert c.execute('SELECT personal_thoughts,understanding_level,user_notes FROM items').fetchone()==('跨平台思考','待复读','saved platform note'); c.close()", path.join(root, 'library', 'library.sqlite')]);
  await verifyNotes();
  check('all three saved Excel fields are written back to the library', true);
  const backup = JSON.parse((await engine(['library-backup', '--output', path.join(temporary, 'library.zip'), '--timeout', '30'])).stdout);
  check('consistent library backup completes', backup.status === 'completed');
  report.stopSeconds = (await control('stop')).seconds;
  const restart = await control('start');
  report.restartSeconds = restart.seconds;
  check('restart preserves instance identity and starts a new host', restart.json.instanceId === started.json.instanceId && restart.json.launchId !== started.json.launchId);
  await control('stop');
  report.reinstallSeconds = (await run(shell, args)).seconds;
  check('reinstall preserves the same library', JSON.parse((await engine(['xlsx-refresh'])).stdout).rows === 1);
  await verifyNotes();
  check('restart and reinstall preserve all three Excel fields', true);
  const uninstallArgs = process.platform === 'win32' ? ['-NoProfile', '-File', path.join(root, 'uninstall.ps1')] : [path.join(root, 'uninstall.sh')];
  await run(shell, uninstallArgs);
  check('uninstall preserves the database and Excel workbook', (await fs.stat(xlsx.path)).isFile() && (await fs.stat(path.join(root, 'library', 'library.sqlite'))).isFile());
  await assert.rejects(fs.access(path.join(root, 'installation.json')), { code: 'ENOENT' });
  check('uninstall retires the installed program', true);
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.error = error.stack;
  process.exitCode = 1;
  await control('stop').catch(() => {});
} finally {
  report.completedAt = new Date().toISOString();
  await writeJson(output, report);
  console.log(JSON.stringify(report, null, 2));
}
