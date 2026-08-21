# Cursor / 通用 Agent 入口

**项目执行标准的唯一正文是 `CLAUDE.md`。** 本文件是 Cursor 侧钩子，不复制那份全文。开工先读 `CLAUDE.md`（阶段、硬约束、路由），细节按 L1/L2 再读 spec。

自定义 agent 定义：`.cursor/agents/`（与 `.claude/agents/` 正文逐字一致，仅 `model` 可不同）。人的操作入口：`START-HERE.md`。

## 硬约束（不读 CLAUDE.md 也必须遵守）

1. **双层不混**：改框架（agents / guides / CLAUDE.md）与做游戏（`docs/**` / `src/**`）是两块独立工作。框架改动先上 `master`，再合并到游戏分支。
2. **in-game UI：审美过关 + 读作游戏**（人终审）。≠ admin panel。触碰游戏内界面必须先执行 `.cursor/skills/in-game-ux/SKILL.md`（HOW；自定义 agent 须显式 Read；按本游戏 art-direction / Kit / architecture 填写，禁止套用别的游戏的皮），再做：载体决策 + 2–3 个具名游戏参考 + `docs/specs/_template-ui.md` 的 U1–U12。记「要过关」而不走 HOW = 不合格。过清单 ≠ 好看、≠ 像游戏。载体是视觉语言不是实现层：屏幕空间读数挂 architecture 声明的 overlay 根。表名/数值/档位分开展示。动 in-game 样式/蒙层/HUD 布局须 art 合规核对。UX 不制造机制里没有的犹豫。Kit 是活文档。视觉真相：ui spec > 项目 UI Kit > art-direction UI 节 > world 术语。元界面才允许软件界面感。固定逻辑分辨率，不写响应式断点。
3. **策划数据 CSV → code**（`data/*.csv`），禁止在代码里手写物品/敌人/技能数据再反向导出。系统常量除外。
4. **一个逻辑系统 = 一个 spec，原地更新。** Git 管历史。
5. **探索策略按"一次评估要多久"选，不按任务重不重要**（宽抽窄迭）。抽卡（并行低保真候选 + 人挑）破框；迭代守方向。**写不出可否证的验收句 = 还在找方向 = 该抽，不该进正式迭代**（唯一转折判据）。先验偏斜维度（in-game UI 首当其冲）必须先钉具名参考 + 禁令再采样，否则得到同一个错答案的 N 份副本。数值/经济/系统组合禁止开并行候选。有效结果当场落成耐用件（数值+推导 / 禁令 / 参考锚点），否则这轮作废。**禁止 agent 自评"抽中了 / 已收敛"**；无判据的维度不许用 loop 假装验证过。
6. **框架内路由不用 Cursor Auto**；按具名 agent 派发。模型档位见 `CLAUDE.md`。
7. 改 agent 定义后跑 `node tools/agent-parity/check.mjs`。

游戏分支的进度以该分支 `CLAUDE.md`「当前阶段」和 `docs/progress/roadmap.md` 为准。
