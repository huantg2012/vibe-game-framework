---
status: R4-TECHNICAL-VERIFIED / USER-VISUAL-PENDING
r3-status: TECHNICAL-VERIFIED / USER-PARTIALLY-VIABLE-NOT-ACCEPTED
r2-status: TECHNICAL-VERIFIED / USER-VISUAL-NOT-ACCEPTED
r1-status: TECHNICAL-VERIFIED / USER-VISUAL-REJECTED
date: 2026-09-12
owner: qa
baseline: 3c1bc7c + iteration-21 F / H / I working tree
---

# 迭代21 H／I：双线局部与像素精修验收（DEC-152／DEC-153）

**用户复核（DEC-154，2026-09-12）：** 认可三维整体效果并选为后续方向，正俯视冻结于R4。J批追加海面写意程度、中央缺失空间和色彩打磨。以下41组与实玩结果属于已提交R4基线，不冒充J批验证。

**证据保存：** 下文原始录像、逐帧大JSON与工作截图保存在本地`artifacts/iteration-21-spatial/`，不将数百MB运行产物放入Git。文件清单/大小/SHA256见`iteration-21-spatial-artifacts.json`，代表截图见`iteration-21-spatial-review/`，可执行复验脚本随源码保存。Git克隆不包含原始录像。

## 当前 R4：最终技术验证完成，用户空间／视觉待审

最终产品冻结后，已独立完成两线真实完整搜撤，以及一次自然死亡和存档隔离生命周期。两线使用同一世界签名 `aa970f9f`；脚本为真实 WASD／Space／E／Tab／Esc 和正常页面控件，只读状态辅助路线，没有传送、遥控 AI 或改血量／相位。每趟使用全新空白 Chrome context，先断言 cookies／origins 为空、正式 SAVE 不存在，再写测试哨兵；未访问用户浏览器存档。前述 GPU／性能缺陷及修复过程保留在下文，不抵消本次实际复验。

- **Stage：75.20秒，HP70 撤离。** 实际伤害23／27／25击杀听觉虫，撬棍耐久60→57；敌人两次15伤害。两堆经正式按住 E 翻找、揭晓，实际带回2薪柴、1武器、1污染物。干路绕行与等待 quiet 后穿越均水伤0；真实中央 VOID 碰撞阻止直穿。17个实机检查点核对玩家正式XY未变、根高度等于共享坡面、脚部局部离地量正常、可见敌人／拾取物使用同一支撑高度。实际像素卡片并未用旧 `root.y=0` 或旧三维身体断言冒充通过。[完整记录](artifacts/iteration-21-spatial/r4-pixel-polish/functional-stage-2026-09-11T16-12-14-825Z/evidence.json)、[原速录像](artifacts/iteration-21-spatial/r4-pixel-polish/functional-stage-2026-09-11T16-12-14-825Z/continuous.webm)、[近敌](artifacts/iteration-21-spatial/r4-pixel-polish/functional-stage-2026-09-11T16-12-14-825Z/06-visible-enemy.png)、[实际携回](artifacts/iteration-21-spatial/r4-pixel-polish/functional-stage-2026-09-11T16-12-14-825Z/90-real-return.png)。[桥接核验](artifacts/iteration-21-spatial/r4-pixel-polish/functional-stage-2026-09-11T16-12-14-825Z/bridge-crosscheck.json)将5次正式伤害与呈现事件逐项匹配顺序／来源／数值，并确认玩家实际模型 `hitAt` 收到最后一次受击；记录器使用前次采样时间，不能要求它与精确帧时间戳完全相同。
- **Vista：73.88秒，HP70 撤离。** 同种子、同样三次命中和耐久消费、两次敌伤、相同两堆与携回，水伤0。最新陆侧收暗后，实际内部13,312像素样点仍全部被不透明黑区覆盖，上水／下层景物 alpha 非零数都为0；外边界仍有景物，与内部缺失分开。中央静止8秒前后截图保留。[完整记录](artifacts/iteration-21-spatial/r4-pixel-polish/functional-vista-2026-09-11T16-13-59-698Z/evidence.json)、[原速录像](artifacts/iteration-21-spatial/r4-pixel-polish/functional-vista-2026-09-11T16-13-59-698Z/continuous.webm)、[最新内部黑区](artifacts/iteration-21-spatial/r4-pixel-polish/functional-vista-2026-09-11T16-13-59-698Z/09-central-void-window-after.png)、[外边界](artifacts/iteration-21-spatial/r4-pixel-polish/functional-vista-2026-09-11T16-13-59-698Z/03-east-boundary-window-after.png)。两趟总耗时包含刻意停留、取证与等待，不用来判定哪条呈现玩法更优。
- **一次自然死亡与隔离：27.08秒，Stage 水伤9次死亡。** 最后一次成功命中记入 attempts9／committed9，HP0，带入库存全损，耐久消费账本为空；敌人保持巡逻、未交战。结束后等待1.2秒没有新增水伤。随后正常 R 返回→切 Vista→Esc 暂停／恢复→中止→重开→刷新，正式 SAVE 哨兵全部不变。两线完整路线也分别验证了 Tab 不暂停、Esc 暂停时世界与呈现流帧冻结；真实撤离由正式结算完成，未用中止代替。[死亡／生命周期记录](artifacts/iteration-21-spatial/r4-pixel-polish/death-stage-2026-09-11T16-15-59-358Z/evidence.json)、[原速录像](artifacts/iteration-21-spatial/r4-pixel-polish/death-stage-2026-09-11T16-15-59-358Z/continuous.webm)。本轮没有重复 R3 的0／0.5／1.2秒倒下姿态专项；正式死亡蒙层保留，不宣称完成无遮挡死亡动画的美术验收。

最终三趟0 pageerror／0 shader error；favicon 404 单列，游戏资源未缺失。Stage完整段rAF中位16.7ms／p95 16.8ms，最大166.6ms、14帧>50ms；Vista16.7／16.7ms，最大83.4ms、11帧>50ms。死亡段16.7／16.7ms，最大716.6ms出现在结束归档附近，3帧>50ms。截图、只读完整记录序列化与录像均开启，未把这些长帧删除，也未穷尽归因；不存在此前持续100ms级回退，但不能据此承诺无卡顿、普通设备60fps或跨浏览器兼容。

**结论边界：** 最终两局部的正式搜撤／战斗／死亡／隔离、坡面接线、内部黑区语义和 GPU 可运行已有本轮证据。水流供水→落下→断流后余水的原速片段已记录，两线均有完整自然周期；画面中的重量、像素归属感、坡面脚下是否充分可信仍留给用户空间／视觉判断。ROOT已对有限精修首图放行功能验收，不等于用户整批PASS。首个世界／生产镜头未锁定，阶段四A持续供给仍 **NOT-STARTED**。

最终工程检查由 ROOT 独立执行并回报：全量 `npm run build`（含 TypeScript）通过，16份CSV生成文件重生成完全一致，最终 `check:spatial-slices` **41组通过**，包括6步二分修复后的种子42／8360ms闭合边回归。其中本 QA 独立运行过31组，另8组像素绘制与2组净空／坡度由对应实现侧执行，未冒充本 QA 全量重跑。QA 自有脚本语法检查与范围内 diff 检查通过。

## R4 中间缺陷与修复记录（历史，非当前阻断）

ROOT 将海柱／法线／轮廓交点改为网格共享缓存后，独立 [性能短复验](artifacts/iteration-21-spatial/r4-pixel-polish/smoke-stage-2026-09-11T16-10-07-481Z/evidence.json) 已恢复：1097帧，rAF 中位16.7ms／p95 16.7ms／最大33.4ms，超过50ms为0；GPU闸门通过，仍保持约36.7k海体三角。首帧启动不计入持续 rAF 样本。该趟结束后，ROOT 后台几何检查另发现种子42／8360ms的退化轮廓交点，已改回6步稳健二分并通过该反例；上面的最终长路线是在这次修复冻结后执行。未以种子7短测覆盖其他种子的边界失败。

此前有限精修已正常绘制，ROOT 首图认为肌理／黑三角问题改善，但短冒烟发现明确性能回退：[smoke-stage](artifacts/iteration-21-spatial/r4-pixel-polish/smoke-stage-2026-09-11T16-03-11-709Z/evidence.json)。同一开发机器、唯一 headless Chrome、相同录屏，rAF 中位 **100ms**／p95 **116.7ms**（此前16.7／16.8ms），364帧中303帧超过50ms；东侧实际 `renderMs` 为107.4–108ms。绘制三角约95–98k，海体约36.7–37.1k；无 pageerror 或 shader error。该结果曾阻断长路线，修复后结果见上段；失败原片保留，不删除也不当当前性能。下文前一版短冒烟保留为历史事实。

用户对 R3 的判断是部分方向可行，并非整批通过；已授权继续完善像素角色、起伏地貌、水体和落水运动。R4 还明确修正内部 VOID 的含义：内部缺失区域必须不可知，不显示深层世界、巨物或反光；景观只存在于地图外边界。本节以该最新任务合同为准，旧版中央窗口材料保留为历史，不能继续用作正确表现的证据。阶段四 A 持续供给仍 **NOT-STARTED**。

本次独立执行的纯检查：

- `check-slices.ts`：8 组通过；同种子独立状态、真实 VOID、双侧退路、可达性拒绝、凹多边形接触、末次结束不伤、天然孔洞与地面分离、真实 FLOOR 取样覆盖。覆盖率 75.3%–77.6% 只是机制数据。
- `check-flow.ts`：6 组通过；逐毫秒覆盖三个周期，落水前沿到地／尾沿离地的区间与原正式伤害相位相等。两前沿单向下降、加速落下、断供后余水、复用帧和暂停同时间重复取样、非法时长拒绝均已验证。实际地图 52 格内部 VOID、306 格外部 VOID，封闭与四向连通反例通过。曾发现 `fallTravelMs=0/-1/NaN/Infinity` 未拒绝并可产生非有限前沿，ROOT 修复后本检查复验通过；当前 CSV 780ms 未触发该缺陷。
- `check-ground.ts`：6 组通过；直接读取实际网格的 15,328 个索引三角面，以 30,656 个面内点和面法线核对高度场，不复制插值公式。崖缘接点、接缝连续、复制隔离、玩家／敌人真实脚点、拾取物贴坡及隐藏对象不残留通过。
- `check-stage.ts`：11 组全部通过；已把旧平面 `root.y=0` 断言换为共享地形高度，并新增真实像素卡片、二值 alpha、nearest 采样及深度写入检查。海体接缝组也已在最终接线后运行，没有跳过。

以上共 31 组为本次实际运行。没有以旧版构建／实玩绿灯代替 R4。全构建由 ROOT 统一安排，避免与施工并行重复；代码代理的净空／坡度专项属于他方证据，与这里的网格插值检查分别记账。

首轮 GPU 冒烟发现阻断：海体 fragment 中使用 GLSL 保留字 `patch`，导致编译失败，几何存在但水体不可见。`pageerror=[]` 并不能捕获 Three 写入 console 的 shader 错误。原始 [look-stage 记录](artifacts/iteration-21-spatial/r4-pixel-polish/look-stage-2026-09-11T15-54-37-242Z/evidence.json) 与 [明确失败判定](artifacts/iteration-21-spatial/r4-pixel-polish/look-stage-2026-09-11T15-54-37-242Z/gpu-verdict.json) 保留；原脚本的 `inputChecksPassed=true` 仅表示输入路线走完，不是渲染通过。ROOT 已改名，测试脚本新增即时 GPU 闸门，以下短复验已确认修复。

R4 短录实际结果（依次运行，全新空白 context，先断言正式 SAVE 不存在，再设置哨兵；没有并行浏览器）：

- Stage：自然时钟 33.01 秒，真实东侧绕行、干地等待完整落水周期、靠近真实追敌。水体 GPU 已绘制，像素角色／虫与坡面可见；没有操纵 AI、相位或位置。[干地看落水](artifacts/iteration-21-spatial/r4-pixel-polish/gpu-stage-2026-09-11T15-56-51-224Z/03-active-water-from-dry-ground.png)、[近敌坡面](artifacts/iteration-21-spatial/r4-pixel-polish/gpu-stage-2026-09-11T15-56-51-224Z/06-enemy-and-slope.png)、[原速录像](artifacts/iteration-21-spatial/r4-pixel-polish/gpu-stage-2026-09-11T15-56-51-224Z/continuous.webm)、[记录](artifacts/iteration-21-spatial/r4-pixel-polish/gpu-stage-2026-09-11T15-56-51-224Z/evidence.json)。没有完成战斗或翻堆，本趟中止不能当撤离／死亡通过。
- Vista：真实东界观察、干地完整水周期、绕西侧到中央实际 VOID 边，正向撞边后自然静止 8 秒。读取实际最终遮罩和两份渲染像素缓冲：内部 13,312 个样点全部为不透明黑底；上水、下层世界非透明像素均 0。外边界景物像素 26,408→26,414，内外语义分开。[内部黑区](artifacts/iteration-21-spatial/r4-pixel-polish/look-vista-2026-09-11T15-57-53-604Z/09-central-void-window-after.png)、[外边界](artifacts/iteration-21-spatial/r4-pixel-polish/look-vista-2026-09-11T15-57-53-604Z/03-east-boundary-window-after.png)、[原速录像](artifacts/iteration-21-spatial/r4-pixel-polish/look-vista-2026-09-11T15-57-53-604Z/continuous.webm)、[记录](artifacts/iteration-21-spatial/r4-pixel-polish/look-vista-2026-09-11T15-57-53-604Z/evidence.json)。黑区阶梯外轮廓仍很规整，不能凭不泄露断言其视觉已合适。
- 两趟均 0 pageerror／0 shader error，启动和中止 SAVE 哨兵不变。各有两条 favicon 404，未涉及游戏资源缺失。rAF 中位数16.7ms／p95 16.8ms；Stage 最大83.4ms、3帧超过50ms，Vista最大66.7ms、2帧超过50ms。仅当前开发机器 headless Chrome、录屏开启下的短样本，不是低配／多浏览器认证。

这些是早期短路线和渲染接线记录；当时完整搜撤、实际新模型命中／受击、暂停与死亡、完整隔离生命周期尚待执行，现已由文首最终三趟补齐。水流是否在原速下充分可读、整体像素表现是否达标仍留给人审，QA 没有从变化字段或单帧图代签视觉通过。

待源码冻结后的有界实机路线与证据：

1. 两线各一条真实按键搜撤：东侧干路观察完整落水周期→等待 quiet 真实穿越→东堆翻找→北侧正式交战→西北堆→中央 VOID 碰撞与静止观察→西侧撤离。记录正常时钟、正式伤害／耐久／携回、20×20 碰撞、角色坡上脚点及藏物，禁止传送或改变 AI。
2. 原速水流需要肉眼可见供水、前沿加速下降、触地、断供后尾沿继续下降；不能只有字段变化。暂停时同步检查世界、流帧和像素姿态冻结，恢复后连续；不会为演示延长危险时间。
3. 内部缺失在不同自然时刻与转向下保持不透明黑区；检查实际渲染纹理／画面，而非只信硬编码 `interiorVoidPixelsRevealed=0`。外边界可以显示景物，未知敌人和未探索地面仍不提前显露。中央不再要求出现巨物。
4. 需要时仅一次真实死亡与隔离生命周期回归；像素卡片死亡使用真实像素缓冲／可见性观测，不再沿用已删除三维身体的 `torso.rotation.z`。正式死亡蒙层保留，遮住的动作明确留作视觉限制。

新材料保存在 `artifacts/iteration-21-spatial/r4-pixel-polish/`。上述为当时准备计划，完整路线结果见文首；不得把早期短冒烟当最终 R4 画面或美术 PASS。

## 历史 R3 交付时结论与材料

**当时结果：两局部技术验证完成，等待用户空间／视觉判定；随后用户仅肯定部分可行，要求 R4 继续完善。** 基准为 `docs/tasks/iteration-21.md` H1–H5；两线复用正式RiftScene、当时同一`6ee2b48e`世界规则与隔离训练库存。真实搜撤、伤害／耐久、拾取、死亡、切换／重开及保存隔离已验证；最后显示修订已补短取证。技术通过不等于用户美术PASS，也不表示正式新世界、全游戏镜头迁移或Stage4A持续供给完成。

R3 当时送审材料（非 R4）：

- 正俯视：[中央窗口](artifacts/iteration-21-spatial/r3-slices/windows-vista-2026-09-11T14-58-00-687Z/09-central-void-window-after.png)、[东界窗口](artifacts/iteration-21-spatial/r3-slices/windows-vista-2026-09-11T14-58-00-687Z/03-east-boundary-window-after.png)、[原速录像](artifacts/iteration-21-spatial/r3-slices/windows-vista-2026-09-11T14-58-00-687Z/continuous.webm)。
- 三维：[近水](artifacts/iteration-21-spatial/r3-slices/tail-stage-2026-09-11T15-02-16-691Z/03-near-water-terrain.png)、[近敌](artifacts/iteration-21-spatial/r3-slices/tail-stage-2026-09-11T15-02-16-691Z/06-enemy-nearby-terrain.png)、[已见地貌折返](artifacts/iteration-21-spatial/r3-slices/tail-stage-2026-09-11T15-02-16-691Z/07-known-ground-return.png)、[原速录像](artifacts/iteration-21-spatial/r3-slices/tail-stage-2026-09-11T15-02-16-691Z/continuous.webm)。
- 死亡尾动画：[真实轻量取样](artifacts/iteration-21-spatial/r3-slices/terminal-stage-2026-09-11T15-05-34-555Z/evidence.json)、[订正断言后的离线核验](artifacts/iteration-21-spatial/r3-slices/terminal-stage-2026-09-11T15-05-34-555Z/terminal-crosscheck.json)。正式死亡蒙层保留，模型姿态技术证据不能冒充无遮挡动画美术验收。

本报告保留R1/R2及R3施工期失败、较旧画面和有效实玩。不同目录的显示版本不混作最后画面；阶段性规则结果与最终短复核的范围见后文。下面R1/R2结论均为历史，不代表尚未实施当前双线。

## 历史范围与判定：R1／R2

依据：`docs/tasks/iteration-21.md` F1–F4（DEC-149）、`docs/design-notes/rift-environment-expansion.md` §5.5、`docs/dev/spatial-study.md`。**R1 技术验证仍有事实证据，但用户视觉验收为 30/100，已明确否决；本样板整体未通过。** 阶段四 A 持续供给仍 **NOT-STARTED**。

## 历史用户判定：R2斜俯视未接受，正俯视有条件待改（DEC-151）

用户指出斜俯视中的角色与海体/远落水呈现相互矛盾的物理角度。正俯视意外地较好，但要求海分布到地图大部分区域、增加动态镂空、去掉规则圆形落水。因此整体不记PASS；正俯视不是已经选定的生产镜头。

本轮交付两条后续设计路线，见[环境提案](../design-notes/rift-environment-expansion.md#spatial-presentation)，没有修改或重验R2实现。下文技术结果、连续录像及交付时的“待重审”记录按原事实保留，不抵消此次用户反馈。四A仍NOT-STARTED。

## R1用户判定：视觉否决

用户给出 30/100，明确指出四项：

1. A/B 的海侧边同构，未形成有效的空间表现差异。
2. 海像静态贴图，缺乏厚度和可见的主运动。
3. 角色被遮挡后，海与地面仍读作平贴，未建立上下空间。
4. 边沿瀑布的来处抽象，看不懂水从哪里进入、如何触地及回收。

这些是空间表达核心失败，不能用“碰撞正常、海层未闪、相位在变”抵消。此前 QA 关于 B 更有间隔的局部判断不等于空间表达成立，也不覆盖用户否决。R1 全部技术结果、试探记录和原始录像保留在下文；其中“R1/R2 路线”原指路线一／路线二，**不代表重做版本 R2 已经测试**。

**当前 R2 最终310高度版功能复验完成，具备送回用户重审的证据，尚无用户视觉 PASS。** 下文保留准备时合同及变更经过，最新执行结果见文末“R2最终执行结果”。 B compression=.52 为研究底座，A 更新为真俯视 heightProjection=0（无虚构侧边），不代表用户选择 B，也不代表已锁定生产镜头。R2 最终参数以冻结后的任务／开发合同为准；不继承 R1 的视觉结论。


## R1已完成的实际执行方式

入口 `/spatial-study.html?view=a|b&seed=7`，同 `fixtureSignature=0c776971`、同普通白板撬棍、同水幕和真实 RiftScene。脚本：`tools/spatial-study/qa-playthrough.mjs`。所有移动、转向、攻击、翻找、撤离均为真实 WASD / Space / E 按键及页面控件；自然游戏时钟；只读位置和相位用于决定下一步，不传送、不修改敌人、不直接扣血或结算。WASD 负责转向，未使用不存在的鼠标瞄准。

每趟独立 Chrome `newContext()`，先断言 `storageState={cookies:[],origins:[]}`，再断言正式 `coh-save-v1` 不存在才写入本测试的哨兵。未读取、覆盖或访问用户浏览器的存档。记录器为 100ms 生产观测；录像 1080×720 / 25fps；浏览器视口 1440×960。JSON 含实际事件、库存账本、坐标、footprint、相位与伤害计数。全批页面异常为 0。

## 完整往返结果

- **R1-B，48.60s，HP55 撤离。** 观察水幕下探、落地和回卷后，等 quiet 实际通过；折返再通过，全趟水幕尝试／命中均 0。普通撬棍实际伤害 23、28、28，敌人 75HP 被击杀，耐久 60→57；玩家受到该敌人三次 15 伤害。两处翻堆均按住 E 完成，正式携回 2 薪柴、1 武器和 1 普通结线污染物，两个新物件在结算后进入 stash。证据：[r1-retry-b](artifacts/iteration-21-spatial/r1-retry-b/evidence.json)、[连续录像](artifacts/iteration-21-spatial/r1-retry-b/continuous.webm)。
- **R1-A，55.03s，HP55 撤离。** 相同普通配置、相同安全等待和战斗／两堆携回闭环；实际伤害 27、28、28，耐久 60→57，敌方三次 15 伤害，水幕尝试／命中 0。证据：[r1-a](artifacts/iteration-21-spatial/r1-a/evidence.json)、[连续录像](artifacts/iteration-21-spatial/r1-a/continuous.webm)。A/B 深覆盖的投影边界不同，因此折返地标与等待时点不同；这两个总耗时不能用于宣布 B 的玩法效率更高。
- **R2-B，47.70s，HP73 撤离。** 在 falling 阶段真实接触，`PLAYER_DAMAGED` 来源为 `environment:sea-curtain`，承受 12 伤害；随后从西侧 x384 旁路深入，水幕命中始终保持 1。深覆盖区远敌不可见→近身合法可见→向西远退后不可见，敌人继续按正式 AI 追逐；途中另受该敌人 15 伤害。没有攻击消费，深处污染物实际翻找并带回。证据：[r2-retry-b](artifacts/iteration-21-spatial/r2-retry-b/evidence.json)、[连续录像](artifacts/iteration-21-spatial/r2-retry-b/continuous.webm)。
- **R2-A，47.73s，HP73 撤离。** 同样实际水伤 12、敌伤 15、旁路没有新增水伤、同敌不可见→可见→不可见、深堆携回，武器未消费。证据：[r2-a](artifacts/iteration-21-spatial/r2-a/evidence.json)、[连续录像](artifacts/iteration-21-spatial/r2-a/continuous.webm)。

四趟共 2023 个空间样本，footprint 一直 20×20，显示 groundY 始终为物理中心 y+10；未观察到通过投影改变实体碰撞。A/B 水幕定义、初始布置与 seed 相等。实际西侧旁路通过，东侧旁路仅在几何可达检查中覆盖，不冒充东侧实玩。

## 空间、遮挡和战斗画面

R1 两种模式均深入 y≈200，并在深覆盖区左右横走三次、越过本模式海体投影边界折返三次。原始录像保留全过程；另提取 A 的 35–49s、B 的 34–46s，以每秒 4 帧检查：[A 接触表](artifacts/iteration-21-spatial/frame-review/a-contact.png)、[B 接触表](artifacts/iteration-21-spatial/frame-review/b-contact.png)。所查片段中，局部剖切跟随移动和转向，外围海体保持存在，没有出现全海瞬隐或边界触发的开关式跳闪。不是对所有运行设备或每一原始视频帧的零闪烁保证。

B 在海下缘和地面之间保留更明显的垂直间隔；A 深处呈现更接近平面水面上的局部揭示。两者都有实际可走海床、头顶覆盖和周期落地水幕。此为 R1 当时的局部观察；后续用户以 30/100 否决整体空间表达，该观察不能作为继续沿用 R1 的依据。

Fog 正反例截图：R2-B [尚未可见](artifacts/iteration-21-spatial/r2-retry-b/05-covered-unknown.png)、[合法可见](artifacts/iteration-21-spatial/r2-retry-b/07-legal-visible.png)、[重新不可见](artifacts/iteration-21-spatial/r2-retry-b/08-returned-unknown.png)。在正式 visibility=0 的截图中未发现敌人身体或血条；剖切没有清掉原雾。翻堆使用生产搜寻／揭晓，未在搜寻前直接展示内容物。未穷尽所有遮墙角度和所有敌人类型。

**青色屏缘短横线是既有合法威胁提示，不是泄露。** 来源 `src/ui/dom/detection-pulse.ts`，`docs/specs/ui-detection-pulse.md` 明确要求视野外也提示正在察觉／追击的方向。R2 退到 enemy visibility=0 时，其 chase/detection=1 仍使屏缘显示；之后 return/detection=0 衰退。它不展示身体、血条或物件内容。

实际挥击、敌人命中和消亡反馈由视频抽帧核对：[战斗片段](artifacts/iteration-21-spatial/frame-review/hit-contact.png)。发现一项**继承的表现限制**：玩家受击用明亮矩形覆盖身体，[实际帧](artifacts/iteration-21-spatial/frame-review/hit/017.png)；`src/systems/combat-system.ts:988` 原本即明确采用 provisional white rect。不是本批新产生的故障，也不等于玩家受击美术已完善。本批未擅自改正式战斗表现。

## 正式死亡和生命周期

[death-final-b](artifacts/iteration-21-spatial/death-final-b/evidence.json) 为实际站在水幕区等待致死，敌人没有交战：9 次正式环境命中，HP100→0，全部带入物丢失，武器消耗统计为 0（死亡没有冒充耐久消费）。等待正常结算表现延迟和 `RIFT_EXITED` 后，记录 outcome=death、库存 run.outcome=death，最后一次水幕命中也被记录为 attempts=9 / committedHits=9。不是用中止替代死亡。[连续录像](artifacts/iteration-21-spatial/death-final-b/continuous.webm)。

R2-A 携回后，实际 R 返回配置→A 切 B→开始→Esc 暂停（等 300ms 游戏 elapsed 不变）→继续→中止→重开→刷新。正式 SAVE 哨兵在启动、实际携回、死亡、R 返回、切换、暂停、中止、重开和刷新检查点均保持不变；详见该 JSON 的 checks。生命周期另存于 lifecycleRecords，完整路线记录在 records，不因刷新丢失 QA 证据。

本批没有再次故障注入存储后端；失败保存的回滚证据来自已完成的 build-lab 领域检查，不能声称本次重新跑过其所有异常分支。新入口真实验证的是隔离接线和正常／死亡生命周期。

## 保留的试探记录与准确范围

- [r1-b 首次](artifacts/iteration-21-spatial/r1-b/evidence.json)：脚本固定向左挥，但敌人绕到右后，12 次空挥、0 耐久消费、HP10，未完成。随后改为实际 WASD 接敌转向，生产代码未变；不能把误朝向空挥报成判定 bug。
- [r2-b 首次](artifacts/iteration-21-spatial/r2-b/evidence.json)：只退到 x384，敌人已追到身后约 75px，visibility=.2 正确；“应完全隐藏”的脚本断言过早。延长真实撤退至 x128 后取得完整正反例。保留原失败路线，没有关闭追踪或搬走敌人。
- [death-b 首次](artifacts/iteration-21-spatial/death-b/evidence.json)：已实际死亡且库存全损，但脚本只等了 250ms，早于正式 `RIFT_EXITED`，记录仍 running。该脚本当时仅检查库存而返回 passed=true，**不计作完整死亡归档通过**；修正测试等待后由 death-final-b 证明最终归档。未修改游戏来绕过等待。

## 构建、性能与未覆盖项

独立执行 `npm run check:spatial-study`：5 组通过，包含重开数据新鲜、封闭整块危险区仍可达翻堆、相位连续与安全预兆、尝试间隔／阻断与成功命中分开统计、quiet 与两侧旁路无伤。`npm run build` 独立通过（TypeScript + Vite，245 modules）；保留既有单 chunk >500kB 提醒。项目没有统一 `npm test` 脚本。

四趟完整记录均 rAF 中位数／p95 约 16.7ms。R1-A 有 1 次 133.3ms 长帧，其余三趟最大约 33.4ms；无页面异常。这里测的是当前开发机器、Chrome headless、录屏开启、Vite 开发服务下的 rAF 间隔，**不是 GPU 帧耗时、普通设备 60fps 承诺、首屏大小验收或全浏览器兼容结论**。Firefox/Safari、低配设备和长时性能未测。

**结论边界：F 样板具备真实可操作、可往返、危险／绕行有效、原雾有效、正常和死亡结算隔离的独立功能证据。** 尚未选定生产镜头、接入正式环境生成或完成持续供给阶段。R1 用户视觉终审已经否决；R2 尚未测试。


## R2验收准备记录：先证明体积与动势，再验证操作闭环

本节保留制定时的验收计划，**不是执行结果；实际覆盖和未覆盖以文末结果为准**。保留 R1 原始目录不覆盖，新证据将放入 `artifacts/iteration-21-spatial/r2-volume/`；脚本待正式接口冻结后才更新路线。当前接口约定水源(592,544)、接地区为144×88椭圆（CSV `footprint=ellipse`，半轴72／44）、front基线680、海底150／海顶300、周期不变。旧两堵并行墙已移除；唯一礁石墙位于(816,528)，即col25,row16的一格碰撞，最终高度310（最后一次冻结前由230调整，碰撞和坐标不变）。原(816,624)位置废弃；敌人／翻堆不变。它们是待核对参数，不能直接把旧112px半宽或旧front544路线套到新版。

### 第一门：正常速度画面必须能自行说明空间

1. **静止观察主运动。** 在能同时看见海体上面、圆转侧腹、下面及一段干床的位置静止，录至少两个完整周期（暂约20秒）。隐藏调试读数再以正常速度观看原片：海体轮廓、侧腹体积、下腹或内部水流必须有可读运动，不能只有高光闪、噪声抖或贴图整体平移。主运动须在角色不动时仍成立；不靠加速播放、差分图或 JSON 坐标变化证明“活着”。
2. **真实厚度与上下距离。** 沿干床真实侧走／靠近／退开，让同一块礁骨成为固定高度参照。画面应能同时指出海顶、圆转侧腹、底面与地面；侧腹不能只是波浪边沿挤出一条等宽带，不能换材质后继续读作旧版平面。礁骨穿入、遮挡、投影与海体运动应形成一致的前后关系。只读投影量用于定位失配，不能代替画面判断。
3. **深入后仍是头顶海体。** 进入实际底层逻辑与顶层投影都覆盖的深处，横走并折返三次。剖切附近要保留可辨认的底面／侧腹／高度线索，让角色处于海下而非水贴图上挖洞。剖切不能一进入就隐掉所有证明体积的结构，不能借全图透明来“让角色看清”。检查脚底、礁骨和地面锚点未滑动，转向不造成海体开关式显隐。
4. **水源→触地→回收连续因果。** 站在接触区外，从海内部下垂源开始观察完整 quiet→下降→触地→回收，至少两轮。正常速度应看见水源与海腹连接，下降前保留地面间隔，触地有位置一致的接触表现，回收沿同一关系返回或清楚收尽；不能仍从屏幕／海体裁切边缘无因喷出一块瀑布。暂停截图只辅助标注，不替代连续片段。

第一门的证据为三段短原速连续录像（静止体积／走位深入／完整水流周期）及对应关键帧。观看时先不看字段，能否仅根据画面指出“海上面／下面在哪里、角色在什么高度、水从哪里到哪里”是直接判断。若仍只有平面纹理或来历不明瀑布，**报告 VISUAL-BLOCKED，明确本版未成立**；可继续有限定位，但不以工程绿灯宣告交付，不代用户把分数抬高。

### 第二门：表现变化没有破坏真实规则

在第一门形成可审查证据后，采用正常输入完成以下最小回归，不扩大武器或敌人范围：

- 等安全期实际穿越；危险期接触一次后离开，核对正常速度下触地时刻、实际玩家位置与生产 `PLAYER_DAMAGED` 来源／HP。再从一侧干床绕行并携回；新危险区椭圆宽深须与可见触地区相合，不能水尚未到地便凭相位判伤，也不能水落在角色身上而仅脚本框外无事。
- 椭圆边界专项：静态／纯检查核对归一化距离 `(dx/72)^2+(dy/44)^2≤1`、轴端含边界、旧矩形四角在外。实玩至少保留中心(592,544)危险正例和旧框内但椭圆外的(652,580)附近安全反例（归一化值约1.36），均在实际触地相位；以实测停点计算而非假定按键精准到达。判定继续按合同中的玩家逻辑中心，显示脚底偏移单列，不擅自改成整个人体碰撞。接地区贴图应与这一判定相合。
- 新礁骨专项目测与真实侧走：中心(816,528)保持世界定位，有一格物理碰撞；不能因投影把碰撞留在屏幕图像另一处。东侧x816穿越y512–544的直线路线已不能直接沿用；正式路由选实际可达旁路，西侧代表绕行不受该新增礁骨影响。
- 普通撬棍实际命中现有听觉虫、受击、翻找两处既有堆并正式撤离，确认新海体和剖切不遮掉攻击预兆、搜寻物或交互提示。只需同一正式链路的代表性复验，不再重复旧 A/B 四趟。
- 同敌尚不可见→合法可见→离开后不可见；海体剖切不得剖开原 fog。已锁定的屏缘察觉提示按既有合同保留，不能把它误判为身体泄露。记录世界可见性与实际画面两种证据。
- 新开独立空浏览器上下文继续 fail-closed SAVE 哨兵。覆盖开始、正常结算、R 返回、重开、暂停和刷新；若危险／致死／归档接线变化，再做一次完整真实死亡并等 `RIFT_EXITED`，不止检查库存已结算。
- 读取当前 footprint／显示脚底／投影锚点，核对固定投影没有改正式物理、技能范围、碰撞或 AI；轻量记录正常走动和水体主运动同时发生时的长帧。设备与浏览器范围仍准确披露。

### 冻结前待确认信息

- 新入口／query 与最终单视角行为；暂定数值和实际水源、地面接触区、可走旁路是否已落实。
- 礁骨与海体上／侧／下表面的定位信息、深覆盖区，及源点／触地／回收状态只读字段。若没有字段可直接用画面和既有规则验，但不得编造测量值。
- 新版是否改到正式危险、死亡或归档接线，决定条件性回归范围。
- 源码和材质均已冻结的通知。通知前不启动新版实玩，不沿用 R1 技术通过标签给新版背书。


### R2冻结前最终接线更新

- `presentationRevision=r2-volume-rework`；新版脚本 `CASE=v2-visual-a|v2-visual-b` 先记录原速观察，`v2-reef-b` 专查礁石前后关系，`v2-functional-b` 执行椭圆安全角／真实接触／开放旁路及正式战斗翻找携回。脚本执行结束只代表路线执行，不代表视觉门通过。
- 礁石一直使用原脚底排序。共享 `VisibilitySystem.revealProjectedTerrain` 只在本样板调用，以礁石不透明像素和基部可见度在原雾上投影；已删除的“复制高段到50.5层”不属于本次实现。必须独立核对正面角色盖石、背面石盖角色、未见敌人不因擦雾泄露；同时静态确认正式无调用路径不变。
- 旧墙移除后，敌人感知、接敌和撤退可能改变；R1成功路径的结果不迁移到新版。实际绕行用 x712／x720 等避开水椭圆与唯一礁石，礁石两侧绕行用x760／x872，绝不穿其一格实体碰撞。


## R2最终执行结果（310高度冻结版）

**技术状态：独立复验通过；视觉状态：内部认为具备重审条件，用户尚未验收。** R1 的30/100否决仍有效，不撤销、不改为PASS。R2 数据签名 `d6b322c2`，`presentationRevision=r2-volume-rework`，B=.52、A heightProjection=0；唯一礁石(816,528)、高度310、物理墙25:16:1:1。以下记录均为独立空上下文、正常时钟和真实按键；未改生产源码，未操纵敌人／碰撞／伤害。

### 已取得的视觉证据与判断边界

[R2原速观察录像](artifacts/iteration-21-spatial/r2-volume/v2-visual-b/continuous.webm)保留静止约20.5秒的两轮周期，以及真实侧走、礁石前后和深海覆盖。该趟发生在礁石230→310的最后数据变更之前，签名`2685e1cb`，**仅用于未再改变的海体／水幕运动记录，不冒充最终310礁石验收**。脚本 `visualVerdict=NOT-REVIEWED` 刻意不让按键路线的 passed=true 代签视觉通过。

QA 核对了正常时钟录像对应的静止／前后／深处画面，明确能看到与 R1 不同的圆转侧腹、海腹到干床的空隙、礁石贯入关系和触地水流；这不是只读geometryRevision得出的结论。ROOT/art另做原速视觉复核，认为本版不再是旧两腿／冰洞构型，具备重新送审条件。**海内水源的纵深是否足够清楚、深入海下是否有应有压迫感仍待用户重审**，不能把这两项机械勾成成立；QA也没有给新版打分。

最终310礁石近观证据：[南面](artifacts/iteration-21-spatial/r2-volume/v2-reef-final-b/03-reef-south-occlusion.png)→[北面](artifacts/iteration-21-spatial/r2-volume/v2-reef-final-b/04-reef-north.png)→[返回南面](artifacts/iteration-21-spatial/r2-volume/v2-reef-final-b/05-reef-south-return.png)。对应[连续录像](artifacts/iteration-21-spatial/r2-volume/v2-reef-final-b/continuous.webm)与[JSON](artifacts/iteration-21-spatial/r2-volume/v2-reef-final-b/evidence.json)：南面角色可见，北面被礁石实体遮住，回南面恢复，基脚连贯。全段实际20×20 footprint与礁石碰撞矩形内部重叠样本为0，没有通过礁石物理实体来制作前后效果。

在南面观测点，敌我连线经过礁石y528时x805.74，处于墙800..832内；敌人保持visibility=0、画面没有其身体／血条。礁石的可见上段没有把后方未知敌人带出来。静态调用复核：`revealProjectedTerrain`只有RiftScene DEV接缝提供给本样板，生产没有独立调用；礁石保留原脚底depth，按自身不透明像素／基部visibility擦原雾，不存在复制到50.5层的旧方案。逻辑视野提供器未被替换，原有敌人自身visibility判定仍在。该范围内没有发现公共fog回归；不宣称穷尽所有地形和敌人组合。

### 真实规则、实际携回与失败记录

[最终功能趟](artifacts/iteration-21-spatial/r2-volume/v2-functional-b/evidence.json)／[连续录像](artifacts/iteration-21-spatial/r2-volume/v2-functional-b/continuous.webm)：55.06秒，HP34正式撤离。

- 旧矩形内部但椭圆外的真实停点约(658.82,575.41)，归一化距离平方约1.37；falling阶段extension=1，实际水幕inside=false、attempts=0、committedHits=0。不是只测名义点(652,580)。[安全角截图](artifacts/iteration-21-spatial/r2-volume/v2-functional-b/03-old-rectangle-corner-safe.png)。
- 等quiet后真实直穿，全段到第一次战斗前水伤0。普通撬棍实际命中27、25、28，击杀75HP敌人；耐久60→57。玩家受到两次敌人15伤害；没有用空挥次数代替命中。
- 两堆按住E完成，实际携回2薪柴、1武器、1普通结线污染物；深覆盖区横走三次，footprint20×20与groundY=y+10保持。旧双墙已经移除，路径和警觉数据是本次重新运行所得。
- 返程故意进入落地水幕，首次截图时HP70→58，之后原地取证与转向离开期间又两次受12伤害，共3次正式环境命中，最终HP34。三次事件间隔约800ms，来源均`environment:sea-curtain`。[实际接触截图](artifacts/iteration-21-spatial/r2-volume/v2-functional-b/08-actual-contact.png)。**没有把这次长接触写成只有一次12伤害。** 脱离至东侧x712后，继续绕行到y736无新增水伤，再回起点正式结算。

[v2-reef-b首次](artifacts/iteration-21-spatial/r2-volume/v2-reef-b/evidence.json)保留了一次测试预设断言失败：要求南侧观察点x>832过严；y570处玩家占y560..580，与礁石y512..544本就不相交，x828也可合法站立。修正的是测试路点约束，生产无改动；最终通过趟另对全部实际footprint核验无矩形穿越。该失败不能计入通过趟，也不是物理穿墙bug。

### 真实死亡、真俯视与入口生命周期

[最终死亡／生命周期](artifacts/iteration-21-spatial/r2-volume/v2-death-b/evidence.json)／[连续录像](artifacts/iteration-21-spatial/r2-volume/v2-death-b/continuous.webm)：站在真实椭圆内自然经历9次水幕命中后死亡，0敌人交战；库存全部丢失，耐久消费统计0。等待正常结算延迟与`RIFT_EXITED`，最终record.outcome=death，attempts/committedHits=9/9，末次未丢记。

之后真实R返回→切A开始→Esc暂停并确认elapsed保持→继续→中止→重开→刷新。新A实际projection.heightProjection=0，[截图](artifacts/iteration-21-spatial/r2-volume/v2-death-b/93-true-top-down.png)未继承旧人工侧边。该A仅为短技术核对，**没有重跑A完整战斗／携回，也不作为用户选择A或B的依据**。

正式SAVE哨兵在开始、正常携回、死亡、R返回、切换、暂停、中止、重开、刷新后均未改变；沿用空context及写哨兵前assert-null的失败关闭机制，没有访问用户存档。失败存储后端故障注入本次未重跑，不将既有领域测试冒充本次实玩。

### 工程与范围收口

独立执行最新 `npm run check:spatial-study`：7项空间／接触规则 + 11项体积几何与光栅，共18项通过。覆盖闭合体积／变化厚度、内源开口、斜向边缘、连续落水与接地区、运动裂口、真实离散水片／触地碎水不扩大危险区、逐像素深度与提交顺序无关。地形雾照明另由上述礁石实玩及静态接线复核验证。独立 `npm run build`（TypeScript + Vite，245 modules）通过，保留既有>500kB chunk提示；共享构筑9组回归由代码／ROOT通过，本次QA没有重复跑那9组。

本次最终功能、礁石、死亡三个记录均无页面异常。rAF p95约16.7–16.8ms，功能趟最大66.6ms（1次>50ms）；仍仅说明当前开发机器Chrome headless录屏下观测，不是普通设备或所有浏览器性能承诺。没有为录像临时调低水体质量。

**本版可送用户重审，不可结案为视觉PASS。** 保留内源纵深、海下压迫感的终审项；首个生产世界、生产镜头选择与Stage4A持续供给都未完成。本批QA工作只修改测试、报告和证据。


## R3双线完整局部：验收准备与纯规则结果

日期：2026-09-11。依据 `docs/tasks/iteration-21.md` H1–H4（DEC-152）及本批任务简报。**当前仅纯规则已验证；两条呈现、浏览器实玩与视觉尚未验收。** 本段不改变上述R1否决与R2历史证据，也不沿用旧样板的路径结论。已显式读取 `.cursor/agents/qa.md`，未读取用户禁用的美术skills或HOW。

本次实现基准是 `src/dev/spatial-study/slice-world.ts`、通用 `fixture.ts` 与 `data/spatial-slice-*.csv`。当前局部为31×27格，起点／撤离(496,752)，中央真实VOID；两翻堆(784,464)/(272,272)，听觉虫(752,304)，礁石(688,592)。落水中心(784,592)，接地由CSV不规则多边形定义，包含凹口；不再使用R2椭圆合同。

独立运行 `node --import tsx tools/spatial-study/check-slices.ts`，**8组通过，0失败**：

- 同种子两份世界的布局、敌人、拾取与签名相同，地图和时钟不共享可变状态；不同种子可区分，非法种子拒绝。此项只验证两消费者使用的领域对象，尚未验证stage/vista入口实际接线。
- 全部已声明VOID在地面、outline与通行判断中一致。所有478个真实FLOOR格、撤离、两翻堆、敌人出生与巡逻点均从出生可达。
- 中央断口东西两侧各有可往返路线，排除一个完整周期中实际活动水多边形的取样覆盖仍成立。危险区以25ms取样、每格中心及四个±8px点检测；这是格图与实际多边形的离散证明，不替代20×20角色的连续实走。
- 通用fixture对断开地面岛屿中的出口、巡逻点拒绝创建。初次反例发现两者原先只检查FLOOR，出口可位于不可达孤岛，巡逻也可跨组件；ROOT已补同一可达组件校验，本次复验两个反例均正确失败关闭。没有由QA修改产品代码。
- 独立U形凹多边形边界、反向顶点与凹口测试，以及实际水多边形的顶点／边中点测试通过。实际凹口点落在旧椭圆内但不受水覆盖，未退回包围盒／椭圆判定。
- 实际世界回调传递正确伤害来源与数值；非活动、凹口、同帧重复、间隔未到均无额外调用。拒绝提交的回调只计attempt，成功才计hit；最后一次结束后停止。这里使用回调探针，尚未运行正式Combat适配器、HP与死亡结算。
- 天然孔洞随世界时间改变；两实例同时间、不同玩家位置得到相同海体场与落水轮廓。时间推进不修改地面通行；真实地面上确有开口与覆盖发生转换。
- 以全部478个真实FLOOR格中心为分母，种子0/7/101、时刻0/5/15/30秒共12组取样：海覆盖74.3%–78.0%，仍留105–123个空气格点。该数据只说明覆盖分布与存留开口，**不证明可读性、体积、压迫感或审美成立**。

待入口冻结后的最少实机证据：两线各一趟正常速度完整深入／折返，真实走过西、东路径及中央VOID边沿；观察完整落水周期，分别等待安全窗与走旁路；真实接敌／命中受击、两翻堆与携回。原速录像须可见两线各自的海体、孔洞、巨大经过与近处回应，不接受仅探针数值运动。另核对未知敌人不泄露、礁石前后排序与落点连续，死亡及暂停／重开／刷新采用隔离存档哨兵验证。生产HUD、AI、战斗与结算同源须通过实际入口读数和操作确认。

本批依父任务要求未启动浏览器、未在并行施工中运行全构建。Stage4A持续供给仍NOT-STARTED，隔离训练库存不计为供给验收。


### R3正俯视短观察（施工期初看，非最终封版）

已按父任务授权运行 `CASE=visual-vista node tools/spatial-study/qa-slices.mjs`，只做静止两周期和东侧安全观察。首次 `visual-vista-2026-09-11T14-29-25-802Z` 在完成静止录像后遇Stage并行改动触发整页HMR，`__spatialSlices`随刷新暂时消失；ROOT确认同期正在落盘依赖。失败记录保留，不算玩法失败或最终通过证据。

冻结短窗口后的[完整短录像](artifacts/iteration-21-spatial/r3-slices/visual-vista-2026-09-11T14-31-18-866Z/continuous.webm)、[出生两周期截图](artifacts/iteration-21-spatial/r3-slices/visual-vista-2026-09-11T14-31-18-866Z/02-normal-speed-two-cycles.png)、[东侧活动落水观测](artifacts/iteration-21-spatial/r3-slices/visual-vista-2026-09-11T14-31-18-866Z/03-active-water-from-dry-ground.png)、[JSON](artifacts/iteration-21-spatial/r3-slices/visual-vista-2026-09-11T14-31-18-866Z/evidence.json)已保存。真实世界约28.5秒，观察点(885.57,623.88)，falling活动时inside=false、HP100。出生未知敌人visibility=0；正式SAVE哨兵开始和中止后保持。无pageerror、无Vite热更新；有两条未定位404控制台消息，response监听未捕到对应请求，保留为待定位项，不能写成控制台全净。

1716个rAF间隔：median／p95均16.7ms，max33.4ms，>50ms为0；只代表本开发机Chrome headless录屏。静帧能确认覆盖和自然开口进入画面，接地流束相对主海面不醒目，已提交ROOT结合原速录像判断。**本次没有完成战斗、翻堆、穿水、携回、死亡或另一呈现，亦未代签视觉PASS。**


### R3正俯视完整功能趟（首次冻结版）

[实际记录](artifacts/iteration-21-spatial/r3-slices/functional-vista-2026-09-11T14-40-06-526Z/evidence.json)与[连续录像](artifacts/iteration-21-spatial/r3-slices/functional-vista-2026-09-11T14-40-06-526Z/continuous.webm)：61.58秒正式撤离，HP85。实际撬棍伤害23/27/25击杀75HP虫，受到敌人15伤害一次，耐久60→57。两处翻找均正式完成，带回2薪柴、1武器和1普通结线；东侧干燥旁路、等待quiet后穿过落水接地区均无水伤。中央真实VOID在角色中心x342附近阻挡，没有穿越。Tab期间时钟继续、Esc暂停／恢复通过，开始与真实携回后的正式SAVE哨兵保持。

首次 `functional-vista-2026-09-11T14-38-46-346Z` 在菜单检查失败：测试Tab关闭后约100ms立即Esc，命中既有150ms防误触保护。增加250ms自然间隔后通过，未改生产行为；失败记录保留。控制台两条404已定位均为`/favicon.ico`，不是游戏资产；完整趟无pageerror、无HMR。3825个rAF间隔p95=16.7ms、max=66.7ms、6次>50ms，仅为本开发机录屏观测。

**巨物构图未通过。** 东界8秒观测giantX1043.36→996.31、visibleVoidPixels2416；中央8秒为63.97→-7.86、仅336像素。对应两处前后截图没有足够可见证据表明同一巨大形体跨过两个窗口。ROOT检查后确认nearest-rim逐点视野把远景截成窄带，需要显示修复；本趟不可因此标为整体完成。

另原面水A80ms不足以完成180度转向，03图仍偏北，不能拿该图判落水不清楚。后续脚本改D200ms面向东界、A220ms面向西侧落水，读取生产presentationFrame.player.facing确认接近π。新增短窗口路线用于显示修复后复核，不用重复这趟已完成的战斗来替代视觉判断。Stage完整功能、两线死亡／生命周期和修复后窗口仍待执行。


### R3双线玩法与生命周期实证汇总（最终显示微调前）

以下五个有效趟共享fixture签名`6ee2b48e`。规则结果有实际输入、100ms记录和连续录像支持；最后显示微调尚待短复核，**不因此把双线整体或美术标成PASS**。

三维完整路线：[记录](artifacts/iteration-21-spatial/r3-slices/functional-stage-2026-09-11T14-45-21-191Z/evidence.json)／[录像](artifacts/iteration-21-spatial/r3-slices/functional-stage-2026-09-11T14-45-21-191Z/continuous.webm)。63.26秒，HP70正式撤离；命中23/27/25，受敌15两次，耐久60→57，实际带回2薪柴、1武器、1普通结线。已真实完成东侧旁路、quiet穿水、两翻堆、中央VOID阻挡和西侧折返，水伤0。面水截图的生产facing=π，内源落水在画面可见；不是用80ms未完成转向的旧图判断。

三维呈现桥的[逐事件对照](artifacts/iteration-21-spatial/r3-slices/functional-stage-2026-09-11T14-45-21-191Z/bridge-crosscheck.json)来自真实07战斗截图所存presentationFrame，未重跑或补造事件。6个唯一序号按序对应2次player-hit、3次enemy-hit、1次enemy-death；ID／来源／伤害和正式记录相同，死亡位置完全相同。时间差16.67–83.35ms：正式BuildLabRecorder事件沿用上一100ms样本时间，桥记录实际帧时间，故不可声称毫秒完全相等。[639条实机样本复核](artifacts/iteration-21-spatial/r3-slices/functional-stage-2026-09-11T14-45-21-191Z/stage-frame-invariants.json)确认模型origin=[生产x,0,生产y]、body20×20、groundY=y+10；556条visibility=0敌人样本均未显示模型，65条合法可见样本显示。该检查是100ms采样，不是所有帧／所有敌人穷尽证明。

两线正式水伤死亡与生命周期：

- [Vista记录](artifacts/iteration-21-spatial/r3-slices/death-vista-2026-09-11T14-47-03-981Z/evidence.json)／[录像](artifacts/iteration-21-spatial/r3-slices/death-vista-2026-09-11T14-47-03-981Z/continuous.webm)：27.89秒自然死亡。
- [Stage记录](artifacts/iteration-21-spatial/r3-slices/death-stage-2026-09-11T14-48-13-230Z/evidence.json)／[录像](artifacts/iteration-21-spatial/r3-slices/death-stage-2026-09-11T14-48-13-230Z/continuous.webm)：27.08秒自然死亡。

两者均9次正式12伤害，末次记录attempts=9、committedHits=9、生产player:damaged事件=9；库存清空，耐久消费统计为空，结束后等1200ms无新伤害。每趟真实R返回、切另一显示并确认同fixture、Tab世界继续、Esc暂停／恢复、中止、重开、刷新均完成，正式SAVE哨兵全程保持。浏览器从空cookies/origins上下文开始，写哨兵前必须assert-null，没有访问用户存档。失败保存后端注入本轮未重跑，亦不把这些训练库存当Stage4A供给验证。

修复后的正俯视短窗口：[记录](artifacts/iteration-21-spatial/r3-slices/windows-vista-2026-09-11T14-49-32-814Z/evidence.json)／[录像](artifacts/iteration-21-spatial/r3-slices/windows-vista-2026-09-11T14-49-32-814Z/continuous.webm)。东界与中央洞各停驻8秒；中央可见下层像素从旧336增至13312，东界26327，实际画面已出现较完整的下层窗口，未知敌人仍保持visibility=0。面水facing=π。**巨物身份仍偏弱**：能看见下层纹脊不等于能辨认一只巨大存在。ROOT已决定最后增大长度、强化下层轮廓与断口材质，旧窗口证据保留，待新短路线复核；不把giantX变化或面积数字作为构图PASS。

有效趟均无pageerror及游戏资源缺失；仅`favicon.ico`两条404。性能范围：Stage完整功能p95=16.8ms、max100ms、8次>50ms，该趟部分时间可能与code短headless测试并发，非独占性能基准；Vista死亡p95=16.8ms、max49.9ms；Stage死亡p95=16.7ms、max50.1ms；短窗口p95=16.8ms、max50.1ms。后两趟在code浏览器关闭后执行，仍仅代表本开发机Chrome录屏，不承诺一般设备性能。

当前剩余仅为最后显示改动后的Vista窗口与Stage已知地貌／死亡余动画短复核，以及用户审美判断。正式新世界接入、全游戏镜头迁移和Stage4A持续供给均未完成。未提交／推送。


### R3最后显示复核与当前结论

正俯视最后短趟`windows-vista-2026-09-11T14-58-00-687Z`，同一真实路线、两处8秒停驻。最新中央窗口与东界都出现较平滑的灰青宽面和亮脊，与上层细碎波纹可分开读；中央前后画面可见宽面移入窗口，因此“深处另有形体”的证据已强于上一版仅有水纹的情况。两窗口复用同一世界过程，视野下的未知敌人仍为0。具体是否读成足够巨大的存在、是否具备世界尺度与审美吸引力，留待用户判断；没有代签视觉PASS。该趟p95=16.7ms、max50ms，无pageerror。

三维最后短地貌趟`tail-stage-2026-09-11T15-02-16-691Z`，正常走到近水／近敌并折返；实际rememberedCells由760→1955→3397→3405，当前可见格则760／939／874／716。画面保留了已走过地面的暗线索，来源是静态地貌记忆，不用它显示隐藏敌人。近水和近敌角色的脚下仍可见。随后通过正常UI中止／重开，以免近观引来的追击混入指定水伤尾动画观察；第二趟正常死亡。此短趟原始断言通过，但全量记录传输拖慢名义0／0.5／1.2秒观察到约16.7／716.6／1000ms的tail读数，已明确不冒充精确0.5秒取样。包含重开与密集取证的rAF最大450.1ms，不作为稳定运行性能结论。

首次`tail-stage-2026-09-11T14-59-54-575Z`返程中心x886.26过贴东界，在下一排VOID角处停止并被追来的虫击杀；未进入指定尾动画取样。失败路线保留。修正仅是测试返程路点x864，为20×20身体留余量，没有改碰撞、AI或玩家状态。

最后只补一次出生→水源的轻量短趟`terminal-stage-2026-09-11T15-05-34-555Z`，没有再跑搜撤。实际在第一次观测ended后的5／504／1203ms取样，endTailMs分别16.66／516.63／1000；只读已知模型实例得torso.rotation.z为0.0476→1.4→1.4、root.visible真→真→假。世界／水幕时间始终27079.71ms，接触计数保持9。正式蒙层未被关闭或绕过，故静帧不能单独证明玩家看到完整倒下过程；这是正式结束事件到替代模型的技术接线证明。

该轻量脚本原始`inputChecksPassed=false`保留：最后断言错误要求0.5秒尚未结算和1.2秒已结算的整份账本一致。真实差异仅为running→death及一次正常`rift:exited`／`inventory:committed`／`record:finished`，三个事件都在同一冻结终点；并无世界或伤害再推进。测试已订正为世界／水幕与终点时间冻结、允许正常结算完成，并对未经修改的此次证据做[离线核验](artifacts/iteration-21-spatial/r3-slices/terminal-stage-2026-09-11T15-05-34-555Z/terminal-crosscheck.json)，通过；未再开浏览器以刷掉失败。死亡前真实Esc暂停已确认冻结世界和当时endTailMs；当前UI不开放死亡结果期间暂停，未额外伪造死后暂停操作。此末趟与独立构建并行，不纳入性能结论。

最终工程由ROOT独立执行并回报：`npm run check:spatial-slices` 8共享＋10Stage共18组通过；当前12组真实FLOOR格点覆盖75.3%–77.6%，前文74.3%–78.0%为施工期取样。`npm run build`含TypeScript通过，246模块，既有game-config大于500kB警告保留；CSV codegen通过，16份生成TS哈希未变化；diff检查通过。QA未重复运行这批构建，不将ROOT结果写成本次独立重测。

**两局部技术验证完成，等待用户空间／视觉判定。** 仍保留截图／探针与实际观感之间的边界：巨物辨识与尺度感、三维空间观感和死亡蒙层下动画可见性均不能由工程通过代签。没有新增生产供给／长循环验收，没有发布／提交／推送。
