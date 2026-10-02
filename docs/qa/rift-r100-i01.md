---
status: VERIFIED-WITH-OPEN-PERFORMANCE-GATE
created-date: 2026-10-02
feature: COH-F052 / COH-F011 / COH-F049 / COH-F044
iteration: R100-I01
baseline: ac9ddd7
---

# R100 I01：实现、测量与独立审查

本轮完成旧局执行器封存、CSV最小包与等级声明、性能测量和I02母版制作合同。**没有新增合格世界，没有上线新三级玩法。** 测量工作完成与现有性能达标是两回事：自然同步生成长尾、CPU预算和生命周期测量缺口必须继续整改。

## 旧局与最小包

- 从ac9ddd7封存61依赖，无外部import，执行器376,195 bytes（gzip92,457）；固定Git树可重建，manifest逐文件与产物校验。
- 正式v1/v2新局和续局使用同一执行器，无配方旧局亦走历史算法；当前选择CSV不变。4个v1、3个v2、2个无版本实例独立进程冷恢复，完整layout/sample/Host指纹核对；18个自然selector种子跨全部5世界与live生成完整结果一致。
- 五包为legacy-demo/dev-contract，三级定义为contract-only，十五格全未实施。编译器校验CSV/生成数据/实际能力/依赖闭包；未知算法、能力、级别或伪造production、遗漏级别、来源篡改拒绝。包清单内层hash与版本台账的文件字节hash不是同一字段，不混用。
- 8组包专项、完整恢复检查、冻结执行器专项及类型检查通过。运行资源导入与3027服务冒烟通过；没有独立lint脚本，不声称lint通过或Node工具完整类型检查通过。

独立互审发现两项问题并复验关闭：包编译器曾允许CSV新增但尚未生成的方言；现对照实际生成字典/权重并把编译器纳入依赖。旧恢复helper曾在校验前查FNV32短hash缓存；未知version撞键可绕过helper（完整存档外层仍会拒绝）。现缓存前校验旧recipe，缓存键用完整JSON，保存签名不变。双方非作者分别复现原问题并验证修复；不是作者自测代签。

## 固定自然样本与实际成本

原始结果：[32自然＋8定向/历史](artifacts/rift-r100-i01/generation-baseline.json)、[缓存修复后9例同种子复核](artifacts/rift-r100-i01/generation-post-cache-fix.json)。M4 Pro、14逻辑核、48GiB；自然seed预先固定，失败不换seed补抽；选择和生成走正式接口。生成与冷恢复分不同进程，warm cache另列，不用热缓存掩盖首次生成。

32自然全部成功，覆盖五世界；3次完整候选重试，无最终失败和后备。生成p50/p95/最大为1.686/8.311/15.365秒，冷恢复1.724/8.331/9.279秒。生成峰值RSS141.4–192.8MiB。最慢seed2834722370选择钴蓝金脉/断裂荒野/定向断裂，发生一次整体候选拒绝，内含12次遭遇站位重排；完整理由保留。分位数仅描述32例样本，不推断总体p99、失败概率上限或所有种子均成功。

32例期间依赖稳定；随后缓存修复改了manager。第二份证据的9例逐项比较前后identity和world SHA一致，178依赖只变manager。**原大样本仍标修复前版本**，没有将旧耗时重标新源码。以该样本均值估算12,960资格例单串生成9.23h、加冷恢复18.00h、含进程装载与核验22.48h；不包括新材料成本、保留样本、美术与实玩，不是工期承诺。

2026-10-03 工具口径修正，仅复核旧证据，未重采样：`measure-r100-baseline.ts` 的单进程默认/上限改为60,000ms，低于该值的定向诊断仍可显式指定；总时限不足会保留未测与失败分母。新报告分别保存采集状态与预算判定，完整且至少32个预登记自然seed才能通过样本门；自然生成/冷恢复各按p95≤5,000ms判断，定向/历史成功例不能补自然失败。默认文件带时间与PID，并拒绝覆盖既有证据。进程退出0仅表示完整有效的样本时限门通过，不表示浏览器主线程、原生运行、资源生命周期或新世界包资格通过；这些独立门仍明确未测。

轻量复核命令 `node --import tsx tools/world-study/measure-r100-baseline.ts --self-test` 已通过，覆盖失败不补抽、部分样本、坏计时、来源变动与60秒上限。`node --import tsx tools/world-study/measure-r100-baseline.ts --review-report docs/qa/artifacts/rift-r100-i01/generation-baseline.json` 只读旧文件并保留其日期/revision/sourceHash；实得生成p95=8,311.053458ms、冷恢复p95=8,330.59175ms，均FAIL，按设计退出1。既有报告的 `finite-sample-complete` 只指采集完成，未被重写成当前源码性能。未来空闲参考机复测入口为 `node --import tsx tools/world-study/measure-r100-baseline.ts --budget-ms 1800000`；此次美术/语义纠偏不重复测被冻结的32例，也不以DEV GPU帧时关闭R100-P01。

**I03安全离线程的最小接入范围（静态调查，尚未实施）：** 正式新出击在 `PurificationScene.transitionToRift` 同步调用 `createProceduralDeparture`；冷续局在 `session.loadExpedition` 的 `saveManager.load` 同步准入中调用恢复。应新增纯生成Worker入口/传输数据/client，生成前固定一次recipe与seed，Worker内执行既有冻结算法、合法性与指纹核验，60秒硬截止并支持取消；不得重抽身份或修改冻结执行器。不能把带Phaser/存档singleton的整个 `rift-recovery` manager导入Worker。传回的layout需剥离/重建 `walkableMask` 方法，其余plain对象和typed array可按明确DTO传输；主线程将已核验产物登记进现有完整recipe键缓存，不通过改变存档签名规避兼容。

新出击须await准备成功后才运行现有原子 `beginRun`/库存/出发意图提交；取消、超时、Scene关闭或生成错误不得消费准备或改写原存档。续局先只读取得checkpoint/departure身份，预热对应缓存后再调用现有同步load/validator；等待期间需固定并复核存档快照，变化则拒绝本次载入，不能缓存miss后退回主线程同步生成。需要改动的生产边界为新增纯Worker/DTO/client、`rift-recovery`异步准备及缓存登记、`PurificationScene`等待与取消、`session`及`MainMenuScene`载入互斥，必要的存档快照核验接口；这些保留为I03实施范围，本次没有接线。

**Worker之后仍须逐项测<50ms：** 主线程接收/克隆与TileGrid重建、recipe/identity签名核验、admission的Host manifest/paint bake与AI配置构造、RiftScene表面预烤/纹理提交/首次建立。Worker仅迁走生成不能证明这些阶段达标；需按阶段记录真实主线程连续任务，超预算阶段继续移入纯Worker或按可取消分片处理。还须做生成中取消/超时、场景销毁、等待中存档变化、保存失败重试以及v1/v2/无配方冷恢复指纹负例。纯Promise包裹同步函数不会消除阻塞；Node子进程时限也不能替代浏览器Long Task与生命周期证据。

## 原生基线与未完成范围

Gym新增只读有界Phaser帧时探针，2秒预热、12秒采样；CPU提交与帧间隔分开，暂停/后台排除，缺少heap能力记null。探针的预热、暂停/后台、计时边界与重置5项专项通过。原生浏览器结果与截图保存在本轮`native/`，由正常进入按钮启动；不修改正式存档，不注入游戏状态。短时静止基线不证明移动、交战、重度峰值、GPU耗时或资源回收通过。

I02具体制作单见[三构造三级母版](../art/rift-r100-masters.md)：厚板、共根束、内外厚壳各有独立结构与受光来源，保留原人物、地面视角、有限视野；高物体投影不复用地面支撑擦除mask。当前已完成源码与既有画面诊断，尚未制作九格或实际审听，不能称美术通过。

性能门、样本与未测硬件已锁在[I01任务](../tasks/rift-r100-i01.md)。I03正式接入前解决主线程生成与长尾；I02先执行首组三档板体，I05扩大装卸/成本审核。未开新币种、终局或不相关物品扩产。


最终I01集成检查：`npm run check:r100`通过（台账70例、包8组、冻结归档、帧时探针5组），`npm run build`通过，保留原有大chunk提示。浏览器五组12s静止结果见[native/performance.json](artifacts/rift-r100-i01/native/performance.json)：前两例试探的视口/DPR不同，不与后三例合并统计，固定1600×1040 DPR1三组帧间隔p95为19.3/17.2/14.3ms、CPU提交p95为18.6/16.7/13.0ms，CPU预算未过。并行CLI有负载，需后续隔离空闲机的长路线复测；不能把本轮短样本当正式帧时资格。
