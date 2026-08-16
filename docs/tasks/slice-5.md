---
status: ACTIVE
slice: 5
created-by: director agent
created-when: 2026-08-12
---

# Slice 5 Task Briefs: 工具库深度（Fine/Rare 补完 + 工具视觉 + 改造深度）

> **验证问题**：出击前的"带什么"决策是否变得纠结？拿到一件 Fine/Rare 污染物时，玩家是否会在"当防御吃着"和"攒成工具用"之间真的犹豫？

## 范围锁定（人已拍板 2026-08-12）

- **P0**：T0 架构注册表全量补核 / T1 七种 Fine·Rare 主动工具 / T2 `siphon` 被动工具 / T3 防御侧全部未接线机制 / T4 工具使用 VFX
- **P1（已确认纳入）**：T5 永久改造深度 + `upgrades.csv` 三项落地 / T6 净化点模块受损三态视觉
- **清账（已确认纳入）**：B1 purification-impact 漂移回填 / B2 growth-tide exposes 对齐 / B3 art-direction §6 措辞复核 / B4 `BREATH_*` 死常量清理
- **不做**：第二敌人（→ Slice 8，DEC-053 对调）、净化点扩张（→ Slice 7）、程序化地图 + 撤离点多样性（→ Slice 6，DEC-053 对调）、音乐/音效（→ Slice 9）、NPC（→ Slice 10）、i18n 补全

**Fine/Rare 全量落地，不分批。** 人明确拒绝"做一半留 fallback"的半实现态。

## ⚠️ T3 未解锁：设计讨论进行中

人否决了"授权 design 降级并回写 CSV"的路径。**T3 的实现必须等设计讨论拍板后才开工**，Brief 里不预写任何降级方案。待议题见 T3 章节。T1/T2/T4/T6/B1-B4 不受阻塞，可先行。

---

## 现状核对（本 Brief 的事实基础）

代码核对日期 2026-08-12。Fine/Rare 的缺口是三类性质不同的活：

| 类 | 现状 | 缺 |
| -- | ---- | -- |
| 主动工具 | `tool-system.ts` 实现 8/15：solidify / ruminate / retrograde / kindle / stitch / delay / expand / erode | **7**：resonate / overwrite / compress / mirror / echo / abyss / combust |
| 被动工具 | `tool-system.ts` 实现 2/3：scatter / muffle | **1**：siphon |
| 防御侧 | `defense-engine.ts` 中 10 型有专用实现；其余 8 型落 `applyGenericDefense`，其中 6 处源码明写 `handled externally` / `future iteration` 从未接线 | 见 T3 |

**关键架构事实**（供实现参考，已核实）：

- `applyDefenseEffects()` 是纯函数，每次冲击调用一次；`DefenseContext` **已经**携带 `moduleHps` / `moduleMaxHps` / `forecastTargetId` / `actualPrimaryId` / `stabilityProgress`，但 `applySlotEffect()` 把它标成 `_context` 直接忽略了。需要模块 HP 的机制（`abyss`）不需要新增管道，只需要开始读它。
- 减伤按 `totalReductionMult *= (1 - r)` **乘法**叠加。
- 唯一的跨冲击持久状态是 `solidifyCounters`（`Map<contaminantId, number>`，`resetDefenseEngine()` 清空）。**它不进存档，重载即清零。**
- 冲击计数的唯一递增点是 `contaminant-system.ts` 的 `applyImpactCharges()`（`c.impactCharges += chargeCost * chargeMult`，达阈值转 `stage = 'tool'`）。改其他 slot 计数的机制只需 defense-engine 返回一张加成表，由此处消费。
- `GameState.getModuleEffect(type)` 是模块效果的**唯一入口**，且两个消费方就是 `chaosRateModifier`（CORE）与 `kindlingValueModifier`（STORAGE）两个标量。

---

## Tasks

### T0: `architecture.md` 模块注册表全量补核

| Field | Value |
| ----- | ----- |
| Agent | code |
| Dispatch | 🔴 |
| Depends | - |
| Est. | 1.5h |

**Brief**：模块注册表已欠账五个 Slice。全量核对 `src/` 与注册表，一次补齐，不允许再留"其余待下次"。

**Requirements**：
- 补齐从未登记的模块（核对清单，以实际 `src/` 为准）：`contaminant-system`、`contaminant-node-system`、`defense-engine`、`tool-system`、`growth-system`、`tide-system`、`impact-system`、`stability-tracker`、`run-controller`、`extraction-system`、`loot-system`、`trail-system`、`ui/minimap`、`entities/purification-module`、`src/generated/`
- 修正过期的"规划中"标记：`GameState`、`SaveManager`、`ChaosSystem`、`HUD`、`DOM UI` 实际均已实现
- 保留仍然真实的"规划中"：`AudioManager`、`InteractionTrigger`、`MapGenerator`（`src/generation/` 确不存在）
- 每行的"对外接口"列写真实导出签名，不要照抄设计意图
- 完成后把 frontmatter 的 `changed-this-slice` 重置为 `false`，并删掉正文里两条"待下次全量补核"的临时说明

**Done when**：注册表每一行都能在 `src/` 找到对应文件（或明确标注不存在）；`src/` 里每个模块都能在注册表找到一行。

---

### T1: Fine/Rare 七种主动工具效果

| Field | Value |
| ----- | ----- |
| Agent | code |
| Dispatch | 🔴 |
| Depends | - |
| Est. | 3h（建议拆两批） |

**Brief**：在 `tool-system.ts` 补齐 7 种主动工具。效果定义以 `data/contaminants.csv` 的 `description_tool` 为准，参数取 `tool_uses` / `tool_range_px` / `tool_duration_ms`。

| id | 效果 | 实现要点 |
| -- | ---- | -------- |
| `compress` | 重力锚：指定位置 6s，半径 2 格内敌人移速 -60% 且无法改变移动方向 | 已有 `erode` 的领域类工具可参照；"无法改变移动方向"需在 AI 移动层加锁 |
| `mirror` | 镜像诱饵：原地留分身 8s，视野内敌人优先对镜像产生怀疑，被接触后碎裂 | 需要 AI 感知层支持"假目标"；与 `stitch` 的感知干预同层 |
| `echo` | 回响脉冲：半径 3 格，敌人巡逻方向反转 + 3s 原地停滞 | 参照 `kindle` 的范围感知过载 |
| `resonate` | 共振链接：在视野内两点间建能量弦 10s，穿越者弹回 3 格 + 眩晕 2s | 两点选取交互参照 `stitch`（同为双点工具）；"弹回"需要位移接口 |
| `overwrite` | 规则覆写：目标敌人 15s 巡逻路线反转 + 感知范围 -50%，追击中则立刻降级为 RETURN | 纯 AI 状态操作，无新表现需求 |
| `abyss` | 深渊之眼：10s 内全图敌人与薪柴节点位置标记（含视野外），使用后 5s 混乱增速 +50% | 需要 minimap / HUD 出口显示视野外标记 → **触碰 UI，见 T4 的 U1-U12 约束** |
| `combust` | 焚天：脚下半径 3 格焚烧场 8s，敌人每秒受伤 + 感知范围 -50%，玩家免疫 | 持续伤害需接 `combat-system`；参照 `erode` 领域 |

**Requirements**：
- 复用现有的工具激活/消耗管线（`activateTool` → 按 `toolType` 过滤 → 扣 `usesRemaining`）
- 不新建工具基类；现有 8 个实现是 switch + 私有方法，保持一致
- 每个工具的表现层先用现有占位手法（与 Slice 4 的 8 个工具同级），正式 VFX 归 T4
- `abyss` 的全图标记要走 minimap 现有渲染层，不要另起 overlay

**Done when**：15 种主动工具全部可激活并产生 CSV 描述的效果；`npm run typecheck` 通过。

---

### T2: `siphon` 被动工具

| Field | Value |
| ----- | ----- |
| Agent | code |
| Dispatch | 🔴 |
| Depends | - |
| Est. | 1h |

**Brief**：补齐第 3 件被动工具。击杀敌人时吸取 2 薪柴，且此后 5s 内混乱增速减半。

**Requirements**：
- 按 `scatter` / `muffle` 的既有模式实现：`initPassiveTools` 里登记、事件驱动触发、触发时消耗一次 `usesRemaining`
- 触发点是击杀事件（`combat-system` 已有敌人死亡出口）
- 5s 混乱减半走 `debuffs` 结构，与现有 `scatterFillRateMult` 同层
- CSV 的 `tool_duration_ms: 5000` 即减半窗口

**Done when**：装备 `siphon` 后击杀敌人可见薪柴 +2 且混乱增速可观测下降；次数耗尽后失效。

---

### T3: 防御侧未接线机制全量补齐 🚧 等设计拍板

| Field | Value |
| ----- | ----- |
| Agent | design（先）→ code（后） |
| Dispatch | 🔴 |
| Depends | 设计讨论结论 |
| Est. | design 1h + code 3h |

**Brief**：`defense-engine.ts` 的 `applyGenericDefense()` 里有 6 处机制以注释形式留空。本任务把它们全部接上。

**⚠️ 本任务不预写实现方案。** 人明确要求：不允许"觉得难就降级"。下列议题必须先经设计讨论拍板，`code` 才能开工。拍板结论落地时同步更新 `docs/specs/system-purification-impact.md`（与 B1 合并做）。

**待拍板的设计议题**（详细分析见 `docs/progress/current-slice.md` 的「设计讨论清单」）：

| # | 机制 | 待决 |
| - | ---- | ---- |
| D1 | `abyss` 动态减伤 | 低血判定用伤害结算**前**还是**后**的 HP |
| D2 | `combust` 累积焚尽 | 焚尽阈值的确切数值（CSV 只写"约等于 2 次满额冲击"）；治疗出口 |
| D3 | 污染物运行时状态是否进存档 | 影响 `combust` 累加器、`echo` 的 +2 上限、以及既有的 `solidify` 计数器 |
| D4 | `overwrite` 模块功能互换 | 是否忠于原设计实现（已核实为单点改造，非跨系统重构） |
| D5 | `erode` / `resonate` 的"其他 slot" | 第 4 防御槽解锁后（T5）语义如何界定 |
| D6 | 预告系统 | `mirror` 的镜像误导 + T5 的预告准确率 + backlog 的"方向无空间意义"三者撞在一起 |

**已确认无设计争议、可直接实现的部分**（拍板后一并交付）：
- `resonate` / `erode` 的跨 slot 冲击计数加成 → defense-engine 返回 `bonusCharges: Record<contaminantId, number>`，由 `contaminant-system.applyImpactCharges()` 消费
- `echo` 的工具次数 +1 → defense-engine 返回 `toolUseGrants`，由上层执行（上限规则待 D3）
- `mirror` 的按承伤返还薪柴 → 把 mirror 的结算移到伤害确定之后（现在 `kindlingGain` 在伤害计算前就累加完了）
- `abyss` 的减伤计算本身 → `context` 已在参数里，改掉 `_context` 即可（时点待 D1）

**Done when**：`applyGenericDefense()` 里不再有 `handled externally` / `future iteration` 注释；18 种污染物的防御行为均与 CSV 描述一致。

---

### T4: 工具使用 VFX（roadmap C3）

| Field | Value |
| ----- | ----- |
| Agent | **art（必经）→ code** |
| Dispatch | 🔴 |
| Depends | T1（工具行为先落地，VFX 才有挂载点） |
| Est. | art 2h + code 3h |

**Brief**：15 种主动工具目前使用时缺乏统一的视觉语言。art 先出视觉规格，code 再实现。

**art 阶段的硬约束**（来源 `guides/99-review.md` FV-01，本项目实测七轮返工的教训）：
- **先做载体决策**：工具 VFX 属世界内表现（Phaser 层），不是 DOM——但仍需明确它是"角色施放的动作"还是"世界被改写的痕迹"
- **必须锚定 2-3 个具名游戏参考**并写进规格。这是实测中唯一能稳定拉住风格的输入
- 视觉真相优先级：ui spec > `docs/design-notes/ui-art-overhaul.md` > `docs/art-direction.md` §6 > `docs/world.md` 术语表
- 规格需覆盖：施放瞬间 / 持续期领域 / 结束消散 三个阶段，以及"被影响的敌人"如何标示
- 与世界观对齐：工具是**污染物转化而来的异源造物**，视觉上不应是干净的魔法特效
- **B3 一并做**：`art-direction.md` §6.2/§6.4 的措辞复核（Director 此前做过最小事实回填，需 art 确认符合其规范体系）

**code 阶段**：按 art 规格实现，程序化绘制优先（与 Slice 4.5 的地表/边界同路径），不引入位图资产。

**收尾**：逐条过 `docs/specs/_template-ui.md` 末尾的「游戏内 UI 验收清单」U1-U12。

**循环预算**：art 规格迭代最多 3 轮；到顶未收敛升级给人。

---

### T5: 永久改造深度 + `upgrades.csv` 三项落地

| Field | Value |
| ----- | ----- |
| Agent | design → code（面板部分经 art） |
| Dispatch | 🔴 |
| Depends | design 结论；与 T3 的 D5/D6 耦合 |
| Est. | design 1.5h + code 3h + art 1h |

**Brief**：Slice 4 遗留的"永久改造太浅"。`upgrades.csv` 已有三项标注 `[Slice5设计任务-暂不实现]`，本任务落地它们，并由 design 判断三项是否足以解决"浅"的问题。

| id | 内容 | 实现影响 |
| -- | ---- | -------- |
| `growth_sortie_slot` | 解锁第 4 个出击工具槽（3 主动 + 1 被动） | **改 loadout 面板布局** |
| `growth_defense_slot` | 解锁第 4 个防御槽 | **改 defense 面板布局**；与 T3 的 D5 耦合（`erode`/`resonate` 的"其他 2 个"语义） |
| `growth_forecast_clarity` | 冲击预告准确率 +5%/级，3 级 | 与 T3 的 D6 耦合（预告系统本身有已知缺陷） |

**Requirements**：
- design 先回答："这三项加上去，改造是否还浅？"——如果不够，给出方向而非直接扩表
- 三项实现完成后，**去掉 CSV 描述里的 `[Slice5设计任务-暂不实现]` 标记**并重跑 `npm run codegen`
- 第 4 槽位的面板改动**必须经 art**（载体决策 + 具名参考），收尾过 U1-U12。这是本 Slice 唯一可能失控的 UI 工作
- 槽位数量不得硬编码在面板里；现有按 `toolType` 过滤的槽位约束要跟着扩展

**Done when**：三项改造可购买可生效；第 4 槽位在两个面板中可用且过 U1-U12。

---

### T6: 净化点模块受损三态视觉

| Field | Value |
| ----- | ----- |
| Agent | code |
| Dispatch | 🔴 |
| Depends | - |
| Est. | 1.5h |

**Brief**：规格已在 `docs/design-notes/ui-art-overhaul.md` B3 完整给出（含逐色值），**不需要 art 再出规格**，直接实现。

**Requirements**（照抄 B3）：

| 状态 | 视觉 |
| ---- | ---- |
| 健康 | 正常绘制 + 指示灯 `#44aa66` 常亮 |
| 受损 | 框架增加 2-3 条 1px 裂缝线（`#151a1e`）+ 指示灯 `#b89040` 每 500ms 闪烁 |
| 严重受损 | 框架裂缝加宽 + 指示灯熄灭（`#2a2d32`）+ 边缘 2-3px teal 渗入点 `#1aad96` |

- 程序化绘制，与 Slice 4.5 的模块绘制同路径
- 阈值取模块 HP 百分比；具体分界若 spec 未定义，取 >60% / 30-60% / <30% 并登记进 `system-purification-impact.md`（与 B1 合并）
- 收尾过 U1-U12 中与世界内装置相关的条目

**Done when**：三态在游戏内可见且能通过打击模块观察到状态迁移。

---

## 清账任务（随对应主任务顺带）

### B1: `system-purification-impact.md` 漂移回填

| Agent | Dispatch | Depends | Est. |
| ----- | -------- | ------- | ---- |
| design | 🔴 | 与 T3 拍板结论合并做 | 1h |

已知漂移（来源 `backlog-issues.md`）：
- `MODULE_INITIAL_HP` 80↔70、`REPAIR_PER_KINDLING` 10↔4、`BASE_IMPACT_DAMAGE` 25↔30 与代码不符
- `INTENSITY_STEP` / `MAX_INTENSITY` 已被潮汐系统取代仍列在表里
- 规则 2 只写两个交互物体（场景实为五个）
- 规则 9 说"不做 localStorage"（`SaveManager` 已存在）

一并写入：T3 拍板后的防御机制规则、T6 的三态阈值。完成后 `interface-changed` 按实际是否改接口设置。

### B2: `system-growth-tide.md` exposes 对齐

| Agent | Dispatch | Depends | Est. |
| ----- | -------- | ------- | ---- |
| code | 🔴 | - | 10min |

`exposes` 写 `TideSystem.getCurrentPhase()` / `getIntensity()`，代码实际是 `getState()` / `getCurrentIntensity()`。改文档对齐代码。

### B3: `art-direction.md` §6.2/§6.4 措辞复核

| Agent | Dispatch | Depends | Est. |
| ----- | -------- | ------- | ---- |
| art | 🔴 | 并入 T4 的 art 调用 | 20min |

Director 此前做了最小事实回填（按钮状态改游戏语义、面板改右侧抽屉 440px）以对齐已验证实现。需 art 确认措辞符合其规范体系。

### B4: `PURIFICATION.BOUNDARY.BREATH_*` 死常量清理

| Agent | Dispatch | Depends | Est. |
| ----- | -------- | ------- | ---- |
| code | 🔴 | - | 30min |

5 个常量是旧"整体脉动"方案残留，呼吸层真实调参内联在 `boundary-breath.ts`。删死常量，并把内联值迁回 `constants.ts`。

---

## 派发顺序

```
可立即开工（互不依赖）：
  T0 注册表补核 ─── code
  T1 七种主动工具 ── code
  T2 siphon 被动 ─── code
  T6 三态视觉 ────── code
  B2 / B4 ────────── code（顺带）

等设计讨论拍板：
  D1-D6 讨论 ──> T3 design 出结论 ──> T3 code 实现 ──> B1 回填 spec
                                  └─> T5 design（D5/D6 与其耦合）──> T5 art ──> T5 code ──> U1-U12

等 T1 落地：
  T4 art 规格（含 B3）──> T4 code ──> U1-U12
```

**Director 建议**：T3 与 T5 都挂在同一批设计议题上（D5 槽位语义、D6 预告系统），讨论一次性覆盖两者，不要分两轮。T1/T2/T6/T0 与设计讨论完全无关，可并行推进而不必等待。

## 机器闸门

- `npm run codegen`（改 CSV 后必跑）
- `npm run typecheck`
- `npm run build`
- UI 类任务（T4 / T5 / T6）额外过 U1-U12

**逃逸兜底**：同一任务连续 2 次过不了闸门 → 停止重试，升 T1 档重做，记入 `guides/98-field-notes.md`。
