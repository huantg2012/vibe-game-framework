---
status: ACTIVE
created-by: director agent
created-when: 2026-08-22
last-modified: 2026-08-22
note: 迭代 3（方案 D 接入出击，DEC-084）。人已选定方案 D 并批准接入裂隙。分批提交、独立闸门、可单独回退。不要标 COMPLETE。不要开新 Slice。
---

# Tasks: 迭代 3 — 方案 D 接入出击

权威：`docs/progress/current-iteration.md`。体系仍是污染句法（DEC-078）：设计正文 `docs/design-notes/contamination-lexicon.md` → 规则 `docs/specs/system-contamination-lexicon.md` → 识别表面 `docs/specs/ui-encounter-narration.md`。生产 HOW：`docs/art/contamination-forms.md`（I3-C：方案 D 已升为出击生产标准；句法课对照同一份）+ 甲的 `docs/art/actor-pixels.md`。

迭代 2 合同 `docs/tasks/iteration-2.md` **冻结**。第一轮 A/B/C 仍冻结对照。第二轮 gym 方案 D + 止损闭表已由人点名「很好」。本文件是人选后一直预留的那次任务：接到 `RiftScene`。

**派发：** 上层负责 spawn 子代理。Director 本轮不调用 Agent 工具。禁止把三层塞进一次 code 会话。

**收尾合法态：** 三层都在裂隙里可玩。不要标迭代 COMPLETE，除非人试玩过出击。「实现完成，体验未验证」仍合法。

---

# 工作单元（已拍板）

开 **迭代 3**，不把接线塞回迭代 2。

理由：迭代 2 合同写明「人选之后才派：把胜者接到出击（新任务，不在本迭代收尾范围内）」；句法 spec「渲染探索」节写明打开 `drawSortie` 白名单是另一次任务。人这一轮点名的包是「放入游戏关卡」，不是再画一张练习场皮。

迭代 2 结法：练习场探索 **COMPLETE**（人已选方案 D，并对方案 D + 止损闭表表示满意）。不要等出击试玩才结迭代 2——出击从未在迭代 2 范围内。

---

# 新红线（FATAL）

前几轮 FATAL「不要进游戏关卡」**已解除**。新红线：

1. **每批必须能独立回退。** 人试玩后可能只退机制层、只退内容层、或只退视觉层。禁止把三层揉进一次提交。每批 Brief 写回退方式。
2. **不得为接入而降低闸门强度。** 断言反转不是断言删除。每删一条负向断言，必须加一条等价强度的正向断言（见下节协议）。`npx tsc --noEmit`、`npm run check:lexicon`、`npm run check:layout` 仍跑。
3. **连通 FATAL 仍在。** 漆 / 体积 / 墙斑不得挡路、不得切开墙后地板。打不死不得落在 `block_walk` 孔谱上（`resolveStopLoss` 的 `illegal` 必须在出击路径生效）。
4. **听觉主轴恰好 1。** 过渡期活断言仍是 `rewriter === 1`。乙听缝不另占该名额。
5. **战斗成功标准不推翻。** 「如果试玩者开始享受战斗，本系统就失败了。」绕应比杀便宜。不涨伤害、不加连击、不推翻战斗 V3（无震屏、无命中停顿、无伤害数字）。
6. **审美与迷雾下亮度仍人终审。** agent 不得代勾 PASS、不得自称好看。练习场不开 `VisibilitySystem`；出击开。方案 D 四张孔谱在真实视野蒙层下的可读性第一次被人看见。
7. **丁必须低于 `DEPTH.visionMask`（约 50）。**
8. **配对不变量（DEC-082）同一次提交。** 概念基体任一行 `enabled_scope=sortie` ⟺ 油膜出击视图不占 `volume`。内容层翻开关与油膜收回只占漆必须同一提交。禁止可玩窗口里出击丁仍是油膜（人已否决「它的基底也不应该是油膜」）。
9. **可玩窗口。** 在 I3-E（视觉）与 I3-G（内容）都落地之前，**不要请人试玩裂隙里的丁**。甲的 form 管线可以先动旁白（旧六种基体），那不是丁油膜问题。
10. **`RiftScene` 禁止 import `src/gym/**`。** 生产渲染器必须住在非 gym 路径。
11. **地图课不得打开出击活机制。** 地图课仍只画宿主、不刷会走的甲；不得传 `liveMotion` / 旧名 `gymLiveMotion`。
12. **禁止精灵表、禁止新色、禁止第三种人形覆盖体、禁止头上字。** 丙不另做小人。
13. **不要改巡逻人数来迁就 `drawSortie` 的 2–3 配额。** 甲路点仍由地图生成（3–4，撤离门仍是渗透体）。为每条甲 spawn 配一个 `form`；听轴仍恰好 1。

---

# 断言反转协议（每批强制）

`tools/contamination-lexicon/check-lexicon.ts` 里拦出击的负向断言，是过去几轮唯一在保护游戏本体的东西。

**禁止：** 顺手删掉负向断言却不补正向。

**必须：** 每删一条，就在同一提交里加一条等价强度的正向。参考替换表（落地时按实际函数名微调，语义不得弱）：

| 现负向（删除时） | 必须补上的正向 |
| ---------------- | -------------- |
| `RiftScene must not mention gymLiveMotion` | `RiftScene` 源码不含 `gymLiveMotion` 这个标识符；出击活机制用新名 `liveMotion`（见 I3-F） |
| `RiftScene hosts.create stays 5-arg` | `RiftScene` 的 `hosts.create` 传第 6 参 `{ liveMotion: true }`；地图课仍不传 |
| `tickYiSortie must not read contact` | 出击乙活路径（`tickYiLive` 或取代它的出击分支）**读取** `resolveContactChannel` / `host.form.lexemes.contact` |
| `tickYiSortie must not walk` | 出击乙活路径调用沿墙行走（`stepYiWalk` 或同等）；核在缝坐标 |
| `tickYiSortie must not read stop-loss` | 出击乙活路径读取 `resolveStopLoss`；`hittable === false` 不扣核、不发 `ENEMY_DAMAGED` |
| `tickBingSortie must not read contact` / `stop-loss` | 出击丙活路径同样读接触与止损；打不死不关踩踏场 |
| `tickDingSortie must not morph` / `contact` / `stop-loss` | 出击丁活路径用当前盒（`dingLiveRect` 或同等）；读接触与止损；混乱/视野跟当前盒走 |
| `sortie whitelist` 恰好旧六种 | `SORTIE_SUBSTRATE_IDS` 等于全部 `enabledScope==='sortie'` 的 id；含概念三类 + `stalk_clump` / `railing_post` / `ash_veil`；`drawSortie` 不得含 `enabledScope==='gym'` 的行 |
| `pairing: conceptual scope=sortie iff oil_film … no volume` | **保留这条双条件**（它两边都能成立）。G 落地后补：概念三类均为 `sortie` **且** `oil_film.sortieLegalOccupancies === ['paint']` |
| `sortie must not hit corridor_watching` | 出击抽卡**允许**命中 `corridor_watching`；若命中则 `substrate === 'space_interval'` 且 `occupancy === 'volume'` |
| （I3-B 起新增） | `src/scenes/rift-scene.ts` 不得出现 `from '@/gym/` 或 `from '../gym/` |
| （I3-A 起新增） | 出击甲 `Enemy.getForm()` 不是按 `role` 硬编码的 `INFILTRATOR_FORM` / `REWRITER_FORM`（撤离门允许抽成有机残影+视锥，但必须来自抽卡结果，不是工厂里 `role === 'rewriter' ?` 三元） |
| （I3-A 起新增） | 一次布局只有一份 `contaminationDraw`；`ContaminationHostSystem.create` 不得再调 `drawSortie` |
| （I3-E 起新增） | 出击丁视觉 depth < 50；方案 D `ready === true` 时甲默认身体与乙丙丁默认几何漆被藏 |
| （I3-F 起新增） | `resolveStopLoss` 在出击路径对每个 host form 调用；`blockWalk && unkillable` 不得出现在 `drawSortie` 结果里（已有抽卡断言则保留） |

`gym map lesson must not enable gymLiveMotion`：**改名后仍要一条等价负向**（地图课不得打开 `liveMotion`）。不要删成真空。

---

# 共享闸门（I3 每份 Brief 都遵守）

1. `npx tsc --noEmit`。动 CSV / 字母表 / `drawSortie` / checker → `npm run check:lexicon`。动 `src/generation/` 或出生/路点 → `npm run check:layout`。
2. 不要跑 `art:postprocess` / `art:verify`（没有新精灵表）。
3. 触碰 in-game 视觉或旁白排版：先 Read `.cursor/skills/in-game-ux/SKILL.md`（自定义 agent 不自动加载）。主体是世界实体时按实体套用（载体 = Phaser 世界层，无头上字）。旁白仍是裂隙随身罩，挂 `#dom-ui-root`。
4. 禁止改 `.claude/agents` / `.cursor/agents`。禁止手写基底再反向导出 CSV。
5. 到顶未收敛 → 停，升级给人，禁止无声续跑。同一任务连续 2 次过不了机器闸门 → 停，升档，不要连修造型。

---

# 文件归属

| 路径 | 谁改 |
| ---- | ---- |
| `src/types/map-types.ts`、`src/generation/types.ts`、`src/generation/rift-layout.ts`、`src/generation/contamination-draw.ts` | **仅 I3-A**（G 可再动 `contamination-draw.ts` 的范围过滤） |
| `src/entities/enemy-factory.ts`、`src/systems/ai/ai-system.ts` | I3-A；I3-E 可藏默认身体 |
| `src/systems/contamination-host-system.ts` | I3-A 不再二次抽卡；I3-F 出击走活 tick；I3-E `setSkipPaint` |
| `src/entities/form-renderers/`（新，生产） | **I3-B 搬家**；之后 E 只接线不改语法 |
| `src/gym/form-renderers/a/**` `b/**` `c/**` 与 scheme-a/b/c | **冻结对照，谁都不许改、不许删** |
| `src/gym/form-renderers/registry.ts` | I3-B：A/B/C 本地 + 从生产路径 re-export D |
| `src/scenes/rift-scene.ts` | I3-E 挂视觉；I3-F 传 `liveMotion`。禁止 import gym |
| `data/contamination-substrates.csv` | **仅 I3-G**（翻 `enabled_scope`）+ codegen |
| `tools/contamination-lexicon/check-lexicon.ts` | 各批按「断言反转协议」改自己删的那几条，禁止顺手清别人的 |
| `infiltrator-sprite.ts` / `rewriter-sprite.ts` | **不要改。** 默认敌人课与 `placeholder` 仍用。甲的 D 语法已在 `d/jia-*` |
| `docs/art/contamination-forms.md` / `actor-pixels.md` | **仅 I3-C**（生产 HOW） |
| 句法 / 战斗 / 旁白 spec | **I3-D** 写目标合同；A/F/G 落地时把「本轮仍按宿主 kind」改成现在时 |

---

## Task: I3-A | assignee: code

Title: 甲 form 管线（生成 → EnemySpawnData → Enemy） | Priority: P0 | Dispatch: 🔴人驱动 code | 收敛：最多 2 轮；过不了 tsc / check:lexicon / check:layout 升给人。禁止画像素、禁止改 `RiftScene` 画面、禁止翻 `enabled_scope`。

**必须先于 I3-E。** 可与 I3-B / I3-C / I3-D 并行。这是本次最实的工程活：不修这条，方案 D 的甲在出击里只会退回渗透体/改写体两种老外观。

### 现状（不要重查，按此做）

```146:146:src/entities/enemy-factory.ts
    this.form = config.role === 'rewriter' ? REWRITER_FORM : INFILTRATOR_FORM;
```

`drawSortie` 已经抽出甲形态，但 `EnemySpawnData` 只有 `type: 'infiltrator'|'rewriter'`。`ContaminationHostSystem.create` 用另一份 `mix32(layout.seed, 'lexicon-hosts')` **再调一次** `drawSortie`，且 `hearingAxisTaken: true`，甲 form 被 `continue` 丢掉。旁白读 `enemy.getForm()`，所以出击甲永远是「有机残影 + 渗透/改写」。

### 目标

一次出击一份抽卡。甲实体带真 `form`。画面仍是现行两种程序像素 + 乙丙丁几何漆（本批不换皮）。

### 必须成立

- [x] `EnemySpawnData` 增加 `form: ContaminationForm`（甲必填）。`type` 仍是 `infiltrator | rewriter`，由该 form 的感知词素派生：`sense_hear` → `rewriter`，否则 `infiltrator`。过渡期 `rewriter === 1` 仍 FATAL。
- [x] `GeneratedRiftLayout` 增加 `contaminationDraw: SortieDraw`（或同等：一次抽卡结果挂在布局上）。种子必须**独立 fork**（建议 `mix32(layout.seed, 'lexicon')`），**禁止**吃 `placeOnIsland` 的 rng，以免改路点/薪柴布局。
- [x] 甲人数仍由地图（3–4，撤离门仍是渗透体视锥）。为**每条**甲 spawn 抽/配一个 form，不要用句法「甲 2–3」去砍掉一条巡逻。撤离门那只锁：有机残影 + 渗透 + 视锥（可继续走 `drawOne` 强制参数，结果必须写进 `spawn.form`，不要在工厂里用 role 三元覆盖）。
- [x] `ContaminationHostSystem.create` **禁止再调 `drawSortie`**。乙丙丁只物化 `layout.contaminationDraw` 里非甲的 form。钉层空的乙↔丁回退仍在。
- [x] `Enemy` 构造：`this.form = spawnData.form`（缺省才回退到 `INFILTRATOR_FORM` / `REWRITER_FORM`，给练习场默认课）。删除 `config.role === 'rewriter' ? REWRITER_FORM : INFILTRATOR_FORM` 作为出击路径。
- [x] 练习场句法课侧栏生成的 spawn **已经有**自己的 form，不要冲掉。默认敌人课无 form 时回退仍可编译、仍能刷两种老外观。
- [x] spec 就地改：`docs/specs/system-map-generation.md`、`docs/specs/system-enemy-ai.md`。`EnemySpawnData` 带 `form` 是接口变更 → `interface-changed: true`，更新 `exposes` / 生成器契约那一段「实现后应带 form」。`last-modified-date` 今天。
- [x] checker：加正向断言（见协议「I3-A 起新增」）。**不要删** `gymLiveMotion` / 出击 tick 负向 / 白名单旧六种——那些还在保护尚未交接的层。
- [x] `npx tsc --noEmit`；`npm run check:lexicon`；`npm run check:layout`。

### 禁止

改像素配方；import gym；传 `gymLiveMotion` 进出击；翻 CSV `enabled_scope`；改 `collectWallEdges` 集合；改巡逻人数；让地图课开始刷甲。

### 回退

还原 `EnemySpawnData` / 布局抽卡 / 工厂三元 / 宿主二次 `drawSortie`。画面与机制应回到本批之前。旁白甲会回到「永远有机残影」——这是预期。

### 副作用（写进提交说明，不要藏）

本批之后，出击旁白会开始报**抽到的旧六种基体**，不再永远是有机残影。这是 form 管线在工作，不是内容层开放。新词（残茎/栏柱/灰幕/余响/散光/间距）仍不应上屏。

---

## Task: I3-B | assignee: code

Title: 方案 D 搬出 gym（分层修正） | Priority: P0 | Dispatch: 🔴人驱动 code | 收敛：1 轮；过不了 tsc 升给人。禁止改视觉语法、禁止接 `RiftScene`。

**可与 I3-A 并行**（不要改同一文件：B 不动 `enemy-factory` / `rift-layout` / `map-types`；A 不动 `form-renderers/**`）。E 之前必须完成。

### 目标

`RiftScene` 将来能 import 生产渲染器，而不 import `src/gym/**`。

### 位置（Director 锁死，不要另起第三处）

生产：`src/entities/form-renderers/`

| 搬过去 | 留下 gym |
| ------ | -------- |
| `form-renderer.ts`（接口） | `scheme-a/b/c-*.ts` + `a/**` `b/**` `c/**`（冻结对照） |
| `scheme-d-mixed.ts` + `d/**`（含 `fragment-ramp.ts`） | gym `registry.ts`：A/B/C + 从生产路径取 D |
| 生产 `registry.ts`：只登记 `d-mixed`（给出击） | 句法课下拉仍能切 A/B/C/D |

A/B/C **不要删、不要搬进 entities**。人还要并排对照。两处并存的读法：生产路径 = 出击将用的方案 D；gym 路径 = 对照方案 + 下拉登记。接口只保留一份（entities），gym 的 A/B/C `import type` 改指向那里。

### 必须成立

- [ ] `git mv` 能追溯的尽量 mv，不要复制后删到失去历史。
- [ ] 句法课切 D / A / B / C / 占位，行为与搬家前一致。
- [ ] `architecture.md` 模块注册表：`GymFormRenderers` 改为「A/B/C 冻结对照，仅句法课」。新增 `ContaminationFormRenderer` → `src/entities/form-renderers/`。目录树 `entities/` 补一行。`wall-edge-path.ts` 注释里的 gym-only 若已过时，改成「活机制与视觉钉共用」。补一条短 DEC-ARCH（生产渲染器不住 gym）。
- [ ] checker 新增：`rift-scene.ts` 不得 import gym（本批场景仍不 import D，这条先立上，E 接线时仍然成立）。
- [ ] `docs/dev/gym.md` 与 `.cursor/rules/gym.mdc`：人选已拍板，例外从「禁止接到 RiftScene」改为「生产 D 住 entities；禁止 RiftScene import gym；A/B/C 仅句法课对照」。合同指向本文件。
- [ ] `npx tsc --noEmit`；`npm run check:lexicon`（不应改坏表）。

### 禁止

改 `d/` 像素；改 A/B/C；在本批把 D `attach` 进 `RiftScene`；把 A/B/C 删掉「图个干净」。

### 回退

把生产目录 mv 回 `src/gym/form-renderers/`，恢复单 registry。

---

## Task: I3-C | assignee: art

Title: 方案 D 升为出击生产 HOW | Priority: P0 | Dispatch: 🔴人驱动 art | 收敛：1 轮规格；不要自己实现 `src/`。

**可与 I3-A / I3-B 并行。I3-E 之前必须完成。**

### 目标

`docs/art/contamination-forms.md` 不再把方案 D 写成「练习场专用、出击不读」。人选后就地扩写为生产 HOW。甲若仍走程序像素家族，就地扩写 `docs/art/actor-pixels.md` 的出击指针（不要重写渗透体/改写体那两份配方当出击唯一标准）。

先 Read `.cursor/skills/in-game-ux/SKILL.md`（实体套用，不是面板），再读 `docs/art-direction.md`、现行 `contamination-forms.md`、`actor-pixels.md`、`rift-fragment-surfaces.md`。

### 必须成立

- [x] 出击节 = 方案 D 混装（甲←A 词法，丙←B 活体，乙丁 = 第二轮重做的墙缝核 / 形变云）。「练习场方案 D」可改成「方案 D（生产；句法课对照同一份）」或同等，不要留「出击不读本节」。
- [x] 明确出击视觉消费字段：`substrate` / `coverage` / `continuity` / `occupancy` / `lexemes.*` / `utteranceId` / 碎片 `fragmentTypeId` / 乙 `pin.attach` / 丁盒 / `FormVisualPose.visibility`（迷雾）。
- [x] 迷雾：四张孔谱在可见区内必须仍能读成「那里有一口」。丁 depth 40 < 蒙层 50。亮度好不好仍人终审；规格只锁「可见区内核/缝/簇/云可辨」，不代勾。
- [x] `infiltrator-sprite.ts` / `rewriter-sprite.ts` 标为默认敌人课 / placeholder 回退，不是裂隙甲的生产路径。
- [x] 载体自检：世界实体、无头上字、无第三种人形覆盖体、无精灵表、无新色。不许写「好看」。

### 禁止

改 `src/`、启用触手/内脏/血浆、把 A/B/C 对照语法写成出击标准。

---

## Task: I3-D | assignee: design

Title: 出击已接的规则合同（spec 就地改） | Priority: P0 | Dispatch: 🔴人驱动 design | 收敛：1 轮；禁止画像素、禁止改 `src/`（CSV 留给 I3-G）。

**可与 A/B/C 并行。F / G / E 之前必须完成**（code 按本文合同接线，不要猜）。

### 目标

把「渲染探索 / gym 先兑现」改成迭代 3 的目标现在时合同。Git 管探索史。仍不新建 spec 文件。

### 必须成立

- [ ] `system-contamination-lexicon.md`：删掉「禁止 RiftScene import 候选渲染器 / 人选后再接线」这种过期 FATAL。节名从「渲染探索」改为「出击视觉（方案 D，DEC-084）」或同等。写明出击视觉消费哪些字段（与 I3-C 对齐，不复制像素配方）。Schema：废止「本轮必须恰好旧六种」；列出将翻成 `sortie` 的新行（残茎/栏柱/灰幕 + 概念三类）。成句 `corridor_watching` 出击允许命中。接触/止损：**出击与 gym 同一套读取**，废止「出击本轮按宿主 kind」。`interface-changed: true`。配对不变量保留，并写明开放后油膜出击视图只占漆。
- [ ] `system-combat.md`：兑现处表格改成出击也读接触词素与 `resolveStopLoss`。重申成功标准与 V3。打不死挥击不扣核是加分项。`interface-changed: true`。
- [ ] `system-enemy-ai.md`：生成器契约补 `EnemySpawnData.form`；`type` 仍过渡期表示听轴。`interface-changed: true`（若 I3-A 已改过，核并对齐，不要打回两套描述）。
- [ ] `system-map-generation.md`：`GeneratedRiftLayout` 交出 `contaminationDraw`；一份抽卡喂甲 spawn 与宿主。`interface-changed: true`。
- [ ] `ui-encounter-narration.md`：新基体 `display_token`（残茎/栏柱/灰幕/余响/散光/间距）将第一次上屏。核分节点、限频、成句短标记。硬约束：表名/数值/档位分开展示；禁止读成复合名词一句。不上屏止损术语。不要把内部配方名印上去。
- [ ] `last-modified-date` 今天。不要声称视觉过关。

### 禁止

改 `src/`、翻 CSV（那是 I3-G）、发明精神攻击、启用占声第五孔谱、推翻 V3。

---

## Task: I3-F | assignee: code

Title: 机制层接到出击（游荡 / 飘移 / 接触 / 止损） | Priority: P0 | Depends: I3-A, I3-D | Dispatch: 🔴人驱动 code | 收敛：最多 2 轮。

**不要等 I3-E。** 本批画面仍可以是几何漆；人不应在本批结束后被请来评丁的外形。

### 目标

裂隙里乙沿墙游荡、丁盒飘并形变、危险区跟随、读 `lexemes.contact`、止损闭表生效（打不死、打散重组）。地图课仍关。

### 开关改名（必须）

禁止 `RiftScene` 出现标识符 `gymLiveMotion`（那是练习场开关的旧名，checker 曾靠它拦出击）。

- 宿主选项公有名改为 `liveMotion?: boolean`（默认 `false`）。
- 句法课传 `{ liveMotion: true }`（可保留对旧字段的兼容别名 **仅限 gym 调用方内部**，不要让 `rift-scene.ts` 出现旧名）。
- `RiftScene`：`hosts.create(..., { liveMotion: true })`。
- 地图课：仍不传，保持静帧宿主。

出击路径走现有 `tickYiLive` / `tickBingLive` / `tickDingLive`（或把 sortie 函数体换成 live，但必须留下 `liveMotion === false` 的静帧分支给地图课与回退）。

### 必须成立

- [x] 乙：缝坐标、沿 `orderWallEdgeTiles`、`strikeFloors` 跟核。价目仍 15 / 350 ms。
- [x] 丁：当前盒做视野 ×0.7 与混乱/秒；固着则形变不位移。
- [x] `src/systems/` 出击路径真正读取 `form.lexemes.contact` 与 `resolveStopLoss`。非法组合走既有 `rewrite_to`。打不死不扣核、不发 `ENEMY_DAMAGED`、不关丙踩踏/丁场。菌落多核、杀一留余。
- [x] `block_walk` 不得 unkillable（抽卡 + `resolveStopLoss === 'illegal'` 丢弃）。连通 FATAL。
- [x] 价目数字不涨。无震屏/顿帧/伤害数字。
- [x] 按「断言反转协议」改 checker：删出击 tick 负向，补正向；`hosts.create` 5 参负向 → 6 参正向；地图课负向保留（改名后仍禁 `liveMotion`）。
- [x] `npx tsc --noEmit`；`npm run check:lexicon`；若动生成器则 `check:layout`。

### 禁止

翻 `enabled_scope`；import gym；改 A/B/C；让打不死出现在甲占地；加 DPS。

### 回退

`RiftScene` 停止传 `liveMotion`（回到 5 参或显式 `false`）。静帧 tick 必须还在。正向断言随回退提交一起改回负向，禁止留下「断言已删、行为也退了」的真空。

### 战斗红线（写进提交说明）

如果本任务让交手读起来「很爽」，不合格。打不死是让绕更划算，不是新打法。

---

## Task: I3-G | assignee: code

Title: 内容层 — 新基体对出击开放（配对不变量同提交） | Priority: P0 | Depends: I3-A, I3-D | Dispatch: 🔴人驱动 code | 收敛：1 轮；check:lexicon 不过则停。

**必须在 I3-E 请人看丁之前落地。** 可与 I3-F 并行。禁止与视觉层做成「丁已是方案 D 云、抽卡却仍是油膜」的可玩间隙。

### 目标

`enabled_scope` 翻到 `sortie` 的新行进入 `drawSortie`。油膜出击视图收回只占漆。丁的基底不再是油膜。

### 必须翻成 `sortie` 的 CSV 行（id 已锁，DEC-081）

`stalk_clump`、`railing_post`、`ash_veil`、`sound_echo`、`light_scatter`、`space_interval`。旧六种保持 `sortie`。`oil_film` 保持 `sortie`，但 `sortieLegalOccupancies` 不再含 `volume`（配对不变量；codegen 派生，禁止手写 generated）。

### 必须成立

- [x] 改 `data/contamination-substrates.csv` 后 `npm run codegen`。禁止手改 `src/generated/`。
- [x] `drawSortie` 仍只抽 `enabledScope === 'sortie'`。丁必须能抽到概念三类之一，**禁止**再抽油膜占空，**禁止**因无基体改抽乙（钉层空的乙↔丁回退仍在）。
- [x] `corridor_watching` 出击允许命中；基体 `space_interval`。废止「用油膜占空影子占住抽卡」的覆盖——若随机数序列因此变化，写进提交说明，不要暗改种子算法以外的东西。
- [x] checker：删「恰好旧六种」「sortie must not hit corridor_watching」「概念三类必须 gym」。按协议补正向。**保留配对双条件**，并加「开放后油膜出击视图 = 仅 paint」。
- [x] 方言表已含新基体权重（第二轮已写）。不要发明未入 spec 的 id。
- [x] `npx tsc --noEmit`；`npm run check:lexicon`。

### 禁止

只翻概念三类却不收回油膜占空（或相反）；改像素；改 A/B/C。

### 回退

同一提交里把新行 `enabled_scope` 改回 `gym`，并恢复油膜出击占空派生。配对不变量必须两边一起退。

---

## Task: I3-E | assignee: code

Title: 视觉层 — 方案 D 接进 RiftScene | Priority: P0 | Depends: I3-A, I3-B, I3-C, I3-D, I3-F, I3-G | Dispatch: 🔴人驱动 code | 收敛：最多 2 轮。禁止重画 `d/` 语法（人已在 gym 说很好）。

**依赖 F 与 G：** 乙必须已经在缝上走，丁必须已经是概念基体，否则接上的 D 会像「贴在格心的死核」或「油膜云」——正是人否决过的。

### 目标

裂隙甲/乙/丙/丁走方案 D。迷雾下第一次看见这套外观。

### 必须成立

- [x] Read in-game-ux（实体套用）+ I3-C 生产 HOW。
- [x] `RiftScene` import **仅** `src/entities/form-renderers/`（生产 registry 的 `d-mixed`）。禁止 `src/gym/**`。
- [x] 方案 D `ready` 时：甲 `setVisualSuppressed(true)`（藏 Image / 残影 / 脱落尘 / 脚下污斑——与句法课候选 ready 时同一语义）；宿主 `setSkipPaint(true)`。Arcade 碰撞与 AI 保留。teal 状态指示物：**出击不要用练习场那颗调试核**；头上无字。若指示物是 AI 态点，保持既有出击指示物，不要加名牌。
- [x] `attach` 传入：真 `form`、布局 `fragmentTypeId`、乙 `getVisualPin`（必须含 `attach.seam*`，不得格心）、丁盒世界像素、depth 按合同（丁 40）、`FormVisualPose.visibility` 读 `VisibilitySystem.getVisibilityAt`。
- [x] 纹理：attach / 朝向变化时 bake，不要每帧重烤整只。提交说明写复用键（至少 occupancy × substrate × coverage × seed × facing）。
- [x] 地图课：宿主若仍画几何，保持；**不要**为了对齐而打开 `liveMotion`。可选：地图课只读 D 静帧（仍不游荡）。不要改默认敌人课生产外观（无 form 的 spawn 仍两种老像素）。
- [x] checker：D 已接的正向（depth、无 gym import、skipPaint / suppress）。迷雾可读性**不要**写成机器 PASS。
- [x] `npx tsc --noEmit`；`npm run check:lexicon`；`npm run check:layout`。

### 禁止

重写 `d/jia-*` 等配方「顺便更好看」；精灵表；新色；第三种人形；把旁白改成一句复合名词；改 CSV。

### 回退

`RiftScene` 停止 attach D、停止 suppress/skipPaint。甲回到两种老像素，乙丙丁回到几何漆（机制层若还在，核仍会走——回退视觉不等于回退 F）。

---

## Task: I3-QA | assignee: qa

Title: 迭代 3 机械对照（审美 / 迷雾 / 旁白手感不代勾） | Priority: P1 | Depends: I3-E, I3-F, I3-G | Dispatch: 🟢可自动派 qa | 收敛：1 轮报告。

报告写入 `docs/qa/iteration-3-sortie.md`。

必须回答：

1. `RiftScene` 是否 import gym。
2. 甲 `getForm()` 是否来自布局抽卡（抽几只看几只 form，不是 role 三元）。
3. 宿主是否二次 `drawSortie`。
4. `liveMotion` 出击是否 true、地图课是否 false。
5. 接触词素与止损是否在出击 `src/systems/` 被读取。
6. 概念基体是否 `sortie`；油膜出击视图是否仅 paint；配对断言是否仍在。
7. `corridor_watching` 若命中，基体是否间距。
8. 丁视觉 depth 是否 < 50。
9. `rewriter === 1`；`check:lexicon` / `tsc` / `check:layout` 是否绿。
10. 有无新精灵表 / 新色 / 第三种人形覆盖体 / 头上字。
11. 旁白节点是否仍分 span（机械层看 DOM 结构，不判「像不像一句」）。

审美 / 迷雾下亮度 / 读作游戏 / 旁白是否读成复合名词：标「等人终审」，禁止 PASS。

---

# 派发顺序

```
并行波 0:
  I3-A code（form 管线）
  I3-B code（搬家）
  I3-C art（生产 HOW）
  I3-D design（spec 合同）

I3-A + I3-D 完成后可并行:
  I3-F code（机制）
  I3-G code（内容 / 配对）

I3-A + I3-B + I3-C + I3-D + I3-F + I3-G 完成后:
  I3-E code（视觉接 RiftScene）

I3-E + I3-F + I3-G 完成后:
  I3-QA
```

依赖图：

```
I3-A ──────┬──► I3-F ──┐
           └──► I3-G ──┼──► I3-E ──► I3-QA
I3-B ──────────────────┘
I3-C ──────────────────┘
I3-D ──────┬───────────┘
           └──►（F/G 也依赖 D）
```

请人试玩裂隙：只在 I3-E 之后。验证问题见 `docs/progress/current-iteration.md`。

---

# 明确不做

- 不规划 Slice 11，不标 Polish / Launch。
- 不标迭代 3 COMPLETE（除非人试玩过出击）。
- 不删 A/B/C 对照源码。
- 不改 `infiltrator-sprite.ts` / `rewriter-sprite.ts` 当出击甲生产路径。
- 不推翻战斗 V3，不加震屏 / 命中停顿 / 伤害数字。
- 不启用占声第五张主孔谱。
- 不把迷雾下亮度写成机器 PASS。
- 不在 I3-E 与 I3-G 之间请人评价出击的丁。
