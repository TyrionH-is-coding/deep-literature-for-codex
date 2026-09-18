# V02-004I 停止控制跨包适配交付

状态：review，待总控独立验收；source-only，未发布/安装，不宣称用户取消链通过。

## 固定来源与提交

- B 工作树 `C:/Users/15694/Documents/ChatGPT/deep-literature-v02-004i`，base `21e34c9763859442df33d047d12749e9a8b53744`，被测源码提交 `748a9e7abcca66aa773f44508d1f65f1fd810466`。
- A 工作树 `C:/Users/15694/Documents/ChatGPT/deep-literature-engine-v02-004i`，base `2720fac32cf2b989523079405abbd0e4f3698e07`，被测生产源码 `b9365ce622c323ce10b2ab86864f3c85d5edf55c`；后续 `8a63f2ba2eb0ed10fd01cb6af47608d6ea5ec5b9` 仅修正验证脚本 TEMP 路径；A 最终交付 `b4a9ecc00a76b85c244a0167c79b5a3539e97415`，后续只有证据/报告。
- 两边 branch 均 `codex/v02-004i-control-adapter`；任务上下文固定 `d06be8e6367ef4debc758506574a4be9dfa01874`，通过 git show 读卡片、AGENTS、session-protocol、auto-loop 和 F/H-control-review。总控目录只读。
- session `01a0b37e-c170-7cb0-98b3-f89d22f0365a`，开工核对双 base/branch/clean 后立即写回执；中断恢复后补记 sessionId/resumedAt。B 本报告与回执所在最终证据提交可由本分支 HEAD 解析，不自写循环 commit 哈希。

## 接口与行为

A 导出 `engineResumeStoppedFullRead(config, jobId, suppliedInput, {requestId, expectedRevision})`，在访问 provider 配置或启动进程前拒绝空/过长 ID 与非安全非负整数 revision。保留零 revision。CLI 包含 --resume-stopped/--request-id/--expected-revision/--input，复用 trustedProviderEnv、engineJson 和 withEngineScope 的既有传播链。旧 continue 签名/行为不改，新能力不注册为分类工具。

B bridge 0.1.1 显式恢复只调用新导出，缺失时 `engine_stop_control_unavailable`，不回落普通 resume。旧 start/continue/attach 路径保留。stop/read 直接复用 engineJson。快照按原对象返回，验证 reading-control-v1、parent 与嵌套 parent/paper、scope 身份、控制字段类型、revision/operation 关系、phase、兼容状态与 replay。保留 businessStatus/pipelineState 以及独立 child 未停止事实；requested 不冒充 acknowledged，业务 failed/completed 不转换为 canceled。

停止中的普通 resume/attach 可返回合法 exit 2 控制 gate；任意 ok=false、错 parent、伪造快照或错误 envelope 均不会被当作成功。安全错误代码保留，revision conflict、request conflict、dispatch uncertain、scope 拒绝可区分；非法快照报 `engine_stop_control_invalid`。不改 Python 协议、Host/Origin、工具白名单、workflow 持久数据或取消/派发语义、UI、pins、产品版本及依赖。

## 验收证据

1. A 新测试验证公开 index 导出、完整 argv/stdin、中文输入、零 revision、非法参数在调用前拒绝、真实子进程收到 scope 和受信 provider 环境，普通 continue 不携带新参数。该测试使用传输探针，明确不替代实际引擎集成。
2. B 新测试六组覆盖 request/ack/terminal、业务 failed/completed 保持、旧路径、缺失导出、错误 envelope、非法字段及 parent、ID/revision、scope 和未知 dispatch 安全错误。连同原 bridge 文件共 16 项定向测试通过，未削弱原断言。
3. [真实集成 JSON](V02-004I-integration.json) 与 [执行结果](V02-004I-integration.txt)：固定 B adapter→本卡 A `lib/index.js`→私有 Python 3.11.16 的实际 scientific_reading 模块，17 个观察。新合成 parent 依次 read(0)→stop(1)→重复 stop→普通 resume/attach 阻止→显式 resume(2)→重复 resume→后台 worker 到同 parent 的 waiting_user/pdf_required 并注销。实际 CLI gate 退出码 2 已记录；跨 paper、跨分类、过期 revision、ID 冲突实际拒绝。库位于 B outputs/v02-004i/final；fixture 无 PDF/provider/model。没有 mock 替换实际 Python 业务函数。
4. A `./scripts/v02-004i-verify.ps1` 与 `-Remaining`：build、typecheck 和 9 个 TS 回归文件共 11 个唯一命令最终通过。1 次资产测试因 Windows 长路径失败，短任务目录复跑通过；12 次执行记录保留失败，不拼为 12 项全绿。完整 A 报告 `docs/codex-v02/V02-004I-report.md`，runs/audit/environment 位于同级 V02-004I-evidence。未重跑无变化 Python 全集。
5. B `./scripts/v02-004i-verify.ps1`：[check](V02-004I-check.txt) 通过；[impact](V02-004I-impact.txt) 无 unowned，bridge/tooling 及已有依赖影响登记；[bridge](V02-004I-bridge.txt) 62 项中 61 通过、1 平台跳过；[workflow](V02-004I-workflow.txt) 87 项中 86 通过、1 平台跳过。两套有重叠，不相加。跳过均为 Windows 上的 POSIX socket 测试。精确命令/时间/退出码见 [runs](V02-004I-runs.json)。
6. 来源审计：集成 JSON 包含 A/B 路径、被测 commit、实际 Python 导入位置与关键 TS/JS/adapter SHA256。A audit 核对精确审计依赖清单所有版本及 52 个私有环境 Python 文件与源码字节，Python 生产代码相对 A base 无修改。最终交付与被测源码之间仅验证脚本/报告/证据差异。

## 环境、失败与回退

初次 modules 命令缺 acorn，B npm ci --ignore-scripts 后成功；A npm ci 的既有 peer 冲突用 --legacy-peer-deps 解决，锁文件无变化。初次中断时 runtime 拷贝不完整，未生成宽松 pip 安装结果；恢复后使用精确 audit-python-requirements。未把旧环境测试当本轮证据。首次 Git 提交作者缺失，用命令级 Codex 身份重试，未改全局/共享配置。

本卡私有 runtime/venv、node_modules、JS/wheel 输出和合成库保留供总控复核；A 最终测试短 TEMP 为 `C:/tmp/v02-004i-ts`，旧长路径失败夹具保留在 A outputs/v02-004i/tmp。最终进程核查无本卡 Python 残留，真实 worker 已注销；没有用户安装/凭据/模型接触。生成 lib/client.js 已恢复为 HEAD，无手工修改生成内容。B 回执置 review，提交后双方 clean；清理事实见 [final-audit](V02-004I-final-audit.json)。

恢复点为上述双 base。若撤销本接口，应配套回退 A 导出与 B adapter/登记/测试，不回退或删除文献库和停止记录；旧引擎不保证停止保护。未发布、tag、合 main、改总控台账或创建后继。安装组合、真实模型、非 Windows、产品 UI 和用户取消链仍未验证，由总控决定后续卡。
