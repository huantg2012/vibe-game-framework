# 净化点裂隙与交互整改 · 2026-09-30

COH-F042 / F026，关联 F006 / F003。**IMPLEMENTED / LOCAL-VERIFIED；局部美术待用户复看。** 本轮沿用 Last Light 的可编辑几何、材质和像素采样，正式根游戏已更新。

## 改动与原因

旧裂隙收窄后仍是两条亮边夹住竖直暗面，与建筑接合不易读懂，也容易挡住角色。现在从左前完整地坪撕出狭长开口，穿过楼板与下方建筑；调整镜头夹角，显露错层内壁，外半部后岸断成几段，灰绿辐射分居不同深度。无竖立黑膜，开口仍窄，主核心保持最高光强。具体构造唯一维护在[美术方向](../art-direction.md#resume-art-rebuild)。

原交互是投影24px圆叠加“脚点到唯一approach的完整脚圆直线可达”。净化器侧面贴近时，这条线会穿过机器自己的底座，反而必须后退才能触发。现在六站与坐席统一按真实操作面及前半侧面测量1.4m世界距离，同层、实际高差及短路径完整脚圆仍校验。裂隙有显式操作阈边；不从对岸、背后或隔层触发。主目标有0.16m切换余量，提示和E同源；去掉模块第二次投影圆判断，起身镜头返回时不显示暂时不可执行的E提示。静止时复用资格，不改变步态或碰撞步进。

## 实尺视觉复核

- [之前](artifacts/last-light-rift-interaction/before.png) / [当前无人物烘焙参考](artifacts/last-light-rift-interaction/after.png)：同一960×640镜头，不能把无肩灯参考图冒充运行时截图。
- 首轮地坪裂口沿屏幕接近横向，且近岸遮挡下壁，仍读成横放石条；最终改相机夹角、削开外嘴近岸和错位断齿。
- 初始内喉发光线宽小于1原生像素，正式修为三段约1–2px折线，留黑间隙，未整体提亮建筑。
- [最终运行时截图](artifacts/last-light-rift-interaction/runtime-rift.png)：运行时检查裂口操作面及肩灯照明，角色站在完整地坪，旧竖片不再挡住身体。全景依然克制，艺术判断不由几何/测试数字代签。

## 自动检查

以下日志为本轮实际执行结果：

- [interaction.json](artifacts/last-light-rift-interaction/interaction.json)：6组；7处旧approach兼容，73正面/129前侧站位，12合法背面站位拒绝，264连续接近采样；净化器贴脸与斜向圆角挤压、真实断口、楼层分离和候选滞回。
- [rift-throat.json](artifacts/last-light-rift-interaction/rift-throat.json)：实际几何无高竖膜、深断层/内喉能量、源模型与generated导航/阈边一致、6个缺口样点禁止站立、操作点合法、核心光强优先。
- [movement.json](artifacts/last-light-rift-interaction/movement.json)：10组原正式导航回归，包含六站/坐席、上下层、西坡13条全宽路径、A宽桥与裂口、屏幕输入和观察遮挡。
- [boundary.json](artifacts/last-light-rift-interaction/boundary.json)：7851帧；原外沿/坡边/设备圆角慢动作修复未回退，朝向误差0，步进安全与凹角不逆行。
- [assets.json](artifacts/last-light-rift-interaction/assets.json)、[exterior.json](artifacts/last-light-rift-interaction/exterior.json)：正式资源、来源哈希、深度/光场/图层一致通过；`export-layout --check`通过。
- [actor-preservation.json](artifacts/last-light-rift-interaction/actor-preservation.json)：六张角色图集与任务开始HEAD逐字节相同。
- `npm run build`通过（既有大chunk提示保留）；`git diff --check`通过。

运行顺序：`export-layout.mjs` → `export.mjs --scene-only` → `exterior-export.mjs --install`；TS脚本使用`node --import tsx`。首次exterior检查误用裸node导致未知.ts扩展，改为正确加载器后通过。

## 浏览器边界

[DEV验收页](interactive/last-light-interaction-review.html)使用真实gameConfig、PurificationScene、Player与SaveManager，只将存储后端换成本页Map。控件只能定位合法脚点，提示资格与E开启均走生产代码，无强制目标或面板替身。未清除、覆盖或放弃用户127.0.0.1正式记录。

已确认净化器原操作面、贴边圆角`(-2.398684584, 0, 1.037882015)`都有提示且真实E打开净化器；核心E打开修复，裂口新操作点E进入正式备行并正常离开。储藏/供奉/蜕变及坐席提示已逐项看到；其余站点业务开启未记通过，范围判定另有上述全部几何/连续采样覆盖。最终刷新后控制台warning/error为空。浏览器自动化短键存在未触发的尝试，没有把发送过按键当成功，也不把控件定位当自然行走路线。

本轮没有扩验交易/自然搜撤整趟/全部业务组合、跨GPU性能或整体美术终审。I28挂起、I31历史交付和其他未验边界保持。
