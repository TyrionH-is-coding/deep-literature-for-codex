# V02-004J 第 1 轮返工交付

状态 **review，待总控复核**。前次 `da1d08a2e7f8b57065fd6f2218e673480e1ce9b3` 的跨别名阻断已修复；总控原始复现与前次证据完整保留在 [索引](V02-004J-index.json)，不将前次通过项冒充本轮结果。

**用户可见结果。** 同一绑定 session/folder/paper/parent 的多条 Handoff 记录，现在可一次明确恢复到一致状态。恢复前对账所有别名意图，并持久化 `coveredStops`（taskId、停止 requestId、A revision）；只有当前权威 resume、相同输入、dispatched 和覆盖清单共同证明时，才清仍匹配的停止代。后来或未确认的取消不被旧回执清除，未知停止阻止 A resume。当前 control/job 事实同步限于同一实际目标，不影响其他 paper、parent 或 scope。停止中新增或旧 schema 的无 parent 别名，经范围、唯一候选和真实 job 身份验证后绑定现有 parent，不另起任务。

**固定身份。** B base `36c27fb8b281faf4496ae6fade265e5f2d866555`；本轮生产及验收源码 `bc05b9b22e3030ef1801a258a9897be8ac95cbc9`。A 仍为 `b4a9ecc00a76b85c244a0167c79b5a3539e97415`，只读验证 I 的 JS/TS 摘要、52 个私有 Python 文件与版本。schema 1 新增可选恢复覆盖清单，workflow/bridge 保持本卡未发布的 0.1.2；A 协议、产品版本/pins、依赖、分类白名单、Host/Origin 与用户安装未改。

| 实际验证 | 本轮结果 |
| --- | --- |
| `node scripts/modules.mjs check` / `impact --base da1d08a...` | exit 0，无未登记路径 |
| `node scripts/modules.mjs test workflow` | exit 0，105 pass / 1 Windows POSIX skip；包含 bridge 和直接/传递调用方 |
| 定向控制测试 | 19 pass；新增 6 项覆盖双别名、无 parent 旧记录、未知/后来取消、丢回执、作用域隔离、旧格式可恢复性；已包含于模块结果，不相加 |
| `node scripts/v02-004j-integration.mjs` | exit 0，真实 Handoff→I adapter→A JS/Python/worker；双别名 stop 1/2→resume 3，双方清除；后来 stop 4 不被旧键清除；新增别名绑定同 parent，stop 5→resume 6 后三个别名一致可推进 |

真实目标为 `job_e07a1d69177ec5eb`。恢复后两个独立 Node 进程（31240、30628）均读回三个别名 `cancelRequested=false`、revision 6、`waiting_user`，守卫 allowed；另一篇论文 `job_bf84ccc02eee8d80` 保持 revision 0。固定源码之后的完整命令、退出码、绝对路径、SHA256 与来源见索引；详细日志在本卡 `outputs/v02-004j`，仅本机可用，复核/归档完成前保留。

**复现样例。** 在本卡工作树运行 integration 脚本会创建独占合成实例，自动执行上述场景。核心调用是：同 scope/paper 用两个幂等键 submit → 分别 cancel → 读回 control.revision → `operate(T2, "recover", "resume", {resumeStopped:true, expectedRevision:2, input:{}})`；两条记录都返回同 parent 的合法 PDF gate。回执丢失仍用原 key、revision 和 input。停止后新 key 的提交返回同 parent；取消该别名后按最新 revision 明确恢复。旧交付记录若缺少覆盖清单，不能追认跨别名的本地停止代；本轮另测了安全修复步骤：重新 cancel 建立新停止代，再按最新 revision 明确恢复，不能直接清空标记。

**复用与限制。** 按总控要求复用 `43bca47...` 的 DSH rc.7 原生撤回、独占/混合 turn、重开无重投证据；bridge 守卫、宿主 helper、pins/lock 摘要未变，未重复该链或 Python 全集。新跨别名链使用合成元数据和宿主 RPC，实际 Handoff/adapter/A 控制/worker 未 mock；PDF 尚未提供，source SHA 为 null、没有生成产物，不能声称内容质量验收。最终 A/B 打包安装与恢复组合仍是发布门槛。回退必须保留控制/覆盖记录和资产，不通过降级恢复旧普通推进或跨别名缺陷。未合总控/main、未发布、未升级用户实例、未派生新任务。
