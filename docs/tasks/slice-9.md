---
status: ACTIVE
slice: 9
created-by: director agent
created-when: 2026-08-19
---

# Tasks: Slice 9 — 音乐 / 音效

权威：`docs/progress/current-slice.md`。DEC-064。禁止再问人。

---

## Task: D1 | assignee: design

Title: 新建 `docs/specs/system-audio.md` | Priority: P0

先读 `docs/audio-direction.md` 全文、`docs/architecture.md`「音频技术规范」+ 模块注册表 AudioManager 行、`docs/specs/_template-system.md`。

产出一份可实现 spec（一个系统一个文件）。必须锁死：

1. **几乎全表**：5 条场景氛围（菜单 / 净化点 / 裂隙基准 / 裂隙高混乱 / 冲击）+ 裂隙四层混音（Base / Tension / Threat / Proximity）+ §4.2 清单 SFX。逐条给出 asset key、时长档、触发源（哪个场景/事件）、循环与否。
2. **`enemy-overwriter-hum` → 改写体**。禁止第三种敌人。渗透体用 idle；改写体用更远可闻的 hum（方向文档 10–15 tile）。
3. **AudioManager API**（对齐方向文档 §10，可收窄为现行）：playBGM / stopBGM / playSFX / playAmbient / stopAmbient / setLayerVolume / playSpatialSFX；分组 Master/BGM/Ambient/SFX；**同时 8 轨**；溢出踢最早/最低优先级；UI SFX 不被踢；首次交互解锁。
4. **占位合同**：每个 key 必须有非空 `.ogg` + `.mp3`；禁止 0 字节；禁止运行时 Oscillator 冒充已交付资产（方向文档 §9 临时代码占位作废）。
5. **禁止 jump scare**：任何 SFX 峰值与起音不得做成突然巨响；冲击/警戒是低频压迫不是惊吓。
6. 声明现有钩子：`AISystem` cue、`CombatSystem` 可选音、pause 的 pauseAll/resumeAll 由谁接到 AudioManager。
7. 不做音量设置面板、不做新 HUD。默认音量用方向文档 5.3。
8. `last-modified-date: 2026-08-19`。`interface-changed: true`（新系统）。`exposes` 写清。

禁止：向人提问、写 `src/`、Slice 10、发明设置页。

交回：文件路径、key 总数、与 audio-direction 有意砍掉的条目（若有，必须极少且写理由）。

---

## Task: A1 | assignee: art

Depends: D1。

Title: 占位音色配方（非 UI）

先读 D1 spec + `docs/audio-direction.md`。本任务**不是** in-game UI。不要新 hex、不要新面板。

锁死占位合成配方：dark ambient / industrial drone；低频 hum；UI 干、短、金属微动；敌人非动物。禁止 8-bit beep、禁止正弦波警报、禁止 jump scare 起音。写进 spec 附录或 `docs/art/audio-placeholders.md`（短）。`audio-direction.md` 表「状态」列等资产进仓库后再改「占位已生成」。

禁止写 `src/`。

---

## Task: C1 | assignee: code

Depends: D1+A1。

`AudioManager` 落到 `src/managers/audio-manager.ts`。Boot 预加载全部 key 的 ogg+mp3。场景/事件按 spec 接线。同时 8 轨。首次交互解锁。生成脚本产出非空 OGG+MP3（ffmpeg/sox 合成 drone）。`tsc` 必须过。架构注册表改为已实现，`changed-this-slice: true`。

禁止空文件、禁止 jump scare 合成、禁止音量设置 UI、禁止改生成器连通。

---

## Task: Q1 | assignee: qa

Depends: C1。写 `docs/qa/report-slice-9.md`。核对：每个声明 key 双格式非空；8 轨；无 jump scare 契约；AudioManager 已实现；pause/unlock。跑 `npx tsc --noEmit`。本任务未开。
