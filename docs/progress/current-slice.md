---
status: COMPLETE
created-by: director agent
created-when: 2026-08-09
last-modified: 2026-08-10
note: Slice 3 完成。角色成长 + 潮汐经济验证通过。
---

# Slice 3: 角色成长 + 潮汐经济 【COMPLETE — 2026-08-10 验证通过】

类型：系统
日期：2026-08-09 启动 / 2026-08-10 验证通过
验证问题：**潮汐节奏 + 污染物循环 + 永久改造**是否打破了必然下行螺旋？玩家是否感到"这次出击有所积累、不是在等死"？改造投资的时机选择（现在修模块 vs 存钱买改造）是否构成有意义的纠结？

## 验证结果：PASS

- **结论**：潮汐节奏 + 污染物循环 + 永久改造打破了必然下行螺旋。玩家确认"体验尚可"，动态平衡让人想继续。成长回路下压力递增与能力递增的拉扯体验成立。
- **试玩中修复**：
  - 净化点 HUD 可见性（DOM overlay 调整）
  - 冲击触发时机（修正为仅从裂隙返回时触发，不在首次进入净化点时触发）
  - 薪柴显示修复
- **追加的 UX 改善**（6 项 game-feel 修复）：
  - 信息可见性改善
  - 效果描述完善
  - 语言统一（中文 UI 一致性）
  - 潮汐提示优化
- **已注册的后续工作**：Slice 3.5 UX 打磨（12 项）已写入 roadmap

> 范围已锁定（2026-08-09）。五项取舍由人拍板：① TideSystem 状态机替代线性递增；② Slice 3 实现 3 种污染物（覆盖三档）；③ 3 个永久改造（每轴 1 个）；④ localStorage 持久存档；⑤ 美术门禁并行不阻塞。任务 Brief 见 `docs/tasks/slice-3.md`。

---

## 范围推导

Slice 1 验证了裂隙出击环的 moment-to-moment 博弈。Slice 2 验证了净化点环的资源分配纠结。但两个 Slice 结合后暴露了核心问题：**线性递增的冲击强度 + 无能力成长 = 必然的下行螺旋**。玩家感觉"反正会死，只是时间问题"。

Slice 3 通过四个子系统同时解决这个问题：
1. **潮汐模型**：压力有涨有退（不再只涨），给玩家"低谷期积攒资源"的窗口
2. **污染物循环**：裂隙中获取的东西不只是薪柴——污染物先当防御盾，再变出击工具
3. **永久改造**：薪柴的第三个去处，投资自身能力使后续出击更高效
4. **稳定度**：长期进度目标，所有"做对了的事"都在向终点推进

完整循环从 Slice 3 开始有正向反馈：
```
裂隙出击 → 获取薪柴+污染物 → 撤离
→ 净化点：分配薪柴（模块修复 / 改造投资）
→ 冲击结算：防御 slot 减伤 + 转化为工具
→ 下次出击：带工具+改造加成 → 更高效的出击
→ ...（正向积累 vs 潮汐压力 的拉扯）
```

### 锁定的 Slice 3 最小范围

**P0（必须）：**
1. TideSystem（5 Tide 状态机，替代线性 intensity）
2. ContaminantSystem（库存 + 防御 slot + 生命周期）
3. 3 种污染物完整实现（固化→凝锁、延时→时裂、侵蚀→侵蚀领域）
4. GrowthSystem（3 个永久改造 + 费用曲线）
5. StabilityTracker（进度条 0-100%）
6. SaveManager（localStorage 持久存档）
7. 裂隙污染物节点（新节点类型 + 拾取）
8. 出击工具系统（3 种工具 + 键位 Q/F）
9. 防御 slot 管理 UI
10. 出击前 loadout 选择 UI

**P1（应该）：**
11. 改造祭坛 UI
12. 潮汐信息 + 稳定度 HUD

### 暂不纳入

- 其余 7 种污染物（延后到内容 Slice）
- 其余 6 个改造项（延后到 Slice 4+）
- 终局内容（稳定度 100% 后的结局）
- 被动工具实现（本 Slice 3 种均为主动）
- 音效
- 正式美术资产

---

## 设计取舍（已由人拍板，2026-08-09）

| # | 决策点 | 人的决定 | 说明 |
| - | ------ | -------- | ---- |
| 1 | 潮汐模型 | **TideSystem 状态机** | 5 Tide x 3 Phase，打破线性递增的必然下行 |
| 2 | 污染物数量 | **3 种（固化/延时/侵蚀）** | 覆盖三档 rarity，效果差异大，实现可控 |
| 3 | 改造数量 | **3 个（每轴 1 个）** | 验证改造循环，不过度扩展内容量 |
| 4 | 存档方式 | **localStorage** | 跨 session 持久；自动保存于返回净化点时 |
| 5 | 美术门禁 | **并行不阻塞** | A-G1/A-G2 独立推进，系统任务照常 |

---

## 任务进度

> 派发列：🟢 Director 可直接派发 / 🔴 人主导。详细 Brief 见 `docs/tasks/slice-3.md`。

| ID | 任务 | Agent | 派发 | 状态 | 依赖 | 备注 |
| -- | ---- | ----- | ---- | ---- | ---- | ---- |
| T1 | Types + Events + Constants 扩展 | code | 🔴 | Pending | - | 全部后续任务的类型基础 |
| T2 | TideSystem 状态机 | code | 🔴 | Pending | T1 | 替代线性 intensity |
| T3 | ContaminantSystem 库存+防御 | code | 🔴 | Pending | T1 | 核心生命周期管理 |
| T4 | GrowthSystem 永久改造 | code | 🔴 | Pending | T1 | 3 个改造项 |
| T5 | StabilityTracker | code | 🔴 | Pending | T1 | 积分+进度 |
| T6 | SaveManager | code | 🔴 | Pending | T1 | localStorage 持久化 |
| T7 | 裂隙污染物节点 | code | 🔴 | Pending | T3 | 新拾取物类型 |
| T8 | 出击工具系统（3 种） | code | 🔴 | Pending | T3 | 凝锁/时裂/侵蚀领域 |
| T9 | Integration wiring | code | 🔴 | Pending | T2,T3,T4,T5 | 接入现有系统 |
| T10 | 防御 slot 管理 UI | code | 🔴 | Pending | T3,T9 | 净化点 DOM 面板 |
| T11 | Loadout 选择 UI | code | 🔴 | Pending | T3,T8 | 出击前装备选择 |
| T12 | 改造祭坛 UI [P1] | code | 🔴 | Pending | T4,T9 | DOM 面板 |
| T13 | 潮汐+稳定度 HUD [P1] | code | 🔴 | Pending | T2,T5,T9 | 信息展示 |
| T14 | QA 验收 | qa | 🟢 | Pending | T1-T13 | spec 对照验收 |
| A-G1 | 玩家 sprite 32px 验证 | art | 🔴 | Pending | - | 美术门禁，并行 |
| A-G2 | 敌人 sprite 俯视验证 | art | 🔴 | Pending | - | 美术门禁，并行 |

---

## 设计产出（本 Slice 新增/修改的文档）

- [x] docs/specs/system-growth-tide.md（Slice 3 核心 spec，已完成）
- [ ] docs/tasks/slice-3.md（Director 已拆解）

---

## 下一步

Slice 3 已完成验证。下一个 Slice：**Slice 3.5 UX 打磨**（详见 roadmap）。
