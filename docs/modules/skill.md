# Skill：托管安装与定制保护

入口为 [`index.mjs`](../../src/modules/skill/index.mjs)，实现为 `manager.mjs`，发布内容来自 `skills/`；版本和路径见 [`catalog.json`](../../src/modules/catalog.json)，变更记在 [skill 记录](changes/skill.md)。

## 接口与数据

- `installSkill(source, skillsRoot, root)`：安装到 `skillsRoot` 下固定 Skill 名称，生成实例 `installation.json`、`location.txt`。返回安装路径与复用/更新结果；遇到用户修改返回 `retained_custom_changes`。
- `removeManagedSkill(root)`：根据安装回执核对目标及所有文件摘要，只移除仍由当前实例管理且未修改的目录；返回移除、缺失或保留状态。

拥有 `<root>/state/installed-skill.json` 回执、`state/skill-backups/` 备份，以及指定 Skill 目标下托管的文件。回执记录目标和每个文件摘要。更新使用暂存目录；不接管 skillsRoot 中其他 Skill。文献与登录状态不属于本模块。

## 依赖与阅读范围

上游为 `foundation` 的产品常量、JSON 工具；下游为 `application` 的安装/CLI 与 `releases` 的退役流程。先读取入口、管理器和本次涉及的 Skill 文本；仅在实例标记或路径变化时继续读取 foundation。

## 验证边界

`npm run modules -- test skill` 覆盖模块及下游；登记测试为 `tests/core.test.mjs`、`tests/install.test.mjs`。测试关注幂等安装、托管更新、用户修改保护和安装组合，不代表当前已执行。

修改 Skill 名称、回执格式、目标路径、迁移或移除规则时，应扩大到安装、更新和退役场景；修改共享基础工具需检查 foundation 的其他调用方。单纯改 Skill 操作说明时核对真实 CLI 和产品行为，避免把旧计划或权限假设写成指令。
