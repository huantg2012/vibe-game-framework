---
status: ACTIVE
purpose: 开发练习场（gym）的 Agent 入口。人要看敌人怎么走、agent 要加一种演示，都先读本文。
---

# 开发练习场

独立 HTML，用来体验和测试**与出击同一套代码**的基本功能。不是裂隙关卡，不进主菜单。**污染句法课**是观察院子：玩家在场且默认无敌（可开「感受伤害」），侧栏按维度配表后点生成，敌人与出击同一套移动 / 感知 / 攻击；击杀后按当前配置再刷。**迭代 3（DEC-084）：** 生产方案 D 已接到裂隙（体验未验证）；句法课仍可切渲染方案。A/B/C 冻结为对照；默认方案 D。合同：`docs/tasks/iteration-3.md`。**迭代 4（DEC-085）：** 陈列馆课 `?lesson=lexicon-gallery`，只挂方案 D，合同 `docs/tasks/iteration-4.md`。**迭代 5（DEC-087 / DEC-088）：** 甲外形基因谱先在练习场挂新模块，I5-J 之前不改出击默认甲；街具残骸 + 三种生物先 gym。合同 `docs/tasks/iteration-5.md`。设计正文 `docs/design-notes/contamination-form-genome.md`。**迭代 6（DEC-088 / DEC-089 / DEC-090 / DEC-093 / DEC-094）：** 碎片配色 / 世界美术验地面走地图课（与出击同一套烤地；I6-A 已交，四张一起标定；身份靠渍/纹理/结构，不靠底色落格；先等价再拆档）。合同 `docs/tasks/iteration-6.md`。地图课框住整岛，甲只是色块，且不得打开出击活机制。练习场敌人课（默认院子）复用出击 `Enemy`（含 `getForm`），不另写移动或外形。遭遇识别旁白默认不开。

**打开：** `npm run gym` 或 `npm run dev`，再用 Cursor 的 Simple Browser 打开对应地址。不要用系统浏览器。

| 课 | 地址 |
| -- | -- |
| 污染句法 | `http://localhost:3000/gym.html?lesson=lexicon` |
| 污染句法陈列馆 | `http://localhost:3000/gym.html?lesson=lexicon-gallery` |
| 敌人移动 | `http://localhost:3000/gym.html` |
| 玩家外形 | `http://localhost:3000/gym.html?lesson=player` |
| 地图生成 | `http://localhost:3000/gym.html?lesson=map` |

**代码：** `gym.html` → `src/gym/main.ts` → `GymBootScene` → `GymScene` / `GymPlayerScene` / `GymMapScene` / `GymLexiconScene` / `GymLexiconGalleryScene`。场地：`src/gym/arena.ts`（敌人 / 玩家课）、`src/gym/gym-lexicon-arena.ts`（污染句法观察院子）。地图课走出击 `generateRiftLayout`。污染句法课不走生成岛。陈列馆不走院子、不刷玩家与敌人，只 attach 生产方案 D。句法课对照 A/B/C 仍在 `src/gym/form-renderers/`；生产方案 D 住 `src/entities/form-renderers/`。禁止 `RiftScene` import `src/gym/**`。合同：迭代 4 陈列馆见 `docs/tasks/iteration-4.md`；迭代 5 甲基因谱见 `docs/tasks/iteration-5.md`（I5-J 前陈列馆甲可挂基因谱模块，仍是方案 D 甲章，不是第三套方案）；迭代 6 地面配色见 `docs/tasks/iteration-6.md`（地图课即验证面，禁止另写第二套 ramp）。

---

## Agent 入口（加演示 / 修练习场）

1. 先读本文，再改 `src/gym/**`。不要在 `RiftScene` 里塞调试房间。
2. **禁止**为练习场另写敌人移动、用 DOM/Canvas 2D 冒充巡逻。敌人画面默认就是出击那套。**例外（DEC-079，人选后由 DEC-084 收回）：** 仅 `?lesson=lexicon` 可挂对照渲染器 A/B/C。生产方案 D 住 `src/entities/form-renderers/`（I3-B）。禁止 `RiftScene` import `src/gym/**`。合同：`docs/tasks/iteration-3.md`。
3. 练习场必须调用正式模块：
   - 敌人课：`AISystem`（巡逻预计算腿 + `GridPathfinder` 8 邻接 A*）、`Enemy` / `createEnemyTypeConfig`（`enemy-factory.ts`）
   - 地图课：`generateRiftLayout`、`RiftSurfacePainter`（与 `RiftScene` 同一份）、`ContaminationHostSystem`（乙/丙/丁；combat / chaos 可缺，只画）。
   - 污染句法课：固定观察院子 + 出击 `Player`（无敌）+ `AISystem` / `CombatSystem` / `ContaminationHostSystem`（战斗与混乱真结算）。侧栏配置表决定 spawn，禁止再跑 `drawSortie` 当本课主路径。
   - 所有课：`generatePlaceholderTextures`（与 `BootScene` 同一份）、`gameConfigWithScenes`（与出击同一套 pixelArt / FIT / Arcade）
4. 新敌人角色（`data/enemies.csv` 新行）时：`npm run codegen`，然后给 `GYM_LOOPS` 补一条 8 点环。`Record<EnemyRole, …>` 会在漏补时编不过。敌人课的 `AISystem.create` 仍要求出生表里**恰好 1 个改写体**——不要用两个改写体来「多演示一次皮肤」。污染句法观察课关闭这条出击配额，因为配置表可以只刷渗透体。
5. 练习场侧栏是开发说明，不是游戏内界面。不要走 in-game UX 清单，也不要把它做成墙机/随身罩。陈列馆的网格 / 标签 / 筛选 / 计数同属开发工具 UI；标本头上禁止游戏内名牌，开发标签走 DOM。
6. 玩家外形：出击与练习场同一套（DEC-068）——方案 1 加厚像素 + 方案 3 灯尘。本课用假人绕圈对照体量，不接 WASD。贴图在 `player-sprite-dense.ts`；灯尘在 `player-lamp-aura.ts`。
7. **角色外形怎么验：** Cursor Simple Browser 打开上表地址，对照 `docs/art/actor-pixels.md`（朝向不转 GameObject、家族密度、压迫感、禁忌）。不要用系统浏览器。
8. 地图生成（`?lesson=map`）：必须调用 `generateRiftLayout`、`RiftSurfacePainter` 与 `ContaminationHostSystem`。禁止为练习场另写生成器或拷画廊 PNG。默认（风格锚按种子抽、邻域抖动开、污染年龄/残破度按种子抽）与出击路径相同。侧栏可锁锚 / 关抖动 / 覆盖两轴。不开 `VisibilitySystem`。不接 `EncounterNarration`。不刷玩家、不刷会走的甲（色块标巡逻路点）。乙/丙/丁走出击同一套宿主（只画）。换种子 / 锁锚 / 点生成必须 destroy 再 create 宿主；只改污染画法时宿主钉在同一张岛上。**迭代 6：** 本课是碎片配色 / 世界美术的验证面（无迷雾、与出击同一套烤漆）。禁止为练习场另写第二套 `deriveContamRamp`。合同 `docs/tasks/iteration-6.md`。
9. 污染句法（`?lesson=lexicon`）：固定观察院子，不是生成岛。玩家走出击 `Player`，默认无敌（「感受伤害」可关无敌）。侧栏按**渲染方案** / **碎片身份** / 孔谱 / 覆盖深度 / 基体 / 连续性 / 词素 / 成句 / 数量配表，点生成清场再刷。甲走出击 `AISystem` / `Enemy` / `CombatSystem`（感知为听噪时刷改写体剖面，否则刷渗透体剖面——碰撞与 AI 仍如此；候选渲染器按完整 `ContaminationForm` 画皮）。乙丙丁走出击同一套宿主，接战斗与混乱。击杀后约 0.8 秒按**当前**侧栏配置再刷。不开迷雾、不接遭遇识别旁白。`AISystem.create` 对本课关闭「恰好 1 个改写体」出击配额。渲染方案下拉：A/B/C 冻结对照，默认 D。生产 D 住 `src/entities/form-renderers/`（I3-B）。宿主游荡只在本课打开活机制；地图课不得打开该开关。合同：`docs/tasks/iteration-3.md`。
10. 污染句法陈列馆（`?lesson=lexicon-gallery`）：目录课，不是观察院子。一次只进一个厅（孔谱 × 基体），陈列方案 D 下视觉不同的标本。不刷玩家、不创建 `Enemy` / `ContaminationHostSystem`。碎片是全局开关，不是网格轴。必须复用生产 `d-mixed` 的乙丙丁；**甲在迭代 5 I5-J 前走基因谱模块**（仍登记为方案 D 甲章，禁止新开渲染方案下拉）。视口虚拟化；与视野相交的格子必须挂上（DEC-086）。开发标签走 DOM，头上无字。合同：`docs/tasks/iteration-4.md`；甲基因谱合同 `docs/tasks/iteration-5.md`。

---

## 当前课

### 敌人移动（默认）

封闭一圈墙的院子（18×12 格）。每种现行敌人一只，沿 8 个路点环巡逻。环的相邻点依次是东、东南、南、西南、西、西北、北、东北，逼寻路走出斜向，而不是只沿矩形边。

为了看清身体和朝向：视野回调恒为 1（出击里由玩家视锥决定）；玩家诱饵放在地图外，感知填不满，保持巡逻、不会追击。路点停留时间走 `WAYPOINT_PAUSE_MS`，与出击默认相同。相机缩放走 `CAMERA.ZOOM`（1.5）。

侧栏「已走过的朝向」按物理速度落入的 45° 扇区点亮，用来确认八向都走到了。青绿小方块是路点，只画在练习场里。

地面用占位地砖（出击里地砖层是隐的、改画程序化地表）。**敌人**与出击是同一套程序像素（DEC-066，不是待换的精灵表）：朝向、指示点、改写体残影、步态帧、青绿脱落尘、木偶步。渗透体画布 32×32（碰撞仍 20）。身体 GameObject 的 rotation 必须恒为 0；四向贴图必须直立（头在上）。走路应看到顿一步再突然迈（改写体青绿团会左右错一点，身体允许裂开）；路点转向应有短滞后剪影。练习场若检测到非零 rotation 会把顶栏写成错误。脱落尘从身体往外、往下飘，不是玩家灯尘；迈步那一拍会多爆几粒。改写体脚下有极淡青绿污斑。本课诱饵在场外，只看得到巡逻密度的尘。

### 玩家外形（`?lesson=player`）

院子里一个假人绕矩形走，角上短停。外形是方案 1：加厚工业像素（侧影加厚、配色略暖）+ 方案 3 留下的灯尘，**与出击 `Player` 同一套**（DEC-068）。北墙站住的渗透体与改写体是出击像素，只对照体量。这课没有键盘操作，也不把假人当 AI 诱饵。对照清单见 `docs/art/actor-pixels.md`。

### 污染句法（`?lesson=lexicon`）

人要试这次实现的敌人生成系统时走这一课，不要走默认院子，也不要走地图课。场地是一张固定观察院子（有遮挡墙、乙的墙缘、丙的簇核格、丁的走廊盒），玩家角色在场，无敌。相机跟随玩家，按出击缩放。

侧栏是开发配置表（不是游戏内界面）：**渲染方案**（`#gym-lex-renderer`，默认方案 D；A/B/C 文案带「对照（已冻结）」）、**碎片身份**（`#gym-lex-fragment`，五选一，默认医院实验室 `frag-clinic`；换选项只重铺院子墙/地 bias 着色，不换成生成岛）、孔谱、覆盖深度、基体、连续性、运动 / 感知 / 节律 / 接触、成句、数量、**感受伤害**（`#gym-lex-feel-hit`，默认关＝`setGodMode(true)`）。选项来自污染句法 CSV；渲染方案下拉照抄地图课 `#gym-contam-draw`。点「生成」按表单组 `ContaminationForm`，清掉场上实体再 spawn。甲走巡逻环；乙钉墙缘（`liveMotion` 时核在墙-地缝上，沿有序墙皮游荡，抽打格跟着核走）；丙钉簇核格；丁钉走廊盒（随风/拖尾会缓慢飘并微形变，固着只形变；危险区用当前盒）。接触词素在本课按对照表兑现。击杀后按侧栏**此刻**的配置再刷，不是按第一次生成的快照。

**渲染方案：** `现行占位` = 两种程序像素 + 乙丙丁几何块（默认敌人课仍用）。`方案 A/B/C` = 第一轮对照（已冻结，禁止再改）。`方案 D` = 混装生产语法（甲走 A、丙走 B、乙丁在 B 方向重做），默认选项；出击接线见迭代 3。切换方案只换视觉层，不改碰撞。句法课与出击活机制走 `liveMotion`。地图课不得打开该开关。

移动、视锥 / 听噪、挥击、邻格抽打、踩踏混乱、体积场与出击同一套系统。接触词素按对照表兑现「它怎么伤你」；止损（能不能扣核）从连续性 × 覆盖深度查表，句法课与出击 `liveMotion` 同一套读取。接触下拉不再有打核驱散。不开视野迷雾（为了观察），但遮挡墙仍挡敌人视线。不接遭遇识别旁白。

### 地图生成（`?lesson=map`）

侧栏选风格锚、种子、邻域抖动、污染年龄、残破度，点「生成新地图」。默认三项按种子抽、抖动开，调用与出击相同的 `generateRiftLayout(seed)`。锁参数时走同一函数的可选 `RiftLayoutOptions`，不换生成器。

每次烤完新岛（换种子 / 锁锚 / 点生成）会 destroy 再 create 出击同一套 `ContaminationHostSystem`：乙缝核、丙簇核、丁走廊体积。`create` 不传战斗与混乱系统，**不传 `liveMotion`**，可见性恒为 1，只画不结算。甲不刷会走的敌人，色块标 `layout.enemySpawns` 巡逻出生与路点。侧栏抽卡一行列孔谱只数：甲走色块计数，乙丙丁走 `hosts.getLastDraw().forms`（禁止再跑一遍 `drawSortie`）。不开 `VisibilitySystem`，不接 `EncounterNarration`，不刷玩家。只改污染画法会重烤同一张图，宿主钉在该岛上。

**污染画法：** 出击与练习场生产缺省都是崩坏簇（`cluster`），并叠同一套活层（DEC-070 画面锁，DEC-071 接到出击）：内核烤死，中间层与外层同一相位、几乎不透明，沿簇外沿整团胀缩（幅度为团大小的 5–20%）。侧栏另三种（接缝晶结、坏格溶蚀、平涂错误块）只是对照，不接出击。改选项会重烤**同一张图**，不重新生成岛。对照请把污染年龄锁成「古」。换风格锚看配色是否跟着地图走。四档污染色须互不相同且离开该岛地板色。

| 值 | 读成 |
| -- | -- |
| 方案一 崩坏簇 | 出击与练习场默认。椭圆/缺角/条状抹痕的活团；色相从该岛地板/墙 bias 公式推到青绿轴，再量化到已锁色板。练习场看整团胀缩，不是旋转的花，也不是整团淡入淡出 |
| 方案二 接缝晶结 | 仅练习场对照。沿墙/虚空接缝漏一线，交点结成小十字晶 |
| 方案三 坏格溶蚀 | 仅练习场对照。整格地砖从一角表征失败，棋盘抖动，半边还留着地面 |
| 平涂错误块 | 仅练习场对照用。不是出击现行 |

可见层是出击那套程序化地表（地面烤死，天空影循环）。不开视野迷雾。相机默认框住整岛；拖动画布平移，滚轮缩放。色块标出生 / 撤离 / 薪柴 / 污染物 / 甲巡逻路点，不是可交互实体，也不是会走的甲。青绿缝核/簇核与走廊半透明块是出击同一套宿主。

### 污染句法陈列馆（`?lesson=lexicon-gallery`）

人要对照「方案 D 究竟能长成多少种不一样」时走这一课，不要走句法观察院子，也不要走地图课。这是开发目录，不是关卡。

侧栏是馆藏目录（开发说明，不是游戏内界面）：碎片身份全局开关、去重说明（本厅 N / 占格字段 / 不占格字段）、按孔谱列出基体。一次只打开一个厅（一张孔谱 × 一种基体）。厅内按覆盖深度分排。拖动画布平移。滚轮上下看，Shift+滚轮左右看，Ctrl 或 Cmd+滚轮缩放（地图课仍是滚轮缩放，行为未改）。点格看参数（表名与档位分行）；点开检视才让那一只活起来（四朝向、信号相）。

标本走生产方案 D（`src/entities/form-renderers/`），手工合成 pose，不创建 `Enemy`、不创建宿主、不刷玩家。不开迷雾，不接旁白。头上无字；开发标签是 DOM。禁止为陈列馆另写第三套方案。迭代 5：甲在 I5-J 前挂基因谱模块（仍是方案 D 甲章）；乙丙丁仍走现行 `d-mixed`。与视野相交的格子必须挂上（DEC-086）。合同：`docs/tasks/iteration-4.md`；甲基因谱 `docs/tasks/iteration-5.md`。

---

## 以后加课

在 `GymScene` 旁加新场景，用 URL 查询串切换课（已有 `gym.html?lesson=player`、`?lesson=map`、`?lesson=lexicon`、`?lesson=lexicon-gallery`）。新课同样必须复用正式系统。把课名写进本文件「当前课」。
