# Cursor / 通用 Agent 入口

**项目执行标准的唯一正文是 `CLAUDE.md`。** 本文件是 Cursor 侧钩子，不复制那份全文。开工先读 `CLAUDE.md`（硬约束、路由），再读 `docs/game-state/INDEX.md`（全貌）与当前工作指针，细节按 L1/L2 加载。

自定义 agent 定义：`.cursor/agents/`（与 `.claude/agents/` 正文逐字一致，仅 `model` 可不同）。人的操作入口：`START-HERE.md`。项目 skill 在 `.cursor/skills/`（与 `.agents/skills/` 正文相同）：HUD / DOM 走 `in-game-ux`；世界内像素模型 / 像素抽卡走 `pixel-models`（抽卡流程另读 `visual-card-draw`）；自定义 agent 必须显式 Read。

## 硬约束（不读 CLAUDE.md 也必须遵守）

1. **双层不混**：改框架（agents / guides / CLAUDE.md）与做游戏（`docs/**` / `src/**`）是两块独立工作。框架改动先上 `master`，再合并到本分支。
2. **in-game UI：审美 + 读作游戏 UI + 与已锁装置同一世界**（人终审三问）。≠ admin panel。触碰游戏内界面必须先执行 `.cursor/skills/in-game-ux/SKILL.md`（HOW = 三问结果；自定义 agent 须显式 Read；按本游戏 art-direction / Kit / architecture 填写，禁止套用别的游戏的皮）。U1–U12 是闸门不是 HOW。记「要过关」而不走 HOW = 不合格。过清单 ≠ 好看、≠ 像游戏。禁止用「机械层已扫」当交付标题。载体是视觉语言不是实现层：屏幕空间读数挂 architecture 声明的 overlay 根。表名/数值/档位分开展示。动 in-game 样式/蒙层/HUD 布局须 art 合规核对。UX 不制造机制里没有的犹豫。Kit 是活文档。视觉真相：ui spec > 项目 UI Kit > art-direction UI 节 > world 术语。元界面才允许软件界面感。固定逻辑分辨率，不写响应式断点。
3. **策划数据 CSV → code**（`data/*.csv`），禁止在代码里手写物品/敌人/技能数据再反向导出。系统常量除外。
4. **一个逻辑系统 = 一个 spec，原地更新。** Git 管历史。
5. **框架内路由不用 Cursor Auto**；按具名 agent 派发。Cursor 侧模型试验见 `CLAUDE.md`（当前六个 agent 临时固定 `cursor-grok-4.6-xhigh-fast`）。
6. 改 agent 定义后跑 `node tools/agent-parity/check.mjs`。
7. **游戏现状不靠聊天记忆**：执行 `.agents/skills/game-state/SKILL.md`；任务绑定 feature ID，增量维护文本源、入口、依赖和证据。接入、工作状态、验证分别记录。无索引时渐进补录，不阻塞无关必要工作。

游戏全貌读 `docs/game-state/INDEX.md`；当前工作读 `docs/progress/current-iteration.md`，路线读 `docs/progress/roadmap.md`。旧入口累计进度已移出本入口，历史通过和挂起状态以对应任务/证据为准，不根据聊天或文件存在推断。
