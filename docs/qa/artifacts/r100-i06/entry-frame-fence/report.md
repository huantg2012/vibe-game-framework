# 原生入场真实帧边界回归

本补丁只调整初始化调度：建场帧保持物理暂停，下一实际 Phaser 帧完成零时长画面及完整存档，收到其 `POST_RENDER` 后才释放玩法。没有固定 16ms 定时器，没有推进或伪造游戏时间。显式 DEV 入场演出的时长合同不变。

## 实际浏览器

冻结源：[3072 源清单](../../r100-i03/native-body-fix/frozen/source-snapshot.json)。该源还包括同期精细身体边界修复；后续技能落脚窄修须以最终依赖影响映射为准，不能把本证据改名成重测结果。

- [真实生命周期](lifecycle-final/report.json)：新入场从 frame 257 到 258，冷续从 frame 70 到 71。准备过程中 player、combat、AI、chaos、tools、search、游戏时间及物理余量逐字段不变。提前 pagehide 保留此前持久字节；提前暂停在首个完整 checkpoint 后正常落地；准备时按住的 D 键必须放开后才移动。
- 冷续样本由真实 D 移动及 Space 挥击取得；保存速度 `(80,0)`、输入 `(1,0)`、挥击已推进约 16.67ms。复原至第一张完整画面时保持原状态，无新动作或额外物理步。
- [创建故障](create-failure/report.json)：明确注入一次 attachSchemeD 异常，验证未消费 GPU 释放、帧围栏取消、原出发存档字节保留、正式 Continue 成功。无额外 console 错误。它是故障试验，不算自然行程。
- 原脚本两次无效尝试分别因标题动画尚未就绪、在同一 POST_RENDER 回调立即断言异步 `scene.pause()`；随后又校正了既有暂停菜单的 200ms 防连击等待。只改测试导航和取样时机，未通过改生产来迎合测试。所有失败原因为测试模型的时序假设，未计入通过证据。

## 性能范围

同 fibre-silt 重档样本，之前建场和首个玩法帧合成 88ms。分帧后的 [首次归因](profile/attribution.json) 为 51ms；[冻结复测](profile-final/attribution.json) 为 61ms。两次冷续均没有观察到 ≥50ms 的长任务。冻结 61ms 中约 55ms 仍在 createRun；敌人/Host 视觉挂载约 16.4ms、来源残骸约 8.8ms、其它建场约 27.8ms。主线程没有重新烤地表或完整占漆 Host，首次正常玩法也不再与建场叠在同一任务。

这证明调度改进有效，**不证明所有 20 世界均小于 50ms**。保留 P01 目标未全面满足及测量波动，不为最后几毫秒扩大本轮生产改动。

## 定向检查

- [纯帧围栏](regressions/fence.log)：建场 render 不放行、必须先完成画面与持久提交、隐藏/暂停延后、销毁与陈旧 listener、借用物理暂停所有权。
- [16 项事务](regressions/transactions.log)：真实保存/session 路径，受控 Worker 投递。
- [23 项表现生命周期 + 7200 音景帧](regressions/presentation.log)：取消、迟到、一次性消费、资源与 CPU 事实所有权均保留。
- [类型检查](regressions/typecheck.log)、[build](regressions/build.log)、`git diff --check` 通过；项目没有独立 lint script。实际 `npm run dev` 服务于 3071，完成模块/新入场/冷续冒烟；最终浏览器验证使用无 HMR 的 3072。
