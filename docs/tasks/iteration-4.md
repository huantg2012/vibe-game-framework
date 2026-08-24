---
status: ACTIVE
created-by: director agent
created-when: 2026-08-22
last-modified: 2026-08-23
note: 迭代 4（污染句法陈列馆，DEC-085 / DEC-086）。练习场新课。不改玩法、不改出击、不动 CSV。§4 虚拟化已按人试玩缺陷修订。不要标 COMPLETE，除非人能顺畅浏览并看懂参数。迭代 5（DEC-087 / DEC-088）修订甲占格轴（族内变体 3 → 采样种子 8）且甲基体轴 5 厅 → 7 厅（灯柱+栏柱合并为街具残骸，加三种生物），见 `docs/tasks/iteration-5.md` I5-H；本档案 §3 甲行保持历史口径。目录 522 将在 I5-H 重算。
---

# Tasks: 迭代 4 — 污染句法陈列馆

权威：`docs/progress/current-iteration.md`。活策略仍是污染句法：设计正文 `docs/design-notes/contamination-lexicon.md` → 规则 `docs/specs/system-contamination-lexicon.md`。生产外观：`docs/art/contamination-forms.md`。练习场入口：`docs/dev/gym.md`。

**派发：** 上层负责 spawn 子代理。Director 本轮不调用 Agent 工具。禁止把枚举与场景 UX 塞进一次 code 会话。

**收尾合法态：** 人打开 `gym.html?lesson=lexicon-gallery` 能按厅浏览视觉不同的标本、读懂参数、浏览器不卡死、画面不互删。审美终审的对象是「好不好浏览」，不是出击迷雾。不要标迭代 COMPLETE，除非人点过头。

迭代 3（方案 D 接入出击）三层已落地，等人试玩裂隙。**不要把本课的完成当成迭代 3 的完成。** 合同仍见 `docs/tasks/iteration-3.md`。

---

# 工作单元（已拍板）

**另开迭代 4。** 不塞进迭代 3，不当迭代 3 的「工具批」。

理由（DEC-072 协议）：一次迭代 = 人这一次点名的那包工作；禁止把无关模块塞进同一迭代。迭代 3 的验证问题是裂隙试玩（迷雾 / 旁白 / 绕杀）。本包不改玩法、不改出击、不动 CSV，收尾标准是「人能顺畅浏览并看懂参数」。混进迭代 3 会把两套终审搅在一起。

性质：开发练习场新课。轻量路径收尾四项仍适用（见 `current-iteration.md`）。

---

# UX 规格（已锁；实现按此做，不要改成一张大网格）

人原话：「把污染句法生成的所有不同渲染表现（长得不一样）的敌人全陈列出来，每个敌人写明句法参数。别无脑铺对象……方便我浏览。」

规模（探索已核实，不要重查）：固定一种碎片，视觉不同约 550；碎片当轴约 2700。单页一次性铺开不合格。

下面每条都是结论，不是口号。

## 1. 导航结构

**博物馆：侧栏目录 + 一次只进一个厅。** 厅 = 一张孔谱 × 一种基体。

- **主轴是基体，外层是孔谱。** 人已说过基体是决定外形差异的核心要素之一；孔谱决定占用语法（占地 / 占墙 / 占漆 / 占空），外形家族完全不同，所以先选孔谱再选基体。不要按覆盖深度或词素当顶层分区。
- **待更新（DEC-088 / I5-H，不改本档案历史口径）：** 甲厅将从五个基体改为七个（街具残骸一厅，无单独灯柱厅 / 栏柱厅；加虫 / 哺乳动物 / 大号蠕虫）。灯柱 / 栏柱 / 标牌杆不是三个厅。标本总数不再是 522。I5-H 重导出目录。本档案 §3 甲「3 个族内变体」仍是迭代 4 当时的合同。
- 侧栏 DOM（`#gym-gallery-nav`）是馆藏目录：四张孔谱作分组标题，下面列出该孔谱合法基体，每项带该厅标本数。点一项只加载那一个厅。
- 厅在 Phaser 世界里。厅内按 **覆盖深度分排**（渗透 / 改写 / 覆盖；没有标本的排隐藏）。每排内标本换行，不要做成 Excel 全表。
- 格距（世界像素，可 ±20%）：甲 / 乙 96；丙 120；丁 192。丁必须明显更大，云不能按甲的格子去挤。排与排之间留空，不要贴死。
- 同时只存在当前厅的世界对象。换厅必须 `destroy` 上一厅全部标本再搭新厅。
- 禁止：550 只一次性进场；按碎片 × 孔谱 × 基体铺三维网格；把四张孔谱的厅拼成一张超大地毯。

## 2. 碎片

**全局开关，不是网格的一个轴。**

- 侧栏一个下拉（`#gym-gallery-fragment`），五选一，默认与句法课相同（医院实验室 / `frag-clinic` 或现行 `LEXICON_DEFAULT_FRAGMENT`）。
- 换碎片：只给**当前已 attach 的标本**换 `fragmentTypeId` 再 attach，不乘 5 张网格，不改 `visualKey`，不改侧栏计数。
- 去重说明必须写明：碎片是着色方言；本课按一种碎片陈列视觉身份；完整笛卡尔约 2700，本课不铺。

## 3. 种子派生的变体

| 孔谱 | 网格里 | 检视态 |
| ---- | ------ | ------ |
| 甲 | **3 个族内变体都占格。** `jiaVariantOf(seed, substrate)` 为 0 / 1 / 2。I4-A 导出每个基体三个规范种子。标签写「族内变体」+ `1` / `2` / `3`，不要把原始种子拼进一句里 | 可看三只里点开的那只；不必再滚种子 |
| 乙 | **1 个规范种子**（锈斑孔位连续变化，枚举会无穷） | 「换锈斑」重抽种子，只作用于检视那一只 |
| 丙 / 丁 | **1 个规范种子**（谐波 / 脉数 / 回声环随种子跳，不当网格轴） | 「换种子」同上 |

规范种子常量写进目录模块并在去重说明里点名。禁止乙/丙/丁在网格里铺多种子。

## 4. 虚拟化（FATAL 级性能合同）

**2026-08-22 修订（DEC-086）。** 废止本条初版硬顶「甲 ≤ 8；乙 ≤ 12；丙 ≤ 12；丁 ≤ 8」。禁止两套数字并存。初版按「单只甲四朝向全烤 128 张」给浏览态定价，实际浏览态只烤当前一个朝向（16 张渗透 / 32 张非渗透）；视野内格子数大于硬顶时，按距相机中心排序再 `slice` 会在**屏幕内** `destroy` / `attach`，人读成标本换位、空展位。I4-QA 11 条机械对照未覆盖滚动过程，故初版闸门全绿仍能漏。

逻辑分辨率 **960 × 640**（`src/config/game-config.ts`）。格距仍是 §1：甲 / 乙 96；丙 120；丁 192。

### 浏览态纹理口径（定价用）

| 孔谱 | 浏览态每只 | 说明 |
| ---- | ---------- | ---- |
| 甲 | **16**（渗透）或 **32**（非渗透）张 canvas | `ensureFacing` 只烤当前朝向；画布 32×32 或 32×48。四朝向全烤 128 张**只发生在检视那一只** |
| 乙 | **0** 张 canvas | Graphics，浏览态最多画一次 |
| 丙 | **1** 张 | 88×88 或 144×144 |
| 丁 | **1** 张 | 边长 ≤ 384 |

可接受的浏览态总量：甲 ≤ **1536** 张（= 48 × 32，约等于初版误算的 8 × 128）；丙 ≤ 40 张；丁 ≤ 24 张。检视另计：甲最多再加 3 个朝向 × 32 = 96 张，不占浏览帽。

### 同时 attach 上限（现行；可更严，松则须重算最小缩放）

| 孔谱 | 上限 | 浏览态纹理顶 | 厅最小缩放 | 依据（相交格在合法缩放下一屏装得下） |
| ---- | ---- | ------------ | ---------- | -------------------------------------- |
| 甲 | **48** | 48 × 32 = 1536 | **1.1** | 默认缩放 1.25 时一屏相交约 ≤36；缩到 1.1 仍 ≤40。63 格的厅不能一屏看完，必须平移 |
| 乙 | **48** | 0 | **0.12**（与练习场全局下限相同，不再加码） | 全库乙约 18 只，任何一厅都盖得住 |
| 丙 | **40** | 40 张 | **0.7** | 默认缩放 1 时一屏相交约 ≤32；格更大、每只一张 |
| 丁 | **24** | 24 张 | **0.55** | 默认缩放 0.7 时一屏相交约 ≤20；单张画布比甲大，帽更紧 |

检视那只**不占**浏览帽（与初版相同）。

厅最小缩放经 `bindGymCamera` 的 `zoomMin`（已有可选参数）传入，**按当前厅切换**。禁止改 `GYM_CAMERA_ZOOM_MIN = 0.12` 常量，禁止改地图课的 `bindGymCamera(this)` 调用与滚轮默认路径。甲厅缩不到看全厅是刻意的：标签在 0.12 下本来也不可读。

数字是合同起点。机器闸门若发现某厅在该厅最小缩放下「与视野相交的格子数 > 上限」，**只许提高最小缩放或提高上限（仍遵守上表纹理顶）**，不许再对视野内格子做距离驱逐。

### 主修：视野内相交格必须全部挂上（FATAL）

光加大上限不够。只要「视野内格子数 > 上限」，距离排序驱逐就会在屏幕内换位。

**不变量（运行时 + 机器闸门同一条）：** 与 `camera.worldView` 相交的格子集合 ⊆ 已挂载集合（检视那只以其检视视觉占格，不要求再挂厅视觉）。

驱逐**只允许**发生在视野外。一格边仍作预取：先挂相交集，帽有空再挂边带。边带优先留着已经挂上的（滞后），避免在边缘来回烤纹理；**不得**用滞后把视野内的格子挤掉。

选集顺序（结论，按此实现）：

1. 与视野相交的格子全部进入 keep（这是主集，不是候补）。
2. 帽的剩余名额：视野外扩一格边里、尚未进入 keep 的格子；已挂载的优先，再按距相机中心近的优先。
3. 滚出 padded 视野的必须 `destroy()`，释放自己烤的纹理键。
4. 若相交集大于上限（合同被破坏时的运行时兜底）：**仍必须保住相交集**，允许暂时超帽；不得为了帽去 `destroy` 视野内标本。此路径必须让机器闸门失败，从而回头加最小缩放或加帽。

### 明确不做（会修错）

- **不要**给未挂载的格子不画边框来「藏空展位」。厅内按覆盖深度分排，边框是结构可读性；空展位一旦出现在视野内就是挂载错了，不是装饰问题。
- **不要**只把上限调大、仍对「视野+边」整集做距离 `slice`。那是初版缺陷，人再滚一次还会看到换位。
- **不要**改地图课缩放下限来迁就甲厅。

### 其余仍有效

- **浏览态甲只烤当前朝向的静帧。** 默认朝下、`moving: false`、`signal: 'idle'`。禁止在浏览态预烤四朝向。检视态才按需烤其他朝向。
- **浏览态乙不要每帧 `update`。** 乙的 Graphics 每帧都重画。浏览态 attach 后最多画一次，或 ≤2Hz。滚出即 destroy。
- **分页不是主导航。** 厅已经是分页。不要再做「第 1/40 页」。
- 换厅 / 关课 / 进检视前离开厅：必须把该厅所有视觉 `destroy` 干净。

## 5. 标签

硬约束：**表名 / 数值 / 档位分开展示，禁止拼成会被读成复合名词的一句。**

- **标本头上禁止 Phaser 文本。** 那是游戏内名牌（DEC-074）。开发标签走 DOM。
- **格下短标签：** DOM 层 `#gym-gallery-captions`，用世界坐标换算到屏幕，只给当前可见格（与 attach 上限同量级）。每个标签是并排/叠放的节点，至少分开：孔谱名、基体 `displayToken`、覆盖深度档位。甲再加「族内变体」+ 数字。不要写成「甲有机残影渗透变体二」。
- **悬停：** 侧栏或画布旁一条参数轨（`#gym-gallery-hover`），用定义列表：一列项目名（基体 / 覆盖深度 / 连续性 / 运动 / 感知 / 节律 / 接触 / 成句 / 止损族），一列档位（CSV `displayToken` 或已有中文档名）。一项一行。不要拼句。
- **完整参数只出现在检视卡**（I4-C）。密集网格默认只出短标签；否则会糊成一片。
- 开发标签的视觉必须能从载体上与裂隙随身罩 / HUD 分开：侧栏纸色与现有 `#gym-doc` 同一套开发说明风格。禁止做成 `#dom-ui-root` 那套裂隙读数。

## 6. 动 vs 静

人要看「外观、动作、渲染」。结论：**网格里静（或极低频），点开才全速活。** DEC-086 把浏览帽加大之后这条**仍然够**，不要为了新上限去给厅内标本开每帧 `update`。

- 浏览态：静帧或 ≤2Hz。甲不走路。丙/丁不要为浏览态每帧 refresh（可少调 `update`，或把浏览态 `visibility` 仍保持 1 但降低 tick；禁止靠 `visibility <= 0` 藏标本——那会让人以为格子是空的）。
- 检视态：那一只全速活（步态 / 胀缩 / 云形变 / 乙每帧重画都可以），并循环朝向与信号。
- 同时全速活着的标本 = 1（检视）+ 浏览态上限内的静帧。禁止几百只同时跑动画。厅内甲仍不得走四朝向。
- 同时挂载变多之后，卡顿风险在**滚入新格时的懒烘焙**，不在 tick。用一格边预取 + 边带滞后减轻；禁止用「浏览态也跑动画」去掩盖 hitch。

## 7. 检视态（I4-C；I4-B 可以先做成「点格只高亮 + 悬停轨」）

点开单只必须能看到：

- 四朝向（北 / 东 / 南 / 西四个控件，不要写成一句）
- 信号相：`idle` / `awake` / `strike` / `inflated`（四项分按钮；没有的相禁用并写「此孔谱无此相」）
- 完整句法参数（仍是表名与档位分行）
- 止损族 + 核策略（开发用语，不上成游戏 HUD）
- 当前碎片身份
- 乙/丙/丁的换种子
- 丁的脚底浊点：**仅检视态**把灯点放到这只附近，让人能看见接触通道的浊点；浏览态浊点必须关掉（见咬人事实 3）

关闭检视：回到厅，destroy 检视那只的额外烤制（四朝向多出来的甲帧），厅的虚拟化继续。

## 8. 去重说明必须上屏

侧栏固定一块 `#gym-gallery-dedupe`（换厅更新，不要藏进控制台）：

1. 本厅视觉不同 N；本孔谱合计 M；本课（一种碎片）合计 T。
2. **去重按哪些字段**（按当前孔谱列出，用中文项目名，不要只丢内部 id）。
3. **静帧不占格的字段**（当前孔谱的 B/C 类 + 朝向 + 乙丙丁的连续种子 + 碎片）。
4. 一句范围：非法止损默认排除；渗透深度的残余动词锁已施加；非甲禁止 `contact_melee_three`。

没有这块，人无法判断「是不是真的全在这儿」。N/M/T 必须来自 I4-A 的目录函数，禁止手写约数。

## 9. 其它 UX 锁

- **只挂方案 D。** 本课不是 A/B/C 对照（那是句法课）。禁止再做渲染方案下拉。
- **不刷玩家、不刷 `Enemy`、不创建 `ContaminationHostSystem`。** 手工合成 `FormAttachContext` + `FormVisualPose`。乙无宿主时 strike 地格走 `strikeFloorsFromPose`；丁建议给 `pin: {kind:'volume', x, y, width, height}`（缺省宽高 `TILE*6`；场连续性用更长盒：宽 `TILE*8`、高 `TILE*12`，让「场」在静帧上看得出来）。
- **相机：** 拖动画布平移 + 滚轮缩放，复用地图课 `bindCamera`（`src/gym/gym-map-scene.ts` 约 L280–323）。允许抽到 `src/gym/gym-camera.ts`，但禁止改地图课行为。
- **点格：** 浏览态单击 = 选中（高亮格 + 刷新悬停轨）。双击或侧栏「检视」进入检视（I4-C）。I4-B 至少要有选中。
- **非法组合：** 默认排除 `resolveStopLoss === 'illegal'`（例如碎裂无行、甲+场）。侧栏可选「含抽卡会丢的非法组合」，默认关；打开时那些格打 DOM 角标「抽卡丢弃」，仍不是头上字。

### 视觉身份（静帧占格）vs 不占格

与探索结论对齐，实现必须用 I4-A 导出的表，不要在场景里再猜：

| 孔谱 | 静帧占格（A） | 不占格 |
| ---- | ------------- | ------ |
| 甲 | 基体、覆盖深度、连续性、感知、运动、族内变体（3）、成句（甲无） | 节律、moving、signal、接触、occupancy/portfolio（厅已定）、碎片（全局开关） |
| 乙 | 基体、覆盖深度、连续性、感知、成句 | 节律、运动、接触、朝向（检视才切）、连续种子（检视才换）、碎片 |
| 丙 | 基体、覆盖深度、连续性、感知、节律（既改形也改时间）、成句、止损是否画核（`resolveStopLoss` 打不死则不画核 → **占格**） | 运动、signal、visibility、朝向、连续种子、碎片 |
| 丁 | 基体、覆盖深度、连续性、感知、成句、盒尺寸（由连续性派生，见上） | 运动、节律、signal、visibility、连续种子、碎片 |

丙的「打不死不画核」与「能打的核」看起来不同，必须分成不同标本。

---

# 三个咬人事实（I4-B 必须处理；漏了就是本课失败）

1. **甲纹理预算。** attach 时懒烘焙：每朝向 16 张（渗透）或 32 张（非渗透）；四朝向全烤单只最多 128 张，全部进 `scene.textures`。浏览态禁止预烤四朝向。浏览态同时甲 attach ≤ **48**（DEC-086；初版 ≤ 8 已废止），且与视野相交的甲格必须全部在帽内挂上。滚出 `destroy`。
2. **丙/丁纹理键互删。** `makeTexture` 是 remove-then-create。键是 `d_paint_{fragment}_{substrate}_{coverage}_{continuity}_{seed}`（丁同构 `d_volume_…`），**不含** sense / rhythm / motion / utterance / 止损。同键并发 attach 会把对方纹理删掉；同键但那些字段不同的两只会抢同一张 canvas 名却按不同逻辑重画。陈列馆同一厅里这是常态（丙的感知/节律/成句占格）。
3. **丁脚底浊点读 `scene.cameras.main.midPoint` 当玩家位置。** 浏览时相机中心落在哪只上，哪只就莫名冒浊点。浏览态必须关掉；检视态才允许对准那一只。

### 允许的渲染器管道（不是改画）

禁止改 `d/**` 的绘制函数体、色板、帧配方、剪影。允许、且 I4-B **必须**做的最小管道：

1. `FormAttachContext.textureNamespace?: string`。有值时加在丙/丁/甲的纹理键前缀。出击不传，键必须与现在完全一致。陈列馆传标本稳定 id（建议 `gal_${visualKey}`）。`destroy()` 必须删掉带前缀的键。
2. `FormAttachContext.stainWorldPoint?: { x: number; y: number }`。丁 `paintStains`：有则用它，无则保持现在的相机中心（出击不变）。浏览态传场地外沉点；检视态传该标本附近。

机器闸门：`src/scenes/rift-scene.ts` 仍不得出现这两个字段的传入（出击不传 = 行为与本迭代前相同）。可在 `check:lexicon` 或 I4 的 catalog 检查里加「RiftScene 不传 textureNamespace / stainWorldPoint」。

---

# 红线（FATAL）

1. 不改 `src/entities/form-renderers/` 的**渲染语法**（像素配方、色板、帧、剪影、甲簇计划）。上面两条管道除外。
2. 不改 `RiftScene` 行为。禁止 `RiftScene` import `src/gym/**`。
3. 不改 CSV，不手写 `src/generated/`。
4. 不为陈列馆另写一套渲染。必须 `getFormRenderer('d-mixed')`（生产路径 `src/entities/form-renderers/`）。
5. 不创建 `Enemy` / `AISystem` / `CombatSystem` / `ContaminationHostSystem`。不接迷雾、不接旁白、不刷玩家。
6. 不改 A/B/C 对照源码。不改 `infiltrator-sprite.ts` / `rewriter-sprite.ts`。
7. 侧栏是开发说明，**不走** in-game UX skill、**不过** U1–U12、不做载体决策。禁止把开发标签做成裂隙 HUD / 头上名牌。
8. 标本仍是游戏视觉语言：不新色（亮核只有 `#1aad96` / `#2ae6c8` / `#3cffd4`）、禁精灵表、覆盖体不以第三种人形出场、丙不另做小人。
9. 连通 / 出击抽卡 / 战斗 V3：本迭代不动。
10. **一张铺满 550 格的大网格 = 不合格**，即使虚拟化没卡死。

---

# 枚举规则（I4-A）

全库没有现成「遍历全部合法组合」。复用 `src/gym/gym-lexicon-form.ts` 的 `portfolioOptions` / `substrateOptions` / `continuityOptions` / `lexemeOptions` / `utteranceOptions` + `formFromConfig`。额外施加 `drawOne` / `tryDrawOne` 两条：

1. 覆盖深度为渗透且该基体有 `residualMotion` 锁：运动槽只留锁住的那一个；锁不在甲字母表里则**丢弃**该组合（灯柱 / 门框残余动词落在固着、甲抽卡本来就会丢掉）。
2. 非甲且接触为 `contact_melee_three`：丢弃。

默认排除 `resolveStopLoss === 'illegal'`。目录导出 `includeIllegal` 开关给侧栏。

范围用练习场全表（`substrateOptions` 已含 gym + sortie），不要只扫出击白名单。检视卡可用 `enabledScope` 另起一行写「出击抽卡会抽到 / 仅练习场」，仍分项目名与档位。

成句：不要拿成句去乘笛卡尔。无名填法走槽位笛卡尔（只乘该孔谱的 A 类槽）；每条成句再作为一条完整 form 加入，若 `visualKey` 已存在则把成句 id 挂到已有标本上，不占第二格。

`formFromConfig` 的 `count`：甲用 4，乙丙丁用 1。数量不是视觉轴。

朝向不是网格轴。浏览态统一 `facing4: 'down'`。

---

# 共享闸门（I4 每份 Brief）

1. `npx tsc --noEmit`。I4-A 起加跑 `npm run check:gallery-catalog`（本迭代新增；见 I4-A）。不要跑 `art:postprocess` / `art:verify`。不动 `src/generation/` 布局则不要为了本课跑 `check:layout`。未改 CSV / `drawSortie` / 字母表则 `check:lexicon` 仍跑一次，确认没误伤出击断言。
2. 禁止改 `.claude/agents` / `.cursor/agents`。
3. 到顶未收敛 → 停，升级给人。同一任务连续 2 次过不了机器闸门 → 停，升档，不要连修造型。
4. 本课框架是开发工具 UI：不要 Read in-game-ux skill 去翻修侧栏。标本硬闸门见红线 8。

---

# 文件归属

| 路径 | 谁改 |
| ---- | ---- |
| `src/gym/lexicon-gallery-catalog.ts`（新） | **仅 I4-A**（I4-B/C 只消费） |
| `tools/gym/check-gallery-catalog.ts`（新）+ `package.json` 脚本 | I4-A 建闸门；**I4-D 加相交集不变量** |
| `src/gym/gym-lesson.ts` / `gym-boot-scene.ts` / `main.ts` / `gym.html` | **I4-B**（C 可加检视 DOM，不改课入口） |
| `src/gym/gym-lexicon-gallery-scene.ts`（新） | I4-B 搭厅；I4-C 加检视；I4-D 改 `reconcile` 调纯函数 |
| `src/gym/gallery-virtualize.ts`（I4-D 新，建议） | **仅 I4-D**：layout + keep 纯函数；场景与 `check:gallery-catalog` 共用 |
| `src/gym/gym-camera.ts`（可选抽取） | I4-B 抽取；I4-D 可给陈列馆加 per-hall `zoomMin` 读取，**不得**改地图课默认与滚轮路径 |
| `src/entities/form-renderers/form-renderer.ts` + 甲/丙/丁键与丁浊点读取 | **仅 I4-B 管道**；禁止改 paint |
| `src/scenes/rift-scene.ts` | **谁都不许改** |
| `data/*.csv` / `src/generated/` | **谁都不许改** |
| `src/gym/form-renderers/a/**` `b/**` `c/**` | **冻结** |
| `docs/dev/gym.md` / `.cursor/rules/gym.mdc` / `architecture.md` | Director 已改入口；I4-B 落地后核对方括号里的课名是否一致 |

---

## Task: I4-A | assignee: code

Title: 视觉身份目录（枚举 + 去重纯函数） | Priority: P0 | Dispatch: 🔴人驱动 code | 收敛：最多 2 轮；过不了 tsc / check:gallery-catalog 升给人。禁止开场景、禁止 attach、禁止改渲染器。

**必须先于 I4-B。** 无 Phaser 依赖（除类型 import 外；目录文件本身不要 import Phaser）。

### 目标

一份可测的目录：固定一种碎片时，「长得不一样」的标本列表 + 去重说明用的字段表。场景只消费，不自己做笛卡尔。

### 必须成立

- [ ] 新文件 `src/gym/lexicon-gallery-catalog.ts`。复用 `gym-lexicon-form.ts` 的选项函数与 `formFromConfig`，施加上文「枚举规则」。
- [ ] 导出至少：`enumerateGallerySpecimens(opts)`、`visualKeyOf(form, seedBucket)`、`GALLERY_AXES`（每孔谱占格 / 不占格字段，给人看的中文名）、`jiaSeedForVariant(substrate, variant)`、`CANONICAL_SEED`（乙丙丁网格用）、`galleryDedupeCopy(portfolio)`（去重说明用的结构化数据，不要返回一句复合名词）。
- [ ] 每条标本含：`visualKey`、`form`、`seed`、`seedBucket`（甲 0/1/2，其它 0）、`utteranceIds`、`stopLoss`、`enabledScope`、`portfolio`、`substrate`。
- [ ] `tools/gym/check-gallery-catalog.ts` + `package.json` 的 `check:gallery-catalog`。断言（用区间，不要写死 550）：
  - 一种碎片、默认排除非法：总数 ∈ [400, 800]
  - 甲 ∈ [200, 400]；乙 ∈ [15, 80]；丙 ∈ [80, 350]；丁 ∈ [20, 120]
  - `visualKey` 无碰撞
  - 默认列表无 `resolveStopLoss === 'illegal'`
  - 非甲无 `contact_melee_three`
  - 甲渗透 + 有残余动词锁时，运动槽不是锁以外的值
  - `includeIllegal: true` 时总数严格大于默认
  - 换碎片不改变 `visualKey` 集合（身份数不变）
- [ ] `npx tsc --noEmit`；`npm run check:gallery-catalog`；`npm run check:lexicon`（应保持绿，本批不改表）。

### 禁止

`attach`；改 `d/**`；改 `RiftScene`；改 CSV；在目录里 import `Enemy` / 宿主。

### 回退

删目录文件与 `check:gallery-catalog` 脚本。无运行时副作用。

---

## Task: I4-B | assignee: code

Title: 陈列馆课 — 厅导航 + 静帧虚拟化 + 开发标签 | Priority: P0 | Depends: I4-A | Dispatch: 🔴人驱动 code | 收敛：最多 2 轮。禁止做检视全速活（那是 I4-C）。禁止一张大网格。

**本批结束必须可看：** 打开 `http://localhost:3000/gym.html?lesson=lexicon-gallery`，能换孔谱/基体进厅、拖动浏览、看见短标签与去重说明、换碎片换皮、浏览器不卡、丙丁不互删。

### 加课模式（照抄现课，不要发明第三种切换）

`gym.html?lesson=lexicon-gallery` → `readGymLesson()` → `GymBootScene.SCENE_BY_LESSON` → `main.ts` 注册 → 侧栏 nav 链接 → `setHidden` 按课显隐。新场景 `GymLexiconGalleryScene`。

### 必须成立

- [ ] UX 规格 §1–6、§8–9 的浏览态部分全部落地。检视态可以只有「选中 + 悬停轨」，不要求四朝向/信号循环。
- [ ] 只 `attach` 方案 D 生产渲染器。无 `Enemy` / 宿主 / 玩家。
- [ ] 虚拟化 + 同时 attach 上限（规格 §4；I4-D 已按 DEC-086 修订，本批落地的是初版 8/12/12/8）。
- [ ] 三条咬人事实：甲不预烤四朝向；`textureNamespace` 每标本唯一；丁浏览态 `stainWorldPoint` 在场地外。管道改动仅限上文「允许的渲染器管道」。出击不传这些字段。
- [ ] 标签 DOM，表名/档位分开。头上无 Phaser 字。
- [ ] 去重说明上屏，数字来自 I4-A。
- [ ] 相机拖移 + 滚轮缩放（地图课同款）。
- [ ] `docs/dev/gym.md` / `gym.mdc` / `architecture.md` 若与落地课名不一致，只校正课名/文件名，不改 UX 合同。
- [ ] `npx tsc --noEmit`；`npm run check:gallery-catalog`；`npm run check:lexicon`。

### 禁止

把 550 只一次 attach；为浏览另写 Canvas 2D / DOM 冒充方案 D；打开 A/B/C 下拉；改地图课；改句法课院子；改 `RiftScene`；I4-C 的全速检视（本批做了也不算超标，但不要因此膨胀到过不了闸门——优先交可浏览的静帧厅）。

### 回退

删除课入口与新场景；还原 `FormAttachContext` 可选字段；丙/丁/甲纹理键回到无前缀。句法课与出击外观应与本批之前相同。

---

## Task: I4-C | assignee: code

Title: 检视态 — 活标本 + 四朝向 + 信号相 + 完整参数 | Priority: P0 | Depends: I4-B | Dispatch: 🔴人驱动 code | 收敛：最多 2 轮。禁止改浏览态厅结构来「顺便重做 UX」。

### 必须成立

- [ ] UX 规格 §7 全项。同时全速活着的只有检视那一只。
- [ ] 甲检视才按需烤其他朝向；关闭检视释放多出来的朝向纹理。
- [ ] 丁检视才把 `stainWorldPoint` 移到该标本附近；关闭后回到沉点。
- [ ] 乙/丙/丁「换种子」只作用于检视那只，不污染厅内其它格的规范种子。
- [ ] 参数卡继续分项目名与档位。成句短标记若出现，单独一行，不要和基体拼成传奇全名。
- [ ] `npx tsc --noEmit`；`npm run check:gallery-catalog`；`npm run check:lexicon`。

### 禁止

改绘制配方；让检视打开时厅内帽内的甲也开始走四朝向；把参数卡做成裂隙随身罩。

### 回退

删除检视卡与检视 attach；厅浏览仍可用（退到 I4-B）。

---

## Task: I4-D | assignee: code

Title: 陈列馆虚拟化 — 视野内必挂 + 按浏览态纹理重定价 | Priority: P0 | Depends: I4-C（已交） | Dispatch: **已交**（波 0，2026-08-24） | 收敛：最多 2 轮。到顶未收敛或连续 2 次过不了机器闸门 → 停，升级给人。禁止改绘制配方、禁止重做厅 UX、禁止动地图课滚轮。禁止改 `data/*.csv`、禁止跑 `codegen`。交付后只标本批已交，**不要**把迭代 4 标 COMPLETE。

**状态：已交。** 运行时主体已在 `6ef2133`；本波补闸门与登记。`check:gallery-catalog` 绿。请人再滚甲大厅。迭代 4 不要标 COMPLETE。

人试玩甲 / 有机残影厅（63 格）时发现：滚动后第一排标本从第 1–4 格跳到第 2–5 格。根因是 `reconcile()` 对「视野+一格边」按距相机中心排序后 `slice(0, ATTACH_CAP)`，甲帽 8、一屏十几个格，屏幕内反复 destroy / attach。合同 §4 已按 DEC-086 修订。本批只修挂载策略与闸门。

### 必须成立

- [ ] **主修：** 与 `camera.worldView` 相交的格子全部 `attach`。驱逐只发生在视野外。禁止再对相交集做距离 `slice` 来挤掉屏幕内标本。边框照画全部展位（包括尚未挂载的视野外格）；禁止靠「不画空格边框」藏缺陷。
- [ ] **辅助 1（为让主修可满足）：** 按 §4 表落地 `ATTACH_CAP`（甲 48 / 乙 48 / 丙 40 / 丁 24）与厅最小缩放（甲 1.1 / 乙 0.12 / 丙 0.7 / 丁 0.55）。最小缩放只打陈列馆：`bindGymCamera` 已有 `zoomMin`；按当前厅切换（函数或 `setZoomMin` 均可）。**禁止**改 `GYM_CAMERA_ZOOM_MIN` 常量；**禁止**改 `gym-map-scene.ts` 的 `bindGymCamera(this)`；**禁止**动滚轮 `preventDefault` / 第六参数那条已修路径。
- [ ] **辅助 2：** 一格边预取保留。边带滞后：已挂载且仍在 padded 视野内的优先于尚未挂载的边带格。滞后不得挤掉相交集。
- [ ] 把厅 layout 与 keep 选集抽成**无 Phaser** 纯函数（建议新文件 `src/gym/gallery-virtualize.ts`）。场景必须调用这份函数，禁止场景里再写一套距离 `slice`。导出上限、格距、厅最小缩放、默认缩放、逻辑分辨率，让闸门与运行时同一份数字。
- [ ] 运行时兜底：若相交集 > 上限，仍挂上全部相交格（允许暂时超帽），不得 destroy 视野内标本。此情况必须被下面闸门抓到。
- [ ] §6 不变：浏览态仍只喂一次 pose（或乙 ≤2Hz），不每帧 `update`。检视仍只有一只全速活。
- [ ] `npx tsc --noEmit`；`npm run check:gallery-catalog`；`npm run check:lexicon`。

### 机器闸门（必须可在无浏览器下红）

扩 `tools/gym/check-gallery-catalog.ts`（或同脚本能 import 的纯函数测试）。用 I4-A 目录 + 真实 `layoutGalleryHall`（不要另写一套排法）合成视口，**不要**起 Phaser。

断言：

1. **主不变量：** 对每个厅（默认目录 + `includeIllegal`）、在该厅默认缩放与最小缩放、对一组滑动视口（至少：厅心；沿横轴平移 0.5 / 1 / 1.5 格；沿纵轴平移 1 格；对准第一格与最后一格），`intersecting(view) ⊆ keep(view, prevKeep)`。检视键测试可另给一次「中间一格在检视」确认厅视觉不重复占帽但不丢其它相交格。
2. **帽与缩放匹配：** 每个合成视口在合法缩放下 `|intersecting| ≤ ATTACH_CAP[portfolio]`。失败则本批未完成（回头加最小缩放或加帽，仍守纹理顶）。
3. **回归甲大厅：** 取默认目录里甲标本数最多的厅（人看到的是 63 格那类），在缩放 1.25、视口对准前两排时，先算 keep，再把视口向右平移一格，两次的相交集都必须 ⊆ 各自 keep。这就是人截图那条。
4. **地图课缩放下限未动：** `GYM_CAMERA_ZOOM_MIN === 0.12`；`gym-map-scene.ts` 仍 `bindGymCamera(this)` 且不传更严的 `zoomMin`。可源码断言，与现有滚轮 arity 断言放一起。
5. **逻辑分辨率未漂：** `src/config/game-config.ts` 仍是 `width: 960` / `height: 640`（纯函数视口用同一对数字）。

视口模型与运行时一致：世界宽 = 960 / zoom，高 = 640 / zoom，原点 = 相机 scroll。格子 AABB = 中心 ± size/2。相交 = AABB 与 view 矩形相交；完全在内 = AABB ⊆ view。keep 必须是场景实际调用的那个函数。

### 禁止

改 `src/entities/form-renderers/d/**` 绘制配方、色板、帧、剪影；改 `RiftScene`、CSV、`src/generated/`、A/B/C、两份 sprite；改地图课行为；重做博物馆导航 / 碎片开关 / 格下多行说明；标本头上 Phaser 文本；为浏览态开每帧动画来「显得没在换位」。

### 回退

还原 `reconcile` / 上限 / 陈列馆 `zoomMin`；删除纯函数模块若是本批新增。目录与检视卡应不受影响。

---

## Task: I4-QA | assignee: qa

Title: 陈列馆机械对照（好不好浏览不代勾） | Priority: P1 | Depends: I4-C | Dispatch: 🟢可自动派 qa | 收敛：1 轮报告。

报告写入 `docs/qa/iteration-4.md`。

必须回答：

1. 课入口是否 `?lesson=lexicon-gallery`，nav 是否有「污染句法陈列馆」。
2. 是否只 attach 生产方案 D；是否未创建 `Enemy` / `ContaminationHostSystem` / 玩家。
3. `RiftScene` 是否仍不 import gym、是否不传 `textureNamespace` / `stainWorldPoint`。
4. 目录检查是否绿；默认列表是否排除非法止损；非甲是否无 `contact_melee_three`。
5. 浏览态是否按厅加载（孔谱 × 基体），而不是单页铺完全集。
6. 碎片是否只是全局开关（身份计数不随碎片乘 5）。
7. 标签是否 DOM、头上是否无 Phaser 字；表名/档位是否分行（机械看 DOM 结构）。
8. 去重说明是否上屏且含 N / 占格字段 / 不占格字段。
9. 纹理管道：丙丁键是否带 namespace；甲浏览是否只烤一朝向（能从代码证明即可）。
10. 丁浏览是否传场地外 `stainWorldPoint`。
11. 有无新精灵表 / 新色 / 第三种人形 / 另写渲染器。

「好不好浏览 / 参数是否好懂」标「等人终审」，禁止 PASS。滚动时空展位（视野内距离驱逐）不在这 11 条里；I4-D 用 `check:gallery-catalog` 的相交集不变量补网，不必重跑本 11 条除非 I4-D 改了课入口 / 标签 DOM / 渲染器管道。

---

# 派发顺序

```
I4-A code（目录纯函数）
  └──► I4-B code（课 + 厅 + 虚拟化 + 标签 + 咬人事实）
         └──► I4-C code（检视态）
                └──► I4-QA
                └──► I4-D code（虚拟化修订：视野内必挂 + 按浏览态纹理重定价；DEC-086）
```

I4-D 与 I4-QA 无互相阻塞：QA 11 条已交；I4-D 的回归网走 `check:gallery-catalog`。I4-D 交完请人再滚一次甲大厅。

不要派 art（侧栏是开发说明；标本不新画）。不要派 design（UX 已由 Director 锁在本文）。不要派 ideation。

请人浏览：I4-B 即可先看厅结构；I4-C 之后看动作与完整参数。I4-D 之后再确认滚动时展位不换位。验证问题见 `docs/progress/current-iteration.md`。

---

# 明确不做

- 不把本课塞回迭代 3，不标迭代 3 COMPLETE。
- 不规划 Slice 11，不标 Polish / Launch。
- 不把 2700 只跨碎片个体铺开。
- 不把陈列馆做成第二条句法观察院子（无玩家、无伤害、无配置表点生成）。
- 不推翻战斗 V3，不改抽卡，不改迷雾。
