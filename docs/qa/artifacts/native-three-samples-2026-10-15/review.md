# QA：参差岸三图 DEV 实景

日期：2026-10-15。范围：COH-F011/F012 本次三图 Task Brief；固定 `medium / 20261012`，DEV 材质与几何展示。**采集与缓存检查通过，三图均未通过完整地图准入。**

[最终图册](browser/index.html) · [最终回执](browser/capture.json) · [修复前完整证据](browser/before-winding-fix/capture.json)。真实 Chrome `155.0.8059.40` 导出原始 canvas；每图材质、剪影各一张，均为 2304×1792，无修图。最终采集开始于 `2026-10-15T01:46:07.196Z`。

## 验证结果

- 三图及两模式切换、原尺寸/适配、固定名称/种子/CSV SHA、三图缓存回访均通过，`pageerror=0`。每次独立页面会话内，每图构造、断缘编译、初始几何、视觉地形、视觉栅格各 1 次；切模式及回访计数不变，`fullCandidates=0`。
- 三图全身体可达、孔形与最终 source 支撑无违规，外岸及 G2 通过。双脊渡口 H/S=12/6，最长直边 272px；断脂浅片 10/5、160px；无彩层原 12/6、193.4px。
- 双脊渡口仍拒绝 `G1-largest-empty-radius`、`G1-long-deep-empty-region`、`G3-wide-domain-area`；断脂浅片仍拒绝前述最大空白及 G3；无彩层原仍拒绝最大空白、G3 及 `walk-area-outside-intent`。未执行完整内容部署、G4 或可玩准入。

## 显示问题与复验

首轮发现 `src/dev/native-construction.ts` 合并三角路径时正反绕向抵消：无彩层原母体消失，双脊渡口连接处出现假细缝。Code 统一绕向后，经授权仅重捕三图一轮；母体及连接处显示已恢复，材质中母体也可见。原轮未覆盖，保存在 `browser/before-winding-fix/`。

两轮逐图的 gates、geometryMetrics、CSV 身份及材质 PNG SHA256 **完全相同**；仅 ash/split 剪影变化。断脂浅片两轮剪影 SHA 也相同，5 个实体与材质对应；首轮对其“母体缺失”的临时判断已撤回。两轮各自 `sourcesStable=true`，已跟踪源中仅 DEV 页面发生绕向修复。最终页面 SHA256：`e12146b09cac9c1341c8fa7b864f8b4d0d75c97c5e19448d910aab80f86a2708`。

## 静审与边界

`ground.ts / surface-fields.ts / surface-bake.ts / surface-renderer.ts` 差异仅为 `import type` 及入参收窄到 `MasterSurfaceWorld` 的 `Pick`，未改运行语句。DEV 页面使用正式材质渲染、缓存两张 2D 画布并销毁临时 WebGL；无普通配方恢复或完整 MasterWorld 准入声称。

统一构建由 root 执行并已通过，见 [build.log](build.log)；QA 未重复构建、作者布局轮次或 r12 搜索。该日志早于剪影修复；修复后范围由最终浏览器实测覆盖。图册供人审视实际画面，不代替审美确认。
