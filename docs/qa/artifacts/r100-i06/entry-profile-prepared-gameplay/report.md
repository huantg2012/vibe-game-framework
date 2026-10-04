# 入场准备重复计算：最小修复与复测

2026-10-04。对应前一份[精确归因](../entry-profile-final/report.md)。**修复已完成，整体入场仍可能超过 50ms，不以此关闭 P01。** 未改变美术形体、生成、巡路、奖励或正在运行的自然旅程。

## 改了什么

专用表面 Worker 已烤好占漆 Host，却在首帧保存时又完整烤一次，只为取得战斗目标顺序和核数。现在原清单函数抽成 `systems/rift-host-manifest.ts`，Worker 直接复用已烤 field。同时把原发光源像素选择、搜取来源 BFS 结果一起带回；算法没有变。

`prepared-gameplay.ts` 把少量派生事实绑定到同一个实际 layout 和包／种子／尺寸身份。主线程检查清单、发光源选择、节点身份与来源描述，然后注册弱缓存；准备校验约 7–8ms，未产生新的大任务。正式异步 v3 缺准备或身份不同直接拒绝，旧版本／同步离线检查继续原逻辑。准入从不相信存档自报的 target 列表。

GPU 和 CPU 准备共同拥有取消、淘汰、同键替换、构造失败的释放；release 只删除自己那一份，旧包装器不能删后来的准备。正常交接后 CPU 事实由保存准入继续使用，原 controller 的迟到 abort 不影响活动场景。

## 真浏览器结果

从当前源码制作独立冻结服务 3066，见[精确源文件快照](frozen/source-snapshot.json)。原自然连续旅程服务 3062 不动。

同世界／同预定种子，纤维沉积重档的 CDP 时钟对齐样本：

- 首次出发长任务 **157→88ms**；createRun **59.7→42.5ms**。
- 冷继续的场景长任务 **67→66ms**；修前重复准入原本就在更早的独立任务，因此它没有同样幅度的下降。
- 首帧 `bakePaintGenome`、来源区域 BFS 不再出现；整个主线程 profile 没有这次重复完整占漆烘焙。原地表／法线／光照大烤仍在 Worker。
- 88ms 中仍有实体贴图挂载 15.2ms、搜取物绘制 9.0ms、首帧活体绘画 13.1ms、视野／小地图 7.3ms、原生角色遮蔽 5.6ms、其他保存 6.2ms，以及其他场景／浏览器工作。它是多个场景启动与真实首帧步骤组合，不应谎称全是 Phaser，也不能用删首帧保存或静止污染体消除。

[对齐报告](aligned/report.json)、[互斥调用归因](aligned/attribution.json)、[入场 CPU](aligned/entry.cpuprofile)、[恢复 CPU](aligned/restore.cpuprofile)。时钟夹定误差各约 0.3ms，CPU 采样约 1–2ms，性能绝对值仍受 profiler 和并发浏览器影响。

另按原集成脚本重复两世界真实出发／暂停／冷刷新／继续：[报告](comparison/report.json)。纤维沉积重档入场 87ms、恢复 55ms；灰层重档入场 79ms、恢复没有超过 50ms 的观测任务。两者存档身份和角色位置保持一致，无页面错误。这不是全库新 60 格矩阵，不覆盖所有硬件。

## 等价和生命周期

- [预烤回归](regressions/prewarm.log)：原 9 世界／36 张 RGBA 逐字相等、54 个实际 Host 全部烤制结果相等；新增 9 份准入目标顺序／核数、发光源位置及全部来源区域与原函数一致。外来清单、缺源、缺节点、外来身份拒绝。
- [23 项表现生命周期](regressions/presentation.log)和 7200 音景帧通过。新增 CPU 事实取消／构造失败释放、替换隔离、消费后保留、外来 layout／包拒绝。
- [16 项真实事务路径](regressions/async.log)通过：原保存失败重试、取消、blur、场景启动抛错等，保留原准入和原存档。
- [完整既有恢复 suite](regressions/recovery.log)、[类型检查](regressions/tsc.log)、[build](regressions/build.log)、`git diff --check` 通过。无 lint script，build 原大 chunk 提醒保留。
- [npm run dev](regressions/dev.log)在独立 3067 启动并实际 GET 首页、RiftScene 和新缓存模块成功；其所属服务已停止。真实浏览器另使用上述冻结服务。

## 证据影响

[生成影响复核](generation-impact.json)：原 2400＋480 执行器的 **72 个实际源输入 SHA 全部未变**，因此原生成／transfer／CPU 冷重构证据继续对应同一算法。新准入和生命周期另由上述回归负责，不能拿旧矩阵自动代替。

本次 20 世界的 281 项运行依赖收据独立保存在 [packages](packages/)；[归档索引](packages/archival-index.json)只重定位路径，`index.json` 保留当时 canonical 原字节，不是第二份资格状态。后续实体边界修复若发生，必须重新签收据，不能复用本批 SHA。实际单材料／共享几何／规则文件变更使旧收据失效的[隔离实验](dependency-invalidation.json)再次通过。

本补丁没有授权或完成实体精细边界修复；该项正由根任务和美术 Agent 独立处理。P01 最终裁决、全库新入口矩阵及最终收据由根任务在所有生产修改结束后统一复核。
