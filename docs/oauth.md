# Codex 订阅接入

本组件只为 B 实例注册 `openai-codex` 原生 DSH provider。普通模型设置继续由 DSH 管理；本组件不改默认模型。用户已授权继续工程并采用现成实现，实施范围为 `oauth/` 和本文档。

选型：复用 [DGPisces/dsh-openai-oauth](https://github.com/DGPisces/dsh-openai-oauth/tree/0db2b77aa69c4e8ee4e4c40ed5462a086fe4300f) 0.4.0，MIT，固定提交 `0db2b77aa69c4e8ee4e4c40ed5462a086fe4300f`。其依赖为官方 `@openai/codex` 0.146.0。另一候选 birat-chapagain/dsh-codex-oauth 使用 pi-ai OAuth；本机 dsh-codex 默认读取外层 auth 文件，不符合 B 的独立凭据边界，因此本次未采用。

设计合同：B 提供绝对 `stateRoot`，凭据目录固定为其 `codex-home` 子目录。官方 app-server 负责浏览器登录、凭据落盘和刷新。调用方仅获得认证状态、计划类型、模型名称和额度视图，不获得凭据或账户邮箱。退出、取消登录也调用 app-server 方法。

依据：[官方 app-server 文档](https://learn.chatgpt.com/docs/app-server) 定义 `account/read`、`account/login/start`、`account/login/cancel`、`account/logout` 和 `account/rateLimits/read`。额度是账号共享；`usedPercent` 为已用百分比，剩余值为 `100 - usedPercent` 并限制于 0–100。字段缺失时返回 `unavailable`。

## 父运行时接入

rc.5 修复了旧启动器只解析 Windows x64 程序的问题；现在按 Windows x64、macOS x64/ARM64、Linux x64/ARM64 选择官方固定版本的原生包。CI 在五个平台使用全新隔离目录启动真实 app-server 并检查未登录状态，不继承外层凭据，不进行付费模型调用。本人浏览器授权另行验收。

包名与版本为 `codex-scientific-reading-oauth@0.1.0-rc.3`。父安装器把本目录的发布文件复制到 npm 根下的 `oauth/`，由父 runtime 声明 `file:oauth` 依赖；无需运行上游全局安装器。依赖为官方 `@openai/codex@0.146.0`，宿主 peer 为 `@deepseek-ai/cordis@4.0.1` 与 `@deepseek-ai/dsh-llm@0.1.0-rc.7`。开发用的原始 rc.7 依赖单独列在本包 devDependencies。

包的 `cordis.patch.yml` 插入 `scientific-reading-codex` 行。父 profile 在该行指定：

```yaml
- id: scientific-reading-codex
  config:
    stateRoot: 'D:/目标工作台/state'
```

`stateRoot` 必须为安装根下的稳定 state 目录，不应指向不可变 release 代目录。官方进程的工作目录和 `CODEX_HOME` 均为 `<stateRoot>/codex-home`。固定使用文件凭据存储和 ChatGPT 登录方式；环境变量采用系统/代理变量白名单，排除外层 API key、Codex 配置覆盖及会话标识。不会自动设置 `agent-default-model`。

原生 provider id 为 `openai-codex`。登录成功后，模型清单来自官方 `model/list`；用户在 DSH 的普通模型选择器选择实际返回的模型，reasoning effort 也来自动态元数据。当前桥接支持文本和 DSH 动态工具；图像以及 app-server 没有暴露的 `temperature`、`stop`、`maxTokens` 会明确返回不支持。

## 用户入口与 API

在 `/__workbench` 增加“Codex 订阅与额度”链接，目标为同服务的 `/api/codex-oauth/ui`。该页提供用户触发的登录、授权页链接、取消登录、退出与额度刷新；它不创建独立后台，也不会替用户完成授权。

| 方法 | 路径 | 返回 |
| --- | --- | --- |
| GET | `/api/codex-oauth` | `status`、`authenticated`、`provider`、`planType`、`models`、`login` |
| GET | `/api/codex-oauth/usage` | `status`、`scope: account`、`sharedAcrossClients: true`、`buckets` |
| POST | `/api/codex-oauth/login` | 一次性 `authUrl`、`loginId` 与 pending 状态 |
| POST | `/api/codex-oauth/cancel` | `canceled` 或 `not_found` |
| POST | `/api/codex-oauth/logout` | `unauthenticated` |

API 只接受 loopback 与同源访问；响应禁止缓存。授权 URL 仅传给用户页面，状态接口不返回它、不返回邮箱或凭据，错误接口不输出官方原始错误载荷。

需要独立控制时可从包入口调用：

```js
import { createOAuthRuntime } from 'codex-scientific-reading-oauth'
const oauth = createOAuthRuntime({ stateRoot: absoluteInstanceState })
await oauth.start()
await oauth.control.status()
await oauth.control.usage()
await oauth.stop()
```

`stop()` 先取消待完成登录，然后关闭 native 子进程。应用正常关闭先送 stdin EOF 让官方程序清理，超时才终止自己启动的进程。

## 会话恢复与工具连续性

DSH 是对话记录的持久来源。每次模型结束返回标准 `replayState: {response: ...}`，其中保存版本 2、threadId、turnId、模型、工具 schema 摘要和待完成 callId。下一次启动从 `assistant.source.replayState.response` 取回指针，用官方 `thread/resume` 恢复；不会解析、复制原生会话文件。

如果原生会话记录缺失，或中间使用了其他 provider，适配器把 DSH 已有完整文本/工具对话作为历史上下文带入新的原生会话。中断工具流程有已确认结果时，先中断旧 turn，使用这些结果续跑。恢复期间出现相同工具与参数的重发时，直接向官方进程回复已保存结果，不再次交给 DSH 执行。缺少持久化结果的中断调用返回 `RECOVERY_REQUIRES_TOOL_RESULT`，必须先核实结果。

## 来源与验证

源码继承与原始文件 SHA-256 记录于 `oauth/provenance.json`。官方 CLI 对应 `rust-v0.146.0` 的实际提交为 `e363b08c9175ac1cbe5893615dd2cb9ddf95043b`，Windows x64 二进制 SHA-256 为 `bc343ba420dc2e2e9f59e6fc5e5bf0aae1cd8c771fc319665241fc9c0271fddb`。安装依赖的 tarball integrity 固定在本目录 package-lock.json。自有代码沿用项目 BSD-3-Clause，社区适配器 MIT，官方 CLI Apache-2.0，许可证保留在包内。

已按测试先失败再实现的顺序完成未登录/认证方式、额度值、loopback HTTP 边界、真实子进程 JSONL 协议、超时/退出、多轮动态工具、重启恢复、provider/模型切换、已确认工具结果防重复回归。测试使用原始 npm DSH rc.7 的类与包，不借用用户已有 DSH 的补丁代码。

真实 Node 22.22.2 + 官方 Codex 0.146.0 在全新中文路径 state 上通过：未登录 `account/read`、额度 unavailable、取消不存在登录返回 notFound、退出后仍未登录、未创建 auth.json，以及 native 进程停止。官方 `thread/start` 接受本地动态工具 schema，但零 turn 的空会话没有原生 rollout，因此本阶段不能用它证明完整原生会话恢复成功。离线持久恢复和工具回归单独通过，证据分别保存在 `oauth/test-results/`。

真实用户登录、有效账号额度、授权后模型响应、已完成 turn 的原生恢复和 token 刷新，必须在用户自行授权后验证；本阶段不会声称这些已通过。父任务负责候选包实际安装、原生模型选择器与内置浏览器的整体验收。

发布包仅包含根下运行模块、package.json、cordis patch、README、provenance 和 vendor 许可证/适配源码，不包含 tests、test-results、node_modules、临时 schema 或任何 state。
