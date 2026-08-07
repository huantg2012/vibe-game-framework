---
status: ACTIVE
created-by: director agent
created-when: 2026-08-07
slice: 2
---

# Slice 2 Task Briefs: 净化点闭环

## 范围决策（人拍板 2026-08-07）

| # | 决策点 | 决定 | 说明 |
| - | ------ | ---- | ---- |
| 1 | 净化点呈现方式 | **完整步行空间**（粒子氛围 + apparition + 模块精灵交互） | 验证支柱 3「孤独的仪式感」需要物理走动 + 边界压迫 |
| 2 | 状态持久化 | **Session-only 内存状态** | 验证问题不涉及跨 session，GameState 放内存即可 |
| 3 | 冲击频率 | **每次出击后触发冲击（N=1）** | 快速迭代验证；频率是常量后续可调 |
| 4 | 模块 0 HP | **不设 game-over，效果移除使下次出击更难** | 聚焦验证"压力链"而非"结束状态" |

## 依赖图

```
T1 (spec)
 │
 ├── T2 (GameState) ──────────────────────────────┐
 │     │                                           │
 │     └── T3 (Scene flow) ────┐                   │
 │                              │                   │
 │                              v                   │
 │                         T4 (Walkable space)      │
 │                              │                   │
 │                    ┌─────────┼─────────┐         │
 │                    v         v         v         │
 │              T5 (Atmosphere) T6 (Modules+interaction)
 │                              │         │
 │                              │         v
 │                              │    T7 (Allocation panel) ◄──┘
 │                              │         │
 │                              │         v
 │                              │    T8 (Impact system)
 │                              │         │
 │                              v         v
 │                         T9 (Module effects → sortie)
 │                                        │
 │                                        v
 └──────────────────────────────────── T10 (QA)
```

**并行机会**：T5（氛围）与 T6-T8 链无依赖，可并行。

---

## T1: 设计 spec — 净化点 + 冲击系统

| 字段 | 值 |
| ---- | -- |
| Agent | design |
| 派发 | 🔴 人主导 |
| 依赖 | 无 |
| 预估 | 2-3h |
| 产出 | `docs/specs/system-purification-impact.md` |

### Brief

为净化点的完整闭环写一份系统 spec，覆盖以下六个区域：

**1. 状态模型**
- PurificationState：modules（2 个）、kindlingReserve、cycle、impactIntensity
- 每个 Module：id、name、health（0-100）、maxHealth、effect（BARRIER/STORAGE）、allocated
- 已有类型（`game-types.ts` 的 `PurificationModule` + `ModuleEffect`）作为基础，spec 应明确值域和默认值

**2. 薪柴分配规则**
- 玩家从 kindlingReserve 中分配到各模块的 `allocated` 字段
- 约束：总分配 <= kindlingReserve；可以不分配（留余量应对修复）
- 确认后不可撤销（ALLOCATION_CONFIRMED 事件）
- 修复规则：模块 health < 100 时，可额外投入薪柴修复（修复比例 / 成本）

**3. 冲击计算**
- 每次从裂隙返回后触发（N=1）
- 冲击总威力 = impactIntensity（基础 + 每 cycle 递增量）
- 威力在模块间不均匀分布（方向 hint 给玩家：如"东侧承压集中"）
- 结算：每模块 damage = max(0, 该模块受到的威力 - allocated)
- 防御足够：模块安全，消耗部分 allocated（维护成本比例）
- 防御不足：模块受损（health -= damage），allocated 全部消耗
- health 到 0：效果完全移除，需额外薪柴修复才能恢复

**4. 模块效果定义**
- BARRIER（屏障）：满 health 时降低裂隙内 chaos BASE_RATE（乘数，如 0.7x）；health 下降时乘数线性回升至 1.0；health=0 时无加成
- STORAGE（储藏）：满 health 时提高薪柴拾取倍率（如 1.5x）或增加节点价值；health 下降时倍率线性回落至 1.0

**5. 边界氛围系统**
- 粒子发射器：净化点边界外的黑暗区域中，30-50 个大尺寸低透明度漂浮粒子
- 周期性 apparition：模糊形体每 8-15 秒 fade in/out，在边界外不同位置
- 强度耦合：粒子数量和 apparition 频率与 impactIntensity 正相关（冲击越强，外部越活跃）
- 冲击前的 warning 阶段：分配确认后、冲击结算前的短暂时间里，氛围短暂加剧（预示冲击来临）

**6. 交互触发系统**
- 模块是场景中的精灵实体，有 overlap 触发区域
- 玩家接近模块时显示交互提示（如 [E] 分配薪柴）
- 按键触发 DOM 面板
- 裂隙入口也是一个交互实体（进入确认 → 场景切换）

**对外接口（exposes）**：
- GameState.getModuleHealth(id) / getKindlingReserve() / getImpactIntensity() / getCycle()
- 模块效果查询：getChaosRateModifier() / getKindlingPickupModifier()
- 事件：ALLOCATION_CONFIRMED / IMPACT_STARTED / IMPACT_RESOLVED / MODULE_DAMAGED（已在 events.ts 预定义）

**与已有系统的接口（interfaces-with）**：
- system-chaos-scavenge-extract：消费 RIFT_EXITED 事件作为触发；向 ChaosSystem 提供 baseRate 修正值；向 LootSystem 提供拾取倍率
- system-movement-vision：共用 Player 实体 + VisibilitySystem（不同 config）
- architecture.md：scene 结构、DOM overlay 方案

**参考**：`vision.md` 净化点冲击结算详细设计段落、`world.md` 净化点设定、`architecture.md` 项目结构中的相关路径。

---

## T2: 实现 — GameState 管理器（session-only）

| 字段 | 值 |
| ---- | -- |
| Agent | code |
| 派发 | 🔴 人主导 |
| 依赖 | T1 |
| 预估 | 1-2h |
| 产出 | `src/managers/game-state.ts` |

### Brief

实现一个 session-only 的全局游戏状态管理器，跨场景共享数据。

**职责**：
- 持有净化点状态（modules、kindlingReserve）
- 持有 meta 状态（cycle 计数、impactIntensity）
- 提供查询接口给 RiftScene（模块效果修正值）和 PurificationScene（当前状态）
- 消费 RIFT_EXITED 事件：survived=true 时将 kindlingGained 加入 kindlingReserve；递增 cycle

**实现要点**：
- 导出单例（模块级 const，不是 class static —— 与 eventBus 风格一致）
- 初始值：2 个模块各 health=100，kindlingReserve=0，cycle=1，impactIntensity 按 spec 基础值
- 提供 `reset()` 用于"新游戏"
- 不涉及 LocalStorage（取舍 2）
- TypeScript strict，类型从 `game-types.ts` 的 `PurificationModule` 派生

**接口草案**（最终由 spec 定义）：
```typescript
// 查询
getModules(): readonly PurificationModule[]
getKindlingReserve(): number
getCycle(): number
getImpactIntensity(): number
getChaosRateModifier(): number      // BARRIER 模块效果
getKindlingPickupModifier(): number // STORAGE 模块效果

// 变更
addKindling(amount: number): void
allocateToModule(moduleId: string, amount: number): void
applyImpactDamage(moduleId: string, damage: number): void
repairModule(moduleId: string, amount: number, cost: number): void
advanceCycle(): void
```

**闸门**：`npm run typecheck` 通过；eventBus 订阅 RIFT_EXITED 正确触发。

---

## T3: 实现 — 场景流转（裂隙 ↔ 净化点切换）

| 字段 | 值 |
| ---- | -- |
| Agent | code |
| 派发 | 🔴 人主导 |
| 依赖 | T1, T2 |
| 预估 | 1-2h |
| 产出 | 修改 `src/scenes/rift-scene.ts`、`src/scenes/purification-scene.ts`、`src/scenes/main-menu-scene.ts` |

### Brief

将当前的"按 R 重启裂隙"改为完整的双场景循环。

**变更点**：

1. **RiftScene**：
   - 撤离成功后（RIFT_EXITED, survived=true）：延迟后 `scene.start('PurificationScene')` 而非等待 R 键重启
   - 死亡后（RIFT_EXITED, survived=false）：保留当前行为（显示死亡信息 + R 重启）或也回净化点（spec 定义）
   - 移除当前的 `runController.restart()` 循环（同一场景内重启），改为场景切换
   - RiftScene.create() 时从 GameState 读取模块效果，应用为 chaos/loot 修正

2. **PurificationScene**：
   - 场景 create 时从 GameState 读取当前状态
   - 提供"进入裂隙"的交互（T6 实现交互细节，T3 只 wire 最终的 `scene.start('RiftScene')`）

3. **MainMenuScene**：
   - "New Expedition" 从 `RiftScene` 改为 `PurificationScene`（游戏从净化点开始）
   - GameState.reset() 在开始新游戏时调用

4. **游戏流程变为**：
   ```
   Menu → PurificationScene（首次：空状态，直接可进裂隙）
       → RiftScene（出击）
       → PurificationScene（带着薪柴回来）
       → 分配 → 冲击 → 结果
       → 进入裂隙 → RiftScene ...
   ```

**闸门**：场景切换不崩溃；GameState 数据跨场景正确传递；typecheck 通过。

---

## T4: 实现 — 净化点步行空间

| 字段 | 值 |
| ---- | -- |
| Agent | code |
| 派发 | 🔴 人主导 |
| 依赖 | T1, T3 |
| 预估 | 2-3h |
| 产出 | 重写 `src/scenes/purification-scene.ts`、新增 `src/scenes/purification-map-data.ts` |

### Brief

将 PurificationScene 从占位文本变为可步行的小型俯视角场景。

**实现内容**：

1. **静态地图**（手设计，~12x10 tiles）：
   - 写死的 tile 数据（与 rift-map-data.ts 同模式）
   - 中心区域为净化点内部（地板 tile）
   - 边界外为墙/虚空（用于 visibility 遮罩）
   - 2 个模块位置标记 + 1 个裂隙入口位置标记
   - 美术方向：金属/混凝土/功能性工业材质（占位色块即可，遵循 art-direction 占位策略）

2. **Player 复用**：
   - 共用 `src/entities/player.ts`（DEC-ARCH-008）
   - 相同移动系统，无战斗、无混乱值
   - Spawn 点在地图中心附近

3. **Visibility 复用**：
   - 使用 `VisibilitySystem` 但配置不同：全向均匀光照（无锥形视野）、较大半径
   - 新增一个 `createPurificationVisionConfig()` 工厂函数
   - 边界外的黑暗区域正是后续 T5 粒子出现的画布

4. **基础渲染**：
   - TilemapRenderer 复用
   - 程序化表面纹理（类似 rift 的 `createRiftSurfaceTexture`，但使用净化点色板：冷灰/暗蓝/金属质感）
   - Camera 设置：可能需要不同 zoom（净化点小，可能 zoom=2 或保持 1.5）

5. **碰撞**：
   - 与 rift 相同：Arcade Physics + tilemap collider
   - 边界墙阻挡玩家走出

**闸门**：玩家可在 12x10 空间中自由走动；边界外为黑暗；Camera follow 工作；typecheck 通过。

---

## T5: 实现 — 边界氛围系统

| 字段 | 值 |
| ---- | -- |
| Agent | code |
| 派发 | 🔴 人主导 |
| 依赖 | T4 |
| 预估 | 2-3h |
| 产出 | 新增 `src/systems/boundary-atmosphere.ts`，修改 `purification-scene.ts` |

### Brief

在净化点边界外的黑暗区域中营造"外部污染在压迫"的视觉感受。

**实现内容**：

1. **粒子发射器**：
   - 30-50 个大尺寸（16-32px）、低透明度（alpha 0.05-0.15）的漂浮粒子
   - 在边界外的黑暗区域随机生成、缓慢漂移（速度 5-15 px/s）
   - 颜色：teal/深紫（与污染主题色一致）
   - 粒子在 visibility mask 外（黑暗区域）可见，进入光照区域时消失或 fade out

2. **周期性 Apparition**：
   - 每 8-15 秒在边界外随机位置出现一个模糊形体
   - Fade in（1-2s）→ 短暂停留（2-3s）→ Fade out（1-2s）
   - 形体大小约 48-96px，使用 Phaser Graphics 或预生成的模糊纹理
   - 同时最多 1-2 个 apparition 存在

3. **强度耦合**：
   - 系统接收 `intensity` 参数（从 GameState.getImpactIntensity() 或 spec 定义的源）
   - intensity 越高：粒子数量增加（30→50）、漂移速度加快、apparition 间隔缩短（15s→8s）
   - 冲击 warning 阶段（spec 定义的分配确认后、结算前）：临时 boost intensity 到最大值的 1.5x

4. **技术约束**：
   - 不能影响 visibility system 的遮罩（粒子是纯视觉，不改变视线计算）
   - 粒子应在 visionMask 的 depth 之下（被遮罩覆盖的黑暗区域中渲染）
   - 性能预算：粒子系统 < 0.5ms/帧（Phaser 内建粒子足够）

**闸门**：净化点边界外可见缓慢漂浮的粒子；apparition 按预期周期出现和消失；intensity 参数改变可观察效果变化；typecheck 通过。

---

## T6: 实现 — 模块实体 + 交互触发

| 字段 | 值 |
| ---- | -- |
| Agent | code |
| 派发 | 🔴 人主导 |
| 依赖 | T4, T2 |
| 预估 | 1-2h |
| 产出 | 新增 `src/systems/interaction-trigger.ts`，修改 `purification-scene.ts` |

### Brief

在净化点场景中放置可交互的模块实体和裂隙入口。

**实现内容**：

1. **交互触发系统**（通用）：
   - 管理一组 InteractableEntity（position, triggerRadius, promptText, onInteract callback）
   - 每帧检测 player 与各 entity 的距离
   - 进入触发半径时：显示交互提示（Phaser Text 或 DOM，如 "[E] 分配薪柴"）
   - 按 E 键时调用 onInteract 回调
   - 离开半径时：隐藏提示
   - 同时只能有一个 active prompt（取最近的）

2. **模块实体**（2 个）：
   - 在地图的固定位置放置精灵（占位：彩色方块 + 标签文字）
   - 视觉反映 health 状态（满 health 正常色；受损偏暗/闪烁；0 HP 灰暗）
   - 交互触发半径 ~48px
   - onInteract → 打开 Allocation Panel（T7）

3. **裂隙入口实体**：
   - 在地图的固定位置放置精灵（占位：发光的裂缝形状）
   - 交互提示："[E] 进入裂隙"
   - onInteract → 确认后调用场景切换逻辑（T3 已 wire）

4. **状态联动**：
   - 模块精灵颜色/alpha 从 GameState 读取 module.health
   - 每次回到净化点时刷新显示

**闸门**：走近模块出现提示；按 E 触发回调（console.log 验证）；走远提示消失；裂隙入口同理；typecheck 通过。

---

## T7: 实现 — 薪柴分配面板（DOM overlay）

| 字段 | 值 |
| ---- | -- |
| Agent | code |
| 派发 | 🔴 人主导 |
| 依赖 | T6, T2 |
| 预估 | 2-3h |
| 产出 | 新增 `src/ui/dom/allocation-panel.ts`，修改 `purification-scene.ts` |

### Brief

用原生 DOM 构建薪柴分配界面（architecture 决策：复杂 UI 用 DOM overlay）。

**实现内容**：

1. **面板结构**：
   - 半透明深色背景覆盖游戏画面
   - 标题："薪柴分配"
   - 显示当前 kindlingReserve 总量
   - 每个模块一行：模块名 | 当前 health | 已分配量 | +/- 按钮
   - 修复选项：如果 module.health < 100，额外显示"修复"按钮（消耗薪柴恢复 health）
   - 底部："确认分配" 按钮 + "跳过（不分配）" 按钮
   - 冲击预测 hint：显示文字如"预计冲击强度：中等。东侧模块承压集中。"

2. **交互逻辑**：
   - +/- 按钮增减各模块的 allocated 值（步长 = 1 薪柴）
   - 总分配不能超过 kindlingReserve
   - 分配为 0 时 - 按钮禁用；储备用尽时 + 按钮禁用
   - 确认后：emit ALLOCATION_CONFIRMED 事件，关闭面板
   - 跳过：allocated 全部为 0，直接 emit ALLOCATION_CONFIRMED

3. **UX 细节**：
   - 面板打开时暂停游戏物理（scene.physics.pause()）+ 禁用玩家输入
   - 面板关闭时恢复
   - 键盘支持：数字键快捷分配 / Enter 确认 / Esc 关闭（等同跳过）
   - 叙事语调：冷峻克制，无感叹号，符合 world.md 叙事语调约束

4. **样式**：
   - 纯 CSS（内联或 style 标签），不引入 CSS 框架
   - monospace 字体，与游戏 HUD 风格一致
   - 颜色：深灰背景、浅灰文字、模块健康用绿→黄→红渐变

**闸门**：面板正确显示当前储备和模块状态；分配逻辑正确（不能超额）；确认后事件正确 emit；typecheck 通过。

---

## T8: 实现 — 冲击系统 + 结果面板

| 字段 | 值 |
| ---- | -- |
| Agent | code |
| 派发 | 🔴 人主导 |
| 依赖 | T7, T2 |
| 预估 | 2-3h |
| 产出 | 新增 `src/systems/impact-system.ts`、`src/ui/dom/impact-panel.ts`，修改 `purification-scene.ts` |

### Brief

实现冲击计算引擎和结果展示。

**实现内容**：

1. **冲击计算**（`impact-system.ts`）：
   - 输入：impactIntensity + 各模块 allocated 值
   - 冲击总威力 = impactIntensity
   - 分配到各模块的威力：不均匀分布（如 60/40 或 70/30 随机比例，但给 hint）
   - 每个模块结算：
     - `threat > allocated`：damage = threat - allocated，module health -= damage，allocated 全消耗
     - `threat <= allocated`：模块安全，消耗 allocated 的一部分作为维护成本（如 50%）
   - 结算后：
     - emit IMPACT_RESOLVED { moduleDamage }
     - 对每个受损模块 emit MODULE_DAMAGED { moduleId, newHealth }
     - GameState 更新
     - impactIntensity += 递增量（每 cycle 变强）

2. **冲击预测 hint 生成**：
   - 在分配面板中显示的提示文字
   - 基于本次冲击的实际分布（但模糊化）：如"东侧承压较重" / "压力均匀分布"
   - hint 准确度 ~70-80%（偶尔误导，制造不确定性）

3. **结果面板**（`impact-panel.ts`，DOM overlay）：
   - 冲击结算后自动弹出
   - 显示每个模块：受到的威力 | 防御值 | 结果（安全/受损/严重受损）
   - 受损模块高亮显示 health 变化
   - "继续" 按钮关闭面板
   - 叙事语调同分配面板

4. **场景编排**：
   - 流程：分配确认 → 短暂等待（氛围加剧，1-2s）→ IMPACT_STARTED → 计算 → IMPACT_RESOLVED → 结果面板
   - 结果面板关闭后，场景回到正常步行状态（玩家可走向裂隙入口开始下一次出击）

**闸门**：冲击计算结果数学正确（threat - allocated = damage）；结果面板正确显示各模块状态；module health 正确更新到 GameState；typecheck 通过。

---

## T9: 实现 — 模块效果反馈到出击参数

| 字段 | 值 |
| ---- | -- |
| Agent | code |
| 派发 | 🔴 人主导 |
| 依赖 | T8, T3 |
| 预估 | 1-2h |
| 产出 | 修改 `src/scenes/rift-scene.ts`、`src/systems/chaos-system.ts`、`src/systems/loot-system.ts` |

### Brief

将净化点模块的健康状态反馈为下一次裂隙出击的参数修正。

**实现内容**：

1. **BARRIER 模块效果**：
   - RiftScene.create() 时从 GameState.getChaosRateModifier() 读取修正值
   - 将修正值注入 ChaosSystem 的 baseRate 计算
   - 满 health（100）：baseRate *= 0.7（混乱值慢 30%，玩家有更多时间）
   - health=0：baseRate *= 1.0（无加成）
   - 中间值：线性插值

2. **STORAGE 模块效果**：
   - RiftScene.create() 时从 GameState.getKindlingPickupModifier() 读取修正值
   - 将修正值注入 LootSystem 的薪柴拾取计算
   - 满 health（100）：拾取价值 *= 1.5（每个节点多给 50%）
   - health=0：拾取价值 *= 1.0（无加成）
   - 中间值：线性插值

3. **接线方式**：
   - ChaosSystem 构造时接受 `baseRateModifier?: number` 参数（或 spec 定义的注入点）
   - LootSystem.create() 接受 `pickupMultiplier?: number` 参数
   - RiftScene 在 create() 中从 GameState 读取并传入
   - 不修改 constants.ts 的值（运行时覆盖，常量仍是 unmodified baseline）

4. **玩家感知**：
   - HUD 或裂隙开始时的简短文字提示当前模块效果状态（如"屏障受损：混乱值增速 +15%"）
   - 叙事语调

**闸门**：模块满 health 时裂隙内混乱值增速明显慢于模块 0 HP 时；薪柴拾取量变化可在 HUD 观察到；typecheck 通过。

---

## T10: QA 验收

| 字段 | 值 |
| ---- | -- |
| Agent | qa |
| 派发 | 🟢 Director 可直接派发 |
| 依赖 | T9（全部实现完成） |
| 预估 | 1-2h |
| 产出 | `docs/qa/slice-2-report.md` |

### Brief

对照 `docs/specs/system-purification-impact.md` 验证 Slice 2 的完整闭环。

**验证清单**：

1. **流程闭环**：Menu → 净化点 → 裂隙 → 出击 → 撤离 → 净化点 → 分配 → 冲击 → 结果 → 进裂隙 → ... （至少跑 3 个完整 cycle 不崩溃）
2. **分配逻辑**：不能超额分配；跳过时 allocated=0；修复消耗正确
3. **冲击计算**：damage = max(0, threat - allocated)；维护成本按比例扣除；intensity 递增
4. **模块效果**：BARRIER 满 health 时 chaos rate 低于基线；受损后升高；STORAGE 同理测拾取量
5. **模块 0 HP**：效果完全移除但游戏继续；下次出击参数变为无加成
6. **边界氛围**：粒子可见；apparition 出现和消失；intensity 变化影响氛围强度
7. **交互系统**：接近出现提示；远离消失；按 E 触发；同时只有一个提示
8. **数据一致性**：GameState 的 cycle/reserve/health 在每次场景切换后正确
9. **无崩溃**：死亡路径（survived=false）的处理；0 薪柴时的分配面板

**验证问题对照**：
> 净化点环（撤离→薪柴分配到分区模块→冲击结算→模块受损影响下次出击）是否形成"出击表现→冲击后果→出击条件变化"的连环压力？资源分配的纠结感是否成立？

QA 报告应明确回答：连环压力链是否在机械层面完整连通（因果可追溯），以及是否存在结构性问题阻碍纠结感形成（如数值过松/过紧、信息不足导致盲猜等）。

---

## 时间预估总览

| ID | 任务 | 预估 |
| -- | ---- | ---- |
| T1 | Spec 设计 | 2-3h |
| T2 | GameState | 1-2h |
| T3 | Scene flow | 1-2h |
| T4 | Walkable space | 2-3h |
| T5 | Boundary atmosphere | 2-3h |
| T6 | Module + interaction | 1-2h |
| T7 | Allocation panel | 2-3h |
| T8 | Impact system | 2-3h |
| T9 | Module effects | 1-2h |
| T10 | QA | 1-2h |
| **合计** | | **16-25h** |

关键路径：T1 → T2 → T3 → T4 → T6 → T7 → T8 → T9 → T10（~14-22h）
T5 与 T6-T8 并行（不在关键路径上）。

预估总工期：**5-7 天**（每天 3-4 小时有效工作）。
