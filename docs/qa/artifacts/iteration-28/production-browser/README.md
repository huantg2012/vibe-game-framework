# 正式新档浏览器链路

2026-09-20；入口为本仓库DEV默认首页 `http://127.0.0.1:3021/`。每趟全新临时 Chromium 上下文，无用户存档、无预置物件或薪柴、无seed覆盖、无传送/改血/强制结束/游戏时钟修改。

## 结果

**第二趟完整通过**，记录在 [attempt-2/report.json](attempt-2/report.json)：

- 首页新游戏 → 实际WASD走到入口 → E备行 → Shift+Enter出发。
- 默认抽到猩釉层原/断裂荒野，seed `2505122715`。暂停、刷新浏览器、首页继续后世界身份不变，角色仍在 `(1556, 916)`。
- 实际行走并按住E翻找 `KDL_02`，取得1薪柴；继续实际走到出口并按E撤离。
- 撤离时HP100、混乱约74；按R归来后显示首次免冲击报告。保存包为cycle1、薪柴1、三个模块70/100、outcome=extract、baseSettled=true。
- Esc关闭报告，场景继续运行，无报告或暗场遗留；页面异常/console error均0。

实帧：[翻找](attempt-2/05-searched.png)、[撤离成功](attempt-2/06-extracted.png)、[首次归来报告](attempt-2/07-first-return.png)、[关闭后基地](attempt-2/08-closed.png)。同目录webm为这趟完整连续录像（本地保留、不入Git，校验见[录像清单](video-manifest.json)）；`journey.jsonl`记录实际按键与只读诊断，`entry.storage.json`/`first-return.storage.json`是该隔离新档真实产生的记录。

**首趟失败保留**在本目录 [report.json](report.json)。seed `4224903042`，无彩层原/断裂荒野；新档、刷新续局、实际翻找1薪柴均成功。撤离前受击偏离路线，旧测试导航没有先恢复横轴位置，在 `(487.22, 538)` 顶墙，HP55、混乱80；测试终止，未伪造成功或强制结算。随后只修改测试脚本的真实按键导航：每段先校正横轴，再沿主轴走。未因此改生产代码或选择seed。

## 地图与渲染只读采样

第二趟 `worldSurface.snapshot()` 四次采样均显示2张地图纹理；实际身体20×20，物理格8px。反射有效像素采样756、756、3187、1710，沿实际位置更新。活动存档106011–106903字符，归来保存3891字符。Phaser FPS瞬时采样49.75–60.70，仅是该次浏览器观察，不构成性能验收。

## 导航与验收边界

`tools/qa/check-world-production-browser.mjs`仅通过`window.__game`读取地图、身体和状态。BFS以实际20px身体加每侧2px余量筛选路径，并选择距交互物26px以内、与其间没有墙的安全点。执行全部使用真实键盘事件。此为全地图诊断导航，不能宣称新玩家找路体验通过。

本证据涵盖一次稳定代码下的成功链路及此前一次失败，不是广泛抽样、能力平衡结论或动态美术终审。已包含一个正式地图的刷新续局与首归，不能代替所有世界组合或长期存档验证。

复现：启动DEV后运行 `GAME_URL=http://127.0.0.1:3021/ node tools/qa/check-world-production-browser.mjs`。可用`QA_OUTPUT_DIR`设置独立输出目录，`PLAYWRIGHT_MODULE`和`CHROME_PATH`指定环境现有浏览器依赖。
