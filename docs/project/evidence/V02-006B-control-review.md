# V02-006B：总控独立复核

2026-09-17。交付 `bde0554dfee627465de92e6ca43f5ba0bc17eaf0`。差异只含指定探针/夹具与同前缀证据；工作树干净，产品/依赖/pins 未变。

总控审阅了 prepare、probe、storage-worker、canary-plugin 的实现及原始 RPC/状态证据，检查固定 Node 22.22.2 的 `v02-006b-lJhAoM` 最终运行。重新比较两个会话的原始事件、ID、父子关系、迁移后 cwd 与两个待发队列，目标挂载两次后的原始前缀仍完整。核对 7 项检查、3 个已停止宿主、两次零模型/工具调用计数与显式发送阳性对照。本轮是独立代码/证据审查，没有重新启动探针宿主。

运行脚本的 SHA 与当前提交最初不一致，进一步核对 `executed-scripts.json` 中保留的实际运行字节及摘要，确认仅尾部空行和换行规范化，没有逻辑差异；runtime 锁摘要完全相同。开发者已在报告明确注明此规范化。总控检查摘要见 [verification](V02-003B-006B-control-verification.json)。

接受结论仅为固定 DSH rc.7、文本会话子集的离线恢复可行性：原生导出可用，离线 materialize/inspect 和 workspace version 2 适配可保留历史、关系和队列。未完成工具会由宿主追加修复事件，不能把历史原始前缀相同说成整个恢复过程字节不变。禁用外部凭据/模型的专属宿主不等于完整产品插件组合。

观察窗为每次挂载后 2 秒，且显式 prompt 阳性对照确实唤醒执行，因此它不是产品级持续禁重放门禁。媒体、spill、自定义 preset、活跃 subagent 描述、schedule/goal/approval 唤醒、多 workspace 与坏文件尚未覆盖。已知凭据 canary 拒绝不能保证识别自由文本中任意秘密。

可接收并集成取证交付；F2、R2-R4、产品三域恢复与最终 S5 仍开放。本轮不提前启动 R2 实现；先推进 003 安装门槛，后续恢复实现须按这些已知限制拆卡。回退仅撤销探针和证据提交，无用户数据迁移。

合入后总控实际执行 `npm run modules -- check`（10 模块、47 源文件、152 imports）和 `npm run modules -- test tooling`（20 passed / 0 skipped），均通过。
