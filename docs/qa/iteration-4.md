---
status: DRAFT
created-by: qa agent（迭代 4 I4-QA）
created-when: 2026-08-22
note: 陈列馆机械对照。不代勾「好不好浏览 / 参数是否好懂 / 审美 / PASS」。不要标迭代 4 COMPLETE。侧栏按合同不走 U1–U12。
---

# QA：迭代 4（污染句法陈列馆，机械层）

日期：2026-08-22  
合同：`docs/tasks/iteration-4.md`（UX 规格 L31–L141、三个咬人事实 L143–L156、红线 L160–L172、Task I4-QA L311–L331）  
权威锁：DEC-085  
代码：HEAD `2ab81c7`。三批（旧→新）：`5cf7a7a` I4-A 目录 → `5e998d0` I4-B 课/厅/管道 → `2ab81c7` I4-C 检视。工作区另有未提交的入口文档（`CLAUDE.md` / `current-iteration.md` 等），**不含**陈列馆代码 diff。

闸门实测（工作区，2026-08-22）：

| 命令 | 结果 |
| ---- | ---- |
| `npx tsc --noEmit` | 绿 |
| `npm run check:gallery-catalog` | 绿。`default total=522 jia=288 yi=18 bing=162 ding=54`；`includeIllegal total=648`（Δ 126，全在甲）；`visualKey` 无碰撞；默认无非法止损；非甲无 `contact_melee_three`；换碎片身份集合不变；`CANONICAL_SEED=20260822` |
| `npm run check:lexicon` | 绿（含 `RiftScene` 不得出现 `textureNamespace` / `stainWorldPoint`、不得 import gym） |

**「好不好浏览 / 参数是否好懂 / 审美」一律等人终审。本报告不勾 PASS。不要标迭代 4 COMPLETE。**

侧栏 / 格下标签 / 检视卡按红线 7 是开发工具 UI：**不过** U1–U12、不走 in-game UX skill。标本硬闸门（不新色 / 不另写渲染 / 头上无字）在下文机械核。

---

## I4-QA 11 条 + 追加项

| # | 项 | 结果 |
| - | -- | ---- |
| 1 | 课入口是否 `?lesson=lexicon-gallery`，nav 是否有「污染句法陈列馆」 | **通过。** `gym-lesson.ts:12`；`gym-boot-scene.ts:14` 映射 `GymLexiconGalleryScene`；`main.ts:10,25` 注册；`gym.html:239` 链文案「污染句法陈列馆」，`href="/gym.html?lesson=lexicon-gallery"` |
| 2 | 是否只 attach 生产方案 D；是否未创建 `Enemy` / `ContaminationHostSystem` / 玩家 | **通过。** `getFormRenderer('d-mixed')`（`gym-lexicon-gallery-scene.ts:390,498`），走生产 `src/entities/form-renderers/registry.ts`（只登记 D）。场景无 `Enemy` / `AISystem` / `CombatSystem` / `ContaminationHostSystem` / `Player` 的 import 或 `new` |
| 3 | `RiftScene` 是否仍不 import gym、是否不传 `textureNamespace` / `stainWorldPoint` | **通过。** 见「出击零影响」。`check:lexicon` `:335–356` 锁这三项 |
| 4 | 目录检查是否绿；默认是否排除非法止损；非甲是否无 `contact_melee_three` | **通过。** 闸门输出见文首。`check-gallery-catalog.ts:73–75` 逐条断言 |
| 5 | 浏览态是否按厅加载（孔谱 × 基体），而不是单页铺完全集 | **通过（机械）。** `enterHall` 先 `destroyAttached` 再只留下 `portfolio && substrate` 过滤后的格（`gallery-scene.ts:301–323`）。侧栏按孔谱分组、点一项进一厅（`paintNav` `:574–606`）。无「第 N 页」。**好不好找、好不好看等人终审** |
| 6 | 碎片是否只是全局开关（身份计数不随碎片乘 5） | **通过。** `#gym-gallery-fragment` 五选一，默认 `LEXICON_DEFAULT_FRAGMENT` = `frag-clinic`（`fragment-ramp.ts:24`；`fillFragmentSelect` `:563–571`）。换碎片只 `reattachVisible` / `reattachInspect`（`:192–196`），不 `reloadCatalog`、不改 `visualKey`、不改侧栏计数。目录 `void opts.fragmentTypeId`（`lexicon-gallery-catalog.ts:263`）。checker 断言换碎片身份集合不变 |
| 7 | 标签是否 DOM、头上是否无 Phaser 字；表名/档位是否分行 | **通过（机械 DOM）。** 无 `add.text` / `BitmapText`。格下 `#gym-gallery-captions`（`syncCaptions` `:729–748`，`captionEl` `:949–970` 用 `kvInline` 两个 span）。悬停 / 检视 / 去重用 `dt`+`dd` 或 `gym-gal-k`/`gym-gal-v`。**读不读得懂、会不会仍被看成一句：需人判断** |
| 8 | 去重说明是否上屏且含 N / 占格字段 / 不占格字段 | **通过。** `#gym-gallery-dedupe` 在 `gym.html:300`，换厅 `paintDedupe`（`:609–636`）。N/M/T = `this.cells.length` / 本孔谱 `specimens.filter` / `this.specimens.length`，源是 `enumerateGallerySpecimens`。占格 / 不占格来自 `galleryDedupeCopy`。规范种子点名 `CANONICAL_SEED`。范围句含「完整笛卡尔约 2700」（任务书允许的那句，不是 N/M/T） |
| 9 | 丙丁键是否带 namespace；甲浏览是否只烤一朝向 | **通过。** 见咬人事实 1–2 |
| 10 | 丁浏览是否传场地外 `stainWorldPoint` | **通过。** 见咬人事实 3 |
| 11 | 有无新精灵表 / 新色 / 第三种人形 / 另写渲染器 | **通过（机械）。** I4 无新 PNG/精灵表。亮核仍 `#1aad96` / `#2ae6c8` / `#3cffd4`（`jia-recipe.ts:26–30` 等，I4 未改这些配方文件）。丙仍走簇、不是第三套人形。陈列馆只 `d-mixed`，无 A/B/C 下拉。**标本好不好看等人终审** |

追加（派发另加）：

| # | 项 | 结果 |
| - | -- | ---- |
| A | 标本头上无 Phaser 文本（DEC-074 禁名牌） | **通过。** 开发标签全在 `#gym-doc` / `#gym-gallery-captions`。非法组合角标是 DOM `span.gym-gal-badge`「抽卡丢弃」（`captionEl:964–968`），不是头上字 |
| B | 参数卡与悬停轨表名与档位分行 | **通过（机械）。** `paintHover` / `paintInspect` 建 `dl`，一项一行 `dt`（项目名）+ `dd`（档位）。检视成句每条单独 `dt/dd`，不和基体拼（`inspectRows:869–874`）。悬停多条成句会在**同一个** `dd` 里用顿号拼接（`utteranceLabel:993–996`）——仍是表名/档位两节点，不是一句复合名词；是否好读需人看 |
| C | 去重数字来自目录函数而非手写约数 | **通过。** 见 #8。手写的只有任务书要求的「约 2700」范围句 |
| D | 未创建 `Enemy` / `AISystem` / `CombatSystem` / `ContaminationHostSystem` / 玩家 | **通过。** 见 #2 |
| E | 未改 `d/**` 绘制配方、A/B/C 对照、两份 sprite、CSV、`src/generated/` | **通过。** `5cf7a7a^..HEAD` 对这些路径空 diff。`d/jia.ts` `d/bing.ts` `d/ding.ts` 只加可选前缀 / 浊点锚（见下）。`form-renderer.ts` 只加两个可选字段。地图课相机抽到 `gym-camera.ts`，缩放上下限仍 0.12 / 3，拖移/滚轮公式与抽出前相同 |
| F | 检视态是否只有一只全速活（厅内 8 只甲不该走四朝向） | **通过。** `update` 只对 `this.inspect.visual.update(...)`（`:167`）。厅内标本只在 `attachCell` 时 `update(browsePose)` 一次（`:392–393`，`facing4:'down'`、`moving:false`、`signal:'idle'`、`deltaMs:0`）。打开检视会 `destroy` 该格的厅视觉并换 `gal_ins_` 命名空间（`:447–460,791–792`）。甲 `ensureFacing` 只在 `update`/`constructor` 触发，厅内甲之后不再 `update`，不会加烤其它朝向 |
| G | 三道闸门 | **通过。** 见文首 |
| H | 好不好浏览 / 参数是否好懂 / 审美 | **需人判断。禁止代勾 PASS。** |

---

## 三个咬人事实（逐条证据）

### 1. 甲纹理预算

**结论：通过。**

| 合同 | 证据 |
| ---- | ---- |
| 浏览态只烤当前朝向 | `JiaVisualD.ensureFacing` 只把**当前** `facing` 传进 `bakeJiaSheet(..., [facing])`（`d/jia.ts:113–118`）。浏览 pose 固定 `facing4: 'down'`（`gallery-scene.ts:775–784`）。厅内之后不再 `update`，不会加朝向 |
| 单只四朝向全烤最多 128 | `bakeJiaSheet`：渗透 `modes=['patrol','strike']` → 2 gait × 4 frame × 2 mode = **16**；非渗透 4 mode → **32**；四朝向 32×4=**128**（`jia-paint.ts:319–336`）。浏览只烤一朝向 = 16 或 32，不到 128 |
| 同时甲 attach ≤ 8 | `ATTACH_CAP.jia = 8`（`gallery-scene.ts:48`）。`reconcile` 按距相机中心排序后 `slice(0, cap)`，检视那只不占这个帽（`:374–376`） |
| 滚出 `destroy` 并释放自己烤的键 | 不在 `keepKeys` 的厅标本 `row.visual.destroy()`（`:378–381`）。甲 `destroy` → `removeKeys(this.scene, this.keys)`（`d/jia.ts:106–110`；`jia-pixels.ts:142–145`）。检视关闭同样 `inspect.visual.destroy()`（`gallery-scene.ts:474`），多出来的朝向在 `gal_ins_` 键上被删掉 |

说明（不是失败）：浏览态仍会把**这一朝向**的 idle+walk×mode 全套烤掉（16/32 张），不是只留一张 idle 静帧。这与「每朝向 16/32、禁止预烤四朝向」的预算句一致。

### 2. 丙/丁纹理键互删

**结论：通过。**

生产茎（出击、无前缀时与迭代前相同）：

```29:32:src/entities/form-renderers/d/bing.ts
  const stem = `d_paint_${fragment}_${ctx.form.substrate}_${ctx.form.coverage}_${ctx.form.continuity}_${(ctx.seed >>> 0).toString(16)}`;
  return ctx.textureNamespace ? `${ctx.textureNamespace}_${stem}` : stem;
```

```39:43:src/entities/form-renderers/d/ding.ts
  const stem = `d_volume_${fragment}_${ctx.form.substrate}_${ctx.form.coverage}_${ctx.form.continuity}_${(ctx.seed >>> 0).toString(16)}`;
  return ctx.textureNamespace ? `${ctx.textureNamespace}_${stem}` : stem;
```

陈列馆每标本唯一前缀：

- 厅：`gal_${visualKey.replace(/\|/g, '~')}`（`gallery-scene.ts:787–788,422`）
- 检视：`gal_ins_…`（`:791–792,505`），与厅键隔离
- `visualKey` 含丙的感知 / 节律 / 止损是否画核（`lexicon-gallery-catalog.ts:220–232`）；checker 断言无碰撞

`destroy()` 删的是**带前缀的完整键**，不是无前缀茎：

- 丙：`destroy` 用闭包里的 `key = textureKey(ctx)`（`d/bing.ts:96–98`）
- 丁：同上（`d/ding.ts:228–231`）
- `makeTexture` 仍是 exists → remove → create（`d/bing.ts:34–35`）。命名空间唯一后，同厅不同感知/节律的标本不再抢同一 canvas 名

### 3. 丁浏览态浊点

**结论：通过。**

- 场地外沉点：`STAIN_SINK = { x: -100000, y: -100000 }`（`gallery-scene.ts:46`）
- 厅 `attachContext` **一律**传 `stainWorldPoint: STAIN_SINK`（`:423`）
- 检视仅丁改为标本坐标 `{ x: cell.x, y: cell.y }`，其它孔谱仍沉点（`:500–506`）
- 关闭检视后厅重新 attach，回到沉点
- `followPos`：有 `stainWorldPoint` 就用它，**不再**读 `cameras.main.midPoint`（`d/ding.ts:115–122,240`）。沉点在场地外，`aabbHits` 为假，浏览不画浊点

---

## 出击零影响

**结论：通过。**

`RiftScene.attachSchemeD` 只传 `scene / form / seed / depth / fragmentTypeId / pin`，**没有**这两个可选字段：

```1132:1150:src/scenes/rift-scene.ts
      const visual = renderer.attach({
        scene: this,
        form: view.getForm(),
        seed: mix32(seedRoot, view.getId()),
        depth: DEPTH.enemy,
        fragmentTypeId,
      });
      // ...
      const visual = renderer.attach({
        scene: this,
        form: subject.form,
        seed: mix32(seedRoot, subject.id),
        depth: this.depthForHostPin(pin?.kind),
        fragmentTypeId,
        pin,
      });
```

不传时键与浊点回退到本迭代前：

| 孔谱 | 无可选字段时 |
| ---- | ------------ |
| 甲 | `prefix = ''`，键仍是 `jiaRecipeTag` + `_${facing}_${gait}_${frame}_${mode}`（`d/jia.ts:48–49`）。`jiaRecipeTag` 在 I4 **未改** |
| 丙 | 返回无前缀 `stem`（`d_paint_…`） |
| 丁 | 返回无前缀 `stem`（`d_volume_…`）；`followPos` 走相机中心 |

`5e998d0` 对 `d/jia.ts` / `d/bing.ts` / `d/ding.ts` 的 diff **只有**前缀分支与 `stainWorldPoint` 接线，没有改 `jia-paint` / `bing-paint` / `ding-paint` / 剪影 / 色板。`rift-scene.ts` 在 `5cf7a7a^..HEAD` 空 diff。文件内无 `from '@/gym/`。

---

## UX 规格机械核对（不是「好不好浏览」）

对照任务书 §1–9，避免「一张大网格」：

| 规格 | 机械结果 |
| ---- | -------- |
| 一次一厅 = 孔谱 × 基体；侧栏四孔谱分组 + 基体计数 | 成立（`paintNav` / `enterHall`） |
| 厅内按覆盖深度分排；空排隐藏 | 成立（`layoutHall` 对 `infiltrate/rewrite/overwrite` 循环，`rows.length===0` 则 `continue`，`:919–921`） |
| 格距甲/乙 96、丙 120、丁 192 | 成立（`CELL_SIZE` `:47`） |
| 换厅 destroy 上一厅 | 成立（`enterHall` 先 `closeInspect(false)` + `destroyAttached`） |
| 禁止 550 只一次进场 / 碎片当轴 / 四孔谱拼地毯 | 成立：一次只 layout 当前厅；碎片是下拉；无三维网格 |
| 甲 3 个族内变体占格；乙丙丁网格只用规范种子 | 成立（目录 `jiaSeedForVariant` ×3；非甲 `CANONICAL_SEED`）。检视「换锈斑/换种子」只改 `inspect.seed`（`:538–551`），不写回厅标本 |
| 视口虚拟化 + 一格边 + attach 帽 8/12/12/8 | 成立（`reconcile` pad=`cellSize`；`ATTACH_CAP`） |
| 浏览静 / 检视活；丙丁浏览不每帧 refresh | 成立（厅只 attach 时 update 一次；`update` 循环只打检视） |
| 乙无宿主 strike 走 `strikeFloorsFromPose` | 成立（`d/yi.ts:66–71`；陈列馆无 `hosts`） |
| 丁 pin 缺省 TILE×6；场连续性 TILE×8 × TILE×12 | 成立（`attachContext:399–411`） |
| 相机拖移 + 滚轮，复用抽出的 `bindGymCamera` | 成立。地图课改调用同一函数，行为公式未改 |
| 单击选中、双击或侧栏「检视」 | 成立（`:221–237,255–258,675–678`） |
| 非法止损默认排除；可选「含抽卡会丢的非法组合」 | 成立。checkbox 默认未勾（`gym.html:296`）；打开后角标 DOM「抽卡丢弃」 |
| 只挂方案 D，无渲染方案下拉 | 成立。`#gym-gallery-controls` 无 `#gym-lex-renderer` |

**一张铺满 550 格的大网格 = 不合格：机械上未做成。** 单厅内部仍是按覆盖深度分行的换行格（甲一厅可到数十格）。好不好扫、会不会仍觉得像表，**等人终审**。

---

## 发现的问题

| ID | 类型 | 严重度 | 描述 | 位置 | Spec 依据 |
| -- | ---- | ------ | ---- | ---- | --------- |
| 1 | 风险 | Low | 标签层每个 `update` 都 `replaceChildren` 重建 DOM（相机没动也重建）。机械上仍只给当前 attach 格打标签，但可能造成不必要的 DOM 抖动 | `gym-lexicon-gallery-scene.ts:160–168,729–748` | 规格 §4 性能合同（无 FPS 实测，不升为 Bug） |
| 2 | 风险 | Low | 乙厅 pin 只有 `{kind:'wall', x, y}`，没有 `attach` 缝。乙画在格子中心、朝下，不像出击贴墙缝 | `gallery-scene.ts:413–414`；`d/yi.ts:113–115` | 规格 §9 允许手工 pin；未要求陈列馆算墙缘。观感需人看 |
| 3 | 文档滞后 | Low | 活指针仍写「检视仍待 I4-C」，但 HEAD 已是 `2ab81c7` | `docs/progress/current-iteration.md` 登记表第 4 行（工作区未提交稿同样未改到 I4-C 已交） | 不是代码偏差。归 Director 改指针，不挡浏览 |

未发现确定的 **Bug** 或导致本课失败的咬人事实漏项。

---

## 通过的检查（摘要）

- 课入口、nav 文案、boot 显隐、只挂生产 D
- 目录 522 落入合同区间；非法止损默认排除；非甲无三刀近战；换碎片不乘身份
- 一次一厅、覆盖深度分排、碎片全局开关、虚拟化与 attach 帽、换厅 destroy
- 两条可选管道；出击不传；不传时茎与浊点回退与 I4 前一致
- 甲浏览单朝向；丙丁带标本 namespace；`destroy` 删带前缀键；丁浏览沉点
- 检视四朝向 / 信号相分按钮（无相：disabled +「此孔谱无此相」）；乙/丙/丁换种子不污染厅；丁检视才把浊点放到该标本
- 未改绘制配方、A/B/C、两份 sprite、CSV、generated、`RiftScene` 行为
- 三道机器闸门绿

---

## 人浏览前需要知道的注意事项

1. 打开 `http://localhost:3000/gym.html?lesson=lexicon-gallery`（Cursor Simple Browser）。不要用句法课 `?lesson=lexicon` 当陈列馆。
2. 默认碎片是医院实验室（`frag-clinic`）。换碎片只给**当前视野里已挂上的标本**换皮，侧栏数字不变。
3. 先在左侧按孔谱点基体进厅，不要指望一屏看到 522 只。甲一厅格数最多；丁格子明显更大。
4. 浏览态是静帧。要看走路 / 胀缩 / 云 / 乙每帧重画：双击格子或侧栏「检视」。Esc 或「关闭检视」回厅。
5. 丁脚底浊点**只有检视**才对准那一只；浏览时镜头扫过不应冒浊点。若仍冒，那是咬人事实 3 回归。
6. 乙在陈列馆里停在格子中心，不是贴墙缝——对照出击观感时不要用这个当缝钉是否正确的证据。
7. 「好不好浏览 / 参数好不好懂 / 画面互删或卡死」是人终审题，见 `docs/progress/current-iteration.md`「验证问题」。机械层通过 ≠ 迭代 COMPLETE。
8. 迭代 3（裂隙试玩）仍未 COMPLETE，与本课分开。

---

## 建议

1. 人按上面注意事项浏览厅结构、换碎片、点开甲/丙/丁各一只检视，再决定是否标迭代 4 COMPLETE。
2. 问题 1 仅在感到卡时再让 code 给标签层加脏检查；现在不升修。
3. 问题 3 让 Director 把登记表「检视仍待 I4-C」改成 I4-C 已交、等人终审。
4. 不要把本课完成写成迭代 3 完成。
