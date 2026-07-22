---
status: APPROVED
date: 2026-07-22
concept: purification-point
---

# 净化点概念图评审结论

## 选定方向：风格A（图1、图2）

### 批准的参考图
- `2026-07-22_164023_gpt-image-home.png` — 通过
- `2026-07-22_164106_gpt-image-home2.png` — 通过

### 不采用
- `2026-07-22_164126_nano-banana-home.png` — 不采用（整体偏暖偏亮，墙壁太"实"，缺乏"虚空中最后据点"的氛围）

## 确认的视觉特征

- **色调**：冷灰为主，仅光源处有微暖（琥珀/橙色指示灯）
- **明暗比**：整体极暗，光源覆盖面积 < 30%
- **边界处理**：空间边缘有机渐变融入纯黑，无硬边墙壁
- **材质**：磨损混凝土、锈蚀金属板、工业管道、功能性设备
- **氛围**：孤立、安静、勉强维持、"最后的光点"

## 实现方案

- **分层固定布局**（非单张预渲染底图）
- 地面层（固定 tilemap/大底图）+ 物体层（独立 sprite，Y-sort 深度排序）+ 顶层（头顶元素）+ 代码光照/氛围层
- 模块为独立 sprite 对象：碰撞体 + 交互触发区 + 状态切换
- 光照渐变/边界黑暗由代码动态生成（raycasting + 粒子系统）
- 风格A的氛围感 ~80% 来自代码光照系统，tile/sprite 本身可以是相对"平"的冷灰工业材质

## 对后续资产生成的指导

生成净化点相关 tile/sprite 时的 prompt 前缀：
```
top-down pixel art, industrial worn concrete and rusted metal, cold desaturated grey-blue palette, functional utilitarian equipment, no decorative elements, dark ambient, 32x32 tile
```

生成净化点设备/模块 sprite 时追加：
```
isolated machine or equipment piece on transparent background, small orange indicator lights, metallic surface with wear marks, cold grey with minimal warm accent
```
