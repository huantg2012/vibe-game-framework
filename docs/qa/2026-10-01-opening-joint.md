# 首页与净化点联合样片

状态：**DEV-IMPLEMENTED / LIMITED-VERIFIED / HUMAN-REVIEW-PENDING**。关联 COH-F002 / COH-F005 / COH-F042。唯一设计规格：[视觉连续性](../specs/art-opening-haven-continuity.md)。

入口：[单方向可操作样片](../art/demos/opening-joint/index.html)。点击开始进入真实净化点；WASD 移动、E 交互、Tab 报告。场外提供返回首页和无转场直接对照；对照中的实景是当时正式渲染器的截帧，不是首页背景或离线示意图。

## 实现与来源

- 首页为内置 image_gen 生成的一张独立 1536×1024 母版，依据本轮实景、原首页及实际核心/角色模型。提示与来源保存在 [source.json](../art/demos/opening-joint/assets/title/source.json)，提供生成时实景参考。局部动效仅调制画中已有核心灰绿受光和炉火暖色像素；不扭曲人物或建筑。
- 实景由 [joint-scene.ts](../../tools/last-light/joint-scene.ts) 确定性建模，并由 [export-joint.mjs](../../tools/last-light/export-joint.mjs) 导出完整独立资产。新增倾斜藏书楼、纵向承重余体及分层地坪/断面；装置位置、通行几何和导航不变。1035 帧角色及其元数据从生产包原样复用。
- 入口复用 BootScene、PurificationScene、RiftScene、会话和 MenuEntryTransition。DEV 资产命名空间在 preload 前设置；正式构建忽略该 profile，仍读取原生产包。首页坐姿到实景炉边站姿是镜头剪辑，未制作起身演出或同位连续镜头。
- 页面在导入游戏模块前将自身 localStorage 替换为 Map，并注入 SaveManager；返回保留本页记录，刷新清空。正式记录不作为测试素材。

## 已完成的限定验证

中断前使用实际新资产包的浏览器检查已验证：标题进入、真实键盘位移、E 坐下/起身与 1→1.18→1 镜头、氛围文案、Tab 报告和 Esc 关闭、真实渲染截帧对照、返回及继续、重新开始的取消分支、标题失焦与减少动态效果冻结。隔离浏览器上下文中预置的生产 Storage 哨兵字节保持不变；没有读取用户真实存档。

最终资源重烘后执行 [可复跑脚本](../../tools/qa/check-opening-joint.mjs)，[结构化结果](artifacts/opening-joint/result.json)记录实际源码和资源 SHA。共14项限定检查通过：上述链路全部重测，并从继续后的出生位置以真实 WASD 走到净化器，E 打开实际分配面板、Esc 关闭；未摆位或执行交易。无页面异常或失败资源请求。测试使用一次性 headless Chrome；它与主线程浏览器观察分开计入，旧 opening-three 结果不计入通过。

主线程在 Codex 内置浏览器实际查看最终首页、点击开始进入修正后的实景，打开直接对照、切到真实截帧并 Esc 返回。最终受光中人物装备仍可辨，灰绿空气仅处于远层柱间；画面是否达到期待仍留给用户审查。

证据：[首页](artifacts/opening-joint/title.png) · [正常实景](artifacts/opening-joint/haven.png) · [坐下](artifacts/opening-joint/seated.png) · [净化器交互](artifacts/opening-joint/purifier.png)。

完成的自动检查：

- `node --import tsx tools/last-light/export-joint.mjs --check`：最终包来源/输出SHA、相机/站位、角色逐字节复用、场图/图集维度、alpha=0辐射及空气真实深度截断均通过。102041静态三角、27灯、28张PNG；32文件共26930162 bytes。近、中、远、据点各层的纹理与材质/光场使用一致UV。
- `npx tsc -p docs/art/demos/opening-joint/tsconfig.json --noEmit`、`npm run build`、`git diff --check`通过；Vite原有大chunk提示保留。生产构建不包含DEV入口，因此与定向类型检查分开记录。
- 新/原包分别在相同隔离浏览器上下文、960×640镜头和出生位置取5秒样本：RAF均值均约16.666ms，p95分别16.7/16.8ms；draw CPU提交均值0.254/0.272ms、p95均0.4ms。该样本不含GPU异步完成成本，不代表长时间、移动复杂场景或低端设备性能通过。
- game-state引用结构无错误；原基线与历史来源漂移继续显式保留，没有为变绿而刷新所有旧证据。

## 观感复核与边界

初次两端直接对照确认核心、炉子、人物装备和倾斜藏书楼身份更接近；同时发现实景柱间过黑、炉边角色过橙。后续在同一 DEV 方向修正远层空间空气、断口污染受光和炉源功率，未继续生成候选或修改正式默认。炉源功率3.8→2.7，同步作用于烘焙受光与移动角色；两条世界空间灰青密度体采用16步积分并被真实远层深度截断，最大实际RGB增量仅[3,5,4]，保留原alpha/depth，由既有分层合成遮蔽。它不是全屏抬黑或新增灯源。离线`reference.png`不含此DEV空气层，不能作为最终实景证明。

技术通过不等于连续性或美术通过。首页断面细节仍比实景丰富，最终差异是否可接受由用户对可操作样片审查。自然完整搜撤循环、全部交易、低端设备、Canvas 降级、长期性能、音频听感及普通玩家盲测未在本轮验收。I28 挂起与旧版本人审边界保持。

已知旧包校验边界：生产 `check-assets.mjs`存在本轮之前的`rift-a.ts`来源指纹不匹配；本轮未重烘正式包或改写其指纹。DEV包使用当前作者源码独立完整校验，复用人物及导航的输入SHA另行锁定。

## 同日：首页画法复选

人审只认可坐姿与角度，要求改善首页的生成感。新增[六张候选比较页](../art/demos/opening-pixel-candidates/index.html)，不是六套构图；A–D 是保守处理，E/F 放宽微轮廓限制后加强粗像素或块面概括。全图均由内置 image_gen 重绘，未用缩图/噪点滤镜冒充新画法；[提示与来源](../art/demos/opening-joint/assets/title/candidates/source.json)完整保存。原 DEV 默认图及生产资源保持不变。

本轮限定验证：

- 六张原始 PNG 均为 1536×1024，来源 SHA 匹配：[资产核对](artifacts/opening-pixel-candidates/assets.json)。
- Codex 内置浏览器实际用 0–6 切换原版与六候选，均显示对应图片：[切换记录](artifacts/opening-pixel-candidates/browser-switches.json)。人物局部放大、原图恢复、真实实景截帧切换已查看；所有局部使用一致的图像坐标，没有逐图移动裁切掩饰构图漂移。
- 从 F 的“开始”链接进入真实 DEV 首页，再点击游戏“开始”，到达净化点并出现坐下提示；无控制台 warning/error。入场后的“直接对照”首页图源确认是 `candidates/f.png`，非原图。[F 标题比较页](artifacts/opening-pixel-candidates/f-title-page.png) · [F 入场后的实景](artifacts/opening-pixel-candidates/f-entered-haven.png)。本轮没有重验全部交易、移动或14项原联合样片检查。
- 候选参数仅允许 DEV `a`–`f`，缺省/非法值回退原母版；不写用户选择至正式存储。原图专用光效遮罩在候选模式关闭，候选为明确标注的静态画法审查；真实游戏及过渡复用既有实现。
- 两个入口的定向 TypeScript 与差异检查通过；本次未改生产代码和实景资产。

实图评审结论：优先对比 C/E/F。C 保留原貌最稳；F 的环境大面与安静暗部最能减弱材质滤镜感；E 粗像素区别明显。A/B/D 变化有限，不包装成三种全新画风。E 并非严格统一的低分辨率网格，E/F 核心有晶体/胞块化，F 新增少量管口；选中方向后仍需恢复核心灰绿能量体的身份并修整误生结构。所有候选为 **DEV / HUMAN-SELECTION-PENDING**，不能据类型检查或生成提示声称美术通过。

## 同日：F 已选，首页动效

用户随后明确选择 F，并要求适度、生动的首页动效。当前[联合样片](../art/demos/opening-joint/index.html)默认 F；静态原始像素未改，`?title=0`及 A–E 保留为历史对照。**F 绘制方向 HUMAN-SELECTED，动效 MOTION-REVIEW-PENDING**；正式生产首页与实景资产未在此轮替换。

动效由 F 专属的960×640透明层实时绘制：炉栅内的明焰起伏与暖光受光同频；核心密度缓慢流动、约3.8%低幅采样胀缩及附近灰绿受光共用慢周期；烟囱出烟、少量余烬/浮尘与深景受限空气各有更慢节奏。建筑与人物轮廓、镜头和标题保持稳定。亮暗遮罩使用既有受光像素，远景空气只进入作者划定的暗部空间；不对整张图加呼吸缩放、全屏曝光或蓝色蒙层。

[专项脚本](../../tools/qa/check-opening-title-motion.mjs)在一次性 headless Chromium 内最终通过12项，[结果](artifacts/opening-title-motion/result.json)锁定本轮 F 图片、entry/motion/CSS 来源 SHA：默认F及唯一动效实例；真实RGBA像素/时钟变化；8秒实际图＋动效画布录制；分发 blur 后冻结及按键恢复；切换减少动态时清空覆盖层并冻结，初始减少动态亦为0时钟/0动效像素，恢复后继续；点击进入真实净化点销毁旧实例；返回重建唯一新实例；正式源 Storage 哨兵未变。14次取样的菜单安全区 x<360 均无动效像素，页面错误和失败请求均为0。

检查过程中修复一项实际遗漏：仅依赖 MediaQueryList 的 change 事件，在测试宿主中会冻结旧覆盖帧。现于 Scene update 边界同时观察 matches，保证减少动态时回到原静图；新增0alpha断言拒绝了前次42744可见像素的证据，最终重测通过。

主线程亦在 Codex 内置浏览器查看 F 动态标题、确认位置和普通 source-over 合成；专项首末帧未见整体构图漂移或错位光斑。证据：[8秒动效](artifacts/opening-title-motion/f-title-motion.webm) · [首页](artifacts/opening-title-motion/f-title-start.png) · [初始减少动态](artifacts/opening-title-motion/f-title-initial-reduced.png) · [实际入场](artifacts/opening-title-motion/entered-haven.png)。视频直接合成实际F图片与实际动效canvas，960×640、请求30fps，不含DOM文字/声音；合成采样次数不是编码帧率。动效美感和可感知程度仍由用户审查，不把像素变化当成审美通过。

定向 TypeScript、脚本语法与差异检查通过。本轮没有重测全交易、导航、Rift恢复或14项原联合样片全套；未宣称长期性能、低端设备、系统真实窗口失焦和跨浏览器通过。F 原图中晶体感及误生管口仍保留为静态图修整项，此轮没有重新生图。
