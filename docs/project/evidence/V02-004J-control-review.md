# V02-004J 总控第1轮复核

结论：需同任务返工，未集成。被审交付 da1d08a2e7f8b57065fd6f2218e673480e1ce9b3。已有源码/证据可信：独立13项定向测试通过（2.78秒），7个源码和13个原始证据SHA256吻合；开发者99 pass/1 skip及单记录真实链、DSH原生结果不作废，但未覆盖同论文多条Handoff记录的恢复一致性。

## 004J-R1：同parent的旧别名意图使恢复后仍被阻挡

真实Handoff→adapter→固定A JS/Python独立复现：同分类/论文用两个提交键生成两条Handoff记录，parent相同；分别取消后revision为2，后者明确恢复后A为revision3且stopRequested=false。旧记录cancelRequested仍true，后者也显示cancel_requested，guardAdvance拒绝整篇；再恢复旧记录报reading_control_not_stopped。worker已正常回到缺PDFgate并注销，没有需要清理的活动worker。

边界注入另复现：停止后新提交键形成无jobId的记录，再取消它；原任务明确恢复后仍被此无parent意图永久阻挡。分类为本卡必要修复/阻断停止恢复闭环，沿用004J允许路径返工，不另派生任务。修复需对账同一目标的旧停止代，并保留更晚/未确认取消、旧恢复重放与跨scope隔离；不能简单清空同paper全部标志或创建替代parent。

本地可复现脚本及完整报告保留在总控 outputs/v02-004j-control-review，属于合成数据/source-only，未接触用户安装；原始证据见同名JSON索引。下一轮仅补受影响workflow/调用方与真实别名恢复场景，未变化的DSH证据可引用。最终安装、004A-G1/F2门槛仍开放。
