# V02-007 当前交接：验收样本已更换为 CIMA

## 当前：Codex直接交付，DSH任务已停止

2026-09-25 用户要求不依赖DSH，由当前Codex完成。已交付 `C:/Users/15694/Documents/ChatGPT/CIMA-reading/CIMA-精读.html`：中文精读、6幅主图导览、25页原版图像和可检索英文原文、浏览器本地笔记。全部图像内嵌可离线阅读，中文部分不是逐句全文翻译；没有补充材料文件的独立核验。[SHA与实际验证](V02-007-cima-direct.json)。文件、HTTP内容一致；页面跳转、全文检索和笔记刷新读回已核对，测试笔记已清空。

原任务通过受支持cancel入口停止：control acknowledged，随后session.list确认running=false，asOfSeq22。没有新模型/MinerU请求、没有改固定制品或伪造正式Reader完成状态。自动循环保持PAUSED；007主流程、用户科学质量、产品库内记录及重启门槛仍待验，不能推进008。用户可先阅读独立交付，再决定是否将直接Codex执行纳入产品路线；当前并未据此实施架构改造。

## 历史：停止前处理快照（不再作为当前执行指令）

2026-09-25 当前执行：用户提供的 CIMA Science 正文 PDF（25页、SHA256 `c198e63153bd83f2f6cf6b10a88216dc6f84eeed5848a4e0a8688e5829e91804`）已附入原 task；MinerU 配置经受支持入口保存在 secure_store，不采集密钥到证据，实际解析通过。绑定会话已验证 OpenAI Codex / GPT-5.6-Sol / medium。首次请求失败 `CODEX_ERROR: Reconnecting... 2/5`，尚无译文；用户仅批准额外重试一次，已通过固定 retryKey `v02-007-cima-user-approved-retry-1` 投递，仍等待结果。用户要求尝试 GPT-6-Sol，刷新列表与实际选择均不支持（`dsh_model-unavailable`），当前模型未改。不能额外失败重试或擅自升级固定制品。

**04:53Z 新停点：自动循环已暂停。** 原 task 仍为 waiting_agent/translate_full_read（batch-0001）；原生会话 running=true，但最后事件仍是重试提示 seq20，与上轮一致，无新的 request/header、工具调用、输出或终态。没有取消原生 turn 或停止实例，不声称终态失败。先读[停点证据](V02-007-cima-stalled-retry.json)，诊断模型/恢复链；不能重复 dispatch、换键或付费重试。后文“正在跟踪/限定恢复”是本次暂停前的历史动作。

唯一根 `C:/tmp/v007/instance`；当前 URL `http://127.0.0.1:58657/`，launchId `639c87a3-c2be-49b4-8a5d-00d2ed5ae173`。CIMA paper `pmid_41505528` / folder `folder_415f41ea96f1426e8db703e623823f76` / session `session-250eee33-0d2a-4b53-9940-f5ca23485a73`。原 task `task-ca0ffd78-671f-48b7-ab7d-5c61f82d9618` / parent `job_13384b8d8eb7151f`，不要重复 submit、上传或解析。

[实际处理证据](V02-007-cima-real-processing.json)。自动循环已限定恢复：只跟踪当前重试；新 gate 正常推进，失败则诊断并停下，不增失败重试。现有模型请求未到终态，不声称生成成功；HTML 后还需用户质量验收。已验证 API 模型配置后，浏览器对应分类会话同样显示 GPT-5.6-Sol/medium。

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
