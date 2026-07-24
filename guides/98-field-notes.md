---
title: "Field Notes — 框架 dogfooding 摩擦记录"
purpose: 开发过程中随手记录框架摩擦/热修/刻意框架会话。retro 时消费。
---

# Field Notes

> 格式：`- [范围/日期]: [一句话]`。append-only，不改历史条目。

- 框架会话（2026-07-24）：人批准在 Foundation 空档集中建设"美术后处理管线"（框架层 A），为 Slice 1 门禁 A-G3 提供可复用能力。属框架迭代协议（集中框架开发通常仅在 Retro）的显式例外，故此留痕。
- Slice 1 / 管线实跑（2026-07-24）：真实英雄图跑通 postprocess+verify，环境 3/3 PASS、sprite 1/1 FAIL（亮度 36>30，去背与色板量化均正常）；`maxAvgBrightness` 宜按 env/sprite 分型调参，sprite 或需更强 colorGrade 压亮。
