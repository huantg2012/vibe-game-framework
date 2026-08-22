---
status: DRAFT
created-by: qa agent（迭代 1 T8）
created-when: 2026-08-21
note: 机械对照 spec。不代勾审美 / 读作游戏 / PASS。
---

# QA：迭代 1 污染句法（机械层）

对照：`docs/specs/system-contamination-lexicon.md`、`docs/specs/ui-encounter-narration.md`、`docs/tasks/iteration-1.md`。

闸门已跑：`npx tsc --noEmit`、`npm run check:lexicon`、`npm run check:layout`（8 种子，含墙缘钉层非空）。

## 对照

| 项 | 结果 |
| -- | ---- |
| CSV → codegen，无手写 324 形态表 | 通过。五张 `data/contamination-*.csv` |
| 一份五态，乙丙丁无第二 FSM | 通过。甲仍走 `AISystem`；宿主是独立生命期，无 chase 开阔地 |
| 覆盖体不是第三种人形 | 通过。乙缝核 / 丙簇 / 丁体积 |
| 墙后可走四连通 | 通过。钉层只读格子；`check:layout` 仍过 |
| 听觉主轴 | 过渡：出击甲仍恰好 1 个改写体；乙丙丁抽卡 `hearingAxisTaken` 禁听噪 |
| 头上名字 | 通过。旁白挂 `#dom-ui-root` / `#rift-encounter-log` |
| 练习场旁白 | 通过。仅 `RiftScene` 创建 `EncounterNarration` |
| 绕仍应更便宜 | 数字按 spec 落地；**体验未验证** |
| U1–U12 结构 | 载体 A、分节点、12px、禁止 14px / `.game-panel`。审美待人终审 |
| 乙不占走廊碰撞 | 通过。核画在墙格，无 Arcade body |
| 丁低于 visionMask | 通过。`VOLUME_DEPTH` 40 < 50 |
| 丙不另做小人 | 通过。核点叠在簇上 |

## 已知缺口（不挡「实现完成」）

- 簇核钉层用与烤地相同种子抽样格心，不是 `ClusterOrganism` 像素中心；丙可能与最显眼活簇差一格。
- 乙听缝未接为听觉主轴（甲改写体仍占该名额）。
- 迷雾下亮度、旁白 60s 手感、四张孔谱是否可读：人终审。

## 结论

机械层可交。状态应写「实现完成，体验未验证」。不要标迭代 COMPLETE。不要勾好看。
