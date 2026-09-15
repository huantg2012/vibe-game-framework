---
status: ACTIVE
created-by: design agent
created-date: 2026-08-19
created-when: Slice 9 设计阶段
last-modified-by: code agent
last-modified-date: 2026-09-15
interface-changed: true
slice: 9
interfaces-with:
  - system-enemy-ai                 # 消费 AISystem.setCueListener 的 ai.cue.*；渗透体 idle / 改写体 hum；警觉与追击循环
  - system-combat                   # 消费 CombatHooks.onCue 的 combat.cue.*（挥击/命中/死亡/前摇/受伤）
  - system-chaos-scavenge-extract   # 消费 CHAOS_CHANGED / CHAOS_THRESHOLD_REACHED / KINDLING_COLLECTED / RIFT_ENTERED / RIFT_EXIT_REACHED / RIFT_EXITED
  - system-purification-impact      # 消费冲击结算（ImpactResult，不依赖 create 期已发出的事件）；ALLOCATION_CONFIRMED；边界脉冲
  - system-growth-tide              # 消费 GROWTH_PURCHASED / ITEM_USED / TOOL_USED / ITEM_COLLECTED；污染物节点距离驱动 Proximity 层
  - system-movement-vision          # 消费 Player.isMoving() 与位置做脚步与空间听者
  - system-map-generation           # 消费碎片 surface_material → 脚步三材；污染物节点坐标
exposes:
  - AudioManager.playBGM(key, fadeIn?, opts?) / stopBGM(fadeOut?)
  - AudioManager.playSFX(key, config?) / playAmbient(key, fadeIn?) / stopAmbient(key, fadeOut?)
  - AudioManager.setLayerVolume(layer, volume, duration?) / playSpatialSFX(key, sourcePos, listenerPos, config?)
  - AudioManager.pauseAll() / resumeAll() / unlock()
  - 资产 key 注册表（49 个 key；每个非空 .ogg + .mp3）
  - 分组默认音量 Master 1.0 / BGM 0.6 / Ambient 0.5 / SFX 0.8（本 Slice 不暴露调节面板）
  - 同时 8 轨、溢出与 UI 不被踢
  - 距离衰减（tile）：敌人 5–8、点声源 3–6、改写体 hum 10–15、边界脉冲 0–2
---

# 系统设计：音频（氛围床 + 裂隙分层 + 清单音效）

## 迭代23：观察场承重音景（DEC-164）

仅`living-landmass-stage.html`的DEV表现音景，由`vista-audio.ts`拥有一个AudioContext/BufferSource，不进入正式AudioManager注册表或存档。`vista-motion.ts`确定性生成26秒PCM（矿化摩擦/低频承重），不是现场录音或外部音频模型；与非通行承体共享周期，5秒开始载荷、响应延迟1.4秒、8.2秒后摩擦渐强，末段渐退。没有通过新声音给敌人AI制造噪声事件。

WASD/方向键/M首次非repeat真实按键解锁；解锁前不自动发声。M切静音但周期继续。声源固定(520,760)，声像clamp((source.x−player.x)/900,−.85,.85)，增益.9/(1+(distance/950)^2)，平滑目标分别.15/.18秒，不改全游戏混音规则。

解锁后的实际buffer音频时钟驱动景观动作时间，避免场景delta截断使声画漂移。失焦/隐藏暂停Context和物理，回焦恢复同一源而非补播过去事件；销毁关闭Context并移除监听器。reduced-motion只留静态底音，停止承重摩擦事件与装饰变换。静音/未解锁/运行/暂停状态由只读probe报告。

实际录音、审听、声画关系与生命周期结果见迭代23 QA。运行态与PCM数值检查不代替审听，声音身份与成品质感最终由用户验收。

## 迭代22：悬海音景与真实水流

新世界显式选择`amb-suspended-sea-pressure`替换旧异域环境循环，沿同一AudioManager及自适应混音，不叠加两条环境床。沉积海床显式使用soil脚步。短入场由RiftScene冻结玩法，声音先建立；暂停由既有音频暂停机制同步冻结，结束/销毁清理本地实例。

六个新增key由`tools/suspended-sea/generate-audio.mjs`确定性离线合成，参数、seed、时长、格式与源PCM检测保存于相邻`audio-manifest.json`；不是实地录音或外部模型生成。输出单声道44.1kHz OGG/MP3到资产目录及public副本，只生成这六键，不重写旧43键。20秒环境床与短接水循环需检查编码后的边界；PCM首尾相等不等于实际混音已听验。

- `amb-suspended-sea-pressure`：20秒低中频宽带压力床。
- `sfx-suspended-sea-gather`：1.6秒汇流水声，真实汇流阶段至供水开始以一个空间循环实例及状态包络呈现。
- `sfx-suspended-sea-fall`：0.75秒供水起声，只在真实feedStart穿越时触发。
- `sfx-suspended-sea-contact`：2.2秒接水循环，仅真实coreActive时存在；改流时声源随已发生的排水转移，不因按键预播。
- `sfx-suspended-sea-drain`：0.9秒断供尾声，跟真实feedEnd；声音播放结束不能决定安全。
- `sfx-suspended-sea-shell-hit`：0.28秒材质命中，消费实际hitSequence，每次只触发一次。

`SuspendedSeaAudio`只借读同一ShellView和WaterFlowCycle，暂停不追赶补播，长帧不能补出一串过去的音。汇流与接水共享一个near实例，切相先停旧循环；transient与shell-hit分别有固定实例ID，destroy逐一清理。真实环境目标的普通敌人命中音只针对该接触替换，敌人声音、AI噪声与正式受击反馈保持。

`AudioManager.getState()`暴露当前实际voice/key/instanceId/loop/paused/volume供只读诊断；`stopInstance`按本地实例清理。现实现的8轨是普通voice准入阈值，BGM/Ambient床与必要UI存在准入例外，因此不是全局严格8条上限。验证必须报告实际峰值与近水循环数，不能只引常量宣称不超过8。新增音景的正常听感和实机混音证据登记于[迭代22 QA](../qa/iteration-22.md)。


> **TL;DR**: AudioManager 按场景播 5 条氛围床、裂隙内用四层混音（Base / Tension / Threat / Proximity），并接通方向文档 §4.2 全部短音；每个 key 必须有非空 OGG+MP3。消费已有 AI / 战斗 cue 与暂停钩子。同时 8 轨。禁止 jump scare、禁止第三种敌人、禁止用振荡器冒充交付。

## 概述

音频让空间自己发声：净化点是勉强运转的机械寂静，裂隙是被错误频率填满的压迫。不解说、不渲染、不安慰。本系统把 `docs/audio-direction.md` 收成可实现契约（DEC-064 / Slice 9）：占位音进仓库、接线可播、听感由人终审。服务体验支柱「绝望边缘的紧绷」——压力来自持续低频，不是突然巨响。

权威链：本 spec 的现行规则 > 方向文档里尚未实现的理想混音（§3.3 侧链等见「有意不做」）> 架构「音频技术规范」的封装描述。双格式冲突（方向文档 OGG 主 / 架构 MP3 主）不在运行时裁决：每个 key 两份都交，Phaser 按浏览器选。

## 状态模型

```typescript
type AudioGroup = 'Master' | 'BGM' | 'Ambient' | 'SFX';

type RiftLayer = 'base' | 'tension' | 'threat' | 'proximity';

type DurationBand = '微' | '短' | '中' | '长' | '床';

interface Vec2 { x: number; y: number }

interface AudioManagerState {
  unlocked: boolean;
  paused: boolean;
  currentBgmKey: string | null;
  activeAmbients: string[];          // 正在循环的 key
  layerVolume: Record<RiftLayer, number>; // 0–1，已是 2.4 节层内目标
  playingCount: number;              // 含循环床，上限 8
  listenerPos: Vec2 | null;          // 最近一次 playSpatialSFX 的听者
}

interface PlaySfxConfig {
  volume?: number;     // 相对 SFX 组的额外乘子，默认 1；禁止 > 1
  pan?: number;        // -1..1
  loop?: boolean;      // 默认 false
  priority?: 'ui' | 'game' | 'low'; // 缺省：key 以 sfx-ui- 开头则为 ui
}

interface PlayBgmOpts {
  loop?: boolean;      // 默认 true；冲击氛围必须 false
}
```

`AudioManager` 是全局服务（与 `GameState` 同级），场景与系统不直接打 Phaser Sound。分组音量是常量，本 Slice 不写入存档。

## 规则

### A. 资产合同

1. **注册表即清单**：下文「资产表」49 个 key 是现行目录（Slice 9 的39 + 迭代10翻找四键 + 迭代22悬海六键）。每个 key = 文件名不含扩展名。BootScene 预加载全部 key 的 `.ogg` 与 `.mp3`。
2. **非空双格式**：`assets/audio/.../{key}.ogg` 与 `{key}.mp3` 都必须存在，字节数 > 0，解码时长 > 0。禁止 0 字节、禁止只有头没有声。
3. **禁止振荡器冒充交付**：方向文档 §9 的运行时 `OscillatorNode` / 白噪声 / 正弦 beep **作废**。占位必须是仓库里的文件（ffmpeg/sox/脚本合成）。运行时只允许用 WebAudio 做增益、声像、淡入淡出、距离衰减。
4. **码率与采样率**（方向文档 5.1）：BGM 与短音效 128 kbps / 44.1 kHz；循环环境 96 kbps / 44.1 kHz。OGG 与 MP3 各一份。
5. **响度**（方向文档 5.2）是占位与日后替换的目标，不是本 Slice 的机器闸门。机器闸门是：非空、可解码、能播、无 jump scare 起音（规则 G）。

### B. AudioManager API（对齐方向文档 §10，现行补全暂停/解锁）

6. `playBGM(key, fadeIn?: number, opts?: PlayBgmOpts)`：播场景主床。默认循环。同组新 BGM 交叉淡入；`fadeIn` 单位秒，缺省见规则 D。冲击氛围 `opts.loop === false`，播完自然结束，不自动接下一首。
7. `stopBGM(fadeOut?: number)`：淡出并释放 BGM 轨（裂隙 Base 层随主床停）。
8. `playSFX(key, config?)`：一次性短音（或 `loop: true` 的短循环）。计入 8 轨。走溢出规则。
9. `playAmbient(key, fadeIn?)`：循环环境或裂隙层。同一 key 再调只更新/保持，不叠第二条。
10. `stopAmbient(key, fadeOut?)`：停该循环。层音量落到 0 并完成淡出后必须 `stopAmbient`，禁止占着轨播静音。
11. `setLayerVolume(layer, volume, duration?)`：`volume` 为方向文档 2.4 的层内值（Base 0.3–0.5，Tension 0–0.4，Threat 0–0.5，Proximity 0–0.3）。`duration` 缺省 1 秒。层尚未在播且目标 > 0.01 时，内部 `playAmbient` 对应 key 再淡入。目标 ≤ 0.01 时淡出并 stop。
12. `playSpatialSFX(key, sourcePos, listenerPos, config?)`：按规则 F 算线性增益与声像后走 `playSFX`。`config.loop === true` 时：同一 key **最多一条**，再次调用只更新源/听者位置与增益，不新开轨。
13. `pauseAll()` / `resumeAll()`：**唯一**合法的全局暂停/恢复。内部调用 Phaser Sound 的暂停/恢复，并记下 `paused`。禁止场景或 `main.ts` 再直打 `game.sound.pauseAll`。
14. `unlock()`：在用户首次 `pointerdown` / `keydown` / `touchstart` 后 `resume` AudioContext。可重入，已解锁则空操作。BootScene 绑定；若载入结束前没有交互，MainMenuScene 再绑一次。

层 key 映射：

| layer | 资产 key | 分组 |
| ----- | -------- | ---- |
| `base` | `bgm-rift-base-drone`（即当前裂隙 `playBGM`） | BGM |
| `tension` | `bgm-rift-high-chaos` | BGM |
| `threat` | `bgm-rift-threat` | BGM |
| `proximity` | `amb-rift-proximity` | Ambient |

### C. 分组与默认音量（方向文档 5.3）

| 分组 | 默认 | 本 Slice | 包含 |
| ---- | ---- | -------- | ---- |
| Master | 1.0 | 常量，无面板 | 全局乘子 |
| BGM | 0.6 | 常量，无面板 | 场景主床 + Tension + Threat |
| Ambient | 0.5 | 常量，无面板 | 环境循环 + Proximity |
| SFX | 0.8 | 常量，无面板 | 全部一次性与敌人循环短床 |

最终增益 = 样本 × 层内音量（若有）× 分组 × Master × 距离增益。禁止再乘一遍「默认 0.6」之类的暗系数。方向文档写「用户可调」= 日后设置页；**本 Slice 不做音量设置面板、不做新 HUD**。

### D. 场景氛围与过渡

15. **五条场景氛围**（玩家可分清的空间质地）与播放方式：

| 氛围 | key | 时长档 | 循环 | 谁触发 |
| ---- | --- | ------ | ---- | ------ |
| 主菜单 | `bgm-menu-void-pad` | 床 90–120s | 是 | `MainMenuScene.create` → `playBGM` |
| 净化点 | `bgm-pp-isolation-drone` | 床 120–180s | 是 | `PurificationScene` 在冲击演出结束或冲击跳过之后 → `playBGM` |
| 裂隙基准 | `bgm-rift-base-drone` | 床 120–180s | 是 | `RiftScene.create` → `playBGM`（同时是 Base 层） |
| 裂隙高混乱 | `bgm-rift-high-chaos` | 床 120–180s | 是 | **不切换主床**。作为 Tension 层，混乱值 > 25 时 `setLayerVolume('tension', …)` |
| 冲击 | `bgm-impact-pressure` | 床 60–90s | **否** | 冲击未跳过：`playBGM(..., { loop: false })` |

16. **净化点 → 裂隙**：交叉淡入淡出 3.5 秒。允许 1–2 秒静默间隙，禁止硬切。
17. **裂隙基准 → 高混乱**：禁止另切一首当主床。只抬 Tension / Threat（规则 E）。
18. **任何场景 → 冲击**：当前 BGM 2 秒淡出（实现上可用低通，无低通则纯音量淡出），冲击床 2 秒淡入。冲击在 `PurificationScene` 的 `impactSystem.run()` **同一 create 流程**里发生：必须用返回的 `ImpactResult` 触发音频，**禁止只监听** `IMPACT_STARTED`（该事件在 create 期间已发出，晚注册的监听收不到）。
19. **冲击结束 / 跳过**：`ImpactResult.skipped === true` 或冲击结果面板关掉后，再 `playBGM('bgm-pp-isolation-drone')` 并 `playAmbient('amb-pp-mechanical-hum')`。冲击进行中不播净化点主床。
20. **裂隙环境循环**：`RiftScene.create` 在混乱值 ≤ 25 时 `playAmbient('amb-rift-alien-atmosphere')`。Tension 层目标音量 > 0.05 时停掉该环境循环（高混乱质地改由 Tension 承担，避免与 8 轨抢床）。Tension 回到 ≤ 0.05 后 1 秒淡回环境循环。
21. **净化点环境循环**：冲击后的净化点常驻 `playAmbient('amb-pp-mechanical-hum')`。菜单不播环境循环。
22. **进入裂隙短音**：`RiftScene.create` 播 `sfx-rift-enter`（不循环）。事件 `RIFT_ENTERED` 若已在净化点发出，裂隙侧仍以场景 create 为准，避免双响：净化点**不要**播 enter。
23. **撤离成功短音**：`RIFT_EXIT_REACHED` 由裂隙场景播 `sfx-rift-exit`。死亡离开不播 exit（受伤短音已由战斗 cue 负责）。
24. **离场停干净**：场景 shutdown 时 `stopBGM` + 停该场景所有 ambient / 空间循环，避免串景。

### E. 裂隙四层（方向文档 2.4）

混乱值百分比相对满格闸门 100（`CHAOS.MAX_VALUE`），不是 150 硬顶。`value` 由 `ChaosSystem.getValue()` 每帧（或每次 `CHAOS_CHANGED`）写入。

| 层 | 触发 | 层内音量 |
| -- | ---- | -------- |
| Base | 进入裂隙即存在 | 恒 0.4（落在 0.3–0.5 内） |
| Tension | 混乱值 > 25 | `0.4 * clamp((value - 25) / 75, 0, 1)`；value≥100 时 0.4 |
| Threat | 混乱值 > 60 **或** 场上存在 `alert` / `chase` 的敌人 | 被发现：0.5；仅高混乱：`0.5 * clamp((value - 60) / 40, 0, 1)`；两者同时取 **max**，不叠加 |
| Proximity | 距最近仍存在的污染物拾取节点 | 3 tile 内 0.3，6 tile 外 0；其间线性。无剩余节点则为 0 |

25. **被发现**：任一敌人 FSM 为警戒或追击。用 `AISystem.getEnemies()` 查询，不另造事件。`ai.cue.lost` / `ENEMY_LOST_PLAYER` / 击杀使该敌人不再贡献。
26. **Proximity 不绑改写体**：改写体已经用更远的 hum。本层只反映高污染点（污染物节点）。本游戏没有第三种敌人，也不把「覆盖体」做成声源。
27. **被发现瞬间的环境**：Ambient 组（不含 BGM Base）在首次进入「被发现」时对当前环境循环做 0.5 秒闪避到 0，再 0.5 秒回到原音量；Threat 层按规则用 ≥0.5 秒淡入。禁止静默结束后突然满音量砸一声。

### F. 距离衰减（方向文档 5.5，单位 tile；`TILE_SIZE = 32`）

`d = hypot(source - listener) / 32`。线性：`d ≤ start` 增益 1；`d ≥ mute` 增益 0；中间线性。声像按听者水平差值轻推（满偏不超过 0.7）。

| 曲线名 | start | mute | 用于 |
| ------ | ----- | ---- | ---- |
| 敌人 | 5 | 8 | 渗透体 idle、alert、chase、hit、die、战斗前摇 |
| 点声源 | 3 | 6 | 非边界的空间环境短音（本 Slice 无独立偶发 key，预留给层/循环） |
| 改写体 hum | 10 | 15 | **仅** `sfx-rift-enemy-overwriter-hum` |
| 边界脉冲 | 0 | 2 | `sfx-pp-boundary-pulse`：距净化点力场边界法向距离 > 2 tile 则完全静音 |

28. 听者 = 玩家世界坐标。`playSpatialSFX` 每次传入。循环空间音由场景在 `update` 里用同一 key 再调（幂等更新）。

### G. 禁止 jump scare

29. 不使用突然巨响制造惊吓。冲击、警戒、阈值都是低频压迫，不是惊吓。
30. 任何 SFX 在起音 0–30 ms 内不得超过该条目标峰值的 90%；冲击 / 警戒 / 阈值资产至少 40 ms 渐入（Art A1 写进占位配方）。
31. `playSFX` 的 `volume` 不得 > 1。禁止用 0 音量预播再瞬间拉满。
32. 禁止为「被发现」或冲击设计比清单更响、更短、更脆的额外爆音。

### H. 8 轨与溢出（方向文档 5.4）

同时播放上限 **8**（循环床计入）。占用：

| 占用 | 内容 | 可否被踢 |
| ---- | ---- | -------- |
| 1 | 当前 BGM Base / 菜单 / 净化点 / 冲击床 | 否 |
| 2 | 裂隙 Tension **或** 场景环境循环（`amb-pp-*` / `amb-rift-alien-atmosphere`） | 可（低于 SFX） |
| 3 | 裂隙 Threat（仅目标音量 > 0.01） | 可 |
| 4 | 裂隙 Proximity（仅目标音量 > 0.01） | 可 |
| 5–8 | 游戏短音 + 敌人循环（idle / hum / chase） | 可；UI 不可 |

33. **溢出**：5–8 已满时，新的非 UI 短音踢掉 5–8 里优先级最低、同样低则最早的那条。新 UI 短音同样可踢 5–8 的非 UI，**UI 正在播的永远不踢**。
34. **优先级**：`ui`（`sfx-ui-*`）> `game`（战斗/敌人/冲击/进出裂隙/阈值/分配修复）> `low`（脚步、`chaos-tick`）。`low` 若无空位则 **跳过**，不踢 `game`。
35. **敌人循环最多占 5–8 中的 2 条**：
    - 槽 R：场上唯一改写体——默认 `sfx-rift-enemy-overwriter-hum`（10–15 tile）；该改写体进入追击则改为 `sfx-rift-enemy-chase`（敌人曲线 5–8 tile），停 chase 后回到 hum。
    - 槽 I：最近的渗透体——默认 `sfx-rift-enemy-idle`（5–8 tile）；若有渗透体在追击，改为最近追击者的 chase。改写体不播 idle。
36. 渗透体超出 8 tile、改写体超出 15 tile：停对应循环。没有改写体（不应发生）则槽 R 空。

### I. 敌人命名收口

37. 方向文档 key `enemy-overwriter-hum` **现行 = 改写体**（`EnemyRole = 'rewriter'`）的持续低频共鸣。禁止实现「覆盖体」或任何第三种敌人来消化这个 key。渗透体只用 `sfx-rift-enemy-idle`。资产文件名保持 `sfx-rift-enemy-overwriter-hum`（与方向文档示例一致），语义在本 spec 锁死。

### J. 现有钩子的消费方（必须接线）

38. **AI cue**（`src/systems/ai/ai-system.ts`，`setCueListener`）：**消费方 = `RiftScene`**。场景把 cue 译成 AudioManager 调用。AI 不 import AudioManager。

| cue | 音频 |
| --- | ---- |
| `ai.cue.suspicious` | 不播新短音（idle/hum 继续）。怀疑不是惊吓。 |
| `ai.cue.alert` | `playSpatialSFX('sfx-rift-enemy-alert', 敌人位置, 玩家位置)` |
| `ai.cue.chase` | 按规则 35 把该敌人的循环切到 `sfx-rift-enemy-chase` |
| `ai.cue.lost` | 停 chase；按角色回到 idle 或 hum |

39. **战斗可选音**（`src/systems/combat-system.ts`，`CombatHooks.onCue`）：**消费方 = `RiftScene`**。创建 `CombatSystem` 时必须传入 `onCue`，不得再留空。战斗系统不 import AudioManager。

| cue | 音频 |
| --- | ---- |
| `combat.cue.swing` | `playSFX('sfx-shared-player-attack')`（空挥也播） |
| `combat.cue.hit` | `playSpatialSFX('sfx-rift-enemy-hit', 命中位置, 玩家)` |
| `combat.cue.enemyDeath` | `playSpatialSFX('sfx-rift-enemy-die', 死亡位置, 玩家)` |
| `combat.cue.enemyWindup` | `playSpatialSFX('sfx-rift-enemy-alert', 敌人位置, 玩家)`。视野外没有前摇线时，这是唯一预警；前摇发生在近战距离，5–8 tile 曲线足够可闻。与 `ai.cue.alert` 同 key：允许最多 2 条重叠，第三条跳过。 |
| `combat.cue.playerHurt` | `playSFX('sfx-shared-player-hurt')` |

禁止再监听 `PLAYER_DAMAGED` / `ENEMY_DAMAGED` / `ENEMY_KILLED` 播同一套，避免双响。

40. **暂停**：**消费方 = `src/main.ts`（窗口失焦暂停层）与 `src/ui/dom/pause-menu.ts`**。四处现有 `host.sound.pauseAll` / `resumeAll` / `game.sound.pauseAll` / `resumeAll` 全部改为 `AudioManager.pauseAll()` / `resumeAll()`。暂停菜单「合上」与失焦恢复都走 `resumeAll`。离开场景进纪事流程前若曾 pause，先 `resumeAll` 再切场景（保持现有 `leaveForSession` 顺序，只换调用目标）。AudioManager 在 `paused === true` 时忽略新的 play 请求，避免暂停层底下偷播。

### K. 其它触发（场景 / 事件）

41. **脚步**：玩家 `isMoving()` 为真时每 400 ms 一脚（基速 80 px/s ≈ 每格一脚）。`low` 优先级。材质只看本趟碎片 `surface_material`（整张图一种），净化点恒金属：

| `surface_material` | key |
| ------------------ | --- |
| `metal` | `sfx-shared-player-step-metal` |
| `soil` / `wood` | `sfx-shared-player-step-organic` |
| `tile` / `plaster` | `sfx-shared-player-step-crystal` |
| 净化点地面 | `sfx-shared-player-step-metal` |

42. **拾取 / 翻找**：`ITEM_COLLECTED` → `sfx-shared-player-pickup`（100 ms 内同 key 只播一次）。`KINDLING_COLLECTED` 不再走 pickup——翻找揭晓由 `LootSearchSystem` 直接播 `sfx-shared-player-search-reveal-kindling` / `sfx-shared-player-search-reveal-residue`。读条开始播循环 `sfx-shared-player-search-loop`（instanceId `loot-search-loop`）；打断停循环并播 `sfx-shared-player-search-interrupt`。
43. **使用**：`ITEM_USED` 与 `TOOL_USED` → `sfx-shared-player-use-item`。
44. **混乱滴答**：`CHAOS_CHANGED` 且 `delta > 0` → `sfx-shared-chaos-tick`，额外乘子 0.15，优先级 `low`。同 key 仍在播则跳过。
45. **混乱阈值**：`CHAOS_THRESHOLD_REACHED` → `sfx-shared-chaos-threshold`（一次出击每 level 一次，事件本身已保证）。
46. **冲击短音**（与冲击床同时，数据来自 `ImpactResult`，模块之间错开 200 ms 以免撑满 5–8）：
    - 未跳过：先 `sfx-impact-start` + `sfx-ui-warning`，再 `playBGM('bgm-impact-pressure', 2, { loop: false })`。
    - 对每个 `damages[]`：`damage === 0` → `sfx-impact-survive`；`damage > 0` 且 `newHp > 0` → `sfx-impact-hit`；`newHp === 0` → 只播 `sfx-impact-break`（不再叠 hit）。
47. **薪柴注入模块**：`ALLOCATION_CONFIRMED` 且至少一档花费 > 0 → `sfx-ui-allocate` + `sfx-shared-module-repair`。花费全 0 不播。
48. **蜕变刻入成功**：`GROWTH_PURCHASED` → `sfx-ui-click`。
49. **操作失败**（薪柴不足、加厚上限已至、无法分配）：现有提示条已经出现的同一帧播 `sfx-ui-error`。无新文案、无新 HUD。
50. **面板**：世界内终端 / 元界面打开 → `sfx-ui-open`；关上 → `sfx-ui-close`。主菜单与暂停菜单选项移动 → `sfx-ui-hover`（首次绘制不播；50 ms 冷却）。键盘确认 → `sfx-ui-click`。
51. **边界脉冲**：净化点内玩家距力场边界 ≤ 2 tile 时，每 10 秒 `playSpatialSFX('sfx-pp-boundary-pulse', 最近边界点, 玩家)`。超出则停。

## 玩家交互

- 输入：玩家不直接操作混音。走动、挥击、打开装置读数、分配薪柴、进出裂隙、被发现——这些已有操作即触发源。
- 反馈：空间质地（五条氛围可分）、裂隙变厚（层而不是切歌）、动作短音、8 轨内不炸响。
- 不做：音量滑条、静音按钮、新 HUD、设置页。

## 数值结构

| 参数 | 含义 | 现行值 | 调节目的 |
| ---- | ---- | ------ | -------- |
| `MAX_VOICES` | 同时播放上限 | 8 | 防止过载 |
| `GROUP_MASTER` | 主音量 | 1.0 | 全局 |
| `GROUP_BGM` | 氛围床组 | 0.6 | 床是质地不是主角 |
| `GROUP_AMBIENT` | 环境组 | 0.5 | 低于 BGM |
| `GROUP_SFX` | 短音组 | 0.8 | 信息可闻 |
| `CROSSFADE_PP_RIFT` | 净化点↔裂隙 | 3.5 s | 方向文档 3–4 s |
| `CROSSFADE_TO_IMPACT` | 切冲击床 | 2 s | 方向文档 2 s |
| `LAYER_LERP` | 层音量插值 | 1 s | 避免层跳变 |
| `SPOTTED_DUCK` | 被发现环境闪避 | 0.5 s 去 / 0.5 s 回 | 克制，非惊吓 |
| `STEP_INTERVAL_MS` | 脚步间隔 | 400 | 与 2.5 格/秒对齐 |
| `TICK_GAIN` | 混乱滴答额外乘子 | 0.15 | 近潜意识 |
| `TILE_SIZE` | 衰减分母 | 32 px | 与架构一致 |
| 敌人衰减 | 开始 / 静音 | 5 / 8 tile | 近才可闻 |
| 点声源衰减 | 开始 / 静音 | 3 / 6 tile | 更近 |
| 改写体 hum 衰减 | 开始 / 静音 | 10 / 15 tile | 远就能感知 |
| 边界脉冲 | 可闻半径 | 2 tile | 只在膜边 |

## Schema（资产条目）

```typescript
interface AudioAsset {
  key: string                 // Phaser 注册名 = 文件名无扩展名
  dir: 'bgm' | 'ambient' | 'sfx/ui' | 'sfx/player' | 'sfx/enemy' | 'sfx/system'
  group: AudioGroup           // Master 不出现在条目上
  band: DurationBand
  loop: boolean
  spatial: 'none' | 'enemy' | 'point' | 'rewriter-hum' | 'boundary'
}
```

目录（方向文档 §8，补菜单床与 Threat / Proximity）：

```
assets/audio/
├── bgm/          # bgm-*
├── ambient/      # amb-*
└── sfx/{ui,player,enemy,system}/
```

每个 key 在对应目录下必须有 `.ogg` 与 `.mp3`。

### 时长档

| 档 | 秒 | 用途 |
| -- | -- | ---- |
| 微 | 0.03–0.10 | UI 微动 |
| 短 | 0.10–0.30 | 脚步、点击、命中 |
| 中 | 0.30–0.80 | 确认、受伤、警戒、死亡 |
| 长 | 0.80–2.0 | 进出裂隙、冲击起声、循环单元、边界 |
| 床 | 60–180 | 场景 / 层；冲击床 60–90 且不循环 |

### 资产表（49 key）

#### 场景氛围 5 + 裂隙层 4（唯一文件 7：Base=裂隙基准，Tension=裂隙高混乱）

| key | 档 | 循环 | 触发 | 空间 |
| --- | -- | ---- | ---- | ---- |
| `bgm-menu-void-pad` | 床 90–120s | 是 | 主菜单 | 无 |
| `bgm-pp-isolation-drone` | 床 120–180s | 是 | 净化点（冲击后） | 无 |
| `bgm-rift-base-drone` | 床 120–180s | 是 | 裂隙主床 / 层 Base | 无 |
| `bgm-rift-high-chaos` | 床 120–180s | 是 | 层 Tension（混乱值 > 25） | 无 |
| `bgm-impact-pressure` | 床 60–90s | 否 | 冲击未跳过 | 无 |
| `bgm-rift-threat` | 床 120–180s | 是 | 层 Threat | 无 |
| `amb-rift-proximity` | 床 120–180s | 是 | 层 Proximity | 无（音量已按距离） |

#### 环境循环（方向文档 §8 目录，随场景氛围交付）

| key | 档 | 循环 | 触发 | 空间 |
| --- | -- | ---- | ---- | ---- |
| `amb-pp-mechanical-hum` | 床 120–180s | 是 | 净化点冲击后 | 无 |
| `amb-rift-alien-atmosphere` | 床 120–180s | 是 | 裂隙且 Tension ≤ 0.05 | 无 |

#### §4.2 UI（7）

| key | 档 | 循环 | 触发 | 空间 |
| --- | -- | ---- | ---- | ---- |
| `sfx-ui-click` | 微 0.05–0.1s | 否 | 按钮/菜单确认；蜕变刻入成功 | 无 |
| `sfx-ui-hover` | 微 0.03s | 否 | 选项移动 | 无 |
| `sfx-ui-open` | 短 0.2–0.3s | 否 | 面板打开 | 无 |
| `sfx-ui-close` | 短 0.15–0.2s | 否 | 面板关闭 | 无 |
| `sfx-ui-allocate` | 中 0.3–0.4s | 否 | 薪柴分配确认 | 无 |
| `sfx-ui-warning` | 中 0.4s | 否 | 冲击开始（与 impact-start 同时） | 无 |
| `sfx-ui-error` | 短 0.1s | 否 | 操作失败 / 薪柴不足 | 无 |

#### §4.2 玩家（11）

| key | 档 | 循环 | 触发 | 空间 |
| --- | -- | ---- | ---- | ---- |
| `sfx-shared-player-step-metal` | 短 0.15s | 否 | 金属/净化点行走 | 无 |
| `sfx-shared-player-step-organic` | 短 0.15s | 否 | soil/wood 行走 | 无 |
| `sfx-shared-player-step-crystal` | 短 0.15s | 否 | tile/plaster 行走 | 无 |
| `sfx-shared-player-hurt` | 中 0.3s | 否 | `combat.cue.playerHurt` | 无 |
| `sfx-shared-player-attack` | 短 0.2–0.3s | 否 | `combat.cue.swing` | 无 |
| `sfx-shared-player-pickup` | 短 0.15s | 否 | 物品拾取（`ITEM_COLLECTED`）。迭代 10 起不再用于薪柴触碰拾取 | 无 |
| `sfx-shared-player-use-item` | 中 0.3s | 否 | 消耗品 / 工具使用 | 无 |
| `sfx-shared-player-search-loop` | 长 1.2s 单元 | 是 | 翻找读条开始；打断/完成时停 | 无 |
| `sfx-shared-player-search-interrupt` | 短 0.18s | 否 | 翻找读条打断 | 无 |
| `sfx-shared-player-search-reveal-kindling` | 短 0.28s | 否 | 翻找揭晓·薪柴 | 无 |
| `sfx-shared-player-search-reveal-residue` | 中 0.32s | 否 | 翻找揭晓·残渣 | 无 |

#### §4.2 敌人（6）

| key | 档 | 循环 | 触发 | 空间 |
| --- | -- | ---- | ---- | ---- |
| `sfx-rift-enemy-idle` | 长 1–2s 单元 | 是 | 最近渗透体存在 | 敌人 5–8 |
| `sfx-rift-enemy-alert` | 中 0.3–0.5s | 否 | `ai.cue.alert`；`combat.cue.enemyWindup` | 敌人 5–8 |
| `sfx-rift-enemy-chase` | 中 0.5s 单元 | 是 | 追击中的槽 R 或槽 I | 敌人 5–8 |
| `sfx-rift-enemy-hit` | 短 0.2s | 否 | `combat.cue.hit` | 敌人 5–8 |
| `sfx-rift-enemy-die` | 中 0.5–0.8s | 否 | `combat.cue.enemyDeath` | 敌人 5–8 |
| `sfx-rift-enemy-overwriter-hum` | 长 2s 单元 | 是 | 唯一改写体存在且未追击 | 改写体 10–15 |

#### §4.2 环境/系统（10）

| key | 档 | 循环 | 触发 | 空间 |
| --- | -- | ---- | ---- | ---- |
| `sfx-rift-enter` | 长 1–1.5s | 否 | `RiftScene.create` | 无 |
| `sfx-rift-exit` | 长 0.8–1s | 否 | `RIFT_EXIT_REACHED` | 无 |
| `sfx-shared-chaos-tick` | 微 0.05s | 否 | `CHAOS_CHANGED` delta>0 | 无 |
| `sfx-shared-chaos-threshold` | 中 0.5s | 否 | `CHAOS_THRESHOLD_REACHED` | 无 |
| `sfx-impact-start` | 长 1–2s | 否 | 冲击未跳过 | 无 |
| `sfx-impact-hit` | 中 0.5s | 否 | 模块受伤但仍有完整度 | 无 |
| `sfx-impact-survive` | 中 0.3s | 否 | 该模块本次伤害为 0 | 无 |
| `sfx-impact-break` | 中 0.8s | 否 | 模块完整度落到 0 | 无 |
| `sfx-shared-module-repair` | 中 0.5s | 否 | 薪柴分配确认且有花费 | 无 |
| `sfx-pp-boundary-pulse` | 长 1–2s | 否 | 净化点边界 2 tile 内，10 秒一次 | 边界 0–2 |

**唯一 key 合计49**（旧43 + 悬海环境床1 + 悬海状态SFX5）。

## 有意不做

默认全收方向文档 §2.2 / 2.4 / 4.2 / §8 环境床。下列是有意砍掉或降级，且必须保持极少：

1. **§3 偶发环境独立 key**（净化点金属热胀「咔」、蒸汽嘶、灯具电流变化；裂隙远处运作、结构应力、不可定位 ping、高污染调频干扰）。理由：会打满 5–8 轨、和「大量寂静」抢位置。现行：把稀疏事件编进 `amb-pp-mechanical-hum` / `amb-rift-alien-atmosphere` 的循环床；高污染靠近感由 Proximity 层承担。
2. **§3.3 混乱值 >90% 的 compression / side-chain「吞噬」其它声音**。理由：§10 无压缩器 API；层音量加厚已表达失控；突然闪避全体接近 jump scare。
3. **§3.3 混乱值 60–90% 的玩家动作回声**。理由：无卷积资产、无独立 key；8 轨不够叠延迟。
4. **方向文档 §9 运行时振荡器占位**。理由：DEC-064 要求仓库非空 OGG+MP3。
5. **覆盖体 / 第三种敌人**。`enemy-overwriter-hum` 收口为改写体。覆盖体仍是世界观高度档，本 Slice 不出声、不刷怪。
6. **音量设置面板、新 HUD、正式作曲替换占位、Slice 10 / NPC 语音、撤离多样性**。任务锁死。

## 边界情况

- 首次进入页未点击：无声直到 `unlock()`。允许。不得用自动播放骗过浏览器。
- Boot 深链 `#rift` / `#purif`：仍要 unlock；场景照常播对应床。
- 冲击 `skipped`（cycle = 0）：不播冲击床与冲击短音，直接净化点床 + 机械环境。
- 同时多名渗透体：只有最近者占 idle 槽。
- 改写体与渗透体同时追击：槽 R = 改写体 chase，槽 I = 最近渗透体 chase 或 idle。
- 暂停期间：不新开短音；恢复后循环床继续，不补播暂停期间的阈值。
- `CHAOS_CHANGED` 在撤离结算后：场景 shutdown 已停 SFX，迟到事件忽略。
- 面板在冲击结果展示期间打开：冲击短音按 `ImpactResult` 已在 create 排队，不因面板再播一遍。
- 8 轨全为 1 条不可踢床 + 3 层 + 2 敌人循环 + 2 UI：新的 `low` 脚步直接丢。
- 同一帧大量冲击模块短音：错开 200 ms，超出 5–8 时按优先级丢 survive 先于 hit，break 尽量保留。

## 与已有系统的接口

- 从 **system-enemy-ai** 接收：cue id；`getEnemies()` 的位置 / 角色 / 状态；不改 FSM。
- 从 **system-combat** 接收：`onCue`；不改伤害。
- 从 **system-chaos-scavenge-extract** 接收：混乱值事件、拾取、进出裂隙事件；不改混乱规则。
- 从 **system-purification-impact** 接收：`ImpactResult`、`ALLOCATION_CONFIRMED`、边界形状（距离）；不改冲击公式。
- 从 **system-growth-tide** 接收：购买 / 使用 / 污染物节点；不改经济。
- 从 **system-movement-vision** 接收：玩家位置与是否移动。
- 从 **system-map-generation** 接收：`surface_material`、污染物坐标。
- 向各系统发送：无事件。音频是旁路消费，不 emit。
- 场景编排：`BootScene` 预加载 + 首次 unlock；`MainMenuScene` / `PurificationScene` / `RiftScene` 按规则 D–K 调用；`main.ts` 与 `pause-menu.ts` 只调 pause/resume。

## 对已有系统的影响

- **AI / 战斗 spec**：不改 cue 集合。RiftScene 必须挂上此前可以为空的 listener / `onCue`。
- **净化点冲击**：`IMPACT_*` 事件「当前无消费方」不再成立——音频消费的是 **`run()` 返回值**，事件仍可保留给旁路。
- **架构模块注册表**：Code C1 把 AudioManager 从「规划中」改为已实现，API 以本 spec 为准（不是旧表的 `play()/stop()/setVolume()`）。
- **Art A1**：按本表写占位配方；菜单床与 Threat / Proximity 必须能从另外几条里听出差别；净化点 BGM 与 `amb-pp-mechanical-hum` 不得合成同一条嗡。
- **HUD / 设置**：无。暂停菜单只换暂停调用，不改视觉语言。

## 验证标准

- 本 Slice 结束时能验证：进出菜单 / 净化点 / 裂隙，五条氛围有声且能分；裂隙混乱升高或被发现时是层变厚不是切歌；清单短音能响；同时 ≤ 8；无 jump scare；每个声明 key 双格式非空；`pauseAll`/`resumeAll`/`unlock` 走 AudioManager。
- 预期正面结果：空间有质地，动作有短声，改写体在更远处可被 hum 感知，渗透体近了才有 idle。
- 如果不 work 的信号：静默或缺文件、0 字节、振荡器、切歌当高混乱、第三种敌人、UI 被踢、暂停后声音卡死、冲击无声（只监听了 create 期事件）。

## 待验证假设

- [ ] 占位 drone 的听感是否达到「克制即恐惧」（人终审；本 Slice 不验证正式作曲）。
- [ ] Tension 替换裂隙环境循环后，高混乱是否仍能与基准分清。
- [ ] 改写体 10–15 tile hum 是否可被学会为「听觉为主」的第二判断，而不是噪声。
