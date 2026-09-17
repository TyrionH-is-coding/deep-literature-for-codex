# V02-006A：完整实例恢复的最小方案

日期：2026-09-17；状态：设计建议，待总控复核。本文未实现任何接口、格式或迁移，所有“应/必须”和验收场景均为后续要求。方案通过不代表 S5 通过。

工作台事实固定于 `d4d0cf3af2b5da3bd0e1ade7bfc6645d52cb026c`；引擎事实固定于 `8e00b334389cd90721b7d404013a07687753aa5c`。未使用 V02-002 开发目录或未完成结论。任务边界见 [006A](../tasks/V02-006A.md)，执行证据见 [报告](../evidence/V02-006A.md)。

## 1. 已核实的事实与缺口

以下工作台链接均相对本仓库，符号名用于精确定位；引擎链接固定到源码提交，不依赖远端 main。

| 状态域 | 当前位置与源码事实 | 已有证据与缺口 |
| --- | --- | --- |
| 文献库、资产、引擎作业 | `<root>/library`；[library-transfer.mjs](../../../src/modules/releases/library-transfer.mjs) 的 `runLibraryCommand` 固定 `--data-root root/library`，`snapshotLibrary` 写 `state/library-backups/*.zip`；`restoreNewLibrary` 只接受空库或同摘要迁移回执 | [001 F2](../evidence/V02-001.md) 及 [probe](../evidence/V02-001/v02-probe.json) 的 `backup`：39 文件，35 个非 job 资产摘要一致；没有覆盖全部资产类型和活跃作业 |
| DSH 原生会话 | [environment.mjs](../../../src/modules/foundation/environment.mjs) 的 `isolatedEnvironment` 设置 `DSH_HOME=root/state/dsh-home`；[workspace.mjs](../../../src/modules/workflow/workspace.mjs) 以 `root/workspace` 的 realpath 调用 `workspace.create` | [final-audit](../evidence/V02-001/final-audit.json) 有 `sessions/--C-Users-…-workspace--/session-…/session.jsonl.zstd`，probe 会话为 `session-bef70280-6f8e-4abc-b849-f0979122a5cf`。这是实际路径证据，不是完整 DSH 存储格式合同；迁移、索引、队列恢复尚未证明 |
| handoff 账本 | [handoff.mjs](../../../src/modules/workflow/handoff.mjs) 的 `Handoff.open` 要求 schema=1 且 instanceId 匹配；持久化 `state/handoff.json`，含 bindings、children、tasks、workspace；任务含 jobId、幂等摘要、dispatches、operations | 001 创建了非空分类绑定，不能外推所有任务字段恢复已测；`_refresh` 要读真实 job 和 Reader 才能判完成；`_dispatch` 对历史 rpcId 查证，不确定时保留 uncertain |
| 实例身份与运行态 | [instance.mjs](../../../src/modules/foundation/instance.mjs) 的 `initializeRoot` 在空根创建 `.workbench.json`（随机 instanceId、规范 root），旧 root 不匹配即拒绝；[control.mjs](../../../src/modules/lifecycle/control.mjs) 的 `validate` 验证活实例；[supervisor.mjs](../../../src/modules/lifecycle/supervisor.mjs) 每次生成 launchId 和 launch.patch | 旧身份不能直接复制到新根。last-run/PID/端口不代表可恢复进程；`stop` 不证明引擎所有独立 worker 已停止 |
| 安装与凭据边界 | [releases.mjs](../../../src/modules/releases/releases.mjs) 的 `select/validateRelease/activateRelease` 校验根内 release 路径、托管 profile 链接和 dataFormat；[pins](../../../runtime/pins.json) 固定 DSH rc.7、引擎 rc.5 | 安装代切换不是数据回滚；不能复制旧 installation.json、venv 或 profile node_modules 链接冒充新安装 |

引擎 [library_backup.py](https://github.com/TyrionH-is-coding/dsh-scientific-reading/blob/8e00b334389cd90721b7d404013a07687753aa5c/engine/src/scientific_reading/library_backup.py) 的精确事实：

- `backup_library`（110 行起）：`data_root_freeze` 内 SQLite `BEGIN IMMEDIATE`、SQLite backup、前后资产盘点及归档摘要验证；`os.link` 原子创建输出，不覆盖备份。
- `_verify_archive`（171 行起）：合同 `scientific-reading-backup-v1`、schema 范围、路径/重复条目/数量大小、清单文件集合、逐文件 size/SHA-256；`_database_check`（90 行起）检查完整性与外键。`engine_version` 仅要求非空字符串，不等于严格制品兼容验证。
- `EXCLUDED_ROOTS`（29 行）排除 secrets、runtime、downloads、临时状态等；`_excluded` 还排除 SQLite 边文件、锁和 jobs 的 launch.json。故“完整”指三种受支持持久状态，不包括任意根目录文件、缓存或所有下载暂存。
- `_rebase_paths`（234 行起）仅改 `PATH_KEYS` 的旧 library 根前缀；外部路径可能原样保留。`_recover_tasks`（252 行起）把 running/queued 作业转 interrupted、清理相应 PID/heartbeat；下载/批任务转 failed，要求重新提交；`_rebase_workspace_jobs`（293 行起）处理论文及 generation 的 job.json。
- `restore_library`（310 行起）：空目标、独立 staging、校验、迁移、重绑定、资产可解析验证、复验归档、rename 发布；返回 `automatic_resume=false`。它不处理 DSH 或 handoff，也不保证所有执行字段已经可移植。
- [data_guard.py](https://github.com/TyrionH-is-coding/dsh-scientific-reading/blob/8e00b334389cd90721b7d404013a07687753aa5c/engine/src/scientific_reading/data_guard.py) 的 `data_root_operation/data_root_freeze`（81/105 行起）通过 admission/active 锁冻结受支持写操作；当前库备份结束即释放冻结，不覆盖之后的跨域复制。

001 备份 SHA-256 为 `c07f241e73d40dbf1d37f312083ad27cf3639e870f6f80fcf19fa1a3464d2e23`；probe 的 `members` 完整列举归档，`native_session_in_archive=false`、`handoff_in_archive=false`。rc.6 [对照](../evidence/V02-001/v02-rc6.json) 同样缺失两个域，不能归因为模块化新增回归。001 的恢复 Reader 校验成功只证明其合成样例，本文未重跑该测试。

## 2. 选择与最小支持范围（建议）

| 方案 | 额外复杂度 | 判断 |
| --- | --- | --- |
| 整个 root 直接复制 | 表面最少；会带入身份、凭据、链接、旧解释器绝对路径，仍没有跨域一致性 | 不采用，无法满足独立身份和凭据排除 |
| 停机三域包，使用现有库归档，限定版本的 DSH 导出/导入适配与 handoff 重绑定 | 需持续写入屏障、一个包清单、一个恢复事务、一个 DSH 适配器；无需在线增量协议 | 推荐的最小可行方案 |
| 在线快照/日志复制、跨版本通用迁移、原位覆盖回滚 | 要处理多写者序列、队列重放、冲突与数据回滚 | 推迟，当前收益不足以承担验收成本 |

首版仅支持同 OS/架构、同一完整发布组合、同 DSH 存储格式；新绝对根必须独立。跨平台和跨版本默认拒绝，未来只有显式兼容矩阵及迁移验收后放开。即使库引擎支持 schema 迁移，整实例模式也不默认采用。发布组合记录 app 摘要、引擎制品摘要/sourceCommit、DSH 版本/锁文件摘要、dataFormat 和数据库 schema；精确安装制品应另行保存并验证，不把可执行目录混入数据包。

DSH 是尚待核实的关键边界：001 只证明原生历史存在；当前所读源码不包含 DSH 持久格式或 session 导入接口。后续必须针对固定 rc.7 查明会话内容、workspace 注册/索引、压缩格式、待发队列与凭据存储。优先使用经核实的宿主导出/导入接口；若不存在，则实现严格绑定版本的离线适配器。不能猜测 RPC 名称、只改目录名或用 `session.create` 重建空会话后声称历史恢复。无法无损迁移历史并禁止队列自动执行时，完整恢复必须拒绝，不能静默降级为库恢复。

## 3. 包与一致性合同（建议）

逻辑包：`manifest.json`、`library.zip`、`sessions/`（经 DSH 适配器导出的历史及必要关系）、`handoff.json`；非密钥的身份来源/配置需求写入清单。外层包自身使用独立 SHA-256 回执，清单不得自引用其摘要。

清单至少包含：contract/version、backupId、时间、source instanceId/canonicalRoot/workspace、平台及完整版本组合、三域齐备标志、DSH 适配器版本、各文件相对路径/字节数/SHA-256、所需空目录、排除列表、会话/分类/任务数量与关系摘要、停机/冻结证明和未完成项摘要。记录缺省空账本与空会话的显式语义；已有数据却缺文件不得当空状态。清单及内部 library.zip 均必须验证，嵌套压缩的解包大小纳入资源预算。SHA-256 用于损坏检测，不声称可抵御归档和摘要被一并替换。

备份顺序：

1. 核对源身份、发布和没有未完成发布切换；获取实例维护互斥，关闭新 handoff/DSH 投递入口。
2. 停止宿主并确认退出、账本写入完成；等待引擎当前受支持操作退出。不能用磁盘 PID 杀进程，也不能把 `cancel` 当作 worker 已终止。
3. 获取并持续持有引擎写冻结，直到三域盘点、复制与最终校验结束；SQLite 保持现有一致备份方法。现有 `snapshotLibrary` 的冻结生命周期不够，需后续协调接口/锁持有方案，不能在 JS 外套锁后递归调用导致 `backup_inside_active_operation`。无法保证持续屏障、存在不受支持外部写者或等待超时则中止；不生成成功包。
4. 在库根外的本次专属 staging 创建库归档、DSH 导出和 handoff 副本；验证相互引用和冻结前后清单，输出整包摘要。DSH 历史含密钥的处理见第 5 节。
5. 完成校验后以不覆盖方式发布备份及回执，释放冻结/维护。失败保留明确失败记录；残包不得被列为可恢复备份。进程崩溃释放系统锁后仍需持久事务标记阻止不明状态自动启动；重启先核对事务，而非盲目重试。

维护期间应拒绝普通启动。现有 `assertStartAllowed` 只检查 release-transition 与存活维护通道；新的持久备份/恢复标记检查是待实现要求，当前不具备。

## 4. 独立目标恢复事务与重绑定（建议）

采用最终绝对路径固定的独立新 root，恢复时保持隔离门禁；不先绑定临时 root 再改名整个实例，以免再次产生路径失效。数据可在同卷临时子目录完成后放入该独立 root，但整个实例的可用性以持久事务状态为准。

1. 只读预检外层/内层清单、摘要、版本、空间与源身份。目标不得是源根、其祖先/后代、现有实例、软链接/junction 别名或已有非空目录；按 realpath、Windows 大小写/卷语义检查，拒绝有歧义目标。独占创建目标，防并发恢复。
2. 用已校验同版本安装组合在空 root 建立新 instanceId 和安装路径，禁止自动启动。安装先完成再写恢复事务标记的细节必须在实现卡验证，不能因根非空绕过 initializeRoot 的检查。预留目标与安装期间由专用恢复所有权/门禁保护。
3. 写 `preparing → validating → ready` 的持久恢复回执（建议字段：restoreId、archiveSha、targetRoot、新旧身份映射、phase、completedSteps、failure）。只有 ready 才允许正常启动；失败、中断或未知状态一律隔离。
4. 使用库恢复到新 `root/library`；保留其重绑定记录。把 DSH 导入新 workspace，把 handoff 写到新 state；在三者完整读回前目标不是有效实例。源实例始终不写入、不切换、不注销。
5. 静态校验通过后允许仅恢复验证用途的宿主启动：没有凭据、自动队列/工具执行禁用、只允许查询；当前宿主是否能提供这种模式须后续证实。读取会话历史、分类/任务关系和 Reader；成功后停止验证宿主、写 ready，普通启动仍由用户显式触发。不能依赖缺密钥来阻止本地工具执行。
6. 任一阶段失败不提交 ready，停止本次验证进程，留失败回执/隔离数据。最小方案不做断点续拷；重新预检原备份，使用另一个全新目标重试。清理只允许本次 restoreId 所有且路径核对通过的隔离目录；不得清理源或有效实例。ready 后重复请求只读确认 archiveSha/身份/文件状态，不再覆盖数据。

重绑定规则：

| 对象 | 规则与验证 |
| --- | --- |
| `.workbench.json`、installation/profile 链接、launchId/PID/端口 | 新安装生成；来源身份仅作审计元数据。排除旧 last-run、launch.patch、维护/发布事务、日志、runtime/venv；不恢复进程 |
| library 路径 | 复用引擎白名单重绑定与 job 修复；扫描所有执行元数据的残余源根及外部路径。科学资产/Reader 字节不全局替换；历史叙述里的旧路径仅显示，不用于执行。必要外部 PDF/输出路径无法解析时要求重新附加，阻断相关继续操作 |
| DSH workspace | 新 `root/workspace` 注册得到新 workspaceId；将会话位置、内部 workspace 引用及必要索引按经验证格式映射。旧路径命名目录不能原样复制后宣称可见。任一未知必要字段或索引迁移失败，中止整实例 ready |
| sessionId、children | 首版在独立空 DSH_HOME 内保留 sessionId 和父子关系；检测重复、悬空及环。若宿主无法保留 ID，首版拒绝；不临时引入复杂的任意 ID 映射。历史原文/事件序列读回须一致 |
| folderId/paperId/jobId/taskId | 保留已有稳定标识及幂等键/请求摘要，核对库中实际分类、论文所属分类、作业所属论文；bindings 的 active 与分类归档状态一致；历史已归档绑定保留。缺关联不新建假对象，不把历史任务变为新任务 |
| handoff instance/workspace | 只将顶层 instanceId 和 workspace 映射到新值，保留 bindings/children/tasks 与 operations/dispatches 的历史证据；工作副本的 job/artifacts 缓存按新库状态重新读取，原始账本保留在备份；每一变换记录字段、前后摘要及原因 |

## 5. 未完成任务与凭据（建议）

恢复完成不等于任务续跑。默认全局“恢复待核对”门禁禁止 submit/dispatch/resume/attach 自动触发，也禁止 DSH 待发队列和工具重放。引擎已有 interrupted/failed 处理可以复用，但必须核对全部任务类型；handoff 的 `waiting_agent` 不得在读回后自动发送 prompt。

保留 cancelRequested、操作 fingerprint、gateDigest、rpcId、已观察证据。prepared/uncertain/pending 投递在新宿主上先与原生历史对账；原 pending 不证明新宿主仍有队列，缺证据保持 uncertain 并要求显式选择，不能自动重发。completed 任务只有实际 Reader/资产校验通过才显示完成；jobId 为空的 accepted 任务保留待确认，不能借恢复调用 start 创建作业。运行中断、waiting_user、waiting_agent、取消中、操作结果未知分别展示；解除门禁后的用户操作仍遵守幂等键与原 gate 的合同。下载/批处理明确提示核对结果后重新提交。

凭据存储不导出：OS 凭据管理器/DPAPI/Keychain、API key、OAuth access/refresh token、浏览器 cookie、登录会话、secrets、Codex home、环境文件和可能包含密钥的 profile 配置。新安装仅重建产品默认 profile；用户模型提供商、密钥、MinerU/机构授权需重新配置，模型配置只记录非秘密需求，不将原配置原样打包。

不声称“排除 secrets 目录即可保证历史无秘密”：会话、工具返回、作业参数或库内容可能曾包含用户粘贴的密钥。首版需要合成 canary 覆盖结构化凭据字段和已知存储；无法安全导出且保持历史语义时必须失败并报告待处理项，不能静默删历史后宣称完整。任意自由文本中未知秘密无法可靠自动识别；这是设计限制，必须在后续数据合同/用户说明中明确，不能将未扫描的 DSH_HOME 整体纳入包。本文没有读取真实凭据或文献。

## 6. 后续验收场景（全部尚未执行）

每项使用合成实例与完整候选制品，记录版本/包摘要、前后清单、三域关系、身份和最终事务状态；失败项统一断言源及另一个有效实例摘要不变、目标不可正常启动、没有模型/MinerU/外部调用。

| 场景 | 必须观察的结果 |
| --- | --- |
| 三域正常恢复到含空格/中文的新根 | 库字段及资产 SHA 一致，允许的 job 元数据变换有回执；全部历史可读、父子/分类绑定正确；新 instanceId/workspace、旧 sessionId；重启两次仍可读 |
| 任一域/清单文件缺失、伪装空状态 | 预检拒绝；不默认为空账本，不进入 ready |
| 外层或库内摘要错、大小错、额外/重复/大小写冲突条目 | 拒绝；不只验证 ZIP 可解压；归档在校验后被替换也须检测 |
| 路径穿越、链接/junction、源目标别名、有效实例目标 | 写入前拒绝；文件绝不越出隔离目标 |
| dataFormat、schema、DSH/引擎/app 组合不兼容 | 明确拒绝且列差异；禁止隐式升级/降级 |
| 会话压缩损坏、workspace 索引未知、重绑定失败、悬空分类/任务 | 整体失败，保留隔离回执，不删除问题项后凑齐完成 |
| 旧路径遗留、外部附件不可用 | 执行路径校验定位字段；必要关系缺失时不 ready，允许的外部输入缺失则标明待重新附加且禁续跑；历史文本不替换 |
| 库已恢复但 DSH 导入/账本写入失败 | 目标仍不是有效实例，不修改源；新目标重试可完成 |
| 在备份复制中、库完成后、DSH 导入中、验证启动中、写 ready 前后强制中断 | 未发布备份不可见；恢复标记使普通启动失败；ready 写入原子性可核对，重试不覆盖已有 ready 实例 |
| 活跃 worker、并发普通启动、并发备份、磁盘不足/权限失败 | 冻结/互斥生效或有界超时，不能混合三个时间点；不按陈旧 PID 停止别的进程 |
| running/queued、waiting_user/agent、取消中、prepared/uncertain 操作及投递 | 状态按真实作业重读；没有自动 prompt/工具/worker 重放；显式继续一次，重复幂等请求不重复执行 |
| 凭据 canary 与无凭据恢复 | 包内无测试密钥/token/cookie；恢复可读历史/Reader但需重配外部服务；会话包含凭据无法安全处理则明确拒绝 |
| 空实例、无 handoff 的旧实例、归档分类、非活动 generation | 明确空状态能往返；有历史不得误判空；全部所支持资产/会话类型分别列覆盖，未覆盖不写“完整通过” |

## 7. 可单独验收的实现卡草案

以下是拆卡建议，不创建任务、不赋予 ready，也不越过 V02-006 的正式依赖。具体编号由总控决定；未来基线须采用已验收组合，不能直接把本文 SHA 当最终产品基线。

| 草案 | 单一目标/建议职责 | 依赖与独立验收产物 |
| --- | --- | --- |
| R1：固定 DSH 状态合同与导入适配 | 针对锁定 DSH 制品查清历史、索引、队列、凭据；无外部调用的合成导出/新 workspace 导入 | 后续引擎/宿主审计结论可用；提交字段白名单、版本绑定、历史完整读回与禁止重放证据。若能力不具备则阻断后续完整方案 |
| R2：停机一致三域备份 | releases 统筹 lifecycle/workflow 写入屏障、引擎持续冻结、清单及凭据排除 | 依赖 R1；合成并发写入、超时、中断、三域摘要/关系验收；新增冻结接口如需要须先审合同，不复制引擎备份实现 |
| R3：独立恢复事务与重绑定 | releases 统筹安装门禁、三域导入、映射与失败隔离 | 依赖 R1/R2；上述缺文件/摘要/版本/路径/部分恢复/中断场景全部给出状态和不覆盖证据 |
| R4：任务对账与显式继续 | workflow 与 DSH/引擎适配实现恢复门禁、投递证据对账 | 依赖 R3；各未完成态及重复幂等请求不重放，completed 必须实际 Reader 校验；不混入新调度功能 |
| R5：最终制品 S5 演练 | tooling 使用发布安装制品从备份恢复到新根并两次重启 | 依赖前卡验收及 V02-006 其余正式前置；归档原始命令/摘要/会话与任务读回，按平台范围明确结论。唯此可为 S5 提供产品通过证据 |

回退本文仅撤销文档提交；未来实现回退不得以代码回退覆盖已恢复数据。尚未解决的核心问题为 DSH 导入合同与禁重放能力、跨域冻结接口、凭据与历史共存的可导出边界。总控可接受本设计交付，但这些问题须在对应实现卡得到证据后才能宣布完整实例恢复可用。
