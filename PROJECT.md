# Deep Literature 项目总控

更新：2026-09-18。目标：控制功能范围、稳定主流程、降低维护成本。当前状态以本页和[任务台账](docs/project/tasks.json)为准，历史报告按需查阅。

## 当前交付状态

**用户暂停（电脑重启）**：自动循环已暂停，004K已收到保存与停止指令；待用户明确恢复再继续。

- 稳定 main 为 rc.6 文件树（e7160eb）；用户安装未升级，v0.2 未发布。
- 已验收开发源码：A 引擎 b4a9ecc，B 工作台生产集成 697dfc4；总控资料在 codex/v02-control。最新精确提交见台账 developmentBaseline。
- 已完成：旧 Excel 覆盖防护与冲突提示、解析中断恢复的隔离安装验证；引擎停止与跨包恢复接口的源码验证。依据：[003D](docs/project/evidence/V02-003D-control-review.md)、[004D](docs/project/evidence/V02-004D-control-review.md)、[004I](docs/project/evidence/V02-004I-control-review.md)。
- **004J源码闭环已验收**：多条交接记录恢复一致，见[复验](docs/project/evidence/V02-004J-control-accepted.md)。004K隔离安装组合任务已启动；005尚未启动。
- 最近已验证安装候选为 dev.3，其原安装证据不包含后来的完整停止链；源码通过不能替代新组合安装通过。

## 发布缺口与下一项可见结果

1. 004A-G1：用户取消、引擎停止、显式恢复完整链源码已通过，仍待004K安装验收；004D-O1 已有源码修复，随同一安装组合补验。
2. F2：库/资产、原生会话、handoff 三域恢复尚未实现并演练；006A/B 仅为设计与限定取证。
3. Reader 代表性样例、最终主流程、真实使用/内容质量与最终制品验收仍未完成。导航观察尚未归因，不自动立修复任务。
4. 004J已交付source-only的“停止→重启仍保持→明确恢复同一任务”样例；下一项结果是004K安装后的同一行为。004 安装验收与 005 样例检查组成首个可演示主流程，安排在完整恢复开发之前；用户反馈可并行收集，不伪造最终用户验收。

## 工作入口

- [v0.2 范围与发布门槛](docs/project/v0.2-plan.md)、[协作与分级验证](docs/project/session-protocol.md)、[自动总控循环](docs/project/auto-loop.md)。
- [004K 任务卡](docs/project/tasks/V02-004K.md)、[模块地图](docs/modules/README.md)、[决策记录](docs/project/decisions.md)。
- [本次调整前的历史快照](docs/project/history/2026-09-18-before-workflow-review.md)仅供追溯，不默认载入。

开发始终使用总控指定的独立工作树。旧 dsh reader、真实安装、凭据和文献库不作为开发试验环境。最多两个经独立性检查的开发任务，合入串行；新发现先分类，已有目标内修复优先在原任务完成。
