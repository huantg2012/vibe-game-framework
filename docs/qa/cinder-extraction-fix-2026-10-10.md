# 余烬脊撤离选点修复

2026-10-10。COH-F011，关联F013/F014/F049；只修当前DEV空间样本。用户指出的出生旁撤离是bug，上一轮“近侧归返”解释与相关验收撤销；旧“两端原则”也被DEC-196覆盖。正式世界库、生成修订、保存身份不在此批改变。

## 修复结果

删除出生候选之间的近侧配对。撤离现在来自完整20px身体可达图：按八向最短路与直线距离筛掉出生附近，从合格距离层、空间区及格点按独立种子抽选。候选可以位于内区或外围、较近或较远的合格区域；不按固定对岸、对角、最远点选取。无候选与缺必要策略参数均明确拒绝。

选点写入最终MasterWorld定义并重新部署，真实撤离位置、表面样本、污染排除与诊断同源；断言二次生成没有挪位。去雾图的白环与金菱形仍显示真实位置，不是单独移动覆盖层。

- 默认20261010：出生(1476,1556)，撤离(556,204)。中心八向最短路1733.08px，进入48px交互圈的最早格点路径1683.14px；该次抽到较远北侧。
- 相邻20261011：出生(1980,636)，撤离(1156,900)。中心最短路1499.04px，交互圈1449.10px；此次撤离在图内，未固定到西侧对岸。
- 两个种子的面积、真实阻挡及原两组绕行闸门通过；30874个身体可达格、3.8348倍面积及1个孤立支持格保持。

## 独立执行与证据

[selection-check.json](artifacts/cinder-extraction-fix-2026-10-10/selection-check.json)记录8个出生候选×128连续/散列种子，共1024次撤离抽选；这是同一代表地形上的抽样，不是1024张完整生成图。

QA独立实现八向最短路并比较246992个可达格，逐段扫掠170473段（含68341个对角段）。最小交互圈格点成本920.333px，最小中心直线距离560.286px；每个出生得到120–128个不同撤离点，覆盖3–4个方向扇区、7–8个独立3×3空间区，内区/外围与全部3个路程层均有样本。每个出生都有偏离“朝地图中心对岸”轴超过45°的结果，也都有非最远10%结果。同种子复现、无候选拒绝、缺参数拒绝均通过；报告绑定最终四项源码SHA。

执行命令：

```sh
node tools/spatial-prototype/codegen.mjs --check
npm run typecheck
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/spatial-prototype/check.ts
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/spatial-prototype/check.ts 20261011
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/spatial-prototype/check-extraction-selection.ts
QA_OUTPUT_DIR=docs/qa/artifacts/cinder-extraction-fix-2026-10-10 node tools/qa/capture-spatial-prototype.mjs
QA_SEED=20261011 QA_OUTPUT_DIR=docs/qa/artifacts/cinder-extraction-fix-2026-10-10/seed-20261011 node tools/qa/capture-spatial-prototype.mjs
```

Chrome复用实际原生渲染完成去雾/路线/实体/原始像素/全图控件检查，浏览器错误为0。主图与Node同种子指标一致。设计子代理只读复审确认没有近侧回退/固定两端，也没有只改标记；指出报告测试SHA变动，QA最终重跑后四项全部匹配。

- [默认种子全图](artifacts/cinder-extraction-fix-2026-10-10/clean.png)、[路线](artifacts/cinder-extraction-fix-2026-10-10/routes.png)、[浏览器实录](artifacts/cinder-extraction-fix-2026-10-10/capture.json)。
- [相邻种子全图](artifacts/cinder-extraction-fix-2026-10-10/seed-20261011/clean.png)、[浏览器实录](artifacts/cinder-extraction-fix-2026-10-10/seed-20261011/capture.json)。

游戏现状文本已登记DEC-196及E210，并生成INDEX；结构校验通过，旧来源基线的798条漂移/覆盖提醒保留。本次仅核对相关功能，未以全库baseline刷新掩盖历史变化。

## 结论边界

通过的是当前DEV选点bug的有限物理与分布检查。8px格点图不是连续任意走法的精确下限，样本分散不证明玩家无法归纳概率偏好。普通solid阻身体不等于阻视线；去雾图不证明未知撤离点不会经光源、小地图或刻记提前泄漏。正式推广前须检查这些发现信息与迷雾下完整搜撤；敌人/资源重部署、内容密度、经济、用户可玩性认可和I14/P49收口仍待，不由本次PASS提升。
