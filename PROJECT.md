# Deep Literature 项目总控

更新：2026-09-22。目标：控制功能范围、稳定主流程、降低维护成本。当前状态以本页和[任务台账](docs/project/tasks.json)为准，历史报告按需查阅。

## 当前可用结果

**dev.5 候选的三域恢复已验收并合入开发分支；下一步是一篇真实论文的使用验收。** 停机备份后，可在独立新路径恢复文献库/资产、原生会话与 handoff；两次重启保持执行门禁，明确确认后继续原任务。ASCII 和中文路径均有实际安装证据。

- 集成提交：A 引擎 `d55d4e91893945c94b6f61c7fcc138a932933b8d`，B 工作台 `a81aa94d0dce98d1e97b660e899c36a2300def3d`。制品生产源码固定 A `8b195c9` / B `058afb0`，与集成生产树一致；[006 总控验收](docs/project/evidence/V02-006-control-review.md)记录精确来源和边界。
- dev.5 ZIP SHA256：`cb0d5a01b3cad6c6292aa10a7eaf1b9af76c244a069e856322fc7561d6c35044`。候选及证据保留于 `C:/tmp/v006/candidate-r4/`，原包不改写。限定 Windows x64、同制品、固定 DSH rc.7、单 workspace 及支持状态。
- 已独立核对会话历史前缀、文献/分类/任务关系、Reader/PDF、个人记录，以及无误重放、显式续接、失败隔离与正常关闭。F2、006-R1/R2 在上述范围关闭；[演示步骤](docs/project/evidence/V02-006-demo.md)可查看保留结果。
- 005 的合成主流程与浏览器演示仍保留；005/006 都不代表真实解析或科学内容质量通过。006 实验实例均已停止，临时 profile 和故障钩子已恢复。

## 当前等待与下一项可见结果

**007 已按用户指定论文和 GPT 模型开始准备新隔离实例。** [007 任务卡](docs/project/tasks/V02-007.md)固定同一 dev.5 制品，目标为入库 → 获取 PDF → MinerU → 实际 GPT 模型 → Reader → 记录保存与重启读回。复用已有恢复和回归证据，不重复无变化源码全集。

用户指定的 CD4+ Perturb-seq 论文已查到 Cell 正式版（DOI `10.1016/j.cell.2026.08.002`）；正式全文站出现访问验证，公开 bioRxiv v1 已下载并单独标注版本。本轮只处理这一篇，不自动增加付费重试。用户接下来在隔离实例本人配置 GPT 登录/选择与 MinerU Key，最后判断内容质量。密钥不进入聊天或报告；外层 Codex 登录不代表工作台已登录。尚未启动真实解析或模型调用，定时循环保持暂停至本地配置可继续。

最终制品交付/发布归 008，依赖 007 结论。main 仍为 rc.6 文件树 `e7160eb`，用户安装未升级，v0.2 未发布。当前恢复证据不能推广为跨平台/跨版本迁移；桌面 Excel 编辑及自动选中行仍按实际验收范围说明。

## 工作入口

- [v0.2 范围与发布门槛](docs/project/v0.2-plan.md)、[协作与分级验证](docs/project/session-protocol.md)、[自动总控循环](docs/project/auto-loop.md)。
- [007 任务卡](docs/project/tasks/V02-007.md)、[006 验收](docs/project/evidence/V02-006-control-review.md)、[模块地图](docs/modules/README.md)、[决策记录](docs/project/decisions.md)。
- [流程调整前的历史快照](docs/project/history/2026-09-18-before-workflow-review.md)仅供追溯，不默认载入。

开发使用指定独立工作树。旧 dsh reader、真实安装、凭据和文献库不作为开发试验环境。最多两个通过独立性检查的开发任务，合入串行；新发现先分类，原目标内优先在原任务修复。
