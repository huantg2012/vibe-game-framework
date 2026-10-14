# G5 动态 AI 证据工具准备记录

日期：2026-10-14。状态：**工具自检通过，尚无 r12 代表地图动态结果；G5 未通过。**

所有改动限于工具及本目录 `ai-*` 证据；未修改游戏源代码、敌人数据、地图生成参数或全貌/进度文档。

## 执行入口

```sh
node tools/native-spatial/check-live-ai.mjs --self-test NEW_SELF_TEST_REPORT.json
node tools/native-spatial/check-live-ai.mjs PASSED_CAPTURE_PRODUCTION_RECEIPT.json NEW_AI_REPORT.json
```

正式入口要求 `capture-production.mjs` 输出 `status=passed`、`sourcesStable=true`，读取其完整 `.map.v8.gz` 与冻结 `.recipe.json`，核对逐字段地图 hash、revision 12、重新编译的支撑几何。输出禁止覆盖既有证据。不会自行生成地图、换种子或调用未登记的留出种子。

运行器用 esbuild 打包当前生产代码，将 `import.meta.env.DEV` 定义为 false；只有 Phaser 显示入口使用已存在的离线 adapter。实际物理直接读取当前安装版 Phaser 的 `Body`、`World.updateMotion` 与 `SeparateTile`。

## 实际执行与替代边界

- 使用正式 `AISystem.create / update / postUpdate`、`Enemy` 构造、ActivityClock、感知、FSM、GridPathfinder、巡逻路径和接触分离。完整地面敌群及原始 form 不删除、不重排；逐个断言巡逻未退化为静止哨兵。
- 敌人以正式 8 px TileGrid 移动墙体及 Arcade tile 分离约束；视线使用 native 的 VOID-only sight。玩家以 `NativeBodyCollision.resolveMotion` 执行真实 20 px 身体扫掠，不能横穿孔洞或实体。
- 无显示图像和 SceneManager：以固定 60 Hz 适配调度物理，Enemy.syncVisuals 不绘制。该调度不能冒充浏览器实玩或帧率测试。
- 玩家碰到真实静止敌人身体则本试验拒绝，不允许忽略硬碰撞穿过去。当前工具未重建该接触后的完整用户操作。
- 不包含宿主类墙面/体积污染、Combat 伤害死亡、玩家工具、混乱持续积累、灯光/镜头读法，因此输出至多 `bounded-ai-evidence`，不是完整 G5 或通关证明。

## 事先固定的对照

每图按敌人 ID、孔 ID 稳定次序，选择最多前三个几何上合格的遭遇。G2 的 q/v 必须针对**该真实敌人的生成位置**成立：q 被该孔挡住，v 可看到敌人，均在 224 px 内；单孔 LOS 消融证明归因。选择只读几何，不能根据谁好躲挑样本。

直接路线为 q→v 的真实身体路径；孔绕行需额外至少 80 px、总长不超过 720 px，且与直接路线构成的闭合环包含该见证的真实 VOID，避免把原路折返冒充绕孔。没有可用遭遇/替代路径时保留拒绝理由，记证据不足。

动作固定为直接穿越、原地等 3 秒后走相同路线、经该孔另一侧绕行、观察后沿可走路径撤回。对每个遭遇跑完整的 0/2/4/6 秒巡逻相位；敌人均真实推进，不改朝向。相位准备阶段玩家在原生成出生点，局部试验开始才放到 q：这是明确的局部遭遇夹具，不是连续从出生走到 q 的证据。

常态混乱 0 与恶化快照混乱 100 均使用正式 `getChaosModulators` 的玩家速度，未自造敌人增益。两条件、四相位、四动作全部保留，不删差结果。

记录逐个真实感知 tick 的视觉暴露、最长连续暴露、听觉命中、听觉积累、察觉峰值、追击时刻、接敌时长、最近距离、状态变化及 250 ms 轨迹。敌人到观察位/退路的真实身体路径及路径÷追击速度列出为**理想时间下界**，不能把它当成可靠安全余裕。

## 已执行的检查

- `node --check`：两个新 `.mjs` 通过。
- `ai-harness-round1.json` 与 `ai-harness-final-self-test.json`：harness 自检通过；真实守卫巡逻移动 **84 px**，**30 次**真实感知 tick 看见玩家，最后进入正式 `chase`。最终证据源指纹稳定。
- 已有 `tools/contamination-lexicon/check-physics-runtime.ts`：通过（真实 Arcade 分离、120/60 cadence、销毁重建）。
- 已有 `tools/inventory/check-muffle-live-perception.ts`：8 项通过（真实听觉、可见目标、噪音及伤害优先级）。

尚未运行正式地图入口，原因是编写本记录时尚无通过的 r12 生产地图 receipt。该入口的遭遇选取、批量动作、源指纹及地图缓存联动需要第一份通过地图进一步执行验证；不将只写出的代码登记为已验证。

本工作未修改 npm 应用源；全仓 typecheck/build、lint 是否存在以及 `npm run dev` 的总任务收尾由主任务统一执行，避免并行改动中的重复全仓检查。本记录不声称这些闸门已由此子任务跑过。
