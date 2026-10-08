from pathlib import Path
import json,shutil,hashlib
root=Path('/Users/yilungao/coh');dest=root/'docs/qa/artifacts/r100-i10-i12/b14-isolated-author';header=(root/'data/rift-native-worlds.csv').read_text().splitlines()[0];worlds=[]
F={'s':'folded-slab','f':'fibre-knot','c':'broken-shell','g':'granular-ridge','m':'membrane-rim','j':'gel-flow'}
def R(name,points,bounds=None):return {'name':name,'points':points,'bounds':bounds}
def add(id,label,family,base,org,items,routes,relations,erosion='850:32;935:48;946:96;881:112',edge=''):
 instances=[':'.join(map(str,[F[f],role,x,y,a,l,w,h,t,fold,3,.7,.25])) for shape,f,role,x,y,a,l,w,h,t,fold in items]
 worlds.append({'row':[id,label,'12','false',F[family],base,org,'4','|'.join(instances),'|'.join(i[0] for i in items),erosion,edge],'routes':routes,'relations':relations})
add('fractured-estuary','断层汇滩','s','ash-strata','patches',[
 ('fracture-fan','s','relief',380,225,.38,420,210,5,2,.42),('fracture-fan','s','relief',400,580,-.38,440,200,4,2,.36),('fracture-fan','s','relief',585,398,.07,300,190,5,2,.5),('clamp-bank','j','solid',593,271,.45,170,115,35,10,.67),('clamp-bank','j','solid',662,499,-.4,160,110,38,11,.6)],
 [R('upper-sheet-to-neck',[[262,225],[475,252],[558,394]],[220,175,640,433]),R('lower-sheet-to-neck',[[297,581],[467,567],[558,394]],[255,350,690,640]),R('neck-upper-return',[[558,394],[724,264],[899,235]]),R('neck-short-side-bay',[[558,394],[752,564],[899,614]])],
 {'walkableSurfaceObjects':[1,2,3],'nearest':'pressed-rim','difference':['两条真实留地支流汇入同一个地颈，再分为上宽床和下侧湾','胶只挤成汇口旁两短断肩，角色先汇合后分叉而非绕高胶头双尾']},'0:310;380:315;473:370;454:432;315:480;0:492|1024:360;760:345;690:395;760:465;1024:505','8')
add('woven-quarters','压纤四角','m','ivory-basin','patches',[
 ('compressed-wedge','m','relief',720,260,-.2,320,220,4,2,.43),('compressed-wedge','m','solid',360,250,.2,300,210,43,12,.69),('compressed-wedge','m','relief',390,550,.2,310,220,5,2,.52),('compressed-wedge','m','relief',780,560,-.35,290,205,4,2,.38),('fallen-bundle','f','solid',557,282,.8,250,90,42,11,.6),('fallen-bundle','f','solid',573,554,-.5,240,90,40,11,.58)],
 [R('cut-diagonal-upper-route',[[382,467],[428,364],[640,334],[775,353]]),R('cut-diagonal-lower-route',[[434,619],[561,635],[745,662],[880,537]]),R('east-open-court',[[862,623],[876,440],[859,222]])],
 {'contacts':[[2,5],[1,5],[3,6],[4,6]],'walkableSurfaceObjects':[1,3,4],'nearest':'felt-wedges','difference':['四片压毡只有西北一片翻起，两粗长纤实际接两侧低片','两条短真实缺地切去对角直连，其余宽床保留，不是三厚楔聚头']},'480:375;610:353;690:408;585:445;481:425|225:360;324:345;410:387;356:417;250:420','8')
add('shell-patchwork','拼裂壳皮','c','ivory-basin','patches',[
 ('clamp-bank','c','relief',367,381,-.4,360,255,5,2,.48),('clamp-bank','c','relief',765,405,.45,385,270,4,2,.4),('clamp-bank','c','solid',539,255,-.2,170,102,46,12,.64),('clamp-bank','c','solid',613,487,.6,190,112,52,13,.72),('torn-sheet','m','solid',473,309,.44,170,120,32,9,.7),('torn-sheet','m','relief',705,520,-.55,180,130,5,2,.52)],
 [R('irregular-bare-middle',[[504,652],[540,538],[556,388],[669,330],[731,216]]),R('low-shell-west-return',[[276,562],[235,398],[342,210]]),R('east-low-shell-return',[[863,586],[902,423],[821,212]])],
 {'contacts':[[1,5],[3,5],[2,6],[4,6]],'walkableSurfaceObjects':[1,2,6],'nearest':'buried-lamellae','difference':['两块大低壳间的短厚端夹住膜折，材料在局部破接处真实相碰','不规则裸床从拼片中穿过，不是层片逐渐被颗粒埋没或完整等距格网']})
add('last-shelf','断岸余台','g','ash-strata','patches',[
 ('fallen-bundle','g','relief',690,391,1.52,540,450,5,2,.43),('fracture-fan','s','solid',786,242,-.08,135,58,38,11,.62),('compressed-wedge','s','solid',817,476,.12,145,66,44,12,.69)],
 [R('upper-surviving-shelf',[[650,282],[755,292],[899,282],[945,266]],[610,216,965,305]),R('lower-surviving-shelf',[[651,522],[757,542],[916,531],[947,506]],[610,443,965,550]),R('shared-inland-return',[[651,522],[614,389],[650,282]],[565,245,705,570])],
 {'walkableSurfaceObjects':[1],'nearest':'scalloped-reach','difference':['三次真缺地削去东沿后只留两处外探余台，内侧一整片宽床共同接通','每台只一短层肩，上台低裂肩、下台较高完整压断面，连续无叉颗粒床占主面积；身体侧探到真实终点再返回而非进入三个凹湾']},'1024:72;866:72;805:135;847:199;1024:210|1024:318;836:306;767:363;805:419;1024:442|1024:562;862:554;792:614;847:696;1024:715','8')
base=(root/'data/rift-native-worlds.csv').read_bytes();text=''.join(','.join(w['row'])+'\n' for w in worlds)
(dest/'native-draft.csv').write_text(header+'\n'+text);(dest/'intent.json').write_text(json.dumps({w['row'][0]:{'batch':'b14','routes':w['routes'],'relations':w['relations']} for w in worlds},ensure_ascii=False,indent=2)+'\n')
(dest/'preparation.json').write_text(json.dumps({'status':'isolated-author-unchecked','formalCatalogSha256':hashlib.sha256(base).hexdigest(),'worlds':[w['row'][0] for w in worlds],'formalDataUnchanged':True},indent=2)+'\n')
out=Path('/tmp/r100-i10-b14-catalog');(out/'data').mkdir(parents=True,exist_ok=True)
for name in ['src/generation/world-study/r100-generated-scenes.ts','src/generated/rift-world-profile-data.ts']:
 (out/name).parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/name,out/name)
(out/'data/rift-native-worlds.csv').write_bytes(base+text.encode());print('Prepared4isolatedB14rows;formalCSVunchanged')
