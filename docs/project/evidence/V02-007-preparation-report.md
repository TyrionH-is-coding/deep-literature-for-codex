# V02-007 隔离实例准备报告

状态：**准备完成、等待用户本人登录；V02-007 真实使用未验收通过。** 本轮仅安装固定 dev.5、启动同一新实例，并读取空 tasks/folders。

- 工作树：`C:/Users/15694/Documents/ChatGPT/deep-literature-v02-007`，分支 `codex/v02-007-real-use`；base `7d53ab5b3c66fdee77820b64d94c8a49ea03ed97`，总控 context `aecd648fa4207bb11b219a04ef2e9c068da6de20`。准备开始 2026-09-22T01:57:39.9770580+00:00，首个 90 分钟检查点 2026-09-22T03:27:39.9770580+00:00。
- 固定 ZIP：`C:/tmp/v006/candidate-r4/deep-literature-for-codex-0.2.0-dev.5-win-x64.zip`；SHA256 `cb0d5a01b3cad6c6292aa10a7eaf1b9af76c244a069e856322fc7561d6c35044`。全部 628 个 BUILD-MANIFEST 文件通过 SHA256 校验；A 源码 `8b195c9109efd92ba74c37bb244b2c6b155060de`，B 源码 `058afb0fe8ebd5e39a4f9ca7e495011e4cde61ca`。
- appSha256：`bc4479d1e5a402f1a4f0d9d95e80142de65e0de25fec14a4a52366ef5fa92ee7`。私有 Node 22.22.2、Python 3.11.16/20260901 的归档只读复用 006 downloads，并重新按 pins 校验；DSH 保持 0.1.0-rc.7。
- 原始 install.ps1 于 2026-09-22T01:58:49.1515298+00:00 至 2026-09-22T02:02:19.9103651+00:00 执行，返回 JSON ok=true、installation=installed；包装器未取得原进程退出码（null，不能视为 0）。一次安装尝试，依赖仍使用原锁文件；未传 InstallSkill 或 LibraryBackup。
- 实例根：`C:/tmp/v007/instance`；instanceId `60fac980-1b27-4960-a1c7-27c08964480b`；launchId `2159e600-ffdb-4c98-b96b-4bf4e17bacdb`。实际已安装的私有 Node + launcher CLI 返回 running，与 HTTP 身份一致。端口由 OS 分配。
- 当前入口：[实例身份页](http://127.0.0.1:49686/__workbench)、[工作台](http://127.0.0.1:49686)、[本人订阅登录](http://127.0.0.1:49686/api/codex-oauth/ui)。实际 tasks=0、bindings=0、folders=0；末次 status 仍 running。实例保持运行供总控打开。

证据：[初始回执](V02-007-receipt.json)、[就绪身份](V02-007-ready.json)、[日志/SHA 索引](V02-007-evidence-index.json)。详细 628 项校验与安装日志保留于 `C:/tmp/v007/evidence/`，仅本机可用，不应在复核前删除。脚本语法与差异检查通过；同制品既有全集证据沿用 006，本轮未重复产品全集。

发现：开发工作树的 npm modules list/context 因缺 acorn 未运行成功；未安装开发依赖，总控已在控制仓库成功读取模块入口。首次日志包装器因原进程 ExitCode=null 误报失败，保留原始结果并改用 Start-Process -Wait 捕获后续退出码；未重跑安装。实际安装成功 JSON 及已安装 CLI/身份/空任务探测均已核对，未发现产品安装错误。包装器最终修订未另行重装验证。

边界：未读取/复制任何既有凭据，未改用户 Skill、旧实例或总控台账；未进行浏览器登录、入库、提交、投递、模型或 MinerU 调用。论文及 papers/ 由总控另行管理。本人登录/选择实际 GPT 模型、MinerU 配置、真实解析/Reader 内容核对、记录编辑与重启保持均待后续；不声称 007 通过。需要停止时，仅用本实例 `workbench.ps1 stop -Root C:/tmp/v007/instance`，不按进程名清理。
