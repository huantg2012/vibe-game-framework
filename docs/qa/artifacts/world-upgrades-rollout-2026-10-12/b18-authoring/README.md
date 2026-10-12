# B18 壳岸五图作者与生产记录

状态：内部构型准入与固定请求 seed 三档生产完成；不代用户审美，不扩大为全seed。

Scalloped 低片与三夹壳、Hollow 四残壳、Three 三层夹岸、Red 五壳碎段、Crossed 四壳交叉全部按原组整体同变换保留。第一轮 Crossed 西部VOID切壳，两轮作者中整体右移200 world px并给剩余右床增加承托；主缺失不退回。Red 北岸与相邻孔间两条10 world px残唇按root裁定接外岸、连孔，保留原两稿及root-correction。

最终作者证据在 `root-correction/`，矩形按1152×896 author、scale2经共享 rectilinear-fragment-v1 编译，保留20261012/20261019两固定seed与失败历史。实际原生三角 footprint、边相交、地形边界包入三角检查10/10均无clipped；保守包络不被当作真实材质。Scalloped的33/43个保守矩形越孔点对应非实际曲面，52840点与精确检查均0，不填孔掩盖。

source-once、原角色和形体特性保留；整体变换与8个anchor见 production-registration.json，预检见 anchor-precheck.json。正式权威为 data/rift-spatial-*.csv、rift-search-sites.csv；三codegen成功。本目录作者源仅归档历史证据。

正式生产：`../b18-attempt1/report.json`。5图×3档固定请求seed20261012，15/15通过生产、body可达、内容配额、节点来源、提取与recipe/recovery验证。追加 `footprints.json` 15/15无clipped。所有准入attempt/effective seed保留原报告，未主动换请求seed。

Art已看五图中档实际 material-points-sheet：膜/壳及其低层母体形状、接合与分离在正式surface输出保留；没有明显截尾或跨VOID悬浮。全图是albedo与诊断点，不能代替正常相机灯光评审。受光与翻后状态由最终正常相机图审另记。

## 冻结作者来源归档

本目录 archive 下的候选 CSV 已从根 data 移出，SHA-256 见 source-archive.json。它们只供历史重放与审查，运行时和正式 codegen 只消费 data/rift-spatial-* 与 rift-search-sites.csv。历史 report 的 source 路径保留生成当时的位置，hash 不变；compile-preview 已改读 archive，不会重新登记生产。
