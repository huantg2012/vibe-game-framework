---
status: TEMPLATE
created-by: art agent
created-when: Foundation 阶段
---

# 美术方向

## 视觉风格
[风格描述 + 关键词]

## 为什么选这个风格
- 符合游戏调性：[解释]
- AI 可生成性高：[解释]
- 一致性容易维护：[解释]

## 色彩方案
- 主色：[色值] — [用途]
- 辅色：[色值] — [用途]
- 强调色：[色值] — [用途]
- 背景色：[色值] — [用途]

## Prompt 固定前缀（所有视觉资产共用）

### Midjourney
```
[style prefix]
```

### Stable Diffusion
- Model: [模型名]
- Positive prefix: [前缀]
- Negative prefix: [排除项]

## 资产规格

| 类型 | 尺寸 | 格式 | 说明 |
| ---- | ---- | ---- | ---- |
| 角色 | [WxH px] | PNG (透明背景) | [备注] |
| 背景 | [WxH px] | PNG/WebP | [备注] |
| UI元素 | [可变] | SVG 优先 | [备注] |
| 图标 | [WxH px] | PNG (透明背景) | [备注] |

## 动画规范
- 帧率：[N] fps（精灵动画）
- 缓动：[偏好的 easing 函数]
- 过渡时长：[N]ms（UI 状态切换）

## 风格参考
- [参考1]：[为什么参考它]
- [参考2]：[为什么参考它]
