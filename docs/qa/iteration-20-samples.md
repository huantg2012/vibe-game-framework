---
status: IMPLEMENTED / USER-EXPERIENCE-REVIEW-PENDING
date: 2026-09-10
scope: Iteration 20 batches A+B, not the complete contaminant overhaul
---
# 迭代20首批8件：交付与验证

A行为基础与B首8样板已接正式裂隙、库存、供奉和战斗试验场。当前仍18族，其中8族×4品质已成品化；其余10种兼容保留，C剩5族/D合并迁移和风险掉落/E全盘经济与用户体验待执行。不是整迭代完成，不包含提交/推送。

## 实际范围

- 冷结块、重影片、返刻片、缄口布、缺口石、留影玻璃、复声壳、余烬核：固定前后身份，四品质次数、原生24px图标与32px世界模型。
- 源隔离控制、真实视线选敌、受伤解冻、安全越一格墙；怀疑/听觉按遭遇消费，失视记录最后可见位置；独立视觉诱饵、实际落点声音调查、单个已释放环境危险压制。
- 首8供奉效果去除旧随机惩罚/隐藏奖励；重影片伤害守恒、留影玻璃额外削弱余波、余烬核按真实承伤小额修复；返刻片预告可信、即时前瞻与存档承诺。
- 品质贯通报告/供奉/备行/HUD图标/世界物件/拾获提示/撤离结算。旧实例保ID、位置、进度与余次；余次高于新基准不截断，详情标明基准。返刻片旧主动槽不静默移动，新备行提示改被动位。

## 已完成验证

- TypeScript全量检查；CSV→生成代码；生产构建。
- `check-contaminant-quality.ts`：9组、32品质组合，族与品质抽选独立，旧件只读投影，非法品质/保存失败/活动run保存与消费回滚。
- `check-first-eight-tools.ts`：真实ToolSystem/AI/FSM消费、失视快照、怀疑事件、听觉声源、视觉多来源、场域合法目标与结束清理。
- `check-first-eight-offering.ts`：8族在随机边界和零伤害下无旧隐藏副作用；均摊整数守恒、次要模块减伤、过量伤害不刷修复。
- `check-tool-targeting.ts`：安全一格墙完整碰撞体扫掠，另6项声源投掷墙/边界/角落净空验证。
- 来源控制、环境危险恢复、25项兼容工具消费、库存/供奉/存档/场域/敌人接触相关域回归。
- `check-tool-contracts-browser.mjs`：真实Q停止敌人身体和攻击，真实Space命中解冻，无墙越障免费。
- `check-first-eight-browser.mjs`：四品质真实余次和被动槽、原生图标、留影真实AI源8秒到期、声音落在面前、气团自然释放后压制且核心保留、已压制重复施放免费。
- `check-combat-lab.mjs`：十款撬棍、全部生产敌人三档、真实双方命中、死亡/R重开、重复场景清理、纹理数量稳定。
- `check-inventory-report.mjs`：Tab唯一物件总览/无基地负重，备行为唯一装备入口，裂隙拾获排除带入装备，整理不停世界。
- 所有浏览器使用独立上下文，正式存档哨兵字节不变、无pageerror。未操作用户已有浏览器存档。

`check-impact-forecast.ts`7项承诺/幂等/成熟/保存回滚，`check-save-migration.ts`9项与`check-equipment-lifecycle.ts`通过；`check-offering-flow.mjs`真实供奉→出击→归来确认武器与技能末轮效果成立、成熟一次、回库清槽。独立复验见 `iteration-20-sample-audit.md`。这些结果不等于用户审美或实战手感PASS。

## 美术核对与体验入口

只读art审查了实际报告/备行/Rift/试验场截图，原无框布局与字号保留；供奉仅代码核对，新品质采用中性材质读数。没有读取旧审美skills。静态四品质结构差异与硬像素已核，最终品质辨识和手感待用户体验。

- 游戏：`http://127.0.0.1:3000/`
- 首8：`http://127.0.0.1:3000/combat-lab.html?tool-q=solidify&tool-passive=retrograde&tool-quality=ordinary&auto-reset=0`
- 余烬核：选气团/雾团/尘絮群或占漆，靠近并等释放后按主动键；冷结块/视觉与声音诱饵主要用于地面实体。
- `public/assets/items/contaminants/iteration-20-quality-sheet.png` 为4倍与原尺寸组合展板；`docs/art/iteration-20-object-samples.md` 为资产合同。
