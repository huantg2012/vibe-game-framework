# G1 实际孔边预测接线 · 根代理静态复核

范围：本报告由未编写本次源码的根代理只读复核。原独立 QA 子代理两次因模型容量失败，新的无历史 QA 也遇同样错误；不将这些失败报告为已审。本文未运行测试或新几何。后续原位保留/精确剪枝仍在施工，不在本结论内。

- `nativeVoidCellBoundary` 与原 measure 的格边顺序相同：逐 label 的 cell，按左、右、上、下，仅无同 label 邻居才生成边。使用同一 label 的 Set 替代旧 labels 查询；已合并的薄条分量仍按完整 cells 处理。最终门和 G1 缓存共同调用它。
- `nativeSpatialG1HoleFootprints` 核对作者 H 与反馈 H 的双射，拒绝重复/空孔、越界/非整数格、重复占格、与 exterior 重叠和非8px站位。转换为对象局部边界后，原位还原不更换格相位。ID 本身只标注来源，不参与距离。
- `PlanningObject.g1Blocking` 与 raw blocking 分开。完整 tuple 和单物件的 fineRemaining/fineBodyTree 均读取 g1Blocking；fresh 初始化明确 raw-authoring，反馈路径标 previous-actual-void-translation。支持/碰撞、rough、deep、均值继续读取原 blocking；G3继续自身实际VOID缓存。未新增候选或几何预算。
- 缓存只属于上一份真实几何，移动后为预测。fragment v1 的断缘依赖全部矩形和轮廓随机流，不能声称未移动孔必然不变；每份完成提案仍独立重新编译并通过实际门。四组有限收据中原位768点相等、预测140而最终161.656854被拒绝，支持这一限定，而非普遍平移等价。

固定 c27 唯一实测 `g1-actual-c27-round1/report.json` 明确仍失败：max162.117712>160，deep336、wide55.074875%、largest99.035182%过。原位18,632个真实身体点的孔边距离误差全0；新最坏点预测孔距与最终孔距均156.460858。本例剩余问题不能再归为G1漏采或此点孔形误差。

静态发现：siteFor 将已知原位混入 rough 后只精评前12个合法候选，原位没有必保资格。因此当前 after 规划最大违规0.029347748可比 before0.017135720更差。根已交 Code 修正“原位先精评且占12名额、其余去重”，这是尚未完成的新修复，不能将 actual-H 接线通过扩为生成器或地图通过。
