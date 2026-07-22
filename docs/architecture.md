---
status: DRAFT
created-by: code agent (mode A)
created-date: 2026-07-22
last-modified: 2026-07-22
changed-this-slice: true
note: Foundation Step 2. Pending human approval.
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
| UI (游戏内 HUD) | Phaser 内置 Text/Graphics | 状态条/数值显示用 Phaser 原生足够 | - |
| UI (复杂界面) | 原生 DOM overlay | 净化点分配界面用 DOM 构建（比 Canvas UI 开发效率高 10x）；不引入 React/Vue（杀鸡焉用牛刀） | - |
| 国际化 (i18n) | 自实现 JSON + TypeScript | 文本量有限（<300 条）；自实现零依赖、类型安全、无学习成本；支持简体中文/英文 | i18next（过重）、typesafe-i18n（额外构建步骤） |
| 部署 | 静态文件 (Vite build) | 产出纯静态文件，可部署到任何静态托管 | - |

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
│   ├── boundary-atmosphere.ts  # 净化点边界外黑暗+模糊内容周期渲染
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
│   ├── voronoi-partitioner.ts  # Voronoi 切分：生成 4-6 个不规则碎片区域
│   ├── cellular-automata.ts    # CA 有机地形：在碎片内部生成洞穴/有机结构
│   ├── fracture-connector.ts   # 裂口连接：碎片间窄小的空间裂口生成
│   ├── content-placer.ts       # 房间内容放置（敌人/物品/撤离点）
│   └── tilemap-builder.ts      # 生成数据 → Phaser Tilemap
├── managers/
│   ├── game-state.ts           # 全局游戏状态（跨场景持久）
│   ├── save-manager.ts         # 存档读写（LocalStorage）
│   └── audio-manager.ts        # 音频播放控制
├── ui/
│   ├── hud.ts                  # 游戏内 HUD（Phaser 层）
│   ├── dom/
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
```

## 模块通信方式

**主模式：类型安全事件总线（Event Bus）**

系统之间通过事件解耦。不允许系统 A 直接 import 并调用系统 B 的方法（管理器除外）。

```typescript
// 事件定义示例
enum GameEvent {
  CHAOS_CHANGED = 'chaos:changed',
  CHAOS_THRESHOLD = 'chaos:threshold',
  ENEMY_ALERT = 'enemy:alert',
  PLAYER_DAMAGED = 'player:damaged',
  KINDLING_COLLECTED = 'kindling:collected',
  RIFT_EXIT = 'rift:exit',
}

// 使用方式
eventBus.emit(GameEvent.CHAOS_CHANGED, { value: 45, delta: 2 });
eventBus.on(GameEvent.CHAOS_THRESHOLD, (data) => { /* apply penalty */ });
```

**辅助模式：**
- **Manager 直接调用**：GameState、SaveManager、AudioManager 提供直接方法调用接口（它们是全局服务，不是游戏逻辑系统）
- **Scene 数据传递**：场景切换时通过 `scene.start(key, data)` 传递初始化数据

**禁止：**
- 系统间循环依赖
- 在事件回调中同步触发其他事件（防止事件风暴）
- 绕过事件总线直接跨系统访问状态

## 已注册模块

| 模块 | 路径 | 职责 | 对外接口 |
| ---- | ---- | ---- | -------- |
| EventBus | src/core/event-bus.ts | 类型安全的发布/订阅系统 | emit(), on(), off() |
| I18n | src/i18n/index.ts | 多语言文本查找与语言切换 | t(key, params?), setLocale(), getLocale() |
| GameState | src/managers/game-state.ts | 全局状态持有和查询 | get/set 方法 |
| SaveManager | src/managers/save-manager.ts | 存档序列化/反序列化 | save(), load(), hasSave() |
| AudioManager | src/managers/audio-manager.ts | 音频播放/停止/音量控制 | play(), stop(), setVolume() |
| VisibilitySystem | src/systems/visibility-system.ts | 玩家视野计算与渲染遮罩 | update(playerPos, facing) |
| AISystem | src/systems/ai/ | 敌人行为控制 | update(enemies, playerPos) |
| ChaosSystem | src/systems/chaos-system.ts | 混乱值累积与惩罚触发 | update(dt), getValue() |
| CombatSystem | src/systems/combat-system.ts | 伤害计算与战斗逻辑 | attack(source, target) |
| Pathfinding | src/systems/pathfinding.ts | 网格 A* 寻路 | findPath(from, to) |
| BoundaryAtmosphere | src/systems/boundary-atmosphere.ts | 净化点边界外黑暗氛围渲染 | update(dt), setIntensity(n) |
| InteractionTrigger | src/systems/interaction-trigger.ts | 接近触发交互检测与面板激活 | register(entity, callback) |
| MapGenerator | src/generation/ | Voronoi+CA 程序化地图生成 | generate(config): MapData |
| HUD | src/ui/hud.ts | 游戏内状态显示 | update(state) |
| DOM UI | src/ui/dom/ | 复杂交互界面 | show(), hide() |

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
- **风险**：CA 可能产出不连通区域 → flood fill + 重连修补；Voronoi 碎片大小差异过大 → 约束最小/最大面积

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

### DEC-ARCH-008: 净化点为可行走空间（非纯 UI 界面）

- **选择**：PurificationScene 是一个极小的俯视角可行走空间，复用 RiftScene 渲染管线，模块交互通过接近触发 DOM 面板
- **理由**：
  1. 复用渲染基础设施减少代码量（不需要为基地单独写一套 UI 系统）
  2. 可行走空间让"能看到外面的黑暗"成为持续的视觉体验而非静态背景图
  3. 接近触发 + DOM 面板 = 空间感（走向模块的过程）+ 操作效率（DOM 表单比 Canvas 交互好用）
  4. 边界外的动态黑暗内容强化"孤独的仪式感"体验支柱
- **影响**：
  - 需要抽取 RiftScene 的渲染/移动/视野为可复用模块（不能硬编码在 RiftScene 内）
  - PurificationScene 地图是手工设计的静态小地图（非程序化）
  - 新增 BoundaryAtmosphere 系统（粒子+sprite 周期性渲染）
  - 新增 InteractionTrigger 系统（overlap 检测 + DOM 面板生命周期）
- **性能约束**：边界外渲染额外增加 30-50 粒子 + 最多 2 个 sprite，对帧率影响可忽略

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
       ↓                                   │ enemy:hit
┌─────────────┐     enemy:alert      ┌────┴─────┐
│ Visibility  │──────────────────────→│    AI    │
└─────────────┘                       └────┬─────┘
                                           │ path request
                                           ↓
                                    ┌──────────────┐
                                    │ Pathfinding  │
                                    └──────────────┘
```

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

### 边界外黑暗氛围系统（Boundary Atmosphere）

这是净化点的核心氛围系统，目的是让玩家视觉上持续感受到"外面有东西在压迫"。

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
| BoundaryAtmosphere | src/systems/boundary-atmosphere.ts | 净化点边界外的黑暗+模糊内容周期性渲染 |
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
