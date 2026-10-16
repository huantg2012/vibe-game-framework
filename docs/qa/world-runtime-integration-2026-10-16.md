# 世界构型与怪物材料接入 · 2026-10-16

状态：本轮限定范围接入完成，完整生成／冷恢复和四图浏览器功能检查通过。性能预算与正式游玩体验仍未结案。

范围：余烬脊、晶化林床、破膜盆地、吸光釉原的已认可构型；晶化林床／破膜盆地的真实类人和菌毯占漆。用户明确其余世界保持现状。关联 COH-F011/F012/F013/F014/F015/F016/F017/F044/F052 与存档／出发依赖；本任务不代表全108世界推广或I14/P49结案。

## 实现与范围

四图注册开启 r13，使用完整作者CSV与共享矩形拼合／自由断缘编译器直接生成，次级宽地块随初始构型一起定义，不在成图上补孔。三档共用认可的中档完整物理母体，固定几何seed20261012与认可出生位置；实际请求seed控制内容、撤离与怪物个体。破膜完整母体等比0.8，未删除母体构件；四图宏观地块保持。

晶化林床和破膜盆地由CSV真实投放 `human_remnant`／`fungal_mat`，分别在巡路计算和Host烘焙之前确定类型。原各档AI／Host数量与职责保留，使用对应原生类型行为：类人相对原有机残影的速度系数0.7→1、预备700→350ms、冷却1600→1200ms、攻击范围36→38、半角75→60；菌毯使用colony／cluster、可攻击核及相应群落活动，不能将本次描述为“所有战斗参数不变”。依据为既有 `contamination-body-profiles.csv` 和合法污染形式，不新增行为覆盖层。

冻结配方同时保存完整构型、断岸、材料、实际敌人形式和内容认证库。肩灯／地表局部灯与真实FOV接到实际怪物渲染；受光不扩大视野，渲染不改变权威危险格。其余104世界的新配方仍为r11，旧存档依原修订恢复。

## 已完成验证

- **四图三档完整生成与JSON冷恢复12/12**。余烬／釉原见[六份最终报告索引目录](artifacts/world-runtime-integration-2026-10-16/production/)；晶纤／破膜见[六例真实投放报告](artifacts/world-runtime-integration-2026-10-16/production/enemy-deployment-six-cases.json)。包含真实资源／敌人／Host和原G1–G4要求，不以纯剪影替代内容准入。
- **两世界真实投放6/6**：各档AI为2/3/4、菌毯Host为2/4/6；完整20px身体巡路、菌毯全形体支撑、权威危险域并集且无重叠、2–3核额度通过。清空当前敌人目录后保存配方完整重放通过，来源在测试前后未变。
- **其他104世界三档312配方与独立旧r11工厂逐字一致**，显式r12开发路径隔离、缺失／篡改字段拒绝。见[最终生产合同报告](artifacts/world-runtime-integration-2026-10-16/production/rupture-seed82-final.json)。旧r11公开恢复3/3另使用历史Git oracle逐格／地表四通道／翻找前后对比，保留原有效seed及attempt：[旧局报告](artifacts/world-runtime-integration-2026-10-16/recovery/r11-public.json)。
- **24个完整内容候选认证**：12个世界／档位各有2个不同撤离点，记录有效内容seed。运行时前7次请求seed派生、最后槽从冻结认证库按请求seed选择；全部G4仍重验，8次／60秒上限不变。输入身份包含实际几何、内容和敌人，修改任一相关源使旧证书失效；清空当代目录后12份冻结合同仍可验证。见[认证摘要](artifacts/world-runtime-integration-2026-10-16/production/certified-content-bank.json)与[独立审查](artifacts/world-runtime-integration-2026-10-16/production/certified-bank-review.json)。
- **受控真实渲染挂载**：2类人、4占漆（geometry v1/v2），冻结材料、当前灯位、部分FOV、危险接触格、inactive Host与纹理释放通过。局部光原先穿VOID的问题已修复，横向／反向／两种斜角／界外／动态灯位反例通过；肩灯slot0遵守地表既有例外：[材料检查](artifacts/world-runtime-integration-2026-10-16/production/material-receivers.json)。既有占漆90形体／324帧、48部分FOV帧及旧v1危险格回归通过：[日志](artifacts/world-runtime-integration-2026-10-16/production/paint-regression.log)。
- **构建与来源一致性**：`npm run build`、两类CSV生成检查、四图构型生成检查通过：[最终检查](artifacts/world-runtime-integration-2026-10-16/production/final-checks.json)。Vite的大chunk警告保留；项目无lint脚本。

## 实测发现与修复

原投放链固定为 `organic_remnant`／`oil_film`，而新材料分支只接受类人／菌毯，导致样片可见而正式任意种子都不出现。已改成冻结真实投放合同，并在上述六例中验证实际形式、形体和危险域；未用渲染标签伪装类型。

破膜中污染seed82正常出击曾8次内容拒绝：资源或完整路线不满足，原失败保留在 `rupture-browser/report.json`。新增最后槽认证内容后，同一seed第8次成功，JSON冷恢复签名 `56b73b45`：[回归](artifacts/world-runtime-integration-2026-10-16/production/rupture-seed82-final.json)。没有放宽路线阈值或减少部署。

离线认证曾在釉原low seed42耗满60秒，诊断器反复序列化累计大报告造成资源压力；改成每候选诊断单独写一次。独立新进程正式生成及冷续通过：[釉原seed42](artifacts/world-runtime-integration-2026-10-16/production/ivory-seed42-final.json)。不据此修改运行时准入门或宣称任意设备必能入场。

## 浏览器实测

四图新源的中污染实测均通过：

- [晶化林床](artifacts/world-runtime-integration-2026-10-16/final-browser-crystal/report.json)：请求seed156，入场13.727秒；真实3类人／4菌毯，正常键盘接近后两类可见。实际活动肩灯、共享灯桥、FOV／VOID裁切、身份／个体seed／冻结材料及玩家全身位置冷续一致。
- [破膜盆地](artifacts/world-runtime-integration-2026-10-16/final-browser-rupture-82/report.json)：同一失败请求seed82，最后认证候选有效seed2957726398，入场21.126秒。真实3类人／4菌毯均有可见样本，类人为FOV边缘alpha0.2，菌毯约205非透明像素；未将部分可见记为强主灯近景。冷续保留身份、材料与位置。
- [吸光釉原](artifacts/world-runtime-integration-2026-10-16/final-browser-ivory/report.json)：请求seed274，入场7.636秒，无本轮怪物材料／投放覆盖；实际按键移动及身份／全身位置／世界历史冷续一致。
- [余烬脊](artifacts/world-runtime-integration-2026-10-16/final-browser-cinder/report.json)：请求seed92，有效seed2546585388，入场9.115秒；实际按键移动与身份／全身位置／世界历史冷续一致。

方法边界：为覆盖指定世界，在游玩前选择固定请求seed，目的地仍由正式启用池决定；备行入口由场景方法打开，其后的选档、整理行装、出击、移动、暂停退出及续玩使用真实控件／输入。接近辅助只读实际地形／目标，使用正常按键；没有改写地图、角色／敌人位置、生命、灯、FOV、战斗或时钟。此为受控入口覆盖，不是自然整趟搜撤或经济采样。四例均无console错误／警告／HMR；实际帧已审看。

原晶纤初轮材料未出现、破膜seed82失败的报告仍保留，修复后以上报告独立落盘。长任务实际达到163ms（晶纤）、128ms（破膜）、73ms（釉原）和404ms（余烬冷续），**50ms预算未通过**；功能检查的PASS不覆盖这一项。

## 限制

样片认可与工程验证不代签正式游玩的审美、战斗平衡或整趟搜撤体验。固定认可骨架不等于已验证任意新几何。CPU怪物受光与地表共享灯及遮挡，未声称specular／emission全部shader数学等价。既有浏览器记录出现超过50ms长任务，本轮不据构建或有限样本宣称I14性能预算通过；本次不扩展到其余104世界。
