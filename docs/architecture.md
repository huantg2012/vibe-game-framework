---
status: APPROVED
created-by: code agent (mode A)
created-date: 2026-07-22
last-modified: 2026-09-12
approved-date: 2026-07-22
changed-this-slice: true
note: Foundation Step 2。已通过独立技术审查并经人最终批准。**开发练习场（2026-08-20）**：独立 `gym.html`，入口 `docs/dev/gym.md`。角色程序像素 HOW：`docs/art/actor-pixels.md`。玩家加厚像素已接出击（DEC-068）。裂隙地面污染氛围簇已下线（DEC-104 / I8-G）。整团胀缩活层技术已锁（DEC-070）；应用改为占漆宿主（DEC-071 / DEC-104）。迷雾下亮度人终审 PASS（2026-08-28）。污染句法已接到出击（DEC-073 / DEC-076 / DEC-077），**COMPLETE（2026-08-28，体验已验证）**；遭遇识别旁白是同一套体系的识别面（DEC-074 / DEC-075）。**迭代 2 COMPLETE（练习场）。迭代 3（DEC-084）COMPLETE（2026-08-28，人试玩裂隙 PASS）。迭代 4（DEC-085 / DEC-086）COMPLETE（2026-08-28，人再滚甲大厅 PASS）。****迭代 5（DEC-087 / DEC-088 / DEC-098）：** 甲外形基因谱；`tools/contam-preview/` 论证不进 `src/**`；双路径 DEC-ARCH-013（I5-J 已交：出击 `d-mixed` 占地 = `attachJiaGenomeD`；不升生产 ramp）。I5-N：基因谱甲必须消费朝向与信号相。**I5-T：** 三种生物已翻出击（灯柱 / 栏柱仍 gym）。**迭代 6（DEC-088 / DEC-089 / DEC-090 / DEC-092 / DEC-093 / DEC-094）：** 碎片配色 / 世界美术；色温分组量化服务第二层；四张可生成（只开旧图书馆）；DEC-093 放弃底色色温承担身份；DEC-094 质量语法 / 渍色 / 划痕先等价再拆档；共享地面量化 DEC-ARCH-014。生产渲染器已迁入 `src/entities/form-renderers/`（I3-B）；A/B/C 冻结对照留 gym。合同 `docs/tasks/iteration-5.md`、`docs/tasks/iteration-6.md`。
---

# 技术架构

## 迭代21：正式系统的构筑对照入口（DEC-147，2026-09-11）

`build-lab.html`是仅开发环境可用的独立入口，直接挂载生产`RiftScene`。`data/build-lab-scenes.csv`、`build-lab-placements.csv`、`build-lab-loadouts.csv`经既有codegen生成`src/generated/build-lab-data.ts`，分别拥有场景几何、部署及普通配置；不复制玩家、敌人、技能或物件数值。

`src/dev/build-lab-fixtures.ts`构造完整布局及每趟新建的可变遮罩；`build-lab-session.ts`初始化隔离的普通训练库存、成长和出击；`build-lab-recorder.ts`只读正式事件和场景状态，区分实际消耗、死亡损失与中止，保存初始条件、采样、结果及训练标记；`build-lab.ts`组织配置、暂停/重开和JSON下载。页面改变配置须重开，不能继承上一趟的计时、拾获或AI。

`RiftScene`的DEV fixture替换布局输入并提供返回/暂停回调；F批另加创建前相机/视野显示配置与运行层生命周期钩子（见下）。正式移动、AI、技能消费、翻找和撤离/死亡不分叉。只读`probeBuildLabState()`限DEV fixture，供实验记录和实际输入测试观察。`SaveManager.setStorage()`将所有存储操作统一导向可注入后端，默认仍为正式`localStorage`；实验在初始化前注入内存后端，未完成的世界事务期间禁止切换存储。加载、保存、删除和失败重试均使用同一后端，不靠只替换`save()`隔离。

`RunController`的可选`onReturn`在正式出击账本结算、保存及退出事件之后执行，未提供时沿原生产归来路径。实验返回配置页，不进入基地`ImpactSystem`或供奉结算；训练库存、单趟携回不能作为完整基地循环或四A持续供给证据。刷新实验页也不是生产出击恢复方案。

`world-study.html`展示仓库中的世界意象与局部概念，读取`docs/art/iteration-21-worlds/manifest.json`；它和构筑对照入口均未加入生产打包入口或主菜单。开发合同见[build-lab](dev/build-lab.md)，几何/隔离/失败重试/真实操作证据见[迭代21 QA](qa/iteration-21.md)。尚未新增生产世界类型。

### K：Stage的开敞空洞、权威视线与海体显露（DEC-155）

`RiftDevFixture.createSightGrid(layout, physicalGrid)`是显式依赖注入口，未提供时继续使用原TileGrid。`src/dev/spatial-study/stage/sight-grid.ts`只将内部封闭VOID视为空气；外缘/越界/WALL仍遮视，底层版本变化需要重新分类。入口仅Stage提供该工厂；Vista与生产默认不启用。正式Visibility、AI视线、战斗和视线型工具/Host查询消费同一OccluderGrid，范围/角度/数值不变。

`src/systems/ai/physical-grid.ts`从WalkGrid派生身体通行遮挡并提供AABB位移扫掠。导航直行/平滑、推退与落点使用物理地表，不能因光线穿过空洞就让身体跨过。声音诱饵落地、穿墙落地与沿连通地表的揭示维持各自现有物理合同；开敞空洞不增加地面或通路。新增检查`tools/spatial-study/check-stage-sight.ts`涵盖这种分离和默认兼容。

Stage感知纹理改为RGBA：R实时视线（含空气）、G真实地貌记忆、B真实地表成员、A常量。只记真实地表，不记空气。`sea.ts`沿相机射线查询连续高度参考上的当前视线，故没有不透明深度的空洞也可让上方海体退让；此参考不生成渲染/碰撞面。既有不透明深度继续补偿下沉岸壁的真实投影。当前空气显露随转身收回，地表/断面已知记忆和当前实体显隐相互独立。

`terrain.ts`用同一海床纹理采样接到岩壁上端，向下才渐转低彩阴面，减少独立紫色横条。固定35°机位、断面几何、海体拓扑和落水规则沿用J/R4。试验记录新增`sightPolicy`并标记`r6-open-chasm-sight`；Stage与冻结Vista从此不是仅换显示的A/B，不能拿同数据签名声称视线规则完全相同。

### L：北沿侧面材质分面（DEC-155跟进）

`stage/materials.ts`新增仅岸壁使用的`sectionTexture`，沿既有侧面UV提供稀疏向下裂隙；原stone/cloth/shell纹理不变。`terrain.ts`把岸色延续限制在1.5–7世界单位薄唇内，其下用较暗的侧面受光，不再延续大面积地面横纹。材质仍经过原感知/记忆/根部衰减；不改几何、物理、海体显露或K的RGBA合同。仅调现有材质模块，无新玩法接口和UI。记录版本为`r7-north-shore-material`，sightPolicy仍是K规则。

### J：已选定三维方向的场景打磨（DEC-154，K之前记录）

用户认可三维像素舞台作为后续方向，Vista冻结于`fab67e2`的R4源码；这次调整仍仅在DEV局部，不自动将正式RiftScene/净化点或其它世界切换到Three。

`stage/palette.ts`拥有Stage的海、地层与灯光色彩常量。`sea.ts`在既有最近表面深度/14px海体拓扑上，用不同速度的宽尺度变形组织连续暗面和少量宽流光；移除没有再被使用的水纹纹理分配。水体体积、自然开口、统一高度反投影和`water-flow.ts`危险对应关系不变。角色依旧是实际像素绘制，HUD不换皮。

`stage/void-section.ts`只为真实FLOOR/VOID边界生成下沉地层，不对普通未知地面生成实体。断面顶点焊在原8px地表边界，向地层内部收折并下沉，末端无底盖；断面顶点的`stageAnchor`固定在所属岸边FLOOR内，`StageVisibility`沿该实际岸边继承可见/记忆状态，不能采屏幕投影点作为远处地面。变深只改变显示，不添加通行层/碰撞体、FOV通道或内部景物。各岸在同一相机深度中自然遮挡，不用overlay强行露出。

首次完整实图仍看不清断面，最终补正：Stage每帧先把已通过正式显隐/地貌记忆裁切的不透明场景绘入固定960×640离屏颜色/深度目标，再完成海体合成；第二次绘制复用阴影，不重复阴影重建。海材质通过深度纹理与相机逆矩阵取得实际可见表面位置，仅对低于同源地形2–7px的下沉面补透光，沿用原地面显露，防止把全部记忆地貌描成地图轮廓。深度目标由Stage创建、销毁，无第二份模拟/感知状态。已知断面材质另提供随贴图变化的有限暗部漫反射下限，再经过正式感知/记忆和根部衰减；不使用固定自发光板或填洞。

新材质/断面/灯光均只供Stage使用，冻结的Vista、共用CSV、world与水流规则保持逐字节一致；正式模拟依然唯一。最终实机与几何证据见[空间QA](qa/iteration-21-spatial.md)，剩余总计划仍见[扩展总台账](progress/content-expansion-plan.md)，四A持续供给未启动。

### H/I：两个完整空间局部（DEC-152 / DEC-153，开发试作）

`spatial-slices.html` / `src/dev/spatial-slices.ts`是新DEV入口。五张`data/spatial-slice-*.csv`经codegen生成`spatial-slice-data.ts`：真实31×27格环床与中央VOID、生产虫和翻堆、落水周期/不规则轮廓、五处自然海孔。`SpatialSliceWorld`唯一拥有自然孔、海体上下表面、局部前腹上卷、真实落水多边形与世界时钟；两个呈现不各自决定伤害范围。泛化fixture复用原布局构建，验证出口及每个巡逻点可达。

`SliceRuntime`接生产RiftScene的DEV生命周期。只读呈现帧包含玩家/敌人的正式位姿、挥击时钟、翻找/地面拾获/撤离、已生效受击及死亡事件；`CombatSystem`与`LootSearchSystem`仅补只读显示查询。`setWorldProjector`让已有屏幕方位提示使用当前呈现相机，不修改输入、碰撞或AI。

方向I的`stage/**`使用方位0、俯角35°的正交Three相机，角色、虫、地面、礁体和悬海走同一坐标/深度。Phaser仍运行唯一模拟与相机生命周期，原canvas仅隐藏像素输出；独立Three canvas对齐相同逻辑画幅且不截获指针。水体14px网格每点共用海柱/顶底法线，轮廓交点缓存并二分到子像素，避免每个三角面重复采样；流动孔的瞬时位姿由世界缓存。水体先写最近表面深度，再以相等深度着色，避免透明体背面穿出；上下表面与侧腹共享端点。只对见过的地貌缓存极暗轮廓，独立于实时感知，不反向写入正式FOV或放宽敌人显隐。结算后仅模型死亡余动画最多继续1秒，正式世界、危险与记录时钟保持冻结，暂停同时冻结余动画。销毁恢复canvas/projector并释放GPU对象。

方向II的`vista/presentation.ts`保留正式角色与正俯视操作。`void-regions.ts`从地图边界洪泛识别外部；可见外缘建立远景可见性，随玩家距离衰减，远处形体与近处光影共享世界位置。**内部VOID不可显示水、巨物或深层地貌**，最后以不透明未知面收口。海体自然孔仅影响前景水，不能新增道路或扩大实体视野。

I批增加`ground-height.ts`/`ground-mesh.ts`：8px网格的同源三角形插值供海床、人物/虫脚、拾获、礁骨、出口与落水使用，CSV提供五条坡脊/低地。浮点高度纹理供水材质反投影到真实海床；无跨层物理。`actor-pixels.ts`绘制有限色板的实际像素，同时提供像素姿态深度；`actors.ts`以alpha裁切和gl_FragDepth写入真实深度，保留生产动作时钟。`water-flow.ts`只改变表现：供水→下落前沿→断流→尾水落尽，接地危险时窗与旧规则逐毫秒一致。

两线继续使用内存训练session与正式归来/死亡账本，`__spatialSlices`只读观测和记录；Three仅由DEV入口引用，尚未进入生产场景或默认镜头。构图与操作验收均需新的实际画面，旧R1/R2测试不可继承为新视觉通过。入口、验证与边界见[空间局部合同](dev/spatial-study.md)及[QA](qa/iteration-21-spatial.md)；四A仍未开始。

### F：悬海空间研究（DEC-149 / DEC-150，R2历史）

R1空间视觉被用户以30/100否决；旧功能证据不继承为R2视觉PASS。`spatial-study.html` / `src/dev/spatial-study.ts`为DEV入口，沿用内存训练session、正式RiftScene与事件记录器。三张`data/spatial-study-*.csv`经codegen生成`src/generated/spatial-study-data.ts`，拥有地形、部署、海体基准高度、礁石及落水危险周期；不复制敌人定义。

`projection.ts`：B为主研究机位，zoomX=1.5、zoomY=.78，地面Y压缩.52；高度Z按`sqrt(1-k²)/k`投影。A为真实正俯视技术对照（k=1、高度投影0），取消人工侧边。`SpatialBillboardBridge`只包装显示对象的渲染父矩阵，按真实脚底补偿直立，不改对象位置、scale、20×20物理体或相机目标，销毁恢复原方法。仍只有Z=0行走平面，无自由相机或跨层寻路。

`sea-geometry.ts`生成随时间形变的闭合上下表面、圆转侧腹与独立下落水片；右侧前腹远退上卷，真实空气间隙露出体内源口，禁止用源点透明补丁。`sea-raster.ts`使用三角形重心深度光栅化；主体与下落体分别保存像素、表面类型与同度量深度，较大值靠近相机。`sea-volume.ts`封装复用缓冲、移动材质和只读统计。原`material.ts`侧边带已删除。既有`assets/sea-water-r1.png`作为动态UV材质，水片采用沿下降方向拉长的流束采样，生成来源见[材质记录](art/iteration-21-worlds/spatial-materials.md)。

`volume-composite.ts`按真实深度合成两类水面，仅改变玩家附近水体的透明度；不擦除原地面迷雾。`presentation.ts`组织海床、原Fog下的折光/接地泡沫（depth4）与水体（depth51）。礁石整体按`getGroundVisualDepth`参与原脚底排序；`VisibilitySystem.revealProjectedTerrain`在原Fog重建后，仅按可见礁石自身的不透明轮廓与基部可见性消除对应蒙层。礁石本体覆盖这些像素并保持实体排序，再由海体遮挡；逻辑FOV、地面查询、敌人显隐不改，不清出轮廓之外的地面雾带。

`water-curtain.ts`是周期与伤害接触的唯一状态。玩家逻辑中心进入CSV椭圆（144×88）并达到接触相位才调用正式`CombatSystem.applyHazardHit`；外接矩形角安全，按interval限频，结束后不施伤。同步致死结算后的microtask归档保留最后一次生效命中。礁石唯一碰撞墙格为25:16，旧并行墙已移除。

只读`__spatialStudy`提供生产状态、实际相机、身体碰撞、几何上下界、源口、深度、危险相位及事件；100ms采样可导出。DEV撤离穿雾定位光半径8，真实触发距离不变。入口不写正式存档、不进入基地供奉循环、未加入生产构建或默认镜头。开发合同见[空间样板](dev/spatial-study.md)，独立验收见[空间QA](qa/iteration-21-spatial.md)。**四A持续供给仍未开始，四A通过前不进入四B扩产。**

## 迭代19武器、供奉与统一物件（DEC-142，2026-09-09）

`src/art/crowbar-pixels.ts`输出32px世界武器与48px图标；正式成品由 `data/weapons.csv`、`weapon-qualities.csv`、`weapon-attack-profiles.csv` 经codegen生成，十款均已接玩家持握、地面与库存。`PlayerWeaponRig`绕握点以0.68倍率显示，动画沿用已获认可的身体动作。

`InventoryStore`是物品实例、位置、供奉槽、装备引用与出击账本的唯一所有者；`ContaminantSystem`只适配既有技能效果与事件。`EquipmentLifecycle`由武器/污染物各自payload唯一持有，不存重复镜像；`equipment-lifecycle.ts`统一查定义、创建未供奉/就绪武器。`getOfferingItems`投影完整槽位，`slotOffering` / `finishOfferingImpact`支持两类物件；技能引擎的旧污染物槽投影保留同样索引，武器以null占位，附加充能通过快照ID作用到完整槽位。

归来先完成 `ImpactSystem.run` 的防御和模块伤害，再以相同槽位快照统一充能与转化；武器没有虚构防御效果。正常冲击、收益、潮汐与baseSettled一次世界事务保存。世界供奉环装填档统计完整物件槽，不能只看技能投影。

`CombatSystem`在首个合法接触通过 `consumeWeaponUse` 先保存一次消费，同挥多目标只扣1；最后一次仍以冻结的 `swingWeaponId` 完成全部伤害与回收，随后卸去持武层。场景订阅领域状态刷新装备/HUD；无武器不能继续挥击。训练场同一计数，重开创建就绪满次训练实例；训练保存隔离。

`SaveDataV2.inventory` 内部schema版本2包含武器供奉和余次。旧内部v1无字段武器仅一次迁为就绪满次，原技能进度保留，后续加载不补满；畸形行/非法引用拒绝加载。活动出击的刷新/退出政策尚未确定，不能自动套死亡处罚。

`StatusPanel`的物件页嵌入 `InventoryPanel(catalog)`，统一总览并导航供奉；`InventoryPanel(prepare)`仅在裂隙入口装配，真实人物关联一个武器位及动态主动/被动槽；`InventoryPanel(rift)`只整理本趟拾获和附近物件。`InventoryPresenter`只投影同一领域实例，B独立库存已下线。净化点无重量上限/读数；出发校验真实携入负重，裂隙总重包括装备与拾获，打开Tab不停世界。

`src/art/contaminant-icons.ts`持有18类24px硬边物件图标，报告/供奉/备行/HUD共用 `contaminantIconUrl`；`tools/inventory/export-contaminant-icons.ts`导出PNG/SVG与contact sheet，并验证CSV覆盖、唯一轮廓、色板和透明边界。`RiftHud`按实例ID而非类型绑定装备与余次，保持空槽，避免同型技能串位。

正常出发→真实翻堆→撤离/死亡→归来结算已接通。`FieldLootInventory`持有可见附近地面投影、E取得与交换，`LootSearchSystem`揭晓新武器必须调用未供奉工厂。未交部分仅完整中断恢复政策与人审体验，不把此保护标为恢复完成。当前规格见 `system-field-inventory.md`，验证见 `docs/qa/iteration-19-unified-equipment.md`。

## R4-C 当前实体占空合同

R4-D尘絮返工：`dust-flow.ts`只负责可绝对时间重建的独立絮簇位置/尺度/朝向；`volume-presence.ts`缓存朝向基向量并采样同一破碎密度场；`volume-paint.ts`在絮簇局部坐标绘制稳定身份的纤维/卷片。没有额外粒子碰撞系统或装饰层的无形危区。

用户已批准 `gas_mass` 气团、`mist_bank` 雾团、`dust_swarm` 尘絮群进入敌人检视室和正式裂隙；余响保留原行为及画法。当前生产13基底（6地面、3漆、4空），所有占墙、散光、间距及街具继续仅历史gym。每图占空仍1名额；听觉主轴仍恰好1个占地巡游。

128正式种子当前结果：197个去别名形态行为组合、27个行为键、460个理论候选、382个职责可分配组合。占空实抽气团40、雾团27、尘絮群44、余响17；全量局部宿主审计7680个相位样本无空部署。计数不等于独立物种，美术品质由人审。

三实体的家族能力与地图权重由CSV生成；`contamination-volume-profiles.csv` → `contamination-volume-data.ts`拥有休整/聚合/释放/散开时长、半径、扫动范围、通行间隙及危险阈值。气团向内压缩后短促外胀；雾团以不同长短与漂移频率的非镜像薄层分流重聚，保留24px穿行通道；尘絮群旋聚、短扫、散开。新三者固定空间宿主并由自有周期变形，不叠加旧`dingLiveRect`微变形；余响沿旧路径。

`src/generation/terrain-safe-volume-seat.ts`在候选走廊内部求完整可走的轴对齐矩形，至少2×2格，优先面积大、同行列稳定决胜。可尝试所有走廊；没有合法座位则生成器重试该图，不能静默丢弃占空名额。Host/实际关卡/检视复用同一个纯选座函数；新presence的局部矩形全周期固定。额外保留尘絮扫动限幅，只在建立场时确定全轨迹范围，不在失败帧瞬移到上一位置。

`src/systems/volume-presence.ts`提供预分配`VolumePresenceFrame`、`createVolumePresenceFrame`、`updateVolumePresenceFrame`、`sampleVolumeDensity`和`isVolumeDangerousAt`。纯场包含世界坐标分量、相位/进度、活动门、危险门、实际可走核心位置；低/中/高覆盖仅影响材质和内部运动，不改变命中几何，不依赖另一个随机种子。所有实体密度先裁去墙/VOID；伤害、视野惩罚和脚下污染反馈读取同一危险采样，不能以外接AABB整盒收费。气/雾/尘只有release相位且实际节律/反视门打开时启用原`volume_field`混乱与视野通道；其他相位提供清晰安全节奏，不新增HP伤害或第二套计费。

Host `getVolumePresenceFrame(id)`返回新三者权威帧；余响返回undefined、保持旧合同。反视在实体外沿视线采样实际密度，在实体内部保留看向实际核心的角度条件；空隙和背墙不触发唤醒，转头可以休眠。可打核只能在可走且有实体密度处，雾层通行空隙中不凭空放核。

检视 `setVolumePreviewTime(id,timeMs,activeOverride?)`仅用于演示定格，null恢复正式时钟；`volumeTimeAtPhase`与`getVolumeProfile`提供同一周期的绝对时刻。离线renderer使用`FormVisualPose.volumeTimeMs`，真实Host存在时始终以权威帧为准。context可显式演示活动形体，arena和正式裂隙不传override。模型形态和污染三档仍待用户审美判断，机器检查不代替美术PASS。

## 历史 R4-A 移除阶段（DEC-129）

R4-A移除阶段当时只保留10个生产基底：6占地（虫、人形、兽、蠕虫、有机残影、残茎）、3占漆（菌毯、油膜、灰幕）、1占空（余响）。占墙整体退出生产；门框、墙锈、散光、间距与街具均仅保留历史gym兼容，敌人检视室不得展示。该阶段未实现新增项；当前已按上节R4-C批准新增三种实体占空。

R4-A移除阶段128正式种子结果：181个去别名形态行为组合、28行为键、424候选、346职责可分配；听觉全在地面（128图/128只），无墙宿主，当时所有占空皆余响。6地面家族/14主形/42覆盖配置不变。组合数不是物种数。

`contamination-substrates.csv`的scope是生产与检视目录共同来源；`contamination-dialects.csv`清除退休权重，`contamination-encounters.csv`墙听觉为0。`pickYiOrDing`同时检查生产family、权重和钉点，缺走廊不会回退墙；`supportsRuntimeForm`拒绝gym-only基底，成句也不能复活退休项。旧Host墙/散光/间距渲染与建筑选座模块仅兼容历史gallery，不删保留机制，也不冒充生产。检视室退休query回到虫，R4-A同场景环境当时仅3漆与余响，无墙座位前提。R4-C新增占空已注册，见上节。

下文I3–R3进度记录是历史，当前集合与分配以本节为准；未被R4改变的漆裁切、核选座和动作机制继续有效。


## 技术选型

| 层 | 选择 | 理由 | 备选 |
| -- | ---- | ---- | ---- |
| 游戏框架 | Phaser 3.80+ | 最成熟的 Web 2D 框架；内置物理/输入/音频/相机/场景管理；社区最大（AI vibe coding 友好）；TypeScript 支持完善 | PixiJS（仅渲染，需自建一切）、Excalibur（社区小） |
| 语言 | TypeScript (strict) | 类型安全 + AI 生成代码质量更稳定 | - |
| 构建工具 | Vite 5+ | 热更新快、零配置 TypeScript 支持、构建速度适合游戏开发迭代 | - |
| 物理引擎 | Phaser Arcade Physics | 俯视角 2D 够用（AABB 碰撞）；轻量；无需刚体旋转/多边形碰撞 | MatterJS（过重） |
| 寻路 | 自实现 A* (grid-based) | 地图是 tile-based，A* 实现简单且可控；避免外部依赖 | EasyStar.js（可作 fallback） |
| 可见性 | 自实现 Raycasting | Darkwood 式有限视野是核心体验；需精确控制光照形状和遮挡 | Phaser Light Pipeline（不够灵活） |
| 地图生成 | Voronoi + Cellular Automata 混合 | 宏观 Voronoi 切不规则碎片区域（世界观"时空碎片"）；微观 CA 生成有机洞穴地形；碎片间窄裂口连接；兼具方向感和探索感 | BSP（过于规则/建筑感）、WFC（调参困难） |
| 存档 | LocalStorage + JSON | 最简方案；单存档够用；无需后端 | IndexedDB（数据量大时升级） |
| 音频 | Phaser 内置 (WebAudio) | 框架自带，跨浏览器兼容已处理 | Howler.js（如需更精细控制） |
| UI (游戏内 HUD / 屏幕空间读数) | DOM overlay，挂 `#dom-ui-root`（与画布对齐） | 角锚 HUD 必须跟 letterbox/缩放走同一套根。Phaser `scrollFactor(0)` 不免除 camera zoom，会把四角甩出画面 | Phaser Text/Graphics 仅用于钉世界坐标的标记 |
| UI (复杂界面) | 原生 DOM overlay | 管理面板用 DOM 构建；不引入 React/Vue | - |
| 国际化 (i18n) | 自实现 JSON + TypeScript | 文本量有限（<300 条）；自实现零依赖、类型安全、无学习成本；支持简体中文/英文 | i18next（过重）、typesafe-i18n（额外构建步骤） |
| 部署 | 静态文件 (Vite build) | 产出纯静态文件，可部署到任何静态托管 | - |

### 屏幕空间 UI 挂载（本游戏填充）

屏幕空间读数与 DOM 面板一律挂 `#dom-ui-root`（`getDomUiRoot()` / `bindDomUiRootToGame()`），与画布 letterbox/缩放对齐。钉世界坐标的标记才走 Phaser 世界层。禁止用 `scrollFactor(0)` 在 `camera.zoom ≠ 1` 下画角锚 HUD。新 overlay 不要挂 `document.body`（小地图 / 场景过渡 / 失焦层已迁到 `#dom-ui-root`；debug 可仍挂 game-container）。共享样式入口：`src/ui/dom/panel-styles.ts`（`.game-panel` 墙机 + `.device-plate` 裂隙随身罩）。视觉基线：`docs/design-notes/ui-art-overhaul.md`。

DEC-119 新增开发验收入口 `ui-review.html` / `src/dev/ui-review.ts`：只在 DEV 实例化，复用生产场景和面板，内存示例状态覆盖空库与完整库存；该文档内隔离 SaveManager 的读写/删除，不访问正式存档。场景切换直接调用 SceneManager，避免 ScenePlugin 的延迟 stop 关闭刚重启的场景。入口不加入生产构建，也不挂主菜单。主菜单宣传图 `public/assets/art/menu-last-light.png` 经 BootScene 加载，由 MainMenuScene 按 960×640 构图显示；生成记录见 `docs/art/prompts/menu-last-light.md`。


### 净化点地面深度排序（DEC-120）

新增src/systems/ground-depth.ts：GroundDepthSorter(targets).update()按groundY回调及稳定id排序，向各applyDepth回调分配[20,38)内的实体基准层；每组附属层偏移小于1，最多18组，拒绝重复id。只在名次变化时写depth。此模块不依赖Phaser，也不接管场景生命周期。

PurificationScene拥有排序器，注册五台直立装置和Player，在Player.postUpdate之后同步，shutdown释放。Player.getGroundY()取固定中立脚底；Player.setGroundDepth()同时调整FacingLagGhost、主体和PlayerLampAura。PurificationModuleEntity.setGroundDepth(base,floorDepth,readoutDepth)统一主体/发光/读数，getBodyDepth()供短时修复闪光跟随；OfferingStandVisual/GrowthConsoleVisual.setDepth()接入同一排序。地面光池5、裂隙贴花1、世界生命读数40、遮罩50独立。RiftScene/Gym不调用新排序接口，原默认层级保留。

I12-C新增src/systems/purification-collision.ts：物理底座参数与五台装置位置同源，PurificationCollision管理静态组/collider；PlayerConfig.body可选矩形覆盖，净化点使用脚底12×8，裂隙保留默认体。装置碰撞和边界组的销毁须兼容Phaser先完成场景清理的顺序。BoundaryShape保留原角向cos钳制，追加真实局部安全圆盘极射线约束，补偿脚底体、8px边界方块、0.98内缩和1°角查表误差，地表/视野/碰撞仍共用唯一形状。

开发验证使用ui-review.html?sample=spatial：十个前后定位按钮、八向短时行走、真实E交互与最高潮汐按钮，驱动生产对象/输入与postUpdate；只读实际depth作诊断。沿用开发页存档隔离，不进入生产构建。

## 项目结构

```
src/
├── main.ts                     # 入口：创建 Phaser.Game 实例
├── config/
│   ├── game-config.ts          # Phaser 配置（分辨率/物理/场景注册）
│   └── constants.ts            # 游戏平衡常量（集中管理，方便调数值）
├── scenes/
│   ├── boot-scene.ts           # 资源预加载
│   ├── main-menu-scene.ts      # 标题画面
│   ├── menu-entry-transition.ts # 首页入场音画交接；new/continue两种节奏
│   ├── main-menu-atmosphere.ts # 首页炉火、肩灯、裂纹发光与尘，随场景释放
│   ├── main-menu-actor.ts      # 原图人物轮廓mesh待机与局部补底
│   ├── rift-scene.ts           # 裂隙探索（核心玩法场景）
│   ├── purification-scene.ts   # 净化点管理（基地场景）
│   ├── rift-entrance-visual.ts # 裂隙入口世界内外形（地面裂缝贴花；生产默认卡 5）
│   └── offering-stand-visual.ts # 供奉台世界内外形（卡 I 环；生产默认 DEC-115）
├── systems/
│   ├── purification-collision.ts # 净化点薄底座、脚底配置及场景物理生命周期
│   ├── ground-depth.ts         # 净化点按地面接触点排序；附属光效归组
│   ├── visibility-system.ts    # 视野/光照 raycasting（RiftScene + PurificationScene 共用）
│   ├── boundary-shape.ts       # 净化点边界几何：潮汐驱动的极坐标压力 blob（形状唯一真相）
│   ├── boundary-breath.ts      # 边界局部压力冲击与膜变形（纯视觉叠加层）
│   ├── boundary-atmosphere.ts  # 净化点边界外黑暗+模糊内容周期渲染（跟随 boundary-shape）
│   ├── procedural-surface.ts             # 裂隙地表逐像素程序化生成（DEC-018）；氛围簇应用已下线（DEC-104）
│   ├── cluster-pulse.ts          # 对照用：菌毯/灰幕旧皮呼吸；出击地面不再挂整图呼吸
│   ├── procedural-purification-surface.ts # 净化点地表逐像素程序化生成 + 边界 vignette
│   ├── interaction-trigger.ts  # 接近触发交互（overlap检测+提示+面板激活）
│   ├── ai/
│   │   ├── state-machine.ts    # 通用 FSM 框架
│   │   └── behaviors.ts        # 具体行为（巡逻/警觉/追击）
│   ├── chaos-system.ts         # 混乱值计算与惩罚
│   ├── combat-system.ts        # 战斗逻辑
│   ├── contamination-host-system.ts # 乙缝核 / 丙簇核 / 丁体积（无第二 FSM）
│   ├── loot-search-system.ts   # 裂隙翻找读条（迭代 10；取代 overlap 触碰拾取）
│   ├── loot-search-presentation.ts # 翻堆外观 / 揭晓粒子（随碎片配色）
│   └── pathfinding.ts          # A* 寻路
├── entities/
│   ├── player.ts               # 玩家实体（移动/输入/状态）
│   ├── player-sprite.ts        # 旧方块人（boot 别名；不再驱动 Player）
│   ├── player-sprite-dense.ts  # 玩家加厚程序像素（出击成品，DEC-068）
│   ├── player-lamp-aura.ts     # 玩家灯尘/脚底暖斑（叠在加厚像素上）
│   ├── actor-motion.ts         # 步态帧选取 + 转向滞后剪影（不改玩法朝向）
│   ├── enemy-factory.ts        # 敌人工厂（渗透体 / 改写体，同一实体；迭代 3 甲带 ContaminationForm）
│   ├── infiltrator-sprite.ts   # 渗透体 32×32 密像素（成品，DEC-066；碰撞仍 20；I3-E 后为默认课回退）
│   ├── contam-flakes.ts        # 敌人青绿脱落尘（往外/下飘，非暖灯尘）
│   ├── rewriter-sprite.ts      # 改写体 32×48 程序像素（成品，DEC-066；I3-E 后为默认课回退）
│   ├── form-renderers/         # 污染体生产视觉层（方案 D；d-mixed + d/**；d/genome 占地基因谱；d/paint-genome 占漆拓扑；d/gym-attach.ts 练习场跨层分发；I5-J 出击占地 = attachJiaGenomeD；I7-S 出击油膜 = attachBingPaintGenome）
│   └── purification-module.ts  # 净化点三模块世界实体（核心 / 净化器 / 储藏走贴图；缺失回落几何体）
├── generation/
│   ├── outline-mask.ts         # C1：生长+腐蚀陆地掩膜（VOID / FLOOR）
│   ├── ruins.ts                # C2：按碎片语法落情景墙
│   ├── masses.ts               # C2 质量语法参数向量（I6-P 三预设等价；I6-Q 放开档位，簇是参数点）
│   ├── preview-paint.ts        # 画廊整图漆；裂隙地面烤一次（污染缺省崩坏簇）+ 天空/尘点低分辨率叠层
│   ├── palette-quantize.ts     # 色温分组 + 组内量化（I6-B；地面/敌人共用；I6-C/D 已接；DEC-110 残骸格）
│   ├── cie76.ts                # CIE76 ΔE*ab 共享实现（I6-E 地面闸 + I10 堆对比度闸同一份）
│   ├── dual-path.ts            # 规格 21 换路机器判定（生成器与 check:layout 共用）
│   ├── fragment-roll.ts        # 每次踏入抽 contaminationAge × ruinSeverity
│   ├── rift-layout.ts          # 出击布局：锚+抖动+换路硬保证+FragmentRoll
│   ├── contamination-draw.ts   # 污染句法抽卡纯函数
│   ├── contamination-pins.ts   # 墙缘 / 簇核 / 走廊盒钉层（只读格子；禁止改 collectWallEdges 集合）
│   ├── wall-edge-path.ts       # 墙缘格集合 → 有序墙皮路径（活机制与视觉钉共用；不改 collectWallEdges 集合）
│   ├── types.ts                # OutlineMask / RuinedMask / GeneratedRiftLayout 契约
│   └── index.ts                # 生成器出口（布点后续批次追加）
├── managers/
│   ├── game-state.ts           # 全局游戏状态（跨场景持久）
│   ├── save-manager.ts         # 存档读写（LocalStorage）
│   └── audio-manager.ts        # 音频播放控制
├── ui/
│   ├── contaminant-names.ts    # 残渣/工具中文名单一入口
│   ├── minimap.ts              # 裂隙圆形局部窗口（挂 #dom-ui-root）
│   └── dom/
│       ├── panel-styles.ts     # 共享面板样式层：全部 DOM 面板的单一 <style> 注入点
│       ├── rift-hud.ts         # 裂隙读数（DOM，非 Phaser hud.ts）
│       ├── detection-pulse.ts  # 裂隙屏缘被发现干涉（#rift-detection-rim）
│       ├── encounter-narration.ts # 遭遇识别旁白（#rift-encounter-log）
│       ├── purification-hud.ts # 净化点贴顶装置读数 + 底栏提示条（.device-plate）
│       ├── module-identity-strip.ts # 三模块身份带 HTML（墙机同族）
│       ├── allocation-panel.ts # 净化点薪柴分配界面（DOM）
│       └── status-panel.ts     # 存续报告
├── i18n/
│   ├── index.ts                # i18n 初始化 + t() 函数导出
│   ├── types.ts                # 翻译 key 的类型定义（自动推导）
│   └── locales/
│       ├── zh-CN.ts            # 简体中文（默认语言）
│       └── en.ts               # English
├── core/
│   ├── event-bus.ts            # 类型安全的事件总线
│   └── object-pool.ts         # 通用对象池
├── utils/
│   ├── math.ts                 # 数学工具（向量/角度/距离）
│   └── random.ts              # 可种子随机数生成器
└── types/
    ├── game-types.ts           # 核心游戏类型定义
    ├── events.ts               # 事件类型枚举 + payload 定义
    └── save-data.ts            # 存档数据 schema

tools/
├── art-pipeline/               # 构建期离线美术资源后处理与机器验收工具
├── csv-codegen/                # data/*.csv → src/generated/*.ts
├── gym/                        # 陈列馆目录等练习场机器闸门
└── contam-preview/             # 论证一次性预览/量化（迭代 5）；不进 src/**，不进游戏包
```

## 构建期美术资源后处理工具

`tools/art-pipeline/` 是构建期/离线工具，独立于游戏运行时的 `src/`：它读取游戏层的后处理配置与锁定色板，处理外部生成的**单块资产原始图片（一张图 = 一个 tile 或一个 sprite）**并验证产物，不会被游戏打包或在 Phaser 场景中运行。整场景概念图只用于美术方向验证，不经此管线、不参与平铺。

- `npm run art:postprocess -- --config <配置路径>`：按配置执行资源后处理。
- `npm run art:verify -- --config <配置路径>`：执行机器验收；退出码为 0 表示通过，非 0 表示不通过。

具体游戏的尺寸、色板、处理阶段和验收阈值存放于 `docs/art/pipeline.*.config.json` 与 `docs/art/palette.json`，不写入通用工具代码。正式视觉资产的职责约定为：美术 Agent 维护配置与验收标准，程序 Agent 运行命令，人执行外部生图并完成最终审美判断。

## 外形基因谱论证工具（不进游戏）

`tools/contam-preview/` 是迭代 5 的一次性论证预览（现状甲/丙、原型骨架、方言对照、粗占格测量）。用 Phaser 桩在 node 里跑，**不进 `src/**`，不会被游戏打包**。生产实现必须另写；生产闸门是 I5-H 的 `check:contam-distinct`（已交：测 `bakeJiaGenome`，禁止 IoU）。地面青绿测量已吸收进 `check:contam-floor-contrast`（I6-E 已交；`measure:ground-teal` 是同口径包装）。`measure:l1-reach` 仍是诊断。样本在 `docs/art/samples/`。原型第三栏整只发光不采纳（DEC-088）。

## 模块通信方式

**主模式：类型安全事件总线（Event Bus）**

系统之间通过事件解耦。不允许系统 A 直接 import 并调用系统 B 的方法（管理器除外）。

> 事件契约的唯一真相是 `src/types/events.ts`（`GameEvent` 枚举 + `EventPayloads` 类型映射）。以下示例摘自该文件的现状，如与代码不符请以代码为准并回补本文档。

```typescript
// 事件定义（节选自 src/types/events.ts）
export enum GameEvent {
  CHAOS_CHANGED = 'chaos:changed',
  CHAOS_THRESHOLD_REACHED = 'chaos:threshold-reached',
  ENEMY_ALERT = 'enemy:alert',
  PLAYER_DAMAGED = 'player:damaged',
  KINDLING_COLLECTED = 'kindling:collected',
  RIFT_EXIT_REACHED = 'rift:exit-reached',
}

// payload 类型映射（节选自 src/types/events.ts 的 EventPayloads）
// CHAOS_CHANGED:           { value: number; delta: number; max: number }
// CHAOS_THRESHOLD_REACHED: { level: number }
// ENEMY_ALERT:             { enemyId: string; alertLevel: 'suspicious' | 'alert' | 'chase' }
// KINDLING_COLLECTED:      { amount: number; total: number }

// 使用方式（payload 字段由 EventPayloads 强制约束）
eventBus.emit(GameEvent.CHAOS_CHANGED, { value: 45, delta: 2, max: 100 });
eventBus.on(GameEvent.CHAOS_THRESHOLD_REACHED, ({ level }) => { /* apply penalty */ });
```

**辅助模式：**
- **Manager 直接调用**：GameState、SaveManager、AudioManager 提供直接方法调用接口（它们是全局服务，不是游戏逻辑系统）
- **Scene 数据传递**：场景切换时通过 `scene.start(key, data)` 传递初始化数据

**禁止：**
- 系统间循环依赖
- 绕过事件总线直接跨系统访问状态
- **可能形成循环的同步 emit 链**（见下方"事件回调中的 emit 规则"）

### 事件回调中的 emit 规则（可执行版本）

`eventBus.emit()` 是**完全同步**的（`src/core/event-bus.ts` 中直接遍历 listener 并调用），因此在回调里再 `emit` 会在同一调用栈内递归展开。若事件链能回到自身（A → B → A），会造成无限递归 / 栈溢出。规则如下：

- **允许**：在回调中同步 `emit` 单向的下游事件——即该事件不会（直接或间接）再触发回本条事件链。例：`combat` 处理伤害后同步 `emit(PLAYER_DAMAGED)`。
- **禁止**：可能构成环的同步 `emit`（A 的回调同步触发最终会回到 A 的事件）。
- **不确定是否成环、或明知需要回环**：不要同步 emit，改为**延迟派发**打破调用栈：
  - 下一个 microtask：`queueMicrotask(() => eventBus.emit(...))`
  - 下一帧（在 Phaser 场景内）：`this.time.delayedCall(0, () => eventBus.emit(...))`
- **开发期自检**：为一条事件链画出"谁监听 / 谁再 emit"，只要闭合成环就必须在环上至少一处改用延迟派发。

> 说明：当前 `EventBus` 未内建队列式 emit。上述延迟派发以标准 `queueMicrotask` / Phaser `delayedCall(0)` 约定实现，无需改动 EventBus。若后续多处需要队列语义，再评估在 EventBus 上新增 `emitDeferred()`。

## 模块注册表

> **状态**列以真实 `src/` 目录为准（Slice 5 T0 全量补核，核对日期 2026-08-12）。"已实现"= 文件真实存在且有实质实现；"规划中"= 目录/文件尚未创建，接口为设计意图，实现时以本表为契约起点并回填状态。已落地目录：`src/core/`、`src/i18n/`、`src/systems/`（含 `ai/`）、`src/entities/`、`src/utils/`、`src/managers/`、`src/ui/`（含 `dom/`）、`src/config/`、`src/types/`、`src/scenes/`、`src/generated/`、`src/generation/`（Slice 6 COMPLETE：陆地/残墙/布点/换路/FragmentRoll/氛围场）。

| 模块 | 路径 | 职责 | 对外接口 | 状态 |
| ---- | ---- | ---- | -------- | ---- |
| EventBus | src/core/event-bus.ts | 类型安全的发布/订阅系统 | emit(), on(), off(), once(), destroy() | 已实现 |
| I18n | src/i18n/index.ts | 多语言文本查找与语言切换 | t(key, params?), setLocale(), getLocale() | 已实现 |
| GameState | src/managers/game-state.ts | 全局状态持有和查询（净化点/薪柴/三模块 CORE·STORAGE·PURIFIER/加厚档位/冲击强度/待生效副作用），module-level singleton | getKindlingReserve(), addKindling(n), spendKindling(n), getModules(), getModule(id), allocateToModule(id, kindling), applyDamage(id, damage), healModule(id, amount), getModuleEffect(type)（仅 CORE/STORAGE，分子 min(hp,100)/100）, getStartingChaos(), getModuleMaxHpTier() / getModuleMaxHp() / getNextModuleMaxHpCost() / canRaiseModuleMaxHp() / raiseModuleMaxHp(), getSortieModifiers()（含 startingChaos）, getCycle(), incrementCycle(), getImpactIntensity(), setImpactIntensity(v), getPendingSideEffects(), addPendingSideEffects(effects), consumePendingSideEffects(), getRepairEfficiencyMult(), setRepairEfficiencyMult(v), getUpgradeDiscount(), setUpgradeDiscount(v), consumeUpgradeDiscount(), getState(), loadState(), reset() | 已实现（Slice 7：第三模块 + 加厚 + 起始混乱） |
| SaveManager | src/managers/save-manager.ts | 存档序列化/反序列化（收集各系统状态 → localStorage，加载时分发回各系统）。标题屏无副作用 peek（潮汐/相位/出击/稳定度）。Slice 7 持久化 `moduleMaxHpTier`；老档缺 PURIFIER / 档位则补 70 / 当前档 maxHp | hasSave(), save(), load(), deleteSave(), peekTideNumber(), peekTidePhase(), peekCycle(), peekStability(), peekRecordSummary() | 已实现（Slice 3；Slice 5.5 补 peek；Slice 7 加厚档） |
| AudioManager | src/managers/audio-manager.ts | 音频播放/停止/分层混音/空间衰减 | playBGM(), stopBGM(), playSFX(), playAmbient(), stopAmbient(), setLayerVolume(), playSpatialSFX(), pauseAll(), resumeAll(), unlock() | 已实现（Slice 9） |
| Player | src/entities/player.ts | 玩家移动/朝向/碰撞体/移速调制栈（Rift+Purification 共用）。贴图为加厚程序像素 + 灯尘（DEC-068）。转向滞后剪影不改玩法朝向 | create(scene, config), update(dt), postUpdate(), getPosition(), getFacingAngle(), getFacing4(), isMoving(), setSpeedModifier(), clearSpeedModifier(), setInputEnabled(), getGroundY(), setGroundDepth(base, floorDepth), getSprite(), destroy() | 已实现（T5；2026-08-20 步态帧；DEC-068 接线） |
| PlayerSprite | src/entities/player-sprite.ts | 旧 32×32 方块人。boot 仍画别名贴图；不再驱动 Player | generatePlayerPlaceholders(scene), playerMotionTexture(facing, gait, frame) | 已实现（档案） |
| PlayerSpriteDense | src/entities/player-sprite-dense.ts | 玩家加厚工业像素（面罩/背包/分腿/灯壳体；侧影加厚、暖灰）。出击成品（DEC-068） | generateDensePlayerPlaceholders, densePlayerMotionTexture | 已实现（2026-08-20） |
| PlayerLampAura | src/entities/player-lamp-aura.ts | 灯尘、脚底暖斑。叠在加厚玩家上（出击与练习场） | generatePlayerLampAuraTextures, PlayerLampAura | 已实现（2026-08-20） |
| ActorMotion | src/entities/actor-motion.ts | 步态帧选取与转向滞后剪影。不写 facingAngle、不转 GameObject | pingPongFrame, FacingLagGhost, isActorWalking | 已实现（2026-08-20） |
| GroundDepthSorter | src/systems/ground-depth.ts | 净化点地面接触点排序，受限层段及稳定同y次序 | constructor(targets), update() | 已实现（DEC-120） |
| PurificationCollision | src/systems/purification-collision.ts | 五台装置薄底座、共享物理锚点和净化点脚底体；场景生命周期清理 | PURIFICATION_PLAYER_BODY / DEVICE_FOOTPRINTS / DEVICE_ANCHORS / SPAWN_POINT, constructor(scene,player,anchors), destroy() | 已实现（I12-C） |
| VisibilitySystem | src/systems/visibility-system.ts | 玩家视野 raycasting + 32 层等照线带遮罩（带半径 = 参考光场等照线 ∩ 射程曲线，逐射线墙截断）+ teal 软内缘（v3 几何环）+ 双八度迷雾颗粒 + 热核光池曲线 + 混乱值调制（Rift+Purification 共用）。纹理与曲线纯函数 `src/systems/vision-textures.ts`（闸门共用，不是新运行时系统） | create(scene, config, occluders), update(origin, facing, dt), setRadiusScale(), setEdgeCorruption(), setScreenFlicker(), isPointVisible(), getVisibilityAt(), getEffectiveRadius(), registerGlowSource(), unregisterGlowSource(), getStats(), destroy() | 已实现（T5；I9-FINAL / DEC-107 表现层终审定版 2026-08-29） |
| GridRaycast | src/utils/grid-raycast.ts | 网格 DDA 射线（含对角缝隙规则）；无状态纯函数，视野与敌人 AI 共用同一套遮挡判定。`hasClearPath()` 是同一射线的双侧偏移版，回答"这么宽的身体过不过得去"（DEC-021），**不是视线判定，禁止用于感知** | castRay(), castRayDirection(), hasLineOfSight(), hasClearPath(), createRayHit() | 已实现（T5，T7 增 hasClearPath） |
| TileGrid | src/systems/tile-grid.ts | tile 数据的唯一真相，同时实现 OccluderGrid（视线）与 WalkGrid（寻路）；纯数据无 Phaser 依赖 | getTile(), isOpaque(), isWalkable(), isWalkableAt(), setTile(), tileToWorld(), worldToTile(), version | 已实现（T6） |
| TilemapRenderer | src/systems/tilemap-renderer.ts | tile 数据 → Phaser Tilemap 图层（共享场景管线，依赖 Phaser 视锥裁剪） | create(scene, map, config): TilemapLayer, getLayer(), getWorldSize(), destroy() | 已实现（T6） |
| AISystem | src/systems/ai/ | 两种感知剖面共用一份五态 FSM（10Hz tick / 单射线）+ 移动/巡逻 + 寻路预算调度；拥有敌人实体的生命周期。剖面来自 EnemyData，禁止第二份 FSM | create(scene, spawns, occluders, walk), update(dt, playerPos, playerIsMoving), postUpdate(dt), getEnemies(), getEnemyById(), reportNoise(pos, radius, level), reportDamage(enemyId, sourcePos), despawn(enemyId), onPlayerLost(), setVisibilityProvider(), setCueListener(), addWallCollider(layer), getSprites(), getStats(), destroy() | 已实现（T7；Slice 8 C1 剖面泛化） |
| ContaminationLexicon | docs/specs/system-contamination-lexicon.md | 污染句法：底材 × 孔谱 × 词素。出击已接甲填法 + 乙丙丁宿主 + 抽卡 CSV。迭代 3：方案 D 接入出击（DEC-084）。迭代 4：练习场陈列馆按视觉身份去重（DEC-085），不是玩法。迭代 5：甲外形基因谱（DEC-087 / DEC-088）。**I18 R3：** `street_wreckage` 退gym；门框仅wall；`lamp_pillar` / `railing_post` 收回 gym。**I5-T：** `insect_remnant` / `mammal_remnant` / `worm_remnant` 进 `SORTIE_SUBSTRATE_IDS`（灯柱 / 栏柱仍 gym）。**I8-Q：** 占漆只数按 `contaminationAge` 闭区间掷（新生 3–5 / 标准 6–8 / 古老 9–12，`mix32(seed, 'paint-count')`）；一份 form 复制 N 只；钉层 `paintFloors` | `drawSortie` / `rollPaintHostCount` / `paintFloors` / `encounter:identified` / `EnemySpawnData.form` | 迭代 1 逻辑已接（体验未验证）；渲染已接出击；陈列馆 I4-D 已交（迭代 4 仍等人浏览）；I5-J 已升出击默认甲；碎片配色迭代 6 COMPLETE；I8-Q 配额与贪婪钉点已交 |
| ContaminationHostSystem | src/systems/contamination-host-system.ts | 乙缝核邻格抽打、丙簇踩踏混乱、丁体积场。无走廊碰撞，无第二 FSM。`create` 的 combat / chaos 可缺（传 `null`）。迭代 3：出击传 `liveMotion: true`（I3-F 已接）；一份 `layout.contaminationDraw` 物化乙丙丁，禁止二次 `drawSortie`（I3-A）。地图课不传活开关，走静帧 tick。R3全部占漆：`setStepFloors`登记实际漆格，菌落危险取活核交集；`isPaintFloorActive`与材质同源。**I8-Q：** 出击按 `paintFloors[i]` 物化 N 只占漆，不再读 `clusterCores`。**I8-V：** `setSkipPaint` 藏默认方点，不藏菌落可打核；核图层深度 2（高于油膜 1）；场仍不画方点 | create(scene, layout, combat, chaos, getVisibilityAt, options?)（`options.liveMotion` 默认 false；旧名 `gymLiveMotion` 仅 gym 内部兼容）, bindPractice(..., options?), update, getSubjects, getLastDraw, getVolumeSightMult, setSkipPaint, setStepFloors, isPaintFloorActive, getVisualPin, getVisualSignal, getStrikeFloors, getVisualMoving, getVisualFacing, getLiveNucleusCount, destroy | 已实现（I3-F 出击活机制；地图课静帧；油膜场漆格踩踏；I8-Q 多宿主钉 `paintFloors`；I8-V 菌落核可见性） |
| EncounterNarration | src/ui/dom/encounter-narration.ts | 污染句法识别表面：随身罩一行角色低语，限频。无「识别。」前缀。节点仅 `observe` / `utterance_mark`。文案来自 `data/contamination-observe-lines.csv`。禁止头上名字。覆盖 / 基体 / 占位不上裂隙；三种生物短名仍不上裂隙 | create / tick / destroy；挂 `#dom-ui-root` / `#rift-encounter-log` | 进行中（迭代 1，审美待人终审；I8-N 低语已接） |
| ChaosSystem | src/systems/chaos-system.ts | 混乱值累积、阶段判定（safe/warning/danger/overflow）与惩罚调制器计算；`class ChaosSystem`（非模块级单例，RiftScene 持有实例）。出击初值一次写入（净化器 startingChaos + Σ initial_chaos），已越阈不播跨阈演出 | `new ChaosSystem(config?)`：update(deltaMs), getValue(), getRate(), getStage(), getPeak(), addChaos(source, amount), addImmediate(amount), setTemporaryRateMult(mult, durationMs), setPaused(paused), reset(startingValue?), destroy()；config.startingValue；模块函数 getChaosModulators(value) | 已实现（Slice 1-2；Slice 7 开局初值） |
| CombatSystem | src/systems/combat-system.ts | 玩家挥击/敌人反击/生命值/无敌帧/死亡触发 + 战斗占位表现（白色扇形、前摇细线、白闪、死亡淡出）。不改 AI FSM、不改混乱值，只 emit 事件 + 经注入回调转发噪声 | create(scene, occluders, player, ai, hooks), update(dt), requestPlayerAttack(), getHealth(), getMaxHealth(), isDead(), isInvulnerable(), getAttackState(), getEnemyHealth(id), isEnemyAlive(id), getStats(), setEnabled(), reset(), destroy() | 已实现（T8） |
| Pathfinding | src/systems/pathfinding.ts | 网格 A*（8 邻接 / octile / 禁止切角）+ 宽度感知的 string-pulling 平滑；共享服务模块（与 grid-raycast 同级，可被直接 import），预分配缓冲、结果写入调用方数组 | `GridPathfinder(walk, occluders, clearance)`：findPath(from, to, out, maxNodes), findNearestWalkable(x, y, out, maxRadius?), getStats() | 已实现（T7） |
| Gym | gym.html + src/gym/ | 开发练习场：独立 HTML，不进主菜单。课：历史污染句法 `?lesson=lexicon`（I18已重定向敌人检视室；以下为旧课说明：固定观察院子、默认无敌可开「感受伤害」、配置表点生成；默认 `#gym-lex-renderer` = 方案 D，A/B/C 冻结对照；`#gym-lex-fragment` 五选一偏色院子；相机拖移/滚轮，画布钉在右侧窗格）；油膜脉络抽卡 `?lesson=paint-vein-card`（历史对照课：A/B/C 树 tweak + 已被 DEC-101 锁定为生产的三支原形，六格打开即挂；不走句法课侧栏）；裂隙入口抽卡 `?lesson=rift-entrance-card`（外形对照，生产默认卡 5 击裂）；供奉台抽卡 `?lesson=offering-card`（生产默认卡 I 环，人终审 PASS，课不删）；培养藏抽卡 `?lesson=growth-card`（三卡，生产默认卡 A 立缸，DEC-116）；污染句法陈列馆 `?lesson=lexicon-gallery`（一次一厅、只 attach 方案 D、无玩家/Enemy/宿主；合同 `docs/tasks/iteration-4.md`；I5-J 后占地与裂隙同一份 `attachJiaGenomeD`；占漆练习场走 `d/paint-genome`）；敌人巡逻（默认院子，仍走现行像素直到与出击对齐）；玩家外形 `?lesson=player`；地图生成 `?lesson=map`（不打开 `liveMotion`；迭代 6 地面配色验证面；**I7-S** 乙丙丁宿主走出击同一份 `d-mixed` attach，油膜省略变体 = 种子采样）。Agent 入口 `docs/dev/gym.md`。 | `npm run gym` 或 `/gym.html`；污染句法 `/gym.html?lesson=lexicon`；油膜脉络抽卡 `/gym.html?lesson=paint-vein-card`；裂隙入口抽卡 `/gym.html?lesson=rift-entrance-card`；陈列馆 `/gym.html?lesson=lexicon-gallery` | 已实现；陈列馆课迭代 4 进行中（I4-D 已交，等人浏览）；占地基因谱已挂练习场与出击；I7-S 油膜三变体已接句法课 / 陈列馆 / 地图课 / 出击；R3菌毯 / 灰幕与油膜共用新paint-genome表面材质；碎片配色迭代 6 COMPLETE |
| GymFormRenderers | src/gym/form-renderers/ | A/B/C 冻结对照，仅句法课。gym registry 从生产路径 re-export 方案 D。禁止 `RiftScene` import 本目录 | `getFormRenderer`（A/B/C 本地 + D 来自 entities） | 已实现（对照保留，DEC-084） |
| GymLexiconGalleryCatalog | src/gym/lexicon-gallery-catalog.ts | 陈列馆视觉身份目录：合法填法 → 去重后的标本列表。无 Phaser attach。I4-B/C 只消费，不自己做笛卡尔。I5-S 占地 gym 行自动进甲下拉。街具残骸一厅。**I5-L：** 甲导航把哺乳动物拆成四个邻域入口（猫科 / 鹿科 / 爬行 / 类人）；`form.substrate` 仍是 `mammal_remnant`。**I5-H（波 12 code 已交）：** 甲占格「采样种子 8」；灯柱 / 栏柱不进目录。**I7-S：** 丙导航把油膜拆成三个变体入口（聚珠成滩 / 沾抹拖尾 / 薄滩收边）；`form.substrate` 仍是 `oil_film`；锁定数 `total=1974`（甲 1632 / 乙 18 / 丙 270 / 丁 54）。 | `enumerateGallerySpecimens` / `visualKeyOf` / `GALLERY_AXES` / `galleryDedupeCopy` / `galleryHallsOf` / `jiaSeedForMammalNeighborhood` / `jiaSeedForStreetWreckage` / `GALLERY_JIA_SEED_BUCKETS` / `oilFilmHallId` | 已实现（I4-A）；I5-S 目录随 gym 行膨胀；I5-L 甲哺乳动物四入口；I5-H 采样种子 8 已交；I7-S 油膜三入口已交 |
| GymGalleryVirtualize | src/gym/gallery-virtualize.ts | 陈列馆厅排法与挂载选集。无 Phaser。场景与 `check:gallery-catalog` 共用同一份上限 / 格距 / 厅最小缩放 / 逻辑分辨率。相交格必须进 keep；驱逐只在视野外。**I5-H：** 甲厅 8 采样种子后重算，甲 `GALLERY_ATTACH_CAP=48` / `GALLERY_ZOOM_MIN=1.1` 仍盖住（合法缩放最大相交 35）；乙丙丁未改 | `layoutGalleryHall` / `selectGalleryKeep` / `GALLERY_ATTACH_CAP` / `GALLERY_ZOOM_MIN` | 已实现（I4-D）；I5-H 重算甲浏览态纹理顶 |
| GymLexiconGallery | src/gym/gym-lexicon-gallery-scene.ts | 陈列馆课：厅导航 + 视口虚拟化 + 开发标签 + 检视全速活（切四朝向与四个信号相）。走 `attachGymFormVisual`（`d/gym-attach.ts`）：占地 `attachJiaGenomeD`；占漆 `attachBingPaintGenome`（油膜厅钉 `paintVeinVariant` 3/4/5）；占墙 / 占空仍生产 `d-mixed`。**基因谱占地消费 `facing4` / `signal` / `pose.moving`（I5-N 人过；I5-G 热修 code 已交 / DEC-098）。** 与视野相交的格子必须挂上（DEC-086）。 | `GymLexiconGalleryScene`；`?lesson=lexicon-gallery` | I4-D 已交；迭代 4 仍等人浏览；I5-B 占地已挂基因谱；I7-S 油膜三入口已交；I5-N 人过；I5-G 热修 code 已交，画面等人再看检视动画 |
| GymPaintVeinCard | src/gym/gym-paint-vein-card-scene.ts | **历史对照课：** 打开即六格挂 `attachBingPaintGenome`（`paintVeinVariant` 0–5）：A/B/C 树 tweak + D/E/F 已被 DEC-101 锁定为生产的三支原形。同一种子 / 改写档 / 油膜。不刷玩家、不创建 Enemy / 宿主。课不删。生产油膜不采样 0/1/2。禁止 import `d/genome`。 | `GymPaintVeinCardScene`；`?lesson=paint-vein-card` | 已实现（2026-08-27）；对照课保留 |
| GymRiftEntranceCard | src/gym/gym-rift-entrance-card-scene.ts | 裂隙入口外形对照课。五卡两行、6fps 八帧循环、约 4×：上排卡 5 击裂（生产默认，DEC-114）/ 卡 4 地缝（对照）；下排卡 7 错位 / 8 掀皮 / 9 网裂。键 4 / 5 / 7 / 8 / 9 高亮。底是出击同一份净化点混凝土（`createPurificationFloorTexture`），不是纯黑。复用 `rift-entrance-visual.ts` 图集。不刷玩家、不走出击。这里换卡不改生产默认 | `GymRiftEntranceCardScene`；`?lesson=rift-entrance-card` | 已实现（DEC-113 / DEC-114；7/8/9 对照中） |
| GymOfferingCard | src/gym/gym-offering-card-scene.ts | 供奉台外形抽卡课。九卡三行三列、6fps、5×。键 1–9。H/I 键 [ ] 切装填档。底是出击同一份净化点混凝土。生产默认 = 卡 I 环（DEC-115）；**人终审 PASS（2026-09-04）**；课不删 | `GymOfferingCardScene`；`?lesson=offering-card` | 生产已翻；对照课仍开 |
| GymGrowthCard | src/gym/gym-growth-card-scene.ts | 培养藏外形对照课。三卡一行、6fps。键 1–3。A 立缸 40×42 放大 4×（生产默认，DEC-116）；B / C 仍 32×36 放大 5×。底是出击同一份净化点混凝土。上一轮九张作废 | `GymGrowthCardScene`；`?lesson=growth-card` | 生产已翻；对照课仍开 |
| ContaminationFormRenderer | src/entities/form-renderers/ | 生产视觉层（方案 D：`d-mixed` + `d/**`）。接口只此一份。`RiftScene` 只允许 import 这里（I3-E 已接）。迭代 5：占地基因谱模块 `d/genome/`；**I5-J：** 出击 `d-mixed` 占地 = `attachJiaGenomeD`。**I7-S：** 出击 `d-mixed` 占漆：油膜 = `attachBingPaintGenome`（省略变体 = 种子采样）；菌毯 / 灰幕仍 `attachBingD` | `getFormRenderer('d-mixed')` / `attach` / `FormVisual.update` | 已实现（I3-E 已接裂隙；I5-J 出击占地走基因谱；I7-S 出击油膜走三变体） |
| JiaGenome | src/entities/form-renderers/d/genome/ | R3生产占地入口：attach/bake委派production-models六家族；共享body-pixel-material统一材质，家族独立解剖与动作。旧节点/算子/weld及街具/门框骨架仅留历史gym回退，不构成生产目录。 | attachJiaGenomeD / bakeJiaGenome / productionModelFor | I18 R3已实现，六家族14主形三档；美术终审待 |
| GymFormAttach | src/entities/form-renderers/d/gym-attach.ts | 练习场跨层分发器：占地 → `attachJiaGenomeD`；占漆 → `attachBingPaintGenome`；占墙 / 占空 → 生产 `d-mixed`。不属于任何基体目录。句法课 / 陈列馆从此 import。I7-S QA 偏差处置：从 `d/genome/attach.ts` 迁出。 | `attachGymFormVisual` | 已实现（I7-S 后迁出；闸门源码断言指向本文件） |
| PaintGenome | src/entities/form-renderers/d/paint-genome/ | 占漆拓扑基因谱：菌毯=实心多瓣团、油膜生产=聚珠/沾抹/薄滩三变体（DEC-101，省略 `paintVeinVariant` 时 `mix32(seed, 'oil_film_variant') % 3` 采样 3/4/5）、灰幕=环/薄覆层；`veinTree` 缺省仍是树（闸门对照 / 抽卡 A/B/C）。覆盖档=拓扑违规。烘焙消费感知 / 节律 / 连续性。句法课 / 陈列馆 occupancy `paint` 走 `attachBingPaintGenome`。出击 `d-mixed` 仅油膜走同一份；菌毯 / 灰幕仍 `attachBingD`。呼吸 DEC-070：每帧场形变（`live.ts`），禁止 4 帧切图。传了 `veinVariant` 3/4/5 时活层分模式；菌毯 / 灰幕 / 缺省树导向不变。陈列馆油膜三入口钉读法。练习场油膜可钉 0–5 或按种子采样。闸门 `check:paint-genome-topology`。不要代勾画面 PASS。 | `bakePaintGenome` / `attachBingPaintGenome` / `paintPaintGenomeLive` / `oilFilmProductionVeinVariant` / `resolvePaintVeinVariant` / `topologyOf` | 已实现（I7-S 油膜已升出击；R3菌毯 / 灰幕与油膜共用新paint-genome表面材质；I7-R 三变体活层已交） |
| ContamPreviewTools | tools/contam-preview/ | 外形基因谱论证预览与粗占格测量；L1 诊断；I6-E 对比度 / 青绿 / 烤图身份指纹闸门；I10-HOTFIX-1 堆 vs 地面对比度闸门。Phaser 桩离线跑。不进 `src/**`，不进游戏 | `npm run preview:contam-current` / `preview:contam-proto` / `measure:contam-distinct` / `measure:l1-reach` / `measure:ground-teal` / **`check:contam-floor-contrast`** / **`check:palette-quantize`** / **`check:loot-pile-contrast`** | 论证用（DEC-087）；`measure:contam-distinct` 仍测旧原型。生产闸门 `check:contam-distinct`（I5-H 已交：`tools/contamination-lexicon/check-contam-distinct.ts`，测 `bakeJiaGenome`，禁止 IoU）与 `check:contam-floor-contrast`（I6-E 已交）；堆对比度 `check:loot-pile-contrast`（I10-HOTFIX-1 / DEC-110） |
| EnemyFactory | src/entities/enemy-factory.ts | 敌人实体：碰撞体 + 程序像素回退（渗透体 32×32 / 改写体 32×48；GameObject 不旋转）+ teal 指示物 + 残影 + 脱落尘 + 木偶步态 + AI 状态块 + `spawnData.form`（I3-A；禁止再按 role 三元硬编码出击 form）。`setVisualSuppressed` 默认 false；I3-E 出击在方案 D ready 时调用（藏默认身体，保留 Arcade / AI / 既有 AI 态指示物） | createEnemy(scene, spawn, config, position, factoryConfig), createEnemyTypeConfig(role)；`Enemy`：getId/getRole/getForm/getPosition/getFacingAngle/getFacing4/getState/isEngaged/getDetection/setVisualSuppressed | 已实现（I3-A form 管线；I3-E suppress） |
| InfiltratorSprite | src/entities/infiltrator-sprite.ts | 渗透体密像素 32×32 四向 + 步态帧（前倾猎食）。碰撞仍 20。成品，不换精灵表 | generateInfiltratorPlaceholders(scene), infiltratorMotionTexture | 已实现（DEC-066） |
| ContamFlakes | src/entities/contam-flakes.ts | 敌人青绿 1px 脱落尘 + 改写体脚下污斑。迈步可爆发 | generateContamFlakeTextures, ContamFlakes, ContamStain | 已实现（2026-08-20） |
| RewriterSprite | src/entities/rewriter-sprite.ts | 改写体程序绘制 32×48 四向 + 步态帧（右侧崩坏、teal 簇 17）。成品，不换精灵表 | generateRewriterPlaceholders(scene), rewriterTextureFor | 已实现（DEC-066） |
| DetectionPulse | src/ui/dom/detection-pulse.ts | 裂隙屏缘干涉：`#rift-detection-rim` 挂 `#dom-ui-root`。16px 边带矩形齿，最多 2 方位，无数字。场景层翻译察觉度/方位，不 import AI | create(), update(dt, view, player, threats), destroy() | 已实现（Slice 8 C1） |
| ContaminantSystem | src/systems/contaminant-system.ts | 污染物库存管理与生命周期（防御 slot 承伤 → 冲击点数满 3 转化为工具 → 出击使用 → 耗尽破碎），module-level singleton | getAll(), getDefenseSlotted(), getSortieLoadout(), acquire(type, rarity), slotDefense(id, slotIndex), unslotDefense(slotIndex), slotSortie(id, slotIndex), unslotSortie(slotIndex), applyImpactCharge(isHighTide), useTool(id), getState(), loadState(), reset() | 已实现（Slice 3） |
| LootSearchSystem | src/systems/loot-search-system.ts | 裂隙可翻找对象读条：按住 E 1200ms、48px、打断清零、开始一次 suspicious 噪音、揭晓入账。外观不泄露内容物。取代 LootSystem / ContaminantNodeSystem 的 overlap 触碰拾取 | create(scene, kindling, contaminants, config), update(delta, input), getCarriedKindling(), addBonusKindling(n), getUncollectedSearchPositions(), getCollectedContaminantPositions(), destroy() | 已实现（迭代 10 / DEC-109；I10-FINAL 翻生产） |
| LootSearchPresentation | src/systems/loot-search-presentation.ts | 统一残骸堆外观 + 翻找微动 + 揭晓粒子。堆色四槽查表（DEC-110 v2）：主体按 fragmentTypeId 查残骸格，渍缝 stainKey，底影 void-black，高光 metal-light。墙模拟 RGB 量化已退役。每碎片 3 个排布变体预生成 | ensureLootSearchTextures / createSearchObjectVisual / derivePileSlots | 已实现（迭代 10；I10-HOTFIX-1 配色 v2） |
| LootSearchHud | src/ui/dom/loot-search-hud.ts | `[E] 翻找` / `[E] 撤离` 提示、底部装置读数条、残渣 toast-inline。挂调用方 overlay 根 | create(overlayRoot, opts?), setPrompt, setChannel, flashResidue | 已实现（迭代 10） |
| DefenseEngine | src/systems/defense-engine.ts | 冲击结算时计算各防御 slot 的效果（减伤/薪柴增益/稳定度变化/副作用等），纯函数无 Phaser 依赖；`solidifyCounters` 是唯一跨冲击持久的内部状态（不进存档） | applyDefenseEffects(baseDamagePerModule, defenseSlots, context), resetDefenseEngine() | 已实现（Slice 4，`applyGenericDefense()` 内 6 处机制标注 `handled externally`/`future iteration` 待 Slice 5 T3 接线） |
| ToolSystem | src/systems/tool-system.ts | 十三族非武器污染物的消费前验证、来源隔离控制、有限效果和VFX寿命；旧族仅兼容 | create, useSlot, getLastUseFailure, update, syncHostVisuals, syncBodyVisuals, getActiveTimedEffects, notifyEnemySuspicious, notifyProximityAvoid, reset, destroy | 迭代20：AI/Combat/Host真实接线，最后一次完整；环境视觉跟随当帧核心；背光快照区分移动体/核心/物资 |
| ToolBodyEcho | src/systems/tool-body-echo.ts | 真实姿态的独立像素快照；留影、记忆、凝滞、实体化 | captureBodyEcho → update / destroy | 三层缓存、源透明度/裁切/origin/scale保留、销毁幂等；不读失视目标实时姿态 |
| ToolGroundVfx | src/systems/tool-ground-vfx.ts | 技能物件、压痕、纤维、砂灰与压制材质 | drawToolObject, drawPressure, drawFootDrag, drawSeam, drawHostRestraint, muteSuppressedMaterial | 视觉消费权威状态，不产生机制；具体语言见tool-vfx-spec |
| GrowthSystem | src/systems/growth-system.ts | 永久改造购买、费用计算与效果聚合，module-level singleton | getLevel(id), getMaxLevel(id), getCost(id), canAfford(id, reserve), purchase(id), getModifiers(), getState(), loadState(), reset() | 已实现（Slice 3，当前 3 项改造） |
| TideSystem | src/systems/tide-system.ts | 潮汐冲击强度状态机（Rise→Crest→Ebb→下一 Tide），替代线性递增，module-level singleton | getState(), getCurrentIntensity(), isHighTide(), advanceCycle(), loadState(), reset() | 已实现（Slice 3） |
| ImpactSystem | src/systems/impact-system.ts | 冲击伤害计算与结算（重点目标 + 其余承血模块均分残差、接入 DefenseEngine、写回 GameState），预告在全部三模块中抽 | getForecastDisplay(), getForecastLookahead(), resetForecastState(), run(defenseSlots?), generateForecast() | 已实现（Slice 2-4；Slice 7 三模块抽目标 + DefenseContext 三键） |
| StabilityTracker | src/systems/stability-tracker.ts | 净化稳定度积分与进度追踪（0-100，到达后 `reached` 永久为真），module-level singleton | getProgress(), isReached(), addProgress(reason, amount), getState(), loadState(), reset() | 已实现（Slice 3） |
| RunController | src/systems/run-controller.ts | 出击生命周期唯一出口：死亡/撤离 → 结算延迟 → 场景过渡；`runEnded` 标志防止双触发；`class` 由 RiftScene 持有实例 | create(scene, deps), isRunEnded(), getElapsedMs(), restart(), destroy() | 已实现（Slice 2+；Slice 6 C4：`restart()` 阵亡与撤离都回净化点） |
| ExtractionSystem | src/systems/extraction-system.ts | 撤离点脉冲标记渲染与撤离请求判定（不 import 其他系统，视野 glow 源经注入回调注册） | create(scene, extractionPoint, getPlayerPosition, isRunEnded, config?), update(deltaMs), canExtract(), requestExtract(), reset(), destroy() | 已实现 |
| LootSystem | src/systems/loot-system.ts | **已退役（迭代 10）**。overlap 触碰拾取与金色晶体外观由 `LootSearchSystem` 取代 | — | SUPERSEDED |
| TrailSystem | src/systems/trail-system.ts | 玩家足迹余迹渲染（仅视野内可见，随混乱值加速消退，仅绘制相机视口内 tile） | create(scene, mapWidth, tileSize, getVisibility), update(playerTileX, playerTileY, chaosValue, deltaMs), reset(), destroy() | 已实现 |
| BoundaryShape | src/systems/boundary-shape.ts | 净化点边界几何的唯一真相：潮汐驱动的极坐标压力 blob（椭圆 × 潮汐缩放 × 方向压力叶 × 交互点安全钳制）。每次 scene create 构建一次，构建后为无状态廉价查询 | `createBoundaryShape(config)`：radiusAt(angle), normalizedDist(x,y), isInside(x,y), pressureAt(angle), pressureDirection, tideScale, centerX/centerY | 已实现（Slice 4.5） |
| BoundaryBreath | src/systems/boundary-breath.ts | 边界局部压力冲击与膜变形的纯视觉叠加层（并发短弧向内扫入 + 虚空侵入楔形 + 膜线内凹）。不参与碰撞/可见性/gameplay | create(scene, shape, tidePhase), update(dt), destroy() | 已实现（Slice 4.5） |
| BoundaryAtmosphere | src/systems/boundary-atmosphere.ts | 净化点边界外粒子与 apparition 氛围渲染；生成/消亡半径跟随 BoundaryShape 而非固定圆 | create(scene, shape), update(dt), destroy() | 已实现（Slice 2，Slice 4.5 改为跟随 blob） |
| ProceduralSurface | src/systems/procedural-surface.ts | 每次出击烤一次地表（含雾；尘点不烤死）；天空+尘点低分辨率叠层只改 phase，沿本趟 windX/Y。**氛围簇应用已下线（DEC-104 / I8-G）：** `bakeGround` 缺省不铺无主簇；出击与地图课不传整图呼吸。晶结 / 溶蚀 / 平涂只练习场对照。L1 渍/纹理/划痕仍在。`deriveContamRamp` 仍服务敌人四档与占漆配色。DEC-097：最终量化不再把虚空/暗地吸进青绿亮端 | RiftSurfacePainter.mount(scene, ruins, key, depth, opts?) / update / destroy | 已实现（Slice 6；尘点跟天空同一份 AtmosphereField；DEC-104 氛围簇下线；DEC-070/071 活层技术转占漆宿主；I6-C / I6-D / DEC-097 仍在） |
| ClusterPulse | src/systems/cluster-pulse.ts | **对照用。** 菌毯 / 灰幕旧皮仍可走 `paintClusterBreath`。出击地面不再挂整图呼吸（DEC-104） | paintClusterBreath(out, width, height, field, elapsedMs) | 已实现（氛围应用已下线；旧皮对照保留；迷雾下亮度人终审 PASS） |
| ProceduralPurificationSurface | src/systems/procedural-purification-surface.ts | 净化点地表逐像素程序化生成（7 层：石板噪声/冷暖径向/踩踏痕/接缝/暖屑/边界 vignette/teal 渗点）；vignette 直接读 BoundaryShape 的梯度带，软过渡替代硬墙 | createPurificationSurfaceTexture(scene, map, key, shape, interactionPoints) | 已实现（Slice 4.5） |
| PanelStyles | src/ui/dom/panel-styles.ts | 固定逻辑画布上的轻量界面共享样式：正文12px、标题20px、无实体罩HUD10–11px；主面板680×468，分配450×452；面板局部无衬线标题，静态SVG颗粒位于文字下方，半透明多层底色。视觉记录见当前UI Kit A节 | injectPanelStyles(), createCrtPanel(), getDomUiRoot(), bindDomUiRootToGame(), showToastInline(), showToastStamp() | 迭代11 R3；HUD已人PASS，面板材质待复评 |
| PanelRenderState | src/ui/dom/panel-render-state.ts | 供奉/装配/蜕变/报告共享的稳定渲染：选择更新只替换详情和底栏，保留列表DOM；全量更新恢复滚动位置；切页显式重置 | renderPanelContent(panel, html, selectionOnly, resetScroll?) | 迭代11 R2，滚轮回顶修复 |
| SideEffectLabels | src/ui/side-effect-labels.ts | 防御副作用（`PendingSideEffect`）的唯一人类可读文案来源，供裂隙开局 toast 与冲击结算面板的"本次产生的残留"披露共用，避免两处映射各自维护而漂移。混乱增速可见写法也从这里出（相对 1.0 的 ±N%） | describeSideEffectBody(e), describeSideEffectWithSource(e), formatChaosRateDelta(rate), formatChaosMultDelta(mult) | 已实现（Slice 5.5 C5 引入，本轮补登记；R9 收口混乱增速） |
| ContaminantNames | src/ui/contaminant-names.ts | 污染物中文名 + 库存排序的单一权威入口，替代各面板各自维护的本地名表（CLAUDE.md 策划数据源规则 + IA §S13/§S15 V8） | getToolName(type), getDefenseName(type), getRarityStars(rarity), sortContaminants(list) | 已实现（Slice 5.5 C2 引入，本轮补登记；C3 新增 getRarityStars/sortContaminants） |
| InspectDock | src/ui/dom/inspect-dock.ts | 检视层五层内容构建（L1 身份/L2 CSV `summaryDefense`/`summaryTool`/L3 数值/L4 与我的关系/L5 转化去向），替代原生 `title` tooltip（`.inspect-dock` 容器与样式在 PanelStyles） | buildDefenseInspectHtml(c, ctx), buildToolInspectHtml(c, ctx), INSPECT_EMPTY_HTML | 已实现（Slice 5.5 C3；R10 L2 读 CSV 摘要列） |
| PurificationModuleEntity | src/entities/purification-module.ts | 净化点模块视觉。**CORE** = 32×40 v6 贴图（默认 B 仪式；`?core=a\|b\|c` 与键 1/2/3 切对照）；**PURIFIER** = B1 横卧过滤罐 8 帧图集（观察窗介质翻滚 + 进排气微粒）；**STORAGE** = C1 顶压观察井 8 帧图集（DEC-112）。HP 三态 + 灯 + 脚下完整度条仍在。贴图由 BootScene 预加载 `public/assets/sprites/modules/`（DEC-ARCH-018）。裂隙入口不在本实体 | `new PurificationModuleEntity(config)`：id/type/x/y（getter）, create(scene), update(playerX, playerY), isInRange(), setProximityGlow(inRange), setCoreVariant(v), getEffectPct(), getHpData(), destroy() | 已实现（Slice 2+；Slice 7 第三模块；purif-visual-pass 三模块翻贴图） |
| MenuEntryTransition | src/scenes/menu-entry-transition.ts | 首页独占的跨场景黑罩，先声后画、微zoom落位、HUD与输入交还；Phaser时钟定里程碑，DOM compositor动画跟随scene暂停/恢复；shutdown释放 | new MenuEntryTransition(mode), depart(scene,text,onCovered), arrive(scene,revealHud,onReady), destroy() | 迭代14 COMPLETE，用户验收结案；ui-menu-entry-transition.md |
| MainMenuActor | src/scenes/main-menu-actor.ts | 原人物轮廓mesh，脚底固定的呼吸/重心变化；imagegen clean plate仅露出人物背后小区域，减少动态恢复原图，shutdown释放mesh/动态纹理/监听。由MainMenuScene创建在Atmosphere之前；首页相机不取整，人物cutout单独LINEAR采样以消除低幅动作跳步 | new MainMenuActor(scene), update(delta), lampOffset, destroy() | 迭代13 COMPLETE，含人物平滑热修，人终审PASS |
| MainMenuAtmosphere | src/scenes/main-menu-atmosphere.ts | 首页已锁原图上的炉光、双层肩灯、3片纹理裂纹发光、4条炉口火芯与20粒尘；减少动态时关闭、后台暂停、shutdown释放对象/纹理/监听；只由MainMenuScene持有，不进入世界照明系统 | new MainMenuAtmosphere(scene), setActorOffset(x,y), update(delta), destroy() | 迭代13 COMPLETE，人终审PASS |
| RiftEntranceVisual | src/scenes/rift-entrance-visual.ts | 净化点北侧裂隙入口的世界内外形。**生产默认 = 卡 5 击裂**（DEC-114）：40×56 × 8 帧、6fps 的**地面裂缝贴花**，画在地面平面内，锚点中心、depth 1（地板0 / 动态实体[20,38)（DEC-120）），玩家能踩过去。`?entrance=4|7|8|9` 与场景内键 4/5/7/8/9 切对照（卡 4 地缝是 DEC-113 留下的另一张）。贴图缺失回落旧呼吸圆点。不进 `PurificationModuleEntity`；交互（32px → 按 E 开出击装配）不因外形改变 | `ENTRANCE_FRAME_W/H` / `ENTRANCE_FRAMES` / `ENTRANCE_FPS` / `ENTRANCE_ORIGIN_Y` / `ENTRANCE_DEPTH` / `ENTRANCE_DEFAULT_VARIANT` / `entranceSheetKey` / `entranceSheetUrl` / `enqueueEntranceSheets` / `readEntranceVariantQuery` / `RiftEntranceVisual` | 已实现（DEC-113 / DEC-114） |
| OfferingStandVisual | src/scenes/offering-stand-visual.ts | 净化点西南供奉台的世界内外形。**生产默认 = 卡 I 环**（DEC-115）：32×32 × 32 帧（4 档 × 8 帧、6fps），立着 45° 等距，锚点脚底；默认depth20，净化点由GroundDepthSorter覆盖（DEC-120）。装填档跟槽里残渣个数走（空 / 一 / 二 / 三 = 0 / 1 / 2 / 3+）。贴图缺失回落旧呼吸圆点。不进 `PurificationModuleEntity`；交互（32px → 按 E 开防御槽）不因外形改变 | `OFFERING_FRAME_W/H` / `OFFERING_FRAMES` / `OFFERING_FPS` / `OFFERING_ORIGIN_Y` / `OFFERING_DEPTH` / `OFFERING_SHEET_KEY` / `enqueueOfferingSheet` / `OfferingStandVisual` / `offeringStandChargeFromSlots` | 已实现（DEC-115） |
| GrowthConsoleVisual | src/scenes/growth-console-visual.ts | 净化点西侧培养藏的世界内外形。**生产默认 = 卡 A 立缸**（DEC-116）：40×42 × 8 帧、6fps，立着 45° 等距，锚点脚底；默认depth20，净化点由GroundDepthSorter覆盖（DEC-120）。贴图缺失回落旧呼吸圆点。不进 `PurificationModuleEntity`；交互（32px → 按 E 开蜕变）不因外形改变 | `GROWTH_FRAME_W/H` / `GROWTH_FRAMES` / `GROWTH_FPS` / `GROWTH_ORIGIN_Y` / `GROWTH_DEPTH` / `GROWTH_SHEET_KEY` / `enqueueGrowthSheet` / `GrowthConsoleVisual` | 已实现（DEC-116） |
| Generated CSV Data | src/generated/ | CSV→TS 构建期产物（策划数据源规则强制，`npm run codegen` 生成，不手写）：`contaminant-data.ts` ← `data/contaminants.csv`；`upgrade-data.ts` ← `data/upgrades.csv`；`rift-fragment-data.ts` ← `data/rift-fragments.csv`；`enemy-data.ts` ← `data/enemies.csv` | `CONTAMINANT_DATA`；`UPGRADE_DATA`；`RIFT_FRAGMENT_DATA` / `ENABLED_RIFT_FRAGMENTS`；`ENEMY_DATA` / `ENEMY_ROLES` | 已实现（Slice 4；Slice 6 C2 加碎片表；Slice 8 C1 敌人表） |
| InteractionTrigger | src/systems/interaction-trigger.ts | 接近触发交互检测与面板激活 | register(entity, callback) | 规划中（当前由各 Scene 直接实现 overlap 检测 + 面板调用，未抽出独立模块） |
| InsectModel / InsectVisual | src/entities/form-renderers/d/insect-model.ts；insect-visual.ts | 迭代16独立虫模型、四向与动作投影；单实体单CanvasTexture，真实战斗相位驱动；生产与练习场共用，旧虫骨架不再驱动当前显示 | bakeInsectModel；attachInsectVisual；FormVisual.getFlashSource | R3用户PASS（2026-09-07） |
| HumanModel / HumanVisual | src/entities/form-renderers/d/human-model.ts；human-visual.ts | I17独立人形残余三档四向六动作，64×64脚底锚(32,42)，单实体动态纹理；真实攻击时钟与当前轮廓闪白 | bakeHumanModel；attachHumanVisual；FormVisual.getFlashSource | 内部验证已交，待人审 |
| PollutionReview | src/dev/pollution-review.ts；pollution-review.html | DEV隔离存档入口，调用正式RiftScene、可见输入按钮与只读轨迹；不进入生产构建 | probeEnemyReview；probeInspectEnemy；probeReviewHit | 迭代16验证入口 |
| MapGenerator | src/generation/ | 裂隙程序化布局。抽风格锚 + 新种子 + 邻域抖动；每次踏入抽 FragmentRoll（contaminationAge × ruinSeverity）。换路硬保证（规格 21：`evaluateDualPath`）。手写图仅夹具。扩空间见 `docs/design-notes/slice-6-layered-generation.md`「Agent 入口」。I3-A：一份 `contaminationDraw`（`mix32(seed, 'lexicon')`）喂甲 spawn.form 与宿主。**I8-Q：** 占漆钉 `paintFloors`（贪婪薪柴路径，偏咽喉）；不足掷出的 N 则本图重试，禁止钳小 | generateOutline；generateRecipeDraft；jitterRecipe；rollFragmentAxes；evaluateDualPath；generateRiftLayout；rollPaintHostCount；collectContaminationPins | 已实现（Slice 6 COMPLETE）。裂隙吃生成结果。画廊是样例。天空+尘点 phase 循环。无换路 = 坏图。I8-Q 占漆配额已接 |
| PaletteQuantize | src/generation/palette-quantize.ts | 色温分组 + 组内色相方向量化（I6-B）。L1 候选池与青绿家族供地面/敌人共用。禁止全色板 nearest 当 L1/L2 生产成功路径。地面 L2 已接（I6-C code）；敌人四档经 `deriveFragmentContamRamp` → `deriveContamRamp`（I6-D）。DEC-097：最终像素量化禁止对虚空/低亮走青绿组内色相方向提亮；虚空只落虚空黑三格。**DEC-110：** 残骸三格（debris-earth / debris-rust / debris-wood）均值 >55 不进 L1；`nearestPalette` 也跳过它们，避免地面 / 墙 / 污染再量化吸进堆主体色 | temperatureGroup；quantizeInGroup；quantizeL1；l1Pool；TEAL_FAMILY；DEBRIS_HEX；nearestPalette | 已实现（I6-B；地面接线 I6-C 整批已交，art 最短核合规过、好看不代勾；敌人接线 I6-D 已交；I6-C 热修 DEC-097 量化收口已交，**热修画面人 PASS**；DEC-110 残骸格已登记） |
| RiftHud | src/ui/dom/rift-hud.ts | 裂隙内游戏状态显示（完整度条/混乱条/薪柴数/工具槽/撤离提示/生效中行），`class RiftHud` 由 RiftScene 持有实例；结算面板已拆到 RiftResultPanel。生效行用 `.device-effect` 名+秒分节点；remainingMs 由场景每帧权威 set，HUD 不再自减。`CHAOS_CHANGED` 且 `delta > 0` 时条头填充一次 180ms 短促提亮（不按来源分色；挂载根仍是 `#dom-ui-root`） | create(config), update(deltaMs), setActiveEffects(effects), reset(), destroy() | 已实现（Slice 1+；Slice 5.5 迁 DOM；R10 工具剩余秒；CH-HUD-3 正增量强调） |
| RiftResultPanel | src/ui/dom/rift-result-panel.ts | 撤离/阵亡结果优先显示带回薪柴，次级战果和拾获可滚动；鼠标返回与 R 键汇入 RunController.restart() | isOpen(), show(data, onContinue?), close(), destroy() | DEC-119；继续回调新增，旧调用兼容 |
| Minimap | src/ui/minimap.ts | 裂隙圆形局部窗口：直径 33 格、画布 99 像素，跟随玩家当前格。已探索由场景层用真实视野累积后写入；玩家十字带朝向短臂；覆盖内撤离竖缝 / 深渊方点 / 节点菱形。`#rift-minimap.device-plate` 挂 `#dom-ui-root` | create(mapTiles, mapWidth, mapHeight, tileSize, extractionPos), markExplored(tileX, tileY), update(playerWorldPos, facing, deltaMs), reset(), destroy() | 已实现（Slice 5.5 迁挂载根、改标记形状；Slice 6 C6 圆窗 + 真实视野 + 朝向） |
| AllocationPanel | src/ui/dom/allocation-panel.ts | 模块投入、实际效果预览。三装置场景交互接收真实投影锚点，贴近实体读数与右侧操作；提交650ms反馈并防重复，清理rAF/计时器。其他分配仍用普通面板 | isOpen(), open(moduleId, onClose?, CoreAllocationContext), close() | R4核心人PASS，R5六点推广；旧调用兼容 |
| DefensePanel | src/ui/dom/defense-panel.ts | 供奉墙机：只读身份带（三格都暗）+ 上槽下库。无顶 Tab。库存空走空状态三件套 | isOpen(), open(onClose?), close() | 已实现（Slice 3+；I11-B4c 同族） |
| GrowthPanel | src/ui/dom/growth-panel.ts | 蜕变墙机：只读身份带（三格都暗）+ 六张刻入 + 第七张加厚。无顶 Tab | isOpen(), open(onClose?), close() | 已实现（Slice 3+；DEC-117 并进加厚；I11-B4c 同族） |
| ImpactResultPanel | src/ui/dom/impact-result-panel.ts | 冲击结果先显示最大损伤，再展示装置前后完整度、供奉与转化事实；Enter / Esc / 合上按钮共用消解出口 | isOpen(), show(damages, intensity, onDone, options?), close(), destroy() | DEC-119 结果层级与鼠标出口 |
| LoadoutPanel | src/ui/dom/loadout-panel.ts | 出击装配墙机：只读身份带 + 工具槽 + 只读出击预估三项（表名薪柴价值）。无顶 Tab | isOpen(), open(onConfirm, onClose?), close() | 已实现（Slice 3+；I11-B4c 同族） |
| StatusPanel | src/ui/dom/status-panel.ts | 存续报告墙机：身份带 + 顶 Tab（装置/残渣/潮汐/蜕变）+ 详情主-从。`open` 第二参是净化点最近 overlap 类型，用来亮走近的台 | isOpen(), open(onClose?, nearestOverlap?), close() | 已实现（Slice 3+；I11-B4a 主-从） |
| ModuleIdentityStrip | src/ui/dom/module-identity-strip.ts | 三模块身份带 HTML helper（名 + 条 + hp/maxHp）。效果百分比不进带。供存续报告 / 分配 / 蜕变 / 供奉 / 出击装配同族 | identityBandHtml(opts) | 已实现（I11-B4c 抽出，不是新系统） |
| PauseMenu | src/ui/dom/pause-menu.ts | 局内 Esc 记录菜单：新的纪录 / 沿旧路返回 / 合上。关闭=场景原样恢复；在裂隙内选新的纪录或沿旧路返回会结束当前出击 | isOpen(), open(scene), close(), discard() | 已实现 |
| Session | src/managers/session.ts | 新档/读档的共享启动序列（主菜单与记录菜单共用，避免漏 reset） | hasReadableSave(), beginNewExpedition(scene, enter?), loadExpedition(scene, enter?)；可选ExpeditionEntry回调接new/continue，只有首页传入 | 已实现 |
| PurificationHud | src/ui/dom/purification-hud.ts | 净化点贴顶 `.device-plate` 读数（薪柴上行 / 潮汐与下次归来下行）+ 底栏 `#purif-prompt`（无目标弱 / 靠近两行），挂 `#dom-ui-root`。不套 `.game-panel` | create(), updatePrompt(target), refresh(), setPromptVisible(visible), destroy() | 已实现（Slice 2+；Slice 7 净化器目标名；DEC-117 去掉加厚底栏；I11-B3 容器化） |

> 另：`src/core/object-pool.ts`、`src/utils/math.ts`、`src/utils/random.ts`、`src/config/`、`src/types/`（含 `events.ts`/`game-types.ts`/`save-data.ts`/`map-types.ts`）、`src/scenes/` 已真实存在，但属于基础设施/类型/场景，不在本"系统模块"注册表内单列。其中：
> - `src/types/map-types.ts`（T6 新增）持有地图侧数据契约：`TileMapData` / `OccluderGrid` / `WalkGrid` / `EnemySpawnData` / `PatrolRouteData` / `KindlingNodeDef` / `ExtractionPointDef` / `RiftLayoutData`。
> - `src/types/ai-types.ts`（T7 新增）持有敌人 AI 契约：`EnemyView`（含 `getRole` / `getDetection`，T3/T4/屏缘脉冲/渲染层消费）/ `EnemyAIState`（可变运行时状态，仅 AI 系统写）/ `EnemyTypeConfig` / `Perception` / `AlertLevel` / `SightZone` / `AICueId`。剖面类型从 `src/generated/enemy-data.ts` 再导出。放在 `types/` 而非 `systems/ai/` 是为了打断循环依赖。
> - `src/config/invariants.ts`（T7 新增）把设计所依赖的常量关系写成可执行断言，dev 构建在 `main.ts` 启动时校验（DEC-020）。Slice 1 覆盖敌人 AI 的 I1–I6 + 一条跨 spec 补充检查。T8/T9 的 spec 不变量应追加进同一文件。
> - `src/scenes/rift-map-data.ts`（T6 新增）是 Slice 1 手工编排的固定裂隙地图**夹具**（ASCII tile 网格 + 布点），导出 `RIFT_MAP` 与 `validateRiftMap()`。运行时裂隙走 `generateRiftLayout`；夹具给对照 / 测试。
> - 四个场景均已是真实实现（Slice 5 T0 更新，此前本注仍称 `BootScene`/`MainMenuScene`/`PurificationScene` 为骨架，已过期）：`BootScene` 加载条 + dev 深链接（`#rift`/`#purif`）+ 占位纹理生成（`src/scenes/placeholder-textures.ts`，练习场共用）；`MainMenuScene` 新远征/继续（读写 SaveManager 与各系统 reset）；`RiftScene` 每次踏入 `generateRiftLayout(seed)` + Player + VisibilitySystem + AISystem + Combat/ContaminationHostSystem/Tool/Extraction/Loot/ContaminantNode/Trail/Minimap / DetectionPulse / EncounterNarration 等系统的场景层编排；`PurificationScene` 动态力场边界 + 三模块 + 培养藏卡 A + 六点安全区钳制 + 全部 DOM 面板编排。另有开发练习场 `gym.html`（`GymBootScene` / `GymScene` / `GymPlayerScene` / `GymMapScene` / `GymLexiconScene` / `GymLexiconGalleryScene` / `GymPaintVeinCardScene` / `GymRiftEntranceCardScene` / `GymOfferingCardScene` / `GymGrowthCardScene`，见 `docs/dev/gym.md`；视野对比课已随 DEC-107 下线）。场景层负责把战斗/流程事件翻译成 AI 的刺激入口（`bindAIStimuli()`：`ENEMY_DAMAGED → reportDamage`、`ENEMY_KILLED → despawn`、`PLAYER_DIED` / `RIFT_EXIT_REACHED → onPlayerLost`），并把敌人察觉度/方位翻译给屏缘脉冲。AI 与 Combat、AI 与 DetectionPulse 互不 import（DEC-002）。

## 关键架构决策

### DEC-ARCH-001: 选择 Phaser 3 而非 PixiJS

- **选择**：Phaser 3 作为游戏框架
- **理由**：内置场景管理、物理、输入、音频、相机系统。减少约 60% 基础设施代码。文档和社区规模是 Web 游戏框架中最大的，AI vibe coding 生成质量最稳定。
- **影响**：架构受 Phaser Scene 生命周期约束；物理限于 Arcade（AABB only）；渲染管线受 Phaser 控制。
- **风险**：Phaser 的 UI 能力有限 → 用 DOM overlay 补偿。

### DEC-ARCH-002: 事件总线而非 ECS

- **选择**：事件驱动 + 系统对象，不用 ECS 架构
- **理由**：本游戏实体数量有限（同屏 <50 个活跃实体），ECS 的批量处理优势体现不出来。事件总线更直观、更适合 AI 理解和生成代码。Phaser 本身不是 ECS 设计。
- **影响**：每个系统是一个类实例而非纯函数处理器；实体通过 Phaser GameObject 管理而非组件组合。
- **约束**：如果后期敌人数量显著增加（>100 同屏），需重新评估。

### DEC-ARCH-003: Voronoi + Cellular Automata 混合地图生成

- **选择**：宏观 Voronoi 分区 + 微观 Cellular Automata 有机地形 + 碎片间裂口连接
- **技术路线定位（重要）**：Voronoi+CA 混合是本项目**要认真验证并落地的核心技术路线**，不是临时方案。下述"风险/缓解策略"的目的是**把 Voronoi+CA 做成**（保证连通性、面积均衡、可玩性），而**不是**为回退到"纯 CA"或其他生成方案预留降级路径。明确：本架构**不设纯 CA 降级路径**——若验证中遇到问题，方向是修好混合方案本身（调参、修补、约束），而非放弃 Voronoi 分层。
- **理由**：世界观设定裂隙内部是"异时空碎片"——不规则、非建筑逻辑。BSP 产出的直角房间+走廊结构过于人工/有建筑感，与设定冲突。Voronoi 切割天然产生不规则碎片边界，CA 填充产生有机洞穴感。碎片间的窄裂口（"空间撕裂"）是天然决策点（进/不进？哪个方向？），同时提供视线遮挡和路线瓶颈。
- **设计**：
  - 宏观层：Voronoi 切出 4-6 个碎片区域，定义推进方向（起点碎片 → 目标碎片）
  - 微观层：每个碎片内用 CA 迭代 4-6 轮，产出开阔区+狭窄通道交替的有机地形
  - 连接层：相邻碎片通过 1-2 个窄裂口连通（宽度 2-3 tile），裂口位置在共享边界上选取
  - 后处理：确保连通性（flood fill 验证）、放置内容（spawn/exit/loot/enemies）
- **影响**：地图不再有"房间"概念，改为"碎片区域"。寻路仍基于 tile grid（CA 输出即为 tile 数据）。视线遮挡由有机墙体自然产生。
- **潜行需求保障**：
  - 视线遮挡：CA 产出的不规则墙体天然提供掩体
  - 多路径选择：碎片内 CA 地形有多条通道；碎片间可能有多个裂口
  - 开阔 vs 狭窄交替：CA 参数控制开阔度 + 裂口本身是瓶颈
  - 内容散布合理：content-placer 按碎片区域类型分配（安全区/巡逻区/高价值区）
- **风险与缓解（均服务于"把混合方案做成"，非退回 CA）**：
  - CA 可能产出不连通区域 → flood fill 连通性验证 + 自动打通 / 重连修补
  - Voronoi 碎片大小差异过大 → 约束最小/最大面积 + Lloyd 松弛迭代平衡
  - 裂口位置不理想 / 碎片过碎 → 在共享边界上按规则重选裂口、限制碎片数量区间
  - 上述任一缓解失败 → 在同一混合框架内重试 / 调参（重试上限内），而非切换到纯 CA 或其他生成器

### DEC-ARCH-010: Slice 6 外轮廓先交一块岛（生长+腐蚀）

- **选择**：C1 可走陆地 = 种子生长 + 腐蚀 + 最大四连通块。缓冲 64×42，界外格是 `TileType.VOID`（不可走、不画墙皮；视线口径原为不挡，**DEC-106（2026-08-29）翻转为挡光**：虚空吞光，`TileGrid.isOpaque` 对 WALL / VOID 均 true）。
- **与 DEC-ARCH-003**：003 的 Voronoi 分层仍是碎片内部 / 多块拼合的长期路线。本批不切 4–6 块 Voronoi 岛。人认的体验是「一块不规则陆地漂在虚空里」；约束 1 验收看看见的边，不看宏观分区是否先落地。
- **不退回**：BSP 方正房间。CA 不当墙的结构来源（墙是 C2 情景残块）。
- **坏图**：填满缓冲、啃边矩形、贴齐四边 → 丢弃重试，不换算法。
- **影响**：`TileType.VOID` 入枚举；`TileGrid.isWalkable` 只认地板/裂口。裂隙场景仍用手写图，直到 C4。

### DEC-ARCH-011: 污染体生产渲染器不住 gym（迭代 3）

- **选择**：方案 D（`ContaminationFormRenderer` / `d-mixed`）住 `src/entities/form-renderers/`。练习场 A/B/C 冻结对照留 `src/gym/form-renderers/`。`RiftScene` 只允许 import 生产路径。
- **理由**：层 B 的裂隙场景不得依赖开发练习场目录。人选方案 D 之后，继续把生产视觉放在 `src/gym/**` 是分层倒置。
- **不删**：A/B/C 源码。人还要在句法课并排对照。
- **影响**：I3-B 已搬家；接口只保留一份（entities）；gym registry 从生产路径取 D。I3-E 已把 `d-mixed` 接到 `RiftScene`。`check:lexicon` 断言 `rift-scene.ts` 不含 gym import，且 ready 时藏甲默认身体与乙丙丁几何漆、丁 depth < 50。

### DEC-ARCH-012: 陈列馆是观察工具；渲染器只开两条管道（迭代 4）

- **选择：** 练习场新课 `?lesson=lexicon-gallery` 只 attach 生产方案 D。不创建 `Enemy` / 宿主 / 玩家。`FormAttachContext` 增加可选 `textureNamespace`（丙/丁/甲纹理键前缀，防同键互删）与 `stainWorldPoint`（丁浊点锚点；缺省仍读相机中心）。出击不传这两个字段。
- **理由：** 陈列馆同一厅会并排 attach 键碰撞的丙/丁；丁浏览时相机中心会误触发浊点。改绘制语法会让目录不再等于出击外观。
- **不改：** `d/**` 像素配方、色板、帧、剪影。`RiftScene` 行为。CSV。
- **影响：** 陈列馆必须传唯一 namespace 并在浏览态把丁浊点钉到场地外。模块登记 `GymLexiconGallery` / `GymLexiconGalleryCatalog`。合同 `docs/tasks/iteration-4.md`。迭代 5 修订：切生产前陈列馆甲可挂基因谱模块（DEC-087 / DEC-ARCH-013），不是第三套方案。

### DEC-ARCH-013: 甲基因谱练习场先行，出击默认路径后切（迭代 5）

- **选择：** 甲组合式外形（骨架语法 + 共享构件 + 违规预算）新建模块，不原地改现行 `jia-silhouette` / `jia-paint` 让裂隙静默换皮。句法课与陈列馆甲先挂新模块。`RiftScene` 与默认 `deriveFragmentContamRamp` 在 I5-J 之前不动。`tools/contam-preview/` 只作论证，生产闸门 `check:contam-distinct` 测 `src/` 实现。**DEC-088 修订：** I5-J 只升甲绘制 + 街具残骸内容翻列，**不**把方言函数升为生产 ramp（生产量化归迭代 6 / DEC-ARCH-014）。
- **双路径收成生产默认（I5-J code 已交 2026-08-26）：** 生产模块 `src/entities/form-renderers/d/genome/`（节点 / 共享构件 / 违规算子 / `weld` / 按覆盖档选画布 / 街具残骸语法 / 门框语法 / 残茎语法 / 有机残影语法 / 虫语法 / 哺乳动物语法 / 大号蠕虫语法（永远横躺） / 朝向与信号相烘焙 / 可走步态）。出击 `d-mixed` 占地 = `attachJiaGenomeD`，与句法课 / 陈列馆同一份（`street_wreckage` / `doorframe` / `stalk_clump` / `organic_remnant` / `insect_remnant` / `mammal_remnant` / `worm_remnant` 走语法骨架再算子再 weld 再朝向/信号相；街具残骸与门框固着，残茎 / 有机残影 / 虫 / 哺乳动物 / 大号蠕虫可走）。旧 `attachJiaD` / `jia-paint` 只留给 A/B/C 冻结对照。**陈列馆检视会切朝向与信号相；基因谱甲消费 `facing4` / `signal` / `pose.moving`（DEC-098）。可走基体检视有 walk 帧，浏览仍静帧。** **I5-H 已交**陈列馆采样种子 8 + `check:contam-distinct`。不要代勾画面 PASS。I5-J 不升生产 ramp。
- **理由：** 生产甲已被裂隙消费。迭代 2→3 的先例是练习场点头再接线。覆盖档画布 48×64 会改变出击观感，必须先给人在无迷雾的馆里看。污染方言列当碎片身份已撤回。
- **不改（I5-J 仍守，I5-T 已覆盖最后一条）：** `src/scenes/rift-scene.ts` 尽量无 diff；乙丙丁形；A/B/C；色板；碰撞 20；`preview-paint.ts` 生产量化。三种生物已由 I5-T 翻出击（灯柱 / 栏柱仍 gym）。
- **影响：** 模块登记 ContamPreviewTools / JiaGenome；**I5-B 已落**基因谱空壳与练习场双路径；**I5-S 已落**基体表行；**I5-J 已翻列**（`street_wreckage` = sortie；`lamp_pillar` / `railing_post` = gym）；**I5-T 已翻列**（`insect_remnant` / `mammal_remnant` / `worm_remnant` = sortie；灯柱 / 栏柱仍 gym）；**I5-E 已落**街具残骸语法（`street-wreckage.ts`；灯柱 / 栏柱 / 标牌杆为种子邻域，不是三个基体；`check:jia-street-wreckage`）；**I5-F 已落**门框语法（`doorframe.ts`；中空开口，不是单杆+座；`check:jia-doorframe`）；**I5-N 人过**基因谱甲消费朝向与信号相（`bakeJiaGenome` / `check:jia-genome-pose`）；**I5-G 人未过 / 热修 code 已交**残茎 / 有机残影语法 + 可走步态（`stalk-clump.ts` / `organic-remnant.ts` / `gait.ts`；`check:jia-stalk-clump` / `check:jia-organic-remnant`；检视 walk 帧已接，画面等人再看，不要代勾好看）；**I5-K 人过（2026-08-26）**虫语法（`insect-remnant.ts`；足总数 4–10、可走；`check:jia-insect-remnant`；不要代勾画面 PASS）；**I5-L 暂过 / 馆藏目录四个邻域入口（2026-08-26）**哺乳动物语法（`mammal-remnant.ts`；一行基体；馆藏目录四个入口猫科/鹿科/爬行/类人；`check:jia-mammal-remnant`；不要代勾画面 PASS）；**I5-M 暂过（2026-08-26）**大号蠕虫语法（`worm-remnant.ts`；永远横躺，朝向换头端与贴地高低；`check:jia-worm-remnant`；不要代勾画面 PASS）；**I5-H 已交（2026-08-26）**陈列馆采样种子 8 + `check:contam-distinct`（测 `bakeJiaGenome`；目录锁 1866 / 甲 1632）；**I5-J 已交（2026-08-26）**出击默认绘制收口。合同 `docs/tasks/iteration-5.md`。

### DEC-ARCH-014: 碎片配色走共享地面量化，敌人与地面同一份函数（迭代 6）

- **选择：** L1 地板量化与 L2 `deriveContamRamp` / `deriveFragmentContamRamp` 抽成一份选色函数。`preview-paint.ts` 与敌人 ramp 禁止再各写一份无约束 nearest。地图课与出击同时变（DEC-071，无第二套地面 ramp）。对比度闸门 `check:contam-floor-contrast`（名以迭代 6 合同为准）由迭代 5 基因谱甲与本迭代地面/敌人共用。
- **理由：** 暖碎片 L1 塌到橄榄、地面簇零着色与敌人灰 ramp 是同一量化错误的三个后果。分叉会再制造一份同语义缺陷。
- **不改：** 地图连通算法；墙数组；每帧重烤地面；色板；地板亮度整体上调；迭代 5 出击默认甲绘制路径。I6-0 已选色温分组量化服务第二层（DEC-089）。**DEC-093：** `art-direction.md` 仅授权放宽 §5.2 规则 6 与 §1.2 规则 3（art 定稿）。禁止用「组内优先命名色格」或改偏置让量化落格互不相同来冒充身份。
- **影响：** I6-P 先等价重构 `buildMass`（并入 `gridWant`）；I6-Q 拆档；I6-G 只翻旧图书馆；I6-B 抽共享选色函数（不以底色落格为成功）；I6-F 按**新**配方填参数化列并删四列死数据（居民区公寓只改列、不启用）；I6-C 改地面；I6-D 接敌人（`deriveFragmentContamRamp` 调 `deriveContamRamp`，已交）；I6-E 对四张落闸门（`check:contam-floor-contrast`：CIE76≥18、青绿占比、烤图身份指纹；已交）。**DEC-097 / I6-C 热修：** 最终量化禁止对虚空与低亮走青绿组内色相方向提亮；虚空只落虚空黑三格；闸门追加虚空青绿 < 0.05% 与可走地无整格亮端四色（code 已交，**热修画面人 PASS**）。I6-H 已取消（`surface_material` 只接脚步）。居民区公寓本迭代不启用。合同 `docs/tasks/iteration-6.md`。模块 `ProceduralSurface` / `ContamPreviewTools`。

### DEC-ARCH-015: 占漆拓扑双路径（油膜已升出击；菌毯 / 灰幕仍旧皮）

- **选择：** 占漆外形另开模块 `src/entities/form-renderers/d/paint-genome/`（拓扑 → 漆 → 覆盖档拓扑违规）。句法课 / 陈列馆 occupancy `paint` 走 `attachBingPaintGenome`。**I7-S：** 出击与地图课 `d-mixed` 的 `case 'paint'`：`oil_film` → `attachBingPaintGenome`（省略 `paintVeinVariant` = `mix32(seed, 'oil_film_variant') % 3` 采样 3/4/5）；菌毯 / 灰幕仍 `attachBingD`。概念复用三层管线，禁止 import 占地 `d/genome` 的 `operators` / `weld` / 48×64 画布。论证原型 `tools/contam-preview/proto-bing.ts` 可移植算法，禁止 `src/**` import `tools/**`。
- **理由：** 占漆已被裂隙消费。菌毯 / 灰幕仍练习场先行，避免三类一起静默换皮。人锁定油膜三变体后，仅油膜这一支升出击（DEC-101）。
- **不改（I7 当时）：** 菌毯 / 灰幕裂隙默认；占墙 / 占空像素；CSV；A/B/C 冻结对照；占地已交骨架 / 算子；碰撞；迷雾。`veinTree` 缺省实现保留给闸门对照与抽卡 A/B/C。**DEC-104 / I8-G 已改** `preview-paint.ts` / `bakeGround`：生产不再铺氛围簇。
- **影响：** 模块登记 PaintGenome + GymFormAttach（`d/gym-attach.ts`）。闸门 `check:paint-genome-topology` 测 `bakePaintGenome`（缺省油膜仍是树对照）+ 接线断言。陈列馆 `check:gallery-catalog` 油膜三入口、目录 1974。不要代勾画面 PASS。I7-U 已收口 HOW 占漆油膜节与 gym.md。

### DEC-ARCH-016: 氛围簇烤漆离开生产路径（迭代 8）

- **选择：** `bakeGround` 缺省不再铺无主崩坏簇。出击与地图课不挂整图 `liveClusterBreath`。`cluster-pulse.ts` 文件暂留，只服务菌毯 / 灰幕旧皮。`deriveContamRamp` 仍服务敌人四档与占漆配色。占漆活层（DEC-070 / DEC-071）跟宿主自己走。
- **理由：** DEC-104。看得见的成片青绿必须是有主的漆。
- **不改：** 净化点 / 加厚三档；L1 渍/纹理/划痕；尘点 / 换路 / 天空巨影；占漆三变体与计费格。
- **影响：** 模块 `ProceduralSurface` / `ClusterPulse`。闸门 `check:contam-floor-contrast` 地面青绿改测上限。合同 `docs/tasks/iteration-8.md`。

### DEC-ARCH-017: 占漆配额读年龄、钉贪婪薪柴路径（迭代 8）

- **选择：** `rollPaintHostCount(seed, contaminationAge)` 用 `mix32(seed, 'paint-count')` 在闭区间均匀取整（新生 3–5 / 标准 6–8 / 古老 9–12）。`drawSortie` 抽一份占漆 form 复制 N 只，不再读簇、不再掷 70% 硬币。钉层改为 `paintFloors`：出生→争夺档/深档薪柴最短可走链，偏咽喉；放不下先降间距再扩候选，仍不足则 `generateRiftLayout` 整图重试。
- **理由：** DEC-104 / I8-R2。有主的漆要压在还敢不敢再拿薪柴的路上，且污染度跨度可感。
- **不改：** 甲巡逻条数；乙/丁互斥 1；油膜三变体仍按个体种子采样；漆不挡路；同身份 60s 旁白冷却。
- **影响：** `contamination-draw.ts` / `contamination-pins.ts` / `ContaminationHostSystem.create` 按 `paintFloors[i]` 物化。闸门 `check:paint-quota`。

### DEC-ARCH-018: 净化点世界模块走贴图管线（purif-visual-pass）

- **选择：** 核心、净化器、储藏不再以程序化几何体为生产默认。贴图住 `public/assets/sprites/modules/`，由 `BootScene.preload` 加载（核心三张静帧 + 净化器 8 帧图集 + 储藏 C1 8 帧图集）。`PurificationModuleEntity` 贴图缺失时回落到 Slice 7 几何体。
- **理由：** 几何体只完成「标识」、没完成「存在」（`docs/art/review-2026-08-28/purification-presentation-findings-for-director.md` P1）。这是游戏首条世界实体图片资源管线——角色仍是程序像素，污染体仍是程序像素，只有净化点这三台装置改贴图。
- **不改：** 模块规则 / 数值 / HP 三态阈值 / 脚下完整度条 / 交互半径；裂隙实体不改加载策略。
- **影响：** `purification-module.ts` 公开 `coreSpriteKey` / `PURIFIER_SHEET_KEY` / `STORAGE_SHEET_KEY` / `setCoreVariant`；场景键 1/2/3 切核心对照，生产默认 B。键 4/5/7/8/9 切裂隙入口外形对照（`rift-entrance-visual.ts`），生产默认卡 5 击裂（DEC-114）。Boot 另预加载供奉台 `offering-i-sheet.png`（DEC-115）与培养藏 `growth-a-sheet.png`（DEC-116）。DEC-111 / DEC-112 / DEC-113 / DEC-114 / DEC-115 / DEC-116 / DEC-117 / DEC-ARCH-019 / DEC-ARCH-020。

### DEC-ARCH-004: 自实现 Raycasting 做视野

- **选择**：自写 raycasting 算法生成视野多边形
- **理由**：Darkwood 式有限视野是三根体验支柱的直接支撑（"绝望边缘的紧绷"）。需要精确控制形状（锥形/圆形切换）、边缘柔和度、动态障碍物遮挡。第三方方案都不够灵活。
- **影响**：是性能瓶颈之一（每帧计算）。需要优化策略：光线数量限制、静止时缓存、分辨率降级。
- **参考实现**：2D Visibility algorithm (Red Blob Games)

### DEC-ARCH-005: DOM overlay 做复杂 UI

- **选择**：净化点分配/冲击结算等复杂界面用原生 DOM 实现，叠加在 Canvas 之上
- **理由**：Canvas 内构建表单/按钮/拖拽交互的成本极高。DOM 原生支持布局、事件、无障碍。不引入 React/Vue 因为界面不超过 3 个面板。
- **影响**：需要管理 DOM 层和 Canvas 层的显隐切换和输入焦点。
- **约束**：DOM UI 不能与游戏画面同时需要玩家输入（切场景时切换）。
- **[Slice 4.5 追加] 共享面板样式层**：面板数量从 3 个涨到 7 个后，每个面板各自写内联样式必然漂移（同一个"按钮"在两块面板长得不一样）。现在全部 DOM 面板共用 `src/ui/dom/panel-styles.ts`——单一幂等的 `<style>` 注入点 + 统一 `.game-panel` 类族（终端外观、右侧全高抽屉布局、条形/槽位/徽标组件）。**约束**：面板不得写自己的一套视觉基元；需要新组件时扩样式层，不在面板内联。视觉规范的真相在 `docs/design-notes/ui-art-overhaul.md` 与 `docs/art-direction.md` §6，样式层只是它们的实现。

### DEC-ARCH-006: LocalStorage 单存档

- **选择**：使用 LocalStorage 存储 JSON 格式的单存档
- **理由**：MVP 明确 out-of-scope 了多存档。LocalStorage 同步 API 简单可靠。单存档 JSON 预估 <100KB。
- **影响**：存档数据有 5-10MB 上限（因浏览器限制）；需要版本号做兼容迁移。
- **迁移路径**：如需多存档或数据量增大，升级为 IndexedDB。

### DEC-ARCH-007: 自实现 i18n 而非 i18next

- **选择**：自写 JSON 翻译文件 + TypeScript 类型推导，不使用 i18next
- **理由**：游戏文本总量有限（预估 <300 key），i18next 的插件体系、命名空间、后端加载等能力完全用不到。自实现方案零依赖、类型安全（key 拼写错误编译时报错）、代码量 <100 行。
- **影响**：不支持复数规则、日期格式化等高级 i18n 特性（本游戏不需要）。如未来语言超过 3 种或文本量爆炸，再考虑迁移。
- **设计规则**：
  - 默认语言：zh-CN（中文先行开发，英文后补）
  - locale 文件使用 TypeScript（非 JSON），享受类型检查
  - key 命名规范：`[domain].[context].[item]`，如 `hud.chaos.label`、`enemy.patrol.name`
  - 插值语法：`{variableName}`，运行时替换
  - 语言偏好存储在 localStorage（key: `coh_locale`）

### DEC-ARCH-008: 净化点为可行走空间（非纯 UI 界面）—— 核心功能决策

- **选择**：PurificationScene 是一个极小的俯视角可行走空间，复用共享移动/渲染管线，模块交互通过接近触发 DOM 面板
- **重要性（重要）**：这是本项目**核心的体验型功能决策，不是可选装饰**。它把"基地管理"从一张静态 UI 界面升级为可持续感知外部压迫的空间体验，直接支撑"孤独的仪式感""绝望边缘的紧绷"两根体验支柱。默认按本决策落地，不降级为纯 DOM/静态界面。
- **理由**：
  1. 复用渲染基础设施减少代码量（不需要为基地单独写一套 UI 系统）
  2. 可行走空间让"能看到外面的黑暗"成为持续的视觉体验而非静态背景图
  3. 接近触发 + DOM 面板 = 空间感（走向模块的过程）+ 操作效率（DOM 表单比 Canvas 交互好用）
  4. 边界外的动态黑暗内容强化"孤独的仪式感"体验支柱

- **共享移动/渲染管线的模块归属（消除"归属待定"）**：
  可复用的移动 / 视野 / tile 渲染**不属于任何单一场景**，抽为独立的"共享场景管线"模块，`RiftScene` 与 `PurificationScene` 均依赖它；各场景只保留自己独有的逻辑。归属如下：

  | 共享能力 | 归属模块（路径） | 说明 |
  | -------- | ---------------- | ---- |
  | 角色移动 | `src/entities/player.ts` | 同一 Player 实体实现，两场景共用输入 + Arcade 物理碰撞 |
  | 视野 / 光照 | `src/systems/visibility-system.ts` | 参数化复用（净化点内视野更大，主要用于边界外黑暗遮罩） |
  | Tile 渲染 | `src/systems/tilemap-renderer.ts`（新增共享模块） | 把 tile 数据渲染为 Phaser Tilemap；Rift 输入程序化数据、净化点输入手工静态数据。与 `src/generation/tilemap-builder.ts` 分工：builder 负责"生成数据→tile 数组"，renderer 负责"tile 数组→场景内可见图层" |

  场景独有逻辑（**不进共享管线**）：RiftScene 独有 AI / 混乱值 / 寻路 / 战斗；PurificationScene 独有 BoundaryAtmosphere / InteractionTrigger。

- **影响**：
  - 上述共享管线模块必须独立于任何场景实现（不能把移动/视野/tile 渲染硬编码在 RiftScene 内），否则 PurificationScene 无法复用
  - PurificationScene 地图是手工设计的静态小地图（非程序化）
  - 新增 BoundaryAtmosphere 系统（粒子+sprite 周期性渲染）
  - 新增 InteractionTrigger 系统（overlap 检测 + DOM 面板生命周期）
- **性能约束**：边界外渲染额外增加 30-50 粒子 + 最多 2 个 sprite，对帧率影响可忽略

### DEC-ARCH-019: 世界内交互点的外形分「地面贴花」与「立着的对象」两类挂法（裂隙入口，DEC-113）

- **决策：** 净化点的世界内交互点外形按**载体平面**分两类挂：
  - **地面贴花**（裂隙入口，`rift-entrance-visual.ts`）：像素画在地面平面内（与混凝土地面同一平面，顶视），Sprite 锚点取**中心**、depth **1**（地板0之上、动态实体[20,38)之下（DEC-120）），玩家可以踩过去。
  - **立着的对象**（核心 / 净化器 / 储藏 / **供奉台卡 I 环** / **培养藏卡 A 立缸**，前三台在 `purification-module.ts`，供奉台在 `offering-stand-visual.ts`，培养藏在 `growth-console-visual.ts`）：像素画成伪 3D（45° 等距），锚点取**脚底**，净化点按地面接触点动态排序（DEC-120）；默认depth20仅为创建初值。
- **理由：** 本作地面是顶视烘焙纹理，立着的对象是伪 3D 精灵——两者是两套投影。把地面上的东西按立着的相机画会被压成几乎看不见（裂隙入口那一版下俯 10° 就是这个问题）；把立着的东西按地面平面画会失去体积。载体平面选错，像素画得再好也不成立。
- **影响：** 新增世界内交互点外形时，先在身份锁里声明载体平面，再选锚点与 depth。`rift-entrance-visual.ts` 导出 `ENTRANCE_ORIGIN_Y = 0.5` 与 `ENTRANCE_DEPTH = 1` 作为地面贴花的基线。`offering-stand-visual.ts` 导出 `OFFERING_ORIGIN_Y = 26/32` 与 `OFFERING_DEPTH = 20` 作为立着供奉台的基线（DEC-115）。`growth-console-visual.ts` 导出 `GROWTH_ORIGIN_Y = 40/42` 与 `GROWTH_DEPTH = 20` 作为立着培养藏的基线（DEC-116）。Boot 预加载 `rift-e{4,5,7,8,9}-sheet.png` 与 `offering-i-sheet.png` 与 `growth-a-sheet.png`。画法纪律住 `.cursor/skills/pixel-models/SKILL.md`。

### DEC-ARCH-020: 培养藏卡 A 翻生产；加厚并进蜕变；安全区六点（DEC-116 / DEC-117）

- **选择：** 净化点西侧培养藏生产默认 = `growth-a-sheet.png`（40×42 × 8 帧）。加厚不再是世界交互点，并进蜕变面板第七张。边界安全区钳制改为六点（CORE / STORAGE / PURIFIER / 裂隙入口 / 防御点 / 改造祭坛）。
- **理由：** 人评卡 A「很好」并下令放入正式关卡。加厚是同一台培养藏上花薪柴抬上限，不需要场上第二根桩。
- **不改：** 加厚数值 / 存档 `moduleMaxHpTier` / 不进 `upgrades.csv` / 不吃折扣 / 不计稳定度 +3。对照课 `?lesson=growth-card` 留下，B/C 不删。
- **影响：** `growth-console-visual.ts` / `growth-panel.ts` / `purification-scene.ts` / `boot-scene.ts`。Boot 预加载 `growth-a-sheet.png`。DEC-116 / DEC-117。

### DEC-ARCH-009: 净化点边界的几何真相是曲面对象，不是 tile 网格

- **选择**：净化点边界由 `BoundaryShape`（极坐标压力 blob）定义；碰撞、可见性、地表 vignette、氛围粒子全部查询同一个形状对象。tile 网格降级为**仅供视野遮挡使用的不可见图层**。
- **理由**：边界要能被潮汐压缩、被方向性压力挤出不对称形态。tile 判定只能表达 32px 台阶状的圆，压缩时会出现可见的锯齿跳变，且"膜"这种 1-2px 的曲线结构无法落在 tile 边界上。把形状抽成可按角度查询的函数后，四个消费方自动保持一致——这是避免"碰撞边界和视觉边界差半格"这类经典 bug 的结构性手段。
- **影响**：
  - 碰撞：沿边界角度采样生成小静态体环（Arcade 只有 AABB，曲面墙只能用密排小体近似）
  - 可见性：`VisibilitySystem` 新增 `rayDistanceOverride` 注入点，净化点用 ray-blob 行进（步进 + 二分细化）替代网格 DDA；裂隙侧仍走 DDA。**这是 VisibilitySystem 唯一的场景差异化接口**
  - 形状每次进入净化点重算一次（潮汐状态变了），因此地表纹理必须同时失效重建
- **约束**：任何新增的"和边界有关"的表现或判定，必须查询 `BoundaryShape`，不得自己重算一个圆或读 tile。
- **风险**：静态体环的数量随边界周长增长；当前规模（约 180 个 8px 体）无性能问题，若净化点显著变大需改为逐帧动态生成玩家附近的碰撞段。

## 场景流转

```
BootScene (资源加载)
    ↓
MainMenuScene (标题/开始/继续)
    ↓
┌─────────────────────────────────────────────┐
│  核心循环                                    │
│                                             │
│  PurificationScene ←→ RiftScene             │
│  (基地管理/分配)      (裂隙探索/战斗)         │
│       ↑                    │                │
│       └── ImpactEvent ─────┘                │
│           (冲击结算后回到基地)                 │
└─────────────────────────────────────────────┘
```

- **RiftScene**：裂隙内的核心玩法（移动/潜行/战斗/搜刮/撤离）
- **PurificationScene**：净化点——极小可行走空间，复用俯视角渲染管线；玩家走近三个模块触发分配墙机，走近培养藏打开蜕变（含加厚）；边界外渲染黑暗+周期性模糊内容营造压迫氛围
- 两个场景共用同一套渲染基础设施（角色移动、视野系统、tile 渲染）
- 场景间通过 GameState 传递持久数据

## 核心系统交互图

```
┌─────────────┐     chaos:changed     ┌──────────┐
│ ChaosSystem │──────────────────────→│   HUD    │
└──────┬──────┘                       └──────────┘
       │ chaos:threshold                    ↑
       ↓                                    │ state updates
┌─────────────┐                       ┌──────────┐
│   Player    │←──player:damaged──────│  Combat  │
└──────┬──────┘                       └────┬─────┘
       │ position                          │
       ↓                                   │ enemy:damaged / enemy:killed
┌─────────────┐     enemy:alert      ┌────┴─────┐
│ Visibility  │──────────────────────→│    AI    │
└─────────────┘                       └────┬─────┘
                                           │ path request
                                           ↓
                                    ┌──────────────┐
                                    │ Pathfinding  │
                                    └──────────────┘
```

> 图中箭头是**数据流向**，不是调用关系。Combat → AI 的两条事件由 `RiftScene` 转译为 `reportDamage()` / `despawn()`；战斗的噪声（挥空也会发出，因此没有对应事件）走 `create()` 注入的 `CombatHooks.onNoise` 回调，同样由场景层转调 `AISystem.reportNoise()`。两个系统互不 import。

## 净化点场景技术方案 (PurificationScene)

### 设计概述

净化点不是纯 UI 界面，而是一个极小的可行走俯视角空间。玩家在其中移动，走到功能模块旁边触发 DOM 管理面板。关键氛围特性：能看到边界外的黑暗，黑暗中有隐晦的周期性内容暗示外部污染的存在。

### 空间规格

- **尺寸**：约 12x10 tile（几步路的范围）
- **内容**：
  - 玩家角色（可移动）
  - 三个功能模块实体（CORE 中心 / STORAGE 右 / PURIFIER 下，可交互，三态灯）
  - 供奉台（西南，卡 I 环；按 E 开防御槽）
  - 培养藏（中心左 3.5 tile，卡 A 立缸；按 E 开蜕变，加厚在面板内）
  - 裂隙入口（出击入口点）
  - 边界墙/栏杆（标记安全区域边缘）
- **边界外**：黑暗区域延伸到屏幕边缘（不是黑幕遮挡，是有内容的黑暗）

### 渲染管线复用

PurificationScene 复用 RiftScene 的以下基础设施：
- **角色移动**：同一个 Player 实体，相同的输入处理和物理碰撞
- **视野系统**：复用 VisibilitySystem，但参数不同（净化点内视野范围更大/全域，主要用于边界外的黑暗遮罩）
- **Tile 渲染**：静态小地图（手动设计，非程序化生成）
- **相机**：跟随玩家，但空间太小几乎不需要滚动

不复用的部分：AI 系统、混乱值、寻路、战斗（净化点内无敌人无威胁）。

### 动态力场边界（Slice 4.5 新增，取代静态圆形安全区）

Slice 4.5 前，净化点的边界是"tile 判定出的固定圆 + 边界外粒子"。现在**边界几何是一个独立的、被多方共用的形状对象**（`BoundaryShape`），世界模型是"被外界污染压力不均匀挤压的残余力场气泡"。

- **形状**：极坐标椭圆 × 潮汐强度缩放 × 两个高斯方向压力叶 × 交互点安全钳制（保证气泡永不挤破任何交互点）。压力方向按周期确定性生成，潮汐相位（crest / ebb）调制振幅。
- **生命周期**：每次 `PurificationScene.create()` 构建一次，之后是无状态查询对象（`radiusAt` / `normalizedDist` / `isInside`）。**不逐帧变形**——观感上的"呼吸"由独立的视觉层负责。
- **六个消费方**（这是本块最容易再次漂移的地方，改动 BoundaryShape 必须同步检查）：
  1. **tilemap 构建**：tile 中心在 98% 半径内即 FLOOR。该图层 `setVisible(false)`，**只作为视野遮挡网格存在**
  2. **程序化地表纹理**：用边界梯度带（inner / membrane / outer）画 vignette，软过渡替代硬墙
  3. **平滑 blob 碰撞体**：沿 98% 半径角度采样生成小静态体环，替代 tile 碰撞（曲面边界无法用 tile AABB 表达）
  4. **可见性**：`VisibilitySystem` 的 `rayDistanceOverride` 做 ray-blob 行进 + 二分细化，**替代 tile DDA**（见 DEC-ARCH-009）
  5. **BoundaryAtmosphere**：粒子/apparition 的生成与消亡半径跟随 blob
  6. **BoundaryBreath**：纯视觉叠加层——并发的局部短弧向内扫入 + 虚空侵入楔形 + 膜线内凹变形。视觉权重刻意压到背景级，无 gameplay 影响
- **设计权威**：规则与数值住在 `docs/specs/system-purification-impact.md`（边界规则组），不在本文档。

### 边界外黑暗氛围系统（Boundary Atmosphere）

这是净化点的核心氛围系统，目的是让玩家视觉上持续感受到"外面有东西在压迫"。

> **[Slice 4.5 更新]** 下文的"方案 A+B 混合（粒子 + 半透明 Sprite）"仍然成立，但它现在是**边界的氛围层，不是边界本身**：形状由 `BoundaryShape` 定义，粒子半径跟随该形状；地面到虚空的过渡由程序化地表的 vignette 承担，不再是"半透明黑雾层 + 硬墙"。原文中"圆形安全区""黑色底层 + 黑雾层"的描述按此理解。

**技术实现方案：**

```
渲染层级（从底到顶）：
1. 黑色底层（纯黑背景）
2. 模糊内容层（边界外的动态内容）
3. 半透明黑雾层（降低模糊内容的可见度，保持"隐晦"感）
4. 净化点地面/墙体（正常渲染）
5. 边界发光线（标记安全区边缘的微弱光线）
6. 实体层（玩家/模块/交互物）
7. HUD 层
```

**模糊内容层的实现：**

| 方案 | 实现 | 优势 | 适用场景 |
| ---- | ---- | ---- | -------- |
| A: 粒子系统 | Phaser ParticleEmitter，大颗粒、低 alpha、缓慢漂移 | 性能好、自然随机、Phaser 原生支持 | 通用"漂浮感" |
| B: 半透明 Sprite | 预制的模糊形状 sprite，周期性淡入/淡出/移动 | 可控性强、可设计具体形态 | 需要辨认出"类似形态"的暗示 |
| C: Shader（RenderTexture） | 自定义 fragment shader 做噪声扰动 | 最有机、最无缝 | 全屏均匀效果 |

**选择：A + B 混合**
- **底层**：粒子系统产出持续的微弱飘动（A）— 随机、低成本、有"活物"感
- **事件层**：少量半透明 Sprite 做周期性"浮现"（B）— 可控节奏、可设计具体形态暗示

**周期性行为设计：**
- 粒子持续存在（背景噪声），参数微调产生呼吸感（alpha 0.05-0.15 区间缓动）
- 每 8-15 秒（随机间隔），一个较大的模糊形态在边界外某处缓慢浮现 → 停留 2-3 秒 → 消散
- 浮现位置在边界不同方向轮换（不总是同一个地方）
- 冲击临近时频率加快、alpha 增强（与 GameState 的 impactIntensity 挂钩）

**性能约束：**
- 粒子数量上限：30-50 个（大颗粒、低频发射）
- Sprite 浮现同时最多 2 个
- 所有边界外内容在屏幕外不渲染（Phaser 自动裁剪）
- 不使用实时 blur shader（用预模糊的 sprite 资产代替）

### 模块交互机制

- 每个功能模块是一个带碰撞体的 Sprite（有视觉状态：健康/受损/严重受损）
- 玩家进入模块周围的触发区（overlap zone，约 1.5 tile 半径）时：
  1. 显示交互提示（"按 E 管理"）
  2. 按下交互键 → 激活 DOM overlay 管理面板
  3. DOM 面板打开时：游戏暂停输入（玩家不能移动），Canvas 层加暗色 overlay
  4. 面板关闭时：恢复游戏输入
- 裂隙入口的交互逻辑相同，但触发的是"出击确认"面板

### 新增系统注册

| 模块 | 路径 | 职责 |
| ---- | ---- | ---- |
| BoundaryShape | src/systems/boundary-shape.ts | 边界几何唯一真相（潮汐驱动的压力 blob） |
| BoundaryBreath | src/systems/boundary-breath.ts | 边界局部压力冲击与膜变形（纯视觉） |
| BoundaryAtmosphere | src/systems/boundary-atmosphere.ts | 净化点边界外的黑暗+模糊内容周期性渲染 |
| ProceduralPurificationSurface | src/systems/procedural-purification-surface.ts | 净化点地表逐像素生成 + 边界 vignette |
| InteractionTrigger | src/systems/interaction-trigger.ts | 接近触发交互（overlap 检测 + 提示 + 面板激活） |

## 性能约束

| 指标 | 目标 | 检测方式 |
| ---- | ---- | -------- |
| FPS | 稳定 60（最低不低于 30） | Chrome DevTools Performance |
| 首屏加载 | < 3 秒 | Lighthouse / Network tab |
| 资产总大小 | < 10MB（首屏 < 2MB） | `npm run build` 后检查 dist/ |
| 内存泄漏 | 无（长时间运行无持续增长） | DevTools Memory timeline |
| Raycasting | < 2ms/帧（60 条光线内） | Performance.now() profiling |
| Pathfinding | < 5ms/次（单实体） | 定时器监控 |

### 性能规则

- **游戏循环禁止**：new Object / 数组字面量 / 字符串拼接（预分配所有临时变量）
- **对象池**：子弹、粒子、伤害数字、音效实例全部池化
- **Raycasting 优化**：玩家静止时缓存结果；降级策略（30fps 时减少光线数）
- **AI 分帧**：N 个敌人的寻路分散到 N 帧执行（每帧最多 1 次 A*）
- **Tilemap**：依赖 Phaser 内置视锥裁剪（Culling），不渲染屏幕外 tile

## 技术风险

| 风险 | 影响 | 概率 | 缓解策略 |
| ---- | ---- | ---- | -------- |
| 视野 raycasting 性能不足 | 帧率下降 | 中 | 光线数量限制（30-60）、静止缓存、WebGL shader 备选方案 |
| CA 地图不连通 | 无法通行 | 中 | Flood fill 验证 + 自动打通最大连通区域；碎片内重试上限 3 次 |
| Voronoi 碎片大小不均 | 体验不一致 | 低 | 约束最小/最大面积；Lloyd 松弛迭代平衡 |
| 多敌人寻路卡顿 | 帧率下降 | 低 | 分帧计算；路径缓存；远距离敌人用简化寻路 |
| Phaser 内存泄漏（场景切换） | 长时间运行崩溃 | 低 | 严格场景 shutdown 清理；定期检测 |
| 浏览器 LocalStorage 空间不足 | 存档丢失 | 极低 | 存档压缩；数据精简；错误提示 |
| 移动端音频 Autoplay 限制 | 无声 | 中 | 首次交互 unlock；静默播放检测 |

## 开发命令

- 启动开发：`npm run dev`
- 构建生产：`npm run build`
- 类型检查：`npm run typecheck`
- 预览构建：`npm run preview`
- 污染对比度 / 青绿 / 烤图身份指纹：`npm run check:contam-floor-contrast`
- 色板副本漂移：`npm run check:palette-quantize`
- 搜刮堆 vs 地面对比度（DEC-110）：`npm run check:loot-pile-contrast`

## 资产加载策略

- **Boot 阶段**：加载 loading bar 所需最小资源；并预加载净化点模块贴图（DEC-ARCH-018：`assets/sprites/modules/core-v6-{a,b,c}.png` + `purifier-b1-sheet.png` + `storage-c1-sheet.png`）与裂隙入口贴花（DEC-ARCH-019：`rift-e{4,5,7,8,9}-sheet.png`）与供奉台（DEC-115：`offering-i-sheet.png`）与培养藏（DEC-116：`growth-a-sheet.png`）
- **Preload 阶段**：按场景按需加载（Rift 资源 / Purification 资源分开）。模块贴图因体积小、场景必用，放在 Boot 而不是 PurificationScene 内再拉
- **格式要求**：
  - 图片：PNG（像素风，不需 WebP 压缩）
  - Spritesheet：模块图集按实体画布（净化器 32×44 × 8 帧）；角色 / 敌人仍是程序像素，不走本目录
  - 音频：MP3 + OGG 双格式（覆盖所有浏览器）
  - 字体：交互面板正文/标题同用系统中文无衬线，数字等宽；主菜单及低语沿用R2字体；不再加载COH Pixel或等待该字体文件。

## 音频技术规范

- **API**：Phaser 内置 Sound Manager（基于 WebAudio，fallback HTML5 Audio）。场景与系统不直打 `game.sound.pauseAll` / `resumeAll`。
- **加载**：BootScene 预加载全部 43 个 key 的 `.ogg` + `.mp3`（`/assets/audio/{bgm,ambient,sfx/...}/`）。Vite 从 `public/assets/audio/` 提供。
- **控制**：`AudioManager`（`src/managers/audio-manager.ts`）封装 playBGM / stopBGM / playSFX / playAmbient / stopAmbient / setLayerVolume / playSpatialSFX / pauseAll / resumeAll / unlock。分组常量 Master 1.0 / BGM 0.6 / Ambient 0.5 / SFX 0.8（本 Slice 无面板、不进存档）。
- **格式**：每个 key 非空 OGG + MP3（浏览器择一）。禁止运行时 OscillatorNode 冒充交付。
- **限制**：同时播放上限 8 轨。溢出踢最早/最低优先级的 game SFX；UI（`sfx-ui-*`）与循环床不可被踢。
- **首次交互解锁**：BootScene 绑定 pointerdown/keydown/touchstart；MainMenuScene 再绑一次（已解锁则空操作）。

## 存档数据结构（概要）

```typescript
interface SaveData {
  version: number;               // 存档版本号（向前兼容用）
  timestamp: number;             // 保存时间戳
  cycle: number;                 // 当前循环数（第 N 次出击）
  purificationPoint: {
    modules: ModuleState[];      // 各模块状态
    kindlingReserve: number;     // 薪柴储备
  };
  player: {
    health: number;
    inventory: ItemSlot[];
  };
  meta: {
    impactIntensity: number;     // 当前冲击基础强度
    totalKindlingEarned: number; // 累计获取薪柴（统计用）
  };
}
```

注意：裂隙内的状态（地图/敌人/混乱值）不存档。死亡或撤离后裂隙数据丢弃。只持久化净化点状态。

## 国际化 (i18n) 技术规范

### 支持语言

| 代码 | 语言 | 状态 |
| ---- | ---- | ---- |
| zh-CN | 简体中文 | 默认（先行开发） |
| en | English | 后续补充 |

### 架构设计

```typescript
// 使用方式（Phaser 场景 / DOM UI 中均可调用）
import { t, setLocale, getLocale } from '@/i18n';

// 简单文本
const label = t('hud.chaos.label');  // "混乱值" or "Chaos"

// 带插值
const msg = t('hud.chaos.value', { current: 45, max: 100 });  // "45 / 100"

// 切换语言
setLocale('en');
```

### Key 命名规范

```
[domain].[context].[item]

域名(domain):
  hud       — 游戏内 HUD 文本
  menu      — 菜单/标题界面
  rift      — 裂隙内提示
  purify    — 净化点界面
  item      — 物品名称/描述
  enemy     — 敌人名称/描述
  impact    — 冲击相关
  common    — 通用（确认/取消/返回等）

示例:
  hud.chaos.label        → "混乱值"
  hud.health.label       → "状态"
  menu.title             → "COH"
  menu.newGame           → "新远征"
  menu.continue          → "继续"
  rift.exitHint          → "撤离点已标记"
  purify.allocate.title  → "薪柴分配"
  item.distorter.name    → "干扰发生器"
  item.distorter.desc    → "释放异源干扰波。短暂致盲周围污染体。"
  enemy.patrolInfiltrate.name → "巡视渗透体"
  impact.warning         → "边界压力上升"
```

### 文本风格约束

所有翻译文本必须遵守 `world.md` 中定义的叙事语调规则：
- 冷峻克制、陈述事实、不渲染情绪
- 无人称或旁白体
- tooltip/简述不超过 15 字
- 详细描述不超过 40 字
- 禁止诗意化措辞、感叹号、修辞性疑问

### 语言切换机制

- 语言偏好存储在 `localStorage` (key: `coh_locale`)
- 首次加载：检测 `navigator.language`，匹配则用，否则 fallback 到 zh-CN
- 切换语言后需要刷新当前场景的所有文本（通过事件通知各 UI 组件更新）
- 切换入口：主菜单设置选项（MVP 可简化为 MainMenuScene 上的语言按钮）

### 性能注意

- locale 文件在 BootScene 时全量加载（文本数据量极小，<50KB）
- `t()` 函数是纯同步查找（对象属性访问），不涉及异步/IO
- 游戏循环中可安全调用 `t()`（无 GC 压力，返回已存在的字符串引用）
- 带插值的调用会创建新字符串——HUD 中频繁更新的数值文本应缓存结果，仅在值变化时重新调用


### 迭代11 R4核心样板接线

`PurificationScene`负责核心聚焦/恢复镜头与真实投影；`openCoreAllocationSample()`供开发页调用生产路径，`cancelCoreAllocationSample()`在开发切屏时即时取消。`PurificationModuleEntity.setInteractionReadoutActive()`仅在核心交互期隐藏世界HP条，退出恢复。核心确认用既有柔光纹理响应。`panel-styles.ts`只增加core-allocation作用域，不改已锁HUD。`ui-review.html?sample=core`为内存示例直达入口。


### 迭代11 R5：六点场景交互

`WorldInteractionContext` / `bindWorldInteraction` 位于 `src/ui/dom/world-interaction.ts`，只提供实际相机投影、面板局部class、独立实体名节点及rAF清理；列表重建不会移除实体名。三个分配复用实体读数；defense/growth的open可选第二参数context，loadout的open可选第三参数context。无context的旧调用仍兼容。

`PurificationScene.openWorldInteraction(target)`是六点开发入口，也调用正式E路径。焦点状态持有world point和可选Module，退出守卫共用；`cancelWorldInteraction()`支持开发切屏。scene shutdown时相机已经销毁，丢弃快照而非setScroll。入口确认沿用原出击回调，不先恢复镜头；转场归scene Clock，shutdown取消计时器与过渡DOM。

`ui-review.html?sample=world`自动内存示例，支持六点切换/重置/零库存；普通开发页另有长库存。开发页运行时异常以可见文本显示，不向正式构建添加调试入口。

### 迭代11 R6：场景菜单

`panel-styles.ts`以`.scene-menu`和`.scene-menu-backdrop`为报告、暂停/覆盖确认、撤离/阵亡及冲击结算提供无框排字与全屏渐隐暗场，均挂既有`#dom-ui-root`。各菜单添加专属定位类，无新增相机聚焦、数值或系统API。结果正文滚动、底部动作固定。失焦遮蔽在`main.ts`复用同一暗场；主菜单只统一字体。暂停悬停改为pointermove且仅选项变化才刷新，避免pointerover与DOM重建互相触发。

开发审查页增加`?record=saved`内存摘要，供暂停覆盖确认和主菜单继续态审查；所有save/load/delete仍隔离，正式构建不包含该页面。

### 迭代14验收入口

`ui-review.html?sample=entry` 增加新档、继续、坏档内存夹具与生产键盘启动、逐帧可见DOM报告、输入压力、暂停/恢复和中止重入。`motion=off` 仅在该开发文档模拟减少动态。记录音轨实例ID/实际音量、场景/罩/HUD/镜头、角色位置与save调用次数；不读取正式存档，也不注册生产菜单选项。证据与边界见 `docs/qa/iteration-14.md`。


### 迭代16接线补充（DEC-124）

`attachJiaGenomeD`在虫分支委派`attachInsectVisual`；离线`bakeJiaGenome`同一虫分支委派`bakeInsectModel`。其他家族保持原渲染器。`FormVisual`可提供当前形体闪白源，`CombatSystem`同步复制到自有池纹理以跨越实体销毁。`RiftScene`将真实攻击时钟写入可选`FormVisualPose.attack`；练习场没有战斗时钟时使用预览信号。

出击组合通过`supportsRuntimeForm`能力筛选，`floorMotionFor`统一固着/转面/巡游规则；完整字母表仍由CSV生成、陈列馆保留，生产池只抽有行为消费的部分。旧虫构件、帧数、色板与审美闸门属于历史实现，不约束迭代16新样板（用户FATAL）；此处仅记录技术路由，不将旧审美经验传播进新设计。

R2 DEV对照：`FormVisual.setReviewCoverage`为可选接口，仅虫实现且DEV守卫；`RiftScene.probeReviewCoverage`转发给当前visual。暂停刷新复用最后pose并传deltaMs=0，覆盖档进入帧缓存键；正式渲染默认仍读form.coverage，未新增纹理或机制状态。

### 迭代17接线（DEC-125）

新增CSV基底human_remnant，不复用organic_remnant身份。`attachJiaGenomeD`与`bakeJiaGenome`在人形分支直接转独立模型，与虫相同的战斗输入协议，但造型实现相互独立。GenomeCanvas支持64宽；HumanVisual使用64×64纹理、(32,42)原点、960ms步行周期。覆盖预览只改外观输入；真实CombatSystem保持伤害/射程/350+80+240ms阶段。池按源尺寸复制，64像素人形可沿用当前轮廓死亡反馈。

I17人形脚底以上高度增大，Enemy的状态点在人形方案D显示时提升至脚底y−44，避免原y−22/24的点落到胸部；状态含义、颜色与时序不变，其他模型偏移保持。


### 迭代18 R3生产合同（DEC-126，取代上文I3–I17与I18首版临时分支说明）

生成层读取五份 CSV：`contamination-families`（家族可实现能力）、`contamination-dialects`（地图权重与禁止）、`contamination-encounters`（听觉职责分配）、`contamination-behavior-profiles`（节律/感官时钟）、`contamination-body-profiles`（身体运动与攻击）。codegen 输出 family/capability/body 三份 typed data。抽样前执行交集过滤，成句不得绕过条件。R4全场恰好一个听觉职责，仅在占地；空间钉点、出生、朝向、路径和配额保持原合同。

`production-models.ts` 注册六个正式占地家族。虫、人各1主形；兽、蠕虫、有机残影、残茎各3主形，共14主形、三档42配置。门框在R3曾仅wall/anchor，R4连同墙锈整体退gym；街具仍gym，二者不再注册地面生产模型。`genome/attach` 和 `genome/bake` 均委派同一注册表，历史骨架只保留未注册gym底材的回退。`gym-attach` 直接沿用所选正式渲染器的分发，菌毯/油膜/灰幕全部共用paint-genome并有独立材质，练习场、检视室与出击不另选一套皮。

`model-animation` 以真实位移驱动步态，以 Combat 的 phase/progress/facingAngle 驱动攻击。`model-visual` 每体一张动态纹理（虫48×48，其余64×64），最多64个CPU帧，隐藏时不烤图或上传；销毁移除缓存与纹理。可选 `activity` 驱动休止、醒转、活动姿态；首次按当前状态初始化，后续240ms平滑过渡；收势接静止零相位。模型不改位置、碰撞或判伤。

AI 的 `activity-state` 在既有五态前设节律门，`contact-separation` 对包括同心/静止在内的身体做地形合法分离。Combat 从身体profile统一读取速度以外的攻击字段，真实扇区、预告与动画使用同一个时钟。Host 与 AI 共用格子LOS；新增墙窄视、墙听觉、反视体积，且经 `hearingPolicy` 共用消声倍率和扣次入口。墙预告直接读危险格与350ms实际预备，体积形体与透明度读真实活动门状态；余响/散光/间距已各有结构，不再生产同云换色。体积材质烤图限20Hz，位置与活动透明度仍逐帧更新。

`pollution-review.html` 仍只使用真实 RiftScene，隔离正式存档。可选占地或环境宿主，显示生成词素、真实activity/velocity/attack、帧率与纹理数，采集12秒轨迹，重进/伤害/死亡使用生产路径。覆盖下拉仅改变模型对照外观，不伪造机制或生成统计。页面不进入正式构建。


I18接地点排序：Rift/Gym复用`GroundDepthSorter`，通过可选`FormVisual.setGroundDepth`排列玩家与正式占地身体；POST_UPDATE读取真实接地点，生成、死亡与换模型重建列表。同Y按身份稳定排序。侦测标记与战斗闪白40、迷雾50保持独立，墙/漆/体积不参与身体排序；净化点实现未改。


I18物理收口：`AISystem`注册Arcade `worldstep`，累积实际物理时间后测量已完成位移；无物理步的渲染帧保留最近实际速度，避免120Hz画面/60Hz物理交替walk/idle。销毁移除监听。R3没有生产静态底座；门框仅Host，街具仅gym。`moveScale=0`底座碰撞及街具20×20历史body保留为gym回归，不代表退休角色仍上线；移动敌人保留原站距逻辑。`generation/static-body-access.ts` 以完整玩家体积和4px导航检查出口/拾取可达性，零静态快路；阻塞时原槽预先排除静态候选重抽，保留其他职责与几何，仍无解拒绝布局。新增验证`check:physics-runtime`与`check:static-body-access`。


### I18 敌人检视室：替代污染体练习场

`enemy-inspector.html` → `src/gym/enemy-inspector.ts`（开发DOM目录与模式控制）→ `EnemyInspectorPreview` / `EnemyInspectorArena`。模块分别住 `enemy-inspector-catalog.ts`、`enemy-inspector-preview.ts`、`enemy-inspector-arena.ts`，以及R3同场景校准`enemy-inspector-context.ts`。目录消费生成后的家族能力表及生产主形函数；预览消费生产 bake/renderer；实战消费生产 AI/Combat/Hosts，控制台样本不创建存档流程。两种模式传递同一 form/seed，退出销毁场景资源。旧 `?lesson=lexicon` 重定向且 GymLexiconScene 不再注册；其地图/表单 helpers 保持复用。其他 gym 课与真实 RiftScene 验收页不变。独立检视入口随 gym 构建，不挂正式主菜单。说明与验收入口见 docs/dev/gym.md。


### I18 R3 新模块与跨层合同

- `src/entities/form-renderers/d/body-pixel-material.ts`：六生物baker共享有限材质阶、部件坐标上的折痕与选择性像素内缘；解剖与动作仍由各家族拥有。不上移到屏幕空间，不修改碰撞/脚底或判伤。
- `src/entities/form-renderers/d/environment-pixels.ts`：墙、漆、空共享像素簇工具、材质墨色和真实activity读取。环境主体各自定义结构；不依赖旧云模板换色。
- `src/entities/form-renderers/d/paint-genome/material.ts`：菌毯/油膜/灰幕的材质与内部动作。`bake.field`仍是唯一表面足迹源；`bing.ts`代理`attachBingPaintGenome`，三个基底全部提供`stepFloors`。
- `src/generation/wall-host-placement.ts`（R4仅历史兼容）：纯`doorwayWallSeats(edges,grid)`返回建筑合法墙面座位与朝向地板。历史抽样将其存在性传入`hasWallOpenings`；Host复用同一选择。R4正式抽样无墙权重或合法墙基底，不走门框/墙锈fallback。
- `src/gym/enemy-inspector-context.ts`：`EnemyInspectorContext`使用`generateRiftLayout`真实地图及`RiftSurfacePainter`地面，摆放六个生产地面家族、所选环境宿主和生产Player做尺度/材质同场景比较。属于视觉校准，不伪称AI实战；实战仍由`EnemyInspectorArena`承担。场景按实际地图设物理world bounds，shutdown释放所有visual、Player、Host及surface。

`FormAttachContext.isWalkableFloor?(col,row)`由RiftScene、EnemyInspectorArena、EnemyInspectorContext显式传入，renderer按其裁切像素、危险沉积和`stepFloors`。Host独立使用`isWalkable`优先、`!isOpaque`兜底并拒绝越界；无网格的历史外部调用保留兼容。过滤后没有合法表面时禁用Host并清核，不发玩家击杀事件；核座位只能来自过滤后的footprint。菌落核按确定性完整二点/三点搜索选座，先争取Chebyshev间距≥3格，再退≥2格；裁切后的紧凑patch若确实放不下，允许最后使用两个不同的相邻合法格（≥1格，即32px），仍保持独立核心、命中和计费，不降成单核或重叠同格。若仅余1合法格则禁用部署；128正式种子审计必须证明没有此类配额蒸发。实现由`colonyNucleusSeatsInFloors`完整搜索小型footprint二点/三点组合，避免旧贪心起点漏解；先按坐标排序确保输入枚举顺序不影响结果。

`getVisualPin(bing)`固定返回`host.pin.cx/cy`。`relocateBingColonyNuclei`更新可打核心位置而不移动地表锚；RiftScene与检视室两个场景的cluster pose取visual pin，renderer沿固定ctx.pin做世界地形裁切与登记。`host.core`不能再次用于整张漆面原点，否则核重座会令图像和危险格错位。

Host `setStepFloors(id,floors)`与`isPaintFloorActive(id,col,row)`组成表面合同：已登记空表面禁用该Host且无危险；菌落使用表面与活核范围交集；无核场使用完整登记面。材质层消费同一活跃格判定，死核释放区衰暗。清空、purge、重建释放登记；practice不继承旧地图可走格缓存。墙动画读取`getAttackVisualState/getActivityVisualState/getStrikeFloors`，丁读取实时pin AABB与活动门，视觉不自行决定危险时刻。

R3历史范围为14生产基底（6占地/2墙/3漆/3空），当时128种子证据为232个去别名形态行为组合、47行为键、570候选/492职责可分配；R4现值见页首。不是物种计数，也不代替美术终审。旧模块表中的I5上线记录、历史抽卡厅和已锁定描述仅表示当时状态，若与当前范围冲突均已由R4取代。


R3附墙可见投影补充（R4仅历史兼容）：门框/墙锈主体沿真实面法线向地侧投影10px（渲染仍在迷雾之下），核保持原seam 0–2px、危险格不动。真实单帧strike触发140ms纯表现收势，后续windup即时显示，不延长伤害或延后预告；四向外伸限制在相邻32px格内。


### I19 正式武器与库存接线（DEC-138）

`data/weapons.csv`、`weapon-qualities.csv`、`weapon-attack-profiles.csv`、`weapon-loot.csv`、`weapon-first-discovery.csv` 经 codegen 生成 weapon-data；survival-attributes.csv 生成 survival-data。草案表不作为运行时源。

`weapon-swing.ts`拥有每次挥击抽样、时间窗口与共享目标预算，Combat统合身体及Host登记的核；Host不再独立轮询武器有效帧。`player-weapon-rig.ts`读取同一攻击姿态，脚底固定，拆分上身/双臂与32px武器握点。`crowbar-pixels.ts`共用于持握、地面物，PNG图标由同源导出。

`inventory-store.ts`是唯一实例/归属/装备/出击账本所有者；`inventory-presenter.ts`与DOM视图共享于报告物件页、入口备行及裂隙Tab拾获（B已由DEC-142下线）。`field-loot-inventory.ts`提交揭晓/取得/交换/落地，`weapon-loot.ts`使用独立确定性随机流。`survival-attributes.ts`从已提交库存派生抗性及负重速度，场景订阅后更新玩家、Chaos及HUD；预览不更改运行时属性。

出发先保存beginRun，再转换场景；RunController先保存死亡/撤离settleRun，结果只读实际returnedIds。基地收益/冲击/潮汐/baseSettled通过SaveManager.commitWorldTransaction保存一次；失败保留会话结果并锁下一次出发，重试只写快照。开发ui-review的此事务也隔离真实存档。

未完成出击的刷新/退出政策尚未确定；当前session阻止active账本载入基地，保留原记录并说明无法继续。该保护不是裂隙快照恢复。


### I19 战斗试验场（DEC-140）

`combat-lab.html` → `src/gym/combat-lab.ts` / `combat-lab.css` → `CombatLabScene`（`combat-lab-scene.ts`）。`combat-lab-types.ts`声明配置及观察状态；`combat-lab-runtime-ground.ts`将受控场地适配到生产`RiftSurfacePainter`。逻辑画布960×640；独立开发入口纳入Vite多页构建，敌人检视室提供跳转，不挂正式主菜单。

武器/工具消费生成表，敌人消费检视室共享的合法家族与形态目录；运行时直接复用Player、CombatSystem、AISystem、Host、ToolSystem、ChaosSystem、生产模型和深度排序。场地是固定试验几何；不模拟完整迷雾、搜寻或出击结算。所有攻击及受伤走真实系统，免伤选项默认关闭。

入口加载完生产依赖后及场景初始化时显式`inventoryStore.setPersistence(null)`，训练实例仅在本页内存重建，不加载或写入正式存档。配置修改重开并暂停，点击场地恢复；清场/倒地可自动续场，R手动重开。结束回合关闭伤害与移动但继续消退战斗表现，shutdown释放纹理、实体和监听。

`tools/inventory/check-combat-lab.mjs`在独立浏览器上下文验证真实输入、伤害、消费、配置和生命周期，并以存档哨兵检查保存隔离；执行结果见`docs/qa/iteration-19-combat-lab.md`。


### I19 首次体验反馈（DEC-141）

`entities/hit-reaction.ts`拥有按subjectId订阅的纯表现冲量与220ms回弹曲线；`d/model-visual.ts`在原动作/材质之上应用变换，销毁时注销监听。Combat通过真实命中入口触发，固定8槽Graphics池承担身体/核心局部接触与碎屑，结束/重置/销毁清理。场景无需另接一套受击模型；物理、AI时序、攻击规则均由原系统持有。

`PlayerWeaponRig`以0.68倍率围绕原握点显示32px武器图，原动作时钟保持。W8的独立B随身入口已由DEC-142替换为净化点Tab报告与裂隙Tab拾获，当前接线见本文迭代19统一物件节；W8身体与核心受击反应继续有效。


## 迭代20 A 模块登记（DEC-143）

- `src/systems/enemy-control-state.ts`：敌人拥有的来源隔离控制值，AI写入与投影，Combat只读攻击资格；真实正伤害经窄接口通知解除可打破来源，不直接写FSM。
- `src/systems/tool-targeting.ts`：纯函数最近可见目标选择与单格实墙连续swept-AABB安全落点，供正式Rift与战斗试验场共用。
- `src/systems/environment-hazard-control.ts`：Host拥有的来源计时与恢复预兆状态，无伤害/库存权限。Host公开活动污染源压制及未释放危险推迟；两件正式异物已接消费。压制资格包括各自然相位，排除恢复等待/已压制/仍暂缓的源，查询与执行共用校验。
- `ToolSystem`拥有区域实例source、听觉遭遇与已回收节点记录；场景注入可见性、共享LOS、存活查询与安全位移。定向目标不再无条件遍历全图命中。
- `volume-presence` / `dust-flow`拆分phaseElapsedMs（危险预兆/释放）与elapsedMs（流动），保持模型与真实危区共用同一相位。

架构边界的窄补充：Combat可以在正伤害接受后通知AI解除damage-breakable控制，其余reportDamage/noise/despawn仍通过场景层。控制与背包持久化失败不应先改世界。

### 迭代20 B：首8异物样板

- `contaminant-qualities.csv` → `contaminant-quality-data.ts` → `contaminant-quality.ts`：四品质、次数、掉落与旧实例只读投影。InventoryStore仍是实例唯一所有者。
- ToolSystem通过场景注入视觉诱饵、声音投掷落点/声源、Host危险查询/压制/清理；RiftScene与CombatLabScene用同一条接线。`findSoundLureLanding`用连续射线阻止墙/VOID穿透。
- AISystem区分玩家、视觉诱饵和声音调查来源；ChaosSystem由场景提供归属查询，屏缘被发现提示过滤诱饵事件。Host声音接口不等价于声音诱饵，未混接。
- `contaminant-icons.ts`共享身份几何生成24px图标/32px世界硬像素，field-loot、库存、供奉与备行传实例quality；combat-lab增加四品质选择和所选物件图标/完整用途。
- A/B阶段首8替换定义；后续C/D已完成13族全量目录（见下节），不改变武器耐久/死亡全丢/开包不停。

### 迭代20 C/D/E：全量接线与经济迁移

- `contaminants.csv.active`生成ACTIVE_CONTAMINANT_TYPES / DATA，唯一生产13族清单；旧5族数据只供解析。检视/试验菜单和正式掉落均用生产清单。
- `contaminant-migrations.csv`、`contaminant-loot.csv`→`contaminant-economy-data.ts`。`contaminant-migration.ts`在InventoryStore载入、导入、加入和揭晓边界正规化实例，保留ID引用，不操作保存账本的退出政策。
- Rift生成节点携带风险tier，LootSearch用runSeed+节点ID稳定抽取族/品质；揭晓仍为InventoryStore事务，取丢/重试不重抽。
- ToolSystem接Host下一次释放延迟、实际伤害后的短时抗性、结线穿越停步、区域纯移动减速和可达位置快照；RiftScene与CombatLabScene提供相同生产适配，minimap只持有快照读数。旧归并重复被动累加可消费余次，实际提交仍按实例。
- GameState持有一次性repairBonusHp；SaveManager.allocateToModule将真实修复与扣薪柴/额度一同保存，失败全部回滚。ImpactSystem只在实际供奉冲击后挣得下一轮真实预告，保留旧已承诺记录。
- DefenseEngine输出13族防御反应，转移守恒/不击毁接收装置；逐槽整数挡下对齐模块最终伤害，转移单列，冲击后修复单列。
- 完整验证索引见`docs/qa/iteration-20-final.md`；独立审查`iteration-20-final-audit.md`。世界效果和用户体验的最终批准仍由用户作出。


### 迭代20：敌人承受技能反馈与描述性名称

`ToolSystem.getEnemyRestraintPose`只读聚合实际仍生效的压力/结线来源。RiftScene与CombatLabScene将投影传给同一个`attachAnimatedModel`；`RestraintReaction`只负责身体入效顿挫、持续沉降和退出回稳，与HP、物理、感知和攻击时钟无写耦合，真实HitReaction独立叠加。六类生产地面基底共用此入口，迷雾可见性仍由场景提供。

物件显示名由`data/contaminants.csv`生成，供奉态/工具态同名，内部ID、品质、实例余次与迁移不变。正文和界面使用完整描述性短语，旧验收证据保留拍摄时名称。

单薄墙安全落点指一格厚的墙面；正交横穿时可覆盖同墙面相邻砖块，避免在砖缝处无理由失败。第二层墙、斜角第二障碍、VOID及身体不净空仍由连续swept-AABB拒绝。试验场在左侧增加单格厚连续墙供真实按键验证。
