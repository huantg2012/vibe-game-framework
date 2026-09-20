---
title: "游戏现状索引 — 全貌、证据与增量更新"
version: 1.0
date: 2026-09-20
---

# 游戏现状索引与更新机制

游戏长期迭代不能靠聊天历史恢复全貌。框架使用 `game-state` 技能，将“有哪些能力、如何体验、依据何在、哪些未知”保存在可版本管理的文本里；Agent 按任务加载，人按需生成可浏览的全貌。

**执行协议只有一份**：[game-state SKILL.md](../.agents/skills/game-state/SKILL.md) → [protocol.md](../.agents/skills/game-state/references/protocol.md)。本文说明用法和分工，不另定义字段。技能可独立移植，不要求使用本框架、特定引擎、语言或游戏品类。

## 一、信息分工

- `CLAUDE.md` / `AGENTS.md`：执行约束与阅读路由，不再维护累计进度和第二份功能清单。
- `docs/game-state/atlas.json`：项目身份、全游戏分类覆盖、功能文件列表、有效约束和登记范围。
- `docs/game-state/features/*.json`：稳定 feature ID、玩家能力摘要、实际入口、接入与工作状态、规则/实现指针、依赖、证据引用与未知项。
- `docs/game-state/evidence.json`：有版本与范围的事实依据，具体测试过程和截图继续住在 QA 报告/产物中。
- `docs/game-state/snapshot.json`：已复核输入的文件指纹，用于发现漂移；不代表验收通过。
- `docs/game-state/INDEX.md`：由文本源生成的 Agent 快捷全貌。它是视图，不是另一份可编辑正文。
- `docs/game-state/atlas.html`：同源、离线、按需生成的人读视图，不依赖部署或网络服务。
- spec、CSV、世界观、美术/音频规范：各自规则的权威正文，索引只引用。
- 当前迭代/Slice、roadmap：当前工作和路线，历史 QA/决策保留追溯用途。

先看所有分类，再深入局部。地图、菜单、成长、存档、内容等都要被分类骨架覆盖；不适用需给理由，没核实就显式未知。不能把“没有登记”解释为“游戏没有”。

## 二、状态不能压成一个“完成”

分别回答三个问题：

1. **接入事实**：未知、仅设计、开发场景、正式流程、已下线。正式流程要求真实入口和接入依据，但 source review 仍不等于运行通过。
2. **工作安排**：正在推进、挂起、收口。挂起不能被后续整理吞掉；收口可以包含明确保留的体验待验。
3. **验证依据**：静态源码核查、自动检查、运行观察、人的判断，各有版本、范围、结果与限制。单项 PASS 不能推成整个功能、整个游戏 PASS。

例如，“装备菜单有代码”“正常流程可打开装备菜单”“装备效果参与结算”“人认为操作好用”是四种不同事实。应分别登记，而不是看见一个文件就写“装备完成”。

证据不永久有效：共享系统变更会影响下游。记录变更范围，复核证据是否仍适用；确实重测时追加新记录，不能只刷新历史记录的日期。有效设计约束必须有来源及影响 feature；已被替代的约束保留替代指针，不继续当现行规则。

## 三、日常工作闭环

### 开工

1. 读框架入口，运行 `check`，带着诊断读 `INDEX.md` 与当前工作指针。
2. 声明本任务涉及的 feature ID；新能力登记新 ID，非游戏任务标不适用。
3. 查看依赖、约束与旧证据，通过 `check` / `impact` 判断需深入哪些文件。
4. 加载相关 spec、CSV、实现和报告，明确正常流程入口与开发入口的区别。

### 收尾

1. 各角色只更新所辖 feature 与实际产生的证据；规则仍就地改 spec，不搬入索引。
2. 检查共享改动的下游影响，记录缺口、矛盾和保留的挂起工作。
3. Director 汇总，运行结构/覆盖/漂移检查；核对后用 `baseline --reviewed` 记录当前输入，复跑 `check`，再刷新 `INDEX.md`。
4. 收口说明给出 feature ID、已验证范围、未验证限制。需要人读全貌时才生成 HTML。

并行工作按 feature 文件分责，公共 atlas/evidence 由协调者合并；单 Agent 可以依次执行以上角色。会话压缩前留下任务 ID、feature ID、源文件路径、证据与待核实项即可恢复，不需要整段历史摘要。

## 四、低成本使用与刷新

在项目根目录运行；安装到其他位置时，将命令中的技能路径替换为其实际位置：

```sh
# 第一次接入；只创建不存在的模板文件，随后盘点/填写文本源
node .agents/skills/game-state/scripts/game-state.mjs init --root .

# 日常检查：结构、源文件漂移、登记范围中遗漏的新文件
node .agents/skills/game-state/scripts/game-state.mjs check --root .

# 指定能力或已知 Git 基准查下游影响；此命令不修改数据
node .agents/skills/game-state/scripts/game-state.mjs impact --root . --feature YOUR_FEATURE_ID
node .agents/skills/game-state/scripts/game-state.mjs impact --root . --since YOUR_BASE_REF

# 只有实际核对文本源与变更影响后才记录输入基准
node .agents/skills/game-state/scripts/game-state.mjs baseline --root . --reviewed

node .agents/skills/game-state/scripts/game-state.mjs check --root .

# 每轮源数据更新后只刷新 Agent 索引
node .agents/skills/game-state/scripts/game-state.mjs render --root . --index-only

# 人需要时刷新 INDEX.md + atlas.html，打开生成的 HTML 即可阅读
node .agents/skills/game-state/scripts/game-state.mjs render --root .
```

默认 manifest 是 `docs/game-state/atlas.json`；自定义目录用 `--atlas <项目内相对路径>`。视图携带生成时间、输入指纹与诊断，不能脱离版本当实时游戏状态。

`check` 退出码：`1` 是结构/引用错误，`2` 是漂移、缺基准或登记范围的新文件未归属，`0` 是结构和输入新鲜；`0` **仍可能存在未知分类或历史证据警告，不是游戏验收 PASS**。发现漂移先解释并更新受影响项，再记录 baseline；禁止拿重拍快照消除尚未核实的问题。结构有效但陈旧时仍可生成带警示的视图。

机械检查只能发现已声明范围的问题。目录/注册入口扫描用于产生候选遗漏，Agent 仍需判断它代表新功能、内部实现还是不属于游戏内容；排除项需写理由。定期或重大里程碑对照实际游戏入口检查分类覆盖，不能声称工具自动读懂了整款游戏。

## 五、已有项目迁移与独立使用

已有项目第一次接入，先建立分类骨架，将未核实部分保留为 unknown；只从当前任务向相关分支扩展核实。历史“完成”不自动变成 production，更不变成体验验证。紧急修复可以先做并记录待补索引，随该修复一起收口，无需中断工作做全游戏考古。

原 `CLAUDE.md` 中的长状态表/累计进度应迁出当前入口：保留必要历史来源，当前正文改指向 game-state 与活进度文件；未确认的人审、挂起项、已退役方向都不能在迁移时抹掉。

用于另一款游戏时，只需复制整个 `game-state/` skill 目录，保留其 `SKILL.md`、协议和脚本，再对目标项目运行 `init --root <目标目录>`。不复制本项目的 atlas、风格、名称、玩法约束或历史证据。支持不用本框架的一名 Agent：技能本身负责采集、核实、登记、校验和生成；本框架只把这些动作分配给六种角色。
