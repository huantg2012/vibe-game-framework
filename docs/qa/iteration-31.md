---
status: IMPLEMENTED / LOCAL-VERIFIED
date: 2026-09-29
revision: 94faa33 + iteration-31 working tree
features: [COH-F002, COH-F003, COH-F019, COH-F021, COH-F027, COH-F029, COH-F034, COH-F036, COH-F044, COH-F045]
---

# 迭代31：修复与能力收益兑现

[任务与裁决](../tasks/iteration-31.md) / [整体进度](../progress/roadmap.md)。正式修复、备行与报告已接入整数所得；catalog 整趟被动留下真实伴随事实；新记录替换在完整写入成功前保留旧字节。未改变价格、掉率、成长顺序、原场景美术或在途冻结条件。

## 自动验证

- `npm run check:iteration-31`：exit 0。363 次真实翻堆结算、1800 组纯预览与实际修复对照、94 个最小阈值，覆盖亲和、互换、共振、有限修复额度、100 效能封顶与 115 完整度。两条受控链实际执行修复拒写回滚→修复成功→SaveManager 重载→冻结新出击→LootSearch.complete；修改基地不追改在途收益。另有 6 组伴随回执合同、11 组新记录替换合同。
- `node tools/recovery/check.mjs`：exit 0，19 组脚本。含新记录、在途世界/角色/工具、结算重试、旧档救援、随机身份、地图与漆面兼容。测试替身补齐 Phaser Rectangle 与 Loader.File 导出，恢复旧 I30 模块导入；未跳过断言。
- `npm run check:contaminant-catalog`：exit 0。含被动末次、取消/拒写、重载、死亡/放弃、旧记录不补造历史；既有 96 组能力对照与 11 组真实 SaveManager 迁移/集成检查通过。
- `TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/inventory/check-inventory.ts`：exit 0，9 组所有权与原子性合同。独立 QA 另核对两种被动的 14 个结算后装备/丢弃/下趟/末次/新记录状态，无阻断。
- `npm run build`：exit 0，包含 TypeScript 检查。保留既有大于 500 kB 的 chunk 提醒，本轮不声称加载体积优化。
- `git diff --check`：通过。最终只提交本迭代文件，独立 `CLAUDE.md` 不纳入。

原始执行输出：[专项](artifacts/iteration-31/focused.txt)、[恢复](artifacts/iteration-31/recovery.txt)、[目录](artifacts/iteration-31/catalog.txt)、[库存](artifacts/iteration-31/inventory.txt)、[构建](artifacts/iteration-31/build.txt)。这些是确定性夹具与正式领域代码的验证，不是自然取得物品或长期经济体验。

## 浏览器有限验证

Chrome，固定 960×640 逻辑画面，localhost:3027。用户 127.0.0.1 的现有在途记录未重置、放弃或改写。

### 修复、备行与归来

使用 `/ui-review.html?sample=world#purif` 的正式场景/面板和显式夹具。该旧 UI 验收页采用隔离内存并替代 save/load/commit，用于交互和布局，**不能作为持久化成功证据**；真实保存链由上述自动检查和下节页面另验。

1. 完整度 70、7 薪柴：End 选择全部后为 98，份量示例 1/2/5 不变；正确提示从当前需 8、尚缺 1。不把连续倍率小涨写成实际所得增加。[截图](artifacts/iteration-31/repair-below-threshold.png)
2. 互换+共振+单笔额度 6、储备 3：核心修复 70→88，份量示例 1/2/5→1/3/6；下一门槛总费用 2，作用来源正确。鼠标确认后 88/储备 0，额度提示消失。最长龙文案初验使动作越界，已修为按面板高度约束顶部；最终面板底 900.7，小于逻辑根物理底 922，动作与键提示均可见。[截图](artifacts/iteration-31/repair-swap-bonus.png)
3. 足额修复：储备 85、完整度 70，End 选 8；Enter 后 100/储备 77，份量 1/3/6 与预览一致。零储备时增减与确认禁用，阈值缺口仍正确。100 以上只增承压余量，浏览器受控样本 100→145，份量不变；115 上限另由自动检查覆盖。
4. 正式备行入口实际走 `PurificationScene → inventory-presenter → inventoryPanel(mode=prepare)`。新条件行在装备下、筛选上，显示装置的混乱增速/每堆份量示例/装置的初始混乱（混乱两项明确为装置贡献，不混称含成长抗性、残余的最终条件）；catalog 与 Rift 模式不增加该行。27 件夹具保留至少两条完整列表项及固定出发 footer，长详情实滚到底（scrollTop 175 / scrollHeight 305 / clientHeight 130）。legacy loadout-panel 不在生产路径，本轮未修改。[滚动实帧](artifacts/iteration-31/departure-conditions.png) / [最终标签实帧](artifacts/iteration-31/departure-conditions-final.png)
5. 归来生产面板明确显示“本趟伴随 / 整趟生效”、名称、容量 +8 和消耗 1 趟，返回可用。此处为固定结果 DTO，用来检查呈现；事实生成、消耗次数及合法性由正式库存专项另验。[截图](artifacts/iteration-31/passive-result.png)

### 新记录替换与保存失败

使用 [真实存档验收页](interactive/iteration31-record-review.html)，实现为 `src/dev/iteration31-record-review.ts`。该页仅替换 Storage 后端为页内 Map，**不替换 save/load/commit**，实际运行 gameConfig、菜单、会话和净化点；按钮公开构造受损/未来版本/拒写条件，刷新清空页面夹具。

1. 无法解析记录：主菜单新游戏进入确认，默认保留；Esc 返回，原字节不变，成功/尝试写入 0/0。
2. 未来版本：同样先确认，默认 Enter 保留，原字节不变，0/0。
3. 开启拒写后明确确认替换：进入生产净化点时第一次完整写入失败，0/1；旧字节仍逐字保留，候选新局暂停并提示旧记录保留（最终文案为“新记录尚未保存，存储中的原记录仍保留。”，避免把坏记录承诺为刷新后可加载）再次重试失败为 0/2；关闭拒写再重试，1/3 写入完整新纪录并恢复场景。[失败截图](artifacts/iteration-31/new-record-write-failure.png)
4. 净化点暂停菜单：注入受损字节后选择新游戏，Esc 保留并返回暂停，0/0；再次明确确认后成功进入新局并完整写入一次，1/1。不是取消就清空、也不是先删旧档再写新档。
5. 两个验收页最终 warning/error 控制台为空。

## 审核修正与边界

独立复审捕获“确认后先删除旧档，首次写失败会丢档”的漏洞，已改为保留原字节、候选新局冻结、完整写成功才替换；拒写与重试实机已覆盖。还修正了不足 100 时因整数平台期无下一门槛而误称“效能已满”、最长修复文案越界，误将 legacy loadout 当正式备行入口，以及混乱的装置贡献误称最终出击条件的问题。Rift 初见背包键提示 B→Tab 已同步。

本轮实现合同与上述有限验证完成。未把隔离夹具冒充新档自然完整周转，未证明所有目录的长期价值、22 步经济节奏、声音体验、全平台性能或最终审美。I28 A7/D4 扩大采样/长期平衡仍挂起；四A持续供给未验、四B未解锁；I30整体动态与手感不由本轮代签通过。游戏状态基线仅记录来源变化，不升级历史验收。

索引收尾：全貌文本更新至本轮，legacy loadout 明确登记为保留旧实现；历史证据及可访问性未评审提醒保留。来源基线更新覆盖已核对游戏来源；`CLAUDE.md` 指纹保持 HEAD 已提交版本，以免将独立未提交框架工作混入本轮基线，所以当前工作树检查仍应显示该单项漂移。离线 HTML 地图未重新生成，当前文本 INDEX 已刷新。
