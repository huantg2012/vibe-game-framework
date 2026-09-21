import { Stack, Row, Grid, H1, H2, Text, Card, CardHeader, CardBody, Divider, Pill, Link, useState, useHostTheme } from 'cursor/canvas';

const worlds = [
  { name: '悬在头顶的海', rule: '同一片水的不同层拥有不同的“下方”。',
    inside: '走入干海床与海腹之间。礁骨穿入水层，水流从上方跨到前方；人物、海腹和落点使用同一观察角度。',
    beyond: '正俯视下，大片悬水与流动孔洞覆盖路径；断脊外看见邻近低海床上的完整海体，远处巨影沿水层经过。',
    local: '脚边壳屑、沉积纹、声压与少数落水连接同一水循环。',
    watch: '从地面洞往下看不能等同于仰看自己头顶；规则圆形加一圈噪点也不够自然。' },
  { name: '彼此托举的生命大陆', rule: '生命互相承重，部分连接被污染成只能收紧。',
    inside: '踏上干燥鳍面，能追溯跨层连接接到哪具身体。下层撑起、连接绷紧、上层改变姿态，先后关系可见。',
    beyond: '地图是一片鳍面。裂口露出下层巨体，玩家绕洞时看见不同的承重部位；远处另一个大陆缓慢舒展。',
    local: '脚边纤维先拉直再松弛，少数通路响应形变；巨体通常不理会玩家。',
    watch: '保留角质、薄膜、纤维的独特地貌，不退回树根、石地板或通用内脏。' },
  { name: '正在凝固的风暴', rule: '过去的气流变成持久形体，新风穿过旧风。',
    inside: '在固化气流薄刃与拱壳之间穿行。不同高度的流束绕过旧锋面，读出空气曾怎样运动。',
    beyond: '远方巨大风暴一段段凝固；洞下露出卷曲的旧风层，仍在流动的矿尘从空隙穿过。',
    local: '致密矿尘成为脚下材料，背风面与暴露通道形成不同的经过时机。',
    watch: '不要把流动做成同步摆动的细条，也不必让整个风暴周期惩罚玩家。' },
  { name: '被撑出厚度的世界', rule: '原本只有面积的存在被迫生出内部。',
    inside: '同一结构转向时从边显为面，再鼓出体积；新增厚度真实挤占一段缝隙，保留可预判的安全侧。',
    beyond: '边界外巨大薄面缓慢翻开，洞内露出它新生的内层。角色立足的小曲面只是这片结构的一角。',
    local: '附近接缝随远处膨出略微收窄；不是所有展开都必须影响玩家。',
    watch: '一座永远厚的平台无法表达“正在增厚”。必须看见同一物体的变化。' },
  { name: '旧声音堆成的地层', rule: '压力振动成形，旧声音留下的结构不再消散。',
    inside: '走进巨大弧壳之间，新的压力前沿穿过旧层，粉末与声音沿可见路径连续到脚边。',
    beyond: '中央断口显露一层层凝住的波峰；远处一次无法追索的撞击，依次唤起各层。',
    local: '薄壳震动、落粉和声音共同预告局部变化，或仅留下不可干涉的回响。',
    watch: '声画有对应关系；不自动赋予现有技能重塑地形的能力。' },
  { name: '没有独立居民身体的造物', rule: '文明以腔体、压力与材料交换存在。',
    inside: '走入连通腔体，空间收缩与张开就是当地存在的活动；通路并不按人类门窗组织。',
    beyond: '地图是外壳破口。远处成群腔体一侧鼓胀、一侧干瘪，运输结构穿过洞下。',
    local: '玩家只能学会一小段交换节律，用它观察、等待或撤开。',
    watch: '不强行加入人形居民、解释一切的NPC或冗长剧情。' },
  { name: '裂成不同时间的山脉', rule: '相邻地貌以不同速度经历风化与崩解。',
    inside: '相邻岩体分别缓慢崩解、迅速粉化、悬停未落；玩家可在同一视野内对照它们。',
    beyond: '远方断崖同时经历不同速度的侵蚀，洞内落石停在半途，某些细沙偶尔接续运动。',
    local: '少数已预告的落物影响路径；大部分时间差仅呈现世界自己的过程。',
    watch: '保持玩家行动和命中可读，不倒转耐久、死亡或掉落账本。' },
  { name: '两个世界互相排斥的断面', rule: '晶体与柔性膜的两套现实彼此挤压、剥离。',
    inside: '沿接触线穿行，看到挤压、脱层、回缩与可通过空隙。两边各有稳定规则。',
    beyond: '可玩地图是较小的接触残片；边缘与中心深口展露两个巨大世界缓慢相撞。',
    local: '局部有限剥落物说明来处，少数通路随接触状态改变。',
    watch: '不是两套资产随意混搭；不断碰撞的远景不成为无限物资来源。' },
];

const cameras = [
  { name: '统一的三维像素舞台', experience: '固定机位拍摄有共同高度关系的角色、敌人与场景；先保留地面自由绕行。', cost: '重新制作角色/敌人的观察角度，并联调输入、视野、受击落点与遮挡。先做一个场面，不直接转换全部模型。', fit: '方向一优先试作。最接近现有自由移动与搜打撤玩法。' },
  { name: '侧向斜看的纵深场景', experience: '主要横向前进，保留浅纵深绕行，海腹与巨体成为画面的主体。多个岔路场景组成裂隙。', cost: '360°遭遇需要重编，攻击对齐、前后夹击与退路都要重新设计；不必加入跳台玩法。', fit: '竖向奇观最直接，玩法调整也更大。' },
  { name: '按空间段编排固定机位', experience: '一个空间段使用一个稳定机位：搜刮场较高、裂口处较低，转折连接让机位自然变化。', cost: '地图需要带镜头安全区的空间模板；不在攻击中切机位，按住移动跨场景也不能突然折返。', fit: '构图能力强，可建立在统一空间上；不是同屏混用多个物理角度。' },
];

function SpaceDiagram({ mode }: { mode: 'inside' | 'beyond' }) {
  const t = useHostTheme();
  const ink = t.text.secondary;
  const edge = t.stroke.primary;
  return <svg viewBox="0 0 420 235" role="img" aria-label={mode === 'inside' ? '剖面示意：角色在悬水和海床之间' : '平面示意：路径围绕内部裂口，外侧还有远景'} style={{ width: '100%', display: 'block', background: t.bg.editor }}>
    {mode === 'inside' ? <>
      <text x="18" y="25" fill={ink} fontSize="12">剖面关系示意 · 不是最终镜头</text>
      <path d="M22 53 L380 53 L392 86 Q357 106 312 88 Q270 70 232 109 Q167 114 128 91 Q80 107 25 85 Z" fill={t.fill.secondary} stroke={edge}/>
      <path d="M42 65 Q112 82 180 68 T365 68" fill="none" stroke={edge}/>
      <text x="132" y="88" fill={ink} fontSize="13">有内部深度的海体</text>
      <path d="M321 88 Q303 125 324 157 L339 176 L314 176 Q287 137 305 87" fill={t.fill.tertiary} stroke={edge}/>
      <path d="M18 185 L113 182 L170 189 L236 177 L270 181 L402 177 L402 212 L18 212 Z" fill={t.fill.secondary} stroke={edge}/>
      <path d="M257 183 L260 82 L275 78 L281 182 Z" fill={t.bg.elevated} stroke={edge}/>
      <circle cx="133" cy="148" r="6" fill={t.accent.primary}/>
      <path d="M133 154 L133 174 M124 160 L140 161 M133 174 L126 184 M133 174 L139 184" fill="none" stroke={t.accent.primary} strokeWidth="3"/>
      <text x="33" y="133" fill={ink} fontSize="12">角色在海与地面之间</text>
      <text x="291" y="202" fill={ink} fontSize="12">落水连到地面</text>
    </> : <>
      <text x="18" y="25" fill={ink} fontSize="12">平面布置示意 · 不代表美术效果</text>
      <path d="M20 54 L103 47 L155 60 L198 45 L275 51 L394 38 L402 72 L279 91 L225 85 L167 98 L95 81 L20 84 Z" fill={t.fill.secondary} stroke={edge}/>
      <text x="138" y="73" fill={ink} fontSize="13">边界之外的巨大世界</text>
      <path d="M34 106 L114 93 L163 112 L244 93 L369 104 L399 145 L373 213 L296 222 L240 205 L131 218 L31 194 Z M147 132 L135 155 L157 180 L209 178 L240 188 L291 163 L278 131 L221 124 L192 139 Z" fillRule="evenodd" fill={t.fill.secondary} stroke={edge}/>
      <text x="163" y="161" fill={ink} fontSize="12">内部世界窗口</text>
      <path d="M67 171 Q87 109 143 120 Q190 109 227 112 Q334 98 352 160 Q338 203 276 201 Q209 194 153 201 Q93 207 67 171" fill="none" stroke={t.accent.primary} strokeWidth="2" strokeDasharray="5 4"/>
      <circle cx="67" cy="171" r="5" fill={t.accent.primary}/>
      <text x="43" y="151" fill={ink} fontSize="12">路径</text>
    </>}
  </svg>;
}

export default function RiftVisualDirections() {
  const [worldIndex, setWorldIndex] = useState(0);
  const [cameraIndex, setCameraIndex] = useState(0);
  const world = worlds[worldIndex];
  const camera = cameras[cameraIndex];
  return <Stack gap={20} style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
    <Stack gap={8}>
      <H1>怎样让玩家抵达那些世界</H1>
      <Text tone="secondary">两条路线同时展开 · 迭代21设计提案 · 2026-09-11</Text>
      <Text>R2斜俯视的角色与海体角度不一致；正俯视有潜力，但仍需修改。这里讨论新的表现形式，尚未制作新实机，也未选择生产镜头。</Text>
    </Stack>
    <Grid columns="repeat(auto-fit, minmax(310px, 1fr))" gap={18}>
      <Stack gap={10}>
        <H2>一 · 玩家进入奇观的空间</H2>
        <Text>角色、地面和奇观使用同一个观察角度。改变空间承载，不必同时加入跳跃或自由旋转。</Text>
        <SpaceDiagram mode="inside"/>
      </Stack>
      <Stack gap={10}>
        <H2>二 · 地图嵌在巨大世界中</H2>
        <Text>边界、内部空洞和前后景展示更大世界。玩家只能踏上一小部分，奇观可以始终无法干涉。</Text>
        <SpaceDiagram mode="beyond"/>
      </Stack>
    </Grid>
    <Divider/>
    <Stack gap={12}>
      <H2>同一个世界，两种落点</H2>
      <Text tone="secondary">选择世界会同时更新两边；这不是二选一投票。</Text>
      <Row wrap gap={6}>
        {worlds.map((w, index) => <span key={w.name}><Pill active={index === worldIndex} onClick={() => setWorldIndex(index)}>{w.name}</Pill></span>)}
      </Row>
      <Text weight="semibold">{world.name}：{world.rule}</Text>
      <Grid columns="repeat(auto-fit, minmax(310px, 1fr))" gap={18}>
        <Card><CardHeader>进入完整空间</CardHeader><CardBody><Text>{world.inside}</Text></CardBody></Card>
        <Card><CardHeader>在地图边界与空洞看见</CardHeader><CardBody><Text>{world.beyond}</Text></CardBody></Card>
      </Grid>
      <Text><Text as="span" weight="semibold">脚下的连接：</Text>{world.local}</Text>
      <Text tone="secondary"><Text as="span" weight="semibold">不能丢失的关系：</Text>{world.watch}</Text>
    </Stack>
    <Divider/>
    <Stack gap={12}>
      <H2>方向一的三种具体镜头组织</H2>
      <Row wrap gap={6}>{cameras.map((c, index) => <span key={c.name}><Pill active={index === cameraIndex} onClick={() => setCameraIndex(index)}>{c.name}</Pill></span>)}</Row>
      <Text>{camera.experience}</Text>
      <Text><Text as="span" weight="semibold">制作影响：</Text>{camera.cost}</Text>
      <Text tone="secondary">{camera.fit}</Text>
    </Stack>
    <Divider/>
    <Stack gap={10}>
      <H2>正俯视悬海的具体修订</H2>
      <Text>大面积、分散相连的海体覆盖多个方向。65–80%的可通行区域投影覆盖可作为取样起点，绝不等于让同等屏幕面积不透明。</Text>
      <Text>自然孔洞在世界内慢慢拉长、汇合、分开，大小与节律不同；它们不追着角色走，默认也不改变脚下通行。</Text>
      <Text>落水以偏斜薄片、分叉水舌、错开汇流组织。俯视读截面、投影、触地扩散和回收；危险判定与同一不规则主水束一致。</Text>
      <Text>水层内部有不同深度的形体与流动，高物穿入水体、投影落到海床。避免均匀蓝色滤镜与凭空朝向观众的侧视瀑布。</Text>
    </Stack>
    <Divider/>
    <Stack gap={10}>
      <H2>下一轮建议交两份实物</H2>
      <Text>第一份：一个统一机位、重新制作角度的角色和敌人、一段真正可进入的悬海空间。先检查几何，再完成像素表现与接敌。</Text>
      <Text>第二份：一段正俯视环绕路径、内部开口、边界世界、大覆盖流动海体和一次不规则落水。日常行走时也能读到世界关系。</Text>
      <Text tone="secondary">两份都保留。此后才讨论生产组合，不先转换全部模型或制作八张地图。阶段四A持续供给仍未开始，验收通过后才能进入四B扩产。</Text>
      <Link href="/Users/yilungao/coh/docs/design-notes/rift-environment-expansion.md">完整设计、八世界细节与边界条件</Link>
    </Stack>
    <Divider/>
    <Text tone="secondary" size="small">方法参考：<Link href="https://www.unrealengine.com/developer-interviews/octopath-traveler-ii-builds-a-bigger-bolder-world-in-its-stunning-hd-2d-style?lang=en-US">Square Enix / Acquire关于二维角色与三维空间融合的访谈</Link>；<Link href="https://news.xbox.com/en-us/2026/04/14/replaced-combat/">Sad Cat Studios关于逐帧动画的说明</Link>。上方方案是针对本作的设计推演，不是照搬参考作品的画风。</Text>
  </Stack>;
}
