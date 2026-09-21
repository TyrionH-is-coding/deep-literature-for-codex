# V02-004K：安装组合停止与安全恢复

固定 A `2dcd068bf3cbdf4b601351ab0bda639873bc0359`、B `572fee5c8fa28fd920221534ea28b3ce70051c0c`，正常构建 npm dev.4 / wheel dev3，并经原打包校验器与解包安装器装入 `C:/tmp/v004k/final`。最终 ZIP SHA256 为 `862e08c5ba85b399f6530d468298cfc7d3866675eae4b5ebe09e8b950610d105`；[索引](V02-004K-index.json)列全部命令、退出码、来源、SHA、安装路径和失败记录。后续验收夹具/报告提交不改变该候选生产文件，未发布、合并或升级用户安装。

**结果。** 安装 B 可信 API→安装 A 默认真实 worker 的停止、两次完整宿主重启和显式恢复通过。运行中 `requested` 与阶段完成后的 `acknowledged` 分开；当前解析允许完成，确认后没有启动翻译。多个别名及停止后新别名共享控制；普通 retry/resume/attach、分类绑定和真实 DSH 分类推进工具均不能解停；旧恢复键不能覆盖新取消，另一论文不受影响。明确恢复保持同 parent、同 source SHA 和 generation，进入合法翻译 gate。DSH 只移除目标队列，独占 turn 可请求取消，混合 turn 保留；两次重启未重投。状态明确 `independentChildrenStopped=false`。

合成有效 PDF 上，既有 parse、翻译批次、正式 Reader 字节及库指针、个人记录均保持；旧 Excel 快照未覆盖更新的 SQLite 笔记；Reader HTTP 资产 smoke 通过。新源尚未重新发布时，旧 Reader 安全返回 not-ready，不宣称新流程已完成。外部 provider exit 19 后重启并显式续接通过；单独故障注入终止已核对 PID/创建身份的真实 worker 后，可信 cancel→ack→resumeStopped 也恢复同 parent。直接非法 advance 在写前拒绝，相关 JSON 哈希不变。故障 kill 不作为用户停止的证据。

**004K-R1。** 旧候选按端口先报 ready，业务路由尚未完成恢复，官方调用得到 405 空响应。获总控授权后仅修改 identity 就绪判断及 bridge 握手；新候选首次启动和两次重启返回后立即官方 API 均成功，夹具无额外就绪等待。A build/offline/assets 与 B 全模块通过（149 pass / 1 平台 skip）；readiness 5 项通过，相关定向 21 项通过。52 个 Python 生产文件匹配 H 固定基线，引用 595 pass / 3 skip，不重跑全集。来源核对 B 41 个 src 文件、A tgz 54 条目、wheel/安装 Python 52 文件；固定 Node 22.22.2、Python 3.11.16、DSH rc.7、schema 4，536 个 npm 与 14 个适用 Python 锁定包核对通过。

**操作样例（可信 API，非浏览器 UI 验收）。** 用安装器记录的入口启动；每次以 `start` 返回的实际 URL 为准（本次依次为 62303、62373、62399 端口，现均已停止）：

```powershell
$node = 'C:/tmp/v004k/final/runtime/node/22.22.2/node.exe'
$cli = 'C:/tmp/v004k/final/releases/a4182a78f1e4dc50/app/src/cli.mjs'
$root = 'C:/tmp/v004k/final'
& $node $cli start $root
& $node $cli call $root 'C:/tmp/v004k/request.json'
```

请求文件先用 `{"action":"tasks"}` 查 taskId；以 `{"action":"cancel","payload":{"taskId":"…"}}` 停止，再通过 `task` 查询到 acknowledged。用 CLI `stop $root`、`start $root` 重启后再次查询，停止仍应保留。恢复请求为 `{"action":"resume","payload":{"taskId":"…","idempotencyKey":"新的唯一键","resumeStopped":true,"expectedRevision":当前revision,"input":关卡合同输入}}`。本次 parse 边界使用 `{}`，第二别名 `task-36a50148-82a8-43bb-9089-4269d60fab13` 在 revision 2 恢复 `job_e4bd856cb2ae815a`；已到翻译 gate 后必须提交该 gate 的完整 translation 合同，不能照搬空输入或旧 revision。示例中的省略号需替换为查询到的值。

**限制与保留项。** 仅 Windows 隔离安装可信 API / Reader HTTP；未验浏览器 UI、真实模型/科学质量、非 Windows 安装、F2 完整三域恢复或 005 全流程演示。解析/模型/翻译均为标明的合成输入，原生队列专用 gate 为显式夹具注入。004K-O2 热重载残留路由由总控列后续非阻断项，本卡只验完整进程重启。真实 worker crash 后仅新 alias submit 不会自动续接，仍保留旧 running 状态；安全恢复已用显式停止→恢复证明，总控已将此 004K-O3 列为非阻断的状态/普通重试改进。即使 ack 时 businessStatus 仍显示旧 running，也不能据此认为 worker 存活；应按可信 cancel→ack→resumeStopped 两步明确恢复，不宣称自动崩溃恢复。所有失败、网络重试、旧/新 ZIP、实例和控制记录保留；最终宿主 stopped、任务路径下进程 0、原 profile patch 恢复。回退需成套回退元数据/制品，保留文献资产和停止意图。
