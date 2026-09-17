# Application：安装与运行入口组合

本模块保留在 `src/` 的扁平入口与顶层平台脚本中，具体归属见 [`catalog.json`](../../src/modules/catalog.json)，变更记在 [application 记录](changes/application.md)。它选择和组合模块，不承载新增领域逻辑。

## 入口与数据

- `node src/cli.mjs <command> [root] [额外参数]`：支持 `start/status/stop/call/install-skill/rollback/recover/retire`；返回包含 `ok` 的 JSON。`call` 的额外参数为请求文件，`install-skill` 为 skills 目录。
- `node src/install.mjs <root> <archive> [skillsRoot|-] [backup|-]`：校验引擎包、准备锁定依赖和发布代，调用 releases 激活，可选安装 Skill 或恢复新库。
- `launcher.mjs`：复制到安装根后，从已验证的活动发布路径转交 CLI；`uninstall` 先退役再移除返回的允许目录。
- `identity.mjs` 的 `apply(ctx)`：提供 `/__workbench/identity` 与实例 HTML 页，并通过 IPC 报告就绪/处理停止。
- `client.mjs` 的 `call(root, request)` 为 CLI 内部组合助手：先核实运行实例，再请求 `/__workbench/api`；不是其他领域模块的公共导入入口。

负责建立 `releases/<摘要前缀>/release.json`、应用副本、私有运行时、profile 包与链接，以及安装根 launcher、平台脚本和 `.workbench-node`。活动发布指针交给 releases 管理，运行状态交给 lifecycle，文献和凭据保留在稳定实例目录。

## 依赖与阅读范围

静态上游为 `foundation`、`skill`、`lifecycle`、`releases`；运行时组合 `bridge`、`oauth`、`engine`。用户、平台启动脚本与安装验收是调用方。`src/core.mjs` 等旧兼容入口仍存在，但新业务依赖使用模块入口。

CLI 参数问题先看 `cli.mjs` 与涉及模块；安装问题看 `install.mjs`、所用平台 bootstrap 和 runtime 锁；启动握手再读 identity/lifecycle。无需默认读取整个引擎或 OAuth。

## 验证边界

`npm run modules -- test application` 运行目标及下游；登记测试为 `tests/install.test.mjs`、`tests/lifecycle.test.mjs`，结果需另记。

改变安装复制路径、相对导入、依赖锁、启动参数或平台脚本时，需要对应平台的打包与隔离安装验收。改变 launcher/卸载路径还应核对完整发布回退和数据保留。安装测试通过不代表真实登录、模型调用或论文质量通过。
