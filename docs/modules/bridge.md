# Bridge：DSH 与引擎适配

入口为 [`index.mjs`](../../src/modules/bridge/index.mjs)，版本见 [`catalog.json`](../../src/modules/catalog.json)，变更记在 [bridge 记录](changes/bridge.md)。本模块把 DSH 工具、HTTP 请求、引擎接口与 `workflow` 连接起来。

## 接口与数据

- `apply(ctx, { root, engineConfig })`：注册 `codex-scientific-reading-bridge`，注入 tools/webServer/systemPrompt/agents；创建 Handoff、工具守卫和 `/__workbench/api` 路由。
- `engineAdapter(api, config)` → `(args, input, scope)`：把命令映射到固定引擎 API，保留可信 scope 并归一化错误。
- `dshRpc(url, method, payload, rpcId?)`：检查响应 envelope、关联 id 和业务成功，HTTP 200 本身不算成功。
- `verifyReader(engine, url, paperId, scope)`：检查 Reader 资产声明与实际 HTML 摘要；`readJobInput(root, engine, scope, args)` 仅读取当前 job/gate 允许的材料并分页。
- `categoryGuard(service, exec)`、`CATEGORY_TOOLS`：分类工具边界；`inspectDispatchEvidence(agent, rpcId)`、`cancelOwnedDispatch(agent, task, claimed)`：核对和取消归属明确的投递。

本模块不另建持久数据库；实例和安装描述由其他模块维护，任务由 workflow 保存，文献/作业/资产由引擎保存，会话属于 DSH。运行中的 claimed 映射只用于当次执行证据。

## 依赖与阅读范围

静态上游为 `foundation`、`workflow`；运行时依赖固定 `engine`，与 `oauth` 在同一宿主模型流程中组合。宿主由 `lifecycle`/`application` 装配，跨包加载由登记中的动态导入例外限定。

协议或守卫问题先读 `services.mjs` 和测试；路由/插件注册问题再读 `plugin.mjs`。只有输入输出合同变化才读 workflow 或引擎合同，无需默认读取 OAuth 传输实现。

## 验证边界

`npm run modules -- test bridge` 覆盖目标及下游；本模块登记 `tests/bridge.test.mjs`。命令说明不代表当前已经通过。

修改工具清单、scope 传播、Host/Origin、文件读取、投递或取消时，覆盖拒绝与异常路径。修改引擎导出、DSH hooks、包解析或安装插件路径时，还需隔离宿主启动与真实交接验证；静态边界检查不能证明运行时 API 存在。

## 0.1.1 停止控制适配（V02-004I）

可信调用方可传 `full-read-pipeline-stop/control`，显式恢复须带 `--resume-stopped --request-id <id> --expected-revision <n>`，input 仍由独立参数传入。显式恢复只调用 A 的 `engineResumeStoppedFullRead`；缺失导出抛 `engine_stop_control_unavailable`，不回落普通 resume。旧 start/continue/attach 调用路径不变。

`reading-control-v1` 按原快照返回，验证 parent、嵌套身份、revision、阶段及控制记录；仅停止中的普通 resume/attach 可接受 exit 2 gate。`requested` 不等于 `acknowledged`，业务 failed/completed 不转换为 canceled，独立 child 不停止。非法控制快照为 `engine_stop_control_invalid`；revision/request 冲突、dispatch uncertain 与 scope 错误保留安全代码。错误 envelope 不作为业务成功。

分类工具白名单和 workflow 语义未变；此接口仅供后继取消接入，本卡不是安装或用户取消链验收。新增回归登记 `tests/v02-control-adapter.test.mjs`，真实来源集成脚本 `scripts/v02-004i-integration.mjs`。

## 0.1.2 Handoff 控制守卫（V02-004J）

可信 HTTP resume 原有路径把 `resumeStopped: true`、安全整数 `expectedRevision`、input 与幂等键传给 Handoff。分类工具清单未扩大；`sr_start_full_read`/`sr_continue_full_read` 在实际 session 范围内通过 Handoff 串行守卫后执行，避免尚未送达 A 的本地取消被推进工具绕过。A 的最终控制守卫继续生效。其他论文和读取不被全局冻结；没有强杀 worker/provider。

控制事实及恢复语义见 [workflow](workflow.md)，当前验证与最终安装限制见 [J 报告](../project/evidence/V02-004J-report.md)。
