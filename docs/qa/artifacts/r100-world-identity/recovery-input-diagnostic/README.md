# ash-strata / medium 原失败保存内容复放

原矩阵在新出发成功后，刷新并固定等 350 ms 按 Enter，30 秒内未进入 Rift。原失败保留于 `../production/report.json` 和 failure PNG；本目录另外保存[原 case 完整副本](original-failed-case.json)。未修改原保存内容、种子、身份、背包、位置、生命或时钟。

[独立诊断结果](report.json)使用 3087 冻结源，三个独立 browser context：

1. 自然加载、同样等待 350 ms：成功恢复，按键到达时 ready / interactive 均为 true。
2. 等待菜单的实际 `interactive()`：成功恢复，身份和玩家位置与原保存内容精确相同。
3. 仅将标题图片网络响应延迟 2 秒：首个真实 Enter 到达时 focused=true、ready=false、interactive=false，被首页按既有设计忽略；等真实可交互后第二次 Enter 成功恢复，身份/位置仍精确相同。

三个过程均零页面错误并保留恢复截图。这证明固定 350 ms 的 QA 前提不可靠；**受控慢响应不是对原失败瞬间的确证**。原报告没有记录当时按键的 readiness，不能声称确定了原事件的唯一原因；独立复放未发现恢复算法错误。

`tools/qa/check-r100-production-browser.mjs` 的首次入场与刷新恢复均改为等待首页真实交互门，替代固定延时；仅修 QA，不改产品首页。已经启动的原 60 场矩阵仍执行旧脚本且原失败保持。`tools/qa/diagnose-r100-menu-recovery.mjs` 可复放此诊断，`node --check` 已通过。
