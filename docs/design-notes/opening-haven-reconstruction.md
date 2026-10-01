# 开场 → 净化点：设计入口与历史探索

当前规格：[首页与净化点视觉连续性](../specs/art-opening-haven-continuity.md)。日期：2026-10-01。主关联 COH-F002 / COH-F005。

**当前状态：DEV-IMPLEMENTED / LIMITED-VERIFIED / HUMAN-REVIEW-PENDING。** [单方向可操作样片](../art/demos/opening-joint/index.html)已将独立首页母版与对应巨构外景接到真实净化点，可进入、移动、坐下、返回及继续，并以真实渲染帧直接对照。首页由 image_gen 创作，实景由可编辑几何与正式渲染器呈现；[来源](../art/demos/opening-joint/assets/title/source.json)和[本轮QA](../qa/2026-10-01-opening-joint.md)分别记录制作与验证。坐姿首页至站姿实景沿用原短过渡剪辑，没有起身动画。完整设计及验收仍统一维护在上述规格；生产默认首页未替换，视觉连续性待用户审查。

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
