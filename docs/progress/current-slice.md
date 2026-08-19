---
status: ACTIVE
created-by: director agent
created-when: 2026-08-19
last-modified: 2026-08-19
note: Slice 9「音乐 / 音效」ACTIVE。范围锁死 DEC-064。不改 roadmap 完成标记直到 COMPLETE。
---

# Slice 9: 音乐 / 音效【ACTIVE】

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

不验证正式作曲替代占位、不验证 NPC、不做音量设置面板。审美/听感待人终审。

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

**不依赖新界面。** 声音挂现有场景与事件。不做设置页。若触碰暂停菜单只接线既有暂停，不改视觉语言。不派 in-game UI 翻修。

---

## 推进顺序

| 步 | 谁 | 做什么 | 状态 |
| -- | -- | ------ | ---- |
| 0 | director | 一致性检查 + 本文件 + 任务书 | **已做** |
| 1 | design | **D1** 新建 `docs/specs/system-audio.md`（从 audio-direction 收口可实现契约） | **完成** |
| 2 | art | **A1** 占位音色配方（dark ambient drone，禁止 8-bit beep / jump scare） | **完成** |
| 3 | code | **C1** 生成 OGG+MP3 + AudioManager + 场景接线 | 未开 |
| 4 | qa | 对照规格：文件非空、8 轨、无 jump scare 契约、架构已实现 | 未开 |

批次必须单次会话做完。禁止把「全表 SFX + 新设置界面 + 正式作曲」打成一批。

---

## 一致性检查（2026-08-19，开 Slice 9）

无阻断。摘要：

- Slice 8 COMPLETE `69281ee`。`interface-changed` / `changed-this-slice` 已复位。
- 规格：7 份 `system-*` + `ui-detection-pulse`。**无** `system-audio.md` → 本 Slice 新建。
- `src/managers/` 现有 GameState / SaveManager / session。**无** `audio-manager.ts`。架构表 AudioManager = 规划中。
- `audio-direction.md` APPROVED，表状态均为「未生成」。清单含 `enemy-overwriter-hum`：本游戏敌人是渗透体/改写体，D1 必须把该键收口到改写体，禁止第三种敌人。
- 已有钩子：`AISystem` audio cue；`CombatSystem` 可选音；`main.ts` / pause-menu `pauseAll`/`resumeAll`。D1 必须声明这些谁消费。
- 架构音频规范：Phaser Sound、MP3+OGG、8 轨、首次交互解锁。与 audio-direction 一致处写入 spec；冲突以 audio-direction 原则 + 本 Slice 锁（占位进仓库、不要空文件）为准。
- 不做：Slice 10、撤离多样性、音量设置 UI、框架层 A。

## 收尾四项

未完成，不得标 COMPLETE。
