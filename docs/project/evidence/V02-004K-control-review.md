# V02-004K 总控安装验收

2026-09-21：**本卡通过并集成**。同一 dev.4 隔离安装已证明可信入口停止、完整宿主重启后保持、显式恢复同一任务及已有资产/个人记录保护；关闭 004A-G1、004D-O1、004K-R1，解除 005 依赖。不是浏览器 UI、科学内容质量、F2 三域恢复或最终发布验收。

## 固定交付与来源

- A 生产源码 `2dcd068bf3cbdf4b601351ab0bda639873bc0359`，交付/总控集成 `ad00bc5a84110346801dbb6e98c8b9e19135287d`（fast-forward）。
- B 生产源码 `572fee5c8fa28fd920221534ea28b3ce70051c0c`，夹具 `8ecccf12960c2e5bef3acd1a8eb911da61ba08cd`，交付 `cded8181f86e8a512be83185304bd56bb6bbb25f`，总控集成 `ce5fd9aac20985f3f80ca675b8781e40006a227e`。合入无冲突，生产目录相对交付无差异。
- ZIP `C:/tmp/v004k/candidate-r1/deep-literature-for-codex-0.2.0-dev.4-win-x64.zip`，SHA256 `862e08c5ba85b399f6530d468298cfc7d3866675eae4b5ebe09e8b950610d105`。仅 Windows 隔离安装 `C:/tmp/v004k/final`；未触及用户安装/main。
- [开发交接](V02-004K-report.md)、[完整证据索引](V02-004K-index.json)、[总控验证索引](V02-004K-control-verification.json)。详细原始日志仍在索引指定的本机路径，必要行为证据已有 tracked review copies。

总控独立核对 64 份索引文件与 10 份夹具的哈希；ZIP 精确包含 560 份清单载荷及清单自身。B 的 41 个源码文件与安装文件对应，A 的 54 个包条目、52 个 wheel/安装 Python 文件对应；536 个 npm 和 14 个适用 Python 锁定依赖一致。安装 Python 的 52 份字节还精确匹配 H 的原始 sourceHashes，可复用 595 pass / 3 skip 基线。Git blob 对比中的 catalog 与 Python 文件存在 Windows CRLF/LF 差异，已单列换行等价；不声称这些 Git blob 字节相同。

## 行为与失败路径复核

独立复核 installed_control_acceptance 与 native_cancel_acceptance 未发现本卡阻断：真实安装默认 worker 在解析进行中接收 requested，完成当前阶段后 acknowledged，后续翻译未启动；同论文多个别名、新别名、旧恢复键及普通推进不能绕过停止，另一论文不受影响。DSH 仅移除目标队列，独占 turn 实际 aborted(user)，混合 turn 不误杀；两次宿主重启无重投。

19 份既有资产与 27 份 parse/batch 哈希保持，Reader/库指针与 SQLite 较新笔记受保护；非法生命周期 advance 两次写前拒绝，分别 17/18 份 JSON 哈希不变。真实 worker crash 的显式 cancel→ack→resumeStopped 保持 parent/PDF/generation，进入合法 gate；不将该场景冒充自动重启。启动 R1 修复已独立代码复核，5 项定向测试通过；新安装首次启动及两次重启立即可信调用成功，无夹具额外等待。

A build/offline/assets 通过，B 最终全模块 149 pass / 1 既有平台 skip / 0 fail；相关定向测试与全模块重叠，不累加。集成后模块检查 10 modules / 47 source files / 152 imports 通过。无新生产差异，未重复上述全集。一次实质生产返工为 R1；旧候选失败和网络重试保留，不以失败记录数代替返工轮数。

## 保留边界与交接

004K-O2 进程内热重载路由清理、004K-O3 崩溃后陈旧 running/普通 alias 不自动续接保持后续非阻断项。明确恢复已有可信入口；005 应核验实际入口并如实解释状态，不能把持久 running 当作 worker 存活。当前证据使用合成 provider/模型和显式原生 gate 夹具，Reader 只到 HTTP smoke。

复核时最终实例 stopped，任务目录 node/python/pythonw 进程 0，profile patch 为 []。保留实例、旧/新制品、失败与通过证据。回退须成套回退候选元数据/制品，不能通过降级消除停止意图或回退文献数据。后继用同一 ZIP 新建独立实例完成 Reader 样例与主流程演示；F2、真实使用、最终制品门槛仍开放。
