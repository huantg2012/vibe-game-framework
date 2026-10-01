# 开场 → 净化点：设计入口与历史探索

当前规格：[首页与净化点视觉连续性](../specs/art-opening-haven-continuity.md)。日期：2026-10-01。主关联 COH-F002 / COH-F005 / COH-F042。

**当前状态：F 画法 HUMAN-SELECTED；DEV-IMPLEMENTED；新增动效 HUMAN-REVIEW-PENDING。** 用户从六张重绘中明确选择 F，并要求适度生动的动效。[联合样片](../art/demos/opening-joint/index.html)默认已使用 F 静图与专属炉火、光照起伏、核心密度流动/胀缩、烟灰和深层空气；人物、建筑与镜头不动。完整实现与生命周期统一归[视觉连续性规格](../specs/art-opening-haven-continuity.md)，实际执行证据归[本轮QA](../qa/2026-10-01-opening-joint.md)。画法选中不代表新动画观感、两端连续性或生产替换已通过。

## 同日画法选择与动态接续

用户先认可坐姿与角度，指出首页生成感明显，随后从六张描绘处理候选中选中 F「手绘块面」。[比较页](../art/demos/opening-pixel-candidates/index.html)默认展示 F 静帧，并保留原图、历史候选、统一局部放大和实景截帧；动态在联合样片查看。原始生成参考与提示保存在[来源记录](../art/demos/opening-joint/assets/title/candidates/source.json)，不是精确像素网格或固定色数的完成证明。

DEV无参数使用 F；`?title=0`为原版静图，`?title=a`至`e`为历史候选静图。F专属透明Canvas跟随Scene暂停、减动和销毁，避免把旧图遮罩贴到新图；本轮未重绘F、未改实景资产、未替换正式默认。首页坐姿至实景站姿仍沿用原短过渡剪辑，没有起身动画。

## 已否决的静态路线

2026-09-30的[静态母版](../art/demos/opening-master/index.html)为 **HUMAN-REJECTED**。[原技术检查](../qa/2026-09-30-opening-master.md)只保留当时导出与查看范围，不证明美术成立。旧“同源几何换镜头＋匹配剪辑”方案作废；不得以原世界坐标、相机角度或站立姿态限制新构图。

## 三版历史探索：均未获选

[三版DEV入口](../art/demos/opening-three/index.html) · [限定QA](../qa/2026-10-01-opening-three.md) · [生成提示与参考](../art/demos/opening-three/prompts.json)

- **A · 还能停留**：人在炉边建筑残骸上坐下，表达破碎世界中尚可停留的一处。
- **B · 借来的庇护**：核心与人的依存关系成为主构图，人受其保护，也被受控污染照亮。
- **C · 再次出发**：人在地坪狭裂口边，炉席留在身后，出发与可返回之处同画面成立。

三张均为内置 image_gen 生成的独立1536×1024位图，不是确定性绘制或选中的生产资产。状态为 **DEV-IMPLEMENTED / LIMITED-VERIFIED / USER-NOT-SATISFIED**。用户明确三版仍不满意；均不作为定稿推进，不再等待从三版中挑选。

比较页 `index.html` → `entry.ts` / `style.css` 复用既有 `MenuEntryTransition` 进入同一个真实 `PurificationScene` 初始场景，未做每张的同位几何匹配或A坐姿起身衔接。页内采用内存存储；A/C入场、切换与报告清理已有限验证，WASD/E/Tab及B完整到场未验。该证据不能迁移为下一轮实现或验收。

用户要求首页一眼惊艳或勾起好奇，实景保持风格与内容连续；可接受静态/半静态到实时的微细节减少，不接受视觉身份、建筑重量、光源关系和世界纵深消失。当前以[联合制作规格](../specs/art-opening-haven-continuity.md)为准，旧探索保留作对照。I31既有交付、Rift低精度角色和I28等挂起状态保持。
