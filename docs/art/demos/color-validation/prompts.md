# 色彩架构补充验证 Prompts

## 验证目标

1. L1（碎片记忆色）：5种碎片底色的微妙色温差异在游戏画面中是否可感知？
2. L2（污染色谱）：同一场景内不同色相的 teal（蓝/正/绿）是否能共存并提供视觉多样性？

---

## 验证1：L1 碎片记忆色对比

三张图使用完全相同的构图（75% 暗地面 + teal 裂缝渗出 + 一个 amber 暖光源），只有地面底色的色温倾向不同。

### 1A — 旧图书馆碎片（暖棕 #2a2420）

```
Top-down view of a dark fractured interior space, pixel art style, low-fi aesthetic. The ground is made of old dark WOODEN floorboards and cracked parquet tiles -- the base color has a subtle WARM BROWN undertone, like aged mahogany darkened almost to black. Thin cyan-teal veins bleed through cracks between floorboards. One small warm amber light source. The overall palette is extremely dark with a barely-perceptible warm-brown cast to all the ground surfaces. 75% dark quiet ground, contamination only in seams and cracks, high-detail pixel art rendering, extremely dark atmosphere, NOT bright, the warm undertone should be SUBTLE not obvious -- you should FEEL it more than see it
```

### 1B — 医院碎片（冷蓝灰 #1e2228）

```
Top-down view of a dark fractured interior space, pixel art style, low-fi aesthetic. The ground is made of cracked sterile LINOLEUM tiles and smooth institutional flooring -- the base color has a subtle COLD BLUE-GREY undertone, like a hospital corridor drained of all warmth. Thin cyan-teal veins bleed through cracks between tiles. One small warm amber light source. The overall palette is extremely dark with a barely-perceptible cold-blue cast to all the ground surfaces. 75% dark quiet ground, contamination only in seams and cracks, high-detail pixel art rendering, extremely dark atmosphere, NOT bright, the cold undertone should be SUBTLE not obvious -- you should FEEL it more than see it
```

### 1C — 户外碎片（深橄榄灰 #1a1e18）

```
Top-down view of a dark fractured exterior space, pixel art style, low-fi aesthetic. The ground is made of compacted dark EARTH, cracked dried mud, and patches of dead organic matter -- the base color has a subtle OLIVE-GREEN-GREY undertone, like soil that once grew things but is now lifeless. Thin cyan-teal veins bleed through cracks in the earth. One small warm amber light source. The overall palette is extremely dark with a barely-perceptible olive-grey cast to all the ground surfaces. 75% dark quiet ground, contamination only in seams and cracks, high-detail pixel art rendering, extremely dark atmosphere, NOT bright, the olive undertone should be SUBTLE not obvious -- you should FEEL it more than see it
```

### L1 评审方法

三张横向并排对比：
- 如果三者"感觉不同"（即使说不出为什么） → L1 验证通过
- 如果三者看起来完全一样 → L1 色值差不足，需要加大差异或换策略

---

## 验证2：L2 污染色谱共存

一张图中同时展示三种不同色相的污染。

### 2A — 三色谱共存场景

```
Top-down view of a dark fractured interior space, pixel art style, low-fi aesthetic. The ground is dark grey cracked concrete. The scene shows THREE DISTINCT AREAS of contamination with DIFFERENT COLORS coexisting: In the upper-left, FRESH contamination -- thin veins glowing BLUE-TEAL (#1a7a9a), cold and faint, recently appeared. In the center, STANDARD contamination -- cracks glowing the primary CYAN-TEAL (#2ae6c8), the familiar main color. In the lower-right, ANCIENT contamination -- thick veins glowing WARM GREEN-TEAL (#4adf8a), older and more saturated, suggesting long-established presence. The three zones should feel like the SAME type of phenomenon at different stages/ages -- like the same substance seen young, mature, and old. The color transitions between zones are gradual, not hard borders. One small warm amber light source. 75% dark quiet ground, high-detail pixel art rendering, extremely dark atmosphere, the THREE DIFFERENT TEAL HUES must be clearly distinguishable from each other
```

### L2 评审方法

- 如果三种 teal 色相可以在同一画面中被区分 → L2 验证通过，色谱能提供视觉多样性
- 如果它们看起来都是"同一种绿" → L2 色值差不足，需要加大色相偏移

---

## 文件命名

- `L1-library.png` — 暖棕碎片
- `L1-clinic.png` — 冷蓝碎片
- `L1-outdoor.png` — 橄榄碎片
- `L2-spectrum.png` — 三色谱共存
