# V02-005：Reader 样例与首次完整流程演示

**交付待复核。** 原 dev.4 ZIP 新装实例已完成可信入口“入库→缺 PDF gate→补入 PDF→精读→正式 Reader→Excel 三字段保存→宿主完整重启后继续阅读”；一条 provider 失败经显式停止确认和恢复，实际推进同 parent/source 至合法翻译 gate。生产源码、依赖、版本、schema 均未变，没有重打包、跑全集、发布或改用户安装。

**身份与输入。** B base `ce5fd9aac20985f3f80ca675b8781e40006a227e`，context `28278cd0bc1c6983a727361a4bd95198090b5db1`、补验授权 `6a6c5963d43df546287ee1c621277a948b0dac72`；A 只读 `ad00bc5a84110346801dbb6e98c8b9e19135287d`。ZIP 为 `C:/tmp/v004k/candidate-r1/deep-literature-for-codex-0.2.0-dev.4-win-x64.zip`，SHA256 `862e08c5ba85b399f6530d468298cfc7d3866675eae4b5ebe09e8b950610d105`，原安装器新装 `C:/tmp/v005/instance`，实例 `4495c8ba-c27b-4bdb-9bf8-54551fc0171f`。安装生产来源 A `2dcd068` / B `572fee5` 及锁定依赖/全集引用 [004K 验收](V02-004K-report.md)，本次安装退出 0。缓存只做 SHA 核验复制；未安装个人 skill。

复用 A 固定提交三份 JSON，逐字节 SHA 核对；3 份小型自有文本 PDF、MinerU 外部替身、译文及 `full-review-v2` 均为**合成输入**。PDF 仅为合法自有文本载体，图像和布局来自合成解析输出，不宣称 PDF 解析忠实度。所有默认 worker、gate 校验、发布、Handoff/适配器及 Reader 均为真实安装代码。记录写入仅通过合成 XLSX 和安装 `xlsx-import-user-fields`/`xlsx-refresh`，SQLite 仅只读核对。

| 实际结果 | 证据 |
| --- | --- |
| 正常公式 `title_d8b339a0356f` / `job_f7f3079fdccf0c20` completed；图表及上下标样例同样 completed | `normal-*.json`、安装 API `calls.jsonl` |
| 38 块译文与夹具一致，source_text 与当前 batch 一致；3 个 generation 的 PDF、Reader、9 项 package entries、3 项图表资产 SHA 通过 | `assets-verified.json`、三份 Reader 清单 |
| 中英切换、三级目录、导览定位原文、折叠参考文献展开、行内/块公式、图/表放大、上下标、重点模式实际浏览器检查 | `screenshots/01–05,07–08`、`browser-*.txt` |
| XLSX G2:I2 三值导入：updated=1、conflicts=0；refresh success；完整 stop/start 后同任务 completed、Reader/PDF SHA 与三字段保持；浏览器重开正常样例 | `records-restart.json`、`xlsx-*.xlsx`、截图 08 |
| provider exit 19 → failed → cancel 确认 → resumeStopped → 同 `job_d3cbdf77f2ed271b`、同 PDF SHA/generation 到 translate_full_read | `failure-formula-outline.json`、`assets-verified.json`；最终 revision=4 |
| 本地 mock 的一次正式原生 prompt 正常 completed，无工具调用；实际文献标签、分类过滤、库内“打开 HTML”到 Reader；“定位 Excel”显示打开总表并按题名查找的回退反馈 | `native-entry.json`、`browser-library-excel.txt`、`browser-reader-from-library.txt`、截图 10–13 |

**操作语义与问题分类。** 失败业务作业保留 `control.status=terminal`；本例 `stopRequested=true`、`acknowledgedRevision=revision`、`worker=null` 才是停止已确认，不能把 terminal 改称 canceled。恢复使用新的稳定键、当前 revision、`resumeStopped:true,input:{}`；本例已实际进入翻译 gate，后续必须提交完整翻译合同。未杀进程模拟用户停止。

无已证实发布阻断或生产修复。夹具修订及失败全部保留：旧翻译版本被拒后按 v3 续接；失败样例题名后缀未同步解析题头被身份守卫拒绝，修正外部输入后到 gate；最终只读断言字段名修正为 pipelineState。表格工具导出改变隐藏身份页可见性，导入前拦住，改为仅合并工具生成的三格值到原 ZIP（其他成员逐字节不变），通过核对后才导入。这些不计产品返工。

**入口边界与未验项。** 初始 blank 会话及未发送草稿不显示文献标签（截图06、09），固定 DSH 的 workspace `client.js:99–108`、conversation `client.js:6994,7074` 可解释此行为，不能据此断言分类会话丢失。按补验授权复用004K本地 mock 模式，经公开 `session.prompt` 完成一轮后，真实库内入口已通过；未改 blank 状态或数据库，未使用真实模型、凭据或账户。首轮因桥接导入路径错误在 prompt 前失败，修正公开模块入口后只发送一次。**定位 Excel 只验到“已打开文献总表，请按论文名查找对应记录。”；桌面 Excel 编辑、选中指定行未验。** 未声称滚动位置跨端口保留、真实模型/科学质量、F2 三域恢复、跨平台或最终用户验收通过。模块 context 命令因工作树无 acorn 未运行成功，已读静态模块说明/公共入口，未改依赖。

**重开与收尾。** [精确命令及步骤](V02-005-demo.md)，[带 SHA 证据索引](V02-005-index.json)。证据与实例保留于本机 `C:/tmp/v005`，验收前勿删。已用安装控制入口正常停止宿主，原 profile 字节恢复，归属 Node/Python 进程为零（`cleanup*.json`）；receipt 为 review，不启动006。回退只撤回本任务夹具/证据提交或停止独立实例，保留文献资产和控制记录，不回退用户数据。跨夜等待不计产品失败，已通过矩阵未重跑。
