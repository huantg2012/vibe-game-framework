---
status: READY-FOR-REVIEW
updated: 2026-09-17
scope: 独立2D世界生成样板，基于裂隙世界空间设计
---

# 裂隙图志

用户要求实际地图，并明确本轮以最便捷方法验证，不受旧项目内容和画法约束（世界观背景除外）。本入口独立生成地图、渲染和移动，复用正式角色像素与灯光曲线，不接正式存档或战斗。旧 `world-study.html` 方向画廊保留。

入口：`/rift-worlds.html`。支持 `world=ash-strata|crystal-fibre|ivory-basin`、`topology=loops|channels`、`seed=0..4294967295`、`view=overview|walk`、`field=1|0`。默认步行并开启视野；`field=0`仅供关闭遮蔽检查材料。

- 1 / 2 / 3 切世界；相同 seed / topology 保持同一布局，比较材料与形体表达。
- R 换种子；顶部可直接输入种子、切换两类空间组织。
- WASD / 方向键移动；Space 回到角色；拖拽观察，滚轮缩放。基础移动复用正式常量：80px/s、起步0.08s、停步0.10s，斜向归一化；Shift没有加速。默认步行镜头1.5倍，与正式Rift一致。此样板未模拟负重/混乱等速度修正。
- 全图用于结构观察；步行默认使用前向灯光＋环身弱光，空洞截断视线，视野外全黑。使用正式 `fieldVisibilityAt` 与32级强度，几何裁剪由本图 `light-field.ts` 负责，尚未接入完整生产 `VisibilitySystem` 的混乱/技能变化。

实现分工：

- `data/rift-world-profiles.csv` → `tools/map-preview/codegen-world-profiles.mjs` → `src/generated/rift-world-profile-data.ts`。
- `src/generation/world-study/`：独立世界配方、确定性地貌、组织场与纯像素渲染。
- `src/dev/world-study.ts`：移动/碰撞、镜头、稀疏动效、URL与查看控件。
- `src/entities/player-sprite-dense.ts`：公开同源RGBA入口，正式atlas和此预览共用，玩家不受世界色板换色。
- `src/generation/world-study/light-field.ts`：方向光场、空洞遮挡、局部缓存。
- `material-field.ts`：插值已有沉积量与方向，地面、碎屑和断缘共用同一连续材料分布。
- `material-response.ts` / `material-light.ts`：烘焙时记录晶面/釉面上的稀疏反射点；步行按光源方位着色，再过同一份视野遮罩。
- `movement.ts`：基础启停数学；从正式 `GAME_CONSTANTS` 取值，与实际 `Player.stepVelocity` 做一致性验证。
- `tools/map-preview/check-world-study.ts`：生成质量检查；`tools/world-study/capture.mjs`：实际浏览器输入和截图。

本轮先验证三种材料表达与两种空间组织能够交叉生成，以及种子变化和实际步行。设计稿的24项维度并未因此全部实现；完整敌人/交互语义、多种改写算子、配方搜索与内容入库仍是后续工作。

## 实际验证

- `npm run build`：TypeScript 与 Vite 构建通过，独立页面加入构建入口。
- `npm run check:worlds`：96 个几何样本验证确定性、连通性、出生/出口净宽、配方与布局独立、换种子和换结构实际改变布局；另对 12 个样本用实际半径 6 的九探针身体、8px 寻路格和 2px 移动采样验证连续形状的出生→出口可达。
- `npm run preview:worlds`：同一真实生成/渲染模块导出六张 1792×1216 地表；逐像素检查无彩世界的 R/G/B 相等、全部空洞与外空像素为不透明纯黑，且每个反射像素都落在陆地上。导出及逐像素验证约1.3–1.5秒，步行使用缓存。
- `npm run capture:worlds`：真实浏览器截图、三种世界的键盘移动与合法落点、持续向边缘移动时被阻挡、基础80px/s、Shift不加速、松键停步、默认1.5倍镜头、换种子及滚轮缩放；记录见 `docs/qa/artifacts/rift-world-study/browser-check.json`。脚本使用本机 Chrome 与已安装的 Playwright，默认开发端口 3011，可用 `GAME_URL` 改地址。
- `tools/world-study/check-runtime.ts`：32帧玩家与修改前正式atlas逐像素散列一致；固定测试场验证空洞无受光面、不透光、绕过后显露、前后向差异与环身弱光。
- `tools/world-study/check-movement.ts`：320组输入/帧间隔与正式 `Player.stepVelocity` 实际方法对照，覆盖转向、斜向、启停与Shift；纳入 `check:worlds`。
- 本机浏览器短测：三种场景开灯移动各采30个帧间隔，中位数16.7ms、P95为16.7–16.8ms（约60fps）；这是此设备短样本，未作长期性能结论。
- 地表轮廓显示和碰撞共用 `shape.ts` 的连续形状采样；可行走小装饰属于地表痕迹，不额外制造隐形碰撞。

证据保存于 `docs/qa/artifacts/rift-world-study/`。截图与检查不代替人的画面终审。

## 本轮反馈与落地

2026-09-17 的四条反馈均已落实：恢复正式角色；将原石板障碍改为空洞；晶体有独立切面和外轮廓；地面加入三尺度材料场及局部碎片。釉原保留亮釉色调并增加开片与剥落；灰层加强定向沉积；晶化床用埋入地表的碎面和低矮晶簇。形体均在陆地，空洞内部不绘立面或材质。

进一步的地面打磨把独立噪声/撒点组织成同一份材料分布：层原连续层理、晶化区的大/小晶面、釉层完整区与剥落前缘。降低均匀细噪声；碎片大小与出现概率解耦。晶面与完整釉面可随角色位置产生微弱反光，空洞仍不参与受光。基础移动及镜头同步正式常量。

独立实图复审确认地面组织有所进步，同时指出灰层板/釉壳像可穿立石、层板重复、部分釉面太平。修正为地面内嵌的低对比断层及单面破釉片，减少平行堆叠；釉面补低对比厚薄、稀疏细裂与不完整收边。仍需人判断最终质感和通行读法；长带结构的节点内容不在本次地表打磨范围内。未引入实体大石头的第二种阻挡语义，也未标成最终美术批准。
