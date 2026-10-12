# 世界碎片与环境残骸全库推广验证

状态：108世界两项优化已正式接入，最终全源324/324复核、有限实机与三代表运行预算完成。基线为17476a4e，原六图保持为作者回归对照。范围绑定COH-F007/F011/F012/F013/F014/F019/F044/F052。

## 已有证据

- [固定旧局基线](artifacts/world-upgrades-rollout-2026-10-12/legacy-r9/baseline.json)：六r9及两r8，完整地图、残骸两态补丁及合成四通道。
- [接入前精确重放](artifacts/world-upgrades-rollout-2026-10-12/legacy-r9/replay-before-expansion.json)：8/8通过；后续代码变化后必须再次验证。
- [B02首轮](artifacts/world-upgrades-rollout-2026-10-12/b02-attempt1/report.json)：4/6，Monolith三档与Woven低档通过；Woven中重失败原件保留。
- [Woven真实来源反例](artifacts/world-upgrades-rollout-2026-10-12/b02-attempt1/woven-source-diagnostic-exact.json)：附加岸沿误归relief母体，真实主体距来源点442.27px；校验正确拒绝。修复不得放宽来源校验或移动原接合掩盖。

## 执行边界

作者批最多五世界，每图独立构型与原生关系复核。check-batch完整生产、原配额/风险、身体/VOID、未知撤离、JSON配方恢复与真实素材烘焙；其图片是albedo诊断，不是正常灯场实景。图审、实际输入实景、兼容与工程检查分别登记。未完成或失败结果不能用排产数量替代。

修订10已修复来源识别；旧r9固定执行闭包隔离，[8份旧局重放](artifacts/world-upgrades-rollout-2026-10-12/legacy-r9/replay-r10.json)通过。新生成完整资格仍按批次填写。216材料案例与8组接收/交互合同通过，均不替代浏览器实景。I14/P49、用户审美终验、自然盲搜与长程经营不因本次推广授权自动通过。

## 批次复核进度

B02—B25与原六图有效108世界／324档位，见[当前聚合](artifacts/world-upgrades-rollout-2026-10-12/coverage.json)。同例替代由`resolutions.json`绑定双方报告SHA256；保留最初失败及图审退回，不以改seed抹除。

新增原生三角足迹诊断发现部分旧作者主体被新缺地截角。排除附加groundEdge后，对真实三角做外顶点、边交叉和包含孔边检查；初次扫描保留`footprint-audit-first.json`。Cleft/Crystal/Pressed/Fibre/Reversed经最小整组位移（Reversed额外统一缩至94%）修复，15例通过；Pallid/RootCistern/Draped/Quilt与Wax在各自同seed复验中足迹归零。Quilt两个孔之间仅16px有效支撑的细条直接连孔删除，没有补地。原六图已认可的作者接岸单列，不追改其既有形态；此诊断不等于审美评分。

## 最终冻结与兼容

108个原生ID、fragment、search及sector注册集合精确相同，108个独立layout，矩形构型无完全重复。独立审查见[报告](world-upgrades-independent-review-2026-10-12.md)。全量注册触发空表被推断为never及策略类型过窄，已用显式生成表schema修复；未删除旧策略或修改运行数值。

[最终旧局8例](artifacts/world-upgrades-rollout-2026-10-12/legacy-r9/replay-final.json)通过：固定17476a4e的六r9及两r8保存配方完整地图、intact/searched patch、初始及翻后四RGBA均精确一致。spatial、fragment、pickup三项codegen --check通过，注册均108。

最终来源核对采用独立重跑的逐作者批生产生成，并核对原生定义、出撤点、真实来源、有效seed、几何指纹。复用的烘焙图必须绑定所有相关烘焙代码、材质配置和贴图字节；早期缺失贴图hash的原报告不回写，而由固定Git[材质来源证明](artifacts/world-upgrades-rollout-2026-10-12/material-input-provenance.json)补充。完整recipe仅排除五条明确的目录来源hash路径后逐字段对照，非身份hash等价声明。此项独立审查P2已修正并复核关闭。

## 正常镜头证据范围

[六材代表实际输入](artifacts/world-upgrades-rollout-2026-10-12/runtime/six-families/runtime-batch.json)六例通过，覆盖Crystal重、Ivory轻、Porcelain中、Pleated中、Pressed重及Wax轻；Wax经正式入口、暂停刷新继续保持身份、已翻状态与收入。另有[B02正常镜头](artifacts/world-upgrades-rollout-2026-10-12/runtime/b02/)两图。保留正常敌人、伤害、时钟、视野与实际WASD/E；全图仅用于诊断规划路线，不是未知盲搜测试。源快照分别封存，之后最终生成语义对照另列，不把混合批次冒称同一时点全量重烘焙。

## 最终复查发现与修正

第一轮最终全源复核保留在`current-final/`：Shell Causeway 的低/重档原生solid越过VOID，早期B10证据未包括新增精确三角门，中档未触发。修复只将原组整体上移30px，保留地形/空洞和组内关系；必须在新receipt中重跑三档，不能把旧报告改为通过。

近距VOID离线三代表各3个独立见证通过；[真实按键0→1→0](artifacts/world-upgrades-rollout-2026-10-12/runtime/sight-final-retry/report.json)覆盖Crystal、Porcelain、Gel Rafts中档，实际绕过空洞看见目标再返回被遮挡。目标为真实地面点，不伪装成拾取发现；未传送、修改生命、时钟或视野。首轮录像因缺Playwright匹配FFmpeg而在游玩前失败，安装匹配依赖后原条件重跑，原失败目录保留。

工程收尾：`npm run build`（含tsc）通过，Vite仅保留既有大chunk提示；三项codegen --check与图册完整性反例检查通过。有限324案例的部署最多使用3次尝试，不外推全seed重试尾部。`game-state`增量检查0错误、0未登记；2条历史警告与981项历史漂移未为本任务清空。独立CLAUDE修改不入本任务提交。


[修正后最终全源复核](artifacts/world-upgrades-rollout-2026-10-12/current-final-corrected/summary.json)：26个有界批次覆盖108世界/324档位，全部通过；所有src/data从开始到结束均无变化。原`current-final/`Shell两档失败保留；[新三档receipt](artifacts/world-upgrades-rollout-2026-10-12/b10-shell-footprint-fix/report.json)和`resolutions.json`明确替代早期B10图。最终图册324/324，重复0、资产/证据问题0，5个原始生产失败均有同例复验，未隐藏原件。

资源检查保留两层结论：原3同图+18混合的全GL严格相等检查失败（Texture 374→373），不改写成PASS；[owner专项诊断](artifacts/world-upgrades-rollout-2026-10-12/runtime/lifecycle-texture-owners/owner-diagnosis.json)定位少1为Phaser启动用1×1临时纹理，临时数量14→13，Phaser键287→287、包装纹理356→356、原生材质层4→4。其余GL拥有量相等，首轮保留堆增长约1.46MB、无页面异常；有限观察未发现游戏纹理缺失或保留泄漏，非无限运行/GPU驱动内存保证。诊断使用本地稳定源3027，原试验绑定3067固定快照，不冒称同一帧样本。


[最终独立美术复核](artifacts/world-upgrades-rollout-2026-10-12/art-final-review/README.md)已按24组逐图看完108中档全图和8个正常相机四状态，Shell新三档另补看，未见新增明确阻断。Cleft/Sentinel保留紧凑厚地变体观察；不要求全部世界共享同种深湾，也不以此扩大成自然发现性或用户审美认可。


[最终重档运行预算](artifacts/world-upgrades-rollout-2026-10-12/runtime/budget-final/report.json)三例全部通过：Crystal / Ivory / Shell各约61.26秒真实按键、正常敌人/伤害/时钟，帧P95分别17.3/17.6/17.5ms，CPU P95为3.4/3.0/3.3ms，材质提交P95为0.4/0.3/0.7ms。Crystal有一次83.1ms峰值，超50ms比例0.027%，仍在既有0.5%预算内。使用最终冻结源3068，独立QA临时Chrome关闭省电；系统与用户浏览器设置未改。共享参考机有限三图，不外推108世界全部性能或其他设备。

结论：两项已确认优化已正式覆盖全部108世界。工程/有限内部图审收口；用户审美、全seed自然探索、长期经营与I14/P49不因本次推广提升。无需新增用户决策即可交付本轮实现。

最后Shell作者位移后，再次运行[旧局8/8精确恢复](artifacts/world-upgrades-rollout-2026-10-12/legacy-r9/replay-after-shell.json)，完整地图/两态补丁/四RGBA保持。最终增量现状检查仍为0错误、0未登记，历史2警告/981漂移保留。
