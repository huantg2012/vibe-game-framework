# 备行两步流程 QA

2026-10-09；[机器摘要与源码/脚本SHA](qa-summary.json)。当前标准为[统一库存第5节](../../../specs/system-field-inventory.md#5-入口备行与装备hud)及[Kit](../../../design-notes/ui-art-overhaul.md)。用户已否决上一轮混合总览，本轮独立验证，不继承其体验认可。

**行为专测最终8/8通过，共享view回归通过，用户审美终验仍待定。** [最终报告](run-02/report.json)的生产源码运行前后相同，两轮之间也没有生产修改；当前文件与最终记录一致。Chrome155.0.8059.39，Apple M4 Pro ANGLE Metal，960×640/DPR1。

- 第一环节仅污染、事实和前进；无挂位/库存/详情/出发。ShiftEnter消耗输入但不前进。无武器仍可进入配置，真实缺口只在第二步阻断出发。
- 第二步普通Enter/Space及重复输入不出发。低/中/重各一次完成选级→配置→真实Rift，正式身份等级正确，cycle只加1。Esc逐层返回、显式离开、相机与实际玩家输入恢复通过。
- 4/5槽和相邻文本无重叠，底部动作可达。未知物保留公开投影。真实换装、返回改级、再次前进不回滚装备，列表1044px驻留；长说明82px与列表660px分别保留。
- 真实净化点关闭备行→Tab→存续报告“物件”，与配置页运行同一套单列行为：66件、48px行高、点击/焦点选中、hover不选、↑↓±1、左右不换项、Page±6/HomeEnd、wheel850px不拉回旧焦点。不是只测CSS列数。备行实际范围18–22/66；目录保留原完整末行口径18–21/66，均无双列倍数。
- [共享view日志](checks-01/inventory-view.log)退出0：60物件、装配失败回滚、重复Enter/ShiftEnter、无等级兼容入口、目录长按丢弃/供奉和裂隙交换/退出/移动转发通过。
- 8个独立DEV上下文原生localStorage调用均为0，五哨兵原样；Boot前页面内存隔离和SaveManager真实内存事务。未使用用户浏览器或存档。

[首轮报告](run-01/report.json)7/8，唯一失败是long末段零持续世界Tab未打开报告，备行检查已通过。未记录引擎内部瞬态，不能称引擎bug；仅将该按键保持70ms后进行约定唯一复验，[工具差异](qa-test-correction.diff)留存。两轮共16声明case、6次真实诊断出发，全部不计R100自然经营分母。没有第三轮。

[六对最终实帧](frames-02/capture.json)在稳定550ms后锁同一世界帧，暂时仅隐藏panel取得真实世界＋backdrop背景，随即恢复。[Art报告](art-review.md)与[对比测量](contrast-analysis-02.json)确认：29项文本最低5.837:1，6短划最低5.999:1；2实际disabled动作单列。唯一视觉补修为prepare局部字重与选中前景，发生在两轮行为测试之前。U1–U12有限核对见Art报告，U7运行证据见本报告；实际400ms反馈时限未另作仪器测量。特定稳定帧测量不替代用户三问。

旧`check-inventory-report`仅跟进两步入口，**本轮未重跑**；[上一轮完整world消费拒绝](../preparation-ui-2026-10-09/checks-05/inventory-report-failure.json)及其后段缺口保留，不声称已验证合法持久消费/HUD/后续拾获。[最终build](build.json)由root执行通过；QA未重跑构建。所有自建浏览器已关，既有3027服务未动，QA未提交。
