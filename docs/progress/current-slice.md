---
status: COMPLETE
created-by: director agent
created-when: 2026-08-11
last-modified: 2026-08-11
completed: 2026-08-11
note: Slice 4 完成。Data Pipeline + Defense Engine + Common Tier 全部实现并验证。
---

# Slice 4: Data Pipeline + Defense Engine + Common Tier 【COMPLETE】

类型：系统 + 内容
日期：2026-08-11 启动 / 2026-08-11 完成
验证问题：**数据驱动的污染物管线是否正确加载并区分逐类行为？防御效果（减伤 + 副作用）是否让装备选择有意义地不同？被动工具是否创造了区别于主动工具的独特玩法？**

### 验证结果：PASS

- CSV 管线生成 18 种类型数据，构建期类型安全编译正确区分逐类行为
- 防御引擎实现 Common 档全部 7 种特殊机制 + 副作用，让 slot 选择有意义地不同
- 被动工具（碎影 scatter / 消声步 muffle）提供无操作的策略层，区别于主动工具
- 试玩后额外完成：9 项 bug/体验修复 + 净化点 UX 重构（世界内零文字交互 + 底部提示条 + HUD 面板化）
- 遗留项：永久改造深度扩展（Slice 5 设计任务，CSV 已有占位列）

---

## 范围推导

Slice 3 验证了污染物循环核心（获取 -> 防御 -> 转化 -> 工具 -> 破碎）但只实现了 3 种（solidify/delay/erode），且防御阶段实际上不减伤（只累积充能）。CSV 定义了 18 种污染物各有独特防御行为和工具效果，但代码未消费 CSV。

Slice 4 解决三个架构缺口：
1. **CSV 数据管线**：构建期将策划 CSV 编译为类型安全的 TypeScript，代码从生成文件读取
2. **防御效果引擎**：冲击时按类型施加不同减伤 + 副作用，让装备 slot 选择有策略深度
3. **被动工具架构**：不需按键、事件触发的工具类型，扩展出击策略维度

同时实现 Common 档全部 7 种的完整行为（6 种新 + solidify 已有），验证管线端到端。

### 锁定的 Slice 4 范围

**P0（必须）：**
1. CSV 构建期代码生成管线（contaminants.csv + upgrades.csv -> src/generated/*.ts）
2. ContaminantType 扩展至 18 种（类型声明）
3. 防御效果引擎（per-type 减伤 + 5 种防御分类逻辑 + 副作用系统）
4. Common 档 7 种防御效果实现（含副作用）
5. 被动工具架构（事件钩子 + 使用次数消耗 + HUD 区分）
6. Common 档 4 种主动工具实现（ruminate/retrograde/kindle/stitch）
7. Common 档 2 种被动工具实现（scatter/muffle）
8. 集成接线（impact-system 调用防御引擎、rift-scene 调用被动检查、节点系统刷新）

**P1（应该）：**
9. 混乱值里程碑视觉效果（50/75/100 阈值）[from backlog]
10. 裂隙坍缩场景过渡效果 [from backlog]

### 暂不纳入

- Fine/Rare 档工具效果实现（Slice 5）
- 第二种敌人类型（Slice 5）
- 新增改造项（Slice 5）
- 正式美术资产 sprite（并行不阻塞）
- C3 工具视觉效果（需全部工具就位后统一做）

---

## 设计取舍（已由人拍板，2026-08-11）

| # | 决策点 | 人的决定 | 说明 |
| - | ------ | -------- | ---- |
| 1 | CSV 管线方式 | **构建期生成 .ts** | 类型安全、tree-shakeable、无运行时解析开销 |
| 2 | 防御副作用范围 | **Slice 4 实现 Common 7 种全部副作用** | 不做半吊子，验证完整副作用循环 |
| 3 | 内容拆分 | **Slice 4 = 基建 + Common，Slice 5 = Fine/Rare + 敌人 + 改造** | 先验证架构再填内容 |

---

## 任务进度

> 派发列：:green_circle: Director 可直接派发 / :red_circle: 人主导。详细 Brief 见 `docs/tasks/slice-4.md`。

| ID | 任务 | Agent | 派发 | 状态 | 依赖 | 备注 |
| -- | ---- | ----- | ---- | ---- | ---- | ---- |
| T1 | CSV Build Pipeline | code | :red_circle: | Pending | - | 构建期生成 typed .ts |
| T2 | Type Expansion + Generated Data Integration | code | :red_circle: | Pending | T1 | 扩展到 18 种 + 接入生成数据 |
| T3 | Defense Effect Engine Architecture | code | :red_circle: | Pending | T2 | 冲击时调用的防御引擎 |
| T4 | Defense Effects — Common Tier Implementation | code | :red_circle: | Pending | T3 | 7 种防御行为 + 全部副作用 |
| T5 | Passive Tool Architecture | code | :red_circle: | Pending | T2 | 事件驱动被动工具框架 |
| T6 | Common Active Tools (ruminate/retrograde/kindle/stitch) | code | :red_circle: | Pending | T2 | 4 种新主动工具 |
| T7 | Common Passive Tools (scatter/muffle) | code | :red_circle: | Pending | T5 | 2 种被动工具 |
| T8 | Integration Wiring | code | :red_circle: | Pending | T3,T4,T5,T6,T7 | 全系统接线 |
| T9 | Chaos Milestone Visuals [P1] | code | :red_circle: | Pending | - | 50/75/100 视觉+旁白 |
| T10 | Rift Collapse Transition [P1] | code | :red_circle: | Pending | - | 替代当前纯黑屏过渡 |
| T11 | QA Verification | qa | :green_circle: | Pending | T1-T10 | spec 对照验收 |

---

## 设计产出（本 Slice 新增/修改的文档）

- [ ] docs/tasks/slice-4.md（Director 已拆解）
- [ ] src/generated/contaminant-data.ts（T1 生成）
- [ ] src/generated/upgrade-data.ts（T1 生成）
- [ ] src/systems/defense-effect-system.ts（T3 新建）

---

## 下一步

Slice 4 已完成。进入 Slice 5 规划。
