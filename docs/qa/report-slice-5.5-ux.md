---
status: REVIEW
created-by: director (qa 口径补写)
created-when: 2026-08-15
slice: 5.5
note: |
  QA 子代理两轮未产出文件；Director 按授权用 Read/Grep 补闸门证据。
  机械通过 ≠ 审美通过。不代人勾好看 / 像游戏 / PASS。不标 Slice COMPLETE。
  CRT demo HTML 只作对照，实现真相以 src/** 为准。
---

## QA Report: Slice 5.5 游戏内全部 UX（闸门证据）
Slice: 5.5
日期：2026-08-15
Spec 版本：`docs/specs/_template-ui.md` U1–U12；Kit `docs/design-notes/ui-art-overhaul.md` §A0/A1/A5-5；IA `docs/design-notes/ux-information-architecture.md`；architecture overlay `#dom-ui-root`
代码范围：`src/ui/dom/**`、`src/scenes/**`、`src/ui/minimap.ts`、`src/ui/contaminant-names.ts`、`src/main.ts`、`src/systems/run-controller.ts`

开工闸门：已 Read `.cursor/skills/in-game-ux/SKILL.md` 自检 1–8（本报告用证据作答，不写口号）。

机器闸门：`npm run typecheck` 通过（2026-08-15）。仓库无 `npm test` script，未跑测试。未跑浏览器实机。

---

### 功能验收结果（U1–U12）

状态词：**证据成立** / **确定偏差** / **证据不足（需试玩）**。不写审美 PASS。

| 规则 | 实现状态 | 备注 |
| ---- | -------- | ---- |
| U1 载体 + 挂载根 | 部分确定偏差 | S3–S8 / S2 / S10 / toast / Esc / 裂隙结算挂 `#dom-ui-root`（`getDomUiRoot`）。裂隙 HUD 已是 DOM，不再走 Phaser `scrollFactor(0)`。**确定偏差**：小地图 `minimap.ts:104` `document.body`；场景过渡 `purification-scene.ts` / `run-controller.ts` 挂 `document.body`；窗口失焦 `main.ts:41` 挂 `document.body`；debug 挂 `#game-container`（`rift-scene.ts:885`）。主菜单是 Phaser Text（元界面，architecture 未强制 DOM）。Kit §A0 仍写 `hud.ts`——规格过期，不是实现回退。 |
| U2 无后台气味 | 机械层部分成立；审美证据不足 | 无圆角卡片堆；`.game-panel` 无 `box-shadow`。**确定偏差（机械）**：共享层仍有 `:hover` 伪类（`panel-styles.ts` option/tile/slot/action-btn）；`cursor:pointer` 在键印与暂停行；过渡用 `inset` teal glow（`purification-scene.ts:798-802`、`run-controller.ts:194-198`）。过本条机械扫 ≠ 读作游戏。审美待人终审。 |
| U3 色彩合规 | 部分确定偏差 | 主文字收敛到 `#c8cdd4` / `#8a8f96`。**确定偏差**：boot `#222/#666/#ccc`（`boot-scene.ts`）；loadout / 裂隙结算 common `#1a6b5c`（`loadout-panel.ts:28`、`rift-result-panel.ts:41`）在磷光底上对比度约 **3:1**，低于 4.5:1。S4/S6 注释写明已改掉该色，未传到 S5/裂隙结算。`#1a1e22` / `#0a0a0a` 近色未入 `palette.json`（可能问题）。 |
| U4 排版合规 | 部分确定偏差 | DOM 玩家文字静态扫描 **≥12px**（基元 12/13/16）。**确定偏差**：裂隙结算标题 **18px**（`rift-result-panel.ts:91`）；失焦层 **20px**（`main.ts:39`）；debug **11px**（非玩家 UI，记可能）。Kit 标题档是 ≥16；`.panel-title` 却是 12px 暗字——规格内部分裂，需人看是否读得出。 |
| U5 术语合规 | 确定偏差 | 本地 `TYPE_NAMES`/`TOOL_NAMES` 已清，名走 `contaminant-names.ts`。**确定偏差**：可见软件词「新存档/读取存档/确认/购买/库存/点击继续/Loading...」；裂隙 HUD 标签 `HP`（`rift-hud.ts:292`）；S8「HP 均摊」；UI「污染物」vs 术语表「污染体」；裂隙结算拾取用 `getToolName`（残渣阶段应走防御名，`rift-result-panel.ts:107`）。混乱档「稳定/渗透/侵蚀/临界」上屏但未入术语表（已知债，仍成立）。 |
| U6 不遮挡 | 证据不足 + 部分成立 | S2 贴顶、S10 四角，进行中不占中心。S3–S8 打开时游戏暂停、680×468 居中（DEC-049）。Esc / 裂隙结算居中小读出（DEC-049 第 4 条，**符合决策**）。是否「像弹层挡战场」需人看。过渡/失焦全屏挡——失焦是 OS 层，过渡是过场。 |
| U7 输入一致 | 部分确定偏差 | S3–S8 / Esc 有 `keydown`。原生 `title=` tooltip：**玩家 DOM 面板未再发现**（仅 i18n `title` 字段）。**确定偏差**：S5 键印「Enter 装/卸/确认」同一键多义（`loadout-panel.ts:294`）；裂隙结算靠 **R**，S8 靠 **Enter**；检视空态「移动光标查看详情」暗示鼠标。`:hover` 仍在，但检视主路径是选中即检视，hover 不是唯一通道——标可能问题而非阻断。 |
| U8 状态语义 | 部分成立 | 分配「还差」/蜕变「已至上限」/空库存有字。耗尽工具色 `#5a5f66`（`rift-hud.ts:53`）Kit 允许的唯一文字用途；对比度仍约 3:1，灰度后可能只靠位置。需截图。 |
| U9 可读性 | 部分确定偏差 | 字号硬门槛 DOM≥12：玩家层静态成立（debug 除外）。对比度 `#8a8f96` on `#0f1114` ≈ **5.8:1** 成立；`#1a6b5c` 与 `#5a5f66` 作字 **不成立**。表名/数值/档位：S2 三槽分节点成立；裂隙 HUD `◇ ${n}` 无表名（`rift-hud.ts:446`）；检视 L1/L3 仍用 `·` 粘句（`inspect-dock.ts:66-69`）。第二重编码：生命有标签+条+数字；小地图玩家/撤离同形只靠色（已知，仍成立）。扫描线叠 12px 字是否仍能读 = **需截图**。 |
| U10 反馈不静默 | 证据不足 | toast 基元存在（`showToastInline` / `showToastStamp`）。**已知仍成立**：并发无队列，多条会叠。工具持续时间未进 HUD 生效中行。400ms 内是否可见需实机。 |
| U11 一致性 | 确定偏差（机械） | 六块 CRT 都走 `createCrtPanel`（见下表）。Esc / 裂隙结算同 `.game-panel` 但覆盖为 320/360 居中——**符合 DEC-049**，与默认磷光屏并排不是同一占位。小地图 / 过渡 / 失焦 / 主菜单 Phaser 是另一套挂载。Kit §A1 Phaser 换算对裂隙 HUD **已失效**（`src/ui/hud.ts` 不存在）。是否「同一台设备」审美待人终审。 |
| U12 参考锚点 | 证据不足 | 规格层 D1 五款已锁。实现是否与参考并排不违和 = 人终审。本项不能从代码勾。 |

---

### CRT 六块是否走 `createCrtPanel`

| 表面 | 文件 | 证据 |
| ---- | ---- | ---- |
| S3 分配 | `allocation-panel.ts:58` | `createCrtPanel('allocation-panel')` |
| S4 供奉 | `defense-panel.ts:87` | `createCrtPanel('defense-panel')` |
| S5 踏入 | `loadout-panel.ts:100` | `createCrtPanel('loadout-panel')` |
| S6 存续 | `status-panel.ts:77` | `createCrtPanel('status-panel')` |
| S7 蜕变 | `growth-panel.ts:61` | `createCrtPanel('growth-panel')` |
| S8 冲击 | `impact-result-panel.ts:90` | `createCrtPanel('impact-result-panel')` |
| Esc 记录 | `pause-menu.ts` | **不走**工厂；`.game-panel.pause-menu-panel` 320 居中（DEC-049） |
| 裂隙结算 | `rift-result-panel.ts:67` | **不走**工厂；手写 `.game-panel` 360 居中（DEC-049） |

默认壳：`panel-styles.ts` `.game-panel` = 680×468，`top:52px; left:140px`，`border:none`。demo HTML 仍画 1px 边——**不以 demo 为真相**。

---

### 自检 1–8（证据栏）

| # | 证据 |
| - | ---- |
| 1 载体/挂载 | 见 U1。A：S2/S10。B：S3–S8 + Esc + 裂隙结算。C：主菜单。非 overlay 根：小地图、过渡、失焦、debug。 |
| 2 参考 | 规格有 D1。实现是否像 = 证据不足。 |
| 3 P0≤6 | S2 三槽（+消声）≤4。S10：生命/混乱/薪柴/工具/生效中/撤离 —— 组数需人按「组」计；art 记偏多。 |
| 4 哪台机器 | 代码不能代答。磷光扫描线在 `::after`；无金属壳。 |
| 5 不可用写出缺口 | 分配/蜕变/空库存有字。只变灰的耗尽槽：裂隙 HUD `#5a5f66`。 |
| 6 灰度/分开 | 小地图同形；abyss 敌/点同色同方（`minimap.ts`）。S2 分节点成立。检视粘句。 |
| 7 打开/阻断 | 走近/Tab/Esc/归来。S8 单次 Enter。蜕变 `showToastStamp('已刻入')` 是另一条全屏戳。裂隙结算 R。 |
| 8 术语/键盘 | 见 U5/U7。提示键大体=绑定；S5 Enter 多义、结算 R≠Enter。 |

机械层已扫。审美待人终审。不写好看 / 像游戏 / PASS。

---

### 内容验收结果（如有新内容）

本 Slice 不新增玩法条目。CSV 未扩 `summaryDefense`/`summaryTool`（DEC-046 降级仍在 `inspect-dock.ts:44-48`）。

| 检查项 | 结果 | 备注 |
| ------ | ---- | ---- |
| Schema 合规 | ⚠️ | L2 摘要列未进 CSV，实现用截断 |
| 关联引用完整 | ❌ | 裂隙结算拾取阶段名用错 API |
| 数值在平衡范围内 | — | 本审查不验数值 |

---

### 发现的问题

| ID | 类型 | 严重度 | 描述 | 位置 | Spec 依据 | 新旧 |
| -- | ---- | ------ | ---- | ---- | --------- | ---- |
| Q1 | 确定偏差 | High | 裂隙结算拾取/被动列表一律 `getToolName`；刚捡残渣显示工具名 | `rift-result-panel.ts:107,119` | U5；IA 身份链；DEC-045 D4 | **新发现** |
| Q2 | 确定偏差 | High | 小地图 / 场景过渡 / 窗口失焦不挂 `#dom-ui-root`（letterbox 漂移风险） | `minimap.ts:104`；`purification-scene.ts:764+`；`run-controller.ts:146+`；`main.ts:41` | U1；architecture overlay | 小地图=**已知**；过渡/失焦=审查补列 |
| Q3 | 确定偏差 | Medium | common `#1a6b5c` 作字/描边，对比度约 3:1 | `loadout-panel.ts:28`；`rift-result-panel.ts:41` | U3/U9；Kit §A1 ≥4.5:1 | **新发现**（S4/S6 已修未传播） |
| Q4 | 确定偏差 | Medium | 可见软件词 + `HP` +「污染物」 | 主菜单/Esc/S7/S10/S8/boot | U5 | 部分**已知** |
| Q5 | 确定偏差 | Medium | CRT 内部分区合同未进 src，P1 与库存同卷滚动 | S3–S8 vs `menu-crt-_layout.md` | IA P1；DEC-049 只锁壳 | **新发现**（相对 demo 合同） |
| Q6 | 确定偏差 | Medium | L2 仍是长描述截断；无 CSV 摘要列 | `inspect-dock.ts:44-48` | D6 / DEC-046 | **已知**仍成立 |
| Q7 | 确定偏差 | Low | 工具持续时间未进 HUD；toast 无队列 | `rift-hud.ts`；`panel-styles.ts` `showToastInline` | U10；IA S10/S14 | **已知**仍成立 |
| Q8 | 确定偏差 | Low | 小地图玩家/撤离同形只靠色；abyss 敌/点同色同方 | `minimap.ts` | U9 第二重编码 | **已知**；abyss 加重 |
| Q9 | 确定偏差 | Low | 主菜单无存档摘要 | `main-menu-scene.ts` | IA S1 | **已知** |
| Q10 | 可能问题 | Medium | 680×468 居中玻璃 + 扫描线叠字是否装置/是否可读 | `.game-panel` | U6/U9/U11 | 需截图 |
| Q11 | 可能问题 | Low | debug 11px、挂 game-container；默认 `display:none` + `debugVisible=false` **成立** | `rift-scene.ts:87,883-885` | S11 / D 默认关 | 默认关=证据成立 |
| Q12 | — | — | R1 无假二选一控件；被发现指示未做 | — | D9 / D8 | **已知**，范围内不做 |

---

### 回归检查

| 已有声明（C0–C6 / R3–R7） | 状态 | 备注 |
| ------------------------ | ---- | ---- |
| `#dom-ui-root` + Scale.FIT 绑定 | ✅ 对已迁表面 | `main.ts:22` `bindDomUiRootToGame`。漏网见 Q2 |
| V1 hint 对比度 | ✅ | `.hint` `#8a8f96` |
| 裂隙 HUD 迁 DOM | ✅ | `rift-hud.ts`；`hud.ts` 不存在 |
| debug 默认关仅 F1 | ✅ | `debugVisible=false`；`display:none` |
| 原生 title tooltip 清除 | ✅ | 玩家面板无 `title=` |
| S2 贴顶三槽 DEC-047/048 | ✅ | `purification-hud.ts` flex row gap 32px；不套 `.game-panel` |
| S3–S8 `createCrtPanel` 680×468 | ✅ | 六块都走工厂 |
| Esc / 裂隙结算小读出 | ✅ | 符合 DEC-049 第 4 条 |
| 名称单一来源 | ⚠️ | 入口在；结算阶段 API 用错（Q1） |
| Kit §A1 Phaser 换算 | ⚠️ 规格过期 | 对裂隙 HUD 失效，Kit 未回写 |
| 稳定度不在 S2 | ✅ | D7 |
| 冲击十项披露 | 证据不足（结构在 src） | 需人看一屏是否真读得出 |

---

### 总结

- **通过条件**：不满足标 COMPLETE / 勾 U 项 PASS 的条件。机器闸门（typecheck）绿。闸门证据有多条确定偏差。审美与「读作游戏」**待人终审**。
- **不挡「可以请人试玩」**：构建可通过；debug 默认关；真 HUD 在 DOM 上。人可以按 current-slice 试玩路径看。
- **必须人看游戏**：CRT 压场景是装置还是弹层；三套 UI 并排是否跳戏；12px+扫描线是否能读；裂隙 HUD 是否「看得见」。
- **建议 Director**：不标 COMPLETE；不代勾好看。确定偏差（Q1/Q3/Q4 阶段名与对比度）可在人看完后单开小批 code；成体系裂口先等人点名再开 art。

不建议 Director 标 COMPLETE。审美待人终审。
