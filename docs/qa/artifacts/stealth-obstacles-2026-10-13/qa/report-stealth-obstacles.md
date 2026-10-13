## QA Report: 三代表中尺度实体追加与诊断可信度

日期：2026-10-13
Spec：`docs/specs/system-map-generation.md#medium-scale-obstacle-authoring`；`docs/design-notes/stealth-obstacle-distribution-2026-10-13.md`
代码版本：以 `authoring-preservation-final.json` 的 Git 基线及工作树 SHA-256、`final-receipt-audit.json` 的最终收据 SHA-256 为准；未提交工作树，不能仅用 HEAD 表示本批。
Feature IDs：COH-F006 / F007 / F011 / F012 / F013 / F015 / F019 / F052。
环境与入口：macOS、Node v22.14.0、tsx；读取正式生成器已产出的完整生产图，使用真实 NativeBodyCollision 与 hydrateR100MasterWorld.sight；未启动浏览器、未输入玩家操作。
证据类型：CSV 静态隔离检查、完整生成/恢复收据审计、存储地图的独立几何与 DDA/身体扫掠核查、合成诊断负控。根构建由主线程负责，本 QA 未重复运行；项目无 `npm test` 脚本。
结论：本次已覆盖的内容隔离、原几何/VOID 保留及诊断修复通过。双侧见证按 **13/17 单件、8/8 作者组**记录；静态视线能力不等于敌人潜行体验通过。

### 发现的问题

| ID | 类型 | 严重度 | 事实与状态 | 位置 | Spec 依据 |
| -- | ---- | ------ | --------- | ---- | --------- |
| SO-QA-01 | 诊断 Bug，已修复 | High | 旧版只要求两个 waypoint 分处起终点轴线两边；北侧实体贴边无路时仍判双侧通过，两条实际路径均绕南侧。Code 改为半平面、沿轴不回头及绕真实实体内点的闭环见证。独立反例修前 true、修后 false。 | `tools/stealth-obstacles/diagnostics.ts`，证据 `detour-counterexample-before.json` / `detour-counterexample-after.json` | 真正双侧绕行与完整身体通路 |
| SO-QA-02 | 诊断 Bug，已修复 | High | 旧版不因 route/detour 失败改变 summary.status。Code 已汇总失败并 exit 1；三张真实地图分别请求越界端点后，全部保留失败 ID，汇总 failed，进程实际 exit 1。 | `tools/stealth-obstacles/diagnose.mjs`，证据 `negative-route-after/summary.json` | 不以运行完成冒称通路通过 |
| SO-QA-03 | 验收范围缺口 | Medium | 新增 solid 不增加 LOS 遮挡，未执行真实敌人接近→等待/绕端→撤回，未量最长遭遇暴露行程。当前不能宣称“潜行已改善/已解决”。 | `final-geometry-and-player-void.json`；`src/systems/ai/ai-system.ts:1029` | 真实遮视机会、朝向/听觉/巡逻相位须另验 |
| SO-QA-04 | 有限证据，非阻断结论 | Low | split 实例 4/7、gel 实例 8/12 未取得当前保守搜索的单件双侧见证；这既不证明无路，也不能记为该单件双侧通过。 | `final-detour-recheck.json` | 双侧通路按已取得的见证范围陈述 |
| SO-QA-05 | 指标解释限制 | Low | 路径 minClearRadius 是所选体中心路径至最近障碍的距离；保守下界也不是两个障碍间的最小开口宽度，不能乘二改名为穿口宽。 | `tools/stealth-obstacles/diagnostics.ts:243` | 新穿口净空与真实身体扫掠应分别记录 |

### 通过的检查

- **内容隔离**：108 行中其余 105 世界的 native 行及 layout 行保持；三图原实例/profile 前缀、原 placement 全字段与顺序保持。追加为同材料 solid，新增 5/6/6 件，各 role 的 source 索引唯一且恰好消费一次；未改原孔与外岸作者表。证据：`authoring-preservation-final.json`。
- **三档完整生产收据**：最终 3 世界 × 低/中/重 × requested seed 20261012/0 共 18 个唯一完整组合，报告完成且无失败，源文件哈希与工作树一致。最低身体可达率 99.9899%，配额保持，非 safe 巡逻空档最低 2400ms。本条为主线程执行结果的独立收据审计，未冒称 QA 再跑 18 例。证据：`final-receipt-audit.json`。
- **原物真实几何**：独立解包最终三张 medium / 20261012 存储图，旧 2/6/3 件的原实例参数、位置、实际 positions/indices/normal/UV/material 等完整几何字段保持；原孔多边形相等、最终 8px matter/VOID 格零变化。最终 gel 的有效种子亦与原图一致。证据：`final-geometry-and-player-void.json`。
- **新增真实足迹**：17 件均有非退化 XY 三角形和非零投影；逐件给出真实顶点边界与 2px 中心采样面积，未使用名义长×宽代替。采样面积不是连续多边形精确 union，也不是不扣重叠的净新增面积。最终保守新增 WALL/原地面约 3.66% / 11.83% / 8.45%，与身体中心净空指标区分；3–6 点仅为设计起始候选，不是本次硬失败阈值。
- **solid/VOID 语义**：三图共享 sight 网格与原图逐格相同，所有 WALL 格仍透明。每件新增实体都找到身体两端合法、扫掠受阻而 DDA 视线可穿过的静态侧向见证，共 17 件。正式 `rift-scene.ts:439` / `:509` 将同一 native sight 用于玩家和 AI；这证明网格语义，不证明敌人在当前朝向、距离和状态下是否发现玩家。
- **真实 VOID 揭露**：每图各 3 处相隔的 VOID 遮挡→绕端揭露静态示例，路径由真实身体查询核验。目标是地面观察点，不是真实敌人；按零混乱前向视距的有限探针搜索，不代表全图遮视密度、听觉安全或自然盲搜。
- **严格双侧路径**：独立消费最终 13 条双侧见证，重核 20px 身体每个路径点及连续段、两侧半平面、沿轴不回头、真实 named-solid 三角内点及闭环 winding。split 3 件、gel 4 件、sloughed 6 件均通过；覆盖的组数由 `code/group-witnesses-final.json` 明确为 8/8，未获单件见证仍列出。证据：`final-detour-recheck.json`。
- **旧局恢复范围**：最终旧冻结配方回放 9/9 地图；其中三张 medium 额外核四 RGBA 与未翻/已翻 patch 字节。不能将 9 张地图相等表述为 9 张都有四层材质回放。证据：`code/after-final-old-replay.json`，收据审计在 `final-receipt-audit.json`。
- **净空指标边界**：最终三图最大采样净空半径约 204/209/268px，原图约 268/291/316px；距真实 solid 大于 224px 的当前可达中心比例约 33.3%/26.7%/24.5%，原为 61.4%/70.5%/81.9%。`code/comparison-final.json` 另给共同可达中心分母，避免新增 solid 删除站位造成的分母差异。它们只说明实体距离/净空下降。

### 原始失败与未验证

`stored-geometry-and-player-void.json` 保留第一次严格完整 mesh 比较的失败：attempt1 gel 的内容候选重试只改变 mesh.spec.seed，实际几何数组未变；后续 `attempt1-geometry-and-player-void.json` 按实际几何复核通过，最终证据单列，未覆盖旧失败。

正常肩灯下的开口/来路识别、记忆点、开放感和审美归主线程 CUA/Art/人审；本 QA 未替人勾选。真实敌人视距/朝向/听觉/警觉积累/脱追、全程自然搜撤、加载与 FPS、浏览器兼容性及其余 105 图的新空间体验均未在此复验。已保留作者安静区，不以全图指标下降代替这些验收。

### 建议

交付时用“局部实体结构增补、已记录完整身体通路与保留视线语义”陈述。继续保留 4 件未获双侧见证及无效原候选端点的失败信息；真实潜行仍需具名敌人、巡路相位和真实输入的运行证据。公共 game-state/evidence 的汇总由主线程登记，此目录只产出独立 QA 证据。
