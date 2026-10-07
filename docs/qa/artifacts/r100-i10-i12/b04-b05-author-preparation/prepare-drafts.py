from pathlib import Path
import json,shutil,hashlib
root=Path('/Users/yilungao/coh');header=(root/'data/rift-native-worlds.csv').read_text().splitlines()[0]
F={'s':'folded-slab','f':'fibre-knot','c':'broken-shell','g':'granular-ridge','m':'membrane-rim','j':'gel-flow'}
S={'s':'fracture-fan','f':'fallen-bundle','c':'clamp-bank','m':'torn-sheet'}
worlds=[]
def add(batch,id,label,primary,base,org,items,routes,relations,erosion='850:32;935:48;946:96;881:112',edge=''):
 instances=[];shapes=[]
 for shape,f,role,x,y,a,l,w,h,t,fold in items:
  instances.append(':'.join(map(str,[F[f],role,x,y,a,l,w,h,t,fold,3,.7,.25])));shapes.append(S[shape])
 worlds.append({'batch':batch,'row':[id,label,'10','false',F[primary],base,org,'4','|'.join(instances),'|'.join(shapes),erosion,edge],'routes':routes,'relations':relations})
def R(name,points,bounds=None):return {'name':name,'points':points,'bounds':bounds}
add('b04','fibre-choke','纤束夹口','f','crystal-fibre','clusters',[
 ('c','c','solid',447,313,1.30,235,92,46,12,.63),('c','c','solid',718,404,1.25,220,96,42,11,.52),
 ('f','f','solid',454,249,.1,175,94,54,13,.58),('f','f','solid',520,391,.28,180,100,49,12,.68),('f','f','solid',739,508,-.3,175,94,37,10,.46)],
 [R('central-fold',[[565,556],[631,459],[635,330],[574,224]],[490,190,680,580]),R('west-outer',[[270,570],[270,210]]),R('east-outer',[[870,586],[870,225]])],{'contacts':[[1,3],[1,4],[2,5]],'nearest':'bladder-weave','difference':['断束压在两片破唇之间，取消完整囊腔和牵丝','缺段折口可横穿，外侧两路不靠纤锚分区']})
add('b04','buried-lamellae','埋片砂床','s','ash-strata','bands',[
 ('s','s','solid',365,299,.4,240,120,46,12,.6),('s','s','relief',528,377,.4,280,130,5,2,.42),('s','s','relief',716,468,.4,235,105,3,1,.28),('f','g','relief',645,486,.4,490,205,6,2,.35)],
 [R('exposed-end-to-buried-bed',[[296,440],[493,441],[642,502],[816,540]]),R('high-end-outer',[[265,402],[247,202],[487,220]])],{'contacts':[[2,4],[3,4]],'walkableSurfaceObjects':[2,3,4],'nearest':'grain-laminate','difference':['一个阻挡高端逐步变成两片可走低肩','颗粒只在一侧堆积并覆盖埋片端，不是两材平行摆放']})
add('b04','pressed-rim','挤脂壳缘','j','ivory-basin','patches',[
 ('c','j','solid',510,359,-.08,260,210,62,14,.68),('c','c','solid',594,322,1.2,195,88,43,12,.58),('c','j','relief',384,477,-.65,300,150,5,2,.64),('c','j','relief',650,488,.45,350,180,4,2,.36)],
 [R('low-tail-shortcut',[[309,520],[483,548],[657,565],[796,494]]),R('outer-head',[[282,511],[282,215],[764,210],[806,440]])],{'contacts':[[1,2],[1,3],[1,4]],'walkableSurfaceObjects':[3,4],'nearest':'clamped-shore','difference':['胶自身成为高压头，两个低尾向不同方向展开','次材短壳仅支住一肩，无主导场景的长厚壳唇']})
add('b04','wedged-hide','楔间破皮','m','ivory-basin','patches',[
 ('s','s','solid',382,350,.5,210,140,54,12,.48),('s','s','solid',721,329,-.4,230,145,48,11,.6),('m','m','solid',445,418,-.35,180,165,35,8,.72),('m','m','relief',698,453,.3,205,146,5,2,.56),('m','m','relief',797,517,.82,160,118,3,1,.38)],
 [R('bare-tear',[[565,547],[569,419],[565,270]],[530,240,605,580]),R('fold-outer',[[308,560],[256,372],[299,195]])],{'contacts':[[1,3],[2,4]],'barePoint':[570,420],'walkableSurfaceObjects':[4,5],'nearest':'tension-membrane','difference':['硬楔压住西厚卷和东断散低皮，不再是拉平的完整膜','中间表皮真正缺失露出可行裸床，形成直接穿口']})
add('b05','quiet-spur','静床窄岬','g','ash-strata','patches',[
 ('s','g','relief',796,392,0,285,165,4,2,.35),('s','g','solid',561,224,.2,155,103,35,9,.54),('s','g','solid',640,526,-.25,170,116,42,10,.61),('f','g','solid',424,318,.48,115,90,30,8,.46),('f','g','solid',481,373,-.35,108,82,35,9,.56),('f','g','solid',403,427,.22,122,94,27,7,.4),('f','g','solid',438,479,-.42,110,81,23,7,.48)],
 [R('quiet-long',[[577,584],[860,496],[934,401],[911,311],[662,236]],[550,215,960,620]),R('dense-short',[[577,584],[543,473],[538,365],[519,279],[662,236]],[350,200,680,630])],{'nearest':'cinder-ridge','difference':['真缺地将东侧床收成偏心岬，外侧长返路有实际长度','四小粒块只形成内侧短密段，无贯穿全图的粒脊'],'routeLengthOrder':['dense-short','quiet-long']},'660:0;1024:0;1024:272;876:272;794:224;680:200|740:540;908:492;1024:440;1024:768;660:768;660:616|595:335;825:335;862:390;806:442;608:420','8')
add('b05','split-fall','双向坠片','s','ash-strata','clusters',[
 ('s','s','solid',343,347,.65,175,100,36,9,.55),('s','s','solid',492,429,.6,165,90,45,11,.68),('s','s','solid',669,526,.5,160,100,27,8,.42),('s','s','solid',338,577,-.7,160,92,35,9,.51),('s','s','solid',507,554,-.9,155,90,38,10,.6),('s','s','solid',667,357,-.5,170,105,50,12,.7)],
 [R('collision-gap',[[415,636],[404,472],[574,492],[582,338],[572,231]],[280,200,780,670]),R('west-outer',[[242,641],[220,255],[410,183]]),R('quiet-back',[[325,161],[834,166]])],{'nearest':'shard-switchback','difference':['两股相反斜向的片序只在前段交会','穿出交会处后是横贯后部的宽静床，不沿全路重复断片']})
add('b05','three-shelves','三岸留庭','c','ivory-basin','patches',[
 ('c','c','solid',398,435,1.1,190,115,50,13,.62),('c','c','solid',686,449,-1.2,220,125,62,14,.73),('c','c','solid',541,651,.1,200,115,42,11,.52)],
 [R('southwest-mouth',[[356,603],[431,537],[535,462]],[320,400,590,660]),R('southeast-mouth',[[780,592],[686,571],[590,512],[535,462]],[510,430,820,650]),R('wide-north',[[535,462],[535,284]],[450,240,610,500])],{'nearest':'stepped-bowl','difference':['三件独立短弯岸形成三种大小开口，不是两道长对岸','低庭向北完全敞开，近处能同时看到两岸断端'],'disjointSolidObjects':[1,2,3]})
add('b05','frayed-outwash','散纤远滩','f','crystal-fibre','bands',[
 ('f','f','solid',489,205,1.2,230,125,55,13,.66),('f','f','solid',652,238,1.8,220,118,47,12,.57),('f','f','solid',434,386,1.55,165,95,35,9,.48),('f','f','solid',654,421,1.84,143,87,27,8,.4),('f','f','solid',531,516,1.25,125,76,20,6,.3),('f','f','relief',398,593,1.34,150,82,5,2,.35),('f','f','relief',682,607,1.7,130,72,3,1,.22)],
 [R('root-through-outwash',[[566,147],[570,284],[548,386],[604,517],[602,662]],[350,110,790,700]),R('quiet-cross-bed',[[276,684],[858,684]])],{'nearest':'splayed-fibres','difference':['分离的实体按北到南降高，末段真实变成可踩低痕','密根口与南端宽横床形成回程方向，不是完整放射叉'] ,'walkableSurfaceObjects':[6,7]})
base=(root/'data/rift-native-worlds.csv').read_bytes()
for batch in ['b04','b05']:
 out=Path('/tmp/r100-i10-'+batch+'-catalog');out.mkdir(exist_ok=True)
 for name in ['src/generation/world-study/r100-generated-scenes.ts','src/generated/rift-world-profile-data.ts']:
  (out/name).parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/name,out/name)
 (out/'data').mkdir(exist_ok=True);text=''.join(','.join(w['row'])+'\n' for w in worlds if w['batch']==batch);(out/'data/rift-native-worlds.csv').write_bytes(base+text.encode())
 dest=root/'docs/qa/artifacts/r100-i10-i12'/(batch+'-isolated-author');dest.mkdir(exist_ok=True)
 (dest/'native-draft.csv').write_text(header+'\n'+text)
 (dest/'intent.json').write_text(json.dumps({w['row'][0]:{k:w[k] for k in ['batch','routes','relations']} for w in worlds if w['batch']==batch},ensure_ascii=False,indent=2)+'\n')
 (dest/'preparation.json').write_text(json.dumps({'status':'isolated-not-admitted','productionCatalogSha256':hashlib.sha256(base).hexdigest(),'draftWorlds':[w['row'][0] for w in worlds if w['batch']==batch],'formalCsvUnchanged':True},indent=2)+'\n')
print('Prepared8isolatedauthorrows; formalCSVunchanged')
