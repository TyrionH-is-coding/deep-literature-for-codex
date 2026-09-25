# Deep Literature 项目总控

更新：2026-09-25。目标：控制功能范围、稳定主流程、降低维护成本。当前状态以本页和[任务台账](docs/project/tasks.json)为准，历史报告按需查阅。

## 当前可用结果

**dev.5 候选的三域恢复已验收并合入开发分支；下一步是一篇真实论文的使用验收。** 停机备份后，可在独立新路径恢复文献库/资产、原生会话与 handoff；两次重启保持执行门禁，明确确认后继续原任务。ASCII 和中文路径均有实际安装证据。

- 集成提交：A 引擎 `d55d4e91893945c94b6f61c7fcc138a932933b8d`，B 工作台 `a81aa94d0dce98d1e97b660e899c36a2300def3d`。制品生产源码固定 A `8b195c9` / B `058afb0`，与集成生产树一致；[006 总控验收](docs/project/evidence/V02-006-control-review.md)记录精确来源和边界。
- dev.5 ZIP SHA256：`cb0d5a01b3cad6c6292aa10a7eaf1b9af76c244a069e856322fc7561d6c35044`。候选及证据保留于 `C:/tmp/v006/candidate-r4/`，原包不改写。限定 Windows x64、同制品、固定 DSH rc.7、单 workspace 及支持状态。
- 已独立核对会话历史前缀、文献/分类/任务关系、Reader/PDF、个人记录，以及无误重放、显式续接、失败隔离与正常关闭。F2、006-R1/R2 在上述范围关闭；[演示步骤](docs/project/evidence/V02-006-demo.md)可查看保留结果。
- 005 的合成主流程与浏览器演示仍保留；005/006 都不代表真实解析或科学内容质量通过。006 实验实例均已停止，临时 profile 和故障钩子已恢复。

## 当前等待与下一项可见结果

**CIMA 的独立 HTML 精读已由当前 Codex 直接生成，已打开供用户阅读；DSH 自动主流程尚未通过。** 用户要求不依赖 DSH 后，复用已解析的同一篇正文，交付中文精读、六幅主图导览、25页原版图像/可搜索英文原文及浏览器本地笔记。它不是逐句全文中文翻译，也未写入项目正式 Reader 资产。文件：`C:/Users/15694/Documents/ChatGPT/CIMA-reading/CIMA-精读.html`。[交付与校验证据](docs/project/evidence/V02-007-cima-direct.json)。

用户追加的**细读版也已交付**：`C:/Users/15694/Documents/ChatGPT/CIMA-reading/CIMA-细读.html`。正文逐段中英对照、六幅主图完整图注译文、分节方法解读，保留25页原图及搜索/笔记；方法解读不冒充逐字全文翻译。[细读证据](docs/project/evidence/V02-007-cima-close-reading.json)。

已实际核对原 PDF SHA、HTML/HTTP SHA、图六跳转、IKZF4跨页搜索及笔记刷新读回，测试笔记已清空；用户科学内容质量反馈仍待收集。DSH 原任务已通过支持入口请求停止，control acknowledged，原生会话现为 running=false / seq22；没有追加付费请求或重跑 MinerU。自动循环保持暂停，007产品主流程及008发布门槛未关闭。[007任务卡](docs/project/tasks/V02-007.md)与[当前交接](docs/project/evidence/V02-007-handoff.md)保留具体缺口。

论文为 Chinese Immune Multi-Omics Atlas（Science，DOI `10.1126/science.adt3130`，PMID `41505528`）。用户提供的PDF已完成真实MinerU解析；DSH GPT首请求失败，唯一批准的额外重试无进展后停止。固定制品不提供用户要求的GPT-6-Sol，未升级或擅自更换模型。[历史处理证据](docs/project/evidence/V02-007-cima-real-processing.json)、[停止前停点](docs/project/evidence/V02-007-cima-stalled-retry.json)。

最终制品交付/发布归 008，依赖 007 结论。main 仍为 rc.6 文件树 `e7160eb`，用户安装未升级，v0.2 未发布。当前恢复证据不能推广为跨平台/跨版本迁移；桌面 Excel 编辑及自动选中行仍按实际验收范围说明。

## 工作入口

- [v0.2 范围与发布门槛](docs/project/v0.2-plan.md)、[协作与分级验证](docs/project/session-protocol.md)、[自动总控循环](docs/project/auto-loop.md)。
- [007 任务卡](docs/project/tasks/V02-007.md)、[006 验收](docs/project/evidence/V02-006-control-review.md)、[模块地图](docs/modules/README.md)、[决策记录](docs/project/decisions.md)。
- [流程调整前的历史快照](docs/project/history/2026-09-18-before-workflow-review.md)仅供追溯，不默认载入。

开发使用指定独立工作树。旧 dsh reader、真实安装、凭据和文献库不作为开发试验环境。最多两个通过独立性检查的开发任务，合入串行；新发现先分类，原目标内优先在原任务修复。
