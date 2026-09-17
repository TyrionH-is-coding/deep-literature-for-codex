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

`npm run modules -- test workflow` 覆盖模块与下游；本模块登记 `tests/handoff.test.mjs`。当前执行结果应独立记录。

修改幂等键、持久格式、投递/重试、分类范围或取消语义时，检查重启、重复请求、未知操作结果和范围变化；再验证真实 DSH/引擎交接。修改 Reader 完成判定还要验证实际资产及 HTTP 摘要，不能仅依赖任务状态字符串。
