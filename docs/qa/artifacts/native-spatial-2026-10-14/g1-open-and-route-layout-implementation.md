# G1 空圆规划与 G4 整物件候选接线

本记录只覆盖规划端与有限逻辑，尚无新的实际地图／完整生产准入证据。源码改变后历史失败保持原样；不把逻辑通过写成地图通过。

## G1 max-only

`native-spatial-g1-field.ts`独立缓存固定外海／B的实际VOID边界与frame距离，并在外海内返回0。内部H从同源8px cells建立局部边界和填充占用；占用随对象site平移，搬走后旧位置不再被旧总VOID mask误置0。S继续使用真实局部三角足迹。fresh无actualVoid时使用现有raw L−B signed margin，负值只将max置0。

`layout`的single精评和complete/joint共同评分均使用该空圆半径；16px规划域、deep连片、内部距离均值、宽域分母、形体及全部门槛不变。单对象降序上界剪枝仍与全扫最大值精确相同。actual H移位仍是预测；最终断缘／身体支持域必须重编译复验。

- 新7项域与正式complete-score纯反例：`g1-open-planning-round1.json`。
- 旧fine4项：`g1-open-field-regression.json`。
- 旧actual-footprints4项：`g1-open-footprints-regression.json`。
- 旧incumbent/pruning7项：`g1-open-pruning-regression.json`。
- 新夹具最初误要求两个不同坐标的海岸距离相等，失败为44与23.3238；已纠正该无效断言，生产代码未因该失败更改。最终源稳定、全部通过。

## G4 规划动作

新增`native-spatial-route-layout.ts`，只消费正式失败路线的事件、精确失败六窗、最长窄段中归属唯一的闭合横截面。提出超额类型至多3个对象与缺失类型至多3个搭档的完整站位交换；窄段则提出整对象单侧让位／双侧各半；仅一个固定对象阻挡时可提出同向释放。完整母体、附属relief、种类、profile、数量保持。

合法性复用joint的完整支撑、真实三角相交和间隔函数；原双物件入口仍要求2项，新通用拒因入口允许1或2项。`layout`路线上下文只接受之前真实几何已过且具有actualVoid的base，完整候选的G1预测仅留before/after诊断，不用均值恶化否决真实G4改善。生成控制器负责每份实际几何／G2／探针和最终完整部署复验。

Root收紧48口径后，候选先纯排序、去重，最多48个raw项；从本base raw游标惰性检查，首合法即停。非法项、单blocker释放项均消耗同probe epoch的48额度；`consumedTuples`包含释放，`nextOrdinal`是raw索引，二者不等。`seenTupleKeys`防止同base重复评价，后继base仍继承epoch剩余额度（由Complete的controller负责）。helper和layout后续评分／fragment异常均附完整已消费trace；不靠异常返还额度。

- 最终9项有限逻辑：`route-layout-logic-round2.json`。含已消费异常、零额度不执行、拒绝＋释放共计2、跨调用prefix与游标、48共享域。
- `route-layout-logic-round1.json`保存较早全预检版本，仅作历史，不是最终预算实现证据。
- 原8项joint责任逻辑回归：`route-joint-regression.json`。

以上均未采样或编译新地图。联合类型检查、开发冒烟由Complete统一运行；root另负责完整build与唯一正式请求。所有候选源、站位、支撑／冲突拒因及已消费次数进入trace，最终结果仍待实际全链。

## 联合收尾验证

Complete已统一完成最终`tsc --noEmit`（`route-feedback-controller-round2/tsc.log`）及Vite开发冒烟（`route-feedback-logic-round1/dev-smoke.json`，启动107ms、根页和generation／helper模块HTTP200，临时服务已停）。controller最终3组纯mock、既存实际快照6组及原full guard／replay逻辑分别通过；这些不是新地图准入。项目未配置独立lint或test顶层脚本，本次使用上述已有专项工具和新有限反例，不声称运行不存在的闸门。规划端源码已冻结，最后统一源冻结与正式fresh由Root控制。
