# 中尺度实体增补：Code 证据

范围为 `split-rib-causeway`、`gel-rafts`、`sloughed-court`，请求 seed `20261012`。本目录不表示 128 世界已完成增补，也不表示普通 solid 已具备敌人视线遮蔽。只新增离线诊断工具；本角色没有改生产算法、CSV 或生成表。工具说明见 [README](../../../../../tools/stealth-obstacles/README.md)。

## 冻结和旧局回放

[前态](before/baseline.json)保存三图 × low/medium/severe 的 9 个 r10 完整配方与完整地图哈希。每图 medium 另存 intact/searched 四通道 RGBA、完整翻找补丁、实际材质 PNG 和可离线复用的地图。

CSV 首轮及最终校正后分别实际重生成旧配方，均为 **9/9 完整地图一致、3/3 中档两态全部 RGBA 通道与翻找补丁一致**；材质源文件字节也一致。最终报告是 [after-final-old-replay.json](after-final-old-replay.json)，首轮为 [after-old-replay.json](after-old-replay.json)。未以“字段已冻结”代替实际回放。

新局首轮后态为 [after](after/baseline.json)，最终形体后态为 [after-final](after-final/baseline.json)，各只捕获三个 medium。所有原始结果分目录保存，没有替换失败 seed 或覆盖前态。

## 几何与空白

[最终对照](comparison-final.json)证明三图所有原有 instance、原有 mesh 逐项一致，真实 VOID mask 一致；新增数为 5/6/6。共同可站中心上的 VOID 距离也逐项一致。当前可站区域因实体新增缩小，故其 VOID 分位值可以变化；对照同时保留相同分母的共同可站中心指标。

按各自当前可站中心统计，三图距真实 solid >224px 比例分别由 **61.39%→33.29%、70.45%→26.74%、81.87%→24.47%**；solid 距离 P90 为 **570.00→474.78、668.64→332.99、1135.79→328.47px**。

最大空白半径 `min(solidDistance,voidDistance)` 为 **268.00→204.35、290.93→209.18、316.03→267.50px**。这是 8px 采样的空白诊断，不能改称“潜行覆盖”。真实 solid 三角占地与真实 VOID 边分别测量；groundEdge 与 relief 不算实体，bbox 只用于加速查找。两个明确阈值的最大连续采样区与局部极值坐标也在报告中，不冒充精确连续多边形面积。

全图、Art 的全部指定区域及标点图见 [regions-final](regions-final/summary.json)。双脊东北区域 solid P90 为 587.50→120.73px，西南为453.23→158.21px；保留的南侧开放床数值不变。

## 通路证据与未验证范围

最终三个地图均通过实际 **20×20 玩家身体**的 spawn→extraction 连续扫掠。严格双侧见证覆盖 **8/8 作者关系组、13/17 新实体**，清单见 [group-witnesses-final.json](group-witnesses-final.json)，路径图和逐段结果见 [witnesses-final](witnesses-final/summary.json)。

双侧判定要求真实 named-solid 三角内部有锚点；两路在相反半平面内，沿起终轴不后退，闭环对该锚点 winding 为 ±1，且每段均以生产身体碰撞连续扫掠通过。它不只检查两个候选点位于线的两侧。

**未取得单件见证：双脊 id4/id7，Gel id8/id12。** 有限候选搜索失败不证明物理阻断，这四件也不能写为通过；各自所在关系组已有其他新件的严格双侧见证。全部候选成功/失败见 [witness-search-final](witness-search-final/summary.json)。

Art 原建议区域端点中，Gel 西南/东侧各有不安全端点，工具明确保留失败；其余 6 条指定区域路线通过。没有默默移动这些端点，也没有让候选失败导致替换世界或 seed。对应 Gel 两组仍有独立实体双侧见证。通路存在、形体绕行和敌人视线遮蔽是三件不同的事。

## 工具验证

[checks.json](checks.json)记录生产与工具 TypeScript 检查、所有自有 JS 入口语法检查、五组合成诊断控制、已有 native-body broad-phase 边界测试，以及 dev 实际 Chrome 启动。浏览器首页画布正常，0 page errors；此启动冒烟不是自然游玩评价。项目无 `npm lint`/`npm test` 脚本，未声称运行不存在的闸门；采用 strict/noUnused、语法检查及相关既有测试。

QA 独立发现的两个工具问题已修：请求路径失败现在汇总 `failed` 并退出 1；“北侧连接边界的墙，两条所谓双侧路线其实都走南侧”负控现在拒绝。正例、反例、bbox 空洞、VOID 分账和 groundEdge 排除均有合成控制。独立 QA 的复验属于相邻 `qa/` 目录；本报告不以工具自身测试替代其结论。

没有生产 LOS、FOV、导航或恢复语义变更，没有生成修订升级。美术终审、正常游玩和后续世界推广由各自独立证据决定。
