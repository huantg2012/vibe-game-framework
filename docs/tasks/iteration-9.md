---
status: ACTIVE
created-by: director agent
created-when: 2026-08-28
last-modified: 2026-08-29
note: 迭代 9（rift 视野表现打磨）**进行中**（2026-08-28 立项，DEC-105）。纯表现层：迷雾遮罩质感 / 三档渐变带过渡 / 手电与暖光光池读法。不动射程 / 锥角 / 三档数值 / 规则 4 朝向 / 薪柴不发光 / 混乱缩放；不动相机；不加迷雾外信息。art 路径，人终审画面。活指针仍在迭代 5。不要开 I5-C。不要标迭代 5 COMPLETE。
---

# Tasks: 迭代 9 — rift 视野表现打磨（DEC-105）

权威：`docs/progress/current-iteration.md`。视野规则：`docs/specs/system-movement-vision.md`。混乱调制取值：`docs/specs/system-chaos-scavenge-extract.md`。美术方向：`docs/art-direction.md`。实现：`src/systems/visibility-system.ts`。

**对人说话：** 用「rift 视野表现打磨」。禁止说成「视野系统重做」「视野规则调整」——规则一个都不动。

**立项：** 人 2026-08-28 就「rift 关卡内玩家视野优化」拍方向 **(c) 纯表现层打磨**——迷雾质感、渐变带、手电光束读法，走 art 路径，**不动规则**。迷雾下亮度已于同日前批人终审 PASS；本包是在过的基础上**提质**，不是推翻。

**收尾合法态：** 三件范围的画面读法提质，人终审画面 PASS；规则与数值 diff 为空；现有机器闸门全绿；性能预算（静止缓存、2ms 降级）不破。

---

# 范围（做三件）

| # | 件 | 打磨对象 | 目标读法 |
| - | -- | -------- | -------- |
| 1 | 迷雾遮罩质感 | 视野外 void-black(#080a0c) + 4% 噪点（`ensureNoiseTexture` 平铺 TileSprite + 慢滚动） | 「那里有空间，只是看不见」，不读作「没加载完」，也不读作「电视雪花」 |
| 2 | 三档渐变带过渡 | 可见度 1.0 / 0.6 / 0.2 三条固定带宽边缘带（规则 15）的带边界像素过渡 | 带与带之间不读成「同心圆色带」；spec 待验证假设已挂的最小代价方案 = 带边界 1–2px dither，优先走这条 |
| 3 | 光池读法 | 手电光束（`drawFlashlight`：暖色 ADD 光池沿朝向前推，被遮罩锥形孔剪成光束）与玩家暖光（`drawLamp`：环身 360° 暖池） | 前向锥读作「有方向的照亮」，不只是「前方被揭示」；暖光仍是裂隙唯一暖色（art §2.3 规则 4 不破） |

# 不做什么（红线）

- **不调射程**：`VISION_RADIUS_FORWARD` 224 / `VISION_RADIUS_AMBIENT` 80 不动。
- **不调锥角**：`VISION_CONE_HALF_ANGLE` 50° / `VISION_CONE_FALLOFF_ANGLE` 30° 不动。
- **不动三档数值**：`VISION_BAND_ALPHAS` [1.00, 0.60, 0.20]、`ERASE_ALPHAS`、`VISION_EDGE_BAND_WIDTH` 32 不动。
- **不动规则 4**：`system-movement-vision` 规则 4（朝向 = 最近一次非零输入方向，键盘-only；DEC-008）不动。手电读法打磨不得变成「鼠标瞄准手电」或任何形式的独立转向。
- **薪柴不发光**：规则 19 不动——薪柴仍不是 glow source；本包禁止给任何视野外对象加可见性。
- **混乱缩放不动**：`getChaosModulators` 与 `radiusScale` / `edgeCorruption` / `screenFlicker` 的取值映射不动；teal 渗透、边缘抖动、全屏跳变的触发与强度不动。
- **不加迷雾外信息**：不新增 glow source；不让敌人 / 薪柴 / 任何实体在视野外变得可见；小地图揭示规则不动。
- **不动相机**：zoom 1.5（DEC-009）、视口、letterbox 均不动。
- **逻辑与渲染一致不破**（规则 23）：`getVisibilityAt` 返回的 0 / 0.2 / 0.6 / 1.0 仍是「玩家能不能看见」的唯一答案；渲染打磨不得让画面与查询结果分叉。
- **性能预算不破**：静止缓存（规则 20）与两级降级（规则 21：60→40 光线、隔帧更新；`BUDGET_MS` 2ms）保持；禁止在 update / render 路径引入每帧分配。
- **数值要动就回人**：art 若判断不动任何 constants 数值就达不到审美线，列出数值清单回人拍板；禁止 code 私改 constants。
- 不开 I5-C。不标迭代 5 COMPLETE。不塞进迭代 5 / 7 / 8。练习场地图课不开视野迷雾，本包验证在出击（裂隙）；禁止为练习场另做一套视野表现。**例外（2026-08-28 晚，人下令）：** 人就「圆-锥衔接突兀 / 边界太硬」两条体验反馈下令「几个方案都做一下放到 gym 里我看看，要带动效，模拟实际帧率」——开抽卡对照课 `?lesson=vision-lab`。它不是「另做一套视野表现」：布局 / 地表 / 玩家 / 相机 / `VisibilitySystem` 全是出击同一套，渲染模式作为 spike 分支住在生产 `VisibilitySystem` 内（`setMaskStyle` / `setCorruptionEdge`；第一轮四种，第二轮加时序抖动 / 光场强度双档 / teal 软内缘 v2（波 3.6），第三轮修光场远处黑边（360° 墙截模板 + 着陆窗）与 teal 软内缘 v3 黑中长尾（波 3.7），第四轮 teal v4 光场联动（等亮度线前锋 + 降浓降亮，波 3.8），第五轮 teal v5 侵蚀层 F1/F2/F3（尾巴不过墙 / 视野多边形裁剪 / 前锋角度平滑，波 3.9）），出击默认仍是 `bands` + 硬内缘；人抽完拍板后才把选中分支翻成出击默认并下线其余分支。

---

# 实现事实（`src/systems/visibility-system.ts`，I9-G 后当前真相）

- **遮罩**：世界空间 RenderTexture（camera 视野 + 2 tile 外扩，世界分辨率），depth 50（`createRiftVisionConfig(depth = 50)`）。每帧 `fill(voidColor)` 后三次 `erase`（`ERASE_ALPHAS`），复合剩余暗度 0.80 / 0.40 / 0 → 可见度 0.20 / 0.60 / 1.00。
- **噪点**：`ensureNoiseTexture` 生成 64px 可平铺双八度颗粒（2×2 成团 × 覆盖率 0.58 + 8×8 团块，冷偏），TileSprite alpha = `VOID_NOISE_ALPHA` 0.04，X 滚动 2 px/s、Y 为加速后速度的 0.6×；`setExtractionPosition` 近撤离点滚动加速（≤5 tile 全效，≥40 tile 无效）。
- **暖光**：`drawLamp`——depth 49（遮罩之下），ADD 混合，直径 = 环身射程 ×2，被视野边界切掉。径向 stops 为热核平台 + 快速中段衰减 + 长低尾巴（0/0.25/0.5/0.75/1 → 1/0.9/0.45/0.18/0）。
- **手电**：`drawFlashlight`——depth 49，ADD，沿朝向前推 `FLASHLIGHT_FORWARD_FRAC`，直径 = 前向射程 ×2× `FLASHLIGHT_RADIUS_FRAC`，再按朝向椭圆拉伸 1.15 × 0.87；被遮罩锥形孔剪成光束。`ensureFlashlightTexture` stops 0/0.18/0.42/0.7/1 → 1/0.82/0.5/0.24/0。
- **带边界 dither**：三层实擦多边形在射程边上收缩 1px；沿未收缩轮廓描 2px 环，用预生成 2×2 棋盘经 scratch RT erase 打孔后再擦进遮罩。墙截断硬边不抖。棋盘相位钉 `maskOriginX/Y & 1`。
- **陆地裁剪**：`clipLightsToIsland` 用几何掩膜把暖光 / 手电限制在陆地格——暖色 ADD 落在虚空上会读成「外面是一片土黄」，与黑洞相反。打磨光池时这条掩膜必须保持。
- **其余层**：发光泄露 `drawGlowSources` depth 60；teal 渗透 `drawCorruption` depth 65；全屏跳变 `drawFlicker` depth 70。本包不动这三层的行为。
- **可动的表现层抓手**（不动 constants 数值的前提下）：噪点纹理的图案 / 密度 / 滚动读法；带边界的 1–2px dither；`ensureLampTexture` / `ensureFlashlightTexture` 的径向渐变形状（stops）；混合与深度的接线保持不变。

---

# 波段计划

单批上下文预算：一波 = 一次可独立完成的 agent 会话。连续 2 次不过机器闸门 → 停，升档 T1。审美与「读作游戏」人终审，agent 不代勾。

| 波 | 角色 | 任务 | 验收闸门 | 依赖 |
| -- | ---- | ---- | -------- | ---- |
| **1** | art | **I9-A** 视野表现规格：迷雾质感 / 渐变带过渡 / 光池读法三件的可执行规格（给 code 照做的纹理与像素层处方）；先 Read `.agents/skills/in-game-ux/SKILL.md`（项目内副本）并按本游戏 art-direction 填写 | 规格落在「实现事实」节的可动抓手上；每条处方写明不动哪条规则 / 哪个数值；若任何一件必须动 constants 才能达标，列数值清单回人，本批不落地 | DEC-105 已登记；**已交** |
| **2** | code | **I9-G** 按 I9-A 规格实现。只动表现层抓手；constants 数值 diff 为空 | `npx tsc --noEmit`；现有 check 全绿；`getVisibilityAt` 行为不变（逻辑渲染一致）；静止缓存与降级路径不回退 | I9-A 已交且人未否；**code 已交** 2026-08-28，画面等人终审 |
| **3** | qa | **I9-QA** 机械对照：规则 / 数值 diff 为空；红线逐条；性能预算（射线仍走缓存、无每帧分配）；闸门全绿。好看不代勾 | 报告 `docs/qa/iteration-9.md` | 波 2 已交 |
| **3.5** | code | **I9-LAB** 视野渲染对比课（2026-08-28 晚人下令）：四模式（现状 / 细分带 / 光场 / 抖动坡）× teal 三态（关 / 硬内缘 / 软内缘）进 `?lesson=vision-lab`，活帧率、WASD 可走 | `npx tsc --noEmit`；`check:vision-energy` 绿；出击默认行为 diff 为空 | 人就两条体验反馈下令抽卡；**code 已交** 2026-08-28，人已抽并给三条反馈 |
| **3.6** | code | **I9-LAB2** 第二轮抽卡（2026-08-28 深夜人下令「再来。让我再抽一轮」）：三条反馈落地——① 抖动坡 v2 时序相位（4 相 90° 旋转 Bayer 矩阵、120ms 步进，静止也活；键 4）；② 光场 v2 强度分层（暖灯 stops 整体压弱读作弱光、手电保持强光，键 3；另开 `field-dim` 灯再弱一档做强度抽卡对照，键 5）；③ teal 软内缘 v2（6→12 环正弦帐篷剖面，内缘与外缘双侧渐变、中间主峰；T 第三态） | `npx tsc --noEmit`；`check:vision-energy` / `check:layout` 绿；出击 `bands`+硬内缘路径行为不变（烤地逐像素一致 + 全量 diff 溯源为污染呼吸相位，非代码路径分叉） | 人三条反馈；**code 已交** 2026-08-28，人已抽并给两条反馈 |
| **3.7** | code | **I9-LAB3** 第三轮抽卡（2026-08-28 深夜人下令）：两条反馈落地——① 光场远处黑色硬边根因修复：探针实测模板边界处纹理 alpha 高达 0.482（θ=64°），根因是模板沿用生产锥+环轮廓（`getEffectiveRadius` 在 50°–80° 肩部把射程 224→80 渐缩）而光场纹理是可分离角度×径向衰减（肩部保持全射程），模板在亮区硬切；修复 = 模板改 128 射线 360° 全量程只负墙截断（`castFieldStencil`，同缓存节奏，行走实测 0.037ms/帧 远低于 2ms 预算）+ 纹理加 C¹ 着陆窗（`smoothLanding`，支撑边界精确归零），墙截断仍硬；② teal 软内缘 v3：12→20 环分段 smoothstep 剖面（双端精确归零且零斜率，消除 v2 最外环 13% 硬边）+ 渐变向视野外延伸 44px 长尾（绿从黑中缓缓渗出），主峰保持，触发/深度/上限/混乱缩放不动 | `npx tsc --noEmit`；`check:vision-energy` / `check:layout` 绿；出击 `bands`+硬内缘路径 diff 18px ≤ 同代码噪声底 602px（呼吸相位）；探针数据与 v5-* 前后对照截图存 `docs/art/review-2026-08-28/vision-lab/` | 人两条反馈（黑边点名「似乎并不简单」）；**code 已交** 2026-08-28，人已抽：问 1（黑边）/ 问 2（墙切仍硬）人过，teal 三条新反馈进波 3.8 |
| **3.8** | code | **I9-LAB4** 第四轮抽卡（2026-08-28 深夜人下令）：只修 teal v4，光场 v3 本体不动——① 主峰太浓太绿太亮 → soft 分支派生专用色（生产 `CORRUPTION_COLOR` 向虚空色混 40%）+ 峰值 ×0.7，constants 零改动；② 内层渐变不够平滑 → 24 环 + 内层 40px 零斜率缓升（分段 smoothstep 剖面峰位 40/88）；③ 与键 3 光场结合违反物理直觉（核心）→ 前锋不再钉几何锥+环，改钉光场等亮度线（`fieldIsoluxRadius`：每方向求光场衰减到阈值 t 的半径，与烤纹理共用同一 `fieldVisibilityAt`；手电强光顶住 182px、暖灯弱光渗到 48px 脚边，墙截断保留；混乱升高 → 阈值调高 → 前锋压向更亮处更逼近玩家，「越高越近」行为保留；阈值含既有 flicker boost）。bands / subdiv / bayer 的 teal 保持 v3 几何环不动 | `npx tsc --noEmit`；`check:vision-energy` / `check:layout` 绿；出击 `bands`+硬内缘路径 diff 42px ≤ 同代码噪声底 602px（呼吸相位）；行走射线预算 0.067ms/帧（含 128 扇形模板 + 每帧等亮度线扫描）远低于 2ms；各向异性探针数据与 v6-* 截图存 `docs/art/review-2026-08-28/vision-lab/` | 人第三轮反馈（问 1 / 问 2 已过；teal 三条）；**code 已交** 2026-08-28，等人抽 |
| **3.9** | code | **I9-LAB5** 侵蚀层 F1+F2+F3（2026-08-29，director 根因：代码无 bug，是 v4 侵蚀设计的三个缝隙）——只动 field+soft 的 `drawCorruptionIsolux`：① F1 尾巴不过墙：外缘 = `min(front + TAIL, stencilDist)`，内缘不动；② F2 侵蚀层按视野多边形裁剪：`corruptionGraphics` 挂 GeometryMask，形状 = 同一份 128 射线 360° 墙截模板（半径上限 radiusForward，比光照区大，黑中渗出尾巴读法保留）；③ F3 前锋角度平滑：128 项环形盒式模糊（半径 2、2 次）后再逐射线 `min(smoothed, stencilDist)`。F4/F5 不做（留人拍板）。根因：弱光侧前锋钉死 48px、尾巴穿墙、逐射线吸附跳变 | `npx tsc --noEmit`；`check:vision-energy` 绿；视觉：种子 777、`mode=field&teal=soft` 三类点位（开阔地 / 内部墙角 / 光束正面贴墙）侵蚀开/关差分，墙内绿像素占比 → 0；截图 `docs/art/review-2026-08-28/vision-lab/v8-*` | director 根因分析；**code 已交** 2026-08-29，F4/F5 留人拍板 |
| **3.10** | code | **I9-LAB6** VOID 挡光（虚空吞光，DEC-106）+ 侵蚀层墙面绿圈衰减（2026-08-29 人拍板）——① VOID 从「不挡光」翻转为「挡光」：`TileGrid.isOpaque` 对 WALL / VOID 均 true（唯一实现点；`grid-raycast` 只问 `isOpaque` 不动；purification-scene 自带遮挡网格不动），修「手电光场穿过地图边界墙」核心体验问题，生产 bands 与练习场 field 共用同一套射线一起修好；根因 = Slice 6 把 VOID 设计为不挡光导致边界漏光。② 侵蚀层墙面衰减（只动 spike 分支）：`drawCorruptionIsolux` 环带 alpha 逐射线乘墙面接近度衰减（`wallProximityFade`，距 `stencilDist` 最后 24px 内 smoothstep 到 0），绿在墙面前消散而不是堆成反光；只动 isolux/soft 路径，hard 与 bands/subdiv/bayer 不动，无每帧分配。红线不动：射程 / 锥角 / 三档数值 / 规则 4 朝向 / 薪柴不发光 / 混乱缩放 / 相机 / `getVisibilityAt` / `castRay` | `npx tsc --noEmit`；全部 check:* 绿；视觉回归：种子 1754827715 玩家 (1224,560) 朝东 field / bands 双模式边界漏光消失（虚空保持黑暗、边缘墙块不再背光）、teal=soft 陆缘绿圈裁到边缘不堆积、内部墙群前绿圈消散、内陆零回归、边界天空巨影 / 边界氛围（depth 60 在遮罩之上）仍可见；截图 `docs/art/review-2026-08-28/vision-lab/v10-*`；出击场景冒烟进图正常、贴边界漏光消失 | 人拍板 DEC-106；**code 已交** 2026-08-29，画面等人终审 |
| **4** | 人 | 裂隙试玩终审画面（验证问题见下）+ 对比课抽卡（选遮罩模式与 teal 内缘） | 人终审 PASS / 指名下一版问题 | 波 3 已交 |

---

# Task: I9-A | 视野表现规格 | assignee: art

Title: 迷雾质感 / 渐变带 / 光池三件的表现层处方 | Priority: P0 | Depends: DEC-105 已登记 | Dispatch: 已交

**先 Read** `.agents/skills/in-game-ux/SKILL.md`（项目内副本），按本游戏 `art-direction.md` 填写；写完走该 skill 的自检。

**载体判断：** 迷雾 / 渐变带 / 光池是**引擎世界层表现**，钉世界坐标，不是 UI 表面、不挂 `#dom-ui-root`，U1–U12 清单不作本包闸门。但两件北星照样适用：**审美过关**（对得起 art-direction 与具名参考）与**读作游戏**（不是调试可视化的「视野多边形线框」感）。

**参考锚点：** Darkwood——art-direction 已锁的锚：「俯视角有限视野的黑暗处理方式；光衰速度；恐惧来自看不见」。学它的黑暗质感与光衰读法；明确不学：依赖美术手绘场景的静态打光（本游戏地图是程序生成的，光照必须运行时生成）。

**交付（一次会话）：** 三件各给可执行处方——改哪个纹理 / 哪段像素处理 / 期望读法 / 不改哪条规则哪个数值。渐变带优先评估 spec 已挂的 1–2px dither 方案。任何「必须动 constants 数值」的结论，单独列清单（参数名 / 现值 / 建议值 / 理由）回人拍板，本批不落地。

**禁止：** 改 `src/**`；代勾好看；提案动规则 4 / 射程 / 锥角 / 三档数值 / 薪柴发光 / 混乱缩放；提案加迷雾外信息；把迷雾下亮度已 PASS 的读法推翻重来（提质，不是推翻）。

**循环预算：** 最多 2 轮；到顶未收敛升级给人。

---

# Task: I9-G | 表现层实现 | assignee: code

Title: 按 I9-A 处方实现，constants 数值 diff 为空 | Priority: P0 | Depends: I9-A 已交且人未否 | Dispatch: 已交（2026-08-28）

**改：** I9-A 点名的表现层抓手（默认在 `visibility-system.ts` 的纹理生成与遮罩合成路径内）。若 I9-A 有人拍板的数值项，按人拍板的清单改，不多不少。

**禁止：** 私改 constants 数值；动 `getVisibilityAt` / `castRays` 几何；动规则 4 朝向来源；给任何对象注册新 glow source；动相机；每帧分配；拆静止缓存与降级路径；动 `clipLightsToIsland` 的陆地掩膜语义。

**闸门：** `npx tsc --noEmit`；现有 check 全绿；最多 2 轮。

---

# Task: I9-QA | 机械对照 | assignee: qa

Title: 红线逐条 + 数值 diff 为空 + 性能预算 | Priority: P0 | Depends: I9-G 已交 | Dispatch: 🟢

对照本合同「不做什么」逐条核；constants 的 VISIBILITY / CHAOS 段 diff 应为空（或恰等于人拍板清单）；`getVisibilityAt` 行为不变；报告写 `docs/qa/iteration-9.md`。好看不代勾，画面等波 4。

---

# 验证问题（人看裂隙出击画面）

1. **迷雾是否读作「那里有空间，只是看不见」**，而不是「没加载完」或「电视雪花」？
2. **三档过渡是否不再读成同心圆色带**（或带状感是否已可接受）？
3. **手电是否读作有方向的照亮**，暖光光池是否仍是唯一暖色、且没有把虚空涂亮？
4. **迷雾下亮度是否没有回退**（已 PASS 的亮度保持）？

---

# 收尾四项（轻量路径，收口时 Director 核对）

1. **架构登记**：若只改 `visibility-system.ts` 内部渲染、无新模块，登记「无新增模块」；若拆出新模块须登记 `architecture.md`。
2. **spec 判断**：规则与数值不动 → `system-movement-vision.md` 数值表不动；若打磨改了规则 15 / 17 / 18 的**读法措辞**（不是数值），原地更新该 spec 并更新 `last-modified-date`。
3. **交付范围记录**：本文件波段表 + `docs/progress/current-iteration.md` 迭代 9 批次表。
4. **UI 清单**：本包非 UI 表面，U1–U12 不作闸门；两北星（审美过关 / 读作游戏）由波 4 人终审。
