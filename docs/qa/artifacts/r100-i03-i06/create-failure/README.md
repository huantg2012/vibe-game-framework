# 正式 Rift 构造失败后的资源释放与续局

结论：本故障路径通过。只覆盖这次同步构造失败、正式继续及主动场景关闭，不代替自然搜撤或全世界资格验证。

- 源：`../frozen-release-candidate/source-snapshot.json`，3065 冻结服务；1338 个文件在执行前后均与快照相符。实际服务模块与材质的 SHA-256 在 [report.json](report.json)。
- 环境：真实 Chrome / WebGL 2，ANGLE Metal / Apple M4 Pro。没有 fake GL；浏览器存储独立且初始为空。
- 随机命中：`r100-silt-gel`，低污染，种子 `3448228414`。没有控制世界或种子，没有修改库存、生命、位置、时间、收益或保存字节。

## 操作与结果

1. 正式新记录进入净化点；为隔离净化点走路，本工具调用既有 `enterRift()` 打开备行，之后实际点击低污染并按 Shift+Enter，完整经过正式异步预热与出发保存。[准备画面](01-formal-preparation.png)
2. `RiftScene.attachSchemeD` 原型只注入一次同步 `throw`。现场读数确认 native wrapper 已存在、runtime 尚未建立。场景回标题的保留/放弃子菜单，出行仍 active、run ID 未变，已保存 departure 字节完全相同，没有伪造 checkpoint 或执行结算。[失败返回标题](02-failure-returned-title.png) · [原始 departure](failed-departure.json)
3. 解除故障，实际点击“保留记录，返回”再点正式“继续”。相同完整 identity 和 run ID 恢复，实际材质 renderer 连续绘制 52 帧；读取时模拟时间为 916.66ms，只有一张 native Phaser 纹理。[正常续局画面](03-continued-native-world.png)
4. 实际按 Esc 保存，再由 QA 主动调用 `scene.start('MainMenuScene')` 触发正常 Phaser shutdown。此项是生命周期操作，不是自然撤离，也没有点“放弃”。关闭后所有 native Phaser 纹理均移除，active checkpoint 字节不变。[关闭返回标题](04-controlled-shutdown-title.png) · [恢复后的 checkpoint](restored-active-checkpoint.json)
5. 再调用一次 `scene.stop('RiftScene')`，两个 renderer 的 destroy 次数仍分别为 1。

## 资源证据

两个真实 renderer 分别对应“已预热但未交付”和“正常接管后关闭”：

- 每个均记录到 4 次真实 `deleteTexture`、1 次 `deleteBuffer`、1 次 `deleteProgram`。
- 释放前原句柄通过真实 `isTexture/isBuffer/isProgram` 检查；释放后均不再有效，context lost，画布缩为 1×1。
- Spy 委托原生方法和原始 `MasterSurfaceRenderer.destroy`，没有替换清理实现。长期探针只持有 renderer/context/句柄的 `WeakRef`，没有为了观察而强引用它们。失败 renderer 在继续后已无法通过 WeakRef 取得；这只是本次观察，不是 GC 时限保证。
- 恢复后的 renderer 在接管阶段没有提前销毁；关闭时才释放，重复停止不重复销毁。

控制台只有 1 条预期的 `QA_R100_ATTACH_SCHEME_D_ONCE` 错误，单列于报告；其他 console error/pageerror 为 0。

## 限制与无效尝试

- 首遍驱动误将保留/放弃子菜单上的一次 Enter 当作“继续”，实际只回到根菜单，随后等待超时。该次未完成结果保留在 [rejected-navigation-attempt-1/report.json](rejected-navigation-attempt-1/report.json)，不计通过。修正为实际点击两个菜单选项后完整重跑通过；生产源码未改。
- 本报告证明明确 GL 删除调用与所属句柄失效，不声称量到了驱动显存、覆盖了所有异常时点或完成了主观审听。
- 运行脚本：[tools/qa/check-r100-create-failure.mjs](../../../../../tools/qa/check-r100-create-failure.mjs)。对冻结服务执行 `node tools/qa/check-r100-create-failure.mjs`。
