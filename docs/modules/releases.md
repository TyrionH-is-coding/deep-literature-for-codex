# Releases：发布代与数据恢复边界

入口为 [`index.mjs`](../../src/modules/releases/index.mjs)，版本见 [`catalog.json`](../../src/modules/catalog.json)，变更记在 [releases 记录](changes/releases.md)。负责完整安装代的激活、回退、故障恢复、退役，以及通过引擎执行文献库备份和空库恢复。

## 接口与数据

- `activateRelease(root, candidate, { lifecycle?, snapshot? }?)`：校验描述、维护锁、数据格式与路径，备份后切换；启动失败恢复先前安装代。
- `rollbackRelease(root, options?)`：查找发布历史中的上一代，再经同一激活流程切换。
- `recoverRelease(root, { lifecycle? }?)`：恢复未完成的切换；`retireInstallation(root, { lifecycle?, snapshot? }?)` 备份并退役，返回允许移除路径。
- `snapshotLibrary(root, release)`、`restoreNewLibrary(root, release, archive)`、`runLibraryCommand(root, release, args)`：调用该发布代的 Python 引擎；恢复要求空库或相同迁移回执。
- `maintenancePipe(root)`：维护互斥通道名称。

拥有活动 `installation.json`、`state/release-transition.json`、发布历史/失败/恢复/退役记录、profile 的托管模块链接，以及 `state/library-backups/`、`state/library-migration.json`。发布描述由安装器生成，本模块核对并选择。回退代码不会回退 SQLite、论文、会话或凭据；不同 `dataFormat` 不能直接切换。

## 依赖与阅读范围

静态上游为 `foundation`、`skill`、`lifecycle`；备份通过所选 release 的 Python 调用外部引擎。下游为 `application` 安装器与 CLI。切换问题读 `releases.mjs`，库备份/迁移问题读 `library-transfer.mjs`；只有涉及进程恢复时再看 lifecycle。

## 验证边界

`npm run modules -- test releases` 覆盖目标与下游；登记测试为 `tests/releases.test.mjs`、`tests/install.test.mjs`。这些命令未在本文中被标记为已执行。

修改描述格式、维护锁、profile 链接、启动失败恢复或移除路径时，需要对应升级/中断恢复/退役验收。改变备份格式、引擎命令或 `dataFormat` 时，需要隔离副本上的真实库恢复与兼容性证据。不要用真实用户库进行默认模块测试。
