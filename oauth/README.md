# Codex 订阅适配组件

`codex-scientific-reading-oauth@0.1.0-rc.1` 为 B 注册原生 `openai-codex` provider。它保留 DSH 的模型选择与工具执行流程；登录不会改变默认模型或转为 API 计费。

复用 [DGPisces/dsh-openai-oauth 0.4.0](https://github.com/DGPisces/dsh-openai-oauth/tree/0db2b77aa69c4e8ee4e4c40ed5462a086fe4300f) 的 MIT 适配器，固定提交 `0db2b77aa69c4e8ee4e4c40ed5462a086fe4300f`。官方依赖固定为 `@openai/codex@0.146.0`（Apache-2.0，对应提交 `e363b08c9175ac1cbe5893615dd2cb9ddf95043b`）。B 自有代码沿用项目 BSD-3-Clause；第三方许可证保留于 `vendor/`，原始文件摘要见 `provenance.json`。

DSH bundle 行 id 为 `scientific-reading-codex`，配置必须指定绝对 `stateRoot`，例如 `<B安装目录>/state`。`CODEX_HOME` 固定为它的 `codex-home` 子目录，不读取或复制外层 Codex 凭据，也不继承外层 API key。

用户入口为同一 DSH 服务的 `/api/codex-oauth/ui`，包含状态、登录、取消、退出和账号共享额度。登录由用户在 OpenAI 页面完成。缺失额度显示为不可用；已用 25% 对应剩余 75%。

重启时从 DSH 持久化的 `assistant.source.replayState.response` 恢复官方原生会话。原生记录缺失或切换 provider 时，用完整 DSH 对话重建上下文。已确认的工具结果用于续跑；中断但没有持久化结果的调用需要先核实，不会自动重做。

开发验证：在本目录运行 `npm ci --ignore-scripts --legacy-peer-deps`，然后 `npm test`。测试依赖固定为原始 DSH rc.7，不修改全局安装。`node tests/live-unauthed.mjs` 只验证真实官方二进制的未登录流程。`node tests/live-local-resume.mjs` 只创建本地空会话，不启动模型 turn，并明确记录完整恢复是否可验证。

完整接入合同与验收边界见项目 `docs/oauth.md`。真实账号登录、授权后模型推理、有效额度与 token 刷新由用户本人授权后验收。
