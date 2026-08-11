---
status: ACTIVE
purpose: 轻量 issue 收集——playtest 反馈中产生的临时待办、发现的 bug、未即时修复的体验问题。
rule: Director 在每次 playtest 反馈处理后，将未即时修复的项追加到此文件。每个 Slice 规划时消费此列表。
---

# Backlog Issues

> 格式：`- [ ] 描述 (来源/日期)`。完成后打勾。每 Slice 规划时 review 此列表决定纳入哪些。

## 待处理

- [ ] 永久改造深度太浅——设计方向已记录到 upgrades.csv（3 个 Slice 5 设计项），实现推迟 (Slice 4 playtest / 2026-08-11) → Slice 5 设计任务
- [ ] 净化点模块受损三态视觉未实现——规格已在 `ui-art-overhaul.md` B3 (Slice 4.5 / 2026-08-12) → Slice 5+ 或独立打磨
- [ ] `art-direction.md` §6.2/§6.4 由 Director 做了最小事实回填（按钮状态改游戏语义、面板改右侧抽屉），**需 art agent 复核措辞是否符合其规范体系** (Slice 4.5 收尾 / 2026-08-12)
- [ ] `architecture.md` 模块注册表的"规划中"标记大面积过期（GameState / SaveManager / ChaosSystem / HUD / DOM UI 等实际已实现），2026-08-12 只补核了边界/地表/面板三块 → **Slice 5 T0 全量补核**。Slice 5 一致性检查发现欠账更大：另有约 14 个 Slice 2/3/4 模块从未登记（contaminant-system / contaminant-node-system / defense-engine / tool-system / growth-system / tide-system / impact-system / stability-tracker / run-controller / extraction-system / loot-system / trail-system / ui-minimap / purification-module / src/generated）
- [ ] `docs/content/progression.md` 至今是空 `status: TEMPLATE`——内容条目的真相实际在 `data/*.csv`，该目录无人写也无人读（"产出无人消费"信号）。Slice 5 收尾二选一：填充为 CSV 的人读索引 / 删除并从 CLAUDE.md 文档体系移除 (Slice 5 一致性检查 / 2026-08-12)
- [ ] 敌人属性全在 `constants.ts` 的 `GAME_CONSTANTS.AI`，与 CLAUDE.md「策划数据源规则」（明确把"敌人属性"列为必须 CSV 起源）冲突 → Slice 6 第二敌人开工时必须拍板：建 `data/enemies.csv` 并迁移渗透体，还是显式破例 (Slice 5 一致性检查 / 2026-08-12)
- [ ] 清理死常量 `PURIFICATION.BOUNDARY.BREATH_*`（5 个）——旧「整体脉动」方案残留，呼吸层真实调参已内联在 `boundary-breath.ts`；顺手把内联值迁回 constants (design 补写边界 spec / 2026-08-12)
- [ ] 冲击预告方向映射无空间意义——`getForecastAngle()` 把 CORE→左、STORAGE→右（CORE 在中心，"左"是任选的），且只认识两个模块、场景已有五个交互点；与 BoundaryShape 压力主方向叠成两个互不相关的方向暗示 (design 补写边界 spec / 2026-08-12) → **纳入 Slice 5 设计议题 D6**（与 `mirror` 的预告镜像误导、`growth_forecast_clarity` 改造合并讨论）
- [ ] BoundaryBreath 槽位满时"替换最旧"实际总是替换 `impacts[0]`，不是真正最旧 (design 补写边界 spec / 2026-08-12)
- [ ] `system-purification-impact.md` 若干与边界无关的既有漂移未修：MODULE_INITIAL_HP 80↔70、REPAIR_PER_KINDLING 10↔4、BASE_IMPACT_DAMAGE 25↔30；INTENSITY_STEP/MAX_INTENSITY 已被潮汐取代仍列表；规则 2 只写两个交互物体（实为五个）；规则 9 说"不做 localStorage"（SaveManager 已存在） (design 补写边界 spec / 2026-08-12) → 下次改该系统时一并回填
- [ ] `system-growth-tide.md` 的 `exposes` 写 `TideSystem.getCurrentPhase()/getIntensity()`，代码实际是 `getState()/getCurrentIntensity()` (design 补写边界 spec / 2026-08-12)

## 已处理/已归档

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
