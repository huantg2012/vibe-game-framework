# 净化点场景视觉/UX 重构方案

## 问题诊断

当前净化点场景的视觉问题根源是**信息呈现缺乏层级和统一规则**：

1. **Phaser Text 与 DOM 文字混排**：模块标签（"核心"/"储藏"）、效果文字（"薪柴增幅 +35%"）、交互提示（"E - 分配薪柴"）全部用 Phaser.Text 渲染在世界空间，受 pixelArt:true 影响模糊/锯齿，与右上角清晰的 DOM HUD 视觉断裂
2. **文字被裁切**：储藏模块位于 CENTER_X + 4*TILE = 右侧 224px 处，14x12 地图总宽 448px，效果文字溢出地图边界被 camera bounds 裁切
3. **信息始终可见**：所有模块的 label、HP bar、效果文字始终显示，无论玩家距离如何。信息密度均匀 = 无层级 = 混乱
4. **交互点视觉语言不统一**：裂隙入口（teal 圆）、防御点（紫圆）、成长祭坛（橙方块）——形状/色彩/大小各异，像是不同开发者各写各的

## 设计目标

将净化点场景从"调试界面"转变为符合 art-direction.md 4.1 节氛围定义的游戏场景：**孤立、微光、功能性、空旷、勉强维持**。参考 Darkwood 基地画面的信息呈现方式——暗色统一背景，交互靠光照引导，文字只在需要时出现，且出现在屏幕固定位置。

---

## A. 信息分层原则

| 层级 | 位置 | 内容 | 何时可见 |
|------|------|------|----------|
| 世界层 | Phaser 渲染，随摄像机 | 模块形体（几何+发光状态）、交互点光晕、边界粒子 | 始终可见（视觉引导） |
| 固定 UI 层 | DOM overlay，不随摄像机 | HUD 面板（薪柴/稳定度/潮汐）、交互提示条 | 始终/条件可见 |
| 交互层 | DOM overlay，居中面板 | 分配/防御/成长/状态面板 | 仅面板打开时 |

**核心规则：游戏世界内不出现任何文字。** 所有需要阅读的文字走 DOM overlay。世界层只用形状、颜色、发光、动画传达信息。

---

## B. 游戏世界内的视觉重构

### B1. 模块表现

移除所有 Phaser.Text（labelText、effectText、promptText）。模块通过以下视觉语言传达身份和状态：

**形状即身份：**
- CORE：正六边形，半径 16px（当前 14px 稍增）
- STORAGE：正方形，边长 28px（当前 24px 稍增）

**HP 状态通过发光强度表达：**

| HP 比例 | 边缘发光 alpha | 填充 alpha | 附加效果 |
|---------|---------------|------------|----------|
| 75-100% | 0.7 | 0.9 | 无（稳定运行） |
| 50-74% | 0.5 | 0.7 | 无 |
| 25-49% | 0.3 | 0.5 | 边缘每 2s 闪烁一次（alpha 在 0.3-0.5 间振荡） |
| 0-24% | 0.15 | 0.3 | 边缘持续快速闪烁（800ms 周期），颜色偏移向 `#cc3333` |

**色彩规格：**
- CORE 主色：`#4488cc`（保持）
- CORE 边缘光：`#6699dd`（比主色亮一级）
- STORAGE 主色：`#cc8844`（保持）
- STORAGE 边缘光：`#ddaa66`（比主色亮一级）
- 严重受损叠加色：`#cc3333`（art-direction ui-danger）

**实现方式：**
```
每帧重绘 graphics:
1. fillStyle(mainColor, fillAlpha) → 填充形状
2. lineStyle(2, edgeColor, edgeAlpha) → 描边
3. 如果 HP < 25%: lineStyle(1, 0xcc3333, flickerAlpha) → 额外一圈 danger 描边
```

**移除的元素：**
- `labelText`（"核心"/"储藏"）：删除。形状+颜色已传达身份。详情在 HUD tooltip 中。
- `effectText`（"薪柴增幅 +35%"）：删除。效果信息移至靠近时的 DOM tooltip 或 HUD。
- `promptText`（"E - 分配薪柴"）：删除。交互提示移至屏幕底部统一提示条。

### B2. HP 条重构

当前 HP 条是浮在模块上方 24px 的独立绿色条。重构为**模块形体内的内嵌条**：

**位置：** 模块形体正下方 4px 处（不是上方），紧贴形体底边。
**尺寸：** 宽度与模块形体宽度一致（CORE: 28px，STORAGE: 28px），高度 3px。
**颜色：** 与模块同色系（不是通用绿色）。
- CORE HP 条：`#4488cc` 填充，`#222233` 背景
- STORAGE HP 条：`#cc8844` 填充，`#332222` 背景
- 当 HP < 25% 时：填充色变为 `#cc3333`

**可见性规则：** HP 条仅在以下条件满足时可见（alpha 从 0 到 1，200ms 渐入）：
- 玩家与模块距离 <= 2.5 * TILE（80px），即交互半径 * 2.5 的预览距离
- 或者 HP < 50%（受损时始终显示，作为视觉警告）

### B3. 交互点视觉统一

所有交互点使用统一视觉语言：**发光圆点 + 外圈呼吸**。通过颜色区分功能。

| 交互点 | 中心色 | 外圈色 | 中心半径 | 外圈半径 | 含义 |
|--------|--------|--------|----------|----------|------|
| 裂隙入口 | `#1aad96` | `#2ae6c8` | 8px | 14px | 进入裂隙 |
| 防御配置 | `#6644aa` | `#8866cc` | 7px | 12px | 防御管理 |
| 永久改造 | `#aa6622` | `#cc8844` | 7px | 12px | 成长祭坛 |

**统一行为：**
- 呼吸动画：外圈 alpha 在 `baseAlpha` 和 `baseAlpha + 0.25` 之间正弦振荡，周期 2.5s
- 靠近时（交互半径内）：呼吸加速至 1.2s 周期，且外圈半径额外 +3px
- "有可操作内容"高亮（当前 `shouldHighlight` 逻辑保留）：中心亮度 +0.15，呼吸周期缩短至 0.8s

**移除：** 所有交互点的 Phaser.Text prompt（defensePromptText、growthPromptText）。统一到底部提示条。

### B4. 接近时的视觉反馈

当玩家进入交互半径时，世界层不显示文字，而是：
1. 交互点呼吸加速（如上 B3）
2. 模块边缘发光增强 +0.2 alpha（"设备感知到你靠近"的暗示）
3. 底部 DOM 提示条显示对应操作文字（见 D 节）

---

## C. 固定 UI 层（DOM Overlay）重构

### C1. HUD 面板（右上角）

当前 HUD 是四行松散的 innerHTML，字号/颜色不一致。重构为一个结构紧凑的面板：

**位置：** `position:fixed; top:12px; right:12px;`
**尺寸：** 自适应内容，最小宽度 120px
**样式：**
```css
background: rgba(15, 17, 20, 0.85);  /* ui-bg #0f1114 */
border: 1px solid #2a2d32;            /* ui-border */
padding: 10px 12px;
font-family: 'Courier New', monospace;
pointer-events: none;
```

**内容布局（从上到下）：**

```
 ┌─────────────────────┐
 │  薪柴  12           │  ← 主资源，最大字号
 │  ─────────────────  │  ← 1px 分割线
 │  稳定度  67%        │  ← 进度信息
 │  ▓▓▓▓▓▓▓░░░        │  ← 进度条
 │  ─────────────────  │  ← 1px 分割线
 │  第2潮 · 涨潮       │  ← 潮汐状态
 │  强度 0.45 (3/5)    │  ← 潮汐详情
 └─────────────────────┘
```

**排版规格：**

| 元素 | 字号 | 颜色 | 对齐 |
|------|------|------|------|
| "薪柴" 标签 | 11px | `#8a8f96` (ui-text) | 左 |
| 薪柴数值 | 14px, bold | `#c89040` (warm-dim) | 右，与标签同行 |
| 分割线 | - | `#2a2d32` (ui-border) | 全宽 |
| "稳定度" 标签 | 10px | `#8a8f96` | 左 |
| 稳定度百分比 | 11px | `#44aa66` | 右，与标签同行 |
| 稳定度进度条 | 高 3px | 填充 `#44aa66`，背景 `#1a1d22` | 全宽 |
| 潮汐行 | 10px | `#668888` | 左 |
| 强度行 | 9px | `#556666` | 左 |

**稳定度进度条规格：**
- 宽度：面板内宽（约 96px）
- 高度：3px
- 圆角：0（工业直角，art-direction 6.2）
- 背景：`#1a1d22`
- 填充：`#44aa66`
- 当进度 >= 75%：填充色变为 `#66cc88`（更亮，表示接近完成）

### C2. 交互提示条（底部居中）

**这是本次重构的关键新增组件。** 参考 Darkwood/Signalis 的做法：屏幕底部固定位置，当玩家靠近可交互物时显示统一格式的提示。

**位置：** `position:fixed; bottom:24px; left:50%; transform:translateX(-50%);`
**样式：**
```css
background: rgba(15, 17, 20, 0.88);
border: 1px solid #2a2d32;
padding: 6px 16px;
font-family: 'Courier New', monospace;
font-size: 11px;
color: #c8cdd4;          /* ui-text-bright */
pointer-events: none;
transition: opacity 0.15s ease-out;
```

**内容格式：** `[E] 动作描述` 或 `[Tab] 动作描述`

| 靠近目标 | 提示文字 |
|----------|----------|
| CORE 模块 | `[E] 分配薪柴 - 核心` |
| STORAGE 模块 | `[E] 分配薪柴 - 储藏` |
| 裂隙入口 | `[E] 进入裂隙` |
| 防御配置点 | `[E] 防御配置` |
| 永久改造点 | `[E] 永久改造` |
| 无靠近目标 | `[Tab] 状态总览` |

**按键标记的视觉：**
- `[E]` / `[Tab]` 部分用 `#c8cdd4`（ui-text-bright），略亮于描述文字
- 描述文字用 `#8a8f96`（ui-text）
- 按键与描述之间间距 6px

**显隐规则：**
- 靠近可交互物时：opacity 从 0 到 1，持续 150ms
- 离开交互范围时：opacity 从 1 到 0，持续 100ms
- 面板打开时：整个提示条隐藏（面板有自己的操作提示）
- 优先级：当同时靠近多个交互点时，取距离最近的

**附加信息行（可选）：**

当靠近模块时，提示条可显示第二行小字作为状态预览：

```
 ┌─────────────────────────────────┐
 │  [E] 分配薪柴 - 核心            │
 │  HP 60/100 · 混乱抑制 -18%      │  ← 10px, #666
 └─────────────────────────────────┘
```

这解决了原来模块 effectText 被裁切的问题——信息移到 DOM 层，永远不会被场景边界切断。

第二行规格：
- 字号：10px
- 颜色：`#666666`
- 上间距：4px
- 内容格式：
  - CORE: `HP ${hp}/${maxHp} · 混乱抑制 -${pct}%`
  - STORAGE: `HP ${hp}/${maxHp} · 薪柴增幅 +${pct}%`
  - 裂隙入口: `第${cycle}次出击`
  - 防御/成长: 无第二行

### C3. "始终可见"的全局提示

当玩家不靠近任何交互点时，底部提示条显示弱化的通用提示：
- 文字：`[Tab] 状态总览`
- alpha：0.5（比交互提示更暗，不抢注意力）
- 颜色降级为 `#666666`

这给予玩家持续的操作引导感，但不干扰游戏氛围。

---

## D. Toast 通知重构

当前 toast（新工具通知、里程碑）位置不统一（top:40px / 屏幕正中）。统一为：

**位置：** `position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);`（里程碑/重要事件）或 `top:48px; left:50%; transform:translateX(-50%);`（临时提示）

**统一样式：**
```css
/* 重要通知（里程碑/潮汐变更） */
background: rgba(10, 10, 14, 0.92);
border: 1px solid [语义色];
padding: 12px 24px;
font-family: 'Courier New', monospace;
font-size: 12px;
color: [语义色];

/* 临时 toast（新工具等） */
background: rgba(15, 17, 20, 0.85);
border: 1px solid #2a2d32;
padding: 6px 14px;
font-family: 'Courier New', monospace;
font-size: 10px;
color: #8a8f96;
```

**动画：** 统一使用 opacity 渐入渐出（不用位移动画，保持克制）：
- 出现：opacity 0 -> 1，200ms
- 持续：2000ms
- 消失：opacity 1 -> 0，300ms

---

## E. 完整规格总结（Code Agent 执行清单）

### E1. 删除的元素

| 文件 | 删除内容 |
|------|----------|
| `purification-module.ts` | `labelText`（line 44, 88-96）|
| `purification-module.ts` | `effectText`（line 45, 99-107, 187-199）|
| `purification-module.ts` | `promptText`（line 43, 120-127）|
| `purification-scene.ts` | `riftPromptText`（line 155, 290-295）|
| `purification-scene.ts` | `defensePromptText`（line 159, 298-304）|
| `purification-scene.ts` | `growthPromptText`（line 163, 308-314）|
| `purification-scene.ts` | `interactionTextStyle` const（line 279-286）|

### E2. 新增的 DOM 组件

**文件：`src/ui/dom/purification-hud.ts`**（新建，替代 scene 内的 `createPurifHud`）

职责：
- 创建并管理右上角 HUD 面板
- 创建并管理底部交互提示条
- 暴露 `update(nearestTarget, moduleData)` 方法供 scene 每帧调用
- 暴露 `refresh()` 方法供薪柴变化后调用
- 暴露 `destroy()` 清理 DOM

接口：
```typescript
interface PurificationHud {
  create(): void;
  /** 每帧调用，传入最近的交互目标信息 */
  updatePrompt(target: InteractionTarget | null): void;
  /** 数据变化后刷新 HUD 数值 */
  refresh(): void;
  /** 面板打开时隐藏提示条 */
  setPromptVisible(visible: boolean): void;
  destroy(): void;
}

type InteractionTarget = {
  type: 'core' | 'storage' | 'rift' | 'defense' | 'growth';
  distance: number;
  moduleData?: { hp: number; maxHp: number; effectPct: number };
};
```

### E3. 模块视觉修改（`purification-module.ts`）

重写 `create()` 和 `updateHpBar()` ：

1. 删除所有 Text 对象
2. `create()` 只绘制形体（增大到规格尺寸）
3. 新增 `updateVisualState()` 每帧调用：
   - 根据 HP 比例计算 fillAlpha、edgeAlpha、flickerAlpha
   - 重绘 graphics（clear + fill + stroke + optional danger stroke）
4. HP 条移到形体底部，使用模块同色
5. 新增 `setProximityGlow(inRange: boolean)` 供 scene 调用：
   - inRange 时 edgeAlpha += 0.2（clamped at 1.0）

### E4. 场景主循环修改（`purification-scene.ts`）

1. 删除 `createPurifHud()` 和 `refreshKindlingDisplay()` 的 innerHTML 逻辑
2. 用新的 `PurificationHud` 组件替代
3. `update()` 循环中：
   - 计算玩家到所有交互点的距离
   - 找出最近的在范围内的目标
   - 调用 `hud.updatePrompt(target)`
   - 调用 `coreModule.setProximityGlow(...)` 等
4. 面板打开时调用 `hud.setPromptVisible(false)`
5. `onShutdown` 中调用 `hud.destroy()`

### E5. 交互点绘制统一

将裂隙入口、防御点、成长祭坛的绘制逻辑统一为可复用函数：

```typescript
function drawInteractionPoint(
  graphics: Phaser.GameObjects.Graphics,
  x: number, y: number,
  centerColor: number, ringColor: number,
  centerRadius: number, ringRadius: number,
  pulse: number, // 0-1 normalized
  highlighted: boolean,
  inRange: boolean,
): void {
  const baseAlpha = highlighted ? 0.55 : 0.4;
  const pulseAmp = 0.25;
  const alpha = baseAlpha + Math.sin(pulse) * pulseAmp;
  const rBonus = inRange ? 3 : 0;

  graphics.clear();
  graphics.fillStyle(centerColor, alpha + 0.15);
  graphics.fillCircle(x, y, centerRadius);
  graphics.lineStyle(2, ringColor, alpha);
  graphics.strokeCircle(x, y, ringRadius + rBonus);
}
```

### E6. 色值汇总（可直接粘贴为常量）

```typescript
const PURIF_UI_COLORS = {
  // HUD panel
  hudBg: 'rgba(15, 17, 20, 0.85)',
  hudBorder: '#2a2d32',
  textPrimary: '#c8cdd4',    // ui-text-bright
  textSecondary: '#8a8f96',  // ui-text
  textTertiary: '#666666',
  kindlingValue: '#c89040',  // warm-dim
  stabilityFill: '#44aa66',
  stabilityFillHigh: '#66cc88',
  stabilityBg: '#1a1d22',
  tideText: '#668888',
  tideDetail: '#556666',

  // Interaction prompt bar
  promptBg: 'rgba(15, 17, 20, 0.88)',
  promptBorder: '#2a2d32',
  promptKey: '#c8cdd4',
  promptDesc: '#8a8f96',
  promptDetail: '#666666',

  // Module colors (unchanged from current)
  coreMain: 0x4488cc,
  coreEdge: 0x6699dd,
  storageMain: 0xcc8844,
  storageEdge: 0xddaa66,
  dangerOverlay: 0xcc3333,

  // HP bar (module-colored)
  coreHpFill: '#4488cc',
  coreHpBg: '#222233',
  storageHpFill: '#cc8844',
  storageHpBg: '#332222',
  hpDanger: '#cc3333',

  // Interaction points
  riftCenter: 0x1aad96,
  riftRing: 0x2ae6c8,
  defenseCenter: 0x6644aa,
  defenseRing: 0x8866cc,
  growthCenter: 0xaa6622,
  growthRing: 0xcc8844,
};
```

### E7. 尺寸/间距汇总

```typescript
const PURIF_UI_METRICS = {
  // HUD panel
  hudTop: 12,        // px from viewport top
  hudRight: 12,      // px from viewport right
  hudPadding: '10px 12px',
  hudMinWidth: 120,  // px
  hudFontTitle: 14,  // px (kindling value)
  hudFontLabel: 11,  // px
  hudFontDetail: 10, // px
  hudFontSmall: 9,   // px
  hudDividerColor: '#2a2d32',
  hudProgressHeight: 3, // px

  // Interaction prompt bar
  promptBottom: 24,  // px from viewport bottom
  promptPadX: 16,    // px horizontal padding
  promptPadY: 6,     // px vertical padding
  promptFontMain: 11, // px
  promptFontDetail: 10, // px
  promptFadeIn: 150, // ms
  promptFadeOut: 100, // ms
  promptKeyGap: 6,   // px between key and description

  // Module visual
  coreRadius: 16,  // px hexagon radius (up from 14)
  storageSize: 28,    // px square side (up from 24)
  hpBarHeight: 3,     // px
  hpBarGap: 4,        // px below module body
  hpBarFadeDistance: 80, // px (2.5 tiles) - show HP bar within this range
  proximityGlowBonus: 0.2, // alpha added when in range

  // Interaction points (unified)
  breathPeriodNormal: 2500, // ms
  breathPeriodNear: 1200,   // ms
  breathPeriodHighlight: 800, // ms
  nearRingBonus: 3,          // px added to ring radius when in range

  // Toast/notification
  toastFadeIn: 200,   // ms
  toastDuration: 2000, // ms
  toastFadeOut: 300,   // ms
};
```

---

## F. 视觉对照（Before/After 概念）

**Before（当前）：**
```
    ┌────────────────────────────────────┐
    │                    [薪柴: 5      ] │ ← DOM HUD, 12px
    │                    [稳定度: 67%  ] │
    │                    [第2潮·涨潮   ] │
    │                    [强度:0.45... ] │
    │                                    │
    │   ●"E-防御配置"                    │
    │                                    │
    │  [核心]          ○"E-进入裂隙"     │ ← 世界内 Phaser Text
    │  [HP ████░░]  ←Player→  [储藏]    │
    │  [混乱抑制-21%]      [薪柴增幅+35%]│ ← 被裁切!
    │                                    │
    │        ■"E-永久改造"               │
    └────────────────────────────────────┘
```

**After（重构后）：**
```
    ┌────────────────────────────────────┐
    │                    ┌────────────┐  │
    │                    │薪柴     12 │  │ ← DOM 面板
    │                    │────────────│  │
    │                    │稳定度  67% │  │
    │                    │▓▓▓▓▓▓▓░░░ │  │
    │   ○(purple glow)   │────────────│  │
    │                    │第2潮·涨潮  │  │
    │  ⬡(blue glow)     │强度0.45 3/5│  │
    │       ←Player→     └────────────┘  │
    │              ○(teal glow)          │
    │                    ■(orange glow)   │
    │                                    │
    │   ■(orange glow)                   │
    │                                    │
    │      ┌──────────────────────────┐  │
    │      │[E] 分配薪柴 - 核心       │  │ ← DOM 提示条
    │      │HP 60/100 · 混乱抑制 -18% │  │
    │      └──────────────────────────┘  │
    └────────────────────────────────────┘
```

核心变化：
- 世界内零文字，只有发光的几何体
- 所有信息聚合到 DOM 层的两个固定位置
- 底部提示条解决了信息被裁切的问题
- 模块通过发光状态传达健康度（接近时 HP 条才出现）
- 整体画面干净暗沉，符合"微光、空旷"氛围

---

## G. 实现优先级

建议按以下顺序实现（每步可独立验证）：

1. **创建 `purification-hud.ts`**：新的 DOM HUD 面板 + 底部提示条
2. **改造 `purification-scene.ts`**：接入新 HUD，删除旧 `createPurifHud`，添加提示条更新逻辑
3. **改造 `purification-module.ts`**：删除所有 Text，重写视觉状态逻辑，HP 条重新定位
4. **统一交互点绘制**：提取 `drawInteractionPoint` 函数，统一三个交互点的绘制
5. **验证**：确认所有信息可读、无裁切、氛围符合预期

---

## H. 设计决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 世界内零文字 | 采纳 | pixelArt:true 下 Phaser.Text 必然模糊/锯齿；文字是 UI 层的职责 |
| HP 条仅靠近时显示 | 采纳 | 减少信息噪音；受损时始终显示保留紧迫感 |
| 底部统一提示条 | 采纳 | 参考 Darkwood/Signalis 的成熟方案，解决多交互点的提示统一问题 |
| 模块不显示名字 | 采纳 | 只有两个模块，颜色+形状已足够区分；详细信息在提示条第二行 |
| HUD 用面板而非散列行 | 采纳 | art-direction 6.2 的面板规则：border + 分割线分区 |
| Toast 居中而非偏移 | 不完全采纳 | 重要通知居中，临时通知在顶部以免遮挡游戏画面 |
