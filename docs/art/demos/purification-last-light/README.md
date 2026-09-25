# 微光中的据点

以启动页原画为参照的完整像素艺术样景。`35f17ba` 已获用户明确赞许；当前为其七项反馈修订：核心圣龛、灰绿污染、三源混光、右侧建筑依托、外景层次、同身份新人物和动态景观。

打开 `/docs/art/demos/purification-last-light/index.html`。整景默认播放；可暂停，切换修改前/原画，查看六装置与归来者。模型视图左侧为实际整景像素放大，右侧为同源构造的近距离像素绘制；人物页另有保留的Rift原精灵。`?t=8&still=1` 复现第八秒。

可编辑三角构型直接在960×640像素网格绘制，世界尺度材料、遮挡、接触阴影与透明层共用几何。三类光贡献分别烘焙；实时模块变化真实受光、污染材质、层间空气和深处局部轮廓。未采样原画作贴图，未调用生图，未改Rift角色。

```sh
node --import tsx docs/art/demos/purification-last-light/export.mjs
node --import tsx docs/art/demos/purification-last-light/check.mjs --write
```

`assets/` 包含整景（有/无角色）、2×图、七模型、原Rift人物、基线、三类光贡献、可见深度/图层、对象ID、动效掩码和源参数。`check.mjs` 校验strict TS、有限几何、三类源、可见污染/光贡献和六站/双坡保守站位连通。

这是动态艺术样景，尚未接正式游戏。阴影几何已烘焙，深度数据不包含被遮挡内容；不宣称实时行走、游戏交互、经济或人物驱动视差已接入。艺术修订待人审。集中方向与当前步骤分别见 `docs/art-direction.md#resume-art-rebuild`、`docs/design-notes/purification-scene-art-plan.md`。
