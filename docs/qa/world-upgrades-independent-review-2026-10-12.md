# 世界构型与拾取残骸全推广：独立实现复核

审查者：Design 子代理 `/root/upgrade_design`。审查范围为本轮 r10 与 r9 恢复分流、材质证据链和全量注册集合；只读审查其他代理实现，未代改。本文不是本代理作者地图的独立美术验收，也不是全部种子测试。

## 结论

当前未发现可复现的 P1。发现一项 P2 材质证据失效漏洞，root 已修复并通过独立复核，P2关闭。最终冻结源已核对108/108注册，corrected全源26组324/324有限案例通过；运行预算主线收尾，不等于人最终验收。

## P2：材质输入变化可能错误复用历史烘焙图

发现位置：`tools/world-upgrades-rollout/check-current-evidence.mjs` 原17–21行。原逻辑只核部分烘焙代码哈希和现地图几何/出生撤离/searchSites，没有比旧recipe的appearance/material身份，也没有记录实际送sharp的PNG字节。单独改变材质组织、贴图或增益配置，可能仍以CURRENT passed复用旧material.png。

root修复：

- `check-batch.mjs`读取PNG一次，对该bytes计算SHA，并将同一bytes交sharp；结果写入case.materialHashes。
- 新`check-material-provenance.mjs`将当前18份PNG和5份材质/appearance定义与固定Git `17476a4e`逐字节比较，生成独立追加证明。没有追写旧receipt，也没有把此证明描述为历史时刻实际采集。
- `check-current-evidence.mjs`核每份旧receipt原sourceHashes里的定义、当前定义、当前PNG；优先direct batch capture，旧报告明确标注fixed-Git additive proof。已有recipe精确比appearance、package.materials、nativeDefinition。

独立复核：阅读上述具体实现，独立运行材质证明工具至`/tmp/coh-independent-material-proof.json`，18 PNG/5定义均通过。材质输入漏检路径已关闭。

补充问题亦已关闭：实现现只剔除五个显式路径（spatialPolicy.sourceHash、spatialPolicy.fragmentShape.sourceHash、spatialPolicy.deployment.sourceHash、searchSitePolicy.sourceHash、package.dependencyHash），其余完整recipe deepEqual；报告逐项列变化路径，并明确不是身份等价。独立提取并执行该实际normalization函数：显式hash变化可忽略，peelPreference语义变化和非白名单嵌套sourceHash均保留可检出。另读取shard-full-recipe-bound.json三档passed，变化路径明列为空间/fragment/package来源哈希。结合18 PNG/5定义独立验证，P2关闭。

## r10 / r9冻结恢复

已逐项阅读当前diff：r100-package、r100-production-map、r100-native-data、search-site-placement、surface-bake、search-site-bake及r9投影脚本。

- 新grounded-search包明确生成revision10，校验与dependencyHash含revision10。
- revision9 recipe validation、generation、hydrate、search-site validation、surface bake和patch bake均显式路由封存执行器。
- r10原位剥离来源增加真实原形成面查询，排除共用object ID的附加岸面；r9保留原行为，不把修复偷偷写入旧包语义。
- 独立运行`node tools/recovery/project-native-r100-revision9.mjs`通过：封存executor SHA与manifest.executorSha256一致，108 ID精确集合一致，imports为空。注意entrySha256是构建入口文本哈希，不能误当executor文件哈希。
- 读取既有`legacy-r9/replay-before-expansion.json`与`replay-r10.json`，各8例passed，涵盖六r9与两r8；这是既有固定Git捕获的完整map/material/patch恢复证据，本审查未将其冒写为新跑结果。

未发现遗漏的9/10分流或可证明的旧档迁移破坏。范围不包括所有历史存档、所有污染档/种子组合。

## 注册与排产集合

作者计划B03–B25：100唯一world ID、23批，每批2–5；原六与B02两图补足108。原native目录和r9冻结成员均108。

审查快照：fragment/search注册各96且集合相等；上一91快照同时核sectors一致，无重复或未知ID。其他代理仍在执行余批，因此最终108注册及324档位格覆盖须在收尾再核，当前不能用规划总数代替实现总数。

## 与作者批次有关的技术证据边界

本代理B14/B17/B20/B23共54例生产全部通过，并逐例核`originalMeshFootprints.clipped=false`。此前Wax等截断已保留失败/旧诊断并独立复验，未覆盖历史证据。该事实是有限seed20261012三档技术检查，不是独立审美批准。后来的batch门已经将新增世界无意主体截断设为assert，而非仅诊断。


## 冻结源终轮复核

已在root通知B24/B25作者完成并冻结后重新读取全部表：fragment/search-sites/sectors各108行且108唯一ID，三表均精确覆盖native108，无缺失、未知、重复。世界绑定108个独立layout ID，定义108齐全。按每布局land/void的坐标和尺寸规范化排序，完全重复构型为0；未将此提升为近似/旋转复制的穷尽判定或美术批准。B03—B25排产100唯一ID、23批、每批2–5，连原六+B02两图总108。

最终类型修复已读具体diff：`R100SpatialAuthoringTables`只新增interface；codegen输出增加`import type`与显式schema注解，仍对同一value执行同一JSON.stringify，未改变CSV值、排序、sourceHash公式或运行分支。修复全登记后空AUTHORED_GROUPS推成never、organization窄字面量等静态类型问题。独立运行codegen `--check`通过。Typecheck PASS由主线执行并报告，本复核没有重复冒记为独立新跑。

当前未留可操作P1/P2，材质证据P2已保留发现与关闭链。最终生成、旧局与实机主线验证仍执行中；本报告只确认冻结注册集合、类型修复无行为改动和已说明的有限证据。


## Corrected全源终验更新

独立只读打开`current-final-corrected/summary.json`及其26份子报告：status=passed、108世界、324例，子报告实际累加324/324通过，changed为空。未重复执行重检查，也未把读取既有证据冒写为新生产。

另独立比对Shell Causeway旧`b10-attempt1`中档几何与当前CSV：三实例y差均−30，当前y为1127.5/965/1215；`b10-shell-footprint-fix/report.json`低/中/重3例均通过、原主体clipped=false。早期低/重漏检作为历史失败保留，最终corrected覆盖修后源。

作者交付、完整注册和有限全源复核现已完成；本审查没有剩余P1/P2。运行预算由主线继续收尾，人审未签、全seed未作覆盖声明。


主线收尾补记：最终三代表重污染各约61.26秒运行预算已通过，范围和共享参考机限制见[专项QA](world-upgrades-rollout-2026-10-12.md)；此补记不改变独立审查范围或代签用户终验。
