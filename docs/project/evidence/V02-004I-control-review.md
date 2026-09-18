# V02-004I 总控验收

跨包接口源码验收通过。A 交付/集成 `b4a9ecc00a76b85c244a0167c79b5a3539e97415`，B 交付 `f4c93517fa693c4232c252df9d0cb301d38f0c5d`、集成 `36c27fb8b281faf4496ae6fade265e5f2d866555`。双交付树 clean，变更位于允许范围；A 未改 Python、依赖或分类工具，B 未改 workflow、pins 或用户安装。

总控阅读生产差异和新增测试，核对 Python 权威快照与 B 校验、A 明确恢复参数及受信 scope/provider 传播、旧调用兼容、错误 envelope 优先。独立重跑 B bridge+control-adapter 16 项通过，A stop-control-api 传输探针通过；B 合入后 modules check 通过，control-adapter+handoff+cancel-contract 31 项通过（12.48 秒）。两个 B 计数存在重叠，不相加。

开发者真实 A JS→B adapter→固定 Python 集成的 17 个观察已阅读；总控重新计算其 6 个来源文件 SHA256 全部吻合。read/stop/普通 resume 与 attach 被阻止、显式恢复同 parent 到缺 PDF gate、跨范围拒绝均有真实进程结果。A build/typecheck/相关 TS 共 11 个唯一命令最终通过；保留一次长路径失败及专属短 TEMP 重试。B 完整 bridge 61 pass/1 skip、workflow 86 pass/1 skip 是开发者运行结果，未重复全量或相加。未改 Python，因此未重跑 Python 全集。

仅接受接口能力。004A-G1、004 整体仍开放，005 等待：Handoff 尚未调用 stop/read/显式恢复；用户取消链及最终安装组合尚未验收。后继 V02-004J 完成 workflow 行为接入与真实来源链验证，再验收最终安装组合。不将 source-only 结果冒充正式发布或真实模型质量。回退须配套撤回 A 导出与 B adapter，不删除停止记录或文献资产。
