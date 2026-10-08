## QA Report: R100 I10–I12 收口准备独立核查

日期：2026-10-07（Asia/Shanghai）  
Spec / Task Brief：`docs/tasks/rift-r100-i10.md`、`rift-r100-i11.md`、`rift-r100-i12.md`；`docs/qa/rift-r100-i10-i12.md`；原冻结 `qualification-plan.json`、最终产物契约及恢复补充。  
代码版本：`b7437eb7bf467fc811f3075334c1843940b53d1b` 后工作树；逐项身份以同目录 JSON 收据的 SHA 为准，不能只按 HEAD 归属。  
Feature IDs：COH-F052；相关 COH-F044、COH-F005。  
环境与入口：仓库文件、原冻结源清单、内容归档、已有恢复收据；未启动浏览器或游戏。  
证据类型：源码静态核查；独立 SHA / 引用 / 逐文件清单核算。已有恢复过程仍标为历史执行，不改称本次重跑。  
覆盖与限制：当前35源归档完整性通过；最终108源、真实运行、最终绑定与迭代结案仍待实际产物。本报告不签游戏、美术、自然经济、性能、声音或人审通过。

### 发现的问题

| ID | 类型 | 严重度 | 描述 | 位置 | 依据 |
| -- | ---- | ------ | ---- | ---- | ---- |
| QA-CLOSE-01 | 工具可复现性缺口 | Medium | 最终 binder 对历史11组 generation 仍读取原临时目录中的 QA `.ts` 源；原35源归档明确不含这些执行器。已按原 SHA 补存2份独特字节并生成11组映射，仍须 Code/root 的窄消费分支后才消除 binder 临时依赖。 | `tools/qa/r100-bind-i10-i12.mjs:337`、`:357`；`historical-generation-harness-supplement.json` | 原失败/证据身份保留、来源持久化与最终独立复核 |
| QA-CLOSE-02 | 历史说明已过期 | Low | `final-binding/contract.json` 旧说明只列 production/equivalence 两类绑定；当前受审 binder、draft、runtime补充明确要求四类及独立Shader收据。保留旧件，最终新plan与报告按四类表达。 | `final-binding/contract.json`；`tools/qa/r100-bind-i10-i12.mjs:151` | `final-artifact-contract.json` revision 3 |

没有从本轮静态归档核查得到新的产品缺陷结论。计划结果尚缺是验收待执行，不按产品 Bug 登记。

### 通过的检查

- `initial-archive-audit.json` 独立重算全部1,629个对象的SHA，核对35个原manifest→snapshot映射、48,401个文件条目、相对路径、大小及必要目录。索引仍为 `fc28c21561bcffbba8aeeaecf46327a9a83ca98140f7771c8dc0726f461b5676`，对象共226,553,896字节。
- 已有恢复收据 SHA 与checkpoint精确匹配；35次新目录恢复行逐项对应归档，合计核验6,294,884,747字节，文件/目录mode也在原执行中复核。该过程不读取原源、不启动服务。本次没有再次写回这6.29 GB。
- 归档工具读取原字节、不改原manifest；对象内容寻址、已有对象拒绝错误字节；新索引保留父SHA，恢复要求新目录，拒绝错manifest映射、路径穿越和符号链接。原 `contracts-final.tap` 实际记录20通过、0失败（checkpoint正文的19是旧计数）。
- `historical-generation-harness-supplement.json` 从11组原generation依赖核对两种harness SHA。22个现存同名候选无匹配，按授权从原临时源复制精确字节，复制前后均一致。未改历史binding、manifest、raw、summary或编译执行器。
- `historical-harness-archive-supplements.json` 为这两份补充件提供工具现有格式的权威JSON pointer，可与原package-lock补充项一起纳入最终归档新索引。它们不回填旧manifest闭包。

### 最终产物尚需核验

1. 新56世界原336过程汇总与独立过程/正常图审；B13原003网络异常、原失败和同身份补验单列。与旧52原312过程及7488生成的限定连续性保持分账。
2. 仅56个enabled字段变更及codegen后的324配方逐项精确证明；实际最终108源和包、当前3121至最终源连续性；归档追加该源并对新完整索引逐文件恢复。
3. 最终源31项恢复套件、三档污染与冻结配方等4份窄合同；保留r2–r5执行器/分派的源SHA连续性，不能用342浏览器等价代替旧恢复。
4. 108启用池每策略32768选择样本；324正式进入/冷续及完整Worker观察；342浏览器等价；四条真实积累分支各12趟自然连续与独立体验复核。
5. 最终冻结源1536能力、15552呈现受控合同；不扩签GPU、实际画面、自然过程或听感。
6. 独占CPU/Chrome的108重档各至少60秒；10同图+324混合重建及12份预热/GC样本。Shader需要root逐项所有权解释，数值通过不代签。
7. 最终108行正常美术/包身份索引、技术收据、四类运行source-binding、Shader收据与完整连续性图；先只读proposal，再由root决定写台账。binder不消费的自然48、selection、受控矩阵、声音工程连续性由root另核。
8. R100-R10实际听感仍留I14发布阻断；I13长期经济、I14弱设备与人审不在此轮获豁免。I11/I12 `state=planned` 为前序结案闸门，执行状态单列，不为显示“进行中”而破坏先后约束。

### 准确命令入口

恢复套件与四合同只在root分配的单CPU窗口、最终源哈希冻结后顺序执行，保存原日志与exit code，前后比对所有实际runtime源与harness源。共同环境：`TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json BROWSER=none`。

```sh
npm run check:rift-recovery
node --import tsx tools/world-study/check-r100-frozen-chaos.ts
node --import tsx tools/world-study/check-r100-frozen-recipe.ts
node --import tsx tools/world-study/check-master-pollution.ts
node --import tsx tools/world-study/check-r100-revision6-contract.ts --organizations --extended-profiles
```

最终只读绑定命令（所有真实产物及所需新工具分支齐备后）：

```sh
node tools/qa/r100-bind-i10-i12.mjs --plan docs/qa/artifacts/r100-i10-i12/final-binding/plan.json
```

该命令不带 `--write`；本QA不写进度总台账，不提交或推送。新源归档后用 `r100-source-archive.mjs verify --restore-all` 写入新收据路径，保留所有旧索引/收据。

### 建议

继续原固定过程与最终源准备；Code/root消除QA-CLOSE-01后核验反例（错SHA、错组、漏组、重复或错source均拒绝），再进入最终proposal。不通过任何一个必需真实过程时保留失败并单独诊断；不以已有历史数值替换当前最终结果。
