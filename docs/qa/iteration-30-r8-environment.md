# I30 R8 建筑与外景：资产证据

- Feature：COH-F042。实现子任务，不代用户验收；正式场景接入和整轮证据由主任务汇总。
- 已读：CLAUDE、art agent、pixel-models及exemplars、game-state入口、R8全计划、world DEC-180、R7同尺度实帧。
- 接口：`paintAuthoredChamberArchitecture` + `paintAuthoredChamberFloor`；`paintAuthoredChamberForeground`独立；`paintChamberExteriorLayer`分三层，旧整幅API仅供离线兼容。
- 所有权：本任务没有修改layout/玩家/六设备代码/光照系统；没有改玩法或存档。

## 视觉事实与修订

第一结构稿明确替换后肩、东剪墙、前基础，源码与导出在`assets/source/purification-r8`及`artifacts/iteration-30-r8/environment-01`。自身首看发现闭合地坪磨耗像贴片，第二稿改为开放、沿接缝的痕迹。

实际`stage-a/01-main.png`由主任务捕获，本任务亲自看图：屋顶均匀亮带像铝材，地面偏浅蓝，整个建筑仍读作低细节矢量块。此状态不能当成熟成品。针对该实帧的定向材料重作见`environment-03`：cap降值并撤第二条连亮带；地坪收冷蓝与亮度；石灰、旧涂层、砼与外构分别具备矿物场/定向层积/局部骨料三个尺度，外构随距离减少对比与纹理。

`environment-03/environment.baked.png`是当前纯环境证据。`composition-with-current-devices.png`导出期间主任务正在重做核心，核心活腔不属于该静态painter，不能以那张图判断核心完成。没有把源码面数或图片数量当画质结论；新全景仍须完整光照/原角色上下文复核及用户终审。

## 几何与表面检查

导出器调用正式painter；机器检查 floor alpha 每像素等于现有 main/upper/left-stair/right-stair 四多边形的并集，共 **56,895** 像素。新增检查首次抓到右坡踏步沿斜率近似导致6个外溢像素，现改为精确坡边斜率，通过复跑。

建筑 **128,160** 覆盖像素全部有真实面信息；前沿 **2,253** 全部覆盖；中外景 **29,430** 全部覆盖；近外景 **20,797**，其中 **219** 为非受光异常接触层。所有高程有限、编码范围合法，surface不存在渲染外孤立覆盖；far刻意不编造表面。

材质细纹不更改碰撞或体面法线，不移动轮廓，不添加地面层；同像素颜色/normal/height分别导出。静态结构缓存一次，运行时只更新有界接触活动，不启动timer/tween/emitter；`destroy`销毁全部3个Graphics，减少动态查询不注册事件监听。

## 像素HOW自核与限制

- 载体和相机：建筑依托上下真实地坪；外构立体面与受力方向明确。来源中记录原材、加工与维护因果，未借宗教/天空解释形体。
- 外沿为面色；未对物体套第三色轮廓，细节不侵蚀整体轮廓。纯色面已按材料细分，未靠全场点噪维持细节。
- 材料色遵照本次用户授权及DEC-180，包含新矿物/灰泥色；不是假称全部符合旧palette.json。暖色是哑材，非新增暖光；罕见teal只在已有外侵接触。
- 正式角色未改；上层32/主层0及两条坡通行形状未改；镜头视差仅由真实镜头变化产生。
- 未自行宣称“好看”“像本游戏”或画质PASS。普通镜头里材料的成熟度、主焦点、外部纵深与维护感仍以主任务真实视频/实帧及人审为准。

## 执行记录

`node --import tsx tools/art-pipeline/purification-r8.ts docs/qa/artifacts/iteration-30-r8/environment-03`：通过，含同像素表面覆盖与floor精确轮廓断言。新增文件早期`npx tsc --noEmit`通过；并发后全量tsc的唯一报错曾来自他人所有的chamber-observation.ts:25类型转换，已通知主任务，待其整轮复验。
