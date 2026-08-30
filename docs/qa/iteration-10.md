---
status: DRAFT
created-by: qa agent（迭代 10 I10-QA）
created-when: 2026-08-30
note: rift 拾取物读条与翻找机械对照。好看 / 读作游戏 / 听感 / 四碎片堆辨识度不代勾。画面与音效等人终审（合同波 6）。2026-08-30 追加「I10-HOTFIX-1 增量对照」（堆配色 v2 / DEC-110）；不重写既有节。不标 COMPLETE。
---

# QA：迭代 10（rift 拾取物读条与翻找，机械层）

日期：2026-08-30  
合同：`docs/tasks/iteration-10.md` Task I10-QA（DEC-108 / DEC-109）  
设计正文：`docs/design-notes/loot-search.md`  
规则：`docs/specs/system-chaos-scavenge-extract.md`（规则 14 / 14a / 14b / 15 / 16 / 17 / 18 / 30g 与 L 节；`interface-changed: false`）  
成长：`docs/specs/system-growth-tide.md`（CN8 / CN9；`interface-changed: false`）  
音频：`docs/specs/system-audio.md`（资产表四键 + 规则 G / H）  
代码：HEAD `ed76062` + 工作区 I10-FINAL。本报告核工作区磁盘。

**已交对照对象：** I10-D、I10-G、I10-C、I10-FINAL-S、I10-FINAL。  
**不许代勾：** 审美、读作游戏、听感（薪柴 vs 残渣可区分）、四张碎片下堆是否一眼可翻。画面等波 6 人终审。

---

## 闸门实测（工作区，2026-08-30）

| 命令 | 结果 |
| ---- | ---- |
| `npx tsc --noEmit` | 绿（exit 0，无输出） |
| `npm run check:contam-floor-contrast` | 绿。CIE76 四档 ≥ 18；地面青绿四张三年龄均为 0.00%；虚空青绿 0%；墙后可走四连通 = 1；`|{shape[id]}| == 4`；修前夹具会红 |
| `npm run check:layout` | 绿。8 种子墙后可走仍过（含户外 / 医院 / 地铁 / 旧图书馆） |
| `npm run codegen` | 绿。18 条污染物条目。跑后 `src/generated/contaminant-data.ts` 相对 HEAD 仅深渊之眼两行文案（与 CSV 改口一致）——**仅预期 diff** |
| `npm test` | N/A（`package.json` 无 `test` 脚本） |
| 未跑的 `check:*` | `check:lexicon` / `check:vision-energy` / `check:jia-*` / `check:gallery-catalog` 等与本批改动面（读条翻找 / 音频四键 / CSV 深渊文案）无共享产物，未列入本批闸门 |

`git diff src/config/constants.ts`：仅追加退役注释 + `SEARCH_*` 四字段；`NODE_COUNT` / `VALUE_*` / `CONTAMINANT.NODES_PER_MAP` / `RARITY_WEIGHTS` 行不在 diff 内。`docs/art/palette.json` 与 `src/generation/rift-layout.ts` 相对 HEAD **diff 为空**。

---

## 1. 机制数值

| # | 规格/合同引用 | 证据 | 结论 |
| - | ------------- | ---- | ---- |
| 1.1 | `SEARCH_CHANNEL_MS: 1200` | `constants.ts:73`；读条比较 `loot-search-system.ts:272` | **PASS** |
| 1.2 | `SEARCH_RADIUS: 48` | `constants.ts:74`；近者判定 `loot-search-system.ts:317–318`；与 `EXTRACTION.TRIGGER_RADIUS: 48` 同值（`constants.ts:81`） | **PASS** |
| 1.3 | `SEARCH_NOISE_RADIUS: 96` | `constants.ts:75`；`startChannel` 传入 `onNoise`（`loot-search-system.ts:370–373`） | **PASS** |
| 1.4 | `SEARCH_NOISE_LEVEL: 'suspicious'` | `constants.ts:76` `as const`；类型收窄为 `'suspicious'`（`loot-search-system.ts:43`） | **PASS** |
| 1.5 | 分档价值 1/2/4 未动 | `VALUE_SAFE/CONTESTED/DEEP` 仍 1/2/4；`git diff` 这三行不在变更集。生成器仍 3 safe + 3 contested + 2 deep（`rift-layout.ts:586–609`） | **PASS** |
| 1.6 | 稀有度权重 60/30/10 未动 | `CONTAMINANT.RARITY_WEIGHTS`（`constants.ts:507`）；`rollRarity` 读该对象（`loot-search-system.ts:93–99`） | **PASS** |
| 1.7 | 节点数量 8+3 未动 | `NODE_COUNT: 8`、`NODES_PER_MAP: 3` 不在 diff。布点硬编码仍 8 薪柴 + 3 污染物（`rift-layout.ts:586–620`，本批该文件 diff 为空） | **PASS** |

---

## 2. 打断规则全集

实现入口：`LootSearchSystem.update`（`loot-search-system.ts:248–290`）。读条中任一条件命中走 `interrupt()`（`389–396`）：清 `channel`、条熄、停 loop、播 interrupt。不调用 `player.setInputEnabled(false)`。

| # | 规则 | 证据 | 结论 |
| - | ---- | ---- | ---- |
| 2.1 | 松开 E → 清零 | `!input.searchHeld`（`263`）。出击 `searchHeld = extractKey.isDown`（`rift-scene.ts:407`） | **PASS** |
| 2.2 | 移动 → 清零 | `input.moving`（`264`）；出击 `this.player.isMoving()`（`rift-scene.ts:408`）。`player.update` 仍每帧跑，不锁移动 | **PASS** |
| 2.3 | 攻击 → 清零 | `input.attacking`（`265`）；出击 `attackKey.isDown`（`rift-scene.ts:409`）。空格仍走 `combat.requestPlayerAttack`（`369–371`），不锁攻击 | **PASS** |
| 2.4 | 主动工具键 Q/F/G → 清零 | `input.toolPressed`（`266`）；出击 `JustDown` 于 `SORTIE_ACTIVE_KEYS`（`rift-scene.ts:401–410, 423–427`） | **PASS** |
| 2.5 | 受击 → 清零 | `input.hitThisFrame`（`267`）；`PLAYER_DAMAGED` → `hitThisFrame = true`（`rift-scene.ts:601–603`），同帧 `combat.update` 之后、`search.update` 之前消费 | **PASS** |
| 2.6 | Esc 暂停 = 冻结保进度 | `LootSearchSystem` 在 `input.paused` 时只 `paintChannel` + `tickVisuals`、不累加 `elapsedMs`（`256–260`）。出击传入 `paused: false`（`rift-scene.ts:412`），实际冻结靠暂停菜单 `host.scene.pause()`（`pause-menu.ts:39`）停掉 `update`，`channel.elapsedMs` 保留；恢复后继续。失焦路径 `src/main.ts` 同样 `scene.pause()` | **PASS** |
| 2.7 | 不锁输入 | 出击 `update` 仍跑玩家移动 / 攻击 JustDown / 工具 useSlot。读条模块不调用 `setInputEnabled` | **PASS** |

练习场课攻击用 `JustDown` 而非 `isDown`（`gym-loot-card-scene.ts:95`），课内无战斗，不构成出击偏差。见问题清单 #2。

---

## 3. 发声（AI 噪声，非音效）

| # | 规则 | 证据 | 结论 |
| - | ---- | ---- | ---- |
| 3.1 | 读条开始一次 `reportNoise`(96px, suspicious) | 仅 `startChannel` 调 `onNoise?.(node.position, SEARCH_NOISE_RADIUS, SEARCH_NOISE_LEVEL)`（`loot-search-system.ts:368–374`）。出击 `onNoise: this.reportNoise` → `ai.reportNoise`（`rift-scene.ts:231, 711–717`） | **PASS** |
| 3.2 | 读条期间不持续发声 | `update` 通道分支无第二次 `onNoise` | **PASS** |
| 3.3 | 完成与打断不发噪声 | `interrupt()` / `complete()` 无 `onNoise`。完成只播揭晓 SFX；打断只播 interrupt SFX（音效 ≠ AI 噪声） | **PASS** |

---

## 4. 键位与上下文

| # | 规则 | 证据 | 结论 |
| - | ---- | ---- | ---- |
| 4.1 | E 按住 | 出击 `extractKey.isDown`（`rift-scene.ts:407`）；练习场 `keyE.isDown`（`gym-loot-card-scene.ts:96`）。开始条件含 `searchHeld` 且 `prompt === 'search'`（`loot-search-system.ts:278–289`） | **PASS** |
| 4.2 | 近者胜、同距撤离优先 | `refreshPrompt`：`extractDist <= nearestDist ? 'extract' : 'search'`（`loot-search-system.ts:357–358`）。`<=` = 同距撤离 | **PASS** |
| 4.3 | `[E] 撤离` / `[E] 翻找` 随上下文切换 | `LootSearchHud.setPrompt`：键印 `[E]` + `t('hud.prompt.extract'|'search')`（`loot-search-hud.ts:117–118`）。中文「撤离」/「翻找」（`zh-CN.ts:57–58`）。出击 `suppressExtractPrompt: true`（`rift-scene.ts:321`），旧撤离提示关闭（`rift-hud.ts:256–261`），同一时刻一条 | **PASS** |
| 4.4 | 撤离仍是边沿、翻找是按住 | `JustDown` 且 `getPrompt() === 'extract'` 才 `requestExtract`（`rift-scene.ts:440–448`）。按住 E 在翻找上下文不会边沿撤离 | **PASS** |

---

## 5. 可见性

| # | 规则 | 证据 | 结论 |
| - | ---- | ---- | ---- |
| 5.1 | 可见才能提示 | `searchOk` 要求 `getVisibilityAt(nearest.position) > 0`（`loot-search-system.ts:351–354`） | **PASS** |
| 5.2 | 可见才能开始 | `startChannel` 前再查 `vis > 0`（`288–289`） | **PASS** |
| 5.3 | 读条开始后视野变化不打断 | 打断集合无可见性条件（`261–268`）。`paused` / 松开 / 移动 / 攻击 / 工具 / 受击 / `runEnded` 才断 | **PASS** |
| 5.4 | 对象不是 glow source | `registerGlowSource` 仅撤离点（`rift-scene.ts:284`）。翻找模块无注册 | **PASS** |
| 5.5 | alpha 乘可见性 | `tickVisuals` → `setVisibility(vis)`（`306–312`）；`PileVisual.setVisibility` / `update` `setAlpha(vis)`（`loot-search-presentation.ts:216–232`）；碎屑与揭晓粒子同样乘 `this.vis`（`265, 302, 330`） | **PASS** |

---

## 6. 揭晓信息集与色谱

| # | 规则 | 证据 | 结论 |
| - | ---- | ---- | ---- |
| 6.1 | 薪柴 = 右上 +N 闪 | 生产路径 emit `KINDLING_COLLECTED`（`loot-search-system.ts:416`）→ `RiftHud.showPickupFlash`（`rift-hud.ts:201, 566`），色 `#c4873a`（warm-dim）。练习场 preview 走 `hud.flashKindling` | **PASS** |
| 6.2 | 残渣 = toast-inline + 稀有度星等、不给类型名 | `flashResidue(rarity)`：`t('hud.residue.label')` + `★/★★/★★★`（`loot-search-hud.ts:158–171`）。无 `type` / 工具名。`rollType` 只进 `contaminantSystem.acquire` | **PASS** |
| 6.3 | teal 谱 common 暗 / fine `#1aad96` / rare `#3cffd4` | HUD `RARITY_COLOR`（`loot-search-hud.ts:37–41`）与 `loadout-panel.ts` / `rift-result-panel.ts` / `defense-panel.ts` 的 `RARITY_COLORS` 同三值。世界内 `RARITY_TINT` common `0x8a8f96` / fine `0x1aad96` / rare `0x3cffd4`（`loot-search-presentation.ts:33–37`） | **PASS** |
| 6.4 | 禁紫谱 | `src/systems/` grep `0x4a6a64` / `0x7722aa` / purple / violet：无匹配。揭晓与堆体无紫色 hex | **PASS** |
| 6.5 | common 世界内 tint = `#8a8f96` | `RARITY_TINT.common: 0x8a8f96`（`loot-search-presentation.ts:34`） | **PASS** |

---

## 7. 事件契约

| # | 规则 | 证据 | 结论 |
| - | ---- | ---- | ---- |
| 7.1 | 无新增事件 | `src/types/events.ts` 无 `search:` / `loot.search` key。读条开始/进行/打断不进总线 | **PASS** |
| 7.2 | 完成 = 既有 `KINDLING_COLLECTED` / `CONTAMINANT_ACQUIRED` | 薪柴 `eventBus.emit(GameEvent.KINDLING_COLLECTED, { amount, total })`（`loot-search-system.ts:416`）。残渣 `contaminantSystem.acquire` → 内部 emit `CONTAMINANT_ACQUIRED`（`contaminant-system.ts:176`）。合同 Task 正文写 `CONTAMINANT_COLLECTED` 为笔误，以 spec 规则 15 为准 | **PASS** |
| 7.3 | spec `interface-changed: false` | 两份 spec frontmatter 均为 `false`（`system-chaos-scavenge-extract.md:8`、`system-growth-tide.md:6`）。实现未加 payload 字段 | **PASS** |

规格过期（不挡本项 PASS）：chaos spec `exposes` 仍写 `LootSystem.getCarriedKindling()`（见问题清单 #1）。

---

## 8. 触碰拾取下线

| # | 规则 | 证据 | 结论 |
| - | ---- | ---- | ---- |
| 8.1 | `loot-system.ts` / `contaminant-node-system.ts` 已删除 | `ls`：No such file | **PASS** |
| 8.2 | `RiftScene` 无旧 overlap 拾取 | grep `overlap` / `onOverlap` 于 `rift-scene.ts`：无拾取 overlap。仅注释里「pickup」与 `ITEM_COLLECTED` → 仍播 `sfx-shared-player-pickup`（物品，非薪柴） | **PASS** |
| 8.3 | `PICKUP_RADIUS` 退役注释 | `constants.ts:67–68`：「迭代 10 起退役，见 spec 规则 14」 | **PASS** |
| 8.4 | 无死引用 | `src/` grep `LootSystem` / `ContaminantNodeSystem` / `loot-system` / `contaminant-node-system`：生产代码无 import。`architecture.md` 登记 SUPERSEDED | **PASS** |

---

## 9. 卡 3 与 spike 分支下线

| # | 规则 | 证据 | 结论 |
| - | ---- | ---- | ---- |
| 9.1 | `loot-search-cards.ts` 已删除 | `ls`：No such file | **PASS** |
| 9.2 | `TEX_POD` / `bakePod` / `LootSearchCardId` / 数字键切卡无残留 | `src/**/*.ts` grep：无匹配。gym `bindKeys` 只绑 E / 攻击 / R / Q / F / G（`gym-loot-card-scene.ts:157–167`） | **PASS** |
| 9.3 | 生产路径无「卡」概念命名 | `src/systems/loot-search-system.ts` / `loot-search-presentation.ts` / `loot-search-hud.ts` 无 CardId / 切卡。课 URL `loot-card` 与 `GymLootCardScene` 按合同保留至人终审后删课 | **PASS** |

---

## 10. 音效四键

| # | 规则 | 证据 | 结论 |
| - | ---- | ---- | ---- |
| 10.1 | catalog 注册四键 | `audio-catalog.ts:48–51`：loop / interrupt / reveal-kindling / reveal-residue；loop 的 `loop: true` | **PASS** |
| 10.2 | 非空双格式 size > 0 | `assets/` 与 `public/assets/` 各 8 个文件。最小 interrupt.mp3 = 3804 B；loop.mp3 = 20105 B。全部 > 0 | **PASS** |
| 10.3 | `generate.mjs` KEYS = 43 | `KEYS.length === 43` 断言（`generate.mjs:81`）；实数 43；四键在 `57–60` | **PASS** |
| 10.4 | `system-audio.md` 资产表已追加 | 表行 350–353 + 规则 42 接线（`system-audio.md:232, 350–353`） | **PASS** |
| 10.5 | 接线时机 | 开始：`playSFX(loop, { loop:true, instanceId:'loot-search-loop' })`（`loot-search-system.ts:375–378`）。打断：`stopLoop` + interrupt（`389–396, 428–431`）。完成：`stopLoop` 后按 kind 播 reveal-kindling / reveal-residue（`404–422`）。`KINDLING_COLLECTED` 不再走 pickup（`rift-scene.ts:549` 只听 `ITEM_COLLECTED`）。与 DEC-109 旁注「pickup 不改作揭晓·薪柴」一致 | **PASS** |
| 10.6 | 规则 G（循环键 fade-in） | 循环键配方 `afade=t=in:d=0.025`（`generate.mjs:396`）。运行时 `playSFX` 对 loop 不另套 `fadeGain` 渐入（初始 1，`audio-manager.ts:259`）。资产层有起音渐入；字面「0–30ms 内 ≤ 峰值 90%」见问题清单 #3，不抬成阻断（与 Slice 9 既有 player 短音 8–20ms fade 同级）。听感终审归人 | **PASS**（机械：有 fade-in 配方） |
| 10.7 | 不超 8 轨接线分析 | 循环键是 `group: SFX`、非 bed（`isBedKey` 只认 BGM/Ambient），占 5–8 中一条且 **kickable**。读条时玩家停步 → 无脚步。最满：BGM + Tension/氛围 + Threat + Proximity + 改写 hum + 渗透 idle + search-loop = 7，再加一条短音到 8。溢出按既有规则踢 kickable，不新增不可踢床。打断：80ms 淡出 loop + interrupt 短音短暂两槽。完成：loop 已停再播 reveal。接线不把上限改成 9 | **PASS** |

---

## 11. 深渊之眼

| # | 规则 | 证据 | 结论 |
| - | ---- | ---- | ---- |
| 11.1 | `getUncollectedSearchPositions()` 取代薪柴-only | `LootSearchSystem.getUncollectedSearchPositions` 遍历全部未拾取节点（`loot-search-system.ts:224–229`）。出击 `getKindlingPositions: () => this.search.getUncollectedSearchPositions()`（`rift-scene.ts:264`） | **PASS** |
| 11.2 | 同一菱形不区分类型 | `minimap.showAbyssReveal(enemies, nodes)`；`drawNodeDiamond` 单一 `ABYSS_NODE_COLOR = '#1aad96'`（`minimap.ts:33, 151–157, 274–296`）。无 kind 分支 | **PASS** |
| 11.3 | CSV 改口 + codegen 一致 | `data/contaminants.csv` abyss：`所有敌人与可翻找物` / `不区分内容物`。`contaminant-data.ts:358–359` 同文。codegen 后再 diff 仅此预期两行 | **PASS** |

---

## 12. 不挡路 / 连通

| # | 规则 | 证据 | 结论 |
| - | ---- | ---- | ---- |
| 12.1 | 无碰撞体、不写 walls | 堆是 `scene.add.image`（`loot-search-presentation.ts:194`），无 `physics.add`。grep `walls` 于 presentation：无 | **PASS** |
| 12.2 | 连通 FATAL 未破 | 本批 `rift-layout.ts` diff 为空。`check:layout` 8 种子墙后可走仍过；`check:contam-floor-contrast` 墙后可走四连通 = 1 | **PASS** |

---

## 13. 随图配色

| # | 规则 | 证据 | 结论 |
| - | ---- | ---- | ---- |
| 13.1 | 堆色从 `fragmentTypeId` 配方推导 | `derivePileSlots`：`wallSim = wallBv × wallBiasRGB` → `temperatureGroup` → `quantizeInGroup`（L1 池）；渍缝 `stainKey` 同格则回退 `earth-dark`（`loot-search-presentation.ts:87–107`）。`namedHex` 断言属于 `palette.json`（`134–139`） | **PASS** |
| 13.2 | 无写死单一堆色 | 四碎片走 `paintOutdoor/Clinic/Metro/Library`（`387–397`），色槽来自 `slots` 而非常量堆色 | **PASS** |
| 13.3 | 无合同点名色板外 hex | grep `0x4a6a64` / `0x5a5248` / `0x2a2e32` / `0x3a3a36` / `0x4a4840` / `0x2a2a26` / `0x3a3830` 于 `src/systems`：无匹配。晶簇/光团 `0x2ae6c8` / `0x0e4a3f` 已在 `palette.json` | **PASS** |
| 13.4 | `palette.json` 未新增色 | `git diff docs/art/palette.json` 为空 | **PASS** |

---

## 14. gym 课

| # | 规则 | 证据 | 结论 |
| - | ---- | ---- | ---- |
| 14.1 | `?lesson=loot-card` 单组合；切卡下线；R 换种子保留 | `gym-lesson.ts` 仍解析 `loot-card`。`bindKeys` 无 Digit。R → `queueRebuild`（`gym-loot-card-scene.ts:90–92`）。侧栏无 1/2/3 按钮，仅种子 +「换种子并生成」（`gym.html:471–478`） | **PASS** |
| 14.2 | gym.html 侧栏 / 规则块同步 | nav「翻找」；`gym-rules-loot-card` 写单组合 + 切卡下线 + 人终审后删课（`gym.html:336, 528–533`） | **PASS** |
| 14.3 | `docs/dev/gym.md` 同步 | 课表第 12 条与「翻找」节：单组合、切卡下线、R 换种子、人终审后删 | **PASS** |
| 14.4 | 课未删除 | `GymLootCardScene` 仍注册于 `main.ts` / `gym-boot-scene.ts` | **PASS** |
| 14.5 | 不为练习场另写一套机制 | 课 `LootSearchSystem.create`（`gym-loot-card-scene.ts:251`）。`RiftScene` 不 import `src/gym/**` | **PASS** |
| 14.6 | 课内不刷敌人 | 课文件无 `AISystem` / enemy spawn | **PASS** |

---

## 15. 性能

| # | 规则 | 证据 | 结论 |
| - | ---- | ---- | ---- |
| 15.1 | 纹理预生成 | `ensureLootSearchTextures` 每碎片 3 变体 + crystal/mote/chip 各 bake 一次（`loot-search-presentation.ts:110–119`）。`textures.exists` 守卫 | **PASS** |
| 15.2 | 对象池 | `CHIP_POOL = 2`、`REVEAL_POOL = 6`（`26–27, 198–213`）。碎屑/揭晓复用 Image，不每事件 `add.image` | **PASS** |
| 15.3 | 无新增每帧 ImageData | `loot-search-*` 无 `ImageData` / `getImageData`。堆每帧只 `setAlpha` / `setX`。Tween 只在碎屑事件与揭晓时创建 | **PASS** |

---

## 16. 合同红线 + DEC-109 逐条

「不做什么」里 **出击生产默认不动 / 本波不动 CSV** 是 I10-G 波红线，已被 DEC-109 第 5 点与 I10-FINAL Brief 授权翻生产、改 CSV。对照以拍板后的现行红线为准。

| # | 红线 / 决策 | 结论 | 证据 |
| - | ----------- | ---- | ---- |
| 16.1 | DEC-109.1 选中组合 = 翻堆外观 + 底部装置条；卡 3 删除 | **PASS** | presentation 只有 `PileVisual`；HUD `#loot-search-channel.device-plate`；无破壳分支 |
| 16.2 | DEC-109.2 碎弧进度语义移除；进度唯一通道 = 底部条；堆微动不编码进度 | **PASS** | presentation 无碎弧、无 `progress01`。抖动用种子 `hz`/`phase`（`233–239`），不读 `elapsedMs` |
| 16.3 | DEC-109.3 音效四键占位流程 | **PASS** | 见第 10 节。pickup 留作 `ITEM_COLLECTED`（DEC-109 旁注） |
| 16.4 | DEC-109.4 堆辨识度 + 随图配色（不泄露、不贴图标） | **PASS**（机械） | 无 UI 图标贴脸；配色见第 13 节。辨识度是否「一眼可翻」不代勾 |
| 16.5 | DEC-109.5 翻生产；课改单组合；人终审前不删课；不标 COMPLETE | **PASS** | `RiftScene` 已接线；课仍在；合同 `status: ACTIVE`；本报告不标 COMPLETE |
| 16.6 | 三卡机制一致 | **N/A** | 生产只留一组合，无第二套机制分支 |
| 16.7 | 不拆连通 / 不挡路 | **PASS** | 见第 12 节 |
| 16.8 | 不泄露内容物 / 非 glow / 禁紫 / alpha×可见性 | **PASS** | 见第 5–6、13 节。`createSearchObjectVisual` 不接收 kind/tier |
| 16.9 | 读条 UI 必经 in-game-ux；挂调用方 DOM 根；`t()` | **PASS**（机械） | HUD 文件头书面闸门；出击 `getDomUiRoot()`；课 overlay 挂在 `getDomUiRoot()` 下（`gym-loot-card-scene.ts:370–376`），不写死 `document.body`。文案走 `t()` |
| 16.10 | 不动生成器与布点 / 分档价值 | **PASS** | `rift-layout.ts` diff 空；constants 价值行不在 diff |
| 16.11 | 不为练习场另写机制；`RiftScene` 不 import gym | **PASS** | 见 14.5 |
| 16.12 | 课内不刷敌人 | **PASS** | 见 14.6 |
| 16.13 | 性能：无每帧分配 | **PASS** | 见第 15 节 |
| 16.14 | 不开 I5-C；不标已有迭代 COMPLETE；不替人终审 | **PASS** | 本批未开 I5-C；未改迭代 5 波次表状态；本报告不代勾审美 |
| 16.15 | 连续 2 次不过机器闸门 → 升档 | **N/A** | 本批闸门一次过 |

---

## 17. 闸门状态（汇总）

见文首表。**全部已跑项绿。** codegen 后 generated 文件仅深渊之眼文案，属预期。

---

## 游戏内 UI 验收清单（U1–U12，机械层）

表面：`[E] 翻找/撤离` 提示、底部装置读数条、残渣 toast-inline。权威清单 `docs/specs/_template-ui.md`。**机械可勾；不许代勾好看 / 像游戏。**

| 项 | 机械结论 | 证据 |
| -- | -------- | ---- |
| U1 载体 / 挂载根 | 机械通过。提示与条 = 载体 A（文件头书面）；出击挂 `#dom-ui-root`；课挂 `getDomUiRoot()` 下 `#gym-loot-overlay`。堆 = 世界内实体 depth 15。角锚不绑 camera zoom | `rift-scene.ts:224`；`gym-loot-card-scene.ts:375`；`architecture.md:26, 33` |
| U2 后台管理气味 | 机械未踩圆角卡片堆 / 投影 / 通用图标字体。`.device-plate` `border-radius:0; box-shadow:none`。是否像 OS 进度条 / 是否像游戏 → **人终审，不代勾** | `panel-styles.ts:569–576, 660–680` |
| U3 色彩 | 机械通过。条填充 `#1aad96`；稀有度三档与 Kit 同值；禁紫 grep 空 | `panel-styles.ts:680`；`loot-search-hud.ts:37–41` |
| U4 排版 | 机械通过。Courier 12/13，与随身罩既有档 | `panel-styles.ts:643, 689–695` |
| U5 术语 | 机械通过。「翻找」「撤离」「薪柴」「残渣」均在 `world.md` 术语表 / i18n。无提交/确认/OK | `world.md:162`；`zh-CN.ts:53–61` |
| U6 不遮挡 | 机械通过。提示 `bottom:36px`、条 `bottom:58px` 底中，避开画面中心 ±120×80 | `panel-styles.ts:637–663` |
| U7 输入 | 机械通过。提示键 `[E]` = 绑定 E。无 hover 才可得 | `loot-search-hud.ts:117` |
| U8 状态 | 机械通过。不可见 = 无提示，不是变灰 | `refreshPrompt` + `setPrompt(null)` |
| U9 表名/档位/第二通道 | 机械通过。键印与动作名分节点；残渣标签与星等分 span；薪柴 vs 残渣靠通道（+N vs toast+星）+ 晶簇/光团形态，不靠紫谱 | `loot-search-hud.ts:81–86, 161–162` |
| U10 400ms 反馈 | 机械：条 `width%` 每帧更新，开始即显示。400ms 内是否「可辨」→ **人终审，不代勾** | `setChannel` `loot-search-hud.ts:122–139` |
| U11 共享样式 | 机械通过。`.device-plate` + `showToastInline`；样式进 `panel-styles.ts`，非第二套基元 | `loot-search-hud.ts:25–28, 94` |
| U12 参考锚点 | 机械：文件头写明 Signalis / FTL / Darkest Dungeon / Barotrauma。贴合度 **人终审，不代勾** | `loot-search-hud.ts:8–11` |

**机械层已扫；审美待人终审。** 人否决丑或不像游戏 = UI 不合格，即使上表机械勾完。

---

## 回归（范围内）

| 系统 | 状态 | 备注 |
| ---- | ---- | ---- |
| ChaosSystem | 正常 | 读条不 `setPaused`、不 `addChaos`。`chaos.update` 照跑（规则 14b） |
| ExtractionSystem | 正常 | 提示改由 LootSearchHud 兼任；边沿 E 仍只在 extract 上下文触发 |
| ContaminantSystem | 正常 | 完成时 `acquire`；事件名未改 |
| ToolSystem / 深渊之眼 | 正常 | 回调改喂全部未拾取位置；小地图菱形单一 |
| AudioManager | 正常 | 8 轨规则未改；四键走既有 `playSFX` / `stopLoop` |
| 地图生成 / 连通 | 正常 | layout diff 空；`check:layout` 绿 |
| Ruminate 契约 | 正常 | `getCollectedContaminantPositions` 仍在；「已拾取」= 翻找完成。CSV「空薪柴节点」漂移仍记录在案（不在本迭代） |

---

## 发现的问题

| ID | 类型 | 严重度 | 描述 | 位置 | Spec 依据 |
| -- | ---- | ------ | ---- | ---- | --------- |
| 1 | Spec Issue | Low | chaos spec frontmatter `exposes` 仍写 `LootSystem.getCarriedKindling() / getRemainingNodes()`。实现已迁到 `LootSearchSystem`。不挡本批机械 PASS；归 Director/design 原地改口 | `docs/specs/system-chaos-scavenge-extract.md:18` | spec 维护协议：对外接口变更须更新 `exposes`。`interface-changed` 保持 false 仍正确（事件未变） |
| 2 | 风险 | Low | 练习场课攻击打断用 `JustDown`，出击用 `isDown`。课内无战斗，松键后若仍按住 E 会立刻重开读条。出击路径符合 spec | `gym-loot-card-scene.ts:95` vs `rift-scene.ts:409` | 规则 14 攻击输入打断 |
| 3 | 风险 | Low | 循环键资产 25ms 三角 fade-in，字面落入「0–30ms 窗口内达到编码峰值」。与 Slice 9 既有 player 短音同级，听感终审归人；不单独抬成阻断 | `tools/audio-placeholders/generate.mjs:396` | `system-audio.md` 规则 G.30 |
| 4 | 风险 | Low | 读条进行中若可见性掉到 0 且玩家更靠近撤离点，提示可能切成 `[E] 撤离`，条仍走、按住 E 不会边沿撤离。极端边（混乱收缩 + 重叠半径） | `loot-search-system.ts:351–365` | 规则 16 不打断 + 规则 30 读条转为进度状态 |

无 Critical / High。无确定的实现 Bug。

---

## 通过的检查

- 机制数值四字段与 L 节一致；分档价值 / 权重 / 8+3 节点 diff 空
- 打断六条 + 不锁输入；Esc 经场景暂停冻结进度
- 发声只在开始一次；完成/打断不 `reportNoise`
- E 按住、近者胜、同距撤离优先、文案切换
- 可见性门、非 glow、alpha 乘可见性、开始后不因视野打断
- 揭晓信息集、teal 谱、禁紫、common `#8a8f96`
- 事件无新增；完成走既有两事件
- 触碰拾取文件删除、无 overlap 残留、无死引用
- 卡 3 / 碎弧 / 切卡 / `loot-search-cards.ts` 下线
- 音效四键注册、非空双格式、KEYS=43、接线时机、8 轨可分析
- 深渊之眼改口 + CSV/codegen 一致、同一菱形
- 不挡路；连通闸门绿
- 随图配色走量化函数；点名色板外 hex 已清；palette 无新色
- gym 单组合课仍在且切卡下线
- 纹理预生成 + 对象池；无新每帧 ImageData
- DEC-109 五条决策机械落地
- `tsc` / `check:contam-floor-contrast` / `check:layout` / codegen 绿

---

## 总结

**机械对照范围内：可交人终审。无阻断 FAIL。**

建议：人按合同四问看 gym `?lesson=loot-card` + 出击生产路径（画面 / 音效 / 四碎片堆辨识度 / 1200ms 手感）。PASS 后 Director 标 COMPLETE 并按迭代 9 先例删课。规格过期项 #1 可随收尾四项改 `exposes`，不挡终审。

优先修复：无必须先修的实现项。#1 规格过期可顺手改。#2–#4 不构成结案阻断。

---

# I10-HOTFIX-1 增量对照（堆配色 v2 / DEC-110）

日期：2026-08-30  
对照基准：`docs/design-notes/loot-search.md`「最终组合视觉规格（DEC-109）」节 **v2**；DEC-110（`debris-earth #50463c` / `debris-rust #5d483e` / `debris-wood #4f4835`）。  
代码：HEAD `ed76062` + 工作区热修。本节省既有 I10-QA 正文，只核热修面。  
**不许代勾：** 配色好不好看、堆是否「一眼可翻」——那是 art 与人的事。本节省机械层。

既有报告第 13.4 条「`palette.json` 未新增色 **PASS**」被本热修覆盖：DEC-110 授权加 3 格。第 13.1 条 v1 推导路径（墙模拟 RGB → `temperatureGroup` → `quantizeInGroup`）退役，改查表。

### 检查项

| # | 项 | 结果 | 证据 |
| - | -- | ---- | ---- |
| H1 | 四碎片 × 四槽落格 vs `derivePileSlots` 逐张对 | **PASS** | 见下「数值 diff 摘要」。实现 `PILE_BODY_CELL` + `namedHex`（`loot-search-presentation.ts:56–111`）与 v2 表逐格同 hex |
| H2 | 模型构成语言 / 几何 / 微动未动（只动色值与推导） | **PASS** | 文件相对 HEAD 仍 untracked，无 I10-FINAL 提交可 `git diff`。静态核：`bakePile` 仍 26×18、底影椭圆 18×5、`VARIANT_COUNT=3`；`paintOutdoor/Clinic/Metro/Library` 仍圆钝团 / 平薄瓷片 / 斜靠锈板 / 细长木段；划痕仍渍缝格；抖动 `hz` 8–12、不读 `progress01`；文件内无 `temperatureGroup` / `quantizeInGroup` / `wallBv` |
| H3 | `palette.json` 恰好新增 3 格、无其他改动 | **PASS** | HEAD 36 格 → 现 39 格。`git diff HEAD -- docs/art/palette.json` 只在 `#2a1f1c` 后插入 `#50463c` / `#5d483e` / `#4f4835` |
| H4 | `PALETTE_HEX` 与 `palette.json` 字节一致 | **PASS** | 两边 39 项、顺序与大小写全等。`check:palette-quantize` 同断言绿 |
| H5 | 其余色板副本已同步 | **PASS** | `src/gym/form-renderers/b/palette.ts`、`c/palette.ts`、`src/generation/preview-paint.ts` 的 `PALETTE_HEX` 与 json 全等；三处 nearest 路径跳过残骸三格 |
| H6 | presentation 无格外堆色 / 抽卡期 `0x4a6a64` 不复发 | **PASS** | `src/` 无 `0x4a6a64` / `#4a6a64`。堆四槽全部走 `namedHex` → `PALETTE_HEX_SET` 断言。模块内其余 hex：揭晓 teal 三档 + common `#8a8f96` + mote `#0e4a3f`（均 ∈ 色板）；`0xffffff` 为碎屑白底再 tint；`0x9e3779b9` 为哈希常数非色 |
| H7 | 新闸门 `check:loot-pile-contrast` 存在、入 scripts、只追加 | **PASS** | 脚本 `tools/contam-preview/check-loot-pile-contrast.ts`。`package.json` 在 `check:contrast` 后追加 `check:palette-quantize`（文件 HEAD 已有、此前未接线）与 `check:loot-pile-contrast`；既有 `check:contam-floor-contrast` / `check:contrast` 行未改 |
| H8 | 闸门阈值与 v2 规格一致 | **PASS** | `BODY_MIN=18` / `HIGHLIGHT_MIN=20` / `SHADOW_MIN=8`；夹心 `mean(底影)<mean(地面)<mean(主体)<mean(高光)`；四槽 ∈ 色板、∉ 青绿 / L3/L4/UI/危险/警告；残骸三格不进 L1 池、不进青绿家族。地面主色 `contrastFloorCell`（不加 +16） |
| H9 | CIE76 共享、无第二份抄录 | **PASS** | 实现只在 `src/generation/cie76.ts`。`check-loot-pile-contrast.ts` 与 `check-contam-floor-contrast.ts` 均 `import { deltaE76 } from '@/generation/cie76'`（后者 re-export）。`src/` 无第二份 `srgbLinear` / Lab 公式 |
| H10 | 新闸门实测绿 | **PASS** | `npm run check:loot-pile-contrast` exit 0。四张主体 ΔE 20.0–21.0、高光 27.0–30.7、底影 9.7–12.5，夹心全 PASS |
| H11 | 既有闸门不回归 | **PASS** | 见下「闸门运行结果」 |
| H12 | 不开 I5-C | **PASS** | `git status` 无 I5-C 文件；本批未新增迭代 5 任务文件 |
| H13 | 不动迭代 5 波次表 | **PASS** | `git diff -U0 HEAD -- docs/progress/current-iteration.md` 的 hunk 在 frontmatter / 侧记 / 迭代 10 块；波次表（文件内约 L40–60，I5-S … I5-T）无 hunk |
| H14 | 不标迭代 10 COMPLETE | **PASS** | 本合同 `status: ACTIVE`；本报告 `status: DRAFT`；`current-iteration.md` 写「进行中」「不标迭代 10 COMPLETE」。本节省不改这些状态 |
| H15 | 同图薪柴堆 / 残渣堆外观一致 | **PASS** | `createSearchObjectVisual` 不接收 `kind` / tier（`loot-search-system.ts:153–178`）。两类节点共用 `slots` + `fragmentTypeId` + 节点 id 种子 |
| H16 | 堆不是 glow source | **PASS** | presentation 无 `setBlendMode` / `BLEND_ADD` / `registerGlowSource` / 径向光 / 照亮地板。出击 `registerGlowSource` 仍只给撤离点（`rift-scene.ts:285`） |
| H17 | 禁紫谱 | **PASS** | presentation / loot-search-system / loot-search-hud 无 purple / violet / `0x7722aa`。四槽为暖土棕 / 冷灰 / 中性灰黑；揭晓仍 teal 三档 + `#8a8f96` |
| H18 | 热修截图存在（只核命名，不判画面） | **PASS** | `docs/art/review-2026-08-30/loot-card/hotfix-1/` 四张照亮态：`rift-frag-outdoor-ridge-soil-lit.png` / `rift-frag-clinic-ridge-clinic-lit.png` / `rift-frag-metro-shear-metro-lit.png` / `rift-frag-library-ridge-library-lit.png`。另有 gym 一张与户外迷雾边缘一张，不纳入本项 |

**计数：PASS 18 / FAIL 0。** 无阻断。一条规格措辞过期见偏差清单 H-S1，不抬成 H1 FAIL。

### 数值 diff 摘要（v2 规格 → 闸门实测）

四槽来源：主体 = `PILE_BODY_CELL[fragmentTypeId]`；渍缝 = `stainKey`（与主体同格才回退 `earth-dark`，v2 四张均未触发）；高光 = `metal-light #5a5f66`；底影 = `void-black #080a0c`。

| 碎片 | 槽 | 规格 v2 | 实现 / 闸门 | ΔE 规格 → 实测 |
| ---- | -- | ------- | ----------- | -------------- |
| `frag-outdoor` | 主体 | `debris-earth` `#50463c` | `#50463c` | 21.0 → **21.0** |
| | 渍缝 | `frag-outdoor` `#1a1e18` | `#1a1e18` | — |
| | 高光 / 底影 | `#5a5f66` / `#080a0c` | 同 | 高 30.7 / 影 9.7 |
| `frag-clinic` | 主体 | `metal-grey` `#4a4e55` | `#4a4e55` | 20.0 → **20.0** |
| | 渍缝 | `shadow-grey` `#151a1e` | `#151a1e` | — |
| | 高光 / 底影 | `#5a5f66` / `#080a0c` | 同 | 高 27.0 / 影 11.0 |
| `frag-metro` | 主体 | `debris-rust` `#5d483e` | `#5d483e` | 20.4 → **20.4** |
| | 渍缝 | `brick-dark` `#2a1f1c` | `#2a1f1c` | — |
| | 高光 / 底影 | `#5a5f66` / `#080a0c` | 同 | 高 29.0 / 影 12.5 |
| `frag-library` | 主体 | `debris-wood` `#4f4835` | `#4f4835` | 20.4 → **20.4** |
| | 渍缝 | `frag-library` `#2a2420` | `#2a2420` | — |
| | 高光 / 底影 | `#5a5f66` / `#080a0c` | 同 | 高 29.0 / 影 12.5 |

相对 v1 主体（既有 I10-QA 第 13 节口径）：户外 `#2a2420`→`#50463c`（ΔE 6.7→21.0）；医院同格 `#1e2228`→`#4a4e55`（0.0→20.0）；地铁同格 `#2a1f1c`→`#5d483e`（0.0→20.4）；旧图书馆 `#2a2420`→`#4f4835`（3.3→20.4）。高光从 `bone-grey` 抬到 `metal-light`；底影从 `ambient-black` 加深到 `void-black`。实测区间落入规格「高光 27.0–30.7 / 底影 9.7–12.5」。

### 闸门运行结果（热修工作区，2026-08-30）

| 命令 | 结果 |
| ---- | ---- |
| `npx tsc --noEmit` | 绿（exit 0，无输出） |
| `npm run check:loot-pile-contrast` | 绿。四张主体 ≥ 18、高光 ≥ 20、底影 ≥ 8、夹心 PASS；残骸三格不进 L1 / 青绿 |
| `npm run check:palette-quantize` | 绿。`PALETTE_HEX` 与 json 字节一致；L1 四池仍是热修前集合（残骸均值 > 55 未入池） |
| `npm run check:contam-floor-contrast` | 绿。CIE76 四档 ≥ 18；地面青绿四张三年龄 0.00%；虚空青绿 0%；墙后可走四连通 = 1；`|{shape[id]}| == 4`；修前夹具会红 |
| `npm run check:layout` | 绿。8 种子墙后可走仍过（含户外 / 医院 / 地铁 / 旧图书馆） |

本热修未动 CSV，未重跑 codegen。

### 发现的偏差

| ID | 类型 | 严重度 | 描述 | 位置 | Spec 依据 |
| -- | ---- | ------ | ---- | ---- | --------- |
| H-S1 | Spec Issue | Low | 残骸主体格表三行仍写「新格，待人拍板」。人已批 DEC-110，实现已落地。不挡本项机械 PASS；归 art/Director 改口 | `docs/design-notes/loot-search.md:239–242` | 规格维护：拍板后应去掉「待人拍板」 |

无实现 Bug。无 Critical / High。既有报告问题 #1–#4 本热修未再核、状态不变。

### 热修结论

**机械对照范围内：18 PASS / 0 FAIL。可交人复验四碎片辨识度。不标迭代 10 COMPLETE。** 审美与「够不够跳」仍归人。
