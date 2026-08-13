# Cursor / 通用 Agent 入口

**项目执行标准的唯一正文是 `CLAUDE.md`。** 本文件是 Cursor 侧钩子，不复制那份全文。开工先读 `CLAUDE.md`（阶段、硬约束、路由），细节按 L1/L2 再读 spec。

自定义 agent 定义：`.cursor/agents/`（与 `.claude/agents/` 正文逐字一致，仅 `model` 可不同）。人的操作入口：`START-HERE.md`。

## 硬约束（不读 CLAUDE.md 也必须遵守）

1. **双层不混**：改框架（agents / guides / CLAUDE.md）与做游戏（`docs/**` / `src/**`）是两块独立工作。
2. **in-game UI ≠ admin panel**。触碰游戏内界面必须：载体决策 + 2–3 个具名游戏参考 + `docs/specs/_template-ui.md` 的 U1–U12；视觉真相：ui spec > `docs/design-notes/ui-art-overhaul.md` > `art-direction.md` §6。元界面才允许软件界面感。固定逻辑分辨率，不写响应式断点。
3. **策划数据 CSV → code**（`data/*.csv`），禁止在代码里手写物品/敌人/技能数据再反向导出。系统常量除外。
4. **一个逻辑系统 = 一个 spec，原地更新。** Git 管历史。
5. **框架内路由不用 Cursor Auto**；按具名 agent 派发。Cursor 侧模型试验见 `CLAUDE.md`（当前六个 agent 临时固定 `cursor-grok-4.6-high`）。
6. 改 agent 定义后跑 `node tools/agent-parity/check.mjs`。

当前游戏进度以 `CLAUDE.md`「当前阶段」和 `docs/progress/roadmap.md` 为准。
