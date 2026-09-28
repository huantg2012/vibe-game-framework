# I30 Last Light · 角色静息与斜向步态修复

2026-09-28 · IMPLEMENTED / LIMITED-VERIFIED。主 COH-F039，关联 F006/F026/F042。基线 `eb0c527`；用户指出停步保留移动帧、斜向行走异常，本轮直接修复。人审仍 HUMAN-CHANGES-REQUESTED，不改变此前对场景画法和构图的认可。

## 已确认根因

1. 旧收步只让悬空脚落地，状态机随后一直返回 `walk`，从未进入独立静息；回归检查甚至把这个错误状态作为预期。不是简单增加待机帧数量就能修复。
2. 输入是屏幕八向，旧图集却按世界 yaw 每45°烘焙。斜相机压缩了纵深，屏幕斜走实际方向与被选人物朝向相差最多约23.15°（水平面）；S/SE及N/NW还会选中相同朝向。坡面又有不同的逆投影，复用水平面八向仍会偏离。此前按世界等分方向回放未覆盖这一真实输入错误。

## 当前修复合同

- 真实位移继续驱动1.05m完整步周期，12行走相位；降低摆脚最高抬升至0.105m。
- 停止后0.44秒四阶段，依次抬脚归位并保持另一脚支撑；随后明确进入8帧、3.2秒的独立静息呼吸。最后收步与静息0帧共用姿态，身体、灯锚与11胶囊投影同步。
- 图集按真实相机及水平面/西坡逆投影屏幕八向，去重为14个移动朝向，另加入精确坐姿朝向，共15列；8静息、12行走、48收步、1坐姿构成1035帧/960×5520。
- 根场景、A布局、素材画法、静态灯影/外景、碰撞路线、1.8m/s XZ世界步速、六站业务及Rift原人物保持。人物资源独立重烘焙，不冒称整景重导。

## 自动验证

- `actors-only` 完成15朝向、1035帧人物图集；`node tools/last-light/check-assets.mjs` 通过，180组收步端点与idle 0的六张图像、rig和灯锚相等。22张静态PNG的SHA保持不变，`manifest.source`与`checksums.sources`和HEAD完全一致，未重写旧静态制作来源；见[导出检查](artifacts/last-light-actor/export-check.json)。
- `node --import tsx tools/last-light/check-gait.ts` 通过1442个支撑脚样点和1212个收步样点，覆盖返回idle、逐脚归位、静息循环、帧率无关及起身锚点切换等约束。
- `node --import tsx tools/last-light/check-facing.ts` 通过16组真实屏幕输入及1035个图集帧朝向检查；水平面和坡面分别反解实际相机，未再用世界等分方向冒充屏幕方向。
- `check-movement.ts` 8组、`check-player.mjs`、`npm run build`及`git diff --check`通过；构建仅有既有大chunk提示，不据此推定跨设备性能。独立最终代码审查未发现阻断项。

## 浏览器限定验证

Chrome内的[动态复现页](../art/demos/purification-motion-review/index.html)使用正式Renderer、正式素材及真实step/gait，不写存档。走停片段0.96–2.64秒共36帧：约1.3秒停下后世界位置保持固定，1.824秒已进入idle 0，2.4秒进入idle 1；另复看2.0秒idle 0和4.4秒idle 6，均为双脚收拢的静息姿势。四个真实屏幕斜向SE/NW/SW/NE各检查12连续帧，48张中47张为行走、1张刚停；四组拼成12帧对照动画，并复看坡道3.2秒姿态。

证据：[走停→静息动画](artifacts/last-light-actor/stop-idle.webp)、[四斜向动画](artifacts/last-light-actor/diagonal.webp)、[同帧恢复状态](artifacts/last-light-actor/recovery-states.json)、[同帧斜向状态](artifacts/last-light-actor/diagonal-states.json)。静帧补充：[行走](artifacts/last-light-actor/walk.png)、[归位](artifacts/last-light-actor/gather.png)、[静息](artifacts/last-light-actor/idle.png)、[呼吸](artifacts/last-light-actor/breath.png)、[坡面](artifacts/last-light-actor/ramp.png)。这是实际渲染输出的限定复核，不代签用户对动作自然度的认可。

正式根页刷新→继续存档→W/A短键移动→松手后站稳，使用WebGL2，控制台warning/error为空；见[正式静息画面](artifacts/last-light-actor/game-idle.png)。本轮没有执行完整六站业务或场景关闭后的再次重入，不把根页刷新继续当重入生命周期回归。

## 限定边界

本轮实现、图集、上述自动检查与浏览器限定复核完成，整体美术仍待用户复看。不得复用上一轮“八向连续30秒”作为本轮通过证据。人物仍为离散像素图集，阴影是胶囊近似，未实现连续斜坡足踝IK；无WebGL2降级实机、所有武器/受击、六站交易、坐下UI、场景重入/Rift全流程及长期体验不在本次范围。I28挂起不变。
