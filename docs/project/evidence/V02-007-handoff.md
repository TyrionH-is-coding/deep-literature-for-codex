# V02-007 当前交接：验收样本已更换为 CIMA

2026-09-25 当前指令：用户改选 **Chinese Immune Multi-Omics Atlas**（Science，DOI `10.1126/science.adt3130`，PMID `41505528`），仍用 GPT。[新题录与来源](V02-007-cima-selection.json)。新样本 PDF/入库/分类绑定尚未完成，当前 paperId/folderId/nativeSessionId 在台账置空；旧身份完整保留在 previousSamples。不得沿下列历史步骤继续处理旧 CD4 论文。后续先取得合法全文、核对身份与科学锚点，再查隔离实例实际状态并准备新题录/绑定；用户配置门槛不变。本次仅更换计划与题录，未启动实例或模型调用。

## 2026-09-22 准备快照（已被换文指令部分取代）

2026-09-22：固定 dev.5 隔离实例已启动，公开预印本身份和题录已准备。**仅准备阶段通过；007真实使用未通过。** 准备提交 `a372fc9441a97e4125a9dcf2deea0f53c8bd59f6` 合入 `a92f779c9f92c3e279f6e97452407d89bcc35d4f`，无生产差异。总控核对17份原始证据、5份脚本SHA及44份实际安装B源码；沿用006的同制品回归。安装包装器退出码null原样保留，以成功JSON和实际CLI/HTTP/浏览器就绪确认安装结果，未重装。

## 历史实例及旧样本身份

- 根：`C:/tmp/v007/instance`；instanceId `60fac980-1b27-4960-a1c7-27c08964480b`；本次 launchId `2159e600-ffdb-4c98-b96b-4bf4e17bacdb`。
- 本次[工作台](http://127.0.0.1:49686/)与[订阅登录](http://127.0.0.1:49686/api/codex-oauth/ui)已在内置浏览器核对。重启后先用本根CLI重新取URL/身份，不假设端口不变。保持运行供用户登录。
- paperId `doi_10.64898_2025.12.23.696273`；分类“CD4 T细胞与免疫调控”，folderId `folder_ec9d48c08fb84d7da496cc68900d719d`；绑定 sessionId `session-48b54a9a-8f84-4761-83bf-174692391682`。
- 正式版 Cell DOI `10.1016/j.cell.2026.08.002`。当前本地PDF是**bioRxiv v1**，63页；不冒充Cell正式PDF。[版本与PDF来源](V02-007-paper-selection.json)、[局部原文锚点](V02-007-paper-check.md)。
- PDF：`C:/tmp/v007/papers/Zhu-2025-CD4-Perturb-seq-bioRxiv-v1.pdf`，SHA256 `4ea1f4e517c2c96d615955c5d3c375e0791676817665841cb4f347094b77c55a`；尚未通过完整精读task附入资产。

## 历史实际动作与当时计划（旧样本不再执行）

实际创建分类、入库、move、bind后，完整精读tasks仍为0，bindings/folders各1。ingest触发自带 metadata_enrichment/XLSX 派生作业；这不等于GPT或MinerU精读。请求与回执在 `C:/tmp/v007/papers/requests/`。无用户凭据读取/复制，没有调用GPT/MinerU；当前登录页“未登录”，新会话默认显示DeepSeek-V4-Flash，**未使用，也尚未切为GPT**。

已请用户在本实例点击“使用ChatGPT登录”→“打开OpenAI授权页”并本人完成。收到“已登录”后，只核对脱敏状态与实际可用模型列表，选择GPT并验证对目标分类会话生效；不能以新会话选择器状态推断已有绑定配置。默认侧栏隐藏空绑定会话（005已记前置条件），本轮未为显示页签而发送模型消息。随后引导到文献会话的“设置与状态”保存MinerU Key，密钥不经聊天/日志。

准备就绪后先查tasks/folders/item，继续现有论文/分类，提交一个稳定键的完整精读任务，再使用真实路径与正式attach合同附PDF；不要直接改SQLite或重复入库。待原文解析和真实GPT译文/导读形成后，请用户按锚点判断质量、实际编辑记录并重启读回。仅这一篇，不自动增加付费重试；故障保留现场，再在原任务记录取舍。

证据：[准备报告](V02-007-preparation-report.md)、[准备索引](V02-007-evidence-index.json)、[总控准备复核](V02-007-control-preparation.json)。原准备报告中的空库计数是入库前快照，后续计数以总控复核为准。总控首次调用launcher多传root导致本地退出1、未到API，改用已安装 `src/cli.mjs call <root> <requestFile>` 后通过，无产品修改。若用根 `launcher.mjs`，其自身注入root，形式为 `launcher.mjs call <requestFile>`。

自动循环暂停在用户配置门槛；无开发者仍运行。main/用户安装/旧实验实例未改。停止时只用此根CLI，不按进程名清理。
