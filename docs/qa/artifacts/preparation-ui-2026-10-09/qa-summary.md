# 备行重构 QA：限定范围通过

日期：2026-10-09。规格：[统一库存第5节](../../../specs/system-field-inventory.md#5-入口备行与装备hud)、[UI Kit](../../../design-notes/ui-art-overhaul.md)。适用 COH-F003 / F023 / F038 / F052、R100-P49。机器摘要：[qa-summary.json](qa-summary.json)。

备行专测 **8/8 通过**，共享库存视图回归通过。旧报告整链脚本在直接消费工具后被完整世界校验拒绝，**整体仍失败**，不将未执行的后半段算通过。此次不升级 R100/I14 发布或用户审美状态。

## 当前有效证据

- [专测最终报告](preparation-run-02/report.json)：Chrome 155.0.8059.39 / Apple M4 Pro ANGLE Metal，960×640、DPR1。源码运行前后相同，当前三份生产UI源码仍与该报告一致。
- [共享库存视图最终日志](checks-03/inventory-view.log)：退出0；60物件、存储失败回滚、Enter重复只提交一次、ShiftEnter重复只调用一次、无等级兼容入口、目录丢弃/供奉、裂隙交换/退出与移动转发通过。
- [旧报告最后诊断](checks-05/inventory-report.log)：退出1。正式目录/供奉/备行、最长说明不推走footer、最初4槽Rift HUD已执行；消费后的HUD与后续拾获检查未通过/未执行。
- [Art实帧审阅](art-review.md)：稳定低/重档、五槽、长库和展开装置读数的构图观察；不是用户终审。

专测包含三个独立真实出发：低档总览鼠标出发、中档整理ShiftEnter、重档总览ShiftEnter。选中等级在正式Rift身份中分别为low/medium/severe，cycle各只增加1。声明的DEV样本不能充当自然经营出击。

所有8个DEV上下文均在Boot前用内存后端；原生Storage调用0，当前/previous存档、独立哨兵、atmosphere与locale哨兵全部原样。首轮尚有locale读取、入场旁白get/set，原记录保留；页面前置Map隔离后的结论只引用第二轮。旧正式入口回归使用另一个干净浏览器上下文，允许其自身写测试存档；从未连接用户浏览器或其存档。

## 关键检查

总览无库存/详情列表、无第二个假人物；三档键鼠和单tabstop一致，hover不改选，切档不改库存/周期/世界/相机。普通Enter/Space，包括按住重复，两个页态均不出发。工具可空，未装武器显示真实缺口并阻出发。

4/5槽、相邻名称/标签/余次rect、固定footer可达已测。装置读数原生details展开不推footer。两列导航±1/±2/±6、Home/End通过；66件库显示实际包含半行的1–8范围。只wheel滚到后段而不改旧选中，再总览→整理不回拉；筛选、排序、选中及独立详情滚动均驻留（最终详情57px、列表298px）。未知物不暴露真名/效果/余次。catalog整趟被动与legacy事件被动分别显示余趟/余次，摘要与详情一致。

Esc整理→总览→世界逐层消费；直接关闭可回真实净化点。关闭复验记录了wall、scene clock、focus/hidden、tween、输入与相机：保持focused/可见，260ms后相机1/0/0、tween空、输入true。第一次260ms样本仍zoom1.108且输入false，但未保存tween进度，**不足以确认那次根因**；没有为该项改生产代码，最终以正式focus生命周期结束核验。

## 保留失败与修正范围

[首轮专测](preparation-run-01/report.json)保留3个失败：初始相机尚在260ms推进时作比较；退出只等wall260ms便检查输入；长库部分行真实可见却计数1–6。前两项修测试观察时机，最后一项是代码修正ceil可见尾项后的真实复验。首批/过渡截图均保留，不当成最终稳定图。

旧view第二次失败来自测试误要求兼容文案出现在footer；实际合同放在可见legacy摘要，已改为检查摘要及禁止虚构低档承诺。旧report第一次是过时的legacy成熟能力预告断言（当前HEAD本已为单个已知防御说明），随后出现staged HUD尚未挂载和直接域消费后的时机/事务问题。[checks-01](checks-01/inventory-report.log)、[02](checks-02/inventory-report.log)、[03](checks-03/inventory-report.log)、[04](checks-04/inventory-report.log)、[05](checks-05/inventory-report.log)均未覆盖。

最后一次[完整失败状态](checks-05/inventory-report-failure.json)显示：首次入场fence与动画均已结束，frameOpen=true，直接`consumeTool`返回ok/usesLeft5；随后完整world校验拒绝，scene paused=true、frameCommit blocked=false，内存余次5、已展示HUD仍6，并明确保留上一次完整记录。该诊断没有证明合法已提交的游戏消费，不把它归成已确认的生产UI回归。receipt里的before是活动引用，序列化时也变5，不能当独立前快照。已按约停止，无生产补丁或继续追绿。

## U1–U12与待人范围

- U1/U6：实际场景和`#dom-ui-root`、右侧文字、左人物与裂口、固定footer有运行与实帧证据。
- U2/U11/U12：Art已核无卡片堆/新增终端，复用本项目无框语言，具名参考及各自学习维度在spec/Kit；审美与像游戏仍由人决定。
- U3/U4/U9：当前色板、16px标题/选档、12px正文、辅助与10px键提示已按Kit核，名称/数值/状态分开。真实合成背景4.5:1、短划3:1未独立定量测，不凭肉眼或CSS名义值涂绿。
- U5/U8：游戏术语、未知公开投影、空工具可出发与真实武器缺口通过；无收益评级或虚构重档准备门。
- U7：两态、三档、层级退出、滚动和重复输入有上述实际证据；shared catalog/rift的view回归通过，report后半段保留缺口。
- U10：实际状态变化与输入响应已观察；CSS的100/120/160ms不当成实测400ms延迟统计。本次未单独仪器化该时限。

用户最终三问、定量合成背景对比、旧report后半段各保留自己的边界。build由root负责。没有跨引擎、弱设备、长期经济或完整发布结论。所有自建浏览器已关，既有3027服务未动；QA未提交。
