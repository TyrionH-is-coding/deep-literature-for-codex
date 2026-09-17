# V02-003B：总控复核与范围修正

2026-09-17。B 交付 `8c37fb13d7c6816c1de067d72ef8fef091097ac3`，A 交付 `e3f58d1710413b5c6340fe55974a227b97ee8373`。任务交回已停止，没有安装任何实例。

总控读取完整元数据差异、构建与测试日志、JUnit、制品；重新核对 tgz SHA `fdce0ada390e2f27615c6b6050dbf7ef83c871d6a6304c4235e4414f667c8930`，两份本地副本相同，嵌套 wheel SHA 相同，51 个 Python 文件与 A 来源 `ca02db6beb2cf45ad0fd69618313971d0a346c55` 在统一换行后相同。A 生产改动只有自身版本，515 passed / 3 skipped；默认 41 条 Node 离线命令和 4 条资产命令通过，构建与打包成功。B runtime lock 除该插件条目外逐对象比较完全一致。检查摘要见 [verification](V02-003B-006B-control-verification.json)。这些是原始结果复核，本轮没有重跑 A 全套测试。

真实阻塞在 `scripts/module-graph.mjs` 的身份一致性检查。003B 更新了 pins，却受任务卡 writePaths 限制不能同步 catalog：模块 engine.version 与 externalEngine 的 version/sourceCommit/sha256 共四字段仍为旧值。总控确认 `engine_pin_mismatch` 正是这些值不一致；校验器应继续阻止不一致制品。B 直接宿主测试 70 pass / 1 fail / 1 skip 与打包失败记录如实保留，不能计为安装通过。

这是总控漏列关联元数据造成的任务范围不足，并非新增功能决策，不需要用户重新授权。原 003B 以 needs_followup 结束，保留未完成门槛；新建单目标 003C，允许同步四字段后完成原卡剩余验收。不是重复派发运行中的 003B，也不把失败任务记为通过。

A 版本及制品来源交付可独立接收，已快进集成到引擎开发分支。B 版本/pins 提交暂不合入总控，以免让总控分支长期处于校验失败状态；003C 从 B 交付 SHA 继续，在固定 A 制品上修正 catalog。没有重建 A 逻辑的理由，不重复跑相同来源的全部 A 测试；B 新来源、打包、安装和安装场景必须新跑。

F1、父工作域 V02-003 与安装验收仍未通过，V02-004 实现依赖不解除。main、用户实例、运行时/schema、旧失败样例保持不变。
