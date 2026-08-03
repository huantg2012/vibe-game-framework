---
title: "Field Notes — 框架 dogfooding 摩擦记录"
purpose: 开发过程中随手记录框架摩擦/热修/刻意框架会话。retro 时消费。
---

# Field Notes

> 格式：`- [范围/日期]: [一句话]`。append-only，不改历史条目。

- 框架会话（2026-07-24）：人批准在 Foundation 空档集中建设"美术后处理管线"（框架层 A），为 Slice 1 门禁 A-G3 提供可复用能力。属框架迭代协议（集中框架开发通常仅在 Retro）的显式例外，故此留痕。
- Slice 1 / 管线实跑（2026-07-24）：真实英雄图跑通 postprocess+verify，环境 3/3 PASS、sprite 1/1 FAIL（亮度 36>30，去背与色板量化均正常）；`maxAvgBrightness` 宜按 env/sprite 分型调参，sprite 或需更强 colorGrade 压亮。
- 框架会话（2026-08-03）：人发起 token 经济性专题，属框架迭代协议的显式例外（集中框架开发通常仅在 Retro），故留痕。排查发现 agent frontmatter 的 `model: opus/sonnet` 是 Claude Code 别名、在 Cursor 下静默回退——路由配置一直没生效。已确立"按错误能否被机器抓住分档"原则、逃逸兜底、探索循环成本闸门，放宽两份定义一致性为"正文一致 + model 可差异"，并加 `tools/agent-parity/check.mjs` 校验。**框架启示**：任何跨运行时的配置字段都可能静默失效，写进文档不等于生效，需要一个能跑的校验器；本次之前该规则的验收手段（`diff -r`）恰恰还会把正确配置判成错误。
- 框架修正（2026-07-24）：发现管线实跑演示把"整场景概念图降采样成 32px"当资产，隐含错误心智模型（这种图一旦平铺 = 密密麻麻绿色噪点）。已把"管线输入=单块 tile/sprite 原图，概念图只用于验证、不平铺"写入 art-direction §9.1/§14、asset-specs、architecture、guides/13 及 art/code agent 定义（.claude 与 .cursor 同步）；并把 Slice 1 门禁 A-G3 从"缩图管线往返"改为"合成测试"（真 tile+覆盖层+光照拼小块场景比对参考图）。视角"氛围 vs 逐像素"暂不定性，等合成测试出证据再决定是否回炉美术方向/架构。
