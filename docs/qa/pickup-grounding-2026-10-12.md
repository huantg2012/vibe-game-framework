# QA Report：六世界翻找物环境融入

日期：2026-10-12。Feature IDs：COH-F019、COH-F012、COH-F013；关联 COH-F044、COH-F007。

**结论：本轮有限范围的生成、数据传输、状态事务和六图实景接线通过，尚不能宣布完整 P3 或用户视觉终验通过。** 未发现这些已执行检查中的未修复阻断性产品问题。六图之外的 102 世界推广继续暂停。

## 依据、版本与范围

基准为[设计方案](../design-notes/pickup-grounding-plan.md)、[美术合同](../art/pickup-grounding.md)、[来源部署 spec](../specs/system-map-generation.md#grounded-search-sites)与[翻找 spec](../specs/system-chaos-scavenge-extract.md#grounded-search-sites)。本轮不是无规格扫描。

验证对象为 `7c744d3dabdee45cafbafe375878f81bae328c1c` 加本轮工作树；HEAD 本身不含新实现。最终浏览器使用快照 `coh-spatial-browser-FPZyCi`，创建于 `2026-10-12T08:18:28.237Z`，见[源码清单](artifacts/pickup-grounding-implementation-2026-10-12/runtime/final/pale-sail/source-snapshot.json)。QA 收尾时将清单中 795 个文件与当前存在文件逐项 SHA-256 对照，无差异。静态世界资产与依赖按该清单的只读链接约束提供，不把它描述成完全独立打包。

范围仅为余烬脊、无彩层原、纤维扇流、壳缘阶串、苍帆夹道、凝胶裹纤维。新增来源数据、六图 r9、两态地表 patch 与原翻找事务的接线是验收对象；不重画已经揭晓的地面物件，不改 UI/HUD，不重新签署全游戏。

## 已执行与证据

### 构建与专项

- 最终 `npm run build` 成功，30.66 秒，见[build-final.log](artifacts/pickup-grounding-implementation-2026-10-12/build-final.log)。仍有既有的大 chunk 提示；不是本轮新增构建失败。
- 主代理执行的 TypeScript 检查成功，日志为[typecheck.log](artifacts/pickup-grounding-implementation-2026-10-12/typecheck.log)。该日志为空，成功依据是执行回执，而非由空文件推定。
- 本项目没有 `npm test` 脚本。本轮使用 `npm run check:pickup-grounding`，包含 CSV 同步、216 组纯 bake、8 组运行时边界检查，见[final-checks.log](artifacts/pickup-grounding-implementation-2026-10-12/final-checks.log)。QA 独立编写并执行了运行时套件；不把其他代理的执行说成 QA 本人重复执行。
- 纯 bake 覆盖六材质、四 seed、三个方向、三种来源关系，检查前后态高度、露底、隐藏奖励无关、VOID/实体裁切、原承托通道不变、确定性与局部更新窗。邻堆正例最初未真正重叠，QA 指出后已改为满足原 96px 间距且 80×64 窗重叠的坐标，明确断言单独烘焙重叠、合并烘焙裁开且两核心保留。修正后的纯烘焙套件再验见[final-bake.log](artifacts/pickup-grounding-implementation-2026-10-12/final-bake.log)。该问题是测试覆盖缺口，未发现对应产品错误。

### 生成、风险与旧版本

- [generation.json](artifacts/pickup-grounding-implementation-2026-10-12/generation.json)：六图 × 三档 × 两请求 seed，共 36 例，三种来源关系共 276 节点；规则验证通过。随后加强来源身份校验的最终复验为六图 × 中档 × 两 seed，共 12 例，见[generation-final-validation.json](artifacts/pickup-grounding-implementation-2026-10-12/generation-final-validation.json)。不将前一矩阵称为最终加强版的全档重跑。
- [native-validation.json](artifacts/pickup-grounding-implementation-2026-10-12/native-validation.json)：拒绝错误母体材质、虚构母体表面、未冻结 visualSeed、混入隐藏奖励字段和错误材料轴向。
- 环境适配加入原合法候选的有界评分，原风险资格、配额、间距和完整身体站位仍为硬约束。六图中档同 seed 的 48 个节点中有 **7 个位置改变**，见[deployment-comparison.json](artifacts/pickup-grounding-implementation-2026-10-12/deployment-comparison.json)。因此本轮不是“所有路线完全不变”的纯贴图替换；本报告仅确认已验证样本继续满足原规则，未做自然玩家路线难度实验。
- [freeze-contract.json](artifacts/pickup-grounding-implementation-2026-10-12/freeze-contract.json)：旧执行器及 18 个资产冻结、324 份旧 recipe 可验证，伪装为 r9 的旧数据被拒绝。另有 306 份非目标 recipe 不变、两个非目标地图输出不变的回归收据。
- [legacy-r8/replay-r9.json](artifacts/pickup-grounding-implementation-2026-10-12/legacy-r8/replay-r9.json)：六图中档既存样本的完整地图及每图四通道像素逐字节保持。**324 份是 recipe 校验数量，六份才是完整地图及材质重放数量**；不是全部旧地图均已逐像素重放，更不是全部旧存档均已浏览器冷续。

### 运行时与状态边界

详细用例和测试适配范围见[独立运行时审查](artifacts/pickup-grounding-implementation-2026-10-12/qa-review.md)。八组使用正式函数及受控 GL/DOM 适配，确认：

- Worker 接收端拒绝外来身份、缺少 patch、缺重数组、错误通道类型/长度、非法边界、重复节点和互相覆盖的更新窗；传输只转移派生数组，不 detach 原世界和材料输入。
- 同 collected 值连续 120 帧不上传；状态改变仅四次局部 `texSubImage2D`。销毁清空 patch 的 CPU 引用和 GPU 句柄，再次销毁不重复释放。
- 恢复原 collected 状态发生在首 draw 前，不插入 intact 中间帧，不从恢复入口重复揭晓或发奖励。
- surface-only visual 没有旧 pile sprite、反光纹理或 idle shimmer；只有真实 rummage/reveal 才启动既有反馈。旧 r8 路径不读取新 piles 同步、不获取 patch。
- 真实搜索事务保留 E 中断、1200ms 完成、库存拒写后同一已抽结果重试；容量不足保留原坐标物件、已翻残迹退出未翻 E 目标；冷恢复不复制物件或收入。此项证明事务，未代替物件实景可见性。

### 六图正常相机与正式低档冷续

[runtime/final](artifacts/pickup-grounding-implementation-2026-10-12/runtime/final/) 的六组报告及前后图均为中污染、请求 seed `20261012`。纤维扇流按原 admission 重试实际采用 `3956234173`，其余采用请求值。每图目标为首个 safe 薪柴节点，真实走近并按 E；翻前/后均 visibility=1、无旧 sprite，collected 从 false 变 true，材质状态上传从 0 变 1。每图 8 个 patch，占 1,310,720 字节双态 CPU 数据。

这些是正常镜头的受控内存世界巡览：使用真实身体通路和键盘，不写位置、血量、时钟、视野或奖励；但预先选择了目标并规划通路，**不是新玩家首次发现、整趟搜撤或每个节点的可读性盲测**。前后站位有小幅差异，不能作严格同像素差分。

[runtime/formal/pale-sail-low](artifacts/pickup-grounding-implementation-2026-10-12/runtime/formal/pale-sail-low/) 追加正式出发、低污染、新请求 seed `20261119`、真实暂停存档和首页继续。原脚本参数 `20261019` 与实际出发熵不同，报告现已用 requestedFixtureSeed / actualDepartureSeed 显式区分；以 recipe.requestedSeed 与 controlledDeparture.seed 的 `20261119` 为实际世界身份。该例还覆盖地床 surface-peel，六个 patch 占 983,040 字节。

QA 对比 saved-before/after：远征 identity 和完整 search 状态相等，carried=1、目标 collected=true；继续后 revealVisible=false，材质状态上传为1。继续所需的时钟、角色和 AI 等状态推进被保留，不要求整份存档逐字相同。没有新增收入或重播 reveal 的证据。正式出发仍使用一次受控随机输入选择世界，不称自然随机抽中。

### 留出种子与不同站位

[runtime/sweep](artifacts/pickup-grounding-implementation-2026-10-12/runtime/sweep/) 追加请求 seed `20261019` 的苍帆、纤维、凝胶、灰层，均为中档，包含远灯、真实走近、转身、转回、E 翻找和离开后的截图。苍帆与凝胶实际 admission seed 为 `1044084510`，纤维和灰层为 `20261019`；四例错误列表为空，collected false→true、stateUploads 0→1。

新样本覆盖三种关系：苍帆/凝胶 surface-peel、纤维 ground-accumulation、灰层 detached。该 seed 未参与前述第二版形体调优，补足三类关系的定向样本，仍不外推到整图全部位置。灰层途中有真实攻击/血量变化，不视为只改灯向的严格对照实验。

首批 sweep 在接近约 30–40px 时转身，四例 turnedAway.visibility 仍为1；因此这批转身可以观察近灯变化，**不能证明进入 FOV 外时裁切正确**。QA 指出后，主代理在相同最终源码下补充了[sweep-far](artifacts/pickup-grounding-implementation-2026-10-12/runtime/sweep-far/) 的三个强反例：远站位 before→farTurnedAway→farReturned 的目标 visibility 均为 **1→0→1**，转向阶段无状态上传，随后真实 E 仍只上传一次。三例错误列表为空，源码快照未变化。

这补足了实际远距转身时目标进入/离开可视范围的状态证据及可审阅图片。仍不以目标中心的 visibility 数值证明整个80×64窗在任意边界逐像素都正确；前景实体边的复杂接合及连续灯变的美术品质需另按实图判断。保留首批近身样本，不把其结论反写成 FOV 验证。

### 浏览器资源生命周期

[lifecycle/report.json](artifacts/pickup-grounding-implementation-2026-10-12/lifecycle/report.json) 通过：单一 Phaser Game 内完成六材预热、灰层重度两次同图重建、六材各一次低档混合重建，最后返回相同灰层场景。四次保留采样前均执行两次真实 GC；用弱引用记录对象，不由采样器持有场景。

所有保留采样的 active WebGL2 context 均为1，Texture 373、Framebuffer 69、Renderbuffer 69、Program 32、Shader 62、Buffer 11，与预热基线相同。最大主 isolate used heap 增长 958,280 字节，backing storage 增长 6 字节；控制台异常为空。此为有限重建次数内的对象所有权与内存观察，不证明长期无泄漏、不报告 GPU driver 字节或 RSS，也不是帧率测试。

## 整改、审美与剩余边界

1. 初稿旧路径无条件读取 `frame.piles` 的兼容风险已修复并由抛错 getter 回归保护；未把测试最小 frame 的风险冒称线上崩溃。
2. 首轮 Art 退回苍帆翻后完整膜片、纤维前后近似平行条；第二版按同目标实图复验关闭，灰层近照补足可读性疑点。Art 看完六图12张最终中档静帧，限定结论为这些样本没有新视觉阻断，可交用户对照；证据与首轮反证保留于[art-review.md](artifacts/pickup-grounding-implementation-2026-10-12/art-review.md)。Art随后另行看过4组留出种子的12张before/near/after与6张远处面向/背向帧，未见新增明显悬浮、前景越出或暗处残亮，补充范围单列在同一报告；仍不是用户审美通过。
3. 留出 seed 三种关系、近远/转向与远距 FOV 进出证据已补，连续灯变品质、复杂前景实体边和全部节点误搜率仍未签署。实际容量不足物件的可见可拾只具 CPU 事务证据，未在本组浏览器截图中签署。未完成项应作为验证范围保留，不能改写为已通过。
4. 生命周期有限重建已通过；fake GL 与浏览器对象释放检查均不证明真实 GPU 帧率、显存、RSS 或所有浏览器兼容性。

没有需要用户补充规则信息才能继续的技术阻塞。后续可围绕六图补足上述定向证据并由用户复看；不由本 QA 报告自动恢复 102 图推广。

## 交付与索引

[新旧实景对照页](artifacts/pickup-grounding-implementation-2026-10-12/index.html)使用原始PNG，裁去开发器外围并提供原像素局部放大；浏览器检查六图18种切换、全部图像加载和零脚本异常见[gallery-check.json](artifacts/pickup-grounding-implementation-2026-10-12/gallery-check.json)。

现状索引仅增量核对本任务文件：0格式/引用错误、0未归属；保留2个既有警告与982项历史指纹漂移，不把全库补绿或将历史验证刷新。独立CLAUDE.md改动未纳入本轮。
