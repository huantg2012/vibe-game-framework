---
status: ACTIVE
created-by: art agent
created-date: 2026-07-22
last-modified: 2026-07-24
---

# 资产规格

## 命名规范

### 视觉资产
```
[类型]-[区域]-[名称]-[变体/状态].png

类型：tile- | spr- | ui- | fx-
区域：pp- | rift- | shared-

示例：
  tile-pp-floor-concrete-01.png
  tile-rift-wall-crystal-straight.png
  spr-shared-player-idle-down.png
  spr-rift-enemy-infiltrator-patrol-01.png
  spr-pp-module-barrier-healthy.png
  ui-hud-chaos-bar-bg.png
  fx-rift-contam-pulse-01.png
```

### 音频资产
```
[类型]-[场景]-[名称].[ogg|mp3]

类型：bgm- | amb- | sfx-
场景：pp- | rift- | ui- | shared- | impact-

示例：
  bgm-pp-isolation-drone.ogg
  sfx-ui-click.ogg
  sfx-shared-player-step-metal.ogg
  amb-rift-alien-atmosphere.ogg
```

## 视觉资产规格

| 类型 | 前缀 | 尺寸 | 格式 | 背景 | 说明 |
| ---- | ---- | ---- | ---- | ---- | ---- |
| 环境 Tile | tile- | 32x32 px | PNG-8/24 | 不透明 | 排列为 512px 宽 tileset |
| 玩家 Sprite | spr-shared-player- | 32x32 px | PNG-24 | 透明 | 含 padding，实际内容约 20x28 |
| 敌人（低度） | spr-rift-enemy- | 32x32 px | PNG-24 | 透明 | 人形轮廓 |
| 敌人（中度） | spr-rift-enemy- | 32x48 / 48x48 px | PNG-24 | 透明 | 超人形比例 |
| 敌人（高度） | spr-rift-enemy- | 48x48 / 64x64 px | PNG-24 | 透明 | 非人形几何体 |
| 可交互物（小） | spr- | 16x16 px | PNG-24 | 透明 | 薪柴、消耗品 |
| 可交互物（中） | spr- | 32x32 px | PNG-24 | 透明 | 撤离点标记 |
| 净化点模块 | spr-pp-module- | 64x64 / 96x96 px | PNG-24 | 透明 | 多状态（健康/受损/严重受损） |
| UI 元素 | ui- | 可变 | PNG-24 | 透明 | HUD 元素；简单几何优先代码绘制 |
| 粒子/特效 | fx- | 8x8 / 16x16 px | PNG-24 | 透明 | 小尺寸粒子图 |

## 后处理规格

> **管线输入的铁律**：后处理管线的输入是**单块 tile 或单个 sprite 的原始素材图**（一张输入图 = 一个原子资产）。整场景概念图/效果图只用于验证美术方向，**不作为资产喂给管线、不参与平铺**——把整场景图降采样成 32px 再平铺只会得到噪点。场景表现力来自运行时合成（多 tile + 过渡 tile + 覆盖层 decal + 光照 + 有限视野），详见 `docs/art-direction.md` §9.1 / §14。

正式视觉资产通过仓库根目录的 `tools/art-pipeline/` 在构建期离线处理，不属于游戏运行时 `src/` 的一部分。每类资产使用独立配置：

- 后处理配置：`docs/art/pipeline.*.config.json`
- 锁定色板：`docs/art/palette.json`（或由配置中的 `paletteFile` 指向的同目录色板文件）

配置至少声明输入与输出位置、处理阶段及其顺序、目标尺寸和机器验收条件；常用阶段包括去背、调色、降采样、色板量化与裁切补齐。锁定色板定义本游戏允许写入最终资产的颜色集合，供量化与验收共同使用。具体色值、尺寸和阈值由本项目的美术方向及资产需求确定，不写入通用工具。

- **美术 Agent**：为正式资产产出和维护后处理配置、锁定色板及验收标准。
- **程序 Agent**：运行 `npm run art:postprocess -- --config <配置路径>` 与 `npm run art:verify -- --config <配置路径>`，按验证命令退出码确认机器验收结果。
- **人**：运行外部生图工具，并在机器验收通过后完成最终审美判断。

### Spritesheet 规格

- Tileset 宽度固定 512px（每行 16 个 32x32 tile）
- 角色/敌人 spritesheet 为水平条带（horizontal strip），一行排列所有帧
- 帧间无间距（或固定 0px spacing, 0px margin）
- 文件尾部不留多余空白行

### 渲染规格

| 参数 | 值 |
| ---- | -- |
| 游戏逻辑分辨率 | 640x480 (20x15 tiles) |
| 渲染缩放 | 2x |
| 实际画布尺寸 | 1280x960 |
| 缩放插值 | Nearest Neighbor（像素锐利） |

## 音频资产规格

| 类型 | 前缀 | 时长 | 主格式 | 备用格式 | 码率 | 采样率 | 循环 |
| ---- | ---- | ---- | ------ | -------- | ---- | ------ | ---- |
| BGM | bgm- | 90-180s | OGG | MP3 | 128kbps | 44.1kHz | 是（crossfade 首尾） |
| 环境音 | amb- | 30-120s | OGG | MP3 | 96kbps | 44.1kHz | 是（无缝） |
| UI 音效 | sfx-ui- | 0.03-0.4s | OGG | MP3 | 128kbps | 44.1kHz | 否 |
| 游戏音效 | sfx- | 0.1-1.5s | OGG | MP3 | 128kbps | 44.1kHz | 否（少数循环） |

### 响度标准

| 类型 | 目标 LUFS | 峰值上限 (dBTP) |
| ---- | --------- | --------------- |
| BGM | -24 ~ -20 | -3 |
| 环境音 | -28 ~ -24 | -6 |
| UI 音效 | -18 ~ -14 | -1 |
| 游戏音效 | -20 ~ -16 | -1 |

## 目录结构

```
assets/
├── tilesets/
│   ├── pp-tileset.png
│   └── rift-tileset.png
├── sprites/
│   ├── player.png
│   ├── enemy-infiltrator.png
│   ├── enemy-rewriter.png
│   ├── enemy-overwriter.png
│   ├── interactables.png
│   └── pp-modules.png
├── ui/
│   ├── hud-elements.png
│   └── icons.png
├── fx/
│   └── particles.png
├── audio/
│   ├── bgm/
│   ├── ambient/
│   └── sfx/
│       ├── ui/
│       ├── player/
│       ├── enemy/
│       └── system/
└── _sources/              ← AI 生成原文件 + prompt 记录（不进 build）
```

## 文件大小预算

| 类别 | 预算 | 说明 |
| ---- | ---- | ---- |
| 全部 Tileset | < 500KB | PNG-8 极受限调色板，压缩率高 |
| 全部 Sprite | < 300KB | 小尺寸、少帧数 |
| UI 资产 | < 100KB | 大部分用代码绘制 |
| 全部音频 | < 5MB | BGM 体积最大（约 1-2MB 每首） |
| **总资产** | **< 8MB** | 首屏 < 2MB（按场景按需加载） |
