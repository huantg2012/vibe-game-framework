---
status: TEMPLATE
created-by: art agent
created-when: Foundation 阶段
---

# 资产规格

## 命名规范
```
[类型]-[名称]-[变体].格式

示例：
  char-skeleton-warrior-idle.png
  bg-dungeon-entrance.png
  icon-item-iron-sword.png
  bgm-battle-01.mp3
  sfx-hit-sword.ogg
```

## 视觉资产规格

| 类型 | 前缀 | 尺寸 | 格式 | 背景 | 说明 |
| ---- | ---- | ---- | ---- | ---- | ---- |
| 角色立绘 | char- | [WxH] | PNG | 透明 | [备注] |
| 敌人 | enemy- | [WxH] | PNG | 透明 | [备注] |
| 背景 | bg- | [WxH] | WebP | - | [备注] |
| UI 元素 | ui- | 可变 | SVG | 透明 | [备注] |
| 图标 | icon- | [WxH] | PNG | 透明 | [备注] |

## 音频资产规格

| 类型 | 前缀 | 时长 | 格式 | 码率 | 说明 |
| ---- | ---- | ---- | ---- | ---- | ---- |
| BGM | bgm- | 60-180s | MP3 | 192kbps | 循环 |
| 音效 | sfx- | 0.1-3s | OGG | - | 单次 |
| 环境音 | amb- | 30-60s | OGG | 128kbps | 循环 |

## 目录结构
```
assets/
├── images/
│   ├── characters/
│   ├── backgrounds/
│   ├── ui/
│   ├── icons/
│   └── effects/
├── audio/
│   ├── bgm/
│   ├── sfx/
│   └── ambient/
└── _sources/          ← 原始生成文件+prompt记录
```
