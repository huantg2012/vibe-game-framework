---
status: LIMITED-VERIFIED / HUMAN-REVIEW-PENDING
created-date: 2026-09-23
features: [COH-F042, COH-F026, COH-F006, COH-F033, COH-F039]
---

# QA Report：I30 R10 三层外景与人物驱动视差

日期：2026-09-23。验收基准：用户本轮指定的近接触／隐约中景／几乎不可视但偶发存在的远景，及 [外景合同](../art/purification-exterior-r10.md)、[净化点系统](../specs/system-purification-impact.md)。本报告不继承 R9 的审美结论；R9 外景已被用户明确否决。

代码版本：`21a70b9` 加最终 R10 工作树，10 个相关源文件的 SHA-256 见 [最终 manifest](artifacts/iteration-30-r10/runtime/manifest.json)。验收窗口 2026-09-23 11:36:22–11:39:24 UTC；视频与最终功能批次源指纹一致。环境：macOS Google Chrome、Playwright headless、1440×960 视口、`http://127.0.0.1:3026/`。两个隔离空存储上下文都从正常主菜单实际按 Enter 进入净化点。read-only 诊断用于按已知路线导航，不代表初见导航；不注入存档、位置、资源或生产时钟。

证据类型：静态读取、自动断言、真实按键运行、实帧观察分别记录；索引登记 `COH-E-I30-R10-RUNTIME`、`COH-E-I30-R10-AUTOMATED`，美术复核单列 `COH-E-I30-R10-REVIEW`。

## 检查范围

- 在主层真实横向／纵向走动，记录三层实际 Image／Mesh 位移与相机。当前合同采用**固定室内为零视差基面**，中远景相对室内的补偿逐级增大；不能误用平移相机中“近景屏移更快”的断言。
- 近层两处根锚周围实际网格顶点保持固定；中远层不牵动室内。静止后不持续漂移；打开／关闭装置聚焦不额外改变外景世界变换。
- 真实双坡上下循环、暂停冻结、系统减少动态、三次菜单载入的资源计数与正式进入 Rift 后释放。
- 一段正常速度、真实按键、20–40 秒视频及四张路线关键帧；自然时间至少观察一次远景存在窗口。受控相位若另做，必须单列。

## 结果

本轮限定功能与边界检查通过，未发现遗留阻断 Bug。用户的画面终审仍待进行。最终 [运行明细](artifacts/iteration-30-r10/runtime/checks/observations.json) 与 [自然录像](artifacts/iteration-30-r10/runtime/natural-video/natural-walk.webm) 对应同一套生产源指纹。

- **三层实际响应**：真实 A 横移的逻辑屏幕补偿为 near −2.436／middle −6／far −9px；W 纵移为 −1.638／−3／−6px。近层取真实 Mesh 顶点，其他层取实际 Image 与相机投影，不仅检查声明权重。正常相机保持固定，两根锚周围网格单元顶点偏移全部为 0。
- **静止与聚焦**：停步收敛后继续观察 1.1s，无自主层漂移。核心 E 聚焦／冻结输入／Esc 关闭过程中，三层世界变换与裁切保持，镜头正确返回；近层顶点未因面板镜头移动跳变。
- **正式交互链**：真实步行访问六处并实际 E 开关；左坡上行、右坡下行回主层。裂隙备行实际 Shift+Enter 后进入活动中的 Rift。此轮不冒称重新验证了全部 Rift 战斗或归返分支。
- **暂停、减动、生命周期**：Esc 1.1s 期间外景时钟、视差及存在状态冻结；减少动态下无闲置漂移、远景存在隐藏。三次菜单载入保持场景 65 个对象、外景 8 个对象、所属纹理 20 张、全局纹理 278 张。进入 Rift 后所属纹理清空、chamber 置空、共享 mask 与离屏 Graphics 均释放。有限三次重入不等于长期无泄漏证明。
- **作者画布边界**：四个借用者共享实际 GeometryMask；Graphics 原点 (0,0)，真实绘制指令为 640×400 矩形，聚焦时仍为世界空间。1440×960 最终截图的 y15 与 y945 两条外部边带，各 1440px 均为 void RGB(8,11,16)，没有延展条纹。
- **运行错误**：最终视频与功能上下文 `pageerror` 均为空。

最终 `npm run build` 由 Director 在 freeze 后执行：退出 0，TypeScript 与 Vite 5.4.21 构建成功，335 modules／19.02s；仅既有 >500kB chunk 警告，未落盘完整终端日志。`git diff --check` 退出 0。运行时 Code 的 5,349 项视差／根锚／自然时间合同和 7,811 项既有移动检查通过；Art 最终修正后的 `tsc` 与同源外接 1,544 项通过（rear receiver 397／path 62，east receiver 509／path 57）。这些由各执行者交付，QA 未重复冒称亲自运行。`package.json` 无 `npm test` 脚本。

## 自然画面证据

[最终视频](artifacts/iteration-30-r10/runtime/natural-video/natural-walk.webm) 总长 **37.36s**，含标题／过渡；正常游戏段 **31.111s**，为真实按键横纵移动与双坡循环。编码为 1440×960／25fps，**编码帧率不是游戏 FPS 认证**。

四张路线关键帧：[出生](artifacts/iteration-30-r10/runtime/natural-video/01-spawn.png)、[左坡](artifacts/iteration-30-r10/runtime/natural-video/02-left-ramp.png)、[上层](artifacts/iteration-30-r10/runtime/natural-video/03-upper.png)、[环路返回](artifacts/iteration-30-r10/runtime/natural-video/04-loop-return.png)。自然视频采样覆盖 elapsed 11.315s、phase 0.454、alpha 0.509 的存在窗口。功能批次另自然静待至 elapsed 47.747s、第二周期 phase 0.362、alpha 0.429，保存 [自然存在实帧](artifacts/iteration-30-r10/runtime/checks/natural-distant-presence.png)。没有受控相位截图冒充自然观察。

QA 亲看最终出生／上层／返回／自然存在帧，并与同段视频 23s 提取的 [消退后静止帧](artifacts/iteration-30-r10/runtime/natural-video/idle-after-presence.png) 对照：室内保持主体，近层根接续可追踪；右中暗隙存在极弱、断续的轮廓变化，不构成清楚可识别的生物。该帧来自 VP8 解码，不能作逐像素色值基准。是否“隐约但能察觉”以及空间压迫感足够，留给用户；不以 `active=true` 代签。

## 本轮发现与修复记录

| ID | 类型 | 严重度 | 描述与证据 | 位置／依据 | 状态 |
| --- | --- | --- | --- | --- | --- |
| R10-01 | Bug | Medium | 创建期 32px edge-extrude 缓冲在作者画布上下方直接显示；1440×960 实帧底部 y930–960 出现竖向延展条纹。原图保留于 [修前出生帧](artifacts/iteration-30-r10/runtime/pre-mask/natural-video/01-spawn.png)。 | `purification-chamber-visual.ts:123`；固定 640×400 作者画布与不露景片边合同。 | 已修复。共享世界裁切、像素边带、聚焦、重入及离场释放均通过最终运行。 |

首轮结果、源指纹、录像归档在 [pre-mask manifest](artifacts/iteration-30-r10/runtime/pre-mask/manifest.json)。该轮真实动作通过仍是事实，画面不能据此记为最终交付。

另保留 [测试导航中断记录](artifacts/iteration-30-r10/runtime/harness-blocked/manifest.json)：新增储藏开关后，测试夹具直走出生点被既有核心底座正确阻挡（脚底 118／314.68）。这是测试路线缺少安全绕行点，未改生产；补经 y327 通道后仅重跑功能批次并通过，最终视频保留。最终 manifest 明示两个接受批次及一致源指纹，不抹去该次失败。

## 限制

本轮只验新增外景与直接关联入口／移动／生命周期；不重验成长经济、自然供奉、长期循环、音频或全部浏览器。没有持续硬件性能、首屏 <3s 或跨浏览器认证。单次自然窗口也不能证明长期节奏质量。本轮未修改 UI/HUD 样式，聚焦与暂停只做受外景变换影响的增量回归，不重新代勾 U1–U12 审美。本轮无新玩法 CSV 条目。

建议在当前冻结版本请用户亲自走动、停留观察三层与暗隙。人审负责画面美感、压迫感和纵深是否达到期待；既有 R9 人审否决保留，本报告不提升整体审美或旧评分。
