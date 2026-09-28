---
status: R11-LAST-LIGHT-ACTOR-FULL-BODY / IMPLEMENTED / LOCAL-VERIFIED / HUMAN-CHANGES-REQUESTED
created-date: 2026-09-23
last-modified-date: 2026-09-28
owner: director
baseline: 35f17ba（完整像素画法） / 5445d15（A与裂隙方向认可）
features: COH-F042 / COH-F026 / COH-F006 / COH-F039
---

# 净化点美术重构计划

## 当前决定

用户已选择 A 断裂回廊，认可左前断沿竖向裂隙，最新授权：“再窄一些，然后直接做正式版本入游戏”。裂隙相对原始中心线收至52%（上一版72%），最宽0.6864m；位置、高度、操作点、楼板断口、A回廊及其他设备保持。

`e05e9a8` 已完成上述正式接入的限定功能检查。用户随后明确指出**阴影、外景内容/氛围/随动及人物太空步**问题，当前是 **HUMAN-CHANGES-REQUESTED**。旧六站、出入与坐下检查仍是当时功能证据，不能改写为正式画面获得人审通过。本轮修复继续沿用已选画法和A构图。

美术原则与世界观只维护在[集中美术正文](../art-direction.md#resume-art-rebuild)。必须沿用获认可的源模型、材料、光照与固定像素采样，不用另一套简化几何冒充正式版本。旧A/C、R10及被否决版本不约束当前画法；既有人审认可不等于本次正式接入的人审通过。

## 当前执行状态

用户评价 `3cd4372` “好多了”并授权继续全身步态，不代表自然度验收。本轮修复刚体胸头背包、固定4.297°前倾、离地先伸膝再收膝、摆动脚参与骨盆可达约束四处问题。`3f4efc3`静息/斜向确认保持，场景画法和布局不变。

- [x] 用完整步态关键姿态组织承重，仅接地腿约束身体；早收膝、小腿自然送脚。
- [x] 髋胸反向微转与侧移、头部稳定、背包微滞后、真实摆臂；模型/灯锚/rig同源。
- [x] 最终参数和1035帧已重导，gait/lateral/whole-body/assets/facing/movement/Player/类型及构建通过；保持1.25m周期、1.8m/s、12行走帧、方向图集及独立idle/recovery。
- [x] 正式Renderer左右各30帧、四斜向各6连续walk帧、idle 2秒复看；复现页控制台无warning/error。
- [x] 正式根页新开继续存档、A短键真实位移后松手站稳，WebGL2且控制台无warning/error；D短按无位移不计验证。22张非人物静态PNG与3cd4372一致。
- [ ] 当前全身动作与整体自然度待用户复看。

当前 **IMPLEMENTED / LOCAL-VERIFIED**。此前横向承重的数学、图集与浏览器范围保留在[角色QA](../qa/iteration-30-last-light-actor.md)，不能沿用为全身动作通过。

以下是上一轮 `eb0c527` 阴影/外景修复的限定范围，动作结论由本轮重验：

- [x] 外景：近层整体固定，锁住真实接根；中层/远层连续软限幅≤3.5/6原生像素。观察只取XZ投影，140ms平滑，不随上楼高度牵扯周边建筑。
- [x] 各层颜色、深度、光场与侵蚀同UV；独立导出字段atlas。按真实远景法线/深度恢复转面与消隐，不抬蓝背景，不改获认可的平台原色图。
- [x] 灯影：肩灯512 cubemap随移动刷新；固定灯192阵列逐像素判断可见性；人物每姿态11胶囊投影替代单一躯干近似。
- [x] 历史步态：世界1.8m/s、实际位移推进1.05m步周期已接入；旧312帧只落脚而不返回idle，本次替换，不再作为动作合格结论。
- [x] 本轮assets、exterior、8组movement、gait、Player及构建通过；坐下/起身呈现锚点误算走路已由helper专项回归修复。
- [x] 正式根游戏：新GPU编译/运行，WebGL2无fallback，主菜单继续重入和W短移动可用；本机短样约120fps。
- [x] 上一轮同正式Renderer/素材/step/gait复现页检查过坡脚/坡中、设备/混光/核心及外景极端；世界等分八向回放并未覆盖屏幕八向错配，也未验证停步真正返回idle。阴影/外景结果保留，人物由本轮重验。
- [ ] 本轮未重新做正式键盘六站完整复走、业务交易、坐下UI与Rift全流程；历史功能证据与当前验证分开。
- [ ] 修订版实尺美术/动态体验人审。

以下为 `e05e9a8` 正式接入时完成的历史限定范围，不代签上述整改：

- [x] 裂隙由72%再收至52%。
- [x] `PurificationScene`切换新场景，六处原业务保留；共享Player新增显式外部呈现选项，Rift默认路径保持。
- [x] 接入坐下/起身、1.18倍轻推镜头与氛围文案；不改变生命、资源、时间或存档机制。
- [x] 同一A模型离线导出：无人物场景、真实表面数据、分层外景、能量体、八向站立/行走/坐姿。
- [x] 同源导航：真实断口与回廊、上下层、西坡、设备足迹；投影输入适配原WASD。
- [x] 动态肩灯、角色受光/遮挡、四板交叉深度与状态响应复核；体积透明合成修正。
- [x] 正式主菜单、六站、坐下/起身、出击放弃归来、暂停/读档重入实测；释放路径代码复核。
- [x] 生产构建、纯移动/资源/共享Player回归；QA与现状文本已收口，依持续授权本地提交。

## 制作与接入

作者源保持在 `docs/art/demos/purification-last-light/` 与 `purification-forecourt-options/option-a.ts`。`tools/last-light/export.mjs`导出至`public/assets/last-light/`；运行时仅载入正式资源，不能在浏览器执行离线光线烘焙。`export-layout.mjs`从同一作者几何生成行走、足迹与观察数据。

`LastLightVisual`负责Phaser资源/纹理生命周期；`LastLightRenderer`消费材质、法线和深度计算移动肩灯与人物受光，组合核心能量、污染/炉光及分层景观；`LastLightLocomotion`保有真实世界位置与所在楼层，只把投影脚底转换为原业务角色坐标。六处经济、保存及出击事务仍由原场景负责。

本轮外景抽为`src/art/last-light-exterior.ts`，`tools/last-light/exterior-export.mjs --install`只补各层光场/材质字段，独立登记exterior来源，不篡改旧静态资源烤制来源。灯影由`last-light-shadows.ts`、步态由`last-light-gait.ts`负责；各自通过与整景体验通过分开记。

正常入口为项目根`index.html`（本地 `http://127.0.0.1:3027/`）。[动态复现页](../art/demos/purification-motion-review/index.html)使用正式Renderer、素材、真实step和gait，不写存档；它用于复现动作/灯影/外景，不替代正式入口或六站业务验证。原比较页与作者查看页保留历史用途。本轮人物修复见[角色QA](../qa/iteration-30-last-light-actor.md)，上一轮阴影/外景记录见[动态QA](../qa/iteration-30-last-light-motion.md)，原接入功能范围见[生产QA](../qa/iteration-30-last-light-production.md)。

## 边界

本次只把获选据点场景做正式接入；Rift低精度角色、俯视地图、战斗和既有经济/存档字段保持。I28长期供给/平衡仍挂起。残骸仅供坐下，无第七个功能站、恢复收益或等待玩法。兼容降级若启用必须可诊断，不能宣称与正常GPU画面一致。

当前整改不扩验修复/购买交易、全成长/供奉组合及全随机Rift世界。11胶囊仍是人物体积近似，不称完整人体网格光追；fallback未实机覆盖。外景atlas磁盘约2MB，解码单份约80.7MB，本轮约120fps为本机短时样点，不是性能基准或长期稳定性证明，GPU内存画像仍未完成。

必要检查后依持续授权本地提交，不推送，不纳入独立`CLAUDE.md`改动。
