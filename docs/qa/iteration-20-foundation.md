---
status: IMPLEMENTED / INTERNAL-VERIFIED / HUMAN-REVIEW-PENDING
created-date: 2026-09-10
scope: 迭代20 A 行为与安全基础
---
# 迭代20 A 验证

本批修正式Rift与战斗试验场的控制、目标选择、连续听觉消费与单墙安全位移。既有18种物件身份和三档掉落暂保留，完整13族/四品质仍未上线。环境压制/推迟只交真实Host接口和测试，正式新异物待B/C。

通过：
- `npm run typecheck` / `npm run build`（238模块；已有大共享chunk提示仍在，无独立lint脚本）。
- `check-enemy-controls.ts`：来源隔离、真实Combat前摇中断、伤害解冻、伤害/保存拒绝不解冻、最终耐久与delay满条门禁。
- `check-tool-targeting.ts`：最近可见/存活/LOS、同距稳定、薄墙完整身体、厚墙/VOID/越界/斜角第二墙/非法落点拒绝。
- `check-tool-consumption.ts`：26项，持久化失败无世界副作用；连续消声只耗一次、末次持续、静默后新遭遇才再扣；同堆不可重复回收；非法穿墙不扣；真实ToolSystem区域重叠/到期/受伤解冻不清别的减速。
- `check-environment-tools.ts`：真实Host接口、仅正确危险阶段支持、实体和核心保留、来源独立、到期有自然预兆。
- 既有runtime-behavior / contact-runtime / crowbar-combat / environment-runtime / volume-deployment / volume-integration / dust-motion通过；volume-integration旧fixture升级为实际Combat注册与挥击，未降低原断言。
- equipment-lifecycle / save-migration（9项）/ field-loot通过，保留实例/余次/存档原子性。
- `check-tool-contracts-browser.mjs`：隔离Chrome在3000正式代码上按Q冻结、900ms内身体不动且不能攻击；Space真实伤害解除冻结；空地穿墙失败不扣。存档哨兵字节不变，无页面异常。
- 控制子任务另跑完整 `check-combat-lab.mjs`：10武器、13基底×3污染档、双方接触、工具消费、重启/死亡/纹理上界；该轮在root接线前，root新增实机合同测试验证最新接线。

保留限制：安全穿墙按全身只跨一个墙格保守判定，斜角扫到邻墙拒绝；当前是安全瞬间越障加实体化，完整缺口石表现待样板。没有新美术样板、平衡统计或用户体验PASS。未提交或推送。
