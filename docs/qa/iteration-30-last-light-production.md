# I30 Last Light 正式接入验证

> 后续用户指出阴影、外景与太空步问题；本页保留 e05e9a8 接入时的功能检查，不代表画质通过。阴影/外景的历史整改见[动态整改 QA](iteration-30-last-light-motion.md)，当前人物与步态证据见[角色 QA](iteration-30-last-light-actor.md)。

## 2026-09-28：边界斜向移动与朝向修复

主 COH-F006。用户指出净化点各边界和坡侧斜向移动卡帧；**IMPLEMENTED / LOCAL-VERIFIED**，已修正运行时碰撞和朝向计算，不改步态、图集资产或场景几何。

独立固定60Hz的744组轨迹复现没有发现反复零/非零位移造成的gait重启；已找到外沿实例的整帧净位移方向139.25°、人物朝向却为−15.35°，相差154.6°。旧实现让最后0.5原生像素子步覆盖整帧朝向，碰撞时还丢弃触碰前本可自由行走的距离，造成朝向错位与速度不均；不能因用户描述为“卡帧”就直接改动画时钟。

当前修正保留子步和真实楼层/完整脚圆候选检查，脚圆连续求首触点，先消费自由行走段，再沿接触切线消费剩余位移；圆形设备按真实圆形求接触，最终朝向统一取整帧实际净位移。坡侧、外沿和障碍仍不可穿越，不缩碰撞体或吸附角色。

- `check-boundary-motion`覆盖6683帧通过，包含主层/坡面/上层/圆设备、固定和不均匀帧时间、整帧朝向、完整脚圆、直边分帧稳定、持续顶住后静息及真实屏幕八键；最大朝向误差0°。旧runtime在同一新回归中以154.592°错位失败。独立11365个合法移动步骤未发现不安全终点、NaN或逆输入倒退；见[边界回归](artifacts/last-light-boundary/motion.json)。
- 原`check-movement`10组通过，包括坡顶13条全宽双向通路；`gait`、`facing`、类型检查及生产构建通过，见[导航回归](artifacts/last-light-boundary/navigation.json)。没有改步态、资产或几何，也没有借改动画掩盖碰撞问题。
- 正式Renderer/真实movement受控复现共4例（外沿、坡下结构边、箱角、坡侧），每例从0.8到3.28秒每80ms取样32实帧。这些是确定性时间seek回放，使用正式movement/gait/Renderer/资源；动画播放速度不是实时帧率测量，见[证据说明](artifacts/last-light-boundary/README.md)。[接触对照](artifacts/last-light-boundary/contact-sheet.jpg)已实际复看；动画：[外沿](artifacts/last-light-boundary/outer.webp)、[坡下结构边](artifacts/last-light-boundary/ramp.webp)、[箱角](artifacts/last-light-boundary/prop.webp)、[坡侧](artifacts/last-light-boundary/slope.webp)。坡下结构遮住身体，该例只确认灯光连续，不声称完整角色动作可见。
- [浏览器状态](artifacts/last-light-boundary/browser-states.json)含4例各0.8/1.6/2.4/3.2/4.032秒共20样点：外沿、坡下结构边和坡侧前4点持续移动、朝向与整帧净位移误差0；4例在4.032秒均idle/moving=false。箱角例持续顶住后在1.6秒前进入稳定idle，不能把正常被箱角挡住说成继续滑行。复现页seek的极小尾帧覆盖诊断问题也已修正，状态保留最后真实步进帧。

复现页warning/error为空。本轮边界实景证据全部属于正式Renderer受控回放，不写存档、不等于正式根游戏键盘/六站业务全程；用户整体手感仍待复看。旧坡顶和角色动画验证只保留各自历史范围。

## 2026-09-28：西坡顶全宽通行修复

主 COH-F006，关联 F042。用户截图指出坡顶通行区太窄、角色卡住。**IMPLEMENTED / LOCAL-VERIFIED**：作者几何、导航与整景/外景光场重烘焙完成，正式移动回归和正式Renderer受控实景通过；根游戏入口仅检查加载继续，当前存档进入Rift，不计净化点跨坡验证。

根因是旧上层最后一块三角面斜切侵占西坡顶部左半。坡宽1.9m、角色脚圆半径0.22m，沿坡向参数t=0.95时合法横向范围只剩u∈[−0.30, 0.70]，顶后t=1.01左侧仅到−0.10；自然屏幕W可在世界(2.746, 2.4823, −4.0798)卡住。旧沿中线到达上层的检查漏掉了完整脚圆在坡顶全宽的支持。

作者`environment.ts`已把上层前缘改为与坡顶共线的2.6m完整承接边，覆盖1.9m坡宽及左右各0.35m余量，重新导出同源导航。坡度、角色及设备保持，不以缩脚圆、传送或吸附中线绕过缺面。正式导航为249个行走三角形、29285个观察遮挡三角形，仍6站、17障碍。

- 完整`export`→`exterior-export --install`已完成，随后`check-assets`、`check-facing`、`export-layout --check`、`exterior-check`、类型检查及构建通过；构建仅保留既有大chunk提示。角色六张PNG的SHA与`2b2b98a`完全一致，人物metadata除来源哈希外深比较相同，角色动作未因场景重导发生变化。
- `check-movement`共10组通过，新增自然屏幕W原卡点反例及13条覆盖约1.45m可用中心宽度的双向通路，包含两翼转身、完整脚圆截面支持与坡侧不可穿越。旧layout在同一新增W用例中失败，确认检查能拦截原缺陷；见[正式导航回归](artifacts/last-light-landing/navigation.json)。早期9路/147点内存实验由这份正式检查替代，不混称为浏览器键盘通行。
- 正式Renderer、正式资源及真实movement的`landing`受控回放，0–11.52秒每0.48秒取样，共25实帧；复看左右上坡、下坡及上层转身的跨层状态与画面，控制台warning/error为空。它不写存档，是受控真实移动回放，不能冒称正式根游戏键盘全程。证据：[通行回放](artifacts/last-light-landing/traversal.webp)、[同帧状态](artifacts/last-light-landing/states.json)、[坡顶承接](artifacts/last-light-landing/upper-landing.png)。
- 正式根页加载并点击继续无控制台错误；用户最新存档是进行中的Rift，因此继续后进入Rift。未放弃或重置存档，本轮没有正式根页净化点键盘跨坡证据；所有新浏览器跨坡结论只归上述受控回放。六站业务与Rift全链未重验，历史中线或业务通过不代签本轮范围。

## e05e9a8 正式接入（历史）

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
