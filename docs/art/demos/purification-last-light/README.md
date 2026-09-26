# 微光中的据点

以启动页原画为参照的完整像素艺术样景。`35f17ba` 已获用户明确赞许；核心圣龛、灰绿污染、三源混光、建筑依托、外景层次、同身份人物和动态景观作为本轮基础保留。

**2026-09-26：`007554c`布局获用户CHANGES-REQUESTED。** 技术连通没有解决炉挡西侧工作路、核心前空地无效的问题。当前把原炉席整体移入中央偏前，释放楼梯至供奉/净化器的工作路，以休息用途组织空地并保留核心短接近通道；其余场景保持。新位置已实现，完整导出、路线及限定浏览器验证通过，人审待定。主F042，关联F026/F006/F039。

打开 `/docs/art/demos/purification-last-light/index.html`。整景默认播放；可暂停，切换修改前/原画，查看六装置与归来者。核心视图左侧为4×实际场景动态近景、右侧为完整静态模型，可暂停查看扩张/压缩；其他模型左侧为实际整景像素放大、右侧为同源构造近景；人物页另有保留的Rift原精灵。`?t=8&still=1` 复现第八秒。

可编辑三角构型直接在960×640像素网格绘制，世界尺度材料、遮挡、接触阴影与透明层共用几何。核心使用三维密度积分发光与透射，八帧图集演变内质，体内分布光源向全方位照射；其余三类光贡献分别烘焙；实时模块变化真实受光、污染材质、层间空气和深处局部轮廓。未采样原画作贴图，未调用生图，未改Rift角色。

```sh
node --import tsx docs/art/demos/purification-last-light/export.mjs
node --import tsx docs/art/demos/purification-last-light/check.mjs --write
```

`assets/` 保存整景、站/坐光场与掩码、模型、核心密度图集和参数。导出与验证状态只查[统一QA](../../../qa/iteration-30-last-light-living.md)及[证据目录](../../../qa/artifacts/purification-hearth-circulation-2026-09-26/)；旧结果不证明新位置通过，连通数字也不替代舒适通行。

这是动态艺术样景，尚未接正式游戏。阴影几何已烘焙，深度数据不包含被遮挡内容；不宣称实时行走、游戏交互、经济或人物驱动视差已接入。艺术修订待人审。集中方向与当前步骤分别见 `docs/art-direction.md#resume-art-rebuild`、`docs/design-notes/purification-scene-art-plan.md`。
