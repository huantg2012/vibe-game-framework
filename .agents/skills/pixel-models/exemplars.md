# 像素模型锚点（学什么 / 不学什么）

本文件一层深，从 [SKILL.md](SKILL.md) 链过来。不要把入口热修写成已锁范例。不要改这些生产图集来「对齐 skill」。

## 1. 净化点交互物（已进关卡）

历史公约：这三台是 45° `iso_prism`。新对象不要默默沿用，先在身份锁里声明相机。

| 对象 | 生产文件 | 生成器 | 学什么 | 不要学 | 像素对照（第一帧，外轮廓去底 3 行去青绿；深边 = 明度 < 体内中位 − 8） |
| ---- | -------- | ------ | ------ | ------ | --- |
| 核心 v6-B | `public/assets/sprites/modules/core-v6-b.png` | `docs/art/review-2026-08-28/gen/core_v6.py` | `iso_prism` **只填面不描边**；顶亮侧暗；青绿碰面色；极小暖灯；光与薪柴同源（teal） | 不要另起描边；不要壁炉橙火；**不要抄 `CORE_*` / `MET_*` 历史 hex 当新色板** | 深边 4.8%；外沿众数是面色 |
| 净化器 B1 | `public/assets/sprites/modules/purifier-b1-sheet.png` | `docs/art/review-2026-08-28/gen/purifier_b1.py` | 同上；外沿可以是最亮顶面金属；结构钉死、只动窗内介质 | 不要物体外一圈深线 | 深边 0%；外沿众数 `MET_L` |
| 储藏 C1 | `public/assets/sprites/modules/storage-c1-sheet.png` | `docs/art/review-2026-08-28/gen/storage_c_cards.py` | 材料不止一块平灰（土座、铜箍、暖灯） | **不要学 `edge=INK`** | 深边约 41%；外沿众数 `INK` |

PLAN 文首「45° + 面分隔线」只约束这三台。分隔线 = 邻面不同色。对照课叠在净化点混凝土上评（生产地板主色 `concrete-dark`），不要只放在纯黑底上评描边。

相关闸门：`npm run check:palette-quantize`（色必须能对上锁定色板）。这三台目前没有独立的「深边占比」npm 脚本；新对象若被人抓回描边，必须补定量闸门，不要只靠肉眼。

## 2. 玩家角色

| 指针 | 学什么 | 不要学 |
| ---- | ------ | ------ |
| `docs/art/actor-pixels.md` | 画布 32×32；混凝土灰略暖；灯是唯一高亮；尘往上飘；四向直立 | 青绿当玩家签名；身体裂开当签名；粗描边圆润四肢 |
| `src/entities/player-sprite-dense.ts`（文件头 **No outline**） | 加厚工业像素；面罩 / 背包 / 分腿 / 灯壳体 | 旋转 `GameObject`；另做一张精灵表当玩家 |
| `gym.html?lesson=player` | 与出击同一套外形 | 为练习场另画一套 |

填充物（色、分层、禁忌）读 `actor-pixels.md` 与 `art-direction.md` §5.1。玩家身体灰（`SHADE` / `DARK` / `MID` 等）未进色板，只约束已锁玩家，**禁止当新对象的灰阶配方**。

相关闸门：无独立「玩家描边」npm 脚本。改玩家像素后走练习场玩家课；`npm run check:palette-quantize` 管色板字节，不管这张贴图。新玩家色必须先入板再画。

## 3. 裂隙内整体风格（物体怎么落在地上）

连续地面烤漆不在本 skill 里画。物体必须服从这些交接纪律：

| 指针 | 学什么 | 不要学 |
| ---- | ------ | ------ |
| `docs/art-direction.md` | 暖色稀缺；硬边；teal = 污染 / 外来模式 | 裂隙实体带暖光源；用底色色温当身份 |
| `docs/art/palette.json` | 只许这些格 | 会话发明 hex |
| `docs/art/rift-fragment-surfaces.md` | 身份靠渍 / 纹理 / 结构；成片青绿 = 有主占漆 | 氛围簇（DEC-104 已下线）；矩形平涂当主签名 |
| `docs/art/contamination-forms.md` | 方案 D / 基因谱；污染侧不要暖色 | 为练习场另写一套污染外形 |
| `gym.html?lesson=map` | 与出击同一套烤地 | 对照课另铺一套地 |

相关闸门：`npm run check:palette-quantize`；`npm run check:contam-floor-contrast`（污染对地面，不是物体描边）。物体对裂隙地的可读下限若尚无闸门，规格期先写数字，落地再补脚本。

## 4. 薪柴容器 / 翻堆

世界内实体属**污染侧**。HUD 薪柴计数的 warm-dim 走 `in-game-ux`，不要写进像素实体。

| 指针 | 学什么 | 不要学 |
| ---- | ------ | ------ |
| `docs/art-direction.md` §5.3 / §2.3 规则 8 注 | teal 余晖；核心烧薪柴时光与污染同源 | 壁炉橙火；把 HUD 暖色涂到世界内晶体上 |
| 迭代 10 / DEC-109 / DEC-110 | 外观不泄露内容物；残骸材质色三格（户外土、地铁锈、图书馆木；医院用 `metal-grey`） | 未揭晓就画出薪柴晶体或污染物核；把 teal 画在堆皮上 |
| `src/systems/loot-search-presentation.ts` | 翻堆配色从碎片身份查表，断言色板成员；揭晓晶体才走 teal | 猜 hex；用 L1 量化冒充残骸体 |

相关闸门：`npm run check:loot-pile-contrast`（主体 vs 四张碎片地面 CIE76，主体 ΔE ≥ 18 等已锁门槛）。`npm run check:palette-quantize`。`check:outline` 是地图外轮廓连通闸门，与精灵描边无关，不要拿来验收像素模型。

## 5. 裂隙入口（已锁；地面贴花的基线）

**生产默认 = 卡 4 地缝**（DEC-113，2026-09-04）。这是本项目第一个**地面平面内**的世界内交互物，地面贴花的锚点 / 层 / 闸门都以它为基线。

| 项 | 内容 |
| -- | ---- |
| 身份锁 | `docs/design-notes/rift-entrance-identity.md`「伤口渗漏，不是门」 |
| 卡面 | `docs/design-notes/rift-entrance-cards.md`（卡 4 地缝 / 卡 5 击裂） |
| 生成器 | `docs/art/review-2026-08-28/gen/rift_entrance_ground.py`（自带闸门，退出码非 0 即不合格） |
| 生产贴图 | `public/assets/sprites/modules/rift-e4-sheet.png`（40×56 × 8 帧、6fps） |
| 接线 | `src/scenes/rift-entrance-visual.ts`；锚点 `ENTRANCE_ORIGIN_Y = 0.5`、层 `ENTRANCE_DEPTH = 1` |
| 对照 | `gym.html?lesson=rift-entrance-card`（两卡，底是出击同一份净化点混凝土）；实地 `#purif`，`?entrance=5` 或键 4/5 切卡 5 |
| 架构 | `architecture.md` DEC-ARCH-019（地面贴花 vs 立着的对象，两类挂法） |

**学什么：** 地面上的缝画在地面平面里，锚点取中心、层在地板之上玩家之下；缝要有三档深度（`#151a1e` / `#0d1114` / `#080a0c`）；断口新鲜面更亮（`metal-grey` / `metal-light`）但必须断续；青绿只在缝里、连着一段、主体压在最暗两档。

**不要学：** 别把它当立着的对象去加顶面带；别把青绿铺满整条；别画出别处的具体材料（那等于承诺目的地，与「去向不可选」冲突）。

相关闸门：生成器内置十条。`npm run check:palette-quantize`。

## 6. 那条走了六张才找到的路（过程教训）

裂隙入口先后废掉六张，两轮都在**同一个病根**上：把「时空的伤」画成「一段墙被弄坏」。

- 第一轮（壁裂幕 / 错层剪 / 膜破回缩）：人评「太像水池」「灾难」「不要真门框」。
- 中间热修两次：第一次把墨黑描边换成深灰描边交差，人评**不诚实**——闸门当时只查 `INK`/`VOID`，所以假绿。第二次才真去掉描边。
- 第二轮（挤入 / 蚀腔 / 层叠）：画法闸门全绿、外沿全是面色，人仍评「都是狗屎」。
- 回到「它是什么 + 为什么」，才发现那个位置**没有墙**：入口压在椭圆北沿，净化点的边界是变暗带 → 力场膜 → 虚空。墙是我凭空造的。
- 人给方向（地面上的裂缝 / 钢化玻璃式辐射 / 被钉住的虫洞）之后，一轮就过。

**沉淀成规矩的三条：**

1. **人否掉方向时，先回到「它在世界里是什么 + 为什么」，不要在旧载体上继续打磨。** 画法闸门全绿 ≠ 载体对。
2. **换色描边 = 不合格。** 把 `INK` 换成 `SHADOW` 交差过一次，闸门因为只查近黑而假绿。判据要写成物理定义（外沿是否比紧邻内部更暗），不要枚举颜色。
3. **闸门误判时改判据的定义，不放宽阈值。** 全局中位数在双材质对象上误报、「主导外沿」在骨架式对象上误报——两次都是判据的适用范围写窄了，不是产出不合格。

上一版的墙上三张与卡 6 囚笼已整支删除（生成器 `rift_e_cards.py` 已删），不留死代码、不留「以后可能有用」的图集。
