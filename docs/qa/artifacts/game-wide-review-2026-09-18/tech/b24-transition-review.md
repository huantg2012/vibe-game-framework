# B24 出发停帧限定复核

2026-09-18。知情技术 QA；未修改生产源码、数据或其他评审证据。浏览器关闭于 2026-09-18T15:00:15.272Z（UTC）。

## 结论

首轮美术记录的“出发后 HUD 消失、据点帧固定”保留为**未定的高影响观察**。未发现高级预置档违反生产加载或出发约束；本轮一次等价准备状态出发成功，未捕获页面异常。不能据此抹除首轮停帧，也不能把原因归到留影玻璃、被动旧布、优良撬棍或多项操作中的任何单项。

## 数据约束

`probe-b24-fixture.ts` 直接交给真实 SaveManager 和 InventoryStore 验证原始 `../art/B24-after-departure.storageState.json`。加载成功，资源6、三模块40/70/60，抗性1，随身重量7.0/16.0，成熟 Q 留影玻璃4次、被动旧布5次、优良撬棍75耐久，凝滞石块处于供奉槽。克隆库存仅清除已开始 run 后再次 beginRun 也通过。详见 `b24-fixture-validation.json`。

原 B24 已经 cycle=1、run=active，说明离开事务已提交。其刷新后不能继续可由已确认 TECH-07 的 active 载入阻断解释；这一事实没有指出第一次场景交接为何停帧。

## 唯一一次定向出发

从原 B24 克隆出准备状态，只将 inventory.run 清空、cycle 1→0。其余物件、模块、成长、资源不变，来源与两项修改写于 `b24-reentry-fixture.storage.json`。这重建相同准备状态，**未重演此前修复／供奉／成长／面板开关的运行历史**，因此不能排除历史相关的场景清理问题。

正式 production 3013、独立 Chrome context，1440×1000/DPR1。在导航前监听 pageerror 和 console error。正常 Enter 载入、D/W/A 绕核心步行到入口、E 打开备行，画面及可见 DOM 确认三件装备，再 Shift+Enter 出发。等待7秒，进入可见正式 Rift HUD：完整度100/100，混乱22，负重7.0/16.0；Q留影4、被动旧布5、优良撬棍75。pageerror=[]、consoleErrors=[]。实际查看 `b24-reentry-base.png` 与 `b24-reentry-after.png`。

- 输入与结果：`b24-browser-result.json`
- 截图：`b24-reentry-base.png`、`b24-reentry-loadout.png`、`b24-reentry-after.png`
- 最终独立存档：`b24-reentry-after.storageState.json`
- 脚本与完整日志：`probe-b24-browser.cjs`、`probe-b24-browser-keyboard.log`
- 首次测试编排把 Canvas 菜单当 DOM 文本查询，超时后自动关闭，尚未执行任何出发；原错误保留 `probe-b24-browser.log`。纠正为可见菜单默认 Enter 后只完成上述一次出发。

## 源码范围与竞争解释

正常出发 `src/scenes/purification-scene.ts:1185` 提交库存 run 和 cycle；`1204–1268` 执行动画后 start RiftScene；`1438` 之后清理基地对象和面板。原现场没有 pageerror 监听及异常堆栈，当前证据无法区分场景清理异常、Rift 创建异常、输入/动画停滞或浏览器偶发状态。相同准备状态可出发降低了“静态装备组合必然触发”的可信度，但对先前操作历史没有反证力。没有擅自扩展测试轮数或修代码。
