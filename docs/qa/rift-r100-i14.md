## QA Report: R100 I14 发布门独立核查

日期：2026-10-09。当前为 **本轮可自主QA已完成，四项发布门有界通过，I14仍active**。新增48趟全部独审：192份原始存档、53,604条核账断言，三档各16、六材料齐，47撤离＋1真实死亡；旧源12趟与批准渲染修复后的新源36趟明确分开。COVERAGE／ECONOMY／RECOVERY／EXPEDITION的[最终独立建议](artifacts/r100-i14/qa-release-gates-through48.json)已由[Director采纳](artifacts/r100-i14/root/release-gates-through48.json)。当前RC的四例性能、六例入口／冷续、资源回落及清洁设备包完成限定复验。**ART／RELEASE、实际视听／疲劳和用户当前RC终验仍待验；13／14轮不改为全部结案。** 用户现已明确“没其他设备，这个问题 pass。”，仅豁免另一档较弱真实硬件验证，记为[用户豁免、未实测](artifacts/r100-i14/root/weaker-device-user-waiver.json)（`R100-H-I14-WEAKER-DEVICE-WAIVER`），不再阻断I14；这不是弱设备性能实测通过或整体终验。 原失败与游戏遗失均保留，本报告不代填人审或`finalAcceptance`。

依据：[总任务](../tasks/rift-r100.md)、[I01 原预算](../tasks/rift-r100-i01.md#冻结的测量与资格预算-v1)、[唯一台账](../progress/rift-r100.json)的 I14 与六项 `qualityPlan.releaseGates`；本轮范围归[已预登记Task](../tasks/rift-r100-i14.md)。Feature IDs：COH-F052、F011–F013、F003–F005、F008、F023、F041、F044、F045。历史候选为修订6 [内部 RC](artifacts/r100-i10-i12/release-candidate.json)；当前[新RC](artifacts/r100-i14/release-candidate.json)为`r100-native-v3-revision-6-i14-occlusion-rc-20261009`，SHA `bbea9d40ab270586e6361b56b764050670b92101270c051715d3a1e1521690d3`，由[Director精确delta裁决](artifacts/r100-i14/root/actor-occlusion-disposition.json)桥接，不因源码或构建通过变成发布通过。

本次QA按[六门矩阵](artifacts/r100-i14/qa-release-evidence-matrix.json)逐项核源、原件、预算与范围。[A23源档](artifacts/r100-i14/qa-continuous-source-preflight.json)为真实cycle65、35薪、51／103／51模块、上限145；[最终48审计](artifacts/r100-i14/qa-continuous-delta-v4-through-48.json)核所有逐邻prepared→before、四存档、同run、实际消费／遗失及批末storage。现金最终510，模块52／101／54；原服务债0，原102储藏资本债1照实保留，未因I14新增稳定性任务而补跑偿债。来源从[原1397／307核验](artifacts/r100-i14/qa-source-inheritance.json)经[精确delta独审](artifacts/r100-i14/qa-actor-cache-delta-recommendation.json)桥接到1398源／308依赖／108完整包，不把继承证据冒称全部重跑。Code执行自然主链；QA亲自执行隔离真实blur和新源六例入口／冷续，其余运行原件只读独审；这些诊断不计48。独立`CLAUDE.md`修改排除。

### 六项发布门

以下四项通过均绑定当前RC `bbea9d40…`，有完整`purpose: release-gate`／gateId／revision／manifest hash及范围；[最终建议](artifacts/r100-i14/qa-release-gates-through48.json)SHA为`c2d6bd32645e2618e6771b66b604d854a3d746dee016fa2f917a28ef6414280b`。发布批准与人审批准仍为false。

1. **R100-G-ART：pending。** I01／I02和旧20世界修订4的人审守原范围；修订6[260条独立美术引用](artifacts/r100-i10-i12/final-art-review.json)、270档直接帧及54历史空缺如实继承。新源6对同状态绘制精确相等只支持渲染查询等价，实际partial遮挡未观察到；材料、静帧和机器资格不能替当前正常连续视野、最弱项与整体疲劳的人认。
2. **R100-G-EXPEDITION：有界pass。** 新48连续出击／192原档完整通过，低中重各16且自然覆盖六族；47撤离与1死亡保留，死亡遗失后继续真实经营。首低技术中断与同run冷续只计一次，origin载体错误在出发前被截住计0。与[I13真实准备／能力窗口](artifacts/r100-i13-continuation/qa-final-run-binding.json)共同支持准备—搜取—撤离／失败—归返闭环；不是48独立玩家、全世界全种子成功率或真人好玩判断。
3. **R100-G-COVERAGE：有界pass。** 当前1398源／308依赖与108完整作者payload独核，精确渲染delta显式桥接原324正式进入／冷续、342身份等价及108／324内部资格。旧307依赖中的lockfile单独核验；原74完整／1中断／33未测性能范围保留。新四例性能通过不冒充整库性能重跑。
4. **R100-G-ECONOMY：有界pass。** [I13结案](artifacts/r100-i13-continuation/root/closure-disposition.json)支持A23原服务／资本恢复与实际成长68、自然重度深处带回及普通可付再备、B14本支偿债。两方向不能双算同一短靴；祖先定身替补、再重Q4不足、B短冲0／固定配方失败及全链同服务−19均保留。I14不新增盈利、逐件回满或无限供给门；其末储藏101相对原资本102仍欠1薪，不冒称资本全恢复。
5. **R100-G-RECOVERY：有界pass。** 原[31恢复／4冻结合同](artifacts/r100-i10-i12/closeout-independent-review/final-compatibility-review.json)及324冷续按显式来源桥接。当前Chrome155三档真实暂停／正常菜单冷续、可信blur全域稳定已验，新1398源又做三历史检查点冷续；序号／checksum尾提交与约16.67ms正常首帧叶差完整保留。没有新测hidden、OS应用切换或其他引擎／弱设备；不同范围不互代。
6. **R100-G-RELEASE：pending。** [当前清洁设备包](artifacts/r100-i14/root/device-kit-rc/handoff-clean.json)已逐成员核对并继承相同bytes的参考机新装／正式Menu／CLI退出实际验证，但M4 Pro不是另一档较弱实机。另一档较弱真实硬件验证已由用户明确豁免，未实测事实保留，不再列为发布阻断。仍需实际人的听感／连续视觉及疲劳反馈、当前RC的用户`final-acceptance`；设备豁免、历史受控混音、源码、构建或“推进I14”授权均不能替签。

### 抽查授权与原48趟合同

[用户原话及 root 裁决](artifacts/r100-i10-i12/sampling-amendment/root-approved-sampling.json)为“不用做全量测试，抽查即可”；该件的 `authorization.appliesTo` 明列 I10–I12 剩余验证，`limitations` 明列 I14 weak-device/listening/human 门未豁免。因此可沿用**74完整／1中断／33未测性能**、**6材料预热＋10同图＋18低档混合／12 GC**及**8／89语义反例**的有限事实，不补写全量通过。74是原顺序前缀，不是随机样本；两项材料提交p95已触3ms上限。该历史抽查裁决保持原件；本次新的用户豁免仅覆盖另一档较弱真实硬件验证，不覆盖实际视听或版本终验。

I01末段另有“I14再做至少48趟连续稳定性／选择复核，覆盖三档及所有材料家族”。**2026-10-09 Director明确保留本轮新增48趟**，这是相对全库324格的连续抽样；分小批执行，旧I12自然48／I13真52只作继承证据，不计为I14新增。不得把48日志等同真人长期疲劳，也不添加经济盈利、指定工具回满或追稀缺材料的通过条件。

### 执行合同与仍待取得的真实反馈

- **来源与发布绑定先行。** 起始1397源／307依赖（含lockfile）已核；P48仅一改一增后另冻1398源／308依赖及当前RC，原清单不覆盖，完整来源桥接已由QA独核。最终每项门的证据必须有 `purpose: release-gate`、正确 `gateId`、相同RC `revision`／`releaseManifestHash`；人审同样绑定确切RC。
- **新增48连续出击。** 已锁A23唯一主链、四批各12、`[low,medium,severe] × 16`；沿B14有界路线和公开消声5秒／短冲48像素单件≥2筛选后FIFO，缺项空槽，取消I13降档及服务早停。完整政策归Task，不混入A定身选靶。不得重置现金／库存、覆盖失败或把降档写成原计划已执行；没有新盈利或回满门。自然世界只统计实际分布，若48内缺材料，有限固定代表诊断另列分母，不随机续跑追齐。每批完整保存起点／入场／归返／经营末态、同run身份、错误与实际消费；新增48与旧I12／I13分开。
- **当前浏览器正式入口／恢复三格。** 低／中／重各一，开跑前写世界、seed、实际赚取源档、输入与暂停／失焦／冷续窗口；可合并采集帧时，但不把技术诊断叫自然出击。使用真实场景／菜单和隔离存储，保留首次错误，不换世界补赢；每个承诺按完整存档字段核对。
- **参考机尾部四个重档。** `hollow-wreckage`、`buried-lamellae`（旧3ms边界）、`felt-wedges`（原中断）、`white-scarfield`（旧未测且复杂结构），每项正常移动／压力覆盖≥60秒。此集合已经入Task／冻结配置，与自然入口样本分开。只签新 Chrome 环境的这四例，不改旧74／1／33统计，不估计全库p99。
- **旧硬预算保持。** frame p95≤20ms、p99≤33.4ms、>50ms帧≤0.5%；CPU提交p95≤12ms，新增材料提交p95≤3ms；生成／冷恢复参考机目标p95≤5s（三例只报单例与最大，不冒称总体p95）；交互任务≤50ms。首次建场与首屏／菜单长任务分账。新的构建收据要保留实际包体与警告，`build` 为 `tsc && vite build`，项目未声明 `npm test`。
- **真实较弱设备：用户豁免，未实测。** 原合同要求另一档较弱硬件，未锁具体型号或最低配置；用户现因无其他设备明确豁免该项。已完成的同源清洁执行包和参考机结果保留，不再要求提供设备或运行补验；也不把软件节流、可携包或M4 Pro测量写成弱设备实测。豁免只适用于此项，不提升跨设备兼容性、实际视听或终验状态。
- **实际审听和用户交付包。** 沿[R10原问题](artifacts/r100-i03-i06/audio-mix/README.md)检查六材料身份、低中重节律、关键提示分离、接缝与重复疲劳；利用[既有试听页](interactive/r100-material-listening.html)，另含正常游戏片段／试玩。原合同未规定“听几分钟即通过”，应记录实际听者、时长、播放设备、音量环境、时间码和具体反馈。离线音轨波形、非静音、自动播放日志均不代签听感。

### 依赖与当前未验证

48连续、当前参考机四例性能整改／六例入口冷续／资源回落、明确来源桥接、当前RC清洁交付包及可审视听材料均已完成本轮可自主范围，不再有待运行自然趟数。另一档较弱真实硬件运行已获用户豁免，未执行事实保留，当前无需再提供设备。下一步仍需真实听者记录播放设备／实际时长／反馈、正常连续视觉与疲劳的实际体验，以及当前RC的用户终验；没有“听满N分钟”自动通过线，不新增此类门槛。 当前试玩、片段与两项反馈入口见[设备豁免后的供审交接](artifacts/r100-i14/review-handoff-device-waived.md)。

当前[清洁包独审](artifacts/r100-i14/qa-device-current-rc-clean-review.json)核1520个常规tar成员（1519清单项＋manifest），无额外文件；原安装／CLI证据按精确同bytes继承。首包AppleDouble成员、旧关页退出、焦点模拟、尾提交断言、origin载体、原性能超标和游戏死亡记录保留。网站／净化点的51—487ms长任务、实际partial遮挡未观察、hidden／OS切换／跨引擎未测、未实际播放视听材料等范围继续披露。不能用Rift限定窗口通过或交付包可安装抵销这些空白。

Director负责台账、当前入口和人审交接；QA至此只给四项有界技术／机制门结论，不把I14关闭、R100发布或人的认可写成已发生。

以下阶段小节保留当时进度与旧版本结果；当前状态以上述六门及末尾48结论为准。

### 新执行的原失败与工具独审

- [首低档冷续独审](artifacts/r100-i14/qa-first-cold-audit.json)：原 `batch-01` 在重载到主菜单后，用“退出前后字节必须相等”断言而中断，未搜索／用工具／归返。对全部字段递归比较，仅保存序号6→8和校验和变化，两个完整校验和均有效；游戏状态／库存完全相同。生产hidden／pagehide会强制提交，具体两事件次数未独立捕获，因此提交路径是源码支持的原因解释。原失败、源档和v1工具不改；v2独立冻结并由正常Continue续同run，计作首趟一次。
- 原低档真实Escape暂停757.10ms，完整checkpoint／库存／raw不变；但Headless换标签没有native blur或hidden，**不能签失焦通过**。同run第一次实际恢复2930ms，首持久记录仅序号8→9／校验和变化，首运行帧自然推进16.66ms、首输入前另推进144.99ms；全叶差异继续保留待三档统一审核，不把正常帧差抹平。
- [设备交付工具独审](artifacts/r100-i14/qa-device-tool-review.json)：最新版包1519文件、1397生产源／307依赖、运行冻结工具和输入、161050568字节archive及SHA逐项一致。真实wrapper使用`/usr/bin/false`的失败fixture保留exit1、status、日志和运行后源复核；并未开浏览器，也不是弱设备测量。来源漂移与异常漏记两项已修复；Windows／Linux、真实弱硬件仍未测。
- [I14视听审阅页](interactive/r100-i14-review.html)提供5当前原声、18历史受控混音、7历史循环局部和正常图证据。Art亲看6幅重档静帧仅支持有限静态观察；CUA拒绝file访问后停止，未换协议绕过，因此没有浏览器渲染／播放通过。实际审听、运动、疲劳与用户终验保持待审。

### 三档当前浏览器恢复与真实blur结论

[三档完整包独审](artifacts/r100-i14/qa-three-lifecycle.json)通过。实际菜单冷续为2930／2903／2665ms，三例均小于原5秒参考目标，不能据此声称总体p95。首持久记录对原始完整游戏包只改变序号8→9及校验和，等级／压力／回报／run／库存相同；首运行帧均正常前进16.66ms，分别38／54／58个时钟、AI、Host及混乱叶差逐项列出，后续取样延迟另记。

有窗口模式第一次仍无native失焦，原失败保留。只读确认Playwright本机依赖会默认调用 `Emulation.setFocusEmulationEnabled(true)` 后，[独立v2冻结](artifacts/r100-i14/focus/native-v2/policy-freeze.json)仅撤销该测试覆盖，再真实激活空标签。[实际原始记录](artifacts/r100-i14/focus/native-v2/report.json)及[全域复比](artifacts/r100-i14/qa-focus-native-audit.json)证明：三档各产生一次可信 `blur`，游戏自行暂停，checkpoint／inventory／raw分别保持782.5／783.1／813ms不变，返回页面仍暂停，普通Enter只解暂停。`document.hidden`均为false，**不冒称新测hidden事件或操作系统应用切换**。三份历史检查点仅为隔离诊断，新增自然出击0、主链写入0，全部原SHA未变。

据此提出[RECOVERY独立建议](artifacts/r100-i14/qa-release-gate-recovery.json)，结合精确未变源码与原31恢复／4冻结合同适用。发布门、48趟稳定性、主观视听与跨引擎／弱设备结果保持各自范围。

### 视听材料已形成具体交付

[Art不可变交接清单](artifacts/r100-i14/art-handoff-manifest.json)及[QA来源绑定](artifacts/r100-i14/qa-art-handoff-binding.json)已核26件：8份交付文件、前三自然出击的6份WebM和12幅整页PNG。页面静态68引用／18历史元数据／脚本检查通过，Art亲看9幅本轮整页；只签材料完整与有限静帧观察。连续录像和声音未被实际播放，浏览器安全拒绝保留，实际审听／疲劳／用户验收仍未完成。

### 设备交付v2的焦点修正

旧版`--play`同样继承Playwright持续焦点模拟，QA据本轮原失败定位该工具偏差。Director仅在试玩页增加撤销模拟与真实激活的4行，独立导出v2，原包／原审计全部保留。[v2独审](artifacts/r100-i14/qa-device-v2-review.json)核1519文件及161050791字节归档；两版唯一文件变化是试玩wrapper，`--run`及四性能工具完全一致。

安装后正式MainMenu实际产生trusted blur，返回仍暂停，正常Enter只解除暂停回菜单；无存档、无出发、无pageerror、源仍一致。两个smoke原失败（错误使用便利context、错误期待自动恢复）连同脚本留档。该阶段证据是参考机新装依赖的bootstrap＋焦点路径，不签真实弱设备、Windows／Linux、性能或审听。[设备包v2](artifacts/r100-i14/root/device-kit-v2/handoff.json)及原审计保持不可变。

随后[真实原CLI生命周期检查](artifacts/r100-i14/root/device-kit-v2/cli-play-lifecycle.json)发现具体交付缺陷：正式MainMenu可用、没有存档，关闭唯一页面后浏览器进程仍连接，原wrapper只等`disconnected`而未结束；30秒上限后SIGINT退出130，服务才随清理退出。关闭是程序调用真实页面close，不冒称点击原生标题栏。原失败保留，随后Director在独立v3修正等待页面关闭／浏览器断开并完成下述复验；v2本身仍不能描述为完整CLI可交付通过。

增量[v3工具回归](artifacts/r100-i14/root/device-kit-v3/tool-regression.json)已通过：真实原CLI在测试占用IPv4 5173后改用5174、正式Menu无存档，唯一页关闭至浏览器断连59ms，自己进程退出0。首v3检查错误要求整个端口无人监听，碰到既有其他IPv6服务；保留原失败后按本进程退出核清理，没有停止外部服务。共享Vite端口配置同时影响`--play`与`--run`，测量子工具及原预算未改。本件仍绑定旧RC，只签工具回归；最终可携包待P48新RC后重新导出，不把v3旧包当最终新源交付。

### 新增连续主链首批12趟

[首批最终执行收据](artifacts/r100-i14/continuous/recovery-v2/batch-01/execution.json)已完成12／12，退出0。[完整报告](artifacts/r100-i14/continuous/recovery-v2/batch-01/report.json)轻量独立读取确认12唯一run、低／中／重各4，六个材料族均由正常随机身份实际出现，12趟均extract；每次经营末态与下次起点逐字段相等，结算现金与实际动作支出一致。原首低断言失败／同run冷续只计一次。总收入322、维修实付147、成长实付38，现金35→172，末模块51／103／54。

[首12完整独审](artifacts/r100-i14/qa-continuous-through-12.json)随后通过：48份原档逐SHA／全状态复比、9989资产守恒断言、逐趟与终storage连续性、1397生产源全部一致；原服务51／100／51和102储藏资本债均0。QA脚本第一次误将fixture缺省空字符串视为null，属于审计schema偏差，[失败与旧脚本](artifacts/r100-i14/qa-continuous-schema-first-failure.json)保留，只修审计映射，不改生产或原报告。尚余36趟，不将首批覆盖六族或正现金写成48完成、经济普遍盈利或视听验收。

### Chrome155首轮四例性能：历史3失败／1通过

[原执行](artifacts/r100-i14/runtime-reference/execution.json)退出1，四例均按预登记顺序完成，浏览器已关闭。[独立预算核对](artifacts/r100-i14/qa-reference-runtime.json)保留失败：hollow-wreckage 的CPU／材料提交p95为15.8／4.2ms，buried-lamellae为9.6／4.0ms，felt-wedges为14.1／4.3ms，white-scarfield为9.1／2.3ms；原门分别为12／3ms。因此前三例失败，不能用帧间隔通过抵销。

四例实际存活61.28—61.46秒，帧间隔p95为17.7—18.7ms、p99为18.5—24.9ms，>50ms占比最高0.0273%，均过原帧时线。实际渲染器为M4 Pro Metal，Chrome155，电池60%→58%；这些环境记录不证明超标由浏览器或供电单一原因导致。独审重算的是已保留汇总值的预算判定；原逐帧数组未落盘，不能声称重新计算了百分位分布。原旧性能74／1／33保留其环境，这四例也不覆盖剩余全部世界。该次超标随后触发下述P48有因整改；原失败不改，RELEASE仍未通过。

### 修复前参考机资源回落：有限通过

[独立资源核对](artifacts/r100-i14/qa-reference-resources.json)确认6材料预热、10同图与6混合重建、12次双GC取样全部按冻结执行。相对预热基线的used heap加正向backing增长最大1.249876976MiB，低于原10MiB；WebGL2／Texture／Buffer／Program／Framebuffer／Renderbuffer active计数一致，QA另外确认Shader active始终62。总created计数增长是累计创建次数，不误读成泄漏。

该原工具未直接记录browser.version或GPU，当前Chrome155来自相邻实际浏览器测量与固定执行路径；不冒称资源报告内另测版本。仅证明本机有界重建后的自有对象与主isolate内存，不证明驱动显存／进程RSS、每世界64MiB缓存或108／324全库，也不能抵销本轮CPU／材料时长超标。

### P48角色遮罩查询缓存：精确等价与限定复验通过

一次预登记定位将主要afterUpdate成本定位到角色遮罩查询，随后只新增`actor-occlusion-field.ts`并修改`presentation.ts`；1396旧源不变。缓存每个整数世界像素的静态solid高度，非solid用−Infinity，原`height < max(1, ground-y)`严格比较、bounds／ground key和绘图span保留，NaN按原OR回退；战术视野、Host、输入、AI、经济及CSV均不进入缓存。

[独立代码与oracle审查](artifacts/r100-i14/qa-actor-cache-code-review.json)已核8实际世界／6族、8份完整alpha和112姿态span摘要一致；Code报告39,757,776条精确断言通过，包含阈值／越界／非solid／ground／多actor／失效key／退休及销毁。QA阅读了完整测试与改动，没有把它说成另跑同一批断言。Node缓存构建6.17—10.21ms、2.1875—3MiB，仅属该环境，不能代替浏览器加载观察。

[原四例性能复验独审](artifacts/r100-i14/qa-reference-runtime-after-cache.json)通过：四世界顺序、重档、seed20261004、输入及原门槛不变；CPU p95为8.4／8.3／9.0／7.7ms，材料提交p95为2.4／2.5／2.4／1.7ms，四例帧时及≥60秒存活均通过。当前M4 Pro／Chrome155与实际电源记录保留，不将差异归为单一浏览器或供电因果。新生产改动已由Code真实执行`tsc`、等价／原render／visibility合同和`npm run build`，均退出0；chunk>500kB警告保留，构建不代体验。

[QA六例入口与冷续独审](artifacts/r100-i14/qa-render-entry-review.json)通过：三历史检查点首完整帧2695／2913／2739ms，三次A23隔离诊断新出发3379／3415／3744ms，每例低于5秒目标，只报单例，不冒称总体p95。三冷续完整持久包只变序号／校验和，首自然帧约16.67ms的全部时钟、AI、Host叶差保留；各缓存3MiB。被监测的Rift请求窗口无>50ms长任务，但网页／净化点此前51—487ms长任务如实保留，不签整页无卡顿。3实际诊断出发＋3历史续入均不计自然48、主链写入0。

[新源资源独审](artifacts/r100-i14/qa-reference-resources-after-cache.json)沿原6族预热／10同图／6混合／12双GC取样，最大combined retained增长1.376177787MiB<10MiB，自有GL active计数稳定、0错误。有限资源范围保持，不冒称驱动显存、RSS、全库或每世界总缓存已重新测全。

[Art限定实际绘制对照](artifacts/r100-i14/occlusion-visual/report.json)取得两世界共6对同状态正常场景截图；QA独立核12原PNG逐对字节相等、mask spans和已记录状态相等。Art亲看9原帧。实际6处角色hidden均0，未观察到部分遮挡；右／上／下有样本，左向与多个可见敌人未覆盖。Gym不提供Combat／AI正式恢复导出，状态比较限实际可导出项。截图是1136×758浏览器画面区域，可含DOM HUD，不是1:1资产导出。原工具导出失败与未覆盖范围保留，不给完整ART、连续动态或新审美人认签字。

[综合delta继承建议](artifacts/r100-i14/qa-actor-cache-delta-recommendation.json)已独核1398当前源、108完整包payload与308依赖，仅上述两文件改变，建议Director显式桥接108／324原有限资格、旧12＋新36的同链连续范围。旧12保持1397来源，新36须冻1398并逐邻比较完整prepared→before、保留消费与失败。当前旧RC门结果不会自动获得新RC身份；48未完不签EXPEDITION，实际弱设备、听感、疲劳与用户终验仍待取得。


### 新RC三门重绑与连续来源守卫

[新RC三门独立建议](artifacts/r100-i14/qa-release-gates-occlusion.json)已核候选顶层原件、旧门证据和精确delta审批，COVERAGE／ECONOMY／RECOVERY各自携带正确`purpose: release-gate`、`gateId`、新revision与候选hash。三门只在原有限范围内继承；48未完成不签EXPEDITION，ART／RELEASE和用户终验仍待事实。

[双来源连续预检](artifacts/r100-i14/qa-continuous-delta-preflight.json)核原首12报告／storage、真实末态172薪／51,103,54、两份source与Director资格完全一致；七种错误来源／未批准／错误前档／分母偷换输入均被拒绝。其后v3执行器因存储仍登记旧origin3035，在新3037菜单Continue得到隔离新基地，被首次before整包守卫立即截住；没有新出发、搜索或结算，不能计为第13趟，也不把工具载体错误称为正式保存丢失。原失败保留，[独立v4映射核查](artifacts/r100-i14/qa-origin-mapping-v4.json)已通过：全部4个key/value字符串与cookies完全相等，唯一差异为origin3035→3037，current包与原cycle77终态整态相同；现金／备份／cookie／多origin四种语义篡改均被拒。[新双来源预检](artifacts/r100-i14/qa-continuous-delta-v4-preflight.json)绑定这一修正，实际Continue仍须原整包守卫，后续逐批审计方可计数。


### 当前新RC的清洁设备包

[最终交付](artifacts/r100-i14/root/device-kit-rc/handoff-clean.json)及[QA归档独审](artifacts/r100-i14/qa-device-current-rc-clean-review.json)已绑定当前RC。归档161257471字节，SHA `88809ab56da2a39cf3b12ffa61a0d9bf45883a03c083d6e8ece09cef7f17275e`；独立逐tar成员核对1520个常规文件＝1519个manifest列项＋manifest，全部SHA相同，无额外成员、缺失、缓存、依赖安装目录或玩家存档。

原归档带1608个未绑定的AppleDouble sidecar，合262104字节，[原失败](artifacts/r100-i14/qa-device-archive-first-failure.json)和归档保留。没有读取或输出metadata payload，也不据此声称用户资料泄漏。Director从manifest列项复制原字节并关闭copyfile元数据重新归档，游戏／工具字节没有变化，故继承原实际安装与CLI记录，清洁包另做preflight通过。

实际新RC参考机安装及原`--play` CLI进入正式MainMenu，WebGL／交互正常、无存档／pageerror；测试占用5173后改用5174，程序关闭唯一页82ms后浏览器断连，进程退出0且自身服务退出。该动作不是原生标题栏点击，亦没有出发。此包可供真实设备运行与真人试玩，当前仍没有另一档较弱硬件、实际听感／疲劳或用户总验收结论。

### 第二批封存后的24趟独立复核

[两源连续审计](artifacts/r100-i14/qa-continuous-delta-v4-through-24.json)与[资产账](artifacts/r100-i14/qa-continuous-delta-v4-through-24-accounting.json)通过：24个唯一run、96份原始存档、22,182条核账断言；三档各8，六材料均有正常随机样本。第13趟完整before等于原第12趟prepared，后续每对邻接及批末storage均整包一致；原12趟保留1397源，新12趟绑定1398源与Director批准的精确渲染delta，不能表述为24趟均在新源重跑。

23趟撤离、1趟死亡。第18趟`fibre-silt-severe`实际死亡，已搜deep污染物未带回，带出武器与工具实际遗失，落袋0并支付20维修；结算与下一趟延续通过，不以死亡补抽。累计实际落袋612、维修332、成长38，现金35→277，末三模块54／102／53；固定原服务51／100／51和原资本51／102／51欠额均0。资产守恒与此政策结果不新增经济盈利门。

该审计SHA为`77549abe5da170df268985b3c1406ad2527f0818bd9aea5e0ca1a6b1aa226b57`。原首低冷续断言失败与v3载体origin错误（0出发）均保留且未重复计数。当前只是24／48进度，EXPEDITION仍pending，第三批按既定政策继续。

### 第三批封存后的36趟独立复核

[三批两源审计](artifacts/r100-i14/qa-continuous-delta-v4-through-36.json)与[完整资产账](artifacts/r100-i14/qa-continuous-delta-v4-through-36-accounting.json)通过：36个唯一run、144份原始存档、36,690条核账断言；三档各12、六材料均有自然样本。第25趟从第24趟真实prepared与storage整包继续，原12／新24的源身份分开；全部逐邻、逐物、逐笔与1398当前源码复核通过。

第三批12趟均撤离；累计35撤离＋原第18趟1死亡，未补抽或抹去遗失。累计实际落袋866、维修491、成长38，现金35→372，末52／102／54，原服务与102储藏资本欠额均0。本段审计SHA`233f4b093db95d552f69f442bd2907437024610e5e0455b6fc8c5c126da5f18d`。已向Code明确返回PASS，第四批才可继续；本结论仍不是48完成或EXPEDITION通过。

### 全部48趟独立结案与当前RC四门建议

[最终两源连续审计](artifacts/r100-i14/qa-continuous-delta-v4-through-48.json)SHA`10fb79d8a50f3305150ef6855b7e199d15fd2ad090856eddca723234d5e37221`与[完整资产账](artifacts/r100-i14/qa-continuous-delta-v4-through-48-accounting.json)均通过：48唯一run、192原始存档、53,604守恒断言，四批逐邻整包衔接／当前storage／实际run身份及1398源全部一致。三档各16；材料broken-shell9、membrane-rim11、gel-flow7、fibre-knot7、granular-ridge5、folded-slab9，均正常随机取得，无定向补样。首12在1397源、后36在批准的1398渲染缓存源，只有一条真实赚取主链，不是48独立玩家或48全在新源重跑。

最终47撤离＋1真实死亡、0空返。第18趟死亡及其带出物／深处收获遗失完整保留；首低严格字节断言中断与冷续同run计一次，v3 origin错误0出发，六入口／focus／固定性能／资源诊断均不进自然分母。累计落袋1154、维修641、成长38，现金核式35＋1154−641−38＝510；末模块52／101／54（上限145），原服务51／100／51债0，原资本51／102／51债1。没有为消除这个资本差额追加游戏，也没有把正现金解释成全工具长期成本补齐。

[最终四门建议](artifacts/r100-i14/qa-release-gates-through48.json)独立复核完整48原件、所有引用、当前源及旧三门建议后才生成；[Director接纳](artifacts/r100-i14/root/release-gates-through48.json)是新增收据，旧来源桥接及阶段失败原件均未改。COVERAGE／ECONOMY／RECOVERY／EXPEDITION有界通过；ART／RELEASE及实际审听／视觉疲劳、用户终验保持待验，I14仍active／13轮已结。上述冻结建议与接纳收据保留当时的弱设备待验口径；之后新增的[用户设备豁免](artifacts/r100-i14/root/weaker-device-user-waiver.json)取消该项阻断，但没有新增实测结果或整体发布批准。
