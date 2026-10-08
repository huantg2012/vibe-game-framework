from pathlib import Path
import json,shutil,hashlib
root=Path('/Users/yilungao/coh');dest=root/'docs/qa/artifacts/r100-i10-i12/b12-isolated-author';header=(root/'data/rift-native-worlds.csv').read_text().splitlines()[0];worlds=[]
F={'s':'folded-slab','f':'fibre-knot','c':'broken-shell','g':'granular-ridge','m':'membrane-rim','j':'gel-flow'}
def R(name,points,bounds=None):return {'name':name,'points':points,'bounds':bounds}
def add(id,label,family,base,org,items,routes,relations,erosion='850:32;935:48;946:96;881:112',edge=''):
 instances=[':'.join(map(str,[F[f],role,x,y,a,l,w,h,t,fold,3,.7,.25])) for shape,f,role,x,y,a,l,w,h,t,fold in items]
 worlds.append({'row':[id,label,'12','false',F[family],base,org,'4','|'.join(instances),'|'.join(i[0] for i in items),erosion,edge],'routes':routes,'relations':relations})
add('double-return','双缝归路','s','ash-strata','patches',[
 ('fallen-bundle','s','relief',556,401,1.52,460,230,5,2,.39),('fracture-fan','s','solid',525,331,.1,155,96,45,12,.68),('fallen-bundle','s','solid',592,441,-.10,120,64,40,10,.55),('compressed-wedge','s','solid',515,542,0,150,70,32,9,.47)],
 [R('inside-short-turns',[[579,635],[613,553],[514,478],[602,387],[567,250],[551,155]],[440,130,660,668]),R('outside-wide-return',[[579,635],[846,607],[876,408],[846,189],[551,155]],[520,125,925,675])],
 {'walkableSurfaceObjects':[1],'routeLengthOrder':['inside-short-turns','outside-wide-return'],'nearest':'cleft-tableland','difference':['中央长静床被两处实缺地从侧面分隔，南北连颈通向外返路','三个短断肩使床内换侧，仅上肩保裂头，中下钝短端间留约33px真实横隙；东侧绕整条裂地更远更宽']},'345:215;430:235;438:485;359:535;331:430|688:200;766:230;736:530;655:556;670:395','8')
add('offset-basins','错湾连床','c','ivory-basin','patches',[
 ('clamp-bank','c','solid',449,282,.3,320,155,55,13,.67),('clamp-bank','c','solid',658,539,.45,300,165,42,11,.48)],
 [R('offset-inner-mouths',[[484,411],[594,404],[754,407],[808,536]],[440,360,855,580]),R('shared-west-return',[[397,581],[301,427],[289,251],[327,171]])],
 {'disjointSolidObjects':[1,2],'nearest':'porcelain-maw','difference':['两湾前后错位、开口同向偏东，厚端高低不等','东侧断唇短接和西侧完整外床并存，不是对口收喉']})
add('pinched-fan','双夹膜扇','m','ivory-basin','patches',[
 ('torn-sheet','m','relief',418,407,-.2,355,240,5,2,.45),('torn-sheet','m','relief',741,427,.28,335,250,4,2,.4),('fracture-fan','g','solid',376,286,.4,180,112,42,11,.62),('fracture-fan','g','solid',769,326,-.3,170,110,38,10,.51),('torn-sheet','m','solid',411,356,.52,185,145,35,9,.73),('torn-sheet','m','solid',741,405,-.52,172,138,32,8,.63)],
 [R('bare-middle-tear',[[571,616],[571,451],[570,274]],[534,230,615,655]),R('outer-fan-rim',[[297,557],[235,421],[282,216]]),R('low-fan-eastern-cross',[[696,578],[833,487],[877,359]])],
 {'contacts':[[1,3],[1,5],[2,4],[2,6]],'walkableSurfaceObjects':[1,2],'barePoint':[572,451],'nearest':'satin-fan','difference':['两粒肩各挤起一件真实膜褶，中央表皮真分开露地','低扇面可踩、夹点阻挡，形成中穿床和外膜缘两种转折']})
add('spliced-reaches','接束分滩','f','crystal-fibre','bands',[
 ('fallen-bundle','f','relief',340,480,1.4,550,185,4,2,.31),('fallen-bundle','f','relief',725,300,1.45,535,205,5,2,.36),('fallen-bundle','f','relief',550,402,-.5,410,140,5,2,.46),('fallen-bundle','f','solid',487,357,-.5,175,110,44,12,.66),('fallen-bundle','f','solid',615,453,-.55,150,96,38,10,.54)],
 [R('diagonal-bed-splice',[[347,618],[429,461],[549,406],[672,350],[733,181]],[275,140,805,665]),R('short-cross-return',[[716,509],[637,529],[560,403],[398,405]])],
 {'walkableSurfaceObjects':[1,2,3],'nearest':'braided-seam','difference':['两条长床之间只有一段斜横接，两个断束只占接点','从南侧左床换到北侧右床，地形缺失令同侧直进终止而非三纵床连续横连']},'480:0;620:0;611:264;573:329;505:338;474:276|420:768;550:768;555:551;518:478;456:492;413:566','8')
base=(root/'data/rift-native-worlds.csv').read_bytes();text=''.join(','.join(w['row'])+'\n' for w in worlds)
(dest/'native-draft.csv').write_text(header+'\n'+text);(dest/'intent.json').write_text(json.dumps({w['row'][0]:{'batch':'b12','routes':w['routes'],'relations':w['relations']} for w in worlds},ensure_ascii=False,indent=2)+'\n')
(dest/'preparation.json').write_text(json.dumps({'status':'isolated-author-unchecked','formalCatalogSha256':hashlib.sha256(base).hexdigest(),'worlds':[w['row'][0] for w in worlds],'formalDataUnchanged':True},indent=2)+'\n')
out=Path('/tmp/r100-i10-b12-catalog');(out/'data').mkdir(parents=True,exist_ok=True)
for name in ['src/generation/world-study/r100-generated-scenes.ts','src/generated/rift-world-profile-data.ts']:
 (out/name).parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/name,out/name)
(out/'data/rift-native-worlds.csv').write_bytes(base+text.encode());print('Prepared4isolatedB12rows;formalCSVunchanged')
