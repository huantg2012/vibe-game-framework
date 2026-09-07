---
status: COMPLETE
iteration: 12
last-modified: 2026-09-07
---

# 迭代12回归记录

用户在原因分析后以「很好，做吧」授权实施。代码检查和下述实机核对已完成。用户于2026-09-07在碰撞补齐后明确「这轮迭代结单」，人终审PASS，迭代COMPLETE。

## 自动检查

- npm run check:vision-energy：通过。Float32的±π和相邻角、8方向/4距离、90及40条射线、32条等照带等半径和内核不塌缩；锥形前/肩/后顺序仍有效。裂隙亮度测量0.674，与基线比1.000×。
- ./node_modules/.bin/tsx tools/purification/check-ground-depth.ts：通过。五装置前后±0.01接触位置、同y稳定且不依赖注册顺序、100次静止不重复写层、附属层不跨组、地板/读数/遮罩界限、重复id拒绝。
- npm run build：通过（含TypeScript）。仅既有Phaser大包提示。

## 初轮实机核对（碰撞加入前）

入口：http://127.0.0.1:3000/ui-review.html?sample=spatial#purif 。此页复用生产场景，内存示例隔离正式存档；前后按钮仅定位，实际深度由生产排序器赋值。走上/下/左/右按钮通过Phaser Key驱动350ms生产移动。

证据目录：docs/art/iteration-12-evidence/。

- fixed-overview.png：全景没有背向长楔；reported-wedge.png留存用户原图。
- core/storage/purifier/offering/growth 的 behind/front 各一张：五台前后遮挡均正确。供奉环孔能透出后方角色；培养藏可遮住后方角色与灯。art独立复核11张图，未发现地面光池或灯尘越层。
- 核心后方20.1/装置23，向下实际走至y201.9后角色29.1；向上退回y174.6恢复20.1。四向纹理与位置随输入变化；moving-up/left/right.png留证，没有方向暗楔。
- 核心分配走生产openWorldInteraction推镜头，点击Esc离开后向下移动恢复；after-interaction.png留证。
- rift-smoke.png：共享Player正常显示，裂隙保留方向性光场及遮挡；未把净化点全向外观带进裂隙。
- 裂隙切回净化点后重新定位供奉台，前后深度恢复；turning-behind-offering.png核对转身期间实体/灯光遮挡。

## 验证边界与人终审

这轮是针对性空间渲染回归，未冒充完整出击/潮汐/战斗流程测试；静态截图也不能覆盖每一帧转身。数值门禁覆盖角边界和稳定排序，实机核对覆盖上述操作。正式存档未读写。

用户先确认初轮层级符合预期，再授权I12-C底座碰撞；碰撞补齐后明确结单。人终审PASS；下文保留实际执行的验证范围，不将其扩写为完整游戏全流程测试。

## I12-C：底座碰撞与绕行

设计：净化点12×8脚底体，五台薄底座；裂隙沿用20×20。连续正撞不能穿过排序基线，斜向输入沿底座滑动，不改32px交互距离。

- 真实Phaser Body/StaticBody/World.separate回归：四侧连续180帧正撞无穿透/反弹，正面/背面排序线不跨越，斜向滑动、四侧/四角交互、出生八向24px通路通过。
- 边界联合回归：保留真实90角、8px方块双层膜，加入五台底座，最强intensity3的rise/crest/ebb×5压力种子×5装置×前后左右，共300条绕行路线通过。每条验证脚体不与任一实体穿透并确实抵达另侧。
- 初次实机发现净化器前侧被旧膜口夹住；补成32px脚心可行圆盘（计入脚体/方块/内缩余量）后两侧已通。不是只通过不含边界的孤立底座测试。
- collision-contacts.json：五台前后各两次持续顶住，角色位置与层级稳定；如核心前y190/层29.1，后y172/层20.1，培养藏前y189、后y169。
- 后方按真实E键分别打开核心、储藏、净化器、供奉、蜕变，证明后侧仍可达；核心单独复核排除了开发HMR重载干扰。
- collision-purifier-clearance.png：净化器两侧可从正面y301绕至后方y280.6，再向上离开。
- 联调另捕获场景退出重复clear已销毁静态组的问题，增加清理顺序兼容与重复销毁回归。

这批改变了净化点碰撞和必要的局部膜边缘余量。其余UI、装置贴图、交互内容、裂隙视野与默认玩家碰撞未改。

- 最终实机：第5潮潮峰（intensity3）五台斜向绕行均到达背面。collision-high-tide.json记录最终坐标/depth，collision-high-tide.png留图。
- collision-scene-return.png：裂隙→净化点往返后，正面碰停打开核心，退出仍能移动；场景重建未再报错。
- 销毁回归使用真实Phaser StaticPhysicsGroup/Collider，覆盖活资源销毁、重复调用以及Phaser先销毁组之后再清理；资源只销毁一次。
- 最终构建与TypeScript通过；仓库无lint脚本/配置，不宣称lint通过。全部正式存档隔离。
