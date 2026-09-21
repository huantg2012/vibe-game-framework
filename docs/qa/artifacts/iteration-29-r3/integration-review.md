# I29 R3 整合边界复核

日期：2026-09-21。范围：本轮生产 diff、直接消费者和已有 R3 证据。只读复核；本次没有重跑构建、回归或 60 状态加厚矩阵，没有修改生产文件。

## 结论

未发现需要阻断本轮交付的整合缺陷。没有新增正常玩家路径 bug；以下是有证据支持的兑现范围，不代表整款游戏无缺陷。

## 核对结果

- **价格单源及消费者**：`growth-route.csv` 现在拥有全部 22 步价格。codegen 校验正整数、路线不降价、每轴等级连续且齐全，并拒绝 `upgrades.csv` 遗留 `cost_*` 列。`upgrade-data.ts` 的 `costs` 保留为该路线的生成投影，不是第二个手工价源。`GrowthSystem.getCost/getNextStep`、成长面板、购买事务沿用投影；加厚的查询、资格和真实扣款共用 `GameState.getNextModuleMaxHpCost`。检索 `src`、`tools` 未发现还消费旧 `MODULE_MAX_HP_COST` 或旧 CSV 价列的实现。
- **旧购与扣费**：路线仍按已购等级跳过节点；载入没有按新价重算余额、追缴旧购差额或撤回效果。尚未购买的下一步使用当前路线价。加厚购买在提级前读取对应价格，扣费一次、三座装置只提高上限；外层 durable purchase 保留 next-only、储存失败回滚和成功后通知。总价 426、加厚 12/21/35 与既有 `linear-growth.json` 的实际购买核验一致。
- **固定 100 与继续旧局**：公式只改变未冻结的基地出行读数和共用预览；非法 maxHp 防护仍在。`session.loadExpedition` 继续传递保存的 conditions；`RiftScene` 优先取 checkpoint 的 modifiers，再取 departure modifiers，才使用当前基地计算。没有在载入时重写已冻结 startingChaos 的改动。复用 `thicken-recovery.json` 对 checkpoint/departure 两入口的旧值 7、基地新值 0 证据；本次不重复此前 60 状态验证。
- **入口信息边界**：裂隙就近提示已由 `currentIntensity.toFixed(1)` 改为 `getForecastReading(当前洞察等级)`；等级 0 保留带问号的粗线索，缺失预告时不从潮汐补出数值。提示与顶部 HUD 读同一投影，更新时重新生成提示内容；存续报告同样使用该公开投影，当前 inventory 备行面板未发现独立强度读数。生产界面检索未发现其他直接读取真实 intensity 的显示路径。`getForecastLookahead` 是既有供奉效果接口，未因本轮洞察价格或入口修复扩权。

## 复用证据与边界

- `codegen-check.json`：25 个生成文件再次生成无变化。
- `linear-growth.json`：22 步真实购买、持久化/重载、失败回滚、旧购跳步通过。
- `growth-slots.json`：扩容事务、旧档兼容与失败回滚通过。
- `forecast-reading.json`、`forecast-hud.json`：域投影及真实 Chromium DOM 的 L0–L3、旧版预告和无预告读数通过，HUD 错误列表为空。
- `runtime/manifest.json`：body、thicken、forecast 三组 `ok: true`，错误列表为空；`linear-runtime/manifest.json` 的 linear、legacy 两组同样通过。
- 此复核不把坏档鲁棒性、未挂载的旧 loadout 面板、抗性文档术语冲突扩大为本轮正常玩家流程缺陷；不宣称完成经济节奏实玩验收或整款游戏回归。

最小反证：任何正式购买显示/扣费与对应 route.cost 不同，保存的 active conditions 被新公式重算，或洞察 0 的正式入口再次出现真实强度数值，均可推翻对应结论并应重开该项。
