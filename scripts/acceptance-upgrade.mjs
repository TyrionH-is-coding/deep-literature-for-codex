import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

const root = await fs.realpath(process.argv[2]);
const candidate = await fs.realpath(process.argv[3]);
const output = path.resolve(process.argv[4]);
const original = JSON.parse(await fs.readFile(path.join(root, 'installation.json'), 'utf8'));
const load = file => import(pathToFileURL(path.join(original.app, 'src', file)).href);
const { start, stop, status } = await load('control.mjs');
const { call } = await load('client.mjs');
const { readJson, writeJson } = await load('core.mjs');
const report = { root, candidate, oldAppSha256: original.appSha256, checks: [], startedAt: new Date().toISOString() };
const check = (name, value) => { assert.ok(value, name); report.checks.push({ name, passed: true }); };
const skillsRoot = path.join(path.dirname(output), 'upgrade-custom-skill');
const customFile = path.join(skillsRoot, 'deep-literature-for-codex', 'SKILL.md');
await fs.mkdir(path.dirname(customFile), { recursive: true });
const customBytes = Buffer.from('---\nname: deep-literature-for-codex\ndescription: acceptance fixture\n---\n用户已有定制内容。\n');
await fs.writeFile(customFile, customBytes, { flag: 'wx' });
const windows = process.platform === 'win32';
async function runShell(args, label) {
  const stdoutFile = output + '.' + label + '.stdout.log';
  const stderrFile = output + '.' + label + '.stderr.log';
  const out = await fs.open(stdoutFile, 'w'), err = await fs.open(stderrFile, 'w');
  const code = await new Promise((resolve, reject) => {
    const command = windows ? path.join(process.env.SYSTEMROOT, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe') : '/bin/sh';
    const child = spawn(command, windows ? ['-NoProfile', ...args] : args,
      { windowsHide: true, shell: false, stdio: ['ignore', out.fd, err.fd] });
    child.on('error', reject); child.on('close', resolve);
  }).finally(async () => { await out.close(); await err.close(); });
  // File handles avoid waiting for pipes inherited by a running Windows host.
  const stdout = await fs.readFile(stdoutFile, 'utf8'), stderr = await fs.readFile(stderrFile, 'utf8');
  await fs.writeFile(output + '.' + label + '.log', stdout + '\n' + stderr);
  assert.equal(code, 0, label + ': ' + stderr.slice(-1500));
  return stdout;
}
async function artifacts(directory, found = {}) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await artifacts(file, found);
    else if (entry.isFile() && /\.(pdf|html|xlsx)$/i.test(entry.name)) {
      found[path.relative(root, file)] = createHash('sha256').update(await fs.readFile(file)).digest('hex');
    }
  }
  return found;
}
const paperIds = async () => (await call(root, { action: 'list', payload: { pageSize: 100 } })).value.items.map(row => row.paper_id).sort();
try {
  const running = await start(root);
  const before = await artifacts(path.join(root, 'library'));
  const papers = await paperIds();
  check('upgrade fixture includes PDF and Excel assets', Object.keys(before).some(file => file.endsWith('.pdf'))
    && Object.keys(before).some(file => file.endsWith('.xlsx')));
  const installArgs = windows ? ['-File', path.join(candidate, 'install.ps1'), '-Root', root,
    '-PluginArchive', path.join(candidate, 'inputs', 'scientific-reading.tgz'), '-InstallSkill', '-SkillsDirectory', skillsRoot]
    : [path.join(candidate, 'install.sh'), '--root', root, '--plugin-archive', path.join(candidate, 'inputs', 'scientific-reading.tgz'), '--install-skill', '--skills-directory', skillsRoot];
  const result = await runShell(installArgs, 'install');
  const selected = await readJson(path.join(root, 'installation.json'));
  report.newAppSha256 = selected.appSha256; report.aSha256 = selected.pins.plugin.sha256;
  check('actual platform installer selects the new good build', selected.appSha256 !== original.appSha256);
  check('custom Skill conflict is explicitly nonfatal after upgrade', result.includes('"ok": true')
    && result.includes('retained_custom_changes') && result.includes('skill_conflict') && (await fs.readFile(customFile)).equals(customBytes));
  check('previously running host remains running with same instance', (await status(root)).status === 'running'
    && (await status(root)).instanceId === running.instanceId);
  check('upgrade preserves original artifact bytes and library identities', JSON.stringify(await artifacts(path.join(root, 'library'))) === JSON.stringify(before)
    && JSON.stringify(await paperIds()) === JSON.stringify(papers));
  await runShell(windows ? ['-File', path.join(root, 'workbench.ps1'), 'rollback'] : [path.join(root, 'workbench.sh'), 'rollback'], 'rollback');
  check('actual command rolls back to the exact previous good program', (await readJson(path.join(root, 'installation.json'))).appSha256 === original.appSha256);
  check('rollback preserves current artifact bytes and library identities', JSON.stringify(await artifacts(path.join(root, 'library'))) === JSON.stringify(before)
    && JSON.stringify(await paperIds()) === JSON.stringify(papers));
  await runShell(installArgs, 'reinstall');
  check('same candidate can be selected again after rollback', (await readJson(path.join(root, 'installation.json'))).appSha256 === selected.appSha256);
  check('reselection retains all assets and customized Skill', JSON.stringify(await artifacts(path.join(root, 'library'))) === JSON.stringify(before)
    && (await fs.readFile(customFile)).equals(customBytes));
  report.artifactCount = Object.keys(before).length; report.paperCount = papers.length; report.passed = true;
} catch (error) { report.passed = false; report.error = error.stack; process.exitCode = 1; }
finally { await stop(root).catch(() => {}); report.completedAt = new Date().toISOString(); await writeJson(output, report); console.log(JSON.stringify(report, null, 2)); }
