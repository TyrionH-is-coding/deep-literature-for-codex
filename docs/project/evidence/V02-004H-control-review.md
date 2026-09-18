# V02-004H 总控验收

源码修复通过，交付/引擎集成 `2720fac32cf2b989523079405abbd0e4f3698e07`，被测源码 `2379f9341e872c900edf5258848f0c1bc603600a`。clean/review。生产仅reading_pipeline.py增13行，在advance claim及短控制锁内、任何stage登记前验证后台生命周期；非法显式推进抛full_read_pipeline_resume_required，保留停止gate与合法worker恢复。

总控审查实际差异和24个新增测试；独立同源私有Python环境运行生命周期测试，**24 passed in 42.76s**。独立重哈希122个源码/测试/脚本和私有环境52个Python文件，核对65个测试文件全覆盖无重复，四份XML的598个唯一测试：**595通过、3环境跳过、0失败/错误**。原恢复32项与F停止进程测试均保留。

真实CLI六场景原始结果核对：直接显式推进在写前拒绝，parent文件哈希不变、inspect正常；None不推进；真实CLI resume/start均在相同parent完成受控解析到翻译gate，无手工transition代替CLI。F五边界进程结果保持资产与完成语义，进程退出。source-only，非安装制品测试。

基线红灯13失败中12项为实际缺陷，第13项是新completed夹具错误要求SQLite全字节幂等；修正为parent幂等，既有测试未改。旧G红灯和历史记录保留。scope/来源/校验器/停止协议未弱化。

证据：[总控校验](V02-004H-control-verification.json)、[独立测试](V02-004H-control-tests.txt)。004D-O1记录源码已修复，最终安装复验仍待；004A-G1及004整体/F2不关闭。下一卡004I只补跨包停止控制适配，workflow取消行为另卡；避免同时改协议适配与持久任务语义。
