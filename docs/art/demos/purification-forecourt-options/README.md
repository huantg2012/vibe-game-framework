# 已选 A · 裂隙修订（2026-09-26）

COH-F042 / 关联 F026、F006。用户选择 `5c44af8` 的 A 断裂回廊，认可 `5445d15` 的裂隙位置与形态。此页面的对照图是 `731be73` 的72%宽度历史快照；最新要求已将源开口进一步收至原52%（最宽0.6864m），并接入正式 `PurificationScene`。正式入口为项目根页面，本目录不再代表待选方案或最新生产截图。接入与验证见 [生产QA](../../../qa/iteration-30-last-light-production.md)。

位置与画法的唯一正文在 `docs/art-direction.md#resume-art-rebuild`。A 原真实断口和 2.26m 回廊保持；裂隙迁左前断沿 `[.6,0,5.94]`，操作站位 `[1.15,.07,4.30]` 留在完整地坪，从参考站位约 2.7m。竖向不对称伤口跨越空气、楼板与下方建筑剖面；光仅调整 Rift 的污染来源，主核心、炉席、四设备、人物、外景及其光源保持。

`a-before-rift.png/json` 冻结用户选择时的原 A；`a.png` 是新 A。同镜头、同材质渲染，支持按住/划线对照、独立路线与构思标注。站立角色只是参考起点，不定义正式归来出生位置。当前正常镜头呈现窄长裂口轮廓，内喉的细小错层要近看；不夸大远景细节可读性。

```sh
node --import tsx docs/art/demos/purification-forecourt-options/export.mjs a
node --import tsx docs/art/demos/purification-forecourt-options/check.mjs
node --import tsx docs/art/demos/purification-forecourt-options/check-rift-light.mjs
```

限定验证：严格 TS、有限几何、按 ID 核对非目标光源/对象/能量体/外景保持；A 的 171 个路线中心样点，以 0.22m 足半径检查地面支撑。不是完整碰撞或真实游玩验收。独立去掉 Rift 灯而保留相同几何/自发光后，5025 个建筑像素因 Rift 受光，最大单通道差 36，记录于 `assets/rift-light-check.json`。浏览器验证新旧切换、划线和路线选择；交付默认无标记的新 A。

历史：`2f4c199` 首轮小改被用户否定；`5c44af8` 第二轮 A/B/C 与 `assets/comparison.png` 按该版本取证。B/C 源码和图保留历史，当前不再待选。`contact-sheet.mjs` 是历史四案导出器，不用于本轮 A 新旧比较。
