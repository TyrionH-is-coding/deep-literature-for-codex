# 用 Excel 长期管理文献

[返回使用指南](../README.md)

**scientific-reading.xlsx 是持续更新的文献总表。** 你可以用它筛选积累的论文，打开已有 PDF、Reader 和图表，在每篇论文旁写下自己的理解与下一步计划。三列个人记录在同步后会保存在本地文献库中，下次刷新总表时继续保留。

一个日常流程是：**Codex 入库与分类 → 获取全文并精读 → Excel 筛选与记录 → 保存关闭 → 同步 → 下次回顾。**

## 1. 找到并打开总表

在工作台文献列表中找到论文，点击 **“定位 Excel”**，或在 Codex 对话中发送：

```text
请打开 Deep Literature for Codex 当前实例的 scientific-reading.xlsx 文献总表。
我要查看已有论文并记录阅读笔记。
```

默认文件位置为：

```text
%USERPROFILE%\CodexScientificReading\library\library\scientific-reading.xlsx
```

这是当前发行版的实际目录结构，包含两层 `library`。如果安装时指定了其他根目录，替换前面的 `%USERPROFILE%\CodexScientificReading`，后面的相对路径不变。

macOS/Linux 默认路径是 `$HOME/CodexScientificReading/library/library/scientific-reading.xlsx`。macOS 使用 `open "总表绝对路径"`，Linux 桌面使用 `xdg-open "总表绝对路径"`；没有图形桌面或关联软件时保留路径供用户取用。macOS/Linux 当前只打开工作簿，按论文名或文献 ID 查找，不提供自动选行。

可以将路径粘贴到资源管理器地址栏打开。需要本机安装关联 XLSX 的表格软件；建议使用 Excel 桌面版。**“定位 Excel”在支持 Excel 自动化时会选中该论文的行；否则只打开工作簿，请使用查找定位论文名。**

首次入库或后台更新尚未结束时，总表可能还未生成，按下面的刷新步骤生成即可。没有 Excel 也能使用工作台和 Reader。

## 2. 用哪张表做什么

| 工作表 | 内容与用途 |
| --- | --- |
| **文献** | 每篇论文一行：题名、作者、年份、期刊、DOI、分类、标签、中英摘要、阅读状态、个人记录及文件链接 |
| **图表资产** | 已有解析结果中的图表清单、中文与原文图注、PDF 页码、图片或表格路径、Reader 定位 |
| **整理结论** | 整理会话中经你明确确认的结论、证据位置与确认时间；可追溯到相应论文和会话 |
| **说明** | 字段归属和同步规则 |

已有资产对应的 **PDF 路径、精读 HTML、图表资产路径** 提供可点击链接。尚未下载、解析或生成 Reader 的论文，对应位置可能为空；总表不会凭空补齐成果。

整理结论需要先在工作台的论文整理会话中讨论并确认，不会把任意聊天自动保存为正式结论。可以让 Codex 帮你打开对应论文的整理会话，讨论后再确认需要保留的内容。

表头中的“主要研究单位、影响因子、学科领域、主要内容、解决方法、实验假设、创新、不足之处”目前是预留字段，本版不会自动填充，也不支持从 Excel 回写。需要长期保存的个人分析，请先写入三列个人记录。

## 3. 写下自己的思考与笔记

在 **“文献”** 表的浅黄色单元格中填写：

| 可编辑列 | 示例 |
| --- | --- |
| **个人思考** | “这套方法适合我的小样本场景，需要验证跨数据集效果。” |
| **个人理解程度** | “已通读，推导待复习”或“已精读，准备复现”；当前是自由文本 |
| **用户笔记** | “下周核对 Figure 3 的对照组；与 DOI 为……的论文比较。” |

只有这三列支持回写。题录、分类、标签、阅读状态和资产路径由工作台维护；例如修改分类或标签，可以对 Codex 说：

```text
把这篇论文移动到“课题 A”分类，并加上“待复现”标签。
```

使用表头筛选可以只看某个年份、分类或理解程度。原表启用了工作表保护；保留列名、文献 ID 与行顺序，不要解除保护后排序、增删行或替换隐藏的身份表。当前同步会核对行与论文的对应关系，改动后可能暂停同步。

如果要自定义排序、增添统计列、画图或做透视表，请另存一个分析副本。**副本用于自己的分析，不会自动回写工作台；个人记录请编辑原总表。**

## 4. 保存、关闭，再同步

1. 在 Excel 中保存原工作簿。
2. 关闭工作簿，释放文件占用。
3. 让 Codex 执行当前实例的 Excel 刷新并检查结果：

```text
我已经保存并关闭 Excel 总表。
请按 docs/excel-library.md 的手动刷新步骤，
导入三列个人记录并刷新当前实例的总表。
确认返回 status 为 success，再打开总表让我检查。
```

**刷新顺序是：读取已保存的个人记录 → 写回文献库 → 根据当前文献库生成总表。** 入库、精读和确认整理结论的流程也会安排总表更新。Excel 编辑不是实时同步；改完笔记后主动刷新，可以立即确认是否写回成功。

### 手动刷新命令（也可交给 Codex 执行）

当前版本没有独立的“同步 Excel”页面按钮。下面使用安装包自带的文献引擎刷新，不需要安装系统 Python。

下面是 Windows 命令，macOS/Linux 使用 [平台指南中的刷新命令](platforms.md#excel-与默认文件打开)。先保存并关闭工作簿，再在 PowerShell 中执行。自定义安装目录的用户修改第一行：

```powershell
$readingRoot = Join-Path $env:USERPROFILE 'CodexScientificReading'
$readingInstall = Get-Content -LiteralPath (Join-Path $readingRoot 'installation.json') -Raw | ConvertFrom-Json
& $readingInstall.python -I -X utf8 -m scientific_reading --data-root (Join-Path $readingRoot 'library') xlsx-refresh
```

查看返回 JSON 中的 **`status`**：

- `success`：个人记录已导入，总表已刷新，`path` 是文件路径，`rows` 是论文行数。
- `pending`：保留待同步状态，按 `error` 修正后重试。
- `failed`：刷新失败，保留错误信息让 Codex 检查。

不要只看命令有没有退出报错。打开总表前先确认 `status`，然后查看刚才编辑的记录和最新阅读状态。

## 5. 每次读完后，怎样持续积累

1. 在 Codex 中把新论文归入已有分类，重复论文复用已有记录。
2. 需要细读时生成 Reader，已有 Reader 可以直接再次打开。
3. 在总表中记录个人理解程度与下一步计划；保存关闭后同步。
4. 下次打开总表，筛选自己的理解程度或分类，找到需要复读、比较、复现的论文，从对应链接继续阅读。
5. 有需要长期引用的整理结论时，在整理会话中确认结论与证据，再查看“整理结论”表。

这样积累的是论文、阅读成果和自己的判断；换一轮聊天仍可以从持久文献库恢复。

## 6. 待同步、文件占用和记录冲突

| 现象 | 处理方式 |
| --- | --- |
| 提示工作簿未生成 | 确认已有文献，再执行上述刷新命令 |
| Excel 打开着，更新处于 pending | 保存并关闭文件，重新刷新；PDF、Reader 和已完成任务不会因这次表格同步失败而回滚 |
| xlsx_in_use | 检测到 Excel/LibreOffice 占用标记，原表保留。先正常保存并退出表格软件；不要让 Codex 自动删除标记。部分软件不生成标记，仍需先保存关闭 |
| 保存后没看到最新笔记 | 确认编辑的是本实例的原总表，文件已经保存，再刷新并检查 `status` |
| 身份冲突 / xlsx_identity_conflict | 保留原文件和笔记，让 Codex 检查被改动的文献 ID、行顺序或重复行；不要直接删除总表重建 |
| 表头或工作表缺失 | 恢复原列名及工作表结构后再刷新，系统会保留原工作簿等待处理 |
| 打开总表但没有自动选中论文 | 按论文名或文献 ID 查找；自动选行依赖本机 Excel 自动化支持 |
| 文件链接打不开 | 检查对应 PDF/Reader 是否已生成，是否移动了库目录或只复制了 XLSX |

## 7. 备份与换机

**XLSX 只包含总表内容和资产链接，不能代替完整文献库备份。** 换机时需要一起保留数据库、PDF、解析结果、Reader 与任务记录。

备份前先保存关闭 Excel，并成功执行一次刷新，让个人记录进入文献库。然后让 Codex 调用本实例引擎的 `library-backup`，或在上面已经定义了 `$readingRoot`、`$readingInstall` 的 PowerShell 中执行：

```powershell
$readingBackup = Join-Path $env:USERPROFILE ('Documents\deep-literature-library-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.zip')
& $readingInstall.python -I -X utf8 -m scientific_reading --data-root (Join-Path $readingRoot 'library') library-backup --output $readingBackup --timeout 30
```

确认返回 `status` 为 `completed` 并保存备份路径。备份会等待活动任务；若忙或失败，按提示稍后重试。

macOS/Linux 使用平台指南读取的 `reading_root` 和 `reading_python`，运行：

```sh
"$reading_python" -I -X utf8 -m scientific_reading --data-root "$reading_root/library" library-backup --output "$HOME/deep-literature-library-$(date +%Y%m%d-%H%M%S).zip" --timeout 30
```

跨平台换机需要完整备份，并用新安装器的 `--library-backup '/备份路径.zip'`（Windows 为 `-LibraryBackup`）恢复到新的安装根。

另一台机器可以在安装时使用 `-LibraryBackup` 将备份恢复到新安装根；具体命令见 [生命周期指南](lifecycle.md#从-a-迁入)。该恢复入口也适用于本工作台生成的完整文献库备份。模型登录与 MinerU Key 需要重新配置。

本教程的刷新与备份命令已使用已安装的 rc.3 引擎在独立测试文献库中执行，三列个人记录经保存、刷新后均保留在数据库与新总表中。该验证未操作 Excel 桌面程序；桌面编辑、文件占用、自动选行及其他表格软件兼容性仍待实机验收。
