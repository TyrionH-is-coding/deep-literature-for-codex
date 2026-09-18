# V02-004G 总控复核

诊断交付通过，生产缺陷保持开放。接收 A `6d88f2bef88867c335ded9a5bcb443b7c6cf921d`，fast-forward 到 codex/v02-engine-baseline。32个新增文件均在004G专属 docs/scripts/fixture范围，无生产、既有测试、版本或锁变更。交付工作树clean。

总控核对 advance 写前分支、_validate_state终态一致性、CLI resume/start及worker先转running的代码，独立使用新合成库重跑六场景。51个Python源码文件与私有诊断环境逐字节一致。直接显式advance成功或进入gate后，后台仍failed，inspect拒绝；None只读和再次失败可读。真实CLI resume与start均保持同parent，完成解析并到translate_full_read gate；非空失败恢复输入拒绝且JSON不变。正确安全预期仍为RED，总控驱动捕获预期失败后退出0仅代表复现成功，不代表缺陷修复。

证据：[独立脚本](V02-004G-control-probe.py)、[输出](V02-004G-control-probe.txt)、[新六场景原始记录](V02-004G-control/audit.json)、[校验](V02-004G-control/verification.json)。初次总控脚本错误地把reader映射到engine/src，尚未启动场景就失败；更正为engine/reader后重跑，初次输出另存，不计产品失败。已观察子进程均自然退出，owner claims为0。

结论：这是内部服务可写出自身拒读状态的生命周期前提缺口；当前生产唯一pipeline.advance调用由worker协调，本次正常公共路径未复现该错误。不能泛化为CLI恢复失效，也不能以“内部不支持”关闭问题。Python3.11.9源码诊断，不是3.11.16制品验收；未验证任意并发或004F新合同。

后续004H在004F验收后串行最小修复：保留终态校验，在任何写入/runner前拒绝绕过后台恢复入口的显式推进，保留None只读、completed幂等与worker路径；具体适配004F已验收状态合同。004H当前planned，无固定新基线、不派发。004A-G1、004D-O1、F2与004整体门槛仍开放。
