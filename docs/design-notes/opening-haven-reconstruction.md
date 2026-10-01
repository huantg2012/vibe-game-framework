# 开场 → 净化点：设计入口与历史探索

当前规格：[首页与净化点视觉连续性](../specs/art-opening-haven-continuity.md)。日期：2026-10-01。主关联 COH-F002 / COH-F005。

**下一轮状态：PLANNED / IMPLEMENTATION-NOT-STARTED / HUMAN-ART-NOT-REVIEWED。** 用户要求把计划落为 spec；下一轮推进一个联合方向，同时交付首页、对应真实净化点及可操作的进入过程。完整设计、制作顺序、合理降级边界和验收条件统一维护在上述规格，不在本笔记重复。生产默认首页未替换。

## 已否决的静态路线

2026-09-30的[静态母版](../art/demos/opening-master/index.html)为 **HUMAN-REJECTED**。[原技术检查](../qa/2026-09-30-opening-master.md)只保留当时导出与查看范围，不证明美术成立。旧“同源几何换镜头＋匹配剪辑”方案作废；不得以原世界坐标、相机角度或站立姿态限制新构图。

## 三版历史探索：均未获选

[三版DEV入口](../art/demos/opening-three/index.html) · [限定QA](../qa/2026-10-01-opening-three.md) · [生成提示与参考](../art/demos/opening-three/prompts.json)

- **A · 还能停留**：人在炉边建筑残骸上坐下，表达破碎世界中尚可停留的一处。
- **B · 借来的庇护**：核心与人的依存关系成为主构图，人受其保护，也被受控污染照亮。
- **C · 再次出发**：人在地坪狭裂口边，炉席留在身后，出发与可返回之处同画面成立。

三张均为内置 image_gen 生成的独立1536×1024位图，不是确定性绘制或选中的生产资产。状态为 **DEV-IMPLEMENTED / LIMITED-VERIFIED / USER-NOT-SATISFIED**。用户明确三版仍不满意；均不作为定稿推进，不再等待从三版中挑选。

比较页 `index.html` → `entry.ts` / `style.css` 复用既有 `MenuEntryTransition` 进入同一个真实 `PurificationScene` 初始场景，未做每张的同位几何匹配或A坐姿起身衔接。页内采用内存存储；A/C入场、切换与报告清理已有限验证，WASD/E/Tab及B完整到场未验。该证据不能迁移为下一轮实现或验收。

用户要求首页一眼惊艳或勾起好奇，实景保持风格与内容连续；可接受静态/半静态到实时的微细节减少，不接受视觉身份、建筑重量、光源关系和世界纵深消失。下一轮以[联合制作规格](../specs/art-opening-haven-continuity.md)为准，旧探索保留作对照。I31既有交付、Rift低精度角色和I28等挂起状态保持。
