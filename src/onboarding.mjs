export const setupSteps = [
  '在新的 Codex 对话中使用 $deep-literature-for-codex 打开工作台，核对 start 返回的实际 URL。',
  '选择模型接入：配置本实例的 DSH 原生模型 API，或打开实际 URL + /api/codex-oauth/ui，点击“使用 ChatGPT 登录”及“打开 OpenAI 授权页”，由本人完成 Codex OAuth。',
  'Codex OAuth 登录成功后，在 DSH 模型选择器选择 OpenAI Codex 和账号可用的模型；外层 Codex 登录不会自动接入本实例，同账号额度共享。',
  '需要全文解析时，在“设置与状态”保存 MinerU API Token。安装完成不代表模型与 MinerU 已配置。',
];
