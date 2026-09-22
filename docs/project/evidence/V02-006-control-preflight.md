# V02-006 固定首版源码复核

2026-09-22。本次仅只读固定代码和已有日志；未操作开发实例、未复跑产品测试，不是交付验收。A `9ea7c7dfe766e7435e27c0794690a9e93f830863` 加已固定 worker 修正 `2226754c71f6a37fa5ec8c45bc34ad12e59d852f`；B `ee2f471e806b9bf425702edf706fe03c5b38ba45`。复核者为总控、control_plan_review、startup_readiness_review。

## 006-R1：后续明确输入/恢复授权被首个许可永久锁死

B `src/modules/releases/instance-recovery.mjs:331–340` 将每个parent许可固定为首个requestId、revision、inputDigest。后续需要新的required_input，或重新停止后以新幂等键恢复同parent，会先报 `recovery_parent_confirmation_conflict`。普通宿主仍无恢复写许可，不能作为后续入口绕过。此处当前只支持同一请求重试，未支持完整任务跨输入/停止代继续。

A `recovery_identity.py:81–87` 同样以childJobId固定XLSX派生许可，但记录包含parentRequestId：首个授权写许可后、enqueue前中断，再以新授权继续同parent，即使child尚未创建也会发生 `recovery_derived_permission_conflict`。B当前还会先拒绝新授权，故修复需覆盖整条链，不可只改A。

归类：当前目标必要修复，阻断本卡完整恢复验收。在原范围内用既有revision/幂等与恢复专用记录衔接新许可，保留旧请求结果和审计；旧请求不能覆盖新停止代，也不能给其他parent/child放行。需经过可信恢复入口与真实launcher，验证第二次所需输入、再次停止/明确恢复、派生许可写入后中断及重复/丢回执，不只停在首次合成等待点。

## 006-R2：队列写入拦截误伤宿主正常销毁

B `bridge/plugin.mjs:31–33` 无条件令inbox.splice抛错。固定DSH rc.7实际源码：`@deepseek-ai/dsh-agent-loop/lib/index.js:1116` 销毁调用 `machine.cancel({kind:'disposed'})`，第407行调用inbox.clear；`@deepseek-ai/dsh-agent/lib/index.js:44–46` 的clear即使队列为空也调用splice。加载agent后的正常销毁因此抛 `instance_recovery_execution_blocked`，跳过后续whenIdle/scope.dispose。

依赖取证路径为 `C:/tmp/v006/source/releases/a35e8b07025c28e1/runtime/npm/node_modules/`。源码证明清理路径冲突；异常退出或兜底强杀是否发生仍待隔离安装日志，不能由stopped状态推断正常关闭。归类：当前目标必要修复，阻断正常两次重启验收。在原bridge/lifecycle允许路径内维持不消费/不改写恢复队列的同时提供正常销毁路径，不升级DSH、不关闭业务拦截。须实际加载agent/保留待发队列，检查正常退出、无异常/兜底强杀、队列不变及执行计数。

## 现有失败与下一步

- A全集 `C:/tmp/v006/logs/a-engine-all-2.txt`：597通过、2失败、3跳过；两失败因worker新增selected.data_root依赖破坏调用方。开发已自行修正为持久request根（2226754）；`a-integrity-3.txt` 10项通过，新的全集仍运行。本次不重复提出已处理问题。
- B初轮 `b-all-1.txt`：121通过、1失败、1跳过；新增exclusiveMaintenance泄露旧公开入口。`b-compat-fixed.txt` 25项通过，固定B的最终证据仍随交付核对。
- candidate-r1记录的A来源仍9ea7c7d；后续修复必须重建并以一致新组合取证，不能拼接通过结论。

两项发回同一任务处理，属于首轮固定源码复核返工；不新增任务、不扩大产品功能、不合入未验收代码。原90分钟检查点保持；新固定代码只补相关证据，最终安装组合门槛不变。F2开放。
