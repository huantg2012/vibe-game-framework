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

**现状（2026-08-19，DEC-062）：** C3+C4 已接。C5 已接（地表读 CSV、抽锚生成、天空 64×42 叠层循环）；人试玩 ok。下文 C3+C4 Brief 里「本批不做 C5 / C5 未做 / 不改写死 `frag-outdoor`」只描述 2026-08-18 接线批，**不要当现在的任务书再执行一遍。** Slice 仍 ACTIVE。仍待：规格 21 软目标、尘点沿风、污染年龄×残破度。

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
- [x] 十锚配方栈（`structure-grammars` + `cover` + 氛围场 + 桩）；画廊 `spatial-drafts/index.html`
- [x] DEC-058 反迷宫落地：方向 1 厚短残块 + 正交 B；形状闸门替换 `sight≤14`
- [x] 密度中等空地：五案对照已出（`spatial-drafts/probes/`）；人授权结合后写入预览栈（DEC-060）；**密度人锁（DEC-061）**
- [x] **不**布出生/撤离；**不**改 RiftScene；**不**改地表着色

**C5** 氛围参数进 `procedural-surface`（及墙/虚空），读策划数据，不手写第二套色表。
- [x] 虚空格填 `void-black` / `deep-black`，禁止把 L1 地板铺出岛外
- [x] 旋钮读 `RIFT_FRAGMENT_DATA`（含未启用行）；每次出击 `textures.remove` 后重烤
- [x] 渍色走 `stainKey` 已锁名；划痕角度 `free` / `orthogonal` / `longitudinal`
- [x] 裂隙每次抽锚 + 新种子 + 邻域抖动再生成并烤图（画廊是样例，不是搬进去的十张图）
- [x] 同一份氛围场只改 phase：雾烤死，天空胶囊在裂隙里循环
- [ ] 污染年龄 / 残破度组合轴
- [ ] 尘点沿风位移

每批独立可看、独立过 `typecheck`。禁止 ALL 打成一批。

---

## Task: C3+C4 | assignee: code

Title: 布点 + 接到裂隙场景 | Priority: P0 | Dispatch: 🔴（人已发起 /director，本会话执行）

Depends: C2 密度人锁（DEC-061）

**本批范围：只做 C3 + C4。不做 C5。不标 Slice COMPLETE。不 commit / push。**

### 目标

`generateRiftLayout(seed)` 交出完整 `GeneratedRiftLayout`；`RiftScene` 吃它。手写图留对照夹具。同一次出击不重跑；下一次踏入新种子。阵亡/撤离按 R 都回净化点。

### 先读（按序）

1. `CLAUDE.md`
2. `docs/design-notes/slice-6-layered-generation.md`（活策略；扩空间读「Agent 入口」）
3. `docs/specs/system-map-generation.md` 的 P / G / C 节（规则 1–8、17–23）+ 数据契约 `GeneratedRiftLayout`
4. `docs/progress/current-slice.md`、本 Brief、DEC-056 / DEC-058 / DEC-060 / DEC-061
5. `.cursor/rules/map-generation-connectivity.mdc`
6. `src/scenes/rift-scene.ts`、`src/scenes/rift-map-data.ts`、`src/systems/run-controller.ts`
7. `src/systems/tool-system.ts` 里 `RIFT_MAP`（约 import + `applyAbyss`）
8. `src/types/map-types.ts`、`src/generation/draft-pipeline.ts`、`src/generation/recipes.ts`、`src/generation/types.ts`、`src/generation/connectivity.ts`
9. 若动到撤离提示文案或小地图**样式/标记形状**：先 Read `.cursor/skills/in-game-ux/SKILL.md` 再改。只换坐标、不改皮 → 不必走 skill。

### C3 — `generateRiftLayout(seed)`

- 岛 = 现成 `generateRecipeDraft`：用种子抽十锚之一（`PREVIEW_RECIPES`），再 `generateRecipeDraft(seed, recipe)`。活路径是配方栈。**禁止**把 `masses.ts` 围院语言接进生产布局。
- 同一种子必须得到同一张图（配方选择 + 布点都确定性）。
- 布点：
  - 出生与撤离分列陆地两端（规格 17）。撤离是继续前进抵达，不是原路折返。
  - 恰好一个撤离。走近按 E，触发半径沿用现常量。**禁止**钉手写图那个 `X`（现图约第 3 行居中；世界坐标即 `RIFT_MAP.layout.extractionPoint.position`）。滚到该点则丢弃重抽。
  - 薪柴 safe 3 / contested 3 / deep 2。分档原则读 `system-chaos-scavenge-extract` 规则 20（离撤离路程 × 巡逻覆盖）。坐标由生成器给。
  - 污染物数量沿用现图：**3**。可走，从出生可达。
  - 巡逻 **3–4**。路点可走、从出生可达。撤离格不在任何巡逻的常驻视野内（`AI.SIGHT_RANGE` 180px）。通往撤离的最后一段由 **1** 个巡逻覆盖。
  - 出生格四连通 flood-fill 必须到撤离格。薪柴 / 污染物 / 每个巡逻路点必须可走且从出生可达。
- **规格 21 双路径是软目标**：本批先保证空间能撑、可达、两端分列。机器闸门不要把「两条不相交主干」做成 FATAL。做得到就做；做不到在交回里写缺口，不要为双路径加细墙/改形状闸门。
- 地标可空或少量地板贴花；不是墙。装饰不得拆连通。
- 重试：先就地挪点 / 挖通，再换种子重试。**留在配方栈**。禁止失败换另一套生成算法。重试有上限；到顶开发期**抛错**（大声失败），不要静默交出坏图，不要静默回退手写图。
- 在 `src/generation/` 落地（建议 `rift-layout.ts` + `types.ts` 补 `GeneratedRiftLayout`）。从 `src/generation/index.ts` 导出 `generateRiftLayout`。

### C4 — 接到裂隙

- `RiftScene.create` 吃本次 `GeneratedRiftLayout`（tileMap + TileGrid + spawn/extract/kindling/contaminants/patrols/landmarks）。禁止再 `const { tileMap, grid, layout } = RIFT_MAP` 当运行时真相。
- 手写图 `rift-map-data.ts` **留着**当对照夹具 / `validateRiftMap()`。正式踏入走生成器。
- 种子：每一次从净化点踏入（含 dev `#rift` 直进）抽新种子；同一次出击（场景未销毁）不重跑。不要把种子写进 URL 当产品功能。
- 解开 `tool-system.ts` 对 `RIFT_MAP.layout.kindlingNodes` 的直读。从 `create()` options 注入本次薪柴坐标。
- `RunController.restart()`：阵亡与撤离成功都回净化点（DEC-056）。删掉阵亡分支的原地 `resetAll()` 再打这一次。
- 开发期生成失败要大声失败（throw / DEV `console.error` + 不要用固定图顶上）。
- 不新开 HUD。提示仍是「[E] 撤离」。小地图继续标一个撤离点，标记形状不新造。
- 不接净化点替换。不发明新色。本批不改 `procedural-surface.ts` 写死 `frag-outdoor`（C5）。
- 接线后回填 `docs/architecture.md` MapGenerator 行：RiftScene 改吃 `generateRiftLayout`；手写图是夹具。frontmatter `changed-this-slice: true`。规格 frontmatter：`generateRiftLayout(seed)` 已实现；`GeneratedRiftLayout` 交齐。

### 机器闸门

必须全部跑过再交：

1. `npm run typecheck`
2. 扩展 `npm run check:recipes` **或** 新 `npm run check:layout`：若干种子上 `generateRiftLayout` —— 墙后地板四连通分量恰好 1；出生 flood-fill 到撤离；恰好 1 个撤离且不是手写图那个点；薪柴 3/3/2；污染物 3；巡逻 3–4；所有点可走且从出生可达。形状/掩护闸门继续打在配方岛上（现有 `check:recipes` 不要拆掉）。
3. 现有 `check:outline` / `check:ruins` / `check:recipes` 仍绿。
4. 可玩：`npm run dev` 能进裂隙（净化点踏入或 `#rift`），出生在生成格，能走向撤离提示。

连续 **2 次**过不了机器闸门 → **停**，升档报告 Director，附两次失败输出。不要第三次硬扛。

循环预算：布点重试有上限；到顶开发期抛错。到顶未收敛不要无声换算法。

### 禁止

- `sight≤14` / 空矩形 48 当生产循环或 FATAL
- 封闭房间 + 门廊（DEC-005）
- 失败换另一套生成算法碰连通
- 新 HUD / 新撤离标记形状 / 发明新色
- 接净化点替换
- 把 `masses.ts` 围院接进 RiftScene
- 本批做完整 C5（地表参数化）
- commit / push

### 验收标准

- [x] `generateRiftLayout(seed)` 存在且确定性
- [x] 出生能走到唯一撤离；点数符合上表
- [x] RiftScene 运行时不读手写图当真相
- [x] `tool-system` 无 `import { RIFT_MAP }`
- [x] 阵亡按 R 回净化点，不是原地重开
- [x] `typecheck` + layout 闸门绿
- [x] 交回写明：双路径是否做了；C5 未做

### 相关文件

- `src/generation/*`、`src/scenes/rift-scene.ts`、`src/systems/run-controller.ts`、`src/systems/tool-system.ts`
- `docs/architecture.md`、`docs/specs/system-map-generation.md`（frontmatter / 规则 3 实现句）
- `docs/progress/current-slice.md`（勾 C3/C4；不标 COMPLETE）

---

## Task: Q1 | assignee: qa

Title: 对照规格验收 | Priority: P0 | Dispatch: 🟢

Depends: C1–C5

对照 `system-map-generation.md`：连通、一个撤离、外轮廓不规则、障碍最小尺度/情景、两次生成氛围可分、提示仍是按 E。不代勾好看。
