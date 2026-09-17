# 安装、升级、回退与迁移

rc.4 增加 macOS/Linux 安装支持；本页保留 Windows 命令，其他系统使用 [平台指南](platforms.md)。安装器使用发行包中固定的版本和 SHA；不跟随 `latest`，不修改系统 PATH 或用户原 DSH。

## 安装

解压发行包后：

```powershell
powershell.exe -NoProfile -File .\install.ps1 -PluginArchive .\inputs\scientific-reading.tgz -InstallSkill
```

默认根为 `%USERPROFILE%\CodexScientificReading`；`-Root` 可指定新目录。未知非空目录会被拒绝。`-SkillsDirectory` 可覆盖专用 Skill 的安装位置。同名 Skill 被用户修改或不属于本实例时，工作台安装或升级仍正常完成；结果的 `skill` 返回 `status: retained_custom_changes`、`reason: skill_conflict` 和保留路径，既有内容及所有权收据不改写。本安装器先前写入且未经修改的版本可正常升级；文件读取、收据损坏等真正错误仍会使安装报错。

运行环境分成不可变代目录 `releases/<构建SHA前16位>`，其中保存该代程序、npm、venv 和模块映射。短目录名适应 Windows 默认路径限制，描述符仍校验完整 SHA，前缀冲突会拒绝安装。`installation.json` 选择当前版本。Node/Python 基础解释器在 `runtime` 内按固定版本存放。

`library`、`workspace`、`state` 位置稳定；同一实例不因更新生成第二套文献库。

## 使用与升级

```powershell
$readingRoot = Join-Path $env:USERPROFILE 'CodexScientificReading'
& "$readingRoot\workbench.ps1" start
& "$readingRoot\workbench.ps1" status
& "$readingRoot\workbench.ps1" stop
```

解压新候选后，用其 `install.ps1` 指向相同 `-Root` 即为升级。安装器先完成新依赖，再停止本实例，调用 A 的一致性备份，切换描述符并实际验证启动。备份会等待后台任务，忙或失败时保留旧版本，不根据 PID 强制终止解析。失败候选仍保留供诊断，当前版本恢复为旧程序。

原来在运行的实例升级后继续运行；原来停止的实例完成探针后仍停止。

```powershell
& "$readingRoot\workbench.ps1" rollback
& "$readingRoot\workbench.ps1" recover
```

`rollback` 回到最近的旧程序，文献和笔记保持当前内容。不会用旧数据库覆盖升级后新增的成果。首版仅支持相同数据格式的版本切换；跨格式须提供专用迁移，不自动猜测兼容性。

`recover` 用于进程中断后残留的版本切换日志；也可重新执行发行包安装器恢复。普通启动发现未完成切换会停止并提示恢复，不把半安装状态当成功。

## 从 A 迁入

先通过 A 的 `sr_library_backup` 或 `library-backup` 得到完整备份包，再安装至一个新根：

```powershell
powershell.exe -NoProfile -File .\install.ps1 -Root 'D:\文献工作台' -PluginArchive .\inputs\scientific-reading.tgz -LibraryBackup 'D:\备份\文献库.zip' -InstallSkill
```

恢复调用 A 原生合同，检查 schema、路径、文件 SHA 和正式资产；目标库必须为空。任务保留为需显式继续，不自动启动解析或模型。凭据不在 A 的文献备份中，需在 B 内重新配置。原 A 的活动库保持独立。

## 卸载

```powershell
& "$readingRoot\uninstall.ps1"
```

卸载先停止本实例并生成一致文献备份，然后移除 B 的运行程序和未经修改的自有 Skill。`library`、`workspace`、`state`、实例标记仍保留，包括原模型/登录配置，便于重装。修改过的 Skill 会报告并保留。

如果只是暂时不用，调用 `stop` 即可。清除文献或账号资料属于单独操作；卸载不会把它们当作缓存删除。
