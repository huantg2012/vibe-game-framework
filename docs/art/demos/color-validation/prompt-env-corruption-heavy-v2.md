# P3 重写：重度污染区（可玩版）

## 设计原则

重度不是"更多面积被覆盖"，而是"可走的地面本身就不对了"。
玩家仍在走路、仍在导航、仍能分辨路径——但踩着的每一步都让人不安。

---

## Prompt

```
Top-down view of a dark fractured interior space that serves as a PLAYABLE GAME MAP, pixel art style, low-fi aesthetic. This is a HEAVILY corrupted area -- but it is still NAVIGABLE. The ground is 75% dark walkable surface, but the walkable surface itself is WRONG: floor tiles that should be concrete are rendered in a shifted palette -- dark teal-grey instead of neutral grey, as if the entire area's color data has been offset. The tile PATTERNS still exist (you can see grid lines, cracks, surface texture) but every color is subtly wrong -- pushed toward green-teal, like viewing the world through a corrupted color lookup table. Scattered across this wrong-colored ground are DENSER anomalies: a few tiles completely filled with solid bright warm-green-teal (#4adf8a) -- flat, featureless, clearly placeholder data where a real texture should be. Cracks between tiles glow brighter and wider than in standard areas. Some tiles show DOUBLED EDGES -- like the tile boundary was drawn twice at 1px offset, creating a stuttering grid effect. The space still reads as a ROOM with WALLS and FLOOR -- architectural structure is maintained. A clear pathway exists through the space. But everything is slightly wrong: colors shifted, edges doubled, occasional flat-fill blocks where data failed completely. The warm-green teal is more present here than standard cyan-teal -- this corruption is OLD and deep. One small warm amber light source provides contrast. high-detail pixel art rendering, extremely dark atmosphere, THIS MUST READ AS A WALKABLE GAME MAP not abstract art, architectural structure maintained, ground is navigable, corruption is in the QUALITY of rendering not in destroying the space itself, shifted color palette as primary corruption signal
```

---

## 与标准/轻度的区别表达

| 维度 | 轻度 (P2) | 标准 (P1) | 重度 (P3 v2) |
|------|-----------|-----------|--------------|
| 地面主色 | 正确灰色 | 正确灰色 | **整体偏移**（暗 teal-grey） |
| 异常方式 | 单像素级别 | 个别 tile 错误 + 缝隙透光 | 整体色偏 + 多个完全填充块 + 边缘重影 |
| teal 色相 | contam-cold（偏蓝） | contam-glow（正 teal） | **contam-ancient（偏暖绿）** |
| 可走性 | 100% 正常 | 95% 正常 | **100% 可走但地面本身已"感染"** |
| 恐怖来源 | "我是不是看错了？" | "这里有问题" | **"我走在不该存在的东西上面"** |

核心差异：轻度/标准 = 正常地面上有异常点缀。重度 = **地面本身就是异常的，但仍可行走**。
