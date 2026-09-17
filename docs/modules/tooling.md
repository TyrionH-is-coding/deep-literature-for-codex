# Tooling：模块检查与交付证据

负责模块登记、开发命令、测试、发布脚本、CI 和项目文档。版本与路径见 [`catalog.json`](../../src/modules/catalog.json)，变更记在 [tooling 记录](changes/tooling.md)。它不是安装实例里的领域服务。

## 命令与数据

公共入口为 [`scripts/modules.mjs`](../../scripts/modules.mjs)，通过 `npm run modules -- <命令>` 调用：

- `list`：模块 id、版本、职责和静态依赖。
- `context <id>`：基线、当前 commit、Git 状态、阅读入口、依赖接口、影响范围与该模块说明。
- `impact --base <git-ref>`：比较基线与工作区，计入未跟踪文件；返回修改模块、传递调用方和未归属文件。
- `test <id|all>`：先检查边界，运行目标和静态/运行时下游登记的测试；OAuth 测试在自己的包目录运行。
- `check`：检查登记文件、路径归属、静态依赖无环、生产导入边界、动态导入例外和部分包/引擎版本一致性。
- `snapshot`：向标准输出打印各模块版本、文件列表、SHA256、依赖与当前 commit/dirty 信息；需要留存时由调用方保存输出。

[`module-graph.mjs`](../../scripts/module-graph.mjs) 使用 Acorn 解析导入与导出，检查生产模块边界。非字面动态导入需在登记中给出明确例外；运行时拼接的配置、子进程、插件和资源路径仍需集成验证。快照不包含被遍历器排除的输入制品，其引擎信息来自 pins 对应登记；快照不代表测试通过。

## 依赖与阅读范围

登记没有静态领域上游；运行时影响关系覆盖全部模块，以便基础变动纳入工具测试。工具脚本可以为测试与发布读取各模块。根开发依赖包含 Acorn，和安装 runtime 的 npm 锁分开维护。

检查器问题只读 catalog、module-graph、modules CLI 与 `tests/modules.test.mjs`；旧路径兼容问题加读 `tests/module-compatibility.test.mjs`。打包问题再读对应 release/acceptance 脚本与 CI，不默认运行所有外部验收。

## 验证边界

`npm run modules -- test tooling` 运行登记的 `tests/modules.test.mjs` 与 `tests/module-compatibility.test.mjs`。检查命令或测试选择规则修改时，实际验证成功与失败样例及影响传播；发布清单/运行路径变更时再验证打包和隔离安装。本文不声明任何当前测试结果。

静态检查只覆盖实现支持的规则，不能代替 OAuth 行为、引擎内部测试或真实业务验收。未归属文件必须人工判断影响，不可推断“无需测试”。
