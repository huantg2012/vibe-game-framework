# QA Report: 有界原子双物件操作

日期：2026-10-14。Feature：COH-F011 / COH-F013 / COH-F007。

验收基准：唯一 `docs/specs/system-map-generation.md` 的原生联合生成规则、批准设计 §6 的完整组移位与准入预算，以及本目录 `joint-move-design-review.md` 的本轮有界操作合同。执行记录为 `joint-move-independent-review.json`；836 个 src/data/本工具源文件执行前后 SHA-256 一致，明确对应未提交工作树。

**实现的有限逻辑检查 9/9 组通过；固定 c39 的空间问题仍未改善。** 两个结论分别成立，不能把工具检查通过写成地图通过。

## 本轮发现与修复

静态检查发现对象对用有序 `A.id:B.id` 去重，同一无序对象对可能因反向角色占两个配额、获得超过每对 16 个组合。Layout Code 已按排序后的两个稳定 ID 去重，保留排序最优的有因方向。本次有限合成用例覆盖正反对象遍历、每无序对最多 16 个组合、总数上界；通过。本 QA 未修改生产代码。

Layout 的唯一 c39 操作在这一 key 修复前运行。QA 对其六份源 SHA 逐项核对：五份完全相同，joint 模块将当前 key 逆换成旧 key 后 SHA 精确等于原 receipt。保存的三对本就互异，因此本报告保留原 receipt 的版本范围并明确这一单处差异，未覆盖或重写历史，也未再执行 c39 算子。

## 通过的范围

- 原子预验证：evaluateMany/commitMany 共 14 个非法批次（空、非法第二项、非有限值、非 8px 相位、非法索引、重复索引、超过两项）均在修改前拒绝，原 mask 与 sites 行为不变。
- 两对象状态：同时移除旧位、加入新位；evaluate 前后状态一致，commit 与独立全场 mask 重建相同。重叠 mask 引用计数、第三个未动物体、exterior/B、回原位和输入顺序均验证。
- 异常：注入 measure 抛错，evaluateMany 的 finally 精确恢复两个对象原有占位。
- 完整共同合法性：A 的新位只与 B 的旧位冲突时，B 同时腾挪可以通过；新位互侵、岸支撑不足和相交长条三角形均拒绝。查询不修改原对象。
- 附属 relief：S 与其 relief 使用共同新位置；虽然 H 与 S 阻挡脚印间隔已足够，H 进入新 relief 足迹仍被拒绝，合法离开 relief 的对照通过。
- 比较与枚举：mean 改善而 `(maximum,sum)` 不变不能选择；前两项严格改善优先。有限三对象合成例正反输入遍历得出相同按 ID 归一结果，2 对/24 组合/17 合法，所有 pair ≤16，总数 ≤`min(48,12×N)`。
- 一次机会：新 base 未发生单扫约束停滞时不领取 joint；领取即消费，未返回结果或抛错不需另写成功回执才生效。同 canonical 换 candidate ID、stage clear 均不复活；独立 archive/geometry attempt 不共享 claims。无 actualVoid、非 G1/G3、耗尽和仍有单扫约束改善均不能领取。
- 静态接线：joint 分支替换单扫，不在单扫后叠加；真实编译仍增加原 geometryEvaluations，候选上限 72、完整部署上限 2 不变；fresh 的宽连通代理仍为 null。此项是静态/输入检查，不是一次新正式生成结果。

## 固定 c39 的实际结果

消费 Layout 唯一一次 `joint-c39-round1/report.json`：3 对、40 个共同站位组合、18 个共同合法并精评、0 个改善候选。规划 before/after 完全一致，没有凭 mean 或旧热点改善选择；对象、land、B、数量保持原状。

QA 仅将保存的返回 proposal 独立重编一次，未重复算子、未换 seed、未重放链。实际几何 hash 仍为 `dec8af0ac04c9412`，与 c39 一致：

- 最大空白上界：202.99919638619653px。
- 最大 deep 区跨度：480px。
- 宽域比率：0.5817820539636059。
- 最大宽域连通比率：0.9997303613158368。
- 实际拒因：`G1-largest-empty-radius`、`G1-long-deep-empty-region`。

实际普通 S 足迹内采得 1,207 个地面格，视线 opaque 数为 0，普通 S 未被误改成 VOID 遮视。此项是固定图几何查询，不代替敌人实际感知测试。

**结论：这一次有界双移位没有改善已定位的 c39 局部牵制。** 没有证据支持“双移位已解决”或“现有数量数学上无解”。按设计停止扩大同一操作域，交 Director 决定下一步，不因工具检查变绿扩搜索或降低准入门。

## 未覆盖与复现

未运行新的正式地图请求、其他种子、holdout、完整 G2/G4/内容部署、旧局恢复、正常镜头、动态 AI 或玩家审美。没有实际通过的双移位 c39 候选可供真实 before/after 改善比较；本次验证的是正确保留无改善和最终拒绝。没有重放旧的单孔恶化样本，相关历史反例保留其原报告范围。

本工具不运行构建；全构建由 Director 收口统一执行，仓库无 `npm test` 脚本。执行已结束，不与后续正式生成争用 CPU。

```sh
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/native-spatial/check-joint-move-independent.mjs NEW_REPORT.json
```

工具要求新报告路径，不覆盖旧证据。
