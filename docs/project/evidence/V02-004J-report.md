# V02-004J 交付：持久取消与显式恢复

状态 **review，source-only 验收交回**。取消意图、稳定 stop ID、真实 read-control revision 在副作用前持久化；A 停止与宿主撤回分别尝试并记录 requested／真实回执／unknown。重开可补发同一 stop，不自动 resume。只有可信 HTTP 的 `resumeStopped: true`＋安全整数 `expectedRevision`＋原幂等键/输入，且 A 当前 revision 和 dispatched 证明接受，才清对应停止代；旧键不清后来取消。普通 retryKey/resume/attach、同论文换键及分类推进工具均不能绕过停止。终态、Reader 事实及独立 child 未停止事实保留。

**身份与接口。** B base `36c27fb8b281faf4496ae6fade265e5f2d866555`；生产固定 `6d1bfd769a104413d3f416d130c1f19b19da5071`；模块/真实引擎验收 commit `294741d26938652853f54493b5fb139bf54fab4a`；原生验收 `43bca47fead32d9c48aeb00b4c9832f9d434e7a8`（后者仅修合成夹具，src/tests 字节未变）。A 固定 `b4a9ecc00a76b85c244a0167c79b5a3539e97415`，I 的 4 个 JS/TS 来源摘要、52 个私有 Python 源文件及运行时版本均核对。workflow/bridge 为 0.1.2；schema 1 增加可选控制记录，老 cancelRequested 仅是待核实意图。A 协议、产品版本/pins、依赖、工具白名单、Host/Origin 和用户安装未改。

**实际验证。** 完整命令、退出码、绝对路径、SHA256、来源与边界见 [证据索引](V02-004J-index.json)；原始日志在本卡 `outputs/v02-004j`，仅本机可用，验收/归档结束前保留。

| 验证 | 最终结果 |
| --- | --- |
| `node scripts/modules.mjs check` / `impact --base 36c27fb8...` | exit 0；无未登记路径 |
| `node scripts/modules.mjs test workflow` | exit 0；99 pass / 1 Windows 上的 POSIX skip；已包含 bridge 与直接/传递调用方，重叠不相加 |
| `node scripts/v02-004j-integration.mjs` | exit 0；真实 Handoff→I adapter→A JS/Python/worker，stop revision 1→两次独立重开（PID 12080/28196）→显式 resume revision 2→同 parent `job_febbbb791648d0fe` 到 PDF gate；新 stop revision 3 不被旧恢复键清除 |
| `node scripts/v02-004j-native.mjs` | exit 0；DSH rc.7 真实 HTTP 恢复、只撤目标队列、独占 turn abort、混合 turn 不误杀、重开无自动重投；两个自有宿主均已关闭 |

故障注入覆盖保存失败、A/宿主单方失败、stop/resume/宿主回执丢失、原 ID/输入重试、revision 冲突、未知调度、旧记录/缺能力、旧键遇新 stop、范围与其他论文、终态/Reader。历史 E 中“普通 retry/attach 解停”的期望按新合同改为拒绝；范围与资产断言保留。同论文别名的阻止、宿主回执保存失败后的 requested 记录属于卡内必要修复。初轮探针 Reader 路径/合成状态跳转错误已修；初轮进程超时与最终通过日志均保留，生命周期生产代码未改。此后仅夹具/证据调整，没有重跑无变化 Python 全集。

**从现有场景复现。** 在本卡工作树运行上述 integration 脚本，会创建独占合成实例并自动执行停止→两进程重开→同 parent 明确恢复。原生脚本还验证既有 `/__workbench/api` 路径。核心操作如下（taskId/instanceId 取本次输出；PDF gate 的真实合法输入为 `{}`）：

```text
cancel {taskId}                         → 读回 control.revision = 1
以同 root 重开 Handoff；task {taskId}   → acknowledged，cancelRequested = true
resume {taskId, idempotencyKey:"explicit", resumeStopped:true,
        expectedRevision:1, input:{}}   → 同 parent，revision = 2，pdf_required
回执丢失时：重用同一 key、expectedRevision:1 和 input:{}，不换键/输入。
```

**边界与恢复。** 合成元数据、源代码组合、本地合成 LLM；原生 dispatch gate 由明确标注的测试夹具注入，实际 Handoff/adapter/控制/worker/DSH 未 mock。真实链尚无 PDF，source SHA 保持 null、尚无生成产物，不能声称有 PDF generation/Reader 内容质量验收。最终含 A/B 的打包安装与恢复组合、真实模型/内容质量仍是发布门槛；未接触真实库、未发布、未合总控/main。回退需配套撤回 workflow/bridge，保留控制记录、输入和资产；不能用旧普通推进语义解除停止。无已知未解决的本卡源码阻断，最终安装门槛仍开放。
