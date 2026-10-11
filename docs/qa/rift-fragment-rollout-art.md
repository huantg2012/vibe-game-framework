# 矩形开放碎片首代表：美术与空间构型核查

日期：2026-10-12（生产取图2026-10-11 UTC）。范围：COH-F007 / F011 / F012 / F052，余烬脊 `cinder-ridge` 修订8首代表。独立美术核查，已看最终源正式Renderer低/中/重三档去雾全图、正常入场，以及中档一处真实隔孔往返三帧；其他107世界不在本次检查范围。用户对 `ada26f43` 样片的认可与正式游戏本次审查分开记录，不能将几何测试、孔数或本报告视为用户审美终验。

## 依据与工作边界

已读 `.cursor/agents/art.md`、`CLAUDE.md`、game-state / pixel-models技能、游戏现状索引、当前推广任务、`art-direction.md` R100美术标准与 `world.md` 美术约束。连续地面不是本轮新画的像素物件；pixel-models在此约束实体与地面交接，具体裂隙材料以当前R100材料分工为准，不套用早期净化点色板和装置相机。本轮没有修改角色、HUD或材料。

人已认可的参照是[矩形骨架与自由断缘母版](../art/previews/world-fragment-open-field/README.md)：连续宽地占主体，破坏偏置且疏密不匀；长直岸、保留直角、不等长斜切、多段崩角并存。矩形是构成方法，既不要求大轮廓矩形，也不要求每个孔做相同圆角或八边形。动态感指空间节奏，地形不随时间运动。

## 作者数据静态核查

`rift-spatial-fragment-layouts.csv`声明1152×896作者坐标、worldScale=2，与认可母版一致。`rift-spatial-fragment-rectangles.csv`按ordinal读取后，land / void两组坐标均与认可`geometry.json`逐项相同。本次仅`cinder-ridge`绑定该布局。由此能确认新数据没有在作者输入阶段把宽地改回房间—走廊，但最终实体、材质与8px光栅是否损伤这种关系必须看正式画面。

普通solid沿当前材质/构造重新部署；22件只是现状记录，不作为密度合格结论。重点检查西部和南部连续地面是否仍有休止，不能以“实体数已减30%”掩盖布局收缩后的拥挤。VOID应承担真实的信息阻隔，普通实体不因此获得吃光职责。

## 正式画面的检查点

1. 去雾全图：先忽略材质细节看地形大形。西/中/南宽地连续成立，东/东北破坏集聚；外岸不能被材质外框连接成近矩形，也不能沿孔间余地看出一组房间、桥和固定环路。
2. 断缘：长岸与原角仍在，不同部位有不同磨损量；小孔不统一成按钮。8px支撑边与表面断沿同向，无另铺一层光滑轮廓掩盖碰撞台阶。
3. 缺地：洞内没有地表颗粒、受光底板或普通暗阴影；近岸材料有截断来源，黑处读作世界缺失。正常肩灯中隔洞远岸被遮住，绕端能显露；仅全图黑块不能证明LOS。
4. 实体与可走地：余烬的赤赭颗粒床、粗堆、坡面保持原身份；不可走主体以体量、断面及接地和可走地分开，不能靠污染绿、亮描边或平面黑贴花表示。
5. 疏密：宽地区有可选择的接近角度与空场，裂带有绕端的观察压力；实体不能均匀撒满每块剩余地面，亦不能把VOID围成走廊壁。低/中/重三档都看，不只检查最舒展的一档。
6. 正常镜头：角色仍是20px尺度参照，实体边界、近侧岸、翻找物在真实肩灯下分别可读；诊断图不代替行走画面。截图只证明所见站位，不外推全部朝向、连续动效或听感。

## 观察结果

本次实图使用生产Worker及`RiftScene`，位于隔离内存存档的世界巡览。共同requested/effective seed为`20261011`、修订8、入场位置约`(972,1460)`，全图2304×1792。去雾图是已准入地图使用原生Renderer的独立副本；正常图保留肩灯、有限视野和未发现的撤离状态。**以下六图已在最终作者数据同步后重新实际查看**：共同源由各目录的`source-snapshot.json`逐文件绑定，创建时间`2026-10-11T16:12:04.800Z`，空间作者sourceHash `6742f666d99d0d6b02209ca93e138466c66d52233e1f8487a6b2edafe30a0323`。不是独立剪影页或重新手绘的美化图。

- 低档：[去雾全图](artifacts/r100-fragment-rollout-2026-10-11/final-browser-low/cinder-ridge-low-full.png)、[正常入场](artifacts/r100-fragment-rollout-2026-10-11/final-browser-low/cinder-ridge-low-entry.png)、[capture](artifacts/r100-fragment-rollout-2026-10-11/final-browser-low/capture.json)。signature `e4e87391`，geometry `4ac37daf`。
- 中档：[去雾全图](artifacts/r100-fragment-rollout-2026-10-11/final-browser-medium/cinder-ridge-medium-full.png)、[正常入场](artifacts/r100-fragment-rollout-2026-10-11/final-browser-medium/cinder-ridge-medium-entry.png)、[capture](artifacts/r100-fragment-rollout-2026-10-11/final-browser-medium/capture.json)。signature `d3c1250c`，geometry `637af855`。
- 重档：[去雾全图](artifacts/r100-fragment-rollout-2026-10-11/final-browser-severe/cinder-ridge-severe-full.png)、[正常入场](artifacts/r100-fragment-rollout-2026-10-11/final-browser-severe/cinder-ridge-severe-entry.png)、[capture](artifacts/r100-fragment-rollout-2026-10-11/final-browser-severe/capture.json)。signature `342f0d63`，geometry `deb76019`。

前次观察保留于同根目录`browser-low / browser-medium / browser-severe`，源快照时间`2026-10-11T15:59:24.461Z`；三档signature分别为`772c95d3 / e6da5127 / 914c9c74`，geometry分别为`5468e9f4 / 9da93117 / 297b7884`。最终同步将relief id=3的y从410改回390、width从200改回150，北部浅起伏表面范围随之变化。最终六图复看中没有出现新的地形、实体疏密或材质身份问题，以下结论已由最终图重新支持，不只是沿用旧签名。

**构型继承成立于所见三图。** 西侧是有宽度的连续地床，中南部仍有完整面积，东北和东部集中破坏。北侧阶梯状长岸、向东伸出的残地、下侧偏置短脚相互不对称，没有被外框重新套成近矩形。右侧大孔之间的余地属于连续宽地被挖去后的残留，未重建成独立房间与狭窄连接桥。长岸、少量原角和不同长度的崩角均可辨，8px台阶未将全周统一磨圆；小孔也未全部变成同型八边形。

**普通实体没有吞掉这次认可的宽面。** 西中部主堆、北部横堆与南部横堆有体量层级，周边小块之间保留连续开场；重档变形仍留多侧接近余地，没有用新增实体把每块剩地围成单通道。此判断来自实图中的占地关系，不来自22件这个计数；没有将实体与VOID合并成一个“障碍总数”验收。

**空洞与材料的视觉职责分开。** 全图中洞内没有红色地床、纹理颗粒或可照亮底板，材料到岸处截止。红褐床与黄赭断面、较冷的次材沉积保持余烬身份；主体的断面与顶层能区分于地面。正常入场三档都看得到右侧堆体浅赭断面、脚边颗粒床和可操作残块，物体没有靠全圈绿线或黑平贴来表达厚度。三档入口相近不是全地图威胁完全相同的证据，这组图仅覆盖入口保护区。

**保留的低优先观察。** 去雾图中的若干小椭圆堆仍较均匀地散布，局部可以读出重复外形。这是沿用原实体族的可见局限，不是此轮将实体画成新类别；当前没有达到堵死宽面或把地图改回走廊的程度。本轮不以它阻断认可构型的首代表接入。后续作者推广必须保留成组与休止，不能将本图22件按均匀间距复制到别的世界。

## 有界结论与未检范围

这六张实际生产静帧中，**未发现共享碎片机制接入引起的构型、实体密度或原材料身份回归**；可作为余烬脊首代表接入的美术复核证据。用户仍保有正式游戏美术终验，首代表不等于全库批准。

**最终源近岸复看已补齐。** 已逐张查看中档同种子的[近岸](artifacts/r100-fragment-rollout-2026-10-11/final-sight-input/cinder-ridge-medium-20261011/before.png)、[绕端](artifacts/r100-fragment-rollout-2026-10-11/final-sight-input/cinder-ridge-medium-20261011/after.png)、[返回](artifacts/r100-fragment-rollout-2026-10-11/final-sight-input/cinder-ridge-medium-20261011/returned.png)。近岸红色地床在孔前截断，洞内没有被肩灯照出底板；绕端后原黑侧显出地面和有厚度的堆体，返回后恢复近岸截断。近侧实体仍以赭色断面与顶层表现体积，没有伪装为同样的黑色缺地。

[实跑记录](artifacts/r100-fragment-rollout-2026-10-11/final-sight-input/report.json)绑定最终geometry `637af855`，以普通WASD从出生走到同一真实地面目标`(948,660)`附近，记录可见度`0→1→0`；近岸目标距约166px，在224px视距内，忽略遮挡时可见度0.6。因此这处实图中的黑暗截断有对应的实际视线差异，不只是远处未照亮。报告使用全图预先规划路线，不能记为未知地图自然探索。本美术报告仅复看这处三帧与静态记录，未独立重跑输入。

前次relief作者源的`sight-input/cinder-ridge-medium-20261011/`三帧仍保留历史观察；当前近岸结论由上述`final-sight-input`的新图重新支持。最终正常画面覆盖南侧出生和这处内部孔前后，仍未覆盖全部孔、实体边或照射方向。

身体通路、定位目标的0→1→0及视距反事实由本轮相应QA记录承担，本报告不由全图黑色洞面推定其已通过。未观看连续动效、未实际听声、未进行未知地图自由探索，不新增这些方面的结论。
