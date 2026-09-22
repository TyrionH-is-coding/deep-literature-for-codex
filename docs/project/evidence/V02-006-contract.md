# V02-006 首轮最小恢复合同（实现中）

固定输入：A `ad00bc5a84110346801dbb6e98c8b9e19135287d`，B `0b512ab25955e9f7dd3ddae3f15e88c14d0e03c1`，总控 context `ae2cb788c35411416d9bd087bf713852ab66c274`。任务根仅 `C:/tmp/v006/`。此页是检查点，不是验收通过。

## 已有复现与调用事实

实际运行 A `scripts/v02-006-risk-probe.py`（固定 Python 3.11.16，`-X utf8 -I`），原始结果 `C:/tmp/v006/checkpoint/risk-jmuybew7/risk.json`：新中文/空格根保留 parent `job_ede7d54835f3b59d`，重算变成 `job_63f7d45523228962`；原生 `ReadingControl.read()` 报 `full_read_parent_mismatch`。revision=1、requestId=`v006-stop`、operations 原样存在，故不得清空控制记录绕过。同脚本证实库备份后写锁立即可重新取得；外套冻结再调用库备份报 `backup_inside_active_operation`。

`status.scope.instanceId` 随 job 原样复制；新实例调用的 capture_scope 会不相等。`control.json` 本身不含 instanceId，但依赖 parent 和 status.scope 授权，read 还能 acknowledge 写盘。B `Handoff.open` 立即 `_refresh → reconcileStop`；`activateRelease` 无条件 maintenance start；control/supervisor 的 maintenance 当前跳过 assertStartAllowed。以上是固定源码调用事实，完整安装副作用与新门禁将在候选验收取证。

## 实施合同与边界

1. 新增 `deep-literature-instance-backup-v1` 清单与恢复回执，不改 schema4 / handoff schema1 / reading-control-v1 / stable_job_id 算法。包绑定完整制品、平台、三域文件集合、大小和摘要及显式空状态；同候选离线 DSH rc.7 适配严格白名单，未知媒体/spill/preset/插件状态/多workspace拒绝。
2. 新增专用恢复身份映射。只接受源 jobId 对原始请求严格哈希正确、目标请求等于允许路径重绑定、真实 paper/folder/session 关系通过的条目。记录原/目标请求摘要和根、parent、generation、来源包摘要。普通 job 继续走原哈希校验；仅该映射参与控制与原 worker 继续接点，不改全局算法。status.scope 只改经验证的 instanceId；control revision/requestId/operations/ack 和 handoff coveredStops/prepared/uncertain/cancel 保留，worker/PID/activeStage 清理逐项审计。
3. 源维护互斥和持久备份门禁先关闭入口，再正常停止宿主；拒绝不明独立写者。引擎提供一次冻结会话，在同一进程持有锁期间完成库快照和另外两域复制/校验，避免递归锁。只有最后完整校验后非覆盖发布包。失败标记阻止未知状态自动启动。
4. 全新目标独占创建身份后、安装前写持久恢复门禁。安装选择候选但不自动启动。门禁由 foundation 公共入口读取，普通/maintenance/supervisor 同样遵守；releases 唯一拥有事务状态。失败保持隔离，重试另一个根。
5. 验证启动只开放历史/库/Reader读取，必须持续阻止原生 prompt/队列消费、模型、工具、worker 和 handoff 对账写入。验证通过仍是待核对状态，两次重启不解除。显式核对后按具体 parent 的现有 revision/requestId 合同继续；不能用全局解锁顺带启动未知旧队列。

下一检查点：完成身份映射与门禁定向负例、固定 DSH 执行拦截取证，再接三域事务。若既有宿主公共接点不足以在启动前保证禁执行，向总控提交最小范围提案，不假定短时零计数等于门禁。
