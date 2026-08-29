---
status: COMPLETE
created-by: director agent
created-when: 2026-08-28
last-modified: 2026-08-28
note: 迭代 8（占漆压力与识别面）**COMPLETE（2026-08-28，人终审 PASS）**。试玩四问全过：地面像不像裂隙 / 占漆够不够压 / 低语像不像人话 / 核读不读得出可以杀。DEC-102 / DEC-103 / DEC-104。不塞进迭代 7。活指针仍在迭代 5。不要开 I5-C。不要标迭代 5 COMPLETE。迭代 7 已于同日另标 COMPLETE。三种生物仍练习场。
---

# Tasks: 迭代 8 — 占漆压力与识别面（DEC-104 修订）

权威：`docs/progress/current-iteration.md`。设计正文：`docs/design-notes/contamination-lexicon.md`。规则：`docs/specs/system-contamination-lexicon.md`。识别表面：`docs/specs/ui-encounter-narration.md`。地表 HOW：`docs/art/rift-fragment-surfaces.md`（**I8-R 已改口**：氛围簇不再是生产主签名）。占漆外形仍是迭代 7（合同 `docs/tasks/iteration-7.md`；油膜三变体已上线；**COMPLETE（2026-08-28，人终审 PASS）**。占墙 / 占空 deferred）。

**对人说话：** 用「占漆压力与识别面」。对照（只此一次）：占漆 = 旧标签丙。禁止用孔谱字母当主语。禁止把本包说成迭代 7 的收口。

**派发：** 人 2026-08-28 11:1x 三个答复方向比 I8-D 更大。Director 本轮只登记与重划，不 spawn、不 commit。**design 必须先把「移除后世界是什么样」写清，code 再动 `preview-paint.ts` / `bakeGround`。** 配额数字未由 design 锁死前禁止 code 发明。文案走 CSV→code。旁白触碰 UI：派发必须写明先 Read `.cursor/skills/in-game-ux/SKILL.md`，再过 `docs/specs/_template-ui.md` 的 U1–U12。

**收尾合法态：** 裂隙地面不再铺不收钱的氛围簇；看得见的漆都是有主的漆；占漆每图至少 3 只且污染度跨度可感；识别行读成文学性隐晦提示，不是内部术语、也不是精确分类标签。**人已点头。COMPLETE（2026-08-28，人终审 PASS）。**

迭代 7 已于同日另标 COMPLETE，本包不代勾其占墙 / 占空。不要开占墙 / 占空像素。不要开 I5-C。三种生物仍练习场。

---

# 工作单元（DEC-102 / DEC-103 立项；DEC-104 修订范围）

**另开迭代 8。** 人的模块名：**占漆压力与识别面**。不塞进迭代 7。不许只记在会话里。

DEC-104 把本包从「在保留氛围簇的前提下加量 / 换词 / 分相」改成四件：

| 线 | 人原话要点 | 本包要锁的 | 不做什么 |
| -- | ---------- | ---------- | -------- |
| a 移除氛围簇 | 彻底移除氛围簇，给占漆加码 | `bakeGround` 地面污染层下线（地图课 / 出击 / 句法课对应面）；活层技术保留、转成占漆宿主呼吸 | 不把氛围簇改成也收钱；不用矩形平涂填空；不改连通；不改净化点加厚三档 |
| b 配额 | 3 只起，不同污染度的地图数量跨度大一点 | 每图 ≥3；按本图污染度拉开；钉点不再默认钉簇核 | 不砍巡逻甲；不把占漆画到墙上；不落地 I8-D 的 0/1/2/3 |
| c 旁白 | 不是对敌人的精确定位，要文学性一点，隐晦给出面对此类敌人要注意什么 | 通审上屏文案；骨架是否还适用由 design 重提 | 不落地会走/在缝/贴地/在路；不加头上名字；不上屏止损词 |
| d 视觉重估 | 移除氛围簇后这里的设计是不是会有变化 | 没有氛围簇的地面长什么样；占漆成为唯一的漆之后怎么验收；菌落核还要不要强化 | 不重开油膜三变体身份；不把「地面太干净」用新色板糊过去 |

性质：句法规则 + 识别表面 + 地表生产签名下线。轻量路径收尾四项仍适用。

---

# 已交部分：哪些被转向覆盖

| 批次 | 原状态 | DEC-104 之后 |
| ---- | ------ | ------------ |
| **I8-A** | 合同写了、**未交**（待派） | **原 brief 作废。** 对比「整图氛围簇 vs 钉簇油膜」已无对象。新视觉工作走 **I8-A2**（核 I8-R 写清的移除后地面 / 唯一漆读法） |
| **I8-D** | **已交** 2026-08-28 | **数字与短名被转向覆盖，禁止落地。** 覆盖：① 配额 C=0→0 / C=1→1 / C=2–7→2 / C≥8→3（绑 `ClusterOrganism` 只数）；② 占位会走/在缝/贴地/在路及配套感知/成句/基体短名表；③ 踩前候 1（与氛围活层分相）。**仍可参考、不当合同：** 同图一份 form 复制、同身份 60s 互踩是特性、不砍甲、骨架与「识别。」曾锁不动——后两条由 I8-R 重提。I8-D 已写入设计正文 §4.3 / §7 / §8、句法 spec 规则 16、`ui-encounter-narration.md` 的目标合同，**I8-R 必须原地改口**，禁止留着旧阶梯当现行 |
| **I8-Q / I8-N / I8-V** | 未开 | 按新 brief 重开。I8-V 候 1 永久跳过；候 2 已由 I8-A2 判定开（核读不成打击点，最小强化 = 可见性接线） |

---

# 人 2026-08-28 两条时间线

**10:55（DEC-102 / DEC-103，已被 DEC-104 改写落地口径）：** 氛围不收；配额 0–1 过少授权加量；旁白太内部术语、当时写骨架不动。

**11:1x（DEC-104）：** 彻底移除氛围簇；占漆 3 只起、污染度跨度拉开；旁白文学性隐晦提示，否决精确分类。踩前可分被根治。

09:39 缺口 1（站着不动不叠加）仍挂起，本包不答。

---

# 红线

- 不塞进迭代 7。不标迭代 5 / 7 COMPLETE。迭代 8 已 COMPLETE（2026-08-28）。不开 I5-C。三种生物仍练习场。
- **code 不得在 I8-R 写清「移除后世界」之前改 `preview-paint.ts` / `bakeGround` / `cluster-pulse` 生产路径。**
- 不重开油膜三变体身份（DEC-101）。不把三变体写成 CSV 行。
- 不落地 I8-D 配额阶梯、不落地会走/在缝/贴地/在路。
- 配额数字未锁死前禁止 code 发明。禁止为凑配额改巡逻人数。禁止把占漆画到墙上。
- 同图污染方言统一仍成立（禁止一图动物园）。
- 文案 CSV→code。同一波最多一个改 CSV 的批次。
- 旁白是 UI 表面：先 Read `.cursor/skills/in-game-ux/SKILL.md`。载体仍是 A（裂隙随身罩记录仪），挂 `#dom-ui-root`。参考仍是 Signalis / Barotrauma / Dead Space。禁止改成 OS toast / 图鉴 / 混乱阈值文学腔。
- 不开占墙 / 占空像素。不升菌毯 / 灰幕出击换皮（除非人书面点名，本包没有）。
- 不拆连通。漆不挡路。不用矩形平涂错误块当地面主签名。
- **禁止改净化点加厚三档 / 净化器起始混乱**（Slice 7；与氛围簇无耦合，查过）。

---

# 移除氛围簇：牵连查单（I8-R 必须逐条表态，I8-G 按表拆）

design 先写「移除后世界是什么样」，再给 code 可执行的留 / 改 / 删。禁止 code 自己猜。

| 面 | 现住哪里 | 要回答 |
| -- | -------- | ------ |
| 生产烤漆 | `src/generation/preview-paint.ts` `bakeGround` 的崩坏簇层；`ClusterOrganism` | 地面污染层怎么下线；L1 渍/纹理/划痕还在不在；`deriveContamRamp` 还为谁服务 |
| 整图活层应用 | `src/systems/cluster-pulse.ts`；`procedural-surface.ts` `liveClusterBreath`；`rift-scene.ts` / `gym-map-scene.ts` 传 `true` | 氛围整图呼吸怎么关；文件是退役还是只给旧皮对照 |
| 活层技术 | DEC-070 / DEC-071；`d/paint-genome/live.ts` 已抄同一呼吸系数 | 技术保留、转成丙漆活层。禁止把占漆活层一并拆掉 |
| 地表 HOW | `docs/art/rift-fragment-surfaces.md`（DEC-069 簇是主签名） | 没有簇的裂隙地面合同；会不会太干净；接缝漏光 / 渍 / 划痕够不够当世界 |
| 地图生成 spec | `docs/specs/system-map-generation.md` 规则 27、组合轴里的簇密度 | 规则 27 改口；`contaminationAge` × `ruinSeverity` 还调什么 |
| 对比度闸门 | `check:contam-floor-contrast`（测地面簇青绿） | 闸门改测什么，禁止无声删闸门又不管读法 |
| 句法钉点 | `contamination-draw.ts` / `contamination-pins.ts`；spec 规则 12 / 16 / 钉簇核 | 簇核没了，占漆钉在哪；无合法格怎么办 |
| 胀满相 | spec「从地表接收崩坏簇活层相位」 | 踩踏 +2/+4 的胀满相改跟占漆宿主自己的活层，还是改数字 |
| 地图课 | `gym.html?lesson=map`；`docs/dev/gym.md` 污染画法 | 与出击同一套：都不再铺氛围簇 |
| 出击 | `RiftScene` `liveClusterBreath` | 同上 |
| 句法课 | 若侧栏/生成仍叠氛围簇底 | 对应面一并下线，禁止只改出击 |
| 架构登记 | `architecture.md` ClusterPulse / ProceduralSurface | I8-G 落地后登记「氛围簇应用已下线」 |
| Slice 6 | 程序化地图：年龄×残破、尘点沿风、换路 | 年龄×残破留下；尘点 / 换路不动。簇密度旋钮随主签名走 |
| Slice 7 / 净化点 | `system-purification-impact.md` 净化器起始混乱、祭坛旁加厚三档 | **无 bakeGround 耦合。禁止本包改。** |
| 迭代 6 地面青绿 | I6-C / DEC-097 最终量化 | 量化纪律仍在（虚空/暗地不得吸进亮青绿）。没有簇之后「地面青绿占比」闸门要改口径，不是回滚 DEC-097 |
| 旧占漆皮 | `d/bing-paint.ts` 仍 import `cluster-pulse`（菌毯 / 灰幕裂隙旧皮） | 写清：旧皮呼吸跟谁走；本包不升菌毯 / 灰幕换皮 |

---

# 波段计划（DEC-104 修订）

单批上下文预算：一波 = 一次可独立完成的 agent 会话。**I8-R 四条同一次 design 会话**（共享设计正文 / spec / UI 合同，禁止并行两个 design 改同一文件）。连续 2 次不过机器闸门 → 停，升档 T1。审美与「读作游戏」人终审。

| 波 | 角色 | 任务 | 验收闸门 | 依赖 |
| -- | ---- | ---- | -------- | ---- |
| **1** | design | **I8-R** 重做 a/b/c/d。必须先写清「移除后世界」。配额给 ≥3 且按污染度拉开的数字。旁白给文学性隐晦方向 + 骨架是否还适用。视觉三问答完。牵连查单逐条留/改/删。先 Read in-game-ux skill（旁白是 UI） | **已交** 2026-08-28。四条都有可执行答案。人可再调数字与句子 | DEC-104 已登记 |
| **1b** | art | **I8-A2** 核 I8-R 的移除后地面 / 唯一漆读法 / 菌落核是否还要强化。只核不改像素。先 Read in-game-ux skill（载体 = 世界内污染体与地面，不是 HUD） | **已交** 2026-08-28。地面不系统性空；唯一漆读法成立；核读不成打击点。不代勾好看。不改 `src/**` | I8-R 视觉段已交 |
| **2** | code | **I8-G** 按 I8-R 查单下线氛围簇：`bakeGround` 地面污染层、`liveClusterBreath` 应用、地图课 / 出击 / 句法课对应面、HOW / 地图 spec / gym.md / 架构登记、对比度闸门改口径 | **已交** 2026-08-28。`tsc`；相关 check 按 I8-R 新口径绿 | I8-R 人过或书面先做；I8-A2 已回 |
| **2** | code | **I8-Q** 配额落地。`drawSortie`、钉点、`check:lexicon`、设计正文 §8、句法 spec 规则 16 与数值表。不改 CSV | **已交** 2026-08-28。`tsc`；`check:lexicon`；`check:paint-quota`；每图 ≥3（I8-R2 区间）；钉贪婪薪柴路径 | **配额已过**（3–5 / 6–8 / 9–12）。I8-G 已交 |
| **3** | code | **I8-N** 旁白 CSV + codegen。先 Read in-game-ux skill。不改布局/色/挂载，除非 I8-R 明文改了骨架 | **已交** 2026-08-28。`tsc`；`check:lexicon`；`check:observe-lines`；20 行与 CSV 一致 | **文案已过（我们→自语）** |
| **3b** | code（+ art 最短核） | **I8-V** I8-A2 已说核读不成打击点。候 1（与氛围分相）**永久跳过**。最小强化 = 可见性接线（核在油膜之上、座落该宿主漆格、场不画方点），不是加亮 | **code 已交** 2026-08-28。人 2026-08-28 15:28：**核读得出可以杀，过。** | I8-A2 现状不够。随 I8-G 后开 |
| **4** | qa | **I8-QA** 机械对照。氛围簇已下线、配额数字、钉点、方言、旁白、闸门口径。好看不代勾 | **已交** 2026-08-28。报告 `docs/qa/iteration-8.md`。当时 I8-V 未交、单列不挡 G/Q/N；I8-V 后交，不改该报告机械结论 | 波 2–3 已交 |
| **5** | 人 | 裂隙试玩。建议参考 `guides/02-ideation-workflow.md` Step 4 | **PASS（2026-08-28 15:28）。** 见下方验证问题 | 波 4 已交；I8-V code 已交 |

---

# Task: I8-R | 移除后世界 + 配额 + 旁白 + 视觉 | assignee: design | **已交 2026-08-28**

Title: DEC-104 四条一次重做 | Priority: P0 | Depends: DEC-104 已登记 | Dispatch: 🔴

**状态：已交。** 现行合同：设计正文 §4.4 / §4.5 / §7 / §8；句法 spec 规则 16 / 观察句选行 / 数值表；`ui-encounter-narration.md`；HOW `rift-fragment-surfaces.md`；地图 spec 规则 27。下面 brief 留作档案，禁止按 I8-D 旧表落地。

**先读：** DEC-104；设计正文 §4.3 / §7 / §8（其上 I8-D 锁视为过期）；`docs/specs/system-contamination-lexicon.md`；`docs/specs/ui-encounter-narration.md`；`docs/art/rift-fragment-surfaces.md`；`docs/specs/system-map-generation.md` 规则 27；`.cursor/skills/in-game-ux/SKILL.md`（旁白是 UI；载体 A 已锁，不重开载体种类，除非你提案改骨架）。CSV 四张只读，本批不改。

**交付（一次会话，四份都要）：**

### a. 移除后世界（必须先写）

没有氛围簇的裂隙地面是什么样。会不会太干净。L1 渍/纹理/划痕/接缝漏光够不够当「这是裂隙」。牵连查单逐条：留 / 改 / 删 + 一句话理由。胀满相跟谁。占漆钉在哪（簇核没了）。`check:contam-floor-contrast` 新口径。禁止把答案写成「code 看着办」。禁止改净化点。

### b. 配额（覆盖 I8-D 阶梯）

每图 **3 只起**。按地图污染度拉开跨度（人要的比 0/1/2/3 大）。给出：污染度怎么读（默认 `contaminationAge` 三档，不够须另写）；每档只数或区间；一份 form 还是多份；钉点规则与间距；多宿主与 60s / 2.5s / 同时 1 行。改冷却必须写进句法 spec。不要砍甲。

### c. 旁白（覆盖 I8-D 精确分类短名）

文学性、隐晦提示「面对此类敌人要注意什么」。不是精确定位。否决会走/在缝/贴地/在路。骨架（识别。+ 节点）是否还适用：适用则给新词表；不适用则给新骨架 + `interface-changed: true` + 更新 `exposes`。示例行必须能念。≤40 字除非你改了这条上限（改上限须写明）。原地更新 `ui-encounter-narration.md` 与设计正文 §7。

### d. 视觉验收（回答人的第三问）

占漆成为唯一的漆之后读法怎么验收。菌落核还要不要强化（I8-D 候 2）。场无核怎么办。不发明新色板当主手段。

**禁止：** 把 I8-D 旧表再交一次；代人锁死好看；并行另开一个 design 改同一文件；授权 code 先拆 `bakeGround`。

**循环预算：** 文案候选最多 2 轮；到顶未收敛升级给人。配额给一个主方案 + 一个否决项即可。

---

# Task: I8-A2 | 移除后视觉核 | assignee: art | **已交 2026-08-28**

Title: 核 I8-R：没有氛围簇的地面与唯一漆读法 | Priority: P0 | Depends: I8-R 视觉段已交 | Dispatch: 🔴

**状态：已交。** 书面结论见 `docs/progress/decisions-log.md` I8-A2 条与下文。不改像素。不代勾好看。`src/**` 未改。

**先 Read** `.cursor/skills/in-game-ux/SKILL.md`。载体 = 钉世界坐标的地面与污染体。参考 = `art-direction.md` 已有具名游戏。不过 U1–U12。

**结论：**

1. 地面不会系统性空到不像裂隙。渍 / 纹理 / 墙结构仍撑身份。最容易空的是新生 × 完好；碎片上医院实验室比旧图书馆更空。若空，只准沿已有渍 / 划痕随年龄加厚。
2. 占漆作为唯一的漆，3/5/8 钉贪婪薪柴路径上「看见的成片青绿 = 有主」成立。还缺：渗缝不得长成滩；菌落核必须画在油膜上（见 3）。
3. 现行 3 像素方点读不成打击点 → 开 I8-V。最小强化 = 可见性接线，不是加亮。

**禁止（仍有效）：** 改像素；代勾好看；建议把氛围簇加回来。

---

# Task: I8-G | 下线氛围簇 | assignee: code | **已交 2026-08-28**

Title: 按 I8-R 查单下线 `bakeGround` 地面污染层 | Priority: P0 | Depends: I8-R 人过或书面先做 | Dispatch: 🔴

**改：** I8-R 点名的生产路径与文档对齐。默认会碰到：`preview-paint.ts`、`cluster-pulse` 应用、`procedural-surface.ts`、`rift-scene.ts`、`gym-map-scene.ts`、句法课对应面、`check:contam-floor-contrast` 口径、`architecture.md` ClusterPulse / ProceduralSurface。

**文档已由 I8-R 改口，禁止写回簇主签名：** `docs/art/rift-fragment-surfaces.md`、`docs/specs/system-map-generation.md` 规则 27、`docs/dev/gym.md`、`.cursor/rules/gym.mdc`、设计正文 §4.4。本批只改代码与闸门实现去对齐这些文件。

**禁止：** 发明 I8-R 没有的替代主签名；改净化点 / 加厚三档；改占地基因谱；跑 codegen；顺手重开油膜身份；把占漆活层一并拆掉（DEC-070/071 技术仍给占漆宿主）。

**闸门：** `npx tsc --noEmit`；I8-R 指定的 check。最多 2 轮。

---

# Task: I8-Q | 占漆配额落地 | assignee: code | **已交 2026-08-28**

Title: 按 I8-R 数字改 `drawSortie` 与钉点 | Priority: P0 | Depends: I8-R 配额与钉点人过或书面先做 | Dispatch: 🔴

**状态：code 已交。** 新生 3–5 / 标准 6–8 / 古老 9–12；`mix32(seed, 'paint-count')`；贪婪薪柴路径钉 `paintFloors`；不足整图重试。闸门 `check:paint-quota`。体验未验证。下面 brief 留作档案。

**改：** `src/generation/contamination-draw.ts`；钉点（`contamination-pins.ts` / `ContaminationHostSystem`）；`tools/contamination-lexicon/check-lexicon.ts`。数字与钉规则已锁在句法 spec 规则 16 / 数值表 / 设计正文 §8（新生 3–5 / 标准 6–8 / 古老 9–12；贪婪路径；N≥9 间距从 5 起；Chebyshev ≤ 3 禁出生撤离）。本批禁止改写这些文档、禁止再按 `ClusterOrganism` 只数取 0/1/2/3、禁止再落地钉死的 3/5/8。

**禁止：** 跑 `codegen`；改 `preview-paint.ts`（那是 I8-G）；发明 I8-R 没有的数量；砍甲。

**闸门：** `tsc`；`check:lexicon`。每图只数符合 I8-R。最多 2 轮。与 I8-G **不同一会话**。

---

# Task: I8-N | 旁白文学性 CSV + codegen | assignee: code | **已交 2026-08-28**

Title: 按 I8-R2 文案改 CSV 并 codegen | Priority: P0 | Depends: **文案已过（我们→自语）** | Dispatch: 🔴

**先 Read** `.cursor/skills/in-game-ux/SKILL.md`。本批只换 I8-R 点名的词 / 节点。载体 A、`#dom-ui-root` 保持，除非 I8-R 明文改骨架。

**改：** 新建 `data/contamination-observe-lines.csv`（列合同见句法 spec）。必要时停用裂隙上屏的覆盖/基体/占位 `display_token`（开发标签仍可用内部名）。然后 `npm run codegen`。禁止手改 `src/generated/*.ts`。禁止把整句中文写进 `encounter-narration.ts`。禁止把 I8-D 旧短名表当输入。载荷 `nodes[].kind` 仅 `'observe' | 'utterance_mark'`。

**闸门：** `tsc`；`check:lexicon`；抽示例行与 spec 一致。最多 2 轮。本波唯一 codegen。

---

# Task: I8-V | 菌落核读法 | assignee: code → art 最短核 | **code 已交 2026-08-28**

Title: 按 I8-A2 把可打核画成打击点 | Priority: P1 | Depends: I8-A2 现状不够；建议 I8-G 已交（钉点不再读簇核） | Dispatch: 🔴

**开。** I8-A2：现行 3 像素方点读不成打击点。候 1 永久跳过。

最小强化（可见性接线，不是加亮）：

1. 可打核画在油膜画布之上（深度高于占漆精灵；出击 `skipPaint` 不得把核一起藏掉）。
2. 座落在该宿主自己的计费漆格内；第一颗不得钉在 88 像素画布正中被盖住。
3. 场不画方点；油膜装饰亮点不得冒充当可打核。

允许：占漆宿主核更好认。禁止：把氛围簇加回来；与已删除的氛围活层分相；换油膜珠/抹/滩读法；4 帧切换；新色；把核放大成第二种污染签名。

先 Read in-game-ux skill（世界内实体）。art 最短核。不过 U1–U12。不代勾好看。

**闸门：** `tsc`；`check:paint-genome-topology`。

---

# Task: I8-QA | 机械对照 | assignee: qa | **已交 2026-08-28**

Title: spec ↔ 实现机械对照 | Priority: P0 | Depends: I8-G + I8-Q + I8-N（+ I8-V 若开） | Dispatch: 🟢

**状态：已交。** 报告 `docs/qa/iteration-8.md`。I8-G / I8-Q / I8-N 机械对照通过；当时 I8-V 未交（单列）。I8-V 后交。结构层 U1–U12 已勾。人终审见波 5。

---

# 验证问题（人看裂隙；地图课辅看地面）

人答（2026-08-28 15:28）。**COMPLETE（2026-08-28，人终审 PASS）。**

人当场四问（全过）：

1. **地面像不像裂隙？** 人：**过。**（对应合同问 4）
2. **占漆够不够压？** 人：**过。**（对应合同问 2）
3. **低语像不像人话？** 人：**过。**（对应合同问 3）
4. **核读不读得出可以杀？** 人：**过。**（I8-V 视觉）

合同原四问：问 2 / 3 / 4 按上表过。问 1（看得见的漆是不是都有主、还会不会觉得满地氛围在骗你）人未单独用原句复述，随整体终审 PASS 收口，不代写细节。

迷雾下亮度已于同日 15:4x 人终审 PASS，本包不代写细节。

---

# 人需要拍板（本包内）

I8-R2 已覆盖 I8-R 的旁白腔与钉死 3/5/8。人 2026-08-28 已过 20 行与配额区间；文案已过（我们→自语）。

1. **配额：新生 3–5 / 标准 6–8 / 古老 9–12，轴 = `contaminationAge`；N 不乘面积与路径长。** **已过。** 可开 I8-Q。
2. **钉贪婪薪柴路径、偏咽喉；不足掷出的 N 则重试。N≥9 时间距从 5 起。** 与上条同批过，可开 I8-Q。
3. **移除后地面合同（设计正文 §4.4）。** 过或书面先做再开 I8-G。地面空不空等人 + I8-A2，不代勾。
4. **旁白：第一人称自语；去掉「识别。」。文案已过（我们→自语）。** 句池见 UI 合同。可开 I8-N。
5. **候 2：I8-A2 已说核读不成打击点 → 开 I8-V。** 最小强化 = 可见性接线（核在油膜之上、座落该宿主漆格、场不画方点），不是加亮。人否决则书面改口。

不要问人「要不要开迭代 8」——已开并 COMPLETE。不要问人「要不要落地 I8-D 旧表」——不要。不要问人氛围收不收——簇已移除。

---

# 收尾四项（轻量路径，Director 2026-08-28 核对）

1. **架构登记：** DEC-ARCH-016（氛围簇离开生产路径）、DEC-ARCH-017（占漆配额读年龄、钉贪婪薪柴路径）已在 `architecture.md`。
2. **spec 判断：** 句法 spec 规则 16 / 观察句 / 数值表、`ui-encounter-narration.md`、地图 spec 规则 27、地表 HOW 均原地更新。frontmatter `interface-changed` 收口为 false。
3. **交付范围记录：** 本文件波段表 + `docs/progress/current-iteration.md` 迭代 8 批次表。
4. **UI 清单：** 旁白表面 U1–U12 结构层见 `docs/qa/iteration-8.md` §6（QA 已勾）；视觉层 / 「读作游戏」/ 低语像不像人话 = 人 2026-08-28 15:28 终审 PASS。
