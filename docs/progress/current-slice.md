---
status: PLANNING
created-by: director agent
created-when: 2026-08-12
last-modified: 2026-08-12
note: Slice 5 规划中。范围草案已出，等人拍板后写 Task Brief（docs/tasks/slice-5.md）。
---

# Slice 5: 工具库深度（Fine/Rare 完成 + 工具视觉 + 改造深度）【PLANNING】

类型：系统 Slice（补完已有系统的深度，不新建系统边界）
日期：2026-08-12 规划启动
验证问题（草案）：**出击前的"带什么"决策是否变得纠结？拿到一件 Fine/Rare 污染物时，玩家是否会在"当防御吃着"和"攒成工具用"之间真的犹豫？**

> ⚠️ 本文档处于 PLANNING 状态。范围尚未锁定，见文末「待人拍板」。Task Brief 待拍板后补。

---

## Step 1 一致性检查结果（2026-08-12）

### 已自动修正

| 项 | 处理 |
| -- | ---- |
| `art-direction.md` `changed-this-slice: true` 滞留 | 重置为 false（该标记的实际诉求是"art agent 复核措辞"，已在 backlog 单独跟踪，不该占用变更标记位） |
| `system-purification-impact.md` `interface-changed: true` 滞留 | 重置为 false（边界 spec 是对已落地实现的事后描述，六个消费方在写 spec 时已逐个核对） |
| roadmap 写「9 种 Fine/Rare 工具」 | 实测 `contaminants.csv` 为 Fine 6 + Rare 5 = **11 种**，已订正 |
| roadmap 指向 `current-slice.md` 查 Slice 4.5 逐 commit 范围 | 该文件每 Slice 覆写，指针会失效；已改为指向 commit `ad14cf5` |

### 需要报告的不一致（未自行修正）

**1. `architecture.md` 模块注册表的欠账比 backlog 记录的更大。**
backlog 记的是"若干'规划中'标记过期"。实际核对下来，除标记过期外（`GameState` / `SaveManager` / `ChaosSystem` / `HUD` / `DOM UI` 实际都已存在），还有 **约 14 个 Slice 2/3/4 落地的模块从未登记进注册表**：`contaminant-system`、`contaminant-node-system`、`defense-engine`、`tool-system`、`growth-system`、`tide-system`、`impact-system`、`stability-tracker`、`run-controller`、`extraction-system`、`loot-system`、`trail-system`、`ui/minimap`、`entities/purification-module`、`src/generated/`。
→ 排为本 Slice **T0**，先做再开工。`changed-this-slice` 保持 true 直到 T0 完成。（4.5 的教训正是"只补核一部分"，这次不重复。）

**2. 「Fine/Rare 工具」这个说法掩盖了真实缺口的形状。** 见下方「范围推导」——缺的不是 11 件同质工具，是 3 类不同性质的活。

**3. 敌人属性全在 `constants.ts` 的 `GAME_CONSTANTS.AI`，与 CLAUDE.md「策划数据源规则」冲突。**
该规则明确把"敌人属性"列为必须以 CSV 为源。目前只有 `contaminants.csv` / `upgrades.csv` 走了 codegen 管线。第二敌人一旦开工就会把这个矛盾逼到台面（要么建 `data/enemies.csv` 并把渗透体一起迁过去，要么显式破例）。
→ 这是把第二敌人拆出本 Slice 的理由之一。

**4. `docs/content/progression.md` 至今是 `status: TEMPLATE`（空模板）。**
CLAUDE.md 描述的文档体系里 `content/*.md` 承载内容条目，实际内容条目的真相在 `data/*.csv`，这个目录无人写也无人读。属于「某个步骤产出无人消费」的框架信号。
→ 建议本 Slice 收尾时二选一：填充为 CSV 的人读索引，或删除并从 CLAUDE.md 移除。已记框架反馈。

**5. 框架漂移（非阻塞，记 field note）**：director 定义 Step 1 要求核对 CLAUDE.md 的「系统全景」和「内容汇总」两张表格，CLAUDE.md 里不存在这两张表（状态记在"当前阶段"散文段落里）。要么补表，要么改 agent 定义。

### 核对通过

- `docs/specs/` 6 个系统 spec 与 `src/` 模块一一对应，无"标已实现但无代码"的情况
- `docs/tasks/` 命名惯例为 `slice-N.md`（无前导零）；Slice 4.5 无 task 文件符合轻量路径规则
- 改写体 / 覆盖体概念图已 `APPROVED`（2026-07-23），第二敌人的美术前置已就绪

---

## 范围推导

### 「Fine/Rare 工具」的真实缺口

代码核对（`tool-system.ts` / `defense-engine.ts`）后，缺口是三类活，不是一类：

| 类 | 内容 | 量 |
| -- | ---- | -- |
| A. 主动工具效果 | 已实现 8/15。缺 `resonate` `overwrite` `compress` `mirror` `echo` `abyss` `combust` | 7 |
| B. 被动工具 | 已实现 `scatter` `muffle`。缺 `siphon`（击杀吸薪柴 + 混乱增速减半） | 1 |
| C. 防御侧接线 | 18 型中 10 型有专用实现，其余 8 型落到 `applyGenericDefense`，其中 6 处源码里明写 `handled externally` / `future iteration` 从未接线 | 6~8 |

C 类是本 Slice 真正的技术难点——它们要跨系统持久状态，不是在一个 switch 里加分支：

- `resonate` / `erode`：改**其他 slot** 的冲击计数
- `echo`：给工具库里某件工具 **+1 使用次数**
- `mirror`：按实际承伤 **返还薪柴**（需在伤害结算后回读）+ 10% 概率**预告镜像反转**
- `abyss`：按**模块当前 HP** 动态叠加减伤（最高 65%）
- `combust`：跨冲击**累积焚尽值**，达阈值自动爆发治疗
- `overwrite`：25% 概率**模块功能互换**（源码注释判定"Slice 4 太复杂，跳过"）

### 为什么建议把第二敌人拆出去

roadmap 原计划把「Fine/Rare 工具 + 第二敌人 + 新改造 + 工具 VFX + 改造深度」放进一个 Slice。按 director 标准这超了（3-7 天 / 可独立验证）：

- 两块工作验证的是**不同的轴**。工具/改造验证「出击前的装配决策」；第二敌人验证「裂隙内的临场潜行判断」。混在一个 Slice 里，试玩反馈无法归因。
- 第二敌人有独立的前置债（enemies.csv 决策 + `system-enemy-ai.md` 的 `type: 'infiltrator'` 字面量类型泛化 + spec L36 明写"改写体/覆盖体属于后续 Slice"）。
- 单是 A+B+C 三类活（7 工具 + 1 被动 + 6~8 跨系统接线 + VFX）已经是一个完整 Slice 的量。

→ 建议：**Slice 5 = 装配轴，Slice 6 = 第二敌人（潜行轴）**，原 Slice 6/7（净化点扩张 / 程序化地图）顺延为 7/8。

---

## 范围草案

### P0（验证问题直接依赖）

| # | 任务 | agent | 备注 |
| - | ---- | ----- | ---- |
| T0 | `architecture.md` 模块注册表全量补核 | code | 开工前置。~14 个未登记模块 + 过期"规划中"标记 |
| T1 | Fine/Rare 主动工具 7 种效果实现 | code | resonate / overwrite / compress / mirror / echo / abyss / combust |
| T2 | `siphon` 被动工具实现 | code | 补齐被动工具第 3 件 |
| T3 | 防御侧 6~8 处跨系统接线 | design → code | design 先裁定哪些机制原样做、哪些降级（见拍板 3） |
| T4 | 工具使用 VFX（roadmap C3） | **art → code** | 必经 art：载体决策 + 2-3 个具名游戏参考；收尾过 U1-U12 |

### P1（增强，可砍）

| # | 任务 | agent | 备注 |
| - | ---- | ----- | ---- |
| T5 | 永久改造深度扩展（Slice 4 遗留）+ `upgrades.csv` 三项落地 | design → code | 第 4 工具槽 / 第 4 防御槽 / 预告准确率。**第 4 槽位会改 loadout / defense 面板布局 → 触发 U1-U12** |
| T6 | 净化点模块受损三态视觉 | code | 规格已在 `ui-art-overhaul.md` B3 完整给出（含配色），纯实现，不需要 art 再出规格 |

### 顺手清账（与本 Slice 触碰区域重叠，建议纳入）

| # | 任务 | 理由 |
| - | ---- | ---- |
| B1 | `system-purification-impact.md` 既有漂移回填（HP 80↔70 / 修复 10↔4 / 伤害 25↔30 / 过时的 INTENSITY_STEP / 规则 2 与规则 9） | T3 必然要读改这个 spec |
| B2 | `system-growth-tide.md` `exposes` 与代码对齐（`getState()` / `getCurrentIntensity()`） | 一行修正 |
| B3 | `art-direction.md` §6.2/§6.4 措辞复核 | 与 T4 同一次 art 调用里做，零额外开销 |
| B4 | 清理死常量 `PURIFICATION.BOUNDARY.BREATH_*`，内联值迁回 constants | 便宜，且 4.5 刚留下的 |

### 暂不纳入

| 项 | 去向 |
| -- | ---- |
| 第二敌人（改写体） | → Slice 6（独立验证轴 + enemies.csv 前置债） |
| 冲击预告方向映射无空间意义 | → 若 T5 纳入（含"预告准确率"改造）则一并处理，否则推迟 |
| BoundaryBreath 槽位"替换最旧"bug | → 推迟（纯视觉，影响极小） |
| 净化点扩张 / 程序化地图 | → 顺延为 Slice 7 / 8 |
| 音效接入 / i18n 补全 | → 未排期 |

---

## 待人拍板

| # | 问题 | Director 建议 |
| - | ---- | ------------- |
| 1 | Slice 5 是否拆分——装配轴留 5，第二敌人独立为 6？ | **拆**。两轴的试玩反馈无法混在一起归因，且第二敌人有独立前置债 |
| 2 | Fine/Rare 做全 11 种，还是先做 Fine 6 再做 Rare 5？ | **做全 11**。CSV 已定义完毕，防御侧半数已有骨架；砍一半会留下"一部分类型走专用实现、一部分走 fallback"的长期半实现态，比一次做完更难维护 |
| 3 | 是否授权 design 把过复杂的防御机制降级为等效简化版并回写 CSV？（`overwrite` 模块互换 / `abyss` 动态减伤 / `combust` 累积爆发） | **授权**。否则 T3 会变成开放式工程。要求 design 给出降级理由并同步改 CSV 描述文案，避免 CSV 承诺与实现不符 |
| 4 | 顺手清账 B1-B4 是否全收？ | **全收**。四项都落在本 Slice 必然触碰的区域，分开做要重复加载上下文 |
| 5 | P1（T5 改造深度 + T6 三态视觉）是否纳入本 Slice？ | **T6 收，T5 看 P0 落地速度**。T6 规格现成、成本低；T5 的第 4 槽位会动面板布局，是本 Slice 里唯一可能失控的 UI 工作 |

拍板后：写 `docs/tasks/slice-5.md`，`current-slice.md` 转 ACTIVE，按依赖顺序派发。

---

## 派发顺序（拍板后生效）

```
T0（code，前置）
  └─> T3 design 裁定 ──┐
      T4 art 规格 ─────┤
                       ├─> T1 / T2 / T3 code 实现（可并行）
                       └─> T4 code 实现 ──> U1-U12 验收
  T5 design（若纳入）──> T5 code ──> U1-U12 验收
  T6 code（独立，随时）
  B1-B4（随对应任务顺带）
```

**约束提醒（写进 Brief）**：本项目刚修完 in-game UI 的框架弱点（`guides/99-review.md` FV-01）。T4 工具 VFX 与 T5 第 4 槽位面板改动**必须走 art 路径**，art 需先做载体决策并锚定 2-3 个具名游戏参考；收尾逐条过 `docs/specs/_template-ui.md` 的 U1-U12。不允许直接派 code 写样式。
