---
status: DEV-CANDIDATES / LIMITED-VERIFIED / HUMAN-SELECTION-PENDING
date: 2026-10-16
feature: COH-F039
---

# Rift 玩家模型三版 · 有限验证

交付 [三版模型比较页](../art/previews/rift-player-models/index.html)：A 短摆工装、B 长襟行者、C 覆肩负重。形体合同及 art 逐卡短核见 [设计源](../art/rift-player-three-models.md)。这是实际模型烘焙的透明精灵、材质图集和动作样本，未切换正式 Rift。A 直接继承净化点母型，B/C 复用其骨架、头盔、靴与灯，仅更换衣装和包体结构。

## 已验证

- 四套（含净化点基准）各八朝向 × 13 姿态，共 416 帧。每套保留实际正面／灯侧／背面，64×80 画布、脚点 [32,66]，同一相机、身高和源步态。
- [资产机械检查](../art/previews/rift-player-models/assets/mechanical-check.json)：416 帧二值 alpha、各材质通道覆盖一致、无画布裁断；12 张三视确定性重烘；头部 482 个三角形、靴和灯与母型保持一致。中性站姿及四个步态相位核对骨架，不把脚锚元数据当完整动态接地证明。
- 轮廓差异 A/B、A/C、B/C 的三视最大差集占比分别 10.19%、10.61%、16.16%。它只排除换色或完全同形，不代替人的偏好。首轮 A/B 差异未达到预设 8% 检查，B 的薄包改为更贴背的结构后通过；没有放宽阈值。
- [浏览器检查](artifacts/rift-player-models-2026-10-16/browser-check.json)：九视图不被展示裁框截断；三套行走均有像素变化，停止后稳定站姿；材质、法线、剪影、背景、朝向控件有效。页面零报错、零失败请求。
- 晶化林床与吸光釉原使用现有材质截图中的地面截块，18 组原像素静态轮廓对比达到合同的非发光边缘明度差检查。先前截块碰到障碍/空洞，已改为目视确认的纯地面区域并复验。这里没有宣称动态照明或真实场景走位。
- 作者模型的独立 strict TypeScript 检查通过。本轮只新增作者工具、独立比较页和文档，未修改 `src/**`、正式资源或机制数据；不重复整款游戏构建。

## 灯与资产边界

`review` 是公开参数的统一检视照明，由原材质渲染器处理；`rgba` 保留原自肩灯低照度输出。albedo、normal、material、depth、contact 独立，未用 CSS 提亮或把环境颜色画进服装。图集包含可直接实例化的透明模型帧，正式角色控制器仍需在选型后适配视觉脚点与旧 32px 武器 rig。

本批只覆盖 idle 相位零与 12 帧行走，八个世界 yaw；不是正式净化点的完整 15 朝向、1035 状态集合。攻击、受击、死亡、收步、武器握持、Rift 遮挡/FOV/动态受光及游戏体验尚未接入或验证。比较页不能代替用户选卡。

## 重现与截图

```sh
node --import tsx tools/rift-player-models/export.mjs
node --import tsx tools/rift-player-models/check.mjs
node tools/qa/check-rift-player-model-review.mjs
```

浏览器脚本可用 `COH_PLAYWRIGHT_MODULE`、`COH_CHROME_PATH`、`COH_REVIEW_BASE_URL` 指定运行依赖和开发服务。

- [三版九视图](artifacts/rift-player-models-2026-10-16/three-models.png)
- [完整比较页](artifacts/rift-player-models-2026-10-16/review-page.png)
- [晶化林床材质背景](artifacts/rift-player-models-2026-10-16/crystal-context.png)
- [吸光釉原材质背景](artifacts/rift-player-models-2026-10-16/ivory-context.png)

I14/P49、既有场景美术与性能验收不由本任务升级。
