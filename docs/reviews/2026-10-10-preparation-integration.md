---
status: REVIEW-COMPLETE / CHANGES-REQUIRED
date: 2026-10-10
revision: 0340113b
features: [COH-F003, COH-F038, COH-F043]
issue: R100-P49
---

# 裂隙彼端：正式合入专项审查

本次合入不能结案：发现 1 项 P1、1 项 P2 和 1 项 P3。最先修复备行画布的 WebGL 上下文回收，再补兼容环境的三档静态表现，最后修正换装往返的自语预算。已认可的视觉方向、两环节结构与单列浏览应保留。本轮仅审查并登记，没有修改游戏实现。

## 范围与结论边界

审查提交 `0340113b` 相对 `f999bc95`，工作树原有 `CLAUDE.md` 改动未纳入。目标为搜撤游戏出发前的风险判断：看见污染威胁 → 选择档位 → 整理行装 → 出发。关注短时信息主次、一次准备的往返，以及多次打开的可靠性，不复审整款游戏或已接受的文案创作方向。

根代理协调三路独立分审：叙事与事务、UI/视效生命周期、美术整合。均为知情专家，不是盲测或真人用户研究。浏览器使用本机 Chrome、Playwright 独立上下文和 `http://127.0.0.1:3027/prepare-review.html?fixture=equipped` 内存夹具；未接触用户正式存档。正常视效对照独立样例。故障注入仅拒绝 WebGL2，保留世界 WebGL1；这与其他真实设备补测不同，不重新开启已豁免设备事项。

实际覆盖：三档正常构图/升降级时序帧/行装承接，重复开关，初始化兼容失败，真实库存方法下的同程换装和保存拒写，既有叙事专项测试。部分覆盖：连续运动以间隔帧及遥测取样，未作真人连续舒适性验证；自然成长供给和完整搜撤未在本轮重跑。音频、跨浏览器、整包性能及玩家终审未验证。

## 发现

### PI-01 · P1 · 反复打开备行会使游戏世界暂时白屏

**实现错误；两次独立复现，把握高。** `src/ui/dom/preparation-veil.ts:234–240` 的 `dispose()` 只删除 shader/program/VAO；每次打开又创建新 WebGL2 context，关闭没有确定释放 context，也没有复用它。

两次隔离浏览器均在第 14 次关闭/重开时出现 `Too many active WebGL contexts`，最老的 Phaser 世界 context 被逐出，继而报告 `Renderer disabled`。实际世界区域变白，DOM HUD 仍在。关闭备行后 1 秒，`gl.isContextLost()` 和 `renderer.contextLost` 仍为 true；第二次等待至 10 秒后浏览器恢复。这里证明的是主场景渲染中断及关闭后不能立即恢复，**不是永久白屏**；次数和恢复时间不外推为所有浏览器常量。

后果是普通界面操作能破坏整个场景的显示，优先于局部美术优化。既有“20 次开关通过”只检查 DOM canvas 数量和 pageerror，既没有检查主 renderer，也没有捕获该类 console warning，不能支撑 GPU 生命周期通过。

证据：[复现数据](artifacts/preparation-integration-review-2026-10-10/veil/lifecycle-fallback.json)、[复现脚本](artifacts/preparation-integration-review-2026-10-10/veil/lifecycle-fallback.mjs)、[关闭后 1 秒](artifacts/preparation-integration-review-2026-10-10/veil/world-after-close-1s.png)、[10 秒后恢复](artifacts/preparation-integration-review-2026-10-10/veil/world-after-close-10s.png)。

建议确定回收或复用效果 context，保留已有 RAF/监听清理。成本小到中，主要风险是共享样例也使用同一控制器，释放时不能触发残留恢复回调。最小验收：正常开关与密集开关各连续至少 30 次，主世界始终不丢 context，无额度警告，退出后世界继续绘制；同时复核样例销毁与重建。

### PI-02 · P2 · WebGL2 不可用时，三档氛围全部退成相同暗场

**实现缺项与表达退化；受控复现，把握高。** `src/ui/dom/inventory-panel.ts:381` 捕获初始化失败后仅隐藏 canvas；没有按档位提供静态遮罩。仅拒绝 WebGL2 时，真实世界在 WebGL1 下仍正常运行，三个档位均 `canvas.hidden=true`，只剩同一基础阅读暗场。文字和进入行装仍可用。

该条件独立于 PI-01。核心损失是玩家无法从遮罩立即感受轻/中/重压力，回到了只靠文案区分。任务第 3 节明确约定兼容路径最低保留三档静态遮罩，不能把“输入仍可用”当成这个表达合同通过。

证据：[故障注入与三档状态](artifacts/preparation-integration-review-2026-10-10/veil/lifecycle-fallback.json)、[低档](artifacts/preparation-integration-review-2026-10-10/veil/fallback-low.png)、[中档](artifacts/preparation-integration-review-2026-10-10/veil/fallback-medium.png)、[重档](artifacts/preparation-integration-review-2026-10-10/veil/fallback-severe.png)。

建议提供无需 WebGL2 的分档静态表现，保留人物与阅读区保护；不用重制世界渲染器。成本中，需美术复核，风险是静态纹理直接覆盖人物或字体。验收分别强制初始化失败与运行中效果 context loss：三档外观仍可辨，A/B、人物、选档、行装和关闭均可用。

### PI-03 · P3 · 换走再换回原武器，会额外重抽同一情境自语

**局部防重复合同偏差；领域受控复现，把握高。** `src/narrative/preparation-narration.ts:46–48` 在行装页发现旧事实失效时直接保留 `extraAvailable=true`；返回选级时不核对是否已经换回同一个已消费事实。

已读低耐久句 → 行装换同伤害另一根 → 换回原件 → 返回原档，最终库存与原状态完全相同，仍从 worn 池再抽一句，占用唯一额外机会。全程最多多一次，第三次不再触发，不是无限刷台词。它违背“不让 A→B→A、换回已消费上下文刷新预算”，并可能抢掉随后真正成长的机会。

证据及复现文件见[叙事分审](artifacts/preparation-integration-review-2026-10-10/narration/review.md)。建议将额外机会的消费绑定返回时仍有效的新事实；成本小，注意真正的旧句失效后需要兜底时仍应允许更新。验收覆盖 A→B→A 不重抽，以及 A→B、真实成功成长仍有一次额外机会。

## 独立美术判断与应保留项

正常 WebGL2 路径下，主导语言是暗色轴测像素场景，次级语言为屏幕空间的颗粒污流与透明文字。人物和肩灯承担世界锚点；低档两侧侵入、中档多向弯折、重档更密的包围大形承担压力递进；界面靠字级、明度、对齐与留白分层。世界主体与柔边污流并非相同画法，但通过人物/文字静区形成有组织的衔接。

表达力度与身份：限定样本成立，低档不是无效果；一致性：正常路径成立；完成度：被 PI-01/PI-02 的生命周期与降级缺陷削弱；玩法适配：正常路径的人物保护、两环节决策和行装降速成立。三档时序帧未发现切档瞬间重置或样例视觉语言明显丢失，但不把 16.6ms 左右的部分采样或静帧外观当成持续心理压力、舒适度或整包性能验收。

应保护当前已认可的大形、三档差异、连续切档、低语衬线与 A 类事实的区别、装备列表与净化点背包的一致交互。没有证据要求重开视觉方向。详见[美术分审](artifacts/preparation-integration-review-2026-10-10/art/art-review.md)。声音未审听；本轮不对它作新结论。

## 测试结论与未升级为缺陷的观察

`npm run check:preparation` 本轮全过，覆盖正文生成、资格、预算及真实成长支付成功/拒写。它没有覆盖以上图形资源问题，也未覆盖 PI-03 的中途换装还原。现有通过记录保留原来的断言范围，不删除失败反证。

真实 `saveManager.commitWorldTransaction` 拒写时，InventoryStore 的 committed 观察器已经获得成熟通知，说明该 API 的“durable-only”描述并不覆盖所有正式世界事务。不过正式净化点 `hasPendingSave()` 门会阻止打开备行；本轮未找到玩家看到未保存自语的路径，因此作为合同/验证声明缺口记录，不再制造第四项体验缺陷。细节见叙事分审。

减少动态时 `setPhase` 没有立即 draw，真实人物轮廓变化在约 300ms 后补绘行装保护区。当前仅有局部延迟证据，没有证明持续显示错误；不提升为独立阻断问题。

归档时关联 COH-F003/F038/F043、证据 COH-E207，P49 保持 open，I14 保持 13/14。先修 PI-01，再修 PI-02，随后 PI-03；整改后重跑上述最小反例，再进入正式实景用户复看。
