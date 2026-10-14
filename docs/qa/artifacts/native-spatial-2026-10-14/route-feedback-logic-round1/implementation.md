# G4 失败反馈接入同一未准入计划

关联 COH-F011/F013。`native-spatial-generation.ts` 现在实际接收 `yield` 返回的完整候选路线反馈；G1/G2/G3 通过不再把该路线阶段的基线清掉。`native-spatial-route-feedback.ts` 从第一次失败的正式部署冻结实际出生点、出口、8 个节点身份/档位/位置及原合格路线、非空探索区域。后续每份真实几何须先通过原 G1/G2/G3，才使用同一个正式 G4 评价器重算固定目标与全部当前探索路线。不建 Master、不部署 Host/敌人/物资，不消费额外 full。

比较按逐路线比例整数差、六窗短缺、窄段占比和连续窄段超量；原合格路线降资格、节点无合法 48px 操作站位、出生／出口失去身体支持或原探索区域消失，都不可作为改善。节点中心没有被误当玩家身体站位。只有探针全过才交回正常完整链，第二次正式部署及最终全部 G4 仍必须通过；最多 2 full，extraction 失败同样消费。

首份失败 full 开始的整个 probe epoch 共享 48 个真实 tuple 合法性机会，包含非法原案及释放搭档；同 base 保存游标和已评身份，改进后的新 base 仍使用剩余额度。geometry 仍共用 72 work，全部路径计算共用 60 秒截止。耗尽后 fresh 计划不带旧 probe，full 计数不重置。layout 返回后的异常和截止均保留已消费 tuple；即使 geometryWork 的最终 checkpoint 换成另一个无上下文截止异常，也先记账再抛出。成功身份只存确定性选择/诊断，不存 runtime probe、闭包或 CPU 计时。

有限验证已通过：

- 本目录 `report.json`：实际 c27 原始快照复用，0 几何编译，官方 G4 精确保持短比例修正后的 5 项拒因、20 条路线、8 个节点、12 条基线合格路线。3 条类型失败的全部事件都映射到真实 hole-X 或完整 assembly；两条窄路线分别有 34/36 个归属唯一的闭合截面，最小约 40.406/40px，两侧为外海及 hole-3。另测资格/区域/站位丢失、节点中心与操作席区分、route 分数优于内部均值、重复几何不刷新。
- `../route-feedback-controller-round2/report.json`：实际 generator 控制流配显式几何阶段 stub，3 组通过。消费 yield 反馈、未过 probe 不 yield 第二 full、后继 base 余量 48→18→0、新 fresh 清 probe 而 full 不变、后置错误与二次 deadline 保留账本均有断言。stub 不冒充真实完整地图。
- `complete-guards.json`：既有 6 组 full 准入、身份、失败配额、第三 full 拒绝、截止及单一生产阶段接线通过。
- `replay-trace.json`：既有 4 组性能计时投影／真实结构仍改身份通过。仅 synthetic trace/map envelope，不是完整生成地图重放。
- `../route-feedback-controller-round2/tsc.log`：最终全源类型检查 exit 0。`dev-smoke.json`：Vite ready 107ms，根页与 generation/feedback 源码转换 HTTP 200，测试服已停止。scoped diff-check 通过；项目无统一 lint/test 顶层脚本，未声称其通过。

Main 的完整整物件候选、共同承托/间隔、惰性 48 域及异常 trace 由 `native-spatial-route-layout.ts`／layout 实现，专项见 `../route-layout-logic-round2.json`。本轮没有生成新地图或清除 c27 五项拒因；接线通过不等于候选一定可行，正式完整请求由 Root 在最终 source freeze 后统一执行。资源初次部署早筛本轮不改，Root 已明确保留为可选后续手段。未 commit 或 push。
