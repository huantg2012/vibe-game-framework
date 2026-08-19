---
status: COMPLETE
slice: 7
created-by: director agent
created-when: 2026-08-19
last-modified: 2026-08-19
---

# Tasks: Slice 7 — 净化点扩张

Slice 类型：系统
验证问题：净化器完整度是否压低出击起始混乱；祭坛旁花薪柴是否全局抬全部模块 maxHp（3 档 +15）。
权威范围：`docs/progress/current-slice.md`。范围锁死 DEC-064。禁止再问人。

---

## Task: D1 | assignee: design

Title: 就地扩写净化点规格（净化器 + maxHp 三档） | Priority: P0 | Dispatch: 🔴 | Status: 已交

### 目标

把 DEC-064 写成现行规则。不新开 spec。

### 必须改

1. `docs/specs/system-purification-impact.md`：第三模块 = 净化器；完整度 → 出击起始混乱（满血约从 0；残血带入部分混乱）；不改起始生命。祭坛旁花薪柴全局抬全部模块 maxHp，3 档 +15（100→115→130→145）。给出可实现公式与数值表。`abyss` 65% / `stitch` 复核句。`last-modified-date: 2026-08-19`。`interface-changed` 仅当对外接口真变（第三模块类型与起始混乱查询大概率要变 → 更新 `exposes`）。
2. `docs/specs/system-chaos-scavenge-extract.md`：最少补「出击起始混乱由净化器完整度写入」一句。不要重写混乱曲线。
3. 若触及游戏内界面结构：先 Read `/Users/yilungao/coh/.cursor/skills/in-game-ux/SKILL.md`。载体 = 世界内装置。2–3 个具名参考。表名/数值/档位分开。不新开 ui spec 文件，就地扩写净化点规格的 UI 段。

### 禁止

- 向人提问、改范围、新 hex、做 Slice 8/9/10、写 `src/`、改框架

### 验收

- 现行规则可被 code 实现；满血约从 0 有数字；三档费用写清
- 交回：改了哪些文件、公式原文、`interface-changed` 是否变动

---

## Task: A1 | assignee: art

Title: 第三模块形体 + 祭坛升级交互最短合规核对 | Priority: P0

Depends: D1 | Status: 已交

先 Read `/Users/yilungao/coh/.cursor/skills/in-game-ux/SKILL.md`。就地补视觉规格（净化器几何/色只引用已锁板；祭坛升级读数不是新墙机皮）。无新 HUD 根。不要重做概念图。

---

## Task: C1 | assignee: code

Title: 净化器 + 起始混乱 + maxHp 三档 + 复核 abyss/stitch | Priority: P0

Depends: D1 + A1 | Status: 已交

生产质量。CSV→code。跑 `npx tsc --noEmit`。连续 2 次闸门失败停止。禁止 Slice 8/9 代码。

---

## Task: Q1 | assignee: qa

Title: 对照更新后规格验收 | Priority: P0

Depends: C1 | Status: 已交

写 `docs/qa/report-slice-7.md`。PASS。
