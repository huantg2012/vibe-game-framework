# QA Report: R100 I01／I02 污染整改共享代码

日期：2026-10-03。独立 QA，仅核查本轮共享接入与恢复；不代表美术或整体迭代通过。

Spec：`docs/specs/system-chaos-scavenge-extract.md`、`docs/specs/system-contamination-lexicon.md` 的 2026-10-03 整改节；用户本轮要求及 `docs/art/rift-r100-i02-review.md`。

代码版本：`ba3ea28e3f56da95312683dc28e244c687cb1cfe` 上的未提交整改工作树。关键源 SHA256：

- `rift-scene.ts`：`b21e32edd293dac2d7644080c320024822c8908d579b5e6d0fea23ff64e824f9`
- `chaos-system.ts`：`d6c5db0ab69c2f1dd9007f78f13c36a5aba71cc3787d0ff88a609ee4b832d334`
- `contamination-host-system.ts`：`72a0c1ff5d14d08a5bbece1a1f3133a179ab8c6dc028fa939632350d89b40139`
- `masters/pollution.ts`：`3eb662b7a0e6de61bb18c579a321eb294f3eb906e40df7f226edf12894d7a27f`
- `masters/surface-renderer.ts` 修后：`725f9a86bddf32f489603077ea79815209ee0e2525bdce9eb2acc1ded5c68408`

Feature IDs：COH-F007／F011／F012／F013／F016／F041／F049／F052；仅涵盖下述局部行为，公共证据由 Director 登记。

环境：macOS，Node 22.14.0，独立 headless Chrome WebGL2。母版测试使用正式 Host／Chaos／形体准入代码与桩 Graphics；GLSL 检查直接提取实际 shader 源运行，没有另写一个近似光照实现。

## 发现的问题

| ID | 类型 | 严重度 | 描述 | 位置 | 结果 |
|---|---|---|---|---|---|
| C01 | Bug | Medium | 自发光反射的格子射线在对角处仅当两侧同时吞光才阻断，与母版表面路径的任一侧阻断规则不符。绿反光可能穿单侧吞光角点照到其他可见面。 | `src/dev/rift-r100-masters/surface-renderer.ts:28`；对照 `visibility.ts` | 已由 root 将 `&&` 改为 `||`，实际 WebGL2 回归通过。 |
| C02 | 边界限制 | Low | 视野半径现在每次 POST_UPDATE 都读取占空影响，但 Host 接触仍在既有 UPDATE 中读上一份玩家位置；因此通常仍有一个游戏帧的碰撞位置提交差，不能描述为物理越界与视野严格同帧。 | `src/scenes/rift-scene.ts:821`、`:920` | 取消等待污染值发布造成的长期延迟已成立；本次未重构整个接触时序。 |

C01 最小复例：2×2 格，每格 8px，仅右上格 `(1,0)` 为吞光；从 `(4,4)` 到 `(12,12)`。正式母版路径为 false，旧 GLSL 为 true。单下侧及反向同样复现。旧 shader 的 7 例中 3 例失败，修后 7 例全部一致。

- [修前 GPU 证据](artifacts/rift-r100-i02-corrections/light-path-before.json)
- [修后 GPU 证据](artifacts/rift-r100-i02-corrections/light-path-after.json)
- 回归脚本：`tools/qa/check-r100-corrections-light-path.ts`

本次明确修正的是自发光材质反射路径；肩灯仍由正式可见性遮罩负责，未把以上 7 例扩大解释成所有光源／所有场景的完整光学证明。

## 通过的检查

1. `TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/world-study/check-master-pollution.ts`，exit 0。三构造×三等级×两种子共 18 例实际 Host 准入，数量为占漆 2／4／6、占空 1／2／3，身份独立；完整油膜及呼吸预留有地面承托，油膜接触格不重叠，入口到翻堆／撤离的保护路径不强制穿越污染。
2. 真实 ChaosSystem 的 90 秒安全停留增量分别为 21.6／38.475／62.044444…；校验模拟时钟、10ms 与100ms续跑分帧、暂停、50%抗性、追击、临时减速、同等级恢复及旧无等级恢复。未指定等级的旧流程仍为 0.5 点／秒，导出不增加等级字段；跨等级快照拒绝。
3. `npm run check:rift-recovery` 完整 exit 0。24 个既有检查入口通过，覆盖保存拒绝／取消、真实 Host／actor／effect 恢复、历史生成身份与 Worker 生命周期。最后 4 个 v1＋5 个历史金样身份保持，12／12 Worker 清理；不是全浏览器或性能验收。
4. `QA_OUTPUT_FILE=docs/qa/artifacts/rift-r100-i02-corrections/light-path-after.json node --import tsx tools/qa/check-r100-corrections-light-path.ts`，exit 0，7 个实际 GLSL 检查通过。
5. 静态接入确认：32px `hostTileMap` 用于 Host 准入及方案 D，8px玩家碰撞图未替换；多占空的 pin／ID／快照顺序一致，单占空仍走原候选选址。
6. 静态生命周期确认：材质反光源从 `getSubjects()` 的 alive Host 中读取，死亡后从源表移除；占空无实体的周期将强度降为零。危险暂歇但实体仍存在时，微弱反光不意味着仍有危险。

## 限制与收口

- 原生正常比例画面、污染动效是否足够显眼、结构下沿可读性、最终绿色审美和吞光感受，须以 root 的本轮独立采集及用户复评为准，本报告不代勾。
- 未验证任意输入种子的投放成功率、完整搜撤时长平衡或装备准备的长期价值；18 例不会使任何正式世界包获得资格。
- 本 QA 不重复协调者的全构建，也未执行不存在的 `npm test` 脚本。合并收口仍须记录 `npm run build` 的结果。
- 没有新发现未修复的 High／P1；C02 是既有时序边界，不应被“同帧”措辞掩盖。

## 补充：绿色侵蚀的原生动态证据

2026-10-03 在关闭 HMR 的 `http://127.0.0.1:3046` 采集折叠板低／中／重三个等级，种子均为 `20261002`。全部使用同一 20px 身体合法站位 `(444,388)`，以真实键盘选择朝向后开始记录；站位仅在采集前受控设置，不作为自然行走可达性的证明。没有改曝光、相位、灯光或模拟时钟，没有暂停演员后单独播放材质。

每档记录约 8 秒的 960×640 原生 WebM（无音轨）和 10 张真实时间截图。视频实际解码至 1 秒，三段均为 960×640 且有有效游戏画面；不是空 canvas 视频。记录期间玩家坐标与相机参数固定，HP 一直为 100，原生地面敌人在原处保持 patrol；没有敌人追击／受伤闪光解释所测变化。

绿色像素取自**可见的真实结构侵蚀掩码**，再以首帧 G 高于 R／B 的实际画面筛选，避开 HUD、旁白和黑背景。首个 0.5 秒采样的最大 RGB 通道差达到 4／255 的比例：

| 档位 | 纳入的绿色结构像素 | 0.5 秒发生变化 | 平均最大通道差 | 实际模拟总增量 |
|---|---:|---:|---:|---:|
| 低污染 | 471 | 310（65.8%） | 9.47／255 | 7.998 秒 |
| 中污染 | 738 | 484（65.6%） | 10.33／255 | 7.998 秒 |
| 重污染 | 1212 | 630（52.0%） | 9.33／255 | 7.998 秒 |

三档暂停后相隔 700ms 的两张完整游戏 canvas **逐像素一致**，材质时间与污染数值也保持不变。说明本轮可见绿色结构确实随游戏时间变化，暂停正确冻结；像素差阈值不是“足够震撼／足够明显”的审美标准。

限制：本次 8 秒覆盖低／中的缓慢闪动以及重污染开始渐亮，没有覆盖 14–19 秒完整明暗周期，没有声音验收。仅折叠板三个等级，不扩大为九母版或其他正式地图全通过。

- [直接播放三档视频与逐帧图](artifacts/rift-r100-i02-corrections/animation/index.html)
- [完整原生状态／相机／像素差／暂停／源指纹记录](artifacts/rift-r100-i02-corrections/animation/report.json)
- 可复跑脚本：`tools/qa/check-r100-corrections-animation.mjs`
