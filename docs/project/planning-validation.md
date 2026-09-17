# 总控资料与打包验证记录

日期：2026-09-17。被验证实现提交：`3928ec9ceb5a760ec34cbebb4cc1a39bb329219b`。本记录随后追加，不属于下面这个验证包。

## 已执行

环境：Windows，开发命令使用 Node `24.18.0`；此处没有启动产品锁定的 Node `22.22.2` 运行时。

| 检查 | 实际结果 |
| --- | --- |
| `npm run check:modules` | 10 个模块、47 个生产源码文件、152 条导入，检查通过 |
| `npm run modules -- impact --base 4eef8bfef84c4f52a12e9a56a2949ce149226fc6` | 本轮只影响 tooling；无未归属文件 |
| `npm run test:modules` | 20 通过，0 失败，0 跳过 |
| 本地文档链接、任务 ID、模块名、依赖无环和并发限制检查 | 通过；8 条台账记录，仅 V02-001 为 ready |
| 独立只读计划复核 | 已修正任务资料缺失、失败归因对照、候选重构范围过大三处问题；复核通过 |
| `git diff --check` | 通过 |

打包命令：`node scripts/package-release.mjs outputs/v02-control-package-check inputs/scientific-reading.tgz win32-x64`。

- 包来源：上述 `3928ec9`，仍使用 rc.6 产品版本，**只是本地打包检查，没有发布或安装**。
- ZIP SHA-256：`9e91166dbf7cadaf42348b821e8dafe7d11a14f1792ce9174763f38543d46118`。
- 固定引擎包 SHA-256：`318814ec542de94a47cd2855b21d0f7af9778b22b283d3995d0c499a3465e2fd`，实际字节校验通过。
- 压缩后重新解包并验证 162 个文件（161 个清单源文件加 BUILD-MANIFEST）；总控入口、台账和任务卡均在包内。
- 对解包目录再次运行模块检查，并重算 moduleSnapshot，与 BUILD-MANIFEST 中模块指纹一致。

## 未执行

没有验证新候选真实 DSH 安装、登录、真实模型/MinerU、论文阅读质量，也没有运行固定引擎源码测试。引擎源码到既有 tarball 的构建对应关系仍需 V02-002 审计；摘要吻合只说明拿到了 pins 所指的字节。

V02-001 尚未创建开发 session，尚未执行。旧的 104 项通过结果属于模块化基线的已有记录，不当作本轮重新运行结果。上述打包检查也不等于 v0.2 发布验收。
