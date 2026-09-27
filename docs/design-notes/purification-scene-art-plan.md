---
status: R11-LAST-LIGHT-PRODUCTION / IMPLEMENTED / LIMITED-VERIFIED
created-date: 2026-09-23
last-modified-date: 2026-09-27
owner: director
baseline: 35f17ba（完整像素画法） / 5445d15（A与裂隙方向认可）
features: COH-F042 / COH-F026 / COH-F006 / COH-F039
---

# 净化点美术重构计划

## 当前决定

用户已选择 A 断裂回廊，认可左前断沿竖向裂隙，最新授权：“再窄一些，然后直接做正式版本入游戏”。裂隙相对原始中心线收至52%（上一版72%），最宽0.6864m；位置、高度、操作点、楼板断口、A回廊及其他设备保持。

美术原则与世界观只维护在[集中美术正文](../art-direction.md#resume-art-rebuild)。必须沿用获认可的源模型、材料、光照与固定像素采样，不用另一套简化几何冒充正式版本。旧A/C、R10及被否决版本不约束当前画法；既有人审认可不等于本次正式接入的人审通过。

## 当前执行状态

- [x] 裂隙由72%再收至52%。
- [x] `PurificationScene`切换新场景，六处原业务保留；共享Player新增显式外部呈现选项，Rift默认路径保持。
- [x] 接入坐下/起身、1.18倍轻推镜头与氛围文案；不改变生命、资源、时间或存档机制。
- [x] 同一A模型离线导出：无人物场景、真实表面数据、分层外景、能量体、八向站立/行走/坐姿。
- [x] 同源导航：真实断口与回廊、上下层、西坡、设备足迹；投影输入适配原WASD。
- [x] 动态肩灯、角色受光/遮挡、四板交叉深度与状态响应复核；体积透明合成修正。
- [x] 正式主菜单、六站、坐下/起身、出击放弃归来、暂停/读档重入实测；释放路径代码复核。
- [x] 生产构建、纯移动/资源/共享Player回归；QA与现状文本已收口，依持续授权本地提交。

## 制作与接入

作者源保持在 `docs/art/demos/purification-last-light/` 与 `purification-forecourt-options/option-a.ts`。`tools/last-light/export.mjs`导出至`public/assets/last-light/`；运行时仅载入正式资源，不能在浏览器执行离线光线烘焙。`export-layout.mjs`从同一作者几何生成行走、足迹与观察数据。

`LastLightVisual`负责Phaser资源/纹理生命周期；`LastLightRenderer`消费材质、法线和深度计算移动肩灯与人物受光，组合核心能量、污染/炉光及分层景观；`LastLightLocomotion`保有真实世界位置与所在楼层，只把投影脚底转换为原业务角色坐标。六处经济、保存及出击事务仍由原场景负责。

正常入口为项目根`index.html`（本地 `http://127.0.0.1:3027/`）。原比较页与动态查看页保留为历史作者样景，不能再被称为正式入口。验证与边界统一记录在[生产QA](../qa/iteration-30-last-light-production.md)。

## 边界

本次只把获选据点场景做正式接入；Rift低精度角色、俯视地图、战斗和既有经济/存档字段保持。I28长期供给/平衡仍挂起。残骸仅供坐下，无第七个功能站、恢复收益或等待玩法。兼容降级若启用必须可诊断，不能宣称与正常GPU画面一致。

必要检查后依持续授权本地提交，不推送，不纳入独立`CLAUDE.md`改动。
