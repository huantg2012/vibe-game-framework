# 设计笔记：模块效果信息展示 + 裂隙 HUD 薪柴增强

## 问题

玩家无法感知 BARRIER/STORAGE 模块 hp 带来的具体增益。分配面板只显示 hp 数字，裂隙 HUD 只显示薪柴总数——没有任何信息帮助玩家理解"修这个模块值不值"或"我的拾取正在被加成"。

---

## 设计 A：分配面板效果预览

### 设计目标

服务于决策：玩家在面板中需要快速判断"修这个模块能得到什么"以及"修多少才有意义"。

### 方案：当前效果 + 修复后效果的对比行

在现有 HP 行和分配控件之间，插入一个"效果区块"：

```
BARRIER (Chaos Reduction)
HP: 60 / 100
────────────────────────
当前效果: 混乱增速 -18%
修复后:   混乱增速 -24%  (+6%)
────────────────────────
Available Kindling: 5
1 kindling = 10 HP
[- 2 +]  (+20 HP)
[Confirm] [Cancel]
```

```
STORAGE (Kindling Bonus)
HP: 40 / 100
────────────────────────
当前效果: 拾取价值 x1.20
修复后:   拾取价值 x1.35  (+0.15)
────────────────────────
Available Kindling: 5
1 kindling = 10 HP
[- 3 +]  (+30 HP)
[Confirm] [Cancel]
```

### 规则

- BARRIER 效果文案：`混乱增速 -${Math.round(hp/100 * MAX_BARRIER_REDUCTION * 100)}%`
- STORAGE 效果文案：`拾取价值 x${(1 + hp/100 * MAX_STORAGE_BONUS).toFixed(2)}`
- "修复后"行根据当前 `selectedAmount` 实时更新（hp + selectedAmount * REPAIR_PER_KINDLING, clamped to maxHp）
- 差值部分 `(+N%)` / `(+0.xx)` 用绿色 `#66cc88` 标注（有增益时才显示）
- selectedAmount = 0 时，"修复后"行隐藏（只显示"当前效果"）
- 模块 hp 已满时，效果区显示"已满效果"且分配控件 disabled

### 视觉规格

- 效果区块用 1px `#333` 水平线与上下内容隔开（符合 art-direction 6.4 的分区规则）
- 当前效果颜色：BARRIER 用 `#4488cc`，STORAGE 用 `#cc8844`（与 typeColor 一致）
- 修复后效果颜色：比当前效果略亮（同色相，亮度 +20%）
- 字号 11px，与现有 "1 kindling = 10 HP" 行一致

---

## 设计 B：裂隙 HUD 薪柴增强标识

### 设计目标

让玩家在裂隙中感知到 STORAGE 加成的存在，但不干扰潜行沉浸感。信息层级：知道加成在生效 > 知道具体倍率 > 知道每次拾取的基础/加成拆分。

### 方案：静态倍率标注 + 拾取闪现

#### 倍率标注（常驻）

当 `kindlingValueModifier > 1.0` 时，在薪柴数字下方显示一行小字倍率：

```
        3      ← 已有的薪柴总数（warm-dim #c89040，12px）
      x1.4     ← 新增倍率标注（#cc8844 即 STORAGE 色，9px）
```

- 位置：右上角，薪柴数字正下方，右对齐
- 字号 9px，颜色 `#cc8844`（STORAGE 的语义色，比薪柴数字更暗更小）
- 当 modifier = 1.0 时不显示（无加成时不占空间）
- 格式：`x${modifier.toFixed(1)}`（如 x1.2, x1.5）

#### 拾取闪现（事件驱动）

每次拾取薪柴时，在薪柴数字旁边短暂显示获得量：

```
        5  +3    ← "+3" 在拾取瞬间出现，0.8s 后淡出
      x1.4
```

- 闪现文字 `+${amount}`，颜色 `#c89040`（warm-dim），12px
- 出现时 alpha=1，经过 800ms 线性淡出到 0 后销毁
- 位置：薪柴数字左侧 4px 处，同一基线
- 如果连续快速拾取（<400ms 间隔），新的 +N 替换旧的（不堆叠）

### 为什么不显示基础值/加成拆分

考虑过 `+2(+1)` 的格式（表示"基础2，加成1"），但：
1. 需要事件 payload 增加 `baseValue` 字段
2. 信息密度过高，潜行中玩家没有余裕解读
3. 倍率标注已经传达了"你在被加成"，具体拆分是计算器行为不是体验

玩家的认知路径应该是：看到 x1.4 → 知道有加成 → 看到 +3 → 知道这次拿了 3 → 如果好奇具体怎么算的，回净化点看面板。

---

## 实现要点（给 code agent）

### 分配面板改动 (`src/ui/dom/allocation-panel.ts`)

1. 在 `render()` 函数的 HP 行和 Available Kindling 行之间插入效果区块
2. 新增 `computeEffectText(type, hp)` 辅助函数：
   - BARRIER: 返回 `混乱增速 -${Math.round(hp/100 * P.MAX_BARRIER_REDUCTION * 100)}%`
   - STORAGE: 返回 `拾取价值 x${(1 + hp/100 * P.MAX_STORAGE_BONUS).toFixed(2)}`
3. "修复后" hp = `Math.min(mod.hp + selectedAmount * repairPer, maxHp)`
4. 差值 = 修复后效果值 - 当前效果值，>0 时绿色显示
5. `selectedAmount === 0` 时隐藏"修复后"整行（仅显示当前效果）

### HUD 改动 (`src/ui/hud.ts`)

1. 新增 `modifierText: Phaser.GameObjects.Text` 成员，位于 kindlingText 下方
2. `create()` 时从 scene data 读取 `kindlingValueModifier`（已通过 SortieModifiers 传入）
3. 若 modifier > 1.0，创建 modifierText 显示 `x${mod.toFixed(1)}`；否则不创建
4. 新增 `pickupFlash: Phaser.GameObjects.Text` 成员
5. 修改 `onKindlingCollected` 回调：除了更新 total 外，触发 pickupFlash 显示 `+${amount}`
6. pickupFlash 用 scene tween（alpha 1->0, duration 800ms, onComplete destroy/hide）
7. 连续拾取时先 kill 旧 tween 再启新的

### 事件接口

无需修改。`KINDLING_COLLECTED` 的 `amount` 字段已经是加成后的值，HUD 直接用即可。`kindlingValueModifier` 通过 scene settings data 已传入 RiftScene。

### 性能注意

- modifierText 是静态的，create 时设一次即可
- pickupFlash 是事件驱动的 tween，不在 update loop 中
- 分配面板的效果行在 rerender 中随 selectedAmount 一起重建（已有模式）
