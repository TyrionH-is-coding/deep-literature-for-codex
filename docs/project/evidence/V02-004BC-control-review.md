# V02-004B / 004C 总控复核

2026-09-18：接收 004B 源码修复与 004C 诊断设计，分别集成；004/005 门槛仍未解除。

## 004B 来源与验证

A 实现 `f9dbab5dc13accf0b78db48151dc46e6a3acd808`，交付及集成 HEAD `bf09c557bcedbba1d843579401d73b7beb65705d`。生产仅 MinerU running checkpoint 增加可选 source_sha256、pipeline 对旧无来源 running 检查点的严格兼容例外。metadata、全 SHA、generation 身份、completed/require_stage 和正式缓存守卫保留；缺源文件的复制移到校验之后，避免拒绝后的副作用为下一次放行补证据。原 004A 探针和九项断言没有变化。

旧例外要求原 PDF 与已完成获取记录来源一致、parse upgrade running、job mineru_running、来源字段完全不存在、正式目录与清单均不存在。不承诺恢复任意部分发布/损坏 checkpoint。新增负例重复尝试，防止第一次拒绝第二次放行。

总控在交付工作树独立运行 23 个新恢复/负例及原 parse-kill-before 真进程场景：**24 passed / exit 0**，记录见 [测试输出](V02-004B-control-tests.txt)。开发者最终集合 136 pass / 3 skip、五条 Node 合同、TS/client 构建通过，旧 running 库的跨进程显式续接与六场景证据已审查。早期试跑与最终集合不混计。当前为 Python 3.11.9/Node 24 开发环境，不是固定发行环境；004A-F1 仅接受源码结论，留待 004D 安装候选后关闭。

## 004C 来源与登记修正

B 交付 `2e4ef2cd1d9b302335e046ba8530e2e862222585`，总控合入 `88430051690c9715659a16bb676066f6269886e3`。所有差异是专属设计/脚本/测试与证据，无生产变更。报告区分注入测试、冻结 A 静态审查和固定 DSH rc.7 的原生探针；四项原生检查分别涉及目标队列撤回、独占 turn abort、共享 turn 保留、重启和新 prompt。原始 JSON 的两次 boot、synthetic adapter、源哈希与清理信息一致；没有真实 A cancel 接口，也没有把关闭探针宿主当用户取消。

原卡允许新增测试但禁止 catalog 修改，导致模块校验拒绝 unregistered_test。这是总控任务范围遗漏。总控在本次集成后把 `tests/v02-cancel-contract.test.mjs` 登记到 workflow 的 ownedPaths/tests，不修改旧断言、不绕过门槛。`node scripts/modules.mjs check` 通过（10 模块/47 源文件/152 导入）；`node scripts/modules.mjs test workflow` **72 passed / 1 Windows POSIX skip，exit 0**，见 [组合输出](V02-004C-control-tests.txt)。保留开发者原先模块登记失败记录。

## 未关闭事项与后继

004A-G1 保持开放。当前已证实 B cancel 在宿主调用后才写意图，宿主失败使取消意图丢失；后台 A 及类别工具仍无完整停止控制。接受 cancellation-contract 作为候选设计，不把整套 A/B 新控制协议一次性实施。

- 004D：固定 A/B dev.3（Python 模块 dev2）候选，验证 004B 原失败及旧记录在实际安装中的恢复、来源与已确认资产保护，并维持 Excel/Reader 主流程回归。只写版本/pins/制品证据，不并行加入 004E 未验收逻辑。
- 004E：先修复 B 宿主失败窗口的取消意图持久化与重试，保持现有 A 接口和公开返回合同，取消不冒称 A worker 已停止。新协议、类别工具/安全边界停止另卡，仍阻断 004。

两卡使用相同已验收 B 生产基线但写集互斥：004D 管发行身份，004E 管 handoff 和专属测试/模块记录；catalog 004E 仅可改 workflow 版本/已有测试登记，004D 仅 engine 身份。实例/端口/输出独立，冻结输入；串行集成后必须重新验证组合，004D 安装结论不自动覆盖后来的 004E。

稳定 main、用户实例、schema 与运行时 pins 未变。F2 完整实例恢复仍开放；无真实模型/科学质量或非 Windows 安装声明。
