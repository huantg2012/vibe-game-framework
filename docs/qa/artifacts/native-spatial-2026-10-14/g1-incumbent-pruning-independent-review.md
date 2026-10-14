# 原位保留与 G1 等价剪枝独立静审

COH-F011；2026-10-14。审查者：`native_complete_candidate`。只读静审 Main 冻结源码及既有纯逻辑收据，未重跑 geometry、候选、G2 或 full。actual-H 边界来源已由 root 独立审查，本报告不重复提升该项证据。

## 结论

本次两个运行期改动未发现阻断项，可进入预授权的唯一固定 c27 比较。此结论只确认原位不被粗排裁掉、精确最大距离查询剪枝两项，不表示预测轮廓等于移位后重新生成的轮廓，更不表示真实准入或完整地图成功。

- `selectNativeSpatialSite` 首先用同一完整 `evaluate` 精评原位，消耗既有 12 个合法完整精评中的第 1 个；坐标去重，后续最多 11 个。只有 `compareNativeSpatialConstraintScores < 0` 才替换，同分保留原位。非法原位明确抛出；fresh 不注入 `(0,0)` 假兜底。正式 single refinement 的每个物件调用明确传入当前 site，之后才 commit G3 的事务域。
- `maximumWithRemaining` 计算 `max_i min(remaining_i, moved_i)`。未移动对象的距离按降序排列；若下一个 `remaining_i <= 当前最大值`，全部未访问项的上界都不可能超过当前值，退出精确成立。零值、Infinity 及等距的稳定索引次序不改数学结果。该界不依赖准入阈值或“看起来足够好”的近似。
- 完整最大距离仍使用独立 G1 field；16px deep、wide、均值的场与定义未变。精评仍通过 G3 的 `evaluate` 测量并回滚，选择后才 `commit`。降序构建和精确查询均保留批次 checkpoint；没有新增候选池、隐藏 geometry 或扩配额。
- `completePlanningScore` 与单对象精评继续按 maximum → sum → mean 排序。上述保证是同一预测目标的非递增，最终重建的 G1/G3 必须仍独立测量，不能把预测改善当真实通过。

## 证据及范围

阅读 `g1-incumbent-pruning-logic-round2.json`：7 组纯反例通过、`sourcesStable:true`；当前两份运行期源码 SHA-256 与该收据一致。该收据包括原位粗排末位、重复/同分、不合法原位、Infinity/零/空数组、deadline，以及原 L−B 支持场 24,245 个点上 8 对真实保存 H/S 足迹的全扫/剪枝相等。未由本审查者复跑这些测试。

1. `src/generation/world-study/native-spatial-layout.ts`：原位选择、单对象精评及正式调用。
2. `src/generation/world-study/native-spatial-g1-field.ts`：距离排序和最大值查询。
3. `src/generation/world-study/native-spatial-wide-domain.ts`：只读核对共同 score 与事务消费关系。

## 运行前工具整改

对准备中的 `check-g1-incumbent-c27.mjs` 发现 P2：只在全部断言通过后写 report，若唯一尝试发生异常或非递增断言失败会留下空目录。已通知 Main 在实际运行前补外层失败持久化，保存阶段、已有 before/after、错误与 source hashes；不能靠重跑补报告。这不要求更改上述运行期算法。

静态复核已关闭该 P2：Main 在第一次实际运行前添加了阶段化 `evidence`、外层 catch 的 `failure.json` / 可得时的 `failed-proposal.json`，包含已有 before/after 和前后 source hashes；单次 instrument 的 prototype 恢复仍由内层 finally 执行。未增加重试。
