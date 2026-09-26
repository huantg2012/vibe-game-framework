# 核心前庭 · 2026-09-26 视觉候选

COH-F042 / 关联 F026、F006。这组 A/B/C 仅指右侧前庭，与历史构图方案无关。用户尚未选择；当前 Last Light 样景及生产代码未被替换。

- A：低石基延伸，保留边缘核心，组织接近与停留；距离不变、更规整。
- B：残墙接回上层建筑，形成单侧空间边界；增加遮挡与遗迹体量。
- C：整套核心内收至 `[11.3,0,1.7]`，含能量体与全部七个源采样；缩短接近，但核心与上层储藏上下堆叠。

`index.html` 使用完整同镜头渲染和固定局部，提供划线对照及可开关路线标注。当前对照取同一坐姿状态，像素与原样景 `assets/rest/haven.png` 完全一致；材质、源光参数、曝光及帧时刻不变，新增几何或迁移导致的光照差异由共享渲染器重新计算。`assets/comparison.png` 是四图同尺度裁切，不做亮度修饰。

重建：

```sh
node --import tsx docs/art/demos/purification-forecourt-options/export.mjs
node --import tsx docs/art/demos/purification-forecourt-options/check.mjs
node docs/art/demos/purification-forecourt-options/contact-sheet.mjs
```

检查覆盖严格 TS、有限几何、不相关原对象/光源保持、图像尺寸及 current 逐像素一致。浏览器检查当前/A/B/C切换、划线滑杆与构思标注，无控制台 warning/error。路线是设计标注，未接入正式角色移动/碰撞；场景审美与方案取舍待用户确认。
