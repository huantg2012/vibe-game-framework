---
status: ACTIVE
purpose: 轻量 issue 收集——playtest 反馈中产生的临时待办、发现的 bug、未即时修复的体验问题。
rule: Director 在每次 playtest 反馈处理后，将未即时修复的项追加到此文件。每个 Slice 规划时消费此列表。
---

# Backlog Issues

> 格式：`- [ ] 描述 (来源/日期)`。完成后打勾。每 Slice 规划时 review 此列表决定纳入哪些。

## 待处理

（当前无未处理 issue——Slice 3 的 playtest 反馈已全部即时修复或登记到 roadmap Slice 3.5）

## 已处理/已归档

- [x] 薪柴溢出——经济模型必然崩溃 (Slice 2 playtest / 2026-08-08) → DEC-026, Slice 3 重设计
- [x] 地图室内感太强 (Slice 1 playtest / 2026-08-07) → 室外地图重设计
- [x] 无法找到撤离点 (Slice 1 playtest / 2026-08-07) → trail + landmarks + minimap + glow
- [x] 冲击面板时机不对 (Slice 3 playtest / 2026-08-09) → 改为返回时显示
- [x] 净化点 HUD 不可见 (Slice 3 playtest / 2026-08-10) → DOM overlay 替代
- [x] Continue 触发冲击 (Slice 3 playtest / 2026-08-10) → 仅从裂隙返回时触发
