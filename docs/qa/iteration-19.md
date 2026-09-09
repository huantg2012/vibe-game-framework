# 迭代19 验证记录

2026-09-09，DEC-138实施批。正式四品质十撬棍、统一库存和正常搜撤已接生产。本批按DEC-139纳入阶段提交，未代替用户验收；**退出/刷新/崩溃后的未完成出击处理仍待用户明确**，当前不能原地续玩。

## 已执行检查

- `npm run codegen`：正式六份武器/生存CSV生成数据；draft不进入运行时。
- `npm run build`：TypeScript与Vite成功。既有大chunk提示仍在，未做本轮范围外拆包。
- `npm run art:crowbars`：10定义、20份二值透明PNG、四档在32/48px可区分轮廓、共享握点、同倾向轮廓/污染色一致性通过。美术源与生产数据同源。
- `npm run check:crowbar-combat`：十定义、逐挥一次随机、身体/Host共同HP/LOS/目标预算、不可杀场免疫、100ms缓冲边界、姿态连续性、8/16/33/100ms时间步通过。
- `npm run check:survival-weapons`：只有随身已装武器贡献抗性，正向/负向/起始混乱通道，时间临时倍率、8/12/16负重边界、确定性来源、首发现与全十定义可抽到通过。
- `npm run check:inventory`：9项领域检查通过，包含原子交换/写失败不改归属/装备不可丢/幂等死亡撤离。
- `npm run check:inventory-tools`：22项真实工具消费通过；成功消费后才放效果，失败保留实例和剩余次数。
- `npm run check:inventory-loot`：搜索与地面物检查通过，覆盖保存失败/超重/松键锁/撤离优先/可见性/事件防重。
- `npm run check:inventory-save`：8组真实SaveManager检查通过，覆盖V1迁移、重复加载不复制白板、坏档不改变运行态、工具消费保存、quota失败、迁移失败、新纪录原子重置、世界结算只保存一次且重试不重复收益/潮汐。
- 既有`check:runtime-behavior`、`check:combat-visual-state`、`check:environment-runtime`通过；`check:contact-runtime`已适配正式Combat/Host共享攻击夹具并通过，消声夹具明确返回成功收费结果。
- `tools/inventory/check-inventory-view.mjs`在独立Chromium上下文通过：R4区间/真实PNG/装备属性预览、60物件筛选/焦点/滚动驻留、失败事务与单按Enter/ShiftEnter单提交、1.5秒弃置的取消/关闭/失败/成功、裂隙装备不重复/取消草稿与WASD退出、残渣导航关闭后仅回调一次且不改变物品。
- `tools/inventory/check-scene-inventory.mjs`在独立Chromium真实游戏场景通过：新记录→基地B→入口整备→出发账本→真实非安全薪柴堆1200ms翻找得到首把优良撬棍→B开包时世界时钟继续→W关闭→实际撤离结果→R回净化点一次结算→装上带回的优良撬棍再次出发→真实挥击抽样落在29–35且读取实际地图种子→死亡后优良撬棍遗失、卸下留在基地的白板保留。零浏览器运行错误。测试触发结算调用真实RunController，未以走到出口代替验证。
- `git diff --check`通过；项目没有lint脚本。

浏览器均使用隔离的空localStorage，不访问或覆盖用户存档。通过读取Vite原模块URL避免HMR后意外创建第二份库存单例；按键持续80ms避免自动化零时长按压被帧轮询漏掉；新游戏等待真实入场过渡结束后再按B。

## 实景和独立审查

已检查真实净化点库存（含四品质对比）与裂隙持握/攻击画面。模型来自32px世界像素，库存使用48px独立图标，非概念大图直接裁下；真实背包/场景属性同源。静帧与内部检查不能替代玩家对动作、反击、手感和长期拾取取舍的评价。

隔离审查快照：[库存](iteration-19-evidence/inventory.png)、[持握](iteration-19-evidence/held.png)、[挥击采样](iteration-19-evidence/swing.png)。库存多品质为审查夹具，真实掉落路径由场景回归单独验证。

[独立审查](report-iteration-19-final-audit.md)发现并修复包内缓冲攻击、工具硬直输入冲突；开包现在也立即中断搜索并清进度。

端到端追加品质装配检查发现并补齐RiftScene→Combat.configureWeapon接线：出发时明确注入真实装备成品与本次种子，避免Combat默认白板覆盖库存装配。新增测试通过真实拾取/回库/装配/再出发验证29–35区间；不是只单测configureWeapon函数。

连续场景回归发现并修复一个新P1：Phaser先销毁显示对象，Combat.shutdown取消挥击时仍重绑武器图像，抛错阻断返回净化点。PlayerWeaponRig现在在equip/sync检查对象生命周期；同脚本再次完整撤离与死亡返回均通过。

## 未完成或未充分验证

- 未完成出击的退出/刷新政策未定。当前保留active账本，拒绝把它错误载入净化点；这只隔离了死锁入口，**不是恢复功能完成**，也不默认为死亡全丢。
- 长期品质掉落经济、满载高混乱逃生、四档连续实战手感、美术与库存好用程度待用户体验。不能把均值25等同于旧固定25的击数体验，白板区间允许多一次补刀。
- 满载真实地图20次连续交换、所有输入/受击/结算同帧竞态、跨浏览器兼容尚未穷举。已执行对应领域/组件边界检查，不宣称完整发行验收。
- 原地战斗快照恢复、地图背景属性联动、其他武器家族均未加入本批。
