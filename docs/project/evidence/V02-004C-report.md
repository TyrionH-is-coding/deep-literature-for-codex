# V02-004C 取消职责诊断交接

状态：**review / diagnostic-with-findings**。取消设计已交付，当前产品没有 A 取消能力；004A-G1/004 阶段不能据此宣告通过。

## 身份、范围和恢复点

- B 工作树 `C:/Users/15694/Documents/ChatGPT/deep-literature-v02-004c`；分支 `codex/v02-004c-cancel-contract`；base `93bbe23c2b35da3ff5073da47fe229f32d7d367a`。开工分支/完整 HEAD 相符且 Git clean；[receipt](V02-004C-receipt.json) 保留真实任务 ID=null，无冒用总控 ID。
- 总控 context `ceea8aebc90f99e0daad9344e9a38d2cca4d7658`：任务卡、AGENTS、session-protocol、004A-control-review 均 git show 阅读。A 只读 `dcdb8e6cb23dd8329ceabd4487db0a79fae470ea`，通过 git show 读取 004A 报告/代码；未读取 004B 工作树或依赖 A 未来 HEAD。
- 只新增允许的设计、004C 证据、探针/fixture 和 `tests/v02-cancel-contract.test.mjs`。未修改生产实现、既有断言、依赖/锁/版本/schema/catalog/台账。安装依赖只写本工作树忽略目录，runtime 测试副本移除 A/OAuth 外部插件，不改产品锁。
- 本提交承载全部交付，完整最终提交 ID 随最终交接给出；回退为撤销本卡新增文件，无数据库回退。未合并 main、发布、tag、升级用户实例或创建任务。

## 核实结果

| 要求 | 新证据与结论 | 边界 |
| --- | --- | --- |
| 尚未投递 | 注入测试 cancel 后 reopen、submit(runAgent=true)、默认 dispatch 和新 gate 均不投递 | A start 已发生，runAgent=false 不禁引擎 |
| 已排队 | 原生 DSH rc.7 撤回目标消息，持久证据 canceled，保留另一个 rpcId | 真实宿主+B helper，非完整产品 HTTP/handoff/A 端到端 |
| 当前 turn 独占目标 | 原生 agent.cancel(keepInbox=true)，合成 LLM AbortSignal 确实触发 | 不是 kill；取消请求与终止确认仍应分开 |
| 当前 turn 其他/共享 | 其他 turn 只撤队列；真实 next-step 合成混合 turn 保持 running；既有注入测试覆盖 claim 时序/手动无 rpcId | 混合 turn 用公开 Inbox.append 注入，不伪造 turn/history/claim，不声称普通 queue 会合并 |
| 引擎独立运行 | 固定 A 状态、CLI、worker 循环无 cancel 协议；B cancel 不调用引擎停止 | 资产继续产生是调用链推论，本卡没有真实 A cancel 后资产 SHA 实验；注入 completed/reader 只证明 B 呈现 |
| cancel 后重启 | Handoff 文件重开仍抑制投递；原生宿主第二次 boot 创建会话后 calls=0、目标仍 canceled | 仅有界观察，不是所有崩溃时间窗或整实例恢复证明 |
| 显式恢复 | 新成功 operate 清标记；失败保留；旧完成键不清新取消；新 retryKey 发一份新 prompt | A resume gate/运行状态仍独立校验；直接类别工具缺少停止守卫 |
| 自动 dispatch | 成功持久取消抑制 B 默认投递；重启不重放撤回目标；新的显式 prompt 先执行保留的其他队列 | cancelTask 抛错时意图未持久化，恢复后仍能 dispatch |

### 关键缺口

**C1：持久化窗口。** cancelTask 完成之后才写 cancelRequested；宿主不可用时直接抛错，重开后取消意图不存在。新增测试固定当前事实，不能将此 pass 解释为缺陷已修复。

**C2：取消不覆盖 A 或共享 turn 的目标工具调用。** 类别 guard 只查 scope/工具许可，不查目标 cancelRequested；A worker 不读取 B 标记，仍有合法阶段和资产提交路径。无受支持 A cancel 入口，不能靠探针私造一条让验收通过。

**C3：恢复动作区别。** retryKey 在 refresh 前清标记；新成功 resume/attach 后清标记；旧 completed 操作仅 refresh；三者不能被一个“重试即恢复”的描述代替。任务 completed/failed 可覆盖 cancel_requested 显示，但布尔标记仍存在。

建议合同和具体后继实施卡在 [cancellation-contract](../design/cancellation-contract.md)：持久停止意图、A 权威 revision/边界确认、B 全调用链守卫、显式恢复、已提交资产保留、旧任务/旧 worker 兼容。不实现新状态机，不追加立即强杀。

## 本轮执行与原始证据

环境 Windows、Node v24.18.0、固定 DSH 0.1.0-rc.7；不是发行内 Node 22.22.2/Python 制品复验。无外部模型、凭据、用户论文，探针只使用 SYNTHETIC 文本和本地 adapter。宿主白名单环境、DSH_HOME/用户目录独立，127.0.0.1 随机端口，独立短 temp root。

cwd 均为本 B 工作树：

| 实际命令 | 结果 | 证据 |
| --- | --- | --- |
| npm run modules -- list / context workflow（首次） | exit 1，缺 acorn；npm ci --ignore-scripts 后两命令 exit 0 | 开工工具输出；未把首次失败算通过 |
| npm ci --ignore-scripts | exit 0，1 package；未改锁 | 开工工具输出 |
| node scripts/v02-004c-prepare.mjs | exit 0，task-local lock 副本固定安装 530 packages | [prepare](V02-004C-prepare.txt) |
| node --test tests/handoff.test.mjs tests/bridge.test.mjs tests/v02-cancel-contract.test.mjs | **27 pass / 0 fail / 0 skip，exit 0**；其中新增 7 条 | [targeted](V02-004C-targeted.txt)、exit.txt |
| node scripts/v02-004c-native.mjs | 最终 **4 项检查通过，exit 0**，两次真实宿主 boot | [native JSON](V02-004C-native.json)、[输出](V02-004C-native.txt)、exit.txt |
| node scripts/v02-004c-audit.mjs | exit 0，5 个冻结 A 文件来源哈希、行定位和无取消入口断言 | [audit](V02-004C-frozen-A.json)、txt、exit.txt |
| npm run modules -- test workflow | **exit 1，在执行前拒绝 unregistered_test** | [workflow](V02-004C-workflow.txt)、exit.txt |
| npm test | **79 tests：77 pass / 1 fail / 1 skip，exit 1** | [all-tests](V02-004C-all-tests.txt)、exit.txt |
| npm run modules -- impact --base 93bbe23c2b35da3ff5073da47fe229f32d7d367a | exit 0；新测试 unowned，需人工审查 | [impact](V02-004C-impact.txt) |

测试计数有重叠，不相加。全量唯一失败是实际模块图测试拒绝未登记的新测试；唯一 skip 是 Windows 上 POSIX socket 项。任务卡同时指定新增测试路径并禁止 catalog 变化，本卡如实保留失败，由总控决定登记实施/验收例外；没有移动、改名或修改旧断言绕过检查。

原生三次试跑保留 `V02-004C-native-trial1/2/3.json` 与 txt：前两次超时源于错误预期普通 next-turn 两条进入同 turn（第一次另有等待状态早于 adapter 入流的时序问题）；第三次已通过共享 turn 与重启检查，但新显式 prompt 唤醒保留队列后，脚本只释放了第一条流，等待 idle 超时。最终按真实队列语义修正合成场景/等待，生产代码未改。首次通过后清理探针文件尾空行，又对最终文件重新执行通过；先前通过记录保留在 native-prior-pass.json，计数不重复相加。试跑退出均 1；各 JSON 记录错误与宿主 cleanup，不并入最终通过计数。

## 清理、限制与交接

所有试跑与最终宿主都由探针持有的 ChildProcess 对象停止并等待 close；只用于宿主清理，不当用户取消证据。最终只读扫描 8 个登记 PID 均已不存在，见 [cleanup](V02-004C-cleanup.json)。无 A worker 进程启动；无后台服务留存。合成 temp 根和本工作树 .local 缓存保留供复查，无用户资料；注入测试临时目录在校验根后自动移除。

未验证：完整安装 B HTTP→Handoff→DSH→A 的运行取消/取消后资产；真实 A 停止与显式恢复（入口不存在）；真实模型/provider；跨 OS；断电/所有并发窗口；所有旧记录迁移与旧 worker；升级后的新制品矩阵。冻结 004A 的 crash kill 结果是旧恢复证据，不能借作本卡用户取消通过。

交付性质是事实诊断与可执行设计。总控应复核专属路径、原生/注入/静态证据分层及模块登记失败，再决定后继合同实现；不得据此解锁 005 或宣称已完成取消状态机。
