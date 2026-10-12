---
status: PRODUCTION-REGISTERED / FULL-THREE-GRADE-VALIDATION-PENDING / HUMAN-REVIEW-PENDING
batch: B04
date: 2026-10-12
features: [COH-F011, COH-F012, COH-F013, COH-F019]
---

# B04：早期层板与混材的作者候选

本批只有 `schist-shear`、`laminate-shell`、`film-laminate` 三世界。经 root 定点裁定后已接入正式 `data/rift-spatial-fragment-*.csv`、sector 相关表及 `rift-search-sites.csv`，三 codegen 已生成。正式 CSV 是生产唯一权威；[archive/world-upgrades-b04-rectangles.csv](archive/world-upgrades-b04-rectangles.csv) 只冻结为本轮作者来源，已移入作者档案，不能继续独立编辑。没有修改原生素材定义、生成器逻辑或别的世界行。

当前交接：三世界已注册，等待 root 完整三档验证；注册和作者图审都不等于用户视觉验收。两轮作者自检已经结束；其后仅执行 root 明确授权的 Film 两处薄唇删除，记为 `root-directed correction`，没有第三轮方向探索。失败与修订前图片均保留，不换 seed 掩盖问题。

## 坐标、材料与生成方法

作者帧为1152×896，固定worldScale=2，实际世界帧2304×1792。队列2400×1900是构图意图范围，不把它错误复制为本编译器frame；三组原生变换仍使用队列表给出的世界像素坐标。矩形行全部为作者坐标；实地取点、碰撞和资源配置不能直接消费这些数值。

执行入口 `compile-preview.mjs` 直接读取候选CSV、现有作者计划和 `rift-native-worlds.csv`，调用共享 `generateRectilinearFragment` / `rectilinear-fragment-v1`，不另写修边算法。`silhouette.png`是实际编译轮廓，`outer-filled.png`只从同一结果中去掉内孔以检查外岸，`native-envelopes.png`在实际轮廓上叠原尺寸旋转包络作位置诊断。后者**不是实体渲染，不是材质图或正常肩灯画面**。

每个实例包络按源长/宽、原角度和队列统一变换导出，再留16世界px边量；每4作者单位采样检查是否仍有地床。即使此预检全部留在地床上，也不证明真实三角面/材质alpha、20px身体、8px支持、VOID视线、完整内容配额或恢复准入；原生模型可能超出名义矩形，必须由生产验证继续检查。

已用固定seed20261012、20261019各编译一次并重复调用确认确定性；两个attempt均未挑换seed。attempt1有6个编译结果，但Schist/Film包络发现压缺地；attempt2的6个结果包络采样均无越出。编译报告是几何预检，不含审美通过。

## 三个独立构图

### schist-shear · 层片剪切带

布局 `schist-crosscut-remainder-v1`。主宽床沿中东横铺，西南厚床下伸，与北/东较短厚肩不等量。西侧开放缺地在作者y405–570进入原连续西床，西北大块没有补回；右侧另一处开放失地截断东缘，不做四边包住整盘的轮廓。西南厚床内部是一处160×80与90×70错接的主复合孔，另有北、东、东南不同尺度孔，闭合孔数4。不是把四个等大孔按象限摆在外沿。

原实例各一次：1 relief + 2 solid，材料均为folded-slab。以世界(598,422.5)为源中心，统一1.30倍移至(1320,960)，方向不改。主层片斜向与较低第二片形成可指认接续，VOID不得切低床与主片的接合。第一次主西缺口碰到relief包络尖端3个采样，第二次将小续口终点375退到355，保留大缺失同时恢复接合留量；没有挪动单件实例掩盖穿孔。

看片判断：填孔外岸仍为西南/东北不等厚的偏置残床；西南复合孔进入该次床的探索面。较完整中段承担原生层组，不能以两件solid抵充吞光。实际几何加入后若中段仍被读成完整大腹，需root定位是宏形还是原生组映射，不再自行增加一圈外围小孔。

### laminate-shell · 层片包壳

布局 `laminate-embedded-eastbed-v1`。中部偏下厚床与右上较宽肩接合，西南整角逐级撤去；东侧作者x825起、y450–610的开放缺失深入原厚床，使上下东床不再一整面补齐。西肩、西北端、东北和东南缺地尺度不同；较大复合孔位于东北/东南厚床内部，不把所有孔画成统一层片形。闭合孔数6；不以这个数字作为密度验收。

原实例各一次：1层板relief、2层板solid、1壳solid。以世界(561.5,422.5)为源中心，统一1.25倍移至(1190,1050)，保留嵌壳与上下层板相接。东侧大缺失退在壳名义包络之外，不能沿壳外形挖环沟，也不能把壳腔称作VOID。第二次把中腹东侧原浅缺扩大成开放失地，先前孔向北挪开，避免其与新岸缺合并成包围单件壳的长沟。

看片判断：外岸不靠切四小角成立，西南缺席与东部大缺失都在填孔图中可见；北东和南东床仍以宽面联系主床。是否在真实壳体加入后留下顺畅的多侧换路、而不是低片旁唯一窄带，必须检查最终身体导航，包络图不能代替。

### film-laminate · 膜覆层片

布局 `film-northwest-overlap-v1`。西北较完整上床与南部横床大面积重叠；东北一整段缺席向南伸入，西侧又从作者y455–635侵入主面，两个开放缺口不是同宽对称切口。上床主复合孔比上端小孔大，南床只有偏左的一处内孔；其余观察断口由开放岸缺承担，闭合孔数3。这里减少闭合孔是将西侧小孔改为更大、与外部连通的失地，不是拿solid补上吞光。

原实例各一次：层板relief + 层板solid + 膜relief + 膜solid。以世界(618,410)为源中心，统一1.30倍移至(1270,1140)，保留低膜覆盖板面、次膜从相接端铺开的关系。第一次北口压到主solid包络32/41个采样；第二次北口横移至x715，原方向、覆膜接点和实例尺寸均未改。原生组整体偏下，上床不是围某个单独障碍造房间。

**两处薄唇已按 root-directed correction 去除。** 第二次看片在西缺口底部看见作者x150–200/y635–645的50×10残条；东缺口上沿有x915–1000/y540–545的约85×5残条。它们不是宽肩，原编译拓扑合法也不能算合格。root明确裁定后仅修正 `land-05.height:205→195`、`void-02.y:545→540` 及 `height:100→105`（孔底保持645）。`root-correction/` 两个固定 seed 续编均成功；亲看 Film 20261012 含孔、填孔、名义包络三图及 20261019 含孔图，两段悬出薄唇均消失，主岸缺与接合关系仍在。全部六个作者编译结果名义包络越出为0；这仍不代替真实原生三角面支撑检查。

## 已看的图与版本

attempt1看三世界20261012的填孔外岸、含孔剪影、实例包络共9图；自退原因和首稿源保留在该目录。attempt2看同样9图，另看三世界20261019含孔剪影3图，共12图。两轮各自有 `report.json`、每世界每seed的实际 `geometry.json` 与 `rectangles-snapshot.csv`（只读证据副本，非可编辑策划源）。

定点修正后的作者查看入口（正式完整生成证据由 root 后续批次目录给出）：

- [Schist：含孔剪影](root-correction/schist-shear-20261012/silhouette.png) · [填孔外岸](root-correction/schist-shear-20261012/outer-filled.png) · [名义包络](root-correction/schist-shear-20261012/native-envelopes.png)
- [Laminate：含孔剪影](root-correction/laminate-shell-20261012/silhouette.png) · [填孔外岸](root-correction/laminate-shell-20261012/outer-filled.png) · [名义包络](root-correction/laminate-shell-20261012/native-envelopes.png)
- [Film：含孔剪影](root-correction/film-laminate-20261012/silhouette.png) · [填孔外岸](root-correction/film-laminate-20261012/outer-filled.png) · [名义包络](root-correction/film-laminate-20261012/native-envelopes.png)

## code/root接续合同

现已导入 3 独立布局、54 矩形、11 原生 placements、24 anchors、3 搜索策略。写表与三 codegen 全程使用 `/tmp/coh-world-upgrades-codegen.lock` 目录锁；每张共享 CSV 在锁内重新读取，只替换本批 world/layout 行，保留其他代理的新内容。生成后的注册总数为32，这是当时全库计数，不能当成32世界验收通过。详见 [production-registration.json](production-registration.json)。

三组不共用 layout 旋转。生产策略 source-once、无镜像、无 jitter、无额外材质缩放；统一平面变换直接取现有作者计划。按原 descriptor 顺序保留 ID，source_index 仅在角色内计数；family/role/版本/高度/厚度/相对位置从原生定义继承，没有从诊断包络反推新实体。

各世界8个独立出生候选点已经写为世界像素坐标；作者预检在两个固定 seed 下，候选中心及 ±40 世界px 方形九点均有地床，且中心离带16世界px边量的名义solid包络再留20世界px。见 [anchor-precheck.json](anchor-precheck.json)。这只是作者留量，真实mesh、全身体支持、内容布置及撤离通路仍须完整生成验证，不据此声称所有seed可靠。

残骸使用已有当地材料来源规则，三世界的peel_preference均0.65、source_reach_px72、environment_score_cap12继承计划。Laminate只有实际壳面附近才可选壳断片，Film只有实际膜面附近才可用膜剥片；主地床开放积留允许层板材料，不根据混材世界名给全图换外观。source ID必须指向真实被触达的表面。

生产端补充：三档完整生成与同seed骨架；原生支撑、材质遮盖及20/8px支持；VOID近距反事实遮挡；不规律出生/唯一撤离与节点配额；同场真实肩灯翻前后及E交互；旧revision恢复。以上都没有在本目录完成。用户推广授权不能写成这些候选已经获人验收。

## 冻结作者来源归档

本目录 archive 下的候选 CSV 已从根 data 移出，SHA-256 见 source-archive.json。它们只供历史重放与审查，运行时和正式 codegen 只消费 data/rift-spatial-* 与 rift-search-sites.csv。历史 report 的 source 路径保留生成当时的位置，hash 不变；compile-preview 已改读 archive，不会重新登记生产。
