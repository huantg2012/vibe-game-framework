# 游戏审查档案

[浏览审查目录](index.html) · [登记源](catalog.json) · [游戏当前状态](../game-state/INDEX.md)

这里是本游戏**正式专业审查结果的唯一归档位置**。包括整游戏、关卡、玩法、成长、内容、美术及视听设计审查。使用 `game-review` 时，报告按本页的项目约定落盘；审查方法仍由 skill 负责。

## 从哪里读

- [成长样板复评](growth-sample-review-2026-09-21.md) · [交互摘要](interactive/growth-sample-review-2026-09-21.html)
- [净化点场景与成长](purification-growth-review-2026-09-20.md) · [交互摘要](interactive/purification-growth-review-2026-09-20.html)
- [完整目录](index.html)按时间列出对象、正文、可用摘要与后续处理，包含早期敌人生成、污染物、世界生成和场景美术审查。

目录中的日期和说明标记原审查时点。历史发现、整改验证、玩家认可分别保留；迁移位置不改变任何结论，也不表示旧缺陷目前仍存在。

## 放置规则

- **根目录的报告正文**：新报告使用 `YYYY-MM-DD-主题.md`；复评另建有日期的记录并关联原报告。旧文件名保留，避免把目录整理误作新审查。
- **`interactive/`**：正式报告对应的可读交互摘要，不代替完整正文。
- **`protocols/`**：审查规范；**`plans/`**：审查执行计划。两者在入口单独列出，不算结果。
- **`legacy-2026-08-28/`**：早期原生 HTML 审查及配套制作判断。原截图、卡图和生成资料仍在美术证据包，报告内引用已调整。
- **`artifacts/<报告标识>/`**：后续审查的分审意见、实录与附件。已封存的旧证据保持原位置，通过正文链接访问，不批量改写历史取证。
- **`catalog.json`**：维护报告对象、日期、正文和后续记录链接；**`index.html`**由工具生成，不手工维护第二份结论。

QA 合同核查、代码集成审查、自动测试、复现记录和修复验收继续归 [docs/qa](../qa/README.md)。游戏设计正文归 `docs/design-notes/`、`docs/specs/`；整改任务归 `docs/tasks/`。设计/目录类交互展示从[其他阅读资料](../reading/index.html)进入。

## 每次审查收尾

1. 在本目录保存正文，包含实际日期、版本、范围和证据边界；引用相关 feature ID。
2. 登记 `catalog.json`。有交互摘要时同时登记 `tools/report-viewer/reports.json`，`kind` 使用 `review`。
3. 关联真正的后续任务/验证；未实施就明确未实施，不用新位置掩盖历史失败。
4. 执行 `npm --prefix tools/report-viewer run build` 刷新入口；检查正文、附件与摘要链接，再更新当前工作及现状索引。
5. 向人交付审查浏览器入口和正文链接；向 agent 留文本、证据与后续指针。

[阅读器与刷新说明](../dev/report-viewer.md) · [本次整理验证](../qa/review-archive-2026-09-21.md)

## 旧链接与框架边界

原 `docs/qa/` 审查文档仅留迁移指针，旧 HTML 留跳转页；旧聊天和框架 skill 的历史引用仍可到达正文。映射登记在 [relocations.json](relocations.json)。原 Canvas 源稿及封存证据不改字节。

此次修改属于本游戏的资料归档。通用 QA agent 仍按 `docs/qa/` 交付机制验收；通用审查 skill 中的旧 QA 路径经兼容指针解析，本项目的新审查直接采用上述专属位置。没有混入独立的框架修改。
