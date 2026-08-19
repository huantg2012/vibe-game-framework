---
status: REVIEW
created-by: qa agent
created-when: 2026-08-19
slice: 7
task: C1 净化器 + 加厚 + 起始混乱
note: |
  对照 DEC-064 / Slice 7 D1 / system-purification-impact 规则 27a/27b、64–67、
  abyss 53 / stitch 53a、system-chaos-scavenge-extract 初值段。
  机械层已扫；审美待人终审。不许自称好看 / 像游戏 / 审美 PASS。
  不标 Slice COMPLETE。
---

# QA Report: Slice 7 净化点扩张

日期：2026-08-19  
Spec 版本：`docs/specs/system-purification-impact.md`（`last-modified-date: 2026-08-19`，规则 8 / 14 / 22 / 26–27c / 31a / 53 / 53a / 64–67 + UX 视觉规格）；`docs/specs/system-chaos-scavenge-extract.md` 初值段；`docs/progress/decisions-log.md` DEC-064 + Slice 7 D1；`docs/specs/_template-ui.md` U1–U12  
代码版本：`2502d0330ced9e2d8834cebe3aef57ca6fd16c9b`（`feat(slice-7): 接入净化器起始混乱与祭坛旁加厚`）  
范围：Slice 7 C1 接线。不是体验验收。不是审美终审。未做人试玩。

本批触碰游戏内界面（净化器实体、加厚底栏、分配墙机第三行、出击装配第四格、贴顶预告目标名、存续报告第三卡）。HOW 已读 `.cursor/skills/in-game-ux/SKILL.md`。机械层可以勾；**不代人勾审美**。

---

### 总判

**PASS。** 九条必须机械核对全部对齐。`npx tsc --noEmit` 退出 0。无阻断项。不标 Slice COMPLETE。

审美与「读作游戏」待人终审。清单全过也不等于好看、也不等于像游戏。

---

### 发现的问题

| ID | 类型 | 严重度 | 描述 | 位置 | Spec 依据 |
| -- | ---- | ------ | ---- | ---- | --------- |
| — | — | — | 无阻断项 | — | — |

### 非阻断观察

| ID | 类型 | 严重度 | 描述 | 位置 | Spec 依据 |
| -- | ---- | ------ | ---- | ---- | --------- |
| O1 | UI 偏差 U9 | Medium | 存续报告净化器卡把表名与整数写在同一句式：`起始混乱 <span>N</span>`。节点上是两段，读起来仍像「起始混乱15」。下方属性网格已分 `stat-label` / `stat-value`，分配墙机与出击装配也已分节点。 | `src/ui/dom/status-panel.ts` 约 210 行 | 规则 UX / 视觉规格 §3「禁止把『起始混乱15』写成一个词」；`_template-ui.md` U9 |
| O2 | 风险 | Low | `ensurePurifier()` 只在**内存数组缺席**时插入 70 / 当前档 `maxHp`，不会在「存档缺 PURIFIER、内存里已有一台」时强制写回 70。冷启动默认就是 70/100，单槽存档 + 新记录会删档，主路径（冷启动读老档）规格字面成立。同会话先打残净化器再读一份缺第三模块的老档才会漏 hp。 | `src/managers/game-state.ts` `loadState` / `ensurePurifier` | 规则 8 / 边界「老存档只有两个模块」 |
| O3 | 偏差 | Low | 注入确认闪光沿用现模块 30×30、300ms 淡出，颜色是 `0xffffff`，不是视觉规格写的白 `#c8cdd4`。核心 / 储藏同一条旧路径，净化器没有另换绿闪。 | `src/scenes/purification-scene.ts` `flashModule` | 视觉规格 §1「白 `#c8cdd4`、300ms 淡出。不换绿闪」 |
| O4 | 既有债 | Low | 核心 / 储藏健康指示灯仍用未入板 `#44aa66`。净化器健康灯已改 `contam-core` `#1aad96`，规格只禁净化器再用那 gre。 | `src/entities/purification-module.ts` `INDICATOR_HEALTHY_COLOR` | 视觉规格 §1「禁止 `#44aa66`」；U3 登记的核心/储藏世界实体债 |

---

### 机器闸门

| 命令 | 退出码 | 原文摘要 |
| ---- | ------ | -------- |
| `npx tsc --noEmit` | **0** | 无输出 |

仓库无 `test` 脚本，未跑单元测试。未做浏览器实机。`data/contaminants.csv` 不在 `2502d03` 的 diff 里；该文件最近提交仍是 Slice 5.5（`69f1657`）。

---

### 必须机械核对（9 条）

| # | 项 | 判定 | 证据 |
| - | -- | ---- | ---- |
| 1 | PURIFIER 存在；开局 70/100；`getStartingChaos`：满血 0、空血 50、70/100=15 | **符合** | `createDefaultModules()` 三件各 `MODULE_INITIAL_HP` / `maxHpForTier(0)` = 70/100。`computeStartingChaos`：`round(50 * (1 - clamp(hp/maxHp)))`。70/100 → `round(15)=15`；100/100 → 0；0/100 → 50。`getStartingChaos()` 是唯一读入口；分配预览共用同一函数 |
| 2 | CORE/STORAGE 效果 `min(hp,100)/100`，不是 `hp/maxHp` | **符合** | `effectHp` = `min(hp, MODULE_EFFECT_HP_REF)`，分母 `MODULE_EFFECT_HP_REF`（100）。`getModuleEffect` 与分配墙机预览同一条。未见 `hp/maxHp` 进效果 |
| 3 | 加厚 12/20/32，maxHp 100→115→130→145，三模块同涨，hp 不变，不吃折扣 | **符合** | `MODULE_MAX_HP_COST = [12,20,32]`；`maxHpForTier = 100 + 15*tier`。`raiseModuleMaxHp` 用原价 `spendKindling`，不读 `upgradeDiscount`。`applyMaxHpFromTier` 改三件 `maxHp`，只在 `hp > cap` 时 clamp。稳定度：加厚路径无 `stabilityTracker.addProgress` |
| 4 | ChaosSystem 开局吃 `startingChaos` + `initial_chaos` | **符合** | `RiftScene`：`openingChaos = clamp(startingChaos + Σ initial_chaos, 0, HARD_CAP)` 一次写入 `ChaosSystem.startingValue`。`applyOpeningValue` 按初值预标已越过的阈、不闪跨阈。`applySingleSideEffect('initial_chaos')` 空操作，禁止二次 `addImmediate`。增长曲线 / `BASE_RATE` 未改。全库仅这一处 `new ChaosSystem` |
| 5 | DefenseContext 三模块都在；abyss 公式未改；不改 `contaminants.csv` | **符合** | `run()` 对 `gameState.getModules()` 逐件写入 `moduleHps` / `moduleMaxHps`。abyss 仍是 `min(0.65, 0.20 + n*0.15)`，半血用结算前 `hp/maxHp`。stitch 对 `context.moduleHps` 全部键做 20% 均摊。CSV 文案「最高 65% 当 3 模块均低于半血」「3 个模块 HP」仍在；本提交未改该文件。深渊之眼 / 缝合线工具路径未动 |
| 6 | 净化器几何按规格；加厚用 `drawInteractionPoint` 指定色/半径 | **符合** | 外三角 `(0,18)/(-16,-9)/(16,-9)`，内三角 `(0,8)/(-7,-4)/(7,-4)`。填/描/灯/脚下条色与线宽与规格一致。加厚桩：`drawInteractionPoint(..., 0x5a5f66, 0xc8cdd4, 7, 12, ...)`；祭坛北 2.2 tile 同西轴；间距 70.4px > `2×32` |
| 7 | 分配/HUD：表名与数字分节点；无新 HUD 根；挂 `#dom-ui-root` | **符合**（存续卡见 O1） | 分配：表名 / `hp` / `/` / `maxHp` 与 `起始混乱` / 当前 / `→` / 注入后分 `<span>`。出击装配四格，表名与整数各一 `div`。贴顶 `#purif-hud`、底栏 `#purif-prompt` 仍 `getDomUiRoot().appendChild`。无新根、无 `document.body` + 角锚 HUD。加厚不是 `.game-panel` |
| 8 | 老存档补第三模块 | **符合**（边角见 O2） | `moduleMaxHpTier?` 缺省 `clampTier(undefined)=0`。`loadState` 先定档再 `ensurePurifier(70)`，再按档重写 `maxHp`。冷启动默认数组已有 PURIFIER 70/100，缺键的老档不会把第三件判损坏 |
| 9 | 不改出击起始生命 | **符合** | `PLAYER.MAX_HEALTH` 仍 100，本提交 constants diff 只加模块/加厚/`CHAOS_HARD_START`。`growth_vitality` / `vitalityBonus` 展示公式未改。净化器不读写玩家完整度。出击装配「完整度」格仍是 `baseHp + vitalityBonus` |

静态算例（规则 27b / 边界表）：加厚后未注入 100/115 → `round(50*(1-100/115))=round(6.521)=7`，与规格边界行一致。CORE/STORAGE 在 hp=100、maxHp=115 时效果仍按 `min(100,100)/100` 封顶，不降。

---

### 规则对照（Slice 7 增量）

| 规则 | 判定 | 摘记 |
| ---- | ---- | ---- |
| 8 初值三模块 + 档位 0 | **符合** | 见核对 #1 / #8 |
| 14 分配预览分表名；机会成本其余两模块 | **符合** | 净化器行 `起始混乱`；其余两件用 `核心完整度` / `储藏完整度` / `净化器完整度`，禁止「另一模块」 |
| 22 三模块承血；预告从全部抽 | **符合** | `pickUniform(modules)`；重点 65%，其余均分，最后一件吃残差。无 `modules[0]/[1]` 写死 |
| 26 / 27 / 27a 分母锁 100 | **符合** | 见核对 #2 |
| 27b / 28 净化器走 `getStartingChaos`；`overwrite` 不抽换 | **符合** | `EffectModuleType` 仅 CORE/STORAGE。`getSortieModifiers().startingChaos` 必带 |
| 27c 不改出击起始生命 | **符合** | 见核对 #9 |
| 31a 一次写入 + 阈已越过不闪 | **符合** | 见核对 #4 |
| 53 abyss 65% 可触到 | **符合** | n=3 → 0.65；半血按新 maxHp（145 的一半 72.5） |
| 53a stitch 三向均衡 | **符合** | 第三键进 context 后自然覆盖 |
| 64–67 加厚费用/档/用词/非蜕变 | **符合** | 装置名 `加厚`；状态词 `可加厚` / `薪柴不足 · 还差 N` / `上限已至`；费用不进 `upgrades.csv`；E 当场扣、无第二条确认 |
| 混沌初值段 | **符合** | `CHAOS.START_VALUE=0` 仅作「满完整度且无残留」回退；出击构造传入合成初值 |

加厚交互细节：高亮条件 `cost !== null && cost <= reserve`；三档加尽不高亮。优先级 CORE → STORAGE → PURIFIER → 防御 → 祭坛 → 加厚 → 裂隙。七点进安全区钳制。

---

### 游戏内 UI（U1–U12 机械层）

判定依据：本表面写在 `system-purification-impact.md` UX / 视觉规格（高于 Kit）。载体表：净化器实体 A、注入复用 B（既有分配墙机）、加厚 A、提示/预告 A。参考锚点在规格里：Barotrauma / FTL / Signalis。本屏不像：后台 Dashboard / 设置页升级树 / 确认购买链。

| 项 | 机械扫 | 缺口 / 证据 |
| -- | ------ | ----------- |
| U1 载体 / 挂载 | 扫过 | 实体与加厚桩在 Phaser 世界层。`#purif-hud` / `#purif-prompt` / 分配 / 出击装配 / 存续 / 冲击结算走 `getDomUiRoot()`（`#dom-ui-root`）。加厚不是 680×468 墙机。未见新 HUD 根、未见净化器做成 HUD 图标 |
| U2 反后台套路 | 扫过 | 加厚无圆角卡片 / 投影 / 渐变按钮 / 通用图标字体。分配复用 `.game-panel`。**过本条 ≠ 好看 ≠ 像游戏** |
| U3 色彩 | 扫过 | 净化器与加厚只引用已锁名（`#1a6b5c` / `#0e4a3f` / `#1aad96` / `#4a4e55` / `#5a5f66` / `#c8cdd4` / `#c4873a` / `#b89040`）。核心/储藏世界实体蓝橙仍是既有债 |
| U4 排版 | 扫过 | 新节点字号 12 / 13 / 16，字体 `"Courier New", monospace` |
| U5 术语 | 扫过 | 可见词：净化器 / 完整度 / 薪柴 / 加厚 / 起始混乱 / 档。出击装配确认键仍是「踏入」不是「确认」。未出现「升级」「购买」「MAX」 |
| U6 不遮挡 | 扫过 | 加厚只走底栏，无中心窗。分配墙机仍是既有 `top:52px; left:140px; 680×468` |
| U7 输入 | 扫过 | 提示 `[E]` = 绑定 E。加厚无第二条确认。分配键盘 ←→ / Enter 注入 / Esc。读数不靠 hover |
| U8 状态语义 | 扫过 | `可加厚` / `薪柴不足 · 还差 N` / `上限已至`。缺薪柴费用位改写 `还差 N`，不是只变灰 |
| U9 表名数值档位 | 扫过，O1 偏差 | 分配 / 出击装配 / 加厚底栏 / 贴顶预告分节点。加厚下一档是独立数字，不是 `100→115` 一个字符串。存续净化器卡见 O1 |
| U10 反馈 | 扫过 | `raiseModuleMaxHp` 成功后立刻 `refresh` + `flashThickenSuccess`（`#e0a848` 300ms）。数字在 400ms 内已是新上限 |
| U11 同族 | 扫过 | 第三行跟核心/储藏同行式；桩跟入口/祭坛同一 `drawInteractionPoint`。不新基元 |
| U12 参考 | 规格有锚点 | Barotrauma（走到装置看灯）／ FTL（一槽表名+数）／ Signalis（设备打出来的字）。并排是否违和 = 人终审，此处不勾 |

画完自检 1–8（机械层书面答案，不写好看）：

1. 载体：实体 A、注入 B、加厚 A。屏幕空间 `#dom-ui-root`。世界几何走世界层。未另起 body 角锚 HUD。
2. 参考写在规格 U12 表。本屏规格声明不像 Dashboard / 设置页升级树 / 确认购买链。
3. P0：净化器三态在实体上。加厚无常驻第四条贴顶槽。贴顶仍是薪柴 / 潮汐 / 下次归来（消声才 +1）。
4. 墙机字来自既有磷光屏；加厚环呼吸是装置待机三档。无新增投影 / 圆角 / 渐变按钮。
5. 不可用写出 `薪柴不足 · 还差 N` / `上限已至`。
6. 灰度后：三角 ≠ 六边 ≠ 方块；加厚是同心圆。表名 / 数字 / 档位在分配、装配、加厚底栏分开。不足靠「还差 N」计数。
7. 打开 = 走近 E。加厚无第二条阻断。冲击结算仍只 1 条。
8. 可见词来自 `world.md` 术语表。键盘可做分配 / 踏入 / 加厚。提示键 = E。

机械层已扫；审美待人终审。

---

### 回归（本 Slice 改动面 + `interfaces-with`）

| 系统 | 判定 | 摘记 |
| ---- | ---- | ---- |
| `system-purification-impact`（`interface-changed: true`） | 出口在 | `getStartingChaos` / `getModuleMaxHpTier` / `raiseModuleMaxHp` / `SortieModifiers.startingChaos` 均有消费方 |
| `system-chaos-scavenge-extract` | 初值改、曲线未改 | `ChaosSystem` 文件仍在；`reset(startingValue)` / 构造吃合成初值。阈值、惩罚映射、`BASE_RATE` 未在本提交改语义 |
| `system-growth-tide` | 未混入蜕变 | 加厚不进 `upgrades.csv`、不走蜕变六卡、不计「购买改造 +3」。玩家完整度展示未改算法 |
| 冲击 / 防御 | 三键进 context | 预告、重点、伤害、stitch、abyss 都走 `getModules()`。公式未改 |
| 存档 | 档位落盘 | `SaveDataV1.moduleMaxHpTier?`；`save()` / `load()` 往返 |

既有未接线项（siphon 修复倍率、resonate 装备期上限、`incrementIntensity` 残留等）仍登记在规格「未接线」表，本 Slice 未宣称修掉。

---

### 通过的检查

- 第三模块净化器开局 70/100；起始混乱公式与 0 / 15 / 50 三个锚点
- 效果分母锁死 100；加厚只抬血池
- 加厚 12/20/32、三档 +15、三模块同涨、不吃蜕变折扣、不计稳定度
- 出击混乱一次合成；`initial_chaos` 不二次穿越阈值
- abyss 65% / stitch 三向在第三承血模块列入后成立；CSV 未改
- 三棱锥台顶点与加厚桩色/半径死约束
- 屏幕空间挂 `#dom-ui-root`；无新 HUD 根
- 老存档缺字段不判损坏；缺省档 0 + 补第三件
- 出击起始生命常量与 `growth_vitality` 未改
- `npx tsc --noEmit` 退出 0

---

### 建议

1. 非阻断：存续报告净化器卡把「起始混乱」与整数拆成与出击装配同一套表名节点 / 数字节点（O1）。
2. 非阻断：`loadState` 在存档模块列表缺 `PURIFIER` 时强制写 70 / 当前档 `maxHp`，不依赖内存里是否已有一台（O2）。
3. 闪光色若要对齐视觉规格，把 `0xffffff` 换成 `#c8cdd4`（O3）。不挡本 Slice 总判。
4. 审美与「净化器是否读作在干活」归人终审，不在本报告门禁。

优先修复顺序：无阻断。O1 若进人终审前热修，归 art/code 最短改节点，不改公式。
