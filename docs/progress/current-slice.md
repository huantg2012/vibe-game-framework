---
status: COMPLETE
created-by: director agent
created-when: 2026-08-12
last-modified: 2026-08-12
completed: 2026-08-12
note: Slice 5 已收尾（人决定关闭并转入 Slice 5.5 UX 重构）。Task Brief 见 docs/tasks/slice-5.md。收尾结论见文末「Slice 5 收尾」。
---

# Slice 5: 工具库深度（Fine/Rare 补完 + 工具视觉 + 改造深度）【COMPLETE】

类型：系统 Slice（补完已有系统的深度，不新建系统边界）
日期：2026-08-12 启动
验证问题：**出击前的"带什么"决策是否变得纠结？拿到一件 Fine/Rare 污染物时，玩家是否会在"当防御吃着"和"攒成工具用"之间真的犹豫？**

> 范围已于 2026-08-12 经人拍板锁定。Task Brief：`docs/tasks/slice-5.md`。
> **T3（防御侧接线）与 T5（改造深度）在设计议题 D1-D6 拍板前不开工**，见文末「设计讨论清单」。

---

## Step 1 一致性检查结果（2026-08-12）

### 已自动修正

| 项 | 处理 |
| -- | ---- |
| `art-direction.md` `changed-this-slice: true` 滞留 | 重置为 false（该标记的实际诉求是"art agent 复核措辞"，已在 backlog 单独跟踪，不该占用变更标记位） |
| `system-purification-impact.md` `interface-changed: true` 滞留 | 重置为 false（边界 spec 是对已落地实现的事后描述，六个消费方在写 spec 时已逐个核对） |
| roadmap 写「9 种 Fine/Rare 工具」 | 实测 `contaminants.csv` 为 Fine 6 + Rare 5 = **11 种**，已订正 |
| roadmap 指向 `current-slice.md` 查 Slice 4.5 逐 commit 范围 | 该文件每 Slice 覆写，指针会失效；已改为指向 commit `ad14cf5` |

### 需要报告的不一致（未自行修正）

**1. `architecture.md` 模块注册表的欠账比 backlog 记录的更大。**
backlog 记的是"若干'规划中'标记过期"。实际核对下来，除标记过期外（`GameState` / `SaveManager` / `ChaosSystem` / `HUD` / `DOM UI` 实际都已存在），还有 **约 14 个 Slice 2/3/4 落地的模块从未登记进注册表**：`contaminant-system`、`contaminant-node-system`、`defense-engine`、`tool-system`、`growth-system`、`tide-system`、`impact-system`、`stability-tracker`、`run-controller`、`extraction-system`、`loot-system`、`trail-system`、`ui/minimap`、`entities/purification-module`、`src/generated/`。
→ 排为本 Slice **T0**，先做再开工。`changed-this-slice` 保持 true 直到 T0 完成。（4.5 的教训正是"只补核一部分"，这次不重复。）

**2. 「Fine/Rare 工具」这个说法掩盖了真实缺口的形状。** 见下方「范围推导」——缺的不是 11 件同质工具，是 3 类不同性质的活。

**3. 敌人属性全在 `constants.ts` 的 `GAME_CONSTANTS.AI`，与 CLAUDE.md「策划数据源规则」冲突。**
该规则明确把"敌人属性"列为必须以 CSV 为源。目前只有 `contaminants.csv` / `upgrades.csv` 走了 codegen 管线。第二敌人一旦开工就会把这个矛盾逼到台面（要么建 `data/enemies.csv` 并把渗透体一起迁过去，要么显式破例）。
→ 这是把第二敌人拆出本 Slice 的理由之一。

**4. `docs/content/progression.md` 至今是 `status: TEMPLATE`（空模板）。**
CLAUDE.md 描述的文档体系里 `content/*.md` 承载内容条目，实际内容条目的真相在 `data/*.csv`，这个目录无人写也无人读。属于「某个步骤产出无人消费」的框架信号。
→ 建议本 Slice 收尾时二选一：填充为 CSV 的人读索引，或删除并从 CLAUDE.md 移除。已记框架反馈。

**5. 框架漂移（非阻塞，记 field note）**：director 定义 Step 1 要求核对 CLAUDE.md 的「系统全景」和「内容汇总」两张表格，CLAUDE.md 里不存在这两张表（状态记在"当前阶段"散文段落里）。要么补表，要么改 agent 定义。

### 核对通过

- `docs/specs/` 6 个系统 spec 与 `src/` 模块一一对应，无"标已实现但无代码"的情况
- `docs/tasks/` 命名惯例为 `slice-N.md`（无前导零）；Slice 4.5 无 task 文件符合轻量路径规则
- 改写体 / 覆盖体概念图已 `APPROVED`（2026-07-23），第二敌人的美术前置已就绪

---

## 范围推导

### 「Fine/Rare 工具」的真实缺口

代码核对（`tool-system.ts` / `defense-engine.ts`）后，缺口是三类活，不是一类：

| 类 | 内容 | 量 |
| -- | ---- | -- |
| A. 主动工具效果 | 已实现 8/15。缺 `resonate` `overwrite` `compress` `mirror` `echo` `abyss` `combust` | 7 |
| B. 被动工具 | 已实现 `scatter` `muffle`。缺 `siphon`（击杀吸薪柴 + 混乱增速减半） | 1 |
| C. 防御侧接线 | 18 型中 10 型有专用实现，其余 8 型落到 `applyGenericDefense`，其中 6 处源码里明写 `handled externally` / `future iteration` 从未接线 | 6~8 |

C 类是本 Slice 真正的技术难点——它们要跨系统持久状态，不是在一个 switch 里加分支：

- `resonate` / `erode`：改**其他 slot** 的冲击计数
- `echo`：给工具库里某件工具 **+1 使用次数**
- `mirror`：按实际承伤 **返还薪柴**（需在伤害结算后回读）+ 10% 概率**预告镜像反转**
- `abyss`：按**模块当前 HP** 动态叠加减伤（最高 65%）
- `combust`：跨冲击**累积焚尽值**，达阈值自动爆发治疗
- `overwrite`：25% 概率**模块功能互换**（源码注释判定"Slice 4 太复杂，跳过"）

### 为什么建议把第二敌人拆出去

roadmap 原计划把「Fine/Rare 工具 + 第二敌人 + 新改造 + 工具 VFX + 改造深度」放进一个 Slice。按 director 标准这超了（3-7 天 / 可独立验证）：

- 两块工作验证的是**不同的轴**。工具/改造验证「出击前的装配决策」；第二敌人验证「裂隙内的临场潜行判断」。混在一个 Slice 里，试玩反馈无法归因。
- 第二敌人有独立的前置债（enemies.csv 决策 + `system-enemy-ai.md` 的 `type: 'infiltrator'` 字面量类型泛化 + spec L36 明写"改写体/覆盖体属于后续 Slice"）。
- 单是 A+B+C 三类活（7 工具 + 1 被动 + 6~8 跨系统接线 + VFX）已经是一个完整 Slice 的量。

→ **已拍板：拆。** Slice 5 = 装配轴，Slice 6 = 第二敌人（潜行轴），原 Slice 6/7（净化点扩张 / 程序化地图）整体顺移为 7/8。

---

## 锁定范围（人已拍板 2026-08-12）

| # | 拍板问题 | 结论 |
| - | -------- | ---- |
| 1 | 是否拆分 | **拆**，后续 Slice 整体顺移（6=第二敌人 / 7=净化点扩张 / 8=程序化地图） |
| 2 | Fine/Rare 做全还是分批 | **全做 11 种**，不接受半实现态 |
| 3 | 是否授权 design 降级复杂机制 | **否决**。不允许"觉得难就降级"，改为设计讨论（D1-D6）后再实现 |
| 4 | 顺手清账四项 | **全收** |
| 5 | P1（T5 改造深度 / T6 三态视觉） | **全收** |

### P0（验证问题直接依赖）

| # | 任务 | agent | 备注 |
| - | ---- | ----- | ---- |
| T0 | `architecture.md` 模块注册表全量补核 | code | 开工前置。~14 个未登记模块 + 过期"规划中"标记 |
| T1 | Fine/Rare 主动工具 7 种效果实现 | code | resonate / overwrite / compress / mirror / echo / abyss / combust |
| T2 | `siphon` 被动工具实现 | code | 补齐被动工具第 3 件 |
| T3 | 防御侧未接线机制全量补齐 | design → code | 🚧 等 D1-D6 拍板。**不预写降级方案** |
| T4 | 工具使用 VFX（roadmap C3） | **art → code** | 必经 art：载体决策 + 2-3 个具名游戏参考；收尾过 U1-U12 |

### P1（已确认纳入）

| # | 任务 | agent | 备注 |
| - | ---- | ----- | ---- |
| T5 | 永久改造深度扩展（Slice 4 遗留）+ `upgrades.csv` 三项落地 | design → code | 第 4 工具槽 / 第 4 防御槽 / 预告准确率。**第 4 槽位会改 loadout / defense 面板布局 → 触发 U1-U12** |
| T6 | 净化点模块受损三态视觉 | code | 规格已在 `ui-art-overhaul.md` B3 完整给出（含配色），纯实现，不需要 art 再出规格 |

### 顺手清账（已确认全收）

| # | 任务 | 理由 |
| - | ---- | ---- |
| B1 | `system-purification-impact.md` 既有漂移回填（HP 80↔70 / 修复 10↔4 / 伤害 25↔30 / 过时的 INTENSITY_STEP / 规则 2 与规则 9） | T3 必然要读改这个 spec |
| B2 | `system-growth-tide.md` `exposes` 与代码对齐（`getState()` / `getCurrentIntensity()`） | 一行修正 |
| B3 | `art-direction.md` §6.2/§6.4 措辞复核 | 与 T4 同一次 art 调用里做，零额外开销 |
| B4 | 清理死常量 `PURIFICATION.BOUNDARY.BREATH_*`，内联值迁回 constants | 便宜，且 4.5 刚留下的 |

### 暂不纳入

| 项 | 去向 |
| -- | ---- |
| 第二敌人（改写体） | → Slice 6（独立验证轴 + enemies.csv 前置债） |
| 冲击预告方向映射无空间意义 | → **纳入**（T5 含预告准确率改造，三议题合并为 D6） |
| BoundaryBreath 槽位"替换最旧"bug | → 推迟（纯视觉，影响极小） |
| 净化点扩张 / 程序化地图 | → 顺延为 Slice 7 / 8 |
| 音效接入 / i18n 补全 | → 未排期 |

---

## 设计讨论清单（D1-D6，等人拍板）

> 人否决了"授权 design 降级并回写 CSV"的路径。本节是替代品：把每个未接线机制的设计意图、真实实现难点、可选方案摊开，讨论后再实现。**T3 与 T5 在此拍板前不开工。**

**前置更正**：上一轮我把 `overwrite` / `abyss` / `combust` 列为"过复杂需降级"，那是照抄 Slice 4 源码注释里的判断（`too complex for Slice 4` / `future iteration`）而没有核实。核实后：`abyss` 所需的数据**已经**传进函数只是被忽略；`overwrite` 的"模块功能"实际就是两个标量且只有一个访问入口。真正需要讨论的不是"要不要降级"，而是下面这六个具体的语义/架构选择。

---

### D1 — `abyss` 的低血判定时点

**设计意图**（CSV）：基础减伤 20%，每有一个模块 HP 低于 50% 额外 +15%，最高 65%（三模块均低于半血）。叙事是"模块越危急防御越强的逆风守护"。

**实现难点**：**没有难点。** `DefenseContext` 已携带 `moduleHps` / `moduleMaxHps`，`applySlotEffect()` 把参数标为 `_context` 忽略了而已。数一下低于半血的模块数即可。

**真正要决定的**：判定用**本次伤害结算前**还是**结算后**的 HP？
- 结算前：那记压垮性的一击（正是把模块打到半血以下的那一击）不吃加成。玩家要先被打惨，之后才获得守护。
- 结算后：会自我指涉——减伤影响伤害，伤害又反过来影响减伤，需要定义迭代或近似。

**建议**：结算前。既避开自我指涉，也更贴"你已经处于危急才有加成"的叙事。

---

### D2 — `combust` 的焚尽阈值与治疗出口

**设计意图**（CSV）：减伤 25%，累积所受伤害为焚尽值；达阈值（"约等于 2 次满额冲击"）时自动释放，把累积伤害的 50% 以修复形式返还给 HP 最低的模块。副作用：爆发时下次出击初始混乱 +10。

**实现难点**：两点，都不是设计问题。
1. 需要跨冲击的累加器——但 `solidifyCounters` 已经是同一形状的先例（`Map<contaminantId, number>`），架构上不新。
2. `DefenseResult` 目前没有"治疗某模块"的出口，要加一个字段并让 impact-system 消费。纯工程量。

**真正要决定的**：阈值的确切数值。CSV 写的是"约等于 2 次满额冲击"，这不是一个能写进代码的数。需要一个明确值（例如 `BASE_IMPACT_DAMAGE × 2`，或独立常量）。

**建议**：定为固定常量而非"2 次冲击"的推导值——冲击伤害会随潮汐强度浮动，用推导值会让触发时机变得不可预期，而这个机制的乐趣恰恰在于"我快攒满了"的预期感。

---

### D3 — 污染物运行时状态是否进存档（跨领域架构决定）

**背景**：这不是某一件污染物的问题，是一类。`solidifyCounters` 目前**不进存档，重载即清零**。Slice 5 会再加两个同类状态：`combust` 的焚尽累加器、`echo` 的"单件最多 +2"上限计数。

**风险**：`solidify` 丢计数只影响一次减伤档位，无感。但 `combust` 攒到 90% 时退出游戏，回来归零——这个玩家会察觉，且会觉得是 bug。`echo` 的上限计数丢失则相反：会让玩家能超出设计上限反复获益。

**可选方案**：
- A. 把污染物运行时状态纳入 `SaveManager`。一次性解决三个，且顺带修掉 `solidify` 的既有缺陷。成本是存档结构要扩展 + 版本兼容。
- B. 接受重载清零，并在设计上避免长周期累积（例如 `combust` 改为单次冲击内结算）。这是真正意义上的改设计，需要你同意。
- C. 只给 `combust` 单独存档，其余不管。省事但留下不一致。

**建议**：A。这是本 Slice 唯一一个"现在不做、以后每加一件带状态的污染物都要重付"的决定。

---

### D4 — `overwrite` 的模块功能互换

**设计意图**（CSV，副作用）：25% 概率"模块功能互换 1 次出击"。

**Slice 4 的判断**：源码注释写 `too complex for Slice 4, skip`。

**核实结论**：**这个判断是错的。** `GameState.getModuleEffect(type)` 是模块效果的唯一入口，全项目只有三处消费方（两个面板显示 + 一处构建出击修正）；而"模块功能"实际就是两个标量——CORE 给 `chaosRateModifier`，STORAGE 给 `kindlingValueModifier`。互换 = 在这个入口上加一个开关。是单点改造，不是跨系统重构。

**真正要讨论的是设计而非实现**：
1. **可读性**：互换后玩家怎么知道？面板、HUD 都按模块身份显示。若无明确提示，玩家只会觉得数值乱了。
2. **它是个惩罚**（副作用），25% 概率触发，持续一次出击。互换两个标量的实际后果是"混乱增速修正与薪柴收益修正对调"——这在数值上可能是惩罚，也可能是奖励（取决于两个模块当时哪个更强）。**一个有 25% 概率反而帮到你的惩罚，设计意图是不成立的。**

**可选方案**：
- A. 忠于原设计实现互换，并在出击开始的 toast 里明确提示"模块功能已互换"（该 toast 通道 Slice 4 已建，用于防御副作用来源提示）。接受"有时反而有利"的随机性，把它当作 rare 层的混沌感。
- B. 保留互换机制，但改为**只在对玩家不利时触发**（比较两个修正值，仅当互换后更差时才生效）。语义清晰但失去混沌感，且实现上要多一次比较。
- C. 换一个语义单一的惩罚副作用（例如"下次出击 STORAGE 效果归零"），承认互换这个点子在两标量模型下不成立。

**建议**：A。理由是 `overwrite` 的世界观是"模式覆盖时空——极快速度重写现实规则"，不可预测本身就是它的性格；而且这是 rare 层，玩家已经在承担高风险高回报。但这条**明确需要你判断**，因为它关系到"副作用到底该不该总是负面"这个跨全表的原则。

---

### D5 — `erode` / `resonate` 的"其他 slot"在第 4 槽位下的语义

**设计意图**：`erode` — 每次冲击使其他 2 个防御 slot 的污染物额外 +1 冲击计数；`resonate` — 30% 概率全 slot 同步 +1 计数。

**实现难点**：没有。冲击计数的唯一递增点是 `contaminant-system.applyImpactCharges()`，defense-engine 返回一张 `bonusCharges` 加成表由它消费即可。

**真正要决定的**：T5 会解锁第 4 个防御槽。CSV 里 `erode` 写死了"其他 **2** 个"。四槽时是仍然只影响 2 个（选哪 2 个？），还是"其他所有"？

**建议**：改为"其他所有槽位"，并同步改 CSV 描述文案（这是描述与规则对齐，不是降级）。写死数量会让每次扩槽都要回来改一遍。同时这会让 `erode` 在四槽下更强——如果不希望，可以把加成从 +1 降到别的值，但那是数值调参，等试玩再说。

---

### D6 — 预告系统（三个议题撞在一起）

这是本批里唯一涉及**既有系统有缺陷**的一项。三件事指向同一个地方：

1. `mirror` 的副作用：10% 概率"冲击方向预告镜像反转（误导）"
2. T5 的改造项 `growth_forecast_clarity`：冲击预告准确率 +5%/级
3. backlog 已记的缺陷：`getForecastAngle()` 把 CORE→左、STORAGE→右，**而 CORE 就在场地中心**，"左"是任选的；且它只认识两个模块，场景实际有五个交互点；再叠上 BoundaryShape 的压力主方向，玩家同时看到两个互不相关的方向暗示

**问题**：在一个方向本身就没有空间意义的系统上，实现"镜像反转误导"和"准确率提升"，等于给坏地基加两层楼。"反转"一个任意方向，玩家察觉不到差异；"准确率提升"提升的是什么的准确率也说不清。

**可选方案**：
- A. 先重做预告系统（让方向对应真实的空间来源——例如压力主方向或实际受击模块的位置），再实现 `mirror` 反转与准确率改造。代价是本 Slice 多一块设计工作。
- B. 把预告改成非空间的（只告知"强度"与"目标模块名"，不给方向），那么 `mirror` 的误导 = 谎报模块，准确率 = 谎报概率下降。语义立刻清晰，且不需要空间重做。
- C. 先按现状接线，把预告重做推到以后。

**建议**：B。它同时解掉三个问题且工作量最小——方向暗示交给 BoundaryShape 的压力可视化（那个是真有空间意义的），预告面板只负责"打谁、多重"。C 不推荐：会让本 Slice 交付两个明知无意义的功能。

---

## 派发顺序

```
可立即开工（与设计讨论无关）：
  T0 注册表补核 / T1 七种主动工具 / T2 siphon / T6 三态视觉 / B2 / B4  ── code

等 D1-D6 拍板：
  D1-D6 讨论 ──> T3 design 结论 ──> T3 code ──> B1 回填 spec
             └─> T5 design（D5/D6 与其耦合）──> T5 art ──> T5 code ──> U1-U12

等 T1 落地：
  T4 art 规格（含 B3）──> T4 code ──> U1-U12
```

**约束提醒**：本项目刚修完 in-game UI 的框架弱点（`guides/99-review.md` FV-01）。T4 工具 VFX 与 T5 第 4 槽位面板改动**必须走 art 路径**，art 需先做载体决策并锚定 2-3 个具名游戏参考；收尾逐条过 `docs/specs/_template-ui.md` 的 U1-U12。不允许直接派 code 写样式。

---

## Director 交付汇总（2026-08-12）

范围内全部任务已实现，机器闸门（`codegen` / `typecheck` / `build`）全绿。收尾结论见文末「Slice 5 收尾」。

### 实际交付（超出原定范围两项）

| 任务 | 状态 | 备注 |
| ---- | ---- | ---- |
| T0 架构注册表全量补核 | 完成 | 新增 21 行、修正 6 行状态；`changed-this-slice` 已重置 |
| T1 七种 Fine/Rare 主动工具 | 完成 | 15 种主动工具全部可用 |
| T2 `siphon` 被动工具 | 完成 | 被动工具补齐至 3 种 |
| T3 防御侧未接线机制 | 完成 | 6 处 `handled externally` 全部接线，另补 2 处从无 stub 的琐碎项 |
| T4 工具使用 VFX | 完成 | art 规格 `docs/art/tool-vfx-spec.md` + code 实现 `src/systems/tool-vfx.ts`（8 视觉族群） |
| T5 改造深度 + 三项新改造 | 完成 | 含成长系统泛化：成本改读 CSV、ID 列表收敛到单一来源 |
| T6 模块受损三态视觉 | 完成 | 阈值 >60% / 30-60% / <30% |
| B1 purification spec 回填 | 完成 | 修 6 项旧漂移 + 登记 13 条新规则（D 组 51-61、V 组 62-63） |
| B2 growth-tide exposes 对齐 | 完成 | 另修正槽位数固定为 3 的过时描述 |
| B3 art-direction §6 复核 | 完成 | 补"临界"态 + 与 `ui-art-overhaul.md` 的权威关系 |
| B4 `BREATH_*` 死常量清理 | 完成 | 删 5 个死常量，迁回 13 个内联值 |
| **T7 修复失效的工具 debuff 管线**（计划外） | 完成 | 见下 |
| **T8 补实四处 CSV 承诺但无代码的机制**（计划外） | 完成 | 见下 |

### 计划外增加的两项，及其理由

**T7 — Slice 4 的 8 个工具对敌人没有真实效果。** T1 的 code agent 在实现新工具时发现 `ToolDebuffs` / `getDebuffs()` / `notifyEnemySuspicious()` / `notifyProximityAvoid()` 在全项目零消费方——玩家按键、扣次数、看到特效，但敌人行为完全不变。这直接架空本 Slice 的验证问题（15 件工具里有 8 件是假的，"带什么"就无从纠结），故当场纳入范围。已统一收敛为直连 setter 模式，删除描述符管线，不留死接口。顺带修了 `retrograde` 的绘制深度低于视野暗雾（导致它唯一的卖点"离开视野仍可见"从来没成立过）。

**T8 — 四处 CSV 承诺了但代码从未接的机制。** 在回填 spec 与收口时逐一浮现：`resonate` 的装备期模块上限 +10%（连 stub 都没有）、`siphon` 的修复效率翻倍（`setRepairEfficiencyMult` 有人写没人读，CSV 承诺 1 薪柴=8hp 实际永远 4）、`proximity_sense_boost`（muffle 防御副作用空实现）、`muffle` 的预告提前一轮（见 DEC-040）。这些都属于"CSV 是策划真相源"这条项目规则被违反的实例，与本 Slice"不接受半实现态"的拍板一致，故一并补齐。

### 已知遗留（不阻塞验收，已进 backlog）

- `abyss` 的 65% 减伤上限触不到——公式按 CSV 字面实现，但游戏只有 CORE/STORAGE 两个模块，实际上限 50%。第三模块要到 Slice 7，届时自动成立。`stitch` 的 CSV 文案同样假设 3 模块。
- 四个占位数值 CSV 结构装不下：`combust` 每秒伤害、`mirror` 诱饵接触半径、`resonate` 两点最大距离（CSV 字段为 0，而同构的 `stitch` 是 96px，疑为数据疏漏）、`abyss` 的第二个计时（5s 混乱惩罚，CSV 每行只有一个 duration 列）。当前作为 `constants.ts` 常量，需要 CSV 扩列才能回归数据源规则。
- `purification-hud` 未套 `.game-panel`——该文件自身设计为无边框符号网格，与 `.game-panel` 风格互斥。code agent 选择延续该文件已验证的符号语言，此判断留给 QA/人确认。
- `GameState.incrementIntensity()` 的 +0.15 残留仍在每次冲击末尾被调用（结果总被潮汐覆盖，玩法无影响）；`DefenseContext.stabilityProgress` 恒为 0。
- `architecture.md` 的「项目结构」ASCII 目录树列了三个不存在的文件（`entities/interactables.ts`、`ui/components/status-bar.ts`、整个 `generation/`）——T0 只补核了注册表，目录树不在其范围。

---

## T3 / D3 / B4 完成状态（code agent，2026-08-12）

- **T3（防御侧未接线机制全量补齐）**：`defense-engine.ts` 的 6 处 `handled externally`/`future iteration` 全部接线，均照 D1-D6 拍板结论实现（未重新论证、未降级）：`abyss` 动态减伤（DEC-029，判定用伤害结算前 HP）、`combust` 累积焚尽（DEC-030，阈值定为固定常量 `PURIFICATION.COMBUST_BURN_THRESHOLD = 60` = 2×`BASE_IMPACT_DAMAGE(30)`）、`overwrite` 模块功能互换（DEC-031，25% 概率，出击开始 toast 播报"模块功能已互换"）、`resonate`/`erode` 跨 slot 冲击计数（DEC-033，`erode` 改为"其他所有槽位"且已同步 CSV 文案+codegen）、`echo` 工具次数+1（单件最多+2，见 D3）、`mirror` 按承伤返还薪柴（结算移到伤害确定之后）。顺带补齐两处 CSV 有描述但源码完全没有 stub 的琐碎项：`abyss` 5%概率满HP模块扣10%HP、`erode` 20%概率初始混乱+8（均为与已有 `kindle`/`echo` 同构的机械模式，非新设计）。
- **发现但未处理、需 escalate 的一项**：`resonate` 的 CSV 主效果"装备期间 CORE/STORAGE 模块效果上限各+10%"目前完全没有任何代码路径（连 stub 都没有）。这是一个"装备时被动生效"的效果，与 Slice 4 就已搁置的 `muffle` 预告提前同属一类（至今未实现）。不在 T3 枚举的 6 项范围内，也不在 D1-D6 任一议题内，需要单独拍板是否纳入 Slice 5 还是转 backlog。
- **发现的 CSV/设计不一致，未自行修改**：`abyss` 文案"最高65%当3模块均低于半血"假设 3 个模块，但游戏实际只有 CORE/STORAGE 2 个模块，2 模块全部低血最高只能到 50%，65% 永远触及不到。已按公式字面实现（`min(0.65, 0.20+N×0.15)`），行为正确、上限数字暂时是摆设，需设计判断是否改文案或改公式。
- **D3（污染物运行时状态进存档）**：新增 `ContaminantRuntimeState`（`solidifyCounter`/`combustAccumulator`/`echoBonusGranted`，`defense-engine.ts` 定义，`contaminant-system.ts` 复用同一类型）。`SaveManager` 合并两个模块的快照为存档里的单一 `contaminantRuntimeState` 字段（按 contaminant id 索引）；老存档缺该字段时 `loadDefenseRuntimeState`/`loadEchoBonusState` 均以空态兜底。顺带修了一个此前从未被调用过的 `resetDefenseEngine()`（`main-menu-scene.ts` 的"新远征"现在会调用它，此前 `solidifyCounters` 新游戏不清零）。
- **B4（清理死常量）**：删除 `PURIFICATION.BOUNDARY.BREATH_BASE_ALPHA/AMP/FREQ/CREST_FREQ_MULT/EBB_AMP_MULT`（5 个，旧整体脉动方案残留，零消费方）；把 `boundary-breath.ts` 里原本内联的 13 个调参值（`SAMPLE_COUNT`/`MAX_IMPACTS`/`ARC_HALF_MIN/MAX`/`SPAWN_DIST_MIN/MAX`/`IMPACT_DURATION_MIN/MAX`/`SPAWN_INTERVAL_MIN/MAX`/`WAVE_COLOR`/`MEMBRANE_COLOR`/`DEFORM_MAX_PX`）迁入 `PURIFICATION.BOUNDARY.BREATH`，行为数值不变。
- **架构文档滞留**：`architecture.md` 里 `DefenseEngine` 一行仍写着"6 处机制标注 handled externally/future iteration 待 Slice5 T3 接线"，已过期。本任务禁止改 `architecture.md`（归 T0/Director），仅在此标注待更新。
- 机器闸门：`npm run codegen`（CSV 改了 erode/combust 两行）/ `npm run typecheck` / `npm run build` 均通过。详见 `decisions-log.md` DEC-037。

## T1 / T2 完成状态（code agent，2026-08-12）

- **T1（七种主动工具）**：`compress` / `mirror` / `echo` / `resonate` / `overwrite` / `abyss` / `combust` 已在 `tool-system.ts` 实现，15 种主动工具全部可激活。为支撑 AI 层效果，`AISystem` 新增 7 个设置方法（速度倍率 / 移动方向锁定 / 感知倍率 / 巡逻反转 / 强制 RETURN / 诱饵位置 / 击退），`state-machine.ts` 新增诱饵重定向逻辑，`combat-system.ts` 新增 `applyToolDamage()`，`chaos-system.ts` 新增 `setTemporaryRateReduction()`，`minimap.ts` 新增 `showAbyssReveal()`。详见 `decisions-log.md` DEC-036。
- **T2（`siphon` 被动）**：已实现，击杀事件驱动，走与 scatter/muffle 相同的登记-触发-耗次模式。
- **发现但未处理的问题（升报 Director）**：核实发现 Slice 4 的 8 个既有工具（solidify/erode/delay/kindle/stitch/retrograde/scatter/muffle）对敌人的游戏效果从未被消费——`ToolDebuffs`/`getDebuffs()` 全项目无调用方。这不在 T1/T2 范围内，仅记录、未修复。
- **CSV 描述歧义/未定值，已用占位数值实现，需设计确认**：`combust` 每秒伤害量、`mirror` 诱饵接触半径、`resonate` 两点选取的最大距离（CSV `tool_range_px` 为 0，未如 `stitch` 一样给出限制）。数值定义见 `constants.ts` `GAME_CONSTANTS.TOOLS` 注释。
- 机器闸门：`npm run typecheck` / `npm run build` 均通过。

## T4（art 阶段）/ B3 完成状态（art agent，2026-08-12）

- **T4 art 阶段**：产出 `docs/art/tool-vfx-spec.md`（新建）。载体决策：工具 VFX 是"世界被改写的痕迹"，不是"角色施放的动作"（`expand` 因效果发生在玩家自身例外）。锚定 3 个具名参考：Into the Breach（AOE 形状语言——矩形网格块取代当前实现的圆形）、Hyper Light Drifter（能力特效的帧数/质感，已有锚点扩展新维度）、Darkest Dungeon（受影响单位标示的克制度）。15 件工具归纳为 8 个视觉族群，规格已给出三阶段时序模板、色值表（严格落在 `palette.json` 内）、受影响敌人标示规则（主标示复用坏像素/感知点亮度联动，零新增基元；副标示方括号仅用于纯行为类效果）。
- **发现并记录的问题（需 code agent 阶段处理）**：当前 8 个 Slice 4 占位实现的色值大量不在锁定色板内（白色/蓝灰/橙黄/暗红/紫色），且普遍用圆形填充/描边和连续 alpha tween 渐隐——均与 `art-direction.md` §4.2"矩形网格数据错误"签名冲突。规格已逐一列出违规色值和替换值（A3-2），并要求消散阶段改为离散跳变（A3-5）。这不是本次新引入的问题，是补规格时发现的既有偏差。
- **T5 第 4 槽位视觉判断（并入本次 art 调用）**：结论**复用即可**——440px 面板宽度下单行 4 列槽位仍可读（≈95px/格，文字纵向排列不受影响），不需要新视觉规格或分组布局。唯一需要 code agent 注意的技术点：`loadout-panel.ts` 的 `SLOT_LABELS` 需扩到 4 项且必须与实际键位绑定一致（U7）。
- **B3（art-direction.md §6.2/§6.4 措辞复核）**：已直接改 `art-direction.md`（§6.2 补"临界"态、§6.4 补与 `ui-art-overhaul.md` 的权威关系说明），`changed-this-slice` 置 `true`。详见 `decisions-log.md` DEC-038。
- **循环预算**：本次为第 1 轮产出，未触发 3 轮上限。
- 未跑机器闸门（本阶段只产出规格文档，未改 `src/`）；`npm run typecheck`/`build` 留给 T4 code 阶段验证。

---

## Slice 5 收尾（Director Step 7，2026-08-12）

### 交付范围（实际）

锁定范围 12 项（T0-T6 / B1-B4）全部完成，另计划外补 2 项（T7 工具 debuff 管线失效修复、T8 四处 CSV 承诺但无代码的机制）。主 commit `e9f611d`，逐项状态见本文件上方各 agent 完成报告。

- 主动工具 15/15 可用（Fine/Rare 7 种补完），被动工具 3/3（`siphon` 补齐）
- 防御侧 6 处 `handled externally` 全部接线 + 2 处从无 stub 的琐碎项
- 工具使用 VFX（art 规格 `docs/art/tool-vfx-spec.md` + `src/systems/tool-vfx.ts`，8 视觉族群）
- 永久改造深度（第 4 工具槽 / 第 4 防御槽 / 预告准确率）+ 成长系统泛化
- 模块受损三态视觉
- 文档清账四项 + 架构注册表全量补核（新增 21 行 / 修正 6 行）

### 验证结论

**人决定关闭并进入打磨 Slice 5.5（UX 重构）。**

如实记录：**本 Slice 未走完整试玩签字**。已完成的验证是机器闸门（`codegen` / `typecheck` / `build` 全绿）+ 各 agent 的实现自检；人拿到了验收清单但未逐项回签，而是直接要求收尾并转入 UX 重构。因此**本 Slice 的验证问题（"出击前带什么的决策是否变得纠结？拿到 Fine/Rare 污染物时，是否真的在'当防御吃'与'攒成工具'之间犹豫？"）目前状态为未回答**，留到 Slice 5.5 的 UX 工作中一并观察——15 工具 + 18 污染物 + 4 槽位的信息量本身就是 5.5 要处理的对象，装配决策的纠结感能否被玩家感知到，取决于 5.5 的可读性结果。

这不是 PASS，也不是 FAIL：是"实现完成、体验未验证"。若 5.5 期间发现装配决策并不纠结，回退路径是回 design agent 重审工具/防御的收益结构（属结构性循环问题，不得靠改 constants 掩盖）。

### 遗留归属

全部 5 项已知遗留在 `docs/progress/backlog-issues.md` 追踪，归属如下：

| 遗留 | 归属 |
| ---- | ---- |
| `abyss` 65% 减伤上限在 2 模块下触不到（`stitch` 文案同理） | Slice 7（第三模块落地后自动成立，届时复核） |
| 四个工具占位数值 CSV 装不下（需扩列） | backlog，待 CSV 结构扩展 |
| `purification-hud` 未套 `.game-panel`（code agent 的判断待确认） | **Slice 5.5**（in-game UX 范畴，随 UX 重构一并拍板） |
| `incrementIntensity()` +0.15 残留 / `DefenseContext.stabilityProgress` 恒 0 | backlog（无玩法影响，随手清） |
| `architecture.md` 项目结构 ASCII 目录树列了 3 个不存在的文件 | backlog（T0 只补核注册表，目录树未在范围内） |
| `docs/content/progression.md` 空 TEMPLATE（产出无人消费） | backlog → 下次 retro 拍板（填充为 CSV 索引 / 删除并从 CLAUDE.md 移除）。**本 Slice 未按原计划在收尾时二选一**，因为它是框架层判断而非本 Slice 交付物 |
| 敌人属性在 `constants.ts` 而非 CSV（违反策划数据源规则） | Slice 6（第二敌人开工时必须拍板） |

### 收尾四项登记（系统 Slice 走完整路径，此处仅确认）

1. **架构登记**：T0 已全量补核注册表；`architecture.md` 中 `DefenseEngine` 那行"6 处 handled externally 待 Slice5 T3 接线"的过期描述已随 T0 处理范围外——**已并入 backlog 的目录树项一起追踪**
2. **spec 判断**：B1 回填 `system-purification-impact.md`（修 6 项漂移 + 登记 13 条新规则）、B2 对齐 `system-growth-tide.md` `exposes`；无新建 spec 文件（就地扩写，符合规则）
3. **交付范围记录**：本文件（收尾后由 Slice 5.5 覆写，历史见 commit `e9f611d` 与本次收尾 commit）
4. **UI 清单**：T4 工具 VFX 与 T5 第 4 槽位面板均触碰 UI；art 阶段已做载体决策 + 3 个具名参考锚点。**U1-U12 逐条验收未由人回签**，与试玩签字同一状态 → 转入 Slice 5.5 的强制 U1-U12 范围内一并过

### 变更标记重置

- `docs/specs/system-purification-impact.md` `interface-changed: true` → `false`（B1 回填已被 T3 消费方读取；边界规则组为对已落地实现的事后描述）
- `docs/art-direction.md` `changed-this-slice: true` → `false`（B3 §6.2/§6.4 复核已完成并被 T4 art 规格消费）

