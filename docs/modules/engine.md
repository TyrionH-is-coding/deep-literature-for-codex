# 外部文献引擎边界

当前 rc.6 基线没有 `engine/` 源码目录。文献库、PDF 获取与解析、精读流程、Reader 和资产处理由外部包 `@dsh-external/dsh-scientific-reading` 提供。本仓库管理安装、固定制品、适配及验证；不能把这些业务实现标记为已经在本仓库完成拆分。

[`runtime/pins.json`](../../runtime/pins.json) 是当前制品来源：

| 字段 | 当前值 |
| --- | --- |
| 包 | `@dsh-external/dsh-scientific-reading` |
| 版本 | `0.2.0-dev.2` |
| 来源 commit | `26abee5f8c8e4f92f26a9b7fba4ddd236e523b05` |
| SHA256 | `2e1ec6ebbc9ca37d33060d978f5d1f855455bb4423cc5b481957b3da0259bc09` |
| 父 DSH | `0.1.0-rc.7` |

这些是锁定配置，不证明本地制品已下载或当前安装已切换。以后升级应以实际 pins 和验证结果为准，而不是继续沿用本文的初始表格。

## 本仓库拥有的接口

`bridge` 从安装实例的 DSH 包解析路径加载该引擎，适配器调用 `engineStartFullRead`、`engineContinueFullRead`、`engineAttachAndResumeFullReadPdf`、`engineJson` 与 `withEngineScope`。持久任务通过这些入口查询状态、续接和验证资产。合同细节见 [`handoff-contract.md`](../handoff-contract.md)；实际使用入口以 `bridge` 的公开合同与当前代码为准。

`application` 和 `releases` 负责制品校验、安装组合、发布代选择与库迁移。现有本地 bridge/workflow 测试能验证宿主适配与任务行为，不能替代引擎自身的 Python/TypeScript 单测，也不能证明 PDF 解析或翻译质量正确。

需要修改引擎时，任务应明确写成外部引擎变更，并记录所用源码仓库、commit、目标制品及宿主兼容范围。不能在本仓库新建同名目录，就把未知来源代码当成当前固定引擎。

## 引擎升级的最小交接

1. 固定问题、输入样例、验收结果与当前引擎 commit；样例应使用允许用于开发的数据。
2. 在引擎源码处完成有界变更和对应测试，记录接口、数据格式及作业恢复兼容性。
3. 取得带版本、来源 commit、SHA256 和验证记录的制品；同步 pins、锁文件及适配合同中受影响部分。
4. 在隔离安装中验证制品一致性、启动与宿主接口，再验证受影响的实际业务流程。
5. 记录文献库格式是否变化以及可用恢复点；确认完整组合后再发布。

`npm run modules -- context engine` 用于查看外部依赖上下文，`impact` 和模块测试用于分析与验证本仓库调用方。它们不能运行未包含在仓库中的引擎实现测试。报告必须区分“宿主适配通过”“引擎源码测试通过”“真实论文流程通过”，缺少哪层证据就明确写出。

后续如果决定将引擎源码纳入同一仓库，应另立迁移任务：先确认完整来源与许可证、锁定基线和复现测试，再逐步拆分文献库、获取、解析、阅读器等职责。当前模块化不执行这一步，也不修改用户文献库或已安装实例。

## V02-003D 内部候选（未发布）

引擎 npm `0.2.0-dev.2`，Python wheel `0.2.0.dev1`；仅客户端 Excel 暂停冲突提示变更，Python 源码无差异。

- 来源：`26abee5f8c8e4f92f26a9b7fba4ddd236e523b05`（独立 A 003D 工作树）。
- 本地制品：`inputs/scientific-reading.tgz`，SHA256 `2e1ec6ebbc9ca37d33060d978f5d1f855455bb4423cc5b481957b3da0259bc09`。
- wheel SHA256 `b5d6439b1e3e895e0127dac27ec2b12b9f0bdd46d813896a6a90fd990e2b66d3`。
- 无远程发布 URL；固定 DSH rc.7、Node 22.22.2、Python 3.11.16。新候选安装结果见 V02-003D 证据，不沿用 dev.1 的安装结论。
