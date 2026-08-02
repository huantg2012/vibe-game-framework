---
title: "Field Notes — 框架 dogfooding 摩擦记录"
purpose: 开发过程中随手记录框架摩擦/热修/刻意框架会话。retro 时消费。
---

# Field Notes

> 格式：`- [范围/日期]: [一句话]`。append-only，不改历史条目。

- 框架会话（2026-07-24）：人批准在 Foundation 空档集中建设"美术后处理管线"（框架层 A），为 Slice 1 门禁 A-G3 提供可复用能力。属框架迭代协议（集中框架开发通常仅在 Retro）的显式例外，故此留痕。
- Slice 1 / 管线实跑（2026-07-24）：真实英雄图跑通 postprocess+verify，环境 3/3 PASS、sprite 1/1 FAIL（亮度 36>30，去背与色板量化均正常）；`maxAvgBrightness` 宜按 env/sprite 分型调参，sprite 或需更强 colorGrade 压亮。
- 框架修正（2026-07-24）：发现管线实跑演示把"整场景概念图降采样成 32px"当资产，隐含错误心智模型（这种图一旦平铺 = 密密麻麻绿色噪点）。已把"管线输入=单块 tile/sprite 原图，概念图只用于验证、不平铺"写入 art-direction §9.1/§14、asset-specs、architecture、guides/13 及 art/code agent 定义（.claude 与 .cursor 同步）；并把 Slice 1 门禁 A-G3 从"缩图管线往返"改为"合成测试"（真 tile+覆盖层+光照拼小块场景比对参考图）。视角"氛围 vs 逐像素"暂不定性，等合成测试出证据再决定是否回炉美术方向/架构。
- A-G3 结论 / 方向发现（2026-07-31，DEC-018）：合成测试实跑推翻了"离散 AI tile"这一门禁默认前提。五轮调优（亮度归一/随机旋转/降权）后 AI tile 仍特征重复，马赛克只是从"明暗棋盘"变"特征重复"；改为**按世界坐标程序化生成连续地面/墙体**后一次成型（零接缝零重复、可控、色板合规、契合 DEC-005/007）。**框架启示**：门禁的"验证方式"本身也可能带错误前提——A-G3 原设计假定表现力来自"多做几种 AI tile"，实测证明来自"程序化连续 + 光照 + 有限视野"。retro 议题：美术门禁模板是否应显式区分"连续表面（程序化）"与"离散对象（AI 生图）"两条资产路径。
- 工具留痕（2026-07-31）：A-G3 探索脚本在 `docs/art/demos/rift-synth/`（`loop.mjs` = AI-tile 五轮、`floor.mjs`/`scene.mjs`/`darkwood.mjs` = 程序化胜出）。这些是一次性测试台；Part C 将其逻辑移植进 `src/` 生产代码。
- Slice 1 / 工具链缺口累积（2026-08-01, T8 收口）：**同一根因第三次浮现——缺一个能驱动真实引擎的正式 dev harness**。三处表现：(1) 仓库无 `lint` script / eslint 配置 / 依赖，T7、T8 两次只能退回 `build` + `ReadLints` 当静态门禁；(2) 无测试框架（T5 已记），战斗不变量 K1/K2/K3/K5 只能靠 dev-boot 断言（DEC-020）+ 一次性脚本验证；(3) 浏览器无法模拟"按住键 / 同帧 keydown+keyup"，键盘手感、移动、攻击手感在 T5/T7/T8 **三个 Slice 任务连续被阻塞**，每次都只能把"真人试玩"留成遗留项。是否引入 Vitest / 保留一个 `#rift-harness` 驱动入口 = 架构决策（Director 从 T5 起就挂着的未决项），建议在 Slice 1 整合或 retro 时拍板，勿再逐任务临时糊。
