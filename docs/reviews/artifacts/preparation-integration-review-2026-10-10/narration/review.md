# 备行正式接入 · 叙事与提交观察分审

审查版本：`0340113b` 相对 `f999bc95`。日期：2026-10-10。

范围：COH-F043 备行状态自语，以及其对 InventoryStore、SaveManager、成长购买、净化点/出击生命周期的依赖。只读生产源码；复现使用独立 Node 进程、内存存档及实际领域方法。未操作玩家存档，未进行浏览器画面审查。

## 确认发现

### P3：换装后恢复原状态仍消耗一次额外自语预算

位置：`src/narrative/preparation-narration.ts:46-48`。

触发：在低污染页读完/显示低耐久在手撬棍的自语，转行装页，换成另一件同攻击力撬棍，再换回最初那一件，返回低污染页。实际库存与装备完全回到原状态，且没有任何伤害增强、成熟或成长事件，仍抽出另一句 `prepare.worn_weapon`。

原因：行装页的中间状态令 `lastFact` 暂时消失时，无条件记下 `extraAvailable=true`；回到原件后不复核最终语境是否已经消费。它不无限重播：全程 `extraUsed` 仍把此问题限制为一次。问题是已锁定的“换回已消费上下文不触发”没有实现，而这次无意义重播会占用之后真正成长的唯一额外机会。

依据：`docs/specs/system-atmosphere-narration.md:99` 明确排除“换回已消费上下文”，并限制一程合计一次状态变化表态。

证据：`restored-equipment-budget.ts` / `restored-equipment-budget.json`。实际 `InventoryStore.prepareWeapon`、adapter、journey 组合复现：原始状态完全恢复为 `true`；第二句仍命中 worn 池；第三次往返留白。此为领域运行复现，不冒充浏览器实测。

建议：返回选级、实际准备展示额外句时，再核对当前语境相对于已消费语境的变化；中间短暂失效可以立即清旧句，但不应单独成为恢复原状态后的额外抽句凭据。

## 确认的合同/验证缺口，当前有用户入口防护

`InventoryStore.subscribeCommitted` 声称仅在 durable mutations 通知，但 `src/systems/inventory-store.ts:147-154` 只以 persistence 回调未抛错为依据。正式 `PurificationScene.create` 的归来成熟使用 `SaveManager.commitWorldTransaction`，其 `enableInventoryPersistence` 在 `worldTransaction=true` 时直接返回，因此 observer 在最终完整保存前就收到成熟/基地结算。

真实 SaveManager 拒写复现：`saved=false`、`pending=true`、库存存档字节未改，已触发两次 committed 通知；直接调 journey 已可选择 `ready_item`。证据：`failed-world-commit.ts` / `failed-world-commit.json`。

反证与限制：`PurificationScene.isAnyPanelOpen():743` 包含 `saveManager.hasPendingSave()`，`enterRift():906` 因此阻止真实玩家在拒写待重试时打开备行；`create():464-469` 也只在保存成功后发布到场/揭晓。未找到该缺口导致玩家看到未保存自语的正式路径，**不将其列为当前玩家体验阻断项**。但“提交观察器全面只接收持久提交”的验证结论过宽，应注明这一缺口或让世界事务共用真正提交边界。

## 已核验

- `npm run check:preparation` 本轮运行通过：3 档 A 文案、250ms 候选、暂停余时、每档和额外预算、普通/帧事务拒写、成熟/装备/未知与 inert、损失/组合事件、真实成长购买成功与拒写。
- 正式成长购买仅在完整保存成功后发 `GROWTH_PURCHASED`，拒写回退金钱/成长/稳定度；亲和与基地加固不命中身体成长池。
- 普通界面一次只开放一个交互面板，购买成长前须离开备行。关闭将旧句结束但保留旅程预算；成功成长后重开同档可以使用一次额外机会，不需要改档。
- 场景级旅程在净化点 create 建立、shutdown 销毁，视图 close 不重置预算；加载/新记录清除近期事件，真实出发清除本次净化点近期资格。
- 新武器判断只接受实际可用在手武器、同攻击 profile 的公开伤害严格增强；品质本身、未知物和低耐久不自动触发增强池。

没有修改生产源码。未发现叙事范围内 P1/P2 级的已确认玩家体验回归；上面的 P3 与 durable 合同缺口不代表视觉/其他审查范围通过。
