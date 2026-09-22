---
status: IMPLEMENTED / LIMITED-VERIFIED / HUMAN-REVIEW-PENDING
iteration: 30
features: [COH-F042, COH-F026]
related-features: [COH-F006, COH-F039]
date: 2026-09-22
baseline: da38e91
---

# I30 R6：材料接合与壳外实体

## 范围

用户对 R5 给出积极反馈并授权继续。承接 V03/V04：后墙完整灰泥与露芯接合、工作地坪的完整材料面、厚支承局部断口，及左右外景实体/凹腔比例。保留原人物、六设备、0/32 两层双坡和碰撞、光场/相机、UI、成长经济、Rift 与存档。

外景绘制与共享 helper 拆为两个模块，原 `purification-chamber-pixels.ts` 保留公开出口。类型反向引用不产生运行时循环；三个浏览器脚本的来源指纹及绘图调用计数同步覆盖新模块。

## 取证与修正

- 机械拆分后、艺术施工前：118 项浏览器表面检查通过；四张原材/烘焙/法线/高程诊断与 R5 逐字节一致，见[拆分记录](artifacts/iteration-30-r6/extraction.json)。这是无回归证据，不是美术改善证据。
- [首批实帧](artifacts/iteration-30-r6/presentation-pass1/manifest.json)：正常全景、核心聚焦、上层两端及公开 HP 合成受损。独立复评确认材料面积与外景体量改善；发现两张墙皮和储藏边缘重复褐色弯钩、地坪补面偏封闭。修正聚焦 A/C，保留外景、支承和原光照。

- [最终实帧](artifacts/iteration-30-r6/presentation-pass2/manifest.json)：一次修正将墙皮接回帽下/浇筑缝/回面，去除重复褐钩；面向通道和核心外侧的地坪边缘磨开。独立终评确认主要问题减轻，不要求第二轮。发布精度限制见[正式复评](../reviews/2026-09-22-purification-material-depth.md)。

## 已执行检查

- 表面算法 98、光场 60、原灯池 19、移动/碰撞 8024 项通过；对应算法和布局本轮未改。
- 最终正式入口、缓存、三次重入及正常/受控损伤检查通过；初次绘图校准完整，空闲/行走无缓存重绘。两种公开状态下，六设备与前切/接地/抵抗静态纹理哈希均与 R5 一致，见[保留项核对](artifacts/iteration-30-r6/preservation.json)。
- [表面浏览器集成](artifacts/iteration-30-r6/surface-runtime/manifest.json)118 项通过：实际绘图与面属性一致、覆盖/透明/黑腔/发光保护、两层与双坡连续、六设备平移、正式缓存一致；空闲窗口没有重复烘焙或重新编译。法线/高度诊断图合成了外景，不能拿它们作单独室内属性不变的证据。
- [动态灯影](artifacts/iteration-30-r6/lighting-runtime/manifest.json)：四源地/墙/设备受光、原四向灯锚、核心两侧短影、空闲设备零重绘、Rift 灯池恢复及清理通过。
- [正式操作](artifacts/iteration-30-r6/runtime/manifest.json)：新游戏、W 纵深移动、六处 E/冻结/Escape、核心前后与底座、中央坡横移/停止/反向、东坡下行、Shift+Enter 入 Rift 及 W/D 移动通过。
- `npm run build` 通过（323 模块）；保留已有大 chunk 提示，不宣称包体优化。收尾仅删共享helper末尾多余空行，已确认字节差异仅为尾随空白；运行manifest保留实际测试指纹。最终代码来源见[source-hashes](artifacts/iteration-30-r6/source-hashes.json)。

## 证据边界

浏览器使用新隔离存储；受损仅改该次新游戏存档的三个公开 HP，不能称为自然成长样本。诊断图片为生产绘图函数的离屏输出，非玩家截图。已知路线、短采样窗口分别不代表初见导航或全硬件性能。离屏属性一致和纹理哈希不判断审美。

本轮没有专门复核声音、满供奉周期、长期成长获得感；I28 长期采样继续挂起。积极反馈不扩大成整体可发布或新评分。


## 收尾传播

艺术合同与架构原地更新；只改世界绘制与相应测量来源，无新的 UI/玩法/策划数据。正式评审与目录、I30任务、当前工作/路线、F042/F026来源和证据同步；HTML审查目录刷新，游戏全貌HTML仍按需生成。按持续授权本地提交，不推送；独立CLAUDE.md排除。
