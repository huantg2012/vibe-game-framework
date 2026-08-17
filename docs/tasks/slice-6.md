---
status: ACTIVE
slice: 6
created-by: director agent
created-when: 2026-08-16
---

# Tasks: Slice 6 — 程序化地图

Slice 类型：系统
验证问题：连续两次踏入裂隙，布局和撤离位置都不同；可走区外轮廓不规则；障碍有情景；氛围能分清是另一块碎片。不验证多出口选择。

权威范围与三条约束：`docs/progress/current-slice.md`。

---

## Task: D1 | assignee: design

Title: 新建地图生成规格（三条约束各给多条路） | Priority: P0 | Dispatch: 🔴

### 目标

写出 `docs/specs/system-map-generation.md` 第一轮。人能靠它拍板，code 还不能把它当「算法已锁死」来实现。

### 上下文

系统 Slice 第一步。人要求自行准备知识/审美/参考；每个问题多解，禁止一棵树吊死。相交矩形并集只是外轮廓的参考之一。

### 具体要求

- [ ] 先读 `CLAUDE.md`、`docs/vision.md`、`docs/world.md`、`docs/art-direction.md` §2 / §4.2、`docs/architecture.md` DEC-ARCH-003、DEC-005、`docs/progress/current-slice.md`、`src/scenes/rift-map-data.ts` 头注释、`src/systems/procedural-surface.ts` 头注释
- [ ] 调研至少 3 个具名参考（外轮廓 / 可读废墟 / 碎片氛围各至少能点名），写清学什么、不学什么
- [ ] 约束 1 / 2 / 3 各给 **至少 3 条**可实现路径 + 后果 + 和世界观/已有地表管线的冲突
- [ ] 标「已锁定」（只抄 current-slice 里人已拍的）和「待确认」（算法方向、本 Slice 几种氛围、「按 R」）
- [ ] 输出数据契约草案：tile 网格 + 可走掩膜 + 出生/撤离/薪柴/巡逻/地标；矩形缓冲 + 不规则可走区如何表达
- [ ] 消费现有布局约束：主干 40–60 秒、从出生能走到撤离、一个撤离点且不钉死旧格子
- [ ] 碎片类型若有策划字段：声明走 `data/*.csv`，禁止代码手写主题表
- [ ] 本批 **不**写撤离多样性。旧撤离规格本批不改，除非你判断「位置从哪来」不写进旧文件就会改坏——若要改，停下来列进 D2，本文件只点名
- [ ] 本批不写 `src/**`

### 约束

- 你是引导者不是决定者：禁止「推荐 A + 当作已定的完整方案」
- 不退回 BSP 方正房间
- 不引入未论证新色
- 对人少用黑话；规格正文用规则句

### 验收标准

- 文件存在，frontmatter 合规，首行 TL;DR
- 三条约束都有多条路，没有「唯一算法已定」
- 待确认列表短、能直接问人

### 相关文件

- `docs/specs/_template-system.md`
- `docs/progress/current-slice.md`
- `docs/architecture.md`（MapGenerator 行）

---

## Task: D2 | assignee: design

Title: 撤离规格最少补句（仅必要时） | Priority: P1 | Dispatch: 🔴

Depends: D1 + 人过 D1

### 目标

若 D1 证明「撤离点坐标改由生成器提供」必须写进 `system-chaos-scavenge-extract.md`，就地加最少句子。不做多样性。

### 具体要求

- [ ] 先判断要不要改。不要 = 本任务关闭并写一句理由
- [ ] 要 = 只改「位置来源 + 仍是一个点、走近按 E」；`interface-changed` 仅在接口真变时为 true
- [ ] 不写多出口、条件口、捷径

---

## Task: A1 | assignee: art

Title: 本 Slice 氛围种类的视觉规格 | Priority: P0 | Dispatch: 🔴

Depends: 人锁「做哪几种碎片氛围」

### 目标

每种锁定的碎片：地表 / 墙 / 虚空 / 污染渗法，沿用 art-direction L1+L2，不发明新皮。

### 具体要求

- [x] 先 Read `.cursor/skills/in-game-ux/SKILL.md` 仅当触及 HUD/标记；世界层地表以 art-direction 为准（本批未写 overlay，未走该 skill）
- [x] 对照已锁 L1 五套记忆色，只为**人点名要做的几种**写参数（噪声、材质残影、墙的可读物）
- [x] 写进 Kit 或 `docs/art/` 短规格，并回写 art-direction 若实现会偏（`docs/art/rift-fragment-surfaces.md`；§4.2 / §14.3 各一句）
- [x] 不改 `src/**`

---

## Task: C1–C5 | assignee: code

Title: 实现批次（规格通过后才开） | Priority: P0 | Dispatch: 🔴

Depends: D1 人过 +（若需要）A1

**C1** 可走掩膜：不规则外轮廓 + 矩形缓冲里的虚空。能看图、能丢掉坏图。不布内容。
- [x] `src/generation/outline-mask.ts`：生长+腐蚀+最大连通块
- [x] 坏图丢弃（填满缓冲 / 啃边矩形 / 贴框）
- [x] `TileType.VOID`；`TileGrid` 虚空不可走、不挡视线
- [x] 预览 `docs/art/demos/slice-6-outline/c1-*.png`；闸门 `npm run check:outline`
- [x] **不**布墙、出生、撤离；**不**改 RiftScene 读固定图

**C2** 情景障碍：按锁定策略生成可读特征，不是胡椒粒。
- [x] `data/rift-fragments.csv` → `src/generated/rift-fragment-data.ts`
- [x] `src/generation/ruins.ts` + `masses.ts`：多坨小体量切开空地；身份走 CSV 维度；围死的地会挖开
- [x] 墙只落在陆地上；剩下的地仍连通；胡椒粒墙丢掉
- [x] 预览 `docs/art/demos/slice-6-outline/c2-*.png`；闸门 `npm run check:ruins`
- [x] **不**布出生/撤离；**不**改 RiftScene；**不**改地表着色

**C3** 布点：出生 / 一个撤离 / 薪柴 / 污染物 / 巡逻；出生能走到撤离；撤离不钉旧格子。  
**C4** 裂隙场景改吃生成结果；固定图可留对照夹具；解开 `tool-system.ts` 对固定图薪柴坐标的直读。  
**C5** 氛围参数进 `procedural-surface`（及墙/虚空），读策划数据，不手写第二套色表。

每批独立可看、独立过 `typecheck`。禁止 ALL 打成一批。

---

## Task: Q1 | assignee: qa

Title: 对照规格验收 | Priority: P0 | Dispatch: 🟢

Depends: C1–C5

对照 `system-map-generation.md`：连通、一个撤离、外轮廓不规则、障碍最小尺度/情景、两次生成氛围可分、提示仍是按 E。不代勾好看。
