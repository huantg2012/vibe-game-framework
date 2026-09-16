---
status: ACTIVE
created-by: design agent
created-date: 2026-07-26
last-modified-by: code / director（DEC-168：连续自然地形的绕行与同源支持）
last-modified-date: 2026-09-16
interface-changed: true
slice: 1
interfaces-with:
  - system-enemy-ai            # T2：共用 grid-raycast 视线工具；敌人可见性依赖本系统查询
  - system-chaos-scavenge-extract  # T3：混乱值经场景层调用本系统的视野调制器 / 玩家移速调制器
  - system-combat              # T4：共享同一 Player 实体（本 spec 只拥有移动/朝向/碰撞体）
  - tilemap-renderer           # T6：提供 OccluderGrid（哪些 tile 遮挡视线）
exposes:
  - Player.getPosition() / getFacingAngle() / getFacing4() / isMoving()
  - Player.setSpeedModifier(source, mult) / clearSpeedModifier(source)
  - Player.setInputEnabled(enabled)
  - Player.getGroundY() / setGroundDepth(base, floorDepth) # DEC-120：净化点显式接入
  - VisibilitySystem.setRadiusScale(scale)        # 混乱值钩子：视野半径缩小
  - VisibilitySystem.setEdgeCorruption(level)     # 混乱值钩子：teal 噪点渗入 + 边缘抖动
  - VisibilitySystem.setScreenFlicker(intensity)  # 混乱值钩子：全屏微闪
  - VisibilitySystem.isPointVisible(p) / getVisibilityAt(p) / getEffectiveRadius(angle)
  - VisibilitySystem.registerGlowSource(id, pos, radius) / unregisterGlowSource(id)
  - utils/grid-raycast：castRay(grid, origin, angle, maxDist) / hasLineOfSight(grid, a, b)
  - OccluderGrid 接口契约（由地图侧实现）
  - 新增事件：无（本系统对外为同步查询 API + setter，不进事件总线）
---

# 系统设计：移动 + 有限视野

## 迭代23：连续地貌观察场的移动与感知边界（DEC-168）

仅 `living-landmass-stage.html`：复用Player平面移动、80速度、斜向归一、转向与20×20完整身体扫掠。CSV独立编排连续主地、宽坡、浅洼、高壳壁与倒伏体，路线节点仅描述绕行重连，不生成地貌；8px格按完整格留量准入，所有可见障碍占地参与阻挡。实际静态三角网提供两脚与阴影高程（随地层CSV制作、具体冻结统计见QA），主路线全身体宽度采样带坡度<.3，侧向地层总体<.6，实际高度/双脚/整身支持仍同源；无跳跃、按坡减速、攀爬或同XY重叠楼层。

相机为32°长焦透视工作默认，distance2600、焦面跨度960、far15000。DEV `?camera=28|32|36` 仅研究；焦点跟随(player.x+60,player.y−350,height0)。角色每帧按真实竖向射线绘制，透视下尺寸随深度变化。逻辑960×640，内部1920×1280加MSAA不会改变游戏速度、范围或坐标。

主壳与倒伏体采用固定−32°、alpha裁切且写深度的绘制片，不跟随镜头旋转。主壳固定占地代理参与碰撞/投影，倒伏体的碰撞来自与绘制落地底缘一致的独立CSV；投影代理不写颜色或深度，避免代理形体切断画片；人物仍在同一深度缓冲中绘制，卡片轮廓和实际阻挡必须用普通去回行走核对。角色每像素深度在透视镜头下从真实viewZ加姿态偏移后重新投影，禁止直接沿用正交的线性深度减法；共享正交场景保留原公式。画中层缘不产生额外高程或可走台阶，主壳上缘不可站立。

原生blur/focus、visibilitychange和Phaser事件暂停/恢复输入与物理、音频；隐藏时不恢复，刷新回同一出生点。非通行中景的缓慢动作使用固定端的局部顶点权重：固定倾角中景绘制悬挑片最多18单位、下层主承体10、延迟响应体6，共用26秒声画时钟；不改变走面或碰撞。reduced-motion静止装饰运动，不改变行动规则。

**当前观察场没有战术视野。** 未来接入正式搜撤时：极远景观可持续提供世界方位，但远处画片不包含敌人/拾获/危险状态；近处地形、敌人、可搜物与具体危险按原正式感知与记忆规则呈现，不能因站在高地或背景可见而自动泄露。遮蔽路段必须实走检查人物与通路可辨，不用FOV或装饰遮挡掩盖未解决的场景问题。本条登记接入边界，不声称已经适配生产FOV。

## 迭代23：固定足迹上的动态支撑（DEC-159冻结实现）

以下为用户否决视觉后的旧局部运行合同；不作为DEC-161新画法的限制。旧生命大陆沿用35°、yaw0、1060跨度、960×640输出，以及现有前向224/环身80感知。平面移动、完整身体碰撞、朝向缓动和AI仍由原系统决定；Z由世界同一准备帧的8px三角格提供，地表、断面、角色/敌人足点及地面物件不得各自计算另一份波。额外形变上限32、最大坡≤0.4；没有水平移动平台、按坡减速或完整三维碰撞的承诺。

中央空腔允许当前视线通过而不积累假地面记忆，可看见下方承托体，不能走入。脚下道路、危险、敌人和拾获遵守真实当前感知/已见地表规则；不携带玩法信息的远层巨体可作为世界背景可见，不能借背景显露未知道路或奖励。暂停和终局同时冻结实际支撑与危险，Tab拾获仍继续世界时钟。

## 迭代21 M：长路线的固定角度取景

仅Stage开发长路线启用`StageFollowCamera`：35°俯角、0°水平偏角、1060世界单位跨度保持固定，较长地图通过平滑平移展示。镜头读取实际位置和水平运动，不以转身、攻击或脚部摆动驱动取景；停止后收稳，暂停及结算冻结。足点高度只用于同源地形投影，镜头不跟随坡高起伏。

镜头平移不扩大224px前向/80px环身感知，不显示未见敌人或拾获，不改变XY物理、移动速度或空洞规则。Stage内部空洞可望不可跨的DEC-155合同保持；原短局部沿用固定相机，Vista继续冻结。相机参数与当前支持范围归[开发入口](../dev/spatial-study.md)，实际视线与碰撞仍归本spec。

海体退让的连续高程查询和实际表面补偿只应用当前视线；地貌记忆不得单独使前方海体透明。记忆仍保存在真正的地面/岸壁中，随自然海孔或当前R打开后显现为暗地貌，不能印到完整海面上。当前可见下沉岸壁的补偿保持，所有感知纹理查询尊重世界边界，禁止钳位纹理边缘后向画幅外扩散。地貌记忆、即时视线、海体遮挡与物理支持分别承担各自关系。

> **TL;DR**: 定义玩家在裂隙/净化点内的俯视角移动（Arcade AABB、四方向朝向、可叠加移速调制）与 Raycasting 有限视野（前向锥 + 环身暖光、3 级边缘 alpha、视野外 void-black+噪点）；对外暴露玩家位姿查询、视野可见性查询、以及供混乱值系统调用的三个视野调制接口，不新增事件。

## 迭代12：全向边界与地面接触（DEC-120）

全向参考光场使用半角180°，角向权重必须恒为1；不能以绝对角度恰好小于等于π作为全向判据。Float32保存的±π略越过双精度π仍属全向有效射线。90条与降档40条射线的同半径采样应方向一致，等照线首尾不塌缩。裂隙锥形角衰减与DEC-107的32层等照线、teal软内缘、查询三档保持原语义。

Player新增getGroundY()返回中立脚底世界y（图像中心y+10），不随步态帧透明边缘变化；setGroundDepth(base, floorDepth)是可选显示接口，统一调整主体、转身剪影和灯光/灯尘，地面光池独立。由净化点在postUpdate后调用，未调用的裂隙/练习场沿用创建时层级。初轮未改碰撞体；追加I12-C允许净化点脚底体覆盖，朝向、速度、视野查询及事件协议不变。净化点排序规则归system-purification-impact。

## 概述

本系统是玩家在两个可行走场景中"能动、能看见"的地基。它做两件事：把键盘输入变成受墙体约束的位移与朝向；把"玩家当前能看到哪里"计算成一块每帧更新的黑暗遮罩。

它直接服务体验支柱 1「绝望边缘的紧绷」：**看不见的地方永远比看得见的地方大**。玩家的信息永远不完整，转身观察是有成本的主动动作（转过去看，就意味着背后变黑）。它同时是支柱 2「贪婪与撤退的博弈」的前提——不知道下一个房间有什么，"再多拿一点"才成为赌博而不是计算。

按 `architecture.md` DEC-ARCH-008，移动与视野是 **RiftScene 与 PurificationScene 共享的独立模块**，不得硬编码进任何单一场景。两个场景的差异只体现为**配置参数不同**（见"场景参数差异"），不允许出现 `if (scene === 'rift')` 式分支。

**本 spec 的所有权边界**（Player 实体被多个 spec 共享，划清避免冲突）：

| 归本 spec 拥有 | 归其他 spec 拥有 |
| -------------- | ---------------- |
| Player 的位置/速度/朝向/碰撞体/移速调制栈/输入开关 | Player 的生命值、攻击、受击白闪（`system-combat`） |
| 玩家视野的形状/渲染/调制接口 | 混乱值本身与调制的**具体数值**（`system-chaos-scavenge-extract`） |
| 共享射线工具 `utils/grid-raycast` | 敌人自身的感知锥与判定阈值（`system-enemy-ai`） |

玩家出击贴图不归本 spec（现行 `player-sprite-dense.ts` + 灯尘，DEC-068）。HOW：`docs/art/actor-pixels.md`。

---

## 状态模型

```typescript
/** 四方向朝向（用于 sprite 帧选择；art-direction §3.3 角色移动 4 帧 x 4 方向） */
type Facing4 = 'up' | 'down' | 'left' | 'right';

/** 玩家移动状态（本 spec 拥有） */
interface PlayerMovementState {
  position: Vector2;            // 世界坐标（px）
  velocity: Vector2;            // px/s，当前实际速度
  inputVector: Vector2;         // 原始输入，斜向已归一化，长度 0 或 1
  facingAngle: number;          // 弧度，连续值。视野锥使用它
  facing4: Facing4;             // facingAngle 量化后的四方向。sprite 使用它
  baseSpeed: number;            // px/s
  speedModifiers: Map<string, number>;  // 乘法调制栈，key = 来源（'chaos' / 'debug' / ...）
  isMoving: boolean;            // inputVector 非零
  inputEnabled: boolean;        // DOM 面板打开时置 false（净化点）
}

/** 视野静态配置（每个场景一份，创建时注入） */
interface VisionConfig {
  mode: 'cone' | 'omni';        // 裂隙用 cone，净化点用 omni
  radiusForward: number;        // px，正前方最大可视距离
  radiusAmbient: number;        // px，环身 360° 最小可视距离（= 玩家携带暖光范围）
  coneHalfAngle: number;        // 度，满射程扇区的半角
  coneFalloffAngle: number;     // 度，从满射程衰减到环身射程的过渡带角宽
  rayCountForward: number;      // 分配给前向扇区的光线数
  rayCountAmbient: number;      // 分配给其余角度的光线数
  minSolidRadius: number;       // px，无论如何都完全可见的贴身半径
  edgeBandWidth: number;        // px，单条边缘渐变带的标称宽度（art §4.3 = 1 tile）
  bandAlphas: [number, number, number];  // 三级 alpha（art §7.1）
  voidColor: number;            // 视野外颜色（void-black）
  voidNoiseEnabled: boolean;    // 净化点关闭（由 BoundaryAtmosphere 接管边界外表现）
  playerLampEnabled: boolean;   // 玩家携带暖光叠加层（art §5.1 / §2.3 规则 4）
}

/** 视野运行时状态 */
interface VisionRuntimeState {
  radiusScale: number;          // 混乱值钩子，默认 1.0，下限 MIN_RADIUS_SCALE
  edgeCorruption: number;       // 混乱值钩子，0..1
  screenFlicker: number;        // 混乱值钩子，0..1
  rayCountActive: number;       // 性能降级后的实际光线数
  cacheValid: boolean;          // 静止缓存是否可用
  lastOrigin: Vector2;
  lastFacing: number;
  gridVersion: number;          // 遮挡物变更计数，变化即失效缓存
  /** 等照线带多边形顶点，预分配，永不在游戏循环内 new */
  polygons: [Float32Array, Float32Array, Float32Array];
}

/** 遮挡物查询契约：由地图侧（T6 固定地图 / 后续程序化地图）实现并注入 */
interface OccluderGrid {
  readonly cols: number;
  readonly rows: number;
  readonly tileSize: number;
  /** 该 tile 是否阻挡视线。越界一律视为 true */
  isOpaque(col: number, row: number): boolean;
  /** 每次 tile 数据被修改时自增，用于让视野缓存失效 */
  readonly version: number;
}
```

裂隙 tile 网格（`TileGrid`）的遮挡口径：WALL 与 VOID 均挡视线（DEC-106 虚空吞光，2026-08-29 翻转 Slice 6 的「VOID 不挡」默认）；FLOOR / FRACTURE 不挡。净化点场景自带遮挡网格（只认 WALL、无 VOID 瓦片），不受 DEC-106 影响。

---

## 规则

### M — 移动

1. **输入**：WASD 与方向键等价，同时生效。八方向输入合法，但斜向输入向量归一化，**斜走不比直走快**。
2. **加减速**：速度不瞬时突变。按 `MOVE_ACCEL_TIME` 从静止加到满速，按 `MOVE_DECEL_TIME` 从满速减到静止（线性趋近目标速度即可，不需要曲线）。目的：给移动一点重量，同时不引入可感知的滑行。
3. **实际速度** = `baseSpeed × Π(speedModifiers)`。调制栈为乘法叠加，按来源 key 覆盖写入。无调制时乘积为 1.0。
4. **朝向**：`facingAngle` 由**最近一次非零输入方向**决定，静止时保持不变（松开按键不会重置朝向）。玩家无法在不改变朝向的前提下改变移动方向——**朝哪走就朝哪看**。
5. **转向不瞬移**：`facingAngle` 以 `FACING_TURN_RATE`（度/秒）向目标角度插值，走最短弧。这只影响视野锥的转动平滑度，不影响移动方向（移动立即响应输入）。
6. **四方向量化**：`facing4` 取 `facingAngle` 最近的正交方向（边界按 45° 划分，量化带 ±5° 迟滞防止斜向抖动切帧）。sprite 只用 `facing4`，视野只用 `facingAngle`。
7. **碰撞**：Arcade Physics AABB。玩家碰撞体为居中的正方形（`BODY_SIZE`），小于 tile 宽度，保证 1 tile 宽通道可通行且不卡角。开启 `collideWorldBounds`。**I12-C例外**：净化点通过PlayerConfig的可选矩形碰撞配置使用12×8、offset(10,22)，中心等于groundY，既用于五台底座也用于场地边界；裂隙/练习场默认20×20、offset(6,6)不变。
8. **沿墙滑动**：斜向撞墙时，被阻挡的轴清零、另一轴保留 —— 即 Arcade 的默认分轴解算行为，必须保留。贴墙绕行是潜行的基本操作，不允许因碰撞而"粘住"。
9. **输入开关**：`inputEnabled = false` 时立即清零输入向量（速度按规则 2 正常减速到 0），朝向冻结。用于净化点 DOM 面板打开、出击结算等状态。
10. **移动不产生噪音语义**：本 slice 不做"潜行/疾跑"双速。敌人听觉（若 T2 采用）以距离而非玩家速度为准。移速调制栈已为未来的潜行速度预留位置。

### V — 视野

11. **视野 = 前向锥 ∪ 环身圈**。每条光线的最大射程按其与朝向的夹角 `θ` 决定：

    ```
    θ ≤ coneHalfAngle                              → radiusForward
    coneHalfAngle < θ < coneHalfAngle+coneFalloff  → smoothstep 从 radiusForward 降到 radiusAmbient
    θ ≥ coneHalfAngle + coneFalloffAngle           → radiusAmbient
    ```

    环身圈在叙事上就是玩家携带的净化设备投射的暖光（`world.md` 玩家侧唯一暖色；art §5.1「照亮周围 2-3 tile」）。它保证玩家永远不会对贴身威胁完全失明，同时让"背后"始终只有 2.5 tile 的信息。

12. **射线求交**：对每条光线在 tile 网格上做 DDA 步进，命中第一个 `isOpaque` 的 tile 即停，记录命中距离 `d`；未命中则 `d = maxDist(θ)`。这是自实现 raycasting（DEC-ARCH-004），不使用任何第三方光照。
13. **光线分配**：`rayCountForward` 条均匀分布在朝向 ±(coneHalfAngle+coneFalloffAngle) 的扇区内，`rayCountAmbient` 条均匀分布在剩余角度。两端点各补一条边界光线保证多边形闭合。总数不超过 60（架构性能预算）。
14. **对角缝隙不可穿透**：当射线恰好穿过两个**对角相邻**的墙 tile 的公共顶点时，判定为命中。禁止"从墙角斜缝看到另一侧"。
15. **三级边缘渐变**（art §7.1 的 alpha 分级 + §4.3 的固定带宽几何，见"边缘渐变的推导"）：以每条光线的**最大射程** `maxDist(θ)`（不是命中距离）为基准，在射程外沿向内切**两条等宽的渐变带**，其内侧为全亮核心，合计三级：

    ```
    bandWidth = clamp((maxDist(θ) - minSolidRadius) / 2, 0, edgeBandWidth)
    r3 = maxDist(θ)                  // 外带外沿，alpha 0.20；此距离之外全黑
    r2 = maxDist(θ) - bandWidth      // 中带外沿，alpha 0.60
    r1 = maxDist(θ) - 2 × bandWidth  // 全亮核心外沿，alpha 1.00
    ```

    第 k 层多边形的顶点距离 = `min(d, r_k)`。**带宽以射程为基准而非以命中距离为基准**——否则一堵贴脸的墙会把整套渐变压缩进 1 tile 内，在脚边出现一圈莫名其妙的暗环。

    **渲染（DEC-107）：** 画面走 32 层等照线连续衰减：每层 = 射线裁剪多边形，带半径取自参考光场（手电强曲线 × 暖灯弱曲线）等照线并被射程曲线夹取。逻辑查询仍返回三档 0 / 0.2 / 0.6 / 1.0（上表带宽几何与 clamp 分支一字不动）。渲染比查询更平滑，不违反规则 23（`getVisibilityAt` 仍是「能不能看见」的唯一答案）。
16. **贴身永远全亮**：`minSolidRadius` 以内恒为 alpha 1.0（受墙体遮挡限制）。玩家自己所在的 tile 永远可见。
17. **视野外 = void-black + 噪点**：视野多边形之外整屏覆盖 `void-black`(#080a0c)，叠加一层极弱的平铺噪点（缓慢滚动），暗示"那里有空间，只是看不见"，而不是"那里没有加载"（art §4.3）。
18. **玩家暖光叠加**：在实体层之上、黑暗遮罩**之下**叠加一层以玩家为中心、半径 = `radiusAmbient` 的暖色径向渐变（放在遮罩之下，暖光才会被视野边界正确切掉，而不是透过黑暗发亮）（warm-dim #8a5c2a，ADD 混合）。它是裂隙中唯一的暖色来源，也是保证低对比度的渗透体在贴身距离能被看见的手段（art §13.2）。
19. **发光泄露**：注册为 glow source 的对象即使落在视野外，仍以极低 alpha 渲染为一个光点（art §7.1「远处发光泄露」/ §4.3「远距离导航辅助」）。**Slice 1 的 glow source 只有撤离点**——它是导航锚点，玩家应当始终知道回家的方向。**薪柴不是 glow source**：薪柴必须靠视野找到，否则搜刮退化为"看着光点跑过去"，博弈消失。（撤离点/薪柴的内容定义归 T3，此处只定义机制与 Slice 1 的默认归类建议。）
20. **静止缓存**：当 `|Δorigin| < CACHE_POS_EPSILON` 且 `|Δfacing| < CACHE_ANGLE_EPSILON` 且 `grid.version` 未变时，直接复用上一帧的等照线带多边形，跳过全部射线计算（架构要求）。
    - **`setRadiusScale()` 必须同时置 `cacheValid = false`**（2026-07-29 由 code agent 在 T5 实现时补入，闭合 `system-chaos-scavenge-extract` escalate 第 5 项）。射程是每条射线 `maxDist` 的输入，调制器改了射程就等于改了缓存的前提；不失效的话玩家静止时视野不会跟随混乱值收缩，会出现"站着不动混乱值涨了视野却没变、一动突然缩一大截"。`setEdgeCorruption` / `setScreenFlicker` **不需要**失效缓存——它们只改渲染，不改射线几何（边缘抖动在多边形组装阶段叠加，不影响命中距离）。T3 的 `MODULATOR_STEP` 节流正是为了让这次失效的频率可控。
21. **性能降级**：连续 30 帧平均耗时超预算时，降级顺序为 ① 光线数 60 → 40（前向 28 / 环身 12）；② 视野每 2 帧更新一次（中间帧沿用上一帧多边形）。不降级 alpha 分级与噪点（它们是固定成本）。
22. **混乱值调制**（接口由本系统定义，取值由 T3 定义）：三个互相正交的调制器，均由**场景层**在收到混乱值事件后调用（见"与已有系统的接口"）：
    - `setRadiusScale(s)`：`radiusForward` 与 `radiusAmbient` 同乘 `s`，下限 `MIN_RADIUS_SCALE` 防止完全失明。
    - `setEdgeCorruption(L)`：`L ∈ [0,1]`，同时驱动三件事——外带色相向 contam-core(#1aad96) 混合、teal 噪点自边缘向内渗透、边缘半径抖动（三者用同一个 L 驱动，保证"污染在吃掉视野"读作一件事而不是三个特效）。
    - `setScreenFlicker(i)`：周期性全屏微闪（art §7.2 的最高档表现）。
23. **调制不改变几何契约**：调制只影响渲染与射程，不改变 `isPointVisible` 的语义——被缩小后看不见的地方，查询也必须返回不可见。视觉与逻辑必须一致，否则玩家会被"我明明看见了却打不到"骗。
24. **净化点差异靠配置**：`mode: 'omni'` 时忽略朝向，全角使用同一射程，`voidNoiseEnabled = false`（边界外由 BoundaryAtmosphere 负责）。其余规则不变。
25. **小地图已探索集合的真相来源**：裂隙小地图的「已探索格子」与主画面同一套可见性（遮挡 + 前向锥 ∪ 环身圈，见规则 11–16、23）。一格被记为已探索，当且仅当该格上一点曾被 `isPointVisible` / `getVisibilityAt` 判为当前可见。禁止用环身灯半径近似圆单独代替视锥与遮挡。本系统不持久保存已见集合、**不新增「已见格子」只读接口**；场景层每帧用既有查询累积，再交给小地图。小地图不 import VisibilitySystem。`system-chaos-scavenge-extract` 规则 18「没有记忆标记」约束的是薪柴节点不在视野外留 HUD 标记，不禁止小地图记住已探索格子。净化点没有小地图，本条只约束裂隙。

### 边缘渐变的推导（为什么是固定带宽而非半径百分比）

art-direction 两处给出的分级不一致，本 spec 的取舍如下（同时列入 escalate）：

- alpha 取值采用 **§7.1**：`1.00 / 0.60 / 0.20`（Brief 指定 §7 为视觉数值权威）。
- 带的几何采用 **§4.3**：每带 1 tile 宽（32px）固定宽度，从射程外沿向内切。

理由一（几何必要性）：射程在本系统里是**随角度变化的**（前向 224 / 环身 80），且会被混乱值缩放。若按半径百分比切带，环身方向的渐变会被压成 8 px 的硬边，而混乱值缩小视野时整幅画面会一起变糊——读作"画面在整体变暗"，而不是"视野边缘在变软"。固定带宽让"边缘软度"成为一个稳定的视觉常量。

理由二（可读性）：固定 1 tile 带宽会得到比 §7.1 百分比模型**更大的全亮核心**，这是有意的取舍。

| 分层 | 固定带宽模型（R=224, band=32） | art §7.1 的百分比 | 差异 |
| ---- | ------------------------------ | ----------------- | ---- |
| 全亮核心（alpha 1.00）外沿 | 160 px = 0.71 R | 0.50 R | 核心更大 |
| 中带（alpha 0.60）外沿 | 192 px = 0.86 R | 0.70 R | — |
| 外带（alpha 0.20）外沿 | 224 px = 1.00 R | 0.90 R | 见 escalate ④ |

按 §7.1 字面执行，全亮核心只有 112 px（3.5 tile），从 3.5 tile 之外一切都在 alpha ≤ 0.6 之下。叠加裂隙本身"75% 暗色地面 + 低对比度渗透体"（art §4.2 / §13.2），敌人在 4-5 tile 距离将几乎不可辨——而这正是"先看到它再决定绕不绕"必须成立的距离区间（敌人 `SIGHT_RANGE = 180 px`）。固定带宽把 128–180 px 这段关键决策距离保持在全亮区内。

若 art agent 判断画面因此"不够雾"，正确的调法是把 `VISION_EDGE_BAND_WIDTH` 提到 48–64 px，而不是切回百分比模型。

---

## 玩家交互

- **输入**：
  | 操作 | 键位 | 效果 |
  | ---- | ---- | ---- |
  | 移动 | WASD / 方向键 | 八方向移动；同时决定朝向 |
  | （无独立转向键） | — | 见下方说明 |

- **为什么不做鼠标瞄准的手电筒**（A/B 决策，请 Director 记入 decisions-log）：
  - **A（采纳）**：朝向 = 移动方向，纯键盘。转身观察必须付出"改变移动方向"的代价，背后的黑暗因此始终是真实的威胁。四方向 sprite 资产需求也与 art §3.3 一致。
  - **B（否决）**：鼠标自由瞄准视野锥。玩家可以一边后撤一边扫视，"背后"这个概念被消解，支柱 1 的压迫感直接漏气；同时需要 8-16 方向 sprite，超出 art 现有规划。
  - 保留后路：`Player` 的朝向来源是单一入口，未来若要加"按住 Shift 锁定朝向平移"，改这一处即可。

- **反馈**：
  | 玩家状态 | 系统响应 |
  | -------- | -------- |
  | 移动 | sprite 播放对应 `facing4` 的 4 帧行走循环（身体伸缩；玩家灯微晃；敌人崩坏像素错位）。视野锥随朝向平滑转动 |
  | 撞墙 | 沿墙滑动，无停顿无抖动（不做撞击特效） |
  | 转身 | 玩法朝向（视野锥 / `facing4` 切入时机）不变。贴图切向时播压缩帧，并留一层旧朝向剪影短滞后（约 180ms），不旋转 GameObject |
  | 混乱值升高 | 视野边缘出现 teal 偏移 → 半径收缩 → 噪点向内渗透（连续变化，不是突然跳档） |
  | 贴近发光的撤离点 | 即使在视野外也能看到一个微弱光点（方向锚） |

---

## 数值结构（可调参数表）

> **状态列**：`建议值` = 本 spec 给出的有依据初值，**需人试玩校准**；`技术定` = 技术/结构性取值，无需人拍板；`art 定` = 来自 art-direction，改动需 art agent 同意；`架构定` = 来自 architecture.md 的硬约束。
> 实现时全部集中进 `src/config/constants.ts`，不散落在系统内部。

### 移动

| 参数 | 含义 | 建议初值 | 合理范围 | 对手感的影响 | 状态 |
| ---- | ---- | -------- | -------- | ------------ | ---- |
| `MOVE_SPEED` | 玩家基础移速 | 160 px/s（5 tile/s） | 120–200 | 太快→视野追不上、像滑冰；太慢→枯燥。与敌人追击速 130 的差值决定"能不能拉开距离"，是潜行博弈的核心比值 | 建议值（沿用现有 constants） |
| `MOVE_ACCEL_TIME` | 0→满速耗时 | 0.08 s | 0–0.20 | 越大越"重"；>0.15 会明显感到输入延迟 | 建议值 |
| `MOVE_DECEL_TIME` | 满速→0 耗时 | 0.10 s | 0–0.20 | 越大越"滑"；窄通道里 >0.15 会频繁冲过转角 | 建议值 |
| `FACING_TURN_RATE` | 朝向插值角速度 | 1080 °/s（180° ≈ 0.17s） | 540–99999 | 越低转身越"重"、视野扫过感越强，但会迟滞观察；设极大值即瞬时 | 建议值 |
| `FACING_QUANT_HYSTERESIS` | 四方向量化迟滞 | 5° | 0–10 | 防止 45° 附近 sprite 高频抖帧 | 技术定 |
| `BODY_SIZE` | 碰撞体边长 | 20 px | 16–24 | 必须 < 32；越小越不卡角但会有"穿进墙里"的观感 | 技术定 |
| `BODY_OFFSET` | 碰撞体在 32×32 sprite 内的偏移 | (6, 6)（居中） | — | 公式 `(画布边长 − BODY_SIZE) / 2`。画布变了只改这项，不要改 `BODY_SIZE`。敌人渗透体同样 32×32 / `{6,6}`，见 `system-enemy-ai` | 技术定 |
| `SPEED_MOD_MIN` | 移速调制乘积下限 | 0.5 | 0.4–0.7 | 防止混乱值叠加把玩家钉死 | 建议值 |

### 视野（裂隙 / cone 模式）

| 参数 | 含义 | 建议初值 | 合理范围 | 对表现的影响 | 状态 |
| ---- | ---- | -------- | -------- | ------------ | ---- |
| `VISION_RADIUS_FORWARD` | 正前方射程 | 224 px（7 tile） | 160–288 | 决定"能提前多远发现敌人"。必须 **> 敌人 SIGHT_RANGE(180)**，否则玩家永远后手，潜行不成立 | 建议值 |
| `VISION_RADIUS_AMBIENT` | 环身 360° 射程 | 80 px（2.5 tile） | 64–96 | art §5.1 规定玩家暖光照亮 2-3 tile。调大会显著削弱"背后"的恐惧 | 建议值（art 约束内） |
| `VISION_CONE_HALF_ANGLE` | 满射程扇区半角 | 50°（张角 100°） | 35–65 | 越窄越紧张越易迷路；越宽越舒适越无聊 | 建议值 |
| `VISION_CONE_FALLOFF_ANGLE` | 锥边过渡带角宽 | 30° | 15–45 | 越大锥形边界越柔和，"手电筒"感越弱 | 建议值 |
| `VISION_MIN_SOLID_RADIUS` | 贴身全亮半径 | 48 px（1.5 tile） | 32–64 | 保证脚下永远清楚；调大会让边缘渐变带被挤窄 | 建议值 |
| `VISION_EDGE_BAND_WIDTH` | 单条渐变带标称宽度 | 32 px（1 tile） | 16–48 | art §4.3 定为 1 tile。越宽边缘越"雾"，越窄越像硬边光圈 | art 定 |
| `VISION_BAND_ALPHAS` | 三级 alpha | [1.00, 0.60, 0.20] | — | art §7.1 | art 定 |
| `VISION_RAY_COUNT` | 总光线数 | 60 | 36–60 | 架构上限。降低会让多边形边缘出现可见折线 | 架构定 |
| `VISION_RAY_SPLIT` | 前向 / 环身光线分配 | 40 / 20 | — | 前向 40 条覆盖 ±80° → 4°/条；环身 20 条覆盖 200° → 10°/条。两者在各自射程末端的弧长间隔均约 14 px（≈0.45 tile），视觉密度一致 | 技术定 |
| `VOID_COLOR` | 视野外底色 | #080a0c (void-black) | — | art §2.2 | art 定 |
| `VOID_NOISE_ALPHA` | 视野外噪点强度 | 0.04 | 0.02–0.08 | >0.08 会变成"电视雪花"，破坏"绝对黑暗"；=0 则黑区读作未加载 | 建议值 |
| `VOID_NOISE_TILE` | 噪点纹理平铺尺寸 | 64 px | 32–128 | 太小会出现可见重复网格 | 技术定 |
| `VOID_NOISE_SCROLL` | 噪点滚动速度 | 2 px/s | 0–6 | 极慢的漂移让黑暗"活着"；过快会被注意到 | 建议值 |
| `PLAYER_LAMP_COLOR` | 玩家暖光色 | #8a5c2a (warm-dim) | — | art §2.3 规则 4 / §13.1 色温主轴 | art 定 |
| `PLAYER_LAMP_ALPHA` | 玩家暖光峰值 alpha | 0.12 | 0.06–0.20 | 太强会污染"裂隙是冷色"的色彩纪律；太弱则渗透体在贴身距离仍看不见 | 建议值 |
| `GLOW_LEAK_ALPHA` | 视野外发光点 alpha | 0.15 | 0.08–0.25 | 太亮 = 导航过于轻松；太暗 = 找不到撤离点导致烦躁 | 建议值 |
| `GLOW_LEAK_RADIUS` | 视野外发光点绘制半径 | 12 px | 8–24 | art §7.1「2-3 tile 范围内可见微弱光点」 | 建议值 |

### 视野（净化点 / omni 模式）

| 参数 | 建议初值 | 说明 | 状态 |
| ---- | -------- | ---- | ---- |
| `mode` | `'omni'` | 忽略朝向，全角同射程 | 技术定 |
| `PURIFY_VISION_RADIUS` | 400 px（12.5 tile） | 净化点地图仅 12×10 tile（384×320 px），该射程覆盖全域，遮罩主要落在边界墙之外（art §7.3） | 建议值 |
| `PURIFY_RAY_COUNT` | 36（10°/条） | 空间极小且几乎全被墙界定，无需 60 条 | 技术定 |
| `voidNoiseEnabled` | `false` | 边界外交给 BoundaryAtmosphere，避免两套噪点叠加 | 技术定 |
| `playerLampEnabled` | `true`（alpha 减半） | 净化点有固定暖光源，玩家自带光不应喧宾夺主 | 建议值 |
| 混乱值调制 | 全部保持默认（1.0 / 0 / 0） | 净化点内混乱值恒为 0 | 技术定 |

### 混乱值调制器（本 spec 定接口与边界，**取值归 T3**）

| 调制器 | 默认 | 允许范围 | 本 spec 施加的硬边界 |
| ------ | ---- | -------- | -------------------- |
| `radiusScale` | 1.0 | 0.4–1.0 | `MIN_RADIUS_SCALE = 0.4`，低于此值直接钳制（完全失明不是玩法，是故障） |
| `edgeCorruption` | 0.0 | 0.0–1.0 | L=1 时 teal 最多吃掉外侧 35% 射程；色相混合比上限 0.6；边缘抖动幅度上限 4 px @ 6 Hz |
| `screenFlicker` | 0.0 | 0.0–1.0 | 驱动溢出世界层强度。常驻蒙层 + 颗粒噪点随该值加厚；跳变为约 2.2 s 一次、脉宽 ~140 ms 的离散脉冲（禁止变成闪光训练）。Phaser 层跳变峰值 alpha ≤ 0.16 |

**给 T3 的参考映射**（对齐 art §7.2 的四档，T3 拥有最终解释权）：

| art §7.2 阶段 | radiusScale | edgeCorruption | screenFlicker |
| ------------- | ----------- | -------------- | ------------- |
| 安全 | 1.00 | 0.00 | 0.0 |
| 警告 | 1.00 | 0.35 | 0.0 |
| 危险 | 0.90 | 0.65 | 0.0 |
| 超阈值 | 0.75 → 递减至 0.40 | 1.00 | 0.5 |

（0.90 / 0.75 与现有 `constants.ts` 的 `CHAOS.PENALTIES.*.VISION_MULTIPLIER` 一致，可直接复用。）

---

## Schema（对外接口契约）

```typescript
/** 玩家实体：移动/朝向部分（战斗相关成员由 system-combat 定义） */
interface PlayerMovementAPI {
  getPosition(): Readonly<Vector2>;
  getFacingAngle(): number;                 // 弧度，连续
  getFacing4(): Facing4;
  isMoving(): boolean;

  /** 移速乘法调制。source 相同则覆盖。混乱值用 'chaos'，调试用 'debug' */
  setSpeedModifier(source: string, multiplier: number): void;
  clearSpeedModifier(source: string): void;

  /** DOM 面板打开 / 出击结算时冻结输入 */
  setInputEnabled(enabled: boolean): void;
}

/** 视野系统 */
interface VisibilitySystemAPI {
  create(scene: Phaser.Scene, config: VisionConfig, occluders: OccluderGrid): void;
  /** 每帧调用；内部自行判断能否命中静止缓存 */
  update(origin: Vector2, facingAngle: number, deltaMs: number): void;

  // —— 混乱值钩子（由场景层调用，不由 ChaosSystem 直接调用）——
  setRadiusScale(scale: number): void;
  setEdgeCorruption(level: number): void;
  setScreenFlicker(intensity: number): void;

  // —— 查询（渲染层 / 玩法层消费）——
  isPointVisible(p: Vector2): boolean;
  /** 返回 0 | 0.2 | 0.6 | 1.0，用于实体渲染 alpha 与"是否应该显示" */
  getVisibilityAt(p: Vector2): number;
  /** 给定与朝向的夹角（弧度），返回当前调制后的最大射程 */
  getEffectiveRadius(angleFromFacing: number): number;

  // —— 发光泄露注册 ——
  registerGlowSource(id: string, pos: Vector2, radius: number): void;
  unregisterGlowSource(id: string): void;

  destroy(): void;
}

/** 共享射线工具（纯函数模块，非"系统"，可被任意系统 import） */
declare function castRay(
  grid: OccluderGrid, origin: Vector2, angleRad: number, maxDist: number
): { x: number; y: number; dist: number; hit: boolean };

declare function hasLineOfSight(
  grid: OccluderGrid, from: Vector2, to: Vector2, maxDist?: number
): boolean;
```

### 渲染层级（自底向上）

```
1. Tilemap 地面/墙体（TilemapRenderer）
2. 地面 decal / 可交互物
3. 实体层（玩家 / 渗透体 / 投射物）
4. 玩家暖光叠加层（ADD 混合，跟随玩家）
5. 黑暗遮罩层（void-black + 32 层等照线带挖空 + 视野外噪点）   ← 本系统
6. 发光泄露点（撤离点等，绘制在遮罩之上）                    ← 本系统
7. 全屏微闪 / teal 渗透覆盖（混乱值高档时）                  ← 本系统
8. HUD（Phaser Text/Graphics）
```

**遮罩实现建议**（技术细节，code agent 可自行调整实现手段，但合成结果必须符合规则 15 的查询契约）：在一张覆盖 camera viewport（外扩 2 tile）的 RenderTexture 上填满 void-black，然后用 `ERASE` 混合从外到内擦除 32 层射线裁剪多边形。每层半径是参考光场等照线被射程曲线夹取的结果；望远镜擦除使带 k 内残余恰为 `SUBDIV2_LEVELS[k]`。逻辑查询仍按上表三档返回 0 / 0.2 / 0.6 / 1.0。

---

### DEV空间样板：立体地形的雾照明（DEC-150）

仅`spatial-study.html`使用的`revealProjectedTerrain(image, visibility)`在每帧Fog重建后，将礁石真实基部边界的可见性沿其不透明轮廓映射到高度。原礁石整体仍在脚底排序中，前方角色可以遮住它，上方海体继续遮挡礁尖。投影到屏幕高处的石头像素不应再次当作远处地面来计算雾。

该显示修正不改变射线、逻辑可见性、探索状态或敌人显隐；不清除礁石轮廓之外的雾。只有已由不透明礁体覆盖的像素可获得这一修正，不能推广到半透明地形或其他实体。正式裂隙与净化点未调用此入口时保持原路径。

### DEV三维舞台与冻结的边界奇观（DEC-152 / DEC-153 / DEC-154 / DEC-155）

`spatial-slices.html`两条呈现复用正式VisibilitySystem的半径、角度、混乱调制与查询。DEC-155起Stage显式使用开敞空洞视线网格：内部封闭VOID不阻断射线，但仍不可通行；真实墙、外部VOID和越界继续阻断。Vista与未配置的正式场景保持默认不透明VOID。两者的数据布局相同，但视线政策不再相同，试验记录须标注`sightPolicy`，不能继续当作只有显示差异的A/B。三维舞台仅从当前可见的真实地表积累地貌视觉记忆；空气不记录地貌记忆。缓存不写入正式感知，敌人和拾获仍由当前权威可见性控制；新开局或销毁舞台时清空。

冻结正俯视的深处景观只从**与地图外缘连通的VOID**展露：可见外岸建立该外部远景的可见性，再随玩家距离衰减。内部封闭VOID保持不存在/无法探知，不显示深层地貌、水、巨物或反射，最终世界层用不透明未知面收口。Stage则把该内部缺口定义为无底的开敞空洞：有限视线可以穿过空气，看见范围内、没有实体墙挡住的另一岸；地面拓扑、真实XY碰撞与危险判定保持原规则。此合同仅属于开发样板，未迁移正式裂隙的镜头或探索策略。

Stage地层断面的感知约束：仅真实FLOOR/VOID边界可生成下沉断面；顶端以地形高度场为准，地面可见性/记忆沿岸内FLOOR的固定锚点向下继承，不能在下方投影处重新当作地面探知。从未看见的岸边不生成可见侧壁，已知地层向深处失去细节并终止，无底盖、无内部内容；不凭三维深度扩展敌人/拾获可见性。DEC-155不扩大原224px前向/80px环身范围或改变混乱调制，因此正南岸至正北岸约250px仍可能超距，不能用保证看全对岸作为验收条件。

海体显露有两个互补依据：当前有限视线在连续高度参考上的投影（包括没有地面的空气），以及已通过显隐裁切的不透明场景深度对下降岩壁的投影补偿。无不透明深度不等于无视野，不能据此关闭空洞上方的操作显露。RGBA场的R为当前视线，G为真实地貌记忆，B为物理地表成员关系；空洞G/B恒0，转身后随当前R收回显露，不永久掏海。高度参考用于投影查询，不渲染空洞底面、不写物理深度。这些离屏数据不反向扩大逻辑感知或写入持久化。

`RiftDevFixture.createSightGrid(layout, physicalGrid)`仅覆盖视线依赖；默认返回/使用原物理TileGrid。Stage玩家、AI与视线型目标检查共享该OccluderGrid；行走、路径平滑、身体净空、位移落点及推退扫掠必须继续读取真实WalkGrid。看到另一岸不等于可以直走、跨洞冲刺或把目标推出无地面。每次场景重新创建独立网格，切换回Vista不继承Stage视线政策。

## 边界情况

| 情况 | 处理方式 |
| ---- | -------- |
| 玩家紧贴墙壁，射线命中距离趋近 0 | 命中距离下限钳制为 4 px，保证多边形非退化；`minSolidRadius` 内的可见性不受影响 |
| 玩家被卡进墙内（地图数据错误 / 传送） | 视野退化为 `minSolidRadius` 的实心圆，不崩溃；开发模式下打印一次告警 |
| 1 tile 宽通道 | `BODY_SIZE=20 < 32`，可通行；两侧各 6 px 余量 |
| 射线穿过两墙的对角接缝 | 判定为命中（规则 14），不允许视线泄漏 |
| 射程被混乱值缩到极小 | `radiusScale` 钳制在 0.4；且 `minSolidRadius` 不参与缩放，玩家永远能看见脚下 |
| 视野射程 < `minSolidRadius` + 2 × 边缘带宽 | 带宽按 `(R - minSolidRadius)/2` 自动收窄（规则 15 的 clamp），不出现负宽度或分层翻转。环身圈 80 px 即走这条分支：带宽 16 px，全亮核心 48 px |
| 帧率骤降 | 按规则 21 两级降级；降级状态在 debug overlay 可见，避免"悄悄变糊"被误判为美术问题 |
| 相机移动导致遮罩边缘露出场景 | 遮罩尺寸 = viewport + 2 tile 外扩，且每帧跟随相机 |
| 场景切换 / shutdown | `destroy()` 释放 RenderTexture、噪点纹理、glow source 注册表，解绑相机事件（架构风险表：Phaser 场景切换内存泄漏） |
| 玩家死亡 | 输入禁用（`setInputEnabled(false)`）；视野是否收黑由 T4 死亡表现定义，本系统只保证接口可用 |
| 净化点 DOM 面板打开 | 输入禁用；视野继续每帧更新（画面不冻结），命中静止缓存后开销接近 0 |
| 斜向输入同时按下相反键（A+D） | 该轴输入判为 0；朝向保持上一次有效值 |

---

## 与已有系统的接口

### 从其他系统接收

| 来源 | 接收什么 | 形式 |
| ---- | -------- | ---- |
| 固定裂隙地图 / TilemapRenderer（T6） | `OccluderGrid`（哪些 tile 遮挡视线 + version 计数） | 场景创建时注入 |
| 场景层（RiftScene / PurificationScene） | `VisionConfig`、每帧的玩家位姿、混乱值调制值 | 直接调用 |
| 输入（Phaser Keyboard） | WASD / 方向键 | Player 内部读取 |

### 向其他系统提供

| 消费方 | 提供什么 | 形式 |
| ------ | -------- | ---- |
| 敌人 AI（T2/T7） | `utils/grid-raycast` 的 `hasLineOfSight()`——敌人判断"能不能看到玩家"用同一套遮挡规则 | import 纯函数工具 |
| 敌人 AI / 渲染层 | `Player.getPosition()`、`getVisibilityAt(enemyPos)`（决定敌人 sprite 是否绘制及其 alpha） | 同步查询 |
| 混乱值系统（T3，经场景层） | `setRadiusScale` / `setEdgeCorruption` / `setScreenFlicker` / `Player.setSpeedModifier('chaos', m)` | setter |
| 战斗系统（T4/T8） | `Player.getPosition()` / `getFacingAngle()`（近战挥击的方向与判定原点） | 同步查询 |
| 搜刮 / 撤离（T3/T9） | `registerGlowSource()`（撤离点）、`isPointVisible()`（薪柴是否渲染） | 调用 / 查询 |
| 裂隙小地图（经场景层） | 当前可见性查询；已见集合由场景层用既有 `isPointVisible` / `getVisibilityAt` 累积后写入小地图。玩家朝向走 `Player.getFacingAngle()` / `getFacing4()` | 场景翻译。小地图不 import VisibilitySystem。不新增「已见格子」只读接口 |

### 为什么不用事件总线

架构规定"不允许系统 A 直接 import 并调用系统 B 的方法"。本系统对此的处理：

1. **敌人 AI 不调用 VisibilitySystem**。共享的射线能力下沉为 `src/utils/grid-raycast.ts` —— 一个无状态纯函数工具（与 `utils/math.ts` 同级），任何系统都可 import，不构成系统间耦合，也避免 DDA 逻辑写两遍。
2. **ChaosSystem 不调用 VisibilitySystem**。ChaosSystem 只 `emit` 既有事件（`CHAOS_CHANGED` / `CHAOS_THRESHOLD_REACHED`）；**由场景层监听并把调制值转发给 VisibilitySystem 和 Player**。场景是系统的拥有者与编排层，这条路径不违反解耦规则，且让"混乱值→视野"的映射集中在一处可读可调。
3. **视野本身不 emit 事件**。视野是每帧连续量，走事件总线只会制造每帧 60 次的同步 emit。对外一律用同步查询 API。
4. **本 slice 不建议新增任何事件**。`src/types/events.ts` 现有事件已足够覆盖本系统的所有交互路径。
5. **小地图不调用 VisibilitySystem。** 已探索集合由场景层每帧用既有同步查询累积，再写入小地图。这与混乱值调制同一条编排路径，不构成系统互 import。

---

## 对已有系统的影响

| 对象 | 影响 |
| ---- | ---- |
| `src/config/constants.ts` | ✅ **已于 2026-07-29（T5）执行**：`VISIBILITY` 段整段替换为本 spec 的双射程 + 三级固定带宽参数集（`BASE_RADIUS` / `EDGE_SOFTNESS` 已删除，不存在两套并存）；`RAY_COUNT: 60` 保留；`PLAYER.SPEED: 160` 保留并补入本 spec 的移动参数；新增 `CAMERA.ZOOM: 1.5`（DEC-009） |
| `architecture.md` 模块注册表 | ✅ **已于 2026-07-29（T5/T6）执行**：登记 `VisibilitySystem`（已实现）、`Player`、`TilemapRenderer`、`TileGrid`、`GridRaycast` |
| `RiftScene` / `PurificationScene` | 两者都需持有 Player + VisibilitySystem 实例，并各自提供 `VisionConfig` 与 `OccluderGrid`；RiftScene 额外承担混乱值调制的事件转发 |
| `system-enemy-ai`（T2） | 敌人视线判定应直接使用 `utils/grid-raycast.hasLineOfSight()`，不要另写遮挡逻辑；其 `SIGHT_RANGE` 应保持 < `VISION_RADIUS_FORWARD` |
| `system-chaos-scavenge-extract`（T3） | 惩罚的视觉部分应表达为本 spec 的三个调制器取值，而不是自行改视野内部字段。裂隙小地图已探索集合经场景层消费既有可见性查询（规则 25），本系统不扩 `VisibilitySystemAPI` |
| `system-combat`（T4） | 共享 Player 实体；HP/攻击字段由 T4 追加，不得改动本 spec 拥有的移动字段语义 |
| 事件契约 | 无变更 |

---

## 验证标准

**本 Slice 结束时能验证：**

- 有限视野是否真的制造"信息不足带来的紧绷"，而不是"看不清带来的烦躁"。
- "转身观察"是否成为玩家主动、有意识、有成本的操作（支柱 1 的核心动作）。
- 移动是否精确到足以支撑贴墙绕行、卡视线角、走窄缝这些潜行基本动作。

**预期正面结果：**

- 玩家会**主动停下来转圈扫视**——这说明视野不足带来了信息需求。
- 玩家会**沿墙走**而不是走开阔中央——这说明黑暗被读作威胁。
- 玩家在撤离途中会**回头看**——这说明"背后 2.5 tile"的设定生效了。
- 移动 60 帧稳定，raycasting < 2 ms/帧，静止时接近 0。

**不 work 的信号：**

| 现象 | 指向的问题 | 调参方向 |
| ---- | ---------- | -------- |
| 玩家无脑直线冲刺，从不转身 | 视野太大 / 锥太宽，黑暗没有威胁 | 降 `VISION_RADIUS_FORWARD`、收窄 `CONE_HALF_ANGLE` |
| 玩家频繁迷路、反复走回头路、表达烦躁 | 视野太小或环身圈太小 | 升 `VISION_RADIUS_AMBIENT`，或给撤离点更强的发光泄露 |
| 玩家抱怨"转身太黏"或"走过头了" | `FACING_TURN_RATE` 太低 / `MOVE_DECEL_TIME` 太高 | 分别调这两项 |
| 视野边缘出现明显折线扇形 | 光线数不足或分配不当 | 检查是否已降级；调整 `VISION_RAY_SPLIT` |
| 三级 alpha 呈现明显"同心圆色带" | 分级过硬，像素风下带状感重 | 已由 DEC-107 的 32 层等照线带取代 dither 假设 |
| 黑暗区被读作"没加载完" | 噪点太弱 | 升 `VOID_NOISE_ALPHA` |

---

## 待验证假设

- [x] **键盘朝向（非鼠标瞄准）足以表达"主动观察"** —— 若试玩发现观察行为不自然，备选是"按住 Shift 锁定朝向平移"，而不是改成鼠标瞄准。**（2026-08-28 回填：Slice 1 试玩 PASS，紧绷决策手感成立，未出现改鼠标瞄准的需求；备选方案未启用，仍留作后路。）**
- [x] **前向 224 px / 环身 80 px 是紧张与可玩的平衡点** —— 与敌人 `SIGHT_RANGE=180` 的比值（1.24）是潜行博弈是否成立的关键，需与 T2 一起校准。**（2026-08-28 回填：Slice 1 试玩 PASS。试玩调校动的是移速（160→80，DEC-024）与导航辅助，本组视野数值未动；潜行博弈在该比值下成立。）**
- [x] **三级硬分层 alpha 在像素风下不会显得带状感过重** —— 若过重，最小代价方案是在带边界加 1-2 px 的 dither 抖动，而不是改为连续渐变（连续渐变与 art §7.1 的"3 级"冲突）。**（2026-08-29 人终审直接回答：人选了连续等照线带。dither 是最小代价时代的答案，随 bands 分支下线被 32 层等照线带取代，DEC-107。查询仍返回三档。）**
- [ ] **60 条光线（前向 4°/条）的多边形边缘 faceting 不可见** —— 若可见，备选是改用 Red Blob 式墙角端点射线（架构 DEC-ARCH-004 提到的参考实现），光线数可变但通常更少。**（2026-08-28 回填：仍未知。无实测记录；降级路径（60→40）存在，但未见人眼对 faceting 的结论。）**
- [x] **加速 0.08s / 减速 0.10s 提供"重量感"而不牺牲精确度** —— 潜行游戏对精确落位敏感，若窄通道操作受挫，优先降 `MOVE_DECEL_TIME` 到 0。**（2026-08-28 回填：Slice 1 试玩 PASS。移速本身被调校为 80 px/s（DEC-024），加减速时间未改并通过试玩。）**
- [x] **撤离点作为唯一发光泄露源足以支撑导航** —— 若玩家仍频繁迷路，下一步是给撤离点加方向指示而不是放宽薪柴的可见性（保住搜刮的信息博弈）。**（2026-08-28 回填：Slice 1 试玩回答为**不成立**，已按本 spec 预案处置——撤离点发光泄露 12→48 px、alpha 0.15→0.25（DEC-024），并加 Trail 走过留痕 / 地标 decal / 战争迷雾小地图 / 噪点近撤离加速；薪柴可见性未放宽。）**
- [x] **`ERASE` 混合的三层遮罩在 WebGL/Canvas 两种渲染后端下表现一致** —— 2026-07-29（T5）实测：`RenderTexture.fill` + 三次 `erase` 在 WebGL 下正确产出 0.20/0.60/1.00 三级可见度。**Canvas 后端未实测**（`Phaser.AUTO` 在所有目标浏览器上都会选 WebGL），若将来需要支持 Canvas 后端需回头验证。实现时踩到的坑：`RenderTexture.draw()` 的 `alpha` 参数对 Game Object 入参无效（只对贴图 key 生效），噪点层的强度必须设在 sprite 自身上。

---

## ⚠️ 待确认 / escalate（需人或对应 agent 拍板，本 spec 未擅自改动相关文档）

> **决策落定（2026-07-26，人拍板 + Director 分流）：**
> - **朝向（下方无编号的 A/B）**：键盘方案，否决鼠标手电筒 → **DEC-008**。
> - **项 3（视口/缩放）**：`camera.setZoom(1.5)` 对齐美术 ~20 tile 视口，code agent 在 T5 实现 → **DEC-009**。
> - **项 1/2/4（art §7.1 自相矛盾 + 与 §4.3 冲突 + 全黑起点）**：art agent 已改写完成（2026-07-26）——art-direction §7.1/§4.3/§3.1 已统一为本模型（alpha 1.0/0.6/0.2、固定 1 tile 带宽、全黑起点 = 满射程、视口按 `setZoom(1.5)` ≈ 20×13 tile）。
> - **项 5（混乱值溢出 >100%）**：留给 **T3** 拍板；本 spec 调制器接口对两种方案都兼容。
> - **项 6（constants `VISIBILITY` 段替换）**：code agent 在 **T5** 执行。
> - **项 7（混乱值调制经场景层转发）**：Director 确认**保持**，不改 architecture.md。

以下为原始 escalate 记录（保留供追溯）：

1. **art-direction §7.1 与 §4.3 的边缘渐变互相矛盾。**
   - §7.1：3 级 alpha = 100% / 60% / 20%，带边界按视野半径百分比（90% / 70% / 50%），且"50% 以外全黑"。
   - §4.3：3 级 alpha = 100% / 80% / 40% / 0%，每带固定 1 tile 宽。
   - 两处的 alpha 值与几何模型都不同。**本 spec 采纳：alpha 用 §7.1、几何用 §4.3（固定 1 tile 带宽 + 贴身全亮半径）**，理由见"边缘渐变的推导"。副作用：全亮核心为射程的 0.71（§7.1 字面为 0.50），画面比 §7.1 更"清晰"一档。→ **请 art agent 确认这个取舍并把两节改写一致；若要更雾，调 `VISION_EDGE_BAND_WIDTH` 而非改回百分比模型。**

2. **art-direction §7.1 自身的表述有内部矛盾。** "内圈（视野半径 100%→90%）：完全可见"把最外侧的一圈标为"内圈/完全可见"，同时又说"50% 以外：全黑"——若按字面执行，视野的可见范围只有半径的一半，且与 70%/90% 两带互斥。本 spec 按"由内向外递减"的唯一合理读法重建。→ **同上，请 art agent 回写。**

3. **视口 / 缩放不一致，会直接改变视野的"占屏比"。**
   - art §3.1：viewport ≈ 20×15 tile（640×480 逻辑像素，2x 渲染）。
   - `src/config/game-config.ts`：960×640，未设置 camera zoom ⇒ 实际 30×20 tile。
   - 同一个 224 px 视野半径，在前者占屏宽的 70%，在后者只占 47%——手感完全不同。→ **需 code agent 与 art agent 对齐**（建议 `camera.setZoom(1.5)`，得到 640×427 逻辑像素 ≈ 20×13 tile，与 art §3.1 基本吻合）。本 spec 的建议初值按 art §3.1 的 20×15 tile 视口给出。

4. **"全黑起点"取 1.0 R 还是 0.9 R。** §7.1 字面为 0.9 R（射程的最后 10% 也是全黑）。本 spec 取 1.0 R（射程外沿即全黑起点）：一是再挖掉 10% 会把环身圈压到 72 px（2.25 tile），贴着 art §5.1「照亮周围 2-3 tile」的下限；二是"射程"若不等于玩家实际看到的距离，调参时极易算错（每个数都要先乘 0.9）。→ 随第 1 项一并请 art agent 确认。

5. **art §7.2 的"超阈值 >100%"在现有数值下不可达。** `constants.ts` 中 `CHAOS.MAX_VALUE = 100`，混乱值无法超过 100%，因此 art 定义的第四档视觉（持续缩视野 + teal 渗透 + 全屏微闪）永远触发不了。→ **需 T3 拍板**：允许混乱值溢出 100，还是把"超阈值"重定义为"达到 100"。本 spec 的调制器接口对两种方案都兼容。

6. **`constants.ts` 的 `VISIBILITY` 段需要替换而非扩充。** 现有 `BASE_RADIUS: 200` / `EDGE_SOFTNESS: 20` 建模的是"单一半径 + 软边宽度"，与本 spec 的双射程 + 三级带宽模型不兼容。→ **由 code agent 在 T5 执行替换**，此处只是提示不要两套参数并存。

7. **"混乱值调制经场景层转发"这一约定需 Director/Code 确认。** 它是为了不违反架构"系统间禁止直接调用"而选的路径，代价是 RiftScene 多承担一段编排代码。若认为场景层过重，替代方案是在架构层承认"服务型系统（VisibilitySystem / Pathfinding）可被直接调用"的例外——那需要修改 `architecture.md`，超出本 spec 权限。
