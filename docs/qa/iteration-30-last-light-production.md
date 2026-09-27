# I30 Last Light 正式接入验证

2026-09-27 · **IMPLEMENTED / LIMITED-VERIFIED**。主 COH-F042，关联 F026/F006/F039。既有母版认可不自动等于本次正式游戏的人审通过。

## 授权与实现

用户选择 A 断裂回廊、认可新版左前裂隙，要求再次收口并直接入游戏。裂隙从原宽72%进一步收至52%，最宽0.6864m，位置、高度与回廊保持。正式入口为根 `index.html`（本地 `http://127.0.0.1:3027/`）；比较页仍保留72%的历史截图。

同一作者几何导出正式像素、分层景观、材质/深度、56帧人物和导航。运行时不执行离线烘焙。六处业务、存档及出击结算保留；残骸坐下只改变姿态、镜头和文案，无恢复收益。净化点独立呈现人物，共享输入及Rift默认呈现保留。

## 自动与独立核查

- `npm run build`：TS及Vite通过。仍有既有大chunk提示，不作性能已全验的证据。
- `node tools/last-light/check-player.mjs`：真实共享Player输入/冻结、外部呈现关闭旧灯晕/残影/持具、销毁重建及Rift默认路径通过。
- `node --import tsx tools/last-light/check-movement.ts`：7组通过。覆盖六站与坐点的0.22m足半径、出生→左区、断桥往返、单西坡上下往返、断口/跨层交互/高速穿透拒绝、归一化八向速度与暂停上限、实际3D观察。最终本机1000次移动+六交互均值约0.255ms，仅为该纯算法测试。
- `node --import tsx tools/last-light/export-layout.mjs --check`：250行走三角形、2桥面三角形、17足迹障碍、29294观察遮挡三角形，与作者源一致。
- `node tools/last-light/check-assets.mjs --write`：尺寸、源哈希、全资源校验、无烘焙人物/肩灯、33固定光源、7核心/3裂隙发射点、56人物帧和真实步态、法线深度覆盖、52328静态遮挡三角形通过。[资源记录](artifacts/last-light-production/assets.json)，[移动记录](artifacts/last-light-production/movement.json)。资源清单SHA256：`3369dd3cbce7d75e2d272a390071c41fa68210e3fc60b84ca632048ae0a89124`。
- 独立渲染核查：四张板先按视差后深度组合，MRT输出实际最近不透明深度供人物使用；肩灯/投影仅接收在当前可见据点材质上。能量体在人物之后按当前帧透明度组合，不再拿多帧密度外包络硬遮挡人物。旧复现点恢复72个全透明区人物像素及338个部分透射像素；限定源码与离线数据验证。
- preload包含新增培养藏/净化器独立光场；新增GPU纹理走统一destroy，未见遗留独立RAF或监听。无长时堆内存采样，不能等同泄漏压力测试。

## 正式浏览器实测

在根游戏页使用正常点击、WASD/E/Esc操作，不调用传送、改库存或隐藏指令。开发期DOM只读诊断提供位置、楼层、面板、镜头状态。测试从本轮创建的空白记录继续；一次放弃出击按原机制消耗测试记录中的初始撬棍。

1. 主菜单继续→新净化点，`lastLightRenderer=webgl2`。最终新标签的warning/error为空；此前资源导出未完成时的临时加载错误不再出现。
2. 左侧裂隙→备行，初始撬棍正常装配→踏入Rift。原低精度角色、灯、撬棍与Rift HUD显示；暂停→放弃→明确二次确认→结果→R归来，原首次免冲击结算出现，载入后未重复结算。
3. 净化器、供奉分别步行抵达并打开原面板。薪柴不足时原禁用规则保留，未伪造投入交易。
4. 经西坡实走至 `route=upper`，培养藏与储藏可接近并正常打开面板。旧横跨楼层交互不作为通路。下坡往返由纯移动回归覆盖，本次浏览器未重复完整回走。
5. 从主层沿A真实桥面分段步行到核心，途中世界高度约0.057m，终点正常显示核心完整度70/100及投入面板。未穿越中间断口。
6. 净化点Esc记录菜单→载入已保存记录，场景重新创建正常。六站焦点镜头关闭后回归默认，业务面板可继续使用。
7. 炉旁残骸E坐下，角色保持合法操作位置，视觉切坐姿；镜头1.18倍、scroll(14,21)，显示“石头还是冷的。火还没有熄。”；E起身移除文案，恢复1倍镜头和原站位。

本机运行样点约119–121fps，仅是当前浏览器与窗口下的短时观测，不代表跨设备性能承诺。[核心聚焦](artifacts/last-light-production/core.png)、[坐下](artifacts/last-light-production/rest.png)、[备行](artifacts/last-light-production/preparation.png)、[储藏](artifacts/last-light-production/storage.png)、[Rift](artifacts/last-light-production/rift.png)、[暂停](artifacts/last-light-production/pause.png)、[最终默认镜头](artifacts/last-light-production/final.png)。

## 限定边界

没有重新验证全随机Rift世界、长期经济、全部成长/修复交易组合或人类初见体验，I28仍挂起。据点人物保持相同身份，但本轮未额外生成所有装备的持具外观；Rift原持具仍在。人物投影为有限胶囊近似，并非实时完整模型阴影。无WebGL2的Canvas路径为明确诊断的兼容降级，未做本轮强制失效实机验收，不冒充正常GPU艺术质量。

源码与必要检查完成后依持续授权本地提交，不推送；独立 `CLAUDE.md` 改动排除。
