---
status: ACTIVE
purpose: 轻量 issue 收集——playtest 反馈中产生的临时待办、发现的 bug、未即时修复的体验问题。
rule: Director 在每次 playtest 反馈处理后，将未即时修复的项追加到此文件。每个 Slice 规划时消费此列表。
---

# Backlog Issues

> 格式：`- [ ] 描述 (来源/日期)`。完成后打勾。每 Slice 规划时 review 此列表决定纳入哪些。

## 待处理

- [ ] 永久改造深度太浅——设计方向已记录到 upgrades.csv（3 个 Slice 5 设计项），实现推迟 (Slice 4 playtest / 2026-08-11) → Slice 5 设计任务
- [ ] 净化点模块受损三态视觉未实现——规格已在 `ui-art-overhaul.md` B3 (Slice 4.5 / 2026-08-12) → Slice 5+ 或独立打磨
- [ ] `art-direction.md` §6.2/§6.4 由 Director 做了最小事实回填（按钮状态改游戏语义、面板改右侧抽屉），**需 art agent 复核措辞是否符合其规范体系** (Slice 4.5 收尾 / 2026-08-12)
- [ ] `architecture.md` 模块注册表的"规划中"标记大面积过期（GameState / SaveManager / ChaosSystem / HUD / DOM UI 等实际已实现），2026-08-12 只补核了边界/地表/面板三块 → 下次一致性检查全量补核

## 已处理/已归档

- [x] architecture.md 未登记 Slice 4.5 三块新系统（边界形态 / 程序化地表 / 共享面板样式层） (Slice 4.5 收尾 / 2026-08-12) → 已登记：模块注册表 6 行 + 「动态力场边界」小节 + DEC-ARCH-009 + DEC-ARCH-005 追加
- [x] 框架在 in-game UX 上产出质量差（人评"必须想办法"）(Slice 4.5 收尾 / 2026-08-12) → 六处落地，见 `guides/99-review.md` FV-01

- [x] 裂隙内混乱值到达重要节点(50/75/100)时给玩家显著提示——视觉效果+旁白文字结合 (Slice 3.5 playtest / 2026-08-10) → 纳入 Slice 4 T9
- [x] 场景过渡"裂隙坍缩"需要视觉表现（画面收缩/teal闪烁/扭曲），当前仅黑屏+文字 (Slice 3.5 playtest / 2026-08-10) → 纳入 Slice 4 T10

- [x] 薪柴溢出——经济模型必然崩溃 (Slice 2 playtest / 2026-08-08) → DEC-026, Slice 3 重设计
- [x] 地图室内感太强 (Slice 1 playtest / 2026-08-07) → 室外地图重设计
- [x] 无法找到撤离点 (Slice 1 playtest / 2026-08-07) → trail + landmarks + minimap + glow
- [x] 冲击面板时机不对 (Slice 3 playtest / 2026-08-09) → 改为返回时显示
- [x] 净化点 HUD 不可见 (Slice 3 playtest / 2026-08-10) → DOM overlay 替代
- [x] Continue 触发冲击 (Slice 3 playtest / 2026-08-10) → 仅从裂隙返回时触发
- [x] ESC→Continue触发冲击 (Slice 4 / 2026-08-11) → fromMenu flag 排除
- [x] 净化点HUD余额不更新 (Slice 4 / 2026-08-11) → createPurifHud 清理旧DOM
- [x] Loadout槽位类型约束 (Slice 4 / 2026-08-11) → 按 toolType 过滤
- [x] 工具uses从CSV读取 (Slice 4 / 2026-08-11) → 转化时从CONTAMINANT_DATA取值
- [x] 混乱阈值提示太短 (Slice 4 / 2026-08-11) → 延长到3s
- [x] 净化点文案样式不统一 (Slice 4 / 2026-08-11) → 统一12px/白色/深色背景
- [x] 防御副作用无感知渠道 (Slice 4 / 2026-08-11) → 出击开始时toast提示来源
- [x] 稳定度增长过快 (Slice 4 / 2026-08-11) → 积分值校准(撤离1/改造1/Crest3/潮汐5)
