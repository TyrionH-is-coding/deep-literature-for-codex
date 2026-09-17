# V02-004A 总控复核

2026-09-17：接受合同诊断交付，保留失败；004 阶段未通过，005 依赖不解除。

A 提交 `dcdb8e6cb23dd8329ceabd4487db0a79fae470ea`，基线 `6283c02a690ff42585f064c1f764b999baa97d7e`。116 个新增文件全部位于卡片允许的探针、测试与证据范围；没有生产、版本、依赖、schema 或既有测试变化。已 fast-forward 集成至 `codex/v02-engine-baseline`，该基线包含一条刻意保留的失败回归，不是全绿产品候选。

总控审查真实 default runner、provider 注入和提交边界、PID 身份检查与进程清理，核对 `_stage_workspace` 和 MinerU running checkpoint。前者对存在的 nested stage 强制要求 result.source_sha256，后者 running 记录尚未写该字段；中断后因此在解析服务开始前被拒绝。失败不是锁未回收或模型服务异常。

总控独立执行：`.venv/Scripts/python.exe -m pytest -q engine/tests/test_v02_pipeline_contract.py::test_cross_process_stage_recovery[parse-kill-before]`，同一提交、新临时目录，实际 **1 failed / exit 1**，最终 failed 而非 completed。断言失败前已验证任务进程清理、重复 parent ID 和已记录资产保护。原始输出见 [复现](V02-004A-control-reproduction.txt)。此次使用任务源码及 Python 3.11.9 环境，不冒称制品内 Python 3.11.16 的安装复验。

开发者当前证据：现有定向 Python 两组 67 pass / 3 skip；新增最终集合 8 pass / 1 fail（分两次执行）；5 条 Node 合同命令 exit 0；6 条独立进程场景 5 completed / 1 failed。真实中断后 parse cache 和已保存 batch 保护有证据；旧 Reader 在未完成新候选下保留，换源后旧 Reader stale 是现行合同。上述计数不重复相加，初稿环境/路径失败日志仍保留。清理记录 live_owned_count=0。

## 未关闭事项

- **004A-F1**：解析提交前活跃进程中断后无法续接，阻断 004 与 v0.2 主流程。004B 仅修复同源未完成 generation 的识别与安全续接，保持冲突和正式资产守卫；之后仍需新制品安装复验。
- **004A-G1**：引擎没有取消状态或受支持 cancel 入口，B handoff 的取消明确只影响宿主会话，不杀 detached worker。这是取消验收未闭合，不能把 crash kill 当用户取消。004C 在独立 B 工作树核实当前端到端语义、提出最小合同/实施卡，不并行修改 A 的状态机或生产接口。
- Windows 深路径、加速 heartbeat 的试跑观察保留为待归因线索；未证明默认条件下的通用缺陷，不扩大当前修复。完整 scope/并发时序/真实模型/非 Windows/完整实例恢复仍未验证。

004B 写 A 的 generation 恢复代码与测试，004C 只写 B 的专属取消诊断脚本、测试和设计文档；冻结 A 只读基线、不同实例/输出、不共享可变接口，所以可并行。集成仍串行。默认阶段适配器物理拆分继续搁置，不以全面重构代替缺陷修复。
