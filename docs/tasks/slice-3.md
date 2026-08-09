---
status: ACTIVE
created-by: director agent
created-when: 2026-08-09
slice: 3
---

# Slice 3 Task Briefs: 角色成长 + 潮汐经济

## 范围决策（人拍板 2026-08-09）

| # | 决策点 | 决定 | 说明 |
| - | ------ | ---- | ---- |
| 1 | 潮汐替代线性递增 | **TideSystem 状态机** | 5 个 Tide 各含 Rise/Crest/Ebb，打破单调下行螺旋 |
| 2 | 污染物数量 | **Slice 3 实现 3 种**（固化/延时/侵蚀） | 覆盖三档 rarity + 效果差异大 + 实现可控 |
| 3 | 永久改造数量 | **3 个**（渗透抗性/薪柴亲和/生命强化） | 每轴 1 个，验证改造循环 |
| 4 | 存档方式 | **localStorage** | key = 'coh-save-v1'，自动保存于返回净化点时 |
| 5 | 美术门禁 | **并行推进，不阻塞系统实现** | A-G1/A-G2 独立跑 |

## 依赖图

```
T1 (Types + Events + Constants)
 │
 ├── T2 (TideSystem)  ─────────────────────────┐
 ├── T3 (ContaminantSystem) ───────────┐        │
 ├── T4 (GrowthSystem) ───────────┐    │        │
 ├── T5 (StabilityTracker) ──┐    │    │        │
 └── T6 (SaveManager) ───────┼────┼────┼────────┤
                              │    │    │        │
                              v    v    v        v
                         T9 (Integration wiring) ◄── connects all to existing systems
                              │    │    │
         ┌────────────────────┘    │    └────────────────────┐
         v                         v                          v
    T10 (Defense slot UI)     T7 (Rift contaminant nodes)   T12 (Altar UI) [P1]
         │                    T8 (Tool system)              T13 (Tide+Stability HUD) [P1]
         │                         │
         v                         v
    T11 (Loadout UI) ◄────── T8
         │
         v
    T14 (QA)
```

**并行机会**：
- T2, T3, T4, T5, T6 彼此独立，T1 完成后可全部并行
- T7 和 T8 在 T3 完成后可并行
- T10, T11, T12, T13 互相独立（各自依赖不同上游）
- A-G1, A-G2 全程与系统任务并行

---

## T1: Types + Events + Constants 扩展

| 字段 | 值 |
| ---- | -- |
| Agent | code |
| 派发 | 🔴 人主导 |
| 依赖 | 无 |
| 预估 | 1.5h |
| 产出 | 修改 `src/types/events.ts`, `src/types/game-types.ts`, `src/config/constants.ts` |

### Brief

为 Slice 3 全部新系统铺设类型基础和配置常量。所有后续任务依赖本任务。

**1. 新增事件（`src/types/events.ts`）**

在 `GameEvent` enum 中添加：
- `CONTAMINANT_ACQUIRED` — payload: `{ contaminant: Contaminant }`
- `CONTAMINANT_TRANSFORMED` — payload: `{ contaminantId: string }`
- `CONTAMINANT_BROKEN` — payload: `{ contaminantId: string }`
- `GROWTH_PURCHASED` — payload: `{ upgradeId: string, newLevel: number }`
- `TIDE_PHASE_CHANGED` — payload: `{ tide: number, phase: string, intensity: number }`
- `STABILITY_CHANGED` — payload: `{ progress: number, delta: number }`
- `TOOL_USED` — payload: `{ contaminantId: string, toolType: string, usesLeft: number }`

在 `EventPayloads` 接口中添加对应类型映射。

**2. 新增/扩展类型（`src/types/game-types.ts`）**

按 spec 状态模型定义：
- `TidePhase = 'rise' | 'crest' | 'ebb'`
- `TideState` interface
- `ContaminantType` union (10 种)
- `ContaminantStage = 'defense' | 'tool' | 'broken'`
- `ContaminantRarity = 'common' | 'fine' | 'rare'`
- `Contaminant` interface
- `GrowthState` interface
- `StabilityState` interface
- 更新 `SaveData`（`src/types/save-data.ts`）：添加 tide / contaminants / defenseSlots / sortieLoadout / growth / stability 字段

**3. 新增常量（`src/config/constants.ts`）**

在 `GAME_CONSTANTS` 中新增段：

```typescript
TIDE: {
  // 5 个 Tide 的数值表（floor/peak/riseCycles/crestCycles/ebbCycles/ebbTarget）
  // 直接搬 spec 数值表
  TIDES: [...],
  CREST_CHARGE_COST: 3,  // 高潮冲击计 3 点
  NORMAL_CHARGE_COST: 1,
},
CONTAMINANT: {
  NODES_PER_MAP_MIN: 2,
  NODES_PER_MAP_MAX: 3,
  RARITY_WEIGHTS: { common: 60, fine: 30, rare: 10 },
  DEFENSE_SLOTS: 3,
  SORTIE_SLOTS: 3,
  TRANSFORM_THRESHOLD: 3,  // impactCharges >= 3 即转化
  // 每种污染物的防御效果参数
  DEFENSE_EFFECTS: { solidify: {...}, delay: {...}, erode: {...} },
  // 每种工具的使用次数
  TOOL_USES: { common: 5, fine: 3, rare: 2 },
},
GROWTH: {
  UPGRADES: [
    { id: 'growth_chaos_resist', maxLevel: 5, effectPerLevel: 0.04 },
    { id: 'growth_kindling_affinity', maxLevel: 3, effectPerLevel: 1 },
    { id: 'growth_vitality', maxLevel: 4, effectPerLevel: 15 },
  ],
  COST_CURVE: [8, 12, 18, 25, 35],
},
STABILITY: {
  MAX: 100,
  GAIN_EXTRACTION: 2,
  GAIN_UPGRADE: 3,
  GAIN_CREST_SURVIVED: 5,
  GAIN_TIDE_ADVANCE: 8,
  LOSS_MODULE_ZERO: -1,
},
```

**验收标准**：`tsc --noEmit` 通过；所有新类型在后续系统中可直接 import 使用。

---

## T2: TideSystem 状态机

| 字段 | 值 |
| ---- | -- |
| Agent | code |
| 派发 | 🔴 人主导 |
| 依赖 | T1 |
| 预估 | 2h |
| 产出 | `src/systems/tide-system.ts` |

### Brief

实现潮汐状态机，替代 `gameState.incrementIntensity()` 的线性递增模型。

**核心职责**：
1. 维护 `TideState`（tideNumber / phase / cycleInPhase / currentIntensity）
2. 每次出击返回时调用 `advanceCycle()` 推进状态
3. Rise 阶段：intensity 线性增长至 peak
4. Crest 阶段：intensity 保持 peak；Final Tide 的 Crest 无限持续
5. Ebb 阶段：intensity 线性下降至 ebbTarget
6. 阶段切换时 emit `TIDE_PHASE_CHANGED`
7. Tide 切换时自动进入下一 Tide 的 Rise（intensity 连续）

**对外 API**（spec exposes）：
- `getCurrentPhase(): TidePhase`
- `getIntensity(): number`
- `getTideNumber(): number`
- `isCresting(): boolean` — 供冲击系统判断高潮冲击
- `advanceCycle(): void` — 供场景流调用
- `getState(): TideState` — 供 SaveManager 序列化
- `loadState(state: TideState): void` — 供 SaveManager 恢复

**数值来源**：从 `GAME_CONSTANTS.TIDE.TIDES` 读取，不硬编码。

**第一次出击豁免**：cycle=0 不推进状态（保留 Slice 2 行为）。

**验收标准**：单独可跑（不依赖 Phaser），调用 advanceCycle() 30 次后 state 变化序列正确。

---

## T3: ContaminantSystem 库存 + 防御生命周期

| 字段 | 值 |
| ---- | -- |
| Agent | code |
| 派发 | 🔴 人主导 |
| 依赖 | T1 |
| 预估 | 2.5h |
| 产出 | `src/systems/contaminant-system.ts` |

### Brief

管理污染物的完整生命周期：获取 → 库存 → 装备防御 slot → 承受冲击 → 转化 → 出击工具 → 使用 → 破碎。

**1. 库存管理**
- `addContaminant(type, rarity): Contaminant` — 创建并加入库存
- `removeContaminant(id): void` — 移除（broken 时调用）
- `getInventory(): Contaminant[]` — 全量
- `getByStage(stage): Contaminant[]` — 按阶段筛选

**2. 防御 slot 管理（3 个等价 slot）**
- `equipToDefense(contaminantId, slotIndex): boolean`
- `unequipFromDefense(slotIndex): Contaminant | null`
- `getDefenseSlots(): (Contaminant | null)[]`

**3. 冲击处理**
- `processImpact(isCresting: boolean): DefenseResult[]`
  - 对每个非空 slot：(a) 计算防御效果；(b) `impactCharges += cost`（1 或 3）
  - 若 `impactCharges >= TRANSFORM_THRESHOLD`：自动转化（`stage = 'tool'`），弹出 slot，emit `CONTAMINANT_TRANSFORMED`
  - 返回每个 slot 的减伤结果（供 ImpactSystem 使用）

**4. 防御效果实现（Slice 3 的 3 种）**
- `solidify`：减轻 35% 伤害，该模块 maxHP -3%
- `delay`：参照 `docs/design-notes/slice3-contaminant-brainstorm.md` 精良级效果
- `erode`：参照同文件稀有级效果

**5. 出击工具管理**
- `equipToSortie(contaminantId, slotIndex): boolean`
- `getSortieLoadout(): (Contaminant | null)[]`
- `useTool(slotIndex): ToolUseResult` — `usesRemaining--`；到 0 则 `stage = 'broken'`，emit `CONTAMINANT_BROKEN`

**序列化 API**：
- `getState(): { contaminants, defenseSlots, sortieLoadout }`
- `loadState(state): void`

**验收标准**：`tsc --noEmit` 通过；生命周期状态转换正确（defense → tool → broken 单向不可逆）。

---

## T4: GrowthSystem 永久改造

| 字段 | 值 |
| ---- | -- |
| Agent | code |
| 派发 | 🔴 人主导 |
| 依赖 | T1 |
| 预估 | 1.5h |
| 产出 | `src/systems/growth-system.ts` |

### Brief

3 个永久改造 + 费用扣除 + 效果修正计算。

**改造项**（从 `GAME_CONSTANTS.GROWTH.UPGRADES` 读取）：
| ID | 效果 | 上限 |
| -- | ---- | ---- |
| `growth_chaos_resist` | BASE_RATE -4%/级（乘法） | 5 级 |
| `growth_kindling_affinity` | 拾取薪柴 +1/级（加法） | 3 级 |
| `growth_vitality` | MAX_HEALTH +15/级（加法） | 4 级 |

**购买逻辑**：
- `canPurchase(upgradeId): boolean` — 检查等级上限 + 薪柴余额
- `purchase(upgradeId): boolean` — 扣除 kindlingReserve，升级，emit `GROWTH_PURCHASED`
- 费用从 `COST_CURVE[currentLevel]` 读取

**效果 API**：
- `getUpgradeLevel(id): number`
- `getModifiers(): GrowthModifiers` — 返回 `{ chaosRateModifier, kindlingBonus, maxHealthBonus }`
- 各系统在需要时调用 getModifiers() 合并到 SortieModifiers

**永久性**：一旦购买不可撤销、不降级。

**序列化 API**：
- `getState(): GrowthState`
- `loadState(state): void`

**验收标准**：购买后 getModifiers() 返回正确倍率；费用正确扣除；超过上限拒绝购买。

---

## T5: StabilityTracker 净化稳定度

| 字段 | 值 |
| ---- | -- |
| Agent | code |
| 派发 | 🔴 人主导 |
| 依赖 | T1 |
| 预估 | 1h |
| 产出 | `src/systems/stability-tracker.ts` |

### Brief

净化稳定度积分系统。按 spec 规则 21-23 实现。

**积分规则**（从 `GAME_CONSTANTS.STABILITY` 读取）：
| 行为 | 积分 |
| ---- | ---- |
| 成功撤离 | +2 |
| 购买任意改造升级 | +3 |
| 完整度过一次 Crest（无模块归零） | +5 |
| 潮汐切换（进入新 Tide） | +8 |
| 模块归零 | -1 |

**API**：
- `addProgress(reason, delta): void` — 计入 + 钳位 0-100 + emit `STABILITY_CHANGED`
- `getProgress(): number`
- `hasReached100(): boolean`

**监听事件**（自动积分）：
- `RIFT_EXITED`（survived=true）→ +2
- `GROWTH_PURCHASED` → +3
- `TIDE_PHASE_CHANGED`（从 crest → ebb 且无模块 hp=0）→ +5
- `TIDE_PHASE_CHANGED`（tideNumber 增加）→ +8
- `MODULE_DAMAGED`（newHealth=0）→ -1

**到达 100%**：仅设 `reached = true`，不触发终局。后续 Slice 扩展。

**序列化 API**：`getState() / loadState()`

**验收标准**：监听各事件后 progress 正确累加/钳位；100% 后 hasReached100() = true。

---

## T6: SaveManager 持久存档

| 字段 | 值 |
| ---- | -- |
| Agent | code |
| 派发 | 🔴 人主导 |
| 依赖 | T1 |
| 预估 | 2h |
| 产出 | `src/managers/save-manager.ts`，修改 `src/scenes/main-menu-scene.ts` |

### Brief

localStorage 持久存档，替代 session-only 内存状态的易失性。

**存储**：
- Key: `'coh-save-v1'`
- 格式: JSON.stringify(SaveData)
- `SaveData.version = 1`

**API**（spec exposes）：
- `save(): void` — 从各系统收集状态写入 localStorage
- `load(): SaveData | null` — 读取 + 解析 + 版本检查
- `hasSave(): boolean` — 快速检查是否有存档
- `deleteSave(): void` — "New Expedition" 时清除

**保存时机**：每次返回净化点时自动保存（在 purification-scene 的 create/resume 中调用）。

**加载流程**：
1. 主菜单检查 `hasSave()`
2. 有存档 → 显示 "Continue" + "New Expedition"
3. Continue → `load()` → 恢复全部状态 → 进入净化点场景
4. New Expedition → `deleteSave()` → 重置全部状态 → 进入净化点场景

**版本迁移骨架**：
```typescript
function migrate(data: unknown): SaveData {
  // version 1: current, no migration needed
  // future: if (data.version === 1) { ...migrate to 2... }
}
```

**容错**：parse 失败或版本不支持 → 返回 null，主菜单不显示 Continue。

**验收标准**：save → 刷新页面 → load 后全部状态恢复正确（tide/contaminants/growth/stability/modules/kindling/cycle）。

---

## T7: 裂隙污染物节点

| 字段 | 值 |
| ---- | -- |
| Agent | code |
| 派发 | 🔴 人主导 |
| 依赖 | T3 |
| 预估 | 1.5h |
| 产出 | 修改 `src/scenes/rift-scene.ts`, `src/scenes/rift-map-data.ts`, `src/systems/loot-system.ts` |

### Brief

裂隙地图中新增污染物节点——区别于薪柴节点的新拾取物。

**节点定义**：
- 视觉：深紫色脉冲方块（区别于薪柴的 teal）。颜色建议 `0x7B2D8B` 或类似。
- 数量：每张地图 2-3 个（从 `GAME_CONSTANTS.CONTAMINANT.NODES_PER_MAP_MIN/MAX` 读取）
- 放置：在 map data 中增加 `contaminantNodes` 数组（位置与 kindling 节点不重叠）
- 拾取条件：走过即拾取（与薪柴一致，共用 pickup radius）

**拾取逻辑**：
1. 玩家进入 pickup radius
2. 按 rarity 权重（60/30/10）随机决定稀有度
3. 从该稀有度的可选 type 中随机选一（Slice 3 范围：solidify / delay / erode，各占其档）
4. 调用 `contaminantSystem.addContaminant(type, rarity)`
5. Emit `CONTAMINANT_ACQUIRED`
6. 节点消失 + 短暂拾取特效（紫色闪光）

**HUD 反馈**：拾取时 HUD 短暂显示"[污染物名称] acquired"（类似 kindling 的 +N 提示）。

**验收标准**：进入裂隙后可见紫色节点；拾取后库存中出现对应污染物；节点不可重复拾取。

---

## T8: 出击工具系统（3 种工具实现）

| 字段 | 值 |
| ---- | -- |
| Agent | code |
| 派发 | 🔴 人主导 |
| 依赖 | T3 |
| 预估 | 3h |
| 产出 | `src/systems/tool-system.ts`，修改 `src/scenes/rift-scene.ts` |

### Brief

出击中使用已转化的污染物工具。Slice 3 实现 3 种（全部为主动类型）。

**ToolSystem 框架**：
- 出击开始时从 `contaminantSystem.getSortieLoadout()` 初始化
- 键位绑定：Q = slot 0 主动工具，F = slot 1 主动工具（slot 2 如果也是主动则无键位）
- 使用时：emit `TOOL_USED`，`usesRemaining--`，到 0 调用 contaminantSystem.useTool()
- 冷却管理（防连按）：最小间隔 500ms

**工具 1：凝锁（solidify → tool）**
- 类型：主动，指向型
- 效果：冻结视野内最近的一个敌人 4 秒（不可移动/转向/感知）
- 冻结结束后敌人进入 alert 状态
- 视觉：目标身上白色晶格覆盖（简单的 tint + alpha pulse）
- 使用次数：5
- 参照：`docs/design-notes/slice3-sortie-tools.md` "凝锁"

**工具 2：时裂（delay → tool）**
- 类型：主动，放置型
- 效果：在玩家当前位置放置装置，半径 2 格（64px）内敌人感知冻结 8 秒（不升级状态）
- 已在 chase 的敌人不受影响
- 视觉：淡蓝色涟漪从放置点扩散 + 范围内敌人指示点停止闪烁
- 使用次数：3
- 参照：`docs/design-notes/slice3-sortie-tools.md` "时裂"

**工具 3：侵蚀领域（erode → tool）**
- 类型：主动，放置型
- 效果：在玩家当前位置释放领域，半径 4 格（128px），持续 12 秒
  - 领域内敌人：移速 -40%，感知范围 -30%，chase 速度降至 patrol 级别
  - 玩家不受影响
- 视觉：暗紫色半透明区域 + 缓慢脉动
- 使用次数：2
- 参照：`docs/design-notes/slice3-sortie-tools.md` "侵蚀领域"

**与 AI 系统的交互**：
- 凝锁：设置 enemy.frozen = true → AI FSM 在 frozen 状态下跳过所有 update
- 时裂：区域内 enemy 的 detect_fill_rate = 0（感知不升级）
- 侵蚀领域：区域内 enemy 的 speed/sight_range 乘以 debuff 系数

**验收标准**：三种工具各自效果正确；使用次数正确递减；到 0 自动 broken；键位响应正确。

---

## T9: Integration Wiring（新系统接入现有代码）

| 字段 | 值 |
| ---- | -- |
| Agent | code |
| 派发 | 🔴 人主导 |
| 依赖 | T2, T3, T4, T5 |
| 预估 | 2h |
| 产出 | 修改 `src/managers/game-state.ts`, `src/systems/impact-system.ts`, `src/systems/chaos-system.ts`, `src/systems/loot-system.ts`, `src/scenes/purification-scene.ts` |

### Brief

将 T2-T5 的新系统接入现有游戏流程，替代旧的线性模型。

**1. TideSystem → ImpactSystem**
- 删除 `gameState.incrementIntensity()`（旧线性递增）
- ImpactSystem 改为从 `tideSystem.getIntensity()` 读取当前强度
- ImpactSystem 在冲击结算时调用 `tideSystem.advanceCycle()` 推进
- 高潮冲击判断：`tideSystem.isCresting()` → 防御 slot chargesCost = 3

**2. ContaminantSystem → ImpactSystem**
- 冲击计算流程修改：伤害计算后 → 调用 `contaminantSystem.processImpact(isCresting)` → 获取各 slot 减伤 → 应用到模块
- "先防御后转化"：本次冲击的防御效果在转化前生效

**3. GrowthSystem → SortieModifiers 扩展**
- 扩展 `SortieModifiers` 接口：添加 `maxHealthBonus`
- `gameState.getSortieModifiers()` 合并模块效果 + 改造效果：
  - `chaosRateModifier = moduleBarrierMod * growthChaosMod`（乘法叠加）
  - `kindlingValueModifier = moduleStorageMod`（不变）
  - `kindlingBonus = growthAffinity`（加法，loot-system 用）
  - `maxHealthBonus = growthVitality`（加法，player 用）
- ChaosSystem 使用合并后的 chaosRateModifier
- LootSystem 在 pickup 时：`value = base + kindlingBonus`，再乘 storageModifier

**4. GameState 重构**
- 将 `impactIntensity` 相关逻辑委托给 TideSystem
- 添加对各新系统的引用/协调
- `reset()` 扩展：重置 tide/contaminant/growth/stability

**5. PurificationScene 场景流**
- 返回净化点时：调用 SaveManager.save()
- 进入裂隙前：弹出 loadout 选择（T11 的 UI 挂载点）

**验收标准**：完整跑一轮循环（净化点→裂隙→撤离→冲击→分配→再出击），新系统全部参与且行为正确；旧的线性递增已被替代。

---

## T10: 防御 slot 管理 UI

| 字段 | 值 |
| ---- | -- |
| Agent | code |
| 派发 | 🔴 人主导 |
| 依赖 | T3, T9 |
| 预估 | 2h |
| 产出 | `src/ui/dom/defense-panel.ts`，修改 `src/scenes/purification-scene.ts` |

### Brief

净化点中管理防御 slot 的 DOM 面板。

**触发方式**：走到净化点特定交互区域（类似模块交互），按 E 打开。

**面板内容**：
- 3 个防御 slot 显示（空/已装备+类型+charges）
- 库存中 `stage === 'defense'` 的污染物列表
- 装备操作：从库存拖/点击到 slot
- 卸下操作：从 slot 移回库存
- 关闭按钮/ESC 关闭

**信息展示**（每个已装备的污染物）：
- 名称 + 稀有度颜色
- 当前 impactCharges / 3（进度指示）
- 防御效果简述（一行文字）

**转化通知**：冲击结算后如果有污染物转化，在面板外以 toast 形式通知"[名称] 已转化为出击工具"。

**视觉风格**：复用 allocation-panel 的 DOM overlay 风格（深色半透明背景 + 白色/teal 文字）。

**验收标准**：能装备/卸下污染物；slot 状态与 ContaminantSystem 同步；charges 显示正确。

---

## T11: 出击前 Loadout 选择 UI

| 字段 | 值 |
| ---- | -- |
| Agent | code |
| 派发 | 🔴 人主导 |
| 依赖 | T3, T8 |
| 预估 | 1.5h |
| 产出 | `src/ui/dom/loadout-panel.ts`，修改 `src/scenes/purification-scene.ts` |

### Brief

出击前从工具库存中选择携带装备的 DOM 面板。

**触发方式**：走到裂隙入口按 E 时，先弹出 loadout 面板，确认后再切场景。

**面板内容**：
- 3 个出击 slot（可以少于 3 个，允许空 slot）
- 库存中 `stage === 'tool'` 的污染物列表
- 每件显示：名称 + 类型（主动/被动）+ 效果摘要 + 剩余使用次数
- 装备/移除操作
- "出发"按钮（确认 loadout 并进入裂隙）
- "返回"按钮（取消出击）

**键位提示**：slot 0 → Q，slot 1 → F，slot 2 → 无键位（仅被动生效）。在 slot 旁标注。

**空 loadout 允许**：0 件工具也可以出击（不阻止）。

**视觉风格**：同 defense-panel / allocation-panel。

**验收标准**：能选择/移除工具；确认后进入裂隙且 ToolSystem 拿到正确的 loadout；空 loadout 可出击。

---

## T12: 改造祭坛 UI [P1]

| 字段 | 值 |
| ---- | -- |
| Agent | code |
| 派发 | 🔴 人主导 |
| 依赖 | T4, T9 |
| 预估 | 1.5h |
| 产出 | `src/ui/dom/growth-altar-panel.ts`，修改 `src/scenes/purification-scene.ts` |

### Brief

净化点"改造祭坛"交互面板。

**触发方式**：净化点新增一个祭坛交互点（地图上可见标记），走近按 E 打开。

**面板内容**：
- 3 个改造项卡片：
  - 名称 + 当前等级 / 上限
  - 效果描述（当前级 → 下一级的数值变化）
  - 费用（下一级所需薪柴）
  - "购买"按钮（灰色=不可购买：余额不足/已满级）
- 当前薪柴余额显示
- 关闭按钮/ESC

**购买反馈**：购买成功后卡片刷新 + 短暂高亮 + 薪柴余额更新。

**满级状态**：显示"MAX"替代购买按钮。

**验收标准**：能购买改造；费用正确扣除；满级后按钮禁用；余额不足时按钮禁用。

---

## T13: 潮汐信息 + 稳定度 HUD [P1]

| 字段 | 值 |
| ---- | -- |
| Agent | code |
| 派发 | 🔴 人主导 |
| 依赖 | T2, T5, T9 |
| 预估 | 1h |
| 产出 | 修改 `src/scenes/purification-scene.ts` 或 `src/ui/hud.ts` |

### Brief

净化点场景中显示潮汐状态和稳定度进度。

**潮汐信息**：
- 位置：净化点 HUD 顶部区域
- 内容：`Tide [N] - [Phase]`（如 "Tide 2 - Rise"）
- 视觉强调：Crest 阶段文字变红/加粗

**稳定度进度条**：
- 位置：净化点 HUD 下方
- 内容：进度条 0-100% + 数字
- 100% 时：进度条变色 + 文字"净化完成...?"

**冲击结果面板扩展**：
- 在现有 impact-result-panel 中增加一行：当前 Tide/Phase 信息
- 高潮冲击时特殊标注"高潮冲击！"

**验收标准**：净化点中可见潮汐信息和稳定度；数值与系统状态同步；Crest 有视觉区分。

---

## T14: QA 验收

| 字段 | 值 |
| ---- | -- |
| Agent | qa |
| 派发 | 🟢 Director 派发 |
| 依赖 | T1-T13 全部完成 |
| 预估 | 1h |
| 产出 | `docs/qa/slice-3-report.md` |

### Brief

对照 `docs/specs/system-growth-tide.md` 进行全面验收。

**检查维度**：
1. 事件契约：7 个新事件全部正确 emit + payload 类型正确
2. 潮汐状态机：5 个 Tide 的数值序列正确（Rise/Crest/Ebb 时长 + intensity 计算）
3. 污染物生命周期：获取→防御→转化→工具→破碎 完整路径
4. 防御效果：3 种污染物的减伤/副作用正确
5. 出击工具：3 种工具效果+持续时间+使用次数正确
6. 永久改造：费用曲线+效果数值+上限
7. 稳定度：5 种积分行为正确触发
8. 存档：save → 刷新 → load 后状态完整恢复
9. 边界情况（spec "边界情况" 表格逐条验证）
10. 叠加计算：改造+模块+工具效果叠加公式正确

---

## A-G1: 玩家角色 32px sprite 可读性验证 [美术门禁，并行]

| 字段 | 值 |
| ---- | -- |
| Agent | art |
| 派发 | 🔴 人主导（需运行外部生图模型） |
| 依赖 | 无（与系统任务并行） |
| 预估 | 视验证轮次而定 |

### Brief

验证问题：在 32px 尺度下，玩家角色 sprite 是否具备足够的可读性（轮廓清晰、与背景区分度、方向感知）？

流程：art agent 出 prompt → 人用外部模型生图 → art agent 评审 → 人最终审美确认。

参照 `docs/progress/art-validation-tracker.md` 的 A-G1 条目。

---

## A-G2: 俯视角敌人 sprite 验证 [美术门禁，并行]

| 字段 | 值 |
| ---- | -- |
| Agent | art |
| 派发 | 🔴 人主导（需运行外部生图模型） |
| 依赖 | 无（与系统任务并行） |
| 预估 | 视验证轮次而定 |

### Brief

验证问题：俯视角敌人 sprite 是否与玩家有足够区分度、状态指示是否清晰可读？

流程：同 A-G1。

参照 `docs/progress/art-validation-tracker.md` 的 A-G2 条目。

---

## 总结

| 统计 | 值 |
| ---- | -- |
| 系统任务（T1-T14） | 14 个 |
| 美术任务（A-G1/G2） | 2 个 |
| 总预估工时（系统） | ~23h |
| 关键路径 | T1 → T3 → T8 → T11 → T14 |
| 最大并行宽度 | 5（T2/T3/T4/T5/T6 同时） |
| P0 任务 | T1-T11 |
| P1 任务 | T12, T13 |
