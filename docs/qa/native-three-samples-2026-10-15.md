# 三张固定参差岸线样本 · 2026-10-15

DEC-212；主绑定COH-F011，关联F007/F012/F052。用户要求把参差岸线应用到风格差异大的三图，作为后续持续打磨对象。本批范围是固定DEV样本及真实材质浏览，不把几何诊断图记作完整可玩地图。

入口：`/native-construction.html`。双脊渡口（split-rib-causeway，纤维）、断脂浅片（gel-rafts，凝胶）、无彩层原（ash-strata，折板），均固定medium／20261012。双脊沿用上批参考；另两图各有独立构型CSV和岸线CSV，保留对应完整母体及附属浅层，不是同图换皮。

## 实际构造结果

- 双脊渡口：12H／6S，最长直边272px；沿用[上批冻结参考](artifacts/native-construction-2026-10-14/reference-final/report.json)。G1空白／深区及G3宽域仍失败。
- 断脂浅片：10H／5S，最长直边160px，17,680个身体站位全部可达；[最终回执](artifacts/native-three-samples-2026-10-15/gel-rafts-round2/report.json)仍拒绝最大空白半径204.523px及宽域占比0.512783，深区跨度336px通过。
- 无彩层原：12H／6S，最长直边193.4px，18,628个身体站位全部可达；[最终回执](artifacts/native-three-samples-2026-10-15/ash-strata-round2/report.json)仍拒绝最大空白半径185.537px、宽域占比0.469616及目标面积下界（实际1,192,192px²，比下界少300.8px²），深区跨度344px通过。

两新增图分别初检一次、按明确问题修正一次，未继续搜索；原round1失败独立保留。最终两图来源稳定，孔形身份与物件完整投影支撑零违规，G2通过。三图均保留384px实际长直边上限；凝胶与折板的岸线分段80–160px、保护距离48px，双脊保留自己的128–288px／80px参数，不修改原G1–G4门。所有构造回执完整候选计数均为0。

## 渲染与验证边界

DEV页面构型／初始几何各构建一次，再单独编译一次含岸壁的视觉terrain和raster，逐格核对地面mask一致。材质使用正式painted material、ground、bake和MasterSurfaceRenderer；只收窄渲染入参类型，不改正式渲染行为。每图缓存材质和剪影两张2D画布及诊断，临时WebGL渲染器销毁，切换不重新生成。页面不读写存档、不调用旧r12搜索、不部署资源／敌人／撤离点；白圈仅为构造出生探针。

唯一`npm run build`（tsc＋Vite）通过，Vite阶段26.01秒，仅既有chunk体积warning。[构建日志](artifacts/native-three-samples-2026-10-15/build.log)。随后显示修复后的`npx tsc --noEmit`也通过（[日志](artifacts/native-three-samples-2026-10-15/typecheck.log)）。实际浏览器采集和独立窄审结果另见[本批审查](artifacts/native-three-samples-2026-10-15/review.md)。

最终[三图图册](artifacts/native-three-samples-2026-10-15/browser/index.html)包含材质／结构各三图，链接到固定样本实时入口。浏览器身份、源SHA、视图与样本切换缓存检查通过，pageerror为0。首轮发现双脊连接缝与折板母体在剪影中被反向三角抵消，已统一绕向；仅重捕这三图一次，CSV、几何门、指标与材质PNG哈希全不变。凝胶原剪影无此缺失，修复前后PNG哈希一致。首轮完整保留于`browser/before-winding-fix/`，旧CLI产物不回写。

三份参考用于后续固定身份打磨；完整准入、游戏内容、未知出口、正常视距潜行、保存恢复及全108推广仍未完成。普通出发保持r11，旧版本恢复不变，I14/P49与用户审美终验不提升。
