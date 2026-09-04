---
status: ACTIVE
purpose: 开发练习场（gym）的 Agent 入口。人要看敌人怎么走、agent 要加一种演示，都先读本文。
---

# 开发练习场

独立 HTML，用来体验和测试**与出击同一套代码**的基本功能。不是裂隙关卡，不进主菜单。**污染句法课**是观察院子：玩家在场且默认无敌（可开「感受伤害」），侧栏按维度配表后点生成，敌人与出击同一套移动 / 感知 / 攻击；击杀后按当前配置再刷。**迭代 3（DEC-084）COMPLETE（2026-08-28，人试玩裂隙 PASS）：** 生产方案 D 已接到裂隙；句法课仍可切渲染方案。A/B/C 冻结为对照；默认方案 D。合同：`docs/tasks/iteration-3.md`。**迭代 4（DEC-085）COMPLETE（2026-08-28，人再滚甲大厅 PASS）：** 陈列馆课 `?lesson=lexicon-gallery`，只挂方案 D，合同 `docs/tasks/iteration-4.md`。**迭代 5（DEC-087 / DEC-088）：** 甲外形基因谱先在练习场挂新模块，I5-J 已升出击默认占地绘制；街具残骸已翻出击；**I5-T 三种生物（虫 / 哺乳动物 / 大号蠕虫）已翻出击**；灯柱 / 栏柱仍 gym。合同 `docs/tasks/iteration-5.md`。设计正文 `docs/design-notes/contamination-form-genome.md`。**迭代 6（DEC-088 / DEC-089 / DEC-090 / DEC-093 / DEC-094）：** 碎片配色 / 世界美术验地面走地图课（与出击同一套烤地；I6-A 已交，四张一起标定；身份靠渍/纹理/结构，不靠底色落格；先等价再拆档）。合同 `docs/tasks/iteration-6.md`。地图课框住整岛，甲只是色块，且不得打开出击活机制。练习场敌人课（默认院子）复用出击 `Enemy`（含 `getForm`），不另写移动或外形。遭遇识别旁白默认不开。

**打开：** `npm run gym` 或 `npm run dev`，再用 Cursor 的 Simple Browser 打开对应地址。不要用系统浏览器。

| 课 | 地址 |
| -- | -- |
| 污染句法 | `http://localhost:3000/gym.html?lesson=lexicon` |
| 油膜脉络抽卡 | `http://localhost:3000/gym.html?lesson=paint-vein-card`（历史对照课） |
| 供奉台抽卡 | `http://localhost:3001/gym.html?lesson=offering-card`（六卡两行三列，键 1–6 高亮；45° 等距，放大 6×；**底是出击同一份净化点混凝土**；生产默认仍呼吸圆点）。上排 = 第一轮，按收容手段拆：A 压钳 / B 笼斗 / C 浇墩——人否掉，三张是同一句形体（实心方块 + 前左面开洞），区分度低。下排 = 第二轮，按**形体类**拆：D 举出（横向外伸）/ E 抱箍（竖向细高）/ F 压槽（贴地矮宽）。轴为什么换见 `docs/design-notes/offering-stand-identity.md` 第 3 节 |
| 裂隙入口对照 | `http://localhost:3001/gym.html?lesson=rift-entrance-card`（两卡并排：卡 4 地缝 = 生产默认，卡 5 击裂 = 对照；键 4 / 5 高亮；都画在地面平面内、是贴花；6fps；**底是出击同一份净化点混凝土，不是纯黑**。`npm run gym` 常见端口 3001，3000 常被 `npm run dev` 占用） |
| 污染句法陈列馆 | `http://localhost:3000/gym.html?lesson=lexicon-gallery` |
| 敌人移动 | `http://localhost:3000/gym.html` |
| 玩家外形 | `http://localhost:3000/gym.html?lesson=player` |
| 地图生成 | `http://localhost:3000/gym.html?lesson=map` |

**代码：** `gym.html` → `src/gym/main.ts` → `GymBootScene` → `GymScene` / `GymPlayerScene` / `GymMapScene` / `GymLexiconScene` / `GymLexiconGalleryScene` / `GymPaintVeinCardScene` / `GymRiftEntranceCardScene`。场地：`src/gym/arena.ts`（敌人 / 玩家课）、`src/gym/gym-lexicon-arena.ts`（污染句法观察院子）。地图课走出击 `generateRiftLayout`。污染句法课不走生成岛。陈列馆不走院子、不刷玩家与敌人，只 attach 生产方案 D。油膜脉络抽卡课不走院子、不刷玩家与敌人，六格打开即挂 `attachBingPaintGenome`。裂隙入口对照课不走院子、不刷玩家，两卡并排播生产同一份入口图集（`src/scenes/rift-entrance-visual.ts`）；生产默认 = 卡 4 地缝地面贴花（DEC-113）。句法课对照 A/B/C 仍在 `src/gym/form-renderers/`；生产方案 D 住 `src/entities/form-renderers/`。禁止 `RiftScene` import `src/gym/**`。合同：迭代 4 陈列馆见 `docs/tasks/iteration-4.md`；迭代 5 甲基因谱见 `docs/tasks/iteration-5.md`（句法课 / 陈列馆甲走 `d/genome/`；出击 `d-mixed` 占地走同一份 `attachJiaGenomeD`。**I5-J：** 街具残骸已翻出击。**I5-T：** 虫 / 哺乳动物 / 大号蠕虫已翻出击。灯柱 / 栏柱仍 gym。地图课走同一份 `drawSortie`，侧栏会看见。句法课 / 陈列馆厅与下拉本批不改。）；迭代 6 地面配色见 `docs/tasks/iteration-6.md`（地图课即验证面，禁止另写第二套 ramp）。迭代 10 翻找抽卡课已随人终审 PASS 删课（2026-08-31，迭代 9 先例）；翻找机制与表现是生产默认，住 `src/systems/loot-search-system.ts` / `loot-search-presentation.ts` / `src/ui/dom/loot-search-hud.ts`。储藏收容抽卡课已随 DEC-112 删课；生产默认 = C1 顶压观察井，住 `purification-module.ts`。

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
8. 地图生成（`?lesson=map`）：必须调用 `generateRiftLayout`、`RiftSurfacePainter` 与 `ContaminationHostSystem`。禁止为练习场另写生成器或拷画廊 PNG。默认（风格锚按种子抽、邻域抖动开、污染年龄/残破度按种子抽）与出击路径相同。侧栏可锁锚 / 关抖动 / 覆盖两轴。不开 `VisibilitySystem`。不接 `EncounterNarration`。不刷玩家、不刷会走的甲（色块标巡逻路点）。乙/丙/丁走出击同一套宿主（只画）。换种子 / 锁锚 / 点生成必须 destroy 再 create 宿主；只改污染画法时宿主钉在同一张岛上。**DEC-104：** 生产地面不再铺氛围崩坏簇；占漆钉贪婪薪柴路径；不传整图 `liveClusterBreath`。**迭代 6：** 本课是碎片配色 / 世界美术的验证面（无迷雾、与出击同一套烤地）。禁止为练习场另写第二套 `deriveContamRamp`。合同 `docs/tasks/iteration-6.md`。
9. 污染句法（`?lesson=lexicon`）：固定观察院子，不是生成岛。玩家走出击 `Player`，默认无敌（「感受伤害」可关无敌）。侧栏按**渲染方案** / **碎片身份** / 孔谱 / 覆盖深度 / 基体 / 连续性 / 词素 / 成句 / 数量配表，点生成清场再刷。甲走出击 `AISystem` / `Enemy` / `CombatSystem`（感知为听噪时刷改写体剖面，否则刷渗透体剖面——碰撞与 AI 仍如此；候选渲染器按完整 `ContaminationForm` 画皮）。乙丙丁走出击同一套宿主，接战斗与混乱。击杀后约 0.8 秒按**当前**侧栏配置再刷。不开迷雾、不接遭遇识别旁白。`AISystem.create` 对本课关闭「恰好 1 个改写体」出击配额。渲染方案下拉：A/B/C 冻结对照，默认 D。生产 D 住 `src/entities/form-renderers/`（I3-B）。宿主游荡只在本课打开活机制；地图课不得打开该开关。**油膜默认 = 按种子采样生产三变体**（下拉仍可钉 A–F 做对照）。六格静帧历史对照走 `?lesson=paint-vein-card`，不要走句法课侧栏交差。合同：`docs/tasks/iteration-3.md`；油膜身份 DEC-101 / `docs/tasks/iteration-7.md`。
10. 污染句法陈列馆（`?lesson=lexicon-gallery`）：目录课，不是观察院子。一次只进一个厅（孔谱 × 基体），陈列方案 D 下视觉不同的标本。不刷玩家、不创建 `Enemy` / `ContaminationHostSystem`。碎片是全局开关，不是网格轴。必须复用生产 `d-mixed` 的乙丙丁；**甲在迭代 5 I5-J 前走基因谱模块**（仍登记为方案 D 甲章，禁止新开渲染方案下拉）。视口虚拟化；与视野相交的格子必须挂上（DEC-086）。点开检视才切四朝向与四个信号相。**基因谱甲必须消费 `pose.facing4` / `pose.signal`**（I5-N / DEC-098）：切北/东/南/西身子要变；idle 与 strike 至少要分。陈列馆控件已通；截至 I5-F，基因谱挂载不消费这两字段（只烤一张静剪影 + 固着同一套呼吸）。I5-N 未交之前不要开 I5-G。**油膜按三变体分入口钉读法**（聚珠成滩 / 沾抹拖尾 / 薄滩收边；策划表仍一行 `oil_film`；对照哺乳动物邻域四入口）。开发标签走 DOM，头上无字。合同：`docs/tasks/iteration-4.md`；甲基因谱合同 `docs/tasks/iteration-5.md`；油膜三入口 DEC-101 / `docs/tasks/iteration-7.md`。
11. 油膜脉络抽卡（`?lesson=paint-vein-card`）：**历史对照课。** A/B/C 是树参数 tweak；D/E/F 是已被 DEC-101 锁定为生产的三支原形。打开必须六格都在画面上（两行三列），挂 `attachBingPaintGenome`（`paintVeinVariant` 0–5，`displayScale` 2），同一颗种子、同一改写档、油膜。第一轮 A/B/C 抽卡模型 cursor-grok-4.6-xhigh-fast；第二轮 D/E/F 抽卡模型 kimi-k3；模型名标在每格卡片上。不要走句法课侧栏。课本身不删。生产油膜不采样 0/1/2。禁止 import `d/genome`。本课画布列可随窗口变窄；滚轮缩放抽卡区域，拖动平移。合同：`docs/tasks/iteration-7.md`。
12. 裂隙入口对照（`?lesson=rift-entrance-card`）：外形对照课，不是机制抽卡。**抽卡已结案（DEC-113）**：入口在地面上，生产默认 = 卡 4 地缝；卡 5 击裂留作对照。落选的墙上三张与卡 6 囚笼已整支删除。两卡并排、6fps 八帧循环、放大约 4×，键 4 / 5 高亮。两张都画在地面平面内，是贴花（锚点中心、depth 1，玩家能踩过去）。底是出击同一份净化点混凝土（`createPurificationFloorTexture`），不是纯黑——纯黑会把任何不透明外沿看成描边。复用 `src/scenes/rift-entrance-visual.ts` 的图集常量与加载。不刷玩家、不走出击、不进主菜单。这里换卡不改生产默认。贴图未到时写「图未到」，禁止用占位方块冒充卡面。不开迭代 11。

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

人要试这次实现的敌人生成系统时走这一课，不要走默认院子，也不要走地图课。场地是一张固定观察院子（有遮挡墙、乙的墙缘、丙的占漆钉格、丁的走廊盒），玩家角色在场，无敌。相机默认框住院子；拖动画布平移，滚轮缩放（`bindGymCamera`）。点生成后把相机框到刚刷的实体。**油膜默认按种子采样生产三变体**；下拉仍可钉 A–F。六格静帧历史对照走 `?lesson=paint-vein-card`。

**2026-08-27 滚动 / 生成不可见：** 侧栏控件把栅格行撑高后，右侧 `#game-container` 的 `overflow: auto` + flex 居中会把 FIT 画布挤到视野外，滚轮又被容器抢走，看起来像「不能滚动、点生成后画面空」。已把练习场两栏锁在视口高度内（侧栏自己滚），句法课绑定练习场相机，生成后框到刚刷的实体。

侧栏是开发配置表（不是游戏内界面）：**渲染方案**（`#gym-lex-renderer`，默认方案 D；A/B/C 文案带「对照（已冻结）」）、**碎片身份**（`#gym-lex-fragment`，五选一，默认医院实验室 `frag-clinic`；换选项只重铺院子墙/地 bias 着色，不换成生成岛）、孔谱、覆盖深度、基体、连续性、运动 / 感知 / 节律 / 接触、成句、数量、**油膜脉络（开发）**下拉（`#gym-lex-paint-vein`，仅占漆+油膜；**默认「按种子采样（生产）」**；仍可钉 A–F，含 D 聚珠 / E 沾抹 / F 薄滩）、**感受伤害**（`#gym-lex-feel-hit`，默认关＝`setGodMode(true)`）。选项来自污染句法 CSV；渲染方案下拉照抄地图课 `#gym-contam-draw`。点「生成」按表单组 `ContaminationForm`，清掉场上实体再 spawn。甲走巡逻环；乙钉墙缘（`liveMotion` 时核在墙-地缝上，沿有序墙皮游荡，抽打格跟着核走）；丙钉占漆格（实现旧名簇核格，I8-G 改口；院子不垫氛围簇烤地）；丁钉走廊盒（随风/拖尾会缓慢飘并微形变，固着只形变；危险区用当前盒）。接触词素在本课按对照表兑现。击杀后按侧栏**此刻**的配置再刷，不是按第一次生成的快照。

**渲染方案：** `现行占位` = 两种程序像素 + 乙丙丁几何块（默认敌人课仍用）。`方案 A/B/C` = 第一轮对照（已冻结，禁止再改）。`方案 D` = 混装生产语法（甲走 A、丙走 B、乙丁在 B 方向重做），默认选项；出击接线见迭代 3。切换方案只换视觉层，不改碰撞。句法课与出击活机制走 `liveMotion`。地图课不得打开该开关。

移动、视锥 / 听噪、挥击、邻格抽打、踩踏混乱、体积场与出击同一套系统。接触词素按对照表兑现「它怎么伤你」；止损（能不能扣核）从连续性 × 覆盖深度查表，句法课与出击 `liveMotion` 同一套读取。接触下拉不再有打核驱散。不开视野迷雾（为了观察），但遮挡墙仍挡敌人视线。不接遭遇识别旁白。

### 裂隙入口对照（`?lesson=rift-entrance-card`）

外形对照课。身份已锁「伤口渗漏，不是门」；**入口在地面上，不在墙上**，且不显式呈现那边是什么。

**抽卡已结案（DEC-113）：** 生产默认 = **卡 4 地缝**（地面上一道中间粗两边细的裂缝，缝深处一条丝在走）。**卡 5 击裂**（由受击点向外辐射，像钢化玻璃）留作对照。落选的墙上三张与卡 6 囚笼已整支删除，生成器只留 `gen/rift_entrance_ground.py`。

打开 `http://localhost:3001/gym.html?lesson=rift-entrance-card`（`npm run gym` 常见端口 3001；3000 常被 `npm run dev` 占用）即播八帧循环、每秒六帧，放大约 4×，键 4 / 5 高亮对应卡。

**两张都画在地面平面内**（与净化点混凝土同一平面，顶视），所以是贴花：锚点取中心、depth 1（地板 0 / 读数桩 20 / 玩家 30），玩家能踩过去。地面上的缝按向下俯视 10° 画会被压成几乎看不见，所以不能用那套相机。已锁三台装置仍是 45° 等距，本课不动它们。

**底是出击同一份净化点混凝土**（`createPurificationFloorTexture`，与卡面同样放大 4×），不是纯黑——纯黑会把任何不透明外沿都看成描边。声明见 `.cursor/skills/pixel-models/SKILL.md` 画法定律第 9 条。

不刷玩家、不走出击、不进主菜单。这里换卡不改生产默认。实地看走净化点 `#purif`（默认就是卡 4；`?entrance=5` 或场景内键 4/5 切对照）。贴图未到时该格写「图未到」，不要用占位方块冒充卡面。开发 UI，不是游戏内界面。不开迭代 11。

### 油膜脉络抽卡（`?lesson=paint-vein-card`）

**历史对照课：A/B/C 树 tweak + 已被 DEC-101 锁定为生产的三支原形（D 聚珠成滩 / E 沾抹拖尾 / F 薄滩收边）。课不删。** 不要走句法观察院子，也不要当陈列馆目录用。打开 `http://localhost:3000/gym.html?lesson=paint-vein-card` **必须六格都在画面上**，两行三列：第一轮 A 更扁更贴地 / B 更亮膜感 / C 更汇流（抽卡模型 cursor-grok-4.6-xhigh-fast，树参数 tweak），第二轮 D/E/F（抽卡模型 kimi-k3，从「油膜做污染体基底」原初 idea 重推，不是树 tweak），模型名标在每格卡片下。同一颗种子（1000）、同一覆盖档（改写）、基体油膜、连续性菌落。不刷玩家、不创建 `Enemy` / 宿主。本课右侧窗格可随窗口变窄，Phaser FIT 把整幅 960 缩进可见列；**滚轮缩放抽卡区域**，拖动画布平移。生产油膜不采样 0/1/2。开发 UI，不是游戏内界面。合同：`docs/tasks/iteration-7.md`。

### 地图生成（`?lesson=map`）

侧栏选风格锚、种子、邻域抖动、污染年龄、残破度，点「生成新地图」。默认三项按种子抽、抖动开，调用与出击相同的 `generateRiftLayout(seed)`。锁参数时走同一函数的可选 `RiftLayoutOptions`，不换生成器。

每次烤完新岛（换种子 / 锁锚 / 点生成）会 destroy 再 create 出击同一套 `ContaminationHostSystem`：乙缝核、丙占漆、丁走廊体积。`create` 不传战斗与混乱系统，**不传 `liveMotion`**，可见性恒为 1，只画不结算。甲不刷会走的敌人，色块标 `layout.enemySpawns` 巡逻出生与路点。侧栏抽卡一行列孔谱只数：甲走色块计数，乙丙丁走 `hosts.getLastDraw().forms`（禁止再跑一遍 `drawSortie`）。不开 `VisibilitySystem`，不接 `EncounterNarration`，不刷玩家。只改污染画法会重烤同一张图，宿主钉在该岛上。

**污染画法：** 出击与练习场生产地面**不再**铺氛围崩坏簇（DEC-104）。看得见的成片青绿是有主占漆。活层技术保留，应用改为占漆宿主呼吸。侧栏另三种（接缝晶结、坏格溶蚀、平涂错误块）只是对照，不接出击，也不得填回生产。改选项会重烤**同一张图**，不重新生成岛。对照请把污染年龄锁成「古」。换风格锚看配色是否跟着地图走。四档污染色须互不相同且离开该岛地板色。

| 值 | 读成 |
| -- | -- |
| （生产）无氛围簇 | 出击与练习场默认。地面是 L1 渍/纹理/残破；青绿来自钉在贪婪薪柴路径上的占漆宿主 |
| 方案二 接缝晶结 | 仅练习场对照。沿墙/虚空接缝漏一线，交点结成小十字晶 |
| 方案三 坏格溶蚀 | 仅练习场对照。整格地砖从一角表征失败，棋盘抖动，半边还留着地面 |
| 平涂错误块 | 仅练习场对照用。不是出击现行 |

可见层是出击那套程序化地表（地面烤死，天空影循环）。不开视野迷雾。相机默认框住整岛；拖动画布平移，滚轮缩放。色块标出生 / 撤离 / 薪柴 / 污染物 / 甲巡逻路点，不是可交互实体，也不是会走的甲。青绿缝核/占漆与走廊半透明块是出击同一套宿主。

### 污染句法陈列馆（`?lesson=lexicon-gallery`）

人要对照「方案 D 究竟能长成多少种不一样」时走这一课，不要走句法观察院子，也不要走地图课。这是开发目录，不是关卡。

侧栏是馆藏目录（开发说明，不是游戏内界面）：碎片身份全局开关、去重说明（本厅 N / 占格字段 / 不占格字段）、按孔谱列出基体。一次只打开一个厅（一张孔谱 × 一种基体）。厅内按覆盖深度分排。拖动画布或画布外侧空白平移；本课不让右侧容器自己出滚动条。滚轮上下看，Shift+滚轮左右看，Ctrl 或 Cmd+滚轮缩放（地图课仍是滚轮缩放，行为未改）。点格看参数（表名与档位分行）；点开检视才让那一只活起来（四朝向、信号相）。**基因谱甲必须消费这些字段**（`pose.facing4` / `pose.signal`；I5-N / DEC-098）。陈列馆控件已通；截至 I5-F 基因谱挂载不消费，切朝向身子不变、四个信号相同一套动画。I5-N 未交之前不要开 I5-G。

标本走生产方案 D（`src/entities/form-renderers/`），手工合成 pose，不创建 `Enemy`、不创建宿主、不刷玩家。不开迷雾，不接旁白。头上无字；开发标签是 DOM。禁止为陈列馆另写第三套方案。迭代 5：占地挂基因谱模块（仍是方案 D 占地章）。**看占漆拓扑：** 陈列馆看菌毯实心多瓣团、**油膜三入口（聚珠成滩 / 沾抹拖尾 / 薄滩收边）**、灰幕环/薄覆层；同厅格子再看覆盖违规、感知主轴、节律忙静、连续性单团对菌落卫星（不要指望成句/止损改剪影）；点开检视看沿生长方向有节奏地缓慢扩散、收缩（油膜按变体呼吸），不是整张画布拉伸，也不是切预烤帧，厅内浏览仍静帧。句法课方案 D、孔谱占漆，切覆盖 / 感知 / 节律 / 连续性必须看见差。油膜默认按种子采样；钉变体走句法课下拉。**六格静帧历史对照走 `?lesson=paint-vein-card`。** 练习场侧栏仍是开发 UI。与视野相交的格子必须挂上（DEC-086）。合同：`docs/tasks/iteration-4.md`；占地基因谱 `docs/tasks/iteration-5.md`；油膜 DEC-101 / `docs/tasks/iteration-7.md`。

### 翻找（`?lesson=loot-card`）

**已删课（2026-08-31，人终审 PASS，迭代 9 先例）。** 翻找机制与表现是出击生产默认：翻堆对象（外观不泄露内容物，配色 v2 随碎片身份）+ 按住 E 读条 1200ms（底部装置条）+ 打断清零 + 揭晓（薪柴右上 +N / 残渣 toast-inline 星等）+ 音效四键。生产实现住 `src/systems/loot-search-system.ts` / `src/systems/loot-search-presentation.ts` / `src/ui/dom/loot-search-hud.ts`。合同与终审记录：`docs/tasks/iteration-10.md`。

---

## 以后加课

在 `GymScene` 旁加新场景，用 URL 查询串切换课（已有 `gym.html?lesson=player`、`?lesson=map`、`?lesson=lexicon`、`?lesson=lexicon-gallery`、`?lesson=paint-vein-card`、`?lesson=rift-entrance-card`）。新课同样必须复用正式系统。把课名写进本文件「当前课」。
