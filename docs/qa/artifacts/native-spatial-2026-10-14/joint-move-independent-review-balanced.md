# QA 续验：主移动对象各一有向槽

2026-10-14 · COH-F011 / F013 / F007。

基准为 `joint-move-design-review.md` 最新末节「最小纠正」，由 Director 批准后替代原全局无序对象对截取规则。旧 QA 报告和收据保留当时合同的适用范围，不追改历史。

**本次 5/5 项必要检查通过，源码前后稳定；固定 c39 仍没有改善。** 精确版本与 836 份源 SHA 见 `joint-move-independent-review-balanced.json`。只更新 QA 自有工具和报告，未改 src/data。已过且未变的六组原子事务/合法性/claim 检查没有重复执行，JSON 的 skipped 列表明确记录。

## 选择合同检查

- 读取原 `pair-source-classification.json` 的 10 个已存在 cause，纯选择输出为 `hole-0 → upper-clamp`、`hole-1 → subordinate-13`、`hole-4 → hole-0`。三个有 cause 的主 A 各得到一个槽，原 hole-1 来源恢复。
- 逆转来源输入顺序结果不变；仅有同一 A 的多个搭档时只取一个，不回填其他槽。不存在的反向 cause 不会被创造；合成的两个真实有向来源可分别占自己的主对象槽。
- 更新枚举断言为每个主 A 最多一个有向槽、每槽最多 16、总数不超过 `min(48,12×N)`。不再错误地要求反向有因操作属于同一无序身份。
- 三对象合成检查正反遍历相同：3 槽、36 组合、24 合法；mean-only 改善仍不被选择。
- 两对象合成反例中，两个有向来源生成相同 16 个完整两物件新坐标，最终只记录 16 个唯一共同状态，未以方向重复计数。这是最终状态去重，与有向来源保留分别验证。
- 静态核对 joint 仍替换单扫，实际编译计数、72 次候选和 2 份完整部署预算保持，fresh 的宽连通代理仍为未知。

## 新的固定 c39 收据

Layout 只执行一次新算子，结果保存在 `joint-c39-balanced-round1/`。QA 没有重复该算子，也没有换 seed、重放链或运行 fresh。六份收据生产源 SHA 与当前实现全部精确一致。

三个有向槽的组合数分别为 16 / 16 / 8，总计 40；14 个共同合法状态经过精评，0 个改善状态被选择。返回的全部对象、land、B 和数量与原 c39 相同，规划 before/after 一致。

QA 将返回的保留几何独立重编一次：hash 仍为 `dec8af0ac04c9412`；最大空白 202.99919638619653px、deep 480px、wide .5817820539636059、largest wide .9997303613158368。真实门仍拒绝 `G1-largest-empty-radius` 和 `G1-long-deep-empty-region`。1,207 个普通 S 足迹内地面格均不遮视，未改变 S/VOID 分工。

**可确认来源分配修正已落实，不能确认这一有界双移位解决了 c39。** 无改善结论只覆盖当前固定方向生成器和这批均衡分配的候选，不外推所有双移位、形状交换或数量可行性。

未覆盖新正式地图、G2/G4/内容部署、holdout、正常视角、AI、旧局恢复或审美。未改准入门或扩大搜索。构建由 Director 统一收口；本执行进程已结束。

```sh
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/native-spatial/check-joint-move-independent.mjs NEW_REPORT.json docs/qa/artifacts/native-spatial-2026-10-14/joint-c39-balanced-round1 --selection-only
```
