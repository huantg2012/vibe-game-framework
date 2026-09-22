# I30 R4：材质与运行光影

日期：2026-09-22。实现基线`09d37a9`。主功能COH-F042，关联F026/F006/F039。状态：IMPLEMENTED / INTERNAL-VERIFIED-WITH-LIMITS，待人审。

## 本轮范围

- 墙/地面增加依附工作区和实体接缝的材料层：矿物涂层、旧粘结、骨料、回收窄盖、磨耗。保留布局和六物主体。
- 统一核心、培养藏、净化器、小壁灯的源强与接收；地面按同源楼层/坡道/底座裁切，墙/装置面按真实透明纹理和原材亮度接光。核心/净化器取公开健康状态，活动分频。
- 人物短影背离光源并裁在可走面；净化点使用原动画灯锚，关闭重复Aura地面池。Rift默认灯池保持。
- 首轮独立审查发现同心宽光圈、围底修补半环、孤立补块；一次修正收窄光区、改24档、痕迹接回构造并打断重复。初始证据留在`first-pass/`，最终源码见`presentation/`和`lighting-runtime/`的指纹。

## 验证结果

### 真实按键与状态展示

[正式入口回归](artifacts/iteration-30-r4/runtime/manifest.json)：新隔离浏览器，从菜单进入；六处真实E打开、移动冻结、Escape关闭；核心前后遮挡及实底座绕行、中央坡道横移/停止/反向和东坡下降；正式裂隙入口Shift+Enter，Rift中W/D仍可移动。无运行错误。该轮无授予物品、传送、改时钟或手写存档。

[表现/生命周期](artifacts/iteration-30-r4/presentation/manifest.json)：正常四机位及第三次重入；另从本轮新档仅改三个公开模块HP生成受损fixture，取四机位。六物+五环境纹理各一份；三次菜单重载释放旧key、数量稳定。CDP先校准静态绘制实际调用，再验证普通idle和移动窗口零重绘。正常2.5秒样本150帧，p50约16.7ms、p95约17.6ms；采样时无截图/CDP覆盖/构建并发。这只是单机短时观察，不承诺全硬件性能或长期无泄漏。

最终画面：[正常全景](artifacts/iteration-30-r4/presentation/normal/01-main.png)、[核心聚焦](artifacts/iteration-30-r4/presentation/normal/02-core-focus.png)、[上层西](artifacts/iteration-30-r4/presentation/normal/03-upper-west.png)、[上层东](artifacts/iteration-30-r4/presentation/normal/04-upper-east.png)、[受损](artifacts/iteration-30-r4/presentation/synthetic-damage/01-main.png)。主代理与独立美术子代理亲看；艺术判断与限度归[正式审查](../reviews/2026-09-22-purification-light-material.md)，不以截图存在宣称PASS。

### 动态与共享角色接口

[动态专项](artifacts/iteration-30-r4/lighting-runtime/manifest.json)从空存储真实新游戏出发：

- 约2.38秒内四源强度实际变化，地面、墙、活动尘粒以及三发光设备的Graphics缓冲均发生变化；源均有非空地面和墙接收段。
- CDP校准初次六物绘制后，idle/朝向/绕行普通窗口无设备重绘，六张纹理哈希保持。声明的是绘制提交和缓存事实，不代表动态节奏已经用户认可。
- 四向按键逐一验证getLampWorldPosition与原Aura glow坐标一致、POST_UPDATE传递最新灯锚；净化点原Aura地面池隐藏，人物仍不透明。
- 真实步行至核心两侧，解析实际提交的1px短影扫描线，验证影子像素背离核心、重心换边、长度有限。[右侧](artifacts/iteration-30-r4/lighting-runtime/02-core-shadow-right.png)与[左侧](artifacts/iteration-30-r4/lighting-runtime/03-core-shadow-left.png)由主代理亲看。
- 正式进入Rift后原Aura地面池恢复可见，externalGround=false，旧净化点设备纹理与新增灯Graphics全部释放。

技术代理复核发现整数坐标负向端点的网格射线可能越过终点，使合法站位短影消失；改为源/目标像素中心，补5个实际失败坐标。另把“加厚”确认从培养藏光源排除，保持三模块职责。

### 纯检查与构建

- `node --import tsx tools/qa/check-i30-light-field.ts`：**51项通过**，包括同层/坡面、空洞/底座、源自身底座豁免、真实纹理alpha/黑腔/自发光排除、材质响应、24档衰减与方向影/整数端点回归。
- 既有`check-i30-floor-light.ts`：**19项通过**；`check-i30-chamber-movement.ts`：**8024项通过**。
- `npm run build`：通过，320模块；保留既有大chunk提示。`git diff --check`通过。
- 最终证据开始/结束源码指纹一致；动态专项还覆盖共享Player/Aura以及新增光场/接入源。最终源码摘要见[source-hashes](artifacts/iteration-30-r4/source-hashes.json)。

## 收尾与边界

架构登记两层光场编译/接入职责、实际灯锚、资源释放；移动spec只补只读接口和净化点opt-in，无机制/数值/保存格式变化。未改DOM/HUD/菜单；世界内像素施工按pixel-models，独立美术复核留完整原始观察。任务、专业审查目录和现状文本/证据同步；HTML全貌仍为按需快照。

本轮未验证自然重伤/修复购买全链、初见导航、专门音频、成长获得感和长时间观感。大墙面、外部残构的塑造仍偏概括，维护叙事仅部分成立；保留用户80/75/50历史评分，I28长期采样/平衡继续挂起。按持续授权本地提交，不推送，独立CLAUDE.md修改不混入。
