# Workflow：分类任务与持久交接

入口为 [`index.mjs`](../../src/modules/workflow/index.mjs)，版本见 [`catalog.json`](../../src/modules/catalog.json)，变更记在 [workflow 记录](changes/workflow.md)。负责分类会话绑定、任务幂等、投递证据、续接和恢复，宿主及引擎访问由调用方注入。

## 接口与数据

- `Handoff.open(root, dependencies)` → 服务；依赖包含 `instance`、`engine`、`rpc`、`dispatchEvidence`、`cancelTask`、`reader`。
- `bind(folderId)`、`prepareHost()`：绑定分类会话，建立实例 workspace；`scopeFor(sessionId)`、`observeSession(sessionId, parentSessionId)` 管理实际会话范围。
- `submit({ folderId, paperId, idempotencyKey })`、`task(taskId)`、`list()`：复用或查询真实引擎作业对应的持久任务。
- `dispatch(taskId, retryKey)`：按当前 gate 和证据处理投递；`operate(taskId, idempotencyKey, kind, payload)` 处理 `resume`/`attach`。
- `cancel(taskId)`、`archive(folderId, archived)`：记录取消请求或分类归档；取消会话不等于终止引擎的独立 worker。
- `ensureInstanceWorkspace(rpc, root)`、`ensureLiteratureDefault(rpc)`：调用 DSH workspace/settings 接口，保留用户已设置的默认 preset。

拥有 `<root>/state/handoff.json`，包括分类绑定、子会话关系、任务、操作与投递记录。引擎仍拥有文献、作业和资产事实；DSH 拥有会话历史。重新读取真实状态后才能解释完成或恢复，不能把 prompt 接收回执当成论文已完成。

## 依赖与阅读范围

静态上游仅 `foundation`；引擎、RPC、阅读产物验证和取消由 `bridge` 注入，`bridge` 是直接下游。任务问题先读入口、`handoff.mjs` 及对应测试；workspace 问题只补读 `workspace.mjs`。需要改变 RPC、引擎形状或分类守卫时才扩大到 bridge 和外部合同。

## 验证边界

`npm run modules -- test workflow` 覆盖模块与下游；本模块登记 `tests/handoff.test.mjs` 和 `tests/v02-cancel-contract.test.mjs`。当前执行结果应独立记录。

修改幂等键、持久格式、投递/重试、分类范围或取消语义时，检查重启、重复请求、未知操作结果和范围变化；再验证真实 DSH/引擎交接。修改 Reader 完成判定还要验证实际资产及 HTTP 摘要，不能仅依赖任务状态字符串。

## 0.1.2 持久停止与显式恢复（V02-004J）

`cancel` 验证身份与范围后先原子保存 `cancelRequested` 和稳定 `stopOperation.requestId`；从真实 control 读取 expectedRevision，保存请求后才调用 A stop。引擎和宿主分别尝试，安全错误/未知写入 `stopOperation`、`controlError`、`hostCancellation`；`cancellation` 保留最后真实宿主回执。宿主失败仍抛错，但不阻止 A 停止。初始保存失败时两端均不调用。task/list/open 重新读取权威 control，可补发同一 stop，绝不自动恢复；requested、acknowledged、terminal 与宿主撤回分开呈现。

可信 `operate(..., 'resume', { resumeStopped: true, expectedRevision, input })` 使用幂等键派生的稳定 requestId。完整 payload 指纹、原输入和 revision 在副作用前保存。只有权威 control 中同一 resume 的最新 revision、相同输入与 dispatched 证明，才清除对应本地停止代；旧回执不清后来取消，未知调度和 gate 错误保留意图。同键重试复用原请求。PDF 等 gate 使用 A 原合同，缺输入时仍等待，不新建 parent/source/generation。

同一实际目标由绑定 session、folder、paper 和非空 parent 共同确定。显式恢复先对账该目标所有别名的持久停止，再把 `coveredStops`（taskId、stop requestId、A stop revision）保存到恢复操作；成功回执只解除清单中仍匹配的停止代。未知/后来取消不在旧清单内，仍保留保护；存在未送达 A 的意图时不调用 resume。当前控制与 job 事实同步给同目标别名，其他 parent/paper/scope 不变。停止中新增或旧 schema 的无 parent 别名，仅在范围一致、候选 parent 唯一且真实 job 身份验证通过后绑定，不能另起 parent。旧恢复记录没有覆盖清单时仍保守处理；若旧缺陷已留下跨别名本地意图，重新 cancel 建立新停止代，再按最新 revision 明确恢复可修复，不根据历史回执猜测解除。

普通 submit、dispatch/retryKey、resume、attach 不能解停；同会话同论文的另一个幂等键也不能绕过本地意图。`guardAdvance(actualSessionId, toolName, args)` 为 bridge 提供真实会话范围下的目标推进守卫；其他论文和读取不受影响。schema 1 以新增可选字段兼容读取，旧 cancelRequested 仅视为未核实意图。旧引擎无控制能力时可撤回宿主，但后台停止为 unknown。

新增测试登记 `tests/v02-workflow-control.test.mjs`；真实来源脚本 `scripts/v02-004j-integration.mjs`。结果见 [J 报告](../project/evidence/V02-004J-report.md)。模块组合仍需后续最终安装验收，不能降级后使用旧普通 retry/attach 绕过已保存的 stop。

## 0.1.1 历史取消失败语义（由 0.1.2 取代）

`cancel` 先通过已有任务身份与分类范围检查，再以现有原子 JSON 写入保存 `cancelRequested=true`，最后调用宿主撤回。保存失败不会开始宿主副作用；宿主失败向调用方抛出原错误，但文件中的意图继续抑制同键提交和默认投递。重复取消始终重新保存并重试宿主，不把旧取消回执当成本次成功，也不持久化宿主异常或 stack。写盘失败时内存中的意图仍保留，调用方必须处理失败，不能视为已持久化成功。

成功的新 resume/attach 和显式 dispatch(retryKey) 仍按现有行为清除意图；旧 completed operation 重放不清除后来的取消。真实 completed/failed 与 Reader 资产照常呈现。schema 1、公开接口和依赖均不变；不保证断电 fsync 耐久性，不代表 A worker 已停止。验证及限定见 [V02-004E](../project/evidence/V02-004E-report.md)。
