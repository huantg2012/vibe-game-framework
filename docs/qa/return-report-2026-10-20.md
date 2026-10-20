# 归返报告与场景关闭回归 · 2026-10-20

范围：COH-F004。用户反馈首次成功撤离未见报告，后续放弃本趟却有报告。本轮保留“首次归返免伤、仍显示一次归来报告”的既有规则，修复 Rift 关闭期间库存回滚仍刷新武器表现的生命周期风险。

实现版本：`f097626c`。浏览器运行使用该提交对应的源码与回归脚本；同工作树的其它未提交改动不属于本次报告范围。

## 实现与机制核对

`RiftScene.onShutdown` 先标记关闭并退订库存，再销毁帧事务；`updateBurden` 同时拒绝关闭后的通知。原顺序中，`RiftFrameCommit.destroy → inventoryStore.cancelFrameTransaction → publish → 同步通知` 可以先进入 `configureWeapon`，再触碰已经随 Phaser DisplayList 关闭的图片。修复不改变结算数据、首归豁免、报告排版或按键规则。

原始隔离探针实际记录了 `Inventory subscriber failed after commit`，局部栈为 `Image3.setTexture → LastLightPlayerPresentation.setWeaponVisual → Player.setWeaponVisual → CombatSystem`。错误由库存订阅层捕获并写入控制台，因此只监视 `pageerror` 会漏报；本轮测试已同时捕获 `console.error`。旧顺序定向回放的关闭后武器更新计数为 1，触发预期为 0 的回归断言；修复后为 0。原始截断栈与反例输出见 [lifecycle-before-fix.txt](artifacts/return-report-2026-10-20/lifecycle-before-fix.txt)。该原始探针的归来报告仍正常显示，不能由这条错误反推报告一定消失。

真实撤离入口为 E 的 `JustDown`、当前交互提示为撤离，再经 `ExtractionSystem.requestExtract` 检查距离及未结束状态，发出 `RIFT_EXIT_REACHED`。`RunController` 的监听器直接调用 `endRun('extract')`，与本轮受控结束使用同一结算出口。其它两个事件消费者只停止战斗与播放撤离音效，不另写 `survived` 或发起返回。

结果页的鼠标按钮和 R 均进入 `requestRunReturn → restart → queueReturn → transitionToPurification`；`restarted/returnPresented` 防止重复返回。基地优先根据已结算 ledger 的 `outcome/baseSettled` 判定成功与是否需要结算。本轮没有发现成功撤离与放弃分支传错返回数据。报告现有 `!event.repeat` 已阻止长按 Enter/Esc 重复关闭，因此没有修改面板输入。

Spec 判断：`system-purification-impact.md` 首归报告规则已经明确，`system-chaos-scavenge-extract.md` 的唯一结束出口保持；本次无需修改机制或接口。未新增模块，无需增加架构边界。

## 验证

运行于 macOS、独立无存档 Chrome context、Vite 3038、1440×960。每例新建隔离浏览器上下文，未打开或覆盖用户浏览器档案。Vite 客户端保留，阻断测试上下文的热更新连接，避免并行编辑改变正在运行的场景。冷续等待首页实际可交互后才按 Enter。

脚本：`tools/qa/check-first-return.mjs`。覆盖：

- 首次撤离、死亡、放弃均只显示一次“归来之后”；模块 HP 与供奉积累不变，潮汐推进，当前预告消费且下一预告生成。
- 实际薪柴只结算一次；报告关闭恢复操作，Esc 不穿透打开暂停菜单；第二次归返正常受损并积累供奉。
- 保存拒写期间隐藏报告并锁操作；重复失败不发布，写入恢复后只发布一次；重复到达与冷续不重复发奖、推进潮汐或重抽预告。
- 长按重复事件不关闭报告；销毁面板后旧监听与回调失效。
- 正式首页新游戏，经低污染备行实际创建 Rift；受控触发成功撤离，以 R 返回。随后再次正式出发、受控放弃，以聚焦按钮的 Enter 返回并持续重按；两次报告保持可见。
- 两次关闭都强制保留一个尚未提交的库存帧，以覆盖关闭时回滚通知；关闭后武器更新次数必须为 0。

正式首返三个模块均为 70→70；次返产生真实损伤。逐例结果与正式往返读数见 [results.json](artifacts/return-report-2026-10-20/results.json)，画面见 [首返](artifacts/return-report-2026-10-20/formal-return-1.png) 与 [次返](artifacts/return-report-2026-10-20/formal-return-2.png)。

执行记录：7 项浏览器检查通过、页面异常和控制台错误均为空；`npm run typecheck`、`node --check tools/qa/check-first-return.mjs`、`git diff --check` 通过。项目没有 lint 脚本或配置，未声称运行 lint。

## 限度

这是正式场景、正式保存及报告链的定向回归。成功撤离和放弃的结束条件由测试触发，没有自然走完整张地图；真实距离、E 输入准入、所有地图与死亡来源不在本次浏览器覆盖内。源码核对能确认两种撤离入口汇入同一结算链，不能替代自然全趟证据。未进行审美终审。

首返报告在本次隔离普通返回路径中正常出现，因此不把用户原始“首次没有报告”描述声称为已完整复现。修复的关闭风险与相关回归证据独立记录；若原症状再次出现，需保留当次入口、结果页操作与控制台异常，继续定位。
