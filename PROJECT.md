# Deep Literature 项目总控

更新时间：2026-09-18。用户优先级：**控制功能范围、稳定主流程、降低维护成本**。

本文件是开发 session 的恢复入口，不代替代码与当前测试证据。

## 当前状态

- 总控：Codex 任务「Deep Literature 项目总控」。职责是冻结范围、分派任务、记录决策与组织集成验收。
- 稳定主线：`main` / `e7160ebda22a196f3b8dcf7a09cb94d137b7de0e`，文件树等于 `v0.1.0-rc.6`。
- 模块化开发基线：`codex/modular-foundation` / `4eef8bfef84c4f52a12e9a56a2949ce149226fc6`，尚未合入 main 或升级用户安装。
- 本轮总控记录：`codex/v02-control`，从模块化基线建立；保存路线、任务卡、决策和已验收的稳定性修复。
- 引擎源码：独立检出 `v0.1.0-rc.5` / `8e00b334389cd90721b7d404013a07687753aa5c`；现有带未提交修改的 `dsh reader` 目录不是重建基线。
- 旧 v0.2：备份分支 `backup/pre-rollback-v02-20260917` / `31f84f2124e26356c824cf348dd6c49de8bccb13`，只作为取证与有选择移植的来源。

## 工作入口

- [v0.2 重建路线](docs/project/v0.2-plan.md)：范围、阶段和发布门槛。
- [任务台账](docs/project/tasks.json)：当前状态、依赖、负责人和证据。
- [总控与开发 session 协作](docs/project/session-protocol.md)：开工、交接、复核和合入。
- [决策记录](docs/project/decisions.md)：已经确定的约束和仍需作出决定的事项。
- [固定引擎审计](docs/project/engine-baseline.md)：已核实的接口、数据格式和恢复边界。
- [首个开发任务 V02-001](docs/project/tasks/V02-001.md)：在隔离环境验收模块化基线并复现稳定性风险。
- [模块地图](docs/modules/README.md)：当前代码职责与上下文边界。
- [本轮检查记录](docs/project/planning-validation.md)：总控资料、定向测试与本地打包结果。

## 本轮已做与下一步

001/002 基线验收、引擎来源与接口审计已完成。003A 修复旧 Excel 覆盖新记录，002B 补齐导航合同默认测试。003B/003C 的打包身份和界面反馈缺口经 003D 逐项补齐，原失败证据保留。

**003 已通过并集成**：当前开发组合是 A `6283c02`、B 集成 `c52ea36`，npm 候选 `0.2.0-dev.2`（Python 模块 `0.2.0.dev1`）。实际安装中的个人字段保护、冲突中文提示、两次宿主重启与来源字节已复核，F1/F4 关闭；F3 已关闭。见 [003D 总控复核](docs/project/evidence/V02-003D-control-review.md)。稳定 main 和用户安装未升级，当前不是正式发布。

004A 已完成合同诊断并集成到 A `dcdb8e6`，保留一条真实中断恢复失败测试：解析尚未提交时进程终止，重启后出现 generation_workspace_conflict；总控已独立复现。宿主取消与独立引擎 worker 的职责也尚未闭合。见 [004A 总控复核](docs/project/evidence/V02-004A-control-review.md)。**004 未通过，005 继续等待**。

004B 源码修复已集成到 A `bf09c55`，总控独立 24 项复验通过；004C 诊断设计已集成，模块登记补齐后调用方 72 pass / 1 skip。见 [004B/C 复核](docs/project/evidence/V02-004BC-control-review.md)。当时 B 开发基线为 `d78e48b`；最新组合见下文。

**004E 已集成**到 B `df66bdb`，workflow 0.1.1：先持久化取消意图，再请求宿主撤回；宿主失败后重启仍不默认投递。总控独立35项通过，004C-C1关闭，见[004E复核](docs/project/evidence/V02-004E-control-review.md)。

**004D安装恢复已通过**，004A-F1关闭。引擎集成 `a37a415`、B组合 `6b979d1`，当前pins为dev.3；总控独立核对制品和两套安装字节，组合源码80pass/1skip。004D的原ZIP不含004E，因此最终组合安装仍须重验，见[004D复核](docs/project/evidence/V02-004D-control-review.md)。

**004G诊断已通过并集成**到A `6d88f2b`，总控独立六场景重现直接服务状态不一致，正常CLI对照通过，见[004G复核](docs/project/evidence/V02-004G-control-review.md)。**004F源码已验收**并集成A `776a018`：完整571pass/3skip，总控来源/XML与最终delta通过，见[004F复核](docs/project/evidence/V02-004F-control-review.md)。**004H写前守卫已验收**并集成A `2720fac`，完整595pass/3skip，总控24pass，见[004H复核](docs/project/evidence/V02-004H-control-review.md)。当前派发004I跨包控制适配；之后再接workflow取消与最终安装。004A-G1、004整体与005依赖仍未解除，不能把收到停止意图当成后台已停止。

006A 恢复设计与 006B 固定 DSH 文本历史/队列限定取证已集成；尚无产品持久禁重放门禁与完整三域恢复演练，**F2 仍开放**。003D 的首次导航显示观察留给 005 核查，尚未归因，不据此扩大功能。每 10 分钟自动总控复核，最多两个独立开发任务，合入串行。

v0.2 的推荐范围是稳定重构版。后续存储、作业、Reader 是候选工作域，基线验收后可缩减、合并或取消；不以全面重写作为发布条件。旧 v0.2 的新功能均不是本轮默认必做；需要加入时，先记录收益、模块影响与新增验收成本。
