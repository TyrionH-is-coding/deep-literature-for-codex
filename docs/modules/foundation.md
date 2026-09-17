# Foundation：实例与基础能力

版本与依赖以 [`catalog.json`](../../src/modules/catalog.json) 为准；入口为 [`index.mjs`](../../src/modules/foundation/index.mjs)，变更记在 [foundation 记录](changes/foundation.md)。本模块提供稳定的实例身份、隔离环境、JSON 写入、文件摘要与平台路径，不处理任务调度。

## 接口与数据

- `initializeRoot(requested)` → 实例对象：规范化根路径，校验或建立 `.workbench.json`，准备 `library/`、`workspace/`、`state/`、`runtime/` 所需目录。
- `readJson(file)`、`writeJson(file, value)`：读取支持 BOM；写入使用同目录临时文件与 rename。
- `verifyFile(file, expected)`：核对 SHA256，不匹配即失败。
- `isolatedEnvironment(root, parent?, installation?, platform?)` → 子进程环境：白名单继承，设置实例自己的 DSH/Codex/Python 路径。
- `selectPlatformPins(pins, platform?, arch?)`、`runtimePaths(root, pins)`、`venvPython(root, platform?)`、`npmCli(node, platform?)`：选择固定运行时与平台路径；另导出产品常量、支持平台、默认根目录和目录链接类型。

本模块拥有实例标记的结构与根目录初始化规则。JSON 工具不拥有调用方的数据语义；创建文献库目录也不表示拥有 SQLite、PDF 或阅读产物。

## 依赖与阅读范围

没有内部上游模块；仅依赖 Node 内置模块。直接下游包括 `skill`、`lifecycle`、`releases`、`workflow`、`bridge`、`application`。先看入口与相关基础文件；环境问题读 `environment.mjs`，平台问题读 `platform.mjs`，无需同时加载工作流或 OAuth 实现。

## 验证边界

`npm run modules -- test foundation` 覆盖目标及下游；本模块登记测试为 `tests/core.test.mjs`、`tests/platform.test.mjs`。这是执行入口说明，不是当前通过报告。

实例标记、环境继承、默认目录、平台路径或 JSON 持久化方式变化会影响多个模块，需检查下游和相应平台安装。修改常量还需核对发布、Skill 与兼容入口。只调整说明文字时核对事实和链接即可。
