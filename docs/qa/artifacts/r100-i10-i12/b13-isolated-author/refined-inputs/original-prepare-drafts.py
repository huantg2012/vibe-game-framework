from pathlib import Path
import json,shutil,hashlib
root=Path('/Users/yilungao/coh');dest=root/'docs/qa/artifacts/r100-i10-i12/b13-isolated-author';header=(root/'data/rift-native-worlds.csv').read_text().splitlines()[0];worlds=[]
def R(name,points,bounds=None):return {'name':name,'points':points,'bounds':bounds}
def add(id,label,family,base,org,items,routes,relations,erosion='850:32;935:48;946:96;881:112',edge='',construction=4):
 instances=[':'.join(map(str,[family,role,x,y,a,l,w,h,t,fold,3,.7,.25])) for shape,role,x,y,a,l,w,h,t,fold in items]
 worlds.append({'row':[id,label,'12','false',family,base,org,str(construction),'|'.join(instances),'|'.join(i[0] for i in items),erosion,edge],'routes':routes,'relations':relations})
add('white-scarfield','白砂断原','granular-ridge','ash-strata','bands',[
 ('fracture-fan','relief',354,389,1.43,555,300,5,2,.42),('fracture-fan','relief',788,423,1.52,570,260,4,2,.35),
 ('fallen-bundle','solid',558,238,.25,140,120,49,12,.58),('fallen-bundle','solid',617,389,-.32,150,125,60,14,.69),('fallen-bundle','solid',552,574,.33,155,115,42,11,.48)],
 [R('first-row-break',[[377,313],[543,314],[752,317]],[330,277,820,351]),R('second-row-break',[[779,492],[610,486],[384,483]],[325,454,845,526]),R('eastern-still-sheet',[[854,647],[902,447],[862,183]])],
 {'walkableSurfaceObjects':[1,2],'nearest':'chalk-divide','difference':['两侧浅色大低床占主面积，暗粗粒只构成短三段中央列','两次横过中列之间保留宽裸床，区别高白岸分出的三口']},'200:245;292:263;307:351;247:382;208:343|825:397;912:369;952:450;903:520;844:494','8')
add('black-lacuna','暗脂缺湾','gel-flow','ivory-basin','patches',[
 ('fracture-fan','relief',705,377,1.48,560,320,4,2,.42),('clamp-bank','solid',653,254,.12,260,160,52,13,.67),('clamp-bank','relief',826,349,1.32,330,100,5,2,.48),('clamp-bank','relief',700,523,.16,280,115,3,1,.32)],
 [R('near-mouth-to-thin-lip',[[470,601],[598,590],[828,543],[902,411]],[430,357,944,645]),R('upper-thick-head-return',[[328,269],[488,181],[750,180],[856,254]]),R('shared-bare-mouth',[[379,598],[349,460],[355,319]])],
 {'walkableSurfaceObjects':[1,3,4],'nearest':'notched-backwater','difference':['一个偏心真实缺地湾取代三低袋，东侧余胶床只一高头','长薄唇与可行裸床入口的明暗来自真实受光材料，黑胶本色不充当吞光']},'427:332;603:307;740:331;806:401;759:482;584:522;446:486;402:416','8')
add('ochre-folds','赭皮折口','membrane-rim','ivory-basin','patches',[
 ('pleated-sheet','solid',342,254,.42,235,145,56,10,.67),('pleated-sheet','solid',658,330,-.33,260,160,68,12,.76),('pleated-sheet','solid',773,578,.62,218,135,45,9,.56)],
 [R('return-to-shared-court',[[430,369],[516,454],[694,464],[633,565]],[393,329,720,616]),R('wide-court-cross',[[314,491],[563,480],[918,449]]),R('outside-last-fold',[[588,646],[895,678]])],
 {'nearest':'rolled-fragments','difference':['复用已验v3宽折面母版，三件分离高折朝共同宽床而非五段半卷弧序','每个折口之间必须退出到裸床；不宣称串成一条连续缝']},erosion='',construction=3)
add('violet-marrows','紫髓横断','granular-ridge','ash-strata','clusters',[
 ('porous-break','solid',382,330,-.35,195,185,68,15,.73),('porous-break','solid',704,495,2.7,320,135,35,10,.5),('fracture-fan','relief',729,244,-.2,250,180,5,2,.35)],
 [R('wide-diagonal-bed',[[278,578],[445,470],[576,352],[859,327]],[235,285,895,625]),R('short-straight-seam',[[564,518],[567,424],[567,327]],[540,300,601,545]),R('outer-skin-approach',[[886,275],[811,146],[631,142]])],
 {'disjointSolidObjects':[1,2],'walkableSurfaceObjects':[3],'nearest':'pore-bank','difference':['短粗与长低两孔芯分离、断面方向不同，夹出斜贯裸床与短直缝','第三件为无孔低外皮片，仍保少量真实外切缘；不是一高孔頭拖两低尾']})
base=(root/'data/rift-native-worlds.csv').read_bytes();text=''.join(','.join(w['row'])+'\n' for w in worlds)
(dest/'native-draft.csv').write_text(header+'\n'+text);(dest/'intent.json').write_text(json.dumps({w['row'][0]:{'batch':'b13','routes':w['routes'],'relations':w['relations']} for w in worlds},ensure_ascii=False,indent=2)+'\n')
(dest/'preparation.json').write_text(json.dumps({'status':'isolated-author-unchecked','formalCatalogSha256':hashlib.sha256(base).hexdigest(),'worlds':[w['row'][0] for w in worlds],'formalDataUnchanged':True,'notes':['ochre-folds intentionally uses existing construction3 pleated-sheet with default erosion; not a new v4 shape','violet low skin has no pore geometry, retains small real cut edges as agreed with art']},ensure_ascii=False,indent=2)+'\n')
out=Path('/tmp/r100-i10-b13-catalog');(out/'data').mkdir(parents=True,exist_ok=True)
for name in ['src/generation/world-study/r100-generated-scenes.ts','src/generated/rift-world-profile-data.ts']:
 (out/name).parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/name,out/name)
(out/'data/rift-native-worlds.csv').write_bytes(base+text.encode());print('Prepared4isolatedB13rows;formalCSVunchanged')
