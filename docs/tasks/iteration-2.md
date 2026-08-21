---
status: ACTIVE
created-by: director agent
created-when: 2026-08-21
last-modified: 2026-08-22
note: 迭代 2（污染体渲染）。第一轮三方案抽卡已交。第二轮方案 D（DEC-080）。出击不接。不要开新 Slice。不要标 COMPLETE。
---

# Tasks: 迭代 2 — 污染体渲染

权威：`docs/progress/current-iteration.md`。体系仍是污染句法（DEC-078）：设计正文 `docs/design-notes/contamination-lexicon.md` → 规则 `docs/specs/system-contamination-lexicon.md` → 识别表面 `docs/specs/ui-encounter-narration.md`。外观 HOW：`docs/art/contamination-forms.md` + 甲的 `docs/art/actor-pixels.md`。**不改出击画面**（`src/scenes/rift-scene.ts` 本迭代谁都不许动）。

**第二轮从这里读：** 文末「第二轮（方案 D，DEC-080）」（人已试玩并拍板）。下面「第一轮」是已交历史合同，A/B/C **冻结**，禁止再按 T1/T2/T3 改那些文件。

**人点名的缺口（仍有效）：** 生成空间有 1053 个无名填法 + 4 个成句；出击像素仍是 2 种人形 + 3 个几何块。

**收尾合法态（第二轮）：** 方案 D 可在 `gym.html?lesson=lexicon` 浏览，覆盖人点名的四孔谱差评与共性问题。不要标迭代 COMPLETE。不要接到 `RiftScene`。

**派发：** 上层负责 spawn 子代理。禁止把第二轮整包塞进一次 code 会话。

---

# 第一轮（已交，冻结）

T0–T3 已落地。人已试完三个方案并点名混装。本节只作对照语法与文件边界的档案，**不要再派 T1/T2/T3**。

---

## 共享渲染合同（先于三方案）

三个方案必须能在**同一个**污染句法课页面里切换对比。各写各的文件；gym 侧栏一个下拉，照抄地图课 `#gym-contam-draw`。

出击（`src/scenes/rift-scene.ts`）暂时**不 import、不接线**。默认敌人课（`gym.html` 无 lesson）与玩家课、地图课仍走现行像素 / 几何宿主。只有 `?lesson=lexicon` 可切候选渲染器。

### 接口文件（T0 创建，三方案不得改签名）

路径：`src/gym/form-renderers/form-renderer.ts`

```typescript
import type Phaser from 'phaser';
import type { ContaminationForm } from '@/generation/contamination-draw';

export const FORM_RENDERER_IDS = [
  'placeholder',
  'a-pixel-grammar',
  'b-surface-organism',
  'c-stamp-compositor',
] as const;
export type FormRendererId = (typeof FORM_RENDERER_IDS)[number];

export type FormVisualSignal = 'idle' | 'strike' | 'inflated' | 'awake';

export interface FormVisualPose {
  x: number;
  y: number;
  facing4: 'up' | 'down' | 'left' | 'right';
  moving: boolean;
  visibility: number;
  signal: FormVisualSignal;
  deltaMs: number;
}

export interface FormVisual {
  update(pose: FormVisualPose): void;
  destroy(): void;
}

export interface FormAttachContext {
  scene: Phaser.Scene;
  form: ContaminationForm;
  seed: number;
  depth: number;
  /** 甲可省略。乙=核世界坐标；丙=簇核世界坐标；丁=走廊盒世界像素。 */
  pin?: {
    kind: 'wall' | 'cluster' | 'volume';
    x: number;
    y: number;
    width?: number;
    height?: number;
  };
}

export interface ContaminationFormRenderer {
  readonly id: Exclude<FormRendererId, 'placeholder'>;
  readonly label: string;
  /** 脚手架用：false 时 gym 当现行占位，不藏默认身体。方案落地后改 true。 */
  ready: boolean;
  attach(ctx: FormAttachContext): FormVisual;
}
```

语义：给我一份 `ContaminationForm` + Phaser scene + 钉点，还我这只污染体的**视觉层**。碰撞、寻路、五态、伤害、混乱仍走现行 `Enemy` / `ContaminationHostSystem`。视觉层不得改 Arcade body、不得 `setCollision`、不得改 tile。

### 文件归属（禁止越界）

| 路径 | 谁写 | 谁改 |
| ---- | ---- | ---- |
| `src/gym/form-renderers/form-renderer.ts` | T0 code | 三方案禁止改签名 |
| `src/gym/form-renderers/registry.ts` | T0 code | 三方案禁止改 |
| `src/gym/form-renderers/scheme-a-pixel-grammar.ts` | T0 空壳（`ready: false`） | **仅方案 A** |
| `src/gym/form-renderers/scheme-b-surface-organism.ts` | T0 空壳 | **仅方案 B** |
| `src/gym/form-renderers/scheme-c-stamp-compositor.ts` | T0 空壳 | **仅方案 C** |
| `src/gym/form-renderers/a/**` | — | 仅方案 A 可新增 |
| `src/gym/form-renderers/b/**` | — | 仅方案 B 可新增 |
| `src/gym/form-renderers/c/**` | — | 仅方案 C 可新增 |
| `gym.html` `#gym-lex-renderer` | T0 | 三方案禁止改 |
| `src/gym/gym-lexicon-scene.ts` 接线 | T0 | 三方案禁止改 |
| `src/scenes/rift-scene.ts` | 谁都不许动 | — |
| `src/entities/infiltrator-sprite.ts` / `rewriter-sprite.ts` | 谁都不许动（出击仍用） | — |
| `src/entities/enemy-factory.ts` | T0 可加 gym 用 `setVisualSuppressed`；默认 false | 三方案禁止改 |
| `src/systems/contamination-host-system.ts` | T0 可加 skip-paint + 钉点查询；默认仍画几何 | 三方案禁止改 |

`placeholder` 不是第四个方案文件：下拉选它时 gym **不**藏默认身体、**不**调用候选 `attach`。用来和三个方案对比现行占位。

### 侧栏

`gym.html` 污染句法配置表内、孔谱之上或「生成」按钮旁：

```html
<label for="gym-lex-renderer">渲染方案</label>
<select id="gym-lex-renderer">
  <option value="placeholder">现行占位</option>
  <option value="a-pixel-grammar">方案 A：程序像素词法</option>
  <option value="b-surface-organism">方案 B：地表方言活体</option>
  <option value="c-stamp-compositor">方案 C：词素层叠</option>
</select>
```

绑定照抄 `src/gym/gym-map-scene.ts` 的 `bindForm()`（约 L92–121）对 `#gym-contam-draw` 的 `change` 监听。切换方案：毁掉已有 `FormVisual`，按当前在场实体重新 `attach`（不必重跑 AI spawn；宿主钉点不变）。`ready === false` 的方案当作现行占位，并在 `#gym-status` 写一行「该方案尚未落地」。

### 深度（相对裂隙 DEPTH，练习场院子沿用同一数字）

地表 0；丙视觉 ≤ `surface+1`（不要盖过玩家）；乙核约 20；甲约 25（现行敌人）；玩家 30；丁体积 40；视野蒙层约 50。丁必须低于蒙层。脚手架 `attach` 时按孔谱传入 `depth`，方案不要自己发明另一套。

### 色与量化

污染亮核只用 `#1aad96` / `#2ae6c8` / `#3cffd4`。墙锈 / 缝用暗灰，不要暖污染。`docs/art/palette.json` 是锁色板；运行时 `src/**` 目前不 import 它。方案若量化，可抄 `preview-paint.ts` 的 `PALETTE_HEX` / `nearestPalette` 进**自己的子目录**，禁止改地面管线。禁止新色。

---

## 硬闸门（四份 Brief 都遵守）

1. `docs/art-direction.md` 状态 APPROVED。DEC-066：渗透体与改写体成品是程序像素，**禁止精灵表**。本迭代候选渲染器同样禁止精灵表、禁止外部 PNG 当一只一种图。
2. `docs/art/contamination-forms.md`：不新色；覆盖体不以第三种人形出场；**丙不另做小人**（外观 = 已烤簇语义 + 整团胀缩，不是再站一个会走的人）；丁必须低于 `DEPTH.visionMask`。
3. 连通 FATAL：漆 / 体积 / 墙斑不得改碰撞、不得切开墙后可走地板。视觉层只画。
4. 视觉禁忌（art-direction §1.4）：不用触手、内脏、血浆、黏液、有机腐烂；不用卡通描边；不用科幻全息 UI。
5. 头上无字。识别走遭遇识别旁白（本课默认不开旁白）。禁止名牌、图鉴卡、OS toast。
6. 审美与「读作游戏」由**人终审**。agent 不得自称视觉过关、好看、PASS。
7. 触碰 in-game 视觉必须先 Read `.cursor/skills/in-game-ux/SKILL.md`（自定义 agent 不自动加载）。**本次主体是世界内实体外观，不是 HUD 面板**——套用方式见下一节。
8. 机器闸门：`npx tsc --noEmit`（或 `npm run typecheck`）。相关检查：`npm run check:lexicon`（不得改坏句法表）。本迭代不改地图生成，不必为方案去改 layout；若 T0 动了宿主公开类型，仍跑 `npx tsc --noEmit` 即可。不要跑 `art:postprocess` / `art:verify`（没有新精灵表管线）。
9. 禁止改 `.claude/agents` / `.cursor/agents`。禁止把画廊 PNG 当地图。禁止代码手写形态表再反向导出 CSV。

### in-game-ux HOW 怎么套（实体，不是面板）

先 Read `.cursor/skills/in-game-ux/SKILL.md`。然后：

- **载体：** 污染体是钉世界坐标的实体，走 Phaser 世界层，不是 `#dom-ui-root` 上的装置读数。不要做成检视卡、进度条、圆角怪物肖像。
- **参考：** 从 `docs/art-direction.md` 角色 / 污染节 + `docs/art/actor-pixels.md` + `docs/art/contamination-forms.md` 钉 2–3 个**已有项目参考动作**（学「表征失败的像素 / 崩坏簇呼吸 / 程序像素四向不转 GameObject」）。不要学 Darkest Dungeon 头上名、不要学图鉴 UI、不要学 Shader 演示文稿。
- **P0/P1 面板表、U 清单当后台自检：不适用侧栏。** 练习场侧栏仍是开发说明（`docs/dev/gym.md` 已锁：不要走 in-game UX 翻修）。不要把 `#gym-lex-renderer` 做成墙机。
- **U1–U12：** 不要为敌人新写一份 `ui-*.md`。世界可读（核 / 缝 / 簇 / 体积能在院子里被看成「那里有一口」）对应 U 项里「信息在世界上」的精神；不要给实体加 HUD 来补可读。
- 写完自检只答：载体是否世界实体、有没有头上字、有没有第三种人形覆盖体、有没有新色 / 精灵表 / 全息。不许写「好看」。

---

## 适配生成空间的共同要求

每个方案必须把 **1053 个无名填法 + 4 个成句**映射到**有限绘制原语**（参数化 / 组合式 / 程序化）。禁止一只一张图、禁止只做 8 个样例皮肤。

`ContaminationForm` 字段必须**全部进入视觉**（至少改剪影、密度、节律或残迹之一，肉眼能随侧栏改维度而变）：

- `substrate` / `coverage` / `continuity` / `occupancy`（occupancy 已由孔谱路由，仍要影响该孔谱内部怎么画）
- `lexemes.motion` / `sense` / `rhythm` / `contact`
- `utteranceId`（成句可有额外一笔，内部配方名不上屏）

只改 `portfolio` 或只拿 `sense` 二选一刷渗透体/改写体 = 没做本题。

**动作**（人点名的三样：外观、动作、渲染）每孔谱都要有，不能只交静帧：

| 孔谱 | 必须能看出在动 |
| ---- | -------------- |
| 甲 | 走路：朝向换贴图或换剪影（GameObject rotation 恒 0）、步态或位移节律跟 `motion`/`rhythm` |
| 乙 | 核沿缝/开合/抽打前摇；不是永远一颗死方块 |
| 丙 | 整团胀缩或核相；休息/胀满跟 `rhythm`；不另做小人 |
| 丁 | 体积 alpha/错位带跟 `rhythm` 或反视 `signal: 'awake'` |

---

## Task: T0 | assignee: code

Title: gym 渲染器脚手架（接口 + 下拉 + 空壳） | Priority: P0 | Dispatch: 🔴人驱动 code | 收敛：1 轮，过不了 tsc 升给人，禁止连修造型

**必须先于 T1/T2/T3 完成并提交。** 三方案并行改同一批 gym 文件会打架。

### 目标

污染句法课可以切换「现行占位 / 方案 A / B / C」。A/B/C 在空壳阶段 `ready: false`，画面仍是现行占位。出击完全不变。

### 具体要求

- [ ] 创建上表接口文件 + `registry.ts`（`getFormRenderer(id)`；import 三个 scheme 模块；`placeholder` 返回 `null`）
- [ ] 三个 scheme 文件各导出一个 `ContaminationFormRenderer`（`ready: false`，`attach` 可 throw 或返回空 `FormVisual`——反正 gym 在 `ready !== true` 时不得调用）
- [ ] `gym.html` 加上 `#gym-lex-renderer`（文案用上表中文）
- [ ] `GymLexiconScene`：读下拉；生成/再刷/切换时挂视觉层。选候选且 `ready` 时：藏默认甲身体（Image / 残影 / 脱落尘 / 脚下污斑），藏乙丙丁默认 Graphics 漆；保留 Arcade 碰撞与 AI。teal 状态指示物**保留**（练习场读 AI 态用，不是头上名字）。选 `placeholder` 或 `ready === false`：不藏默认视觉
- [ ] `Enemy` 增加 gym 用 `setVisualSuppressed(boolean)`，默认 false；`RiftScene` 不调用
- [ ] `ContaminationHostSystem` 增加 skip-paint 与钉点查询（丁要盒宽高；乙丙要核坐标；抽打/胀满/反视要能读成 `FormVisualSignal`）。默认仍画现行几何。禁止改伤害/混乱/连通
- [ ] `spawnJia` 仍走 `AISystem.spawnOne`；视觉 `form` 用侧栏组出来的 `ContaminationForm`，不要再用「只跟 role 走」当候选渲染的输入
- [ ] 更新 `docs/dev/gym.md` 污染句法课：渲染方案下拉；出击不接。`.cursor/rules/gym.mdc` 已由 Director 加例外，code 核一句是否仍真
- [ ] `npx tsc --noEmit` 与 `npm run check:lexicon` 通过后提交

### 禁止

改 `infiltrator-sprite.ts` / `rewriter-sprite.ts` 的像素配方；改 `RiftScene`；把侧栏做成游戏内墙机；为三个方案写任何真实外观（那是 T1–T3）。

---

## Task: T1 | assignee: code（视觉语法在本 Brief 内锁死方向；先 Read art 文档 + in-game-ux）

Title: 方案 A — 程序像素词法 | Priority: P0 | Depends: T0 | Dispatch: 🔴人驱动 | 收敛：最多 3 轮；到顶未覆盖四孔谱或字段未进画面 → 停，升级给人

**只改** `src/gym/form-renderers/scheme-a-pixel-grammar.ts` 与 `src/gym/form-renderers/a/**`。文件头写 20–40 行「本方案视觉语法」（字段→原语表）。设 `ready: true`。

### 解题思路（必须是这个，不要滑向 B/C）

把现行 **Canvas 逐像素烘焙 → 运行时换 Image** 这条路扩成一份**有限家族的配方语法**。原语是：少数剪影家族 × 覆盖密度旋钮 × 步态表，不是地面崩坏簇，也不是可拆卸图章层。

**禁止：** 把身体画成 `bakeGround` 簇/整团胀缩活层（那是方案 B）；禁止用「底图 + 叠加独立 stamp 容器」当身份（那是方案 C）；禁止只把渗透体/改写体换色。

### 1053 → 有限原语

| 字段 | 映射（方案 A 必须按此语义，具体像素自定） |
| ---- | ---------------------------------------- |
| `substrate` | 6 个残余剪影家族（有机残影 / 灯柱 / 门框 / 墙锈 / 菌毯 / 油膜）。甲是会走的该家族人形或半人形**程序像素**，不是第三种覆盖体职业 |
| `coverage` | 同一家族的像素失败程度：渗透=基体轮廓仍可读；改写=一半表征失败；覆盖=残余关闭、只剩失败像素 + 核 |
| `continuity` | 单核一块身体；裂片=同家族碎成 2–3 块仍绑一个碰撞体；菌落/场只允许在乙丙丁上变成多核/铺开，甲不要铺成挡路的场 |
| `occupancy` / 孔谱 | 甲占地走四向烘焙；乙=墙缘锈斑家族；丙=不另做小人，用核相+既有簇语义的**调制**（幅度/核色跟字段走）而不是再烘焙一个走路的人；丁=量化薄雾格 + 核 |
| `motion` | 步态表：巡路/转面/凝聚/沿壁/固着 → hitch 周期或位移方式 |
| `sense` | 失败像素的「器官」位置（缝亮、听腔、触地点），不是成对眼睛 |
| `rhythm` | 脉冲周期；与 DEC-070 的 3.1s 簇周期**脱钩**（A 用自己的步态钟） |
| `contact` | 残迹：脱落尘密度、抽打格 1px 提示、体积内更浊，不改伤害数字 |
| `utteranceId` | 成句多 1 笔已锁 teal 核行为（开合/缝视/呼吸/反视），配方名不上屏 |

烘焙可抄 `infiltrator-sprite.ts` 的 Canvas 习惯，但必须住在 `form-renderers/a/`，**不要改**出击用的那两份 sprite 文件。

### 四张孔谱

- **甲：** 32×32 或 32×48 程序像素，4 朝向 × idle/walk；`GameObject.rotation === 0`；碰撞仍 20。外观跟 `form` 走，禁止 `role === rewriter ? REWRITER : INFILTRATOR`。听噪填法可以更残、更高，但必须仍是方案 A 的家族语法，不是复用出击改写体那 17 簇配方原样。
- **乙：** 墙格锈斑 + 2×2～4px 核；开合/抽打有相。不进走廊碰撞。
- **丙：** 不另做小人。可调核大小/亮相 + 与练习场已有簇座位对齐；不要第二套呼吸算法去替代 DEC-070（可弱调制幅度）。无簇座位时仍要有可读核，不要画走路的人顶替。
- **丁：** 按格填的错宽度暗带 + 核；`signal: 'awake'` 时核亮；depth 由 ctx 传入。

### 动作

甲：木偶顿步或家族 hitch，朝向换贴图。乙：核沿折线或开合。丙：胀满相。丁：alpha/错位带跟 `rhythm`。

### 闸门与收敛

Read：`.cursor/skills/in-game-ux/SKILL.md`（按上文实体套用）、`docs/art-direction.md`、`docs/art/contamination-forms.md`、`docs/art/actor-pixels.md`。遵守本文硬闸门。`npx tsc --noEmit`、`npm run check:lexicon`。最多 3 轮；第 1 轮就必须四孔谱都能在 gym 看到随侧栏字段变化。视觉好不好不作为续跑理由。

---

## Task: T2 | assignee: code（同上，方向锁死为 B）

Title: 方案 B — 地表方言活体 | Priority: P0 | Depends: T0 | Dispatch: 🔴人驱动 | 收敛：最多 3 轮；到顶升级给人

**只改** `scheme-b-surface-organism.ts` 与 `src/gym/form-renderers/b/**`。文件头 20–40 行字段→原语表。`ready: true`。

### 解题思路（必须是这个，不要滑向 A/C）

污染体**就是裂隙地表污染方言的活块**，不是角色精灵家族。原语来自已有地面管线：`bakeGround` / 崩坏簇几何 / `nearestPalette` / `paintClusterBreath` 的整团胀缩语义。身体用失败表征的漆，不用四向人形 walk cycle。

**禁止：** 烘焙 4 朝向人形密像素（那是方案 A）；禁止独立 stamp 图库组合身份（那是方案 C）；禁止把甲画成渗透体/改写体换皮。

DEC-066 仍有效：不换精灵表。甲可以是会位移的不规则簇剪影（占地碰撞仍 20），这不是第三种人形覆盖体。覆盖深度走漆的失败程度，不走新职业小人。

### 1053 → 有限原语

| 字段 | 映射 |
| ---- | ---- |
| `substrate` | 同一套簇/缝/膜的**残余色与形状偏置**（灯柱偏冷亮核、墙锈偏暗灰缝、菌毯偏团、油膜偏薄带）。抄地面 bias→青绿轴再量化，不要新色 |
| `coverage` | 渗透=底下地板/墙仍透出；改写=半团失败；覆盖=只剩方言漆 |
| `continuity` | 单核一团；裂片=碎团仍一碰撞；菌落=多卫星团（不挡路）；场=铺开但不改碰撞 |
| 孔谱 | 甲=可走的活团；乙=墙缘那条方言缝（可参照但不复制地图课四种烤漆的菜单）；丙=本方案主场，咬合已烤簇+整团胀缩；丁=走廊盒里的方言体积雾格 |
| `motion` | 团的位移方式：滑、顿、凝聚（不离开占位规则：乙不进走廊） |
| `sense` | 核/缝亮的朝向或听相，不是眼睛 |
| `rhythm` | **允许**把周期接到约 3.1s 簇呼吸，或按其倍数；这是 B 与 A 的刻意差别 |
| `contact` | 踩踏/抽打时外沿多一圈失败像素，不改价目表 |
| `utteranceId` | 成句让该团的呼吸/缝视/反视更可读 |

可 import 地面模块的**纯函数/常量**（色、最近色、胀缩公式），禁止改 `preview-paint.ts` 出击烤地结果，禁止改 `RiftScene` 的 `liveClusterBreath`。练习场句法课院子若无完整 `bakeGround` 岛，允许在 `b/` 内用同一套簇几何在钉点上现场画一团对照，不要去改地图课。

### 四张孔谱

- **甲：** 会走的簇/膜剪影，四向用变形或核偏移表达，**不**旋转 GameObject。不要直立工业人形。
- **乙：** 墙皮鼓出的缝核，沿壁。
- **丙：** 外观 = 簇 + 整团胀缩；字段调幅度/核；不另做小人。
- **丁：** 同方言的体积暗带，低于蒙层。

### 动作

甲团随路点 hitch-滑；乙缝开合；丙呼吸；丁觉醒相。共用「失败表征在呼吸」，不要给甲单独一套卡通骨骼。

### 闸门与收敛

同 T1：Read in-game-ux（实体套用）+ art 三份。硬闸门。`npx tsc --noEmit`、`npm run check:lexicon`。最多 3 轮。

---

## Task: T3 | assignee: code（同上，方向锁死为 C）

Title: 方案 C — 词素层叠 | Priority: P0 | Depends: T0 | Dispatch: 🔴人驱动 | 收敛：最多 3 轮；到顶升级给人

**只改** `scheme-c-stamp-compositor.ts` 与 `src/gym/form-renderers/c/**`。文件头 20–40 行字段→图章表。`ready: true`。

### 解题思路（必须是这个，不要滑向 A/B）

身份 = **有限枚举图章的叠加**，不是一份配方里连续拧旋钮，也不是地面簇活体。Canvas 烘焙出小枚 1-bit / 索引色 stamp，运行时 `Container` 叠层。1053 = 组合，肉眼应能读出「换了哪一层」。

**禁止：** 单一 `drawBody(form)` 里插值密度当唯一手段（那是方案 A）；禁止身体等于崩坏簇整团（那是方案 B）；禁止精灵表。

图章必须程序绘制（boot 或首次 attach 时 bake），量化到锁色板。每枚 stamp 种类有硬上限（建议 ≤ 24 张底图，再靠 flip/offset/alpha 组合）。

### 1053 → 有限原语

建议层（可微调，但必须是离散层，每层由字段选出，不是连续混合成一张新图）：

1. **占位剪影 stamp**（4）：占地块 / 墙缝条 / 漆斑 / 体积带
2. **基体残余 stamp**（6）
3. **覆盖纱 stamp**（3）：渗透薄、改写半、覆盖厚
4. **连续性排列**（4）：一块 / 碎偏移 / 菌落小点环 / 场平铺（平铺不改碰撞）
5. **感知 stamp**（缝亮 / 听腔 / 触地点 — 失败像素，不成对眼）
6. **接触残迹 stamp**（尘、污斑、抽打点）
7. **成句标记层**（4 笔可选；不上屏字）

`motion` / `rhythm` **不是 stamp**，是播放图：哪些层每帧偏移、哪一层闪核、甲的「腿」stamp 交替。这是 C 的动作方案。

### 四张孔谱

- **甲：** Container 跟着 `Enemy` 走；腿/块 stamp 交替 = 走路；朝向换 stamp 或镜像，rotation=0。
- **乙：** 缝条 stamp + 核 stamp 钉墙格。
- **丙：** 不另做小人。簇座位上叠**核 stamp + 菌落卫星 stamp**；胀缩用 stamp scale 或外圈 stamp 显隐，不要画走路人。
- **丁：** 体积带 stamp 平铺在盒内 + 核；awake 时核层亮。

换侧栏一个字段，应能指出「哪一层换了」。若改基体和改节律长得一样，不合格。

### 闸门与收敛

同 T1。硬闸门。`npx tsc --noEmit`、`npm run check:lexicon`。最多 3 轮。

---

## 第一轮派发顺序（已执行，不要重派）

```
T0 code（脚手架）  ──串行，先完成──▶  T1 / T2 / T3 code  三方案并行
```

## 第一轮明确不做（已被第二轮部分废止）

第一轮合同曾写「不改抽卡 CSV」。**第二轮要改 CSV**（DEC-080）。第一轮其余禁止仍有效：不接到出击；不改默认敌人课 / 玩家课 / 地图课生产外观；不规划 Slice 11；不标 COMPLETE。

---

# 第二轮（方案 D，DEC-080）

人已试玩并逐条差评。四个拍板见 DEC-080。本轮**同时**动 CSV、宿主机制、共享钉接口与视觉层，但仍是迭代 2，不另立。

**FATAL：** `src/scenes/rift-scene.ts` 与出击画面本轮零改动。任何会改变出击行为的机制必须做成练习场才生效的开关（推荐名：`gymLiveMotion`，默认 `false`；只有 `GymLexiconScene` 传 `true`）。改生成器钉层集合会波及出击——本轮禁止改 `collectWallEdges` 产出的墙格**集合**。

## A/B/C 三份代码怎么处置

| 路径 | 第二轮 |
| ---- | ------ |
| `scheme-a-pixel-grammar.ts` + `a/**` | **冻结对照**。禁止改。甲的手法从这里抄进 `d/` |
| `scheme-b-surface-organism.ts` + `b/**` | **冻结对照**。禁止改。丙的手法从这里抄进 `d/`；乙丁不要再沿用 B 的格心钉与 `seamSlidePx` |
| `scheme-c-stamp-compositor.ts` + `c/**` | **冻结对照**。禁止改。方案 D 不走图章层叠 |
| `#gym-lex-renderer` | 默认 `d-mixed`。保留 A/B/C 选项，文案加「对照（已冻结）」 |
| 方案 D | `scheme-d-mixed.ts` + `d/**`（本轮唯一可写的渲染实现） |

不要删 A/B/C。人还可能把 D 和对照并排看。

## 人的差评 → 本轮必须成立（不要曲解）

**甲：** 走方案 A。数量要多、形态要丰富；三个基底都要够用；覆盖深度的想象力要对标现行改写体（人形底 + 青绿污染簇叠加 + teal 像素沿朝向 ±1px melt + 按 AI 态换变体），禁止再靠「透明掉 38%/74%」交差。

**丙：** 走方案 B，几近完美。补多样性：形状参数、配色（跟碎片）、以及合法基底种类（当前只有 2 个是隐藏瓶颈）。

**乙：** 可沿 B 的方向，但：必须附着在墙面（墙-地交界），不是墙格几何中心；必须在相连墙面上缓慢游荡；要有攻击表现。危险区（可抽打地板格）跟着核走。

**丁：** B 的表现约 30 分。要像缓慢移动、微微形变的云，不要逐像素 hash 填满盒子。基底不是油膜。减视野 + 加混乱的范围跟着云走。

**共性：** 配色随碎片 bias；攻击与核心要素匹配且发生时可见；基底丰富度是外形差异的主轴。

## 第二轮硬闸门（R2 每份 Brief 都遵守）

1. 不新色。污染亮核只用 `#1aad96` / `#2ae6c8` / `#3cffd4`。量化到 `docs/art/palette.json`。禁止改出击地面管线。
2. 禁止精灵表、禁止外部 PNG 当一只一种图。禁止改 `infiltrator-sprite.ts` / `rewriter-sprite.ts`（出击仍用）；甲的改写体手法**抄进** `d/`，不要改出击那份。
3. 覆盖体不以第三种人形出场。丙不另做小人。
4. 头上无字。侧栏仍是开发说明，不要做成墙机。
5. 连通 FATAL：漆 / 体积 / 墙斑不得改碰撞、不得切开墙后地板。乙核不得进走廊碰撞。
6. 视觉禁忌：不用触手、内脏、血浆、黏液、有机腐烂；不用卡通描边；不用科幻全息 UI。
7. 触碰 in-game 视觉必须先 Read `.cursor/skills/in-game-ux/SKILL.md`。主体是世界内实体，不是 HUD。套用方式同第一轮「in-game-ux HOW 怎么套」。
8. 机器闸门：`npx tsc --noEmit`；动了 CSV / 字母表 → `npm run check:lexicon`；动了 `src/generation/` 且可能影响布局 → `npm run check:layout`（本轮若只加有序路径纯函数且不改 `collectWallEdges` 集合，仍跑一次 layout 作回归）。不要跑 `art:postprocess` / `art:verify`。
9. 禁止改 `.claude/agents` / `.cursor/agents`。禁止把画廊 PNG 当地图。
10. 战斗红线：新攻击方式不得让试玩者开始享受战斗。绕仍应比打更划算。不推翻 `system-combat.md` V3（无震屏、无命中停顿、无伤害数字）。
11. 审美人终审。agent 不得自称视觉过关、好看、PASS。

## 第二轮文件归属

| 路径 | 谁写 / 谁改 |
| ---- | ----------- |
| `data/contamination-substrates.csv` 及方言权重相关 CSV | **仅 R2-D1 design**；code 禁止手写基底 |
| `src/generated/contamination-lexicon-data.ts` | 仅 R2-C-data 经 `npm run codegen` |
| `src/gym/form-renderers/form-renderer.ts` | R2-C0 只许**加可选字段**（`attach`、`fragmentTypeId`、`d-mixed` id） |
| `src/gym/form-renderers/registry.ts` | R2-C0 登记 D；不要删 A/B/C |
| `src/gym/form-renderers/scheme-d-mixed.ts` | R2-C0 建壳（按孔谱分发）；之后只加 import，不在此文件画像素 |
| `src/gym/form-renderers/d/fragment-ramp.ts` | R2-C0 |
| `src/gym/form-renderers/d/jia-*.ts` | **仅 R2-C3** |
| `src/gym/form-renderers/d/bing-*.ts` | **仅 R2-C4** |
| `src/gym/form-renderers/d/yi-*.ts` | **仅 R2-C5** |
| `src/gym/form-renderers/d/ding-*.ts` | **仅 R2-C6** |
| `src/generation/wall-edge-path.ts`（新） | R2-C0 |
| `src/generation/contamination-pins.ts` | **禁止改** `collectWallEdges` 行为 |
| `src/systems/contamination-host-system.ts` | R2-C0 可加开关与钉查询；R2-C2 写游荡 / 飘 / 接触 / 危险区 |
| `src/gym/gym-lexicon-arena.ts` / `gym-lexicon-scene.ts` / `gym.html` | R2-C0（碎片选择 + 感受伤害 + 下拉默认 D） |
| `src/generation/contamination-draw.ts` | R2-C-data：出击抽卡白名单旧六种 |
| `src/scenes/rift-scene.ts` | **谁都不许动** |
| `a/**` `b/**` `c/**` | **谁都不许动** |

### 接口增量（R2-C0 必须按此加，禁止另起一套）

`FORM_RENDERER_IDS` 增加 `'d-mixed'`。

`FormAttachContext` **只加可选字段**（A/B/C 必须仍能编译）：

```typescript
export type WallFace = 'n' | 'e' | 's' | 'w';

export interface FormWallAttach {
  /** 墙格朝向可走地板的那一面 */
  face: WallFace;
  /** 指向可走地板的单位法线（face='s' → nx=0, ny=1） */
  nx: number;
  ny: number;
  /** 墙-地交界中点的世界像素（贴附点，不是格心） */
  seamX: number;
  seamY: number;
}

export interface FormAttachContext {
  scene: Phaser.Scene;
  form: ContaminationForm;
  seed: number;
  depth: number;
  /** 观察院子当前碎片。方案 D 用来推配色。 */
  fragmentTypeId?: string;
  pin?: {
    kind: 'wall' | 'cluster' | 'volume';
    x: number;
    y: number;
    width?: number;
    height?: number;
    attach?: FormWallAttach; // 仅 kind==='wall'
  };
}
```

乙的 `pin.x/y` 改为缝坐标（`seamX/seamY`），不要再填 `col*32+16, row*32+16`。此改只走 `getVisualPin` 在 `gymLiveMotion` 为真时的路径；出击默认仍走旧格心几何漆（因为出击不挂方案 D，且 `gymLiveMotion` 为假）。

---

## Task: R2-D1 | assignee: design

Title: 概念基体进 MVP + 新基底 CSV + 接触攻击对照表 | Priority: P0 | Dispatch: 🔴人驱动 design | 收敛：1 轮写完表；过不了「行能喂给 check:lexicon」则停，升级给人。禁止画像素、禁止改 `src/`。

**必须先于 R2-C-data / R2-A1 / R2-C2。** 可与 R2-C0 并行。

### 目标

把人已拍板的设计写进活文档和 CSV，让后面的 code 不用猜 id、残余动词、合法孔谱、方言权重、接触通道。

### 具体要求

- [x] `world.md`：概念基体开放问题标为已决（DEC-080 已翻；核对本轮 director 改过的句子，补任何遗漏）。术语表若缺「概念基体 / 有机基体 / 无机基体」则补。MVP「一种时空风格」那句不要改成五种世界观——碎片 bias 不是新时空。
- [x] `docs/design-notes/contamination-lexicon.md`：§2 写清「概念基体 ≠ 概念生物」（仍必须有占位与六件套；三类新基体走占空）。§3.1 不再写「封闭六种」；补新行（id / 残余动词 / 合法占位 / 合法连续性）。§4.2 矩阵：不新开占声主孔谱。§4.3 丁：基底改为概念三类，外观写成云状体积。油膜只占漆。
- [x] `docs/specs/system-contamination-lexicon.md`：就地扩写实现规格（`last-modified-date` 今天；`interface-changed: true`）。废止「油膜必须能占空」。Schema 增加出击/练习场范围约定（见下）。方言表纳入新基体权重。`check:lexicon` 合同从「六行必须都在」改为「CSV 与 generated 一致；出击白名单锁旧六种直到人选后接线」。
- [x] `docs/specs/system-combat.md`：就地加一小节「接触词素 → 伤害通道」（指向句法 spec 数字，不复制第二份价目表）。写明 **gym 先兑现、出击默认仍按宿主 kind 硬编码**。重申成功标准与 V3 不推翻。`interface-changed: true`。
- [x] **你写 CSV，禁止让 code 编基底：**
  1. `data/contamination-substrates.csv` 新行（配额锁死，id 你定，须稳定英文蛇形）：
     - 甲：至少 **2** 种新的占地合法基体（有机 / 无机各至少 1）。禁止概念基体给甲。
     - 丙：至少 **1** 种新的占漆合法基体（当前合法只有菌毯、油膜）。
     - 乙：本轮可不加种类；若加，只能占墙。
     - 丁：必须 **3** 种概念基体，`legal_occupancies` **仅** `volume`：声音、光线、空间关系。残余动词必须在渗透深度可读（各一个短动词）。
  2. `oil_film` 的 `legal_occupancies` 改回只有 `paint`（可保留 `monolith|colony|field`）。
  3. 每行填齐 `display_token` / `residual_verb` / `legal_occupancies` / `legal_continuities`。字段内禁止 ASCII 逗号。
  4. 方言：更新生成器权重所在处（若权重在 `contamination-draw.ts` 而不是 CSV，在 spec 里写出新权重表，交给 R2-C-data 改代码——**仍不要在代码里发明未写入 spec 的 id**）。
  5. 成句 `corridor_watching`：基体从油膜改绑一个概念基体。
  6. 若 checker / codegen 需要新列 `enabled_scope`（建议取值 `sortie|gym`；旧六种 `sortie`，本轮新行 `gym`），你定列并写进 spec。没有新列则 R2-C-data 用代码白名单，你必须在 spec 列出白名单那六种 id。
- [x] **接触词素对照表**（写入句法 spec，code 不得另猜）：

  | contact id | 甲 | 乙 | 丙 | 丁 |
  | ---------- | -- | -- | -- | -- |
  | （现有五词） | 写清通道：打血 / 混乱 / 视野 / 仅驱散核 | 同上 | 同上 | 同上 |

  人要求「与核心要素匹配」。概念基体的丁：声音/光线/空间关系都仍走体积场（混乱+视野），**不要**发明精神攻击空包，**不要**新开打血通道把丁变成近战。若某词素在某孔谱非法，沿用既有 `rewrite_to`，不要加 DPS 词缀。
- [x] 甲「同一种类内部多种形态」**不要**写成 CSV 行。在设计正文写一句：变体由渲染种子 × 覆盖深度生产，配额 ≥3 种剪影/族内变体（R2-A1 / R2-C3）。

### 禁止

原创像素配方、改 `src/`、启用占声主孔谱、给丁加近战、把新基体默认抽进出击、推翻战斗 V3、声称视觉过关。

### 闸门

产出能让下一手 R2-C-data 直接 codegen：CSV 合法、spec 数字与第一版价目不打架（乙抽打 15 / 前摇 350 ms；丁 +1.0 混乱/秒、视野 ×0.7；甲三刀账不变）。到顶未交表 → 停，升级给人。

### R2-C-data 交接（R2-D1 写下，禁止改 `src/` 的 design 已停在这里）

1. `npm run codegen` 必须认 `enabled_scope` 列并写入 `SubstrateDef.enabledScope`。当前 `tools/csv-codegen/generate.mjs` 会忽略该列。
2. 修 `tools/contamination-lexicon/check-lexicon.ts`：废止「oil_film 必须能占空」。按句法 spec Schema 合同 1–8 断言（CSV 与 generated 一致、sortie 白名单旧六种、油膜仅 paint、三个概念仅 volume、`corridor_watching` 绑 `space_interval`、`drawSortie` 不含 gym 行）。
3. `drawSortie` 过滤 `enabledScope !== 'sortie'`。丁无 sortie 合法基体则改抽乙。`DIALECT` 与 `residualMotion` 按句法 spec 表改；禁止出现未写入 spec 的 id。
4. gym 句法课下拉读全表，按孔谱过滤 `legal_occupancies`。不要手写 `src/generated/`。不要改 `RiftScene`。

---

## Task: R2-C0 | assignee: code

Title: 方案 D 脚手架 + 墙附着接口 + 院子碎片 + 有序墙面路径 | Priority: P0 | Dispatch: 🔴人驱动 code | 收敛：1 轮；过不了 tsc 升给人，禁止顺便重画四孔谱。

**可与 R2-D1 并行。** 不依赖新 CSV。禁止改 A/B/C 文件。禁止改 `RiftScene`。禁止改 `collectWallEdges`。

### 目标

句法课可以选方案 D（空壳可 `ready: false`）。钉接口能表达墙面。院子有碎片身份。乙游荡所需的**有序墙面路径**以纯函数存在，出击钉层集合不变。

### 具体要求

- [x] `FORM_RENDERER_IDS` 加 `d-mixed`。`scheme-d-mixed.ts`：按 `form.occupancy` / 孔谱分发到 `d/jia` `d/bing` `d/yi` `d/ding`（文件可先空实现：返回 no-op `FormVisual`）。`ready: false` 直到至少一孔谱由后续任务填实——本任务不要画成品像素。
- [x] `registry.ts` 登记 D；A/B/C 仍可切。`gym.html` 下拉：默认方案 D；A/B/C 文案加「对照（已冻结）」。
- [x] 按上文「接口增量」扩展 `FormAttachContext`（可选字段）。A/B/C 不消费新字段，必须仍编译。
- [x] 新建 `src/generation/wall-edge-path.ts`：`orderWallEdgeTiles(tiles): {col,row}[]`。输入是 `WallEdgePolyline.tiles` 那种**集合**；输出是沿四连通墙面行走的有序路径（同一连通墙皮一条；多段则多条，调用方拼）。**必须保持 tile 集合相等**（只排序/串线，不增不删格）。写单元级断言或 gym 可打印的自检：`set(input) === set(output)`。Brief 要求你在注释里论证：出击若仍读 `collectWallEdges` 原数组，出生格选择与现在一致；本函数只给 `gymLiveMotion` 用。连通 FATAL 仍适用（本函数不得改碰撞）。
- [x] `getVisualPin` 在将来说 `gymLiveMotion` 时能填 `attach`。本任务可先算 `attach` 但**出击路径不得改 spawn 格心**（`tickYi` 仍可不移动——那是 R2-C2）。若你改了 `spawnYi` 的核坐标，必须证明只有 gym 开关为真时才贴缝，默认仍格心。
- [x] 观察院子碎片：`createLexiconObserveMap()` 带 `fragmentTypeId`（五选一，默认与地图课某一常见碎片一致，例如 `frag-clinic`）。侧栏 `#gym-lex-fragment`。换碎片：重铺院子墙/地的 **bias 着色**（可抄 `deriveContamRamp` 语义进 `d/fragment-ramp.ts`，或给院子 tile 上色），**禁止**调用 `generateRiftLayout` 把观察院子换成生成岛，**禁止**改 `preview-paint.ts` / `bakeGround`。
- [x] 侧栏「感受伤害」开关：关 → 现行 `setGodMode(true)`；开 → `setGodMode(false)`，才能看见乙抽打掉血。默认仍无敌（避免人看外形时被打死）。不要改出击。
- [x] `docs/dev/gym.md` 污染句法课补：方案 D 默认、碎片下拉、感受伤害、A/B/C 冻结对照。`.cursor/rules/gym.mdc` 同步一句。
- [x] `npx tsc --noEmit`。若动了 `src/generation/`：`npm run check:layout`。`npm run check:lexicon`（本任务不应改坏表）。

### 禁止

画甲覆盖深度成品、让乙开始游荡、改 CSV、改 `collectWallEdges`、import 方案 D 进 `RiftScene`。

---

## Task: R2-C-data | assignee: code

Title: codegen 新基底 + 出击抽卡白名单 | Priority: P0 | Depends: R2-D1 | Dispatch: 🔴人驱动 code | 收敛：1 轮；check:lexicon 不过则停。

### 目标

CSV 成为代码真相。出击抽卡仍只抽旧六种，练习场句法课能选新行。

### 具体要求

- [ ] `npm run codegen`（或项目既有 lexicon codegen）。禁止手写 `src/generated/contamination-lexicon-data.ts`。
- [ ] 修 `tools/contamination-lexicon/check-lexicon.ts`：废止「oil_film 必须能占空」；改为断言三个概念基体仅 `volume`、油膜仅 `paint`、新占地/占漆行合法。
- [ ] `src/generation/contamination-draw.ts`（及任何硬编码 `organic_remnant` 联合类型的 gym 侧栏）：出击 `drawSortie` **白名单旧六种**。新行只出现在句法课配置表。TypeScript 联合类型若从 generated 来，出击路径要显式过滤，不能让新丁在裂隙里以旧几何盒出生。
- [ ] 方言权重按 R2-D1 spec 表改；没有写入 spec 的 id 禁止出现。
- [ ] gym 句法课基体下拉读全表，并按当前孔谱过滤 `legal_occupancies`（甲看不到仅占空的概念基体）。
- [ ] `npx tsc --noEmit` 与 `npm run check:lexicon`。

### 禁止

画像素、改 `RiftScene`、让 `drawSortie` 开始抽概念基体、改 A/B/C。

---

## Task: R2-A1 | assignee: art

Title: 方案 D 四孔谱视觉语法 + 受击表现规格（最短合规） | Priority: P0 | Depends: R2-D1 | Dispatch: 🔴人驱动 art | 收敛：1 轮规格；不要自己实现 `src/`。

**已交（2026-08-22）。** 规格在 `docs/art/contamination-forms.md`「练习场方案 D」。出击节未改写成 D。后续 R2-C3/C4/C5/C6 只读该节画像素。

### 目标

后面四个绘画任务共用一份语法，避免 code 再发明第三种人形或惊吓向受击。

先 Read `.cursor/skills/in-game-ux/SKILL.md`（实体套用，不是面板），再读 `docs/art-direction.md`、`docs/art/contamination-forms.md`、`docs/art/actor-pixels.md`、`docs/art/rift-fragment-surfaces.md`。

### 具体要求

就地扩写 `docs/art/contamination-forms.md`（加「练习场方案 D」节，**不要**把出击生产 HOW 改写成 D）。锁死：

1. **甲：** 方案 A 路子。覆盖深度对标改写体：FLESH/CLOTH 底 + DEEP/MID/CORE/GLOW 青绿簇 + teal melt，不是 fail-percent 透明。每种占地基体 ≥3 种族内剪影变体（种子）。数量感：观察甲时默认刷得比现在密（规格写建议数量，实现归 R2-C3）。
2. **丙：** 方案 B 路子。多样性旋钮：形状参数（团扁/核偏移/外沿破损）+ 碎片配色。不另做小人。
3. **乙：** 贴 `attach.seam*` 的墙皮生物；厚度在墙格朝走廊的那 1–3px，不要画在格心。游荡是整只沿墙，不是贴图像素抖。抽打：将被抽打的**地板格**要有 1px 点（方案 A 乙有过，B 藏掉了——D 必须有）。无全格闪白、无全息圈。
4. **丁：** 缓慢移动、微微形变的云（alpha / 外沿呼吸），不是 hash 棋盘填盒。三种概念基体剪影可区分（声音偏脉动带、光线偏薄亮脉、空间关系偏错位暗体积——你可改用更贴 art-direction 的词，但必须三种能分开）。低于视野蒙层。
5. **配色：** 从碎片 bias 推青绿轴再量化；五种碎片在同一只敌人上要能看出差别。不新色。
6. **攻击表现：** 不推翻战斗 V3。优先敌人侧（出手相、抽打格、云在玩家身上的浊）+ 玩家既有白闪。禁止震屏、禁止命中停顿、禁止伤害数字、禁止 jump scare。调性：缓慢、有节奏、压迫而非惊吓。
7. 载体自检：世界实体、无头上字、无第三种人形覆盖体、无精灵表。不许写「好看」。

### 禁止

改 `src/`、改出击 HOW 成唯一生产标准、启用触手/内脏/血浆。

---

## Task: R2-C2 | assignee: code

Title: gym 开关下的乙游荡 / 丁飘移 / 危险区跟随 / 接触词素 | Priority: P0 | Depends: R2-C0, R2-D1, R2-C-data | Dispatch: 🔴人驱动 code | 收敛：最多 2 轮；到顶升级给人。

### 目标

所见即所得的机制层。视觉层还没重画也能在 placeholder / 对照方案里验证：核在墙上走、盒在动、抽打格跟着走、关无敌会掉血。

### 具体要求

- [ ] `ContaminationHostSystem.create` 增加选项 `gymLiveMotion?: boolean`（默认 `false`）。**论证：** `RiftScene` 现有调用不传此参数，出击 `tickYi` / `tickDing` 行为与本任务之前逐帧一致（乙核不移动、丁盒不移动、伤害仍按宿主 kind）。把论证写进该文件头注释。
- [ ] `gymLiveMotion === true` 时：
  - **乙：** `tickYi` 沿 `orderWallEdgeTiles` 路径缓慢游荡（速度跟 `lexemes.motion`：沿壁走、固着则停、转面可掉头）。`host.core` 更新为缝坐标。`strikeFloors` 每帧按核的当前邻接可走格重算。前摇/伤害仍走 `combat.applyHazardHit`，价目不变（15 / 350ms）。
  - **丁：** `tickDing` 移动并微变形体积盒（跟 `motion_wind` / `trail` / `anchor`；固着则形变不位移）。`VOLUME_SIGHT_MULT` 与 `VOLUME_CHAOS_PER_SEC` 用**当前盒**，不是出生盒。
  - **接触：** 读 `form.lexemes.contact`（`src/systems/` 内必须真正读取）。按 R2-D1 对照表选通道。非法组合走既有 `rewrite_to`。禁止新 DPS。丙仍不打血。
- [ ] 抽打提示数据要能被方案 D 读到（`getVisualSignal()==='strike'` + 当前 `strikeFloors` 查询）。方案 B 的 `skipPaint` 仍可藏默认 4×4 telegraph，但 gym 默认方案 D 必须能画地格点（画在 R2-C5）。
- [ ] 受击：不要改 `combat-system.ts` 去加震屏/顿帧。练习场「感受伤害」打开时，既有白闪 + 音效必须能发生（修掉「无敌导致 `applyHazardHit` 直接 false」这条观察路径）。若要补敌人出手相，只加在 gym 或 `FormVisualSignal`，不要推翻 V3。
- [ ] `npx tsc --noEmit`；`npm run check:lexicon`。若动生成器：`npm run check:layout`。

### 禁止

改 `RiftScene`、改 A/B/C、让出击乙开始游荡、把丁做成近战、加震屏。

### 战斗红线（写进提交说明）

如果本任务让甲/乙的交手读起来「很爽」，不合格。价目表数字本轮不涨伤害、不加连击。

---

## Task: R2-C3 | assignee: code

Title: 方案 D 甲 — 程序像素词法 + 基底变体 + 覆盖深度 | Priority: P0 | Depends: R2-A1, R2-C0, R2-C-data | Dispatch: 🔴人驱动 code | 收敛：最多 3 轮；第 1 轮就必须能在 gym 看到多种基底与覆盖深度差别。

**只改** `d/jia-*.ts` 与 `scheme-d-mixed.ts` 的甲分发。可抄 `a/` 与 `rewriter-sprite.ts` 的手法进 `d/`，禁止改那两处原文件。

### 必须成立

- 走方案 A 路子（Canvas 逐像素烘焙 → Image；四向；`GameObject.rotation === 0`）。
- 覆盖深度对标改写体，禁止 `applyCoverageFail` 式透明百分比当主手段。
- 每个占地合法基体（旧三种 + R2-D1 新行）在侧栏切换时外形明显不同；同一基体 ≥3 种种子变体。
- 观察甲时数量比第一轮密（跟 R2-A1 建议数量；碰撞仍 20，不得叠成墙）。
- 配色读 `fragmentTypeId` + `d/fragment-ramp.ts`。
- `ready`：甲可看时，若其它孔谱仍空壳，gym 只对甲藏默认身体。
- Read in-game-ux（实体套用）+ art 三份 + R2-A1 节。
- `npx tsc --noEmit`、`npm run check:lexicon`。

### 禁止

第三种覆盖体人形职业、精灵表、改出击 sprite、改丙乙丁的 `d/` 文件。

---

## Task: R2-C4 | assignee: code

Title: 方案 D 丙 — 地表方言活体多样性 | Priority: P0 | Depends: R2-A1, R2-C0, R2-C-data | Dispatch: 🔴人驱动 code | 收敛：最多 2 轮。

**只改** `d/bing-*.ts`。抄 `b/` 丙，禁止改 `b/`。

### 必须成立

- 不另做小人。咬合簇语义 + 整团胀缩（可弱调制，不要第二套呼吸算法替代 DEC-070）。
- 形状参数随 `substrate` / `continuity` / `rhythm` 变；新占漆基体必须可辨。
- 配色跟碎片。换侧栏碎片，同一只丙要变。
- Read in-game-ux + R2-A1。`npx tsc --noEmit`、`npm run check:lexicon`。

### 禁止

走路的人顶替簇、改 `liveClusterBreath` 出击路径、改甲乙丁文件。

---

## Task: R2-C5 | assignee: code

Title: 方案 D 乙 — 墙面附着 + 游荡外观 + 抽打提示 | Priority: P0 | Depends: R2-A1, R2-C0, R2-C2 | Dispatch: 🔴人驱动 code | 收敛：最多 3 轮。

**只改** `d/yi-*.ts`。不要用方案 B 的格心 + `seamSlidePx`。

### 必须成立

- 画在 `attach.seam*` / 法线一侧，厚度 1–3px 量级贴墙皮。
- 运动外观跟 `host.core`（R2-C2 已经在走），不要只在 Graphics 里滑像素。
- `signal==='strike'` 时在**将被抽打的地板格**画 1px 量化青点（方案 A 乙有过）。禁止只加敌人 rim glow。
- 配色跟碎片。门框 / 墙锈（及 D1 若加的占墙基体）可辨。
- Read in-game-ux + R2-A1。`npx tsc --noEmit`、`npm run check:lexicon`。

### 禁止

核画在墙格中央、进走廊碰撞、改 `collectWallEdges`、改甲丙丁文件。

---

## Task: R2-C6 | assignee: code

Title: 方案 D 丁 — 形变云 + 概念基体 | Priority: P0 | Depends: R2-A1, R2-C0, R2-C2, R2-C-data | Dispatch: 🔴人驱动 code | 收敛：最多 3 轮。

**只改** `d/ding-*.ts`。

### 必须成立

- 云：缓慢位移 + 微微形变（外沿 / alpha），跟 R2-C2 的当前盒一致。禁止 `paintVolume` 式逐像素 hash 填满 192×192。
- 基底不是油膜；三种概念基体可辨。油膜若仍出现在侧栏，丁应被孔谱过滤挡掉。
- 玩家走进当前云：视野与混乱跟盒走（机制在 C2）；视觉上云要罩住那个盒。
- `signal==='awake'` 核相。depth 由 ctx 传入，低于蒙层。
- 配色跟碎片。
- Read in-game-ux + R2-A1。`npx tsc --noEmit`、`npm run check:lexicon`。

### 禁止

油膜当丁主外形、改碰撞、改甲乙丙文件、接到出击。

---

## Task: R2-QA | assignee: qa

Title: 第二轮机械对照（审美不代勾） | Priority: P1 | Depends: R2-C3, R2-C4, R2-C5, R2-C6, R2-C2 | Dispatch: 🟢可自动派 qa | 收敛：1 轮报告。

对照 spec + 本任务书，不看「好不好看」。报告写入 `docs/qa/`（新文件 `iteration-2-round-2.md`）。

必须回答：

1. `rift-scene.ts` 本轮 diff 是否为空。
2. `gymLiveMotion` 默认是否 false；出击乙核是否仍不移动。
3. `collectWallEdges` 墙格集合是否未改。
4. 有无新精灵表 / 新色 / 第三种人形覆盖体 / 头上字。
5. `lexemes.contact` 是否在 `src/systems/` 被读取（gym 路径）。
6. `check:lexicon` / `tsc` /（若动生成器）`check:layout` 是否绿。
7. 出击 `drawSortie` 是否仍白名单旧六种。

审美 / 读作游戏：标「等人终审」，禁止 PASS。

---

## 第二轮派发顺序

```
并行波 0:
  R2-D1 design
  R2-C0  code

R2-D1 完成后:
  R2-C-data code
  R2-A1     art          } 二者可并行

R2-C0 + R2-D1 + R2-C-data 完成后:
  R2-C2 code（机制，串行于绘画乙丁之前）

R2-A1 + R2-C0 + R2-C-data 完成后可并行:
  R2-C3 甲
  R2-C4 丙

R2-A1 + R2-C2 完成后可并行:
  R2-C5 乙
  R2-C6 丁   （丁还要等 R2-C-data）

全部绘画 + C2 完成后:
  R2-QA
```

依赖图：

```
R2-D1 ─────────────┬──► R2-C-data ──┬──► R2-C2 ──┬──► R2-C5
                   │                │            └──► R2-C6
                   └──► R2-A1 ──────┼──► R2-C3
                                    └──► R2-C4
R2-C0 ─────────────┬────────────────┘
                   └──►（C3/C4 也依赖 C0）
```

- 上层 spawn 子代理。Director 本轮不调用 Agent 工具。
- 每一任务一次会话。到顶未收敛 → 停，升级给人，禁止无声续跑。
- 人选方案 D 并要接出击 = 新任务，不在本轮收尾范围。

## 第二轮明确不做

- 不改 `RiftScene`、不把方案 D 接到出击。
- 不推翻战斗 V3，不加震屏 / 命中停顿 / 伤害数字。
- 不启用占声第五张主孔谱。
- 不改默认敌人课 / 玩家课 / 地图课生产外观（句法课院子着色除外）。
- 不规划 Slice 11。不标迭代 1 或 2 COMPLETE。
- 不删 A/B/C 源码。

