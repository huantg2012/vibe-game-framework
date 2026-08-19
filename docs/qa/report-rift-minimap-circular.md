---
status: REVIEW
created-by: qa agent
created-when: 2026-08-19
slice: 6
task: Q2
note: |
  检查点后热修 DEC-063：裂隙圆形局部窗口小地图。不是全 Slice 验收。
  机械通过 ≠ 审美通过。不代人勾好看 / 像游戏 / PASS。不标 Slice COMPLETE。
  2026-08-19 复扫：C6 墙格外侧采样热修后，问题 1 改为已修复。未做浏览器实机试玩。
---

# QA Report: 裂隙圆形局部窗口小地图（DEC-063）

日期：2026-08-19
Spec 版本：`docs/specs/system-chaos-scavenge-extract.md` 规则 30 / 30a–30k（`last-modified-date: 2026-08-19`）；`docs/specs/system-movement-vision.md` 规则 25；像素：`docs/art/ux-visual-pass-slice-55.md` 第 4 节；U1–U12：`docs/specs/_template-ui.md`；挂载：`docs/architecture.md` Minimap 行
代码版本：工作区 C6 + 墙格采样热修（`src/ui/minimap.ts`、`src/scenes/rift-scene.ts` `syncMinimapExploration` / `isMinimapSampleVisible`、`src/ui/dom/panel-styles.ts` `#rift-minimap` 段）。HEAD `ec99e40`
范围：Task Q2。不是全 Slice 验收。2026-08-19 第二次机械比对（只复扫问题 1 与十二条回退）。

开工闸门：已 Read `.cursor/skills/in-game-ux/SKILL.md`「画完自检」1–8。本报告用证据作答，不写口号。

机器闸门：`npx tsc --noEmit` **退出码 0**（复扫时 QA 自己再跑；与声称一致）。仓库 `package.json` 无 `test` 脚本，未跑单元测试。未跑浏览器实机。

### 总判

机械层：**符合**。上次报告的问题 1（墙格永不点亮）**已修复**。十二条无回退。**没有新的确定偏差。** 审美、是否像游戏、U2 观感 **待人终审，不代勾 PASS**。不标 Slice COMPLETE。

---

## 逐条机械比对（Task Q2 十二条）

每条：**符合** / **偏差** + 证据路径。

| # | 要求 | 判定 | 证据 |
| - | ---- | ---- | ---- |
| 1 | 圆形；覆盖 ≠ 完整 64×42。画布 75×75 / 25 格，不是 192×126 | **符合** | `src/ui/minimap.ts`：`WINDOW_TILES = 25`、`MINIMAP_SCALE = 3`、`CANVAS_SIZE = 75`。`create()` 设 `canvas.width/height = CANVAS_SIZE`，不乘 `mapWidth`/`mapHeight`。`panel-styles.ts` `#rift-minimap canvas` 样式宽高 75 像素。25 ＜ 缓冲较短边 42（规则 30b） |
| 2 | 局部窗口跟随玩家，不是把整张缓冲压进圆或缩放到刚好塞进缓冲 | **符合** | `minimap.ts` `update()`：`originTileX/Y = playerTile − 12`，再 `drawFrame` 只遍历 25×25。无 `drawImage` 缩放全图。无按 64×42 计算画布 |
| 3 | 圆内同时有已探索与未探索迷雾；未探索格保持 `#080a0c`，不要跳过不画导致透明 | **符合** | `drawFrame` 先 `fillRect` 整张 75×75 为 `BG_COLOR = '#080a0c'`，再 `clip` 后只把已探索的非虚空格改画地板/墙（墙 `#4a4e55`）。未探索 / 虚空 / 缓冲外都留底色，不是透明。墙格进入已探索：见问题 1 已修复 |
| 4 | 揭示 = 真实视野：`visibility.update` 之后用 `getVisibilityAt` 累积；小地图不得用 `RADIUS_AMBIENT` 近似圆；不得 import VisibilitySystem | **符合** | `onPostUpdate` 顺序未改：先 `visibility.update`，再 `syncMinimapExploration`，再 `minimap.update`。累积仍走 `getVisibilityAt > 0`（格心，失败则四边外侧）。扫描包围盒仍是 `RADIUS_FORWARD`，不是 `RADIUS_AMBIENT` 画圈。`minimap.ts` 无 `import` VisibilitySystem。未扩 `VisibilitySystemAPI`（`interface-changed: false`） |
| 5 | 玩家标记带朝向（十字 + 四向短臂，`getFacing4()`） | **符合** | 场景：`minimap.update(..., this.player.getFacing4(), ...)`。`drawPlayerCross`：5×5 十字 + 仅一侧 2×2 短臂（上/右/下/左）。`Player.resolveFacingTarget` 站住返回 `null`，朝向保持上一帧。色 `#c4873a`，无 `arc` 画玩家 |
| 6 | 矩形缓冲不可读：无整张缓冲硬切进圆、无沿 64/42 画线、缓冲外填同色雾 | **符合**（代码路径；肉眼岛边待人） | `drawFrame` 不按 `mapWidth`/`mapHeight` 描边。缓冲外 `continue`，像素留 `#080a0c`，与未探索/虚空同色（视觉通行证第 4 节）。无沿 64 或 42 的 `stroke`/`lineTo` |
| 7 | 深渊之眼仍在同一窗口（方 / 菱形、时限衰减闪），只画圆覆盖内 | **符合** | 同一 `Minimap` 实例：`showAbyssReveal` → `drawMarks` 在同一 `clip` 圆内。敌人 3×3 `#7fffee`；节点 3 像素菱形 `#1aad96`。`abyssDotAlpha`：时长内衰减到 0.30，最后 1000 毫秒按 180 毫秒开关闪。`windowCellCenter` 落在 25×25 外返回 `null` 不画 |
| 8 | 一个撤离竖缝，揭示后才出现，落在窗口外不画 | **符合** | 仅一个 `extractionTile`。`extractionDiscovered` 只在该格 `markExplored` 时置位。`drawExtractSlit` 2×7 `#b0fff5`；窗口外 `windowCellCenter` 为 `null` 不画 |
| 9 | 挂载 `#dom-ui-root`。禁止 `document.body` + `position:fixed`。禁止 Phaser `scrollFactor(0)` 角锚 | **符合** | `minimap.ts` `getDomUiRoot().appendChild(wrap)`，`id='rift-minimap'`。样式 `position: absolute`（`panel-styles.ts` `#rift-minimap`）。`rift-scene.ts` 无小地图 `scrollFactor`。`#dom-ui-root` 自身 `position:fixed` 是架构声明的 overlay 根，不是小地图挂 `document.body` |
| 10 | 圆边界皮：`#rift-minimap` 用 `clip-path`；无 1 像素 `#2a2d32`；无 `border-radius: 50%` 卡片；共享 `.device-plate` 未被改成圆（左上仍矩形） | **符合**（机械层；观感待人） | `#rift-minimap.device-plate`：`clip-path: circle(50% at 50% 50%)`，`border: none`，`border-radius: 0`，`box-shadow: none`。该选择器无 `#2a2d32`。共享 `.device-plate` 无 `clip-path`，`border-radius: 0`。左上 `#rift-hud-status.device-plate`（`rift-hud.ts`）仍矩形 |
| 11 | 净化点没有小地图 | **符合** | 全库仅 `rift-scene.ts` `new Minimap()`。`purification-scene.ts` 无 `Minimap` / `#rift-minimap` |
| 12 | 未改 `BUFFER_COLS` / `BUFFER_ROWS`、未改生成器缓冲尺寸 | **符合** | `src/config/constants.ts` 仍 `BUFFER_COLS: 64`、`BUFFER_ROWS: 42`。工作区对该文件无 diff。生成器仍读这两常量（`outline-mask.ts`） |

---

## 规则 30 / 30a–30k 与规则 25（对照摘要）

| 规则 | 判定 | 备注 |
| ---- | ---- | ---- |
| 30 元素清单：右下圆形局部窗口 | 符合 | 见表第 1、2、9 条 |
| 30a 跟随玩家局部窗口 | 符合 | 见表第 2 条 |
| 30b 直径 ＜ 较短边 42；不改缓冲藏边 | 符合 | 25 格；见表第 12 条 |
| 30c 已探索陆地/墙 + 未探索迷雾 | **符合** | 雾底色仍先铺；墙格可经四边外侧采样进入已探索，画出 `#4a4e55`（问题 1 已修复） |
| 30d 不可读 64×42 矩形 | 符合（代码路径） | 肉眼岛边待人试玩 |
| 30e / 规则 25 揭示 = 真实视野；场景累积；小地图不 import VisibilitySystem；不新增已见接口 | 符合 | `system-movement-vision.md` `interface-changed: false` 与实现一致 |
| 30f 朝向 | 符合 | `getFacing4()` |
| 30g 深渊之眼同一圆窗 | 符合 | 见表第 7 条 |
| 30h 一个撤离竖缝 | 符合 | 见表第 8 条 |
| 30i 挂载根 | 符合 | 见表第 9 条 |
| 30j 圆边界皮 | 机械符合 | 审美待人 |
| 30k 净化点无小地图；不改缓冲 | 符合 | 见表第 11、12 条 |

---

## U1–U12（本表面 = 裂隙小地图）

机械层可勾。**U2 / 审美 / 「像游戏」不代人 PASS。**

| 规则 | 机械层 | 说明 |
| ---- | ------ | ---- |
| U1 载体 + 挂载根 | **证据成立** | 规格载体 A（随身罩第二块方位读数）。挂 `#dom-ui-root`。非 `document.body` + `fixed` 角锚。非 Phaser `scrollFactor(0)`。载体「像装置」的观感待人 |
| U2 无后台管理气味 | **机械层已扫；不代勾 PASS** | 无圆角卡片（`border-radius: 0`）、无投影、无渐变按钮、无 1 像素 `#2a2d32` 雷达细框、圆来自 `clip-path` 不是 `border-radius: 50%`。过机械扫 ≠ 好看 ≠ 像游戏。人终审 |
| U3 色彩合规 | **证据成立** | 雾/虚空 `#080a0c`、地 `#151a1e`、墙 `#4a4e55`、玩家 `#c4873a`、撤离 `#b0fff5`、敌 `#7fffee`、节点 `#1aad96` 均在 `docs/art/palette.json`。玻璃底 `rgba(15, 17, 20, 0.72)` 沿用已锁随身罩，非本热修新色相 |
| U4 排版合规 | **本表面不适用（无字）** | 小地图无字号。未自造玩家可见字号档 |
| U5 术语合规 | **本表面无新可见词** | 画布无「提交/确认」等软件词 |
| U6 不遮挡 | **机械成立** | `right: 12px; bottom: 12px`，画布 75 像素，不占画面中心。是否挡战场观感待人 |
| U7 输入一致 | **证据成立** | 常驻、无按键、无悬停才显示雾或标记 |
| U8 状态语义 | **机械成立** | 已探索 / 未探索迷雾 / 深渊之眼生效中。本表面无「只变灰」的不可用项 |
| U9 可读性 | **机械成立（形状编码）** | 十字+短臂 / 竖缝 / 方 / 菱形四种形状，不靠同形只靠色。75 像素上是否够认待人截图。本表面无表名粘句 |
| U10 反馈不静默 | **机械成立** | 视野查询与小地图同一 `POST_UPDATE`；揭示格当帧可画上。未实机测 400 毫秒观感 |
| U11 一致性 | **机械成立；「同一台设备」待人** | 与左上同 `.device-plate` 族（同底、同暗扫描、无金属线）；圆只写在 `#rift-minimap`。Kit `ui-art-overhaul.md` A5-14 已改写为 25 格圆窗，与实现未冲突 |
| U12 参考锚点 | **规格有锚；并排不违和待人** | 规则 30 与视觉通行证第 4 节写明 Signalis / FTL / Darkest Dungeon（学动作、不学皮）。产出是否与参考并排不违和 **不能从代码勾** |

---

## 画完自检 1–8（验收要证据，不代审美）

| # | 证据 |
| - | ---- |
| 1 载体 / 挂载 | 载体 A。`#rift-minimap.device-plate` → `getDomUiRoot()` → `#dom-ui-root`。不钉世界坐标。无小地图 `scrollFactor(0)` |
| 2 具名参考 / 不像哪三类 | 规格已写三款参考。本屏不像：战术 Dashboard 鹰眼全图、通用雷达细框、设置页缩略图。实现是否像 = 人终审 |
| 3 P0 ≤ 6 | 圆内地形剪影、圆内迷雾、带朝向十字、覆盖内撤离竖缝。深渊方/菱形为 P2，接到同一圆。无字 |
| 4 哪台机器 | 规格：裂隙随身罩上嵌的圆玻璃观察窗。凹槽 = 径向 `#080a0c`；暗扫描 = 共享 `::after` 竖直暗线。无投影、无 1 像素 `#2a2d32`。观感待人 |
| 5 不可用写出缺口 | 本表面无不可用项 |
| 6 灰度 / 分开 | 四种形状编码。雾与虚空同色（故意，防读缓冲直角）。墙进入已探索后画 `#4a4e55`，灰度后仍靠明度差与地板分开 |
| 7 打开 / 阻断 | 踏入裂隙后右下常驻。不居中、不阻断、无按键打开 |
| 8 可见词 / 键盘 | 无新可见词。无键盘操作。不依赖悬停 |

机械层已扫。审美待人终审。不写好看 / 像游戏 / PASS。

---

## 发现的问题

| ID | 类型 | 严重度 | 描述 | 位置 | Spec 依据 |
| -- | ---- | ------ | ---- | ---- | --------- |
| 1 | Bug | Medium | **已修复（2026-08-19 复扫）。** 原路径只查格心：墙不透明，`hasLineOfSight` 在墙面命中，格心恒为 0，墙永不 `markExplored`。现路径：格心可见则记；否则再查四条边外侧——`(left-1, midY)`、`(left+tileSize, midY)`、`(midX, top-1)`、`(midX, top+tileSize)`，即邻格上贴着墙面的 1 像素。该点可过视线；`getVisibilityAt > 0` 则 `markExplored` 该墙格。`drawFrame` 对已探索 `TileType.WALL` 仍画 `EXPLORED_WALL = '#4a4e55'`。采样仍走既有 `getVisibilityAt`，场景层 `isMinimapSampleVisible`，未 import VisibilitySystem，未扩接口。墙内点仍无法点亮（不透明内部），这是预期：只有能看见的墙面才亮。未实机截图。 | `rift-scene.ts` `syncMinimapExploration` / `isMinimapSampleVisible`；`minimap.ts` `drawFrame` | 规则 30c；视觉通行证第 4 节「已探索墙 `#4a4e55`」 |
| 2 | 风险 | Low | 未做浏览器实机。岛边是否仍能读出矩形缓冲直角、圆窗是否像雷达，只能代码路径排除硬切/缩放/描边，不能代替肉眼。 | — | 规则 30d、30j；U2 / U12 人终审 |
| 3 | 风险 | Low | `syncMinimapExploration` 用未缩放的 `RADIUS_FORWARD` 做扫描包围盒，再用 `getVisibilityAt` 过滤。当前混乱值只缩小射程，不会漏扫。若将来出现大于 1 的半径倍率，包围盒可能小于真实视野。不是本热修回归。 | `rift-scene.ts` 扫描 `range` | 规则 25 / 30e |
| 4 | 风险 | Low | 四边外侧采样对**所有格**生效（不只墙）。视野边界上，邻格已可见时，本格中心不可见也可能被带亮（采样点落在邻格，严格说不是「该格上一点」）。最多多亮贴边的一格，不是墙永不亮的回归。不升为确定偏差。 | `syncMinimapExploration` 五个采样点的或 | 规则 25 / 30e「该格上一点」 |

无阻断（`tsc` 退出码 0）。确定偏差：**无**。

---

## 通过的检查

- 画布 75×75、窗口 25 格、跟随玩家格对齐原点，不是 192×126 全缓冲。**复扫未回退。**
- 已探索集合由场景在 `visibility.update` 之后用 `getVisibilityAt > 0` 累积；小地图不 import VisibilitySystem，不用 `RADIUS_AMBIENT` 近似圆；未新增「已见格子」接口。**复扫未回退。** 墙格补四边外侧采样，仍是同一查询。
- 玩家十字 + 四向短臂，朝向来自 `getFacing4()`；站住保持上一帧朝向。**复扫未回退。**
- 深渊之眼方/菱形、衰减与最后一秒闪，只画窗口内。
- 一个撤离竖缝，该格被真实视野点亮后才画，窗外不画。
- 挂 `#dom-ui-root`；`#rift-minimap` 为 `position:absolute` + `clip-path` 圆；共享 `.device-plate` 仍矩形。**复扫未回退。**
- 净化点无小地图。`BUFFER_COLS` / `BUFFER_ROWS` 仍为 64 / 42。
- `npx tsc --noEmit` 退出码 0（复扫再跑一次）。

---

## 建议（修复顺序）

1. **人终审**：圆窗是否像裂隙随身罩而不是雷达；岛边是否读得出矩形；U2 / 「像游戏」。准备逻辑分辨率截图（能加灰度更好）。试玩时可顺眼看已见墙是否出现金属灰 `#4a4e55`（问题 1 代码路径已闭合，截图作肉眼确认即可）。
2. 不要为此改生成器缓冲尺寸，不要标 Slice COMPLETE。问题 1 不必再开一轮 code，除非试玩证明墙仍不亮。

---

## 必须人拍板的项

- **U2 / 审美 / 「像游戏」**：机械层已扫（无圆角卡片、无投影、无 1 像素 `#2a2d32` 细框、圆来自裁切）。**不代勾 PASS。** 人否决即本热修 UI 不合格。
- **U12**：规格有三款参考；与参考并排是否不违和只能人看。
- **规则 30d 岛边矩形是否可读**：代码路径没有硬切/缩放/描边；肉眼结论归人。
- 问题 1 **不再需要人拍设计**：静态路径已闭合。若试玩墙仍不亮，交回 code，不要先改规格。

本报告路径：`docs/qa/report-rift-minimap-circular.md`。
