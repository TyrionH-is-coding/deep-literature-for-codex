# V02-006 交付评审

三域停机备份已接入可信 CLI，并在新完整 r4 制品实际安装的源、ASCII 新根及 `C:/tmp/v006/恢复 工作台 r4` 完成往返。恢复保留原 parent/session/task、停止代及未决投递事实，生成独立 instanceId；持久门禁早于安装启动、原生 agent 和引擎入队。当前提交供总控评审，F2 由总控裁决；未发布、打 tag 或合并 main。

**制品来源。** A source/delivery `8b195c9109efd92ba74c37bb244b2c6b155060de`；B 制品 source `058afb0fe8ebd5e39a4f9ca7e495011e4cde61ca`。B 后续交付提交只补验收脚本、receipt 和报告，精确 delivery commit 见候选旁 `review/delivery-commits.json` 与总控回执。原打包器由 clean 源码构建 npm `0.2.0-dev.5` / Python `0.2.0.dev4`；Node22.22.2、Python3.11.16、DSH0.1.0-rc.7、schema4 及其余依赖不变。

| 对象 | SHA-256 |
| --- | --- |
| A npm tgz | `1c034c3e2e8f4b212a35fc0b03a614ef64843488d1daf4e604bc2820d0381c65` |
| A wheel | `b7c04ce35f403879334114b937715ab1f5295570bc6113954f6d2d9ade17da5e` |
| B r4 完整 ZIP | `cb0d5a01b3cad6c6292aa10a7eaf1b9af76c244a069e856322fc7561d6c35044` |
| 三域 manifest | `2132f289901786fa6e87a03c0a91b34f16a219d62458478e7767b5db19589e1a` |

全部最终 r4 安装的 appSha256 为 `bc4479d1e5a402f1a4f0d9d95e80142de65e0de25fec14a4a52366ef5fa92ee7`。原包位于 `C:/tmp/v006/candidate-r4/`，三域包位于 `C:/tmp/v006/backup-r4/`；复核材料另存候选旁 review，不修改 ZIP。

**可观察结果。** 中文根确认前与确认后分别进行两次实际启动/停止；四个原生 session 的 71 条原历史前缀逐条保留，rc7 允许追加中断收尾事件，未伪称事件文件字节不变。历史、分类绑定、正式 Reader 经 HTTP 读回。原文 PDF、已完成论文的阅读产物及 Excel 三个人工字段保持；仅三个受控执行元数据路径按新根改写并单独核对。凭据文件未导出，合成 canary 不进入包。源阳性对照实际模型/工具计数 2/1；门禁启动下为 0/0，send、wake、maintenance、claim、splice、model、tool 均拒绝，子会话 next-turn/next-step 各一条持续保留。launcher/enqueue/worker 负向入口零 popen、零作业和 launch marker 变动，宿主退出 code0、forced=false。

明确确认后，原 parent `job_481ce6537da62e95` 从 revision3 经第一次输入、第二输入点、stop revision5、再确认至 revision6，实际生成 Reader 和唯一 XLSX child `job_3515b52e239e89d5`。重复、旧请求及删除外部回执后重试均不重复投递；另一个未授权 parent 保持 revision3 停止。R1 专门在真实默认 pipeline 已写派生许可、真实 enqueue 尚未创建 child 时令本任务 worker 退出，移除故障钩子后 stop+新代确认完成同一个确定 child，许可保留旧代审计；R2 的两次 teardown 未清空 inbox，也未强杀宿主。

**失败与回归。** 27 项安装组合失败矩阵覆盖缺域/截断/摘要/路径预算、未知媒体/事件/preset、多 workspace、结构化秘密、同制品限制及目标冲突；实际 preparing 阶段进程中断、实际 library 完成后 DSH 导入 EEXIST 均保留阻止启动门禁，源及有效邻居不变。活跃独立写者与失败备份 abort 的审计后中断采用受控库克隆分支，原冻结路径实测；不是另一次完整安装。实际备份期间普通/维护启动和第二备份均被拒绝。A 最终完整引擎 **599 passed / 3 skipped**（Windows 目录 symlink、Unix zombie、原生 keyring opt-in）；B 全模块 **123 passed / 1 skipped**（Windows 不支持 POSIX socket），OAuth **33 passed**；module check 10 模块/50 源文件/178 imports，unowned=[]。A JS 原 offline 命令在 archive 无 .git 的 Reader-review 用例失败；补正确 git 上下文后尾部五脚本通过，资产四脚本通过，该 JS 源未再变化。不是声称单次全集全绿。

开发期失败、测试 runner 自启问题、Windows teardown 日志占用及派生崩溃验收最初误等待读接口改变状态的超时均留在索引；最终对应证据已通过。资产核对脚本最初误要求迁移元数据字节不变，现仅放行精确三个路径字段并验证其余 JSON 完全相同。所有已安装实验根已停止、profile patch 恢复 `[]`、故障 .pth/module 移除；未对 005/004K/用户实例执行停止、冻结或写入。

**边界与数据回退。** 仅同平台/完整制品、固定 rc7、单 workspace 及列明支持的原生状态。未知媒体/spill、custom plugin/preset、goal/schedule 等先拒绝；已知结构化秘密检测不识别任意自由文本。冻结核验产品支持的写者合同，不声称阻止任意外部文件写进程。失败目标保留隔离，重试另一个全新根；不覆盖 ready/有效实例。失败备份源仅凭明确事务、宿主停止及重新冻结验证无独立写者后解除门禁，保存 partial/审计且不启动。代码回滚不等于数据回退。真实登录与科学质量留 007。

精确演示见 `V02-006-demo.md`；机器证据与日志路径、大小、SHA 见 `V02-006-evidence-index.json`。
