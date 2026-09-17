# V02-003D 总控复核

2026-09-17：接受交付，003 记录与存储合同阶段通过；F1、F4 关闭。F2 完整实例恢复缺口仍开放。仅合入开发分支，没有发布或改变用户安装。

## 来源与合入

- A 最终提交 `6283c02a690ff42585f064c1f764b999baa97d7e` 已 fast-forward 到 `codex/v02-engine-baseline`；制品源码提交 `26abee5f8c8e4f92f26a9b7fba4ddd236e523b05`。
- B 最终交付 `bf9f4edbd9e7fc5f80e5fe074d8fed35db163b59`，总控集成 `c52ea36c8d57451dbddfceed6f6d0c5b8b380a30`；安装包源码提交 `890fba5cb47d7197f844fddf711414bc63694c86`。
- npm A/B `0.2.0-dev.2`、Python 模块 `0.2.0.dev1`，固定 DSH rc.7、Node 22.22.2、Python 3.11.16、schema 4。源码提交、报告提交、总控文档集成提交分别记录，不冒称同一个 SHA。
- ZIP `a96a0d6bd702e7edd3f9e5327555c978aded3e189ceb06948a9d9da73fcdaca9`；tgz `2e1ec6ebbc9ca37d33060d978f5d1f855455bb4423cc5b481957b3da0259bc09`；wheel `b5d6439b1e3e895e0127dac27ec2b12b9f0bdd46d813896a6a90fd990e2b66d3`。

## 独立检查与测试

总控审查 A 生产差异：仅客户端安全 DOM 冲突提示与生成产物，Python/worker/路由没有变化。三个中文字段、当前/同批其他文献、已知基线异常与未知值 fallback 分开；没有自动解决、导入或重放。B 差异限版本、插件 pins/lock/catalog 身份、模块追溯与本卡脚本证据，没有升级其他依赖。

上一轮总控实际重跑新 DOM 合同 10 项和 build-client --check，通过。本轮在合入后的 B 执行 `node scripts/modules.mjs check`：10 模块、47 源文件、152 导入；`node scripts/modules.mjs test engine`：56 项，55 通过、1 Windows 下 POSIX 跳过，退出码 0。该测试包括传递调用方与模块边界，不与开发者重叠结果相加。

本轮独立重读实际 ZIP、tgz、wheel 和清单 hash，核对解包 270 个清单文件及仅一个额外 BUILD-MANIFEST；41 个已安装 B 源文件对应清单，49 个已安装 Python 文件对应 wheel，安装客户端与 A 构建字节一致。结果见 [机器记录](V02-003D-control-verification.json)。

开发者当前候选证据：A 构建、42 条 offline 命令及 4 条 assets 命令通过；B 模块测试及隔离安装通过，14 项 conflict、12 项 smoke 通过，另有 F2 known_gap。Python 全套未重跑，因为 Python 源码无变化；003B 的 515 pass / 3 skip 是前次证据，不冒称本轮新执行。

总控独立审查真实浏览器的持久 DOM 观察：初次详情、关闭重开、页面刷新、两次宿主重启共 5 份一致文本，显示暂停原因、用户笔记、文献 ID、整批保留和人工核对说明。正常文献无误报，PDF gate 入口及 Reader 切换有记录。三次 launch ID 不同、instance ID 一致；浏览器回归区间的 Excel 与个人字段摘要前后一致。浏览器操作由开发任务执行，总控本轮没有再次打开浏览器。真实浏览器冲突字段覆盖用户笔记，另外两字段及恶意/未知值由 DOM 合同覆盖，不能扩大声明。

## 限制与后续

合成实例 v3d 已停止，清理记录任务 Node/Python 为 0。Office 原生打开、真实模型/MinerU/论文质量、真实用户库、非 Windows 平台未验证。首次进入出现导航选中与设置卡片不一致的观察尚无根因/回归归属；已有入口可进入，刷新/重启后正常，保留原证据，放在 005 导航核查，不据此擅自扩大本卡。

003B 打包元数据失败、003C 界面缺口均由后续卡补齐；保留原失败，不把其原交付改写为当时已通过。整条 B 候选历史随 003D 串行合入。后续 004A 先验证阶段与恢复合同，不自动抽离默认适配器；只在证据显示耦合或缺陷后开修复卡。最终发行仍须从届时完整组合重新打包验收。

撤回可恢复前一开发分支组合；不回退数据库或覆盖个人记录。回退客户端会丢失冲突提示，因此不能把旧界面组合当成等价通过的发布候选。
