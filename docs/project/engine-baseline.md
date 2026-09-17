# 固定引擎源码审计

日期：2026-09-17。范围：静态源码与 Git 身份核对；未运行引擎测试、未打开真实文献库、未复核发布 tarball 字节。

源码仓库为 `TyrionH-is-coding/dsh-scientific-reading`，固定 commit `8e00b334389cd90721b7d404013a07687753aa5c`（`v0.1.0-rc.5`）。工作台 `runtime/pins.json` 锁定同一来源及 SHA-256 `318814ec542de94a47cd2855b21d0f7af9778b22b283d3995d0c499a3465e2fd`。本地隔离检出位于 `C:/Users/15694/Documents/ChatGPT/deep-literature-engine`；路径仅作定位，commit 才是身份。

## 必须保留的边界

以下路径均相对引擎仓库。Python 文件位于 `engine/src/scientific_reading/`。

| 边界 | 源码证据 | 含义 |
| --- | --- | --- |
| 数据库 | `library_schema.py` 的 `TARGET_VERSION = 4` | 当前已是 schema 4；本轮不夹带 schema 6 迁移 |
| 打开库的行为 | `library_service.py` 的 `LibraryService.__init__` | 初始化会迁移、补索引并安装 revision trigger；不能当作真实库的只读探测 |
| 精读流水线 | `reading_pipeline.py`、`reading_pipeline_models.py` | 合同 `reading-pipeline-v1`；获取 PDF、MinerU、翻译、Reader、派生更新五阶段 |
| 持久恢复 | `background_*`、pipeline 状态与库活动指针 | job JSON、pipeline JSON、SQLite 指针和 source SHA 要一起核对 |
| 产物 | full-read/review、MinerU 和 manifest 模型 | 保持 `full-translation-v3`、`full-review-v2/v3`、`mineru-normalization-v4`、`generation-package-manifest-v1` 可读 |
| 文献备份 | `library_backup.py` | 包含 generations 和未完成 jobs；排除凭据；恢复不自动续跑，且会迁移至当前 schema |
| 宿主入口 | `src/cli.ts`、`src/engine_scope.ts` | 保持 `engineJson`、`engineStartFullRead`、`engineContinueFullRead`、`engineAttachAndResumeFullReadPdf`、`withEngineScope` 合同 |

旧本地 `dsh reader` 的版本和 schema 与该基线不同，且含用户未提交改动，不能作为复现环境。

## 候选逻辑模块

先登记边界，再按任务抽离；此表不是要求一次搬动所有实现。

| 职责 | 现有实现 |
| --- | --- |
| 文献库、身份与资产 | `library_service.py`、`library_schema.py`、`workspace.py`、`scope.py`、`data_guard.py`、`package_manifest.py` |
| 持久精读作业 | `reading_pipeline.py`、`reading_pipeline_models.py`、`worker.py`、`background_*` |
| 获取与解析 | `pdf_acquisition.py`、`pdf_validation.py`、`mineru_*`、`normalization_upgrade.py` |
| 翻译、Reader 与审核 | `full_read_service.py`、`full_read_models.py`、`full_read_renderer.py`、`review_service.py`、`engine/reader/build_reader.py` |
| 衍生输出与宿主适配 | `derived_pipeline.py`、`export_service.py`、`xlsx_snapshot.py`、`src/cli.ts`、`src/routes.ts`、`client/client.js` |

首个候选实现改动是利用已有 `stage_runner` 注入点抽离默认阶段适配器。保持 `start/advance/inspect`、父 job 标识、阶段顺序及 `background_store` 不变；不同时调整解析策略或 TypeScript 接口。

已有相关测试包括 `test_reading_pipeline_integrity.py`、`test_worker_full_read.py`、`test_mineru_parse_gate.py` 和 Node full-read-pipeline/full-read-routes 测试。这里只核实其存在，不代表已运行通过；具体执行分组由 V02-002 固定。
