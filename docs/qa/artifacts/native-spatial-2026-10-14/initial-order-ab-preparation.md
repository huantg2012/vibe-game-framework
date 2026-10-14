# §11 固定位序 A/B：最小实现准备

状态：仅方案，尚未修改源码或执行 A/B。生产继续原作者顺序；不启用 global initializer，不修改 G 门、CSV、L/B 或任何数量预算。

## 可安全缓存的边界

当前 fresh 的 `baseField` 只由冻结的 L−B、frame、geometrySeed 决定；没有已落位对象。`siteFor` 原候选坐标由原 site、preferred 和该 field 的 160 次抽样抖动构成，坐标生成不读取 `others`、support 或覆盖距离。fresh 的 preferred 为空、原 site 为 `(0,0)`，所以每件原列表是 1 个原点、24 个局部点和 160 个 field 抖动点（允许原有重复坐标）。它可按作者顺序一次预采，保持原共享 Stream 的消费顺序。

不能缓存 rough 分数、合法性或完整评分：这三者读取当时的已放对象。两臂须在各自状态上重新执行原逻辑。field 兜底同样只在原池没有合法点时发生，且不消费随机流；不会改变下一件的缓存池。

## 最小代码接口

1. 从 `siteFor` 抽出纯候选 helper，输入原 site、field、preferred、Stream，保持原循环与顺序。fresh 按作者索引预缓存池；refinement 仍通过同 helper 即时构造，不引入池重用语义。
2. 将既有 partial 初始落位循环抽成共享内部函数，增加 `order: readonly number[]` 和按作者索引的只读 candidatePools。生产只传作者顺序；一个具名诊断入口可传稳定的 S→H。没有运行时失败 fallback 或生产开关自动翻转。
3. 作者对象数组、hole ID、instance ID、mesh seed 保持不变。站位按作者索引写回；`others`、资格输入及最终输出从已落位索引按作者顺序投影，不使用临时访问顺序重新编号。
4. 实际 schedule 的最后一件 H 执行原资格路径，全部原 H 的输入仍按作者顺序。原 12 个合法完整评分、仅空池才 field 兜底、共享 72-work/60s 均保持。两个 A/B 分支不能各拿一套预算。

## c11 恢复与对照入口

已保存 c25 具有同祖先 c11 的局部形体、L/B、profile/instance 身份与 edge seed，但没有保存 c11 作者采样完成后的 Stream 游标。因此不能从 `new Stream(layoutSeed)` 直接采站位并声称与原池相同。

需要一次只读恢复 c11 原纯作者阶段，到落位前截取，严格核对恢复形体/L/B/edge seed 与已保存同祖先数据；任一差异停止。随后按原作者顺序冻结候选池，保留逐件池哈希。此步骤不编译地图、不试站位，也不重新选择或修正形体。可用独立 `frozen-initial-fixture` 诊断 adapter 提供恢复材料，再由同一初始落位函数分别消费两个 order。

配对执行应只产生至多两个完整初始几何，共享 72-work/60s，full=0，不进入 refinement。A 臂原顺序；B 臂为 `0,1,10,12,15,2,3,4,5,6,7,8,9,11,13,14`。先验证逐件池哈希及前两件母体位点一致，再记录全套 G1/G3、身份、支撑与共同 raw L−B 域的 S 距离诊断。按已审 §11 判定两层非退化；未满足时不翻生产，也不额外尝试新的顺序。

本准备没有申请或执行新采样，等待协调者授权具体代码与唯一 A/B。
