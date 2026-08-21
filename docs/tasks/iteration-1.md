---
status: ACTIVE
created-by: director agent
created-when: 2026-08-20
note: 迭代 1（敌人系统）。不要开新 Slice。不要写成 slice-10。DEC-073 / DEC-074 / DEC-075 / DEC-076 / DEC-077。T0–T9 已勾。状态：实现完成，体验未验证。不要标 COMPLETE。
---

# Tasks: 迭代 1 — 敌人系统（污染词法）

权威：`docs/progress/current-iteration.md`。体系入口：设计正文 `docs/design-notes/contamination-lexicon.md` → 规则 `docs/specs/system-contamination-lexicon.md` → 识别表面 `docs/specs/ui-encounter-narration.md`。禁止再问人。人已放权最佳方案并点名实施。

验证问题（人试玩，agent 不代勾 PASS）：四张孔谱是否可读；遭遇识别旁白是否刷 / 是否像头上名字；绕是否仍更便宜。收尾合法态：「实现完成，体验未验证」。不要标迭代 COMPLETE。

硬禁止：为填法复制状态机；装饰/漆/体积拆连通；头上名字、图鉴、OS toast、混乱阈值文学旁白腔；代码手写形态表再反向导出 CSV；把画廊 PNG 当地图；覆盖体第三种人形；声称审美 PASS；改 `.claude/agents` / `.cursor/agents`。

单批上下文预算：每一批必须单次会话可完成、可跑、过机器闸门。禁止一个 code 会话塞 ALL 表面。到顶未完成就拆批再派。

---

## Task: T0 | assignee: design + art

Title: 可实施规格 + 乙/丙/丁外观 HOW | Priority: P0 | Dispatch: 🔴已发起

### 目标

code 不得再猜。CSV 列、字母表、方言、战斗数字、钉层形状、六件套外观全部落盘。

### 具体要求

- [x] design 原地更新 `system-contamination-lexicon.md`（CSV schema、字母表、方言表、数值、钉层接口、事件、非法丢弃、练习场、听觉主轴迁移）
- [x] design 设计正文只指向 spec 数字，避免两处打架
- [x] design 同步 `system-enemy-ai.md` / `system-combat.md` / `system-map-generation.md` 接口影响段
- [x] design 文案碎片键列入 CSV 合同；UI spec 保持表面 HOW
- [x] art 写乙/丙/丁外观 HOW（新 `docs/art/contamination-forms.md` 或扩 `actor-pixels.md`）。丙咬合崩坏簇活层，不另做小人。禁止新色板、禁止精灵表
- [x] art 先 Read `.cursor/skills/in-game-ux/SKILL.md` 后最短核旁白视觉层

规格单独一提交，与实现分开。

---

## Task: T1 | assignee: code

Depends: T0。CSV + codegen + 形态生成器纯函数（抽卡、非法丢弃、自动改写、成句命中）+ 单测。不改出击生成物。闸门：`node tools/csv-codegen/generate.mjs`、现有 test/tsc。完成后提交。

- [x] 五张 `data/contamination-*.csv` + codegen `src/generated/contamination-lexicon-data.ts`
- [x] `src/generation/contamination-draw.ts` + `npm run check:lexicon`
- [x] `GAME_CONSTANTS.CONTAMINATION` 系统常量

---

## Task: T2 | assignee: code（art 核旁白接线）

Depends: T1。甲走词法物化现有两种填法；出生仍用地板路点；`rewriterCount === 1` 迁移为听觉主轴 === 1；遭遇识别旁白接到甲。先 Read in-game-ux skill。`#rift-encounter-log` 进 `panel-styles.ts`。练习场旁白关。U1–U12 机械层自检，不代勾好看。提交。

- [x] 甲：渗透体/改写体 `getForm()` 对照夹具；生成器契约本批仍是 rewriter === 1（听觉主轴随 T3/T4 钉层一起迁）
- [x] `#rift-encounter-log` + `EncounterNarration` 挂 `#dom-ui-root`；练习场不创建
- [x] 事件 `encounter:identified`；同身份 60s / 行间隔 2.5s / 阈值优先作废

---

## Task: T3 | assignee: code

Depends: T2。地图钉层（墙缘折线、簇核、走廊包围盒）从 layout / bakeGround 交出，单测墙后可走格四连通分量仍为 1。钉失败：本图少生该只并打日志，禁止用占地小人顶替。提交。

- [x] `GeneratedRiftLayout.contaminationPins` + `check:layout`

---

## Task: T4 | assignee: code + art HOW

Depends: T3。乙 缝核实体 + 邻格抽打 + 不穿开阔地 + 外观按 contamination-forms。配额乙或丁先实现乙路径。不占走廊碰撞。提交。

- [x] `ContaminationHostSystem` 乙路径

---

## Task: T5 | assignee: code

Depends: T3。丙 绑最显眼簇 + 踩踏混乱 + 胀满加价 + 打核；外观=已有活层，不另做小人。无簇则丙配额 0。提交。

- [x] 丙踩踏 + 打核（钉层格心近似簇核）

---

## Task: T6 | assignee: code + art HOW

Depends: T3。丁 体积 + 反视/领域 + 场内混乱/缩视野 + 低于 `DEPTH.visionMask`。乙或丁的「或」按抽卡。提交。

- [x] 丁体积 depth 40 + 反视亮核

---

## Task: T7 | assignee: code

Depends: T4+T5+T6。练习场敌人课复用新实体；旁白仍默认关。`docs/dev/gym.md` 更新。提交。

- [x] 敌人课仍用出击 `Enemy`（含形态）；旁白不开；地图课不刷宿主

---

## Task: T8 | assignee: qa

Depends: T7。对照 spec 机械比对（含 U1–U12 结构，不代勾好看）。出 `docs/qa/` 短报告。连通、无第二 FSM、无头上名字、CSV 方向。

- [x] `docs/qa/iteration-1-lexicon.md`

---

## Task: T9 | assignee: director

Depends: T8。`current-iteration.md` 改为「实现完成，体验未验证」；gdd / architecture 模块登记；CLAUDE.md / AGENTS.md 层 B 句；roadmap 指向迭代而非 Slice 10；`interface-changed` 该复位的复位。不要标迭代 COMPLETE。

- [x] 状态改为实现完成、体验未验证。不标 COMPLETE
