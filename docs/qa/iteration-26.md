---
status: AGENT-VERIFIED / USER-ACCEPTED-CHECKPOINT
iteration: 26
decision: DEC-170
last-modified-date: 2026-09-18
human-acceptance: CURRENT-DELIVERY-ACCEPTED
---

# 迭代26验证 · 世界生成与正式2D搜撤

范围为[四批合同](../tasks/iteration-26.md)。代码实现、机器性质、实景观察和人的审美分别记录。低饱和不是系统目标；五个具名配方为覆盖用例，不是世界数量上限。

## 共享生成／渲染

- CSV五配方、独立两空间；新增organization/regionScale/quietness/formScale/fragmentation/accentCoverage。区域场控制覆盖、主形、细节、静区与点缀色。
- 原32角色帧、80px/s基线与启停保持；权威8px支撑和20×20身体取代查看器原12px九点身体。渲染、视线、正式TileGrid使用同源支撑。
- 层床／共根晶簇／釉连皮与剥落均为浅地形；反射归属跟随真实像素拥有者，同色覆盖也会清除旧响应。
- 纯黑世界空洞与未知地面保持不可区分，背景噪声只在本DEV关闭。正式八向目标／连续转向、光域、暖光、威胁、翻找、库存和结算复用原系统。全屏受击／混乱反馈是几何无关的屏幕效果，不能据其短暂改色称为空洞材质受光；也不能用几何裁它而泄露隐藏地形。

## 机器验证

- `npm run build` 已过（既有大型chunk警告保留）；正式production产物的world-play入口仍按DEV约束关闭。
- [共享回归日志](artifacts/iteration-26/shared-checks.log)：最终同版通过：96几何、12条20×20连续身体路线、32原角色帧、320正式移动比较、256空间预设＋160数值扰动；56几何/124场/36渲染、9匿名材料组合、6原材料参数响应以及6新增组织参数响应。
- [组织专项](artifacts/iteration-26/composition-check.json)：10个未调参world×space样本、6新增维度实际像素响应、匿名改名等价、高饱和/无彩、拒绝非法值及20px完整身体支撑通过；完整画面美感不由数值代签。
- [同源原图](artifacts/iteration-26/terrain/terrain-manifest.json)：5配方×2空间，原分辨率1792×1216，每个void像素及反射足迹检查。全图用于读组织，不能代替正常镜头。
- [正式适配矩阵](artifacts/iteration-26/play-map-check.json)30例（5世界×2空间×3种子）通过：支持/遮视、20px身体扫掠、搜寻/撤离/巡逻可达、恰好一个听觉形态及确定性。

## 实景内部评审

首次主形有重复木片／固定扇形／菱形剥口问题，已在共享material-forms中改为不等宽层床、不同长度截头晶面、不同位置釉剥口与轻微轮廓弯曲。参与实现的art子代理重看全部10张原图确认重复符号明显减弱，高饱和主体与蓝底金晶主材关系保留，没有整圈白描边或洞内材质。

仍有观感余量：条带内长片主形有家族重复感；部分主形和底纹接触稍显贴附；釉厚薄在全图较含蓄。正常镜头已补看正式原帧与查看器原帧：角色、翻堆和HUD可定位；高饱和猩红、蓝金材料关系在正式灯下保留，静区与活跃区可区分。钴蓝金脉局部暗金与棕色角色近色，已补真实追击一趟，仍保留为后续跨配方可读性观察项。本轮属于实现者专项自查，不能称为先前A/B那种未参与实现的独立盲审。以上不能记人审PASS，也不以增加噪声／统一去饱和处理。

## 失败／测试边界

正式输入首两次自动回归未完成：一次测试误设safe薪柴必出首武器（真实薪柴收取正确），一次开发热更新重置页面。均保留在play-worklog；固定DEV静态构建用于后续回归，避免边测边更新源码。后续固定构建实测结果如下。

本批仅原生甲类地面敌人、四个翻找节点、单撤离和训练内存session；翻堆外观暂借原户外生产绘制，实际物品来源保留当前world-study ID。不是四A供给验证、全部工具／敌人目录适配、正式随机池接入或无限空间质量证明。

## 正式输入、生命周期与边缘

- [最终8px撤离提示版输入](artifacts/iteration-26/play/final/keyboard-probe.json)：真实E松开清零、重新完成翻找，薪柴0→1、剩余4→3；Tab库存不暂停世界；两敌警觉／追击，37.2秒HP55撤离，原库存run settled。死亡趟27.3秒降到HP0，携带物清空、weaponId为空。五次重开，地表纹理恒2；正式存档哨兵零写入，pageerror为0。
- [蓝金动态趟](artifacts/iteration-26/play/cobalt-motion/keyboard-probe.json)：最新结果文案版，真实移动／追击／受伤／翻找／撤离，13事件记录无失败或页面错误，R按键实际返回配置；保留[追击帧](artifacts/iteration-26/play/cobalt-motion/moving-threat.png)、[受伤帧](artifacts/iteration-26/play/cobalt-motion/moving-damaged.png)及目录中的原速webm。没有用静帧或调试注入代替实际输入。
- [角点回归](artifacts/iteration-26/play/corner/corner-probe.json)：crystal-fibre/fracture-fields/175150从出生真实行走。北向650ms停在(917.401,818)，再北向400ms不动；东向600ms沿边到(963.956,818)，南向350ms退至(966.179,845.444)。旧12px身体停点对20px身体不合法，未瞬移。说明正确阻挡、切线可续及可退，不宣称所有角点摩擦消失；本批选择正式碰撞，不加自动绕障。
- [查看器检查](artifacts/iteration-26/viewer/browser-check.json)：22帧、14输入记录，5配方×2空间、真实移动、边界停止、切材质保留几何与位置、URL／缩放／视野，0错误。该脚本随截图附带的短帧时序不是独占性能基准。

## 构建版本与范围

机制完整趟依次保存verified、final和cobalt-motion；UI文案低影响修正在cobalt最新趟验证，不冒称更早的死亡截图已有新文案。[生产构建日志](artifacts/iteration-26/build.log)在最终UI改动后通过。DEV独立静态构建位于`/tmp/coh-i26-play-static`，通过3012预览，源码和命令见play目录记录；正常生产world-play页面仍保留DEV门。

当前可验：`http://127.0.0.1:3012/rift-world-play.html?world=ivory-basin&space=open-scars&seed=70421&autostart=0`。这是一趟正式机制验证，未接正式世界抽取池或长期供给。

## 最终性能与原入口回归

[独占短时性能记录](artifacts/iteration-26/play/performance.json)：Headless Chrome、1600×1040/DPR1、正式960×640逻辑；10个world×space组合各静止3秒＋真实四向按键移动3秒，共20窗口。最低约60.001fps，最差p95/p99/max均约16.8ms，>33.4ms为0；首次就绪1039ms、后续561–651ms，地表纹理均2张。生成／烘焙发生于入场或重开，不在行走期换图；这不是目标硬件或长时间压力发行认证。

同一脚本实际启动默认无fixture入口：fixture=null、原32px格、voidNoiseEnabled=true、voidColor=0x080a0c，实际按键位移>5px。默认结果文案“返回净化点”单独做纯呈现检查，未伪造一次实际结算。最新DEV结果已由蓝金整趟证明“返回配置”与真实R返回相符。

美术补看蓝金移动／受伤／撤离前3张原帧：所见玩家仍可定位；金褐处下半身近色与敌人重叠时的局部遮挡保留，不冒称全部动态可读性或完整视频已审。所有四批实现已交，内部验证PASS，用户审美与最终体验仍PENDING；不据此关闭四A或开放四B扩产。


## 用户保存检查点（2026-09-18）

用户回复“真不错，提交push”，认可本轮已交成果并授权提交当前游戏工作及推送`coh`到`origin`。本次保存迭代26四批实现、此前未提交的共享地图改进、封存评审与验证记录；独立`CLAUDE.md`框架修改排除。已知美术余量仍保留，不扩写成所有配方或发行质量已终审；24/25未开启、四A未开始、四B锁定保持。此前“待人审／未提交”段落为各验证时点记录，本条记录最新用户态度与授权。
