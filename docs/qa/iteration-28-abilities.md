---
status: IMPLEMENTED / COMPONENT-AND-CROSS-DOMAIN-CHECKED / NATURAL-PLAY-OWNED-BY-ROOT
created-date: 2026-09-20
owner: code（i27_reliability）
---

# I28 共享能力与完整恢复专项

本报告覆盖运行层及保存边界。实际浏览器中的自然获得、供奉鉴定、装备与撤离由根代理汇总；这里不把受控测试称为玩家实玩，也不代表用户审美或长期平衡已经通过。

## 实现范围

- `CatalogAbilityRuntime` 从正式版本化目录取得12族参数；36件主动定义共用处理器，没有按物件ID或地图ID写能力分支。两种整趟被动由库存出发绑定权威提供，Tool只读取当趟视距/容量收益。
- 每次合法施放先提交消费回执，再创建效果；actionId重复不再成功。每族不能靠另一个物件刷新或叠加；旧/新等效区域、凝滞、诱饵、探查也不能相互覆盖未结束的效果。最后次载体销毁后，效果仍保有源实例ID、definition、catalogVersion、完整resolvedParams与独立时钟。
- 短冲连续200ms，20×20身体扫掠，墙/空洞/其他身体/不可见断口均截断；可走不足16px拒绝。Scene按不超过4px/16ms的子步运行真实AI、接触、攻击、行动声和污染，再推进同帧余时；结束后400ms不能连冲。Tool不提供无敌、穿墙或跳过危害分支。
- 视距倍率在原混乱缩距及保底半径后应用，环身/前向一致，角度、亮度、光色不改。主动抗污和已有抗性统一进入正向混乱输入及60%上限；已满上限拒绝消耗。
- 消声拥有单独的行动声开关，覆盖已经SUSPICIOUS的AI；不是仅挪用旧muffle的首次发现保护。实际移动仍传给踩踏污染。视觉、伤害、其他外报声与已经确认的追逐保留。
- 声诱要满足真实听觉及连通路径；假身要实际进入敌人的视锥/遮挡判定；二者不覆盖已确认真身追逐。绊线一次穿越只停移动，仍能攻击；重区只对连通地面起效，重叠取最强，离开立即解除。凝滞同时停移动/感知/攻击，真实伤害打破。
- 新出发combatRulesVersion2让新旧硬控共享2秒保护。Host压制结束也保护2秒；目录压制包含墙击环境源，旧combust仍维持历史目标池。墙面349ms旧前摇被压制取消，恢复后重新完整350ms预兆。
- 定向预览与施放共用predicate。合法落点/线/短冲显示轻量世界标记；Q/F/G来自实际按键配置。刚挣脱对象拒控时显示350ms灰色角括号，不扣次，不显示不可见/死亡对象；读数时间也保存在效果快照。抗污HUD使用实际封顶后的来源增益与剩余时长，不以固定标称值替代受限收益。根代理及art完成最短语言合规核对，未以此代替实景可读性测试。
- 原生16px声诱/重区落地物直接消费美术目录接口；不复用旧物图、不从32图稀疏降采样。

## 恢复边界

`rift-recovery-state.ts` 在真实整帧中交叉验证：

1. 效果runId、动作回执、源实例与已销毁账本相符；回执绑定definition与版本，参数只能来自相应版本定义。0余次但仍绑定本趟的被动合法。
2. 敌人、历史穿线、拒控读数、Host引用来自原世界清单；活动凝滞/停步不能同时处在控制保护期。AI真实行动声门与消声效果相符。
3. 目录压制关联同Host权威抑制source，时长不能超过定义、不能短于尚生效的工具效果；Host不能凭陌生`ability:`来源制造压制。Host先恢复真实时钟，Tool只重绑表现，避免再施放/再扣次。
4. 新目录局必须有固定dropPlan。每个已缓存节点的完整出生实例与计划逐项相同，acquiredOrdinal仍为0；实际领取后的ordinal/鉴定/余次变化保存在独立实例。旧无plan局不能凭缓存插入新目录物。
5. 旧包可省略新可选字段并保持原规则；旧目录行程不能携带新目录活动效果，旧战斗规则不能恢复新AI/Host保护时钟。旧13族末次效果、不可变残影、节律和声音脉冲仍按原快照续行。加载不推进离线时间。

## 机器证据

- `npm run typecheck`：通过。
- `npm run build -- --outDir /tmp/coh-i28-runtime-build`：通过，304模块、4.31秒；隔离产物未覆盖自然链正在使用的dist。保留既有大chunk提示，没有把它作为60fps或加载时长证明。
- `npm run check:contaminant-catalog`：全部通过（目录/库存/来源/能力/保存迁移）。
- `npm run check:rift-recovery`：本agent先前完整15组通过；新增目录整帧专项也独立通过，包含两个真实正式Host构成、旧13族末次耗尽、整帧事务、拒写与安全弃局。root随后将目录整帧和权威计划纳入统一17组总门，最终退出结果由root总报告记录。
- `tools/inventory/check-catalog-abilities.ts`：**36主动定义**实际创建、tick、JSON保存、恢复、到期；高档5.5秒不被旧4秒上限误拒绝。另测同action去重、拒写不生效、凝滞受伤打破/2秒保护、绊停可攻击、强区域不相乘、连续短冲/冷却/断口/身体、实际墙击重置。
- `tools/inventory/check-catalog-world-contract.ts`：**96个受控比较**＝12族普通档×2种构型×2档混乱×2档负重。使用共享AI、Chaos、Visibility投影、库存和Tool，对照未装备状态；图形/物理外壳有适配。结果：[controlled-abilities.json](artifacts/iteration-28/controlled-abilities.json)。证明接口与收益方向，不证明自然游玩的选择频率或长期平衡。
- `tools/recovery/check-catalog-state.ts`：原键盘游玩保存基线＋36定义的受控末次效果组合＋**161个拒绝反例**。固定输入：[catalog-active.json](../../tools/recovery/fixtures/catalog-active.json)，来源为隔离浏览器`natural-current/03-carry.storage.json`。效果组合为测试数据，不冒称全部36件均由自然探索取得。
- `tools/inventory/check-enemy-controls.ts`：独立source、完整重启预兆、真实伤害解除、耐久门通过。
- `git diff --check`（本agent拥有文件）：通过。项目没有lint配置或lint脚本，因此不能宣称独立lint已跑。
- `npm run dev -- --host 127.0.0.1 --port 3028 --strictPort`：本地Vite在95ms内ready，随后停服。初次sandbox拒绝本地listen，经工具自动批准后启动成功；此项仅为启动检查，正式入口浏览器证据由root汇总。

## 检查中修正

- 消声最初仅接旧muffle入口，无法屏蔽已经起疑的持续听觉；改为原始行动声门，并加真实FSM反例。
- 新声诱最初只有欧氏距离/墙衰减；加连通路径长度约束，测试隔断需要长绕路时不能隔空影响。
- 缺少墙击Host压制目标；按设计统一环境源合同补入，保持legacy目标池。专项fixture误写旧`contact_melee`导致两次相同失败；按项目闸门停止自行重试并交root独立核验。改为正式`contact_adjacent_strike`后，root独立执行36件与墙击测试通过。
- 完整恢复新增Host来源、node birth/dropPlan、receipt definition与拒控读数引用检查，避免纯JSON结构合法但世界事实不一致。

- 最后一轮总恢复在旧journey fixture的`retryRequested`断言失败：净化点现为防拒写先揭晓，完整建图后才挂重试UI，而fixture在texture创建处主动停止。只读probe确认pending=true、原bytes保持；root更新该fixture的观察边界，持久化断言不删，UI由浏览器拒写测试负责。产品未回退到提前发布知识。

## 证据限度

原15组与新增专项覆盖状态/语义/事务，不替代完整浏览器自然链。96比较依赖受控输入，尚不能回答玩家是否愿意选某个能力、声诱/假身是否在多次高压场景中稳定带来价值。美术合规不等于亮度/高速读图已经令人满意。最终构建、自然生命周期、资产/来源审查及未完成项统一由[迭代28清单](../tasks/iteration-28.md)和root QA报告负责。
