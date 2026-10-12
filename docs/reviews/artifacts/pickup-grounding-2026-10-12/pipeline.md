# 六世界拾取物生产管线只读核查（2026-10-12）

范围：F019/F013/F012；HEAD dcb89630 的当前正式生产 r8。未修改实现。未自行审阅游戏画面；以下为源码与六份实际生成布局证据，视觉质量结论须与场景截图交叉判读。

## 最高影响事实

1. **节点落点没有“从哪里脱落/沉积到这里”的来源关系。** `src/generation/world-study/r100-expedition.ts:114–165` 从可达8px网格中隔格取16px候选，再按48px可见可达交互、污染距离、搜撤额外路程、入口/出口排除、节点彼此间距和分散评分选点。不存在母体mesh、附近形状方向、材质边界、地表裂纹或沉积流向字段。safe节点要求靠safeRoute，deep节点要求污染距离/威胁覆盖，均是玩法约束。不是完全均匀随机撒点，但也不是环境因果部署。
2. **当前残骸和大地表使用不同光照表现。** `src/systems/loot-search-presentation.ts:248–250,266–270` sprite只有可见度alpha。可见度 `src/systems/visibility-system.ts:481–507` 为视距/朝向/混乱分档＋VOID LOS（0/.2/.6/1），不是局部光照。地表 `src/systems/r100-world/surface-renderer.ts:47–78` 按每像素height/normal、灯色、距离平方衰减、surfaceShade与镜面反射变化。残骸生成时顶面乘1.39、断面1.43、侧面.40、接触.23（`search-remains.ts:97`）；局部反光按3.6–5.2秒周期计时脉冲，不读取灯源（`search-remains-ambient.ts:52,74–75`）。这使“已换当地颜色”不能保证同场光照一致，不应简单归纳成需要压暗。
3. **当前“接地”只存在于小图内部，没有与落点融合。** 图块统一34×26（`search-remains.ts:28`）；底部固定小接触块（148–150），每种grammar固定手写轮廓、随机只水平翻转/上下1px移位和材质取样（65–67,118–119,151起）。`world-search-presentation.ts:17–24,62–67` 接收position用于放置，但形状/颜色函数不读position/附近材料。`loot-search-presentation.ts:225–228` 独立image底中锚点、固定depth15，无局部基面、嵌入、附着、朝向、表面起伏或周边碎屑梯度输入。不是没有任何阴影，而是阴影没有场景几何依附关系。
4. **大图维持小型孤立节点配额，并额外增加分散权重。** `data/rift-expedition-grades.csv:2–4` 全世界低6/中8/重9节点；`r100-expedition.ts:141` 从这份表读count，没有面积驱动增量。`data/rift-spatial-deployment.csv:2` 节点间距96px、spread_weight=.25；代码152/156旧无spatial路径为52px且无分散奖励。不能把大图归因为“复制放大拾取精灵”——精灵仍34×26，数量也没有随面积增长。变化是更大的地床/巨构关系与独立分散的功能节点仍使用旧孤岛尺度。

## 六图当前外观（不是跨世界同一褐堆）

主形来源 `data/rift-search-remains.csv`：余烬脊 packed-granules（7）；无彩层原 laminated-flakes（2）；纤维扇流 fractured-fibres（11）；壳缘阶串 glaze-shell（12）；苍帆夹道 torn-membrane（35）；凝胶裹纤维 gel-fragments（22）。六图各有独立grammar。

`r100-package.ts:63–76` 冻结对应世界profile及appearance。`rift-scene.ts:593–598` 搜索节点接入恢复的生产world.sample.profile/worldseed/主材preparedpainting。`world-search-presentation.ts:22–25` 只混合稳定visual/worldseed，不读取隐藏奖励。材质取主family painting的loose/cleaved区（`search-remains.ts:79–85`），再按worldappearance映射到solid/cleaved色域（103）。不是根据节点所在地读取真实地面色素/材质ID，也不读该world混合families；凝胶图所有节点统一gel-fragments，邻近纤维实体也不切换为纤维碎屑。这是局部关系缺口，不是六图没有差异。

## 未翻找与已揭露物件应分开

- 新局中看到的是可翻找材料残骸。薪柴/污染物节点共用createVisual函数，创建入口 `loot-search-system.ts:315–342`，不会提前展示隐藏所得。
- 翻找完成隐藏整堆与ambient（`loot-search-presentation.ts:287–320`），现有碎片爆开后内容粒子飞向玩家；没有“翻过后的地面残留”持久状态。
- 有容量时所得直接入背包；不足时InventoryStore.revealBatch把真实物件留于该node.position（`loot-search-system.ts:682–692`）。这才由 `field-loot-inventory.ts:172–216` 绘制揭露/丢下的物件：固定depth16，整数世界坐标，13×3px深色接触条；武器用world像素旋到地面，污染物用itemWorldPixels居中。只有visibility alpha（144–149），也不读局部受光/材质/height。
- native地表depth0；真实前景实体mask只施加player/enemies（`r100-world/presentation.ts:57–60,82–86`）。翻找/已揭露物没有被加入该前景几何遮罩。当前是否视觉穿插需实景复现，不能仅凭此直接宣称本批已经出现穿插bug。

## 同请求seed20261012，中档48点生成审计

脚本 `/tmp/coh-pickup-placement-audit.ts`；结果 `/tmp/coh-pickup-placement-audit.json`。

精确测量节点到所有实体/relief投影XY三角形集合的最小欧氏距离，排除world shoreline追加三角形。0表示处于该投影；不是AABB代理，不是导航路程，也不是美术质量打分。以224px作现有常态前向最大视距参照，非合格阈值。

- cinder-ridge：8点，最近实体/relief距离24.6–117.4px；超过224px 0。
- ash-strata：8点，22.1–153.5px；超过224px 0。
- splayed-fibres：8点，43.3–226.8px；超过224px 1。
- shell-chain：8点，18.9–825.9px；超过224px 5。
- pale-sail：8点，18.9–437px；超过224px 5。
- gel-fibre：8点，259.5–450px；超过224px 8。

48点全位于普通可走地床：tile1、native volume rasterMatter0/objectId0。注意此时materialId0是未覆盖默认值，不可解读为outer材质；height为-Infinity（JSON原写null），意为没有formation面，绝不是没有地面。纤维因完整内容准入重试2次，effectiveSeed3956234173；其余effectiveSeed20261012。只支持此seed中档，不外推全种子/全108。

## 可以支持的优先级解释

优先检查：环境来源落点关系 → 残骸与地床受光/接触关系 → 局部散落/侵蚀范围与主体比例 → 重复轮廓/状态残留。不能只添加大阴影、缩小/压暗、强行吸附所有节点到墙边；这会掩盖“用途点”与世界结构独立的原因，并可能损伤搜索可读性及原有搜撤/交互约束。现阶段仅指出机制与风险，不实施设计。
