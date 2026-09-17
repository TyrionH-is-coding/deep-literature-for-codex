# 开始使用 Deep Literature for Codex

首次使用请阅读 [README 使用指南](README.md)，按顺序完成：

1. 按 [平台指南](docs/platforms.md) 下载对应安装包，运行 Windows 或 macOS/Linux 安装器。
2. 在 Codex 对话中打开工作台。
3. 配置工作台自己的模型：使用 DSH 原生模型 API，或在实际启动 URL 后加 `/api/codex-oauth/ui`，由本人完成 Codex OAuth，再选择 OpenAI Codex 模型。外层 Codex 登录不会自动接入本实例。需要全文解析时，按 [MinerU API Key 教程](docs/mineru-api-key.md) 保存 Token。
4. 发送第一篇论文，由内置 scansci-pdf 尝试获取 OA 全文；缺 PDF 时补入原任务。
5. 等待正式 Reader 生成并打开阅读。
6. 按 [Excel 长期管理教程](docs/excel-library.md) 打开总表、记录个人思考与笔记，保存关闭后同步回文献库。

README 提供可直接复制到 Codex 的安装、配置、全文获取、精读与长期管理指令，以及手动安装命令和常见问题处理。
