# Cursor / 通用 Agent 入口

**项目执行标准的唯一正文是 `CLAUDE.md`。** 本文件是 Cursor 侧钩子，不复制那份全文。开工先读 `CLAUDE.md`（阶段、硬约束、路由），细节按 L1/L2 再读 spec。

自定义 agent 定义：`.cursor/agents/`（与 `.claude/agents/` 正文逐字一致，仅 `model` 可不同）。人的操作入口：`START-HERE.md`。

## 硬约束（不读 CLAUDE.md 也必须遵守）

1. **双层不混**：改框架（agents / guides / CLAUDE.md）与做游戏（`docs/**` / `src/**`）是两块独立工作。框架改动先上 `master`，再合并到本分支。
2. **in-game UI：审美过关 + 读作游戏**（人终审）。≠ admin panel。触碰游戏内界面必须先执行 `.cursor/skills/in-game-ux/SKILL.md`（HOW；自定义 agent 须显式 Read；按本游戏 art-direction / Kit / architecture 填写，禁止套用别的游戏的皮），再做：载体决策 + 2–3 个具名游戏参考 + `docs/specs/_template-ui.md` 的 U1–U12。记「要过关」而不走 HOW = 不合格。过清单 ≠ 好看、≠ 像游戏。载体是视觉语言不是实现层：屏幕空间读数挂 architecture 声明的 overlay 根。表名/数值/档位分开展示。动 in-game 样式/蒙层/HUD 布局须 art 合规核对。UX 不制造机制里没有的犹豫。Kit 是活文档。视觉真相：ui spec > 项目 UI Kit > art-direction UI 节 > world 术语。元界面才允许软件界面感。固定逻辑分辨率，不写响应式断点。
3. **策划数据 CSV → code**（`data/*.csv`），禁止在代码里手写物品/敌人/技能数据再反向导出。系统常量除外。
4. **一个逻辑系统 = 一个 spec，原地更新。** Git 管历史。
5. **框架内路由不用 Cursor Auto**；按具名 agent 派发。Cursor 侧模型试验见 `CLAUDE.md`（当前六个 agent 临时固定 `cursor-grok-4.6-xhigh-fast`）。
6. 改 agent 定义后跑 `node tools/agent-parity/check.mjs`。

当前游戏进度以 `CLAUDE.md`「当前阶段」和 `docs/progress/roadmap.md` 为准。裂隙地图活策略：`docs/design-notes/slice-6-layered-generation.md`（扩空间读该文「Agent 入口」）。开发练习场：`docs/dev/gym.md`（`gym.html`，必须复用出击的敌人系统；地图课复用 `generateRiftLayout`）。角色外形 HOW：`docs/art/actor-pixels.md`。
