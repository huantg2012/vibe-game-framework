# R11 · C 局部美术重构候选

[查看候选](http://127.0.0.1:3026/docs/art/demos/purification-r11/c-pixel-sample.html) · [C 原构图](c.png) · [唯一设计正文与恢复指针](../../../art-direction.md#resume-art-rebuild) · [当前步骤](../../../design-notes/purification-scene-art-plan.md#当前执行状态)

用户已否决 `8ef1366` 的墙地、金属与配色，仅认可污染芯形态，未认可其鲜绿颜色。本轮重构对象结构与材质绘制，采用冷中性建筑、灰冷污染绿及有方向的照明分布；候选已导出，未获人审。C 构图不变，继续确定性源码绘制，未生图、未采参考图像素；设计只维护于文首链接。

页面默认核心受光、母版 2×、人物同框；可切普通照明／侵蚀变化、完整 C／原 C、上一版与首版对照。下载当前状态的透明 960×640 PNG，人物是否包含跟随开关。原图和历史对照模式禁用状态、人物与下载，避免把参照误当母版。C 原图不变，样板外仍是构图参照。

源码在 [pixel-sample](./pixel-sample/scene.ts)，制作区域为 `(158,202,442,290)`。[construction-surfaces.ts](./pixel-sample/construction-surfaces.ts)替代旧斑块场，以 `surface()` 同时绘制材质、明度、法线、粗糙度、遮蔽及镜面响应。[导出器](./pixel-sample/export.mjs)保留三态、11 层及原人物同框图，新增 `roughness-occlusion-specular.png`；量化方式及源码权威性写入[导出清单](./pixel-sample/assets/manifest.json)。固定构图阴影仍仅服务静态候选。

本轮 `surface()` 栅格行为、参数及色阶/透明轮廓导出检查已实测通过；真实项目配置下严格 TypeScript（含 noUnused/noUncheckedIndexedAccess）0 diagnostics；浏览器三态、人物开关及五种视图本轮已验，无error/warn。技术检查不代替艺术验收；C 的正式 `src`、通行、动态遮挡、三层视差和全景制作未接入，不能沿用 A 的通行验证。

```sh
node --import tsx docs/art/demos/purification-r11/pixel-sample/check-raster.ts
node --import tsx docs/art/demos/purification-r11/pixel-sample/export.mjs --output /tmp/coh-c-sample-check
```

[上一版](./pixel-sample/assets/previous-master.png)保存已否决的 `8ef1366`，与[首版](./pixel-sample/assets/first-study.png)仅供同尺度对照。更早的 [c-finish-sample.png](./c-finish-sample.png) 仍是生图画风效果稿，不是本母版资产或渲染依据。

---

# A 历史记录 · 已停止，不用于 C 制作

以下仅记录提交 `602ec1e` 的独立 A 布局与校核。后续未完成的透视修订已停止。其技术通过不表示视觉获认可，也不适用于 C。

## 当时布局

- 保留 A 左侧双层据点、厚断壁与右侧深隙的构图。
- 核心前方和两侧略扩地面，储藏避开左坡口，右坡下口留出转身地面。
- 左右坡道形成主地面—上层—主地面的闭环；上层装置前方留出连续横向通廊。
- 六处功能以实体占地块表示，操作锚点落在同层可走地面；块体不是装置新造型。

`a-route-model.mjs` 是当时地面、坡道、装置占地、操作点和人物比例的唯一坐标源。`a-layout-render.mjs` 直接读取它生成 SVG，看图页的操作叠图、通行灰盒及自动检查也使用这份模型。结构图中的建筑大块只提供构图背景，不冻结新的墙面材质或外景内容。

## 方法纠正

选定 A 后曾反复使用生图模型调整窄平台，导致材质和场景内容漂移。用户明确要求改用确定性绘制，当时已停止该做法，撤下未提交的后续生成稿；后续不把它们当作设计依据。最初的 [a.png](a.png) 是构图参照，不是精确碰撞图或成品风格承诺。

这段记录为选择 A 时的历史；当前选择已由文首的 C 决定覆盖。原始生成提示词在 [prompts.md](prompts.md) 和 [edits.md](edits.md)，只对应历史构图探索。

## 通行验证

灰盒使用原人物参考，图像空间 1536×1024 对应正常视口 960×640；人物本体 52.8 图 px 高、脚半径 14.4 图 px，对应原 6 世界 px；操作半径 57.6 图 px 对应原 24 世界 px。尺度来源见 [scale-reference.md](scale-reference.md)。装置占地是保守结构占位，不宣称与旧装置碰撞尺寸完全相同。

支持 WASD/方向键、点击地面、六个目标按钮、正反环路和 E 操作。自动寻路只产生方向输入，所有位移均经过同一个连续圆足扫掠函数，不瞬移。

自动检查：**11 项通过，13,461 个运动帧，0 次瞬移**。覆盖六点操作、下层相邻功能直接连通、两坡双向、上层三条横向通行线、坡口多线及右下转身、实体阻挡、14 处贴边滑动、暂停/失焦与大帧间隔。实际试走发现净化器到裂隙会被窄缝迫使绕上层；裂隙占位上移25图px后，双向路径约155–156图px且全程留在下层，核心至裂隙也保留直接通路，并已加入回归。候选算法的浮点角点接触问题已修复，并保留两个固定回归输入。明细和模型指纹见 [a-route-check.json](a-route-check.json)。

```sh
node docs/art/demos/purification-r11/a-layout-render.mjs
node docs/art/demos/purification-r11/check-a-routes.mjs
```

浏览器也已连续走到六处装置并逐一按 E，页面显示6/6；核对记录见 [浏览器验证](a-route-browser-check.md)。

验证范围为独立布局灰盒。正式游戏的相机、遮挡、装置面板、连续视觉和人的操作手感尚待接入检查；图形与自动检查通过不等于美术验收。当时没有修改 `src`、经济或存档。
