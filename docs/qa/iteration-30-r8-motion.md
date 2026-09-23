# I30 R8 · 六件装置活层与裂隙入口

状态：实现与有限运行验证已完成；审美/沉浸感待独立看图与录像、用户终审。关联 COH-F042 / COH-F026 / COH-F038。

## 实现范围

- `src/art/chamber-device-motion.ts`：独立、确定性的姿态采样，六件局部像素活层，裂隙静态裂岸与缝中传播共用几何。
- `src/scenes/chamber-device-activity.ts`：六张裁切图集；每张只在实际健康档位或供奉空/有物改变时重建，平常仅切换帧。实例销毁移除 Image 和纹理。
- 核心静态壳/活腔接入、与环境投光同源、真实事件接线、场景/存档合同由主任务维护。

核心以 6.2 / 7.4 / 5.6 秒三次不同长度的收束、停顿、放松循环；正常姿态 16 帧。108 秒有三个间隔 30–42 秒的 240ms 局部颤动窗口；不是全景震动。真实修复是 1.68 秒“闭合→聚集→归稳”16 帧，重复事件替换上次表现、不排队、不锁玩法。减动模式保持固定主体姿态、无颤动；实际成功保留一次低幅、柔和的光强结果提示。

储藏封口短时落定；净化器左右介质先后转移；培养藏介质与深部轮廓有限漂移、气泡错相；供奉环空时只有支架微动，有物才有匿名介质；裂隙沿真实缝格渗行。后五物各为 16 待机帧＋8结果帧；供奉额外8帧用于实际成熟后的释放，不代表每件常时都显著运动。

**供奉字段只表示占槽数量。** 不据此推断充能、品质或成熟，也没有计时成熟演出。修复/成长/供奉强化必须从既有成功事件调用；绘制模块不能决定交易成功。`offering-complete` 是单独的真实成熟事件，释放夹具及短暂匿名残流；成熟帧不会保留一个已回库的供物实体。培养藏与净化器的次光由 `sampleDeviceLight` 跟随其活动帧，核心继续跟随 `sampleCoreMotion`。

入口第二稿回看旧 `rift-e5-sheet.png` 与 `_c5_gap_cells` 后重建：9 条不等向主裂、5 条从属分叉、1 段不闭合连裂；7px 深心，末端渐浅/渐窄；少量断口翻片、单侧碎口；亮段限在有裂岸支撑的缝内，不能用整片绿光补形体。图集首稿的五条等粗折线已替换。

## 已执行验证

### 纯采样与像素

命令：`TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/qa/check-i30-r8-motion.ts`

结果：12,604 个断言通过。覆盖裁切边界、实际像素及轮廓变化、帧范围、减动稳态、损伤不会比健康更亮、供奉空/有物差别、三段真实修复时间、裂隙静态边界。数字主要来自遍历采样，**不是品质分数**。

证据：[sampling.json](artifacts/iteration-30-r8/motion/sampling.json)、同目录六张 atlas 与 `rift-shell.png`。这些是诊断资产，不是游戏截图。

### Phaser 资源夹具

命令：`node tools/qa/check-i30-r8-motion-runtime.mjs`

隔离浏览器的 MainMenu 场景上创建独立管理器，连续三次 create/destroy；每次手工喂给30秒的采样时刻，验证：初始化6次构建，待机不重建；健康跨档只重建一张；同档HP变化不重建；空→有物重建一张，占槽数量进一步增加不重建；成功事件不重建；销毁后纹理表回到原值。

固定6张纹理合计630,784像素，RGBA约2.41MiB；canvas CPU副本与GPU各一份时约4.82MiB，未把驱动/对象开销算进去。这是预算估算，不是浏览器总显存实测。

证据：[allocation.json](artifacts/iteration-30-r8/motion-runtime/allocation.json)。此夹具不是自然游玩或正常驻留证据。

### 实际场景与录像

命令：`node tools/qa/check-i30-r8-motion-play.mjs`

使用全新隔离浏览器，3025生产入口，保留原角色、真实键盘，未修改用户存档。录像使用本机已有Playwright ffmpeg，没有下载依赖。

- [正常录像](artifacts/iteration-30-r8/motion-play/normal/normal.webm)：31.2秒普通驻留，六个实际Image都在选择不同姿态；真实驻留期间无图集重建。真实Esc暂停时活动帧和灯状态冻结；系统减动偏好下六物与待机灯保持稳态；三次真实菜单载入后均仅保留6张活动纹理。
- [受损与修复录像](artifacts/iteration-30-r8/motion-play/damaged/damaged.webm)：开机前注入公开受控存档（核心24、储藏0、净化器70，薪柴100），连续31.0秒真实驻留；真实WASD靠近、E打开、右键增加1薪柴、Enter修复，回执核心24→28、薪柴100→99。实际核心帧覆盖闭合16–19、聚集20–25、归稳26–31，随后回待机。
- [完整manifest](artifacts/iteration-30-r8/motion-play/manifest.json) 包含起止源码指纹（四个动作/灯/接线文件一致）、截图、逐段时间、帧采样、错误；两上下文控制台均0错误。

### 灯光共源补验

新增 `sampleDeviceLight` 后，使用 `node tools/qa/check-i30-r8-motion-light.mjs` 对真实生产场景普通驻留采样110次；core、growth、purifier实际光强与活动采样同源，允许动态光80ms缓存的一帧相位差。证据：[phase.json](artifacts/iteration-30-r8/motion-light/phase.json)、[短录像](artifacts/iteration-30-r8/motion-light/paired-light.webm)。此补验对应最终灯光与供奉释放图集代码；前面的31秒录像保留原时间与指纹，没有覆盖历史证据。

## 明确边界

- 录像的受损状态不是自然打出来的；修复交易使用真实输入和生产事务。
- 此次没有审听声音，没有宣称“发布品质”“玩家已认可”。正常尺寸是否足够可感知要由独立评审看无声录像判断。
- 有供物与成熟后的真实交易/演出由主任务另录，不计入本子任务录像。纯绘制与Phaser夹具验证空槽不凭空长出内容、真实完成事件释放后回空夹具；接线不会把占槽比例解释成充能/成熟。
- 构建/最终场景走查由主任务统一执行；项目无独立通用lint脚本，本子任务执行过 `npm run typecheck`。
