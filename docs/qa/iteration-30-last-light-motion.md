# I30 Last Light · 阴影、外景与步态修复

2026-09-27 · IMPLEMENTED / LIMITED-VERIFIED。主 COH-F042，关联 F006/F026/F039。e05e9a8 入游戏后用户明确否定阴影、外景与行走表现；本轮是整改，不沿用旧功能检查代签画质通过。人审仍 HUMAN-CHANGES-REQUESTED。

## 根因与处理

- **阴影**：旧肩灯每 4×4 原生像素只取一次二值遮挡，且低频刷新；跨坡面、柱脚的格子共享错误采样，出现大方块。已替换为同源 52328 个不透明三角形的 GPU 径向深度：肩灯 512px 六面图随灯位更新，33 个固定发射点使用 192px 六面数组，逐像素 PCF 与接收平面校正。人物投影从竖直柱体改为当前姿态的 11 段圆头关节近似；固定灯对人物逐像素遮挡。背光面也阻断镜面项，避免阴面错误亮斑。
- **外景**：旧近景以屏幕横坐标改变位移，同一根梁两端移动不同，连接被拉开；颜色板随动，而光场/侵蚀留在原坐标；坡面高度也牵动外建筑。现固定近处接根，中/远层根据世界 XZ 以 140ms 平滑产生最多 3.5/6 原生像素的连续偏移。每层颜色、法线、光场、侵蚀与深度统一坐标。远建筑按真实转面和距离恢复暗部差别，空背景、近构件和既有平台底色不被整体提亮。
- **步态**：旧动画按时间摆腿，而位移以屏幕定速换算，纵深方向实际达到奔跑速度。现净化点统一 1.8m/s 世界 XZ 基础步速，以真实路程推进 1.05m 步周期；双骨腿部保持长度，支撑脚后送抵消根运动，摆脚抬膝落地，停下时分两阶段收脚。八向 12 帧行走、24 帧收步，加站/坐共 312 帧。起身的座位→站位锚点切换不计入路程。

A 的建筑、裂隙 52% 收口、静态材质和两层路线保持；Rift 原人物呈现及速度保持。静态场景、人物、外景字段分别登记导出来源，不冒充整景重烘焙。

## 自动与独立检查

- `npm run build` 通过；保留既有大 chunk 提示，不代表跨设备性能验收。
- `node tools/last-light/check-assets.mjs`：33 光源、7 核心/3 裂隙发射点、312 帧及每帧 11 段 rig、全资源与分组来源哈希通过。[记录](artifacts/last-light-motion/assets.json)
- `node --import tsx tools/last-light/check-gait.ts`：1440 个支撑脚样点、骨长、连续支持、停止不滑动、帧率无关、真实 1.15m 起身锚点切换、八向 rig 通过。[记录](artifacts/last-light-motion/gait.txt)
- `node --import tsx tools/last-light/check-movement.ts`：8 组通过，含六站/坐点可达、西坡与断桥往返、断口/跨层拒绝、各输入轴与坡面世界步速一致。[记录](artifacts/last-light-motion/movement.json)
- `node --import tsx tools/last-light/exterior-check.mjs`：近层零偏移、中远层有界连续、抬高人物不移动建筑、逐层字段覆盖通过；CPU 对照原点平台/近构件/空背景变动均为 0，42992 个远建筑像素恢复转面，远层平均约 +1.134 灰阶。[记录](artifacts/last-light-motion/exterior.json)
- `node tools/last-light/check-player.mjs`：共享输入/冻结、外部呈现责任、销毁重入与 Rift 默认呈现通过。独立代码审查检查一次步态更新、已旋转的灯位/骨架只加世界位置、深度坐标与新 GPU 资源销毁；审查发现的起身虚假迈步已修正并回归。

## 浏览器验证范围

[连续运动检查页](../art/demos/purification-motion-review/index.html)直接消费正式渲染器、正式资源、真实移动碰撞和步态代码，不写存档。拖动时间使用稳定观察站位，播放使用真实逐帧平滑；不能把它称为正式游戏键盘全程复走。

已实际编译并运行新 GPU 管线，观察坡脚、坡中、上层书架/设备、净化器、炉旁混合光、核心前后与外景左右极端站位。坡脚的 4×4 矩形误影不再出现；栏杆、墙柱、坡面保持连续遮挡；人物支撑、摆脚及停止落地可分别看见。坡道连续回放超过 23 秒，八向走停回放超过 30 秒。近层承接固定，中远层有小幅距离差，污染光随各自构件移动。

截图：[坡脚](artifacts/last-light-motion/ramp-foot.png)、[坡中](artifacts/last-light-motion/ramp-middle.png)、[上层](artifacts/last-light-motion/upper.png)、[净化器](artifacts/last-light-motion/purifier.png)、[炉旁](artifacts/last-light-motion/hearth.png)、[外景左侧](artifacts/last-light-motion/exterior-left.png)、[外景核心侧](artifacts/last-light-motion/exterior-core.png)、[脚步放大](artifacts/last-light-motion/step-detail.png)。开发验证页最初一个上层起点被正常足迹碰撞拒绝，已改为合法培养藏接近点并复验；此错误不来自正式游戏。

正式根页：主菜单继续→净化点、W 键短移与重新进入已验证，`lastLightRenderer=webgl2`，无 fallback 原因，warning/error 为空；本机短时样点约 120fps。[正式场景](artifacts/last-light-motion/game.png)。没有将短移冒充正式六站键盘复走。

## 限定边界

本轮未重新完成全部业务交易、坐下 UI、Rift 出击结算全链；对应旧功能证据保留在[生产 QA](iteration-30-last-light-production.md)。起身状态衔接由新增专项检查覆盖。人物投影仍是关节胶囊近似，行走是八向离散像素帧，未引入连续斜坡足踝 IK；不能称完整实时人物网格阴影。Canvas 路径仍是明确降级，未强制失效实机验收。

外景字段 atlas 4096×4928，单份解码/GPU RGBA 约 80.7MB；当前机器运行正常，不据此声称移动设备或长期内存压力通过。整体美术仍待用户复看；I28 暂停与其他未验边界不解除。本地提交按持续授权执行，不推送，独立 CLAUDE.md 修改排除。
