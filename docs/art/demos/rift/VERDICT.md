---
status: APPROVED
date: 2026-07-22
concept: rift-interior
---

# 裂隙内部环境概念图评审结论

## 选定方向：192829（图底比例修正版）

### 批准的参考图
- `2026-07-22_192829_gpt-image-2.png` — 通过

### 不采用
- `2026-07-22_185805_gpt-image.png` — 不采用（中央有机团块偏生物感，但六边形蜂窝和层次感可参考）
- `2026-07-22_190242_midJourney.png` — 不采用（粉红有机生长物完全偏离调色板，非像素风）
- `2026-07-22_190249_midJourney.png` — 不采用（红棕过暖过亮，等轴测视角偏斜）
- `2026-07-22_191213_gpt-image-2.png` — 不采用（teal 占比过大导致视觉疲劳，但暗部"地面感"可参考）
- `2026-07-22_192058_gpt-image-2.png` — 不采用（teal 占比仍过大，缺少沉稳地面基底）

## 确认的视觉特征

- **图底比例**：~75% 暗色安静地面 : ~15-20% teal 裂缝渗出 : ~5% 暖光
- **地面基底**：碎裂混凝土板、夯土、风化砖——极暗去饱和，是画面的"重力"
- **污染表现**：从缝隙/断裂面中透出的 teal 脉络 + 接合点处的小型六边形晶簇。污染是"渗出"不是"覆盖"
- **暖光锚点**：单一 amber 光源（玩家设备），投射 2-3 tile 范围暖色池，打破 teal 单调
- **污染色谱**：非统一 teal，允许蓝teal（新生）→ 正teal（标准）→ 暖绿teal（古老）的梯度变化
- **空间逻辑**：不同材质碎片以错误角度拼接，体现"现实被缝合"
- **氛围**：沉默的压迫、dread through stillness（非奇观式恐怖）

## 关键设计决策（传播到 art-direction.md）

1. **玩家携带暖光** — 已更新至 art-direction.md §2.2 规则4 和 §5.1
2. **污染色谱分化** — 已更新至 art-direction.md §2.1 污染色表（增加 contam-cold / contam-ancient）

## 对后续资产生成的指导

生成裂隙环境 tile/概念时的 prompt 核心约束：
```
75% dark quiet ground (cracked concrete, compacted earth, weathered brick in near-black browns and greys), contamination ONLY in seams and cracks as thin cyan-teal veins and small hexagonal crystal nodes at junctions, contamination glow occupies less than 25% of image area, extremely dark atmosphere, geometric crystalline contamination only, no organic growths
```

暖光追加（如场景中包含玩家/人类痕迹）：
```
one small warm amber-orange light source casting a tiny pool of warmth against surrounding cold teal, the only warm color in the scene
```

## 迭代经验总结

- teal 光占比是最敏感的调参：>40% 就会凌乱和疲劳，<25% 时感觉恰好
- "地面"需要有存在感（材质、裂缝、拼接痕迹），不能只是"什么都没有的黑"
- 暖光+teal 的冷暖对比极为有效，少量即可打破单调
- prompt 中直接写面积占比指令（"75% should be..."）对 AI 生成有效
