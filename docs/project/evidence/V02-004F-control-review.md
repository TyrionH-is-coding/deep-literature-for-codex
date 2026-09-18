# V02-004F 总控验收

A源码能力验收通过。交付 `cc61625df084ea483e62b3517a609fbc601118fc`，被测源码 `630398634db15b72064e64e221bc5fa6105e7a25`，集成 `776a018c7855442de38d591517eea831eae5b463`。交付clean/review；合入后engine Git树一致。10个变化源码/测试/探针与最终记录核对，生产文件字节一致，test_reading_control.py及v02-004f-verify.py检出后仅CRLF/LF变化，规范化后相同。与004G组合仅增加专属诊断文件，无生产冲突。

总控复核控制记录校验、request-id/revision幂等、gate/source/scope守卫、短锁与阶段入口互斥、launcher/worker/旧resume/attach保护、旧worker未知状态、丢回执重试和资产保留。最后3行生产修复补齐已退出worker的running状态显式恢复，未修改004G直接advance缺陷。

最终同一源码快照64个Python测试文件分配到4个隔离pytest进程，每文件一次；独立解析XML核对574个唯一测试，**571通过、3跳过、0失败/错误**。32原恢复断言、17控制单测、7真实进程测试均在其中。跳过为Windows目录软链接权限、Unix zombie及未解锁原生凭据服务。保留早期CLI夹具缺少data-root、执行中改动后旧测试与磁盘源码不一致等历史失败，不拼接不同轮次计数。

五个真实进程场景覆盖parse、batch提交、Reader前、Reader提交、derived已启动。请求在provider未结束时可读；确认后重复start/advance/launcher不能推进；同parent恢复完成，资产SHA和正式Reader指针保持。已启动xlsx自然结束。边界探针的恢复使用真实control服务加QueueOnly，再启动真实受控provider worker；真实CLI stop/start/resume竞争由独立process测试覆盖，不混称完整安装链。

总控上一轮独立16项控制单测通过；最终delta独立2项通过（5.41秒），验证dead-worker恢复和CLI参数。见[V02-004F-control-verification.json](V02-004F-control-verification.json)、[最终复验](V02-004F-control-final-delta.txt)。既有未变化完整回归不重复。

只接受A源码能力，**004A-G1仍开放**：B工具/UI未接入，最终安装组合未验收。request/ack/terminal必须区分，独立child不取消、当前provider可完成、未知启动PID保守待对账；降级旧引擎不保证保护停止记录。非Windows、物理掉电、真实模型未验证。004H补最小生命周期写前守卫；004整体、005与F2门槛不解除。
