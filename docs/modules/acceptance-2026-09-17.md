# 模块化基线验收（2026-09-17）

基线：`v0.1.0-rc.6`，回退提交 `e7160eb`。实现位于 `codex/modular-foundation`。

## 分步变更

- `93a3efc`：从混合 core 提取 foundation 与 skill，保留兼容入口。
- `c55d748`：隔离 workflow、bridge、lifecycle、releases；新增旧 API 与异地导入验证。
- `16b4d84`：模块登记、上下文、依赖检查、测试选择与打包清单。
- 后续验收记录提交仅补充本记录与登记；具体 commit 以 Git 历史为准。

## 已实际执行

- 在 Windows x64 的 Node 22.22.2 执行 `scripts/modules.mjs test all`：工作台 71 通过、1 POSIX 专属测试跳过；OAuth 33 通过。共 104 通过、1 跳过、0 失败。
- 模块检查：10 个登记模块，47 个生产源文件，152 个导入；禁止静态依赖环、跨模块私有导入和未审查动态导入。静态检查不是执行沙箱，不能覆盖任意反射或运行时代码生成。
- 兼容性：旧导出列表与对象身份、桥接插件注册合同保持；整个 src 复制到带中文及空格的临时目录，独立 cwd 导入成功；导入库接口不启动 supervisor。
- `context workflow` 与 `impact --base v0.1.0-rc.6` 正常，当前变更均有模块归属。
- 下载并校验原有 rc.5 引擎制品，SHA 与 runtime/pins.json 相同；没有改动引擎版本。
- 在 `16b4d84` 构建本地 Windows 验证包；解压后 152 个文件通过逐一 SHA 校验。BUILD-MANIFEST 和 RELEASE-MANIFEST 含实际打包模块版本、文件清单及内容 SHA。此后文档提交可用同一打包命令重新验证，制品 SHA 以对应输出为准。

## 验证边界

没有修改用户已安装的工作台、文献库或认证配置；没有调用真实模型或 MinerU；没有做本次候选的真实 DSH 全新安装与浏览器端到端验收。跨平台 CI 已接入检查，但本地 Windows 结果不等于 macOS/Linux 验收。

产品版本仍为 rc.6 开发基线。本地验证包不是新的正式 Release，不应覆盖 GitHub 上已有 rc.6 制品。发布新版本前需要新版本号、真实安装验收，以及锁定整套模块和引擎组合。
