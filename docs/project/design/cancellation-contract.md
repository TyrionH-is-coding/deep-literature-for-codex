# V02-004C 最小取消合同（设计，尚未实现）

本设计只解决“停止本任务继续推进”的稳定性需求。建议用户动作称为“停止后续处理”：持久化本任务停止意图，撤回其宿主队列，在可安全归属的独占 turn 请求中断，在引擎安全边界停止继续调度。**不承诺立即打断正在执行的 provider、文件提交或独立衍生子任务。** 现有实现只完成其中一部分，不能展示为已取消整条精读流水线。

固定输入：B `93bbe23c2b35da3ff5073da47fe229f32d7d367a`；A `dcdb8e6cb23dd8329ceabd4487db0a79fae470ea`；任务上下文 `ceea8aebc90f99e0daad9344e9a38d2cca4d7658`。证据与验收缺口见 [004C 报告](../evidence/V02-004C-report.md)。本文件中的建议字段/入口均是后续实施提案，不是当前 API。

## 当前所有权与事实

| 域/入口 | 实际行为 | 不保证的内容 |
| --- | --- | --- |
| B submit | 建立/复用稳定 parent job；runAgent=false 只禁宿主 prompt，不禁 A start | 尚未 prompt 不等于引擎尚未运行 |
| B dispatch | 仅 waiting_agent 投递；同 gate 读原生 pending/delivered/canceled/uncertain，默认不重新发送 | received/accepted 不是论文完成 |
| B cancel | 检查分类和论文，await 宿主 cancelTask，随后写 cancelRequested=true 并 refresh | 无 A cancel 调用；宿主失败则意图尚未持久化 |
| DSH 队列 | 按 task.dispatches 全部 rpcId 撤回 next-turn/next-step 目标消息 | 不撤回其他任务/手动消息；不是终止 A |
| DSH turn | 仅当前 running turn 所有用户来源 rpcId 均属于任务时 cancel(keepInbox=true)；包含当前 claim 窗口证据 | 混合 turn 不中断；cancel_requested 不是已停确认 |
| B task/list/reopen | 持久标记继续屏蔽 waiting_agent/dispatched 等非终态；completed/failed 保持实际终态 | 不禁止类别代理直接 sr_continue_full_read；不停止 detached worker |
| B operate | 新成功 resume/attach 清标记；旧已完成 operation 的重复请求只 refresh | 旧键重放不等于显式重新授权；失败操作可能需 reconciliation |
| A launcher/worker/store | 独立 worker 循环 advance，状态无 canceled，CLI 无 pipeline cancel；resume 校验 gate/运行 PID | 不知道 handoff.json；可继续写 parse/batch/Reader/衍生任务 |

B 来源：`src/modules/workflow/handoff.mjs` submit 88–118、refresh 120–143、dispatch 156–185、operate 187–232、cancel 234–243；`src/modules/bridge/services.mjs` 104–129；`plugin.mjs` claims 19–24、注入 25–33、category tools 执行 51–59。行号仅用于本固定基线。

A 来源：`background_store.py` ALLOWED_TRANSITIONS；`background_launcher.py` 独立 launch_existing/_start；`worker.py` full_read_pipeline_handler_factory 的 while/advance；`__main__.py` resume_job 与 parser。只读 git show 的哈希/定位保存在 [冻结审计](../evidence/V02-004C-frozen-A.json)。004A 的资产提交/恢复实验属于旧证据，004C 未重跑 A worker。

### 自动推进边界

1. 同一 handoff 任务成功 cancel 后，默认 dispatch、同幂等键 submit 自动 dispatch、重开 Handoff 和新 gate 都不会发 prompt；task/list 本身仅 refresh。插件启动 prepareHost 不扫描任务自动 dispatch。
2. 显式 dispatch(retryKey) 在 refresh **之前**清标记；即使 A running 导致 not_needed，也已撤销抑制。重复同 retryKey 不新发第二份 prompt。普通无键 dispatch 不清标记。
3. 新成功 resume/attach 清标记；直接类别工具调用 A 不经 operate/cancelRequested 守卫。因此共享 turn 或其他已持有输入的执行者仍能推进目标任务。
4. DSH 原生 next-turn 每次领取一条；next-step 可形成共享批次。本探针用真实 Inbox.append(next-step) 合成共享 turn，不把两次普通 queue 声称为共享 turn。
5. 原生取消保留其他 inbox。重启读回不自动执行被撤回的目标 prompt；后续显式新 prompt 可先唤醒保留的其他队列。这不是 B 任务恢复授权或整实例禁止重放合同。

## 推荐的最小后续合同

### 用户结果与生效点

- 接收请求后先持久化目标 parent 的停止意图，再处理宿主/引擎。显示“停止请求中”，并分别显示宿主撤回/独占 turn 中断结果与引擎边界确认。任一域未知不能写成“已停止”。
- 推荐“已停止后续处理”的必要条件：意图仍有效；本任务宿主消息已撤回或确认不会继续提交；A 已在安全边界确认不会启动下一阶段/新 worker；并确认已有目标 worker 不再推进。共享 turn 可继续其他任务，但目标 job 的推进入口必须受守卫。
- 当前 stage 若已开始，允许完成其原子提交及 checkpoint，然后确认停止；取消与完成竞争时，实际 completed/failed 优先，不把成功 Reader 改成虚假的 canceled。返回停止请求“已由终态吸收”的事实。
- 已提交 PDF、parse、batch、Reader 字节及库指针保留；不删除/回退资产，不自动覆盖上一代 Reader。未提交 staging 沿用现有隔离/恢复规则。确认停止前仍可能有资产提交，界面应明示。
- 已经启动的独立 xlsx 子作业不连带强杀，报告 child 的独立状态；停止到达派生阶段前则不得创建新 child。此边界需在文案和验收固定，避免把 parent 停止解释为全库静默。

### 最小 A/B 接口建议

建议采用 parent job 的持久停止控制记录，区别于业务阶段/资产状态；具体存储布局和是否扩展 schema 留给实施卡决定。最低语义字段：jobId、requestId、controlRevision、requestedAt、stopRequested、acknowledgedRevision、effectiveBoundary。A 负责权威记录与一致性，B 保留宿主 dispatch 撤回证据，不复制两套竞争的引擎状态机。

建议新增 A 的 scoped `request-stop(jobId, requestId, expectedRevision)` / `read-control(jobId)`，并为现有显式 resume 提供带 expectedRevision 的解除停止协议；名称是设计示意，不可向当前 CLI 发送。必须同时约束 launcher（新建/重用启动）、worker 下一阶段、resume/attach、类别 sr_continue_full_read 与衍生调度，防止只拦 UI 的漏洞。普通 status/inspect、重复 start、宿主启动不解除停止。

A 需在 stage 边界与 launch claim 内检查停止记录；正在 stage 中只记请求，不异步打断发布事务。ack 必须与调度互斥，不能先 ack 再启动下一阶段。resume 由用户明确动作发起、校验当前 revision/gate 后恢复同一 parent，保持 source/generation/scope 与现有产物守卫。A 的 stop/resume 返回结构需含控制修订与实际运行状态，超时视为未知，通过 read-control 对账。

B 先可靠记录请求 ID，再调用 A 幂等 stop 并撤回宿主队列；失败保留 intent，重启进行只读对账和安全重试 stop，绝不自动 resume。B 对目标 job 的所有推进工具在调用 A 前检验控制态，A 仍为最终守卫，消除检查后竞态。共享 turn 的其他 job 不受阻，目标工具返回清晰 stopped/gate 结果让代理停止提交本任务。

### 重复、重启、恢复与兼容

- 相同 requestId 幂等；重复取消不新建 job，不重复副作用。旧取消请求不能在显式恢复的新 revision 上重新生效。
- 宿主撤回后断电、A 收到请求而 B 丢回执、B 持久化后 A 未收到：均保持请求中并按同 ID 对账/补发；未知不能当已停止，也不能重新调度。
- 重启只加载停止意图和事实；A worker 自恢复亦受停止记录约束。用户显式恢复需要新 operation key 和 expectedRevision；旧 completed resume 回执只返回原结果，不清后来取消。
- 已运行的老版本 worker 无边界检查，不能接受新式已停止保证。升级/兼容验证必须识别能力和旧进程：不能确认时显示“仅已撤回宿主投递，后台可能继续”，等待旧 worker 结束再确认。缺少记录的旧任务默认正常；旧 cancelRequested=true 仅证明历史宿主请求，应迁移为待核实停止意图，不能迁成 A 已停止。

### 为何暂不做立即强制终止

强杀需额外处理 provider 请求中止、PID 创建身份、子进程树、原子提交窗口、staging 回收与重复外部计费；也不能回滚已经发布的资产。安全边界停止能满足防止继续自动推进的稳定性目标。未来若确需立即终止，应单独定义超时、降级、部分提交和恢复合同，本次不扩展。

## 建议后继单目标实施卡（未创建/未实施）

目标：实现“持久停止后续推进，显式恢复同一 parent”的 A 权威控制合同与 B 调用守卫；先由总控冻结接口后串行安排，与 004B 合并后的基线验证。

范围：A stop/read/resume 控制、launch/advance/derived 边界；B intent/宿主撤回/类别推进守卫及状态文案。不得顺带更换 generation 修复、重构全部 pipeline、增加强杀或新产品功能。

必须验收：未投递、两个 inbox 队列、独占/混合 turn、claim 窗口、独立 worker 正在 parse/已提交 batch/Reader 发布前后、衍生 child 已启；重复 cancel/resume、stop 与 start/resume 并发、过期请求、所有跨域回执丢失点、两次重启、旧记录和旧 worker。资产 SHA/mtime/库指针保持；取消确认后不再启动下一阶段；确认前合法提交如实保留。使用真实固定制品宿主+A 独立合成实例，注入 provider 仅替代外部服务，不能以 mock 或 kill 代替取消。

验收失败负例：宿主不可用导致 intent 丢失；共享 turn 继续目标 sr_continue_full_read；旧 resume 键解锁新取消；ack 后仍启动阶段；恢复时换 job/generation；把 completed 改 canceled；删除已确认资产；其他论文队列/turn 被误取消。此卡诊断交付不等于这些能力已存在，也不解除 004/005 门槛。
