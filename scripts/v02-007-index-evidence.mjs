import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const repo = path.resolve(import.meta.dirname, '..');
const evidence = 'C:/tmp/v007/evidence';
const read = async file => JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
const write = async (file, value) => fs.writeFile(file, JSON.stringify(value, null, 2) + '\n');
// Preserve the actual receipt clock; the exact first inspection time was not captured.
const receipt = await read(path.join(evidence, 'receipt.json'));
receipt.initialInspectionAt = null;
receipt.packageContainer = 'C:/tmp/v007/package';
receipt.packageRoot = 'C:/tmp/v007/package/deep-literature-for-codex-0.2.0-dev.5-win-x64';
await write(path.join(evidence, 'receipt.json'), receipt);
await write(path.join(repo, 'docs/project/evidence/V02-007-receipt.json'), receipt);
await write(path.join(evidence, 'preflight.json'), {
  worktree: repo, cleanAtInitialInspection: true,
  branch: 'codex/v02-007-real-use', baseCommit: receipt.baseCommit, contextCommit: receipt.contextCommit,
  moduleCommands: [
    { command: 'npm run modules -- list', result: 'ERR_MODULE_NOT_FOUND: acorn' },
    { command: 'npm run modules -- context application', result: 'ERR_MODULE_NOT_FOUND: acorn' },
  ],
  classification: 'Development-worktree dependency missing; no application installation defect.',
  resolution: 'No development dependencies installed outside allowlist. Read application documentation/public entrypoints; controller reported module list/context succeeded in its repository.',
});
const ready = await read(path.join(evidence, 'ready.json'));
const install = await read(path.join(evidence, 'install-result.json'));
const installOutput = await read(path.join(evidence, 'install.stdout.log'));
const verification = await read(path.join(evidence, 'build-manifest-verification.json'));
assert.equal(installOutput.ok, true);
assert.equal(installOutput.installation, 'installed');
assert.equal(ready.phase, 'ready_awaiting_user_local_login');
await write(path.join(evidence, 'install-wrapper-observation.json'), {
  wrapperExitCode: 1, originalInstallerExitCode: install.exitCode,
  originalInstallerReportedOk: installOutput.ok, installation: installOutput.installation,
  observation: 'Start-Process -PassThru plus WaitForExit returned null ExitCode to the wrapper; wrapper comparison reported failure after installer had emitted successful completion.',
  handling: 'Preserved original null exit code and logs. Did not rerun installer. Adjusted wrapper to Start-Process -Wait for future use; verified current installation using installed CLI start, identity, tasks, folders and status.',
  installationAttempts: 1, productCodeChanged: false,
});
await write(path.join(repo, 'docs/project/evidence/V02-007-ready.json'), ready);
const selected = [
  'receipt.json', 'preflight.json', 'archive.json', 'build-manifest-verification.json', 'install-cache.json',
  'install-result.json', 'install-wrapper-observation.json', 'install.stdout.log', 'install.stderr.log', 'start.json', 'identity.json',
  'tasks-request.json', 'tasks.json', 'folders-request.json', 'folders.json', 'status.json', 'ready.json',
];
const record = async file => {
  const bytes = await fs.readFile(file);
  return { path: file.replaceAll('\\', '/'), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
};
const scripts = (await fs.readdir(path.join(repo, 'scripts'))).filter(name => name.startsWith('v02-007-'));
const index = {
  taskId: 'V02-007', phase: ready.phase, acceptancePassed: false,
  generatedAt: new Date().toISOString(), baseCommit: receipt.baseCommit, contextCommit: receipt.contextCommit,
  evidenceAvailability: 'Raw logs and detailed hashes are local-only and must be retained for review.',
  commandSequence: [
    'powershell.exe -NoProfile -File scripts/v02-007-prepare.ps1',
    'node scripts/v02-007-verify-and-cache.mjs',
    'powershell.exe -NoProfile -File scripts/v02-007-install.ps1',
    'node scripts/v02-007-start-and-probe.mjs',
    'node scripts/v02-007-index-evidence.mjs',
  ],
  records: await Promise.all(selected.map(name => record(path.join(evidence, name)))),
  scripts: await Promise.all(scripts.map(name => record(path.join(repo, 'scripts', name)))),
};
await write(path.join(repo, 'docs/project/evidence/V02-007-evidence-index.json'), index);
const report = `# V02-007 隔离实例准备报告\n\n` +
  `状态：**准备完成、等待用户本人登录；V02-007 真实使用未验收通过。** 本轮仅安装固定 dev.5、启动同一新实例，并读取空 tasks/folders。\n\n` +
  `- 工作树：\`${receipt.worktree}\`，分支 \`${receipt.branch}\`；base \`${receipt.baseCommit}\`，总控 context \`${receipt.contextCommit}\`。准备开始 ${receipt.startedAt}，首个 90 分钟检查点 ${receipt.nextCheckpointAt}。\n` +
  `- 固定 ZIP：\`${receipt.candidateArchive}\`；SHA256 \`${receipt.candidateSha256}\`。全部 ${verification.verifiedFiles} 个 BUILD-MANIFEST 文件通过 SHA256 校验；A 源码 \`${verification.pluginSourceCommit}\`，B 源码 \`${verification.sourceCommit}\`。\n` +
  `- appSha256：\`${ready.appSha256}\`。私有 Node 22.22.2、Python 3.11.16/20260901 的归档只读复用 006 downloads，并重新按 pins 校验；DSH 保持 ${ready.dsh}。\n` +
  `- 原始 install.ps1 于 ${install.startedAt} 至 ${install.finishedAt} 执行，返回 JSON ok=true、installation=installed；包装器未取得原进程退出码（null，不能视为 0）。一次安装尝试，依赖仍使用原锁文件；未传 InstallSkill 或 LibraryBackup。\n` +
  `- 实例根：\`${ready.instanceRoot}\`；instanceId \`${ready.instanceId}\`；launchId \`${ready.launchId}\`。实际已安装的私有 Node + launcher CLI 返回 running，与 HTTP 身份一致。端口由 OS 分配。\n` +
  `- 当前入口：[实例身份页](${ready.identityPage})、[工作台](${ready.url})、[本人订阅登录](${ready.loginUrl})。实际 tasks=0、bindings=0、folders=0；末次 status 仍 running。实例保持运行供总控打开。\n\n` +
  `证据：[初始回执](V02-007-receipt.json)、[就绪身份](V02-007-ready.json)、[日志/SHA 索引](V02-007-evidence-index.json)。详细 628 项校验与安装日志保留于 \`C:/tmp/v007/evidence/\`，仅本机可用，不应在复核前删除。脚本语法与差异检查通过；同制品既有全集证据沿用 006，本轮未重复产品全集。\n\n` +
  `发现：开发工作树的 npm modules list/context 因缺 acorn 未运行成功；未安装开发依赖，总控已在控制仓库成功读取模块入口。首次日志包装器因原进程 ExitCode=null 误报失败，保留原始结果并改用 Start-Process -Wait 捕获后续退出码；未重跑安装。实际安装成功 JSON 及已安装 CLI/身份/空任务探测均已核对，未发现产品安装错误。包装器最终修订未另行重装验证。\n\n` +
  `边界：未读取/复制任何既有凭据，未改用户 Skill、旧实例或总控台账；未进行浏览器登录、入库、提交、投递、模型或 MinerU 调用。论文及 papers/ 由总控另行管理。本人登录/选择实际 GPT 模型、MinerU 配置、真实解析/Reader 内容核对、记录编辑与重启保持均待后续；不声称 007 通过。需要停止时，仅用本实例 \`workbench.ps1 stop -Root C:/tmp/v007/instance\`，不按进程名清理。\n`;
await fs.writeFile(path.join(repo, 'docs/project/evidence/V02-007-preparation-report.md'), report);
console.log(JSON.stringify({ ok: true, evidenceRecords: index.records.length, scripts: index.scripts.length }));
