# r12 生产 fresh 初始化恢复

已将全局职责初始化移出生产默认；该算法仍可由 `reinitializeNativeSpatialLayout` 使用冻结 L/B/形体输入直接诊断。生产 `createNativeSpatialLayout` 的 fresh 路径为有界 r12 partial 初始化，失败不会切换全局算法，也不回退 r11。

完整物件先按现有 authored 规则生成，含母体、attached relief、所有 H/S；之后依既有顺序选择站位。每对象原候选域最多 12 份合法精评。只有原域没有合法站点时，才能遍历原 16px field 的 snap8 唯一点，仍以 12 份精评封顶、周期检查原 deadline；不能追加随机域。

最后一个初始 H 使用这份已经评完的列表，按同一分数排序，对完整 L/B/H 运行共享真实 VOID 身份资格，首个通过即停。每次检查预扣原 attempt 的 geometry-work，总上限仍为 72；失败或异常不退款。资格全失败不补第 13 槽、不进入 field 或其他求解器。后续 S 不改变 H 地形；最终完整 geometry gate 仍独立决定。

保留了当前 G1 fine8 场、actual-H 移位预测、incumbent 首评与精确上界剪枝，G3、deep、joint/refinement、形体域、L/B 与规则阈值均未改。fine 评分及去重会影响选择，所以本次不是旧源码或旧地图 hash 等价恢复。

恢复依据为保存的 `initial-c3-qualified-round1` 收据和现有资格选择函数。`/tmp/native-layout-resume-vite.js` 的旧 partial 循环早于 B/真实身份，未整文件覆盖；`/tmp/layout.bak` 是无关城镇文件，未使用。

本轮仅静态/逻辑验证，没有调用 sampler、编译新地图或执行 fresh：

- `initial-default-restoration-logic-round2.json`：7 组，通过原域/field隔离、去重与 12 上限、资格首过停止/全拒不补位、deadline、共享72，以及 TypeScript AST 的生产/诊断路径隔离。
- `initial-default-restoration-typecheck-round1.log`：类型检查通过。
- `initial-default-g1-field-regression.json`：既有 4 组通过。
- `initial-default-actual-footprints-regression.json`：既有 4 组通过。
- `initial-default-geometry-work-regression.json`：既有 5 组通过。

新逻辑第一轮在 AST 测试中误写 `siteFor` 参数数为 15（实际 14），导致测试断言失败；纠正夹具的参数数与索引后第二轮通过，生产代码未因该错误修改。没有丢弃或修改旧地图失败证据。

源码已冻结，端到端生产生成与全量 build 由根线程另行执行。尚未关闭全库空间质量或完整地图准入。
