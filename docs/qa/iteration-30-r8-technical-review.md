---
status: REVIEWED / FINDING-FIXED-AND-RECHECKED / LIMITED-SCOPE
date: 2026-09-23
revision: working-tree on ca1bdf385363c35c12eaa8c27913f95f739c97cf
features: COH-F042 / COH-F026 / COH-F033 / COH-F038
scope: Independent bounded code review of R8 scene integration, motion/cache ownership, observation and integrity lifecycle
---

# I30 R8 独立技术复核

本次只读 `src/**`、`assets/**` 和相关合同；唯一写入为本报告。没有修改独立 `CLAUDE.md`，没有提交。已读当前 CLAUDE、code/qa 角色、项目入口与 R8 方案。当前实现仍在并行施工，以下结论不代表冻结版本、整轮功能通过或艺术 PASS。

## 确认的问题

### R8-TECH-01 · P2 · 不均匀帧间隔会使两个设备世界条短时双显

**最终状态：已复现；根代理修复；本代理独立重放原反例通过。** 修前事实保留如下，修复证据见本节末尾。

位置：`src/ui/chamber-integrity-lifecycle.ts` 的 `ChamberIntegritySelection.update()` 与 `ChamberIntegrityLifecycle.setObserved()`。场景在 `PurificationScene.onPostUpdate()` 将选中状态逐个交给三个真实模块，各模块独立持有一个 lifecycle。

选择器从离开范围起累计 `250 + 180 = 430ms` 后释放旧 owner；但实际旧条只在首次跨过 250ms 的那一帧才开始自己的 180ms 淡出。若该帧来得较晚，选择器仍按较早的固定期限交给新设备，两个 lifecycle 会同时给出正 opacity。

生产类最小复现：核心条已稳定，随后核心距离 60、储藏距离 18，二者持续可见；退出阶段使用帧间隔 `[100, 100, 50, 100, 84, 16]`。t=1350 才开始核心淡出，t=1434 已切储藏，t=1450 输出核心 `0.4444444444`、储藏 `0.1`。距离组合可发生于核心到储藏的主层接近区域，不要求穿墙或放宽 E 操作资格。

依据：[R8 方案 §8](../design-notes/purification-scene-art-plan.md#8-完整度提示可观察与可操作分开)的“同时只显示一个主要读数”和完整淡出后交接。建议按真正开始退场之后的经过时间持有 owner，或显式关联退场完成；不能只从离距累计 430ms 推断已完成。

实际执行命令（仓库根目录；未建立新的测试文件）：

```sh
node --import tsx --input-type=module <<'NODE'
import { ChamberIntegrityLifecycle, ChamberIntegritySelection } from './src/ui/chamber-integrity-lifecycle.ts';
const selection = new ChamberIntegritySelection();
const worlds = { CORE: new ChamberIntegrityLifecycle(), STORAGE: new ChamberIntegrityLifecycle() };
const input = {
  device: { left: 100, right: 150, top: 100, bottom: 200 },
  player: { left: 400, right: 420, top: 300, bottom: 330 },
  width: 4, height: 26, gap: 7, clearance: 5, hysteresis: 8,
};
selection.update(100, [{ id: 'CORE', distance: 20, visible: true }], 'CORE');
worlds.CORE.setObserved(true, 0);
worlds.CORE.sample('world', input, 1000);
let now = 1000;
for (const dt of [100, 100, 50, 100, 84, 16]) {
  now += dt;
  const selected = selection.update(dt, [
    { id: 'CORE', distance: 60, visible: true },
    { id: 'STORAGE', distance: 18, visible: true },
  ]);
  const opacity = {};
  for (const [id, life] of Object.entries(worlds)) {
    life.setObserved(selected.selectedId === id && selected.active, now);
    opacity[id] = life.sample('world', input, now).opacity;
  }
  console.log({ now, dt, ...selected, opacity });
}
NODE
```

这是两个真实 lifecycle 与真实 selection 的跨模块协作复现；没有复刻选择器算法，也没有用单独测试两个类来推断集成正确。

### 修复后独立复验

根代理增加 `retiringMs`：首次返回 `active:false` 的实际帧从 0 开始计时，之后累计退场时间，达到 180ms 才释放旧 owner；返回有效距离、进入聚焦或 reset 时清理该计时。复核了这个小改动，没有修改它。

本代理再次执行上述生产类反例，并在相同输入序列后追加 16 个 `16ms` 帧；逐帧断言 `!(CORE.opacity > 0 && STORAGE.opacity > 0)`，最后断言 selected 为 STORAGE、CORE opacity 为 0、STORAGE opacity 为 1。结果：

```text
t=1350 CORE active=false; CORE=1, STORAGE=0
t=1434 CORE active=false; CORE=0.5333333333333333, STORAGE=0
t=1450 CORE active=false; CORE=0.4444444444444444, STORAGE=0
t=1530 STORAGE active=true; CORE=0, STORAGE=0
t=1706 STORAGE active=true; CORE=0, STORAGE=1
Original irregular-delta counterexample and completed handoff passed
```

本次未重跑根代理新增的整套回归，以避免重复验证计数。已读到其新增跨类测试文件，报告此处只认上述实际独立执行结果。修复后文件 SHA-256：

```text
648844f78fece526bf729cc15b48b7c504c0eae40a99cff09a817fae4238a3cf src/ui/chamber-integrity-lifecycle.ts
9d0454734f951720f89474219bbdd9ff5ed268825baabe4349bf7302115ec49c tools/qa/check-i30-integrity-lifecycle.ts
```

再次比对本报告列出的全部源码指纹，仅 lifecycle 从初查版本变化；其余已阅读文件与下方指纹一致。限定范围内没有其他未处理的确定 P1/P2；这不是整轮无缺陷保证。

## 已核对，未发现新增确定缺陷的范围

- **动作与纹理所有权：** 六个独立 activity atlas 由同一管理器创建。正常更新只选择帧；公开效能档或供奉是否占位变化才重建，pulse 不新增循环、贴图或排队。构造时使用独有实例 key；销毁依次移除 image 与 texture，重复 destroy 提前返回。完整 visual 销毁调用 activity/lighting/exterior，再移除自身图片和贴图。
- **时间与透明度：** visual 使用活动场景的累计 delta，不直接采用恢复后的全局 time；原暂停菜单暂停宿主 scene。活动 atlas、源光和外景消费同一个 visual time。设备避让时 shell、活动层、旧反馈层及 device-light 同步 opacity；投地影保持落地，不随设备为让出角色而消失。没有发现新增玩法 RNG 消耗。
- **公共效能与容量：** `syncInvestmentVisuals()` 使用 `clamp(hp / 100)`，主体状态档和光强消费这一投影；条长单独使用 `hp / maxHp`。因此 100/115 不进入受损档，0/24/25/100 的状态条件一致。加厚事件会重新同步公开状态；机制和费用不由显示层反向修改。
- **观察与操作：** 观察使用脚底到真实 footprint 的距离；眼点高度由两层与坡道求得。射线复用 `ENVIRONMENT_FACES` 中建筑/前缘的仿射高度面，去除已被精确地面覆盖的建筑底面，不把涂层和灯光 AO 当墙。E 资格仍来自原 locomotion/操作点。此结论只确认当前接线与模型假设，没有穷尽每个墙角。
- **世界/DOM 同帧与关闭：** 世界条在 `player.postUpdate()` 后读完整人物/持具/灯范围。DOM 由 game `PRE_RENDER` 驱动，维持 overlay 的未缩放逻辑坐标。单个模块的世界/聚焦展示共享 lifecycle；退出清理 commitTimer、closeTimer、PRE_RENDER/RAF 订阅。场景 shutdown 走 `allocationPanel.close(true)`，然后销毁模块和角色。鼠标关闭包装为无参数调用，未把 MouseEvent 误当 immediate。
- **供奉的施工接线：** 最初未接 pulse 属于根代理预告的施工项，不列最终缺陷。复核中已读到新增 inventory durable observer 与归来完成 pulse：新入槽 ID 才触发锁合，库存只重排不触发；完成事件在归来结果可公布之后触发，observer 有 shutdown 解绑。观察了当前新增完成帧分支，实际供奉动作仍需根代理的运行证据。
- **外景缓存：** near 层最后绘制后立即编译 material-clipped spans；随后复用 scratch map 不会改写已编译 spans。近景实体光和接触活动留在建筑之前，中景遮蔽随中景板移动；未引入全屏受光面。

## 方法与边界

- 执行了当前未提交 diff、被调函数、相关当前合同及本地 Phaser 事件顺序的定向代码阅读；执行上述一个跨模块反例、修后重放和 `git diff --check`。
- 本次没有启动浏览器、没有重新跑已有同构测试、没有重建全部艺术产物；没有把其他作者报告的测试数当成本次证据。
- 构建、真实按键、逐帧变焦、三次重入、正常/受损驻留与修复/供奉动作，由 [R8 总 QA](iteration-30-r8.md)及专项证据汇总。本次不代签这些结果，不判断艺术完成度，不解除 I28 挂起。

## 初查源码指纹

HEAD 为 `ca1bdf385363c35c12eaa8c27913f95f739c97cf`；下列 SHA-256 对应本次已阅读的工作树快照，包含根代理施工中的供奉/次级光接线。后续修复以追加记录为准。

```text
88cedcfae4ad6f617bea3eab260b74e75a6e0e159d7583850de12cd4eca11715 src/scenes/purification-scene.ts
2ba98f3d5f3e9867229a1dd609bed87011e01cb154f8cf54746cbae8e1600aac src/scenes/purification-chamber-visual.ts
5ea5f6a6209c9a409263e019193c7a5716b80c757f17ad1f7b6dd030f6f7cbbd src/scenes/purification-chamber-lighting.ts
a58824a0b161673dc6cd9f8e859da42b201dd3ad80bb266df50640b8bd0c9e29 src/scenes/chamber-device-activity.ts
cbd319583bb5a35e4aee559c7cf96d67a385e72b0079cd3b03e5974abd00e1ff src/art/chamber-device-motion.ts
a39cced62d71f7bcc5fde7fc870104e1a4ebd30772757f10ee37bf3551504a39 src/systems/chamber-observation.ts
d328b662bdb37bfbc59cfe597d1cdcbbb8ac1a25c372b5031d470e5bc041cf61 src/ui/chamber-integrity-lifecycle.ts
7d4508dde5320f518eaef6fba41feb4899d9e95c44c620e2a85be7cea18e6735 src/entities/purification-chamber-module.ts
884fc3a75d2d7ba590bb68b6efae11354e0ba9e0ea47be1b69de41d367d0e619 src/ui/chamber-integrity-placement.ts
d59ff20b1bfc434ef7d3b10128bb83dd982050067fc41fcf7ce64f91e55185ab src/ui/dom/allocation-panel.ts
bd4b014721c49c7f9ae8faecd44c16e5ab0519ec7b8f7f5193de86b301dbeed5 src/ui/dom/panel-styles.ts
2a8888e62f84e8ef7284398c5bcf11e4ca0db7a2ce502e6130aea05cda451a8b src/scenes/chamber-exterior-atmosphere.ts
34b059c6728c16e2a559ab2cb4efe500979153fb2779e0cb0e6bb79851a53080 assets/source/purification-r8/environment.ts
```
