---
status: ACTIVE
created-by: art agent
created-date: 2026-08-19
last-modified: 2026-08-19
slice: 9
note: |
  Slice 9 A1。占位合成配方，给 C1 用 ffmpeg/sox/脚本生成非空 OGG+MP3。
  文件尚未进仓库：状态仍待生成。不要改 audio-direction.md 的「未生成」列（那是 C1 之后的事）。
  权威时长/key：docs/specs/system-audio.md。响度 5.2 是目标，不是机器闸门。
---

# 音频占位合成配方（Slice 9）

对照：`docs/specs/system-audio.md` 资产表（39 key）规则 A / G；`docs/audio-direction.md` 原则 + §5.1 码率 + §5.2 响度（目标）。本文件锁 **怎么合成**；C1 写脚本、落盘、接线。无新色、无新 UI、不改 `src/`。

**状态仍待生成。** 本文件不声明任何 `.ogg` / `.mp3` 已存在。

## 族一句

| 族 | 一句配方 |
| -- | -------- |
| 床 | 多层失谐低频正弦（≥2 条，差 0.5–4 Hz）垫一层极轻棕噪；无旋律、无拍、能循环。 |
| 环境循环 | 与同场景 BGM **不是同一条嗡**：净化点走工频机械，裂隙走噪声主导的空间层；稀疏金属微响编进床。 |
| UI | 干、短、金属微动：带通噪声的按键/滑板，不是蜂鸣。 |
| 玩家 | 脚步三材只换带通与衰减；受伤/挥击是闷的物理噪声，不是惨叫或刀刃卡通音。 |
| 敌人 | 非动物、非惨叫：近处渗透体是带微颤的机械运作；改写体 hum 更低、更连续、更远可闻。 |
| 系统 | 裂隙进出是噪声扫掠；混乱/冲击/边界是低频压迫渐起，不是 bang。 |

## 禁止（合成与验收同一份）

- **8-bit / chiptune**：方波、三角波、游戏币、power-up 琶音、短促高音 beep。
- **纯正弦警报**：任意一条 SFX **不得**只靠单频正弦（含双音 440/880、警笛扫频跨八度）。警戒/警告/阈值必须有噪声或第二条失谐分音，且基频 **< 200 Hz**。
- **jump scare 起音**（规则 G）：冲击 / 警戒 / 阈值 / 边界 / `sfx-ui-warning` / `sfx-impact-*`（survive 除外）**淡入 ≥ 40 ms**。其它时长 > 30 ms 的 SFX：前 30 ms 峰值 ≤ 该条全长峰值的 90%。时长 ≤ 30 ms（hover / chaos-tick）：t=0 近静音，淡入 ≥ 6 ms；**不要**用 30 ms 窗比验收（窗 = 整条）。
- 禁止 0 字节、禁止只有头没有声、禁止运行时 `OscillatorNode` 冒充交付。
- 禁止人声、合唱、管风琴、动物嘶吼、电影爆炸、kick/snare。
- 禁止把净化点 BGM 与 `amb-pp-mechanical-hum` 合成同一组频率。
- 菜单床、Threat、Proximity 必须能从裂隙 Base 里听出差别（见下表「辨识」）。

## 共享管线（C1 照此实现）

优先 **sox 合成 + ffmpeg 编码**。无 sox 时用 ffmpeg `sine` + `anoisesrc` 等价层。全程 **mono / 44.1 kHz**。

```
HP30 → 层混合 → LP16k → （循环床：噪声层 200 ms 首尾 crossfade）→ 起音淡入 → peak 归一 → 双格式编码
```

1. **正弦层**：`sox -n -r 44100 -c 1 t.wav synth {D} sine {f} vol {amp}`。选 `f * D` 为整数的频率，循环时相位连续，**正弦层不要做首尾 fade**。
2. **噪声层**：棕噪 `brownnoise` 或粉噪 `pinknoise`，再 `lowpass` / `bandpass`。循环床只对噪声层做 200 ms `acrossfade`（ffmpeg）后再混入正弦。
3. **循环床**：输出时长 = 下表秒数；无缝循环（连续播 3 遍缝不可闻跳变）。冲击床 **不循环**。
4. **起音**：压力族 `fade t 0.04`；UI 微动 `fade t 0.008`（hover/tick：`0.006`）。禁止 0 ms 满幅。
5. **peak 归一（5.2 的占位代理，非 LUFS 闸门）**：床 −6 dBFS；环境 −9 dBFS；UI −3 dBFS；玩家/系统 SFX −4 dBFS；敌人 −6 dBFS。可用 `sox … gain -n {dB}`。
6. **编码**（§5.1）：BGM/SFX `libvorbis`/`libmp3lame` **128 kbps**；环境循环 **96 kbps**。每个 key 写到 spec 目录：`assets/audio/{bgm|ambient|sfx/ui|sfx/player|sfx/enemy|sfx/system}/{key}.ogg` 与 `.mp3`。
7. **时长**：取该 key 档位 **下限附近**（减轻体积），**不得短于 spec 下限、不得长于上限**。

时长档对照：微 0.03–0.10 / 短 0.10–0.30 / 中 0.30–0.80 / 长 0.80–2.0 / 床 60–180（冲击床 60–90 且不循环）。

---

## 1. 床（多层失谐低频）

循环 overlap = 200 ms（仅噪声）。冲击床除外。

| key | 秒 | 循环 | 正弦 Hz@amp | 噪声 | 辨识 |
| --- | -- | ---- | ----------- | ---- | ---- |
| `bgm-menu-void-pad` | **90** | 是 | 41@0.16 + 41.5@0.12 | 棕 LP150 @0.03 | 最空；无中频、无工频 |
| `bgm-pp-isolation-drone` | **120** | 是 | 55@0.28 + 57.2@0.22 + 62@0.12；轻 110@0.05 | 棕 LP180 @0.04 | 50–80 Hz 垫，微暖；**不要** 60+120 |
| `bgm-rift-base-drone` | **120** | 是 | 48@0.26 + 50.5@0.22 + 53.3@0.16 | 棕 LP350 @0.10 | 失谐拍更明显；可加极轻粉噪 BP 4–6 kHz @0.02 |
| `bgm-rift-high-chaos` | **120** | 是 | 58@0.24 + 62.5@0.22 + 67@0.18 | 棕 LP800 @0.18 + 粉 HP200–LP4k @0.08 | 基频整体 **+10 Hz 以上**；更密、更噪 |
| `bgm-rift-threat` | **120** | 是 | 187@0.07 + 193@0.06（细、失谐） | 粉 BP 2.5–6 kHz @0.12 | **不是** 又一条 sub；偏刺/嘶 |
| `amb-rift-proximity` | **120** | 是 | 73@0.10 | 棕 BP 180–280 @0.16 | 中频金属/有机腔；无 40 Hz 堆 |
| `bgm-impact-pressure` | **72** | **否** | 40@0.22 + 41.5@0.18 | 棕 LP200 @0.12 | 见下 |

**冲击床（不循环）**：淡入 **2.0 s**，末 4 s 淡出。0.7 Hz 幅度脉动（工业应力，不是心跳、不是 kick）：`tremolo 0.7 45` 或等价增益 LFO，深度中等。前 40 ms 不得接近峰值。全程渐压，**起音不是 bang**。

sox 床层模板：

```text
sox -n -r 44100 -c 1 t{f}.wav synth {D} sine {f} vol {amp}
sox -n -r 44100 -c 1 n.wav synth {D} brownnoise vol {namp} lowpass {lp}
sox -m t41.wav t41b.wav n_loop.wav mix.wav
sox mix.wav out.wav highpass 30 lowpass 16000 gain -n -6
```

---

## 2. 环境循环

与对应 BGM **分频**，不要复制床。

| key | 秒 | 正弦 Hz@amp | 噪声 | 编进床的稀疏事件（无独立 key） |
| --- | -- | ----------- | ---- | ------------------------------ |
| `amb-pp-mechanical-hum` | **120** | **60@0.22 + 120@0.08** | 棕 LP100 @0.10 | 5 次金属「咔」：t≈18/41/63/88/109 s；白噪 BP 1.2–2.5 kHz，长 80 ms，淡入 40 ms，amp ≤ 0.06 |
| `amb-rift-alien-atmosphere` | **120** | 41@0.10 + 44@0.08 | 粉 LP900 @0.14 | 3 次不可定位 ping：t≈25/58/97 s；粉 BP 3–4 kHz，长 90 ms，淡入 40 ms，amp ≤ 0.04 |

编码 96 kbps。peak −9 dBFS。净化点偶发之间须留下大段纯嗡（方向文档：空旷不是热闹）。

---

## 3. UI（干、短、金属微动）

全部：**噪声带通**，禁止正弦主声。目录 `sfx/ui/`。

| key | 秒 | 合成 | 淡入 |
| --- | -- | ---- | ---- |
| `sfx-ui-click` | **0.08** | 白噪 BP 2.2–4.5 kHz；出音 50 ms 衰减 | 8 ms |
| `sfx-ui-hover` | **0.03** | 白噪 BP 3–5 kHz；整段即衰减 | **6 ms** |
| `sfx-ui-open` | **0.25** | 粉噪 BP 800–2.5 kHz，中心略下移（板滑开） | 10 ms |
| `sfx-ui-close` | **0.18** | 同上，中心略上收、更短 | 10 ms |
| `sfx-ui-allocate` | **0.35** | 0–0.22 s：棕 LP 200 渐起 @0.2；0.22 s 叠一条 click 同配方 @0.5 | 12 ms（低频段） |
| `sfx-ui-warning` | **0.40** | **两记低频压迫**，不是蜂鸣：68+71 Hz@0.15 + 棕 LP 180；脉冲长 0.16 s，第二记从 0.22 s 起、更弱；每记淡入 **40 ms** | 40 ms |
| `sfx-ui-error` | **0.10** | 白噪 BP 900–1.8 kHz，干「嗒」，无音高 | 8 ms |

```text
sox -n -r 44100 -c 1 click.wav synth 0.08 whitenoise bandpass 3200 1200 fade t 0.008 0.08 0.05
```

---

## 4. 玩家（脚步三材 + 其余短音）

目录 `sfx/player/`。脚步一律 **0.15 s**。

| key | 秒 | 合成 | 淡入 |
| --- | -- | ---- | ---- |
| `sfx-shared-player-step-metal` | **0.15** | 粉噪 BP 250–800，闷；`echo 0.8 0.65 28 0.2` 一点板响 | 8 ms |
| `sfx-shared-player-step-organic` | **0.15** | 棕噪 LP 500，黏；轻微下弯 `bend 0,-180,0.12` | 12 ms |
| `sfx-shared-player-step-crystal` | **0.15** | 粉噪 BP 1.6–3.8 kHz，轻脆带短共鸣 echo 18 ms（不是 8-bit 铃） | 6 ms |
| `sfx-shared-player-hurt` | **0.30** | 棕 LP 250 闷击 + 粉 HP 1.5 k 气息泄压；**无人声** | 12 ms |
| `sfx-shared-player-attack` | **0.25** | 粉噪 whoosh，BP 从 ~1.2 k 扫到 ~400；不是亮金属刀 | 10 ms |
| `sfx-shared-player-pickup` | **0.15** | 白噪 BP 1.0–2.4 kHz，比 UI click 更闷 | 8 ms |
| `sfx-shared-player-use-item` | **0.30** | 粉噪渐起 HP 400（电子启动），**无上行琶音** | 15 ms |

三材必须一耳可分：金属偏中闷+短板响，有机偏低黏，结晶偏高脆。

---

## 5. 敌人

目录 `sfx/enemy/`。非动物、非惨叫。循环单元须自身可无缝接。

| key | 秒 | 循环 | 合成 | 淡入 |
| --- | -- | ---- | ---- | ---- |
| `sfx-rift-enemy-idle` | **1.5** | 是 | **72@0.20 + 76.5@0.16** + 棕 LP 250 @0.08；`tremolo 1.2 12`（近处机器在调） | 缝 40 ms 交叉即可 |
| `sfx-rift-enemy-overwriter-hum` | **2.0** | 是 | **36@0.28 + 38.5@0.24 + 41@0.14** + 棕 LP **80** @0.10；**禁止 tremolo、禁止 >120 Hz 分音** | 缝 80 ms |
| `sfx-rift-enemy-alert` | **0.40** | 否 | 72→96 与 80→108 **窄幅**扫 + 粉噪；再 `lowpass 900`。不是警笛 | **40 ms** |
| `sfx-rift-enemy-chase` | **0.50** | 是 | 两记棕噪脉冲（t=0 与 t=0.25，各 80 ms，淡入 20 ms）；机械节律，**不是脚步兽跑** | 单元边界回 0 |
| `sfx-rift-enemy-hit` | **0.20** | 否 | 白+棕，BP 600–3 kHz，材质撞/裂；短衰减 | 8 ms |
| `sfx-rift-enemy-die` | **0.65** | 否 | `sine 110-36` + 棕噪同步衰减，像断电；末 0.35 s fade out。**不是爆炸/惨叫** | 40 ms |

**改写体 vs 渗透体（必须听得出）**

- 改写体 hum：基频 **≤ 42 Hz**，更持续、无颤、频谱更窄，远距离只剩「有东西在低鸣」。
- 渗透体 idle：基频 **≥ 72 Hz**，带 1.2 Hz 微颤，中频更多，近了才像一台在运转的东西。

---

## 6. 系统（裂隙进出 / 混乱 / 冲击 / 边界）

目录 `sfx/system/`。冲击与警戒 = **低频压迫渐起**，不是 bang。

| key | 秒 | 合成 | 淡入 |
| --- | -- | ---- | ---- |
| `sfx-rift-enter` | **1.20** | 棕+粉；正弦 **40→400** 只作扫层且 amp ≤ 噪声；空间撕裂 | **40 ms** |
| `sfx-rift-exit` | **0.90** | 上条反向：400→50 + 噪声收合 | **40 ms** |
| `sfx-shared-chaos-tick` | **0.05** | 白噪 BP 5.5–7 kHz；合成时再 `-24 dB`（运行时还有 ×0.15） | **6 ms** |
| `sfx-shared-chaos-threshold` | **0.50** | 55+58 Hz 失谐 + 棕 LP 200，缓慢偏厚；禁止高频警报 | **40 ms** |
| `sfx-impact-start` | **1.50** | 32+34 Hz + 棕 LP 120，1.5 s 渐近；远处压力，**起音无撞** | **80 ms** |
| `sfx-impact-hit` | **0.50** | 棕 LP 400 应力 + 中段 80 ms 带通裂（不是 gunshot） | **40 ms** |
| `sfx-impact-survive` | **0.30** | 粉噪 LP 1.2 kHz 泄压（气阀），下行衰减 | 12 ms |
| `sfx-impact-break` | **0.80** | 比 hit 更长：下行断裂 + 轻粉噪故障嘶；禁止爆炸峰值 | **40 ms** |
| `sfx-shared-module-repair` | **0.50** | 0–0.35 s 粉 BP 1.2–3 kHz 焊接嘶；0.32 s 叠一记闷金属归位（同 step-metal 更短） | 15 ms |
| `sfx-pp-boundary-pulse` | **1.50** | 32+34 Hz @0.25 + 棕 LP 70；鼓包后收回。膜外存在，不是敲击 | **50 ms** |

```text
sox -n -r 44100 -c 1 start.wav synth 1.5 sine 32 sine 34 brownnoise fade t 0.08 1.5 0.4
sox start.wav start2.wav lowpass 120 gain -n -4
```

---

## C1 自检（机器可做的部分）

- 39 key × 2 格式，字节 > 0，解码时长 > 0，时长落在上表 ±10% 且仍在 spec 档内。
- 循环床 / idle / hum / chase：缝 200 ms 内无满幅跳变。
- 压力族淡入 ≥ 40 ms；非微档 SFX：`peak(0–30 ms) / peak(all) ≤ 0.90`。
- 频谱抽查：`overwriter-hum` 能量中心低于 `enemy-idle`；`ui-warning` 与 `enemy-alert` 在 1 kHz 以上无明显纯音峰。
- **听感终审在人**；LUFS 5.2 本 Slice 不闸。

替换时机：正式作曲/采样进仓库后，按同 key 覆盖文件；本配方作废不必改运行时 API。
