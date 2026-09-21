# Deep Literature 项目总控

更新：2026-09-21。目标：控制功能范围、稳定主流程、降低维护成本。当前状态以本页和[任务台账](docs/project/tasks.json)为准，历史报告按需查阅。

## 当前交付状态

**安装控制链已验收，准备首次完整演示。** 自动循环继续，当前唯一开发任务005已开工；以已验收候选检查实际 Reader 和完整使用步骤。

- 稳定 main 为 rc.6 文件树（e7160eb）；用户安装未升级，v0.2 未发布。
- 已验收集成：A 引擎 ad00bc5，B 工作台 ce5fd9；总控资料在 codex/v02-control。生产来源与精确提交见台账 developmentBaseline 及[004K总控验收](docs/project/evidence/V02-004K-control-review.md)。
- **dev.4 同一隔离安装通过**：真实 worker 停止请求/确认、两次宿主重启保持、显式恢复同任务；多别名、原生队列作用域、非法推进写前拒绝和已有资产/个人记录保护。启动提前报就绪问题已最小修复并安装复验。
- 已关闭004A-G1、004D-O1、004K-R1。验收有可信 API 操作样例与 Reader HTTP smoke，浏览器完整流程交由005；这不是用户使用或最终发布通过。

## 发布缺口与下一项可见结果

1. **下一项可见结果**：用同一 dev.4 ZIP 新建独立实例，演示入库→PDF→精读→Reader→通过现有 Excel 入口保存记录→重启继续，并展示一条显式失败恢复。005先验现有行为，无缺陷可直接结束；不预设网页笔记/停止按钮。
2. F2：库/资产、原生会话、handoff 三域恢复尚未实现并演练；006A/B 仅为设计与限定取证，等早期完整演示后推进。
3. 浏览器 Reader 样例、真实模型/内容质量、最终组合恢复及制品验收仍未完成。合成演示不替代007真实使用；导航观察尚未归因，不自动立修复任务。
4. 已知非阻断限制：进程内插件热重载路由清理未验；worker 崩溃后可能保留陈旧 running，普通新别名不自动续接。已有可信 cancel→ack→resumeStopped 可恢复，005须如实展示入口与状态，不声称自动恢复。

## 工作入口

- [v0.2 范围与发布门槛](docs/project/v0.2-plan.md)、[协作与分级验证](docs/project/session-protocol.md)、[自动总控循环](docs/project/auto-loop.md)。
- [005 任务卡](docs/project/tasks/V02-005.md)、[004K操作与证据](docs/project/evidence/V02-004K-report.md)、[模块地图](docs/modules/README.md)、[决策记录](docs/project/decisions.md)。
- [本次调整前的历史快照](docs/project/history/2026-09-18-before-workflow-review.md)仅供追溯，不默认载入。

开发始终使用总控指定的独立工作树。旧 dsh reader、真实安装、凭据和文献库不作为开发试验环境。最多两个经独立性检查的开发任务，合入串行；新发现先分类，已有目标内修复优先在原任务完成。
