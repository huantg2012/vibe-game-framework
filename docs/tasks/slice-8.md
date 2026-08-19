---
status: ACTIVE
slice: 8
created-by: director agent
created-when: 2026-08-19
---

# Tasks: Slice 8 — 第二敌人

权威：`docs/progress/current-slice.md`。DEC-064。禁止再问人。

---

## Task: D1 | assignee: design

Title: 就地扩写敌人 AI + 被发现脉冲 + enemies.csv 契约 | Priority: P0

先 Read `/Users/yilungao/coh/.cursor/skills/in-game-ux/SKILL.md`（被发现是游戏内界面）。

就地更新 `docs/specs/system-enemy-ai.md`（一种系统一个 spec；加改写体感知剖面，**不要**新开第二份 FSM spec）。被发现脉冲就地写进本 spec 或 `system-chaos-scavenge-extract` / `system-movement-vision` 最少必要段。给出 `data/enemies.csv` 列契约。

锁死可实现数（你拍板写成现行）：
- 改写体视锥半角明显窄于渗透体 55°（建议 28–35°）
- 听觉半径大于渗透体 100，且移动噪声权重更高；停步几乎听不见
- 每图恰好 1 个改写体（生成器布点）
- 脉冲：屏缘、方向、强度=察觉度；无数字条、无血条式察觉条
- I1–I6 不变量对两种敌人都要声明是否仍成立

禁止：向人提问、复制 FSM 当设计、Slice 9、写 `src/`。

---

## Task: A1 | assignee: art

Depends: D1。先 Read in-game-ux skill。改写体 4 向程序化/像素管线规格 + 屏缘脉冲像素规格。无新 hex。不要紫粉史莱姆。

---

## Task: C1 | assignee: code

Depends: D1+A1。`data/enemies.csv` + codegen。AI 类型泛化。每图 1 改写体。脉冲挂 `#dom-ui-root`。`tsc` 必须过。本任务未开。

---

## Task: Q1 | assignee: qa

Depends: C1。写 `docs/qa/report-slice-8.md`。本任务未开。
