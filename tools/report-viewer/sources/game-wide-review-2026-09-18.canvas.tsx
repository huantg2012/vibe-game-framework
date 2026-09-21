import { useState, useHostTheme, Stack, Row, Grid, H1, H2, H3, Text, Button, Pill, Table, Divider } from "cursor/canvas";

const findings = [
 {id:"WG-01",group:"运行",priority:"P1",title:"在途刷新后，旧档没有正常恢复出口",evidence:"正式实机 + 代码交叉",detail:"原存储仍保留；菜单拒绝active账本，不能继续或明确放弃该趟后回到原据点。是已知能力缺项的当前复核，非新增回归断言。",next:"实现原局恢复或明确弃局事务，保留既有据点；验证重开与重复结算。"},
 {id:"WG-02",group:"成长",priority:"P1",title:"生命与薪柴亲和没有兑现",evidence:"生命两名实机；亲和领域复现",detail:"生命2级：准备报告130，实际出行100/100；亲和0/1/3级，生产搜寻结算均为[1,2,5]。后者没有冒称同种子按键A/B。",next:"接通成长消费方，连同HUD、最大生命校验和恢复状态一起验。"},
 {id:"WG-07",group:"运行",priority:"P1调查",title:"连续准备后出发停滞，根因未定",evidence:"正式美术B + 根同源连续链",detail:"两处出现据点固定/界面消失；原连续链第五次没有active scene。相应副本新context可出发，缺原现场栈，不能归因装备或修复。",next:"保留原操作历史与场景阶段，带异常记录定向复现；与active刷新拒载分开。"},
 {id:"WG-03",group:"运行",priority:"P2",title:"成长/加厚保存失败后运行态分叉",evidence:"正式方法 + 隔离拒写存储",detail:"扣款、成长或上限已变，旧存档未变；没有回滚或待保存锁。未做DOM拒写录像。",next:"统一事务边界，验证拒写、重试和刷新。"},
 {id:"WG-04",group:"成长",priority:"P2",title:"首次冲击与稳定度合同漂移",evidence:"首归实机；稳定度静态+领域",detail:"首趟三模块70/70/70变65/65/50，实际损伤30；教学豁免不可达。稳定度文档、常量及消费者不一致。",next:"先明确活规则，再统一spec与实现；不擅自改回旧数值。"},
 {id:"WG-05",group:"玩法",priority:"P2风险",title:"想撤离之后，回程读法仍薄弱",evidence:"两名首见观察；工具干扰已披露",detail:"出现试撞边界、难建地点记忆、将“沿旧路返回”误读为回程。根代理实际找到出口，不能据首见说地图不可达。",next:"复核已探索信息、边界与措辞；保留未知空间，不全面揭图增亮。"},
 {id:"ART",group:"美术",priority:"专项",title:"局部身份清楚，整体材料与空间成熟度不均",evidence:"A/B实际画面与连续帧",detail:"暖灯、角色和装置值得保留；据点偏抽象托盘，实玩环境与首页的空间承诺落差明显。修复已有亮光和状态反馈，不能说全无动作。",next:"补场地组织、维护痕迹、装置状态及物件全生命周期身份。低饱和不是输出要求。"},
 {id:"TACTIC",group:"玩法",priority:"待验证",title:"物件数量尚不能证明构筑可持续",evidence:"10武器/13族目录；有限实战",detail:"10撬棍共享攻击方式；异物有不同行为。指定族的随机获得、供奉等待、耗尽与死亡后重组仍欠连续账本。",next:"用现有三类代表策略验证局势收益、同类替代和失败后恢复，再扩产。"},
 {id:"WG-06",group:"运行",priority:"P3",title:"入场混乱短时错显0",evidence:"实机 + 初始化时序探针",detail:"底层起始15已生效，HUD等首个变化才同步；并非净化器失效。",next:"补初始状态同步。"}
];
const stages = [
 ["1", "投入与连续游玩可信", "成长收益、在途恢复、保存失败、初值同步；确定冲击/稳定度活合同。"],
 ["2", "做强一次带回之后", "自然物件→供奉→成熟→再使用；净化点维护表达、物件身份、回程学习。"],
 ["3", "证明构筑周转", "保守近战/诱离搜取/环境通行；耗尽与失败后的替代配置；连续出击账本。"]
];

export default function GameWideReview(){
 const theme=useHostTheme();
 const [group,setGroup]=useState("全部");
 const shown=findings.filter(x=>group==="全部"||x.group===group);
 return <Stack gap={20} style={{padding:24,maxWidth:1120,margin:"0 auto",color:theme.text.primary}}>
  <Row justify="space-between" align="center" wrap><Pill>全游戏补审 · 2026-09-18</Pill><Text size="small" tone="secondary">冻结版本 1d7f309 · 专家评审，非真人研究</Text></Row>
  <H1>核心值得继续，先接稳收益到下一次选择</H1>
  <Text>暖灯进入未知空间、停留搜取、带回异物维持据点，已形成作品身份。当前优先投入成长兑现、连续游玩和完整短循环；美术保持独立的约三分之一关注度。</Text>
  <Grid columns="1.2fr 1fr" gap={24}>
   <Stack gap={8} style={{padding:16,background:theme.fill.tertiary}}><H2>美术归类</H2><Text>主导：俯视硬边像素、简化角色与装置、局部光照组织未知空间。</Text><Text>次级：高细节废墟插画、简洁文字面板、少量柔光。局部身份成立，各层材质与空间表达尚不均。</Text><Text weight="semibold">保留原角色；色彩自由。低饱和不是世界系统的输出标准。</Text></Stack>
   <Stack gap={8}><H2>证据边界</H2><Text>两名新上下文A/B实玩封存；知情技术交叉；协调者额外真实按键循环。高级预置与自然获得分别记账。根实际四次撤离→自然异物成熟装配；第五次出发阻断。后三趟直撤只查生命周期。</Text><Text tone="secondary">诊断寻路读取完整地图，不能算新手导航。声音未审听；长线经济、所有工具组合和持续供给尚未通过。</Text><Text tone="secondary">新世界地图未进入正式随机池；本轮旧地表问题不撤销I26认可。</Text></Stack>
  </Grid>
  <Divider/>
  <Row align="center" wrap><H2>按主题复核</H2>{["全部","成长","玩法","美术","运行"].map(g=><span key={g}><Button variant={g===group?"primary":"ghost"} onClick={()=>setGroup(g)}>{g}</Button></span>)}</Row>
  <Table headers={["级别 / 编号","结论","证据"]} rows={shown.map(x=>[x.priority+" · "+x.id,x.title,x.evidence])}/>
  {shown.map(x=><section key={x.id}><Stack gap={6}><H3>{x.id} · {x.title}</H3><Text>{x.detail}</Text><Text tone="secondary">最小下一步：{x.next}</Text></Stack></section>)}
  <Divider/>
  <H2>建议制作顺序</H2>
  <Table headers={["顺序","目标","验证范围"]} rows={stages}/>
  <Text size="small" tone="secondary">来源：docs/qa/game-wide-review-2026-09-18.md及同日art/play/tech/coordinator原始证据。优先级为专家判断，未计总分。整改尚未实施；本轮没有提交或推送。</Text>
 </Stack>;
}
