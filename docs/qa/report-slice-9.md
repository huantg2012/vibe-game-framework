---
status: REVIEW
created-by: qa agent
created-when: 2026-08-19
slice: 9
task: Q1 音乐 / 音效（AudioManager + 39 占位音）
note: |
  对照 system-audio.md / audio-placeholders.md / architecture AudioManager 行。
  机械层已扫。不代勾听感 / 审美。不许自称好听 / 像游戏 / 审美 PASS。
  不标 Slice COMPLETE。
---

# QA Report: Slice 9 音乐 / 音效

日期：2026-08-19  
Spec 版本：`docs/specs/system-audio.md`（`last-modified-date: 2026-08-19`）；`docs/art/audio-placeholders.md`（jump scare / 空文件合同）；`docs/architecture.md` 模块表 AudioManager 行 + 「音频技术规范」  
代码版本：`caddf4c8526f50ad273aec52c3601f41f64faad7`（`feat(slice-9): 接入 AudioManager 与 39 个占位音`）  
范围：Slice 9 C1 接线与占位资产。不是听感验收。不是审美终审。未做人试听。

HOW 已读 `.cursor/skills/in-game-ux/SKILL.md`。本批只给既有面板/暂停菜单加短音，**无新游戏内界面**。U1–U12 不逐条勾。

---

### 总判

**PASS。** 七条必须机械核对全部对齐。无阻断项。不标 Slice COMPLETE。

`npx tsc --noEmit` 退出 0。未跑 `check:layout`（本 Slice 未改生成器）。

听感与「克制即恐惧」待人终审。占位 drone 能播 ≠ 好听。

---

### 必须核对

| # | 项 | 结果 |
| - | -- | ---- |
| 1 | spec 39 key：`assets/audio/` 与 `public/assets/audio/` 都有非空 `.ogg` + `.mp3`（size>0） | **通过**。39×2 格式×2 树 = 156 文件；缺/空 = 0；两树同 key 字节一致。`ffprobe` 抽 `assets/audio/**/*.ogg`：39 条解码时长均 > 0，且落在 spec 时长档内（床 90/120/72 s；短音与配方秒数一致或脚步因 echo 约 0.16–0.18 s，仍在「短」档 0.10–0.30）。 |
| 2 | AudioManager API；MAX 8 轨；UI sfx 不被踢 | **通过（短音闸门）**。十个公开方法均在 `src/managers/audio-manager.ts`。`MAX_VOICES = 8`。`kickable: priority !== 'ui'`，溢出排序永不选 UI。见 O1：循环床/层不走踢轨。 |
| 3 | `src/main.ts` 与 `src/ui/dom/pause-menu.ts` 不再直打 `game.sound.pauseAll` / `resumeAll` | **通过**。两处均调 `audioManager.pauseAll()` / `resumeAll()`。全 `src/` 无 `game.sound.pauseAll` / `host.sound.pauseAll`。 |
| 4 | 冲击音频吃 `ImpactResult` 返回值，不是只听 create 期 `IMPACT_*` 事件 | **通过**。`PurificationScene.create` 在 `impactSystem.run()` 之后用返回值：`skipped === false` → `playImpactAudio(result)`；否则直接净化点床。`IMPACT_STARTED` / `IMPACT_RESOLVED` 无音频监听。 |
| 5 | 无运行时 OscillatorNode 冒充交付；无音量设置面板 / 新 HUD | **通过**。`src/` 无 `OscillatorNode` / `createOscillator`。合成在 `tools/audio-placeholders/generate.mjs`（ffmpeg lavfi，构建期）。无音量滑条、无设置页、无新 HUD。分组音量是常量。 |
| 6 | `enemy-overwriter-hum` 接到改写体，不是第三种敌人 | **通过**。`EnemyRole` 仍只有 `infiltrator` \| `rewriter`。`syncEnemyLoops`：改写体播 `sfx-rift-enemy-overwriter-hum`（追击改 chase），渗透体播 idle/chase。Proximity 只读污染物节点。 |
| 7 | 架构表 AudioManager = 已实现 | **通过**。`docs/architecture.md` 模块表：`已实现（Slice 9）`；API 列为 playBGM / stopBGM / playSFX / playAmbient / stopAmbient / setLayerVolume / playSpatialSFX / pauseAll / resumeAll / unlock。 |

---

### 功能验收（相对 spec 规则）

| 规则 | 实现状态 | 备注 |
| ---- | -------- | ---- |
| A 资产合同 39 key 双格式非空、可解码 | ✅ | 见必须核对 #1 |
| A.3 / 方向文档 §9 禁止运行时振荡器 | ✅ | 运行时只做增益/声像/淡入淡出/距离 |
| B API 10 方法 + unlock | ✅ | `BootScene` `bind`+`unlock`；`MainMenuScene` 再 `unlock` |
| C 分组 1.0 / 0.6 / 0.5 / 0.8，无面板 | ✅ | `MASTER` / `GROUP_*` 常量 |
| D 五条氛围床 | ✅ | 菜单 `bgm-menu-void-pad`；净化点冲击后 isolation + mechanical-hum；裂隙 `bgm-rift-base-drone` + 低混乱 alien-atmosphere；冲击非循环 `bgm-impact-pressure`；高混乱走 Tension 层不切主床 |
| D.16 净化点→裂隙 3.5 s 交叉淡入 | ✅ | `playBGM(..., 3.5)` 同时淡出旧 BGM |
| D.18–19 冲击用 `ImpactResult`；跳过则不播冲击床 | ✅ | |
| D.22 净化点不播 enter | ✅ | `RIFT_ENTERED` 只 emit；`sfx-rift-enter` 仅 `RiftScene.create` |
| D.23 撤离播 exit，死亡不播 | ✅ | `RIFT_EXIT_REACHED` 只来自撤离；死亡走 `PLAYER_DIED` |
| E 四层公式 | ✅ | Tension / Threat / Proximity 与 spec 表一致；`CHAOS.MAX_VALUE = 100` |
| E.26 Proximity 不绑改写体 | ✅ | `getRemainingPositions()` |
| E.27 被发现 Ambient 闪避 0.5s/0.5s | ✅ | `duckAmbientGroup` |
| F 距离曲线 | ✅ | 敌人 5–8、点 3–6、改写体 hum 10–15、边界 0–2；满偏 ≤ 0.7 |
| G `playSFX` volume 不得 > 1 | ✅ | `clamp01` |
| H 8 轨；UI 不踢 | ✅ / 见 O1 | 短音溢出踢最低优先、同样低则最早；`low` 无空位跳过 |
| H.35 敌人循环最多 2 槽 | ✅ | `instanceId` `slot-r` / `slot-i` |
| I overwriter-hum = 改写体 | ✅ | |
| J AI cue / 战斗 `onCue` / 暂停钩子 | ✅ | `setCueListener`；`combat.create(..., { onCue })`；暂停走 AudioManager |
| K 脚步 / 拾取 / 使用 / 混乱 / 分配 / 面板 / 边界 | ✅ | 裂隙 `ITEM_USED`+`TOOL_USED`；净化点加厚失败与分配/蜕变失败播 `sfx-ui-error` |

---

### 内容验收（占位资产）

| 检查项 | 结果 | 备注 |
| ------ | ---- | ---- |
| 39 key 与 spec 资产表一致 | ✅ | `AUDIO_ASSETS` 与 spec 表同名同目录 |
| 双树非空 | ✅ | `assets/audio` 与 `public/assets/audio` |
| 解码时长 > 0 | ✅ | 本地 `tools/audio-placeholders/.bin/ffprobe` |
| jump scare 合成合同 | 见 O4 | 脚本有淡入；未代听。机器 30 ms 窗见观察 |
| `audio-placeholders.md` 状态句 | Spec Issue | frontmatter 仍写「文件尚未进仓库 / 状态仍待生成」。资产已进 `caddf4c`。配方正文仍作合成合同，不当作空文件失败 |

---

### 发现的问题

| ID | 类型 | 严重度 | 描述 | 位置 | Spec 依据 |
| -- | ---- | ------ | ---- | ---- | --------- |
| — | — | — | 无阻断项 | — | — |

### 非阻断观察

| ID | 类型 | 严重度 | 描述 | 位置 | Spec 依据 |
| -- | ---- | ------ | ---- | ---- | --------- |
| O1 | 偏差 | Medium | 占用表第 2–4 行写 Tension / 场景环境 / Threat / Proximity **可被踢**。实现里这些床 `kickable: false`，且 `playBGM` / `playAmbient` / `ensureLayerVoice` 不走 `acquireSlot`（`isBed` 直接放行）。与同 Slice 架构句「循环床不可被踢」更接近。交叉淡入时可能短暂 >8。短音 5–8 溢出与 UI 不踢仍成立。 | `src/managers/audio-manager.ts` `acquireSlot` / `spawn` | 规则 H 占用表；架构「音频技术规范」 |
| O2 | 风险 | Low | `pauseMenu.discard()` 在场景 shutdown 时拆 DOM，不 `resumeAll()`。主路径（合上 / `leaveForSession`）会 resume。若 shutdown 时暂停菜单仍开着，`paused === true` 会挡住下一景 `playBGM`。 | `src/ui/dom/pause-menu.ts` `discard` | 规则 40 |
| O3 | Spec Issue | Low | `docs/art/audio-placeholders.md` 仍声称文件未进仓库。 | 该文件 frontmatter / 第 7–17 行 | 对照过期；以仓库文件为准 |
| O4 | 风险 | Low | 未代听。对压力族与若干短音做了 0–30 ms / 全长峰值比：`sfx-rift-enemy-chase` 0.989、`sfx-ui-warning` 0.977（配方分别写脉冲淡入 20 ms、压力淡入 40 ms）。`sfx-ui-click` / 脚步因总长短，30 ms 窗几乎等于整条。机器窗不能替代听感。 | `assets/audio/**` + `generate.mjs` | 规则 G；A1 禁止 jump scare 起音 |
| O5 | 偏差 | Low | `CombatHooks.onCue` 仍是可选，注释仍写「直到有 AudioManager」。裂隙 `create` 已传入，不是空接线。 | `src/systems/combat-system.ts` 约 71–72 行 | 规则 39 |

---

### 游戏内 UI 验收

**本批无新游戏内界面。** 既有暂停菜单与装置面板只换暂停调用并加 `sfx-ui-*`，未改载体、色板、字号、布局。不逐条勾 U1–U12。机械层：无新 HUD、无音量设置页。审美待人终审——本句不是审美 PASS。

---

### 回归检查

范围：本 Slice 修改的系统 + `system-audio.md` `interfaces-with`。

| 已有系统 | 状态 | 备注 |
| -------- | ---- | ---- |
| AudioManager（新） | ✅ | `src/managers/audio-manager.ts` + `audio-catalog.ts` |
| enemy-ai | ✅ | cue 集合未改；`RiftScene` 消费 `setCueListener`；AI 不 import AudioManager |
| combat | ✅ | `onCue` 已挂；未对 `PLAYER_DAMAGED` / `ENEMY_DAMAGED` / `ENEMY_KILLED` 再播同一套 |
| chaos-scavenge-extract | ✅ | 混乱 / 拾取 / 进出裂隙事件仍在；音频旁路消费 |
| purification-impact | ✅ | `run()` 返回值驱动冲击音；事件仍 emit 给旁路 |
| growth-tide | ✅ | 购买 / 使用 / 污染物剩余坐标 |
| movement-vision | ✅ | `isMoving()` + 位置 |
| map-generation | ✅ | `surfaceMaterial` → 脚步三材；未改生成器 |
| pause / main 失焦 | ✅ | 只换调用目标 |

---

### 机器闸门

| 命令 | 退出码 | 原文 |
| ---- | ------ | ---- |
| `npx tsc --noEmit` | **0** | （无 stdout / stderr） |

未跑 `npm run check:layout`（generation 本批未改）。

资产抽查（本机 `ffprobe` / 字节，非 tsc）：39 key 双树双格式 size>0、ogg 时长>0、`assets`↔`public` 字节一致。

---

### 总结

- 通过条件：必须核对 1–7 机械层全部通过；`tsc` 退出 0；无阻断 Bug。
- 不通过条件（均未触发）：空/缺文件、运行时振荡器、冲击只听 create 期事件、第三种敌人、直打 `game.sound.pauseAll`、架构仍写规划中、新音量 HUD。
- 建议：O1 若要字面占用表「层可被踢」，归 Code 后续；O3 归 Art/Director 把占位文档状态改成已生成；听感 / jump scare 终审归人。
- **不标 Slice COMPLETE。** 收尾四项与人试听仍未做。
