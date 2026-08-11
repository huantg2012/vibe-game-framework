---
status: ACTIVE
purpose: 轻量 issue 收集——playtest 反馈中产生的临时待办、发现的 bug、未即时修复的体验问题。
rule: Director 在每次 playtest 反馈处理后，将未即时修复的项追加到此文件。每个 Slice 规划时消费此列表。
---

# Backlog Issues

> 格式：`- [ ] 描述 (来源/日期)`。完成后打勾。每 Slice 规划时 review 此列表决定纳入哪些。

## 待处理

- [ ] `abyss` 减伤上限 65%（CSV 写"3 模块均低于半血"）在当前 2 模块下触不到，真实上限 50%；`stitch` 文案同样假设 3 模块 → Slice 7 加第三模块后自动成立，届时复核 (Slice 5 / 2026-08-12)
- [ ] 四个工具占位数值 CSV 结构装不下，暂存 `constants.ts`：`combust` 每秒伤害、`mirror` 诱饵接触半径、`resonate` 两点最大距离（CSV 字段 0，同构的 `stitch` 是 96px，疑为数据疏漏）、`abyss` 的第二计时（5s 混乱惩罚，CSV 每行只有一个 duration 列）→ 需给 CSV 扩列才能回归策划数据源规则 (Slice 5 / 2026-08-12)
- [ ] `purification-hud` 未套 `.game-panel`——该文件设计为无边框符号网格，与 `.game-panel` 风格互斥，code agent 选择延续其自身符号语言。**需 QA/人确认这个判断** (Slice 5 / 2026-08-12)
- [ ] `GameState.incrementIntensity()` 的 +0.15 残留仍在每次冲击末尾被调用（结果总被潮汐覆盖，玩法无影响，但两次访问之间 `getImpactIntensity()` 会返回过期值）；`DefenseContext.stabilityProgress` 恒为 0（`stabilityTracker` 未接入） (Slice 5 / 2026-08-12)
- [ ] `architecture.md` 的「项目结构」ASCII 目录树列了三个不存在的文件（`entities/interactables.ts`、`ui/components/status-bar.ts`、整个 `generation/` 五个文件）——T0 只补核了模块注册表，目录树不在范围内 (Slice 5 T0 / 2026-08-12)

- [ ] `docs/content/progression.md` 至今是空 `status: TEMPLATE`——内容条目的真相实际在 `data/*.csv`，该目录无人写也无人读（"产出无人消费"信号）。Slice 5 收尾二选一：填充为 CSV 的人读索引 / 删除并从 CLAUDE.md 文档体系移除 (Slice 5 一致性检查 / 2026-08-12)
- [ ] 敌人属性全在 `constants.ts` 的 `GAME_CONSTANTS.AI`，与 CLAUDE.md「策划数据源规则」（明确把"敌人属性"列为必须 CSV 起源）冲突 → Slice 6 第二敌人开工时必须拍板：建 `data/enemies.csv` 并迁移渗透体，还是显式破例 (Slice 5 一致性检查 / 2026-08-12)
- [ ] BoundaryBreath 槽位满时"替换最旧"实际总是替换 `impacts[0]`，不是真正最旧 (design 补写边界 spec / 2026-08-12)

## 已处理/已归档

### Slice 5 消费（2026-08-12，待人验收）

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
