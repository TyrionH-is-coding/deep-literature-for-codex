# MinerU API Key 获取与配置教程

[返回使用指南](../README.md)

MinerU 负责把论文 PDF 解析成正文、图表和公式；工作台中的模型负责后续翻译与导读。首次使用云端解析，需要把你自己的 **MinerU Token** 保存到工作台的 **MinerU API Key** 输入框中。

## 1. 注册或登录 MinerU

打开 [MinerU 官网](https://mineru.net/)，按网站提示注册或登录自己的账号。随后进入 **API 管理 → Token**。如果找不到入口，可从 [官方 API 文档](https://mineru.net/apiManage/docs) 进入 API 管理页面。

官方的账号操作流程也可参照 [OpenDataLab 的 MinerU 在线 API 实战教程](https://github.com/opendatalab/mineru-tutorials/blob/main/03%E8%AF%BE%EF%BC%9AMinerU%20%E5%9C%A8%E7%BA%BF%20API%20%E5%AE%9E%E6%88%98%E6%95%99%E7%A8%8B/03%E8%AF%BE%EF%BC%9AMinerU%20%E5%9C%A8%E7%BA%BF%20API%20%E5%AE%9E%E6%88%98%E6%95%99%E7%A8%8B%20-%20%E6%96%87%E6%A1%A3.md)。页面布局可能调整，以官网当前显示为准。

## 2. 创建并复制 Token

在 API 管理页面查看自己的 Token；尚未创建时，按页面提示创建。如果当前账号需要先申请 API 权限，按页面要求完成申请，再继续。

复制得到的 **Token 本身**。工作台会自动添加 API 请求所需的认证格式，所以输入框里不要再添加 `Bearer`、引号或整段示例代码。不要填成模型服务的 API Key，也不需要从浏览器提取 Cookie。

本工作台使用需要 Token 的精准解析 API。官网另外提供的免 Token 轻量接口，不能直接替代这里的配置。账号额度、有效期和文件限制请查看自己的 API 管理页面与 [官方文档](https://mineru.net/apiManage/docs)，不要把某个教程中的固定额度当作长期承诺。

## 3. 保存到 Deep Literature for Codex

回到 **外层 Codex 对话**，发送：

```text
请打开 Deep Literature for Codex 的“设置与状态”页面。
我已经在 MinerU 官网取得 Token，我来填写并保存。
保存后请检查配置状态。
```

在工作台页面完成以下操作：

1. 找到 **“全文解析”** 卡片。
2. 在 **“粘贴 MinerU API Key”** 输入框中粘贴 Token。
3. 点击 **“保存密钥”**；替换已有配置时点击 **“替换密钥”**。
4. 看到已保存的提示，确认 API 状态显示已配置。

Token 保存在当前系统的凭据库中：Windows 使用 DPAPI，macOS 使用 Keychain，Linux 使用 Secret Service；配置差异见 [平台指南](platforms.md)。直接在输入框填写即可，不必发到聊天、截图或 GitHub Issue 中。迁移到另一台机器后需要重新配置，文献备份不包含这项凭据。

## 4. 用第一篇论文确认能正常解析

**保存和“重新检测”用于检查配置状态，不会代你发起真实解析。** 要确认 Key 与服务都可用，继续 [README 的第一篇论文流程](../README.md#第三步获取并精读第一篇论文)：

```text
MinerU Key 已保存。请继续刚才那篇论文的原任务，
用它已取得的 PDF 进行 MinerU 解析，并报告实际解析结果。
需要模型翻译时使用本工作台已选定的模型，完成后打开 Reader。
```

如果还没有任务，先按 README 入库一篇论文并取得 PDF。使用 MinerU API 会把该 PDF 发送到 MinerU，并使用自己账号的解析额度。

以任务中真实解析成功、取得解析结果为验证依据；保存密钥成功或聊天中说“配置好了”，都不表示 PDF 已经解析成功。解析完成后仍需模型完成翻译、复核和 Reader 生成。

## 常见问题

| 现象 | 怎么处理 |
| --- | --- |
| 已登录 MinerU 网页，工作台仍提示未配置 | 在官网 API 管理页面创建或复制 Token，再保存到本工作台；网页登录与工作台配置是两步 |
| Token 错误 / A0202 | 重新复制完整 Token，检查有没有误加 `Bearer`、引号或示例代码，必要时创建新 Token 后替换 |
| Token 过期 / A0211 | 到官网更新 Token，在工作台点击“替换密钥”，然后继续原任务 |
| 已配置，但尚未验证 | 正常；发起一篇有 PDF 的真实解析后，再看任务结果 |
| 提示额度、限流或服务繁忙 | 查看官网账号状态与任务错误，按提示等待或调整后继续原任务；反复重装工作台不能恢复账号额度 |
| 文件无法读取、超限或网络失败 | 确认是可打开的正文 PDF，检查文件大小、页数和网络；具体限制以官网当前文档为准 |
| PDF 已解析，但没有双语 Reader | 检查工作台自己的模型配置和当前任务阶段，继续翻译与复核 |

错误码解释参考 [MinerU 官方 API 文档](https://mineru.net/apiManage/docs)。更换密钥后继续已有任务即可，不需要为同一篇论文重复入库。

官网获取流程与 API 文档核对日期：2026-09-07。
