# Deep Literature 项目总控

更新时间：2026-09-17。用户优先级：**控制功能范围、稳定主流程、降低维护成本**。

本文件是开发 session 的恢复入口，不代替代码与当前测试证据。

## 当前状态

- 总控：Codex 任务「Deep Literature 项目总控」。职责是冻结范围、分派任务、记录决策与组织集成验收。
- 稳定主线：`main` / `e7160ebda22a196f3b8dcf7a09cb94d137b7de0e`，文件树等于 `v0.1.0-rc.6`。
- 模块化开发基线：`codex/modular-foundation` / `4eef8bfef84c4f52a12e9a56a2949ce149226fc6`，尚未合入 main 或升级用户安装。
- 本轮总控记录：`codex/v02-control`，从模块化基线建立；保存路线、任务卡和决策，不叠加产品功能。
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

002 已通过来源/接口/测试基线审计：固定制品与 rc.5 源码对应，484 项 Python 测试通过、3 项跳过，默认 44 条 Node 命令通过；额外导航合同测试有失败，单列 002B 处理。引擎开发集成基线为 `d26cb9e`，生产代码与工作台 pins 仍保持固定 rc.5。完整结果见 [002 复核](docs/project/evidence/V02-002-review.md)。

V02-001 的隔离验收与 rc.6 对照已完成，交付提交为 `86d7833`。总控已核对差异和原始证据，验收资料并入总控分支。已覆盖场景未发现模块化加载/路径回归；旧 Excel 覆盖新记录、整实例恢复范围不足两项原有问题仍开放，不代表产品全部通过。详见[总控复核](docs/project/evidence/V02-001-review.md)。

用户已授权[自动总控循环](docs/project/auto-loop.md)：每 10 分钟按验收结果自动推进，最多两个独立开发任务并行，合入串行。003A 和 002B 已复核集成到引擎 `4e5e6b9`；组合源码的 56 项 Excel 测试、构建、导航合同和 Excel 接口复验通过，F3 关闭。见[组合复核](docs/project/evidence/V02-003A-review.md)。003B 的引擎候选全套回归通过（515 Python pass / 3 skip、45 条 Node 命令），但 B 打包被 catalog/pins 身份不一致拦住，安装未执行。该关联元数据漏列在总控任务范围中，现由 003C 补齐并续接安装验收；B 候选尚未合入总控。006B 已复核集成，仅证明固定 DSH 文本历史/队列子集的迁移可行性，尚无产品级持久禁重放门禁。F1/F2 继续开放；实际派发状态以任务台账为准。

v0.2 的推荐范围是稳定重构版。后续存储、作业、Reader 是候选工作域，基线验收后可缩减、合并或取消；不以全面重写作为发布条件。旧 v0.2 的新功能均不是本轮默认必做；需要加入时，先记录收益、模块影响与新增验收成本。
