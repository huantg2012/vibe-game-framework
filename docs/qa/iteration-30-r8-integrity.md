---
status: IMPLEMENTED / UNIT-AND-ISOLATED-UI-RUNTIME-VERIFIED / HUMAN-REVIEW-PENDING
date: 2026-09-23
revision: working-tree on 50a1935
features: COH-F026 / COH-F033 / COH-F038
scope: R8-02 observation selection, integrity geometry, world/DOM readout lifecycle and fixed-100 semantics
---

# R8 完整度读数

## 依据与 Art 最短核对

已显式阅读 `CLAUDE.md`、code/art agent、`in-game-ux` 与 `game-state` skill，以及现行 UI Kit、architecture、净化点 spec、[R8 方案 §8](../design-notes/purification-scene-art-plan.md#8-完整度提示可观察与可操作分开)和诊断。观察了 [R7 全景](artifacts/iteration-30-r7/presentation-final/normal/01-main.png)；它只提供人物、肩灯、装置与亮暗地面关系的旧实景证据，不能充当 R8 实机画面。用户批准实施 R8，历史 skill 作为兼容经验，不设创作上限。

- **审美要解决什么：** 条仍是装置邻近的窄规，世界内填充 2×24px，外加 1px 暗轮廓；实际阅读面积退于核心内腔。候选灰青瓷/赭金/铁锈红采用 R8 原案，稳定与受损分工不依赖提高整块面板亮度。颜色必须由最终新场景复看，未签审美 PASS。
- **怎样读作游戏 UI：** 一个主要观察目标，接近但尚不能操作时只读状态，不增加 E。观察、短暂驻留、操作近看、返回有连续时序；危险/失效有文字与保留端帽，容量与效能分开。右侧投入、费用、资格与真实修复事务保持原机制。
- **怎样属于此世界：** 载体是实际设备旁的读数；世界规钉世界坐标，聚焦读数挂现有 `#dom-ui-root`。参考 Signalis 的克制读数、Darkwood 的世界留白，以及本项目迭代 11 的真实设备参与构图；不套科幻窗口、噪点外壳或全息装饰。新候选色只作用于这三模块完整度，不覆盖资金充足/不足色。

相关 U1/U3/U4/U6/U9/U11 的实现依据：单焦点、表名/数值/状态分开、完整人物包围盒、控制区和视口避让、已保留键鼠操作、逐帧投影与销毁解绑。清单和对比度门禁不等于用户审美认可。

## 实现边界

- `chamber-integrity-placement.ts`：点到实际多边形占地最近距离；核心新轮廓 `[-30,-92,32,3]`；固定 100 效能条件，真实 `hp/maxHp` 条长，颜色与状态字。可见矩形必须避开完整角色/持具/灯、设备、其他实体、控件及安全视口。
- `chamber-observation.ts`：复用同一 R8 authored architecture/foreground 实体面、仿射高度与投影关系做眼点到主体9个内侧采样点的线段求交；至少一处露出才可观察。眼点高度从真实主层/上层/坡道几何计算，route 名字不否决观察；地面已覆盖的建筑底多边形不冒充露出的墙。地板色/涂层和 AO 系数不是不透明墙。此为当前室内三体的可见面检查，不是闭合三维网格或通用视野系统。
- `chamber-integrity-lifecycle.ts`：120ms 稳定候选、44px 进入/58px 保持、当前可见目标优先、操作目标最高；保留旧目标到 250ms 驻留 +180ms 退出结束才交下一观察目标。实际不透明遮挡不保留显示资格。
- `ChamberModule`：E 资格仍由原 `update` 算法负责，观察单独输入；世界条160ms进入。世界与聚焦读数共用同一状态机，换观看尺度和安全换侧60ms退/140ms入；不插值经过人物。突然遮到当前条时立即归零，安全侧稳定60ms才重现；返回可取消旧退场。
- `allocation-panel.ts` / 局部 CSS：稳定、受损、危险、失效独立状态字；0HP端帽不把填充伪造为非零。聚焦位置使用当前 PRE_RENDER 投影，边界像素吸附、alpha 连续。关闭60ms完成读数交接后执行原返回镜头回调；重复关闭/支付输入被拦截，立即销毁路径清理所有计时器和订阅。
- 场景接线、真实可见面积/墙体判定、其他实体包围与核心绘制由主代理汇总；不修改玩法、保存和成长事务。

## 已运行机器验证

`node --import tsx tools/qa/check-i30-integrity-placement.ts`：**15,198 项通过**。

- 三轮廓全接近区域的完整人物避让；1.5/1.7/2/2.6/3 倍聚焦下设备、角色、投入区域、安全视口避让；无空间时暂隐。
- 0/24/25/70/100/115 HP ×100/115/130/145/200容量矩阵；100/100→100/115颜色不变、容量长度改变；0HP状态字仍为失效。
- 三候选状态色相对暗轨至少3:1、相对暗边至少4.5:1。此为局部信号下限，不声称整景任意背景都已人眼可读。

`node --import tsx tools/qa/check-i30-integrity-lifecycle.ts`：**113 项通过（最终补验）**。

- 独立技术复审发现不规则帧越过宽限边界会双显；最终改为从实际淡出开始计时，并将两套真实生命周期与选择器组合重放3组掉帧序列。原反例独立复验关闭，见[技术报告](iteration-30-r8-technical-review.md)。
- 119/120ms、44/45px、58/59px、250ms退出驻留与180ms退场所有权；近邻不抢当前目标，操作优先，遮挡即时剥夺显示资格。
- 核心旧失败点 `(253,318)` 按实际占地可以观察；斜边距离不是矩形近似。
- 160ms渐入、返回取消退出、E开关两套读数逐时刻无双显、60/140ms换侧、不跨人物飞行。
- 持具/灯突然扫入时同帧alpha=0、安全侧驻留重现、视口无空间隐藏、相机更新使用当帧设备边界。

`npm run typecheck` 与 `git diff --check` 通过。仓库未配置独立 lint 命令；TypeScript 启用 strict/noUnused/noFallthrough/noUncheckedIndexedAccess。R7专项最初因旧“25%=正常/40÷200=危险”断言失败，该断言已按批准的固定100效能合同改写并通过；不是未解释的回归。

`node --import tsx tools/qa/check-i30-observation.ts`：**21 项通过**。覆盖核心正前/侧前/原1px失败点、真实可站坡口、坡口 E 仍拒绝、右坡净化器视线、实际东侧高墙全遮、上层能看核心露出主体但不能绕过58px距离，以及矮承重挡低处/不挡高处的纯几何场景。

## 隔离实机验证

`I30_OUT=docs/qa/artifacts/iteration-30-r8/integrity-runtime-final node tools/qa/check-i30-r8-integrity-runtime.mjs`：**13 项通过，283 个实际渲染帧，0 页面错误**。服务 `127.0.0.1:3025`，新的1440×960 headless context，从正式首页进入，不连接用户浏览器、不读取用户存档；HMR客户端仅在这个测试context里隔离，以免并行作者保存资源强制重载。

- 原失败核心正前 `(253,318)` 经真实 WASD 到达，观察条可见、原 E 距离仍不满足。
- 核心真实 E/Esc 重复3次，储藏/净化器各1次；逐渲染帧总计283帧无世界/DOM双显、无角色/持具/灯/其他设备/标题/投入区覆盖，DOM留在安全视口。
- 独立 UI 数值夹具核对0/24/25/70/100/115与100/115、真比例、状态字、三色、世界0HP危险端帽和DOM0HP端帽。**夹具只改内存公开 module record，未广播全场视觉刷新；这些图不能验证核心活层、光池的受损强度。** 整场受损表现须使用主代理的seed-before-boot证据。
- 读数的 `100/115` 已实际观察：主值/上限/稳定状态分开，容量留空，费用区仍保持原色。候选信号与新核心并排看可找到、退于腔体；这是专项观察，用户终审仍未发生。

证据：[final manifest](artifacts/iteration-30-r8/integrity-runtime-final/manifest.json)、[说明](artifacts/iteration-30-r8/integrity-runtime-final/README.md)、[100/115 UI 实帧](artifacts/iteration-30-r8/integrity-runtime-final/03-hp-100-of-115.png)。首次运行记录保留在相邻 `integrity-runtime`：10ms测试E短于一帧未触发，使100/115前一项返回无DOM；改60ms正常按键后全部通过，未以该测试采样问题修改生产输入机制。

## 待主代理汇总

坡口/墙体的更多真实移动覆盖、真实100/100→100/115加厚事务、完整受损设备与读数同场、最终所有明暗地面的读色，由主代理的隔离运行证据补充。上述专项不能代替用户终审；本报告不标整轮 COMPLETE。
