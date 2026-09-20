# 本游戏现状地图

## 阅读

- [INDEX.md](INDEX.md)：Agent 的全貌入口；按功能 ID 再加载对应 JSON 和正文。
- [atlas.html](atlas.html)：人读的离线浏览图，直接用浏览器打开。可按领域/接入/工作状态筛选，搜索功能，追踪依赖、来源与证据。
- [atlas.json](atlas.json)：唯一编辑入口，指向分领域功能、证据和有效约束；派生视图不要手改。

HTML 是生成时的快照，不会自动追踪仓库。日常只维护文本，想看最新全貌时在项目根运行：

```sh
npm run state:view
```

不启动游戏、不执行构建、不调用模型生成图、不需要网络。重新生成只读取文本和来源指纹。

## 接手与维护

```sh
npm run state:check
npm run state:impact -- --feature COH-F011
npm run state:impact -- --since HEAD
```

发现来源变化后，核对受影响的功能及下游，更新文本和真实证据；确认完成后才执行：

```sh
npm run state:baseline
npm run state:check
npm run state:index
```

`state:index` 仅刷新 Agent 索引，不重做 HTML。基线不是验收，不能刷新它来掩盖未知；历史证据仍独立按其实际版本对照。

## 首次建立的边界

2026-09-20 首次盘点，游戏源码基准 `6332096`。只读追踪正式入口、菜单/面板与数据来源，登记 53 功能、12 领域、19 条有范围的证据；不代表穷尽全部行为，也不是一次新的全游戏运行验收。

语言、设置和可访问性保留未核实；长期采样/平衡/剩余动态审美验收继续挂起。现有 QA 的历史版本和限制保留，部分旧证据关联实现已变化或无法按版本自动比较。新框架入口已移除旧累计进度，游戏规则文档中发现的其他时点矛盾继续在功能 unknowns 中提示。

最低自动发现范围覆盖 `src/scenes/*.ts`、`src/ui/dom/*.ts`、根层 `data/*.csv`，无排除规则。来源指纹还跟踪每个功能列出的其他文件。它不能自动识别同文件内新增的所有功能，代码任务仍需主动维护登记。

协议：[game-state](../../.agents/skills/game-state/SKILL.md)。框架分工：[guide 12](../../guides/12-project-state.md)。独立使用只复制整个 skill 文件夹，不复制本游戏 JSON。建图验证记录：[bootstrap QA](../qa/game-state-bootstrap.md)。
