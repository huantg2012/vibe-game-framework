# 游戏审查独立归档验证

- 日期：2026-09-21；实现基线：`1c7f2c3` 上的本任务工作树。
- 范围：专业审查结果的分类、迁移、可读入口与旧链接兼容。主关联 **COH-F029**，更新已登记审查证据的文件路径；不改变游戏实现或验收等级。
- 结论：归档与阅读验证通过。原审查日期、版本、发现和后续处理的边界保留。

## 分类与实际迁移

[审查目录](../reviews/index.html)集中 **12 份正式审查结果**：9 份原 QA 审查、早期美术包中的 1 份制作判断和 2 份原生 HTML。未按名字机械迁移：`iteration-15.md` 实为敌人生成审查，纳入；`iteration-28-review.md` 等代码/集成合同核查继续留 QA。

原审查规范和执行计划分别移到 `reviews/protocols/`、`reviews/plans/`，与结果分开。十三族技能复审含后续验证的混合历史，整体保留并在目录标明，不拆改观察。原始图片、脚本、专业分审和运行记录仍在已封存的证据位置。

8 份原 Canvas 展示中，4 份专业审查摘要归 `reviews/interactive/`；其余设计、方向与内容目录归 `reading/`。新增[文本归档规则](../reviews/README.md)与[QA 目录说明](README.md)，后续审查正文不再散放 QA 根目录。

## 传播与兼容

- 迁移正文修复相对链接及图片地址，原位置只留迁移指针或网页跳转，没有保留第二份结果正文。
- 活任务、进度、路线、美术正文、架构、相关 QA 和现状索引的引用已更新；完整旧新映射见 [relocations.json](../reviews/relocations.json)。
- 框架规则、具名 agent、skill、guides、START-HERE、AGENTS 的相关路径已检查。专业审查 skill 的历史 QA 路径仍通过指针可达；QA agent 的机制验收路径继续有效。本项目后续审查按 `docs/reviews/README.md`，不混入独立框架改动。
- 原 Canvas 源文件和旧运行实录保持字节不变。归档按钮通过路径映射直达新正文；原聊天中的 8 份网页和旧目录继续可用。
- 上一轮阅读器的导出清单另存为 [当次清单](artifacts/report-reader-2026-09-21/export-manifest.json)，匹配旧浏览器记录的指纹。新导出清单不替代旧取证版本。

## 验证证据

- `node tools/report-viewer/check-archive.mjs`：目录条目、正式正文位置、规范计划、兼容指针、原稿一致性和本地附件链接检查，见 [归档检查](artifacts/review-archive-2026-09-21/archive-check.json)。
- `REPORT_TEST_BASE=http://127.0.0.1:3025/ node tools/report-viewer/check.mjs`：8 份新页面离线渲染与主要交互、12 份审查索引、两类目录的 file/HTTP 检查、18 次旧网页跳转、原稿文件按钮重定位、22 步图表可见性，见 [浏览器记录](artifacts/review-archive-2026-09-21/browser-check.json)。
- 两份早期 HTML 从旧入口离线跳转到新位置，原证据图片加载通过，见 [旧美术报告检查](artifacts/review-archive-2026-09-21/legacy-browser-check.json)。
- 同源重建的生成文件一致；本次浏览器记录锁定导出清单和审查目录的 SHA-256。

本次是资料组织与阅读检查，没有重跑游戏玩法、平衡或美术验收，也没有重新开启 I28 挂起项或 I30。现状索引保留独立 `CLAUDE.md` 漂移和既有证据适用性提示；未借迁移提升历史结论。
