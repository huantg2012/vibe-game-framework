import {
  BarChart, LineChart, Button, Card, CardBody, CardHeader, Divider,
  Grid, H1, H2, H3, Pill, Row, Select, Stack, Text,
  useCanvasAction, useHostTheme, useState,
} from "cursor/canvas";

// Review snapshot, 2026-09-21. Inline data only; this artifact never changes the game.
const ROOT = "/Users/yilungao/coh/";
const REVIEW = "docs/qa/artifacts/growth-sample-review-2026-09-21/";
const ROUTE = [
  { step: 1, name: "生命强化", level: "1/4", cost: 8, phase: "立足", effect: "完整度上限 100 → 115", gate: "无经历条件" },
  { step: 2, name: "薪柴亲和", level: "1/3", cost: 8, phase: "立足", effect: "每堆基础薪柴 +1；之后乘储藏倍率并取整", gate: "无经历条件" },
  { step: 3, name: "供奉扩容", level: "1/3", cost: 10, phase: "立足", effect: "同时供奉 1 → 2 件；成熟速度不变", gate: "无经历条件" },
  { step: 4, name: "渗透抗性", level: "1/5", cost: 8, phase: "立足", effect: "实际自然时间混乱增速减少 4%", gate: "无经历条件" },
  { step: 5, name: "预兆洞察", level: "1/3", cost: 10, phase: "立足", effect: "辨清下次冲击强度", gate: "经历：承受冲击" },
  { step: 6, name: "生命强化", level: "2/4", cost: 12, phase: "立足", effect: "完整度上限 115 → 130", gate: "无经历条件" },
  { step: 7, name: "加厚", level: "1/3", cost: 12, phase: "立足", effect: "模块上限 100 → 115，当前完整度不变", gate: "无经历条件" },
  { step: 8, name: "薪柴亲和", level: "2/3", cost: 12, phase: "整备", effect: "每堆基础薪柴加成 +1 → +2", gate: "无经历条件" },
  { step: 9, name: "预兆洞察", level: "2/3", cost: 20, phase: "整备", effect: "进一步辨清重点装置", gate: "无经历条件" },
  { step: 10, name: "供奉扩容", level: "2/3", cost: 20, phase: "整备", effect: "同时供奉 2 → 3 件；成熟速度不变", gate: "无经历条件" },
  { step: 11, name: "渗透抗性", level: "2/5", cost: 12, phase: "整备", effect: "实际自然时间混乱增速累计减少 8%", gate: "无经历条件" },
  { step: 12, name: "出击扩容", level: "1/1", cost: 40, phase: "整备", effect: "2 → 3 主动位；仍仅 1 被动位，重量照算", gate: "无经历条件" },
  { step: 13, name: "生命强化", level: "3/4", cost: 18, phase: "整备", effect: "完整度上限 130 → 145", gate: "无经历条件" },
  { step: 14, name: "加厚", level: "2/3", cost: 20, phase: "整备", effect: "模块上限 115 → 130，当前完整度不变", gate: "无经历条件" },
  { step: 15, name: "渗透抗性", level: "3/5", cost: 18, phase: "承压", effect: "实际自然时间混乱增速累计减少 12%", gate: "无经历条件" },
  { step: 16, name: "薪柴亲和", level: "3/3", cost: 18, phase: "承压", effect: "每堆基础薪柴加成 +2 → +3", gate: "无经历条件" },
  { step: 17, name: "预兆洞察", level: "3/3", cost: 30, phase: "承压", effect: "读取各模块防御前压力", gate: "经历：抵达退潮" },
  { step: 18, name: "供奉扩容", level: "3/3", cost: 35, phase: "承压", effect: "同时供奉 3 → 4 件；成熟速度不变", gate: "无经历条件" },
  { step: 19, name: "生命强化", level: "4/4", cost: 25, phase: "承压", effect: "完整度上限 145 → 160", gate: "无经历条件" },
  { step: 20, name: "渗透抗性", level: "4/5", cost: 25, phase: "承压", effect: "实际自然时间混乱增速累计减少 16%", gate: "无经历条件" },
  { step: 21, name: "加厚", level: "3/3", cost: 32, phase: "承压", effect: "模块上限 130 → 145，当前完整度不变", gate: "无经历条件" },
  { step: 22, name: "渗透抗性", level: "5/5", cost: 35, phase: "承压", effect: "实际自然时间混乱增速累计减少 20%", gate: "无经历条件" },
];
const TOTAL = ROUTE.reduce((sum, node) => sum + node.cost, 0);
const TAIL = ROUTE.filter(node => node.step >= 19).reduce((sum, node) => sum + node.cost, 0);
const FINDINGS = [
  {
    id: "GR-01", title: "入口真倍率绕过预兆洞察", kind: "已确认 · 信息旁路", step: 5,
    observation: "洞察 0 级时，远端预告仍写“轻微？”，贴近裂隙却出现真实“强度 x1.0”。付费辨清强度的前后差被削弱。",
    counter: "未泄露完整三层洞察：倍率有舍入，重点和伤害分配也不等于已公开。不应删除正常的入口导航与潮位线索。",
    action: "先统一公开信息投影；同一冻结预告按洞察 0/1/2/3 检查入口、报告、备行与重载。购买必须只改变读取，不改变实际冲击。",
    confidence: "高：本次隔离正式入口已复现。",
    evidence: [
      { label: "入口倍率实景", path: REVIEW + "runtime/body/06-entrance-no-forecast.png" },
      { label: "设计分析", path: REVIEW + "design-review.md" },
    ],
  },
  {
    id: "GR-02", title: "必经加厚先降低即时出击条件", kind: "设计关系 · 优先验证", step: 7,
    observation: "第 7 步仅有 12 薪柴时，投入后余额为 0；三模块从 100/100 变为 100/115，实际下次出击起始混乱为 7。补满还需资源。",
    counter: "增加的容量在之后修复后确实提供承压缓冲，且界面已诚实披露短期代价。不能将加厚判成没有价值，也不能由一次预置实验推断普遍负体验。",
    action: "比较近满/受损与仅够购买/可购并补净化器四种条件，追一次出击和归来；先判断缓冲何时有价值，再决定时机或功效参照。",
    confidence: "机制高；自然发生率与玩家接受度未验证。",
    evidence: [
      { label: "购买前完整代价", path: REVIEW + "runtime/thicken/02-before.png" },
      { label: "实际出击存档", path: REVIEW + "runtime/thicken/departed.storage.json" },
      { label: "设计分析", path: REVIEW + "design-review.md" },
    ],
  },
  {
    id: "GR-03", title: "第三主动位可能暂时没有可装内容", kind: "条件性风险 · 供给未知", step: 12,
    observation: "第 12 步花费 40，是最高单笔。若当时只有 0–2 件可用主动工具，多一槽并不产生即时装配收益；线性路线仍须经过此项。",
    counter: "拥有三件互补工具时，新槽能增加实际应对手段。它不需要掉落资格，因而不会形成随机资格软锁；自然库存不足的发生率尚未测得。",
    action: "在相近预算下比较 1/2/3 件可用主动工具的真实库存，记录推迟或投入理由；先看供给，再判断位置或价格。",
    confidence: "条件性结论高；自然频率未知。",
    evidence: [
      { label: "路线与条件分析", path: REVIEW + "design-review.md" },
      { label: "成长设计合同", path: "docs/design-notes/purification-growth-renewal.md" },
    ],
  },
  {
    id: "GR-04", title: "成长抗性存在两种冲突合同", kind: "规则裁决 · 不自动加强", step: 22,
    observation: "新设计写污染抗性百分点与统一正增通道；当前正式接线和 UI 表达实际仅降低自然时间混乱。离散污染未消费这项成长。",
    counter: "旧时间倍率合同及玩家 UI 支持当前行为，不能直接称代码漏算，更不能依据冲突文档擅自扩大抗性效果。",
    action: "先裁决唯一术语与公式。随后测成长 0/1/5 级的时间与离散正增、其他抗性叠加及旧在途存档。",
    confidence: "高：合同与受控机制比较一致指出差异。",
    evidence: [
      { label: "技术审查与比较", path: REVIEW + "tech-review.md" },
      { label: "生存属性合同", path: "docs/specs/system-survival-attributes.md" },
    ],
  },
  {
    id: "GR-05", title: "储藏连续倍率掩盖整数收益档位", kind: "经济表达 · 边际收益", step: 2,
    observation: "搜取按 floor((基础值 + 亲和) × 储藏倍率) 逐堆取整。亲和 0 时储藏 70→99，三类节点仍给 1/2/5；倍率却持续增长。",
    counter: "修复仍增加耐久，其他节点值或亲和级数会跨收益档。整数薪柴简洁，不应据此说储藏无用或直接改成浮点货币。",
    action: "固定亲和 0/1 与储藏 70/99/100，比较同类真实搜取；检验能否区分“只加耐久”与“跨收益档”，再决定局部预览。",
    confidence: "公式高；玩家误读频率未知。",
    evidence: [
      { label: "取整复算数据", path: REVIEW + "design-rounding-analysis.json" },
      { label: "设计分析", path: REVIEW + "design-review.md" },
    ],
  },
  {
    id: "GR-06", title: "成长对象的可见联系偏弱", kind: "艺术表达 · 动态待验", step: 1,
    observation: "文字确认刻入后迅速转到 next；身体强化和装置建设都面对同一培养藏。持久补件较小，“刚作用到了谁”主要依靠类别与数值。",
    counter: "腔内约束件、接头和模块压条是真实外显；四格供奉也有明确空间收益。不能称“没有外显”，静帧亦不能否定声音或原速仪式。",
    action: "先看一条身体与一条装置投入的原速视听链。仅在弱项成立后试局部对象回应，保留原角色、装置、快速操作和安静氛围。",
    confidence: "静态观察中高；仪式、声音、手感未验证。",
    evidence: [
      { label: "独立美术评审", path: REVIEW + "art-review.md" },
      { label: "首购后实景", path: REVIEW + "runtime/body/03-after-immediate.png" },
    ],
  },
];

export default function GrowthSampleReview() {
  const theme = useHostTheme();
  const dispatch = useCanvasAction();
  const [metric, setMetric] = useState("cost");
  const [step, setStep] = useState(7);
  const [selected, setSelected] = useState("GR-02");
  const node = ROUTE.find(entry => entry.step === step) ?? ROUTE[6];
  const finding = FINDINGS.find(entry => entry.id === selected) ?? FINDINGS[1];
  const cumulative = ROUTE.slice(0, node.step).reduce((sum, entry) => sum + entry.cost, 0);
  const values = metric === "cost" ? ROUTE.map(entry => entry.cost)
    : ROUTE.map((_, index) => ROUTE.slice(0, index + 1).reduce((sum, entry) => sum + entry.cost, 0));
  const open = (path: string) => dispatch({ type: "openFile", path: ROOT + path });
  return (
    <Stack gap={24} style={{ maxWidth: 1080, margin: "0 auto", padding: 24, color: theme.text.primary }}>
      <Stack gap={8}>
        <Text size="small" tone="tertiary">那天之后 · I29 R2 · 开发者评审摘要 · 2026-09-21</Text>
        <H1>成长路线清楚，下一笔投入先核实兑现</H1>
        <Text>线性、可读性、购买与存档在所审条件内成立；投资兑现与后段池深脆弱，暂不直接扩池。</Text>
        <Row gap={8} wrap>
          <Pill>6 项 P2</Pill><Pill>未确认 P0 / P1</Pill><Pill>审查完成 · 未实施整改</Pill>
        </Row>
      </Stack>

      <Grid columns="repeat(auto-fit, minmax(290px, 1fr))" gap={24}>
        <Stack gap={8}>
          <H2>22 步不是 22 种新决策</H2>
          <Text>固定路线共 {TOTAL} 薪柴；末 4 步花 {TAIL}，占 {(100 * TAIL / TOTAL).toFixed(1)}%，主要用于数值收口。第 18 步是最后一次新增工作能力。</Text>
          <Text tone="secondary" size="small">保留：唯一 next、只读 owned、供奉 1→4、两处经历节点、诚实的加厚代价，以及培养藏与真实场景构图。</Text>
        </Stack>
        <Stack gap={8}>
          <H2>有限验证优先</H2>
          <Text>先处理信息旁路和抗性合同，再比较加厚、第三主动位、整数收益与成长对象表达。没有证据要求把路线改回分支树或追加一批新等级。</Text>
          <Text tone="secondary" size="small">受控预置档与真实输入，不是自然积累 428 薪柴的旅程。长期采样、供给扩产、音频及动态审美的既有挂起边界保持。</Text>
        </Stack>
      </Grid>

      <Divider />
      <Stack gap={12}>
        <Row justify="space-between" wrap gap={12}>
          <H2>{metric === "cost" ? "每步投入成本" : "沿路线累计投入"}</H2>
          <Row gap={6}>
            <Pill active={metric === "cost"} onClick={() => setMetric("cost")}>单步成本</Pill>
            <Pill active={metric === "cumulative"} onClick={() => setMetric("cumulative")}>累计成本</Pill>
          </Row>
        </Row>
        <Grid columns="minmax(0, 2fr) minmax(240px, 1fr)" gap={24} align="start">
          <Stack gap={6}>
            <Text size="small" tone="secondary">纵轴：{metric === "cost" ? "本步费用" : "第 1 步至当前步的费用和"}（薪柴）</Text>
            {metric === "cost" ? (
              <BarChart categories={ROUTE.map(entry => String(entry.step))} series={[{ name: "本步费用", data: values, tone: "neutral" }]} height={240} valueSuffix=" 薪柴" showValues={false} />
            ) : (
              <LineChart categories={ROUTE.map(entry => String(entry.step))} series={[{ name: "累计费用", data: values, tone: "neutral" }]} height={240} valueSuffix=" 薪柴" fill={false} />
            )}
            <Text size="small" tone="secondary">横轴：固定路线顺序（第 1–22 步）；不对应趟数或游玩时间。</Text>
            <Text size="small" tone="tertiary">来源：2026-09-21 的 growth-route.csv + upgrades.csv；加厚费用 12/20/32 来自系统常量。仅计算成本，不含修复、不模拟收入。</Text>
          </Stack>
          <Card>
            <CardHeader>查看一步的真实费用与用途</CardHeader>
            <CardBody>
              <Stack gap={12}>
                <Select value={String(node.step)} onChange={value => setStep(Number(value))} options={ROUTE.map(entry => ({ value: String(entry.step), label: `${entry.step}. ${entry.name} · ${entry.level}` }))} />
                <H3>第 {node.step} 步 · {node.name}</H3>
                <Text weight="semibold" style={{ color: theme.accent.primary }}>{node.cost} 薪柴 · 累计 {cumulative}</Text>
                <Text>{node.effect}</Text>
                <Text size="small" tone="secondary">{node.phase}阶段 · 目标等级 {node.level}<br />{node.gate}</Text>
                <Button variant="ghost" onClick={() => open("data/growth-route.csv")}>打开路线数据</Button>
              </Stack>
            </CardBody>
          </Card>
        </Grid>
      </Stack>

      <Divider />
      <Stack gap={14}>
        <H2>六项发现：看证据，也看反证</H2>
        <Row gap={6} wrap>
          {FINDINGS.map(entry => <span key={entry.id}><Pill active={entry.id === finding.id} onClick={() => { setSelected(entry.id); setStep(entry.step); }}>{entry.id} · {entry.title}</Pill></span>)}
        </Row>
        <Stack gap={8} style={{ paddingLeft: 16, borderLeft: `2px solid ${theme.stroke.primary}` }}>
          <Text size="small" tone="tertiary">{finding.id} · P2 · {finding.kind}</Text>
          <H3>{finding.title}</H3>
          <Text>{finding.observation}</Text>
          <Grid columns="repeat(auto-fit, minmax(250px, 1fr))" gap={24}>
            <Stack gap={6}><Text weight="semibold">反证与边界</Text><Text tone="secondary">{finding.counter}</Text></Stack>
            <Stack gap={6}><Text weight="semibold">最小下一步</Text><Text>{finding.action}</Text></Stack>
          </Grid>
          <Text size="small" tone="tertiary">证据把握：{finding.confidence}</Text>
          <Row gap={8} wrap>{finding.evidence.map(source => <span key={source.path}><Button variant="ghost" onClick={() => open(source.path)}>{source.label}</Button></span>)}</Row>
        </Stack>
      </Stack>

      <Divider />
      <Stack gap={8}>
        <Text size="small" tone="secondary">版本与来源：7a67523 上的 I29 R2 工作树，审查日期 2026-09-21。图像由专家受控取证，代码/数值复算与艺术静帧判断分别限用。失效脚本已隔离为 diagnostic-invalid；结论采用重跑后的正式存档、DOM 和截图。未修改游戏，未代签人审。</Text>
        <Row gap={8} wrap>
          <Button onClick={() => open("docs/qa/growth-sample-review-2026-09-21.md")}>完整评审</Button>
          <Button variant="ghost" onClick={() => open(REVIEW + "runtime/manifest.json")}>受控证据清单</Button>
          <Button variant="ghost" onClick={() => open(REVIEW + "design-route-analysis.json")}>22 步成本复算</Button>
          <Button variant="ghost" onClick={() => open("data/upgrades.csv")}>成长原始 CSV</Button>
        </Row>
      </Stack>
    </Stack>
  );
}
