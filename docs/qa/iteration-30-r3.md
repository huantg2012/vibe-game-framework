# I30 R3：场景体积、材料与内外接触打磨

日期：2026-09-22。基线 `120cc0e`（画面为 `f9eb02d`），用户原始评分：交互物80/100、结构75/100、场景模型渲染50/100。R3已实现并完成限定内部验证，HUMAN-REVIEW-PENDING；旧分数不提升或清零。

## 范围与方法

主功能 COH-F042，关联F026/F006。保持两级台地/双坡道/六装置位置、原角色、玩法与UI；重绘建筑表面、地坪、厚断面、壳外实体和改写接触，修正局部地面反光及受损接缝活动。运行入口为正式 `/`，测试均使用隔离浏览器上下文。

新脚本真实按键捕获正常/受控损伤、核心聚焦及上层，对缓存绘制、三次重入释放和短时帧间隔做限定观察。已知路径导航不冒充初见体验；受损fixture仅修改公开模块HP，不是自然赚取成长。

## 已完成检查

- 地面受光19用例：上下层、双坡、六底座、台地立面、墙/空洞、边缘落光、衰减和公开健康缩放通过。
- 原8024运动检查通过，R3没有改布局/运动。
- 最终正常/受控损伤各四个机位、核心聚焦及上下层画面：两组通过，errors均为空，见[表现记录](artifacts/iteration-30-r3/presentation/manifest.json)。受损fixture只将公开CORE/STORAGE/PURIFIER的HP设为8/24/0。
- 六设备与五环境层均为独立非空纹理；损伤只改变核心/储藏/净化器/抵抗层的纹理哈希。三次真实暂停菜单重入后，旧纹理键均移除，总纹理数始终265。
- CDP精确覆盖先观测到五环境绘制各1次、设备6次以校准；随后静止与移动采样中，这些缓存绘制函数均调用0次。动态受光仍按活动tick或人物整数位置变化绘制，不冒称全场零绘制。
- 独立短时帧采样2.502秒、150帧：约59.96FPS，P50 16.7ms、P95 17.2ms、最慢17.9ms。采样时无覆盖追踪、截图或并发构建；只代表本机短时观察。
- 最终[运行回归](artifacts/iteration-30-r3/runtime/manifest.json)通过：六个面板真实E打开/冻结/退出，核心物前/物后和实体底座，两坡道横移/停/反/下降，实际进入Rift后W/D保留俯视移动。没有重跑完整归来/修复购买/旧档迁移。
- 最后立面修正冻结后，`npm run build`、19受光用例、8024运动检查再次通过；318模块，既有大chunk提示保留。

## 首轮实帧问题与修正

根代理与未参与制作的独立代理均亲看R2/R3正常全景及R3核心近景：R3外部残构、墙体转折与楼板体积有所改善，但地坪同尺度碎斑形成迷彩、墙根/台阶下黑带过连续、顶/侧/背光面尚未充分分离。art查看实帧后同意。修正聚焦取消通用地坪三档噪声、采用明确施工面和窄交界磨损，收窄接触暗缝并保留立面中间色，按固定面朝向建立明度；六物和路线保持。修正后的第二次同机位捕获见`second-pass/`，独立复核确认迷彩和连续黑带明显减弱，六物重新成为主体；剩余中央双坡之间非通行立面与地坪同值，最终仅调整这一处面明暗，作为第2轮有证据的局部修正，之后冻结。这是知情静帧判断，不是用户新评分。

## 最终实帧与复现

- [正常全景](artifacts/iteration-30-r3/presentation/normal/01-main.png) / [核心近景](artifacts/iteration-30-r3/presentation/normal/02-core-focus.png)。
- [上层西侧](artifacts/iteration-30-r3/presentation/normal/03-upper-west.png) / [上层东侧](artifacts/iteration-30-r3/presentation/normal/04-upper-east.png)。
- [受控损伤全景](artifacts/iteration-30-r3/presentation/synthetic-damage/01-main.png) / [第三次重入](artifacts/iteration-30-r3/presentation/normal/05-third-reentry.png)。
- 首轮问题证据保存于`first-pass/`，第一次修正见`second-pass/`；最终交付仅以`presentation/`和`runtime/`为准。根代理亲看最终正常/损伤图，独立代理已复核前两版；最后局部面色修正由art及根代理核对，没有声称独立代理重审最后版本。
- [最终源码指纹](artifacts/iteration-30-r3/source-hashes.json)；表现脚本开始/结束源码哈希一致，收尾再与磁盘对照，防止混用版本。

启动现有本地服务后，复现命令：

```sh
node tools/qa/check-i30-chamber-r3.mjs --out /tmp/coh-i30-r3-presentation
I30_LABEL='I30 R3' I30_OUT=/tmp/coh-i30-r3-runtime node tools/qa/check-i30-chamber-runtime.mjs
node --import tsx tools/qa/check-i30-floor-light.ts
node --import tsx tools/qa/check-i30-chamber-movement.ts
npm run build
```

## 收尾与未验边界

- 架构：`architecture.md`登记同源地面受光遮罩、预编译像素段、动态层与释放；资产HOW原地更新于`art/purification-renewal.md`。
- Spec判断：没有玩法/接口/存档/费用变更，运动/交互规则沿用R2；空间设计正文仅同步表现实施状态。
- 交付：I30清单、当前进度、路线和F042/F026来源/证据同步；现状INDEX随文本更新，HTML保持按需快照。
- UI清单：本轮不改HUD、DOM、菜单或模型操作位；六面板在新场景中的开关/冻结通过，未扩大为全域UI重新验收。六装置绘制主体/完成处理/挂件与状态函数未重做，原角色与布局保持。

后墙大形与远端残构仍有简化感，不能凭技术通过宣布达到交付审美。用户尚未给R3评分；专门音频、初见导航、自然长期循环与满供奉全周期未验，I28长期采样/平衡继续挂起。本轮测试隔离存储，未改玩家存档；本地提交排除独立CLAUDE.md改动。
