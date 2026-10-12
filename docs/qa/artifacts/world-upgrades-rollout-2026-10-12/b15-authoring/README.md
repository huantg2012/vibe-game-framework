# B15 原生折片四图作者与生产记录

状态：内部构型准入与本批固定 seed 生产验证完成；不是人视觉终审，也不是全 seed 结案。

四图分别为 shard-switchback、split-fall、double-return、crushed-seam。策划源是正式 data/rift-spatial-*.csv 与 data/rift-search-sites.csv；archive/world-upgrades-b15-rectangles.csv、transforms.csv 作为冻结作者来源保留，不是运行期第二权威。

## 构型与原生关系

- Shard：原折片组保相对角度与间距，整体置于偏左宽床，右侧大面积缺席与左侧断口共同切入探索面；上下残床保留不等大的孔。
- Split：六折片保持对向坠落关系，整体位移到东南厚床，西北大面积缺席。上侧短肩和西南残床尺度不对称，非围合跑道。
- Double：低层底片与三块立片共用整体变换，置于宽厚中段；西南与东侧两片外部缺席交错，上下残床形成真实视线分隔。
- Crushed：两低层碎床和四固体折片完整保留，沿偏中竖向接合；东北大缺席与西南削失使外岸脱离完整大盘。

最终整体变换（world px，原角度不变）：Shard source 568,425 → target 1070,900，scale 1.23；Split 503.5,462 → 1420,1150，1.24；Double 553.5,436.5 → 1210,930，1.28；Crushed 557.5,411.5 → 1090,1020，1.25。原 family、shapeProfile、角色、构造版本、厚度高度等保持。

## 两轮作者证据

attempt1 与 attempt2 均保留。首轮 Shard 的上左孔切到真实三角面；二轮仅将该孔从 250,240 移到 225,225，尺寸 100×85 不变。其余三图冻结，未为过检改形。两固定 seed 20261012、20261019：共享编译确定；最终十字包络之外还检查真实三角，8 个样本均无 unsupported、无 crossing/enclosed-boundary clipped。

attempt2 的 silhouette、outer-filled、native-mesh-footprints 图片来自共享 fragment 与原生 mesh，蓝为 relief、棕为 solid，图中颜色不是灯场。root 已看实际足迹全图并准入生产。

## 正式登记和生产

在共享目录锁内按最新 CSV 只替换本四图：4 个布局、46 条矩形、22 个 source-once 原生摆放、32 个 anchors、4 条 search policies；三 codegen 均成功。详见 production-registration.json；anchors 预检覆盖两 seed、中心周围 40 world px 地面，以及额外原生固体包络避让。

正式证据：../b15-attempt1/。固定请求 seed 20261012，三档各四图，共 12/12 通过生产、内容配额、真 body 可达、资源来源、撤离和 recipe/recovery 检查。追加 footprints.json：12 个生产 definition 的真实原生三角检查均无 clipped。未更换请求 seed；准入 effective seed 见原 report。

Art 查看四图低档 material-points 全图：折片组身份、低地床接合和大缺失均在正式 surface 输出中保留，无肉眼明显截尾。此为 albedo/内容位置检查，不能被当作真实灯场；三档关系与受光终审仍按根批次流程记录。

## 冻结作者来源归档

本目录 archive 下的候选 CSV 已从根 data 移出，SHA-256 见 source-archive.json。它们只供历史重放与审查，运行时和正式 codegen 只消费 data/rift-spatial-* 与 rift-search-sites.csv。历史 report 的 source 路径保留生成当时的位置，hash 不变；compile-preview 已改读 archive，不会重新登记生产。
