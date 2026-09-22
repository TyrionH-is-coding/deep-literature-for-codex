# bridge 变更记录

## 0.1.2 — 分类推进守卫（V02-004J，未发布）

- start/continue 工具在真实 session 范围下串行检查 Handoff 本地取消，避免控制请求尚未送达 A 时绕过停止。
- HTTP 继续使用既有 resume→operate 路径；分类工具不获得解除停止能力，Host/Origin、pins、A 协议与产品版本不变。
- 验证与配套回退限制见 [J 报告](../../project/evidence/V02-004J-report.md)。

## 0.1.1 — 停止控制跨包适配（V02-004I，未发布）

- 新增显式恢复分流、控制参数预检和 reading-control-v1 无损快照校验。
- 保留业务失败/完成及 request/ack/terminal 的区别；错误 envelope、错 parent 和缺失导出拒绝。
- start/普通 resume/attach 保留原调用方接口，workflow、scope 白名单和产品 pins 未变化。
- 验证、兼容边界与回退见 [V02-004I 报告](../../project/evidence/V02-004I-report.md)。


## 0.1.0 — 模块登记基线（2026-09-17，未发布）

- 来源：产品 `v0.1.0-rc.6`，回退基线 `e7160eb`。
- 职责：DSH 工具和 HTTP 与任务/文献引擎适配。
- 本轮：建立模块边界、接口和追溯记录；业务及持久数据格式不变。
- 源码重组与工具变化见本轮 Git 差异。
- 验证：见[本轮验收记录](../acceptance-2026-09-17.md)；版本号不表示已完成发布验收。

## 0.1.3 / V02-004K-R1
新增只读就绪握手，只有 Handoff 和可信 API 注册完成才可用。scope、停止/恢复与业务接口不变。

## V02-006 恢复门禁与三域事务

模块 bridge 0.1.4：仅固定同制品新根恢复，持久事务身份和phase约束早于启动/对账；恢复验证禁止原生执行，显式确认只允许指定parent。普通schema和调度算法不变。恢复接口/取证见 docs/project/evidence/V02-006-contract.md；安装结果尚待候选验证。

