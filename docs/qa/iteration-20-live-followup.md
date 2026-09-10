# QA Report：异物自然试玩补验

日期：2026-09-10
Spec：`docs/specs/system-growth-tide.md`「裂隙实际能力」及 `docs/specs/system-enemy-ai.md`
代码版本：`e820588` 后的当前工作区，包含本轮反馈修复、模型残影和薄墙格缝修复。
范围：记忆碎片（`retrograde`，原名返刻片）、带缺口的石头（`expand`，原名缺口石）。

## 结论

两条自然试玩路径均通过。证据来自独立 Chrome 内的实际生产战斗试验场，进入场地后只使用真实键盘输入和正常游戏时钟。未直接调用技能、伪造失视、推进内部计时，也未修改玩家或敌人的位置。观察代码只读取运行态。

试玩额外发现了连续薄墙在砖缝处误拒绝穿越的问题，已由主任务修复并以原行走路线复验通过。此前“必须对齐单块砖中间”的操作限制不再成立。

## 测试设置与边界

- 全新浏览器存储，正式存档键使用哨兵；结束时哨兵未改变，无 `pageerror`。
- 通过正常 URL 配置普通品质、单个默认虫类、关闭自动重开。免伤在开局配置中启用，便于持续观察；本报告不验证受伤反馈。
- 记忆碎片使用实际敌人感知、追击、路径与中央厚掩体的 LOS 遮挡。实验室没有正式裂隙的雾幕，因此本项证明真实墙遮挡失视，不能单独替代正式裂隙雾幕美术验收。
- 带缺口的石头使用生产试验场新增的单格厚墙：`col=4, row=5..8`。地面绘制与物理读取同一份场地数据；中央厚掩体保留。
- 首次探索曾站定等待但未自然追击，随后改为实际按 D 走近；另一次运行被源码热更新打断。最终证据是在明确稳定窗口内完整重跑所得，未将中断运行当作通过。

## 发现与修复

| ID | 类型 | 严重度 | 实际发现 | 状态与证据 |
| --- | --- | --- | --- | --- |
| LIVE-01 | Bug | Medium | 角色在连续单格厚墙前，身体跨相邻两排砖缝时，Q 被拒绝。初次实测位置约 `(118,214.68)`；次数未减少。墙厚没有增加，却要求玩家对齐单块砖。 | 已修复。`src/systems/tool-targeting.ts:121` 允许正交穿越同一墙面相邻格。原 S 行走目标 210 复验时，身体跨缝仍可成功穿越，见下文。厚墙、VOID、斜角第二墙及落点净空保护由主任务几何回归覆盖。 |

## 记忆碎片：自然追击与真实失视

从默认出生点开始：D 走近，敌人自然进入追击；随后 A 贴近中央掩体右侧，W 绕上缘，再 A / S 绕至左侧。没有使用“靠近敌人”按钮，因为该按钮会直接搬移角色。

最终运行观察：

1. 场景时钟约 `1326ms`：敌人自然追击，双方 LOS 为真，余次 5。
2. 约 `4393ms`：角色沿墙角移动到 `(304.54,114.03)`，实际墙面遮挡使 LOS 为假；余次 `5→4`，生成完整 6000ms 的真实身体记忆。
3. 约 `6759ms`：敌人已经继续追来，旧影仍固定在 `(334.24,144.91)`，剩余约 3633ms。图像没有跟随活体移动。
4. 约 `10409ms`：正常时钟走完，旧影和对应纹理清理，余次仍为 4；同一次追击没有重复收费。

证据：[自然追击](artifacts/iteration-20-followup-qa/retrograde-01-natural-chase.png)、[绕墙后的固定旧影](artifacts/iteration-20-followup-qa/retrograde-02-natural-loss-memory.png)、[自然到期](artifacts/iteration-20-followup-qa/retrograde-03-natural-expiry.png)。

## 带缺口的石头：走到薄墙、真实 Q、恢复移动

从默认出生点 W 绕过中央掩体上方，A 向左，S 回到薄墙中段，D 实际走到墙面并建立向右朝向，再按 Q。

最终运行观察：

1. 施放前中心 `(118.00,217.35)`。20px 的身体覆盖 `y=207.35..227.35`，明确跨越两排砖的 `y=224` 格缝；身体被真实碰撞停在墙左面。
2. 实际 Q 后落点 `(170.00,217.35)`，全身越过 `x=128..160` 的墙面，余次 `3→2`。物理 body 始终启用。
3. 读取到实体化剩余约 933ms；继续真实按住 D，剩余约 583ms 时角色仍停在原落点，不能通过持键绕过锁定。
4. 正常时钟到期后输入恢复；继续 D 实际走到约 `x=192.78`。次数不再变化，效果状态清理。

证据：[实际走到薄墙](artifacts/iteration-20-followup-qa/expand-01-walked-to-thin-wall.png)、[真实 Q 后实体化](artifacts/iteration-20-followup-qa/expand-02-actual-Q-rematerialization.png)、[自然恢复后继续移动](artifacts/iteration-20-followup-qa/expand-03-real-clock-input-recovery.png)。

## 可复现材料

- [完整连续录像](artifacts/iteration-20-followup-qa/natural-play.webm)
- [带场景时间的完整路线与运行态记录](artifacts/iteration-20-followup-qa/natural-play-observations.json)
- [自然试玩脚本](../../tools/inventory/check-tool-natural-play-browser.mjs)
- 格缝修复前，两条已成功路径的证据保存在 `artifacts/iteration-20-followup-qa/pre-seam/`。其中薄墙成功时曾人为选择格中停步路线，仅作为此前阶段证据；本报告最终结论采用修复后的跨格缝路线。

执行命令：

```sh
PLAYWRIGHT_MODULE=/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node tools/inventory/check-tool-natural-play-browser.mjs
```

本次没有重复此前已通过的全部 13 族领域回归。上述结果补齐的是两条先前缺少的自然操作链路，不将程序断言通过等同于用户最终审美评价。
