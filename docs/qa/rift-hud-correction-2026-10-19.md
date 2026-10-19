---
status: LIMITED-QA-PASS / HUMAN-REVIEW-PENDING
created: 2026-10-19
decision: DEC-223
features: COH-F032 / COH-F035 / COH-F054 / COH-F030
---

# 同化次级HUD与冲击解耦修正

用户明确：同化必须保留低于生命/污染的常驻位置；同化不能影响冲击增幅。本轮按此修正，不追加其他惩罚，不开始视野或角色美术阶段。

版本：设计`fb6de384`，机制`b2d03dea`，UI与场景接线`471b53d3`。用户独立CLAUDE.md修改未混入。

[新实景图册](artifacts/assimilation-hud-correction-2026-10-19/index.html) · [浏览器原始结果](artifacts/assimilation-hud-correction-2026-10-19/browser-check.json) · [组件原始结果](artifacts/assimilation-hud-correction-2026-10-19/component-check.json) · [Art短核](rift-hud-correction-2026-10-19-art.md)

## 实现核对

- HUD右上随身入口下方10px标签/11px等宽数值，A0也显示，legacy隐藏。无第三根条、说明句、闪烁或底板。面板展开时让位，关闭恢复。
- 原事务提交后刷新读数，仅显示精度变化时写DOM；Tab身体保留同化、视距、感知三事实，物品节点/选中/滚动不重建。
- CSV impact_gain、生成字段、assimilationImpactMultiplier、冲击预算/预告A重投影全部删除；普通归返、死亡、放弃和疗愈不读取A调整冲击强度。旧冻结预告原本保存原潮汐事实，无需迁移或重抽。
- 培养藏每周期一次正常冲击，仍部分降低A、正常推进供奉和潮汐；更高A需要更多周期。随身、备行提示、培养藏错误冲击文案清除。

## 本轮真实执行

机制Code代理执行，root复核提交差异：新增72组A/潮汐/归返结果/供奉组合，确认相同条件下预算、损伤、防御和预告不随A变化；旧V1预告与lookahead保持。A10/30/60/100疗愈单次强度相同，归零周期1/2/4/7。既有同化persistence/runtime/review、9项forecast contract、CSV codegen一致性检查通过。

UI Code代理执行：类型检查、9项库存回归、隔离生产组件A0/30/60/100三事实、legacy隐藏、HUD A0/A100、提交flush/discard、精度不变节点保留、列表选中和scroll180保持、开关面板与帮助布局通过。脚本位于tools/qa/check-rift-hud-polish.mjs，旧实景采集脚本同步新接口而不重写历史报告。

实际Chrome155隔离正式入口→新出发→破膜盆地，10项检查通过：初始A0常驻，受控A30经场景提交刷新，层级分区，帮助与入口不重叠，Tab隐藏/恢复下层HUD，身体三事实，六件只读真内容投影保留3完整条目+下一条预览及固定动作，0 pageerror。图为1264×842投影、逻辑960×640。用户存档未触碰，临时3081/3083服务均已停止，3027未动。

root执行生产构建通过（19.55秒），保留既有大chunk警告；源码diff检查通过。项目无lint脚本，不声称lint通过。root及Art复看实景HUD/身体页，Art另看帮助图；限定范围未发现布局阻断，用户审美未代签。

## 范围与未验证

上述受控状态不等于自然满污染积累；六件只读投影不等于真实交换交易。未重跑全三世界、全污染档、长期经营、旧档完整冷重放、性能预算或其他浏览器。新HUD文字未做独立动态背景对比采样，不继承上轮5.26:1数值。视野/混合同化美术仍只是后续任务。

游戏全貌check保留历史来源漂移与适用性未知，不重置baseline冒充全库通过。旧DEC-221/222报告保留当时证据，但旧冲击与隐藏HUD方向不再有效。


## 同日排版收紧（COH-F032，afc99843）

用户指出整体行距过大。左上改8px组距自然流；右上资源4px行距；装备保持24px图标，四行130→102px；帮助行高19→17px，小地图图例距5→2px。负重不出现Tab文字，同化保留次级短行。只调整排版，不改机制或字号。

`npm run typecheck`、既有HUD组件回归和[浏览器9项检查](artifacts/rift-hud-spacing-2026-10-19/browser-check.json)通过，零pageerror。图为真实生产余烬脊新出发；第二帧仅向HUD注入低血／三效果并展开帮助，未改玩家存档或宣称自然取得该状态。

[当前实景](artifacts/rift-hud-spacing-2026-10-19/hud-compact.png) · [展开与临界状态](artifacts/rift-hud-spacing-2026-10-19/hud-compact-expanded-stress.png) · [组件回执](artifacts/rift-hud-spacing-2026-10-19/component-check.json)。

Art子代理与root复核两帧：分组连续、主次仍可辨，低血／三效果／帮助不互压，不遮中央人物，装备仍可读。本次限定布局无阻断；用户审美、其他世界动态背景、性能与后两阶段不因此通过。
