# 裂隙空间推广验收

2026-10-11。范围：DEC-197，COH-F011/F012/F013/F014/F005/F044/F052。用户通过的是 `4459d7c3` 的余烬脊代表空间并授权推广；本报告记录正式修订7的新证据，不把该人审扩写成108个世界终验。

## 交付行为

正式新出发使用2304×1792地图，边界、实体、支撑、污染、搜取与撤离使用同一份生成结果。撤离从完整身体可达图的多个空间区和距离层抽取，排除出生附近，不固定最远端。未知撤离不在小地图或穿雾光中泄漏。

20个成群材料世界使用三种宏观组织。88个作者世界保留完整关系组：86个统一仿射，单柱和压纤四角各有独立布局。原实例数量、形体、角色、材料、朝向及原VOID关系保留；9个原通海裂口世界准确合并新岸，原cut丢失面积为0。

奖励、敌人数、混乱曲线与巡逻速度不改。大图按实际身体路线安排Host和翻找成本；非safe窗口必须在出生连通分量内。原在途修订1–6保持旧生成；修订6由固定提交封存，修订7保存完整空间与部署策略。

## 已执行证据

证据根：[r100-spatial-rollout-2026-10-10](artifacts/r100-spatial-rollout-2026-10-10/)。各JSON附具体样本与源码身份，不能跨不同批次混称同一稳定版本。

- 作者关系：`authored-group-identity-bays.json` 258/258；`authored-shore-union-bays.json` 86组578个严格不相交岸线polygon，9个海口世界保源合并。两个special另见 `special-organizations.json`。
- 复杂实建：`authored-representative-routes.json` 15/15，`authored-boundary-routes.json` 27/27。完整20px身体可达≥97%；两组独立阻挡都须形成≥1.25倍且额外≥120px最短绕行，并各自两侧可通。低实体占比不是失败，壳体/纤维另有9例实走图证据。
- 原始地形合同：`source-ground-contract-regression.json`，52世界/465精确mesh/156 erosion、3600身体座位、13764扫掠、43拒绝反例通过。扩大地图的边沿三角上限16384，原图仍2048；早期浅岸并集曾临时扩至48顶点；最终岸形不再需要，现恢复所有尺寸32顶点上限，严格拓扑检查保持。
- 撤离选择器：`selection-check.json`，8出生×128种子的1024选点与170473独立扫掠段通过。这是同一代表地形上的选点分布检查，不是1024份完整世界。
- 巡逻窗口：`patrol-window-reachability.json`，独立三孤岛反例证明新图排除不可达翻找席位；无过滤旧行为与全可达过滤行为保持。
- 旧保存：`revision6-compatibility.json`、`revision6-live-router.json`，324旧配方及8代表三档的完整payload/原生数据/四张RGBA等价；公开恢复路由另测。冻结文件包含旧材料和组织来源，不能读今日数据重生成旧局。
- 全库完整生成：`production-bays-a.json` / `production-bays-b.json` 各162通过、零失败，合并`production-release-summary.json`核对324唯一世界/档位（种子20261010）。完整身体可达最低99.284%；撤离最早可交互路线最低923.176px，直距最低568.169px；每例至少8候选区域、3距离层和2组独立真实绕行。285例首候选成功，31例第二、4例第三、2例第五、2例第六；不把重试后的通过冒充全部首抽成功，也不将含独立QA的generationMs当帧时或纯生成耗时。
- 正式渲染：`browser-release/capture.json`14个代表中档实际生产Worker/RiftScene的去雾全图及正常入口通过，未知撤离可见度0且未标记已知；独立图审发现woven低床材质近景问题，专项修复见下。`near-monolith-frame`普通输入走近，正常肩灯下主体两前足/连续可走床与侧口延续清楚；这张图不证明实际走穿侧口。
- 正式入口/冷续：`entry-release/report.json`三档自然选择的世界均通过（chalk-steps低、scalloped-reach中/重），备行两阶段、正式出发、暂停冷续后同身份/位置/撤离，唯一visit，未知退路不泄漏，浏览器错误0。出发24.37–36.84秒、续局28.73–35.12秒，属于有其他测试并行的本机样本，不是独占机器性能基线；生产60秒截止未改。
- 完整受控搜撤：`journey-release-low`（ash-strata）、`journey-release-medium`（cleft-tableland）、`journey-release-severe`（pale-sail）均以正常输入完成safe翻找→实际发现退路→撤离；保持真实生命、混乱、敌人和雾。路由可读全图，这是流程集成证据，不是无地图信息的新手搜索实测。
- 资源回收：`gpu-release/report.json`六材料预热、2次同世界重建及6次混合重建归返通过；它绑定材质修复前快照。最终`gpu-material-release/report.json`单独覆盖新增岸壁bitset的woven，4次同世界重建加一次归返，WebGL/Canvas共享图像增长最大-25,344字节，JS及backing合计增长最大1,071,774字节，均在原10MiB上限内。后一批混合重建数为0，工具固定label“after-mixed-return”不表示本批做过混合世界。GPU-process总量为Chrome分配器账，不是独占物理显存。
- 材质修后的一批`npm run build`通过（TypeScript＋Vite，Vite阶段52.14s），保留既有大chunk警告；当时代码依赖70项、r7五快照/七类当前数据变更隔离通过。性能优化后的最终构建与76项收据见后节。
- 材质修后运行预算首批 `runtime-release/report.json` 计划7例、实际完成5例测量：ash/pallid通过，crystal/ivory的帧时与CPU、cinder的材料阶段超门。pallid测量已通过，但随后测试浏览器context.close挂起，终止自有测试Chrome后本批记failed；silt/woven未测，不计通过。完整原报告保留。
- `runtime-profile-crystal`是因果诊断而非预算资格：1843帧、61.43秒；V8中身体碰撞resolveMotion约占主循环59.6%，角色遮挡占afterUpdate约93.8%；shader提交和纹理update各p95约0.1ms。原包装器sceneUpdate为0样本，不使用该空阶段；其他阶段及V8有效。诊断时电池20%且系统低电量模式开启，尚不把约30Hz调度归因成已证实的外部上限。后续仅优化碰撞与遮挡计算，不改玩法或预算。

## 排故记录与验收边界

初始“每世界复制20实例”的方案被独立美术否决：字段保留不等于构图保留，单柱、双幕、四壳和交叉纤维关系会被抹掉。现已改为作者组整体变换。`all-worlds-first.json`保留104通过/21失败后主动停止的首轮诊断；solid占比筛查误报与真实断连分开处理，不删除失败报告。

`browser-first`是早期QA读取表面缓存失败；`browser-final`是开发中途的12成功/2失败发现批次，目录名不表示最终通过。HMR干扰和临时服务路径失败的journey也留档。`browser-stable`因外轮廓仍像矩形而停止，55份完整地图的成功记录同样仅作发现批次。四大切角的`browser-corners`仍读规则八边形，经图审继续补错位侧湾。稳定浏览器验收使用复制的src/data、关闭HMR的专用服务；`source-snapshot.json`绑定实际源码，静态资产与依赖只读共享。

完整路线测试读取静态全图用于自动导航；最终移动控制为requestAnimationFrame内发送DOM键盘事件、经正常Phaser输入，翻找与撤离由CDP按键完成，不修改生命、敌人、时间、视野或奖励；它证明流程接通，不证明新手找出口的体验或长期收益。三档自然随机正式入口/冷续另行检查，准备面板通过现有场景方法打开，不冒称实走净化点。

弱设备补测已获用户豁免，仍记未测。新地图不能继承旧I13经济结论或旧I14全库性能；有限样本不证明全种子、总体拒绝率、长期经营、全部视听疲劳或108世界用户终验。

近景输入的首轮CDP调度90秒超时保留于`near-woven`；最终逐帧键盘控制器仅改变测试输入节奏，无游戏状态/时钟改写。`near-woven-frame`确认低床粗格块后，修复了本体UV与附加海岸world UV被混合fit的根因。`woven-material-domain.json`证明原mesh/raster/layout和normal/response/emission字节不变，仅owner1的272,905个albedo像素变化；岸线域覆盖/清位与transfer去重已验，r6公开表面四RGBA等价另有证据。15个世界新增516,096字节bitset，沿原native/world/cache生命周期释放；实际外观改变仅woven1个世界。

修后浏览器三例：`browser-material-release`的cleft/shell通过，woven与首次近景因开发服务器冷启动期间的page.goto30秒超时未进入检查，保留原失败；没有调整生产Worker截止。缓存已热后`browser-woven-material-v2`及`near-woven-material-v2`均通过。`visual-delta-bridge.json`逐项核对新旧source-snapshot仅4个材质文件及manifest变化，三例正式重建的输入、spawn/extraction、指纹和部署指标相同；旧324几何/三档流程证据据此限定适用，而非声称在材质修后重复跑了324。最终正常肩灯图的美术结论归独立报告。

独立审查：[代码与行为](rift-spatial-rollout-code-review.md)、[实际图审](rift-spatial-rollout-art.md)。

## 大图运行热点的等价优化

`native-body-broad-phase.json`与`native-body-broad-phase-edges.json`覆盖7个实际r7和3个r6世界及合成边界，共10,544组查询逐字段等于独立封存旧算法；直接trace含法线、全段长冲刺、部分/完整豁免和VOID均保留。64px空间桶按完整扫掠AABB收集，bitset去重后仍按原三角顺序；最大新增338,348字节，沿原layout WeakMap生命周期。微基准只用于热点诊断，不授帧率通过。

`actor-mask-blocks/report.json`：650,790条行绘制命令、152,460像素查询等于原逐像素算法。原P48八个作者源尺寸世界39,757,776断言通过，不把它冒称大图；新增`actor-mask-worlds/report.json`在真实r7晶化/压纤大图和r6余烬脊核对9,063,948像素、13,074完整行。16px块最大高度严格保守跳过，无刷新降频；大图新增1,032,192字节，销毁释放，存档与生成身份不改。

`performance-source-bridge.json`与`performance-browser-bridge.json`记录新旧快照仅碰撞、遮挡、表现调用及生成来源收据变化；重新实建压纤四角的配方、metadata、几何/出生/撤离全部相同。76项来源收据补齐6个选择器直接依赖，不改变recipe.dependencyHash；几何/流程旧证据保留本来范围，运行预算单独复测。`build-performance-release.json`为这份源码的TypeScript+Vite通过记录，Vite23.14秒，既有chunk警告保留。

### 参考机器调度的受控核验

`runtime-lifecycle-blank.json`在无游戏的空白页记录约30Hz；首条settings页控制尝试发生测试Chrome崩溃、尚未改偏好，失败仍保留。最终`runtime-blank-battery-pref-profiles-v2.json`使用两个新建临时QA profile，在相同Chrome155、相同默认启动参数与同一电池低电量状态下，仅将浏览器`performance_tuning.battery_saver_mode.state`设为1或0：各15秒空白页分别451/901帧，p95为33.4/16.7ms；持久值与测试进程退出均核对。系统pmset与用户Chrome配置未改，也未使用解除帧率上限的旗标。

因此最终`runtime-performance-release`采用独立临时profile的浏览器节能关闭状态，按原7世界、重污染、种子20261004、十二段5100ms真实按键和原预算测量；这是正常60Hz调度的限定资格，不声称默认低电量节能状态仍有60fps。工具仅补充即时证据保存、15秒有界退出与测试进程独占清理，未调整玩法、计时或门限。

## 本轮收口

7个重污染代表各至少60秒正常按键运行通过原门，帧间隔p95最高18.5ms、主循环CPU p95最高10.5ms、材料/遮挡阶段p95最高2.5ms。身体碰撞和角色遮挡计算的修复通过等价与实际运行双重检查；原失败及环境诊断不覆盖删除。预算只代表所列7样本与上述隔离profile设置，不宣称默认低电量节能也有60fps。

最终新增索引的2世界预热与随后3次同世界重建资源回收复验通过，WebGL/Canvas backing增长最大0字节、JS及backing增长最大633,022字节，均低于原10MiB门；此批mixed=0，after-mixed-return为固定label，不冒称新增混合巡回。实际dump仍是Chrome分配器记账，不是独占物理显存；静态生命周期检查和真实重建证据共同限定此次新增数组的风险。

本轮空间推广已内部完成，见`release-disposition.json`；旧1–6保留原图，新出发使用修订7。用户通过的仍是代表空间方向，108世界人审、I14/P49其他待办与原较弱设备豁免保持各自范围。
