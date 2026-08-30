---
status: COMPLETE
created-by: director agent
created-when: 2026-08-30
last-modified: 2026-08-31
note: 迭代 10（rift 拾取物读条与翻找）**COMPLETE（2026-08-31，人终审 PASS）**。立项（DEC-108，2026-08-30）三条一揽子：触碰拾取改持续按键读条；薪柴/污染物统一为外观不可区分内容物的翻找对象；完成拾取加结果揭晓动画。三卡 gym 抽卡已结案（DEC-109，2026-08-30 人拍板）：选中组合 = 卡 1 翻堆（容器外观 + 揭晓动效）+ 卡 2 底部装置读数条（进度表现）；卡 3 破壳落选下线。人点名两项立项内补强：拾取音效四键（Slice 9 占位流程）+ 堆辨识度与随图配色（接迭代 6 碎片身份配方）。人终审波 1 热修（I10-HOTFIX-1，2026-08-30）：堆模型保留、配色 v2 落地；DEC-110 人批准色板新增 3 格残骸材质色（世界材料色口径，§2.3 规则 8 豁免）；新机器闸门 `check:loot-pile-contrast`（堆主体 vs 地面 ΔE ≥ 18）四张全过。2026-08-31 人终审 PASS（「通过，结案，提交，push」），抽卡课 `?lesson=loot-card` 已按迭代 9 先例删课。活指针仍在迭代 5。
---

# Tasks: 迭代 10 — rift 拾取物读条与翻找（DEC-108）

权威：`docs/progress/current-iteration.md`。设计正文：`docs/design-notes/loot-search.md`（I10-D 已交）。规则：`docs/specs/system-chaos-scavenge-extract.md`（规则 14 / 14a / 14b / 15 / 16 / 17 / 30g 已原地改口）、`docs/specs/system-growth-tide.md`（CN8 / CN9 已原地改口）。美术方向：`docs/art-direction.md`。练习场入口：`docs/dev/gym.md`。

**对人说话：** 用「rift 拾取物读条与翻找」或「拾取物特效」。禁止说成「拾取系统重做」——分布原则、节点数量、分档价值、撤离规则一个都不动。

**立项：** 人 2026-08-30 点名三条一揽子需求（逐字存 DEC-108）：① 触碰拾取改为读条（持续按键）拾取；② 薪柴、污染物两种颜色发光模型统一为需要「开启」「翻找」的对象，玩家不能通过外观区分内容物；③ 完成拾取后加动画让玩家感知拾到的是薪柴还是污染物。人硬性要求：三条涉及视觉效果，**统一抽卡**，gym 新课改 3 张卡供人选择。

**收尾合法态：** 三张卡（每卡 = 读条表现 + 统一翻找对象外观 + 结果揭晓动画的完整组合）在 gym 新课可交互演示完整拾取流程；三卡机制层完全一致（约束表见下）；art 最短核三卡逐一合规；闸门全绿；出击生产路径 diff 为空。**然后等人在 gym 抽卡。** 人抽完拍板才开翻生产批（I10-FINAL）；「实现完成、体验未验证」是合法中间态，禁止无证据记 PASS。

---

# 拍板落定（DEC-109，2026-08-30 人抽卡拍板）

**选中组合（不是单卡）= 卡 1「翻堆」的容器外观与揭晓动效 + 卡 2「开匣」的屏幕中下装置读数细条（进度表现）。卡 3「破壳」整支落选，分支删除。**

- **最终组合一句话**：翻找对象 = 低矮残骸堆（随碎片身份配色，一眼读作「可以翻找的东西」）；按住 E 读条时屏幕中下走一条装置读数细条（磷光填充，与混乱条同族不同形），堆体做翻找微动；读完堆散开，薪柴晶簇弧线落身 + 右上 +N 闪，残渣光团 + toast-inline 星等。
- **碎弧备注（Director 按表现层一致性拍定，人授权「由你拍」）**：底部装置条已承担进度通道，卡 1 原脚下碎弧的**进度语义移除**——读条期间堆体保留翻找动作氛围（堆体 / 碎屑微动，不编码进度）；进度唯一通道 = 底部装置条。同一 P1 信息不双通道同播。
- **补强一（人点名，本迭代内必须做）：拾取音效四键**——读条循环音 / 打断音 / 揭晓·薪柴 / 揭晓·残渣（两者可区分）。走 Slice 9 占位流程：`tools/audio-placeholders/generate.mjs` 脚本合成（ffmpeg lavfi；非空双格式 OGG+MP3；禁止运行时振荡器冒充）；`audio-catalog.ts` 注册 + `system-audio.md` 资产表追加；配方登记，人后续替换正式资产。既有 `sfx-shared-player-pickup` 随触碰拾取下线退役（或改作揭晓·薪柴，由实现批按听感区分度定并记录）。
- **补强二（人点名，本迭代内必须做）：堆辨识度 + 随图配色**——堆要一眼读作「可交互对象」（手段示例：轮廓 / 微动 / 靠近前的高可读剪影；禁止发光到泄露内容物、禁止 UI 图标贴脸）；堆色不能全图通用，必须接迭代 6 碎片身份配色体系（`docs/art/rift-fragment-surfaces.md` 碎片身份配方：渍色 / 材质残影 / 色温组量化），四张启用碎片（户外 / 医院 / 地铁 / 旧图书馆）都成立。视觉规格归 art（I10-FINAL-S），实现归 code（I10-FINAL），art 再核（I10-FINAL-C）。
- **gym 课归宿**：`?lesson=loot-card` 改为单组合展示课（数字键切卡下线，保留 R 换种子）供人终审；**人终审 PASS 后按迭代 9 先例（DEC-107）删课**，同步 gym.html 侧栏与 `docs/dev/gym.md`。
- **卡 3 存疑项处理**：卡 3 已落选，其三项存疑（打断合拢 / 起始偏弱 / 色板外 tint）随分支删除关闭；实现批须检查**翻堆分支**是否有同类色板外值（如世界内残渣 tint 0x4a6a64），有则改回落锁定色板。

---

# 范围（三条一揽子，不拆）

| # | 件 | 现状 | 目标 |
| - | -- | ---- | ---- |
| 1 | 拾取方式 | Arcade overlap 触碰即拾取（`LootSystem` / `ContaminantNodeSystem`） | 持续按住 E 读条 1200ms（建议值待校准），完成才结算；打断规则全套（见机制层） |
| 2 | 拾取物模型 | 薪柴 = 金色晶体三角、污染物 = 紫色旋转圆球，外观直接区分 | 统一为需要「开启 / 翻找」的对象；外观不泄露内容物类型与 tier |
| 3 | 拾取结果动画 | 节点消失 + HUD 数字变化（残渣甚至零反馈） | 完成拾取有揭晓动画：一眼分辨薪柴 vs 残渣（信息集与色谱见机制层） |

# 机制层已锁（I10-D，design 已交 2026-08-30；T1 职责内拍定，不问人）

设计正文 `docs/design-notes/loot-search.md`（12 条完整论述 + 理由）。摘要：

1. **读条时长**：统一 1200ms（`LOOT.SEARCH_CHANNEL_MS`，建议值待校准），不分档不分内容物——分内容物 = 时长泄露内容物。
2. **键位**：复用 E（全项目唯一交互动词键）。同一时刻只有一个交互上下文：距玩家近者胜，同距撤离优先；提示文案 `[E] 撤离` / `[E] 翻找` 随上下文切换。
3. **打断**：松开 E / 移动 / 攻击 / 主动工具键 / 受击——任一即打断且**进度清零**；不锁输入（想做别的 = 放弃翻找）；Esc 暂停 = 冻结保进度。
4. **发声**：读条**开始时**经场景层调一次 `AISystem.reportNoise`（96px，`'suspicious'`，与挥击噪音同级）；读条期间不持续发声；完成与打断不发声。不发声则「读条 = 风险决策」不成立（停步对改写体几乎隐形）。
5. **混乱值**：读条期间时间照过、混乱照涨，不加额外脉冲——成本即时间本身（约 0.6 点/次）。
6. **数据契约**：`kindlingNodes` / `contaminantNodes` 两数组两系统不变；统一的是外观与交互层。ruminate 契约不变（「已拾取」= 翻找完成）。
7. **深渊之眼**：改口为揭示全部未拾取可翻找对象（同一菱形不区分类型）——工具特权是「知道哪里有」，不是「知道是什么」。CSV 文案改口是交接项，归 I10-FINAL。
8. **揭晓通道**：薪柴 = 既有右上 +N 闪；残渣 = 新增 toast-inline「残渣 + 稀有度星等」（补现状零反馈缺口），不给具体类型名。**揭晓色全 teal 谱**（残渣按稀有度走 teal ramp：common 暗 / fine #1aad96 / rare #3cffd4），**禁止紫谱**——紫色在 art-direction 无登记、UI 层已锁无独立紫色类、统一对象后紫谱绝迹、U9 本就不允许颜色单通道。
9. **可见性**：可见才能提示、才能开始读条；读条开始后视野变化不打断；统一对象仍不是 glow source（规则 17/19 不动）。
10. **迭代 8 边界**：地面占漆「踩前可分」（迭代 8，已锁）与拾取物「翻前不可分」（本迭代）是两套识别面，互不推翻、互不反推。
11. **交互提示**：既有 `[E] 撤离` 元素原地扩展（屏幕中下，`#dom-ui-root`，不新开挂载根）；载体 A 世界内装置；in-game-ux skill 步骤 1–3、6 已执行（I10-D）。
12. **事件契约**：无变更（`interface-changed: false`）。读条开始/进行/打断不进事件总线——进度由场景层每帧查询驱动渲染；完成 = 既有 `KINDLING_COLLECTED` / `CONTAMINANT_ACQUIRED`。

## 三卡机制约束表（I10-D 锁定；三张卡必须全部遵守）

| 维度 | 三张卡必须一致（机制层） | 合法差异（表现层） |
| ---- | ---- | ---- |
| 读条时长 | 统一 1200ms（建议值待校准） | — |
| 键位 | E 按住；上下文近者胜、同距撤离优先；提示 `[E] 撤离` / `[E] 翻找` | — |
| 打断 | 松开 / 移动 / 攻击 / 主动工具键 / 受击 = 清零；Esc = 冻结保进度 | — |
| 发声 | 读条开始一次 96px suspicious；完成 / 打断不发声 | — |
| 混乱值 | 时间照过、不加脉冲 | — |
| 可见性 | 可见才能提示与开始；开始后视野变化不打断 | — |
| 交互半径 | 48px（与撤离触发半径同值） | — |
| 揭晓信息集 | 薪柴 = 是薪柴 + 数值 +N；残渣 = 是残渣 + 稀有度星等；不给类型名 | — |
| 揭晓色谱 | 薪柴 teal 余晖 / HUD warm-dim；残渣 teal ramp（common 暗 / fine #1aad96 / rare #3cffd4）；禁止紫谱 | — |
| HUD 通道 | 薪柴既有右上 +N 闪；残渣新增 toast-inline（右上资产区，同区不同形） | — |
| 读条进度可读性 | 进行中 400ms 内可辨（U10）；屏幕空间须挂 `#dom-ui-root` 且避开 S10 禁区；世界内对象身上则不受 HUD 禁区约束 | 读条载体与表现、进度几何 |
| 统一对象外观 | 不泄露内容物类型与 tier；alpha 乘可见性；不是 glow source | 对象造型、材质、活层形式 |
| 揭晓动画 | 信息集与色谱同上；不阻断输入 | 动画形式、时长、粒子 / 形变演绎 |

---

# 三张卡（抽卡组合方案；Director 草案，art 最短核把关）

每卡 =【读条表现 + 统一翻找对象外观 + 结果揭晓动画】的完整组合，不是三个孤立变量的排列组合。三卡共享上表全部机制。

## 卡 1「翻堆」

- **一句话读法**：读条是对象脚下一圈碎弧逐段合拢；读完堆体翻开，内容物从堆里跃出落向玩家。
- **载体决策**：世界内实体表现——读条钉世界坐标、走引擎世界层，不挂 overlay 根；对象身上无 HUD 禁区约束。
- **对象外观**：低矮残骸堆（碎片质感的瓦砾 / 板条小堆；无发光、无类型色；与地图残破度同族）。
- **读条表现**：对象脚下一圈不规则碎弧，随进度逐段点亮（teal 余晖谱）；打断时碎弧散开熄灭。
- **揭晓动画**：堆体块散开，薪柴 = teal 余晖晶簇升起、弧线落向玩家 + 右上 +N 闪；残渣 = teal 光团升起（亮度按稀有度档）+ toast-inline 星等。
- **具名参考**：Darkwood（搜刮读条贴着世界内对象、俯视角黑暗中的物件读法；不学其手绘场景静态打光）、Escape from Tarkov（搜索容器 = 内容物搜后才知；不学其网格背包界面）。
- **本卡不像**：进度条 UI、圆角卡片、头上跳字。

## 卡 2「开匣」

- **一句话读法**：读条是随身罩上一条装置读数（屏幕中下细条）；读完匣缝亮一下，类型由随身罩入账行讲清。
- **载体决策**：A 世界内装置——屏幕空间读数挂 `architecture.md` 声明的 overlay 根（出击 = `#dom-ui-root`；练习场 = 课内容器根），device-plate 族；避开 S10 禁区（画面中心 ±120×80 与玩家朝向前方），与既有 `[E] 撤离` 交互提示同区。
- **对象外观**：立式封存匣 / 罐（工业外壳、直边；极弱 teal 微光缝——缝光是「可交互」标记，不是类型色）。
- **读条表现**：屏幕中下一条细装置读数（磷光填充，与混乱条同族不同形）；打断时读数熄退。
- **揭晓动画**：匣缝一开即合（匣身转暗 = 已空）；类型揭示主要靠 HUD 通道（+N 闪 / toast-inline 星等），世界内只给一瞬 teal 余晖强弱。
- **具名参考**：Signalis（随身设备读数、受限色调工业 UI；不学复古显像管曲面畸变）、Barotrauma（按住读条的交互节奏；不学其潜艇仪表密度）。
- **本卡不像**：OS 进度条、居中弹窗、设置页滑块。

## 卡 3「破壳」

- **一句话读法**：对象自己就是读条——壳体裂缝随进度撑开；裂到底时内容物的光从裂缝泄出，壳随即瘪掉。
- **载体决策**：世界内实体——对象自身即进度指示，零额外 UI 元素。
- **对象外观**：半埋的荚 / 壳状物体（矿物感外壳；**守 art-direction 禁忌：不是内脏 / 软组织 / 黏液**；与污染体外形保持可读距离，不读作占漆 / 敌人）。
- **读条表现**：壳体裂缝随进度逐段撑开，缝内透出极弱 teal（进度越满缝越宽、光越显）；打断时裂缝合拢复位。
- **揭晓动画**：裂缝裂到底，内容物从缝中顶出（薪柴 = 余晖晶簇；残渣 = 光团 + 星等 toast），空壳瘪灭消失。
- **具名参考**：Darkwood（环境叙事物件的克制；不学其依赖手绘的细节量）、Signalis（low-fi 像素恐怖、受限色调；不学其 UI 字体风格）。
- **本卡不像**：进度条、史莱姆 / 内脏系有机体、占漆宿主。

---

# 不做什么（红线）

- **出击生产默认不动**：`RiftScene` 接线、`LootSystem` / `ContaminantNodeSystem` 行为、既有 constants 字段值全部不变。本波只允许：`constants.ts` 的 `LOOT` 段**追加** `SEARCH_CHANNEL_MS: 1200` / `SEARCH_RADIUS: 48` / `SEARCH_NOISE_RADIUS: 96` / `SEARCH_NOISE_LEVEL: 'suspicious'` 四个新字段（`PICKUP_RADIUS` 保留并注释「迭代 10 起退役，见 spec 规则 14」）；新增生产侧模块与 gym 课文件。人抽完拍板前，禁止把读条机制接进 `RiftScene`。
- **三卡机制一致**：读条时长 / 键位 / 打断 / 发声 / 信息集 / 色谱 / HUD 通道按约束表，三卡无差异。禁止给某张卡偷偷改机制当卖点。
- **不拆连通**：翻找对象不挡路（保持可走格，overlap 不碰撞；连通 FATAL 纪律不动）。
- **不泄露内容物**：统一对象外观不得泄露类型与 tier；不是 glow source；不用紫谱；alpha 乘可见性。
- **读条 UI 必经 in-game-ux skill**：`[E] 翻找` 提示、卡 2 装置读数、toast-inline 都是 in-game UI——先 Read `.cursor/skills/in-game-ux/SKILL.md`，走开工闸门 + 画完自检；屏幕空间挂调用方传入的 DOM 根（禁止写死 `document.body`）；表名 / 数值 / 档位分开；面向玩家字符串走 `t()`（DEC-004 key 约定）。
- **不动生成器与布点**：规则 20/21 分布原则、节点数量（8 + 3）、分档价值（1/2/4）、稀有度权重（60/30/10）全部不动。
- **不动 CSV、不跑 codegen**：本迭代无策划数据变更（读条参数是系统常量，住 constants）。深渊之眼 CSV 文案改口是 I10-FINAL 交接项，本波不做。
- **不为练习场另写一套拾取机制**：机制与三卡渲染住生产侧目录（`src/systems/` 等），gym 课只接线与切卡；禁止 `RiftScene` import `src/gym/**`（既有纪律）。
- **课内不刷敌人**：发声与受击打断三卡一致、不是抽卡维度，本课不演示（翻生产后出击验证）。课内演示：靠近 → 提示 → 按住 E 读条 → 打断（松开 / 移动）→ 读完 → 揭晓 → 入账。
- **性能**：无每帧分配；纹理预生成复用。
- 不开 I5-C；不动迭代 5 波次表；不标任何已有迭代状态；不替人选默认。
- 连续 2 次不过机器闸门 → 停，升档 T1 重做并标注。

---

# 波段计划

单批上下文预算：一波 = 一次可独立完成的 agent 会话。审美与「读作游戏」人终审，agent 不代勾。

| 波 | 角色 | 任务 | 验收闸门 | 依赖 |
| -- | ---- | ---- | -------- | ---- |
| **1** | design | **I10-D** 机制设计正文 + spec 原地改口（12 条决策 + 三卡约束表） | **已交** 2026-08-30。`docs/design-notes/loot-search.md`；两份 spec 原地改口；`interface-changed: false` | DEC-108 已登记 |
| **2** | code | **I10-G** gym 新课 `?lesson=loot-card`：真实裂隙布局 + 玩家在场 + 三卡完整拾取流程，数字键 1/2/3 切卡 | **已交** 2026-08-30。tsc 零错误；出击路径 diff 为空；截图证据 `docs/art/review-2026-08-30/loot-card/` | I10-D 已交 |
| **3** | art | **I10-C** 三卡最短核：载体 + 参考 + 相关 U 项 + 审美底线；只核不改 | **已交** 2026-08-30。三卡四项逐一合规；三项存疑不阻断（卡 3 相关两项随落选关闭；色板外 tint 一项转 I10-FINAL 检查翻堆分支） | I10-G 已交 |
| **4** | 人 | gym 抽卡 | **已拍板** 2026-08-30（DEC-109）：组合 = 卡 1 翻堆容器/动效 + 卡 2 底部装置条；卡 3 落选；点名音效 + 堆辨识度/随图配色两项补强 | 波 3 已交 |
| **5a** | art | **I10-FINAL-S** 堆视觉规格：辨识度手段（剪影/构成/微动；不泄露内容物、不贴 UI 图标）+ 随图配色接迭代 6 碎片身份配方（四张启用碎片） | **已交** 2026-08-30。规格落 `docs/design-notes/loot-search.md`「最终组合视觉规格（DEC-109）」 | DEC-109 |
| **5b** | code | **I10-FINAL** 组合落地 + 翻生产：底部条移植为翻堆进度通道（碎弧进度语义移除，留翻找微动）；卡 3 分支删除；音效四键接入（gym 课内可听）；堆辨识度 + 随图配色按 I10-FINAL-S 规格实现；`RiftScene` 接线读条翻找、触碰拾取下线；深渊之眼 CSV 文案改口交接项；gym 课改单组合展示；出击冒烟 + 四碎片截图证据 | **已交** 2026-08-30。tsc 零错误；`check:contam-floor-contrast` 绿；codegen 已跑；截图 `docs/art/review-2026-08-30/loot-card/final/`。不标 COMPLETE | I10-FINAL-S 已交 |
| **5c** | art | **I10-FINAL-C** 最终组合最短核：载体 + 参考 + 相关 U 项 + 审美底线；四碎片下堆辨识度与配色合规；底部条装置读数合规 | **已交** 2026-08-30。六项逐项过五项；一项存疑不阻断（reveal-kindling 起音 30ms 内约 92% vs 规则 G 90%——与已交付 pickup / ui-click 同口径，口径随人终审拍板；最小修法 = 该键 click 渐入 12ms→30ms）。配色推导逐格手算复核与规格一致；色板外值零残留。未代勾好看 | I10-FINAL 已交 |
| **5d** | qa | **I10-QA** 机械对照：spec ↔ 实现；红线逐条；数值 diff；闸门状态 | **已交** 2026-08-30。报告 `docs/qa/iteration-10.md`：17 项机制核全 PASS，无阻断 FAIL；U1–U12 机械层已勾；闸门全绿。一条规格过期（chaos spec `exposes` 旧 LootSystem 名）已由 Director 当日原地改口 | I10-FINAL 已交 |
| **6** | 人 | **终审**：画面 + 音效 + 四张碎片下堆的辨识度（终审问题见下） | **已反馈热修** 2026-08-30：模型构成语言保留（四碎片各异、整体契合）；配色与环境迷彩融合不及格 → 「保留模型设计，优化配色」，开 I10-HOTFIX-1 系列 | 波 5c/5d 已交 |
| **6a** | art | **I10-HOTFIX-1-S** 堆配色规格 v2：从碎片身份配方推导但保证与地面拉开；定量化对比度下限（照迭代 6 CIE76 闸门思路） | **已交** 2026-08-30。根因机器复算定位（v1 医院 / 地铁堆主体与地面同格 ΔE 0.0；色板暖组天花板 36.7）；v2 = 主体「断口新鲜面」亮档 + 底影 `void-black` + 高光 `metal-light`；闸门下限 主体 vs 地面 ≥ 18。色板 3 新格升级项 → 人拍板 **DEC-110**（批准 + 规则 8「世界材料色」豁免口径） | 人终审反馈 |
| **6b** | code | **I10-HOTFIX-1-G** 配色 v2 落地 + 色板传播 + `check:loot-pile-contrast` + 四碎片截图 | **已交** 2026-08-30。`derivePileSlots` 改查表（墙模拟 RGB 量化退役）；主体 ΔE 户外 21.0 / 医院 20.0 / 地铁 20.4 / 图书馆 20.4 全过；tsc + 新旧闸门全绿；截图 `docs/art/review-2026-08-30/loot-card/hotfix-1/` | DEC-110 |
| **6c** | art | **I10-HOTFIX-1-C** 四碎片再核：载体 / 参考 / U 项 / 审美底线 + 对比度达标 + 不泄露内容物 + 不读作污染 | **已交** 2026-08-30。四张全过，五条红线互证成立；一项规格表数字失准（24.6→24.2，描述性参考列）已由 Director 原地订正。未代勾好看 | 波 6b 已交 |
| **6d** | qa | **I10-HOTFIX-1-QA** 增量机械对照：新闸门 / 色板 diff / spec ↔ 实现 | **已交** 2026-08-30。`docs/qa/iteration-10.md` 增量节：18 PASS / 0 FAIL；既有闸门不回归 | 波 6b 已交 |
| **7** | 人 | **复验**：四碎片截图辨识度（够不够跳 / 一眼可读类别身份）+ 终审余项（画面 + 音效） | **PASS** 2026-08-31（人：「通过，结案，提交，push」）；抽卡课已删（迭代 9 先例） | 波 6c/6d 已交 |

---

# Task: I10-D | 机制设计正文 | assignee: design | **已交 2026-08-30**

Title: 读条规则 / 打断 / 敌人交互 / 统一对象数据契约 / 结果信息通道 / 迭代 8 边界 / 三卡机制约束 | Priority: P0 | Dispatch: 🔴（人已点名本迭代）

**状态：已交。** 现行真相：设计正文 `docs/design-notes/loot-search.md`；`system-chaos-scavenge-extract.md` 规则 14 / 14a / 14b / 15 / 16 / 17 / 18 / 30g 与 L 节数值表（新增 `SEARCH_CHANNEL_MS` / `SEARCH_RADIUS` / `SEARCH_NOISE_RADIUS` / `SEARCH_NOISE_LEVEL`，`PICKUP_RADIUS` 退役）；`system-growth-tide.md` CN8 / CN9；`world.md` 术语表追加「翻找」。`interface-changed: false`。记录在案（不在本迭代范围）：ruminate CSV 描述与代码消费的既有漂移；死亡时残渣保留库存现状；深渊之眼 CSV 文案改口交接项（归 I10-FINAL）。

---

# Task: I10-G | gym 抽卡课 | assignee: code | **已交 2026-08-30**

Title: 新课 `?lesson=loot-card` 三卡可交互演示 | Priority: P0 | Depends: I10-D 已交 | Dispatch: 🔴

**状态：已交。** 交付：`src/systems/loot-search-system.ts`（读条状态机）、`src/systems/loot-search-cards.ts`（三卡表现）、`src/ui/dom/loot-search-hud.ts`（`[E] 翻找` / 装置读数 / 入账反馈）、`src/gym/gym-loot-card-scene.ts`（接线）；constants 追加 SEARCH_* 四字段；tsc 零错误；出击路径 diff 为空；截图 `docs/art/review-2026-08-30/loot-card/`。以下为原始 Brief 存档。

**先读：** 本合同；`docs/design-notes/loot-search.md`；`docs/specs/system-chaos-scavenge-extract.md` 规则 14 / 14a / 14b / 15 / 16 / 30g 与 L 节搜刮数值表；`docs/dev/gym.md`；现状 `src/systems/loot-system.ts` 与 `src/systems/contaminant-node-system.ts`（纹理生成与 overlap 模式参照）；`src/gym/gym-map-scene.ts`（真实布局 + 地表 + 宿主接线参照）；`src/gym/gym-lexicon-scene.ts`（出击 `Player` 在场接线参照）；`src/gym/gym-lesson.ts` / `gym-boot-scene.ts` / `main.ts` / `gym.html`（注册四处）。**触碰 in-game UI（`[E] 翻找` 提示、卡 2 装置读数、toast-inline）先 Read `.cursor/skills/in-game-ux/SKILL.md`**，走开工闸门；卡 2 按合同载体决策执行。

**建什么：**

1. **生产侧机制与三卡模块**（住 `src/systems/`，如 `loot-search-system.ts`；对象纹理生成照既有 `ensure*Texture` 模式）：读条状态机（按住 E / 48px / 1200ms / 打断清零 / 完成结算）+ 三张卡的表现分支（对象外观 + 读条表现 + 揭晓动画，按合同三卡节）。三卡共享全部机制（约束表）；差异只在表现层。残渣内容在**完成时**按生产权重 roll（common 60 / fine 30 / rare 10）；薪柴按 def tier 价值。揭晓色谱与信息集按约束表（禁紫谱）。
2. **gym 新课 `GymLootCardScene`**：`generateRiftLayout` 真实裂隙布局 + `RiftSurfacePainter` 地表 + `ContaminationHostSystem`（只画，不传 combat / chaos，同地图课）；出击同一套 `Player`（WASD；相机跟随玩家、zoom 1.5，与出击同——模拟实际读法与帧率）；不开迷雾（全亮，可见性恒 1）；不刷敌人；不接旁白。对象布点用 `layout.kindlingNodes` + `layout.contaminantNodes`（内容类型按来源数组预定，外观统一）。
3. **交互流程**：靠近（≤48px）→ DOM 提示 `[E] 翻找` → 按住 E 读条 → 松开 / 移动即打断清零 → 读完 → 揭晓动画 → 入账反馈（薪柴 +N 闪 / 残渣 toast-inline 星等）。屏幕空间元素挂**调用方传入的 DOM 根**（练习场 = 课内容器覆盖层；出击翻默认时 = `#dom-ui-root`），禁止写死。
4. **切卡**：数字键 1 / 2 / 3 切三张卡；侧栏给三个卡按钮（开发 UI，非游戏内界面）。切卡时场上未翻找对象换当前卡外观；进行中的读条取消。R 换种子重新生成（destroy 再 create，同地图课纪律）。
5. **注册四处**：`gym-lesson.ts`（类型 + URL 解析）、`gym-boot-scene.ts`（场景映射 + 侧栏显隐）、`src/gym/main.ts`（场景注册）、`gym.html`（nav 链接「拾取抽卡」+ 规则块 `gym-rules-loot-card` + 侧栏控件块）。`docs/dev/gym.md` 加课一节**本波就做**（不等 FINAL）。
6. **constants**：`LOOT` 段追加四个 SEARCH_* 字段（值按 spec）；`PICKUP_RADIUS` 保留 + 注释退役。其余字段值不动。

**截图证据（code 自检，必做）：** 复用迭代 9 探针模式（headless chromium，参照 `/tmp/vision-lab/` 脚本；dev server `localhost:3000`，没起则 `npm run dev`）。存 `docs/art/review-2026-08-30/loot-card/`：每卡至少三张——对象待翻（含 `[E] 翻找` 提示）/ 读条进行中 / 揭晓瞬间（薪柴与残渣各一）。另附一张切卡对照。

**闸门：** `npx tsc --noEmit` 零错误；改动面相关 check:* 绿；**出击路径 diff 为空**（`RiftScene` / `loot-system.ts` / `contaminant-node-system.ts` / 既有 constants 字段值不变；`git diff` 自证）。最多 3 轮视觉自检；连续 2 次不过机器闸门 → 停，升档 T1。

**禁止：** 把读条接进 `RiftScene`；改生成器 / 布点 / 分档价值；改 CSV 或跑 codegen；紫谱；对象挡路；每帧分配；为练习场另写一套机制；代勾好看；替人选默认卡。

---

# Task: I10-C | 三卡最短核 | assignee: art | **已交 2026-08-30**

Title: 三卡逐一核：载体 + 参考 + 相关 U 项 + 审美底线 | Priority: P0 | Depends: I10-G 已交 | Dispatch: 🔴

**状态：已交。** 三卡四项（载体 / 参考 / 相关 U 项 / 审美底线）逐一合规，可交人抽卡。三项存疑不阻断：卡 3 打断缺合拢、卡 3 读条起始偏弱（随卡 3 落选关闭）；世界内 common 残渣 tint `0x4a6a64` 未在锁定色板（转 I10-FINAL 检查翻堆分支同类问题）。未代勾好看。以下为原始 Brief 存档。

**先 Read** `.cursor/skills/in-game-ux/SKILL.md`。只核不改（不改 `src/**`、不改像素）。核实现，不核合同。

**每卡四条：**

1. **载体**：卡 1 / 卡 3 = 世界内实体（钉世界坐标，无屏幕空间元素）；卡 2 = A 世界内装置（屏幕空间读数挂调用方 DOM 根，device-plate 族，避开 S10 禁区）。实现与合同载体决策一致。
2. **参考**：实现读得出合同具名参考锚的动作（卡 1 Darkwood 搜刮 / Tarkov 搜后才知；卡 2 Signalis 装置读数 / Barotrauma 按住读条；卡 3 Darkwood 环境物件 / Signalis 受限色调），且没有学成「本卡不像」那三类。
3. **相关 U 项**：U1 载体；U5 可见词来自 world 术语表（翻找已登记）；U9 不靠颜色单通道（薪柴 vs 残渣 = 通道 + 形状 + 星等，不是只靠色）；U10 读条 400ms 内可辨；表名 / 数值 / 档位分开。
4. **审美底线**：对得起 `art-direction.md`（teal 谱纪律、暖色稀缺、像素质感）；统一对象读作「可以翻找的东西」——不是装饰、不是敌人、不是占漆宿主；卡 3 外壳不读作内脏 / 黏液（禁忌）。

**回报：** 三卡逐一四条合规 / 不合规结论（不合规写明哪条、最小修法）。不代勾好看；审美与「读作游戏」人终审。

---

# Task: I10-FINAL-S | 堆视觉规格 | assignee: art

Title: 翻找堆辨识度手段 + 随图配色（接迭代 6 碎片身份配方）的视觉规格 | Priority: P0 | Depends: DEC-109 | Dispatch: 🔴

**先读：** 本合同「拍板落定」节；`docs/art/rift-fragment-surfaces.md`（碎片身份配方 / 配色公式 / 色温分组 / 给 code 的死约束）；`docs/art-direction.md`（§2.2 锁定色名、薪柴节、UI 节）；`docs/art/palette.json`；`.cursor/skills/in-game-ux/SKILL.md`；现状实现 `src/systems/loot-search-cards.ts` 卡 1 翻堆分支与 `src/gym/gym-loot-card-scene.ts`（堆纹理怎么生成、布点怎么来）。

**要出什么（规格，不写实现代码）：**

1. **辨识度手段**：让堆在四张碎片上都一眼读作「可翻找的对象」——类别身份，不是内容物剧透。可选手段域：剪影 / 构成（堆的形体语言与地图残块的差异）、微动（待翻状态的极弱动作，如碎屑偶尔滑落）、靠近前的高可读轮廓。禁止：发光到泄露内容物；UI 图标 / 感叹号贴脸；读作敌人 / 占漆宿主 / 装饰残块。给出具名游戏参考（学什么动作 / 不学什么）。
2. **随图配色方案**：堆色如何接迭代 6 碎片身份体系——从本趟 `fragmentTypeId` 的配方（渍色 / 材质 / 墙与地板的色温组与偏置）推导堆的用色，四张启用碎片（`frag-outdoor` / `frag-clinic` / `frag-metro` / `frag-library`）逐一给出色来源与量化路径；所有最终色必须落 `palette.json` 锁定格，禁止新色、禁止色板外 hex（卡 3 的 `0x4a6a64` 教训）。堆与地面 / 墙的可分性要靠明度或结构差，不靠新色相。
3. **与机制红线的互证**：外观不泄露内容物类型与 tier（四张碎片同一张图里薪柴堆与残渣堆外观一致）；不是 glow source；alpha 乘可见性；不挡路。
4. **揭晓与读条期间的堆态**：读条期间翻找微动（接替碎弧的氛围角色，不编码进度）与揭晓散开的形式确认；底部装置条已是进度唯一通道（DEC-109 备注），堆侧不得再出现进度几何。

**产出**：规格写进 `docs/design-notes/loot-search.md` 新增「最终组合视觉规格（DEC-109）」一节（原地追加，不新建文件）；逐项注明色板落格。不代勾好看。

---

# Task: I10-FINAL | 组合落地 + 翻生产默认 | assignee: code

Title: 翻堆 + 底部条组合翻为生产默认；音效四键；堆辨识度与随图配色；卡 3 与 spike 分支下线 | Priority: P0 | Depends: I10-FINAL-S 已交 | Dispatch: 🔴

**状态：已交** 2026-08-30。生产默认 = 翻堆 + 底部装置条；卡 3 / 碎弧进度 / 切卡下线；音效四键占位已生成；堆色接碎片配方；`RiftScene` 接线读条；触碰拾取文件删除；深渊之眼 CSV + codegen；截图 `docs/art/review-2026-08-30/loot-card/final/`。不标迭代 10 COMPLETE。以下为原始 Brief 存档。

**先读：** 本合同（拍板落定 / 机制层 / 红线）；`docs/design-notes/loot-search.md`（含 I10-FINAL-S 视觉规格）；`docs/specs/system-chaos-scavenge-extract.md` 规则 14–18 / 30g 与 L 节；`docs/specs/system-audio.md`（资产表纪律 + G 禁 jump scare：起音 0–30ms 不超峰值 90%）；`docs/art/rift-fragment-surfaces.md`；`.cursor/skills/in-game-ux/SKILL.md`；现状 `src/systems/loot-search-system.ts` / `loot-search-cards.ts` / `src/ui/dom/loot-search-hud.ts` / `src/gym/gym-loot-card-scene.ts`；出击接线 `src/scenes/rift-scene.ts`；退役对象 `src/systems/loot-system.ts` / `contaminant-node-system.ts`；音频 `src/managers/audio-manager.ts` / `audio-catalog.ts` / `tools/audio-placeholders/generate.mjs`。

**做什么（按序）：**

1. **组合落地（gym 课先行）**：卡 2 的底部装置读数条移植为翻堆的进度通道；卡 1 脚下碎弧的进度语义移除，读条期间堆体改翻找微动（按 I10-FINAL-S 规格）；卡 3 破壳分支整支删除；`?lesson=loot-card` 数字键切卡下线，改单组合展示（保留 R 换种子）；gym.html 侧栏与规则块同步。
2. **音效四键**：`audio-catalog.ts` 注册读条循环音 / 打断音 / 揭晓·薪柴 / 揭晓·残渣（key 命名沿既有约定，如 `sfx-shared-player-search-loop` 等，dir `sfx/player`，spatial 按对象位置可走 `point`）；`tools/audio-placeholders/generate.mjs` 加四条配方并跑出非空双格式占位（ffmpeg lavfi；KEYS 计数断言同步改）；`system-audio.md` 资产表追加四键（原地更新）；接线：读条开始播循环音、打断播打断音 + 停循环、完成按内容物播对应揭晓音；既有 `sfx-shared-player-pickup` 退役或改作揭晓·薪柴（按听感区分度定，记录理由）；gym 课内可听。守规则 G（无 jump scare 起音）与 8 轨上限。
3. **堆辨识度 + 随图配色**：按 I10-FINAL-S 规格实现堆外观生成（纹理预生成复用，无每帧分配）；堆色从本趟 `fragmentTypeId` 配方推导，四张启用碎片都成立；外观不泄露内容物；不挡路。
4. **翻生产默认**：`RiftScene` 接线读条翻找（1200ms / E / 打断清零 / 读条开始一次 96px suspicious 噪声 / 48px 半径 / 可见性门 / 揭晓通道）；触碰拾取正式下线——`loot-system.ts` / `contaminant-node-system.ts` 退役（删除或收口为被 loot-search 取代，旧的 `onOverlap` 拾取与发光模型代码移除）；`PICKUP_RADIUS` 退役注释落实；深渊之眼改口（揭示全部未拾取翻找对象，同一菱形不区分类型）与 CSV 文案交接项执行——若动 `data/*.csv` 必须跑 codegen 并复跑闸门。
5. **生产命名收口**：spike 期的「卡」概念不得留在生产路径——`loot-search-cards.ts` 重构为单一生产表现模块（命名与结构按生产标准）；gym 课只接线。
6. **截图证据（必做）**：`docs/art/review-2026-08-30/loot-card/final/`——出击生产路径冒烟（真实出击里翻堆 + 底部条 + 揭晓）；四张启用碎片各自的堆辨识度对照（地图课或出击，标种子）；gym 单组合课三张（待翻提示 / 读条中 / 揭晓）。

**闸门：** `npx tsc --noEmit` 零错误；全部相关 `check:*` 绿（含 `check:contam-floor-contrast` 等地面闸门若触碰配色）；动 CSV 则 codegen 后复跑；无每帧分配；对象不挡路（连通 FATAL 纪律）。循环预算：最多 3 轮自检；连续 2 次不过机器闸门 → 停，升档 T1。

**禁止：** 替人终审画面 / 音效；标迭代 10 COMPLETE；开 I5-C；动迭代 5 波次表；新色进 palette.json；运行时振荡器冒充音频；0 字节资产；紫谱；把「卡」概念留在生产命名里。

---

# Task: I10-FINAL-C | 最终组合最短核 | assignee: art

Title: 选中组合 + 四碎片堆辨识度：载体 + 参考 + 相关 U 项 + 审美底线 | Priority: P0 | Depends: I10-FINAL 已交 | Dispatch: 🔴

**先 Read** `.cursor/skills/in-game-ux/SKILL.md`。只核不改。核实现，不核合同。

**核什么：**

1. **载体**：底部装置条 = A 世界内装置（屏幕空间读数挂 `#dom-ui-root`，device-plate 族，避开 S10 禁区，与混乱条同族不同形）；堆与揭晓 = 世界内实体；无碎弧进度几何残留。
2. **参考**：翻堆读得出 Tarkov / 最后生还者「搜后才知」与 Darkwood 俯视角物件读法；底部条读得出 Signalis / Barotrauma 装置读数；没有学成 OS 进度条 / 居中弹窗 / 设置页滑块。
3. **相关 U 项**：U1 载体；U5 术语（翻找 / 薪柴 / 残渣）；U9 不靠颜色单通道；U10 读条 400ms 内可辨；表名 / 数值 / 档位分开；不可见即无提示。
4. **审美底线**：teal 谱纪律；禁紫谱；堆在四张碎片上都读作「可翻找的对象」且不泄露内容物；堆色全部落锁定色板（无 `0x4a6a64` 类色板外值）；不像后台管理系统。
5. **音效机械层**：四键存在、非空、可播、起音不违反规则 G；揭晓两键可区分是设计意图（听感终审判权在人）。

**回报：** 逐项合规 / 不合规结论（不合规写明哪项、最小修法、是否阻断人终审）。不代勾好看。

---

# Task: I10-QA | 机械对照 | assignee: qa

Title: spec ↔ 实现机械对照 + 红线逐条 + 闸门状态 | Priority: P0 | Depends: I10-FINAL 已交 | Dispatch: 🟢

**对照基准：** 本合同；`docs/design-notes/loot-search.md`；`system-chaos-scavenge-extract.md` 规则 14–18 / 30g 与 L 节数值表；`system-growth-tide.md` CN8 / CN9；`system-audio.md` 资产表。

**核什么：** 机制数值 diff（1200ms / 48px / 96px suspicious / 分档价值 1/2/4 / 稀有度权重 60/30/10 不动）；打断规则全集（松开 / 移动 / 攻击 / 工具键 / 受击 = 清零；Esc 冻结）；发声时机（读条开始一次）；揭晓信息集与色谱（禁紫谱）；对象不挡路；事件契约无变更（`interface-changed: false`）；触碰拾取代码确已下线；卡 3 与 spike 分支确已删除；音效四键注册 + 资产非空双格式；红线逐条（本合同「不做什么」+ DEC-109）；闸门状态（tsc / check:* / codegen 若动 CSV）。报告落 `docs/qa/iteration-10.md`。机械对照，不代勾审美。

---

# 验证问题

**抽卡四问（已答，2026-08-30 人拍板 DEC-109）：** 组合 = 卡 1 翻堆容器/动效 + 卡 2 底部装置条进度；卡 3 落选。

**终审四问（已收口，2026-08-31 人终审 PASS）：** 画面 / 音效 / 四碎片辨识度 / 机制手感——人看过最终组合（出击生产路径 + 配色 v2 热修后四碎片截图），逐字拍板「通过，结案，提交，push」。四问按人「通过」整体收口；配色 v1 迷彩问题已经 I10-HOTFIX-1 修掉并复验。

---

# 收尾四项（轻量路径，收口时 Director 核对）

**已齐（Director 核对 2026-08-31）：**

1. **架构登记**：✅ 已登记——`architecture.md` 模块注册表含 `LootSearchSystem` / `LootSearchPresentation` / `LootSearchHud`（含 DEC-110 配色 v2 注），`LootSystem` 标 SUPERSEDED；`ContaminantNodeSystem` 同批退役。
2. **spec 判断**：✅ 已由 I10-D 原地更新两份 spec（规则 14 / 14a / 14b / 15 / 16 / 17 / 18 / 30g；CN8 / CN9）；`interface-changed: false`。I10-FINAL 追加：`system-audio.md` 资产表四键；表现层最终态（翻堆 + 底部条 + 配色 v2）在设计正文「最终组合视觉规格」节登记；I10-QA 与 I10-HOTFIX-1-QA 确认 spec 与实现一致。
3. **交付范围记录**：✅ 本文件波段表（含 I10-HOTFIX-1 系列）+ `docs/progress/current-iteration.md` 迭代 10 批次表与侧记。
4. **UI 清单**：✅ `[E] 翻找` 提示 / 底部装置读数条 / toast-inline——in-game-ux skill 已执行（I10-D 结构层；I10-G / I10-FINAL 实现；I10-C / I10-FINAL-C 视觉核）；U1–U12 结构层 qa 已勾（`docs/qa/iteration-10.md`），视觉层人终审 PASS（2026-08-31）。
