---
status: ACTIVE
created-by: director
created-when: 2026-08-20
last-modified: 2026-08-23
purpose: 角色程序像素的经验 HOW。活外观在 art-direction §5.1 / §5.2；改写体格点合同在 rewriter-sprite.md。裂隙甲出击指针在 contamination-forms.md 方案 D（I5-J 生产路径为基因谱模块；画布含 48×64，碰撞仍 20）。
---

# 角色程序像素（玩家 · 渗透体 · 改写体）

动**玩家**或**默认课敌人**外形之前先读本文，再打开对应 `src/entities/*-sprite*.ts`。动**裂隙甲**之前先读 `docs/art/contamination-forms.md`「方案 D · 甲」，不要从这两份 sprite 文件另起出击唯一标准。不要从概念图、旧红色多边形占位、或「再做一张精灵表」另起一套。

活外观（怎么画、分层、对照）以 `docs/art-direction.md` §5.1 / §5.2 为准。改写体整数格合同以 `docs/art/rewriter-sprite.md` 为准——那是默认课 / 回退配方，不是裂隙甲生产路径。练习场入口：`docs/dev/gym.md`。

审美由人终审。本文不宣称视觉过关。

---

## 接线状态（先看这一段）

**玩家已接出击（DEC-068）。** 裂隙 / 净化点的 `Player` 与练习场玩家课同一套：加厚工业像素 + 灯尘上飘。旧方块人 `player-sprite.ts` 只剩 boot 别名，不要再接到 `Player`。

**裂隙甲生产路径是方案 D 基因谱**（DEC-084 / I3-C / I5-J）。配方在 `docs/art/contamination-forms.md`「方案 D · 甲」与基因谱 HOW：程序像素词法（Canvas 烘焙、四向、不转 `GameObject`），覆盖深度改骨架违规预算，不换孔谱通道。代码：`src/entities/form-renderers/d/genome/`（`attachJiaGenomeD`）。旧 `d/jia-*` 只留给 A/B/C 冻结对照。乙 / 丙 / 丁不走本文。

**`infiltrator-sprite.ts` / `rewriter-sprite.ts` 没有废弃。** 它们仍是：

- 练习场**默认敌人课**（`gym.html` 无 lesson / 默认院子）的外观；
- 句法课「现行占位」/ `placeholder` 渲染方案；
- `Enemy` **没有** `form` 时的回退（默认课 spawn）。

它们**不是**裂隙甲的生产路径。不要改这两份文件来迁就方案 D，也不要把下面的渗透体 / 改写体配方写成出击唯一标准。I3-E 在方案 D `ready` 时藏出击甲的默认 Image / 残影 / 脱落尘 / 脚下污斑。

| 角色 | 画布 | 碰撞边长 | 裂隙出击 | 练习场 | 代码 |
| ---- | ---- | -------- | -------- | ------ | ---- |
| 玩家 | 32×32 | 20 | 已接 | `?lesson=player`（同外形） | `player-sprite-dense.ts` + `player-lamp-aura.ts` |
| 渗透体（默认课 / 回退） | 32×32 | 20 | 仅无 form 回退；有 form 的甲走方案 D | 默认课；句法课 placeholder | `infiltrator-sprite.ts` + `contam-flakes.ts` |
| 改写体（默认课 / 回退） | 32×48 | 20 | 仅无 form 回退；有 form 的甲走方案 D | 默认课；句法课 placeholder | `rewriter-sprite.ts` + `contam-flakes.ts`（含脚下污斑） |
| 裂隙甲（方案 D / 基因谱） | 32×32 / 32×48 / 48×64（按覆盖档） | 20 | 生产路径 `attachJiaGenomeD`（I5-J） | 句法课 / 陈列馆同一份 | `form-renderers/d/genome/` |

木偶顿步在 `enemy-factory.ts`。碰撞偏移见下文「画布变了只改偏移」。方案 D 甲同样：画布变了只改偏移，碰撞边长仍 20。

裂隙**地面**污染与改写体崩坏簇同源（青绿团落到可走地板，不是矩形平涂错误块）。地面画法合同见 `docs/art/rift-fragment-surfaces.md`（DEC-069）。墙缝 / 有生命的簇 / 走廊云见 `contamination-forms.md`。迷雾下甲身上的簇是否被地面簇淹没、亮不亮，等人在裂隙里看；本文不代勾。

---

## 家族对照

三者要同一档「密像素」密度。只改其中一方的密度或体量，并排会立刻不平衡。语言必须对立：

- **人**：完整工业体；混凝土灰略暖；灯是唯一高亮；尘是暖灯**往上飘**。
- **崩坏**：表征失败；前倾猎食；坏像素**往外 / 往下掉**；空间用脱落尘和脚下污斑吃光，不是再发光。

不要青绿当玩家签名，不要把玩家身体裂开当签名。不要给渗透体面积光。污染侧不要暖色。

---

## 过程闸门（下次不要重蹈）

1. **上下左右不旋转 GameObject。** 转向靠换贴图。把剪影烘进贴图里转 90° / 180° = 看起来在转角色。四向都是直立（头在画布上方）。
2. **先练习场对照，人选后再接线。** 玩家已走完这一步（DEC-068）。甲：人已在句法课选定方案 D（DEC-084）。裂隙生产路径 = `contamination-forms.md` 方案 D · 甲 + `d/jia-*`。不要改 `infiltrator-sprite.ts` / `rewriter-sprite.ts` 来做方案 D——那两份仍是默认敌人课 / placeholder 回退。迷雾下亮度仍人终审。
3. **家族一起看。** 只改其中一方的密度或体量，并排会立刻不平衡。
4. **好看不等于有压迫感。** 密、能走、有尘之后仍可能像「会巡逻的像素人」。压迫来自前倾、肢体过长、木偶顿步、质量压在朝向上，不是再堆粒子。
5. **禁忌仍有效：** 真触手、成对眼睛、粗描边圆润四肢、污染侧暖色、渗透体面积光。改写体行走允许身体裂开（渲染崩坏）；玩家不允许拿裂开当签名。
6. **画布变了只改碰撞偏移，不改碰撞边长。** `BODY_SIZE` 保持 20。渗透体从 24×24 改到 32×32 时，`AI.BODY_OFFSET` 从 `{2,2}` 改成 `{6,6}`。公式：`(画布边长 − BODY_SIZE) / 2`。改写体保持 32×48，只加横向质量，不要靠放大画布冒充体量。
7. **练习场验证用 Cursor Simple Browser**，不要用系统浏览器。
   - 默认敌人课（两份 sprite 回退）：`http://localhost:3000/gym.html`
   - 裂隙甲生产语法（方案 D）：`http://localhost:3000/gym.html?lesson=lexicon`（不开迷雾）
   - 玩家（与出击同一套加厚像素 + 灯尘）：`http://localhost:3000/gym.html?lesson=player`

---

## 分层（怎么叠，不是再发明一层）

| 谁 | 基底（启动时画进贴图） | 动态（运行时） |
| -- | ---------------------- | -------------- |
| 玩家 | 加厚工业像素：面罩 / 背包 / 分腿 / 灯壳体；侧影加厚 | 灯尘上飘、脚底暖斑（出击与练习场同一套） |
| 渗透体 | 密像素前倾人形；臂过长、肩不对称、轮廓缺损、家族散点 | 木偶步、迈步脱落尘、转向滞后剪影、头上指示物 |
| 改写体 | 半人半崩坏；右侧溶散 + teal 簇；完整侧留爪 | 同上，外加崩坏侧错位 / 裂开、残影、脚下青绿污斑 |

尘的语法相反：玩家暖灯往上；敌人坏像素往外、往下。不要把两套粒子兑在同一个人身上。

裂隙甲（方案 D）的分层按 `contamination-forms.md`：基底仍是该族肉/布/骨，污染层按覆盖深度叠 ramp 簇或散点。不要把上表改写体 CLUSTER 整数格当成灯柱/栏柱的唯一剪影。

---

## 裂隙甲出击指针（I3-C）

只读指针，配方正文在 `docs/art/contamination-forms.md`「方案 D · 甲」。

- 词法：方案 A（逐像素烘焙 → Image；四向直立；`rotation === 0`）。覆盖深度走改写体叠簇，禁止 `applyCoverageFail`。
- 字段：`substrate` 换骨架语法；`coverage` 改骨架违规预算（1/3/5），不换孔谱通道；`lexemes.sense` 视锥/听噪/窄视；`fragmentTypeId` 换 ramp；`FormVisualPose.visibility` 出击读迷雾（0 隐藏，>0 可见区内仍须能看成一口）。细节见 contamination-forms「出击视觉消费字段」「迷雾」。
- 画布 / 碰撞与本文闸门 5–6 相同（覆盖档 48×64，碰撞仍 20）。禁忌与本文闸门 4 相同（触手、成对眼睛、渗透体面积光、污染侧暖色）。
- 不要把本节扩写成第二份像素整数表。需要格点时：默认课读 `rewriter-sprite.md` / 渗透体源码；裂隙甲读 `d/genome/` 与 contamination-forms。
