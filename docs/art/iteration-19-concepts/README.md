# 迭代19：概念图与视觉草案

当前为DEC-138实施批：四品质十成品、污染色像素素材和库存已接正式场景。原图为设计参考，实际运行使用32px世界模型与48px图标；手感和美术待用户试玩终审。中断出击的退出/刷新政策尚未明确。

- [当前：统一库存方向](unified-inventory-direction.md)：武器/污染物共享列表、单负重、出击装配、裂隙管理。实施基准容量16.0、污染物2.0，内部十分之一整数；品质／抗性／移动读数已接实际状态。
- [当前补色概念图 v4](crowbar-quality-v4.png)：保持v3造型，青绿侵蚀色进入接缝与内腔；白板保留旧铁。内置imagegen编辑，[提示词](crowbar-quality-v4.prompt.txt)。补色结果待审。
- [实际像素素材检视](../../../tools/inventory/crowbar-review.html)：32×32世界基型、48×48库存图标，1×/放大/纯轮廓及实际玩家持握。源程序单独绘制，未将概念图缩成精灵；已接正式攻击。
- [已认可造型方向 v3](crowbar-quality-v3.png)：旧铁原物／钩肩错生／剥层分岔／中空错位四档，靠实体轮廓与负空间递进污染感。内置image_gen生成，[完整提示词](crowbar-quality-v3.prompt.txt)。用户认可造型方向，未扩展为数值与正式精灵验收。
- [品质概念图 v2](crowbar-quality-v2.png)：用户认可差异可辨，但否决科技／工艺递进方向；不作为当前制作目标。
- [上一版品质图](crowbar-quality.png)：**用户未通过：品质外观差异过小。** 仅靠磨损、布色和小箍的变化不能承担品质识别，不再作为当前外观制作目标。
- [R4撬棍内容](../../content/player-crowbars.md)：同类型固定攻击，四品质与十件成品；不是十个功能分支。
- [库存组件独立验收页](http://127.0.0.1:3000/tools/inventory/view-review.html)：实际共用组件与60件测试物，无存档读写；包含备行与满载交换。正式场景使用同一组件。
- [R2撬棍家族图](crowbar-family.png)：**功能设计已作废，仅保留材料风格参考。** 图中短柄、加长、扁口、配重、包布、复响、滞口不再制作成不同打法。不能将其长度、配重、撞击缠布或异常特效直接移植到R4。
- [首稿武器与动作](weapons-and-attacks.png)：四武器计划已作废，仅参考旧铁、握持意图与维护痕迹。
- [首稿整备构图v2](preparation-inventory-v2.png)：布卷、挂带、器物和暗材质方向保留；双武器、六件仓、武器/工具分库均已作废，不可照图写机制。
- `preparation-inventory.png`为更早生成稿，快捷键冲突和墙字已在v2修正，不用于实施。

用户对早期图材料氛围的认可继续有效，不扩展为新品质数字、抗性公式或实际画面验收。每把武器显示区间、每挥抽取伤害已确认；R4数值已获实施授权，仍待平衡试玩。四档通过污染改写形状，保持握点、有效钩端距离与共享攻击包络；抗性仅为同品质差异，不随外形污染或品质自动上涨。概念图作为方向参考，像素导出物用于生产。

当前权威：[武器](../../specs/system-player-weapons.md)、[统一库存](../../specs/system-field-inventory.md)、[生存属性](../../specs/system-survival-attributes.md)、[撬棍库](../../content/player-crowbars.md)。死亡全丢和开包不停已锁，退出/刷新后果仍待用户回答。

R2旧成品掉落表 `data/drafts/iteration-19-crowbar-loot.csv` 已清除候选行，仅留表头说明暂缓；它不是可供生产抽样的空池。当前正式来源已在data/weapon-loot.csv和weapon-first-discovery.csv，不将旧八件权重机械映射到十件。

imagegen请求保留于各同名`.prompt.txt`，其中描述旧功能的请求均属历史记录；不要重新运行它们生成R4资源。原始生成结果在本机`.codex/generated_images`，本目录为项目评审副本。
