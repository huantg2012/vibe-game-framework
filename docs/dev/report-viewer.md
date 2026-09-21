# 游戏分析与评审报告阅读入口

[审查档案](../reviews/index.html) · [设计与内容阅读材料](../reading/index.html) · [成长样板摘要](../reviews/interactive/growth-sample-review-2026-09-21.html)

## 怎么打开

使用普通浏览器打开上述HTML；交互页内嵌运行代码、样式与原有图像，不需要网络或专用编辑器插件。游戏开发服务运行时，审查专属入口是 `http://127.0.0.1:3025/docs/reviews/index.html`；在Codex中使用浏览器面板打开URL。

正式审查正文归 `docs/reviews/`，对应交互摘要归 `docs/reviews/interactive/`；设计、内容目录等交互页归 `docs/reading/`，与审查分开。机制测试、修复验收仍归 `docs/qa/`。原 `docs/qa/reports/` 页面仅做兼容跳转，旧聊天网页链接继续可用。

聊天中的`.canvas.tsx`文件链接是组件源码。当前用户环境点击后进入源码页，不能把“写入文件、类型检查通过”当作阅读页面已经交付。旧消息的链接无法在仓库中改写；新交付必须提供已经实际打开验证的HTML浏览器入口，TSX只作为来源。即使本地文件面板展示HTML文本，用浏览器打开HTML仍可独立阅读。

页面日期和顶部说明划定历史范围：导出保留原审查数据、判断、图表与筛选；不会自动替换为当前游戏数值。特别是I29 R2的428薪柴、预兆旁路和加厚代价属于原审查时点，后续R3整改另有记录。阅读页面不写入localStorage、不运行游戏，不改变存档。

## 低成本刷新

从仓库根目录执行：

```sh
npm --prefix tools/report-viewer ci --ignore-scripts --no-audit --no-fund
npm --prefix tools/report-viewer run build
```

固定依赖隔离在`tools/report-viewer/package.json`与lock文件，不加入游戏依赖。输出位置由`reports.json`的`kind/output`控制，来源哈希清单为`docs/reading/manifest.json`；现有正式游戏构建不需要包含这些开发文档。

正式审查目录由`docs/reviews/catalog.json`生成，记录正文、范围、日期、交互摘要和后续处理；规范与计划单列。旧路径兼容归`docs/reviews/relocations.json`，归档TSX中的文件按钮也通过同一映射直达新位置。新增审查按[归档规则](../reviews/README.md)落盘。

8份原始文件以字节不变的副本归档在`tools/report-viewer/sources/`。导出器把`cursor/canvas`所需组件适配为浏览器React组件，实际数据、原始图表数值及筛选逻辑仍来自原组件。目录、日期和后续记录映射归`reports.json`。未知图表能力应明确失败，不能静默绘成另一种图。

新增或刷新报告时：

1. 将实际分析来源归档，维护目录与历史/当前范围。
2. 运行导出；检查来源哈希，避免生成页与源文件漂移。
3. 用`node tools/report-viewer/check-archive.mjs`检查归档分类、路径和源稿一致性；在真实浏览器中打开，实际操作筛选/图表/展开/证据链接，并查看控制台。浏览器回归入口为`node tools/report-viewer/check.mjs`，可用`CHROME_PATH`和`CODEX_NODE_MODULES`指定本机测试运行时，`REPORT_TEST_BASE`开启HTTP检查，`ARTIFACT_DIR`指定本轮证据目录。
4. 交付浏览器URL，主动打开相关报告；需要文件交付时同时保留离线HTML。只给源码链接不算完成。

## 边界

本工具只支持已归档8份报告实际使用的组件，不是完整SDK或应用级渲染器修复。原专用宿主源文件保留原样。文件按钮指向仓库原文/证据；外部参考仍为普通链接，只有点击才离开离线报告。分享单页可以阅读图表和内嵌图像；要同时查看仓库证据，需保留仓库相对目录。

测试只验证阅读载体与交互，不改变任何游戏审查、品质、人审或长期平衡结论。[首次阅读修复](../qa/report-reader-2026-09-21.md) · [审查归档与迁移验证](../qa/review-archive-2026-09-21.md)。
