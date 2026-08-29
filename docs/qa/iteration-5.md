---
status: DRAFT
created-by: qa agent（迭代 5 I5-QA）
created-when: 2026-08-28
note: 污染外形基因谱机械对照。不代勾审美、读作游戏、画面 PASS。不标迭代 5 COMPLETE。I5-C 未开是对的（I6-D 覆盖），不算缺口。陈列馆总数 1974 与旁白低语是 I7/I8，不按 I5-H 旧锁 1866 误伤。
---

# QA：迭代 5（污染外形基因谱，机械层）

日期：2026-08-28  
合同：`docs/tasks/iteration-5.md` Task I5-QA（DEC-087 / DEC-088 / DEC-098）  
设计正文：`docs/design-notes/contamination-form-genome.md`  
活状态：`docs/progress/current-iteration.md`  
代码：HEAD `8e2bdec` + 工作区未提交的 I5-T / I7 / I8 产物。本报告核工作区磁盘。

**不许代勾：** 好看、读作游戏、画面 PASS、基因谱是否成立、三种生物裂隙里认不认得出。  
**合法未开：** I5-C（已被 I6-D 覆盖）。  
**界面：** 污染体是钉世界坐标的实体，合同写明不过 U1–U12。陈列馆侧栏是开发工具 UI。本迭代未动裂隙 HUD / `#dom-ui-root`。

---

## 闸门实测（工作区，2026-08-28）

| 命令 | 结果 |
| ---- | ---- |
| `npx tsc --noEmit` | 绿 |
| `npm run codegen` | 相对当前 CSV **无漂移**（三行生物 `sortie` + I8 观察句写入 `src/generated/`）。相对 HEAD 仍有未提交差，不是生成器对 CSV 跑偏 |
| `npm run check:lexicon` | 绿 `check:lexicon ok` |
| `npm run check:gallery-catalog` | 绿。`default total=1974`（甲 1632 / 乙 18 / 丙 270 / 丁 54）。甲导航 10 厅 |
| `npm run check:jia-insect-remnant` | 绿。16/16；足总数 80 种子 mean 6.000；改写→覆盖 min 0.0941 |
| `npm run check:jia-mammal-remnant` | 绿。16/16；邻域 猫 4 / 鹿 12 / 爬 2 / 类人 3；四厅各 8/8；改写→覆盖 min 0.0117 |
| `npm run check:jia-worm-remnant` | 绿。16/16；四朝向皆横躺；质心距原点 max 1.43px；四信号相 4/4；改写→覆盖 min 0.0635 |
| `npm run check:paint-genome-topology` | 绿（I7 闸门，回归） |
| `npm run check:layout` | 绿。8 种子墙后可走仍过；巡逻 3 或 4 |
| `npm run check:contrast` | 绿。CIE76 ≥ 18；地面青绿四张三年龄 **0.00%**（上限口径是 I8）；连通 = 1 |
| `npm run check:observe-lines` | 绿（I8 闸门，回归） |
| `npm run check:paint-quota` | 绿（I8 闸门，回归） |
| `node tools/agent-parity/check.mjs` | **红。** 六个 agent 的 frontmatter `description` 两侧不一致。既有红，**不算 I5 偏差** |
| `npm run check:jia-operators` | 绿（合同 I5-D，加跑） |
| `npm run check:jia-genome-pose` | 绿。七基体均消费朝向 / 信号相；可走基体 idle≠walk（加跑） |
| `npm run check:contam-distinct` | 绿。测 `bakeJiaGenome`；未 assert IoU；改写→覆盖 min 0.0117 > 0.0059（加跑） |
| `npm run check:jia-genome-weld` | 绿（加跑） |

---

## 1. 批次表（交付物是否真实存在；状态是否诚实）

| 批 | 合同状态 | 证据 | QA |
| -- | -------- | ---- | -- |
| **I5-A** | 已交（2026-08-24） | `docs/art/contamination-forms.md` 甲节七语法（街具残骸 :265、门框、残茎、有机残影、虫 :299、哺乳动物 :307、大号蠕虫 :324）；禁忌正反例 :236–249；协同但不提亮 :158 | **PASS**（说明书存在。不代勾好看） |
| **I5-P** | 已交（2026-08-23） | CSV `street_wreckage` / `insect_remnant` / `mammal_remnant` / `worm_remnant` 动词立 / 爬 / 走 / 拱、占位 `floor`、连续性 `monolith`（`data/contamination-substrates.csv:14–17`）。与合同定值表一致 | **PASS** |
| **I5-S** | 已交（2026-08-24） | 四行已在策划表。翻列前 gym 已被 I5-J / I5-T 覆盖为出击真相 | **PASS**（历史交付；现行范围见 J/T） |
| **I5-B** | 已交（2026-08-24） | `src/entities/form-renderers/d/genome/`（18 文件）；`canvas.ts` / `parts.ts` / `weld.ts` / `attach.ts`；`d/gym-attach.ts` 练习场占地分发 | **PASS** |
| **I5-C** | 合同仍在；排期表不含；**未开** | 污染四档对比度走 I6-D / I6-E 共用函数与 `check:contam-floor-contrast`。无 `contam_dialect` 列 | **不算缺口**（按 6/7/8 现状：I6-D 已覆盖） |
| **I5-D** | 已交（2026-08-24） | `operators.ts:14–37` 七算子 + 预算 1/3/5；放射只覆盖档。`check:jia-operators` 绿 | **PASS** |
| **I5-E** | 整批已交；街具残骸人过 | `street-wreckage.ts`；`check:jia-street-wreckage` 仍被哺乳动物闸门回归。灯柱 / 栏柱无独立厅（`lexicon-gallery-catalog.ts:65–68`） | **PASS**（机械）。人过已登记，不代勾后续画面 |
| **I5-F** | **code 已交**（未写人过） | `doorframe.ts`；`bake.ts:83–84` 分支。状态未写成整批已交 | **PASS**（机械）。状态诚实 |
| **I5-N** | **人过**（2026-08-25） | `attach.ts:100–116` 消费 `pose.facing4` / `pose.signal`；`setRotation(0)`；按需烤（`ensurePose` :142–144 已烤则返回）。`check:jia-genome-pose` 绿 | **PASS**（机械 + 状态与「人过」一致） |
| **I5-G** | **人未过** / 热修 code 已交 | `stalk-clump.ts` / `organic-remnant.ts`；`attach.ts:107–109` 消费 `pose.moving`；闸门 idle≠walk。未写成画面 PASS | **机械 PASS**。**状态诚实（人未过）** |
| **I5-K** | **人过**（2026-08-26） | `insect-remnant.ts`；透视排足闸门 mean 6.0。未写成画面 PASS | **PASS**（机械）。状态诚实 |
| **I5-L** | **暂过**（2026-08-26） | `mammal-remnant.ts`；策划表仍一行；馆藏四入口（闸门 猫/鹿/爬/类人 各 8/8）。未写成整批已交 | **机械 PASS**。**状态诚实（暂过）** |
| **I5-M** | **暂过**（2026-08-26） | `worm-remnant.ts:120` 钉原点；`:133` 永远横躺；四信号相 4/4 | **机械 PASS**。**状态诚实（暂过）** |
| **I5-H** | **code 已交**（2026-08-26） | 甲采样种子 8（`GALLERY_JIA_SEED_COUNT = 8`，`lexicon-gallery-catalog.ts:60`）；甲导航 10 厅；无灯柱 / 栏柱厅；`check:contam-distinct` 测 `bakeJiaGenome`。合同当时锁总数 1866；**现行锁 1974**（I7 占漆三入口把丙 162→270），甲 1632 未动 | **PASS**（按 6/7/8 现状重读；不按 1866 误伤） |
| **I5-J** | **code 已交**（2026-08-26） | `scheme-d-mixed.ts:19–21` 占地 → `attachJiaGenomeD`。`street_wreckage` sortie；灯柱 / 栏柱 gym。`RiftScene` 不 import `src/gym` | **PASS**（机械） |
| **I5-T** | **code 已交**（2026-08-28），画面等人终审 | CSV 三行 `sortie`（`:15–17`）；`DIALECT` 五张各权重 1（`contamination-draw.ts:101–104` 等）；闸门三行已 sortie。未写成画面 PASS | **PASS**（机械）。**状态诚实（画面等人）** |

活状态 / 合同 Dispatch 与上表一致：人过 / 暂过 / 未过 / code 已交均未被写成整批已交或画面 PASS。

---

## 2. 三层管线机械事实

| 项 | spec / 设计正文 | 代码证据 | 结论 |
| -- | ---------------- | -------- | ---- |
| 七语法各基体落位 | 街具残骸 / 门框 / 残茎 / 有机残影 / 虫 / 哺乳动物 / 大号蠕虫 | `bake.ts:79–101` `buildJiaGenomeSkeleton` 七分支，未填才掉 `buildFixtureSkeleton` | **PASS** |
| 构件库跨基体共享 | 杆 / 梁 / 团 / 座 / 丝 / 碎 / 核 | `parts.ts:1–43` `drawPart`；各语法只组节点，焊后走 `paintWeldedBody` | **PASS** |
| 违规预算 1/3/5 | 渗透 1、改写 3、覆盖 5；放射仅覆盖档 | `operators.ts:25–37`；`check-jia-operators.ts:40–55` 断言条数与放射池 | **PASS** |
| `weld` 后一块 | 四连通 = 1 | `weld.ts:1–3,58`；`check:jia-genome-weld` 绿；各基体闸门逐种子 weld=1 | **PASS** |
| 粗占格闸门存在且不是交并比 | 禁止 IoU 当验收 | `check-contam-distinct.ts:4,25–34` 6×8 L1；`:143` `must not assert IoU`；`:105` 的 `iou()` 只打日志 | **PASS** |
| 画布 48×64 / 碰撞 20 | 覆盖 48×64；渗透 32×32；改写 / 听噪 32×48；偏移 `(边−20)/2` | `canvas.ts:11–36`；`GENOME_COLLISION_PX` 必须 = 20；`constants.ts` `BODY_SIZE: 20` | **PASS** |
| 渗透档在 48×64 对齐后仍可读 | 掩膜垫到 48×64 再比 | `check-contam-distinct` 七基体渗透 16/16。渗透→改写 min **0.0052**（哺乳动物），下限锁 0.0051。改写→覆盖 min 0.0117 > 0.0059 | **PASS**（机械有牙）。哺乳动物渗透→改写低于旧灯柱 0.0059，I5-H 已记，见边界 |

---

## 3. DEC-098：四朝向与四个信号相

| 项 | 证据 | 结论 |
| -- | ---- | ---- |
| 挂载消费 `facing4` / `signal` | `attach.ts:102,112,149–150`；`check-jia-genome-pose.ts:219–220` 源码断言 | **PASS** |
| 可走另消费 `moving` | `attach.ts:6,107–109`；残茎 / 有机残影 / 虫 / 哺乳动物 / 蠕虫 idle≠walk | **PASS**（机械）。I5-G 人未过的是检视观感，见交人清单 |
| 四向直立不转画布 | `attach.ts:97,115` `setRotation(0)` | **PASS** |
| 按需烤，不预烤 4×4×步态 | 构造只烤 `down`+`idle`（`:92`）；`ensurePose` 已有则返回（`:144`）；walk 另 `ensureWalk` | **PASS** |
| 闸门走同一条 `bakeJiaGenome` | `check-jia-genome-pose.ts:10,51,208` | **PASS** |
| 实测 | 街具 / 门框 / 残茎 / 有机残影朝向去重 3/4（对向可同，正交不同）；虫 / 哺乳动物 / 蠕虫 4/4。七基体 idle≠strike，信号相缓冲 4/4 | **PASS** |

---

## 4. I5-T 三种生物翻出击

| 项 | 证据 | 结论 |
| -- | ---- | ---- |
| 三行 CSV `sortie` | `data/contamination-substrates.csv:15–17`。灯柱 / 栏柱仍 `gym`（`:3,9`） | **PASS** |
| 方言五张各权重 1 | `contamination-draw.ts` `DIALECT`：户外 / 医院 / 地铁 / 旧图书馆 / 居民区均含三 id 权重 1（如 `:101–104`、`:119–121`） | **PASS** |
| 哺乳动物仍一行 | CSV 仅 `mammal_remnant` 一行；无猫科等四行。馆藏四入口是 `hallId`，`form.substrate` 仍是该 id | **PASS** |
| 巡逻名额未加 | `rift-layout.ts:521` `patrolCount = rng.nextInt(3, 4)`；`:688–689` 写明地图巡逻仍 3–4，抽卡 2–3 只是甲形态池。`check:layout` 八张巡逻 3 或 4 | **PASS** |
| 撤离门强制形态不变 | `contamination-draw.ts:551–561` 第一只甲钉 `organic_remnant` + 渗透 + 锥视；`rift-layout.ts:636,713–727` 撤离门仍渗透体 / 有机残影 | **PASS** |
| 听觉主轴恰好 1 | `contamination-draw.ts:507,590–606`；`rift-layout.ts:643–644` 改写体计数必须 1 | **PASS** |

画面是否认得出三种生物：**等人终审**，不代勾。

---

## 5. I5-QA 合同 13 问

| # | 问 | 结论 |
| - | -- | ---- |
| 1 | 生产甲是否不再用 `mix32 % 3` 三分支当剪影身份 | **是。** 出击默认走基因谱连续采样。陈列馆 `jiaVariantOf` 是 `% 8` 采样种子桶（`lexicon-gallery-catalog.ts:174–176`），不是剪影身份。旧 `jia-recipe.ts:91–92` `% 3` 仍给 A/B/C 冻结对照 |
| 2 | `paintJiaSilhouette` 是否仍是出击默认 | **否。** `scheme-d-mixed.ts:20–21` → `attachJiaGenomeD`。`jia-silhouette.ts:273` 仍在，只服务冻结对照 |
| 3 | 覆盖档画布 48×64、碰撞仍 20 | **是 / 是。** 见 §2 |
| 4 | 违规预算 1/3/5；放射仅覆盖档 | **是。** 见 §2 |
| 5 | `weld` 后身体仍是一块 | **是**（机器能证的那层）。人问 5 已过（2026-08-26） |
| 6 | 有无 `contam_dialect` 列；渲染器有无按碎片给污染层分工色相 | **无该列。** 基因谱甲用共享构件墨 `DEFAULT_GENOME_INK`，无 `if (substrate === …)` 选污染色。旧 `jia-recipe` 的碎片混色只服务冻结对照 |
| 7 | `check:contam-distinct` 是否存在且未用 IoU | **存在；验收不用 IoU。** 见 §2 |
| 8 | 陈列馆甲 8 采样种子；策划表七个甲基体；哺乳动物四入口；无单独灯柱 / 栏柱厅；乙丙丁仍规范种子 | **是。** 甲 1632；导航 10 厅（七基体 − 哺乳动物一厅 + 四邻域）；丙 270 含 I7 油膜三入口，不算 I5 犯规 |
| 9 | I5-J 前 `RiftScene` 是否未被提前改默认甲路径 | 当前磁盘：`RiftScene` 不 import `src/gym`；默认占地已是基因谱（I5-J 已交）。历史「J 前未改」以当时闸门 `git diff rift-scene.ts` 空为据，本轮不重放 J 前快照 |
| 10 | 有无新色 / 精灵表 / 第三种人形 / 改 A/B/C / 改渗透体与改写体 sprite | **无。** 类人是哺乳动物邻域，不是覆盖体第三人形。`src/entities/form-renderers` 不引用 `infiltrator-sprite` / `rewriter-sprite` |
| 11 | 丙丁乙绘制语法是否被本迭代改形 | **I5 未改。** 丙油膜换皮是 I7；氛围簇下线是 I8。不记 I5 犯规 |
| 12 | I5-J 后街具残骸 sortie、灯柱 / 栏柱 gym；**I5-T 后**三种生物 sortie | **是。** 见 §4 |
| 13 | 是否改过 `preview-paint.ts` 生产量化 | **I5 合同禁止改；文件被 I6/I8 改过。** 按现状不记 I5 犯规 |

「丰富度 / 逐渐疯狂 / 好看」：**等人终审**，禁止 PASS。禁忌边界像素层：HOW 已定稿（`:236–249`）；code 闸门禁 `flesh` / 黏膜。人问 7 先放过，qa 不代勾像素遵守。

---

## 6. 边界

| 项 | 事实 | 结论 |
| -- | ---- | ---- |
| 覆盖档 48×64 里渗透档可读 | 渗透仍 32×32，闸门把掩膜垫到 48×64。七基体渗透 16/16 去重。哺乳动物渗透→改写 min 0.0052（低于旧 0.0059，I5-H 已锁 0.0051、不改骨架） | **机械成立。** 人眼阶梯是验证问 1，先放过 |
| 哺乳动物策划表不拆四基体 | CSV 一行；目录四 `hallId` | **PASS** |
| 蠕虫永远横躺钉原点 | 四朝向 × 三档 seed 1000 全横；质心距原点 max 1.43px；朝向两两质心 max 2.11px | **PASS**（机械）。人暂过，不代勾观感 |

---

## 7. 偏差清单

| ID | 类型 | 严重度 | 描述 | 位置 | Spec 依据 |
| -- | ---- | ------ | ---- | ---- | --------- |
| D1 | 文档漂移 | Low | HOW Agent 入口仍写「裂隙默认仍 `d/jia-*`，直到 I5-J」；哺乳动物节仍写「仍 gym 一行，不上出击抽卡」 | `docs/art/contamination-forms.md:24,313` | I5-J / I5-T 已翻列。活指针在 architecture / spec / CSV |
| D2 | 既有红 | — | 六个 agent 的 frontmatter `description` 两侧不一致 | `.claude/agents/*` vs `.cursor/agents/*` | 框架闸门。**不算 I5 偏差** |

未把下列写成 I5 FAIL：I5-C 未开；陈列馆 1974≠1866（I7）；`preview-paint.ts` / 丙油膜 / 旁白低语（I6/I7/I8）；spec Schema 表「兽骸 / 长虫 / 街具」是 I8-D 内部标签（`system-contamination-lexicon.md:257–264`），CSV `display_token` 仍是 I5-P 的哺乳动物 / 大号蠕虫 / 街具残骸。

**无确定的功能 Bug。** 无 High / Medium 机械偏差。

---

## 8. 通过的检查（机械）

- 七骨架语法文件均存在并接入 `bakeJiaGenome`。
- 共享构件 + 七算子 + 预算 1/3/5 + 放射锁覆盖档 + `weld` 四连通 1。
- 出击默认占地 = 基因谱；练习场 `d/gym-attach.ts` 占地同一份。
- DEC-098：挂载消费四朝向 / 四信号相 /（可走）`moving`；闸门与生产烘焙同一条。
- 陈列馆甲 8 采样种子、七基体、哺乳动物四入口、无灯柱 / 栏柱厅。
- I5-T：三行 sortie、方言各 1、巡逻 3–4、撤离门有机残影、听觉主轴 1。
- 用户点名闸门除 agent-parity 既有红外全绿。

---

## 9. 交人终审的问题清单

不代勾。活状态已登记的口径保持：

1. **I5-G 检视动画**（人未过，2026-08-25）。热修 code 已交：检视 `moving: true` 应有残茎空隙开合 / 有机残影步态，浏览厅仍静帧。请人再开陈列馆检视残茎 / 有机残影看时间维。
2. **I5-L 暂过**（2026-08-26）。馆藏四入口（猫科 / 鹿科 / 爬行 / 类人）是否维持暂过，或改口为人过 / 未过。
3. **I5-M 暂过**（2026-08-26）。永远横躺 + 钉原点 + 四信号相是否维持暂过。
4. **验证问 1**（2026-08-26 先放过）：同一基体三档覆盖是否读成结构违规阶梯，而不是漆更浓。不记过关。
5. **验证问 7**（先放过，结论同 1）：生物残余是否仍读成原物坏了，而不是污染长成软组织 / 黏液 / 内脏。
6. **I5-T 三种生物在裂隙里认不认得出**（code 已交，画面等人终审）。练习场能挂不等于出击迷雾下认得出。
7. 验证问 4「像不像污染」已并入问 1，不单独代勾。

验证问 2 / 3 / 5 / 6 人已答（非常可以 / 基本上可以 / 过 / 过）。**不要标迭代 5 COMPLETE**，除非人点头或书面接受「实现完成，体验未验证」。

---

## 建议

1. 人先看交人清单 1 / 6（I5-G 检视动画、I5-T 裂隙三种生物）；L/M 暂过是否升级由人说。
2. D1 HOW 两句过期指针可随下一手文档批改，不挡机械验收。
3. agent-parity 既有红归框架，不塞进本迭代。
4. I5-C 保持不开。
