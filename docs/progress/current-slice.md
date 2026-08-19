---
status: COMPLETE
created-by: director agent
created-when: 2026-08-19
last-modified: 2026-08-19
note: Slice 7「净化点扩张」COMPLETE。QA PASS。下一手 Slice 8。
---

# Slice 7: 净化点扩张【COMPLETE】

类型：**系统 Slice**（扩已有净化点环，不新开 spec 文件）
日期：2026-08-19 开工
上一手：Slice 6「程序化地图」COMPLETE（2026-08-19，DEC-064）

**范围已锁（DEC-064），禁止再问人。**

---

## 验证问题

玩家不看文档，连续两次出击，能否感到：

1. **第三模块在干活。** 净化器完整度越高，这次出击起始混乱越低；满血时大约从 0 起。残血会带入一部分混乱。不改出击起始生命。
2. **花薪柴抬上限是全局的。** 在改造祭坛旁花薪柴，全部模块的 `maxHp` 一起涨（100→115→130→145，3 档每档 +15）。不是按模块分别升级，本 Slice 不抬效果上限公式。

不验证第二种敌人、音乐、撤离多样性。

---

## 人已锁定（DEC-064）

| 项 | 锁 |
| -- | -- |
| 第三模块 | **净化器**。完整度↑ → 出击起始混乱↓。满血约从 0。不改起始生命。 |
| 模块升级 | 改造祭坛旁新交互。花薪柴永久提高**全部模块** `maxHp`。3 档 +15（100→115→130→145）。不按模块分别升级。不抬效果上限公式。 |
| 复核 | `abyss` 65% 上限与 `stitch` 三模块文案，第三模块落地后对照 CSV / 实现。 |
| 不做 | Slice 8/9/10；撤离多样性；改出击起始生命；新 hex；框架层 A |

---

## 验证是否依赖界面

**依赖。** 第三模块是世界内装置；maxHp 升级是祭坛旁交互。规划选 (a)：足以产生信号的 UX 收进本 Slice。触碰游戏内界面必须先 Read `.cursor/skills/in-game-ux/SKILL.md`，再 art → code。载体：世界内装置（模块实体 + 祭坛交互）；屏幕读数挂 `#dom-ui-root`。

---

## 推进顺序

| 步 | 谁 | 做什么 | 状态 |
| -- | -- | ------ | ---- |
| 0 | director | 一致性检查 + 本文件 + 任务书 | **已做** |
| 1 | design | **D1** 就地扩写 `system-purification-impact.md`（+ 混乱起始句若必须） | **已做** |
| 2 | art | **A1** 第三模块形体 + 祭坛旁加厚交互最短合规核对 | **已做** |
| 3 | code | **C1** 净化器 + 起始混乱 + maxHp 三档 + abyss/stitch 复核 | **已交** |
| 4 | qa | 对照规格 | **已交**（`docs/qa/report-slice-7.md`，PASS） |

批次必须单次会话做完。禁止把「新模块实体 + 全墙机翻修 + 升级经济」打成一批无闸门的 ALL 表面。

---

## 一致性检查（2026-08-19，开 Slice 7）

无阻断。摘要：

- Slice 6 COMPLETE。`interface-changed` / `changed-this-slice` 已复位（`art-direction` 一并复位）。
- 规格 7 份。`system-purification-impact` 已写「第三模块要到 Slice 7」；`abyss` 65% 张力已登记。
- `GameState` 模块类型为 `CORE` \| `STORAGE` \| `PURIFIER`。`moduleMaxHpTier` 抬 maxHp。出击初值读 `getStartingChaos()`。
- backlog 纳入本 Slice：`abyss` 65% / `stitch` 三模块文案复核。不纳入：`enemies.csv`（Slice 8）、CSV 占位列（除非本 Slice 改到那条工具）。
- `docs/content/progression.md` 仍是空模板（已知，不本 Slice 修框架）。

## 收尾四项

1. **架构登记**：`docs/architecture.md` 已写 PURIFIER、加厚点、`startingChaos`。`changed-this-slice` 已复位。
2. **spec**：就地扩写 `system-purification-impact` / `system-chaos-scavenge-extract`。`interface-changed` 已复位。
3. **交付范围**：第三模块净化器；起始混乱满完整度 0、空血 50；加厚 12/20/32、maxHp 100→115→130→145；效果分母锁 100；abyss/stitch 三模块列入。不改出击起始生命。
4. **UI 清单**：先 Read `.cursor/skills/in-game-ux/SKILL.md`。载体 A/B 已核。U1–U12 机械层 QA 已扫。本 Slice 无新 HUD 根。非阻断：存续报告净化器卡「起始混乱」与数字同句（记 backlog）。

下一手 Slice 8。
