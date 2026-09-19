# 协调者知情交叉记录

## 正式production界面复现

### 生命成长未兑现

`fresh-base.storage.json`来自正式主菜单新游戏，未改动的初始档。另建`growth-fixture-input.json`，仅把薪柴0改100，作为可支付成长的隔离预置，其他初始状态保持。通过正常行走到培养藏、鼠标点击和Enter购买生命及亲和。

注意：列表点击会直接购买，并非仅选择。实际各购两级，共扣40，余额60；不是预期命令标签所暗示的一级。`009-vitality-before.png`实际已经是点击后一级，`012-report-promises-115.png`是报告未打开的失败操作；均保留原日志，不引用文件名为状态证明。

有效对照：`014-actual-upgrade-report.png`显示自身完整度130；`two-upgrades-purchased.storage.json`保存生命2/亲和2；`016-real-loadout.png`正常备行→Shift+Enter；`017-upgraded-rift-health.png`与`018-paused-upgraded-run.png`显示100/100。无角色/HP注入。支持生命成长效果未进入实际战斗，不只是文字缺失。

初入混乱0另由技术组排除：底层已是15，HUD缺初始同步，约首个+1事件才更新。不能把此误判为净化器机制失效。

### 出击中途刷新后旧档无法正常继续

同一正式隔离档，正常出击→Esc暂停→reload→主菜单点“沿旧路返回”。`021-active-refresh-click.png`显示“上次出击尚未结束。物品记录已保留，暂不能载入。”，仍在主菜单。`upgraded-active-run.storage.json`和`active-refresh-click.storage.json`保持同一active账本，没有自动结损。

这是**原bytes保留而正常UI没有继续/明确弃局通路**，不是存储被自动删除。技术组核对菜单与session分支，新的纪录会替换累计进度。首轮代理不得在封存前获知此结论。

## 同源诊断构建的实际循环取证

另将相同源码以`NODE_ENV=development vite build`生成静态`/tmp/coh-game-review-diagnostic`，入口3014；只为根代理开放只读`__game`诊断。A/B首玩仍在正式3013。构建日志`diagnostic-build.log`。

诊断另开干净context，从主菜单新游戏，无资源/能力/位置/敌人注入。`diagnostic-helpers.mjs`读取完整地形规划路线，再使用Playwright真实键盘行走、E翻找、E撤离；原AI、伤害、混乱、物件与库存继续运行。规划拥有完整地图知识，**不是新手导航或独立首玩证据**；不改寻路/视野，不瞬移，不无敌，不强制结算。逐步记录在`diagnostic-events.jsonl`。

首个实际种子3036342668，户外ridge-soil。首次安全翻堆带来1薪柴；后续行走与物件证据继续记入日志。此链只证明发生过的系统后果，不能代替长期经济/学习判断。

### 地表显示排查

`render-layer-diagnostic.json`记录诊断户外场景：TilemapLayer隐藏，rift-surface Image可见、depth0、2048×1344，WebGL运行。只证明该DEV样本未显示placeholder层；production没有暴露对象，不能据此冒称直接读取了production内部。技术组继续结合正式bundle与绘制路径解释首轮青绿矩形。

## 工具误差

- Phaser对0ms按键可能漏采，改80–100ms并核对实际状态。关闭界面后的过短输入可能落在过渡中，失败命令保留，不直接判游戏Bug。
- macOS PTY一条输入过长触及行缓冲，使用清行后短命令重发；两条额外空行产生脚本JSON解析错误，属于审查驱动，不是pageerror。
- 活动出行在工具审看间使用游戏Esc暂停；自动路线段则持续真实运行。日志明确各段时间与结果。

## 实际跨局链最终结果

同源诊断构建，从空白新档开始，没有赠送资源或物件。首次真实翻找得到1薪柴和优良凝滞石（instance `CTM_98f029f4-9a71-4b7e-bf3c-922b3e148a1c`），真实键盘行走到撤离点、E撤离、R归来。第一趟seed3036342668，HP40，结算带回1薪柴/1残渣，三模块70/70/70→65/65/50；`diag-first-return.storage.json`为归来稳定状态。

正常供奉台将同一石块置入空槽。后续三趟为了核对生命周期刻意直达出口、未继续搜取，**不是合理经济策略、连续新手体验或供给验证**：

- 第二趟诊所seed3037020198，HP85撤离；归来实际防御挡12，总伤24，供奉0→1。
- 第三趟图书馆seed3037318071，HP40撤离；归来挡14，总伤28，供奉1→2，潮汐进入峰值期。
- 第四趟户外seed3037493930，HP70撤离；归来挡17，总伤31，完成供奉，成熟6次。界面进度显示2→3/3，存储实际charges5（本次高潮增加3；界面封顶显示阈值），不把二者混记。

第四次归来后三模块49/40/8、薪柴1；同一自然收入通过核心面板投入，最终53/40/8、薪柴0。正常备行把同一自然成熟石块装Q，6/6次，见`diag-earned-mature-item-equipped.png`。第五次按Shift+Enter后未成功进入出行：body为空，据点画面固定，所有scene均不active，loop.running=true，Purification transitioning/shuttingDown均true，Rift保留上一趟ended状态。`diag-fifth-departure-stalled.png`及`diag-fifth-departure.storage.json`保存现场；后者已cycle5/run active，且核心53、资源0证明修复最终已提交。诊断页未提前监听pageerror，无异常栈；不能将正式页`pageerrors.json=[]`移用为诊断页无错。

**本链支持获得→供奉防御→成熟→装配、投入资源→据点状态改变；在再次出发处被实际停帧截断。没有完成该自然物件的实战使用、耗尽、死亡或失败后恢复。** 首轮独立审查者均未自行撤离，根代理拥有只读全图知识，必须保留这一差别。

### 有限复现与反例

使用第四次归来的原样存储副本，新独立诊断context、正常菜单和按键重复打开核心、尝试投入、装Q、出发，成功进入Rift，100/100、起始混乱47、Q6，无pageerror。见`reproduce-transition.mjs`、`transition-repro.json`、`repro-after-departure.png`。该轮repair-after立即截图仍显示49/1，脚本没有在最后导出修复后的存储；因此不能用它证明精确复演了原链的修复提交时序，更不能证明先前整段运行历史等价。它只反证“相同成熟物件和准备起点必然无法出发”。

美术B24在正式构建也出现过相似停帧；技术组对其准备状态的一次出发成功。两现场没有栈，不能归为同一已定位根因，不能直接责怪某件装备、修复光效或DEV环境。作为单独高影响待定位项保留，与active刷新恢复缺项分开。

### 本轮根证据的读取注意

- `diag-second-return.storage.json`导出过早，仍是第一趟已结算状态；文件保留但不引用它证明第二次冲击。第二次冲击通过当时可见结算文本、第三次供奉1→2以及最终同实例链交叉；第二次稳态模块为60/50/46。
- 早期diagnostic helper把`endFrozen`误当全部正式出行的结束标志；`exit-interaction`虽ended=false，其可见“撤离成功”和存档settled已确认结局。后改为`runController.isRunEnded()`，保留旧记录不回写。
- 个别R后过早的Enter/移动落在转场，命令未执行；没有把这些工具时序当成产品Bug。修复后短时截图也早于最终存储，最终结果以第五次出发档对账。
- 记录的结算用时包含工具停顿/暂停等时序，本轮不以其评价正常游玩速度、经济产出率或通关表现。
- 最终新增实际审图：四次归来成熟界面、成熟物件备行、第五次卡住现场；此前首页/受损净化点/留影场景亦已实际看图。

所有根浏览器已关闭。正式production页监听的pageerrors为空，仅适用于该页；诊断重放监听为空仅适用于有限重放。源码487项哈希未变化，A/B封存清单校验无差异，见`final-integrity.json`。
