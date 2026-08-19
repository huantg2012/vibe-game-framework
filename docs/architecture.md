---
status: APPROVED
created-by: code agent (mode A)
created-date: 2026-07-22
last-modified: 2026-08-19
approved-date: 2026-07-22
changed-this-slice: false
note: Foundation Step 2。已通过独立技术审查并经人最终批准。**Slice 6 COMPLETE（2026-08-19）**：换路硬保证（规则 21）+ 尘点 phase 动画 + FragmentRoll 已登记。目录树 ASCII 过期项仍在 backlog。
---

# 技术架构

## 技术选型

| 层 | 选择 | 理由 | 备选 |
| -- | ---- | ---- | ---- |
| 游戏框架 | Phaser 3.80+ | 最成熟的 Web 2D 框架；内置物理/输入/音频/相机/场景管理；社区最大（AI vibe coding 友好）；TypeScript 支持完善 | PixiJS（仅渲染，需自建一切）、Excalibur（社区小） |
| 语言 | TypeScript (strict) | 类型安全 + AI 生成代码质量更稳定 | - |
| 构建工具 | Vite 5+ | 热更新快、零配置 TypeScript 支持、构建速度适合游戏开发迭代 | - |
| 物理引擎 | Phaser Arcade Physics | 俯视角 2D 够用（AABB 碰撞）；轻量；无需刚体旋转/多边形碰撞 | MatterJS（过重） |
| 寻路 | 自实现 A* (grid-based) | 地图是 tile-based，A* 实现简单且可控；避免外部依赖 | EasyStar.js（可作 fallback） |
| 可见性 | 自实现 Raycasting | Darkwood 式有限视野是核心体验；需精确控制光照形状和遮挡 | Phaser Light Pipeline（不够灵活） |
| 地图生成 | Voronoi + Cellular Automata 混合 | 宏观 Voronoi 切不规则碎片区域（世界观"时空碎片"）；微观 CA 生成有机洞穴地形；碎片间窄裂口连接；兼具方向感和探索感 | BSP（过于规则/建筑感）、WFC（调参困难） |
| 存档 | LocalStorage + JSON | 最简方案；单存档够用；无需后端 | IndexedDB（数据量大时升级） |
| 音频 | Phaser 内置 (WebAudio) | 框架自带，跨浏览器兼容已处理 | Howler.js（如需更精细控制） |
| UI (游戏内 HUD / 屏幕空间读数) | DOM overlay，挂 `#dom-ui-root`（与画布对齐） | 角锚 HUD 必须跟 letterbox/缩放走同一套根。Phaser `scrollFactor(0)` 不免除 camera zoom，会把四角甩出画面 | Phaser Text/Graphics 仅用于钉世界坐标的标记 |
| UI (复杂界面) | 原生 DOM overlay | 管理面板用 DOM 构建；不引入 React/Vue | - |
| 国际化 (i18n) | 自实现 JSON + TypeScript | 文本量有限（<300 条）；自实现零依赖、类型安全、无学习成本；支持简体中文/英文 | i18next（过重）、typesafe-i18n（额外构建步骤） |
| 部署 | 静态文件 (Vite build) | 产出纯静态文件，可部署到任何静态托管 | - |

### 屏幕空间 UI 挂载（本游戏填充）

屏幕空间读数与 DOM 面板一律挂 `#dom-ui-root`（`getDomUiRoot()` / `bindDomUiRootToGame()`），与画布 letterbox/缩放对齐。钉世界坐标的标记才走 Phaser 世界层。禁止用 `scrollFactor(0)` 在 `camera.zoom ≠ 1` 下画角锚 HUD。新 overlay 不要挂 `document.body`（小地图 / 场景过渡 / 失焦层已迁到 `#dom-ui-root`；debug 可仍挂 game-container）。共享样式入口：`src/ui/dom/panel-styles.ts`（`.game-panel` 墙机 + `.device-plate` 裂隙随身罩）。视觉基线：`docs/design-notes/ui-art-overhaul.md`。

## 项目结构

```
src/
├── main.ts                     # 入口：创建 Phaser.Game 实例
├── config/
│   ├── game-config.ts          # Phaser 配置（分辨率/物理/场景注册）
│   └── constants.ts            # 游戏平衡常量（集中管理，方便调数值）
├── scenes/
│   ├── boot-scene.ts           # 资源预加载
│   ├── main-menu-scene.ts      # 标题画面
│   ├── rift-scene.ts           # 裂隙探索（核心玩法场景）
│   └── purification-scene.ts   # 净化点管理（基地场景）
├── systems/
│   ├── visibility-system.ts    # 视野/光照 raycasting（RiftScene + PurificationScene 共用）
│   ├── boundary-shape.ts       # 净化点边界几何：潮汐驱动的极坐标压力 blob（形状唯一真相）
│   ├── boundary-breath.ts      # 边界局部压力冲击与膜变形（纯视觉叠加层）
│   ├── boundary-atmosphere.ts  # 净化点边界外黑暗+模糊内容周期渲染（跟随 boundary-shape）
│   ├── procedural-surface.ts             # 裂隙地表逐像素程序化生成（DEC-018）
│   ├── procedural-purification-surface.ts # 净化点地表逐像素程序化生成 + 边界 vignette
│   ├── interaction-trigger.ts  # 接近触发交互（overlap检测+提示+面板激活）
│   ├── ai/
│   │   ├── state-machine.ts    # 通用 FSM 框架
│   │   └── behaviors.ts        # 具体行为（巡逻/警觉/追击）
│   ├── chaos-system.ts         # 混乱值计算与惩罚
│   ├── combat-system.ts        # 战斗逻辑
│   ├── loot-system.ts          # 搜刮/物品拾取
│   └── pathfinding.ts          # A* 寻路
├── entities/
│   ├── player.ts               # 玩家实体（移动/输入/状态）
│   ├── enemy-factory.ts        # 敌人工厂（按类型创建）
│   └── interactables.ts        # 可交互物（薪柴/物品/撤离点）
├── generation/
│   ├── outline-mask.ts         # C1：生长+腐蚀陆地掩膜（VOID / FLOOR）
│   ├── ruins.ts                # C2：按碎片语法落情景墙
│   ├── preview-paint.ts        # 画廊整图漆；裂隙地面烤一次 + 天空/尘点低分辨率叠层
│   ├── dual-path.ts            # 规格 21 换路机器判定（生成器与 check:layout 共用）
│   ├── fragment-roll.ts        # 每次踏入抽 contaminationAge × ruinSeverity
│   ├── rift-layout.ts          # 出击布局：锚+抖动+换路硬保证+FragmentRoll
│   ├── types.ts                # OutlineMask / RuinedMask / GeneratedRiftLayout 契约
│   └── index.ts                # 生成器出口（布点后续批次追加）
├── managers/
│   ├── game-state.ts           # 全局游戏状态（跨场景持久）
│   ├── save-manager.ts         # 存档读写（LocalStorage）
│   └── audio-manager.ts        # 音频播放控制
├── ui/
│   ├── hud.ts                  # 游戏内 HUD（Phaser 层）
│   ├── dom/
│   │   ├── panel-styles.ts     # 共享面板样式层：全部 DOM 面板的单一 <style> 注入点
│   │   ├── allocation-panel.ts # 净化点薪柴分配界面（DOM）
│   │   └── impact-panel.ts     # 冲击结算界面（DOM）
│   └── components/
│       └── status-bar.ts       # 通用状态条组件
├── i18n/
│   ├── index.ts                # i18n 初始化 + t() 函数导出
│   ├── types.ts                # 翻译 key 的类型定义（自动推导）
│   └── locales/
│       ├── zh-CN.ts            # 简体中文（默认语言）
│       └── en.ts               # English
├── core/
│   ├── event-bus.ts            # 类型安全的事件总线
│   └── object-pool.ts         # 通用对象池
├── utils/
│   ├── math.ts                 # 数学工具（向量/角度/距离）
│   └── random.ts              # 可种子随机数生成器
└── types/
    ├── game-types.ts           # 核心游戏类型定义
    ├── events.ts               # 事件类型枚举 + payload 定义
    └── save-data.ts            # 存档数据 schema

tools/
└── art-pipeline/               # 构建期离线美术资源后处理与机器验收工具
```

## 构建期美术资源后处理工具

`tools/art-pipeline/` 是构建期/离线工具，独立于游戏运行时的 `src/`：它读取游戏层的后处理配置与锁定色板，处理外部生成的**单块资产原始图片（一张图 = 一个 tile 或一个 sprite）**并验证产物，不会被游戏打包或在 Phaser 场景中运行。整场景概念图只用于美术方向验证，不经此管线、不参与平铺。

- `npm run art:postprocess -- --config <配置路径>`：按配置执行资源后处理。
- `npm run art:verify -- --config <配置路径>`：执行机器验收；退出码为 0 表示通过，非 0 表示不通过。

具体游戏的尺寸、色板、处理阶段和验收阈值存放于 `docs/art/pipeline.*.config.json` 与 `docs/art/palette.json`，不写入通用工具代码。正式视觉资产的职责约定为：美术 Agent 维护配置与验收标准，程序 Agent 运行命令，人执行外部生图并完成最终审美判断。

## 模块通信方式

**主模式：类型安全事件总线（Event Bus）**

系统之间通过事件解耦。不允许系统 A 直接 import 并调用系统 B 的方法（管理器除外）。

> 事件契约的唯一真相是 `src/types/events.ts`（`GameEvent` 枚举 + `EventPayloads` 类型映射）。以下示例摘自该文件的现状，如与代码不符请以代码为准并回补本文档。

```typescript
// 事件定义（节选自 src/types/events.ts）
export enum GameEvent {
  CHAOS_CHANGED = 'chaos:changed',
  CHAOS_THRESHOLD_REACHED = 'chaos:threshold-reached',
  ENEMY_ALERT = 'enemy:alert',
  PLAYER_DAMAGED = 'player:damaged',
  KINDLING_COLLECTED = 'kindling:collected',
  RIFT_EXIT_REACHED = 'rift:exit-reached',
}

// payload 类型映射（节选自 src/types/events.ts 的 EventPayloads）
// CHAOS_CHANGED:           { value: number; delta: number; max: number }
// CHAOS_THRESHOLD_REACHED: { level: number }
// ENEMY_ALERT:             { enemyId: string; alertLevel: 'suspicious' | 'alert' | 'chase' }
// KINDLING_COLLECTED:      { amount: number; total: number }

// 使用方式（payload 字段由 EventPayloads 强制约束）
eventBus.emit(GameEvent.CHAOS_CHANGED, { value: 45, delta: 2, max: 100 });
eventBus.on(GameEvent.CHAOS_THRESHOLD_REACHED, ({ level }) => { /* apply penalty */ });
```

**辅助模式：**
- **Manager 直接调用**：GameState、SaveManager、AudioManager 提供直接方法调用接口（它们是全局服务，不是游戏逻辑系统）
- **Scene 数据传递**：场景切换时通过 `scene.start(key, data)` 传递初始化数据

**禁止：**
- 系统间循环依赖
- 绕过事件总线直接跨系统访问状态
- **可能形成循环的同步 emit 链**（见下方"事件回调中的 emit 规则"）

### 事件回调中的 emit 规则（可执行版本）

`eventBus.emit()` 是**完全同步**的（`src/core/event-bus.ts` 中直接遍历 listener 并调用），因此在回调里再 `emit` 会在同一调用栈内递归展开。若事件链能回到自身（A → B → A），会造成无限递归 / 栈溢出。规则如下：

- **允许**：在回调中同步 `emit` 单向的下游事件——即该事件不会（直接或间接）再触发回本条事件链。例：`combat` 处理伤害后同步 `emit(PLAYER_DAMAGED)`。
- **禁止**：可能构成环的同步 `emit`（A 的回调同步触发最终会回到 A 的事件）。
- **不确定是否成环、或明知需要回环**：不要同步 emit，改为**延迟派发**打破调用栈：
  - 下一个 microtask：`queueMicrotask(() => eventBus.emit(...))`
  - 下一帧（在 Phaser 场景内）：`this.time.delayedCall(0, () => eventBus.emit(...))`
- **开发期自检**：为一条事件链画出"谁监听 / 谁再 emit"，只要闭合成环就必须在环上至少一处改用延迟派发。

> 说明：当前 `EventBus` 未内建队列式 emit。上述延迟派发以标准 `queueMicrotask` / Phaser `delayedCall(0)` 约定实现，无需改动 EventBus。若后续多处需要队列语义，再评估在 EventBus 上新增 `emitDeferred()`。

## 模块注册表

> **状态**列以真实 `src/` 目录为准（Slice 5 T0 全量补核，核对日期 2026-08-12）。"已实现"= 文件真实存在且有实质实现；"规划中"= 目录/文件尚未创建，接口为设计意图，实现时以本表为契约起点并回填状态。已落地目录：`src/core/`、`src/i18n/`、`src/systems/`（含 `ai/`）、`src/entities/`、`src/utils/`、`src/managers/`、`src/ui/`（含 `dom/`）、`src/config/`、`src/types/`、`src/scenes/`、`src/generated/`、`src/generation/`（Slice 6 COMPLETE：陆地/残墙/布点/换路/FragmentRoll/氛围场）。

| 模块 | 路径 | 职责 | 对外接口 | 状态 |
| ---- | ---- | ---- | -------- | ---- |
| EventBus | src/core/event-bus.ts | 类型安全的发布/订阅系统 | emit(), on(), off(), once(), destroy() | 已实现 |
| I18n | src/i18n/index.ts | 多语言文本查找与语言切换 | t(key, params?), setLocale(), getLocale() | 已实现 |
| GameState | src/managers/game-state.ts | 全局状态持有和查询（净化点/薪柴/模块/冲击强度/待生效副作用），module-level singleton | getKindlingReserve(), addKindling(n), spendKindling(n), getModules(), getModule(id), allocateToModule(id, kindling), applyDamage(id, damage), getModuleEffect(type), getSortieModifiers(), getCycle(), incrementCycle(), getImpactIntensity(), setImpactIntensity(v), getPendingSideEffects(), addPendingSideEffects(effects), consumePendingSideEffects(), getRepairEfficiencyMult(), setRepairEfficiencyMult(v), getUpgradeDiscount(), setUpgradeDiscount(v), consumeUpgradeDiscount(), getState(), loadState(), reset() | 已实现（Slice 3） |
| SaveManager | src/managers/save-manager.ts | 存档序列化/反序列化（收集各系统状态 → localStorage，加载时分发回各系统）。标题屏无副作用 peek（潮汐/相位/出击/稳定度） | hasSave(), save(), load(), deleteSave(), peekTideNumber(), peekTidePhase(), peekCycle(), peekStability(), peekRecordSummary() | 已实现（Slice 3；Slice 5.5 补 peek） |
| AudioManager | src/managers/audio-manager.ts | 音频播放/停止/音量控制 | play(), stop(), setVolume() | 规划中 |
| Player | src/entities/player.ts | 玩家移动/朝向/碰撞体/移速调制栈（Rift+Purification 共用） | create(scene, config), update(dt), postUpdate(), getPosition(), getFacingAngle(), getFacing4(), isMoving(), setSpeedModifier(), clearSpeedModifier(), setInputEnabled(), getSprite(), destroy() | 已实现（T5） |
| VisibilitySystem | src/systems/visibility-system.ts | 玩家视野 raycasting + 三级遮罩渲染 + 混乱值调制（Rift+Purification 共用） | create(scene, config, occluders), update(origin, facing, dt), setRadiusScale(), setEdgeCorruption(), setScreenFlicker(), isPointVisible(), getVisibilityAt(), getEffectiveRadius(), registerGlowSource(), unregisterGlowSource(), getStats(), destroy() | 已实现（T5） |
| GridRaycast | src/utils/grid-raycast.ts | 网格 DDA 射线（含对角缝隙规则）；无状态纯函数，视野与敌人 AI 共用同一套遮挡判定。`hasClearPath()` 是同一射线的双侧偏移版，回答"这么宽的身体过不过得去"（DEC-021），**不是视线判定，禁止用于感知** | castRay(), castRayDirection(), hasLineOfSight(), hasClearPath(), createRayHit() | 已实现（T5，T7 增 hasClearPath） |
| TileGrid | src/systems/tile-grid.ts | tile 数据的唯一真相，同时实现 OccluderGrid（视线）与 WalkGrid（寻路）；纯数据无 Phaser 依赖 | getTile(), isOpaque(), isWalkable(), isWalkableAt(), setTile(), tileToWorld(), worldToTile(), version | 已实现（T6） |
| TilemapRenderer | src/systems/tilemap-renderer.ts | tile 数据 → Phaser Tilemap 图层（共享场景管线，依赖 Phaser 视锥裁剪） | create(scene, map, config): TilemapLayer, getLayer(), getWorldSize(), destroy() | 已实现（T6） |
| AISystem | src/systems/ai/ | 渗透体的感知（10Hz tick / 单射线）+ 五态 FSM + 移动/巡逻 + 寻路预算调度；拥有敌人实体的生命周期 | create(scene, spawns, occluders, walk), update(dt, playerPos, playerIsMoving), postUpdate(dt), getEnemies(), getEnemyById(), reportNoise(pos, radius, level), reportDamage(enemyId, sourcePos), despawn(enemyId), onPlayerLost(), setVisibilityProvider(), setCueListener(), addWallCollider(layer), getSprites(), getStats(), destroy() | 已实现（T7） |
| ChaosSystem | src/systems/chaos-system.ts | 混乱值累积、阶段判定（safe/warning/danger/overflow）与惩罚调制器计算；`class ChaosSystem`（非模块级单例，RiftScene 持有实例） | `new ChaosSystem(config?)`：update(deltaMs), getValue(), getRate(), getStage(), getPeak(), addChaos(source, amount), addImmediate(amount), setTemporaryRateMult(mult, durationMs), setPaused(paused), reset(), destroy()；模块函数 getChaosModulators(value) | 已实现（Slice 1-2） |
| CombatSystem | src/systems/combat-system.ts | 玩家挥击/敌人反击/生命值/无敌帧/死亡触发 + 战斗占位表现（白色扇形、前摇细线、白闪、死亡淡出）。不改 AI FSM、不改混乱值，只 emit 事件 + 经注入回调转发噪声 | create(scene, occluders, player, ai, hooks), update(dt), requestPlayerAttack(), getHealth(), getMaxHealth(), isDead(), isInvulnerable(), getAttackState(), getEnemyHealth(id), isEnemyAlive(id), getStats(), setEnabled(), reset(), destroy() | 已实现（T8） |
| Pathfinding | src/systems/pathfinding.ts | 网格 A*（8 邻接 / octile / 禁止切角）+ 宽度感知的 string-pulling 平滑；共享服务模块（与 grid-raycast 同级，可被直接 import），预分配缓冲、结果写入调用方数组 | `GridPathfinder(walk, occluders, clearance)`：findPath(from, to, out, maxNodes), findNearestWalkable(x, y, out, maxRadius?), getStats() | 已实现（T7） |
| EnemyFactory | src/entities/enemy-factory.ts | 渗透体实体：碰撞体 + 占位表现（朝向可读的五边形本体、teal 状态指示物、追击残影环）+ 承载 AI 可变状态块 | createInfiltrator(scene, spawn, config, position, factoryConfig), createInfiltratorConfig(); `Enemy`：getId/getPosition/getFacingAngle/getFacing4/getState/isEngaged/getDetection, getSprite(), syncPositionFromBody(), setVelocity(), measureDisplacement(), syncVisuals(dt, visibility), destroy() | 已实现（T7） |
| ContaminantSystem | src/systems/contaminant-system.ts | 污染物库存管理与生命周期（防御 slot 承伤 → 冲击点数满 3 转化为工具 → 出击使用 → 耗尽破碎），module-level singleton | getAll(), getDefenseSlotted(), getSortieLoadout(), acquire(type, rarity), slotDefense(id, slotIndex), unslotDefense(slotIndex), slotSortie(id, slotIndex), unslotSortie(slotIndex), applyImpactCharge(isHighTide), useTool(id), getState(), loadState(), reset() | 已实现（Slice 3） |
| ContaminantNodeSystem | src/systems/contaminant-node-system.ts | 裂隙地图中污染物拾取节点的放置、脉冲/旋转表现与拾取（紫色球体，与 LootSystem 同模式但独立实现） | create(scene, nodeDefs, playerSprite, config), update(delta), getCollectedPositions(), reset(), destroy() | 已实现（Slice 3） |
| DefenseEngine | src/systems/defense-engine.ts | 冲击结算时计算各防御 slot 的效果（减伤/薪柴增益/稳定度变化/副作用等），纯函数无 Phaser 依赖；`solidifyCounters` 是唯一跨冲击持久的内部状态（不进存档） | applyDefenseEffects(baseDamagePerModule, defenseSlots, context), resetDefenseEngine() | 已实现（Slice 4，`applyGenericDefense()` 内 6 处机制标注 `handled externally`/`future iteration` 待 Slice 5 T3 接线） |
| ToolSystem | src/systems/tool-system.ts | 出击主动/被动工具使用与效果管理（switch + 私有方法，非基类继承），产出 `ToolDebuffs` 描述符，由场景层在 AI update 之后应用到敌人/玩家 | create(scene, loadout, getPlayerPos, getEnemies, options?), useSlot(slotIndex), update(deltaMs), getDebuffs(), getSlotUses(slotIndex), getSlotType(slotIndex), getActiveTimedEffects(), notifyEnemySuspicious(enemyId), notifyProximityAvoid(), reset(), destroy() | 已实现 15 种。Slice 6 C4：abyss 经 `options.getKindlingPositions` 读本次薪柴，不再 import 手写图 |
| GrowthSystem | src/systems/growth-system.ts | 永久改造购买、费用计算与效果聚合，module-level singleton | getLevel(id), getMaxLevel(id), getCost(id), canAfford(id, reserve), purchase(id), getModifiers(), getState(), loadState(), reset() | 已实现（Slice 3，当前 3 项改造） |
| TideSystem | src/systems/tide-system.ts | 潮汐冲击强度状态机（Rise→Crest→Ebb→下一 Tide），替代线性递增，module-level singleton | getState(), getCurrentIntensity(), isHighTide(), advanceCycle(), loadState(), reset() | 已实现（Slice 3） |
| ImpactSystem | src/systems/impact-system.ts | 冲击伤害计算与结算（主/次目标分配、接入 DefenseEngine、写回 GameState），module-level singleton | setForecastTarget(id), getForecastTarget(), run(defenseSlots?), generateForecast() | 已实现（Slice 2-4） |
| StabilityTracker | src/systems/stability-tracker.ts | 净化稳定度积分与进度追踪（0-100，到达后 `reached` 永久为真），module-level singleton | getProgress(), isReached(), addProgress(reason, amount), getState(), loadState(), reset() | 已实现（Slice 3） |
| RunController | src/systems/run-controller.ts | 出击生命周期唯一出口：死亡/撤离 → 结算延迟 → 场景过渡；`runEnded` 标志防止双触发；`class` 由 RiftScene 持有实例 | create(scene, deps), isRunEnded(), getElapsedMs(), restart(), destroy() | 已实现（Slice 2+；Slice 6 C4：`restart()` 阵亡与撤离都回净化点） |
| ExtractionSystem | src/systems/extraction-system.ts | 撤离点脉冲标记渲染与撤离请求判定（不 import 其他系统，视野 glow 源经注入回调注册） | create(scene, extractionPoint, getPlayerPosition, isRunEnded, config?), update(deltaMs), canExtract(), requestExtract(), reset(), destroy() | 已实现 |
| LootSystem | src/systems/loot-system.ts | 薪柴节点放置、可见性驱动透明度呼吸动画与拾取（STORAGE 模块效果调制拾取值） | create(scene, nodeDefs, playerSprite, config), update(delta), getCarriedKindling(), addBonusKindling(n), getRemainingNodes(), reset(), destroy() | 已实现 |
| TrailSystem | src/systems/trail-system.ts | 玩家足迹余迹渲染（仅视野内可见，随混乱值加速消退，仅绘制相机视口内 tile） | create(scene, mapWidth, tileSize, getVisibility), update(playerTileX, playerTileY, chaosValue, deltaMs), reset(), destroy() | 已实现 |
| BoundaryShape | src/systems/boundary-shape.ts | 净化点边界几何的唯一真相：潮汐驱动的极坐标压力 blob（椭圆 × 潮汐缩放 × 方向压力叶 × 交互点安全钳制）。每次 scene create 构建一次，构建后为无状态廉价查询 | `createBoundaryShape(config)`：radiusAt(angle), normalizedDist(x,y), isInside(x,y), pressureAt(angle), pressureDirection, tideScale, centerX/centerY | 已实现（Slice 4.5） |
| BoundaryBreath | src/systems/boundary-breath.ts | 边界局部压力冲击与膜变形的纯视觉叠加层（并发短弧向内扫入 + 虚空侵入楔形 + 膜线内凹）。不参与碰撞/可见性/gameplay | create(scene, shape, tidePhase), update(dt), destroy() | 已实现（Slice 4.5） |
| BoundaryAtmosphere | src/systems/boundary-atmosphere.ts | 净化点边界外粒子与 apparition 氛围渲染；生成/消亡半径跟随 BoundaryShape 而非固定圆 | create(scene, shape), update(dt), destroy() | 已实现（Slice 2，Slice 4.5 改为跟随 blob） |
| ProceduralSurface | src/systems/procedural-surface.ts | 每次出击烤一次地表（含雾；尘点不烤死）；天空+尘点低分辨率叠层只改 phase，沿本趟 windX/Y | RiftSurfacePainter.mount / update / destroy | 已实现（Slice 6；尘点跟天空同一份 AtmosphereField） |
| ProceduralPurificationSurface | src/systems/procedural-purification-surface.ts | 净化点地表逐像素程序化生成（7 层：石板噪声/冷暖径向/踩踏痕/接缝/暖屑/边界 vignette/teal 渗点）；vignette 直接读 BoundaryShape 的梯度带，软过渡替代硬墙 | createPurificationSurfaceTexture(scene, map, key, shape, interactionPoints) | 已实现（Slice 4.5） |
| PanelStyles | src/ui/dom/panel-styles.ts | 共享面板样式层：全部 DOM 面板的单一 `<style>` 注入点（幂等）。`.game-panel` 默认是净化点墙机 CRT（680×468 磷光屏，无金属/无外框，8px 凹槽暗边）；六块墙机另加 `.crt-stack`（固定子项 + 库存 `.scroll-area`）。Esc 记录菜单与裂隙结算用内联尺寸覆盖（5px 凹槽），不加 crt-stack。`.device-plate` 是裂隙随身罩。Channel B toast 挂 `#toast-inline-queue`（同时最多 2 条）；`skipQueue` 贴源短闪仍挂 `#dom-ui-root`。规范来源 `docs/design-notes/ui-art-overhaul.md` | injectPanelStyles(), createCrtPanel(id), getDomUiRoot(), bindDomUiRootToGame(game), showToastInline(html, opts), showToastStamp(text, opts?) | 已实现（Slice 4.5；Slice 5.5 CRT + createCrtPanel；C6 toast；R9 凹槽；R10 crt-stack / 队列 / device-effect） |
| SideEffectLabels | src/ui/side-effect-labels.ts | 防御副作用（`PendingSideEffect`）的唯一人类可读文案来源，供裂隙开局 toast 与冲击结算面板的"本次产生的残留"披露共用，避免两处映射各自维护而漂移。混乱增速可见写法也从这里出（相对 1.0 的 ±N%） | describeSideEffectBody(e), describeSideEffectWithSource(e), formatChaosRateDelta(rate), formatChaosMultDelta(mult) | 已实现（Slice 5.5 C5 引入，本轮补登记；R9 收口混乱增速） |
| ContaminantNames | src/ui/contaminant-names.ts | 污染物中文名 + 库存排序的单一权威入口，替代各面板各自维护的本地名表（CLAUDE.md 策划数据源规则 + IA §S13/§S15 V8） | getToolName(type), getDefenseName(type), getRarityStars(rarity), sortContaminants(list) | 已实现（Slice 5.5 C2 引入，本轮补登记；C3 新增 getRarityStars/sortContaminants） |
| InspectDock | src/ui/dom/inspect-dock.ts | 检视层五层内容构建（L1 身份/L2 CSV `summaryDefense`/`summaryTool`/L3 数值/L4 与我的关系/L5 转化去向），替代原生 `title` tooltip（`.inspect-dock` 容器与样式在 PanelStyles） | buildDefenseInspectHtml(c, ctx), buildToolInspectHtml(c, ctx), INSPECT_EMPTY_HTML | 已实现（Slice 5.5 C3；R10 L2 读 CSV 摘要列） |
| PurificationModuleEntity | src/entities/purification-module.ts | 净化点模块的视觉表现（CORE=蓝色六边形/STORAGE=橙色方块，HP 驱动的 alpha 分级 + 临界闪烁 + 邻近发光），Slice 5 T6 三态受损视觉将扩展此模块 | `new PurificationModuleEntity(config)`：id/type/x/y（getter）, create(scene), update(playerX, playerY), isInRange(), setProximityGlow(inRange), getEffectPct(), getHpData(), destroy() | 已实现（Slice 2+） |
| Generated CSV Data | src/generated/ | CSV→TS 构建期产物（策划数据源规则强制，`npm run codegen` 生成，不手写）：`contaminant-data.ts` ← `data/contaminants.csv`；`upgrade-data.ts` ← `data/upgrades.csv`；`rift-fragment-data.ts` ← `data/rift-fragments.csv` | `CONTAMINANT_DATA`；`UPGRADE_DATA`；`RIFT_FRAGMENT_DATA` / `ENABLED_RIFT_FRAGMENTS` | 已实现（Slice 4；Slice 6 C2 加碎片表） |
| InteractionTrigger | src/systems/interaction-trigger.ts | 接近触发交互检测与面板激活 | register(entity, callback) | 规划中（当前由各 Scene 直接实现 overlap 检测 + 面板调用，未抽出独立模块） |
| MapGenerator | src/generation/ | 裂隙程序化布局。抽风格锚 + 新种子 + 邻域抖动；每次踏入抽 FragmentRoll（contaminationAge × ruinSeverity）。换路硬保证（规格 21：`evaluateDualPath`）。手写图仅夹具。扩空间见 `docs/design-notes/slice-6-layered-generation.md`「Agent 入口」 | generateOutline；generateRecipeDraft；jitterRecipe；rollFragmentAxes；evaluateDualPath；generateRiftLayout | 已实现（Slice 6 COMPLETE）。裂隙吃生成结果。画廊是样例。天空+尘点 phase 循环。无换路 = 坏图 |
| RiftHud | src/ui/dom/rift-hud.ts | 裂隙内游戏状态显示（完整度条/混乱条/薪柴数/工具槽/撤离提示/生效中行），`class RiftHud` 由 RiftScene 持有实例；结算面板已拆到 RiftResultPanel。生效行用 `.device-effect` 名+秒分节点；remainingMs 由场景每帧权威 set，HUD 不再自减 | create(config), update(deltaMs), setActiveEffects(effects), reset(), destroy() | 已实现（Slice 1+；Slice 5.5 迁 DOM；R10 工具剩余秒） |
| RiftResultPanel | src/ui/dom/rift-result-panel.ts | 裂隙撤离/阵亡结算 DOM 面板，与冲击结算面板视觉同源（本轮补登记，模块本身为 Slice 5.5 C2 交付） | isOpen(), show(data), close(), destroy() | 已实现（Slice 5.5） |
| Minimap | src/ui/minimap.ts | 裂隙圆形局部窗口：直径 33 格、画布 99 像素，跟随玩家当前格。已探索由场景层用真实视野累积后写入；玩家十字带朝向短臂；覆盖内撤离竖缝 / 深渊方点 / 节点菱形。`#rift-minimap.device-plate` 挂 `#dom-ui-root` | create(mapTiles, mapWidth, mapHeight, tileSize, extractionPos), markExplored(tileX, tileY), update(playerWorldPos, facing, deltaMs), reset(), destroy() | 已实现（Slice 5.5 迁挂载根、改标记形状；Slice 6 C6 圆窗 + 真实视野 + 朝向） |
| AllocationPanel | src/ui/dom/allocation-panel.ts | 净化点单模块薪柴分配 DOM 面板 | isOpen(), open(moduleId, onClose?), close() | 已实现（Slice 2+，Slice 4.5 迁移至共享面板样式层） |
| DefensePanel | src/ui/dom/defense-panel.ts | 防御 slot 管理 DOM 面板（装/卸污染物） | isOpen(), open(onClose?), close() | 已实现（Slice 3+） |
| GrowthPanel | src/ui/dom/growth-panel.ts | 改造祭坛 DOM 面板（购买永久改造） | isOpen(), open(onClose?), close() | 已实现（Slice 3+） |
| ImpactResultPanel | src/ui/dom/impact-result-panel.ts | 冲击结算结果 DOM 面板 | isOpen(), show(damages, intensity, onDone, chargeChanges?), close(), destroy() | 已实现（Slice 2+） |
| LoadoutPanel | src/ui/dom/loadout-panel.ts | 出击前工具装载选择 DOM 面板 | isOpen(), open(onConfirm, onClose?), close() | 已实现（Slice 3+） |
| StatusPanel | src/ui/dom/status-panel.ts | 潮汐/稳定度/工具库存状态查看 DOM 面板 | isOpen(), open(onClose?), close() | 已实现（Slice 3+） |
| PauseMenu | src/ui/dom/pause-menu.ts | 局内 Esc 记录菜单：新的纪录 / 沿旧路返回 / 合上。关闭=场景原样恢复；在裂隙内选新的纪录或沿旧路返回会结束当前出击 | isOpen(), open(scene), close(), discard() | 已实现 |
| Session | src/managers/session.ts | 新档/读档的共享启动序列（主菜单与记录菜单共用，避免漏 reset） | hasReadableSave(), beginNewExpedition(scene), loadExpedition(scene) | 已实现 |
| PurificationHud | src/ui/dom/purification-hud.ts | 净化点场景内交互提示条（DOM，贴靠世界内交互目标，不是独立弹出面板） | create(), updatePrompt(target), refresh(), setPromptVisible(visible), destroy() | 已实现（Slice 2+） |

> 另：`src/core/object-pool.ts`、`src/utils/math.ts`、`src/utils/random.ts`、`src/config/`、`src/types/`（含 `events.ts`/`game-types.ts`/`save-data.ts`/`map-types.ts`）、`src/scenes/` 已真实存在，但属于基础设施/类型/场景，不在本"系统模块"注册表内单列。其中：
> - `src/types/map-types.ts`（T6 新增）持有地图侧数据契约：`TileMapData` / `OccluderGrid` / `WalkGrid` / `EnemySpawnData` / `PatrolRouteData` / `KindlingNodeDef` / `ExtractionPointDef` / `RiftLayoutData`。
> - `src/types/ai-types.ts`（T7 新增）持有敌人 AI 契约：`EnemyView`（对外只读视图，T3/T4/渲染层消费）/ `EnemyAIState`（可变运行时状态，仅 AI 系统写）/ `InfiltratorConfig` / `Perception` / `AlertLevel` / `SightZone` / `AICueId`。放在 `types/` 而非 `systems/ai/` 是为了打断循环依赖：实体实现 `EnemyView`，AI 系统持有可变状态。
> - `src/config/invariants.ts`（T7 新增）把设计所依赖的常量关系写成可执行断言，dev 构建在 `main.ts` 启动时校验（DEC-020）。Slice 1 覆盖敌人 AI 的 I1–I6 + 一条跨 spec 补充检查。T8/T9 的 spec 不变量应追加进同一文件。
> - `src/scenes/rift-map-data.ts`（T6 新增）是 Slice 1 手工编排的固定裂隙地图**夹具**（ASCII tile 网格 + 布点），导出 `RIFT_MAP` 与 `validateRiftMap()`。运行时裂隙走 `generateRiftLayout`；夹具给对照 / 测试。
> - 四个场景均已是真实实现（Slice 5 T0 更新，此前本注仍称 `BootScene`/`MainMenuScene`/`PurificationScene` 为骨架，已过期）：`BootScene` 加载条 + dev 深链接（`#rift`/`#purif`）+ 占位纹理生成；`MainMenuScene` 新远征/继续（读写 SaveManager 与各系统 reset）；`RiftScene` 每次踏入 `generateRiftLayout(seed)` + Player + VisibilitySystem + AISystem + Combat/Tool/Extraction/Loot/ContaminantNode/Trail/Minimap 等系统的场景层编排；`PurificationScene` 动态力场边界 + 模块交互 + 全部 DOM 面板编排。场景层负责把战斗/流程事件翻译成 AI 的刺激入口（`bindAIStimuli()`：`ENEMY_DAMAGED → reportDamage`、`ENEMY_KILLED → despawn`、`PLAYER_DIED` / `RIFT_EXIT_REACHED → onPlayerLost`），AI 与 Combat 互不 import（DEC-002）。

## 关键架构决策

### DEC-ARCH-001: 选择 Phaser 3 而非 PixiJS

- **选择**：Phaser 3 作为游戏框架
- **理由**：内置场景管理、物理、输入、音频、相机系统。减少约 60% 基础设施代码。文档和社区规模是 Web 游戏框架中最大的，AI vibe coding 生成质量最稳定。
- **影响**：架构受 Phaser Scene 生命周期约束；物理限于 Arcade（AABB only）；渲染管线受 Phaser 控制。
- **风险**：Phaser 的 UI 能力有限 → 用 DOM overlay 补偿。

### DEC-ARCH-002: 事件总线而非 ECS

- **选择**：事件驱动 + 系统对象，不用 ECS 架构
- **理由**：本游戏实体数量有限（同屏 <50 个活跃实体），ECS 的批量处理优势体现不出来。事件总线更直观、更适合 AI 理解和生成代码。Phaser 本身不是 ECS 设计。
- **影响**：每个系统是一个类实例而非纯函数处理器；实体通过 Phaser GameObject 管理而非组件组合。
- **约束**：如果后期敌人数量显著增加（>100 同屏），需重新评估。

### DEC-ARCH-003: Voronoi + Cellular Automata 混合地图生成

- **选择**：宏观 Voronoi 分区 + 微观 Cellular Automata 有机地形 + 碎片间裂口连接
- **技术路线定位（重要）**：Voronoi+CA 混合是本项目**要认真验证并落地的核心技术路线**，不是临时方案。下述"风险/缓解策略"的目的是**把 Voronoi+CA 做成**（保证连通性、面积均衡、可玩性），而**不是**为回退到"纯 CA"或其他生成方案预留降级路径。明确：本架构**不设纯 CA 降级路径**——若验证中遇到问题，方向是修好混合方案本身（调参、修补、约束），而非放弃 Voronoi 分层。
- **理由**：世界观设定裂隙内部是"异时空碎片"——不规则、非建筑逻辑。BSP 产出的直角房间+走廊结构过于人工/有建筑感，与设定冲突。Voronoi 切割天然产生不规则碎片边界，CA 填充产生有机洞穴感。碎片间的窄裂口（"空间撕裂"）是天然决策点（进/不进？哪个方向？），同时提供视线遮挡和路线瓶颈。
- **设计**：
  - 宏观层：Voronoi 切出 4-6 个碎片区域，定义推进方向（起点碎片 → 目标碎片）
  - 微观层：每个碎片内用 CA 迭代 4-6 轮，产出开阔区+狭窄通道交替的有机地形
  - 连接层：相邻碎片通过 1-2 个窄裂口连通（宽度 2-3 tile），裂口位置在共享边界上选取
  - 后处理：确保连通性（flood fill 验证）、放置内容（spawn/exit/loot/enemies）
- **影响**：地图不再有"房间"概念，改为"碎片区域"。寻路仍基于 tile grid（CA 输出即为 tile 数据）。视线遮挡由有机墙体自然产生。
- **潜行需求保障**：
  - 视线遮挡：CA 产出的不规则墙体天然提供掩体
  - 多路径选择：碎片内 CA 地形有多条通道；碎片间可能有多个裂口
  - 开阔 vs 狭窄交替：CA 参数控制开阔度 + 裂口本身是瓶颈
  - 内容散布合理：content-placer 按碎片区域类型分配（安全区/巡逻区/高价值区）
- **风险与缓解（均服务于"把混合方案做成"，非退回 CA）**：
  - CA 可能产出不连通区域 → flood fill 连通性验证 + 自动打通 / 重连修补
  - Voronoi 碎片大小差异过大 → 约束最小/最大面积 + Lloyd 松弛迭代平衡
  - 裂口位置不理想 / 碎片过碎 → 在共享边界上按规则重选裂口、限制碎片数量区间
  - 上述任一缓解失败 → 在同一混合框架内重试 / 调参（重试上限内），而非切换到纯 CA 或其他生成器

### DEC-ARCH-010: Slice 6 外轮廓先交一块岛（生长+腐蚀）

- **选择**：C1 可走陆地 = 种子生长 + 腐蚀 + 最大四连通块。缓冲 64×42，界外格是 `TileType.VOID`（不可走、不挡视线、不画墙皮）。
- **与 DEC-ARCH-003**：003 的 Voronoi 分层仍是碎片内部 / 多块拼合的长期路线。本批不切 4–6 块 Voronoi 岛。人认的体验是「一块不规则陆地漂在虚空里」；约束 1 验收看看见的边，不看宏观分区是否先落地。
- **不退回**：BSP 方正房间。CA 不当墙的结构来源（墙是 C2 情景残块）。
- **坏图**：填满缓冲、啃边矩形、贴齐四边 → 丢弃重试，不换算法。
- **影响**：`TileType.VOID` 入枚举；`TileGrid.isWalkable` 只认地板/裂口。裂隙场景仍用手写图，直到 C4。

### DEC-ARCH-004: 自实现 Raycasting 做视野

- **选择**：自写 raycasting 算法生成视野多边形
- **理由**：Darkwood 式有限视野是三根体验支柱的直接支撑（"绝望边缘的紧绷"）。需要精确控制形状（锥形/圆形切换）、边缘柔和度、动态障碍物遮挡。第三方方案都不够灵活。
- **影响**：是性能瓶颈之一（每帧计算）。需要优化策略：光线数量限制、静止时缓存、分辨率降级。
- **参考实现**：2D Visibility algorithm (Red Blob Games)

### DEC-ARCH-005: DOM overlay 做复杂 UI

- **选择**：净化点分配/冲击结算等复杂界面用原生 DOM 实现，叠加在 Canvas 之上
- **理由**：Canvas 内构建表单/按钮/拖拽交互的成本极高。DOM 原生支持布局、事件、无障碍。不引入 React/Vue 因为界面不超过 3 个面板。
- **影响**：需要管理 DOM 层和 Canvas 层的显隐切换和输入焦点。
- **约束**：DOM UI 不能与游戏画面同时需要玩家输入（切场景时切换）。
- **[Slice 4.5 追加] 共享面板样式层**：面板数量从 3 个涨到 7 个后，每个面板各自写内联样式必然漂移（同一个"按钮"在两块面板长得不一样）。现在全部 DOM 面板共用 `src/ui/dom/panel-styles.ts`——单一幂等的 `<style>` 注入点 + 统一 `.game-panel` 类族（终端外观、右侧全高抽屉布局、条形/槽位/徽标组件）。**约束**：面板不得写自己的一套视觉基元；需要新组件时扩样式层，不在面板内联。视觉规范的真相在 `docs/design-notes/ui-art-overhaul.md` 与 `docs/art-direction.md` §6，样式层只是它们的实现。

### DEC-ARCH-006: LocalStorage 单存档

- **选择**：使用 LocalStorage 存储 JSON 格式的单存档
- **理由**：MVP 明确 out-of-scope 了多存档。LocalStorage 同步 API 简单可靠。单存档 JSON 预估 <100KB。
- **影响**：存档数据有 5-10MB 上限（因浏览器限制）；需要版本号做兼容迁移。
- **迁移路径**：如需多存档或数据量增大，升级为 IndexedDB。

### DEC-ARCH-007: 自实现 i18n 而非 i18next

- **选择**：自写 JSON 翻译文件 + TypeScript 类型推导，不使用 i18next
- **理由**：游戏文本总量有限（预估 <300 key），i18next 的插件体系、命名空间、后端加载等能力完全用不到。自实现方案零依赖、类型安全（key 拼写错误编译时报错）、代码量 <100 行。
- **影响**：不支持复数规则、日期格式化等高级 i18n 特性（本游戏不需要）。如未来语言超过 3 种或文本量爆炸，再考虑迁移。
- **设计规则**：
  - 默认语言：zh-CN（中文先行开发，英文后补）
  - locale 文件使用 TypeScript（非 JSON），享受类型检查
  - key 命名规范：`[domain].[context].[item]`，如 `hud.chaos.label`、`enemy.patrol.name`
  - 插值语法：`{variableName}`，运行时替换
  - 语言偏好存储在 localStorage（key: `coh_locale`）

### DEC-ARCH-008: 净化点为可行走空间（非纯 UI 界面）—— 核心功能决策

- **选择**：PurificationScene 是一个极小的俯视角可行走空间，复用共享移动/渲染管线，模块交互通过接近触发 DOM 面板
- **重要性（重要）**：这是本项目**核心的体验型功能决策，不是可选装饰**。它把"基地管理"从一张静态 UI 界面升级为可持续感知外部压迫的空间体验，直接支撑"孤独的仪式感""绝望边缘的紧绷"两根体验支柱。默认按本决策落地，不降级为纯 DOM/静态界面。
- **理由**：
  1. 复用渲染基础设施减少代码量（不需要为基地单独写一套 UI 系统）
  2. 可行走空间让"能看到外面的黑暗"成为持续的视觉体验而非静态背景图
  3. 接近触发 + DOM 面板 = 空间感（走向模块的过程）+ 操作效率（DOM 表单比 Canvas 交互好用）
  4. 边界外的动态黑暗内容强化"孤独的仪式感"体验支柱

- **共享移动/渲染管线的模块归属（消除"归属待定"）**：
  可复用的移动 / 视野 / tile 渲染**不属于任何单一场景**，抽为独立的"共享场景管线"模块，`RiftScene` 与 `PurificationScene` 均依赖它；各场景只保留自己独有的逻辑。归属如下：

  | 共享能力 | 归属模块（路径） | 说明 |
  | -------- | ---------------- | ---- |
  | 角色移动 | `src/entities/player.ts` | 同一 Player 实体实现，两场景共用输入 + Arcade 物理碰撞 |
  | 视野 / 光照 | `src/systems/visibility-system.ts` | 参数化复用（净化点内视野更大，主要用于边界外黑暗遮罩） |
  | Tile 渲染 | `src/systems/tilemap-renderer.ts`（新增共享模块） | 把 tile 数据渲染为 Phaser Tilemap；Rift 输入程序化数据、净化点输入手工静态数据。与 `src/generation/tilemap-builder.ts` 分工：builder 负责"生成数据→tile 数组"，renderer 负责"tile 数组→场景内可见图层" |

  场景独有逻辑（**不进共享管线**）：RiftScene 独有 AI / 混乱值 / 寻路 / 战斗；PurificationScene 独有 BoundaryAtmosphere / InteractionTrigger。

- **影响**：
  - 上述共享管线模块必须独立于任何场景实现（不能把移动/视野/tile 渲染硬编码在 RiftScene 内），否则 PurificationScene 无法复用
  - PurificationScene 地图是手工设计的静态小地图（非程序化）
  - 新增 BoundaryAtmosphere 系统（粒子+sprite 周期性渲染）
  - 新增 InteractionTrigger 系统（overlap 检测 + DOM 面板生命周期）
- **性能约束**：边界外渲染额外增加 30-50 粒子 + 最多 2 个 sprite，对帧率影响可忽略

### DEC-ARCH-009: 净化点边界的几何真相是曲面对象，不是 tile 网格

- **选择**：净化点边界由 `BoundaryShape`（极坐标压力 blob）定义；碰撞、可见性、地表 vignette、氛围粒子全部查询同一个形状对象。tile 网格降级为**仅供视野遮挡使用的不可见图层**。
- **理由**：边界要能被潮汐压缩、被方向性压力挤出不对称形态。tile 判定只能表达 32px 台阶状的圆，压缩时会出现可见的锯齿跳变，且"膜"这种 1-2px 的曲线结构无法落在 tile 边界上。把形状抽成可按角度查询的函数后，四个消费方自动保持一致——这是避免"碰撞边界和视觉边界差半格"这类经典 bug 的结构性手段。
- **影响**：
  - 碰撞：沿边界角度采样生成小静态体环（Arcade 只有 AABB，曲面墙只能用密排小体近似）
  - 可见性：`VisibilitySystem` 新增 `rayDistanceOverride` 注入点，净化点用 ray-blob 行进（步进 + 二分细化）替代网格 DDA；裂隙侧仍走 DDA。**这是 VisibilitySystem 唯一的场景差异化接口**
  - 形状每次进入净化点重算一次（潮汐状态变了），因此地表纹理必须同时失效重建
- **约束**：任何新增的"和边界有关"的表现或判定，必须查询 `BoundaryShape`，不得自己重算一个圆或读 tile。
- **风险**：静态体环的数量随边界周长增长；当前规模（约 180 个 8px 体）无性能问题，若净化点显著变大需改为逐帧动态生成玩家附近的碰撞段。

## 场景流转

```
BootScene (资源加载)
    ↓
MainMenuScene (标题/开始/继续)
    ↓
┌─────────────────────────────────────────────┐
│  核心循环                                    │
│                                             │
│  PurificationScene ←→ RiftScene             │
│  (基地管理/分配)      (裂隙探索/战斗)         │
│       ↑                    │                │
│       └── ImpactEvent ─────┘                │
│           (冲击结算后回到基地)                 │
└─────────────────────────────────────────────┘
```

- **RiftScene**：裂隙内的核心玩法（移动/潜行/战斗/搜刮/撤离）
- **PurificationScene**：净化点——极小可行走空间，复用俯视角渲染管线；玩家走近模块触发 DOM 管理面板；边界外渲染黑暗+周期性模糊内容营造压迫氛围
- 两个场景共用同一套渲染基础设施（角色移动、视野系统、tile 渲染）
- 场景间通过 GameState 传递持久数据

## 核心系统交互图

```
┌─────────────┐     chaos:changed     ┌──────────┐
│ ChaosSystem │──────────────────────→│   HUD    │
└──────┬──────┘                       └──────────┘
       │ chaos:threshold                    ↑
       ↓                                    │ state updates
┌─────────────┐                       ┌──────────┐
│   Player    │←──player:damaged──────│  Combat  │
└──────┬──────┘                       └────┬─────┘
       │ position                          │
       ↓                                   │ enemy:damaged / enemy:killed
┌─────────────┐     enemy:alert      ┌────┴─────┐
│ Visibility  │──────────────────────→│    AI    │
└─────────────┘                       └────┬─────┘
                                           │ path request
                                           ↓
                                    ┌──────────────┐
                                    │ Pathfinding  │
                                    └──────────────┘
```

> 图中箭头是**数据流向**，不是调用关系。Combat → AI 的两条事件由 `RiftScene` 转译为 `reportDamage()` / `despawn()`；战斗的噪声（挥空也会发出，因此没有对应事件）走 `create()` 注入的 `CombatHooks.onNoise` 回调，同样由场景层转调 `AISystem.reportNoise()`。两个系统互不 import。

## 净化点场景技术方案 (PurificationScene)

### 设计概述

净化点不是纯 UI 界面，而是一个极小的可行走俯视角空间。玩家在其中移动，走到功能模块旁边触发 DOM 管理面板。关键氛围特性：能看到边界外的黑暗，黑暗中有隐晦的周期性内容暗示外部污染的存在。

### 空间规格

- **尺寸**：约 12x10 tile（几步路的范围）
- **内容**：
  - 玩家角色（可移动）
  - 2-3 个功能模块实体（可交互对象，发光标记）
  - 裂隙入口（出击入口点）
  - 边界墙/栏杆（标记安全区域边缘）
- **边界外**：黑暗区域延伸到屏幕边缘（不是黑幕遮挡，是有内容的黑暗）

### 渲染管线复用

PurificationScene 复用 RiftScene 的以下基础设施：
- **角色移动**：同一个 Player 实体，相同的输入处理和物理碰撞
- **视野系统**：复用 VisibilitySystem，但参数不同（净化点内视野范围更大/全域，主要用于边界外的黑暗遮罩）
- **Tile 渲染**：静态小地图（手动设计，非程序化生成）
- **相机**：跟随玩家，但空间太小几乎不需要滚动

不复用的部分：AI 系统、混乱值、寻路、战斗（净化点内无敌人无威胁）。

### 动态力场边界（Slice 4.5 新增，取代静态圆形安全区）

Slice 4.5 前，净化点的边界是"tile 判定出的固定圆 + 边界外粒子"。现在**边界几何是一个独立的、被多方共用的形状对象**（`BoundaryShape`），世界模型是"被外界污染压力不均匀挤压的残余力场气泡"。

- **形状**：极坐标椭圆 × 潮汐强度缩放 × 两个高斯方向压力叶 × 交互点安全钳制（保证气泡永不挤破任何交互点）。压力方向按周期确定性生成，潮汐相位（crest / ebb）调制振幅。
- **生命周期**：每次 `PurificationScene.create()` 构建一次，之后是无状态查询对象（`radiusAt` / `normalizedDist` / `isInside`）。**不逐帧变形**——观感上的"呼吸"由独立的视觉层负责。
- **六个消费方**（这是本块最容易再次漂移的地方，改动 BoundaryShape 必须同步检查）：
  1. **tilemap 构建**：tile 中心在 98% 半径内即 FLOOR。该图层 `setVisible(false)`，**只作为视野遮挡网格存在**
  2. **程序化地表纹理**：用边界梯度带（inner / membrane / outer）画 vignette，软过渡替代硬墙
  3. **平滑 blob 碰撞体**：沿 98% 半径角度采样生成小静态体环，替代 tile 碰撞（曲面边界无法用 tile AABB 表达）
  4. **可见性**：`VisibilitySystem` 的 `rayDistanceOverride` 做 ray-blob 行进 + 二分细化，**替代 tile DDA**（见 DEC-ARCH-009）
  5. **BoundaryAtmosphere**：粒子/apparition 的生成与消亡半径跟随 blob
  6. **BoundaryBreath**：纯视觉叠加层——并发的局部短弧向内扫入 + 虚空侵入楔形 + 膜线内凹变形。视觉权重刻意压到背景级，无 gameplay 影响
- **设计权威**：规则与数值住在 `docs/specs/system-purification-impact.md`（边界规则组），不在本文档。

### 边界外黑暗氛围系统（Boundary Atmosphere）

这是净化点的核心氛围系统，目的是让玩家视觉上持续感受到"外面有东西在压迫"。

> **[Slice 4.5 更新]** 下文的"方案 A+B 混合（粒子 + 半透明 Sprite）"仍然成立，但它现在是**边界的氛围层，不是边界本身**：形状由 `BoundaryShape` 定义，粒子半径跟随该形状；地面到虚空的过渡由程序化地表的 vignette 承担，不再是"半透明黑雾层 + 硬墙"。原文中"圆形安全区""黑色底层 + 黑雾层"的描述按此理解。

**技术实现方案：**

```
渲染层级（从底到顶）：
1. 黑色底层（纯黑背景）
2. 模糊内容层（边界外的动态内容）
3. 半透明黑雾层（降低模糊内容的可见度，保持"隐晦"感）
4. 净化点地面/墙体（正常渲染）
5. 边界发光线（标记安全区边缘的微弱光线）
6. 实体层（玩家/模块/交互物）
7. HUD 层
```

**模糊内容层的实现：**

| 方案 | 实现 | 优势 | 适用场景 |
| ---- | ---- | ---- | -------- |
| A: 粒子系统 | Phaser ParticleEmitter，大颗粒、低 alpha、缓慢漂移 | 性能好、自然随机、Phaser 原生支持 | 通用"漂浮感" |
| B: 半透明 Sprite | 预制的模糊形状 sprite，周期性淡入/淡出/移动 | 可控性强、可设计具体形态 | 需要辨认出"类似形态"的暗示 |
| C: Shader（RenderTexture） | 自定义 fragment shader 做噪声扰动 | 最有机、最无缝 | 全屏均匀效果 |

**选择：A + B 混合**
- **底层**：粒子系统产出持续的微弱飘动（A）— 随机、低成本、有"活物"感
- **事件层**：少量半透明 Sprite 做周期性"浮现"（B）— 可控节奏、可设计具体形态暗示

**周期性行为设计：**
- 粒子持续存在（背景噪声），参数微调产生呼吸感（alpha 0.05-0.15 区间缓动）
- 每 8-15 秒（随机间隔），一个较大的模糊形态在边界外某处缓慢浮现 → 停留 2-3 秒 → 消散
- 浮现位置在边界不同方向轮换（不总是同一个地方）
- 冲击临近时频率加快、alpha 增强（与 GameState 的 impactIntensity 挂钩）

**性能约束：**
- 粒子数量上限：30-50 个（大颗粒、低频发射）
- Sprite 浮现同时最多 2 个
- 所有边界外内容在屏幕外不渲染（Phaser 自动裁剪）
- 不使用实时 blur shader（用预模糊的 sprite 资产代替）

### 模块交互机制

- 每个功能模块是一个带碰撞体的 Sprite（有视觉状态：健康/受损/严重受损）
- 玩家进入模块周围的触发区（overlap zone，约 1.5 tile 半径）时：
  1. 显示交互提示（"按 E 管理"）
  2. 按下交互键 → 激活 DOM overlay 管理面板
  3. DOM 面板打开时：游戏暂停输入（玩家不能移动），Canvas 层加暗色 overlay
  4. 面板关闭时：恢复游戏输入
- 裂隙入口的交互逻辑相同，但触发的是"出击确认"面板

### 新增系统注册

| 模块 | 路径 | 职责 |
| ---- | ---- | ---- |
| BoundaryShape | src/systems/boundary-shape.ts | 边界几何唯一真相（潮汐驱动的压力 blob） |
| BoundaryBreath | src/systems/boundary-breath.ts | 边界局部压力冲击与膜变形（纯视觉） |
| BoundaryAtmosphere | src/systems/boundary-atmosphere.ts | 净化点边界外的黑暗+模糊内容周期性渲染 |
| ProceduralPurificationSurface | src/systems/procedural-purification-surface.ts | 净化点地表逐像素生成 + 边界 vignette |
| InteractionTrigger | src/systems/interaction-trigger.ts | 接近触发交互（overlap 检测 + 提示 + 面板激活） |

## 性能约束

| 指标 | 目标 | 检测方式 |
| ---- | ---- | -------- |
| FPS | 稳定 60（最低不低于 30） | Chrome DevTools Performance |
| 首屏加载 | < 3 秒 | Lighthouse / Network tab |
| 资产总大小 | < 10MB（首屏 < 2MB） | `npm run build` 后检查 dist/ |
| 内存泄漏 | 无（长时间运行无持续增长） | DevTools Memory timeline |
| Raycasting | < 2ms/帧（60 条光线内） | Performance.now() profiling |
| Pathfinding | < 5ms/次（单实体） | 定时器监控 |

### 性能规则

- **游戏循环禁止**：new Object / 数组字面量 / 字符串拼接（预分配所有临时变量）
- **对象池**：子弹、粒子、伤害数字、音效实例全部池化
- **Raycasting 优化**：玩家静止时缓存结果；降级策略（30fps 时减少光线数）
- **AI 分帧**：N 个敌人的寻路分散到 N 帧执行（每帧最多 1 次 A*）
- **Tilemap**：依赖 Phaser 内置视锥裁剪（Culling），不渲染屏幕外 tile

## 技术风险

| 风险 | 影响 | 概率 | 缓解策略 |
| ---- | ---- | ---- | -------- |
| 视野 raycasting 性能不足 | 帧率下降 | 中 | 光线数量限制（30-60）、静止缓存、WebGL shader 备选方案 |
| CA 地图不连通 | 无法通行 | 中 | Flood fill 验证 + 自动打通最大连通区域；碎片内重试上限 3 次 |
| Voronoi 碎片大小不均 | 体验不一致 | 低 | 约束最小/最大面积；Lloyd 松弛迭代平衡 |
| 多敌人寻路卡顿 | 帧率下降 | 低 | 分帧计算；路径缓存；远距离敌人用简化寻路 |
| Phaser 内存泄漏（场景切换） | 长时间运行崩溃 | 低 | 严格场景 shutdown 清理；定期检测 |
| 浏览器 LocalStorage 空间不足 | 存档丢失 | 极低 | 存档压缩；数据精简；错误提示 |
| 移动端音频 Autoplay 限制 | 无声 | 中 | 首次交互 unlock；静默播放检测 |

## 开发命令

- 启动开发：`npm run dev`
- 构建生产：`npm run build`
- 类型检查：`npm run typecheck`
- 预览构建：`npm run preview`

## 资产加载策略

- **Boot 阶段**：加载 loading bar 所需最小资源
- **Preload 阶段**：按场景按需加载（Rift 资源 / Purification 资源分开）
- **格式要求**：
  - 图片：PNG（像素风，不需 WebP 压缩）
  - Spritesheet：统一 tile 尺寸（建议 16x16 或 32x32，Foundation 美术方向确定后固定）
  - 音频：MP3 + OGG 双格式（覆盖所有浏览器）
  - 字体：系统字体优先；如需自定义使用 WOFF2

## 音频技术规范

- **API**：Phaser 内置 Sound Manager（基于 WebAudio，fallback HTML5 Audio）
- **加载**：随场景预加载；环境音使用流式加载
- **控制**：AudioManager 封装全局音量/静音/分类音量（SFX/BGM/Ambient）
- **格式**：MP3（主）+ OGG（兼容）
- **限制**：同时播放音效数上限 8 个（防止音频过载）
- **首次交互解锁**：BootScene 中监听首次用户输入后 resume AudioContext

## 存档数据结构（概要）

```typescript
interface SaveData {
  version: number;               // 存档版本号（向前兼容用）
  timestamp: number;             // 保存时间戳
  cycle: number;                 // 当前循环数（第 N 次出击）
  purificationPoint: {
    modules: ModuleState[];      // 各模块状态
    kindlingReserve: number;     // 薪柴储备
  };
  player: {
    health: number;
    inventory: ItemSlot[];
  };
  meta: {
    impactIntensity: number;     // 当前冲击基础强度
    totalKindlingEarned: number; // 累计获取薪柴（统计用）
  };
}
```

注意：裂隙内的状态（地图/敌人/混乱值）不存档。死亡或撤离后裂隙数据丢弃。只持久化净化点状态。

## 国际化 (i18n) 技术规范

### 支持语言

| 代码 | 语言 | 状态 |
| ---- | ---- | ---- |
| zh-CN | 简体中文 | 默认（先行开发） |
| en | English | 后续补充 |

### 架构设计

```typescript
// 使用方式（Phaser 场景 / DOM UI 中均可调用）
import { t, setLocale, getLocale } from '@/i18n';

// 简单文本
const label = t('hud.chaos.label');  // "混乱值" or "Chaos"

// 带插值
const msg = t('hud.chaos.value', { current: 45, max: 100 });  // "45 / 100"

// 切换语言
setLocale('en');
```

### Key 命名规范

```
[domain].[context].[item]

域名(domain):
  hud       — 游戏内 HUD 文本
  menu      — 菜单/标题界面
  rift      — 裂隙内提示
  purify    — 净化点界面
  item      — 物品名称/描述
  enemy     — 敌人名称/描述
  impact    — 冲击相关
  common    — 通用（确认/取消/返回等）

示例:
  hud.chaos.label        → "混乱值"
  hud.health.label       → "状态"
  menu.title             → "COH"
  menu.newGame           → "新远征"
  menu.continue          → "继续"
  rift.exitHint          → "撤离点已标记"
  purify.allocate.title  → "薪柴分配"
  item.distorter.name    → "干扰发生器"
  item.distorter.desc    → "释放异源干扰波。短暂致盲周围污染体。"
  enemy.patrolInfiltrate.name → "巡视渗透体"
  impact.warning         → "边界压力上升"
```

### 文本风格约束

所有翻译文本必须遵守 `world.md` 中定义的叙事语调规则：
- 冷峻克制、陈述事实、不渲染情绪
- 无人称或旁白体
- tooltip/简述不超过 15 字
- 详细描述不超过 40 字
- 禁止诗意化措辞、感叹号、修辞性疑问

### 语言切换机制

- 语言偏好存储在 `localStorage` (key: `coh_locale`)
- 首次加载：检测 `navigator.language`，匹配则用，否则 fallback 到 zh-CN
- 切换语言后需要刷新当前场景的所有文本（通过事件通知各 UI 组件更新）
- 切换入口：主菜单设置选项（MVP 可简化为 MainMenuScene 上的语言按钮）

### 性能注意

- locale 文件在 BootScene 时全量加载（文本数据量极小，<50KB）
- `t()` 函数是纯同步查找（对象属性访问），不涉及异步/IO
- 游戏循环中可安全调用 `t()`（无 GC 压力，返回已存在的字符串引用）
- 带插值的调用会创建新字符串——HUD 中频繁更新的数值文本应缓存结果，仅在值变化时重新调用
