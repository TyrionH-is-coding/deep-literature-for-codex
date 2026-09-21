# engine 变更记录

## 0.1.0-rc.5 — 模块登记基线（2026-09-17，未发布）

- 来源：产品 `v0.1.0-rc.6`，回退基线 `e7160eb`。
- 职责：外部文献引擎，业务代码不在本仓库。
- 本轮：建立模块边界、接口和追溯记录；业务及持久数据格式不变。
- 实现保持独立包/外部固定制品，未改动其业务代码。
- 验证：见[本轮验收记录](../acceptance-2026-09-17.md)；版本号不表示已完成发布验收。

## V02-003D 内部候选（未发布）

引擎 npm `0.2.0-dev.2`，Python wheel `0.2.0.dev1`；仅客户端 Excel 暂停冲突提示变更，Python 源码无差异。

- 来源：`26abee5f8c8e4f92f26a9b7fba4ddd236e523b05`（独立 A 003D 工作树）。
- 本地制品：`inputs/scientific-reading.tgz`，SHA256 `2e1ec6ebbc9ca37d33060d978f5d1f855455bb4423cc5b481957b3da0259bc09`。
- wheel SHA256 `b5d6439b1e3e895e0127dac27ec2b12b9f0bdd46d813896a6a90fd990e2b66d3`。
- 无远程发布 URL；固定 DSH rc.7、Node 22.22.2、Python 3.11.16。新候选安装结果见 V02-003D 证据，不沿用 dev.1 的安装结论。

## V02-004D 安装恢复候选（未发布）

A npm `0.2.0-dev.3` / Python `0.2.0.dev2`，来源 `a45aff9a6d5419c1b7a5cbc7954355176d56fac5`。
A tgz SHA256 `a2e9e629140688df3fce947c4118e32157326a7e0a75c3d7952f6a67b413ba44`；wheel SHA256 `37f3da559ba74f022f4b73c3757b55299254ee50a75f04af49162b00749f4f83`。
沿用已验收 004B 恢复修复，B 接口/schema/依赖和运行时未变；未包含并行 004E，取消与 F2 不宣称解决。
固定 Node 22.22.2 / Python 3.11.16 / DSH rc.7。当前验证见 V02-004D 专属证据。回退候选身份不回退用户数据。

## V02-004K 内部安装控制候选（未发布）

A npm `0.2.0-dev.4` / Python `0.2.0.dev3`，来源 `2dcd068bf3cbdf4b601351ab0bda639873bc0359`；tgz SHA256 `a21bf875178c5e5a5fad8fd005ad2fc7f4490aff99c2aa9d33c8e0a4367ef7b9`。组合固定 A 停止/写前守卫/导出与 B 多别名工作流，生产 Python 字节未变。Node 22.22.2 / Python 3.11.16 / DSH rc.7 / schema4 与依赖不变。安装验收证据见 V02-004K；API、UI、科学质量分别报告，元数据本身不代表验收通过。回退须配套保留资产与停止记录，不能降级消除停止意图。
