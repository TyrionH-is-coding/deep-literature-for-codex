# V02-004E：宿主失败时保留取消意图

状态：review，待总控验收。仅关闭 004C-C1 的 B 源码缺陷。

## 固定来源与改动

- 工作树：`C:/Users/15694/Documents/ChatGPT/deep-literature-v02-004e`。
- 分支：`codex/v02-004e-cancel-intent`。
- baseCommit：`d78e48bbad317c92770b767390addd589b475038`。
- contextCommit：`11581f7f2b0530a11179f0b25b90de4cb6559f1d`，从总控固定提交读取任务卡、AGENTS、session-protocol、004BC-control-review。
- 开工 HEAD 与指定基线一致，工作树 clean；应用默认旧目录未使用。真实本任务 session ID 不可确认，回执为 null。
- 唯一生产修改：`src/modules/workflow/handoff.mjs` 在 checkedTask 成功后，先置 cancelRequested 并等待现有原子 JSON 保存，再调用 cancelTask。失败直接向调用方抛出原错误，不记录宿主异常或 stack；重复调用不短路。
- catalog 只将 workflow 0.1.0 提升为 0.1.1。公开入口、签名、返回合同、schema 1、bridge、A、pins、锁文件及产品版本不变。

## 验证

环境 Node v24.18.0 / Windows，独立合成数据。首次 modules list/context 因缺 acorn 失败；`npm ci --ignore-scripts` 按现有 lock 安装 1 包后 list/context 成功，依赖文件无差异。

| 当前执行 | 结果 | 证据 |
| --- | --- | --- |
| 原样 004C host failure 缺陷断言 | 1 pass / 0 skip；证明重开丢意图并发出 prompt，是缺陷复现，不是修复通过 | [baseline](V02-004E-baseline.txt) |
| 只改正确预期、未改生产 | 0 pass / 1 fail，exit 1；undefined 与 true 不符 | [red](V02-004E-red.txt) |
| handoff + cancel-contract + bridge 定向 | 35 pass / 0 skip，exit 0 | [targeted](V02-004E-targeted.txt) |
| modules check | 10 modules / 47 source files / 152 imports，exit 0 | [check](V02-004E-check.txt) |
| modules impact --base 指定基线 | workflow/tooling，影响 lifecycle/releases/workflow/bridge/application/tooling，无 unowned | [impact](V02-004E-impact.txt) |
| modules test workflow | 81 total / 80 pass / 1 skip / 0 fail，exit 0 | [workflow](V02-004E-workflow.txt) |
| bridge 独立回归 | 10 pass / 0 skip，exit 0 | [bridge](V02-004E-bridge.txt) |

唯一跳过是 Windows 的 POSIX long socket 测试。上述集合有重叠，不累加为独立测试数。实际命令、起止时间和退出码见 [runs](V02-004E-runs.json)，可用 `node scripts/v02-004e-verify.mjs` 重跑。最终版本的测试包含专属临时根及子进程隐藏窗口/超时设置。

验收覆盖：

1. 宿主回调内直接读文件确认意图已保存；宿主失败返回原 Error 对象，task/list/同键 submit/default dispatch 保持抑制，文件没有虚构取消结果或异常文本。
2. 真实原子 rename 目的地为目录导致保存失败；连续两次失败均零宿主调用，原文件字节不变、临时文件清理；恢复路径后可再次保存并调用宿主。
3. 失败后重复取消再次调用宿主，保留此前真实结果但本次仍抛错；恢复宿主后成功重试。
4. 独立子进程直接只读 JSON，父进程核对文件字节不变；另一个独立 Node 进程重新 Handoff.open，task/list/同键 submit/default dispatch 不投递，新 gate 仍抑制，宿主失败后再成功重试。子进程 PID 与父进程/彼此不同，断言随正式模块测试执行。
5. 新成功 resume/attach、显式 retryKey 维持清除行为；旧 completed resume/attach 重放保留后来取消，失败 resume 保留意图。
6. completed/failed 真实终态与 Reader 保持；running 仍保留真实 job.status，仅 B 展示 cancel_requested。
7. unknown task、范围变化、归档在写意图前拒绝；同会话另一任务文件记录逐字段不变，仍能正常投递/显式重试。
8. 未放宽旧 bridge helper 断言：所属队列、独占 turn、共享 turn、keepInbox、旧 turn/未知来源保护均验证。此为注入原生 helper 合同，未重复运行真实 DSH/A。

## 清理、限制与恢复

临时根由测试独立 mkdtemp 创建；004E cancel fixture 的删除先校验绝对路径位于系统 temp 且前缀为 v02-004e-，各测试 after hook 已完成。独立 Node 子进程使用同步执行并已退出，无持久宿主、监听端口或用户安装。模块测试沿用各自合成 fixture 清理。仅本工作树新增 node_modules 开发依赖，不触及总控、004D、用户实例或凭据。

保存失败时内存可保留意图，但磁盘未成功更新，调用仍失败，不能宣称持久化成功。沿用已有 writeJson 临时文件/rename，不新增 fsync 或断电保证；未实现多进程并发写同一实例的新协议。

004A-G1、类别工具守卫、A detached worker 安全边界停止仍开放；C3 清除时序另归总控。未使用真实模型、真实 A 取消接口，也没有安装/科学质量/非 Windows 声明。004D 冻结候选结果不覆盖本修复，两者集成后仍须组合验收。未合并 main/总控、未发布、未派生后继。

回退可撤回本卡代码与模块版本，已有 schema 1 可读；不回退文献或删除已有取消标记。回退会重开宿主失败丢失新意图窗口。交付源码提交见回执 sourceCommit，最终交付 commit 由任务回复提供；报告/回执的后续证据提交不改变被测生产或测试字节。
