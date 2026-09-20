---
name: game-state
description: 建立、维护和恢复游戏全貌认知：用文本索引关联玩法、内容、菜单、系统、有效约束与实现证据，检查变化影响，并按需生成离线 HTML 全貌图。用于了解游戏现状、接手长期项目、迭代收尾和刷新功能地图；不替代系统 spec、品质评审或任务管理，可独立于 agent framework 使用。
---

# 游戏现状地图

## 核心约定

以 `docs/game-state/atlas.json` 为入口；项目可自选目录。文本是唯一编辑源，`INDEX.md` 和 `atlas.html` 是派生视图。一个系统仍只维护一份规则正文；这里只索引能力摘要、入口、状态、关系和证据。

区分设计意图、实现事实、验证事实。`production` 是有实际调用路径支持的正式接入声明，不等于体验通过。`work=settled` 不是验收。文件存在、快照指纹相同、测试代码存在，都不证明玩家可以使用。无法确认的条目写 `unknown` 或明确 `unknowns`，不静默遗漏。

## 选择工作方式

- **首次建立**：读 [protocol.md](references/protocol.md) 与 [format.md](references/format.md)。运行 `init`，按固定覆盖域扫描项目，追踪正常入口，登记真实证据和明确空白。先覆盖全貌，再按风险深入，不为凑数量给控件逐一建档。
- **接手 / 回答现状**：先 `check`，读 `INDEX.md` 的全域摘要与当前文本，再读目标功能的来源及依赖。索引漂移时仅重核相关区域；不把旧 HTML 当实时状态。
- **迭代更新**：开工确定功能 ID，`impact` 定位直接影响、反向依赖和所需背景。实现方更新事实，验证方追加/替换有范围的证据，收尾核对未知及约束，`baseline --reviewed` 后 `check` 和 `render --index-only`。
- **人类全貌图**：运行 `render`，打开输出的 `atlas.html`。无需启动游戏、网络、模型生成图片或前端构建。过滤、搜索、领域图、详情均来自同一文本。
- **迁移到其他游戏**：复制完整本 skill 文件夹即可使用；Node.js 18+，无第三方依赖。运行 `init --root <新项目>`。不要复制旧游戏的功能、风格和机制约束。框架集成是可选层。

## 工具

以下 `<skill>` 指本文件所在目录；命令不要求项目有 npm、特定引擎或 Git（只有版本差异追踪需要 Git）。

```sh
node <skill>/scripts/game-state.mjs init --root <project>
node <skill>/scripts/game-state.mjs check --root <project>
node <skill>/scripts/game-state.mjs impact --root <project> --feature FEATURE_ID
node <skill>/scripts/game-state.mjs impact --root <project> --since <commit>
node <skill>/scripts/game-state.mjs baseline --root <project> --reviewed
node <skill>/scripts/game-state.mjs render --root <project> --index-only
node <skill>/scripts/game-state.mjs render --root <project>
```

自定义入口使用 `--atlas relative/path/atlas.json`。`init` 拒绝覆盖非空目录。`check`：退出 1 = 格式/引用错误；2 = 来源漂移、缺少基线或扫描到未登记文件；0 = 结构与登记来源一致，**仍可能存在未知领域、无验证或失效历史证据**。工具输出必须与语义判读一起报告。

`baseline --reviewed` 只是“已核对文本与文件指纹”的检查点。不能为了变绿盲目刷新；它不会重写证据版本、提升状态或让历史运行结果重新有效。历史证据对照在显示时独立按其版本计算。

## 防止长期遗忘

- 新建/下线玩法、菜单、内容注册项必须更新相应稳定 ID；退役记录保留去向和理由。
- 每个覆盖域写清 mapped / unreviewed / not-applicable，不以“我没搜到”推导不存在。
- `inventory` 定义可机械扫描的文件集合，每个排除项需理由；增加文件会触发未登记提示。目录文件扫描不能发现同文件中新加的菜单分支，仍需代码改动收尾检查。
- 接口、存档、共享表现或约束变化，复核依赖闭包；不每次全量重读所有 spec。
- 约束链接到已接受的有效决定；新决定用 superseded 显式替代。冲突记录待裁决，既不把错实现合法化，也不按过时文档回退。
- 会话交接保留：任务目标、功能 ID、改变的事实/文件、已跑验证及版本、未决事项、下一步。新 Agent 再从磁盘核实，不依赖压缩摘要复述规则。
- 不以本技能调用推定授权修改玩法、运行破坏性测试、提交或推送；这些遵循原任务授权。

## 交付

说明登记范围与未核实范围、执行的机械检查、实际验证的限度。提供文本入口和 HTML 文件链接、刷新命令。没有亲自运行游戏则明确写静态核查；没有玩家终审不能代勾审美或好玩。协议维护在 references，框架只链接和分配职责，避免形成多份规则。
