import json, csv, hashlib, math
from pathlib import Path
BASE=Path('docs/qa/artifacts/r100-i10-i12'); OUT=BASE/'b11-b14-normal-preparation'
def read(p): return json.loads(Path(p).read_text())
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def receipt(p): return {'path':str(p),'sha256':sha(p)}
# Each entry maps the existing shot order, not new camera requests or a new test plan.
facts={
'crushed-seam':dict(see=['两低母层为大面，不能回到六个同形箭头','物4压口接物2；露出完整脚边/短断口','物5同时接两母层，仍留中央宽裸床','上端物3确实离断，不冒称母床压住','下端物6离断，断头与低母层有高低主次'],boundary='低1/2可踩；实体3–6有明确下沿。',pollution='物4原可见断纹只有4px，02必须靠正常肩灯读出真实局部缝；05的物6仅7px。光圈/污染场不能替代局部断口。',limit='01不能同时证明三对材料接触；必须保留02+03。04/05是离断片证据，不能改写为四件全相接。'),
'husk-reef':dict(see=['不等高薄壳背的内外层，避免完整圆盆','横断片真端口与可走床同框','倒伏低皮面积占优且贴床可踩','独立下背有厚度，不是绿孔/一条贴线'],boundary='四solid与一低皮的高低界限；横断体留端口。',pollution='至少看清横断端和下背的局部侵蚀，本色黄灰外皮/暗红内壁仍分开。',limit='01只主看上中段，不能一张签三背；04补下背。03静止图不能证明低皮可踩。'),
'fibre-scree':dict(see=['西团三束实际交接为整体粗团','东团反向斜压与西团有方向差','两粗团之间宽曲床，非绕六根针','低屑与裸床连续，屑不假画障碍'],boundary='粗团整段落足清楚；低7/8仍是走面。',pollution='侵蚀应挂粗断端，不能把底床画尖刺/全亮边。',limit='01目标127px、02目标158px，近端受光不等于深处交接读清；若02接点黑掉，只签剪影并在原扫掠路线再靠近，不能放大曝光冒签。03不能证明两团真实接触。'),
'gel-rafts':dict(see=['左组一厚头对低片，厚薄不混','两张低片断开，柔缓顶面而非板圈','组间宽床明确分组','右组一厚头高于左组','右侧低片仍有连续薄面与真裸口'],boundary='六件分两组但仅3/6是solid；低片不能画统一高边。',pollution='两厚头可见真实局部断纹，本色粉灰硬脂不能被绿描边替换。',limit='01/04只能证明厚端；02/05必须看薄片落地。03宽床静图不能证明两侧薄片实走。'),
'double-return':dict(see=['南颈、完整钝断端，修后物4不要过粗','中段真实横口与原短路仍可辨','上裂肩与偏心母床','外侧宽返床的空间尺度'],boundary='两条真缺地切开实际地面；低母床不能出现贴地黑线。',pollution='物4修后断纹6px，01/02要看实体断口而非仅cut面积；两侧污染不遮颈。',limit='四原图集中南/中段，不能证明北颈也连通或内外路同终点；需沿原路线到北端548,156留一帧。短/长路比较仍以原实际路线记录为准。'),
'offset-basins':dict(see=['上岸厚弯唇与浅湾','错位两岸之间真短接床','南移后下岸厚端与短口共存','西侧共享宽外床'],boundary='两岸是开口弯岸，不是两完整盆；内外绕口均有脚边。',pollution='上下各自局部断口亮，不以两整圈绿线表示侵蚀。',limit='02只看中短口，不能证明西返路；04补外床。原preflight已含物2 y539，不得用旧y507失败稿生成图。'),
'pinched-fan':dict(see=['粒肩与膜根实际相接；修后膜5未脱离','中间露出的是真裸床','粒肩/膜6相接且断纹从其下露出','低扇仍贴床可踩'],boundary='粒3/4+膜5/6实体；膜1/2低走面。',pollution='5/6各24px断纹必须是真受压缝，不能只拍更显眼的粒肩裂纹。',limit='01距目标134px、03距136.5px；外皮看清不等于下面膜根看清。02不能替代两夹点实接，04也不能证明可走性。'),
'spliced-reaches':dict(see=['长低束床的大静面与薄边','短斜床确实搭接两床，上断束压交接','下断束/短横返口不被完整高桥封住','北长床与南长床有分离长度'],boundary='真裂地边与表面束纹分开；低1–3不能画直立桥架。',pollution='两接点粗断束发光，本身长低床不应被画成绿色桥。',limit='02/03足以看两接点，01/04补床主次；仅四静图不能证明沿斜床换床，应保实际WASD转场。'),
'white-scarfield':dict(see=['明亮压实床上有真实粒感/厚裂边','上横口暗粒体与白低床主次','下横口错位且完整身体口','东床在真缺地内侧连通，不能截外VOID沿'],boundary='亮床灯外仍黑；两低层不许重复blue式横床长黑边。',pollution='暗粒体局部侵蚀区别于浅床白亮，不增假安全光区。',limit='04是788,548的实站，不是旧外VOID猜点；它证明东侧近段边，不能签整个东沿。原东路中节点是788,444。'),
'black-lacuna':dict(see=['浅灰裸床进入真实偏心缺湾','唯一高脂头明显厚于长薄唇','深色薄唇有受光材质/清楚低边','低尾柔缓并止于真边'],boundary='墨紫材料与真正VOID要可分；低胶不能回到硬板轮廓。',pollution='只高头局部侵蚀足以，黑材本色不能当吞光对象；03/04不因低片无亮缝判失败。',limit='02只能证明高体；01+03/04必须给同一真实缺湾的材料/裸床/缺地关系。黑区存在不等于实际VOID。'),
'ochre-folds':dict(see=['独立宽折口内外皮与真实折面','高褶压向共同宽床','从折口退到同一静庭','下折仍独立，不串成连续缝'],boundary='三组离散宽折、完整短横缝；六片同轮廓风险要看体量而非名字。',pollution='新pleated-tear是约短缝而非小圆点；原04只瞄片体，不能签真实缝。用已提804,564→851.905,601.292近缝补帧。',limit='原01–04全未直接瞄真实joint；02离最近原记录站的joint仍210px，不能承诺中组缝灯下可见。补帧仅证第3实例，不替三组都通过。'),
'violet-marrows':dict(see=['短粗芯真实局部孔壁和外包皮','长低芯不同朝向横断孔群','孔与完整身体大缝在一帧有尺度区分','第三大片完整外皮无假孔群'],boundary='孔4–14px真实封底，不作为通口；低外皮可踩。',pollution='两芯局部断纹6/7px，不能把浅粉孔内壁当绿色污染或VOID。',limit='01/02可能只看到面色；若看不出孔底坡壁，只签颜色不签孔髓。04不证明无断面，只表示无孔的完整外皮主面。'),
'fractured-estuary':dict(see=['北低层床以大面汇入','两方向地床真正汇合成宽颈','上胶肩与层床实际相接','下胶肩并向短侧湾分开'],boundary='颈旁是真缺地；三低层不得是规则大三角贴片，胶肩脚体可辨。',pollution='厚胶肩局部侵蚀，不沿整颈铺绿；通颈余量不能靠画面推断。',limit='原01只有上支床，04主看下胶肩，不能证明南低支床也汇入；沿原lower-sheet-to-neck起点300,580加朝400,580一帧可补。'),
'woven-quarters':dict(see=['唯一厚毡与短纤表面，不是石壳云纹','长纤跨两低毡，长短材料同框分清','南长束与低层实际接触','东低片安静可走，和真裂地分开'],boundary='低1/3/4、solid2/5/6；两真短裂地改变对角连通。',pollution='厚毡及粗长束局部缝，低毡不是发光地毯。',limit='3119仍旧短纤来源，P34新源需要新冻结绑定才可签该材料。原01–04不能完整涵盖两个裂地终端，不以四图替代两原WASD绕行线。'),
'shell-patchwork':dict(see=['北厚壳夹膜，膜只从断接处露','不规则中裸床与壳端边界','南厚壳真实压住薄膜端','东大低壳与短厚端的面积主次'],boundary='大低壳可踩，中厚端与膜卷起是真阻挡；非等距瓷砖缝。',pollution='侵蚀仅裂接处，不铺等距绿色格线；低壳本色灰白/膜深红/蓝床分清。',limit='02中裸床图不能证明南北材料接触，01/03必须同框见壳压膜；04也不能签西侧整个外返路。'),
'last-shelf':dict(see=['上突台短裂肩，高低主次','下突台完整厚压断端，不是又一叉','内侧连续无叉颗粒床连接两台','下外探处近边清楚且真实终止'],boundary='三次缺地削岸，两处突台不同宽；全程非高层可攀平台。',pollution='物3各档仅5px断纹，02必须看真短缝；不以44px的上肩替代下肩。',limit='04只看下台；原01瞄上断肩，未看上台外探边。原上路末站948,268已支持，可补面朝相邻缺口/外沿；不从上下各一实体推断全岸都可见。'),
}
text=Path('src/generated/r100-native-worlds.ts').read_text();catalog=json.loads(text.split('export const R100_NATIVE_WORLDS: readonly R100NativeWorldEntry[] = ')[1].strip().removesuffix(';'));byid={w['id']:w for w in catalog}
rows={r['world_id']:r for r in csv.DictReader(open('data/rift-native-worlds.csv'))};worlds=[];sources=[];checked_refs=0
for batch in range(11,15):
 cp=BASE/f'b{batch}-author-preflight/camera-supported.json';camera=read(cp);rp=Path(camera['report']['path']);assert sha(rp)==camera['report']['sha256'];report=read(rp);sources.extend([receipt(cp),receipt(rp)])
 for world in camera['worlds']:
  wid=world['world'];cases={r['grade']:r for r in report['results'] if r['id']==wid};assert set(cases)=={'low','medium','severe'};assert all(r['status']=='PASS' for r in cases.values())
  for grade,r in cases.items():assert r['definition']==next(d for d in byid[wid]['definitions'] if d['grade']==grade)
  views=[]
  for number,v in enumerate(world['views'],1):
   for grade,e in v['allGradeEvidence'].items():
    r=cases[grade];point=(r['spawnRoutes'][e['routeIndex']]['route'][e['pointIndex']] if e['kind']=='spawnRoute' else r['crossings'][e['routeIndex']]['segments'][e['segmentIndex']][e['pointIndex']]);assert point==v['bodyPoint'];checked_refs+=1
   views.append(dict(v,number=number,mustSee=facts[wid]['see'][number-1],proposedFilename=f'{number:02d}-original-station.png'))
  joint=[e for r in cases.values() for e in r['fractureEvidence']]
  worlds.append({'batch':batch,'world':wid,'label':byid[wid]['label'],'nativeRow':rows[wid],'cameraEvidence':receipt(cp),'actualEvidence':receipt(rp),'originalSeed':report['seed'],'views':views,'requiredBoundaryRead':facts[wid]['boundary'],'requiredPollutionRead':facts[wid]['pollution'],'coverageLimit':facts[wid]['limit'],'minimumActualJointPixels':min(e['joint'] for e in joint),'minimumActualCutPixels':min(e['cut'] for e in joint),'nearestAndDifference':cases['medium']['intent']['relations'],'originalRoutes':[{ 'name':x['name'],'mediumActualNodes':[s['actual'] for s in x['steps']], 'bounds':x.get('bounds')} for x in cases['medium']['crossings']]})
assert len(worlds)==16 and checked_refs==198
result={'status':'read-only-capture-preparation-not-art-approval','scope':'读取原actual报告和当前作者定义，逐引用验证66原机位×3档=198个记录点；未运行新地图/浏览器，不证明实际光照/朝向/遮挡。','catalogWorldCount':len(catalog),'currentDefinitionsMatched':48,'originalSupportedViews':66,'originalPathReferencesChecked':checked_refs,'grades':['low','medium','severe'],'seed':20261005,'captureInstructions':['按原world/grade/seed与对应新冻结源执行；实际effectiveSeed不同则原机位支持不能自动继承。','坐标取bodyPoint，朝向精确lookAtMaterialPoint/angleRadians；保留实际输入位置、实际facing和源receipt，不以北/东粗标签代替朝向。','中档先看构造/接触/下沿；低重同关键视角核本色与侵蚀，不能只采一张最亮图。','全局raster cut/joint计数仅为前置面积，不等于普通肩灯下可见；目标在暗处或被挡必须明确记未覆盖。','可走低面、两路长度/连通靠原实际移动证据；静图只签视觉读法。','下列补点只复用既有实际路线，不更改原必须路线、节点和24px站误差标准；须保实际输入记录。'], 'pendingMaterial':'woven-quarters 的3119旧short-fibre不能借primary-fibre-surface隔离图通过；待P34唯一源窗方案实际世界新源采图。', 'worlds':worlds,'sources':sources+[receipt('data/rift-native-worlds.csv'),receipt('src/generated/r100-native-worlds.ts'),receipt('docs/art/rift-r100-i10-i12.md'),receipt(BASE/'b13-author-preflight/pleated-tear-refined/near-joint-camera.json')]}
(OUT/'checklist.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
lines=['# B11–B14 原站位正常画面清单','', '只读准备；48 当前作者定义与原成功 actual 报告一致。66 原机位的 198 个三档路径引用已逐点复核。身体可达不等于画面可读。','','执行：沿原计划使用 seed 20261005，记录实际 effectiveSeed、位置及 facing；精确朝下列目标，普通灯光不变。中档检查构造，低重回看关键边界与本色。原图缺证则记未覆盖，不能靠像素计数签字。','']
for w in worlds:
 lines += [f"## B{w['batch']} · {w['world']}（{w['label']}）",'']
 for v in w['views']:
  p,t=v['bodyPoint'],v['lookAtMaterialPoint'];lines += [f"- {v['number']:02d}：站 ({p['x']},{p['y']}) → 看 ({t['x']},{t['y']})，角 {v['angleRadians']:.3f}。{v['mustSee']}。"]
 lines += ['',f"边界：{w['requiredBoundaryRead']}",f"侵蚀：{w['requiredPollutionRead']}",f"不能据此证明：{w['coverageLimit']}",'']
lines+=['所有机位的逐档路径引用、原路线节点/窗口、实际断面和断纹下界、来源SHA见同目录 checklist.json。此清单不创建新的图审通过。','']
(OUT/'checklist.md').write_text('\n'.join(lines))
print(json.dumps({'worlds':16,'currentDefinitionsExact':48,'views':66,'references':checked_refs,'reportSha256':sha(OUT/'checklist.json')},ensure_ascii=False))
