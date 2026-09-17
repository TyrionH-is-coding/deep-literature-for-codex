# V02-003A / V02-002B 总控组合复核

2026-09-17。003A 交付 `e5b2c441d5e6f3deed864de8231e1b55c581f1cf`，002B 交付 `41ede7940123ce121eba74bcfa5d14867acb7e97`。两者均从引擎 `d26cb9e88d0f7884db8e69a5a2d18286a62aaf83` 开发，工作树干净，允许路径没有交叉。总控串行合入引擎 `codex/v02-engine-baseline`，组合提交 `4e5e6b964ddb8b823be17fb61774f8386bb0ba98`，已推送开发分支。

## 代码审查

003A 的生产差异限 `xlsx_snapshot.py` 与新内部助手 `xlsx_user_fields.py`。基线随同工作簿写入隐藏表并校验完整性；导入先收集身份/结构冲突，再在 BEGIN IMMEDIATE 内重读 SQLite，按 D010 逐字段合并。任何冲突跳过整批个人字段写入，保留原工作簿并返回 pending。legacy 差异不推断胜者，导出替换失败重试保持幂等。SQLite schema、其他生产入口和依赖未变。

复核了三方组合、双边同字段冲突、整批不部分导入、清空、legacy、损坏基线、身份异常、并发和重启测试。旧身份测试改变为整批不导入后，另保留修复身份再成功导入与系统列不导入的保护断言。hidden baseline 的 SHA 只用于损坏检测，不是认证签名。

002B 仅将两个完整对象期望补上现行 `journal` / `search_matches`，并把 navigation-contract 加入默认离线链；没有删弱后续安全边界断言，没有生产改动。开发者原始记录的失败前测、完整后测、41 条离线命令和 4 条资产命令均已核对。

## 总控实际复验

在上述组合提交运行：

- `python -m pytest engine/tests/test_xlsx_snapshot.py engine/tests/test_worker_xlsx_snapshot.py engine/tests/test_pipeline_excel_end_to_end.py -q --tb=short --junitxml=...`：56 passed，48.21 秒，0 skip。
- `npm run build:ci`：exit 0。
- `node tests/navigation-contract.mjs`：exit 0，完整合同通过。
- `node tests/excel-actions.mjs`：exit 0。

原始组合证据在 [V02-003A-review](V02-003A-review/)；命令在引擎集成 checkout 运行，Python 使用已结束 003A 的隔离 `.venv/Scripts/python.exe`（3.11.9），显式 PYTHONPATH 指向组合源码，不改该依赖环境；Node 24.18.0。构建固定 002 审计 PIP_CONSTRAINT。最初未加 legacy-peer-deps 的 npm ci 遇到宿主 peer 解析冲突，改用 002 已记录的 `npm ci --ignore-scripts --legacy-peer-deps --no-audit --no-fund` 成功；未修改锁文件或升级依赖。build 仅产生已有 client 的换行变化，核对无语义差异后恢复 Git 原字节。

003A wheel 摘要与两个修改文件的内容对应另经总控重新校验；开发者独立 site-packages smoke 证明 F1/冲突与两次 CLI 重启、schema 4。该证据不等同于工作台安装验收。

## 结论

接受 003A 源码修复和 002B 测试修复，均已集成。F3 关闭；F1 仍开放，交给 003B 同一候选制品的安装场景复测。总控本轮没有重跑全量 Python/默认 Node 链，003B 应在完整候选构建上执行。真实 Office/WPS、实际模型、用户库及最终 v0.2 发布均未验证。

回退范围是上述开发分支提交；数据仍为 schema 4，不能以 Git 回退覆盖新增个人记录。main 和真实用户实例保持不变。
