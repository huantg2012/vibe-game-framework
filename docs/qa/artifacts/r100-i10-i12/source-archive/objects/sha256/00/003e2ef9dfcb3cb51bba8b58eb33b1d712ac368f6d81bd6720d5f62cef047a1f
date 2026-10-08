# 生命大陆体验场景：远景资产请求

状态：已由ROOT用内置imagegen生成并接入实景；本文件是art请求稿，实际调用prompt、参考与SHA以 [vista-r2.generation.json](vista-r2.generation.json) 为准。不是新概念图交付，不代表人审通过。

asset: living-landmass-vista-r2
用途: 可移动玩家体验场景的实际远景背景；3D岩质走面覆盖画面下部。
工具: 内置 imagegen（由有生成权限的执行者调用）
尺寸: 1536x1024 px，3:2
输出格式: PNG
固定 Prompt 前缀: 本轮生命大陆风格开放，无已锁定固定前缀；以下正文完整定义本张试用背景。
参考图: docs/art/iteration-21-worlds/living-continent-world-r1.png，仅借用相互托举的巨构、巨大空腔与雾中纵深，不保留前景人物或走面。
Prompt 正文:

```text
Use case: stylized-concept
Asset type: actual runtime distant matte backdrop for a playable game scene, landscape 3:2, 1536x1024. This is ONLY the distant environment layer, not a complete screenshot or concept presentation.
Input image: the supplied image is a reference for immense interconnected living-continent scale, suspended bodies, broad membranes and load-bearing fibers, and huge airy voids. Redesign composition for this runtime backdrop; do not copy its foreground terrain or person.
Subject: a complete and immense world of mutually supporting ancient living continents hanging in pale grey-lilac atmosphere. Enormous broad bodies made of weathered warm taupe horn and fibrous stone-like tissues, softly folded undersides and huge open cavities. A dominant oblique body crosses the upper-left into upper-center; a separate distant broad body hangs on the upper-right; between them one complete visible cross-connection and its two merging contact points. Behind and below, several varied silhouettes recede through four distinct atmospheric depth planes. Organic broad forms, each with irregular tapering shapes and different orientation and scale. Clearly show the whole giant body and an immense void underneath, not just a close crop of its surface.
Composition: the main world structures occupy the upper 60% of the picture. A broad light air opening around the center-right separates the bodies. The lower 35% is predominantly quiet grey-lilac abyss mist with only extremely faint far-away silhouettes; no walkable foreground. One or two sparse fibrous continuations may descend near the far left and far right edges, leaving the lower center clear for actual 3D foreground geometry. Keep immense scale and strong complete silhouettes readable when displayed small.
Style: controlled pixel-painted game background; clearly designed large color clusters, restrained stepped edges, broad quiet planes, sparse directional texture that describes the curvature. Not photorealistic, not dense high frequency texture, not a low-resolution filter over a photograph. No uniform outline around all bodies.
Lighting: luminous overcast air behind distant structures, soft directional light from upper right. Nearest giant bodies warm grey-brown; distant bodies fade toward pale grey-violet. Low saturation, atmospheric, solemn, deep, vast. The openings remain visibly brighter than the bodies. No green cast or green material.
Constraints: no player, no human silhouette, no UI, no letters, no labels, no logo, no borders, no walkable foreground rocks or paths, no small gameplay objects. No sliced meat, steak, bitten disk shape, flesh-red material, gore, mushrooms, cartoon floating islands, rows of identical floating platforms, tree trunks with mushroom caps, tidy architecture, dangling rope bridge, or giant single flat plate filling the frame.
```

反向 Prompt: 已并入正文 Constraints。
工具参数: 使用内置默认；参考图路径传 referenced_image_paths；不同时传 recent-image 参数。
期望输出文件名: public/assets/dev/living-landmass/vista-r2.png
后处理 config: 无；直接运行时背景，不平铺，不降采样成单块 tile。
锁定色板: 无；本轮视觉未锁定。

## 实机合成与验收

- 背景按3:2完整呈现；不使用 cover 裁切掉主巨构的完整形体。
- 画面上方约60%保留壮阔的多级身体关系；实际可走地图主要覆盖下方35%–45%，不在正中竖起大墙。
- 第一眼同时找到玩家、落脚地面与远处的巨大结构；可走层边缘的低饱和材质和生长方向要与背景延伸束相接。
- 前景直接复用背景近层的暖灰褐明暗关系；不能用一层泛绿灯光把两层统一为绿色。
- 至少一处完整跨接与两端的接触可见；至少三级体量有明确空气间隔，远层对比逐级下降。
- 背景不会随着玩家平移按与地面相同速度滑动；若用极小视差，完整接点在全行走范围仍保留。
- 玩家所有站位均能判断脚下的可走区域，背景的悬空轮廓不会被误读为当前可达路线。
- 图片只是背景资产。移动、碰撞、角色遮挡、落脚阴影和近处的透视都必须由真实运行时负责。
- 人终审仍待实际体验；不能把资产生成或机械检查记为好看、像游戏或通过。
