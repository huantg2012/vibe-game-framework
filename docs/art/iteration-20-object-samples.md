---
status: IMPLEMENTED / AWAITING-HUMAN-VISUAL-REVIEW
date: 2026-09-10
scope: First eight contaminant families; four quality appearances; inventory icons and world objects
---

# 迭代 20：首批异物实物与图标

本批把八种异物画成可以被捡起、放下的残留实物。品质从普通、优良、精良到卓越，增加的是同一件东西保存下来的异常结构：错位断层、重复薄边、不可能的折叠。不是给物体换颜色，也不是加一圈品质边框。画面仍待玩家在库存与裂隙中的最终审查。

用户要求独立设计，本批没有读取 `in-game-ux`、`pixel-models` 或 `visual-card-draw`。以世界观的旧材质、异常改变物理关系、冷灰与局部污染色作为边界；不扩展全局色板，不改变现有菜单载体。

## 八件实物

- **冷结块 / solidify**：普通为断裂的浇铸石块；优良露出停在下落中途的横向断口；精良保留上方悬置碎层；卓越再露出上下仍保持关系的碎角。避免长尖晶体和冰冻法术图标。
- **重影片 / scatter**：一片薄硬旧板，折面是主形。品质逐步露出无法与实物重合的第二、第三条材质边；不是外加选择框。
- **返刻片 / retrograde**：磨损的狭长门槛碎片，有不对称踩压凹痕。更高品质出现回到自己旁边的边角与重复磨痕；不使用时钟、箭头或文字符文。
- **缄口布 / muffle**：下垂旧布包着一个很深的折口。高品质在有限布料里多保留了一重反折；外缘仍有短毛边，不能变成金属护具。
- **缺口石 / expand**：石头中间少了一段，后缘却仍连接两边。高品质缺失更深入，剩下的外缘关系仍完整；透明区域是真的空，不以黑色填充假装缺口。
- **留影玻璃 / mirror**：偏斜旧玻璃片、暗背衬和一段不与断口对齐的反射。高品质保留更多错位反射边；镜面高光局部出现，不能整片自发光。
- **复声壳 / kindle**：侧放的厚空壳，开口偏在左下，壳背有不等距肋层。高品质壳口内出现错位内缘，壳背被留下一层不应该还在的外壳。与旧火焰碎片彻底区分；不使用音符、波纹符号。第一轮圆环形已重画，避免与余烬核都读成“长了眼的石头”。
- **余烬核 / combust**：致密脆裂的小块余烬，污染色从实心炭层的分叉裂缝中透出。高品质保留更多断开的外层和内部连接；没有杯口、眼窝或同心圆。第一轮中央空洞已移除。

## 尺寸、色彩与接口

原生图标是 24×24，世界实物是 32×32。二者共享手绘轮廓与结构，但在目标尺寸的像素网格直接栅格化；没有将概念图降采样，也没有将 24px PNG 拉伸成世界实物。展示页可以用 nearest neighbor 整数放大；生产中保持 hard alpha。

沿用此前原生物件的八格材质色与局部污染接缝色：`#272d2b / #444d47 / #687366 / #939b85 / #bdc2a4 / #245a50 / #398a72 / #78b79a`。这不是新增世界光源色板。品质不改变色板；轮廓、断口与保留下来的结构承担差异。

源文件：`src/art/contaminant-icons.ts`。

- `contaminantIconPixels(type, quality?)` → 24×24 RGBA。
- `contaminantIconSvg(type, quality?)` → 原生 24px SVG，合并横向同色像素。
- `contaminantIconUrl(type, quality?)` → 缓存 data URL。
- `contaminantWorldPixels(type, quality?)` → 32×32 RGBA。
- quality = `ordinary | good | fine | excellent`，缺省 ordinary，兼容旧调用。
- 其余十个历史 id 保留原图，以保障旧存档身份与迁移显示；本批未给它们声称新的四品质美术。

导出器：`tools/inventory/export-contaminant-icons.ts`。

```sh
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/inventory/export-contaminant-icons.ts
```

输出：`public/assets/items/contaminants/`。每个样板有 `id-quality.png`、`id-quality.svg`、`id-quality-world.png`；原来的 `id.png / id.svg` 仍对应 ordinary。共 64 张样板 PNG 与 32 张品质 SVG，另有原来 18 个默认图标。导出 manifest 列出尺寸、品质、文件路径，不把展板算作生产物件。

## 验证与待判断

已运行原生导出及检查：18 个 CSV 身份覆盖、图标轮廓不重复、八色色板、完全透明/完全不透明 alpha、无画布边缘裁切、每件四品质图像不同。每个尺寸/品质至少四个实体像素相对报告暗底 `#151a17` 和较亮测试地面 `#292a2b` 达到 3:1 对比度；这是材质边缘的最低读数，不代替迷雾场景的肉眼评估。RGBA 由源几何直接输出，没有图像后处理。已亲看 1:1 图标/实物与 4× 展板；改过复声壳/余烬核混读的问题，并保留缄口布的下垂折边。

预览：

- `public/assets/items/contaminants/iteration-20-quality-sheet.png`：逐家族、逐品质，24px 图标与 32px 实物的 4× 放大和原尺寸对照。
- `public/assets/items/contaminants/iteration-20-native-sheet.png`：只有原尺寸，按上述八件顺序从上到下，品质从左到右。

仍须人判断：

1. 在实际报告背景与裂隙迷雾中，是否能把薄片、旧布、石块、玻璃、空壳、余烬区分开。展板底色不是实际场景，不能代替这一判断。
2. 普通到优良的差异刻意比普通到卓越小。24px 的返刻片、缄口布、复声壳相邻品质主要由局部结构区分；是否达到玩家想要的品质层次，还需要与品质文字一起体验。
3. 高品质重影片/留影玻璃的错边，应读成实物残影，而不是外加选中轮廓。若在游戏菜单的选中态里发生混淆，应调整实物的断边节奏，不额外加粗 UI 框。
4. 世界实物 API 与静态 PNG 已备齐。本资产任务没有擅自更改翻堆揭晓、地面部署或库存载体，实际挂载由集成任务完成。

没有将任何资产记为用户 APPROVED。
