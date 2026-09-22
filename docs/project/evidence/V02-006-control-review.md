# V02-006 总控验收

2026-09-22：**固定 dev.5 安装组合的三域备份、新根恢复和禁止误重放通过，F2 在本卡限定范围关闭。** A 交付/制品源码 `8b195c9109efd92ba74c37bb244b2c6b155060de`，合入 `d55d4e91893945c94b6f61c7fcc138a932933b8d`；B 制品源码 `058afb0fe8ebd5e39a4f9ca7e495011e4cde61ca`，最终交付 `974a75097401737b066a1bb3afa3560587564362`，合入 `a81aa94d0dce98d1e97b660e899c36a2300def3d`。两次合入串行、无冲突，集成生产树与验收源码无差异；模块检查通过（10 模块、50 源文件、178 imports）。未合 main、打 tag、发布或升级用户安装。

[交付说明](V02-006-delivery.md)、[演示](V02-006-demo.md)、[原始证据索引](V02-006-evidence-index.json)、[总控验证索引](V02-006-control-verification.json)。ZIP SHA256 `cb0d5a01b3cad6c6292aa10a7eaf1b9af76c244a069e856322fc7561d6c35044`；三域 manifest SHA256 `2132f289901786fa6e87a03c0a91b34f16a219d62458478e7767b5db19589e1a`。大证据只在本机 `C:/tmp/v006/`，候选旁 review 归档及原始记录保留，后续复核结束前不得删除。

## 独立核对

- **来源与安装**：总控重算 198 次文件大小/SHA 核对（7 制品、46 份证据的原件/适用归档、104 日志）及 ZIP 内 628 项清单；5 个 r4 安装的 B 44 份源码、A 包 54 文件、Python 53 文件与制品一致。Python 与 Git 源比较仅归一 CRLF/LF，安装与 wheel 逐字节核对。所有 r4 安装 appSha 为 `bc4479d1e5a402f1a4f0d9d95e80142de65e0de25fec14a4a52366ef5fa92ee7`。
- **三域与资产**：installed_control_acceptance 独立逐帧读取原生压缩事件，源 4 个 session 的 71 条原事件与备份逐项同序，两个恢复根保留此前缀；3 组 task/parent/paper/session/folder 关系一致，仅 instance scope 受控重绑定。26 份科研文件字节不变，完成作业的 job.json 仅 3 个允许路径字段改根，其余 JSON 相同；Reader、PDF、Excel 三个人工字段与只读 SQLite 核对通过。
- **R1 关闭**：control_plan_review 确认真实 worker 在持久派生许可后、创建 child 前被定点中断；随后真实 stop 到 revision5、新确认到 revision6，原 parent 和唯一确定 child 完成。旧代许可保留审计，旧请求返回 `replayed_superseded`。中文根两次 required_input 经真实 worker 完成；确认后另一个未授权 parent 的 launch/enqueue/worker 四入口均拒绝，popen=0，jobs/launch markers 不变。
- **R2 关闭**：startup_readiness_review 核对 3 份门禁记录各两次实际启动/停止；原生 send/wake/maintenance/claim/splice/model/tool 均拒绝，模型/工具为 0/0，源阳性为 2/1。pending next-turn/next-step 保持，6 次宿主退出 code0、forced=false，无 agent 销毁异常；确认后无关队列仍被抑制。
- **失败路径与回归**：27 项失败分支、preparing 阶段实际进程中断、library 完成后真实 DSH EEXIST 保留失败目标门禁。失败源 abort 错事务/阶段/恢复目标/活跃写者拒绝，审计中断保留门禁与 partial。引用固定源码 A 599 passed/3 skipped，B 123 passed/1 skipped、OAuth 33 passed；A JS 按原失败与正确 Git 上下文补验分开记录，不声称单次全集全绿。最终文档补充未改生产或制品，未重跑安装演练/全集。

## 证据边界与收尾

支持范围为同 Windows x64、同完整制品、DSH rc.7、单 workspace 及已支持状态；未知媒体/spill/preset 等明确拒绝。原生恢复后会追加已核对的中断收尾与初始化事件，不保证原生文件字节不变。27 分支的后 7 项采用受控库克隆和手写活跃 owner 哨兵，不是 7 次新安装或真实并发 worker。

“客户端未收到响应”用同请求重复调用验证，持久回执全部保留；未删除回执或注入网络丢响应。preparing 中断没有独立的源/邻居全量指纹；DSH 导入故障指纹覆盖库与 handoff，不能声称每种故障都做三域全量字节快照。最终源历史/资产/关系另有只读核对。失败备份 abort 在清门禁前重新冻结核验，冻结并非一直持有到 unlink；持久门禁在核验后仍拦截正常执行。

首版一次生产返工复核关闭 R1/R2；最终一次证据措辞补充纠正覆盖范围，未扩展产品目标。2026-09-22T01:45:30.8185221Z 总控确认任务归属 Node/Python 进程为 0；profile 为原始 `[]\n`，故障钩子已移除。代码回滚不能替代数据回退：失败目标保留隔离，重试用新根，不覆盖成功实例。真实解析、模型与科学质量交给 [007](../tasks/V02-007.md)，不能以此次合成输入验收替代。
