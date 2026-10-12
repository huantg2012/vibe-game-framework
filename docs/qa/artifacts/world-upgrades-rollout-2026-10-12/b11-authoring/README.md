---
status: PRODUCTION-REGISTERED / FULL-PRODUCTION-VALIDATION-PENDING / HUMAN-REVIEW-PENDING
batch: B11
date: 2026-10-12
features: [COH-F011, COH-F012, COH-F013, COH-F019]
---

# B11：阶床与低台的正式作者交接

五世界来自队列 B11：bleached-court、chalk-steps、cork-shelves、lacquer-court、stepped-bowl。三 codegen 已完成；只动这些 world 的正式策划行、5个独立布局和对应产物。没有修改共享断缘算法或原生资产。完整三档/实际材质烘焙/正常灯场/搜撤体验由 root 接续，注册不是验收。

正式权威为 `data/rift-spatial-fragment-{layouts,rectangles,worlds}.csv`、`rift-spatial-{worlds,sectors,sector-layouts,sector-anchors}.csv` 和 `rift-search-sites.csv`。本轮候选 `archive/world-upgrades-b11-{rectangles,transforms}.csv` 冻结为作者来源，生产不消费，保留归档但不可作为生产输入。`production-registration.json` 保存共享锁内现读现写的行数与文件 hash；当时全库56注册只说明计数，不表示56图通过。

## 方法与图像证据

作者1152×896、worldScale=2。剪影全部由共享 `generateRectilinearFragment` 实编，不自画多边形替代。固定20261012/20261019，不换 seed；每轮保留源快照与编译报告。填孔外岸只取同一次编译的 outer，避免靠内孔掩盖矩形外轮廓。

- [最终含孔剪影](root-correction/silhouette-sheet.png)
- [最终填孔外岸](root-correction/outer-filled-sheet.png)
- [实际原生 XY 足迹](root-correction/native-mesh-footprints-sheet.png)

最后一图调用原 `buildNativeVolume`，保留每件 family、shapeProfile、constructionVersion、height/thickness/fold/branches/opening/distortion及方向后做同组平移缩放。棕色只显示真实三角面 XY 覆盖，**不是 albedo、碰撞角色区分或灯场**；solid不吞光，只有黑色VOID吞光。无需开整幅surface重进程。

`native-footprint-check.json`记录10例真实三角面顶点、沿面最多8世界px间距采样：65,974–95,031样点/例，越界均0。名义旋转包络也均0。前者仍不是实际8px栅格全覆盖、20px身体、内容配额或有效seed准入证明。40个 anchors 在双seed下各自做±40世界px九点地床留量及名义solid边外留量预检；修正3个靠随机断角的候选点，未削弱留量标准。

## 两次自检与 root 定点裁定

首稿保留 `attempt1/`。静态名义支撑虽全部通过，但四孔沿周边排列的倾向明显；第二稿把一部分孔接到外部缺失，保留 `attempt2/`。作者仍指出 Bleached/Stepped 整腹偏大、Cork 孔集中上沿，主动停止两轮自改并提交 root。

root 明确裁定第三稿：允许将这三图整个原生组偏置到剩余厚床，让空出的旧腹面成为真正的大缺失；原件相对位置、比例、方向全部保留。Chalk/Lacquer第二稿冻结。第三稿标为 `root-correction/`，不是无授权持续试图。本轮全程没有将单件拆散迁移、用solid补VOID或删失败证据。

## 每世界关系与最终变换

所有坐标均为世界像素，旋转delta=0；每图恰好保留原2件solid，无新增relief，无镜像、jitter或额外materialScaling。sourceIndex按原角色顺序，ID按原descriptor顺序。

- **Bleached / 白壳阔庭**：源中心(686,385)，scale1.30，目标从(1310,1090)移至 **(1150,770)**。大阶台和小低台一起移向北西厚床；西侧开放破口到作者x415、y455–615，东南大缺失从x560/y575起撤走，原腹面不回填。下方厚床仍有独立探索面与不规则孔，连接保留宽面。两台高低、材料及小台朝向不改。
- **Chalk / 粉白阶岸**：源(595,395)→(1110,1100)，scale1.28不改。偏右上厚床与偏左下主床连成斜向宽地；东侧深缺失x835/y350–630逼入主面，北西整块缺席。两颗粒阶台维持原相接，不能将粉白颗粒换成石板，也不改其solid角色。
- **Cork / 孔髓厚岸**：源(507.5,300)，scale1.24，目标从(1390,1060)移至 **(1690,900)**。纵台与横台共同右移上提；西南整片撤去直到作者x625/y450，原纵台占位成为缺失。上西厚床的孔移入宽探索面，右下内孔与真实巨构边错开。两台之间原有间距保留。
- **Lacquer / 漆层空庭**：源(490,305)→(1240,1130)，scale1.30不改。北东失地与西侧深口共同切入，留下斜向展开的主床；台与褶片仍在宽静面接合处，未沿主体补墙封庭。2处闭合孔并不说明VOID少；大部分观察阻断来自开放失地。
- **Stepped / 退阶环洼**：源(555,382.5)，scale1.26，目标从(1350,1030)移至 **(1550,890)**。双阶盆共同右移上提，西侧缺失深入原主场至作者x470/y375–555；右侧再留开放断口。左下宽床保持稳定厚度，内部复合VOID承担该侧观察分隔；主体的开口朝向和相互关系不变。

三个新目标已同步回作者计划对应行；其他世界行在共享目录锁内读取最新内容并原样保留。实际正式导入共59矩形、10原生placements、40anchors、5搜索策略；清除本5世界旧 authored-group 行，避免双来源。搜索来源保持实际当地family，sourceReach72/environmentCap12，peel偏好依次0.25/0.10/0.10/0.65/0.25，不根据世界标题改材料。

## 尚未由本目录完成

最终身体全可达、全配额部署、三档骨架一致、撤离候选场、VOID反事实视线、拾取来源支持与旧版本恢复仍待完整生产检查。正常相机翻前后受光、未预知出口的探索体验与用户审美终验没有在静态作者环节完成。

## 冻结作者来源归档

本目录 archive 下的候选 CSV 已从根 data 移出，SHA-256 见 source-archive.json。它们只供历史重放与审查，运行时和正式 codegen 只消费 data/rift-spatial-* 与 rift-search-sites.csv。历史 report 的 source 路径保留生成当时的位置，hash 不变；compile-preview 已改读 archive，不会重新登记生产。
