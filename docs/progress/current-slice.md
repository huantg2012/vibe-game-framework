---
status: ACTIVE
created-by: director agent
created-when: 2026-08-07
last-modified: 2026-08-07
note: Slice 2 启动。净化点闭环。
---

# Slice 2: 净化点闭环 【ACTIVE — 2026-08-07 启动】

类型：系统
日期：2026-08-07 启动
验证问题：**净化点环**（撤离→薪柴分配到分区模块→冲击结算→模块受损影响下次出击）是否形成"出击表现→冲击后果→出击条件变化"的连环压力？资源分配的纠结感是否成立？

> 范围已锁定（2026-08-07）。四项取舍由人拍板：① 完整步行空间（含粒子氛围+apparition+模块交互）；② session-only 内存状态；③ 每次出击后触发冲击（N=1）；④ 模块 0 HP 不设 game-over，效果移除使下次出击更难。任务 Brief 见 `docs/tasks/slice-2.md`。

---

## 范围推导

Slice 1 验证了裂隙出击环的核心手感（moment-to-moment 博弈）。Slice 2 补上元循环的另一半——净化点环，验证 session-level 的资源分配压力是否成立（体验支柱 1「绝望边缘的紧绷」+ 支柱 3「孤独的仪式感」）。

完整循环从 Slice 2 开始可以跑通：
```
Menu → 净化点 → 裂隙出击 → 撤离 → 净化点 → 分配薪柴 → 冲击结算 → 模块受损
  → 下次出击条件变化 → 裂隙出击 → ...
```

### 锁定的 Slice 2 最小范围

1. GameState 管理器（session-only 内存状态，跨场景持久）
2. 场景流转（RiftScene ↔ PurificationScene 双向切换）
3. 净化点步行空间（~12x10 手设计 tilemap、Player 复用、VisibilitySystem 复用）
4. 边界氛围系统（粒子 + apparition + intensity 耦合）
5. 模块实体 + 交互触发系统（2 个模块 + 裂隙入口，接近按 E 交互）
6. 分配面板（DOM overlay，薪柴分配 + 修复）
7. 冲击系统（威力分布 + 防御结算 + 模块伤害 + 强度递增）
8. 模块效果反馈（BARRIER→chaos rate modifier；STORAGE→kindling pickup modifier）

### 暂不纳入

- 持久存档（LocalStorage save/load）→ 后续基础设施 Slice
- Game-over 条件 → 后续 Slice
- 净化点视觉状态变化（模块正式美术 + 受损动画）→ 后续美术 Slice
- 第三个模块 → Nice-to-have
- 音效 → 后续 Slice

---

## 设计取舍（已由人拍板，2026-08-07）

| # | 决策点 | 人的决定 | 说明 |
| - | ------ | -------- | ---- |
| 1 | 净化点呈现方式 | **完整步行空间**（粒子氛围 + apparition + 模块交互） | 验证支柱 3「仪式感」 |
| 2 | 状态持久化 | **Session-only 内存状态** | 验证问题不涉及跨 session |
| 3 | 冲击频率 | **每次出击后触发（N=1）** | 快速迭代验证 |
| 4 | 模块 0 HP | **不设 game-over，效果移除使下次更难** | 聚焦"压力链" |

---

## 任务进度

> 派发列：🟢 Director 可直接派发 / 🔴 人主导。详细 Brief 见 `docs/tasks/slice-2.md`。

| ID | 任务 | Agent | 派发 | 状态 | 依赖 | 备注 |
| -- | ---- | ----- | ---- | ---- | ---- | ---- |
| T1 | 设计 spec：净化点 + 冲击系统 | design | 🔴 | Done | - | 产出 `docs/specs/system-purification-impact.md` |
| T2 | 实现：GameState 管理器（session-only） | code | 🔴 | Done | T1 | `src/managers/game-state.ts` |
| T3 | 实现：场景流转（裂隙↔净化点切换） | code | 🔴 | Done | T1, T2 | 修改 rift-scene + purification-scene + main-menu |
| T4 | 实现：净化点步行空间 | code | 🔴 | Done | T1, T3 | 内嵌于 purification-scene.ts（椭圆形 14x12） |
| T5 | 实现：边界氛围系统 | code | 🔴 | Done | T4 | `src/systems/boundary-atmosphere.ts` |
| T6 | 实现：模块实体 + 交互触发 | code | 🔴 | Done | T4, T2 | `src/entities/purification-module.ts`（交互内嵌） |
| T7 | 实现：薪柴分配面板（DOM） | code | 🔴 | Done | T6, T2 | `src/ui/dom/allocation-panel.ts` |
| T8 | 实现：冲击系统 + 结果面板 | code | 🔴 | Done | T7, T2 | `src/systems/impact-system.ts` + `src/ui/dom/impact-result-panel.ts` |
| T9 | 实现：模块效果→出击参数 | code | 🔴 | Done | T8, T3 | 修改 chaos-system + loot-system |
| T10 | QA 验收 | qa | 🟢 | Active | T9 | `docs/qa/slice-2-report.md` |

---

## 设计产出（本 Slice 新增/修改的文档）

- [ ] docs/specs/system-purification-impact.md（净化点 + 冲击 + 分配 + 模块效果）
- [ ] docs/tasks/slice-2.md（Director 已拆解）

---

## QA 验收结果（2026-08-07）

**结论：CONDITIONAL PASS** — 1 blocking issue, 2 moderate deviations. 详见 `docs/qa/slice-2-report.md`。

**Blocking**：MainMenuScene "New Expedition" 仍跳转 RiftScene 而非 PurificationScene，且未调用 gameState.reset()。

**下一步**：
1. 修复 B1（code agent，5 分钟）
2. 修复后人试玩验证（回答验证问题）
3. D1/D2 视觉演出偏差可推迟到打磨 Slice
