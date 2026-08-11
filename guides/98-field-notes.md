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
- A-G3 结论 / 方向发现（2026-07-31，DEC-018）：合成测试实跑推翻了"离散 AI tile"这一门禁默认前提。五轮调优（亮度归一/随机旋转/降权）后 AI tile 仍特征重复，马赛克只是从"明暗棋盘"变"特征重复"；改为**按世界坐标程序化生成连续地面/墙体**后一次成型（零接缝零重复、可控、色板合规、契合 DEC-005/007）。**框架启示**：门禁的"验证方式"本身也可能带错误前提——A-G3 原设计假定表现力来自"多做几种 AI tile"，实测证明来自"程序化连续 + 光照 + 有限视野"。retro 议题：美术门禁模板是否应显式区分"连续表面（程序化）"与"离散对象（AI 生图）"两条资产路径。
- 工具留痕（2026-07-31）：A-G3 探索脚本在 `docs/art/demos/rift-synth/`（`loop.mjs` = AI-tile 五轮、`floor.mjs`/`scene.mjs`/`darkwood.mjs` = 程序化胜出）。这些是一次性测试台；Part C 将其逻辑移植进 `src/` 生产代码。
- Slice 1 / 工具链缺口累积（2026-08-01, T8 收口）：**同一根因第三次浮现——缺一个能驱动真实引擎的正式 dev harness**。三处表现：(1) 仓库无 `lint` script / eslint 配置 / 依赖，T7、T8 两次只能退回 `build` + `ReadLints` 当静态门禁；(2) 无测试框架（T5 已记），战斗不变量 K1/K2/K3/K5 只能靠 dev-boot 断言（DEC-020）+ 一次性脚本验证；(3) 浏览器无法模拟"按住键 / 同帧 keydown+keyup"，键盘手感、移动、攻击手感在 T5/T7/T8 **三个 Slice 任务连续被阻塞**，每次都只能把"真人试玩"留成遗留项。是否引入 Vitest / 保留一个 `#rift-harness` 驱动入口 = 架构决策（Director 从 T5 起就挂着的未决项），建议在 Slice 1 整合或 retro 时拍板，勿再逐任务临时糊。
- Slice 2-3 交界 / 框架教训（2026-08-09）：**四条 high-level 经验**——(1) 区分"数值调参"与"经济结构设计"，后者必须回 design agent 而非直接改 constants；Director 的 playtest 反馈处理流程应增加此判断步骤。(2) Design agent 输出格式应为"方向+后果+待答问题"而非"完整方案+推荐选项"；角色是引导者不是决定者。(3) 复杂系统设计应结构化为多轮短迭代（each round: 已锁定+待确认），不应试图一轮完成。(4) 世界观约束是设计最强锚点——陷入"怎么设计"时回 world.md 比堆参考更有效；design agent 流程应把世界观检查放第一步而非最后。
- Slice 4.5 / 流程绕过（2026-08-12，Director 收尾时观察）：本 Slice 从头到尾没走 Step 1-3（无一致性检查、无 Slice 立项、无 `docs/tasks/slice-4.5.md`），完全由对话直接驱动 code/art 实现，`current-slice.md` 与 roadmap 是事后补记的。**代价**：七个 commit 里新增了两个系统（BoundaryShape / BoundaryBreath）却没有任何 spec 承接，architecture.md 也没登记——这正是"无机器闸门的产出静默漂移"那类问题，只是这次漂的是文档而非代码。**但也要如实记录另一面**：表现层工作的验证方式天然是"改一版→人当场看→指名下一版问题"，预先写 Task Brief 的收益确实比系统 Slice 低。retro 议题：打磨/表现类 Slice 是否该有一条轻量路径（免 Task Brief，但强制在收尾时登记新增系统 + 补 spec 判断），而不是像现在这样在正式流程与完全裸奔之间二选一。
- Slice 3 / 临时任务追踪缺口（2026-08-10）：用户 playtest 反馈中产生的临时待办事项（如"薪柴显示看不到"/"冲击时机不对"/"面板语言混乱"）没有可靠的去处。当前这些要么在对话中即时修复要么靠 design-notes 文档记录——前者不留痕，后者不是正式追踪机制。长线开发中可能因跨 session/跨 conversation 而丢失。需要一个轻量的"临时 issue 收集"机制，既不增加流程负担，又保证不遗漏。
