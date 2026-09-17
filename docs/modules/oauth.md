# OAuth 模块

负责本工作台自己的 Codex 订阅认证、原生 provider、账号额度视图及原生会话续接。生产实现保持在 [`oauth/`](../../oauth/)，现有 npm 包 `codex-scientific-reading-oauth` 的版本为 `0.1.0-rc.3`。产品 rc.6 与此包版本不同是正常情况。详细接入合同见 [`docs/oauth.md`](../oauth.md)。

## 公共合同

| 边界 | 当前合同 |
| --- | --- |
| npm 导出 | `.` → `index.mjs`，`./control` → `control.mjs`，以及 `./package.json` |
| Cordis 插件 | 行 id `scientific-reading-codex`；由 `apply(ctx, config)` 注册 |
| 模型 provider | `openai-codex`；不改变 DSH 默认模型 |
| HTTP | `/api/codex-oauth` 下的状态、登录、取消、退出、额度与 `/ui` 页面 |
| 状态目录 | 调用方提供绝对 `stateRoot`；固定使用其 `codex-home` 子目录 |
| 运行依赖 | `@openai/codex@0.146.0`；宿主 Cordis `4.0.1` 和 DSH LLM `0.1.0-rc.7` |

父安装器将此目录复制到安装代的 `runtime/npm/oauth`，父 runtime 使用 `file:oauth` 依赖。宿主通过插件配置注入稳定的实例 `stateRoot`，凭据不放入不可变发布代目录。跨模块工作默认只读这些合同和相关测试；只有修改认证内部行为时才读取传输层、adapter 或 vendor 实现。

生产相对导入应留在 `oauth/` 内部，调用方使用包导出。测试中的 `tests/local-model-fixture.test.mjs` 依赖仓库 `scripts/fixtures/local-model.mjs`，这是本地集成验收夹具，不是生产依赖。

## 保持的行为

- 官方 app-server 负责 ChatGPT 登录、凭据管理和刷新；不读取或复制外层 Codex 凭据，不自动转向 API key 计费。
- 账号切换、取消、退出、额度不可用等状态保持现有语义；缺失额度不是零使用量。
- 模型和 reasoning effort 来源于官方运行时返回值。
- 持久 replay 信息与 DSH 对话共同支持恢复；未知结果的中断工具调用不能盲目重放。
- HTTP 的回环、Host、Origin、缓存和错误脱敏边界保持不变。

模块重组本身不需要更换官方 Codex 版本、迁移凭据、启动登录或触发模型调用。上述任一行为变化都应作为明确的 OAuth 变更审查。

## 验证与追溯

先运行 `npm run modules -- context oauth`。依赖已安装时，使用 `npm run modules -- test oauth` 验证模块及受影响调用方；单独执行包内单测可使用 `npm --prefix oauth test`。根 `npm test` 只覆盖工作台测试，不能替代 OAuth 套件。

干净开发检出需要先在本包准备锁定依赖，例如 `npm --prefix oauth ci --ignore-scripts`。这属于开发环境安装，不修改用户已安装的实例。套件包括认证控制、HTTP、进程传输、平台可执行文件解析、provider、工具往返、会话连续性及本地验收夹具。CI 已配置五个平台的独立 OAuth 检查，不能据此假定当前未提交代码已通过。

传输、可执行文件选择或包装方式变化时，还需执行 `npm --prefix oauth run test:live-unauthed`：它使用全新隔离目录测试官方二进制的未登录状态，不启动登录或模型 turn。真实登录、额度读取、token 刷新和授权后推理是不同层次的验收，必须分别记录实际结果。

版本或依赖改变时同步检查：

1. `oauth/package.json` 与 `oauth/package-lock.json`。
2. `runtime/package.json` 的 `file:oauth` 以及 runtime lock 中的 `oauth` 包记录和链接。
3. 发布清单、固定依赖、第三方许可证与 `oauth/provenance.json` 的适用范围。
4. 插件 id、公共导出、HTTP、状态目录及 replay 合同的兼容性。

源码恢复可按本模块提交追踪；运行环境恢复仍选择一致的完整发布。不要单独替换安装目录中的 OAuth 文件或回退 `codex-home` 凭据来尝试修复代码问题。本文没有宣称本轮单测、真实登录或模型调用已经通过。
