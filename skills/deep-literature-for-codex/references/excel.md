# Excel 刷新与备份

从本 Skill 的 `installation.json` 读取真实实例根，再读取实例根的 `installation.json` 获取当前 Python。不要根据 cwd 或固定版本目录猜测。

Windows：

```powershell
$readingRoot = '<实例根>'
$readingInstall = Get-Content -LiteralPath (Join-Path $readingRoot 'installation.json') -Raw -Encoding UTF8 | ConvertFrom-Json
& $readingInstall.python -I -X utf8 -m scientific_reading --data-root (Join-Path $readingRoot 'library') xlsx-refresh
```

macOS/Linux：

```sh
reading_root='<实例根>'
reading_python=$("$(cat "$reading_root/.workbench-node")" -p 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).python' "$reading_root/installation.json")
"$reading_python" -I -X utf8 -m scientific_reading --data-root "$reading_root/library" xlsx-refresh
```

先保存并关闭工作簿。返回 `success` 才表示完成；`pending` 按错误处理，原文件保持待同步。Excel/LibreOffice 占用标记存在时不会刷新；某些表格软件不生成此标记，仍必须保存关闭。不要自动删除占用标记。

总表路径为 `<实例根>/library/library/scientific-reading.xlsx`。macOS 用 `open "<总表绝对路径>"`，Linux 桌面用 `xdg-open "<总表绝对路径>"`，没有关联软件或桌面时提供路径并说明无法打开。Windows 使用可用的文件打开工具。只有真实返回的选行结果才能证明已定位论文。

完整备份：在同一条引擎命令中把 `xlsx-refresh` 替换成 `library-backup --output '<备份 ZIP 绝对路径>' --timeout 30`，先确认刷新成功，再确认备份返回 `completed`。备份不包含模型登录和 MinerU 密钥；换机后重新配置。
