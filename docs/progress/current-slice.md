---
status: COMPLETE
created-by: director agent
created-when: 2026-08-19
last-modified: 2026-08-20
note: Slice 9「音乐 / 音效」COMPLETE。QA PASS。DEC-064 的 7/8/9 已完。Slice 10 不做。Slice 9 之后表现收口：DEC-069 崩坏簇接到出击烤漆；DEC-070 练习场整团胀缩呼吸人眼 PASS，出击暂不挂活层（不是新 Slice）。
---

# Slice 9: 音乐 / 音效【COMPLETE】

类型：**系统 Slice**
日期：2026-08-19 开工
上一手：Slice 8「第二敌人」COMPLETE（`69281ee`）

**范围已锁（DEC-064），禁止再问人。**

---

## 验证问题

玩家不看文档，进出菜单 / 净化点 / 裂隙，能否感到：

1. **空间有声音质地。** 五个场景氛围能分开（菜单、净化点、裂隙基准、裂隙高混乱、冲击），不是静默或缺文件。
2. **裂隙会分层。** 混乱升高或被发现时层变厚，不是另切一首曲子硬切。
3. **动作有短声。** 清单上的 SFX 能响；同时不超过 8 轨；没有 jump scare。

不验证正式作曲替代占位、不验证 NPC、不做音量设置面板。审美/听感待人终审。机器闸门 PASS。

---

## 人已锁定（DEC-064）

| 项 | 锁 |
| -- | -- |
| 范围 | `docs/audio-direction.md` **几乎全表** |
| 资产 | 仓库生成 OGG+MP3 占位音（ffmpeg/sox/脚本合成 drone，**不要空文件**） |
| 代码 | 实现 `AudioManager`；架构注册表从「规划中」改为已实现 |
| 上限 | 同时播放 **8** |
| 禁止 | jump scare；空 ogg/mp3；Slice 10；撤离多样性；新 HUD / 音量滑条面板 |

---

## 验证是否依赖界面

**不依赖新界面。** 声音挂现有场景与事件。不做设置页。

---

## 推进顺序

| 步 | 谁 | 做什么 | 状态 |
| -- | -- | ------ | ---- |
| 0 | director | 一致性检查 + 本文件 + 任务书 | **已做** |
| 1 | design | **D1** 新建 `docs/specs/system-audio.md` | **已做** `dda62ab` |
| 2 | art | **A1** 占位音色配方 | **已做** `266f22c` |
| 3 | code | **C1** 生成 OGG+MP3 + AudioManager + 场景接线 | **已交** `caddf4c` |
| 4 | qa | 对照规格 | **已交**（`docs/qa/report-slice-9.md`，PASS） |

---

## 一致性检查（2026-08-19，开 Slice 9）

无阻断。开 Slice 时无 `system-audio.md`、无 `audio-manager.ts`。本 Slice 已补齐。

## 收尾四项

1. **架构登记**：`docs/architecture.md` AudioManager 已实现（Slice 9）。`changed-this-slice` 已复位。
2. **spec**：新建 `docs/specs/system-audio.md`（39 key、8 轨、无 jump scare）。`interface-changed` 已复位。配方 `docs/art/audio-placeholders.md`。
3. **交付范围**：5 条场景氛围 + 裂隙四层混音 + §4.2 短音；每 key 非空 OGG+MP3（`assets/audio/` 与 `public/assets/audio/`）；同时 8 轨；暂停/解锁走 AudioManager。无音量面板。听感待人终审。
4. **UI 清单**：本 Slice 无新游戏内界面。未走 in-game-ux 翻修。U1–U12 不逐条勾。

DEC-064 锁的 Slice 7/8/9 均 COMPLETE。Slice 10 不做。

---

## Slice 9 之后表现收口（不是新 Slice）

| 决策 | 内容 | 状态 |
| ---- | ---- | ---- |
| DEC-066 / 068 | 敌人程序像素；玩家加厚像素 + 灯尘接到出击 | 已交 |
| **DEC-069** | 裂隙地面污染 = 崩坏簇；生产默认 `cluster`；出击与练习场同一套烤漆 | 画面锁仍有效。晶结 / 溶蚀 / 平涂仅练习场对照 |
| **DEC-070** | 练习场活层：内核烤死；中间层与外层同一相位、几乎不透明，沿簇不规则外沿整团胀缩（幅度 5–20%） | **练习场人眼 PASS**（「非常棒」「呼吸的效果有了」）。出击不挂活层。迷雾下亮度待看出击，未完成 |

轻量路径收尾四项（DEC-069 / DEC-070，已做）：

1. **架构登记**：`docs/architecture.md` 已登记 `cluster-pulse.ts` 与 `RiftSurfacePainter` 默认 `cluster`；活层只开练习场。
2. **spec 判断**：不新建 spec。规则写进 `docs/art/rift-fragment-surfaces.md`；`docs/specs/system-map-generation.md` 规则 27 写污染怎么画 + 练习场活层。
3. **交付范围**：本段。出击烤完整团；练习场崩坏簇叠活层。晶结 / 溶蚀 / 平涂只留练习场对照。
4. **UI 清单**：无新 HUD，不适用。
