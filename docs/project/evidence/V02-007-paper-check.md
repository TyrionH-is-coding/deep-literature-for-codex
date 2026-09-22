# V02-007 文献身份与内容核对锚点

用户指定 CD4+ Perturb-seq 论文及 GPT 模型。正式版 Cell DOI `10.1016/j.cell.2026.08.002`、PMID `42664972`（2026-08-28 online ahead of print）已由 [PubMed](https://pubmed.ncbi.nlm.nih.gov/42664972/) 核对；出版社页在本次浏览器出现访问验证。正式 PDF 尚未取得，不能把其 13 人作者题录混入预印本。

当前可用真实样本为 [bioRxiv v1](https://www.biorxiv.org/content/10.64898/2025.12.23.696273v1.full.pdf)，[官方 API](https://api.biorxiv.org/details/biorxiv/10.64898/2025.12.23.696273) 的 published 字段关联正式 DOI。文件 `C:/tmp/v007/papers/Zhu-2025-CD4-Perturb-seq-bioRxiv-v1.pdf`，7,214,585 字节，SHA256 `4ea1f4e517c2c96d615955c5d3c375e0791676817665841cb4f347094b77c55a`。下载返回 HTTP200/application/pdf，并核对 PDF 魔数。

只读复核者 `/root/v007_paper_sources` 用 bundled PDF 工具确认共 63 页，视觉检查第1页及 Figure1 所在第7–8页，读取第4–8页正文。首页匹配完整题名、10名作者（含 Lillian K. Petersen）、预印本 DOI、2025-12-24 日期和 CC BY4.0；v1 由官方 API/下载URL确认，首页未直接印 v1。正文与 Figure1 A–G 均存在。原PDF未修改；渲染图只在 `C:/tmp/v007/papers/inspection/`。

## 后续 GPT/Reader 的针对性核对

| 原文定位（PDF页码） | 应保留的事实与适用范围 |
| --- | --- |
| p4、p7 Figure1A | 四位供者，Rest/Stim8hr/Stim48hr，共12细胞池；CRISPRi与10x Flex探针方案 |
| p4，Figure1B–C对应正文 | 质控后33.4M转录组，21.99M（65.8%）分配到单条靶向或非靶向guide；不可把这些计数与供者数混同 |
| p5，Trans effects正文 | 至少一个条件估计11,527个基因的扰动效应；7,807个在至少一条件影响至少3基因，FDR<10%；不可推广此阈值到全部分析 |
| p7 Figure1G、p8图注 | 下采样与留出数据LFC相关性，1–4供者，聚合12个被扰动基因；误差线为分割及基因间变异，不是每条调控关系的独立验证 |

这是选样/身份和局部事实锚点，不是全篇科学质量验收。未用 MinerU 或 GPT，未审阅其余所有页面。Poppler 有 Symbol/ArialUnicode 字体警告，已抽查页可辨；不能据此宣称所有图文完全无缺失。最终仍需用户判断 Reader 内容及实际记录保存行为。
