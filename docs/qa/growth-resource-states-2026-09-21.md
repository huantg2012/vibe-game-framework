# 蜕变 · 薪柴支付状态色修复

2026-09-21，基线 `0375b5a` 工作树；COH-F029 / COH-F038。用户要求充足与不足明确区分颜色，并指出上轮自检遗漏。

## 原因与修复

R4区分了收益/成本/说明的类别层级，但“充足”仍用辅助灰，“不足”与经历未达共用暖灰，底栏没跟随状态。此前行为和排版检查不能证明相反状态一眼可辨；该项属于执行与验收漏项。

本轮列表、详情和底栏采用明确状态语义：充足/可刻入 `#b3baae` 灰绿，不足 `#b89040` 既有警示琥珀，经历未达 `#7e8a7e` 中性灰；文字始终保留。储备和价格本身保持薪柴类别色。资金与资格独立计算：资金足、经历未达时，详情显示“薪柴充足”，动作仍为“尚待经历”；两者都缺时也分别显示。已购无支付状态。

载体仍是培养藏实体旁的无框读数，沿 Darkwood/Signalis 既有阅读关系，不变镜头、字号、总布局、成本或门槛。Art按 skill 作最短合规核对；原图对比确认充足与不足足够区分，加厚后果保留首屏。最终用户审美未代签。

## 验证

- `npm run typecheck` 与 `npm run build` 通过；[构建日志](artifacts/growth-resource-states-2026-09-21/build.txt)保留既有大chunk警告。
- `node tools/qa/check-growth-resource-states.mjs`：隔离Chrome，真实走路/E/Enter；[6组结果](artifacts/growth-resource-states-2026-09-21/manifest.json)全部通过，无页面异常。覆盖少1薪柴、恰好够、充足、缺经历但钱够、两个都缺、加厚。不可执行时存档不变；恰好够时买完变不足，三处颜色/文案同时切换；加厚全部模块预览仍在首屏。
- 除比较computedStyle不同，还核对不足为警示琥珀、充足为灰绿，两状态RGB距离>80，防止只换成两种近似中性灰。状态始终有文字第二编码，这个度量不替代实景检查或色觉可达性全审。
- Root和Art查看[不足](artifacts/growth-resource-states-2026-09-21/short/01-state.png)、[充足](artifacts/growth-resource-states-2026-09-21/enough/01-state.png)、[缺经历但钱够](artifacts/growth-resource-states-2026-09-21/experience-funded/01-state.png)、[加厚](artifacts/growth-resource-states-2026-09-21/thicken/01-state.png)。资金/资格独立信息及首屏可读。

本轮只运行与改动相关的状态和购买切换，未重复全22步路线、自然经济、场景美术或全游戏可达性审查。测试使用独立存档，不读取或修改玩家当前上下文。来源指纹见[source-hashes.json](artifacts/growth-resource-states-2026-09-21/source-hashes.json)。

## 收尾

UI Kit已固化充足/不足/资格的状态语义，并加入相反状态对照；不改框架。游戏现状文本追加有界证据、刷新INDEX，HTML保留按需快照。独立CLAUDE变更不提交、不重设其基线；历史未知与挂起保留。按用户持续授权本地提交，不推送。

## 用户验收

2026-09-21 用户在 `7c2fb8b` 交付后回复“这部分定位 pass”。本次记为蜕变薪柴状态提示 USER-PASS：充足/不足色彩区分，列表、详情和底栏的一致表达，以及资金与经历资格的区分。此认可不扩展为整个成长系统、净化点美术或长期平衡验收。
