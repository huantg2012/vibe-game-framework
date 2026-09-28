# I30 Last Light · 角色步态修复

2026-09-28 · 全身步态接续修复 IMPLEMENTED / LOCAL-VERIFIED。主 COH-F039，关联 F006。用户评价 `3cd4372` “好多了”，授权继续修正全身步态；这不是对动作自然度的最终验收。此前 `3f4efc3` 静息/斜向问题已解决的确认保持。

## 当前接续：全身动作与摆腿时序

本轮审查确认仍有三处结构性问题：胸、头和背包作为整体刚体，躯干前倾4.297°全周期固定；脚离地后膝反而先伸直（步相0.56屈膝约25.5°，0.60降至14.5°，到0.75才屈至62.8°）；骨盆可达高度同时读取两腿，摆动脚也牵动身体。此前支撑腿与接地检查通过，没有证明全身动作协调或摆腿时序自然。

当前实现以contact/down/passing/up关键姿态组织身体承重高度，只由接地腿限制身体可达性；摆动脚自行适应身体，离地后先收膝、小腿随后送脚，末摆保留屈膝余量并连续接回落地。髋胸反向微转和承重侧移、稳定头部、背包微滞后及固定骨长的关节摆臂分别处理，模型、rig、灯锚消费同一姿态。保留1.25m完整周期、1.8m/s世界XZ步速、12行走帧、15朝向/1035帧架构、独立idle及停止归位。

本轮检查与烘焙：

- 新增 `check-whole-body-gait` 2400相位通过：髋yaw全幅8.02°、胸7.40°，反向相关−0.98024；平均单支撑侧移25.17mm、胸俯仰变化2.86°。早摆前三分之一屈膝约73.3°，峰值78.9°；末摆腿超伸已修正，接地接缝最大差4.08×10⁻⁷m。摆脚抬升峰约0.080m；见[全身检查](artifacts/last-light-actor/whole-body/kinematics.json)。
- 原 `check-lateral-gait` 12000相位仍通过，支撑平均屈膝24.20°、中支撑18.90°、有效后支撑42.38%，接点锁定、骨长、不穿地等约束保持；见[接地检查](artifacts/last-light-actor/whole-body/contact-check.json)。
- 人物模型对照：120个idle和15个sit几何/灯/rig保持原样，180收步终点与idle等价，17280个手套点保持刚体、192个臂rig姿态和48个实际光源与灯锚一致；见[模型检查](artifacts/last-light-actor/whole-body/model-check.json)。
- `gait`、`lateral-gait`、`whole-body-gait`、`assets`、`facing`、`movement`、Player呈现责任检查、类型检查及生产构建通过；`actors-only`已重新导出1035帧，22张非人物静态PNG的SHA全部与`3cd4372`一致。上述结果验证结构、时序和同源一致性，不代签整体美术或自然度。

正式Renderer新实景左右各30帧、每向2.6m两个完整周期及停止归位已复看；四斜向各6个连续样点，共24帧均为walk，idle 2秒姿态确认。复现页控制台warning/error为空。证据：[左右动画](artifacts/last-light-actor/whole-body/left-right.webp)、[四斜向连续动画](artifacts/last-light-actor/whole-body/diagonal.webp)、[同帧状态](artifacts/last-light-actor/whole-body/states.json)、[静息](artifacts/last-light-actor/whole-body/idle.png)。

正式根页最新版新开→继续存档，使用WebGL2；A短键使世界脚点从(3.8, 0, 3.8)变为(3.787394, 0, 3.807984)，松手站稳，控制台warning/error为空。D短按无位移，不计正式页右走验证；完整左右步周期仅由正式Renderer复现页覆盖。证据：[正式静息](artifacts/last-light-actor/whole-body/game-idle.png)、[正式短输入状态](artifacts/last-light-actor/whole-body/game-smoke.json)。整体动作审美仍待用户复看。

## 3cd4372 横向承重修复（历史）

该版获得“好多了”的反馈，以下数值、图集与实帧为当时限定结果；不证明本轮全身动作已完成或通过。

进一步审查发现，旧踝点本来就有约半周期位于骨盆后方；问题不是整条足迹前置。旧IK把靴筒口0.203m当作踝关节，固定骨盆高度与前弯膝解叠加，支撑期平均屈膝54.37°、膝83.9%的时间在骨盆前方，造成持续半蹲、腿被推到身前的读法。1.05m完整周期在1.8m/s下还达到约206步/分钟。此前停步/斜向定点检查未审足横向承重关系；不能通过后移整条脚轨迹掩盖这个结构问题。

`3cd4372`将完整周期改为1.25m、单脚支撑占比0.56，世界XZ步速仍1.8m/s，步频降至172.8步/分钟；踝点回到0.13m，靴子作刚体后跟着地（+0.16rad）/脚趾离地（−0.34rad）滚动。骨盆高度由两腿实际可达长度求解，约0.7006–0.7696m，躯干轻前倾0.075rad；模型、rig与灯锚共用同源变换。腿骨长度保持，脚轨迹不整体后移。

独立12000相位采样的新支撑期平均屈膝21.22°、中支撑14.52°，有效后支撑41.35%（膝在骨盆后至少0.01m）；旧版对照分别为54.37°、60.50°、9.58%，步频205.71→172.8步/分钟。旧版确实无法通过新增约束，防止检查再次把错误姿态当预期。数学检查说明结构和接地约束满足，不代签整体美术；最终1035帧方向布局、四阶段停止归位和独立idle机制保持。

`3cd4372`自动检查与烘焙已完成：

- `check-gait`：1346个支撑脚、1212个收步样点通过。
- 新增 `check-lateral-gait`：12000相位、24000条腿、13438对接地接点及2424个收步检查通过，覆盖支撑腿伸展、有效后支撑、落跟→全脚→离趾、接点世界锁定、不穿地、固定骨长与可达性；见[量化结果](artifacts/last-light-actor/lateral/kinematics.json)。
- `check-assets`：15朝向/1035帧、180组收步→idle端点的六图、rig、灯锚相等；22张非人物静态PNG的SHA与本轮前保持一致。
- `check-facing`：16组真实输入与1035帧；`check-movement` 8方向；共享Player呈现责任检查、类型检查及生产构建通过。

正式Renderer复现页实际复看左右各30帧，每向行走2.6m、覆盖两个完整周期及停止归位；四斜向仅做定点视觉回归，idle 2秒姿态已核对。复现页控制台warning/error为空。证据：[左右连续动画](artifacts/last-light-actor/lateral/left-right.webp)、[同帧状态](artifacts/last-light-actor/lateral/states.json)、[SE](artifacts/last-light-actor/lateral/se.png)、[NW](artifacts/last-light-actor/lateral/nw.png)、[SW](artifacts/last-light-actor/lateral/sw.png)、[NE](artifacts/last-light-actor/lateral/ne.png)。本轮不沿用历史四斜向连续回放作为新版本验证范围。

正式根页最新版刷新→继续存档，WebGL2；A短键使世界脚点从(3.8, 0, 3.8)变为(3.774407, 0, 3.816209)，松手后静息站稳，控制台warning/error为空。工具D短按未覆盖移动帧、位置未变，不能算正式页右走验证；两向完整循环范围只归上述正式Renderer复现页。证据：[正式静息](artifacts/last-light-actor/lateral/game-idle.png)、[正式短输入状态](artifacts/last-light-actor/lateral/game-smoke.json)。独立最终代码只读审查未发现确定缺陷，确认模型/靴子/rig/灯锚同源，idle/sit保持；整体动作审美仍待用户复看。

以下是此前静息/斜向修复的根因、仍有效合同和 `3f4efc3` 验证范围，不能当作本次承重改动已通过。

## 已确认根因

1. 旧收步只让悬空脚落地，状态机随后一直返回 `walk`，从未进入独立静息；回归检查甚至把这个错误状态作为预期。不是简单增加待机帧数量就能修复。
2. 输入是屏幕八向，旧图集却按世界 yaw 每45°烘焙。斜相机压缩了纵深，屏幕斜走实际方向与被选人物朝向相差最多约23.15°（水平面）；S/SE及N/NW还会选中相同朝向。坡面又有不同的逆投影，复用水平面八向仍会偏离。此前按世界等分方向回放未覆盖这一真实输入错误。

## 保持项与当前合同

- 真实位移驱动1.25m完整步周期，12行走相位；单脚支撑占比0.56，摆脚抬升峰约0.080m（不含靴子滚动造成的端点高度）。踝、关键姿态承重、接地腿可达约束和刚体靴滚动负责实际承重，不能仅以足迹前后比例代替腿部姿态审查。
- 停止后0.44秒四阶段，依次抬脚归位并保持另一脚支撑；随后明确进入8帧、3.2秒的独立静息呼吸。最后收步与静息0帧共用姿态，身体、灯锚与11胶囊投影同步。
- 图集按真实相机及水平面/西坡逆投影屏幕八向，去重为14个移动朝向，另加入精确坐姿朝向，共15列；8静息、12行走、48收步、1坐姿构成1035帧/960×5520。
- 根场景、A布局、素材画法、静态灯影/外景、碰撞路线、1.8m/s XZ世界步速、六站业务及Rift原人物保持。人物资源独立重烘焙，不冒称整景重导。

## 3f4efc3 自动验证（历史）

- `actors-only` 完成15朝向、1035帧人物图集；`node tools/last-light/check-assets.mjs` 通过，180组收步端点与idle 0的六张图像、rig和灯锚相等。22张静态PNG的SHA保持不变，`manifest.source`与`checksums.sources`和HEAD完全一致，未重写旧静态制作来源；见[导出检查](artifacts/last-light-actor/export-check.json)。
- `node --import tsx tools/last-light/check-gait.ts` 通过1442个支撑脚样点和1212个收步样点，覆盖返回idle、逐脚归位、静息循环、帧率无关及起身锚点切换等约束。
- `node --import tsx tools/last-light/check-facing.ts` 通过16组真实屏幕输入及1035个图集帧朝向检查；水平面和坡面分别反解实际相机，未再用世界等分方向冒充屏幕方向。
- `check-movement.ts` 8组、`check-player.mjs`、`npm run build`及`git diff --check`通过；构建仅有既有大chunk提示，不据此推定跨设备性能。独立最终代码审查未发现阻断项。

## 3f4efc3 浏览器限定验证（历史）

Chrome内的[动态复现页](../art/demos/purification-motion-review/index.html)使用正式Renderer、正式素材及真实step/gait，不写存档。走停片段0.96–2.64秒共36帧：约1.3秒停下后世界位置保持固定，1.824秒已进入idle 0，2.4秒进入idle 1；另复看2.0秒idle 0和4.4秒idle 6，均为双脚收拢的静息姿势。四个真实屏幕斜向SE/NW/SW/NE各检查12连续帧，48张中47张为行走、1张刚停；四组拼成12帧对照动画，并复看坡道3.2秒姿态。

证据：[走停→静息动画](artifacts/last-light-actor/stop-idle.webp)、[四斜向动画](artifacts/last-light-actor/diagonal.webp)、[同帧恢复状态](artifacts/last-light-actor/recovery-states.json)、[同帧斜向状态](artifacts/last-light-actor/diagonal-states.json)。静帧补充：[行走](artifacts/last-light-actor/walk.png)、[归位](artifacts/last-light-actor/gather.png)、[静息](artifacts/last-light-actor/idle.png)、[呼吸](artifacts/last-light-actor/breath.png)、[坡面](artifacts/last-light-actor/ramp.png)。这是实际渲染输出的限定复核，不代签用户对动作自然度的认可。

正式根页刷新→继续存档→W/A短键移动→松手后站稳，使用WebGL2，控制台warning/error为空；见[正式静息画面](artifacts/last-light-actor/game-idle.png)。本轮没有执行完整六站业务或场景关闭后的再次重入，不把根页刷新继续当重入生命周期回归。

## 限定边界

`3f4efc3`静息/斜向已获确认，`3cd4372`横向承重获“好多了”但未验收自然度。本轮全身动作完成新图集、自动检查及正式Renderer限定动态复核，正式根页仅确认新开继续、A短键真实移动与松手站稳；不继承历史数学、图集或短键结果，整体美术待用户复看。不得复用上一轮“八向连续30秒”作为本轮通过证据。人物仍为离散像素图集，阴影是胶囊近似，未实现连续斜坡足踝IK；无WebGL2降级实机、所有武器/受击、六站交易、坐下UI、场景重入/Rift全流程及长期体验不在本次范围。I28挂起不变。
