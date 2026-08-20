---
status: ACTIVE
purpose: 开发练习场（gym）的 Agent 入口。人要看敌人怎么走、agent 要加一种演示，都先读本文。
---

# 开发练习场

独立 HTML，用来体验和测试**与出击同一套代码**的基本功能。不是裂隙关卡，不进主菜单。

**打开：** `npm run gym` 或 `npm run dev`，再用 Cursor 的 Simple Browser 打开对应地址。不要用系统浏览器。

| 课 | 地址 |
| -- | -- |
| 敌人移动 | `http://localhost:3000/gym.html` |
| 玩家外形 | `http://localhost:3000/gym.html?lesson=player` |

**代码：** `gym.html` → `src/gym/main.ts` → `GymBootScene` → `GymScene` 或 `GymPlayerScene`。场地：`src/gym/arena.ts`。

---

## Agent 入口（加演示 / 修练习场）

1. 先读本文，再改 `src/gym/**`。不要在 `RiftScene` 里塞调试房间。
2. **禁止**为练习场另写敌人移动、另画一套敌人外形、用 DOM/Canvas 2D 冒充巡逻。敌人画面就是出击那套程序像素。
3. 练习场必须调用正式模块：
   - 敌人课：`AISystem`（巡逻预计算腿 + `GridPathfinder` 8 邻接 A*）、`Enemy` / `createEnemyTypeConfig`（`enemy-factory.ts`）
   - 所有课：`generatePlaceholderTextures`（与 `BootScene` 同一份）、`gameConfigWithScenes`（与出击同一套 pixelArt / FIT / Arcade）
4. 新敌人角色（`data/enemies.csv` 新行）时：`npm run codegen`，然后给 `GYM_LOOPS` 补一条 8 点环。`Record<EnemyRole, …>` 会在漏补时编不过。`AISystem.create` 仍要求出生表里**恰好 1 个改写体**——练习场不要用两个改写体来「多演示一次皮肤」。
5. 练习场侧栏是开发说明，不是游戏内界面。不要走 in-game UX 清单，也不要把它做成墙机/随身罩。
6. 玩家外形：出击与练习场同一套（DEC-068）——方案 1 加厚像素 + 方案 3 灯尘。本课用假人绕圈对照体量，不接 WASD。贴图在 `player-sprite-dense.ts`；灯尘在 `player-lamp-aura.ts`。
7. **角色外形怎么验：** Cursor Simple Browser 打开上表地址，对照 `docs/art/actor-pixels.md`（朝向不转 GameObject、家族密度、压迫感、禁忌）。不要用系统浏览器。

---

## 当前课

### 敌人移动（默认）

封闭一圈墙的院子（18×12 格）。每种现行敌人一只，沿 8 个路点环巡逻。环的相邻点依次是东、东南、南、西南、西、西北、北、东北，逼寻路走出斜向，而不是只沿矩形边。

为了看清身体和朝向：视野回调恒为 1（出击里由玩家视锥决定）；玩家诱饵放在地图外，感知填不满，保持巡逻、不会追击。路点停留时间走 `WAYPOINT_PAUSE_MS`，与出击默认相同。相机缩放走 `CAMERA.ZOOM`（1.5）。

侧栏「已走过的朝向」按物理速度落入的 45° 扇区点亮，用来确认八向都走到了。青绿小方块是路点，只画在练习场里。

地面用占位地砖（出击里地砖层是隐的、改画程序化地表）。**敌人**与出击是同一套程序像素（DEC-066，不是待换的精灵表）：朝向、指示点、改写体残影、步态帧、青绿脱落尘、木偶步。渗透体画布 32×32（碰撞仍 20）。身体 GameObject 的 rotation 必须恒为 0；四向贴图必须直立（头在上）。走路应看到顿一步再突然迈（改写体青绿团会左右错一点，身体允许裂开）；路点转向应有短滞后剪影。练习场若检测到非零 rotation 会把顶栏写成错误。脱落尘从身体往外、往下飘，不是玩家灯尘；迈步那一拍会多爆几粒。改写体脚下有极淡青绿污斑。本课诱饵在场外，只看得到巡逻密度的尘。

### 玩家外形（`?lesson=player`）

院子里一个假人绕矩形走，角上短停。外形是方案 1：加厚工业像素（侧影加厚、配色略暖）+ 方案 3 留下的灯尘，**与出击 `Player` 同一套**（DEC-068）。北墙站住的渗透体与改写体是出击像素，只对照体量。这课没有键盘操作，也不把假人当 AI 诱饵。对照清单见 `docs/art/actor-pixels.md`。

---

## 以后加课

在 `GymScene` 旁加新场景，用 URL 查询串切换课（已有 `gym.html?lesson=player`）。新课同样必须复用正式系统。把课名写进本文件「当前课」。
