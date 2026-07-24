---
status: APPROVED
created-by: art agent
created-date: 2026-07-22
last-modified: 2026-07-24
approved-date: 2026-07-24
changed-this-slice: false
note: Foundation Step 3. 音频方向已批准。注意：本次仅批准方向，尚未做任何音频小样验证；音频资产验证顺延至相关 Slice。
---

# 音频方向

> ⚠️ **批准范围说明（2026-07-24）**：本文档批准的是**音频方向/设计原则**，不是任何具体音频资产。与美术方向不同，音频**尚未经过任何小样验证**（无 BGM/环境音/音效试听样本）。所有 prompt 模板、响度标准、通道分配等均为待验证假设。真实音频资产的生成与验证顺延到需要它们的相关 Slice（预计核心循环跑通后）。届时需按本文档流程实际生成小样并试听确认。

## TL;DR

氛围音优先，非旋律优先。音频是环境本身——不解说、不渲染、不安慰。净化点是"勉强运转的机械寂静"，裂隙内是"被错误频率充满的压迫"。克制即恐惧。同时播放上限 8 轨。全部 AI 生成或素材库筛选。

---

## 1. 音频设计原则

### 1.1 核心立场

**音频不制造恐惧，让环境的声音本身制造压迫。**

- 不使用 jump scare 音效（突然巨响）
- 不使用紧张旋律催促玩家
- 不使用交响乐渲染史诗感
- 声音是信息源：告诉玩家环境状态、威胁距离、系统变化
- 安静本身是最重要的"声音"——净化点的安静 vs 裂隙内填满异响的不安

### 1.2 叙事语调对音频的约束

与 world.md 叙事语调一致：**冷峻克制、干燥事实性**。

- 音乐不评论玩家处境（不用小调传达"你很惨"）
- 音效不夸张化（受伤不用电影级血肉声）
- 环境音不神秘化（不用空灵女声/管风琴暗示"有超自然存在"）
- 所有声音都像是"本该存在于这个空间中的物理声源"

### 1.3 情感映射

| 游戏区域 | 音频情感目标 | 实现手段 |
| -------- | ------------ | -------- |
| 净化点 | 孤独、微弱安慰、勉强维持 | 低频机械嗡鸣 + 偶发金属轻响 + 大量寂静 |
| 裂隙（初入） | 不适、错位、被监视 | 不和谐低频 drone + 不规则节拍 + 空间异响 |
| 裂隙（深入/高混乱） | 窒息、失控、紧迫 | drone 音量/密度渐增 + 频率偏移 + 玩家动作音被吞噬 |
| 冲击结算 | 压力、后果 | 低频脉冲 + 金属应力声 + 结果音（成功=释压/失败=碎裂） |

---

## 2. 音乐/BGM 方向

### 2.1 整体调性

**Dark Ambient / Industrial Drone**

不是"音乐"而是"持续存在的声音质地"。没有旋律、没有和弦进行、没有节拍（或只有极缓慢不规则的脉冲）。更接近声音设计（sound design）而非作曲（composition）。

参考艺术家/作品方向：
- Atrium Carceri（工业衰败环境）
- Lustmord（深空低频压迫）
- Ben Frost - A U R O R A（冰冷失真）
- Disasterpeace - It Follows OST（合成器恐怖，克制）
- Darkwood OST（森林+孤立+低频）

### 2.2 BGM 规划

| 场景 | 情绪 | 风格描述 | 时长 | 循环 | 状态 |
| ---- | ---- | -------- | ---- | ---- | ---- |
| 主菜单/标题 | 空旷、冷 | 单一 pad 音色缓慢演进 + 极微弱金属共鸣。接近寂静。 | 90-120s | 是 | 未生成 |
| 净化点 | 孤独、微暖 | 低频机械 hum（50-80Hz）+ 偶发暖色合成器泛音（2-3次/分钟）+ 大段寂静 | 120-180s | 是 | 未生成 |
| 裂隙探索（基准） | 不适、警觉 | 不和谐 drone（多层次相位偏移）+ 不规则 sub-bass 脉冲 + 偶发高频"刺"音 | 120-180s | 是 | 未生成 |
| 裂隙探索（高混乱） | 窒息、失控 | 基准 drone 密度加倍 + 频率缓慢上移 + 噪声层增加 + 空间收窄感 | 120-180s | 是 | 未生成 |
| 冲击事件 | 压力、临界 | 有节奏的低频脉冲（如心跳但更金属质感）+ 远处碎裂声 + 渐强 | 60-90s | 否（单次播放） | 未生成 |

### 2.3 BGM 过渡规则

- **净化点 → 裂隙**：交叉淡入淡出（crossfade），3-4 秒
- **裂隙基准 → 高混乱**：不切换轨道；通过参数渐变（音量/滤波器/额外层淡入）实现动态混音
- **任何场景 → 冲击**：当前 BGM 低通滤波渐暗 + 冲击 BGM 淡入，2 秒
- **场景切换中的静默**：允许 1-2 秒静默间隙（不急于填满）

### 2.4 动态混音设计（裂隙内）

裂隙 BGM 不是单一固定音轨，而是多层可独立控制的叠加：

| 层 | 内容 | 触发条件 | 音量范围 |
| -- | ---- | -------- | -------- |
| Base | 低频 drone（始终存在的基底） | 进入裂隙即播放 | 0.3-0.5 |
| Tension | 中频不和谐相位 + sub-bass 脉冲 | 混乱值 > 25% | 0→0.4 随混乱值线性增长 |
| Threat | 高频刺音 + 噪声 | 混乱值 > 60% 或被敌人发现 | 0→0.5 |
| Proximity | 金属/有机共振 | 接近高覆盖体或高污染区 | 0→0.3 基于距离衰减 |

**技术注意**：这 4 层占 4 个同时播放通道，留 4 个给 SFX。如果需要更多 SFX 通道，Proximity 层可降为环境 SFX 处理（非持续播放）。

---

## 3. 环境音设计

### 3.1 净化点环境音

**概念：一个勉强运转的工业空间的背景噪声**

持续音：
- 低频机械嗡鸣（通风/发电设备，50-80Hz，恒定）
- 偶尔管道水流声（远处，极低音量）

偶发音（随机间隔触发）：
- 金属结构热胀冷缩的"咔"声（每 15-30 秒）
- 远处某个阀门释放蒸汽的嘶声（每 40-60 秒）
- 灯具微弱电流嗡声变化（随机）
- 边界方向传来的低频"压力"声（模糊、短暂、不可辨认）

**关键：大量寂静。**偶发音之间有 10-20 秒的纯背景嗡鸣期，让净化点感觉空旷而非热闹。

### 3.2 裂隙内环境音

**概念：被错误频率充满的空间——不是安静，是充满了不该有的声音**

持续音：
- 异质 drone（与 BGM base 层分开的独立环境层，更"空间化"）
- 脚下表面反馈（玩家移动时，根据 tile 类型变化：金属/有机/结晶）

偶发音：
- 远处污染体的活动声（不可辨认的"运作"音——不是脚步，更像机器调整）
- 空间结构应力声（裂隙不稳定的提示——低频扭曲/碎裂微音）
- 不可定位的高频"ping"（监视感——短促、方向不明）
- 接近高污染区时的频率干扰（如收音机干扰/调频噪声）

### 3.3 环境音的动态规则

| 条件 | 环境音变化 |
| ---- | ---------- |
| 混乱值 0-30% | 基准环境音（偶发音正常频率） |
| 混乱值 30-60% | 偶发音频率增加 50%；新增"远处运作"声类型 |
| 混乱值 60-90% | 持续 drone 音量+10%；偶发音间隔缩短；出现玩家动作回声 |
| 混乱值 >90% | 环境音开始"吞噬"其他声音（通过 compression/side-chain 效果）；空间感坍缩 |
| 被敌人发现 | 短暂全环境音静默（0.5秒）→ 然后比之前更密集地回来 |

---

## 4. 音效分类与设计

### 4.1 音效风格总则

- **整体质感**：工业合成器——非 8-bit/chiptune，非写实录音。介于两者之间的"合成但有质感"
- **UI 音效**：短促、干、金属/电子质感。像按下工业设备按钮。
- **游戏音效**：闷响、低沉、有物理重量感。不干净不脆利。
- **敌人音效**：非动物/非人类。机械+共振+频率异常。
- **环境音效**：自然但不正确——像是熟悉声音的频率被偏移了。

### 4.2 音效清单

#### UI 音效

| 音效名 | 描述 | 时长 | 触发 |
| ------ | ---- | ---- | ---- |
| ui-click | 金属微动开关按下 | 0.05-0.1s | 按钮确认 |
| ui-hover | 极微弱电流接触声 | 0.03s | 悬停进入 |
| ui-open | 金属面板滑开（短促） | 0.2-0.3s | 面板打开 |
| ui-close | 金属面板合上 | 0.15-0.2s | 面板关闭 |
| ui-allocate | 资源注入声（低频嗡→确认咔） | 0.3-0.4s | 薪柴分配确认 |
| ui-warning | 低频蜂鸣两声 | 0.4s | 系统警告（混乱阈值/冲击预警） |
| ui-error | 干涩的拒绝声（嗒） | 0.1s | 操作失败/资源不足 |

#### 玩家动作音效

| 音效名 | 描述 | 时长 | 触发 |
| ------ | ---- | ---- | ---- |
| player-step-metal | 金属面行走（闷，有回响） | 0.15s | 移动（金属地面） |
| player-step-organic | 异质表面行走（黏，不自然） | 0.15s | 移动（有机地面） |
| player-step-crystal | 结晶面行走（轻脆，有共鸣） | 0.15s | 移动（结晶地面） |
| player-hurt | 闷击+气息（不是惨叫） | 0.3s | 受到伤害 |
| player-attack | 短促挥击/释放声 | 0.2-0.3s | 攻击动作 |
| player-pickup | 物品收入声（金属轻响） | 0.15s | 拾取物品/薪柴 |
| player-use-item | 物品激活声（电子启动） | 0.3s | 使用消耗品 |

#### 敌人音效

| 音效名 | 描述 | 时长 | 触发 |
| ------ | ---- | ---- | ---- |
| enemy-idle | 低频运作嗡声（循环） | 1-2s loop | 敌人存在（距离近时可闻） |
| enemy-alert | 频率突变+短促共鸣 | 0.3-0.5s | 敌人进入警觉 |
| enemy-chase | 加速的节律脉冲 | 0.5s loop | 敌人追击中 |
| enemy-hit | 材质撞击（金属/结晶碎裂感） | 0.2s | 敌人被击中 |
| enemy-die | 频率骤降→静止（像设备断电） | 0.5-0.8s | 敌人死亡 |
| enemy-overwriter-hum | 持续低频共鸣（覆盖体特有） | 2s loop | 覆盖体存在（距离远也能感知） |

#### 环境/系统音效

| 音效名 | 描述 | 时长 | 触发 |
| ------ | ---- | ---- | ---- |
| rift-enter | 空间撕裂声（低频→高频扫掠） | 1-1.5s | 进入裂隙 |
| rift-exit | 反向空间收合 | 0.8-1s | 撤离成功 |
| chaos-tick | 极微弱的高频"滴"（接近潜意识） | 0.05s | 混乱值增加（高频率触发，音量极低） |
| chaos-threshold | 低沉的频率偏移+警告音 | 0.5s | 混乱值达到阈值 |
| impact-start | 远处低频撞击渐近 | 1-2s | 冲击开始 |
| impact-hit | 重型金属应力+碎裂 | 0.5s | 冲击命中模块 |
| impact-survive | 压力释放（气阀声） | 0.3s | 模块防御成功 |
| impact-break | 结构断裂+电子故障 | 0.8s | 模块被损坏 |
| module-repair | 焊接+金属归位 | 0.5s | 模块修复 |
| boundary-pulse | 极低频脉冲（在净化点边界可闻） | 1-2s | 边界外"存在"周期性提示 |

---

## 5. 技术规格

### 5.1 格式要求

| 类型 | 主格式 | 备用格式 | 码率 | 采样率 |
| ---- | ------ | -------- | ---- | ------ |
| BGM | OGG | MP3 | 128kbps | 44.1kHz |
| 环境音（循环） | OGG | MP3 | 96kbps | 44.1kHz |
| 音效（短） | OGG | MP3 | 128kbps | 44.1kHz |

- **为什么 OGG 为主**：更好的循环无缝支持（MP3 有 encoder padding 导致循环缝隙）；更小文件体积。MP3 作为浏览器兼容 fallback。
- **所有音频资产需同时提供 OGG + MP3 两种格式**（Phaser 自动选择浏览器支持的格式）

### 5.2 响度标准

| 类型 | 目标响度 (LUFS) | 峰值上限 (dBTP) | 说明 |
| ---- | --------------- | --------------- | ---- |
| BGM | -24 到 -20 LUFS | -3 dBTP | 极低——BGM 是背景质地不是主角 |
| 环境音 | -28 到 -24 LUFS | -6 dBTP | 比 BGM 还低——潜意识层 |
| UI 音效 | -18 到 -14 LUFS | -1 dBTP | 清晰可闻但不刺耳 |
| 游戏音效 | -20 到 -16 LUFS | -1 dBTP | 比 BGM 稍响（需要传达信息） |
| 敌人音效 | -22 到 -18 LUFS | -3 dBTP | 中等——需要基于距离衰减 |

### 5.3 音量分组（AudioManager）

| 分组 | 默认音量 | 用户可调 | 包含 |
| ---- | -------- | -------- | ---- |
| Master | 1.0 | 是 | 控制全局 |
| BGM | 0.6 | 是 | 场景音乐/drone |
| Ambient | 0.5 | 是 | 环境循环音 |
| SFX | 0.8 | 是 | 所有一次性音效 |

### 5.4 播放通道分配（同时 8 轨上限）

| 通道 | 用途 | 优先级 | 说明 |
| ---- | ---- | ------ | ---- |
| 1 | BGM Base | 最低（不可被踢） | 始终占用 |
| 2 | BGM Layer / Ambient | 低 | 动态层或环境循环 |
| 3 | BGM Layer 2 | 低 | 高混乱时额外层 |
| 4 | Ambient SFX | 中 | 偶发环境音 |
| 5-8 | Game SFX | 高 | 玩家动作/敌人/系统事件 |

**溢出规则**：当第 5-8 通道全满时，新的高优先级 SFX 踢掉最早/最低优先级的现有 SFX。UI 音效优先级最高（永远不被踢）。

### 5.5 距离衰减

- 敌人音效：线性衰减，开始于 5 tile 距离，8 tile 外静音
- 环境点声源：线性衰减，开始于 3 tile，6 tile 外静音
- 覆盖体嗡鸣：衰减更慢——10 tile 开始，15 tile 外静音（更远可感知）
- 净化点边界脉冲：仅在边界 2 tile 内可闻

---

## 6. AI 生成音频工作流

### 6.1 工具推荐

| 资产类型 | 推荐工具 | 备注 |
| -------- | -------- | ---- |
| BGM / Drone | Suno / Udio | 生成 dark ambient 效果好；需指定 instrumental only |
| 环境循环音 | Suno + 后处理 / Freesound 拼合 | 生成基底后裁剪为完美循环 |
| UI 音效 | ElevenLabs SFX / Freesound | 短促音效 AI 生成或素材库筛选 |
| 游戏音效 | ElevenLabs SFX / 合成器 (Vital/Serum) | 复杂音效可能需要合成器手调 |
| 敌人音效 | AI 生成 + pitch-shift 后处理 | 用正常机械声作为基底，频率偏移制造异感 |

### 6.2 Suno/Udio Prompt 模板

**BGM（净化点）：**
```
dark ambient, industrial drone, isolated, minimal, sparse, 50-60 bpm subtle pulse, low frequency hum, distant metallic resonance, cold, empty space, game soundtrack, instrumental only, loopable, no melody, no beats, no vocals
```

**BGM（裂隙基准）：**
```
dark ambient, alien drone, dissonant, unsettling, phase-shifted tones, sub-bass pulse irregular rhythm, high-frequency glitch accents, suffocating atmosphere, cosmic horror, game soundtrack, instrumental only, loopable, no melody, no clear beat, no vocals
```

**BGM（裂隙高混乱）：**
```
dark ambient, intense drone, claustrophobic, frequencies colliding, distorted sub-bass, noise layers building, loss of control, panic undertone but restrained, industrial horror, game soundtrack, instrumental only, loopable, no melody, no vocals
```

**BGM（冲击事件）：**
```
dark ambient, industrial percussion, rhythmic low-frequency impacts, metal stress sounds, building tension, pressure increasing, structural failure imminent, game soundtrack, instrumental only, single play not looped, no melody, no vocals
```

### 6.3 音频后处理管线

所有 AI 生成的音频经过以下统一处理：

1. **响度归一化**：调整到目标 LUFS（按类型，见 5.2）
2. **循环处理**（BGM/环境音）：找到自然循环点，crossfade 首尾（50-200ms）
3. **频率清理**：
   - 切除 30Hz 以下的 sub-sonic（防止喇叭共振）
   - 切除 16kHz 以上（Web 播放不需要极高频）
4. **格式导出**：
   - 先导出 WAV master
   - 再编码为 OGG（主）+ MP3（备用）
5. **命名归档**：按命名规范入库

### 6.4 循环点处理

- BGM 和环境音**必须**无缝循环
- 验证方法：连续播放 3 遍，在循环点不应有可闻的"跳"或音量突变
- 如果 AI 生成结果首尾不连贯：截取中间段落（去掉开头渐入和结尾渐出），对新首尾做 crossfade
- Suno/Udio 生成时在 prompt 加 "loopable" 但不能完全依赖——都需要手动验证和修整

---

## 7. 音频资产命名规范

```
[类型]-[场景]-[名称].[格式]

类型前缀：
  bgm-     背景音乐/drone
  amb-     环境循环音
  sfx-     一次性音效

场景标记：
  pp-      净化点
  rift-    裂隙
  ui-      用户界面
  shared-  通用/跨场景
  impact-  冲击事件

示例：
  bgm-pp-isolation-drone.ogg / .mp3
  bgm-rift-base-drone.ogg / .mp3
  bgm-rift-high-chaos.ogg / .mp3
  bgm-impact-pressure.ogg / .mp3
  amb-pp-mechanical-hum.ogg / .mp3
  amb-rift-alien-atmosphere.ogg / .mp3
  sfx-ui-click.ogg / .mp3
  sfx-ui-warning.ogg / .mp3
  sfx-shared-player-step-metal.ogg / .mp3
  sfx-rift-enemy-alert.ogg / .mp3
  sfx-rift-enemy-overwriter-hum.ogg / .mp3
  sfx-impact-hit.ogg / .mp3
  sfx-shared-chaos-threshold.ogg / .mp3
```

---

## 8. 目录结构

```
assets/audio/
├── bgm/
│   ├── bgm-pp-isolation-drone.ogg
│   ├── bgm-pp-isolation-drone.mp3
│   ├── bgm-rift-base-drone.ogg
│   ├── bgm-rift-base-drone.mp3
│   ├── bgm-rift-high-chaos.ogg
│   ├── bgm-rift-high-chaos.mp3
│   ├── bgm-impact-pressure.ogg
│   └── bgm-impact-pressure.mp3
├── ambient/
│   ├── amb-pp-mechanical-hum.ogg
│   ├── amb-pp-mechanical-hum.mp3
│   ├── amb-rift-alien-atmosphere.ogg
│   └── amb-rift-alien-atmosphere.mp3
├── sfx/
│   ├── ui/
│   │   ├── sfx-ui-click.ogg
│   │   ├── sfx-ui-click.mp3
│   │   └── ...
│   ├── player/
│   │   ├── sfx-shared-player-step-metal.ogg
│   │   ├── sfx-shared-player-step-metal.mp3
│   │   └── ...
│   ├── enemy/
│   │   ├── sfx-rift-enemy-alert.ogg
│   │   ├── sfx-rift-enemy-alert.mp3
│   │   └── ...
│   └── system/
│       ├── sfx-shared-chaos-threshold.ogg
│       ├── sfx-shared-chaos-threshold.mp3
│       ├── sfx-impact-hit.ogg
│       ├── sfx-impact-hit.mp3
│       └── ...
└── _sources/                    (原始生成文件+prompt，不进 build)
```

---

## 9. 占位音频策略

与美术占位同理——系统开发初期不等正式音频，用最简占位推进。

| 类型 | 占位方案 | 替换时机 |
| ---- | -------- | -------- |
| BGM | 静音或极简合成器单音 drone（代码生成 OscillatorNode） | 核心循环跑通后 |
| 环境音 | 白噪声低通滤波（代码 AudioContext 生成） | 视觉完整后 |
| UI 音效 | 简单正弦波 beep（Web Audio API 生成） | UI 系统稳定后 |
| 游戏音效 | 噪声 burst（代码生成） | 各系统验证后逐步替换 |
| 距离衰减 | 线性 gain 节点调控（代码） | 初期即为正式实现 |

**优势**：代码生成的占位音频零文件体积、即时可用、不需要外部工具。当正式音频资产就位时只需替换播放源。

---

## 10. 音频与代码集成要点（给 Code Agent 的接口约定）

### 10.1 AudioManager 期望接口

```typescript
// 播放 BGM（自动循环）
AudioManager.playBGM(key: string, fadeIn?: number);
// 停止 BGM
AudioManager.stopBGM(fadeOut?: number);

// 播放一次性 SFX（考虑通道上限）
AudioManager.playSFX(key: string, config?: { volume?: number, pan?: number });

// 播放/停止环境循环
AudioManager.playAmbient(key: string, fadeIn?: number);
AudioManager.stopAmbient(key: string, fadeOut?: number);

// 动态混音（裂隙分层 BGM）
AudioManager.setLayerVolume(layer: string, volume: number, duration?: number);

// 距离衰减 SFX
AudioManager.playSpatialSFX(key: string, sourcePos: Vec2, listenerPos: Vec2);
```

### 10.2 音频资产注册

所有音频文件在 BootScene 预加载时注册，key 为文件名（不含扩展名）。Phaser 根据浏览器支持自动选择 OGG 或 MP3。

### 10.3 WebAudio Context 解锁

首次用户交互后 resume AudioContext（浏览器限制）。BootScene 或 MainMenuScene 中在首次 click/keydown 后调用。
