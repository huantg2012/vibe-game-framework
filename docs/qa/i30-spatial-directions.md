# I30 三方向设计与阅读载体检查

日期：2026-09-21。范围：F026/F042 的设计候选与独立阅读页。**未运行正式净化点、未改游戏代码、未接触玩家存档；不是正式关卡验收。**

## 交付

- [设计正文](../design-notes/purification-spatial-directions.md)：残墙工作院、错层断崖站、剖开的巨械；三者分别以墙、断面、机体组织真实通路。
- [阅读页](../reading/purification-spatial-directions.html)：每卡含实体占位、六操作位置、点击寻路、不可走范围、归来落点复位、六功能形体与制作风险。
- Design 与 Art 独立推敲后合入正文；恢复原审查S01–S03及GR-06，未以本次设计提升历史审美状态。
- I30改为 DESIGNING / OPTIONS-READY / NOT-IN-PRODUCTION；候选可改变旧锚点与形体，原角色、2D、六功能与机制保持。

## 已检查

1. 用独立无头 Chrome 打开正在运行的本地服务；未共用用户浏览器上下文。
2. 三卡各六处目的地均在示意可走掩码内，能从归来点到达；逐个点击全部18个目的地按钮，位置标记到达各自操作点。
3. 各实体块的检测点均拒绝寻路；开启阻挡覆盖、复位、切卡正常。寻路用同一示意掩码，没有只画一条路线冒充可通行。
4. 1440px与760px阅读视口正常，无横向溢出，无页面脚本错误；主代理检查三卡全页截图，文字与图例可读。
5. 阅读材料目录中存在唯一入口；`npm --prefix tools/report-viewer run build` 成功。独立页通过 `reading-links.json` 注册，不伪造旧canvas导出来源。

[检查结果](artifacts/i30-spatial-directions/checks.json) · [A截图](artifacts/i30-spatial-directions/a-direction.png) · [B截图](artifacts/i30-spatial-directions/b-direction.png) · [C截图](artifacts/i30-spatial-directions/c-direction.png) · [窄窗](artifacts/i30-spatial-directions/narrow-reading.png)

## 限度与下一步

- 图是布局研究，颜色区分结构；数字是操作焦点，圆点是位置标记。没有重画玩家或交付最终像素资产。
- 示意寻路是四邻接离散路径；没有验证Phaser角色脚部碰撞体、实际斜向转角、交互范围、深度排序和相机聚焦。
- 未测新旧路线时长；约20%的增幅限制是选型后灰盒预算，不能从本页动画得出已达标结论。
- 三个方向仍待用户判断；之后先原角色/原速的碰撞灰盒，再共同制作场所与六对象，成长获得感保持在I30范围内。
- 独立 `CLAUDE.md` 修改不属于本次任务；索引保留其原指纹漂移提醒。历史证据适用性和语言可达性未知也保留。
