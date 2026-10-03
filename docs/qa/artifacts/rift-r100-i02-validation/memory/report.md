# QA Report：I02 受控 GC 与原生场景重建

日期：2026-10-03。Feature：COH-F052 / COH-F049 / COH-F012 / COH-F041。

标准：`docs/tasks/rift-r100-i01.md:84` 的十次进退后 GC 保留增长 ≤10MiB；`docs/tasks/rift-r100-i02.md` 的原生生命周期要求。测量基于 `da653887` 工作树，I02 主体实现为 `03d4e4c`。运行时正在并行推进其他代码，因此除 7 个生命周期源文件的 SHA-256，还记录了实际载入的 **304 个模块响应哈希**，不以 HEAD 独自冒充整棵运行源码。

**结论：本次同页原生场景重建的受控 GC 增长检查通过。已验证真实存活对象图及外部 backing，不再仅以 Phaser 注册数量稳定为据。未发现本范围内旧世界、材质 Renderer、Canvas 或 Audio 对象累积。此结论不覆盖 GPU 驱动物理占用、全部浏览器原生分配及所有压力声部的长时行为。**

## 环境与方法

- macOS arm64，独立 Headless Chrome `154.0.8037.93`；1280×900 / DPR1，游戏逻辑 960×640、镜头 1.5。新建隔离浏览器上下文，没有读取、操作或写入用户现有浏览器和存档。
- `/rift-r100-masters.html`，专用 Vite 3039，关闭 HMR 和文件监听，避免并行开发重载污染生命周期样本。页面的 `history.replaceState` 导致的 URL 记录不代表整页重载。
- 先走三家族×三级九格、加载全部三张材料缓存；以 `broken-shell/severe/20261002` 的已预热状态作基线。
- 真实按钮完成 **10 次同配置重建**，再完成 **12 次跨家族/等级/双种子的配置选择**。部分选择涉及先改家族再改等级，因此相对基线共实际创建 28 次新材质 WebGL2 context；不是只改诊断文本。
- 每次先正常运行，再通过原生暂停按钮暂停以固定采样条件；间隔两个任务调用两次 `HeapProfiler.collectGarbage`。保留每次 GC 前后 `Runtime.getHeapUsage`、DOM 状态、资源注册及弱引用回收记录，共 23 个样本。
- 预热基线、同配置末端、混合末端各有一个完整 CDP 堆快照。独立解析器逐节点检查实际 World、Phaser、Presentation、Renderer、Audio，并沿 `material.pixels → buffer → backing_store` 遍历真实缓存。
- WeakRef 追踪表只保留弱引用和原始计数，不强留被测对象。追踪记录自身在运行中增长，包含于读数，没有从测量中扣除它以取得更好结果。

首个 3027 尝试在预热时被 HMR 整页刷新中断，未产生有效基线，原始失败保留在 `invalidated-hmr-attempt.json`；它不是内存失败，也未混入本次结果。

## 测得的保留量

预热后 V8 used 为 **39,756,408B**、外部 backing 为 **53,913,725B**、embedder 为 **3,263,760B**。十次同配置后分别为 40,056,300B / 53,913,740B / 3,182,016B。混合末端分别为 40,256,680B / 53,913,740B / 2,994,848B。

这三个指标分别保留。额外将它们相加作为保守的“观察包络”，并不宣称这是无重叠、涵盖全部进程的物理占用：

- 与同一配置基线比较的 15 个样本中，包络最大增长 **596,999B（0.569MiB）**；末端增长 **231,375B（0.221MiB）**。
- 单独的 V8+backing 最大增长 **662,047B（0.631MiB）**，也低于 10MiB。
- 原生堆图的 `system / JSArrayBufferData` 三次均为 **31,001,856B**，没有逐次累积。
- 运行错误和警告均为 0。

绝对值包含 Phaser、程序、已加载资源与验证工具，不能用约92MiB页面包络否定“单世界新增 CPU ≤64MiB”，也不能用该包络代签整个浏览器的 CPU 预算。此前显式世界缓冲预算与这里的增量生命周期观测是不同证据。

## 实际对象回收与缓存

三个堆快照均只有 **1 个实际 MasterWorld、1 个 MasterPresentation、1 个 MasterSurfaceRenderer、1 个 MasterMaterialAudio、1 个 RiftScene、1 个 TextureManager**。旧 World 的对象 ID 已消失，新 World 是新 ID；解析器排除了 V8 的 `system / Hole` 对象字面量模板，不把模板当第二个世界。

材料缓存始终只有 ash-strata / crystal-fibre / ivory-basin 三份。三次快照中它们的材料、pixels、ArrayBuffer、backing store 对象 ID 都完全相同，实际 backing 每份 **1,048,576B**，总计 **3MiB**。这是真实 GC 后图上取数，不是根据 512×512 尺寸推算。

原生堆图和弱引用回收记录一致：

- 材质 WebGL2 context 从累计12个增至40个；末端 **39个已回收，仅1个存活**。Phaser自身 WebGL context 保留1个。
- Canvas累计301→385个，已回收37→121个；实际存活始终264个。它包含未挂 DOM 的画布，与 DOM Canvas 3个及 Phaser注册Canvas260个不是同一个统计口径。
- 实际存活 GL texture 364、program32、buffer11、framebuffer69、renderbuffer69均保持。已调用 delete 的当前两份shader仍可被已链接program持有，销毁旧program后旧shader被回收，未将此正常语义判为泄漏。
- AudioContext始终1个，已解码AudioBuffer49个始终复用；Gain6个、Panner2个、StereoPanner2个保持。累计133个AudioBufferSource在末端暂停/GC后全部回收。这覆盖本次实际启动的原生/环境声音，不自动扩大成所有接点压力声部完整循环。

## 尚未覆盖与证据边界

1. 末端详细 memory-infra dump **成功**，原始 trace 保留；但只有末端，没有对等预热基线，而且采样在三次堆快照之后，包含分析器与浏览器缓存影响。因此不能用它声称 GPU/driver 无增长或通过完整原生内存预算。
2. WebGL删除/失去context及wrapper真实回收证明生命周期链有效，**不等于读取了显存物理字节**。单世界GPU估算 ≤64MiB 仍依赖单独容量核算，不在本报告升级为驱动实测。
3. 本次为原生 DEV 场景同页重建，保留单个Phaser Game与预载音源；不覆盖正式出击/回收的所有状态、整应用关闭、跨设备、Safari/Firefox或数小时压力。
4. 各轮主要从出生点短时运行，不能代替材料声音耳距内完整周期的声景/混音/音画同步审查。声景专项应另取实际路线和声音证据。
5. 不将以上工程结论写成用户审美认可，不提升 108世界或324等级资格数量。

## 复现与产物

先启动同仓库、关闭HMR的独立Vite，再执行：

```sh
GAME_ORIGIN=http://127.0.0.1:3039 node tools/world-study/probe-master-retained-memory.mjs
node tools/world-study/analyze-master-retained-memory.mjs
```

可通过 `PLAYWRIGHT_MODULE`、`CHROME_EXECUTABLE`、`OUTPUT_DIR` 覆盖当前机器的工具路径。重建次数可增加，不能少于10。

- `controlled-gc-memory.json`：完整23次读数、实际模块哈希、回收轨迹、比较与堆图摘要。
- `heap-graph-audit.json`：三个快照的真实World与缓存对象/背板ID、字节数。
- `*-heap-summary.json`：逐类型存活量与大对象摘要；长source-map名称截断并另存完整名称哈希，原值在原始堆中。
- `*.heapsnapshot.json.gz`：三个可还原的完整堆快照，约36MiB压缩总量；使用Chrome Memory面板前解压。
- `memory-infra-attempt.json.gz`：成功的末端原生分配trace；不能作为前后差值。
- 两个QA工具的 `node --check` 通过，实际图解析断言通过。该验证没有修改游戏源代码；完整游戏build及回归由本轮主任务统一执行。
