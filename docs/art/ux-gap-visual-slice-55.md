---
status: SPEC
created-by: art agent
created-date: 2026-08-15
slice: 5.5
note: |
  四处小缺口里的视觉最短核：大屏分区不滚丢 P1、提示条不叠、裂隙生效中行同族装置。
  不写 src/**。不是 Kit 锁定、不是审美终审、不把 Slice 标 COMPLETE。
---

# Slice 5.5 缺口视觉核（分区 / 提示条 / 生效行）

对照：`docs/art/ux-visual-pass-slice-55.md`（凹槽 / `.device-plate`）、`docs/design-notes/ui-art-overhaul.md`、`docs/art/demos/menu-crt-_layout.md`、`src/ui/dom/panel-styles.ts`。

**本文件是施工规格，不是已通过的审美。** 落地后等人看一帧。人否决即不合格。

## 闸门（最短，不重做皮）

| 表面 | 载体 | 理由 |
| ---- | ---- | ---- |
| 净化点大屏分区（S3–S8 机身） | **B 世界内终端** | 仍是嵌墙磷光屏；只改屏内一列谁固定、谁滚 |
| 提示条排队（Channel B） | **A 世界内装置** | 设备打出的一行事件字，不是软件横幅窗 |
| 拾取 `+N`（不进队列） | **A 世界内装置** | 贴薪柴读数的局部短闪 |
| 裂隙生效中行 | **A 世界内装置** | 已在左上 `.device-plate` 内，与完整度/混乱同一块罩 |

挂载：一律 `#dom-ui-root`。机身仍 `.game-panel` **680×468**、`top:52px; left:140px`。暂停 320 / 裂隙结算 360 不吃本文件的分区类。裂隙读数仍 `.device-plate`，`left:12px; top:12px`。

参考（与视觉通行证同一套，不另起）：

| 游戏 | 学的动作 | 明确不学 |
| ---- | -------- | -------- |
| Signalis | 信息是设备读出来的；分区是同一块屏上的固定读出面 | 曲面畸变、家用圆角电视 |
| FTL | 名和量贴在边上；一块槽就是一件东西，不跟列表一起卷走 | 全息蓝、圆形供电格、雷达圆点 |
| Barotrauma | 装置自己报剩余时间；键/读数印在同一台机器上 | 仿真指针、进度环、整屏仪表 |

本批明确不像：网页「上栏固定、中栏滚动」的后台表；堆叠的系统通知抽屉；带进度条的 Buff 条。

P0 / P1（本批只动落点，不删字段）：

- 墙机：槽区 / 身份 / 投入 / 属性 = P1，打开后零操作可见，**不准进滚动**。库存 = 可裁切。检视 L1–L5 = 固定下区。底键行固定。
- 裂隙：生效中 = 左上板内一行（名 + 秒）。拾取 `+N` 贴薪柴。Channel B 最多两行，不压左上板。
- 玩家在这三处要回答的：槽还在不在、刚才那条提示是哪两条、这件工具还剩几秒。

哪台机器：墙机 = 嵌墙磷光屏（凹槽暗边已落地，本批不改壳）。裂隙 = 同一族更薄的 `.device-plate`。提示条 = 同一套 Courier 字打在画布上，不加第三块玻璃。

复用：`.game-panel` / `.scroll-area` / `.inspect-dock` / `.key-hint-bar` / `.toast-inline` / `.device-plate`。本批只**新增一个共享类** `.crt-stack`。禁止新色、禁止灰金属外框、禁止圆角/投影、禁止改 680×468、禁止给提示条或生效行套第二块 `.device-plate` / `.game-panel`。

---

## 1. 大屏分区 — 新类 `.crt-stack`

### 约束

- 机身 class 仍是 `game-panel`。六块净化点墙机（分配 / 供奉 / 踏入 / 存续 / 蜕变 / 冲击）**额外**加 `crt-stack`。
- 暂停 / 裂隙结算 **不加** `crt-stack`（仍 320 / 360 居中小读出）。
- 一列竖排。固定区 `flex: 0 0 auto`。**只有库存**走已有 `.scroll-area`（继续 `scrollbar-width: none` + `::-webkit-scrollbar { display: none }`）。
- `.inspect-dock` 是滚动区的**下一个兄弟**，在下面，高度不随库存条数变。
- 不要第二套色、不要给 `.crt-stack` 画边框、不要改凹槽 8px / 扫描 / `padding: 14px 16px 4px`。

### CSS（进 `panel-styles.ts`）

`.game-panel` 已是 `display:flex; flex-direction:column; overflow:hidden; height:468px`。`.crt-stack` 只锁子项谁可缩：

```css
.game-panel.crt-stack > *:not(.scroll-area) {
  flex: 0 0 auto;
}
.game-panel.crt-stack > .scroll-area {
  flex: 1 1 auto;
  min-height: 0;
}
```

`.scroll-area` 其余保持现状：`overflow-y: auto`；顶/底 `1px solid #2a2d32`（已有分隔语言，不是新外框）；藏原生条。

`.inspect-dock` 保持已有：`border: none`；`border-top: 1px solid #2a2d32`；`padding: 6px 0 4px`；`flex: 0 0 auto`；字 13px `#8a8f96`。**`min-height` 从 88px 改为 `110px`**（落在合同 88–110、对齐 CRT 下区 ~110 / 5–6 行）。不要 max-height、不要随库存把这 110 让出去。

`.key-hint-bar` 已是 `flex: 0 0 auto`，保持。

### DOM 顺序（直接子节点；上→下）

**S4 供奉 / S5 踏入 / S6 存续**（有库存 + 检视）：

```
.game-panel.crt-stack
  .panel-title
  [固定 P1：槽网格 / 出击属性 / 残留 / 两模块 / 属性行 —— 不进 .scroll-area]
  .scroll-area          ← 仅库存行
  .inspect-dock         ← min-height:110px
  .key-hint-bar
```

**S3 分配 / S7 蜕变 / S8 冲击**：无库存列表。不要为了「有滚动类」把 P1 塞进 `.scroll-area`。整列都是固定区；没有库存就不挂 `.scroll-area`。有检视的才挂 `.inspect-dock`（这三块合同无固定检视则不要新造一块）。

S5 固定 P1 含：四列槽、出击三项（完整度 / 混乱增速 / 薪柴值）、既有残留。库存才进 `.scroll-area`。库存多时裁切 + ↑↓，**摘要 / 残留 / 三项 / 检视高度都不让**。

S6 固定 P1 含：上区两模块、中区属性（完整度 / 混乱增速 / 薪柴值 / 潮汐三节点 / 稳定度三节点，无条）。库存进 `.scroll-area`。

### 禁止

- 槽区、完整度条、投入、机会成本、检视、底键进滚动。
- 新色、新字号档、给分区加 1px `#2a2d32` 外框（机身外沿仍无框）。
- 把 `.crt-stack` 做成第二套面板皮（无自己的 background / padding / 扫描）。

---

## 2. 提示条排队 — 仍 `.toast-inline`

### 约束

- 类名仍 `.toast-inline`。动画仍现有 `@keyframes toast-inline-fade`（0% 1 → 70% 1 → 100% 0）。不要滑入、不要弹跳、不要新 keyframes。
- Channel B **最多同时 2 条**。第二条在第一条**下方**，逻辑画布间距 **4px**。第三条等空位，禁止三张叠在同一坐标。
- 挂 `#dom-ui-root`。不要 `document.body`。
- **拾取 `+N`** 仍贴薪柴：`top:12px; right:70px`，色 `#c4873a`，13px，800ms。**不进双条队列。**
- 被动槽短闪（已有 `left:12px; bottom:30px`，800ms）同属贴源短闪，**不进双条队列。**
- `.toast-stamp` 不动。稳定度里程碑现有居中条不改皮、不塞进这双条（另一通道）。

### 队列锚（逻辑 960×640）

看不见的宿主，无背景、无边框、无扫描：

```css
#toast-inline-queue {
  position: absolute;
  top: 40px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  pointer-events: none;
  z-index: 1500;
}
```

`top:40px` = 现净化点 Channel B 锚，避开贴顶三槽（`top:10px`）和裂隙左上板（`left:12px`）。不要改成贴左上（会压完整度/混乱）。

队列里的 `.toast-inline`：`position: static`（或相对，不要各自 `fixed` 抢同一 `top`）。字仍 `12px 'Courier New', monospace`，色默认 `#c8cdd4`，`text-shadow: 0 0 2px rgba(0,0,0,0.8)`。调用方已有的底 `rgba(15,17,20,0.92)` 可留——本批不新做横幅，也不单为排队加框。

空位补位：第一条撤掉后，第二条**立刻**占第一槽（改 `gap` 流式即可）。不要新的上滑 tween。

### 禁止

- 第三条叠在前两条上。
- 给队列宿主套 `.device-plate` / `.game-panel` / 1px `#2a2d32`。
- 把拾取 `+N` 送进居中双条。
- 新动画语言、新色相。

---

## 3. 裂隙生效中行 — 仍在 `#rift-hud-status.device-plate` 内

### 约束

- 不要第二块板、不要图标、不要进度条、不要 teal 扫描（板的暗扫描已由 `.device-plate::after` 提供）。
- 已有结构：生命行 → 混乱簇 → `effectsEl`。保持这个顺序。无生效时容器空，**不留空白占位行**。
- 每一条 = **同一行两个节点**（flex，`align-items: baseline`，`gap: 8px`）。
  - 工具名（或效果身份字）：**12px** `#8a8f96`
  - 秒数：**13px** `#c8cdd4`，文案 `Ns`（如 `5s`），不要括号、不要 `·` 粘成一句
- 无倒计时的整趟效果：只出名字节点，不要编一秒数。
- `text-shadow: 0 0 2px rgba(0,0,0,0.8)` 与板上完整度/混乱相同（可读性暗晕）。
- 多条：板内再往下排，行距 **2px**（与板 `gap:2px` 同一档）。不要把生效行滚出板外。

### CSS（挂在已有 `.device-plate` 下，进 `panel-styles.ts`）

```css
.device-plate .device-effect {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: 8px;
}
.device-plate .device-effect-name {
  font-size: 12px;
  color: #8a8f96;
  text-shadow: 0 0 2px rgba(0, 0, 0, 0.8);
}
.device-plate .device-effect-time {
  font-size: 13px;
  color: #c8cdd4;
  text-shadow: 0 0 2px rgba(0, 0, 0, 0.8);
}
```

与板上「完整度 12px `#8a8f96` / 数值 13px `#c8cdd4`」同一档，不是新字号、不是新色。

混乱增速若出现在此行：身份字走名字节点（表名+增减% 由文案批分节点；本规格只锁 12/13 两色）。时长只进秒数节点。

### 禁止

- 条、环、pip、图标字体、emoji。
- 秒数用 `#5a5f66` 或 `<12px`。
- 把生效行挪到板外或做成 toast。

---

## 4. code 施工条

1. `panel-styles.ts`：加上节 1 的 `.crt-stack` 两段；`.inspect-dock` 的 `min-height` → `110px`。
2. `panel-styles.ts`：加上节 3 的 `.device-effect*`。
3. `panel-styles.ts`：加上节 2 的 `#toast-inline-queue`；Channel B 的 `showToastInline` 进该宿主，同时最多 2 个 `.toast-inline`；第 3 条等空位。拾取 / 被动短闪走现有坐标，不进宿主。
4. 六块墙机根节点：`game-panel crt-stack`。S4/S5/S6 DOM 按节 1 重排（槽等 P1 提出 `.scroll-area`）。S3/S7/S8 有 `.scroll-area` 且里面是 P1 → 拆掉滚动包裹。
5. `rift-hud.ts`：`effectsEl` 每行两个 span（`.device-effect-name` / `.device-effect-time`），去掉整段 12px 同色。
6. **不要动**：680×468、凹槽 8px、小窗 5px 凹槽、`.device-plate` 玻璃/暗扫描、小地图、主菜单底、六块面板内部组件皮、玩法数值。

落地后给人看：供奉库存很多时一帧（槽 + 检视仍在）、裂隙两条 Channel B 一帧（第二条在下 4px）、裂隙左上生效行一帧（名 12 / 秒 13）。**机械层已扫；审美待人终审。**

---

## 写完自检（skill 1–8）

1. **载体？挂载根？** B = 六块墙机，已挂 `#dom-ui-root`，`.crt-stack` 不改挂载。A = 提示条队列与拾取短闪、裂隙生效行，挂 `#dom-ui-root` / `#rift-hud-status`。角锚不绑 camera zoom。队列宿主 `position:absolute`，不挂 `body`。
2. **具名参考？不像哪三类？** Signalis：设备读出；不学曲面。FTL：槽不跟列表卷走；不学供电格。Barotrauma：装置报剩余秒；不学指针/进度环。本批不像：后台固定顶栏、系统通知抽屉、Buff 进度条。
3. **P0（≤6）？不操作能否读出身份+数值？** 墙机打开后 P1 槽/身份/检视不进滚动。裂隙生效行：名字节点 + 秒数节点。拾取不占 P0。Channel B 非常驻。本批不删玩法行。
4. **哪台机器？投影/发光/圆角/脉动的物理原因？** 墙机仍是嵌墙磷光屏；分区是同一块玻璃上的固定读出面 vs 可滚库存。随身罩仍是 `.device-plate`。提示条是字，不是第三块屏。本批不加投影/圆角/外框。没有用「好看」当原因的条目。
5. **不可用是否写出缺口？** 本批不改选项不可用态。空检视仍走已有 `.inspect-empty`。无倒计时则不加假秒数。
6. **灰度后？表名数值档位分开？** 槽靠位置固定；检视靠下区 110px。生效行：左名字、右 `Ns`，字号 12 vs 13。两条提示靠上下位置分，不靠新色。禁止名和秒粘成一句。
7. **怎么打开？阻断是否超过 1？** 墙机仍 E / Tab / 归来。提示条不打断。生效行常驻于板内。本批不新增阻断、不改 680×468。
8. **可见词？键盘？** 秒数 `Ns`。拾取仍 `+N`。术语（完整度/混乱/薪柴/工具名）不在本批改写。键盘切区/滚动已有；提示键不改绑定。

机械层已扫（无新圆角、无投影、无灰金属外框加回、无新色相、字号 12/13、原生条仍藏）。不许写好看 / 像游戏 / PASS。审美待人终审。Slice 5.5 不因本文件标 COMPLETE。
