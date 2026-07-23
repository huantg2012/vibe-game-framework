# 渗透体视觉探索 V2 — 可实现的 Sprite 方向

## 设计约束

- 最终是 32x32 俯视角 sprite，需 4 方向 × 4 帧行走动画
- 概念图展示的是"基底 sprite 静态帧"——不依赖动态特效
- 污染表现必须是可以 baked into 每一帧的固定特征，不是一次性的戏剧效果
- 动态增强（像素飘散、残影、闪烁）由代码层运行时附加，不在此处验证

## 核心视觉签名（静态可表达）

"渲染规则崩坏"在静态 sprite 中的表达方式：

1. **比例微妙偏移** — 一臂略长、肩线不对称、头部偏离中轴。不是"受伤"，是"画错了"
2. **固定坏像素** — 身体上 3-5 个像素的颜色/位置明显不属于该区域（teal 色，或位置偏移出轮廓 1px）
3. **轮廓缺损** — 边缘有 1-2 处像素缺失，好像 sprite 数据不完整
4. **局部分辨率错误** — 一小块区域（如一只手）的像素明显比周围"粗"，像被降采样过
5. **姿态僵硬/不自然** — 行走姿势的关节角度不对，像被错误的骨骼数据驱动

以上全部可以画进 sprite sheet 每一帧中保持一致。

---

## Prompt（基底 sprite 概念）

```
Top-down view pixel art game sprite concept, 32x32 scale reference, dark background. A humanoid figure seen from above in a walking pose, wearing dark grey tattered clothing. The figure is ALMOST normal -- but subtle wrongness marks it as corrupted. Its proportions are slightly off: one arm hangs 2-3 pixels longer than the other, the shoulders are asymmetric as if drawn by a hand that doesn't understand human anatomy correctly. Several individual pixels on the body are clearly WRONG -- 3-4 scattered teal-colored pixels sitting where they should not be, as if the sprite data has a few corrupted bytes. One hand appears blockier than the other, as if rendered at lower resolution than the rest of the body. The figure's silhouette has 1-2 small notches where pixels are MISSING from the outline, tiny gaps in the sprite boundary. The overall color is dead dark grey (#2e2d30), nearly invisible against darkness. The wrongness is subtle -- at a glance it reads as human, but something nags at the viewer. This must work as an actual game sprite: clear silhouette, readable at 32px, no trailing effects, no particles, just a slightly broken static figure. Atmosphere of uncanny valley through rendering error. Top-down perspective, extremely dark, minimal detail, game-ready sprite concept, NOT concept art -- this is a functional game asset reference
```

---

## 同一方向的变体尝试

### 变体 B — 强调"画错的人"

```
Top-down pixel art game sprite, 32x32 scale, dark background. A humanoid figure viewed from above, mid-stride patrol pose. Dark grey clothing, barely visible against black. This figure looks like a human sprite that was DRAWN WRONG and nobody fixed it. The head is 1 pixel off-center from the body. One leg is planted at an angle that no human joint allows. A small cluster of 3 pixels on the chest are teal-colored -- not glowing, not decorative, just WRONG data sitting there like a texture error. The right arm's outline skips a pixel, creating a tiny gap. One foot is 1 pixel wider than the other, asymmetric in a way that feels like a mistake rather than a design choice. The figure's overall darkness and subtlety make these errors almost invisible until the player looks closely. Functional top-down game sprite reference, readable silhouette at small scale, no VFX, no trails, static sprite that could be on a sprite sheet
```

### 变体 C — 强调"不完整的渲染"

```
Top-down pixel art game sprite, 32x32 scale, dark background. A humanoid figure from above in idle pose. Almost entirely dark grey-black, blending with shadows. The sprite looks INCOMPLETE -- as if the renderer gave up partway. Most of the body is correctly drawn: dark clothing, human proportions, readable as a person. But one forearm simply stops -- the last 4-5 pixels of the hand are absent, the arm ends in a jagged edge as if the sprite data was truncated. A small rectangular patch on one thigh is filled with a flat wrong color (muted teal) -- like a texture that failed to load and shows placeholder data. The figure's top-of-head has 2 pixels that are slightly offset from where they should be, breaking the skull's symmetry. These are SMALL errors on an otherwise functional human sprite. At 32px game scale, the player notices something is off but can't immediately say what. Functional game sprite reference, actual-asset quality, no effects, no glow halos, just a slightly corrupted static sprite
```

---

## 评审标准

1. **静态可读性** — 不动也能看出"不对劲"吗？
2. **32px 缩小测试** — 缩到实际游戏尺寸后，还能区分这个和正常人形吗？
3. **Sprite sheet 可行性** — 这些特征能保持到 4 方向 × 4 帧中每帧都一致吗？
4. **等级预留** — 改写体可以在此基础上加重（更多坏像素、更大缺损区域、更明显的比例错误），覆盖体可以彻底崩坏吗？
5. **动态增强想象** — 脑补加上代码粒子（像素飘散、残影）后，效果能到之前概念图那种冲击力吗？

## 建议生成方式

三个 prompt 各生成 1-2 张，横向对比哪个在"克制"和"可识别"之间平衡最好。
