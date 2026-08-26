---
status: ACTIVE
created-by: director agent
created-when: 2026-08-26
last-modified: 2026-08-26
note: 迭代 3 体验未验证的感知补丁。CH-HUD-1 / CH-HUD-2 / CH-HUD-3 已交（2026-08-26）。人验裂隙左上「混乱」条未做。好看不代勾。不要塞进迭代 5。不要开 I5-C / I5-J。不要标迭代 5 COMPLETE。
---

# Tasks: 混乱条一次可见跳变

权威：`docs/progress/current-iteration.md`（活指针仍在迭代 5；**本包不进那张波次表**）。规则：`docs/specs/system-chaos-scavenge-extract.md` HUD 节（规则 30–32 与反馈表）+ `docs/specs/system-contamination-lexicon.md`「向混乱值发送」。实现：`src/ui/dom/rift-hud.ts`。练习场入口：`docs/dev/gym.md`（侧栏是开发说明，不是玩家 HUD）。

**性质：** 迭代 1 锁的混乱通道 + 迭代 3 接到裂隙之后的 **UX / 信息缺口**。逻辑已入账；玩家可能看不出离散加值。不是新外形任务，不是迭代 5 基因谱。

**收尾合法态：** 裂隙出击左上「混乱」条在 `CHAOS_CHANGED` 且 `delta > 0` 时有一次可见跳变（闪白 / 脉动），占漆踩踏、占空体积过发射步长、战斗 +5、侦测 +3 同一套语言。人能在裂隙里看见条在跳，不要求能读出来源。好看不代勾。

---

# 核对后的真相（2026-08-26，禁止再写成「完全没有 HUD」）

1. **机制已入账。** `ContaminationHostSystem`：占漆迈一步且踩在核旁 → `addChaos('paint_step', +2/+4)`；人在占空体积盒内 → `addChaos('volume_field', 每秒 +1)`。`ChaosSystem.addChaos` 的 `source` 被丢掉（注释 reserved for analytics）。HUD **不知道**这次是踩漆、体积、战斗还是侦测。
2. **裂隙有玩家 HUD。** `RiftHud` 听 `CHAOS_CHANGED`，更新左上表名「混乱」+ 0–150 条 + 整数 + 档位词。踩踏 +2/+4 立刻过 `EMIT_STEP`（1.0）；体积按帧切，大约每秒才推一次 HUD。出击有 `sfx-shared-chaos-tick`（`delta > 0`）。
3. **缺的是跳变，不是条。** 代码里没有混乱跳字、没有「+2」toast。薪柴才有 `showPickupFlash(+amount)`。`payload.delta` / `payload.rate` HUD 未用。规则 32 的追击 `▲` 与跨阈条闪白也未见（跨阈走 `rift-scene` 全屏文学层）。上一轮若说过「混乱跳字」，那是口误。
4. **练习场句法课没有玩家 HUD。** 有 `ChaosSystem`，踩踏 / 体积会加值。「感受伤害」只切无敌，不关混乱入账。侧栏 `#gym-roster` 调试行会写混乱一位小数——这是开发配置表。陈列馆 / 地图课不结算这些。禁止把侧栏伪装成游戏内 HUD。
5. **规则已写过 ≠ 画面已有。** 混乱 spec 反馈表：出手命中应「混乱值条一次可见跳变（+5）」。污染句法：踩踏 / 场内加速走既有混乱通道，不另造隐蔽条。没有「按来源分色 / 分词」的要求。

**已选 B，禁止改口成 A 或 C，除非人明确否决。** 裂隙条会涨，但离散加值不够显眼；补 spec 已要求的那一场跳变。不给句法课挂玩家 HUD。

---

# 范围锁

允许：

- 混乱条在 `CHAOS_CHANGED` 且 `delta > 0` 时一次可见跳变（闪白 / 脉动），跟 spec 战斗 +5 同一语言
- 战斗 +5 / 侦测 +3 / 占漆踩踏 +2/+4 / 占空体积过 `EMIT_STEP` 的那一次一并补，不要只给占漆开特例
- 就地更新混乱 spec HUD 节 + 污染句法「向混乱值发送」一句；`architecture.md` 若 `RiftHud` 行为变了补登记
- 既有 `#dom-ui-root` 混乱簇；挂载根不新开

禁止：

- 伤害跳字、OS toast、「踩到菌毯 +2」文案行、世界坐标飘「+2 混乱」
- 按 `source` 分三条 / 分色图例 / 来源专属提示
- 改混乱数值、改踩踏 / 体积价、改 `BASE_RATE`、改 `EMIT_STEP`
- 改基因谱外形、开 I5-C / I5-J、改出击默认甲、塞进 `docs/tasks/iteration-5.md`
- 陈列馆 / 地图课挂伤害 HUD（这两课不结算）
- 为练习场另画一套后台条，或把 `#gym-roster` 翻成游戏内 HUD
- 震屏、命中停顿（战斗 V3）
- 本批顺手做规则 32 的追击 `▲` 或跨阈整条闪白两次（缺，但不是本批）

迭代 3 红线仍在：禁止伤害数字。补反馈必须走既有混乱条。

---

# 工作单元

单批上下文：design 最短扩 spec → art 最短核 → code。不要三职揉进一次会话。不要开第二批。

## CH-HUD-1 — 就地写清「条跳变，不来源分词」

Title: 混乱条一次可见跳变（spec） | Priority: P0 | Dispatch: ✅ 已交（2026-08-26，design） | 收敛：1 轮。禁止改 `src/`。禁止新开 `docs/specs/ui-*.md`。

**输入：** 上文「核对后的真相」+ 本范围锁。信息架构不改：仍是左上混乱簇，仍听 `CHAOS_CHANGED`。

**要做：**

1. 就地扩 `docs/specs/system-chaos-scavenge-extract.md` HUD 节 / 反馈表：`CHAOS_CHANGED` 且 `delta > 0` 时条一次可见跳变。点名占漆踩踏、占空体积过发射步长、战斗、侦测走同一场，不按来源分色分词。更新 `last-modified-date`。
2. 就地补 `docs/specs/system-contamination-lexicon.md`「向混乱值发送」一句：入账后走既有混乱条跳变，不另开隐蔽条、不另开来源提示。
3. 纠正口误：没有跳字；薪柴的 `+N` 闪不是混乱通道。

**不要做：** 发明新 HUD 元素；写追击 `▲` 的实现合同（本批不做）；改数值。

## CH-HUD-2 — 跳变像装置读数

Title: 混乱条跳变最短核 | Priority: P0 | Depends: CH-HUD-1 | Dispatch: ✅ 已交（2026-08-26，art） | 收敛：1 轮规格。不要自己实现 `src/`。

**开工闸门：** 先 Read `.cursor/skills/in-game-ux/SKILL.md`（自定义 agent 不会自动加载），再读 like-a-game / aesthetics。载体 **A 世界内装置**（裂隙随身罩左上 `.device-plate` 混乱簇，不是软件进度条）。参考沿用混乱 spec 规则 30 已锁三款（Signalis / FTL / Darkest Dungeon）的动作，不学它们的皮。相关 U：U1 载体 A、U6 不另占中心、U10 离散加值 400ms 内条上必有可见变化。不新开 ui spec。

**要做：** 最短合规核——这场跳变是装置读数闪白 / 脉动，不是网页进度条特效、不是 OS toast、不是头上字。可指向既有 `rift-hud-pulse` / Kit 瞬时强调，禁止新造第三种强调色。写进混乱 spec HUD 视觉句或 Kit 一行登记（以 CH-HUD-1 扩完的节为准，不新开文件）。

**不要做：** 代勾好看；改布局；给句法课侧栏画皮。

## CH-HUD-3 — 裂隙混乱条接跳变

Title: `RiftHud` 正增量一次跳变 | Priority: P0 | Depends: CH-HUD-1, CH-HUD-2 | Dispatch: ✅ 已交（2026-08-26，code） | 收敛：最多 2 轮；连续 2 次过不了 `tsc` 停、升给人。

**要做：**

1. `RiftHud` 消费 `CHAOS_CHANGED` 的 `delta`。`delta > 0` 时对既有混乱条做一场 art 核过的跳变。战斗 / 侦测 / 占漆 / 占空过步长同一条路径。
2. 若 `architecture.md` 模块注册表对 `RiftHud` 的行为描述过时，补一句（条在正增量时跳变）。不改挂载根。
3. 机器闸门：`npx tsc --noEmit`。若有现成 HUD / 混乱检查就跑，没有则不新造闸门脚本。

**不要做：** 按 `source` 分支；改 `addChaos` 数值；创建 `RiftHud` 进练习场；改基因谱。

---

# 人怎么验

- **要看：** 裂隙出击左上「混乱」条。占漆上迈步、走进占空体积、挥击命中，条应跳一下且整数会涨。不要听侧栏。
- **不要当验收面：** 练习场句法课 `#gym-roster`（调试数字会涨，那不是玩家 HUD）。陈列馆 / 地图课不结算。
- 人否审美或「不像装置」= 本批未过，回 art，禁止 code 独自换皮。

---

# 轻量路径收尾四项（做完才勾）

1. [x] **架构登记：** `architecture.md` 模块注册表 `RiftHud` 行已补：`CHAOS_CHANGED` 且 `delta > 0` 时条头填充一次 180ms 短促提亮；挂载根仍是 `#dom-ui-root`。
2. [x] **spec：** 就地扩混乱 spec 规则 32a + 反馈表；污染句法「向混乱值发送」补一句。未新建 `docs/specs/ui-*.md`。
3. [x] **交付范围：** 本文件 + `docs/progress/backlog-issues.md`。未写入迭代 5 波次表。
4. [x] **UI 清单：** art 走过 in-game-ux skill；U1 / U6 / U10 机械层已扫。过清单 ≠ 好看。审美待人终审。

**agent 三职已交，人未看。** 规则 32 追击 `▲`、跨阈整条闪白两次本批未做。
