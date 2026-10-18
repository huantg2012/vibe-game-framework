import { Stack, Row, H1, H2, Text, Table, Divider, Link, useHostTheme } from "cursor/canvas";

const axes = [
  ["维护", "场景、资源、输入、UI、音频与调试工具集中", "TS规则需转译，DOM与浏览器接线需重建；AI工作流不自动变便宜", "长期有条件改善 / 短期成本高"],
  ["画面", "保留像素资产，用同一环境组织动画、灯光和特效", "净化点深度合成、角色受光、VOID仍需自定义shader与规则", "可保真并扩展 / 不会自动变好"],
  ["性能", "有机会统一GPU资源、减少重复提交、改用shader受光", "生成搜索、全图计算、带宽和分配成本仍需优化", "存在潜力 / 尚无对照实测"],
  ["PC发行", "原生桌面导出、文件存储、窗口与输入路径", "Steam功能、设置、手柄、安装与目标硬件仍需交付", "与目标匹配 / 不是上架必需"]
];
const reuse = [
  ["保留", "CSV、规格、构型设计、PNG/音频、测试案例；Node离线制作工具", "图集导入、采样、色彩及元数据需核验"],
  ["转译并对照", "库存/成长/归返、AI、生成、视野/碰撞、随机序列", "逻辑可迁移 ≠ TS可原样执行"],
  ["重做接线", "Phaser场景、DOM/CSS、Worker取消链、音频封装、存储与WebGL接口", "成本集中区；不要长期保留双运行时"],
  ["另定版本边界", "冻结历史生成器与旧局精确恢复", "上次废局授权不等于允许清空所有存档"]
];
export default function GodotFeasibility() {
  const theme = useHostTheme();
  return <Stack gap={22} style={{ maxWidth: 1120, margin: "0 auto", padding: 24 }}>
    <Stack gap={6}>
      <Text size="small" tone="secondary">那天之后 · 技术选型审查 · 2026-10-19 · 基线 027641fe</Text>
      <H1>Godot 可行；建议先验证，再迁移</H1>
      <Text weight="semibold" style={{ color: theme.accent.primary }}>用户目标：PC 买断发行（Steam 等）。长期倾向 Godot，当前不建议直接启动全面重写。</Text>
      <Text>最强理由是长期维护和原生PC交付。画面自动升级、性能必然提升、AI token必然下降，都没有证据。</Text>
      <Text size="small" tone="secondary">仅源码、现有QA与官方资料评估；未制作或运行Godot版本，未批准迁移。关联F005/F007/F012/F039/F042/F044。游戏与既有挂起范围未变。</Text>
    </Stack>
    <Stack gap={10}>
      <H2>四个角度的判断</H2>
      <Table headers={["角度", "可获得的收益", "仍需承担的工作", "结论"]} rows={axes} />
      <Text size="small" tone="secondary">来源：项目架构/源码静态核查与Godot稳定版官方文档；表中收益为技术判断，不是实测结果。</Text>
    </Stack>
    <Stack gap={10}>
      <H2>现有性能证据：加载问题不等于帧率结论</H2>
      <Table headers={["世界", "污染 / seed", "入场时间（秒）", "本轮证据边界"]} rows={[
        ["余烬脊", "中 / 1", "8.123", "正式进入与冷续功能通过"],
        ["晶化林床", "中 / 0", "7.586", "正式进入与冷续功能通过"],
        ["破膜盆地", "中 / 2", "16.088", "同seed复验通过，原失败保留"]
      ]} />
      <Text>三图50ms长任务门仍未过；没有同场Godot对照、稳态帧分布或GPU计时。不能把它解读为20FPS，也不能据此承诺原生版更快。</Text>
      <Text size="small" tone="secondary">来源：2026-10-18 browser-summary.json；受控正式流程、隔离存储，每图一个中档样本，非自然整趟游玩或Windows发行认证。</Text>
    </Stack>
    <Divider />
    <Stack gap={10}>
      <H2>迁移投资：保留内容，重做运行时接线</H2>
      <Table headers={["处理方式", "对象", "约束"]} rows={reuse} />
      <Text>当前栈是 TypeScript / Phaser / DOM / 自有WebGL2 / Canvas / Worker。只有三个开放世界，并不意味着仅有三个场景需要移植；净化点、物品、成长、菜单和事务仍是完整系统。</Text>
      <Text>候选方案：Godot 4 .NET/C#核心规则 + Godot呈现 + 现有Node离线工具。仍保持CSV为数据源，不以换引擎重做美术或把Rift转成3D。C#方案若未来要求网页试玩，需要重审：目前Godot 4 C#不能导出Web。</Text>
    </Stack>
    <Stack gap={10}>
      <H2>两个判断关口</H2>
      <Text weight="semibold">1 / 真实画面片段</Text>
      <Text>破膜盆地固定配方：A人物、类人、菌毯、地表、VOID与肩灯；另取净化点坡道和前后遮挡片段。同机、同画面、同路线比较发布构建，分别测CPU/GPU、p95/p99帧、内存和加载。保真优先；不把预烘焙省下的成本冒充引擎收益。</Text>
      <Text weight="semibold">2 / 一张图的完整循环</Text>
      <Text>备行 → 搜取/遭遇 → 撤离或死亡 → 归返 → 保存/冷续。恢复真实生成和准备链，再比较同类玩法修改、视觉修复所需工作。通过才迁另外两图及剩余系统；失败就停止扩迁。</Text>
    </Stack>
    <Stack gap={10}>
      <H2>仍然成立的替代路线</H2>
      <Text>保留现栈，统一渲染提交并优化生成，再用Electron制作PC包。Phaser官方已有Steam发行案例。它通常比完整迁移范围小，但不会消除自制渲染和浏览器平台层的维护负担。</Text>
      <Text>Godot不能代替玩法打磨，也不能免除Steam功能、手柄、设置、崩溃记录与Windows硬件验证。建议冻结稳定版本；查询时4.7.2为稳定版，4.8仍在beta。</Text>
    </Stack>
    <Divider />
    <Stack gap={8}>
      <H2>证据与完整报告</H2>
      <Row gap={16} wrap>
        <Link href="/Users/yilungao/coh/docs/reviews/2026-10-19-godot-feasibility.md">完整审查</Link>
        <Link href="/Users/yilungao/coh/docs/qa/artifacts/three-world-pool-2026-10-18/browser-summary.json">三图原始记录</Link>
        <Link href="/Users/yilungao/coh/docs/architecture.md">现有架构</Link>
      </Row>
      <Row gap={16} wrap>
        <Link href="https://docs.godotengine.org/en/stable/about/list_of_features.html">Godot能力</Link>
        <Link href="https://docs.godotengine.org/en/stable/tutorials/2d/2d_lights_and_shadows.html">2D灯光</Link>
        <Link href="https://docs.godotengine.org/en/stable/tutorials/performance/cpu_optimization.html">CPU优化</Link>
        <Link href="https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html">Web限制</Link>
        <Link href="https://docs.godotengine.org/en/stable/about/faq.html">语言、平台与许可</Link>
        <Link href="https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html">命令行构建</Link>
        <Link href="https://partner.steamgames.com/doc/sdk/api">Steamworks</Link>
        <Link href="https://phaser.io/news/2025/03/publishing-web-games-on-steam-with-electron">Phaser桌面发行</Link>
        <Link href="https://godotengine.org/download/archive/">版本归档</Link>
      </Row>
    </Stack>
  </Stack>;
}
