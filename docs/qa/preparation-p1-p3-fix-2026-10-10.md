---
status: PASS-LIMITED / P2-OPEN
date: 2026-10-10
base-revision: 7890dd69
features: [COH-F003, COH-F038, COH-F043]
issue: R100-P49
---

# 备行合入审查：P1 / P3 修复验收

用户明确授权“修 P1/P3”。本批修复 [合入审查](../reviews/2026-10-10-preparation-integration.md) 的 PI-01 与 PI-03，限定回归通过。PI-02/P2 的兼容三档静态遮罩仍待办；P49/I14 保持开放，未新增玩家验收、音效或设备结论。

## 实现与约束

- **PI-01**：`preparation-veil.ts` 在创建 context 后取得 `WEBGL_lose_context`；正常关闭先停 RAF、撤销监听，再删除 GPU 对象并显式释放 context。着色器编译和必需 uniform 初始化失败也使用同一释放路径。每次重开使用新的画布，主动释放不会走旧控制器的错误/恢复处理。共享样例沿同一实现，保留自己的 `preserveDrawingBuffer`。
- **PI-03**：保留最后已经呈现的事实作为比较依据。换装中间失效立即结束旧句，但返回时若已还原且没有仍合资格的新事件，则留白且不消耗额外机会。真正不同的状态仍可兜底，真实新成长/增强仍可发言；持续失效只在有效性变化时重置候选，不会逐帧取消 250ms 停稳。
- 没有变更文案内容、强度参数、Shader、样式、人物保护、装备/出发机制或业务存档。P3 是现有合同修复，规格只澄清返回时核验方式。架构登记补充 context 的所有权和释放顺序，Kit 无需修改。

## 实际验证

### P1 独立浏览器回归

QA 在隔离 Chrome、960×640 游戏逻辑舞台和 DEV 内存存档运行正式 `PurificationScene`/`inventoryPanel`；不访问用户存档。使用独立 Vite 服务禁用 HMR，源码停止变化后取最终结果。

[最终运行数据](artifacts/preparation-p1-p3-fix-2026-10-10/p1/final/vfx-report.json)：30 次正常开关 + 30 次密集开关，测试刻意保留旧 context 引用，排除“刚好 GC”造成的假通过。60 个退休 context 全部主动失去上下文，已关闭控制器的 RAF 停止、帧数不再增长，未触发关闭后的 `veilerror`。主世界 `lostEvents=0`、`rendererLost=false`，退出后实际 draw 计数继续增加，没有 context 额度或 `Renderer disabled` 警告。

[60 次后实际世界](artifacts/preparation-p1-p3-fix-2026-10-10/p1/final/world-after-60-cycles.png)显示场景与角色正常。共享样例 wrapper 的三档新画布重建、重复 dispose、保留捕获像素通过；故障注入的编译失败/必需 uniform 缺失也释放 context。原有三档动态、连续降档、行装降速、暂停/恢复、关开不重播、减少动态和 context loss 后仍可操作断言通过。

首跑在热更新服务上因模块遥测 undefined 中断于第一档，未到 P1 循环；失败记录保留 `p1/vfx-report.json`，不计为游戏缺陷或通过。最终独立服务运行无 pageerror，有两条既有资源 404；不将其包装为所有资源零错误。

### P3 领域回归

新增回归先在旧实现被击穿，再在修复后通过。真实 `InventoryStore`/adapter/journey 连续 3 次 A→B→A 都不抽句；之后成长仍可使用唯一额外机会，第二次成长受限。A→B 持续失效可在完整 250ms 后兜底；临时增强又换回不消费机会，最终真实装好尚未消费的增强仍可发言。相关返回与计时按 16ms 分帧，防止大步进测试掩盖候选不断重置。

[原审查反例重放](artifacts/preparation-p1-p3-fix-2026-10-10/restored-equipment-budget.json)现为 `originalStateRestored=true`、`returned=""`、`secondWornUtterance=false`。这是领域实跑，不冒充自然成长或浏览器换装录像。正文生成与原叙事资格、暂停、每档/每程预算、真实成长支付成功/拒写检查一并通过，见[专项日志](artifacts/preparation-p1-p3-fix-2026-10-10/narration-check.txt)。

## 收尾与边界

TypeScript、`npm run build`、`check:preparation`、`check:atmosphere` 与 diff 空白检查通过。项目没有 lint 脚本；构建的既有大 chunk 警告保留，不是本批性能优化。开发入口实际运行和上述浏览器回归构成运行时冒烟。

[Art 最短合规核](artifacts/preparation-p1-p3-fix-2026-10-10/art-check.md)确认本批没有改变现有载体、字级和视觉语言；这是源码核，不代新美术验收。PI-01/PI-03 按本机及上述合同范围修复验证；PI-02 的初始兼容表现、世界事务 durable 观察边界与最终连续观感不属于本次修复范围。较弱设备豁免保持。

源指纹与验证登记见 [verification.json](artifacts/preparation-p1-p3-fix-2026-10-10/verification.json)。现状关联 COH-E208；旧审查与失败证据保持，后续状态通过任务和索引链接到本验收。
