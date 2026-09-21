import { Stack, Row, Grid, H1, H2, H3, Text, Pill, Table, Callout, Divider, CollapsibleSection, Select, useState, useHostTheme } from 'cursor/canvas';

type Dimension = { id: string; name: string; samples: string; controls: string; relation: string };
const groups: { title: string; purpose: string; dimensions: Dimension[] }[] = [
  { title: 'A 原生世界', purpose: '让世界拥有自身的材料与形成过程。', dimensions: [
    { id: '01', name: '物质组成', samples: '粉末、层岩、金属薄片、陶壳、玻璃、晶体、纤维、膜、凝胶、致密泡沫', controls: '主次物质比例、相互渗入、边界方式', relation: '材料必须影响形态与表面反应，不能只有名称或脚步声。' },
    { id: '02', name: '形成过程', samples: '沉积、结晶、凝固、增生、侵蚀、拉伸、折叠、堆积、压力定形、运动留痕', controls: '方向一致性、层数、过程尺度', relation: '一个过程可以作用于多种材料，不绑定一套主题资产。' },
    { id: '03', name: '尺度关系', samples: '细粒成大体、巨物截面、薄层堆叠、稀疏巨柱、大小悬殊群落', controls: '物件与玩家尺度比、主次体量比、间距', relation: '用俯视截面和跨屏延续表达巨大；角色尺度与操作不变。' },
    { id: '04', name: '残留与历史', samples: '完整秩序被覆盖、反复重写、露出内层、单侧磨损、迁移遗迹、过程冻结', controls: '保留度、叠写次数、局部年龄差', relation: '残破、污染年龄、异常显现和难度分别控制。' },
  ] },
  { title: 'B 空间组织', purpose: '生成不同的走法、体量和自然组织。', dimensions: [
    { id: '05', name: '路线拓扑', samples: '多环、并行交叉、中心带绕行、环加支路、盆地收束、分岔重汇', controls: '环密度、绕行率、死端深度、必经点比例', relation: '网络指选择关系；图的边不能直接变成桥或网格。' },
    { id: '06', name: '地面与空隙', samples: '连续地表、内凹空腔、裂口带、错列洼地、层片间隔、局部断面', controls: '实空比例、聚集度、边界连续性', relation: '首阶段仍是单层2D可达空间；可走多层另需能力。' },
    { id: '07', name: '地貌形态', samples: '板、脊、柱、团块、弧壳、扇面、褶皱、结节、晶簇、巨大断端', controls: '长宽比、曲率、方向、厚薄、破碎率', relation: '低矮装饰与遮挡体应可辨；材质和形体不一一绑定。' },
    { id: '08', name: '空间节奏', samples: '疏密交替、展开后收束、小空间重汇、连续掩护、巨大空场', controls: '净宽、掩护间距、暴露长度、转角频率', relation: '必须改变行动节奏；装饰数量不能代替空间变化。' },
    { id: '09', name: '组织场', samples: '沿流线、裂隙、低处、中心、外缘、避光处、成簇、分带、渐变', controls: '方向、相关长度、扰动尺度、材料响应', relation: '地貌、磨损、附着物共享过程，采用不同尺度响应。' },
  ] },
  { title: 'C 可见表面', purpose: '统一像素画法，开放材料、明暗和色彩。', dimensions: [
    { id: '10', name: '色表制度', samples: '灰阶、二值黑白、单色冷灰、骨白深褐、双主色、稀疏互补、局部消色', controls: '色数、饱和度分布、强调面积', relation: '纯黑白不能偷偷留青绿；二值与灰阶分别验证。' },
    { id: '11', name: '明度构图', samples: '暗地亮边、亮地暗体、窄缝透亮、侧照、底部漏光、局部负片', controls: '明度块比例、行动对象阶差、亮区面积', relation: '保证相对辨识，不强制玩家最亮；亮地仍裁切视野。' },
    { id: '12', name: '材质与像素笔触', samples: '哑光、断续硬反光、层内半透、束状纤维、剥皮、釉面、孔隙、结壳', controls: '高光覆盖、簇尺度、边缘、方向、稀疏度', relation: '差异要在正常视野中成立，避免统一高频噪声。' },
    { id: '13', name: '光的规律', samples: '漫射、腔内光、裂缝漏光、巨影、发光面、间歇透亮、吸光', controls: '方向、范围、遮挡、时序', relation: '光学表现不自动改变AI侦测或真实视野。' },
    { id: '14', name: '俯视深度与边界', samples: '浅浮雕、断面、腔底、上覆薄面、下沉边缘、跨屏巨体', controls: '遮挡层级、厚度、接触阴影', relation: '世界延续不能泄露未探索目标，不可走背景不能冒充地面。' },
    { id: '15', name: '地标与局部例外', samples: '生长节点、巨截面、输送残迹、断层、缺件、接触带', controls: '数量、可见特征、与路径关系', relation: '先由共同材料和过程生成，少量地标再用专用资产。' },
  ] },
  { title: 'D 污染改写', purpose: '在原生秩序上显露另一套稳定规律。', dimensions: [
    { id: '16', name: '改写算子', samples: '晶化、重复层片、错位、反转、单向化、等距化、缺失、内外交换', controls: '作用性质、尺度、对象、组合次序', relation: '一个主导律；辅助律解释其后果；特殊交界另验。' },
    { id: '17', name: '显现与附着', samples: '裂缝生长、边界包覆、定向推进、接点蔓延、受压凝结、间隔显露', controls: '显现强弱场、附着面、前沿宽度', relation: '到达的世界都已被覆盖；弱显现区不是未污染安全区。' },
    { id: '18', name: '改写状态', samples: '重排中、稳定新秩序、多代叠加、冲突残留、进程失配', controls: '年龄、局部强弱、频率、残留量', relation: '接好已有年龄轴，不默认年轻等于简单。' },
    { id: '19', name: '感官签名', samples: '异色、消色、错相、层内亮线、缺笔、吸光、逆流、重复轮廓', controls: '位置、面积、相位、色彩映射', relation: '普通景观、宿主、核心分别可读；晶体不都可攻击。' },
  ] },
  { title: 'E 氛围与时间', purpose: '为世界提供有组织的持续过程。', dimensions: [
    { id: '20', name: '介质与微物', samples: '澄净、低尘、沿边雾、悬纤维、剥片、沉粒、上行碎屑、闪点', controls: '密度、粒径、聚集位置、遮挡预算', relation: '符合局部世界关系，不默认塞天空和云。' },
    { id: '21', name: '运动节律', samples: '静止、慢舒张、逐段传播、积累释放、错相、停顿后同步、迟滞', controls: '周期、相位、相干范围、占屏率', relation: '环境装饰不能冒充危险前兆，攻击时序始终可信。' },
    { id: '22', name: '声音空间', samples: '干裂、摩擦、层片振动、张力、晶鸣、压力低响、吸声、近静默', controls: '密度、衰减、方向、回声、声画同步', relation: '听感与AI听觉分开；声音不是唯一关键提示。' },
  ] },
  { title: 'F 游戏信息与部署', purpose: '把世界差异落实到观察、接近和撤离。', dimensions: [
    { id: '23', name: '信息与掩护', samples: '连续掩护、断续窥视、短暂暴露、观察带、多接近角、绕背', controls: '视线长度、掩护距离、预见距离、曝光差', relation: '复用现有视野与巡逻；无需每个世界新造玩法。' },
    { id: '24', name: '遭遇与收益节奏', samples: '低风险环、逐步深入、横切巡逻、观察后绕行、长绕行避战', controls: '资源偏离距离、遭遇间距、回程成本', relation: '新奇度、经济预算与战斗难度分开。' },
  ] },
];

const worlds = [
  { name: '消色层原', order: '层片与粉末沿流向沉积', rewrite: '表面差异压缩为有限明度，局部反转', appearance: '暗灰宽面、浅灰层切、少量白裂口；世界内角色与特效同样无彩色', space: '偏置厚脊形成多个绕行环，层纹帮助记路', play: '用形状、明度关系和节拍识别核心与危险；不保留青绿补丁', needs: '语义调色、核心与预警灰阶映射、明度层级；不是去色滤镜', quiet: '稀疏干裂声，层边近乎静止' },
  { name: '晶化林床', order: '纤维层构成连续承重面', rewrite: '柔软连接沿晶轴硬化', appearance: '曲线逐段变成硬折面，晶簇沿连接成片出现；色表不绑定紫色', space: '宽弧带和硬脊共同组织绕行，低晶壳与高结节区分', play: '形态影响接近角度和掩护，普通晶体与宿主保持区别', needs: '纤维形体、晶化算子、分面材质、边缘附着；真实折射视野另立机制', quiet: '少数晶面断续闪动，短促细裂声' },
  { name: '逆沉积盆地', order: '界面缓慢凝固，薄壳持续堆积', rewrite: '颗粒向边缘与高处沉积', appearance: '安静盆地、厚重不对称边缘、倒向层切、少量上行碎屑', space: '宽口重汇，连续实地上的厚边提供多种掩护', play: '承重面清晰，空间有环但不画成桥网', needs: '壳面和厚边语法、逆向粒子、层切材质；不实现玩家反重力', quiet: '低密度上行颗粒与空腔短响' },
  { name: '折返格室', order: '无门腔体按交换关系重复排列', rewrite: '结构错位复制，部分腔体仅剩边界', appearance: '有规律的薄壁与稳定偏差，缺件和压痕构成地标', space: '多个短环经宽腔重汇，拐折与开阔片段交替', play: '规律可预测，偏差可记路；不依赖随机瞬移', needs: '腔体与错位语法、非噪声材质；非欧几里得连接另立能力', quiet: '少量顺序响动与结构重复呼应' },
  { name: '迟滞尘海', order: '颗粒层随微扰缓慢迁移', rewrite: '已结束的过程留下迟到的环境运动', appearance: '静止大地与延后消散的局部流线，少量稳定大体量', space: '长暴露段穿过疏密不同的掩护群落', play: '环境迟滞，角色、攻击、碰撞和警告不延迟', needs: '方向沉积、有界残留场；时间重放与轨迹追踪不在默认范围', quiet: '局部残影与延后的非关键环境声' },
  { name: '吸光釉原', order: '陶质沉积在压力下形成开裂厚釉', rewrite: '突起吸光，凹部保留明度', appearance: '厚重浅灰承重面、深结节、暗断边，少数窄釉亮面', space: '连续平面被大体量分隔，可背侧绕行或横穿', play: '亮地不等于安全；吸光不使敌人或边界消失', needs: '亮地语义分配、层裂形体、釉面响应与视野裁切', quiet: '几乎没有漂浮物，少数断层摩擦声' },
];

const cases = [
  { title: '纯黑白，所有交互与预警仍可辨认', verdict: '允许探索', reason: '现实常识和原有青绿配色都不能否决它。需要逐类编译明度、轮廓和时序。' },
  { title: '晶体发光，照出了视野外的敌人', verdict: '硬性拒绝', reason: '环境表现绕过了有限视野，泄露游戏信息。修复光与目标显示的裁切。' },
  { title: '碎屑向上沉积，玩家行动规则稳定', verdict: '允许探索', reason: '反常过程可以是世界身份。若要求改变玩家重力，再声明并实现机制。' },
  { title: '透明薄膜画成地面，实际却不能站立', verdict: '硬性拒绝', reason: '图形与碰撞意义冲突。要么重新表达不可承重，要么兑现真实通行。' },
  { title: '环境残影延迟，攻击警告也随之延迟', verdict: '硬性拒绝', reason: '奇观破坏行动反馈。环境时间表现和战斗时序必须分开。' },
  { title: '陌生组合不符合常见配色偏好', verdict: '不因偏好拒绝', reason: '放入例外候选测试。只要画面、语义和玩法成立，就能扩展风格空间。' },
  { title: '两个合格算子叠加后遮住了攻击核心', verdict: '组合未通过', reason: '单模块通过不保证组合通过。重新验证实际场景、相位与交互。' },
  { title: '数据要求折射视野，但引擎只有普通FOV', verdict: '缺少能力', reason: '保留概念并列入能力待办；不能静默降级后宣称已经支持。' },
];

function Pipeline() {
  const t = useHostTheme();
  return <Stack gap={12}>
    <H2>两种生成，承担不同任务</H2>
    <Text weight="semibold">制作期：探索表达空间并批准组合范围</Text>
    <Row gap={9} wrap>
      {['原生秩序＋改写律', '条件组合与能力检查', '多种布局／相位试验', '质量与差异复核', '配方范围入库'].map((label, i) => <span key={label}><Row gap={9}><Text style={{ color: i === 4 ? t.accent.primary : t.text.primary }}>{label}</Text>{i < 4 && <Text tone="tertiary">→</Text>}</Row></span>)}
    </Row>
    <Divider />
    <Text weight="semibold">运行期：在获准范围内生成这一局</Text>
    <Row gap={9} wrap>
      {['抽世界配方', '局部场＋路线与地貌', '部署＋烘焙', '硬检查／有界修复', '同配方合法后备'].map((label, i) => <span key={label}><Row gap={9}><Text>{label}</Text>{i < 4 && <Text tone="tertiary">→</Text>}</Row></span>)}
    </Row>
    <Text tone="secondary">世界配方稳定，地图实例可变，时间状态有界。路线关系由图表达，地貌语法负责自然落地；不把图的边画成桥。</Text>
  </Stack>;
}

export default function RiftWorldSpace() {
  const t = useHostTheme();
  const [tab, setTab] = useState('维度空间');
  const [group, setGroup] = useState(0);
  const [left, setLeft] = useState('0');
  const [right, setRight] = useState('1');
  const [caseIndex, setCaseIndex] = useState('0');
  const selected = groups[group];
  const a = worlds[Number(left)], b = worlds[Number(right)];
  const currentCase = cases[Number(caseIndex)];
  const worldOptions = worlds.map((w, i) => ({ value: String(i), label: w.name }));
  return <Stack gap={22} style={{ padding: 24, maxWidth: 1180, margin: '0 auto' }}>
    <Stack gap={8}>
      <Text size="small" tone="secondary">系统设计提案 · 2026-09-16 · 基线 b8690ff · 未实现</Text>
      <H1>裂隙世界空间</H1>
      <Text weight="semibold">先生成一种世界的存在方式，再生成玩家能够探索的片段。</Text>
      <Text tone="secondary">固定像素语言和行动语义，开放物质、空间、色光与改写规律。这里展示样本空间与设计关系，不是游戏画面，也不是已经可运行的生成器。</Text>
    </Stack>
    <Row gap={8} wrap>{['维度空间', '世界对照', '生成与排除', '现状与验证'].map(name => <span key={name}><Pill active={tab === name} onClick={() => setTab(name)}>{name}</Pill></span>)}</Row>
    {tab === '维度空间' && <Stack gap={18}>
      <Callout tone="neutral" title="6组24项是初始分解，不是24个独立滑杆">先确定材料与过程，再有条件地选择形体、声光和分布。家族提供概率倾向，不垄断合法组合；新算子可以继续打开新的区域。</Callout>
      <Row gap={8} wrap>{groups.map((g, i) => <span key={g.title}><Pill active={group === i} onClick={() => setGroup(i)}>{g.title}</Pill></span>)}</Row>
      <Stack gap={6}><H2>{selected.title}</H2><Text tone="secondary">{selected.purpose}</Text></Stack>
      <Table framed={false} headers={['信息维度', '可能的离散样本', '连续量／分布', '关系与边界']} rows={selected.dimensions.map(d => [<Text weight="semibold">{d.id} {d.name}</Text>, d.samples, d.controls, d.relation])} />
      <Divider />
      <Grid columns="repeat(auto-fit, minmax(270px, 1fr))" gap={24}>
        <Stack gap={8}><H3>统一的连接层：组织场</H3><Text>一张压力场可以共同组织壳面朝向、裂口、积尘和响动。各层以不同尺度响应，形成自然关联，而非均匀撒素材。</Text></Stack>
        <Stack gap={8}><H3>稳定的底层：行动语义</H3><Text>可走、遮挡、可攻击、危险和交互始终可读。形状、明度、时序形成冗余；颜色不独自承包某种意义。</Text></Stack>
      </Grid>
    </Stack>}
    {tab === '世界对照' && <Stack gap={18}>
      <H2>选择两个候选，检查差异是否跨过多个维度</H2>
      <Text tone="secondary">六个世界是压力样本，不是固定六主题目录。它们的核心新画面都需要补充能力；已有Rift玩法可承接，不代表现在已经能生成。</Text>
      <Grid columns="repeat(auto-fit, minmax(240px, 1fr))" gap={20}>
        <Stack gap={6}><Text size="small">左侧世界</Text><Select value={left} options={worldOptions} onChange={setLeft} /></Stack>
        <Stack gap={6}><Text size="small">右侧世界</Text><Select value={right} options={worldOptions} onChange={setRight} /></Stack>
      </Grid>
      <Table framed={false} headers={['关系', a.name, b.name]} rows={[
        ['原生秩序', a.order, b.order], ['主导改写', a.rewrite, b.rewrite], ['局部画面', a.appearance, b.appearance], ['空间组织', a.space, b.space], ['行动关系', a.play, b.play], ['微动与声音', a.quiet, b.quiet], ['待补能力', a.needs, b.needs],
      ]} />
      <Callout tone="neutral" title="复用单位是能力">晶化算子可以作用于纤维、壳片或粉末，产生不同形态；同一世界也能生成不同路线。新材料若无法由现有能力表达，就如实计入新增制作成本。</Callout>
      <CollapsibleSection title="额外压力样本" defaultOpen={false}><Stack gap={10}><Text><strong>半透明薄膜湿地：</strong>验证透明材质、遮挡与承重面一致，控制叠层成本。</Text><Text><strong>干燥磁砂荒原：</strong>验证安静地面和少数沉重大脊，能否不靠发光与高饱和形成身份。</Text></Stack></CollapsibleSection>
    </Stack>}
    {tab === '生成与排除' && <Stack gap={22}>
      <Pipeline />
      <H2>什么才是绝对不合理</H2>
      <Text tone="secondary">奇怪不是否决理由。玩法矛盾、关键语义不可读、技术能力缺失、运行不可靠才进入硬检查。</Text>
      <Select value={caseIndex} onChange={setCaseIndex} options={cases.map((c, i) => ({ value: String(i), label: c.title }))} />
      <Stack gap={8} style={{ padding: 16, background: t.bg.elevated }}><H3>{currentCase.verdict}</H3><Text>{currentCase.reason}</Text></Stack>
      <Divider />
      <H2>经验与惊喜共同存在</H2>
      <Table framed={false} headers={['采样通道', '玩家获得的体验', '约束']} rows={[
        ['熟悉邻域', '逐渐认识材料、地貌和行动倾向', '家族内部仍有布局和表现变化'],
        ['跨类组合', '学会的规律在新基体上长成另一种样子', '组合与参数范围先验证'],
        ['罕见奇观', '遇见无彩色、尺度错位等高差异世界', '不跳过硬检查，不自动增加难度或收益'],
      ]} />
      <Text tone="secondary">配方保存稳定规则与合法范围。根据近期实际体验相似度柔性调权，不硬禁连抽；不改变裂隙目的地不可精确选择的设定。</Text>
    </Stack>}
    {tab === '现状与验证' && <Stack gap={20}>
      <H2>为什么当前系统显得受限</H2>
      <Table framed={false} headers={['生产事实', '含义']} rows={[
        ['4个启用身份／9个启用锚', '身份、骨架和部分表达锁定，主要在邻域内抖参数'],
        ['8种结构语法，7种进入正式池', '同一64×42地图与共享外轮廓流程'],
        ['污染年龄3档×残破度3档已接入', '主要改变宿主量与表面表现；旧入口文档存在过时描述'],
        ['部分质量语法字段未进入生产链', '受控同seed修改未改变布局与地表像素；参数数不能当自由度'],
        ['surface_material主要用于脚步声', '新增材料名不会自动出现独立材质体系'],
        ['共享地表、暗色与青绿表达', '不同种子可能仍在视觉上十分接近'],
      ]} />
      <Text size="small" tone="secondary">来源：2026-09-16本地生产链审计；不含归档3D场景。未在本轮修改游戏。</Text>
      <H2>通过四类证据判断扩展是否成功</H2>
      <CollapsibleSection title="1. 旋钮真实生效" defaultOpen><Text>固定其他随机支流，改变一个声明开放的维度，检查实际像素、形体或路径结果。仅声音变化的字段不能计作外观维度。</Text></CollapsibleSection>
      <CollapsibleSection title="2. 局部看得出世界不同" defaultOpen><Text>检查正常视野与移动序列，补全图对照；去色、关闭氛围、同布局换材料，排除只有缩略图和颜色不同的假差异。</Text></CollapsibleSection>
      <CollapsibleSection title="3. 走法真的不同" defaultOpen><Text>量环密度、必经点、暴露长度、绕行与收益关系，再用相同装备试玩。几何连通不足以证明遭遇可应对。</Text></CollapsibleSection>
      <CollapsibleSection title="4. 合格输出没有重新挤成一种风格" defaultOpen><Text>记录不同家族的通过、拒绝、修复与实际抽取比例；观察表达范围的二维切片。保留不同区域的好方案，不追求唯一综合最高分。</Text></CollapsibleSection>
      <Callout tone="neutral" title="第一轮验证建议">既有风格、无彩色、晶化三种表现，交叉两种拓扑；每组合先观察16个种子，共96个试验样本，再补极端情况。这是提议的实验预算，不是已完成测试，也不是发布充分性证明。</Callout>
    </Stack>}
    <Divider />
    <Text size="small" tone="secondary">完整提案：docs/design-notes/rift-world-space.md。正式规格仍为system-map-generation.md；采纳后原地更新，避免多份生产合同。</Text>
  </Stack>;
}
