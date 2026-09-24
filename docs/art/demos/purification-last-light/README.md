# 微光中的据点

用户改选启动页原画 `public/assets/art/menu-last-light.png` 后制作的完整艺术样景。旧 C 已被否决。活跃设计与恢复方向集中在 `docs/art-direction.md#resume-art-rebuild`。

打开 `/docs/art/demos/purification-last-light/index.html`，查看整景、原画及六个模型。模型视图左侧为整景原像素放大，右侧为相同几何/材料在更近像素网格上的单体绘制。

制作方法：可编辑三角构型辅助固定 960×640 像素绘制；世界尺度材料、实际投影、接触阴影、前后玻璃/液体与有限光源分别计算。没有采样或覆盖原画，没有调用生图。原人物来自现有 production sprite。

```sh
node --import tsx docs/art/demos/purification-last-light/export.mjs
node --import tsx docs/art/demos/purification-last-light/check.mjs --write
```

产物在 `assets/`：整景（含/不含人物）、最近邻 2× 图、六个透明模型 PNG、深度/图层编码、对象 ID 与参数。深度图是可见像素的辅助数据；不是带完整被遮挡内容的实时视差资产。

`check.mjs` 检查 strict TypeScript、有限几何、六站内容、实际顶面和设备/暖炉脚印上的站位连通。双坡连通仅对样景布局有效，不代表正式游戏碰撞已接入。

当前为艺术待审候选；未接正式场景、交互、经济或动态视差。技术检查通过不表示用户认可画面。
