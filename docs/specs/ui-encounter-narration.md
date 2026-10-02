---
status: IMPLEMENTED / PRODUCTION-INTEGRATED / LIMITED-VERIFIED
created-date: 2026-08-20
last-modified-date: 2026-10-02
interface-changed: true
interfaces-with:
  - system-contamination-lexicon
  - system-atmosphere-narration
  - system-enemy-ai
  - system-movement-vision
  - system-chaos-scavenge-extract
exposes:
  - EncounterNarration create/advance/tick/showAtmosphere/showThreshold/destroy
  - encounter:identified
---

# 遭遇与裂隙低语的呈现

**TL;DR**：Rift 底栏上方只有一处低语位置。遭遇给可用于判断的含蓄提示，环境观察稀疏出现，混乱阈值优先覆盖；文字不成为名牌、设备分类日志或居中文学弹窗。

## 有效边界

DEC-104 / I8-R2 认可的自然自语方向、无“识别。”前缀、隐藏精确分类继续有效。2026-10-02 用户授权全游戏扩写，原 20 句和固定宿主抽句被新 CSV 与共享避重替代，不复制旧句作逐字闸门。身份、可识别条件、同身份 60 秒冷却的权威仍是 `system-contamination-lexicon.md`；全游戏写作、选池与静默时序归 `system-atmosphere-narration.md`。

## 载体

这是与身体处境相连的一行低语。沿已认可 Kit 的无框边缘文字，挂固定 960×640 画布的 `#dom-ui-root`，不随世界相机缩放；不挂在敌人头顶，不挡交互、不要求确认。

`#rift-encounter-log` 位于底部 90px、中央 520px 宽，13px/23px 衬线、1px 字距、灰绿 `#a1ac97`，轻黑影确保材质上的可读。世界动作和翻找/撤离条仍是主视线。节点一个观察句，可附一个既有成句短标记；不用 .game-panel 底板，不复用拾取队列。

参考维度沿现有 Signalis 的克制阅读、Darkwood 的环境留白；不照搬 CRT、全息数字、名牌或恐怖文学对话框。旧规的 Courier / 12px / 高亮 teal 已被迭代 11 用户认可 Kit 取代，不能再据旧规倒退样式。

## 单行、时钟与优先级

- 阈值可以盖掉任意低语；同帧多档收拢为最高档，仅消费该档一条。保留低强度画面闪动与原声音，阈值不再另外生成一层居中文字。
- 遭遇可打断普通环境；环境不能覆盖遭遇。至少 2.5 秒遭遇间隔与 60 秒同身份冷却不因换句而重置。
- 显示由所属场景成功帧的 delta 推进，渐入 200ms、渐出 300ms。遭遇/阈值主体停留约 2.5 秒，环境约 3.6 秒。pause 不推进且临时隐藏，resume 恢复剩余阅读时间，shutdown 销毁，不留 window timer。
- 忙时识别边沿作废，不排队。持续观察同一个体不再次触发；需先离开可识别再进入，并通过身份冷却。
- 普通环境机会、世界身份、每趟预算与 checkpoint 恢复限制见共享系统 spec；不对未见敌人作全知提示。

## 文本与事件

`data/contamination-observe-lines.csv` → `OBSERVE_LINE_DATA` → `observePoolFor(form)` → `chooseNarration(语义池, rows)`。不使用宿主 seed 反复选同一句。成功呈现后发 `encounter:identified`，载荷仍为 identityKey / nodes / utteranceId；nodes 仅 observe 与 utterance_mark。无 AI 刺激、游戏数值或随机结果写入。

成句标记：door_still_closing→开合、eye_in_the_seam→缝亮、cluster_lung→在涨、corridor_watching→回头。内部配方名不上屏，旧占墙兼容不等于加入正式敌人。

## 验收

U1–U12 以项目模板为唯一清单。此轮关注单一焦点、屏幕空间挂载、底栏不重叠、无额外确认、可读时间、阈值抢占、暂停/恢复及退出无残留。真实文案与实景一并复看；历史自然口吻认可不等于新增句子获用户审稿通过。
