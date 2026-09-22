---
status: IMPLEMENTED / LIMITED-VERIFIED / HUMAN-REVIEW-PENDING
iteration: 30
features: [COH-F042, COH-F026]
related-features: [COH-F006, COH-F039]
date: 2026-09-22
baseline: 32cc772
---

# I30 R5：体积受光与表面信息

## 范围

用户指出净化点有隐性3D空间但渲染未充分表达，要求从成熟作品提炼方法。保留浅透视双层双坡、原角色、六物身份、碰撞、交互与成长经济；改变建筑/设备世界层的绘制和受光，不改变菜单、Rift或存档规则。

以同一像素扫描段写入显式法线、高度、遮蔽与粗糙度；主层0、上层32、双坡连续。材料磨损继承宿主。固定方向光与短接触遮蔽一次烘焙；动态四源按面与高度响应，五个实体设备按同源方向在本层投影。黑腔、空洞和发光像素受保护。

动态材质资格使用未烘焙albedo。技术复核曾发现阴面烤暗后被黑腔阈值剔除，现已修复并补反例测试。另统一坡侧与坡顶高程、壁灯发光口48高度（墙前2px；45曾落在墙后，动态回归检出并修复）。所有烘焙只随创建/公态图像改变发生，不在逐帧回调遍历全图。

## 视觉取证与修正

- 首轮：[实帧与指纹](artifacts/iteration-30-r5/presentation-pass1/manifest.json)。面分离已改善，但墙帽多条平行明暗带、设备基础的厚黑月牙暴露新问题。
- 修正一：[实帧与指纹](artifacts/iteration-30-r5/presentation-pass2/manifest.json)。后墙顶断面分朝向，窄帽下遮蔽替代反复平行带；旧实色接地椭圆收缩、固定设备影随高度减弱。独立复核发现厚月牙仍在，根因追到工作基底：顶面只高3px，侧面却画出十余像素厚度。
- 修正二：[实帧](artifacts/iteration-30-r5/presentation-before-lamp-fix/manifest.json)。工作基底前面缩至0–3px；培养藏后壁/墙脚的维修材料接合连回场所；上层两条无作用双弧换为真实施工缝。独立复评确认厚月牙消失、墙沿改善保持，材料整体精度及外残构缺口保留。
- 动态回归随后检出小壁灯灯源落在墙后：灯口/源高程一起校正到48，投影worldY188在墙Y186前侧；四源墙/地/设备回归通过。此为光源位置修复，不新增第三轮美术方向。最终画面与指纹归[presentation](artifacts/iteration-30-r5/presentation/manifest.json)。

首轮和修后结论分别保留。只有两轮证据驱动的视觉修正；不因技术测试通过提升为艺术或用户PASS。

## 已执行检查

- 表面算法98项、光场60项、原灯池19项、移动/碰撞8024项通过。
- [表面浏览器集成](artifacts/iteration-30-r5/surface-runtime/manifest.json)118项在最终源码通过：有/无map原材逐字节等价，正式缓存与离屏同实现一致，双层/坡道连续、设备平移、alpha/黑腔/发光保护、创建9次bake，空闲窗口0次bake/response编译。建筑可见材料100%登记，六设备92.89%–100%；未标处为少量非承载附属像素，不扩大为全场3D完整性。
- [正式路径](artifacts/iteration-30-r5/runtime/manifest.json)：新游戏、W纵深移动、六处E/冻结/Escape、核心后/前遮挡与底座、中央坡横移/停止/反向、东坡下行、Shift+Enter入Rift及W/D移动通过。此脚本运行早于壁灯2px前移；几何/操作代码未再变化，灯位后专项重新进Rift。
- [动态受光](artifacts/iteration-30-r5/lighting-runtime/manifest.json)：四源地/墙/设备活动、四向原灯锚、核心两侧方向影、空闲设备零重绘、Rift原灯池恢复及退出清理通过。
- 最终 `npm run build` 通过（321模块）；保留既有大chunk提示，不据此宣称包体已优化。`git diff --check` 通过。

## 证据解释

表面诊断PNG是实际生产绘制能力输出的离屏可视化；albedo/baked/normal/height不冒充正式玩家截图。浏览器均新隔离存储；受损场景只改由该次新游戏产生存档的3个公开HP，不构成自然成长证据。已知路线不代表初见导航。短时帧率/烘焙耗时只对应本机无头Chrome样本，不是全硬件承诺或长期泄漏认证。

未复核专门声音、满供奉周期、长期成长获得感及新玩家理解；I28长期采样保持挂起。美术仍由人终审，参考作品不能作为完成质量的替代证据。

## 收尾传播

世界层打磨合同归[美术正文](../art/purification-renewal.md)及[架构](../architecture.md)；玩法spec无机制变化，无新策划数据；UI清单不适用（未改DOM/HUD/面板）。[专业复评](../reviews/2026-09-22-purification-volume.md)、任务、当前迭代/路线和F042/F026文本源已同步，最终来源见[source-hashes](artifacts/iteration-30-r5/source-hashes.json)。完成检查后按持续授权本地提交，不推送。独立CLAUDE.md不纳入提交。
