# Lifecycle：实例进程与控制

入口为 [`index.mjs`](../../src/modules/lifecycle/index.mjs)，版本见 [`catalog.json`](../../src/modules/catalog.json)，变更记在 [lifecycle 记录](changes/lifecycle.md)。负责并发启动复用、本地控制、实例身份验证与停止。

## 接口与数据

- `start(root, { maintenance = false }?)`、`status(root)`、`stop(root)`：操作指定实例；运行态核对控制通道和 `/__workbench/identity`，返回该实例状态。
- `request(root, command = 'status')`：与本地 supervisor 通信；没有监听者时返回 `null`。
- `pipeName(root)`、`prepareLocalSocket(name)`：生成规范根路径对应的命名管道/Unix socket，并处理 socket 准备。
- `assertStartAllowed(root)`：拒绝未恢复的发布切换或维护期间普通启动。

`supervisor.mjs` 是独立可执行入口，不能作为普通库导入。它拥有当前子进程句柄、`state/last-run.json`、`state/launch.patch.json` 以及 supervisor/DSH 日志；读取 `installation.json` 选择运行时。停止依据已验证实例与活进程句柄，不依据磁盘旧 PID 杀进程。

## 依赖与阅读范围

静态上游为 `foundation`。运行时通过安装应用的兼容路径装配 `bridge` 与 identity 插件，并配置引擎和 OAuth。静态下游为 `releases`、`application`；运行组合关系见登记的 `runtimeDependencies`。

控制异常先读 `control.mjs` 与相关测试；进程和就绪握手再读 `supervisor.mjs`、应用 `identity.mjs`。不要为检查启动状态加载论文处理实现。

## 验证边界

`npm run modules -- test lifecycle` 覆盖目标及下游；登记测试为 `tests/lifecycle.test.mjs`、`tests/platform.test.mjs`。执行结果另记，本文不作通过声明。

修改进程路径、IPC、管道/socket、就绪身份或退出行为时，需测试并发启动、失败恢复、停止及相关操作系统。修改 launch patch 或插件路径还需真实隔离安装与宿主启动；mock host 测试不能证明实际 DSH 插件加载成功。
