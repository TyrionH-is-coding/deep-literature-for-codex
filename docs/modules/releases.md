# Releases：发布代与数据恢复边界

入口为 [`index.mjs`](../../src/modules/releases/index.mjs)，版本见 [`catalog.json`](../../src/modules/catalog.json)，变更记在 [releases 记录](changes/releases.md)。负责完整安装代的激活、回退、故障恢复、退役，以及通过引擎执行文献库备份和空库恢复。

## 接口与数据

- `activateRelease(root, candidate, { lifecycle?, snapshot? }?)`：校验描述、维护锁、数据格式与路径，备份后切换；启动失败恢复先前安装代。
- `rollbackRelease(root, options?)`：查找发布历史中的上一代，再经同一激活流程切换。
- `recoverRelease(root, { lifecycle? }?)`：恢复未完成的切换；`retireInstallation(root, { lifecycle?, snapshot? }?)` 备份并退役，返回允许移除路径。
- `snapshotLibrary(root, release)`、`restoreNewLibrary(root, release, archive)`、`runLibraryCommand(root, release, args)`：调用该发布代的 Python 引擎；恢复要求空库或相同迁移回执。
- `maintenancePipe(root)`：维护互斥通道名称。

拥有活动 `installation.json`、`state/release-transition.json`、发布历史/失败/恢复/退役记录、profile 的托管模块链接，以及 `state/library-backups/`、`state/library-migration.json`。发布描述由安装器生成，本模块核对并选择。回退代码不会回退 SQLite、论文、会话或凭据；不同 `dataFormat` 不能直接切换。

## V02-006 整实例恢复

公共入口增加 `backupInstance`、`verifyInstancePackage`、`restoreInstance`、`startRecovery`、`validateRecovery`、`continueRecovery`；CLI分别为 `instance-backup ROOT OUTPUT`、`instance-verify PACKAGE`、`instance-restore NEW_ROOT REQUEST.json`、`instance-start-validation ROOT TRANSACTION_ID`、`instance-validate ROOT TRANSACTION_ID`、`instance-continue ROOT REQUEST.json`。

恢复请求包含 archive（三域目录包）、packageRoot（同完整制品解包目录），可选已校验runtimeCache。包固定manifest/library.zip/native.json/handoff.json，文件数/摘要/大小严格核对，不是旧library ZIP。恢复只接受不存在的新根；失败保留隔离标记、重试另一个新根。引擎保持单次冻结握手直到三域复制校验完毕。releases拥有恢复事务写入；foundation只读门禁，lifecycle及维护启动必须核对具体transactionId与phase。安装准备阶段禁止自动启动。

`validateRecovery`执行两次实际验证宿主重启并核对原生历史前缀和Reader，完成后仍保留待核对门禁。确认请求必须包含transactionId、confirmManifestSha256、taskId、idempotencyKey、expectedRevision、input；仅指定parent获得现有停止恢复合同的许可。原生队列/模型/工具继续保持禁止；必要xlsx派生由A逐项审计授权。prepared/uncertain、取消、coveredStops不删除或隐式重发。

后续gate通过 `instance-stop ROOT REQUEST.json`（同一确认字段、taskId/idempotencyKey/expectedRevision，不带input）先明确停止，再以新停止revision和新幂等键执行instance-continue。`stopRecovery`仅授权已确认parent的精确停止请求。每代许可写入grantHistory；旧请求只读重放旧结果/操作，不替换当前许可、不清除新停止意图。派生许可重绑保留priorRequestIds；必须有前代许可审计。

首版只支持同平台/同完整制品、DSH rc.7单workspace和默认产品preset；媒体/spill/未知持久状态、外部执行输入、用户自定义profile/preset、库内解析器venv和待上传暂存拒绝。源码测试/适配层不是安装验收，证据见V02-006交付索引。

## 依赖与阅读范围

静态上游为 `foundation`、`skill`、`lifecycle`；备份通过所选 release 的 Python 调用外部引擎。下游为 `application` 安装器与 CLI。切换问题读 `releases.mjs`，库备份/迁移问题读 `library-transfer.mjs`；只有涉及进程恢复时再看 lifecycle。

## 验证边界

`npm run modules -- test releases` 覆盖目标与下游；登记测试为 `tests/releases.test.mjs`、`tests/install.test.mjs`。这些命令未在本文中被标记为已执行。

修改描述格式、维护锁、profile 链接、启动失败恢复或移除路径时，需要对应升级/中断恢复/退役验收。改变备份格式、引擎命令或 `dataFormat` 时，需要隔离副本上的真实库恢复与兼容性证据。不要用真实用户库进行默认模块测试。
