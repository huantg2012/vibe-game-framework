---
status: IMPLEMENTED-REVIEW-PENDING
created-date: 2026-09-10
last-modified-date: 2026-09-10
owner: director
---
# 迭代20完整交付与验证

用户授权“提交并继续推进，我只验收最终成果”。已先提交A/B及此前迭代19 W7/W8/W9（`5759579`），随后连续完成C/D/E。本报告记录实现与内部证据，不代用户批准审美、手感或长期经济平衡。

## 最终交付

- 十三族完整身份，各有普通、优良、精良、卓越四品质，共52种组合。名称在供奉前后保持一致，品质提升次数和侵蚀外形，职责与操作保持一致。完整说明见 `docs/content/contaminants.md`。
- 首八件与后五件均有真实技能目标、实际效果、失败免费、持久化后扣次和末次完整效果。后五件为迟落砂、附生壳、错结线、坠手石、背光珠。
- 13族×4品质的24px图标和32px世界硬像素，生产图标由同一像素几何输出crisp SVG，静态导出PNG/实物及展板齐备。前八族已接受的样板几何未被后五族导出改写。
- 所有族接正式裂隙掉落与战斗试验场，报告、备行、供奉、拾获、裂隙装备读数使用同一实例；没有第二套独立物品库。
- 五个退役族停止新生成，旧物按CSV映射和容量比例迁移，保留ID、位置、供奉进度、装备引用和在途账本，不删除、不补满、不重复兑换。
- 供奉有限收益重整：一次有效注入至多+6完整度；真实承冲击后才获得下一轮精确记录。旧公开承诺保留，失败保存不偷发能力/修复。

## 经济与存档证据

`check-contaminant-economy.ts`使用真实InventoryStore与生成数据：

- 10条迁移（5退役族映射+5重新定额族）逐旧稀有度、末次、部分/满额/旧超额测试。守住余量比例、ID/归属/供奉进度、源对象不突变、重复载入不重复换算。
- 真实在途账本、供奉/地面/携带归属，以及存储失败回滚；死亡只清本趟携入及拾获，基地供奉原件仍在。
- 每个safe/contested/deep危险档4096个种子，三个档均覆盖全部52组合，品质平均档位分别约1.588 / 1.906 / 2.389；与CSV目标误差在0.08内。相同runSeed+节点ID稳定，不受翻找顺序或战斗随机数影响。
- 供奉3/4槽包含武器共同竞争；每次积累1时需3次返回，高潮积累3时一次成熟。没有通过增加供奉槽消除选择，也没为品质添加额外重量或供奉门槛。

这些验证说明概率、供给规则和保存事务按设计执行，不等于完成长期玩家经济调参。武器开局已供奉白板、基地既有无武器重建策略、16容量与负重减速沿用既定规则。

## 最终领域回归

最终工作树重新运行以下14项全部通过（`TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/inventory/<name>.ts`）：

- `check-contaminant-quality`：13族52组合、递进次数、像素边界/差异、旧品质投影。
- `check-contaminant-economy`、`check-save-migration`、`check-field-loot`：经济/迁移/保存和真实揭晓事务。
- `check-tool-consumption`：18项有效目标、保存失败、消费与来源叠加回归；旧夹具已适配新13族合同。
- `check-passive-merged-loadout`：四类被动旧在途重复实例完整消费，最后一次完整。
- `check-next-five-tools`、`check-first-eight-tools`：全13族真实ToolSystem领域效果与目标几何。
- `check-first-eight-offering`、`check-offering-families`：13族供奉，后者10组，含205个整数披露组合输入。
- `check-impact-forecast`：9组已承诺/挣得预告、最后供奉、读档及失败重试。
- `check-equipment-lifecycle`、`check-crowbar-combat`、`check-survival-weapons`：原武器供奉/命中耐久、空挥不耗、末次完整、负重与抗污未回退。

`npm run codegen`、`npm run build`及`git diff --check`通过。构建242 modules，主共享包约2,370.79kB（gzip630.96kB），仍有既有大chunk提示，无构建错误；未声称做过性能优化或全浏览器兼容。

## 实际浏览器回归

全部使用独立Chrome上下文与新测试存档，不清空或改写用户存档：

- `check-next-five-browser.mjs`：真实Combat受伤→附生壳抗性→Chaos污染流入；真实敌人物理位置跨错结线→只停移动→恢复；坠手石入区/出区且感知攻击保持；背光珠生成位置标记、拒绝重复、关闭清理；真实气团Host时钟延后5秒、重复免费、来源清理。正式存档哨兵不变，无pageerror。
- `check-inventory-report.mjs`：净化点一个Tab物件库，无基地负重与B；备行唯一装备入口；真实ID装备HUD；裂隙Tab只列本趟拾获、世界继续；可展开说明且操作按钮稳定。
- `check-offering-flow.mjs`：真实供奉UI接受武器和异物；未成熟禁装；出击/返回最后一次防御先执行再成熟；槽位清空且不重复制造物件。
- `check-full-contaminant-catalog.mjs`：真实净化点报告逐项选择全部52种，检查固定身份、准确次数、24px图标成功解码、52份像素几何互不重复；列表滚动和详情保持正常，后五族卓越实景截图已采集，无pageerror。
- `check-offering-repair-browser.mjs`：code代理真实Chrome复验有限助修显示/预览、一次有效注入、quota失败完整回滚及重试/读档不返还。详见 `iteration-20-offering-finish.md`。

新浏览器脚本编写时修正了夹具与真实API差异：Enemy应使用getSprite+syncPositionFromBody；控制getter须立即取值成快照；Host更新有帧步长限制须逐帧推进。失败轮次未当作已通过证据，也未改生产行为去迎合测试。

## 独立审查与视觉边界

QA独立发现并复验关闭三项：旧在途同被动合并余次覆盖、错误的错槽名称、逐槽挡下整数总数不对账。详见 `iteration-20-final-audit.md`。Art检查完整展板、实际报告/备行/拾获截图及后五族逐张实景，确认列表/详情边缘和暗部形体仍可读，未发现风格切换或新增阻断问题。没有读取用户禁止的旧审美skills。

报告中的截图和浏览器检查属于内部证据，用户只需最终体验。退出/刷新/崩溃政策仍未批准；本轮保留在途账本，未把它视为死亡或自动撤离，也不宣称实现完整中断恢复。

## 体验入口

- 游戏：`http://127.0.0.1:3000/`。净化点Tab→物件、供奉台和入口备行；裂隙Tab→本趟拾获。
- 完整能力试验：`http://127.0.0.1:3000/combat-lab.html`。可切换全部13族、四品质和真实敌人；Q/F主动，被动独立槽。试验场使用独立库存，不写正式进度。
