# QA Report: 矩形碎片跨材料推广 B01 独立代码审查

日期：2026-10-12。审查基准：`c0b71d931f57fcad98e3ad40252dfb318f386d19` 之上的 B01 工作树。Feature IDs：COH-F007/F011/F012/F013/F014/F044/F052，接口影响 F005/F006/F049。

规格依据：[地图生成规格](../specs/system-map-generation.md#rectangle-fragment-authoring)、[当前推广任务](../tasks/rift-spatial-rollout.md)、[作者身份说明](../design-notes/rift-fragment-rollout-batches.md)。本代理只读 src/data/tools；只拥有本报告。游戏状态登记由 Director 汇总，不改共享索引。

## 当前结论与版本范围

**最终独立代码/数据检查未发现可确认的新增生产 P1/P2/P3；本轮发现的 QA-J01 工具 P2 已修复并按同地图同seed复验。** 最终源与证据复核见文末；艺术与实际运行预算结论分别归[美术报告](rift-fragment-expansion-art-2026-10-12.md)及[汇总报告](rift-fragment-expansion-2026-10-12.md)，代码通过不能代签它们。本文不将本批扩大到 B02 临时作者文件或其余102世界的体验验收。

本报告初次核查时，Splayed/Gel 的正式实图已被独立 art 退回。下列首轮检查继续保留其原版本范围，后续修订不倒改失败记录。

首轮核查对应生成文件 SHA256：

- `src/generated/r100-spatial-data.ts`：`67c41e5d613fb8e4fc0f1f1a0e407622f8e177982a2a07a4a1167e84135dc6fd`
- `src/generated/r100-fragment-data.ts`：`dc39c8b2ace41c4b0eab824ca6ce05730295ac2f70f7882dfb3cfc000cd79e46`

环境：macOS arm64、Node v22.14.0，`/Users/yilungao/coh`。独立执行的是构建、CSV编译一致性、注册反例、Git基线数据隔离及内存中的配方/实例检查；没有亲自操作浏览器或测量FPS。同行30图、旧r8恢复记录作为已审阅自动证据明确引用，不冒充本代理重跑。

## 已通过的独立核查

- `npm run build` 退出0：TypeScript与Vite构建完成，Vite阶段12.90秒。这个构建属于修订前的B01数据，不自动覆盖后续Splayed/Gel修改。项目没有 `npm test` 脚本；本轮使用具名专项检查。现有大chunk警告仍存在，构建通过不证明首屏大小、加载预算或性能通过。
- `codegen-r100-spatial.mjs --check` 与 `codegen-r100-fragments.mjs --check` 都通过。108世界仍完整注册；显式fragment注册为已有cinder加本批5项。没有只登记作者CSV却漏编译生成文件的差异。
- 独立逐表对照 `c0b71d93`：23张 `rift-spatial-*.csv` 中排除这5项及它们专属layout后的1101行精确相同，包含cinder的矩形、sector、出生候选与其他全部既有作者行。`git diff --name-only -- src` 仅两个生成文件；共享fragment-v1、运行时生成/恢复/视线/物理/材质算法没有本批修改。
- 五新配方均实际产生 `spatialPolicy.version=2`、`authored-sectors`、自己的layout、无镜像、无placement jitter。不是仅新增未调用的作者条目。
- source-once逐项按role/sourceIndex追踪源实体：Shell为4 solid+1 relief；Pale为2 solid；Gel为3 solid+1 relief。role、family、height、thickness、fold、branches、opening、distortion、constructionVersion、shapeProfile与groundEdgeWidth均保持。Shell的源中心(512,384)→(1250,1100)、1.2倍和Gel→(1200,900)、1.3倍位置/长宽/旋转关系由独立数值断言通过。Ash的18+3与Splayed的14+3为显式repeat作者结果，不能误称source-once。
- 独立运行 `check-spatial-registration.mjs` 通过全部**13个合同用例，其中2个正例、11个拒绝反例**。失败分支同时要求非零退出与对应错误原因，不接受任意崩溃充当通过。它只在临时隔离目录改CSV，不写生产作者表。
- `git diff --check` 通过。

## 工具和恢复证据审阅

[30例图与四层材质检查](artifacts/r100-fragment-expansion-2026-10-12/five-worlds-two-seeds-three-grades.json)确实覆盖5图×2seed×3grade；成功例30、失败例0。存在保留的准入重试，不能写成所有种子均首试通过。最低身体可达率0.9955783267827063；工具逐格比较冻结轮廓、8px matter、VOID视线与真实材质alpha，并比较同图同seed的三档地形。普通solid明确断言不吞视线。报告780份src/data源hash在独立审阅时全部匹配。

这份工具并没有独立断言全部内容配额和巡逻窗口，而是调用生产完整准入并记录部分计数。独立配额、巡逻、两侧阻行与Worker-wire恢复应由 `tools/spatial-rollout/check-production.mjs` 的实际结果承担，不能借用30例数量冒称已有该项独立证明。

[当前快照变更检查](artifacts/r100-fragment-expansion-2026-10-12/five-worlds-authoring-mutation.json)覆盖5新world的已保存配方与进程内作者变更，失败也以finally还原，不改CSV。它将未迁移102图×3档的几何/内容/外观输入与冻结r7精确比较，共306份；只忽略新的来源回执，不误称306张完整地图实测。

真正的跨数据变更旧r8证据来自[固定Git基线](artifacts/r100-fragment-expansion-2026-10-12/previous-r8-confirmed/baseline.json)和[新源码恢复](artifacts/r100-fragment-expansion-2026-10-12/previous-r8-confirmed/expanded-replay.json)：8份medium/seed20261012旧配方，含5新图、cinder、两个未推广特殊关系世界；逐份完整地图递归hash和albedo/normal/response/emission四图hash匹配。旧配方只有cinder携带fragment；新注册没有将其余旧r8局重新作者化。恢复代码消费保存的完整policy；新sourceHash进入新配方身份，旧policy不与今日注册表强制比对。

首轮旧基线alias隔离不足已保留，不作为最终依据。已向code核实：confirmed捕获启动前已加入固定Git目录的TSX配置realpath守卫，配置/stub也纳入Git逐文件hash校验；报告缺environment字段是该字段在进程启动后才补入。code的[捕获执行说明](artifacts/r100-fragment-expansion-2026-10-12/previous-r8-confirmed/capture-execution-note.json)保留对应命令与限制，明确不是自动进程日志，没有覆盖基线。当前8例map/RGBA一致不能外推浏览器冷续或全世界全seed。

本次审阅的 `final-registration.json`、`final-authored-groups.json`、30例图和confirmed恢复报告分别有110/16/780/784份来源hash，审阅时全部匹配。工具将失败退出与成功回执区分，未发现目前数据会被这组工具误判为绿的实质缺陷。注册初次反例构造错误（将整表layout_id改成同一个值导致先撞重复ID）已单独保留失败记录，最终只污染一行，属于已修复的测试夹具问题。

## 首轮留下的收口条件（后续结果见文末）

- Splayed/Gel新作者数据冻结后，重新核对CSV→code、非本批行隔离及本报告中的源hash；此前构建、30例、浏览器截图明确留作旧稿事实。
- 最终实际材质全图、正常视野隔孔/绕行、搜撤和运行预算由root与art负责；本报告不代其通过，不代用户美术终验。
- spec/architecture/游戏状态的“仅cinder、另107”是本次开始时的旧范围，Director需按最终实际结果更新为6已接入/另102待推广；不能提前把作者条目当验收完成。
- 世界注册增加不改变全库仍108、I14 13/14、P49开放和弱设备豁免但未测的事实。

该阶段没有将B01整批标为完成；两张图修订后必须按最终版本取证。

## 后续独立复核：正常输入 QA 工具

### QA-J01 · P2，搜撤脚本提前转角（工具问题，已修复并限定复验）

[Shell中档原失败](artifacts/r100-fragment-expansion-2026-10-12/journey-shell-medium/report.json)已完成真实E搜取，去撤离点时报告`Physical route blocked for5s`。该旧脚本没有记录实际阻塞点，不能由错误字符串断定游戏不可达，也不能伪称已知道实际卡在哪个角。

本QA用失败报告保存的完整旧配方独立重生成地图，signature仍为`22893556`，再用真实`nativeBodyCollision`与20px身体检查原规划路径。所有中心到中心段的grid/native sweep均为1；搜取后实际位置(1250.1783528782478,1536.7814471974725)也合法，到首中心(1252,1540)的sweep为1。因此**这例不是非法起步或地图中心路径不连通**。

确定的工具缺陷是`check-journey.mjs`允许距点4.5px便提前转弯，而路线只证明中心线安全。独立反例：允许在(892,1168.4)略过(892,1164)，直接走向下一点(884,1164)，真实native sweep仅0.2499875124999957；原路线共10处转角可用提前4.4px的合法到点条件构成碰撞反例。该结果证明工具安全前提不成立，不证明旧失败的唯一实际卡点。Code负责缩紧到点/轴容差、加入真实起步和路段扫掠、保存真实失败诊断；QA没有修改工具代码。不得换seed、改地图或调低生产身体尺寸来避开。

Code修复后，本QA独立复核diff与[同地图同seed复验](artifacts/r100-fragment-expansion-2026-10-12/journey-shell-medium-swept/report.json)：仍使用不可变3052、medium、seed20261012与signature`22893556`。到点容差1.5px、轴deadzone0.65px；实际起步接入、每个grid邻接边、全部压缩直段均经20px grid/native查询。异常会先保存真实位置、waypoint、index、held、双方支持与sweep，再明确失败。没有写玩家位置、速度、血量、可见性或时间。

复验用真实帧键盘输入完成1.67秒搜取接近与32.54秒去撤离点行走；安全搜取1薪柴，出口由未知变为已知且可交互，真实E结束本趟，HP100、累计时间37.232秒自然增长。路径23个压缩段的扫掠全部为1，所有输入和终态写入回执。该回执支持修复及此受控搜撤样例通过，不提升自然盲搜或全部路线资格。旧失败完整保留。

### 视线工具修订：正常输入证据有效

已独立审阅root修改的`capture-sight-journey.mjs`。原定时朝向tap会产生两种不同问题：长tap继续前进越过精确显露点，短tap来不及按正常转速转向。最终改为先走到见证位后32px、再正常走回，以完整身体支持与native sweep约束准备段。实现没有设置玩家位置、朝向、速度、血量、时间或可见性；这些值全部来自真实游戏系统。

离线最早显露点又恰有DDA擦角敏感性，实际几像素落点误差可重新遮蔽。最终工具保留原最早显露见证，在其32px内筛选身体可达且±4px九个LOS探针通过的稳定座位。`browserRevealSeat`与原`witness.reveal`分别记录，不改离线最早显露或80px标准。`lineOfSightMarginPx:4`只描述九探针，不是整片连续区域的数学证明。

已检查[Pale最终margin回执](artifacts/r100-fragment-expansion-2026-10-12/sight-input-pale-sail-margin/report.json)及[Shell最终margin回执](artifacts/r100-fragment-expansion-2026-10-12/sight-input-shell-chain-margin/report.json)：各取距原最早点8px的稳定座位，各有9段真实行走和3次朝向准备，正常FOV均为0→1→0，反事实无遮挡FOV均为0.6→1→0.6。HP均保持100、游戏时间自然递增，没有结束游戏。通过依赖**最终真实落点的实际FOV断言**，并非只信静态座位预判。先前Pale长tap/短tap/approach与Shell长tap/approach失败仍保留，未覆盖或计为成功。

这两份证据只证明对应受控地图、目标和路径的真实VOID遮蔽、绕行显露及返回再遮蔽；不是首次盲搜、全部孔边、全部朝向或全库可见性证明。

## 最终冻结源复核

最终浏览器源为3053的`coh-spatial-browser-LsV6cH`，冻结时间`2026-10-12T02:17:53.971Z`。本QA独立核对快照清单中780份src/data文件，全部与工作树相同。最终生成文件SHA256为：

- `r100-fragment-data.ts`：`d15bb0d08a9485ef6cd03266b233e3c0eb0754de915b7832325ee89558d75d7a`
- `r100-spatial-data.ts`：`5394da4b403907a3a992c0fd8fce943461372dd522a0adf29439389b680d1cc8`

再次独立对照`c0b71d93`，23张空间CSV中的同一1101条非本批作者行保持完全相同，包含cinder与其他102世界；显式fragment注册恰为6项。`public`原材质文件也无Git差异。此结论是数据和资产隔离，不是其他102张图的新运行验收。

**最终构建通过。** 本QA执行一次`npm run build`，退出0，Vite阶段14.05秒，完整输出保留在[最终构建日志](artifacts/r100-fragment-expansion-2026-10-12/final-independent-build.log)。构建结束后停止重负载工作，未在root的quiet运行预算阶段执行地图、浏览器或额外构建。大chunk警告仍保留，不由此宣称首屏预算合格。

**最终矩阵的计数与版本有效。** [新两图12例](artifacts/r100-fragment-expansion-2026-10-12/two-worlds-final-three-grades.json)为Splayed/Gel×2seed×3grade，完整图及四层材质实际重跑，0失败；780项源hash全部匹配最终源。原Ash/Shell/Pale的18例通过[严格复用绑定](artifacts/r100-fragment-expansion-2026-10-12/unchanged-three-worlds-final-binding.json)保留：执行src未变，完整配方仅去除两处全局来源hash和package依赖hash后精确相同，旧矩阵与捕获配方文件hash也一致。本QA另外逐例核对18个不重复world/seed/grade和原shape/support/4RGBA hash链接，全匹配。没有把18例标成重新渲染，也没有复用已修改的两图旧12例。

复用工具`check-r8-batch-reuse.mjs`只有capture/verify两条只读作者路径，拒绝覆盖证据，校验旧矩阵hash、运行源码和完整配方；仅上述3个回执字段被排除。实际public材质未变由本次Git核对补足，不将该工具的src检查误述为它自动校验了全部材质文件。

**独立配额与路线断言已补齐。** [最终15例production](artifacts/r100-fragment-expansion-2026-10-12/five-production-final.json)覆盖5world×3grade、seed20261012，`recovery=true`，0失败，46项来源hash匹配。工具实际断言完整敌人/资源/Host配额、20px身体支持与独立连通、巡逻扫掠和窗口、至少两组双侧绕行、真实撤离及Worker-wire恢复；这与材质12+18矩阵职责分开，不再把字段计数冒充独立配额证明。

[最终注册反例](artifacts/r100-fragment-expansion-2026-10-12/final-registration-v2.json)13用例及[最终作者身份检查](artifacts/r100-fragment-expansion-2026-10-12/final-authored-groups-v2.json)252组定义/21份sector记录均通过，来源没有漂移。两个输入harness和新增复用工具的`node --check`通过，`git diff --check`通过。QA仍不改生产或harness；修复由code/root完成。

**最终旧r8恢复已复核。** [最终8份旧配方恢复](artifacts/r100-fragment-expansion-2026-10-12/previous-r8-confirmed/expanded-replay-final.json)为code实际执行，本QA只读独立核对：8份recipe hash、完整map hash及4RGBA hash全部与固定Git基线一致，8份保留的本地map二进制也已额外校验；报告784份来源hash全部匹配最终工作树。没有用最终新作者配方替代旧配方，也没有将旧中档有限样例扩大为全seed兼容性证明。

本QA最终范围内没有待修复的已确认生产P1/P2/P3，QA-J01已关闭；没有待运行重负载任务。最终画面、美术终验与运行预算不在本独立静态报告中擅自提升。
