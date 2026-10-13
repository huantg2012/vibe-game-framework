# 验证与交付真实性分审

日期：2026-10-13。代码：`d8cd69b7fe6270a8b83381c0e4c9abc2650ac4b6`；开工仅有他人 `CLAUDE.md` 修改，未纳入结论。范围：COH-F007/F011/F012/F013/F014/F019/F044/F052 的推广证据与正式注册。依据：`docs/specs/system-map-generation.md` 及 `docs/qa/world-upgrades-rollout-2026-10-12.md`。遵循只读审查；只写本目录和临时诊断文件。

## 结论

本分审未发现现有 324 项被伪造、丢失或由未完成报告冒充的事实。确认一个 P2 验证工具缺陷：聚合器接受尚未终结的 receipt。真实交付中没有活动 `running` receipt；这项缺陷本身不推翻当前 324 项结果。

## EVID-01 / P2：未完成批次可被标成完整验证

- 位置：`tools/world-upgrades-rollout/build-gallery.mjs:13` 读取 status 但不验证；`:38` 与 `:40` 直接把 cases 计入 verified / complete；`:25`–`:27` 的替代 receipt 同样未要求终态。
- 触发：`tools/world-upgrades-rollout/check-batch.mjs:191` 每例写入 `status: running`，`:192` 才执行跨档 shape/support 一致性检查。如果在最后一例写完后、终检前中断，三档都已在 cases 中而终检未执行。
- 后果：聚合器可给这份未结束批次 3/3、`complete:true`、`issues:[]`；未完成 receipt 也能作为哈希绑定的替代依据。
- 反例：以真实 Monolith 资产作为只读附件，临时构造三档 running receipt，并让中档 `shapeHash` 与另外两档不同。聚合器仍返回完整。此为合成中断反例，不是生产世界失败。
- 建议：验证明确终态；若允许已失败批次中的成功项继续有效，须把每例检查完成与批次终检完成分开登记，不能只看 cases 数量。增加“最后一例后中断”反例。

仓库根目录可复现：

```sh
node --import tsx docs/qa/artifacts/world-upgrades-review-2026-10-13/evidence/reproduce-gallery-unfinished.mjs
```

脚本仅创建并清理 OS 临时目录；现象记录见 `gallery-unfinished-counterexample.json`。修复后脚本的“漏洞仍存在”断言应失败。

## 已核实事实

- 重新读取所有历史 receipts 聚合：324/324、重复 0、资产/证据问题 0、未决失败 0，保留历史失败 5。活动来源 receipt 为 passed，或含已被同例复验失败的历史 failed 批次；没有 running。
- `current-final-corrected/summary.json` 的 802 个 src/data 指纹全与当前源一致；26 批均退出 0。没有重新生成整个 324。
- 108 native / fragment / search 注册相等，108 世界均 enabled；正常世界选择 108 项权重均正。正式净化点出发调用 `prepareProceduralDeparture`，其选择路径消费当前 r10 配方；开发显式选图与正式抽选仍区分。
- 重新执行 Monolith 三档 current-evidence，均通过；18 PNG 与 5 个材质定义的固定 Git 来源证明重新通过。
- 从原固定基线取 Cinder r9 与 Monolith r8 两个中档 fixture 复验：完整地图、冻结配方、两态 patch、初始/翻后四 RGBA 精确一致。最初只缩小 cases、未同步缩小全八图材质清单的诊断因未执行材质而失败；修正临时夹具成员清单后通过，原失败保留，不作为游戏缺陷。
- `replay-after-shell.json` 的 806 文件与当前源无漂移；最终预算快照 802 文件与当前源无漂移。性能原始三例数据对应报告中的 P95 / 时间 / 50ms 尾部，范围仅为有限参考机三图。
- 生命周期严格检查确实保留 failed；owner 原始记录可定位临时纹理 14→13。动态场景纹理重建会换 key/ID，报告只声明数量相等，并未承诺句柄恒等。原始 3067 快照与当前仅两份 Shell 作者数据不同，3027 诊断另列；没有发现与其有限“未见保留泄漏”结论矛盾的证据。

## 必须保留的限制

- 完整 recipe 逐字段比较实际覆盖 276/324；48 个早期案例没有 `recipe.json`，走固定来源与当前几何/出生/撤离/来源/有效 seed 对照分支。未查出本次实际语义漂移，但不能称为 324 次完整 recipe 逐字段对照。
- 本分审没有重开浏览器、没有重跑 108 世界性能，也不验证自然盲搜、用户审美、长期经营或全 seed。根线程统一构建已通过，子任务没有重复构建。
- 详细数值及路径见 `audit-summary.json`。本报告是证据与工具分审，生产几何/玩法缺陷由并行分审另列。
