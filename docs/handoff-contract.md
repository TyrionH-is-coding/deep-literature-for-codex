# 分类主管与机器交接实现合同

日期：2026-09-06。适用 PB-05、PB-06、PB-07、PB-11。本文件说明原生接口与 A 作用域链。已安装 B 的真实会话、工具调用、子会话范围与重启续接已有验收；真实账号 OAuth 与论文内容质量须分别验收，以发行包旁的验收记录为准。

**目标：** Codex 总管向本实例的分类主管交接一篇论文，重复请求复用持久任务，重启后从真实资产恢复；论文移动后旧主管不能发布或覆盖正式资产。

**架构：** A 的 `library.sqlite` 与现有后台作业目录保留为文献事实源。B 只保存实例、分类会话及交接映射，使用官方 DSH 会话协议；分类权限从真实调用会话解析，经过 A 的工具、CLI、worker 到最终发布入口。

**技术：** DSH/host packages 0.1.0-rc.7；Cordis 4.0.1；Node AsyncLocalStorage；Python ContextVar；现有 DataGuard 与 SQLite 事务。

## 已核实的结论

1. 官方 rc.7 已有会话创建、恢复、消息、历史、取消 API，不需维护 DSH 核心分支。
2. `session.create` 可预分配 ID；同 ID、workspaceId、preset 复用。必须先 `workspace.create({path})` 再 `session.create({sessionId,workspaceId,agentPreset})`，不能只传 `cwd`。`session.prompt` 的 `rpcId` 只作关联并存入消息来源，**不是投递幂等键**，再次发送会再次排队。
3. A 原有 `folder` 参数只是可选筛选；本轮已加入可信上下文、持久作业范围及最终发布校验。只加提示词、UI 筛选或一次 pre-execute 检查不能通过 PB-07。
4. DSH `tools.guard()` 是单调拒绝入口；`tools.restrict()` 不会过滤同层本地注册。B 必须同时设置执行白名单，并让 A 实际服务强制范围。
5. PDF/Reader 文件替换早于部分 SQLite 发布操作，单独在 `publish_reader()` 或 `commit_pdf_publication()` 加检查太晚。检查与文件替换共同持有根目录的短时 `scope-publication` 文件锁；分类移动/撤销也持同一锁。耗时解析不持该锁。

## 官方 DSH 的实际传输

已核对 B 自有安装的 `releases/<SHA前16位>/runtime/npm/node_modules` 中 `dsh-client-connection`、`dsh-host-apiproxy`、`dsh-api-gateway`、`dsh-agent-presets`、`dsh-tools`、`dsh-agent` 等官方 rc.7 依赖。用户 `~/.dsh` 的修改版不作为接口依据。

普通 unary API：

```http
POST /api/session.create
Content-Type: application/json

{"type":"client-request","rpcId":"request-uuid","method":"session.create","payload":{"sessionId":"session-csr-stable-uuid","workspaceId":"<workspace.create 返回的 id>","agentPreset":"scientific-reading"}}
```

响应为 `{"type":"server-response","rpcId":"...","result":{"ok":true,"value":{...}}}`。必须核对 `rpcId`、`result.ok`，HTTP 200 本身不代表业务成功。重启后对同 ID 调用 create 会恢复持久会话；应固定 `workspaceId` 与 `agentPreset`，不要按名称重新寻找。

| 方法 | payload | 业务返回/边界 |
| --- | --- | --- |
| `workspace.create` | `path` | `{workspace,created}`；同规范路径幂等 |
| `session.create` | `sessionId,workspaceId,agentPreset` | `{sessionId,agentPreset}`；不可同时传 cwd；同 ID 不同 workspace/preset 冲突 |
| `session.list` | `{}` | `{items:[{sessionId,running,agentPreset,parentSessionId,...}]}`；cold running=false 不代表作业停止 |
| `session.history` | `sessionId,maxMessages,beforeSeq?` | 事件与投影；读取本身不恢复 Agent |
| `session.prompt` | `sessionId,mode:"queue",content:[{type:"text",text}],clientTimeZone:"Asia/Shanghai"` | `{accepted:true}` 仅表示接收 |
| `session.cancel` | `sessionId` | 仅取消该会话 turn；不会取消 A 已脱离的 worker，且保留排队 inbox |
| `session.rename` | `sessionId,title` | 改名不改变 ID |
| `subagent.prompt/history/interrupt` | 原生 SubagentsApi 的 parent/child 地址 | Review 为受管理子会话，不能直接用 session.prompt |

`/api` 有 Host/Origin 信任检查：回环 Host、同源 Origin；CLI 可无 Origin。A `/sr/api/reviews/open` 另要求 `Origin` 与 `X-SR-CSRF: 1`。机器客户端只使用 PB-03 已验证的实例 URL，先 GET `/__workbench/identity` 核对 `instanceId/launchId/pid`。

Gateway `ctx.typertGateway.invoke({namespace,method,args,signal})` 和 `ctx.connection.rpc.handle/intercept` 可扩展通道；首版无需重写或猜测 Gateway reflection，B 自有 HTTP 路由更少代码。

## A 可直接复用的接口

| 功能 | HTTP | 引擎 CLI |
| --- | --- | --- |
| 入库 | `POST /sr/api/library` `{metadata:{title,doi,pmid,...}}` | `library-ingest --input -` |
| 分类列表/新建/重命名 | `GET/POST /sr/api/folders`；POST `{action:"create",name}` 或 `{action:"rename",folder_id,name}` | `folder-list/create/rename` |
| 分页文献 | `GET /sr/api/library?folder_id=...&page=1&page_size=50` | `library-list-v2 --folder-id ...` |
| 论文与活动任务 | `GET /sr/api/paper/<paper_id>` | `library-item-v2 --paper-id ...` |
| 批量移动 | `POST /sr/api/batch` `{action:"move_folder",paper_ids,payload:{folder_id}}` | `batch-submit --input -` |
| 启动/复用精读 | `POST /sr/api/paper/<paper_id>/full-read` `{}` | `full-read-pipeline-start --paper-id ...` |
| 查询/续接 | `GET /sr/api/job/<job_id>`；`POST .../<job_id>/continue`，body 为当前 gate 的 input | `job-status`；`full-read-pipeline-resume --job-id ... --input -` |
| PDF 路径导入 | `POST /sr/api/paper/<paper_id>/attach-pdf` `{job_id,pdf:<绝对路径>}` | `full-read-pdf-attach-resume --paper-id ... --job-id ... --pdf ...` |
| PDF 上传 | `POST /sr/api/paper/<paper_id>/attach` `{job_id,pdf_b64}` | 与路径导入共用 attach-resume |
| 独立 PDF 导入 | 暂无对应通用 HTTP 合同 | `pdf-attach-library --paper-id ... --pdf ...` |
| 已发布资产 | GET `.../pdf`、`.../reader`、`.../exports` | `artifact-resolve --paper-id ... --kind pdf/reader/exports` |
| 单篇 Review | `POST /sr/api/reviews/open` `{parent_session_id,paper_id}` | `review-session-get/bind`、`review-context`、`review-confirm` |

CLI 通过专用 Python 的参数数组执行，JSON 用 UTF-8 stdin；不能拼接 shell 命令。退出 0/2/3 分别可能是正常、用户 gate、Agent gate；必须读取 JSON，不把 gate 当崩溃。A 主入口已公开导出 `withEngineScope`、`engineJson`、`engineStartFullRead`、`engineContinueFullRead`、`engineAttachAndResumeFullReadPdf` 和 `Config`，B 通过包主入口调用并保留 A 的专用 Python 与 OA provider 环境。

PDF attach 必须匹配同一 `paper_id/job_id` 且当前为 `waiting_user/pdf_required`。现有 attach 请求不是通用幂等请求：成功后 gate 变了，再次 attach 会得到 409。B 对重复交接应先读回 SHA 与任务，再返回此前结果。来源 provenance（`oa/codex_authorized/manual`、SHA、文件名）由统一导入合同保存，禁止记录 Cookie、令牌和浏览器 Profile。

## B 最小机器交接数据

对外保持 `instanceId` 风格，与 PB-03 对齐；传入 A 的可信作用域使用 `scopeFolderId/scopeSessionId/scopePaperId`。论文 ID 完全采用 A 返回值，不从 DOI 再生成。

```json
{
  "instanceId": "本实例 UUID",
  "idempotencyKey": "调用者为这次动作保留的唯一键",
  "folderId": "folder_...",
  "paperId": "A 的稳定 paper_id",
  "action": "full_read",
  "taskId": "B 首次接收时生成并持久保存的任务 ID"
}
```

相同幂等键、相同规范化请求返回原 task；相同键不同请求返回冲突。动作请求先持久保存，再调用 A。`taskId/sessionId/rpcId` 不进入 A 内容作业哈希，避免换 Codex 对话创建重复解析。

首版交接状态：`accepted`、`dispatched`、`waiting_agent`、`waiting_user`、`completed`、`failed`、`cancel_requested`。状态读取合并 A job JSON 与已发布资产；只有 parent job completed 且 `artifact-resolve reader` 和 Reader GET 的实际校验通过才可称“精读完成”。聊天出现 done 不参与判断。取消在无法证实 worker 停止时只能是 `cancel_requested`。

取消会先恢复尚未加载的持久会话，撤回本任务 rpcId 的 next-turn/next-step 消息。是否中断当前 turn，依据该 turn 已落盘的用户消息及原生 `agent/inbox/claimed` 领取记录；领取到其他任务或手动消息时不取消整个共享 turn。恢复 inbox 本身不会发送提示或启动模型，删除会持久保存。

DSH 正常关闭会撤销排队 inbox；崩溃退出则可保留已落盘的队列。这两种恢复分别验收。相同 gate 的 `dispatch` 必须重新检查原生 inbox、user/message 和 splice 取消记录，得到 pending/delivered/canceled/uncertain；只凭 B 旧 accepted 回执不能声称仍在排队。canceled 和 uncertain 均保存且不自动重投，明确继续时才使用新的稳定 retryKey。领取后尚未落入 user/message 的窗口不能误判为 canceled。

B 的持久映射可放 `state/handoff.json`，由宿主桥单写者串行更新、临时文件原子替换；这里不保存题录、PDF 或生成事实。已有 `library_meta` 可记录 A 的论文 membership revision、分类撤销状态及作业 scope；不另开数据库。跨 Codex 对话重新读取同一实例映射。恢复遇到“已接受但发送回执丢失”时先用 A job/asset 与 DSH durable user message 的 rpcId 调和；不要盲目再投递 prompt。

## 必须落地的可信参数链

1. B `bridge.mjs` 从 `exec.agent.session.id` 查持久 folder/session 绑定；Review 子会话通过真实父 lineage 继承，不能从模型 arguments 读取 folder/session。
   传给 A 的 `scopeSessionId` 固定为分类主管的根会话 ID；实际子会话 ID 只用于 B 可信谱系核验。Review 可再加 `scopePaperId`；后台保存时统一补全该 paper 的 `scopePaperRevision`，根会话和其子会话续接同一作业才能保持一致。
2. 全局 `ctx.tools.guard()` 对受限会话拒绝非白名单；shell、pwsh、bash、fs/editor、通用 HTTP/web、Cordis/配置写入、任意 spawn、全库备份恢复/归类不得暴露。未知 bound child 或已撤销绑定默认拒绝。
3. B `tools/execute` wrapper 用 A 新导出的 `withEngineScope(scope, next)` 包住原工具；`tools/pre-execute` 不能改写参数，单靠 guard 也不能包住异步执行。
4. A `src/engine_scope.ts` 用 AsyncLocalStorage；`src/cli.ts` 的 `runEngine/engineStartDetached` 最后写入可信 `SR_SCOPE_CONTEXT` 子进程 env。每次 spawn 捕获上下文，不修改全局 `process.env`；清除继承来的未知同名值。
5. Python `scope.py` 用 ContextVar；CLI/worker 入口载入。后台 job 首次建立时在已有 claim 下保存 `JobStatus.scope`；worker 从持久 scope 恢复，不能靠宿主重启后的 env。resume 输入不得覆盖 scope。
6. `BackgroundRequest.identity_dict()` / `stable_job_id()` 仍只表示原内容作业身份；不同 Codex task 不改变已有 job ID。已有 in-flight job 的 scope 不匹配必须报 `scope_conflict`，禁止静默重绑。
7. 每次查询强制当前 folder；paper/job/review 身份先经 A 状态反查。最终写回使用同一短时根目录发布锁，在 SQLite `BEGIN IMMEDIATE` 内复核实际 `items.folder_id` 及 membership revision；失败保留旧资产并记录 scope_changed，不再推进派生。

分类归档由无 scope 的 Codex 总管调用 `engineJson(config, ['scope-folder-state', '--folder-id', folderId, '--archived', 'true'])`，撤销使用 `'false'`。命令在 A 内更新 `library_meta`；不需要 B 写 SQLite。状态确实改变时递增该分类全部论文的 membership revision，归档再撤销也不能复活原 worker 权限；重复设置相同状态是幂等操作。数据库 `TARGET_VERSION` 保持 4。

## A 精确改动位置

| 文件/方法 | 最小职责 |
| --- | --- |
| `src/engine_scope.ts`（新增）、`src/index.ts` | 可信 ALS 上下文与公开导出，不把 scope 暴露给模型参数 |
| `src/cli.ts::runEngine/engineStartDetached` | 一次 spawn 的可信 scope env 快照 |
| `scope.py`（新增）、`__main__.py` | 参数验证、ContextVar、CLI 安装、受限全局命令拒绝 |
| `background_models.py::JobStatus`、`background_store.py` | scope 持久化与不可静默重绑；保留原 job identity |
| `worker.py::_run_job`、`full_read_pipeline_handler_factory` | 恢复 scope，拒绝旧分类，继承到派生任务；失败同步也不能越界写条目 |
| `library_service.py::ingest/_ingest_in_transaction/list_items/get_item` | scoped 新建原子分配到 folder；已有他类去重项拒绝更新；读范围强制 |
| `library_service.py::move_items`、`classification_service.py::apply/undo/apply_direct/undo_direct` | 移动和撤销在同根目录发布锁内更新分类；SQL trigger 增加 membership revision，主管禁止跨类操作 |
| `pdf_acquisition.py::_publish/_ensure_locked` | 替换 `source.pdf`、stale manifest、DB 提交之前持发布锁并检查；仅 DB 函数检查不足 |
| `full_read_renderer.py::_render_completed` | 在两处 HTML/manifest replace 前做最终范围检查；与 move 共用锁 |
| `full_read_service.py::finalize` | staged 文件正式发布前校验，失败不替换旧全文输出 |
| `library_service.py::commit_pdf_publication/publish_reader/update_*` | 事务内复查 scope；拒绝后不刷新正式索引或当前活动任务 |
| `reading_pipeline.py::start/advance/_sync_library` | 复用现有作业、开始阶段前校验、失败 scope 不写回新分类；派生作业继承 scope |
| `review_service.py::get_binding/open_state/bind_session/context_for_session/confirm_conclusions/resolve_conclusion` | 从真实 Review 绑定反查 paper；根主管 ID、当前分类均校验，最终结论事务再次核验 |
| `export_service.py::export` | 从论文 workspace 反查范围，资产包发布共用短时锁 |

DataGuard 的根锁仍负责备份冻结；新增短时根目录发布锁复用其 OS 文件锁机制，不在耗时解析期间持锁。现有库是单重活 worker，根目录短时发布锁避免多论文锁排序和新的锁事实源。必须覆盖“移动发生于检查后、replace 前”的测试，不能只测串行移完再读。

## A 已完成的工程验证

`engine/tests/test_scope_boundary.py` 使用独立临时库，覆盖跨分类读取/去重覆盖拒绝、原子入库归类、内容 job ID 不变、scope 持久恢复、移动后及移出再移回的旧 worker 拒绝、PDF staging 后移动、真实 formula-outline Reader staging 后移动、归档及幂等撤销、Review 根会话边界和结论发布竞态。PDF、HTML、manifest 旧文件均作字节级断言。Review 结论竞态断言没有部分写入。

最终针对 scope 与 Review 的回归为 28 passed；全 Python 回归为 378 passed、1 skipped（57.46 秒）；TypeScript typecheck 通过。B 的受限主管仍必须禁用全局 shell、文件编辑器、TS 下载批次及任意本地路径导入等工具；A 的可信 scope 环境只能由宿主注入，不能给受限模型修改执行环境的能力。

## B 文件责任与验收

- `src/handoff.mjs`：机器客户端函数、持久绑定/幂等交接、任务读回；不运行 shell、不直接写 SQLite。
- `src/bridge.mjs`：Cordis 插件、身份绑定、HTTP 交接端点、工具执行 guard/wrapper；固定 root 来自启动配置。
- `tests/handoff*.test.mjs`：重复/冲突/重启恢复、假 done/资产缺失、未绑定与子会话拒绝。
- A 新 scope 回归：移出后查询/续接/Review 拒绝；移动竞态下旧 PDF/HTML hash 不变；同论文多次交接仍一个内容 job；重启 worker 载入持久 scope；缺 scope 的 A 独立原流程保持通过。

仅 B 实现一次 HTTP membership 检查可以演示主管调度，但无法满足最终发布和重启 worker 的严格边界，因此不作为 PB-07 的发布替代方案。正式候选必须固定含 scope 修复的 A 包 SHA，并在安装后的 B 运行环境重复上述验收。
