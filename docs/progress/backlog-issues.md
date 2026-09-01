---
status: ACTIVE
purpose: 轻量 issue 收集——playtest 反馈中产生的临时待办、发现的 bug、未即时修复的体验问题。
rule: Director 在每次 playtest 反馈处理后，将未即时修复的项追加到此文件。每个 Slice 规划时、或每次游戏迭代开工时，review 此列表。
---

# Backlog Issues

> 格式：`- [ ] 描述 (来源/日期)`。完成后打勾。每 Slice 规划时、或每次游戏迭代开工时 review 此列表决定纳入哪些。

## 待处理

> **DEC-094 盘点（2026-08-23）：** 未勾从 6 条减到 3 条（净 −3）。吸收：簇语法（改写为 I6-P / I6-Q 参数点，不再独立待开）；表面材质上画面（只接脚步，写入地图 spec，取消 I6-H）。删除双记：陈列馆空展位（只留 I4-D）。保留三条见下。

- [x] `minimap.ts` 挂 `#dom-ui-root`（Slice 5.5 R9；收尾划掉 2026-08-16）
- [x] UX Kit §A1 Phaser ×1.5 换算——5.5 收尾回写为 DOM ≥12px（2026-08-16）
- [x] `abyss` 65% / `stitch` 三模块 — Slice 7 已把 PURIFIER 列入 DefenseContext；不改 CSV (2026-08-19)
- [x] 存续报告净化器卡把「起始混乱」与数字写在同一句式（QA Slice 7 非阻断 U9）(2026-08-19) → 2026-08-20 拆成 `stat-label` / `stat-value`
- [ ] 四个工具占位数值 CSV 结构装不下，暂存 `constants.ts`：`combust` 每秒伤害、`mirror` 诱饵接触半径、`resonate` 两点最大距离（CSV 字段 0，同构的 `stitch` 是 96px，疑为数据疏漏）、`abyss` 的第二计时（5s 混乱惩罚，CSV 每行只有一个 duration 列）→ 需给 CSV 扩列才能回归策划数据源规则 (Slice 5 / 2026-08-12)
- [x] `purification-hud` 不套 `.game-panel`——5.5 D3 人批准为 A 类装置读数 (2026-08-12)
- [x] Slice 5 装配纠结观察到 5.5：机制上不是二选一，UX 已讲清。若要真实犹豫回 design（DEC-054） (2026-08-16)
- [x] `GameState.incrementIntensity()` 的 +0.15 残留仍在每次冲击末尾被调用 (Slice 5 / 2026-08-12) → 2026-08-20 删除调用与方法
- [ ] `DefenseContext.stabilityProgress` 恒为 0（字段无消费方；接 `stabilityTracker` 而不改防御公式等于白接） (Slice 5 / 2026-08-12)
- [x] 裂隙混乱条缺一次可见跳变：占漆踩踏 / 占空体积 / 战斗 +5 / 侦测 +3 都会入账，左上条和整数会涨，但没有 spec 已要求的条跳变（无跳字、无来源提示）。练习场句法课没有玩家 HUD，侧栏调试数字不算。合同 `docs/tasks/chaos-hud-jump.md`。不要塞进迭代 5。 (迭代 3 感知缺口 / 2026-08-26) → 2026-08-26 CH-HUD-1/2/3 已交：条头填充 180ms 提亮。人验裂隙左上条；好看不代勾。追击 `▲` / 跨阈整条闪白两次本批未做。
- [x] `architecture.md` 的「项目结构」ASCII 列了不存在的文件（`entities/interactables.ts`、`ui/components/status-bar.ts`、`ui/hud.ts`）(Slice 5 T0 / 2026-08-12) → 2026-08-20 按现行树改；`generation/` 早在 Slice 6 已落地

- [ ] `docs/content/progression.md` 至今是空 `status: TEMPLATE`——内容条目的真相实际在 `data/*.csv`，该目录无人写也无人读（"产出无人消费"信号）。二选一：填充为 CSV 的人读索引 / 删除并从 CLAUDE.md 文档体系移除。**Slice 5 收尾时未处理**——这是框架层判断（文档体系是否该有这一层）而非本 Slice 交付物，转下次 retro 拍板 (Slice 5 一致性检查 / 2026-08-12)
- [x] 敌人属性进 `data/enemies.csv`，渗透体一并迁移（Slice 8 / 2026-08-19）
- [x] 改写体搜寻身体闪与头上指示物共用相位却各加 3 Hz，合计约 6 Hz（QA Slice 8 O1）(2026-08-19) → 2026-08-20 身体只读 `ALERT_BLINK_HZ` 一次
- [x] BoundaryBreath 槽位满时"替换最旧"实际总是替换 `impacts[0]` (design 补写边界 spec / 2026-08-12) → 2026-08-20 按 `elapsed` 最大替换
- [x] loadout / 裂隙结算档位色 `#1a6b5c` 作字对比度约 3:1，低于 Kit ≥4.5:1 (QA Q3 / Slice 5.5 收尾登记) → 代码已是 `#8a8f96`；2026-08-20 核对划掉
- [x] 上屏仍可能混用「污染物」与术语表「污染体」(QA Q4 / Slice 5.5 收尾登记) → 面板已用「残渣」；2026-08-20 改 CSV `erode` 防御长描述
- [ ] **净化点表现层未收口**（AI 视觉审核 / 2026-08-28；**2026-09-01 部分交付**）：Findings P1 的 B2 批次（三模块实体）**部分翻生产**——核心 = v6-B 仪式贴图、净化器 = B1 横卧过滤罐图集（DEC-111 / DEC-ARCH-018）；储藏仍橙色方块（抽卡未定稿）。仍挂起：储藏定稿、四个交互点（P2 / B1）、HUD + 底部提示条（P5 / P6 / B3）、面板信息架构（P7 / B4）、地面 + 外部（P3 / P4 / B5）。8 条诊断 + 分批见 `docs/art/review-2026-08-28/purification-presentation-findings-for-director.md`；给人看的报告见同目录 `report-purification.html`。**P8「玩家暖光」= 迭代 9 已定（DEC-107）；净化点侧是否还要第二刀，等人看完出击暖光再拍。** 迭代 10 编号已被「rift 拾取物读条与翻找」占用。**不开迭代 11**，除非人点名。Q1–Q4 仍待拍（是否开独立迭代 / P7 改到多深 / P4 外部做几个方案 / 「几何体＝占位符」是否上升为美术通则）。

## 已处理/已归档

### DEC-107 分支下线消灭（2026-08-29）

观察项原先挂在 field / isolux 侵蚀 spike 上，随 DEC-107 整支下线，不是修好了。不静默删除。

- [x] I9-LAB5 F4 / F5（留人拍板）— 随 DEC-107 分支下线消灭
- [x] I9-LAB7 拐角溢光 12px 信息泄露观察 — 随 DEC-107 分支下线消灭
- [x] I9-LAB7 F3 模糊拽近 — 随 DEC-107 分支下线消灭
- [x] I9-LAB7 墙脚 AO 偏弱 — 随 DEC-107 分支下线消灭
- [x] I9-LAB7 前锋只重建帧扫描 — 随 DEC-107 分支下线消灭

### DEC-094 吸收 / 去双记（2026-08-23）

- [x] 表面材质上画面 / I6-H — 取消。`surface_material` 只接脚步，列说明写入 `docs/specs/system-map-generation.md`。不补绘制。
- [x] 居民区公寓簇语法未实现 — 吸收进 I6-P / I6-Q（簇是参数点）。本迭代仍不启用该行。灰泥脚步：启用时补 `stepKey`，不另开迭代、不补绘制。
- [x] 「地物段数不可用」— 判断错，未单独建条；`gridWant` 并入 I6-P。
- [x] 陈列馆滚动时空展位 — 从本表删除（避免与 I4-D 双记）。归属仍是迭代 4 合同。

### Slice 5 消费（2026-08-12，已交付；Slice 5 收尾见 DEC-043）

- [x] 永久改造深度太浅 (Slice 4 playtest) → Slice 5 T5：三项新改造落地 + 成长系统泛化（成本改读 CSV、ID 列表收敛单一来源）
- [x] 净化点模块受损三态视觉未实现 (Slice 4.5) → Slice 5 T6，阈值 >60% / 30-60% / <30%
- [x] `art-direction.md` §6.2/§6.4 措辞需 art 复核 (Slice 4.5 收尾) → Slice 5 B3，art agent 补"临界"态并厘清与 `ui-art-overhaul.md` 的权威关系
- [x] `architecture.md` 模块注册表大面积过期 (Slice 4.5) → Slice 5 T0 全量补核：新增 21 行、修正 6 行状态，`changed-this-slice` 已重置
- [x] 清理死常量 `PURIFICATION.BOUNDARY.BREATH_*` (2026-08-12) → Slice 5 B4，删 5 个死常量并迁回 13 个内联值
- [x] 冲击预告方向映射无空间意义 (2026-08-12) → Slice 5 DEC-034：预告改为非空间（目标模块 + 强度档位），方向表达权移交 BoundaryShape 压力可视化
- [x] `system-purification-impact.md` 既有漂移 (2026-08-12) → Slice 5 B1，修 6 项漂移并登记 13 条新规则
- [x] `system-growth-tide.md` `exposes` 与代码不符 (2026-08-12) → Slice 5 B2，另修正"防御 slot 固定 3 个"的过时描述
- [x] **Slice 4 的 8 个工具对敌人无真实效果**——`ToolDebuffs`/`getDebuffs()` 零消费方 (Slice 5 T1 发现 / 2026-08-12) → Slice 5 T7：统一为直连 setter 模式，删除描述符管线；顺带修 `retrograde` 绘制深度低于视野暗雾
- [x] **四处 CSV 承诺但代码从未接的机制** (Slice 5 收口发现 / 2026-08-12) → Slice 5 T8：`resonate` 装备期模块上限 +10%、`siphon` 修复效率翻倍、`proximity_sense_boost`、`muffle` 预告提前一轮（DEC-040）

### 更早

- [x] 动态力场边界缺 spec (Slice 4.5 收尾 / 2026-08-12) → design 就地扩写进 `system-purification-impact.md`（B 组 17 条 + BOUNDARY 数值表 + 六消费方）；**结论：不拆独立 spec**

- [x] architecture.md 未登记 Slice 4.5 三块新系统（边界形态 / 程序化地表 / 共享面板样式层） (Slice 4.5 收尾 / 2026-08-12) → 已登记：模块注册表 6 行 + 「动态力场边界」小节 + DEC-ARCH-009 + DEC-ARCH-005 追加
- [x] 框架在 in-game UX 上产出质量差（人评"必须想办法"）(Slice 4.5 收尾 / 2026-08-12) → 六处落地，见 `guides/99-review.md` FV-01

- [x] 裂隙内混乱值到达重要节点(50/75/100)时给玩家显著提示——视觉效果+旁白文字结合 (Slice 3.5 playtest / 2026-08-10) → 纳入 Slice 4 T9
- [x] 场景过渡"裂隙坍缩"需要视觉表现（画面收缩/teal闪烁/扭曲），当前仅黑屏+文字 (Slice 3.5 playtest / 2026-08-10) → 纳入 Slice 4 T10

- [x] 薪柴溢出——经济模型必然崩溃 (Slice 2 playtest / 2026-08-08) → DEC-026, Slice 3 重设计
- [x] 地图室内感太强 (Slice 1 playtest / 2026-08-07) → 室外地图重设计
- [x] 无法找到撤离点 (Slice 1 playtest / 2026-08-07) → trail + landmarks + minimap + glow
- [x] 冲击面板时机不对 (Slice 3 playtest / 2026-08-09) → 改为返回时显示
- [x] 净化点 HUD 不可见 (Slice 3 playtest / 2026-08-10) → DOM overlay 替代
- [x] Continue 触发冲击 (Slice 3 playtest / 2026-08-10) → 仅从裂隙返回时触发
- [x] ESC→Continue触发冲击 (Slice 4 / 2026-08-11) → fromMenu flag 排除
- [x] 净化点HUD余额不更新 (Slice 4 / 2026-08-11) → createPurifHud 清理旧DOM
- [x] Loadout槽位类型约束 (Slice 4 / 2026-08-11) → 按 toolType 过滤
- [x] 工具uses从CSV读取 (Slice 4 / 2026-08-11) → 转化时从CONTAMINANT_DATA取值
- [x] 混乱阈值提示太短 (Slice 4 / 2026-08-11) → 延长到3s
- [x] 净化点文案样式不统一 (Slice 4 / 2026-08-11) → 统一12px/白色/深色背景
- [x] 防御副作用无感知渠道 (Slice 4 / 2026-08-11) → 出击开始时toast提示来源
- [x] 稳定度增长过快 (Slice 4 / 2026-08-11) → 积分值校准(撤离1/改造1/Crest3/潮汐5)
