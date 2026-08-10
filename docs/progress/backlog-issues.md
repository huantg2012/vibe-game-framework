---
status: ACTIVE
purpose: 轻量 issue 收集——playtest 反馈中产生的临时待办、发现的 bug、未即时修复的体验问题。
rule: Director 在每次 playtest 反馈处理后，将未即时修复的项追加到此文件。每个 Slice 规划时消费此列表。
---

# Backlog Issues

> 格式：`- [ ] 描述 (来源/日期)`。完成后打勾。每 Slice 规划时 review 此列表决定纳入哪些。

## 待处理

- [ ] 永久改造深度太浅，游戏性不高——当前只有 3 个纯数值升级，缺少质变/build 差异 (Slice 4 playtest / 2026-08-11)
- [ ] 裂隙内混乱值阈值视觉提示持续时间偏短，玩家看不清文案——需要延长或改为手动关闭 (Slice 4 playtest / 2026-08-11)
- [ ] 净化点各交互点文案样式不统一，部分文案看不清（字号/颜色/对比度问题）(Slice 4 playtest / 2026-08-11)
- [ ] ESC退出→Continue进入净化点仍会立即触发冲击——之前修过但未彻底解决（isReturnFromRift判定不准）(Slice 4 playtest / 2026-08-11)
- [ ] bug：净化点中薪柴被消费（修复/改造）后右上角HUD显示的余额不更新——refreshKindlingDisplay未被正确调用 (Slice 4 playtest / 2026-08-11)
- [ ] 稳定度增长过快——一次rift返回就7%，按当前积分规则(撤离+2/改造+3/等)很快到100%，需要重新校准积分值或提高MAX (Slice 4 playtest / 2026-08-11)
- [ ] bug：出击装备loadout槽位类型约束缺失——被动工具(如碎影)可装到Q/F主动槽，主动工具(如镜像诱饵)可装到被动槽。需要在loadout面板中校验tool_type与slot类型匹配 (Slice 4 playtest / 2026-08-11)
- [ ] 需全面检查：每个主动/被动工具的实际效果是否正确生效（逐个验证） (Slice 4 playtest / 2026-08-11)
- [ ] 防御污染物的负面副作用在游戏过程中缺少感知渠道——玩家不知道"初始混乱+5"或"视野-5%"是因为上次装备的防御物造成的，需要在出击开始时给出副作用来源提示 (Slice 4 playtest / 2026-08-11)

（当前无待处理项）

## 已处理/已归档

- [x] 裂隙内混乱值到达重要节点(50/75/100)时给玩家显著提示——视觉效果+旁白文字结合 (Slice 3.5 playtest / 2026-08-10) → 纳入 Slice 4 T9
- [x] 场景过渡"裂隙坍缩"需要视觉表现（画面收缩/teal闪烁/扭曲），当前仅黑屏+文字 (Slice 3.5 playtest / 2026-08-10) → 纳入 Slice 4 T10

- [x] 薪柴溢出——经济模型必然崩溃 (Slice 2 playtest / 2026-08-08) → DEC-026, Slice 3 重设计
- [x] 地图室内感太强 (Slice 1 playtest / 2026-08-07) → 室外地图重设计
- [x] 无法找到撤离点 (Slice 1 playtest / 2026-08-07) → trail + landmarks + minimap + glow
- [x] 冲击面板时机不对 (Slice 3 playtest / 2026-08-09) → 改为返回时显示
- [x] 净化点 HUD 不可见 (Slice 3 playtest / 2026-08-10) → DOM overlay 替代
- [x] Continue 触发冲击 (Slice 3 playtest / 2026-08-10) → 仅从裂隙返回时触发
