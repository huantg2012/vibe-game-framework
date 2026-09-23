# I30 R9 几何、观察与真实键盘回归

日期：2026-09-23。Feature IDs：COH-F026、COH-F006；关联 F033/F038/F039/F042。

## 版本与范围

- 代码：`22cf10fe5b695b69e6db5433903a05686d720508` 之上的 **R9 未提交工作树**，不是 R8 提交本身的验证；净化点新布局、观察与相应表现源码已修改。
- 合同：[I30 R9 任务](../tasks/iteration-30.md)、[移动/观察规则](../specs/system-movement-vision.md)。实现：[布局](../../src/systems/purification-chamber-layout.ts)、[运动](../../src/systems/purification-chamber-locomotion.ts)、[观察](../../src/systems/chamber-observation.ts)。
- 结论：本报告覆盖的新几何与有限运行回归通过；**不宣称美术、首次导航、声音或完整游戏体验通过**。总体构建由主任务另行记录。

## 自动检查

1. `node --import tsx tools/qa/check-i30-chamber-movement.ts`：**7,811** 次运动/脚底支撑检查通过。覆盖原脚半径6、完整八向同速、墙/设备切向滑动、圆角绕行、跨断层大帧不穿透、30/60/120 fps 双坡六点连续环路、坡上横移/停/反向、同层与实体阻挡的 E 资格、输入冻结/异常值、5,000 帧确定性输入流。支撑还以独立绕数和48点足周采样检查，未仅依赖运动求解器自己的结果。
2. `node --import tsx tools/qa/check-i30-observation.ts`：**22** 项通过。覆盖核心前侧近处、左坡可观察但不可 E、右坡看净化器、上层看高核心但仍受距离限制、主/上层和两坡中点高程，以及独立高墙/低承重面/无几何涂层/绕墙边的射线反例。
3. R9 核心壁龛的 `(141,245)`、`(141,260)` 是**墙内/墙后几何探针，并非合法玩家位置**；距离50/35仍不能穿真实墙观察。原 R8 右墙测试坐标随旧建筑失效，改用 R9 实际封闭壁龛承担相同的遮挡反例，未降低近距遮挡要求。
4. 共享键盘导航器另以30/60/120 fps 模拟 WASD 组合完成实际路线，分别466/825/1,619帧，所有逐帧脚底支撑合法。该项是无浏览器键盘向量模拟，与下面真实浏览器结果分开。

路线固定点与分段路径集中在 [i30-chamber-driver.mjs](../../tools/qa/i30-chamber-driver.mjs)，由纯运动和运行脚本共用；六设备按原尺度保留。本轮未发现新布局中六操作点或双坡的通行阻断。

## 正式入口真实键盘

- 执行：`I30_OUT=docs/qa/artifacts/iteration-30-r9/runtime I30_LABEL='R9 compact offset layout' node tools/qa/check-i30-chamber-runtime.mjs`。
- 环境：macOS Chrome headless / Playwright，独立空存储，1440×960 viewport；`http://127.0.0.1:3025/`。执行时间 `2026-09-23T10:43:55.544Z` 起。Vite `@vite/client` 被拦截，避免并行美术编辑导致运行中热重载。
- 从标题 Enter 正常进入净化点；仅真实按键，读诊断指导路线；没有注入存档、传送、加资源或修改时钟。
- 六处均真实步行到达、正确提示、E 打开、面板内移动冻结、Escape 关闭且人物位置保持。
- 从储藏绕到核心后方：设备淡出至不高于0.5、人物alpha保持1；向下走被核心底座挡住；绕前恢复设备alpha1。
- 左坡真实横移、松键停、立即反向，坡上E不能打开装置；经上层蜕变/供奉，再走右坡回主层。
- 裂隙备行用 Shift+Enter 正式出击；对本次实际出生地读取地面合法性后，以原WASD分别验证纵向和横向移动。
- `pageerror=[]`，脚本退出0；浏览器执行后关闭。

证据：[manifest](artifacts/iteration-30-r9/runtime/manifest.json)、[完整按键与状态日志](artifacts/iteration-30-r9/runtime/journey.jsonl)、[主场景](artifacts/iteration-30-r9/runtime/01-hub-main.png)、[核心后方](artifacts/iteration-30-r9/runtime/04-behind-core.png)、[坡道停反向](artifacts/iteration-30-r9/runtime/08-ramp-width-stop-reverse.png)、[进入Rift](artifacts/iteration-30-r9/runtime/13-rift-topdown-regression.png)。其余六面板与环路截图同目录。

## 限制与后续适用性

首次沙箱内 Chrome 启动被 macOS 终止，未进入游戏；随后在允许启动浏览器的执行环境中完整运行通过。不是游戏运行故障。

本次场景是启动时载入的 R9 工作树；并行美术后续修改不能自动继承本报告的截图结论。路线和观察检查应在几何/实体面再变时复跑。上述几何路线未验证修复付款、蜕变购买、供奉成熟、出击后回基地、读档恢复、全随机世界或长期性能；下面追加覆盖单次受控修复和菜单重载，其余范围仍未覆盖。旧 R3/R8 的其他专项脚本仍有旧坐标，重新执行前需迁移，不用旧坐标失败推断新生产缺陷。

## 追加：活动驻留、生命周期和一次受控修复

执行 `ARTIFACT_DIR=docs/qa/artifacts/iteration-30-r9/motion-play I30_URL=http://127.0.0.1:3025/ node tools/qa/check-i30-r8-motion-play.mjs`，脚本文件名沿用历史，核心路线已改用当前共享 QA 操作点。版本仍为上述 R9 工作树；启动时间 `2026-09-23T10:48:46.933Z`。正常与损伤场景分别使用新建隔离浏览器 context，Vite HMR 被阻断；未读取或修改用户浏览器存档。

- **正常场景**：真实驻留31.187秒、139采样；六物分别出现16/16/10/16/10/14种帧（裂隙/培养/供奉/净化器/储藏/核心），活动缓存统计不变。
- **暂停和减少动态**：暂停1.1秒前后整个活动/灯光快照相同；减少动态1.6秒前后六物姿态与待机发光相同。
- **三次菜单载入**：每次真实打开暂停菜单并点击“载入已保存的记录”，场景重建后均只有6个活动纹理，未累积旧纹理。
- **损伤场景**：注入仅属于隔离 context 的受控开场记录（核心24、储藏0、净化器70、薪柴100）；真实驻留31.120秒、137采样，六物均有活动变帧，缓存统计不变。该损伤不是自然出击所得。
- **一次真实修复**：键盘走到当前核心操作点、E打开、右方向键投入1薪柴、Enter确认；保存值由核心24→28、薪柴100→99。2.1秒内31次采样确认关入口→聚集→安定三个修复阶段及退出修复回到待机。
- 两例均退出通过，`pageerror=[]`；浏览器和两个context均已关闭。记录的11份生产源码起止SHA-256一致，包含R9三块作者源、schema、布局、外景活动和共用绘制/活动/光照实现。

证据：[总manifest及源码指纹](artifacts/iteration-30-r9/motion-play/manifest.json)、[正常观察](artifacts/iteration-30-r9/motion-play/normal/observations.json)、[损伤/修复观察](artifacts/iteration-30-r9/motion-play/damaged/observations.json)、[正常录像](artifacts/iteration-30-r9/motion-play/normal/normal.webm)、[损伤修复录像](artifacts/iteration-30-r9/motion-play/damaged/damaged.webm)。

以上是有限行为/生命周期证据，不代表美术通过、长期性能认证、自然经济循环、供奉成熟、蜕变购买或完整恢复矩阵通过。录像为静音浏览器输出，未评价声音。
